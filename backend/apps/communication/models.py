from django.conf import settings
from django.db import models


class TimestampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class CommunicationPreference(TimestampedModel):
    DIGEST_INSTANT = "instant"
    DIGEST_DAILY = "daily"
    DIGEST_WEEKLY = "weekly"

    DIGEST_CHOICES = [
        (DIGEST_INSTANT, "Instant"),
        (DIGEST_DAILY, "Daily"),
        (DIGEST_WEEKLY, "Weekly"),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="communication_preference",
    )
    school = models.ForeignKey(
        "tenancy.School",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_preferences",
    )
    allow_email = models.BooleanField(default=True)
    allow_in_app = models.BooleanField(default=True)
    allow_notifications = models.BooleanField(default=True)
    mute_all = models.BooleanField(default=False)
    digest_frequency = models.CharField(
        max_length=16,
        choices=DIGEST_CHOICES,
        default=DIGEST_INSTANT,
    )
    quiet_hours_start = models.TimeField(null=True, blank=True)
    quiet_hours_end = models.TimeField(null=True, blank=True)

    class Meta:
        db_table = "communication_preferences"

    def __str__(self):
        return f"Preferences({self.user_id})"


class CommunicationNotification(TimestampedModel):
    TYPE_SYSTEM = "system"
    TYPE_ANNOUNCEMENT = "announcement"
    TYPE_REMINDER = "reminder"
    TYPE_MESSAGE = "message"

    TYPE_CHOICES = [
        (TYPE_SYSTEM, "System"),
        (TYPE_ANNOUNCEMENT, "Announcement"),
        (TYPE_REMINDER, "Reminder"),
        (TYPE_MESSAGE, "Message"),
    ]

    school = models.ForeignKey(
        "tenancy.School",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_notifications",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="communication_notifications",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_communication_notifications",
    )
    title = models.CharField(max_length=255)
    body = models.TextField()
    notification_type = models.CharField(max_length=32, choices=TYPE_CHOICES, default=TYPE_SYSTEM)
    link_url = models.CharField(max_length=500, blank=True)
    data = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "communication_notifications"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Notification({self.id}) -> {self.recipient_id}"


class InAppMessage(TimestampedModel):
    CATEGORY_GENERAL = "general"
    CATEGORY_ALERT = "alert"
    CATEGORY_ANNOUNCEMENT = "announcement"

    CATEGORY_CHOICES = [
        (CATEGORY_GENERAL, "General"),
        (CATEGORY_ALERT, "Alert"),
        (CATEGORY_ANNOUNCEMENT, "Announcement"),
    ]

    school = models.ForeignKey(
        "tenancy.School",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="in_app_messages",
    )
    sender = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sent_in_app_messages",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="received_in_app_messages",
    )
    subject = models.CharField(max_length=255)
    body = models.TextField()
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, default=CATEGORY_GENERAL)
    metadata = models.JSONField(default=dict, blank=True)
    is_read = models.BooleanField(default=False)
    read_at = models.DateTimeField(null=True, blank=True)
    delivered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "communication_in_app_messages"
        ordering = ["-created_at"]

    def __str__(self):
        return f"InAppMessage({self.id}) {self.sender_id}->{self.recipient_id}"


class EmailMessageLog(TimestampedModel):
    STATUS_QUEUED = "queued"
    STATUS_SENT = "sent"
    STATUS_FAILED = "failed"
    STATUS_SKIPPED = "skipped"

    STATUS_CHOICES = [
        (STATUS_QUEUED, "Queued"),
        (STATUS_SENT, "Sent"),
        (STATUS_FAILED, "Failed"),
        (STATUS_SKIPPED, "Skipped"),
    ]

    school = models.ForeignKey(
        "tenancy.School",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_emails",
    )
    recipient = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_email_logs",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_communication_email_logs",
    )
    to_email = models.EmailField()
    subject = models.CharField(max_length=255)
    body = models.TextField()
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default=STATUS_QUEUED)
    error_message = models.TextField(blank=True)
    metadata = models.JSONField(default=dict, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "communication_email_message_logs"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Email({self.id}) {self.to_email}"


class NoticeBoard(TimestampedModel):
    notice_title = models.CharField(max_length=255)
    notice_message = models.TextField()
    notice_date = models.DateField()
    publish_on = models.DateField()
    inform_to = models.JSONField(default=list, blank=True)
    is_published = models.BooleanField(default=False)
    school = models.ForeignKey(
        "tenancy.School",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_notice_boards",
    )
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_notice_boards",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_communication_notice_boards",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_communication_notice_boards",
    )

    class Meta:
        db_table = "communication_notice_boards"
        ordering = ["-publish_on", "-notice_date", "-created_at"]

    def __str__(self):
        return self.notice_title


