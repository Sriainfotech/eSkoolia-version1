# TEAM_CONTEXT — School Tenancy Module

Branch: `tenancy` • Module: Super Admin → Schools / Billing / Tenancy

---

## Timeline — School Tenancy Module (Day 1 → Now)

> Source: in-repo phase docs + `git log` on `tenancy` branch + uncommitted working tree on 2026-05-20.

### Day 1 — 2026-05-13 — Phase 8: Staging-only Tenant Provisioning
**Files added / changed:**
- [backend/apps/tenancy/api.py](backend/apps/tenancy/api.py) — `POST /api/v1/tenancy/super-admin/schools/provision/`
- [backend/apps/tenancy/provisioning.py](backend/apps/tenancy/provisioning.py) — `create_postgres_schema`, `run_tenant_migrations`, `seed_tenant_defaults`, `create_tenant_domain`
- `ProvisionTenantSerializer`, `TenantDetailSerializer`
- `MULTI_TENANCY_ENABLED=False` flag wired (production-safe default)

**Delivered:** super-admin can provision a real Postgres tenant schema in staging; subdomain sanitization; rollback on failure; default seeds (AcademicYear, Roles, Departments).
**Reference:** [PHASE_8_COMPLETION_SUMMARY.md](PHASE_8_COMPLETION_SUMMARY.md)

### Day 1 — 2026-05-13 — Phase 9: Tenant-Aware Auth & Request Schema Switching
**Files added / changed:**
- [backend/apps/tenancy/middleware.py](backend/apps/tenancy/middleware.py) — `TenantMainMiddleware` (X-Tenant header / Host subdomain / X-School-Id resolution, sets PG `search_path`)
- [backend/apps/tenancy/auth.py](backend/apps/tenancy/auth.py) — `TenantAwareJWTAuthentication`
- Super-admin vs tenant-user separation enforced; monolithic fallback preserved when flag off.

**Reference:** [PHASE_9_COMPLETION_SUMMARY.md](PHASE_9_COMPLETION_SUMMARY.md), [PHASE_9_QUICK_REFERENCE.md](PHASE_9_QUICK_REFERENCE.md)

### Day 1 — 2026-05-13 — Phase 10: Feature Flags, Permissions, Rate Limits
**Files added / changed (~2,000 LOC):**
- [backend/apps/tenancy/models.py](backend/apps/tenancy/models.py) — `TenantPlan`, `TenantFeature`, `TenantFeatureFlag`, `TenantFeatureAudit`
- `feature_flags.py` (`is_feature_enabled`, schema-aware caching)
- `permissions.py` — `TenantActive`, `TenantFeatureEnabled`, `TenantAPIAccessEnabled`, `TenantNotSuspended`, `IsSuperAdminOnly`, `TenantUserOnly`, `TenantDataIsolation`, `CompositePermission`
- `rate_limiting.py` — `TenantAwareThrottle`, `TenantPlanBasedThrottle` (Trial / Premium / Enterprise)
- `helpers.py` — `tenant_has_feature`, `tenant_api_allowed`, `tenant_context`, `can_upgrade_plan`

**Reference:** [PHASE_10_IMPLEMENTATION_COMPLETE.md](PHASE_10_IMPLEMENTATION_COMPLETE.md), [PHASE_10_SETUP_GUIDE.md](PHASE_10_SETUP_GUIDE.md), [PHASE_10_QUICK_REFERENCE.md](PHASE_10_QUICK_REFERENCE.md)

### Day 1 — 2026-05-13 — Phase 11: School Data Migration & Validation
**Files added / changed (~1,600 LOC):**
- `TenantMigrationAudit` model (public schema, immutable)
- `migration_framework.py` — per-school copy engine, dry-run, checkpoints, rollback
- `validation_automation.py` — dual-read validation (monolithic vs tenant), FK / duplicate checks
- `observability.py`, `test_fixtures.py`, `test_integration_migrations.py`
- Management commands: `migrate_school_to_tenant`, `validate_tenant_migration`, `rollback_tenant_migration`, `validate_tenant_isolation`, `validate_hybrid_runtime`, `validate_rollback_flow`, `run_migration_integration_tests`

