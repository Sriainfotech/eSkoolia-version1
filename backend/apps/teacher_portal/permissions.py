"""
Permission classes for the Teacher Portal.

IsTeacherPortalUser:
  - User must be authenticated
  - User must have portal_type = 'teacher' on at least one active role
  - User must have a linked Staff record (staff_profile)

All teacher portal views use this class. It enforces both identity
(is this a teacher?) and the data-scope check (do they have a staff
record to scope queries against?).
"""

from rest_framework.permissions import BasePermission


class IsTeacherPortalUser(BasePermission):
    message = "Access restricted to teacher portal users with an active staff profile."

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        # Superusers access admin, not teacher portal
        if user.is_superuser:
            return False

        # Must have at least one role with portal_type = 'teacher'
        has_teacher_role = user.user_roles.select_related("role").filter(
            role__portal_type="teacher",
            role__is_active=True,
        ).exists()

        if not has_teacher_role:
            return False

        # Must have a linked staff profile to scope data queries.
        # Check via the Staff model directly to avoid RelatedObjectDoesNotExist.
        from apps.hr.models import Staff
        has_staff = Staff.objects.filter(user=user, school=user.school).exists()
        if not has_staff:
            return False

        return True
