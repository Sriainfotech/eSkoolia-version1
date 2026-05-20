from django.core.management.base import BaseCommand
from django.conf import settings
import logging

from apps.tenancy.utils import validate_tenancy_configuration, _validate_staging_activation_readiness

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = "Validate tenancy configuration and print intended schema operations (dry-run only)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            default=True,
            help="Perform checks and print intended operations without mutating the database.",
        )

    def handle(self, *args, **options):
        dry_run = options.get("dry_run", True)

        self.stdout.write("Starting tenant bootstrap validation (dry-run only)\n")

        # 1. Check feature flag
        if not getattr(settings, "MULTI_TENANCY_ENABLED", False):
            self.stdout.write(self.style.WARNING("MULTI_TENANCY_ENABLED is False — no tenant routing will be active."))
        else:
            self.stdout.write(self.style.SUCCESS("MULTI_TENANCY_ENABLED is True"))

        report = validate_tenancy_configuration(output=self.stdout)
        staging_report = _validate_staging_activation_readiness()

        # Summarize validation state in a predictable dry-run format.
        self.stdout.write("\nReadiness summary:\n")
        self.stdout.write(f" - middleware readiness: {'ok' if not report.get('middleware', {}).get('errors') else 'blocked'}\n")
        self.stdout.write(f" - router readiness: {'ok' if not report.get('routers', {}).get('errors') else 'blocked'}\n")
        self.stdout.write(f" - tenant model readiness: {'ok' if not report.get('models', {}).get('errors') else 'blocked'}\n")
        self.stdout.write(f" - shared/tenant app readiness: {'ok' if not report.get('apps', {}).get('errors') else 'blocked'}\n")
        self.stdout.write(f" - schema drift readiness: {'ok' if not report.get('schema', {}).get('errors') else 'blocked'}\n")
        if report.get("schema", {}).get("warnings"):
            self.stdout.write(self.style.WARNING("  schema drift warnings detected; see the tenancy schema section below."))

        # Print staging activation readiness report
        self.stdout.write("\n" + "="*60)
        self.stdout.write("STAGING ACTIVATION READINESS REPORT")
        self.stdout.write("="*60 + "\n")

        self.stdout.write(f"Staging ready for router activation: {self.style.SUCCESS('YES') if staging_report['staging_ready'] else self.style.ERROR('NO')}\n")

        # App split completeness
        self.stdout.write("\n[APP SPLIT COMPLETENESS]\n")
        app_split = staging_report.get("app_split", {})
        self.stdout.write(f"  SHARED_APPS defined: {len(app_split.get('shared', []))} apps\n")
        self.stdout.write(f"  TENANT_APPS defined: {len(app_split.get('tenant', []))} apps\n")
        if app_split.get("overlap"):
            self.stdout.write(self.style.ERROR(f"  ✗ Duplicate apps found: {', '.join(app_split['overlap'])}\n"))
        if app_split.get("shared_duplicates"):
            self.stdout.write(self.style.WARNING(f"  ⚠ Duplicates in SHARED_APPS: {', '.join(app_split['shared_duplicates'])}\n"))
        if app_split.get("tenant_duplicates"):
            self.stdout.write(self.style.WARNING(f"  ⚠ Duplicates in TENANT_APPS: {', '.join(app_split['tenant_duplicates'])}\n"))
        if not app_split.get("overlap") and not app_split.get("shared_duplicates") and not app_split.get("tenant_duplicates"):
            self.stdout.write(self.style.SUCCESS("  ✓ App split is clean (no duplicates)\n"))

        # Router activation readiness
        self.stdout.write("\n[ROUTER ACTIVATION READINESS]\n")
        router = staging_report.get("router", {})
        self.stdout.write(f"  DATABASE_ROUTERS configured: {router.get('count', 0)} router(s)\n")
        if router.get("routers"):
            for idx, router_path in enumerate(router["routers"], 1):
                self.stdout.write(f"    {idx}. {router_path}\n")
        self.stdout.write(f"  TenantSyncRouter registered: {self.style.SUCCESS('YES') if router.get('has_tenant_sync_router') else self.style.ERROR('NO')}\n")
        self.stdout.write(f"  Router available for import: {self.style.SUCCESS('YES') if router.get('available') else self.style.ERROR('NO')}\n")
        if router.get("import_errors"):
            for error in router["import_errors"]:
                self.stdout.write(self.style.ERROR(f"  ✗ {error}\n"))
        if not router.get("import_errors") and router.get("available"):
            self.stdout.write(self.style.SUCCESS("  ✓ Router configuration is ready\n"))

        # Middleware readiness
        self.stdout.write("\n[MIDDLEWARE READINESS]\n")
        middleware = staging_report.get("middleware", {})
        self.stdout.write(f"  TenantMainMiddleware present: {self.style.SUCCESS('YES') if middleware.get('has_tenant_main') else self.style.ERROR('NO')}\n")
        if middleware.get("has_tenant_main"):
            self.stdout.write(f"  TenantMainMiddleware index: {middleware.get('tenant_main_index')} (should be early in chain)\n")
        self.stdout.write(f"  AuthenticationMiddleware present: {self.style.SUCCESS('YES') if middleware.get('has_auth') else 'NO'}\n")
        if middleware.get("errors"):
            for error in middleware["errors"]:
                self.stdout.write(self.style.ERROR(f"  ✗ {error}\n"))
        if middleware.get("warnings"):
            for warning in middleware["warnings"]:
                self.stdout.write(self.style.WARNING(f"  ⚠ {warning}\n"))
        if not middleware.get("errors") and not middleware.get("warnings"):
            self.stdout.write(self.style.SUCCESS("  ✓ Middleware configuration is ready\n"))

        # JWT authentication readiness
        self.stdout.write("\n[JWT AUTHENTICATION READINESS]\n")
        jwt = staging_report.get("jwt", {})
        self.stdout.write(f"  JWTAuthentication configured: {self.style.SUCCESS('YES') if jwt.get('has_jwt') else self.style.ERROR('NO')}\n")
        if jwt.get("warnings"):
            for warning in jwt["warnings"]:
                self.stdout.write(self.style.WARNING(f"  ⚠ {warning}\n"))

        # Router activation blockers
        self.stdout.write("\n[ROUTER ACTIVATION BLOCKERS]\n")
        blockers = staging_report.get("blockers", [])
        if blockers:
            for idx, blocker in enumerate(blockers, 1):
                self.stdout.write(self.style.ERROR(f"  {idx}. {blocker}\n"))
        else:
            self.stdout.write(self.style.SUCCESS("  ✓ No blockers detected\n"))

        # Warnings
        self.stdout.write("\n[STAGING ACTIVATION WARNINGS]\n")
        warnings = staging_report.get("warnings", [])
        if warnings:
            for idx, warning in enumerate(warnings, 1):
                self.stdout.write(self.style.WARNING(f"  {idx}. {warning}\n"))
        else:
            self.stdout.write(self.style.SUCCESS("  ✓ No warnings\n"))

        # Risks
        self.stdout.write("\n[KNOWN RISKS]\n")
        risks = staging_report.get("risks", [])
        if risks:
            for idx, risk in enumerate(risks, 1):
                self.stdout.write(self.style.WARNING(f"  {idx}. {risk}\n"))
        else:
            self.stdout.write(self.style.SUCCESS("  ✓ No known risks\n"))

        # Keep the command strictly non-mutating.
        if not dry_run:
            self.stdout.write(self.style.WARNING("tenant_bootstrap only supports dry-run validation in this stage; no schemas will be created."))

        # Print intended schema operations (dry-run only)
        self.stdout.write("\n" + "="*60)
        self.stdout.write("PLANNED (DRY-RUN) SCHEMA OPERATIONS")
        self.stdout.write("="*60 + "\n")
        self.stdout.write(" - Ensure public schema exists and is migrated (no-op in dry-run).\n")
        self.stdout.write(" - Create tenant schema skeleton for example tenant 'testschool' (dry-run: do not actually create).\n")
        self.stdout.write(" - Verify tenant migrations would run with `python manage.py migrate_schemas --shared` (dry-run).\n")
        self.stdout.write(" - Validate router readiness, middleware readiness, and tenant model readiness only.\n")

        self.stdout.write("\n" + "="*60)
        self.stdout.write("VALIDATION SUMMARY")
        self.stdout.write("="*60 + "\n")
        self.stdout.write(f"Feature flag (MULTI_TENANCY_ENABLED): {self.style.SUCCESS('TRUE') if getattr(settings, 'MULTI_TENANCY_ENABLED', False) else self.style.WARNING('FALSE')}\n")
        self.stdout.write(f"Staging activation ready: {self.style.SUCCESS('YES') if staging_report['staging_ready'] else self.style.ERROR('NO')}\n")
        self.stdout.write(f"Total blockers: {self.style.ERROR(str(len(blockers))) if blockers else self.style.SUCCESS('0')}\n")
        self.stdout.write(f"Total warnings: {self.style.WARNING(str(len(warnings) + len(risks))) if warnings or risks else self.style.SUCCESS('0')}\n")

        # Logging hints
        logger.info(
            "tenant_bootstrap validation completed (dry_run=%s, tenancy_enabled=%s, staging_ready=%s, blockers=%d)",
            dry_run,
            getattr(settings, "MULTI_TENANCY_ENABLED", False),
            staging_report["staging_ready"],
            len(blockers),
        )
        
        if staging_report["staging_ready"]:
            self.stdout.write(self.style.SUCCESS("\n✓ Tenant bootstrap dry-run validation PASSED. System is ready for staging-only router activation.\n"))
        else:
            self.stdout.write(self.style.ERROR("\n✗ Tenant bootstrap dry-run validation FAILED. Please resolve blockers before enabling router activation.\n"))
