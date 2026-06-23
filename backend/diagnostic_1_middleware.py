#!/usr/bin/env python
"""
Diagnostic 1: Middleware Configuration & Execution Order
Investigates tenant middleware setup and execution order
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "="*80)
print("DIAGNOSTIC 1: MIDDLEWARE CONFIGURATION & EXECUTION ORDER")
print("="*80)

from django.conf import settings

print("\n" + "-"*80)
print("1.1 INSTALLED APPS - Tenant-related apps")
print("-"*80)

installed_apps = settings.INSTALLED_APPS
tenant_apps = [app for app in installed_apps if 'tenancy' in app.lower() or 'tenant' in app.lower()]
print(f"\nTenant-related apps in INSTALLED_APPS:")
for app in tenant_apps:
    print(f"  ✓ {app}")

print("\n" + "-"*80)
print("1.2 MIDDLEWARE ORDER")
print("-"*80)

middleware = settings.MIDDLEWARE
print(f"\nTotal middleware classes: {len(middleware)}")
print(f"\nMiddleware order:")
for i, mw in enumerate(middleware, 1):
    mw_name = mw.split('.')[-1]
    is_tenant = 'tenant' in mw.lower()
    marker = "↓ TENANT" if is_tenant else ""
    print(f"  {i:2d}. {mw_name:<40} {marker}")

print("\n" + "-"*80)
print("1.3 MULTI_TENANCY_ENABLED setting")
print("-"*80)

multi_tenancy_enabled = settings.MULTI_TENANCY_ENABLED
print(f"\nMULTI_TENANCY_ENABLED: {multi_tenancy_enabled}")

if multi_tenancy_enabled:
    print("\n⚠️  MULTI_TENANCY_ENABLED is TRUE")
    print("   Django-tenants integration is ACTIVE")
else:
    print("\n⚠️  MULTI_TENANCY_ENABLED is FALSE")
    print("   Django-tenants may not be active - custom tenant resolution may be needed")

print("\n" + "-"*80)
print("1.4 DATABASE CONFIGURATION")
print("-"*80)

db_config = settings.DATABASES.get('default', {})
print(f"\nDatabase Engine: {db_config.get('ENGINE')}")
print(f"Database Name: {db_config.get('NAME')}")
print(f"Database Host: {db_config.get('HOST')}")

print("\n" + "-"*80)
print("1.5 ALLOWED_HOSTS")
print("-"*80)

allowed_hosts = settings.ALLOWED_HOSTS
print(f"\nALLOWED_HOSTS ({len(allowed_hosts)} entries):")
for host in allowed_hosts:
    print(f"  ✓ {host}")

print("\n" + "-"*80)
print("1.6 TENANT-RELATED SETTINGS")
print("-"*80)

tenant_settings = {
    'MULTI_TENANCY_ENABLED': getattr(settings, 'MULTI_TENANCY_ENABLED', 'N/A'),
}

for key in dir(settings):
    if 'tenant' in key.lower() or 'tenancy' in key.lower():
        value = getattr(settings, key)
        if not callable(value) and not key.startswith('_'):
            tenant_settings[key] = value

print(f"\nTenant-related settings:")
for key, value in sorted(tenant_settings.items()):
    if not key.startswith('_'):
        print(f"  {key}: {value}")

print("\n" + "="*80)
print("END DIAGNOSTIC 1")
print("="*80)
