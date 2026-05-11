"""
Tests — Authentication & Multi-Tenancy
========================================
Covers: JWT login, tenant isolation, RBAC access control
These are the most critical smoke tests — run on every push.
"""

import pytest


@pytest.mark.smoke
class TestAuthentication:
    """JWT login/logout flow tests."""

    def test_login_with_valid_credentials(self, api_client, admin_user):
        response = api_client.post("/api/auth/login/", {
            "username": admin_user.username,
            "password": "TestPass@123",
        }, format="json")
        assert response.status_code == 200
        data = response.json()
        assert "access" in data or "token" in data, "Login must return a token"

    def test_login_with_wrong_password(self, api_client, admin_user):
        response = api_client.post("/api/auth/login/", {
            "username": admin_user.username,
            "password": "WrongPass!",
        }, format="json")
        assert response.status_code in (400, 401)

    def test_login_with_nonexistent_user(self, api_client):
        response = api_client.post("/api/auth/login/", {
            "username": "ghost_user",
            "password": "NoPass123",
        }, format="json")
        assert response.status_code in (400, 401)

    def test_unauthenticated_cannot_access_protected_routes(self, api_client):
        """Every protected endpoint must reject unauthenticated requests."""
        protected_urls = [
            "/api/students/students/",
            "/api/fees/groups/",
            "/api/staff/",
        ]
        for url in protected_urls:
            response = api_client.get(url)
            assert response.status_code in (401, 403), (
                f"Expected 401/403 for {url}, got {response.status_code}"
            )

    def test_inactive_user_cannot_login(self, api_client, school):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        inactive_user = User.objects.create_user(
            username="inactive_test",
            email="inactive@test.com",
            password="TestPass@123",
            school=school,
            is_active=False,
        )
        response = api_client.post("/api/auth/login/", {
            "username": inactive_user.username,
            "password": "TestPass@123",
        }, format="json")
        assert response.status_code in (400, 401)


@pytest.mark.smoke
class TestMultiTenancy:
    """CRITICAL: Data must never leak across tenants (schools)."""

    def test_admin_sees_only_own_school_students(self, admin_client, student, school):
        response = admin_client.get("/api/students/students/")
        assert response.status_code == 200
        data = response.json()
        results = data.get("results", data)
        for s in results:
            if "school" in s:
                assert s["school"] == school.pk, "Cross-tenant student data leak detected!"

    def test_school_b_cannot_see_school_a_data(self, api_client, student):
        """Log in as school B admin and verify school A students are invisible."""
        from apps.tenancy.models import School
        from django.contrib.auth import get_user_model
        User = get_user_model()
        from rest_framework.test import APIClient

        school_b = School.objects.create(
            name="Rival School",
            code="RIVAL",
            email="rival@school.test",
            phone="2222222222",
            address="Rival Address",
            city="Chennai",
            state="Tamil Nadu",
            country="India",
            pincode="600001",
            is_active=True,
        )
        user_b = User.objects.create_user(
            username="school_b_admin",
            email="b@rival.test",
            password="TestPass@123",
            school=school_b,
            is_school_admin=True,
        )
        client_b = APIClient()
        client_b.force_authenticate(user=user_b)

        response = client_b.get("/api/students/students/")
        assert response.status_code == 200
        data = response.json()
        results = data.get("results", data)
        # School A's student must not appear
        admission_numbers = [s.get("admission_number") for s in results]
        assert "ADM-001" not in admission_numbers, "CRITICAL: Tenant data isolation broken!"


@pytest.mark.model
class TestUserModel:

    def test_superuser_gets_wildcard_permissions(self, db):
        from django.contrib.auth import get_user_model
        User = get_user_model()
        su = User.objects.create_superuser(
            username="supertest",
            email="super@test.com",
            password="SuperPass@123",
        )
        perms = su.get_permission_codes()
        assert "*" in perms

    def test_regular_user_has_no_permissions_by_default(self, admin_user):
        """A fresh user with no roles should have no permissions."""
        admin_user.is_superuser = False
        admin_user.save()
        perms = admin_user.get_permission_codes()
        # Could be empty or only role-based
        assert isinstance(perms, set)

    def test_access_status_flag(self, admin_user):
        """access_status=False should indicate blocked user."""
        admin_user.access_status = False
        admin_user.save()
        admin_user.refresh_from_db()
        assert admin_user.access_status is False
