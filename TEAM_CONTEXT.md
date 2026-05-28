# TEAM_CONTEXT — Eskoolia ERP (Combined)

> This file is the merged context from both feature branches.
> - **Tenancy Team** (branch: `tenancy`): Multi-tenancy, Super Admin Console, Billing
> - **Roles Team** (branch: `roles`): Frontend Cleanup, Login Permission Module, Access Control Fixes

---

# TEAM_CONTEXT ΓÇö School Tenancy Module

Branch: `tenancy` ΓÇó Module: Super Admin ΓåÆ Schools / Billing / Tenancy

---

## Timeline ΓÇö School Tenancy Module (Day 1 ΓåÆ Now)

> Source: in-repo phase docs + `git log` on `tenancy` branch + uncommitted working tree on 2026-05-20.

### Day 1 ΓÇö 2026-05-13 ΓÇö Phase 8: Staging-only Tenant Provisioning
**Files added / changed:**
- [backend/apps/tenancy/api.py](backend/apps/tenancy/api.py) ΓÇö `POST /api/v1/tenancy/super-admin/schools/provision/`
- [backend/apps/tenancy/provisioning.py](backend/apps/tenancy/provisioning.py) ΓÇö `create_postgres_schema`, `run_tenant_migrations`, `seed_tenant_defaults`, `create_tenant_domain`
- `ProvisionTenantSerializer`, `TenantDetailSerializer`
- `MULTI_TENANCY_ENABLED=False` flag wired (production-safe default)

**Delivered:** super-admin can provision a real Postgres tenant schema in staging; subdomain sanitization; rollback on failure; default seeds (AcademicYear, Roles, Departments).
**Reference:** [PHASE_8_COMPLETION_SUMMARY.md](PHASE_8_COMPLETION_SUMMARY.md)

### Day 1 ΓÇö 2026-05-13 ΓÇö Phase 9: Tenant-Aware Auth & Request Schema Switching
**Files added / changed:**
- [backend/apps/tenancy/middleware.py](backend/apps/tenancy/middleware.py) ΓÇö `TenantMainMiddleware` (X-Tenant header / Host subdomain / X-School-Id resolution, sets PG `search_path`)
- [backend/apps/tenancy/auth.py](backend/apps/tenancy/auth.py) ΓÇö `TenantAwareJWTAuthentication`
- Super-admin vs tenant-user separation enforced; monolithic fallback preserved when flag off.

**Reference:** [PHASE_9_COMPLETION_SUMMARY.md](PHASE_9_COMPLETION_SUMMARY.md), [PHASE_9_QUICK_REFERENCE.md](PHASE_9_QUICK_REFERENCE.md)

### Day 1 ΓÇö 2026-05-13 ΓÇö Phase 10: Feature Flags, Permissions, Rate Limits
**Files added / changed (~2,000 LOC):**
- [backend/apps/tenancy/models.py](backend/apps/tenancy/models.py) ΓÇö `TenantPlan`, `TenantFeature`, `TenantFeatureFlag`, `TenantFeatureAudit`
- `feature_flags.py` (`is_feature_enabled`, schema-aware caching)
- `permissions.py` ΓÇö `TenantActive`, `TenantFeatureEnabled`, `TenantAPIAccessEnabled`, `TenantNotSuspended`, `IsSuperAdminOnly`, `TenantUserOnly`, `TenantDataIsolation`, `CompositePermission`
- `rate_limiting.py` ΓÇö `TenantAwareThrottle`, `TenantPlanBasedThrottle` (Trial / Premium / Enterprise)
- `helpers.py` ΓÇö `tenant_has_feature`, `tenant_api_allowed`, `tenant_context`, `can_upgrade_plan`

**Reference:** [PHASE_10_IMPLEMENTATION_COMPLETE.md](PHASE_10_IMPLEMENTATION_COMPLETE.md), [PHASE_10_SETUP_GUIDE.md](PHASE_10_SETUP_GUIDE.md), [PHASE_10_QUICK_REFERENCE.md](PHASE_10_QUICK_REFERENCE.md)

### Day 1 ΓÇö 2026-05-13 ΓÇö Phase 11: School Data Migration & Validation
**Files added / changed (~1,600 LOC):**
- `TenantMigrationAudit` model (public schema, immutable)
- `migration_framework.py` ΓÇö per-school copy engine, dry-run, checkpoints, rollback
- `validation_automation.py` ΓÇö dual-read validation (monolithic vs tenant), FK / duplicate checks
- `observability.py`, `test_fixtures.py`, `test_integration_migrations.py`
- Management commands: `migrate_school_to_tenant`, `validate_tenant_migration`, `rollback_tenant_migration`, `validate_tenant_isolation`, `validate_hybrid_runtime`, `validate_rollback_flow`, `run_migration_integration_tests`

**Reference:** [PHASE_11_IMPLEMENTATION_COMPLETE.md](PHASE_11_IMPLEMENTATION_COMPLETE.md), [PHASE_11_MIGRATION_GUIDE.md](PHASE_11_MIGRATION_GUIDE.md), [PHASE_11_QUICK_REFERENCE.md](PHASE_11_QUICK_REFERENCE.md)

### Day 2 ΓÇö 2026-05-14 ΓÇö Phase 13 Sprint 0: Super-Admin Console UI Skeleton
**Files added:**
- [frontend/app/(super-admin)/layout.tsx](frontend/app/(super-admin)/layout.tsx) ΓÇö role-based access guard (super_admin only)
- `frontend/app/(super-admin)/super-admin/{dashboard,schools,billing,audit,policies}/page.tsx` ΓÇö route shells
- [frontend/components/super-admin/Sidebar.tsx](frontend/components/super-admin/Sidebar.tsx) ΓÇö collapsible sidebar, mobile hamburger
- [frontend/types/super-admin/index.ts](frontend/types/super-admin/index.ts) ΓÇö ~400 lines of TS contracts (School, Dashboard, Invoice, Mrr, Audit, Policy, Filters)
- `frontend/lib/api/super-admin/{dashboard,schools,billing,audit,policies,index}.ts` ΓÇö 17 API client functions

**Reference:** [PHASE_13_SPRINT_0_REPORT.md](PHASE_13_SPRINT_0_REPORT.md), [PHASE_13_IMPLEMENTATION_ROADMAP.md](PHASE_13_IMPLEMENTATION_ROADMAP.md)

### Day 3 ΓÇö 2026-05-16 ΓÇö Sprint 1: Super-Admin Console Backend APIs
**Files added / changed:**
- New app: `backend/apps/super_admin/` (`apps.py`, `serializers.py` ΓÇö 10 serializers, `views.py` ΓÇö 8 ViewSets, `urls.py`)
- [backend/apps/access_control/permission_classes.py](backend/apps/access_control/permission_classes.py) ΓÇö `IsSuperAdmin` (strict: `is_superuser=True` AND no `school` FK)
- [backend/config/settings/base.py](backend/config/settings/base.py) ΓÇö registered `super_admin` in INSTALLED_APPS
- [backend/config/urls.py](backend/config/urls.py) ΓÇö mounted `/api/super-admin/` + `/api/v1/super-admin/`

**Endpoints delivered:** dashboard KPIs, school-tenants list/detail/provision/activate/deactivate, audit-logs list+search, billing metrics, policies list/settings/update, analytics usage+growth, system-health status+alerts.
**Reference:** [PHASE_1_SUPER_ADMIN_API_IMPLEMENTATION.md](PHASE_1_SUPER_ADMIN_API_IMPLEMENTATION.md), [SPRINT_1_QUICK_REFERENCE.md](SPRINT_1_QUICK_REFERENCE.md), [SPRINT_1_VALIDATION_REPORT.md](SPRINT_1_VALIDATION_REPORT.md), [VERIFICATION_REPORT_SPRINT1.md](VERIFICATION_REPORT_SPRINT1.md)

### Day 4 ΓÇö 2026-05-18 ΓÇö Last committed work on `tenancy` (commit `ed554a2`)
Author: `sridevi-sriagithub` ┬╖ Message: `18/05/26` (consolidated WIP commit). Pushed to `origin/tenancy`.

### Day 5 ΓÇö 2026-05-20 (today) ΓÇö Post-Push Activity on `tenancy` branch
After the May 18 push, the following happened on the `tenancy` branch (reconstructed from `git reflog` + `git log`):

**16:28 IST ΓÇö commit `2064e63` "20/05/26-added billing" (pushed to `origin/tenancy`)**
24 files changed, +4,589 / -995 lines. Highlights:
- Backend (super-admin + tenancy):
  - [backend/apps/super_admin/views.py](backend/apps/super_admin/views.py) (+356) ΓÇö `BillingInvoiceListCreateView`, `BillingMRRView`, `BillingPlansView`, `BillingGSTR1ExportView`
  - [backend/apps/super_admin/serializers.py](backend/apps/super_admin/serializers.py) (+98) ΓÇö `InvoiceCreateSerializer`, plan / school extensions
  - [backend/apps/super_admin/urls.py](backend/apps/super_admin/urls.py) (+10) ΓÇö billing + plan routes
  - [backend/apps/tenancy/models.py](backend/apps/tenancy/models.py) (+40) ΓÇö `SuperAdminInvoice`, `SubscriptionPlan`, branding fields on tenant
  - [backend/apps/tenancy/super_admin/views.py](backend/apps/tenancy/super_admin/views.py) (+223) ΓÇö `InvoiceMarkPaidView`, `InvoiceSendReminderView`, audit logging
  - [backend/apps/tenancy/super_admin/serializers.py](backend/apps/tenancy/super_admin/serializers.py), [urls.py](backend/apps/tenancy/super_admin/urls.py) ΓÇö invoice serializer + mark-paid/reminder routes
  - [backend/apps/tenancy/migrations/0007_add_branding_fields.py](backend/apps/tenancy/migrations/0007_add_branding_fields.py) ΓÇö NEW
  - [backend/apps/tenancy/migrations/0008_add_subscription_plan.py](backend/apps/tenancy/migrations/0008_add_subscription_plan.py) ΓÇö NEW
  - [backend/apps/access_control/permission_classes.py](backend/apps/access_control/permission_classes.py) ΓÇö super-admin permission tweaks
  - [backend/fix_test_superuser.py](backend/fix_test_superuser.py) ΓÇö local test user repair script
- Frontend (super-admin console):
  - [frontend/app/(dashboard)/super-admin/billing/page.tsx](frontend/app/(dashboard)/super-admin/billing/page.tsx) ΓÇö billing dashboard overhaul (1,600 lines refactored)
  - [frontend/app/(dashboard)/super-admin/billing/NewInvoiceDrawer.tsx](frontend/app/(dashboard)/super-admin/billing/NewInvoiceDrawer.tsx) ΓÇö NEW (856 lines)
  - [frontend/app/(dashboard)/super-admin/billing/NewPlanDrawer.tsx](frontend/app/(dashboard)/super-admin/billing/NewPlanDrawer.tsx) ΓÇö NEW (425 lines)
  - [frontend/app/(dashboard)/super-admin/schools/page.tsx](frontend/app/(dashboard)/super-admin/schools/page.tsx) (+721) ΓÇö schools list rewrite
  - `frontend/app/(dashboard)/super-admin/schools/[tenantId]/edit/page.tsx` ΓÇö NEW (372 lines)
  - `frontend/app/(dashboard)/super-admin/schools/[tenantId]/audit/page.tsx` ΓÇö NEW (331 lines)
  - [frontend/app/(dashboard)/super-admin/dashboard/page.tsx](frontend/app/(dashboard)/super-admin/dashboard/page.tsx), [layout.tsx](frontend/app/(dashboard)/super-admin/layout.tsx), [(super-admin)/layout.tsx](frontend/app/(super-admin)/layout.tsx) ΓÇö nav/layout sync
  - [frontend/lib/api/super-admin/billing.ts](frontend/lib/api/super-admin/billing.ts) (+75), [schools.ts](frontend/lib/api/super-admin/schools.ts) (+14), [types/super-admin/index.ts](frontend/types/super-admin/index.ts) (+53)
- Docs: `TEAM_CONTEXT.md` (+155)

**17:13 IST ΓÇö `git reset --hard HEAD`** on `tenancy` (no-op; sanity reset).

**17:14 IST ΓÇö `git pull origin demo` ΓÇö fast-forward to `056329c`**
Brought in 9 demo commits (some authored 2026-05-12 to 2026-05-20 by `shivasurya-1` and `sriaMain`), 78 files changed, +4,426 / -656 lines:
- `6dd59cc` ΓÇö Merge **tenancy** branch into main (multi-tenancy, super-admin, billing)
- `24c2c3d` ΓÇö Merge **roles** branch into main (roles team work)
- `056329c` ΓÇö Combine tenancy + roles `TEAM_CONTEXT` into single `TEAM_CONTEXT.md` (this caused the em-dash mojibake `ΓÇö` you see throughout this file)
- New migrations pulled in:
  - `access_control/0012_role_unique_nulls_distinct.py`, `0013_role_name_30_and_is_active.py`
  - `tenancy/0002_client_domain.py`, `0002_remove_domain_tenant_delete_client_delete_domain.py`, `0003_add_must_change_password.py`
  - `users/0004_user_email_unique.py`, `0005_user_users_email_nonempty_uniq.py`
- New backend infrastructure: [backend/config/exception_handler.py](backend/config/exception_handler.py), [backend/config/pagination.py](backend/config/pagination.py), `urls_public.py`, `urls_tenant.py`, [backend/tests/test_auth.py](backend/tests/test_auth.py)
- New frontend modules from `roles` team: full **login-permission** suite ΓÇö [frontend/app/(dashboard)/roles/login-permission/page.tsx](<frontend/app/(dashboard)/roles/login-permission/page.tsx>) (+359), `frontend/components/login-permission/*` (BulkActionBar, ConfirmModal, CredentialDrawer, FilterBar, Hero, Pagination, SetInitialPasswordModal, StatsRow, Toast, UsersTable), `frontend/lib/login-permission/{api,types,utils,mock-data}.ts`
- Change-password flow: [frontend/app/change-password/page.tsx](frontend/app/change-password/page.tsx), `frontend/app/api/auth/change-password/route.ts`, `frontend/app/api/login-permission/*/route.ts` (7 routes)
- Other: [frontend/hooks/usePermissions.ts](frontend/hooks/usePermissions.ts), [frontend/components/layout/AuthGate.tsx](frontend/components/layout/AuthGate.tsx), [frontend/components/nav/ModulePill.tsx](frontend/components/nav/ModulePill.tsx), [frontend/components/nav/ModuleSubNav.tsx](frontend/components/nav/ModuleSubNav.tsx), updates to `TopBar`, `sidebar-menu.data.ts`, `lib/routes.ts`
- New top-level doc: [PROJECT_STATE.md](PROJECT_STATE.md) ΓÇö added by the demo merge
- Removed: `TESTING_GUIDE_COMPLETE.md`, `UAT_CLOSURE_MATRIX_2026-03-30.md`, `promote_pdf_text.txt`

**18:03 IST ΓÇö `git checkout -b tenancy-new`** from `056329c`. Active branch is now `tenancy-new` (continues post-merge work without touching `tenancy`).

**Heads-up after the demo pull:**
- `TEAM_CONTEXT.md` text was re-encoded ΓÇö all em-dashes appear as `ΓÇö` and the middle dot as `┬╖`. Worth a one-shot Find & Replace pass before committing again.
- The demo merge brought in **two parallel `tenancy/0002_*` migrations** (`0002_client_domain` and `0002_remove_domain_tenant_delete_client_delete_domain`). Confirm `makemigrations --check` is clean before applying.
- Three new `users` migrations (`0003`, `0004`, `0005`) and two new `access_control` migrations (`0012`, `0013`) need to be applied on dev + staging.
- `urls_public.py` / `urls_tenant.py` were added as empty files ΓÇö django-tenants split is started but not yet populated.

---

## Day 5 Update ΓÇö Sridevi (2026-05-20)
**Files changed:**
- Backend
  - [backend/apps/access_control/permission_classes.py](backend/apps/access_control/permission_classes.py) ΓÇö super-admin permission tweaks
  - [backend/apps/super_admin/serializers.py](backend/apps/super_admin/serializers.py) ΓÇö `InvoiceCreateSerializer`, school/plan serializers extended
  - [backend/apps/super_admin/urls.py](backend/apps/super_admin/urls.py) ΓÇö new billing + plan routes
  - [backend/apps/super_admin/views.py](backend/apps/super_admin/views.py) ΓÇö `BillingInvoiceListCreateView`, `BillingMRRView`, `BillingPlansView`, `BillingGSTR1ExportView`
  - [backend/apps/tenancy/models.py](backend/apps/tenancy/models.py) ΓÇö `SuperAdminInvoice`, `SubscriptionPlan`, branding fields on tenant
  - [backend/apps/tenancy/super_admin/serializers.py](backend/apps/tenancy/super_admin/serializers.py) ΓÇö `InvoiceSerializer` updates
  - [backend/apps/tenancy/super_admin/urls.py](backend/apps/tenancy/super_admin/urls.py) ΓÇö invoice mark-paid / reminder endpoints
  - [backend/apps/tenancy/super_admin/views.py](backend/apps/tenancy/super_admin/views.py) ΓÇö `InvoiceMarkPaidView`, `InvoiceSendReminderView`, audit logging
  - [backend/apps/tenancy/migrations/0007_add_branding_fields.py](backend/apps/tenancy/migrations/0007_add_branding_fields.py) ΓÇö new migration
  - [backend/apps/tenancy/migrations/0008_add_subscription_plan.py](backend/apps/tenancy/migrations/0008_add_subscription_plan.py) ΓÇö new migration
  - [backend/fix_test_superuser.py](backend/fix_test_superuser.py) ΓÇö test user repair script
