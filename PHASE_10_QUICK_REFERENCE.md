# Phase 10 Quick Reference — Tenant-Aware API Permissions & Feature Flags

## Quick Start

```python
# Check if feature is available
from apps.tenancy.helpers import tenant_has_feature

if tenant_has_feature("library_enabled"):
    # Feature is available for current tenant
    pass

# Check tenant status
from apps.tenancy.helpers import tenant_is_active, tenant_is_suspended

if not tenant_is_active():
    return Response({"error": "Inactive tenant"}, status=403)

if tenant_is_suspended():
    return Response({"error": "Account suspended"}, status=403)

# Get tenant context
from apps.tenancy.helpers import tenant_context

ctx = tenant_context()
print(f"Plan: {ctx['plan']}, Features: {ctx['features']}")
```

---

## Permission Classes

### Use in Views

```python
from rest_framework import viewsets
from apps.tenancy.permissions import (
    TenantActive,
    TenantFeatureEnabled,
    TenantAPIAccessEnabled,
    TenantNotSuspended,
)

class StudentViewSet(viewsets.ModelViewSet):
    permission_classes = [
        TenantActive,  # Deny if tenant not active
        TenantAPIAccessEnabled,  # Deny if API disabled
        TenantFeatureEnabled,  # Check feature (requires tenant_feature attribute)
    ]
    tenant_feature = "academics_enabled"  # Feature to check
```

### Available Permission Classes

| Class | Purpose | Denies If |
|-------|---------|-----------|
| `TenantActive` | Tenant operational | Suspended, archived, or expired trial |
| `TenantFeatureEnabled` | Feature available | Feature disabled for plan |
| `TenantAPIAccessEnabled` | API access enabled | api_access=False |
| `TenantNotSuspended` | Not suspended | status="suspended" |
| `IsSuperAdminOnly` | Super-admin only | Not superuser or has tenant context |
| `TenantUserOnly` | Tenant user only | Superuser or no tenant context |
| `TenantDataIsolation` | Data isolation | Cross-tenant access attempt |
| `TenantAPIRead` | Read-only API | Convenience combo |
| `TenantAPIWrite` | Write API | Convenience combo |

---

## Helper Functions

### Feature Checks

```python
from apps.tenancy.helpers import (
    tenant_has_feature,
    tenant_plan,
    can_upgrade_plan,
)

# Check single feature
if tenant_has_feature("library_enabled"):
    enable_library_apis()

# Get tenant plan
plan = tenant_plan()  # "trial", "premium", or "enterprise"

# Check upgrade path
can_upgrade, next_plan = can_upgrade_plan()
if can_upgrade:
    print(f"Can upgrade to {next_plan}")
```

### Tenant Status Checks

```python
from apps.tenancy.helpers import (
    tenant_is_active,
    tenant_is_suspended,
    tenant_api_allowed,
    tenant_is_trial,
    tenant_trial_expired,
)

# Check status
if tenant_is_active():
    allow_operations()

if tenant_is_suspended():
    block_access()

if tenant_api_allowed():
    enable_api_access()

# Trial specific
if tenant_is_trial() and tenant_trial_expired():
    request_upgrade()
```

### Context & Metrics

```python
from apps.tenancy.helpers import (
    tenant_context,
    tenant_rate_limit,
    tenant_warning_status,
    get_tenant_usage_stats,
)

# Get full context
ctx = tenant_context()
# {
#   "tenant_id": "TNT_001",
#   "plan": "premium",
#   "status": "active",
#   "features": {...},
#   "is_active": True,
#   "api_allowed": True,
# }

# Get rate limits
limits = tenant_rate_limit()
# {"per_minute": 1000, "per_hour": 10000}

# Check warning status
warning = tenant_warning_status()
# "trial_expiring", "trial_expired", or None

# Usage stats
usage = get_tenant_usage_stats()
# {"active_users": 5, "api_calls_today": 250, ...}
```

---

## Decorators

### Require Tenant Context

```python
from apps.tenancy.helpers import require_tenant_context

@require_tenant_context
def my_service_function(request):
    """Only runs if tenant context exists."""
    ...
```

### Require Feature

```python
from apps.tenancy.helpers import require_feature

@require_feature("library_enabled")
def library_operation(request):
    """Only runs if feature is enabled."""
    ...
```

### Require Not Suspended

```python
from apps.tenancy.helpers import require_not_suspended

@require_not_suspended()
def data_modification(request):
    """Only runs if tenant not suspended."""
    ...
```

---

## Rate Limiting

### Automatic (DRF)

