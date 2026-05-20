from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import User


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ("username", "email", "first_name", "last_name", "school", "is_school_admin", "is_staff", "is_active")
    list_filter = ("is_school_admin", "is_staff", "is_superuser", "is_active", "school")
    search_fields = ("username", "email", "first_name", "last_name")
    ordering = ("username",)

    fieldsets = BaseUserAdmin.fieldsets + (
        ("School & Access", {
            "fields": ("school", "phone", "is_school_admin", "access_status", "due_fees_login_blocked", "must_change_password"),
        }),
    )
    add_fieldsets = BaseUserAdmin.add_fieldsets + (
        ("School & Access", {
            "fields": ("school", "phone", "is_school_admin", "access_status"),
        }),
    )