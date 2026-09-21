from django.core.management.base import BaseCommand
from django.test import RequestFactory
from apps.teacher_portal.views import TeacherExamStudentsView
from apps.users.models import User
from apps.exams.models import ExamSetup, Exam
from apps.academics.models import ClassSubjectAssignment

class Command(BaseCommand):
    def handle(self, *args, **options):
        user = User.objects.filter(first_name__icontains='rohan').first()
        assignments = ClassSubjectAssignment.objects.filter(teacher=user)
        if not assignments:
            print("No assignments")
            return
        a = assignments.first()
        
        # Find an exam that is open
        open_exams = Exam.objects.filter(status=Exam.STATUS_MARKS_OPEN)
        if not open_exams:
            print("No open exams")
            return
        exam = open_exams.first()

        factory = RequestFactory()
        request = factory.post('/api/v1/teacher/exam-marks/students/', {
            'exam_id': exam.id,
            'class_id': a.school_class_id,
            'section_id': a.section_id,
            'subject_id': a.subject_id
        }, content_type='application/json')
        request.user = user

        view = TeacherExamStudentsView.as_view()
        try:
            response = view(request)
            print(response.status_code)
            print(response.data)
        except Exception as e:
            import traceback
            traceback.print_exc()
