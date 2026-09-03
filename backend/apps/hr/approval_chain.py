"""Resolves and advances a LeaveRequest's approval chain.

Two ways an L1/L2 approver gets resolved to an actual person, tried in order:

1. **Reporting Manager** (Staff.reporting_manager) — an explicit org-chart
   link set on the staff member's profile. When present, L1 = the staff's
   reporting_manager, L2 = that manager's own reporting_manager. This is the
   preferred path since it doesn't depend on Designation/Role naming lining
   up at all.
2. **Approval Chain policy** (ApprovalChainPolicy, matched by the staff's
   designation/department — see get_policy_for_staff) — a Role
   (access_control.Role) is configured per level, resolved to a person via
   resolve_role_to_user():
   - A role named "HOD"            -> the staff's Department.head
   - Any other role                -> an active Staff member whose Designation
                                        name matches the role's name, OR whose
                                        Staff.role is directly set to that same
                                        Role (so a role can resolve to someone
                                        without their job-title Designation
                                        having to spell the role's name),
                                        preferring one in the requester's own
                                        department and falling back to a
                                        school-wide match
   - "HR Admin" / "School Admin" /
     "Admin" (no match otherwise)    -> any school-admin user for that school

Neither path will ever resolve a step to the requester themself. Approvers
are resolved only when a step is created — a policy edit never rewrites
history on in-flight requests, since each step snapshots its own
role_label/response_window_days.

If nobody can be resolved for a step, it's still created with approver=None
("unavailable") — human_resource.apply_leave.view holders who are school
admins can still act on it (the "Admin override" path).
"""
from django.contrib.auth import get_user_model
from django.db.models import Q

from django.utils import timezone

from .models import ApprovalChainPolicy, LeaveApprovalStep, LeaveRequest, Staff

User = get_user_model()

DEFAULT_RESPONSE_WINDOW_DAYS = 2
_ADMIN_ROLE_NAMES = ("hr admin", "school admin", "admin")


def get_policy_for_staff(staff):
    """4-tier match, most specific first: (designation, department) >
    (designation, any department) > (any designation, department) >
    (any designation, any department — "All Staff"). Inactive rules are
    skipped so an admin can disable one without deleting it."""
    base = ApprovalChainPolicy.objects.filter(school_id=staff.school_id, is_active=True)

    policy = base.filter(designation_id=staff.designation_id, department_id=staff.department_id).first()
    if policy:
        return policy

    policy = base.filter(designation_id=staff.designation_id, department__isnull=True).first()
    if policy:
        return policy

    policy = base.filter(designation__isnull=True, department_id=staff.department_id).first()
    if policy:
        return policy

    return base.filter(designation__isnull=True, department__isnull=True).first()


def resolve_role_to_user(staff, role):
    """`role` is an access_control.Role instance (or None)."""
    if not role:
        return None
    role_name = role.name.strip()
    if not role_name:
        return None

    if role_name.upper() == "HOD":
        department = staff.department
        if department and department.head_id and department.head_id != staff.pk and department.head.user_id:
            return department.head.user
        return None

    base_qs = (
        Staff.objects.filter(school_id=staff.school_id, status=Staff.STATUS_ACTIVE)
        .filter(Q(designation__name__iexact=role_name) | Q(role_id=role.id))
        .exclude(pk=staff.pk)
        .exclude(user__isnull=True)
        .select_related("user")
    )
    candidate = None
    if staff.department_id:
        candidate = base_qs.filter(department_id=staff.department_id).first()
    if not candidate:
        candidate = base_qs.first()
    if candidate:
        return candidate.user

    if role_name.lower() in _ADMIN_ROLE_NAMES:
        return User.objects.filter(school_id=staff.school_id, is_school_admin=True).exclude(pk=staff.user_id).first()

    return None


def role_has_resolvable_target(role, school_id):
    """Whether *anyone* in the school could plausibly be resolved for this
    role — used only to warn an admin configuring Configure Policy >
    Approval Chain that the role they're about to pick won't resolve to
    anyone. This is intentionally school-wide/optimistic (it doesn't know
    the eventual requester's department yet, unlike resolve_role_to_user,
    which is scoped per-request) — a role can pass this check and still
    fail to resolve for a specific requester whose own department has no
    match, but a role that fails this check will *never* resolve for
    anyone, which is the case worth surfacing early."""
    if not role:
        return True
    role_name = role.name.strip()
    if not role_name:
        return True

    if role_name.upper() == "HOD":
        from .models import Department
        return Department.objects.filter(school_id=school_id, head__isnull=False).exists()

    if (
        Staff.objects.filter(school_id=school_id, status=Staff.STATUS_ACTIVE)
        .filter(Q(designation__name__iexact=role_name) | Q(role_id=role.id))
        .exclude(user__isnull=True)
        .exists()
    ):
        return True

    if role_name.lower() in _ADMIN_ROLE_NAMES:
        return User.objects.filter(school_id=school_id, is_school_admin=True).exists()

    return False


