"""Phase 12 staging validation campaign helpers.

This module orchestrates the already-built migration, rollback, validation,
and observability layers under a staging-only guard.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
import time
from dataclasses import asdict, dataclass, field
from pathlib import Path
from typing import Any, Dict, List, Optional

from django.conf import settings
from django.db import connection
from django.utils import timezone

from apps.tenancy import migration_framework
from apps.tenancy.models import School, SchoolTenant
from apps.tenancy.observability import get_observer
from apps.tenancy.utils import _validate_staging_activation_readiness, validate_tenancy_configuration
from apps.tenancy.validation_automation import (
    generate_validation_report,
    validate_migration_completeness,
)


STAGING_GUARD_ENV = "STAGING_VALIDATION_CAMPAIGN"
CONFIRM_ENV = "STAGING_VALIDATION_CONFIRM_REAL_MIGRATION"


@dataclass
class CampaignStepResult:
    name: str
    status: str
    duration_ms: int
    summary: str
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CampaignBenchmark:
    name: str
    duration_ms: int
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class StagingValidationCampaignReport:
    started_at: str
    completed_at: Optional[str]
    environment_guard: Dict[str, Any]
    pilot_school: Dict[str, Any]
    peer_school: Dict[str, Any]
    non_migrated_school: Dict[str, Any]
    steps: List[Dict[str, Any]]
    benchmarks: List[Dict[str, Any]]
    backend_checks: Dict[str, Any]
    frontend_checks: Dict[str, Any]
    validation: Dict[str, Any]
    shadow_validation: Dict[str, Any]
    observability: Dict[str, Any]
    overall_status: str
    notes: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)

    def export(self, output_path: Path) -> Dict[str, Path]:
        output_path.parent.mkdir(parents=True, exist_ok=True)
        data = self.to_dict()
        output_path.write_text(json.dumps(data, indent=2, sort_keys=True), encoding="utf-8")

        markdown_path = output_path.with_suffix(".md")
        markdown_path.write_text(render_campaign_report(data), encoding="utf-8")

        return {"json": output_path, "markdown": markdown_path}


def is_staging_validation_enabled() -> bool:
    return os.getenv(STAGING_GUARD_ENV, "false").lower() == "true"


def is_real_migration_confirmed() -> bool:
    return os.getenv(CONFIRM_ENV, "false").lower() == "true"


def validate_campaign_guard() -> Dict[str, Any]:
    enabled = getattr(settings, "MULTI_TENANCY_ENABLED", False)
    debug = getattr(settings, "DEBUG", False)
    staging_flag = is_staging_validation_enabled()
    readiness = _validate_staging_activation_readiness()

    blockers: List[str] = []
    if not enabled:
        blockers.append("MULTI_TENANCY_ENABLED must be true for staging validation.")
    if debug:
        blockers.append("DJANGO_DEBUG must be false for staging validation campaigns.")
    if not staging_flag:
        blockers.append(f"Set {STAGING_GUARD_ENV}=true to allow the staging campaign to run.")
    if readiness.get("blockers"):
        blockers.extend(readiness["blockers"])

    return {
        "enabled": enabled,
        "debug": debug,
        "staging_flag": staging_flag,
        "staging_ready": readiness.get("staging_ready", False) and not blockers,
        "blockers": blockers,
        "readiness": readiness,
    }


def _count_rows(table: str, school_id: int) -> int:
    with connection.cursor() as curs:
        try:
            curs.execute(f'SELECT count(*) FROM public."{table}" WHERE school_id = %s', [school_id])
            return int(curs.fetchone()[0])
        except Exception:
            try:
                curs.execute(f'SELECT count(*) FROM public."{table}" WHERE organization_id = %s', [school_id])
                return int(curs.fetchone()[0])
            except Exception:
                return 0


def estimate_school_volume(school_id: int) -> int:
    tables = migration_framework.get_migration_tables()
    return sum(_count_rows(table, school_id) for table in tables)


def select_pilot_school(preferred_school_id: Optional[int] = None) -> School:
    if preferred_school_id:
        school = School.objects.filter(id=preferred_school_id, is_active=True).first()
        if school:
            return school
        raise ValueError(f"Pilot school {preferred_school_id} was not found or is inactive.")

    schools = list(School.objects.filter(is_active=True).order_by("id"))
    if not schools:
        raise ValueError("No active schools were found for staging validation.")

    ranked: List[tuple[int, int, School]] = []
    for school in schools:
        ranked.append((estimate_school_volume(school.id), school.id, school))

    ranked.sort(key=lambda item: (item[0], item[1]))
    return ranked[0][2]


def select_peer_school(exclude_school_id: int) -> Optional[School]:
    schools = list(School.objects.filter(is_active=True).exclude(id=exclude_school_id).order_by("id"))
    if not schools:
        return None

    ranked: List[tuple[int, int, School]] = []
    for school in schools:
        ranked.append((estimate_school_volume(school.id), school.id, school))

    ranked.sort(key=lambda item: (item[0], item[1]))
    return ranked[0][2]


def select_non_migrated_school(exclude_school_ids: set[int]) -> Optional[School]:
    schools = list(School.objects.filter(is_active=True).exclude(id__in=exclude_school_ids).order_by("id"))
    if not schools:
        return None

    ranked: List[tuple[int, int, School]] = []
    for school in schools:
        ranked.append((estimate_school_volume(school.id), school.id, school))

    ranked.sort(key=lambda item: (item[0], item[1]))
    return ranked[0][2]


def resolve_tenant_for_school(school: School) -> Optional[SchoolTenant]:
    tenant = SchoolTenant.objects.filter(short_code=school.code).first()
    if tenant:
        return tenant

    schema_name = f"school_{school.code.lower().replace('-', '_')}"
    return SchoolTenant.objects.filter(schema_name=schema_name).first()


def _run_subprocess(command: List[str], cwd: Path, label: str) -> Dict[str, Any]:
    start = time.perf_counter()
    completed = subprocess.run(command, cwd=str(cwd), capture_output=True, text=True)
    duration_ms = int((time.perf_counter() - start) * 1000)
    return {
        "label": label,
        "command": command,
        "cwd": str(cwd),
        "returncode": completed.returncode,
        "duration_ms": duration_ms,
        "stdout": completed.stdout[-5000:],
        "stderr": completed.stderr[-5000:],
        "success": completed.returncode == 0,
    }


def run_backend_command(command_name: str, backend_dir: Path, extra_args: Optional[List[str]] = None) -> Dict[str, Any]:
    extra_args = extra_args or []
    command = [sys.executable, "manage.py", command_name, *extra_args]
    return _run_subprocess(command, backend_dir, command_name)


def run_frontend_tests(frontend_dir: Path) -> Dict[str, Any]:
    if sys.platform.startswith("win"):
        command = ["cmd", "/c", "npm", "test", "--", "--runInBand"]
    else:
        command = ["npm", "test", "--", "--runInBand"]
    return _run_subprocess(command, frontend_dir, "frontend_test_suite")


def measure_schema_switch_latency(schema_name: str, iterations: int = 5) -> CampaignBenchmark:
    start = time.perf_counter()
    with connection.cursor() as curs:
        for _ in range(iterations):
            curs.execute(f'SET search_path TO "{schema_name}", public')
            curs.execute("RESET search_path")
    duration_ms = int((time.perf_counter() - start) * 1000)
    return CampaignBenchmark(
        name="schema_switch_latency",
        duration_ms=duration_ms,
        details={"schema_name": schema_name, "iterations": iterations},
    )


def run_shadow_validation(school_id: int, schema_name: str) -> Dict[str, Any]:
    tables = migration_framework.get_migration_tables()
    validation = validate_migration_completeness(school_id, schema_name, tables)
    shadow_report = generate_validation_report(validation)
    migration_snapshot = migration_framework.validate_migration(school_id, schema_name)

    mismatches = [table for table, result in migration_snapshot["results"].items() if not result.get("match")]

    return {
        "status": validation.overall_status,
        "tables_checked": validation.total_tables,
        "tables_match": validation.tables_match,
        "tables_mismatch": validation.tables_mismatch,
        "mismatches": mismatches,
        "snapshot": migration_snapshot,
        "report": shadow_report,
    }


def build_campaign_report(
    *,
    pilot_school: School,
    peer_school: Optional[School],
    non_migrated_school: Optional[School],
    environment_guard: Dict[str, Any],
    steps: List[CampaignStepResult],
    benchmarks: List[CampaignBenchmark],
    backend_checks: Dict[str, Any],
    frontend_checks: Dict[str, Any],
    validation: Dict[str, Any],
    shadow_validation: Dict[str, Any],
    observability: Dict[str, Any],
    notes: Optional[List[str]] = None,
) -> StagingValidationCampaignReport:
    status = "pass"
    if any(step.status == "failed" for step in steps):
        status = "fail"
    elif any(step.status in {"blocked", "warning"} for step in steps):
        status = "partial"

    if validation.get("overall_status") not in {"pass", "partial"}:
        status = "fail"
    if shadow_validation.get("status") == "fail" or shadow_validation.get("mismatches"):
        status = "fail"
    if frontend_checks.get("success") is False and status == "pass":
        status = "partial"

    pilot_tenant = resolve_tenant_for_school(pilot_school)
    peer_tenant = resolve_tenant_for_school(peer_school) if peer_school else None
    non_migrated_tenant = resolve_tenant_for_school(non_migrated_school) if non_migrated_school else None

    return StagingValidationCampaignReport(
        started_at=timezone.now().isoformat(),
        completed_at=None,
        environment_guard=environment_guard,
        pilot_school={
            "id": pilot_school.id,
            "name": pilot_school.name,
            "code": pilot_school.code,
            "tenant": {
                "tenant_id": getattr(pilot_tenant, "tenant_id", None),
                "schema_name": getattr(pilot_tenant, "schema_name", None),
            },
        },
        peer_school={
            "id": getattr(peer_school, "id", None),
            "name": getattr(peer_school, "name", None),
            "code": getattr(peer_school, "code", None),
            "tenant": {
                "tenant_id": getattr(peer_tenant, "tenant_id", None),
                "schema_name": getattr(peer_tenant, "schema_name", None),
            },
        }
        if peer_school
        else {},
        non_migrated_school={
            "id": getattr(non_migrated_school, "id", None),
            "name": getattr(non_migrated_school, "name", None),
            "code": getattr(non_migrated_school, "code", None),
            "tenant": {
                "tenant_id": getattr(non_migrated_tenant, "tenant_id", None),
                "schema_name": getattr(non_migrated_tenant, "schema_name", None),
            },
        }
        if non_migrated_school
        else {},
        steps=[asdict(step) for step in steps],
        benchmarks=[asdict(benchmark) for benchmark in benchmarks],
        backend_checks=backend_checks,
        frontend_checks=frontend_checks,
        validation=validation,
        shadow_validation=shadow_validation,
        observability=observability,
        overall_status=status,
        notes=notes or [],
    )


def render_campaign_report(report: Dict[str, Any]) -> str:
    lines = []
    lines.append("# Phase 12 Controlled Staging Validation Campaign")
    lines.append("")
    lines.append(f"Status: {report.get('overall_status', 'unknown').upper()}")
    lines.append(f"Started at: {report.get('started_at', '')}")
    if report.get("completed_at"):
        lines.append(f"Completed at: {report['completed_at']}")
    lines.append("")

    lines.append("## Guard")
    guard = report.get("environment_guard", {})
    lines.append(f"- MULTI_TENANCY_ENABLED: {guard.get('enabled')}")
    lines.append(f"- DEBUG: {guard.get('debug')}")
    lines.append(f"- Staging flag: {guard.get('staging_flag')}")
    if guard.get("blockers"):
        for blocker in guard["blockers"]:
            lines.append(f"- Blocker: {blocker}")
    lines.append("")

    lines.append("## Pilot School")
    pilot = report.get("pilot_school", {})
    lines.append(f"- School: {pilot.get('name')} ({pilot.get('code')})")
    tenant = pilot.get("tenant", {})
    lines.append(f"- Tenant schema: {tenant.get('schema_name')}")
    lines.append(f"- Tenant ID: {tenant.get('tenant_id')}")
    lines.append("")

    peer = report.get("peer_school", {})
    if peer:
        lines.append("## Peer School")
        lines.append(f"- School: {peer.get('name')} ({peer.get('code')})")
        peer_tenant = peer.get("tenant", {})
        lines.append(f"- Tenant schema: {peer_tenant.get('schema_name')}")
        lines.append("")

    non_migrated = report.get("non_migrated_school", {})
    if non_migrated:
        lines.append("## Non-Migrated School")
        lines.append(f"- School: {non_migrated.get('name')} ({non_migrated.get('code')})")
        non_migrated_tenant = non_migrated.get("tenant", {})
        lines.append(f"- Tenant schema: {non_migrated_tenant.get('schema_name')}")
        lines.append("")

    lines.append("## Validation")
    validation = report.get("validation", {})
    lines.append(f"- Overall status: {validation.get('overall_status')}")
    lines.append(f"- Tables checked: {validation.get('total_tables')}")
    lines.append(f"- Tables matched: {validation.get('tables_match')}")
    lines.append(f"- Tables mismatched: {validation.get('tables_mismatch')}")
    lines.append("")

    lines.append("## Shadow Validation")
    shadow = report.get("shadow_validation", {})
    lines.append(f"- Status: {shadow.get('status')}")
    if shadow.get("mismatches"):
        lines.append(f"- Mismatches: {', '.join(shadow['mismatches'])}")
    lines.append("")

    lines.append("## Benchmarks")
    for benchmark in report.get("benchmarks", []):
        lines.append(f"- {benchmark.get('name')}: {benchmark.get('duration_ms')} ms")
    lines.append("")

    lines.append("## Backend Checks")
    for name, result in report.get("backend_checks", {}).items():
        lines.append(f"- {name}: {'PASS' if result.get('success') else 'FAIL'} ({result.get('duration_ms')} ms)")
    lines.append("")

    lines.append("## Frontend Checks")
    frontend = report.get("frontend_checks", {})
    lines.append(f"- Success: {frontend.get('success')}")
    lines.append(f"- Duration: {frontend.get('duration_ms')} ms")
    lines.append("")

    lines.append("## Observability")
    observability = report.get("observability", {})
    lines.append(f"- Total events: {observability.get('total_events')}")
    lines.append(f"- Error count: {observability.get('error_count')}")
    lines.append("")

    lines.append("## Steps")
    for step in report.get("steps", []):
        lines.append(f"- {step.get('name')}: {step.get('status')} ({step.get('duration_ms')} ms)")

    if report.get("notes"):
        lines.append("")
        lines.append("## Notes")
        for note in report["notes"]:
            lines.append(f"- {note}")

    return "\n".join(lines).strip() + "\n"


def run_staging_validation_campaign(
    *,
    pilot_school_id: Optional[int] = None,
    confirm_real_migration: bool = False,
    frontend_dir: Optional[Path] = None,
    backend_dir: Optional[Path] = None,
    export_path: Optional[Path] = None,
) -> StagingValidationCampaignReport:
    guard = validate_campaign_guard()
    if not guard["staging_ready"]:
        raise RuntimeError("Staging validation guard failed: " + "; ".join(guard["blockers"]))

    pilot_school = select_pilot_school(pilot_school_id)
    peer_school = select_peer_school(pilot_school.id)
    non_migrated_school = select_non_migrated_school({pilot_school.id, getattr(peer_school, "id", -1)})

    if peer_school is None:
        raise RuntimeError("At least two active schools are required to validate cross-tenant isolation.")
    if non_migrated_school is None:
        raise RuntimeError("A third active school is required to validate hybrid runtime against a non-migrated control school.")

    pilot_tenant = resolve_tenant_for_school(pilot_school)
    if pilot_tenant is None or not pilot_tenant.schema_name:
        raise RuntimeError(f"No tenant mapping found for pilot school {pilot_school.code}.")

    peer_tenant = resolve_tenant_for_school(peer_school)
    if peer_tenant is None or not peer_tenant.schema_name:
        raise RuntimeError(f"No tenant mapping found for peer school {peer_school.code}.")

    backend_dir = backend_dir or Path(settings.BASE_DIR)
    frontend_dir = frontend_dir or (Path(settings.BASE_DIR).parent / "frontend")

    observer = get_observer()
    steps: List[CampaignStepResult] = []
    benchmarks: List[CampaignBenchmark] = []
    backend_checks: Dict[str, Any] = {}
    frontend_checks: Dict[str, Any] = {"success": False, "duration_ms": 0, "command": "", "stdout": "", "stderr": ""}
    notes: List[str] = []

    def add_step(name: str, status: str, duration_ms: int, summary: str, details: Optional[Dict[str, Any]] = None) -> None:
        steps.append(
            CampaignStepResult(
                name=name,
                status=status,
                duration_ms=duration_ms,
                summary=summary,
                details=details or {},
            )
        )

    readiness_start = time.perf_counter()
    readiness_report = validate_tenancy_configuration()
    readiness_duration = int((time.perf_counter() - readiness_start) * 1000)
    add_step(
        "readiness_check",
        "passed" if not readiness_report.get("errors") else "warning",
        readiness_duration,
        "Validated tenancy readiness and staging activation constraints.",
        {"report": readiness_report},
    )

    dry_run_start = time.perf_counter()
    dry_run_audit = migration_framework.migrate_school_to_tenant(
        school_id=pilot_school.id,
        tenant_id=pilot_tenant.tenant_id,
        schema_name=pilot_tenant.schema_name,
        dry_run=True,
    )
    dry_run_duration = int((time.perf_counter() - dry_run_start) * 1000)
    add_step(
        "dry_run_migration",
        dry_run_audit.status,
        dry_run_duration,
        "Captured source row counts without mutating the tenant schema.",
        {"audit_id": dry_run_audit.id, "tables": dry_run_audit.details.get("tables", {})},
    )
    benchmarks.append(CampaignBenchmark("dry_run_migration", dry_run_duration, {"school_id": pilot_school.id}))

    if confirm_real_migration:
        real_start = time.perf_counter()
        real_migration_audit = migration_framework.migrate_school_to_tenant(
            school_id=pilot_school.id,
            tenant_id=pilot_tenant.tenant_id,
            schema_name=pilot_tenant.schema_name,
            dry_run=False,
        )
        real_duration = int((time.perf_counter() - real_start) * 1000)
        add_step(
            "real_migration",
            real_migration_audit.status,
            real_duration,
            "Copied pilot school data into the tenant schema.",
            {"audit_id": real_migration_audit.id, "tables": real_migration_audit.details.get("tables", {})},
        )
        benchmarks.append(CampaignBenchmark("real_migration", real_duration, {"school_id": pilot_school.id}))
    else:
        add_step(
            "real_migration",
            "blocked",
            0,
            "Real migration was skipped because confirmation was not provided.",
            {"required_env": CONFIRM_ENV},
        )
        notes.append(f"Set {CONFIRM_ENV}=true to allow the real migration, rollback, and re-migration sequence.")

    validation = migration_framework.validate_migration(pilot_school.id, pilot_tenant.schema_name)
    shadow_validation = run_shadow_validation(pilot_school.id, pilot_tenant.schema_name)

    validation_start = time.perf_counter()
    validation_detail = validate_migration_completeness(
        pilot_school.id,
        pilot_tenant.schema_name,
        migration_framework.get_migration_tables(),
    )
    validation_duration = int((time.perf_counter() - validation_start) * 1000)
    add_step(
        "shadow_validation",
        shadow_validation["status"],
        validation_duration,
        "Compared monolithic and tenant responses for the pilot school.",
        {"report": shadow_validation["report"], "tables": validation_detail.table_results},
    )
    benchmarks.append(CampaignBenchmark("shadow_validation", validation_duration, {"school_id": pilot_school.id}))

    schema_latency = measure_schema_switch_latency(pilot_tenant.schema_name)
    benchmarks.append(schema_latency)
    add_step(
        "schema_switch_benchmark",
        "passed",
        schema_latency.duration_ms,
        "Measured search_path switching overhead for the pilot tenant schema.",
        schema_latency.details,
    )

    backend_commands = [
        ("test_tenant_auth", []),
        ("test_phase10", []),
        (
            "validate_tenant_isolation",
            [
                "--schema1",
                pilot_tenant.schema_name,
                "--schema2",
                peer_tenant.schema_name,
                "--school1",
                str(pilot_school.id),
                "--school2",
                str(peer_school.id),
            ],
        ),
        (
            "validate_hybrid_runtime",
            ["--migrated-school-id", str(pilot_school.id), "--non-migrated-school-id", str(non_migrated_school.id)],
        ),
    ]
    for command_name, extra_args in backend_commands:
        result = run_backend_command(command_name, backend_dir, extra_args)
        backend_checks[command_name] = result
        add_step(
            command_name,
            "passed" if result["success"] else "failed",
            result["duration_ms"],
            f"Executed {command_name}.",
            result,
        )
        benchmarks.append(CampaignBenchmark(command_name, result["duration_ms"], {"returncode": result["returncode"]}))

    if frontend_dir.exists():
        frontend_checks = run_frontend_tests(frontend_dir)
        add_step(
            "frontend_compatibility",
            "passed" if frontend_checks["success"] else "failed",
            frontend_checks["duration_ms"],
            "Executed the frontend Jest suite as a compatibility smoke test.",
            frontend_checks,
        )
        benchmarks.append(CampaignBenchmark("frontend_compatibility", frontend_checks["duration_ms"], {"returncode": frontend_checks["returncode"]}))
    else:
        frontend_checks = {
            "success": False,
            "duration_ms": 0,
            "command": "",
            "stdout": "",
            "stderr": f"Frontend directory not found: {frontend_dir}",
            "returncode": 1,
        }
        add_step(
            "frontend_compatibility",
            "blocked",
            0,
            "Frontend compatibility tests were skipped because the frontend directory was not found.",
            frontend_checks,
        )
        notes.append(f"Frontend directory not found at {frontend_dir}.")

    if confirm_real_migration:
        rollback_start = time.perf_counter()
        rollback_audit = migration_framework.rollback_migration(pilot_school.id, pilot_tenant.schema_name)
        rollback_duration = int((time.perf_counter() - rollback_start) * 1000)
        add_step(
            "rollback_migration",
            rollback_audit.status,
            rollback_duration,
            "Removed tenant-side rows while preserving the source schema.",
            {"audit_id": rollback_audit.id, "tables": rollback_audit.details.get("tables", {})},
        )
        benchmarks.append(CampaignBenchmark("rollback_migration", rollback_duration, {"school_id": pilot_school.id}))

        remigrate_start = time.perf_counter()
        remigration_audit = migration_framework.migrate_school_to_tenant(
            school_id=pilot_school.id,
            tenant_id=pilot_tenant.tenant_id,
            schema_name=pilot_tenant.schema_name,
            dry_run=False,
        )
        remigration_duration = int((time.perf_counter() - remigrate_start) * 1000)
        add_step(
            "re_migration",
            remigration_audit.status,
            remigration_duration,
            "Re-ran the migration after rollback to confirm the flow remains safe.",
            {"audit_id": remigration_audit.id, "tables": remigration_audit.details.get("tables", {})},
        )
        benchmarks.append(CampaignBenchmark("re_migration", remigration_duration, {"school_id": pilot_school.id}))
    else:
        add_step(
            "rollback_migration",
            "blocked",
            0,
            "Rollback validation was skipped because real migration confirmation was not provided.",
            {"required_env": CONFIRM_ENV},
        )
        add_step(
            "re_migration",
            "blocked",
            0,
            "Re-migration validation was skipped because rollback did not run.",
            {"required_env": CONFIRM_ENV},
        )

    final_validation = migration_framework.validate_migration(pilot_school.id, pilot_tenant.schema_name)
    validation["post_campaign"] = final_validation

    observability_summary = observer.get_summary()

    report = build_campaign_report(
        pilot_school=pilot_school,
        peer_school=peer_school,
        non_migrated_school=non_migrated_school,
        environment_guard=guard,
        steps=steps,
        benchmarks=benchmarks,
        backend_checks=backend_checks,
        frontend_checks=frontend_checks,
        validation=validation,
        shadow_validation=shadow_validation,
        observability=observability_summary,
        notes=notes,
    )
    report.completed_at = timezone.now().isoformat()

    if export_path:
        report.export(export_path)

    return report