"""Tenant feature audit logging.

Tracks all feature and plan changes, rate limit violations, and tenant state changes.
All logs stored in PUBLIC schema for cross-tenant audit trail visibility.
"""

from typing import Optional, Dict, Any
from django.utils import timezone
from apps.tenancy.models import TenantFeatureAudit
from apps.tenancy.context import get_current_tenant


def log_feature_changed(
    tenant_id: str,
    feature_id: str,
    old_value: Any,
    new_value: Any,
    action: str,
    actor_user_id: Optional[int] = None,
    actor_username: Optional[str] = None,
    actor_ip: Optional[str] = None,
    reason: Optional[str] = None,
) -> TenantFeatureAudit:
    """Log feature enable/disable event.
    
    Args:
        tenant_id: Tenant ID
        feature_id: Feature identifier
        old_value: Previous value
        new_value: New value
        action: "feature_enabled" or "feature_disabled"
        actor_user_id: User ID making change
        actor_username: Username making change
        actor_ip: IP address of requester
        reason: Reason for change
    
    Returns:
        Created TenantFeatureAudit instance
    """
    audit = TenantFeatureAudit.objects.create(
        tenant_id=tenant_id,
        feature_id=feature_id,
        action=action,
        actor_user_id=actor_user_id,
        actor_username=actor_username,
        actor_ip=actor_ip,
        old_value={"enabled": old_value} if old_value is not None else None,
        new_value={"enabled": new_value} if new_value is not None else None,
        reason=reason,
    )
    return audit


def log_plan_changed(
    tenant_id: str,
    old_plan: Optional[str],
    new_plan: str,
    actor_user_id: Optional[int] = None,
    actor_username: Optional[str] = None,
    actor_ip: Optional[str] = None,
    reason: Optional[str] = None,
) -> TenantFeatureAudit:
    """Log plan change event.
    
    Args:
        tenant_id: Tenant ID
        old_plan: Previous plan (or None if new tenant)
        new_plan: New plan
        actor_user_id: User ID making change
        actor_username: Username making change
        actor_ip: IP address of requester
        reason: Reason for change
    
    Returns:
        Created TenantFeatureAudit instance
    """
    audit = TenantFeatureAudit.objects.create(
        tenant_id=tenant_id,
        action="plan_changed",
        actor_user_id=actor_user_id,
        actor_username=actor_username,
        actor_ip=actor_ip,
        old_value={"plan": old_plan},
        new_value={"plan": new_plan},
        reason=reason or "Plan updated",
    )
    return audit


def log_tenant_suspended(
    tenant_id: str,
    actor_user_id: Optional[int] = None,
    actor_username: Optional[str] = None,
    actor_ip: Optional[str] = None,
    reason: Optional[str] = None,
) -> TenantFeatureAudit:
    """Log tenant suspension event.
    
    Args:
        tenant_id: Tenant ID
        actor_user_id: User ID suspending tenant
        actor_username: Username suspending tenant
        actor_ip: IP address of requester
        reason: Reason for suspension
    
    Returns:
        Created TenantFeatureAudit instance
    """
    audit = TenantFeatureAudit.objects.create(
        tenant_id=tenant_id,
        action="tenant_suspended",
        actor_user_id=actor_user_id,
        actor_username=actor_username,
        actor_ip=actor_ip,
        new_value={"status": "suspended"},
        reason=reason or "Tenant suspended",
    )
    return audit


def log_tenant_activated(
    tenant_id: str,
    actor_user_id: Optional[int] = None,
    actor_username: Optional[str] = None,
    actor_ip: Optional[str] = None,
    reason: Optional[str] = None,
) -> TenantFeatureAudit:
    """Log tenant activation event.
    
    Args:
        tenant_id: Tenant ID
        actor_user_id: User ID activating tenant
        actor_username: Username activating tenant
        actor_ip: IP address of requester
        reason: Reason for activation
    
    Returns:
        Created TenantFeatureAudit instance
    """
    audit = TenantFeatureAudit.objects.create(
        tenant_id=tenant_id,
        action="tenant_activated",
        actor_user_id=actor_user_id,
        actor_username=actor_username,
        actor_ip=actor_ip,
        new_value={"status": "active"},
        reason=reason or "Tenant activated",
    )
    return audit


def log_rate_limit_violation(
    tenant_id: str,
    ip_address: Optional[str] = None,
    scope: str = "minute",
    limit: int = 100,
) -> TenantFeatureAudit:
    """Log rate limit violation.
    
    Args:
        tenant_id: Tenant ID
        ip_address: Client IP address
        scope: "minute" or "hour"
        limit: Rate limit threshold
    
    Returns:
        Created TenantFeatureAudit instance
    """
    audit = TenantFeatureAudit.objects.create(
        tenant_id=tenant_id,
        action="rate_limit_violation",
        actor_ip=ip_address,
        new_value={
            "scope": scope,
            "limit": limit,
            "exceeded": True,
        },
        reason=f"Rate limit exceeded ({limit}/{scope})",
    )
    return audit


