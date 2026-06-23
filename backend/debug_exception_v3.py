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
from rest_framework.response import Response
from django.contrib.auth.models import AnonymousUser
from django.contrib.auth import get_user_model

# Test 1: With AnonymousUser
print("\n" + "=" * 70)
print("TEST 1: Call with AnonymousUser")
print("=" * 70)

factory = RequestFactory()
wsgi_request = factory.get('/api/school-info/?subdomain=zphschool')
wsgi_request.user = AnonymousUser()

# Wrap it with DRF Request
request = Request(wsgi_request)

print(f"WSGIRequest: {wsgi_request}")
print(f"DRF Request: {request}")
print(f"Request.user: {request.user}")
print(f"Request.query_params: {request.query_params}")
print(f"Request.get_host(): {request.get_host()}")

# Now manually execute the view logic
subdomain = request.query_params.get("subdomain", "").strip().lower()
print(f"\n[VIEW LOGIC] Subdomain: '{subdomain}'")

try:
    # First try exact match
    print("\n[VIEW LOGIC] Trying exact match: Domain.objects.filter(domain='zphschool')")
    domain = Domain.objects.select_related("tenant").filter(domain=subdomain).first()
    print(f"[VIEW LOGIC] Result: {domain}")
    
    # Fall back to prefix match
    if domain is None:
        print("\n[VIEW LOGIC] Trying prefix match: Domain.objects.filter(domain__startswith='zphschool.')")
        domain = Domain.objects.select_related("tenant").filter(
            domain__startswith=f"{subdomain}."
        ).first()
        print(f"[VIEW LOGIC] Result: {domain}")
    
    if domain is None:
        print("\n[VIEW LOGIC] Domain is None - would return 404")
    else:
        print(f"\n[VIEW LOGIC] Domain found: {domain.domain}")
        tenant = domain.tenant
        print(f"[VIEW LOGIC] Tenant: {tenant}")
        
        # Build response
        response_dict = {
            "name": tenant.name,
            "subdomain": tenant.subdomain_url,
            "logo_url": tenant.logo_url or None,
            "brand_color": tenant.brand_color or "#0d9488",
            "status": tenant.status,
        }
        print(f"[VIEW LOGIC] Response: {response_dict}")
        
except Exception as e:
    print(f"\n[ERROR] Exception: {type(e).__name__}: {str(e)}")
    traceback.print_exc()

# Test 2: With zphs user
print("\n" + "=" * 70)
print("TEST 2: Call with zphs user")
print("=" * 70)

User = get_user_model()
zphs_user = User.objects.filter(username="zphs").first()

if zphs_user:
    print(f"zphs user found:")
    print(f"  - username: {zphs_user.username}")
    print(f"  - school: {zphs_user.school}")
    print(f"  - school_id: {zphs_user.school_id}")
    print(f"  - is_school_admin: {zphs_user.is_school_admin}")
    
    wsgi_request = factory.get('/api/school-info/?subdomain=zphschool')
    wsgi_request.user = zphs_user
    request = Request(wsgi_request)
    
    subdomain = request.query_params.get("subdomain", "").strip().lower()
    print(f"\n[VIEW LOGIC] Subdomain: '{subdomain}'")
    
    try:
        # First try exact match
        print("\n[VIEW LOGIC] Trying exact match: Domain.objects.filter(domain='zphschool')")
        domain = Domain.objects.select_related("tenant").filter(domain=subdomain).first()
        print(f"[VIEW LOGIC] Result: {domain}")
        
        # Fall back to prefix match
        if domain is None:
            print("\n[VIEW LOGIC] Trying prefix match: Domain.objects.filter(domain__startswith='zphschool.')")
            domain = Domain.objects.select_related("tenant").filter(
                domain__startswith=f"{subdomain}."
            ).first()
            print(f"[VIEW LOGIC] Result: {domain}")
        
        if domain is None:
            print("\n[VIEW LOGIC] Domain is None - would return 404")
        else:
            print(f"\n[VIEW LOGIC] Domain found: {domain.domain}")
            tenant = domain.tenant
            print(f"[VIEW LOGIC] Tenant: {tenant}")
            
            # Build response
            response_dict = {
                "name": tenant.name,
                "subdomain": tenant.subdomain_url,
                "logo_url": tenant.logo_url or None,
                "brand_color": tenant.brand_color or "#0d9488",
                "status": tenant.status,
            }
            print(f"[VIEW LOGIC] Response: {response_dict}")
            
    except Exception as e:
        print(f"\n[ERROR] Exception: {type(e).__name__}: {str(e)}")
        traceback.print_exc()
else:
    print("zphs user not found")

print("\n" + "=" * 70)
print("ACTUAL VIEW CALL TEST")
print("=" * 70)

# Now test with the actual view
from apps.tenancy.views import school_info_view

wsgi_request = factory.get('/api/school-info/?subdomain=zphschool')
wsgi_request.user = AnonymousUser()
request = Request(wsgi_request)

print(f"\nCalling school_info_view with AnonymousUser...")
try:
    response = school_info_view(request)
    print(f"Response status: {response.status_code}")
    print(f"Response data: {response.data}")
except Exception as e:
    print(f"Exception: {type(e).__name__}: {str(e)}")
    traceback.print_exc()

print("\n" + "=" * 70)
print("END OF DIAGNOSTICS")
print("=" * 70)
