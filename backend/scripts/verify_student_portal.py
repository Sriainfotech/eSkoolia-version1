from __future__ import annotations

import json
from uuid import uuid4

from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient

from apps.access_control.models import Role, UserRole
from apps.students.models import Student
from apps.tenancy.models import School


User = get_user_model()


def run():
    if "testserver" not in settings.ALLOWED_HOSTS:
        settings.ALLOWED_HOSTS = list(settings.ALLOWED_HOSTS) + ["testserver"]

    suffix = uuid4().hex[:8]
    school = School.objects.create(name=f"Student Flow {suffix}", code=f"SF{suffix[:6].upper()}", is_active=True)

    student_role = Role.objects.create(
        school=school,
        name=f"Student Role {''.join(ch for ch in suffix if ch.isalpha())[:4].title() or 'Flow'}",
        portal_type="student",
        is_active=True,
    )

    student = Student.objects.filter(user__isnull=False, school__is_active=True).select_related("user", "school").first()
    if student is None or student.user is None:
        print(json.dumps({"error": "No existing linked student user found to validate /api/v1/student/me/"}, indent=2))
        return

    student_user = student.user
    student_user.school_id = student.school_id
    student_user.set_password("Student@123")
    student_user.access_status = True
    student_user.save(update_fields=["school", "password", "access_status"])

    UserRole.objects.get_or_create(user=student_user, role=student_role)

    client = APIClient()
    login_resp = client.post(
        "/api/v1/auth/login/",
        {"username": student_user.username, "password": "Student@123"},
        format="json",
    )
    login_data = login_resp.json()
    access = login_data.get("access")

    me_resp = client.get("/api/v1/student/me/", HTTP_AUTHORIZATION=f"Bearer {access}")

    result = {
        "login_status": login_resp.status_code,
        "student_me_status": me_resp.status_code,
        "student_me": me_resp.json() if me_resp.status_code == 200 else {},
        "checks": {
            "portal_type": login_data.get("portal_type") == "student",
            "student_endpoint_ok": me_resp.status_code == 200,
            "student_name_ok": (me_resp.json().get("name") or "").startswith("Portal") if me_resp.status_code == 200 else False,
        },
        "student_id": student.id,
        "user": student_user.username,
    }
    print(json.dumps(result, indent=2))


if __name__ == "__main__":
    run()
