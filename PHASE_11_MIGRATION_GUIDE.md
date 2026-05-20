# Phase 11 — Existing School Data Migration Strategy

**Status**: INTEGRATION TESTING & VALIDATION FRAMEWORK READY  
**Date**: May 13, 2026  
**Scope**: Safe, staged, reversible per-school data migration from monolithic → tenant schemas  

---

## Executive Summary

Phase 11 implements a **safe, tested, reversible migration framework** for moving existing eSkoolia production school data from the monolithic architecture into isolated tenant schemas.

### Key Capabilities

✅ **Per-school migration** (no mass cutover)  
✅ **Dry-run support** (preview changes safely)  
✅ **Checkpoints & resumability** (safe interruption recovery)  
✅ **Rollback support** (instant revert to monolithic)  
✅ **Hybrid runtime** (migrated + non-migrated schools coexist)  
✅ **Validation automation** (dual-read comparison, mismatch detection)  
✅ **Cross-tenant isolation** (automatic verification)  
✅ **Observability** (timing, metrics, event logging)  
✅ **Integration tests** (realistic end-to-end scenarios)  
✅ **Production-grade safety** (transaction-aware, audit trail)  

---

## Architecture

### Migration Flow

```
School Data (Monolithic Public Schema)
           ↓
    [SELECT school_id = X]
           ↓
    Tenant Schema (isolated)
           ↓
    [INSERT with same structure]
           ↓
    Audit Trail (TenantMigrationAudit in PUBLIC schema)
```

### Safety Layers

1. **Dry-Run Mode** — Collects counts, reports what would happen
2. **Checkpoints** — Records last completed table for resumability
3. **Transaction Safety** — Per-table transactions, can rollback
4. **Validation** — Dual-read comparison before cutover
5. **Rollback** — Delete tenant rows, preserve monolithic source
6. **Audit Trail** — Immutable record in PUBLIC schema

---

## File Structure

### Core Files

| File | Purpose | Lines |
|------|---------|-------|
| `models.py` (extended) | `TenantMigrationAudit` model | 50+ |
| `migration_framework.py` | Core migration engine | 280+ |
| `validation_automation.py` | Dual-read validation, reports | 200+ |
| `observability.py` | Lightweight monitoring | 250+ |
| `test_fixtures.py` | Test data factories | 150+ |
| `test_integration_migrations.py` | Full integration tests | 350+ |

### Management Commands

| Command | Purpose |
|---------|---------|
| `migrate_school_to_tenant` | Execute per-school migration (--dry-run or real) |
| `validate_tenant_migration` | Run dual-read validation |
| `rollback_tenant_migration` | Remove tenant-side data |
| `validate_tenant_isolation` | Check cross-tenant access is blocked |
| `validate_hybrid_runtime` | Verify migrated/non-migrated routing |
| `validate_rollback_flow` | Test full migrate→rollback→remigrate |
| `run_migration_integration_tests` | Run comprehensive pytest suite |

---

## Usage Guide

### Prerequisites

1. **Database backups** — Critical before any migration
   ```bash
   pg_dump -U postgres eskoolia_db > /backups/pre_phase11.sql
   ```

2. **Migrations applied** — Tenancy migrations must run first
   ```bash
   python manage.py makemigrations tenancy
   python manage.py migrate tenancy
   ```

3. **Tenant schema provisioned** — Must exist before migration
   ```bash
   # Verify with django-tenants or manual schema creation
   ```

### Step 1: Dry-Run Migration

Preview what will be migrated without modifying tenant schema:

```bash
python manage.py migrate_school_to_tenant \
    --school-id=1 \
    --tenant-id=TNT_001 \
    --schema-name=school_greenwood \
    --dry-run
```

**Output**:
```
Starting migration for school 1 -> tenant TNT_001 schema school_greenwood (dry_run=True)
Migration audit id: 42 status=validated
Tables summary: {
    'attendance_attendance': {'source_rows': 2540, 'migrated': False},
    'fees_invoice': {'source_rows': 1200, 'migrated': False},
    'hr_staff': {'source_rows': 45, 'migrated': False},
    ...
}
```

Review counts. If acceptable, proceed to Step 2.

### Step 2: Real Migration

Execute actual data copy:

```bash
python manage.py migrate_school_to_tenant \
    --school-id=1 \
    --tenant-id=TNT_001 \
    --schema-name=school_greenwood
```

**Output**:
```
Starting migration for school 1 -> tenant TNT_001 schema school_greenwood (dry_run=False)
Migration audit id: 43 status=completed
Tables summary: {
    'attendance_attendance': {'source_rows': 2540, 'rows': 2540, 'migrated': True},
    'fees_invoice': {'source_rows': 1200, 'rows': 1200, 'migrated': True},
    ...
}
```

### Step 3: Validate Migration

