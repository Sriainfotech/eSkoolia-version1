"""Super Admin Console API views.

All endpoints are public-schema only and protected by IsSuperAdmin.
Tenant users must receive 403 responses.
"""

from __future__ import annotations

import csv
import io
import json
import secrets
import string
from collections import OrderedDict
from decimal import Decimal
from uuid import uuid4

import yaml
from django.conf import settings
from django.contrib.auth import get_user_model
from django.db import transaction
from django.db.models import Count, Q, Sum
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.access_control.permission_classes import IsSuperAdmin
from apps.hr.models import Staff
from apps.students.models import Student
from apps.tenancy.audit import log_audit
from apps.tenancy.models import School, SchoolTenant, SuperAdminInvoice, SuperAdminPolicy, TenantAuditLog
from apps.tenancy.super_admin.utils import build_invoice_number, current_month_range, previous_month_range, to_money

from .serializers import (
    AuditEventSerializer,
    BillingMrrSerializer,
    DashboardDataSerializer,
    InvoiceCreateSerializer,
    InvoiceSerializer,
    POLICY_GROUP_METADATA,
    PolicyGroupSerializer,
    PolicySettingsSerializer,
    PolicySerializer,
    ProvisionSchoolRequestSerializer,
    ProvisionSchoolResponseSerializer,
    SchoolTenantDetailSerializer,
    SchoolTenantListSerializer,
    SchoolTenantUpdateSerializer,
)


DEFAULT_POLICY_ROWS = [
    {
        "key": "password.min_length",
        "category": "security",
        "description": "Minimum password length for super-admin and platform accounts.",
        "value": 10,
        "value_type": "number",
        "is_toggle": False,
        "is_overridable": False,
        "default_value": 10,
        "updated_by": "system",
    },
    {
        "key": "session.timeout_minutes",
        "category": "security",
        "description": "Session timeout before re-authentication is required.",
        "value": 30,
        "value_type": "number",
        "is_toggle": False,
        "is_overridable": False,
        "default_value": 30,
        "updated_by": "system",
    },
    {
        "key": "mfa.required",
        "category": "security",
        "description": "Require MFA for super-admin accounts.",
        "value": True,
        "value_type": "boolean",
        "is_toggle": True,
        "is_overridable": False,
        "default_value": True,
        "updated_by": "system",
    },
    {
        "key": "tenant.public_schema_only",
        "category": "data_isolation",
        "description": "Super-admin APIs are restricted to the public schema.",
        "value": True,
        "value_type": "boolean",
        "is_toggle": True,
        "is_overridable": False,
        "default_value": True,
        "updated_by": "system",
    },
    {
        "key": "audit.retention_days",
        "category": "data_isolation",
        "description": "Audit log retention window in days.",
        "value": 365,
        "value_type": "number",
        "is_toggle": False,
        "is_overridable": False,
        "default_value": 365,
        "updated_by": "system",
    },
    {
        "key": "gst.rate_percent",
        "category": "billing",
        "description": "Default GST rate used for billing calculations.",
        "value": 18,
        "value_type": "number",
        "is_toggle": False,
        "is_overridable": True,
        "default_value": 18,
        "updated_by": "system",
    },
    {
        "key": "invoice.payment_terms_days",
        "category": "billing",
        "description": "Payment due window for issued invoices.",
        "value": 15,
        "value_type": "number",
        "is_toggle": False,
        "is_overridable": True,
        "default_value": 15,
        "updated_by": "system",
    },
    {
        "key": "backup.retention_days",
        "category": "system",
        "description": "Daily backup retention window.",
        "value": 30,
        "value_type": "number",
        "is_toggle": False,
        "is_overridable": True,
        "default_value": 30,
        "updated_by": "system",
    },
    {
        "key": "multi_tenancy.enabled",
        "category": "system",
        "description": "Controls whether schema-based multi-tenancy is enabled.",
        "value": False,
        "value_type": "boolean",
        "is_toggle": True,
        "is_overridable": False,
        "default_value": False,
        "updated_by": "system",
    },
]


class SuperAdminPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


