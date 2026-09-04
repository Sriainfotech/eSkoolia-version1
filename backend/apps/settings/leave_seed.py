"""Auto-seeds a school's built-in leave types the first time Settings >
Leave Policy (or HR > Leave > Configure Policy) is opened for that school —
mirrors Royal HRMS's LeavePolicyView._ensure_policies() pattern, but with
values grounded in actual Indian school-staff leave practice rather than a
generic port:

- Casual Leave: 12/yr, short-notice, not carried forward (matches the
  well-established "CL is not earned by duty, max ~12-15/yr" convention
  used across Indian government/education leave rules).
- Sick Leave: 15/yr, govt-mandated minimum, no certificate required for
  short absences (distinct from the certificate-backed Medical Leave below).
- Earned Leave: 15/yr, carries forward up to 15d, partially encashable (the
  "privilege leave" staff accrue and can bank or cash out).
- Medical Leave: 10/yr, requires a medical certificate after 2 consecutive
  days (standard sick-leave documentation threshold) — kept separate from
  Sick Leave so schools can require paperwork only past a short threshold.
- Maternity Leave: 182 days (~26 weeks) per the Maternity Benefit Act,
  1961 — female-only, requires 180 days (~6 months) of prior service,
  medical certificate required.
- On Duty: paid, unaccrued (staff aren't pre-allocated a bank — approved
  per-instance for official/school-sanctioned absence).
- Compensatory Off: paid, earned for extra duty, carries forward up to 6d.
- Loss of Pay: 30/yr ceiling, unpaid, the fallback once other balances are
  exhausted.

Schools can edit every field of these (including renaming/deactivating)
except deleting them outright (`is_builtin=True` blocks delete) — matches
Royal HRMS's own "built-in types cannot be deleted" rule.
"""
from django.db import models

from apps.hr.models import LeaveDefine, LeaveType


def _default_leave_types():
    return [
        {
            "name": "Casual Leave", "max_days_per_year": 12, "is_paid": True,
            "can_carry_forward": False, "minimum_notice_period": 1, "allow_half_day": True,
        },
        {
            "name": "Sick Leave", "max_days_per_year": 15, "is_paid": True,
            "is_govt_mandated": True, "can_carry_forward": False, "allow_half_day": True,
        },
        {
            "name": "Earned Leave", "max_days_per_year": 15, "is_paid": True,
            "is_govt_mandated": True, "can_carry_forward": True, "carry_forward_type": LeaveType.CARRY_FORWARD_LIMITED,
            "max_carry_forward_days": 15, "minimum_notice_period": 7, "allow_half_day": False,
            "max_encashment_days": 5,
        },
        {
            "name": "Medical Leave", "max_days_per_year": 10, "is_paid": True,
            "can_carry_forward": False, "medical_certificate_required": True,
            "medical_certificate_after_days": 2, "allow_half_day": False,
        },
        {
            "name": "Maternity Leave", "max_days_per_year": 182, "is_paid": True,
            "is_govt_mandated": True, "can_carry_forward": False, "applicable_gender": LeaveType.GENDER_FEMALE,
            "minimum_service_period": 6, "medical_certificate_required": True,
            "minimum_notice_period": 30, "allow_half_day": False,
            "policy_note": "26 weeks paid leave per the Maternity Benefit Act, 1961 (12 weeks from the third child). Requires at least 180 days of service in the preceding 12 months.",
        },
        {
            "name": "On Duty", "max_days_per_year": 24, "is_paid": True,
            "can_carry_forward": False, "minimum_notice_period": 1, "allow_half_day": True,
        },
        {
            "name": "Compensatory Off", "max_days_per_year": 12, "is_paid": True,
            "can_carry_forward": True, "carry_forward_type": LeaveType.CARRY_FORWARD_LIMITED,
            "max_carry_forward_days": 6, "minimum_notice_period": 1, "allow_half_day": True,
        },
        {
            "name": "Loss of Pay", "max_days_per_year": 30, "is_paid": False,
            "can_carry_forward": False, "convert_to_lop": True, "allow_half_day": True,
        },
    ]


