"""Serializers for the Super Admin Console APIs.

These serializers mirror the Sprint 0 TypeScript contracts used by the
frontend super-admin screens.
"""

from __future__ import annotations

from collections import OrderedDict

from rest_framework import serializers

from django.utils.text import slugify

from apps.tenancy.models import (
    SchoolTenant,
    SubscriptionPlan,
    SuperAdminInvoice,
    SuperAdminPolicy,
    TenantAuditLog,
)


POLICY_GROUP_METADATA = OrderedDict(
    [
        ("security", {"label": "Security", "description": "Security and authentication policies."}),
        ("data_isolation", {"label": "Data Isolation", "description": "Cross-tenant isolation and audit rules."}),
        ("billing", {"label": "Billing", "description": "Tax, invoicing, and collections policies."}),
        ("system", {"label": "System", "description": "Operational and platform settings."}),
    ]
)


class MrrDataSerializer(serializers.Serializer):
    current = serializers.FloatField()
    previous = serializers.FloatField()
    trend = serializers.FloatField()


class BoardBreakdownSerializer(serializers.Serializer):
    board = serializers.CharField()
    count = serializers.IntegerField()
    percent = serializers.FloatField()


class TrendDataSerializer(serializers.Serializer):
    students = serializers.FloatField()
    mrr = serializers.FloatField()


class RecentActivityEventSerializer(serializers.Serializer):
    id = serializers.CharField()
    timestamp = serializers.DateTimeField()
    actor = serializers.CharField()
    action = serializers.CharField()
    detail = serializers.CharField()
    severity = serializers.ChoiceField(choices=["info", "warning", "error"])
    tenantId = serializers.CharField(required=False, allow_null=True)
    schoolName = serializers.CharField(required=False, allow_null=True)


class DashboardDataSerializer(serializers.Serializer):
    totalSchools = serializers.IntegerField()
    activeSchools = serializers.IntegerField()
    totalStudents = serializers.IntegerField()
    activeStudents = serializers.IntegerField(default=0)
    inactiveStudents = serializers.IntegerField(default=0)
    totalStaff = serializers.IntegerField()
    mrr = MrrDataSerializer()
    alertCount = serializers.IntegerField()
    overdueCount = serializers.IntegerField(default=0)
    blockedCount = serializers.IntegerField(default=0)
    boardBreakdown = BoardBreakdownSerializer(many=True)
    trends = TrendDataSerializer()
    recentEvents = RecentActivityEventSerializer(many=True, required=False)
    stateBreakdown = serializers.ListField(child=serializers.DictField(), required=False, default=list)
    planBreakdown = serializers.ListField(child=serializers.DictField(), required=False, default=list)


class SchoolTenantBaseSerializer(serializers.ModelSerializer):
    students = serializers.SerializerMethodField()
    activeStudents = serializers.SerializerMethodField()
    staff = serializers.SerializerMethodField()
    lastActivity = serializers.DateTimeField(source="last_activity_at", read_only=True, allow_null=True)
    udiseCode = serializers.CharField(source="udise_code", required=False, allow_blank=True, allow_null=True)

    def get_students(self, obj):
        v = getattr(obj, "live_student_count", None)
        return v if v is not None else (obj.student_count or 0)

    def get_activeStudents(self, obj):
        v = getattr(obj, "live_active_student_count", None)
        return v if v is not None else 0

    def get_staff(self, obj):
        v = getattr(obj, "live_staff_count", None)
        return v if v is not None else (obj.staff_count or 0)

    class Meta:
        model = SchoolTenant
        fields = [
            "tenant_id",
            "name",
            "short_code",
            "subdomain_url",
            "shard_region",
            "storage_region",
            "backup_retention",
            "sso_method",
            "api_access",
            "plan",
            "status",
            "provisioned_at",
            "board",
            "state",
            "region",
            "gstin",
            "udiseCode",
            "pan",
            "students",
            "activeStudents",
            "seats",
            "staff",
            "lastActivity",
            "principal_name",
            "principal_email",
            "principal_phone",
            "campus_address",
            "city",
            "pin_code",
            "affiliation_number",
        ]
        read_only_fields = ["tenant_id"]


class SchoolTenantListSerializer(SchoolTenantBaseSerializer):
    pass


class SchoolTenantDetailSerializer(SchoolTenantBaseSerializer):
    schema_name = serializers.CharField(read_only=True)

    class Meta(SchoolTenantBaseSerializer.Meta):
        fields = SchoolTenantBaseSerializer.Meta.fields + ["schema_name"]
        read_only_fields = SchoolTenantBaseSerializer.Meta.read_only_fields + ["schema_name"]


class SchoolTenantUpdateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SchoolTenant
        fields = [
            "name",
            "short_code",
            "subdomain_url",
            "shard_region",
            "storage_region",
            "backup_retention",
            "sso_method",
            "api_access",
            "plan",
            "status",
            "board",
            "state",
            "region",
            "gstin",
            "udise_code",
            "pan",
            "seats",
            "student_count",
            "staff_count",
            "last_activity_at",
            "principal_name",
            "principal_email",
            "principal_phone",
            "campus_address",
            "city",
            "pin_code",
            "affiliation_number",
        ]

    def validate_gstin(self, value):
        import re
        if not value:
            return value
        pattern = r'^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$'
        if not re.match(pattern, value):
            raise serializers.ValidationError(
                "Invalid GSTIN format. Must be 15 characters, e.g. 27AABCU9603R1ZX"
            )
        return value

    def validate_pan(self, value):
        import re
        if not value:
            return value
        if not re.match(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$', value):
            raise serializers.ValidationError(
                "Invalid PAN format. Must be 10 characters, e.g. AABCU9603R"
            )
        return value

    _VALID_STATUSES = {"active", "suspended", "archived", "pending", "onboarding", "provisioning"}

    def validate_status(self, value):
        if value and value not in self._VALID_STATUSES:
            raise serializers.ValidationError(
                f"Invalid status '{value}'. Must be one of: "
                + ", ".join(sorted(self._VALID_STATUSES))
            )
        return value


class ProvisionSchoolRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    subdomain_url = serializers.CharField(max_length=128)
    state = serializers.CharField(max_length=64)
    board = serializers.ChoiceField(choices=["CBSE", "SSC_AP", "ICSE", "SSC_TG", "OTHER"])
    plan = serializers.CharField(max_length=32)

    def validate_plan(self, value):
        from apps.tenancy.models import SubscriptionPlan
        valid_codes = set(SubscriptionPlan.objects.values_list('code', flat=True))
        valid_codes.update(['trial', 'custom'])
        if value and value not in valid_codes:
            raise serializers.ValidationError(
                f'"{value}" is not a valid plan. Valid options: {', '.join(sorted(valid_codes))}'
            )
        return value
    shard_region = serializers.CharField(max_length=64, required=False, allow_blank=True)
    storage_region = serializers.CharField(max_length=64, required=False, allow_blank=True)
    backup_retention = serializers.IntegerField(required=False, default=30, min_value=1)
    sso_method = serializers.CharField(max_length=64, required=False, default="native")
    short_code = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    gstin = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    pan = serializers.CharField(max_length=10, required=False, allow_blank=True, default="")
    udise_code = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    seats = serializers.IntegerField(required=False, allow_null=True, default=0)
    brand_color = serializers.CharField(max_length=32, required=False, allow_blank=True, default="")
    logo_url = serializers.CharField(max_length=512, required=False, allow_blank=True, default="")
    # Contact & address
    principal_name = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")
    principal_email = serializers.EmailField(max_length=128, required=False, allow_blank=True, default="")
    principal_phone = serializers.CharField(max_length=20, required=False, allow_blank=True, default="")
    campus_address = serializers.CharField(required=False, allow_blank=True, default="")
    city = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    pin_code = serializers.CharField(max_length=6, required=False, allow_blank=True, default="")
    # Board affiliation
    affiliation_number = serializers.CharField(max_length=64, required=False, allow_blank=True, default="")
    # Optional admin credentials — auto-generated if omitted
    admin_username = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")
    admin_password = serializers.CharField(max_length=128, required=False, allow_blank=True, default="")


class ProvisionSchoolResponseSerializer(serializers.Serializer):
    tenant_id = serializers.CharField()
    status = serializers.CharField()
    message = serializers.CharField(required=False)
    # ERP school + admin credentials returned after provisioning
    school_id = serializers.IntegerField(required=False, allow_null=True)
    admin_username = serializers.CharField(required=False, allow_null=True)
    admin_password = serializers.CharField(required=False, allow_null=True)


class InvoiceLineItemSerializer(serializers.Serializer):
    description = serializers.CharField()
    quantity = serializers.IntegerField()
    unit_price = serializers.FloatField()
    sac_code = serializers.CharField()
    amount = serializers.FloatField()
    gst_percent = serializers.FloatField(required=False, allow_null=True)
    gst_amount = serializers.FloatField(required=False, allow_null=True)


class TaxBreakdownSerializer(serializers.Serializer):
    subtotal = serializers.FloatField()
    igst = serializers.FloatField(required=False, allow_null=True)
    cgst = serializers.FloatField(required=False, allow_null=True)
    sgst = serializers.FloatField(required=False, allow_null=True)
    total_tax = serializers.FloatField()
    grand_total = serializers.FloatField()
    amount_in_words = serializers.CharField()


class InvoiceSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    tenant_id = serializers.SerializerMethodField()
    line_items = serializers.JSONField()
    tax_breakdown = serializers.JSONField()

    class Meta:
        model = SuperAdminInvoice
        fields = [
            "id",
            "invoice_number",
            "school_name",
            "tenant_id",
            "invoice_date",
            "due_date",
            "status",
            "seller_name",
            "seller_gstin",
            "seller_state",
            "buyer_name",
            "buyer_gstin",
            "buyer_state",
            "line_items",
            "tax_breakdown",
            "notes",
            "terms_conditions",
            "reverse_charge",
            "created_at",
            "updated_at",
        ]

    def get_tenant_id(self, obj):
        return obj.tenant.tenant_id if obj.tenant_id and obj.tenant else ""


class InvoiceCreateSerializer(serializers.Serializer):
    tenant_id = serializers.CharField(required=False, allow_blank=True)
    invoice_number = serializers.CharField(required=False, allow_blank=True)
    school_name = serializers.CharField(max_length=255)
    invoice_date = serializers.DateField()
    due_date = serializers.DateField()
    status = serializers.ChoiceField(choices=["draft", "sent", "paid", "overdue", "cancelled"], required=False)
    seller_name = serializers.CharField(max_length=255)
    seller_gstin = serializers.CharField(max_length=32, required=False, allow_blank=True)
    seller_state = serializers.CharField(max_length=64)
    buyer_name = serializers.CharField(max_length=255)
    buyer_gstin = serializers.CharField(max_length=32, required=False, allow_blank=True)
    buyer_state = serializers.CharField(max_length=64)
    line_items = serializers.ListField(child=serializers.DictField(), allow_empty=False)
    tax_breakdown = serializers.DictField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    terms_conditions = serializers.CharField(required=False, allow_blank=True)
    reverse_charge = serializers.BooleanField(required=False, default=False)

    def validate(self, data):
        if data.get("due_date") and data.get("invoice_date"):
            if data["due_date"] < data["invoice_date"]:
                raise serializers.ValidationError(
                    {"due_date": "Due date cannot be before the invoice date."}
                )
        return data


class InvoiceUpdateSerializer(serializers.Serializer):
    """Partial update for an existing invoice.

    Intentionally restricted to fields that do not change GST-relevant amounts.
    To correct amounts/line items, cancel the invoice and re-issue (standard
    GST-compliant practice).
    """

    status = serializers.ChoiceField(
        choices=["draft", "sent", "paid", "overdue", "cancelled"], required=False
    )
    due_date = serializers.DateField(required=False)
    notes = serializers.CharField(required=False, allow_blank=True)
    terms_conditions = serializers.CharField(required=False, allow_blank=True)


class SubscriptionPlanSerializer(serializers.ModelSerializer):
    price_inr = serializers.FloatField()

    class Meta:
        model = SubscriptionPlan
        fields = [
            "code",
            "name",
            "description",
            "price_inr",
            "billing_cycle",
            "popular",
            "features",
            "is_active",
            "sort_order",
            "sac_code",
        ]


class SubscriptionPlanCreateSerializer(serializers.Serializer):
    code = serializers.SlugField(max_length=64, required=False, allow_blank=True)
    name = serializers.CharField(max_length=128)
    description = serializers.CharField(required=False, allow_blank=True)
    price_inr = serializers.DecimalField(max_digits=12, decimal_places=2, min_value=0)
    billing_cycle = serializers.ChoiceField(
        choices=[("monthly", "Monthly"), ("yearly", "Yearly")],
        default="monthly",
    )
    popular = serializers.BooleanField(required=False, default=False)
    features = serializers.ListField(
        child=serializers.CharField(allow_blank=False, max_length=255),
        required=False,
        default=list,
    )
    sort_order = serializers.IntegerField(required=False, min_value=0, default=0)
    is_active = serializers.BooleanField(required=False, default=True)
    sac_code = serializers.CharField(max_length=16, required=False, default='998313', allow_blank=True)

    def validate(self, attrs):
        code = (attrs.get("code") or "").strip()
        if not code:
            code = slugify(attrs["name"])[:64]
        if not code:
            raise serializers.ValidationError({"code": "Unable to derive plan code from name."})
        if SubscriptionPlan.objects.filter(code=code).exists():
            raise serializers.ValidationError({"code": f"Plan code '{code}' already exists."})
        attrs["code"] = code
        return attrs


class SubscriptionPlanUpdateSerializer(serializers.Serializer):
    """Partial update for an existing subscription plan. Code is immutable."""

    name = serializers.CharField(max_length=128, required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    price_inr = serializers.DecimalField(
        max_digits=12, decimal_places=2, min_value=0, required=False
    )
    billing_cycle = serializers.ChoiceField(
        choices=[("monthly", "Monthly"), ("yearly", "Yearly")], required=False
    )
    popular = serializers.BooleanField(required=False)
    features = serializers.ListField(
        child=serializers.CharField(allow_blank=False, max_length=255),
        required=False,
    )
    sort_order = serializers.IntegerField(required=False, min_value=0)
    is_active = serializers.BooleanField(required=False)
    sac_code = serializers.CharField(max_length=16, required=False, allow_blank=True)


class BillingMrrSerializer(serializers.Serializer):
    current_mrr = serializers.FloatField()
    previous_mrr = serializers.FloatField()
    gst_collected = serializers.FloatField()
    outstanding_amount = serializers.FloatField()
    at_risk_amount = serializers.FloatField()
    trend_percent = serializers.FloatField()


class BillingMetricsSerializer(serializers.Serializer):
    mrr = BillingMrrSerializer()
    invoices = serializers.DictField()
    collections = serializers.DictField()
    status = serializers.CharField()


class AuditEventSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    timestamp = serializers.DateTimeField(source="created_at", read_only=True)
    actor = serializers.SerializerMethodField()
    detail = serializers.SerializerMethodField()
    severity = serializers.SerializerMethodField()
    school_name = serializers.SerializerMethodField()
    affected_fields = serializers.SerializerMethodField()
    before_values = serializers.SerializerMethodField()
    after_values = serializers.SerializerMethodField()

    class Meta:
        model = TenantAuditLog
        fields = [
            "id",
            "timestamp",
            "actor",
            "actor_ip",
            "action",
            "detail",
            "severity",
            "tenant_id",
            "school_name",
            "affected_fields",
            "before_values",
            "after_values",
            "status",
            "error_message",
        ]

    def _details(self, obj):
        details = obj.details or {}
        return details if isinstance(details, dict) else {}

    def get_actor(self, obj):
        return obj.actor_username or "System"

    def get_detail(self, obj):
        details = self._details(obj)
        if details.get("message"):
            return str(details["message"])
        if details.get("detail"):
            return str(details["detail"])
        if details:
            return ", ".join(f"{key}={value}" for key, value in list(details.items())[:3])
        return obj.action

    def get_severity(self, obj):
        if obj.status == "failed":
            return "error"
        if obj.status == "partial":
            return "warning"
        return "info"

    def get_school_name(self, obj):
        details = self._details(obj)
        if details.get("school_name"):
            return details["school_name"]
        if obj.tenant_id:
            tenant = SchoolTenant.objects.using("default").filter(tenant_id=obj.tenant_id).only("name").first()
            return tenant.name if tenant else None
        return None

    def get_affected_fields(self, obj):
        details = self._details(obj)
        return details.get("affected_fields") or []

    def get_before_values(self, obj):
        details = self._details(obj)
        return details.get("before_values") or {}

    def get_after_values(self, obj):
        details = self._details(obj)
        return details.get("after_values") or {}


class PolicySerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    value = serializers.JSONField()
    default_value = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = SuperAdminPolicy
        fields = [
            "id",
            "key",
            "category",
            "description",
            "value",
            "value_type",
            "is_toggle",
            "is_overridable",
            "default_value",
            "created_at",
            "updated_at",
            "updated_by",
            "version",
        ]


class PolicyGroupSerializer(serializers.Serializer):
    category = serializers.CharField()
    label = serializers.CharField()
    description = serializers.CharField()
    policies = PolicySerializer(many=True)


class PolicySettingsSerializer(serializers.Serializer):
    system = serializers.DictField()
    notification = serializers.DictField()
    integrations = serializers.DictField()
    storage = serializers.DictField()
    api = serializers.DictField()