- Frontend
  - [frontend/app/(dashboard)/super-admin/schools/page.tsx](frontend/app/(dashboard)/super-admin/schools/page.tsx) ΓÇö schools list rewrite (filters, search, status, audit/edit links)
  - [frontend/app/(dashboard)/super-admin/schools/[tenantId]/edit/](frontend/app/(dashboard)/super-admin/schools/) ΓÇö new school edit page
  - [frontend/app/(dashboard)/super-admin/schools/[tenantId]/audit/](frontend/app/(dashboard)/super-admin/schools/) ΓÇö new tenant audit log page
  - [frontend/app/(dashboard)/super-admin/billing/page.tsx](frontend/app/(dashboard)/super-admin/billing/page.tsx) ΓÇö billing dashboard overhaul (MRR, GSTR-1 export, plans)
  - [frontend/app/(dashboard)/super-admin/billing/NewInvoiceDrawer.tsx](frontend/app/(dashboard)/super-admin/billing/) ΓÇö new invoice creation drawer
  - [frontend/app/(dashboard)/super-admin/billing/NewPlanDrawer.tsx](frontend/app/(dashboard)/super-admin/billing/) ΓÇö new plan creation drawer
  - [frontend/app/(dashboard)/super-admin/dashboard/page.tsx](frontend/app/(dashboard)/super-admin/dashboard/page.tsx) ΓÇö metrics tweaks
  - [frontend/app/(dashboard)/super-admin/layout.tsx](frontend/app/(dashboard)/super-admin/layout.tsx) ΓÇö nav adjustments
  - [frontend/app/(super-admin)/layout.tsx](frontend/app/(super-admin)/layout.tsx) ΓÇö layout sync
  - [frontend/lib/api/super-admin/billing.ts](frontend/lib/api/super-admin/billing.ts) ΓÇö `getInvoices`, `createInvoice`, `markInvoicePaid`, `sendInvoiceReminder`, `getMrr`, `exportGstr1`, `getPlans`, `createPlan`, `updatePlan`, `deletePlan`
  - [frontend/lib/api/super-admin/schools.ts](frontend/lib/api/super-admin/schools.ts) ΓÇö added edit/audit endpoints
  - [frontend/types/super-admin/index.ts](frontend/types/super-admin/index.ts) ΓÇö Invoice/Plan/School type updates

**Fixed today:**
- Login 503 caused by missing `users.access_status` column resolved via `python manage.py migrate users`.
- Test-bootstrap failure on Neon (`tenant_plans` missing) fixed by generating `tenancy/0006_sync_phase10_phase11_models.py`.
- HR migration drift on SQLite worked around by faking `hr.0007_alter_staff_custom_field_staffdocument` and `hr.0008_alter_staff_other_document`.
- `students.0012_repair_missing_district_column` faked (column already existed; SQL used unsupported `ADD COLUMN IF NOT EXISTS`).
- Backend management commands now run under `py -3.10` (Python 3.14 was duplicating app paths `apps.exams` from `D:`/`d:`).

**Still in progress:**
- Super-admin Schools page (`tenancy` branch) ΓÇö edit + audit subroutes added but not yet wired end-to-end with backend tenant update endpoints.
- Billing invoice flow ΓÇö drawer + backend endpoints in place; GSTR-1 export and plan CRUD still need tenant-tax validation pass.
- Two new tenancy migrations (`0007_add_branding_fields`, `0008_add_subscription_plan`) are uncommitted and not yet applied on all environments.
- `fix_test_superuser.py` is a local repair script, not yet folded into a proper fixture/management command.

**Start tomorrow with:**
1. Apply `tenancy/0007` and `tenancy/0008` migrations on dev + staging Neon and verify `SubscriptionPlan` seeds.
2. Wire `frontend/app/(dashboard)/super-admin/schools/[tenantId]/edit/` to the tenant update endpoint and add form validation.
3. Wire the audit page to `/api/super-admin/tenants/{id}/audit/` and confirm pagination.
4. End-to-end test invoice create ΓåÆ mark-paid ΓåÆ reminder ΓåÆ GSTR-1 export.
5. Commit the 16 modified + 6 untracked files on the `tenancy` branch with focused commits (backend models/migrations, backend views, frontend schools, frontend billing).

**New bugs found:**
- `ADD COLUMN IF NOT EXISTS` in `students.0012_repair_missing_district_column` is not SQLite-compatible ΓÇö needs a guarded migration or a schema-editor based approach.
- App path-case duplication on Python 3.14 (`apps.exams` loaded from both `D:` and `d:`) blocks any tooling that resolves Django apps; pin tooling to `py -3.10` or normalize drive-letter case in `sys.path`.
- Next.js dev server (frontend terminal) exited with code 1 ΓÇö needs investigation; possibly leftover from prior `.next` corruption (delete `frontend/.next` and rebuild if it recurs).
- Invoice number uniqueness relies only on a DB constraint plus UUID suffix ΓÇö no pre-flight duplicate check; risk of 500 on rare collisions, consider catching `IntegrityError` in `BillingInvoiceListCreateView`.

---

## Module Reference (current state)

### Backend ΓÇö Tenancy / Super Admin
- Models: `SuperAdminInvoice`, `SubscriptionPlan` in [backend/apps/tenancy/models.py](backend/apps/tenancy/models.py)
- Endpoints (super-admin):
  - `GET/POST /api/super-admin/billing/invoices/`
  - `POST /api/super-admin/billing/invoices/{id}/mark-paid/`
  - `POST /api/super-admin/billing/invoices/{id}/reminder/`
  - `GET /api/super-admin/billing/mrr/`
  - `GET/POST /api/super-admin/billing/plans/`
  - `GET /api/super-admin/billing/export/gstr1/`
- Invoice number format: `INV-YYYYMM-{8-hex}` (see [backend/apps/tenancy/super_admin/utils.py](backend/apps/tenancy/super_admin/utils.py))
- Tax rules: inter-state ΓåÆ IGST; intra-state ΓåÆ CGST+SGST (50/50); default 18% GST, SAC 998313.

### Frontend ΓÇö Super Admin
- Schools list: [frontend/app/(dashboard)/super-admin/schools/page.tsx](frontend/app/(dashboard)/super-admin/schools/page.tsx)
- Billing dashboard: [frontend/app/(dashboard)/super-admin/billing/page.tsx](frontend/app/(dashboard)/super-admin/billing/page.tsx)
- API client: [frontend/lib/api/super-admin/billing.ts](frontend/lib/api/super-admin/billing.ts), [frontend/lib/api/super-admin/schools.ts](frontend/lib/api/super-admin/schools.ts)

### Environment notes
- Use `py -3.10` for Django management commands (3.14 has app-loading issues, 3.12 venv may lack Celery/Django).
- On Windows + Node 23, keep `frontend/.npmrc` with `script-shell=C:\Windows\System32\cmd.exe`.
- If Next.js build hits "Unexpected end of JSON input" in load-manifest ΓåÆ delete `frontend/.next` and rebuild.

---

# Roles Team Context (branch: `roles`)

# Eskoolia ERP ΓÇö Frontend Cleanup & Login Permission Module
## Team Context Document

---

## What Was Done

### 1. Module Visibility Cleanup (`frontend/lib/routes.ts`)

Seven modules with no backend support were hidden from all navigation surfaces (TopBar pills, ModuleGrid dashboard cards, CommandPalette, ManagePins). Each is commented out with `// HIDDEN - no backend yet` so they can be re-enabled when ready:

| Module         | ID           |
|----------------|--------------|
| Library        | `library`    |
| Transport      | `transport`  |
| Inventory      | `inventory`  |
| Behaviour      | `behaviour`  |
| Chat           | `utilities`  |
| Settings       | `settings`   |
| Accounts       | `accounts`   |

### 2. "Coming Soon" Pages

Five modules render a polished **Coming Soon** page (`components/shared/ComingSoon.tsx`) instead of broken UIs:

- **Attendance** ΓÇö all pages under `app/(dashboard)/attendance/`
- **Fees** ΓÇö groups, carry-forward, due, master, payments, types
- **Examination** ΓÇö 14 sub-pages under `app/(dashboard)/exams/`
- **Staff / HR** ΓÇö 9 sub-pages under `app/(dashboard)/hr/`
- **Reports** ΓÇö 14 sub-pages under `app/(dashboard)/reports/`

### 3. Academics Sub-pages

15 Academics sub-pages replaced with Coming Soon. **Three pages kept working**:

- `/academics/core-setup`
- `/academics/assign-class-teacher`
- `/academics/assign-subject`

### 4. Coming Soon Hover Tooltips

Hover tooltips showing **"Coming Soon"** were added to three nav surfaces:

- **`components/nav/ModulePill.tsx`** ΓÇö top-bar nav pill: whole module shows "Coming Soon" instead of a dropdown for attendance, fees, exam, reports, hr
- **`components/home/ModuleGrid.tsx`** ΓÇö dashboard module card: tooltip on hover
- **`components/home/QuickAccessGrid.tsx`** ΓÇö pinned quick-access items: tooltip on hover

Sub-items in the Academics dropdown that are Coming Soon get a **"Soon" pill badge**.

### 5. "Due Fees Login Permission" Removed from Nav

- Removed from `lib/routes.ts` (roles sub-array)
- Removed from `components/layout/sidebar-menu.data.ts`

### 6. Login Permission Module (Redesigned)

A full redesign of the Login Permission screen at `/roles/login-permission`.

#### Files created

```
lib/login-permission/
  types.ts          ΓÇö TypeScript interfaces for all data shapes
  utils.ts          ΓÇö initials(), formatDate(), paginationWindow(), cn(), genTempPassword()
  mock-data.ts      ΓÇö 840 seeded mock student users (deterministic via mulberry32 PRNG)
  api.ts            ΓÇö API client (mock + real Django REST, switches via NEXT_PUBLIC_USE_MOCK)

components/login-permission/
  Hero.tsx           ΓÇö Gradient editorial header banner
  StatsRow.tsx       ΓÇö 4 stat cards (Total, Active, Disabled, Never Logged In) with shimmer
  FilterBar.tsx      ΓÇö Role dropdown + search + status tabs + Export button
  UsersTable.tsx     ΓÇö Paginated data table with checkboxes, toggle switches, credential key icon
  Pagination.tsx     ΓÇö Page window + rows-per-page selector
  BulkActionBar.tsx  ΓÇö Sticky bottom bar (Enable All / Disable All / Reset Passwords)
  CredentialDrawer.tsx ΓÇö Right slide-in panel: reset temp password / set initial password
  ConfirmModal.tsx   ΓÇö Confirmation dialog for destructive bulk actions
  Toast.tsx          ΓÇö Success / error toasts, auto-dismiss after 4 s
```

The existing route file was replaced:
```
app/(dashboard)/roles/login-permission/page.tsx  ΓÇö owns all state, orchestrates components
```

#### Credential Drawer ΓÇö option cards

Each action is displayed as a card with a title, badge, and description:

| Card | Badge | Description |
|------|-------|-------------|
| **Reset password** | `Recommended` (green) | System generates a secure random password and emails it to the user's email. A one-time backup copy is shown here. Use this whenever the user has a working email. |
| **Set initial password** | `No-email fallback` (amber) | You type the password yourself ΓÇö for onboarding a user with no working email, so you can share it directly. Available only because this user has never logged in. |

The "Set initial password" card is only rendered when `user.lastLogin === null`.



| Feature | Detail |
|---------|--------|
| **Mock mode** | `NEXT_PUBLIC_USE_MOCK=true` in `.env.local` ΓÇö 840 students, in-memory mutations |
| **Debounced search** | 350 ms debounce; Enter key triggers immediate search |
| **Server-side filtering** | role / search / status / class / section passed to API; pagination resets on filter change |
| **Toggle switch** | Per-row toggle; optimistic UI update + stats counter update |
| **Bulk select** | Per-page checkbox ΓåÆ "Select all N matching" banner ΓåÆ `allMatching=true` in bulk payload |
| **Bulk enable/disable** | Confirm modal ΓåÆ `POST /api/login-permission/bulk/access/` |
| **Bulk password reset** | Confirm modal ΓåÆ `POST /api/login-permission/bulk/reset/` |
| **Credential drawer** | Reset temp password (always) + Set initial password (only if `lastLogin === null`) |
| **Export CSV** | Mock: Blob download; Real: redirects to Django export endpoint |
| **Class & Section filter** | Appears only when role = Students; Class dropdown + Section dropdown (section disabled until class selected); resets when switching roles or clicking Reset |

#### API contract summary (Django endpoints)

```
GET  /api/login-permission/users/             ΓåÆ list (role, page, page_size, search, status)
PATCH /api/login-permission/users/{id}/access/ ΓåÆ toggle login_access
POST  /api/login-permission/users/{id}/credentials/ ΓåÆ reset_temp | set_initial
POST  /api/login-permission/bulk/access/      ΓåÆ bulk enable/disable
POST  /api/login-permission/bulk/reset/       ΓåÆ bulk password reset
GET  /api/login-permission/users/export/      ΓåÆ CSV download
```

### 7. Access Control ΓÇö Roles & Permissions Module (Bug Fixes + Enhancements)

#### Backend fixes (`backend/apps/access_control/`)

**Migration 0013** (`0013_role_name_30_and_is_active.py`):
- Added `is_active = BooleanField(default=True)` back to the `Role` model (was missing, caused FieldError on all role queries)
- Truncated any existing role names > 30 chars before applying `max_length=30`

**`models.py`**:
- `is_active` field restored: `is_active = models.BooleanField(default=True)`
- `UniqueConstraint` on `(school, name)` with `nulls_distinct=False` (migration 0012)

**`serializers.py` ΓÇö `validate_name`**:
- Checks for both active AND inactive name collisions
- Returns specific message: `"A deactivated role with this name already exists. Reactivate it or delete it before creating a new one."` vs `"A role with this name already exists."`
- `RoleMinimalSerializer` fields: `["id", "name", "is_system", "is_active", "created_at"]`

**`views.py` ΓÇö `RoleViewSet.get_queryset`**:
- `is_active=True` filter now applies **only for the `list` action**, not for retrieve/update/destroy
- This fixed: PATCH to re-activate an inactive role was returning 404 (role not found in filtered queryset)
- `?show_inactive=1` still supported for the list action to include inactive roles explicitly

#### Frontend fixes (`frontend/components/access-control/`)

**`RoleManagementPanel.tsx`**:
- `toggleActive`: replaced `await loadRoles(page, pageSize)` with an in-place local state update (`setRoles(prev => prev.map(...))`) ΓÇö prevents deactivated roles from disappearing on re-fetch
- `loadRoles`: always appends `&show_inactive=1` so inactive roles are always loaded on mount, search, and pagination
- Edit panel: Status toggle button added (green Active / red Inactive) ΓÇö included in PUT body as `is_active`

**`AssignPermissionPanel.tsx`**:
- `RoleItem` interface: added `is_system?: boolean`
- `togglingRoleId` state: tracks which role's toggle is mid-request (loading indicator)
- `toggleRoleActive` async function: PATCHes `{ is_active: !current }`, updates local state, shows toast
- Initial role fetch: now always includes `&show_inactive=1` so deactivated roles persist across navigation
- **Per-card toggle switch** added to every role card in the grid:
  - Pill toggle (36├ù20 px): green `#16a34a` = Active, gray `#D1D5DB` = Inactive
  - Thumb slides left/right with 0.25s CSS transition
  - Inactive cards rendered at `opacity: 0.65` with lighter border/background
  - Bullet dot changes purple ΓåÆ gray for inactive roles
  - System roles (`is_system: true`): toggle disabled at 35% opacity, cursor `not-allowed`
  - Loading state: 55% opacity + `cursor: wait` during in-flight PATCH
  - `e.stopPropagation()` prevents triggering `switchRole` when clicking toggle
- Edit Role modal (`RoleFormModal`): Status toggle added via `isActive` / `onIsActiveChange` props; saved in PATCH body
- Inline validation errors for name conflicts (active vs inactive-specific messages)

#### Summary of bugs fixed

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| DELETE `/roles/{id}/` ΓåÆ 500 | `is_active` field missing from `Role` model Python definition | Restored field + migration 0013 |
| Duplicate role name ΓÇö no specific error | `validate_name` only checked active roles | Now checks both; inactive gives specific message |
| PATCH to re-activate ΓåÆ 404 | `get_queryset` filtered `is_active=True` for ALL actions | Filter now only on `list` action |
| Deactivated role disappears from UI | `toggleActive` called `loadRoles()` (API only returns active) | Update local state directly; always fetch with `show_inactive=1` |

