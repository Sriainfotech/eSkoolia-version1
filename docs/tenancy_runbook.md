# eSkoolia Tenancy Runbook

## Phase 12 Addendum

Phase 12 is the controlled staging validation campaign. It does not migrate production schools and it does not change the default monolithic runtime.

Use the staging campaign command to validate migration, rollback, hybrid runtime, isolation, observability, auth, RBAC, and frontend compatibility against production-like staging data:

```bash
cd backend
python manage.py run_staging_validation_campaign --pilot-school-id=1 --confirm-real-migration --export-path=staging-reports/phase12_campaign.json
```

Required guards:

- `MULTI_TENANCY_ENABLED=true`
- `STAGING_VALIDATION_CAMPAIGN=true`
- `STAGING_VALIDATION_CONFIRM_REAL_MIGRATION=true` for the destructive steps

If the command reports blockers, stop there and fix the readiness gap before any real migration attempt.

The detailed operator guide for this phase lives in [PHASE_12_STAGING_VALIDATION_CAMPAIGN.md](PHASE_12_STAGING_VALIDATION_CAMPAIGN.md).

# eSkoolia Tenancy Runbook (Initial Foundation)

This document describes the initial, non-destructive patch that introduces
schema-based multi-tenancy foundations (django-tenants) in a guarded,
feature-flagged manner.

Important: This patch does NOT enable tenant routing by default. Set
`MULTI_TENANCY_ENABLED=true` to start using the guarded behavior.

## Current architecture (summary)
- Monolithic Django project (apps under `backend/apps/...`).
- `apps.tenancy.School` model stores existing schools (table: `schools`).
- Many app querysets and serializers rely on `school_id` filters and
  `request.user.school` / `request.user.school_id` for isolation.
- Authentication: JWT via `rest_framework_simplejwt` and custom `User` model.

## Target architecture (high level)
- Schema-based multi-tenancy using `django-tenants`.
- Shared/public schema: global configuration, super-admin users, subscriptions.
- Per-tenant schemas: school-specific models and data (students, HR, attendance, fees, etc.).
- Tenant provisioning API to create tenant schemas and default seed data.

## What this patch adds (safe, reversible foundational work)
1. Feature flag: `MULTI_TENANCY_ENABLED` (default: `False`).
2. Guarded settings changes in `backend/config/settings/base.py`:
   - Conditional addition of `django_tenants` to `INSTALLED_APPS`.
   - Guarded `SHARED_APPS` and `TENANT_APPS` placeholders.
   - Guarded switch to `django_tenants.postgresql_backend` when Postgres is used.
   - Static validation checks for middleware order and duplicate apps.
3. Additive tenant models in `apps.tenancy.models`:
   - `SchoolTenant` (TenantMixin-compatible skeleton)
   - `Domain` (DomainMixin-compatible skeleton)
   - Existing `School` model left intact (non-destructive)
4. Migration skeleton: `apps.tenancy/migrations/0002_add_tenant_models.py`.
5. Management command skeleton: `apps.tenancy.management.commands.provision_tenant`.
6. Utilities: `apps.tenancy.utils` helpers for public schema validation and
   test tenant provisioning (guarded when feature flag is off).
7. Placeholder DB router: `apps.tenancy.routers.TenantSyncRouter`.
8. Runbook and phased migration notes (this file).

## Rollback steps (if anything goes wrong)
- If you enabled the feature flag and need to rollback, unset
  `MULTI_TENANCY_ENABLED` and restart your application. Because the
  feature is guarded, the code paths that integrate with django-tenants
  are not executed when the flag is `False`.
- If you applied the new migrations and need to rollback database changes
  revert the migration `apps.tenancy.0002_add_tenant_models` using:

```bash
python manage.py migrate tenancy 0001
```

- Remove any test tenant rows or schema objects created by the
  provisioning command (manual steps documented in later phases).

## Phased migration plan (high level)
1. Foundation (this patch): add guarded settings, tenant models, management
   command and utilities. No production data migration.
2. Smoke provisioning (feature flag ON in a staging environment): run the
   provisioning command to create a test tenant and validate schema switching.
3. Detailed mapping & migration scripts: prepare per-app migration helpers
   that copy data from `public` tables into tenant schemas preserving PKs and FKs.
4. Migrate users: keep super-admins in public schema; move school users into
   tenant schemas (or create cross-schema lookup) while ensuring JWT tokens
   remain valid or are reissued during cutover.
5. Validation & QA: run full regression test suite and frontend smoke tests.
6. Gradual rollout: enable tenant routing for a subset of schools and
   monitor logs and audit events.
7. Full cutover: once confident, switch live environment and retire the
   old `school_id` conditional query usage over time.

## Staging activation preparation (Phase 7 guard)

This patch adds guarded staging-only router activation support. The following
checklist defines prerequisites and safe activation procedures.

### Prerequisites before enabling router activation

**SHARED_APPS/TENANT_APPS separation must be complete:**
- All critical shared apps (django_tenants, apps.tenancy, auth, contenttypes)
  must be in SHARED_APPS.