# Default "All Staff" entitlement (LeaveDefine.days) per built-in type —
# intentionally separate from max_days_per_year above: the type's ceiling
# is a policy cap, while this is what a role is actually allocated (e.g. On
# Duty / Loss of Pay aren't pre-banked, so All Staff starts at 0 even though
# a request can still be filed and approved against them).
_DEFAULT_ALL_STAFF_ENTITLEMENT = {
    "Casual Leave": 12, "Sick Leave": 15, "Earned Leave": 15, "Medical Leave": 10,
    "Maternity Leave": 182, "On Duty": 0, "Compensatory Off": 6, "Loss of Pay": 0,
}


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


def default_all_staff_entitlement(leave_type_name, fallback_days):
    """Returns the seed "All Staff" day count for a built-in leave type name,
    falling back to `fallback_days` (typically the type's own
    max_days_per_year) for custom/unrecognized types."""
    return _DEFAULT_ALL_STAFF_ENTITLEMENT.get(leave_type_name, fallback_days)


def ensure_default_entitlements(school_id, academic_year):
    """Idempotent — creates the "All Staff" entitlement row for any active
    leave type that doesn't have one yet for this academic year. Never
    touches a row that already exists, so it's safe to call on every read
    (unlike reset_all_staff_entitlements, which is explicitly destructive).

    Runs as 2 queries + an optional bulk_create regardless of leave type
    count — this used to run one .exists() query per leave type (an N+1
    that added a full extra DB round-trip per type on every single GET of
    the entitlement matrix, worth fixing given Neon's per-query network
    latency)."""
    if academic_year is None:
        return
    leave_types = list(LeaveType.objects.filter(school_id=school_id, is_active=True))
    if not leave_types:
        return
    existing_type_ids = set(
        LeaveDefine.objects.filter(
            school_id=school_id, academic_year=academic_year, role__isnull=True,
            student__isnull=True, staff__isnull=True, school_class__isnull=True, section__isnull=True,
            leave_type_id__in=[lt.id for lt in leave_types],
        ).values_list("leave_type_id", flat=True)
    )
    to_create = [
        LeaveDefine(
            school_id=school_id, academic_year=academic_year, leave_type=lt, role=None,
            days=default_all_staff_entitlement(lt.name, lt.max_days_per_year),
        )
        for lt in leave_types if lt.id not in existing_type_ids
    ]
    if to_create:
        LeaveDefine.objects.bulk_create(to_create)


def resolve_entitlements_for_staff(school_id, academic_year, staff_role_id):
    """Returns {leave_type_id: entitled_days} for a specific staff member
    (identified by their access_control.Role id, or None), for the given
    academic year — a role-specific LeaveDefine row wins over the "All
    Staff" (role=None) row for the same leave type. Used to show a real
    balance in the Leave detail drawer even before a LeaveBalance ledger row
    has ever been created for that staff/leave-type/year (see
    apps.hr.views.LeaveRequestViewSet.full_detail)."""
    if academic_year is None:
        return {}
    defines = LeaveDefine.objects.filter(
        school_id=school_id, academic_year=academic_year,
        student__isnull=True, staff__isnull=True, school_class__isnull=True, section__isnull=True,
    ).filter(models.Q(role__isnull=True) | models.Q(role_id=staff_role_id))

    entitlements = {}
    for d in defines:
        if d.role_id is None and d.leave_type_id not in entitlements:
            entitlements[d.leave_type_id] = d.days
        elif d.role_id is not None:
            entitlements[d.leave_type_id] = d.days
    return entitlements


def reset_all_staff_entitlements(school_id, academic_year):
    """Deletes every role-specific entitlement row for this academic year and
    resets the "All Staff" (role=None) row for each active leave type back to
    its seed default — used by Configure Policy > Entitlements > Reset
    defaults."""
    LeaveDefine.objects.filter(
        school_id=school_id, academic_year=academic_year,
        student__isnull=True, staff__isnull=True, school_class__isnull=True, section__isnull=True,
    ).exclude(role__isnull=True).delete()

    for leave_type in LeaveType.objects.filter(school_id=school_id, is_active=True):
        days = default_all_staff_entitlement(leave_type.name, leave_type.max_days_per_year)
        LeaveDefine.objects.update_or_create(
            school_id=school_id, academic_year=academic_year, leave_type=leave_type, role=None,
            student=None, staff=None, school_class=None, section=None,
            defaults={"days": days},
        )