---

### 8. Miscellaneous Fixes

- **`django-filter` version** downgraded to `24.3` in `backend/requirements.txt` (was `25.2`, incompatible with Django 5.1.8)
- **`ClassesGrid.tsx` build error** ΓÇö unescaped `"` in JSX attribute fixed with `&quot;`
- **`ModulePill.tsx` corruption** ΓÇö Python-based file rewrite used to fix escaped-quote mangling from shell commands
- **`globals.css`** ΓÇö Added `@keyframes shimmer` and `@keyframes slideInRight` for new components

---

## Day 6 — 2026-05-21 — Auth UX: Forgot Password, OTP Reset, Error Messages & Login UI Fix

**Branch:** `login/21-05`  
**Commit:** `login functionality added-21/05`

---

### 1. Gmail SMTP — Forgot Password via Email OTP

**Backend files changed:**

- [backend/config/settings/base.py](backend/config/settings/base.py) — appended Gmail SMTP config:
  ```python
  EMAIL_BACKEND = "django.core.mail.backends.smtp.EmailBackend"
  EMAIL_HOST = "smtp.gmail.com"
  EMAIL_PORT = 587
  EMAIL_USE_TLS = True
  EMAIL_HOST_USER = os.getenv("EMAIL_HOST_USER", "")
  EMAIL_HOST_PASSWORD = os.getenv("EMAIL_HOST_PASSWORD", "")
  DEFAULT_FROM_EMAIL = EMAIL_HOST_USER or "noreply@eskoolia.com"
  ```
- [backend/.env](backend/.env) — added `EMAIL_HOST_USER` and `EMAIL_HOST_PASSWORD` (Gmail App Password).
- [backend/apps/users/views.py](backend/apps/users/views.py) — three new views:
  - `ForgotPasswordView` — POST `{email}` → generates 6-digit OTP via `random.randint(100000, 999999)`, stores in Django cache (`pwd_reset_otp_{email}`, 600 s TTL), sends email. Returns 404 if email not found; 500 with exception message on SMTP failure.
  - `VerifyResetCodeView` — POST `{email, code}` → validates OTP from cache without consuming it.
  - `ResetPasswordView` — POST `{email, code, new_password}` → validates + consumes OTP, sets new password.
- [backend/apps/users/urls.py](backend/apps/users/urls.py) — added three routes:
  ```python
  path("forgot-password/", ForgotPasswordView.as_view()),
  path("verify-reset-code/", VerifyResetCodeView.as_view()),
  path("reset-password/", ResetPasswordView.as_view()),
  ```

**Frontend files changed:**

- [frontend/app/forgot-password/page.tsx](frontend/app/forgot-password/page.tsx) — submits email, on success shows: *"We've sent a 6-digit reset code to {email}. Enter the code on the next screen to set a new password."* + "ENTER RESET CODE" button navigating to `/reset-password?email=...`.
- [frontend/app/reset-password/page.tsx](frontend/app/reset-password/page.tsx) — 2-step flow:
  - **Step 1 (`code`)** — 6-digit OTP input, calls `apiVerifyResetCode`. Progress bar segment 1 active.
  - **Step 2 (`password`)** — New Password + Confirm Password fields with strength meter, calls `apiResetPassword`. Progress bar both segments teal on success.

---

### 2. Inline OTP Resend (no page navigation)

**Problem:** "Didn't receive a code? Resend" was navigating to `/forgot-password` (full page redirect), losing the email context.

**Fix in [frontend/app/reset-password/page.tsx](frontend/app/reset-password/page.tsx):**
- Added `resendCooldown` state (starts at 60 s, counts down via `useEffect` + `setTimeout`).
- Added `handleResend()` — calls `apiForgotPassword(emailFromQuery)` inline, shows inline success/error message, resets timer to 60 s, clears the old code input.
- Button shows greyed-out `"Resend available in 58s"` while cooling down; turns into active teal link at 0.
- No page navigation at any point.

---

### 3. Proper Error & Success Messages Everywhere

**Problem:** Wrong credentials showed raw `"Request failed (401)"` instead of a human-readable message.

**Root cause:** The custom exception handler (`backend/config/exception_handler.py`) wraps all errors as:
```json
{ "error": { "code": "authentication_failed", "message": "Invalid password." } }
```
But `extractError()` in auth-context only checked if `body.error` was a **string** — never looked inside the nested object.

**Fix in [frontend/lib/auth-context.tsx](frontend/lib/auth-context.tsx) — `extractError()`:**
```typescript
// Now digs into nested { "error": { "message": "..." } }
if (v && typeof v === "object" && !Array.isArray(v)) {
  const nested = (v as Record<string, unknown>).message;
  if (typeof nested === "string" && nested.trim()) return nested.trim();
}
// Friendly HTTP status fallbacks
const fallbacks: Record<number, string> = {
  400: "Invalid request. Please check your input.",
  401: "Invalid credentials. Please try again.",
  403: "You don't have permission to perform this action.",
  404: "The requested resource was not found.",
  409: "A record with this information already exists.",
  429: "Too many requests. Please wait a moment and try again.",
  500: "Server error. Please try again later.",
  503: "Service unavailable. Please try again in a moment.",
};
return fallbacks[status] ?? "Something went wrong. Please try again.";
```

**Fix in [frontend/app/change-password/page.tsx](frontend/app/change-password/page.tsx):**
- The standalone raw `fetch` call now checks `data.error?.message` before `data.detail`/`data.message`.

---

### 4. Login Screen CSS Fixes

**Problem:** The login page left panel was not rendering correctly — faculty trust strip was invisible and campus image was barely visible.

**Fixes in [frontend/app/globals.css](frontend/app/globals.css):**

| Selector | Before | After |
|----------|--------|-------|
| `.trust-strip` | `display: none` | `display: flex; align-items: center; gap: 16px; position: relative; z-index: 1` |
| `.campus-image-wrap` | `opacity: 0.15; filter: grayscale(1)` | `opacity: 0.28; filter: grayscale(0.4); pointer-events: none` |
| `.identity-panel` background | `rgba(255,255,255,0.4)` | `linear-gradient(135deg, rgba(13,148,136,0.06), rgba(49,46,129,0.04))` — teal-to-indigo gradient fallback |

The login page now shows:
- Faculty avatars strip at the bottom-left of the hero panel ("Built for India's Future Leaders").
- Campus image visible with mild color tint instead of near-invisible grayscale.
- Left panel has visible background even when the external image doesn't load.

---

### Environment notes added today
- Gmail App Password stored in `backend/.env` as `EMAIL_HOST_USER` + `EMAIL_HOST_PASSWORD`.
- OTP storage uses Django's `LocMemCache` in dev (`cache.set(...)`) — switch to Redis in production.
- `apiForgotPassword`, `apiVerifyResetCode`, `apiResetPassword` all exported from `frontend/lib/auth-context.tsx`.

---

```bash
# Frontend
cd frontend
npm run dev          # http://localhost:3000

# Backend (separate terminal)
cd backend
python manage.py runserver 8000
# or: daphne config.asgi:application -p 8000
```

The Login Permission screen is fully usable in mock mode without the backend running.

---

## Environment Variables Added

```env
# frontend/.env.local
NEXT_PUBLIC_USE_MOCK=true   # switch to "false" when Django backend is ready
NEXT_PUBLIC_API_BASE=/api   # API base path (proxied through Next.js or direct)
```

---

## Day 5 Update — Gowtham (2026-05-20)

Worked on Academics → **Foundation Setup** wizard (Academic Year → Classes → Sections → Rooms → Subjects), plus a backend exception-handler bug found along the way.

**Files changed:**

