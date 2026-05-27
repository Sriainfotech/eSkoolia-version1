from django.db import models
import uuid


class School(models.Model):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64, unique=True)
    subdomain = models.CharField(max_length=128, blank=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # LLM integration
    llm_enabled = models.BooleanField(default=False)
    llm_enabled_at = models.DateTimeField(null=True, blank=True)
    llm_enabled_by = models.ForeignKey(
        "users.User",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="schools_llm_enabled",
        help_text="Super admin who enabled LLM for this school",
    )

    class Meta:
        db_table = "schools"

    def __str__(self) -> str:
        return f"{self.name} ({self.code})"


# --- Tenant models (guarded) -------------------------------------------------
# We add tenant-aware models in parallel to the existing `School` model.
# These are implemented to be non-breaking when django-tenants is not
# installed; when the MULTI_TENANCY_ENABLED flag is set the project can
# begin using these models for provisioning and schema operations.
try:
    from django_tenants.models import TenantMixin, DomainMixin
except Exception:
    # Provide lightweight placeholders so migrations and imports do not fail
    class TenantMixin(models.Model):
        class Meta:
            abstract = True

    class DomainMixin(models.Model):
        class Meta:
            abstract = True


class SchoolTenant(TenantMixin, models.Model):
    """Parallel tenant model for future schema provisioning.

    This model is intentionally additive (does not replace the existing
    `School` model). It stores tenant configuration and will be used by
    provisioning management commands and the initial migration scripts.
    """

    tenant_id = models.CharField(max_length=32, unique=True)
    name = models.CharField(max_length=255)
    short_code = models.CharField(max_length=64, blank=True)
    subdomain_url = models.CharField(max_length=128, blank=True)
    shard_region = models.CharField(max_length=64, blank=True)
    storage_region = models.CharField(max_length=64, blank=True)
    backup_retention = models.IntegerField(null=True, blank=True)
    sso_method = models.CharField(max_length=64, blank=True)
    api_access = models.BooleanField(default=False)
    plan = models.CharField(max_length=64, blank=True)
    status = models.CharField(max_length=32, default="pending")
    provisioned_at = models.DateTimeField(null=True, blank=True)
    board = models.CharField(max_length=32, blank=True, default="OTHER")
    state = models.CharField(max_length=64, blank=True)
    region = models.CharField(max_length=32, blank=True)
    gstin = models.CharField(max_length=32, blank=True)
    udise_code = models.CharField(max_length=32, blank=True)
    pan = models.CharField(max_length=32, blank=True)
    seats = models.IntegerField(default=0)
    brand_color = models.CharField(max_length=32, blank=True)
    logo_url = models.CharField(max_length=512, blank=True)
    student_count = models.IntegerField(default=0)
    staff_count = models.IntegerField(default=0)
    last_activity_at = models.DateTimeField(null=True, blank=True)

    # Contact & address
    principal_name = models.CharField(max_length=128, null=True, blank=True)
    principal_email = models.EmailField(max_length=128, null=True, blank=True)
    principal_phone = models.CharField(max_length=20, null=True, blank=True)
    campus_address = models.TextField(null=True, blank=True)
    city = models.CharField(max_length=64, null=True, blank=True)
    pin_code = models.CharField(max_length=6, null=True, blank=True)

    # Board affiliation
    affiliation_number = models.CharField(max_length=64, null=True, blank=True)

    # django-tenants uses `schema_name` on TenantMixin. Keep it explicit
    schema_name = models.CharField(max_length=63, unique=True)

    # Schema provisioning is handled explicitly by management commands;
    # letting TenantMixin.save() call migrate_schemas automatically causes
    # CommandError when django_tenants is not fully configured (SQLite / no
    # multi-tenancy).
    auto_create_schema = False

    class Meta:
        db_table = "school_tenants"

    def __str__(self):
        return f"{self.name} ({self.tenant_id})"


class Domain(DomainMixin, models.Model):
    domain = models.CharField(max_length=255, unique=True)
    is_primary = models.BooleanField(default=False)

    class Meta:
        db_table = "tenant_domains"

    def __str__(self):
        return self.domain


# --- Audit logging (always in public schema) --------------------------------
# TenantAuditLog tracks all provisioning and operational events
# for compliance, debugging, and operational visibility.


class TenantAuditLog(models.Model):
    """Immutable audit trail for tenant provisioning and operational events.
    
    Stored in PUBLIC schema only; tracks all tenant-related actions across the system.
    """
    
    ACTION_CHOICES = [
        ("provision_start", "Provisioning Started"),
        ("schema_created", "Schema Created"),
        ("schema_failed", "Schema Creation Failed"),
        ("migrations_ran", "Migrations Executed"),
        ("migrations_failed", "Migrations Failed"),
        ("seeding_start", "Seeding Started"),
        ("seeding_completed", "Seeding Completed"),
        ("seeding_failed", "Seeding Failed"),
        ("provision_complete", "Provisioning Completed"),
        ("provision_failed", "Provisioning Failed"),
        ("domain_created", "Domain Created"),
        ("tenant_activated", "Tenant Activated"),
        ("tenant_deactivated", "Tenant Deactivated"),
        ("tenant_deleted", "Tenant Deleted"),
    ]
    
    STATUS_CHOICES = [
        ("success", "Success"),
        ("partial", "Partial"),
        ("failed", "Failed"),
        ("pending", "Pending"),
    ]
    
    # Audit identifiers
    tenant_id = models.CharField(max_length=32, null=True, blank=True, db_index=True)
    schema_name = models.CharField(max_length=64, null=True, blank=True, db_index=True)
    action = models.CharField(max_length=32, choices=ACTION_CHOICES, db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="pending")
    
    # Actor information
    actor_user_id = models.IntegerField(null=True, blank=True)
    actor_username = models.CharField(max_length=256, null=True, blank=True)
    actor_ip = models.GenericIPAddressField(null=True, blank=True)
    
    # Event details
    details = models.JSONField(default=dict, blank=True)
    error_message = models.TextField(null=True, blank=True)
    duration_ms = models.IntegerField(null=True, blank=True, help_text="Duration in milliseconds")
    
    # Timestamps (always in public schema)
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "tenancy_audit_log"
        indexes = [
            models.Index(fields=["tenant_id", "created_at"]),
            models.Index(fields=["schema_name", "created_at"]),
            models.Index(fields=["action", "created_at"]),
            models.Index(fields=["status", "created_at"]),
        ]
    
    def __str__(self):
        return f"{self.action} on {self.schema_name or self.tenant_id} ({self.status})"


# --- Phase 10: Tenant-Aware API Permissions & Feature Flags ----------------
# Models supporting tenant feature toggles, plan-based access control,
# and API governance (stored in PUBLIC schema)


class TenantPlan(models.Model):
    """Plan definitions with built-in features and limits.
    
    Plans control which modules/features are available to a tenant,
    and what API rate limits apply.
    """
    
    PLAN_TYPES = [
        ("trial", "Trial"),
        ("premium", "Premium"),
        ("enterprise", "Enterprise"),
        ("custom", "Custom"),
    ]
    
    plan_id = models.CharField(max_length=32, unique=True, db_index=True)
    plan_type = models.CharField(max_length=32, choices=PLAN_TYPES)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    
    # Feature configuration (JSON)
    features = models.JSONField(default=dict, help_text="Dict of feature flags and their default values")
    
    # Rate limiting
    api_rate_limit_per_minute = models.IntegerField(default=100)
    api_rate_limit_per_hour = models.IntegerField(default=10000)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "tenant_plans"
        indexes = [
            models.Index(fields=["plan_type"]),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.plan_id})"


