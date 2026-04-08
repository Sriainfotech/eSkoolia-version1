from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0009_payrollsettings"),
        ("tenancy", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="StaffDocument",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("document_type", models.CharField(choices=[("resume", "Resume"), ("joining_letter", "Joining Letter"), ("tenth_certificate", "Tenth Certificate"), ("eleventh_certificate", "Eleventh Certificate"), ("aadhar_card", "Aadhar Card"), ("driving_license", "Driving License"), ("other", "Other")], max_length=32)),
                ("file_path", models.CharField(max_length=500)),
                ("file_name", models.CharField(max_length=255)),
                ("file_size", models.PositiveBigIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="staff_documents", to="tenancy.school")),
                ("staff", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="documents", to="hr.staff")),
            ],
            options={
                "db_table": "hr_staff_documents",
                "ordering": ["-created_at"],
            },
        ),
        migrations.AddConstraint(
            model_name="staffdocument",
            constraint=models.UniqueConstraint(fields=("school", "staff", "document_type", "file_name"), name="uq_hr_staff_document_scope"),
        ),
    ]