- No app can appear in both SHARED_APPS and TENANT_APPS.
- Tenant-specific apps (students, admissions, hr, fees, etc.) must be in TENANT_APPS.
- SHARED_APPS cannot be empty; TENANT_APPS cannot be empty.

**Router readiness:**
- DATABASE_ROUTERS must contain exactly one entry when enabled: `apps.tenancy.routers.TenantSyncRouter`
- The router must be importable and resolve to the correct class without errors.
- No duplicate routers in the list.

**Middleware readiness:**
- TenantMainMiddleware must be present in MIDDLEWARE when router is enabled.
- TenantMainMiddleware must appear BEFORE AuthenticationMiddleware.
- SessionMiddleware should appear before TenantMainMiddleware.
- All middleware ordering constraints must pass system checks.

**Authentication readiness:**
- JWTAuthentication must be configured in REST_FRAMEWORK.
- Existing `X-School-Id` header-based isolation must remain in place.
- JWT tokens must continue to validate against the User model.

**Model readiness:**
- SchoolTenant model must inherit from TenantMixin and have auto_create_schema=True.
- Domain model must inherit from DomainMixin.
- Both models must import successfully without errors.

**Tenant models must not conflict with existing School model:**
- The existing School model (in apps.tenancy.models) remains unchanged.
- SchoolTenant and Domain are additive models; they do NOT replace School.
- FK relationships from User and other models continue to reference School.

### Safe staging activation sequence

**Step 1: Verify readiness report**
```bash
python manage.py check
python manage.py tenant_bootstrap --dry-run
```
All items in the readiness report should show "ok" or "✓ ready".
There should be zero blockers; any blockers must be resolved before proceeding.

**Step 2: Enable MULTI_TENANCY_ENABLED in staging environment only**
```bash
export MULTI_TENANCY_ENABLED=true
python manage.py check  # Run again to verify staged checks pass
```

**Step 3: Run tenant_bootstrap with routing active**
```bash
python manage.py tenant_bootstrap --dry-run
```
With MULTI_TENANCY_ENABLED=true, the tool will report:
- App split readiness with no duplicates
- Router activation readiness (TenantSyncRouter should be importable and first in chain)
- Middleware ordering ready
- Zero blockers
- Any staging-specific warnings but no unresolved risks

**Step 4: Verify existing monolithic behavior unchanged**
- Run existing API tests; all should pass without modification.
- JWT auth should work as before (users isolated by school_id header).
- Querysets should continue to filter by school_id.
- No schema switching should occur; public schema remains active.
- RBAC and permissions should continue to work.

**Step 5: Verify tenant routing is NOT active**
```bash
python manage.py shell
>>> from django.db import connection
>>> connection.search_path  # Should be "$user, public" or just "public"
```

### Rollback from staging activation

If issues occur during staging with MULTI_TENANCY_ENABLED=true:

1. Disable the flag:
```bash
unset MULTI_TENANCY_ENABLED
```

2. Restart the application.

3. Run checks again:
```bash
python manage.py check
```

4. Verify existing behavior is restored by running API tests.

Because routing and schema switching remain inactive when MULTI_TENANCY_ENABLED=false,
rollback is a configuration-only change with no data loss.

### Known risks with partial app split

If SHARED_APPS and TENANT_APPS are incomplete (some apps missing from both lists):
- Certain app data may not be properly replicated across tenant schemas.
- Querysets may return inconsistent results depending on active schema.
- User permissions and roles may not isolate correctly between tenants.

