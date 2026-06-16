# Generated migration to update ComplaintEntry with ForeignKey fields

import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("admissions", "0013_complaint_master_data"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="complaintentry",
            name="action_taken",
            field=models.CharField(blank=True, max_length=500),
        ),
        migrations.AddField(
            model_name="complaintentry",
            name="complaint_type",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="complaints", to="admissions.complainttype"),
        ),
        migrations.AddField(
            model_name="complaintentry",
            name="complaint_source",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="complaints", to="admissions.complaintsource"),
        ),
        migrations.AddField(
            model_name="complaintentry",
            name="assigned_to",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assigned_complaints", to=settings.AUTH_USER_MODEL),
        ),
        migrations.RemoveField(
            model_name="complaintentry",
            name="assigned",
        ),
    ]
