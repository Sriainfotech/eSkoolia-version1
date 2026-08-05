"""Shared write-path for SettingsAuditLog. A single helper (rather than
inline .objects.create() at every call site, as apps.admissions does) so the
field name can't drift out of sync with call sites the way it did there
(apps.admissions.AuditLog's model field is `actor`, but every call site
passes `user=`, which would raise TypeError — see apps.admissions.models:580
and apps.admissions.views.py's call sites)."""


def log_settings_action(request, action, object_type="", object_id="", changes=None):
    from .models import SettingsAuditLog

    user = getattr(request, "user", None)
    school_id = getattr(user, "school_id", None)
    if not school_id:
        return None

    ip_address = request.META.get("REMOTE_ADDR") if hasattr(request, "META") else None

    return SettingsAuditLog.objects.create(
        school_id=school_id,
        actor=user if getattr(user, "is_authenticated", False) else None,
        action=action,
        object_type=object_type,
        object_id=str(object_id) if object_id else "",
        changes=changes or {},
        ip_address=ip_address,
    )
