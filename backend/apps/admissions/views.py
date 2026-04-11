from django.db import IntegrityError, transaction
from datetime import datetime
import re
import requests
from django.core.cache import cache
from rest_framework import mixins, permissions, status, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.decorators import action
from rest_framework.views import APIView
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from django.utils import timezone
from apps.tenancy.models import School
from apps.access_control.models import Role, UserRole
from apps.core.models import Class, Section
from apps.students.models import Student
from .models import (
    AdmissionFollowUp,
    AdmissionInquiry,
    AdminSetupEntry,
    CertificateTemplate,
    ComplaintEntry,
    IdCardTemplate,
    PhoneCallLogEntry,
    PostalDispatchEntry,
    PostalReceiveEntry,
    VisitorBookEntry,
)
from .serializers import (
    AdmissionPincodeLookupQuerySerializer,
    AdmissionFollowUpSerializer,
    AdmissionInquirySerializer,
    AdminSetupEntrySerializer,
    CertificateTemplateSerializer,
    ComplaintEntrySerializer,
    IdCardTemplateSerializer,
    PhoneCallLogEntrySerializer,
    PostalDispatchEntrySerializer,
    PostalReceiveEntrySerializer,
    VisitorBookEntrySerializer,
)


class VisitorBookPagination(ApiPageNumberPagination):
    page_size = 10
    max_page_size = 50

    def get_page_size(self, request):
        requested = super().get_page_size(request)
        if not requested:
            requested = self.page_size
        return max(5, min(50, requested))


class AdminSetupPagination(ApiPageNumberPagination):
    page_size = 5
    max_page_size = 50

    def get_page_size(self, request):
        requested = super().get_page_size(request)
        if not requested:
            requested = self.page_size
        return max(5, min(50, requested))


class AdminSectionRBACMixin:
    permission_codes = {}

    def _get_permission_code(self):
        action = getattr(self, "action", None)
        if action in self.permission_codes:
            return self.permission_codes[action]
        return self.permission_codes.get("*")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        code = self._get_permission_code()
        # Enforce permission checks for all admin section operations (fail-safe)
        # If no permission code is configured, deny access by default
        if code is None:
            raise PermissionDenied("This action requires specific permissions that are not configured.")

        user = request.user
        if user.is_superuser:
            return

        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")


