from apps.academics.models import ClassSubjectAssignment
from apps.core.models import AcademicYear
from django.contrib.auth import get_user_model
from django.db import IntegrityError, transaction

User = get_user_model()
rohan = User.objects.get(username='rohandharlapally22@gmail.com')
active_ay = AcademicYear.objects.filter(school=rohan.school, is_current=True).first()

q = ClassSubjectAssignment.objects.filter(teacher=rohan, academic_year__isnull=True)
count = 0
deleted = 0
for a in q:
    a.academic_year = active_ay
    try:
        with transaction.atomic():
            a.save()
            count += 1
    except IntegrityError:
        a.delete()
        deleted += 1

print(f"Updated {count} subject assignments for Rohan. Deleted {deleted} duplicates.")
