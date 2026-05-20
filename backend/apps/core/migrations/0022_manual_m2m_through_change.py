import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0021_stream_class_streams_stream_uq_stream_school_name"),
    ]

    operations = [
        # 1. Remove the old M2M field
        migrations.RemoveField(
            model_name="class",
            name="streams",
        ),
        # 2. Create the through model
        migrations.CreateModel(
            name="ClassStream",
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
                ("capacity", models.PositiveSmallIntegerField(default=40)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "school_class",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="class_streams",
                        to="core.class",
                    ),
                ),
                (
                    "stream",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="class_links",
                        to="core.stream",
                    ),
                ),
            ],
            options={
                "db_table": "class_streams",
                "ordering": ["stream__name"],
            },
        ),
        # 3. Add the field back with the 'through' parameter
        migrations.AddField(
            model_name="class",
            name="streams",
            field=models.ManyToManyField(
                blank=True,
                help_text="Applicable to Senior Secondary (Grade 11-12).",
                related_name="classes",
                through="core.ClassStream",
                to="core.stream",
            ),
        ),
        # 4. Add the constraint
        migrations.AddConstraint(
            model_name="classstream",
            constraint=models.UniqueConstraint(
                fields=("school_class", "stream"), name="uq_class_stream"
            ),
        ),
    ]
