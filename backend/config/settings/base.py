from pathlib import Path
import os
from dotenv import load_dotenv
from urllib.parse import parse_qs, unquote, urlparse

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")

BASE_DIR = Path(__file__).resolve().parent.parent.parent

SECRET_KEY = os.getenv("DJANGO_SECRET_KEY", "change-me")
DEBUG = os.getenv("DJANGO_DEBUG", "False").lower() == "true"
ALLOWED_HOSTS = [host.strip() for host in os.getenv("DJANGO_ALLOWED_HOSTS", "127.0.0.1,localhost").split(",")]

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "channels",
    "corsheaders",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "drf_spectacular",
    "django_filters",
    "apps.core",
    "apps.tenancy",
    "apps.users",
    "apps.admissions",
    "apps.access_control",
    "apps.students",
    "apps.academics",
    "apps.attendance",
    "apps.fees",
    "apps.exams",
    "apps.finance",
    "apps.hr",
    "apps.library",
    "apps.behaviour",
    "apps.chat",
    "apps.communication",
    "apps.reports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "apps.tenancy.middleware.TenantContextMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.debug",
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}

DB_ENGINE = os.getenv("DB_ENGINE", "django.db.backends.sqlite3")
DATABASE_URL = os.getenv("DATABASE_URL", "").strip()

if DATABASE_URL:
    parsed_db_url = urlparse(DATABASE_URL)
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
    resolved_options = {}
    query_params = parse_qs(parsed_db_url.query or "")
    resolved_sslmode = (query_params.get("sslmode", [""])[0] or os.getenv("DB_SSLMODE", "")).strip()
    if resolved_sslmode:
        resolved_options["sslmode"] = resolved_sslmode

    DATABASES = {
        "default": {
            "ENGINE": resolved_engine,
            "NAME": resolved_name,
            "USER": unquote(parsed_db_url.username or ""),
            "PASSWORD": unquote(parsed_db_url.password or ""),
            "HOST": parsed_db_url.hostname or "",
            "PORT": str(parsed_db_url.port or ""),
            **({"OPTIONS": resolved_options} if resolved_options else {}),
        }
    }
else:
    DATABASES = {
        "default": {
            "ENGINE": DB_ENGINE,
            "NAME": os.getenv("DB_NAME", str(BASE_DIR / "db.sqlite3")) if DB_ENGINE == "django.db.backends.sqlite3" else os.getenv("DB_NAME", "school_erp"),
            "USER": os.getenv("DB_USER", ""),
            "PASSWORD": os.getenv("DB_PASSWORD", ""),
            "HOST": os.getenv("DB_HOST", ""),
            "PORT": os.getenv("DB_PORT", ""),
        }
    }

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "en-us"
TIME_ZONE = "UTC"
USE_I18N = True
USE_TZ = True

STATIC_URL = "static/"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

AUTH_USER_MODEL = "users.User"

REST_FRAMEWORK = {
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_FILTER_BACKENDS": (
        "django_filters.rest_framework.DjangoFilterBackend",
        "rest_framework.filters.SearchFilter",
        "rest_framework.filters.OrderingFilter",
    ),
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 25,
    "DEFAULT_PERMISSION_CLASSES": [
        "rest_framework.permissions.IsAuthenticated",
    ],
    "DEFAULT_RENDERER_CLASSES": [
        "rest_framework.renderers.JSONRenderer",
    ],
    "DEFAULT_EXCEPTION_HANDLER": "config.exception_handler.custom_exception_handler",
    "EXCEPTION_HANDLER": "config.exception_handler.custom_exception_handler",
}

SPECTACULAR_SETTINGS = {
    "TITLE": "School ERP API",
    "DESCRIPTION": "Rewrite API contracts for School ERP",
    "VERSION": "1.0.0",
}

CORS_ALLOW_ALL_ORIGINS = True

# JWT Configuration for longer token lifespan
SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": os.getenv("JWT_ACCESS_TOKEN_LIFETIME", default=24 * 60),  # 24 hours (in minutes)
    "REFRESH_TOKEN_LIFETIME": os.getenv("JWT_REFRESH_TOKEN_LIFETIME", default=30 * 24 * 60),  # 30 days
    "ALGORITHM": "HS256",
    "SIGNING_KEY": SECRET_KEY,
}

# Convert minutes to timedelta for django-rest-simplejwt
from datetime import timedelta
try:
    SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"] = timedelta(
        minutes=int(SIMPLE_JWT["ACCESS_TOKEN_LIFETIME"])
    )
    SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"] = timedelta(
        minutes=int(SIMPLE_JWT["REFRESH_TOKEN_LIFETIME"])
    )
except (ValueError, TypeError):
    pass

CELERY_BROKER_URL = os.getenv("REDIS_URL", "redis://127.0.0.1:6379/0")
CELERY_RESULT_BACKEND = CELERY_BROKER_URL