**Reference:** [PHASE_11_IMPLEMENTATION_COMPLETE.md](PHASE_11_IMPLEMENTATION_COMPLETE.md), [PHASE_11_MIGRATION_GUIDE.md](PHASE_11_MIGRATION_GUIDE.md), [PHASE_11_QUICK_REFERENCE.md](PHASE_11_QUICK_REFERENCE.md)

### Day 2 — 2026-05-14 — Phase 13 Sprint 0: Super-Admin Console UI Skeleton
**Files added:**
- [frontend/app/(super-admin)/layout.tsx](frontend/app/(super-admin)/layout.tsx) — role-based access guard (super_admin only)
- `frontend/app/(super-admin)/super-admin/{dashboard,schools,billing,audit,policies}/page.tsx` — route shells
- [frontend/components/super-admin/Sidebar.tsx](frontend/components/super-admin/Sidebar.tsx) — collapsible sidebar, mobile hamburger
- [frontend/types/super-admin/index.ts](frontend/types/super-admin/index.ts) — ~400 lines of TS contracts (School, Dashboard, Invoice, Mrr, Audit, Policy, Filters)
- `frontend/lib/api/super-admin/{dashboard,schools,billing,audit,policies,index}.ts` — 17 API client functions

**Reference:** [PHASE_13_SPRINT_0_REPORT.md](PHASE_13_SPRINT_0_REPORT.md), [PHASE_13_IMPLEMENTATION_ROADMAP.md](PHASE_13_IMPLEMENTATION_ROADMAP.md)

### Day 3 — 2026-05-16 — Sprint 1: Super-Admin Console Backend APIs
**Files added / changed:**
- New app: `backend/apps/super_admin/` (`apps.py`, `serializers.py` — 10 serializers, `views.py` — 8 ViewSets, `urls.py`)
- [backend/apps/access_control/permission_classes.py](backend/apps/access_control/permission_classes.py) — `IsSuperAdmin` (strict: `is_superuser=True` AND no `school` FK)
- [backend/config/settings/base.py](backend/config/settings/base.py) — registered `super_admin` in INSTALLED_APPS
- [backend/config/urls.py](backend/config/urls.py) — mounted `/api/super-admin/` + `/api/v1/super-admin/`

**Endpoints delivered:** dashboard KPIs, school-tenants list/detail/provision/activate/deactivate, audit-logs list+search, billing metrics, policies list/settings/update, analytics usage+growth, system-health status+alerts.
**Reference:** [PHASE_1_SUPER_ADMIN_API_IMPLEMENTATION.md](PHASE_1_SUPER_ADMIN_API_IMPLEMENTATION.md), [SPRINT_1_QUICK_REFERENCE.md](SPRINT_1_QUICK_REFERENCE.md), [SPRINT_1_VALIDATION_REPORT.md](SPRINT_1_VALIDATION_REPORT.md), [VERIFICATION_REPORT_SPRINT1.md](VERIFICATION_REPORT_SPRINT1.md)

### Day 4 — 2026-05-18 — Last committed work on `tenancy` (commit `ed554a2`)
Author: `sridevi-sriagithub` · Message: `18/05/26` (consolidated WIP commit). Most recent commit on the branch; specifics are folded into the uncommitted work captured in the Day 4 update below.

### Day 5 — 2026-05-20 (today) — Billing, Schools edit/audit, environment fixes
See the **"Day 4 Update — Sridevi"** section below for full details (16 modified + 6 untracked files; new tenancy migrations 0007 + 0008; super-admin billing UI overhaul; environment fixes for migrations and Python 3.10 vs 3.14).

---

