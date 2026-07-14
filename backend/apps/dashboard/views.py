from datetime import date, timedelta

from django.db.models import Sum
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView


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

        total_students = Student.objects.filter(school=school, status="active").count()

        att_qs = StudentAttendance.objects.filter(school=school, attendance_date=today)
        total_att = att_qs.count()
        present_att = att_qs.filter(attendance_type="P").count()
        attendance_today = f"{round(present_att * 100 / total_att)}%" if total_att > 0 else "—"

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
