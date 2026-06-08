from rest_framework.permissions import BasePermission


class IsParentPortalUser(BasePermission):
    message = "Access restricted to parent portal users with a linked guardian profile."

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return False

        has_parent_role = user.user_roles.select_related("role").filter(
            role__portal_type="parent",
            role__is_active=True,
        ).exists()

        if not has_parent_role:
            return False

        return hasattr(user, "guardian_profile") and user.guardian_profile is not None
