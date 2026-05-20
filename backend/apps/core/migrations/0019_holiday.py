from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0001_initial"),
        ("core", "0018_classroom_floor_section"),
    ]

    operations = [
        migrations.CreateModel(
            name="Holiday",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("name", models.CharField(max_length=120)),
                ("date", models.DateField()),
                ("end_date", models.DateField(blank=True, null=True, help_text="Optional - for multi-day holidays")),
                ("holiday_type", models.CharField(
                    choices=[
                        ("public", "Public Holiday"),
                        ("religious", "Religious"),
                        ("national", "National"),
                        ("school", "School Event"),
                        ("other", "Other"),
                    ],
                    default="public",
                    max_length=20,
                )),
                ("description", models.CharField(blank=True, default="", max_length=255)),
                ("active_status", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("school", models.ForeignKey(
                    on_delete=models.deletion.CASCADE,
                    related_name="holidays",
                    to="tenancy.school",
                )),
            ],
            options={
                "db_table": "holidays",
                "ordering": ["-date", "name"],
            },
        ),
        migrations.AddConstraint(
            model_name="holiday",
            constraint=models.UniqueConstraint(
                fields=("school", "date", "name"),
                name="uq_holiday_school_date_name",
            ),
        ),
    ]
