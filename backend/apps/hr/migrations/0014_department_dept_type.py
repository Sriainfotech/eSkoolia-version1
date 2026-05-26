from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0013_alter_staff_staff_photo_imagefield"),
    ]

    operations = [
        migrations.AddField(
            model_name="department",
            name="dept_type",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
    ]
