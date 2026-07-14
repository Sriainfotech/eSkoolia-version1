from decimal import Decimal
import json
import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import Sum, Count
from django.db.models.functions import Coalesce
from django.contrib.auth import get_user_model
from django.http import Http404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from apps.access_control.models import UserRole
from apps.core.models import Class as SchoolClass, Section
from apps.students.models import Student

from .models import Department, Designation, DepartmentType, LeaveDefine, LeaveRequest, LeaveType, Offboarding, PayrollRecord, PayrollSettings, Staff, StaffAttendance, StaffDocument, StaffOnboardDocument, StaffOnboardDraft
from .serializers import (
    DepartmentSerializer,
    DepartmentTypeSerializer,
    DesignationSerializer,
    LeaveDefineSerializer,
    LeaveRequestSerializer,
    LeaveTypeSerializer,
    OffboardingSerializer,
    PayrollRecordSerializer,
    PayrollSettingsSerializer,
    StaffSerializer,
    StaffAttendanceSerializer,
    StaffDocumentSerializer,
    StaffOnboardDocumentSerializer,
    StaffOnboardDraftSerializer,
)


class SchoolScopedModelViewSet(viewsets.ModelViewSet):
    class HRPagination(PageNumberPagination):
        page_size = 25
        page_size_query_param = "page_size"
        max_page_size = 100

    permission_classes = [permissions.IsAuthenticated]
    pagination_class = HRPagination
    permission_codes = {}

    def get_required_permission_code(self):
        action = getattr(self, "action", None)
        if action and action in self.permission_codes:
            return self.permission_codes[action]
        return self.permission_codes.get("*")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        code = self.get_required_permission_code()
        if not code:
            return
        user = request.user
        if user.is_superuser:
            return
        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return queryset
        if user.school_id:
            return queryset.filter(school_id=user.school_id)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school)


