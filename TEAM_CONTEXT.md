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

## How to Run (Dev)

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

