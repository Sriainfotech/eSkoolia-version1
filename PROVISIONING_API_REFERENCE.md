# Tenant Provisioning API Reference

## Quick Start

### Enable Provisioning (Staging Only)

```bash
# In .env (staging/dev only)
MULTI_TENANCY_ENABLED=true
```

### Provision a Tenant (cURL)

```bash
curl -X POST http://localhost:8000/api/v1/tenancy/super-admin/schools/provision/ \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Greenwood School",
    "subdomain_url": "greenwood",
    "plan": "trial"
  }'
```

### Provision a Tenant (Python/requests)

```python
import requests

headers = {
    "Authorization": f"Bearer {jwt_token}",
    "Content-Type": "application/json"
}

payload = {
    "name": "Greenwood School",
    "subdomain_url": "greenwood",
    "plan": "trial"
}

response = requests.post(
    "http://localhost:8000/api/v1/tenancy/super-admin/schools/provision/",
    json=payload,
    headers=headers
)

if response.status_code == 201:
    tenant = response.json()
    print(f"Provisioned tenant: {tenant['tenant_id']}")
    print(f"Schema: {tenant['schema_name']}")
    print(f"Subdomain: {tenant['subdomain']}")
else:
    print(f"Error: {response.status_code}")
    print(response.json())
```

---

## Endpoint Details

### POST `/api/v1/tenancy/super-admin/schools/provision/`

Provisions a new tenant with schema creation, migrations, and default data seeding.

#### Authentication
- **Required**: Yes (JWT)
- **Role**: Super-admin only (`request.user.is_superuser` must be True)
- **Header**: `Authorization: Bearer {token}`

#### Request Body

| Field | Type | Length | Required | Notes |
|-------|------|--------|----------|-------|
| `name` | string | 2-256 chars | Yes | School name (no special chars) |
| `subdomain_url` | string | 2-64 chars | Yes | URL slug (lowercase, alphanumeric + underscore) |
| `plan` | string | - | Yes | One of: `trial`, `basic`, `professional`, `enterprise` |

#### Request Example

```json
{
  "name": "Greenwood School",
  "subdomain_url": "greenwood",
  "plan": "trial"
}
```

#### Response (201 Created)

```json
{
  "tenant_id": "TNT_AB12CD34EF56GH78",
  "name": "Greenwood School",
  "subdomain_url": "greenwood",
  "subdomain": "greenwood.eskoolia.local",
  "schema_name": "school_greenwood",
  "plan": "trial",
  "status": "active",
  "provisioned_at": "2026-05-13T14:30:45.123456Z"
}
```

#### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `tenant_id` | string | Unique tenant identifier |
| `name` | string | School name |
| `subdomain_url` | string | URL slug provided |
| `subdomain` | string | Full staging domain (greenwood.eskoolia.local) |
| `schema_name` | string | PostgreSQL schema name (school_greenwood) |
| `plan` | string | Pricing plan |
| `status` | string | Tenant status (active/inactive) |
| `provisioned_at` | datetime | ISO 8601 timestamp |

#### Error Responses

##### 400 Bad Request
```json
{
  "name": ["Ensure this field has at most 256 characters."],
  "subdomain_url": ["Invalid format; use lowercase alphanumeric + underscore only."]
}
```

##### 403 Forbidden (Not Super-Admin)
```json
{
  "detail": "Only super-administrators can provision tenants."
}
```

##### 409 Conflict (Subdomain Exists)
```json
{
  "error": "Subdomain 'greenwood' is already in use."
}
```

##### 500 Internal Server Error (Provisioning Failed)
```json
{
  "error": "Tenant provisioning failed at schema creation step.",
  "detail": "Check audit logs for details."
}
```

---

## Management Commands

### Status Report
```bash
python manage.py provision_tenant_test
```

Output:
- MULTI_TENANCY_ENABLED status
- List of active tenants with schema names
- Recent audit log entries

### Create Test Tenants (3)
```bash
python manage.py provision_tenant_test --create
```

Creates:
- Greenwood School (greenwood) - trial plan
- Alpha Academy (alpha) - basic plan
- Beta University (beta) - professional plan

Verifies schema creation and counts tables.

### Verify Tenant Isolation
```bash
python manage.py provision_tenant_test --verify
```

Checks:
- Schema exists in PostgreSQL
- Tables created in schema
- No data leakage between tenants

### Cleanup Test Tenants (DANGEROUS!)
```bash
python manage.py provision_tenant_test --cleanup
```

⚠️ **WARNING**: This command:
- Drops tenant schemas from PostgreSQL
- Deletes Domain records
- Deletes SchoolTenant records
- **Cannot be undone** (use in staging only)

---

## Subdomain Resolution

Tenants are automatically resolved from incoming requests using:

### Priority Order

1. **X-Tenant Header** (highest priority)
   ```bash
   curl -H "X-Tenant: greenwood" http://api.eskoolia.local/api/users/
   ```

2. **Host Subdomain** (standard usage)
   ```bash
   curl http://greenwood.eskoolia.local/api/users/
   ```

3. **X-School-Id Header** (legacy fallback)
   ```bash
   curl -H "X-School-Id: school_greenwood" http://api.eskoolia.local/api/users/
   ```

### Example: Using Subdomain

```bash
# Requests to greenwood.eskoolia.local route to greenwood's schema
curl -H "Authorization: Bearer {token}" http://greenwood.eskoolia.local/api/users/

# Returns users from school_greenwood schema only
```

---

## Audit Logging

