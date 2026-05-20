from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0019_holiday"),
    ]

    operations = [
        migrations.AddField(
            model_name="holiday",
            name="academic_year",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=models.deletion.SET_NULL,
                related_name="holidays",
                to="core.academicyear",
            ),
        ),
    ]
