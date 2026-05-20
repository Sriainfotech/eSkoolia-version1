"""Tenant-aware API rate limiting / throttling.

Provides per-tenant rate limiting based on plan.
Compatible with future Redis backend for distributed rate limiting.
"""

from rest_framework.throttling import SimpleRateThrottle, BaseThrottle
from rest_framework.exceptions import Throttled
from django.core.cache import cache
from django.conf import settings
from django.utils.decorators import method_decorator
from django.views.decorators.cache import never_cache
from apps.tenancy.context import (
    get_current_tenant,
    get_current_tenant_id,
    is_tenant_mode,
)
from apps.tenancy.feature_flags import get_tenant_plan


class TenantAwareThrottle(SimpleRateThrottle):
    """Rate limiting per tenant based on plan.
    
    Plan-based limits:
    - trial: 100 req/min, 1000 req/hour
    - premium: 1000 req/min, 10000 req/hour
    - enterprise: 5000 req/min, 50000 req/hour
    
    In monolithic mode: No limiting (or use default Django rate limiting)
    """
    
    # Rate throttle scope
    scope = "tenant_api"
    
    # Plan-based rate limits (requests per minute)
    PLAN_LIMITS = {
        "trial": "100/minute",
        "premium": "1000/minute",
        "enterprise": "5000/minute",
    }
    
    def get_cache_key(self):
        """Generate cache key for rate limiting.
        
        For tenant mode: tenant:{tenant_id}:rate_limit
        For monolithic: user:{user_id}:rate_limit
        """
        
        if not is_tenant_mode():
            # Monolithic mode: rate limit by user
            if self.request.user and self.request.user.is_authenticated:
                return f"user:{self.request.user.id}:rate_limit"
            else:
                return f"ip:{self.get_ident()}:rate_limit"
        
        # Tenant mode: rate limit by tenant
        try:
            tenant_id = get_current_tenant_id()
            if tenant_id:
                return f"tenant:{tenant_id}:rate_limit"
        except Exception:
            pass
        
        # Fallback: by user or IP
        if self.request.user and self.request.user.is_authenticated:
            return f"user:{self.request.user.id}:rate_limit"
        else:
            return f"ip:{self.get_ident()}:rate_limit"
    
    def get_rate(self):
        """Get rate limit for current tenant.
        
        Returns: "N/time" format (e.g., "100/minute")
        """
        
        if not is_tenant_mode():
            # Default limit for monolithic mode
            return "1000/minute"
        
        try:
            plan = get_tenant_plan()
            if plan in self.PLAN_LIMITS:
                return self.PLAN_LIMITS[plan]
        except Exception:
            pass
        
        # Fallback to trial limits
        return self.PLAN_LIMITS.get("trial", "100/minute")
    
    def throttle_success(self):
        """Called when request is allowed.
        
        Override to log if needed.
        """
        return True
    
    def throttle_failure(self):
        """Called when request is throttled.
        
        Override to log rate limit violations if needed.
        """
        
        # Log rate limit event (in audit if available)
        try:
            from apps.tenancy.audit_features import log_rate_limit_violation
            tenant = get_current_tenant()
            if tenant:
                log_rate_limit_violation(
                    tenant_id=tenant.tenant_id,
                    ip_address=self.get_ident(),
                )
        except Exception:
            pass
        
        return False


class TenantPlanBasedThrottle(BaseThrottle):
    """Alternative implementation using cache directly.
    
    More flexible than SimpleRateThrottle for per-tenant configuration.
    """
    
    PLAN_RATE_LIMITS = {
        "trial": {
            "per_minute": 100,
            "per_hour": 1000,
        },
        "premium": {
            "per_minute": 1000,
            "per_hour": 10000,
        },
        "enterprise": {
            "per_minute": 5000,
            "per_hour": 50000,
        },
    }
    
    def get_client_id(self, request):
        """Get unique identifier for throttling."""
        
        if is_tenant_mode():
            try:
                tenant = get_current_tenant()
                if tenant:
                    return f"tenant:{tenant.tenant_id}"
            except Exception:
                pass
        
        # Fallback: user or IP
        if request.user and request.user.is_authenticated:
            return f"user:{request.user.id}"
        
        return f"ip:{self.get_ident(request)}"
    
    def get_ident(self, request):
        """Get client IP address."""
        xff = request.META.get("HTTP_X_FORWARDED_FOR")
        remote_addr = request.META.get("REMOTE_ADDR")
        num_proxies = getattr(settings, "NUM_PROXIES", None)
        
        if num_proxies is not None and num_proxies != 0 and xff:
            addrs = [ip.strip() for ip in xff.split(",")]
            client_addr = addrs[-min(num_proxies, len(addrs))]
        else:
            client_addr = remote_addr or ""
        
        return client_addr
    
    def get_plan_limits(self):
        """Get rate limits for tenant plan."""
        
        try:
            plan = get_tenant_plan()
            if plan in self.PLAN_RATE_LIMITS:
                return self.PLAN_RATE_LIMITS[plan]
        except Exception:
            pass
        
        # Default to trial limits
        return self.PLAN_RATE_LIMITS.get("trial", {
            "per_minute": 100,
            "per_hour": 1000,
        })
    
    def throttle(self, request):
        """Perform throttle check.
        
        Returns: True if request should be allowed, False if throttled
        """
        
        client_id = self.get_client_id(request)
        limits = self.get_plan_limits()
        
        # Check per-minute limit
        minute_key = f"{client_id}:minute:{self.get_minute_bucket()}"
        minute_count = cache.get(minute_key, 0)
        
        if minute_count >= limits["per_minute"]:
            self._throttle_reason = f"Rate limit exceeded ({limits['per_minute']}/minute)"
            self._log_rate_limit_violation(client_id, "minute", limits)
            return False
        
        # Check per-hour limit
        hour_key = f"{client_id}:hour:{self.get_hour_bucket()}"
        hour_count = cache.get(hour_key, 0)
        
        if hour_count >= limits["per_hour"]:
            self._throttle_reason = f"Rate limit exceeded ({limits['per_hour']}/hour)"
            self._log_rate_limit_violation(client_id, "hour", limits)
            return False
        
        # Increment counters
        cache.set(minute_key, minute_count + 1, 60)
        cache.set(hour_key, hour_count + 1, 3600)
        
        return True
    
    def get_minute_bucket(self):
        """Get current minute bucket."""
        import time
        return int(time.time() / 60)
    
    def get_hour_bucket(self):
        """Get current hour bucket."""
        import time
        return int(time.time() / 3600)
    
    def _log_rate_limit_violation(self, client_id, scope, limits):
        """Log rate limit violation."""
        try:
            from apps.tenancy.audit_features import log_rate_limit_violation
            
            # Extract tenant_id from client_id if applicable
            if client_id.startswith("tenant:"):
                tenant_id = client_id.split(":", 1)[1]
                log_rate_limit_violation(
                    tenant_id=tenant_id,
                    ip_address=None,
                    scope=scope,
                    limit=limits.get(f"per_{scope}", 0),
                )
        except Exception:
            pass


class NoThrottle(BaseThrottle):
    """Placeholder throttle that allows all requests.
    
    Use for endpoints that should not be rate-limited.
    """
    
    def throttle(self, request):
        return True


# Aliases for convenience
tenant_throttle = TenantAwareThrottle
tenant_plan_throttle = TenantPlanBasedThrottle
