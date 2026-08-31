"""
Registers this portal's data-scope resolvers with the shared registry in
apps.core.portal_scoping (see that module for the registry/filter-backend
itself). Imported once at startup by ParentPortalConfig.ready() — nothing
here is called directly, it's import-time registration only.
"""

from django.db.models import Q

from apps.academics.models import ClassRoutineSlot
from apps.core.portal_scoping import register_portal_scope


@register_portal_scope(ClassRoutineSlot, "parent")
def scope_routine_slots_to_parent(queryset, user):
    """Narrow to the guardian's own children's class/section — same source
    data as ParentMeView (request.user.guardian_profile.students)."""
    guardian = getattr(user, "guardian_profile", None)
    if not guardian:
        return queryset.none()

    class_section_pairs = set(
        guardian.students.filter(status="active").values_list(
            "current_class_id", "current_section_id"
        )
    )
    if not class_section_pairs:
        return queryset.none()

    scope = Q()
    for class_id, section_id in class_section_pairs:
        scope |= Q(school_class_id=class_id, section_id=section_id)
    return queryset.filter(scope)
