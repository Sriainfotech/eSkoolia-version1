from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0016_department_head_deputy_head"),
    ]

    operations = [
        migrations.AddField(
            model_name="designation",
            name="short_code",
            field=models.CharField(blank=True, default="", max_length=10),
        ),
        migrations.AddField(
            model_name="designation",
            name="role_template",
            field=models.CharField(blank=True, default="Teacher", max_length=50),
        ),
        migrations.AddField(
            model_name="designation",
            name="employment_type",
            field=models.CharField(blank=True, default="Full-time", max_length=30),
        ),
        migrations.AddField(
            model_name="designation",
            name="reports_to",
            field=models.CharField(blank=True, default="None", max_length=50),
        ),
        migrations.AddField(
            model_name="designation",
            name="grade_level",
            field=models.CharField(blank=True, default="", max_length=50),
        ),
        migrations.AddField(
            model_name="designation",
            name="sort_order",
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.AlterModelOptions(
            name="designation",
            options={"ordering": ["department_id", "sort_order", "name"]},
        ),
    ]
