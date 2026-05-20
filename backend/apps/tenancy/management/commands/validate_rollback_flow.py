"""Management command to validate rollback flow end-to-end."""

from django.core.management.base import BaseCommand

from apps.tenancy import migration_framework
from apps.tenancy.models import TenantMigrationAudit
from apps.tenancy.observability import get_observer


class Command(BaseCommand):
    help = "Validate rollback flow: migrate -> rollback -> re-migrate"

    def add_arguments(self, parser):
        parser.add_argument("--school-id", type=int, required=True, help="School ID to test")
        parser.add_argument("--schema-name", type=str, required=True, help="Tenant schema name")
        parser.add_argument("--tenant-id", type=str, required=True, help="Tenant ID")

    def handle(self, *args, **options):
        school_id = options.get("school_id")
        schema_name = options.get("schema_name")
        tenant_id = options.get("tenant_id")

        observer = get_observer()

        self.stdout.write("Starting rollback flow validation...")
        self.stdout.write(f"School: {school_id}, Schema: {schema_name}, Tenant: {tenant_id}")
        self.stdout.write("=" * 80)

        # Step 1: Migrate
        self.stdout.write("\nStep 1: Migrate school...")
        observer.record_migration_start(school_id, schema_name, tenant_id)

        try:
            audit1 = migration_framework.migrate_school_to_tenant(
                school_id=school_id, tenant_id=tenant_id, schema_name=schema_name, dry_run=False
            )
            table_count1 = len([t for t, info in audit1.tables.items() if info.get("migrated")])
            observer.record_migration_complete(school_id, schema_name, audit1.status, table_count=table_count1)
            self.stdout.write(self.style.SUCCESS(f"  ✓ Migration complete: {audit1.status}"))
            self.stdout.write(f"    Tables migrated: {table_count1}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ✗ Migration failed: {str(e)}"))
            return

        # Step 2: Rollback
        self.stdout.write("\nStep 2: Rollback migration...")
        observer.record_rollback_start(school_id, schema_name)

        try:
            audit2 = migration_framework.rollback_migration(school_id=school_id, schema_name=schema_name)
            table_count2 = len([t for t in audit2.tables.keys()])
            observer.record_rollback_complete(school_id, schema_name, audit2.status, tables_cleaned=table_count2)
            self.stdout.write(self.style.SUCCESS(f"  ✓ Rollback complete: {audit2.status}"))
            self.stdout.write(f"    Tables cleaned: {table_count2}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ✗ Rollback failed: {str(e)}"))
            return

        # Step 3: Re-migrate
        self.stdout.write("\nStep 3: Re-migrate after rollback...")
        observer.record_migration_start(school_id, schema_name, tenant_id)

        try:
            audit3 = migration_framework.migrate_school_to_tenant(
                school_id=school_id, tenant_id=tenant_id, schema_name=schema_name, dry_run=False
            )
            table_count3 = len([t for t, info in audit3.tables.items() if info.get("migrated")])
            observer.record_migration_complete(school_id, schema_name, audit3.status, table_count=table_count3)
            self.stdout.write(self.style.SUCCESS(f"  ✓ Re-migration complete: {audit3.status}"))
            self.stdout.write(f"    Tables migrated: {table_count3}")
        except Exception as e:
            self.stdout.write(self.style.ERROR(f"  ✗ Re-migration failed: {str(e)}"))
            return

        # Summary
        self.stdout.write("\n" + "=" * 80)
        if audit1.status == "completed" and audit2.status == "rolled_back" and audit3.status == "completed":
            self.stdout.write(self.style.SUCCESS("✓ Rollback flow validation PASSED!"))
        else:
            self.stdout.write(self.style.WARNING("! Some steps did not complete as expected"))

        # Print observability summary
        summary = observer.get_summary()
        self.stdout.write(f"\nObservability Summary:")
        self.stdout.write(f"  Total events: {summary['total_events']}")
        self.stdout.write(f"  Error count: {summary['error_count']}")
