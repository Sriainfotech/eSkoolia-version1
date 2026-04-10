import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0008_studentsubjectassignment"),
        ("tenancy", "0001_initial"),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="deleted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="student",
            name="deleted_by",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="students_deleted", to="users.user"),
        ),
        migrations.AddField(
            model_name="student",
            name="is_deleted",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AlterField(
            model_name="student",
            name="status",
            field=models.CharField(
                choices=[("active", "Active"), ("inactive", "Inactive"), ("transferred", "Transferred"), ("dropped", "Dropped"), ("deleted", "Deleted")],
                default="active",
                max_length=20,
            ),
        ),
        migrations.CreateModel(
            name="StudentRecordAudit",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("action", models.CharField(choices=[("soft_delete", "Soft Delete"), ("restore", "Restore"), ("permanent_delete", "Permanent Delete")], max_length=20)),
                ("note", models.TextField(blank=True)),
                ("metadata", models.JSONField(blank=True, default=dict)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("performed_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="student_record_audits_done", to="users.user")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_record_audits", to="tenancy.school")),
                ("student", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="delete_audits", to="students.student")),
            ],
            options={
                "db_table": "student_record_audits",
                "ordering": ["-created_at", "id"],
            },
        ),
    ]
