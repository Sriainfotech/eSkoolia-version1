import sys, os
sys.path.insert(0, '.')
os.environ['DJANGO_SETTINGS_MODULE'] = 'config.settings.local'
import django
django.setup()

# Test the attendance list view query
from apps.attendance.models import StudentAttendance
from apps.attendance.serializers import StudentAttendanceSerializer

try:
    qs = StudentAttendance.objects.select_related('student').filter(
        attendance_date__month=4,
        attendance_date__year=2026
    ).order_by('-attendance_date', 'student_id')
    count = qs.count()
    print('Records count:', count)
    
    # Try serializing first few
    items = list(qs[:3])
    s = StudentAttendanceSerializer(items, many=True)
    d = s.data
    print('Serialized OK:', len(d), 'records')
    if d: print('Sample fields:', list(d[0].keys()))
except Exception as e:
    import traceback
    print('ERROR:')
    traceback.print_exc()
