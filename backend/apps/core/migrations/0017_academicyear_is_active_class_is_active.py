from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0016_normalize_class_names"),
    ]

    operations = [
        migrations.AddField(
            model_name="academicyear",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="class",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
    ]
