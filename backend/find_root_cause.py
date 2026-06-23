#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "=" * 70)
print("FINAL ROOT CAUSE: Debug prints causing exception")
print("=" * 70)

from django.contrib.auth.models import AnonymousUser

# Test what happens when we access AnonymousUser attributes
print("\n--- Testing AnonymousUser attributes ---")

anon = AnonymousUser()
print(f"AnonymousUser object: {anon}")
print(f"anon.is_authenticated: {anon.is_authenticated}")

# These are the debug prints I added:
try:
    print(f"anon.username: {anon.username}")
except AttributeError as e:
    print(f"ERROR accessing anon.username: {e}")

try:
    print(f"anon.school_id: {anon.school_id}")
except AttributeError as e:
    print(f"ERROR accessing anon.school_id: {e}")

try:
    print(f"anon.school: {anon.school}")
except AttributeError as e:
    print(f"ERROR accessing anon.school: {e}")

# Now test what the original debug code does in views.py
print("\n" + "=" * 70)
print("Testing the debug code I added to views.py")
print("=" * 70)

from django.test import RequestFactory
from rest_framework.request import Request

factory = RequestFactory()
wsgi_request = factory.get('/api/school-info/?subdomain=zphschool', HTTP_HOST='localhost:8000')
wsgi_request.user = AnonymousUser()

print("\nAttempting the debug prints from views.py:")
print("=" * 50)
try:
    print("REQUEST USER:", wsgi_request.user)
    print("USERNAME:", wsgi_request.user.username)  # <-- THIS LINE FAILS
    print("SCHOOL ID:", wsgi_request.user.school_id)
    print("SCHOOL:", wsgi_request.user.school)
    print("HOST:", wsgi_request.get_host())
    print("=" * 50)
except AttributeError as e:
    print(f"EXCEPTION: {type(e).__name__}: {e}")
    print("=" * 50)
    print("\nThis AttributeError is caught by: except Exception:")
    print("And causes: return Response({'error': 'School not found'}, status=404)")

# Show what SHOULD be used instead
print("\n" + "=" * 70)
print("SAFE debug print alternative")
print("=" * 70)

print("\nInstead of accessing user.username directly, check:")
try:
    if wsgi_request.user.is_authenticated:
        print("REQUEST USER:", wsgi_request.user)
        print("USERNAME:", wsgi_request.user.username)
        print("SCHOOL ID:", wsgi_request.user.school_id)
    else:
        print("REQUEST USER: AnonymousUser (not authenticated)")
    print("HOST:", wsgi_request.get_host())
except Exception as e:
    print(f"Exception: {e}")

print("\n" + "=" * 70)
print("CONCLUSION")
print("=" * 70)

print("""
ROOT CAUSE: The debug print statements accessing request.user.username 
on an AnonymousUser object throws AttributeError, which is caught by
the broad 'except Exception:' block in the view.

This causes the API to return {"error": "School not found"} even though
the domain lookup would succeed.

THE FIX: Either:
1. Add a check for is_authenticated before printing user attributes
2. Use getattr with defaults: getattr(request.user, 'username', 'anonymous')
3. Remove the unsafe debug prints
""")
