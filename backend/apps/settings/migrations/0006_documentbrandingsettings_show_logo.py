from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("settings", "0005_documentbrandingsettings_advanced"),
    ]

    operations = [
        migrations.AddField(
            model_name="documentbrandingsettings",
            name="show_logo",
            field=models.BooleanField(
                default=True,
                help_text="Include the school logo in generated headers.",
            ),
        ),
    ]
