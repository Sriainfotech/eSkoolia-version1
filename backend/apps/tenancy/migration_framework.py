import logging
import time
from typing import Dict, List

from django.conf import settings
from django.db import connection, transaction
from django.utils import timezone

from .models import TenantAuditLog, School, SchoolTenant

logger = logging.getLogger(__name__)


DEFAULT_MIGRATION_TABLES = [
    # Common tables using school_id / organization_id
    "students_student",
    "attendance_attendance",
    "fees_invoice",
    "hr_staff",
    "academics_homework",
    "transport_route",
    "library_book",
    "inventory_item",
    "exams_result",
    "timetable_entry",
    "hostel_booking",
    "payroll_payrun",
]


def get_migration_tables() -> List[str]:
    return getattr(settings, "TENANT_MIGRATION_TABLES", DEFAULT_MIGRATION_TABLES)


def _create_audit_entry(school_id: int, tenant_id: str = None, schema_name: str = None, actor=None) -> TenantAuditLog:
    entry = TenantAuditLog.objects.create(
        tenant_id=tenant_id,
        schema_name=schema_name,
        action="migration_start",
        status="pending",
        actor_user_id=getattr(actor, "id", None) if actor else None,
        actor_username=getattr(actor, "username", "") if actor else "",
        details={"school_id": school_id, "checkpoint": "", "tables": {}, "validation": {}},
    )
    return entry


def _update_audit(audit: TenantAuditLog, **kwargs) -> None:
    for k, v in kwargs.items():
        if k in ["checkpoint", "tables", "validation"]:
            # Store migration-specific data in details JSON
            if "details" not in kwargs:
                audit.details = audit.details or {}
            audit.details[k] = v
        else:
            setattr(audit, k, v)
    audit.updated_at = timezone.now()
    audit.save()


def _count_rows_in_table(table: str, school_id: int) -> int:
    with connection.cursor() as curs:
        # Try both school_id and organization_id columns
        sql = f"SELECT count(*) FROM public.\"{table}\" WHERE school_id = %s"
        try:
            curs.execute(sql, [school_id])
            return curs.fetchone()[0]
        except Exception:
            # fallback to organization_id
            try:
                sql2 = f"SELECT count(*) FROM public.\"{table}\" WHERE organization_id = %s"
                curs.execute(sql2, [school_id])
                return curs.fetchone()[0]
            except Exception:
                return 0


def _ensure_tenant_schema_exists(schema_name: str) -> bool:
    """Check if tenant schema exists. Returns True if exists."""
    with connection.cursor() as curs:
        curs.execute("SELECT schema_name FROM information_schema.schemata WHERE schema_name = %s", [schema_name])
        return curs.fetchone() is not None


def _copy_table_to_schema(table: str, school_id: int, target_schema: str) -> Dict:
    """Copy rows matching school_id from public.table to target_schema.table.

    Preserves all columns by selecting the same column list. Returns dict with row counts.
    """
    result = {"table": table, "rows": 0, "migrated": False, "error": None}
    with connection.cursor() as curs:
        # discover columns for table
        curs.execute(
            "SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=%s ORDER BY ordinal_position",
            [table],
        )
        cols = [row[0] for row in curs.fetchall()]
        if not cols:
            result["error"] = "table_not_found"
            return result

        col_list = ",".join([f'"{c}"' for c in cols])
        # Build SQL: INSERT INTO target_schema.table (cols) SELECT cols FROM public.table WHERE school_id=%s
        insert_sql = f"INSERT INTO \"{target_schema}\".\"{table}\" ({col_list}) SELECT {col_list} FROM public.\"{table}\" WHERE school_id = %s"
        try:
            curs.execute("BEGIN")
            curs.execute(insert_sql, [school_id])
            # rowcount may be -1 depending on DB driver; fetch count explicitly
            curs.execute(f"SELECT count(*) FROM \"{target_schema}\".\"{table}\" WHERE school_id = %s", [school_id])
            migrated = curs.fetchone()[0]
            result["rows"] = migrated
            result["migrated"] = True
            curs.execute("COMMIT")
        except Exception as e:
            try:
                curs.execute("ROLLBACK")
            except Exception:
                pass
            result["error"] = str(e)
            logger.exception("Error copying table %s to schema %s", table, target_schema)
    return result


