from django.conf import settings as django_settings
from django.db import models, transaction

from .fields import EncryptedCharField


class LeaveBalance(models.Model):
    """Per-staff, per-leave-type, per-year balance ledger — the piece Royal
    HRMS has that a pure 'policy fields on LeaveType' model doesn't: an
    actual running total distinct from the policy's max_days_per_year."""

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="leave_balances")
    staff = models.ForeignKey("hr.Staff", on_delete=models.CASCADE, related_name="leave_balances")
    leave_type = models.ForeignKey("hr.LeaveType", on_delete=models.CASCADE, related_name="balances")
    year = models.PositiveSmallIntegerField()
    total_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    used_days = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    carried_forward = models.DecimalField(max_digits=5, decimal_places=1, default=0)
    carry_forward_expiry_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "settings_leave_balances"
        constraints = [
            models.UniqueConstraint(fields=["staff", "leave_type", "year"], name="uq_settings_leave_balance"),
        ]
        indexes = [
            models.Index(fields=["school", "year"], name="idx_settings_lb_sch_yr"),
        ]

    @property
    def available_days(self):
        return self.total_days + self.carried_forward - self.used_days

    def __str__(self):
        return f"{self.staff_id} - {self.leave_type_id} - {self.year}"


class CarryForwardLog(models.Model):
    """Audit trail of a carry-forward batch run (preview never writes one —
    only an actual run does), matching Royal HRMS's CarryForwardLog."""

    MODE_PREVIEW = "preview"
    MODE_EXECUTED = "executed"
    MODE_CHOICES = [
        (MODE_PREVIEW, "Preview"),
        (MODE_EXECUTED, "Executed"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="carry_forward_logs")
    from_year = models.PositiveSmallIntegerField()
    to_year = models.PositiveSmallIntegerField()
    executed_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    process_mode = models.CharField(max_length=16, choices=MODE_CHOICES, default=MODE_EXECUTED)
    total_processed = models.PositiveIntegerField(default=0)
    total_skipped = models.PositiveIntegerField(default=0)
    total_failed = models.PositiveIntegerField(default=0)
    is_completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "settings_carry_forward_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Carry-forward {self.from_year}->{self.to_year} ({self.process_mode})"


class StaffHolidayExclusion(models.Model):
    """Opts a given school-wide Holiday (apps.core.Holiday, audience='all')
    out of the staff calendar for one school. Never used to add holidays —
    additions go through Holiday itself with audience='staff_only'."""

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="staff_holiday_exclusions")
    holiday = models.ForeignKey("core.Holiday", on_delete=models.CASCADE, related_name="staff_exclusions")
    reason = models.CharField(max_length=255, blank=True)
    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "settings_staff_holiday_exclusions"
        constraints = [
            models.UniqueConstraint(fields=["school", "holiday"], name="uq_settings_staff_holiday_exclusion"),
        ]

    def __str__(self):
        return f"{self.holiday_id} excluded for staff @ school {self.school_id}"


class SchoolSMTPSettings(models.Model):
    TYPE_LOCAL = "local"
    TYPE_SERVER = "server"
    SMTP_TYPE_CHOICES = [
        (TYPE_LOCAL, "Local"),
        (TYPE_SERVER, "Server"),
    ]

    PRIORITY_NORMAL = "normal"
    PRIORITY_HIGH = "high"
    PRIORITY_LOW = "low"
    PRIORITY_CHOICES = [
        (PRIORITY_NORMAL, "Normal"),
        (PRIORITY_HIGH, "High"),
        (PRIORITY_LOW, "Low"),
    ]

    RECEIVER_EMAIL_ID = "email_id"
    RECEIVER_PERSONAL_EMAIL_ID = "personal_email_id"
    RECEIVER_EMAIL_TYPE_CHOICES = [
        (RECEIVER_EMAIL_ID, "Official Email ID"),
        (RECEIVER_PERSONAL_EMAIL_ID, "Personal Email ID"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="smtp_settings")
    name = models.CharField(max_length=80, help_text="Label for this config, e.g. 'Primary Gmail relay'")
    smtp_type = models.CharField(max_length=16, choices=SMTP_TYPE_CHOICES, default=TYPE_SERVER)
    host = models.CharField(max_length=255)
    port = models.PositiveIntegerField(default=587)
    username = models.CharField(max_length=255, blank=True)
    password = EncryptedCharField(max_length=512, blank=True)
    use_tls = models.BooleanField(default=True)
    from_email = models.EmailField()
    bcc_email = models.EmailField(blank=True)
    sender_name = models.CharField(max_length=120, blank=True)
    priority = models.CharField(max_length=16, choices=PRIORITY_CHOICES, default=PRIORITY_NORMAL)
    receiver_email_type = models.CharField(
        max_length=24, choices=RECEIVER_EMAIL_TYPE_CHOICES, default=RECEIVER_EMAIL_ID
    )
    is_active = models.BooleanField(default=False)
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "settings_smtp_settings"
        ordering = ["-is_active", "name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_settings_smtp_school_name"),
        ]

    def __str__(self):
        return f"{self.name} ({'active' if self.is_active else 'inactive'})"

    @transaction.atomic
    def activate(self):
        SchoolSMTPSettings.objects.filter(school_id=self.school_id).exclude(pk=self.pk).update(is_active=False)
        self.is_active = True
        self.save(update_fields=["is_active", "updated_at"])


