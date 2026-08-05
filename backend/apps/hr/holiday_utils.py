from datetime import date as date_cls, timedelta

from django.db.models import Q

from apps.attendance.holiday_utils import get_calendar_holiday


def compute_leave_days(school_id, leave_type, from_date, to_date):
    """Count how many days a leave request from from_date to to_date
    (inclusive) actually consumes from the staff's leave balance.

    A calendar holiday inside the range is excluded from the count —
    it's a free pass, same as a normal non-leave day — unless
    leave_type.count_holidays_as_leave is True, in which case it's counted
    like any other day. This is the same policy choice
    resolve_staff_holiday_attendance() uses to decide whether a holiday
    inside an approved leave shows as "H" or "L" on the attendance record;
    here it decides whether that day is deducted from the balance.
    """
    from apps.core.models import Holiday

    total_days = (to_date - from_date).days + 1
    if leave_type.count_holidays_as_leave:
        return total_days

    holidays = Holiday.objects.filter(
        Q(school_id=school_id) | Q(school__isnull=True),
        active_status=True,
        date__lte=to_date,
    ).filter(Q(end_date__isnull=True, date__gte=from_date) | Q(end_date__gte=from_date))

    holiday_dates = set()
    for h in holidays:
        start = max(h.date, from_date)
        end = min(h.end_date or h.date, to_date)
        d = start
        while d <= end:
            holiday_dates.add(d)
            d += timedelta(days=1)

    return total_days - len(holiday_dates)


def compute_leave_days_by_year(school_id, leave_type, from_date, to_date):
    """Same day-count as compute_leave_days, but split at each calendar-year
    boundary and returned as {year: days}. LeaveBalance is keyed per
    (staff, leave_type, year), so a leave request straddling New Year's Eve
    (e.g. Dec 28 -> Jan 3) must deduct from two separate balance rows rather
    than bucketing the whole request into from_date.year.
    """
    by_year: dict[int, int] = {}
    segment_start = from_date
    while segment_start <= to_date:
        year_end = date_cls(segment_start.year, 12, 31)
        segment_end = min(year_end, to_date)
        days = compute_leave_days(school_id, leave_type, segment_start, segment_end)
        if days:
            by_year[segment_start.year] = by_year.get(segment_start.year, 0) + days
        segment_start = segment_end + timedelta(days=1)
    return by_year


def resolve_staff_holiday_attendance(school_id, staff_id, target_date):
    """Decide how a staff member's attendance for target_date should be
    auto-marked when it falls on a core.Holiday.

    Returns None if target_date is not a holiday for this school (caller
    should leave attendance_type untouched). Otherwise returns
    (attendance_type, holiday_name) where attendance_type is:

      - "L" (Leave) if the staff has an APPROVED LeaveRequest covering this
        date AND that leave type's count_holidays_as_leave is True — the
        holiday is absorbed into their leave and consumes their balance,
        per the school's policy choice for that leave type.
      - "H" (Holiday) otherwise — the default free pass every other
        attendance surface already uses, including when the staff is on
        approved leave but count_holidays_as_leave is False (or unset).
    """
    from .models import LeaveRequest, StaffAttendance

    holiday = get_calendar_holiday(school_id, target_date)
    if holiday is None:
        return None

    covering_leave = (
        LeaveRequest.objects.filter(
            staff_id=staff_id,
            status=LeaveRequest.STATUS_APPROVED,
            from_date__lte=target_date,
            to_date__gte=target_date,
        )
        .select_related("leave_type")
        .first()
    )
    if covering_leave is not None and covering_leave.leave_type.count_holidays_as_leave:
        return StaffAttendance.STATUS_LEAVE, holiday.name
    return StaffAttendance.STATUS_HOLIDAY, holiday.name
