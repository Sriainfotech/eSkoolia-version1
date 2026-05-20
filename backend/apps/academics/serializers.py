import os
from datetime import time as time_obj

from rest_framework import serializers
from django.db.models import Q
from django.core.files.storage import default_storage
from django.core.files.base import ContentFile
from apps.access_control.models import UserRole
from apps.hr.models import Staff
from apps.users.models import User
from .models import (
    ClassOptionalSubjectSetup,
    ClassRoutineSlot,
    ClassSubjectAssignment,
    ClassSubjectEntry,
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


class ClassSubjectEntrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ClassSubjectEntry
        fields = [
            "id", "school", "school_class", "name", "code",
            "subject_type", "periods_per_week", "active_status", "created_at",
        ]
        read_only_fields = ["id", "school", "created_at"]


class LegacyAliasMixin(serializers.ModelSerializer):
    """Expose legacy PHP-style *_id keys while keeping FK-backed models."""


TEACHER_ROLE_NAMES = {
    "teacher",
    "active teacher",
    "class teacher",
    "subject teacher",
    "assistant teacher",
}


def _normalize_role_name(value: str) -> str:
    return " ".join((value or "").strip().lower().replace("_", " ").replace("-", " ").split())


def _is_teacher_user(user_id: int) -> bool:
    role_names = UserRole.objects.filter(user_id=user_id).values_list("role__name", flat=True)
    if any(_normalize_role_name(name) in TEACHER_ROLE_NAMES for name in role_names):
        return True

    return Staff.objects.filter(user_id=user_id, status=Staff.STATUS_ACTIVE).filter(
        Q(role__name__icontains="teacher") | Q(designation__name__icontains="teacher")
    ).exists()


class ClassSubjectAssignmentSerializer(LegacyAliasMixin):
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=ClassSubjectAssignment._meta.get_field("school_class").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section", queryset=ClassSubjectAssignment._meta.get_field("section").related_model.objects.all())
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=ClassSubjectAssignment._meta.get_field("subject").related_model.objects.all())
    teacher_id = serializers.PrimaryKeyRelatedField(source="teacher", queryset=ClassSubjectAssignment._meta.get_field("teacher").related_model.objects.all())
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=ClassSubjectAssignment._meta.get_field("academic_year").related_model.objects.all())

    def validate(self, attrs):
        attrs = super().validate(attrs)

        academic_year = attrs.get("academic_year") or getattr(self.instance, "academic_year", None)
        school_class = attrs.get("school_class") or getattr(self.instance, "school_class", None)
        section = attrs.get("section") or getattr(self.instance, "section", None)
        subject = attrs.get("subject") or getattr(self.instance, "subject", None)
        teacher = attrs.get("teacher") or getattr(self.instance, "teacher", None)

        errors = {}

        if not academic_year:
            errors.setdefault("academic_year", []).append("Academic year is required")
        if not school_class:
            errors.setdefault("school_class", []).append("Class is required")
        if not section:
            errors.setdefault("section", []).append("Section is required")
        if not subject:
            errors.setdefault("subject", []).append("Subject is required")
        if not teacher:
            errors.setdefault("teacher", []).append("Teacher is required")

        if errors:
            raise serializers.ValidationError(errors)

        # Validate section belongs to selected class
        if section and school_class and section.school_class_id != school_class.id:
            raise serializers.ValidationError({"message": "Invalid class and section combination"})

        # Validate teacher exists and is active
        teacher_obj = User.objects.filter(id=teacher.id).first()
        if not teacher_obj or not teacher_obj.is_active or not getattr(teacher_obj, "access_status", True):
            raise serializers.ValidationError({"teacher": ["Selected teacher is inactive"]})

        # Validate teacher has Teacher role
        if not _is_teacher_user(teacher.id):
            raise serializers.ValidationError({"message": "Selected user is not a teacher"})

        # Validate no duplicate assignment (unique constraint scope)
        school = attrs.get("school") or getattr(self.instance, "school", None)
        request = self.context.get("request")
        if not school and request and getattr(request.user, "school", None):
            school = request.user.school

        duplicate_qs = ClassSubjectAssignment.objects.filter(
            school=school,
            academic_year=academic_year,
            school_class=school_class,
            section=section,
            subject=subject,
        )
        if self.instance is not None:
            duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)

        if duplicate_qs.exists():
            raise serializers.ValidationError({"message": "Subject already assigned for this class and section"})

        return attrs

    class Meta:
        model = ClassSubjectAssignment
        fields = [
            "id",
            "school",
            "academic_year_id",
            "class_id",
            "section_id",
            "subject_id",
            "teacher_id",
            "school_class",
            "section",
            "subject",
            "teacher",
            "academic_year",
            "is_optional",
            "active_status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "school_class",
            "section",
            "subject",
            "teacher",
            "academic_year",
            "created_at",
        ]
        validators = []


