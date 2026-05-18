from django.core.management.base import BaseCommand
from django.conf import settings


class Command(BaseCommand):
    help = "Provision a tenant schema skeleton for testing and validation."

    def add_arguments(self, parser):
        parser.add_argument(
            "--create-public",
            action="store_true",
            help="Create the public schema objects required by django-tenants.",
        )
        parser.add_argument(
            "--provision-test-tenant",
            action="store_true",
            help="Create a test tenant schema and a sample domain.",
        )

    def handle(self, *args, **options):
        if not getattr(settings, "MULTI_TENANCY_ENABLED", False):
            self.stdout.write(self.style.WARNING("MULTI_TENANCY_ENABLED is False — aborting."))
            return

        # Defer actual work to utilities so this command can be lightweight
        try:
            from apps.tenancy import utils
        except Exception as exc:
            self.stderr.write(f"Failed to import tenancy utilities: {exc}")
            return

        if options.get("create_public"):
            self.stdout.write("Creating public schema (dry-run friendly)...")
            utils.create_public_schema(self.stdout)

        if options.get("provision_test_tenant"):
            self.stdout.write("Provisioning test tenant (dry-run friendly)...")
            utils.provision_test_tenant(self.stdout)

        self.stdout.write(self.style.SUCCESS("Provision command completed (no destructive actions performed)."))
