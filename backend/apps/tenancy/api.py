"""API endpoints for tenant provisioning (super-admin only)."""
import logging
from rest_framework import serializers, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from django.conf import settings
from django.views.decorators.http import require_http_methods

from apps.tenancy.models import SchoolTenant, Domain
from apps.tenancy.provisioning import provision_tenant, is_provisioning_enabled
from apps.tenancy.permissions import IsSuperAdmin

logger = logging.getLogger(__name__)


class ProvisionTenantSerializer(serializers.Serializer):
    """Validates request payload for tenant provisioning."""
    
    name = serializers.CharField(
        max_length=256,
        min_length=2,
        help_text="School name (e.g., 'Greenwood School')",
    )
    subdomain_url = serializers.CharField(
        max_length=64,
        min_length=2,
        help_text="Subdomain for tenant (e.g., 'greenwood')",
    )
    plan = serializers.ChoiceField(
        choices=["trial", "basic", "professional", "enterprise"],
        default="trial",
        help_text="Subscription plan",
    )


class TenantDetailSerializer(serializers.ModelSerializer):
    """Serializes SchoolTenant details in response."""
    
    subdomain = serializers.SerializerMethodField()
    
    class Meta:
        model = SchoolTenant
        fields = [
            "tenant_id",
            "name",
            "subdomain_url",
            "subdomain",
            "schema_name",
            "plan",
            "status",
            "provisioned_at",
        ]
    
    def get_subdomain(self, obj):
        """Full subdomain including domain suffix."""
        # Local staging domain
        if settings.DEBUG:
            return f"{obj.subdomain_url}.eskoolia.local"
        # Production domain (would be configured)
        return f"{obj.subdomain_url}.eskoolia.app"


@api_view(["POST"])
@permission_classes([IsSuperAdmin])
@require_http_methods(["POST"])
def provision_tenant_view(request):
    """Super-admin API to provision a new tenant.
    
    POST /api/super-admin/schools/provision/
    
    Body:
    {
        "name": "Greenwood School",
        "subdomain_url": "greenwood",
        "plan": "trial"
    }
    
    Returns:
    {
        "tenant_id": "TNT_XXXXXXX",
        "name": "Greenwood School",
        "subdomain_url": "greenwood",
        "subdomain": "greenwood.eskoolia.local",
        "schema_name": "school_greenwood",
        "plan": "trial",
        "status": "active",
        "provisioned_at": "2026-05-13T12:34:56Z"
    }
    """
    
    # Check if provisioning is enabled
    if not is_provisioning_enabled():
        return Response(
            {
                "error": "Tenant provisioning is not enabled",
                "message": "Set MULTI_TENANCY_ENABLED=true to enable provisioning",
            },
            status=status.HTTP_403_FORBIDDEN,
        )
    
    # Validate request
    serializer = ProvisionTenantSerializer(data=request.data)
    if not serializer.is_valid():
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)
    
    try:
        # Extract actor info
        actor_user = request.user
        actor_ip = get_client_ip(request)
        
        # Provision tenant
        tenant = provision_tenant(
            name=serializer.validated_data["name"],
            subdomain_url=serializer.validated_data["subdomain_url"],
            plan=serializer.validated_data.get("plan", "trial"),
            actor_user=actor_user,
            actor_ip=actor_ip,
        )
        
        # Return created tenant details
        response_serializer = TenantDetailSerializer(tenant)
        return Response(response_serializer.data, status=status.HTTP_201_CREATED)
    
    except ValueError as exc:
        # Validation errors
        logger.warning(f"Provisioning validation error: {exc}")
        return Response(
            {"error": str(exc)},
            status=status.HTTP_400_BAD_REQUEST,
        )
    except Exception as exc:
        # Unexpected errors
        logger.error(f"Provisioning failed: {exc}", exc_info=True)
        return Response(
            {"error": "Provisioning failed", "message": str(exc)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR,
        )


def get_client_ip(request):
    """Extract client IP from request."""
    x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
    if x_forwarded_for:
        ip = x_forwarded_for.split(",")[0].strip()
    else:
        ip = request.META.get("REMOTE_ADDR")
    return ip
