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

    def get_permission_codes(self) -> set[str]:
        if self.is_superuser:
            return {"*"}

        codes = (
            self.user_roles.select_related("role")
            .prefetch_related("role__permissions")
            .values_list("role__permissions__code", flat=True)
        )
        return {code for code in codes if code}

    def has_permission_code(self, code: str) -> bool:
        permission_codes = self.get_permission_codes()
        return "*" in permission_codes or code in permission_codes
