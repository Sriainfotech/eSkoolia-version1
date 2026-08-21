from django.conf import settings
from django.db import models


class FAQEntry(models.Model):
    """A parent-facing FAQ answer, matched by keyword against a bot query.

    ``school`` is nullable: null rows are global defaults shipped with the
    product; a row with ``school`` set overrides the global default for
    that topic_key at that school. This mirrors the existing
    TenantFeature/TenantFeatureFlag default+override pattern in
    apps.tenancy.feature_flags — look there before changing this shape.

    Replaces the previously hardcoded PARENT_FAQ (components/AIBot.tsx) and
    QA_TOPICS (lib/aiBotIntent.ts) dicts on the frontend, which had drifted
    into two disconnected taxonomies.
    """

    school = models.ForeignKey(
        'tenancy.School', on_delete=models.CASCADE, related_name='faq_entries',
        null=True, blank=True,
    )
    topic_key = models.SlugField(max_length=60)
    keywords = models.JSONField(default=list, blank=True, help_text="Phrases/regex-free substrings that trigger this topic.")
    answer = models.TextField()
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assistant_faq_entries'
        ordering = ['topic_key']
        constraints = [
            models.UniqueConstraint(fields=['school', 'topic_key'], name='uq_faq_entry_school_topic'),
        ]
        indexes = [
            models.Index(fields=['school', 'is_active']),
        ]

    def __str__(self):
        scope = self.school.name if self.school_id else 'global default'
        return f'{self.topic_key} ({scope})'


class MessageTemplate(models.Model):
    """A parameterized draft-message template, keyed by topic.

    Same nullable-school default+override shape as FAQEntry. Replaces the
    hardcoded template strings in AIBot.tsx's compose-message handling.
    """

    TOPIC_CHOICES = [
        ('fee', 'Fee reminder'),
        ('attendance', 'Attendance concern'),
        ('exam', 'Exam/result notice'),
        ('meeting', 'Parent-teacher meeting'),
        ('generic', 'Generic notice'),
    ]

    school = models.ForeignKey(
        'tenancy.School', on_delete=models.CASCADE, related_name='message_templates',
        null=True, blank=True,
    )
    topic_key = models.CharField(max_length=20, choices=TOPIC_CHOICES)
    body = models.TextField(help_text="Use {topic}, {date}, {time}, {venue}, {rsvp_date} as placeholders.")
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'assistant_message_templates'
        ordering = ['topic_key']
        constraints = [
            models.UniqueConstraint(fields=['school', 'topic_key'], name='uq_msg_template_school_topic'),
        ]
        indexes = [
            models.Index(fields=['school', 'is_active']),
        ]

    def __str__(self):
        scope = self.school.name if self.school_id else 'global default'
        return f'{self.topic_key} ({scope})'


class BotQueryLog(models.Model):
    """Telemetry for one "Ask eSkoolia" query, for recognition-rate tracking.

    resolver_type is recorded so a future LLM resolver can be compared
    directly against the manifest-fuzzy resolver's recognition rate.
    """

    school = models.ForeignKey('tenancy.School', on_delete=models.CASCADE, related_name='bot_query_logs')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='bot_query_logs')
    query = models.TextField()
    resolver_type = models.CharField(max_length=40)
    resolved_intent_id = models.CharField(max_length=100, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assistant_bot_query_logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['school', 'created_at']),
            models.Index(fields=['resolver_type']),
        ]

    def __str__(self):
        return f'[{self.resolver_type}] {self.query[:40]}'


class PersonalCalendarEvent(models.Model):
    """A staff member's personal week-planner event.

    Scoped by school + user (private to the author, same policy as
    apps.todos.TodoItem). Backs both the "Ask eSkoolia" planner-task intent
    and components/widgets/cockpit/WeekAhead.tsx's own planner UI, which
    previously wrote/read this data as ``eskoolia_week_events_v2_*``
    localStorage only.

    NOTE: this is NOT the same thing as WeekAhead.tsx's separate
    /api/calendar/week-ahead/ call — that one is a still-unbuilt, read-only
    school-wide academic calendar feed (exam dates, submission deadlines),
    a different feature. Don't merge the two.
    """

    school = models.ForeignKey('tenancy.School', on_delete=models.CASCADE, related_name='calendar_events')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_events')
    week_start_date = models.DateField(help_text="Monday of the target week.")
    day_index = models.PositiveSmallIntegerField(help_text="0=Monday .. 6=Sunday")
    time = models.CharField(max_length=5, help_text="HH:MM, 24-hour.")
    title = models.CharField(max_length=255)
    category = models.CharField(max_length=30, default='meeting')
    note = models.TextField(blank=True, default='')
    done = models.BooleanField(default=False)
    ai_generated = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'assistant_personal_calendar_events'
        ordering = ['week_start_date', 'day_index', 'time']
        indexes = [
            models.Index(fields=['school', 'user', 'week_start_date']),
        ]

    def __str__(self):
        return f'{self.title} ({self.week_start_date} day {self.day_index} {self.time})'
