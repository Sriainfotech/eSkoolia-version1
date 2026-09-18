import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from django.db import connection

with connection.cursor() as cursor:
    cursor.execute("SELECT table_name FROM information_schema.tables WHERE table_schema='public';")
    tables = [row[0] for row in cursor.fetchall()]

print("Public schema tables:")
print(tables)
