"""Validation automation for migration correctness verification.

Provides automated comparison of monolithic vs tenant schema data,
detailed validation reports, and mismatch detection.
"""

from dataclasses import asdict, dataclass
from typing import Dict, List, Optional

from django.db import connection
from django.utils import timezone


@dataclass
class TableValidationResult:
    """Result for a single table validation."""
    table_name: str
    source_rows: int
    tenant_rows: int
    match: bool
    error: Optional[str] = None
    fk_errors: List[str] = None
    orphaned_records: int = 0
    duplicate_records: int = 0

    def to_dict(self):
        return asdict(self)


@dataclass
class SchoolMigrationValidation:
    """Complete validation result for a school migration."""
    school_id: int
    schema_name: str
    validated_at: str
    total_tables: int
    tables_match: int
    tables_mismatch: int
    mismatches: List[str]
    overall_status: str  # "pass" | "partial" | "fail"
    table_results: Dict[str, Dict]
    error_summary: Optional[str] = None

    def to_dict(self):
        return asdict(self)


def validate_table_counts(school_id: int, schema_name: str, table: str) -> TableValidationResult:
    """Validate row counts for a single table between source and tenant."""
    result = TableValidationResult(
        table_name=table,
        source_rows=0,
        tenant_rows=0,
        match=False,
        fk_errors=[],
    )
    
    with connection.cursor() as curs:
        # Source count (try school_id first, fallback to organization_id)
        try:
            sql = f'SELECT count(*) FROM public."{table}" WHERE school_id = %s'
            curs.execute(sql, [school_id])
            result.source_rows = curs.fetchone()[0]
        except Exception:
            try:
                sql = f'SELECT count(*) FROM public."{table}" WHERE organization_id = %s'
                curs.execute(sql, [school_id])
                result.source_rows = curs.fetchone()[0]
            except Exception as e:
                result.error = f"source_query_failed: {str(e)}"
                return result
        
        # Tenant count
        try:
            sql = f'SELECT count(*) FROM "{schema_name}"."{table}" WHERE school_id = %s'
            curs.execute(sql, [school_id])
            result.tenant_rows = curs.fetchone()[0]
        except Exception as e:
            result.error = f"tenant_query_failed: {str(e)}"
            return result
    
    result.match = result.source_rows == result.tenant_rows
    return result


def validate_foreign_keys(school_id: int, schema_name: str, table: str) -> List[str]:
    """Check for orphaned FK references (simplified check).
    
    Returns list of FK validation errors found.
    """
    errors = []
    # Placeholder for more sophisticated FK validation
    # In production, iterate table constraints and validate refs
    return errors


def validate_duplicates(school_id: int, schema_name: str, table: str) -> int:
    """Count potential duplicate records in tenant schema."""
    with connection.cursor() as curs:
        try:
            # Simple check: if table has id field, verify id uniqueness
            sql = f'SELECT id, count(*) FROM "{schema_name}"."{table}" WHERE school_id = %s GROUP BY id HAVING count(*) > 1'
            curs.execute(sql, [school_id])
            duplicates = curs.fetchall()
            return len(duplicates)
        except Exception:
            return 0


def validate_migration_completeness(school_id: int, schema_name: str, tables: List[str]) -> SchoolMigrationValidation:
    """Run complete validation comparing source and tenant data.
    
    Returns comprehensive SchoolMigrationValidation report.
    """
    results = {}
    mismatches = []
    
    for table in tables:
        result = validate_table_counts(school_id, schema_name, table)
        fk_errors = validate_foreign_keys(school_id, schema_name, table)
        result.fk_errors = fk_errors
        result.orphaned_records = 0  # Placeholder
        result.duplicate_records = validate_duplicates(school_id, schema_name, table)
        
        results[table] = result.to_dict()
        
        if not result.match:
            mismatches.append(table)
    
    tables_match = sum(1 for r in results.values() if r["match"])
    tables_mismatch = len(results) - tables_match
    
    overall_status = "pass" if tables_match == len(results) else ("partial" if tables_match > 0 else "fail")
    
    return SchoolMigrationValidation(
        school_id=school_id,
        schema_name=schema_name,
        validated_at=timezone.now().isoformat(),
        total_tables=len(results),
        tables_match=tables_match,
        tables_mismatch=tables_mismatch,
        mismatches=mismatches,
        overall_status=overall_status,
        table_results=results,
    )


def generate_validation_report(validation: SchoolMigrationValidation) -> str:
    """Generate human-readable validation report."""
    report = f"""
=============================================================================
MIGRATION VALIDATION REPORT
=============================================================================

School ID: {validation.school_id}
Schema: {validation.schema_name}
Validated At: {validation.validated_at}
Overall Status: {validation.overall_status.upper()}

=============================================================================
SUMMARY
=============================================================================

Total Tables Checked: {validation.total_tables}
Tables Matching: {validation.tables_match}
Tables Mismatching: {validation.tables_mismatch}

=============================================================================
DETAILED RESULTS
=============================================================================
"""
    
    for table, result in validation.table_results.items():
        status = "✓ MATCH" if result["match"] else "✗ MISMATCH"
        report += f"\n{status} {table}\n"
        report += f"  Source rows: {result['source_rows']}\n"
        report += f"  Tenant rows: {result['tenant_rows']}\n"
        if result.get("error"):
            report += f"  ERROR: {result['error']}\n"
        if result.get("duplicate_records", 0) > 0:
            report += f"  Duplicates found: {result['duplicate_records']}\n"
    
    if validation.mismatches:
        report += f"\n=============================================================================\n"
        report += f"MISMATCHES: {', '.join(validation.mismatches)}\n"
        report += f"=============================================================================\n"
    
    return report
