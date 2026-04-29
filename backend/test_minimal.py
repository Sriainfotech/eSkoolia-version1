#!/usr/bin/env python
import os
import sys
import django

# Set up Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
sys.path.insert(0, '.')
django.setup()

# Now test the serializer
print("=" * 80)
print("Testing StudentAttendance API")
print("=" * 80)

from apps.attendance.models import StudentAttendance
from apps.attendance.serializers import StudentAttendanceSerializer

# Test 1: Check if we can import and fetch data
print("\n1. Testing basic queryset fetch...")
try:
    qs = StudentAttendance.objects.select_related('student').all()[:1]
    print(f"   Queryset count: {StudentAttendance.objects.count()}")
    if qs.exists():
        record = qs.first()
        print(f"   First record: {record}")
        print(f"   Student: {record.student}")
        print(f"   Student fields available: {[f.name for f in record.student._meta.get_fields()][:10]}")
    else:
        print("   No records found - creating a test scenario...")
except Exception as e:
    print(f"   ERROR fetching queryset: {e}")
    import traceback
    traceback.print_exc()

# Test 2: Try serializing
print("\n2. Testing serializer...")
try:
    qs = StudentAttendance.objects.select_related('student').all()[:3]
    serializer = StudentAttendanceSerializer(qs, many=True)
    data = serializer.data
    print(f"   Successfully serialized {len(data)} records")
    if data:
        print(f"   First record keys: {list(data[0].keys())}")
        print(f"   First record: {data[0]}")
except Exception as e:
    print(f"   ERROR serializing: {e}")
    import traceback
    traceback.print_exc()

# Test 3: Check for month/year filtering
print("\n3. Testing month/year filter...")
try:
    qs = StudentAttendance.objects.select_related('student').filter(
        attendance_date__month=4,
        attendance_date__year=2026
    )
    print(f"   Records for Apr 2026: {qs.count()}")
    if qs.exists():
        serializer = StudentAttendanceSerializer(qs[:1], many=True)
        print(f"   Serialization successful")
except Exception as e:
    print(f"   ERROR: {e}")
    import traceback
    traceback.print_exc()

print("\nDone!")
