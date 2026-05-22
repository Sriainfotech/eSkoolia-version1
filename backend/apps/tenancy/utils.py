import logging
from django.conf import settings
import importlib
from django.apps import apps as django_apps
from django.db import connection

logger = logging.getLogger(__name__)

TENANT_MAIN_MIDDLEWARE = "apps.tenancy.middleware.TenantMainMiddleware"
JWT_AUTH_CLASS = "rest_framework_simplejwt.authentication.JWTAuthentication"
JWT_AUTH_CLASS_TENANT = "apps.tenancy.auth.TenantAwareJWTAuthentication"
TENANCY_MIGRATION_TABLES = {
    "0001_initial": {"schools"},
    "0002_add_tenant_models": {"school_tenants", "tenant_domains"},
    "0003_add_tenant_audit_log": {"tenancy_audit_log"},
    "0004_rename_tenancy_aud_tenant__idx_tenancy_aud_tenant__1a2506_idx_and_more": set(),
    "0005_super_admin_models": {
        "super_admin_invoices",
        "super_admin_policies",
        "super_admin_feature_toggles",
    },
    "0006_sync_phase10_phase11_models": {
        "tenant_features",
        "tenant_feature_audit",
        "tenant_feature_flags",
        "tenant_migration_audit",
        "tenant_plans",
    },
}


def validate_tenancy_schema_state(output=None):
    """Inspect the physical tenancy schema against django_migrations."""
    result = {
        "applied_migrations": [],
        "existing_tables": [],
        "missing_tables": [],
        "unapplied_but_present": [],
        "warnings": [],
        "errors": [],
        "ok": True,
    }

    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT name FROM django_migrations WHERE app = %s ORDER BY name", ["tenancy"])
            applied_migrations = {row[0] for row in cursor.fetchall()}
            existing_tables = set(connection.introspection.table_names(cursor))
    except Exception as exc:
        message = f"Failed to inspect tenancy schema state: {exc}"
        result["errors"].append(message)
        result["ok"] = False
        if output:
            output.write(message + "\n")
        logger.exception(message)
        return result

    result["applied_migrations"] = sorted(applied_migrations)
    result["existing_tables"] = sorted(existing_tables)

    for migration_name, expected_tables in TENANCY_MIGRATION_TABLES.items():
        if not expected_tables:
            continue

        missing_tables = sorted(expected_tables - existing_tables)
        present_tables = sorted(expected_tables & existing_tables)

        if migration_name in applied_migrations and missing_tables:
            message = (
                f"Applied tenancy migration {migration_name} is missing tables: {', '.join(missing_tables)}"
            )
            result["missing_tables"].extend(missing_tables)
            result["errors"].append(message)

        if migration_name not in applied_migrations and present_tables:
            message = (
                f"Tenancy migration {migration_name} is unapplied but tables already exist: {', '.join(present_tables)}"
            )
            result["unapplied_but_present"].append({"migration": migration_name, "tables": present_tables})
            result["warnings"].append(message)

    if result["errors"]:
        result["ok"] = False

    if output:
        output.write("Tenancy schema state: " + ("ok" if result["ok"] else "drift detected") + "\n")
        if result["errors"]:
            for message in result["errors"]:
                output.write(f"  ERROR: {message}\n")
        if result["warnings"]:
            for message in result["warnings"]:
                output.write(f"  WARNING: {message}\n")

    return result


def create_public_schema(output=None):
    """Create or validate the public schema required by django-tenants.

    This function is guarded so it is safe to import even when
    django-tenants is not installed; it will raise a helpful message
    instead of crashing.
    """
    if not getattr(settings, "MULTI_TENANCY_ENABLED", False):
        msg = "MULTI_TENANCY_ENABLED is False — public schema creation skipped."
        if output:
            output.write(msg)
        logger.info(msg)
        return

    try:
        from django_tenants.utils import get_public_schema_name
        from django.db import connection
    except Exception as exc:
        raise RuntimeError("django-tenants not available or misconfigured: %s" % exc)

    public_schema = get_public_schema_name()
    if output:
        output.write(f"Public schema: {public_schema}\n")

    # Basic validation: ensure public schema exists by running a simple query
    with connection.cursor() as cursor:
        try:
            cursor.execute("SELECT 1;")
            if output:
                output.write("Database reachable and public schema present.\n")
        except Exception as exc:
            raise RuntimeError(f"Failed to validate database/public schema: {exc}")

