with open('backend/apps/teacher_portal/views.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace(
    'from apps.exams.models import ExamMarkRegister, ExamMarkRegisterPart, ExamSetup\n        from apps.students.models import Student',
    'from apps.exams.models import ExamMarkRegister, ExamMarkRegisterPart, ExamSetup, Exam\n        from apps.students.models import Student'
)

with open('backend/apps/teacher_portal/views.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Fixed Save View")