Compare source vs tenant counts:

```bash
python manage.py validate_tenant_migration \
    --school-id=1 \
    --schema-name=school_greenwood
```

**Output**:
```
=============================================================================
MIGRATION VALIDATION REPORT
=============================================================================
School ID: 1
Schema: school_greenwood
Overall Status: PASS

SUMMARY
Total Tables Checked: 12
Tables Matching: 12
Tables Mismatching: 0

DETAILED RESULTS
✓ MATCH attendance_attendance
  Source rows: 2540
  Tenant rows: 2540
...
```

### Step 4 (if needed): Rollback

Remove tenant-side data (preserves monolithic source):

```bash
python manage.py rollback_tenant_migration \
    --school-id=1 \
    --schema-name=school_greenwood
```

**Output**:
```
Rolling back migration for school 1 in schema school_greenwood
Rollback audit status: rolled_back
Tables outcome: {...}
```

---

## Integration Testing

### Run Full Test Suite

```bash
python manage.py run_migration_integration_tests
```

Tests cover:
- Dry-run migrations
- Real migrations
- Validation passes
- Rollback flows
- Re-migration safety
- Cross-tenant isolation
- Hybrid runtime routing

### Run Specific Tests

```bash
# Only rollback tests
python manage.py run_migration_integration_tests --specific RollbackTest

# With failures on first error
python manage.py run_migration_integration_tests --failfast
```

### Validate Cross-Tenant Isolation

```bash
python manage.py validate_tenant_isolation \
    --schema1=school_greenwood \
    --schema2=school_alpha \
    --school1=1 \
    --school2=2
```

**Output**:
```
✓ Cross-tenant isolation validated successfully!
```

### Validate Hybrid Runtime

```bash
python manage.py validate_hybrid_runtime \
    --migrated-school-id=1 \
    --non-migrated-school-id=2
```

### Validate Rollback Flow

```bash
python manage.py validate_rollback_flow \
    --school-id=1 \
    --schema-name=school_greenwood \
    --tenant-id=TNT_001
```

Tests: migrate → validate → rollback → validate cleanup → re-migrate → validate

---

## Data Integrity Guarantees

### What Gets Migrated

✅ All tables matching `school_id` or `organization_id`  
✅ All columns preserved (no transformation)  
✅ All row counts validated  
✅ All foreign keys preserved (if target schema has parent records)  
✅ Timestamps preserved  
✅ IDs preserved  

### What Stays Protected

✅ Monolithic source data (NEVER deleted)  
✅ Super-admin users (remain in PUBLIC schema)  
✅ System tables (never copied)  
✅ Audit logs (stored in PUBLIC schema only)  

### What Gets Validated

✅ Row counts match
✅ No orphaned records  
✅ No duplicates  
✅ Cross-tenant access blocked  
✅ Auth works after migration  
✅ RBAC preserved  

---

## Hybrid Runtime

During migration phases, the system supports:

### For Migrated Schools (e.g., Greenwood)
```
User login → JWT auth in PUBLIC schema
         ↓
Tenant resolution → "school_greenwood" 
         ↓
Schema switch → SET search_path = "school_greenwood"
         ↓
Query data → from tenant schema
         ↓
Response → tenant-isolated data only
```

### For Non-Migrated Schools (e.g., Alpha Academy)
```
User login → JWT auth in PUBLIC schema
         ↓
Tenant resolution → None (monolithic mode)
         ↓
No schema switch
         ↓
Query data → from public schema (monolithic)
         ↓
Response → filtered by school_id
```

**No conflicts** — Both modes coexist safely.

---

## Observability & Monitoring

### Migration Events Recorded

```python
from apps.tenancy.observability import get_observer

observer = get_observer()

# Get all migration events
events = observer.get_events(event_type="migration_complete")

# Get summary
summary = observer.get_summary()
print(summary)
# {
#     "total_events": 45,
#     "event_types": {"migration_start": 5, "migration_complete": 5, ...},
#     "total_duration_ms": 12500,
#     "error_count": 0
# }
```

### Available Event Types

- `migration_start` — Migration began
- `migration_complete` — Migration finished
- `validation_start` — Validation began
- `validation_complete` — Validation finished
- `rollback_start` — Rollback began
- `rollback_complete` — Rollback finished
- `auth_failure` — Auth error detected
- `cross_tenant_access_attempt` — Isolation violation attempted

---

## Safety Checklist

### Before Migration

- [ ] Database backup taken
- [ ] Tenant schema provisioned
- [ ] Tenant migrations applied
- [ ] Dry-run migration executed (review counts)
- [ ] Test on staging with clone of production data

### During Migration

- [ ] Real migration executed
- [ ] Validation passed (all table counts match)
- [ ] Cross-tenant isolation verified
- [ ] Audit logs recorded

### After Migration

