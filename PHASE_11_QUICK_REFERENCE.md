# Phase 11 Quick Reference — School Data Migration

## Quick Start

```bash
# 1. Database backup (CRITICAL)
pg_dump -U postgres eskoolia_db > /backups/pre_phase11_$(date +%s).sql

# 2. Apply migrations
cd backend
python manage.py makemigrations tenancy
python manage.py migrate tenancy

# 3. Dry-run (preview only)
python manage.py migrate_school_to_tenant --school-id=1 --tenant-id=TNT_001 --schema-name=school_greenwood --dry-run

# 4. Real migration
python manage.py migrate_school_to_tenant --school-id=1 --tenant-id=TNT_001 --schema-name=school_greenwood

# 5. Validate
python manage.py validate_tenant_migration --school-id=1 --schema-name=school_greenwood

# 6. Test isolation
python manage.py validate_tenant_isolation --schema1=school_greenwood --schema2=school_alpha --school1=1 --school2=2

# 7. Verify rollback works (if migration good)
python manage.py validate_rollback_flow --school-id=1 --schema-name=school_greenwood --tenant-id=TNT_001
```

---

## Management Commands

### Migrate School

```bash
python manage.py migrate_school_to_tenant \
    --school-id=1 \
    --tenant-id=TNT_001 \
    --schema-name=school_greenwood \
    [--dry-run] \
    [--actor-username=admin]
```

**Options**:
- `--dry-run`: Preview counts, don't copy data
- `--actor-username`: Record who performed migration

### Validate Migration

```bash
python manage.py validate_tenant_migration \
    --school-id=1 \
    --schema-name=school_greenwood
```

**Output**: Comparison of source vs tenant row counts per table.

### Rollback Migration

```bash
python manage.py rollback_tenant_migration \
    --school-id=1 \
    --schema-name=school_greenwood \
    [--actor-username=admin]
```

**Effect**: Deletes tenant-side rows for school_id. Preserves monolithic source.

### Validate Isolation

```bash
python manage.py validate_tenant_isolation \
    --schema1=school_greenwood \
    --schema2=school_alpha \
    --school1=1 \
    --school2=2
```

**Check**: Confirms schema1 cannot see school2 data and vice versa.

### Validate Hybrid Runtime

```bash
python manage.py validate_hybrid_runtime \
    --migrated-school-id=1 \
    --non-migrated-school-id=2
```

**Check**: Shows both migrated (tenant) and non-migrated (monolithic) schools operational.

### Validate Rollback Flow

```bash
python manage.py validate_rollback_flow \
    --school-id=1 \
    --schema-name=school_greenwood \
    --tenant-id=TNT_001
```

**Test**: migrate → rollback → re-migrate → verify all work.

### Run Integration Tests

```bash
python manage.py run_migration_integration_tests \
    [--verbose] \
    [--failfast] \
    [--specific TestClassName]
```

**Examples**:
```bash
# All tests
python manage.py run_migration_integration_tests

# Stop on first failure
python manage.py run_migration_integration_tests --failfast

# Only rollback tests
python manage.py run_migration_integration_tests --specific RollbackTest
```

---

## Python API

### Import Core Classes

```python
from apps.tenancy import migration_framework
from apps.tenancy.validation_automation import validate_migration_completeness
from apps.tenancy.observability import get_observer
```

### Perform Migration

```python
# Dry-run
audit = migration_framework.migrate_school_to_tenant(
    school_id=1,
    tenant_id="TNT_001",
    schema_name="school_greenwood",
    dry_run=True,
)
print(f"Audit status: {audit.status}")
print(f"Tables: {audit.tables}")

# Real migration
audit = migration_framework.migrate_school_to_tenant(
    school_id=1,
    tenant_id="TNT_001",
    schema_name="school_greenwood",
    dry_run=False,
)
```

### Validate Migration

```python
# Get validation report
report = migration_framework.validate_migration(
    school_id=1,
    schema_name="school_greenwood"
)
print(f"Match status: {report['results']}")
```

### Rollback

```python
# Remove tenant-side data
audit = migration_framework.rollback_migration(
    school_id=1,
    schema_name="school_greenwood"
)
print(f"Rollback status: {audit.status}")
```

### Use Observability

```python
from apps.tenancy.observability import get_observer

observer = get_observer()

# Get all events
events = observer.get_events()

# Get events by type
migrations = observer.get_events(event_type="migration_complete")

# Get events by school
school_events = observer.get_events(school_id=1)

# Get summary
summary = observer.get_summary()
print(summary)
# {'total_events': 45, 'event_types': {...}, 'total_duration_ms': 12500, ...}
```

---

## Test Fixtures & Data Generation

### Create Test School Dataset

