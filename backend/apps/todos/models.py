from django.conf import settings
from django.db import models


class TodoItem(models.Model):
    """A personal to-do left by a staff member on the home dashboard.

    Scoped by both ``school`` (tenancy policy — see CLAUDE.md) and ``user``:
    todos are private to the author, not shared across the school's staff.
    """

    CATEGORY_CHOICES = [
        ('academic', 'Academic'),
        ('ops', 'Ops'),
        ('comms', 'Comms'),
        ('personal', 'Personal'),
    ]

    school = models.ForeignKey('tenancy.School', on_delete=models.CASCADE, related_name='todos')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='todos')
    text = models.TextField(blank=True, default='')
    category = models.CharField(max_length=10, choices=CATEGORY_CHOICES, default='personal')
    priority = models.CharField(max_length=10, default='normal')
    due_at = models.DateTimeField(null=True, blank=True)
    ai_generated = models.BooleanField(default=False)
    ai_reason = models.TextField(blank=True, default='')
    completed = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'user_todos'
        ordering = ['completed', '-created_at']
        indexes = [
            models.Index(fields=['school', 'user', 'category']),
            models.Index(fields=['school', 'user', 'completed']),
        ]

    def __str__(self):
        return f'Todo {self.id} ({self.category})'
