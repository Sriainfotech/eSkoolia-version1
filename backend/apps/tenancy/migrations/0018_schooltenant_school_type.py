from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenancy', '0017_schooltenant_plan_capacity_overrides'),
    ]

    operations = [
        migrations.AddField(
            model_name='schooltenant',
            name='school_type',
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
