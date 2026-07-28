from decimal import Decimal

from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models


PREDEFINED_DEPARTMENT_TYPES = ["Academic", "Administrative", "Support", "Transport", "Finance"]


class DepartmentType(models.Model):
    """School-scoped custom department types (predefined types are returned from constants, not stored here)."""

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="department_types")
    name = models.CharField(max_length=50)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hr_department_types"
        ordering = ["name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_hr_dept_type_school_name"),
        ]

    def __str__(self):
        return self.name


class Department(models.Model):
    PREDEFINED_TYPES = PREDEFINED_DEPARTMENT_TYPES

    STATUS_ACTIVE = "active"
    STATUS_INACTIVE = "inactive"
    STATUS_ARCHIVED = "archived"
    STATUS_CHOICES = [
        (STATUS_ACTIVE, "Active"),
        (STATUS_INACTIVE, "Inactive"),
        (STATUS_ARCHIVED, "Archived"),
    ]

    WORKING_DAYS_CHOICES = [
        ("Monday - Friday", "Monday - Friday"),
        ("Monday - Saturday", "Monday - Saturday"),
        ("All 7 days", "All 7 days"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="departments")
    name = models.CharField(max_length=120)
    short_code = models.CharField(max_length=10, blank=True, default="")
    dept_type = models.CharField(max_length=50, blank=True, default="")
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    working_days = models.CharField(max_length=30, choices=WORKING_DAYS_CHOICES, default="Monday - Friday", blank=True)
    head = models.ForeignKey(
        "Staff", null=True, blank=True, on_delete=models.SET_NULL, related_name="headed_departments"
    )
    deputy_head = models.ForeignKey(
        "Staff", null=True, blank=True, on_delete=models.SET_NULL, related_name="deputy_headed_departments"
    )
    description = models.TextField(blank=True)
    email = models.EmailField(max_length=255, blank=True, default="")
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
    short_code = models.CharField(max_length=10, blank=True, default="")
    role_template = models.CharField(max_length=50, blank=True, default="Teacher")
    employment_type = models.CharField(max_length=30, blank=True, default="Full-time")
    reports_to = models.CharField(max_length=50, blank=True, default="None")
    grade_level = models.CharField(max_length=50, blank=True, default="")
    sort_order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_designations"
        ordering = ["department_id", "sort_order", "name"]
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
    first_name = models.CharField(max_length=50)
    last_name = models.CharField(max_length=50, blank=True)
    fathers_name = models.CharField(max_length=120, blank=True)
    mothers_name = models.CharField(max_length=120, blank=True)
    date_of_birth = models.DateField(null=True, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=32, blank=True)
    emergency_mobile = models.CharField(max_length=32, blank=True)
    gender = models.CharField(max_length=10, choices=GENDER_CHOICES, blank=True)
    marital_status = models.CharField(max_length=12, choices=MARITAL_CHOICES, blank=True)
    driving_license = models.CharField(max_length=80, blank=True)
    staff_photo = models.ImageField(upload_to="staff/photos/", blank=True)
    current_address = models.TextField(blank=True)
    permanent_address = models.TextField(blank=True)
    qualification = models.CharField(max_length=255, blank=True)
    experience = models.CharField(max_length=255, blank=True)
    epf_no = models.CharField(max_length=80, blank=True)
    bank_account_name = models.CharField(max_length=50, blank=True)
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
    # Personal details
    blood_group = models.CharField(max_length=5, blank=True, null=True)
    nationality = models.CharField(max_length=100, blank=True, null=True)
    mother_tongue = models.CharField(max_length=100, blank=True, null=True)
    religion = models.CharField(max_length=100, blank=True, null=True)
    preferred_communication = models.CharField(
        max_length=20, 
        blank=True, 
        null=True,
        choices=[
            ("mobile", "Mobile"),
            ("whatsapp", "WhatsApp"),
            ("personal_email", "Personal Email"),
            ("official_email", "Official Email"),
        ]
    )
    num_children = models.PositiveSmallIntegerField(default=0, blank=True, null=True)
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


class StaffDocument(models.Model):
    DOCUMENT_RESUME = "resume"
    DOCUMENT_JOINING_LETTER = "joining_letter"
    DOCUMENT_TENTH_CERTIFICATE = "tenth_certificate"
    DOCUMENT_ELEVENTH_CERTIFICATE = "eleventh_certificate"
    DOCUMENT_AADHAR_CARD = "aadhar_card"
    DOCUMENT_DRIVING_LICENSE = "driving_license"
    DOCUMENT_OTHER = "other"
    # Added to cover every document type collected by the staff onboarding
    # wizard (StaffOnboardDocument.doc_key) so its uploads can be copied here
    # verbatim when onboarding completes — see StaffOnboardDocument docstring.
    DOCUMENT_SIGNATURE = "signature"
    DOCUMENT_PAN = "pan"
    DOCUMENT_PASSPORT_PHOTO = "passport_photo"
    DOCUMENT_BANK_PROOF = "bank_proof"
    DOCUMENT_ADDRESS_PROOF = "address_proof"
    DOCUMENT_DEGREE = "degree"
    DOCUMENT_BED = "bed"
    DOCUMENT_EXPERIENCE = "experience"
    DOCUMENT_NOC = "noc"
    DOCUMENT_MEDICAL_CERT = "medical_cert"
    DOCUMENT_POLICE_VERIFICATION = "police_verification"
    DOCUMENT_SIGNED_ONBOARDING_FORM = "signed_onboarding_form"
    DOCUMENT_TYPE_CHOICES = [
        (DOCUMENT_RESUME, "Resume"),
        (DOCUMENT_JOINING_LETTER, "Joining Letter"),
        (DOCUMENT_TENTH_CERTIFICATE, "Tenth Certificate"),
        (DOCUMENT_ELEVENTH_CERTIFICATE, "Eleventh Certificate"),
        (DOCUMENT_AADHAR_CARD, "Aadhar Card"),
        (DOCUMENT_DRIVING_LICENSE, "Driving License"),
        (DOCUMENT_SIGNATURE, "Signature (scanned image)"),
        (DOCUMENT_PAN, "PAN Card"),
        (DOCUMENT_PASSPORT_PHOTO, "Passport-size photograph"),
        (DOCUMENT_BANK_PROOF, "Bank cancelled cheque or passbook copy"),
        (DOCUMENT_ADDRESS_PROOF, "Address proof"),
        (DOCUMENT_DEGREE, "Degree / graduation certificate"),
        (DOCUMENT_BED, "B.Ed / D.El.Ed certificate"),
        (DOCUMENT_EXPERIENCE, "Experience letter (previous employer)"),
        (DOCUMENT_NOC, "No-objection certificate (previous employer)"),
        (DOCUMENT_MEDICAL_CERT, "Medical fitness certificate"),
        (DOCUMENT_POLICE_VERIFICATION, "Police verification certificate"),
        (DOCUMENT_SIGNED_ONBOARDING_FORM, "Signed Onboarding Acknowledgment"),
        (DOCUMENT_OTHER, "Other"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="staff_documents")
    staff = models.ForeignKey(Staff, on_delete=models.CASCADE, related_name="documents")
    document_type = models.CharField(max_length=32, choices=DOCUMENT_TYPE_CHOICES)
    file_path = models.CharField(max_length=500)
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveBigIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_staff_documents"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "staff", "document_type", "file_name"],
                name="uq_hr_staff_document_scope",
            ),
        ]

    def __str__(self):
        return f"{self.staff_id} - {self.get_document_type_display()}"


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
    arrival_time = models.TimeField(null=True, blank=True)
    sign_in_time = models.TimeField(null=True, blank=True)
    sign_out_time = models.TimeField(null=True, blank=True)
    lunch = models.BooleanField(default=False)
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
    allowance_items = models.JSONField(default=list, blank=True)
    deduction = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    deduction_items = models.JSONField(default=list, blank=True)
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


