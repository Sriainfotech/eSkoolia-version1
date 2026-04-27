from django.db import models


ATTENDANCE_TYPE_CHOICES = [
    ("P", "Present"),
    ("A", "Absent"),
    ("L", "Late"),
    ("F", "Half Day"),
    ("H", "Holiday"),
]


class StudentAttendance(models.Model):
    """
    Matches legacy sm_student_attendances.
    attendance_type: P=Present, A=Absent, L=Late, F=Half Day, H=Holiday
    """
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="student_attendances")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_attendances",
    )
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="attendances")
    class_id = models.PositiveIntegerField(null=True, blank=True, help_text="Legacy class_id parity")
    section_id = models.PositiveIntegerField(null=True, blank=True, help_text="Legacy section_id parity")
    attendance_date = models.DateField()
    attendance_type = models.CharField(max_length=1, choices=ATTENDANCE_TYPE_CHOICES)
    notes = models.TextField(blank=True, default="", max_length=250)
    lunch = models.BooleanField(default=False, help_text="Student had lunch")
    is_locked = models.BooleanField(default=False, help_text="Prevents editing of locked attendance")
    marked_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="attendances_marked"
    )
    marked_at = models.DateTimeField(auto_now_add=True)
    updated_by = models.ForeignKey(
        "users.User", on_delete=models.SET_NULL, null=True, blank=True, related_name="attendances_updated"
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "student_attendances"
        ordering = ["-attendance_date", "student_id"]
        indexes = [
            models.Index(fields=["student_id"]),
            models.Index(fields=["class_id"]),
            models.Index(fields=["section_id"]),
            models.Index(fields=["attendance_date"]),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "academic_year", "student", "attendance_date"],
                name="uq_student_attendance_date",
            )
        ]

    def __str__(self):
        return f"{self.student_id} | {self.attendance_date} | {self.attendance_type}"


class StudentAttendanceBulk(models.Model):
    """
    Parity with legacy StudentAttendanceBulk temp table used by bulk import flow.
    """

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="student_attendance_bulks")
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="attendance_bulk_rows")
    attendance_date = models.DateField()
    attendance_type = models.CharField(max_length=1, choices=ATTENDANCE_TYPE_CHOICES)
    note = models.TextField(blank=True, default="")
    class_id = models.PositiveIntegerField(null=True, blank=True)
    section_id = models.PositiveIntegerField(null=True, blank=True)
    student_record_id = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "student_attendance_bulk"
        ordering = ["-attendance_date", "student_id"]


class SubjectAttendance(models.Model):
    """
    Parity with legacy sm_subject_attendances.
    """

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="subject_attendances")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subject_attendances",
    )
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="subject_attendances")
    subject = models.ForeignKey("core.Subject", on_delete=models.CASCADE, related_name="student_attendances")
    student_record_id = models.PositiveIntegerField(null=True, blank=True)
    class_id = models.PositiveIntegerField(null=True, blank=True)
    section_id = models.PositiveIntegerField(null=True, blank=True)
    attendance_date = models.DateField()
    attendance_type = models.CharField(max_length=1, choices=ATTENDANCE_TYPE_CHOICES)
    notes = models.TextField(blank=True, default="")
    notify = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subject_attendances"
        ordering = ["-attendance_date", "student_id"]

    def __str__(self):
        return f"{self.student_id} | {self.subject_id} | {self.attendance_date} | {self.attendance_type}"
