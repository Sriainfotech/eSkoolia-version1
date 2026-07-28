from django.conf import settings
from django.db import models


class Note(models.Model):
    """A personal sticky note left by a staff member on a specific in-app page.

    Scoped by both ``school`` (tenancy policy — see CLAUDE.md) and ``user``:
    notes are private to the author, not shared across the school's staff.
    """

    COLOR_CHOICES = [
        ('yellow', 'Yellow'),
        ('pink', 'Pink'),
        ('green', 'Green'),
        ('blue', 'Blue'),
        ('purple', 'Purple'),
    ]

    school = models.ForeignKey('tenancy.School', on_delete=models.CASCADE, related_name='notes')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='notes')
    route = models.CharField(max_length=255, db_index=True)
    color = models.CharField(max_length=10, choices=COLOR_CHOICES, default='yellow')
    text = models.TextField(blank=True, default='')
    position_x = models.IntegerField(default=80)
    position_y = models.IntegerField(default=120)
    width = models.IntegerField(default=240)
    height = models.IntegerField(default=160)
    pinned = models.BooleanField(default=False)
    archived = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'notes'
        ordering = ['-updated_at']
        indexes = [
            models.Index(fields=['school', 'user', 'route']),
            models.Index(fields=['school', 'user', 'pinned']),
        ]

    def __str__(self):
        return f'Note {self.id} ({self.route})'
