with open('backend/apps/teacher_portal/views.py', 'r', encoding='utf-8') as f:
    code = f.read()

code = code.replace('from apps.academics.models import SchoolClass, Section, Subject', 'from apps.core.models import Class as SchoolClass, Section, Subject')

with open('backend/apps/teacher_portal/views.py', 'w', encoding='utf-8') as f:
    f.write(code)
print("Fixed imports")
