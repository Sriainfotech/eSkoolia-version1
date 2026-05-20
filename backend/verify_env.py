#!/usr/bin/env python
"""Verification script for environment diagnostics."""
import os
import sys
import django
from pathlib import Path

def verify_environment(settings_module):
    """Verify environment for a given settings module."""
    os.environ['DJANGO_SETTINGS_MODULE'] = settings_module
    django.setup()
    
    from django.conf import settings
    from django.db import connection
    from django.db.migrations.recorder import MigrationRecorder
    
    print(f'\n{"=" * 70}')
    print(f'ENVIRONMENT: {settings_module}')
    print("=" * 70)
    
    print('\nENVIRONMENT VARIABLES:')
    print(f'  DJANGO_SETTINGS_MODULE: {os.environ.get("DJANGO_SETTINGS_MODULE", "NOT_SET")}')
    print(f'  DATABASE_URL: {os.environ.get("DATABASE_URL", "NOT_SET")[:50]}...' if os.environ.get("DATABASE_URL") else '  DATABASE_URL: NOT_SET')
    print(f'  MULTI_TENANCY_ENABLED: {os.environ.get("MULTI_TENANCY_ENABLED", "NOT_SET")}')
    
    print('\nDATABASE CONFIG:')
    db_config = settings.DATABASES.get('default', {})
    print(f'  ENGINE: {db_config.get("ENGINE")}')
    print(f'  NAME: {db_config.get("NAME")}')
    print(f'  HOST: {db_config.get("HOST")}')
    print(f'  PORT: {db_config.get("PORT")}')
    print(f'  USER: {db_config.get("USER")}')
    
    print('\nTENANCY MIGRATIONS IN DJANGO_MIGRATIONS TABLE:')
    try:
        recorder = MigrationRecorder(connection)
        rows = list(recorder.migration_qs.filter(app='tenancy').order_by('applied').values_list('name', 'applied'))
        if rows:
            for name, applied in rows:
                print(f'  [X] {name}\t{applied.isoformat()}')
        else:
            print('  (no migrations applied)')
    except Exception as e:
        print(f'  ERROR querying migrations: {e}')
    
    print('\nMIGRATION FILES IN REPO (tenancy/migrations/):')
    migrations_dir = Path(__file__).parent / 'apps' / 'tenancy' / 'migrations'
    if migrations_dir.exists():
        migration_files = sorted([f.name for f in migrations_dir.glob('*.py') if not f.name.startswith('__')])
        for f in migration_files:
            print(f'  {f}')
    else:
        print('  (migrations directory not found)')

if __name__ == '__main__':
    verify_environment('config.settings.local')
    verify_environment('config.settings.production')
    print("\n" + "=" * 70)
    print("VERIFICATION COMPLETE")
    print("=" * 70)
