import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
import django
django.setup()

from django_tenants.utils import schema_context
from django.core.management import call_command

print('Running migrations for school_mpp schema...')
with schema_context('school_mpp'):
    call_command('migrate', '--run-syncdb', interactive=False, verbosity=1)

print('\nDone. Checking tables...')
from django.db import connection
with connection.cursor() as cur:
    cur.execute("""
        SELECT count(*) 
        FROM information_schema.tables 
        WHERE table_schema = 'school_mpp'
    """)
    count = cur.fetchone()[0]
    print(f'Tables in school_mpp: {count}')
