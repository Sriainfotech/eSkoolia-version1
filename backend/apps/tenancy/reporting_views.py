"""Cross-tenant reporting APIs for super-admins.

These endpoints provide platform-level metrics and analytics.
IMPORTANT: Only accessible to super-admins in public schema.

Endpoints:
- GET /api/admin/tenants/ - List all tenants with metrics
- GET /api/admin/tenants/{id}/ - Get tenant details
- GET /api/admin/tenants/{id}/metrics/ - Get tenant usage metrics
- GET /api/admin/reports/health/ - Platform health report
- GET /api/admin/reports/features/ - Feature usage report
- GET /api/admin/reports/plans/ - Plan distribution report
- GET /api/admin/reports/audit/ - Recent audit events
"""

from rest_framework import viewsets, status, serializers
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Count, Q
from django.utils import timezone
from datetime import timedelta

from apps.tenancy.models import (
    SchoolTenant,
    TenantPlan,
    TenantFeature,
    TenantFeatureFlag,
    TenantFeatureAudit,
)
from apps.tenancy.permissions import IsSuperAdminOnly
from apps.tenancy.audit_features import (
    get_tenant_feature_audit_log,
    get_plan_change_history,
)


# Serializers

class TenantListSerializer(serializers.ModelSerializer):
    """Simplified tenant serializer for list view."""
    
    feature_count = serializers.SerializerMethodField()
    status_label = serializers.CharField(source="get_status_display", read_only=True)
    
    class Meta:
        model = SchoolTenant
        fields = [
            "tenant_id",
            "name",
            "plan",
            "status",
            "status_label",
            "api_access",
            "provisioned_at",
            "schema_name",
            "feature_count",
        ]
    
    def get_feature_count(self, obj):
        """Count enabled features."""
        return TenantFeatureFlag.objects.filter(
            tenant=obj,
            is_enabled=True,
        ).count()


class TenantDetailSerializer(serializers.ModelSerializer):
    """Detailed tenant serializer."""
    
    features = serializers.SerializerMethodField()
    plan_details = serializers.SerializerMethodField()
    audit_log_count = serializers.SerializerMethodField()
    
    class Meta:
        model = SchoolTenant
        fields = [
            "tenant_id",
            "name",
            "short_code",
            "subdomain_url",
            "plan",
            "plan_details",
            "status",
            "api_access",
            "sso_method",
            "schema_name",
            "provisioned_at",
            "features",
            "audit_log_count",
        ]
    
    def get_features(self, obj):
        """List tenant's enabled features."""
        flags = TenantFeatureFlag.objects.filter(
            tenant=obj,
            is_enabled=True,
        ).select_related("feature")
        
        return [
            {
                "id": f.feature.feature_id,
                "name": f.feature.name,
                "category": f.feature.category,
            }
            for f in flags
        ]
    
    def get_plan_details(self, obj):
        """Get plan details."""
        try:
            plan = TenantPlan.objects.get(plan_type=obj.plan)
            return {
                "name": plan.name,
                "rate_limit_per_minute": plan.api_rate_limit_per_minute,
                "rate_limit_per_hour": plan.api_rate_limit_per_hour,
            }
        except Exception:
            return None
    
    def get_audit_log_count(self, obj):
        """Count audit logs."""
        return TenantFeatureAudit.objects.filter(
            tenant_id=obj.tenant_id
        ).count()


class TenantMetricsSerializer(serializers.Serializer):
    """Tenant metrics serializer."""
    
    tenant_id = serializers.CharField()
    tenant_name = serializers.CharField()
    plan = serializers.CharField()
    status = serializers.CharField()
    
    enabled_features = serializers.IntegerField()
    total_features = serializers.IntegerField()
    
    api_access_enabled = serializers.BooleanField()
    
    trial_days_remaining = serializers.IntegerField()
    is_trial_expired = serializers.BooleanField()
    
    provisioned_at = serializers.DateTimeField()
    age_days = serializers.IntegerField()
    
    recent_changes = serializers.IntegerField()


class ReportSerializer(serializers.Serializer):
    """Generic report serializer."""
    
    title = serializers.CharField()
    generated_at = serializers.DateTimeField()
    summary = serializers.DictField()


# ViewSets