class SuperAdminBaseAPIView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]

    def _public_queryset(self, model):
        return model.objects.using("default").all()

    def _client_ip(self, request):
        forwarded = request.META.get("HTTP_X_FORWARDED_FOR")
        if forwarded:
            return forwarded.split(",")[0].strip()
        return request.META.get("REMOTE_ADDR", "")

    def _paginate(self, request, queryset, serializer_class):
        paginator = SuperAdminPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        serializer = serializer_class(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def _normalize_school_payload(self, payload):
        if not isinstance(payload, dict):
            return payload

        normalized = dict(payload)
        aliases = {
            "udiseCode": "udise_code",
            "shortCode": "short_code",
            "subdomainUrl": "subdomain_url",
            "shardRegion": "shard_region",
            "storageRegion": "storage_region",
            "backupRetention": "backup_retention",
            "ssoMethod": "sso_method",
        }
        for alias, canonical in aliases.items():
            if alias in normalized and canonical not in normalized:
                normalized[canonical] = normalized[alias]
        return normalized


def _safe_float(value) -> float:
    if value is None:
        return 0.0
    return float(Decimal(str(value)))


def _invoice_grand_total(invoice: SuperAdminInvoice) -> float:
    tax_breakdown = invoice.tax_breakdown or {}
    if isinstance(tax_breakdown, dict) and tax_breakdown.get("grand_total") is not None:
        return _safe_float(tax_breakdown.get("grand_total"))

    subtotal = _safe_float(tax_breakdown.get("subtotal"))
    total_tax = _safe_float(tax_breakdown.get("total_tax"))
    return subtotal + total_tax


def _invoice_tax_total(invoice: SuperAdminInvoice) -> float:
    tax_breakdown = invoice.tax_breakdown or {}
    if isinstance(tax_breakdown, dict) and tax_breakdown.get("total_tax") is not None:
        return _safe_float(tax_breakdown.get("total_tax"))

    subtotal = _safe_float(tax_breakdown.get("subtotal"))
    grand_total = _invoice_grand_total(invoice)
    return max(grand_total - subtotal, 0.0)


def _money_words(value: float) -> str:
    return f"{value:.2f} INR"


def _schema_name_for(subdomain_url: str) -> str:
    cleaned = "".join(character.lower() if character.isalnum() else "_" for character in subdomain_url)
    cleaned = cleaned.strip("_") or "school"
    return f"school_{cleaned}"[:63]


def _gen_admin_password(length: int = 14) -> str:
    """Generate a cryptographically secure password meeting basic complexity."""
    alphabet = string.ascii_letters + string.digits + "!@#$%"
    while True:
        pwd = "".join(secrets.choice(alphabet) for _ in range(length))
        if (any(c.islower() for c in pwd)
                and any(c.isupper() for c in pwd)
                and any(c.isdigit() for c in pwd)
                and any(c in "!@#$%" for c in pwd)):
            return pwd


def _safe_school_code(subdomain: str, length: int = 32) -> str:
    """Derive a unique-safe school code from the subdomain."""
    code = subdomain.upper().replace("-", "_").replace(".", "_")
    # Keep only alphanumeric + underscore
    code = "".join(c if c.isalnum() or c == "_" else "_" for c in code)
    return code[:length]


def _ensure_default_policies():
    for row in DEFAULT_POLICY_ROWS:
        SuperAdminPolicy.objects.using("default").update_or_create(
            key=row["key"],
            defaults=row,
        )


def _policy_groups():
    _ensure_default_policies()
    policies = list(SuperAdminPolicy.objects.using("default").all().order_by("category", "key"))
    grouped = []
    for category, metadata in POLICY_GROUP_METADATA.items():
        grouped.append(
            {
                "category": category,
                "label": metadata["label"],
                "description": metadata["description"],
                "policies": [policy for policy in policies if policy.category == category],
            }
        )
    return grouped


class DashboardKPIView(SuperAdminBaseAPIView):
    def get(self, request):
        tenants = self._public_queryset(SchoolTenant)
        invoices = self._public_queryset(SuperAdminInvoice).exclude(status="cancelled")

        total_schools = tenants.count()
        active_schools = tenants.exclude(status__in=["suspended", "archived", "pending"]).count()
        total_students = Student.objects.using("default").filter(status="active").count()
        total_staff = Staff.objects.using("default").filter(status="active").count()

        current_start, current_end = current_month_range()
        previous_start, previous_end = previous_month_range()

        current_month_invoices = invoices.filter(invoice_date__gte=current_start, invoice_date__lt=current_end)
        previous_month_invoices = invoices.filter(invoice_date__gte=previous_start, invoice_date__lt=previous_end)

        current_mrr = sum(_invoice_grand_total(invoice) for invoice in current_month_invoices)
        previous_mrr = sum(_invoice_grand_total(invoice) for invoice in previous_month_invoices)
        mrr_trend = 0.0
        if previous_mrr:
            mrr_trend = round(((current_mrr - previous_mrr) / previous_mrr) * 100, 2)

        board_breakdown = []
        for row in tenants.values("board").annotate(count=Count("id")).order_by("board"):
            board_count = row.get("count") or 0
            board_breakdown.append(
                {
                    "board": row.get("board") or "OTHER",
                    "count": board_count,
                    "percent": round((board_count / total_schools) * 100, 2) if total_schools else 0,
                }
            )

        overdue_invoices = invoices.filter(status="overdue").count()
        blocked_tenants = tenants.filter(status__in=["suspended", "archived"]).count()

        recent_events = []
        for log in self._public_queryset(TenantAuditLog).order_by("-created_at")[:10]:
            details = log.details if isinstance(log.details, dict) else {}
            recent_events.append(
                {
                    "id": str(log.id),
                    "timestamp": log.created_at,
                    "actor": log.actor_username or "System",
                    "action": log.action,
                    "detail": details.get("message") or log.action,
                    "severity": "error" if log.status == "failed" else ("warning" if log.status == "partial" else "info"),
                    "tenantId": log.tenant_id,
                    "schoolName": details.get("school_name") or self._school_name_for_tenant(log.tenant_id),
                }
            )

        _STATE_NAMES = {
            '36': 'Telangana', '37': 'Andhra Pradesh', '29': 'Karnataka',
            '33': 'Tamil Nadu', '27': 'Maharashtra', '07': 'Delhi',
            '24': 'Gujarat', '32': 'Kerala', '19': 'West Bengal', '09': 'Uttar Pradesh',
        }
        _PLAN_PRICING = {
            'starter': 4500, 'standard': 9000, 'premium': 19500,
            'enterprise': 34500, 'trial': 0, 'custom': 0,
        }

        state_breakdown = []
        for row in tenants.values("state").annotate(
            count=Count("id"), students=Sum("student_count")
        ).order_by("-count"):
            code = (row.get("state") or "").strip()
            state_breakdown.append({
                "state": _STATE_NAMES.get(code, code) if code else "Unknown",
                "code": code,
                "count": row.get("count") or 0,
                "students": row.get("students") or 0,
            })

        plan_breakdown = []
        for row in tenants.values("plan").annotate(
            count=Count("id"), students=Sum("student_count")
        ).order_by("-count"):
            plan_key = (row.get("plan") or "trial").lower()
            plan_count = row.get("count") or 0
            plan_breakdown.append({
                "plan": plan_key.capitalize(),
                "count": plan_count,
                "mrr": plan_count * _PLAN_PRICING.get(plan_key, 0),
                "students": row.get("students") or 0,
            })

        payload = {
            "totalSchools": total_schools,
            "activeSchools": active_schools,
            "totalStudents": total_students,
            "totalStaff": total_staff,
            "mrr": {
                "current": to_money(current_mrr),
                "previous": to_money(previous_mrr),
                "trend": mrr_trend,
            },
            "alertCount": overdue_invoices + blocked_tenants,
            "overdueCount": overdue_invoices,
            "blockedCount": blocked_tenants,
            "boardBreakdown": board_breakdown,
            "trends": {
                "students": 0,
                "mrr": mrr_trend,
            },
            "recentEvents": recent_events,
            "stateBreakdown": state_breakdown,
            "planBreakdown": plan_breakdown,
        }
        return Response(DashboardDataSerializer(payload).data)

    def _school_name_for_tenant(self, tenant_id):
        if not tenant_id:
            return None
        tenant = self._public_queryset(SchoolTenant).filter(tenant_id=tenant_id).only("name").first()
        return tenant.name if tenant else None


class SchoolTenantListView(SuperAdminBaseAPIView):
    ORDERING_ALIASES = {
        "created_at": "provisioned_at",
        "updated_at": "last_activity_at",
    }

    def get_queryset(self):
        queryset = self._public_queryset(SchoolTenant).order_by("-provisioned_at", "name")

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(name__icontains=search)
                | Q(tenant_id__icontains=search)
                | Q(subdomain_url__icontains=search)
                | Q(gstin__icontains=search)
            )

        for field in ["status", "plan", "board", "region"]:
            value = self.request.query_params.get(field)
            if value:
                queryset = queryset.filter(**{field: value})

        ordering = self.request.query_params.get("ordering")
        if ordering:
            is_desc = ordering.startswith("-")
            key = ordering.lstrip("-")
            normalized = self.ORDERING_ALIASES.get(key, key)
            allowed = {"name", "status", "plan", "provisioned_at", "student_count", "staff_count", "last_activity_at"}
            if normalized in allowed:
                queryset = queryset.order_by(f"-{normalized}" if is_desc else normalized)

        return queryset

    def get(self, request):
        return self._paginate(request, self.get_queryset(), SchoolTenantListSerializer)


