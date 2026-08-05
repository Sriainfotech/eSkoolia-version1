from django.db import migrations


class Migration(migrations.Migration):
    """
    fees_payment carries two DB columns (collected_by_note, counter) that are
    NOT NULL with no default and have never been part of the Django model or
    any prior migration — schema drift, likely left over from an earlier
    version of the Payment model. Because the ORM's INSERT never references
    columns it doesn't know about, every payment creation currently fails
    with a NOT NULL violation. Giving both columns a default of '' (matching
    how they're already defined in the school_victory schema) unblocks
    inserts without reintroducing the fields into the model.
    """

    dependencies = [
        ("fees", "0014_add_dueinteraction"),
    ]

    operations = [
        migrations.RunSQL(
            sql=[
                "ALTER TABLE fees_payment ALTER COLUMN collected_by_note SET DEFAULT '';",
                "ALTER TABLE fees_payment ALTER COLUMN counter SET DEFAULT '';",
            ],
            reverse_sql=[
                "ALTER TABLE fees_payment ALTER COLUMN collected_by_note DROP DEFAULT;",
                "ALTER TABLE fees_payment ALTER COLUMN counter DROP DEFAULT;",
            ],
        ),
    ]
