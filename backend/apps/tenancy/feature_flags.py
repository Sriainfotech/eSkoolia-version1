"""Tenant-aware feature flag evaluation.

Provides safe, cached feature evaluation with schema awareness.
All operations are tenant-safe and async-compatible.
"""

from typing import Dict, Optional, Any, List
from django.core.cache import cache
from django.conf import settings
from apps.tenancy.context import (
    get_current_tenant,
    get_current_tenant_id,
    is_tenant_mode,
    is_monolithic_mode,
)
from apps.tenancy.models import TenantPlan, TenantFeature, TenantFeatureFlag


# Default feature definitions (fallback)
DEFAULT_FEATURES = {
    "trial": {
        "attendance_enabled": False,
        "fees_enabled": False,
        "library_enabled": False,
        "transport_enabled": False,
        "inventory_enabled": False,
        "hr_enabled": False,
        "parent_portal_enabled": False,
        "analytics_enabled": False,
        "api_access_enabled": False,
        "ai_features_enabled": False,
    },
    "premium": {
        "attendance_enabled": True,
        "fees_enabled": True,
        "library_enabled": True,
        "transport_enabled": False,
        "inventory_enabled": False,
        "hr_enabled": False,
        "parent_portal_enabled": True,
        "analytics_enabled": True,
        "api_access_enabled": True,
        "ai_features_enabled": False,
    },
    "enterprise": {
        "attendance_enabled": True,
        "fees_enabled": True,
        "library_enabled": True,
        "transport_enabled": True,
        "inventory_enabled": True,
        "hr_enabled": True,
        "parent_portal_enabled": True,
        "analytics_enabled": True,
        "api_access_enabled": True,
        "ai_features_enabled": True,
    },
}


def get_tenant_plan(tenant_id: Optional[str] = None) -> Optional[str]:
    """Get plan name for tenant.
    
    Returns: "trial", "premium", "enterprise", or None if not found
    """
    if not is_tenant_mode() and tenant_id is None:
        return None
    
    if tenant_id is None:
        tenant = get_current_tenant()
        if not tenant:
            return None
        tenant_id = tenant.tenant_id
    
    # Try cache first (schema-aware key)
    cache_key = f"tenant:{tenant_id}:plan"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    # Query database
    try:
        from apps.tenancy.models import SchoolTenant
        tenant = SchoolTenant.objects.using("default").get(tenant_id=tenant_id)
        plan = tenant.plan or "trial"
        
        # Cache for 1 hour
        cache.set(cache_key, plan, 3600)
        return plan
    except Exception:
        return None


def get_plan_features(plan: str) -> Dict[str, bool]:
    """Get all features for a plan.
    
    Returns: Dict of feature_id -> enabled (bool)
    """
    if not plan:
        return {}
    
    # Try cache
    cache_key = f"plan:{plan}:features"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    # Query database
    try:
        plan_obj = TenantPlan.objects.using("default").get(
            plan_type=plan.lower()
        )
        features = plan_obj.features or {}
        
        # Cache for 24 hours (plans change rarely)
        cache.set(cache_key, features, 86400)
        return features
    except Exception:
        pass
    
    # Fallback to defaults
    features = DEFAULT_FEATURES.get(plan.lower(), {})
    cache.set(cache_key, features, 3600)
    return features


def is_feature_enabled(feature_id: str, tenant_id: Optional[str] = None) -> bool:
    """Check if feature is enabled for tenant.
    
    Evaluation order:
    1. Tenant-specific override (if set)
    2. Plan-based feature (if configured)
    3. Feature default (if defined)
    4. False (default)
    
    Returns: True if enabled, False otherwise
    """
    if not is_tenant_mode() and tenant_id is None:
        # Monolithic mode - all features available
        return True
    
    if tenant_id is None:
        tenant = get_current_tenant()
        if not tenant:
            return False
        tenant_id = tenant.tenant_id
    
    # Try cache (schema-aware)
    cache_key = f"tenant:{tenant_id}:feature:{feature_id}"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    enabled = False
    
    try:
        # Check for tenant-specific override
        flag = TenantFeatureFlag.objects.using("default").filter(
            tenant__tenant_id=tenant_id,
            feature__feature_id=feature_id,
        ).first()
        
        if flag and flag.is_enabled is not None:
            # Explicit override
            enabled = flag.is_enabled
        else:
            # Check plan-based features
            plan = get_tenant_plan(tenant_id)
            plan_features = get_plan_features(plan or "trial")
            enabled = plan_features.get(feature_id, False)
        
    except Exception:
        enabled = False
    
    # Cache for 1 hour
    cache.set(cache_key, enabled, 3600)
    return enabled


