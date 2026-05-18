#!/usr/bin/env python
"""Verify Sprint 1 super-admin models exist in database."""
import os
import django
from django.db import connection

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "=" * 70)
print("VERIFICATION: Sprint 1 Super-Admin Model Tables")
print("=" * 70)

tables_to_check = [
    'tenancy_schooltenant',
    'tenancy_domain',
    'tenancy_tenantauditlog',
    'tenancy_superadminpolicy',
    'tenancy_superadminfeaturetoggle',
    'tenancy_superadmininvoice',
    'tenancy_tenantmigrationaudit',
]

print("\nCHECKING TABLE EXISTENCE:")
with connection.cursor() as cursor:
    # Get all table names from information_schema
    cursor.execute("""
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    """)
    existing_tables = {row[0] for row in cursor.fetchall()}
    
    for table in tables_to_check:
        exists = table in existing_tables
        status = "✓ EXISTS" if exists else "✗ MISSING"
        print(f"  {status}: {table}")

print("\nCHECKING COLUMN COUNTS:")
for table in tables_to_check:
    with connection.cursor() as cursor:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM public.\"{table}\" LIMIT 1")
            print(f"  {table}: OK (table accessible)")
        except Exception as e:
            print(f"  {table}: ERROR - {e}")

print("\nVERIFYING 0005 MIGRATION EXECUTION:")
from django.db.migrations.recorder import MigrationRecorder
recorder = MigrationRecorder(connection)
m0005 = recorder.migration_qs.filter(app='tenancy', name='0005_super_admin_models').first()
if m0005:
    print(f"  ✓ Migration 0005 applied at: {m0005.applied.isoformat()}")
else:
    print(f"  ✗ Migration 0005 NOT found in django_migrations")

print("\n" + "=" * 70)
