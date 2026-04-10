from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from apps.core.models import ClassRoom

from .models import (
    AdmitCard,
    AdmitCardSetting,
    Exam,
    ExamAttendance,
    ExamAttendanceChild,
    ExamGradeScale,
    ExamMark,
    ExamMarkRegister,
    ExamMarkRegisterPart,
    ExamResultPublish,
    OnlineExam,
    OnlineExamTake,
    ExamRoutine,
    ExamSchedule,
    ExamSetup,
    ExamType,
    SeatPlan,
    SeatPlanSetting,
)


class ExamTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamType
        fields = [
            "id",
            "school",
            "academic_year",
            "title",
            "description",
            "active_status",
            "is_active",
            "is_average",
            "average_mark",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "academic_year", "created_at", "updated_at"]


class ExamTypeStoreRequestSerializer(serializers.Serializer):
    exam_type_title = serializers.CharField(max_length=50)
    is_average = serializers.CharField(required=False, allow_blank=True)
    average_mark = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)


class ExamTypeUpdateRequestSerializer(ExamTypeStoreRequestSerializer):
    id = serializers.IntegerField(min_value=1)


class ExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = Exam
        fields = [
            "id",
            "school",
            "academic_year",
            "exam_type",
            "name",
            "start_date",
            "end_date",
            "status",
            "is_result_published",
            "published_at",
            "published_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "is_result_published", "published_at", "published_by", "created_at", "updated_at"]

    def validate(self, attrs):
        start_date = attrs.get("start_date") or getattr(self.instance, "start_date", None)
        end_date = attrs.get("end_date") or getattr(self.instance, "end_date", None)
        exam_type = attrs.get("exam_type") or getattr(self.instance, "exam_type", None)
        name = (attrs.get("name") or getattr(self.instance, "name", "") or "").strip()
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        academic_year = attrs.get("academic_year") or getattr(self.instance, "academic_year", None)

        if start_date and end_date and end_date < start_date:
            raise serializers.ValidationError({"end_date": "End date cannot be earlier than start date."})

        if school_id and exam_type and exam_type.school_id != school_id:
            raise serializers.ValidationError({"exam_type": "Selected exam type does not belong to your school."})

        if school_id and academic_year and name:
            duplicate_qs = Exam.objects.filter(
                school_id=school_id,
                academic_year=academic_year,
                name__iexact=name,
            )
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(id=self.instance.id)
            if duplicate_qs.exists():
                raise serializers.ValidationError({"name": "Duplicate name found!"})

        if "name" in attrs:
            attrs["name"] = name

        return attrs


class ExamGradeScaleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamGradeScale
        fields = [
            "id",
            "school",
            "name",
            "min_percent",
            "max_percent",
            "gpa",
            "is_fail",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request else None
        name = (attrs.get("name") or getattr(self.instance, "name", "") or "").strip()
        min_percent = attrs.get("min_percent") or getattr(self.instance, "min_percent", None)
        max_percent = attrs.get("max_percent") or getattr(self.instance, "max_percent", None)

        if min_percent is not None and max_percent is not None and max_percent < min_percent:
            raise serializers.ValidationError({"max_percent": "Max percent cannot be lower than min percent."})

        if school_id and min_percent is not None and max_percent is not None:
            queryset = ExamGradeScale.objects.filter(
                school_id=school_id,
                min_percent__lte=max_percent,
                max_percent__gte=min_percent,
            )
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            if queryset.exists():
                raise serializers.ValidationError("Grade ranges cannot overlap within the same school.")

        if school_id and name:
            duplicate_qs = ExamGradeScale.objects.filter(school_id=school_id, name__iexact=name)
            if self.instance:
                duplicate_qs = duplicate_qs.exclude(id=self.instance.id)
            if duplicate_qs.exists():
                raise serializers.ValidationError({"name": "Duplicate name found!"})

        if "name" in attrs:
            attrs["name"] = name

        return attrs


class ExamScheduleSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSchedule
        fields = [
            "id",
            "school",
            "exam",
            "school_class",
            "section",
            "subject",
            "exam_date",
            "start_time",
            "end_time",
            "room",
            "full_marks",
            "pass_marks",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "created_at", "updated_at"]

    def validate(self, attrs):
        start_time = attrs.get("start_time") or getattr(self.instance, "start_time", None)
        end_time = attrs.get("end_time") or getattr(self.instance, "end_time", None)
        full_marks = attrs.get("full_marks") or getattr(self.instance, "full_marks", None)
        pass_marks = attrs.get("pass_marks") or getattr(self.instance, "pass_marks", None)
        request = self.context.get("request")
        school_id = request.user.school_id if request else None

        exam = attrs.get("exam") or getattr(self.instance, "exam", None)
        school_class = attrs.get("school_class") or getattr(self.instance, "school_class", None)
        section = attrs.get("section") or getattr(self.instance, "section", None)
        subject = attrs.get("subject") or getattr(self.instance, "subject", None)

        if start_time and end_time and end_time <= start_time:
            raise serializers.ValidationError({"end_time": "End time must be later than start time."})

        if full_marks is not None and pass_marks is not None and pass_marks > full_marks:
            raise serializers.ValidationError({"pass_marks": "Pass marks cannot exceed full marks."})

        if school_id and exam and exam.school_id != school_id:
            raise serializers.ValidationError({"exam": "Selected exam does not belong to your school."})
        if school_id and school_class and school_class.school_id != school_id:
            raise serializers.ValidationError({"school_class": "Selected class does not belong to your school."})
        if section and school_class and section.school_class_id != school_class.id:
            raise serializers.ValidationError({"section": "Selected section does not belong to selected class."})
        if school_id and subject and subject.school_id != school_id:
            raise serializers.ValidationError({"subject": "Selected subject does not belong to your school."})

        return attrs


class ExamMarkSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamMark
        fields = [
            "id",
            "school",
            "exam",
            "schedule",
            "student",
            "obtained_marks",
            "absent",
            "note",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "created_by", "created_at", "updated_at"]

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request else None

        schedule = attrs.get("schedule") or getattr(self.instance, "schedule", None)
        exam = attrs.get("exam") or getattr(self.instance, "exam", None)
        student = attrs.get("student") or getattr(self.instance, "student", None)
        obtained_marks = attrs.get("obtained_marks")
        absent = attrs.get("absent", getattr(self.instance, "absent", False))

        if school_id and schedule and schedule.school_id != school_id:
            raise serializers.ValidationError({"schedule": "Selected schedule does not belong to your school."})
        if school_id and exam and exam.school_id != school_id:
            raise serializers.ValidationError({"exam": "Selected exam does not belong to your school."})
        if school_id and student and student.school_id != school_id:
            raise serializers.ValidationError({"student": "Selected student does not belong to your school."})

        if schedule and exam and schedule.exam_id != exam.id:
            raise serializers.ValidationError({"exam": "Exam does not match selected schedule."})

        if schedule and student and student.current_class_id != schedule.school_class_id:
            raise serializers.ValidationError({"student": "Student does not belong to scheduled class."})

        if absent:
            attrs["obtained_marks"] = 0
        elif obtained_marks is not None and schedule and obtained_marks > schedule.full_marks:
            raise serializers.ValidationError({"obtained_marks": "Obtained marks cannot exceed full marks."})

        return attrs


class ExamSetupSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamSetup
        fields = [
            "id",
            "school",
            "academic_year",
            "exam_term",
            "school_class",
            "section",
            "subject",
            "exam_title",
            "exam_mark",
            "created_by",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "academic_year", "created_by", "created_at", "updated_at"]


class ExamSetupStoreRequestSerializer(serializers.Serializer):
    class_id = serializers.IntegerField(required=False, min_value=1)
    class_value = serializers.IntegerField(source="class", required=False, min_value=1)
    section = serializers.IntegerField(min_value=1)
    subject = serializers.IntegerField(min_value=1)
    exam_term_id = serializers.IntegerField(min_value=1)
    total_exam_mark = serializers.DecimalField(max_digits=8, decimal_places=2)
    totalMark = serializers.DecimalField(max_digits=8, decimal_places=2)
    exam_title = serializers.ListField(child=serializers.CharField(max_length=120), min_length=1)
    exam_mark = serializers.ListField(child=serializers.DecimalField(max_digits=8, decimal_places=2), min_length=1)

    def validate(self, attrs):
        class_id = attrs.get("class") or attrs.get("class_id")
        if not class_id:
            raise serializers.ValidationError({"class": "This field is required."})

        titles = [title.strip() for title in attrs["exam_title"]]
        marks = attrs["exam_mark"]
        if len(titles) != len(marks):
            raise serializers.ValidationError("exam_title and exam_mark lengths must match.")

        if any(not title for title in titles):
            raise serializers.ValidationError({"exam_title": "Exam title cannot be blank."})

        normalized = [title.lower() for title in titles]
        if len(set(normalized)) != len(normalized):
            raise serializers.ValidationError({"exam_title": "Duplicate name found!"})

        attrs["class"] = class_id
        attrs["exam_title"] = titles
        return attrs


class ExamRoutineSerializer(serializers.ModelSerializer):
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    teacher_name = serializers.SerializerMethodField()
    exam_term_name = serializers.CharField(source="exam_term.title", read_only=True)

    class Meta:
        model = ExamRoutine
        fields = [
            "id",
            "exam_term",
            "exam_term_name",
            "school_class",
            "class_name",
            "section",
            "section_name",
            "subject",
            "subject_name",
            "teacher",
            "teacher_name",
            "exam_period",
            "exam_date",
            "start_time",
            "end_time",
            "room",
            "created_at",
            "updated_at",
        ]

    def get_teacher_name(self, obj):
        if not obj.teacher:
            return ""
        first = (obj.teacher.first_name or "").strip()
        last = (obj.teacher.last_name or "").strip()
        full = f"{first} {last}".strip()
        return full or obj.teacher.username


class ExamCommandCenterScheduleSerializer(serializers.ModelSerializer):
    room_id = serializers.IntegerField(required=False, allow_null=True, write_only=True)
    class_id = serializers.IntegerField(source="school_class_id", read_only=True)
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)
    teacher_name = serializers.SerializerMethodField(read_only=True)
    exam_type_id = serializers.IntegerField(source="exam_term_id", read_only=True)

    class Meta:
        model = ExamRoutine
        fields = [
            "id",
            "exam_term",
            "exam_type_id",
            "school_class",
            "class_id",
            "class_name",
            "section",
            "section_name",
            "subject",
            "subject_name",
            "teacher",
            "teacher_name",
            "exam_period",
            "exam_date",
            "start_time",
            "end_time",
            "room",
            "room_id",
        ]

    def get_teacher_name(self, obj):
        if not obj.teacher_id:
            return ""
        first = (obj.teacher.first_name or "").strip()
        last = (obj.teacher.last_name or "").strip()
        return f"{first} {last}".strip() or obj.teacher.username

    def validate(self, attrs):
        request = self.context.get("request")
        school_id = request.user.school_id if request and not request.user.is_superuser else None

        room_id = attrs.pop("room_id", None)
        room_value = (attrs.get("room") or getattr(self.instance, "room", "") or "").strip()
        if room_id:
            room_obj = ClassRoom.objects.filter(id=room_id)
            if school_id:
                room_obj = room_obj.filter(school_id=school_id)
            room_obj = room_obj.first()
            if not room_obj:
                raise serializers.ValidationError({"room_id": "Selected room does not belong to your school."})
            room_value = room_obj.room_no
        attrs["room"] = room_value

        exam_term = attrs.get("exam_term") or getattr(self.instance, "exam_term", None)
        school_class = attrs.get("school_class") or getattr(self.instance, "school_class", None)
        section = attrs.get("section") if "section" in attrs else getattr(self.instance, "section", None)
        subject = attrs.get("subject") or getattr(self.instance, "subject", None)
        teacher = attrs.get("teacher") if "teacher" in attrs else getattr(self.instance, "teacher", None)
        exam_period = attrs.get("exam_period") if "exam_period" in attrs else getattr(self.instance, "exam_period", None)
        exam_date = attrs.get("exam_date") or getattr(self.instance, "exam_date", None)
        start_time = attrs.get("start_time") or getattr(self.instance, "start_time", None)
        end_time = attrs.get("end_time") or getattr(self.instance, "end_time", None)

        if school_id:
            if exam_term and exam_term.school_id != school_id:
                raise serializers.ValidationError({"exam_term": "Selected exam type does not belong to your school."})
            if school_class and school_class.school_id != school_id:
                raise serializers.ValidationError({"school_class": "Selected class does not belong to your school."})
            if section and section.school_class_id != school_class.id:
                raise serializers.ValidationError({"section": "Selected section does not belong to selected class."})
            if subject and subject.school_id != school_id:
                raise serializers.ValidationError({"subject": "Selected subject does not belong to your school."})
            if teacher and teacher.school_id != school_id:
                raise serializers.ValidationError({"teacher": "Selected teacher does not belong to your school."})
            if exam_period and exam_period.school_id != school_id:
                raise serializers.ValidationError({"exam_period": "Selected period does not belong to your school."})

        if not all([exam_term, school_class, subject, exam_date, start_time, end_time]):
            return attrs

        school = request.user.school if request and request.user.school_id else getattr(self.instance, "school", None)
        tentative = ExamRoutine(
            pk=self.instance.pk if self.instance else None,
            school=school,
            academic_year=getattr(self.instance, "academic_year", None),
            exam_term=exam_term,
            school_class=school_class,
            section=section,
            subject=subject,
            teacher=teacher,
            exam_period=exam_period,
            exam_date=exam_date,
            start_time=start_time,
            end_time=end_time,
            room=room_value,
        )
        try:
            tentative.clean()
        except DjangoValidationError as exc:
            if hasattr(exc, "message_dict"):
                raise serializers.ValidationError(exc.message_dict)
            raise serializers.ValidationError({"detail": exc.messages})

        return attrs


class ExamRoutineRowSerializer(serializers.Serializer):
    section = serializers.IntegerField(required=False, allow_null=True)
    subject = serializers.IntegerField(min_value=1)
    teacher_id = serializers.IntegerField(required=False, allow_null=True)
    exam_period_id = serializers.IntegerField(required=False, allow_null=True)
    date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    room = serializers.CharField(max_length=80, required=False, allow_blank=True)


class ExamRoutineStoreRequestSerializer(serializers.Serializer):
    class_id = serializers.IntegerField(min_value=1)
    section_id = serializers.IntegerField(required=False, allow_null=True)
    exam_type_id = serializers.IntegerField(min_value=1)
    routine = ExamRoutineRowSerializer(many=True, min_length=1)

    def validate(self, attrs):
        section_id = attrs.get("section_id")
        if section_id in (0, "0"):
            section_id = None
        attrs["section_id"] = section_id
        normalized_rows = []
        seen_subjects = set()
        seen_slots = set()

        for row in attrs["routine"]:
            row_section = row.get("section") or section_id
            if row_section in (0, "0"):
                row_section = None

            teacher_id = row.get("teacher_id")
            if teacher_id in (0, "0"):
                teacher_id = None

            exam_period_id = row.get("exam_period_id")
            if exam_period_id in (0, "0"):
                exam_period_id = None

            row_end = row["end_time"]
            row_start = row["start_time"]
            if row_end <= row_start:
                raise serializers.ValidationError({"routine": "End time must be later than start time."})

            subject_key = (row_section, row["subject"])
            if subject_key in seen_subjects:
                raise serializers.ValidationError({"routine": "Duplicate subject found in routine rows."})
            seen_subjects.add(subject_key)

            slot_key = (row_section, row["date"], exam_period_id or 0)
            if slot_key in seen_slots:
                raise serializers.ValidationError({"routine": "Duplicate date/period found in routine rows."})
            seen_slots.add(slot_key)

            row["section"] = row_section
            row["teacher_id"] = teacher_id
            row["exam_period_id"] = exam_period_id
            normalized_rows.append(row)

        attrs["routine"] = normalized_rows
        return attrs


class ExamAttendanceChildSerializer(serializers.ModelSerializer):
    admission_no = serializers.CharField(source="student.admission_no", read_only=True)
    first_name = serializers.CharField(source="student.first_name", read_only=True)
    last_name = serializers.CharField(source="student.last_name", read_only=True)
    roll_no = serializers.CharField(source="student.roll_no", read_only=True)

    class Meta:
        model = ExamAttendanceChild
        fields = [
            "id",
            "student",
            "student_record_id",
            "admission_no",
            "first_name",
            "last_name",
            "roll_no",
            "school_class",
            "section",
            "attendance_type",
        ]


class ExamAttendanceSearchRequestSerializer(serializers.Serializer):
    exam = serializers.IntegerField(min_value=1)
    subject = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(source="class", min_value=1)
    section = serializers.IntegerField(required=False, allow_null=True)
    exam_date = serializers.DateField(required=False)


class ExamAttendanceStoreRequestSerializer(serializers.Serializer):
    exam_id = serializers.IntegerField(min_value=1)
    subject_id = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(min_value=1)
    section_id = serializers.IntegerField(required=False, allow_null=True)
    attendance = serializers.DictField(child=serializers.DictField(), allow_empty=False)

    def validate(self, attrs):
        attendance_map = attrs.get("attendance") or {}
        if not attendance_map:
            raise serializers.ValidationError({"attendance": "Attendance rows are required."})
        return attrs


class ExamAttendanceReportSearchRequestSerializer(serializers.Serializer):
    exam = serializers.IntegerField(min_value=1)
    subject = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(source="class", min_value=1)
    section = serializers.IntegerField(required=False, allow_null=True)


class ExamMarkRegisterPartSerializer(serializers.ModelSerializer):
    exam_setup_id = serializers.IntegerField(source="exam_setup.id", read_only=True)
    exam_title = serializers.CharField(source="exam_setup.exam_title", read_only=True)
    exam_mark = serializers.DecimalField(source="exam_setup.exam_mark", max_digits=8, decimal_places=2, read_only=True)

    class Meta:
        model = ExamMarkRegisterPart
        fields = ["id", "exam_setup", "exam_setup_id", "exam_title", "exam_mark", "marks"]


class ExamMarkRegisterSerializer(serializers.ModelSerializer):
    admission_no = serializers.CharField(source="student.admission_no", read_only=True)
    first_name = serializers.CharField(source="student.first_name", read_only=True)
    last_name = serializers.CharField(source="student.last_name", read_only=True)
    roll_no = serializers.CharField(source="student.roll_no", read_only=True)
    parts = ExamMarkRegisterPartSerializer(many=True, read_only=True)

    class Meta:
        model = ExamMarkRegister
        fields = [
            "id",
            "exam_term",
            "school_class",
            "section",
            "subject",
            "student",
            "student_record_id",
            "admission_no",
            "first_name",
            "last_name",
            "roll_no",
            "is_absent",
            "total_marks",
            "total_gpa_point",
            "total_gpa_grade",
            "teacher_remarks",
            "parts",
        ]


class ExamMarkRegisterSearchRequestSerializer(serializers.Serializer):
    exam = serializers.IntegerField(min_value=1)
    subject = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(source="class", min_value=1)
    section = serializers.IntegerField(required=False, allow_null=True)


class ExamMarkRegisterStoreRequestSerializer(serializers.Serializer):
    exam_id = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(min_value=1)
    section_id = serializers.IntegerField(required=False, allow_null=True)
    subject_id = serializers.IntegerField(min_value=1)
    markStore = serializers.DictField(child=serializers.DictField(), allow_empty=False)

    def validate(self, attrs):
        rows = attrs.get("markStore") or {}
        if not rows:
            raise serializers.ValidationError({"markStore": "Mark rows are required."})
        return attrs


class ExamResultPublishSerializer(serializers.ModelSerializer):
    class Meta:
        model = ExamResultPublish
        fields = [
            "id",
            "exam_term",
            "school_class",
            "section",
            "is_published",
            "published_at",
            "published_by",
        ]


class ExamResultPublishSearchRequestSerializer(serializers.Serializer):
    exam = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(source="class", min_value=1)
    section = serializers.IntegerField(required=False, allow_null=True)


class ExamResultPublishStoreRequestSerializer(serializers.Serializer):
    exam_id = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(min_value=1)
    section_id = serializers.IntegerField(required=False, allow_null=True)


class ExamReportStudentSearchRequestSerializer(serializers.Serializer):
    exam = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(source="class", min_value=1)
    section = serializers.IntegerField(required=False, allow_null=True)
    student = serializers.IntegerField(min_value=1)


class ExamMeritSearchRequestSerializer(serializers.Serializer):
    exam = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(source="class", min_value=1)
    section = serializers.IntegerField(required=False, allow_null=True)


class OnlineExamSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    section_name = serializers.CharField(source="section.name", read_only=True)
    subject_name = serializers.CharField(source="subject.name", read_only=True)

    class Meta:
        model = OnlineExam
        fields = [
            "id",
            "title",
            "school_class",
            "class_name",
            "section",
            "section_name",
            "subject",
            "subject_name",
            "date",
            "start_time",
            "end_time",
            "end_date_time",
            "percentage",
            "instruction",
            "status",
            "auto_mark",
        ]


class OnlineExamStoreRequestSerializer(serializers.Serializer):
    title = serializers.CharField(max_length=150)
    class_id = serializers.IntegerField(source="class", min_value=1)
    section = serializers.ListField(child=serializers.IntegerField(min_value=1), required=False)
    section_id = serializers.IntegerField(required=False, min_value=1)
    subject = serializers.IntegerField(min_value=1)
    date = serializers.DateField()
    start_time = serializers.TimeField()
    end_time = serializers.TimeField()
    percentage = serializers.DecimalField(max_digits=6, decimal_places=2, required=False)
    instruction = serializers.CharField(required=False, allow_blank=True)
    auto_mark = serializers.BooleanField(required=False)

    def validate(self, attrs):
        if attrs["end_time"] <= attrs["start_time"]:
            raise serializers.ValidationError({"end_time": "End time must be later than start time."})

        section_ids = attrs.get("section") or []
        section_id = attrs.get("section_id")
        if section_id:
            section_ids.append(section_id)
        section_ids = list(dict.fromkeys(section_ids))
        if not section_ids:
            raise serializers.ValidationError({"section": "At least one section is required."})

        attrs["section"] = section_ids
        attrs["title"] = attrs["title"].strip()
        return attrs


class OnlineExamUpdateRequestSerializer(OnlineExamStoreRequestSerializer):
    id = serializers.IntegerField(min_value=1)


class OnlineExamTakeSerializer(serializers.ModelSerializer):
    admission_no = serializers.CharField(source="student.admission_no", read_only=True)
    first_name = serializers.CharField(source="student.first_name", read_only=True)
    last_name = serializers.CharField(source="student.last_name", read_only=True)
    roll_no = serializers.CharField(source="student.roll_no", read_only=True)

    class Meta:
        model = OnlineExamTake
        fields = [
            "id",
            "student",
            "admission_no",
            "first_name",
            "last_name",
            "roll_no",
            "total_marks",
            "status",
            "submitted_at",
        ]


class ExamPlanSearchRequestSerializer(serializers.Serializer):
    exam = serializers.IntegerField(min_value=1)
    class_id = serializers.IntegerField(source="class", min_value=1)
    section = serializers.IntegerField(min_value=1)


class ExamPlanGenerateRequestSerializer(serializers.Serializer):
    exam_type_id = serializers.IntegerField(min_value=1)
    data = serializers.DictField(required=False)


class AdmitCardSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = AdmitCardSetting
        fields = [
            "id",
            "admit_layout",
            "student_photo",
            "student_name",
            "admission_no",
            "class_section",
            "exam_name",
            "academic_year_label",
            "principal_signature",
            "guardian_name",
            "class_teacher_signature",
            "school_address",
            "student_download",
            "parent_download",
            "student_notification",
            "parent_notification",
            "admit_sub_title",
            "description",
        ]


class SeatPlanSettingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SeatPlanSetting
        fields = [
            "id",
            "school_name",
            "student_photo",
            "student_name",
            "roll_no",
            "admission_no",
            "class_section",
            "exam_name",
            "academic_year_label",
        ]


class AdmitCardSerializer(serializers.ModelSerializer):
    admission_no = serializers.CharField(source="student.admission_no", read_only=True)
    first_name = serializers.CharField(source="student.first_name", read_only=True)
    last_name = serializers.CharField(source="student.last_name", read_only=True)
    roll_no = serializers.CharField(source="student.roll_no", read_only=True)

    class Meta:
        model = AdmitCard
        fields = [
            "id",
            "student",
            "student_record_id",
            "exam_term",
            "admission_no",
            "first_name",
            "last_name",
            "roll_no",
        ]


class SeatPlanSerializer(serializers.ModelSerializer):
    admission_no = serializers.CharField(source="student.admission_no", read_only=True)
    first_name = serializers.CharField(source="student.first_name", read_only=True)
    last_name = serializers.CharField(source="student.last_name", read_only=True)
    roll_no = serializers.CharField(source="student.roll_no", read_only=True)

    class Meta:
        model = SeatPlan
        fields = [
            "id",
            "student",
            "student_record_id",
            "exam_term",
            "admission_no",
            "first_name",
            "last_name",
            "roll_no",
        ]
