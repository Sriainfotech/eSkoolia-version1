class TenantSyncRouter:
    """Placeholder database router for tenant / shared routing.

    This router is intentionally minimal and must be expanded during the
    phased migration. It exists so import paths referenced in settings
    do not fail when the feature flag is enabled.
    """

    def db_for_read(self, model, **hints):
        return None

    def db_for_write(self, model, **hints):
        return None

    def allow_relation(self, obj1, obj2, **hints):
        return None

    def allow_migrate(self, db, app_label, model_name=None, **hints):
        # Conservative default: allow migrations to run on the default DB.
        return None
