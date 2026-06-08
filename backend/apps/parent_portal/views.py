"""
Parent Portal API views.

Data-scope rule: every query starts from request.user.guardian_profile.
Never trust URL params to identify which student to load — always assert
that the student belongs to the authenticated guardian.
"""

import calendar
from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, DecimalField, OuterRef, Q, Subquery, Sum, Value
from django.db.models.functions import Coalesce
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from .permissions import IsParentPortalUser


class ParentMeView(APIView):
    """
    GET /api/v1/parent/me/

    Returns the guardian's profile plus a lightweight children list
    (name, class, section — no heavy stats so the home screen loads fast).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsParentPortalUser]

    def get(self, request):
        guardian = request.user.guardian_profile

        children = (
            guardian.students.select_related("current_class", "current_section")
            .filter(status="active")
            .order_by("first_name", "last_name")
        )

        children_data = [
            {
                "id": s.id,
                "name": f"{s.first_name} {s.last_name}".strip(),
                "admission_no": s.admission_no,
                "roll_no": s.roll_no,
                "class_name": s.current_class.name if s.current_class else "",
                "section_name": s.current_section.name if s.current_section else "",
                "class_id": s.current_class_id,
                "section_id": s.current_section_id,
                "photo_url": s.photo or None,
                "gender": s.gender,
            }
            for s in children
        ]

        return Response(
            {
                "guardian_id": guardian.id,
                "name": guardian.full_name,
                "relation": guardian.relation,
                "phone": guardian.phone,
                "email": guardian.email,
                "occupation": guardian.occupation,
                "children": children_data,
                "children_count": len(children_data),
            }
        )


class ChildrenListView(APIView):
    """
    GET /api/v1/parent/children/

    Returns the guardian's children with attendance stats (last 90 days).
    Used by the My Children screen for the summary cards.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsParentPortalUser]

    def get(self, request):
        guardian = request.user.guardian_profile

        children = (
            guardian.students.select_related("current_class", "current_section")
            .filter(status="active")
            .order_by("first_name", "last_name")
        )

        student_ids = [s.id for s in children]

        # Bulk attendance query — last 90 days, one DB round-trip
        cutoff = date.today() - timedelta(days=90)
        from apps.attendance.models import StudentAttendance

        att_map = {
            row["student_id"]: row
            for row in StudentAttendance.objects.filter(
                student_id__in=student_ids,
                attendance_date__gte=cutoff,
            )
            .values("student_id")
            .annotate(
                present=Count("id", filter=Q(attendance_type="P")),
                late=Count("id", filter=Q(attendance_type="L")),
                total=Count("id", filter=~Q(attendance_type="H")),
            )
        }

        result = []
        for s in children:
            att = att_map.get(s.id)
            if att and att["total"] > 0:
                pct = round((att["present"] + att["late"]) / att["total"] * 100, 1)
            else:
                pct = None

            result.append(
                {
                    "id": s.id,
                    "name": f"{s.first_name} {s.last_name}".strip(),
                    "admission_no": s.admission_no,
                    "roll_no": s.roll_no,
                    "class_name": s.current_class.name if s.current_class else "",
                    "section_name": s.current_section.name if s.current_section else "",
                    "class_id": s.current_class_id,
                    "section_id": s.current_section_id,
                    "photo_url": s.photo or None,
                    "gender": s.gender,
                    "attendance_pct": pct,
                }
            )

        return Response(result)


