from django.db import migrations, models
import django.db.models.deletion
import uuid


class Migration(migrations.Migration):
    dependencies = [
        ("tenancy", "0004_rename_tenancy_aud_tenant__idx_tenancy_aud_tenant__1a2506_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="schooltenant",
            name="board",
            field=models.CharField(blank=True, default="OTHER", max_length=32),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="state",
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="region",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="gstin",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="udise_code",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="pan",
            field=models.CharField(blank=True, max_length=32),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="seats",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="student_count",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="staff_count",
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="last_activity_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="SuperAdminInvoice",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("invoice_number", models.CharField(db_index=True, max_length=64, unique=True)),
                ("school_name", models.CharField(max_length=255)),
                ("invoice_date", models.DateField(db_index=True)),
                ("due_date", models.DateField(db_index=True)),
                (
                    "status",
                    models.CharField(
                        choices=[
                            ("draft", "Draft"),
                            ("sent", "Sent"),
                            ("paid", "Paid"),
                            ("overdue", "Overdue"),
                            ("cancelled", "Cancelled"),
                        ],
                        db_index=True,
                        default="draft",
                        max_length=16,
                    ),
                ),
                ("seller_name", models.CharField(max_length=255)),
                ("seller_gstin", models.CharField(blank=True, max_length=32)),
                ("seller_state", models.CharField(blank=True, max_length=64)),
                ("buyer_name", models.CharField(max_length=255)),
                ("buyer_gstin", models.CharField(blank=True, max_length=32)),
                ("buyer_state", models.CharField(blank=True, max_length=64)),
                ("line_items", models.JSONField(blank=True, default=list)),
                ("tax_breakdown", models.JSONField(blank=True, default=dict)),
                ("notes", models.TextField(blank=True)),
                ("terms_conditions", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "tenant",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="platform_invoices",
                        to="tenancy.schooltenant",
                    ),
                ),
            ],
            options={"db_table": "super_admin_invoices"},
        ),
        migrations.CreateModel(
            name="SuperAdminPolicy",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("key", models.CharField(db_index=True, max_length=128, unique=True)),
                (
                    "category",
                    models.CharField(
                        choices=[
                            ("security", "Security"),
                            ("data_isolation", "Data Isolation"),
                            ("billing", "Billing"),
                            ("system", "System"),
                        ],
                        db_index=True,
                        max_length=32,
                    ),
                ),
                ("description", models.TextField(blank=True)),
                ("value", models.JSONField(default=dict)),
                (
                    "value_type",
                    models.CharField(
                        choices=[("string", "String"), ("number", "Number"), ("boolean", "Boolean")],
                        default="string",
                        max_length=16,
                    ),
                ),
                ("is_toggle", models.BooleanField(default=False)),
                ("is_overridable", models.BooleanField(default=False)),
                ("default_value", models.JSONField(blank=True, default=dict)),
                ("version", models.PositiveIntegerField(default=1)),
                ("updated_by", models.CharField(blank=True, max_length=150)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
            options={"db_table": "super_admin_policies"},
        ),
        migrations.CreateModel(
            name="SuperAdminFeatureToggle",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("key", models.CharField(max_length=128)),
                ("enabled", models.BooleanField(default=True)),
                ("config", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("updated_by", models.CharField(blank=True, max_length=150)),
                (
                    "tenant",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="super_admin_feature_toggles",
                        to="tenancy.schooltenant",
                    ),
                ),
            ],
            options={
                "db_table": "super_admin_feature_toggles",
                "unique_together": {("tenant", "key")},
            },
        ),
        migrations.AddIndex(
            model_name="superadmininvoice",
            index=models.Index(fields=["status", "invoice_date"], name="super_admin_status_f4f82c_idx"),
        ),
        migrations.AddIndex(
            model_name="superadmininvoice",
            index=models.Index(fields=["invoice_date", "due_date"], name="super_admin_invoice_8b4047_idx"),
        ),
        migrations.AddIndex(
            model_name="superadminfeaturetoggle",
            index=models.Index(fields=["tenant", "key"], name="super_admin_tenant__a86e50_idx"),
        ),
    ]
