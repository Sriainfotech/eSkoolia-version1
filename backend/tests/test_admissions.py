"""
Tests — Admissions Module
===========================
Covers: AdmissionInquiry creation, pipeline stages, audit log
"""

import pytest


@pytest.mark.model
class TestAdmissionInquiry:

    def test_create_inquiry(self, school, academic_year):
        from apps.admissions.models import AdmissionInquiry
        inquiry = AdmissionInquiry.objects.create(
            school=school,
            student_name="Rahul Nair",
            inquiry_date="2025-04-01",
            class_applied="Grade 1",
            guardian_name="Suresh Nair",
            guardian_phone="9988776655",
            source="walk-in",
            status="new",
        )
        assert inquiry.pk is not None
        assert inquiry.student_name == "Rahul Nair"
        assert inquiry.status == "new"

    def test_inquiry_str(self, school, academic_year):
        from apps.admissions.models import AdmissionInquiry
        inquiry = AdmissionInquiry.objects.create(
            school=school,
            student_name="Anita Rao",
            inquiry_date="2025-04-02",
            class_applied="Grade 2",
            guardian_name="Venkat Rao",
            guardian_phone="9900001111",
            source="online",
            status="new",
        )
        assert isinstance(str(inquiry), str)

    def test_inquiry_belongs_to_school(self, school):
        from apps.admissions.models import AdmissionInquiry
        inquiry = AdmissionInquiry.objects.create(
            school=school,
            student_name="Test Child",
            inquiry_date="2025-04-03",
            class_applied="Nursery",
            guardian_name="Test Parent",
            guardian_phone="8800001111",
            source="referral",
            status="new",
        )
        assert inquiry.school == school

    def test_tenant_isolation_on_inquiries(self, school):
        """Inquiries from one school must not be returned for another school."""
        from apps.admissions.models import AdmissionInquiry
        from apps.tenancy.models import School
        AdmissionInquiry.objects.create(
            school=school,
            student_name="School A Child",
            inquiry_date="2025-04-04",
            class_applied="Grade 3",
            guardian_name="School A Parent",
            guardian_phone="7700001111",
            source="online",
            status="new",
        )
        school_b = School.objects.create(
            name="Tenant B School",
            code="TENB",
            email="b@school.test",
            phone="3333333333",
            address="B Address",
            city="Pune",
            state="Maharashtra",
            country="India",
            pincode="411001",
            is_active=True,
        )
        b_count = AdmissionInquiry.objects.filter(school=school_b).count()
        assert b_count == 0


@pytest.mark.api
class TestAdmissionAPI:

    def test_list_inquiries_requires_auth(self, api_client):
        response = api_client.get("/api/admissions/inquiries/")
        assert response.status_code in (401, 403)

    def test_admin_can_list_inquiries(self, admin_client, school):
        from apps.admissions.models import AdmissionInquiry
        AdmissionInquiry.objects.create(
            school=school,
            student_name="API Test Child",
            inquiry_date="2025-04-05",
            class_applied="Grade 4",
            guardian_name="API Parent",
            guardian_phone="6600001111",
            source="online",
            status="new",
        )
        response = admin_client.get("/api/admissions/inquiries/")
        assert response.status_code == 200

    def test_create_inquiry_via_api(self, admin_client, school, academic_year):
        payload = {
            "student_name": "New API Inquiry",
            "inquiry_date": "2025-04-06",
            "class_applied": "Grade 5",
            "guardian_name": "New Parent",
            "guardian_phone": "5500001111",
            "source": "walk-in",
            "status": "new",
        }
        response = admin_client.post("/api/admissions/inquiries/", payload, format="json")
        assert response.status_code == 201

    def test_inquiry_status_transition(self, admin_client, school):
        """Moving inquiry from 'new' → 'scheduled' should succeed."""
        from apps.admissions.models import AdmissionInquiry
        inquiry = AdmissionInquiry.objects.create(
            school=school,
            student_name="Status Test Child",
            inquiry_date="2025-04-07",
            class_applied="Grade 6",
            guardian_name="Status Parent",
            guardian_phone="4400001111",
            source="online",
            status="new",
        )
        response = admin_client.patch(
            f"/api/admissions/inquiries/{inquiry.pk}/",
            {"status": "scheduled"},
            format="json",
        )
        assert response.status_code in (200, 201)
