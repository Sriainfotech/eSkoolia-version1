from pathlib import Path
import re
from urllib.parse import urlparse

import psycopg2
import subprocess

def apply_migrations():
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

    test_db_name = "neondb_test_local"

    conn = psycopg2.connect(
        dbname=test_db_name,
        user=user,
        password=password,
        host=host,
        port=port,
    )
    conn.autocommit = True
    cur = conn.cursor()

    # Check if django_migrations table exists
    try:
        cur.execute("SELECT COUNT(*) FROM django_migrations")
        print("django_migrations table exists.")
    except psycopg2.errors.UndefinedTable:
        print("django_migrations table does not exist. Applying migrations...")
        subprocess.run([
            "py", "-3.10", "manage.py", "migrate", "--database=default"
        ], check=True)

    cur.close()
    conn.close()

if __name__ == "__main__":
    apply_migrations()