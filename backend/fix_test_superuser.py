"""One-shot fix: convert `test` into a pure platform super-admin.

Strips the school binding so `IsSuperAdmin` stops returning 403
"Tenant users cannot access super-admin APIs."

Run from backend/:
    python manage.py shell < fix_test_superuser.py
or:
    python fix_test_superuser.py    (after `manage.py shell` setup)
"""
import django
import os
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
django.setup()

from django.contrib.auth import get_user_model  # noqa: E402

User = get_user_model()

USERNAME = "test"  # change here if your username/email differs

try:
    u = User.objects.get(username=USERNAME)
except User.DoesNotExist:
    # Fall back to email lookup if username isn't 'test'
    try:
        u = User.objects.get(email=USERNAME)
    except User.DoesNotExist:
        print(f"[ERROR] No user found with username or email == '{USERNAME}'.")
        print("Available superusers:")
        for s in User.objects.filter(is_superuser=True):
            print(f"  - id={s.pk} username={s.username!r} email={s.email!r} school_id={getattr(s, 'school_id', None)!r}")
        sys.exit(1)

print(f"[BEFORE] id={u.pk} username={u.username!r} is_superuser={u.is_superuser} "
      f"is_staff={u.is_staff} school_id={getattr(u, 'school_id', None)!r}")

# Strip every tenant-binding attribute the permission class checks
if hasattr(u, "school"):
    u.school = None
if hasattr(u, "school_id"):
    u.school_id = None
u.is_staff = True
u.is_superuser = True
u.save()

print(f"[AFTER ] id={u.pk} username={u.username!r} is_superuser={u.is_superuser} "
      f"is_staff={u.is_staff} school_id={getattr(u, 'school_id', None)!r}")
print("\n[OK] User is now a pure platform super-admin.")
print("     Log out of the browser and log back in so a fresh JWT is issued.")
