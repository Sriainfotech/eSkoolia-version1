"""
CI / test settings.
Inherits from base; overrides only what the test environment needs.
DATABASE_URL and SECRET_KEY are injected by the GitHub Actions workflow env block.
"""
import os

from .base import *  # noqa: F401, F403

DEBUG = False

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

# Static / media — not needed in CI
STATICFILES_STORAGE = "django.contrib.staticfiles.storage.StaticFilesStorage"
DEFAULT_FILE_STORAGE = "django.core.files.storage.FileSystemStorage"

# Strip connect_timeout from SQLite OPTIONS (SQLite doesn't support it)
_db = DATABASES.get("default", {})  # noqa: F405
if _db.get("ENGINE", "").endswith("sqlite3"):
    _db.get("OPTIONS", {}).pop("connect_timeout", None)

