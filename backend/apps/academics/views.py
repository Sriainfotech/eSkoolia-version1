from datetime import datetime, timedelta

from django.db import transaction
from django.db.models import Q
from django.core.files.storage import default_storage
from rest_framework import permissions, status, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.parsers import FormParser, MultiPartParser, JSONParser
from rest_framework.response import Response
from apps.access_control.models import UserRole
from apps.hr.models import Staff
from apps.users.models import User
from .models import (
    ClassOptionalSubjectSetup,
    ClassRoutineSlot,
    ClassSubjectAssignment,
    ClassTeacherAssignment,
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
            queryset = queryset.filter(class_id_ref_id=class_id)

        if section_id not in (None, ""):
            queryset = queryset.filter(section_id_ref_id=section_id)

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
