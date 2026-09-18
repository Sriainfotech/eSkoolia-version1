import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from apps.users.models import User

emails_to_check = ['admin@gmail.com', 'demo@gmail.com']

for email in emails_to_check:
    try:
        user = User.objects.get(email=email)
        print(f"\n--- User: {email} ---")
        print(f"Is Superuser (Platform Admin): {user.is_superuser}")
        print(f"Is Staff (Can login to Django admin): {user.is_staff}")
        
        # Check if there is a role mapping or specific role
        if hasattr(user, 'role'):
            role_name = user.role.name if user.role else "None"
            print(f"Assigned Role: {role_name}")
            
        if hasattr(user, 'user_type'):
            print(f"User Type: {user.user_type}")
            
    except User.DoesNotExist:
        print(f"\n--- User: {email} ---")
        print("Does not exist in the database.")
