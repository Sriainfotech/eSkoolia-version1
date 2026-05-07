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
    "apps.competitions",
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
    resolved_options = {
        "connect_timeout": 10,  # 10 sec timeout — lets Neon wake up without hanging
    }
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
            # Neon / serverless Postgres: never reuse a connection between
            # requests — the idle connection will be dropped by Neon and
            # the next query will fail with "getaddrinfo failed".
            "CONN_MAX_AGE": 0,
            # Django 4.1+: health-check each connection before use so a
            # freshly obtained connection is guaranteed to be open.
            "CONN_HEALTH_CHECKS": True,
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
            "CONN_MAX_AGE": 0,
            "CONN_HEALTH_CHECKS": True,
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
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
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
    "DEFAULT_PAGINATION_CLASS": "config.pagination.ApiPageNumberPagination",
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

REDIS_URL = os.getenv("REDIS_URL", "").strip()
if REDIS_URL:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.redis.RedisCache",
            "LOCATION": REDIS_URL,
            "TIMEOUT": int(os.getenv("DJANGO_CACHE_TIMEOUT", "300")),
            "OPTIONS": {
                "socket_connect_timeout": 3,
                "socket_timeout": 3,
            },
        }
    }
else:
    CACHES = {
        "default": {
            "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
            "LOCATION": "eskoolia-default-cache",
            "TIMEOUT": int(os.getenv("DJANGO_CACHE_TIMEOUT", "300")),
        }
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

CELERY_BROKER_URL = REDIS_URL or "redis://127.0.0.1:6379/0"
CELERY_RESULT_BACKEND = CELERY_BROKER_URL

# ── Celery Beat — scheduled tasks ────────────────────────────────────────────
from celery.schedules import crontab  # noqa: E402

CELERY_BEAT_SCHEDULE = {
    # Run every morning at 8:00 AM (server local time) to generate follow-up reminders
    "admissions-morning-followup-digest": {
        "task": "admissions.send_followup_reminders",
        "schedule": crontab(hour=8, minute=0),
    },
    # Recompute lead scores every day at 7:45 AM so fresh data is ready by 8 AM
    "admissions-compute-lead-scores": {
        "task": "admissions.compute_lead_scores",
        "schedule": crontab(hour=7, minute=45),
    },
}

# Optional AI suggestion settings for student category descriptions
CATEGORY_AI_SUGGESTION_ENABLED = os.getenv("CATEGORY_AI_SUGGESTION_ENABLED", "False").lower() == "true"
CATEGORY_AI_OPENAI_API_KEY = os.getenv("CATEGORY_AI_OPENAI_API_KEY", "").strip()
CATEGORY_AI_OPENAI_ENDPOINT = os.getenv(
    "CATEGORY_AI_OPENAI_ENDPOINT",
    "https://api.openai.com/v1/chat/completions",
).strip()
CATEGORY_AI_OPENAI_MODEL = os.getenv("CATEGORY_AI_OPENAI_MODEL", "gpt-4o-mini").strip()
