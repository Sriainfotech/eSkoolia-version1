# RBAC data scoping: current state and the portal-scope resolver pattern

Status: one endpoint (`GET /api/v1/academics/class-routines/my-schedule/`)
piloted, 2026-08-24. Read this before extending the pattern to another
module, and before assuming more automation exists than actually does.

## The problem this addresses

The platform exposes the same underlying data (timetable, homework, results,
...) to three audiences — school admins, teachers, and parents/students — but
historically through three separate code paths:

1. Generic admin `ModelViewSet`s, RBAC-gated via `apps.access_control`
   permission codes.
2. Hardcoded `APIView`s in `apps/teacher_portal/views.py`, scoped by
   hand-written joins against `ClassTeacherAssignment` / `ClassSubjectAssignment`.
3. Hardcoded `APIView`s in `apps/parent_portal/views.py` (and
   `apps/student_portal/views.py`), scoped via `guardian_profile` /
   `student_profile`.

Adding a feature to the admin backend does not make it appear in the teacher
or parent portal — someone has to hand-write and wire up a matching view for
each portal. That's the gap this pattern narrows, one endpoint at a time.

## Facts worth knowing before touching this code

- **There is no `request.user.portal_type` attribute.** Portal identity is
  resolved per request via `User.resolve_portal_type()`
  (`apps/users/models.py`), which picks the highest-priority *active* role a
  user currently holds: `teacher > parent > student > custom > admin`. A user
  can hold multiple roles; this resolution can change between requests if
  roles change.
- **Admin-side tenant scoping already had three separate implementations**
  before this change: `apps/core/viewsets.py::PaginatedModelViewSet`,
  `apps/core/views.py::TenantQueryMixin`, and a third one locally defined in
  `apps/academics/views.py::TenantScopedModelViewSet`. All three now delegate
  their school-filter line to `apps/core/portal_scoping.py::scope_to_school`
  — a behavior-preserving refactor, not a merge. Any of the ~29 apps'
  ViewSets that inherit these classes are unaffected; their queryset
  behavior is identical to before.
- **Teacher, parent, and student scoping use structurally different join
  paths** — they are not interchangeable:
  - Teacher: `ClassTeacherAssignment` (attendance-eligible classes) and
    `ClassSubjectAssignment` (subject-eligible classes) — both FK'd to
    `users.User` directly. Centralized in `apps/teacher_portal/utils.py`;
    do not re-derive this logic elsewhere.
  - Parent: `request.user.guardian_profile` (a `Guardian` row,
    `apps/students/models.py`) → `guardian.students` → each student's
    `current_class` / `current_section`.
  - Student: `request.user.student_profile` (not yet wired into the
    resolver registry — see "What's next").
- **The frontend's module visibility is already permission-aware**, not the
  hardcoded-and-blind system it might appear to be at a glance. See
  `frontend/lib/portal-modules.ts::getModulesForUser` — it filters each
  portal's module list (`TEACHER_MODULES`, `PARENT_MODULES`, ...) by
  `me.permission_codes` for every portal type, not just admin. What's still
  hardcoded is the *list of possible modules per portal* (a TypeScript
  file), not the visibility decision. No backend `accessible_modules` field
  exists, and building one was deliberately out of scope for this pass since
  it wouldn't fix anything currently broken.

## The pattern: `apps/core/portal_scoping.py`

Two independent pieces live in this one file:

```python
scope_to_school(queryset, model, user)
```
The single school-tenant filter every per-school view needs. Existing base
classes call this internally now instead of repeating it.

```python
register_portal_scope(model, portal_type)   # decorator
PortalScopeFilterBackend                     # DRF BaseFilterBackend
```
A registry apps use to declare "for this model, under this portal type, here
is how to narrow the queryset" — without centralizing the actual join logic
in one god-file. `PortalScopeFilterBackend.filter_queryset()`:

