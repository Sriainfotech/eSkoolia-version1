"""Student Portal API views."""

from datetime import date, timedelta
from decimal import Decimal

from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from .permissions import IsStudentPortalUser


class StudentMeView(APIView):
    """
    GET /api/v1/student/me/

    Returns the authenticated student's own profile plus lightweight dashboard
    stats for the student home screen.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStudentPortalUser]

    def get(self, request):
        student = request.user.student_profile

        full_name = f"{(student.first_name or '').strip()} {(student.last_name or '').strip()}".strip()
        class_name = student.current_class.name if student.current_class else ""
        section_name = student.current_section.name if student.current_section else ""

        attendance = {
            "present": 0,
            "late": 0,
            "absent": 0,
            "total": 0,
            "pct": None,
        }
        try:
            from apps.attendance.models import StudentAttendance

            cutoff = date.today() - timedelta(days=30)
            agg = StudentAttendance.objects.filter(
                student=student,
                school_id=student.school_id,
                attendance_date__gte=cutoff,
            ).aggregate(
                present=Count("id", filter=Q(attendance_type="P")),
                late=Count("id", filter=Q(attendance_type="L")),
                absent=Count("id", filter=Q(attendance_type="A")),
                total=Count("id", filter=~Q(attendance_type="H")),
            )
            present = int(agg.get("present") or 0)
            late = int(agg.get("late") or 0)
            absent = int(agg.get("absent") or 0)
            total = int(agg.get("total") or 0)
            pct = round(((present + late) / total) * 100, 1) if total > 0 else None
            attendance = {
                "present": present,
                "late": late,
                "absent": absent,
                "total": total,
                "pct": pct,
            }
        except Exception:
            # Keep portal usable even if attendance module has no data yet.
            pass

        school_name = student.school.name if student.school else None

        return Response(
            {
                "student_id": student.id,
                "name": full_name or request.user.username,
                "first_name": student.first_name,
                "last_name": student.last_name,
                "admission_no": student.admission_no,
                "roll_no": student.roll_no,
                "class_name": class_name,
                "section_name": section_name,
                "class_section": f"{class_name}-{section_name}".strip("-"),
                "photo_url": student.photo or None,
                "school_name": school_name,
                "attendance_last_30_days": attendance,
            }
        )


class StudentAttendanceView(APIView):
    """
    GET /api/v1/student/attendance/

    Returns attendance summary and recent daily records for the authenticated
    student's own account.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStudentPortalUser]

    def get(self, request):
        student = request.user.student_profile

        from apps.attendance.models import StudentAttendance

        recent_qs = StudentAttendance.objects.filter(
            student=student,
            school_id=student.school_id,
        ).order_by("-attendance_date")

        last_30_cutoff = date.today() - timedelta(days=30)
        summary = recent_qs.filter(attendance_date__gte=last_30_cutoff).aggregate(
            present=Count("id", filter=Q(attendance_type="P")),
            late=Count("id", filter=Q(attendance_type="L")),
            absent=Count("id", filter=Q(attendance_type="A")),
            half_day=Count("id", filter=Q(attendance_type="F")),
            total=Count("id", filter=~Q(attendance_type="H")),
        )

        total = int(summary.get("total") or 0)
        present = int(summary.get("present") or 0)
        late = int(summary.get("late") or 0)
        pct = round(((present + late) / total) * 100, 1) if total > 0 else None

        recent_records = [
            {
                "date": row.attendance_date.isoformat(),
                "status": row.attendance_type,
                "notes": row.notes or "",
            }
            for row in recent_qs[:45]
        ]

        return Response(
            {
                "summary_last_30_days": {
                    "present": present,
                    "late": late,
                    "absent": int(summary.get("absent") or 0),
                    "half_day": int(summary.get("half_day") or 0),
                    "total": total,
                    "pct": pct,
                },
                "recent_records": recent_records,
            }
        )


