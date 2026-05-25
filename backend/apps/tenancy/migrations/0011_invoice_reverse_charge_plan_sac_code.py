from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('tenancy', '0010_domain_tenant'),
    ]

    operations = [
        migrations.AddField(
            model_name='superadmininvoice',
            name='reverse_charge',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='subscriptionplan',
            name='sac_code',
            field=models.CharField(blank=True, default='998313', max_length=16),
        ),
    ]
