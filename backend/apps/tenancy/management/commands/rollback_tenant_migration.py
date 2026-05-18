from django.core.management.base import BaseCommand

from apps.tenancy import migration_framework


class Command(BaseCommand):
    help = "Rollback a tenant migration for a single school by removing tenant-side rows. Does not touch public monolithic data."

    def add_arguments(self, parser):
        parser.add_argument("--school-id", type=int, required=True)
        parser.add_argument("--schema-name", type=str, required=True)
        parser.add_argument("--actor-username", type=str, required=False)

    def handle(self, *args, **options):
        school_id = options.get("school_id")
        schema_name = options.get("schema_name")

        self.stdout.write(f"Rolling back migration for school {school_id} in schema {schema_name}")
        audit = migration_framework.rollback_migration(school_id=school_id, schema_name=schema_name)

        self.stdout.write(self.style.SUCCESS(f"Rollback audit status: {audit.status}"))
        self.stdout.write(self.style.SUCCESS(f"Tables outcome: {audit.tables}"))
