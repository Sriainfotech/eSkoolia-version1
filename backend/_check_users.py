import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
import django
django.setup()

from django.db import connection
from django.contrib.auth import get_user_model
User = get_user_model()
print('User table:', User._meta.db_table)

# Count users in public schema
with connection.cursor() as cur:
    table = User._meta.db_table
    cur.execute(f"SELECT count(*) FROM public.{table}")
    public_count = cur.fetchone()[0]
    print(f'Users in public.{table}: {public_count}')
    
    # Users in school_mpp schema (if table exists)
    try:
        cur.execute(f"SELECT count(*) FROM school_mpp.{table}")
        mpp_count = cur.fetchone()[0]
        print(f'Users in school_mpp.{table}: {mpp_count}')
    except Exception as e:
        print(f'school_mpp.{table} error: {e}')
    
    # List mpp school users from public
    cur.execute(f"SELECT id, username, school_id, is_active FROM public.{table} WHERE school_id = 22 LIMIT 10")
    rows = cur.fetchall()
    print(f'\nMPP school users in public (school_id=22):')
    for r in rows:
        print(f'  id={r[0]} username={r[1]} school_id={r[2]} active={r[3]}')