class SchoolTenantProvisionView(SuperAdminBaseAPIView):
    def post(self, request):
        serializer = ProvisionSchoolRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        subdomain = data["subdomain_url"].strip().lower()

        if self._public_queryset(SchoolTenant).filter(subdomain_url=subdomain).exists():
            return Response({"detail": "Subdomain already exists."}, status=status.HTTP_400_BAD_REQUEST)

        User = get_user_model()

        # Resolve admin credentials (use provided or auto-generate)
        admin_username = (data.get("admin_username") or "").strip() or f"{subdomain.replace('-', '_').replace('.', '_')}_admin"
        if User.objects.filter(username=admin_username).exists():
            admin_username = f"{admin_username[:24]}_{uuid4().hex[:4]}"
        admin_password = (data.get("admin_password") or "").strip() or _gen_admin_password()

        try:
            with transaction.atomic():
                # 1. Create SchoolTenant (provisioning record)
                tenant = self._public_queryset(SchoolTenant).create(
                    tenant_id=f"TNT_{uuid4().hex[:8].upper()}",
                    name=data["name"],
                    short_code=data["name"][:10].upper(),
                    subdomain_url=subdomain,
                    schema_name=_schema_name_for(subdomain),
                    shard_region=data.get("shard_region") or "default",
                    storage_region=data.get("storage_region") or "default",
                    backup_retention=data.get("backup_retention") or 30,
                    sso_method=data.get("sso_method") or "native",
                    api_access=False,
                    plan=data["plan"],
                    status="onboarding",
                    provisioned_at=timezone.now(),
                    board=data["board"],
                    state=data["state"],
                    region=data.get("shard_region") or "default",
                    seats=0,
                    student_count=0,
                    staff_count=0,
                )

                # 2. Create ERP School record (used for login + data isolation)
                school_code = _safe_school_code(subdomain)
                if School.objects.filter(code=school_code).exists():
                    school_code = f"{school_code[:28]}_{uuid4().hex[:3].upper()}"
                erp_school = School.objects.create(
                    name=data["name"],
                    code=school_code,
                    subdomain=subdomain,
                    is_active=True,
                )

                # 3. Create school admin user
                admin_user = User.objects.create_user(
                    username=admin_username,
                    email=f"admin@{subdomain}.eskoolia.com",
                    password=admin_password,
                    first_name="School",
                    last_name="Admin",
                )
                admin_user.school = erp_school
                admin_user.is_school_admin = True
                admin_user.save(update_fields=["school", "is_school_admin"])

        except Exception as exc:
            return Response(
                {"detail": f"Provisioning failed: {exc}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )

        log_audit(
            action="school.provision",
            tenant_id=tenant.tenant_id,
            status="success",
            actor_user=request.user,
            actor_ip=self._client_ip(request),
            details={
                "school_name": tenant.name,
                "subdomain": tenant.subdomain_url,
                "plan": tenant.plan,
                "board": tenant.board,
                "erp_school_id": erp_school.id,
                "admin_username": admin_username,
            },
        )

        response = ProvisionSchoolResponseSerializer(
            {
                "tenant_id": tenant.tenant_id,
                "status": tenant.status,
                "message": "School provisioned successfully",
                "school_id": erp_school.id,
                "admin_username": admin_username,
                "admin_password": admin_password,
            }
        )
        return Response(response.data, status=status.HTTP_201_CREATED)


class SchoolTenantDetailView(SuperAdminBaseAPIView):
    def get_object(self, tenant_id):
        return self._public_queryset(SchoolTenant).get(tenant_id=tenant_id)

    def get(self, request, tenant_id):
        tenant = self.get_object(tenant_id)
        return Response(SchoolTenantDetailSerializer(tenant).data)

    def patch(self, request, tenant_id):
        tenant = self.get_object(tenant_id)
        serializer = SchoolTenantUpdateSerializer(tenant, data=self._normalize_school_payload(request.data), partial=True)
        serializer.is_valid(raise_exception=True)
        updated = serializer.save()

        log_audit(
            action="school.update",
            tenant_id=updated.tenant_id,
            status="success",
            actor_user=request.user,
            actor_ip=self._client_ip(request),
            details={
                "school_name": updated.name,
                "affected_fields": list(serializer.validated_data.keys()),
            },
        )

        return Response(SchoolTenantDetailSerializer(updated).data)

    def delete(self, request, tenant_id):
        tenant = self.get_object(tenant_id)
        tenant.status = "archived"
        tenant.api_access = False
        tenant.save(update_fields=["status", "api_access"])

        log_audit(
            action="school.archive",
            tenant_id=tenant.tenant_id,
            status="success",
            actor_user=request.user,
            actor_ip=self._client_ip(request),
            details={"school_name": tenant.name},
        )

        return Response(status=status.HTTP_204_NO_CONTENT)


class AuditLogListView(SuperAdminBaseAPIView):
    def get_queryset(self):
        queryset = self._public_queryset(TenantAuditLog).order_by("-created_at")

        actor = self.request.query_params.get("actor")
        if actor:
            queryset = queryset.filter(Q(actor_username__icontains=actor) | Q(actor_user_id__icontains=actor))

        action = self.request.query_params.get("action")
        if action:
            queryset = queryset.filter(action=action)

        tenant_id = self.request.query_params.get("tenant_id")
        if tenant_id:
            queryset = queryset.filter(tenant_id=tenant_id)

        severity = self.request.query_params.get("severity")
        if severity == "critical":
            queryset = queryset.filter(status="failed")
        elif severity == "warning":
            queryset = queryset.filter(status="partial")
        elif severity == "info":
            queryset = queryset.filter(status="success")

        date_from = self.request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(actor_username__icontains=search)
                | Q(action__icontains=search)
                | Q(tenant_id__icontains=search)
                | Q(schema_name__icontains=search)
            )

        return queryset

    def get(self, request):
        return self._paginate(request, self.get_queryset(), AuditEventSerializer)


class AuditLogExportView(SuperAdminBaseAPIView):
    def get(self, request):
        queryset = AuditLogListView()
        queryset.request = request
        logs = queryset.get_queryset()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "id",
            "timestamp",
            "actor",
            "actor_ip",
            "action",
            "detail",
            "severity",
            "tenant_id",
            "school_name",
            "status",
            "error_message",
        ])

        serializer = AuditEventSerializer(logs, many=True)
        for row in serializer.data:
            writer.writerow([
                row["id"],
                row["timestamp"],
                row["actor"],
                row.get("actor_ip") or "",
                row["action"],
                row["detail"],
                row["severity"],
                row.get("tenant_id") or "",
                row.get("school_name") or "",
                row.get("status") or "",
                row.get("error_message") or "",
            ])

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="audit-log.csv"'
        return response


