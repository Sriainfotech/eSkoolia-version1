"""Management command to run migration integration test suite."""

from django.core.management.base import BaseCommand
from django.test.utils import setup_test_environment, teardown_test_environment
from django.db import connection
import subprocess
import sys


class Command(BaseCommand):
    help = "Run Phase 11 migration integration tests with pytest"

    def add_arguments(self, parser):
        parser.add_argument("--verbose", action="store_true", help="Verbose output")
        parser.add_argument("--specific", type=str, help="Run specific test class (e.g., DryRunMigrationTest)")
        parser.add_argument("--failfast", action="store_true", help="Stop on first failure")

    def handle(self, *args, **options):
        verbose = options.get("verbose", False)
        specific = options.get("specific", None)
        failfast = options.get("failfast", False)

        self.stdout.write("Starting Phase 11 migration integration tests...")
        self.stdout.write("=" * 80)

        # Run pytest on test_integration_migrations.py
        test_file = "apps/tenancy/test_integration_migrations.py"
        cmd = ["python", "-m", "pytest", test_file, "-v"]
        
        if verbose:
            cmd.append("-vv")
        if failfast:
            cmd.append("-x")
        if specific:
            cmd.append(f"-k {specific}")

        try:
            result = subprocess.run(cmd, cwd=".", check=False)
            if result.returncode == 0:
                self.stdout.write(self.style.SUCCESS("\n✓ All tests passed!"))
            else:
                self.stdout.write(self.style.ERROR(f"\n✗ Tests failed with return code {result.returncode}"))
            sys.exit(result.returncode)
        except FileNotFoundError:
            self.stderr.write(
                self.style.ERROR(
                    "pytest not found. Install with: pip install pytest pytest-django"
                )
            )
            sys.exit(1)