class SettingsAuditLog(models.Model):
    """Mirrors apps.admissions.AuditLog's shape (the project's existing
    convention for a lightweight audit trail) but with the field named
    `actor` used consistently at every write site — see audit.py."""

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="settings_audit_logs")
    actor = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    action = models.CharField(max_length=80, help_text="e.g. smtp.activate, leave_policy.update, document.upload")
    object_type = models.CharField(max_length=60, blank=True)
    object_id = models.CharField(max_length=60, blank=True)
    changes = models.JSONField(default=dict, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "settings_audit_logs"
        ordering = ["-created_at"]
        indexes = [
            models.Index(fields=["school", "action"]),
            models.Index(fields=["object_type", "object_id"]),
        ]

    def __str__(self):
        return f"{self.action} by {self.actor_id} at {self.created_at:%Y-%m-%d %H:%M}"


class SchoolAttendancePolicy(models.Model):
    """A named attendance rule set. A school can have multiple (e.g. one for
    teaching staff, one for non-teaching staff, one for a night shift), with
    exactly one marked is_default. Replaces the earlier one-per-school
    singleton (SchoolAttendanceRules) — no data migration needed, that table
    was never populated with real data."""

    LOP_FULL_DAY = "full_day"
    LOP_HALF_DAY = "half_day"
    LOP_DEDUCTION_CHOICES = [
        (LOP_FULL_DAY, "Full day"),
        (LOP_HALF_DAY, "Half day"),
    ]

    NOTIFY_MANAGER_AND_HR = "manager_and_hr"
    NOTIFY_HR_ONLY = "hr_only"
    NOTIFY_MANAGER_ONLY = "manager_only"
    NOTIFY_CHOICES = [
        (NOTIFY_MANAGER_AND_HR, "Manager & HR"),
        (NOTIFY_HR_ONLY, "HR only"),
        (NOTIFY_MANAGER_ONLY, "Manager only"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="attendance_policies")
    name = models.CharField(max_length=100, help_text="e.g. 'Teaching Staff', 'Non-Teaching Staff'")
    is_default = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    applies_to_roles = models.ManyToManyField(
        "access_control.Role",
        blank=True,
        related_name="attendance_policies",
        help_text="Roles this policy applies to. Empty = applies to all staff without a more specific policy.",
    )

    shift_start = models.TimeField(default="09:00")
    shift_end = models.TimeField(default="17:00")
    grace_period_minutes = models.PositiveSmallIntegerField(default=15)
    missing_punch_grace_minutes = models.PositiveSmallIntegerField(default=10)
    break_duration_minutes = models.PositiveSmallIntegerField(default=30)

    min_hours_full_day = models.DecimalField(max_digits=4, decimal_places=2, default=8.00)
    min_hours_half_day = models.DecimalField(max_digits=4, decimal_places=2, default=4.00)
    early_exit_grace_minutes = models.PositiveSmallIntegerField(default=30)

    ot_threshold_hours = models.DecimalField(max_digits=4, decimal_places=2, default=9.00)
    ot_multiplier_regular = models.DecimalField(max_digits=4, decimal_places=2, default=1.50)
    ot_multiplier_holiday = models.DecimalField(max_digits=4, decimal_places=2, default=2.00)

    late_marks_per_lop = models.PositiveSmallIntegerField(
        default=3, help_text="Number of late marks that convert to one LOP deduction; 0 = tracking only"
    )
    lop_deduction_unit = models.CharField(max_length=16, choices=LOP_DEDUCTION_CHOICES, default=LOP_FULL_DAY)

    weekly_off_mon = models.BooleanField(default=False)
    weekly_off_tue = models.BooleanField(default=False)
    weekly_off_wed = models.BooleanField(default=False)
    weekly_off_thu = models.BooleanField(default=False)
    weekly_off_fri = models.BooleanField(default=False)
    weekly_off_sat = models.BooleanField(default=True)
    weekly_off_sun = models.BooleanField(default=True)

    absence_alert_enabled = models.BooleanField(default=False)
    absence_alert_after_days = models.PositiveSmallIntegerField(default=3)
    absence_alert_notify_whom = models.CharField(max_length=20, choices=NOTIFY_CHOICES, default=NOTIFY_MANAGER_AND_HR)

    created_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "settings_attendance_policies"
        ordering = ["-is_default", "name"]
        constraints = [
            models.UniqueConstraint(fields=["school", "name"], name="uq_settings_attendance_policy_name"),
        ]

    def __str__(self):
        return f"{self.name} ({'default' if self.is_default else 'school ' + str(self.school_id)})"

    @transaction.atomic
    def make_default(self):
        SchoolAttendancePolicy.objects.filter(school_id=self.school_id).exclude(pk=self.pk).update(is_default=False)
        self.is_default = True
        self.save(update_fields=["is_default", "updated_at"])


class SchoolPolicyDocument(models.Model):
    CATEGORY_CODE_OF_CONDUCT = "code_of_conduct"
    CATEGORY_RULEBOOK = "rulebook"
    CATEGORY_NORMS = "norms"
    CATEGORY_OTHER = "other"
    CATEGORY_CHOICES = [
        (CATEGORY_CODE_OF_CONDUCT, "Code of Conduct"),
        (CATEGORY_RULEBOOK, "Rule Book"),
        (CATEGORY_NORMS, "School Norms"),
        (CATEGORY_OTHER, "Other"),
    ]

    # MIME -> short display type, and the max upload size — enforced in
    # SchoolPolicyDocumentSerializer.validate_file().
    MIME_TO_TYPE = {
        "application/pdf": "PDF",
        "application/msword": "DOC",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
        "application/vnd.ms-excel": "XLS",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "XLSX",
        "application/vnd.ms-powerpoint": "PPT",
        "application/vnd.openxmlformats-officedocument.presentationml.presentation": "PPTX",
        "image/jpeg": "JPG",
        "image/png": "PNG",
        "text/plain": "TXT",
        "text/csv": "CSV",
    }
    ALLOWED_MIME_TYPES = set(MIME_TO_TYPE.keys())
    MAX_FILE_SIZE = 25 * 1024 * 1024  # 25MB, matches Royal HRMS's company-document limit

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="policy_documents")
    title = models.CharField(max_length=150)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default=CATEGORY_OTHER)
    file = models.FileField(upload_to="settings/policy_docs/%Y/%m/")
    file_name = models.CharField(max_length=255, blank=True)
    file_type = models.CharField(max_length=16, blank=True, help_text="Derived display type, e.g. PDF, DOCX")
    file_size = models.PositiveBigIntegerField(default=0, help_text="File size in bytes")
    uploaded_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    is_active = models.BooleanField(default=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "settings_policy_documents"
        ordering = ["-uploaded_at"]
        indexes = [
            models.Index(fields=["school", "category"], name="idx_settings_policy_doc_cat"),
        ]

    def __str__(self):
        return f"{self.title} ({self.get_category_display()})"


class DocumentBrandingSettings(models.Model):
    """Single source of truth for the header/letterhead shown on every
    generated PDF/print document across the ERP — student & staff
    verification forms, fee receipts, payslips, and anything added later.
    One row per school (get-or-created on first access, see
    DocumentBrandingSettingsView.get_object()).

    See apps.settings.branding for the rendering logic that turns this row
    into the actual header image every consumer fetches from
    DocumentBrandingHeaderImageView — that is the one integration point
    every print/PDF feature calls, so there is exactly one place that knows
    how to build a header, not one per feature.
    """

    MODE_GENERATED = "generated"
    MODE_UPLOADED = "uploaded"
    MODE_CHOICES = [
        (MODE_GENERATED, "Generated from school details"),
        (MODE_UPLOADED, "Uploaded letterhead"),
    ]

    STYLE_CLASSIC = "classic"
    STYLE_MODERN = "modern"
    STYLE_MINIMAL = "minimal"
    STYLE_EXECUTIVE = "executive"
    STYLE_LETTERPRESS = "letterpress"
    STYLE_BANNER = "banner"
    STYLE_CHOICES = [
        (STYLE_CLASSIC, "Classic"),
        (STYLE_MODERN, "Modern"),
        (STYLE_MINIMAL, "Minimal"),
        (STYLE_EXECUTIVE, "Executive"),
        (STYLE_LETTERPRESS, "Letterpress"),
        (STYLE_BANNER, "Banner"),
    ]

    SIZE_COMPACT = "compact"
    SIZE_STANDARD = "standard"
    SIZE_TALL = "tall"
    SIZE_CHOICES = [
        (SIZE_COMPACT, "Compact"),
        (SIZE_STANDARD, "Standard"),
        (SIZE_TALL, "Tall"),
    ]

    DIVIDER_NONE = "none"
    DIVIDER_SOLID = "solid"
    DIVIDER_DOUBLE = "double"
    DIVIDER_DASHED = "dashed"
    DIVIDER_THICK_RULE = "thick_rule"
    DIVIDER_CHOICES = [
        (DIVIDER_NONE, "None"),
        (DIVIDER_SOLID, "Solid"),
        (DIVIDER_DOUBLE, "Double Line"),
        (DIVIDER_DASHED, "Dashed"),
        (DIVIDER_THICK_RULE, "Thick Rule"),
    ]

    LOGO_LEFT = "left"
    LOGO_CENTER = "center"
    LOGO_RIGHT = "right"
    LOGO_POSITION_CHOICES = [
        (LOGO_LEFT, "Left"),
        (LOGO_CENTER, "Center"),
        (LOGO_RIGHT, "Right"),
    ]

    LETTERHEAD_PDF = "pdf"
    LETTERHEAD_IMAGE = "image"
    LETTERHEAD_TYPE_CHOICES = [
        (LETTERHEAD_PDF, "PDF"),
        (LETTERHEAD_IMAGE, "Image"),
    ]

    school = models.OneToOneField("tenancy.School", on_delete=models.CASCADE, related_name="document_branding")

    header_mode = models.CharField(max_length=16, choices=MODE_CHOICES, default=MODE_GENERATED)

    # --- Generated mode: composed live from SchoolTenant identity fields
    # (name, address, phone, email, logo_url, motto, ...) at request time —
    # see apps.settings.branding.render_generated_header_png(). Deliberately
    # NOT cached: caching a flattened image here would go stale the moment
    # someone edits School Info on a different screen, silently printing an
    # outdated header. Rendering live costs a few dozen ms and is only ever
    # triggered by an explicit "download PDF" action, never a hot path.
    header_style = models.CharField(max_length=16, choices=STYLE_CHOICES, default=STYLE_CLASSIC)
    header_text_color = models.CharField(max_length=7, default="#1A1A2E", help_text="Hex color, e.g. #1A1A2E")
    accent_color = models.CharField(max_length=7, default="#1A1A2E", help_text="Hex color for borders and divider lines.")
    header_size = models.CharField(max_length=16, choices=SIZE_CHOICES, default=SIZE_STANDARD)
    logo_position = models.CharField(max_length=8, choices=LOGO_POSITION_CHOICES, default=LOGO_CENTER)
    show_divider = models.BooleanField(default=True)
    divider_style = models.CharField(max_length=16, choices=DIVIDER_CHOICES, default=DIVIDER_SOLID)
    show_watermark = models.BooleanField(default=False)
    watermark_text = models.CharField(
        max_length=80, blank=True,
        help_text="Diagonal watermark text on the header. Defaults to the school name when blank.",
    )
    show_logo = models.BooleanField(default=True, help_text="Include the school logo in generated headers.")

    # --- Uploaded letterhead mode: the school's own ready-made header,
    # rasterized to a PNG ONCE at upload time (see
    # DocumentBrandingUploadLetterheadView) — safe to cache because the only
    # thing that can invalidate it is a new upload, which regenerates it.
    letterhead_source_file = models.FileField(
        upload_to="settings/branding/letterheads/%Y/%m/", null=True, blank=True,
        help_text="Original uploaded file (PDF or image), kept for reference/re-download.",
    )
    letterhead_source_file_type = models.CharField(max_length=8, choices=LETTERHEAD_TYPE_CHOICES, blank=True)
    letterhead_rendered_image = models.ImageField(
        upload_to="settings/branding/rendered/%Y/%m/", null=True, blank=True,
        help_text="PNG rasterized from letterhead_source_file — this is what actually gets served.",
    )

    # --- Per-document declaration text. Deliberately separate fields (not a
    # generic key-value store) — the known document types are small and
    # fixed for now; add a field here (and to the serializer/UI) if a new
    # document type needs its own declaration later.
    declaration_student_verification = models.TextField(blank=True)
    declaration_staff_onboarding = models.TextField(blank=True)
    declaration_payslip = models.TextField(blank=True)
    declaration_fee_receipt = models.TextField(blank=True)
    declaration_transfer_certificate = models.TextField(blank=True)
    declaration_admission = models.TextField(blank=True)

    updated_by = models.ForeignKey(
        django_settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name="+"
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "settings_document_branding"

    def __str__(self):
        return f"Document branding for school {self.school_id}"
