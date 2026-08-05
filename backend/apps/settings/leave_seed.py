"""Auto-seeds a school's built-in leave types the first time Settings >
Leave Policy is opened for that school — mirrors Royal HRMS's
LeavePolicyView._ensure_policies() pattern, but with values grounded in
actual Indian school-staff leave practice rather than a generic port:

- Casual Leave: 12/yr, short-notice, not carried forward (matches the
  well-established "CL is not earned by duty, max ~12-15/yr" convention
  used across Indian government/education leave rules).
- Earned Leave: 15/yr, carries forward (the "privilege leave" staff accrue
  and can bank).
- Medical Leave: 12/yr, requires a medical certificate after 2 consecutive
  days (standard sick-leave documentation threshold).
- Maternity Leave: 182 days (~26 weeks) per the Maternity Benefit Act,
  1961 — female-only, requires 180 days (~6 months) of prior service,
  medical certificate required. Does not distinguish permanent/contract
  staff, matching the Act's own text.
- Paternity Leave: 15 days, male-only — the long-standing central-government
  benchmark, extended to private/aided schools by Delhi HC precedent
  (2009) even without an explicit school policy.
- Loss of Pay: uncapped/tracking-only, unpaid, the fallback once other
  balances are exhausted.

Schools can edit every field of these (including renaming/deactivating)
except deleting them outright (`is_builtin=True` blocks delete) — matches
Royal HRMS's own "built-in types cannot be deleted" rule.
"""
from apps.hr.models import LeaveType


def _default_leave_types():
    return [
        {
            "name": "Casual Leave", "max_days_per_year": 12, "is_paid": True,
            "can_carry_forward": False, "minimum_notice_period": 1,
        },
        {
            "name": "Earned Leave", "max_days_per_year": 15, "is_paid": True,
            "can_carry_forward": True, "carry_forward_type": LeaveType.CARRY_FORWARD_LIMITED,
            "max_carry_forward_days": 15, "minimum_notice_period": 3,
        },
        {
            "name": "Medical Leave", "max_days_per_year": 12, "is_paid": True,
            "can_carry_forward": False, "medical_certificate_required": True,
            "medical_certificate_after_days": 2,
        },
        {
            "name": "Maternity Leave", "max_days_per_year": 182, "is_paid": True,
            "can_carry_forward": False, "applicable_gender": LeaveType.GENDER_FEMALE,
            "minimum_service_period": 6, "medical_certificate_required": True,
            "minimum_notice_period": 30,
            "policy_note": "26 weeks paid leave per the Maternity Benefit Act, 1961 (12 weeks from the third child). Requires at least 180 days of service in the preceding 12 months.",
        },
        {
            "name": "Paternity Leave", "max_days_per_year": 15, "is_paid": True,
            "can_carry_forward": False, "applicable_gender": LeaveType.GENDER_MALE,
            "minimum_notice_period": 7,
        },
        {
            "name": "Loss of Pay", "max_days_per_year": 0, "is_paid": False,
            "can_carry_forward": False, "convert_to_lop": True,
        },
    ]


def ensure_default_leave_types(school_id):
    """Idempotent — only creates types that don't already exist by name for
    this school. Never overwrites a school's own edits to an existing row."""
    existing_names = set(
        LeaveType.objects.filter(school_id=school_id).values_list("name", flat=True)
    )
    for defaults in _default_leave_types():
        if defaults["name"] in existing_names:
            continue
        LeaveType.objects.create(school_id=school_id, is_builtin=True, **defaults)
