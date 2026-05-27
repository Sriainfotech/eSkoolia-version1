"""Tenant-aware JWT authentication.

This authentication class:
1. Validates JWT token in the request
2. Looks up user in the active tenant schema (if in tenant mode)
3. Falls back to public schema for super-admin users
4. Maintains backward compatibility with monolithic mode

When MULTI_TENANCY_ENABLED=False:
- Behaves like standard JWTAuthentication
- Looks up users in default database
"""
import logging
from typing import Optional, Tuple

from django.contrib.auth import get_user_model
from django.conf import settings
from rest_framework_simplejwt.authentication import JWTAuthentication
from rest_framework_simplejwt.exceptions import InvalidToken
from rest_framework.request import Request
from rest_framework.exceptions import AuthenticationFailed

from .context import get_current_schema, get_current_tenant, is_multi_tenancy_enabled

logger = logging.getLogger(__name__)
User = get_user_model()


class TenantAwareJWTAuthentication(JWTAuthentication):
    """JWT authentication that respects tenant schema context.
    
    Extends DRF's JWTAuthentication to:
    1. Validate JWT token (standard)
    2. Look up user in active tenant schema (Phase 9)
    3. Fall back to public schema for super-admins
    4. Preserve monolithic behavior when feature flag is OFF
    
    Usage in REST_FRAMEWORK settings:
        'DEFAULT_AUTHENTICATION_CLASSES': [
            'apps.tenancy.auth.TenantAwareJWTAuthentication',
        ]
    """

    def authenticate(self, request: Request) -> Optional[Tuple[User, dict]]:
        """Authenticate request using JWT token.
        
        Args:
            request: DRF Request object
            
        Returns:
            Tuple of (user, validated_token) if authentication succeeds
            None if no JWT token present (allow other auth methods)
            
        Raises:
            AuthenticationFailed: If JWT is invalid or user not found
        """
        # Try to get JWT token from Authorization header
        auth_result = super().authenticate(request)
        
        if auth_result is None:
            # No JWT token present; other auth methods can try
            return None
        
        user, validated_token = auth_result
        
        # If multi-tenancy disabled, return user as-is (monolithic mode)
        if not is_multi_tenancy_enabled():
            logger.debug(f"User authenticated (monolithic mode): {user.username}")
            return (user, validated_token)
        
        # Multi-tenancy is enabled; apply tenant schema context
        current_schema = get_current_schema()
        current_tenant = get_current_tenant()
        
        # Super-admin users authenticate in public schema only
        if user.is_superuser:
            logger.debug(
                f"Super-admin authenticated in public schema: {user.username}"
            )
            return (user, validated_token)
        
        # Regular users must authenticate in their tenant schema
        if current_tenant is None or current_schema is None:
            # Request didn't resolve to a tenant, but JWT token exists
            # This is ambiguous - user is trying to auth to public schema
            # Reject this to prevent accidental cross-tenant access
            logger.warning(
                f"Rejecting non-superuser JWT auth without tenant context: {user.username}"
            )
            raise AuthenticationFailed(
                "User authentication requires tenant context. Please use tenant subdomain."
            )
        
        # Verify user exists in the active tenant schema
        # (The user lookup already happened in super().authenticate(),
        # but we verify again to ensure they're not in a different schema)
        try:
            tenant_user = User.objects.get(id=user.id)
            logger.debug(
                f"User authenticated in tenant schema: {tenant_user.username} "
                f"(tenant={current_tenant.tenant_id} schema={current_schema})"
            )
            return (tenant_user, validated_token)
        
        except User.DoesNotExist:
            # User not found in tenant schema — try public schema as a fallback.
            # This covers schools provisioned manually (outside the normal workflow)
            # whose users haven't been copied to the tenant schema yet.
            from django_tenants.utils import schema_context as _schema_context
            with _schema_context("public"):
                try:
                    tenant_user = User.objects.get(id=user.id)
                    logger.warning(
                        f"User {user.username} found in public schema (not in tenant "
                        f"schema {current_schema}); schema migration may be pending"
                    )
                    return (tenant_user, validated_token)
                except User.DoesNotExist:
                    pass
            logger.warning(
                f"User {user.username} not found in tenant schema {current_schema} "
                f"or public schema; possible cross-tenant access attempt"
            )
            raise AuthenticationFailed(
                f"User not found in tenant {current_tenant.name}"
            )


class TenantAwareAuthenticationMiddleware:
    """Custom authentication middleware for tenant-aware request processing.
    
    This middleware:
    1. Runs AFTER TenantMainMiddleware (so tenant is already resolved)
    2. Handles tenant-aware authentication
    3. Logs authentication events with tenant context
    
    Note: For DRF views, use TenantAwareJWTAuthentication instead.
    This middleware is for traditional Django views that need auth info.
    """
    
    def __init__(self, get_response):
        self.get_response = get_response
    
    def __call__(self, request: Request) -> Request:
        """Process request and authenticate user if needed.
        
        Args:
            request: Django HTTP request
            
        Returns:
            Response from get_response
        """
        # Multi-tenancy disabled; use standard auth flow
        if not is_multi_tenancy_enabled():
            request.tenant = None
            return self.get_response(request)
        
        # Multi-tenancy enabled; request already has tenant context from TenantMainMiddleware
        # Just attach tenant info to request for view usage
        current_tenant = get_current_tenant()
        current_schema = get_current_schema()
        
        request.tenant = current_tenant
        request.schema_name = current_schema
        
        if current_tenant:
            logger.debug(
                f"Request in tenant context: {current_tenant.tenant_id} "
                f"(schema={current_schema})"
            )
        
        return self.get_response(request)
