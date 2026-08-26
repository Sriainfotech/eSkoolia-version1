"""
Registers this portal's data-scope resolvers with the shared registry in
apps.core.portal_scoping (see that module for the registry/filter-backend
itself). Imported once at startup by TeacherPortalConfig.ready() — nothing
here is called directly, it's import-time registration only.
"""

from apps.academics.models import ClassRoutineSlot
from apps.core.portal_scoping import register_portal_scope

from .utils import get_current_academic_year


@register_portal_scope(ClassRoutineSlot, "teacher")
def scope_routine_slots_to_teacher(queryset, user):
    """Same filter as apps.teacher_portal.utils.build_weekly_timetable."""
    school = getattr(user, "school", None)
    if not school:
        return queryset.none()

    qs = queryset.filter(teacher=user, school=school, active_status=True)
    year = get_current_academic_year(school)
    if year:
        qs = qs.filter(academic_year=year)
    return qs
