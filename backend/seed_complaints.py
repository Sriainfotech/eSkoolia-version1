#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.admissions.models import ComplaintType, ComplaintSource
from apps.tenancy.models import School

# Get a school (use first available)
school = School.objects.first()
if school:
    # Create complaint types
    types = ["Academic Issue", "Facility Complaint", "Behavioral Issue", "Administrative Issue", "Safety Concern"]
    for type_name in types:
        ComplaintType.objects.get_or_create(
            school=school,
            name=type_name,
            defaults={'description': f'Type: {type_name}', 'is_active': True}
        )
    
    # Create complaint sources
    sources = ["Student", "Parent", "Staff", "Phone Call", "Email", "Walk-in"]
    for source_name in sources:
        ComplaintSource.objects.get_or_create(
            school=school,
            name=source_name,
            defaults={'description': f'Source: {source_name}', 'is_active': True}
        )
    
    print(f"✓ Created {ComplaintType.objects.count()} complaint types")
    print(f"✓ Created {ComplaintSource.objects.count()} complaint sources")
else:
    print("No school found!")
