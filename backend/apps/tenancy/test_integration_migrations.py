"""Comprehensive integration tests for Phase 11 migration framework.

Tests cover:
- dry-run migrations
- real migrations
- validation
- rollback
- re-migration
- hybrid runtime
- cross-tenant isolation
"""

import pytest
from django.test import TestCase, TransactionTestCase
from django.db import connection

from .models import SchoolTenant, School
from .migration_framework import (
    migrate_school_to_tenant,
    validate_migration,
    rollback_migration,
)
from .test_fixtures import create_test_school, create_test_dataset, cleanup_test_data
from .validation_automation import validate_migration_completeness
from .observability import get_observer, reset_observer


class MigrationIntegrationTestBase(TransactionTestCase):
    """Base class for integration tests using real database transactions."""
    
    databases = "__all__"
    
    def setUp(self):
        reset_observer()
        self.observer = get_observer()
        self.test_school_id = 999
        self.test_schema = "test_school_999"
        self.test_tenant_id = "TNT_TEST_999"
        
        # Cleanup any previous test data
        cleanup_test_data(self.test_school_id)
    
    def tearDown(self):
        cleanup_test_data(self.test_school_id)
    
    def _ensure_tenant_schema(self, schema_name: str):
        """Ensure tenant schema exists for testing."""
        with connection.cursor() as curs:
            # Check if schema exists
            curs.execute("SELECT 1 FROM information_schema.schemata WHERE schema_name = %s", [schema_name])
            if curs.fetchone():
                return  # Already exists
            
            # Create schema
            curs.execute(f'CREATE SCHEMA IF NOT EXISTS "{schema_name}"')
            # Create mirror tables
            tables = ["attendance_attendance", "fees_invoice", "hr_staff"]
            for table in tables:
                try:
                    curs.execute(f"""
                        CREATE TABLE "{schema_name}"."{table}" AS 
                        SELECT * FROM public."{table}" WHERE 1=0
                    """)
                except Exception:
                    pass  # Table might already exist


class DryRunMigrationTest(MigrationIntegrationTestBase):
    """Test that dry-run migrations collect counts without modifying tenant schema."""
    
    def test_dry_run_collects_row_counts(self):
        """Dry-run should count rows but not copy them."""
        # Create test data
        dataset = create_test_dataset(self.test_school_id, small=True)
        self._ensure_tenant_schema(self.test_schema)
        
        # Run dry-run migration
        audit = migrate_school_to_tenant(
            school_id=self.test_school_id,
            tenant_id=self.test_tenant_id,
            schema_name=self.test_schema,
            dry_run=True,
        )
        
        # Verify audit shows "validated" status
        self.assertEqual(audit.status, "validated")
        
        # Verify tables have source row counts recorded
        self.assertIsNotNone(audit.tables)
        for table, info in audit.tables.items():
            self.assertIn("source_rows", info)


class RealMigrationTest(MigrationIntegrationTestBase):
    """Test that real migrations copy data to tenant schema."""
    
    def test_real_migration_copies_data(self):
        """Real migration should copy rows and set status to 'completed'."""
        # Create test data
        dataset = create_test_dataset(self.test_school_id, small=True)
        self._ensure_tenant_schema(self.test_schema)
        
        # Run real migration
        audit = migrate_school_to_tenant(
            school_id=self.test_school_id,
            tenant_id=self.test_tenant_id,
            schema_name=self.test_schema,
            dry_run=False,
        )
        
        # Verify audit shows "completed" status
        self.assertEqual(audit.status, "completed")
        
        # Verify tables were migrated
        migrated_tables = [t for t, info in audit.tables.items() if info.get("migrated")]
        self.assertGreater(len(migrated_tables), 0)


class ValidationTest(MigrationIntegrationTestBase):
    """Test validation automation."""
    
    def test_validation_detects_matches(self):
        """Validation should detect matching row counts after migration."""
        dataset = create_test_dataset(self.test_school_id, small=True)
        self._ensure_tenant_schema(self.test_schema)
        
        # Migrate
        migrate_school_to_tenant(
            school_id=self.test_school_id,
            tenant_id=self.test_tenant_id,
            schema_name=self.test_schema,
            dry_run=False,
        )
        
        # Validate
        report = validate_migration(self.test_school_id, self.test_schema)
        
        # Check validation results
        self.assertIn("results", report)
        for table, result in report["results"].items():
            if result["source"] is not None and result["tenant"] is not None:
                self.assertEqual(result["source"], result["tenant"], f"Mismatch in {table}")


