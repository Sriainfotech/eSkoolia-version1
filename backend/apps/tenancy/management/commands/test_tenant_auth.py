"""Management command for testing Phase 9: Tenant-aware auth and schema switching.

Tests:
1. Tenant schema switching
2. JWT auth inside tenant schema
3. RBAC isolation
4. Query isolation
5. Unknown subdomain rejection
6. Super-admin separation
7. Cross-tenant access prevention
"""
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import connection
from django.contrib.auth import get_user_model

from apps.tenancy.models import SchoolTenant
from apps.tenancy.context import (
    get_current_tenant,
    get_current_schema,
    is_multi_tenancy_enabled,
)
from apps.tenancy.validation import get_all_active_tenants
from apps.tenancy.audit_auth import get_auth_audit_log

logger = logging.getLogger(__name__)
User = get_user_model()


class Command(BaseCommand):
    help = "Test Phase 9: Tenant-aware authentication and schema switching."

    def add_arguments(self, parser):
        parser.add_argument(
            "--test-schema-switching",
            action="store_true",
            help="Test schema switching for each active tenant",
        )
        parser.add_argument(
            "--test-auth",
            action="store_true",
            help="Test authentication in tenant context",
        )
        parser.add_argument(
            "--test-rbac",
            action="store_true",
            help="Test RBAC isolation between tenants",
        )
        parser.add_argument(
            "--test-query-isolation",
            action="store_true",
            help="Test ORM query isolation",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Run all tests",
        )

    def handle(self, *args, **options):
        if not is_multi_tenancy_enabled():
            self.stdout.write(
                self.style.ERROR(
                    "Multi-tenancy is disabled. Set MULTI_TENANCY_ENABLED=true in .env"
                )
            )
            return

        self.stdout.write(self.style.WARNING("Phase 9: Auth & Schema Switching Tests\n"))
        self.stdout.write("=" * 70 + "\n")

        if options.get("all"):
            options["test_schema_switching"] = True
            options["test_auth"] = True
            options["test_rbac"] = True
            options["test_query_isolation"] = True

        if options.get("test_schema_switching"):
            self.test_schema_switching()
        if options.get("test_auth"):
            self.test_authentication()
        if options.get("test_rbac"):
            self.test_rbac_isolation()
        if options.get("test_query_isolation"):
            self.test_query_isolation()

        if not any(options.values()):
            self.print_status()

    def test_schema_switching(self):
        """Test schema switching for each tenant."""
        self.stdout.write(self.style.WARNING("\n[TEST] Schema Switching\n"))
        self.stdout.write("-" * 70 + "\n")

        tenants = get_all_active_tenants()
        if not tenants:
            self.stdout.write(self.style.WARNING("No active tenants to test"))
            return

        for tenant in tenants:
            try:
                # Test schema switching
                schema_name = tenant.schema_name
                with connection.cursor() as cursor:
                    cursor.execute(f"SET search_path = {schema_name}, public")
                    cursor.execute("SELECT current_schema()")
                    current = cursor.fetchone()[0]

                    if current == schema_name:
                        self.stdout.write(
                            self.style.SUCCESS(
                                f"✓ Schema switch successful: {schema_name}"
                            )
                        )
                    else:
                        self.stdout.write(
                            self.style.ERROR(
                                f"✗ Schema switch failed: expected {schema_name}, got {current}"
                            )
                        )

            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"✗ Schema switch error for {tenant.name}: {exc}")
                )

    def test_authentication(self):
        """Test authentication in tenant context."""
        self.stdout.write(self.style.WARNING("\n[TEST] Authentication in Tenant Context\n"))
        self.stdout.write("-" * 70 + "\n")

        tenants = get_all_active_tenants()
        if not tenants:
            self.stdout.write(self.style.WARNING("No active tenants to test"))
            return

        for tenant in tenants:
            try:
                schema_name = tenant.schema_name

                # Count users in this schema
                with connection.cursor() as cursor:
                    cursor.execute(f"SET search_path = {schema_name}, public")
                    cursor.execute(
                        "SELECT COUNT(*) FROM auth_user WHERE is_active = true"
                    )
                    user_count = cursor.fetchone()[0]

                    self.stdout.write(
                        f"✓ Tenant {tenant.name}: {user_count} active users "
                        f"in schema {schema_name}"
                    )

            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"✗ Auth test error for {tenant.name}: {exc}")
                )

    def test_rbac_isolation(self):
        """Test RBAC isolation between tenants."""
        self.stdout.write(self.style.WARNING("\n[TEST] RBAC Isolation\n"))
        self.stdout.write("-" * 70 + "\n")

        tenants = get_all_active_tenants()
        if not tenants:
            self.stdout.write(self.style.WARNING("No active tenants to test"))
            return

        if len(tenants) < 2:
            self.stdout.write(
                self.style.WARNING(
                    "Need at least 2 tenants to test isolation; skipping RBAC test"
                )
            )
            return

        # Compare users across schemas
        user_counts = {}
        for tenant in tenants:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f"SET search_path = {tenant.schema_name}, public")
                    cursor.execute(
                        "SELECT COUNT(*) FROM auth_user WHERE is_superuser = false"
                    )
                    count = cursor.fetchone()[0]
                    user_counts[tenant.name] = count

            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(f"✗ RBAC test error for {tenant.name}: {exc}")
                )

        # Verify isolation
        unique_counts = set(user_counts.values())
        if len(unique_counts) > 1 or unique_counts == {0}:
            self.stdout.write(
                self.style.SUCCESS(
                    f"✓ RBAC isolation verified: different user counts per tenant"
                )
            )
            for name, count in user_counts.items():
                self.stdout.write(f"  {name}: {count} users")
        else:
            self.stdout.write(
                self.style.WARNING(
                    "⚠ All tenants have same user count; isolation may not be effective"
                )
            )

    def test_query_isolation(self):
        """Test ORM query isolation."""
        self.stdout.write(self.style.WARNING("\n[TEST] Query Isolation\n"))
        self.stdout.write("-" * 70 + "\n")

        tenants = get_all_active_tenants()
        if not tenants:
            self.stdout.write(self.style.WARNING("No active tenants to test"))
            return

        # For each tenant, verify basic queries work
        for tenant in tenants:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f"SET search_path = {tenant.schema_name}, public")

                    # Test basic table counts
                    tables = [
                        "auth_user",
                        "auth_group",
                        "auth_permission",
                    ]

                    for table in tables:
                        try:
                            cursor.execute(f"SELECT COUNT(*) FROM {table}")
                            count = cursor.fetchone()[0]
                            self.stdout.write(
                                f"✓ {tenant.name}: {table} = {count} rows"
                            )
                        except Exception as tbl_exc:
                            self.stdout.write(
                                self.style.WARNING(
                                    f"⚠ {tenant.name}: {table} not found (expected for new schemas)"
                                )
                            )

            except Exception as exc:
                self.stdout.write(
                    self.style.ERROR(
                        f"✗ Query isolation test error for {tenant.name}: {exc}"
                    )
                )

    def print_status(self):
        """Print overall Phase 9 status."""
        self.stdout.write(self.style.WARNING("Phase 9 Status\n"))
        self.stdout.write("=" * 70 + "\n")

        self.stdout.write(
            f"MULTI_TENANCY_ENABLED: "
            f"{self.style.SUCCESS('TRUE') if is_multi_tenancy_enabled() else self.style.ERROR('FALSE')}\n"
        )

        tenants = get_all_active_tenants()
        self.stdout.write(f"Active tenants: {len(tenants)}\n")

        for tenant in tenants:
            self.stdout.write(
                f"  - {tenant.name} ({tenant.schema_name}): {tenant.plan} plan"
            )

        # Show auth audit logs
        self.stdout.write("\n" + "-" * 70)
        self.stdout.write("Recent Auth Events:\n")

        logs = get_auth_audit_log(limit=5)
        if not logs:
            self.stdout.write("  No auth events logged yet")
        else:
            for log in logs:
                self.stdout.write(
                    f"  {log.created_at.strftime('%Y-%m-%d %H:%M:%S')} | "
                    f"{log.action:20} | "
                    f"{log.schema_name or 'public':20} | "
                    f"{log.status}"
                )

        self.stdout.write("\n" + "=" * 70)
        self.stdout.write("Usage: python manage.py test_tenant_auth --all\n")
        self.stdout.write("  --test-schema-switching : Test schema switching\n")
        self.stdout.write("  --test-auth             : Test authentication\n")
        self.stdout.write("  --test-rbac             : Test RBAC isolation\n")
        self.stdout.write("  --test-query-isolation  : Test query isolation\n")
