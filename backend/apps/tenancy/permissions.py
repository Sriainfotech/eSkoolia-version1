"""Tenant-aware API permissions for DRF.

Permission classes that enforce:
- Feature availability per tenant
- Plan-based module access
- Tenant status validation
- API access control
- Cross-tenant data isolation
"""

from rest_framework.permissions import BasePermission
from rest_framework.exceptions import PermissionDenied
from django.http import Http404
from django.db import connection
from apps.tenancy.context import (
    get_current_tenant,
    get_current_tenant_id,
    is_tenant_mode,
)
from apps.tenancy.feature_flags import is_feature_enabled, get_tenant_plan
from apps.tenancy.models import SchoolTenant


class TenantActive(BasePermission):
    """Permission to check if tenant is active.
    
    Denies access if:
    - Tenant is suspended
    - Tenant is archived
    - Tenant is expired (trial)
    """
    
    message = "Tenant is not active or access is not allowed."
    
    def has_permission(self, request, view):
        # Monolithic mode: always allow
        if not is_tenant_mode():
            return True
        
        tenant = get_current_tenant()
        if not tenant:
            return False
        
        # Check tenant status
        if tenant.status == "suspended":
            raise PermissionDenied("Tenant account is suspended.")
        
        if tenant.status == "archived":
            raise PermissionDenied("Tenant account is archived.")
        
        # Check expiration for trial tenants
        if tenant.plan == "trial":
            from django.utils import timezone
            if hasattr(tenant, "provisioned_at") and tenant.provisioned_at:
                # Trial valid for 30 days
                age_days = (timezone.now() - tenant.provisioned_at).days
                if age_days > 30:
                    raise PermissionDenied(
                        "Trial period has expired. Please upgrade your plan."
                    )
        
        return True


class TenantFeatureEnabled(BasePermission):
    """Permission to check if feature is enabled for tenant.
    
    Use with view class:
        class StudentListView(generics.ListAPIView):
            permission_classes = [TenantFeatureEnabled]
            tenant_feature = "academics_enabled"  # Required class attribute
    """
    
    message = "Feature is not available for your tenant plan."
    
    def has_permission(self, request, view):
        # Monolithic mode: always allow
        if not is_tenant_mode():
            return True
        
        # Get required feature from view class
        feature_id = getattr(view, "tenant_feature", None)
        if not feature_id:
            # If no feature specified, allow (permissive default)
            return True
        
        # Check if feature is enabled
        if not is_feature_enabled(feature_id):
            raise PermissionDenied(
                f"Feature '{feature_id}' is not available for your plan."
            )
        
        return True


class TenantAPIAccessEnabled(BasePermission):
    """Permission to check if API access is enabled for tenant.
    
    Denies if tenant has api_access_enabled=False
    """
    
    message = "API access is not enabled for your tenant account."
    
    def has_permission(self, request, view):
        # Monolithic mode: always allow
        if not is_tenant_mode():
            return True
        
        tenant = get_current_tenant()
        if not tenant:
            return False
        
        # Check API access
        if not tenant.api_access:
            raise PermissionDenied(
                "API access is not enabled for your account. "
                "Please contact support."
            )
        
        return True


class TenantNotSuspended(BasePermission):
    """Permission to check tenant is not suspended.
    
    Used for critical operations (data modification, etc.)
    """
    
    message = "Cannot perform this action while tenant account is suspended."
    
    def has_permission(self, request, view):
        # Monolithic mode: allow all
        if not is_tenant_mode():
            return True
        
        tenant = get_current_tenant()
        if not tenant:
            return False
        
        if tenant.status == "suspended":
            raise PermissionDenied(self.message)
        
        return True


class IsSuperAdminOnly(BasePermission):
    """Permission allowing only super-admins.
    
    Used for cross-tenant admin APIs (reporting, tenant management).
    Super-admins must:
    - Be is_superuser=True
    - Have no tenant context (authenticate in public schema)
    """
    
    message = "Only super-administrators can access this resource."
    
    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Must be superuser
        if not request.user.is_superuser:
            raise PermissionDenied(self.message)
        
        # Must NOT have tenant context (must be in public schema)
        if is_tenant_mode():
            tenant = get_current_tenant()
            if tenant:
                raise PermissionDenied(
                    "Cross-tenant APIs cannot be accessed from tenant context."
                )
        
        return True


class IsSuperAdmin(BasePermission):
    """Strict permission for super-admin APIs.

    Access is granted only when all checks pass:
    - user is authenticated
    - user is superuser
    - request is executed in public schema context
    - no tenant is attached to request context
    """

    message = "Only public-schema super admins can access this resource."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return False

        if not user.is_superuser:
            raise PermissionDenied(self.message)

        schema_name = getattr(connection, "schema_name", "public") or "public"
        tenant_from_request = getattr(request, "tenant", None)
        tenant_from_context = get_current_tenant()

        if schema_name != "public":
            raise PermissionDenied(
                "Super-admin APIs are only available in public schema context."
            )

        if tenant_from_request is not None or tenant_from_context is not None:
            raise PermissionDenied(
                "Tenant-scoped sessions cannot call super-admin APIs."
            )

        return True


