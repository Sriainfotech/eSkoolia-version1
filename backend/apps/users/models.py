from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    email = models.EmailField(blank=True, default="")
    school = models.ForeignKey(
        "tenancy.School",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
    )
    phone = models.CharField(max_length=32, blank=True)
    is_school_admin = models.BooleanField(default=False)
    access_status = models.BooleanField(default=True)
    due_fees_login_blocked = models.BooleanField(default=False)
    must_change_password = models.BooleanField(default=False)

    class Meta:
        db_table = "users"
        constraints = [
            # Unique email only when non-empty — allows multiple users with no email.
            models.UniqueConstraint(
                fields=["email"],
                condition=models.Q(email__gt=""),
                name="users_email_nonempty_uniq",
            ),
        ]

    def resolve_portal_type(self) -> str:
        """
        Resolve a stable portal for login redirects.

        Priority is deterministic and uses only active roles so role deactivation
        immediately affects routing.
        """
        if self.is_superuser or self.is_school_admin:
            return "admin"

        # Lower value means higher priority.
        priority = {
            "teacher": 1,
            "parent": 2,
            "student": 3,
            "custom": 4,
            "admin": 5,
        }

        selected = "admin"
        selected_rank = priority["admin"]

        role_rows = (
            self.user_roles.select_related("role")
            .filter(role__is_active=True)
            .order_by("role_id", "id")
        )
        for row in role_rows:
            role = row.role
            if not role:
                continue
            portal = (role.portal_type or "admin").strip().lower() or "admin"
            rank = priority.get(portal, priority["custom"])
            if rank < selected_rank:
                selected = portal
                selected_rank = rank

        return selected

    def get_permission_codes(self) -> set[str]:
        if self.is_superuser:
            return {"*"}

        codes = (
            self.user_roles.select_related("role")
            .prefetch_related("role__permissions")
            .filter(role__is_active=True)
            .values_list("role__permissions__code", flat=True)
        )
        return {code for code in codes if code}

    def has_permission_code(self, code: str) -> bool:
        permission_codes = self.get_permission_codes()
        return "*" in permission_codes or code in permission_codes
