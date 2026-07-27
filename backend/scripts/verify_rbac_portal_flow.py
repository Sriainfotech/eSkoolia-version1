from __future__ import annotations

import json
from datetime import date
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.access_control.models import Permission, Role, UserRole
from apps.core.models import AcademicYear
from apps.hr.models import Staff
from apps.students.models import Guardian
from apps.tenancy.models import School, SchoolTenant


User = get_user_model()


def _resp_json(response):
    try:
        return response.json()
    except Exception:
        return {"raw": getattr(response, "content", b"")[:300].decode("utf-8", errors="ignore")}


def _check(condition: bool, label: str, details: str = ""):
    return {
        "ok": bool(condition),
        "label": label,
        "details": details,
    }


def run():
    if "testserver" not in settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS = list(settings.ALLOWED_HOSTS) + ["testserver"]

    suffix = uuid4().hex[:8]
    alpha_tail = "".join(ch for ch in uuid4().hex if ch.isalpha())[:4] or "flow"
    school = School.objects.create(
        name=f"Flow School {suffix}",
        code=f"FLOW{suffix[:6].upper()}",
        subdomain=f"flow-{suffix[:6]}",
        is_active=True,
    )

    tenant = SchoolTenant.objects.create(
        tenant_id=f"TEN-{suffix.upper()}",
        school=school,
        name=school.name,
        subdomain_url=school.subdomain,
        status="active",
        plan="trial",
        schema_name=f"school_{suffix}",
    )

    AcademicYear.objects.create(
        school=school,
        name="2026-27",
        start_date=date(2026, 6, 1),
        end_date=date(2027, 3, 31),
        is_active=True,
        is_current=True,
    )

    admin = User.objects.create_user(
        username=f"flow_admin_{suffix}",
        email=f"flow_admin_{suffix}@example.com",
        password="FlowPass@123",
        is_superuser=True,
        is_staff=True,
        school=school,
    )

    admin_client = APIClient()
    admin_client.force_authenticate(user=admin)

    base_permission = Permission.objects.filter(module="fees").order_by("id").first()
    if base_permission is None:
        base_permission = Permission.objects.create(
            code=f"fees.flow.{suffix}",
            name="Flow Fees Permission",
            module="fees",
        )

    teacher_role_payload = {
        "name": f"Flow Teacher {alpha_tail.title()}",
        "portal_type": "teacher",
        "permission_ids": [base_permission.id],
    }
    teacher_role_resp = admin_client.post("/api/v1/access-control/roles/", teacher_role_payload, format="json")
    teacher_role_data = _resp_json(teacher_role_resp)
    teacher_role_id = teacher_role_data.get("data", {}).get("id")
    if not teacher_role_id:
        role = Role.objects.create(
            school=school,
            name=f"Flow Teacher {alpha_tail.upper()}",
            portal_type="teacher",
            is_active=True,
        )
        role.permissions.add(base_permission)
        teacher_role_id = role.id

    class_teacher_role_payload = {
        "name": f"Flow Class Teacher {alpha_tail.title()}",
        "portal_type": "teacher",
        "permission_ids": [base_permission.id],
    }
    class_teacher_role_resp = admin_client.post(
        "/api/v1/access-control/roles/",
        class_teacher_role_payload,
        format="json",
    )
    class_teacher_role_data = _resp_json(class_teacher_role_resp)
    class_teacher_role_id = class_teacher_role_data.get("data", {}).get("id")
    if not class_teacher_role_id:
        class_teacher_role = Role.objects.create(
            school=school,
            name=f"Flow Class Teacher {alpha_tail.upper()}",
            portal_type="teacher",
            is_active=True,
        )
        class_teacher_role.permissions.add(base_permission)
        class_teacher_role_id = class_teacher_role.id

    parent_role = Role.objects.create(
        school=school,
        name=f"Flow Parent {suffix[:2]}",
        portal_type="parent",
        is_active=True,
    )
    parent_role.permissions.add(base_permission)

    student_role = Role.objects.create(
        school=school,
        name=f"Flow Student {suffix[:2]}",
        portal_type="student",
        is_active=True,
    )
    student_role.permissions.add(base_permission)

    teacher_user = User.objects.create_user(
        username=f"flow_teacher_{suffix}",
        email=f"flow_teacher_{suffix}@example.com",
        password="FlowPass@123",
        school=school,
        access_status=True,
    )

    staff = Staff.objects.create(
        school=school,
        user=teacher_user,
        role_id=teacher_role_id,
        staff_no=f"2026{suffix[:4]}",
        first_name="Flow",
        last_name="Teacher",
        email=teacher_user.email,
        join_date=date.today(),
    )

    # Base role assignment to staff user
    UserRole.objects.get_or_create(user=teacher_user, role_id=teacher_role_id)

    # Additional class-teacher role assignment via API (step 2 validation path)
    user_role_resp = admin_client.post(
        "/api/v1/access-control/user-roles/",
        {"user": teacher_user.id, "role": class_teacher_role_id},
        format="json",
    )

    parent_user = User.objects.create_user(
        username=f"flow_parent_{suffix}",
        email=f"flow_parent_{suffix}@example.com",
        password="FlowPass@123",
        school=school,
        access_status=True,
    )
    Guardian.objects.create(
        school=school,
        full_name="Flow Parent",
        relation="Father",
        phone=f"98{suffix[:8]}",
        email=parent_user.email,
        user=parent_user,
    )
    UserRole.objects.get_or_create(user=parent_user, role=parent_role)

    student_user = User.objects.create_user(
        username=f"flow_student_{suffix}",
        email=f"flow_student_{suffix}@example.com",
        password="FlowPass@123",
        school=school,
        access_status=True,
    )
    UserRole.objects.get_or_create(user=student_user, role=student_role)

    anon_client = APIClient()

    def login_and_me(username: str, password: str):
        login_resp = anon_client.post(
            "/api/v1/auth/login/",
            {"username": username, "password": password},
            format="json",
        )
        login_data = _resp_json(login_resp)
        access = login_data.get("access")

        me_status = None
        me_data = {}
        if access:
            me_resp = anon_client.get(
                "/api/v1/auth/me/",
                HTTP_AUTHORIZATION=f"Bearer {access}",
            )
            me_status = me_resp.status_code
            me_data = _resp_json(me_resp)

        return {
            "login_status": login_resp.status_code,
            "login": login_data,
            "me_status": me_status,
            "me": me_data,
            "access": access,
        }

    teacher_auth = login_and_me(teacher_user.username, "FlowPass@123")
    parent_auth = login_and_me(parent_user.username, "FlowPass@123")
    student_auth = login_and_me(student_user.username, "FlowPass@123")

    teacher_api_status = anon_client.get(
        "/api/v1/teacher/me/",
        HTTP_AUTHORIZATION=f"Bearer {teacher_auth.get('access', '')}",
    ).status_code
    parent_api_status = anon_client.get(
        "/api/v1/parent/me/",
        HTTP_AUTHORIZATION=f"Bearer {parent_auth.get('access', '')}",
    ).status_code
    parent_api_with_student_status = anon_client.get(
        "/api/v1/parent/me/",
        HTTP_AUTHORIZATION=f"Bearer {student_auth.get('access', '')}",
    ).status_code
    teacher_api_with_parent_status = anon_client.get(
        "/api/v1/teacher/me/",
        HTTP_AUTHORIZATION=f"Bearer {parent_auth.get('access', '')}",
    ).status_code

    checks = [
        _check(teacher_role_resp.status_code == 201, "Create teacher role"),
        _check(class_teacher_role_resp.status_code == 201, "Create class-teacher role"),
        _check(user_role_resp.status_code in (200, 201), "Assign extra role to staff user via API"),
        _check(teacher_auth["login_status"] == 200, "Teacher login"),
        _check(teacher_auth["me_status"] == 200, "Teacher /auth/me"),
        _check(teacher_auth["me"].get("portal_type") == "teacher", "Teacher portal_type"),
        _check(
            base_permission.code in (teacher_auth["me"].get("permission_codes") or []),
            "Teacher permission_codes include assigned permission",
        ),
        _check(parent_auth["me"].get("portal_type") == "parent", "Parent portal_type"),
        _check(student_auth["me"].get("portal_type") == "student", "Student portal_type"),
        _check(teacher_auth["login"].get("school_code") == school.subdomain, "Login school_code matches school tenancy subdomain"),
        _check(teacher_auth["login"].get("tenant_id") == tenant.tenant_id, "Login tenant_id matches SchoolTenant"),
        _check(teacher_auth["me"].get("school_name") == school.name, "Teacher school_name from tenancy school"),
        _check(parent_auth["me"].get("school_name") == school.name, "Parent school_name from tenancy school"),
        _check(student_auth["me"].get("school_name") == school.name, "Student school_name from tenancy school"),
        _check(teacher_api_status == 200, "Teacher can access /teacher/me"),
        _check(parent_api_status == 200, "Parent can access /parent/me"),
        _check(parent_api_with_student_status in (401, 403), "Student blocked from /parent/me"),
        _check(teacher_api_with_parent_status in (401, 403), "Parent blocked from /teacher/me"),
    ]

    result = {
        "school": {"id": school.id, "name": school.name, "subdomain": school.subdomain},
        "roles": {
            "teacher_role_id": teacher_role_id,
            "class_teacher_role_id": class_teacher_role_id,
            "parent_role_id": parent_role.id,
            "student_role_id": student_role.id,
        },
        "users": {
            "teacher_user": teacher_user.username,
            "parent_user": parent_user.username,
            "student_user": student_user.username,
            "staff_id": staff.id,
        },
        "statuses": {
            "create_teacher_role": teacher_role_resp.status_code,
            "create_class_teacher_role": class_teacher_role_resp.status_code,
            "assign_user_role": user_role_resp.status_code,
            "teacher_login": teacher_auth["login_status"],
            "teacher_me": teacher_auth["me_status"],
            "parent_login": parent_auth["login_status"],
            "parent_me": parent_auth["me_status"],
            "student_login": student_auth["login_status"],
            "student_me": student_auth["me_status"],
            "teacher_api": teacher_api_status,
            "parent_api": parent_api_status,
            "student_to_parent_api": parent_api_with_student_status,
            "parent_to_teacher_api": teacher_api_with_parent_status,
        },
        "checks": checks,
        "failed_checks": [c for c in checks if not c["ok"]],
    }

    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    run()
