"""
Eskoolia ERP - Shared Test Fixtures
===================================
All fixtures here are available to every test file automatically.
Uses pytest-django against the dedicated test settings module.
"""

import os
import sys
from uuid import uuid4

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from decimal import Decimal

User = get_user_model()


def pytest_configure(config):
    settings_module = os.getenv("DJANGO_SETTINGS_MODULE")
    if settings_module != "config.settings.test":
        raise pytest.UsageError(
            "pytest must use config.settings.test; update backend/pytest.ini instead of local settings."
        )

    if sys.version_info[:2] != (3, 10):
        raise pytest.UsageError(
            "Backend tests must run on Python 3.10 for deterministic bootstrap in this repo. "
            "Use `py -3.10 -m pytest ...` from backend/."
        )

    if config.getoption("--reuse-db", default=False) and os.getenv("PYTEST_ALLOW_REUSE_DB") != "1":
        raise pytest.UsageError(
            "--reuse-db is disabled by default because it can reuse stale PostgreSQL state. "
            "Use --create-db for a fresh run, or set PYTEST_ALLOW_REUSE_DB=1 explicitly after verifying the target DB."
        )


# ---------------------------------------------------------------------------
# Database access — mark all tests as needing the DB by default
# ---------------------------------------------------------------------------
@pytest.fixture(autouse=True)
def enable_db_access_for_all_tests(db):
    """Grant every test DB access without needing @pytest.mark.django_db."""
    pass


# ---------------------------------------------------------------------------
# School (Tenant)
# ---------------------------------------------------------------------------
@pytest.fixture
def school(db):
    """A basic test school (tenant). All other fixtures belong to this school."""
    from apps.tenancy.models import School
    return School.objects.create(
        name="Eskoolia Test School",
        code="ETEST",
        is_active=True,
    )


# ---------------------------------------------------------------------------
# Academic Year
# ---------------------------------------------------------------------------
@pytest.fixture
def academic_year(school):
    from apps.core.models import AcademicYear
    return AcademicYear.objects.create(
        school=school,
        name="2025-2026",
        start_date="2025-06-01",
        end_date="2026-03-31",
        is_current=True,
    )


# ---------------------------------------------------------------------------
# Class & Section
# ---------------------------------------------------------------------------
@pytest.fixture
def school_class(school, academic_year):
    from apps.core.models import Class
    return Class.objects.create(
        school=school,
        name="Grade 5",
        numeric_value=5,
        is_active=True,
    )


@pytest.fixture
def section(school, school_class, academic_year):
    from apps.core.models import Section
    return Section.objects.create(
        school=school,
        class_obj=school_class,
        name="A",
        academic_year=academic_year,
        capacity=40,
        is_active=True,
    )


# ---------------------------------------------------------------------------
# Users
# ---------------------------------------------------------------------------
@pytest.fixture
def admin_user(school):
    """School admin user."""
    user = User.objects.create_user(
        username="admin_test",
        email="admin@eskoolia.test",
        password="TestPass@123",
        school=school,
        is_school_admin=True,
        is_staff=True,
    )
    return user


@pytest.fixture
def teacher_user(school):
    """Teacher user."""
    return User.objects.create_user(
        username="teacher_test",
        email="teacher@eskoolia.test",
        password="TestPass@123",
        school=school,
        is_school_admin=False,
    )


@pytest.fixture
def parent_user(school):
    """Parent user."""
    return User.objects.create_user(
        username="parent_test",
        email="parent@eskoolia.test",
        password="TestPass@123",
        school=school,
        is_school_admin=False,
    )


# ---------------------------------------------------------------------------
# API Clients (authenticated)
# ---------------------------------------------------------------------------
@pytest.fixture
def api_client():
    """Unauthenticated DRF API client."""
    return APIClient()


@pytest.fixture
def admin_client(admin_user):
    """DRF client authenticated as school admin."""
    client = APIClient()
    client.force_authenticate(user=admin_user)
    return client


@pytest.fixture
def public_schema_tenant(db):
    """Reusable public-schema tenant factory for super-admin and tenancy tests."""
    from apps.tenancy.models import SchoolTenant

    suffix = uuid4().hex[:8].upper()
    return SchoolTenant.objects.using("default").create(
        tenant_id=f"TNT_TEST_{suffix}",
        name=f"Test Tenant {suffix}",
        short_code=f"TT{suffix[:6]}",
        subdomain_url=f"tenant-{suffix.lower()}",
        schema_name=f"school_test_{suffix.lower()}",
        shard_region="test",
        storage_region="test",
        backup_retention=30,
        sso_method="native",
        api_access=True,
        plan="trial",
        status="onboarding",
        board="OTHER",
        state="TestState",
        region="north",
        seats=100,
        student_count=0,
        staff_count=0,
    )


@pytest.fixture
def public_schema_tenant_payload(public_schema_tenant):
    """Compact payload for tests that need tenant identifiers only."""
    return {
        "tenant_id": public_schema_tenant.tenant_id,
        "schema_name": public_schema_tenant.schema_name,
        "subdomain_url": public_schema_tenant.subdomain_url,
    }


@pytest.fixture
def teacher_client(teacher_user):
    """DRF client authenticated as teacher."""
    client = APIClient()
    client.force_authenticate(user=teacher_user)
    return client


# ---------------------------------------------------------------------------
# Student
# ---------------------------------------------------------------------------
@pytest.fixture
def student(school, section, academic_year):
    """A basic enrolled student."""
    from apps.students.models import Student
    return Student.objects.create(
        school=school,
        admission_number="ADM-001",
        first_name="Aarav",
        last_name="Sharma",
        date_of_birth="2015-03-15",
        gender="M",
        section=section,
        academic_year=academic_year,
        status="active",
    )


# ---------------------------------------------------------------------------
# Fees fixtures
# ---------------------------------------------------------------------------
@pytest.fixture
def fees_group(school, academic_year):
    from apps.fees.models import FeesGroup
    return FeesGroup.objects.create(
        school=school,
        academic_year=academic_year,
        name="Tuition Group",
        is_active=True,
    )


@pytest.fixture
def fees_type(school, academic_year, fees_group):
    from apps.fees.models import FeesType
    return FeesType.objects.create(
        school=school,
        academic_year=academic_year,
        fees_group=fees_group,
        name="Term 1 Fee",
        amount=Decimal("5000.00"),
        is_active=True,
    )
