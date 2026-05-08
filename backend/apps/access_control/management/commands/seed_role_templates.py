"""
Management command: python manage.py seed_role_templates

Creates the default school role templates.
Safe to re-run — uses update_or_create.
"""
from django.core.management.base import BaseCommand
from apps.access_control.models import RoleTemplate

TEMPLATES = [
    {
        "name": "Teaching Staff (Subject Teacher)",
        "description": "Suitable for subject teachers. Academics and attendance access only.",
        "module_tiers": {
            "academics": "operate",
            "students": "view",
            "attendance": "operate",
            "fees": "none",
            "hr": "none",
            "transport": "none",
            "admissions": "none",
            "reports": "none",
            "admin_section": "none",
            "library": "view",
            "inventory": "none",
            "examination": "operate",
            "behaviour": "none",
        },
    },
    {
        "name": "Class Teacher",
        "description": "Can manage attendance and behaviour for their class. Extends Subject Teacher.",
        "module_tiers": {
            "academics": "operate",
            "students": "operate",
            "attendance": "manage",
            "fees": "none",
            "hr": "none",
            "transport": "none",
            "admissions": "view",
            "reports": "view",
            "admin_section": "none",
            "library": "view",
            "inventory": "none",
            "examination": "operate",
            "behaviour": "manage",
        },
    },
    {
        "name": "Staff Coordinator",
        "description": "Supervisory role. Manages academics and staff scheduling.",
        "module_tiers": {
            "academics": "manage",
            "students": "manage",
            "attendance": "manage",
            "fees": "view",
            "hr": "view",
            "transport": "operate",
            "admissions": "operate",
            "reports": "operate",
            "admin_section": "none",
            "library": "operate",
            "inventory": "operate",
            "examination": "manage",
            "behaviour": "manage",
        },
    },
    {
        "name": "Accountant",
        "description": "Full access to fees and financial reports. No academic modules.",
        "module_tiers": {
            "academics": "none",
            "students": "view",
            "attendance": "none",
            "fees": "full",
            "hr": "none",
            "transport": "none",
            "admissions": "none",
            "reports": "manage",
            "admin_section": "none",
            "library": "none",
            "inventory": "none",
            "examination": "none",
            "behaviour": "none",
        },
    },
    {
        "name": "HR Staff",
        "description": "Full HR module access. No student or fee access.",
        "module_tiers": {
            "academics": "none",
            "students": "none",
            "attendance": "none",
            "fees": "none",
            "hr": "full",
            "transport": "none",
            "admissions": "none",
            "reports": "view",
            "admin_section": "none",
            "library": "none",
            "inventory": "none",
            "examination": "none",
            "behaviour": "none",
        },
    },
    {
        "name": "Driver",
        "description": "View-only access to transport schedule. Nothing else.",
        "module_tiers": {
            "academics": "none",
            "students": "none",
            "attendance": "none",
            "fees": "none",
            "hr": "none",
            "transport": "view",
            "admissions": "none",
            "reports": "none",
            "admin_section": "none",
            "library": "none",
            "inventory": "none",
            "examination": "none",
            "behaviour": "none",
        },
    },
    {
        "name": "Librarian",
        "description": "Full library access. View students for issue/return lookup.",
        "module_tiers": {
            "academics": "none",
            "students": "view",
            "attendance": "none",
            "fees": "none",
            "hr": "none",
            "transport": "none",
            "admissions": "none",
            "reports": "view",
            "admin_section": "none",
            "library": "full",
            "inventory": "operate",
            "examination": "none",
            "behaviour": "none",
        },
    },
    {
        "name": "Receptionist / Admin Staff",
        "description": "Admissions, visitor management, certificates. No fees or HR.",
        "module_tiers": {
            "academics": "none",
            "students": "view",
            "attendance": "none",
            "fees": "none",
            "hr": "none",
            "transport": "none",
            "admissions": "manage",
            "reports": "none",
            "admin_section": "operate",
            "library": "none",
            "inventory": "none",
            "examination": "none",
            "behaviour": "none",
        },
    },
]


class Command(BaseCommand):
    help = "Seed default role templates for Eskoolia."

    def handle(self, *args, **options):
        for t in TEMPLATES:
            obj, created = RoleTemplate.objects.update_or_create(
                name=t["name"],
                defaults={"description": t["description"], "module_tiers": t["module_tiers"]},
            )
            verb = "Created" if created else "Updated"
            self.stdout.write(f"{verb}: {obj.name}")
        self.stdout.write(self.style.SUCCESS(f"\n✅ {len(TEMPLATES)} role templates seeded."))
