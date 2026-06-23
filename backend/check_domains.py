#!/usr/bin/env python
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("=" * 50)
print("CHECK 3: Find all Domains in database")
print("=" * 50)

from apps.tenancy.models import Domain, SchoolTenant, School

print("\n--- All Domains ---")
domains = Domain.objects.all().values('id', 'domain', 'is_primary', 'tenant_id')
for d in domains:
    print(d)

print("\n--- All SchoolTenants ---")
tenants = SchoolTenant.objects.all().values('id', 'tenant_id', 'name', 'subdomain_url', 'status')
for t in tenants:
    print(t)

print("\n--- All Schools ---")
schools = School.objects.all().values('id', 'name', 'subdomain', 'code')
for s in schools:
    print(s)

print("\n--- Domain for zphschool ---")
domain = Domain.objects.filter(domain="zphschool").first()
print(f"Domain object: {domain}")
if domain:
    print(f"Tenant: {domain.tenant}")
    print(f"Tenant ID: {domain.tenant_id}")
