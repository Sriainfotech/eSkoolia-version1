"""
Tests — HR serializer behavior
===============================
Covers staff serializer address/email representation and alias mapping,
and the Leave Management page's coverage-risk/stats/apply-on-behalf endpoints.
"""

import datetime

import pytest
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.access_control.models import Permission, Role, RolePermission, UserRole
from apps.hr.models import ApprovalChainPolicy, Department, Designation, LeaveApprovalStep, LeaveRequest, LeaveType, Staff
from apps.hr.serializers import LeaveRequestSerializer, StaffSerializer


@pytest.mark.django_db
class TestStaffSerializer:
    def test_to_representation_exposes_city_state_aliases(self, school):
        User = get_user_model()
        user = User.objects.create_user(
            username="staff_test_user",
            email="staff_test@example.com",
            password="TestPass@123",
            school=school,
        )

        staff = Staff.objects.create(
            school=school,
            user=user,
            staff_no="HR-001",
            first_name="Test",
            join_date="2026-01-01",
            status="active",
            custom_field={
                "current_city": "Bangalore",
                "current_state": "Karnataka",
                "pincode": "560001",
            },
        )

        data = StaffSerializer(staff).data

        assert data["city"] == "Bangalore"
        assert data["state"] == "Karnataka"
        assert data["current_pin"] == "560001"
        assert data["current_city"] == "Bangalore"
        assert data["current_state"] == "Karnataka"

    def test_to_representation_falls_back_to_current_address_for_city_and_pin(self, school):
        User = get_user_model()
        user = User.objects.create_user(
            username="staff_test_user2",
            email="staff_test2@example.com",
            password="TestPass@123",
            school=school,
        )

        staff = Staff.objects.create(
            school=school,
            user=user,
            staff_no="HR-002",
            first_name="Fallback",
            join_date="2026-01-01",
            status="active",
            current_address="Miyapur",
        )

        data = StaffSerializer(staff).data

        assert data["city"] == "Miyapur"
        assert data["current_city"] == "Miyapur"
        assert data["current_state"] == ""
        assert data["current_pin"] == ""

        user2 = User.objects.create_user(
            username="staff_test_user3",
            email="staff_test3@example.com",
            password="TestPass@123",
            school=school,
        )

        staff_with_pin = Staff.objects.create(
            school=school,
            user=user2,
            staff_no="HR-003",
            first_name="PinFallback",
            join_date="2026-01-01",
            status="active",
            current_address="Ameerpet 500038",
        )

        data_with_pin = StaffSerializer(staff_with_pin).data
        assert data_with_pin["city"] == ""
        assert data_with_pin["current_pin"] == "500038"


def _make_staff(school, staff_no, department=None, first_name="Staff"):
    User = get_user_model()
    user = User.objects.create_user(
        username=f"leave_test_{staff_no}",
        email=f"{staff_no}@example.com",
        password="TestPass@123",
        school=school,
    )
    return Staff.objects.create(
        school=school,
        user=user,
        staff_no=staff_no,
        first_name=first_name,
        join_date="2026-01-01",
        status="active",
        department=department,
    )


def _make_leave(school, staff, leave_type, from_date, to_date, status=LeaveRequest.STATUS_PENDING):
    # LeaveRequestSerializer.get_duration() needs real date objects (it
    # subtracts them) — Django doesn't parse a string assigned via
    # .create() into a date until the row is reloaded from the DB.
    if isinstance(from_date, str):
        from_date = datetime.date.fromisoformat(from_date)
    if isinstance(to_date, str):
        to_date = datetime.date.fromisoformat(to_date)
    return LeaveRequest.objects.create(
        school=school,
        staff=staff,
        leave_type=leave_type,
        from_date=from_date,
        to_date=to_date,
        status=status,
    )


