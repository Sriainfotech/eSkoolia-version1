from django.db import migrations


def add_district_column_if_missing(apps, schema_editor):
    """Repair the students table safely across SQLite and other backends.

    Migration 0011 already added the model field in state. If the live
    database table lacks the district column, this helper checks the table
    introspection result and only emits the schema change when the column is
    genuinely absent.
    """
    table_name = "students"
    with schema_editor.connection.cursor() as cursor:
        cursor.execute(f"PRAGMA table_info({table_name})")
        columns = {row[1] for row in cursor.fetchall()}

    if "district" not in columns:
        schema_editor.execute(
            "ALTER TABLE students ADD COLUMN district varchar(100) NOT NULL DEFAULT '';"
        )


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0011_student_district"),
    ]

    operations = [
        migrations.RunPython(
            add_district_column_if_missing,
            reverse_code=migrations.RunPython.noop,
        ),
    ]
