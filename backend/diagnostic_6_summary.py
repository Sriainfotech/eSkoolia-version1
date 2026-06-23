#!/usr/bin/env python
"""
Diagnostic 6: Comprehensive Summary & Failing Code Locations
Shows exact code locations where tenant resolution fails
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "="*80)
print("DIAGNOSTIC 6: COMPREHENSIVE SUMMARY & FAILING CODE")
print("="*80)

from pathlib import Path
import re

backend_dir = Path(r"e:\Es_V1\eskoolia-v1\backend")

print("\n" + "-"*80)
print("6.1 ALL 'SCHOOL NOT FOUND' ERROR RETURNS")
print("-"*80)

# Find all places that return school not found
error_locations = []

for py_file in backend_dir.rglob("*.py"):
    if any(skip in str(py_file) for skip in ['venv', '__pycache__', 'migrations', '.git']):
        continue
    
    try:
        content = py_file.read_text(encoding='utf-8', errors='ignore')
        lines = content.split('\n')
        
        for i, line in enumerate(lines, 1):
            if 'school' in line.lower() and 'not' in line.lower() and 'found' in line.lower():
                # Get surrounding lines for context
                start = max(0, i - 5)
                end = min(len(lines), i + 5)
                context = lines[start:end]
                
                rel_path = py_file.relative_to(backend_dir)
                error_locations.append({
                    'file': rel_path,
                    'line': i,
                    'error_line': line.strip(),
                    'context': context
                })
    except:
        pass

if error_locations:
    print(f"\nFound {len(error_locations)} location(s):\n")
    for idx, loc in enumerate(error_locations, 1):
        print(f"{idx}. {loc['file']}:{loc['line']}")
        print(f"   Error: {loc['error_line'][:80]}")
        print()
else:
    print("No explicit 'School not found' error locations found")

print("\n" + "-"*80)
print("6.2 AUTHENTICATION & TENANT RESOLUTION FLOW")
print("-"*80)

print(f"""
Local Environment Flow (WORKS):
───────────────────────────────
1. User logs in with zphs/password
2. Frontend stores JWT token
3. Frontend calls API with token + header Host=localhost:8000
4. Django request has:
   - request.user = zphs (authenticated)
   - request.user.school_id = 49
   - request.user.school = zphSchool
5. View queries: School.objects.filter(school_id=request.user.school_id)
6. API returns 200 with data

Server Environment Flow (FAILS):
────────────────────────────
1. User logs in with zphs/password
2. Frontend stores JWT token
3. Frontend calls API with token + header Host=zphschool.eskoolia.com
4. Django request received through Nginx proxy might have:
   - request.get_host() = proxy_server_ip:port OR original domain
   - HTTP_HOST header not properly forwarded
   - request.user = zphs (authenticated)
   - request.user.school_id = 49
5. Problem 1: Host-based tenant lookup fails
   - Domain.objects.filter(domain=proxy_ip) returns None
6. Problem 2: request.tenant not set by middleware
   - Middleware needs proper HTTP_HOST header
7. Problem 3: Some APIs might rely on request.tenant instead of request.user.school
8. API returns 404 School not found

Nginx Configuration Issue:
─────────────────────────
Missing or incorrect headers forwarding:
  - proxy_set_header Host $host;  (might not be set)
  - proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  - proxy_set_header X-Forwarded-Proto $scheme;
  
Result:
  request.get_host() returns Nginx IP instead of original domain
  Domain lookup fails
  Tenant not resolved
""")

print("\n" + "-"*80)
print("6.3 CRITICAL DIFFERENCES")
print("-"*80)

print(f"""
Local vs Server Differences:
───────────────────────────

