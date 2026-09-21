import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from apps.exams.models import ExamMarkRegister, ExamMarkRegisterPart
for r in ExamMarkRegister.objects.all().order_by('-id')[:5]:
    print(r.id, r.student, r.subject, r.total_marks)
    for p in r.parts.all():
        print("  ", p.exam_setup_id, p.marks)