class BillingInvoiceListCreateView(SuperAdminBaseAPIView):
    def get_queryset(self):
        queryset = self._public_queryset(SuperAdminInvoice).order_by("-invoice_date", "-created_at")

        status_filter = self.request.query_params.get("status")
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        school_name = self.request.query_params.get("school_name")
        if school_name:
            queryset = queryset.filter(school_name__icontains=school_name)

        tenant_id = self.request.query_params.get("tenant_id")
        if tenant_id:
            queryset = queryset.filter(tenant__tenant_id=tenant_id)

        search = self.request.query_params.get("search")
        if search:
            queryset = queryset.filter(
                Q(invoice_number__icontains=search)
                | Q(school_name__icontains=search)
                | Q(buyer_name__icontains=search)
                | Q(tenant__tenant_id__icontains=search)
            )

        date_from = self.request.query_params.get("date_from")
        if date_from:
            queryset = queryset.filter(invoice_date__gte=date_from)

        date_to = self.request.query_params.get("date_to")
        if date_to:
            queryset = queryset.filter(invoice_date__lte=date_to)

        return queryset

    def get(self, request):
        return self._paginate(request, self.get_queryset(), InvoiceSerializer)

    def post(self, request):
        serializer = InvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        tenant = None
        if data.get("tenant_id"):
            tenant = self._public_queryset(SchoolTenant).filter(tenant_id=data["tenant_id"]).first()

        line_items = data["line_items"]
        subtotal = sum(_safe_float(item.get("amount")) for item in line_items)
        tax_breakdown = data.get("tax_breakdown") or {}
        if not tax_breakdown:
            tax_total = sum(_safe_float(item.get("gst_amount")) for item in line_items)
            grand_total = subtotal + tax_total
            tax_breakdown = {
                "subtotal": to_money(subtotal),
                "igst": to_money(tax_total),
                "cgst": 0,
                "sgst": 0,
                "total_tax": to_money(tax_total),
                "grand_total": to_money(grand_total),
                "amount_in_words": _money_words(grand_total),
            }

        invoice = self._public_queryset(SuperAdminInvoice).create(
            invoice_number=data.get("invoice_number") or build_invoice_number(),
            tenant=tenant,
            school_name=data["school_name"],
            invoice_date=data["invoice_date"],
            due_date=data["due_date"],
            status=data.get("status") or "draft",
            seller_name=data["seller_name"],
            seller_gstin=data.get("seller_gstin") or "",
            seller_state=data["seller_state"],
            buyer_name=data["buyer_name"],
            buyer_gstin=data.get("buyer_gstin") or "",
            buyer_state=data["buyer_state"],
            line_items=line_items,
            tax_breakdown=tax_breakdown,
            notes=data.get("notes") or "",
            terms_conditions=data.get("terms_conditions") or "",
        )

        log_audit(
            action="invoice.generated",
            tenant_id=tenant.tenant_id if tenant else None,
            status="success",
            actor_user=request.user,
            actor_ip=self._client_ip(request),
            details={"school_name": invoice.school_name, "invoice_number": invoice.invoice_number, "status": invoice.status},
        )

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


