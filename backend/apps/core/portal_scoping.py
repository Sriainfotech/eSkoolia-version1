"""
Portal-aware data scoping.

Two things live here:

1. `scope_to_school` — the single school-tenant filter, extracted out of the
   three near-duplicate implementations that used to live in
   `apps.core.viewsets.PaginatedModelViewSet`, `apps.core.views.TenantQueryMixin`,
   and `apps.academics.views.TenantScopedModelViewSet`. Those three classes still
   exist (many ViewSets across the codebase inherit them) — they now delegate
   to this function instead of each repeating the same filter.

2. A resolver registry + `PortalScopeFilterBackend` for portal-aware scoping
   (teacher/parent/student), piloted on `ClassRoutineSlot`. An app registers a
   resolver for a (model, portal_type) pair near its own existing scope logic
   — this module holds no join logic itself, only the lookup/dispatch.
"""

from rest_framework.filters import BaseFilterBackend


def scope_to_school(queryset, model, user):
    """Filter `queryset` to `user.school_id`. Returns none() if the user has no school."""
    if not getattr(user, "school_id", None):
        return queryset.none()
    return queryset.filter(school_id=user.school_id)


_REGISTRY = {}


def register_portal_scope(model, portal_type):
    """
    Decorator: register `fn(queryset, user) -> queryset` as the scope resolver
    for `model` under `portal_type` (e.g. "teacher", "parent", "student").
    """

    def decorator(fn):
        _REGISTRY[(model, portal_type)] = fn
        return fn

    return decorator


class PortalScopeFilterBackend(BaseFilterBackend):
    """
    Narrows a queryset to what the requesting user's portal is allowed to see.

    Admin/custom portals are left untouched here — their scoping (school +
    RBAC permission_codes) is already applied by the view's own get_queryset
    and permission checks. Teacher/parent/student requests are narrowed
    further via a registered resolver. An unregistered (model, portal_type)
    pair fails closed (queryset.none()) rather than silently returning
    everything.
    """

    ADMIN_LIKE = {"admin", "custom"}

    def filter_queryset(self, request, queryset, view):
        user = request.user
        portal_type = user.resolve_portal_type()
        if portal_type in self.ADMIN_LIKE:
            return queryset

        resolver = _REGISTRY.get((queryset.model, portal_type))
        if resolver is None:
            return queryset.none()
        return resolver(queryset, user)
