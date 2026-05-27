"""
Provision PostgreSQL schemas for all active tenants that are missing one.
Runs migrate_schemas for each missing schema.
"""
import os
import sys
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
django.setup()

from django.db import connection
from django.core.management import call_command
from django_tenants.utils import schema_context
from apps.tenancy.models import SchoolTenant

# Find active tenants missing schemas
with connection.cursor() as cur:
    cur.execute('SELECT schema_name FROM information_schema.schemata')
    existing = {r[0] for r in cur.fetchall()}

tenants = list(SchoolTenant.objects.filter(status='active'))
missing = [(t.subdomain_url, t.schema_name) for t in tenants if t.schema_name not in existing]

print(f"Active tenants missing schema: {len(missing)}")
for sub, schema in missing:
    print(f"  {sub} -> {schema}")

print("\nProvisioning schemas...")
for sub, schema in missing:
    print(f"\n--- Provisioning {sub} ({schema}) ---")
    try:
        # Step 1: Create the PostgreSQL schema
        with connection.cursor() as cur:
            cur.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema}"')
        print(f"  Schema created: {schema}")
        # Step 2: Run migrations within the schema context
        with schema_context(schema):
            call_command('migrate', '--run-syncdb', interactive=False, verbosity=0)
        # Step 3: Count tables
        with connection.cursor() as cur:
            cur.execute("SELECT count(*) FROM information_schema.tables WHERE table_schema = %s", [schema])
            count = cur.fetchone()[0]
        print(f"  OK: {schema} ({count} tables)")
    except Exception as e:
        print(f"  ERROR: {e}")

print("\nDone.")
