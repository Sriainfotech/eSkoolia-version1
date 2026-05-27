from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenancy', '0011_invoice_reverse_charge_plan_sac_code'),
    ]

    operations = [
        migrations.AddField(
            model_name='schooltenant',
            name='principal_name',
            field=models.CharField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name='schooltenant',
            name='principal_email',
            field=models.EmailField(blank=True, max_length=128),
        ),
        migrations.AddField(
            model_name='schooltenant',
            name='principal_phone',
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name='schooltenant',
            name='campus_address',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='schooltenant',
            name='city',
            field=models.CharField(blank=True, max_length=64),
        ),
        migrations.AddField(
            model_name='schooltenant',
            name='pin_code',
            field=models.CharField(blank=True, max_length=6),
        ),
        migrations.AddField(
            model_name='schooltenant',
            name='affiliation_number',
            field=models.CharField(blank=True, max_length=64),
        ),
    ]