class StaffOnboardDraft(models.Model):
    """Partial staff onboarding form data saved as a draft.

    Scoped to the HR officer who created it.  Each user may hold up to
    MAX_DRAFTS_PER_USER drafts at a time.  Draft names are auto-derived from
    the partial first/last name in form_data.
    """

    MAX_DRAFTS_PER_USER = 10

    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="onboard_drafts",
    )
    school = models.ForeignKey(
        "tenancy.School",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="onboard_drafts",
    )
    draft_name = models.CharField(max_length=120, default="Unnamed draft")
    form_data = models.JSONField(default=dict)
    current_step = models.PositiveSmallIntegerField(default=1)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_staff_onboard_drafts"
        ordering = ["-updated_at"]

    def __str__(self):
        return f"{self.draft_name} (step {self.current_step})"


class StaffOnboardDocument(models.Model):
    """Temporary documents uploaded during the staff onboarding wizard.

    Each record is scoped to the uploading user + doc_key so there is at most
    one file per document type per HR officer session.  When the wizard
    completes and the Staff record is created the documents are copied to
    StaffDocument and these rows are deleted.
    """

    MANDATORY_KEYS = frozenset(["aadhaar"])

    # doc_key -> StaffDocument.document_type, for the few keys that predate this
    # model and already had a differently-named legacy choice. Any doc_key not
    # listed here is used as-is (it's now a matching StaffDocument choice).
    TO_STAFF_DOCUMENT_TYPE = {
        "aadhaar": "aadhar_card",
        "marksheet_10": "tenth_certificate",
        "marksheet_12": "eleventh_certificate",
    }

    uploaded_by = models.ForeignKey(
        "users.User",
        on_delete=models.CASCADE,
        related_name="onboard_documents",
    )
    school = models.ForeignKey(
        "tenancy.School",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="onboard_documents",
    )
    doc_key = models.CharField(max_length=64)
    doc_label = models.CharField(max_length=255)
    file = models.FileField(upload_to="staff_onboard_docs/%Y/%m/")
    file_name = models.CharField(max_length=255)
    file_size = models.PositiveBigIntegerField(default=0)
    content_type = models.CharField(max_length=100, default="application/octet-stream")
    status = models.CharField(
        max_length=20,
        default="uploaded",
        choices=[("uploaded", "Uploaded"), ("verified", "Verified"), ("rejected", "Rejected")],
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_staff_onboard_documents"
        ordering = ["-created_at"]
        # Enforce one file per (user, doc_key) – re-upload replaces the old record
        constraints = [
            models.UniqueConstraint(
                fields=["uploaded_by", "doc_key"],
                name="uq_hr_onboard_doc_user_key",
            )
        ]

    def __str__(self):
        return f"{self.uploaded_by_id} – {self.doc_key}"


class PayrollSettings(models.Model):
    school = models.OneToOneField("tenancy.School", on_delete=models.CASCADE, related_name="payroll_settings")
    school_name = models.CharField(max_length=200, blank=True)
    school_url = models.URLField(max_length=400, blank=True)
    logo_url = models.URLField(max_length=400, blank=True)
    signature_url = models.URLField(max_length=400, blank=True)
    default_allowance_items = models.JSONField(default=list, blank=True)
    default_deduction_items = models.JSONField(default=list, blank=True)
    default_allowance = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    default_deduction = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "hr_payroll_settings"

    def __str__(self):
        return f"Payroll settings ({self.school_id})"


class Offboarding(models.Model):
    EXIT_TYPE_CHOICES = [
        ("Resignation", "Resignation"),
        ("Termination", "Termination"),
        ("Retirement", "Retirement"),
        ("End of Contract", "End of Contract"),
        ("Transfer", "Transfer"),
        ("Voluntary Exit", "Voluntary Exit"),
    ]
    STATUS_INITIATED   = "initiated"
    STATUS_IN_PROGRESS = "in_progress"
    STATUS_COMPLETED   = "completed"
    STATUS_CHOICES = [
        (STATUS_INITIATED,   "Initiated"),
        (STATUS_IN_PROGRESS, "In Progress"),
        (STATUS_COMPLETED,   "Completed"),
    ]
    INTERVIEW_STATUS_CHOICES = [
        ("Pending",   "Pending"),
        ("Scheduled", "Scheduled"),
        ("Conducted", "Conducted"),
        ("Waived",    "Waived"),
    ]
    APPROVAL_STATUS_CHOICES = [
        ("Pending",  "Pending"),
        ("Approved", "Approved"),
        ("Rejected", "Rejected"),
    ]
    FF_STATUS_CHOICES = [
        ("Pending",    "Pending"),
        ("Processing", "Processing"),
        ("Cleared",    "Cleared"),
    ]
    NOTICE_PERIOD_STATUS_CHOICES = [
        ("Served",    "Served"),
        ("Bought Out", "Bought Out"),
        ("Waived",    "Waived"),
        ("Partial",   "Partial"),
    ]

    school              = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="offboarding_records")
    staff               = models.ForeignKey("hr.Staff", on_delete=models.CASCADE, related_name="offboarding_records")
    exit_type           = models.CharField(max_length=30, choices=EXIT_TYPE_CHOICES)
    exit_reason         = models.TextField(blank=True)
    last_working_day    = models.DateField()
    notice_period_status = models.CharField(max_length=20, choices=NOTICE_PERIOD_STATUS_CHOICES, blank=True)
    notice_period_days  = models.PositiveIntegerField(null=True, blank=True)
    exit_interview_conducted = models.CharField(max_length=20, choices=INTERVIEW_STATUS_CHOICES, default="Pending")
    exit_interview_notes = models.TextField(blank=True)
    interview_date      = models.DateField(null=True, blank=True)
    primary_reason      = models.TextField(blank=True)
    handover_checklist  = models.JSONField(default=list, blank=True)
    financial_clearance = models.JSONField(default=dict, blank=True)
    ff_status           = models.CharField(max_length=20, choices=FF_STATUS_CHOICES, default="Pending")
    salary_dues_cleared = models.BooleanField(default=False)
    advance_loan        = models.DecimalField(max_digits=12, decimal_places=2, default=Decimal("0.00"))
    gratuity_applicable = models.BooleanField(default=False)
    pf_esi_settlement   = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default="Pending")
    docs_to_issue       = models.JSONField(default=list, blank=True)
    hod_approval        = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default="Pending")
    principal_approval  = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default="Pending")
    hr_signoff          = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default="Pending")
    finance_clearance   = models.CharField(max_length=20, choices=APPROVAL_STATUS_CHOICES, default="Pending")
    hr_notes            = models.TextField(blank=True)
    status              = models.CharField(max_length=15, choices=STATUS_CHOICES, default=STATUS_INITIATED)
    completed_at        = models.DateTimeField(null=True, blank=True)
    created_at          = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "hr_offboarding"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Offboarding {self.staff_id} ({self.status})"
