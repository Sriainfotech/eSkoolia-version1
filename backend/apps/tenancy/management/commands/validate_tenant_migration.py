from django.core.management.base import BaseCommand

from apps.tenancy import migration_framework


class Command(BaseCommand):
    help = "Validate a tenant migration by performing dual-read comparisons between public and tenant schema."

    def add_arguments(self, parser):
        parser.add_argument("--school-id", type=int, required=True)
        parser.add_argument("--schema-name", type=str, required=True)

    def handle(self, *args, **options):
        school_id = options.get("school_id")
        schema_name = options.get("schema_name")

        self.stdout.write(f"Validating migration for school {school_id} in schema {schema_name}")
        report = migration_framework.validate_migration(school_id=school_id, schema_name=schema_name)

        mismatches = [t for t, r in report["results"].items() if not r.get("match")]
        self.stdout.write(self.style.SUCCESS(f"Validation completed. Checked {len(report['results'])} tables."))
        if mismatches:
            self.stdout.write(self.style.WARNING(f"Mismatches found in tables: {mismatches}"))
        else:
            self.stdout.write(self.style.SUCCESS("All table counts match."))
        # Dump full report (JSON-like)
        self.stdout.write(str(report))
