import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

from apps.users.models import UserLoginLog

log = UserLoginLog.objects.create(
    attempted_username="test_gui_sync",
    status="FAILED",
    portal_type="admin",
    ip_address="127.0.0.1",
    user_agent="Test Script"
)
print("Created log ID:", log.id)

for l in UserLoginLog.objects.all():
    print(f"[{l.id}] User: {l.attempted_username}, Status: {l.status}")
