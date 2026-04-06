from django.db import models
import uuid


class StudentCategory(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="student_categories")
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    code = models.CharField(max_length=30, blank=True, null=True)
    status = models.CharField(max_length=10, choices=[("active", "Active"), ("inactive", "Inactive")], default="active")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "student_categories"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_student_category_school_name"),
            models.UniqueConstraint(fields=["school", "code"], name="uq_student_category_school_code"),
        ]

    def __str__(self):
        return self.name


class StudentGroup(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="student_groups")
    name = models.CharField(max_length=80)
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "student_groups"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_student_group_school_name"),
        ]

    def __str__(self):
        return self.name


class Guardian(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="guardians")
    full_name = models.CharField(max_length=120)
    relation = models.CharField(max_length=50, help_text="e.g. Father, Mother, Uncle")
    phone = models.CharField(max_length=32)
    email = models.EmailField(blank=True)
    occupation = models.CharField(max_length=120, blank=True)
    address = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "guardians"
        ordering = ["full_name"]

    def __str__(self):
        return f"{self.full_name} ({self.relation})"


class Student(models.Model):
    GENDER_CHOICES = [
        ("male", "Male"),
        ("female", "Female"),
        ("other", "Other"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="students")
    student_id = models.UUIDField(default=uuid.uuid4, unique=True, editable=False, db_index=True)
    admission_no = models.CharField(max_length=40)
    roll_no = models.CharField(max_length=40, blank=True)
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES)
    custom_gender = models.CharField(max_length=60, blank=True)
    blood_group = models.CharField(max_length=5, blank=True)
    phone = models.CharField(max_length=20, blank=True)
    email = models.EmailField(blank=True)
    address_line = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    state = models.CharField(max_length=100, blank=True)
    pincode = models.CharField(max_length=20, blank=True)
    photo = models.URLField(max_length=500, blank=True)
    status = models.CharField(
        max_length=20,
        choices=[
            ("active", "Active"),
            ("inactive", "Inactive"),
            ("transferred", "Transferred"),
            ("dropped", "Dropped"),
            ("deleted", "Deleted"),
        ],
        default="active",
    )
    category = models.ForeignKey(
        StudentCategory,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    student_group = models.ForeignKey(
        StudentGroup,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    guardian = models.ForeignKey(
        Guardian,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    current_class = models.ForeignKey(
        "core.Class",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    current_section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    admission_inquiry = models.ForeignKey(
        "admissions.AdmissionInquiry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    # Transport Module Fields
    transport_route = models.ForeignKey(
        "core.TransportRoute",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    vehicle = models.ForeignKey(
        "core.Vehicle",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students",
    )
    is_disabled = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False, db_index=True)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="students_deleted",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "students"
        ordering = ["first_name", "last_name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "admission_no"], name="uq_student_school_admission_no"),
        ]
        indexes = [
            models.Index(fields=["admission_no"], name="idx_students_admission_no"),
            models.Index(fields=["first_name", "last_name"], name="idx_students_name"),
            models.Index(fields=["current_class"], name="idx_students_class"),
            models.Index(fields=["current_section"], name="idx_students_section"),
        ]

    def __str__(self):
        full_name = f"{self.first_name} {self.last_name}".strip()
        return f"{full_name} ({self.admission_no})"


class StudentDocument(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="documents")
    title = models.CharField(max_length=150)
    file_url = models.URLField(max_length=400)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "student_documents"
        ordering = ["-uploaded_at"]


class StudentTransferHistory(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="transfer_history")
    from_school = models.ForeignKey(
        "tenancy.School",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_transfers_from",
    )
    to_school = models.ForeignKey(
        "tenancy.School",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_transfers_to",
    )
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "student_transfer_history"
        ordering = ["-created_at"]


class StudentMultiClassRecord(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="multi_class_records")
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="multi_class_students")
    section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="multi_class_students",
    )
    roll_no = models.CharField(max_length=40, blank=True)
    is_default = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "student_multi_class_records"
        ordering = ["student_id", "-is_default", "school_class_id", "section_id", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "school_class", "section", "roll_no"],
                name="uq_student_multiclass_unique_record",
            ),
        ]

    def __str__(self):
        section = self.section.name if self.section else "-"
        return f"{self.student_id}:{self.school_class_id}:{section}"


class StudentSubjectAssignment(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="subject_assignments")
    subject = models.ForeignKey("core.Subject", on_delete=models.CASCADE, related_name="student_assignments")
    academic_year = models.ForeignKey("core.AcademicYear", on_delete=models.CASCADE, related_name="student_subject_assignments")
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="student_subject_assignments")
    section = models.ForeignKey("core.Section", on_delete=models.CASCADE, related_name="student_subject_assignments")
    is_optional = models.BooleanField(default=False)
    assigned_at = models.DateTimeField(auto_now_add=True)
    assigned_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_subject_assignments_done",
    )

    class Meta:
        db_table = "student_subject_assignments"
        ordering = ["-assigned_at", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["student", "subject", "academic_year"],
                name="uq_student_subject_academic_year",
            ),
        ]
        indexes = [
            models.Index(fields=["student", "academic_year"], name="idx_ssa_student_year"),
            models.Index(fields=["school_class", "section", "academic_year"], name="idx_ssa_class_section_year"),
            models.Index(fields=["subject", "academic_year"], name="idx_ssa_subject_year"),
        ]


class StudentRecordAudit(models.Model):
    ACTION_SOFT_DELETE = "soft_delete"
    ACTION_RESTORE = "restore"
    ACTION_PERMANENT_DELETE = "permanent_delete"
    ACTION_CHOICES = [
        (ACTION_SOFT_DELETE, "Soft Delete"),
        (ACTION_RESTORE, "Restore"),
        (ACTION_PERMANENT_DELETE, "Permanent Delete"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="student_record_audits")
    student = models.ForeignKey("students.Student", on_delete=models.SET_NULL, null=True, blank=True, related_name="delete_audits")
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)
    performed_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_record_audits_done",
    )
    note = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "student_record_audits"
        ordering = ["-created_at", "id"]


class StudentPromotionHistory(models.Model):
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name="promotion_history")
    from_class = models.ForeignKey(
        "core.Class",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promotions_from_class",
    )
    from_section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promotions_from_section",
    )
    to_class = models.ForeignKey(
        "core.Class",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promotions_to_class",
    )
    to_section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promotions_to_section",
    )
    from_academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promotions_from_year",
    )
    to_academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="promotions_to_year",
    )
    note = models.TextField(blank=True)
    promoted_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="student_promotions_done",
    )
    promoted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "student_promotion_history"
        ordering = ["-promoted_at"]
