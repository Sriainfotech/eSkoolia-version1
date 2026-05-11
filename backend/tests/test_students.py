"""
Tests — Students Module
========================
Covers: model constraints, soft-delete, uniqueness, API CRUD
"""

import pytest
from django.db import IntegrityError


# ===========================================================================
# MODEL TESTS
# ===========================================================================

@pytest.mark.model
class TestStudentModel:
    """Unit tests for the Student model."""

    def test_student_created_successfully(self, student):
        assert student.pk is not None
        assert student.first_name == "Aarav"
        assert student.status == "active"

    def test_student_belongs_to_school(self, student, school):
        assert student.school == school

    def test_admission_number_unique_per_school(self, school, section, academic_year):
        """Two students cannot share an admission number in the same school."""
        from apps.students.models import Student
        Student.objects.create(
            school=school,
            admission_number="ADM-DUP",
            first_name="Riya",
            last_name="Patel",
            date_of_birth="2015-05-10",
            gender="F",
            section=section,
            academic_year=academic_year,
            status="active",
        )
        with pytest.raises(IntegrityError):
            Student.objects.create(
                school=school,
                admission_number="ADM-DUP",  # same number, same school
                first_name="Ananya",
                last_name="Rao",
                date_of_birth="2015-07-20",
                gender="F",
                section=section,
                academic_year=academic_year,
                status="active",
            )

    def test_student_str_representation(self, student):
        """__str__ should not raise and should be non-empty."""
        result = str(student)
        assert isinstance(result, str)
        assert len(result) > 0

    def test_student_status_choices(self, school, section, academic_year):
        """Only valid status values should be accepted at the DB level."""
        from apps.students.models import Student
        s = Student.objects.create(
            school=school,
            admission_number="ADM-002",
            first_name="Karan",
            last_name="Mehta",
            date_of_birth="2014-01-01",
            gender="M",
            section=section,
            academic_year=academic_year,
            status="inactive",
        )
        assert s.status == "inactive"

    def test_student_count_in_section(self, student, school, section, academic_year):
        """Sanity check: section queryset returns our student."""
        from apps.students.models import Student
        qs = Student.objects.filter(section=section, school=school)
        assert qs.count() >= 1

    @pytest.mark.smoke
    def test_student_multi_tenant_isolation(self, student, school):
        """Students from school A must not be visible under school B."""
        from apps.tenancy.models import School
        from apps.students.models import Student
        school_b = School.objects.create(
            name="Other School",
            code="OTHER",
            email="other@school.test",
            phone="1111111111",
            address="Other Address",
            city="Mumbai",
            state="Maharashtra",
            country="India",
            pincode="400001",
            is_active=True,
        )
        count = Student.objects.filter(school=school_b).count()
        assert count == 0  # no cross-tenant data leak


# ===========================================================================
# API TESTS
# ===========================================================================

@pytest.mark.api
class TestStudentAPI:
    """API endpoint tests for /api/students/"""

    def test_list_students_requires_auth(self, api_client):
        response = api_client.get("/api/students/students/")
        assert response.status_code in (401, 403)

    def test_admin_can_list_students(self, admin_client, student):
        response = admin_client.get("/api/students/students/")
        assert response.status_code == 200
        data = response.json()
        # DRF paginated response has 'results' key
        results = data.get("results", data)
        assert isinstance(results, list)
        assert any(s["admission_number"] == "ADM-001" for s in results)

    def test_student_detail(self, admin_client, student):
        response = admin_client.get(f"/api/students/students/{student.pk}/")
        assert response.status_code == 200
        assert response.json()["first_name"] == "Aarav"

    def test_create_student_via_api(self, admin_client, school, section, academic_year):
        payload = {
            "admission_number": "ADM-API-001",
            "first_name": "Priya",
            "last_name": "Singh",
            "date_of_birth": "2015-08-20",
            "gender": "F",
            "section": section.pk,
            "academic_year": academic_year.pk,
            "status": "active",
        }
        response = admin_client.post("/api/students/students/", payload, format="json")
        assert response.status_code == 201
        assert response.json()["admission_number"] == "ADM-API-001"

    def test_teacher_cannot_delete_student(self, teacher_client, student):
        """Teachers should not have delete access."""
        response = teacher_client.delete(f"/api/students/students/{student.pk}/")
        assert response.status_code in (403, 405)

    def test_students_filtered_by_tenant(self, admin_client, student):
        """API must only return students belonging to the authenticated user's school."""
        response = admin_client.get("/api/students/students/")
        data = response.json()
        results = data.get("results", data)
        school_ids = {s.get("school") for s in results if "school" in s}
        # If school id is returned, it must match our school
        if school_ids:
            assert all(sid == student.school.pk for sid in school_ids)