def _resolve_router_paths():
    routers = list(getattr(settings, "DATABASE_ROUTERS", []) or [])
    resolved = []
    router_errors = []
    for router_path in routers:
        try:
            module_path, class_name = router_path.rsplit(".", 1)
            module = importlib.import_module(module_path)
            router_class = getattr(module, class_name)
            resolved.append({"path": router_path, "class": router_class})
        except Exception as exc:
            router_errors.append(f"Failed to import router {router_path}: {exc}")
    return resolved, router_errors


def validate_tenancy_configuration(output=None):
    """Run tenancy safety checks without mutating the database.

    Returns a structured dictionary with warnings, errors, and readiness
    sections. This helper intentionally avoids schema creation and does not
    touch the database.
    """
    enabled = getattr(settings, "MULTI_TENANCY_ENABLED", False)
    middleware = list(getattr(settings, "MIDDLEWARE", []))
    shared = list(getattr(settings, "SHARED_APPS", []) or [])
    tenant_apps = list(getattr(settings, "TENANT_APPS", []) or [])
    routers = list(getattr(settings, "DATABASE_ROUTERS", []) or [])
    warnings = []
    errors = []

    result = {
        "enabled": enabled,
        "routing_inactive": not enabled,
        "middleware": {"enabled": False, "warnings": [], "errors": []},
        "routers": {"enabled": False, "warnings": [], "errors": [], "upstream_router_available": False},
        "models": {"enabled": False, "warnings": [], "errors": []},
        "apps": {"enabled": False, "warnings": [], "errors": []},
        "schema": {"enabled": True, "warnings": [], "errors": [], "ok": True},
        "warnings": warnings,
        "errors": errors,
    }

    if output:
        output.write("Validating tenancy configuration...\n")

    if not enabled:
        msg = "MULTI_TENANCY_ENABLED is False — tenancy routing remains inactive."
        warnings.append(msg)
        result["routing_inactive"] = True
        if output:
            output.write(msg + "\n")
        logger.info(msg)

    result["middleware"]["enabled"] = bool(enabled)
    result["routers"]["enabled"] = bool(enabled)
    result["models"]["enabled"] = bool(enabled)
    result["apps"]["enabled"] = bool(enabled)

    # middleware readiness
    if TENANT_MAIN_MIDDLEWARE not in middleware:
        message = "TenantMainMiddleware is missing from MIDDLEWARE."
        result["middleware"]["warnings"].append(message)
        warnings.append(message)
    else:
        tenant_index = middleware.index(TENANT_MAIN_MIDDLEWARE)
        if tenant_index != 0:
            message = "TenantMainMiddleware should be first in MIDDLEWARE when enabled."
            result["middleware"]["warnings"].append(message)
            warnings.append(message)

    auth_mw = "django.contrib.auth.middleware.AuthenticationMiddleware"
    session_mw = "django.contrib.sessions.middleware.SessionMiddleware"
    if auth_mw in middleware and TENANT_MAIN_MIDDLEWARE in middleware:
        if middleware.index(auth_mw) < middleware.index(TENANT_MAIN_MIDDLEWARE):
            message = "AuthenticationMiddleware must appear after TenantMainMiddleware."
            result["middleware"]["errors"].append(message)
            errors.append(message)
    if session_mw in middleware and TENANT_MAIN_MIDDLEWARE in middleware:
        if middleware.index(session_mw) < middleware.index(TENANT_MAIN_MIDDLEWARE):
            message = "SessionMiddleware should remain ahead of TenantMainMiddleware for compatibility."
            result["middleware"]["warnings"].append(message)
            warnings.append(message)
    _auth_classes = set(getattr(settings, "REST_FRAMEWORK", {}).get("DEFAULT_AUTHENTICATION_CLASSES", []))
    if not _auth_classes.intersection({JWT_AUTH_CLASS, JWT_AUTH_CLASS_TENANT}):
        message = "JWTAuthentication is not present in REST_FRAMEWORK; verify auth compatibility."
        result["middleware"]["warnings"].append(message)
        warnings.append(message)

    # router readiness
    try:
        tenant_router_module = importlib.import_module("django_tenants.routers")
        result["routers"]["upstream_router_available"] = hasattr(tenant_router_module, "TenantSyncRouter")
        if not result["routers"]["upstream_router_available"]:
            message = "django_tenants.routers.TenantSyncRouter is missing from the installed package."
            result["routers"]["warnings"].append(message)
            warnings.append(message)
    except Exception as exc:
        message = f"Failed to import django_tenants.routers: {exc}"
        result["routers"]["errors"].append(message)
        errors.append(message)

    resolved_routers, router_import_errors = _resolve_router_paths()
    for router_error in router_import_errors:
        result["routers"]["errors"].append(router_error)
        errors.append(router_error)

    if not routers:
        message = "DATABASE_ROUTERS is empty while tenancy is enabled."
        result["routers"]["warnings"].append(message)
        warnings.append(message)
    else:
        tenant_sync_router = [r for r in resolved_routers if getattr(r.get("class"), "__name__", "") == "TenantSyncRouter"]
        if not tenant_sync_router:
            message = "django_tenants.routers.TenantSyncRouter (or project router) is not configured."
            result["routers"]["warnings"].append(message)
            warnings.append(message)
        else:
            # Detect duplicate router registration and placement.
            paths = [r["path"] for r in resolved_routers]
            if len(paths) != len(set(paths)):
                message = "Duplicate router registration detected in DATABASE_ROUTERS."
                result["routers"]["warnings"].append(message)
                warnings.append(message)
            if paths[0] != tenant_sync_router[0]["path"]:
                message = "Tenant router should be the first router when tenancy is enabled."
                result["routers"]["warnings"].append(message)
                warnings.append(message)

    # shared/tenant app readiness - now handled by _resolve_app_split() in new staging checks
    app_split = _resolve_app_split()
    if app_split.get("errors"):
        result["apps"]["errors"].extend(app_split["errors"])
        errors.extend(app_split["errors"])
    if app_split.get("warnings"):
        result["apps"]["warnings"].extend(app_split["warnings"])
        warnings.extend(app_split["warnings"])

    # physical schema / migration recorder readiness
    schema_state = validate_tenancy_schema_state(output=output)
    result["schema"] = schema_state
    if schema_state.get("errors"):
        errors.extend(schema_state["errors"])
    if schema_state.get("warnings"):
        warnings.extend(schema_state["warnings"])

    # tenant model readiness
    try:
        from .models import SchoolTenant, Domain

        tenant_model = django_apps.get_model("tenancy", "SchoolTenant")
        domain_model = django_apps.get_model("tenancy", "Domain")
        result["models"]["school_tenant"] = {
            "imported": True,
            "tenant_mixin": any(base.__name__ == "TenantMixin" for base in tenant_model.__mro__),
            "auto_create_schema": bool(getattr(tenant_model, "auto_create_schema", False)),
            "schema_name_ready": bool(getattr(tenant_model, "_meta", None) and tenant_model._meta.get_field("schema_name") is not None),
        }
        result["models"]["domain"] = {
            "imported": True,
            "domain_mixin": any(base.__name__ == "DomainMixin" for base in domain_model.__mro__),
        }
        if not result["models"]["school_tenant"]["tenant_mixin"]:
            message = "SchoolTenant does not inherit from TenantMixin."
            result["models"]["warnings"].append(message)
            warnings.append(message)
        if not result["models"]["school_tenant"]["auto_create_schema"]:
            message = "SchoolTenant.auto_create_schema is not enabled."
            result["models"]["warnings"].append(message)
            warnings.append(message)
        if not result["models"]["school_tenant"]["schema_name_ready"]:
            message = "SchoolTenant.schema_name field is missing or not ready."
            result["models"]["warnings"].append(message)
            warnings.append(message)
        if not result["models"]["domain"]["domain_mixin"]:
            message = "Domain does not inherit from DomainMixin."
            result["models"]["warnings"].append(message)
            warnings.append(message)
    except Exception as exc:
        message = f"Tenant model import/ready validation failed: {exc}"
        result["models"]["errors"].append(message)
        errors.append(message)

    # summary state
    result["ok"] = not errors
    result["blockers"] = list(errors)

    logger.info(
        "Tenancy validation result: enabled=%s ok=%s warnings=%d errors=%d",
        enabled,
        result["ok"],
        len(warnings),
        len(errors),
    )
    return result


