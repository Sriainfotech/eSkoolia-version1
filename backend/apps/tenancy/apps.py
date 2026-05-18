from django.apps import AppConfig


class TenancyConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.tenancy"

    def ready(self):
        # Register system checks without changing request handling behavior.
        from . import checks  # noqa: F401
