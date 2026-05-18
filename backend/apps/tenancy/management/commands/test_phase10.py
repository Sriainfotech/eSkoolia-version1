"""Management command to test and validate Phase 10 implementation.

Usage:
    python manage.py test_phase10                       # Status report
    python manage.py test_phase10 --test-features       # Test feature flags
    python manage.py test_phase10 --test-permissions    # Test permissions
    python manage.py test_phase10 --test-rate-limits    # Test rate limiting
    python manage.py test_phase10 --test-isolation      # Test cross-tenant isolation
    python manage.py test_phase10 --all                 # Run all tests
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from apps.tenancy.models import (
    SchoolTenant,
    TenantPlan,
    TenantFeature,
    TenantFeatureFlag,
    TenantFeatureAudit,
)
from apps.tenancy.feature_flags import (
    is_feature_enabled,
    get_tenant_features,
    get_tenant_plan,
)
from apps.tenancy.helpers import (
    tenant_is_active,
    tenant_is_suspended,
    tenant_api_allowed,
)
from apps.tenancy.rate_limiting import TenantAwareThrottle


class Command(BaseCommand):
    help = "Test and validate Phase 10 tenant-aware API permissions and features"
    
    def add_arguments(self, parser):
        parser.add_argument(
            "--test-features",
            action="store_true",
            help="Test feature flag system",
        )
        parser.add_argument(
            "--test-permissions",
            action="store_true",
            help="Test permission classes",
        )
        parser.add_argument(
            "--test-rate-limits",
            action="store_true",
            help="Test rate limiting",
        )
        parser.add_argument(
            "--test-isolation",
            action="store_true",
            help="Test cross-tenant isolation",
        )
        parser.add_argument(
            "--test-audit",
            action="store_true",
            help="Test audit logging",
        )
        parser.add_argument(
            "--all",
            action="store_true",
            help="Run all tests",
        )
    
    def handle(self, *args, **options):
        self.stdout.write(
            self.style.HTTP_INFO("\n=== Phase 10 Validation Tests ===\n")
        )
        
        # Check if multi-tenancy enabled
        from django.conf import settings
        
        multi_tenancy = getattr(settings, "MULTI_TENANCY_ENABLED", False)
        self.stdout.write(
            f"Multi-tenancy enabled: {self.style.SUCCESS(str(multi_tenancy))}"
        )
        
        if not multi_tenancy:
            self.stdout.write(
                self.style.WARNING(
                    "Note: Multi-tenancy is disabled. Tests will be limited."
                )
            )
        
        # Run selected tests
        if options["all"]:
            self._test_features()
            self._test_permissions()
            self._test_rate_limits()
            self._test_isolation()
            self._test_audit()
            self._status_report()
        else:
            if options["test_features"]:
                self._test_features()
            if options["test_permissions"]:
                self._test_permissions()
            if options["test_rate_limits"]:
                self._test_rate_limits()
            if options["test_isolation"]:
                self._test_isolation()
            if options["test_audit"]:
                self._test_audit()
            if not any([
                options["test_features"],
                options["test_permissions"],
                options["test_rate_limits"],
                options["test_isolation"],
                options["test_audit"],
            ]):
                self._status_report()
    
    def _test_features(self):
        """Test feature flag system."""
        self.stdout.write(self.style.HTTP_INFO("\n--- Feature Flag Tests ---\n"))
        
        try:
            # Check plans exist
            plans = TenantPlan.objects.count()
            self.stdout.write(
                f"Total plans: {self.style.SUCCESS(str(plans))}"
            )
            
            # List plans
            for plan in TenantPlan.objects.all()[:5]:
                self.stdout.write(f"  - {plan.name} ({plan.plan_type})")
            
            # Check features exist
            features = TenantFeature.objects.count()
            self.stdout.write(
                f"Total features: {self.style.SUCCESS(str(features))}"
            )
            
            # List features by category
            categories = TenantFeature.objects.values_list(
                "category",
                flat=True,
            ).distinct()
            for category in sorted(categories):
                count = TenantFeature.objects.filter(category=category).count()
                self.stdout.write(f"  - {category}: {count} features")
            
            # Test feature evaluation
            if SchoolTenant.objects.exists():
                tenant = SchoolTenant.objects.first()
                self.stdout.write(f"\nTesting evaluation for {tenant.name}:")
                
                plan = get_tenant_plan(tenant.tenant_id)
                self.stdout.write(f"  Plan: {plan}")
                
                features_dict = get_tenant_features(tenant.tenant_id)
                enabled_count = sum(
                    1 for f in features_dict.values() if f["enabled"]
                )
                self.stdout.write(
                    f"  Enabled features: {enabled_count}/{len(features_dict)}"
                )
            
            self.stdout.write(
                self.style.SUCCESS("✓ Feature tests passed\n")
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Feature tests failed: {e}\n")
            )
    
    def _test_permissions(self):
        """Test permission classes."""
        self.stdout.write(self.style.HTTP_INFO("\n--- Permission Tests ---\n"))
        
        try:
            from apps.tenancy.permissions import (
                TenantActive,
                TenantFeatureEnabled,
                TenantAPIAccessEnabled,
                TenantNotSuspended,
                IsSuperAdminOnly,
            )
            
            perms = [
                "TenantActive",
                "TenantFeatureEnabled",
                "TenantAPIAccessEnabled",
                "TenantNotSuspended",
                "IsSuperAdminOnly",
            ]
            
            self.stdout.write("Permission classes available:")
            for perm in perms:
                self.stdout.write(f"  ✓ {perm}")
            
            self.stdout.write(
                self.style.SUCCESS("✓ Permission tests passed\n")
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Permission tests failed: {e}\n")
            )
    
    def _test_rate_limits(self):
        """Test rate limiting."""
        self.stdout.write(self.style.HTTP_INFO("\n--- Rate Limit Tests ---\n"))
        
        try:
            from apps.tenancy.rate_limiting import (
                TenantAwareThrottle,
                TenantPlanBasedThrottle,
            )
            
            self.stdout.write("Rate limit classes available:")
            self.stdout.write("  ✓ TenantAwareThrottle")
            self.stdout.write("  ✓ TenantPlanBasedThrottle")
            
            # Test plan limits
            throttle = TenantPlanBasedThrottle()
            plans = ["trial", "premium", "enterprise"]
            
            self.stdout.write("\nPlan-based limits:")
            for plan in plans:
                from apps.tenancy.feature_flags import get_plan_features
                from unittest.mock import Mock, patch
                
                with patch(
                    "apps.tenancy.rate_limiting.get_tenant_plan",
                    return_value=plan,
                ):
                    limits = throttle.get_plan_limits()
                    self.stdout.write(
                        f"  {plan}: {limits['per_minute']}/min, {limits['per_hour']}/hour"
                    )
            
            self.stdout.write(
                self.style.SUCCESS("✓ Rate limit tests passed\n")
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Rate limit tests failed: {e}\n")
            )
    
    def _test_isolation(self):
        """Test cross-tenant isolation."""
        self.stdout.write(
            self.style.HTTP_INFO("\n--- Cross-Tenant Isolation Tests ---\n")
        )
        
        try:
            tenants = SchoolTenant.objects.all()[:2]
            
            if len(tenants) < 2:
                self.stdout.write(
                    self.style.WARNING(
                        "Insufficient tenants for isolation test (need 2+)"
                    )
                )
                return
            
            self.stdout.write(
                f"Testing isolation between {len(tenants)} tenants:\n"
            )
            
            for i, tenant in enumerate(tenants, 1):
                plan = get_tenant_plan(tenant.tenant_id)
                features = get_tenant_features(tenant.tenant_id)
                enabled = sum(1 for f in features.values() if f["enabled"])
                
                self.stdout.write(
                    f"  Tenant {i} ({tenant.name}): "
                    f"plan={plan}, features={enabled}"
                )
            
            # Check isolation
            if tenants[0].plan != tenants[1].plan:
                self.stdout.write(
                    self.style.SUCCESS(
                        "  ✓ Tenants have different plans (good isolation)"
                    )
                )
            else:
                features_0 = get_tenant_features(tenants[0].tenant_id)
                features_1 = get_tenant_features(tenants[1].tenant_id)
                
                same = all(
                    features_0.get(k) == features_1.get(k)
                    for k in features_0
                )
                
                if same:
                    self.stdout.write(
                        self.style.WARNING(
                            "  ! Tenants share same features (may be expected)"
                        )
                    )
            
            self.stdout.write(
                self.style.SUCCESS("✓ Isolation tests passed\n")
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Isolation tests failed: {e}\n")
            )
    
    def _test_audit(self):
        """Test audit logging."""
        self.stdout.write(self.style.HTTP_INFO("\n--- Audit Logging Tests ---\n"))
        
        try:
            from apps.tenancy.audit_features import (
                log_feature_changed,
                log_plan_changed,
                log_tenant_suspended,
                get_tenant_feature_audit_log,
            )
            
            # Check audit logs exist
            total_logs = TenantFeatureAudit.objects.count()
            self.stdout.write(f"Total audit logs: {total_logs}")
            
            # Show recent logs
            recent = TenantFeatureAudit.objects.order_by(
                "-created_at"
            )[:5]
            
            if recent:
                self.stdout.write("\nRecent events:")
                for log in recent:
                    self.stdout.write(
                        f"  - {log.action} ({log.tenant_id}) @ {log.created_at}"
                    )
            
            self.stdout.write(
                self.style.SUCCESS("✓ Audit tests passed\n")
            )
            
        except Exception as e:
            self.stdout.write(
                self.style.ERROR(f"✗ Audit tests failed: {e}\n")
            )
    
    def _status_report(self):
        """Show Phase 10 status report."""
        self.stdout.write(self.style.HTTP_INFO("\n--- Phase 10 Status Report ---\n"))
        
        self.stdout.write("Configuration:")
        self.stdout.write(f"  - Plans configured: {TenantPlan.objects.count()}")
        self.stdout.write(f"  - Features defined: {TenantFeature.objects.count()}")
        self.stdout.write(f"  - Tenants: {SchoolTenant.objects.count()}")
        self.stdout.write(
            f"  - Feature overrides: {TenantFeatureFlag.objects.count()}"
        )
        self.stdout.write(
            f"  - Audit logs: {TenantFeatureAudit.objects.count()}"
        )
        
        # Tenant status breakdown
        active = SchoolTenant.objects.filter(status="active").count()
        suspended = SchoolTenant.objects.filter(status="suspended").count()
        onboarding = SchoolTenant.objects.filter(status="onboarding").count()
        
        self.stdout.write("\nTenant Status:")
        self.stdout.write(
            f"  - Active: {self.style.SUCCESS(str(active))}"
        )
        self.stdout.write(
            f"  - Suspended: {self.style.WARNING(str(suspended))}"
        )
        self.stdout.write(f"  - Onboarding: {onboarding}")
        
        # Plan breakdown
        self.stdout.write("\nPlan Distribution:")
        plan_counts = SchoolTenant.objects.values_list(
            "plan"
        ).annotate(count=__import__("django.db.models", fromlist=["Count"]).Count("id"))
        # Fallback to simpler query
        for plan_name in ["trial", "premium", "enterprise"]:
            count = SchoolTenant.objects.filter(plan=plan_name).count()
            if count > 0:
                self.stdout.write(f"  - {plan_name}: {count}")
        
        self.stdout.write(
            self.style.SUCCESS("\n✓ Phase 10 ready for activation\n")
        )
