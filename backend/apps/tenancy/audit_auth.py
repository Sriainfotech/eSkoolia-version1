"""Tenant-aware audit logging for authentication and authorization events.

This module provides:
1. Auth attempt logging
2. Auth success/failure logging
3. JWT validation logging
4. RBAC event logging
5. Tenant context capture in all logs
"""
import logging
from typing import Optional

from django.contrib.auth import get_user_model
from django.conf import settings
from django.utils import timezone

from .context import (
    get_current_tenant,
    get_current_schema,
    get_current_subdomain,
    get_current_tenant_id,
)
from .models import TenantAuditLog

logger = logging.getLogger(__name__)
User = get_user_model()


def log_auth_attempt(
    username: str,
    auth_method: str,
    success: bool,
    error_message: Optional[str] = None,
    request_ip: Optional[str] = None,
    details: Optional[dict] = None,
) -> Optional[TenantAuditLog]:
    """Log an authentication attempt.
    
    Args:
        username: Username or email attempting to authenticate
        auth_method: Auth method (jwt, password, ldap, etc.)
        success: Whether authentication succeeded
        error_message: Error message if auth failed
        request_ip: Client IP address
        details: Additional context (headers, user agent, etc.)
        
    Returns:
        TenantAuditLog instance if created, None if feature disabled
    """
    if not getattr(settings, "MULTI_TENANCY_ENABLED", False):
        # Audit logging still happens in monolithic mode
        # but without tenant context
        pass
    
    try:
        tenant = get_current_tenant()
        schema_name = get_current_schema()
        subdomain = get_current_subdomain()
        
        action = "auth_success" if success else "auth_failed"
        status = "success" if success else "failed"
        
        # Build details dict
        log_details = details or {}
        log_details.update({
            "username": username,
            "auth_method": auth_method,
            "subdomain": subdomain,
        })
        
        # Try to find the user
        actor_user_id = None
        actor_username = username
        
        try:
            if success:
                # Only lookup user if auth succeeded
                user = User.objects.get(username=username)
                actor_user_id = user.id
                actor_username = user.username
        except User.DoesNotExist:
            pass
        
        # Create audit log in public schema
        audit_log = TenantAuditLog.objects.create(
            tenant_id=tenant.tenant_id if tenant else None,
            schema_name=schema_name,
            action=action,
            status=status,
            actor_user_id=actor_user_id,
            actor_username=actor_username,
            actor_ip=request_ip,
            details=log_details,
            error_message=error_message,
        )
        
        logger.info(
            f"Auth {status}: {username} via {auth_method} "
            f"(tenant={tenant.tenant_id if tenant else 'public'} "
            f"subdomain={subdomain})"
        )
        
        return audit_log
    
    except Exception as exc:
        logger.exception(f"Failed to log auth attempt for {username}: {exc}")
        return None


def log_jwt_validation(
    token_valid: bool,
    error_reason: Optional[str] = None,
    request_ip: Optional[str] = None,
) -> Optional[TenantAuditLog]:
    """Log JWT token validation event.
    
    Args:
        token_valid: Whether JWT token was valid
        error_reason: Reason for validation failure (if failed)
        request_ip: Client IP address
        
    Returns:
        TenantAuditLog instance if created
    """
    try:
        tenant = get_current_tenant()
        schema_name = get_current_schema()
        subdomain = get_current_subdomain()
        
        action = "jwt_validated" if token_valid else "jwt_invalid"
        status = "success" if token_valid else "failed"
        
        audit_log = TenantAuditLog.objects.create(
            tenant_id=tenant.tenant_id if tenant else None,
            schema_name=schema_name,
            action=action,
            status=status,
            actor_ip=request_ip,
            details={
                "subdomain": subdomain,
            },
            error_message=error_reason,
        )
        
        return audit_log
    
    except Exception as exc:
        logger.exception(f"Failed to log JWT validation: {exc}")
        return None


