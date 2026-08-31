from django.apps import AppConfig


class TeacherPortalConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.teacher_portal"
    verbose_name = "Teacher Portal"

    def ready(self):
        from . import portal_scopes  # noqa: F401 — registers portal-scope resolvers
