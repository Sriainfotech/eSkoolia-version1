# Generated 2026-05-27 — LLM integration: add llm_enabled fields to School

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0013_schooltenant_nullable_contact_fields"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AddField(
            model_name="school",
            name="llm_enabled",
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name="school",
            name="llm_enabled_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="school",
            name="llm_enabled_by",
            field=models.ForeignKey(
                blank=True,
                help_text="Super admin who enabled LLM for this school",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="schools_llm_enabled",
                to=settings.AUTH_USER_MODEL,
            ),
        ),
    ]
