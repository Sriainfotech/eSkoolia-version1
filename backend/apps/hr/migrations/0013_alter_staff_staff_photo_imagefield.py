from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("hr", "0012_remove_staffdocument_uq_staff_doc_scope_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="staff",
            name="staff_photo",
            field=models.ImageField(blank=True, upload_to="staff/photos/"),
        ),
    ]
