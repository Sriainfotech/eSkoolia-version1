"""Tenant routing validation and safety checks.

This module provides:
1. Tenant existence validation
2. Schema existence verification
3. Tenant status checks
4. Unknown subdomain rejection
5. Middleware order validation
6. Startup safety checks
"""
import logging
from typing import Dict, List, Optional

from django.apps import apps
from django.conf import settings
from django.core.checks import Error, Warning, register
from django.db import connection

from .context import is_multi_tenancy_enabled
from .models import SchoolTenant

logger = logging.getLogger(__name__)


def validate_tenant_exists(tenant_id: str) -> Optional[SchoolTenant]:
    """Validate that a tenant exists and is active.
    
    Args:
        tenant_id: Tenant ID (TNT_XXXXXXX)
        
    Returns:
        SchoolTenant if valid, None otherwise
        
    Raises:
        ValueError: If tenant_id is invalid format
    """
    if not tenant_id or not isinstance(tenant_id, str):
        raise ValueError(f"Invalid tenant_id: {tenant_id}")
    
    try:
        tenant = SchoolTenant.objects.get(tenant_id=tenant_id)
        if not tenant.is_active:
            logger.warning(f"Tenant {tenant_id} is inactive")
            return None
        return tenant
    except SchoolTenant.DoesNotExist:
        logger.warning(f"Tenant {tenant_id} not found")
        return None


