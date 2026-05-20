"""Tenant-aware helper utilities.

Convenience functions for common tenant checks and operations.
Used in views, services, signals, and middleware.
"""

from typing import Optional, Tuple, Dict, Any
from django.utils import timezone
from apps.tenancy.context import (
    get_current_tenant,
    get_current_tenant_id,
    get_current_schema,
    is_tenant_mode,
)
from apps.tenancy.feature_flags import (
    is_feature_enabled,
    get_tenant_plan,
    get_tenant_features,
)
from apps.tenancy.models import SchoolTenant


def tenant_has_feature(feature_id: str, tenant_id: Optional[str] = None) -> bool:
    """Check if tenant has a feature enabled.
    
    Args:
        feature_id: Feature identifier (e.g., "attendance_enabled")
        tenant_id: Optional tenant_id; if None, uses current tenant context
    
    Returns:
        True if feature is enabled, False otherwise
    
    Example:
        if tenant_has_feature("library_enabled"):
            return LibraryViewSet.as_view()
    """
    return is_feature_enabled(feature_id, tenant_id)


def tenant_is_active(tenant_id: Optional[str] = None) -> bool:
    """Check if tenant is active.
    
    Args:
        tenant_id: Optional tenant_id; if None, uses current tenant context
    
    Returns:
        True if tenant exists and status is 'active'
    """
    if tenant_id is None:
        tenant = get_current_tenant()
        if not tenant:
            return False
        tenant_id = tenant.tenant_id
    
    try:
        tenant = SchoolTenant.objects.using("default").get(tenant_id=tenant_id)
        return tenant.status == "active"
    except Exception:
        return False


def tenant_is_suspended(tenant_id: Optional[str] = None) -> bool:
    """Check if tenant is suspended.
    
    Args:
        tenant_id: Optional tenant_id; if None, uses current tenant context
    
    Returns:
        True if tenant is suspended
    """
    if tenant_id is None:
        tenant = get_current_tenant()
        if not tenant:
            return False
        tenant_id = tenant.tenant_id
    
    try:
        tenant = SchoolTenant.objects.using("default").get(tenant_id=tenant_id)
        return tenant.status == "suspended"
    except Exception:
        return False


def tenant_api_allowed(tenant_id: Optional[str] = None) -> bool:
    """Check if tenant has API access enabled.
    
    Args:
        tenant_id: Optional tenant_id; if None, uses current tenant context
    
    Returns:
        True if api_access is enabled
    """
    if tenant_id is None:
        tenant = get_current_tenant()
        if not tenant:
            return False
        tenant_id = tenant.tenant_id
    
    try:
        tenant = SchoolTenant.objects.using("default").get(tenant_id=tenant_id)
        return tenant.api_access
    except Exception:
        return False


def tenant_plan() -> Optional[str]:
    """Get current tenant's plan.
    
    Returns:
        Plan name ("trial", "premium", "enterprise") or None
    """
    return get_tenant_plan()


def tenant_rate_limit() -> Dict[str, int]:
    """Get rate limits for current tenant plan.
    
    Returns:
        Dict with keys: per_minute, per_hour
    
    Example:
        limits = tenant_rate_limit()
        print(f"Limit: {limits['per_minute']}/minute")
    """
    from apps.tenancy.rate_limiting import TenantPlanBasedThrottle
    
    throttle = TenantPlanBasedThrottle()
    plan_limits = throttle.get_plan_limits()
    return {
        "per_minute": plan_limits.get("per_minute", 100),
        "per_hour": plan_limits.get("per_hour", 1000),
    }


def tenant_is_trial(tenant_id: Optional[str] = None) -> bool:
    """Check if tenant is on trial plan.
    
    Args:
        tenant_id: Optional tenant_id; if None, uses current tenant context
    
    Returns:
        True if plan is "trial"
    """
    plan = get_tenant_plan(tenant_id)
    return plan == "trial"


def tenant_trial_expired(tenant_id: Optional[str] = None) -> bool:
    """Check if trial period has expired.
    
    Trial valid for 30 days from provisioning.
    
    Args:
        tenant_id: Optional tenant_id; if None, uses current tenant context
    
    Returns:
        True if trial expired
    """
    if tenant_id is None:
        tenant = get_current_tenant()
        if not tenant:
            return False
        tenant_id = tenant.tenant_id
    
    try:
        tenant = SchoolTenant.objects.using("default").get(tenant_id=tenant_id)
        
        if tenant.plan != "trial":
            return False
        
        if not tenant.provisioned_at:
            return True  # No provisioning date = expired
        
        age_days = (timezone.now() - tenant.provisioned_at).days
        return age_days > 30
    
    except Exception:
        return False


