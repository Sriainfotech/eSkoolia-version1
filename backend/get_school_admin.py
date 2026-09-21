import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from apps.users.models import User

# Find a school admin
school_admins = User.objects.filter(is_school_admin=True, school__isnull=False)

if school_admins.exists():
    admin = school_admins.first()
    school_name = admin.school.name
    print(f"Found School Admin for School: {school_name}")
    print(f"Username: {admin.username}")
    print(f"Email: {admin.email}")
    
    # Reset password
    admin.set_password("demo1234")
    admin.save()
    print("Password has been reset to: demo1234")
else:
    print("No school admins found in the database.")