class BillingMRRView(SuperAdminBaseAPIView):
    def get(self, request):
        invoices = self._public_queryset(SuperAdminInvoice).exclude(status="cancelled")
        current_start, current_end = current_month_range()
        previous_start, previous_end = previous_month_range()

        current_month = invoices.filter(invoice_date__gte=current_start, invoice_date__lt=current_end)
        previous_month = invoices.filter(invoice_date__gte=previous_start, invoice_date__lt=previous_end)

        current_mrr = sum(_invoice_grand_total(invoice) for invoice in current_month)
        previous_mrr = sum(_invoice_grand_total(invoice) for invoice in previous_month)

        gst_collected = sum(_invoice_tax_total(invoice) for invoice in current_month if invoice.status == "paid")
        outstanding_amount = sum(_invoice_grand_total(invoice) for invoice in invoices.filter(status__in=["draft", "sent", "overdue"]))
        at_risk_amount = sum(_invoice_grand_total(invoice) for invoice in invoices.filter(status="overdue"))

        trend_percent = 0.0
        if previous_mrr:
            trend_percent = round(((current_mrr - previous_mrr) / previous_mrr) * 100, 2)

        payload = {
            "current_mrr": to_money(current_mrr),
            "previous_mrr": to_money(previous_mrr),
            "gst_collected": to_money(gst_collected),
            "outstanding_amount": to_money(outstanding_amount),
            "at_risk_amount": to_money(at_risk_amount),
            "trend_percent": trend_percent,
        }
        return Response(BillingMrrSerializer(payload).data)