@pytest.mark.django_db
class TestLeaveCoverageRisk:
    def test_flags_same_department_overlap(self, school):
        dept = Department.objects.create(school=school, name="Grade 6")
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff_a = _make_staff(school, "LV-A", department=dept)
        staff_b = _make_staff(school, "LV-B", department=dept)
        staff_c = _make_staff(school, "LV-C", department=dept)

        overlapping_range = ("2026-06-01", "2026-06-02")
        leave_a = _make_leave(school, staff_a, leave_type, *overlapping_range)
        _make_leave(school, staff_b, leave_type, *overlapping_range)
        _make_leave(school, staff_c, leave_type, *overlapping_range)

        assert LeaveRequestSerializer(leave_a).data["coverage_risk"] is True

    def test_does_not_flag_different_department_overlap(self, school):
        dept_a = Department.objects.create(school=school, name="Grade 6")
        dept_b = Department.objects.create(school=school, name="Grade 7")
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff_a = _make_staff(school, "LV-D", department=dept_a)
        staff_b = _make_staff(school, "LV-E", department=dept_b)

        overlapping_range = ("2026-06-01", "2026-06-02")
        leave_a = _make_leave(school, staff_a, leave_type, *overlapping_range)
        _make_leave(school, staff_b, leave_type, *overlapping_range)

        assert LeaveRequestSerializer(leave_a).data["coverage_risk"] is False

    def test_does_not_flag_below_threshold(self, school):
        dept = Department.objects.create(school=school, name="Grade 6")
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff_a = _make_staff(school, "LV-F", department=dept)
        staff_b = _make_staff(school, "LV-G", department=dept)

        overlapping_range = ("2026-06-01", "2026-06-02")
        leave_a = _make_leave(school, staff_a, leave_type, *overlapping_range)
        _make_leave(school, staff_b, leave_type, *overlapping_range)

        # Only one other overlapping request from the department — below the
        # 2-others threshold, so this should not be flagged.
        assert LeaveRequestSerializer(leave_a).data["coverage_risk"] is False


@pytest.mark.django_db
class TestLeaveRequestStatsAndCoverageEndpoints:
    def test_stats_counts_pending_applied_today_and_coverage_risk(self, admin_client, school, admin_user):
        dept = Department.objects.create(school=school, name="Grade 6")
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff_a = _make_staff(school, "ST-A", department=dept)
        staff_b = _make_staff(school, "ST-B", department=dept)
        staff_c = _make_staff(school, "ST-C", department=dept)

        overlapping_range = ("2026-06-01", "2026-06-02")
        _make_leave(school, staff_a, leave_type, *overlapping_range)
        _make_leave(school, staff_b, leave_type, *overlapping_range)
        _make_leave(school, staff_c, leave_type, *overlapping_range, status=LeaveRequest.STATUS_APPROVED)

        resp = admin_client.get("/api/v1/hr/leave-requests/stats/")
        assert resp.status_code == 200
        data = resp.json()
        assert data["pending_approval"] == 2
        assert data["stuck_in_chain"] == 0
        assert data["coverage_at_risk"] == 3
        assert data["applied_today"] == 3

    def test_coverage_month_view_buckets_by_day(self, admin_client, school):
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff_a = _make_staff(school, "CV-A")
        _make_leave(school, staff_a, leave_type, "2026-06-05", "2026-06-06", status=LeaveRequest.STATUS_APPROVED)

        resp = admin_client.get("/api/v1/hr/leave-requests/coverage/?month=2026-06")
        assert resp.status_code == 200
        days = {d["date"]: d for d in resp.json()["days"]}
        assert days["2026-06-05"]["approved"] == 1
        assert days["2026-06-06"]["approved"] == 1
        assert days["2026-06-04"]["approved"] == 0

    def test_coverage_day_view_lists_approved_and_pending(self, admin_client, school):
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff_a = _make_staff(school, "CV-B", first_name="Approved Staffer")
        staff_b = _make_staff(school, "CV-C", first_name="Pending Staffer")
        _make_leave(school, staff_a, leave_type, "2026-06-10", "2026-06-10", status=LeaveRequest.STATUS_APPROVED)
        _make_leave(school, staff_b, leave_type, "2026-06-10", "2026-06-10", status=LeaveRequest.STATUS_PENDING)

        resp = admin_client.get("/api/v1/hr/leave-requests/coverage/?date=2026-06-10")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["approved"]) == 1
        assert data["approved"][0]["staff_name"] == "Approved Staffer"
        assert len(data["pending"]) == 1
        assert data["pending"][0]["staff_name"] == "Pending Staffer"


