import os
import django
import sys

# Add backend directory to sys.path
sys.path.append('c:/Users/SANDALA THARUN KUMAR/OneDrive/Desktop/Eskoolia/eSkoolia-version1/backend')
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.hr.models import Staff
from apps.hr.serializers import StaffSerializer

staff = Staff.objects.first()
if staff:
    print('Staff ID:', staff.id)
    print('Staff Name:', staff.first_name)
    print('Department:', staff.department)
    print('Serializer Output:', StaffSerializer(staff).data.get('department_name'))
else:
    print('No staff found')