class BillingGSTR1ExportView(SuperAdminBaseAPIView):
    def get(self, request):
        queryset = BillingInvoiceListCreateView()
        queryset.request = request
        invoices = queryset.get_queryset()

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "invoice_number",
            "school_name",
            "tenant_id",
            "invoice_date",
            "due_date",
            "status",
            "subtotal",
            "total_tax",
            "grand_total",
        ])

        for invoice in invoices:
            tax_breakdown = invoice.tax_breakdown or {}
            writer.writerow([
                invoice.invoice_number,
                invoice.school_name,
                invoice.tenant.tenant_id if invoice.tenant_id and invoice.tenant else "",
                invoice.invoice_date,
                invoice.due_date,
                invoice.status,
                tax_breakdown.get("subtotal", 0),
                tax_breakdown.get("total_tax", 0),
                tax_breakdown.get("grand_total", _invoice_grand_total(invoice)),
            ])

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = 'attachment; filename="gstr1-report.csv"'
        return response


class PoliciesView(SuperAdminBaseAPIView):
    def get(self, request):
        return Response(PolicyGroupSerializer(_policy_groups(), many=True).data)

    def patch(self, request):
        updates = request.data
        if isinstance(updates, dict) and "updates" in updates and isinstance(updates["updates"], dict):
            updates = updates["updates"]

        if not isinstance(updates, dict) or not updates:
            return Response({"detail": "No policy updates supplied."}, status=status.HTTP_400_BAD_REQUEST)

        _ensure_default_policies()
        changed = []

        for key, value in updates.items():
            seed = next((row for row in DEFAULT_POLICY_ROWS if row["key"] == key), None)
            category = seed["category"] if seed else "system"
            description = seed["description"] if seed else "Updated platform policy."
            value_type = seed["value_type"] if seed else ("boolean" if isinstance(value, bool) else ("number" if isinstance(value, (int, float)) else "string"))
            default_value = seed["default_value"] if seed else value
            is_toggle = seed["is_toggle"] if seed else isinstance(value, bool)
            is_overridable = seed["is_overridable"] if seed else True

            policy, _ = self._public_queryset(SuperAdminPolicy).update_or_create(
                key=key,
                defaults={
                    "category": category,
                    "description": description,
                    "value": value,
                    "value_type": value_type,
                    "is_toggle": is_toggle,
                    "is_overridable": is_overridable,
                    "default_value": default_value,
                    "updated_by": getattr(request.user, "username", "system"),
                },
            )
            changed.append(policy)

        log_audit(
            action="policy.updated",
            status="success",
            actor_user=request.user,
            actor_ip=self._client_ip(request),
            details={"updates": updates, "count": len(changed)},
        )

        return Response(PolicyGroupSerializer(_policy_groups(), many=True).data)