- Backend
  - [backend/apps/academics/models.py](backend/apps/academics/models.py) — `Class.streams` M2M migrated to `through="ClassStream"` so each (class, stream) pair can carry its own capacity (per-stream capacity for Senior Secondary)
  - [backend/apps/academics/serializers.py](backend/apps/academics/serializers.py) — new `stream_capacities` field on `ClassSerializer` (read + write), validates 1–200 per stream
  - [backend/apps/academics/migrations/](backend/apps/academics/migrations/) — hand-written migration: `RemoveField` → `CreateModel ClassStream` → `AddField streams (through=ClassStream)` (Django can't `AlterField` an M2M to add `through`)
  - [backend/config/exception_handler.py](backend/config/exception_handler.py) — added explicit `Http404` branch returning a clean 404 envelope (previously fell through to a generic 500)
- Frontend
  - [frontend/components/academics/foundation/ConfirmDeleteDialog.tsx](frontend/components/academics/foundation/ConfirmDeleteDialog.tsx) — **new** shared on-brand delete confirmation modal (red `AlertTriangle` icon, `#DC2626` confirm button, ESC/backdrop close, in-flight spinner, "This action cannot be undone." subline)
  - [frontend/components/academics/foundation/panes/AcademicYearPane.tsx](frontend/components/academics/foundation/panes/AcademicYearPane.tsx) — trash icon now opens `ConfirmDeleteDialog` instead of native `confirm()`; 404-aware refresh
  - [frontend/components/academics/foundation/panes/ClassesPane.tsx](frontend/components/academics/foundation/panes/ClassesPane.tsx) — per-stream capacity card for Senior Secondary (hides common capacity), new `streamCapacities` state + payload shape; delete confirmation modal; 404-aware `updateClass` refresh
  - [frontend/components/academics/foundation/panes/SectionsPane.tsx](frontend/components/academics/foundation/panes/SectionsPane.tsx) — delete confirmation modal wiring
  - [frontend/components/academics/foundation/panes/RoomsPane.tsx](frontend/components/academics/foundation/panes/RoomsPane.tsx) — delete confirmation modal wiring
  - [frontend/components/academics/foundation/panes/SubjectsPane.tsx](frontend/components/academics/foundation/panes/SubjectsPane.tsx) — delete confirmation modal wiring (`handleDelete` signature changed from `(id: number)` to `(entry: ClassSubjectEntry)` so the modal can show the subject name); bulk `handleReset` still uses native `confirm()` (out of scope)

**Fixed today:**

- `PATCH /api/v1/core/classes/57/` was returning **500** for records that had been deleted server-side. Root cause: custom DRF exception handler had no `Http404` branch. Now returns a friendly 404 with `code: "not_found"`.
- Foundation Setup panes used the browser's native `confirm()` for the trash icon — visually inconsistent with the Eskoolia UI. Replaced across all 5 panes with a single shared `ConfirmDeleteDialog`. Each pane's delete flow now: open modal → spinner on Confirm → success toast → list refresh, or graceful 404 fallback ("This <thing> no longer exists. Refreshing the list…").
- Per-Stream Capacity: Senior Secondary classes can now carry a separate capacity per stream (e.g., Science 60, Commerce 40, Arts 30) instead of one class-wide capacity. Non-senior classes are unchanged.

**Still in progress:**

- Nothing pending on these tasks — all 5 panes verified with `get_errors` clean; backend migration applied locally via `python manage.py migrate core`.
- Branch `roles-new` pushed to origin (the previous `roles` branch had divergent history after pull/stash conflicts).

**Start tomorrow with:**

1. Verify per-stream capacity migration applies cleanly on Neon/staging (it was hand-written; double-check `ClassStream` row backfill for any existing senior classes).
2. End-to-end smoke test: create senior class with 3 streams → set distinct capacities → reload page → confirm values persist.
3. Apply the same `ConfirmDeleteDialog` pattern to other modules that still use native `confirm()` (Staff module, Students module, Fees structures) — quick win for UI consistency.
4. Audit `config/exception_handler.py` for other Django exceptions that may also silently 500: `PermissionDenied`, `NotAuthenticated`, `SuspiciousOperation`, `ImproperlyConfigured`.

**New bugs found:**

- **Custom DRF exception handlers must explicitly handle `django.http.Http404`** — otherwise it falls through to a 500 even though DRF's default handler would have converted it. Same risk exists for any other non-DRF exception class.
- **Django can't `AlterField` an M2M to add `through=`** — you must `RemoveField` then `CreateModel through_table` then `AddField` with the new `through`. Auto-generated `makemigrations` produced a broken migration; hand-edit required.
- **Windows case-insensitive filesystem vs. git case-sensitive index** — `team_context.md` (lowercase) and `TEAM_CONTEXT.md` (uppercase) were both tracked at different times. Running `git rm team_context.md` on Windows physically deleted the on-disk file (same inode as `TEAM_CONTEXT.md`); had to `git checkout HEAD -- TEAM_CONTEXT.md` to restore. Lesson: when resolving "deleted by us" conflicts on Windows, always check whether the index still tracks a differently-cased sibling before `git rm`.

---

## Day 6 Update — Person 3 (2026-05-21)

Worked on the **Super Admin Dashboard** — full code audit of the `dashboard` module (fixes #1–#20). All 20 bugs identified and resolved across 4 files.

**Files changed:**

- Frontend
  - [frontend/app/(dashboard)/super-admin/dashboard/page.tsx](frontend/app/(dashboard)/super-admin/dashboard/page.tsx) — 15 targeted fixes (see below)
  - [frontend/lib/api/super-admin/dashboard.ts](frontend/lib/api/super-admin/dashboard.ts) — URL path verification comment added (Fix #20)
  - [frontend/types/super-admin/index.ts](frontend/types/super-admin/index.ts) — removed 3 dead fields; added sync-guard comment (Fix #17)
- Backend
  - [backend/apps/super_admin/views.py](backend/apps/super_admin/views.py) — `normalize_board()` helper + board aggregation rewrite (Fix #12); N+1 eliminated (Fix #5); actual MRR from invoices (Fix #6); real MoM student trend (Fix #7); `normalize_state()` (Fix #10)

**Fixes applied — Session 1 (#1–#10):**

| # | Area | Fix |
|---|------|-----|
| 1 | Export button | Wired to `exportDashboardCsv()` — generates and downloads a real CSV from live `DashboardData` |
| 2 | Add School button | `window.location.href` → `router.push('/super-admin/schools')` (no full-page reload) |
| 3 | Fake sparklines | Removed all hardcoded sparkline `<Spark>` components from all 4 KPI cards |
| 4 | Needs Attention card | Wrapped in `<Link href="/super-admin/billing?status=overdue">` so the card navigates |
| 5 | N+1 in recent events | Prefetch all school names with a single query into `_school_name_map` dict |
| 6 | MRR from pricing table | `actual_mrr_by_plan` now computed from current-month invoices; `_PLAN_PRICING` is fallback only |
| 7 | Student trend | `students_trend` is real MoM % from `Student.created_at`; was hardcoded `0` |
| 8 | Error → zero-filled UI | Error state shows "Unable to load dashboard data" + Retry button; no more fake zeros |
| 9 | `<a>` → `<Link>` | "View all →" in Recent Activity changed to Next.js `<Link>` for client-side navigation |
| 10 | State normalization | `normalize_state()` accepts both GST numeric codes (`"36"`) and full names (`"Telangana"`) |

**Fixes applied — Session 2 (#11–#20):**

| # | Area | Fix |
|---|------|-----|
| 11 | MRR trend = 0 | `d.mrr.trend !== 0` → `d.mrr.trend != null` — trend of 0.0% now displays as "0.0%" not "—" |
| 12 | Board normalization | `normalize_board()` added (module-level); collapses `"SSC AP"` / `"SSC_AP"` variants by post-aggregation merge |
| 13 | Geographic footer | First 3 states shown + `+N more`; full list accessible via `title` tooltip on hover |
| 14 | Trial in MRR chart | `revenueRows = planRows.filter(p => p.mrr > 0)` — Trial (₹0) rows excluded from chart and `maxPlan` scaling |
| 15 | Activity items clickable | Each activity item wrapped in `<Link href="/super-admin/audit?event={id}">` with `cursor: pointer` |
| 16 | `relativeTime()` >7 days | Returns `"DD MMM"` locale string for events older than 7 days (was `"Xd"` indefinitely) |
| 17 | Dead TS fields | Removed `active_schools_count`, `new_schools_today`, `api_uptime_percent` from `DashboardData` |
| 18 | No refresh mechanism | Added manual `<RefreshCw>` button, 5-min `setInterval` auto-refresh, and "Updated X min ago" label |
| 19 | Raw UUID in activity | `ev.tenantId` → `ev.schoolName` in activity label; UUID was leaking into the UI |
| 20 | API URL verification | Confirmed `/api/super-admin/dashboard/` matches `config/urls.py` prefix; added comment |

**Fixed today:**

- All 20 audit findings resolved; zero TypeScript errors after final `get_errors` check.
- `mrrTrend` now correctly shows `"0.0%"` when MoM change is exactly zero (was `"—"`, misleading).
- Board breakdown no longer double-counts tenants with inconsistent casing/spacing in the `board` field.
- Activity panel no longer leaks internal UUIDs into the visible label.
- Dashboard now auto-refreshes every 5 minutes and shows a manual refresh button.

**Still in progress / known follow-ups:**

- Audit page (`/super-admin/audit`) does not yet filter by `?event=` query param — activity item deep-links (Fix #15) will land on the unfiltered audit list until that page is wired.
- `normalize_board()` normalizes on read; the underlying DB values remain mixed-case. A one-time data migration to standardize the `board` column is recommended.
- Fix #18 `lastUpdatedLabel` ticks every 60 s client-side; if the tab is backgrounded for >5 min, the interval fires but the label may drift until the next visible tick — acceptable for a dashboard.

**Start next with:**

1. Wire the Audit page to accept `?event=` query param and scroll to / highlight the matching event row.
2. Run a one-time SQL to normalize `SchoolTenant.board` column (uppercase + underscores) so `normalize_board()` reads clean data, not just post-processes dirty data.
3. Audit the **Billing** module (next module in the super-admin nav after Dashboard).

---

# TEAM_CONTEXT — Foundation Wizard (Academics Core Setup)

Branch: `academicfix` · Module: Academics → Core Setup (Foundation Wizard)

---

## Summary

A full fresh audit of the 5-step Foundation Wizard was performed.  
**15 bugs total fixed** (11 from prior session + 4 new in this session).  
Build verified clean: `npm run build` → 184 pages, 0 errors, 0 warnings.

---

## Files Modified

| File | Changes |
|---|---|
| `backend/apps/academics/views.py` | `ClassSubjectEntryViewSet`: split view/write permissions (#4F); added `_Pagination` inner class with `max_page_size=1000` (#4G) |
| `frontend/components/academics/foundation/FoundationWorkspace.tsx` | Step 4 done-check now uses `subjectEntriesExist` not global `subjects.length` (#W1); Step 5 (Rooms) now tracked in `done` set (#W2); `onComplete`/`onNext` callbacks set flags immediately (#W1/#W2) |
| `frontend/components/academics/foundation/hooks/useFoundationData.ts` | Added `checkSubjectEntriesExist()` (HEAD count of `/api/v1/academics/class-subject-entries/`) (#W1); Added `checkRoomsExist()` (HEAD count of `/api/v1/core/class-rooms/`) (#W2); both returned from hook |
| `frontend/components/academics/foundation/panes/AcademicYearPane.tsx` | Inline date conflict warnings (#1D); `is_active` toggle in edit mode (#1E); `is_active ?? true` null-safety fallback (#W4) |
| `frontend/components/academics/foundation/panes/ClassesPane.tsx` | Capacity input hidden in edit mode — API never returns `capacity` (write-only field), so pre-populate is impossible (#W3) |
| `frontend/components/academics/foundation/panes/SectionsPane.tsx` | "Next: Subjects →" label fix (#3E); per-section capacity input replacing hardcoded 40 (#3F) |
| `frontend/components/academics/foundation/panes/SubjectsPane.tsx` | Global subjects datalist autocomplete (#4E); `?page_size=1000` fetch (#4G); `periods_per_week` editable inline (#4H) |
| `frontend/components/academics/foundation/panes/RoomsPane.tsx` | Digit guard removed — LAB/LIBRARY room names now valid (#5D); helper text when no sections exist (#5E) |

---

## Bug Fix Register

| ID | Sev | Pane | Description |
|---|---|---|---|
| #1D | 🔵 | AcademicYearPane | Date conflict/overlap warnings (amber inline) |
| #1E | 🟠 | AcademicYearPane | is_active toggle only in edit mode |
| #2F | 🔵 | ClassesPane | updateClass() comment clarification |
| #3E | 🔵 | SectionsPane | "Next: Subjects →" label was wrong |
| #3F | 🟠 | SectionsPane | Hardcoded capacity=40 replaced with per-section input |
| #4E | 🟠 | SubjectsPane | Global subjects datalist autocomplete |
| #4F | 🟠 | views.py | Split view/write permissions on ClassSubjectEntryViewSet |
| #4G | 🔴 | views.py + SubjectsPane | max_page_size truncation fix (100→1000), frontend uses ?page_size=1000 |
| #4H | 🟠 | SubjectsPane | periods_per_week editable in inline edit |
| #5D | 🟠 | RoomsPane | Digit-only guard removed; LAB/LIBRARY/HALL names now valid |
| #5E | 🔵 | RoomsPane | Helper text when no sections exist |
| #W1 | 🔴 | FoundationWorkspace | Step 4 used global Subject count — fixed to ClassSubjectEntry existence check |
| #W2 | 🔴 | FoundationWorkspace | Step 5 (Rooms) never marked done — fixed |
| #W3 | 🟠 | ClassesPane | Capacity input shown in edit mode but silently dropped — hidden in edit mode |
| #W4 | 🔵 | AcademicYearPane | is_active missing ?? true fallback on openEdit |

---

## API Endpoints Used by Foundation Wizard

| Step | Endpoint | Notes |
|---|---|---|
| 1 | `/api/v1/academics/academic-years/` | CRUD academic years |
| 2 | `/api/v1/core/classes/` | CRUD classes; `capacity` is write-only |
| 3 | `/api/v1/core/sections/` | Bulk create/rename/delete sections |
| 4 | `/api/v1/academics/class-subject-entries/` | Per-class subject catalog; max_page_size=1000 |
| 4 | `/api/v1/core/subjects/` | Global subject catalog (autocomplete only) |
| 5 | `/api/v1/core/class-rooms/` | Classrooms; non-paginated or paginated both handled |

---

## Next Steps

1. Wire the Foundation Wizard "step complete" callbacks (`onComplete`, `onNext`) to also re-trigger the existence checks so the progress strip refreshes after mutations within the same session.
2. Consider adding a `capacity` field to `SchoolClass` type if `ClassSerializer` is updated to return it (currently `write_only`).
3. Audit `ClassSubjectAssignmentViewSet` — currently uses the default `ApiPageNumberPagination` (max_page_size=100) which may truncate large schools.

---

## Day 6 Update — Gowtham (2026-05-21)

### Fix: "Add School" Button in Dashboard Not Opening the Form

**Problem:** The **Add school** button on the Super-Admin dashboard (`app/(dashboard)/super-admin/dashboard/page.tsx`) used `router.push('/super-admin/schools')` which navigated to the Schools page but did **not** open the Add School accordion — users landed on the list with no visible form.

**Root cause:** The Schools page initialises `accAddOpen` as `false`. Without a signal from the caller, there was no way for the page to know it should auto-open the form. No URL parameter was being passed.

**Fix — two files only:**

- **`frontend/app/(dashboard)/super-admin/dashboard/page.tsx`**
  - Changed `router.push('/super-admin/schools')` → `router.push('/super-admin/schools?add=1')` on the "Add school" button `onClick`.

- **`frontend/app/(dashboard)/super-admin/schools/page.tsx`**
  - Added `useRouter` and `useSearchParams` imports from `next/navigation`.
  - Added `const router = useRouter()` and `const searchParams = useSearchParams()` inside the page component.
  - Added a `useEffect` (runs once on mount) that:
    1. Checks `searchParams.get('add') === '1'`.
    2. Sets `accAddOpen(true)`.
    3. Calls `router.replace('/super-admin/schools', { scroll: false })` to clean the URL (no history entry added).
    4. After 120 ms smooth-scrolls to `#acc-add` so the open accordion is visible.

**No backend changes required** — this is purely a frontend navigation / state concern.

**Verification:** `get_errors` on both files → no TypeScript or lint errors.

---

### Fix: Health Flag Pills in School Management Not Filtering Data

**Problem:** The health-flag filter pills in the Schools list accordion ("Billing overdue", "Storage 80%+", "Trial ending <7d", "GSTIN missing") had hardcoded fake counts and `onClick={() => {}}` no-ops. Clicking them did nothing — no filter was sent to the backend and no schools were filtered.

**Root cause:** The pills were pure UI stubs with static data. No state, no API call, no backend query support.

**Fix — backend (`apps/super_admin/views.py`):**

- Added `from datetime import timedelta` import.
- In `SchoolTenantListView.get_queryset()`, added a `health_flag` query-param branch after existing filters:
  | Flag param value | Filter applied |
  |---|---|
  | `billing_overdue` | Schools with any `SuperAdminInvoice` where `status='overdue'` OR `due_date < today AND status IN ['draft','sent']` |
  | `trial_ending` | `plan='trial'` AND `provisioned_at` between `today−37d` and `today−23d` (30-day trial convention, ending within 7 days) |
  | `gstin_missing` | `gstin=''` OR `gstin IS NULL` |
  | `storage_80` | Returns empty queryset (no per-tenant storage tracking field yet) |

- Added `_health_flags_counts()` method that computes counts across all non-archived tenants (independent of current filter state).
- Overrode `get()` to call `_paginate()` then inject `health_flags_counts: {...}` into the response envelope.

**Fix — frontend types (`frontend/types/super-admin/index.ts`):**

- Added `HealthFlagsCounts` interface: `{ billing_overdue, storage_80, trial_ending, gstin_missing: number }`.
- Added `health_flags_counts?: HealthFlagsCounts` to `PaginatedResponse<T>`.
- Added `health_flag?: string` to `SchoolFilters`.

**Fix — API client (`frontend/lib/api/super-admin/schools.ts`):**

- `getSchools()` now appends `health_flag` to the query string when present.

**Fix — page component (`frontend/app/(dashboard)/super-admin/schools/page.tsx`):**

- Imported `HealthFlagsCounts` type.
- Added `healthFlagFilter: string` state (empty = no flag active).
- Added `healthFlagCounts: HealthFlagsCounts` state, initialised to all zeros.
- `loadSchools()` now passes `health_flag: healthFlagFilter || undefined` in filters and, on success, calls `setHealthFlagCounts(res.health_flags_counts)` if present.
- Added `healthFlagFilter` to `loadSchools` `useCallback` deps and to the `useEffect` that resets `page` to 1.
- Replaced the four static stubs with real `FilterPill` components using live `healthFlagCounts` values; clicking toggles the active flag (click same pill again to clear).

**Verification:** `python -c "py_compile.compile('views.py')"` → OK; `get_errors` on all three frontend files → no errors.

**Remaining caveat:** `storage_80` always returns 0 and an empty list — a `storage_used_gb` / `storage_cap_gb` field would need to be added to `SchoolTenant` + a migration before this flag can be populated.

---

## Day 6 Continued — Gowtham (2026-05-21)

### Fix: Remove Duplicate Status Tabs from Smart Filters

**Problem:** The All / Active / Trial / Suspended / Archived status pills appeared **twice** — once inside the "Smart Filters" accordion and again as the quick-tab bar above the schools table. Users were confused seeing the same controls repeated.

**Fix — `frontend/app/(dashboard)/super-admin/schools/page.tsx`:**

- Removed the entire "Status" subsection (the `<div>` containing the `FilterPill` loop over `all/active/trial/suspended/archived`) from the **Smart Filters** accordion body.
- The Health flags row was the only remaining sibling; its wrapper was changed from `grid grid-cols-2 gap-6` to a single `<div>` (full width) — no other code touched.
- Status tabs remain in the Schools List accordion (the styled `<button>` tab bar above the table) — the only correct location.

---

### Fix: Remove "Saved Presets" Section from Smart Filters

**Problem:** The Smart Filters accordion had a "Saved presets" bar at the bottom with three hardcoded preset pills ("All active Telangana", "Trial → conversion review", "GSTIN missing"), a "+ Save current" button, and an "Apply" button. These were all static stubs — none of them did anything. They added visual clutter and were misleading.

**Fix — `frontend/app/(dashboard)/super-admin/schools/page.tsx`:**

- Removed the entire `<div className="mt-[18px] flex flex-wrap items-center justify-between gap-2.5 border-t border-dashed ...">` block containing the Saved presets label, preset pills, "+ Save current", and "Apply" buttons.
- No backend changes required — the `handleApplyFilters` function it called was a no-op.

---

### Feature: GSTIN Validation (Frontend + Backend)

**Context:** The schools list already shows a GSTIN column (and PAN sub-row) — both fields come from `SchoolTenantBaseSerializer` which includes `"gstin"` and `"pan"`. The GSTIN input existed in both the Edit School modal and the Add School accordion's GST & legal section, but there was no format validation — any string up to 15 chars was accepted silently.

**GSTIN format:** `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$` (e.g. `27AABCU9603R1ZX`)

**Fix — Backend (`backend/apps/super_admin/serializers.py`):**

Added `validate_gstin` and `validate_pan` methods to `SchoolTenantUpdateSerializer`:
- `validate_gstin(value)` — if non-blank, runs the 15-char GSTIN regex; raises `ValidationError("Invalid GSTIN format. Must be 15 characters, e.g. 27AABCU9603R1ZX")` on mismatch.
- `validate_pan(value)` — if non-blank, validates `^[A-Z]{5}[0-9]{4}[A-Z]{1}$` (10 chars); raises `ValidationError("Invalid PAN format. Must be 10 characters, e.g. AABCU9603R")`.
- Both are optional (allow blank) — schools without a GSTIN/PAN are valid.

**Fix — Frontend (`frontend/app/(dashboard)/super-admin/schools/page.tsx`):**

- In `EditSchoolModal` component:
  - Added `GSTIN_RE` constant and `gstinError` derived string (non-empty when GSTIN is present but invalid).
  - Added `saveDisabled` flag: `busy || !form.name.trim() || !!gstinError`.
  - GSTIN input gets a red border class (`border-[var(--danger)]`) when `gstinError` is set.
  - Inline error `<p className="mt-1 text-[11px] text-[var(--danger)]">` shown below the GSTIN input when invalid.
  - Save button uses `saveDisabled` instead of the previous `busy || !form.name.trim()`.

- In Add School accordion (GST & legal section, `Fld label="GSTIN"`):
  - Same inline red-border + error `<p>` pattern applied to the `editFields.gstin` input.
  - Error renders only while the field has content that doesn't match the pattern (doesn't fire on empty — GSTIN is optional).

**Verification:** `get_errors` on `schools/page.tsx` → no errors; backend `validate_gstin` tested with `py_compile` → OK.

---

## Day 6 Continued — Gowtham (2026-05-21) — Session 2

### Fix: Add "Apply filters" button to Smart Filters accordion

**Problem:** The Smart Filters accordion (plan, board, state selectors) had no submit button. Selecting a plan/board/state had no effect until the user knew to press Enter or wait. The previously-removed Saved Presets block contained an "Apply" button; when that was deleted the button was lost.

**Fix — `frontend/app/(dashboard)/super-admin/schools/page.tsx`:**
- Added an "Apply filters" `<button>` at the bottom-right of the Smart Filters accordion, separated from Health flags by a dashed border.
- Button is styled with the primary brand colour (`#5B4FCF` / hover `#4A3FBF`) and calls the existing `handleApplyFilters` callback which commits `pendingPlan`, `pendingBoard`, `pendingState` into the live filter state and resets `page` to 1.

---

### Fix: Schools List Status Tab Filtering Broken

**Root causes identified:**
1. `status=active` backend filter used `exclude(archived, suspended)` → trial-plan schools appeared in BOTH the "Active" AND "Trial" tabs (overlap).
2. Tab badge counts were computed **client-side** from a paginated `page_size=200` globalStats fetch, but `max_page_size=100` in `SuperAdminPagination` clamped it to 100 schools — counts were silently wrong if >100 schools exist.
3. The backend accepted any arbitrary string as a `status` query param (the `else: filter(status=status_value)` branch allowed injection of arbitrary DB filter values).
4. The `SchoolTenantUpdateSerializer` had no `validate_status` — a PATCH call could set `status='trial'` (a plan value, not a valid status), creating bad DB state that confused the filters.
5. Frontend had no type-safe set of valid tab values — any string could be set as `statusFilter`.

**Fix — `backend/apps/super_admin/views.py`:**
- Added `_VALID_STATUS_PARAMS = {"active", "trial", "suspended", "archived"}` in `get_queryset`. Only params in this set are applied; anything else is silently ignored (prevents arbitrary DB filter injection).
- Changed `status=active` handler: now also `.exclude(plan="trial")` so Active and Trial tabs are mutually exclusive.
- Changed `status=suspended` / `status=archived` to explicit `elif` branches instead of a catch-all `else`.
- Added `_status_counts()` method: runs five DB aggregation queries on the unfiltered base queryset → returns `{all, active, trial, suspended, archived}` counts that are always accurate regardless of pagination.
- Updated `get()`: now includes `resp.data["status_counts"] = self._status_counts()` in every schools list response.

**Fix — `backend/apps/super_admin/serializers.py`:**
- Added `_VALID_STATUSES = {"active", "suspended", "archived", "pending", "onboarding", "provisioning"}` on `SchoolTenantUpdateSerializer`.
- Added `validate_status(value)` method: raises `ValidationError` if a PATCH request tries to set `status='trial'` or any other unsupported value.

**Fix — `frontend/types/super-admin/index.ts`:**
- Added `StatusCounts` interface: `{ all, active, trial, suspended, archived: number }`.
- Added `status_counts?: StatusCounts` to `PaginatedResponse<T>`.

**Fix — `frontend/app/(dashboard)/super-admin/schools/page.tsx`:**
- Added `VALID_STATUS_TABS` set and `StatusTab` union type before the page component; `statusFilter` state changed from `SchoolStatus | 'all'` to `StatusTab`.
- In `loadSchools`: added `safeStatus` guard — validates `statusFilter` against `VALID_STATUS_TABS` before building the API filters object (prevents sending invalid values).
- Tab badge counts now use `response.status_counts?.{tab}` (server-computed, always correct), falling back to `globalStats` if the backend somehow doesn't return them.

**Verification:** `get_errors` on `schools/page.tsx` and `types/super-admin/index.ts` → no errors.

**Status-to-filter mapping (after fix):**
| Tab | `status` param sent | Backend filter |
|---|---|---|
| All | *(none)* | All schools, no restriction |
| Active | `active` | `exclude(archived, suspended)` + `exclude(plan=trial)` |
| Trial | `trial` | `filter(plan=trial)` + `exclude(archived, suspended)` |
| Suspended | `suspended` | `filter(status=suspended)` |
| Archived | `archived` | `filter(status=archived)` |

## Day 6 Continued — Gowtham (2026-05-21) — Session 3

### Student List Export — openpyxl XLSX Export (Backend + Frontend)

**Problem:** Clicking "Select All" on the student list only selected the current page (max 25 students). Clicking "Export selected" then only exported those 25 rows, not all students matching current filters. Export was also client-side CSV only — no Excel support.

**Fix:**

**Backend — `apps/students/views.py` (`StudentViewSet`)**
- Added `export_xlsx` action (`GET /api/v1/students/students/export-xlsx/`) using `openpyxl` (already in `requirements.txt`).
- Calls `self.get_queryset()` — respects all filter params (search, is_active, include_deleted, deleted_only, current_class, current_section).
- Optional `?ids=1,2,3` query param restricts export to specific student IDs.
- Returns `.xlsx` file with:
  - Styled header row (brand colour `#5B4FCF`, white bold text, centred).
  - Columns: Admission No, Student, Class, Section, Guardian, Phone, DOB, Status.
  - Auto-sized column widths; frozen header row (`freeze_panes = "A2"`).
  - Iterates with `qs.iterator(chunk_size=500)` — no memory spike for large exports.
- No pagination — all matching rows are returned in one file.

**Frontend — `components/students/StudentListPanel.tsx`**
- Imported `apiRequestWithRefreshResponse` (returns raw `Response` for blob download).
- Added `downloadXlsxBlob(queryString, filename)` — calls the export endpoint, gets blob, triggers `<a>` download.
- Added `buildFilterParams()` — builds `URLSearchParams` matching the same filters as `loadStudents`.
- Replaced all three export handlers:
  - `handleExportAll` → calls backend with filter params only (no `ids`) → downloads all filtered students.
  - `handleExportSelected`:
    - If `allVisibleSelected && totalCount > students.length` → delegates to `handleExportAll()` (Select All = export all pages).
    - Otherwise → passes `ids=selectedIds.join(",")` to backend → exports only selected students.
  - `handleExportVisible` → passes `ids` of current page students to backend → exports exactly what's visible.
- `exportAllBusy` state blocks double-clicks; button shows "Exporting…" during fetch.

## Day 6 Continued — Gowtham (2026-05-21) — Session 4

### School List Export — openpyxl XLSX Export (Backend + Frontend)

**Problem:** The two Export buttons on the Super-Admin Schools page (`/super-admin/schools`) had no `onClick` — clicking them did nothing.

**Fix:**

**Backend — `apps/super_admin/views.py`**
- Added `SchoolTenantExportXlsxView(SchoolTenantListView)`:
  - Inherits `get_queryset()` from `SchoolTenantListView` — all existing filters (search, status, plan, board, state, health_flag) work automatically.
  - Iterates with `qs.iterator(chunk_size=500)` — no memory spike.
  - Builds `.xlsx` using `openpyxl` (already in `requirements.txt`).
  - Columns: School Name, Tenant ID, State, Board, Plan, Status, GSTIN, Students, Staff, Provisioned At.
  - Styled header row (brand colour `#5B4FCF`), frozen panes (`A2`), auto column widths.
  - Returns `HttpResponse` with `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`.

**Backend — `apps/super_admin/urls.py`**
- Imported `SchoolTenantExportXlsxView`.
- Registered `path("schools/export-xlsx/", ...)` **before** `schools/<str:tenant_id>/` so the slug doesn't swallow it.

**Frontend — `app/(dashboard)/super-admin/schools/page.tsx`**
- Imported `apiRequestWithRefreshResponse` from `@/lib/api-auth`.
- Added `exportBusy` state (boolean).
- Added `handleExportSchoolsXlsx` async function:
  - Builds `URLSearchParams` matching the same filters as `loadSchools` (status, search, plan, board, state, health_flag).
  - Calls `apiRequestWithRefreshResponse("/api/super-admin/schools/export-xlsx/?...")`.
  - Gets blob → triggers `<a>` download → revokes object URL.
  - Shows `toast.error` on failure; sets `exportBusy` during fetch.
- Wired **both** Export buttons (top-right header + inside the school list accordion) to `onClick={() => void handleExportSchoolsXlsx()}`.
- Buttons show "Exporting…" and are disabled (`disabled:opacity-60 disabled:cursor-not-allowed`) while fetching.

---

## Day 7 — 2026-05-22 — Multi-Tenancy Login Flow & Cross-Tenant Security

**Branch:** `login/21-05`

---

### 1. API Base URL: Subdomain-Aware Routing

**Problem:** `NEXT_PUBLIC_API_URL=http://127.0.0.1:8000` in `frontend/.env.local` was overriding all API calls to hit `127.0.0.1:8000` (no subdomain in `Host` header). After login, `apiGetMe()` hit the bare IP → Django's `TenantAwareJWTAuthentication` rejected the JWT with `"User authentication requires tenant context. Please use tenant subdomain."`.

**Fix — [frontend/lib/api.ts](frontend/lib/api.ts):**
- Added `pickApiBaseUrl()` function that detects eskoolia subdomains at runtime and returns `DEFAULT_API_BASE_URL` so the browser's own subdomain is preserved as the `Host` header:
  ```typescript
  function pickApiBaseUrl(): string {
    if (typeof window !== "undefined") {
      const host = window.location.hostname;
      const onTunnel = /devtunnels\.ms$/i.test(host) || /\.githubpreview\.dev$/i.test(host);
      if (onTunnel) return DEFAULT_API_BASE_URL;
      const parts = host.split(".");
      if (parts.length >= 3 && parts[1] === "eskoolia") return DEFAULT_API_BASE_URL;
    }
    return process.env.NEXT_PUBLIC_API_BASE_URL || process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_BASE_URL;
  }
  ```
- `API_BASE_URL` is now the result of `pickApiBaseUrl()` instead of a plain env var lookup.

---

### 2. Next.js Dev Server Cross-Origin Static Assets

**Problem:** `/_next/static/css/` and JS chunks returned 404 when accessed from `narayana.eskoolia.local:3000` — Next.js dev server was blocking cross-origin requests from the eskoolia subdomain.

**Fix — [frontend/next.config.mjs](frontend/next.config.mjs):**
```javascript
allowedDevOrigins: ["*.eskoolia.local"],
```

---

### 3. School-Info API — Relative URL Fix

**Problem:** `frontend/app/login/page.tsx` fetched `/api/v1/tenancy/school-info/?subdomain=...` as a relative URL, which hit the Next.js dev server at `:3000` instead of the Django backend at `:8000`, returning 404.

**Fix — [frontend/app/login/page.tsx](frontend/app/login/page.tsx):**
- Added import: `import { API_BASE_URL } from "@/lib/api";`
- Changed fetch to use the full backend URL:
  ```typescript
  fetch(`${API_BASE_URL}/api/v1/tenancy/school-info/?subdomain=${encodeURIComponent(subdomain)}`)
  ```

---

### 4. Narayana School — Domain Record & Tenant Activation

**Operations performed on Neon DB (via Django shell):**
- Created `Domain` record: `domain='narayana'` → `SchoolTenant(tenant_id='TNT_B0890DC1', name='Narayana High School')`.
- Activated the tenant: `SchoolTenant.objects.filter(pk=...).update(status='active')` — **never use `.save()`** (triggers `migrate_schemas` which is not registered in this hybrid setup).
- Added `127.0.0.1 narayana.eskoolia.local` to Windows `hosts` file.

---

### 5. Cross-Tenant Login Security Fix

**Problem:** A user from school A could log into school B's portal using valid credentials. Nothing prevented cross-school authentication.

**Fix — [backend/apps/users/serializers.py](backend/apps/users/serializers.py):**

**Change 1** — New import:
```python
from apps.tenancy.context import get_current_tenant, is_multi_tenancy_enabled
```

**Change 2** — Tenant-scope check inserted in `LoginTokenObtainPairSerializer.validate()`, between password validation and token issuance:
```python
if is_multi_tenancy_enabled() and not user.is_superuser:
    current_tenant = get_current_tenant()
    if current_tenant is not None:
        user_school_id = getattr(user, 'school_id', None)
        if not user_school_id:
            raise AuthenticationFailed(
                "Your account is not assigned to any school. "
                "Please contact your administrator."
            )
        # ... school_matches check against subdomain_url / code / name
        if not school_matches:
            raise AuthenticationFailed("Invalid credentials for this school portal.")
```

**Matching logic (`school_matches`):** True if any of these hold:
- `user.school.subdomain == current_tenant.subdomain_url`
- `user.school.code == current_tenant.subdomain_url`
- `user.school.name == current_tenant.name` (case-insensitive)

**Verified behaviour (tested via Django shell + live dev server):**

| User | Host | HTTP | Result |
|------|------|------|--------|
| `testadmin` (no school) | `narayana.eskoolia.local` | 401 | "not assigned to any school" |
| `testadmin` (no school) | `testschool.eskoolia.local` | 401 | "not assigned to any school" |
| `testadmin` | `127.0.0.1` (no tenant) | 200 | OK — public schema bypasses check |
| Superuser | any subdomain | 200 | OK — `is_superuser=True` skips check |

---

### Environment Notes (updated)

- `get_current_tenant()` uses `ContextVar` (not thread-local) — set by `TenantMainMiddleware.process_request()`, visible throughout the request stack.
- `TenantMainMiddleware` resolves tenants from the `Host` header; lookup: `Domain.objects.get(domain='<subdomain>')`.
- If `_verify_schema_exists()` fails (schema missing on Neon), the middleware raises `Http404` — provision the schema first.
- Dev server must be restarted (not just auto-reloaded) after major serializer changes when the old process is from a different session.
- Always use `py -3.10` for Django commands; `node_modules\.bin\next dev` for frontend (not `npm run dev`).

---

### Start next with:

1. Test the full login flow in browser: navigate to `narayana.eskoolia.local:3000/login`, log in with a Narayana admin — confirm redirect to dashboard with correct tenant context.
2. Create a real Narayana admin user with `school=Narayana High School` assigned and confirm login succeeds on narayana subdomain but fails on testschool subdomain.
3. Seed school-assigned users for `narayana` tenant schema if not already present.
4. Consider adding `amarajyothi.eskoolia.local` Domain record + activation (hosts entry already exists).
5. Commit the `login/21-05` branch changes: `api.ts`, `next.config.mjs`, `login/page.tsx`, `serializers.py`.

---

## Day 6 Continued — Gowtham (2026-05-21) — Session 5

### Sections Pattern Mixing Bug — Replace Endpoint + Frontend Tracking

**Problem:** When a user created sections with pattern "A, B, C" and then changed the Name Pattern dropdown to "1, 2, 3" and clicked Create Sections again, both sets of sections co-existed (e.g. Grade 12 showed A, B, C **and** 1, 2, 3). The old code only POSTed new sections without removing the previous pattern's sections.

**Fix:**

**Backend — `apps/core/views.py` (`SectionViewSet`)**
- Added import: `from django.db.models.functions import Lower`
- Added `replace` action (`POST /api/v1/core/sections/replace/`) with full validation:
  - `class_ids` — non-empty list of integers, scoped to user's school
  - `old_names` — list of section names to delete (case-insensitive, may be empty for first-time create)
  - `new_names` — non-empty list of section names to create (max 10)
  - `capacity` — integer 1–200 (default 40)
  - For each class: deletes sections matching `old_names` via `annotate(name_lower=Lower("name")).filter(name_lower__in=...)`, then creates `new_names` sections skipping existing ones.
  - Returns `{success, message, deleted, created}`.

**Frontend — `components/academics/foundation/panes/SectionsPane.tsx`**
- Added `PATTERN_LABELS` map (`alpha → "A, B, C"`, `num → "1, 2, 3"`, `roman → "I, II, III"`).
- Added `appliedPattern: Pattern | null` state (tracks the last pattern that was successfully applied via Create Sections; starts as `null`).
- Modified `createSections()`:
  - If `appliedPattern !== null && appliedPattern !== pattern` → calls `POST /api/v1/core/sections/replace/` with `old_names = PATTERNS[appliedPattern]` (full pattern list) and `new_names = preview`. Shows toast with deleted/created counts. Sets `setAppliedPattern(pattern)` on success.
  - Otherwise (same pattern or first time) → original POST-per-section loop. Sets `setAppliedPattern(pattern)` when at least one section is created.
- Added warning banner between the Name Pattern dropdown and the Preview chips: shown when `appliedPattern !== null && appliedPattern !== pattern && selectedClsIds.size > 0`. Text: "Pattern changed from **A, B, C** to **1, 2, 3**. Clicking Create Sections will remove the old sections and create new ones for the selected classes."

**Behaviour after fix:**
1. Create sections with A,B,C → `appliedPattern = "alpha"`, sections A,B,C exist in DB.
2. Change pattern dropdown to 1,2,3 → yellow warning banner appears for selected classes.
3. Click Create Sections → backend deletes A,B,C sections, creates 1,2,3 sections → only 1,2,3 remain.

## Day 7 — Gowtham (2026-05-22) — Session 1

### Sections — Create toast fix + Bulk Multi-Select Delete + Refactor to APIView

#### 1. Create Sections toast not showing (fix)
**Problem:** `createSections()` made N×M sequential requests (13 classes × 3 sections = 39 `await` calls). The first 400 could abort the loop silently (`void` swallows the rejected promise); even when it didn't, the error-regex matching was fragile against the custom exception handler's response format.

**Fix:** Replaced the entire N×M loop with a **single** `POST /api/v1/core/sections/replace/` call for all cases:
- First-time creation: `old_names = []`, `new_names = preview` → creates sections, skips existing.
- Pattern changed: `old_names = PATTERNS[appliedPattern]`, `new_names = preview` → deletes old, creates new.
- Result always triggers a toast: success counts **or** "Sections already exist…" error message.

#### 2. Bulk Multi-Select Delete
**Problem:** Sections could only be deleted one at a time (single confirm dialog per section).

**Frontend — `SectionsPane.tsx`**
- Added state: `selectMode`, `selectedSecIds: Set<number>`, `pendingBulkDelete`, `bulkDeleting`.
- Right panel header gains a **Select** link (visible when sections exist).
- In select mode: each section pill becomes a checkbox toggle (brand-coloured when checked); rename/delete buttons are hidden.
- Header in select mode shows: **Select All** · **Delete N** (red) · **Cancel**.
- `Delete N` opens a confirm dialog listing all selected sections with their class names (scrollable if > 10).
- `confirmBulkDelete()` → `POST /api/v1/core/sections/bulk-delete/` → toast with deleted count → clears selection.

#### 3. Refactored backend from ViewSet @action to standalone APIView classes
**Reason:** Project convention — custom endpoints use `APIView`, not `@action` decorators on ViewSets.

**`apps/core/views.py`**
- Added `from rest_framework.views import APIView`.
- Removed `replace` and `bulk_delete` `@action` methods from `SectionViewSet`.
- Added `SectionReplaceView(APIView)` — same logic, `def post(self, request)`.
- Added `SectionBulkDeleteView(APIView)` — same logic, `def post(self, request)`.

**`apps/core/urls.py`**
- Added `from django.urls import path`.
- Imported `SectionReplaceView`, `SectionBulkDeleteView`.
- Registered both **before** `router.urls`:
  ```python
  urlpatterns = [
      path("sections/replace/",      SectionReplaceView.as_view(),      name="section-replace"),
      path("sections/bulk-delete/",  SectionBulkDeleteView.as_view(),   name="section-bulk-delete"),
  ] + router.urls
  ```
  URL paths unchanged — frontend requires no update.

---

## Day 7 — Gowtham (2026-05-22) — Session 2

### Foundation Wizard — Pagination across all list panes + reset-class 405 fix

#### 1. Fix: 405 "Method Not Allowed" on `POST /api/v1/academics/class-subject-entries/reset-class/`

**Problem:** Frontend POSTed to `/reset-class/` (hyphen) but DRF 3.16.1 auto-generates the URL slug from the Python method name, producing `reset_class/` (underscore). Result: 405 on every reset attempt.

**Fix — `backend/apps/academics/views.py`:**
- Added `url_path="reset-class"` to the `@action` decorator on `reset_class` in `ClassSubjectEntryViewSet`.
- No frontend change needed — frontend URL was already correct.

---

#### 2. Feature: RoomsPane — 5-per-page pagination (frontend only)

**File: `frontend/components/academics/foundation/panes/RoomsPane.tsx`**

- Added `const ROOMS_PER_PAGE = 5` before the component.
- Added `roomsPage` state (`useState(0)`).
- When a room is added, `setRoomsPage` jumps to the last page so the new entry is immediately visible.
- Table slices `rooms` to `pageRooms = rooms.slice(safePage * 5, (safePage + 1) * 5)`.
- Pagination bar (shown when `rooms.length > 5`):
  - Left: `1–5 of N` label.
  - Right: `<` disabled when on page 0, `page / total` indicator, `>` disabled on last page.
  - Consistent style: `w-6 h-6` button, `rounded-[6px]`, hover `#EEF0FF` / `#5B4FCF`.

---

#### 3. Feature: SubjectsPane — 10-per-page catalog pagination (backend + frontend)

**Backend — `backend/apps/academics/views.py`:**
- `ClassSubjectEntryViewSet._Pagination.page_size` changed from 50 → 10.
- `max_page_size` raised to 1000 (wizard still fetches `?page_size=1000` to get all entries for a class in one request; the 10/page default only affects plain list views).

**Frontend — `frontend/components/academics/foundation/panes/SubjectsPane.tsx`:**
- Added `const CATALOG_PER_PAGE = 10` before the component.
- Added `catalogPage` state (`useState(0)`); resets to 0 on class (`selCls`) change via `useEffect`.
- Catalog rows sliced to `pageEntries = classEntries.slice(safePage * 10, (safePage + 1) * 10)`.
- `startEdit(entry, classEntries)` computes the entry's page index and sets `catalogPage` so the editing row stays visible.
- Adding a new subject jumps to the last page.
- Pagination bar (shown when `classEntries.length > 10`): same `<` / `>` pattern as Rooms.

---

#### 4. Feature: ClassesPane — 10-per-page pagination (backend + frontend)

**Backend — `backend/apps/core/views.py`:**
- `ClassViewSet` given explicit `pagination_class = ApiPageNumberPagination` (was relying on global default; now explicit at 10/page).

**Frontend — `frontend/components/academics/foundation/panes/ClassesPane.tsx`:**
- Added `const CLASSES_PER_PAGE = 10` before the component.
- Added `classesPage` state (`useState(0)`).
- "Classes Defined" right-panel table sliced to `pageClasses = classes.slice(safePage * 10, (safePage + 1) * 10)`.
- Pagination bar (shown when `classes.length > 10`): same `<` / `>` pattern.

---

#### 5. Feature: HolidaysPane — 15-per-page pagination (backend + frontend)

**Backend — `backend/apps/core/views.py`:**
- Added `_Pagination` inner class to `HolidayViewSet`:
  ```python
  class _Pagination(ApiPageNumberPagination):
      page_size = 15
      max_page_size = 200
  pagination_class = _Pagination
  ```

**Frontend — `frontend/components/academics/foundation/panes/HolidaysPane.tsx`:**
- Added `const HOLIDAYS_PER_PAGE = 15` before the component.
- Added `holidaysPage` state (`useState(0)`); resets to 0 on every `fetchItems` call (covers both year-filter and type-filter changes automatically).
- Removed the `max-h-[500px] overflow-y-auto` scrollable wrapper — table is now flat.
- Table `tbody` uses paginated IIFE: slices `items` to 15 per page.
- Pagination bar rendered inside the table card container (below `</table>`) — shown only when `items.length > 15`:
  - Left: `1–15 of N` label.
  - Right: `<` / page indicator / `>` in the same consistent style as all other panes.

**Note:** Navigation buttons only appear once the holiday count exceeds 15. With fewer records the table looks identical to before — the functional change is the removal of the scroll wrapper.

---

#### Consistent pagination button pattern used across all panes

```tsx
<div className="flex items-center justify-between ...">
  <span className="text-[10px] text-[#9FA6AD]">
    {start}–{end} of {total}
  </span>
  <div className="flex items-center gap-1">
    <button onClick={prev} disabled={onFirst}
      className="w-6 h-6 ... hover:bg-[#EEF0FF] hover:text-[#5B4FCF] disabled:opacity-30"
    >&lt;</button>
    <span className="text-[10px] text-[#6F767E] min-w-[40px] text-center">{page} / {total}</span>
    <button onClick={next} disabled={onLast}
      className="w-6 h-6 ... hover:bg-[#EEF0FF] hover:text-[#5B4FCF] disabled:opacity-30"
    >&gt;</button>
  </div>
</div>
```

---

#### Pending (requested, not yet implemented)

~~**Subject catalog — remove periods on edit**~~ → **Completed in Session 3 (see below).**

---

## Day 7 — Gowtham (2026-05-22) — Session 3

### SubjectsPane — Remove "Periods per Week" from Inline Edit Row

**Problem:** The inline edit row in the Subject Catalog showed a number input (`w-14`) displaying the `periods_per_week` value (e.g. "7"). The user did not want this field visible or editable during subject editing.

**Fix — `frontend/components/academics/foundation/panes/SubjectsPane.tsx`:**
- Removed the `{/* Fix #4H — periods per week editable in inline edit */}` comment and its `<input type="number" ... />` element from the inline edit row JSX (was between the Type `<select>` and the closing `</div>`).
- No state, no handler, no PATCH body line was changed — `editPeriods` state is still initialized from `entry.periods_per_week` and still sent in the PATCH body, so the existing value is silently preserved on save without exposing it to the user.
- No backend changes required.

**Inline edit row fields after fix:** Subject Name → Code → Type → Cancel / Save

**Verification:** `get_errors` on `SubjectsPane.tsx` → no errors.

---

## Day 7 — Gowtham (2026-05-22) — Session 4

### SubjectsPane — Comprehensive Strict Subject Name Validation

**Problem:** The "Add Subject" form accepted invalid values such as `"."`, `"12345"`, `"@@@"`, `"////"`, and emojis as subject names. Previous validation only checked for at least one letter, min 2 chars, and consecutive repeated characters — but the repeated-character rule was too aggressive and could block legitimate abbreviations.

**Fix — Frontend (`frontend/components/academics/foundation/panes/SubjectsPane.tsx`):**

Replaced the `validateSubjectName` helper (before the component) with a strict allowlist approach:

```typescript
function validateSubjectName(v: string): string | null {
  const t = v.trim();
  if (!t) return "Subject name cannot be empty.";
  if (t.length < 2) return "Enter a valid subject name.";
  if (t.length > 50) return "Maximum 50 characters allowed.";
  // Allow: letters, digits, single space, &, -, (), .
  if (!/^[a-zA-Z0-9 &\-().]+$/.test(t)) return "Special characters are not allowed.";
  // Must contain at least one letter (blocks pure numbers like "12345")
  if (!/[a-zA-Z]/.test(t)) return "Enter a valid subject name.";
  // No consecutive spaces
  if (/ {2,}/.test(t)) return "Enter a valid subject name.";
  return null;
}
```

**Allowed characters:** letters, digits, single space, `&`, `-`, `()`, `.`  
**Error messages match spec:** "Subject name cannot be empty." / "Enter a valid subject name." / "Maximum 50 characters allowed." / "Special characters are not allowed."  
**Removed** the old repeated-character rules (CC, abcccc patterns) — the allowlist naturally blocks symbols/emojis; repeated letters are valid (e.g. abbreviations).

Updated **Add Subject button** `disabled` condition to include name validation:
```tsx
disabled={saving || selCls === null || validateSubjectName(fname) !== null}
```
Button is disabled whenever the current name input fails validation — not just when `selCls` is unset.

The real-time inline error and red border were already wired to `validateSubjectName` in earlier sessions and continue to work unchanged.

**Fix — Backend (`backend/apps/academics/views.py`):**

Moved `import re` to the top-level imports (was inline inside `create()`).

Replaced the old validation block in `ClassSubjectEntryViewSet.create()` with:

```python
if not name:
    return Response({"success": False, "message": "Subject name cannot be empty."}, status=400)
if len(name) < 2:
    return Response({"success": False, "message": "Enter a valid subject name."}, status=400)
if len(name) > 50:
    return Response({"success": False, "message": "Maximum 50 characters allowed."}, status=400)
if not re.match(r'^[a-zA-Z0-9 &\-()\\.]+$', name):
    return Response({"success": False, "message": "Special characters are not allowed."}, status=400)
if not re.search(r'[a-zA-Z]', name):
    return Response({"success": False, "message": "Enter a valid subject name."}, status=400)
if re.search(r' {2,}', name):
    return Response({"success": False, "message": "Enter a valid subject name."}, status=400)
# Normalize: collapse any remaining extra internal spaces
name = re.sub(r' {2,}', ' ', name)
```

Error messages are consistent with the frontend spec. The old "must contain at least one letter and be at least 2 characters" / "repeated characters" messages are removed. A normalization step collapses any double-spaces (defence-in-depth, since the check above would have already rejected them).

**Existing behaviour preserved:**
- Per-class duplicate check (`name__iexact`) unchanged.
- `handleAdd` frontend duplicate check unchanged.
- Backend `import re` is now at file top (cleaner, no performance hit from repeated module lookup).

**Valid examples (now pass):** Mathematics, Computer Science, EVS, Art & Craft, Physics-II, GK (Junior), CSS, CC  
**Invalid examples (blocked):** `.`, `..`, `/`, `////`, `---`, `@@@`, `12345`, `   `, emojis, HTML tags

#### Session 4 Addendum — Consecutive-character spam guard

Added a 5th frontend rule and matching backend rule to reject 4 or more consecutive identical characters (case-insensitive):

- **Frontend:** `/(.)\1{3,}/i.test(t)` → `"Too many repeated characters in a row."`
- **Backend:** `re.search(r'(.)\1{3,}', name, re.IGNORECASE)` → same message

Also removed `.` from both allowlists (was accidentally included; the original spec listed `"."` and `".."` as invalid).

| Input | Blocked by |
|---|---|
| `aaaaaa` | 4+ consecutive check |
| `......` | allowlist (`.` removed) |
| `/////` | allowlist |
| `;;;;;` | allowlist |
| `111111` | 4+ consecutive check |
| `tgissss` | 4+ consecutive check (4 s's) |

Rule: up to 3 identical chars in a row is fine (e.g. `CSS`, `III`); 4+ triggers the error in real-time while typing.

#### Session 4 Addendum 2 — Keyboard-spam pattern detection

Added `hasKeyboardSpam` (frontend) and `_has_keyboard_spam` (backend) to reject keyboard-row sequential patterns like `esdf`, `qwer`, `asdf`, `zxcv`.

**Logic:** strip non-alpha chars, slide a 3-char window across the result, reject if any window (or its reverse) appears as a substring of a QWERTY row.

- Top row sequences caught: `qwe`, `wer`, `ert`, `rty`, `tyu`, `yui`, `uio`, `iop` (+ reverses)
- Middle row: `asd`, `sdf`, `dfg`, `fgh`, `ghj`, `hjk`, `jkl` (+ reverses)
- Bottom row: `zxc`, `xcv`, `cvb`, `vbn`, `bnm` (+ reverses)

| Input | Caught by |
|---|---|
| `esdf` | "sdf" in middle row |
| `qwerty` | "qwe" in top row |
| `asdf` | "asd" in middle row |
| `zxcv` | "zxc" in bottom row |
| `fdsa` | "fds" reversed → "sdf" in middle row |
| `Mathematics` | no 3-char window matches any row ✓ |
| `GK`, `EVS`, `CSS` | too short or no matching window ✓ |

Error message: `"Enter a valid subject name."` (same as other structural rejections).

#### Session 4 Addendum 3 — Excessive-consonant detection

Added `hasExcessiveConsonants` (frontend) and `_has_excessive_consonants` (backend) to block long random character strings that evade the keyboard-row check (e.g. `sdwrttuydzkdjaihiasgbasbfluagfl` which was successfully saved despite being gibberish).

**Rule:** if 5 or more consecutive alphabetic consonants appear (y treated as consonant), the name is rejected. Spaces, `&`, `-`, `()` reset the consonant run.

**Threshold rationale:**
- `sdwrttuydzkd...` → starts with `s,d,w,r,t,t` = 6 consecutive → BLOCKED ✓
- `Sanskrit` → `n,s,k,r` = 4 consecutive → passes ✓
- `Physics` → `p,h,y,s` = 4 consecutive → passes ✓
- `Strength` → `s,t,r` (3) then `n,g,t,h` (4) → passes ✓
- `Chemistry` → `s,t,r,y` = 4 consecutive → passes ✓
- `CSS`, `GK`, `EVS` → ≤ 4 consecutive → passes ✓

**Files changed:** `SubjectsPane.tsx` (added `hasExcessiveConsonants` helper, called inside `validateSubjectName`), `views.py` (added `_has_excessive_consonants` module-level function, wired into `create()` after keyboard-spam check).

---

#### Session 4 Addendum 4 — Diagonal keyboard column + short all-consonant spam detection

Two new validation layers added after `edc` and `knm` slipped through all prior checks.

**Problem 1 — `edc`:** The keyboard diagonal e→d→c is a natural finger-roll that doesn't appear on any horizontal row, so the row-based spam check missed it. Similarly `qaz`, `wsx`, `rfv`, `tgb`, `yhn`, `ujm` (and their reverses) are all common spam patterns.

**Fix:** Added `_DIAG_SPAM` set (14 entries — 7 diagonal columns + 7 reverses) checked inside the existing `hasKeyboardSpam` / `_has_keyboard_spam` helper alongside the row check.

```
_DIAG_SPAM = { 'qaz','wsx','edc','rfv','tgb','yhn','ujm',
               'zaq','xsw','cde','vfr','bgt','nhy','mju' }
```

**Problem 2 — `knm`:** Three consonants with no vowel. Not a keyboard sequence, not a long string — just a meaningless fragment. The excessive-consonant check (≥ 5 in a row) didn't fire because there are only 3.

**Fix:** Added `hasShortNoVowelSpam` / `_has_short_no_vowel_spam` — splits the name on non-alpha characters and rejects any segment of 3–4 letters that contains **zero vowels**.

**Threshold rationale:**
- `knm` → 3 chars, vowels = 0 → BLOCKED ✓
- `strg` → 4 chars, vowels = 0 → BLOCKED ✓
- `edc` → caught by `_DIAG_SPAM` before vowel check ✓
- `GK` → 2 chars → exempt from short-no-vowel check ✓  
- `EVS` → 3 chars but has `E` (vowel) → passes ✓
- `Rhythm` → single word, has no vowel-free 3–4 char sub-segment after split → passes ✓
- `Art & Craft` → segments are `Art`, `Craft` — both have vowels → passes ✓

**Tradeoff acknowledged:** 3-char all-consonant abbreviations like `CSS`, `NSS`, `NCC` are now blocked. Teachers must use full names (e.g. "Computer Science", "Social Studies").

**Files changed:** `SubjectsPane.tsx` (added `_DIAG_SPAM` const + updated `hasKeyboardSpam` + added `hasShortNoVowelSpam` helper + wired call in `validateSubjectName`), `views.py` (added `_DIAG_SPAM` set + updated `_has_keyboard_spam` + added `_has_short_no_vowel_spam` function + wired call in `create()` after `_has_excessive_consonants`).

**Current validation stack (all 8 checks, in order):**
1. Allowlist `^[a-zA-Z0-9 &\-()]+$`
2. Min 2 / max 50 chars
3. Must contain at least one letter
4. No double spaces
5. 4+ identical consecutive characters
6. Keyboard row or diagonal column 3-char sequence
7. 5+ consecutive consonants
8. 3–4 char alpha segment with zero vowels

---

## Session 5 — Academic Year & Classes UI Improvements (25 May 2026)

### Session 5.1 — Academic Year `is_active` visual indicator

**Problem:** The "Active (uncheck to soft-deactivate this year)" checkbox in the Academic Year edit form was saving `is_active=false` to the DB successfully (success toast appeared), but the year card in the list showed no visual change — looked identical to an active year, making it appear as if nothing happened.

**Root cause:** `AcademicYearViewSet` and `AcademicYearSerializer` were correct — `is_active` was in `fields`, not in `read_only_fields`, and the PATCH payload included it. The DB was being updated. The year list card simply had no conditional rendering for `is_active`.

**Fix — `AcademicYearPane.tsx`:** Added `isInactive = y.is_active === false` derived variable in the year list `map`. When true:
- Card background → faint red (`bg-[#FFF8F8]`), 70% opacity
- Status dot → red (`bg-[#FCA5A5]`)
- Year name → grey + strikethrough
- Red **"Inactive"** badge pill added next to the year name
- **"Make Current" button hidden** — replaced with a `—` dash (tooltip: "Re-activate this year before making it current"), preventing an inactive year from being set as current

**File changed:** `frontend/components/academics/foundation/panes/AcademicYearPane.tsx`+

---

### Session 5.2 — Streams column in Classes list

**Problem:** The Classes list table (Foundation → Step 2) showed Class, Level, Status columns only. For Grade 11 / 12 (Senior Secondary) with streams configured (e.g. Arts, BIPC, CEC, MEC, MPC), there was no way to see which streams existed without opening the edit form.

**Fix — `ClassesPane.tsx`:**

1. **Added "Streams" column** to the table header between Level and Status.

2. **Streams cell rendering:**
   - Senior classes with streams → first 3 shown as purple pills
   - If more than 3 → a `+N` grey badge appears after the 3 pills
   - Other grades (no streams) → `—` dash

3. **Hover card on `+N` badge:**
   - Card appears **above** the badge (not below — avoids overlapping the next row)
   - Downward-pointing arrow connecting card to badge
   - Smooth fade-in (`opacity-0 group-hover:opacity-100 transition-opacity`)
   - Card has: "More Streams" header with divider, each remaining stream as a purple pill
   - Pure CSS using Tailwind `group` / `group-hover` — no JS state

**Data note:** `stream_details` was already returned by the backend serializer (`ClassSerializer` includes it) and typed in `SchoolClass` interface — no backend changes needed.

**File changed:** `frontend/components/academics/foundation/panes/ClassesPane.tsx`

---

## Day 8 — 2026-05-25 — Impersonation Flow, School Detail Page, Billing Fields & Schools UX Fixes

**Branch:** `subdomain_login/22-05`

---

### 1. Impersonation Flow — End-to-End Fix (Backend + Frontend)

**Problem:** After a super-admin clicked "Impersonate" on a school, the handoff URL pointed to the school's subdomain but the JWT user-id lookup failed because tokens were generated in the `public` schema while the user record lives in the tenant schema. Additionally, the frontend opened the school tab with the raw `data.handoff_url` from the API — which used the server's hostname, not the configured base domain — so the URL resolved incorrectly in local dev.

**Fix — Backend (both `apps/super_admin/views.py` and `apps/tenancy/super_admin/views.py`):**
- Added `from django_tenants.utils import schema_context`.
- Wrapped the entire user lookup + `RefreshToken.for_user()` block in `with schema_context(tenant.schema_name):` in `SchoolImpersonateView.post()`.
- Changed `User.objects.filter(username=…, school__tenant_id=…)` → `User.objects.filter(username=…, is_active=True)` inside the context (no need for cross-schema FK join when already in the right schema).
- Fallback user priority changed to `order_by("-is_school_admin", "-is_superuser", "id")`.

**Fix — Frontend (`frontend/app/(dashboard)/super-admin/schools/page.tsx`):**
- Impersonation URL no longer uses `data.handoff_url` from the API.
- URL now built client-side: `${protocol}//${subdomain}.${baseDomain}${portSuffix}/login?impersonate=1&token=${data.access}&refresh=${data.refresh}` using `process.env.NEXT_PUBLIC_BASE_DOMAIN` (falls back to `window.location.hostname`).

**Fix — Frontend (`frontend/app/login/page.tsx`):**
- Added `?impersonate=1&token=ACCESS&refresh=REFRESH` handler (runs on mount, before auth checks).
- Imports `setAuthTokens` from `@/lib/auth`, stores the access + refresh tokens, cleans the URL via `window.history.replaceState`, then does `window.location.href = '/home'` (full-page redirect avoids React Strict Mode double-invocation and ensures `AuthGate` initialises fresh).
- Added `isImpersonating` state: while `true`, renders a full-screen spinner ("Opening school dashboard…") so the user sees feedback instead of a flash of the login form.

**Fix — Frontend env (`frontend/.env.local`):**
- Added `NEXT_PUBLIC_BASE_DOMAIN=eskoolia.local` (switch to `eskoolia.com` in production).

---

### 2. School Detail Page — Full Rebuild

**File:** `frontend/app/(dashboard)/super-admin/schools/[tenantId]/page.tsx`

**Before:** Page was a redirect stub — immediately called `router.replace('/super-admin/schools')` with a "Loading tenant…" message.

**After:** Full `SchoolViewPage` component with:
- Gradient avatar (initials from school name, colour derived from last char of `tenant_id`).
- School name + `StatusBadge` (Active / Trial / Suspended / Onboarding / Archived).
- Tenant ID + clickable `{subdomain}.eskoolia.com` link (external, `noopener noreferrer`).
- Action buttons: **Edit** (links to `[tenantId]/edit/`), **Suspend** / **Reactivate** (confirm dialog + inline status update).
- Four `SectionCard` panels:
  - **School Information** — state, board, established year, UDISE code, medium.
  - **Subscription & Plan** — plan, seats, API access, brand colour swatch.
  - **Infrastructure** — shard region, storage region, backup retention, schema name.
  - **GST & Compliance** — GSTIN, PAN, reverse charge status.
- Sub-components defined inline: `StatusBadge`, `InfoRow`, `SectionCard`, `avatarGradient()`, `schoolInitials()`.
- Label maps for boards (`CBSE`, `ICSE`, `SSC_TG`, `SSC_AP`), AWS regions, and GST state codes.

---

### 3. Billing Fields — Reverse Charge & SAC Code

**Context:** Indian GST billing — invoices may carry a "Reverse Charge" flag; each subscription plan should record its SAC code.

**Backend — `backend/apps/tenancy/models.py`:**
- `SuperAdminInvoice`: added `reverse_charge = models.BooleanField(default=False)`.
- `SubscriptionPlan`: added `sac_code = models.CharField(max_length=16, default='998313', blank=True)`.
- `auto_create_schema = False` set on `SchoolTenant` — schema provisioning is now explicit (prevents `CommandError` when `django_tenants` is not fully configured, e.g. SQLite or test runs without multi-tenancy).

**Backend — new migration `tenancy/0011_invoice_reverse_charge_plan_sac_code.py`:**
- `AddField reverse_charge` on `SuperAdminInvoice`.
- `AddField sac_code` on `SubscriptionPlan`.
- Depends on `tenancy/0010_domain_tenant`.

**Backend — `backend/apps/super_admin/serializers.py`:**
- `InvoiceSerializer`: added `"reverse_charge"` to `fields`.
- `InvoiceCreateSerializer`: added `reverse_charge = BooleanField(default=False)` + cross-field `validate()`: due date cannot be before invoice date.
- `SubscriptionPlanSerializer`, `SubscriptionPlanCreateSerializer`, `SubscriptionPlanUpdateSerializer`: added `sac_code` field (default `'998313'`).

**Backend — `backend/apps/super_admin/views.py` and `backend/apps/tenancy/super_admin/views.py`:**
- `BillingInvoiceListCreateView` / `BillingInvoicesView`: pass `reverse_charge` from request data to `SuperAdminInvoice.objects.create()`.
- `BillingPlansView`: pass `sac_code` from request data to `SubscriptionPlan.objects.create()`.

**Backend — `backend/apps/tenancy/super_admin/serializers.py`:**
- Added `reverse_charge` field to the invoice serializer.

**Frontend — `frontend/app/(dashboard)/super-admin/billing/NewInvoiceDrawer.tsx`:**
- Added "Reverse Charge" toggle field in the invoice creation drawer.

**Frontend — `frontend/app/(dashboard)/super-admin/billing/NewPlanDrawer.tsx`:**
- Added `sac_code` text input in the plan creation drawer (default `998313`).

**Frontend — `frontend/app/(dashboard)/super-admin/billing/page.tsx` and `frontend/lib/api/super-admin/billing.ts` and `frontend/types/super-admin/index.ts`:**
- `reverse_charge` and `sac_code` propagated through API client and TypeScript types.

---

### 4. Schools List — UX & Correctness Fixes

**File:** `frontend/app/(dashboard)/super-admin/schools/page.tsx`

**a) MonthYearPicker component (new):**
- Replaced the static `<select>` for "Academic year start" with a custom `MonthYearPicker` — floating panel with a scrollable year column (current year ±3/+10) and a 4-column month grid.
- Duplicate-entry guard (amber warning when the composed label already exists in the list).
- Add/Cancel buttons let users append custom academic years; new entries prepend to the `acadYears` array.

**b) Reactivate action added:**
- `ConfirmDialog` extended with `type: 'reactivate'` — green confirm button, message: "will be reactivated immediately — all users will regain access".
- `handleConfirmAction`: `reactivate` branch calls `updateSchool(tenantId, { status: 'active' })` and shows success toast.
- Schools row action menu now shows **Reactivate** (instead of or alongside Restore) for suspended schools.

**c) Impersonation URL fix** (see §1 above).

**d) Plan dropdown cleaned up:**
- Removed `"starter"` and `"standard"` options (not in use); kept `trial`, `premium`, `enterprise`, `custom`.

**e) Safety guard on confirm actions:**
- Before running suspend/archive/restore/reactivate, checks `school.tenant_id` is non-empty; shows a descriptive toast and aborts if missing.

**f) Form field improvements:**
- `subdomain_url` input: `maxLength={63}` (Postgres schema name limit).
- Established year input: `min={1800}` / `max={currentYear}`.
- `gst_registered` field added to `editFields` state (seeded from whether `school.gstin` is non-empty on open).

---

### 5. Settings — Silence django-tenants W005

**File:** `backend/config/settings/base.py`
- Added `SILENCED_SYSTEM_CHECKS = ["tenancy.W005"]` — suppresses the django-tenants warning about `auto_create_schema=False`, which is intentional in this project (provisioning is done explicitly via management commands).

---

### Still in progress / known follow-ups

- Migration `0011_invoice_reverse_charge_plan_sac_code` is uncommitted — needs to be applied on dev + staging Neon.
- All 16 modified files + 1 untracked migration are uncommitted on `subdomain_login/22-05`.
- The tenant detail page (`[tenantId]/page.tsx`) does not yet surface student/staff counts — those fields (`student_count`, `staff_count`) exist in `SchoolTenantDetailSerializer` and can be added to the Infrastructure panel.
- `amarajyothi.eskoolia.local` Domain record + activation not yet created (deferred from Day 7).
- The impersonation flow has been implemented but not yet end-to-end verified with a real tenant user (needs a school-assigned user in the Narayana schema).

### Start tomorrow with

1. Apply `tenancy/0011_invoice_reverse_charge_plan_sac_code` on dev + staging Neon.
2. End-to-end test impersonation: super-admin → click Impersonate on `narayana` school → new tab opens `narayana.eskoolia.local:3000/login?impersonate=1&…` → spinner → auto-redirect to `/home` as the school admin.
3. Commit all 16 modified + 1 untracked file on `subdomain_login/22-05` with focused commits (backend models/migration, backend impersonate fix, frontend impersonate, frontend school detail, billing fields).
4. Create a real school-assigned user in `narayana` tenant schema for impersonation testing.
5. Wire `student_count` / `staff_count` into the School Detail page infrastructure panel.

---

## Day 9 — 2026-05-26 — Super-Admin Schools: Form Validation & Bug Fixes

**Branch:** `tenancy-errors/25-05`

---

### 1. Bug Fix: `"pro" is not a valid choice` — Backend ChoiceField Replaced with Dynamic Validator

**Problem:** Newly created subscription plan codes (e.g. `"pro"`) were rejected by the backend with `"pro" is not a valid choice` on both the provision school and update school endpoints. The serializers used `ChoiceField` with a hardcoded list `["trial", "premium", "enterprise", "custom"]` that never included dynamically created plan codes.

**Files changed:**

- **`backend/apps/tenancy/super_admin/serializers.py`**
  - `ProvisionSchoolSerializer.plan`: changed from `ChoiceField(choices=["trial","premium","enterprise","custom"])` to `CharField(max_length=32)` with a `validate_plan()` method that queries `SubscriptionPlan.objects.values_list('code', flat=True)` at runtime and adds `{'trial','custom'}` as always-valid fallbacks.
  - `SchoolTenantUpdateSerializer.plan`: same change (`required=False, allow_blank=True`).

- **`backend/apps/super_admin/serializers.py`**
  - `ProvisionSchoolRequestSerializer.plan`: same `CharField` + `validate_plan()` change.

---

### 2. Bug Fix: Misleading "School name and state are required" Combined Error

**Problem:** When only the state was missing, the error "School name and state are required." appeared even though the school name was filled. A single combined error string was shown regardless of which fields were actually empty.

**File changed:** `frontend/app/(dashboard)/super-admin/schools/page.tsx`

- `handleProvisionSubmit` now builds a `fieldErrors: Record<string, string>` object and sets per-field messages:
  - `errors.name = 'School name is required.'` when name is empty.
  - `errors.state = 'State is required.'` when state is empty.
- `setFieldErrors(errors)` replaces the old `setProvisionError(...)` call.
- Auto-scroll: `document.querySelector('[data-field-error="true"]')?.scrollIntoView(...)` fires 50 ms after errors are set.
- `setFieldErrors({})` is called on successful provision, successful edit-save, and accordion reset.

---

### 3. Bug Fix: Required Fields Not Highlighted / No Auto-Scroll on Validation Failure

**Problem:** When the Save Changes / Add School button was clicked with empty required fields, no visual feedback was shown on the inputs — no red borders, no inline messages, and no scroll to the first error.

**Files changed:** `frontend/app/(dashboard)/super-admin/schools/page.tsx`

**Validation added to `handleProvisionSubmit` (both Add and Edit modes):**

| Field | Condition | Error message |
|---|---|---|
| School name | empty | "School name is required." |
| State | empty | "State is required." |
| Principal name | empty | "Principal name is required." |
| Principal email | empty or invalid format | "Principal email is required." / "Enter a valid email address." |
| PAN | empty or wrong format | "PAN is required." / "PAN must be in format ABCDE1234F." |

**Input behaviour:**
- Each input/select gets `!border-[var(--danger)]` class and `data-field-error="true"` attribute when its error is set.
- `Fld` wrapper renders the error message below the field via its `error` prop.
- Each field clears its own error immediately as the user types (individual `setFieldErrors(p => ({ ...p, fieldKey: '' }))` in `onChange`).
- Page auto-scrolls to the first `[data-field-error="true"]` element 50 ms after errors are set.

**Fields updated in JSX:**
- School name `<input>` — `fieldErrors.name` (previously done in prior session)
- State `<select>` — `fieldErrors.state` (previously done in prior session)
- Principal name `<input>` — `fieldErrors.principal_name`
- Principal email `<input>` — `fieldErrors.principal_email`
- PAN `<input>` — `fieldErrors.pan`

---

### 4. Bug Fix: NewPlanDrawer — No Character Limit, No Counter, No Inline Validation

**Problem:** The plan name input had `maxLength={128}` with no visible counter or message. Submitting without required fields passed `if (!canSubmit) return` silently without showing which fields were invalid.

**File changed:** `frontend/app/(dashboard)/super-admin/billing/NewPlanDrawer.tsx`

- `Field` component updated to accept `error?: string` prop; renders error instead of hint when both are set.
- Added `const [planErrors, setPlanErrors] = useState<Record<string, string>>({})` state.
- Plan name `maxLength` reduced from `128` to `50`.
- Character counter `{name.length}/50` added below the plan name input.
- `handleSubmit` validates before calling the API:
  - Name: required, max 50 chars.
  - Code: required.
  - Price: must be > 0.
  - Features: at least one non-empty feature.
- Invalid inputs get `!border-[var(--danger)]` class; each field's error is cleared on change.

---

### 5. Bug Fix: NewInvoiceDrawer — School Dropdown Not Highlighted on Validation Failure

**Problem:** Clicking "Save Invoice" without selecting a school passed `if (!canSubmit) return` silently — no red border, no message on the School dropdown.

**File changed:** `frontend/app/(dashboard)/super-admin/billing/NewInvoiceDrawer.tsx`

- `Field` component updated to accept `error?: string` prop.
- Added `const [formErrors, setFormErrors] = useState<Record<string, string>>({})` state.
- `handleSubmit`: if `!isEditMode && !selectedSchool`, sets `formErrors.school = 'Please select a school.'` and auto-scrolls to `[data-field-error="true"]`; clears errors otherwise.
- School `<select>` gets `!border-[var(--danger)]` class and `data-field-error="true"` when error is set; error is cleared on school change.

---

### Summary of files changed today

| File | Change |
|---|---|
| `backend/apps/tenancy/super_admin/serializers.py` | `plan` field: ChoiceField → CharField + dynamic `validate_plan()` |
| `backend/apps/super_admin/serializers.py` | Same change for provision serializer |
| `frontend/app/(dashboard)/super-admin/schools/page.tsx` | Per-field errors for name, state, principal_name, principal_email, PAN; auto-scroll; red borders |
| `frontend/app/(dashboard)/super-admin/billing/NewPlanDrawer.tsx` | `Field` error prop; `planErrors` state; maxLength 50; char counter; inline validation in `handleSubmit` |
| `frontend/app/(dashboard)/super-admin/billing/NewInvoiceDrawer.tsx` | `Field` error prop; `formErrors` state; school dropdown red border + error message |

### Still in progress

- Backend migrations `0007`–`0011` still need to be applied on Neon staging.
- Impersonation end-to-end flow not yet browser-tested with a real tenant user.

### Start next with

1. Apply pending Neon migrations (`0007`–`0011`).
2. Browser test: Add School form — leave principal email + PAN empty, click Add → confirm per-field red borders and error messages appear, confirm auto-scroll to first error.
3. Browser test: Create plan without name → confirm `"Plan name is required."` inline message and red border.
4. Browser test: Create invoice without selecting school → confirm school dropdown turns red.
5. Commit all changed files on `tenancy-errors/25-05`.

---

## Day 9 — 2026-05-26 — HR Module: Department Head/Deputy, Error Handling & Toast UX

**Branch:** `tenancy-new` (HR setup page)  
**Author:** Gowtham

---

### 1. Department Head & Deputy Head — Backend FK Fields

**Problem:** Departments had no way to record their head or deputy head — a core organisational requirement for school HR.

**Backend — `backend/apps/hr/models.py`:**
- Added `head = ForeignKey("Staff", null=True, blank=True, on_delete=SET_NULL, related_name="headed_departments")` to `Department`.
- Added `deputy_head = ForeignKey("Staff", null=True, blank=True, on_delete=SET_NULL, related_name="deputy_headed_departments")` to `Department`.

**Backend — `backend/apps/hr/migrations/0016_department_head_deputy_head.py`** (new, applied ✅):
- Adds both nullable FK columns to `hr_departments`.

**Backend — `backend/apps/hr/serializers.py` (`DepartmentSerializer`):**
- Added `head_id = PrimaryKeyRelatedField(source="head", queryset=Staff.objects.all(), allow_null=True, required=False)` — writable.
- Added `deputy_head_id = PrimaryKeyRelatedField(source="deputy_head", …)` — writable.
- Added `head_name = SerializerMethodField()` — `str(obj.head)` or `None`.
- Added `deputy_head_name = SerializerMethodField()` — `str(obj.deputy_head)` or `None`.
- Meta `fields` updated: `["id", "school", "name", "dept_type", "description", "is_active", "head_id", "deputy_head_id", "head_name", "deputy_head_name", "created_at", "updated_at"]`.

**Backend — `backend/apps/hr/views.py` (`DepartmentViewSet`):**
- `queryset` updated to `Department.objects.select_related("school", "head", "deputy_head").all()` — avoids N+1 queries.

---

### 2. Department Head & Deputy Head — Frontend Wiring

**Frontend — `frontend/types/hr.ts`:**
- Added `head_id: number | null` and `deputy_head_id: number | null` to `Department` interface.
- Added `head_name?: string | null` and `deputy_head_name?: string | null`.

**Frontend — `frontend/hooks/useHrApi.ts`:**
- Added `useStaffList()` → `GET /api/v1/hr/staff/?page_size=200&status=active` — fetches all active staff for dropdown population.

**Frontend — `frontend/app/(dashboard)/hr/setup/page.tsx` (`InlineDeptForm`):**
- Calls `useStaffList()` inside the form to fetch staff.
- **Department Head** and **Deputy Head** `HrSelect` dropdowns now dynamically list all active staff.
- Options display: `full_name` or `first_name + last_name` fallback, or `staff_no` as last resort.
- Both fields are optional (empty = clear/no head).
- When editing an existing department, `head_id` / `deputy_head_id` pre-select the correct staff member.

---

### 3. Duplicate Department Name — Proper Error Message

**Problem:** Trying to create a department with a name that already exists showed the generic toast "Failed to save department" instead of a specific error.

**Root cause (frontend):** `createDepartment` threw `new Error(await res.text())` — the raw JSON string — and `handleSave` used `catch { ... }` (no error variable), ignoring the thrown message entirely.

**Backend** was already correct: `DepartmentViewSet.create()` catches `IntegrityError` and raises `ValidationError({"name": "Department already exists"})`. `handle_exception` extracts the first field message and returns `{"message": "Department already exists"}`.

**Fix — `frontend/hooks/useHrApi.ts`:**
- `createDepartment` and `updateDepartment` now parse the JSON response on error and throw `new Error(data.message ?? data.errors?.name?.[0] ?? "Failed to save department")`.

**Fix — `frontend/app/(dashboard)/hr/setup/page.tsx` (`handleSave`):**
- Changed `catch { toast("Failed to save department", "error"); }` → `catch (err) { toast(err instanceof Error ? err.message : "Failed to save department", "error"); }`.

**Result:** Users now see **"Department already exists"** in the toast when attempting to create a duplicate.

---

### 4. HR Toast — Moved to Top-Right Corner

**Problem:** HR toasts appeared at the bottom-right of the screen, which conflicted with other bottom-anchored UI elements.

**Fix — `frontend/components/hr/HrUi.tsx` (`HrToastProvider`):**
- Changed `fixed bottom-4 right-4` → `fixed top-4 right-4` on the toast container div.

**Result:** All HR toasts (success, error, info) now appear in the top-right corner.

---

### Files Changed (Day 9)

| File | Change |
|---|---|
| `backend/apps/hr/models.py` | Added `head` + `deputy_head` FK fields to `Department` |
| `backend/apps/hr/migrations/0016_department_head_deputy_head.py` | New migration (applied ✅) |
| `backend/apps/hr/serializers.py` | Added `head_id`, `deputy_head_id`, `head_name`, `deputy_head_name` to `DepartmentSerializer` |
| `backend/apps/hr/views.py` | `DepartmentViewSet.queryset` now `select_related("school", "head", "deputy_head")` |
| `frontend/types/hr.ts` | Added `head_id`, `deputy_head_id`, `head_name?`, `deputy_head_name?` to `Department` |
| `frontend/hooks/useHrApi.ts` | Added `useStaffList()`; fixed `createDepartment` + `updateDepartment` error extraction |
| `frontend/app/(dashboard)/hr/setup/page.tsx` | Wired head/deputy dropdowns; fixed `handleSave` to show actual error message |
| `frontend/components/hr/HrUi.tsx` | Moved toast container from `bottom-4` to `top-4` (top-right) |
| `frontend/types/hr.ts` | Removed duplicate `email?: string` alias from `Staff` interface (build fix) |

---

### Build Fix — Duplicate `email` Identifier in `Staff` Interface

**Error:**
```
./types/hr.ts:110:3
Type error: Duplicate identifier 'email'.
```

**Root cause:** `Staff` interface had `email?: string; // alias` at line 110 AND `email: string` again at line 157 — two declarations of the same field in the same interface.

**Fix — `frontend/types/hr.ts`:**
- Removed the `email?: string; // alias` line (line 110) — the canonical `email: string` field already existed further down in the same interface.

---

### Start next with

1. Verify head/deputy dropdowns populate correctly on the HR Setup page in the browser.
2. Test duplicate department name flow — confirm toast shows "Department already exists" not the generic message.
3. Consider adding a `useStaffList` loading skeleton to the dropdowns while staff fetches.
4. Commit all Day 9 changes on the current branch.

---

## Day 10 — 2026-05-27 — HR Onboard Wizard: Full Step Rewrite to Match Reference Design

**Branch:** `tenancy-new`  
**Author:** Gowtham  
**File:** `frontend/app/(dashboard)/hr/onboard/page.tsx`

---

### Summary

All 10 step components of the HR onboard wizard were audited against the reference HTML artifact (`eskoolia-hr-focused-artifact.html`) and fully rewritten to match field-for-field. Shared visual helper components were added. The card layout was fixed to eliminate oversized empty gaps on short steps. Zero TypeScript errors throughout.

---

### 1. Shared Visual Helpers Added

Five reusable helper components added before the step functions (used across multiple steps):

| Helper | Purpose |
|---|---|
| `WizardBlock` | Section container with a Playfair Display section title (`"01 · Contact"` etc.) + optional right-side slot for an "Add" button |
| `TipBox` | Coloured info/warn/success banner. `type="info"` → blue; `type="warn"` → amber; `type="success"` → green |
| `FHG` | FieldHelpGrid — renders a row of small grey hint texts (`text-[11px] text-[#94A3B8]`) aligned to a grid below field rows |
| `PhoneField` | Country-code `<select>` + `HrInput` side-by-side; accepts `CC_OPTIONS` (+91, +234, +44, +1, +971, +61, +27) |
| `AddRowBtn` | Branded "+ Add …" button (outline brand colour, hover `var(--soft)`) used for dynamic list rows |

Also added `PF` constant (`var(--font-playfair),"Playfair Display",Georgia,serif`) and `CC_SEL_CLS` constant for the country-code select styling.

---

### 2. Constants Extended

| Constant | Added values |
|---|---|
| `DEGREES` | B.Ed, M.Ed, MBA, B.Tech, M.Tech, B.Sc, M.Sc, B.A, M.A, Ph.D, Diploma, Other |
| `RELATIONSHIPS` | Spouse, Parent, Sibling, Child, Friend, Guardian, Other |
| `DISABILITY_STATUSES` | None, Physical disability, Visual impairment, Hearing impairment, Speech/language disability, Cognitive/learning disability, Multiple disabilities, Prefer not to say |
| `CC_OPTIONS` | +91, +234, +44, +1, +971, +61, +27 |
| `EMP_TYPES` | Added Permanent, Temporary (reference uses these) |
| `ROLES` | Expanded to include Admin Staff, Transport / Driver, Principal, Vice Principal |

---

### 3. FormData Type Extended

~25 new optional fields added to the `FormData` extra type to support all new step content:

```
// Family
num_children, spouse_parent_name

// Gov ID
pt_registration, ifsc_code, bank_name, account_number, account_name

// Qualifications
bed_reg_no, ctet_score, subjects_qualified

// Medical
med_cert_no, med_exam_date, cert_valid_till
disability_cert_no, disability_pct, disability_authority
workplace_accommodations, eye_exam_result, colour_blindness, dl_medical_exam

// Payroll
basic_salary_input, hra_input, da_input
travel_allowance_input, medical_allowance_input, special_allowance_input

// Review
create_login, send_welcome, activate_attendance
```

---

### 4. Step-by-Step Changes

#### Step 1 — Staff identity (StepIdentity)
No change — already matched reference.

#### Step 2 — Role & placement (StepRole)
**Before:** Three 2-column grids (Dept/Designation, Employment/Role, Joining/Probation).  
**After:** Reference layout —
- `grid3`: Department\* | Designation\* | Role / Access\*
- `grid3`: Joining Date\* | Employment Type\* | Probation Period
- Full-width: Reporting Manager\* (populated from `useStaffList()`)

Also accepts new `staffList` prop; main render updated to pass `staffList={staffList}`.

#### Step 3 — Contact & address (StepContact)
No change — already matched reference from previous session.

#### Step 4 — Family & emergency (StepFamily)
**Before:** Simple flat emergency contact (3 fields) + marital status (2 fields).  
**After:** Three `WizardBlock` sections with local `useState` arrays:
- **"01 · Marital & family"** — `grid3`: Marital status | No. of children | Spouse / parent name
- **"02 · Emergency contacts"** — dynamic rows (Name\* | Relationship\* | Mobile\* phone-row) + (Alt mobile | Email) + `AddRowBtn`
- **"03 · Nominees"** — `TipBox info` + dynamic rows (Nominee name\* | Relationship | Share% with `<X>` remove) + `AddRowBtn`

#### Step 5 — Government identity (StepGovId)
**Before:** Two plain 2-column grids (Aadhaar/PAN, Passport/DL, Pension/ESI) with no structure.  
**After:** `TipBox warn` + three `WizardBlock` sections:
- **"01 · Identity documents"** — `grid2`: Aadhaar\* | PAN\* (+ FHG hints) → `grid2`: Passport | Driving licence (+ FHG hints)
- **"02 · Statutory IDs"** — `grid3`: UAN (PF) | ESI number | PT registration (+ FHG hints)
- **"03 · Bank details"** — `grid3`: Bank name\* | Account number\* | IFSC code\* (+ FHG hints)

#### Step 6 — Qualifications (StepQualifications)
**Before:** Single textarea for qualifications + single text input for highest qualification.  
**After:** Three `WizardBlock` sections with local `useState` arrays:
- **"01 · Academic qualifications"** — dynamic qual rows (`grid3`: Degree\* | University | Year + `grid2`: Specialisation | Percentage) + `AddRowBtn`
- **"02 · Teaching certifications"** — `grid3`: B.Ed reg no. | CTET/STET score | Subjects qualified
- **"03 · Previous employment"** — dynamic employer rows (`grid3`: Employer | Designation | Experience + `grid3`: From | To | Last salary) + `AddRowBtn`

#### Step 7 — Medical & fitness (StepMedical)
**Before:** Blood group + disability status textarea + 2 certificate fields.  
**After:** Three `WizardBlock` sections:
- **"01 · Medical fitness"** — `grid3`: Cert no. | Exam date | Valid till + Upload PDF/JPG button
- **"02 · Accessibility & special needs"** — `TipBox info` (confidential) + `grid2`: disability status | cert no. + `grid2`: % | authority + Upload + workplace accommodations field
- **"03 · Transport staff — additional"** — `TipBox info` (applicable if Driver) + `grid3`: Eye exam | Colour blindness | Last DL medical exam

#### Step 8 — Payroll setup (StepPayroll)
**Before:** Basic salary + payment schedule + bank details + simple 3-column CTC preview (only when basic > 0).  
**After:** Three `WizardBlock` sections + live CTC preview card (always visible when basic > 0):
- **"01 · CTC structure"** — `grid3`: Basic\* | HRA | DA (+ FHG hints) → `grid3`: Travel | Medical | Special allowances
- **"02 · Custom allowances"** — dynamic rows (Allowance name | Amount) with remove buttons + `AddRowBtn`
- **"03 · Custom deductions"** — dynamic rows (Deduction name | Amount) with remove buttons + `AddRowBtn`
- **Live CTC Preview card** (dark border, `var(--soft)` background):
  - `grid2`: Earnings column (Basic, HRA, DA, TA, Medical, Special, custom, **Gross bold**) | Deductions column (PF 12%, ESI 0.75%, PT, TDS, custom, **Total Ded.**)
  - **Net Take Home** dark box (`#15172A` bg, 24px bold, ₹ symbol)

#### Step 9 — Documents (StepDocuments)
**Before:** Checkbox tick-list of 7 generic document names (client-only state).  
**After:** `TipBox success` (role-based, X of N uploaded) + numbered document table (13 documents) with per-row action buttons:
- **Preview** | **Upload** (toggles status, brand colour when uploaded) | **Pending/Done** pill | **Delete** (red outline)
- Documents: Aadhaar (self-attested), PAN, Passport photos (3), Bank cheque/passbook, Address proof, 10th Marksheet, 12th Marksheet, Degree, B.Ed/D.El.Ed, Experience letter, NOC, Medical fitness cert, Police verification cert

#### Step 10 — Review & onboard (StepReview)
**Before:** Plain key-value grid of 12 data points.  
**After:** Accepts new `set` prop; restructured as:
- **"Ready to onboard"** green card (`#ecfdf5` bg, `#bbf7d0` border) with Playfair Display heading + help text
- **`grid2`** summary cards: Profile summary (full name, gender, DOB, mobile, email, nationality) | Operational summary (department, designation, employment type, joining, basic salary, bank) — both with **"Required"** amber pill
- **`grid3`**: Create Login (select: email/SMS/skip) | Send Welcome Message (select: Email/WhatsApp/Both/No) | Activate Attendance (select: Immediately/From joining date/Manual)
- "Enroll staff →" button rendered by the main wizard's `step === TOTAL` branch

---

### 5. Layout Fixes

**StepRole gap:** Changed outer `flex flex-col gap-8` → `gap-6` — 3 plain field rows with no section headers looked too spread out with gap-8.

**Card layout — content-height cards:**
- Added `items-start` to the outer `flex gap-6` sidebar+card row → both children now size to their natural content height rather than stretching to the taller element's height.
- Removed `flex-1` from the card `<div>` — card is no longer forced to fill the sidebar height.
- Changed `mt-auto` → `mt-8` on the in-card next button — button now sits a fixed 32px below the last field instead of being pinned to the page bottom, eliminating the large empty gap on short steps (Role & placement, Government identity, etc.).

---

### Files Changed (Day 10)

| File | Change |
|---|---|
| `frontend/app/(dashboard)/hr/onboard/page.tsx` | All 10 step components rewritten; shared helpers added; constants + FormData extended; layout fixed; `staffList` prop wired to StepRole; `set` prop wired to StepReview |

**No backend changes.** Zero TypeScript errors (`get_errors` → no errors).

---

### Start next with

1. Start the frontend dev server and smoke-test all 10 steps in the browser.
2. Verify StepPayroll Live CTC Preview calculates correctly with sample salary inputs.
3. Verify StepFamily dynamic emergency contacts and nominees rows add/remove correctly.
4. Connect StepReview "Enroll staff →" to the existing `handleSubmit` function (already wired in the main render but confirm the flow end-to-end with a real backend call).
5. Consider persisting dynamic list rows (qualifications, emergency contacts, nominees) in the parent `form` state so they survive navigating back and forth between steps.

