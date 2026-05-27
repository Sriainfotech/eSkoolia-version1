# Generated 2026-05-27 — LLM integration Task 6: link Student to User account

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0020_merge_20260504_1756"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="user",
            field=models.OneToOneField(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="student_profile",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