- [ ] Frontend tested (login, basic operations)
- [ ] APIs tested (sample requests)
- [ ] RBAC verified (permissions work)
- [ ] Monitoring alerts configured
- [ ] Rollback capability verified (test one rollback)

### For Production Pilot

- [ ] First school is low-risk (test/demo school)
- [ ] Monitoring 24/7
- [ ] Runbook for emergency rollback
- [ ] Communication with school admin
- [ ] Plan for next schools (staggered, not simultaneous)

---

## Troubleshooting

### Issue: "schema_missing" Error

**Cause**: Tenant schema doesn't exist.

**Fix**:
```bash
# Create schema manually if django-tenants not available
psql -U postgres eskoolia_db -c "CREATE SCHEMA school_greenwood"
```

### Issue: Table Row Count Mismatch

**Cause**: Partial migration (interrupted).

**Fix**:
```bash
# Find checkpoint from audit
python manage.py validate_tenant_migration --school-id=1 --schema-name=school_greenwood

# Review TenantMigrationAudit.checkpoint in DB
SELECT * FROM tenant_migration_audit WHERE school_id=1 ORDER BY created_at DESC;

# Re-run migration (will resume from checkpoint)
python manage.py migrate_school_to_tenant --school-id=1 --schema-name=school_greenwood
```

### Issue: Cross-Tenant Data Detected

**Cause**: Data leaked between schemas (CRITICAL).

**Fix**:
```bash
# Rollback immediately
python manage.py rollback_tenant_migration --school-id=1 --schema-name=school_greenwood

# Investigate which tables leaked data
python manage.py validate_tenant_isolation --schema1=school_greenwood --schema2=school_alpha --school1=1 --school2=2

# Review audit logs
SELECT * FROM tenant_migration_audit WHERE school_id=1;

# Contact dev team before re-migrating
```

---

## Next Steps After Phase 11 Testing

### Phase 11 Success Criteria ✅

- [ ] Dry-run works without modifying schemas
- [ ] Real migration copies data correctly
- [ ] Validation detects and reports mismatches
- [ ] Rollback removes tenant data safely
- [ ] Re-migration works after rollback
- [ ] Hybrid runtime routes requests correctly
- [ ] Cross-tenant isolation is enforced
- [ ] Integration tests all pass
- [ ] Observability captures events
- [ ] No production data modified

### Proceed When:

✅ All integration tests pass  
✅ Staging migration tested successfully  
✅ Rollback tested and verified  
✅ Cross-tenant isolation confirmed  
✅ Observability metrics collected  

### Don't Proceed If:

❌ Any integration test fails  
❌ Data mismatch detected  
❌ Cross-tenant access found  
❌ Rollback doesn't work  
❌ Hybrid runtime has errors  

---

## Key Files Reference

- **Migration framework**: `backend/apps/tenancy/migration_framework.py`
- **Validation engine**: `backend/apps/tenancy/validation_automation.py`
- **Observability**: `backend/apps/tenancy/observability.py`
- **Integration tests**: `backend/apps/tenancy/test_integration_migrations.py`
- **Management commands**: `backend/apps/tenancy/management/commands/`
- **Audit model**: `backend/apps/tenancy/models.py` (TenantMigrationAudit)

---

## Production Rollout Plan

### Phase 11A: Staging Validation (Current)
- Test on staging with production-like data
- Validate all integration tests
- Verify cross-tenant isolation
- Train ops team

### Phase 11B: Pilot School
- Select one low-risk school
- Migrate to staging tenant schema
- Monitor for 1-2 weeks
- If successful → production pilot

### Phase 11C: Production Pilot
- Migrate first school to production
- Monitor for 1-2 weeks
- Verify no issues
- Plan next batch

### Phase 11D: Staged Rollout
- Migrate schools in small batches (e.g., 5 at a time)
- Monitor each batch for 1 week
- Continue until all schools migrated
- Keep monolithic mode as fallback

### Phase 11E: Cutover
- After all schools migrated and validated
- Gradually activate tenant routing
- Deactivate monolithic mode (later phase)

---

## Summary

**Phase 11 provides a production-grade migration framework that is**:

✅ **Safe** — Transactional, rollbackable, audit-trailed  
✅ **Staged** — Per-school, not mass cutover  
✅ **Tested** — Comprehensive integration test suite  
✅ **Validated** — Dual-read comparison, mismatch detection  
✅ **Observable** — Event logging and metrics  
✅ **Reversible** — Instant rollback capability  
✅ **Documented** — Complete usage guide  
✅ **Production-ready** — Ready for staging pilot  

---

**Next Phase**: Phase 12 (File/Document Migration) after Phase 11 validation complete.

*Phase 11: Existing School Data Migration Strategy*  
*Status: INTEGRATION TESTING READY*  
*Date: May 13, 2026*
