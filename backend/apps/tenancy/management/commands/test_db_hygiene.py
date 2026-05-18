"""Inspect and maintain Django/PostgreSQL test hygiene.

This command is intentionally conservative:
- It reports test DB state and migration/table drift.
- It can clean only test-prefixed tenant schemas.
- It never drops a public schema or a non-test tenant schema.
"""

from __future__ import annotations

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection
from django.db.migrations.recorder import MigrationRecorder

from apps.tenancy.test_fixtures import cleanup_test_tenant_schema


class Command(BaseCommand):
    help = "Inspect test DB hygiene and optionally clean only test tenant schemas."

    def add_arguments(self, parser):
        parser.add_argument(
            "--cleanup-test-schemas",
            action="store_true",
            help="Drop tenant schemas whose names start with school_test_",
        )
        parser.add_argument(
            "--show-reset-steps",
            action="store_true",
            help="Print the recommended safe reset workflow for the test database.",
        )

    def handle(self, *args, **options):
        self.stdout.write(self.style.WARNING("Test DB Hygiene Report"))
        self.stdout.write("=" * 72)
        self.stdout.write(f"Settings module: {settings.SETTINGS_MODULE}")
        self.stdout.write(f"Database engine: {settings.DATABASES['default']['ENGINE']}")
        self.stdout.write(f"Database name: {settings.DATABASES['default']['NAME']}")
        self.stdout.write(f"Database host: {settings.DATABASES['default'].get('HOST', '')}")
        self.stdout.write(f"Multi-tenancy enabled: {getattr(settings, 'MULTI_TENANCY_ENABLED', False)}")
        self.stdout.write("")

        self._report_hr_staff_documents_state()
        self._report_tenant_schemas()

        if options["cleanup_test_schemas"]:
            self._cleanup_test_schemas()

        if options["show_reset_steps"]:
            self.stdout.write("")
            self.stdout.write(self.style.WARNING("Recommended safe reset workflow"))
            self.stdout.write("1. Run `pytest --create-db` to force a fresh test database.")
            self.stdout.write("2. If a stale reuse cache is involved, clear `.pytest_cache`.")
            self.stdout.write("3. Use `python manage.py test_db_hygiene --cleanup-test-schemas` to remove only `school_test_*` schemas.")
            self.stdout.write("4. Do not use `--reuse-db` unless `PYTEST_ALLOW_REUSE_DB=1` is set intentionally.")

    def _report_hr_staff_documents_state(self):
        recorder = MigrationRecorder(connection)
        applied_0007 = recorder.migration_qs.filter(app="hr", name="0007_alter_staff_custom_field_staffdocument").exists()
        applied_0010 = recorder.migration_qs.filter(app="hr", name="0010_staffdocument").exists()
        applied_0012 = recorder.migration_qs.filter(app="hr", name="0012_remove_staffdocument_uq_staff_doc_scope_and_more").exists()
        table_exists = "hr_staff_documents" in connection.introspection.table_names()

        self.stdout.write(self.style.WARNING("HR StaffDocument state"))
        self.stdout.write(f"  migration 0007 applied: {applied_0007}")
        self.stdout.write(f"  migration 0010 applied: {applied_0010}")
        self.stdout.write(f"  migration 0012 applied: {applied_0012}")
        self.stdout.write(f"  physical table exists: {table_exists}")

        if table_exists and applied_0007 and applied_0010:
            self.stdout.write(self.style.SUCCESS("  state: consistent with branch history"))
        elif table_exists and not applied_0007:
            self.stdout.write(self.style.WARNING("  state: table exists but migration history is missing 0007"))
        elif not table_exists and applied_0007:
            self.stdout.write(self.style.WARNING("  state: migration recorded but table is missing"))
        else:
            self.stdout.write(self.style.WARNING("  state: needs review"))

    def _report_tenant_schemas(self):
        self.stdout.write("")
        self.stdout.write(self.style.WARNING("Test tenant schemas"))
        if not getattr(settings, "MULTI_TENANCY_ENABLED", False):
            self.stdout.write("  multi-tenancy disabled; no tenant schemas expected in tests")
            return

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name LIKE 'school_test_%'
                ORDER BY schema_name
                """
            )
            rows = [row[0] for row in cursor.fetchall()]

        if not rows:
            self.stdout.write("  no test tenant schemas found")
        else:
            for schema_name in rows:
                self.stdout.write(f"  {schema_name}")

    def _cleanup_test_schemas(self):
        if not getattr(settings, "MULTI_TENANCY_ENABLED", False):
            raise CommandError("Tenant schema cleanup is only available when MULTI_TENANCY_ENABLED=true.")

        with connection.cursor() as cursor:
            cursor.execute(
                """
                SELECT schema_name
                FROM information_schema.schemata
                WHERE schema_name LIKE 'school_test_%'
                ORDER BY schema_name
                """
            )
            rows = [row[0] for row in cursor.fetchall()]

        if not rows:
            self.stdout.write(self.style.SUCCESS("No test tenant schemas to clean."))
            return

        for schema_name in rows:
            cleanup_test_tenant_schema(schema_name)
            self.stdout.write(self.style.SUCCESS(f"Dropped {schema_name}"))
