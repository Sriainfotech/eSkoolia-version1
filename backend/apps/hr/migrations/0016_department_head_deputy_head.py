from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0015_department_type_model"),
    ]

    operations = [
        migrations.AddField(
            model_name="department",
            name="head",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="headed_departments",
                to="hr.staff",
            ),
        ),
        migrations.AddField(
            model_name="department",
            name="deputy_head",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name="deputy_headed_departments",
                to="hr.staff",
            ),
        ),
    ]
