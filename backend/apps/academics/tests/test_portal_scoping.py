"""
Portal-scoping POC: GET /api/v1/academics/class-routines/my-schedule/

Verifies the apps.core.portal_scoping registry + PortalScopeFilterBackend,
piloted on ClassRoutineSlot (apps/academics/views.py::ClassRoutineSlotViewSet).
Cross-school isolation is the regression guard for the 2026-07-13/14 leak
documented in the root CLAUDE.md — every case here also asserts a second
school's data never leaks through.
"""

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.access_control.models import Role, UserRole
from apps.academics.models import ClassRoutineSlot
from apps.core.models import Class, Section
from apps.students.models import Guardian, Student

User = get_user_model()

URL = "/api/v1/academics/class-routines/my-schedule/"


def _assign_portal_role(user, portal_type):
    role = Role.objects.create(name=f"{portal_type}-role", portal_type=portal_type, is_active=True)
    UserRole.objects.create(user=user, role=role)
    return role


def _make_slot(school, academic_year, school_class, section, teacher, start, end, day="monday"):
    return ClassRoutineSlot.objects.create(
        school=school,
        academic_year=academic_year,
        school_class=school_class,
        section=section,
        teacher=teacher,
        day=day,
        start_time=start,
        end_time=end,
        active_status=True,
    )


@pytest.mark.django_db
def test_teacher_my_schedule_only_shows_own_slots(
    school, academic_year, school_class, section, teacher_user, teacher_client
):
    _assign_portal_role(teacher_user, "teacher")

    other_teacher = User.objects.create_user(username="other_teacher_test", password="x", school=school)
    other_class = Class.objects.create(school=school, name="Grade 6", numeric_order=6, is_active=True)
    other_section = Section.objects.create(school_class=other_class, name="B", capacity=40)

    own_slot = _make_slot(school, academic_year, school_class, section, teacher_user, "09:00", "09:40")
    other_slot = _make_slot(school, academic_year, other_class, other_section, other_teacher, "10:00", "10:40")

    response = teacher_client.get(URL)
    assert response.status_code == 200
    returned_ids = {row["id"] for row in response.data["data"]}
    assert returned_ids == {own_slot.id}
    assert other_slot.id not in returned_ids


@pytest.mark.django_db
def test_parent_my_schedule_only_shows_own_childs_class(
    school, academic_year, school_class, section, teacher_user
):
    guardian = Guardian.objects.create(school=school, full_name="Test Guardian", relation="Father", phone="9000000000")
    parent_account = User.objects.create_user(username="parent_scope_test", password="x", school=school)
    guardian.user = parent_account
    guardian.save(update_fields=["user"])
    _assign_portal_role(parent_account, "parent")

    Student.objects.create(
        school=school,
        admission_no="ADM-SCOPE-1",
        first_name="Own",
        last_name="Child",
        gender="male",
        status="active",
        guardian=guardian,
        current_class=school_class,
        current_section=section,
        academic_year=academic_year,
    )

    other_class = Class.objects.create(school=school, name="Grade 7", numeric_order=7, is_active=True)
    other_section = Section.objects.create(school_class=other_class, name="C", capacity=40)

    own_slot = _make_slot(school, academic_year, school_class, section, teacher_user, "09:00", "09:40")
    other_slot = _make_slot(school, academic_year, other_class, other_section, teacher_user, "10:00", "10:40")

    parent_client = APIClient()
    parent_client.force_authenticate(user=parent_account)

    response = parent_client.get(URL)
    assert response.status_code == 200
    returned_ids = {row["id"] for row in response.data["data"]}
    assert returned_ids == {own_slot.id}
    assert other_slot.id not in returned_ids


@pytest.mark.django_db
def test_teacher_my_schedule_never_leaks_another_school(
    school, academic_year, school_class, section, teacher_user, teacher_client
):
    """Regression guard: a same-named teacher row in a different school must never appear."""
    from apps.tenancy.models import School

    _assign_portal_role(teacher_user, "teacher")

    other_school = School.objects.create(name="Other Test School", code="OTEST", is_active=True)
    other_class = Class.objects.create(school=other_school, name="Grade 5", numeric_order=5, is_active=True)
    other_section = Section.objects.create(school_class=other_class, name="A", capacity=40)

    own_slot = _make_slot(school, academic_year, school_class, section, teacher_user, "09:00", "09:40")
    cross_school_slot = _make_slot(other_school, None, other_class, other_section, teacher_user, "09:00", "09:40")

    response = teacher_client.get(URL)
    assert response.status_code == 200
    returned_ids = {row["id"] for row in response.data["data"]}
    assert returned_ids == {own_slot.id}
    assert cross_school_slot.id not in returned_ids


@pytest.mark.django_db
def test_admin_my_schedule_matches_existing_list_queryset(
    school, academic_year, school_class, section, teacher_user, admin_client
):
    """Additive action must not change admin-visible data vs. the existing list() endpoint."""
    _make_slot(school, academic_year, school_class, section, teacher_user, "09:00", "09:40")
    _make_slot(school, academic_year, school_class, section, teacher_user, "10:00", "10:40")

    my_schedule_response = admin_client.get(URL)
    list_response = admin_client.get("/api/v1/academics/class-routines/")

    assert my_schedule_response.status_code == 200
    assert list_response.status_code == 200

    my_schedule_ids = {row["id"] for row in my_schedule_response.data["data"]}
    list_payload = list_response.data.get("results", list_response.data)
    list_ids = {row["id"] for row in list_payload}
    assert my_schedule_ids == list_ids
    assert len(my_schedule_ids) == 2


@pytest.mark.django_db
def test_unregistered_portal_type_fails_closed(school, academic_year, school_class, section, teacher_user):
    """A portal type with no registered resolver for this model must see nothing, not everything."""
    student_account = User.objects.create_user(username="student_scope_test", password="x", school=school)
    _assign_portal_role(student_account, "student")

    _make_slot(school, academic_year, school_class, section, teacher_user, "09:00", "09:40")

    student_client = APIClient()
    student_client.force_authenticate(user=student_account)

    response = student_client.get(URL)
    assert response.status_code == 200
    assert response.data["data"] == []