class PolicySettingsView(SuperAdminBaseAPIView):
    def get(self, request):
        payload = {
            "system": {
                "name": "eSkoolia Platform",
                "version": "1.0.0",
                "environment": "development" if settings.DEBUG else "production",
                "multi_tenancy_enabled": settings.MULTI_TENANCY_ENABLED,
                "timezone": getattr(settings, "TIME_ZONE", "UTC"),
            },
            "notification": {
                "email_enabled": True,
                "sms_enabled": False,
                "push_enabled": True,
                "webhook_enabled": True,
            },
            "integrations": {
                "google_sso": True,
                "microsoft_sso": True,
                "saml_enabled": False,
                "ldap_enabled": False,
            },
            "storage": {
                "provider": "s3",
                "bucket": "eskoolia-prod",
                "cdn_enabled": True,
                "max_file_size_mb": 100,
            },
            "api": {
                "rate_limiting": True,
                "api_versioning": "v1",
                "api_documentation_url": "/api/docs/",
                "swagger_ui_enabled": True,
            },
        }
        return Response(PolicySettingsSerializer(payload).data)


class PoliciesExportView(SuperAdminBaseAPIView):
    def get(self, request):
        export_format = (request.query_params.get("format") or "json").lower()
        data = PolicyGroupSerializer(_policy_groups(), many=True).data

        if export_format in {"yaml", "yml"}:
            response = HttpResponse(yaml.safe_dump(data, sort_keys=False, default_flow_style=False), content_type="application/yaml")
            response["Content-Disposition"] = 'attachment; filename="policies.yaml"'
            return response

        response = HttpResponse(json.dumps(data, indent=2, default=str), content_type="application/json")
        response["Content-Disposition"] = 'attachment; filename="policies.json"'
        return response