┌─────────────────────┬──────────────────────┬──────────────────────┐
│ Component           │ Local                │ Server               │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ request.get_host()  │ localhost:8000       │ proxy_ip:port OR     │
│                     │ zphschool.eskoolia   │ original_host        │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ HTTP_HOST header    │ localhost:8000       │ May be modified by   │
│                     │ zphschool.eskoolia   │ proxy if not         │
│                     │                      │ configured properly  │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ Nginx setup         │ N/A (dev server)     │ May have incorrect   │
│                     │                      │ header forwarding    │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ request.tenant      │ Set by middleware if │ May not be set if    │
│                     │ domain lookup works  │ host lookup fails    │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ request.user.school │ Set (linked in DB)   │ Set (linked in DB)   │
│ _id                 │ Always works         │ Always works         │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ DEBUG               │ True                 │ False                │
├─────────────────────┼──────────────────────┼──────────────────────┤
│ ALLOWED_HOSTS       │ *.eskoolia.*         │ May not include all  │
│                     │ localhost            │ server domains       │
└─────────────────────┴──────────────────────┴──────────────────────┘

Root Cause: Hostname resolution fails on server
──────────────────────────────────────────────
Local:  request.get_host() → localhost:8000 or subdomain → works
Server: request.get_host() → proxy_ip:port → Domain lookup fails → 404
""")

print("\n" + "-"*80)
print("6.4 AFFECTED API ENDPOINTS")
print("-"*80)

print(f"""
These endpoints likely fail due to tenant resolution:

Endpoints that might rely on Host-based tenant resolution:
✗ /api/academic-year/ (AcademicYear ViewSet)
✗ /api/staff-onboarding/ (Staff onboarding)
✗ /api/attendance/ (Attendance tracking)
✗ /api/fees/ (Fees dashboard)
✗ /api/complaints/ (Complaints module)

Endpoints that work (use request.user.school):
✓ /api/school-info/?subdomain=... (direct school lookup)
✓ Any endpoint using request.user.school_id filter

APIs that would fail on server but work locally:
─────────────────────────────────────────────
If API uses:
  - Host-based domain lookup
  - request.tenant (set by middleware based on Host)
  - Domain.objects.filter(domain=request.get_host())

Example problematic pattern:
```python
def get_queryset(self):
    # This fails if domain lookup doesn't work
    tenant = self.request.tenant  # None if Host lookup failed
    if not tenant:
        raise Http404("School not found")
    return Model.objects.filter(tenant=tenant)
```

Better pattern (works in both environments):
```python
def get_queryset(self):
    school_id = self.request.user.school_id
    if not school_id:
        raise Http404("User not linked to school")
    return Model.objects.filter(school_id=school_id)
```
""")

print("\n" + "-"*80)
print("6.5 SERVER ENVIRONMENT CHECKLIST")
print("-"*80)

print(f"""
Check the following on SERVER to fix the issue:

NGINX CONFIGURATION:
───────────────────
□ Check /etc/nginx/sites-available/eskoolia (or similar)
□ Verify proxy_set_header directives:
  ✓ proxy_set_header Host $host;
  ✓ proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  ✓ proxy_set_header X-Forwarded-Proto $scheme;
  ✓ proxy_set_header X-Forwarded-Host $server_name;

DJANGO SETTINGS:
────────────────
□ Check config/settings/production.py:
  ✓ ALLOWED_HOSTS includes *.eskoolia.com
  ✓ SECURE_PROXY_SSL_HEADER is set correctly
  ✓ MULTI_TENANCY_ENABLED setting

MIDDLEWARE:
───────────
□ Verify middleware order in config/settings/base.py:
  ✓ Tenant middleware comes AFTER authentication
  ✓ Tenant middleware comes BEFORE views

URL ROUTING:
────────────
□ Check which URLs file is being used for server:
  ✓ config.urls or config.urls_tenant?
  ✓ Do tenant-specific routes work?

DATABASE:
─────────
□ Domain table has correct entries
□ Users are linked to schools
□ SchoolTenant records exist
""")

print("\n" + "="*80)
print("END DIAGNOSTIC 6")
print("="*80)
