import os
import sys
import django

# Setup django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from apps.tenancy.models import SchoolTenant
from apps.hr.models import Staff
from apps.students.models import Student
from apps.users.models import User

print("=== SCHOOLS REGISTERED ===")
schools = SchoolTenant.objects.all()
print(f"Total Schools Registered: {schools.count()}")
for school in schools:
    print(f" - ID: {school.id} | Schema: {school.schema_name}")

print("\n=== USERS BY ROLE ===")
staff_count = Staff.objects.count()
active_staff_count = Staff.objects.filter(active_status=1).count() if hasattr(Staff, 'active_status') else "N/A"

student_count = Student.objects.count()
active_student_count = Student.objects.filter(active_status=1).count() if hasattr(Student, 'active_status') else "N/A"

print(f"Total Staff/Teachers: {staff_count} (Active: {active_staff_count})")
print(f"Total Students: {student_count} (Active: {active_student_count})")

print("\n=== TOTAL SYSTEM USERS ===")
print(f"Total Users in system: {User.objects.count()}")

parents_count = 0
for user in User.objects.all():
    if hasattr(user, 'role') and user.role and getattr(user.role, 'name', '').lower() == 'parent':
        parents_count += 1
    elif hasattr(user, 'is_parent') and user.is_parent:
        parents_count += 1

print(f"Total Users identified as Parent: {parents_count}")
