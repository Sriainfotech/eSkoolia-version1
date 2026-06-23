#!/usr/bin/env python
import os
import django
import traceback
import sys

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "=" * 70)
print("ENHANCED DIAGNOSTIC: Capturing exact exception in school_info_view")
print("=" * 70)

from apps.tenancy.models import Domain, SchoolTenant
from django.test import RequestFactory
from rest_framework.response import Response

# Create a modified version of school_info_view with detailed exception tracking
def school_info_view_debug(request):
    """Debug version that shows all exceptions"""
    subdomain = request.query_params.get("subdomain", "").strip().lower()
    if not subdomain:
        return Response({"error": "subdomain query parameter is required"}, status=400)

    try:
        from apps.tenancy.models import Domain
        
        print("\n[DEBUG] Starting domain lookup...")
        print(f"[DEBUG] Subdomain parameter: {subdomain}")
        
        # First try exact match (subdomain stored as-is)
        print("[DEBUG] Trying exact match...")
        domain = Domain.objects.select_related("tenant").filter(domain=subdomain).first()
        print(f"[DEBUG] Exact match result: {domain}")
        
        # Fall back to prefix match for full FQDNs like "testschool.eskoolia.local"
        if domain is None:
            print("[DEBUG] Exact match not found. Trying prefix match...")
            domain = Domain.objects.select_related("tenant").filter(
                domain__startswith=f"{subdomain}."
            ).first()
            print(f"[DEBUG] Prefix match result: {domain}")
        
        if domain is None:
            print("[DEBUG] Domain is None - returning 404")
            return Response({"error": "School not found"}, status=404)
        
        print(f"[DEBUG] Domain found: {domain.domain}")
        print("[DEBUG] Accessing tenant...")
        tenant = domain.tenant
        print(f"[DEBUG] Tenant: {tenant}")
        
        print("[DEBUG] Accessing tenant attributes...")
        print(f"[DEBUG] tenant.name: {tenant.name}")
        print(f"[DEBUG] tenant.subdomain_url: {tenant.subdomain_url}")
        print(f"[DEBUG] tenant.logo_url: {tenant.logo_url}")
        print(f"[DEBUG] tenant.brand_color: {tenant.brand_color}")
        print(f"[DEBUG] tenant.status: {tenant.status}")
        
        print("[DEBUG] Building response...")
        response_data = {
            "name": tenant.name,
            "subdomain": tenant.subdomain_url,
            "logo_url": tenant.logo_url or None,
            "brand_color": tenant.brand_color or "#0d9488",
            "status": tenant.status,
        }
        print(f"[DEBUG] Response data built: {response_data}")
        
        response = Response(response_data)
        print(f"[DEBUG] Response object created")
        return response
        
    except Exception as e:
        print(f"\n[ERROR] EXCEPTION CAUGHT!")
        print(f"[ERROR] Type: {type(e).__name__}")
        print(f"[ERROR] Message: {str(e)}")
        print(f"[ERROR] Full traceback:")
        traceback.print_exc()
        return Response({"error": "School not found"}, status=404)


# Test 1: Call with RequestFactory
print("\n" + "=" * 70)
print("TEST 1: Call with RequestFactory")
print("=" * 70)

factory = RequestFactory()
request = factory.get('/api/school-info/?subdomain=zphschool')

# Add a user to the request
from django.contrib.auth.models import AnonymousUser
request.user = AnonymousUser()

print(f"Request object: {request}")
print(f"Request.user: {request.user}")
print(f"Request.query_params: {request.GET}")

response = school_info_view_debug(request)
print(f"\nResponse Status: {response.status_code}")
print(f"Response Data: {response.data}")

# Test 2: Test with authenticated user
print("\n" + "=" * 70)
print("TEST 2: Call with authenticated user (zphs)")
print("=" * 70)

from django.contrib.auth import get_user_model
User = get_user_model()

zphs_user = User.objects.filter(username="zphs").first()
if zphs_user:
    request = factory.get('/api/school-info/?subdomain=zphschool')
    request.user = zphs_user
    print(f"Request.user: {zphs_user.username}")
    print(f"Request.user.school: {zphs_user.school}")
    print(f"Request.user.school_id: {zphs_user.school_id}")
    
    response = school_info_view_debug(request)
    print(f"\nResponse Status: {response.status_code}")
    print(f"Response Data: {response.data}")
else:
    print("zphs user not found")

print("\n" + "=" * 70)
print("END OF ENHANCED DIAGNOSTICS")
print("=" * 70)