class ClassTeacherAssignmentSerializer(LegacyAliasMixin):
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=ClassTeacherAssignment._meta.get_field("school_class").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section", queryset=ClassTeacherAssignment._meta.get_field("section").related_model.objects.all())
    teacher_id = serializers.PrimaryKeyRelatedField(source="teacher", queryset=ClassTeacherAssignment._meta.get_field("teacher").related_model.objects.all())
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=ClassTeacherAssignment._meta.get_field("academic_year").related_model.objects.all())

    def validate(self, attrs):
        attrs = super().validate(attrs)

        academic_year = attrs.get("academic_year") or getattr(self.instance, "academic_year", None)
        school_class = attrs.get("school_class") or getattr(self.instance, "school_class", None)
        section = attrs.get("section") or getattr(self.instance, "section", None)
        teacher = attrs.get("teacher") or getattr(self.instance, "teacher", None)

        errors = {}

        if not academic_year:
            errors.setdefault("academic_year", []).append("Academic year is required")
        if not school_class:
            errors.setdefault("school_class", []).append("Class is required")
        if not section:
            errors.setdefault("section", []).append("Section is required")
        if not teacher:
            errors.setdefault("teacher", []).append("Teacher is required")

        if errors:
            raise serializers.ValidationError(errors)

        if section and school_class and section.school_class_id != school_class.id:
            raise serializers.ValidationError({"message": "Invalid class and section combination"})

        teacher_obj = User.objects.filter(id=teacher.id).first()
        if not teacher_obj or not teacher_obj.is_active or not getattr(teacher_obj, "access_status", True):
            raise serializers.ValidationError({"teacher": ["Selected teacher is inactive"]})

        if not _is_teacher_user(teacher.id):
            raise serializers.ValidationError({"message": "Selected user is not a teacher"})

        # Validate class-section is set up for the academic year (check if any subject is assigned)
        school = attrs.get("school") or getattr(self.instance, "school", None)
        request = self.context.get("request")
        if not school and request and getattr(request.user, "school", None):
            school = request.user.school

        has_subject_assignment = ClassSubjectAssignment.objects.filter(
            school=school,
            academic_year=academic_year,
            school_class=school_class,
            section=section,
        ).exists()
        if not has_subject_assignment:
            raise serializers.ValidationError(
                {"message": "No subjects are assigned for this class and section in the selected academic year. Please assign subjects first."}
            )

        duplicate_qs = ClassTeacherAssignment.objects.filter(
            school=school,
            academic_year=academic_year,
            school_class=school_class,
            section=section,
        )
        if self.instance is not None:
            duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)

        if duplicate_qs.exists():
            raise serializers.ValidationError({"message": "Class teacher already assigned for this class and section"})

        return attrs

    class Meta:
        model = ClassTeacherAssignment
        fields = [
            "id",
            "school",
            "academic_year_id",
            "class_id",
            "section_id",
            "teacher_id",
            "academic_year",
            "school_class",
            "section",
            "teacher",
            "active_status",
            "created_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "academic_year",
            "school_class",
            "section",
            "teacher",
            "created_at",
        ]
        validators = []


