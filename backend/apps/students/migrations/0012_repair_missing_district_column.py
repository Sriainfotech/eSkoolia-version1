from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0011_student_district"),
    ]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE students ADD COLUMN IF NOT EXISTS district varchar(100) NOT NULL DEFAULT '';",
            reverse_sql=migrations.RunSQL.noop,
        ),
    ]