## Day 5 Update — Sridevi (2026-05-20)
**Files changed:**
- Backend
  - [backend/apps/access_control/permission_classes.py](backend/apps/access_control/permission_classes.py) — super-admin permission tweaks
  - [backend/apps/super_admin/serializers.py](backend/apps/super_admin/serializers.py) — `InvoiceCreateSerializer`, school/plan serializers extended
  - [backend/apps/super_admin/urls.py](backend/apps/super_admin/urls.py) — new billing + plan routes
  - [backend/apps/super_admin/views.py](backend/apps/super_admin/views.py) — `BillingInvoiceListCreateView`, `BillingMRRView`, `BillingPlansView`, `BillingGSTR1ExportView`
  - [backend/apps/tenancy/models.py](backend/apps/tenancy/models.py) — `SuperAdminInvoice`, `SubscriptionPlan`, branding fields on tenant
  - [backend/apps/tenancy/super_admin/serializers.py](backend/apps/tenancy/super_admin/serializers.py) — `InvoiceSerializer` updates
  - [backend/apps/tenancy/super_admin/urls.py](backend/apps/tenancy/super_admin/urls.py) — invoice mark-paid / reminder endpoints
  - [backend/apps/tenancy/super_admin/views.py](backend/apps/tenancy/super_admin/views.py) — `InvoiceMarkPaidView`, `InvoiceSendReminderView`, audit logging
  - [backend/apps/tenancy/migrations/0007_add_branding_fields.py](backend/apps/tenancy/migrations/0007_add_branding_fields.py) — new migration
  - [backend/apps/tenancy/migrations/0008_add_subscription_plan.py](backend/apps/tenancy/migrations/0008_add_subscription_plan.py) — new migration
  - [backend/fix_test_superuser.py](backend/fix_test_superuser.py) — test user repair script
- Frontend
  - [frontend/app/(dashboard)/super-admin/schools/page.tsx](frontend/app/(dashboard)/super-admin/schools/page.tsx) — schools list rewrite (filters, search, status, audit/edit links)
  - [frontend/app/(dashboard)/super-admin/schools/[tenantId]/edit/](frontend/app/(dashboard)/super-admin/schools/) — new school edit page
  - [frontend/app/(dashboard)/super-admin/schools/[tenantId]/audit/](frontend/app/(dashboard)/super-admin/schools/) — new tenant audit log page
  - [frontend/app/(dashboard)/super-admin/billing/page.tsx](frontend/app/(dashboard)/super-admin/billing/page.tsx) — billing dashboard overhaul (MRR, GSTR-1 export, plans)
  - [frontend/app/(dashboard)/super-admin/billing/NewInvoiceDrawer.tsx](frontend/app/(dashboard)/super-admin/billing/) — new invoice creation drawer
  - [frontend/app/(dashboard)/super-admin/billing/NewPlanDrawer.tsx](frontend/app/(dashboard)/super-admin/billing/) — new plan creation drawer
  - [frontend/app/(dashboard)/super-admin/dashboard/page.tsx](frontend/app/(dashboard)/super-admin/dashboard/page.tsx) — metrics tweaks
  - [frontend/app/(dashboard)/super-admin/layout.tsx](frontend/app/(dashboard)/super-admin/layout.tsx) — nav adjustments
  - [frontend/app/(super-admin)/layout.tsx](frontend/app/(super-admin)/layout.tsx) — layout sync
  - [frontend/lib/api/super-admin/billing.ts](frontend/lib/api/super-admin/billing.ts) — `getInvoices`, `createInvoice`, `markInvoicePaid`, `sendInvoiceReminder`, `getMrr`, `exportGstr1`, `getPlans`, `createPlan`, `updatePlan`, `deletePlan`
  - [frontend/lib/api/super-admin/schools.ts](frontend/lib/api/super-admin/schools.ts) — added edit/audit endpoints
  - [frontend/types/super-admin/index.ts](frontend/types/super-admin/index.ts) — Invoice/Plan/School type updates

**Fixed today:**
- Login 503 caused by missing `users.access_status` column resolved via `python manage.py migrate users`.
- Test-bootstrap failure on Neon (`tenant_plans` missing) fixed by generating `tenancy/0006_sync_phase10_phase11_models.py`.
- HR migration drift on SQLite worked around by faking `hr.0007_alter_staff_custom_field_staffdocument` and `hr.0008_alter_staff_other_document`.
- `students.0012_repair_missing_district_column` faked (column already existed; SQL used unsupported `ADD COLUMN IF NOT EXISTS`).
- Backend management commands now run under `py -3.10` (Python 3.14 was duplicating app paths `apps.exams` from `D:`/`d:`).