class StudentAcademicsView(APIView):
    """
    GET /api/v1/student/academics/

    Returns class/section context, current year, studied subjects, and upcoming
    exam papers for the authenticated student.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStudentPortalUser]

    def get(self, request):
        student = request.user.student_profile

        subject_names: set[str] = set()
        upcoming_exams = []

        try:
            from apps.exams.models import ExamMark, ExamSchedule

            marks_subjects = (
                ExamMark.objects.select_related("schedule__subject")
                .filter(student=student, school_id=student.school_id)
                .values_list("schedule__subject__name", flat=True)
            )
            for name in marks_subjects:
                if name:
                    subject_names.add(name)

            if student.current_class_id:
                exam_qs = (
                    ExamSchedule.objects.select_related("exam", "subject", "section")
                    .filter(
                        school_id=student.school_id,
                        school_class_id=student.current_class_id,
                        exam_date__gte=date.today(),
                    )
                    .filter(Q(section_id=student.current_section_id) | Q(section__isnull=True))
                    .order_by("exam_date", "start_time", "id")
                )

                for row in exam_qs[:20]:
                    if row.subject and row.subject.name:
                        subject_names.add(row.subject.name)
                    upcoming_exams.append(
                        {
                            "exam": row.exam.name if row.exam else "",
                            "subject": row.subject.name if row.subject else "",
                            "date": row.exam_date.isoformat() if row.exam_date else None,
                            "start_time": row.start_time.strftime("%H:%M") if row.start_time else None,
                            "end_time": row.end_time.strftime("%H:%M") if row.end_time else None,
                            "room": row.room or "",
                        }
                    )
        except Exception:
            # Keep the page usable even when specific exam tables are empty.
            pass

        return Response(
            {
                "class_name": student.current_class.name if student.current_class else "",
                "section_name": student.current_section.name if student.current_section else "",
                "academic_year": student.academic_year.name if student.academic_year else None,
                "subjects": sorted(subject_names),
                "upcoming_exams": upcoming_exams,
            }
        )


class StudentResultsView(APIView):
    """
    GET /api/v1/student/results/

    Returns recent exam marks and overall averages for the student's own account.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStudentPortalUser]

    def get(self, request):
        student = request.user.student_profile

        from apps.exams.models import ExamMark

        marks_qs = (
            ExamMark.objects.select_related("exam", "exam__exam_type", "schedule", "schedule__subject")
            .filter(student=student, school_id=student.school_id)
            .order_by("-schedule__exam_date", "-id")
        )

        rows = []
        total_obtained = Decimal("0")
        total_full = Decimal("0")

        for mark in marks_qs[:80]:
            full_marks = Decimal(str(mark.schedule.full_marks or 0)) if mark.schedule else Decimal("0")
            obtained_marks = Decimal(str(mark.obtained_marks or 0))
            score_pct = None
            if not mark.absent and full_marks > 0:
                score_pct = round(float((obtained_marks / full_marks) * 100), 1)
                total_obtained += obtained_marks
                total_full += full_marks

            rows.append(
                {
                    "exam": mark.exam.name if mark.exam else "",
                    "term": mark.exam.exam_type.title if mark.exam and mark.exam.exam_type else "",
                    "subject": mark.schedule.subject.name if mark.schedule and mark.schedule.subject else "",
                    "date": mark.schedule.exam_date.isoformat() if mark.schedule and mark.schedule.exam_date else None,
                    "obtained": float(obtained_marks),
                    "full_marks": float(full_marks),
                    "pass_marks": float(mark.schedule.pass_marks) if mark.schedule and mark.schedule.pass_marks is not None else None,
                    "absent": bool(mark.absent),
                    "score_pct": score_pct,
                }
            )

        overall_pct = round(float((total_obtained / total_full) * 100), 1) if total_full > 0 else None

        return Response(
            {
                "overall": {
                    "overall_pct": overall_pct,
                    "total_obtained": float(total_obtained),
                    "total_full_marks": float(total_full),
                    "subjects_count": len({f"{r['exam']}::{r['subject']}" for r in rows}),
                },
                "marks": rows,
            }
        )


