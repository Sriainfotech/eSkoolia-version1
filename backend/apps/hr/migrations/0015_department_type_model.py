from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0014_department_dept_type"),
        ("tenancy", "__first__"),
    ]

    operations = [
        migrations.CreateModel(
            name="DepartmentType",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=50)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "school",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="department_types",
                        to="tenancy.school",
                    ),
                ),
            ],
            options={
                "db_table": "hr_department_types",
                "ordering": ["name"],
            },
        ),
        migrations.AddConstraint(
            model_name="departmenttype",
            constraint=models.UniqueConstraint(
                fields=["school", "name"],
                name="uq_hr_dept_type_school_name",
            ),
        ),
    ]
