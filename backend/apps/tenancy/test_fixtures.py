"""Test fixtures and factories for realistic school migration scenarios.

Provides reproducible test datasets with relationships and FK dependencies
for realistic end-to-end migration testing.
"""

import random
from datetime import datetime, timedelta
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.db import connection

from .context import is_multi_tenancy_enabled


def create_test_school(code="TEST_SCHOOL", name="Test School"):
    """Create a test School record in public schema."""
    from .models import School
    school, _ = School.objects.get_or_create(code=code, defaults={"name": name, "is_active": True})
    return school


def create_test_tenant(
    *,
    tenant_id=None,
    name="Test Tenant",
    subdomain_url=None,
    schema_name=None,
    plan="trial",
    board="OTHER",
    state="TestState",
    region="north",
):
    """Create a public-schema SchoolTenant for tests.

    The helper is safe for public-schema tests and also works when
    multi-tenancy is disabled.
    """
    from .models import SchoolTenant

    suffix = uuid4().hex[:8].upper()
    resolved_tenant_id = tenant_id or f"TNT_TEST_{suffix}"
    resolved_subdomain = subdomain_url or f"tenant-{suffix.lower()}"
    resolved_schema_name = schema_name or f"school_test_{suffix.lower()}"

    tenant, _ = SchoolTenant.objects.using("default").get_or_create(
        tenant_id=resolved_tenant_id,
        defaults={
            "name": name,
            "short_code": f"TT{suffix[:6]}",
            "subdomain_url": resolved_subdomain,
            "schema_name": resolved_schema_name,
            "shard_region": "test",
            "storage_region": "test",
            "backup_retention": 30,
            "sso_method": "native",
            "api_access": True,
            "plan": plan,
            "status": "onboarding",
            "board": board,
            "state": state,
            "region": region,
            "seats": 100,
            "student_count": 0,
            "staff_count": 0,
        },
    )
    return tenant


def cleanup_test_tenant_schema(schema_name):
    """Drop a tenant schema only when it is clearly a test schema.

    This helper is intentionally strict to avoid accidental cleanup of a
    non-test tenant schema.
    """
    if not is_multi_tenancy_enabled():
        return False

    if not schema_name or not schema_name.startswith("school_test_"):
        raise ValueError(f"Refusing to drop non-test schema: {schema_name}")

    with connection.cursor() as cursor:
        cursor.execute(f'DROP SCHEMA IF EXISTS "{schema_name}" CASCADE')

    return True


def create_test_users(school_id, count=5):
    """Create test users linked to a school."""
    User = get_user_model()
    users = []
    for i in range(count):
        user, _ = User.objects.get_or_create(
            username=f"user_{school_id}_{i}",
            defaults={
                "email": f"user{i}@school{school_id}.test",
                "first_name": f"Test User {i}",
                "is_staff": i % 3 == 0,
            }
        )
        users.append(user)
    return users


def create_test_attendance_records(school_id, count=20):
    """Create dummy attendance records for testing (raw SQL insert).
    
    Inserts directly into public schema to avoid app model dependencies.
    """
    records = []
    with connection.cursor() as curs:
        for i in range(count):
            date_val = (datetime.now() - timedelta(days=random.randint(0, 30))).date()
            sql = """
                INSERT INTO attendance_attendance (school_id, student_id, date, status, created_at)
                VALUES (%s, %s, %s, %s, %s)
            """
            curs.execute(sql, [school_id, random.randint(1000, 5000), date_val, "present", datetime.now()])
            records.append({"school_id": school_id, "student_id": random.randint(1000, 5000)})
    return records


def create_test_fee_records(school_id, count=15):
    """Create dummy fee invoice records."""
    records = []
    with connection.cursor() as curs:
        for i in range(count):
            sql = """
                INSERT INTO fees_invoice (school_id, student_id, amount, status, created_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """
            curs.execute(sql, [school_id, random.randint(1000, 5000), random.uniform(100, 5000), "pending", datetime.now()])
            records.append({"school_id": school_id, "student_id": random.randint(1000, 5000)})
    return records


def create_test_hr_staff(school_id, count=10):
    """Create dummy HR/staff records."""
    records = []
    with connection.cursor() as curs:
        for i in range(count):
            sql = """
                INSERT INTO hr_staff (school_id, employee_id, name, designation, created_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
            """
            curs.execute(sql, [school_id, f"EMP_{school_id}_{i}", f"Staff {i}", "Teacher", datetime.now()])
            records.append({"school_id": school_id, "employee_id": f"EMP_{school_id}_{i}"})
    return records


def create_test_dataset(school_id, small=True):
    """Create a realistic small test dataset for integration testing.
    
    Args:
        school_id: ID of school to attach to all records
        small: If True, use smaller counts (for rapid testing)
    
    Returns:
        dict with summary of created records
    """
    summary = {
        "school_id": school_id,
        "users": 0,
        "attendance": 0,
        "fees": 0,
        "staff": 0,
    }
    
    try:
        users = create_test_users(school_id, count=3 if small else 10)
        summary["users"] = len(users)
    except Exception as e:
        summary["users_error"] = str(e)
    
    try:
        attendance = create_test_attendance_records(school_id, count=5 if small else 30)
        summary["attendance"] = len(attendance)
    except Exception as e:
        summary["attendance_error"] = str(e)
    
    try:
        fees = create_test_fee_records(school_id, count=3 if small else 20)
        summary["fees"] = len(fees)
    except Exception as e:
        summary["fees_error"] = str(e)
    
    try:
        staff = create_test_hr_staff(school_id, count=5 if small else 15)
        summary["staff"] = len(staff)
    except Exception as e:
        summary["staff_error"] = str(e)
    
    return summary


def cleanup_test_data(school_id):
    """Delete all test data for a given school_id from public schema.
    
    Used for teardown of integration tests.
    """
    with connection.cursor() as curs:
        tables = [
            "attendance_attendance",
            "fees_invoice",
            "hr_staff",
        ]
        for table in tables:
            try:
                sql = f'DELETE FROM public."{table}" WHERE school_id = %s'
                curs.execute(sql, [school_id])
            except Exception:
                pass
    
    # Also cleanup Django users
    User = get_user_model()
    User.objects.filter(username__startswith=f"user_{school_id}_").delete()
