from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0017_academicyear_is_active_class_is_active"),
    ]

    operations = [
        migrations.AddField(
            model_name="classroom",
            name="floor",
            field=models.CharField(
                blank=True,
                default="",
                help_text="e.g. Ground, First, Block A",
                max_length=64,
            ),
        ),
        migrations.AddField(
            model_name="classroom",
            name="section",
            field=models.ForeignKey(
                blank=True,
                help_text="Optional default section assigned to this room",
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="class_rooms",
                to="core.section",
            ),
        ),
    ]