class EmailSmsLog(TimestampedModel):
    SEND_TO_GROUP = "G"
    SEND_TO_INDIVIDUAL = "I"
    SEND_TO_CLASS = "C"

    SEND_TO_CHOICES = [
        (SEND_TO_GROUP, "Group"),
        (SEND_TO_INDIVIDUAL, "Individual"),
        (SEND_TO_CLASS, "Class / Section"),
    ]

    SEND_THROUGH_EMAIL = "E"

    title = models.CharField(max_length=255)
    description = models.TextField()
    send_through = models.CharField(max_length=1, default=SEND_THROUGH_EMAIL)
    send_to = models.CharField(max_length=1, choices=SEND_TO_CHOICES, default=SEND_TO_GROUP)
    send_date = models.DateField()
    target_data = models.JSONField(default=dict, blank=True)
    school = models.ForeignKey(
        "tenancy.School",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_email_sms_logs",
    )
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_email_sms_logs",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_communication_email_sms_logs",
    )

    class Meta:
        db_table = "communication_email_sms_logs"
        ordering = ["-send_date", "-created_at"]

    def __str__(self):
        return self.title


class HolidayCalendar(TimestampedModel):
    holiday_title = models.CharField(max_length=255)
    holiday_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    school = models.ForeignKey(
        "tenancy.School",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_holiday_calendars",
    )
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="communication_holiday_calendars",
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="created_communication_holiday_calendars",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="updated_communication_holiday_calendars",
    )

    class Meta:
        db_table = "communication_holiday_calendars"
        ordering = ["holiday_date", "created_at"]

    def __str__(self):
        return self.holiday_title


class BroadcastMessage(TimestampedModel):
    """A message sent by an admin/teacher to a chosen audience.

    Delivery: an in-app CommunicationNotification is created for every
    resolved recipient (covers both the web notification bell and any
    mobile client hitting the same API — there's no separate mobile-only
    channel). If 'email' is in channels, a real email is sent via
    EmailMessageLog's existing send_mail path. If 'sms' is in channels, an
    EmailSmsLog row is recorded per recipient but NOT actually dispatched —
    no SMS provider is wired up for general broadcast (only apps.admissions
    has a Twilio adapter, scoped to admissions follow-ups). This is
    intentional: better to log honestly than fake a "sent" SMS.
    """

    AUDIENCE_ALL_PARENTS = "all_parents"
    AUDIENCE_CLASS_PARENTS = "class_parents"
    AUDIENCE_TEACHERS = "teachers"
    AUDIENCE_ALL_STAFF = "all_staff"

    AUDIENCE_CHOICES = [
        (AUDIENCE_ALL_PARENTS, "All Parents"),
        (AUDIENCE_CLASS_PARENTS, "Class Parents"),
        (AUDIENCE_TEACHERS, "Teachers"),
        (AUDIENCE_ALL_STAFF, "All Staff"),
    ]

    STATUS_SCHEDULED = "scheduled"
    STATUS_SENT = "sent"
    STATUS_FAILED = "failed"

    STATUS_CHOICES = [
        (STATUS_SCHEDULED, "Scheduled"),
        (STATUS_SENT, "Sent"),
        (STATUS_FAILED, "Failed"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="broadcast_messages")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, related_name="broadcast_messages"
    )
    template = models.CharField(max_length=32, blank=True)
    message = models.TextField()
    audience_type = models.CharField(max_length=20, choices=AUDIENCE_CHOICES)
    audience_class_ids = models.JSONField(default=list, blank=True)
    channels = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=12, choices=STATUS_CHOICES, default=STATUS_SCHEDULED)
    scheduled_at = models.DateTimeField(null=True, blank=True)
    sent_at = models.DateTimeField(null=True, blank=True)
    recipient_count = models.IntegerField(default=0)
    error = models.TextField(blank=True)

    class Meta:
        db_table = "communication_broadcast_messages"
        ordering = ["-created_at"]

    def __str__(self):
        return f"Broadcast({self.id}) {self.audience_type} · {self.status}"
