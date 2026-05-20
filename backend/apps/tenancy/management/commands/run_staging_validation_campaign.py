"""Run the Phase 12 controlled staging validation campaign."""

from __future__ import annotations

import os
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.tenancy.staging_validation import (
    CONFIRM_ENV,
    STAGING_GUARD_ENV,
    run_staging_validation_campaign,
)


class Command(BaseCommand):
    help = "Run the Phase 12 controlled staging validation campaign"

    def add_arguments(self, parser):
        parser.add_argument("--pilot-school-id", type=int, help="Explicit pilot school ID to validate")
        parser.add_argument(
            "--confirm-real-migration",
            action="store_true",
            help="Allow the command to run the real migration, rollback, and re-migration steps.",
        )
        parser.add_argument(
            "--export-path",
            type=str,
            help="Optional JSON export path for the campaign report.",
        )
        parser.add_argument(
            "--frontend-dir",
            type=str,
            help="Override the frontend directory used for compatibility tests.",
        )

    def handle(self, *args, **options):
        if not getattr(settings, "MULTI_TENANCY_ENABLED", False):
            raise CommandError("MULTI_TENANCY_ENABLED must be true before running the staging campaign.")

        if getattr(settings, "DEBUG", False):
            raise CommandError("Run the staging campaign with DEBUG=false to match staging conditions.")

        if os.getenv(STAGING_GUARD_ENV, "false").lower() != "true":
            raise CommandError(
                f"Set {STAGING_GUARD_ENV}=true to acknowledge staging-only execution."
            )

        if not options.get("confirm_real_migration") and os.getenv(CONFIRM_ENV, "false").lower() != "true":
            self.stdout.write(self.style.WARNING("Real migration steps will be skipped unless confirmation is provided."))

        frontend_dir = options.get("frontend_dir")
        report = run_staging_validation_campaign(
            pilot_school_id=options.get("pilot_school_id"),
            confirm_real_migration=options.get("confirm_real_migration") or os.getenv(CONFIRM_ENV, "false").lower() == "true",
            frontend_dir=Path(frontend_dir) if frontend_dir else None,
            backend_dir=Path(settings.BASE_DIR),
            export_path=Path(options["export_path"]) if options.get("export_path") else None,
        )

        self.stdout.write("Phase 12 controlled staging validation campaign")
        self.stdout.write("=" * 80)
        self.stdout.write(f"Overall status: {report.overall_status.upper()}")
        self.stdout.write(f"Pilot school: {report.pilot_school.get('name')} ({report.pilot_school.get('code')})")
        self.stdout.write(f"Tenant schema: {report.pilot_school.get('tenant', {}).get('schema_name')}")
        self.stdout.write("")
        self.stdout.write("Campaign steps:")
        for step in report.steps:
            self.stdout.write(f"  - {step['name']}: {step['status']} ({step['duration_ms']} ms)")
        self.stdout.write("")
        self.stdout.write("Validation summary:")
        self.stdout.write(f"  - Overall validation: {report.validation.get('overall_status')}")
        self.stdout.write(f"  - Shadow validation: {report.shadow_validation.get('status')}")
        self.stdout.write(f"  - Backend checks: {sum(1 for result in report.backend_checks.values() if result.get('success'))}/{len(report.backend_checks)}")
        self.stdout.write(f"  - Frontend checks: {'PASS' if report.frontend_checks.get('success') else 'FAIL'}")
        self.stdout.write("")
        self.stdout.write("Benchmark summary:")
        for benchmark in report.benchmarks:
            self.stdout.write(f"  - {benchmark['name']}: {benchmark['duration_ms']} ms")
        self.stdout.write("")
        self.stdout.write("Observability:")
        self.stdout.write(f"  - Total events: {report.observability.get('total_events')}")
        self.stdout.write(f"  - Error count: {report.observability.get('error_count')}")
        if report.notes:
            self.stdout.write("")
            self.stdout.write("Notes:")
            for note in report.notes:
                self.stdout.write(f"  - {note}")

        if report.overall_status == "fail":
            raise CommandError("Phase 12 staging validation campaign failed. Review the exported report.")