class DuplicateSafeWriteMixin:
    duplicate_error_message = "Record already exists"
    create_success_message = "Record created successfully"
    update_success_message = "Record updated successfully"
    delete_success_message = "Record deleted successfully"

    def _normalize_field_errors(self, serializer_errors):
        normalized = {}
        for field, errors in (serializer_errors or {}).items():
            if isinstance(errors, (list, tuple)):
                normalized[field] = [str(error) for error in errors]
            else:
                normalized[field] = [str(errors)]
        return normalized

    def _first_error_message(self, field_errors):
        for errors in field_errors.values():
            if isinstance(errors, list) and errors:
                return str(errors[0])
        return "Validation failed"

    def _validation_response(self, field_errors=None, message="Validation failed", status_code=status.HTTP_400_BAD_REQUEST):
        return Response(
            {
                "success": False,
                "message": message,
                "field_errors": field_errors or {},
            },
            status=status_code,
        )

    def _success_response(self, message, data=None, status_code=status.HTTP_200_OK):
        payload = {"success": True, "message": message}
        if data is not None:
            payload["data"] = data
        return Response(payload, status=status_code)

    def _raise_integrity_validation_error(self, exc):
        message = str(exc).lower()
        if "duplicate" in message or "unique" in message or "uq_" in message:
            raise ValidationError({"detail": self.duplicate_error_message})
        raise ValidationError({"detail": "Invalid request data."})

    def _integrity_response(self, exc):
        try:
            self._raise_integrity_validation_error(exc)
        except ValidationError as error:
            detail = error.detail
            if isinstance(detail, dict):
                field_errors = self._normalize_field_errors(detail)
                message = self._first_error_message(field_errors)
            else:
                message = str(detail)
                field_errors = {"detail": [message]}
            return self._validation_response(field_errors, message)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_create(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        headers = self.get_success_headers(serializer.data)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.create_success_message, output.data, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_update(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.update_success_message, output.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return self._success_response(self.delete_success_message)


class AdmissionPincodeLookupAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def _has_access(self, user):
        if user.is_superuser:
            return True
        if not hasattr(user, "has_permission_code"):
            return False
        return user.has_permission_code("admin_section.admission_query.view")

    def _normalize_post_office(self, office):
        office = office or {}
        return {
            "name": str(office.get("Name") or "").strip(),
            "branch_type": str(office.get("BranchType") or "").strip(),
            "delivery_status": str(office.get("DeliveryStatus") or "").strip(),
            "district": str(office.get("District") or "").strip(),
            "state": str(office.get("State") or "").strip(),
            "region": str(office.get("Region") or "").strip(),
            "division": str(office.get("Division") or "").strip(),
            "circle": str(office.get("Circle") or "").strip(),
            "taluk": str(office.get("Taluk") or "").strip(),
            "block": str(office.get("Block") or "").strip(),
            "country": str(office.get("Country") or "").strip(),
            "pincode": str(office.get("Pincode") or "").strip(),
        }

    def get(self, request):
        if not self._has_access(request.user):
            raise PermissionDenied("You do not have permission to perform this action.")

        serializer = AdmissionPincodeLookupQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            field_errors = {
                field: [str(error) for error in (errors or [])] if isinstance(errors, (list, tuple)) else [str(errors)]
                for field, errors in serializer.errors.items()
            }
            message = field_errors.get("pincode", ["Pincode must be exactly 6 digits."])[0]
            return Response(
                {
                    "success": False,
                    "message": message,
                    "field_errors": field_errors,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        pincode = serializer.validated_data["pincode"]
        cache_key = f"admission_pincode_details:v1:{pincode}"
        cached = cache.get(cache_key)
        if cached:
            return Response({"success": True, "message": "Pincode details fetched successfully.", "data": cached})

        headers = {
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        }
        try:
            upstream = requests.get(f"https://api.postalpincode.in/pincode/{pincode}", timeout=8, headers=headers)
            upstream.raise_for_status()
            payload = upstream.json()
        except requests.RequestException:
            return Response(
                {
                    "success": False,
                    "message": "Unable to fetch pincode details right now.",
                    "field_errors": {"pincode": "Unable to fetch pincode details right now."},
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        if not isinstance(payload, list) or not payload:
            return Response(
                {
                    "success": False,
                    "message": "Invalid PIN Code",
                    "field_errors": {"pincode": "Invalid PIN Code"},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        entry = payload[0] or {}
        if str(entry.get("Status") or "").strip().lower() != "success":
            return Response(
                {
                    "success": False,
                    "message": "Invalid PIN Code",
                    "field_errors": {"pincode": "Invalid PIN Code"},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        raw_post_offices = entry.get("PostOffice") or []
        post_offices = [self._normalize_post_office(item) for item in raw_post_offices if item]
        post_offices = [item for item in post_offices if item.get("name")]

        if not post_offices:
            return Response(
                {
                    "success": False,
                    "message": "Invalid PIN Code",
                    "field_errors": {"pincode": "Invalid PIN Code"},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        selected_post_office = post_offices[0]
        state = str(selected_post_office.get("state") or "").strip()
        district = str(selected_post_office.get("district") or "").strip()

        if not state or not district:
            return Response(
                {
                    "success": False,
                    "message": "Invalid PIN Code",
                    "field_errors": {"pincode": "Invalid PIN Code"},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        data = {
            "pincode": pincode,
            "state": state,
            "district": district,
            "post_office": selected_post_office.get("name") or "",
            "selected_post_office": selected_post_office,
            "post_offices": post_offices,
            "multiple_post_offices": len(post_offices) > 1,
        }
        cache.set(cache_key, data, 24 * 60 * 60)

        return Response(
            {
                "success": True,
                "message": "Pincode details fetched successfully.",
                "data": data,
            },
            status=status.HTTP_200_OK,
        )


class AdmissionInquiryViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = AdmissionInquirySerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    create_success_message = "Admission query created successfully"
    update_success_message = "Record updated successfully"
    delete_success_message = "Record deleted successfully"
    permission_codes = {
        "list": "admin_section.admission_query.view",
        "retrieve": "admin_section.admission_query.view",
        "create": "admin_section.admission_query.add",
        "update": "admin_section.admission_query.edit",
        "partial_update": "admin_section.admission_query.edit",
        "destroy": "admin_section.admission_query.delete",
    }

    def get_queryset(self):
        user = self.request.user
        queryset = AdmissionInquiry.objects.select_related(
            "school",
            "created_by",
            "source",
            "reference",
            "school_class",
        ).prefetch_related("follow_ups__author")
        if user.is_superuser:
            scoped = queryset
        elif user.school_id:
            scoped = queryset.filter(school_id=user.school_id)
        else:
            return queryset.none()

        query = self.request.query_params
        date_from = query.get("date_from")
        date_to = query.get("date_to")
        source = query.get("source")
        active_status = query.get("active_status") or query.get("status")

        if date_from:
            scoped = scoped.filter(query_date__gte=date_from)
        if date_to:
            scoped = scoped.filter(query_date__lte=date_to)
        if source:
            scoped = scoped.filter(source_id=source)
        if active_status:
            scoped = scoped.filter(active_status=active_status)

        return scoped

    def perform_create(self, serializer):
        user = self.request.user
        school = getattr(user, "school", None) or getattr(self.request, "school", None)

        # Fallback for users where only school_id is present.
        if not school and getattr(user, "school_id", None):
            school = School.objects.filter(id=user.school_id, is_active=True).first()

        if not school:
            raise PermissionDenied("School context is required.")

        instance = serializer.save(school=school, created_by=user)
        if not instance.query_date:
            instance.query_date = timezone.localdate()
        if instance.school_class_id and not instance.class_name:
            instance.class_name = instance.school_class.name
        instance.save(update_fields=["query_date", "class_name", "updated_at"])

    def perform_update(self, serializer):
        instance = serializer.save()
        if instance.school_class_id and not instance.class_name:
            instance.class_name = instance.school_class.name
            instance.save(update_fields=["class_name", "updated_at"])

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_create(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        headers = self.get_success_headers(serializer.data)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.create_success_message, output.data, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_update(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.update_success_message, output.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class AdmissionFollowUpViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = AdmissionFollowUpSerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    http_method_names = ["get", "post", "delete", "head", "options"]
    create_success_message = "Follow-up saved successfully"
    delete_success_message = "Follow-up deleted successfully"
    permission_codes = {
        "list": "admin_section.admission_query.view",
        "retrieve": "admin_section.admission_query.view",
        "create": "admin_section.admission_query.edit",
        "destroy": "admin_section.admission_query.edit",
    }

    def get_queryset(self):
        user = self.request.user
        qs = AdmissionFollowUp.objects.select_related("inquiry__school", "author")
        inquiry_id = self.request.query_params.get("inquiry")
        if user.is_superuser:
            scoped = qs
        elif user.school_id:
            scoped = qs.filter(inquiry__school_id=user.school_id)
        else:
            return qs.none()

        if inquiry_id:
            scoped = scoped.filter(inquiry_id=inquiry_id)

        return scoped.order_by("-created_at")

    def perform_create(self, serializer):
        user = self.request.user
        inquiry_id = self.request.data.get("inquiry")
        # Ensure the inquiry belongs to the user's school
        if inquiry_id and not user.is_superuser:
            if not AdmissionInquiry.objects.filter(id=inquiry_id, school_id=user.school_id).exists():
                raise PermissionDenied("Inquiry not found in your school.")

        instance = serializer.save(author=user)

        follow_up_raw = self.request.data.get("follow_up_date")
        follow_up_date = timezone.localdate()
        if follow_up_raw:
            try:
                follow_up_date = datetime.strptime(str(follow_up_raw), "%Y-%m-%d").date()
            except ValueError as exc:
                raise ValidationError({"follow_up_date": "Follow up date is invalid."}) from exc

        inquiry_updates = {
            "follow_up_date": follow_up_date,
        }

        next_follow_up_date = self.request.data.get("next_follow_up_date")
        active_status = self.request.data.get("active_status") or self.request.data.get("status")

        if follow_up_date > timezone.localdate():
            raise ValidationError({"follow_up_date": "Follow-up date cannot be in the future."})

        if next_follow_up_date:
            try:
                parsed_next = datetime.strptime(str(next_follow_up_date), "%Y-%m-%d").date()
            except ValueError as exc:
                raise ValidationError({"next_follow_up_date": "Next follow up date is invalid."}) from exc
            if parsed_next < timezone.localdate():
                raise ValidationError({"next_follow_up_date": "Next follow-up date cannot be in the past."})
            if parsed_next < follow_up_date:
                raise ValidationError({"next_follow_up_date": "Next follow-up date must be on or after the follow-up date."})

        if next_follow_up_date:
            inquiry_updates["next_follow_up_date"] = parsed_next
        if active_status:
            inquiry_updates["active_status"] = active_status

        # Keep lifecycle status update support for existing screens.
        if instance.status_after:
            inquiry_updates["status"] = instance.status_after

        AdmissionInquiry.objects.filter(pk=instance.inquiry_id).update(**inquiry_updates)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_create(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        headers = self.get_success_headers(serializer.data)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.create_success_message, output.data, status.HTTP_201_CREATED)


class VisitorBookEntryViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = VisitorBookEntrySerializer
    pagination_class = VisitorBookPagination
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    create_success_message = "Visitor record created successfully"
    update_success_message = "Record updated successfully"
    permission_codes = {
        "list": "admin_section.visitor_book.view",
        "retrieve": "admin_section.visitor_book.view",
        "create": "admin_section.visitor_book.add",
        "update": "admin_section.visitor_book.edit",
        "partial_update": "admin_section.visitor_book.edit",
        "destroy": "admin_section.visitor_book.delete",
    }

    def get_queryset(self):
        user = self.request.user
        qs = VisitorBookEntry.objects.select_related("school", "created_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def _build_next_visitor_id(self, school_id: int, year: int) -> str:
        prefix = f"VIS-{year}-"
        last_row = (
            VisitorBookEntry.objects.filter(school_id=school_id, visitor_id__startswith=prefix)
            .order_by("-visitor_id")
            .only("visitor_id")
            .first()
        )

        next_number = 1
        if last_row and last_row.visitor_id:
            try:
                next_number = int(last_row.visitor_id.rsplit("-", 1)[1]) + 1
            except (IndexError, ValueError):
                next_number = 1
        return f"{prefix}{next_number:04d}"

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        if not school:
            raise PermissionDenied("School context is required.")

        now_year = timezone.localdate().year
        for _ in range(5):
            try:
                with transaction.atomic():
                    School.objects.select_for_update().filter(pk=school.id).first()
                    visitor_id = self._build_next_visitor_id(school.id, now_year)
                    serializer.save(school=school, created_by=user, visitor_id=visitor_id)
                return
            except IntegrityError:
                continue

        raise ValidationError({"detail": "Unable to generate visitor ID. Please retry."})

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_create(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        headers = self.get_success_headers(serializer.data)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.create_success_message, output.data, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_update(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.update_success_message, output.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class ComplaintEntryViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = ComplaintEntrySerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    create_success_message = "Complaint created successfully"
    update_success_message = "Record updated successfully"
    permission_codes = {
        "list": "admin_section.complaint.view",
        "retrieve": "admin_section.complaint.view",
        "create": "admin_section.complaint.add",
        "update": "admin_section.complaint.edit",
        "partial_update": "admin_section.complaint.edit",
        "destroy": "admin_section.complaint.delete",
    }

    def get_queryset(self):
        user = self.request.user
        qs = ComplaintEntry.objects.select_related("school", "created_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        serializer.save(school=school, created_by=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_create(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        headers = self.get_success_headers(serializer.data)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.create_success_message, output.data, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_update(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.update_success_message, output.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class PostalReceiveEntryViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = PostalReceiveEntrySerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    create_success_message = "Postal receive record created successfully"
    update_success_message = "Record updated successfully"
    permission_codes = {
        "list": "admin_section.postal_receive.view",
        "retrieve": "admin_section.postal_receive.view",
        "create": "admin_section.postal_receive.add",
        "update": "admin_section.postal_receive.edit",
        "partial_update": "admin_section.postal_receive.edit",
        "destroy": "admin_section.postal_receive.delete",
    }

    def get_queryset(self):
        user = self.request.user
        qs = PostalReceiveEntry.objects.select_related("school", "created_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        serializer.save(school=school, created_by=user)


class PostalDispatchEntryViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = PostalDispatchEntrySerializer
    pagination_class = ApiPageNumberPagination
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    create_success_message = "Postal dispatch record created successfully"
    update_success_message = "Record updated successfully"
    permission_codes = {
        "list": "admin_section.postal_dispatch.view",
        "retrieve": "admin_section.postal_dispatch.view",
        "create": "admin_section.postal_dispatch.add",
        "update": "admin_section.postal_dispatch.edit",
        "partial_update": "admin_section.postal_dispatch.edit",
        "destroy": "admin_section.postal_dispatch.delete",
    }

    def get_queryset(self):
        user = self.request.user
        qs = PostalDispatchEntry.objects.select_related("school", "created_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        serializer.save(school=school, created_by=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_create(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        headers = self.get_success_headers(serializer.data)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.create_success_message, output.data, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_update(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.update_success_message, output.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class PhoneCallLogEntryViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = PhoneCallLogEntrySerializer
    permission_classes = [permissions.IsAuthenticated]
    create_success_message = "Phone call log added successfully"
    update_success_message = "Record updated successfully"
    permission_codes = {
        "list": "admin_section.phone_call_log.view",
        "retrieve": "admin_section.phone_call_log.view",
        "create": "admin_section.phone_call_log.add",
        "update": "admin_section.phone_call_log.edit",
        "partial_update": "admin_section.phone_call_log.edit",
        "destroy": "admin_section.phone_call_log.delete",
    }

    def get_queryset(self):
        user = self.request.user
        qs = PhoneCallLogEntry.objects.select_related("school", "created_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        serializer.save(school=school, created_by=user)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_create(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        headers = self.get_success_headers(serializer.data)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.create_success_message, output.data, status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._validation_response(field_errors, self._first_error_message(field_errors))
        try:
            self.perform_update(serializer)
        except IntegrityError as exc:
            return self._integrity_response(exc)
        output = self.get_serializer(serializer.instance)
        return self._success_response(self.update_success_message, output.data)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class AdminSetupEntryViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = AdminSetupEntrySerializer
    pagination_class = AdminSetupPagination
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {
        "list": "admin_section.admin_setup.view",
        "retrieve": "admin_section.admin_setup.view",
        "create": "admin_section.admin_setup.add",
        "update": "admin_section.admin_setup.edit",
        "partial_update": "admin_section.admin_setup.edit",
        "destroy": "admin_section.admin_setup.delete",
    }

    def get_queryset(self):
        user = self.request.user
        qs = AdminSetupEntry.objects.select_related("school", "created_by")
        if user.is_superuser:
            scoped = qs
        elif user.school_id:
            scoped = qs.filter(school_id=user.school_id)
        else:
            return qs.none()

        type_filter = str(self.request.query_params.get("type", "")).strip()
        if type_filter in {"1", "2", "3", "4"}:
            scoped = scoped.filter(type=type_filter)

        return scoped

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        serializer.save(school=school, created_by=user)


class IdCardTemplateViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = IdCardTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_codes = {
        "list": "admin_section.id_card.view",
        "retrieve": "admin_section.id_card.view",
        "create": "admin_section.id_card.add",
        "update": "admin_section.id_card.edit",
        "partial_update": "admin_section.id_card.edit",
        "destroy": "admin_section.id_card.delete",
        "generate_setup": "admin_section.id_card.view",
        "recipients": "admin_section.id_card.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = IdCardTemplate.objects.select_related("school", "created_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        serializer.save(school=school, created_by=user)

    @action(detail=False, methods=["get"], url_path="generate-setup")
    def generate_setup(self, request):
        user = request.user

        templates = self.get_queryset()

        roles_qs = Role.objects.order_by("name")
        classes_qs = Class.objects.order_by("numeric_order", "name")
        sections_qs = Section.objects.select_related("school_class").order_by("name")

        if not user.is_superuser:
            roles_qs = roles_qs.filter(school_id=user.school_id) | roles_qs.filter(school__isnull=True)
            classes_qs = classes_qs.filter(school_id=user.school_id)
            sections_qs = sections_qs.filter(school_class__school_id=user.school_id)

        role_rows = []
        for role in roles_qs.distinct():
            role_rows.append({"id": role.id, "name": role.name})

        class_rows = []
        for row in classes_qs:
            class_rows.append({"id": row.id, "name": row.name})

        section_rows = []
        for row in sections_qs:
            section_rows.append({"id": row.id, "school_class": row.school_class_id, "name": row.name})

        serialized_templates = self.get_serializer(templates, many=True).data

        return Response(
            {
                "roles": role_rows,
                "classes": class_rows,
                "sections": section_rows,
                "templates": serialized_templates,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="recipients")
    def recipients(self, request):
        user = request.user
        role_id = request.query_params.get("role")
        class_id = request.query_params.get("class")
        section_id = request.query_params.get("section")

        if not role_id:
            return Response({"detail": "role query param is required."}, status=status.HTTP_400_BAD_REQUEST)

        role = Role.objects.filter(id=role_id).first()
        if not role:
            return Response({"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)

        is_student_role = str(role.id) == "2" or role.name.lower().find("student") >= 0

        if is_student_role:
            students_qs = Student.objects.select_related("current_class", "current_section")
            if not user.is_superuser:
                students_qs = students_qs.filter(school_id=user.school_id)
            if class_id:
                students_qs = students_qs.filter(current_class_id=class_id)
            if section_id:
                students_qs = students_qs.filter(current_section_id=section_id)

            rows = []
            for student in students_qs.order_by("first_name", "last_name"):
                label = f"{(student.first_name or '').strip()} {(student.last_name or '').strip()}".strip() or f"Student #{student.id}"
                rows.append(
                    {
                        "id": student.id,
                        "label": label,
                        "admission_no": student.admission_no or "",
                        "roll_no": student.roll_no or "",
                        "className": student.current_class.name if student.current_class else "",
                        "sectionName": student.current_section.name if student.current_section else "",
                        "gender": student.gender or "",
                        "dateOfBirth": student.date_of_birth,
                    }
                )

            paginator = ApiPageNumberPagination()
            page = paginator.paginate_queryset(rows, request, view=self)
            if page is not None:
                response = paginator.get_paginated_response(page)
                response.data["is_student_role"] = True
                return response

            return Response({"is_student_role": True, "recipients": rows}, status=status.HTTP_200_OK)

        user_role_qs = UserRole.objects.select_related("user", "role").filter(role_id=role.id)
        if not user.is_superuser:
            user_role_qs = user_role_qs.filter(role__school_id=user.school_id)

        seen = set()
        rows = []
        for row in user_role_qs.order_by("user_id"):
            if row.user_id in seen:
                continue
            seen.add(row.user_id)
            full_name = f"{(row.user.first_name or '').strip()} {(row.user.last_name or '').strip()}".strip()
            rows.append({"id": row.user_id, "label": full_name or row.user.username})

        paginator = ApiPageNumberPagination()
        page = paginator.paginate_queryset(rows, request, view=self)
        if page is not None:
            response = paginator.get_paginated_response(page)
            response.data["is_student_role"] = False
            return response

        return Response({"is_student_role": False, "recipients": rows}, status=status.HTTP_200_OK)


class CertificateTemplateViewSet(AdminSectionRBACMixin, DuplicateSafeWriteMixin, viewsets.ModelViewSet):
    serializer_class = CertificateTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_codes = {
        "list": "admin_section.certificate.view",
        "retrieve": "admin_section.certificate.view",
        "create": "admin_section.certificate.add",
        "update": "admin_section.certificate.edit",
        "partial_update": "admin_section.certificate.edit",
        "destroy": "admin_section.certificate.delete",
        "generate_setup": "admin_section.generate_certificate.view",
        "recipients": "admin_section.generate_certificate.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = CertificateTemplate.objects.select_related("school", "created_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        serializer.save(school=school, created_by=user)

    @action(detail=False, methods=["get"], url_path="generate-setup")
    def generate_setup(self, request):
        user = request.user

        templates = self.get_queryset()

        roles_qs = Role.objects.order_by("name")
        classes_qs = Class.objects.order_by("numeric_order", "name")
        sections_qs = Section.objects.select_related("school_class").order_by("name")

        if not user.is_superuser:
            roles_qs = roles_qs.filter(school_id=user.school_id) | roles_qs.filter(school__isnull=True)
            classes_qs = classes_qs.filter(school_id=user.school_id)
            sections_qs = sections_qs.filter(school_class__school_id=user.school_id)

        role_rows = []
        for role in roles_qs.distinct():
            role_rows.append({"id": role.id, "name": role.name})

        class_rows = []
        for row in classes_qs:
            class_rows.append({"id": row.id, "name": row.name})

        section_rows = []
        for row in sections_qs:
            section_rows.append({"id": row.id, "school_class": row.school_class_id, "name": row.name})

        serialized_templates = self.get_serializer(templates, many=True).data

        return Response(
            {
                "roles": role_rows,
                "classes": class_rows,
                "sections": section_rows,
                "templates": serialized_templates,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="recipients")
    def recipients(self, request):
        user = request.user
        role_id = request.query_params.get("role")
        class_id = request.query_params.get("class")
        section_id = request.query_params.get("section")

        if not role_id:
            return Response({"detail": "role query param is required."}, status=status.HTTP_400_BAD_REQUEST)

        role = Role.objects.filter(id=role_id).first()
        if not role:
            return Response({"detail": "Role not found."}, status=status.HTTP_404_NOT_FOUND)

        is_student_role = role.name.lower().find("student") >= 0 or str(role.id) == "2"

        if is_student_role:
            students_qs = Student.objects.select_related("current_class", "current_section")
            if not user.is_superuser:
                students_qs = students_qs.filter(school_id=user.school_id)
            if class_id:
                students_qs = students_qs.filter(current_class_id=class_id)
            if section_id:
                students_qs = students_qs.filter(current_section_id=section_id)

            rows = []
            for student in students_qs.order_by("first_name", "last_name"):
                label = f"{(student.first_name or '').strip()} {(student.last_name or '').strip()}".strip() or f"Student #{student.id}"
                rows.append(
                    {
                        "id": student.id,
                        "label": label,
                        "admission_no": student.admission_no or "",
                        "roll_no": student.roll_no or "",
                        "className": student.current_class.name if student.current_class else "",
                        "sectionName": student.current_section.name if student.current_section else "",
                        "gender": student.gender or "",
                        "dateOfBirth": student.date_of_birth,
                    }
                )

            return Response({"is_student_role": True, "recipients": rows}, status=status.HTTP_200_OK)

        user_role_qs = UserRole.objects.select_related("user", "role").filter(role_id=role.id)
        if not user.is_superuser:
            user_role_qs = user_role_qs.filter(role__school_id=user.school_id)

        seen = set()
        rows = []
        for row in user_role_qs.order_by("user_id"):
            if row.user_id in seen:
                continue
            seen.add(row.user_id)
            full_name = f"{(row.user.first_name or '').strip()} {(row.user.last_name or '').strip()}".strip()
            rows.append({"id": row.user_id, "label": full_name or row.user.username})

        return Response({"is_student_role": False, "recipients": rows}, status=status.HTTP_200_OK)


class CertificateReadOnlyViewSet(AdminSectionRBACMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only API for listing and retrieving certificates."""
    serializer_class = CertificateTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {
        "list": "admin_section.certificate.view",
        "retrieve": "admin_section.certificate.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = CertificateTemplate.objects.select_related("school", "created_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()


class IdCardReadOnlyViewSet(AdminSectionRBACMixin, mixins.ListModelMixin, mixins.RetrieveModelMixin, viewsets.GenericViewSet):
    """Read-only API for listing and retrieving ID card templates."""
    serializer_class = IdCardTemplateSerializer
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {
        "list": "admin_section.id_card.view",
        "retrieve": "admin_section.id_card.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = IdCardTemplate.objects.select_related("school", "created_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()
