import os
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.local'
import django
django.setup()
from apps.students.models import Student

total = Student.objects.filter(is_deleted=False).count()
no_class = Student.objects.filter(is_deleted=False, current_class__isnull=True).count()
no_section = Student.objects.filter(is_deleted=False, current_section__isnull=True).count()
class_no_section = Student.objects.filter(is_deleted=False, current_class__isnull=False, current_section__isnull=True).count()

print(f"Total students: {total}")
print(f"No class assigned: {no_class}")
print(f"No section assigned: {no_section}")
print(f"Has class but no section: {class_no_section}")

# Show sample of students with class but no section
for s in Student.objects.filter(is_deleted=False, current_class__isnull=False, current_section__isnull=True).select_related('current_class')[:10]:
    print(f"  {s.admission_no} {s.first_name} -> class: {s.current_class.name}, section: None")
