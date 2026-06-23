#!/usr/bin/env python
"""
Diagnostic 4: Request Attributes & Host Resolution
Shows what request.tenant, request.school, and request.user.school look like
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.local')
django.setup()

print("\n" + "="*80)
print("DIAGNOSTIC 4: REQUEST ATTRIBUTES & HOST RESOLUTION")
print("="*80)

from django.test import RequestFactory
from rest_framework.request import Request
from django.contrib.auth import get_user_model
from django.conf import settings

User = get_user_model()

print("\n" + "-"*80)
print("4.1 SIMULATED REQUEST SCENARIOS")
print("-"*80)

factory = RequestFactory()

# Scenario 1: Anonymous user from localhost
print(f"\nScenario 1: Anonymous user from localhost:8000")
print("-" * 40)

wsgi_req = factory.get('/api/academic-year/', HTTP_HOST='localhost:8000')
from django.contrib.auth.models import AnonymousUser
wsgi_req.user = AnonymousUser()

print(f"  request.get_host(): {wsgi_req.get_host()}")
print(f"  request.user: {wsgi_req.user}")
print(f"  request.user.is_authenticated: {wsgi_req.user.is_authenticated}")
print(f"  hasattr(request, 'tenant'): {hasattr(wsgi_req, 'tenant')}")
print(f"  hasattr(request, 'school'): {hasattr(wsgi_req, 'school')}")

# Scenario 2: Authenticated user (zphs) from localhost
print(f"\nScenario 2: Authenticated user (zphs) from localhost:8000")
print("-" * 40)

zphs_user = User.objects.filter(username='zphs').first()
if zphs_user:
    wsgi_req = factory.get('/api/academic-year/', HTTP_HOST='localhost:8000')
    wsgi_req.user = zphs_user
    
    print(f"  request.get_host(): {wsgi_req.get_host()}")
    print(f"  request.user: {wsgi_req.user}")
    print(f"  request.user.username: {wsgi_req.user.username}")
    print(f"  request.user.school: {wsgi_req.user.school}")
    print(f"  request.user.school_id: {wsgi_req.user.school_id}")
    print(f"  request.user.is_school_admin: {getattr(wsgi_req.user, 'is_school_admin', 'N/A')}")
    print(f"  hasattr(request, 'tenant'): {hasattr(wsgi_req, 'tenant')}")
    print(f"  hasattr(request, 'school'): {hasattr(wsgi_req, 'school')}")
else:
    print(f"  zphs user not found")

# Scenario 3: From subdomain (zphschool.eskoolia.com)
print(f"\nScenario 3: From subdomain zphschool.eskoolia.com")
print("-" * 40)

wsgi_req = factory.get('/api/academic-year/', HTTP_HOST='zphschool.eskoolia.com')
wsgi_req.user = AnonymousUser()

print(f"  request.get_host(): {wsgi_req.get_host()}")
print(f"  request.user: {wsgi_req.user}")
print(f"  hasattr(request, 'tenant'): {hasattr(wsgi_req, 'tenant')}")
print(f"  hasattr(request, 'school'): {hasattr(wsgi_req, 'school')}")

# Scenario 4: From subdomain with authenticated user
print(f"\nScenario 4: From zphschool.eskoolia.com with zphs user")
print("-" * 40)

if zphs_user:
    wsgi_req = factory.get('/api/academic-year/', HTTP_HOST='zphschool.eskoolia.com')
    wsgi_req.user = zphs_user
    
    print(f"  request.get_host(): {wsgi_req.get_host()}")
    print(f"  request.user: {wsgi_req.user}")
    print(f"  request.user.school_id: {wsgi_req.user.school_id}")
    print(f"  hasattr(request, 'tenant'): {hasattr(wsgi_req, 'tenant')}")
    print(f"  hasattr(request, 'school'): {hasattr(wsgi_req, 'school')}")

print("\n" + "-"*80)
print("4.2 ENVIRONMENT DIFFERENCES")
print("-"*80)

print(f"\nLocal Environment Settings:")
print(f"  DEBUG: {settings.DEBUG}")
print(f"  ALLOWED_HOSTS: {settings.ALLOWED_HOSTS}")
print(f"  ROOT_URLCONF: {settings.ROOT_URLCONF}")

print(f"\nServer Environment (likely differences):")
print(f"  DEBUG: False (production)")
print(f"  ALLOWED_HOSTS: May not include local/test domains")
print(f"  HTTP_X_FORWARDED_FOR: Nginx/proxy may not be forwarding headers")
print(f"  HTTP_HOST: May be different from request.get_host()")

print("\n" + "-"*80)
print("4.3 HEADERS THAT AFFECT TENANT RESOLUTION")
print("-"*80)

print(f"\nHeaders that might be different between local and server:")
print(f"  ✓ HTTP_HOST - Host header from client")
print(f"  ✓ HTTP_X_FORWARDED_FOR - Real IP from proxy")
print(f"  ✓ HTTP_X_FORWARDED_PROTO - Protocol (http/https) from proxy")
print(f"  ✓ HTTP_X_FORWARDED_HOST - Original host from proxy")
print(f"  ✓ REMOTE_ADDR - Client IP")
print(f"  ✓ SERVER_NAME - Server hostname")

print("\n" + "-"*80)
print("4.4 DOMAIN MATCHING LOGIC")
print("-"*80)

print(f"\nHow tenant is resolved from host:")
print(f"  1. Extract host from request.get_host()")
print(f"  2. Query Domain model: Domain.objects.filter(domain=host)")
print(f"  3. If not found, try prefix match: Domain.objects.filter(domain__startswith=host)")
print(f"  4. Get tenant from domain.tenant")

from apps.tenancy.models import Domain

# Test domain lookups
test_hosts = [
    'localhost:8000',
    'zphschool.eskoolia.com',
    'zphschool',
    'default.eskoolia.com',
]

print(f"\nDomain lookup test:")
for host in test_hosts:
    domain = Domain.objects.filter(domain=host).first()
    if not domain:
        domain = Domain.objects.filter(domain__startswith=host.split(':')[0]).first()
    
    result = f"{domain.domain} → tenant_id {domain.tenant_id}" if domain else "NOT FOUND"
    print(f"  {host:<30} → {result}")

print("\n" + "="*80)
print("END DIAGNOSTIC 4")
print("="*80)