def _resolve_app_split():
    """Validate SHARED_APPS and TENANT_APPS separation.
    
    Returns: dict with validation details, warnings, and errors.
    """
    shared = list(getattr(settings, "SHARED_APPS", []) or [])
    tenant_apps = list(getattr(settings, "TENANT_APPS", []) or [])
    result = {
        "shared": shared,
        "tenant": tenant_apps,
        "overlap": [],
        "shared_duplicates": [],
        "tenant_duplicates": [],
        "empty_shared": not shared,
        "empty_tenant": not tenant_apps,
        "errors": [],
        "warnings": [],
    }

    # Check for overlaps between shared and tenant apps
    overlap = set(shared) & set(tenant_apps)
    if overlap:
        result["overlap"] = sorted(overlap)
        error = f"Duplicate apps in SHARED_APPS and TENANT_APPS: {sorted(overlap)}"
        result["errors"].append(error)

    # Check for duplicates within each list
    shared_counts = {}
    for app in shared:
        shared_counts[app] = shared_counts.get(app, 0) + 1
    shared_dups = [app for app, count in shared_counts.items() if count > 1]
    if shared_dups:
        result["shared_duplicates"] = shared_dups
        error = f"Duplicate apps within SHARED_APPS: {shared_dups}"
        result["errors"].append(error)

    tenant_counts = {}
    for app in tenant_apps:
        tenant_counts[app] = tenant_counts.get(app, 0) + 1
    tenant_dups = [app for app, count in tenant_counts.items() if count > 1]
    if tenant_dups:
        result["tenant_duplicates"] = tenant_dups
        error = f"Duplicate apps within TENANT_APPS: {tenant_dups}"
        result["errors"].append(error)

    # Check for empty lists
    if not shared:
        warning = "SHARED_APPS is empty; shared global apps must be defined before activation."
        result["warnings"].append(warning)
    if not tenant_apps:
        warning = "TENANT_APPS is empty; tenant-specific apps must be defined before activation."
        result["warnings"].append(warning)

    # Check for critical app placements
    critical_shared = {
        "django_tenants",
        "apps.tenancy",
        "django.contrib.auth",
        "django.contrib.contenttypes",
    }
    missing_critical = critical_shared - set(shared)
    if missing_critical:
        warning = f"Critical shared apps missing from SHARED_APPS: {sorted(missing_critical)}"
        result["warnings"].append(warning)

    return result


