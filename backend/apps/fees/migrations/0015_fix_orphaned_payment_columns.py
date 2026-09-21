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

    This version is intentionally backend-safe for SQLite, the default repo
    test environment in this workspace, while keeping the PostgreSQL repair
    path guarded through introspection rather than PL/pgSQL `DO $$` blocks.
    """

    dependencies = [
        ("fees", "0014_add_dueinteraction"),
    ]

    def forward(apps, schema_editor):
        if schema_editor.connection.vendor == "sqlite":
            return

        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'fees_payment'
                  AND column_name = 'collected_by_note'
                """
            )
            has_collected_by_note = cursor.fetchone() is not None

            cursor.execute(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'fees_payment'
                  AND column_name = 'counter'
                """
            )
            has_counter = cursor.fetchone() is not None

        if has_collected_by_note:
            schema_editor.execute("ALTER TABLE fees_payment ALTER COLUMN collected_by_note SET DEFAULT '';")
        if has_counter:
            schema_editor.execute("ALTER TABLE fees_payment ALTER COLUMN counter SET DEFAULT '';")

    def reverse(apps, schema_editor):
        if schema_editor.connection.vendor == "sqlite":
            return

        with schema_editor.connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'fees_payment'
                  AND column_name = 'collected_by_note'
                """
            )
            has_collected_by_note = cursor.fetchone() is not None

            cursor.execute(
                """
                SELECT 1
                FROM information_schema.columns
                WHERE table_schema = current_schema()
                  AND table_name = 'fees_payment'
                  AND column_name = 'counter'
                """
            )
            has_counter = cursor.fetchone() is not None

        if has_collected_by_note:
            schema_editor.execute("ALTER TABLE fees_payment ALTER COLUMN collected_by_note DROP DEFAULT;")
        if has_counter:
            schema_editor.execute("ALTER TABLE fees_payment ALTER COLUMN counter DROP DEFAULT;")

    operations = [
        migrations.RunPython(forward, reverse),
    ]
