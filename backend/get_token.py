import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from rest_framework_simplejwt.tokens import RefreshToken
from apps.users.models import User
import json

user = User.objects.first()
token = str(RefreshToken.for_user(user).access_token)

with open('../frontend/.env', 'r', encoding='utf-8') as f:
    content = f.read()

if 'NEXT_PUBLIC_TOKEN=' in content:
    import re
    content = re.sub(r'NEXT_PUBLIC_TOKEN=.*', f'NEXT_PUBLIC_TOKEN={token}', content)
else:
    content += f'\nNEXT_PUBLIC_TOKEN={token}\n'

with open('../frontend/.env', 'w', encoding='utf-8') as f:
    f.write(content)

print("Token saved to .env")
