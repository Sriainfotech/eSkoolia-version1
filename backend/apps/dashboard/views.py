from datetime import date, timedelta
from zoneinfo import ZoneInfo

from django.db.models import Count, Q, Sum
from django.utils import timezone
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

# Django's TIME_ZONE setting is "UTC" (server/infra convention — see
# config/settings/base.py), but this app only serves Indian schools, so
# anything shown to a user as a wall-clock time or "today" must be
# converted to India's actual local time rather than left in UTC.
SCHOOL_TZ = ZoneInfo("Asia/Kolkata")


class DashboardKPIView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = getattr(request.user, "school", None)
        if not school:
            return Response({})

        today = date.today()
        week_end = today + timedelta(days=(6 - today.weekday()))

        from apps.academics.models import Homework
        from apps.admissions.models import AdmissionInquiry
        from apps.attendance.models import StudentAttendance
        from apps.exams.models import ExamSchedule
        from apps.fees.models import Payment
        from apps.hr.models import Staff
        from apps.library.models import Book
        from apps.students.models import Student

        att_qs = StudentAttendance.objects.filter(school=school, attendance_date=today)
        att_counts = att_qs.aggregate(
            total=Count("id"),
            present=Count("id", filter=Q(attendance_type="P")),
        )
        total_att = att_counts.get("total", 0)
        present_att = att_counts.get("present", 0)
        attendance_today = f"{round(present_att * 100 / total_att)}%" if total_att > 0 else "—"

        totals = Student.objects.filter(school=school).aggregate(
            total_students=Count("id", filter=Q(status="active")),
        )
        total_students = totals.get("total_students", 0)

        fees_raw = (
            Payment.objects.filter(
                student__school=school,
                paid_at__year=today.year,
                paid_at__month=today.month,
            ).aggregate(total=Sum("amount_paid"))["total"]
            or 0
        )
        fees_collected_mtd = f"₹{int(fees_raw):,}"

        open_admissions = AdmissionInquiry.objects.filter(school=school, active_status=1).count()
        total_staff = Staff.objects.filter(school=school, status="active").count()
        library_books = Book.objects.filter(school=school).count()
        pending_homework = Homework.objects.filter(school=school, active_status=True, evaluation_date__isnull=True).count()
        exams_this_week = ExamSchedule.objects.filter(
            school=school,
            exam_date__gte=today,
            exam_date__lte=week_end,
        ).count()

        return Response(
            {
                "total_students": total_students,
                "attendance_today": attendance_today,
                "fees_collected_mtd": fees_collected_mtd,
                "open_admissions": open_admissions,
                "total_staff": total_staff,
                "library_books": library_books,
                "pending_homework": pending_homework,
                "exams_this_week": exams_this_week,
            }
        )


class AttentionCountView(APIView):
    """Count of genuinely pending/overdue items for the Greeting widget's
    "N items need your attention" line.

    Reuses the same real, already-established "pending" signals as
    DashboardKPIView / AIBriefView — no invented metric:
    - open admission inquiries awaiting a decision
    - homework submitted but not yet evaluated
    - fee assignments past their due date and not fully paid
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = getattr(request.user, "school", None)
        if not school:
            return Response({"count": 0})

        today = date.today()

        from apps.academics.models import Homework
        from apps.admissions.models import AdmissionInquiry
        from apps.fees.models import FeeAssignment

        open_admissions = AdmissionInquiry.objects.filter(school=school, active_status=1).count()
        pending_homework = Homework.objects.filter(
            school=school, active_status=True, evaluation_date__isnull=True
        ).count()

        overdue_assignments = FeeAssignment.objects.filter(
            academic_year__school=school, due_date__lt=today
        ).prefetch_related("payments")
        overdue_fees = sum(1 for a in overdue_assignments if a.status != "paid")

        return Response({"count": open_admissions + pending_homework + overdue_fees})


def _fmt_inr(amount) -> str:
    amount = int(amount or 0)
    if amount >= 100000:
        return f"₹{amount / 100000:.2f}L"
    return f"₹{amount:,}"


class AIBriefView(APIView):
    """School-scoped summary for the dashboard 'Morning Brief' panel.

    Composed from the same live, school-scoped queries as DashboardKPIView —
    no LLM call, no mock data. Real numbers for the requesting user's school.
    """

    permission_classes = [IsAuthenticated]

    def get(self, request):
        school = getattr(request.user, "school", None)
        if not school:
            return Response({})

        slot = (request.query_params.get("slot") or "morning").strip().lower()
        if slot not in {"morning", "midday", "eod"}:
            slot = "morning"

        now_ist = timezone.now().astimezone(SCHOOL_TZ)
        today = now_ist.date()

        from apps.academics.models import Homework
        from apps.admissions.models import AdmissionInquiry
        from apps.attendance.models import StudentAttendance
        from apps.exams.models import ExamSchedule
        from apps.fees.models import Payment
        from apps.students.models import Student

        att_qs = StudentAttendance.objects.filter(school=school, attendance_date=today)
        att_counts = att_qs.aggregate(
            total=Count("id"),
            present=Count("id", filter=Q(attendance_type="P")),
        )
        total_att = att_counts.get("total", 0)
        present_att = att_counts.get("present", 0)
        active_students = Student.objects.filter(school=school, status="active").count()

        fees_today = (
            Payment.objects.filter(student__school=school, paid_at__date=today)
            .aggregate(total=Sum("amount_paid"))["total"]
            or 0
        )

        next_exam = (
            ExamSchedule.objects.filter(school=school, exam_date__gte=today)
            .select_related("exam")
            .order_by("exam_date")
            .first()
        )

        pending_homework = Homework.objects.filter(
            school=school, active_status=True, evaluation_date__isnull=True
        ).count()

        open_admissions = AdmissionInquiry.objects.filter(school=school, active_status=1).count()

        bullets = []

        if total_att > 0:
            pct = round(present_att * 100 / total_att)
            unmarked = max(active_students - total_att, 0)
            marked_note = f" · {unmarked} students not yet marked" if unmarked > 0 else ""
            bullets.append(f"Attendance at {pct}% today ({present_att}/{total_att} marked){marked_note}")
        else:
            bullets.append("Attendance hasn't been marked for today yet")

        bullets.append(f"{_fmt_inr(fees_today)} collected in fees today")

        if next_exam:
            days_out = (next_exam.exam_date - today).days
            when = "today" if days_out == 0 else "tomorrow" if days_out == 1 else f"in {days_out} days"
            bullets.append(f"{next_exam.exam.name} — next paper {when} ({next_exam.exam_date:%d %b})")

        if pending_homework > 0:
            bullets.append(f"{pending_homework} homework submission(s) awaiting evaluation")

        if open_admissions > 0:
            bullets.append(f"{open_admissions} open admission inquiries")

        needs_attention = total_att > 0 and (present_att * 100 / total_att) < 80
        headline = (
            "A few things need your attention today."
            if needs_attention
            else "School running smoothly today."
        )

        return Response(
            {
                "headline": headline,
                "bullets": bullets[:4],
                "generatedAt": now_ist.strftime("%I:%M %p").lstrip("0"),
                "slot": slot,
            }
        )
