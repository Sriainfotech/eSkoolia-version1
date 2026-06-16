# Generated migration for ComplaintType and ComplaintSource models

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0012_admissioninquiry_child_sibling_fields"),
        ("tenancy", "0001_initial"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name="ComplaintType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="complaint_types", to="tenancy.school")),
            ],
            options={
                "db_table": "complaint_types",
                "ordering": ["name"],
            },
        ),
        migrations.CreateModel(
            name="ComplaintSource",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("description", models.TextField(blank=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="complaint_sources", to="tenancy.school")),
            ],
            options={
                "db_table": "complaint_sources",
                "ordering": ["name"],
            },
        ),
        migrations.AlterUniqueTogether(
            name="complainttype",
            unique_together={("school", "name")},
        ),
        migrations.AlterUniqueTogether(
            name="complaintsource",
            unique_together={("school", "name")},
        ),
    ]
