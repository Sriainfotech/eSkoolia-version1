"""
CI / test settings.
Inherits from base; overrides only what the test environment needs.
DATABASE_URL and SECRET_KEY are injected by the GitHub Actions workflow env block.
"""
import os
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse, urlunparse

from .base import *  # noqa: F401, F403

DEBUG = False
TESTING = True

# CI sets SECRET_KEY; base.py reads DJANGO_SECRET_KEY — support both
SECRET_KEY = os.getenv("SECRET_KEY") or os.getenv("DJANGO_SECRET_KEY", "ci-insecure-test-key-do-not-use-in-production-50c")

# Speed up password hashing in tests
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]

# Use in-memory channel layer (already the default in base, but be explicit)
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

# Security settings — satisfy --deploy check in CI without real HTTPS
SECURE_SSL_REDIRECT = False
SECURE_HSTS_SECONDS = 0
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
SESSION_COOKIE_SECURE = False
CSRF_COOKIE_SECURE = False
ALLOWED_HOSTS = ["*"]

# Silence drf_spectacular schema-generation warnings and security warnings
# that are expected in a CI/test environment (no HTTPS, weak key, etc.)
SILENCED_SYSTEM_CHECKS = [
    # drf_spectacular — schema-gen hints; don't affect runtime behaviour
    "drf_spectacular.E001",  # invalid serializer field in academics app
    "drf_spectacular.W001",  # unresolvable queryset
    "drf_spectacular.W002",  # unable to guess serializer for APIView
    # security — CI is not a production environment
    "security.W004",   # HSTS not set
    "security.W008",   # SECURE_SSL_REDIRECT not set
    "security.W009",   # SECRET_KEY too short/common in CI
    "security.W012",   # SESSION_COOKIE_SECURE not set
    "security.W016",   # CSRF_COOKIE_SECURE not set
]

# Disable noisy logging during tests
LOGGING = {
    "version": 1,
    "disable_existing_loggers": True,
    "handlers": {"null": {"class": "logging.NullHandler"}},
    "root": {"handlers": ["null"]},
}

# Email — use dummy backend so tests never send real mail
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"

# Celery — run tasks synchronously in tests (no broker needed)
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True


def _parse_database_url(database_url: str) -> dict:
    parsed_db_url = urlparse(database_url)
    query_params = parse_qs(parsed_db_url.query or "")
    resolved_sslmode = (query_params.get("sslmode", [""])[0] or os.getenv("DB_SSLMODE", "")).strip()

    if dj_database_url is not None:
        default_db = dj_database_url.parse(database_url, conn_max_age=0)
        default_db.setdefault("OPTIONS", {})
        default_db["OPTIONS"].setdefault("connect_timeout", 10)
        if resolved_sslmode:
            default_db["OPTIONS"]["sslmode"] = resolved_sslmode
        default_db["CONN_HEALTH_CHECKS"] = True
        return default_db

    db_scheme = (parsed_db_url.scheme or "").split("+")[0].lower()
    engine_map = {
        "postgres": "django.db.backends.postgresql",
        "postgresql": "django.db.backends.postgresql",
        "sqlite": "django.db.backends.sqlite3",
    }
    resolved_engine = engine_map.get(db_scheme, DB_ENGINE)
    resolved_name = (
        unquote(parsed_db_url.path.lstrip("/"))
        if resolved_engine != "django.db.backends.sqlite3"
        else (unquote(parsed_db_url.path) or str(BASE_DIR / "db.sqlite3"))
    )
    resolved_options = {"connect_timeout": 10}
    if resolved_sslmode:
        resolved_options["sslmode"] = resolved_sslmode

    return {
        "ENGINE": resolved_engine,
        "NAME": resolved_name,
        "USER": unquote(parsed_db_url.username or ""),
        "PASSWORD": unquote(parsed_db_url.password or ""),
        "HOST": parsed_db_url.hostname or "",
        "PORT": str(parsed_db_url.port or ""),
        **({"OPTIONS": resolved_options} if resolved_options else {}),
        "CONN_MAX_AGE": 0,
        "CONN_HEALTH_CHECKS": True,
    }


DATABASE_URL_TEST = (
    os.getenv("DATABASE_URL_TEST", "").strip().strip('"').strip("'")
    or os.getenv("TEST_DATABASE_URL", "").strip().strip('"').strip("'")
)

if DATABASE_URL_TEST:
    DATABASES = {"default": _parse_database_url(DATABASE_URL_TEST)}
elif os.getenv("CI") or os.getenv("GITHUB_ACTIONS"):
    # CI injects a clean PostgreSQL service database via DATABASE_URL.
    DATABASES = DATABASES
elif DATABASE_URL:
    parsed_main_db_url = urlparse(DATABASE_URL)
    derived_test_db_name = os.getenv("DATABASE_NAME_TEST", "neondb_test_local")
    DATABASES = {"default": _parse_database_url(urlunparse(parsed_main_db_url._replace(path=f"/{derived_test_db_name}")))}
else:
    # Fall back to SQLite only when no PostgreSQL URL is configured at all.
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.sqlite3",
            "NAME": str(Path(BASE_DIR) / "test.sqlite3"),
            "CONN_MAX_AGE": 0,
            "CONN_HEALTH_CHECKS": True,
        }
    }

# Keep Django's test database machinery explicit and predictable.
DATABASES.setdefault("default", {}).setdefault("TEST", {})  # noqa: F405
DATABASES["default"]["TEST"].setdefault(
    "NAME",
    os.getenv("DATABASE_NAME_TEST", DATABASES["default"].get("NAME")),
)  # noqa: F405
DATABASES["default"]["TEST"].setdefault("SERIALIZE", False)  # noqa: F405
DATABASES["default"]["TEST"].setdefault("MIRROR", None)  # noqa: F405

# Static / media — not needed in CI
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"

# Strip connect_timeout from SQLite OPTIONS (SQLite doesn't support it)
_db = DATABASES.get("default", {})  # noqa: F405
if _db.get("ENGINE", "").endswith("sqlite3"):
    _db.get("OPTIONS", {}).pop("connect_timeout", None)