def _check_router_readiness():
    """Check if router configuration is ready for activation.
    
    Returns: dict with router details, readiness state, and required fixes.
    """
    routers = list(getattr(settings, "DATABASE_ROUTERS", []) or [])
    result = {
        "routers": routers,
        "count": len(routers),
        "has_tenant_sync_router": False,
        "router_order": [],
        "available": False,
        "import_errors": [],
        "warnings": [],
    }

    if not routers:
        warning = "DATABASE_ROUTERS is empty; no tenant routing will occur."
        result["warnings"].append(warning)
        return result

    # Resolve and validate routers
    resolved_routers, router_errors = _resolve_router_paths()
    result["import_errors"] = router_errors
    result["router_order"] = [r["path"] for r in resolved_routers]

    # Check for TenantSyncRouter
    for router_path in routers:
        if "TenantSyncRouter" in router_path:
            result["has_tenant_sync_router"] = True
            if resolved_routers and resolved_routers[0]["path"] == router_path:
                result["available"] = True
            break

    if not result["has_tenant_sync_router"]:
        warning = "TenantSyncRouter is not configured in DATABASE_ROUTERS."
        result["warnings"].append(warning)
    elif not result["available"]:
        warning = "TenantSyncRouter is not the first router (routing order matters)."
        result["warnings"].append(warning)

    return result


