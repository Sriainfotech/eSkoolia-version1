"""Tenant audit logging for provisioning and operational events."""
import logging
from django.conf import settings
from apps.tenancy.models import TenantAuditLog

logger = logging.getLogger(__name__)


def log_audit(
    action,
    tenant_id=None,
    schema_name=None,
    status="success",
    actor_user=None,
    actor_ip=None,
    details=None,
    error_message=None,
    duration_ms=None,
):
    """Create an audit log entry for a provisioning action.
    
    Designed to be called from provisioning utilities.
    All audits are stored in the PUBLIC schema.
    """
    try:
        actor_user_id = None
        actor_username = None
        
        if actor_user:
            actor_user_id = actor_user.id
            actor_username = actor_user.username
        
        audit = TenantAuditLog.objects.create(
            tenant_id=tenant_id,
            schema_name=schema_name,
            action=action,
            status=status,
            actor_user_id=actor_user_id,
            actor_username=actor_username,
            actor_ip=actor_ip,
            details=details or {},
            error_message=error_message,
            duration_ms=duration_ms,
        )
        
        logger.info(
            f"Audit logged: action={action} tenant_id={tenant_id} schema_name={schema_name} status={status}"
        )
        return audit
    except Exception as exc:
        logger.error(f"Failed to log audit entry: {exc}", exc_info=True)
        return None

