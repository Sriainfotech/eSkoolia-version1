from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("academics", "0006_classsubjectentry"),
    ]

    operations = [
        migrations.AlterField(
            model_name="classsubjectentry",
            name="code",
            field=models.CharField(blank=True, max_length=20),
        ),
    ]
