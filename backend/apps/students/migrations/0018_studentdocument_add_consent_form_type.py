from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("students", "0017_promotionbatch_promotionrecord_promotionauditlog_and_more"),
    ]

    operations = [
        migrations.AlterField(
            model_name="studentdocument",
            name="document_type",
            field=models.CharField(
                choices=[
                    ("birth_certificate", "Birth Certificate"),
                    ("aadhaar_card", "Aadhaar Card"),
                    ("medical_information", "Medical Information"),
                    ("caste_certificate", "Caste Certificate"),
                    ("consent_form", "Signed Consent Form"),
                    ("other", "Other"),
                ],
                default="other",
                max_length=30,
            ),
        ),
    ]