class ChildDetailView(APIView):
    """
    GET /api/v1/parent/children/<id>/

    Returns one child's full profile: basic info, 90-day attendance summary,
    recent exam marks, and behaviour points total.

    The child must belong to the authenticated guardian — returns 404 otherwise
    (same as "not found" to avoid enumeration attacks).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsParentPortalUser]

    def get(self, request, pk):
        guardian = request.user.guardian_profile
        from apps.students.models import Student

        try:
            student = Student.objects.select_related(
                "current_class", "current_section"
            ).get(id=pk, guardian=guardian, status="active")
        except Student.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        # ── Attendance — last 90 days ──────────────────────────────────────────
        cutoff = date.today() - timedelta(days=90)
        from apps.attendance.models import StudentAttendance

        att = StudentAttendance.objects.filter(
            student=student,
            school=student.school,
            attendance_date__gte=cutoff,
        ).aggregate(
            present=Count("id", filter=Q(attendance_type="P")),
            late=Count("id", filter=Q(attendance_type="L")),
            absent=Count("id", filter=Q(attendance_type="A")),
            half_day=Count("id", filter=Q(attendance_type="F")),
            total=Count("id", filter=~Q(attendance_type="H")),
        )

        att_pct = None
        if att["total"]:
            att_pct = round((att["present"] + att["late"]) / att["total"] * 100, 1)

        # ── Recent exam marks ─────────────────────────────────────────────────
        from apps.exams.models import ExamMark

        marks_qs = ExamMark.objects.select_related(
            "exam", "exam__exam_type", "schedule__subject"
        ).filter(
            student=student,
            school=student.school,
        ).order_by("exam__exam_type__title", "schedule__exam_date")

        marks_data = []
        for m in marks_qs:
            try:
                marks_data.append(
                    {
                        "subject": m.schedule.subject.name if (m.schedule and m.schedule.subject) else "",
                        "exam_name": m.exam.name if m.exam else "",
                        "term": m.exam.exam_type.title if (m.exam and m.exam.exam_type) else "",
                        "obtained": float(m.obtained_marks) if m.obtained_marks is not None else 0.0,
                        "full_marks": float(m.schedule.full_marks) if (m.schedule and m.schedule.full_marks) else 100.0,
                        "pass_marks": float(m.schedule.pass_marks) if (m.schedule and m.schedule.pass_marks) else 33.0,
                        "absent": m.absent,
                        "exam_date": m.schedule.exam_date.isoformat() if (m.schedule and m.schedule.exam_date) else None,
                    }
                )
            except Exception:
                continue

        # ── Behaviour points ──────────────────────────────────────────────────
        from apps.behaviour.models import AssignedIncident

        beh = AssignedIncident.objects.filter(
            student=student,
            school=student.school,
        ).aggregate(total=Sum("point"))
        behaviour_points = beh["total"] or 0

        return Response(
            {
                "id": student.id,
                "name": f"{student.first_name} {student.last_name}".strip(),
                "first_name": student.first_name,
                "last_name": student.last_name,
                "admission_no": student.admission_no,
                "roll_no": student.roll_no,
                "class_name": student.current_class.name if student.current_class else "",
                "section_name": student.current_section.name if student.current_section else "",
                "class_id": student.current_class_id,
                "section_id": student.current_section_id,
                "photo_url": student.photo or None,
                "gender": student.gender,
                "date_of_birth": student.date_of_birth.isoformat() if student.date_of_birth else None,
                "blood_group": student.blood_group,
                "attendance": {
                    "present": att["present"],
                    "late": att["late"],
                    "absent": att["absent"],
                    "half_day": att["half_day"],
                    "total": att["total"],
                    "pct": att_pct,
                },
                "recent_marks": marks_data,
                "behaviour_points": behaviour_points,
            }
        )


class ChildAttendanceCalendarView(APIView):
    """
    GET /api/v1/parent/attendance/?child_id=<id>&month=YYYY-MM

    Returns daily attendance records for the given child and month, plus
    school holidays. child_id is validated against the guardian's children.
    month defaults to the current month.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsParentPortalUser]

    def get(self, request):
        guardian = request.user.guardian_profile

        # ── Resolve child ──────────────────────────────────────────────────────
        child_id = request.query_params.get("child_id")
        if not child_id:
            return Response({"detail": "child_id is required."}, status=400)

        from apps.students.models import Student

        try:
            student = Student.objects.get(
                id=child_id, guardian=guardian, status="active"
            )
        except Student.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        # ── Resolve month ──────────────────────────────────────────────────────
        month_param = request.query_params.get("month")
        today = date.today()
        if month_param:
            try:
                year, month = (int(p) for p in month_param.split("-"))
            except (ValueError, AttributeError):
                return Response({"detail": "month must be YYYY-MM."}, status=400)
        else:
            year, month = today.year, today.month

        _, last_day = calendar.monthrange(year, month)
        month_start = date(year, month, 1)
        month_end = date(year, month, last_day)

        # ── Attendance records ─────────────────────────────────────────────────
        from apps.attendance.models import StudentAttendance

        att_qs = StudentAttendance.objects.filter(
            student=student,
            school=student.school,
            attendance_date__gte=month_start,
            attendance_date__lte=month_end,
        ).values("attendance_date", "attendance_type").order_by("attendance_date")

        days = [
            {"date": str(r["attendance_date"]), "type": r["attendance_type"]}
            for r in att_qs
        ]

        # ── Summary counts ─────────────────────────────────────────────────────
        type_map: dict[str, int] = {}
        for d in days:
            type_map[d["type"]] = type_map.get(d["type"], 0) + 1

        total_school_days = sum(v for k, v in type_map.items() if k != "H")
        present = type_map.get("P", 0)
        late = type_map.get("L", 0)
        summary = {
            "present": present,
            "absent": type_map.get("A", 0),
            "late": late,
            "half_day": type_map.get("F", 0),
            "total": total_school_days,
            "pct": round((present + late) / total_school_days * 100, 1) if total_school_days else None,
        }

        # ── Holidays ───────────────────────────────────────────────────────────
        from apps.communication.models import HolidayCalendar

        holiday_qs = HolidayCalendar.objects.filter(
            school=guardian.school,
            is_active=True,
            holiday_date__gte=month_start,
            holiday_date__lte=month_end,
        ).values("holiday_date", "holiday_title").order_by("holiday_date")

        holidays = [
            {"date": str(h["holiday_date"]), "title": h["holiday_title"]}
            for h in holiday_qs
        ]

        return Response(
            {
                "year": year,
                "month": month,
                "child_id": student.id,
                "child_name": f"{student.first_name} {student.last_name}".strip(),
                "days": days,
                "holidays": holidays,
                "summary": summary,
            }
        )


