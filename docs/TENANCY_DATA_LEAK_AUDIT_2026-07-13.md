# Multi-Tenancy Data Leak Audit — 2026-07-13

Full static read-through of every `apps/*/views.py`, `serializers.py`, and `models.py` on the `demo` branch, plus the core tenancy middleware/auth stack. Scope: cross-school data leaks and IDOR in the Django backend (`backend/`).

## Architecture context (read this first)

- `MULTI_TENANCY_ENABLED` is **not set** in `backend/.env` → defaults `False` (`config/settings/base.py:83`). The Postgres schema-per-tenant middleware (`apps/tenancy/middleware.py`) is therefore a **no-op** — the app runs "monolithic": every school's rows live in the same tables, isolated *only* by an application-level `school` FK plus manual `request.user.school_id` filtering in each view. There is no database-level isolation as a backstop.
- `get_tenant_from_request()` (`apps/tenancy/resolvers.py`) reads `HTTP_HOST` directly and has **no `X-Forwarded-Host` fallback**. Behind any reverse proxy that rewrites Host (Next.js `rewrites()`, some nginx configs), tenant resolution silently returns `None`.
- `/media/*` is served by Django's `static.serve()` with **zero auth** (`config/urls.py:42-56`), and is explicitly whitelisted as a public path in the tenancy middleware. This applies to every uploaded file in the system.

---

## Critical

| # | File:Line | Defect | Attack scenario |
|---|---|---|---|
| 1 | `config/urls.py:42-56` | `/media/*` served with no authentication or ownership check, in both `DEBUG` and production branches | Anyone with a URL (no login needed) downloads any school's student birth certificates, Aadhaar cards, medical records, staff bank/ID documents, homework/lesson attachments. Paths are date-bucketed and largely predictable: `staff_onboard_docs/%Y/%m/<filename>`, `student_documents/%Y/%m/<filename>`, `staff/photos/` |
| 2 | `apps/chat/views.py:194-365` (`search_users`), `:114-192` (`connected_users`), `:368-436` (`create`/`conversation`) | User search/discovery returns **all users system-wide** (`User.objects.all()`), and direct-message creation does `get_object_or_404(User, id=to_id)` with no same-school check. `Conversation` model has no `school` field at all | Any authenticated user in School A browses every student/staff name, email, phone across every other school, and can send/receive DMs and files with them. `apps/chat/consumers.py` WebSocket auth checks JWT validity only — no school check on real-time delivery either |
| 3 | `apps/competitions/views.py:19-44` | `CompetitionViewSet`/`ResultViewSet` are plain `ModelViewSet` with `queryset = Model.objects.all()` and **no `get_queryset()` override**, despite `Competition`/`House`/`Club` having a `school` FK. Only `IsAuthenticated` gates it | Any authenticated non-superuser can list/retrieve/update/delete every school's competitions and student results, and `POST /results/bulk/` to fabricate results for another school's students |
| 4 | `apps/fees/serializers.py:178-201,221-234`, `apps/fees/views.py:185-210,244-249` | `FeeAssignmentSerializer`/`PaymentSerializer` have no `validate()`; `student`, `fees_type`, `academic_year`, `assignment` are unscoped `PrimaryKeyRelatedField(queryset=Model.objects.all())` | School A POSTs `{student: <School B id>, fees_type: <School B id>}` to `/fees/assignments/` (or a School B `assignment` id to `/fees/payments/`) and injects/corrupts charges or payments into School B's financial ledger |
| 5 | `apps/core/views.py:1180-1210` (`BusLocationViewSet.create`), `:1079-1178` (`.eta`) | `create()` resolves `vehicle_id` via `Vehicle.objects.filter(id=...).first()`, bypassing `get_queryset()` entirely; `.eta` does the same for reads | Any authenticated user overwrites another school's vehicle GPS location, triggers false attendance auto-marking (`_auto_mark_attendance`) and real SMS/email to that school's parents, or reads another school's live route/ETA by guessing a vehicle id |
| 6 | `apps/access_control/serializers.py:92-99`, `views.py:446-462` | `UserRoleSerializer` has default unscoped `user`/`role` FKs; `UserRoleViewSet` scopes `list` but has no `perform_create` override | A school-admin links an arbitrary user to a Role belonging to a *different school*, granting that role's permission set — cross-tenant privilege escalation |

## High

| # | File:Line | Defect | Attack scenario |
|---|---|---|---|
| 7 | `apps/academics/serializers.py:520-541`, `views.py:714-715` | `HomeworkSubmissionSerializer.homework_id`/`student_id` unscoped, no `validate()` (contrast: `ExamMarkSerializer` does this correctly) | Teacher in School A injects a graded submission into School B's homework record |
| 8 | `apps/academics/serializers.py:1100`, `views.py:1209-1280` | `LessonPlanner.lesson`/`topic` never checked against `request.user.school` | Attach and read another school's Lesson/Topic title via the write response |
| 9 | `apps/core/serializers.py` (`BusStopSerializer.route`, `AssignVehicleSerializer`, `TransportAlertSerializer`, `VehicleDriverAssignmentSerializer`, `BusRoutePickupUpdateSerializer`, `TransportNotificationLogSerializer`, `ItemReceiveChildSerializer`, `ItemSellChildSerializer`) | All default unscoped `PrimaryKeyRelatedField`s on schoolless child models | `POST /core/bus-stops/ {route: <foreign school's route id>}` attaches a stop to another school's route; same pattern for inventory receive/sell |
| 10 | `apps/fees/views.py:1521,1526` (`YearEndGroupAmountsAPIView.post`) | Unlike the sibling `GET` (correctly scoped), `POST` does `get_object_or_404(FeesGroup, pk=group_id)` / `FeesType.objects.get(pk=...)` with no school filter | Read another school's fee-group/fee-type name via a staging POST |
| 11 | `apps/admissions/views.py:1821` (`AIGenerateView`) | `AIMessageTemplate.objects.filter(pk=template_id).first()` unscoped (the `inquiry` lookup two lines above is correctly scoped) | Use/read another school's custom AI prompt template by id |

