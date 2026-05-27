import django, os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings.base')
django.setup()
from django.db import connection
with connection.cursor() as cur:
    cur.execute("SELECT schema_name FROM information_schema.schemata ORDER BY schema_name")
    schemas = [r[0] for r in cur.fetchall()]
    print('All schemas:', schemas)
    print('school_mpp exists:', 'school_mpp' in schemas)

from apps.tenancy.models import SchoolTenant
t = SchoolTenant.objects.get(tenant_id='TNT_4A7D027C')
print('mpp status:', t.status)