def _check_middleware_readiness():
    """Check if middleware configuration is ready for tenant routing.
    
    Returns: dict with middleware validation details.
    """
    middleware = list(getattr(settings, "MIDDLEWARE", []))
    result = {
        "middleware": middleware,
        "has_tenant_main": TENANT_MAIN_MIDDLEWARE in middleware,
        "tenant_main_index": middleware.index(TENANT_MAIN_MIDDLEWARE) if TENANT_MAIN_MIDDLEWARE in middleware else -1,
        "has_auth": False,
        "auth_index": -1,
        "has_session": False,
        "session_index": -1,
        "warnings": [],
        "errors": [],
    }

    auth_mw = "django.contrib.auth.middleware.AuthenticationMiddleware"
    session_mw = "django.contrib.sessions.middleware.SessionMiddleware"

    if auth_mw in middleware:
        result["has_auth"] = True
        result["auth_index"] = middleware.index(auth_mw)

    if session_mw in middleware:
        result["has_session"] = True
        result["session_index"] = middleware.index(session_mw)

    if result["has_tenant_main"]:
        if result["has_auth"] and result["tenant_main_index"] > result["auth_index"]:
            error = "TenantMainMiddleware must appear before AuthenticationMiddleware."
            result["errors"].append(error)
        if result["has_session"] and result["session_index"] > result["tenant_main_index"]:
            warning = "SessionMiddleware should appear before TenantMainMiddleware for safe ordering."
            result["warnings"].append(warning)

    return result


def _check_jwt_authentication():
    """Check if JWT authentication is properly configured.
    
    Returns: dict with JWT auth configuration details.
    """
    rest_framework = getattr(settings, "REST_FRAMEWORK", {})
    auth_classes = rest_framework.get("DEFAULT_AUTHENTICATION_CLASSES", [])
    result = {
        "has_jwt": JWT_AUTH_CLASS in auth_classes,
        "auth_classes": auth_classes,
        "warnings": [],
    }

    if not result["has_jwt"]:
        warning = "JWTAuthentication is not configured; tenant routing may not work properly."
        result["warnings"].append(warning)

    return result


