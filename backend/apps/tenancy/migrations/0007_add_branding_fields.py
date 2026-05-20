from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0006_sync_phase10_phase11_models"),
    ]

    operations = [
        migrations.AddField(
            model_name="schooltenant",
            name="brand_color",
            field=models.CharField(blank=True, max_length=32, default=""),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="logo_url",
            field=models.CharField(blank=True, max_length=512, default=""),
            preserve_default=False,
        ),
    ]
