import os
import sys
import django
from dotenv import load_dotenv

sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))
load_dotenv(os.path.join(os.path.dirname(__file__), '.env'))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from apps.students.models import Student
student = Student.objects.first()
if student:
    print("Student ID:", student.id)
    print("Student First Name:", student.first_name)
    print("Student Last Name:", student.last_name)
    # Check if there are any related attributes/methods or current class
    print("Student Class:", student.current_class)
    print("Attributes:", dir(student))
else:
    print("No students found")