```python
from apps.tenancy.test_fixtures import create_test_dataset, cleanup_test_data

# Create realistic test data
dataset = create_test_dataset(school_id=1, small=True)
print(dataset)
# {'school_id': 1, 'users': 3, 'attendance': 5, 'fees': 3, 'staff': 5}

# Cleanup when done
cleanup_test_data(school_id=1)
```

### Create Individual Records

```python
from apps.tenancy.test_fixtures import (
    create_test_school,
    create_test_users,
    create_test_attendance_records,
    create_test_fee_records,
    create_test_hr_staff,
)

# Create school
school = create_test_school(code="TEST1", name="Test School 1")

# Create users
users = create_test_users(school_id=1, count=5)

# Create attendance records
attendance = create_test_attendance_records(school_id=1, count=20)

# Create fee records
fees = create_test_fee_records(school_id=1, count=15)

# Create HR staff
staff = create_test_hr_staff(school_id=1, count=10)
```

---

## Audit & Logging

### Query Migration Audit Trail

```python
from apps.tenancy.models import TenantMigrationAudit

# Get all migrations for a school
audits = TenantMigrationAudit.objects.filter(school_id=1).order_by("-started_at")

for audit in audits:
    print(f"Migration {audit.id}: {audit.status}")
    print(f"  Tables: {audit.tables}")
    print(f"  Error: {audit.error}")
    print(f"  Checkpoint: {audit.checkpoint}")
```

### Validation Report

```python
from apps.tenancy.validation_automation import (
    validate_migration_completeness,
    generate_validation_report,
)

# Run validation
validation = validate_migration_completeness(
    school_id=1,
    schema_name="school_greenwood",
    tables=["attendance_attendance", "fees_invoice"],
)

# Generate report
report = generate_validation_report(validation)
print(report)
```

---

## Key Models

### TenantMigrationAudit

```python
# Fields:
# school_id (int) - Which school was migrated
# tenant_id (str) - Target tenant ID
# schema_name (str) - Target schema name
# status - "started", "in_progress", "completed", "failed", "rolled_back", "validated"
# checkpoint (str) - Last completed table (for resumability)
# tables (JSON) - {'table_name': {'rows': 123, 'migrated': true}, ...}
# validation (JSON) - Validation summary
# error (str) - Error message if failed
# actor_user_id, actor_username - Who performed migration
# started_at, completed_at - Timestamps

# Example query:
from apps.tenancy.models import TenantMigrationAudit

audit = TenantMigrationAudit.objects.filter(school_id=1).latest("started_at")
print(f"Status: {audit.status}")
print(f"Tables migrated: {audit.tables}")
```

---

## Observability Events

```python
from apps.tenancy.observability import get_observer

observer = get_observer()

# Available event types:
# - migration_start: Migration began
# - migration_complete: Migration finished
# - validation_start: Validation began
# - validation_complete: Validation finished
# - rollback_start: Rollback began
# - rollback_complete: Rollback finished
# - auth_failure: Auth error detected
# - cross_tenant_access_attempt: Isolation violation

# Example: Get all migrations for school 1
migrations = observer.get_events(school_id=1, event_type="migration_complete")
for event in migrations:
    print(f"{event.timestamp}: {event.status} ({event.duration_ms}ms)")
```

---

## Safety Checklist

Before Production Pilot:

- [ ] All integration tests pass
- [ ] Dry-run migration tested (review counts)
- [ ] Real migration tested on staging
- [ ] Validation passed (all counts match)
- [ ] Rollback tested (data removed, source preserved)
- [ ] Cross-tenant isolation verified
- [ ] Hybrid runtime working (migrated + non-migrated)
- [ ] Database backup taken
- [ ] Monitoring configured
- [ ] Runbook for emergency rollback prepared

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "schema_missing" | `psql -c "CREATE SCHEMA school_greenwood"` |
| Row count mismatch | Check TenantMigrationAudit.checkpoint; may need to resume |
| Cross-tenant data | Rollback immediately; investigate; contact dev team |
| Migration hangs | Check database locks; may need transaction kill |
| Validation fails | Review error details; check FK dependencies |
| Rollback incomplete | Check table permissions; may need manual cleanup |

---

## Key Files

| File | Purpose |
|------|---------|
| `migration_framework.py` | Core migration engine |
| `validation_automation.py` | Validation and reporting |
| `observability.py` | Event logging |
| `test_fixtures.py` | Test data factories |
| `test_integration_migrations.py` | Integration test suite |
| `models.py` | TenantMigrationAudit model |

---

## Status & Next Steps

**Phase 11 Status**: Integration testing ready, validation automation complete

**Next Actions**:
1. Run integration tests: `python manage.py run_migration_integration_tests`
2. Test on staging with production-like data
3. Verify all validations pass
4. Plan pilot school selection
5. Proceed to Phase 12 (File/Document Migration)

---

*Phase 11 Quick Reference*  
*Existing School Data Migration Strategy*  
*May 13, 2026*
