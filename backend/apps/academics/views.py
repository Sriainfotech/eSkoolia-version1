from datetime import datetime, timedelta
import re

from django.db import transaction
from django.db.models import Q, Count
from django.utils import timezone
from django.core.files.storage import default_storage
from rest_framework import permissions, status, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from apps.access_control.models import UserRole
from apps.core.models import Class as SchoolClass
from apps.hr.models import Staff
from apps.users.models import User
from .models import (
    ClassOptionalSubjectSetup,
    ClassRoutineSlot,
    ClassSubjectAssignment,
    ClassSubjectEntry,
    ClassTeacherAssignment,
    ClassTeacherAudit,
    Homework,
    HomeworkSubmission,
    Lesson,
    LessonPlanner,
    LessonPlanTopic,
    LessonTopic,
    LessonTopicDetail,
    OptionalSubjectAssignment,
    UploadedContent,
)
from .serializers import (
    ClassOptionalSubjectSetupSerializer,
    ClassRoutineSlotSerializer,
    ClassSubjectAssignmentSerializer,
    ClassSubjectEntrySerializer,
    ClassTeacherAssignmentSerializer,
    HomeworkSerializer,
    HomeworkSubmissionSerializer,
    LessonGroupCreateSerializer,
    LessonPlannerCreateSerializer,
    LessonPlannerSerializer,
    LessonSerializer,
    LessonTopicDetailSerializer,
    LessonTopicGroupCreateSerializer,
    LessonTopicSerializer,
    OptionalSubjectAssignmentSerializer,
    UploadedContentSerializer,
)


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
        serializer.save()

    def filter_queryset_by_params(self, queryset, mapping):
        for query_key, model_key in mapping.items():
            value = self.request.query_params.get(query_key)
            if value not in (None, ""):
                queryset = queryset.filter(**{model_key: value})
        return queryset


