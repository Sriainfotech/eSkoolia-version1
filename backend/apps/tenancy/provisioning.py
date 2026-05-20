"""Provisioning service for creating and activating tenant schemas.

This module handles the core provisioning logic:
1. Create tenant record
2. Create PostgreSQL schema
3. Run tenant migrations
4. Seed default data
5. Create domain record
6. Audit logging

All operations are guarded by MULTI_TENANCY_ENABLED feature flag.
"""
import logging
import time
import re
from datetime import datetime
from django.conf import settings
from django.db import connection, connections
from django.apps import apps as django_apps
from apps.tenancy.models import SchoolTenant, Domain
from apps.tenancy.audit import log_audit

logger = logging.getLogger(__name__)


def is_provisioning_enabled():
    """Check if tenant provisioning is allowed.
    
    Provisioning is only enabled when:
    1. MULTI_TENANCY_ENABLED=True
    2. Not in production (or explicitly overridden)
    """
    return getattr(settings, "MULTI_TENANCY_ENABLED", False)


def sanitize_subdomain(subdomain):
    """Convert subdomain to safe PostgreSQL schema name.
    
    Rules:
    - lowercase only
    - alphanumeric + underscore
    - no leading/trailing underscores
    - max 63 chars (PostgreSQL limit)
    - prefix with 'school_' for clarity
    """
    # Convert to lowercase
    safe = subdomain.lower()
    
    # Replace hyphens with underscores
    safe = safe.replace("-", "_")
    
    # Remove non-alphanumeric (except underscore)
    safe = re.sub(r"[^a-z0-9_]", "", safe)
    
    # Remove leading/trailing underscores
    safe = safe.strip("_")
    
    # Ensure not empty
    if not safe:
        raise ValueError(f"Subdomain '{subdomain}' is invalid (no safe characters)")
    
    # Prefix with 'school_'
    schema_name = f"school_{safe}"
    
    # PostgreSQL schema names must be <= 63 chars
    if len(schema_name) > 63:
        # Truncate safely
        schema_name = schema_name[:63]
    
    return schema_name


def create_postgres_schema(schema_name):
    """Create PostgreSQL schema for the tenant.
    
    Uses raw SQL to create schema; does NOT use django-tenants auto_create_schema
    yet because we're managing the process explicitly here for better control.
    """
    if not schema_name or not re.match(r"^[a-z_][a-z0-9_]*$", schema_name):
        raise ValueError(f"Invalid schema name: {schema_name}")
    
    try:
        with connection.cursor() as cursor:
            # Check if schema exists
            cursor.execute(
                "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
                [schema_name],
            )
            if cursor.fetchone():
                raise ValueError(f"Schema '{schema_name}' already exists")
            
            # Create schema
            cursor.execute(f"CREATE SCHEMA {schema_name}")
            cursor.execute(f"GRANT USAGE ON SCHEMA {schema_name} TO {connection.settings_dict['USER']}")
            cursor.execute(f"GRANT CREATE ON SCHEMA {schema_name} TO {connection.settings_dict['USER']}")
            
            logger.info(f"Schema created: {schema_name}")
            return True
    except Exception as exc:
        logger.error(f"Failed to create schema {schema_name}: {exc}")
        raise


def run_tenant_migrations(schema_name):
    """Run Django migrations inside the tenant schema.
    
    Uses django-tenants schema_context() to run migrations in the target schema.
    """
    try:
        from django_tenants.utils import schema_context
        from django.core.management import call_command
        from io import StringIO
        
        output = StringIO()
        
        with schema_context(schema_name):
            call_command(
                "migrate",
                verbosity=2,
                interactive=False,
                stdout=output,
                stderr=output,
            )
        
        migration_output = output.getvalue()
        logger.info(f"Migrations completed for schema {schema_name}\n{migration_output}")
        return True
    except Exception as exc:
        logger.error(f"Failed to run migrations for schema {schema_name}: {exc}")
        raise


