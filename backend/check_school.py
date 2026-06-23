#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("=" * 50)
print("CHECK 1: Check if the school exists")
print("=" * 50)

from apps.tenancy.models import School
school = School.objects.filter(subdomain="zphschool").first()
print(school)
print(school.id if school else None)

print("\n" + "=" * 50)
print("CHECK 2: Check which school the logged-in user is linked to")
print("=" * 50)

from django.contrib.auth import get_user_model
User = get_user_model()

# Get the first user to test with
user = User.objects.first()
if user:
    print("User:", user)
    print("Username:", user.username)
    print("School:", getattr(user, "school", None))
    print("School ID:", getattr(user, "school_id", None))
else:
    print("No users found in database")

print("\n" + "=" * 50)
print("CHECK 6: Check all school-related fields on the user")
print("=" * 50)

if user:
    for field in user._meta.fields:
        print(f"{field.name}: {getattr(user, field.name)}")
else:
    print("No users found")