def get_tenant_features(tenant_id: Optional[str] = None) -> Dict[str, Any]:
    """Get all features for tenant with current state.
    
    Returns: Dict of feature_id -> {
        "enabled": bool,
        "category": str,
        "description": str,
        "override": bool (True if explicitly overridden),
    }
    """
    if tenant_id is None:
        tenant = get_current_tenant()
        if not tenant:
            return {}
        tenant_id = tenant.tenant_id
    
    # Try cache
    cache_key = f"tenant:{tenant_id}:all_features"
    cached = cache.get(cache_key)
    if cached is not None:
        return cached
    
    result = {}
    
    try:
        # Get all features
        features = TenantFeature.objects.using("default").all()
        
        # Get overrides for this tenant
        overrides = TenantFeatureFlag.objects.using("default").filter(
            tenant__tenant_id=tenant_id,
        ).select_related("feature")
        
        override_map = {f.feature.feature_id: f for f in overrides}
        
        # Get plan features
        plan = get_tenant_plan(tenant_id)
        plan_features = get_plan_features(plan or "trial")
        
        # Build result
        for feature in features:
            fid = feature.feature_id
            
            # Check override
            override_obj = override_map.get(fid)
            if override_obj and override_obj.is_enabled is not None:
                enabled = override_obj.is_enabled
                is_override = True
            else:
                enabled = plan_features.get(fid, False)
                is_override = False
            
            result[fid] = {
                "enabled": enabled,
                "category": feature.category,
                "description": feature.description,
                "override": is_override,
            }
        
        # Cache for 1 hour
        cache.set(cache_key, result, 3600)
        
    except Exception:
        result = {}
    
    return result


def clear_tenant_feature_cache(tenant_id: str) -> None:
    """Clear all feature caches for a tenant.
    
    Call this after changing tenant plans or features.
    """
    cache.delete(f"tenant:{tenant_id}:plan")
    cache.delete(f"tenant:{tenant_id}:all_features")
    
    # Clear per-feature caches (approximate)
    # In production, use cache versioning for granular control
    cache_key_prefix = f"tenant:{tenant_id}:feature:"
    # Django's cache doesn't have direct prefix deletion;
    # for Redis, you'd use: cache.delete_pattern(f"{cache_key_prefix}*")
    # For now, we rely on TTL


def get_feature_info(feature_id: str) -> Optional[Dict[str, Any]]:
    """Get feature metadata.
    
    Returns: Feature details or None if not found
    """
    try:
        feature = TenantFeature.objects.using("default").get(
            feature_id=feature_id
        )
        return {
            "id": feature.feature_id,
            "name": feature.name,
            "category": feature.category,
            "description": feature.description,
            "enabled_by_default": feature.enabled_by_default,
            "depends_on": feature.depends_on,
        }
    except Exception:
        return None


def get_all_features() -> List[Dict[str, Any]]:
    """Get all available features (for admin).
    
    Returns: List of feature dictionaries
    """
    try:
        features = TenantFeature.objects.using("default").all()
        return [
            {
                "id": f.feature_id,
                "name": f.name,
                "category": f.category,
                "description": f.description,
            }
            for f in features
        ]
    except Exception:
        return []


def get_all_plans() -> List[Dict[str, Any]]:
    """Get all plan definitions (for admin).
    
    Returns: List of plan dictionaries
    """
    try:
        plans = TenantPlan.objects.using("default").all()
        return [
            {
                "id": p.plan_id,
                "type": p.plan_type,
                "name": p.name,
                "description": p.description,
                "rate_limit_per_minute": p.api_rate_limit_per_minute,
                "rate_limit_per_hour": p.api_rate_limit_per_hour,
            }
            for p in plans
        ]
    except Exception:
        return []
