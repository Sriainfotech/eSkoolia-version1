import uuid
import django.db.models.deletion
from django.db import migrations, models


def populate_student_uuid(apps, schema_editor):
    Student = apps.get_model("students", "Student")
    db_alias = schema_editor.connection.alias

    for row in Student.objects.using(db_alias).all().only("id", "student_id"):
        if not row.student_id:
            row.student_id = uuid.uuid4()
            row.save(update_fields=["student_id"])


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0006_studentcategory_code_status"),
        ("core", "0004_transport_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="student_id",
            field=models.UUIDField(null=True, editable=False, db_index=True),
        ),
        migrations.RunPython(populate_student_uuid, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="student",
            name="student_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True, db_index=True),
        ),
        migrations.AddField(
            model_name="student",
            name="academic_year",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="students", to="core.academicyear"),
        ),
        migrations.AddField(
            model_name="student",
            name="custom_gender",
            field=models.CharField(blank=True, max_length=60),
        ),
        migrations.AddField(
            model_name="student",
            name="phone",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="student",
            name="email",
            field=models.EmailField(blank=True, max_length=254),
        ),
        migrations.AddField(
            model_name="student",
            name="address_line",
            field=models.CharField(blank=True, max_length=255),
        ),
        migrations.AddField(
            model_name="student",
            name="city",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="student",
            name="state",
            field=models.CharField(blank=True, max_length=100),
        ),
        migrations.AddField(
            model_name="student",
            name="pincode",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="student",
            name="photo",
            field=models.URLField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="student",
            name="status",
            field=models.CharField(
                choices=[("active", "Active"), ("inactive", "Inactive"), ("transferred", "Transferred"), ("dropped", "Dropped")],
                default="active",
                max_length=20,
            ),
        ),
        migrations.AddIndex(
            model_name="student",
            index=models.Index(fields=["admission_no"], name="idx_students_admission_no"),
        ),
        migrations.AddIndex(
            model_name="student",
            index=models.Index(fields=["first_name", "last_name"], name="idx_students_name"),
        ),
        migrations.AddIndex(
            model_name="student",
            index=models.Index(fields=["current_class"], name="idx_students_class"),
        ),
        migrations.AddIndex(
            model_name="student",
            index=models.Index(fields=["current_section"], name="idx_students_section"),
        ),
    ]