class TenantFeature(models.Model):
    """Feature definitions and metadata.
    
    Describes all possible features that can be enabled/disabled per tenant.
    """
    
    FEATURE_CATEGORIES = [
        ("academic", "Academic"),
        ("finance", "Finance & Fees"),
        ("attendance", "Attendance"),
        ("behaviour", "Behaviour"),
        ("library", "Library"),
        ("transport", "Transport"),
        ("inventory", "Inventory"),
        ("hr", "HR"),
        ("communication", "Communication"),
        ("analytics", "Analytics"),
        ("api", "API"),
        ("admin", "Admin"),
        ("integration", "Integration"),
        ("other", "Other"),
    ]
    
    feature_id = models.CharField(max_length=64, unique=True, db_index=True)
    category = models.CharField(max_length=32, choices=FEATURE_CATEGORIES)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    
    # Default enabled/disabled
    enabled_by_default = models.BooleanField(default=False)
    
    # Feature dependencies (comma-separated feature_ids)
    depends_on = models.CharField(max_length=512, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    class Meta:
        db_table = "tenant_features"
        indexes = [
            models.Index(fields=["category"]),
            models.Index(fields=["feature_id"]),
        ]
    
    def __str__(self):
        return f"{self.name} ({self.feature_id})"


class TenantFeatureFlag(models.Model):
    """Tenant-specific feature toggles.
    
    Allows enabling/disabling features per tenant, with overrides on top of plan defaults.
    """
    
    tenant = models.ForeignKey(SchoolTenant, on_delete=models.CASCADE, related_name="feature_flags")
    feature = models.ForeignKey(TenantFeature, on_delete=models.CASCADE, related_name="tenant_flags")
    
    # Override values (if set, overrides both plan and default)
    is_enabled = models.BooleanField(null=True, blank=True, help_text="Null = use plan default, True/False = override")
    
    # Configuration overrides (JSON)
    config_override = models.JSONField(default=dict, blank=True)
    
    # Metadata
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    changed_by = models.CharField(max_length=256, blank=True, help_text="User/system that made the change")
    
    class Meta:
        db_table = "tenant_feature_flags"
        unique_together = [["tenant", "feature"]]
        indexes = [
            models.Index(fields=["tenant", "feature"]),
            models.Index(fields=["is_enabled"]),
        ]
    
    def __str__(self):
        return f"{self.tenant.name} - {self.feature.name}: {self.is_enabled if self.is_enabled is not None else 'default'}"


class TenantFeatureAudit(models.Model):
    """Immutable audit trail for feature changes.
    
    Tracks all feature enable/disable events per tenant for compliance.
    """
    
    ACTION_CHOICES = [
        ("feature_enabled", "Feature Enabled"),
        ("feature_disabled", "Feature Disabled"),
        ("feature_override_set", "Override Set"),
        ("feature_override_cleared", "Override Cleared"),
        ("plan_changed", "Plan Changed"),
        ("plan_updated", "Plan Updated"),
        ("rate_limit_changed", "Rate Limit Changed"),
        ("tenant_suspended", "Tenant Suspended"),
        ("tenant_activated", "Tenant Activated"),
    ]
    
    tenant_id = models.CharField(max_length=32, db_index=True)
    feature_id = models.CharField(max_length=64, blank=True, db_index=True)
    action = models.CharField(max_length=32, choices=ACTION_CHOICES, db_index=True)
    
    # Actor info
    actor_user_id = models.IntegerField(null=True, blank=True)
    actor_username = models.CharField(max_length=256, blank=True)
    actor_ip = models.GenericIPAddressField(null=True, blank=True)
    
    # Change details
    old_value = models.JSONField(null=True, blank=True)
    new_value = models.JSONField(null=True, blank=True)
    reason = models.TextField(blank=True)
    
    # Timestamp
    created_at = models.DateTimeField(auto_now_add=True, db_index=True)
    
    class Meta:
        db_table = "tenant_feature_audit"
        indexes = [
            models.Index(fields=["tenant_id", "created_at"]),
            models.Index(fields=["feature_id", "created_at"]),
            models.Index(fields=["action", "created_at"]),
        ]
    
    def __str__(self):
        return f"{self.action} - {self.tenant_id} / {self.feature_id} ({self.created_at})"


# --- Phase 11: Migration Audit (PUBLIC schema) -------------------------------
class TenantMigrationAudit(models.Model):
    """Audit trail for per-school migrations from monolith -> tenant schema.

    Records checkpoints, tables migrated, row counts, validation results and
    rollback actions. Stored in PUBLIC schema to remain available to
    super-admin reporting and compliance.
    """

    STATUS_CHOICES = [
        ("started", "Started"),
        ("in_progress", "In Progress"),
        ("completed", "Completed"),
        ("failed", "Failed"),
        ("rolled_back", "Rolled Back"),
        ("validated", "Validated"),
    ]

    school_id = models.IntegerField(db_index=True)
    tenant_id = models.CharField(max_length=32, null=True, blank=True, db_index=True)
    schema_name = models.CharField(max_length=64, null=True, blank=True, db_index=True)

    status = models.CharField(max_length=24, choices=STATUS_CHOICES, default="started", db_index=True)
    started_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True, blank=True)

    # Checkpoint / resumable state
    checkpoint = models.CharField(max_length=256, blank=True, help_text="Last completed table or step")

    # Details per table: {"table_name": {"rows": 123, "migrated": true}}
    tables = models.JSONField(default=dict, blank=True)

    # Validation summary and errors
    validation = models.JSONField(default=dict, blank=True)
    error = models.TextField(null=True, blank=True)

    # Actor info
    actor_user_id = models.IntegerField(null=True, blank=True)
    actor_username = models.CharField(max_length=256, blank=True)
    actor_ip = models.GenericIPAddressField(null=True, blank=True)

    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "tenant_migration_audit"
        indexes = [
            models.Index(fields=["school_id", "started_at"]),
            models.Index(fields=["tenant_id", "started_at"]),
            models.Index(fields=["status", "started_at"]),
        ]

    def __str__(self):
        return f"Migration {self.school_id} -> {self.schema_name or self.tenant_id} ({self.status})"


