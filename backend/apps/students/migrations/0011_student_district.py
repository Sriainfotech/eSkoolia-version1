from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0010_studentcategory_unique_name"),
    ]

    operations = [
        migrations.AddField(
            model_name="student",
            name="district",
            field=models.CharField(blank=True, max_length=100),
        ),
    ]
