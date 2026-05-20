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
conn = psycopg2.connect(
    dbname="postgres",
    user=parsed.username,
    password=parsed.password,
    host=parsed.hostname,
    port=parsed.port or 5432,
)
conn.autocommit = True
cur = conn.cursor()
target = "neondb_test_local"
cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (target,))
exists = cur.fetchone() is not None
if not exists:
    cur.execute(f'CREATE DATABASE "{target}"')
print("exists" if exists else "created")
cur.close()
conn.close()
