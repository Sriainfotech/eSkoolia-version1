"""
Management command: python manage.py seed_module_tiers

Classifies existing Permission rows into tiers based on name/code patterns.
CUMULATIVE: each tier's set includes lower tiers' permissions too.

Run once after deployment, then fine-tune in Django admin.
Use --dry-run to preview without writing to DB.
"""
import re
from django.core.management.base import BaseCommand
from apps.access_control.models import AccessTier, ModuleAccessTier, Permission


VIEW_PATTERNS = [
    r"\.view_", r"_list$", r"_detail$", r"_read$", r"_report$", r"_export$",
    r"^view_", r"\.list$", r"\.detail$",
]
OPERATE_PATTERNS = [
    r"\.add_", r"_add$", r"\.create_", r"_create$",
    r"\.edit_", r"_edit$", r"\.update_", r"_update$",
    r"_submit$", r"_upload$", r"_mark_",
    r"^add_", r"^create_", r"^edit_", r"^update_",
]
MANAGE_PATTERNS = [
    r"\.delete_", r"_delete$", r"_bulk_", r"_bulk$",
    r"_approve$", r"_reject$", r"_restore$",
    r"^delete_", r"^bulk_",
]


def classify(code: str) -> str:
    low = code.lower()
    if any(re.search(p, low) for p in VIEW_PATTERNS):
        return AccessTier.VIEW
    if any(re.search(p, low) for p in OPERATE_PATTERNS):
        return AccessTier.OPERATE
    if any(re.search(p, low) for p in MANAGE_PATTERNS):
        return AccessTier.MANAGE
    return AccessTier.FULL


TIER_ORDER = [AccessTier.VIEW, AccessTier.OPERATE, AccessTier.MANAGE, AccessTier.FULL]


class Command(BaseCommand):
    help = "Seed ModuleAccessTier records from existing Permission rows."

    def add_arguments(self, parser):
        parser.add_argument("--dry-run", action="store_true", help="Print only, do not write to DB.")

    def handle(self, *args, **options):
        dry_run = options["dry_run"]
        perms = Permission.objects.all()

        by_module: dict[str, list] = {}
        for p in perms:
            by_module.setdefault(p.module, []).append(p)

        if not by_module:
            self.stdout.write(self.style.WARNING("No permissions found. Run seed_permissions first."))
            return

        for module, module_perms in sorted(by_module.items()):
            classified: dict[str, list] = {t: [] for t in TIER_ORDER}
            for p in module_perms:
                tier = classify(p.code)
                classified[tier].append(p)

            # Build cumulative sets
            cumulative_sets: dict[str, set] = {}
            accumulated: set = set()
            for tier in TIER_ORDER:
                accumulated |= {p.id for p in classified[tier]}
                cumulative_sets[tier] = set(accumulated)

            self.stdout.write(f"\n📦 Module: {module} ({len(module_perms)} permissions)")
            for tier in TIER_ORDER:
                ids = cumulative_sets[tier]
                self.stdout.write(f"  {tier:10s}: {len(ids)} permissions")

                if not dry_run:
                    mat, created = ModuleAccessTier.objects.get_or_create(module=module, tier=tier)
                    mat.permissions.set(ids)
                    action = "created" if created else "updated"
                    self.stdout.write(f"    → {action}")

        if dry_run:
            self.stdout.write(self.style.WARNING("\n[DRY RUN] No data written."))
        else:
            self.stdout.write(self.style.SUCCESS("\n✅ Module tiers seeded successfully."))
