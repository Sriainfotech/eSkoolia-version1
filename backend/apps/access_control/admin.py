from django.contrib import admin
from .models import ModuleAccessTier, Permission, Role, RoleModuleAccess, RolePermission, RoleTemplate, UserRole


@admin.register(Permission)
class PermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "code", "name", "module")
    search_fields = ("code", "name", "module")


@admin.register(Role)
class RoleAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "school", "is_system")
    search_fields = ("name",)
    list_filter = ("is_system", "school")


@admin.register(RolePermission)
class RolePermissionAdmin(admin.ModelAdmin):
    list_display = ("id", "role", "permission")


@admin.register(UserRole)
class UserRoleAdmin(admin.ModelAdmin):
    list_display = ("id", "user", "role")


@admin.register(ModuleAccessTier)
class ModuleAccessTierAdmin(admin.ModelAdmin):
    list_display = ("module", "tier", "permission_count")
    list_filter = ("module", "tier")
    filter_horizontal = ("permissions",)

    @admin.display(description="Permissions")
    def permission_count(self, obj):
        return obj.permissions.count()


@admin.register(RoleModuleAccess)
class RoleModuleAccessAdmin(admin.ModelAdmin):
    list_display = ("role", "module", "tier")
    list_filter = ("module", "tier")
    search_fields = ("role__name", "module")


@admin.register(RoleTemplate)
class RoleTemplateAdmin(admin.ModelAdmin):
    list_display = ("name", "description", "created_at")
    search_fields = ("name",)
