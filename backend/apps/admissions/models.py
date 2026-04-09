from django.db import models
from django.core.exceptions import ValidationError
from django.utils import timezone

INQUIRY_STATUS_CHOICES = [
    ("new", "New"),
    ("contacted", "Contacted"),
    ("visited", "Visited"),
    ("enrolled", "Enrolled"),
    ("declined", "Declined"),
]


class AdmissionInquiry(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="admission_inquiries")
    full_name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    email = models.EmailField(blank=True)
    address = models.TextField(blank=True)
    description = models.TextField(blank=True)
    query_date = models.DateField(null=True, blank=True)
    follow_up_date = models.DateField(null=True, blank=True)
    next_follow_up_date = models.DateField(null=True, blank=True)
    assigned = models.CharField(max_length=255, blank=True)
    reference = models.ForeignKey(
        "admissions.AdminSetupEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admission_reference_inquiries",
    )
    source = models.ForeignKey(
        "admissions.AdminSetupEntry",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admission_source_inquiries",
    )
    school_class = models.ForeignKey(
        "core.Class",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admission_inquiries",
    )
    no_of_child = models.PositiveIntegerField(default=1)
    active_status = models.PositiveSmallIntegerField(default=1)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_admission_inquiries",
    )
    class_name = models.CharField(max_length=120, blank=True)
    note = models.TextField(blank=True)
    status = models.CharField(max_length=32, choices=INQUIRY_STATUS_CHOICES, default="new")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def clean(self):
        if self.follow_up_date and self.follow_up_date > timezone.localdate():
            raise ValidationError({"follow_up_date": "Follow-up date cannot be in the future."})
        if self.next_follow_up_date and self.next_follow_up_date < timezone.localdate():
            raise ValidationError({"next_follow_up_date": "Next follow-up date cannot be in the past."})
        if self.follow_up_date and self.next_follow_up_date and self.next_follow_up_date < self.follow_up_date:
            raise ValidationError({"next_follow_up_date": "Next follow-up date must be on or after last follow-up date."})

    def __str__(self):
        return self.full_name

    class Meta:
        db_table = "admission_inquiries"
        ordering = ["-created_at"]