class ClassRoutineSlotSerializer(LegacyAliasMixin):
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=ClassRoutineSlot._meta.get_field("school_class").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section", queryset=ClassRoutineSlot._meta.get_field("section").related_model.objects.all())
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=ClassRoutineSlot._meta.get_field("subject").related_model.objects.all(), required=False, allow_null=True)
    teacher_id = serializers.PrimaryKeyRelatedField(source="teacher", queryset=ClassRoutineSlot._meta.get_field("teacher").related_model.objects.all(), required=False, allow_null=True)
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=ClassRoutineSlot._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)

    class Meta:
        model = ClassRoutineSlot
        fields = [
            "id",
            "school",
            "academic_year_id",
            "class_id",
            "section_id",
            "subject_id",
            "teacher_id",
            "academic_year",
            "school_class",
            "section",
            "subject",
            "teacher",
            "day",
            "day_id",
            "class_period_id",
            "start_time",
            "end_time",
            "room_id",
            "room",
            "is_break",
            "active_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "academic_year",
            "school_class",
            "section",
            "subject",
            "teacher",
            "created_at",
            "updated_at",
        ]
        validators = []

    def _normalize_room(self, attrs):
        room_id = attrs.get("room_id")
        room = (attrs.get("room") or getattr(self.instance, "room", "") or "").strip()
        attrs["room"] = room
        if room_id in (None, ""):
            attrs["room_id"] = None
        return room_id, room

    def _overlap_exists(self, queryset, start_time, end_time):
        return queryset.filter(start_time__lt=end_time, end_time__gt=start_time).exists()

    def _value_from_attrs_or_instance(self, attrs, key):
        if key in attrs:
            return attrs.get(key)
        return getattr(self.instance, key, None)

    def validate(self, attrs):
        attrs = super().validate(attrs)

        school = self._value_from_attrs_or_instance(attrs, "school")
        request = self.context.get("request")
        if not school and request and getattr(request.user, "school", None):
            school = request.user.school

        academic_year = self._value_from_attrs_or_instance(attrs, "academic_year")
        school_class = self._value_from_attrs_or_instance(attrs, "school_class")
        section = self._value_from_attrs_or_instance(attrs, "section")
        subject = self._value_from_attrs_or_instance(attrs, "subject")
        teacher = self._value_from_attrs_or_instance(attrs, "teacher")
        day = self._value_from_attrs_or_instance(attrs, "day")
        start_time = self._value_from_attrs_or_instance(attrs, "start_time")
        end_time = self._value_from_attrs_or_instance(attrs, "end_time")
        is_break = bool(attrs.get("is_break", getattr(self.instance, "is_break", False)))
        room_id, room = self._normalize_room(attrs)

        errors = {}

        if not school_class:
            errors.setdefault("school_class", []).append("Class is required")
        if not section:
            errors.setdefault("section", []).append("Section is required")
        if not day:
            errors.setdefault("day", []).append("Day is required")
        if not start_time:
            errors.setdefault("start_time", []).append("Start time is required")
        if not end_time:
            errors.setdefault("end_time", []).append("End time is required")

        if errors:
            raise serializers.ValidationError(errors)

        if section and school_class and section.school_class_id != school_class.id:
            raise serializers.ValidationError({"message": "Invalid class and section combination"})

        if start_time == time_obj(0, 0) or end_time == time_obj(0, 0):
            raise serializers.ValidationError({"message": "Invalid time value"})

        if end_time <= start_time:
            raise serializers.ValidationError({"message": "End time must be greater than start time"})

        if is_break:
            if subject:
                raise serializers.ValidationError({"subject": ["Break should not have a subject"]})
            if teacher:
                raise serializers.ValidationError({"teacher": ["Break should not have a teacher"]})
        else:
            if not subject:
                raise serializers.ValidationError({"subject": ["Subject is required"]})
            if not teacher:
                raise serializers.ValidationError({"teacher": ["Teacher is required"]})

        if teacher:
            teacher_obj = User.objects.filter(id=teacher.id).first()
            if not teacher_obj or not teacher_obj.is_active or not getattr(teacher_obj, "access_status", True):
                raise serializers.ValidationError({"teacher": ["Selected teacher is inactive"]})
            has_teacher_role = UserRole.objects.filter(user_id=teacher.id, role__name__icontains="teacher").exists()
            if not has_teacher_role:
                raise serializers.ValidationError({"message": "Selected user is not a teacher"})

        if school_class and day and start_time and end_time:
            room_filters = {
                "school": school,
                "academic_year": academic_year,
                "school_class": school_class,
                "section": section,
                "day": day,
                "start_time": start_time,
                "end_time": end_time,
                "subject": subject,
                "teacher": teacher,
                "is_break": is_break,
            }
            if room_id not in (None, ""):
                room_filters["room_id"] = room_id
            elif room:
                room_filters["room__iexact"] = room

            duplicate_qs = ClassRoutineSlot.objects.filter(**room_filters)
            if self.instance is not None:
                duplicate_qs = duplicate_qs.exclude(pk=self.instance.pk)
            if duplicate_qs.exists():
                raise serializers.ValidationError({"message": "Duplicate timetable entry"})

        if school_class and day and start_time and end_time:
            class_conflict_qs = ClassRoutineSlot.objects.filter(
                school=school,
                academic_year=academic_year,
                school_class=school_class,
                section=section,
                day=day,
            )
            if self.instance is not None:
                class_conflict_qs = class_conflict_qs.exclude(pk=self.instance.pk)
            if self._overlap_exists(class_conflict_qs, start_time, end_time):
                raise serializers.ValidationError({"message": "This class already has a subject scheduled at this time"})

        if teacher and day and start_time and end_time:
            teacher_conflict_qs = ClassRoutineSlot.objects.filter(
                school=school,
                academic_year=academic_year,
                teacher=teacher,
                day=day,
            )
            if self.instance is not None:
                teacher_conflict_qs = teacher_conflict_qs.exclude(pk=self.instance.pk)
            if self._overlap_exists(teacher_conflict_qs, start_time, end_time):
                raise serializers.ValidationError({"message": "Teacher is already assigned during this time"})

        if room and day and start_time and end_time:
            room_conflict_qs = ClassRoutineSlot.objects.filter(
                school=school,
                academic_year=academic_year,
                day=day,
            )
            if room_id not in (None, ""):
                room_conflict_qs = room_conflict_qs.filter(room_id=room_id)
            else:
                room_conflict_qs = room_conflict_qs.filter(room__iexact=room)
            if self.instance is not None:
                room_conflict_qs = room_conflict_qs.exclude(pk=self.instance.pk)
            if self._overlap_exists(room_conflict_qs, start_time, end_time):
                raise serializers.ValidationError({"message": "Room is already occupied at this time"})

        if is_break and school_class and day and start_time and end_time:
            break_conflict_qs = ClassRoutineSlot.objects.filter(
                school=school,
                academic_year=academic_year,
                school_class=school_class,
                section=section,
                day=day,
            )
            if self.instance is not None:
                break_conflict_qs = break_conflict_qs.exclude(pk=self.instance.pk)
            if self._overlap_exists(break_conflict_qs, start_time, end_time):
                raise serializers.ValidationError({"message": "Break overlaps with an existing class schedule"})

        attrs["room"] = room
        return attrs


class ClassOptionalSubjectSetupSerializer(LegacyAliasMixin):
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=ClassOptionalSubjectSetup._meta.get_field("school_class").related_model.objects.all())
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=ClassOptionalSubjectSetup._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)

    class Meta:
        model = ClassOptionalSubjectSetup
        fields = [
            "id",
            "school",
            "academic_year_id",
            "class_id",
            "academic_year",
            "school_class",
            "gpa_above",
            "active_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "academic_year",
            "school_class",
            "created_at",
            "updated_at",
        ]
        validators = []


