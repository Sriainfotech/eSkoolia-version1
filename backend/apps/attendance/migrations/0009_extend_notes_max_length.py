from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Extend notes field to 1000 chars to support multiple notes stored as
    pipe-delimited string (note1|||note2|||note3).
    """

    dependencies = [
        ("attendance", "0008_add_attendance_time_fields"),
    ]

    operations = [
        migrations.AlterField(
            model_name="studentattendance",
            name="notes",
            field=models.TextField(blank=True, default="", max_length=1000),
        ),
    ]
