import re

from django.db import migrations


def resolve_numeric_order(name):
    cleaned = (name or "").strip().upper()
    if cleaned == "LKG":
        return 1
    if cleaned == "UKG":
        return 2

    match = re.search(r"(?<!\d)(1[0-2]|[1-9])(?!\d)", cleaned)
    if match:
        return int(match.group(1)) + 2

    return 1000


def backfill_class_orders(apps, schema_editor):
    Class = apps.get_model("core", "Class")
    for school_id in Class.objects.values_list("school_id", flat=True).distinct():
        classes = list(Class.objects.filter(school_id=school_id).order_by("name", "id"))
        for cls in classes:
            if cls.numeric_order == 0:
                cls.numeric_order = resolve_numeric_order(cls.name)
                cls.save(update_fields=["numeric_order"])


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0009_remove_customsmssetting_gateway_and_more"),
    ]

    operations = [
        migrations.RunPython(backfill_class_orders, migrations.RunPython.noop),
    ]