class OptionalSubjectAssignmentSerializer(LegacyAliasMixin):
    student_id = serializers.PrimaryKeyRelatedField(source="student", queryset=OptionalSubjectAssignment._meta.get_field("student").related_model.objects.all())
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=OptionalSubjectAssignment._meta.get_field("subject").related_model.objects.all())
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=OptionalSubjectAssignment._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)

    class Meta:
        model = OptionalSubjectAssignment
        fields = [
            "id",
            "student_id",
            "subject_id",
            "academic_year_id",
            "student",
            "subject",
            "academic_year",
            "active_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "student", "subject", "academic_year", "created_at", "updated_at"]
        validators = []


class HomeworkSubmissionSerializer(LegacyAliasMixin):
    homework_id = serializers.PrimaryKeyRelatedField(source="homework", queryset=HomeworkSubmission._meta.get_field("homework").related_model.objects.all())
    student_id = serializers.PrimaryKeyRelatedField(source="student", queryset=HomeworkSubmission._meta.get_field("student").related_model.objects.all())

    class Meta:
        model = HomeworkSubmission
        fields = [
            "id",
            "homework_id",
            "student_id",
            "homework",
            "student",
            "marks",
            "complete_status",
            "note",
            "file",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "homework", "student", "created_by", "created_at", "updated_at"]
        validators = []


class HomeworkSerializer(LegacyAliasMixin):
    class_id = serializers.PrimaryKeyRelatedField(source="class_id_ref", queryset=Homework._meta.get_field("class_id_ref").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section_id_ref", queryset=Homework._meta.get_field("section_id_ref").related_model.objects.all(), allow_null=True, required=False)
    subject_id = serializers.PrimaryKeyRelatedField(source="subject_id_ref", queryset=Homework._meta.get_field("subject_id_ref").related_model.objects.all())
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=Homework._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)
    file_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    evaluations = HomeworkSubmissionSerializer(many=True, read_only=True)

    class Meta:
        model = Homework
        fields = [
            "id",
            "school",
            "academic_year_id",
            "class_id",
            "section_id",
            "subject_id",
            "file_upload",
            "academic_year",
            "class_id_ref",
            "section_id_ref",
            "subject_id_ref",
            "homework_date",
            "submission_date",
            "evaluation_date",
            "marks",
            "description",
            "file",
            "created_by",
            "evaluated_by",
            "active_status",
            "evaluations",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "academic_year",
            "class_id_ref",
            "section_id_ref",
            "subject_id_ref",
            "created_by",
            "evaluated_by",
            "evaluations",
            "created_at",
            "updated_at",
        ]
        validators = []

    def validate(self, attrs):
        attrs = super().validate(attrs)

        school_class = attrs.get("class_id_ref") or getattr(self.instance, "class_id_ref", None)
        section = attrs.get("section_id_ref") or getattr(self.instance, "section_id_ref", None)
        subject = attrs.get("subject_id_ref") or getattr(self.instance, "subject_id_ref", None)
        description = (attrs.get("description") or getattr(self.instance, "description", "") or "").strip()
        homework_date = attrs.get("homework_date") or getattr(self.instance, "homework_date", None)
        submission_date = attrs.get("submission_date") or getattr(self.instance, "submission_date", None)
        evaluation_date = attrs.get("evaluation_date") if "evaluation_date" in attrs else getattr(self.instance, "evaluation_date", None)

        errors = {}

        if not school_class:
            errors.setdefault("class_id", []).append("Class is required")
        if not subject:
            errors.setdefault("subject_id", []).append("Subject is required")
        if not description:
            errors.setdefault("description", []).append("Description is required")
        if not homework_date:
            errors.setdefault("homework_date", []).append("Homework date is required")
        if not submission_date:
            errors.setdefault("submission_date", []).append("Submission date is required")

        if homework_date and submission_date and submission_date < homework_date:
            errors.setdefault("submission_date", []).append("Submission date must be on or after homework date")

        if evaluation_date and submission_date and evaluation_date < submission_date:
            errors.setdefault("evaluation_date", []).append("Evaluation date must be on or after submission date")

        if section and school_class and section.school_class_id != school_class.id:
            raise serializers.ValidationError({"message": "Invalid class and section combination"})

        if errors:
            raise serializers.ValidationError(errors)

        file_upload = attrs.pop("file_upload", None)
        if file_upload:
            upload_path = default_storage.save(f"academics/homework/{file_upload.name}", ContentFile(file_upload.read()))
            attrs["file"] = upload_path

        attrs["description"] = description
        return attrs


class UploadedContentSerializer(LegacyAliasMixin):
    ALLOWED_FILE_EXTENSIONS = {".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".txt", ".zip", ".jpg", ".jpeg", ".png", ".mp4", ".mp3"}

    class_id = serializers.PrimaryKeyRelatedField(source="class_id_ref", queryset=UploadedContent._meta.get_field("class_id_ref").related_model.objects.all(), allow_null=True, required=False)
    section_id = serializers.PrimaryKeyRelatedField(source="section_id_ref", queryset=UploadedContent._meta.get_field("section_id_ref").related_model.objects.all(), allow_null=True, required=False)
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=UploadedContent._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)
    file_upload = serializers.FileField(write_only=True, required=False, allow_null=True)
    remove_upload_file = serializers.BooleanField(write_only=True, required=False, default=False)

    class Meta:
        model = UploadedContent
        fields = [
            "id",
            "school",
            "academic_year_id",
            "class_id",
            "section_id",
            "file_upload",
            "remove_upload_file",
            "academic_year",
            "class_id_ref",
            "section_id_ref",
            "content_title",
            "content_type",
            "available_for_admin",
            "available_for_all_classes",
            "upload_date",
            "description",
            "source_url",
            "upload_file",
            "created_by",
            "active_status",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "academic_year",
            "class_id_ref",
            "section_id_ref",
            "created_by",
            "created_at",
            "updated_at",
        ]
        validators = []

    def _delete_stored_file(self, file_path):
        path = (file_path or "").strip()
        if not path:
            return
        normalized = path.lstrip("/")
        try:
            if default_storage.exists(normalized):
                default_storage.delete(normalized)
        except Exception:
            # Intentionally ignore storage deletion failures to avoid blocking content updates.
            pass

    def validate(self, attrs):
        attrs = super().validate(attrs)
        self._file_to_delete = None

        content_title = (attrs.get("content_title") or getattr(self.instance, "content_title", "") or "").strip()
        content_type = attrs.get("content_type") or getattr(self.instance, "content_type", None)
        upload_date = attrs.get("upload_date") or getattr(self.instance, "upload_date", None)
        available_for_all_classes = bool(attrs.get("available_for_all_classes", getattr(self.instance, "available_for_all_classes", False)))
        school_class = attrs.get("class_id_ref") or getattr(self.instance, "class_id_ref", None)
        section = attrs.get("section_id_ref") or getattr(self.instance, "section_id_ref", None)

        errors = {}
        if not content_title:
            errors.setdefault("content_title", []).append("Content title is required")
        if not content_type:
            errors.setdefault("content_type", []).append("Content type is required")
        if not upload_date:
            errors.setdefault("upload_date", []).append("Upload date is required")
        if not available_for_all_classes and not school_class:
            errors.setdefault("class_id", []).append("Class is required")

        if section and school_class and section.school_class_id != school_class.id:
            raise serializers.ValidationError({"message": "Invalid class and section combination"})

        file_upload = attrs.pop("file_upload", None)
        remove_upload_file = bool(attrs.pop("remove_upload_file", False))
        existing_file = ((getattr(self.instance, "upload_file", "") if self.instance else "") or "").strip()

        if file_upload:
            extension = os.path.splitext(file_upload.name or "")[1].lower()
            if extension not in self.ALLOWED_FILE_EXTENSIONS:
                raise serializers.ValidationError({"message": "Invalid file format."})
            try:
                saved_path = default_storage.save(
                    f"academics/uploaded-content/{file_upload.name}",
                    ContentFile(file_upload.read()),
                )
            except Exception:
                raise serializers.ValidationError({"message": "File upload failed. Please try again."})
            attrs["upload_file"] = saved_path
            if self.instance and existing_file and existing_file != saved_path:
                self._file_to_delete = existing_file
        elif remove_upload_file and self.instance is not None:
            attrs["upload_file"] = ""
            if self.instance and existing_file:
                self._file_to_delete = existing_file
        elif not existing_file:
            raise serializers.ValidationError({"message": "Please select a file to upload."})

        if errors:
            raise serializers.ValidationError({"message": "Please fill in all mandatory fields.", "errors": errors})

        attrs["content_title"] = content_title
        return attrs

    def update(self, instance, validated_data):
        instance = super().update(instance, validated_data)
        if getattr(self, "_file_to_delete", None):
            self._delete_stored_file(self._file_to_delete)
            self._file_to_delete = None
        return instance


class LessonTopicDetailSerializer(LegacyAliasMixin):
    lesson_name = serializers.CharField(source="lesson.lesson_title", read_only=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        topic_title = attrs.get("topic_title")
        if not isinstance(topic_title, str) or not topic_title.strip():
            raise serializers.ValidationError({"topic_title": "Topic title is required."})
        attrs["topic_title"] = topic_title.strip()
        return attrs

    class Meta:
        model = LessonTopicDetail
        fields = [
            "id",
            "topic",
            "lesson",
            "lesson_name",
            "topic_title",
            "completed_status",
            "competed_date",
            "active_status",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_by", "updated_by", "created_at", "updated_at"]


class LessonSerializer(LegacyAliasMixin):
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=Lesson._meta.get_field("school_class").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section", queryset=Lesson._meta.get_field("section").related_model.objects.all(), allow_null=True, required=False)
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=Lesson._meta.get_field("subject").related_model.objects.all())
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=Lesson._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    lesson_name = serializers.CharField(source="lesson_title", read_only=True)

    class Meta:
        model = Lesson
        fields = [
            "id",
            "school",
            "academic_year_id",
            "class_id",
            "section_id",
            "subject_id",
            "class_name",
            "section_name",
            "subject_name",
            "lesson_name",
            "academic_year",
            "school_class",
            "section",
            "subject",
            "lesson_title",
            "active_status",
            "user",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "academic_year",
            "school_class",
            "section",
            "subject",
            "user",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
        ]
        validators = []


class LessonGroupCreateSerializer(serializers.Serializer):
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=Lesson._meta.get_field("school_class").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section", queryset=Lesson._meta.get_field("section").related_model.objects.all(), allow_null=True, required=False)
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=Lesson._meta.get_field("subject").related_model.objects.all())
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=Lesson._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)
    lesson = serializers.ListField(child=serializers.CharField(max_length=255), allow_empty=False)


