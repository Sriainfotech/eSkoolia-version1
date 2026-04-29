from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0006_rename_attendance_s_student_idx_student_att_student_10af52_idx_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="studentattendance",
            name="lunch",
            field=models.BooleanField(default=False, help_text="Student had lunch"),
        ),
    ]
