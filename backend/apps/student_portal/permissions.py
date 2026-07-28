from rest_framework.permissions import BasePermission


class IsStudentPortalUser(BasePermission):
    message = (
        "Access restricted to student portal users with an active student profile."
    )

    def has_permission(self, request, view):
        user = request.user
        if not user or not user.is_authenticated:
            return False
        if user.is_superuser:
            return False

        has_student_role = (
            user.user_roles.select_related("role")
            .filter(
                role__portal_type="student",
                role__is_active=True,
            )
            .exists()
        )
        if not has_student_role:
            return False

        return hasattr(user, "student_profile") and user.student_profile is not None