- resolves `request.user.resolve_portal_type()`
- `admin` / `custom` → returns the queryset **unchanged** (admin scoping —
  school + RBAC permission codes — is the calling view's own responsibility,
  same as before this pattern existed)
- otherwise looks up `(queryset.model, portal_type)` in the registry and
  applies the resolver
- **an unregistered `(model, portal_type)` pair returns `queryset.none()`**
  — fail closed. A model that hasn't had a teacher/parent/student resolver
  written for it must never silently expose full data to that portal.

Resolvers are registered where the portal's existing scoping logic already
lives — `apps/teacher_portal/portal_scopes.py` and
`apps/parent_portal/portal_scopes.py` — imported once via each app's
`AppConfig.ready()`. The registry file itself never imports a portal app or
contains a join.

## What was piloted

`apps/academics/views.py::ClassRoutineSlotViewSet` gained one new action,
`GET .../class-routines/my-schedule/`:

- Admin/custom-role callers must still hold `academics.core_setup.view`
  (same gate `list()` enforces) — checked explicitly inside the action,
  because the action is deliberately exempted from the class's blanket
  `permission_codes["*"]` check (see the comment on `permission_codes` in
  `ClassRoutineSlotViewSet`) so that teacher/parent callers, who don't hold
  that admin permission code, aren't blocked by it.
- Teacher/parent callers get the queryset narrowed via the registered
  resolvers, using the exact same filters `apps/teacher_portal/utils.py`
  already used for the existing `TeacherTimetableView`.

**Nothing else changed.** `list()`/`create()`/`update()`/`destroy()` on
`ClassRoutineSlotViewSet` are untouched. `TeacherTimetableView` and every
`parent_portal` view keep serving the frontend exactly as before — the new
endpoint exists alongside them so its output can be diffed against the old
ones before any frontend cutover or deprecation is considered.

## Standard operating procedure to extend this to a new model/portal

1. Confirm the model has a `school` FK (required for `scope_to_school`).
2. Write a resolver function `(queryset, user) -> queryset` in the relevant
   portal app's `portal_scopes.py`, reusing that portal's existing
   scope-utility functions if one already exists (don't re-derive a teacher's
   class assignments from scratch — call into `apps/teacher_portal/utils.py`).
3. `@register_portal_scope(YourModel, "teacher")` (or `"parent"`/`"student"`).
4. In the ViewSet, add a new action that calls
   `PortalScopeFilterBackend().filter_queryset(request, self.get_queryset(), self)`
   — do **not** add `PortalScopeFilterBackend` to the ViewSet's global
   `filter_backends`, since that would also apply it to `list()` and change
   admin behavior. Keep the new action additive.
5. If the ViewSet gates actions via a `permission_codes` dict, add an
   explicit `None` entry for the new action's name so the blanket
   admin-permission-code check doesn't block non-admin portal callers, and
   re-implement the equivalent admin-side check inline (see
   `ClassRoutineSlotViewSet.my_schedule` for the exact shape).
6. Write a test that proves: portal A cannot see portal B's data, and
   neither can see another school's data (the July 2026 cross-school leak
   was exactly this class of bug — treat it as the standing regression to
   guard against).
7. Only after the new endpoint's output has been verified against the old
   hardcoded portal view should the frontend be pointed at it, and only then
   should the old view be considered for removal.

## What's next (not done yet)

- A student resolver (same pattern, via `student_profile`) — deliberately
  left out of this pass to keep the initial diff reviewable.
- Extending the pattern to other academics models (`Homework`,
  `ClassSubjectAssignment`, ...) or other apps, one at a time, following the
  SOP above.
- Frontend cutover of the teacher/parent timetable screens to the new
  endpoint, and only after that, removal of the now-redundant parts of
  `TeacherTimetableView` / the parent timetable view.
- A backend `accessible_modules` field on `/api/v1/auth/me/`, if a real gap
  is later found (today the frontend's per-portal permission filtering
  already works — see "Facts worth knowing" above).