class LessonTopicSerializer(LegacyAliasMixin):
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=LessonTopic._meta.get_field("school_class").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section", queryset=LessonTopic._meta.get_field("section").related_model.objects.all(), allow_null=True, required=False)
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=LessonTopic._meta.get_field("subject").related_model.objects.all())
    lesson_id = serializers.PrimaryKeyRelatedField(source="lesson", queryset=LessonTopic._meta.get_field("lesson").related_model.objects.all())
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=LessonTopic._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    lesson_name = serializers.CharField(source="lesson.lesson_title", read_only=True)
    topics = LessonTopicDetailSerializer(many=True, read_only=True)

    class Meta:
        model = LessonTopic
        fields = [
            "id",
            "school",
            "academic_year_id",
            "class_id",
            "section_id",
            "subject_id",
            "lesson_id",
            "class_name",
            "section_name",
            "subject_name",
            "lesson_name",
            "academic_year",
            "school_class",
            "section",
            "subject",
            "lesson",
            "active_status",
            "user",
            "created_by",
            "updated_by",
            "topics",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "academic_year",
            "school_class",
            "section",
            "subject",
            "lesson",
            "user",
            "created_by",
            "updated_by",
            "topics",
            "created_at",
            "updated_at",
        ]
        validators = []


class LessonTopicGroupCreateSerializer(serializers.Serializer):
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=LessonTopic._meta.get_field("school_class").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section", queryset=LessonTopic._meta.get_field("section").related_model.objects.all())
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=LessonTopic._meta.get_field("subject").related_model.objects.all())
    lesson_id = serializers.PrimaryKeyRelatedField(source="lesson", queryset=LessonTopic._meta.get_field("lesson").related_model.objects.all())
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=LessonTopic._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)
    topic = serializers.ListField(child=serializers.CharField(max_length=255), allow_empty=False)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        school_class = attrs.get("school_class")
        section = attrs.get("section")
        subject = attrs.get("subject")
        lesson = attrs.get("lesson")
        academic_year = attrs.get("academic_year")
        request = self.context.get("request")
        school = getattr(getattr(request, "user", None), "school", None)
        if not school and request is not None:
            school = getattr(request, "school", None)

        if not school:
            raise serializers.ValidationError({"message": "School context is required."})
        if not school_class:
            raise serializers.ValidationError({"class_id": ["Class is required."]})
        if not section:
            raise serializers.ValidationError({"section_id": ["Section is required."]})
        if not subject:
            raise serializers.ValidationError({"subject_id": ["Subject is required."]})
        if not lesson:
            raise serializers.ValidationError({"lesson_id": ["Lesson is required."]})

        if section and school_class and section.school_class_id != school_class.id:
            raise serializers.ValidationError({"section_id": ["Invalid class and section combination."]})

        if lesson and (
            lesson.school_class_id != school_class.id
            or lesson.subject_id != subject.id
            or (section and lesson.section_id != section.id)
        ):
            raise serializers.ValidationError({"lesson_id": ["Selected lesson does not match the chosen class, section, and subject."]})

        topic_items = attrs.get("topic") or []
        cleaned_topics = []
        seen_topics = set()
        for index, topic_title in enumerate(topic_items, start=1):
            if not isinstance(topic_title, str):
                raise serializers.ValidationError({"topic": [f"Topic line {index} must be text."]})
            normalized = topic_title.strip()
            if not normalized:
                raise serializers.ValidationError({"topic": [f"Topic line {index} cannot be empty."]})
            if len(normalized) > 255:
                raise serializers.ValidationError({"topic": [f"Topic line {index} must be 255 characters or fewer."]})
            key = normalized.lower()
            if key in seen_topics:
                raise serializers.ValidationError({"topic": ["Duplicate topic titles are not allowed."]})
            seen_topics.add(key)
            cleaned_topics.append(normalized)

        if len(cleaned_topics) > 100:
            raise serializers.ValidationError({"topic": ["You can save up to 100 topics at a time."]})

        duplicate_scope = LessonTopic.objects.filter(
            school=school,
            academic_year=academic_year,
            school_class=school_class,
            section=section,
            subject=subject,
            lesson=lesson,
        )
        if duplicate_scope.exists():
            raise serializers.ValidationError({"message": "Topic group already exists for this lesson."})

        attrs["topic"] = cleaned_topics
        attrs["school"] = school
        return attrs


