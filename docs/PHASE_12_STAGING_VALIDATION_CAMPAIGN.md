# Phase 12 Controlled Staging Validation Campaign

This phase validates the multi-tenant migration engine under production-like staging conditions before any production school is migrated.

## Goals

- Validate migration correctness.
- Validate rollback safety.
- Validate hybrid runtime stability.
- Validate schema isolation.
- Validate auth, RBAC, APIs, and frontend compatibility.
- Validate observability and performance under realistic staging load.

## Safety Model

This phase is staging-only.

- Production schools are not migrated.
- Legacy `school_id` filters remain in place.
- Monolithic runtime remains the default.
- Rollback stays enabled.
- Real migration requires explicit confirmation.

## Required Environment Guards

Set these before running the campaign:

```bash
set MULTI_TENANCY_ENABLED=true
set STAGING_VALIDATION_CAMPAIGN=true
set STAGING_VALIDATION_CONFIRM_REAL_MIGRATION=true
```

The command refuses to run when:

- `MULTI_TENANCY_ENABLED` is false.
- `DJANGO_DEBUG` is true.
- staging confirmation is missing.
- readiness checks report blockers.

## Campaign Command

```bash
cd backend
python manage.py run_staging_validation_campaign \
  --pilot-school-id=1 \
  --confirm-real-migration \
  --export-path=staging-reports/phase12_campaign.json
```

If no pilot school is supplied, the command selects the smallest active school automatically.

## Campaign Sequence

The orchestrator runs:

1. Readiness and staging-guard validation.
2. Dry-run migration.
3. Real migration.
4. Dual-read validation.
5. Shadow validation.
6. Schema-switch benchmark.
7. Backend auth and RBAC checks.
8. Frontend Jest smoke suite.
9. Isolation validation against a peer school.
10. Hybrid runtime validation.
11. Rollback validation.
12. Re-migration validation.
13. Report export.

## Validation Outputs

The exported report includes:

- Pilot school and tenant mapping.
- Step-by-step status.
- Performance benchmarks.
- Backend test command results.
- Frontend test command results.
- Shadow validation mismatches.
- Observability summary.

## Frontend Compatibility

The campaign runs the existing frontend Jest suite as a compatibility smoke check.

Current frontend test coverage includes shared utility and page header tests. If the frontend later adds targeted tenant-navigation or tenant-routing smoke tests, the same campaign command can pick them up automatically through the existing test runner.

## Rollback Requirement

Rollback validation is part of the campaign and is not optional once real migration is confirmed.

The campaign explicitly verifies:

- source data remains intact,
- tenant rows can be removed safely,
- re-migration works after rollback.

## Shadow Validation

Shadow validation compares tenant and monolithic results for the pilot school and flags mismatches automatically.

It currently focuses on the migrated relational tables that are already covered by the migration framework, including:

- attendance,
- fees,
- HR,
- academics,
- timetable,
- exams,
- payroll,
- transport,
- library,
- inventory,
- student records.

## Success Criteria

The campaign is successful when:

- dry-run migration succeeds,
- real migration succeeds,
- validation reports are clean,
- auth and RBAC checks pass,
- frontend tests pass,
- isolation checks pass,
- hybrid runtime checks pass,
- rollback succeeds,
- re-migration succeeds,
- benchmark reports are produced,
- observability logs are captured.

## Rollout Boundary

This phase does not start production migration.

The next step after a green staging campaign is a controlled pilot-school production run with the same rollback and validation procedures.
