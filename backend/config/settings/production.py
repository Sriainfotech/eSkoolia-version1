from .base import *  # noqa

DEBUG = False

CORS_ALLOW_ALL_ORIGINS = False
CORS_ALLOWED_ORIGIN_REGEXES = [
    r"^https://.*\.eskoolia\.com$",
    r"^https://eskoolia\.com$",
]

SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31536000
