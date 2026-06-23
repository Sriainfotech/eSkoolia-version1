#!/usr/bin/env python
"""
Diagnostic 5: API Tenant Resolution Analysis
Checks how specific tenant APIs resolve school/tenant context
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "="*80)
print("DIAGNOSTIC 5: API TENANT RESOLUTION ANALYSIS")
print("="*80)

from pathlib import Path
import re

backend_dir = Path(r"e:\Es_V1\eskoolia-v1\backend")

print("\n" + "-"*80)
print("5.1 FIND ACADEMIC YEAR VIEW")
print("-"*80)

# Find academic year related views
print(f"\nSearching for Academic Year views...")

for py_file in backend_dir.rglob("*.py"):
    if 'academic' not in str(py_file).lower():
        continue
    if any(skip in str(py_file) for skip in ['venv', '__pycache__', 'migrations', '.git']):
        continue
    
    content = py_file.read_text(encoding='utf-8', errors='ignore')
    
    # Look for ViewSet or view classes
    if 'ViewSet' in content or '@api_view' in content:
        rel_path = py_file.relative_to(backend_dir)
        print(f"\n  Found: {rel_path}")
        
        # Find class/function names
        matches = re.findall(r'class (\w+ViewSet)\(|class (\w+View)\(|def (\w+)\(', content)
        for match in matches:
            name = next((m for m in match if m), None)
            if name:
                print(f"    - {name}")

print("\n" + "-"*80)
print("5.2 COMMON TENANT RESOLUTION PATTERNS IN VIEWS")
print("-"*80)

print(f"\nCommon patterns used for tenant resolution:")

# Search for get_queryset methods
patterns = {
    'get_queryset with school filter': (
        r'def get_queryset\(self\):.*?\.filter\(.*?school'
    ),
    'get_queryset with tenant filter': (
        r'def get_queryset\(self\):.*?\.filter\(.*?tenant'
    ),
    'School ID from request': (
        r'request\.user\.school|request\.user\.school_id|self\.request\.user\.school'
    ),
    'Direct tenant access': (
        r'request\.tenant|self\.request\.tenant'
    ),
}

findings = {}
for pattern_name, pattern in patterns.items():
    findings[pattern_name] = []
    
    for py_file in backend_dir.rglob("*.py"):
        if any(skip in str(py_file) for skip in ['venv', '__pycache__', 'migrations', '.git']):
            continue
        
        try:
            content = py_file.read_text(encoding='utf-8', errors='ignore')
            if re.search(pattern, content, re.DOTALL):
                rel_path = py_file.relative_to(backend_dir)
                findings[pattern_name].append(str(rel_path))
        except:
            pass

print(f"\nResolution patterns by file count:")
for pattern_name, files in sorted(findings.items(), key=lambda x: len(x[1]), reverse=True):
    print(f"  {pattern_name}: {len(set(files))} files")

print("\n" + "-"*80)
print("5.3 VIEWSET GET_QUERYSET IMPLEMENTATIONS")
print("-"*80)

print(f"\nSearching for get_queryset methods...")

queryset_files = []
for py_file in backend_dir.rglob("*.py"):
    if any(skip in str(py_file) for skip in ['venv', '__pycache__', 'migrations', '.git']):
        continue
    
    try:
        content = py_file.read_text(encoding='utf-8', errors='ignore')
        if 'def get_queryset(self)' in content:
            rel_path = py_file.relative_to(backend_dir)
            queryset_files.append(str(rel_path))
    except:
        pass

print(f"\nFound {len(queryset_files)} files with get_queryset:")
for f in sorted(queryset_files)[:15]:
    print(f"  ✓ {f}")
if len(queryset_files) > 15:
    print(f"  ... and {len(queryset_files) - 15} more")

print("\n" + "-"*80)
print("5.4 TENANT RESOLUTION POINTS OF FAILURE")
print("-"*80)

print(f"\nPotential points where tenant resolution can fail:")
print(f"  1. request.user.school is None (user not linked to school)")
print(f"  2. request.tenant is not set (middleware not running)")
print(f"  3. request.get_host() returns proxy IP instead of domain")
print(f"  4. Domain lookup fails (no matching domain for host)")
print(f"  5. get_queryset doesn't filter by school/tenant")
print(f"  6. Missing school_id check in permission/filter")

print("\n" + "-"*80)
print("5.5 DATABASE - USER SCHOOL LINKS")
print("-"*80)

from django.contrib.auth import get_user_model
from apps.tenancy.models import School

User = get_user_model()

print(f"\nUsers with school links:")

users_with_school = User.objects.exclude(school_id__isnull=True).values(
    'username', 'school_id', 'is_school_admin', 'school__name'
)

for user in users_with_school[:10]:
    print(f"  ✓ {user['username']:<15} school_id={user['school_id']} admin={user['is_school_admin']} ({user['school__name']})")

if users_with_school.count() > 10:
    print(f"  ... and {users_with_school.count() - 10} more")

print("\n" + "-"*80)
print("5.6 HEADER FORWARDING CHECK (IMPORTANT FOR SERVER)")
print("-"*80)

print(f"\nIf running behind Nginx/Gunicorn, check for:")
print(f"  ✓ X-Forwarded-For header (client IP)")
print(f"  ✓ X-Forwarded-Proto header (http/https)")
print(f"  ✓ X-Forwarded-Host header (original host)")
print(f"  ✓ X-Real-IP header (alternative client IP)")

print(f"\nDjango setting for proxy headers:")
print(f"  SECURE_PROXY_SSL_HEADER: {getattr(django.conf.settings, 'SECURE_PROXY_SSL_HEADER', 'NOT SET')}")

from django.conf import settings
print(f"  ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")

print("\n" + "="*80)
print("END DIAGNOSTIC 5")
print("="*80)
