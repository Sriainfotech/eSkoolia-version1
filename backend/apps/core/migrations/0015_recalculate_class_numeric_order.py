from django.db import migrations
import re


def resolve_numeric_order(name):
    cleaned = (name or "").strip().upper()
    if cleaned == "LKG":
        return 1
    if cleaned == "UKG":
        return 2

    match = re.search(r"(?<!\d)([1-9]\d?)(?!\d)", cleaned)
    if match:
        return int(match.group(1)) + 2

    return 1000


def recalculate_class_orders(apps, schema_editor):
    Class = apps.get_model("core", "Class")
    for cls in Class.objects.all().only("id", "name", "numeric_order"):
        Class.objects.filter(pk=cls.pk).update(numeric_order=resolve_numeric_order(cls.name))


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0014_transport_tracking_enhancements"),
    ]

    operations = [
        migrations.RunPython(recalculate_class_orders, migrations.RunPython.noop),
    ]
