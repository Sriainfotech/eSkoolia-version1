"""Coverage-risk and coverage-calendar helpers for LeaveRequest.

"Coverage risk" is intentionally a pure query over existing LeaveRequest /
Staff.department data — there's no timetable/substitute-assignment model.
A request is flagged when enough of the same department is out on
overlapping days that the department is likely short-staffed.
"""
from .models import LeaveRequest

COVERAGE_RISK_THRESHOLD = 2  # 2+ other same-department overlaps => flagged


def overlapping_department_requests(leave_request):
    """Other pending/approved requests from the same department whose date
    range overlaps this request's date range."""
    if not leave_request.staff_id or not leave_request.staff.department_id:
        return LeaveRequest.objects.none()
    return LeaveRequest.objects.filter(
        school_id=leave_request.school_id,
        staff__department_id=leave_request.staff.department_id,
        status__in=[LeaveRequest.STATUS_PENDING, LeaveRequest.STATUS_APPROVED],
        from_date__lte=leave_request.to_date,
        to_date__gte=leave_request.from_date,
    ).exclude(pk=leave_request.pk)


def has_coverage_risk(leave_request):
    return overlapping_department_requests(leave_request).count() >= COVERAGE_RISK_THRESHOLD
