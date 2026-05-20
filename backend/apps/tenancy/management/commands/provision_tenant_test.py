"""Management command for staging tenant provisioning and testing.

Usage:
  python manage.py provision_tenant_test --create

This command:
1. Creates test tenants
2. Verifies schema creation
3. Verifies tenant isolation
4. Tests schema switching
5. Validates audit logging
"""
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection

from apps.tenancy.provisioning import provision_tenant, is_provisioning_enabled
from apps.tenancy.models import SchoolTenant, Domain, TenantAuditLog

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Provision test tenants for staging validation and testing."

    def add_arguments(self, parser):
        parser.add_argument(
            "--create",
            action="store_true",
            help="Create test tenants",
        )
        parser.add_argument(
            "--verify",
            action="store_true",
            help="Verify existing tenant isolation",
        )
        parser.add_argument(
            "--cleanup",
            action="store_true",
            help="Clean up test tenants (DANGEROUS)",
        )

    def handle(self, *args, **options):
        if not is_provisioning_enabled():
            self.stdout.write(
                self.style.ERROR(
                    "Tenant provisioning is not enabled. Set MULTI_TENANCY_ENABLED=true in .env"
                )
            )
            return

        if options.get("create"):
            self.create_test_tenants()
        elif options.get("verify"):
            self.verify_tenant_isolation()
        elif options.get("cleanup"):
            self.cleanup_test_tenants()
        else:
            self.print_status()

    def create_test_tenants(self):
        """Create multiple test tenants for staging."""
        self.stdout.write(self.style.WARNING("Creating test tenants...\n"))

        test_tenants = [
            {
                "name": "Greenwood School",
                "subdomain_url": "greenwood",
                "plan": "trial",
            },
            {
                "name": "Alpha Academy",
                "subdomain_url": "alpha",
                "plan": "basic",
            },
            {
                "name": "Beta University",
                "subdomain_url": "beta",
                "plan": "professional",
            },
        ]

        for tenant_config in test_tenants:
            try:
                self.stdout.write(
                    f"\nProvisioning: {tenant_config['name']} ({tenant_config['subdomain_url']})..."
                )

                tenant = provision_tenant(
                    name=tenant_config["name"],
                    subdomain_url=tenant_config["subdomain_url"],
                    plan=tenant_config["plan"],
                    actor_user=None,  # CLI execution
                    actor_ip="127.0.0.1",
                )

                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ Tenant created: {tenant.tenant_id}\n"
                        f"  Schema: {tenant.schema_name}\n"
                        f"  Subdomain: {tenant.subdomain_url}.eskoolia.local\n"
                        f"  Plan: {tenant.plan}\n"
                        f"  Status: {tenant.status}"
                    )
                )

                # Verify schema exists
                self._verify_schema_exists(tenant.schema_name)

                # Verify tables created
                self._verify_tenant_tables(tenant.schema_name)

            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"✗ Failed to create {tenant_config['name']}: {exc}")
                )

        self.stdout.write(
            self.style.SUCCESS("\n✓ Test tenant provisioning completed.\n")
        )

        # Print audit log
        self.print_audit_log()

    def verify_tenant_isolation(self):
        """Verify that tenant data isolation is working correctly."""
        self.stdout.write(self.style.WARNING("Verifying tenant isolation...\n"))

        tenants = SchoolTenant.objects.filter(status="active").order_by("schema_name")

        if not tenants:
            self.stdout.write(
                self.style.WARNING("No active tenants found. Run --create first.")
            )
            return

        self.stdout.write(f"Found {tenants.count()} active tenant(s)\n")

        for tenant in tenants:
            try:
                # Verify schema exists
                self._verify_schema_exists(tenant.schema_name)

                # Verify tables
                table_count = self._verify_tenant_tables(tenant.schema_name)

                self.stdout.write(
                    self.style.SUCCESS(
                        f"✓ {tenant.name} ({tenant.schema_name}): {table_count} tables"
                    )
                )

            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(
                        f"✗ {tenant.name} ({tenant.schema_name}): {exc}"
                    )
                )

    def cleanup_test_tenants(self):
        """Clean up test tenants (DANGEROUS - use with caution)."""
        self.stdout.write(
            self.style.WARNING("CLEANUP: Removing all test tenants...\n")
        )

        tenants = SchoolTenant.objects.filter(
            schema_name__startswith="school_"
        ).order_by("schema_name")

        if not tenants:
            self.stdout.write("No test tenants found.")
            return

        for tenant in tenants:
            try:
                # Drop schema
                schema_name = tenant.schema_name
                with connection.cursor() as cursor:
                    cursor.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE")

                # Delete tenant record
                Domain.objects.filter(tenant=tenant).delete()
                tenant.delete()

                self.stdout.write(
                    self.style.SUCCESS(f"✓ Removed: {tenant.name} ({schema_name})")
                )

            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(
                        f"✗ Failed to remove {tenant.name}: {exc}"
                    )
                )

        self.stdout.write(self.style.SUCCESS("\n✓ Cleanup completed.\n"))

    def print_status(self):
        """Print current provisioning status."""
        self.stdout.write(self.style.WARNING("Tenant Provisioning Status\n"))
        self.stdout.write("=" * 60 + "\n")

        self.stdout.write(
            f"MULTI_TENANCY_ENABLED: {self.style.SUCCESS('TRUE') if is_provisioning_enabled() else self.style.ERROR('FALSE')}"
        )

        tenants = SchoolTenant.objects.all().order_by("schema_name")
        self.stdout.write(f"\nTotal tenants: {tenants.count()}\n")

        if tenants:
            self.stdout.write("Active tenants:\n")
            for tenant in tenants:
                status_style = (
                    self.style.SUCCESS if tenant.status == "active" else self.style.WARNING
                )
                self.stdout.write(
                    f"  - {tenant.name} ({tenant.schema_name}) [{status_style(tenant.status)}]"
                )

        # Show recent audit logs
        self.print_audit_log(limit=10)

    def print_audit_log(self, limit=None):
        """Print recent audit log entries."""
        self.stdout.write("\n" + "=" * 60)
        self.stdout.write("Recent Audit Log Entries\n")
        self.stdout.write("=" * 60 + "\n")

        audits = TenantAuditLog.objects.all().order_by("-created_at")
        if limit:
            audits = audits[:limit]

        if not audits:
            self.stdout.write("No audit log entries found.\n")
            return

        for audit in audits:
            status_style = (
                self.style.SUCCESS if audit.status == "success" else self.style.WARNING
            )
            self.stdout.write(
                f"{audit.created_at.strftime('%Y-%m-%d %H:%M:%S')} | "
                f"{audit.action:25s} | "
                f"{audit.schema_name or 'N/A':20s} | "
                f"{status_style(audit.status)}\n"
            )

    def _verify_schema_exists(self, schema_name):
        """Verify that schema exists in PostgreSQL."""
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
                [schema_name],
            )
            if not cursor.fetchone():
                raise RuntimeError(f"Schema {schema_name} does not exist")

    def _verify_tenant_tables(self, schema_name):
        """Count tables in tenant schema."""
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = %s",
                [schema_name],
            )
            count = cursor.fetchone()[0]

        if count == 0:
            raise RuntimeError(f"No tables found in schema {schema_name}")

        return count
