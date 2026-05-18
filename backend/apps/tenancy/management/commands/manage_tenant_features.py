"""Management command to manage tenant features and plans.

Usage:
    python manage.py manage_tenant_features --list-plans
    python manage.py manage_tenant_features --list-features
    python manage.py manage_tenant_features --list-tenants
    python manage.py manage_tenant_features --set-plan <tenant_id> <plan>
    python manage.py manage_tenant_features --enable-feature <tenant_id> <feature_id>
    python manage.py manage_tenant_features --disable-feature <tenant_id> <feature_id>
    python manage.py manage_tenant_features --suspend <tenant_id>
    python manage.py manage_tenant_features --activate <tenant_id>
    python manage.py manage_tenant_features --enable-api <tenant_id>
    python manage.py manage_tenant_features --disable-api <tenant_id>
"""

from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from apps.tenancy.models import (
    SchoolTenant,
    TenantPlan,
    TenantFeature,
    TenantFeatureFlag,
)
from apps.tenancy.feature_flags import clear_tenant_feature_cache
from apps.tenancy.audit_features import (
    log_feature_changed,
    log_plan_changed,
    log_tenant_suspended,
    log_tenant_activated,
    log_api_access_toggled,
)


class Command(BaseCommand):
    help = "Manage tenant features, plans, and API access"
    
    def add_arguments(self, parser):
        parser.add_argument(
            "--list-plans",
            action="store_true",
            help="List all available plans",
        )
        parser.add_argument(
            "--list-features",
            action="store_true",
            help="List all available features",
        )
        parser.add_argument(
            "--list-tenants",
            action="store_true",
            help="List all tenants with their current plans",
        )
        parser.add_argument(
            "--set-plan",
            nargs=2,
            metavar=("TENANT_ID", "PLAN"),
            help="Set tenant plan (trial, premium, enterprise)",
        )
        parser.add_argument(
            "--enable-feature",
            nargs=2,
            metavar=("TENANT_ID", "FEATURE_ID"),
            help="Enable feature for tenant",
        )
        parser.add_argument(
            "--disable-feature",
            nargs=2,
            metavar=("TENANT_ID", "FEATURE_ID"),
            help="Disable feature for tenant",
        )
        parser.add_argument(
            "--suspend",
            metavar="TENANT_ID",
            help="Suspend tenant account",
        )
        parser.add_argument(
            "--activate",
            metavar="TENANT_ID",
            help="Activate suspended tenant",
        )
        parser.add_argument(
            "--enable-api",
            metavar="TENANT_ID",
            help="Enable API access for tenant",
        )
        parser.add_argument(
            "--disable-api",
            metavar="TENANT_ID",
            help="Disable API access for tenant",
        )
    
    def handle(self, *args, **options):
        if options["list_plans"]:
            self._list_plans()
        elif options["list_features"]:
            self._list_features()
        elif options["list_tenants"]:
            self._list_tenants()
        elif options["set_plan"]:
            self._set_plan(options["set_plan"][0], options["set_plan"][1])
        elif options["enable_feature"]:
            self._enable_feature(
                options["enable_feature"][0],
                options["enable_feature"][1],
            )
        elif options["disable_feature"]:
            self._disable_feature(
                options["disable_feature"][0],
                options["disable_feature"][1],
            )
        elif options["suspend"]:
            self._suspend_tenant(options["suspend"])
        elif options["activate"]:
            self._activate_tenant(options["activate"])
        elif options["enable_api"]:
            self._enable_api_access(options["enable_api"])
        elif options["disable_api"]:
            self._disable_api_access(options["disable_api"])
        else:
            self.stdout.write(
                self.style.WARNING("Use --help for available options")
            )
    
    def _list_plans(self):
        """List all available plans."""
        self.stdout.write(self.style.HTTP_INFO("\n=== Available Plans ===\n"))
        
        plans = TenantPlan.objects.all()
        if not plans:
            self.stdout.write("No plans configured")
            return
        
        for plan in plans:
            self.stdout.write(
                f"\n{plan.name} ({plan.plan_type})"
            )
            self.stdout.write(f"  ID: {plan.plan_id}")
            self.stdout.write(f"  Rate Limits:")
            self.stdout.write(
                f"    - Per Minute: {plan.api_rate_limit_per_minute}"
            )
            self.stdout.write(
                f"    - Per Hour: {plan.api_rate_limit_per_hour}"
            )
            
            if plan.features:
                self.stdout.write("  Features:")
                for feature, enabled in plan.features.items():
                    status = "✓" if enabled else "✗"
                    self.stdout.write(f"    {status} {feature}")
    
    def _list_features(self):
        """List all available features."""
        self.stdout.write(self.style.HTTP_INFO("\n=== Available Features ===\n"))
        
        features = TenantFeature.objects.all().order_by("category", "feature_id")
        if not features:
            self.stdout.write("No features configured")
            return
        
        current_category = None
        for feature in features:
            if feature.category != current_category:
                current_category = feature.category
                self.stdout.write(f"\n{current_category.upper()}:")
            
            default = "✓" if feature.enabled_by_default else "✗"
            self.stdout.write(
                f"  {default} {feature.feature_id}: {feature.name}"
            )
    
    def _list_tenants(self):
        """List all tenants with their plans."""
        self.stdout.write(self.style.HTTP_INFO("\n=== Tenants ===\n"))
        
        tenants = SchoolTenant.objects.all().order_by("name")
        if not tenants:
            self.stdout.write("No tenants configured")
            return
        
        for tenant in tenants:
            status_icon = {
                "active": "✓",
                "suspended": "✗",
                "onboarding": "→",
                "archived": "⊘",
            }.get(tenant.status, "?")
            
            api_icon = "✓" if tenant.api_access else "✗"
            
            self.stdout.write(
                f"\n{status_icon} {tenant.name} ({tenant.tenant_id})"
            )
            self.stdout.write(f"  Status: {tenant.status}")
            self.stdout.write(f"  Plan: {tenant.plan}")
            self.stdout.write(f"  API Access: {api_icon}")
            
            if tenant.provisioned_at:
                age_days = (
                    timezone.now() - tenant.provisioned_at
                ).days
                self.stdout.write(f"  Age: {age_days} days")
    
    def _set_plan(self, tenant_id: str, plan: str):
        """Set tenant plan."""
        try:
            tenant = SchoolTenant.objects.get(tenant_id=tenant_id)
        except SchoolTenant.DoesNotExist:
            raise CommandError(f"Tenant not found: {tenant_id}")
        
        if plan not in ["trial", "premium", "enterprise"]:
            raise CommandError(
                f"Invalid plan: {plan}. "
                "Must be: trial, premium, or enterprise"
            )
        
        old_plan = tenant.plan
        tenant.plan = plan
        tenant.save()
        
        # Log change
        log_plan_changed(
            tenant_id=tenant_id,
            old_plan=old_plan,
            new_plan=plan,
            actor_username="admin",
            reason="Plan changed via management command",
        )
        
        # Clear cache
        clear_tenant_feature_cache(tenant_id)
        
        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Tenant {tenant.name} plan changed to {plan}"
            )
        )
    
    def _enable_feature(self, tenant_id: str, feature_id: str):
        """Enable feature for tenant."""
        try:
            tenant = SchoolTenant.objects.get(tenant_id=tenant_id)
        except SchoolTenant.DoesNotExist:
            raise CommandError(f"Tenant not found: {tenant_id}")
        
        try:
            feature = TenantFeature.objects.get(feature_id=feature_id)
        except TenantFeature.DoesNotExist:
            raise CommandError(f"Feature not found: {feature_id}")
        
        flag, created = TenantFeatureFlag.objects.get_or_create(
            tenant=tenant,
            feature=feature,
            defaults={"is_enabled": True},
        )
        
        if not created and flag.is_enabled is not True:
            old_value = flag.is_enabled
            flag.is_enabled = True
            flag.save()
            
            # Log change
            log_feature_changed(
                tenant_id=tenant_id,
                feature_id=feature_id,
                old_value=old_value,
                new_value=True,
                action="feature_enabled",
                actor_username="admin",
                reason="Feature enabled via management command",
            )
        
        # Clear cache
        clear_tenant_feature_cache(tenant_id)
        
        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Feature {feature_id} enabled for {tenant.name}"
            )
        )
    
    def _disable_feature(self, tenant_id: str, feature_id: str):
        """Disable feature for tenant."""
        try:
            tenant = SchoolTenant.objects.get(tenant_id=tenant_id)
        except SchoolTenant.DoesNotExist:
            raise CommandError(f"Tenant not found: {tenant_id}")
        
        try:
            feature = TenantFeature.objects.get(feature_id=feature_id)
        except TenantFeature.DoesNotExist:
            raise CommandError(f"Feature not found: {feature_id}")
        
        flag, created = TenantFeatureFlag.objects.get_or_create(
            tenant=tenant,
            feature=feature,
            defaults={"is_enabled": False},
        )
        
        if not created and flag.is_enabled is not False:
            old_value = flag.is_enabled
            flag.is_enabled = False
            flag.save()
            
            # Log change
            log_feature_changed(
                tenant_id=tenant_id,
                feature_id=feature_id,
                old_value=old_value,
                new_value=False,
                action="feature_disabled",
                actor_username="admin",
                reason="Feature disabled via management command",
            )
        
        # Clear cache
        clear_tenant_feature_cache(tenant_id)
        
        self.stdout.write(
            self.style.SUCCESS(
                f"✓ Feature {feature_id} disabled for {tenant.name}"
            )
        )
    
    def _suspend_tenant(self, tenant_id: str):
        """Suspend tenant."""
        try:
            tenant = SchoolTenant.objects.get(tenant_id=tenant_id)
        except SchoolTenant.DoesNotExist:
            raise CommandError(f"Tenant not found: {tenant_id}")
        
        tenant.status = "suspended"
        tenant.save()
        
        # Log change
        log_tenant_suspended(
            tenant_id=tenant_id,
            actor_username="admin",
            reason="Tenant suspended via management command",
        )
        
        self.stdout.write(
            self.style.SUCCESS(f"✓ Tenant {tenant.name} suspended")
        )
    
    def _activate_tenant(self, tenant_id: str):
        """Activate tenant."""
        try:
            tenant = SchoolTenant.objects.get(tenant_id=tenant_id)
        except SchoolTenant.DoesNotExist:
            raise CommandError(f"Tenant not found: {tenant_id}")
        
        tenant.status = "active"
        tenant.save()
        
        # Log change
        log_tenant_activated(
            tenant_id=tenant_id,
            actor_username="admin",
            reason="Tenant activated via management command",
        )
        
        self.stdout.write(
            self.style.SUCCESS(f"✓ Tenant {tenant.name} activated")
        )
    
    def _enable_api_access(self, tenant_id: str):
        """Enable API access."""
        try:
            tenant = SchoolTenant.objects.get(tenant_id=tenant_id)
        except SchoolTenant.DoesNotExist:
            raise CommandError(f"Tenant not found: {tenant_id}")
        
        tenant.api_access = True
        tenant.save()
        
        # Log change
        log_api_access_toggled(
            tenant_id=tenant_id,
            enabled=True,
            actor_username="admin",
            reason="API access enabled via management command",
        )
        
        self.stdout.write(
            self.style.SUCCESS(f"✓ API access enabled for {tenant.name}")
        )
    
    def _disable_api_access(self, tenant_id: str):
        """Disable API access."""
        try:
            tenant = SchoolTenant.objects.get(tenant_id=tenant_id)
        except SchoolTenant.DoesNotExist:
            raise CommandError(f"Tenant not found: {tenant_id}")
        
        tenant.api_access = False
        tenant.save()
        
        # Log change
        log_api_access_toggled(
            tenant_id=tenant_id,
            enabled=False,
            actor_username="admin",
            reason="API access disabled via management command",
        )
        
        self.stdout.write(
            self.style.SUCCESS(f"✓ API access disabled for {tenant.name}")
        )
