"""
Academics > Reports — built fresh here rather than by subclassing
AcademicClassPerformanceReportView/ExamResultSummaryReportView the way
ClassRoutineReportView/TeacherClassRoutineReportView do. Those two views
query exam data despite their names; nothing here touches that mistake.

Data sources are all existing Academics models (Lesson, LessonTopicDetail,
Homework, HomeworkSubmission, ClassRoutineSlot) — this module only adds
the aggregation layer, reusing apps/reports/export_utils.py's existing
reportlab/openpyxl pipeline for downloads rather than a new dependency.
"""

from django.db.models import Count, Q
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.academics.models import ClassRoutineSlot, Homework, HomeworkSubmission, Lesson, LessonTopicDetail
from apps.core.models import Class as SchoolClass

from .export_utils import build_export_response


class AcademicsReportsBaseView(APIView):
    permission_classes = [IsAuthenticated]

    def get_school_id(self, request):
        return getattr(request.user, "school_id", None)


class AcademicsReportsSummaryView(AcademicsReportsBaseView):
    """The four stat tiles on the Reports dashboard."""

    def get(self, request):
        school_id = self.get_school_id(request)
        if not school_id:
            return Response({"success": False, "message": "School context is required."}, status=400)

        academic_year_id = request.query_params.get("academic_year_id")

        topic_qs = LessonTopicDetail.objects.filter(lesson__school_id=school_id)
        lesson_qs = Lesson.objects.filter(school_id=school_id, active_status=True)
        homework_qs = Homework.objects.filter(school_id=school_id)
        if academic_year_id:
            lesson_qs = lesson_qs.filter(academic_year_id=academic_year_id)
            homework_qs = homework_qs.filter(academic_year_id=academic_year_id)
            topic_qs = topic_qs.filter(lesson__academic_year_id=academic_year_id)

        total_topics = topic_qs.count()
        done_topics = topic_qs.filter(completed_status="Completed").count()
        avg_coverage_pct = round((done_topics / total_topics) * 100) if total_topics else 0

        hw_pending = HomeworkSubmission.objects.filter(
            homework__school_id=school_id, complete_status__in=["", "P"]
        ).count() if not academic_year_id else HomeworkSubmission.objects.filter(
            homework__school_id=school_id, homework__academic_year_id=academic_year_id, complete_status__in=["", "P"]
        ).count()

        return Response({
            "success": True,
            "message": "Summary retrieved successfully",
            "data": {
                "avg_coverage_pct": avg_coverage_pct,
                "lessons_done_count": lesson_qs.count(),
                "hw_pending_count": hw_pending,
                "reports_ready_count": 5,
            },
        })


class AcademicsSyllabusProgressView(AcademicsReportsBaseView):
    """Per-class syllabus coverage %, for the 'Syllabus Progress by Class' card."""

    def get(self, request):
        school_id = self.get_school_id(request)
        if not school_id:
            return Response({"success": False, "message": "School context is required."}, status=400)
        academic_year_id = request.query_params.get("academic_year_id")

        classes = SchoolClass.objects.filter(school_id=school_id, is_active=True).order_by("numeric_order", "name")
        rows = []
        for school_class in classes:
            topic_qs = LessonTopicDetail.objects.filter(lesson__school_id=school_id, lesson__school_class=school_class)
            if academic_year_id:
                topic_qs = topic_qs.filter(lesson__academic_year_id=academic_year_id)
            total = topic_qs.count()
            if not total:
                continue
            done = topic_qs.filter(completed_status="Completed").count()
            rows.append({
                "class_id": school_class.id,
                "class_name": school_class.name,
                "done": done,
                "total": total,
                "pct": round((done / total) * 100),
            })

        return Response({"success": True, "message": "Syllabus progress retrieved successfully", "data": rows})