Every provisioning action is logged immutably in the `tenancy_audit_log` table (public schema).

### Audit Actions

| Action | Status | When |
|--------|--------|------|
| `provision_start` | pending | Provisioning begins |
| `schema_created` | success/failed | PostgreSQL schema created |
| `migrations_ran` | success/failed | Tenant migrations executed |
| `seeding_completed` | success/failed | Default data seeded |
| `provision_complete` | success | Entire process succeeded |
| `provision_failed` | failed | Any step failed (rollback triggered) |

### Query Audit Log

```python
from apps.tenancy.models import TenantAuditLog

# Recent provisioning events
logs = TenantAuditLog.objects.filter(
    action__startswith="provision"
).order_by("-created_at")[:10]

for log in logs:
    print(f"{log.created_at} | {log.action} | {log.status}")
    if log.error_message:
        print(f"  Error: {log.error_message}")
```

---

## Troubleshooting

### Provisioning Blocked
**Error**: "Tenant provisioning is not enabled. Set MULTI_TENANCY_ENABLED=true in .env"

**Solution**: 
```bash
# Set in .env or environment
export MULTI_TENANCY_ENABLED=true
```

### Subdomain Already Exists
**Error**: "Subdomain 'greenwood' is already in use."

**Solution**: 
- Use a different subdomain_url
- Or cleanup existing tenant first:
  ```bash
  python manage.py provision_tenant_test --cleanup
  ```

### Schema Not Created
**Error**: Provisioning fails at schema creation step

**Solutions**:
1. Check PostgreSQL connection: `psql -l`
2. Verify database user has CREATE SCHEMA permission
3. Check audit log for error details:
   ```python
   from apps.tenancy.models import TenantAuditLog
   TenantAuditLog.objects.filter(action="schema_created").last()
   ```

### Tenant Not Resolving
**Issue**: Requests to greenwood.eskoolia.local still route to monolithic schema

**Solutions**:
1. Verify MULTI_TENANCY_ENABLED=true
2. Verify TenantMainMiddleware in MIDDLEWARE
3. Verify Domain record exists:
   ```python
   from apps.tenancy.models import Domain
   Domain.objects.filter(domain="greenwood.eskoolia.local")
   ```
4. Verify DNS/hosts file (localhost development):
   ```
   127.0.0.1  greenwood.eskoolia.local
   ```

### JWT Token Invalid for Super-Admin
**Error**: 403 Forbidden "Only super-administrators can provision tenants."

**Solution**:
```python
# Ensure user is superuser
from django.contrib.auth.models import User
user = User.objects.get(username="admin")
user.is_superuser = True
user.save()

# Generate new JWT token for this user
```

---

## Security Notes

✅ **Enforced**:
- Super-admin authentication required
- Input validation (name, subdomain, plan)
- Subdomain sanitization (no SQL injection risk)
- Immutable audit trail
- Automatic rollback on failure
- Feature flag protection (staging only by default)

🛡️ **Best Practices**:
- Only activate MULTI_TENANCY_ENABLED in staging/dev
- Use HTTPS in production (HTTP_X_FORWARDED_FOR header trust)
- Monitor audit logs for provisioning failures
- Restrict super-admin access strictly
- Backup database before large provisioning batches

---

## Development Tips

### Test with cURL
```bash
# Get JWT token
TOKEN=$(curl -X POST http://localhost:8000/api/auth/token/ \
  -d "username=admin&password=admin" | jq -r '.access')

# Provision tenant
curl -X POST http://localhost:8000/api/v1/tenancy/super-admin/schools/provision/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test School",
    "subdomain_url": "test",
    "plan": "trial"
  }'
```

### Debug Provisioning
```python
# In Django shell
python manage.py shell

from apps.tenancy.provisioning import provision_tenant
from django.contrib.auth.models import User

admin = User.objects.filter(is_superuser=True).first()

try:
    tenant = provision_tenant(
        name="Debug School",
        subdomain_url="debug",
        plan="trial",
        actor_user=admin,
        actor_ip="127.0.0.1"
    )
    print(f"Success: {tenant.schema_name}")
except Exception as e:
    print(f"Error: {e}")
```

### Check Audit Trail
```python
from apps.tenancy.models import TenantAuditLog

# Last 20 provisioning events
logs = TenantAuditLog.objects.filter(
    action__startswith="provision"
).order_by("-created_at")[:20]

for log in logs:
    print(f"{log.created_at} | {log.tenant_id:16} | {log.action:20} | {log.status}")
```

---

## API Rate Limiting

Provisioning API is **not rate-limited by default** (open to super-admins).

To add rate limiting in production, use DRF throttling:

```python
# settings/production.py
REST_FRAMEWORK = {
    'DEFAULT_THROTTLE_CLASSES': [
        'rest_framework.throttling.AnonRateThrottle',
        'rest_framework.throttling.UserRateThrottle'
    ],
    'DEFAULT_THROTTLE_RATES': {
        'anon': '100/hour',
        'user': '1000/hour',
    }
}
```

---

## Related Documentation

- **PHASE_8_COMPLETION_SUMMARY.md** - Implementation overview
- **STAGING_ACTIVATION_GUIDE.md** - How to enable in staging
- **AUDIT_LOG_SPECIFICATION.md** - Audit logging details
- **DJANGO_PROJECT_STRUCTURE_REFERENCE.md** - Project structure

---

*Last Updated: 2026-05-13*  
*Phase 8 - Staging-Only Tenant Provisioning*
