import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
import django
django.setup()

from django.db import connection

# Check tables in school_mpp schema
with connection.cursor() as cur:
    cur.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'school_mpp'
        ORDER BY table_name
        LIMIT 20
    """)
    tables = [r[0] for r in cur.fetchall()]
    print(f'Tables in school_mpp ({len(tables)} shown):')
    for t in tables:
        print(' ', t)
    if not tables:
        print('  (no tables - schema is empty, needs migrations)')
