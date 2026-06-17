# Generated migration to properly fix ComplaintEntry FK fields

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0014_update_complaint_entry_fkeys"),
    ]

    operations = [
        # First, remove the old CharField fields that were created in 0004
        migrations.RemoveField(
            model_name="complaintentry",
            name="complaint_type",
        ),
        migrations.RemoveField(
            model_name="complaintentry",
            name="complaint_source",
        ),
        
        # Now add them back as ForeignKey fields
        migrations.AddField(
            model_name="complaintentry",
            name="complaint_type",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="complaints",
                to="admissions.complainttype"
            ),
        ),
        migrations.AddField(
            model_name="complaintentry",
            name="complaint_source",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.PROTECT,
                related_name="complaints",
                to="admissions.complaintsource"
            ),
        ),
    ]