def _default_l1_role(school_id):
    """Best-effort fallback when a school has no ApprovalChainPolicy at all
    yet (shouldn't normally happen — the "All Staff" policy is created from
    Configure Policy > Approval Chain — but a request must still get an L1
    step). Looks for a Role literally named "HOD"; otherwise leaves L1
    unassigned rather than guessing at an unrelated role."""
    from apps.access_control.models import Role

    return Role.objects.filter(school_id=school_id, name__iexact="HOD").first()


def resolve_l1_approver(staff, policy):
    """Returns (approver_user_or_None, role_label). Prefers the staff
    member's actual Reporting Manager (a real org-chart link, works even
    for roles like "Director" that have no matching Designation/Role at
    all); falls back to the policy's configured L1 role otherwise. The
    label always reflects the configured role's name when one exists, for
    display continuity, regardless of which path actually resolved the
    person."""
    role = policy.l1_approver_role if policy else None
    if not role and not policy:
        role = _default_l1_role(staff.school_id)
    label = role.name if role else ("Reporting Manager" if staff.reporting_manager_id else "")

    manager = staff.reporting_manager
    if manager and manager.user_id and manager.pk != staff.pk:
        return manager.user, label

    return resolve_role_to_user(staff, role), label


def resolve_l2_approver(staff, policy):
    """Returns (approver_user_or_None, role_label). Prefers the Reporting
    Manager's own Reporting Manager (one level up from L1) when both links
    exist; falls back to the policy's configured L2 role otherwise."""
    role = policy.l2_approver_role if policy else None
    label = role.name if role else ("Reporting Manager" if staff.reporting_manager_id else "")

    manager = staff.reporting_manager
    if manager:
        second_level = manager.reporting_manager
        if second_level and second_level.user_id and second_level.pk != staff.pk:
            return second_level.user, label

    return resolve_role_to_user(staff, role), label


def _create_step(leave_request, sequence, role_label, approver, response_window_days):
    return LeaveApprovalStep.objects.create(
        leave_request=leave_request,
        sequence=sequence,
        role_label=role_label,
        approver=approver,
        response_window_days=response_window_days,
        became_active_at=timezone.now(),
    )


def start_chain(leave_request):
    """Create the first (L1) approval step for a newly-created request."""
    staff = leave_request.staff
    policy = get_policy_for_staff(staff)
    approver, role_label = resolve_l1_approver(staff, policy)
    response_window = policy.response_window_days if policy else DEFAULT_RESPONSE_WINDOW_DAYS
    return _create_step(leave_request, sequence=1, role_label=role_label, approver=approver, response_window_days=response_window)


def advance_after_step_approval(leave_request, approved_step):
    """Called right after a step is marked approved. Creates the L2 step
    when the policy requires it for this request's duration; otherwise
    returns True to signal the whole request is now fully approved."""
    if approved_step.sequence != 1:
        return True

    staff = leave_request.staff
    policy = get_policy_for_staff(staff)
    if not policy or not policy.l2_approver_role or not policy.l2_trigger_days:
        return True

    from .holiday_utils import compute_leave_days
    duration = compute_leave_days(
        leave_request.school_id, leave_request.leave_type, leave_request.from_date, leave_request.to_date,
    )
    if duration < policy.l2_trigger_days:
        return True

    approver, role_label = resolve_l2_approver(staff, policy)
    if approver and approved_step.approver_id and approver.id == approved_step.approver_id:
        # L1 and L2 resolved to the same person — one approval is enough,
        # don't ask them to approve their own decision a second time.
        return True

    _create_step(
        leave_request, sequence=2, role_label=role_label, approver=approver,
        response_window_days=policy.response_window_days,
    )
    return False


def current_step(leave_request):
    return leave_request.approval_steps.filter(status=LeaveApprovalStep.STATUS_PENDING).order_by("sequence").first()


def is_stuck(step):
    if not step or step.status != LeaveApprovalStep.STATUS_PENDING:
        return False
    elapsed_days = (timezone.now() - step.became_active_at).days
    return elapsed_days > step.response_window_days


def days_stuck(step):
    if not is_stuck(step):
        return 0
    return (timezone.now() - step.became_active_at).days - step.response_window_days
