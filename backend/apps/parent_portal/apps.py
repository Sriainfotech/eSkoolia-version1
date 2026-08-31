from django.apps import AppConfig


class ParentPortalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.parent_portal"
    verbose_name = "Parent Portal"

    def ready(self):
        from . import portal_scopes  # noqa: F401 — registers portal-scope resolvers
