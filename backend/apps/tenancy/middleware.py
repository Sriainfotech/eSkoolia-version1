"""Tenant-aware middleware for request-level schema switching.

This middleware:
1. Resolves the active tenant from the request
2. Sets PostgreSQL search_path for schema isolation
3. Attaches tenant context to the request
4. Validates tenant existence and status

When MULTI_TENANCY_ENABLED=False, acts as a no-op pass-through.
"""
import logging
from typing import Optional

from django.conf import settings
from django.db import connection
from django.http import Http404, HttpRequest, HttpResponse
from django.utils.deprecation import MiddlewareMixin

from .context import clear_tenant_context, is_multi_tenancy_enabled, set_current_tenant
from .models import SchoolTenant
from .resolvers import get_tenant_from_request, resolve_tenant_schema

logger = logging.getLogger(__name__)


class TenantMainMiddleware(MiddlewareMixin):
    """Middleware to handle tenant resolution and schema switching.
    
    Order in MIDDLEWARE:
    - Must be FIRST (before SessionMiddleware, AuthenticationMiddleware)
    - Before all tenant-aware authentication/routing
    
    When MULTI_TENANCY_ENABLED=False:
    - Acts as no-op pass-through
    - No schema switching occurs
    - Existing monolithic behavior preserved
    """

    def process_request(self, request: HttpRequest) -> Optional[HttpResponse]:
        """Resolve tenant and set up schema context for this request.
        
        Args:
            request: Django HTTP request
            
        Returns:
            HttpResponse if error (e.g., tenant not found), None otherwise
            
        Raises:
            Http404: If subdomain is known but tenant doesn't exist
        """
        # If multi-tenancy is disabled, operate in monolithic mode
        if not is_multi_tenancy_enabled():
            clear_tenant_context()
            request.tenant = None  # Explicitly mark as monolithic
            request.schema_name = None
            return None

        try:
            # Resolve tenant from request (X-Tenant header, Host, X-School-Id)
            tenant = get_tenant_from_request(request)
            schema_name = resolve_tenant_schema(request)

            if tenant is None:
                # Tenant mode enabled but no tenant resolved
                # This is expected for some requests (e.g., to public APIs)
                # Return None to allow request to proceed in public schema
                logger.debug(
                    "No tenant resolved from request; operating in public schema"
                )
                clear_tenant_context()
                request.tenant = None
                request.schema_name = None
                return None

            # Validate tenant
            if tenant.status not in ("active", "trial"):
                logger.warning(
                    f"Request to inactive tenant: {getattr(tenant, 'tenant_id', None)} ({tenant.name})"
                )
                raise Http404(f"Tenant {tenant.name} is not active")

            # Validate schema exists (safety check)
            if not self._verify_schema_exists(schema_name):
                logger.error(
                    f"Tenant {tenant.tenant_id} references missing schema: {schema_name}"
                )
                raise Http404(f"Tenant schema not found: {schema_name}")

            # Set PostgreSQL search_path to activate schema
            self._set_schema_context(schema_name)

            # Attach tenant to request context
            set_current_tenant(
                tenant=tenant,
                schema_name=schema_name,
                subdomain=self._extract_subdomain(request),
            )

            # Attach to request object for backward compatibility
            request.tenant = tenant
            request.schema_name = schema_name
            request.subdomain = self._extract_subdomain(request)

            logger.debug(
                f"Tenant resolved: {tenant.tenant_id} → {schema_name} "
                f"(subdomain: {request.subdomain})"
            )

            return None

        except Http404:
            # Re-raise 404s (tenant not found, schema not found)
            raise

        except Exception as exc:
            # Log unexpected errors
            logger.exception(f"Tenant resolution failed: {exc}")
            # Return 500 for unexpected errors
            from django.http import JsonResponse

            return JsonResponse(
                {"error": "Tenant resolution failed", "detail": str(exc)}, status=500
            )

    def process_response(self, request: HttpRequest, response: HttpResponse) -> HttpResponse:
        """Clean up tenant context after response.
        
        Args:
            request: Django HTTP request
            response: Django HTTP response
            
        Returns:
            Response unchanged
        """
        # Clear tenant context to prevent leakage to next request
        clear_tenant_context()
        return response

    def process_exception(self, request: HttpRequest, exception: Exception) -> Optional[HttpResponse]:
        """Clear tenant context on exception.
        
        Args:
            request: Django HTTP request
            exception: Exception that occurred
            
        Returns:
            None (let exception propagate)
        """
        clear_tenant_context()
        return None

    @staticmethod
    def _verify_schema_exists(schema_name: str) -> bool:
        """Verify that a PostgreSQL schema exists.
        
        Args:
            schema_name: Schema name to check
            
        Returns:
            True if schema exists, False otherwise
        """
        try:
            with connection.cursor() as cursor:
                cursor.execute(
                    "SELECT 1 FROM information_schema.schemata WHERE schema_name = %s",
                    [schema_name],
                )
                return bool(cursor.fetchone())
        except Exception as exc:
            logger.error(f"Schema existence check failed for {schema_name}: {exc}")
            return False

    @staticmethod
    def _set_schema_context(schema_name: str) -> None:
        """Set PostgreSQL search_path to activate schema context.
        
        Args:
            schema_name: Schema name to activate
        """
        try:
            with connection.cursor() as cursor:
                # Set search_path: schema first, then public for system tables
                cursor.execute(f"SET search_path = {schema_name}, public")
                logger.debug(f"Schema context set: {schema_name}")
        except Exception as exc:
            logger.error(f"Failed to set schema context for {schema_name}: {exc}")
            raise

    @staticmethod
    def _extract_subdomain(request: HttpRequest) -> Optional[str]:
        """Extract subdomain from request host.
        
        Args:
            request: Django HTTP request
            
        Returns:
            Subdomain (e.g., "greenwood") or None
        """
        host = request.get_host().split(":")[0]  # Remove port

        # Local/staging format: greenwood.eskoolia.local
        if ".eskoolia.local" in host:
            return host.split(".eskoolia.local")[0]

        # Production format: greenwood.eskoolia.app
        if ".eskoolia.app" in host:
            return host.split(".eskoolia.app")[0]

        # No subdomain found
        return None


class TenantContextMiddleware(TenantMainMiddleware):
    """Backward-compatible alias for older middleware path references."""
