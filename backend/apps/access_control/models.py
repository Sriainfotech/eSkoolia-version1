from django.db import models


class AccessTier(models.TextChoices):
    NONE = "none", "No Access"
    VIEW = "view", "View Only"
    OPERATE = "operate", "Operate"
    MANAGE = "manage", "Manage"
    FULL = "full", "Full Access"


class Permission(models.Model):
    code = models.CharField(max_length=120, unique=True)
    name = models.CharField(max_length=255)
    module = models.CharField(max_length=120)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "permissions"
        ordering = ["module", "code"]

    def __str__(self) -> str:
        return self.code


class Role(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="roles", null=True, blank=True)
    name = models.CharField(max_length=30)
    is_system = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    permissions = models.ManyToManyField(Permission, through="RolePermission", related_name="roles")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "roles"
        ordering = ["name"]
        constraints = [
            # nulls_distinct=False makes PostgreSQL 15 treat (NULL,"X") and (NULL,"X") as
            # duplicates — fixing the standard NULL != NULL loophole in unique constraints.
            models.UniqueConstraint(
                fields=["school", "name"],
                name="uq_role_school_name",
                nulls_distinct=False,
            ),
        ]

    def __str__(self) -> str:
        return self.name


class RolePermission(models.Model):
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="role_permissions")
    permission = models.ForeignKey(Permission, on_delete=models.CASCADE, related_name="permission_roles")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "role_permissions"
        constraints = [
            models.UniqueConstraint(fields=["role", "permission"], name="uq_role_permission"),
        ]


class UserRole(models.Model):
    user = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "user_roles"
        constraints = [
            models.UniqueConstraint(fields=["user", "role"], name="uq_user_role"),
        ]


class ModuleAccessTier(models.Model):
    """
    Maps a (module_key, tier) pair to the exact set of permissions that tier grants.
    Seeded by the seed_module_tiers management command; editable in Django admin.
    Stores the FULL cumulative set per tier for simpler sync.
    """
    module = models.CharField(max_length=120)
    tier = models.CharField(max_length=20, choices=AccessTier.choices)
    permissions = models.ManyToManyField(
        Permission,
        blank=True,
        related_name="module_access_tiers",
    )

    class Meta:
        db_table = "module_access_tiers"
        constraints = [
            models.UniqueConstraint(fields=["module", "tier"], name="uq_module_tier"),
        ]
        ordering = ["module", "tier"]

    def __str__(self) -> str:
        return f"{self.module}:{self.tier}"


class RoleModuleAccess(models.Model):
    """
    Stores the chosen tier for a role+module combination.
    When saved, the sync service updates RolePermission rows for that module.
    """
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="module_accesses")
    module = models.CharField(max_length=120)
    tier = models.CharField(max_length=20, choices=AccessTier.choices, default=AccessTier.NONE)

    class Meta:
        db_table = "role_module_accesses"
        constraints = [
            models.UniqueConstraint(fields=["role", "module"], name="uq_role_module_access"),
        ]
        ordering = ["module"]

    def __str__(self) -> str:
        return f"{self.role.name}:{self.module}:{self.tier}"


class RoleTemplate(models.Model):
    """
    Pre-set module tiers for common school roles.
    Used when creating a new role to pre-fill sensible defaults.
    module_tiers is a JSON dict: { "fees": "none", "academics": "operate", ... }
    """
    name = models.CharField(max_length=120, unique=True)
    description = models.TextField(blank=True)
    module_tiers = models.JSONField(default=dict)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "role_templates"
        ordering = ["name"]

    def __str__(self) -> str:
        return self.name