class LessonPlanTopicSerializer(LegacyAliasMixin):
    topic_id = serializers.PrimaryKeyRelatedField(source="topic", queryset=LessonPlanTopic._meta.get_field("topic").related_model.objects.all())

    class Meta:
        model = LessonPlanTopic
        fields = ["id", "topic_id", "topic", "lesson_planner", "sub_topic_title", "created_at", "updated_at"]
        read_only_fields = ["id", "topic", "lesson_planner", "created_at", "updated_at"]


class LessonPlannerSerializer(LegacyAliasMixin):
    teacher_id = serializers.PrimaryKeyRelatedField(source="teacher", queryset=LessonPlanner._meta.get_field("teacher").related_model.objects.all(), allow_null=True, required=False)
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=LessonPlanner._meta.get_field("subject").related_model.objects.all())
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=LessonPlanner._meta.get_field("school_class").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section", queryset=LessonPlanner._meta.get_field("section").related_model.objects.all(), allow_null=True, required=False)
    lesson_id = serializers.PrimaryKeyRelatedField(source="lesson", queryset=LessonPlanner._meta.get_field("lesson").related_model.objects.all(), allow_null=True, required=False)
    topic_id = serializers.PrimaryKeyRelatedField(source="topic", queryset=LessonPlanner._meta.get_field("topic").related_model.objects.all(), allow_null=True, required=False)
    lesson_detail_id = serializers.PrimaryKeyRelatedField(source="lesson_detail", queryset=LessonPlanner._meta.get_field("lesson_detail").related_model.objects.all())
    topic_detail_id = serializers.PrimaryKeyRelatedField(source="topic_detail", queryset=LessonPlanner._meta.get_field("topic_detail").related_model.objects.all(), allow_null=True, required=False)
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=LessonPlanner._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    lesson_name = serializers.CharField(source="lesson.lesson_title", read_only=True)
    topic_name = serializers.CharField(source="topic.topic_title", read_only=True)
    lesson_detail_name = serializers.CharField(source="lesson_detail.lesson_title", read_only=True)
    topic_detail_name = serializers.CharField(source="topic_detail.topic_title", read_only=True)
    teacher_name = serializers.SerializerMethodField()
    topics = LessonPlanTopicSerializer(many=True, read_only=True)

    def get_teacher_name(self, obj):
        teacher = getattr(obj, "teacher", None)
        if not teacher:
            return ""
        full_name = getattr(teacher, "get_full_name", lambda: "")()
        return full_name.strip() or getattr(teacher, "username", "")

    class Meta:
        model = LessonPlanner
        fields = [
            "id",
            "school",
            "academic_year_id",
            "day",
            "active_status",
            "lesson_id",
            "topic_id",
            "lesson_detail_id",
            "topic_detail_id",
            "teacher_id",
            "subject_id",
            "class_id",
            "section_id",
            "class_name",
            "section_name",
            "subject_name",
            "lesson_name",
            "topic_name",
            "lesson_detail_name",
            "topic_detail_name",
            "teacher_name",
            "academic_year",
            "lesson",
            "topic",
            "lesson_detail",
            "topic_detail",
            "teacher",
            "subject",
            "school_class",
            "section",
            "sub_topic",
            "lecture_youube_link",
            "lecture_vedio",
            "attachment",
            "teaching_method",
            "general_objectives",
            "previous_knowlege",
            "comp_question",
            "zoom_setup",
            "presentation",
            "note",
            "lesson_date",
            "competed_date",
            "completed_status",
            "room_id",
            "class_period_id",
            "routine_id",
            "created_by",
            "updated_by",
            "topics",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "school",
            "academic_year",
            "lesson",
            "topic",
            "lesson_detail",
            "topic_detail",
            "teacher",
            "subject",
            "school_class",
            "section",
            "created_by",
            "updated_by",
            "topics",
            "created_at",
            "updated_at",
        ]
        validators = []


