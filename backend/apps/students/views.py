from django.db import IntegrityError, transaction
import logging
import csv
import io
import os
import re
from uuid import uuid4
from datetime import datetime
from django.conf import settings
from django.http import HttpResponse
from django.core.cache import cache
from django.core.files.storage import default_storage
from django.utils import timezone
from django.db.models.deletion import ProtectedError
from django.db.models import Count, Q
import requests
from rest_framework import permissions, status, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from .forms import StudentValidationModelForm
from .models import (
    Guardian,
    Student,
    StudentCategory,
    StudentDocument,
    StudentGroup,
    StudentMultiClassRecord,
    StudentRecordAudit,
    StudentSubjectAssignment,
    StudentPromotionHistory,
    StudentTransferHistory,
)
from .serializers import (
    GuardianSerializer,
    StudentCategorySerializer,
    StudentDocumentSerializer,
    StudentGroupSerializer,
    StudentMultiClassBulkSaveSerializer,
    StudentMultiClassRecordSerializer,
    StudentRecordAuditSerializer,
    StudentSubjectAssignmentRequestSerializer,
    StudentSubjectAssignmentSerializer,
    StudentPromoteRequestSerializer,
    StudentPromotionHistorySerializer,
    PincodeLookupQuerySerializer,
    StudentListSerializer,
    StudentSerializer,
    StudentTransferHistorySerializer,
)


logger = logging.getLogger(__name__)


class TenantScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ApiPageNumberPagination
    model = None
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
        user = self.request.user
        qs = self.model.objects.all()
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        school = self.request.user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        if school:
            serializer.save(school=school)
            return
        # Superuser without school can provide school explicitly in payload
        serializer.save()

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            raise ValidationError({"detail": "Duplicate value violates a uniqueness constraint."})

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except IntegrityError:
            raise ValidationError({"detail": "Duplicate value violates a uniqueness constraint."})

    def partial_update(self, request, *args, **kwargs):
        try:
            return super().partial_update(request, *args, **kwargs)
        except IntegrityError:
            raise ValidationError({"detail": "Duplicate value violates a uniqueness constraint."})


