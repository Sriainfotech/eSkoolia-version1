from __future__ import annotations

from datetime import date

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.tenancy.models import School, SchoolTenant, SuperAdminInvoice, TenantAuditLog


@pytest.fixture
def superuser(db):
    user_model = get_user_model()
    return user_model.objects.create_user(
        username="superadmin",
        password="password",
        is_superuser=True,
        is_staff=True,
    )


@pytest.fixture
def tenant_user(db):
    user_model = get_user_model()
    school = School.objects.create(name="Tenant School", code="TENANT-001")
    return user_model.objects.create_user(username="tenantuser", password="password", school=school)


@pytest.mark.django_db
def test_dashboard_and_school_list_match_contract(superuser):
    SchoolTenant.objects.using("default").create(
        tenant_id="TNT_TEST01",
        name="Greenwood Public School",
        short_code="GREENWOOD",
        subdomain_url="greenwood",
        schema_name="school_greenwood",
        shard_region="default",
        storage_region="default",
        backup_retention=30,
        sso_method="native",
        api_access=True,
        plan="premium",
        status="active",
        provisioned_at=None,
        board="CBSE",
        state="Telangana",
        region="south",
        gstin="36ABCDE1234F1Z5",
        udise_code="12345678901",
        pan="ABCDE1234F",
        seats=1000,
        student_count=845,
        staff_count=64,
    )
    TenantAuditLog.objects.using("default").create(
        action="school.provision",
        status="success",
        actor_username="superadmin",
        tenant_id="TNT_TEST01",
        details={"message": "Provisioned"},
    )

    client = APIClient()
    client.force_authenticate(user=superuser)

    dashboard = client.get("/api/super-admin/dashboard/")
    assert dashboard.status_code == 200
    assert set(["totalSchools", "activeSchools", "totalStudents", "totalStaff", "mrr", "boardBreakdown", "trends", "recentEvents"]).issubset(dashboard.json().keys())

    schools = client.get("/api/super-admin/schools/")
    assert schools.status_code == 200
    body = schools.json()
    assert set(["count", "next", "previous", "results"]).issubset(body.keys())
    assert body["results"][0]["tenant_id"] == "TNT_TEST01"


@pytest.mark.django_db
def test_tenant_users_are_rejected_from_super_admin_routes(tenant_user):
    client = APIClient()
    client.force_authenticate(user=tenant_user)

    response = client.get("/api/super-admin/dashboard/")
    assert response.status_code == 403


@pytest.mark.django_db
def test_policies_and_billing_endpoints_return_contract_shapes(superuser):
    tenant = SchoolTenant.objects.using("default").create(
        tenant_id="TNT_BILL01",
        name="Billing Test School",
        short_code="BILLTEST",
        subdomain_url="billtest",
        schema_name="school_billtest",
        shard_region="default",
        storage_region="default",
        backup_retention=30,
        sso_method="native",
        api_access=True,
        plan="premium",
        status="active",
        board="CBSE",
        state="Telangana",
        region="south",
        seats=500,
        student_count=300,
        staff_count=40,
    )
    SuperAdminInvoice.objects.using("default").create(
        invoice_number="INV-TEST-001",
        tenant=tenant,
        school_name=tenant.name,
        invoice_date=date(2026, 5, 1),
        due_date=date(2026, 5, 15),
        status="sent",
        seller_name="eSkoolia",
        seller_gstin="29AABCE1234F1ZS",
        seller_state="Karnataka",
        buyer_name=tenant.name,
        buyer_gstin="36ABCDE1234F1Z5",
        buyer_state="Telangana",
        line_items=[{"description": "Platform subscription", "quantity": 1, "unit_price": 1000, "sac_code": "998313", "amount": 1000}],
        tax_breakdown={"subtotal": 1000, "total_tax": 180, "grand_total": 1180, "amount_in_words": "1180 INR"},
    )

    client = APIClient()
    client.force_authenticate(user=superuser)

    mrr = client.get("/api/super-admin/billing/mrr/")
    assert mrr.status_code == 200
    assert set(["current_mrr", "previous_mrr", "gst_collected", "outstanding_amount", "at_risk_amount", "trend_percent"]).issubset(mrr.json().keys())

    policies = client.get("/api/super-admin/policies/")
    assert policies.status_code == 200
    assert isinstance(policies.json(), list)
    assert policies.json()[0]["policies"]

    patch = client.patch("/api/super-admin/policies/", {"password.min_length": 12}, format="json")
    assert patch.status_code == 200