class LessonPlannerCreateSerializer(serializers.Serializer):
    academic_year_id = serializers.PrimaryKeyRelatedField(source="academic_year", queryset=LessonPlanner._meta.get_field("academic_year").related_model.objects.all(), allow_null=True, required=False)
    day = serializers.IntegerField(required=False, allow_null=True)
    lesson = serializers.PrimaryKeyRelatedField(queryset=Lesson.objects.all())
    teacher_id = serializers.PrimaryKeyRelatedField(source="teacher", queryset=LessonPlanner._meta.get_field("teacher").related_model.objects.all(), allow_null=True, required=False)
    subject_id = serializers.PrimaryKeyRelatedField(source="subject", queryset=LessonPlanner._meta.get_field("subject").related_model.objects.all())
    class_id = serializers.PrimaryKeyRelatedField(source="school_class", queryset=LessonPlanner._meta.get_field("school_class").related_model.objects.all())
    section_id = serializers.PrimaryKeyRelatedField(source="section", queryset=LessonPlanner._meta.get_field("section").related_model.objects.all(), allow_null=True, required=False)
    lesson_date = serializers.DateField()
    routine_id = serializers.IntegerField(required=False, allow_null=True)
    room_id = serializers.IntegerField(required=False, allow_null=True)
    class_period_id = serializers.IntegerField(required=False, allow_null=True)
    topic = serializers.JSONField(required=False)
    sub_topic = serializers.JSONField(required=False)
    customize = serializers.CharField(required=False, allow_blank=True)
    youtube_link = serializers.CharField(required=False, allow_blank=True)
    photo = serializers.CharField(required=False, allow_blank=True)
    teaching_method = serializers.CharField(required=False, allow_blank=True)
    general_Objectives = serializers.CharField(required=False, allow_blank=True)
    previous_knowledge = serializers.CharField(required=False, allow_blank=True)
    comprehensive_Questions = serializers.CharField(required=False, allow_blank=True)
    zoom_setup = serializers.CharField(required=False, allow_blank=True)
    presentation = serializers.CharField(required=False, allow_blank=True)
    note = serializers.CharField(required=False, allow_blank=True)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        request = self.context.get("request")
        school = getattr(getattr(request, "user", None), "school", None)
        if not school and request is not None:
            school = getattr(request, "school", None)

        academic_year = attrs.get("academic_year")
        day = attrs.get("day")
        lesson = attrs.get("lesson")
        teacher = attrs.get("teacher")
        subject = attrs.get("subject")
        school_class = attrs.get("school_class")
        section = attrs.get("section")
        lesson_date = attrs.get("lesson_date")
        routine_id = attrs.get("routine_id")
        class_period_id = attrs.get("class_period_id")
        topic_value = attrs.get("topic")
        sub_topic_value = attrs.get("sub_topic")
        customize = attrs.get("customize")

        if not school:
            raise serializers.ValidationError({"message": "School context is required."})
        if not lesson:
            raise serializers.ValidationError({"lesson": ["Lesson is required."]})
        if not subject:
            raise serializers.ValidationError({"subject": ["Subject is required."]})
        if not school_class:
            raise serializers.ValidationError({"school_class": ["Class is required."]})
        if not lesson_date:
            raise serializers.ValidationError({"lesson_date": ["Lesson date is required."]})

        if section and school_class and section.school_class_id != school_class.id:
            raise serializers.ValidationError({"section_id": ["Invalid class and section combination."]})

        if lesson and (
            lesson.school_class_id != school_class.id
            or lesson.subject_id != subject.id
            or (section and lesson.section_id != section.id)
        ):
            raise serializers.ValidationError({"lesson": ["Selected lesson does not match the chosen class, section, and subject."]})

        if academic_year and (lesson_date < academic_year.start_date or lesson_date > academic_year.end_date):
            raise serializers.ValidationError({"lesson_date": ["Lesson date must be within the selected academic year."]})

        if routine_id:
            routine_slot = ClassRoutineSlot.objects.filter(
                school=school,
                id=routine_id,
                school_class=school_class,
                subject=subject,
            )
            if section:
                routine_slot = routine_slot.filter(section=section)
            routine_slot = routine_slot.first()
            if not routine_slot:
                raise serializers.ValidationError({"routine_id": ["Selected routine does not match the chosen class, section, or subject."]})
            if teacher and routine_slot.teacher_id and routine_slot.teacher_id != teacher.id:
                raise serializers.ValidationError({"teacher_id": ["Selected teacher does not match the routine slot."]})
            if class_period_id and routine_slot.class_period_id and int(class_period_id) != int(routine_slot.class_period_id):
                raise serializers.ValidationError({"class_period_id": ["Selected class period does not match the routine slot."]})
            if day is not None and routine_slot.day_id is not None and int(day) != int(routine_slot.day_id):
                raise serializers.ValidationError({"day": ["Selected day does not match the routine slot."]})

        if customize == "customize":
            if not isinstance(topic_value, list) or not topic_value:
                raise serializers.ValidationError({"topic": ["At least one topic is required for customize mode."]})
            if not isinstance(sub_topic_value, list):
                raise serializers.ValidationError({"sub_topic": ["Sub topics must be a list in customize mode."]})
            if len(topic_value) > 100:
                raise serializers.ValidationError({"topic": ["You can save up to 100 topics at a time."]})

            cleaned_topic_ids = []
            for index, topic_item in enumerate(topic_value, start=1):
                try:
                    topic_id = int(topic_item)
                except (TypeError, ValueError):
                    raise serializers.ValidationError({"topic": [f"Topic line {index} is invalid."]})
                topic_detail = LessonTopicDetail.objects.filter(pk=topic_id).select_related("topic", "lesson").first()
                if not topic_detail:
                    raise serializers.ValidationError({"topic": [f"Topic detail #{topic_id} was not found."]})
                if topic_detail.lesson_id != lesson.id:
                    raise serializers.ValidationError({"topic": [f"Topic detail #{topic_id} does not belong to the selected lesson."]})
                cleaned_topic_ids.append(topic_id)

            cleaned_sub_topics = []
            for index, sub_topic_item in enumerate(sub_topic_value, start=1):
                if not isinstance(sub_topic_item, str):
                    raise serializers.ValidationError({"sub_topic": [f"Sub topic line {index} must be text."]})
                cleaned = sub_topic_item.strip()
                if len(cleaned) > 255:
                    raise serializers.ValidationError({"sub_topic": [f"Sub topic line {index} must be 255 characters or fewer."]})
                cleaned_sub_topics.append(cleaned)

            if len(cleaned_sub_topics) and len(cleaned_sub_topics) != len(cleaned_topic_ids):
                raise serializers.ValidationError({"sub_topic": ["Sub topic count must match the topic count."]})

            attrs["topic"] = cleaned_topic_ids
            attrs["sub_topic"] = cleaned_sub_topics
        else:
            if not topic_value:
                raise serializers.ValidationError({"topic": ["A topic is required."]})
            try:
                topic_id = int(topic_value)
            except (TypeError, ValueError):
                raise serializers.ValidationError({"topic": ["Selected topic is invalid."]})
            topic_detail = LessonTopicDetail.objects.filter(pk=topic_id).select_related("topic", "lesson").first()
            if not topic_detail:
                raise serializers.ValidationError({"topic": ["Selected topic was not found."]})
            if topic_detail.lesson_id != lesson.id:
                raise serializers.ValidationError({"topic": ["Selected topic does not belong to the chosen lesson."]})
            attrs["topic"] = topic_detail
            attrs["topic_detail"] = topic_detail
            attrs["sub_topic"] = sub_topic_value.strip() if isinstance(sub_topic_value, str) else ""
        return attrs
