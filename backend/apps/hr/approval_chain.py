"""Resolves and advances a LeaveRequest's approval chain.

Approvers are roles (HOD / Principal / Vice Principal / HR Admin), resolved
to an actual person only when a step is created — a policy edit never
rewrites history on in-flight requests since each step snapshots its own
role_label/response_window_days.

Resolution:
- HOD            -> the staff's Department.head
- Principal /
  Vice Principal -> an active Staff member in the same school whose
                     Designation name matches (this project already uses
                     these exact strings for Designation.reports_to)
- HR Admin       -> any school-admin user for that school

If a role can't be resolved to anyone, the step is still created with
approver=None ("unavailable") — human_resource.apply_leave.view holders
who are school admins can still act on it (the "Admin override" path).
"""
from django.contrib.auth import get_user_model
from django.utils import timezone

from .models import ApprovalChainPolicy, LeaveApprovalStep, LeaveRequest, Staff

User = get_user_model()

DEFAULT_L1_ROLE = ApprovalChainPolicy.ROLE_HOD
DEFAULT_RESPONSE_WINDOW_DAYS = 2


def get_policy_for_staff(staff):
    policy = ApprovalChainPolicy.objects.filter(school_id=staff.school_id, designation_id=staff.designation_id).first()
    if policy:
        return policy
    return ApprovalChainPolicy.objects.filter(school_id=staff.school_id, designation__isnull=True).first()


def resolve_role_to_user(staff, role_label):
    if not role_label:
        return None
    if role_label == ApprovalChainPolicy.ROLE_HOD:
        department = staff.department
        if department and department.head_id and department.head.user_id:
            return department.head.user
        return None
    if role_label in (ApprovalChainPolicy.ROLE_PRINCIPAL, ApprovalChainPolicy.ROLE_VICE_PRINCIPAL):
        candidate = (
            Staff.objects.filter(
                school_id=staff.school_id,
                designation__name__iexact=role_label,
                status=Staff.STATUS_ACTIVE,
            )
            .exclude(pk=staff.pk)
            .exclude(user__isnull=True)
            .select_related("user")
            .first()
        )
        return candidate.user if candidate else None
    if role_label == ApprovalChainPolicy.ROLE_HR_ADMIN:
        return (
            User.objects.filter(school_id=staff.school_id, is_school_admin=True)
            .exclude(pk=staff.user_id)
            .first()
        )
    return None


def _create_step(leave_request, sequence, role_label, response_window_days):
    approver = resolve_role_to_user(leave_request.staff, role_label)
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
    policy = get_policy_for_staff(leave_request.staff)
    l1_role = (policy.l1_approver_role if policy else DEFAULT_L1_ROLE) or DEFAULT_L1_ROLE
    response_window = policy.response_window_days if policy else DEFAULT_RESPONSE_WINDOW_DAYS
    return _create_step(leave_request, sequence=1, role_label=l1_role, response_window_days=response_window)


def advance_after_step_approval(leave_request, approved_step):
    """Called right after a step is marked approved. Creates the L2 step
    when the policy requires it for this request's duration; otherwise
    returns True to signal the whole request is now fully approved."""
    if approved_step.sequence != 1:
        return True

    policy = get_policy_for_staff(leave_request.staff)
    if not policy or not policy.l2_approver_role or not policy.l2_trigger_days:
        return True

    from .holiday_utils import compute_leave_days
    duration = compute_leave_days(
        leave_request.school_id, leave_request.leave_type, leave_request.from_date, leave_request.to_date,
    )
    if duration < policy.l2_trigger_days:
        return True

    _create_step(
        leave_request, sequence=2, role_label=policy.l2_approver_role,
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
