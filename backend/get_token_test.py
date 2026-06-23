#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from tenancy.models import School

User = get_user_model()

try:
    school = School.objects.first()
    print(f"✓ Found school: {school}")
except Exception as e:
    print(f"✗ No school: {e}")

try:
    user = User.objects.filter(is_staff=True).first()
    if user:
        print(f"✓ User: {user.username}")
        refresh = RefreshToken.for_user(user)
        access_token = str(refresh.access_token)
        print(f"✓ Access Token: {access_token[:50]}...")
    else:
        print("✗ No staff user found")
except Exception as e:
    print(f"✗ Error: {e}")
