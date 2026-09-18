from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("attendance", "0007_add_lunch_to_studentattendance"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunSQL(
                    sql=(
                        "ALTER TABLE student_attendances ADD COLUMN arrival_time time NULL;"
                        "ALTER TABLE student_attendances ADD COLUMN sign_in_time time NULL;"
                        "ALTER TABLE student_attendances ADD COLUMN sign_out_time time NULL;"
                        "ALTER TABLE student_attendances ADD COLUMN pickup_time time NULL;"
                        "ALTER TABLE student_attendances ADD COLUMN pickup_by varchar(120) NOT NULL DEFAULT '';"
                    ),
                    reverse_sql=(
                        "ALTER TABLE student_attendances DROP COLUMN arrival_time;"
                        "ALTER TABLE student_attendances DROP COLUMN sign_in_time;"
                        "ALTER TABLE student_attendances DROP COLUMN sign_out_time;"
                        "ALTER TABLE student_attendances DROP COLUMN pickup_time;"
                        "ALTER TABLE student_attendances DROP COLUMN pickup_by;"
                    ),
                )
            ],
            state_operations=[
                migrations.AddField(
                    model_name="studentattendance",
                    name="arrival_time",
                    field=models.TimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="studentattendance",
                    name="sign_in_time",
                    field=models.TimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="studentattendance",
                    name="sign_out_time",
                    field=models.TimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="studentattendance",
                    name="pickup_time",
                    field=models.TimeField(blank=True, null=True),
                ),
                migrations.AddField(
                    model_name="studentattendance",
                    name="pickup_by",
                    field=models.CharField(blank=True, default="", max_length=120),
                ),
            ],
        ),
    ]