def tenant_context() -> Dict[str, Any]:
    """Get comprehensive tenant context.
    
    Returns:
        Dict with:
        - tenant_id: Current tenant ID
        - tenant_name: Current tenant name
        - schema_name: Current schema name
        - plan: Current tenant plan
        - status: Current tenant status
        - features: Available features
        - is_active: Whether tenant is active
        - is_suspended: Whether tenant is suspended
        - api_allowed: Whether API access is allowed
    
    Example:
        context = tenant_context()
        if context:
            print(f"Tenant: {context['tenant_name']}")
            print(f"Plan: {context['plan']}")
    """
    if not is_tenant_mode():
        return {}
    
    tenant = get_current_tenant()
    if not tenant:
        return {}
    
    return {
        "tenant_id": tenant.tenant_id,
        "tenant_name": tenant.name,
        "schema_name": get_current_schema(),
        "plan": tenant.plan,
        "status": tenant.status,
        "features": get_tenant_features(tenant.tenant_id),
        "is_active": tenant.status == "active",
        "is_suspended": tenant.status == "suspended",
        "api_allowed": tenant.api_access,
    }


def can_upgrade_plan(tenant_id: Optional[str] = None) -> Tuple[bool, Optional[str]]:
    """Check if tenant can upgrade their plan.
    
    Args:
        tenant_id: Optional tenant_id; if None, uses current tenant context
    
    Returns:
        Tuple of (can_upgrade, next_plan)
    
    Example:
        can_upgrade, next_plan = can_upgrade_plan()
        if can_upgrade:
            print(f"You can upgrade to {next_plan}")
    """
    plan = get_tenant_plan(tenant_id)
    
    upgrade_path = {
        "trial": "premium",
        "premium": "enterprise",
        "enterprise": None,
    }
    
    next_plan = upgrade_path.get(plan)
    return next_plan is not None, next_plan


def get_tenant_usage_stats(tenant_id: Optional[str] = None) -> Dict[str, Any]:
    """Get usage statistics for tenant (for quota checking).
    
    Args:
        tenant_id: Optional tenant_id; if None, uses current tenant context
    
    Returns:
        Dict with usage metrics
    
    Future implementation will include:
        - active_users
        - api_calls
        - storage_used
        - data_records
    """
    if tenant_id is None:
        tenant = get_current_tenant()
        if not tenant:
            return {}
        tenant_id = tenant.tenant_id
    
    # Placeholder - to be implemented with actual metrics
    return {
        "tenant_id": tenant_id,
        "active_users": 0,
        "api_calls_today": 0,
        "storage_used_mb": 0,
        "data_records": 0,
    }


def tenant_warning_status(tenant_id: Optional[str] = None) -> Optional[str]:
    """Get warning status for tenant.
    
    Possible warnings:
    - "trial_expiring": Trial expires in < 7 days
    - "trial_expired": Trial period has expired
    - "rate_limit_high": Near rate limit threshold
    - "storage_full": Storage quota nearly full
    
    Args:
        tenant_id: Optional tenant_id; if None, uses current tenant context
    
    Returns:
        Warning code or None if no warnings
    """
    if tenant_id is None:
        tenant = get_current_tenant()
        if not tenant:
            return None
        tenant_id = tenant.tenant_id
    
    try:
        tenant = SchoolTenant.objects.using("default").get(tenant_id=tenant_id)
        
        # Check trial expiration
        if tenant.plan == "trial" and tenant.provisioned_at:
            age_days = (timezone.now() - tenant.provisioned_at).days
            if age_days > 30:
                return "trial_expired"
            elif age_days > 23:  # Within 7 days of expiration
                return "trial_expiring"
    
    except Exception:
        pass
    
    return None


def require_tenant_context(func):
    """Decorator to require tenant context.
    
    Raises PermissionDenied if no tenant context available.
    
    Usage:
        @require_tenant_context
        def my_service_function(request):
            tenant = get_current_tenant()
            # ...
    """
    def wrapper(*args, **kwargs):
        if is_tenant_mode():
            if not get_current_tenant():
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied("Tenant context required.")
        
        return func(*args, **kwargs)
    
    return wrapper


def require_feature(feature_id: str):
    """Decorator to require specific feature.
    
    Raises PermissionDenied if feature not enabled.
    
    Usage:
        @require_feature("library_enabled")
        def library_operations(request):
            # ...
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            if not is_feature_enabled(feature_id):
                from rest_framework.exceptions import PermissionDenied
                raise PermissionDenied(
                    f"Feature '{feature_id}' is not available for your plan."
                )
            
            return func(*args, **kwargs)
        
        return wrapper
    
    return decorator


def require_not_suspended():
    """Decorator to require tenant not suspended.
    
    Raises PermissionDenied if tenant is suspended.
    
    Usage:
        @require_not_suspended()
        def modifying_operation(request):
            # ...
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            if is_tenant_mode():
                tenant = get_current_tenant()
                if tenant and tenant.status == "suspended":
                    from rest_framework.exceptions import PermissionDenied
                    raise PermissionDenied(
                        "Cannot perform action while account is suspended."
                    )
            
            return func(*args, **kwargs)
        
        return wrapper
    
    return decorator
