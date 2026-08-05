# Eskoolia ERP V1

Full-stack school ERP — Django backend + Next.js 14 frontend, multi-tenant (schema-per-tenant scaffolding exists but runs in "monolithic" mode — see Tenancy policy below).

## Stack
- **Backend:** Django 5.1.8, Python (venv at `backend/venv/`), PostgreSQL (Neon cloud — `DATABASE_URL` in `backend/.env`)
- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS 4
- **Real-time:** Django Channels + Redis

## Run
```
# Backend — always use the venv python, never system Python
backend/venv/Scripts/python.exe manage.py runserver 8000

# Frontend
cd frontend && npm run dev      # http://localhost:3000
```
**Port 8000 belongs to eSkoolia on this machine.** A separate local project (PocketHRMS) also defaults to 8000 — if it needs to run concurrently, start it on a different port instead of reintroducing an alternate-port workaround here.

## Tenancy & data-scoping policy (critical — read before touching any view/serializer)
- `MULTI_TENANCY_ENABLED` is unset → schema-per-tenant middleware is a no-op. Isolation is enforced entirely at the application layer: every ordinary per-school view/serializer must filter by `request.user.school_id`.
- **No `is_superuser` bypass on data scoping.** The platform superuser account (`admin`) is provisioned with its own `school` FK pointing at a school literally named "Default School" — it must be scoped exactly like any other user on every ordinary page. The only legitimate exception is genuine multi-tenant admin surfaces whose entire purpose is cross-school management: `apps/tenancy/views.py::SchoolViewSet`, `apps/tenancy/super_admin/`, `apps/super_admin/`. Do not add `if user.is_superuser: <skip/widen the school filter>` anywhere else — that pattern was the root cause of a cross-school data leak fixed 2026-07-13/14 across ~25 modules.
- Shared base classes that carry this scoping for most ViewSets: `apps/core/viewsets.py::PaginatedModelViewSet.get_queryset()`, `apps/core/views.py::TenantQueryMixin.get_queryset()`, `apps/core/base_serializers.py::validate_school()`. Extend these, don't bypass them.
- Any serializer that accepts a related-object PK (student, fee type, role, vehicle, lesson, template, etc.) must validate that object's `school_id` against `request.user.school_id` in a `validate()` method — do not trust an unscoped `PrimaryKeyRelatedField` alone. Pattern to copy: `apps/competitions/serializers.py::ResultSerializer.validate()`.
- `/media/*` is served via `apps/core/media_views.py::serve_media` (auth + per-model ownership check) — never reintroduce Django's raw static-serve for `/media/`.

## Key paths
| Purpose | Path |
|---|---|
| Django settings | `config.settings.local` |
| Core scoping base classes | `backend/apps/core/viewsets.py`, `views.py`, `base_serializers.py` |
| Media serving (authenticated) | `backend/apps/core/media_views.py` |
| Teacher / Parent portal apps | `backend/apps/teacher_portal/`, `backend/apps/parent_portal/` |
| Teacher / Parent portal frontend | `frontend/app/(teacher-portal)/`, `frontend/app/(parent-portal)/` |
| Permissions hook | `frontend/hooks/usePermissions.ts` |
| Visible modules hook (always use this, never filter module lists manually) | `frontend/hooks/useVisibleModules.ts` |
| Portal module registry | `frontend/lib/portal-modules.ts` |
| HR API client (has `HrApiError` for structured backend error parsing) | `frontend/hooks/useHrApi.ts` |
| Auth/fetch wrapper (`silent401` option for background calls) | `frontend/lib/api-auth.ts` |
| Design tokens | `frontend/styles/tokens.css` |

## Conventions
- **Do not start the backend or frontend dev server proactively.** The user runs servers themselves and does their own visual/manual checks after a build — only start one if explicitly asked to.
- `Role` model lives in `apps/access_control`, NOT `apps/users`. User→Role join is via `UserRole` (also `apps/access_control`).
- Module visibility: always `useVisibleModules()` — never filter module lists manually at the call site.
- `usePermissions` has a 5-min TTL + `visibilitychange` refresh; never seed from stale cache.
- Background/non-critical frontend fetches should pass `{ silent401: true }` (see `frontend/lib/api-auth.ts`) so a stray 401 doesn't force-logout mid-form and wipe unsaved data — reserve the hard redirect for the actual submit action.
- Never use raw hex colors outside `tokens.css` for portal brand/status colors.
- No mock mode — `NEXT_PUBLIC_USE_MOCK=false` permanently.

## Known gaps (as of 2026-07-14)
- `apps/admissions` "Browser Admin Setup" UI still writes to a generic `AdminSetupEntry` table instead of the real `ComplaintType`/`ComplaintSource` models (which now have proper CRUD endpoints, `apps/admissions/urls.py`) — needs a frontend wiring pass.
- Several stray one-off debug scripts at `backend/` root (`diagnostic_*.py`, `debug_exception_v2.py`, `scratch_*.txt`) — not part of the app, safe to delete after confirming they're no longer needed.
- See auto-memory (`bug_backlog.md`, `tenancy_flow_audit.md`) for the fuller running list — this file only covers what a fresh session needs to not repeat past mistakes.
