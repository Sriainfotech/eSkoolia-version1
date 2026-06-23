#!/usr/bin/env python
import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "=" * 70)
print("DIAGNOSTIC: Finding exact exception in school_info_view")
print("=" * 70)

from apps.tenancy.models import Domain, SchoolTenant
from django.test import RequestFactory
from apps.tenancy.views import school_info_view

# Test 1: Check if Domain query works
print("\n" + "=" * 70)
print("TEST 1: Domain query for 'zphschool'")
print("=" * 70)

subdomain = "zphschool"

try:
    # Exact match
    domain = Domain.objects.select_related("tenant").filter(domain=subdomain).first()
    print(f"✓ Exact match query succeeded")
    print(f"  Result: {domain}")
    
    if domain is None:
        print(f"✗ Exact match not found, trying prefix match...")
        domain = Domain.objects.select_related("tenant").filter(
            domain__startswith=f"{subdomain}."
        ).first()
        print(f"✓ Prefix match query succeeded")
        print(f"  Result: {domain}")
        print(f"  Domain value: {domain.domain if domain else None}")
    
except Exception as e:
    print(f"✗ Domain query FAILED:")
    print(f"  Exception: {type(e).__name__}: {str(e)}")
    traceback.print_exc()

# Test 2: Access tenant from domain
print("\n" + "=" * 70)
print("TEST 2: Access tenant object from domain")
print("=" * 70)

if domain:
    try:
        tenant = domain.tenant
        print(f"✓ Tenant access succeeded")
        print(f"  Tenant object: {tenant}")
        print(f"  Tenant ID: {tenant.id if tenant else 'None'}")
    except Exception as e:
        print(f"✗ Tenant access FAILED:")
        print(f"  Exception: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
else:
    print("✗ Domain is None, cannot access tenant")

# Test 3: Access tenant attributes one by one
print("\n" + "=" * 70)
print("TEST 3: Access each tenant attribute")
print("=" * 70)

if domain and domain.tenant:
    tenant = domain.tenant
    attributes = ['name', 'subdomain_url', 'logo_url', 'brand_color', 'status']
    
    for attr in attributes:
        try:
            value = getattr(tenant, attr, None)
            print(f"✓ tenant.{attr} = {repr(value)}")
        except Exception as e:
            print(f"✗ tenant.{attr} FAILED:")
            print(f"  Exception: {type(e).__name__}: {str(e)}")
            traceback.print_exc()

# Test 4: Full school_info_view response building
print("\n" + "=" * 70)
print("TEST 4: Build full Response object")
print("=" * 70)

if domain and domain.tenant:
    tenant = domain.tenant
    try:
        response_data = {
            "name": tenant.name,
            "subdomain": tenant.subdomain_url,
            "logo_url": tenant.logo_url or None,
            "brand_color": tenant.brand_color or "#0d9488",
            "status": tenant.status,
        }
        print(f"✓ Response object built successfully:")
        import json
        print(json.dumps(response_data, indent=2))
    except Exception as e:
        print(f"✗ Response building FAILED:")
        print(f"  Exception: {type(e).__name__}: {str(e)}")
        traceback.print_exc()

# Test 5: Call the actual view with debug info
print("\n" + "=" * 70)
print("TEST 5: Call actual school_info_view")
print("=" * 70)

try:
    factory = RequestFactory()
    request = factory.get(f'/api/school-info/?subdomain=zphschool')
    print(f"Request created: {request}")
    print(f"Request user: {request.user}")
    print(f"Request host: {request.get_host()}")
    
    response = school_info_view(request)
    print(f"\n✓ View call succeeded")
    print(f"  Status: {response.status_code}")
    print(f"  Data: {response.data}")
except Exception as e:
    print(f"\n✗ View call FAILED:")
    print(f"  Exception: {type(e).__name__}: {str(e)}")
    print(f"\nFull traceback:")
    traceback.print_exc()

# Test 6: Check if the exception is in the except block
print("\n" + "=" * 70)
print("TEST 6: Manually trigger the exact code path")
print("=" * 70)

subdomain = "zphschool"
try:
    from apps.tenancy.models import Domain
    # First try exact match (subdomain stored as-is)
    domain = Domain.objects.select_related("tenant").filter(domain=subdomain).first()
    # Fall back to prefix match for full FQDNs like "testschool.eskoolia.local"
    if domain is None:
        domain = Domain.objects.select_related("tenant").filter(
            domain__startswith=f"{subdomain}."
        ).first()
    if domain is None:
        print("Domain is None - this would trigger the error")
    else:
        tenant = domain.tenant
        print(f"✓ Tenant retrieved: {tenant}")
        
        # Try to build the exact response
        response_dict = {
            "name": tenant.name,
            "subdomain": tenant.subdomain_url,
            "logo_url": tenant.logo_url or None,
            "brand_color": tenant.brand_color or "#0d9488",
            "status": tenant.status,
        }
        print(f"✓ Response dict built successfully")
        
        from rest_framework.response import Response
        response = Response(response_dict)
        print(f"✓ Response object created: {response.status_code}")

except Exception as e:
    print(f"✗ EXCEPTION CAUGHT:")
    print(f"  Type: {type(e).__name__}")
    print(f"  Message: {str(e)}")
    print(f"\nFull traceback:")
    traceback.print_exc()

print("\n" + "=" * 70)
print("END OF DIAGNOSTICS")
print("=" * 70)
