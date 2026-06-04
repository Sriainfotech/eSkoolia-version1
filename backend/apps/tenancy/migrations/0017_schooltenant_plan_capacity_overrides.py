from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0016_rename_sa_inv_pay_inv_paid_idx_super_admin_invoice_26f535_idx"),
    ]

    operations = [
        migrations.AddField(
            model_name="schooltenant",
            name="student_seat_limit",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="staff_seat_limit",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="storage_cap_gb",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="trial_days",
            field=models.PositiveSmallIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="go_live_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="trial_ends_at",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="schooltenant",
            name="billing_cycle",
            field=models.CharField(blank=True, max_length=16, null=True),
        ),
    ]
