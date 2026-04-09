from rest_framework import serializers
from django.utils.timezone import now
from datetime import date
from .models import StudentAttendance, SubjectAttendance, ATTENDANCE_TYPE_CHOICES


class StudentAttendanceSerializer(serializers.ModelSerializer):
    def validate_attendance_type(self, value):
        valid_types = [choice[0] for choice in ATTENDANCE_TYPE_CHOICES]
        if value not in valid_types:
            raise serializers.ValidationError(f"Invalid attendance status. Must be one of {valid_types}")
        return value

    def validate_notes(self, value):
        if len(value) > 250:
            raise serializers.ValidationError("Note cannot exceed 250 characters")
        return value

    def validate_attendance_date(self, value):
        if value > date.today():
            raise serializers.ValidationError("Attendance cannot be marked for future dates")
        return value

    def validate(self, attrs):
        request = self.context.get("request")
        school = attrs.get("school") or getattr(getattr(request, "user", None), "school", None)
        student = attrs.get("student") or getattr(self.instance, "student", None)
        attendance_date = attrs.get("attendance_date") or getattr(self.instance, "attendance_date", None)
        academic_year = attrs.get("academic_year")
        if academic_year is None and self.instance is not None:
            academic_year = getattr(self.instance, "academic_year", None)

        if school and student and attendance_date:
            queryset = StudentAttendance.objects.filter(
                school=school,
                student=student,
                attendance_date=attendance_date,
                academic_year=academic_year,
            )
            if self.instance:
                queryset = queryset.exclude(id=self.instance.id)
            if queryset.exists():
                raise serializers.ValidationError(
                    {"detail": "Attendance already exists for this student on the selected date. You can update the existing attendance record."}
                )

        # Check if trying to edit locked attendance
        if self.instance and getattr(self.instance, 'is_locked', False):
            if not (hasattr(request, 'user') and request.user.is_superuser):
                raise serializers.ValidationError(
                    {"detail": "This attendance record is locked and cannot be edited."}
                )

        return attrs

    class Meta:
        model = StudentAttendance
        fields = [
            "id",
            "school",
            "academic_year",
            "student",
            "class_id",
            "section_id",
            "attendance_date",
            "attendance_type",
            "notes",
            "is_locked",
            "marked_by",
            "marked_at",
            "updated_by",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "marked_by", "marked_at", "updated_by", "updated_at"]


class BulkAttendanceItemSerializer(serializers.Serializer):
    student_id = serializers.IntegerField()
    attendance_type = serializers.ChoiceField(choices=["P", "A", "L", "F", "H"])
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class BulkAttendanceSerializer(serializers.Serializer):
    class_id = serializers.IntegerField()
    section_id = serializers.IntegerField()
    attendance_date = serializers.DateField()
    academic_year_id = serializers.IntegerField(required=False, allow_null=True)
    mark_holiday = serializers.BooleanField(required=False, default=False)
    attendance = serializers.ListField(child=BulkAttendanceItemSerializer())


class StudentSearchRequestSerializer(serializers.Serializer):
    # Accept all parity keys used across legacy and rewrite forms.
    class_field = serializers.IntegerField(source="class", required=False)
    class_id = serializers.IntegerField(required=False)
    section = serializers.IntegerField(required=False)
    section_id = serializers.IntegerField(required=False)
    attendance_date = serializers.DateField()

    def validate(self, attrs):
        class_id = attrs.get("class") or attrs.get("class_id")
        section_id = attrs.get("section") or attrs.get("section_id")

        if not class_id:
            raise serializers.ValidationError({"class": "Class is required."})
        if not section_id:
            raise serializers.ValidationError({"section": "Section is required."})

        attrs["class"] = class_id
        attrs["section"] = section_id
        return attrs


class StudentAttendanceStoreRequestSerializer(serializers.Serializer):
    date = serializers.DateField()
    id = serializers.ListField(child=serializers.IntegerField(min_value=1), allow_empty=False)
    attendance = serializers.DictField(required=False)
    attendance_type = serializers.DictField(required=False)
    note = serializers.DictField(required=False)
    attendance_note = serializers.DictField(required=False)
    mark_holiday = serializers.BooleanField(required=False, default=False)


class SubjectAttendanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SubjectAttendance
        fields = [
            "id",
            "school",
            "academic_year",
            "student",
            "subject",
            "student_record_id",
            "class_id",
            "section_id",
            "attendance_date",
            "attendance_type",
            "notes",
            "notify",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "school", "created_at", "updated_at"]


class SubjectAttendanceSearchRequestSerializer(serializers.Serializer):
    class_id = serializers.IntegerField(required=False)
    section_id = serializers.IntegerField(required=False)
    subject_id = serializers.IntegerField(required=False)
    # parity aliases from legacy forms
    class_field = serializers.IntegerField(source="class", required=False)
    section = serializers.IntegerField(required=False)
    subject = serializers.IntegerField(required=False)
    attendance_date = serializers.DateField(required=True)


class SubjectAttendanceStoreRequestSerializer(serializers.Serializer):
    # legacy hidden form values
    class_id = serializers.IntegerField(required=False)
    section_id = serializers.IntegerField(required=False)
    subject_id = serializers.IntegerField(required=False)
    class_field = serializers.IntegerField(source="class", required=False)
    section = serializers.IntegerField(required=False)
    subject = serializers.IntegerField(required=False)
    attendance_date = serializers.DateField(required=False)
    date = serializers.DateField(required=False)
    attendance = serializers.DictField(required=True)


class SubjectAttendanceHolidayRequestSerializer(serializers.Serializer):
    purpose = serializers.ChoiceField(choices=["mark", "unmark"])
    class_id = serializers.IntegerField()
    section_id = serializers.IntegerField()
    subject_id = serializers.IntegerField()
    attendance_date = serializers.DateField()


class SubjectAttendanceReportSearchRequestSerializer(serializers.Serializer):
    class_id = serializers.IntegerField(required=False)
    section_id = serializers.IntegerField(required=False)
    class_field = serializers.IntegerField(source="class", required=False)
    section = serializers.IntegerField(required=False)
    month = serializers.CharField()
    year = serializers.IntegerField()

    def validate_month(self, value):
        month = str(value).strip()
        if not month.isdigit():
            raise serializers.ValidationError("Month must be numeric.")
        month_num = int(month)
        if month_num < 1 or month_num > 12:
            raise serializers.ValidationError("Month must be between 1 and 12.")
        return f"{month_num:02d}"

    def validate_year(self, value):
        if int(value) < 1900 or int(value) > 2100:
            raise serializers.ValidationError("Year is out of valid range.")
        return int(value)

    def validate(self, attrs):
        attrs = super().validate(attrs)
        class_id = attrs.get("class_id") or attrs.get("class")
        section_id = attrs.get("section_id") or attrs.get("section")
        if not class_id:
            raise serializers.ValidationError({"class_id": "Class is required."})
        if not section_id:
            raise serializers.ValidationError({"section_id": "Section is required."})
        return attrs
