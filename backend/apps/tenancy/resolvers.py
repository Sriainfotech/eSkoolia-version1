"""Tenant resolution logic for subdomain-based routing.

This resolver supports:
- Local staging: greenwood.eskoolia.local
- Production: greenwood.eskoolia.app (future)
- API access: X-Tenant header (future)
"""
import logging
from django.http import Http404
from apps.tenancy.models import Domain, SchoolTenant

logger = logging.getLogger(__name__)


def get_tenant_from_request(request):
    """Resolve tenant from request (subdomain or headers).
    
    Priority:
    1. X-Tenant header (for API access)
    2. Host subdomain (for web access)
    3. X-School-Id header (legacy, for backward compatibility)
    """
    
    # Priority 1: X-Tenant header (explicit tenant ID)
    tenant_id = request.META.get("HTTP_X_TENANT")
    if tenant_id:
        try:
            return SchoolTenant.objects.get(tenant_id=tenant_id)
        except SchoolTenant.DoesNotExist:
            logger.warning(f"Tenant not found: {tenant_id}")
            raise Http404(f"Tenant {tenant_id} not found")
    
    # Priority 2: Extract subdomain from Host header
    host = request.META.get("HTTP_HOST", "").lower()
    if ":" in host:
        host = host.split(":")[0]  # Remove port
    
    # Skip root domain (localhost, 127.0.0.1, etc.)
    if host in ["localhost", "127.0.0.1", "0.0.0.0"]:
        return None
    
    # Check for local staging format: {subdomain}.eskoolia.local
    if ".eskoolia.local" in host:
        subdomain = host.replace(".eskoolia.local", "")
        try:
            domain = Domain.objects.select_related("tenant").get(domain=subdomain)
            return domain.tenant
        except Domain.DoesNotExist:
            logger.warning(f"Domain not found: {subdomain}")
            raise Http404(f"Tenant {subdomain} not found")
    
    # Check for production format: {subdomain}.eskoolia.app
    if ".eskoolia.app" in host:
        subdomain = host.replace(".eskoolia.app", "")
        try:
            domain = Domain.objects.select_related("tenant").get(domain=subdomain)
            return domain.tenant
        except Domain.DoesNotExist:
            logger.warning(f"Domain not found: {subdomain}")
            raise Http404(f"Tenant {subdomain} not found")

    # Production domain: {subdomain}.eskoolia.com (e.g. springdale.eskoolia.com)
    if ".eskoolia.com" in host:
        subdomain = host.replace(".eskoolia.com", "")
        # Block reserved/root subdomains — these are not tenant schools
        if subdomain in ("www", "admin", "api", "mail", "app", ""):
            return None
        try:
            domain = Domain.objects.select_related("tenant").get(domain=subdomain)
            return domain.tenant
        except Domain.DoesNotExist:
            logger.warning(f"Tenant not found for subdomain: {subdomain}")
            raise Http404(f"School '{subdomain}' not found")

    # Priority 3: Fallback to legacy X-School-Id for backward compatibility
    school_id = request.META.get("HTTP_X_SCHOOL_ID")
    if school_id:
        # This is the old monolithic resolution; keep it for backward compatibility
        logger.debug(f"Using legacy X-School-Id: {school_id}")
        return None  # Monolithic mode
    
    # No tenant found
    return None


def resolve_tenant_schema(request):
    """Get the schema name for the current request.
    
    Returns:
    - Schema name (e.g., 'school_greenwood')
    - None if monolithic mode (no tenant)
    """
    try:
        tenant = get_tenant_from_request(request)
        if tenant:
            return tenant.schema_name
    except Http404:
        raise
    except Exception as exc:
        logger.error(f"Failed to resolve tenant schema: {exc}")
    
    return None