class ClassSubjectAssignmentViewSet(TenantScopedModelViewSet):
    model = ClassSubjectAssignment
    pagination_class = ApiPageNumberPagination
    serializer_class = ClassSubjectAssignmentSerializer
    permission_codes = {"*": "academics.core_setup.view"}

    def get_queryset(self):
        queryset = super().get_queryset().select_related("school_class", "section", "subject", "teacher", "academic_year")
        return self.filter_queryset_by_params(
            queryset,
            {
                "class_id": "school_class_id",
                "section_id": "section_id",
                "subject_id": "subject_id",
                "teacher_id": "teacher_id",
                "academic_year_id": "academic_year_id",
            },
        )

    def _normalized_errors(self, serializer_errors):
        if isinstance(serializer_errors, dict):
            if "message" in serializer_errors:
                return {}, serializer_errors.get("message")
            cleaned = {}
            for key, value in serializer_errors.items():
                if isinstance(value, list):
                    cleaned[key] = [str(item) for item in value]
                else:
                    cleaned[key] = [str(value)]
            return cleaned, "Validation failed"
        return {}, "Validation failed"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Subject assigned successfully",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_update(serializer)
        return Response(
            {
                "success": True,
                "message": "Subject assigned successfully",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


_DIAG_SPAM = {
    'qaz', 'wsx', 'edc', 'rfv', 'tgb', 'yhn', 'ujm',  # diagonal down-left columns
    'zaq', 'xsw', 'cde', 'vfr', 'bgt', 'nhy', 'mju',  # same columns reversed
}


def _has_keyboard_spam(name: str) -> bool:
    """Return True if the alphabetic part of name contains a 3-key keyboard-row
    or diagonal-column sequence."""
    rows = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm']
    letters = re.sub(r'[^a-z]', '', name.lower())
    for i in range(len(letters) - 2):
        w = letters[i:i + 3]
        wr = w[::-1]
        if any(w in row or wr in row for row in rows):
            return True
        if w in _DIAG_SPAM or wr in _DIAG_SPAM:
            return True
    return False


def _has_short_no_vowel_spam(name: str) -> bool:
    """Reject 3-4 char alphabetic segments with zero vowels (e.g. knm, strg)."""
    vowels = set('aeiou')
    for seg in re.split(r'[^a-zA-Z]+', name):
        if 3 <= len(seg) <= 4 and not any(c.lower() in vowels for c in seg):
            return True
    return False


def _has_excessive_consonants(name: str) -> bool:
    """Return True if name has 5+ consecutive consonants (y treated as consonant)."""
    vowels = set('aeiou')
    run = 0
    for ch in name.lower():
        if ch.isalpha():
            if ch in vowels:
                run = 0
            else:
                run += 1
                if run >= 5:
                    return True
        else:
            run = 0  # spaces, &, -, () break the run
    return False


class ClassSubjectEntryViewSet(TenantScopedModelViewSet):
    """Foundation-step per-class subject catalog."""

    class _Pagination(ApiPageNumberPagination):
        # Default to 10 per page; allow up to 1000 so the wizard can
        # fetch all subjects in a single request (?page_size=1000)
        max_page_size = 1000
        page_size = 10

    model = ClassSubjectEntry
    serializer_class = ClassSubjectEntrySerializer
    pagination_class = _Pagination  # Fix #4G — paginated (not None), but allows large page_size
    permission_codes = {  # Fix #4F — split view/write permissions
        "list": "academics.core_setup.view",
        "retrieve": "academics.core_setup.view",
        "create": "academics.core_setup.write",
        "update": "academics.core_setup.write",
        "partial_update": "academics.core_setup.write",
        "destroy": "academics.core_setup.write",
        "reset_class": "academics.core_setup.write",
    }

    def get_queryset(self):
        qs = super().get_queryset().select_related("school_class")
        class_id = self.request.query_params.get("class_id")
        if class_id:
            qs = qs.filter(school_class_id=class_id)
        return qs

    def create(self, request, *args, **kwargs):
        class_ids = request.data.get("class_ids")
        if not class_ids or not isinstance(class_ids, list):
            return Response(
                {"success": False, "message": "class_ids must be a non-empty list"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school = request.user.school or getattr(request, "school", None)
        if not school:
            first_cls = SchoolClass.objects.filter(pk=class_ids[0]).select_related("school").first()
            school = first_cls.school if first_cls else None
        if not school:
            return Response(
                {"success": False, "message": "Could not determine school for this user"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        name = (request.data.get("name") or "").strip()
        code = (request.data.get("code") or "").strip().upper()

        # Auto-generate code from name if not supplied
        if not code and name:
            words = name.split()
            if len(words) >= 2:
                code = "".join(w[0] for w in words if w)[:6].upper()
            else:
                code = name[:6].upper()
            code = "".join(c for c in code if c.isalnum())

        subject_type = request.data.get("subject_type", ClassSubjectEntry.TYPE_CORE)
        try:
            periods = int(request.data.get("periods_per_week", 5))
        except (TypeError, ValueError):
            periods = 5

        if not name:
            return Response(
                {"success": False, "message": "Subject name cannot be empty."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(name) < 2:
            return Response(
                {"success": False, "message": "Enter a valid subject name."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if len(name) > 50:
            return Response(
                {"success": False, "message": "Maximum 50 characters allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not re.match(r'^[a-zA-Z0-9 &\-()]+$', name):
            return Response(
                {"success": False, "message": "Special characters are not allowed."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if not re.search(r'[a-zA-Z]', name):
            return Response(
                {"success": False, "message": "Enter a valid subject name."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if re.search(r' {2,}', name):
            return Response(
                {"success": False, "message": "Enter a valid subject name."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if re.search(r'(.)\1{3,}', name, re.IGNORECASE):
            return Response(
                {"success": False, "message": "Too many repeated characters in a row."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if _has_keyboard_spam(name):
            return Response(
                {"success": False, "message": "Enter a valid subject name."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if _has_excessive_consonants(name):
            return Response(
                {"success": False, "message": "Enter a valid subject name."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if _has_short_no_vowel_spam(name):
            return Response(
                {"success": False, "message": "Enter a valid subject name."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        # Normalize: collapse any remaining extra internal spaces
        name = re.sub(r' {2,}', ' ', name)

        created = []
        skipped = []
        for cls_id in class_ids:
            if ClassSubjectEntry.objects.filter(
                school=school,
                school_class_id=cls_id,
                name__iexact=name,
            ).exists():
                skipped.append({"class_id": cls_id, "message": f"A subject named '{name}' already exists in this class"})
                continue
            entry, was_created = ClassSubjectEntry.objects.get_or_create(
                school=school,
                school_class_id=cls_id,
                code=code,
                defaults={
                    "name": name,
                    "subject_type": subject_type,
                    "periods_per_week": periods,
                },
            )
            serializer = self.get_serializer(entry)
            if was_created:
                created.append(serializer.data)
            else:
                skipped.append({"class_id": cls_id, "message": f"'{code}' already exists in this class"})

        return Response(
            {"success": True, "created": len(created), "skipped": len(skipped), "data": created, "errors": skipped},
            status=status.HTTP_201_CREATED,
        )

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        instance.delete()
        return Response({"success": True, "message": "Subject removed"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="reset-class")
    def reset_class(self, request):
        class_id = request.data.get("class_id")
        if not class_id:
            return Response(
                {"success": False, "message": "class_id is required"},
                status=status.HTTP_400_BAD_REQUEST,
            )
        school = request.user.school or getattr(request, "school", None)
        if not school:
            cls_obj = SchoolClass.objects.filter(pk=class_id).select_related("school").first()
            school = cls_obj.school if cls_obj else None
        count, _ = ClassSubjectEntry.objects.filter(school=school, school_class_id=class_id).delete()
        return Response({"success": True, "message": f"{count} subject(s) removed from class"})


class ClassTeacherAssignmentViewSet(TenantScopedModelViewSet):
    model = ClassTeacherAssignment
    pagination_class = ApiPageNumberPagination
    serializer_class = ClassTeacherAssignmentSerializer
    permission_codes = {"*": "academics.core_setup.view"}

    def get_queryset(self):
        queryset = super().get_queryset().select_related("school_class", "section", "teacher", "academic_year")
        return self.filter_queryset_by_params(
            queryset,
            {
                "class_id": "school_class_id",
                "section_id": "section_id",
                "teacher_id": "teacher_id",
                "academic_year_id": "academic_year_id",
            },
        )

    def _normalized_errors(self, serializer_errors):
        if isinstance(serializer_errors, dict):
            if "message" in serializer_errors:
                return {}, serializer_errors.get("message")
            cleaned = {}
            for key, value in serializer_errors.items():
                if isinstance(value, list):
                    cleaned[key] = [str(item) for item in value]
                else:
                    cleaned[key] = [str(value)]
            return cleaned, "Validation failed"
        return {}, "Validation failed"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Class teacher assigned successfully",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_update(serializer)
        return Response(
            {
                "success": True,
                "message": "Class teacher assigned successfully",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)


class ClassRoutineSlotViewSet(TenantScopedModelViewSet):
    model = ClassRoutineSlot
    serializer_class = ClassRoutineSlotSerializer
    permission_codes = {"*": "academics.core_setup.view"}

    def get_queryset(self):
        queryset = super().get_queryset().select_related("school_class", "section", "subject", "teacher", "academic_year")
        queryset = self.filter_queryset_by_params(
            queryset,
            {
                "class_id": "school_class_id",
                "section_id": "section_id",
                "subject_id": "subject_id",
                "teacher_id": "teacher_id",
                "academic_year_id": "academic_year_id",
                "day": "day",
                "class_period_id": "class_period_id",
            },
        )
        return queryset.order_by("day", "start_time")

    def _normalized_errors(self, serializer_errors):
        if isinstance(serializer_errors, dict):
            message = serializer_errors.get("message")
            if isinstance(message, list) and message:
                return {}, str(message[0])
            if isinstance(message, str) and message:
                return {}, message

            cleaned = {}
            for key, value in serializer_errors.items():
                if isinstance(value, list):
                    cleaned[key] = [str(item) for item in value]
                else:
                    cleaned[key] = [str(value)]
            return cleaned, "Validation failed"
        return {}, "Validation failed"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_create(serializer)
        return Response(
            {
                "success": True,
                "message": "Class routine saved successfully",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_update(serializer)
        return Response(
            {
                "success": True,
                "message": "Class routine updated successfully",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response(
            {
                "success": True,
                "message": "Class routine deleted successfully",
            },
            status=status.HTTP_200_OK,
        )


class ClassOptionalSubjectSetupViewSet(TenantScopedModelViewSet):
    model = ClassOptionalSubjectSetup
    serializer_class = ClassOptionalSubjectSetupSerializer
    permission_codes = {"*": "academics.core_setup.view"}


class OptionalSubjectAssignmentViewSet(TenantScopedModelViewSet):
    model = OptionalSubjectAssignment
    serializer_class = OptionalSubjectAssignmentSerializer
    permission_codes = {"*": "academics.core_setup.view"}

    def get_queryset(self):
        user = self.request.user
        qs = OptionalSubjectAssignment.objects.select_related("student__school", "subject", "academic_year")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        serializer.save()


class HomeworkViewSet(TenantScopedModelViewSet):
    model = Homework
    serializer_class = HomeworkSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_codes = {
        "list": "academics.homework_list.view",
        "retrieve": "academics.homework_list.view",
        "create": "academics.add_homework.view",
        "update": "academics.add_homework.view",
        "partial_update": "academics.add_homework.view",
        "destroy": "academics.add_homework.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = Homework.objects.select_related(
            "school",
            "academic_year",
            "class_id_ref",
            "section_id_ref",
            "subject_id_ref",
            "created_by",
            "evaluated_by",
        ).prefetch_related("evaluations")
        if user.is_superuser:
            base_qs = qs
        elif user.school_id:
            base_qs = qs.filter(school_id=user.school_id)
        else:
            base_qs = qs.none()
        return self.filter_queryset_by_params(
            base_qs,
            {
                "class": "class_id_ref_id",
                "class_id": "class_id_ref_id",
                "section": "section_id_ref_id",
                "section_id": "section_id_ref_id",
                "subject": "subject_id_ref_id",
                "subject_id": "subject_id_ref_id",
            },
        )

    def _normalized_errors(self, serializer_errors):
        if isinstance(serializer_errors, dict):
            message = serializer_errors.get("message")
            if isinstance(message, list) and message:
                return {}, str(message[0])
            if isinstance(message, str) and message:
                return {}, message

            cleaned = {}
            for key, value in serializer_errors.items():
                if isinstance(value, list):
                    cleaned[key] = [str(item) for item in value]
                else:
                    cleaned[key] = [str(value)]
            return cleaned, "Validation failed"
        return {}, "Validation failed"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_create(serializer)
        return Response({"success": True, "message": "Homework created successfully", "data": serializer.data}, status=status.HTTP_201_CREATED)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_update(serializer)
        return Response({"success": True, "message": "Homework updated successfully", "data": serializer.data}, status=status.HTTP_200_OK)

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def perform_create(self, serializer):
        school = self.request.user.school or getattr(self.request, "school", None)
        serializer.save(school=school, created_by=self.request.user)

    def perform_update(self, serializer):
        instance = serializer.save()
        if "evaluation_date" in serializer.validated_data:
            instance.evaluated_by = self.request.user
            instance.save(update_fields=["evaluated_by", "updated_at"])


class HomeworkSubmissionViewSet(TenantScopedModelViewSet):
    model = HomeworkSubmission
    serializer_class = HomeworkSubmissionSerializer
    permission_codes = {"*": "academics.homework_list.view"}

    def get_queryset(self):
        user = self.request.user
        qs = HomeworkSubmission.objects.select_related("homework__school", "student", "created_by")
        if user.is_superuser:
            base_qs = qs
        elif user.school_id:
            base_qs = qs.filter(homework__school_id=user.school_id)
        else:
            base_qs = qs.none()

        homework_id = self.request.query_params.get("homework_id") or self.request.query_params.get("homework")
        student_id = self.request.query_params.get("student_id") or self.request.query_params.get("student")
        if homework_id not in (None, ""):
            base_qs = base_qs.filter(homework_id=homework_id)
        if student_id not in (None, ""):
            base_qs = base_qs.filter(student_id=student_id)
        return base_qs

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)


class UploadedContentViewSet(TenantScopedModelViewSet):
    model = UploadedContent
    serializer_class = UploadedContentSerializer
    parser_classes = [MultiPartParser, FormParser, JSONParser]
    permission_codes = {"*": "academics.upload_content.view"}

    def get_queryset(self):
        user = self.request.user
        qs = UploadedContent.objects.select_related("school", "academic_year", "class_id_ref", "section_id_ref", "created_by")
        if user.is_superuser:
            base_qs = qs
        elif user.school_id:
            base_qs = qs.filter(school_id=user.school_id)
        else:
            base_qs = qs.none()

        queryset = base_qs
        class_id = self.request.query_params.get("class_id") or self.request.query_params.get("class")
        section_id = self.request.query_params.get("section_id") or self.request.query_params.get("section")
        content_type = self.request.query_params.get("content_type")

        if class_id not in (None, ""):
            queryset = queryset.filter(Q(class_id_ref_id=class_id) | Q(available_for_all_classes=True))

        if section_id not in (None, ""):
            queryset = queryset.filter(Q(section_id_ref_id=section_id) | Q(available_for_all_classes=True, section_id_ref__isnull=True))

        if content_type not in (None, ""):
            queryset = queryset.filter(content_type=content_type)

        return queryset

    def perform_create(self, serializer):
        school = self.request.user.school or getattr(self.request, "school", None)
        serializer.save(school=school, created_by=self.request.user)

    def perform_destroy(self, instance):
        file_path = (instance.upload_file or "").strip()
        super().perform_destroy(instance)
        if not file_path:
            return
        normalized = file_path.lstrip("/")
        try:
            if default_storage.exists(normalized):
                default_storage.delete(normalized)
        except Exception:
            pass

    def _normalized_errors(self, serializer_errors):
        if isinstance(serializer_errors, dict):
            message = serializer_errors.get("message")
            if isinstance(message, list) and message:
                return {}, str(message[0])
            if isinstance(message, str) and message:
                nested = serializer_errors.get("errors")
                cleaned = {}
                if isinstance(nested, dict):
                    for key, value in nested.items():
                        if isinstance(value, list):
                            cleaned[key] = [str(item) for item in value]
                        else:
                            cleaned[key] = [str(value)]
                return cleaned, message

            cleaned = {}
            for key, value in serializer_errors.items():
                if isinstance(value, list):
                    cleaned[key] = [str(item) for item in value]
                else:
                    cleaned[key] = [str(value)]
            return cleaned, "Validation failed"
        return {}, "Validation failed"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_create(serializer)
        return Response(
            {"success": True, "message": "Content uploaded successfully.", "data": serializer.data},
            status=status.HTTP_201_CREATED,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            errors, message = self._normalized_errors(serializer.errors)
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return Response(payload, status=status.HTTP_400_BAD_REQUEST)

        self.perform_update(serializer)
        return Response(
            {"success": True, "message": "Content updated successfully.", "data": serializer.data},
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        self.perform_destroy(instance)
        return Response({"success": True, "message": "Content deleted successfully."}, status=status.HTTP_200_OK)


class LessonViewSet(TenantScopedModelViewSet):
    model = Lesson
    serializer_class = LessonSerializer
    permission_codes = {
        "*": "academics.lesson.view",
        "grouped": "academics.lesson.view",
        "delete_group": "academics.lesson.view",
    }

    def get_queryset(self):
        queryset = Lesson.objects.select_related("school", "academic_year", "school_class", "section", "subject", "user")
        queryset = super().get_queryset().select_related("academic_year", "school_class", "section", "subject", "user")
        return self.filter_queryset_by_params(
            queryset,
            {
                "class": "school_class_id",
                "class_id": "school_class_id",
                "section": "section_id",
                "section_id": "section_id",
                "subject": "subject_id",
                "subject_id": "subject_id",
            },
        )

    def create(self, request, *args, **kwargs):
        if isinstance(request.data.get("lesson"), list):
            serializer = LessonGroupCreateSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            data = serializer.validated_data
            school = request.user.school or getattr(request, "school", None)
            section = data.get("section")
            if section is None:
                sections = list(data["school_class"].sections.all())
                if not sections:
                    sections = [None]
            else:
                sections = [section]

            created_rows = []
            with transaction.atomic():
                for section_item in sections:
                    for lesson_title in data["lesson"]:
                        created_rows.append(
                            Lesson.objects.create(
                                school=school,
                                academic_year=data.get("academic_year"),
                                school_class=data["school_class"],
                                section=section_item,
                                subject=data["subject"],
                                lesson_title=lesson_title,
                                user=request.user,
                                created_by=request.user,
                                updated_by=request.user,
                            )
                        )
            output = self.get_serializer(created_rows, many=True)
            return Response(output.data, status=status.HTTP_201_CREATED)
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        school = self.request.user.school or getattr(self.request, "school", None)
        serializer.save(school=school, user=self.request.user, created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=["get"], url_path="grouped")
    def grouped(self, request):
        groups = []
        seen = set()
        for lesson in self.get_queryset():
            key = (lesson.school_class_id, lesson.section_id, lesson.subject_id)
            if key in seen:
                continue
            seen.add(key)
            group_rows = self.get_queryset().filter(
                school_class_id=lesson.school_class_id,
                section_id=lesson.section_id,
                subject_id=lesson.subject_id,
            )
            groups.append(
                {
                    "class_id": lesson.school_class_id,
                    "class_name": getattr(lesson.school_class, "name", ""),
                    "section_id": lesson.section_id,
                    "section_name": getattr(lesson.section, "name", "") if lesson.section_id else "",
                    "subject_id": lesson.subject_id,
                    "subject_name": getattr(lesson.subject, "name", ""),
                    "items": self.get_serializer(group_rows, many=True).data,
                }
            )
        return Response(groups)

    @action(detail=False, methods=["delete"], url_path="delete-group")
    def delete_group(self, request):
        class_id = request.query_params.get("class_id")
        section_id = request.query_params.get("section_id")
        subject_id = request.query_params.get("subject_id")
        if not class_id or not section_id or not subject_id:
            return Response(
                {"detail": "class_id, section_id and subject_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        queryset = self.get_queryset().filter(
            school_class_id=class_id,
            section_id=section_id,
            subject_id=subject_id,
        )
        deleted_count = queryset.count()
        queryset.delete()
        return Response({"deleted": deleted_count}, status=status.HTTP_200_OK)


class LessonTopicViewSet(TenantScopedModelViewSet):
    model = LessonTopic
    serializer_class = LessonTopicSerializer
    permission_codes = {
        "*": "academics.topic.view",
        "delete_group": "academics.topic.view",
    }

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            "academic_year", "school_class", "section", "subject", "lesson", "user"
        ).prefetch_related("topics")
        return self.filter_queryset_by_params(
            queryset,
            {
                "class": "school_class_id",
                "class_id": "school_class_id",
                "section": "section_id",
                "section_id": "section_id",
                "subject": "subject_id",
                "subject_id": "subject_id",
                "lesson": "lesson_id",
                "lesson_id": "lesson_id",
            },
        )

    def _validation_response(self, serializer_errors):
        if isinstance(serializer_errors, dict):
            errors = {}
            message = "Validation failed"
            for key, value in serializer_errors.items():
                if key == "message":
                    if isinstance(value, list) and value:
                        message = str(value[0])
                    elif isinstance(value, str) and value:
                        message = value
                    continue
                if isinstance(value, list):
                    errors[key] = [str(item) for item in value]
                else:
                    errors[key] = [str(value)]
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return payload
        return {"success": False, "message": "Validation failed"}

    def create(self, request, *args, **kwargs):
        if isinstance(request.data.get("topic"), list):
            serializer = LessonTopicGroupCreateSerializer(data=request.data, context=self.get_serializer_context())
            if not serializer.is_valid():
                return Response(self._validation_response(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
            data = serializer.validated_data
            school = request.user.school or getattr(request, "school", None)
            with transaction.atomic():
                lesson_topic, created = LessonTopic.objects.get_or_create(
                    school=school,
                    academic_year=data.get("academic_year"),
                    school_class=data["school_class"],
                    section=data["section"],
                    subject=data["subject"],
                    lesson=data["lesson"],
                    defaults={
                        "user": request.user,
                        "created_by": request.user,
                        "updated_by": request.user,
                    },
                )
                if not created:
                    lesson_topic.updated_by = request.user
                    lesson_topic.save(update_fields=["updated_by", "updated_at"])
                for topic_title in data["topic"]:
                    if LessonTopicDetail.objects.filter(
                        topic=lesson_topic,
                        lesson=data["lesson"],
                        topic_title__iexact=topic_title,
                    ).exists():
                        return Response(
                            {
                                "success": False,
                                "message": f"Topic '{topic_title}' already exists for this lesson.",
                            },
                            status=status.HTTP_400_BAD_REQUEST,
                        )
                    LessonTopicDetail.objects.create(
                        topic=lesson_topic,
                        lesson=data["lesson"],
                        topic_title=topic_title,
                        created_by=request.user,
                        updated_by=request.user,
                    )
            output = self.get_serializer(lesson_topic)
            return Response({"success": True, "message": "Topic group saved successfully.", "data": output.data}, status=status.HTTP_201_CREATED)

        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return Response(self._validation_response(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        self.perform_create(serializer)
        return Response({"success": True, "message": "Topic saved successfully.", "data": serializer.data}, status=status.HTTP_201_CREATED)

    def perform_create(self, serializer):
        school = self.request.user.school or getattr(self.request, "school", None)
        serializer.save(school=school, user=self.request.user, created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    @action(detail=False, methods=["delete"], url_path="delete-group")
    def delete_group(self, request):
        group_id = request.query_params.get("id")
        if not group_id:
            return Response({"detail": "id is required."}, status=status.HTTP_400_BAD_REQUEST)
        try:
            instance = self.get_queryset().get(pk=group_id)
        except LessonTopic.DoesNotExist:
            return Response({"detail": "Topic group not found."}, status=status.HTTP_404_NOT_FOUND)

        if LessonPlanTopic.objects.filter(topic__topic=instance).exists() or LessonPlanner.objects.filter(Q(topic=instance.topics.first()) | Q(topic_detail__topic=instance)).exists():
            return Response({"success": False, "message": "Cannot delete topic as it is already in use"}, status=status.HTTP_400_BAD_REQUEST)
        instance.delete()
        return Response({"success": True, "message": "Topic group deleted successfully."}, status=status.HTTP_200_OK)


class LessonTopicDetailViewSet(TenantScopedModelViewSet):
    model = LessonTopicDetail
    serializer_class = LessonTopicDetailSerializer
    permission_codes = {"*": "academics.topic.view"}

    def get_queryset(self):
        queryset = LessonTopicDetail.objects.select_related(
            "topic__school", "topic__school_class", "topic__section", "topic__subject", "lesson"
        )
        user = self.request.user
        if not user.is_superuser:
            if user.school_id:
                queryset = queryset.filter(topic__school_id=user.school_id)
            else:
                queryset = queryset.none()
        topic_id = self.request.query_params.get("topic_id") or self.request.query_params.get("topic")
        lesson_id = self.request.query_params.get("lesson_id") or self.request.query_params.get("lesson")
        if topic_id:
            queryset = queryset.filter(topic_id=topic_id)
        if lesson_id:
            queryset = queryset.filter(lesson_id=lesson_id)
        return queryset

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user, updated_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if LessonPlanTopic.objects.filter(topic=instance).exists() or LessonPlanner.objects.filter(Q(topic=instance) | Q(topic_detail=instance)).exists():
            return Response({"success": False, "message": "Cannot delete topic as it is already in use"}, status=status.HTTP_400_BAD_REQUEST)
        self.perform_destroy(instance)
        return Response({"success": True, "message": "Topic deleted successfully."}, status=status.HTTP_200_OK)


class LessonPlannerViewSet(TenantScopedModelViewSet):
    model = LessonPlanner
    serializer_class = LessonPlannerSerializer
    permission_codes = {
        "*": "academics.lesson_planner.view",
        "overview": "academics.lesson_planner.view",
        "teachers": "academics.lesson_planner.view",
        "weekly": "academics.lesson_planner.view",
    }

    def get_queryset(self):
        queryset = super().get_queryset().select_related(
            "academic_year",
            "lesson",
            "topic",
            "lesson_detail",
            "topic_detail",
            "teacher",
            "subject",
            "school_class",
            "section",
        ).prefetch_related("topics__topic")
        return self.filter_queryset_by_params(
            queryset,
            {
                "teacher": "teacher_id",
                "teacher_id": "teacher_id",
                "class": "school_class_id",
                "class_id": "school_class_id",
                "section": "section_id",
                "section_id": "section_id",
                "subject": "subject_id",
                "subject_id": "subject_id",
                "routine_id": "routine_id",
                "lesson_date": "lesson_date",
            },
        )

    def _validation_response(self, serializer_errors):
        if isinstance(serializer_errors, dict):
            errors = {}
            message = "Validation failed"
            for key, value in serializer_errors.items():
                if key == "message":
                    if isinstance(value, list) and value:
                        message = str(value[0])
                    elif isinstance(value, str) and value:
                        message = value
                    continue
                if isinstance(value, list):
                    errors[key] = [str(item) for item in value]
                else:
                    errors[key] = [str(value)]
            payload = {"success": False, "message": message}
            if errors:
                payload["errors"] = errors
            return payload
        return {"success": False, "message": "Validation failed"}

    def create(self, request, *args, **kwargs):
        serializer = LessonPlannerCreateSerializer(data=request.data, context=self.get_serializer_context())
        if not serializer.is_valid():
            return Response(self._validation_response(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        school = request.user.school or getattr(request, "school", None)
        lesson = data["lesson"]
        topic_value = data.get("topic")
        sub_topic_value = data.get("sub_topic")
        customize = data.get("customize")

        with transaction.atomic():
            lesson_planner = LessonPlanner.objects.create(
                school=school,
                academic_year=data.get("academic_year"),
                day=data.get("day"),
                lesson=lesson,
                lesson_detail=lesson,
                teacher=data.get("teacher"),
                subject=data["subject"],
                school_class=data["school_class"],
                section=data.get("section"),
                lesson_date=data["lesson_date"],
                routine_id=data.get("routine_id"),
                room_id=data.get("room_id"),
                class_period_id=data.get("class_period_id"),
                lecture_youube_link=data.get("youtube_link", ""),
                attachment=data.get("photo", ""),
                teaching_method=data.get("teaching_method", ""),
                general_objectives=data.get("general_Objectives", ""),
                previous_knowlege=data.get("previous_knowledge", ""),
                comp_question=data.get("comprehensive_Questions", ""),
                zoom_setup=data.get("zoom_setup", ""),
                presentation=data.get("presentation", ""),
                note=data.get("note", ""),
                created_by=request.user,
                updated_by=request.user,
            )
            if customize == "customize":
                topics = topic_value if isinstance(topic_value, list) else []
                sub_topics = sub_topic_value if isinstance(sub_topic_value, list) else []
                for index, topic_id in enumerate(topics):
                    if topic_id in (None, ""):
                        continue
                    topic_detail = LessonTopicDetail.objects.get(pk=topic_id)
                    LessonPlanTopic.objects.create(
                        lesson_planner=lesson_planner,
                        topic=topic_detail,
                        sub_topic_title=sub_topics[index] if index < len(sub_topics) else "",
                    )
            else:
                topic_detail = LessonTopicDetail.objects.get(pk=topic_value)
                lesson_planner.topic = topic_detail
                lesson_planner.topic_detail = topic_detail
                lesson_planner.sub_topic = sub_topic_value if isinstance(sub_topic_value, str) else ""
                lesson_planner.save(update_fields=["topic", "topic_detail", "sub_topic", "updated_at"])
        output = self.get_serializer(lesson_planner)
        return Response({"success": True, "message": "Lesson planner saved successfully.", "data": output.data}, status=status.HTTP_201_CREATED)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = LessonPlannerCreateSerializer(data=request.data, context=self.get_serializer_context())
        if not serializer.is_valid():
            return Response(self._validation_response(serializer.errors), status=status.HTTP_400_BAD_REQUEST)
        data = serializer.validated_data
        lesson = data["lesson"]
        topic_value = data.get("topic")
        sub_topic_value = data.get("sub_topic")
        customize = data.get("customize")

        with transaction.atomic():
            instance.academic_year = data.get("academic_year")
            instance.day = data.get("day")
            instance.lesson = lesson
            instance.lesson_detail = lesson
            instance.teacher = data.get("teacher")
            instance.subject = data["subject"]
            instance.school_class = data["school_class"]
            instance.section = data.get("section")
            instance.lesson_date = data["lesson_date"]
            instance.routine_id = data.get("routine_id")
            instance.room_id = data.get("room_id")
            instance.class_period_id = data.get("class_period_id")
            instance.lecture_youube_link = data.get("youtube_link", "")
            instance.attachment = data.get("photo", instance.attachment)
            instance.teaching_method = data.get("teaching_method", "")
            instance.general_objectives = data.get("general_Objectives", "")
            instance.previous_knowlege = data.get("previous_knowledge", "")
            instance.comp_question = data.get("comprehensive_Questions", "")
            instance.zoom_setup = data.get("zoom_setup", "")
            instance.presentation = data.get("presentation", "")
            instance.note = data.get("note", "")
            instance.updated_by = request.user
            instance.topic = None
            instance.topic_detail = None
            instance.sub_topic = ""
            instance.save()
            instance.topics.all().delete()
            if customize == "customize":
                topics = topic_value if isinstance(topic_value, list) else []
                sub_topics = sub_topic_value if isinstance(sub_topic_value, list) else []
                for index, topic_id in enumerate(topics):
                    if topic_id in (None, ""):
                        continue
                    topic_detail = LessonTopicDetail.objects.get(pk=topic_id)
                    LessonPlanTopic.objects.create(
                        lesson_planner=instance,
                        topic=topic_detail,
                        sub_topic_title=sub_topics[index] if index < len(sub_topics) else "",
                    )
            else:
                topic_detail = LessonTopicDetail.objects.get(pk=topic_value)
                instance.topic = topic_detail
                instance.topic_detail = topic_detail
                instance.sub_topic = sub_topic_value if isinstance(sub_topic_value, str) else ""
                instance.save(update_fields=["topic", "topic_detail", "sub_topic", "updated_at"])
        output = self.get_serializer(instance)
        return Response({"success": True, "message": "Lesson planner updated successfully.", "data": output.data}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="overview")
    def overview(self, request):
        queryset = self.get_queryset()
        topic_detail_id = request.query_params.get("topic_detail_id")
        if topic_detail_id:
            queryset = queryset.filter(topic_detail_id=topic_detail_id)
        return Response(self.get_serializer(queryset, many=True).data)

    @action(detail=False, methods=["get"], url_path="teachers")
    def teachers(self, request):
        user = request.user
        queryset = User.objects.filter(is_active=True, access_status=True)
        school_id = None
        if not user.is_superuser:
            if not user.school_id:
                return Response([])
            school_id = user.school_id

        # Resolve teacher users from explicit teacher role mapping and staff directory.
        teacher_role_names = {"teacher", "active teacher", "class teacher", "subject teacher", "assistant teacher"}

        def normalize_role_name(value):
            return " ".join((value or "").strip().lower().replace("_", " ").replace("-", " ").split())

        role_links = UserRole.objects.select_related("role", "user")
        if school_id:
            role_links = role_links.filter(Q(user__school_id=school_id) | Q(user__staff_profile__school_id=school_id))

        teacher_user_ids = set()
        for link in role_links:
            if normalize_role_name(getattr(link.role, "name", "")) in teacher_role_names:
                teacher_user_ids.add(link.user_id)

        staff_qs = Staff.objects.filter(status=Staff.STATUS_ACTIVE).filter(
            Q(role__name__icontains="teacher") | Q(designation__name__icontains="teacher")
        )
        if school_id:
            staff_qs = staff_qs.filter(school_id=school_id)

        def generate_username(staff):
            base = ""
            if staff.email:
                base = staff.email.split("@", 1)[0]
            if not base:
                joined = f"{(staff.first_name or '').strip()}.{(staff.last_name or '').strip()}".strip(".")
                base = joined or (staff.staff_no or "teacher")
            normalized = "".join(ch for ch in base.lower() if ch.isalnum() or ch in "._-").strip("._-") or "teacher"
            candidate = normalized
            serial = 1
            while User.objects.filter(username=candidate).exists():
                candidate = f"{normalized}{serial}"
                serial += 1
            return candidate

        for staff in staff_qs.only("id", "user_id", "email", "first_name", "last_name", "staff_no", "school_id", "updated_at"):
            if staff.user_id:
                teacher_user_ids.add(staff.user_id)
                continue

            # Legacy fallback: auto-link teacher staff to an existing user by email.
            if staff.email:
                matched_user = queryset.filter(email__iexact=staff.email).first()
                if matched_user:
                    if not hasattr(matched_user, "staff_profile"):
                        staff.user_id = matched_user.id
                        staff.save(update_fields=["user", "updated_at"])
                    teacher_user_ids.add(matched_user.id)
                    continue

            # Ensure teacher staff without user/email-match still become selectable.
            username = generate_username(staff)
            created_user = User.objects.create(
                username=username,
                first_name=(staff.first_name or "").strip(),
                last_name=(staff.last_name or "").strip(),
                email=(staff.email or "").strip(),
                school_id=staff.school_id,
                is_active=True,
                access_status=True,
            )
            created_user.set_unusable_password()
            created_user.save(update_fields=["password"])
            staff.user_id = created_user.id
            staff.save(update_fields=["user", "updated_at"])
            teacher_user_ids.add(created_user.id)

        if teacher_user_ids:
            queryset = queryset.filter(id__in=teacher_user_ids)
        else:
            queryset = queryset.none()

        queryset = queryset.exclude(is_superuser=True).exclude(is_school_admin=True)

        data = [
            {
                "id": item.id,
                "username": item.username,
                "full_name": item.get_full_name().strip() or item.username,
            }
            for item in queryset.order_by("first_name", "last_name", "username")
        ]
        return Response(data)

    @action(detail=False, methods=["get"], url_path="weekly")
    def weekly(self, request):
        teacher_id = request.query_params.get("teacher_id")
        start_date = request.query_params.get("start_date")

        queryset = self.get_queryset()
        if teacher_id:
            queryset = queryset.filter(teacher_id=teacher_id)

        if start_date:
            try:
                start = datetime.strptime(start_date, "%Y-%m-%d").date()
            except ValueError:
                return Response({"detail": "start_date must be YYYY-MM-DD."}, status=status.HTTP_400_BAD_REQUEST)
        else:
            today = datetime.today().date()
            start = today - timedelta(days=today.weekday())

        end = start + timedelta(days=6)
        queryset = queryset.filter(lesson_date__gte=start, lesson_date__lte=end).order_by("lesson_date", "routine_id", "id")

        day_map = {}
        for item in queryset:
            key = item.lesson_date.isoformat()
            if key not in day_map:
                day_map[key] = []
            day_map[key].append(self.get_serializer(item).data)

        return Response(
            {
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "days": day_map,
            }
        )


# ============================================================
# Staff Assignment Module Views
# ============================================================

class StaffTeachersView(viewsets.ViewSet):
    """GET /api/v1/academics/staff/teachers/ — list active teaching staff."""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        user = request.user
        school_id = getattr(user, "school_id", None)
        if not school_id and not user.is_superuser:
            return Response([], status=status.HTTP_200_OK)

        qs = Staff.objects.select_related("user", "department", "designation").filter(
            status=Staff.STATUS_ACTIVE
        )
        if school_id:
            qs = qs.filter(school_id=school_id)

        # filter to teaching staff only — designation contains "teacher" or dept is Academic
        qs = qs.filter(
            Q(designation__name__icontains="teacher")
            | Q(department__name__icontains="academic")
            | Q(department__dept_type__icontains="academic")
        )

        data = []
        for s in qs:
            full_name = f"{s.first_name} {s.last_name}".strip()
            data.append({
                "id": s.user_id,
                "staff_id": s.id,
                "staff_no": s.staff_no,
                "full_name": full_name,
                "designation": s.designation.name if s.designation else "",
                "department": s.department.name if s.department else "",
                "photo": request.build_absolute_uri(s.staff_photo.url) if s.staff_photo else None,
            })
        return Response(data)


class StaffClassTeachersView(viewsets.ViewSet):
    """Manage ClassTeacherAssignment with lock/unlock workflow."""
    permission_classes = [permissions.IsAuthenticated]

    def _school_id(self, request):
        return getattr(request.user, "school_id", None)

    def list(self, request):
        school_id = self._school_id(request)
        qs = ClassTeacherAssignment.objects.select_related(
            "section", "school_class", "teacher", "academic_year", "locked_by"
        ).filter(active_status=True)
        if school_id:
            qs = qs.filter(school_id=school_id)

        ay_id = request.query_params.get("academic_year_id")
        class_id = request.query_params.get("class_id")
        section_id = request.query_params.get("section_id")
        if ay_id:
            qs = qs.filter(academic_year_id=ay_id)
        if class_id:
            qs = qs.filter(school_class_id=class_id)
        if section_id:
            qs = qs.filter(section_id=section_id)

        data = []
        for ct in qs:
            teacher = ct.teacher
            data.append({
                "id": ct.id,
                "section_id": ct.section_id,
                "section_name": ct.section.name if ct.section else "",
                "class_id": ct.school_class_id,
                "class_name": ct.school_class.name if ct.school_class else "",
                "teacher_id": ct.teacher_id,
                "teacher_name": f"{teacher.first_name} {teacher.last_name}".strip() if teacher else "",
                "academic_year_id": ct.academic_year_id,
                "is_locked": ct.is_locked,
                "locked_at": ct.locked_at.isoformat() if ct.locked_at else None,
                "locked_by_id": ct.locked_by_id,
                "locked_by_name": f"{ct.locked_by.first_name} {ct.locked_by.last_name}".strip() if ct.locked_by else "",
                "created_at": ct.created_at.isoformat(),
            })
        return Response(data)

    def create(self, request):
        school_id = self._school_id(request)
        section_id = request.data.get("section_id")
        teacher_id = request.data.get("teacher_id")
        class_id = request.data.get("class_id")
        academic_year_id = request.data.get("academic_year_id")

        if not all([section_id, teacher_id, class_id, academic_year_id]):
            return Response({"success": False, "message": "section_id, teacher_id, class_id, and academic_year_id are required."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate teacher is active staff
        staff = Staff.objects.filter(user_id=teacher_id, status=Staff.STATUS_ACTIVE).first()
        if not staff:
            return Response({"success": False, "message": "Selected user is not active teaching staff."}, status=status.HTTP_400_BAD_REQUEST)

        # Validate teacher is not already assigned as CT for another section in the same academic year
        existing_ct = ClassTeacherAssignment.objects.filter(
            school_id=school_id,
            academic_year_id=academic_year_id,
            teacher_id=teacher_id,
            active_status=True,
        ).exclude(section_id=section_id).select_related("school_class", "section").first()
        
        if existing_ct:
            class_name = existing_ct.school_class.name if existing_ct.school_class else "Unknown Class"
            section_name = existing_ct.section.name if existing_ct.section else "Unknown Section"
            return Response({
                "success": False,
                "message": f"This teacher is already assigned as Class Teacher for {class_name} - Sec {section_name}. A teacher can only be assigned as Class Teacher to one section."
            }, status=status.HTTP_400_BAD_REQUEST)

        existing = ClassTeacherAssignment.objects.filter(
            school_id=school_id,
            academic_year_id=academic_year_id,
            school_class_id=class_id,
            section_id=section_id,
            active_status=True,
        ).first()

        if existing:
            if existing.is_locked:
                return Response({"success": False, "message": "Class teacher is locked. Use unlock workflow to change."}, status=status.HTTP_400_BAD_REQUEST)
            existing.teacher_id = teacher_id
            existing.save(update_fields=["teacher_id"])
            return Response({"success": True, "message": "Class teacher updated.", "data": {"id": existing.id}})

        ct = ClassTeacherAssignment.objects.create(
            school_id=school_id,
            school_class_id=class_id,
            section_id=section_id,
            teacher_id=teacher_id,
            academic_year_id=academic_year_id,
        )
        return Response({"success": True, "message": "Class teacher assigned.", "data": {"id": ct.id}}, status=status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        school_id = self._school_id(request)
        ct = ClassTeacherAssignment.objects.filter(pk=pk, school_id=school_id).first()
        if not ct:
            return Response({"success": False, "message": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        if ct.is_locked:
            return Response({"success": False, "message": "Assignment is locked."}, status=status.HTTP_400_BAD_REQUEST)

        teacher_id = request.data.get("teacher_id")
        if teacher_id:
            staff = Staff.objects.filter(user_id=teacher_id, status=Staff.STATUS_ACTIVE).first()
            if not staff:
                return Response({"success": False, "message": "Selected user is not active teaching staff."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate teacher is not already assigned as CT for another section in the same academic year
            existing_ct = ClassTeacherAssignment.objects.filter(
                school_id=school_id,
                academic_year_id=ct.academic_year_id,
                teacher_id=teacher_id,
                active_status=True,
            ).exclude(pk=ct.pk).select_related("school_class", "section").first()
            
            if existing_ct:
                class_name = existing_ct.school_class.name if existing_ct.school_class else "Unknown Class"
                section_name = existing_ct.section.name if existing_ct.section else "Unknown Section"
                return Response({
                    "success": False,
                    "message": f"This teacher is already assigned as Class Teacher for {class_name} - Sec {section_name}. A teacher can only be assigned as Class Teacher to one section."
                }, status=status.HTTP_400_BAD_REQUEST)
            
            ct.teacher_id = teacher_id
            ct.save(update_fields=["teacher_id"])
        return Response({"success": True, "message": "Updated."})

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        school_id = self._school_id(request)
        ct = ClassTeacherAssignment.objects.filter(pk=pk, school_id=school_id).first()
        if not ct:
            return Response({"success": False, "message": "Not found."}, status=status.HTTP_404_NOT_FOUND)
        ct.is_locked = True
        ct.locked_at = timezone.now()
        ct.locked_by = request.user
        ct.save(update_fields=["is_locked", "locked_at", "locked_by"])
        return Response({"success": True, "message": "Class teacher locked."})

    @action(detail=True, methods=["post"])
    def unlock(self, request, pk=None):
        school_id = self._school_id(request)
        ct = ClassTeacherAssignment.objects.filter(pk=pk, school_id=school_id).first()
        if not ct:
            return Response({"success": False, "message": "Not found."}, status=status.HTTP_404_NOT_FOUND)

        new_teacher_id = request.data.get("new_teacher_id")
        reason = (request.data.get("reason") or "").strip()
        if not reason:
            return Response({"success": False, "message": "Please enter a reason to continue."}, status=status.HTTP_400_BAD_REQUEST)

        if new_teacher_id:
            staff = Staff.objects.filter(user_id=new_teacher_id, status=Staff.STATUS_ACTIVE).first()
            if not staff:
                return Response({"success": False, "message": "Selected user is not active teaching staff."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Validate teacher is not already assigned as CT for another section in the same academic year
            existing_ct = ClassTeacherAssignment.objects.filter(
                school_id=school_id,
                academic_year_id=ct.academic_year_id,
                teacher_id=new_teacher_id,
                active_status=True,
            ).exclude(pk=ct.pk).select_related("school_class", "section").first()
            
            if existing_ct:
                class_name = existing_ct.school_class.name if existing_ct.school_class else "Unknown Class"
                section_name = existing_ct.section.name if existing_ct.section else "Unknown Section"
                return Response({
                    "success": False,
                    "message": f"This teacher is already assigned as Class Teacher for {class_name} - Sec {section_name}. A teacher can only be assigned as Class Teacher to one section."
                }, status=status.HTTP_400_BAD_REQUEST)

        with transaction.atomic():
            ClassTeacherAudit.objects.create(
                section_id=ct.section_id,
                school_class_id=ct.school_class_id,
                old_teacher_id=ct.teacher_id,
                new_teacher_id=new_teacher_id or ct.teacher_id,
                reason=reason,
                changed_by=request.user,
            )
            ct.is_locked = False
            ct.locked_at = None
            ct.locked_by = None
            if new_teacher_id:
                ct.teacher_id = new_teacher_id
            ct.save()

        return Response({"success": True, "message": "Class teacher unlocked and updated."})


class StaffSubjectAssignmentsView(viewsets.ViewSet):
    """Manage ClassSubjectAssignment teacher assignments."""
    permission_classes = [permissions.IsAuthenticated]

    def _school_id(self, request):
        return getattr(request.user, "school_id", None)

    def list(self, request):
        from apps.core.models import Section, Subject as CoreSubject
        
        school_id = self._school_id(request)
        academic_year_id = request.query_params.get("academic_year_id")
        class_id_filter = request.query_params.get("class_id")
        section_id_filter = request.query_params.get("section_id")

        # Step 1: Get all sections for context (to auto-create assignments from catalog)
        sections_qs = Section.objects.all()
        if school_id:
            sections_qs = sections_qs.filter(school_class__school_id=school_id)
        if class_id_filter:
            sections_qs = sections_qs.filter(school_class_id=class_id_filter)
        if section_id_filter:
            sections_qs = sections_qs.filter(id=section_id_filter)

        # Step 2: Get catalog entries from Foundation (class-level subject catalog)
        catalog_qs = ClassSubjectEntry.objects.select_related("school_class").filter(active_status=True)
        if school_id:
            catalog_qs = catalog_qs.filter(school_id=school_id)
        if class_id_filter:
            catalog_qs = catalog_qs.filter(school_class_id=class_id_filter)

        # Step 3: Auto-create ClassSubjectAssignment records from catalog entries if they don't exist
        # This ensures every section has assignment records for all catalog subjects
        for section in sections_qs:
            catalog_for_class = catalog_qs.filter(school_class_id=section.school_class_id)
            for entry in catalog_for_class:
                # Find or create Subject in core.Subject based on catalog entry
                subject, _ = CoreSubject.objects.get_or_create(
                    school_id=school_id,
                    name=entry.name,
                    defaults={
                        "code": entry.code or "",
                        "subject_type": "optional" if entry.subject_type == ClassSubjectEntry.TYPE_OPTIONAL else "compulsory",
                    },
                )
                
                # Create or get assignment for this section + subject (with teacher=null initially)
                ClassSubjectAssignment.objects.get_or_create(
                    school_id=school_id,
                    academic_year_id=academic_year_id if academic_year_id else None,
                    school_class_id=section.school_class_id,
                    section_id=section.id,
                    subject_id=subject.id,
                    defaults={
                        "is_optional": entry.subject_type == ClassSubjectEntry.TYPE_OPTIONAL,
                        "active_status": True,
                    },
                )

        # Step 4: Fetch all assignments (now includes auto-created ones from catalog)
        assignments_qs = ClassSubjectAssignment.objects.select_related(
            "section", "school_class", "subject", "teacher", "academic_year"
        ).filter(active_status=True)
        if school_id:
            assignments_qs = assignments_qs.filter(school_id=school_id)
        if academic_year_id:
            assignments_qs = assignments_qs.filter(
                Q(section__isnull=True) |
                Q(academic_year_id=academic_year_id) |
                Q(academic_year__isnull=True)
            )
        if class_id_filter:
            assignments_qs = assignments_qs.filter(school_class_id=class_id_filter)
        if section_id_filter:
            assignments_qs = assignments_qs.filter(section_id=section_id_filter)

        # Step 5: Build result list (deduplicate if needed)
        seen: dict[tuple, dict] = {}
        for sa in assignments_qs.order_by("school_class_id", "section_id", "subject_id", "-academic_year_id"):
            key = (sa.school_class_id, sa.section_id, sa.subject_id)
            if key not in seen:
                teacher = sa.teacher
                seen[key] = {
                    "id": sa.id,
                    "section_id": sa.section_id,
                    "section_name": sa.section.name if sa.section else "",
                    "class_id": sa.school_class_id,
                    "class_name": sa.school_class.name if sa.school_class else "",
                    "subject_id": sa.subject_id,
                    "subject_name": sa.subject.name if sa.subject else "",
                    "teacher_id": sa.teacher_id,
                    "teacher_name": f"{teacher.first_name} {teacher.last_name}".strip() if teacher else "",
                    "academic_year_id": sa.academic_year_id,
                    "is_optional": sa.is_optional,
                }

        return Response(list(seen.values()))

    def create(self, request):
        school_id = self._school_id(request)
        section_id = request.data.get("section_id")
        subject_id = request.data.get("subject_id")
        teacher_id = request.data.get("teacher_id")
        class_id = request.data.get("class_id")
        academic_year_id = request.data.get("academic_year_id")
        # Bulk: assign to all sections of a class
        bulk_class = request.data.get("bulk_class", False)

        if not all([subject_id, teacher_id, class_id, academic_year_id]):
            return Response({"success": False, "message": "subject_id, teacher_id, class_id, and academic_year_id are required."}, status=status.HTTP_400_BAD_REQUEST)

        staff = Staff.objects.filter(user_id=teacher_id, status=Staff.STATUS_ACTIVE).first()
        if not staff:
            return Response({"success": False, "message": "Selected user is not active teaching staff."}, status=status.HTTP_400_BAD_REQUEST)

        from apps.core.models import Section
        if bulk_class:
            sections = Section.objects.filter(school_class_id=class_id)
        elif section_id:
            sections = Section.objects.filter(pk=section_id)
        else:
            return Response({"success": False, "message": "section_id required (or set bulk_class=true)."}, status=status.HTTP_400_BAD_REQUEST)

        updated = 0
        for sec in sections:
            existing = ClassSubjectAssignment.objects.filter(
                school_id=school_id,
                academic_year_id=academic_year_id,
                school_class_id=class_id,
                section_id=sec.id,
                subject_id=subject_id,
                active_status=True,
            ).first()
            if existing:
                existing.teacher_id = teacher_id
                existing.save(update_fields=["teacher_id"])
                updated += 1
            # If no existing subject assignment exists we skip (subject must be set up first)

        return Response({"success": True, "message": f"Subject teacher assigned to {updated} section(s)."})

    def partial_update(self, request, pk=None):
        """PATCH /staff/subject-assignments/{pk}/ — assign a teacher to a subject row (bypasses section validation)."""
        school_id = self._school_id(request)
        teacher_id = request.data.get("teacher_id")

        if not teacher_id:
            return Response(
                {"success": False, "message": "teacher_id is required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            teacher_id = int(teacher_id)
        except (TypeError, ValueError):
            return Response(
                {"success": False, "message": "teacher_id must be a valid integer."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            sa = ClassSubjectAssignment.objects.get(pk=pk, active_status=True)
        except ClassSubjectAssignment.DoesNotExist:
            return Response(
                {"success": False, "message": "Subject assignment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Ensure assignment belongs to this school (tenant isolation)
        if school_id and sa.school_id != school_id:
            return Response(
                {"success": False, "message": "Subject assignment not found."},
                status=status.HTTP_404_NOT_FOUND,
            )

        # Validate teacher is active staff
        staff = Staff.objects.filter(user_id=teacher_id, status=Staff.STATUS_ACTIVE).first()
        if not staff:
            return Response(
                {"success": False, "message": "Selected user is not active teaching staff."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        sa.teacher_id = teacher_id
        sa.save(update_fields=["teacher_id"])

        teacher = sa.teacher
        return Response({
            "success": True,
            "message": "Subject teacher assigned.",
            "data": {
                "id": sa.id,
                "teacher_id": sa.teacher_id,
                "teacher_name": f"{teacher.first_name} {teacher.last_name}".strip() if teacher else "",
            },
        })


class StaffWorkloadView(viewsets.ViewSet):
    """GET /api/v1/academics/staff/workload/ — workload per teacher."""
    permission_classes = [permissions.IsAuthenticated]

    MAX_PERIODS = 28  # default, can be overridden by query param

    def list(self, request):
        school_id = getattr(request.user, "school_id", None)
        academic_year_id = request.query_params.get("academic_year_id")
        max_periods = int(request.query_params.get("max_periods", self.MAX_PERIODS))

        # Count routine slot periods per teacher
        qs = ClassRoutineSlot.objects.filter(
            is_break=False, active_status=True, teacher__isnull=False
        )
        if school_id:
            qs = qs.filter(school_id=school_id)
        if academic_year_id:
            qs = qs.filter(academic_year_id=academic_year_id)

        from django.db.models import Count as DjCount
        teacher_periods = {}
        for slot in qs.select_related("teacher"):
            tid = slot.teacher_id
            teacher_periods.setdefault(tid, {"teacher": slot.teacher, "periods": 0, "sections": set(), "subjects": set()})
            teacher_periods[tid]["periods"] += 1
            if slot.section_id:
                teacher_periods[tid]["sections"].add(slot.section_id)
            if slot.subject_id:
                teacher_periods[tid]["subjects"].add(slot.subject_id)

        # Also include subject assignments for teachers with no timetable yet
        sa_qs = ClassSubjectAssignment.objects.filter(active_status=True, teacher__isnull=False)
        if school_id:
            sa_qs = sa_qs.filter(school_id=school_id)
        if academic_year_id:
            sa_qs = sa_qs.filter(academic_year_id=academic_year_id)

        for sa in sa_qs.select_related("teacher"):
            tid = sa.teacher_id
            if tid not in teacher_periods:
                teacher_periods[tid] = {"teacher": sa.teacher, "periods": 0, "sections": set(), "subjects": set()}
            if sa.section_id:
                teacher_periods[tid]["sections"].add(sa.section_id)
            if sa.subject_id:
                teacher_periods[tid]["subjects"].add(sa.subject_id)

        data = []
        for tid, info in teacher_periods.items():
            t = info["teacher"]
            periods = info["periods"]
            pct = (periods / max_periods * 100) if max_periods else 0
            is_overloaded = periods > max_periods
            if pct >= 100:
                load_status = "overloaded"
            elif pct >= 85:
                load_status = "near-limit"
            else:
                load_status = "normal"

            data.append({
                "teacher_id": tid,
                "teacher_name": f"{t.first_name} {t.last_name}".strip() if t else "",
                "periods_per_week": periods,
                "max_periods": max_periods,
                "sections_count": len(info["sections"]),
                "subjects_count": len(info["subjects"]),
                "load_pct": round(pct, 1),
                "is_overloaded": is_overloaded,
                "status": load_status,
            })

        data.sort(key=lambda x: -x["periods_per_week"])
        return Response(data)


class StaffAuditLogView(viewsets.ViewSet):
    """GET /api/v1/academics/staff/audit-log/"""
    permission_classes = [permissions.IsAuthenticated]

    def list(self, request):
        school_id = getattr(request.user, "school_id", None)
        qs = ClassTeacherAudit.objects.select_related(
            "section", "school_class", "old_teacher", "new_teacher", "changed_by"
        ).order_by("-changed_at")

        section_id = request.query_params.get("section_id")
        if section_id:
            qs = qs.filter(section_id=section_id)

        data = []
        for log in qs[:100]:
            data.append({
                "id": log.id,
                "section_id": log.section_id,
                "section_name": log.section.name if log.section else "",
                "class_name": log.school_class.name if log.school_class else "",
                "old_teacher_id": log.old_teacher_id,
                "old_teacher_name": f"{log.old_teacher.first_name} {log.old_teacher.last_name}".strip() if log.old_teacher else "",
                "new_teacher_id": log.new_teacher_id,
                "new_teacher_name": f"{log.new_teacher.first_name} {log.new_teacher.last_name}".strip() if log.new_teacher else "",
                "reason": log.reason,
                "changed_by_id": log.changed_by_id,
                "changed_by_name": f"{log.changed_by.first_name} {log.changed_by.last_name}".strip() if log.changed_by else "",
                "changed_at": log.changed_at.isoformat(),
            })
        return Response(data)


class StaffDashboardKPIView(viewsets.ViewSet):
    """GET /api/v1/academics/staff/kpi/ — dashboard KPI stats."""
    permission_classes = [permissions.IsAuthenticated]

    MAX_PERIODS = 28

    def list(self, request):
        school_id = getattr(request.user, "school_id", None)
        academic_year_id = request.query_params.get("academic_year_id")
        max_periods = int(request.query_params.get("max_periods", self.MAX_PERIODS))

        staff_qs = Staff.objects.filter(status=Staff.STATUS_ACTIVE)
        if school_id:
            staff_qs = staff_qs.filter(school_id=school_id)
        teaching_staff = staff_qs.filter(
            Q(designation__name__icontains="teacher")
            | Q(department__name__icontains="academic")
        )
        total_teachers = teaching_staff.count()

        ct_qs = ClassTeacherAssignment.objects.filter(active_status=True)
        if school_id:
            ct_qs = ct_qs.filter(school_id=school_id)
        if academic_year_id:
            ct_qs = ct_qs.filter(academic_year_id=academic_year_id)
        ct_assigned = ct_qs.count()

        slot_qs = ClassRoutineSlot.objects.filter(is_break=False, active_status=True, teacher__isnull=False)
        if school_id:
            slot_qs = slot_qs.filter(school_id=school_id)
        if academic_year_id:
            slot_qs = slot_qs.filter(academic_year_id=academic_year_id)

        teacher_periods: dict[int, int] = {}
        for slot in slot_qs.values_list("teacher_id", flat=True):
            teacher_periods[slot] = teacher_periods.get(slot, 0) + 1

        avg_load = 0.0
        overloaded = 0
        if teacher_periods:
            avg_load = round(sum(teacher_periods.values()) / len(teacher_periods), 1)
            overloaded = sum(1 for p in teacher_periods.values() if p > max_periods)

        return Response({
            "total_teachers": total_teachers,
            "ct_assigned": ct_assigned,
            "avg_load": avg_load,
            "overloaded": overloaded,
        })
