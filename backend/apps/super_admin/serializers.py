"""Serializers for the Super Admin Console APIs.

These serializers mirror the Sprint 0 TypeScript contracts used by the
frontend super-admin screens.
"""

from __future__ import annotations

from collections import OrderedDict

from rest_framework import serializers

from apps.tenancy.models import SchoolTenant, SuperAdminInvoice, SuperAdminPolicy, TenantAuditLog


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
    students = serializers.IntegerField(source="student_count", read_only=True)
    staff = serializers.IntegerField(source="staff_count", read_only=True)
    lastActivity = serializers.DateTimeField(source="last_activity_at", read_only=True, allow_null=True)
    udiseCode = serializers.CharField(source="udise_code", required=False, allow_blank=True, allow_null=True)

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
            "seats",
            "staff",
            "lastActivity",
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
        ]


class ProvisionSchoolRequestSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    subdomain_url = serializers.CharField(max_length=128)
    state = serializers.CharField(max_length=64)
    board = serializers.ChoiceField(choices=["CBSE", "SSC_AP", "ICSE", "SSC_TG", "OTHER"])
    plan = serializers.ChoiceField(choices=["trial", "premium", "enterprise", "custom"])
    shard_region = serializers.CharField(max_length=64, required=False, allow_blank=True)
    storage_region = serializers.CharField(max_length=64, required=False, allow_blank=True)
    backup_retention = serializers.IntegerField(required=False, default=30, min_value=1)
    sso_method = serializers.CharField(max_length=64, required=False, default="native")
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
