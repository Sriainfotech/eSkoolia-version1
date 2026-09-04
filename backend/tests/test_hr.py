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

    def test_bypass_chain_rejected_for_non_admin_even_with_permission(self, school, teacher_user):
        """Holding the apply_on_behalf permission code alone must not be
        enough — bypass_chain=True is restricted to school admins, same
        rule as Admin Approved."""
        _grant_permission(teacher_user, school, "human_resource.apply_leave.apply_on_behalf")
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff = _make_staff(school, "OB-NONADMIN")
        future = datetime.date.today() + datetime.timedelta(days=10)

        client = APIClient()
        client.force_authenticate(user=teacher_user)
        resp = client.post(
            "/api/v1/hr/leave-requests/apply-on-behalf/",
            {
                "staff": staff.id, "leave_type": leave_type.id,
                "from_date": future.isoformat(), "to_date": future.isoformat(),
                "reason": "Emergency", "bypass_chain": True, "approval_note": "trying anyway",
            },
        )
        assert resp.status_code == 403
        assert not LeaveRequest.objects.filter(staff_id=staff.id).exists()

    def test_bypass_chain_requires_a_reason(self, admin_client, school):
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff = _make_staff(school, "OB-NOREASON")
        future = datetime.date.today() + datetime.timedelta(days=10)

        resp = admin_client.post(
            "/api/v1/hr/leave-requests/apply-on-behalf/",
            {
                "staff": staff.id, "leave_type": leave_type.id,
                "from_date": future.isoformat(), "to_date": future.isoformat(),
                "reason": "Emergency", "bypass_chain": True,
            },
        )
        assert resp.status_code == 400
        assert not LeaveRequest.objects.filter(staff_id=staff.id).exists()

    def test_bypass_chain_creates_bypassed_steps_and_approves_immediately(self, admin_client, school, admin_user):
        """Full end-to-end: admin bypasses at creation time on a request
        long enough to require L2 — both levels must be resolved via the
        normal approval-chain logic, created as `bypassed`, with the
        original approver preserved and `acted_by`/override flag set."""
        dept = Department.objects.create(school=school, name="OB Bypass Dept")
        designation = Designation.objects.create(school=school, department=dept, name="Teacher")
        hod_role = Role.objects.create(school=school, name="HOD")
        principal_role = Role.objects.create(school=school, name="Principal")

        hod_user = get_user_model().objects.create_user(
            username="ob_hod", email="ob_hod@example.com", password="TestPass@123", school=school,
        )
        hod_staff = Staff.objects.create(
            school=school, user=hod_user, staff_no="OB-HOD-1", first_name="OBHodder",
            join_date="2026-01-01", status="active", department=dept,
        )
        dept.head = hod_staff
        dept.save(update_fields=["head"])

        principal_user = get_user_model().objects.create_user(
            username="ob_principal", email="ob_principal@example.com", password="TestPass@123", school=school,
        )
        principal_designation = Designation.objects.create(school=school, department=dept, name="Principal")
        Staff.objects.create(
            school=school, user=principal_user, staff_no="OB-PRIN-1", first_name="OBPrincipal",
            join_date="2026-01-01", status="active", designation=principal_designation,
        )

        ApprovalChainPolicy.objects.create(
            school=school, designation=designation, l1_approver_role=hod_role,
            l2_approver_role=principal_role, l2_trigger_days=2, response_window_days=2,
        )

        leave_type = LeaveType.objects.create(school=school, name="Earned Leave", max_days_per_year=30)
        staff = _make_staff(school, "OB-BYPASS-1", department=dept)
        staff.designation = designation
        staff.save(update_fields=["designation"])
        future = datetime.date.today() + datetime.timedelta(days=10)

        resp = admin_client.post(
            "/api/v1/hr/leave-requests/apply-on-behalf/",
            {
                "staff": staff.id, "leave_type": leave_type.id,
                "from_date": future.isoformat(),
                "to_date": (future + datetime.timedelta(days=4)).isoformat(),  # 5 days -> L2 required
                "reason": "Emergency", "bypass_chain": True,
                "approval_note": "Both normal approvers are unavailable.",
            },
        )
        assert resp.status_code == 201, resp.content
        data = resp.json()
        assert data["status"] == LeaveRequest.STATUS_APPROVED
        assert data["approved_via_admin_override"] is True

        leave_request = LeaveRequest.objects.get(pk=data["id"])
        assert leave_request.approved_via_admin_override is True
        assert leave_request.approved_by_id == admin_user.id

        steps = list(leave_request.approval_steps.order_by("sequence"))
        assert len(steps) == 2
        assert all(s.status == LeaveApprovalStep.STATUS_BYPASSED for s in steps)
        assert steps[0].approver_id == hod_user.id  # original L1 assignment
        assert steps[1].approver_id == principal_user.id  # original L2 assignment
        assert steps[0].acted_by_id == admin_user.id
        assert steps[1].acted_by_id == admin_user.id
        assert steps[0].note == "Both normal approvers are unavailable."

        # Balance handling: same accounting path as a normal approval.
        from apps.settings.models import LeaveBalance
        balance = LeaveBalance.objects.get(staff_id=staff.id, leave_type_id=leave_type.id, year=future.year)
        assert balance.used_days == 5

    def test_normal_apply_on_behalf_unaffected_by_bypass_changes(self, admin_client, school, admin_user):
        """Sanity check that the refactor didn't change the non-bypass path:
        still starts a normal chain, still ends up pending."""
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=10)
        staff = _make_staff(school, "OB-NORMAL-1")
        future = datetime.date.today() + datetime.timedelta(days=10)

        resp = admin_client.post(
            "/api/v1/hr/leave-requests/apply-on-behalf/",
            {
                "staff": staff.id, "leave_type": leave_type.id,
                "from_date": future.isoformat(), "to_date": future.isoformat(),
                "reason": "Family function",
            },
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["status"] == LeaveRequest.STATUS_PENDING
        assert data["approved_via_admin_override"] is False
        assert len(data["approval_steps"]) == 1
        assert data["approval_steps"][0]["status"] == "pending"


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
        hod_role = Role.objects.create(school=school, name="HOD")
        hr_admin_role = Role.objects.create(school=school, name="HR Admin")

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
        return designation, hod_user, teacher_user, teacher_staff, hod_role, hr_admin_role

    def test_short_leave_needs_only_l1_hod(self, school):
        designation, hod_user, teacher_user, teacher_staff, hod_role, hr_admin_role = self._setup_teacher_and_hod(school)
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation,
            l1_approver_role=hod_role,
            l2_approver_role=hr_admin_role,
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
        assert steps[0]["role_label"] == hod_role.name
        assert steps[0]["approver_name"] == "Hodder"

        hod_client = APIClient()
        hod_client.force_authenticate(user=hod_user)
        resp = hod_client.post(f"/api/v1/hr/leave-requests/{request_id}/approve/", {"approval_note": "ok"})
        assert resp.status_code == 200, resp.content
        assert resp.json()["status"] == LeaveRequest.STATUS_APPROVED

    def test_long_leave_escalates_to_l2(self, school, admin_user):
        designation, hod_user, teacher_user, teacher_staff, hod_role, hr_admin_role = self._setup_teacher_and_hod(school)
        leave_type = LeaveType.objects.create(school=school, name="Earned Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation,
            l1_approver_role=hod_role,
            l2_approver_role=hr_admin_role,
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
        assert steps[1].role_label == hr_admin_role.name
        assert steps[1].approver_id == admin_user.id

        admin_client_2 = APIClient()
        admin_client_2.force_authenticate(user=admin_user)
        resp = admin_client_2.post(f"/api/v1/hr/leave-requests/{request_id}/approve/", {"approval_note": "l2 ok"})
        assert resp.status_code == 200, resp.content
        assert resp.json()["status"] == LeaveRequest.STATUS_APPROVED

    def test_non_approver_cannot_act_on_pending_step(self, school):
        designation, hod_user, teacher_user, teacher_staff, hod_role, hr_admin_role = self._setup_teacher_and_hod(school)
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation, l1_approver_role=hod_role,
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
        designation, hod_user, teacher_user, teacher_staff, hod_role, hr_admin_role = self._setup_teacher_and_hod(school)
        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation, l1_approver_role=hod_role,
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

    def test_department_scoped_policy_beats_designation_only_policy(self, school):
        """A rule scoped to (designation, department) must win over a rule
        scoped to (designation, any department) for staff in that department,
        while staff in a different department still get the general rule."""
        dept_a = Department.objects.create(school=school, name="Science")
        dept_b = Department.objects.create(school=school, name="Arts")
        designation = Designation.objects.create(school=school, department=dept_a, name="Teacher")
        general_role = Role.objects.create(school=school, name="General Approver")
        science_role = Role.objects.create(school=school, name="Science Approver")

        general_approver_user = get_user_model().objects.create_user(
            username="general_approver", email="general_approver@example.com", password="TestPass@123", school=school,
        )
        _grant_permission(general_approver_user, school, "human_resource.apply_leave.view")
        Staff.objects.create(
            school=school, user=general_approver_user, staff_no="GA-1", first_name="General",
            join_date="2026-01-01", status="active", designation=Designation.objects.create(
                school=school, department=dept_b, name="General Approver",
            ),
        )

        science_approver_user = get_user_model().objects.create_user(
            username="science_approver", email="science_approver@example.com", password="TestPass@123", school=school,
        )
        _grant_permission(science_approver_user, school, "human_resource.apply_leave.view")
        Staff.objects.create(
            school=school, user=science_approver_user, staff_no="SA-1", first_name="Sciencey",
            join_date="2026-01-01", status="active", department=dept_a, designation=Designation.objects.create(
                school=school, department=dept_a, name="Science Approver",
            ),
        )

        # General rule: any Teacher, any department -> General Approver.
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation, department=None, l1_approver_role=general_role,
        )
        # More specific rule: Teacher in Science dept -> Science Approver.
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation, department=dept_a, l1_approver_role=science_role,
        )

        science_teacher_user = get_user_model().objects.create_user(
            username="science_teacher", email="science_teacher@example.com", password="TestPass@123", school=school,
        )
        Staff.objects.create(
            school=school, user=science_teacher_user, staff_no="TCH-SCI", first_name="SciTeacher",
            join_date="2026-01-01", status="active", department=dept_a, designation=designation,
        )

        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        client = APIClient()
        client.force_authenticate(user=science_teacher_user)
        future = datetime.date.today() + datetime.timedelta(days=15)
        resp = client.post("/api/v1/hr/leave-requests/", {
            "leave_type": leave_type.id, "from_date": future.isoformat(), "to_date": future.isoformat(),
            "reason": "Personal",
        })
        assert resp.status_code == 201, resp.content
        assert resp.json()["approval_steps"][0]["approver_name"] == "Sciencey"

    def test_reporting_manager_resolves_l1_bypassing_role_matching(self, school):
        """When Staff.reporting_manager is set, it must be used as L1
        directly — even for a designation with no matching Role/Designation
        naming at all — and it must win over any configured policy role."""
        manager_user = get_user_model().objects.create_user(
            username="rm_manager", email="rm_manager@example.com", password="TestPass@123", school=school,
        )
        _grant_permission(manager_user, school, "human_resource.apply_leave.view")
        manager_staff = Staff.objects.create(
            school=school, user=manager_user, staff_no="MGR-1", first_name="Manager",
            join_date="2026-01-01", status="active",
        )

        # A policy role exists too, resolving to nobody (no Designation
        # named "Nonexistent Role") — the Reporting Manager path must still
        # win regardless.
        unmatched_role = Role.objects.create(school=school, name="Nonexistent Role")
        ApprovalChainPolicy.objects.create(school=school, designation=None, department=None, l1_approver_role=unmatched_role)

        report_user = get_user_model().objects.create_user(
            username="rm_report", email="rm_report@example.com", password="TestPass@123", school=school,
        )
        Staff.objects.create(
            school=school, user=report_user, staff_no="EMP-1", first_name="Reportee",
            join_date="2026-01-01", status="active", reporting_manager=manager_staff,
        )

        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        client = APIClient()
        client.force_authenticate(user=report_user)
        future = datetime.date.today() + datetime.timedelta(days=15)
        resp = client.post("/api/v1/hr/leave-requests/", {
            "leave_type": leave_type.id, "from_date": future.isoformat(), "to_date": future.isoformat(),
            "reason": "Personal",
        })
        assert resp.status_code == 201, resp.content
        assert resp.json()["approval_steps"][0]["approver_name"] == "Manager"

    def test_self_reference_reporting_manager_is_ignored(self, school):
        """A staff member accidentally set as their own reporting manager
        must never become their own approver — the resolver falls through
        to the next fallback instead of resolving to self."""
        user = get_user_model().objects.create_user(
            username="self_ref_user", email="self_ref@example.com", password="TestPass@123", school=school,
        )
        staff = Staff.objects.create(
            school=school, user=user, staff_no="SR-1", first_name="Selfy",
            join_date="2026-01-01", status="active",
        )
        staff.reporting_manager = staff
        staff.save(update_fields=["reporting_manager"])

        from apps.hr.approval_chain import get_policy_for_staff, resolve_l1_approver
        fresh = Staff.objects.select_related("reporting_manager__user").get(pk=staff.pk)
        approver, _label = resolve_l1_approver(fresh, get_policy_for_staff(fresh))
        assert approver is None or approver.id != user.id

    def test_l1_and_l2_same_person_is_not_asked_twice(self, school):
        """If L1 and L2 would resolve to the same person (e.g. via the
        Reporting Manager chain), only one approval step is ever created —
        approving L1 fully approves the request."""
        manager_user = get_user_model().objects.create_user(
            username="dedup_manager", email="dedup_manager@example.com", password="TestPass@123", school=school,
        )
        _grant_permission(manager_user, school, "human_resource.apply_leave.view")
        manager_staff = Staff.objects.create(
            school=school, user=manager_user, staff_no="DM-1", first_name="DedupManager",
            join_date="2026-01-01", status="active",
        )

        report_user = get_user_model().objects.create_user(
            username="dedup_report", email="dedup_report@example.com", password="TestPass@123", school=school,
        )
        report_staff = Staff.objects.create(
            school=school, user=report_user, staff_no="DR-1", first_name="DedupReport",
            join_date="2026-01-01", status="active", reporting_manager=manager_staff,
        )

        manager_role = Role.objects.create(school=school, name="DedupManagerRole")
        manager_designation = Designation.objects.create(
            school=school, department=Department.objects.create(school=school, name="Dedup Dept"), name="DedupManagerRole",
        )
        manager_staff.designation = manager_designation
        manager_staff.save(update_fields=["designation"])

        # L2 policy role also resolves to the exact same manager (via
        # Designation-name match) — with no Reporting Manager-of-manager
        # available, L2 falls back to this role and must be recognized as
        # a duplicate of L1.
        ApprovalChainPolicy.objects.create(
            school=school, designation=report_staff.designation, department=report_staff.department,
            l2_approver_role=manager_role, l2_trigger_days=1, response_window_days=2,
        )

        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        client = APIClient()
        client.force_authenticate(user=report_user)
        future = datetime.date.today() + datetime.timedelta(days=15)
        resp = client.post("/api/v1/hr/leave-requests/", {
            "leave_type": leave_type.id, "from_date": future.isoformat(),
            "to_date": (future + datetime.timedelta(days=1)).isoformat(),
            "reason": "Trip",
        })
        assert resp.status_code == 201, resp.content
        request_id = resp.json()["id"]

        manager_client = APIClient()
        manager_client.force_authenticate(user=manager_user)
        resp = manager_client.post(f"/api/v1/hr/leave-requests/{request_id}/approve/", {"approval_note": "ok"})
        assert resp.status_code == 200, resp.content
        assert resp.json()["status"] == LeaveRequest.STATUS_APPROVED

        leave_request = LeaveRequest.objects.get(pk=request_id)
        assert leave_request.approval_steps.count() == 1