def _validate_staging_activation_readiness():
    """Comprehensive readiness check for staging-only router activation.
    
    This function checks all prerequisites before enabling DATABASE_ROUTERS
    without actually creating schemas or performing migrations.
    
    Returns: dict with complete staging readiness state.
    """
    enabled = getattr(settings, "MULTI_TENANCY_ENABLED", False)
    result = {
        "enabled": enabled,
        "staging_ready": False,
        "app_split": _resolve_app_split(),
        "router": _check_router_readiness(),
        "middleware": _check_middleware_readiness(),
        "jwt": _check_jwt_authentication(),
        "blockers": [],
        "warnings": [],
        "risks": [],
    }

    # Collect all blockers and warnings
    for error in result["app_split"]["errors"]:
        result["blockers"].append(f"[APP SPLIT] {error}")
    for warning in result["app_split"]["warnings"]:
        result["warnings"].append(f"[APP SPLIT] {warning}")

    for error in result["router"]["import_errors"]:
        result["blockers"].append(f"[ROUTER] {error}")
    for warning in result["router"]["warnings"]:
        result["warnings"].append(f"[ROUTER] {warning}")

    for error in result["middleware"]["errors"]:
        result["blockers"].append(f"[MIDDLEWARE] {error}")
    for warning in result["middleware"]["warnings"]:
        result["warnings"].append(f"[MIDDLEWARE] {warning}")

    for warning in result["jwt"]["warnings"]:
        result["warnings"].append(f"[JWT] {warning}")

    # Define risks when partial app split exists
    if result["app_split"]["empty_shared"] or result["app_split"]["empty_tenant"]:
        risk = "Incomplete SHARED_APPS/TENANT_APPS split may cause unexpected app behavior when router is enabled."
        result["risks"].append(risk)

    if result["router"]["import_errors"]:
        risk = "Router import errors detected; router activation will fail at runtime."
        result["risks"].append(risk)

    if result["middleware"]["errors"]:
        risk = "Middleware configuration errors detected; tenant resolution will fail."
        result["risks"].append(risk)

    # Mark staging ready only if no blockers exist
    result["staging_ready"] = len(result["blockers"]) == 0

    return result


    # tenant model readiness
    try:
        from .models import SchoolTenant, Domain

        tenant_model = django_apps.get_model("tenancy", "SchoolTenant")
        domain_model = django_apps.get_model("tenancy", "Domain")
        result["models"]["school_tenant"] = {
            "imported": True,
            "tenant_mixin": any(base.__name__ == "TenantMixin" for base in tenant_model.__mro__),
            "auto_create_schema": bool(getattr(tenant_model, "auto_create_schema", False)),
            "schema_name_ready": bool(getattr(tenant_model, "_meta", None) and tenant_model._meta.get_field("schema_name") is not None),
        }
        result["models"]["domain"] = {
            "imported": True,
            "domain_mixin": any(base.__name__ == "DomainMixin" for base in domain_model.__mro__),
        }
        if not result["models"]["school_tenant"]["tenant_mixin"]:
            message = "SchoolTenant does not inherit from TenantMixin."
            result["models"]["warnings"].append(message)
            warnings.append(message)
        if not result["models"]["school_tenant"]["auto_create_schema"]:
            message = "SchoolTenant.auto_create_schema is not enabled."
            result["models"]["warnings"].append(message)
            warnings.append(message)
        if not result["models"]["school_tenant"]["schema_name_ready"]:
            message = "SchoolTenant.schema_name field is missing or not ready."
            result["models"]["warnings"].append(message)
            warnings.append(message)
        if not result["models"]["domain"]["domain_mixin"]:
            message = "Domain does not inherit from DomainMixin."
            result["models"]["warnings"].append(message)
            warnings.append(message)
    except Exception as exc:
        message = f"Tenant model import/ready validation failed: {exc}"
        result["models"]["errors"].append(message)
        errors.append(message)

    # summary state
    result["ok"] = not errors
    result["blockers"] = list(errors)

    logger.info(
        "Tenancy validation result: enabled=%s ok=%s warnings=%d errors=%d",
        enabled,
        result["ok"],
        len(warnings),
        len(errors),
    )
    return result

def provision_test_tenant(output=None):
    """Provision a minimal test tenant using the SchoolTenant model.

    This is a non-destructive helper that creates a SchoolTenant row and
    attempts to call django-tenants provisioning utilities when available.
    """
    if not getattr(settings, "MULTI_TENANCY_ENABLED", False):
        msg = "MULTI_TENANCY_ENABLED is False — provisioning skipped."
        if output:
            output.write(msg)
        logger.info(msg)
        return

    try:
        from .models import SchoolTenant
        from django_tenants.utils import schema_context
        from django.db import connection
    except Exception as exc:
        raise RuntimeError("django-tenants not available or misconfigured: %s" % exc)

    # Create a test tenant record (non-destructive if duplicates exist)
    tenant_id = "TNT_TEST_0001"
    schema_name = "testschool"
    tenant, created = SchoolTenant.objects.get_or_create(
        tenant_id=tenant_id,
        defaults={
            "name": "Test School",
            "short_code": "TS",
            "schema_name": schema_name,
            "status": "provisioning",
        },
    )
    if output:
        output.write(f"Tenant {'created' if created else 'exists'}: {tenant}\n")

    # Attempt to create schema using django-tenants management routines
    try:
        # django-tenants will create a schema when `save()` is called on the
        # tenant model if `auto_create_schema` is True and TenantMixin is active.
        tenant.save()
        if output:
            output.write(f"Tenant saved (schema creation attempted) for {tenant.schema_name}\n")

        # Verify schema switch
        with schema_context(tenant.schema_name):
            with connection.cursor() as cursor:
                cursor.execute("SELECT current_schema();")
                current = cursor.fetchone()
                if output:
                    output.write(f"Current schema inside context: {current}\n")
    except Exception as exc:
        # Non-fatal: surface error clearly
        raise RuntimeError(f"Provisioning attempt failed: {exc}")

    if output:
        output.write("Test tenant provisioning completed (check logs for details).\n")