```python
from rest_framework import viewsets
from apps.tenancy.rate_limiting import TenantAwareThrottle

class StudentViewSet(viewsets.ModelViewSet):
    throttle_classes = [TenantAwareThrottle]
    # Automatically limits per tenant plan:
    # trial: 100/min, 1000/hour
    # premium: 1000/min, 10000/hour
    # enterprise: 5000/min, 50000/hour
```

### Manual Check

```python
from apps.tenancy.helpers import tenant_rate_limit

limits = tenant_rate_limit()
if request_count > limits["per_minute"]:
    # Too many requests
    pass
```

---

## Audit Logging

### Log Feature Changes

```python
from apps.tenancy.audit_features import (
    log_feature_changed,
    log_plan_changed,
    log_tenant_suspended,
    log_rate_limit_violation,
)

# Log feature enable
log_feature_changed(
    tenant_id="TNT_001",
    feature_id="library_enabled",
    old_value=False,
    new_value=True,
    action="feature_enabled",
    actor_user_id=request.user.id,
    actor_username=request.user.username,
    actor_ip=request.META.get("REMOTE_ADDR"),
    reason="Enabled by admin",
)

# Log plan change
log_plan_changed(
    tenant_id="TNT_001",
    old_plan="trial",
    new_plan="premium",
    actor_username="admin",
    reason="Customer upgraded",
)

# Log suspension
log_tenant_suspended(
    tenant_id="TNT_001",
    actor_username="admin",
    reason="Payment overdue",
)
```

### Query Audit Logs

```python
from apps.tenancy.audit_features import (
    get_tenant_feature_audit_log,
    get_plan_change_history,
    get_suspension_history,
)

# Get recent changes
logs = get_tenant_feature_audit_log("TNT_001", limit=20)
for log in logs:
    print(f"{log.action}: {log.feature_id} @ {log.created_at}")

# Plan change history
plans = get_plan_change_history("TNT_001")

# Suspension history
suspensions = get_suspension_history("TNT_001")
```

---

## Management Commands

### Check Plans

```bash
python manage.py manage_tenant_features --list-plans

# Output:
# Premium (premium)
#   ID: premium-001
#   Rate Limits:
#     - Per Minute: 1000
#     - Per Hour: 10000
#   Features:
#     ✓ attendance_enabled
#     ✓ fees_enabled
#     ✗ inventory_enabled
```

### List Tenants

```bash
python manage.py manage_tenant_features --list-tenants

# Output:
# ✓ Greenwood School (TNT_001)
#   Status: active
#   Plan: premium
#   API Access: ✓
#   Age: 45 days

# ✗ Alpha Academy (TNT_002)
#   Status: suspended
#   Plan: trial
#   API Access: ✗
```

### Change Plans

```bash
# Upgrade tenant to premium
python manage.py manage_tenant_features --set-plan TNT_001 premium

# Output:
# ✓ Tenant Greenwood School plan changed to premium
```

### Enable/Disable Features

```bash
# Enable library for tenant
python manage.py manage_tenant_features --enable-feature TNT_001 library_enabled

# Disable attendance
python manage.py manage_tenant_features --disable-feature TNT_001 attendance_enabled
```

### Suspend/Activate Tenants

```bash
# Suspend tenant
python manage.py manage_tenant_features --suspend TNT_001
# Output: ✓ Tenant Greenwood School suspended

# Reactivate
python manage.py manage_tenant_features --activate TNT_001
# Output: ✓ Tenant Greenwood School activated
```

### API Access Control

```bash
# Enable API access
python manage.py manage_tenant_features --enable-api TNT_001

# Disable API access
python manage.py manage_tenant_features --disable-api TNT_001
```

---

## Testing

### Run Status Report

```bash
python manage.py test_phase10

# Shows:
# - Plans configured
# - Features defined
# - Tenant status breakdown
# - Audit logs count
```

### Run All Tests

```bash
python manage.py test_phase10 --all

# Runs:
# ✓ Feature flag tests
# ✓ Permission class tests
# ✓ Rate limiting tests
# ✓ Cross-tenant isolation tests
# ✓ Audit logging tests
```

### Test Specific Features

```bash
python manage.py test_phase10 --test-features
python manage.py test_phase10 --test-permissions
python manage.py test_phase10 --test-rate-limits
python manage.py test_phase10 --test-isolation
python manage.py test_phase10 --test-audit
```

---

## Super-Admin Reporting APIs

All require `is_superuser=True` and no tenant context (must authenticate in public schema).

### List All Tenants

```bash
GET /api/admin/tenants/?plan=premium&status=active

{
  "count": 5,
  "results": [
    {
      "tenant_id": "TNT_001",
      "name": "Greenwood School",
      "plan": "premium",
      "status": "active",
      "api_access": true,
      "feature_count": 7
    }
  ]
}
```

### Get Tenant Metrics

