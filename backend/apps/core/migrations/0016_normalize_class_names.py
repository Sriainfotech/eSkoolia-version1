from django.db import migrations
import re


def normalize_class_name(name):
    cleaned = " ".join((name or "").strip().split())
    if not cleaned:
        return None

    upper = cleaned.upper()
    if upper == "NURSERY":
        return "Nursery"
    if upper == "LKG":
        return "LKG"
    if upper == "UKG":
        return "UKG"

    match = re.fullmatch(r"(?:GRADE\s*)?([1-9]|1[0-2])", upper)
    if match:
        return f"Grade {int(match.group(1))}"

    return None


def normalize_existing_classes(apps, schema_editor):
    Class = apps.get_model("core", "Class")
    for school_id in Class.objects.values_list("school_id", flat=True).distinct():
        existing_names = set(
            Class.objects.filter(school_id=school_id).values_list("name", flat=True)
        )

        for cls in Class.objects.filter(school_id=school_id).only("id", "name", "numeric_order"):
            normalized_name = normalize_class_name(cls.name)
            if not normalized_name or normalized_name == cls.name:
                continue

            if normalized_name in existing_names:
                continue

            Class.objects.filter(pk=cls.pk).update(name=normalized_name, numeric_order=cls.numeric_order)
            existing_names.add(normalized_name)


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0015_recalculate_class_numeric_order"),
    ]

    operations = [
        migrations.RunPython(normalize_existing_classes, migrations.RunPython.noop),
    ]
