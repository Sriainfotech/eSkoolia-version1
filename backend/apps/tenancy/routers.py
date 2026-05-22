from apps.tenancy.context import is_multi_tenancy_enabled

SHARED_APP_LABELS = {
    "tenancy", "users", "super_admin", "access_control",
    "core", "admin", "auth", "contenttypes", "sessions",
    "messages", "staticfiles", "token_blacklist",
}


class TenantSyncRouter:
    """Database router that keeps shared apps on the default schema and
    defers tenant-specific apps to django-tenants when multi-tenancy is on.
    """

    def db_for_read(self, model, **hints):
        return "default"

    def db_for_write(self, model, **hints):
        return "default"

    def allow_relation(self, obj1, obj2, **hints):
        return True

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        if not is_multi_tenancy_enabled():
            # Monolithic mode: all migrations run on the default database.
            return db == "default"
        if app_label in SHARED_APP_LABELS:
            # Shared apps always migrate on default (public schema).
            return db == "default"
        # Tenant-specific apps: defer to django-tenants router.
        return None
