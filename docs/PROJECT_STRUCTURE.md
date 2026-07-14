# Project Structure — Eskoolia ERP

> Last generated: 2026-07-13, from a read of the working tree. Regenerate rather than hand-edit when the layout drifts.

Monorepo with two apps: a Django REST backend and a Next.js (App Router) frontend, plus a `docs/` folder for project documentation.

```
eSkoolia-version1/
├── backend/        Django REST API
├── frontend/       Next.js 14 App Router client
├── docs/           Project documentation (30+ markdown files, ungroomed)
├── scripts/        Repo-level setup scripts
├── .github/        CI workflow
└── docker-compose.yml, setup.bat, TEAM_CONTEXT.md, ...
```

## backend/ (Django)

```
backend/
├── config/                 Project settings/urls (the Django "project" package)
│   ├── settings/
│   ├── urls.py, urls_public.py, urls_tenant.py, urls_improved.py
│   ├── asgi.py, wsgi.py, celery.py, consumers.py
│   └── exception_handler.py, pagination.py
├── apps/                   All custom Django apps (one dir per domain)
│   ├── core, tenancy, users, access_control
│   ├── admissions, students, academics, attendance, exams
│   ├── fees, finance, hr, library, behaviour
│   ├── chat, communication, competitions, reports
│   └── (each app: models.py, serializers.py, views.py, urls.py, migrations/)
├── media/                   Uploaded files (student photos, staff docs) — gitignored content, dirs tracked
├── staticfiles/             Collected static assets
├── scripts/                 Backend-specific one-off scripts
├── tests/, conftest.py, pytest.ini
├── manage.py, requirements.txt
└── venv/                    Local virtualenv (not committed)
```

Notable clutter at `backend/` root (technical debt, not part of the app):
`_check_mpp_tables.py`, `_check_schema.py`, `_check_users.py`, `_fix_domains.py`, `_migrate_mpp.py`, `_provision_mpp.py`, `_provision_schemas.py`, `check_domains.py`, `check_school.py`, `debug_exception*.py` (v2–v4), `debug_output.txt`, `debug_student.py`, `debug_traceback.py`, `diagnostic_1..6_*.py`, `find_root_cause.py`, `get_token.py`, `get_token_test.py`, `result.json`, `scratch_*.txt`, `seed_complaints.py`, `test_api.py`, `test_celery_import.py`, `test_script.py`, `token.txt`, `token_clean.txt`, `error.html`, plus report dumps (`COMPLETE_DIAGNOSTIC_REPORT.txt`, `DIAGNOSTIC_OUTPUTS.txt`, `ROOT_CAUSE_ANALYSIS.txt`). Also two stray content dirs (`academics/`, `admissions/`, `staff/`, `chat_files/`, `student_photos/`, `rewrite/`, `t/`) that sit next to `apps/` rather than inside `media/`. These were not touched — flagging for a separate cleanup pass since removing/moving them isn't obviously safe without knowing which are still referenced (e.g. by `MEDIA_ROOT`/`FileField` paths in `apps/*/models.py`).

### App conventions
Each app under `apps/<name>/` follows: `models.py`, `serializers.py`, `views.py`, `urls.py`, `admin.py`, `apps.py`, `migrations/`. Some have extras: `access_control` has `management/commands/` + `services.py`; `admissions` has `providers.py`, `tasks.py`, `tests/`; `hr` has `attendance_endpoints.py` in addition to the standard set.

## frontend/ (Next.js App Router)

```
frontend/
├── app/
│   ├── (dashboard)/        Admin/school-staff portal — one dir per module
│   │   ├── hr/             departments, designations, directory, leave*, onboard,
│   │   │                   offboarding, payroll, setup, staff*, attendance
│   │   ├── academics, admissions, attendance, behaviour, exams, fees, finance,
│   │   │   inventory, library, reports, roles, setup, student(s), transport, utilities
│   │   ├── administration, home, lesson, student-groups
│   │   └── layout.tsx
│   ├── (teacher-portal)/   Teacher-facing routes
│   ├── (parent-portal)/    Parent-facing routes
│   ├── (super-admin)/      Super-admin / platform-owner routes
│   ├── api/                Next.js route handlers
│   ├── login/, forgot-password/, reset-password/, change-password/, no-access/
│   └── layout.tsx, page.tsx, globals.css
├── components/              One dir per module, mirroring app/ (hr, fees, academics, ...)
│   ├── ui/, shared/, common/, layout/, nav/, navigation/   Cross-cutting UI
│   └── AIBot.tsx, PageHeader.tsx                            Top-level shared components
├── hooks/                   useHrApi.ts, usePermissions.ts, useVisibleModules.ts, ...
├── lib/
│   ├── api.ts, api-auth.ts, api/                API client + auth-aware fetch wrapper
│   ├── routes.ts, teacher-routes.ts, parent-routes.ts, portal-modules.ts, app-navigation.ts
│   ├── auth.ts, auth-context.tsx                Auth state/context
│   ├── services/                                Domain service modules
│   └── utils/, utils.ts, types.ts, modules.ts, featureFlags.ts, ...
├── contexts/                ParentChildContext.tsx
├── types/                   Shared TS types
├── public/                  Static assets
├── styles/                  Global/shared styles
├── __tests__/, jest.config.js, jest.setup.ts
└── package.json, tsconfig.json, next.config.mjs, tailwind.config.js, turbo.json
```

Stray files at `frontend/` root worth noting: `test_api.js`, `test_script.js`, `token.txt`, `update_fees_dynamic.py` (a Python script in a JS project), `logs/`. Not moved as part of this pass.

## docs/

Ungroomed — 30+ markdown files mixing sprint reports, bug logs, and reference docs (`PROVISIONING_API_REFERENCE.md`, `tenancy_runbook.md`, `TEAM_CONTEXT.md`, `HR_SETUP_BUGS_2026-06-30.md`, etc.), no index or subfolders. Worth a separate pass to split into `docs/reports/` (dated status snapshots) vs. `docs/reference/` (living reference docs) if it keeps growing.

## Root-level clutter

`generate_campaign_pdf.py`, `debug_endpoints.py`, `debug_fees.py`, `debug_traceback.py`, `eskoolia_bug_fixes.html`, `recovered_chunks.txt`, `package.json` + `package-lock.json` (no obvious top-level Node project — check what these are for before assuming they're safe to remove) all live at the repo root rather than inside `backend/` or `frontend/`. Left in place; flagging only.