def log_rbac_check(
    action: str,
    resource: str,
    user_id: int,
    allowed: bool,
    reason: Optional[str] = None,
    request_ip: Optional[str] = None,
) -> Optional[TenantAuditLog]:
    """Log RBAC (Role-Based Access Control) check.
    
    Args:
        action: Action name (view, edit, delete, etc.)
        resource: Resource type (Student, Teacher, etc.)
        user_id: User attempting access
        allowed: Whether action was allowed
        reason: Reason (permission name, role name, etc.)
        request_ip: Client IP address
        
    Returns:
        TenantAuditLog instance if created
    """
    try:
        tenant = get_current_tenant()
        schema_name = get_current_schema()
        
        action_name = f"rbac_{action}_{'allowed' if allowed else 'denied'}"
        status = "success" if allowed else "failed"
        
        audit_log = TenantAuditLog.objects.create(
            tenant_id=tenant.tenant_id if tenant else None,
            schema_name=schema_name,
            action=action_name,
            status=status,
            actor_user_id=user_id,
            actor_ip=request_ip,
            details={
                "action": action,
                "resource": resource,
                "reason": reason,
            },
        )
        
        return audit_log
    
    except Exception as exc:
        logger.exception(f"Failed to log RBAC check: {exc}")
        return None


def log_schema_switch(
    schema_name: str,
    tenant_id: str,
    success: bool,
    error_message: Optional[str] = None,
) -> Optional[TenantAuditLog]:
    """Log schema switching event.
    
    Args:
        schema_name: Schema being switched to
        tenant_id: Tenant ID
        success: Whether switch succeeded
        error_message: Error if failed
        
    Returns:
        TenantAuditLog instance if created
    """
    try:
        action = "schema_switched" if success else "schema_switch_failed"
        status = "success" if success else "failed"
        
        audit_log = TenantAuditLog.objects.create(
            tenant_id=tenant_id,
            schema_name=schema_name,
            action=action,
            status=status,
            details={
                "target_schema": schema_name,
            },
            error_message=error_message,
        )
        
        return audit_log
    
    except Exception as exc:
        logger.exception(f"Failed to log schema switch: {exc}")
        return None


def log_unauthorized_access_attempt(
    resource: str,
    user_id: Optional[int],
    reason: str,
    request_ip: Optional[str] = None,
) -> Optional[TenantAuditLog]:
    """Log unauthorized access attempts.
    
    Args:
        resource: Resource being accessed
        user_id: User ID (if authenticated)
        reason: Reason access was denied
        request_ip: Client IP address
        
    Returns:
        TenantAuditLog instance if created
    """
    try:
        tenant = get_current_tenant()
        schema_name = get_current_schema()
        
        audit_log = TenantAuditLog.objects.create(
            tenant_id=tenant.tenant_id if tenant else None,
            schema_name=schema_name,
            action="unauthorized_access_attempt",
            status="failed",
            actor_user_id=user_id,
            actor_ip=request_ip,
            details={
                "resource": resource,
                "reason": reason,
            },
            error_message=f"Unauthorized access to {resource}",
        )
        
        logger.warning(
            f"Unauthorized access attempt: user_id={user_id} "
            f"resource={resource} reason={reason} ip={request_ip}"
        )
        
        return audit_log
    
    except Exception as exc:
        logger.exception(f"Failed to log unauthorized access: {exc}")
        return None


def get_auth_audit_log(
    tenant_id: Optional[str] = None,
    user_id: Optional[int] = None,
    limit: int = 10,
) -> list:
    """Retrieve auth-related audit log entries.
    
    Args:
        tenant_id: Filter by tenant ID
        user_id: Filter by user ID
        limit: Maximum entries to return
        
    Returns:
        List of TenantAuditLog instances
    """
    queryset = TenantAuditLog.objects.filter(
        action__in=[
            "auth_success",
            "auth_failed",
            "jwt_validated",
            "jwt_invalid",
        ]
    )
    
    if tenant_id:
        queryset = queryset.filter(tenant_id=tenant_id)
    
    if user_id:
        queryset = queryset.filter(actor_user_id=user_id)
    
    return list(queryset.order_by("-created_at")[:limit])