## Medium

| # | File:Line | Defect | Attack scenario |
|---|---|---|---|
| 12 | `apps/attendance/serializers.py:7-80`, `subject_views.py:223-254` | `student` FK not validated against caller's school on attendance write | Tag another school's student to an attendance row saved under your own school (integrity leak, not a direct read) |
| 13 | `apps/fees/models.py:92-103` (`FeesType.clean`), `serializers.py:87-107` | GL/account code uniqueness is global (`FeesType.objects.filter(is_deleted=False, gl_code=code)`), not per-school | School B can't use a GL code School A already used — cross-tenant existence/collision signal |
| 14 | `apps/access_control/views.py:1157,1176,1207-1267` | Bulk-reset/bulk-access school guard is skipped when the *acting* non-superuser has `school_id=None` | An admin account with no school assigned can reset/toggle any user, any school |
| 15 | `apps/users/serializers.py:55-64,101-138` | Tenant-scope login check only runs if `get_tenant_from_request()` resolves a tenant; in the current no-subdomain deployment it resolves to `None` for essentially all requests, so the full-name (`first last`) login fallback is unguarded | Two same-named accounts in different schools → whichever's password matches first (`order_by("id")`) authenticates, independent of intended school |
| 16 | `apps/communication/views.py` (`InAppMessageSerializer`, `CommunicationNotificationSerializer`) | `recipient_id` not validated same-school | Address a notification/in-app message to a user in another school (low severity — still only readable by that recipient) |

## Low / already effectively mitigated

- `apps/hr/views.py:694` — driver-role `Role.objects.filter(name__iexact='driver').first()` is global, but the outer queryset is already school-scoped, so impact is a wrong/empty dropdown, not a leak.
- `apps/exams/views.py` (10 call sites) — unscoped `Section.objects.filter(id=...).first()` used only to render `section_name` in report payloads; gated by upstream schedule checks that already require the section to belong to the caller's school.

## Confirmed FIXED since the last audit (2026-06-12/19 memory)

- Bulk access/reset endpoints (`access_control/views.py`) now filter by `school_id=request.user.school_id` on both the `ids` and `allMatching` paths (residual gap noted at #14 above).
- `RoleSerializer` now includes and accepts `portal_type`.
- `has_permission_code()` — no `is_school_admin` over-grant bypass found; only `is_superuser` short-circuits.
- `teacher_portal`/`parent_portal` — exemplary: every query cross-checks both school **and** class/subject assignment or guardian ownership.
- `super_admin/views.py` — all 29 views uniformly require `IsAuthenticated, IsSuperAdmin`; not reachable by school admins.
- `apps/reports/`, `apps/communication/` (Notice/Holiday/EmailSms), `apps/master/` — correctly scoped or genuinely global reference data.
- `fees`/`hr`/`library`/`admissions` read-side list/retrieve views (aside from items #4, #10, #11, #13 above) use custom `SchoolScopedModelViewSet` subclasses with explicit school filters, not the vulnerable shared base class.

## Note on the shared base class

`apps/core/viewsets.py::PaginatedModelViewSet.get_queryset()` only auto-scopes by school `if hasattr(self.model, 'school')` — a model without a direct `school` field gets **zero** filtering if a view relies on this base unmodified. Auditors confirmed this exact pattern is not currently used anywhere with a schoolless model (apps generally roll their own scoped base classes instead) — but `apps/competitions` (#3 above) shows the same root cause in a different shape: a view that skips scoping entirely. Treat this base class as a landmine for any new ViewSet built on top of it.

---

## Priority remediation order

1. **Gate `/media/` behind an authenticated, ownership-checked serving view** (or move to signed URLs / a storage backend with per-object ACLs). This single fix closes the largest blast-radius item — PII documents for every school.
2. **Scope `apps/chat` and `apps/competitions`** — add `school` filtering to `search_users`/`connected_users`/message creation, and add `get_queryset()` overrides to `CompetitionViewSet`/`ResultViewSet`.
3. **Add `validate()` cross-school checks** to the write-side serializers listed in Critical/High (#4, #6, #7, #8, #9, #10, #11) — this is a repeated pattern (unscoped `PrimaryKeyRelatedField`) that should get a shared `SchoolScopedPrimaryKeyRelatedField` or a mixin `validate()` helper rather than one-off fixes, to stop it recurring.
4. **Fix `BusLocationViewSet.create`/`.eta`** to resolve `vehicle` through a school-scoped queryset.
5. **Close the login tenant-check gap** (#15) and the bulk-reset `school_id=None` gap (#14) — both are narrow but cheap to fix.
6. Re-run this audit (or at least items 2–4) after fixes land, since several of these are copy-pasted patterns likely to recur in new endpoints.
