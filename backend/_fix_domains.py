"""
Find all active schools missing Domain records and create them.
Run with: py -3.10 _fix_domains.py
"""
import os, django
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.base")
django.setup()

from apps.tenancy.models import School, SchoolTenant, Domain

all_schools = School.objects.filter(is_active=True)
registered = set(Domain.objects.values_list('domain', flat=True))

print("=== Schools missing domain records ===")
missing = []
for s in all_schools:
    sub = s.subdomain
    if not sub:
        continue
    if sub not in registered:
        tenant = SchoolTenant.objects.filter(subdomain_url=sub).first()
        print(f"  school_id={s.id} code={s.code} subdomain={sub} tenant={'NO TENANT' if not tenant else tenant.tenant_id}")
        if tenant:
            missing.append((sub, tenant))

if not missing:
    print("  (none — all schools have domain records)")
else:
    print(f"\nCreating domain records for {len(missing)} schools...")
    for sub, tenant in missing:
        d1, c1 = Domain.objects.get_or_create(domain=sub, defaults={'tenant': tenant, 'is_primary': False})
        d2, c2 = Domain.objects.get_or_create(domain=f"{sub}.eskoolia.com", defaults={'tenant': tenant, 'is_primary': True})
        d3, c3 = Domain.objects.get_or_create(domain=f"{sub}.eskoolia.local", defaults={'tenant': tenant, 'is_primary': False})
        print(f"  {sub}: bare={'created' if c1 else 'exists'}, .com={'created' if c2 else 'exists'}, .local={'created' if c3 else 'exists'}")

print("\nDone.")
