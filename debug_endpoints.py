import urllib.request
import urllib.error
import sys
import os

token_val = None
with open('frontend/.env', 'r', encoding='utf-8') as f:
    for line in f:
        if line.startswith('NEXT_PUBLIC_TOKEN='):
            token_val = line.split('=', 1)[1].strip()

if not token_val:
    print("Could not find token in frontend/.env")
    sys.exit(1)

token = 'Bearer ' + token_val
endpoints = [
    ('/api/v1/students/students/', 'students'),
    ('/api/v1/core/classes/?page_size=100', 'classes'),
    ('/api/v1/fees/assignments/', 'assignments'),
    ('/api/v1/fees/groups/', 'groups'),
    ('/api/v1/fees/schedules/', 'schedules'),
]

for url, name in endpoints:
    req = urllib.request.Request(f'http://127.0.0.1:8000{url}', headers={'Authorization': token})
    try:
        res = urllib.request.urlopen(req)
        print(f"{name}: SUCCESS ({res.status})")
    except urllib.error.HTTPError as e:
        print(f"{name}: FAILED ({e.code})")
        print(e.read().decode('utf-8')[:300])
