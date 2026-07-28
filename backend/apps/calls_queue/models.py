from django.conf import settings
from django.db import models


class CallQueueEntry(models.Model):
    """A personal call-back reminder left by a staff member on the home dashboard.

    Scoped by both ``school`` (tenancy policy — see CLAUDE.md) and ``user``:
    entries are private to the author, not shared across the school's staff.
    """

    URGENCY_CHOICES = [
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('emergency', 'Emergency'),
    ]

    school = models.ForeignKey('tenancy.School', on_delete=models.CASCADE, related_name='call_queue_entries')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='call_queue_entries')
    name = models.CharField(max_length=255)
    role = models.CharField(max_length=64, blank=True, default='')
    reason = models.TextField(blank=True, default='')
    phone = models.CharField(max_length=32, blank=True, default='')
    urgency = models.CharField(max_length=10, choices=URGENCY_CHOICES, default='normal')
    source_link = models.CharField(max_length=255, blank=True, default='')
    is_emergency = models.BooleanField(default=False)
    notes = models.TextField(blank=True, default='')
    done = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'call_queue_entries'
        ordering = ['done', '-is_emergency', '-created_at']
        indexes = [
            models.Index(fields=['school', 'user', 'done']),
        ]

    def __str__(self):
        return f'CallQueueEntry {self.id} ({self.name})'
