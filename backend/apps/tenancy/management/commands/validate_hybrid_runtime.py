"""Management command to validate hybrid runtime (migrated vs non-migrated schools)."""

from django.core.management.base import BaseCommand
from django.db import connection

from apps.tenancy.models import SchoolTenant, School


class Command(BaseCommand):
    help = "Validate hybrid runtime: migrated schools use tenant schema, non-migrated use monolithic DB"

    def add_arguments(self, parser):
        parser.add_argument("--migrated-school-id", type=int, help="School ID that has been migrated")
        parser.add_argument("--non-migrated-school-id", type=int, help="School ID that has NOT been migrated")

    def handle(self, *args, **options):
        migrated_school_id = options.get("migrated_school_id")
        non_migrated_school_id = options.get("non_migrated_school_id")

        self.stdout.write("Validating hybrid runtime configuration...")
        self.stdout.write("=" * 80)

        # Check existing schools
        schools = School.objects.all()
        self.stdout.write(f"\nExisting schools in monolithic DB:")
        for school in schools:
            self.stdout.write(f"  - {school.name} (id={school.id}, code={school.code})")

        # Check existing tenants
        tenants = SchoolTenant.objects.all()
        self.stdout.write(f"\nExisting tenants in PUBLIC schema:")
        for tenant in tenants:
            self.stdout.write(
                f"  - {tenant.name} (tenant_id={tenant.tenant_id}, schema={tenant.schema_name}, status={tenant.status})"
            )

        # Validate routing
        self.stdout.write(f"\n" + "=" * 80)
        self.stdout.write("Validation Results:")

        if migrated_school_id:
            school = School.objects.filter(id=migrated_school_id).first()
            tenant = SchoolTenant.objects.filter(short_code=school.code if school else "").first()

            if tenant and tenant.schema_name:
                self.stdout.write(
                    self.style.SUCCESS(f"\n✓ Migrated school {migrated_school_id} has tenant schema: {tenant.schema_name}")
                )
            else:
                self.stdout.write(
                    self.style.WARNING(
                        f"\n! Migrated school {migrated_school_id} not found in SchoolTenant. Check mapping."
                    )
                )

        if non_migrated_school_id:
            school = School.objects.filter(id=non_migrated_school_id).first()
            if school:
                self.stdout.write(
                    self.style.SUCCESS(
                        f"\n✓ Non-migrated school {non_migrated_school_id} remains in monolithic DB: {school.name}"
                    )
                )
            else:
                self.stdout.write(self.style.WARNING(f"\n! Non-migrated school {non_migrated_school_id} not found"))

        self.stdout.write(self.style.SUCCESS("\n✓ Hybrid runtime validation complete"))