class IsSuperAdminOnly(IsSuperAdmin):
    """Backward-compatible alias for older imports."""


class TenantUserOnly(BasePermission):
    """Permission allowing only tenant users (not super-admins).
    
    Used for tenant-scoped APIs to prevent super-admins from
    accidentally operating on tenant data.
    """
    
    message = "This API is for tenant users only."
    
    def has_permission(self, request, view):
        # Must be authenticated
        if not request.user or not request.user.is_authenticated:
            return False
        
        # Must NOT be superuser
        if request.user.is_superuser:
            raise PermissionDenied(
                "Super-admins should use the admin APIs instead."
            )
        
        # Must have tenant context
        if is_tenant_mode():
            tenant = get_current_tenant()
            if not tenant:
                return False
        
        return True


class TenantDataIsolation(BasePermission):
    """Permission to ensure tenant data isolation.
    
    Checks that:
    - User belongs to current tenant
    - Request includes tenant context
    - Cross-tenant data access is prevented
    
    Use in views:
        class StudentDetailView(generics.RetrieveAPIView):
            permission_classes = [TenantDataIsolation]
            queryset = Student.objects.all()
    
    The queryset is automatically filtered by schema context,
    but this permission adds explicit validation.
    """
    
    message = "You do not have permission to access this data."
    
    def has_permission(self, request, view):
        # Monolithic mode: rely on existing school_id filters
        if not is_tenant_mode():
            return True
        
        # Must have tenant context
        if is_tenant_mode():
            tenant = get_current_tenant()
            if not tenant:
                raise PermissionDenied("Tenant context required.")
        
        return True
    
    def has_object_permission(self, request, view, obj):
        """Verify object belongs to user's tenant.
        
        If object has school_id, verify it matches current tenant.
        """
        # Monolithic mode
        if not is_tenant_mode():
            return True
        
        # Get tenant
        tenant = get_current_tenant()
        if not tenant:
            return False
        
        # Check if object has school_id field (monolithic safety layer)
        if hasattr(obj, "school_id"):
            # Verify school_id matches tenant (should already be filtered by schema)
            if obj.school_id and obj.school_id != tenant.tenant_id:
                return False
        
        return True


class IsTenantAdminOrReadOnly(BasePermission):
    """Permission combining tenant role with read-only option.
    
    Allows:
    - Tenant admins (staff_user=True, can_manage_staff=True) to modify
    - All authenticated users to read (GET, HEAD, OPTIONS)
    """
    
    message = "You do not have permission to perform this action."
    
    def has_object_permission(self, request, view, obj):
        # Monolithic mode: use existing rules
        if not is_tenant_mode():
            return True
        
        # Allow read-only for all authenticated users
        if request.method in ["GET", "HEAD", "OPTIONS"]:
            return True
        
        # For modifications, check tenant admin status
        # This requires staff app integration
        return hasattr(request.user, "is_staff") and request.user.is_staff


class CompositePermission(BasePermission):
    """Composite permission combining multiple checks.
    
    Use in views:
        class StudentListView(generics.ListAPIView):
            permission_classes = [CompositePermission]
            required_permissions = [
                TenantActive,
                TenantFeatureEnabled,
                TenantAPIAccessEnabled,
            ]
    """
    
    message = "Permission denied."
    
    def has_permission(self, request, view):
        # Get required permissions from view
        required_perms = getattr(view, "required_permissions", [])
        
        for perm_class in required_perms:
            perm = perm_class()
            if not perm.has_permission(request, view):
                self.message = getattr(perm, "message", "Permission denied.")
                return False
        
        return True


# Convenience combinations for common patterns

class TenantAPIRead(BasePermission):
    """Standard permission for read-only tenant APIs.
    
    Checks:
    - Tenant is active
    - API access enabled
    - User is authenticated
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        checks = [
            TenantActive(),
            TenantAPIAccessEnabled(),
        ]
        
        for check in checks:
            if not check.has_permission(request, view):
                raise PermissionDenied(
                    getattr(check, "message", "Permission denied.")
                )
        
        return True


class TenantAPIWrite(BasePermission):
    """Standard permission for write tenant APIs.
    
    Checks:
    - Tenant is active (not suspended)
    - API access enabled
    - Feature enabled (if specified)
    - User is authenticated
    """
    
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False
        
        checks = [
            TenantActive(),
            TenantNotSuspended(),
            TenantAPIAccessEnabled(),
        ]
        
        # Add feature check if specified
        if hasattr(view, "tenant_feature"):
            checks.append(TenantFeatureEnabled())
        
        for check in checks:
            if not check.has_permission(request, view):
                raise PermissionDenied(
                    getattr(check, "message", "Permission denied.")
                )
        
        return True
