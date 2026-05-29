from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0018_alter_staff_first_name_alter_staff_last_name"),
    ]

    operations = [
        migrations.AlterField(
            model_name="staff",
            name="bank_account_name",
            field=models.CharField(blank=True, max_length=50),
        ),
    ]
