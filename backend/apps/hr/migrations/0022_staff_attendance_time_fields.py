from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0021_staff_onboard_draft"),
    ]

    operations = [
        migrations.AddField(
            model_name="staffattendance",
            name="arrival_time",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="staffattendance",
            name="sign_in_time",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="staffattendance",
            name="sign_out_time",
            field=models.TimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="staffattendance",
            name="lunch",
            field=models.BooleanField(default=False),
        ),
    ]