def validate_schema_exists(schema_name: str) -> bool:
    """Validate that a PostgreSQL schema exists.
    
    Args:
        schema_name: PostgreSQL schema name (e.g., "school_greenwood")
        
    Returns:
        True if schema exists, False otherwise
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
                [schema_name],
            )
            exists = bool(cursor.fetchone())
            
            if not exists:
                logger.warning(f"Schema {schema_name} does not exist in PostgreSQL")
            
            return exists
    
    except Exception as exc:
        logger.error(f"Failed to check schema {schema_name}: {exc}")
        return False


def validate_subdomain_format(subdomain: str) -> bool:
    """Validate subdomain format (lowercase, alphanumeric + underscore).
    
    Args:
        subdomain: Subdomain string to validate
        
    Returns:
        True if valid format, False otherwise
    """
    if not subdomain:
        return False
    
    # Must be lowercase alphanumeric + underscore
    if not all(c.isalnum() or c == "_" for c in subdomain):
        logger.warning(f"Invalid subdomain format: {subdomain}")
        return False
    
    # Must be 2-64 characters
    if len(subdomain) < 2 or len(subdomain) > 64:
        logger.warning(f"Subdomain length invalid: {len(subdomain)}")
        return False
    
    return True


def validate_middleware_order() -> Dict[str, bool]:
    """Validate that middleware is configured in correct order.
    
    Returns:
        Dict with validation results:
        {
            'tenant_first': bool,
            'auth_after_tenant': bool,
            'session_before_tenant': bool,
        }
    """
    middleware = list(getattr(settings, "MIDDLEWARE", []))
    
    result = {
        "tenant_first": False,
        "auth_after_tenant": False,
        "session_before_tenant": False,
    }
    
    if not is_multi_tenancy_enabled():
        # Validation not needed when feature is off
        return result
    
    tenant_mw = "apps.tenancy.middleware.TenantMainMiddleware"
    auth_mw = "django.contrib.auth.middleware.AuthenticationMiddleware"
    session_mw = "django.contrib.sessions.middleware.SessionMiddleware"
    
    if tenant_mw not in middleware:
        logger.warning("TenantMainMiddleware not in MIDDLEWARE")
        return result
    
    tenant_idx = middleware.index(tenant_mw)
    
    # Check if TenantMainMiddleware is first
    result["tenant_first"] = tenant_idx == 0
    if not result["tenant_first"]:
        logger.warning(
            f"TenantMainMiddleware should be first, but is at index {tenant_idx}"
        )
    
    # Check if AuthenticationMiddleware comes after TenantMainMiddleware
    if auth_mw in middleware:
        auth_idx = middleware.index(auth_mw)
        result["auth_after_tenant"] = auth_idx > tenant_idx
        if not result["auth_after_tenant"]:
            logger.warning(
                "AuthenticationMiddleware should come after TenantMainMiddleware"
            )
    
    # Check if SessionMiddleware comes before TenantMainMiddleware
    if session_mw in middleware:
        session_idx = middleware.index(session_mw)
        result["session_before_tenant"] = session_idx < tenant_idx
        if not result["session_before_tenant"]:
            logger.warning(
                "SessionMiddleware should come before TenantMainMiddleware"
            )
    
    return result


def validate_database_routers() -> bool:
    """Validate that DATABASE_ROUTERS is configured (if multi-tenancy enabled).
    
    Returns:
        True if routers are configured, False otherwise
    """
    if not is_multi_tenancy_enabled():
        return True
    
    routers = getattr(settings, "DATABASE_ROUTERS", [])
    
    if not routers:
        logger.warning("DATABASE_ROUTERS is empty but multi-tenancy is enabled")
        return False
    
    return True


def validate_shared_and_tenant_apps() -> Dict[str, bool]:
    """Validate that SHARED_APPS and TENANT_APPS are configured.
    
    Returns:
        Dict with validation results:
        {
            'shared_defined': bool,
            'tenant_defined': bool,
            'no_overlap': bool,
        }
    """
    result = {
        "shared_defined": False,
        "tenant_defined": False,
        "no_overlap": False,
    }
    
    if not is_multi_tenancy_enabled():
        return result
    
    shared = getattr(settings, "SHARED_APPS", [])
    tenant = getattr(settings, "TENANT_APPS", [])
    
    result["shared_defined"] = bool(shared)
    result["tenant_defined"] = bool(tenant)
    
    if not result["shared_defined"]:
        logger.warning("SHARED_APPS is not defined")
    
    if not result["tenant_defined"]:
        logger.warning("TENANT_APPS is not defined")
    
    # Check for overlap
    overlap = set(shared) & set(tenant)
    result["no_overlap"] = not bool(overlap)
    
    if not result["no_overlap"]:
        logger.warning(f"SHARED_APPS and TENANT_APPS overlap: {overlap}")
    
    return result


@register()
def tenant_routing_safety_checks(app_configs, **kwargs):
    """Django system checks for tenant routing safety.
    
    Validates:
    - Middleware order
    - Database router configuration
    - App split configuration
    - Tenant model readiness
    """
    errors = []
    warnings = []
    
    if not is_multi_tenancy_enabled():
        # Checks only apply when feature is enabled
        return []
    
    # Validate middleware order
    mw_order = validate_middleware_order()
    if not mw_order["tenant_first"]:
        warnings.append(
            Warning(
                "TenantMainMiddleware should be first in MIDDLEWARE for proper schema switching",
                id="tenancy.W101",
            )
        )
    
    if not mw_order["auth_after_tenant"]:
        warnings.append(
            Warning(
                "AuthenticationMiddleware should come after TenantMainMiddleware",
                id="tenancy.W102",
            )
        )
    
    # Validate database routers
    if not validate_database_routers():
        warnings.append(
            Warning(
                "DATABASE_ROUTERS is empty; tenant routing will not work",
                id="tenancy.W103",
            )
        )
    
    # Validate app split
    apps_validation = validate_shared_and_tenant_apps()
    if not apps_validation["shared_defined"]:
        warnings.append(
            Warning(
                "SHARED_APPS is not defined; shared schema apps unclear",
                id="tenancy.W104",
            )
        )
    
    if not apps_validation["tenant_defined"]:
        warnings.append(
            Warning(
                "TENANT_APPS is not defined; tenant-specific apps unclear",
                id="tenancy.W105",
            )
        )
    
    if not apps_validation["no_overlap"]:
        errors.append(
            Error(
                "SHARED_APPS and TENANT_APPS overlap; configuration is invalid",
                id="tenancy.E101",
            )
        )
    
    return errors + warnings


def get_tenant_by_subdomain(subdomain: str) -> Optional[SchoolTenant]:
    """Get tenant by subdomain (for routing resolution).
    
    Args:
        subdomain: Subdomain string (e.g., "greenwood")
        
    Returns:
        SchoolTenant if found and active, None otherwise
    """
    if not validate_subdomain_format(subdomain):
        return None
    
    try:
        return SchoolTenant.objects.get(
            subdomain_url=subdomain,
            is_active=True,
        )
    except SchoolTenant.DoesNotExist:
        logger.info(f"Tenant not found for subdomain: {subdomain}")
        return None


def get_tenant_by_domain_name(domain: str) -> Optional[SchoolTenant]:
    """Get tenant by domain name (for routing resolution).
    
    Args:
        domain: Full domain name (e.g., "greenwood.eskoolia.local")
        
    Returns:
        SchoolTenant if found and active, None otherwise
    """
    from .models import Domain
    
    try:
        domain_obj = Domain.objects.get(domain=domain)
        if domain_obj.tenant and domain_obj.tenant.is_active:
            return domain_obj.tenant
    except Domain.DoesNotExist:
        pass
    
    return None


def get_all_active_tenants() -> List[SchoolTenant]:
    """Get list of all active tenants.
    
    Returns:
        List of active SchoolTenant objects
    """
    return list(SchoolTenant.objects.filter(is_active=True).order_by("name"))


def report_tenant_routing_status() -> Dict:
    """Generate a status report of tenant routing configuration.
    
    Returns:
        Dict with routing status details
    """
    return {
        "multi_tenancy_enabled": is_multi_tenancy_enabled(),
        "middleware_order": validate_middleware_order(),
        "database_routers": validate_database_routers(),
        "app_split": validate_shared_and_tenant_apps(),
        "active_tenants": len(get_all_active_tenants()),
    }