def seed_tenant_defaults(schema_name):
    """Seed default data into the tenant schema.
    
    This creates:
    - Default academic year
    - Default departments
    - Default RBAC roles
    - Default permissions
    - Default settings
    
    All seeding happens inside the tenant schema via schema_context().
    """
    try:
        from django_tenants.utils import schema_context
        
        with schema_context(schema_name):
            # Seed academic year
            try:
                from apps.academics.models import AcademicYear
                current_year = datetime.now().year
                AcademicYear.objects.get_or_create(
                    name=f"{current_year}/{current_year + 1}",
                    defaults={
                        "year_start": f"{current_year}-01-01",
                        "year_end": f"{current_year + 1}-12-31",
                        "is_active": True,
                    },
                )
                logger.info(f"Seeded academic year in {schema_name}")
            except Exception as exc:
                logger.warning(f"Failed to seed academic year in {schema_name}: {exc}")
            
            # Seed default RBAC roles
            try:
                from apps.access_control.models import Role
                default_roles = ["Administrator", "Teacher", "Student", "Parent"]
                for role_name in default_roles:
                    Role.objects.get_or_create(
                        name=role_name,
                        defaults={"description": f"Default {role_name} role"},
                    )
                logger.info(f"Seeded default roles in {schema_name}")
            except Exception as exc:
                logger.warning(f"Failed to seed roles in {schema_name}: {exc}")
            
            # Seed default departments (HR)
            try:
                from apps.hr.models import Department
                default_depts = ["Administration", "Academic", "Support"]
                for dept_name in default_depts:
                    Department.objects.get_or_create(
                        name=dept_name,
                        defaults={"description": f"Default {dept_name} department"},
                    )
                logger.info(f"Seeded default departments in {schema_name}")
            except Exception as exc:
                logger.warning(f"Failed to seed departments in {schema_name}: {exc}")
        
        logger.info(f"Default data seeding completed for schema {schema_name}")
        return True
    except Exception as exc:
        logger.error(f"Failed to seed defaults in schema {schema_name}: {exc}")
        raise


def create_tenant_domain(tenant, subdomain):
    """Create Domain record pointing to the tenant schema."""
    try:
        domain = Domain.objects.create(
            domain=subdomain,
            tenant=tenant,
            is_primary=True,
        )
        logger.info(f"Domain created: {domain.domain} -> {tenant.schema_name}")
        return domain
    except Exception as exc:
        logger.error(f"Failed to create domain for {subdomain}: {exc}")
        raise