class TenantReportingViewSet(viewsets.ReadOnlyModelViewSet):
    """Cross-tenant reporting API for super-admins.
    
    IMPORTANT: Only accessible to super-admins.
    All queries use .using("default") to ensure public schema access.
    """
    
    queryset = SchoolTenant.objects.all().using("default")
    serializer_class = TenantDetailSerializer
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]
    
    def get_serializer_class(self):
        if self.action == "list":
            return TenantListSerializer
        elif self.action == "metrics":
            return TenantMetricsSerializer
        return TenantDetailSerializer
    
    def list(self, request, *args, **kwargs):
        """List all tenants with basic info."""
        queryset = self.get_queryset()
        
        # Optional filtering
        plan = request.query_params.get("plan")
        status_filter = request.query_params.get("status")
        
        if plan:
            queryset = queryset.filter(plan=plan)
        if status_filter:
            queryset = queryset.filter(status=status_filter)
        
        serializer = self.get_serializer(queryset, many=True)
        
        return Response({
            "count": queryset.count(),
            "results": serializer.data,
        })
    
    def retrieve(self, request, *args, **kwargs):
        """Get detailed tenant info."""
        try:
            tenant = self.get_queryset().get(tenant_id=kwargs.get("pk"))
        except SchoolTenant.DoesNotExist:
            return Response(
                {"detail": "Tenant not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        serializer = self.get_serializer(tenant)
        return Response(serializer.data)
    
    @action(detail=True, methods=["get"])
    def metrics(self, request, pk=None):
        """Get tenant usage metrics."""
        try:
            tenant = self.get_queryset().get(tenant_id=pk)
        except SchoolTenant.DoesNotExist:
            return Response(
                {"detail": "Tenant not found"},
                status=status.HTTP_404_NOT_FOUND,
            )
        
        # Calculate metrics
        enabled_features = TenantFeatureFlag.objects.filter(
            tenant=tenant,
            is_enabled=True,
        ).count()
        
        total_features = TenantFeature.objects.count()
        
        # Trial days
        trial_days_remaining = None
        is_trial_expired = False
        
        if tenant.plan == "trial" and tenant.provisioned_at:
            age_days = (timezone.now() - tenant.provisioned_at).days
            trial_days_remaining = max(0, 30 - age_days)
            is_trial_expired = age_days > 30
        
        # Age
        age_days = (
            (timezone.now() - tenant.provisioned_at).days
            if tenant.provisioned_at
            else 0
        )
        
        # Recent changes (last 7 days)
        week_ago = timezone.now() - timedelta(days=7)
        recent_changes = TenantFeatureAudit.objects.filter(
            tenant_id=pk,
            created_at__gte=week_ago,
        ).count()
        
        metrics = {
            "tenant_id": tenant.tenant_id,
            "tenant_name": tenant.name,
            "plan": tenant.plan,
            "status": tenant.status,
            "enabled_features": enabled_features,
            "total_features": total_features,
            "api_access_enabled": tenant.api_access,
            "trial_days_remaining": trial_days_remaining,
            "is_trial_expired": is_trial_expired,
            "provisioned_at": tenant.provisioned_at,
            "age_days": age_days,
            "recent_changes": recent_changes,
        }
        
        serializer = TenantMetricsSerializer(metrics)
        return Response(serializer.data)
    
    @action(detail=True, methods=["get"])
    def audit_log(self, request, pk=None):
        """Get tenant audit log."""
        limit = int(request.query_params.get("limit", 20))
        
        logs = get_tenant_feature_audit_log(pk, limit=limit)
        
        data = [
            {
                "id": log.id,
                "action": log.action,
                "feature_id": log.feature_id,
                "actor": log.actor_username,
                "reason": log.reason,
                "created_at": log.created_at,
            }
            for log in logs
        ]
        
        return Response({"count": len(data), "results": data})


class PlatformReportingViewSet(viewsets.ViewSet):
    """Platform-level reporting APIs for super-admins."""
    
    permission_classes = [IsAuthenticated, IsSuperAdminOnly]
    
    @action(detail=False, methods=["get"])
    def health(self, request):
        """Get platform health report."""
        tenants = SchoolTenant.objects.using("default").all()
        
        active_count = tenants.filter(status="active").count()
        suspended_count = tenants.filter(status="suspended").count()
        onboarding_count = tenants.filter(status="onboarding").count()
        
        trial_count = tenants.filter(plan="trial").count()
        premium_count = tenants.filter(plan="premium").count()
        enterprise_count = tenants.filter(plan="enterprise").count()
        
        api_enabled_count = tenants.filter(api_access=True).count()
        
        return Response({
            "title": "Platform Health Report",
            "generated_at": timezone.now(),
            "summary": {
                "total_tenants": tenants.count(),
                "active_tenants": active_count,
                "suspended_tenants": suspended_count,
                "onboarding_tenants": onboarding_count,
                "trial_count": trial_count,
                "premium_count": premium_count,
                "enterprise_count": enterprise_count,
                "api_enabled": api_enabled_count,
            },
        })
    
    @action(detail=False, methods=["get"])
    def feature_usage(self, request):
        """Get feature usage report."""
        features = TenantFeature.objects.using("default").all()
        
        usage = []
        for feature in features:
            enabled_count = TenantFeatureFlag.objects.filter(
                feature=feature,
                is_enabled=True,
            ).count()
            
            usage.append({
                "feature_id": feature.feature_id,
                "name": feature.name,
                "enabled_tenants": enabled_count,
            })
        
        return Response({
            "title": "Feature Usage Report",
            "generated_at": timezone.now(),
            "features": usage,
            "total_unique_features": len(usage),
        })
    
    @action(detail=False, methods=["get"])
    def plans(self, request):
        """Get plan distribution report."""
        tenants = SchoolTenant.objects.using("default").all()
        
        plan_dist = tenants.values("plan").annotate(count=Count("id"))
        
        return Response({
            "title": "Plan Distribution Report",
            "generated_at": timezone.now(),
            "distribution": list(plan_dist),
        })
    
    @action(detail=False, methods=["get"])
    def audit_summary(self, request):
        """Get audit events summary."""
        days = int(request.query_params.get("days", 7))
        
        cutoff = timezone.now() - timedelta(days=days)
        recent_audits = TenantFeatureAudit.objects.filter(
            created_at__gte=cutoff,
        ).using("default")
        
        action_dist = recent_audits.values("action").annotate(count=Count("id"))
        
        return Response({
            "title": "Audit Summary",
            "generated_at": timezone.now(),
            "period_days": days,
            "total_events": recent_audits.count(),
            "by_action": list(action_dist),
        })