class SuperAdminInvoice(models.Model):
    """Invoice model for platform-level SaaS billing in public schema."""

    STATUS_CHOICES = [
        ("draft", "Draft"),
        ("sent", "Sent"),
        ("paid", "Paid"),
        ("overdue", "Overdue"),
        ("cancelled", "Cancelled"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice_number = models.CharField(max_length=64, unique=True, db_index=True)
    tenant = models.ForeignKey(
        SchoolTenant,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="platform_invoices",
    )
    school_name = models.CharField(max_length=255)
    invoice_date = models.DateField(db_index=True)
    due_date = models.DateField(db_index=True)
    status = models.CharField(max_length=16, choices=STATUS_CHOICES, default="draft", db_index=True)

    seller_name = models.CharField(max_length=255)
    seller_gstin = models.CharField(max_length=32, blank=True)
    seller_state = models.CharField(max_length=64, blank=True)

    buyer_name = models.CharField(max_length=255)
    buyer_gstin = models.CharField(max_length=32, blank=True)
    buyer_state = models.CharField(max_length=64, blank=True)

    line_items = models.JSONField(default=list, blank=True)
    tax_breakdown = models.JSONField(default=dict, blank=True)
    notes = models.TextField(blank=True)
    terms_conditions = models.TextField(blank=True)
    reverse_charge = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "super_admin_invoices"
        indexes = [
            models.Index(fields=["status", "invoice_date"]),
            models.Index(fields=["invoice_date", "due_date"]),
        ]

    def __str__(self):
        return f"{self.invoice_number} ({self.school_name})"


class SubscriptionPlan(models.Model):
    """Catalog of subscription plans available on the platform.

    Used by the Super Admin → Billing screen to show pricing cards and
    auto-populate invoice line items. GST 18% under SAC 998313 is added
    on top of `price_inr` at invoice time (not stored here).
    """

    BILLING_CYCLE_CHOICES = [
        ("monthly", "Monthly"),
        ("yearly", "Yearly"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    code = models.SlugField(max_length=64, unique=True, db_index=True)
    name = models.CharField(max_length=128)
    description = models.TextField(blank=True)
    price_inr = models.DecimalField(max_digits=12, decimal_places=2)
    billing_cycle = models.CharField(
        max_length=16,
        choices=BILLING_CYCLE_CHOICES,
        default="monthly",
    )
    popular = models.BooleanField(default=False)
    features = models.JSONField(default=list, blank=True)
    is_active = models.BooleanField(default=True, db_index=True)
    sort_order = models.PositiveIntegerField(default=0, db_index=True)
    sac_code = models.CharField(max_length=16, default='998313', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "subscription_plans"
        ordering = ["sort_order", "price_inr", "name"]

    def __str__(self):
        return f"{self.name} (₹{self.price_inr})"


class SuperAdminPolicy(models.Model):
    """Global policy registry for platform-level controls."""

    VALUE_TYPE_CHOICES = [
        ("string", "String"),
        ("number", "Number"),
        ("boolean", "Boolean"),
    ]

    CATEGORY_CHOICES = [
        ("security", "Security"),
        ("data_isolation", "Data Isolation"),
        ("billing", "Billing"),
        ("system", "System"),
    ]

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    key = models.CharField(max_length=128, unique=True, db_index=True)
    category = models.CharField(max_length=32, choices=CATEGORY_CHOICES, db_index=True)
    description = models.TextField(blank=True)
    value = models.JSONField(default=dict)
    value_type = models.CharField(max_length=16, choices=VALUE_TYPE_CHOICES, default="string")
    is_toggle = models.BooleanField(default=False)
    is_overridable = models.BooleanField(default=False)
    default_value = models.JSONField(default=dict, blank=True)
    version = models.PositiveIntegerField(default=1)
    updated_by = models.CharField(max_length=150, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "super_admin_policies"

    def __str__(self):
        return self.key


class SuperAdminFeatureToggle(models.Model):
    """Feature toggles stored per tenant for super-admin controls."""

    tenant = models.ForeignKey(
        SchoolTenant,
        on_delete=models.CASCADE,
        related_name="super_admin_feature_toggles",
    )
    key = models.CharField(max_length=128)
    enabled = models.BooleanField(default=True)
    config = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    updated_by = models.CharField(max_length=150, blank=True)

    class Meta:
        db_table = "super_admin_feature_toggles"
        unique_together = (("tenant", "key"),)
        indexes = [
            models.Index(fields=["tenant", "key"]),
        ]

    def __str__(self):
        return f"{self.tenant_id}:{self.key}={self.enabled}"
