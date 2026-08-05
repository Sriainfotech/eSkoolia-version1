"""Link legacy SchoolTenant rows to their School row via subdomain match.

SchoolTenant.school (added in migration 0019_schooltenant_school) is the
correct FK for joining a School to its richer SchoolTenant record (address,
board affiliation, logo, etc.). Tenants provisioned before that migration
only have `subdomain_url` populated and `school` left NULL. This command
backfills that FK for any such row where the subdomain unambiguously
matches exactly one School, so downstream code (my_school_info_view,
Settings > School Info) can rely on the FK instead of a string join.

Usage:
    python manage.py backfill_schooltenant_school_links --dry-run
    python manage.py backfill_schooltenant_school_links
"""

from django.core.management.base import BaseCommand
from django.db.models import Count

from apps.tenancy.models import School, SchoolTenant


class Command(BaseCommand):
    help = "Backfill SchoolTenant.school for legacy tenants matched by subdomain"

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would change without writing anything.",
        )

    def handle(self, *args, **options):
        dry_run = options["dry_run"]

        unlinked = SchoolTenant.objects.filter(school__isnull=True).exclude(subdomain_url="")
        if not unlinked.exists():
            self.stdout.write(self.style.SUCCESS("No unlinked SchoolTenant rows with a subdomain_url found."))
            return

        # Schools whose subdomain matches more than one SchoolTenant (or vice
        # versa) are ambiguous — never guess, just report them.
        duplicate_subdomains = set(
            School.objects.exclude(subdomain="")
            .values("subdomain")
            .annotate(n=Count("id"))
            .filter(n__gt=1)
            .values_list("subdomain", flat=True)
        )

        linked = 0
        skipped_no_match = []
        skipped_ambiguous = []

        for tenant in unlinked:
            subdomain = tenant.subdomain_url.strip().lower()
            if subdomain in duplicate_subdomains:
                skipped_ambiguous.append(tenant.tenant_id)
                continue

            matches = list(School.objects.filter(subdomain__iexact=subdomain))
            if len(matches) == 0:
                skipped_no_match.append(tenant.tenant_id)
                continue
            if len(matches) > 1:
                skipped_ambiguous.append(tenant.tenant_id)
                continue

            school = matches[0]
            if hasattr(school, "tenant_record") and school.tenant_record_id and school.tenant_record_id != tenant.id:
                # This School is already linked to a different SchoolTenant —
                # linking this one too would violate the OneToOne constraint.
                skipped_ambiguous.append(tenant.tenant_id)
                continue

            self.stdout.write(f"{'[dry-run] ' if dry_run else ''}Linking tenant {tenant.tenant_id!r} -> school {school.id} ({school.name!r})")
            if not dry_run:
                tenant.school = school
                tenant.save(update_fields=["school"])
            linked += 1

        self.stdout.write("")
        self.stdout.write(self.style.SUCCESS(f"Linked: {linked}"))
        if skipped_no_match:
            self.stdout.write(self.style.WARNING(f"No matching School (left NULL): {skipped_no_match}"))
        if skipped_ambiguous:
            self.stdout.write(self.style.WARNING(f"Ambiguous match, needs manual review (left NULL): {skipped_ambiguous}"))
        if dry_run:
            self.stdout.write(self.style.NOTICE("Dry run — no changes written."))
