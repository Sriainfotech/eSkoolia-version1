from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


class Department(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_departments"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_hr_dept_school_name"),
        ]

    def __str__(self):
        return self.name


class Designation(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="designations")
    department = models.ForeignKey(Department, on_delete=models.CASCADE, related_name="designations")
    name = models.CharField(max_length=120)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_designations"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "department", "name"], name="uq_hr_desig_scope_name"),
        ]

    def __str__(self):
        return self.name


class Staff(models.Model):
    STATUS_ACTIVE = "active"
    STATUS_INACTIVE = "inactive"
    STATUS_TERMINATED = "terminated"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_INACTIVE, "Inactive"),
        (STATUS_TERMINATED, "Terminated"),
    ]
    GENDER_MALE = "male"
    GENDER_FEMALE = "female"
    GENDER_OTHER = "other"
    GENDER_CHOICES = [
        (GENDER_MALE, "Male"),
        (GENDER_FEMALE, "Female"),
        (GENDER_OTHER, "Other"),
    ]
    MARITAL_SINGLE = "single"
    MARITAL_MARRIED = "married"
    MARITAL_CHOICES = [
        (MARITAL_SINGLE, "Single"),
        (MARITAL_MARRIED, "Married"),
    ]
    CONTRACT_PERMANENT = "permanent"
    CONTRACT_CONTRACT = "contract"
    CONTRACT_CHOICES = [
        (CONTRACT_PERMANENT, "Permanent"),
        (CONTRACT_CONTRACT, "Contract"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="staff_members")
    user = models.OneToOneField(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="staff_profile",
    )
    role = models.ForeignKey("access_control.Role", on_delete=models.SET_NULL, null=True, blank=True, related_name="staff_members")
    staff_no = models.CharField(max_length=40)
    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80, blank=True)
    fathers_name = models.CharField(max_length=120, blank=True)
    mothers_name = models.CharField(max_length=120, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    emergency_mobile = models.CharField(max_length=32, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    marital_status = models.CharField(max_length=12, choices=MARITAL_CHOICES, blank=True)
    driving_license = models.CharField(max_length=80, blank=True)
    staff_photo = models.CharField(max_length=300, blank=True)
    current_address = models.TextField(blank=True)
    permanent_address = models.TextField(blank=True)
    qualification = models.CharField(max_length=255, blank=True)
    experience = models.CharField(max_length=255, blank=True)
    epf_no = models.CharField(max_length=80, blank=True)
    bank_account_name = models.CharField(max_length=120, blank=True)
    bank_account_no = models.CharField(max_length=120, blank=True)
    bank_name = models.CharField(max_length=120, blank=True)
    bank_branch = models.CharField(max_length=120, blank=True)
    bank_mobile_no = models.CharField(max_length=32, blank=True)
    facebook_url = models.URLField(max_length=400, blank=True)
    twitter_url = models.URLField(max_length=400, blank=True)
    linkedin_url = models.URLField(max_length=400, blank=True)
    instagram_url = models.URLField(max_length=400, blank=True)
    casual_leave = models.PositiveSmallIntegerField(default=0)
    medical_leave = models.PositiveSmallIntegerField(default=0)
    maternity_leave = models.PositiveSmallIntegerField(default=0)
    show_public = models.BooleanField(default=False)
    custom_field = models.JSONField(
        default=dict, 
        blank=True,
        help_text="JSON field for extensible data. Current supported fields: {'ifsc_code': 'string', 'allowance': 'decimal', 'deduction': 'decimal'}"
    )
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True, related_name="staff_members")
    designation = models.ForeignKey(Designation, on_delete=models.SET_NULL, null=True, blank=True, related_name="staff_members")
    contract_type = models.CharField(max_length=20, choices=CONTRACT_CHOICES, blank=True)
    location = models.CharField(max_length=255, blank=True)
    resume = models.CharField(max_length=300, blank=True)
    joining_letter = models.CharField(max_length=300, blank=True)
    tenth_certificate = models.CharField(max_length=300, blank=True)
    eleventh_certificate = models.CharField(max_length=300, blank=True)
    aadhar_card = models.CharField(max_length=300, blank=True)
    driving_license_doc = models.CharField(max_length=300, blank=True)
    other_document = models.JSONField(default=list, blank=True)
    join_date = models.DateField()
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_staff"
        ordering = ["first_name", "last_name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "staff_no"], name="uq_hr_staff_school_staff_no"),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name}".strip()


class LeaveType(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="leave_types")
    name = models.CharField(max_length=80)
    max_days_per_year = models.PositiveSmallIntegerField(default=0)
    is_paid = models.BooleanField(default=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hr_leave_types"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_hr_leave_type_school_name"),
        ]

    def __str__(self):
        return self.name


class LeaveDefine(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="leave_defines")
    role = models.ForeignKey(
        "access_control.Role",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leave_defines",
    )
    staff = models.ForeignKey(Staff, on_delete=models.SET_NULL, null=True, blank=True, related_name="leave_defines")
    student = models.ForeignKey(
        "students.Student",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leave_defines",
    )
    school_class = models.ForeignKey(
        "core.Class",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leave_defines",
    )
    section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="leave_defines",
    )
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name="leave_defines")
    days = models.PositiveSmallIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_leave_defines"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["school", "role"], name="idx_hr_ld_sch_role"),
            models.Index(fields=["school", "staff"], name="idx_hr_ld_sch_staff"),
            models.Index(fields=["school", "student"], name="idx_hr_ld_sch_student"),
            models.Index(fields=["school", "school_class"], name="idx_hr_ld_sch_class"),
            models.Index(fields=["school", "section"], name="idx_hr_ld_sch_section"),
        ]


