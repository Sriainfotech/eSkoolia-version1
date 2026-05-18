"""
1. Truncate any existing role names that are longer than 30 characters.
   If truncation would create a duplicate within the same school, a short
   numeric suffix is appended (e.g. " 2", " 3") so uniqueness is preserved.
2. Shrink the name column from varchar(120) to varchar(30).
3. Add is_active boolean (default True).
"""
from django.db import migrations, models


def truncate_long_role_names(apps, schema_editor):
    Role = apps.get_model("access_control", "Role")
    for role in Role.objects.all():
        if len(role.name) <= 30:
            continue
        base = role.name[:30].strip()
        candidate = base
        counter = 1
        while (
            Role.objects.filter(school=role.school, name__iexact=candidate)
            .exclude(pk=role.pk)
            .exists()
        ):
            suffix = f" {counter}"
            candidate = base[: 30 - len(suffix)] + suffix
            counter += 1
        role.name = candidate
        role.save(update_fields=["name"])


class Migration(migrations.Migration):

    dependencies = [
        ("access_control", "0012_role_unique_nulls_distinct"),
    ]

    operations = [
        # 1. Truncate long names first so the ALTER below cannot fail.
        migrations.RunPython(truncate_long_role_names, migrations.RunPython.noop),
        # 2. Shrink the column.
        migrations.AlterField(
            model_name="role",
            name="name",
            field=models.CharField(max_length=30),
        ),
        # 3. Add is_active.
        migrations.AddField(
            model_name="role",
            name="is_active",
            field=models.BooleanField(default=True),
        ),
    ]
