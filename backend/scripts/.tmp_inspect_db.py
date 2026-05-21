from pathlib import Path
import re
from urllib.parse import urlparse

import psycopg2

env_path = Path(r"d:/eskoolia/New folder (2)/eSkoolia-version1/backend/.env")
text = env_path.read_text(encoding="utf-8")
match = re.search(r"^DATABASE_URL=(.+)$", text, re.M)
if match is None:
    raise SystemExit("DATABASE_URL not found")

url = match.group(1).strip()
parsed = urlparse(url)
user = parsed.username
password = parsed.password
host = parsed.hostname
port = parsed.port or 5432
for database_name in ["neondb_test_local", "test_neondb_test_local"]:
    conn = psycopg2.connect(
        dbname=database_name,
        user=user,
        password=password,
        host=host,
        port=port,
    )
    cur = conn.cursor()
    cur.execute("SELECT to_regclass('public.hr_staff_documents')")
    table_name = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM django_migrations WHERE app='hr' AND name='0007_alter_staff_custom_field_staffdocument'")
    migration_0007 = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM django_migrations WHERE app='hr' AND name='0010_staffdocument'")
    migration_0010 = cur.fetchone()[0]
    print(database_name, table_name, migration_0007, migration_0010)
    cur.close()
    conn.close()
