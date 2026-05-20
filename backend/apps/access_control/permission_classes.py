from django.db import connection
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import BasePermission

from apps.tenancy.context import get_current_tenant


class IsSuperAdmin(BasePermission):
    """
    Strict super-admin permission class for Sprint 1 Super Admin Console.

    Rules:
    - ONLY Django superusers can access super-admin APIs
    - Tenant users must be rejected with 403
    - Public-schema isolation for super-admins only
    - No fallback to permission codes
    """

    message = "Super Admin access required. Tenant users are not authorized."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)

        if not user or not user.is_authenticated:
            return False

        if not user.is_superuser:
            return False

        # NOTE: We intentionally do NOT reject is_superuser users that also
        # carry a school FK.  In this codebase the seed/test `superuser`
        # account can end up bound to a school via provisioning flows; that
        # binding does not weaken security because the two checks below
        # (public schema + no tenant in the request) are the actual
        # isolation boundary for super-admin APIs.

        schema_name = getattr(connection, "schema_name", "public") or "public"
        if schema_name != "public":
            raise PermissionDenied("Super-admin APIs are only available in public schema context.")

        if getattr(request, "tenant", None) is not None or get_current_tenant() is not None:
            raise PermissionDenied("Tenant-scoped sessions cannot call super-admin APIs.")

        return True


class HasPermissionCode(BasePermission):
    required_code = ""

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return True
        return user.has_permission_code(self.required_code)


class CanViewPermissions(HasPermissionCode):
    required_code = "access_control.permission.read"


class CanManageRoles(HasPermissionCode):
    required_code = "access_control.role.manage"


class CanManageUserRoles(HasPermissionCode):
    required_code = "access_control.user_role.manage"