**Still in progress:**
- Super-admin Schools page (`tenancy` branch) — edit + audit subroutes added but not yet wired end-to-end with backend tenant update endpoints.
- Billing invoice flow — drawer + backend endpoints in place; GSTR-1 export and plan CRUD still need tenant-tax validation pass.
- Two new tenancy migrations (`0007_add_branding_fields`, `0008_add_subscription_plan`) are uncommitted and not yet applied on all environments.
- `fix_test_superuser.py` is a local repair script, not yet folded into a proper fixture/management command.

**Start tomorrow with:**
1. Apply `tenancy/0007` and `tenancy/0008` migrations on dev + staging Neon and verify `SubscriptionPlan` seeds.
2. Wire `frontend/app/(dashboard)/super-admin/schools/[tenantId]/edit/` to the tenant update endpoint and add form validation.
3. Wire the audit page to `/api/super-admin/tenants/{id}/audit/` and confirm pagination.
4. End-to-end test invoice create → mark-paid → reminder → GSTR-1 export.
5. Commit the 16 modified + 6 untracked files on the `tenancy` branch with focused commits (backend models/migrations, backend views, frontend schools, frontend billing).

**New bugs found:**
- `ADD COLUMN IF NOT EXISTS` in `students.0012_repair_missing_district_column` is not SQLite-compatible — needs a guarded migration or a schema-editor based approach.
- App path-case duplication on Python 3.14 (`apps.exams` loaded from both `D:` and `d:`) blocks any tooling that resolves Django apps; pin tooling to `py -3.10` or normalize drive-letter case in `sys.path`.
- Next.js dev server (frontend terminal) exited with code 1 — needs investigation; possibly leftover from prior `.next` corruption (delete `frontend/.next` and rebuild if it recurs).
- Invoice number uniqueness relies only on a DB constraint plus UUID suffix — no pre-flight duplicate check; risk of 500 on rare collisions, consider catching `IntegrityError` in `BillingInvoiceListCreateView`.

---

## Module Reference (current state)

### Backend — Tenancy / Super Admin
- Models: `SuperAdminInvoice`, `SubscriptionPlan` in [backend/apps/tenancy/models.py](backend/apps/tenancy/models.py)
- Endpoints (super-admin):
  - `GET/POST /api/super-admin/billing/invoices/`
  - `POST /api/super-admin/billing/invoices/{id}/mark-paid/`
  - `POST /api/super-admin/billing/invoices/{id}/reminder/`
  - `GET /api/super-admin/billing/mrr/`
  - `GET/POST /api/super-admin/billing/plans/`
  - `GET /api/super-admin/billing/export/gstr1/`
- Invoice number format: `INV-YYYYMM-{8-hex}` (see [backend/apps/tenancy/super_admin/utils.py](backend/apps/tenancy/super_admin/utils.py))
- Tax rules: inter-state → IGST; intra-state → CGST+SGST (50/50); default 18% GST, SAC 998313.

### Frontend — Super Admin
- Schools list: [frontend/app/(dashboard)/super-admin/schools/page.tsx](frontend/app/(dashboard)/super-admin/schools/page.tsx)
- Billing dashboard: [frontend/app/(dashboard)/super-admin/billing/page.tsx](frontend/app/(dashboard)/super-admin/billing/page.tsx)
- API client: [frontend/lib/api/super-admin/billing.ts](frontend/lib/api/super-admin/billing.ts), [frontend/lib/api/super-admin/schools.ts](frontend/lib/api/super-admin/schools.ts)

### Environment notes
- Use `py -3.10` for Django management commands (3.14 has app-loading issues, 3.12 venv may lack Celery/Django).
- On Windows + Node 23, keep `frontend/.npmrc` with `script-shell=C:\Windows\System32\cmd.exe`.
- If Next.js build hits "Unexpected end of JSON input" in load-manifest → delete `frontend/.next` and rebuild.