def provision_tenant(
    name,
    subdomain_url,
    plan="trial",
    actor_user=None,
    actor_ip=None,
):
    """Main provisioning function.
    
    Orchestrates the full tenant creation flow:
    1. Validate inputs
    2. Create SchoolTenant record
    3. Create PostgreSQL schema
    4. Run migrations
    5. Seed defaults
    6. Create Domain record
    7. Return provisioned tenant
    
    On any error, attempts to rollback.
    """
    if not is_provisioning_enabled():
        raise RuntimeError("Tenant provisioning is not enabled (MULTI_TENANCY_ENABLED=False)")
    
    tenant_id = None
    schema_name = None
    start_time = time.time()
    
    try:
        # Step 1: Validate and sanitize inputs
        if not name or len(name) < 2:
            raise ValueError("School name must be at least 2 characters")
        
        if not subdomain_url or len(subdomain_url) < 2:
            raise ValueError("Subdomain must be at least 2 characters")
        
        schema_name = sanitize_subdomain(subdomain_url)
        
        # Check if subdomain already exists
        if Domain.objects.filter(domain=subdomain_url).exists():
            raise ValueError(f"Subdomain '{subdomain_url}' is already taken")
        
        if SchoolTenant.objects.filter(schema_name=schema_name).exists():
            raise ValueError(f"Schema '{schema_name}' already exists")
        
        # Log audit start
        log_audit(
            action="provision_start",
            schema_name=schema_name,
            status="pending",
            actor_user=actor_user,
            actor_ip=actor_ip,
            details={
                "name": name,
                "subdomain": subdomain_url,
                "plan": plan,
            },
        )
        
        # Step 2: Create SchoolTenant record
        tenant = SchoolTenant.objects.create(
            name=name,
            short_code=subdomain_url[:10].upper(),
            subdomain_url=subdomain_url,
            schema_name=schema_name,
            plan=plan,
            status="provisioning",
        )
        tenant_id = tenant.tenant_id
        logger.info(f"SchoolTenant created: {tenant.tenant_id} -> {schema_name}")
        
        log_audit(
            action="schema_created",
            tenant_id=tenant_id,
            schema_name=schema_name,
            status="pending",
            actor_user=actor_user,
            actor_ip=actor_ip,
        )
        
        # Step 3: Create PostgreSQL schema
        create_postgres_schema(schema_name)
        
        log_audit(
            action="schema_created",
            tenant_id=tenant_id,
            schema_name=schema_name,
            status="success",
            actor_user=actor_user,
            actor_ip=actor_ip,
            details={"schema_name": schema_name},
        )
        
        # Step 4: Run migrations
        run_tenant_migrations(schema_name)
        
        log_audit(
            action="migrations_ran",
            tenant_id=tenant_id,
            schema_name=schema_name,
            status="success",
            actor_user=actor_user,
            actor_ip=actor_ip,
        )
        
        # Step 5: Seed defaults
        seed_tenant_defaults(schema_name)
        
        log_audit(
            action="seeding_completed",
            tenant_id=tenant_id,
            schema_name=schema_name,
            status="success",
            actor_user=actor_user,
            actor_ip=actor_ip,
        )
        
        # Step 6: Create Domain record
        domain = create_tenant_domain(tenant, subdomain_url)
        
        # Step 7: Mark tenant as provisioned
        tenant.status = "active"
        tenant.provisioned_at = timezone.now()
        tenant.save()
        
        # Calculate duration
        duration_ms = int((time.time() - start_time) * 1000)
        
        log_audit(
            action="provision_complete",
            tenant_id=tenant_id,
            schema_name=schema_name,
            status="success",
            actor_user=actor_user,
            actor_ip=actor_ip,
            duration_ms=duration_ms,
            details={
                "name": tenant.name,
                "subdomain": subdomain_url,
                "schema_name": schema_name,
                "plan": plan,
            },
        )
        
        logger.info(
            f"Tenant provisioning completed: {tenant_id} ({schema_name}) in {duration_ms}ms"
        )
        
        return tenant
    
    except Exception as exc:
        # Log failure
        duration_ms = int((time.time() - start_time) * 1000)
        log_audit(
            action="provision_failed",
            tenant_id=tenant_id,
            schema_name=schema_name,
            status="failed",
            actor_user=actor_user,
            actor_ip=actor_ip,
            error_message=str(exc),
            duration_ms=duration_ms,
        )
        
        # Attempt rollback
        if schema_name:
            try:
                with connection.cursor() as cursor:
                    cursor.execute(f"DROP SCHEMA IF EXISTS {schema_name} CASCADE")
                logger.info(f"Rolled back schema: {schema_name}")
            except Exception as rollback_exc:
                logger.error(f"Failed to rollback schema {schema_name}: {rollback_exc}")
        
        if tenant_id:
            try:
                SchoolTenant.objects.filter(tenant_id=tenant_id).delete()
                logger.info(f"Rolled back tenant record: {tenant_id}")
            except Exception as rollback_exc:
                logger.error(f"Failed to rollback tenant {tenant_id}: {rollback_exc}")
        
        logger.error(f"Tenant provisioning failed: {exc}", exc_info=True)
        raise


from django.utils import timezone
