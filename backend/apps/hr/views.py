from decimal import Decimal
import re

from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.contrib.auth import get_user_model
from django.http import Http404
from django.utils import timezone
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import AuthenticationFailed, NotAuthenticated, NotFound, PermissionDenied, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response
from apps.access_control.models import UserRole
from apps.core.models import Class as SchoolClass, Section
from apps.students.models import Student

from .models import Department, Designation, LeaveDefine, LeaveRequest, LeaveType, PayrollRecord, Staff, StaffAttendance
from .serializers import (
    DepartmentSerializer,
    DesignationSerializer,
    LeaveDefineSerializer,
    LeaveRequestSerializer,
    LeaveTypeSerializer,
    PayrollRecordSerializer,
    StaffSerializer,
    StaffAttendanceSerializer,
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
    queryset = Department.objects.select_related("school").all()
    serializer_class = DepartmentSerializer
    filterset_fields = ["is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at"]
    permission_codes = {"*": "human_resource.departments.view"}

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


class StaffViewSet(SchoolScopedModelViewSet):
    queryset = Staff.objects.select_related("school", "user", "role", "department", "designation").all()
    serializer_class = StaffSerializer
    filterset_fields = ["role", "department", "designation", "status", "join_date", "gender", "marital_status", "contract_type"]
    search_fields = ["staff_no", "first_name", "last_name", "email", "phone", "emergency_mobile", "location", "driving_license"]
    ordering_fields = ["first_name", "join_date", "created_at"]
    permission_codes = {
        "*": "human_resource.staff.view",
        "next_staff_no": "human_resource.staff.view",
    }

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

    def create(self, request, *args, **kwargs):
        try:
            self._validate_related_ids(request)
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            self.perform_create(serializer)
            return self.success_response(
                "Staff created successfully",
                serializer.data,
                status_code=status.HTTP_201_CREATED,
            )
        except IntegrityError:
            raise ValidationError({"staff_no": "Staff number already exists."})

    def update(self, request, *args, **kwargs):
        try:
            partial = kwargs.pop("partial", False)
            self._validate_related_ids(request)
            instance = self.get_object()
            serializer = self.get_serializer(instance, data=request.data, partial=partial)
            serializer.is_valid(raise_exception=True)
            self.perform_update(serializer)
            return self.success_response("Staff updated successfully", serializer.data)
        except IntegrityError:
            raise ValidationError({"staff_no": "Staff number already exists."})

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

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
        User = get_user_model()

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
            matched_user = User.objects.filter(email__iexact=staff.email).order_by("id").first()
            if matched_user and hasattr(matched_user, "staff_profile") and matched_user.staff_profile.id != staff.id:
                matched_user = None

        if not matched_user:
            username = self._generate_username(staff)
            matched_user = User.objects.create(
                username=username,
                first_name=(staff.first_name or "").strip(),
                last_name=(staff.last_name or "").strip(),
                email=(staff.email or "").strip(),
                school_id=staff.school_id,
                is_active=True,
                access_status=True,
            )
            matched_user.set_unusable_password()
            matched_user.save(update_fields=["password"])

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

        submitted_staff_no = (serializer.validated_data.get("staff_no") or "").strip()
        staff_no = submitted_staff_no or self._generate_staff_no(school)
        staff = serializer.save(school=school, staff_no=staff_no)
        self._ensure_staff_user(staff)

    def perform_update(self, serializer):
        staff = serializer.save()
        self._ensure_staff_user(staff)

    @action(detail=False, methods=["get"], url_path="next-staff-no")
    def next_staff_no(self, request):
        school = request.user.school or getattr(request, "school", None)
        if not school and not request.user.is_superuser:
            raise PermissionDenied("School context is required.")
        return Response({"staff_no": self._generate_staff_no(school)})


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
    queryset = StaffAttendance.objects.select_related("school", "staff").all()
    serializer_class = StaffAttendanceSerializer
    filterset_fields = ["staff", "attendance_date", "attendance_type"]
    search_fields = ["staff__staff_no", "staff__first_name", "staff__last_name", "note"]
    ordering_fields = ["attendance_date", "created_at"]
    permission_codes = {
        "*": "human_resource.staff_attendance.view",
        "bulk_store": "human_resource.staff_attendance.view",
        "report": "human_resource.staff_attendance.view",
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


class PayrollRecordViewSet(SchoolScopedModelViewSet):
    queryset = PayrollRecord.objects.select_related("school", "staff", "created_by").all()
    serializer_class = PayrollRecordSerializer
    filterset_fields = ["staff", "payroll_month", "payroll_year", "status"]
    search_fields = ["staff__staff_no", "staff__first_name", "staff__last_name"]
    ordering_fields = ["payroll_year", "payroll_month", "created_at", "net_salary"]
    permission_codes = {
        "*": "human_resource.payroll.view",
        "summary": "human_resource.payroll.view",
        "mark_paid": "human_resource.payroll.view",
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

    @action(detail=True, methods=["post"], url_path="mark-paid")
    def mark_paid(self, request, pk=None):
        payroll = self.get_object()
        if payroll.status == PayrollRecord.STATUS_PAID:
            return Response({"id": payroll.id, "status": payroll.status, "paid_at": payroll.paid_at})

        payroll.status = PayrollRecord.STATUS_PAID
        payroll.paid_at = timezone.now()
        payroll.save(update_fields=["status", "paid_at", "updated_at"])
        return Response({"id": payroll.id, "status": payroll.status, "paid_at": payroll.paid_at})