@pytest.mark.django_db
class TestApplyOnBehalf:
    def test_creates_pending_request_flagged_as_on_behalf(self, admin_client, school, admin_user):
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff = _make_staff(school, "OB-A")
        future = datetime.date.today() + datetime.timedelta(days=10)

        resp = admin_client.post(
            "/api/v1/hr/leave-requests/apply-on-behalf/",
            {
                "staff": staff.id,
                "leave_type": leave_type.id,
                "from_date": future.isoformat(),
                "to_date": future.isoformat(),
                "reason": "Family function",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["is_on_behalf"] is True
        assert data["status"] == LeaveRequest.STATUS_PENDING
        assert data["applied_by_name"]

        leave_request = LeaveRequest.objects.get(pk=data["id"])
        assert leave_request.applied_by_id == admin_user.id
        assert leave_request.staff_id == staff.id

    def test_bypass_chain_auto_approves_with_no_steps(self, admin_client, school, admin_user):
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff = _make_staff(school, "OB-B")
        future = datetime.date.today() + datetime.timedelta(days=10)

        resp = admin_client.post(
            "/api/v1/hr/leave-requests/apply-on-behalf/",
            {
                "staff": staff.id,
                "leave_type": leave_type.id,
                "from_date": future.isoformat(),
                "to_date": future.isoformat(),
                "reason": "Emergency",
                "bypass_chain": True,
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == LeaveRequest.STATUS_APPROVED
        assert LeaveApprovalStep.objects.filter(leave_request_id=data["id"]).count() == 0


def _grant_permission(user, school, code):
    permission = Permission.objects.get(code=code)
    role = Role.objects.create(school=school, name=f"role-{user.username}")
    RolePermission.objects.create(role=role, permission=permission)
    UserRole.objects.create(user=user, role=role)
    return role


@pytest.mark.django_db
class TestApprovalChain:
    def _setup_teacher_and_hod(self, school):
        dept = Department.objects.create(school=school, name="Grade 6")
        designation = Designation.objects.create(school=school, department=dept, name="Teacher")

        hod_user = get_user_model().objects.create_user(
            username="hod_test", email="hod@example.com", password="TestPass@123",
            school=school, first_name="Hodder",
        )
        _grant_permission(hod_user, school, "human_resource.apply_leave.view")
        hod_staff = Staff.objects.create(
            school=school, user=hod_user, staff_no="HOD-1", first_name="Hodder",
            join_date="2026-01-01", status="active", department=dept,
        )
        dept.head = hod_staff
        dept.save(update_fields=["head"])

        teacher_user = get_user_model().objects.create_user(
            username="teacher_chain_test", email="teacher_chain@example.com", password="TestPass@123",
            school=school,
        )
        _grant_permission(teacher_user, school, "human_resource.apply_leave.view")
        teacher_staff = Staff.objects.create(
            school=school, user=teacher_user, staff_no="TCH-1", first_name="Teachy",
            join_date="2026-01-01", status="active", department=dept, designation=designation,
        )
        return designation, hod_user, teacher_user, teacher_staff

    def test_short_leave_needs_only_l1_hod(self, school):
        designation, hod_user, teacher_user, teacher_staff = self._setup_teacher_and_hod(school)
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation,
            l1_approver_role=ApprovalChainPolicy.ROLE_HOD,
            l2_approver_role=ApprovalChainPolicy.ROLE_HR_ADMIN,
            l2_trigger_days=5, response_window_days=2,
        )

        teacher_client = APIClient()
        teacher_client.force_authenticate(user=teacher_user)
        future = datetime.date.today() + datetime.timedelta(days=15)
        resp = teacher_client.post("/api/v1/hr/leave-requests/", {
            "leave_type": leave_type.id,
            "from_date": future.isoformat(),
            "to_date": (future + datetime.timedelta(days=1)).isoformat(),
            "reason": "Personal",
        })
        assert resp.status_code == 201, resp.content
        request_id = resp.json()["id"]
        steps = resp.json()["approval_steps"]
        assert len(steps) == 1
        assert steps[0]["role_label"] == ApprovalChainPolicy.ROLE_HOD
        assert steps[0]["approver_name"] == "Hodder"

        hod_client = APIClient()
        hod_client.force_authenticate(user=hod_user)
        resp = hod_client.post(f"/api/v1/hr/leave-requests/{request_id}/approve/", {"approval_note": "ok"})
        assert resp.status_code == 200, resp.content
        assert resp.json()["status"] == LeaveRequest.STATUS_APPROVED

    def test_long_leave_escalates_to_l2(self, school, admin_user):
        designation, hod_user, teacher_user, teacher_staff = self._setup_teacher_and_hod(school)
        leave_type = LeaveType.objects.create(school=school, name="Earned Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation,
            l1_approver_role=ApprovalChainPolicy.ROLE_HOD,
            l2_approver_role=ApprovalChainPolicy.ROLE_HR_ADMIN,
            l2_trigger_days=5, response_window_days=2,
        )

        teacher_client = APIClient()
        teacher_client.force_authenticate(user=teacher_user)
        future = datetime.date.today() + datetime.timedelta(days=30)
        resp = teacher_client.post("/api/v1/hr/leave-requests/", {
            "leave_type": leave_type.id,
            "from_date": future.isoformat(),
            "to_date": (future + datetime.timedelta(days=5)).isoformat(),
            "reason": "Trip",
        })
        assert resp.status_code == 201, resp.content
        request_id = resp.json()["id"]

        hod_client = APIClient()
        hod_client.force_authenticate(user=hod_user)
        resp = hod_client.post(f"/api/v1/hr/leave-requests/{request_id}/approve/", {"approval_note": "l1 ok"})
        assert resp.status_code == 200, resp.content
        assert resp.json()["next_step"] is True
        assert resp.json()["status"] == LeaveRequest.STATUS_PENDING

        leave_request = LeaveRequest.objects.get(pk=request_id)
        steps = list(leave_request.approval_steps.order_by("sequence"))
        assert len(steps) == 2
        assert steps[1].role_label == ApprovalChainPolicy.ROLE_HR_ADMIN
        assert steps[1].approver_id == admin_user.id

        admin_client_2 = APIClient()
        admin_client_2.force_authenticate(user=admin_user)
        resp = admin_client_2.post(f"/api/v1/hr/leave-requests/{request_id}/approve/", {"approval_note": "l2 ok"})
        assert resp.status_code == 200, resp.content
        assert resp.json()["status"] == LeaveRequest.STATUS_APPROVED

    def test_non_approver_cannot_act_on_pending_step(self, school):
        designation, hod_user, teacher_user, teacher_staff = self._setup_teacher_and_hod(school)
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation, l1_approver_role=ApprovalChainPolicy.ROLE_HOD,
        )

        teacher_client = APIClient()
        teacher_client.force_authenticate(user=teacher_user)
        future = datetime.date.today() + datetime.timedelta(days=15)
        resp = teacher_client.post("/api/v1/hr/leave-requests/", {
            "leave_type": leave_type.id, "from_date": future.isoformat(), "to_date": future.isoformat(),
            "reason": "Personal",
        })
        request_id = resp.json()["id"]

        # The requester themself is not the assigned approver (HOD) and
        # isn't an admin — must not be able to approve their own request.
        resp = teacher_client.post(f"/api/v1/hr/leave-requests/{request_id}/approve/")
        assert resp.status_code == 403

    def test_stuck_in_chain_detected_after_response_window(self, school):
        designation, hod_user, teacher_user, teacher_staff = self._setup_teacher_and_hod(school)
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation, l1_approver_role=ApprovalChainPolicy.ROLE_HOD,
            response_window_days=2,
        )

        teacher_client = APIClient()
        teacher_client.force_authenticate(user=teacher_user)
        future = datetime.date.today() + datetime.timedelta(days=15)
        resp = teacher_client.post("/api/v1/hr/leave-requests/", {
            "leave_type": leave_type.id, "from_date": future.isoformat(), "to_date": future.isoformat(),
            "reason": "Personal",
        })
        request_id = resp.json()["id"]

        step = LeaveApprovalStep.objects.get(leave_request_id=request_id, sequence=1)
        step.became_active_at = step.became_active_at - datetime.timedelta(days=5)
        step.save(update_fields=["became_active_at"])

        hod_client = APIClient()
        hod_client.force_authenticate(user=hod_user)
        resp = hod_client.get(f"/api/v1/hr/leave-requests/{request_id}/")
        assert resp.json()["days_stuck"] > 0

        resp = hod_client.get("/api/v1/hr/leave-requests/stats/")
        assert resp.json()["stuck_in_chain"] >= 1