**Mitigation**: Complete app split before enabling router in production.
Review [Tenancy Runbook Phase 2](#phased-migration-plan) for recommended
app segregation mappings.

### Guidance for existing school_id query compatibility

During and after staging activation:

1. **Do NOT remove `school_id` filters** from querysets yet.
   - Keep filters in place as a safety layer during transition.
   - They provide defense-in-depth even if tenant routing is active.

2. **Do NOT modify existing User model relationships** yet.
   - User.school_id FK must remain; it is used by JWT auth flow and RBAC.
   - Users are still isolated by school_id in the public schema initially.

3. **Do NOT modify frontend routing logic** yet.
   - Frontend can continue to use `X-School-Id` headers as before.
   - Tenant resolution happens transparently on backend without frontend changes.

4. **JWTAuthentication remains unchanged:**
   - Tokens continue to reference users by ID + school_id.
   - No changes to token format or expiration.

5. **Gradual migration strategy** (documented in later phases):
   - Stage 1 (now): Routing active but data still in public schema + JWT isolation.
   - Stage 2: Migrate existing school data to tenant schemas (Phase 9).
   - Stage 3: Enable per-tenant user records (Phase 10).
   - Stage 4: Retire school_id filters after full validation (Phase 15).

### What is NOT done in this patch

- ❌ No schema switching or schema_context activation.
- ❌ No tenant schema creation (public schema only).
- ❌ No data migration to tenant schemas.
- ❌ No user migration between schemas.
- ❌ No changes to existing API contracts or serializers.
- ❌ No changes to frontend code or authentication flow.
- ❌ No removal of existing school_id filters in querysets.
- ❌ MULTI_TENANCY_ENABLED remains False by default after this patch.

### What IS done in this patch

- ✅ DATABASE_ROUTERS guarded activation (only when flag is True).
- ✅ App split completeness validation.
- ✅ Router readiness detection and validation.
- ✅ Middleware readiness checks.
- ✅ Django system checks for invalid activation states.
- ✅ Comprehensive tenant_bootstrap --dry-run reporting.
- ✅ Staged activation readiness report with blockers and warnings.
- ✅ Runbook documentation for safe activation sequence.
- ✅ Rollback guidance for quick recovery if issues occur.

## Compatibility notes
- Many modules currently use explicit `school_id` filters. Do NOT remove
  those filters until tenant isolation is fully validated.
- JWT tokens reference user records — moving users across schemas requires
  careful handling to preserve authentication. Consider keeping user auth
  centralized in the public schema until a safe migration strategy is in place.
- Database migrations that alter existing tables must be handled carefully
  so FK relationships and IDs remain intact.

## Next steps (after this patch)
- Enable `MULTI_TENANCY_ENABLED` in a local or staging environment and run:

```bash
python manage.py provision_tenant --create-public --provision-test-tenant
```

- Expand `SHARED_APPS` and `TENANT_APPS` lists to reflect the exact app
  segregation plan before attempting data migrations.
- Implement app-specific migration helpers and test copying data to tenant schemas.

## Compatibility notes

- **Django compatibility**: This patch was prepared for Django==6.0.4 as used in the project. Verify `django-tenants` compatibility with Django 6 before enabling the flag in production. Targeted `django-tenants` pin in `backend/requirements.txt` is `3.7.0` — test this in staging.
- **psycopg2 / Postgres adapter**: Use `psycopg2-binary` or `psycopg2` matching your Postgres server. Major psycopg2 upgrades can affect connection behavior; pin your adapter in production and test migrations.
- **Middleware compatibility**: When enabling tenant routing, ensure `django_tenants.middleware.main.TenantMainMiddleware` appears before `django.contrib.auth.middleware.AuthenticationMiddleware` to avoid authentication failures.
- **Why middleware order matters**: `TenantMainMiddleware` must be first so the request is associated with the correct tenant before any auth, RBAC, or session-dependent logic runs. If it is late in the chain, user identity and permissions can be resolved against the wrong schema or before the tenant context exists.
- **Why routing is still disabled**: This patch only validates middleware compatibility. Schema switching and request routing stay off until the separate activation stage so the current monolithic runtime remains unchanged.
- **Safe activation sequence**: Keep `MULTI_TENANCY_ENABLED=False` during validation. Then, in a later stage, enable the flag in staging first, confirm middleware checks pass, add the router configuration, and only after that begin tenant schema bootstrap and schema switching.
- **Router activation prerequisites**: Before any tenant routing is enabled, ensure `DATABASE_ROUTERS` contains the expected tenant router, it imports successfully, it is the first router in the chain, and the app separation between `SHARED_APPS` and `TENANT_APPS` is clean.
- **Known risks before staging routing**: The current codebase still relies on `school_id`-filtered monolithic query paths. Enabling routing before those paths are reviewed may create mismatched assumptions between request context and data access.
- **Rollback guidance**: If readiness checks fail in staging, set `MULTI_TENANCY_ENABLED=False`, remove the router addition, and restart the service. Because routing is still inactive by default, rollback is a config-only change at this stage.
- **Migration caveats**: Do not attempt to run tenant migrations (`migrate_schemas`) against production until migration scripts that copy existing data into tenant schemas are prepared and tested. Running migrations prematurely can leave data in unexpected schemas.

## CI / Local validation checklist

- Install dependencies (guarded):

```bash
pip install -r backend/requirements.txt
```

- Run Django checks and migration dry-runs:

```bash
python manage.py check
python manage.py makemigrations --check
python manage.py migrate --plan
```

- Tenant-specific smoke tests (feature flag OFF):

```bash
# Ensure MULTI_TENANCY_ENABLED is not set or is False
python manage.py check
python manage.py tenant_bootstrap --dry-run
```

- Existing authentication smoke test:

```bash
# Run a basic JWT login + API call to ensure existing auth continues
python manage.py shell -c "from django.contrib.auth import get_user_model; print(get_user_model())"
```

- Existing API smoke test:

```bash
# Start dev server and run a few GETs against known endpoints used by frontend
python manage.py runserver
```

## Dry-run provisioning note

The management commands provided in `apps.tenancy.management.commands` operate in a dry-run mode by default. They will perform validations and print the intended schema operations without creating schemas when `MULTI_TENANCY_ENABLED` is False or when `--dry-run`/`--provision-test-tenant` flags are used.

## Contact
If you want, I can now:
- Enable the feature flag in staging and run the provisioning command,
  or
- Continue and implement the provisioning API endpoint and seeders.

*** End of runbook ***
