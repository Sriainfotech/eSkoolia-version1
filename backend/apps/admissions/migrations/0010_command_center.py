"""
Migration 0010 – Admissions Command Center extension.

Adds:
  - PipelineStage model
  - AIMessageTemplate model
  - ContactLog model
  - ConsentLog model
  - BulkJob model
  - AuditLog model
  - Extends AdmissionInquiry with:
      pipeline_stage (FK, nullable)
      lead_score
      last_contacted_at
      documents_status
      calendar_event_id
All new columns are nullable/have defaults → zero-downtime deploy.
"""

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("admissions", "0009_alter_admissionfollowup_note"),
        ("tenancy", "__first__"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # ── PipelineStage ──────────────────────────────────────────────────────
        migrations.CreateModel(
            name="PipelineStage",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                (
                    "slug",
                    models.CharField(
                        blank=True,
                        choices=[
                            ("new_lead", "New Lead"),
                            ("first_contact", "First Contact"),
                            ("campus_visit", "Campus Visit"),
                            ("application_submitted", "Application Submitted"),
                            ("documents_pending", "Documents Pending"),
                            ("enrolled", "Enrolled"),
                            ("declined", "Declined"),
                        ],
                        max_length=60,
                    ),
                ),
                ("order", models.PositiveSmallIntegerField(default=0)),
                ("color", models.CharField(default="#6366f1", max_length=20)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="pipeline_stages",
                        to="tenancy.school",
                    ),
                ),
            ],
            options={"db_table": "admission_pipeline_stages", "ordering": ["order", "name"],
                     "unique_together": {("school", "name")}},
        ),

        # ── AIMessageTemplate ──────────────────────────────────────────────────
        migrations.CreateModel(
            name="AIMessageTemplate",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=255)),
                ("system_prompt", models.TextField()),
                ("user_prompt_template", models.TextField()),
                (
                    "channel",
                    models.CharField(
                        choices=[
                            ("call", "Call"), ("whatsapp", "WhatsApp"),
                            ("sms", "SMS"), ("email", "Email"), ("walk_in", "Walk-in"),
                        ],
                        default="whatsapp",
                        max_length=20,
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="ai_templates_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="ai_message_templates",
                        to="tenancy.school",
                    ),
                ),
            ],
            options={"db_table": "admission_ai_message_templates", "ordering": ["name"]},
        ),

        # ── Extend AdmissionInquiry ────────────────────────────────────────────
        migrations.AddField(
            model_name="admissioninquiry",
            name="pipeline_stage",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="inquiries",
                to="admissions.pipelinestage",
            ),
        ),
        migrations.AddField(
            model_name="admissioninquiry",
            name="lead_score",
            field=models.PositiveSmallIntegerField(default=0, help_text="Score 0-100 based on engagement signals"),
        ),
        migrations.AddField(
            model_name="admissioninquiry",
            name="last_contacted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="admissioninquiry",
            name="documents_status",
            field=models.CharField(
                choices=[
                    ("not_requested", "Not Requested"),
                    ("requested", "Requested"),
                    ("partial", "Partial"),
                    ("complete", "Complete"),
                ],
                default="not_requested",
                max_length=20,
            ),
        ),
        migrations.AddField(
            model_name="admissioninquiry",
            name="calendar_event_id",
            field=models.CharField(
                blank=True,
                help_text="External calendar event ID if synced",
                max_length=255,
            ),
        ),

        # ── ContactLog ─────────────────────────────────────────────────────────
        migrations.CreateModel(
            name="ContactLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "channel",
                    models.CharField(
                        choices=[
                            ("call", "Call"), ("whatsapp", "WhatsApp"),
                            ("sms", "SMS"), ("email", "Email"), ("walk_in", "Walk-in"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "direction",
                    models.CharField(
                        choices=[("outbound", "Outbound"), ("inbound", "Inbound")],
                        default="outbound",
                        max_length=10,
                    ),
                ),
                ("status", models.CharField(default="initiated", max_length=32)),
                ("provider_message_id", models.CharField(blank=True, max_length=255)),
                ("call_session_id", models.CharField(blank=True, max_length=255)),
                ("call_url", models.URLField(blank=True)),
                ("subject", models.CharField(blank=True, max_length=255)),
                ("body", models.TextField(blank=True)),
                ("template_id", models.IntegerField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "inquiry",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="contact_logs",
                        to="admissions.admissioninquiry",
                    ),
                ),
                (
                    "performed_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="admission_contact_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "admission_contact_logs", "ordering": ["-created_at"]},
        ),

        # ── ConsentLog ─────────────────────────────────────────────────────────
        migrations.CreateModel(
            name="ConsentLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "channel",
                    models.CharField(
                        choices=[
                            ("call", "Call"), ("whatsapp", "WhatsApp"),
                            ("sms", "SMS"), ("email", "Email"), ("walk_in", "Walk-in"),
                        ],
                        max_length=20,
                    ),
                ),
                (
                    "consent",
                    models.CharField(
                        choices=[("opt_in", "Opt In"), ("opt_out", "Opt Out")],
                        max_length=10,
                    ),
                ),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("user_agent", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "inquiry",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="consent_logs",
                        to="admissions.admissioninquiry",
                    ),
                ),
                (
                    "recorded_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="admission_consent_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={"db_table": "admission_consent_logs", "ordering": ["-created_at"]},
        ),

        # ── BulkJob ────────────────────────────────────────────────────────────
        migrations.CreateModel(
            name="BulkJob",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("send_whatsapp", "Send WhatsApp"), ("send_sms", "Send SMS"),
                            ("send_email", "Send Email"), ("assign", "Assign"),
                            ("update_status", "Update Status"), ("update_stage", "Update Stage"),
                        ],
                        max_length=30,
                    ),
                ),
                ("lead_ids", models.JSONField(default=list)),
                ("payload", models.JSONField(default=dict)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("pending", "Pending"), ("running", "Running"),
                            ("done", "Done"), ("failed", "Failed"),
                        ],
                        default="pending",
                        max_length=10,
                    ),
                ),
                ("total", models.PositiveIntegerField(default=0)),
                ("processed", models.PositiveIntegerField(default=0)),
                ("failed", models.PositiveIntegerField(default=0)),
                ("error_detail", models.JSONField(default=list)),
                ("celery_task_id", models.CharField(blank=True, max_length=255)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("finished_at", models.DateTimeField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "created_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="admission_bulk_jobs_created",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="admission_bulk_jobs",
                        to="tenancy.school",
                    ),
                ),
            ],
            options={"db_table": "admission_bulk_jobs", "ordering": ["-created_at"]},
        ),

        # ── AuditLog ───────────────────────────────────────────────────────────
        migrations.CreateModel(
            name="AuditLog",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(max_length=80)),
                ("object_type", models.CharField(blank=True, max_length=60)),
                ("object_id", models.CharField(blank=True, max_length=60)),
                ("changes", models.JSONField(default=dict)),
                ("ip_address", models.GenericIPAddressField(blank=True, null=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "actor",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="admission_audit_logs",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="admission_audit_logs",
                        to="tenancy.school",
                    ),
                ),
            ],
            options={
                "db_table": "admission_audit_logs",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(fields=["school", "action"], name="admn_audit_school_action_idx"),
                    models.Index(fields=["object_type", "object_id"], name="admn_audit_obj_idx"),
                ],
            },
        ),
    ]