class StaffAttendance(models.Model):
    STATUS_PRESENT = "P"
    STATUS_ABSENT = "A"
    STATUS_LEAVE = "L"
    STATUS_HALF_DAY = "F"
    STATUS_HOLIDAY = "H"
    STATUS_CHOICES = [
        (STATUS_PRESENT, "Present"),
        (STATUS_ABSENT, "Absent"),
        (STATUS_LEAVE, "Leave"),
        (STATUS_HALF_DAY, "Half Day"),
        (STATUS_HOLIDAY, "Holiday"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="staff_attendance")
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name="attendance_records")
    attendance_date = models.DateField()
    attendance_type = models.CharField(max_length=1, choices=STATUS_CHOICES, default=STATUS_PRESENT)
    note = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_staff_attendance"
        ordering = ["-attendance_date", "staff_id"]
        constraints = [
            models.UniqueConstraint(fields=["school", "staff", "attendance_date"], name="uq_hr_staff_attendance"),
        ]


class LeaveRequest(models.Model):
    STATUS_PENDING = "pending"
    STATUS_APPROVED = "approved"
    STATUS_REJECTED = "rejected"
    STATUS_CHOICES = [
        (STATUS_PENDING, "Pending"),
        (STATUS_APPROVED, "Approved"),
        (STATUS_REJECTED, "Rejected"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="leave_requests")
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name="leave_requests")
    leave_type = models.ForeignKey(LeaveType, on_delete=models.CASCADE, related_name="leave_requests")
    from_date = models.DateField()
    to_date = models.DateField()
    reason = models.TextField(blank=True)
    attachment = models.CharField(max_length=300, blank=True)
    approval_note = models.TextField(blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default=STATUS_PENDING)
    approved_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="approved_leave_requests",
    )
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_leave_requests"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["school", "status"], name="idx_hr_leave_sch_st"),
        ]


class PayrollRecord(models.Model):
    STATUS_DRAFT = "draft"
    STATUS_PROCESSED = "processed"
    STATUS_PAID = "paid"
    STATUS_CHOICES = [
        (STATUS_DRAFT, "Draft"),
        (STATUS_PROCESSED, "Processed"),
        (STATUS_PAID, "Paid"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="payroll_records")
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name="payroll_records")
    payroll_month = models.PositiveSmallIntegerField(validators=[MinValueValidator(1), MaxValueValidator(12)])
    payroll_year = models.PositiveSmallIntegerField(validators=[MinValueValidator(2000), MaxValueValidator(2100)])
    basic_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    deduction = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    net_salary = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_DRAFT)
    paid_at = models.DateTimeField(null=True, blank=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="payroll_records_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_payroll_records"
        ordering = ["-payroll_year", "-payroll_month", "staff_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "staff", "payroll_month", "payroll_year"],
                name="uq_hr_payroll_scope",
            ),
        ]

    def save(self, *args, **kwargs):
        self.net_salary = (self.basic_salary + self.allowance) - self.deduction
        super().save(*args, **kwargs)


class StaffDocument(models.Model):
    """
    Model for storing multiple document uploads per staff member.
    Replaces the single file path storage with proper file management.
    
    Examples:
    - Resume, joining letter, educational certificates, etc.
    """
    DOCUMENT_TYPE_CHOICES = [
        ("resume", "Resume"),
        ("joining_letter", "Joining Letter"),
        ("tenth_certificate", "10th Certificate"),
        ("eleventh_certificate", "11th Certificate"),
        ("aadhar_card", "Aadhar Card"),
        ("driving_license", "Driving License"),
        ("other", "Other Document"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="staff_documents")
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES, default="other")
    file_path = models.CharField(max_length=500, help_text="S3 or file storage path")
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveIntegerField(help_text="File size in bytes")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_staff_documents"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["staff", "document_type"]),
            models.Index(fields=["school", "created_at"]),
        ]
        constraints = [
            models.UniqueConstraint(fields=["staff", "document_type", "file_name"], name="uq_staff_doc_scope"),
        ]

    def __str__(self):
        return f"{self.staff} - {self.get_document_type_display()}"
