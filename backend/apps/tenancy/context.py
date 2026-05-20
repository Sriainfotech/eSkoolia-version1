"""Tenant context helpers for request-level schema switching.

Provides safe, async-compatible utilities for accessing current tenant/schema/subdomain.
All functions respect the MULTI_TENANCY_ENABLED feature flag.
"""
import logging
from contextvars import ContextVar
from typing import Optional

from django.conf import settings

from .models import SchoolTenant

logger = logging.getLogger(__name__)

# Thread-safe context variables for storing tenant/schema in async contexts
_current_tenant_var: ContextVar[Optional[SchoolTenant]] = ContextVar(
    "current_tenant", default=None
)
_current_schema_var: ContextVar[Optional[str]] = ContextVar("current_schema", default=None)
_current_subdomain_var: ContextVar[Optional[str]] = ContextVar(
    "current_subdomain", default=None
)


def is_multi_tenancy_enabled() -> bool:
    """Check if multi-tenancy feature is enabled.
    
    Returns:
        bool: True if MULTI_TENANCY_ENABLED=true, False otherwise
    """
    return getattr(settings, "MULTI_TENANCY_ENABLED", False)


def set_current_tenant(
    tenant: Optional[SchoolTenant], schema_name: Optional[str] = None, subdomain: Optional[str] = None
) -> None:
    """Set the current tenant context for this request.
    
    This is typically called by TenantMainMiddleware after resolving the tenant.
    
    Args:
        tenant: SchoolTenant instance or None for monolithic mode
        schema_name: PostgreSQL schema name (e.g., "school_greenwood")
        subdomain: Subdomain used to resolve tenant (e.g., "greenwood")
    """
    _current_tenant_var.set(tenant)
    _current_schema_var.set(schema_name or (tenant.schema_name if tenant else None))
    _current_subdomain_var.set(subdomain)


def get_current_tenant() -> Optional[SchoolTenant]:
    """Get the current tenant for this request.
    
    Returns:
        SchoolTenant instance if tenant mode active, None for monolithic mode
    """
    if not is_multi_tenancy_enabled():
        return None
    return _current_tenant_var.get()


def get_current_schema() -> Optional[str]:
    """Get the active PostgreSQL schema name.
    
    Returns:
        Schema name (e.g., "school_greenwood") if tenant mode, None for monolithic mode
    """
    if not is_multi_tenancy_enabled():
        return None
    return _current_schema_var.get()


def get_current_subdomain() -> Optional[str]:
    """Get the subdomain used to resolve current tenant.
    
    Returns:
        Subdomain (e.g., "greenwood") if tenant mode, None for monolithic mode
    """
    if not is_multi_tenancy_enabled():
        return None
    return _current_subdomain_var.get()


def get_current_tenant_id() -> Optional[str]:
    """Get the current tenant ID (TNT_XXXXXXX).
    
    Returns:
        Tenant ID string or None
    """
    tenant = get_current_tenant()
    return tenant.tenant_id if tenant else None


def is_tenant_mode() -> bool:
    """Check if request is in tenant mode (not monolithic).
    
    Returns:
        True if multi-tenancy enabled AND tenant is set, False otherwise
    """
    return is_multi_tenancy_enabled() and get_current_tenant() is not None


def is_monolithic_mode() -> bool:
    """Check if request is in monolithic mode (no tenant isolation).
    
    Returns:
        True if multi-tenancy disabled OR no tenant is set
    """
    return not is_tenant_mode()


def clear_tenant_context() -> None:
    """Clear tenant context (typically at end of request).
    
    Safe to call even if context is not set.
    """
    _current_tenant_var.set(None)
    _current_schema_var.set(None)
    _current_subdomain_var.set(None)


def with_tenant_context(tenant: Optional[SchoolTenant], schema_name: Optional[str] = None, subdomain: Optional[str] = None):
    """Context manager for temporarily setting tenant context.
    
    Useful for running code inside a specific tenant schema context.
    
    Example:
        with with_tenant_context(tenant, "school_greenwood"):
            user = User.objects.get(id=user_id)  # queries school_greenwood schema
    
    Args:
        tenant: SchoolTenant instance
        schema_name: PostgreSQL schema name
        subdomain: Subdomain
    
    Yields:
        None
    """
    from contextlib import contextmanager
    
    @contextmanager
    def _context():
        old_tenant = get_current_tenant()
        old_schema = get_current_schema()
        old_subdomain = get_current_subdomain()
        
        try:
            set_current_tenant(tenant, schema_name, subdomain)
            yield
        finally:
            set_current_tenant(old_tenant, old_schema, old_subdomain)
    
    return _context()


def log_tenant_context(message: str, level=logging.INFO) -> None:
    """Log a message with current tenant context information.
    
    Args:
        message: Log message
        level: Log level (default INFO)
    """
    tenant_id = get_current_tenant_id() or "monolithic"
    schema = get_current_schema() or "public"
    subdomain = get_current_subdomain() or "none"
    
    logger.log(
        level,
        f"{message} [tenant={tenant_id} schema={schema} subdomain={subdomain}]"
    )