@pytest.mark.django_db
class TestAdminApprove:
    def _create_pending_request(self, school, days=1):
        dept = Department.objects.create(school=school, name="Admin Approve Dept")
        designation = Designation.objects.create(school=school, department=dept, name="Teacher")
        hod_role = Role.objects.create(school=school, name="HOD")

        hod_user = get_user_model().objects.create_user(
            username="aa_hod", email="aa_hod@example.com", password="TestPass@123", school=school,
        )
        _grant_permission(hod_user, school, "human_resource.apply_leave.view")
        hod_staff = Staff.objects.create(
            school=school, user=hod_user, staff_no="AA-HOD-1", first_name="AAHodder",
            join_date="2026-01-01", status="active", department=dept,
        )
        dept.head = hod_staff
        dept.save(update_fields=["head"])

        teacher_user = get_user_model().objects.create_user(
            username="aa_teacher", email="aa_teacher@example.com", password="TestPass@123", school=school,
        )
        teacher_staff = Staff.objects.create(
            school=school, user=teacher_user, staff_no="AA-TCH-1", first_name="AATeachy",
            join_date="2026-01-01", status="active", department=dept, designation=designation,
        )

        leave_type = LeaveType.objects.create(school=school, name="Casual Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation, l1_approver_role=hod_role,
        )

        client = APIClient()
        client.force_authenticate(user=teacher_user)
        future = datetime.date.today() + datetime.timedelta(days=20)
        resp = client.post("/api/v1/hr/leave-requests/", {
            "leave_type": leave_type.id, "from_date": future.isoformat(),
            "to_date": (future + datetime.timedelta(days=days - 1)).isoformat(),
            "reason": "Personal",
        })
        assert resp.status_code == 201, resp.content
        return resp.json()["id"], hod_user, teacher_user

    def test_non_admin_cannot_admin_approve(self, school):
        """A normal L1 approver — even the one actually assigned to the
        pending step — must be rejected, not just anyone."""
        request_id, hod_user, _teacher_user = self._create_pending_request(school)
        client = APIClient()
        client.force_authenticate(user=hod_user)
        resp = client.post(f"/api/v1/hr/leave-requests/{request_id}/admin-approve/", {"reason": "trying anyway"})
        assert resp.status_code == 403

    def test_admin_approve_requires_a_reason(self, school, admin_user):
        request_id, _hod_user, _teacher_user = self._create_pending_request(school)
        client = APIClient()
        client.force_authenticate(user=admin_user)
        resp = client.post(f"/api/v1/hr/leave-requests/{request_id}/admin-approve/", {"reason": "   "})
        assert resp.status_code == 400

    def test_admin_approve_bypasses_chain_and_preserves_original_assignment(self, school, admin_user):
        request_id, hod_user, _teacher_user = self._create_pending_request(school)

        client = APIClient()
        client.force_authenticate(user=admin_user)
        resp = client.post(f"/api/v1/hr/leave-requests/{request_id}/admin-approve/", {
            "reason": "Both normal approvers are unavailable.",
        })
        assert resp.status_code == 200, resp.content
        assert resp.json()["status"] == LeaveRequest.STATUS_APPROVED
        assert resp.json()["approved_via_admin_override"] is True

        leave_request = LeaveRequest.objects.get(pk=request_id)
        assert leave_request.status == LeaveRequest.STATUS_APPROVED
        assert leave_request.approved_via_admin_override is True
        assert leave_request.approved_by_id == admin_user.id

        step = leave_request.approval_steps.get(sequence=1)
        assert step.status == LeaveApprovalStep.STATUS_BYPASSED
        assert step.approver_id == hod_user.id  # original assignment untouched
        assert step.acted_by_id == admin_user.id  # actual actor recorded separately
        assert step.note == "Both normal approvers are unavailable."

    def test_admin_approve_synthesizes_bypassed_l2_when_never_reached(self, school, admin_user):
        """Bypassing while still at L1 must still show L2 in history as
        bypassed if the policy would have required it, per the audit spec."""
        dept = Department.objects.create(school=school, name="Admin Approve L2 Dept")
        designation = Designation.objects.create(school=school, department=dept, name="Teacher")
        hod_role = Role.objects.create(school=school, name="HOD")
        principal_role = Role.objects.create(school=school, name="Principal")

        hod_user = get_user_model().objects.create_user(
            username="aa2_hod", email="aa2_hod@example.com", password="TestPass@123", school=school,
        )
        hod_staff = Staff.objects.create(
            school=school, user=hod_user, staff_no="AA2-HOD-1", first_name="AA2Hodder",
            join_date="2026-01-01", status="active", department=dept,
        )
        dept.head = hod_staff
        dept.save(update_fields=["head"])

        principal_user = get_user_model().objects.create_user(
            username="aa2_principal", email="aa2_principal@example.com", password="TestPass@123", school=school,
        )
        principal_designation = Designation.objects.create(school=school, department=dept, name="Principal")
        Staff.objects.create(
            school=school, user=principal_user, staff_no="AA2-PRIN-1", first_name="AA2Principal",
            join_date="2026-01-01", status="active", designation=principal_designation,
        )

        teacher_user = get_user_model().objects.create_user(
            username="aa2_teacher", email="aa2_teacher@example.com", password="TestPass@123", school=school,
        )
        Staff.objects.create(
            school=school, user=teacher_user, staff_no="AA2-TCH-1", first_name="AA2Teachy",
            join_date="2026-01-01", status="active", department=dept, designation=designation,
        )

        leave_type = LeaveType.objects.create(school=school, name="Earned Leave", max_days_per_year=30)
        ApprovalChainPolicy.objects.create(
            school=school, designation=designation, l1_approver_role=hod_role,
            l2_approver_role=principal_role, l2_trigger_days=2, response_window_days=2,
        )

        client = APIClient()
        client.force_authenticate(user=teacher_user)
        future = datetime.date.today() + datetime.timedelta(days=20)
        resp = client.post("/api/v1/hr/leave-requests/", {
            "leave_type": leave_type.id, "from_date": future.isoformat(),
            "to_date": (future + datetime.timedelta(days=4)).isoformat(),  # 5 days -> L2 required
            "reason": "Trip",
        })
        assert resp.status_code == 201, resp.content
        request_id = resp.json()["id"]

        leave_request = LeaveRequest.objects.get(pk=request_id)
        assert leave_request.approval_steps.count() == 1  # only L1 exists so far

        admin_client = APIClient()
        admin_client.force_authenticate(user=admin_user)
        resp = admin_client.post(f"/api/v1/hr/leave-requests/{request_id}/admin-approve/", {
            "reason": "Both normal approvers are unavailable.",
        })
        assert resp.status_code == 200, resp.content

        leave_request.refresh_from_db()
        steps = list(leave_request.approval_steps.order_by("sequence"))
        assert len(steps) == 2
        assert all(s.status == LeaveApprovalStep.STATUS_BYPASSED for s in steps)
        assert steps[0].approver_id == hod_user.id
        assert steps[1].approver_id == principal_user.id
        assert leave_request.status == LeaveRequest.STATUS_APPROVED

    def test_normal_approve_no_longer_overwrites_original_approver(self, school, admin_user):
        """A school admin acting on someone else's step via the *normal*
        approve endpoint must still record who actually acted (acted_by)
        without erasing who it was originally assigned to (approver)."""
        request_id, hod_user, _teacher_user = self._create_pending_request(school)

        client = APIClient()
        client.force_authenticate(user=admin_user)
        resp = client.post(f"/api/v1/hr/leave-requests/{request_id}/approve/", {"approval_note": "admin standing in"})
        assert resp.status_code == 200, resp.content

        step = LeaveApprovalStep.objects.get(leave_request_id=request_id, sequence=1)
        assert step.approver_id == hod_user.id
        assert step.acted_by_id == admin_user.id