class StudentFeesView(APIView):
    """
    GET /api/v1/student/fees/

    Returns fee assignment status and payment history for the student's own account.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStudentPortalUser]

    def get(self, request):
        student = request.user.student_profile

        from apps.fees.models import FeeAssignment, Payment

        assignments_qs = (
            FeeAssignment.objects.select_related("fees_type", "academic_year")
            .filter(student=student)
            .order_by("due_date", "id")
        )

        assignments = list(assignments_qs[:120])
        assignment_ids = [row.id for row in assignments]
        posted_payments_by_assignment = {}
        if assignment_ids:
            payment_totals = (
                Payment.objects.filter(assignment_id__in=assignment_ids, status="posted")
                .values("assignment_id")
                .annotate(total=Coalesce(Sum("amount_paid"), Decimal("0")))
            )
            posted_payments_by_assignment = {
                row["assignment_id"]: Decimal(str(row["total"] or 0)) for row in payment_totals
            }

        today = date.today()
        total_assigned = Decimal("0")
        total_paid = Decimal("0")
        total_due = Decimal("0")
        overdue_count = 0
        assignment_rows = []

        for assignment in assignments:
            amount = Decimal(str(assignment.amount or 0))
            discount = Decimal(str(assignment.discount_amount or 0))
            concession = Decimal(str(assignment.concession_amount or 0))
            net = max(amount - discount - concession, Decimal("0"))
            paid = posted_payments_by_assignment.get(assignment.id, Decimal("0"))
            due = max(net - paid, Decimal("0"))

            if due > 0 and assignment.due_date and assignment.due_date < today:
                overdue_count += 1

            total_assigned += net
            total_paid += paid
            total_due += due

            assignment_rows.append(
                {
                    "fee_type": assignment.fees_type.name if assignment.fees_type else "",
                    "academic_year": assignment.academic_year.name if assignment.academic_year else "",
                    "due_date": assignment.due_date.isoformat() if assignment.due_date else None,
                    "amount": float(net),
                    "paid": float(paid),
                    "due": float(due),
                    "status": "paid" if due <= 0 else ("partial" if paid > 0 else "unpaid"),
                }
            )

        payments = (
            Payment.objects.filter(student=student)
            .select_related("assignment", "assignment__fees_type")
            .order_by("-paid_at", "-id")[:50]
        )
        payment_rows = [
            {
                "fee_type": row.assignment.fees_type.name if row.assignment and row.assignment.fees_type else "",
                "amount_paid": float(row.amount_paid or 0),
                "method": row.method,
                "status": row.status,
                "paid_at": row.paid_at.isoformat() if row.paid_at else None,
                "reference": row.transaction_reference or "",
            }
            for row in payments
        ]

        return Response(
            {
                "summary": {
                    "total_assigned": float(total_assigned),
                    "total_paid": float(total_paid),
                    "total_due": float(total_due),
                    "overdue_count": overdue_count,
                },
                "assignments": assignment_rows,
                "payments": payment_rows,
            }
        )


class StudentNoticesView(APIView):
    """
    GET /api/v1/student/notices/

    Returns published notices targeted to student roles in the same school.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStudentPortalUser]

    def get(self, request):
        user = request.user
        school_id = user.school_id

        from apps.communication.models import NoticeBoard

        role_ids = set(user.user_roles.values_list("role_id", flat=True))
        today = date.today()

        notices_qs = (
            NoticeBoard.objects.filter(
                Q(school_id=school_id) | Q(school__isnull=True),
                is_published=True,
                publish_on__lte=today,
            )
            .select_related("created_by")
            .order_by("-publish_on", "-notice_date", "-id")
        )

        rows = []
        for notice in notices_qs[:120]:
            targets = notice.inform_to or []
            try:
                target_ids = {int(item) for item in targets}
            except Exception:
                target_ids = set()

            if target_ids and role_ids.isdisjoint(target_ids):
                continue

            author = ""
            if notice.created_by:
                author = f"{(notice.created_by.first_name or '').strip()} {(notice.created_by.last_name or '').strip()}".strip()

            rows.append(
                {
                    "id": notice.id,
                    "title": notice.notice_title,
                    "message": notice.notice_message,
                    "notice_date": notice.notice_date.isoformat() if notice.notice_date else None,
                    "publish_on": notice.publish_on.isoformat() if notice.publish_on else None,
                    "author": author or (notice.created_by.username if notice.created_by else ""),
                }
            )

        return Response(rows)


class StudentProfileView(APIView):
    """
    GET /api/v1/student/profile/

    Returns student identity, class details, guardian, and account-linked profile
    metadata for the authenticated student.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsStudentPortalUser]

    def get(self, request):
        student = request.user.student_profile
        guardian = student.guardian

        guardian_payload = None
        if guardian:
            guardian_payload = {
                "name": guardian.full_name,
                "relation": guardian.relation,
                "phone": guardian.phone,
                "email": guardian.email,
                "occupation": guardian.occupation,
            }

        return Response(
            {
                "student_id": student.id,
                "name": f"{(student.first_name or '').strip()} {(student.last_name or '').strip()}".strip(),
                "first_name": student.first_name,
                "last_name": student.last_name,
                "admission_no": student.admission_no,
                "roll_no": student.roll_no,
                "date_of_birth": student.date_of_birth.isoformat() if student.date_of_birth else None,
                "gender": student.gender,
                "blood_group": student.blood_group,
                "phone": student.phone,
                "email": student.email,
                "address": {
                    "address_line": student.address_line,
                    "city": student.city,
                    "district": student.district,
                    "state": student.state,
                    "pincode": student.pincode,
                },
                "school_name": student.school.name if student.school else None,
                "class_name": student.current_class.name if student.current_class else "",
                "section_name": student.current_section.name if student.current_section else "",
                "class_section": f"{student.current_class.name if student.current_class else ''}-{student.current_section.name if student.current_section else ''}".strip("-"),
                "academic_year": student.academic_year.name if student.academic_year else None,
                "photo_url": student.photo or None,
                "guardian": guardian_payload,
                "transport": {
                    "route": student.transport_route.title if student.transport_route else None,
                    "vehicle": student.vehicle.vehicle_no if student.vehicle else None,
                },
            }
        )
