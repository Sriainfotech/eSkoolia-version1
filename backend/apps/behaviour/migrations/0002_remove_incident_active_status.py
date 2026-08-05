# Generated migration

from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('behaviour', '0001_initial'),
    ]

    operations = [
        migrations.RemoveField(
            model_name='incident',
            name='active_status',
        ),
    ]
