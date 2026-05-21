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