class AcademicsHomeworkEvaluationView(AcademicsReportsBaseView):
    """Row-per-homework tracker: submissions, evaluation status, average score."""

    def get(self, request):
        school_id = self.get_school_id(request)
        if not school_id:
            return Response({"success": False, "message": "School context is required."}, status=400)
        academic_year_id = request.query_params.get("academic_year_id")

        homeworks = Homework.objects.filter(school_id=school_id).select_related(
            "class_id_ref", "section_id_ref", "subject_id_ref"
        ).order_by("-homework_date")
        if academic_year_id:
            homeworks = homeworks.filter(academic_year_id=academic_year_id)

        rows = []
        for hw in homeworks:
            submissions = HomeworkSubmission.objects.filter(homework=hw)
            total_students = submissions.count()
            evaluated = submissions.exclude(marks__isnull=True)
            avg_score = None
            if evaluated.exists():
                marks_list = [s.marks for s in evaluated if s.marks is not None]
                if marks_list and hw.marks:
                    avg_score = round(sum(marks_list) / len(marks_list) / hw.marks * 100)
            status_label = "Evaluated" if evaluated.count() == total_students and total_students else (
                "Pending" if total_students else "Pending"
            )
            rows.append({
                "id": hw.id,
                "title": hw.description[:80] if hw.description else f"Homework #{hw.id}",
                "class_name": getattr(hw.class_id_ref, "name", ""),
                "section_name": getattr(hw.section_id_ref, "name", "") if hw.section_id_ref_id else "",
                "subject_name": getattr(hw.subject_id_ref, "name", ""),
                "due_date": hw.submission_date,
                "submitted_count": total_students,
                "status": status_label,
                "avg_score_pct": avg_score,
            })

        return Response({"success": True, "message": "Homework evaluation data retrieved successfully", "data": rows})


DOWNLOAD_CATALOG = [
    {"key": "timetable", "name": "Timetable — All Classes", "description": "Complete weekly schedule", "format": "pdf"},
    {"key": "syllabus-progress", "name": "Syllabus Progress Report", "description": "Term-wise coverage by class", "format": "pdf"},
    {"key": "homework-evaluation", "name": "Homework Evaluation Summary", "description": "Submission rates and scores", "format": "pdf"},
]


class AcademicsReportsDownloadsView(AcademicsReportsBaseView):
    """Metadata list of canned reports available for download."""

    def get(self, request):
        return Response({"success": True, "message": "Downloads retrieved successfully", "data": DOWNLOAD_CATALOG})


class AcademicsReportsDownloadFileView(AcademicsReportsBaseView):
    """Generates and streams one of the canned reports above."""

    def get(self, request, key):
        school_id = self.get_school_id(request)
        if not school_id:
            return Response({"success": False, "message": "School context is required."}, status=400)
        export_format = request.query_params.get("export", "pdf")
        academic_year_id = request.query_params.get("academic_year_id")

        if key == "timetable":
            slots = ClassRoutineSlot.objects.filter(school_id=school_id, is_break=False).select_related(
                "school_class", "section", "subject", "teacher"
            ).order_by("school_class__numeric_order", "section__name", "day", "start_time")
            rows = [{
                "class_name": getattr(s.school_class, "name", ""),
                "section_name": getattr(s.section, "name", "") if s.section_id else "",
                "day": s.day,
                "start_time": s.start_time.strftime("%H:%M") if s.start_time else "",
                "subject_name": getattr(s.subject, "name", "") if s.subject_id else "Free",
                "teacher_name": (s.teacher.get_full_name() or s.teacher.username) if s.teacher_id else "",
            } for s in slots]
            columns = [
                ("Class", "class_name"), ("Section", "section_name"), ("Day", "day"),
                ("Time", "start_time"), ("Subject", "subject_name"), ("Teacher", "teacher_name"),
            ]
            return build_export_response(export_format, rows, columns, "timetable_all_classes", "Timetable — All Classes")

        if key == "syllabus-progress":
            view = AcademicsSyllabusProgressView()
            data = view.get(request).data.get("data", [])
            rows = [{"class_name": r["class_name"], "done": r["done"], "total": r["total"], "pct": f"{r['pct']}%"} for r in data]
            columns = [("Class", "class_name"), ("Lessons Done", "done"), ("Total Lessons", "total"), ("Coverage", "pct")]
            return build_export_response(export_format, rows, columns, "syllabus_progress_report", "Syllabus Progress Report")

        if key == "homework-evaluation":
            view = AcademicsHomeworkEvaluationView()
            data = view.get(request).data.get("data", [])
            rows = [{
                "title": r["title"], "class_name": r["class_name"], "subject_name": r["subject_name"],
                "submitted_count": r["submitted_count"], "status": r["status"],
                "avg_score_pct": f"{r['avg_score_pct']}%" if r["avg_score_pct"] is not None else "—",
            } for r in data]
            columns = [
                ("Assignment", "title"), ("Class", "class_name"), ("Subject", "subject_name"),
                ("Submitted", "submitted_count"), ("Status", "status"), ("Avg Score", "avg_score_pct"),
            ]
            return build_export_response(export_format, rows, columns, "homework_evaluation_summary", "Homework Evaluation Summary")

        return Response({"success": False, "message": f"Unknown report key '{key}'."}, status=404)