class StudentCategoryViewSet(TenantScopedModelViewSet):
    model = StudentCategory
    serializer_class = StudentCategorySerializer
    pagination_class = ApiPageNumberPagination
    permission_codes = {"*": "student_info.student_category.view"}

    def _restore_soft_deleted_category(self, request, validated_data):
        school_id = getattr(getattr(request, "user", None), "school_id", None)
        if not school_id:
            school = getattr(request, "school", None)
            school_id = getattr(school, "id", None)
        if not school_id:
            return None

        name = str(validated_data.get("name") or "").strip()
        code = str(validated_data.get("code") or "").strip()
        deleted_qs = StudentCategory.objects.filter(school_id=school_id, is_deleted=True)

        name_match = deleted_qs.filter(name__iexact=name).order_by("-id").first() if name else None
        code_match = deleted_qs.filter(code__iexact=code).order_by("-id").first() if code else None

        if name_match and code_match and name_match.id != code_match.id:
            raise ValidationError({"detail": "A deleted category with matching name/code conflict exists."})

        target = name_match or code_match
        if not target:
            return None

        target.name = name
        target.code = validated_data.get("code")
        target.description = validated_data.get("description") or ""
        target.status = validated_data.get("status") or "active"
        target.is_deleted = False
        target.deleted_at = None
        target.deleted_by = None
        target.save(
            update_fields=[
                "name",
                "code",
                "description",
                "status",
                "is_deleted",
                "deleted_at",
                "deleted_by",
            ]
        )
        return target

    def _build_validation_error_response(self, field_errors=None, message="Validation failed"):
        return Response(
            {
                "success": False,
                "error_code": "VALIDATION_ERROR",
                "message": message,
                "field_errors": field_errors or {},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _normalize_field_errors(self, serializer_errors):
        normalized = {}
        for field, errors in serializer_errors.items():
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

    def _fallback_category_description(self, name, code=None, students_count=0):
        safe_name = str(name or "").strip() or "this category"
        safe_code = str(code or "").strip()
        count = max(0, int(students_count or 0))

        usage_line = (
            f"This category currently covers {count} enrolled student{'s' if count != 1 else ''}."
            if count
            else "Use this category to group students consistently across admissions, fees, and reporting."
        )
        code_line = f" Category code: {safe_code}." if safe_code else ""
        return (
            f"Category for {safe_name.lower()} used in admissions, fees, and academic reports."
            f"{code_line} {usage_line}"
        ).strip()

    def _generate_category_description_with_ai(self, name, code=None, students_count=0):
        fallback = self._fallback_category_description(name, code, students_count)
        if not getattr(settings, "CATEGORY_AI_SUGGESTION_ENABLED", False):
            return fallback, "fallback"

        api_key = getattr(settings, "CATEGORY_AI_OPENAI_API_KEY", "")
        endpoint = getattr(settings, "CATEGORY_AI_OPENAI_ENDPOINT", "")
        model = getattr(settings, "CATEGORY_AI_OPENAI_MODEL", "gpt-4o-mini")

        if not api_key or not endpoint:
            return fallback, "fallback"

        prompt = (
            "Write one concise admin-ready category description (max 220 characters). "
            "Use neutral professional language for school ERP. "
            "Return only the description text without quotes or markdown.\n"
            f"Category: {name}\n"
            f"Code: {code or 'N/A'}\n"
            f"Students Count: {students_count or 0}"
        )

        try:
            response = requests.post(
                endpoint,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": [
                        {
                            "role": "system",
                            "content": "You create short and practical school ERP descriptions.",
                        },
                        {
                            "role": "user",
                            "content": prompt,
                        },
                    ],
                    "temperature": 0.3,
                    "max_tokens": 120,
                },
                timeout=8,
            )
            if not response.ok:
                logger.warning("AI suggestion request failed: %s", response.text[:300])
                return fallback, "fallback"

            data = response.json() if response.content else {}
            choices = data.get("choices") if isinstance(data, dict) else []
            message = (
                ((choices or [])[0] or {}).get("message", {}).get("content", "")
                if isinstance(choices, list)
                else ""
            )
            suggestion = str(message or "").strip().replace("\n", " ")
            if not suggestion:
                return fallback, "fallback"

            return suggestion[:500], "ai"
        except Exception as exc:
            logger.warning("AI suggestion error: %s", exc)
            return fallback, "fallback"

    def get_queryset(self):
        qs = super().get_queryset().filter(is_deleted=False).annotate(
            students_count=Count(
                "students",
                filter=Q(students__is_deleted=False),
                distinct=True,
            )
        ).order_by("name")
        params = self.request.query_params
        search = str(params.get("search") or params.get("q") or "").strip()
        status_filter = str(params.get("status") or "").strip().lower()
        name_filter = str(params.get("name") or "").strip()
        attention_filter = str(params.get("attention") or "").strip().lower() in {"1", "true", "yes"}

        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(code__icontains=search)
                | Q(description__icontains=search)
            )
        if name_filter:
            qs = qs.filter(name__icontains=name_filter)
        if status_filter in {"active", "inactive"}:
            qs = qs.filter(status=status_filter)
        if attention_filter:
            qs = qs.filter(
                Q(code__isnull=True)
                | Q(code="")
                | Q(description__isnull=True)
                | Q(description="")
            )
        return qs

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        qs = self.get_queryset()
        total_count = qs.count()
        active_count = qs.filter(status="active").count()
        inactive_count = qs.filter(status="inactive").count()
        attention_count = qs.filter(
            Q(code__isnull=True)
            | Q(code="")
            | Q(description__isnull=True)
            | Q(description="")
        ).count()

        top_categories = list(
            qs.order_by("-students_count", "name").values("id", "name", "students_count")[:7]
        )
        total_students = sum(int(item.get("students_count") or 0) for item in top_categories)

        recent_activity = []
        for category in qs.order_by("-created_at")[:5]:
            recent_activity.append(
                {
                    "id": category.id,
                    "name": category.name,
                    "action": "created",
                    "status": category.status,
                    "created_at": category.created_at,
                }
            )

        return Response(
            {
                "success": True,
                "total_count": total_count,
                "active_count": active_count,
                "inactive_count": inactive_count,
                "attention_count": attention_count,
                "top_categories": top_categories,
                "top_total_students": total_students,
                "recent_activity": recent_activity,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="export")
    def export(self, request):
        qs = self.get_queryset().order_by("name")

        buffer = io.StringIO()
        writer = csv.writer(buffer)
        writer.writerow(["Category", "Code", "Students", "Status", "Description", "Created At"])

        for category in qs:
            writer.writerow(
                [
                    category.name,
                    category.code or "",
                    category.students_count or 0,
                    category.status,
                    category.description or "",
                    timezone.localtime(category.created_at).strftime("%Y-%m-%d %H:%M:%S") if category.created_at else "",
                ]
            )

        filename = f"student_categories_{timezone.now().strftime('%Y%m%d_%H%M%S')}.csv"
        response = HttpResponse(buffer.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response

    @action(detail=False, methods=["get"], url_path="check-name")
    def check_name(self, request):
        name = str(request.query_params.get("name") or "").strip()
        if not name:
            return Response({"success": False, "message": "Category name is required."}, status=status.HTTP_400_BAD_REQUEST)

        queryset = self.get_queryset().filter(name__iexact=name)
        if getattr(self, "action", None) == "check_name" and self.request.query_params.get("exclude_id"):
            queryset = queryset.exclude(id=self.request.query_params.get("exclude_id"))
        exists = queryset.exists()
        return Response({"success": True, "exists": exists, "message": "Category exists." if exists else "Category available."})

    @action(detail=False, methods=["get"], url_path="check-code")
    def check_code(self, request):
        code = str(request.query_params.get("code") or "").strip()
        if not code:
            return Response({"success": True, "exists": False, "message": "Code is optional."})

        queryset = self.get_queryset().filter(code__iexact=code)
        if request.query_params.get("exclude_id"):
            queryset = queryset.exclude(id=request.query_params.get("exclude_id"))
        exists = queryset.exists()
        return Response({"success": True, "exists": exists, "message": "Code exists." if exists else "Code available."})

    @action(detail=False, methods=["post"], url_path="ai-description-suggestion")
    def ai_description_suggestion(self, request):
        name = str(request.data.get("name") or "").strip()
        code = str(request.data.get("code") or "").strip()
        students_count = request.data.get("students_count") or 0

        if not name:
            return Response(
                {
                    "success": False,
                    "message": "Category name is required to generate description.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        suggestion, source = self._generate_category_description_with_ai(
            name=name,
            code=code,
            students_count=students_count,
        )

        return Response(
            {
                "success": True,
                "suggestion": suggestion,
                "source": source,
                "message": "Suggestion generated successfully.",
            },
            status=status.HTTP_200_OK,
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._build_validation_error_response(field_errors, self._first_error_message(field_errors))

        try:
            restored = self._restore_soft_deleted_category(request, serializer.validated_data)
        except ValidationError as exc:
            details = exc.detail if isinstance(exc.detail, dict) else {"detail": [str(exc.detail)]}
            field_errors = self._normalize_field_errors(details)
            return self._build_validation_error_response(field_errors, self._first_error_message(field_errors))
        except IntegrityError:
            return self._build_validation_error_response(
                {"name": ["Category name already exists."]},
                "Category name already exists.",
            )

        if restored:
            response_serializer = self.get_serializer(restored)
            headers = self.get_success_headers(response_serializer.data)
            return Response(
                {
                    "success": True,
                    "message": "Student category restored successfully.",
                    "data": response_serializer.data,
                },
                status=status.HTTP_201_CREATED,
                headers=headers,
            )

        try:
            self.perform_create(serializer)
        except IntegrityError:
            return self._build_validation_error_response(
                {"name": ["Category name already exists."]},
                "Category name already exists.",
            )

        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                "success": True,
                "message": "Student category created successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._build_validation_error_response(field_errors, self._first_error_message(field_errors))

        try:
            self.perform_update(serializer)
        except IntegrityError:
            return self._build_validation_error_response(
                {"name": ["Category name already exists."]},
                "Category name already exists.",
            )

        return Response(
            {
                "success": True,
                "message": "Student category updated successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=["patch"], url_path="bulk-status")
    def bulk_status(self, request):
        ids = request.data.get("ids") or []
        status_value = str(request.data.get("status") or "").strip().lower()
        if status_value not in {"active", "inactive"}:
            return self._build_validation_error_response({}, "Status must be either active or inactive.")
        if not isinstance(ids, list) or not ids:
            return self._build_validation_error_response({}, "Select at least one category.")

        queryset = self.get_queryset().filter(id__in=ids)
        already_count = queryset.filter(status=status_value).count()
        update_queryset = queryset.exclude(status=status_value)
        updated = update_queryset.update(status=status_value)

        if updated == 0:
            message = f"Selected categories are already {status_value}."
        elif already_count == 0:
            noun = "category" if updated == 1 else "categories"
            message = f"{updated} {noun} updated successfully."
        else:
            updated_noun = "category" if updated == 1 else "categories"
            already_noun = "category is" if already_count == 1 else "categories are"
            message = (
                f"{updated} {updated_noun} updated successfully. "
                f"{already_count} {already_noun} already {status_value}."
            )

        return Response({"success": True, "message": message})

    @action(detail=True, methods=["patch"], url_path="deactivate")
    def deactivate(self, request, pk=None):
        """
        Production-grade deactivate endpoint.
        Sets is_active=False while preserving historical data.
        
        Returns:
        - 200 OK on success
        - 404 Not Found if category doesn't exist
        - 400 Bad Request if category is already inactive
        """
        try:
            instance = self.get_object()
        except Exception:
            return Response(
                {
                    "success": False,
                    "message": "Category not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        if not instance.is_active and str(instance.status).lower() == "inactive":
            return Response(
                {
                    "success": False,
                    "message": "Category is already deactivated.",
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            instance.is_active = False
            instance.status = "inactive"
            instance.save(update_fields=["is_active", "status"])

            return Response(
                {
                    "success": True,
                    "message": "Category deactivated successfully.",
                    "data": StudentCategorySerializer(instance, context={"request": request}).data,
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"Error deactivating category {instance.id}: {str(e)}")
            return Response(
                {
                    "success": False,
                    "message": "Something went wrong. Please try again later.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

    @action(detail=False, methods=["delete"], url_path="bulk-delete")
    def bulk_delete(self, request):
        ids = request.data.get("ids") or []
        if not isinstance(ids, list) or not ids:
            return self._build_validation_error_response({}, "Select at least one category.")

        queryset = self.get_queryset().filter(id__in=ids)
        blocked = queryset.filter(students__isnull=False).distinct()
        if blocked.exists():
            return self._build_validation_error_response({}, "Students are assigned to one or more selected categories.")

        count = queryset.count()
        queryset.delete()
        return Response({"success": True, "message": f"{count} categories deleted successfully."}, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        """
        Production-grade delete endpoint with conflict handling.
        
        Returns:
        - 409 Conflict if students are assigned to the category
        - 404 Not Found if category doesn't exist
        - 200 OK if deletion is successful
        """
        try:
            instance = self.get_object()
        except Exception:
            return Response(
                {
                    "success": False,
                    "message": "Category not found.",
                },
                status=status.HTTP_404_NOT_FOUND,
            )

        # Check if students are assigned to this category
        student_count = instance.students.filter(is_deleted=False).count()
        if student_count > 0:
            return Response(
                {
                    "success": False,
                    "code": "CATEGORY_IN_USE",
                    "message": "This category is assigned to students and cannot be deleted.",
                    "details": "Please reassign students or deactivate the category instead.",
                    "student_count": student_count,
                    "suggested_action": "deactivate",
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            # Perform soft delete instead of hard delete for audit trail
            instance.is_deleted = True
            instance.deleted_at = timezone.now()
            instance.deleted_by = request.user
            instance.save(update_fields=["is_deleted", "deleted_at", "deleted_by"])

            return Response(
                {
                    "success": True,
                    "message": "Category deleted successfully.",
                },
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            logger.error(f"Error deleting category {instance.id}: {str(e)}")
            return Response(
                {
                    "success": False,
                    "message": "Something went wrong. Please try again later.",
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class StudentGroupViewSet(TenantScopedModelViewSet):
    model = StudentGroup
    serializer_class = StudentGroupSerializer
    pagination_class = ApiPageNumberPagination
    permission_codes = {"*": "student_info.student_group.view"}

    def get_queryset(self):
        user = self.request.user
        qs = StudentGroup.objects.all()
        search = str(self.request.query_params.get("search") or "").strip()
        sort_by = str(self.request.query_params.get("sort_by") or "name").strip().lower()

        if user.is_superuser:
            qs = qs.annotate(students_count=Count("students", distinct=True))
        elif user.school_id:
            qs = qs.filter(school_id=user.school_id).annotate(students_count=Count("students", distinct=True))
        else:
            return qs.none()

        if search:
            qs = qs.filter(name__icontains=search)

        if sort_by == "count":
            return qs.order_by("-students_count", "name")

        return qs.order_by("name")

    def destroy(self, request, *args, **kwargs):
        """
        Delete a student group.
        
        Returns 400 error if the group has assigned students.
        """
        instance = self.get_object()
        
        # Check if group has assigned students
        if instance.students.exists():
            return Response(
                {
                    "success": False,
                    "message": f"Cannot delete group with assigned students. This group has {instance.students.count()} students assigned.",
                    "field_errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Proceed with deletion
        self.perform_destroy(instance)
        
        return Response(
            {
                "success": True,
                "message": "Student group deleted successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=True, methods=["post"], url_path="assign-students")
    def assign_students(self, request, *args, **kwargs):
        group = self.get_object()
        raw_ids = request.data.get("student_ids")
        if not isinstance(raw_ids, list) or not raw_ids:
            return Response(
                {"success": False, "message": "student_ids is required.", "field_errors": {"student_ids": "Select at least one student."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        valid_ids = []
        for value in raw_ids:
            try:
                valid_ids.append(int(value))
            except (TypeError, ValueError):
                continue

        if not valid_ids:
            return Response(
                {"success": False, "message": "No valid student ids provided.", "field_errors": {"student_ids": "Invalid student ids."}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        students_qs = Student.objects.filter(id__in=valid_ids)
        if not request.user.is_superuser:
            students_qs = students_qs.filter(school_id=request.user.school_id)

        updated = students_qs.update(student_group=group)
        return Response(
            {
                "success": True,
                "message": f"{updated} student(s) assigned to group successfully.",
                "updated": updated,
            },
            status=status.HTTP_200_OK,
        )


class GuardianViewSet(TenantScopedModelViewSet):
    model = Guardian
    serializer_class = GuardianSerializer
    pagination_class = ApiPageNumberPagination
    permission_codes = {"*": "student_info.add_student.view"}


class StudentViewSet(TenantScopedModelViewSet):
    model = Student
    serializer_class = StudentSerializer
    pagination_class = ApiPageNumberPagination
    permission_codes = {
        "list": "student_info.student_list.view",
        "retrieve": "student_info.student_list.view",
        "create": "student_info.add_student.view",
        "update": "student_info.add_student.view",
        "partial_update": "student_info.add_student.view",
        "next_admission_no": "student_info.add_student.view",
        "check_admission_no": "student_info.add_student.view",
        "upload_photo": "student_info.add_student.view",
        "pincode_details": "student_info.add_student.view",
        "destroy": "student_info.delete_student_record.view",
        "soft_delete": "student_info.delete_student_record.view",
        "restore": "student_info.delete_student_record.view",
        "permanent_delete": "student_info.delete_student_record.view",
        "promote": "student_info.student_promote.view",
    }

    def get_serializer_class(self):
        if getattr(self, "action", None) == "list":
            return StudentListSerializer
        return super().get_serializer_class()

    def get_queryset(self):
        user = self.request.user
        action = getattr(self, "action", None)

        if action == "list":
            qs = Student.objects.select_related("current_class", "current_section", "guardian", "category", "student_group").only(
                "id",
                "school_id",
                "academic_year_id",
                "admission_no",
                "roll_no",
                "first_name",
                "last_name",
                "date_of_birth",
                "gender",
                "phone",
                "category_id",
                "student_group_id",
                "guardian_id",
                "current_class_id",
                "current_section_id",
                "status",
                "is_disabled",
                "is_active",
                "is_deleted",
                "created_at",
            )
        else:
            qs = Student.objects.select_related(
                "school",
                "academic_year",
                "category",
                "student_group",
                "guardian",
                "current_class",
                "current_section",
                "admission_inquiry",
            )

        if action in {"retrieve", "create", "update", "partial_update"}:
            qs = qs.prefetch_related("documents")

        search = (self.request.query_params.get("search") or "").strip()
        class_id = self.request.query_params.get("class") or self.request.query_params.get("current_class")
        section_id = self.request.query_params.get("section") or self.request.query_params.get("current_section")
        academic_year_id = self.request.query_params.get("academic_year")
        is_active_param = (self.request.query_params.get("is_active") or "").strip().lower()
        include_deleted = (self.request.query_params.get("include_deleted") or "").strip().lower() in {"1", "true", "yes"}
        deleted_only = (self.request.query_params.get("deleted_only") or "").strip().lower() in {"1", "true", "yes"}
        unassigned_only = (self.request.query_params.get("unassigned") or "").strip().lower() in {"1", "true", "yes"}

        if deleted_only:
            qs = qs.filter(is_deleted=True)
        elif not include_deleted:
            qs = qs.filter(is_deleted=False)

        if search and not re.fullmatch(r"[A-Za-z0-9 _\-./]+", search):
            raise ValidationError({"search": "Please enter valid search text"})

        if class_id and not str(class_id).isdigit():
            raise ValidationError({"current_class": "Please select a valid class."})
        if section_id and not str(section_id).isdigit():
            raise ValidationError({"current_section": "Please select a valid section."})
        if academic_year_id and not str(academic_year_id).isdigit():
            raise ValidationError({"academic_year": "Please select a valid academic year."})

        from apps.core.models import AcademicYear, Class, Section

        if class_id:
            class_qs = Class.objects.filter(id=int(class_id))
            if not user.is_superuser:
                class_qs = class_qs.filter(school_id=user.school_id)
            if not class_qs.exists():
                raise ValidationError({"current_class": "Selected class is not available."})

        if section_id:
            section_qs = Section.objects.filter(id=int(section_id))
            if class_id:
                section_qs = section_qs.filter(school_class_id=int(class_id))
            if not user.is_superuser:
                section_qs = section_qs.filter(school_class__school_id=user.school_id)
            if not section_qs.exists():
                raise ValidationError({"current_section": "Selected section is not available."})

        if academic_year_id:
            year_qs = AcademicYear.objects.filter(id=int(academic_year_id))
            if not user.is_superuser:
                year_qs = year_qs.filter(school_id=user.school_id)
            if not year_qs.exists():
                raise ValidationError({"academic_year": "Selected academic year is not available."})

        if class_id:
            qs = qs.filter(current_class_id=class_id)
        if section_id:
            qs = qs.filter(current_section_id=section_id)
        if unassigned_only:
            qs = qs.filter(current_class_id__isnull=True, current_section_id__isnull=True)
        if academic_year_id:
            qs = qs.filter(academic_year_id=academic_year_id)
        if is_active_param in {"1", "true", "yes"}:
            qs = qs.filter(is_active=True)
        elif is_active_param in {"0", "false", "no"}:
            qs = qs.filter(is_active=False)
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(admission_no__icontains=search)
                | Q(roll_no__icontains=search)
            )

        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def _summary_queryset(self):
        user = self.request.user
        qs = Student.objects.all()

        if user.is_superuser:
            qs = qs
        elif user.school_id:
            qs = qs.filter(school_id=user.school_id)
        else:
            return qs.none()

        search = (self.request.query_params.get("search") or "").strip()
        class_id = self.request.query_params.get("class") or self.request.query_params.get("current_class")
        section_id = self.request.query_params.get("section") or self.request.query_params.get("current_section")
        academic_year_id = self.request.query_params.get("academic_year")
        is_active_param = (self.request.query_params.get("is_active") or "").strip().lower()
        include_deleted = (self.request.query_params.get("include_deleted") or "").strip().lower() in {"1", "true", "yes"}
        deleted_only = (self.request.query_params.get("deleted_only") or "").strip().lower() in {"1", "true", "yes"}
        unassigned_only = (self.request.query_params.get("unassigned") or "").strip().lower() in {"1", "true", "yes"}

        if search and not re.fullmatch(r"[A-Za-z0-9 _\-./]+", search):
            raise ValidationError({"search": "Please enter valid search text"})

        if deleted_only:
            qs = qs.filter(is_deleted=True)
        elif not include_deleted:
            qs = qs.filter(is_deleted=False)

        if class_id and not str(class_id).isdigit():
            raise ValidationError({"current_class": "Please select a valid class."})
        if section_id and not str(section_id).isdigit():
            raise ValidationError({"current_section": "Please select a valid section."})
        if academic_year_id and not str(academic_year_id).isdigit():
            raise ValidationError({"academic_year": "Please select a valid academic year."})

        from apps.core.models import AcademicYear, Class, Section

        if class_id:
            class_qs = Class.objects.filter(id=int(class_id))
            if not user.is_superuser:
                class_qs = class_qs.filter(school_id=user.school_id)
            if not class_qs.exists():
                raise ValidationError({"current_class": "Selected class is not available."})

        if section_id:
            section_qs = Section.objects.filter(id=int(section_id))
            if class_id:
                section_qs = section_qs.filter(school_class_id=int(class_id))
            if not user.is_superuser:
                section_qs = section_qs.filter(school_class__school_id=user.school_id)
            if not section_qs.exists():
                raise ValidationError({"current_section": "Selected section is not available."})

        if academic_year_id:
            year_qs = AcademicYear.objects.filter(id=int(academic_year_id))
            if not user.is_superuser:
                year_qs = year_qs.filter(school_id=user.school_id)
            if not year_qs.exists():
                raise ValidationError({"academic_year": "Selected academic year is not available."})

        if class_id:
            qs = qs.filter(current_class_id=class_id)
        if section_id:
            qs = qs.filter(current_section_id=section_id)
        if unassigned_only:
            qs = qs.filter(current_class_id__isnull=True, current_section_id__isnull=True)
        if academic_year_id:
            qs = qs.filter(academic_year_id=academic_year_id)
        if is_active_param in {"1", "true", "yes"}:
            qs = qs.filter(is_active=True)
        elif is_active_param in {"0", "false", "no"}:
            qs = qs.filter(is_active=False)
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(admission_no__icontains=search)
                | Q(roll_no__icontains=search)
            )

        return qs

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request, *args, **kwargs):
        base_qs = self._summary_queryset()
        non_deleted_qs = base_qs.filter(is_deleted=False)
        archived_qs = base_qs.filter(is_deleted=True)

        now = timezone.now()
        first_day_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

        total_count = non_deleted_qs.count()
        active_count = non_deleted_qs.filter(is_active=True).count()
        inactive_count = non_deleted_qs.filter(is_active=False).count()
        archived_count = archived_qs.count()
        new_count = non_deleted_qs.filter(created_at__gte=first_day_of_month).count()
        docs_pending_count = non_deleted_qs.filter(Q(phone__isnull=True) | Q(phone="") | Q(date_of_birth__isnull=True) | Q(is_disabled=True)).count()

        return Response(
            {
                "success": True,
                "message": "Student summary retrieved successfully",
                "data": {
                    "total_count": total_count,
                    "active_count": active_count,
                    "inactive_count": inactive_count,
                    "archived_count": archived_count,
                    "new_count": new_count,
                    "docs_pending_count": docs_pending_count,
                },
            },
            status=status.HTTP_200_OK,
        )

    def _field_alias(self, field):
        aliases = {
            "current_class": "class",
            "current_section": "section",
            "date_of_birth": "dob",
        }
        return aliases.get(field, field)

    def _normalize_pincode_office(self, office):
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

    def _city_from_post_office_name(self, office):
        raw_name = str((office or {}).get("name") or "").strip()
        if not raw_name:
            return ""

        # Remove common India Post branch suffixes so UI gets clean city-like values.
        cleaned = re.sub(r"\s*[-(]?\s*(?:S\.?O|B\.?O|H\.?O|G\.?P\.?O|SO|BO|HO|GPO)\s*[).-]*\s*$", "", raw_name, flags=re.IGNORECASE)
        return cleaned.strip()

    def _fetch_pincode_details(self, pincode):
        cache_key = f"student_pincode_details:v2:{pincode}"
        cached = cache.get(cache_key)
        if cached:
            return cached

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
            "Accept": "application/json",
        }
        response = requests.get(f"https://api.postalpincode.in/pincode/{pincode}", timeout=8, headers=headers)
        response.raise_for_status()
        payload = response.json()

        if not isinstance(payload, list) or not payload:
            raise ValidationError({"pincode": "Invalid PIN Code"})

        entry = payload[0] or {}
        if str(entry.get("Status") or "").strip().lower() != "success":
            raise ValidationError({"pincode": "Invalid PIN Code"})

        offices = entry.get("PostOffice") or []
        normalized_offices = [self._normalize_pincode_office(office) for office in offices if office]
        normalized_offices = [office for office in normalized_offices if office.get("name")]

        if not normalized_offices:
            raise ValidationError({"pincode": "Invalid PIN Code"})

        selected_office = next((office for office in normalized_offices if office.get("district")), normalized_offices[0])
        district = str(selected_office.get("district") or "").strip()
        state = str(selected_office.get("state") or "").strip()

        if not district or not state:
            raise ValidationError({"pincode": "Invalid PIN Code"})

        city_options = []
        for office in normalized_offices:
            city_candidate = self._city_from_post_office_name(office)
            if city_candidate:
                city_options.append(city_candidate)

        # District fallback only when post-office names are unavailable.
        if not city_options and district:
            city_options = [district]

        city_options = sorted(set(city_options), key=lambda value: value.lower())
        city = city_options[0] if city_options else ""

        result = {
            "pincode": pincode,
            "state": state,
            "district": district,
            "city": city,
            "city_options": city_options,
            "selected_post_office": selected_office,
            "post_offices": normalized_offices,
            "multiple_post_offices": len(normalized_offices) > 1,
        }
        cache.set(cache_key, result, 24 * 60 * 60)
        return result

    def _normalize_field_errors(self, serializer_errors):
        normalized = {}
        for field, errors in serializer_errors.items():
            key = self._field_alias(str(field))
            if isinstance(errors, (list, tuple)):
                normalized[key] = str(errors[0]) if errors else "Validation failed"
            else:
                normalized[key] = str(errors)
        return normalized

    def _validation_response(self, serializer_errors=None, message="Validation failed"):
        return Response(
            {
                "success": False,
                "message": message,
                "field_errors": self._normalize_field_errors(serializer_errors or {}),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _normalize_import_row(self, raw_row):
        key_aliases = {
            "admission no": "admission_no",
            "admission_no": "admission_no",
            "admission number": "admission_no",
            "admission_number": "admission_no",
            "roll no": "roll_no",
            "roll_no": "roll_no",
            "roll number": "roll_no",
            "roll_number": "roll_no",
            "first name": "first_name",
            "first_name": "first_name",
            "last name": "last_name",
            "last_name": "last_name",
            "dob": "date_of_birth",
            "date of birth": "date_of_birth",
            "date_of_birth": "date_of_birth",
            "academic year": "academic_year",
            "academic_year": "academic_year",
            "class": "current_class",
            "current class": "current_class",
            "current_class": "current_class",
            "section": "current_section",
            "current section": "current_section",
            "current_section": "current_section",
            "custom gender": "custom_gender",
            "custom_gender": "custom_gender",
            "blood group": "blood_group",
            "blood_group": "blood_group",
            "address": "address_line",
            "address line": "address_line",
            "address_line": "address_line",
            "pin": "pincode",
            "zip": "pincode",
            "postal code": "pincode",
            "postal_code": "pincode",
            "student category": "category",
            "student_category": "category",
        }

        cleaned = {}
        for key, value in (raw_row or {}).items():
            key_text = str(key or "").strip()
            if not key_text:
                continue
            normalized_key = key_aliases.get(key_text.lower(), key_text.replace(" ", "_").lower())

            value_text = "" if value is None else str(value).strip()
            if value_text == "":
                cleaned[normalized_key] = ""
                continue

            if normalized_key == "date_of_birth":
                parsed = None
                for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
                    try:
                        parsed = datetime.strptime(value_text, fmt).date().isoformat()
                        break
                    except ValueError:
                        continue
                cleaned[normalized_key] = parsed or value_text
                continue

            if normalized_key in {"academic_year", "current_class", "current_section", "category", "guardian"}:
                cleaned[normalized_key] = int(value_text) if value_text.isdigit() else value_text
                continue

            if normalized_key in {"is_active", "is_disabled"}:
                lowered = value_text.lower()
                if lowered in {"true", "1", "yes", "y"}:
                    cleaned[normalized_key] = True
                elif lowered in {"false", "0", "no", "n"}:
                    cleaned[normalized_key] = False
                else:
                    cleaned[normalized_key] = value_text
                continue

            cleaned[normalized_key] = value_text

        return cleaned

    def _duplicate_warning(self, validated_data):
        first_name = (validated_data.get("first_name") or "").strip()
        last_name = (validated_data.get("last_name") or "").strip()
        dob = validated_data.get("date_of_birth")
        phone = (validated_data.get("phone") or "").strip()
        if not (first_name and dob and phone):
            return None

        queryset = Student.objects.filter(
            school_id=self.request.user.school_id,
            first_name__iexact=first_name,
            last_name__iexact=last_name,
            date_of_birth=dob,
            phone=phone,
        )
        if queryset.exists():
            return "Possible duplicate found: same name, DOB and phone already exists"
        return None

    def _build_model_form_data(self, data):
        if hasattr(data, "dict"):
            raw_data = data.dict()
        else:
            raw_data = dict(data or {})

        normalized = {}
        for key, value in raw_data.items():
            if isinstance(value, (list, tuple)):
                normalized[str(key)] = value[-1] if value else ""
            else:
                normalized[str(key)] = value

        if "class" in normalized and "current_class" not in normalized:
            normalized["current_class"] = normalized.get("class")
        if "section" in normalized and "current_section" not in normalized:
            normalized["current_section"] = normalized.get("section")
        if "dob" in normalized and "date_of_birth" not in normalized:
            normalized["date_of_birth"] = normalized.get("dob")

        return normalized

    def _validate_with_model_form(self, data, instance=None, partial=False):
        form = StudentValidationModelForm(
            data=self._build_model_form_data(data),
            instance=instance,
            partial=partial,
            user=self.request.user,
        )
        if form.is_valid():
            return None
        return self._validation_response(form.errors)

    def create(self, request, *args, **kwargs):
        form_error_response = self._validate_with_model_form(request.data)
        if form_error_response:
            return form_error_response

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return self._validation_response(serializer.errors)

        warning = self._duplicate_warning(serializer.validated_data)

        try:
            self.perform_create(serializer)
        except IntegrityError:
            return self._validation_response({"admission_no": ["Admission number already exists"]})

        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                "success": True,
                "message": "Student added successfully",
                "warning": warning,
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()

        form_error_response = self._validate_with_model_form(request.data, instance=instance, partial=partial)
        if form_error_response:
            return form_error_response

        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return self._validation_response(serializer.errors)

        try:
            self.perform_update(serializer)
        except IntegrityError:
            return self._validation_response({"admission_no": ["Admission number already exists"]})

        return Response(
            {
                "success": True,
                "message": "Student updated successfully",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=["get"], url_path="next-admission-no")
    def next_admission_no(self, request):
        current_year = timezone.now().year
        prefix = f"ADM{current_year}"
        pattern = re.compile(rf"^{re.escape(prefix)}(\d+)$", re.IGNORECASE)

        max_sequence = 0
        queryset = Student.objects.all()
        user = request.user
        if not user.is_superuser:
            if not user.school_id:
                return Response(
                    {
                        "success": False,
                        "message": "Unable to determine school for admission number generation.",
                    },
                    status=status.HTTP_400_BAD_REQUEST,
                )
            queryset = queryset.filter(school_id=user.school_id)
        elif user.school_id:
            queryset = queryset.filter(school_id=user.school_id)

        queryset = queryset.filter(admission_no__istartswith=prefix).values_list("admission_no", flat=True)
        for value in queryset.iterator():
            match = pattern.match(str(value or "").strip())
            if not match:
                continue
            sequence = int(match.group(1))
            if sequence > max_sequence:
                max_sequence = sequence

        next_sequence = max_sequence + 1
        admission_no = f"{prefix}{next_sequence:04d}"

        return Response(
            {
                "success": True,
                "admission_no": admission_no,
                "sequence": next_sequence,
                "message": "Next admission number generated successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="check-admission-no")
    def check_admission_no(self, request):
        admission_no = str(request.query_params.get("admission_no") or "").strip()
        exclude_id = str(request.query_params.get("exclude_id") or "").strip()

        if not admission_no:
            return Response(
                {
                    "success": False,
                    "message": "Admission number is required.",
                    "field_errors": {"admission_no": "Admission number is required."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not re.fullmatch(r"[A-Za-z0-9]+", admission_no):
            return Response(
                {
                    "success": False,
                    "message": "Admission number should contain only letters and numbers.",
                    "field_errors": {"admission_no": "Admission number should contain only letters and numbers."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = self.get_queryset().filter(admission_no__iexact=admission_no)
        if exclude_id.isdigit():
            queryset = queryset.exclude(id=int(exclude_id))

        exists = queryset.exists()
        return Response(
            {
                "success": True,
                "exists": exists,
                "message": "Admission number already exists." if exists else "Admission number is available.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["get"], url_path="pincode-details")
    def pincode_details(self, request):
        serializer = PincodeLookupQuerySerializer(data=request.query_params)
        if not serializer.is_valid():
            field_errors = {}
            for field, errors in serializer.errors.items():
                field_errors[field] = [str(error) for error in (errors or [])] if isinstance(errors, (list, tuple)) else [str(errors)]
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

        try:
            data = self._fetch_pincode_details(pincode)
        except ValidationError as exc:
            message = "Invalid PIN Code"
            detail = exc.detail
            if isinstance(detail, dict):
                pincode_message = detail.get("pincode")
                if isinstance(pincode_message, list) and pincode_message:
                    message = str(pincode_message[0])
                elif isinstance(pincode_message, str):
                    message = pincode_message
            return Response(
                {
                    "success": False,
                    "message": message,
                    "field_errors": {"pincode": message},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except requests.RequestException:
            return Response(
                {
                    "success": False,
                    "message": "Unable to fetch pincode details right now.",
                    "field_errors": {"pincode": "Unable to fetch pincode details right now."},
                },
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )

        return Response(
            {
                "success": True,
                "message": "Pincode details fetched successfully.",
                "data": data,
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="upload-photo", parser_classes=[MultiPartParser, FormParser])
    def upload_photo(self, request):
        image = request.FILES.get("photo")
        if not image:
            return Response(
                {
                    "success": False,
                    "message": "Photo file is required.",
                    "field_errors": {"photo": "Photo file is required."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        allowed_types = {"image/jpeg", "image/png"}
        if image.content_type not in allowed_types:
            return Response(
                {
                    "success": False,
                    "message": "Only JPEG and PNG files are allowed.",
                    "field_errors": {"photo": "Only JPEG and PNG files are allowed."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        max_size_bytes = 2 * 1024 * 1024
        if image.size > max_size_bytes:
            return Response(
                {
                    "success": False,
                    "message": "Photo size must be 2MB or less.",
                    "field_errors": {"photo": "Photo size must be 2MB or less."},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        ext = os.path.splitext(image.name or "")[1].lower()
        if ext not in {".jpg", ".jpeg", ".png"}:
            ext = ".jpg" if image.content_type == "image/jpeg" else ".png"

        relative_path = f"student_photos/{uuid4().hex}{ext}"
        saved_path = default_storage.save(relative_path, image)
        normalized = str(saved_path).replace("\\", "/")
        media_prefix = settings.MEDIA_URL if settings.MEDIA_URL.endswith("/") else f"{settings.MEDIA_URL}/"
        photo_url = request.build_absolute_uri(f"{media_prefix}{normalized}")

        return Response(
            {
                "success": True,
                "message": "Photo uploaded successfully.",
                "data": {"photo": photo_url},
            },
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["post"], url_path="promote")
    def promote(self, request):
        serializer = StudentPromoteRequestSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        school_id = request.user.school_id
        if not school_id and not request.user.is_superuser:
            raise ValidationError("User school context is required.")

        target_class_id = data["to_class"]
        target_section_id = data.get("to_section")
        target_year_id = data.get("to_academic_year")

        from apps.core.models import AcademicYear, Class, Section

        # Validate target class/section/year belongs to same school for tenant safety
        class_qs = Class.objects.filter(id=target_class_id)
        if not request.user.is_superuser:
            class_qs = class_qs.filter(school_id=school_id)
        target_class = class_qs.first()
        if not target_class:
            raise ValidationError("Target class not found in your school.")

        if target_section_id:
            section_qs = Section.objects.filter(id=target_section_id, school_class_id=target_class_id)
            if not section_qs.exists():
                raise ValidationError("Target section not found under target class.")

        if target_year_id:
            year_qs = AcademicYear.objects.filter(id=target_year_id)
            if not request.user.is_superuser:
                year_qs = year_qs.filter(school_id=school_id)
            if not year_qs.exists():
                raise ValidationError("Target academic year not found in your school.")

        students_qs = Student.objects.filter(id__in=data["student_ids"])
        if not request.user.is_superuser:
            students_qs = students_qs.filter(school_id=school_id)
        students = list(students_qs)

        if not students:
            raise ValidationError("No students found for promotion.")

        # Track promoted count and errors for partial success
        promoted_count = 0
        failed_count = 0
        errors_list = []

        # Process each student individually to support partial success
        for st in students:
            try:
                # Validate: prevent promoting to same class
                if st.current_class_id == target_class_id:
                    failed_count += 1
                    errors_list.append({
                        "student_id": st.id,
                        "admission_no": st.admission_no,
                        "error": f"Cannot promote to the same class ({target_class.name})"
                    })
                    continue

                # Create promotion history
                StudentPromotionHistory.objects.create(
                    student=st,
                    from_class=st.current_class,
                    from_section=st.current_section,
                    to_class_id=target_class_id,
                    to_section_id=target_section_id,
                    to_academic_year_id=target_year_id,
                    note=data.get("note", ""),
                    promoted_by=request.user,
                )

                # Update student's current class and section
                st.current_class_id = target_class_id
                st.current_section_id = target_section_id
                st.save(update_fields=["current_class", "current_section", "updated_at"])
                promoted_count += 1

            except Exception as e:
                failed_count += 1
                errors_list.append({
                    "student_id": st.id,
                    "admission_no": st.admission_no,
                    "error": str(e)
                })
                continue

        # Return comprehensive response
        response_data = {
            "promoted": promoted_count,
            "failed": failed_count,
            "total": promoted_count + failed_count,
            "success": failed_count == 0
        }

        if errors_list:
            # Limit errors to first 50 for response
            response_data["errors"] = errors_list[:50]

        # Determine status code based on promotion success
        if promoted_count == 0:
            # Complete failure
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
        elif failed_count > 0:
            # Partial success
            return Response(response_data, status=status.HTTP_200_OK)
        else:
            # Complete success
            return Response(response_data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        return self.soft_delete(request, *args, **kwargs)

    def _linked_record_exists(self, student):
        from apps.attendance.models import StudentAttendance, SubjectAttendance
        from apps.exams.models import ExamAttendanceChild, ExamMark, ExamMarkRegister, OnlineExamTake
        from apps.fees.models import FeesAssignment, FeesPayment

        return (
            StudentAttendance.objects.filter(student=student).exists()
            or SubjectAttendance.objects.filter(student=student).exists()
            or ExamMark.objects.filter(student=student).exists()
            or ExamAttendanceChild.objects.filter(student=student).exists()
            or ExamMarkRegister.objects.filter(student=student).exists()
            or OnlineExamTake.objects.filter(student=student).exists()
            or FeesAssignment.objects.filter(student=student).exists()
            or FeesPayment.objects.filter(student=student).exists()
        )

    def _audit_log(self, *, action, student, request, note="", metadata=None):
        try:
            school = getattr(student, "school", None)
            if not school:
                return
            StudentRecordAudit.objects.create(
                school=school,
                student=student,
                action=action,
                performed_by=request.user,
                note=note,
                metadata=metadata or {},
            )
        except Exception:
            # Audit failures should not block primary record operations.
            logger.exception("Unable to write student audit log")

    def _get_student_for_record_action(self, request, pk):
        qs = Student.objects.select_related("school")
        if not request.user.is_superuser:
            qs = qs.filter(school_id=request.user.school_id)
        return qs.filter(pk=pk).first()

    @action(detail=True, methods=["post"], url_path="soft-delete")
    def soft_delete(self, request, *args, **kwargs):
        student = self._get_student_for_record_action(request, kwargs.get("pk"))
        if not student:
            return Response(
                {"success": False, "message": "Student record not found", "field_errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if student.is_deleted:
            return Response(
                {"success": True, "message": "Student is already in archived status", "field_errors": {}},
                status=status.HTTP_200_OK,
            )

        if self._linked_record_exists(student):
            return Response(
                {"success": False, "message": "Cannot delete student. Linked records exist", "field_errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student.is_deleted = True
        student.is_active = False
        student.is_disabled = True
        student.status = "deleted"
        student.deleted_at = timezone.now()
        student.deleted_by = request.user
        student.save(update_fields=["is_deleted", "is_active", "is_disabled", "status", "deleted_at", "deleted_by", "updated_at"])

        self._audit_log(
            action=StudentRecordAudit.ACTION_SOFT_DELETE,
            student=student,
            request=request,
            note="Student soft-deleted",
            metadata={"student_id": student.id, "admission_no": student.admission_no},
        )

        return Response({"success": True, "message": "Student deleted successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        student = self._get_student_for_record_action(request, kwargs.get("pk"))
        if not student:
            return Response(
                {"success": False, "message": "Student record not found", "field_errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if not student.is_deleted:
            return Response(
                {"success": True, "message": "Student is already active (not archived)", "field_errors": {}},
                status=status.HTTP_200_OK,
            )

        try:
            with transaction.atomic():
                student.is_deleted = False
                student.is_disabled = False
                student.is_active = True
                student.status = "active"
                student.deleted_at = None
                student.deleted_by = None
                student.save(update_fields=["is_deleted", "is_disabled", "is_active", "status", "deleted_at", "deleted_by", "updated_at"])

                self._audit_log(
                    action=StudentRecordAudit.ACTION_RESTORE,
                    student=student,
                    request=request,
                    note="Student restored",
                    metadata={"student_id": student.id, "admission_no": student.admission_no},
                )
        except IntegrityError:
            return Response(
                {"success": False, "message": "Unable to restore student due to data dependency.", "field_errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            logger.exception("Restore student failed")
            return Response(
                {"success": False, "message": "Unable to restore student at this time.", "field_errors": {}},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"success": True, "message": "Student restored successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["delete"], url_path="permanent-delete")
    def permanent_delete(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            return Response(
                {"success": False, "message": "You do not have permission to delete student records", "field_errors": {}},
                status=status.HTTP_403_FORBIDDEN,
            )

        student = self._get_student_for_record_action(request, kwargs.get("pk"))
        if not student:
            return Response(
                {"success": False, "message": "Student record not found", "field_errors": {}},
                status=status.HTTP_404_NOT_FOUND,
            )
        if self._linked_record_exists(student):
            return Response(
                {
                    "success": False,
                    "message": "Unable to permanently delete student due to linked records",
                    "field_errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            with transaction.atomic():
                self._audit_log(
                    action=StudentRecordAudit.ACTION_PERMANENT_DELETE,
                    student=student,
                    request=request,
                    note="Student permanently deleted",
                    metadata={"student_id": student.id, "admission_no": student.admission_no},
                )
                student.delete()
        except ProtectedError:
            return Response(
                {
                    "success": False,
                    "message": "Unable to permanently delete student due to linked records",
                    "field_errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except IntegrityError:
            return Response(
                {
                    "success": False,
                    "message": "Unable to permanently delete student due to data dependency.",
                    "field_errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        except Exception:
            return Response(
                {
                    "success": False,
                    "message": "Unable to permanently delete student at this time.",
                    "field_errors": {},
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        return Response({"success": True, "message": "Student permanently deleted successfully"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="bulk-import")
    def bulk_import(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return self._validation_response({"file": ["Please upload a file"]})

        filename = (upload.name or "").lower()
        if not filename.endswith((".csv", ".xlsx")):
            return self._validation_response({"file": ["Only CSV or XLSX files are supported"]})

        rows = []
        if filename.endswith(".csv"):
            decoded = upload.read().decode("utf-8", errors="ignore")
            reader = csv.DictReader(io.StringIO(decoded))
            rows = list(reader)
        else:
            try:
                from openpyxl import load_workbook
            except Exception:
                return self._validation_response({"file": ["XLSX import requires openpyxl installation"]})
            workbook = load_workbook(upload, read_only=True)
            worksheet = workbook.active
            header = [str(cell.value or "").strip() for cell in next(worksheet.iter_rows(min_row=1, max_row=1))]
            for data_row in worksheet.iter_rows(min_row=2, values_only=True):
                rows.append({header[index]: value for index, value in enumerate(data_row)})

        created = 0
        errors = []
        for index, row in enumerate(rows, start=2):
            normalized_row = self._normalize_import_row(row)
            if not any(str(value or "").strip() for value in normalized_row.values()):
                continue

            serializer = self.get_serializer(data=normalized_row)
            if serializer.is_valid():
                try:
                    self.perform_create(serializer)
                    created += 1
                except IntegrityError:
                    errors.append({"row": index, "field_errors": {"admission_no": "Admission number already exists"}})
            else:
                errors.append({"row": index, "field_errors": self._normalize_field_errors(serializer.errors)})

        return Response(
            {
                "success": len(errors) == 0,
                "message": "Bulk import completed",
                "created": created,
                "failed": len(errors),
                "errors": errors,
            },
            status=status.HTTP_200_OK,
        )


class StudentDocumentViewSet(TenantScopedModelViewSet):
    serializer_class = StudentDocumentSerializer
    model = StudentDocument
    parser_classes = (MultiPartParser, FormParser)
    permission_codes = {"*": "student_info.student_list.view"}

    def get_queryset(self):
        user = self.request.user
        qs = StudentDocument.objects.select_related("student__school", "uploaded_by")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    @action(detail=False, methods=["post"], parser_classes=[MultiPartParser, FormParser])
    def upload_document(self, request):
        """
        Upload a student document.
        
        Expects:
        - student_id (required): Student ID (database ID or UUID)
        - document_type (required): Document type (birth_certificate, aadhaar_card, medical_information)
        - file (required): File to upload
        """
        try:
            student_id_input = request.data.get("student_id")
            document_type = request.data.get("document_type")
            file_obj = request.FILES.get("file")
            
            logger.info(f"Document upload attempt: student_id={student_id_input}, document_type={document_type}, file={file_obj.name if file_obj else None}")
            
            # Validations
            if not student_id_input:
                return Response(
                    {"error": "Student ID is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not document_type:
                return Response(
                    {"error": "Document type is required."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            if not file_obj:
                return Response(
                    {"error": "No file selected."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Check student exists and user has access.
            # The frontend may send either the numeric DB id or the UUID student_id.
            # We detect which one it is up front — querying a UUIDField with a
            # non-UUID string raises django.core.exceptions.ValidationError, not
            # Student.DoesNotExist, so we must validate the format ourselves.
            import uuid as _uuid
            student = None
            sid_str = str(student_id_input).strip()

            if sid_str.isdigit():
                try:
                    student = Student.objects.get(id=int(sid_str))
                except Student.DoesNotExist:
                    student = None

            if student is None:
                try:
                    _uuid.UUID(sid_str)
                except ValueError:
                    pass
                else:
                    try:
                        student = Student.objects.get(student_id=sid_str)
                    except Student.DoesNotExist:
                        student = None

            if student is None:
                logger.warning(f"Student not found with ID: {student_id_input}")
                return Response(
                    {"error": "Student not found."},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Check permission
            if not request.user.is_superuser and student.school_id != request.user.school_id:
                logger.warning(f"Permission denied: user school {request.user.school_id} != student school {student.school_id}")
                raise PermissionDenied("You don't have permission to upload documents for this student.")
            
            # Validate file type
            allowed_extensions = [".pdf", ".jpg", ".jpeg", ".png"]
            file_name_lower = file_obj.name.lower()
            if not any(file_name_lower.endswith(ext) for ext in allowed_extensions):
                return Response(
                    {"error": "Only PDF, JPG, JPEG, and PNG files are allowed."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Validate file size (5MB)
            if file_obj.size > 5242880:
                return Response(
                    {"error": "File size must be less than 5MB."},
                    status=status.HTTP_400_BAD_REQUEST
                )
            
            # Create document record
            document = StudentDocument.objects.create(
                student=student,
                school=student.school,
                document_type=document_type,
                title=document_type.replace("_", " ").title(),
                file=file_obj,
                original_name=file_obj.name,
                file_size=file_obj.size,
                uploaded_by=request.user,
            )
            
            # Serialize and return
            serializer = self.get_serializer(document)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        except Exception as e:
            logger.error(f"Document upload error: {str(e)}", exc_info=True)
            return Response(
                {"error": "An error occurred during file upload. Please try again."},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class StudentTransferHistoryViewSet(TenantScopedModelViewSet):
    serializer_class = StudentTransferHistorySerializer
    model = StudentTransferHistory
    permission_codes = {"*": "student_info.delete_student_record.view"}

    def get_queryset(self):
        user = self.request.user
        qs = StudentTransferHistory.objects.select_related("student__school", "from_school", "to_school")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()


class StudentPromotionHistoryViewSet(TenantScopedModelViewSet):
    serializer_class = StudentPromotionHistorySerializer
    model = StudentPromotionHistory
    permission_codes = {"*": "student_info.student_promote.view"}

    def get_queryset(self):
        user = self.request.user
        qs = StudentPromotionHistory.objects.select_related(
            "student__school",
            "from_class",
            "from_section",
            "to_class",
            "to_section",
            "from_academic_year",
            "to_academic_year",
            "promoted_by",
        )
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()


class StudentMultiClassRecordViewSet(TenantScopedModelViewSet):
    serializer_class = StudentMultiClassRecordSerializer
    model = StudentMultiClassRecord
    permission_codes = {
        "*": "student_info.multi_class_student.view",
        "bulk_save": "student_info.multi_class_student.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = StudentMultiClassRecord.objects.select_related("student", "school_class", "section", "student__school")

        student_id = self.request.query_params.get("student")
        if student_id:
            qs = qs.filter(student_id=student_id)

        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        record = serializer.save()
        if record.is_default:
            StudentMultiClassRecord.objects.filter(student_id=record.student_id).exclude(id=record.id).update(is_default=False)
            Student.objects.filter(id=record.student_id).update(
                current_class_id=record.school_class_id,
                current_section_id=record.section_id,
            )

    def perform_update(self, serializer):
        record = serializer.save()
        if record.is_default:
            StudentMultiClassRecord.objects.filter(student_id=record.student_id).exclude(id=record.id).update(is_default=False)
            Student.objects.filter(id=record.student_id).update(
                current_class_id=record.school_class_id,
                current_section_id=record.section_id,
            )

    @action(detail=False, methods=["post"], url_path="bulk-save")
    def bulk_save(self, request):
        serializer = StudentMultiClassBulkSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        student_id = data["student_id"]
        user = request.user
        student_qs = Student.objects.filter(id=student_id)
        if not user.is_superuser:
            student_qs = student_qs.filter(school_id=user.school_id)
        student = student_qs.first()
        if not student:
            raise ValidationError("Student not found in your school.")

        records = data.get("records", [])
        default_seen = False

        with transaction.atomic():
            StudentMultiClassRecord.objects.filter(student=student).delete()
            created = []

            for item in records:
                school_class_id = item["school_class"]
                section_id = item.get("section")
                is_default = bool(item.get("is_default", False))
                if is_default:
                    if default_seen:
                        is_default = False
                    default_seen = True

                from apps.core.models import Class, Section

                class_qs = Class.objects.filter(id=school_class_id)
                if not user.is_superuser:
                    class_qs = class_qs.filter(school_id=student.school_id)
                if not class_qs.exists():
                    raise ValidationError("One or more classes are invalid for this student school.")

                if section_id:
                    section_qs = Section.objects.filter(id=section_id, school_class_id=school_class_id)
                    if not section_qs.exists():
                        raise ValidationError("One or more sections do not belong to selected class.")

                created.append(
                    StudentMultiClassRecord.objects.create(
                        student=student,
                        school_class_id=school_class_id,
                        section_id=section_id,
                        roll_no=item.get("roll_no", ""),
                        is_default=is_default,
                    )
                )

            default_record = next((item for item in created if item.is_default), None)
            if not default_record and created:
                default_record = created[0]
                default_record.is_default = True
                default_record.save(update_fields=["is_default", "updated_at"])

            if default_record:
                student.current_class_id = default_record.school_class_id
                student.current_section_id = default_record.section_id
                student.save(update_fields=["current_class", "current_section", "updated_at"])

        response_data = StudentMultiClassRecordSerializer(
            StudentMultiClassRecord.objects.filter(student=student).order_by("-is_default", "id"),
            many=True,
        ).data
        return Response({"student_id": student.id, "records": response_data}, status=status.HTTP_200_OK)


class StudentSubjectAssignmentViewSet(TenantScopedModelViewSet):
    serializer_class = StudentSubjectAssignmentSerializer
    model = StudentSubjectAssignment
    permission_codes = {
        "*": "student_info.multi_class_student.view",
        "assign_individual": "student_info.multi_class_student.view",
        "assign_bulk": "student_info.multi_class_student.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = StudentSubjectAssignment.objects.select_related(
            "student",
            "subject",
            "academic_year",
            "school_class",
            "section",
            "assigned_by",
        )
        student_id = self.request.query_params.get("student_id")
        class_id = self.request.query_params.get("class") or self.request.query_params.get("school_class")
        section_id = self.request.query_params.get("section")
        academic_year_id = self.request.query_params.get("academic_year")
        if student_id:
            qs = qs.filter(student_id=student_id)
        if class_id:
            qs = qs.filter(school_class_id=class_id)
        if section_id:
            qs = qs.filter(section_id=section_id)
        if academic_year_id:
            qs = qs.filter(academic_year_id=academic_year_id)
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()

    def _validation_response(self, field_errors=None, message="Validation failed"):
        normalized = {}
        for key, value in (field_errors or {}).items():
            if isinstance(value, (list, tuple)):
                normalized[key] = str(value[0]) if value else "Validation failed"
            else:
                normalized[key] = str(value)
        return Response(
            {
                "success": False,
                "message": message,
                "field_errors": normalized,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _resolve_students(self, *, student_ids, class_id, section_id, user):
        queryset = Student.objects.filter(id__in=student_ids, current_class_id=class_id, current_section_id=section_id)
        if not user.is_superuser:
            queryset = queryset.filter(school_id=user.school_id)
        return list(queryset)

    def _create_assignments(self, *, students, subject_ids, academic_year_id, class_id, section_id, is_optional, user):
        existing = StudentSubjectAssignment.objects.filter(
            student_id__in=[row.id for row in students],
            subject_id__in=subject_ids,
            academic_year_id=academic_year_id,
        )
        if existing.exists():
            return self._validation_response({"subject_ids": "Subject already assigned to this student"})

        payload = [
            StudentSubjectAssignment(
                student_id=student.id,
                subject_id=subject_id,
                academic_year_id=academic_year_id,
                school_class_id=class_id,
                section_id=section_id,
                is_optional=is_optional,
                assigned_by=user,
            )
            for student in students
            for subject_id in subject_ids
        ]
        StudentSubjectAssignment.objects.bulk_create(payload)
        return None

    @action(detail=False, methods=["post"], url_path="assign-individual")
    def assign_individual(self, request):
        serializer = StudentSubjectAssignmentRequestSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return self._validation_response(serializer.errors)

        data = serializer.validated_data
        student_id = request.data.get("student_id")
        if not student_id:
            return self._validation_response({"student_id": "Please select a student"})

        students = self._resolve_students(
            student_ids=[int(student_id)],
            class_id=data["school_class"],
            section_id=data["section"],
            user=request.user,
        )
        if not students:
            return self._validation_response({"student_id": "Unable to load students. Please try again"})

        with transaction.atomic():
            error = self._create_assignments(
                students=students,
                subject_ids=data["subject_ids"],
                academic_year_id=data["academic_year"],
                class_id=data["school_class"],
                section_id=data["section"],
                is_optional=data.get("is_optional", False),
                user=request.user,
            )
            if error:
                return error

        return Response({"success": True, "message": "Subjects assigned successfully"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="assign-bulk")
    def assign_bulk(self, request):
        serializer = StudentSubjectAssignmentRequestSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return self._validation_response(serializer.errors)

        data = serializer.validated_data
        student_ids = data.get("student_ids") or request.data.get("student_ids") or []

        if student_ids:
            students = self._resolve_students(
                student_ids=student_ids,
                class_id=data["school_class"],
                section_id=data["section"],
                user=request.user,
            )
        else:
            students_qs = Student.objects.filter(current_class_id=data["school_class"], current_section_id=data["section"])
            if not request.user.is_superuser:
                students_qs = students_qs.filter(school_id=request.user.school_id)
            students = list(students_qs)

        if not students:
            return self._validation_response({"students": "Unable to load students. Please try again"})

        with transaction.atomic():
            error = self._create_assignments(
                students=students,
                subject_ids=data["subject_ids"],
                academic_year_id=data["academic_year"],
                class_id=data["school_class"],
                section_id=data["section"],
                is_optional=data.get("is_optional", False),
                user=request.user,
            )
            if error:
                return error

        return Response({"success": True, "message": "Subjects assigned successfully"}, status=status.HTTP_200_OK)


class StudentRecordAuditViewSet(TenantScopedModelViewSet):
    serializer_class = StudentRecordAuditSerializer
    model = StudentRecordAudit
    permission_codes = {"*": "student_info.delete_student_record.view"}
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = StudentRecordAudit.objects.select_related("student", "performed_by", "school", "student__current_class", "student__current_section")

        student_id = self.request.query_params.get("student_id")
        action = (self.request.query_params.get("action") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        class_id = self.request.query_params.get("class")
        section_id = self.request.query_params.get("section")

        if student_id:
            qs = qs.filter(student_id=student_id)
        if action:
            qs = qs.filter(action=action)
        if class_id:
            qs = qs.filter(student__current_class_id=class_id)
        if section_id:
            qs = qs.filter(student__current_section_id=section_id)
        if search:
            qs = qs.filter(
                Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(student__admission_no__icontains=search)
                | Q(note__icontains=search)
            )

        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

