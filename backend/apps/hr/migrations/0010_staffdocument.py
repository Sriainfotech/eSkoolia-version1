from django.db import migrations


class Migration(migrations.Migration):
    """
    This migration was created on a parallel development branch where
    StaffDocument didn't exist yet. On a fresh database, the table is
    already created by 0007_alter_staff_custom_field_staffdocument.

    Making this a complete no-op prevents "relation already exists" errors.
    Migration 0012 handles field and constraint reconciliation between the
    two branches.
    """

    dependencies = [
        ("hr", "0009_payrollsettings"),
        ("tenancy", "0001_initial"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            state_operations=[],    # state already has StaffDocument from 0007_alter
            database_operations=[],  # table already exists from 0007_alter
        ),
    ]