def log_api_access_toggled(
    tenant_id: str,
    enabled: bool,
    actor_user_id: Optional[int] = None,
    actor_username: Optional[str] = None,
    actor_ip: Optional[str] = None,
    reason: Optional[str] = None,
) -> TenantFeatureAudit:
    """Log API access enable/disable event.
    
    Args:
        tenant_id: Tenant ID
        enabled: True if enabling, False if disabling
        actor_user_id: User ID making change
        actor_username: Username making change
        actor_ip: IP address of requester
        reason: Reason for change
    
    Returns:
        Created TenantFeatureAudit instance
    """
    action = "feature_enabled" if enabled else "feature_disabled"
    
    audit = TenantFeatureAudit.objects.create(
        tenant_id=tenant_id,
        feature_id="api_access_enabled",
        action=action,
        actor_user_id=actor_user_id,
        actor_username=actor_username,
        actor_ip=actor_ip,
        old_value={"api_access": not enabled},
        new_value={"api_access": enabled},
        reason=reason or (
            "API access enabled" if enabled else "API access disabled"
        ),
    )
    return audit


def log_rate_limit_changed(
    tenant_id: str,
    feature_id: str,
    old_limit: int,
    new_limit: int,
    actor_user_id: Optional[int] = None,
    actor_username: Optional[str] = None,
    actor_ip: Optional[str] = None,
    reason: Optional[str] = None,
) -> TenantFeatureAudit:
    """Log rate limit configuration change.
    
    Args:
        tenant_id: Tenant ID
        feature_id: Feature identifier (e.g., "api_rate_limit")
        old_limit: Previous limit value
        new_limit: New limit value
        actor_user_id: User ID making change
        actor_username: Username making change
        actor_ip: IP address of requester
        reason: Reason for change
    
    Returns:
        Created TenantFeatureAudit instance
    """
    audit = TenantFeatureAudit.objects.create(
        tenant_id=tenant_id,
        feature_id=feature_id,
        action="rate_limit_changed",
        actor_user_id=actor_user_id,
        actor_username=actor_username,
        actor_ip=actor_ip,
        old_value={"limit": old_limit},
        new_value={"limit": new_limit},
        reason=reason or f"Rate limit changed from {old_limit} to {new_limit}",
    )
    return audit


def get_tenant_feature_audit_log(
    tenant_id: str,
    feature_id: Optional[str] = None,
    action: Optional[str] = None,
    limit: int = 100,
) -> list:
    """Query feature audit log for tenant.
    
    Args:
        tenant_id: Tenant ID
        feature_id: Optional filter by feature
        action: Optional filter by action type
        limit: Maximum results to return
    
    Returns:
        List of TenantFeatureAudit records
    """
    queryset = TenantFeatureAudit.objects.filter(tenant_id=tenant_id)
    
    if feature_id:
        queryset = queryset.filter(feature_id=feature_id)
    
    if action:
        queryset = queryset.filter(action=action)
    
    return queryset.order_by("-created_at")[:limit]


def get_recent_feature_changes(limit: int = 50) -> list:
    """Get recent feature changes across all tenants (super-admin view).
    
    Args:
        limit: Maximum results to return
    
    Returns:
        List of recent TenantFeatureAudit records
    """
    return TenantFeatureAudit.objects.order_by("-created_at")[:limit]


def get_plan_change_history(tenant_id: str, limit: int = 20) -> list:
    """Get plan change history for tenant.
    
    Args:
        tenant_id: Tenant ID
        limit: Maximum results to return
    
    Returns:
        List of plan change records
    """
    return TenantFeatureAudit.objects.filter(
        tenant_id=tenant_id,
        action="plan_changed",
    ).order_by("-created_at")[:limit]


def get_suspension_history(tenant_id: str) -> list:
    """Get suspension/activation history for tenant.
    
    Args:
        tenant_id: Tenant ID
    
    Returns:
        List of suspension/activation events
    """
    return TenantFeatureAudit.objects.filter(
        tenant_id=tenant_id,
        action__in=["tenant_suspended", "tenant_activated"],
    ).order_by("-created_at")


def get_feature_usage_report(tenant_id: str) -> Dict[str, Any]:
    """Generate feature usage report for tenant.
    
    Args:
        tenant_id: Tenant ID
    
    Returns:
        Dict with feature usage stats
    """
    audits = TenantFeatureAudit.objects.filter(
        tenant_id=tenant_id,
        action__in=["feature_enabled", "feature_disabled"],
    )
    
    enabled_count = audits.filter(action="feature_enabled").count()
    disabled_count = audits.filter(action="feature_disabled").count()
    
    # Get unique features toggled
    features = set()
    for audit in audits:
        if audit.feature_id:
            features.add(audit.feature_id)
    
    return {
        "tenant_id": tenant_id,
        "total_feature_changes": audits.count(),
        "features_enabled": enabled_count,
        "features_disabled": disabled_count,
        "unique_features": len(features),
        "report_generated": timezone.now().isoformat(),
    }
