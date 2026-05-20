import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0005_alter_classroutineslot_subject_nullable"),
        ("core", "0001_initial"),
        ("tenancy", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="ClassSubjectEntry",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=200)),
                ("code", models.CharField(max_length=20)),
                (
                    "subject_type",
                    models.CharField(
                        choices=[
                            ("core", "Core"),
                            ("co_curricular", "Co-curricular"),
                            ("optional", "Optional"),
                        ],
                        default="core",
                        max_length=20,
                    ),
                ),
                ("periods_per_week", models.PositiveSmallIntegerField(default=5)),
                ("active_status", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="class_subject_entries",
                        to="tenancy.school",
                    ),
                ),
                (
                    "school_class",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="subject_entries",
                        to="core.class",
                    ),
                ),
            ],
            options={
                "db_table": "class_subject_entries",
                "ordering": ["school_class_id", "name"],
            },
        ),
        migrations.AddConstraint(
            model_name="classsubjectentry",
            constraint=models.UniqueConstraint(
                fields=["school", "school_class", "code"],
                name="uq_class_subject_entry",
            ),
        ),
    ]
