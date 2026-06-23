#!/usr/bin/env python
import os
import django
import traceback

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "=" * 70)
print("ROOT CAUSE DIAGNOSTIC: Exception in school_info_view")
print("=" * 70)

from apps.tenancy.models import Domain
from django.test import RequestFactory
from rest_framework.request import Request
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model

# Test 1: With AnonymousUser
print("\n" + "=" * 70)
print("TEST 1: Manual view logic with AnonymousUser")
print("=" * 70)

factory = RequestFactory()
wsgi_request = factory.get('/api/school-info/?subdomain=zphschool', HTTP_HOST='localhost:8000')
wsgi_request.user = AnonymousUser()

# Wrap it with DRF Request
request = Request(wsgi_request)

print(f"Request.user: {request.user}")
print(f"Request.query_params: {request.query_params}")

# Now manually execute the view logic
subdomain = request.query_params.get("subdomain", "").strip().lower()
print(f"\n[VIEW LOGIC] Subdomain: '{subdomain}'")

try:
    # First try exact match
    print("\n[VIEW LOGIC] Step 1: Trying exact match")
    print(f"  Query: Domain.objects.select_related('tenant').filter(domain='{subdomain}')")
    domain = Domain.objects.select_related("tenant").filter(domain=subdomain).first()
    print(f"  Result: {domain}")
    
    # Fall back to prefix match
    if domain is None:
        print("\n[VIEW LOGIC] Step 2: Exact match failed, trying prefix match")
        print(f"  Query: Domain.objects.select_related('tenant').filter(domain__startswith='{subdomain}.')")
        domain = Domain.objects.select_related("tenant").filter(
            domain__startswith=f"{subdomain}."
        ).first()
        print(f"  Result: {domain}")
    
    if domain is None:
        print("\n[VIEW LOGIC] Step 3: Domain is None - would return 404")
        print("  This is where 'School not found' error comes from")
    else:
        print(f"\n[VIEW LOGIC] Step 3: Domain found!")
        print(f"  Domain object: {domain}")
        print(f"  Domain.domain: {domain.domain}")
        print(f"  Domain.tenant_id: {domain.tenant_id}")
        
        print("\n[VIEW LOGIC] Step 4: Accessing tenant...")
        try:
            tenant = domain.tenant
            print(f"  Tenant object: {tenant}")
            print(f"  Tenant ID: {tenant.id}")
            print(f"  Tenant name: {tenant.name}")
        except Exception as tenant_err:
            print(f"  ERROR accessing tenant: {type(tenant_err).__name__}: {str(tenant_err)}")
            raise
        
        print("\n[VIEW LOGIC] Step 5: Building response...")
        try:
            response_dict = {
                "name": tenant.name,
                "subdomain": tenant.subdomain_url,
                "logo_url": tenant.logo_url or None,
                "brand_color": tenant.brand_color or "#0d9488",
                "status": tenant.status,
            }
            print(f"  Response built successfully: {response_dict}")
        except Exception as resp_err:
            print(f"  ERROR building response: {type(resp_err).__name__}: {str(resp_err)}")
            raise
            
except Exception as e:
    print(f"\n[ERROR] Exception caught in try block!")
    print(f"  Type: {type(e).__name__}")
    print(f"  Message: {str(e)}")
    print(f"\nFull traceback:")
    traceback.print_exc()
    print(f"\nThis exception would be caught by: except Exception: return Response({{'error': 'School not found'}}, status=404)")

# Test 2: With zphs user
print("\n" + "=" * 70)
print("TEST 2: Manual view logic with zphs user")
print("=" * 70)

User = get_user_model()
zphs_user = User.objects.filter(username="zphs").first()

if zphs_user:
    print(f"zphs user found:")
    print(f"  username: {zphs_user.username}")
    print(f"  school: {zphs_user.school}")
    print(f"  school_id: {zphs_user.school_id}")
    print(f"  is_school_admin: {zphs_user.is_school_admin}")
    
    wsgi_request = factory.get('/api/school-info/?subdomain=zphschool', HTTP_HOST='localhost:8000')
    wsgi_request.user = zphs_user
    request = Request(wsgi_request)
    
    subdomain = request.query_params.get("subdomain", "").strip().lower()
    print(f"\n[VIEW LOGIC] Subdomain: '{subdomain}'")
    
    try:
        # First try exact match
        print("\n[VIEW LOGIC] Step 1: Trying exact match")
        domain = Domain.objects.select_related("tenant").filter(domain=subdomain).first()
        print(f"  Result: {domain}")
        
        # Fall back to prefix match
        if domain is None:
            print("\n[VIEW LOGIC] Step 2: Exact match failed, trying prefix match")
            domain = Domain.objects.select_related("tenant").filter(
                domain__startswith=f"{subdomain}."
            ).first()
            print(f"  Result: {domain}")
        
        if domain is None:
            print("\n[VIEW LOGIC] Step 3: Domain is None")
        else:
            print(f"\n[VIEW LOGIC] Step 3: Domain found: {domain.domain}")
            tenant = domain.tenant
            print(f"  Tenant: {tenant}")
            
            response_dict = {
                "name": tenant.name,
                "subdomain": tenant.subdomain_url,
                "logo_url": tenant.logo_url or None,
                "brand_color": tenant.brand_color or "#0d9488",
                "status": tenant.status,
            }
            print(f"  Response: {response_dict}")
            
    except Exception as e:
        print(f"\n[ERROR] Exception: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
else:
    print("zphs user not found")

print("\n" + "=" * 70)
print("TESTING ACTUAL VIEW")
print("=" * 70)

from apps.tenancy.views import school_info_view

wsgi_request = factory.get('/api/school-info/?subdomain=zphschool', HTTP_HOST='localhost:8000')
wsgi_request.user = AnonymousUser()
request = Request(wsgi_request)

print(f"\nCalling actual school_info_view...")
try:
    response = school_info_view(request)
    print(f"Status: {response.status_code}")
    print(f"Data: {response.data}")
except Exception as e:
    print(f"View raised exception: {type(e).__name__}: {str(e)}")
    traceback.print_exc()

print("\n" + "=" * 70)
print("END OF DIAGNOSTICS")
print("=" * 70)
