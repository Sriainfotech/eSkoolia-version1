from django.db.models import Q

from apps.core.models import Holiday


def get_calendar_holiday(school_id, target_date):
    """Return the active core.Holiday covering target_date for this school
    (school-specific, or a platform-wide/global one), or None.

    Shared by every attendance write path — the class-marking endpoint, the
    single-record serializer, the bulk file import, and the chatbot
    quick-mark tool — so "this date is a holiday" means the same thing
    everywhere the calendar is consulted.
    """
    if not school_id or not target_date:
        return None
    base_qs = Holiday.objects.filter(active_status=True).filter(
        Q(date=target_date) | Q(date__lte=target_date, end_date__gte=target_date)
    )
    return base_qs.filter(school_id=school_id).first() or base_qs.filter(school__isnull=True).first()
