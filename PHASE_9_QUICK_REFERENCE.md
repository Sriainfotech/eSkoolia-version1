# Phase 9 Quick Reference: Tenant-Aware Authentication & Schema Switching

## Activation (Staging Only)

```bash
# In .env (staging/dev only)
MULTI_TENANCY_ENABLED=true
```

After activation, middleware and auth classes are automatically configured.

---

## Context Helpers

Use these in your views, services, signals, and tasks:

```python
from apps.tenancy.context import (
    get_current_tenant,
    get_current_schema,
    get_current_subdomain,
    get_current_tenant_id,
    is_tenant_mode,
    is_monolithic_mode,
)

# In a view or service
def my_view(request):
    tenant = get_current_tenant()  # SchoolTenant or None
    schema_name = get_current_schema()  # "school_greenwood" or None
    subdomain = get_current_subdomain()  # "greenwood" or None
    tenant_id = get_current_tenant_id()  # "TNT_XXXXXXX" or None
    
    if is_tenant_mode():
        print(f"Tenant: {tenant.name}")
    else:
        print("Monolithic mode")
```

---

## Middleware Order (When Enabled)

When `MULTI_TENANCY_ENABLED=true`, middleware is automatically reordered:

```
1. TenantMainMiddleware          ← Schema switching
2. SecurityMiddleware
3. SessionMiddleware
4. CorsMiddleware
5. CommonMiddleware
6. CsrfViewMiddleware
7. AuthenticationMiddleware      ← Runs in tenant schema
8. TenantAwareAuthMiddleware     ← Attaches tenant to request
9. MessageMiddleware
10. ClickjackingMiddleware
```

---

## JWT Authentication (Tenant-Aware)

When enabled, DRF automatically uses TenantAwareJWTAuthentication:

```python
# This happens automatically when MULTI_TENANCY_ENABLED=true
REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "apps.tenancy.auth.TenantAwareJWTAuthentication",  # Phase 9
    ),
}
```

### JWT Auth Flow

```
1. Request arrives with JWT token
   Authorization: Bearer <token>
   
2. TenantMainMiddleware resolves tenant from subdomain
   greenwood.eskoolia.local → school_greenwood schema
   
3. TenantAwareJWTAuthentication validates JWT
   - Validates token signature
   - Decodes claims
   
4. User Lookup in Active Schema
   - Super-admin (is_superuser=True) → Public schema lookup
   - Regular user → Tenant schema lookup
   - User must exist in active schema
   
5. RBAC Applied
   - User permissions loaded from active schema
   - Groups/roles from active schema
   
6. Request proceeds with tenant context
   request.tenant = SchoolTenant()
   request.schema_name = "school_greenwood"
```

---

## Tenant Routing Validation

The system automatically:

✅ Rejects unknown subdomains (404 Not Found)  
✅ Validates tenant exists and is active  
✅ Verifies schema exists in PostgreSQL  
✅ Validates middleware ordering  
✅ Checks database routers configured  
✅ Logs all auth events to audit trail  

No silent fallbacks - unknown tenants return 404.

---

## Request Object Attributes (When Enabled)

After middleware processing:

```python
def my_view(request):
    request.tenant              # SchoolTenant instance
    request.schema_name         # "school_greenwood"
    request.subdomain           # "greenwood"
```

---

## Audit Logging Functions

Log auth and security events:

```python
from apps.tenancy.audit_auth import (
    log_auth_attempt,
    log_jwt_validation,
    log_rbac_check,
    log_schema_switch,
    log_unauthorized_access_attempt,
    get_auth_audit_log,
)

# Log auth attempt
log_auth_attempt(
    username="principal@greenwood.local",
    auth_method="jwt",
    success=True,
    request_ip=request.META.get("REMOTE_ADDR"),
)

# Log JWT validation
log_jwt_validation(
    token_valid=True,
    request_ip=request.META.get("REMOTE_ADDR"),
)

# Log RBAC check
log_rbac_check(
    action="view",
    resource="Student",
    user_id=request.user.id,
    allowed=True,
    reason="Teacher role has view permission",
    request_ip=request.META.get("REMOTE_ADDR"),
)

# Query auth logs
recent_logs = get_auth_audit_log(
    tenant_id=get_current_tenant_id(),
    limit=10,
)
```

---

## Testing Commands

### Status Report
```bash
python manage.py test_tenant_auth
```

Shows:
- Multi-tenancy enabled/disabled
- Active tenants list
- Recent auth events

### Test Schema Switching
```bash
python manage.py test_tenant_auth --test-schema-switching
```

Verifies:
- Schema exists in PostgreSQL
- search_path can be set
- Current schema is correct

### Test Authentication
```bash
python manage.py test_tenant_auth --test-auth
```

Verifies:
- Auth works in tenant schema
- User counts per schema
- Auth context isolation

### Test RBAC Isolation
```bash
python manage.py test_tenant_auth --test-rbac
```

Verifies:
- Different users per schema
- RBAC permissions isolated
- Cross-tenant access prevented

### Test Query Isolation
```bash
python manage.py test_tenant_auth --test-query-isolation
```

Verifies:
- Tables accessible in schema
- Queries return correct subset
- No cross-tenant data leakage