class AdmissionFollowUp(models.Model):
    inquiry = models.ForeignKey(AdmissionInquiry, on_delete=models.CASCADE, related_name="follow_ups")
    author = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admission_follow_ups",
    )
    response = models.TextField(blank=True)
    note = models.TextField(blank=True)
    status_after = models.CharField(
        max_length=32,
        choices=INQUIRY_STATUS_CHOICES,
        blank=True,
        help_text="Inquiry status set at the time of this follow-up (optional)",
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "admission_follow_ups"
        ordering = ["created_at"]


class VisitorBookEntry(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="visitor_book_entries")
    purpose = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    phone = models.CharField(max_length=32, blank=True)
    visitor_id = models.CharField(max_length=64)
    no_of_person = models.PositiveIntegerField(default=1)
    date = models.DateField()
    in_time = models.CharField(max_length=32)
    out_time = models.CharField(max_length=32)
    file_url = models.FileField(upload_to="admissions/visitor_book/", blank=True, null=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="visitor_book_entries_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "visitor_book_entries"
        ordering = ["-created_at"]


class ComplaintEntry(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="complaint_entries")
    complaint_by = models.CharField(max_length=255)
    complaint_type = models.CharField(max_length=120)
    complaint_source = models.CharField(max_length=120)
    phone = models.CharField(max_length=32, blank=True)
    date = models.DateField(null=True, blank=True)
    action_taken = models.CharField(max_length=255, blank=True)
    assigned = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    file = models.FileField(upload_to="admissions/complaints/", blank=True, null=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="complaint_entries_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "complaint_entries"
        ordering = ["-created_at"]


class PostalReceiveEntry(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="postal_receive_entries")
    from_title = models.CharField(max_length=255)
    reference_no = models.CharField(max_length=120)
    address = models.CharField(max_length=255)
    note = models.TextField(blank=True)
    to_title = models.CharField(max_length=255)
    date = models.DateField(null=True, blank=True)
    file = models.FileField(upload_to="admissions/postal_receive/", blank=True, null=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="postal_receive_entries_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "postal_receive_entries"
        ordering = ["-created_at"]


class PostalDispatchEntry(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="postal_dispatch_entries")
    from_title = models.CharField(max_length=255)
    reference_no = models.CharField(max_length=120)
    address = models.CharField(max_length=255)
    note = models.TextField(blank=True)
    to_title = models.CharField(max_length=255)
    date = models.DateField(null=True, blank=True)
    file = models.FileField(upload_to="admissions/postal_dispatch/", blank=True, null=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="postal_dispatch_entries_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "postal_dispatch_entries"
        ordering = ["-created_at"]


PHONE_CALL_TYPE_CHOICES = [
    ("I", "Incoming"),
    ("O", "Outgoing"),
]


class PhoneCallLogEntry(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="phone_call_log_entries")
    name = models.CharField(max_length=255, blank=True)
    phone = models.CharField(max_length=32)
    date = models.DateField(null=True, blank=True)
    next_follow_up_date = models.DateField(null=True, blank=True)
    call_duration = models.CharField(max_length=120, blank=True)
    description = models.TextField(blank=True)
    call_type = models.CharField(max_length=1, choices=PHONE_CALL_TYPE_CHOICES, default="I")
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="phone_call_log_entries_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "phone_call_log_entries"
        ordering = ["-created_at"]


ADMIN_SETUP_TYPE_CHOICES = [
    ("1", "Purpose"),
    ("2", "Complaint Type"),
    ("3", "Source"),
    ("4", "Reference"),
]


class AdminSetupEntry(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="admin_setup_entries")
    type = models.CharField(max_length=1, choices=ADMIN_SETUP_TYPE_CHOICES)
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="admin_setup_entries_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "admin_setup_entries"
        ordering = ["type", "name"]
        unique_together = ("school", "type", "name")


ID_CARD_LAYOUT_CHOICES = [
    ("horizontal", "Horizontal"),
    ("vertical", "Vertical"),
]


ID_CARD_PHOTO_STYLE_CHOICES = [
    ("squre", "Square"),
    ("round", "Round"),
]


class IdCardTemplate(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="id_card_templates")
    title = models.CharField(max_length=255)
    page_layout_style = models.CharField(max_length=16, choices=ID_CARD_LAYOUT_CHOICES, default="horizontal")
    applicable_role_ids = models.JSONField(default=list, blank=True)
    pl_width = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    pl_height = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    user_photo_style = models.CharField(max_length=16, choices=ID_CARD_PHOTO_STYLE_CHOICES, default="squre")
    user_photo_width = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    user_photo_height = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    t_space = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    b_space = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    l_space = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    r_space = models.DecimalField(max_digits=8, decimal_places=2, null=True, blank=True)
    background_img = models.FileField(upload_to="admissions/id_cards/backgrounds/", blank=True, null=True)
    profile_image = models.FileField(upload_to="admissions/id_cards/profiles/", blank=True, null=True)
    logo = models.FileField(upload_to="admissions/id_cards/logos/", blank=True, null=True)
    signature = models.FileField(upload_to="admissions/id_cards/signatures/", blank=True, null=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="id_card_templates_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "id_card_templates"
        ordering = ["-created_at"]


CERTIFICATE_TYPE_CHOICES = [
    ("School", "School"),
    ("Lms", "Lms"),
]


class CertificateTemplate(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="certificate_templates")
    type = models.CharField(max_length=16, choices=CERTIFICATE_TYPE_CHOICES, default="School")
    title = models.CharField(max_length=255)
    applicable_role_id = models.IntegerField(null=True, blank=True)
    background_height = models.DecimalField(max_digits=8, decimal_places=2, default=144)
    background_width = models.DecimalField(max_digits=8, decimal_places=2, default=165)
    padding_top = models.DecimalField(max_digits=8, decimal_places=2, default=5)
    padding_right = models.DecimalField(max_digits=8, decimal_places=2, default=5)
    padding_bottom = models.DecimalField(max_digits=8, decimal_places=2, default=5)
    pading_left = models.DecimalField(max_digits=8, decimal_places=2, default=5)
    body = models.TextField()
    background_image = models.FileField(upload_to="admissions/certificates/backgrounds/", blank=True, null=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="certificate_templates_created",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "certificate_templates"
        ordering = ["-created_at"]
