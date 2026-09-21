import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from apps.hr.models import Staff

teachers = Staff.objects.filter(first_name__icontains='rohan')

if teachers.exists():
    for t in teachers:
        print(f"Found: {t.first_name} {t.last_name}")
        print(f"School: {t.school.name}")
else:
    print("Teacher 'rohan' not found.")