### Run All Tests
```bash
python manage.py test_tenant_auth --all
```

---

## Query Isolation (Automatic)

When in tenant mode, ORM queries automatically query the active schema:

```python
# Before Phase 9 (Monolithic)
Student.objects.filter(school_id=1)  # Manual filtering

# After Phase 9 (Tenant-Aware)
Student.objects.all()  # Automatically queries school_greenwood schema only
# Schema-level isolation, no manual filter needed
```

But keep school_id filters for now (secondary safety layer):

```python
# Recommended for Phase 9
Student.objects.filter(school_id=school_id)  # Keep for safety
# Removed in later phases when fully migrated
```

---

## Super-Admin vs Tenant User

### Super-Admin Login
```bash
# Authenticate in public schema
POST https://api.eskoolia.local/api/token/
{
    "username": "admin",
    "password": "..."
}

# Response includes JWT token
{
    "access": "eyJ...",
    "refresh": "eyJ...",
}
```

### Tenant User Login
```bash
# Authenticate in tenant schema
POST https://greenwood.eskoolia.local/api/token/
{
    "username": "principal@greenwood",
    "password": "..."
}

# Response includes tenant-aware JWT
{
    "access": "eyJ...",  # Token includes tenant context
    "refresh": "eyJ...",
}
```

### Key Differences
| Aspect | Super-Admin | Tenant User |
|--------|------------|-------------|
| Auth Schema | public | tenant (school_greenwood) |
| Endpoint | api.eskoolia.local | greenwood.eskoolia.local |
| URL | /api/token/ | /api/token/ |
| Subdomain | None | Required |
| Access | All tenants (provisioning) | Own tenant only |
| RBAC | Platform admin roles | Tenant-specific roles |

---

## Backward Compatibility

When `MULTI_TENANCY_ENABLED=false` (default):

✅ All existing APIs work unchanged  
✅ Monolithic database access preserved  
✅ school_id filtering still works  
✅ JWT authentication unchanged  
✅ RBAC unchanged  
✅ No schema switching  
✅ No tenant routing  
✅ Frontend compatible  

No changes required to existing code for production.

---

## Error Handling

### Unknown Subdomain
```
Request:  GET https://unknown.eskoolia.local/api/users/
Response: 404 Not Found
Body:     {"detail": "Not found."}
```

No silent fallback to public schema.

### Inactive Tenant
```
Request:  GET https://greenwood.eskoolia.local/api/users/
         (greenwood is_active=False)
Response: 404 Not Found
Body:     {"detail": "Tenant ... is not active"}
```

### Non-Superuser JWT Without Tenant
```
Request:  GET https://api.eskoolia.local/api/users/
         Authorization: Bearer <teacher-token>
Response: 401 Unauthorized
Body:     {"detail": "User authentication requires tenant context..."}
```

### User Not in Schema
```
Request:  greenwood.eskoolia.local with alpha-user JWT
Response: 401 Unauthorized
Body:     {"detail": "User not found in tenant..."}
```

---

## Configuration Checklist

When activating Phase 9 in staging:

- [ ] Set `MULTI_TENANCY_ENABLED=true` in .env
- [ ] Run `python manage.py check` (verify no critical errors)
- [ ] Run `python manage.py migrate` (apply any pending migrations)
- [ ] Restart Django app
- [ ] Provision test tenants
- [ ] Run `python manage.py test_tenant_auth --all`
- [ ] Test tenant-specific login
- [ ] Monitor auth audit logs
- [ ] Verify cross-tenant access blocked
- [ ] Test rollback (set flag to false, restart, verify working)

---

## Security Notes

🛡️ **Enforced**:
- Super-admin separation (public schema only)
- JWT validation in tenant schema
- User lookup in active schema
- Schema-level isolation (SET search_path)
- Unknown subdomain rejection (404)
- Context cleanup on error
- Immutable audit logging
- Feature flag protection

---

## Troubleshooting

### "TenantMainMiddleware is missing from MIDDLEWARE"
**Cause**: MULTI_TENANCY_ENABLED=true but middleware not inserted
**Solution**: Settings auto-insert middleware; verify settings loaded: restart Django

### "Database ROUTERS is empty"
**Cause**: Django-tenants expects routers (not needed for this implementation)
**Solution**: Expected warning; can be ignored for Phase 9

### "Schema does not exist"
**Cause**: Tenant's schema_name doesn't match actual PostgreSQL schema
**Solution**: Verify schema exists: `psql -l | grep school_`

### User not found in schema
**Cause**: User created in wrong schema or wrong tenant
**Solution**: Verify user exists in tenant: `python manage.py shell`

### Queries returning wrong data
**Cause**: search_path not set correctly or multiple tenants same data
**Solution**: Verify schema isolation: check audit logs for auth events

---

## Next Steps

After Phase 9 validation:

1. **Phase 10**: Tenant-aware API permissions
2. **Phase 11**: Per-tenant feature flags
3. **Phase 12**: Tenant data export/deletion
4. **Phase 13**: Production rollout & monitoring

---

*Generated: 2026-05-13*  
*Phase 9: Tenant-Aware Authentication & Request-Level Schema Switching*