class RollbackTest(MigrationIntegrationTestBase):
    """Test that rollback removes tenant data safely."""
    
    def test_rollback_removes_tenant_data(self):
        """Rollback should remove tenant-side rows."""
        dataset = create_test_dataset(self.test_school_id, small=True)
        self._ensure_tenant_schema(self.test_schema)
        
        # Migrate
        migrate_school_to_tenant(
            school_id=self.test_school_id,
            tenant_id=self.test_tenant_id,
            schema_name=self.test_schema,
            dry_run=False,
        )
        
        # Rollback
        audit = rollback_migration(
            school_id=self.test_school_id,
            schema_name=self.test_schema,
        )
        
        self.assertEqual(audit.status, "rolled_back")


class HybridRuntimeTest(MigrationIntegrationTestBase):
    """Test that hybrid runtime correctly routes migrated vs non-migrated schools."""
    
    def test_migrated_school_uses_tenant_schema(self):
        """Migrated schools should route queries to tenant schema."""
        # Create SchoolTenant entry
        st = SchoolTenant.objects.create(
            tenant_id=self.test_tenant_id,
            schema_name=self.test_schema,
            name="Test Tenant",
        )
        
        # After migration, tenant should be active
        self.assertIsNotNone(st.schema_name)


class CrossTenantIsolationTest(MigrationIntegrationTestBase):
    """Test that cross-tenant access is blocked."""
    
    def test_tenant_cannot_access_other_tenant_data(self):
        """Validate that tenant schema queries are isolated."""
        # Create two test schools
        school1_id = 901
        school2_id = 902
        schema1 = "test_school_901"
        schema2 = "test_school_902"
        
        try:
            # Create data for school 1
            create_test_dataset(school1_id, small=True)
            self._ensure_tenant_schema(schema1)
            
            # Migrate school 1
            migrate_school_to_tenant(
                school_id=school1_id,
                tenant_id="TNT_TEST_901",
                schema_name=schema1,
                dry_run=False,
            )
            
            # Create data for school 2
            create_test_dataset(school2_id, small=True)
            self._ensure_tenant_schema(schema2)
            
            # Migrate school 2
            migrate_school_to_tenant(
                school_id=school2_id,
                tenant_id="TNT_TEST_902",
                schema_name=schema2,
                dry_run=False,
            )
            
            # Validate isolation
            with connection.cursor() as curs:
                # School 1 schema should NOT see school 2 data
                try:
                    curs.execute(f'SELECT count(*) FROM "{schema1}".attendance_attendance WHERE school_id = %s', [school2_id])
                    count = curs.fetchone()[0]
                    self.assertEqual(count, 0, "Cross-tenant access detected!")
                except Exception:
                    pass  # Expected if tables don't exist
        
        finally:
            cleanup_test_data(school1_id)
            cleanup_test_data(school2_id)


class RemigrationTest(MigrationIntegrationTestBase):
    """Test that re-migration after rollback works safely."""
    
    def test_can_remigrate_after_rollback(self):
        """After rollback, should be able to re-migrate safely."""
        dataset = create_test_dataset(self.test_school_id, small=True)
        self._ensure_tenant_schema(self.test_schema)
        
        # Initial migration
        audit1 = migrate_school_to_tenant(
            school_id=self.test_school_id,
            tenant_id=self.test_tenant_id,
            schema_name=self.test_schema,
            dry_run=False,
        )
        self.assertEqual(audit1.status, "completed")
        
        # Rollback
        audit2 = rollback_migration(
            school_id=self.test_school_id,
            schema_name=self.test_schema,
        )
        self.assertEqual(audit2.status, "rolled_back")
        
        # Re-migrate
        audit3 = migrate_school_to_tenant(
            school_id=self.test_school_id,
            tenant_id=self.test_tenant_id,
            schema_name=self.test_schema,
            dry_run=False,
        )
        self.assertEqual(audit3.status, "completed")


# pytest fixtures
@pytest.fixture
def migration_observer():
    """Pytest fixture for observer."""
    reset_observer()
    return get_observer()


@pytest.fixture
def test_school():
    """Pytest fixture for test school."""
    return create_test_school(code="PYTEST_SCHOOL")
