from __future__ import annotations

from rest_framework import serializers

from apps.tenancy.models import (
    SchoolTenant,
    SuperAdminFeatureToggle,
    SuperAdminInvoice,
    SuperAdminPolicy,
    TenantAuditLog,
)


class SchoolTenantSerializer(serializers.ModelSerializer):
    students = serializers.IntegerField(source="student_count", read_only=True)
    staff = serializers.IntegerField(source="staff_count", read_only=True)
    lastActivity = serializers.DateTimeField(source="last_activity_at", read_only=True)

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
            "udise_code",
            "pan",
            "students",
            "staff",
            "seats",
            "lastActivity",
        ]


class ProvisionSchoolSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=255)
    subdomain_url = serializers.CharField(max_length=128)
    state = serializers.CharField(max_length=64)
    board = serializers.CharField(max_length=32)
    plan = serializers.ChoiceField(choices=["trial", "premium", "enterprise", "custom"])
    shard_region = serializers.CharField(max_length=64, required=False, allow_blank=True)
    storage_region = serializers.CharField(max_length=64, required=False, allow_blank=True)
    backup_retention = serializers.IntegerField(required=False, min_value=1)
    sso_method = serializers.CharField(max_length=64, required=False, allow_blank=True)


class SchoolTenantUpdateSerializer(serializers.Serializer):
    plan = serializers.ChoiceField(choices=["trial", "premium", "enterprise", "custom"], required=False)
    status = serializers.ChoiceField(choices=["onboarding", "active", "trial", "suspended", "archived"], required=False)
    api_access = serializers.BooleanField(required=False)
    board = serializers.CharField(max_length=32, required=False)
    state = serializers.CharField(max_length=64, required=False)
    region = serializers.CharField(max_length=32, required=False)
    gstin = serializers.CharField(max_length=32, required=False, allow_blank=True)
    udise_code = serializers.CharField(max_length=32, required=False, allow_blank=True)
    pan = serializers.CharField(max_length=32, required=False, allow_blank=True)
    seats = serializers.IntegerField(required=False, min_value=0)
    student_count = serializers.IntegerField(required=False, min_value=0)
    staff_count = serializers.IntegerField(required=False, min_value=0)


class InvoiceSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    tenant_id = serializers.CharField(source="tenant.tenant_id", allow_null=True, required=False)
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


class InvoiceCreateSerializer(serializers.Serializer):
    tenant_id = serializers.CharField(required=False, allow_blank=True)
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
    notes = serializers.CharField(required=False, allow_blank=True)
    terms_conditions = serializers.CharField(required=False, allow_blank=True)


class AuditEventSerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)
    timestamp = serializers.DateTimeField(source="created_at", read_only=True)
    actor = serializers.SerializerMethodField()
    detail = serializers.SerializerMethodField()
    severity = serializers.SerializerMethodField()

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
            "status",
            "error_message",
        ]

    def get_actor(self, obj):
        return obj.actor_username or "system"

    def get_detail(self, obj):
        details = obj.details or {}
        if isinstance(details, dict) and details:
            if "message" in details:
                return str(details["message"])
            return ", ".join(f"{k}={v}" for k, v in list(details.items())[:3])
        return obj.action

    def get_severity(self, obj):
        if obj.status == "failed":
            return "critical"
        if obj.status == "partial":
            return "warning"
        return "info"


class PolicySerializer(serializers.ModelSerializer):
    id = serializers.CharField(read_only=True)

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
        ]


class FeatureToggleSerializer(serializers.ModelSerializer):
    class Meta:
        model = SuperAdminFeatureToggle
        fields = ["id", "key", "enabled", "config", "updated_by", "updated_at"]