```bash
GET /api/admin/tenants/TNT_001/metrics/

{
  "tenant_id": "TNT_001",
  "tenant_name": "Greenwood School",
  "plan": "premium",
  "status": "active",
  "enabled_features": 7,
  "total_features": 10,
  "api_access_enabled": true,
  "trial_days_remaining": null,
  "is_trial_expired": false,
  "age_days": 45,
  "recent_changes": 3
}
```

### Get Audit Log

```bash
GET /api/admin/tenants/TNT_001/audit_log/?limit=20

{
  "count": 3,
  "results": [
    {
      "id": 1,
      "action": "plan_changed",
      "feature_id": null,
      "actor": "admin",
      "reason": "Upgraded to premium",
      "created_at": "2026-05-13T10:00:00Z"
    }
  ]
}
```

### Platform Reports

```bash
# Health report
GET /api/admin/reports/health/

# Feature usage
GET /api/admin/reports/feature_usage/

# Plan distribution
GET /api/admin/reports/plans/

# Audit summary
GET /api/admin/reports/audit_summary/?days=7
```

---

## Configuration

### Settings.py Additions

```python
if MULTI_TENANCY_ENABLED:
    # Add these middleware (in order)
    MIDDLEWARE.insert(
        MIDDLEWARE.index("apps.tenancy.middleware.TenantContextMiddleware") + 1,
        "apps.tenancy.middleware_features.TenantFeatureValidationMiddleware",
    )
    MIDDLEWARE.insert(
        MIDDLEWARE.index("apps.tenancy.middleware_features.TenantFeatureValidationMiddleware") + 1,
        "apps.tenancy.middleware_features.TenantFeatureGateMiddleware",
    )

# REST Framework throttling
REST_FRAMEWORK["DEFAULT_THROTTLE_CLASSES"] = (
    ["apps.tenancy.rate_limiting.TenantAwareThrottle"]
    if MULTI_TENANCY_ENABLED
    else []
)

# Feature gates (optional)
TENANT_FEATURE_GATES = {
    "^/api/library/": "library_enabled",
    "^/api/attendance/": "attendance_enabled",
    # ... add more as needed
}
```

---

## Key Differences: Monolithic vs Tenant Mode

| Aspect | Monolithic | Tenant Mode |
|--------|-----------|------------|
| Feature Checks | All features available | Plan-based checking |
| Rate Limiting | Global limits (if any) | Per-tenant plan limits |
| Permissions | Based on RBAC | Feature + RBAC + plan |
| Data Scope | All data | Current schema only |
| API Access | Always allowed | Requires api_access=True |
| Suspension | N/A | Blocks all access |
| Audit Logs | Not logged | Always logged |

---

## Common Patterns

### Conditional Feature Activation

```python
# In urls.py
if settings.MULTI_TENANCY_ENABLED:
    from apps.tenancy.helpers import tenant_has_feature
    
    # Different endpoints for different tenants
    urlpatterns += [
        path("api/library/", LibraryViewSet.as_view()),
    ]
```

### In ViewSets

```python
class LibraryViewSet(viewsets.ModelViewSet):
    permission_classes = [TenantActive, TenantFeatureEnabled]
    tenant_feature = "library_enabled"
    
    def get_queryset(self):
        # Automatic schema filtering from Phase 9
        return Library.objects.all()
```

### In Services

```python
def send_attendance_notification():
    from apps.tenancy.helpers import tenant_has_feature
    
    if not tenant_has_feature("attendance_enabled"):
        return {"status": "skipped", "reason": "Feature not available"}
    
    # Process notification
    return {"status": "sent"}
```

---

## Troubleshooting Quick Fixes

| Issue | Solution |
|-------|----------|
| Feature not working | `from apps.tenancy.feature_flags import clear_tenant_feature_cache; clear_tenant_feature_cache("TNT_001")` |
| Rate limit too strict | Check plan: `python manage.py manage_tenant_features --list-tenants` |
| 401 on /api/admin/ | Verify `is_superuser=True` and NO tenant context |
| Audit logs not appearing | Check: `TenantFeatureAudit.objects.count()` |
| Feature gate not working | Check TENANT_FEATURE_GATES in settings |
| Permissions denied unexpectedly | Run tests: `python manage.py test_phase10 --test-permissions` |

---

## Resources

- Full Documentation: `PHASE_10_SETUP_GUIDE.md`
- Completion Summary: `PHASE_10_COMPLETION_SUMMARY.md`
- Code Reference: See docstrings in each .py file
- Phase 9 (Prerequisites): `PHASE_9_QUICK_REFERENCE.md`

---

*Phase 10 Quick Reference — Ready for Staging*  
*Generated: 2026-05-13*
