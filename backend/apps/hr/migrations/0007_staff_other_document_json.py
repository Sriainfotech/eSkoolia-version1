import json

from django.db import migrations, models


def _normalize_other_document(value):
    if value is None:
        return []

    if isinstance(value, list):
        return [str(item).strip() for item in value if str(item).strip()]

    if isinstance(value, str):
        text = value.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
            if isinstance(parsed, list):
                return [str(item).strip() for item in parsed if str(item).strip()]
        except (TypeError, ValueError, json.JSONDecodeError):
            pass
        return [text]

    text = str(value).strip()
    return [text] if text else []


def forwards_copy_other_document(apps, schema_editor):
    Staff = apps.get_model("hr", "Staff")
    for staff in Staff.objects.all().only("id", "other_document"):
        normalized = _normalize_other_document(getattr(staff, "other_document", ""))
        Staff.objects.filter(id=staff.id).update(other_document_json=normalized)


def backwards_copy_other_document(apps, schema_editor):
    Staff = apps.get_model("hr", "Staff")
    for staff in Staff.objects.all().only("id", "other_document_json"):
        docs = getattr(staff, "other_document_json", None) or []
        text = ""
        if isinstance(docs, list) and docs:
            text = docs[0]
        Staff.objects.filter(id=staff.id).update(other_document=text)


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0006_staff_extended_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="staff",
            name="other_document_json",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(forwards_copy_other_document, backwards_copy_other_document),
        migrations.RemoveField(
            model_name="staff",
            name="other_document",
        ),
        migrations.RenameField(
            model_name="staff",
            old_name="other_document_json",
            new_name="other_document",
        ),
    ]
