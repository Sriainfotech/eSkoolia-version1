from django.core.management.base import BaseCommand
from django.contrib.auth import get_user_model

from apps.tenancy import migration_framework
from apps.tenancy.models import School, SchoolTenant


class Command(BaseCommand):
    help = "Migrate a single school's data from monolithic public schema into a tenant schema. Supports --dry-run."

    def add_arguments(self, parser):
        parser.add_argument("--school-id", type=int, required=True)
        parser.add_argument("--tenant-id", type=str, required=False)
        parser.add_argument("--schema-name", type=str, required=False)
        parser.add_argument("--dry-run", action="store_true", default=False)
        parser.add_argument("--actor-username", type=str, required=False)

    def handle(self, *args, **options):
        school_id = options.get("school_id")
        tenant_id = options.get("tenant_id")
        schema_name = options.get("schema_name")
        dry_run = options.get("dry_run")
        actor_username = options.get("actor_username")

        actor = None
        if actor_username:
            User = get_user_model()
            try:
                actor = User.objects.filter(username=actor_username).first()
            except Exception:
                actor = None

        # If tenant_id or schema_name not provided, try to infer from SchoolTenant matching school code
        if not (tenant_id and schema_name):
            # Best-effort mapping: attempt to find SchoolTenant by short_code == School.code
            school = School.objects.filter(id=school_id).first()
            if not school:
                self.stderr.write(self.style.ERROR(f"School id {school_id} not found"))
                return
            st = SchoolTenant.objects.filter(short_code__iexact=school.code).first()
            if st and not tenant_id:
                tenant_id = st.tenant_id
            if st and not schema_name:
                schema_name = st.schema_name

        self.stdout.write(f"Starting migration for school {school_id} -> tenant {tenant_id} schema {schema_name} (dry_run={dry_run})")

        audit = migration_framework.migrate_school_to_tenant(school_id=school_id, tenant_id=tenant_id, schema_name=schema_name, dry_run=dry_run, actor=actor)

        self.stdout.write(self.style.SUCCESS(f"Migration audit id: {audit.id} status={audit.status}"))
        self.stdout.write(self.style.SUCCESS(f"Tables summary: {audit.tables}"))
