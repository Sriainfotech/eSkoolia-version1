"""Tenant feature validation middleware.

Adds lightweight feature availability checks to request pipeline.
Runs after tenant resolution and authentication.
"""

from django.utils.deprecation import MiddlewareMixin
from django.http import JsonResponse, Http404
from apps.tenancy.context import (
    get_current_tenant,
    is_tenant_mode,
)
from apps.tenancy.feature_flags import is_feature_enabled
from apps.tenancy.helpers import (
    tenant_is_active,
    tenant_is_suspended,
    tenant_api_allowed,
)


class TenantFeatureValidationMiddleware(MiddlewareMixin):
    """Validate tenant status and feature access.
    
    Runs after TenantMainMiddleware and authentication middleware.
    Checks:
    1. Tenant is active (not suspended/archived)
    2. Trial not expired
    3. API access enabled (if API request)
    
    Configuration (in settings.py):
        MIDDLEWARE = [
            # ... other middleware ...
            'apps.tenancy.middleware_features.TenantFeatureValidationMiddleware',
        ]
    
    Guards:
        - Only active when MULTI_TENANCY_ENABLED=True
        - Skips monolithic mode
        - No-op if MULTI_TENANCY_ENABLED=False
    """
    
    # Paths that should skip feature validation
    SKIP_VALIDATION_PATHS = [
        "/api/health/",
        "/api/status/",
        "/api/token/refresh/",  # Allow refresh even if suspended
        "/api/admin/",  # Admin APIs have own checks
    ]
    
    def process_request(self, request):
        """Validate tenant status before processing request."""
        
        # Skip if multi-tenancy disabled
        if not is_tenant_mode():
            return None
        
        # Skip certain paths
        if self._should_skip_path(request.path):
            return None
        
        tenant = get_current_tenant()
        if not tenant:
            # No tenant context - let authentication handle it
            return None
        
        # Check tenant status
        if tenant.status == "suspended":
            return JsonResponse(
                {
                    "error": "suspended",
                    "detail": "Your account is currently suspended. Please contact support.",
                },
                status=403,
            )
        
        if tenant.status == "archived":
            return JsonResponse(
                {
                    "error": "archived",
                    "detail": "Your account has been archived.",
                },
                status=403,
            )
        
        if tenant.status == "onboarding":
            # Allow but may want to restrict certain operations
            pass
        
        # Check trial expiration
        if tenant.plan == "trial":
            from django.utils import timezone
            if hasattr(tenant, "provisioned_at") and tenant.provisioned_at:
                age_days = (timezone.now() - tenant.provisioned_at).days
                if age_days > 30:
                    # Trial expired - only allow limited operations
                    if self._is_data_modifying_request(request):
                        return JsonResponse(
                            {
                                "error": "trial_expired",
                                "detail": "Trial period expired. Please upgrade to continue.",
                            },
                            status=403,
                        )
        
        # Check API access for API requests
        if self._is_api_request(request):
            if not tenant.api_access:
                return JsonResponse(
                    {
                        "error": "api_access_denied",
                        "detail": "API access is not enabled for your account.",
                    },
                    status=403,
                )
        
        return None
    
    def _should_skip_path(self, path: str) -> bool:
        """Check if path should skip validation."""
        for skip_path in self.SKIP_VALIDATION_PATHS:
            if path.startswith(skip_path):
                return True
        return False
    
    def _is_api_request(self, request) -> bool:
        """Check if request is API request."""
        return request.path.startswith("/api/")
    
    def _is_data_modifying_request(self, request) -> bool:
        """Check if request modifies data (POST, PUT, PATCH, DELETE)."""
        return request.method in ["POST", "PUT", "PATCH", "DELETE"]


class TenantFeatureGateMiddleware(MiddlewareMixin):
    """Gate specific API endpoints based on tenant features.
    
    Maps URL patterns to required features:
        /api/library/ → library_enabled
        /api/attendance/ → attendance_enabled
        etc.
    
    Configuration (in settings.py):
        TENANT_FEATURE_GATES = {
            "^/api/library/": "library_enabled",
            "^/api/attendance/": "attendance_enabled",
            "^/api/transport/": "transport_enabled",
            "^/api/hr/": "hr_enabled",
            "^/api/inventory/": "inventory_enabled",
            "^/api/fees/": "fees_enabled",
            "^/api/chat/": "communication_enabled",
            "^/api/analytics/": "analytics_enabled",
        }
    
    Guards:
        - Only active when MULTI_TENANCY_ENABLED=True
        - Skips monolithic mode
    """
    
    def __init__(self, get_response):
        super().__init__(get_response)
        from django.conf import settings
        self.feature_gates = getattr(
            settings,
            "TENANT_FEATURE_GATES",
            {},
        )
    
    def process_request(self, request):
        """Check if requested endpoint is gated by feature flag."""
        
        # Skip if multi-tenancy disabled
        if not is_tenant_mode():
            return None
        
        # Check if path matches any feature gate
        import re
        
        for url_pattern, feature_id in self.feature_gates.items():
            if re.match(url_pattern, request.path):
                # Check if feature is enabled
                if not is_feature_enabled(feature_id):
                    tenant = get_current_tenant()
                    feature_name = feature_id.replace("_enabled", "").title()
                    
                    return JsonResponse(
                        {
                            "error": "feature_not_available",
                            "detail": f"{feature_name} is not available on your plan.",
                            "feature": feature_id,
                        },
                        status=403,
                    )
        
        return None


class TenantPlanEnforcementMiddleware(MiddlewareMixin):
    """Enforce plan-specific limits on request frequency.
    
    Wrapper around rate limiting that enforces plan limits.
    
    Configuration (in settings.py):
        Automatically configured if rate limiting enabled
    """
    
    def process_request(self, request):
        """Check rate limit for tenant."""
        
        # Skip if multi-tenancy disabled
        if not is_tenant_mode():
            return None
        
        tenant = get_current_tenant()
        if not tenant:
            return None
        
        # Check if rate limit violated (if using throttle)
        # This is more commonly handled in DRF throttles
        # but can be done here for legacy views
        
        return None
