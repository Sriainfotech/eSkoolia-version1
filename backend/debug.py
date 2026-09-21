import os
import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.test import RequestFactory
from apps.teacher_portal.views import TeacherExamStudentsView
from apps.users.models import User
from apps.exams.models import ExamSetup

# Find a valid scope for Rohan
user = User.objects.filter(first_name__icontains='rohan').first()
setup = ExamSetup.objects.first()

factory = RequestFactory()
request = factory.post('/api/v1/teacher/exam-marks/students/', {
    'exam_id': setup.exam_term_id, 
    'class_id': setup.school_class_id,
    'section_id': setup.section_id,
    'subject_id': setup.subject_id
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
