import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0004_transport_models"),
        ("students", "0007_student_add_module_upgrade"),
        ("users", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="StudentSubjectAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("is_optional", models.BooleanField(default=False)),
                ("assigned_at", models.DateTimeField(auto_now_add=True)),
                (
                    "academic_year",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_subject_assignments", to="core.academicyear"),
                ),
                (
                    "assigned_by",
                    models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="student_subject_assignments_done", to="users.user"),
                ),
                (
                    "school_class",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_subject_assignments", to="core.class"),
                ),
                (
                    "section",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_subject_assignments", to="core.section"),
                ),
                (
                    "student",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="subject_assignments", to="students.student"),
                ),
                (
                    "subject",
                    models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_assignments", to="core.subject"),
                ),
            ],
            options={
                "db_table": "student_subject_assignments",
                "ordering": ["-assigned_at", "id"],
            },
        ),
        migrations.AddConstraint(
            model_name="studentsubjectassignment",
            constraint=models.UniqueConstraint(fields=("student", "subject", "academic_year"), name="uq_student_subject_academic_year"),
        ),
        migrations.AddIndex(
            model_name="studentsubjectassignment",
            index=models.Index(fields=["student", "academic_year"], name="idx_ssa_student_year"),
        ),
        migrations.AddIndex(
            model_name="studentsubjectassignment",
            index=models.Index(fields=["school_class", "section", "academic_year"], name="idx_ssa_class_section_year"),
        ),
        migrations.AddIndex(
            model_name="studentsubjectassignment",
            index=models.Index(fields=["subject", "academic_year"], name="idx_ssa_subject_year"),
        ),
    ]
