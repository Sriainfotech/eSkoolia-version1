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
        # Conditional: only school_victory (and any other tenant schema that
        # picked up the same manual drift) actually has these columns. A
        # brand-new tenant schema, provisioned cleanly through
        # apps.tenancy.provisioning.provision_tenant(), never has them - a
        # bare ALTER COLUMN there fails outright since the column doesn't
        # exist, breaking tenant provisioning for every new school. Guard on
        # existence (scoped to the current schema specifically, since
        # information_schema.columns is not search_path-scoped by itself)
        # so this stays a no-op wherever there's no drift to fix.
        migrations.RunSQL(
            sql=[
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'fees_payment'
                          AND column_name = 'collected_by_note'
                    ) THEN
                        ALTER TABLE fees_payment ALTER COLUMN collected_by_note SET DEFAULT '';
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'fees_payment'
                          AND column_name = 'counter'
                    ) THEN
                        ALTER TABLE fees_payment ALTER COLUMN counter SET DEFAULT '';
                    END IF;
                END $$;
                """,
            ],
            reverse_sql=[
                """
                DO $$
                BEGIN
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'fees_payment'
                          AND column_name = 'collected_by_note'
                    ) THEN
                        ALTER TABLE fees_payment ALTER COLUMN collected_by_note DROP DEFAULT;
                    END IF;
                    IF EXISTS (
                        SELECT 1 FROM information_schema.columns
                        WHERE table_schema = current_schema()
                          AND table_name = 'fees_payment'
                          AND column_name = 'counter'
                    ) THEN
                        ALTER TABLE fees_payment ALTER COLUMN counter DROP DEFAULT;
                    END IF;
                END $$;
                """,
            ],
        ),
    ]
