"""Leave carry-forward computation, shared by the preview and run endpoints
so they can never disagree about what a run would do."""
from decimal import Decimal

from django.db import transaction

from apps.hr.models import LeaveType

from .models import CarryForwardLog, LeaveBalance


def compute_carry_forward(school_id, from_year, to_year):
    """Returns a list of dicts describing what carrying forward from_year ->
    to_year would do, for every LeaveBalance row with can_carry_forward=True
    on its LeaveType. Pure computation — never writes anything."""
    rows = []
    balances = (
        LeaveBalance.objects.filter(school_id=school_id, year=from_year, leave_type__can_carry_forward=True)
        .select_related("staff", "leave_type")
    )
    for balance in balances:
        leave_type = balance.leave_type
        available = balance.available_days
        if available <= 0:
            rows.append({
                "staff_id": balance.staff_id,
                "staff_name": str(balance.staff),
                "leave_type_id": leave_type.id,
                "leave_type_name": leave_type.name,
                "carried_forward": Decimal("0"),
                "skipped_reason": "No unused balance to carry forward.",
            })
            continue

        if leave_type.carry_forward_type == LeaveType.CARRY_FORWARD_LIMITED and leave_type.max_carry_forward_days:
            carry_amount = min(available, Decimal(str(leave_type.max_carry_forward_days)))
        else:
            carry_amount = available

        rows.append({
            "staff_id": balance.staff_id,
            "staff_name": str(balance.staff),
            "leave_type_id": leave_type.id,
            "leave_type_name": leave_type.name,
            "carried_forward": carry_amount,
            "skipped_reason": None if carry_amount > 0 else "Carry-forward amount computed as zero.",
        })
    return rows


@transaction.atomic
def run_carry_forward(school_id, from_year, to_year, user):
    """Applies compute_carry_forward's result: creates/updates each staff's
    to_year LeaveBalance row with the carried-forward amount and a fresh
    total_days allocation from the leave type's current max_days_per_year.
    Records one CarryForwardLog row."""
    from datetime import date, timedelta

    rows = compute_carry_forward(school_id, from_year, to_year)
    processed = 0
    skipped = 0
    failed = 0

    for row in rows:
        if not row["carried_forward"] or row["carried_forward"] <= 0:
            skipped += 1
            continue
        try:
            leave_type = LeaveType.objects.get(id=row["leave_type_id"])
            expiry_date = None
            if leave_type.carry_forward_expiry_days:
                expiry_date = date(to_year, 1, 1) + timedelta(days=leave_type.carry_forward_expiry_days)

            balance, _ = LeaveBalance.objects.get_or_create(
                school_id=school_id, staff_id=row["staff_id"], leave_type_id=row["leave_type_id"], year=to_year,
                defaults={"total_days": leave_type.max_days_per_year},
            )
            balance.carried_forward = row["carried_forward"]
            balance.carry_forward_expiry_date = expiry_date
            if not balance.total_days:
                balance.total_days = leave_type.max_days_per_year
            balance.save(update_fields=["carried_forward", "carry_forward_expiry_date", "total_days", "updated_at"])
            processed += 1
        except Exception:
            failed += 1

    log = CarryForwardLog.objects.create(
        school_id=school_id, from_year=from_year, to_year=to_year, executed_by=user,
        process_mode=CarryForwardLog.MODE_EXECUTED,
        total_processed=processed, total_skipped=skipped, total_failed=failed,
        is_completed=True,
    )
    return log
