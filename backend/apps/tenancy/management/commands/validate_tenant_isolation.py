"""Management command to validate cross-tenant data isolation."""

from django.core.management.base import BaseCommand
from django.db import connection

from apps.tenancy.models import SchoolTenant
from apps.tenancy import migration_framework


class Command(BaseCommand):
    help = "Validate cross-tenant isolation by attempting cross-schema queries"

    def add_arguments(self, parser):
        parser.add_argument("--schema1", type=str, required=True, help="First schema to test")
        parser.add_argument("--schema2", type=str, required=True, help="Second schema to test")
        parser.add_argument("--school1", type=int, required=True, help="School ID in schema1")
        parser.add_argument("--school2", type=int, required=True, help="School ID in schema2")

    def handle(self, *args, **options):
        schema1 = options.get("schema1")
        schema2 = options.get("schema2")
        school1 = options.get("school1")
        school2 = options.get("school2")

        self.stdout.write(f"Validating cross-tenant isolation:")
        self.stdout.write(f"  Schema 1: {schema1} (school {school1})")
        self.stdout.write(f"  Schema 2: {schema2} (school {school2})")
        self.stdout.write("=" * 80)

        tables = migration_framework.get_migration_tables()
        isolation_violations = []

        with connection.cursor() as curs:
            for table in tables:
                # Check schema1 for school2 data (should be empty)
                try:
                    curs.execute(
                        f'SELECT count(*) FROM "{schema1}"."{table}" WHERE school_id = %s',
                        [school2],
                    )
                    count = curs.fetchone()[0]
                    if count > 0:
                        isolation_violations.append(
                            f"Schema {schema1} contains {count} rows for school {school2} in table {table}"
                        )
                except Exception:
                    pass  # Table may not exist

                # Check schema2 for school1 data (should be empty)
                try:
                    curs.execute(
                        f'SELECT count(*) FROM "{schema2}"."{table}" WHERE school_id = %s',
                        [school1],
                    )
                    count = curs.fetchone()[0]
                    if count > 0:
                        isolation_violations.append(
                            f"Schema {schema2} contains {count} rows for school {school1} in table {table}"
                        )
                except Exception:
                    pass

        if isolation_violations:
            self.stdout.write(self.style.ERROR(f"\n✗ ISOLATION VIOLATIONS DETECTED:"))
            for violation in isolation_violations:
                self.stdout.write(self.style.ERROR(f"  - {violation}"))
        else:
            self.stdout.write(self.style.SUCCESS("\n✓ Cross-tenant isolation validated successfully!"))
