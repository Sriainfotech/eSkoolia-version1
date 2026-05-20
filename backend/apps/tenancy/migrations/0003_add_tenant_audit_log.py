"""Migration to add TenantAuditLog model for audit logging."""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0002_add_tenant_models"),
    ]

    operations = [
        migrations.CreateModel(
            name="TenantAuditLog",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "tenant_id",
                    models.CharField(
                        blank=True,
                        db_index=True,
                        max_length=32,
                        null=True,
                    ),
                ),
                (
                    "schema_name",
                    models.CharField(
                        blank=True,
                        db_index=True,
                        max_length=64,
                        null=True,
                    ),
                ),
                (
                    "action",
                    models.CharField(
                        choices=[
                            ("provision_start", "Provisioning Started"),
                            ("schema_created", "Schema Created"),
                            ("schema_failed", "Schema Creation Failed"),
                            ("migrations_ran", "Migrations Executed"),
                            ("migrations_failed", "Migrations Failed"),
                            ("seeding_start", "Seeding Started"),
                            ("seeding_completed", "Seeding Completed"),
                            ("seeding_failed", "Seeding Failed"),
                            ("provision_complete", "Provisioning Completed"),
                            ("provision_failed", "Provisioning Failed"),
                            ("domain_created", "Domain Created"),
                            ("tenant_activated", "Tenant Activated"),
                            ("tenant_deactivated", "Tenant Deactivated"),
                            ("tenant_deleted", "Tenant Deleted"),
                        ],
                        db_index=True,
                        max_length=32,
                    ),
                ),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("success", "Success"),
                            ("partial", "Partial"),
                            ("failed", "Failed"),
                            ("pending", "Pending"),
                        ],
                        default="pending",
                        max_length=16,
                    ),
                ),
                (
                    "actor_user_id",
                    models.IntegerField(blank=True, null=True),
                ),
                (
                    "actor_username",
                    models.CharField(
                        blank=True,
                        max_length=256,
                        null=True,
                    ),
                ),
                (
                    "actor_ip",
                    models.GenericIPAddressField(
                        blank=True,
                        null=True,
                    ),
                ),
                (
                    "details",
                    models.JSONField(blank=True, default=dict),
                ),
                (
                    "error_message",
                    models.TextField(blank=True, null=True),
                ),
                (
                    "duration_ms",
                    models.IntegerField(
                        blank=True,
                        help_text="Duration in milliseconds",
                        null=True,
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True, db_index=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
            ],
            options={
                "db_table": "tenancy_audit_log",
            },
        ),
        migrations.AddIndex(
            model_name="tenantauditlog",
            index=models.Index(
                fields=["tenant_id", "created_at"],
                name="tenancy_aud_tenant__idx",
            ),
        ),
        migrations.AddIndex(
            model_name="tenantauditlog",
            index=models.Index(
                fields=["schema_name", "created_at"],
                name="tenancy_aud_schema__idx",
            ),
        ),
        migrations.AddIndex(
            model_name="tenantauditlog",
            index=models.Index(
                fields=["action", "created_at"],
                name="tenancy_aud_action_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="tenantauditlog",
            index=models.Index(
                fields=["status", "created_at"],
                name="tenancy_aud_status_idx",
            ),
        ),
    ]