def migrate_school_to_tenant(school_id: int, tenant_id: str, schema_name: str, dry_run: bool = True, actor=None) -> TenantAuditLog:
    """High-level migration runner.

    - dry_run: collects counts and reports that would be migrated
    - resumable via TenantAuditLog.details["checkpoint"]
    - writes audit entries to TenantAuditLog
    """
    audit = _create_audit_entry(school_id=school_id, tenant_id=tenant_id, schema_name=schema_name, actor=actor)
    tables = get_migration_tables()
    audit_tables = {}

    if not _ensure_tenant_schema_exists(schema_name):
        _update_audit(audit, status="failed", error=f"schema_missing:{schema_name}")
        return audit

    _update_audit(audit, status="in_progress")

    for table in tables:
        audit.checkpoint = table
        audit.save()

        count = _count_rows_in_table(table, school_id)
        audit_tables[table] = {"source_rows": count, "migrated": False}
        _update_audit(audit, tables=audit_tables, checkpoint=table)

        if dry_run:
            # only record counts
            continue

        # perform copy
        res = _copy_table_to_schema(table, school_id, schema_name)
        audit_tables[table].update(res)
        _update_audit(audit, tables=audit_tables)

        if res.get("error"):
            _update_audit(audit, status="failed", error=res.get("error"))
            return audit

    # finished
    _update_audit(audit, status=("validated" if dry_run else "completed"), completed_at=timezone.now(), tables=audit_tables)
    return audit


def validate_migration(school_id: int, schema_name: str) -> Dict:
    """Dual-read validation comparing public vs tenant schema counts per table.

    Returns validation summary with mismatches.
    """
    tables = get_migration_tables()
    summary = {"school_id": school_id, "schema": schema_name, "checked_at": timezone.now().isoformat(), "results": {}}
    with connection.cursor() as curs:
        for table in tables:
            # source count
            try:
                curs.execute(f"SELECT count(*) FROM public.\"{table}\" WHERE school_id = %s", [school_id])
                src = curs.fetchone()[0]
            except Exception:
                # try organization_id
                try:
                    curs.execute(f"SELECT count(*) FROM public.\"{table}\" WHERE organization_id = %s", [school_id])
                    src = curs.fetchone()[0]
                except Exception:
                    src = None

            # tenant count
            try:
                curs.execute(f"SELECT count(*) FROM \"{schema_name}\".\"{table}\" WHERE school_id = %s", [school_id])
                tgt = curs.fetchone()[0]
            except Exception:
                tgt = None

            summary["results"][table] = {"source": src, "tenant": tgt, "match": src == tgt}

    return summary


def rollback_migration(school_id: int, schema_name: str, actor=None) -> TenantAuditLog:
    """Rollback by deleting migrated rows from tenant schema for the given school_id.

    This intentionally does not touch the monolithic source. The operation
    is transactional per-table and recorded in TenantAuditLog.
    """
    # Create audit
    audit = TenantAuditLog.objects.create(
        schema_name=schema_name,
        action="rollback_start",
        status="in_progress",
        actor_user_id=getattr(actor, "id", None) if actor else None,
        actor_username=getattr(actor, "username", "") if actor else "",
        details={"school_id": school_id, "tables": {}}
    )
    tables = get_migration_tables()
    tables_outcome = {}
    for table in tables:
        try:
            with connection.cursor() as curs:
                curs.execute("BEGIN")
                # Delete tenant rows matching school_id (attempt both column variants)
                try:
                    curs.execute(f"DELETE FROM \"{schema_name}\".\"{table}\" WHERE school_id = %s RETURNING count(*)", [school_id])
                except Exception:
                    try:
                        curs.execute(f"DELETE FROM \"{schema_name}\".\"{table}\" WHERE organization_id = %s RETURNING count(*)", [school_id])
                    except Exception:
                        curs.execute("ROLLBACK")
                        tables_outcome[table] = {"deleted": 0, "error": "no_column_or_table"}
                        continue
                # best-effort count via select
                curs.execute(f"SELECT count(*) FROM \"{schema_name}\".\"{table}\" WHERE school_id = %s", [school_id])
                remaining = curs.fetchone()[0]
                curs.execute("COMMIT")
                tables_outcome[table] = {"deleted_remaining": remaining, "error": None}
        except Exception as e:
            tables_outcome[table] = {"deleted_remaining": None, "error": str(e)}
    audit.tables = tables_outcome
    audit.status = "rolled_back"
    audit.completed_at = timezone.now()
    audit.save()
    return audit