class ChildFeesView(APIView):
    """
    GET /api/v1/parent/fees/?child_id=<id>

    Returns fee assignments for the given child, grouped by fees group,
    with per-item paid/due amounts computed via a single aggregate query.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsParentPortalUser]

    def get(self, request):
        guardian = request.user.guardian_profile

        child_id = request.query_params.get("child_id")
        if not child_id:
            return Response({"detail": "child_id is required."}, status=400)

        from apps.students.models import Student

        try:
            student = Student.objects.get(
                id=child_id, guardian=guardian, status="active"
            )
        except Student.DoesNotExist:
            return Response({"detail": "Not found."}, status=404)

        from apps.fees.models import FeesAssignment, FeesPayment

        # Aggregate paid per assignment in one query
        paid_sub = (
            FeesPayment.objects.filter(assignment=OuterRef("pk"))
            .values("assignment")
            .annotate(total=Sum("amount_paid"))
            .values("total")
        )

        assignments = (
            FeesAssignment.objects.select_related("fees_type", "fees_type__fees_group")
            .filter(student=student, school=student.school)
            .annotate(paid_total=Coalesce(Subquery(paid_sub), Value(Decimal("0.00")), output_field=DecimalField()))
            .order_by("fees_type__fees_group__name", "due_date")
        )

        # Build grouped structure
        groups: dict[str, list] = {}
        total_billed = 0
        total_paid_sum = 0

        for a in assignments:
            net = float(a.amount) - float(a.discount_amount)
            net = max(net, 0)
            paid = float(a.paid_total or 0)
            due = max(net - paid, 0)
            total_billed += net
            total_paid_sum += paid

            group_name = a.fees_type.fees_group.name if a.fees_type and a.fees_type.fees_group else "General"
            groups.setdefault(group_name, []).append(
                {
                    "id": a.id,
                    "fee_name": a.fees_type.name if a.fees_type else "—",
                    "amount": float(a.amount),
                    "discount": float(a.discount_amount),
                    "net_amount": round(net, 2),
                    "paid_amount": round(paid, 2),
                    "due_amount": round(due, 2),
                    "due_date": str(a.due_date),
                    "status": a.status,
                }
            )

        return Response(
            {
                "child_id": student.id,
                "child_name": f"{student.first_name} {student.last_name}".strip(),
                "summary": {
                    "total_billed": round(total_billed, 2),
                    "total_paid": round(total_paid_sum, 2),
                    "total_due": round(max(total_billed - total_paid_sum, 0), 2),
                },
                "groups": [
                    {"group_name": name, "items": items}
                    for name, items in groups.items()
                ],
            }
        )


class ParentNoticesView(APIView):
    """
    GET /api/v1/parent/notices/

    Returns published notices for the guardian's school.
    Filters to notices where inform_to is empty (all) or contains 'parent'.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsParentPortalUser]

    def get(self, request):
        guardian = request.user.guardian_profile

        from apps.communication.models import NoticeBoard

        today = date.today()
        notices_qs = NoticeBoard.objects.filter(
            school=guardian.school,
            is_published=True,
            publish_on__lte=today,
        ).order_by("-publish_on", "-notice_date")[:50]

        result = []
        for n in notices_qs:
            inform_to = n.inform_to or []
            # Empty list = broadcast to all; otherwise must include 'parent'
            if inform_to and "parent" not in [str(x).lower() for x in inform_to]:
                continue
            result.append(
                {
                    "id": n.id,
                    "title": n.notice_title,
                    "message": n.notice_message,
                    "notice_date": str(n.notice_date),
                    "publish_on": str(n.publish_on),
                }
            )

        return Response(result)
