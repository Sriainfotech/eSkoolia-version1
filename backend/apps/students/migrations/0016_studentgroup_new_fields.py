from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0015_remove_studentdocument_file_url_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="studentgroup",
            name="type",
            field=models.CharField(
                choices=[("HOUSE", "House"), ("CLUB", "Club"), ("CUSTOM", "Custom")],
                default="CUSTOM",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="studentgroup",
            name="emoji",
            field=models.CharField(default="📚", max_length=10),
        ),
        migrations.AddField(
            model_name="studentgroup",
            name="color",
            field=models.CharField(default="#00b894", max_length=20),
        ),
        migrations.AddField(
            model_name="studentgroup",
            name="bg_color",
            field=models.CharField(default="#e6f9f5", max_length=20),
        ),
        migrations.AddField(
            model_name="studentgroup",
            name="capacity",
            field=models.PositiveIntegerField(default=40),
        ),
        migrations.AddField(
            model_name="studentgroup",
            name="updated_at",
            field=models.DateTimeField(auto_now=True),
        ),
    ]
