from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0011_command_center_field_fixes"),
    ]

    operations = [
        migrations.AddField(
            model_name="admissioninquiry",
            name="child_name",
            field=models.CharField(
                blank=True,
                max_length=255,
                help_text="Name of the child seeking admission",
            ),
        ),
        migrations.AddField(
            model_name="admissioninquiry",
            name="has_sibling_enrolled",
            field=models.CharField(
                blank=True,
                max_length=3,
                choices=[("yes", "Yes"), ("no", "No")],
                help_text="Does the family already have a sibling enrolled in this school?",
            ),
        ),
        migrations.AddField(
            model_name="admissioninquiry",
            name="sibling_name",
            field=models.CharField(
                blank=True,
                max_length=255,
                help_text="Name of the enrolled sibling (if any)",
            ),
        ),
    ]
