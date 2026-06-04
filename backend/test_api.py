import os
import django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.attendance.views import StudentSearchAPIView
from rest_framework.test import APIRequestFactory
from apps.users.models import User

factory = APIRequestFactory()
request = factory.post('/api/v1/attendance/student-attendance/student-search/', {
    'class': 1, 'section': 1, 'attendance_date': '2026-06-03'
}, format='json')

user = User.objects.first()
request.user = user

view = StudentSearchAPIView.as_view()
response = view(request)
print("RESPONSE STATUS:", response.status_code)
print("RESPONSE DATA:", response.data)
