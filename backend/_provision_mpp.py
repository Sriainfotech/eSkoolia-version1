import os, sys
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')

import django
django.setup()

from apps.tenancy.models import SchoolTenant

tenant = SchoolTenant.objects.get(tenant_id='TNT_4A7D027C')
print(f'Tenant: {tenant.name}  schema={tenant.schema_name}  status={tenant.status}')

# Create the schema by calling create_schema (provided by django-tenants TenantMixin)
try:
    tenant.create_schema(check_if_exists=True)
    print('Schema created (or already existed).')
except Exception as e:
    print(f'create_schema error: {e}')
    # Fallback: run migrations for this schema
    from django.core.management import call_command
    try:
        call_command('migrate_schemas', schema=tenant.schema_name, interactive=False)
        print('migrate_schemas done.')
    except Exception as e2:
        print(f'migrate_schemas error: {e2}')

# Verify schema exists
from django.db import connection
with connection.cursor() as cur:
    cur.execute("SELECT 1 FROM information_schema.schemata WHERE schema_name = %s", [tenant.schema_name])
    exists = bool(cur.fetchone())
    print(f'Schema {tenant.schema_name} exists in DB: {exists}')

# Update status to active
tenant.status = 'active'
tenant.save(update_fields=['status'])
print(f'Status updated to: {tenant.status}')
