from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("hr", "0007_staff_other_document_json"),
    ]

    operations = [
        migrations.AddField(
            model_name="payrollrecord",
            name="allowance_items",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="payrollrecord",
            name="deduction_items",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
