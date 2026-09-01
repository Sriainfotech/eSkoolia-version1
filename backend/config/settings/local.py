from .base import *  # noqa

DEBUG = True

# ── Local-dev-only shim, NOT part of the shared tenancy architecture ──────────
# apps/tenancy/middleware.py's TenantContextMiddleware (installed unconditionally
# in MIDDLEWARE, regardless of MULTI_TENANCY_ENABLED) calls
# connection.set_schema_to_public() on every request/response, including when
# multi-tenancy is disabled. That method only exists on django-tenants'
# postgresql backend, which base.py only swaps in when the flag is True — with
# it False (this machine's setting), the plain psycopg2 backend has no such
# method and every request 500s with AttributeError.
# Rather than edit the shared middleware file (owned by the multi-tenancy /
# super-admin separation work), patch a no-op onto the connection wrapper here
# — this file is local-dev-only (config.settings.local, never deployed) and
# the patch itself only activates when MULTI_TENANCY_ENABLED is off, so it
# can't mask a real issue in an environment where tenancy is actually active.
if not MULTI_TENANCY_ENABLED:
    from django.db.backends.postgresql.base import DatabaseWrapper as _PGDatabaseWrapper

    if not hasattr(_PGDatabaseWrapper, "set_schema_to_public"):
        _PGDatabaseWrapper.set_schema_to_public = lambda self: None
 