from __future__ import annotations

from decimal import Decimal, ROUND_HALF_UP
from uuid import uuid4

from django.utils import timezone

from apps.tenancy.audit import log_audit


def get_client_ip(request) -> str:
    forwarded = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "")


def audit_super_admin_action(*, request, action: str, tenant_id: str | None = None, status: str = "success", details: dict | None = None, error_message: str | None = None):
    """Write an audit record for super-admin actions in public schema."""
    log_audit(
        action=action,
        tenant_id=tenant_id,
        status=status,
        actor_user=request.user if getattr(request, "user", None) and request.user.is_authenticated else None,
        actor_ip=get_client_ip(request),
        details=details or {},
        error_message=error_message,
    )


def to_money(value) -> float:
    return float(Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP))


def current_month_range():
    now = timezone.now().date()
    start = now.replace(day=1)
    if start.month == 12:
        next_month = start.replace(year=start.year + 1, month=1, day=1)
    else:
        next_month = start.replace(month=start.month + 1, day=1)
    return start, next_month


def previous_month_range():
    current_start, _ = current_month_range()
    prev_end = current_start
    if current_start.month == 1:
        prev_start = current_start.replace(year=current_start.year - 1, month=12, day=1)
    else:
        prev_start = current_start.replace(month=current_start.month - 1, day=1)
    return prev_start, prev_end


def build_invoice_number() -> str:
    now = timezone.now()
    return f"INV-{now:%Y%m}-{str(uuid4())[:8].upper()}"
