#!/usr/bin/env python
"""
Diagnostic 3: Tenant Resolution Logic Analysis
Checks how tenant is resolved in various API endpoints
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "="*80)
print("DIAGNOSTIC 3: TENANT RESOLUTION LOGIC ANALYSIS")
print("="*80)

from django.urls import get_resolver
from rest_framework.routers import DefaultRouter
import inspect

print("\n" + "-"*80)
print("3.1 URL CONFIGURATION")
print("-"*80)

# Check URL configuration
from django.conf import settings

urls_files = [
    'config.urls',
    'config.urls_tenant',
    'config.urls_public',
]

print(f"\nURL files configured:")
root_urlconf = settings.ROOT_URLCONF
print(f"  ROOT_URLCONF: {root_urlconf}")

for url_file in urls_files:
    try:
        __import__(url_file)
        print(f"  ✓ {url_file} exists")
    except ImportError:
        print(f"  ✗ {url_file} not found")

print("\n" + "-"*80)
print("3.2 TENANT RESOLUTION METHODS")
print("-"*80)

# Check tenancy views for tenant resolution
print(f"\nSearching for tenant resolution patterns...")

from pathlib import Path
import re

backend_dir = Path(r"e:\Es_V1\eskoolia-v1\backend")

# Patterns to search for
patterns = {
    'request.tenant': r'request\.tenant',
    'request.user.school': r'request\.user\.school',
    'get_tenant': r'get_tenant\(',
    'School.objects': r'School\.objects\.filter',
    'Domain.objects': r'Domain\.objects\.filter',
    'SchoolTenant.objects': r'SchoolTenant\.objects\.filter',
    'resolve_tenant': r'resolve_tenant|get_current_tenant',
}

findings = {}
for pattern_name, pattern in patterns.items():
    findings[pattern_name] = []
    
    for py_file in backend_dir.rglob("*.py"):
        if any(skip in str(py_file) for skip in ['venv', '__pycache__', 'migrations', '.git']):
            continue
        
        try:
            content = py_file.read_text(encoding='utf-8', errors='ignore')
            if re.search(pattern, content):
                rel_path = py_file.relative_to(backend_dir)
                findings[pattern_name].append(str(rel_path))
        except:
            pass

print(f"\nTenant resolution patterns found:")
for pattern_name, files in sorted(findings.items()):
    if files:
        print(f"\n  {pattern_name}: {len(files)} file(s)")
        for f in sorted(set(files))[:5]:  # Show first 5
            print(f"    ✓ {f}")
        if len(set(files)) > 5:
            print(f"    ... and {len(set(files)) - 5} more")

print("\n" + "-"*80)
print("3.3 TENANT MIDDLEWARE ANALYSIS")
print("-"*80)

# Check for tenant middleware
print(f"\nTenant middleware in settings:")

middleware = settings.MIDDLEWARE
tenant_middleware = [mw for mw in middleware if 'tenant' in mw.lower()]

if tenant_middleware:
    for mw in tenant_middleware:
        print(f"  ✓ {mw}")
else:
    print(f"  ✗ No tenant middleware found")

print("\n" + "-"*80)
print("3.4 DATABASE MODELS FOR TENANT RESOLUTION")
print("-"*80)

from apps.tenancy.models import School, SchoolTenant, Domain
from django.contrib.auth import get_user_model

User = get_user_model()

print(f"\nDatabase model fields available for tenant resolution:")

print(f"\n  User model:")
user_fields = [f.name for f in User._meta.get_fields() if 'school' in f.name.lower()]
print(f"    School-related fields: {user_fields if user_fields else 'None'}")

print(f"\n  School model:")
school_fields = [f.name for f in School._meta.get_fields()]
print(f"    Fields: {', '.join(school_fields[:5])}...")

print(f"\n  SchoolTenant model:")
tenant_fields = [f.name for f in SchoolTenant._meta.get_fields()]
print(f"    Fields: {', '.join(tenant_fields[:5])}...")

print(f"\n  Domain model:")
domain_fields = [f.name for f in Domain._meta.get_fields()]
print(f"    Fields: {', '.join(domain_fields[:5])}...")

print("\n" + "-"*80)
print("3.5 TENANT RESOLUTION FROM REQUEST HOST")
print("-"*80)

# Check how host-based tenant resolution works
print(f"\nHost-based tenant resolution logic:")

try:
    # Try to find and show the implementation
    domain_count = Domain.objects.count()
    print(f"  ✓ Domain records in database: {domain_count}")
    
    # Check eskoolia.com domain pattern
    eskoolia_domains = Domain.objects.filter(domain__contains='.eskoolia.com').count()
    print(f"  ✓ .eskoolia.com domains: {eskoolia_domains}")
    
    # Check zphschool specifically
    zph_domain = Domain.objects.filter(domain__contains='zphschool')
    print(f"\n  zphschool domains:")
    for domain in zph_domain:
        print(f"    - {domain.domain} (tenant_id: {domain.tenant_id})")
        
except Exception as e:
    print(f"  Error: {e}")

print("\n" + "="*80)
print("END DIAGNOSTIC 3")
print("="*80)