class DepartmentViewSet(SchoolScopedModelViewSet):
    queryset = Department.objects.select_related("school", "head", "deputy_head").all()
    serializer_class = DepartmentSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    permission_codes = {"*": "human_resource.departments.view"}

    def get_queryset(self):
        qs = super().get_queryset()
        return qs.annotate(staff_count=Count("staff_members", distinct=True))

    def success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        return Response(
            {
                "success": True,
                "message": message,
                "data": data if data is not None else {},
            },
            status=status_code,
        )

    def error_response(self, message, status_code, errors=None):
        return Response(
            {
                "success": False,
                "message": message,
                "errors": errors if errors is not None else {},
            },
            status=status_code,
        )

    def get_object(self):
        try:
            return super().get_object()
        except (Http404, ValueError, TypeError, DjangoValidationError):
            raise NotFound("Department not found")

    def handle_exception(self, exc):
        if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            return self.error_response(
                "Authentication credentials were not provided or invalid",
                status.HTTP_401_UNAUTHORIZED,
            )

        if isinstance(exc, PermissionDenied):
            return self.error_response(
                "You do not have permission to perform this action",
                status.HTTP_403_FORBIDDEN,
            )

        if isinstance(exc, NotFound):
            return self.error_response(str(exc.detail), status.HTTP_404_NOT_FOUND)

        if isinstance(exc, ValidationError):
            errors = exc.detail if isinstance(exc.detail, dict) else {}
            message = "Validation failed"
            if isinstance(exc.detail, dict) and exc.detail:
                first_val = next(iter(exc.detail.values()))
                if isinstance(first_val, list) and first_val:
                    message = str(first_val[0])
                elif isinstance(first_val, str):
                    message = first_val
            elif isinstance(exc.detail, list) and exc.detail:
                message = str(exc.detail[0])
            elif isinstance(exc.detail, str):
                message = exc.detail

            return self.error_response(message, status.HTTP_400_BAD_REQUEST, errors=errors)

        return self.error_response("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return self.success_response(
                "Department created successfully",
                serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except IntegrityError:
            raise ValidationError({"name": "Department already exists"})

    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop("partial", False)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return self.success_response("Department updated successfully", serializer.data)
        except IntegrityError:
            raise ValidationError({"name": "Department already exists"})

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        if instance.staff_members.exists():
            raise ValidationError({"department": "Cannot delete department assigned to employees"})
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return self.success_response("Department deleted successfully", data={})


class DepartmentTypeViewSet(SchoolScopedModelViewSet):
    """
    GET  /department-types/       → predefined types + school's custom types
    POST /department-types/       → create a custom type for this school
    DELETE /department-types/{id}/ → delete a custom type
    """

    PREDEFINED_TYPES = ["Academic", "Administrative", "Support", "Transport", "Finance"]

    queryset = DepartmentType.objects.select_related("school").all()
    serializer_class = DepartmentTypeSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    permission_codes = {"*": "human_resource.departments.view"}

    def list(self, request, *args, **kwargs):
        predefined = [{"id": None, "name": t, "is_predefined": True} for t in self.PREDEFINED_TYPES]
        custom_qs = self.get_queryset().order_by("name")
        custom = [
            {"id": obj.id, "name": obj.name, "is_predefined": False, "created_at": obj.created_at}
            for obj in custom_qs
        ]
        return Response({"success": True, "data": predefined + custom})

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return Response(
                {"success": True, "message": "Department type created.", "data": serializer.data},
                status=status.HTTP_201_CREATED,
            )
        except IntegrityError:
            raise ValidationError({"name": ["This department type already exists."]})

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({"success": True, "message": "Department type deleted."}, status=status.HTTP_200_OK)

    def _first_error_message(self, detail):
        """Extract the first human-readable message from a DRF ValidationError detail."""
        if isinstance(detail, dict) and detail:
            first_val = next(iter(detail.values()))
            if isinstance(first_val, list) and first_val:
                return str(first_val[0])
            if isinstance(first_val, str):
                return first_val
        if isinstance(detail, list) and detail:
            return str(detail[0])
        if isinstance(detail, str):
            return detail
        return "Validation failed"

    def handle_exception(self, exc):
        if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            return Response(
                {"success": False, "message": "Authentication required."},
                status=status.HTTP_401_UNAUTHORIZED,
            )
        if isinstance(exc, PermissionDenied):
            return Response(
                {"success": False, "message": "Permission denied."},
                status=status.HTTP_403_FORBIDDEN,
            )
        if isinstance(exc, (NotFound, Http404)):
            return Response(
                {"success": False, "message": "Department type not found."},
                status=status.HTTP_404_NOT_FOUND,
            )
        if isinstance(exc, ValidationError):
            return Response(
                {
                    "success": False,
                    "message": self._first_error_message(exc.detail),
                    "errors": exc.detail if isinstance(exc.detail, dict) else {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        return super().handle_exception(exc)


class DesignationViewSet(SchoolScopedModelViewSet):
    queryset = Designation.objects.select_related("school", "department").all()
    serializer_class = DesignationSerializer
    filterset_fields = ["department", "is_active"]
    search_fields = ["name", "department__name"]
    ordering_fields = ["name", "created_at"]
    permission_codes = {"*": "human_resource.designations.view"}

    def success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        return Response(
            {
                "success": True,
                "message": message,
                "data": data if data is not None else {},
            },
            status=status_code,
        )

    def error_response(self, message, status_code, errors=None):
        return Response(
            {
                "success": False,
                "message": message,
                "errors": errors if errors is not None else {},
            },
            status=status_code,
        )

    def get_object(self):
        try:
            return super().get_object()
        except (Http404, ValueError, TypeError, DjangoValidationError):
            raise NotFound("Designation not found")

    def handle_exception(self, exc):
        if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            return self.error_response(
                "Authentication credentials were not provided or invalid",
                status.HTTP_401_UNAUTHORIZED,
            )

        if isinstance(exc, PermissionDenied):
            return self.error_response(
                "You do not have permission to perform this action",
                status.HTTP_403_FORBIDDEN,
            )

        if isinstance(exc, NotFound):
            return self.error_response(str(exc.detail), status.HTTP_404_NOT_FOUND)

        if isinstance(exc, ValidationError):
            errors = exc.detail if isinstance(exc.detail, dict) else {}
            message = "Validation failed"
            if isinstance(exc.detail, dict) and exc.detail:
                first_val = next(iter(exc.detail.values()))
                if isinstance(first_val, list) and first_val:
                    message = str(first_val[0])
                elif isinstance(first_val, str):
                    message = first_val
            elif isinstance(exc.detail, list) and exc.detail:
                message = str(exc.detail[0])
            elif isinstance(exc.detail, str):
                message = exc.detail

            return self.error_response(message, status.HTTP_400_BAD_REQUEST, errors=errors)

        return self.error_response("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        try:
            department_id = request.data.get("department")
            if department_id and not Department.objects.filter(id=department_id).exists():
                raise NotFound("Department not found")

            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return self.success_response(
                "Designation created successfully",
                serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except IntegrityError:
            raise ValidationError({"name": "Designation already exists in this department"})

    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop("partial", False)
            department_id = request.data.get("department")
            if department_id and not Department.objects.filter(id=department_id).exists():
                raise NotFound("Department not found")

            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return self.success_response("Designation updated successfully", serializer.data)
        except IntegrityError:
            raise ValidationError({"name": "Designation already exists in this department"})

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        # 400 business rule: block deletion if any employee/staff is linked.
        if instance.staff_members.exists():
            raise ValidationError({"designation": "Cannot delete designation assigned to employees"})
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return self.success_response("Designation deleted successfully", data={})


class DesignationReorderView(APIView):
    """POST /api/v1/hr/designations/reorder/
    Body: { "items": [{"id": 1, "sort_order": 0}, {"id": 2, "sort_order": 1}, ...] }
    Updates sort_order for each designation (school-scoped).
    """

    def post(self, request):
        items = request.data.get("items", [])
        if not isinstance(items, list) or not items:
            return Response({"success": False, "message": "items list is required."}, status=status.HTTP_400_BAD_REQUEST)

        school_id = getattr(request.user, "school_id", None)
        updated = 0
        for item in items:
            desig_id = item.get("id")
            new_order = item.get("sort_order")
            if desig_id is None or new_order is None:
                continue
            qs = Designation.objects.filter(id=desig_id)
            if school_id:
                qs = qs.filter(school_id=school_id)
            updated += qs.update(sort_order=new_order)

        return Response({"success": True, "message": f"{updated} designations reordered."})


class StaffViewSet(SchoolScopedModelViewSet):
    queryset = Staff.objects.select_related("school", "user", "role", "department", "designation").all()
    serializer_class = StaffSerializer
    filterset_fields = ["role", "department", "designation", "status", "join_date", "gender", "marital_status", "contract_type"]
    search_fields = ["staff_no", "first_name", "last_name", "email", "phone", "emergency_mobile", "location", "driving_license"]
    ordering_fields = ["first_name", "join_date", "created_at"]
    permission_codes = {
        "*": "human_resource.staff.view",
        "next_staff_no": "human_resource.staff.view",
        "form_options": "human_resource.staff.view",
    }
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        return Response(
            {
                "success": True,
                "message": message,
                "data": data if data is not None else {},
            },
            status=status_code,
        )

    def error_response(self, message, status_code, errors=None):
        return Response(
            {
                "success": False,
                "message": message,
                "errors": errors if errors is not None else {},
            },
            status=status_code,
        )

    def get_object(self):
        try:
            return super().get_object()
        except (Http404, ValueError, TypeError, DjangoValidationError):
            raise NotFound("Staff not found")

    def handle_exception(self, exc):
        if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            return self.error_response(
                "Authentication credentials were not provided or invalid",
                status.HTTP_401_UNAUTHORIZED,
            )

        if isinstance(exc, PermissionDenied):
            return self.error_response(
                "You do not have permission to perform this action",
                status.HTTP_403_FORBIDDEN,
            )

        if isinstance(exc, NotFound):
            return self.error_response(str(exc.detail), status.HTTP_404_NOT_FOUND)

        if isinstance(exc, ValidationError):
            errors = exc.detail if isinstance(exc.detail, dict) else {}
            message = "Validation failed"
            if isinstance(exc.detail, dict) and exc.detail:
                first_val = next(iter(exc.detail.values()))
                if isinstance(first_val, list) and first_val:
                    message = str(first_val[0])
                elif isinstance(first_val, str):
                    message = first_val
            elif isinstance(exc.detail, list) and exc.detail:
                message = str(exc.detail[0])
            elif isinstance(exc.detail, str):
                message = exc.detail

            return self.error_response(message, status.HTTP_400_BAD_REQUEST, errors=errors)

        return self.error_response("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _validate_related_ids(self, request):
        from apps.access_control.models import Role

        school_id = request.user.school_id

        def parse_fk_id(field):
            raw = request.data.get(field)
            if raw in (None, ""):
                return None
            try:
                value = int(raw)
            except (TypeError, ValueError):
                raise ValidationError({field: "Invalid identifier."})
            if value <= 0:
                raise ValidationError({field: "Invalid identifier."})
            return value

        role_id = parse_fk_id("role")
        department_id = parse_fk_id("department")
        designation_id = parse_fk_id("designation")

        role_qs = Role.objects.all()
        dept_qs = Department.objects.all()
        desg_qs = Designation.objects.all()

        if school_id and not request.user.is_superuser:
            role_qs = role_qs.filter(school_id=school_id)
            dept_qs = dept_qs.filter(school_id=school_id)
            desg_qs = desg_qs.filter(school_id=school_id)

        if role_id and not role_qs.filter(id=role_id).exists():
            raise NotFound("Role not found")
        if department_id and not dept_qs.filter(id=department_id).exists():
            raise NotFound("Department not found")
        if designation_id and not desg_qs.filter(id=designation_id).exists():
            raise NotFound("Designation not found")

    def _normalize_staff_request_data(self, request):
        data = {}
        if hasattr(request.data, "keys"):
            for key in request.data.keys():
                if hasattr(request.data, "getlist"):
                    values = request.data.getlist(key)
                    data[key] = values if len(values) > 1 else (values[0] if values else None)
                else:
                    data[key] = request.data.get(key)
        else:
            data = dict(request.data)

        file_name_fields = [
            "resume",
            "joining_letter",
            "tenth_certificate",
            "eleventh_certificate",
            "aadhar_card",
            "driving_license_doc",
        ]

        for field_name in file_name_fields:
            uploaded = request.FILES.get(field_name)
            if uploaded is not None:
                data[field_name] = uploaded.name

        uploaded_staff_photo = request.FILES.get("staff_photo")
        if uploaded_staff_photo is not None:
            data["staff_photo"] = uploaded_staff_photo

        other_docs = []
        if hasattr(request.data, "getlist"):
            for item in request.data.getlist("other_document"):
                item_str = str(item).strip()
                if not item_str:
                    continue
                # Try to parse JSON-stringified arrays (from FormData)
                if item_str.startswith('[') and item_str.endswith(']'):
                    try:
                        parsed = json.loads(item_str)
                        if isinstance(parsed, list):
                            other_docs.extend([str(x).strip() for x in parsed if str(x).strip()])
                            continue
                    except (TypeError, ValueError, json.JSONDecodeError):
                        pass
                other_docs.append(item_str)
        if hasattr(request.FILES, "getlist"):
            other_docs.extend([file_obj.name for file_obj in request.FILES.getlist("other_document") if getattr(file_obj, "name", "")])
        if other_docs:
            data["other_document"] = other_docs
        elif "other_document" in data and isinstance(data.get("other_document"), str):
            value = str(data.get("other_document") or "").strip()
            if value:
                try:
                    parsed_other = json.loads(value)
                    if isinstance(parsed_other, list):
                        data["other_document"] = [str(item).strip() for item in parsed_other if str(item).strip()]
                    else:
                        data["other_document"] = [value]
                except (TypeError, ValueError, json.JSONDecodeError):
                    data["other_document"] = [value]

        custom_field = data.get("custom_field")
        if isinstance(custom_field, str):
            custom_field_text = custom_field.strip()
            if custom_field_text:
                try:
                    parsed_custom = json.loads(custom_field_text)
                    if isinstance(parsed_custom, dict):
                        data["custom_field"] = parsed_custom
                except (TypeError, ValueError, json.JSONDecodeError):
                    pass

        return data

    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop("partial", False)
            self._validate_related_ids(request)
            instance = self.get_object()
            payload = self._normalize_staff_request_data(request)
            serializer = self.get_serializer(instance, data=payload, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return self.success_response("Staff updated successfully", serializer.data)
        except IntegrityError:
            raise ValidationError({"staff_no": "Staff number already exists."})

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="form-options")
    def form_options(self, request):
        from apps.access_control.models import Role

        school_id = request.user.school_id

        role_qs = Role.objects.all().order_by("name")
        dept_qs = Department.objects.filter(is_active=True).order_by("name")
        desg_qs = Designation.objects.filter(is_active=True).order_by("name")

        if school_id and not request.user.is_superuser:
            role_qs = role_qs.filter(school_id=school_id)
            dept_qs = dept_qs.filter(school_id=school_id)
            desg_qs = desg_qs.filter(school_id=school_id)

        return Response(
            {
                "success": True,
                "message": "Staff form options fetched successfully",
                "data": {
                    "roles": list(role_qs.values("id", "name")),
                    "departments": list(dept_qs.values("id", "name", "description", "is_active")),
                    "designations": list(desg_qs.values("id", "name", "department", "is_active")),
                },
            },
            status=status.HTTP_200_OK,
        )

    def get_queryset(self):
        """Return school staff members. Optionally filter by driver role for vehicle dropdown."""
        from apps.access_control.models import Role
        
        queryset = super().get_queryset()
        
        # Only filter by driver role if explicitly requested via query parameter
        drivers_only = self.request.query_params.get('drivers_only', '').lower() == 'true'
        role_param = self.request.query_params.get('role')
        
        if drivers_only and not role_param:
            # Filter to driver role for vehicle dropdown
            try:
                driver_role = Role.objects.filter(name__iexact='driver').first()
                if driver_role:
                    queryset = queryset.filter(role=driver_role)
                else:
                    # If driver role doesn't exist, return empty queryset
                    queryset = queryset.none()
            except Exception:
                queryset = queryset.none()
        
        return queryset.order_by("first_name", "last_name")

    def _generate_username(self, staff):
        """Username = full email address when available (e.g. jane@school.com).
        Falls back to firstname.lastname or staff_no when no email is set."""
        User = get_user_model()

        # Prefer full email as username — clear, memorable, matches what staff expect
        if staff.email and not User.objects.filter(username=staff.email.strip()).exists():
            return staff.email.strip()

        # Fallback: firstname.lastname (for staff with no email)
        base = ""
        if staff.email:
            base = staff.email.split("@", 1)[0]
        if not base:
            name_joined = f"{(staff.first_name or '').strip()}.{(staff.last_name or '').strip()}".strip(".")
            base = name_joined or (staff.staff_no or "staff")

        normalized = re.sub(r"[^a-z0-9._-]+", "", base.lower())
        normalized = normalized.strip("._-") or "staff"

        candidate = normalized
        serial = 1
        while User.objects.filter(username=candidate).exists():
            candidate = f"{normalized}{serial}"
            serial += 1
        return candidate

    def _ensure_staff_user(self, staff):
        User = get_user_model()

        if staff.user_id:
            if staff.role_id:
                UserRole.objects.get_or_create(user_id=staff.user_id, role_id=staff.role_id)
            return

        matched_user = None
        if staff.email:
            # Find user by email; if they already have a different staff profile, don't reuse
            matched_user = User.objects.filter(email__iexact=staff.email).order_by("id").first()
            if matched_user:
                if hasattr(matched_user, "staff_profile") and matched_user.staff_profile.id != staff.id:
                    # Email collision: existing user has a different staff profile
                    raise ValidationError({
                        "email": f"A user account with email {staff.email} is already linked to another staff member."
                    })
                # Reuse this user (either no staff_profile, or it's this staff)

        if not matched_user:
            try:
                username = self._generate_username(staff)
                # Initial password = staff number (admin sees this in the create response)
                initial_password = staff.staff_no or "Staff@123"
                matched_user = User(
                    username=username,
                    first_name=(staff.first_name or "").strip(),
                    last_name=(staff.last_name or "").strip(),
                    email=(staff.email or "").strip(),
                    school_id=staff.school_id,
                    is_active=True,
                    access_status=True,
                    must_change_password=True,
                )
                matched_user.set_password(initial_password)
                matched_user.save()
                self._staff_creds = {"username": username, "password": initial_password}
            except IntegrityError as exc:
                # Likely a race condition or unique constraint violation
                import logging
                logging.getLogger(__name__).warning(
                    "User creation failed for staff %s (email=%s): %s", staff.staff_no, staff.email, exc
                )
                # Try to recover by finding the conflicting user
                if staff.email:
                    matched_user = User.objects.filter(email__iexact=staff.email).order_by("id").first()
                if not matched_user:
                    # Username conflict? Try by username
                    matched_user = User.objects.filter(username=username).order_by("id").first()
                if not matched_user:
                    raise ValidationError({"email": "Unable to create user account. Email or username may already exist."})

        staff.user_id = matched_user.id
        staff.save(update_fields=["user", "updated_at"])

        if staff.role_id:
            UserRole.objects.get_or_create(user_id=matched_user.id, role_id=staff.role_id)

    def _generate_staff_no(self, school):
        latest = (
            Staff.objects.filter(school=school)
            .order_by("-created_at", "-id")
            .values_list("staff_no", flat=True)
            .first()
        )

        candidate_number = 1
        if latest:
            match = re.search(r"(\d+)$", latest)
            if match:
                candidate_number = int(match.group(1)) + 1

        while True:
            candidate = str(candidate_number)
            if not Staff.objects.filter(school=school, staff_no=candidate).exists():
                return candidate
            candidate_number += 1

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")

        self._staff_creds = None
        submitted_staff_no = (serializer.validated_data.get("staff_no") or "").strip()
        staff_no = submitted_staff_no or self._generate_staff_no(school)
        staff = serializer.save(school=school, staff_no=staff_no)
        self._ensure_staff_user(staff)

    def create(self, request, *args, **kwargs):
        try:
            self._validate_related_ids(request)
            payload = self._normalize_staff_request_data(request)
            serializer = self.get_serializer(data=payload)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            headers = self.get_success_headers(serializer.data)
            response_data = dict(serializer.data)
            creds = getattr(self, "_staff_creds", None)
            if creds:
                response_data["credentials"] = creds
            return Response(response_data, status=status.HTTP_201_CREATED, headers=headers)
        except IntegrityError:
            raise ValidationError({"staff_no": "Staff number already exists."})
        except (ValidationError, NotFound, PermissionDenied, NotAuthenticated, AuthenticationFailed):
            raise
        except Exception as exc:
            import logging, traceback
            logging.getLogger(__name__).error(
                "StaffViewSet.create unhandled error: %s\n%s", exc, traceback.format_exc()
            )
            raise

    def perform_update(self, serializer):
        staff = serializer.save()
        self._ensure_staff_user(staff)

    @action(detail=False, methods=["get"], url_path="next-staff-no")
    def next_staff_no(self, request):
        school = request.user.school or getattr(request, "school", None)
        if not school and not request.user.is_superuser:
            raise PermissionDenied("School context is required.")
        return Response({"staff_no": self._generate_staff_no(school)})

    @action(detail=True, methods=["patch"], url_path="set_status")
    def set_status(self, request, pk=None):
        staff = self.get_object()
        new_status = request.data.get("status")
        if not new_status:
            return Response({"message": "status is required."}, status=status.HTTP_400_BAD_REQUEST)
        allowed = {Staff.STATUS_ACTIVE, Staff.STATUS_INACTIVE, Staff.STATUS_TERMINATED}
        if new_status not in allowed:
            return Response(
                {"message": f"Invalid status '{new_status}'. Allowed: {', '.join(sorted(allowed))}."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        staff.status = new_status
        staff.save(update_fields=["status"])
        return Response({"message": f"Staff status updated to '{new_status}'.", "status": new_status})


class StaffDocumentViewSet(SchoolScopedModelViewSet):
    queryset = StaffDocument.objects.select_related("school", "staff").all()
    serializer_class = StaffDocumentSerializer
    filterset_fields = ["staff", "document_type"]
    search_fields = ["file_name", "file_path", "staff__first_name", "staff__last_name", "staff__staff_no"]
    ordering_fields = ["created_at", "updated_at", "file_name"]
    permission_codes = {"*": "human_resource.staff.view"}

    def success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        return Response(
            {
                "success": True,
                "message": message,
                "data": data if data is not None else {},
            },
            status=status_code,
        )

    def error_response(self, message, status_code, errors=None):
        return Response(
            {
                "success": False,
                "message": message,
                "errors": errors if errors is not None else {},
            },
            status=status_code,
        )

    def get_object(self):
        try:
            return super().get_object()
        except (Http404, ValueError, TypeError, DjangoValidationError):
            raise NotFound("Staff document not found")

    def handle_exception(self, exc):
        if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            return self.error_response(
                "Authentication credentials were not provided or invalid",
                status.HTTP_401_UNAUTHORIZED,
            )

        if isinstance(exc, PermissionDenied):
            return self.error_response(
                "You do not have permission to perform this action",
                status.HTTP_403_FORBIDDEN,
            )

        if isinstance(exc, NotFound):
            return self.error_response(str(exc.detail), status.HTTP_404_NOT_FOUND)

        if isinstance(exc, ValidationError):
            errors = exc.detail if isinstance(exc.detail, dict) else {}
            message = "Validation failed"
            if isinstance(exc.detail, dict) and exc.detail:
                first_val = next(iter(exc.detail.values()))
                if isinstance(first_val, list) and first_val:
                    message = str(first_val[0])
                elif isinstance(first_val, str):
                    message = first_val
            elif isinstance(exc.detail, list) and exc.detail:
                message = str(exc.detail[0])
            elif isinstance(exc.detail, str):
                message = exc.detail

            return self.error_response(message, status.HTTP_400_BAD_REQUEST, errors=errors)

        return self.error_response("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return self.success_response(
            "Staff document created successfully",
            serializer.data,
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return self.success_response("Staff document updated successfully", serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class LeaveTypeViewSet(SchoolScopedModelViewSet):
    queryset = LeaveType.objects.select_related("school").all()
    serializer_class = LeaveTypeSerializer
    filterset_fields = ["is_paid", "is_active"]
    search_fields = ["name"]
    ordering_fields = ["name", "created_at"]
    permission_codes = {"*": "human_resource.leave_type.view"}

    def success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        return Response(
            {
                "success": True,
                "message": message,
                "data": data if data is not None else {},
            },
            status=status_code,
        )

    def error_response(self, message, status_code, errors=None):
        return Response(
            {
                "success": False,
                "message": message,
                "errors": errors if errors is not None else {},
            },
            status=status_code,
        )

    def get_object(self):
        try:
            return super().get_object()
        except (Http404, ValueError, TypeError, DjangoValidationError):
            raise NotFound("Leave type not found")

    def handle_exception(self, exc):
        if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            return self.error_response(
                "Authentication credentials were not provided or invalid",
                status.HTTP_401_UNAUTHORIZED,
            )

        if isinstance(exc, PermissionDenied):
            return self.error_response(
                "You do not have permission to perform this action",
                status.HTTP_403_FORBIDDEN,
            )

        if isinstance(exc, NotFound):
            return self.error_response(str(exc.detail), status.HTTP_404_NOT_FOUND)

        if isinstance(exc, ValidationError):
            errors = exc.detail if isinstance(exc.detail, dict) else {}
            message = "Validation failed"
            if isinstance(exc.detail, dict) and exc.detail:
                first_val = next(iter(exc.detail.values()))
                if isinstance(first_val, list) and first_val:
                    message = str(first_val[0])
                elif isinstance(first_val, str):
                    message = first_val
            elif isinstance(exc.detail, list) and exc.detail:
                message = str(exc.detail[0])
            elif isinstance(exc.detail, str):
                message = exc.detail

            return self.error_response(message, status.HTTP_400_BAD_REQUEST, errors=errors)

        return self.error_response("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return self.success_response(
            "Leave type created successfully",
            serializer.data,
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return self.success_response("Leave type updated successfully", serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def perform_destroy(self, instance):
        # Business rule: leave types in use cannot be deleted.
        if instance.leave_defines.exists() or instance.leave_requests.exists():
            raise ValidationError({"leave_type": "Cannot delete leave type because it is assigned to employees."})
        instance.delete()

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return self.success_response("Leave type deleted successfully", data={})


class LeaveDefineViewSet(SchoolScopedModelViewSet):
    queryset = LeaveDefine.objects.select_related("school", "role", "staff", "student", "school_class", "section", "leave_type").all()
    serializer_class = LeaveDefineSerializer
    filterset_fields = ["role", "staff", "student", "school_class", "section", "leave_type"]
    search_fields = [
        "role__name",
        "staff__first_name",
        "staff__last_name",
        "student__first_name",
        "student__last_name",
        "student__admission_no",
        "school_class__name",
        "section__name",
        "leave_type__name",
    ]
    ordering_fields = ["created_at", "days"]
    permission_codes = {"*": "human_resource.leave_define.view"}

    def success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        return Response(
            {
                "success": True,
                "message": message,
                "data": data if data is not None else {},
            },
            status=status_code,
        )

    def error_response(self, message, status_code, errors=None):
        return Response(
            {
                "success": False,
                "message": message,
                "errors": errors if errors is not None else {},
            },
            status=status_code,
        )

    def get_object(self):
        try:
            return super().get_object()
        except (Http404, ValueError, TypeError, DjangoValidationError):
            raise NotFound("Leave define not found")

    def handle_exception(self, exc):
        if isinstance(exc, (NotAuthenticated, AuthenticationFailed)):
            return self.error_response(
                "Authentication credentials were not provided or invalid",
                status.HTTP_401_UNAUTHORIZED,
            )

        if isinstance(exc, PermissionDenied):
            return self.error_response(
                "You do not have permission to perform this action",
                status.HTTP_403_FORBIDDEN,
            )

        if isinstance(exc, NotFound):
            return self.error_response(str(exc.detail), status.HTTP_404_NOT_FOUND)

        if isinstance(exc, ValidationError):
            errors = exc.detail if isinstance(exc.detail, dict) else {}
            message = "Validation failed"
            if isinstance(exc.detail, dict) and exc.detail:
                first_val = next(iter(exc.detail.values()))
                if isinstance(first_val, list) and first_val:
                    message = str(first_val[0])
                elif isinstance(first_val, str):
                    message = first_val
            elif isinstance(exc.detail, list) and exc.detail:
                message = str(exc.detail[0])
            elif isinstance(exc.detail, str):
                message = exc.detail

            return self.error_response(message, status.HTTP_400_BAD_REQUEST, errors=errors)

        return self.error_response("Internal server error", status.HTTP_500_INTERNAL_SERVER_ERROR)

    def _validate_related_ids(self, request):
        from apps.access_control.models import Role

        school_id = request.user.school_id

        def parse_fk_id(field):
            raw = request.data.get(field)
            if raw in (None, ""):
                return None
            try:
                value = int(raw)
            except (TypeError, ValueError):
                raise ValidationError({field: "Invalid identifier."})
            if value <= 0:
                raise ValidationError({field: "Invalid identifier."})
            return value

        role_id = parse_fk_id("role")
        staff_id = parse_fk_id("staff")
        student_id = parse_fk_id("student")
        class_id = parse_fk_id("school_class")
        section_id = parse_fk_id("section")
        leave_type_id = parse_fk_id("leave_type")

        role_qs = Role.objects.all()
        staff_qs = Staff.objects.all()
        student_qs = Student.objects.all()
        class_qs = SchoolClass.objects.all()
        section_qs = Section.objects.select_related("school_class")
        leave_type_qs = LeaveType.objects.all()

        if school_id and not request.user.is_superuser:
            role_qs = role_qs.filter(school_id=school_id)
            staff_qs = staff_qs.filter(school_id=school_id)
            student_qs = student_qs.filter(school_id=school_id)
            class_qs = class_qs.filter(school_id=school_id)
            section_qs = section_qs.filter(school_class__school_id=school_id)
            leave_type_qs = leave_type_qs.filter(school_id=school_id)

        if role_id and not role_qs.filter(id=role_id).exists():
            raise NotFound("Role not found")
        if staff_id and not staff_qs.filter(id=staff_id).exists():
            raise NotFound("Staff not found")
        if student_id and not student_qs.filter(id=student_id).exists():
            raise NotFound("Student not found")
        if class_id and not class_qs.filter(id=class_id).exists():
            raise NotFound("Class not found")
        if section_id and not section_qs.filter(id=section_id).exists():
            raise NotFound("Section not found")
        if class_id and section_id and not section_qs.filter(id=section_id, school_class_id=class_id).exists():
            raise ValidationError({"section": "Selected section does not belong to selected class."})
        if leave_type_id and not leave_type_qs.filter(id=leave_type_id).exists():
            raise NotFound("Leave type not found")

    def create(self, request, *args, **kwargs):
        self._validate_related_ids(request)
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        self.perform_create(serializer)
        return self.success_response(
            "Leave defined successfully",
            serializer.data,
            status_code=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        self._validate_related_ids(request)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return self.success_response("Leave define updated successfully", serializer.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return self.success_response("Leave define deleted successfully", data={})


class LeaveRequestViewSet(SchoolScopedModelViewSet):
    queryset = LeaveRequest.objects.select_related("school", "staff", "leave_type", "approved_by").all()
    serializer_class = LeaveRequestSerializer
    filterset_fields = ["staff", "leave_type", "status", "from_date", "to_date"]
    search_fields = ["staff__staff_no", "staff__first_name", "staff__last_name", "reason"]
    ordering_fields = ["created_at", "from_date", "to_date"]
    permission_codes = {
        "*": "human_resource.apply_leave.view",
        "approve": "human_resource.apply_leave.view",
        "reject": "human_resource.apply_leave.view",
    }

    def _current_staff(self):
        user = self.request.user

        queryset = Staff.objects.all()
        if user.school_id:
            queryset = queryset.filter(school_id=user.school_id)

        # Primary mapping: explicit one-to-one user link.
        staff = queryset.filter(user_id=user.id).first()
        if staff:
            return staff

        # Migration fallback: some legacy staff rows were imported without user_id.
        # Try to resolve by email and backfill the user link when safe.
        if user.email:
            email_staff = queryset.filter(user__isnull=True, email__iexact=user.email).first()
            if email_staff:
                if not hasattr(user, "staff_profile"):
                    email_staff.user = user
                    email_staff.save(update_fields=["user", "updated_at"])
                return email_staff

        return None

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user

        if user.is_superuser or user.is_school_admin:
            return queryset

        current_staff = self._current_staff()
        if current_staff:
            return queryset.filter(staff_id=current_staff.id)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")

        current_staff = self._current_staff()
        requested_staff = serializer.validated_data.get("staff")

        if user.is_superuser or user.is_school_admin:
            staff = requested_staff or current_staff
        else:
            if requested_staff and current_staff and requested_staff.id != current_staff.id:
                raise ValidationError({"staff": "You can only apply leave for your own profile."})
            staff = current_staff

        if not staff:
            raise ValidationError(
                {"staff": "Staff profile is not linked with this user. Please contact admin to map your staff account."}
            )

        if not user.is_superuser and user.school_id and staff.school_id != user.school_id:
            raise ValidationError({"staff": "Selected staff member does not belong to your school."})

        serializer.save(school=school, staff=staff)

    def perform_update(self, serializer):
        current_staff = self._current_staff()
        if current_staff and not self.request.user.is_superuser:
            serializer.save(staff=current_staff)
            return
        serializer.save()

    @action(detail=True, methods=["post"], url_path="approve")
    def approve(self, request, pk=None):
        leave_request = self.get_object()
        if leave_request.status != LeaveRequest.STATUS_PENDING:
            raise ValidationError("Only pending leave requests can be approved.")

        leave_request.status = LeaveRequest.STATUS_APPROVED
        leave_request.approval_note = (request.data.get("approval_note") or "").strip()
        leave_request.approved_by = request.user
        leave_request.approved_at = timezone.now()
        leave_request.save(update_fields=["status", "approval_note", "approved_by", "approved_at", "updated_at"])
        return Response({"id": leave_request.id, "status": leave_request.status})

    @action(detail=True, methods=["post"], url_path="reject")
    def reject(self, request, pk=None):
        leave_request = self.get_object()
        if leave_request.status != LeaveRequest.STATUS_PENDING:
            raise ValidationError("Only pending leave requests can be rejected.")

        leave_request.status = LeaveRequest.STATUS_REJECTED
        leave_request.approval_note = (request.data.get("approval_note") or "").strip()
        leave_request.approved_by = request.user
        leave_request.approved_at = timezone.now()
        leave_request.save(update_fields=["status", "approval_note", "approved_by", "approved_at", "updated_at"])
        return Response({"id": leave_request.id, "status": leave_request.status})


class StaffAttendanceViewSet(SchoolScopedModelViewSet):
    queryset = StaffAttendance.objects.select_related(
        "school", "staff", "staff__department", "staff__designation"
    ).all()
    serializer_class = StaffAttendanceSerializer
    filterset_fields = ["staff", "attendance_date", "attendance_type", "staff__department"]
    search_fields = ["staff__staff_no", "staff__first_name", "staff__last_name", "note"]
    ordering_fields = ["attendance_date", "created_at"]
    permission_codes = {
        "*": "human_resource.staff_attendance.view",
        "bulk_store": "human_resource.staff_attendance.view",
        "report": "human_resource.staff_attendance.view",
        "daily_summary": "human_resource.staff_attendance.view",
        "monthly_report": "human_resource.staff_attendance.view",
    }

    @action(detail=False, methods=["post"], url_path="bulk-store")
    def bulk_store(self, request):
        rows = request.data.get("rows", [])
        if not isinstance(rows, list) or len(rows) == 0:
            raise ValidationError("rows must be a non-empty list.")

        school = request.user.school or getattr(request, "school", None)
        if not school and not request.user.is_superuser:
            raise PermissionDenied("School context is required.")

        created_or_updated = 0
        for row in rows:
            serializer = self.get_serializer(data=row)
            serializer.is_valid(raise_exception=True)
            validated = serializer.validated_data

            StaffAttendance.objects.update_or_create(
                school=school,
                staff=validated["staff"],
                attendance_date=validated["attendance_date"],
                defaults={
                    "attendance_type": validated.get("attendance_type", StaffAttendance.STATUS_PRESENT),
                    "note": validated.get("note", ""),
                    "arrival_time": validated.get("arrival_time"),
                    "sign_in_time": validated.get("sign_in_time"),
                    "sign_out_time": validated.get("sign_out_time"),
                    "lunch": validated.get("lunch", False),
                },
            )
            created_or_updated += 1

        return Response({"detail": "Attendance saved.", "count": created_or_updated})

    @action(detail=False, methods=["get"], url_path="report")
    def report(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        total = queryset.count()
        by_type = {}
        for code, _label in StaffAttendance.STATUS_CHOICES:
            by_type[code] = queryset.filter(attendance_type=code).count()

        return Response({"total": total, "by_type": by_type})

    def _active_staff_qs(self, request, department=None):
        """Active staff in the requesting user's school, optionally filtered by department."""
        staff_qs = Staff.objects.filter(status="active")
        if not request.user.is_superuser and request.user.school_id:
            staff_qs = staff_qs.filter(school_id=request.user.school_id)
        if department:
            staff_qs = staff_qs.filter(department_id=department)
        return staff_qs

    @action(detail=False, methods=["get"], url_path="daily-summary")
    def daily_summary(self, request):
        """KPI counts for a single date: total active staff + per-status tallies."""
        date = request.query_params.get("date") or request.query_params.get("attendance_date")
        if not date:
            raise ValidationError("date is required (YYYY-MM-DD).")
        department = request.query_params.get("department")

        total_staff = self._active_staff_qs(request, department).count()

        records = self.get_queryset().filter(attendance_date=date)
        if department:
            records = records.filter(staff__department_id=department)

        counts = {code: records.filter(attendance_type=code).count() for code, _ in StaffAttendance.STATUS_CHOICES}
        present = counts["P"]
        late_arrivals = records.exclude(arrival_time__isnull=True).count()

        return Response({
            "total_staff": total_staff,
            "present": present,
            "absent": counts["A"],
            "leave": counts["L"],
            "half_day": counts["F"],
            "holiday": counts["H"],
            "late_arrivals": late_arrivals,
            "marked": records.count(),
            "present_pct": round((present / total_staff) * 100) if total_staff else 0,
        })

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        date_str = request.query_params.get("date") or request.query_params.get("attendance_date")
        if not date_str:
            raise ValidationError("date is required (YYYY-MM-DD).")
        export_format = request.query_params.get("format", "excel").lower()
        department = request.query_params.get("department")
        attendance_type = request.query_params.get("attendance_type")

        from apps.reports.export_utils import build_export_response

        qs = self.get_queryset().filter(attendance_date=date_str)
        if department:
            qs = qs.filter(staff__department_id=department)
        if attendance_type:
            qs = qs.filter(attendance_type=attendance_type)

        rows = []
        status_map = dict(StaffAttendance.STATUS_CHOICES)
        for rec in qs:
            rows.append({
                "staff_no": rec.staff.staff_no or "",
                "name": f"{rec.staff.first_name} {rec.staff.last_name}".strip(),
                "department": rec.staff.department.name if rec.staff.department else "",
                "status": status_map.get(rec.attendance_type, rec.attendance_type),
                "sign_in": rec.sign_in_time.strftime("%H:%M") if rec.sign_in_time else "",
                "sign_out": rec.sign_out_time.strftime("%H:%M") if rec.sign_out_time else "",
                "note": rec.note or "",
            })

        columns = [
            ("Staff ID", "staff_no"),
            ("Name", "name"),
            ("Department", "department"),
            ("Status", "status"),
            ("Sign In", "sign_in"),
            ("Sign Out", "sign_out"),
            ("Note", "note"),
        ]

        return build_export_response(
            export_format=export_format,
            rows=rows,
            columns=columns,
            filename=f"staff_attendance_{date_str}",
            title=f"Staff Attendance ({date_str})",
        )

    @action(detail=False, methods=["get"], url_path="monthly-report")
    def monthly_report(self, request):
        """
        Monthly report payload consumed by the staff MonthlyReport UI:
          { records, rows, insights }
        - records: one entry per attendance row in the month (for the week donut cards)
        - rows: per-staff present/absent/leave/half_day/holiday totals
        - insights: top absent + leave reasons mined from notes
        """
        try:
            month = int(request.query_params.get("month"))
            year = int(request.query_params.get("year"))
        except (TypeError, ValueError):
            raise ValidationError("month and year are required integers.")
        department = request.query_params.get("department")
        staff_id = request.query_params.get("staff")

        qs = self.get_queryset().filter(
            attendance_date__month=month, attendance_date__year=year
        )
        if department:
            qs = qs.filter(staff__department_id=department)
        if staff_id:
            qs = qs.filter(staff_id=staff_id)

        records = []
        per_staff = {}
        absent_reasons = {}
        leave_reasons = {}

        for rec in qs:
            records.append({
                "staff": rec.staff_id,
                "attendance_date": rec.attendance_date.isoformat(),
                "attendance_type": rec.attendance_type,
            })

            bucket = per_staff.setdefault(rec.staff_id, {
                "staff_id": rec.staff_id,
                "name": f"{(rec.staff.first_name or '').strip()} {(rec.staff.last_name or '').strip()}".strip(),
                "staff_no": rec.staff.staff_no or "",
                "department_name": rec.staff.department.name if rec.staff.department_id else "",
                "present": 0, "absent": 0, "leave": 0, "half_day": 0, "holiday": 0,
            })
            key = {"P": "present", "A": "absent", "L": "leave", "F": "half_day", "H": "holiday"}.get(rec.attendance_type)
            if key:
                bucket[key] += 1

            note = (rec.note or "").strip()
            if note:
                if rec.attendance_type == "A":
                    absent_reasons[note] = absent_reasons.get(note, 0) + 1
                elif rec.attendance_type == "L":
                    leave_reasons[note] = leave_reasons.get(note, 0) + 1

        def top(reasons):
            return [
                {"reason": r, "count": c}
                for r, c in sorted(reasons.items(), key=lambda kv: kv[1], reverse=True)[:5]
            ]

        return Response({
            "records": records,
            "rows": sorted(per_staff.values(), key=lambda r: r["name"].lower()),
            "insights": {
                "top_absent_reasons": top(absent_reasons),
                "top_leave_reasons": top(leave_reasons),
            },
        })


class PayrollRecordViewSet(SchoolScopedModelViewSet):
    queryset = PayrollRecord.objects.select_related("school", "staff", "created_by").all()
    serializer_class = PayrollRecordSerializer
    filterset_fields = ["staff", "payroll_month", "payroll_year", "status"]
    search_fields = ["staff__staff_no", "staff__first_name", "staff__last_name"]
    ordering_fields = ["payroll_year", "payroll_month", "created_at", "net_salary"]
    permission_codes = {
        "*": "human_resource.payroll.view",
        "summary": "human_resource.payroll.view",
        "settings": "human_resource.payroll.view",
        "mark_processed": "human_resource.payroll.view",
        "mark_paid": "human_resource.payroll.view",
        "bulk_generate": "human_resource.payroll.view",
    }

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school, created_by=user)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        total_basic = queryset.aggregate(total=Coalesce(Sum("basic_salary"), Decimal("0.00"))).get("total")
        total_allowance = queryset.aggregate(total=Coalesce(Sum("allowance"), Decimal("0.00"))).get("total")
        total_deduction = queryset.aggregate(total=Coalesce(Sum("deduction"), Decimal("0.00"))).get("total")
        total_net = queryset.aggregate(total=Coalesce(Sum("net_salary"), Decimal("0.00"))).get("total")

        return Response(
            {
                "total_records": queryset.count(),
                "total_basic_salary": str(total_basic),
                "total_allowance": str(total_allowance),
                "total_deduction": str(total_deduction),
                "total_net_salary": str(total_net),
            }
        )

    @action(detail=False, methods=["get", "patch"], url_path="settings")
    def payroll_settings(self, request):
        school = request.user.school or getattr(request, "school", None)
        if not school and not request.user.is_superuser:
            raise PermissionDenied("School context is required.")

        settings_obj, _created = PayrollSettings.objects.get_or_create(school=school)

        if request.method.lower() == "get":
            serializer = PayrollSettingsSerializer(settings_obj)
            return Response(serializer.data)

        serializer = PayrollSettingsSerializer(settings_obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="bulk-generate")
    def bulk_generate(self, request):
        user = request.user
        school = user.school or getattr(request, "school", None)
        if not school:
            raise PermissionDenied("School context is required.")

        try:
            payroll_month = int(request.data.get("payroll_month"))
            payroll_year = int(request.data.get("payroll_year"))
        except (TypeError, ValueError):
            raise ValidationError({"payroll_month": "Month and year are required."})

        if payroll_month < 1 or payroll_month > 12:
            raise ValidationError({"payroll_month": "Month must be between 1 and 12."})
        if payroll_year < 2000 or payroll_year > 2100:
            raise ValidationError({"payroll_year": "Year must be between 2000 and 2100."})

        try:
            allowance = Decimal(str(request.data.get("allowance", "0.00") or "0.00"))
            deduction = Decimal(str(request.data.get("deduction", "0.00") or "0.00"))
        except Exception:
            raise ValidationError({"allowance": "Allowance and deduction must be valid numbers."})

        if allowance < 0 or deduction < 0:
            raise ValidationError({"deduction": "Allowance and deduction cannot be negative."})

        overwrite_existing = str(request.data.get("overwrite_existing", "false")).lower() in ["1", "true", "yes"]
        staff_ids = request.data.get("staff_ids")

        staff_queryset = Staff.objects.filter(status=Staff.STATUS_ACTIVE)
        if school:
            staff_queryset = staff_queryset.filter(school=school)
        if isinstance(staff_ids, list) and staff_ids:
            staff_queryset = staff_queryset.filter(id__in=staff_ids)

        staff_list = list(staff_queryset)
        if not staff_list:
            return Response(
                {
                    "detail": "No active staff found for bulk generation.",
                    "created_count": 0,
                    "updated_count": 0,
                    "skipped_existing": 0,
                    "skipped_paid": 0,
                    "skipped_invalid": 0,
                    "total_staff": 0,
                }
            )

        created_count = 0
        updated_count = 0
        skipped_existing = 0
        skipped_paid = 0
        skipped_invalid = 0

        for staff in staff_list:
            basic_salary = staff.basic_salary or Decimal("0.00")
            net_salary = basic_salary + allowance - deduction
            if net_salary < 0:
                skipped_invalid += 1
                continue

            existing = PayrollRecord.objects.filter(
                school=school,
                staff=staff,
                payroll_month=payroll_month,
                payroll_year=payroll_year,
            ).first()

            if existing:
                if not overwrite_existing:
                    skipped_existing += 1
                    continue
                if existing.status == PayrollRecord.STATUS_PAID:
                    skipped_paid += 1
                    continue

                existing.basic_salary = basic_salary
                existing.allowance = allowance
                existing.deduction = deduction
                existing.save(update_fields=["basic_salary", "allowance", "deduction", "net_salary", "updated_at"])
                updated_count += 1
                continue

            try:
                PayrollRecord.objects.create(
                    school=school,
                    staff=staff,
                    payroll_month=payroll_month,
                    payroll_year=payroll_year,
                    basic_salary=basic_salary,
                    allowance=allowance,
                    deduction=deduction,
                    created_by=user,
                )
                created_count += 1
            except IntegrityError:
                skipped_existing += 1

        return Response(
            {
                "detail": "Bulk payroll generation completed.",
                "created_count": created_count,
                "updated_count": updated_count,
                "skipped_existing": skipped_existing,
                "skipped_paid": skipped_paid,
                "skipped_invalid": skipped_invalid,
                "total_staff": len(staff_list),
            }
        )

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        payroll = self.get_object()
        if payroll.status == PayrollRecord.STATUS_PAID:
            return Response({"id": payroll.id, "status": payroll.status, "paid_at": payroll.paid_at})

        if payroll.status != PayrollRecord.STATUS_PROCESSED:
            raise ValidationError({"status": "Payroll must be approved before marking as paid."})

        payroll.status = PayrollRecord.STATUS_PAID
        payroll.paid_at = timezone.now()
        payroll.save(update_fields=["status", "paid_at", "updated_at"])
        return Response({"id": payroll.id, "status": payroll.status, "paid_at": payroll.paid_at})

    @action(detail=True, methods=["post"], url_path="mark-processed")
    def mark_processed(self, request, pk=None):
        payroll = self.get_object()
        if payroll.status == PayrollRecord.STATUS_PROCESSED:
            return Response({"id": payroll.id, "status": payroll.status, "paid_at": payroll.paid_at})
        if payroll.status == PayrollRecord.STATUS_PAID:
            raise ValidationError({"status": "Paid payroll cannot be moved back to approved."})

        payroll.status = PayrollRecord.STATUS_PROCESSED
        payroll.save(update_fields=["status", "updated_at"])
        return Response({"id": payroll.id, "status": payroll.status, "paid_at": payroll.paid_at})


# ─────────────────────────────────────────────────────────────────────────────
# Offboarding
# ─────────────────────────────────────────────────────────────────────────────

class OffboardingViewSet(SchoolScopedModelViewSet):
    serializer_class = OffboardingSerializer
    permission_codes = {"*": "human_resource.staff.view"}
    filterset_fields = ["status", "exit_type", "staff__department"]
    search_fields = ["staff__first_name", "staff__last_name", "staff__staff_no", "exit_reason"]
    ordering_fields = ["created_at", "last_working_day", "status"]

    def get_queryset(self):
        return Offboarding.objects.select_related(
            "school", "staff", "staff__department", "staff__designation"
        ).filter(school=self.request.user.school)

    def perform_create(self, serializer):
        serializer.save(school=self.request.user.school)

    @action(detail=True, methods=["patch"], url_path="complete")
    def complete(self, request, pk=None):
        record = self.get_object()
        if record.status == Offboarding.STATUS_COMPLETED:
            return Response({"message": "Offboarding record is already completed."}, status=status.HTTP_400_BAD_REQUEST)
        record.status = Offboarding.STATUS_COMPLETED
        record.completed_at = timezone.now()
        record.save(update_fields=["status", "completed_at"])
        return Response(OffboardingSerializer(record).data)


# ─────────────────────────────────────────────────────────────────────────────
# Staff Onboarding Wizard — Temporary Document Endpoints
# ─────────────────────────────────────────────────────────────────────────────

_ALLOWED_CONTENT_TYPES = {"application/pdf", "image/jpeg", "image/png", "image/jpg"}
_MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


class StaffOnboardDocumentListView(APIView):
    """GET /api/v1/hr/onboard/documents/ — list all onboard docs for the current user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        qs = StaffOnboardDocument.objects.filter(uploaded_by=request.user).order_by("doc_key")
        serializer = StaffOnboardDocumentSerializer(qs, many=True)
        return Response({"success": True, "data": serializer.data})


class StaffOnboardDocumentUploadView(APIView):
    """POST /api/v1/hr/onboard/documents/upload/ — upload (or replace) a document."""

    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def post(self, request):
        file = request.FILES.get("file")
        doc_key = str(request.data.get("doc_key") or "").strip()
        doc_label = str(request.data.get("doc_label") or "").strip()

        if not file:
            return Response({"success": False, "message": "No file provided."}, status=status.HTTP_400_BAD_REQUEST)
        if not doc_key:
            return Response({"success": False, "message": "doc_key is required."}, status=status.HTTP_400_BAD_REQUEST)
        if not doc_label:
            doc_label = doc_key.replace("_", " ").title()

        # Validate file size
        if file.size > _MAX_UPLOAD_BYTES:
            return Response(
                {"success": False, "message": "File size must be 5 MB or less."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validate content type
        content_type = file.content_type or ""
        if content_type not in _ALLOWED_CONTENT_TYPES:
            return Response(
                {"success": False, "message": "Only PDF, JPEG, and PNG files are allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school = getattr(request.user, "school", None)

        # Delete previous upload for the same (user, doc_key) if exists
        StaffOnboardDocument.objects.filter(uploaded_by=request.user, doc_key=doc_key).delete()

        doc = StaffOnboardDocument.objects.create(
            uploaded_by=request.user,
            school=school,
            doc_key=doc_key,
            doc_label=doc_label,
            file=file,
            file_name=file.name or "document",
            file_size=file.size,
            content_type=content_type,
        )
        serializer = StaffOnboardDocumentSerializer(doc)
        return Response({"success": True, "data": serializer.data}, status=status.HTTP_201_CREATED)


class StaffOnboardDocumentPreviewView(APIView):
    """GET /api/v1/hr/onboard/documents/{pk}/preview/ — serve the document file."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk=None):
        try:
            doc = StaffOnboardDocument.objects.get(pk=pk, uploaded_by=request.user)
        except StaffOnboardDocument.DoesNotExist:
            return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        from django.http import FileResponse
        try:
            return FileResponse(doc.file.open("rb"), content_type=doc.content_type, as_attachment=False)
        except Exception:
            return Response({"success": False, "message": "File not available."}, status=status.HTTP_404_NOT_FOUND)


class StaffOnboardDocumentDeleteView(APIView):
    """DELETE /api/v1/hr/onboard/documents/{pk}/ — delete an onboard document."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk=None):
        try:
            doc = StaffOnboardDocument.objects.get(pk=pk, uploaded_by=request.user)
        except StaffOnboardDocument.DoesNotExist:
            return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        doc.file.delete(save=False)  # remove from storage
        doc.delete()
        return Response({"success": True, "message": "Document deleted."}, status=status.HTTP_200_OK)


class StaffOnboardDocumentStatusView(APIView):
    """PATCH /api/v1/hr/onboard/documents/{pk}/status/ — update document status."""

    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk=None):
        try:
            doc = StaffOnboardDocument.objects.get(pk=pk, uploaded_by=request.user)
        except StaffOnboardDocument.DoesNotExist:
            return Response({"success": False, "message": "Document not found."}, status=status.HTTP_404_NOT_FOUND)

        new_status = str(request.data.get("status") or "").strip()
        allowed = {s[0] for s in StaffOnboardDocument._meta.get_field("status").choices}
        if new_status not in allowed:
            return Response({"success": False, "message": f"Invalid status. Allowed: {allowed}."}, status=status.HTTP_400_BAD_REQUEST)

        doc.status = new_status
        doc.save(update_fields=["status", "updated_at"])
        return Response({"success": True, "data": StaffOnboardDocumentSerializer(doc).data})


# ── Onboarding draft endpoints ────────────────────────────────────────────────

class StaffOnboardDraftListView(APIView):
    """GET /api/v1/hr/onboard/drafts/ — list all drafts for the current user."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        drafts = StaffOnboardDraft.objects.filter(created_by=request.user).order_by("-updated_at")
        serializer = StaffOnboardDraftSerializer(drafts, many=True)
        return Response({"count": len(serializer.data), "results": serializer.data})


class StaffOnboardDraftSaveView(APIView):
    """POST /api/v1/hr/onboard/drafts/save/

    Body (JSON):
      {
        "id": <int|null>,       # null → create, int → update existing
        "form_data": {...},     # partial form state (text fields only)
        "current_step": <1-10>
      }

    Validations:
      - form_data must be a JSON object (dict)
      - current_step must be 1–10
      - first_name in form_data must be non-empty (so the draft has a meaningful name)
      - At most MAX_DRAFTS_PER_USER drafts per user (enforced on create)
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user = request.user

        raw_id = request.data.get("id")
        form_data = request.data.get("form_data")
        raw_step = request.data.get("current_step", 1)

        # ── Validate form_data ──────────────────────────────────────────────
        if not isinstance(form_data, dict):
            return Response(
                {"error": "form_data must be a JSON object."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_name = str(form_data.get("first_name") or "").strip()
        if not first_name:
            return Response(
                {"error": "Please enter at least the staff member's first name before saving a draft."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Validate current_step ───────────────────────────────────────────
        try:
            current_step = int(raw_step)
        except (TypeError, ValueError):
            current_step = 1
        if not (1 <= current_step <= 10):
            return Response(
                {"error": "current_step must be between 1 and 10."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Derive a human-readable name ────────────────────────────────────
        last_name = str(form_data.get("last_name") or "").strip()
        draft_name = " ".join(filter(None, [first_name, last_name]))

        school = getattr(user, "school", None)

        # ── Create or update ────────────────────────────────────────────────
        if raw_id:
            try:
                draft_id = int(raw_id)
            except (TypeError, ValueError):
                return Response({"error": "Invalid draft id."}, status=status.HTTP_400_BAD_REQUEST)

            try:
                draft = StaffOnboardDraft.objects.get(id=draft_id, created_by=user)
            except StaffOnboardDraft.DoesNotExist:
                return Response({"error": "Draft not found."}, status=status.HTTP_404_NOT_FOUND)

            draft.draft_name = draft_name
            draft.form_data = form_data
            draft.current_step = current_step
            draft.save(update_fields=["draft_name", "form_data", "current_step", "updated_at"])
        else:
            count = StaffOnboardDraft.objects.filter(created_by=user).count()
            if count >= StaffOnboardDraft.MAX_DRAFTS_PER_USER:
                return Response(
                    {
                        "error": (
                            f"You have reached the maximum of {StaffOnboardDraft.MAX_DRAFTS_PER_USER} saved drafts. "
                            "Please delete an old draft before saving a new one."
                        )
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            draft = StaffOnboardDraft.objects.create(
                created_by=user,
                school=school,
                draft_name=draft_name,
                form_data=form_data,
                current_step=current_step,
            )

        return Response(StaffOnboardDraftSerializer(draft).data, status=status.HTTP_200_OK)


class StaffOnboardDraftDeleteView(APIView):
    """DELETE /api/v1/hr/onboard/drafts/{pk}/ — delete a draft owned by the current user."""

    permission_classes = [permissions.IsAuthenticated]

    def delete(self, request, pk=None):
        try:
            draft = StaffOnboardDraft.objects.get(pk=pk, created_by=request.user)
        except StaffOnboardDraft.DoesNotExist:
            return Response({"error": "Draft not found."}, status=status.HTTP_404_NOT_FOUND)
        draft.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


# ── Blank onboarding form PDF ─────────────────────────────────────────────────

class StaffOnboardBlankFormView(APIView):
    """GET /api/v1/hr/onboard/blank-form/

    Generates and streams a blank staff onboarding form as a PDF.

    Query params (all optional):
      format=pdf  (default) — returns application/pdf
      copies=1    — how many copies to embed (1–5)

    Validations:
      - User must be authenticated.
      - `copies` must be an integer between 1 and 5.
    """

    permission_classes = [permissions.IsAuthenticated]

    # Maximum printable copies allowed in one request
    _MAX_COPIES = 5

    def get(self, request):
        # ── Validate `copies` param ────────────────────────────────────────
        raw_copies = request.query_params.get("copies", "1")
        try:
            copies = int(raw_copies)
        except (TypeError, ValueError):
            return Response(
                {"error": "`copies` must be an integer between 1 and 5."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not (1 <= copies <= self._MAX_COPIES):
            return Response(
                {"error": f"`copies` must be between 1 and {self._MAX_COPIES}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Build PDF ──────────────────────────────────────────────────────
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
            from reportlab.lib.units import mm
            from reportlab.platypus import (
                HRFlowable, PageBreak, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
            )
            from reportlab.platypus.flowables import Flowable
            from io import BytesIO
        except ImportError:
            return Response(
                {"error": "PDF generation library is not available. Contact support."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        BRAND    = colors.HexColor("#4729F4")
        LIGHT    = colors.HexColor("#F8FAFC")
        BORDER   = colors.HexColor("#E8E8F0")
        MUTED    = colors.HexColor("#94A3B8")
        INK      = colors.HexColor("#15172A")
        REQUIRED = colors.HexColor("#EF4444")

        PAGE_W, PAGE_H = A4
        L_MARGIN = R_MARGIN = 18 * mm
        INNER_W = PAGE_W - L_MARGIN - R_MARGIN

        styles = getSampleStyleSheet()

        title_style  = ParagraphStyle("FormTitle",  fontName="Helvetica-Bold",   fontSize=16, textColor=INK,   spaceAfter=2)
        sub_style    = ParagraphStyle("FormSub",    fontName="Helvetica",         fontSize=8,  textColor=MUTED,  spaceAfter=6)
        section_style= ParagraphStyle("Section",    fontName="Helvetica-Bold",   fontSize=9,  textColor=BRAND,  spaceBefore=10, spaceAfter=4)
        label_style  = ParagraphStyle("Label",      fontName="Helvetica-Bold",   fontSize=7.5,textColor=INK)
        hint_style   = ParagraphStyle("Hint",       fontName="Helvetica-Oblique",fontSize=6.5,textColor=MUTED)
        note_style   = ParagraphStyle("Note",       fontName="Helvetica",         fontSize=7,  textColor=MUTED, spaceAfter=2)
        footer_style = ParagraphStyle("Footer",     fontName="Helvetica",         fontSize=6.5,textColor=MUTED, alignment=1)

        # ── Helpers ────────────────────────────────────────────────────────
        def _line(label: str, required: bool = False, hint: str = "") -> list:
            """Returns a 2-row pair: label + underline."""
            req_mark = '<font color="#EF4444"> *</font>' if required else ""
            lbl = Paragraph(f"{label}{req_mark}", label_style)
            rows = [[lbl, ""]]
            t = Table(rows, colWidths=[INNER_W * 0.3, INNER_W * 0.7])
            t.setStyle(TableStyle([
                ("VALIGN",      (0, 0), (-1, -1), "BOTTOM"),
                ("LINEBELOW",   (1, 0), (1, 0), 0.5, colors.HexColor("#CBD5E1")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING",  (0, 0), (-1, -1), 5),
            ]))
            result = [t]
            if hint:
                result.append(Paragraph(hint, hint_style))
            return result

        def _two_col(*pairs) -> list:
            """Lays out up to 4 label/required pairs in two side-by-side columns."""
            col = INNER_W / 2 - 3 * mm
            rows = []
            it = iter(pairs)
            for left in it:
                right = next(it, None)
                left_label, left_req = left
                right_cell = ""
                if right:
                    right_label, right_req = right
                    req_r = '<font color="#EF4444"> *</font>' if right_req else ""
                    right_cell = Paragraph(f"{right_label}{req_r}", label_style)
                req_l = '<font color="#EF4444"> *</font>' if left_req else ""
                left_cell = Paragraph(f"{left_label}{req_l}", label_style)
                t = Table([[left_cell, "", right_cell, ""]], colWidths=[col * 0.38, col * 0.62, col * 0.38, col * 0.62])
                t.setStyle(TableStyle([
                    ("VALIGN",       (0, 0), (-1, -1), "BOTTOM"),
                    ("LINEBELOW",    (1, 0), (1, 0), 0.5, colors.HexColor("#CBD5E1")),
                    ("LINEBELOW",    (3, 0), (3, 0), 0.5, colors.HexColor("#CBD5E1")),
                    ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
                    ("TOPPADDING",   (0, 0), (-1, -1), 5),
                ]))
                rows.append(t)
            return rows

        def _three_col(*triples) -> list:
            col = INNER_W / 3 - 2 * mm
            result = []
            it = iter(triples)
            for grp in zip(*[iter(triples)] * 3):
                cells = []
                for label, req in grp:
                    req_mark = '<font color="#EF4444"> *</font>' if req else ""
                    cells += [Paragraph(f"{label}{req_mark}", label_style), ""]
                t = Table([cells], colWidths=[col * 0.42, col * 0.58] * 3)
                t.setStyle(TableStyle([
                    ("VALIGN",       (0, 0), (-1, -1), "BOTTOM"),
                    ("LINEBELOW",    (1, 0), (1, 0), 0.5, colors.HexColor("#CBD5E1")),
                    ("LINEBELOW",    (3, 0), (3, 0), 0.5, colors.HexColor("#CBD5E1")),
                    ("LINEBELOW",    (5, 0), (5, 0), 0.5, colors.HexColor("#CBD5E1")),
                    ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
                    ("TOPPADDING",   (0, 0), (-1, -1), 5),
                ]))
                result.append(t)
            return result

        def _section(title: str) -> list:
            return [
                Spacer(1, 6),
                HRFlowable(width=INNER_W, thickness=0.5, color=BORDER),
                Spacer(1, 4),
                Paragraph(title.upper(), section_style),
            ]

        def _checkbox_list(items: list[str], cols: int = 2) -> Table:
            """Renders a grid of checkboxes."""
            symbol = "☐  "
            rows = []
            row = []
            for i, item in enumerate(items):
                row.append(Paragraph(f"{symbol}{item}", note_style))
                if len(row) == cols:
                    rows.append(row)
                    row = []
            if row:
                row += [""] * (cols - len(row))
                rows.append(row)
            t = Table(rows, colWidths=[INNER_W / cols] * cols)
            t.setStyle(TableStyle([
                ("VALIGN",  (0, 0), (-1, -1), "TOP"),
                ("TOPPADDING",  (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING",(0, 0), (-1, -1), 3),
            ]))
            return t

        def _blank_table(headers: list[str], num_rows: int = 3) -> Table:
            """Renders a table with header row and blank fill-in rows."""
            col_w = INNER_W / len(headers)
            header_row = [Paragraph(h, label_style) for h in headers]
            all_rows = [header_row] + [[""] * len(headers) for _ in range(num_rows)]
            t = Table(all_rows, colWidths=[col_w] * len(headers), rowHeights=[14] + [16] * num_rows)
            t.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, 0), LIGHT),
                ("GRID",          (0, 0), (-1, -1), 0.4, BORDER),
                ("FONTSIZE",      (0, 0), (-1, -1), 7),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING",    (0, 0), (-1, -1), 2),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
                ("LEFTPADDING",   (0, 0), (-1, -1), 3),
            ]))
            return t

        # ── Build story ────────────────────────────────────────────────────
        def _build_story(copy_num: int, total: int) -> list:
            story = []

            # ─── Header ───────────────────────────────────────────────────
            copy_label = f"Copy {copy_num} of {total}" if total > 1 else ""
            header_data = [[
                Paragraph("<b>STAFF ONBOARDING FORM</b>", title_style),
                Paragraph(
                    f'<font color="#94A3B8">Eskoolia School Management · {copy_label}</font>',
                    ParagraphStyle("HR", fontName="Helvetica", fontSize=7.5, textColor=MUTED, alignment=2)
                ),
            ]]
            header_table = Table(header_data, colWidths=[INNER_W * 0.6, INNER_W * 0.4])
            header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
            story.append(header_table)
            story.append(Paragraph(
                "Fill in block letters · Fields marked <font color='#EF4444'>*</font> are mandatory · "
                "Submit this form along with attested copies of supporting documents.",
                sub_style,
            ))
            story.append(HRFlowable(width=INNER_W, thickness=1, color=BRAND))
            story.append(Spacer(1, 6))

            # ─── Photo box + basic identifiers ────────────────────────────
            photo_box = Table(
                [["", "PHOTO\n(Paste here)"]],
                colWidths=[INNER_W - 28*mm, 28*mm],
                rowHeights=[32*mm],
            )
            photo_box.setStyle(TableStyle([
                ("BOX",        (1, 0), (1, 0), 0.5, BORDER),
                ("ALIGN",      (1, 0), (1, 0), "CENTER"),
                ("VALIGN",     (1, 0), (1, 0), "MIDDLE"),
                ("FONTSIZE",   (1, 0), (1, 0), 7),
                ("TEXTCOLOR",  (1, 0), (1, 0), MUTED),
            ]))

            id_items = _two_col(
                ("Staff Code", True), ("Biometric / RFID Code", False),
                ("Status", True),     ("Date of Form", False),
            )
            id_col = Table([[item] for item in id_items], colWidths=[INNER_W - 28*mm])
            id_col.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "TOP"), ("LEFTPADDING", (0, 0), (-1, -1), 0), ("RIGHTPADDING", (0, 0), (-1, -1), 0)]))

            top_row = Table([[id_col, ""]], colWidths=[INNER_W - 32*mm, 32*mm], rowHeights=[32*mm])
            top_row.setStyle(TableStyle([
                ("BOX",       (1, 0), (1, 0), 0.5, BORDER),
                ("VALIGN",    (0, 0), (-1, -1), "TOP"),
                ("ALIGN",     (1, 0), (1, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING",(0, 0), (-1, -1), 0),
            ]))

            photo_label = Paragraph('<font color="#94A3B8">PHOTO<br/>(Paste here)</font>',
                                    ParagraphStyle("PC", fontName="Helvetica", fontSize=7, textColor=MUTED, alignment=1))

            combined = Table(
                [[id_col, photo_label]],
                colWidths=[INNER_W - 30*mm, 30*mm],
            )
            combined.setStyle(TableStyle([
                ("BOX",         (1, 0), (1, 0), 0.5, BORDER),
                ("VALIGN",      (0, 0), (0, 0), "TOP"),
                ("VALIGN",      (1, 0), (1, 0), "MIDDLE"),
                ("ALIGN",       (1, 0), (1, 0), "CENTER"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING",(0, 0), (-1, -1), 0),
                ("TOPPADDING",  (1, 0), (1, 0), 0),
                ("BOTTOMPADDING",(1,0), (1, 0), 0),
                ("MINROWHEIGHT",(0, 0), (-1,-1), 30*mm),
            ]))
            story.append(combined)

            # ─── Section 1: Personal Identity ─────────────────────────────
            story += _section("1. Personal Identity")
            story += _two_col(
                ("First Name", True),  ("Middle Name", False),
                ("Last Name", True),   ("Date of Birth (DD/MM/YYYY)", True),
                ("Gender", True),      ("Blood Group", False),
                ("Mother Tongue", False), ("Religion", False),
                ("Nationality", True), ("Marital Status", False),
            )

            # ─── Section 2: Role & Employment ─────────────────────────────
            story += _section("2. Role & Employment")
            story += _two_col(
                ("Department", True),      ("Designation", True),
                ("Role / Access Level", True), ("Joining Date (DD/MM/YYYY)", True),
                ("Employment Type", True), ("Contract Type", False),
                ("Probation Period", False), ("Reporting Manager", False),
                ("Work Location", False),  ("Biometric Enrolled", False),
            )

            # ─── Section 3: Contact Details ────────────────────────────────
            story += _section("3. Contact Details")
            story += _two_col(
                ("Mobile Number", True),   ("WhatsApp Number", False),
                ("Personal Email", False), ("Official Email", False),
                ("Driving License No.", False), ("", False),
            )
            story.append(Spacer(1, 4))
            story.append(Paragraph("Current Address", label_style))
            story += _line("Address Line 1", required=True)
            story += _line("Address Line 2")
            story += _three_col(
                ("City", True), ("State / District", True), ("Pin Code", True),
            )
            story += _line("Country", required=True)
            story.append(Paragraph("☐  Permanent address same as current address", note_style))
            story.append(Spacer(1, 4))
            story.append(Paragraph("Permanent Address (if different)", label_style))
            story += _line("Address Line 1")
            story += _line("Address Line 2")
            story += _three_col(
                ("City", False), ("State / District", False), ("Pin Code", False),
            )
            story += _line("Country")

            # ─── Section 4: Family & Emergency Contact ────────────────────
            story += _section("4. Family & Emergency Contact")
            story += _two_col(
                ("Father's / Mother's Name", False), ("Spouse / Partner Name", False),
                ("No. of Children", False), ("", False),
            )
            story.append(Spacer(1, 4))
            story.append(Paragraph("Emergency Contact", label_style))
            story += _two_col(
                ("Name", True),         ("Relationship", True),
                ("Mobile Number", True), ("Alternate Number", False),
            )
            story.append(Spacer(1, 4))
            story.append(Paragraph("Nominee(s) — Insurance / Gratuity", label_style))
            story.append(_blank_table(["Nominee Name", "Relationship", "Date of Birth", "% Share"], num_rows=3))

            # ─── Section 5: Government IDs ────────────────────────────────
            story += _section("5. Government & Statutory IDs")
            story += _two_col(
                ("Aadhaar Number", True), ("PAN Number", False),
                ("Passport Number", False), ("Passport Expiry", False),
                ("Driving License No.", False), ("EPF / PF Number", False),
                ("ESI Number", False), ("UAN", False),
            )

            # ─── Section 6: Qualifications ────────────────────────────────
            story += _section("6. Educational Qualifications")
            story.append(_blank_table(
                ["Degree / Certificate", "Institution / University", "Board", "Year", "Grade / %"],
                num_rows=4,
            ))

            # ─── Section 7: Previous Employment ──────────────────────────
            story += _section("7. Previous Employment")
            story.append(_blank_table(
                ["Organisation", "Designation", "From", "To", "Reason for Leaving"],
                num_rows=3,
            ))

            # ─── Section 8: Medical / Health ──────────────────────────────
            story += _section("8. Medical & Health")
            story += _two_col(
                ("Height (cm)", False),           ("Weight (kg)", False),
                ("Known Medical Conditions", False), ("Allergies", False),
                ("Colour Blindness", False),       ("Disability Status", False),
            )
            story += _line("Emergency Medical Notes (medications, conditions to be aware of)")

            # ─── Section 9: Bank & Payroll ────────────────────────────────
            story += _section("9. Bank & Payroll Details")
            story += _two_col(
                ("Bank Name", False),          ("Branch Name", False),
                ("Account Holder Name", False),("Account Number", False),
                ("IFSC Code", False),          ("Bank-linked Mobile No.", False),
                ("Basic Salary (₹)", False),   ("", False),
            )

            # ─── Section 10: Documents Submitted ─────────────────────────
            story += _section("10. Documents Checklist")
            story.append(Paragraph(
                "Tick documents enclosed with this form (attested copies):", note_style
            ))
            story.append(_checkbox_list([
                "Aadhaar Card",
                "PAN Card",
                "Passport (if available)",
                "Passport-size Photographs (3)",
                "10th Certificate / Marksheet",
                "12th Certificate / Marksheet",
                "Degree Certificate",
                "Experience / Relieving Letters",
                "Driving License (if applicable)",
                "Medical Fitness Certificate",
                "Bank Passbook / Cancel Cheque",
                "Joining / Offer Letter",
            ], cols=2))

            # ─── Declaration ──────────────────────────────────────────────
            story += _section("Declaration")
            story.append(Paragraph(
                "I hereby declare that the information furnished above is true and correct to the best of my knowledge and belief. "
                "I understand that any false or misleading information may result in disqualification / termination of service.",
                note_style,
            ))
            story.append(Spacer(1, 14))
            sig_data = [
                [
                    Paragraph("________________________", label_style),
                    Paragraph("________________________", label_style),
                    Paragraph("________________________", label_style),
                ],
                [
                    Paragraph("Applicant Signature & Date", hint_style),
                    Paragraph("HR Officer Signature & Date", hint_style),
                    Paragraph("Principal / Director Signature", hint_style),
                ],
            ]
            sig_table = Table(sig_data, colWidths=[INNER_W / 3] * 3)
            sig_table.setStyle(TableStyle([
                ("ALIGN",  (0, 0), (-1, -1), "CENTER"),
                ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
                ("TOPPADDING",    (0, 0), (-1, -1), 4),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
            ]))
            story.append(sig_table)

            # ─── Footer ───────────────────────────────────────────────────
            story.append(Spacer(1, 8))
            story.append(HRFlowable(width=INNER_W, thickness=0.4, color=BORDER))
            story.append(Paragraph(
                "Eskoolia School Management System · Confidential · For internal HR use only",
                footer_style,
            ))

            return story

        # ── Assemble all copies ────────────────────────────────────────────
        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=L_MARGIN,
            rightMargin=R_MARGIN,
            topMargin=14 * mm,
            bottomMargin=12 * mm,
            title="Staff Onboarding Form – Eskoolia",
            author="Eskoolia HR",
        )

        full_story: list = []
        for i in range(1, copies + 1):
            full_story += _build_story(i, copies)
            if i < copies:
                full_story.append(PageBreak())

        doc.build(full_story)

        pdf_bytes = buf.getvalue()

        from django.http import HttpResponse as DjResponse
        response = DjResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = 'attachment; filename="staff-onboarding-form.pdf"'
        response["Content-Length"] = str(len(pdf_bytes))
        # Allow frontend to read Content-Disposition header
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response


# ── Filled onboarding form PDF ────────────────────────────────────────────────

class StaffOnboardFilledFormView(APIView):
    """POST /api/v1/hr/onboard/filled-form/

    Generates a filled staff onboarding PDF from the current wizard form data.

    Request body (JSON):
      form_data  {dict}  — all wizard form fields as key/value strings.

    Validations:
      - User must be authenticated.
      - `form_data` must be a dict.
      - `form_data.first_name` must be a non-empty string.
    """

    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        # ── Input validation ───────────────────────────────────────────────
        body = request.data
        form_data = body.get("form_data")

        if not isinstance(form_data, dict):
            return Response(
                {"error": "`form_data` must be an object containing the wizard fields."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        first_name = str(form_data.get("first_name", "")).strip()
        if not first_name:
            return Response(
                {"error": "`form_data.first_name` is required to generate a filled form."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Sanitise: all values to strings, strip control characters
        def _s(key: str, default: str = "") -> str:
            """Return form_data[key] as a safe stripped string."""
            v = form_data.get(key, default)
            if v is None:
                return default
            return str(v).strip()

        # ── Build PDF ──────────────────────────────────────────────────────
        try:
            from reportlab.lib import colors
            from reportlab.lib.pagesizes import A4
            from reportlab.lib.styles import ParagraphStyle
            from reportlab.lib.units import mm
            from reportlab.platypus import (
                HRFlowable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
            )
            from io import BytesIO
        except ImportError:
            return Response(
                {"error": "PDF generation library is not available. Contact support."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        BRAND  = colors.HexColor("#4729F4")
        BORDER = colors.HexColor("#E8E8F0")
        MUTED  = colors.HexColor("#94A3B8")
        INK    = colors.HexColor("#15172A")
        LIGHT  = colors.HexColor("#F8FAFC")
        GREEN  = colors.HexColor("#16A34A")

        PAGE_W, PAGE_H = A4
        L_MARGIN = R_MARGIN = 18 * mm
        INNER_W = PAGE_W - L_MARGIN - R_MARGIN

        title_style   = ParagraphStyle("FT",  fontName="Helvetica-Bold",   fontSize=15, textColor=INK,   spaceAfter=2)
        sub_style     = ParagraphStyle("FS",  fontName="Helvetica",         fontSize=8,  textColor=MUTED,  spaceAfter=6)
        section_style = ParagraphStyle("SEC", fontName="Helvetica-Bold",   fontSize=8.5,textColor=BRAND,  spaceBefore=8, spaceAfter=3)
        label_style   = ParagraphStyle("LBL", fontName="Helvetica-Bold",   fontSize=7,  textColor=MUTED)
        value_style   = ParagraphStyle("VAL", fontName="Helvetica",         fontSize=8,  textColor=INK)
        hint_style    = ParagraphStyle("HNT", fontName="Helvetica-Oblique",fontSize=6.5,textColor=MUTED)
        footer_style  = ParagraphStyle("FTR", fontName="Helvetica",         fontSize=6.5,textColor=MUTED, alignment=1)
        tbl_hdr_style = ParagraphStyle("TH",  fontName="Helvetica-Bold",   fontSize=7,  textColor=INK)
        tbl_val_style = ParagraphStyle("TV",  fontName="Helvetica",         fontSize=7,  textColor=INK)

        # ── Helpers ────────────────────────────────────────────────────────

        def _field_row(label: str, value: str, col_ratio: float = 0.35) -> Table:
            """Single label+value row with bottom border."""
            lbl_w = INNER_W * col_ratio
            val_w = INNER_W * (1 - col_ratio)
            disp = value if value else ""
            t = Table(
                [[Paragraph(label, label_style), Paragraph(disp, value_style)]],
                colWidths=[lbl_w, val_w],
            )
            t.setStyle(TableStyle([
                ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
                ("LINEBELOW",     (1, 0), (1, 0), 0.5,
                 GREEN if value else colors.HexColor("#CBD5E1")),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ]))
            return t

        def _two_fields(pairs: list[tuple[str, str]]) -> list:
            """Two label+value pairs side by side."""
            col = (INNER_W / 2) - 2 * mm
            rows = []
            it = iter(pairs)
            for left in it:
                right = next(it, None)
                left_lbl, left_val = left
                right_lbl = right[0] if right else ""
                right_val = right[1] if right else ""
                cells = [
                    Paragraph(left_lbl, label_style), Paragraph(left_val, value_style),
                    Paragraph(right_lbl, label_style), Paragraph(right_val, value_style),
                ]
                t = Table([cells], colWidths=[col * 0.38, col * 0.62, col * 0.38, col * 0.62])
                t.setStyle(TableStyle([
                    ("VALIGN",        (0, 0), (-1, -1), "BOTTOM"),
                    ("LINEBELOW",     (1, 0), (1, 0), 0.5,
                     GREEN if left_val else colors.HexColor("#CBD5E1")),
                    ("LINEBELOW",     (3, 0), (3, 0), 0.5,
                     GREEN if right_val else colors.HexColor("#CBD5E1")),
                    ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                    ("TOPPADDING",    (0, 0), (-1, -1), 4),
                    ("LEFTPADDING",   (2, 0), (2, 0), 6),
                ]))
                rows.append(t)
            return rows

        def _section(title: str) -> list:
            return [
                Spacer(1, 4),
                HRFlowable(width=INNER_W, thickness=0.5, color=BORDER),
                Spacer(1, 3),
                Paragraph(title.upper(), section_style),
            ]

        def _data_table(headers: list[str], rows: list[list[str]]) -> Table:
            col_w = INNER_W / len(headers)
            header_cells = [Paragraph(h, tbl_hdr_style) for h in headers]
            data_rows = [[Paragraph(c, tbl_val_style) for c in r] for r in rows]
            if not data_rows:
                data_rows = [["—"] * len(headers)]
            t = Table(
                [header_cells] + data_rows,
                colWidths=[col_w] * len(headers),
            )
            t.setStyle(TableStyle([
                ("BACKGROUND",    (0, 0), (-1, 0), LIGHT),
                ("GRID",          (0, 0), (-1, -1), 0.4, BORDER),
                ("FONTSIZE",      (0, 0), (-1, -1), 7),
                ("VALIGN",        (0, 0), (-1, -1), "MIDDLE"),
                ("TOPPADDING",    (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
                ("LEFTPADDING",   (0, 0), (-1, -1), 4),
            ]))
            return t

        # ── Assemble story ─────────────────────────────────────────────────
        story = []

        # ─── Header ───────────────────────────────────────────────────────
        staff_name = " ".join(filter(None, [_s("first_name"), _s("middle_name"), _s("last_name")]))
        staff_code = _s("staff_code") or "—"

        header_data = [[
            Paragraph(f"<b>STAFF ONBOARDING FORM</b><br/><font size='9' color='#94A3B8'>{staff_name}</font>", title_style),
            Paragraph(
                f'<font color="#94A3B8">Code: {staff_code}<br/>Generated: {__import__("datetime").date.today().strftime("%d %b %Y")}</font>',
                ParagraphStyle("HR2", fontName="Helvetica", fontSize=7.5, textColor=MUTED, alignment=2),
            ),
        ]]
        header_table = Table(header_data, colWidths=[INNER_W * 0.65, INNER_W * 0.35])
        header_table.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE")]))
        story.append(header_table)

        status_val = _s("status", "active").capitalize()
        story.append(Paragraph(
            f'Status: <b>{status_val}</b> · '
            f'Fields highlighted in <font color="#16A34A"><b>green</b></font> have been filled.',
            ParagraphStyle("SUB2", fontName="Helvetica", fontSize=7.5, textColor=MUTED, spaceAfter=5),
        ))
        story.append(HRFlowable(width=INNER_W, thickness=1, color=BRAND))
        story.append(Spacer(1, 5))

        # ─── Photo box + identifiers ───────────────────────────────────────
        id_pairs = [
            ("Staff Code", _s("staff_code")),
            ("Biometric / RFID Code", _s("biometric_code")),
            ("Status", status_val),
            ("Date of Form", _s("joining_date")),
        ]
        id_rows = _two_fields(id_pairs)
        id_col = Table([[r] for r in id_rows], colWidths=[INNER_W - 30*mm])
        id_col.setStyle(TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ]))
        photo_label = Paragraph(
            '<font color="#94A3B8">PHOTO<br/>(Paste here)</font>',
            ParagraphStyle("PC2", fontName="Helvetica", fontSize=7, textColor=MUTED, alignment=1),
        )
        combined = Table([[id_col, photo_label]], colWidths=[INNER_W - 30*mm, 30*mm])
        combined.setStyle(TableStyle([
            ("BOX",         (1, 0), (1, 0), 0.5, BORDER),
            ("VALIGN",      (0, 0), (0, 0), "TOP"),
            ("VALIGN",      (1, 0), (1, 0), "MIDDLE"),
            ("ALIGN",       (1, 0), (1, 0), "CENTER"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING",(0, 0), (-1, -1), 0),
            ("MINROWHEIGHT",(0, 0), (-1, -1), 28*mm),
        ]))
        story.append(combined)

        # ─── Section 1: Personal Identity ─────────────────────────────────
        story += _section("1. Personal Identity")
        story += _two_fields([
            ("First Name", _s("first_name")),       ("Middle Name", _s("middle_name")),
            ("Last Name",  _s("last_name")),         ("Date of Birth", _s("date_of_birth")),
            ("Gender",     _s("gender")),            ("Blood Group", _s("blood_group") or _s("blood_group_input")),
            ("Mother Tongue", _s("mother_tongue")),  ("Religion", _s("religion")),
            ("Nationality", _s("nationality")),      ("Marital Status", _s("marital_status")),
        ])

        # ─── Section 2: Role & Employment ─────────────────────────────────
        story += _section("2. Role & Employment")
        prob = ""
        if _s("probation_value"):
            prob = f"{_s('probation_value')} {_s('probation_unit')}".strip()
        story += _two_fields([
            ("Department",       _s("department")),        ("Designation", _s("designation")),
            ("Role / Access",    _s("role")),              ("Joining Date", _s("joining_date")),
            ("Employment Type",  _s("employment_type")),   ("Contract Type", _s("contract_type")),
            ("Probation Period", prob),                    ("Reporting Manager", _s("reporting_manager")),
            ("Work Location",    _s("work_location")),     ("Biometric ID", _s("biometric_code")),
        ])

        # ─── Section 3: Contact ────────────────────────────────────────────
        story += _section("3. Contact Details")
        story += _two_fields([
            ("Mobile",        _s("mobile")),          ("WhatsApp", _s("whatsapp")),
            ("Personal Email",_s("personal_email")),  ("Official Email", _s("official_email")),
        ])
        story.append(Spacer(1, 3))
        story.append(Paragraph("Current Address", label_style))
        story.append(Spacer(1, 2))

        curr_addr = ", ".join(filter(None, [
            _s("current_address_line1"), _s("current_address_line2"),
            _s("current_city"),          _s("current_state"),
            _s("current_pin"),           _s("current_country"),
        ])) or "—"
        story.append(_field_row("Address", curr_addr, col_ratio=0.2))

        same = str(form_data.get("same_address", "")).lower() in ("true", "1", "yes")
        if same:
            story.append(Paragraph("✓  Permanent address same as current address", value_style))
        else:
            perm_addr = ", ".join(filter(None, [
                _s("permanent_address_line1"), _s("permanent_address_line2"),
                _s("permanent_city"),          _s("permanent_state"),
                _s("permanent_pin"),           _s("permanent_country"),
            ])) or ""
            if perm_addr:
                story.append(Spacer(1, 3))
                story.append(Paragraph("Permanent Address", label_style))
                story.append(_field_row("Address", perm_addr, col_ratio=0.2))

        # ─── Section 4: Family & Emergency ────────────────────────────────
        story += _section("4. Family & Emergency Contact")
        story += _two_fields([
            ("Father / Mother Name", _s("father_name") or _s("mother_name")),
            ("Spouse / Partner",     _s("spouse_name")),
            ("No. of Children",      _s("num_children")), ("Marital Status", _s("marital_status")),
            ("Emergency Contact",    _s("emergency_name")),
            ("Emergency Relation",   _s("emergency_relation")),
            ("Emergency Mobile",     _s("emergency_phone")), ("", ""),
        ])

        # ─── Section 5: Government IDs ────────────────────────────────────
        story += _section("5. Government & Statutory IDs")
        story += _two_fields([
            ("Aadhaar Number", _s("aadhaar_number")), ("PAN Number", _s("pan_number")),
            ("Passport Number",_s("passport_number")), ("Passport Expiry", _s("passport_expiry")),
            ("Driving License", _s("driving_license")), ("EPF / PF Number", _s("epf_number")),
            ("ESI Number",      _s("esi_number")),     ("UAN", _s("uan")),
        ])

        # ─── Section 6: Qualifications ────────────────────────────────────
        story += _section("6. Educational Qualifications")
        summary = _s("qualifications_summary")
        if summary:
            story.append(_field_row("Summary", summary, col_ratio=0.2))
        story.append(_data_table(
            ["Degree / Certificate", "Institution / University", "Board", "Year", "Grade / %"],
            [],  # child-component state; not available at PDF-generation time
        ))

        # ─── Section 7: Previous Employment ──────────────────────────────
        story += _section("7. Previous Employment")
        story.append(_data_table(
            ["Organisation", "Designation", "From", "To", "Reason for Leaving"],
            [],
        ))

        # ─── Section 8: Medical / Health ──────────────────────────────────
        story += _section("8. Medical & Health")
        story += _two_fields([
            ("Height (cm)",          _s("height")),        ("Weight (kg)", _s("weight")),
            ("Colour Blindness",     _s("colour_blindness")),("Disability Status", _s("disability_status")),
            ("Medical Conditions",   _s("medical_conditions")), ("Eye Exam Result", _s("eye_exam_result")),
            ("Medical Cert No.",     _s("med_cert_no")),   ("Cert Valid Till", _s("cert_valid_till")),
        ])

        # ─── Section 9: Bank & Payroll ────────────────────────────────────
        story += _section("9. Bank & Payroll Details")
        story += _two_fields([
            ("Bank Name",          _s("bank_name")),         ("Branch", _s("bank_branch")),
            ("Account Holder",     _s("bank_account_name")), ("Account Number", _s("bank_account_number")),
            ("IFSC Code",          _s("ifsc_code")),         ("Bank Mobile", _s("bank_mobile")),
            ("Basic Salary (₹)",   _s("basic_salary_input")),("Salary Mode", _s("salary_mode")),
        ])

        # ─── Declaration / Signatures ─────────────────────────────────────
        story += _section("Declaration")
        story.append(Paragraph(
            "I hereby declare that the information furnished above is true and correct to the best of my knowledge and belief.",
            ParagraphStyle("NOTE2", fontName="Helvetica", fontSize=7, textColor=MUTED, spaceAfter=2),
        ))
        story.append(Spacer(1, 12))
        sig_data = [[
            Paragraph("________________________", label_style),
            Paragraph("________________________", label_style),
            Paragraph("________________________", label_style),
        ], [
            Paragraph("Applicant Signature & Date", hint_style),
            Paragraph("HR Officer Signature & Date", hint_style),
            Paragraph("Principal / Director", hint_style),
        ]]
        sig_table = Table(sig_data, colWidths=[INNER_W / 3] * 3)
        sig_table.setStyle(TableStyle([
            ("ALIGN",  (0, 0), (-1, -1), "CENTER"),
            ("VALIGN", (0, 0), (-1, -1), "BOTTOM"),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
        ]))
        story.append(sig_table)

        # Footer
        story.append(Spacer(1, 8))
        story.append(HRFlowable(width=INNER_W, thickness=0.4, color=BORDER))
        story.append(Paragraph(
            f"Eskoolia School Management System · Confidential · "
            f"Generated for {staff_name} · For internal HR use only",
            footer_style,
        ))

        # ── Build PDF ──────────────────────────────────────────────────────
        buf = BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=L_MARGIN,
            rightMargin=R_MARGIN,
            topMargin=14 * mm,
            bottomMargin=12 * mm,
            title=f"Staff Onboarding – {staff_name}",
            author="Eskoolia HR",
        )
        doc.build(story)

        pdf_bytes = buf.getvalue()

        from django.http import HttpResponse as DjResponse
        safe_name = staff_name.replace(" ", "_").replace("/", "-")[:40]
        filename = f"onboarding-{safe_name}.pdf"

        response = DjResponse(pdf_bytes, content_type="application/pdf")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        response["Content-Length"] = str(len(pdf_bytes))
        response["Access-Control-Expose-Headers"] = "Content-Disposition"
        return response
