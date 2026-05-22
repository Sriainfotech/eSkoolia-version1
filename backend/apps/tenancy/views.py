from rest_framework import permissions, viewsets
from rest_framework.decorators import api_view, permission_classes
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from .models import School
from .serializers import SchoolSerializer


class SchoolViewSet(viewsets.ModelViewSet):
    serializer_class = SchoolSerializer
    permission_classes = [permissions.IsAuthenticated]

    def _require_admin(self):
        user = self.request.user
        if not (user.is_superuser or getattr(user, "is_school_admin", False)):
            raise PermissionDenied("You do not have permission to manage schools.")

    def get_queryset(self):
        self._require_admin()
        user = self.request.user
        queryset = School.objects.all().order_by("name")
        if user.is_superuser:
            return queryset
        if user.school_id:
            return queryset.filter(id=user.school_id)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        if not user.is_superuser:
            raise PermissionDenied("Only superusers can add schools.")
        serializer.save()

    def perform_destroy(self, instance):
        user = self.request.user
        if not user.is_superuser:
            raise PermissionDenied("Only superusers can delete schools.")
        super().perform_destroy(instance)


@api_view(["GET"])
@permission_classes([AllowAny])
def school_info_view(request):
    """Public endpoint — returns school branding info for the login page.

    Called by the frontend BEFORE the user logs in so the login page can
    display the correct school name, logo, and brand colour.

    Query params:
        subdomain (required) — e.g. ?subdomain=springdale
    """
    subdomain = request.query_params.get("subdomain", "").strip().lower()
    if not subdomain:
        return Response({"error": "subdomain query parameter is required"}, status=400)

    try:
        from apps.tenancy.models import Domain
        # First try exact match (subdomain stored as-is)
        domain = Domain.objects.select_related("tenant").filter(domain=subdomain).first()
        # Fall back to prefix match for full FQDNs like "testschool.eskoolia.local"
        if domain is None:
            domain = Domain.objects.select_related("tenant").filter(
                domain__startswith=f"{subdomain}."
            ).first()
        if domain is None:
            return Response({"error": "School not found"}, status=404)
        tenant = domain.tenant
        return Response({
            "name": tenant.name,
            "subdomain": tenant.subdomain_url,
            "logo_url": tenant.logo_url or None,
            "brand_color": tenant.brand_color or "#0d9488",
            "status": tenant.status,
        })
    except Exception:
        return Response({"error": "School not found"}, status=404)
