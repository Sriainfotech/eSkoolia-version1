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
Author: `sridevi-sriagithub` ┬╖ Message: `18/05/26` (consolidated WIP commit). Most recent commit on the branch; specifics are folded into the uncommitted work captured in the Day 4 update below.

### Day 5 ΓÇö 2026-05-20 (today) ΓÇö Billing, Schools edit/audit, environment fixes
See the **"Day 4 Update ΓÇö Sridevi"** section below for full details (16 modified + 6 untracked files; new tenancy migrations 0007 + 0008; super-admin billing UI overhaul; environment fixes for migrations and Python 3.10 vs 3.14).

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
