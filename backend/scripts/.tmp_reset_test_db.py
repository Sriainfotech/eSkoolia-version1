from pathlib import Path
import re
from urllib.parse import urlparse

import psycopg2

def reset_test_database():
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
        dbname="postgres",
        user=user,
        password=password,
        host=host,
        port=port,
    )
    conn.autocommit = True
    cur = conn.cursor()

    # Drop the test database if it exists
    cur.execute(f"SELECT 1 FROM pg_database WHERE datname = '{test_db_name}'")
    if cur.fetchone():
        cur.execute(f"DROP DATABASE {test_db_name}")

    # Recreate the test database
    cur.execute(f"CREATE DATABASE {test_db_name}")

    cur.close()
    conn.close()

if __name__ == "__main__":
    reset_test_database()
    print("Test database reset successfully.")