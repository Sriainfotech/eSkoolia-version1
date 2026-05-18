from __future__ import annotations

import csv
import io
from datetime import datetime

from django.core.cache import cache
from django.db import connection
from django.db.models import Count, Q, Sum
from django.shortcuts import get_object_or_404
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import status
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import UserRateThrottle
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from apps.tenancy.models import (
    SchoolTenant,
    SuperAdminFeatureToggle,
    SuperAdminInvoice,
    SuperAdminPolicy,
    TenantAuditLog,
)
from apps.tenancy.permissions import IsSuperAdmin
from apps.tenancy.provisioning import is_provisioning_enabled, provision_tenant
from apps.users.models import User

from .serializers import (
    AuditEventSerializer,
    FeatureToggleSerializer,
    InvoiceCreateSerializer,
    InvoiceSerializer,
    PolicySerializer,
    ProvisionSchoolSerializer,
    SchoolTenantSerializer,
    SchoolTenantUpdateSerializer,
)
from .utils import (
    audit_super_admin_action,
    build_invoice_number,
    current_month_range,
    previous_month_range,
    to_money,
)


class SuperAdminRateThrottle(UserRateThrottle):
    scope = "super_admin"
    rate = "180/min"


class SuperAdminPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = "page_size"
    max_page_size = 200


class SuperAdminBaseView(APIView):
    permission_classes = [IsAuthenticated, IsSuperAdmin]
    throttle_classes = [SuperAdminRateThrottle]


class DashboardView(SuperAdminBaseView):
    def _sum_invoice_total(self, queryset):
        total = 0.0
        for invoice in queryset.only("tax_breakdown"):
            tax = invoice.tax_breakdown or {}
            total += float(tax.get("grand_total", 0) or 0)
        return total

    def get(self, request):
        cache_key = "super_admin_dashboard_v1"
        cached = cache.get(cache_key)
        if cached:
            return Response(cached)

        total_schools = SchoolTenant.objects.count()
        active_schools = SchoolTenant.objects.filter(status="active").count()
        suspended_schools = SchoolTenant.objects.filter(status="suspended").count()

        total_students = SchoolTenant.objects.aggregate(total=Sum("student_count"))["total"] or 0
        total_staff = SchoolTenant.objects.aggregate(total=Sum("staff_count"))["total"] or 0

        if total_students == 0:
            total_students = User.objects.filter(school__is_active=True).count()
        if total_staff == 0:
            total_staff = User.objects.filter(is_staff=True).count()

        cur_start, cur_end = current_month_range()
        prev_start, prev_end = previous_month_range()

        current_mrr = self._sum_invoice_total(
            SuperAdminInvoice.objects.filter(invoice_date__gte=cur_start, invoice_date__lt=cur_end).exclude(status="cancelled")
        )
        previous_mrr = self._sum_invoice_total(
            SuperAdminInvoice.objects.filter(invoice_date__gte=prev_start, invoice_date__lt=prev_end).exclude(status="cancelled")
        )
        trend = 0
        if previous_mrr:
            trend = round(((float(current_mrr) - float(previous_mrr)) / float(previous_mrr)) * 100, 2)

        board_counts = list(SchoolTenant.objects.values("board").annotate(count=Count("id")).order_by("-count"))
        board_breakdown = []
        for item in board_counts:
            count = item["count"]
            board_breakdown.append(
                {
                    "board": item.get("board") or "OTHER",
                    "count": count,
                    "percent": round((count / total_schools) * 100, 2) if total_schools else 0,
                }
            )

        recent_logs = TenantAuditLog.objects.order_by("-created_at")[:10]
        recent_events = []
        for log in recent_logs:
            recent_events.append(
                {
                    "id": str(log.id),
                    "timestamp": log.created_at,
                    "actor": log.actor_username or "system",
                    "action": log.action,
                    "detail": (log.details or {}).get("message") if isinstance(log.details, dict) else log.action,
                    "severity": "critical" if log.status == "failed" else ("warning" if log.status == "partial" else "info"),
                    "tenantId": log.tenant_id,
                }
            )

        payload = {
            "totalSchools": total_schools,
            "activeSchools": active_schools,
            "totalStudents": total_students,
            "totalStaff": total_staff,
            "mrr": {
                "current": to_money(current_mrr),
                "previous": to_money(previous_mrr),
                "trend": trend,
            },
            "alertCount": suspended_schools,
            "boardBreakdown": board_breakdown,
            "trends": {
                "students": 0,
                "mrr": trend,
            },
            "recentEvents": recent_events,
            "analytics": {
                "api_usage": TenantAuditLog.objects.filter(created_at__gte=timezone.now() - timezone.timedelta(days=30)).count(),
                "onboarding": SchoolTenant.objects.filter(status="onboarding").count(),
                "migration_pending": SchoolTenant.objects.filter(status="trial").count(),
            },
        }

        cache.set(cache_key, payload, 60)
        return Response(payload)


class SchoolListView(SuperAdminBaseView):
    def get(self, request):
        qs = SchoolTenant.objects.all().order_by("-provisioned_at", "name")

        search = request.query_params.get("search")
        if search:
            qs = qs.filter(
                Q(name__icontains=search)
                | Q(tenant_id__icontains=search)
                | Q(subdomain_url__icontains=search)
                | Q(gstin__icontains=search)
            )

        for field in ["status", "board", "plan", "region"]:
            value = request.query_params.get(field)
            if value:
                qs = qs.filter(**{field: value})

        ordering = request.query_params.get("ordering")
        if ordering and ordering.lstrip("-") in {
            "name",
            "status",
            "plan",
            "provisioned_at",
            "student_count",
            "staff_count",
        }:
            qs = qs.order_by(ordering)

        paginator = SuperAdminPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = SchoolTenantSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class SchoolProvisionView(SuperAdminBaseView):
    def post(self, request):
        serializer = ProvisionSchoolSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        if SchoolTenant.objects.filter(subdomain_url=data["subdomain_url"]).exists():
            return Response({"detail": "Subdomain already exists."}, status=status.HTTP_400_BAD_REQUEST)

        if is_provisioning_enabled():
            tenant = provision_tenant(
                name=data["name"],
                subdomain_url=data["subdomain_url"],
                plan=data["plan"],
                actor_user=request.user,
                actor_ip=request.META.get("REMOTE_ADDR"),
            )
            tenant.status = tenant.status or "active"
        else:
            tenant = SchoolTenant.objects.create(
                tenant_id=f"TNT_{timezone.now():%Y%m%d%H%M%S}",
                name=data["name"],
                short_code=data["name"][:10].upper(),
                subdomain_url=data["subdomain_url"],
                schema_name=f"school_{data['subdomain_url'].lower()[:54]}",
                plan=data["plan"],
                status="onboarding",
                provisioned_at=timezone.now(),
            )

        if not tenant.tenant_id:
            tenant.tenant_id = f"TNT_{timezone.now():%Y%m%d%H%M%S}"

        tenant.board = data["board"]
        tenant.state = data["state"]
        tenant.region = data.get("shard_region") or tenant.region
        tenant.shard_region = data.get("shard_region") or tenant.shard_region
        tenant.storage_region = data.get("storage_region") or tenant.storage_region
        if "backup_retention" in data:
            tenant.backup_retention = data["backup_retention"]
        if "sso_method" in data:
            tenant.sso_method = data["sso_method"]
        tenant.save()

        audit_super_admin_action(
            request=request,
            action="provision_complete",
            tenant_id=tenant.tenant_id,
            details={"name": tenant.name, "subdomain": tenant.subdomain_url, "plan": tenant.plan},
        )

        return Response({"tenant_id": tenant.tenant_id, "status": tenant.status, "message": "Tenant provisioned successfully"}, status=status.HTTP_201_CREATED)


class SchoolDetailView(SuperAdminBaseView):
    def get_object(self, tenant_id: str):
        return get_object_or_404(SchoolTenant, tenant_id=tenant_id)

    def get(self, request, tenant_id: str):
        tenant = self.get_object(tenant_id)
        return Response(SchoolTenantSerializer(tenant).data)

    def patch(self, request, tenant_id: str):
        tenant = self.get_object(tenant_id)
        serializer = SchoolTenantUpdateSerializer(data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)

        for key, value in serializer.validated_data.items():
            setattr(tenant, key, value)
        tenant.save(update_fields=list(serializer.validated_data.keys()))

        audit_super_admin_action(
            request=request,
            action="school.update",
            tenant_id=tenant.tenant_id,
            details={"fields": list(serializer.validated_data.keys())},
        )
        return Response(SchoolTenantSerializer(tenant).data)

    def delete(self, request, tenant_id: str):
        tenant = self.get_object(tenant_id)
        tenant.status = "archived"
        tenant.save(update_fields=["status"])
        audit_super_admin_action(request=request, action="school.archive", tenant_id=tenant.tenant_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class SchoolActivateView(SuperAdminBaseView):
    def post(self, request, tenant_id: str):
        tenant = get_object_or_404(SchoolTenant, tenant_id=tenant_id)
        tenant.status = "active"
        tenant.save(update_fields=["status"])
        audit_super_admin_action(request=request, action="tenant_activated", tenant_id=tenant.tenant_id)
        return Response(SchoolTenantSerializer(tenant).data)


class SchoolSuspendView(SuperAdminBaseView):
    def post(self, request, tenant_id: str):
        tenant = get_object_or_404(SchoolTenant, tenant_id=tenant_id)
        tenant.status = "suspended"
        tenant.save(update_fields=["status"])
        audit_super_admin_action(request=request, action="tenant_deactivated", tenant_id=tenant.tenant_id)
        return Response(SchoolTenantSerializer(tenant).data)


class TenantFeatureToggleView(SuperAdminBaseView):
    def get(self, request, tenant_id: str):
        tenant = get_object_or_404(SchoolTenant, tenant_id=tenant_id)
        toggles = SuperAdminFeatureToggle.objects.filter(tenant=tenant).order_by("key")
        return Response(FeatureToggleSerializer(toggles, many=True).data)

    def patch(self, request, tenant_id: str):
        tenant = get_object_or_404(SchoolTenant, tenant_id=tenant_id)
        payload = request.data if isinstance(request.data, list) else request.data.get("toggles", [])
        updated = []
        for item in payload:
            toggle, _ = SuperAdminFeatureToggle.objects.update_or_create(
                tenant=tenant,
                key=item.get("key"),
                defaults={
                    "enabled": bool(item.get("enabled", True)),
                    "config": item.get("config") or {},
                    "updated_by": request.user.username,
                },
            )
            updated.append(toggle)

        audit_super_admin_action(request=request, action="feature_toggle.update", tenant_id=tenant_id, details={"count": len(updated)})
        return Response(FeatureToggleSerializer(updated, many=True).data)


class TenantSubscriptionView(SuperAdminBaseView):
    def get(self, request, tenant_id: str):
        tenant = get_object_or_404(SchoolTenant, tenant_id=tenant_id)
        return Response(
            {
                "tenant_id": tenant.tenant_id,
                "plan": tenant.plan,
                "status": tenant.status,
                "api_access": tenant.api_access,
                "provisioned_at": tenant.provisioned_at,
            }
        )

    def patch(self, request, tenant_id: str):
        tenant = get_object_or_404(SchoolTenant, tenant_id=tenant_id)
        plan = request.data.get("plan")
        if plan:
            tenant.plan = plan
        if "api_access" in request.data:
            tenant.api_access = bool(request.data.get("api_access"))
        tenant.save(update_fields=["plan", "api_access"])
        audit_super_admin_action(request=request, action="plan.upgrade", tenant_id=tenant_id, details={"plan": tenant.plan})
        return Response({"tenant_id": tenant_id, "plan": tenant.plan, "api_access": tenant.api_access})


class TenantMigrationStatusView(SuperAdminBaseView):
    def get(self, request, tenant_id: str):
        logs = TenantAuditLog.objects.filter(tenant_id=tenant_id, action__icontains="migration").order_by("-created_at")[:20]
        payload = [
            {
                "id": str(log.id),
                "action": log.action,
                "status": log.status,
                "timestamp": log.created_at,
                "detail": log.details or {},
                "error_message": log.error_message,
            }
            for log in logs
        ]
        return Response({"tenant_id": tenant_id, "events": payload})


class BillingInvoicesView(SuperAdminBaseView):
    def get(self, request):
        qs = SuperAdminInvoice.objects.select_related("tenant").all().order_by("-invoice_date", "-created_at")

        status_filter = request.query_params.get("status")
        school_name = request.query_params.get("school_name")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if status_filter:
            qs = qs.filter(status=status_filter)
        if school_name:
            qs = qs.filter(school_name__icontains=school_name)
        if date_from:
            qs = qs.filter(invoice_date__gte=date_from)
        if date_to:
            qs = qs.filter(invoice_date__lte=date_to)

        paginator = SuperAdminPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = InvoiceSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)

    def post(self, request):
        serializer = InvoiceCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = serializer.validated_data

        tenant = None
        tenant_id = payload.get("tenant_id")
        if tenant_id:
            tenant = SchoolTenant.objects.filter(tenant_id=tenant_id).first()

        line_items = payload["line_items"]
        subtotal = 0.0
        normalized_items = []
        for item in line_items:
            qty = float(item.get("quantity", 1))
            unit_price = float(item.get("unit_price", 0))
            amount = to_money(qty * unit_price)
            subtotal += amount
            gst_percent = float(item.get("gst_percent", 18))
            gst_amount = to_money(amount * gst_percent / 100)
            normalized_items.append(
                {
                    "description": item.get("description", "Subscription"),
                    "quantity": qty,
                    "unit_price": unit_price,
                    "sac_code": item.get("sac_code", "9983"),
                    "amount": amount,
                    "gst_percent": gst_percent,
                    "gst_amount": gst_amount,
                }
            )

        total_tax = to_money(sum(float(item["gst_amount"]) for item in normalized_items))
        igst = total_tax if payload["seller_state"].strip().lower() != payload["buyer_state"].strip().lower() else 0
        cgst = to_money(total_tax / 2) if igst == 0 else 0
        sgst = to_money(total_tax / 2) if igst == 0 else 0
        grand_total = to_money(subtotal + total_tax)

        invoice = SuperAdminInvoice.objects.create(
            invoice_number=build_invoice_number(),
            tenant=tenant,
            school_name=payload["school_name"],
            invoice_date=payload["invoice_date"],
            due_date=payload["due_date"],
            status=payload.get("status", "draft"),
            seller_name=payload["seller_name"],
            seller_gstin=payload.get("seller_gstin", ""),
            seller_state=payload["seller_state"],
            buyer_name=payload["buyer_name"],
            buyer_gstin=payload.get("buyer_gstin", ""),
            buyer_state=payload["buyer_state"],
            line_items=normalized_items,
            tax_breakdown={
                "subtotal": to_money(subtotal),
                "igst": to_money(igst),
                "cgst": to_money(cgst),
                "sgst": to_money(sgst),
                "total_tax": to_money(total_tax),
                "grand_total": grand_total,
                "amount_in_words": f"INR {grand_total:.2f}",
            },
            notes=payload.get("notes", ""),
            terms_conditions=payload.get("terms_conditions", ""),
        )

        audit_super_admin_action(
            request=request,
            action="invoice.generated",
            tenant_id=tenant.tenant_id if tenant else None,
            details={"invoice_number": invoice.invoice_number, "amount": grand_total},
        )

        return Response(InvoiceSerializer(invoice).data, status=status.HTTP_201_CREATED)


class BillingMrrView(SuperAdminBaseView):
    def _sum_invoice_total(self, queryset):
        total = 0.0
        for invoice in queryset.only("tax_breakdown"):
            tax = invoice.tax_breakdown or {}
            total += float(tax.get("grand_total", 0) or 0)
        return total

    def get(self, request):
        cur_start, cur_end = current_month_range()
        prev_start, prev_end = previous_month_range()

        current_mrr = self._sum_invoice_total(
            SuperAdminInvoice.objects.filter(invoice_date__gte=cur_start, invoice_date__lt=cur_end).exclude(status="cancelled")
        )
        previous_mrr = self._sum_invoice_total(
            SuperAdminInvoice.objects.filter(invoice_date__gte=prev_start, invoice_date__lt=prev_end).exclude(status="cancelled")
        )

        overdue_amount = self._sum_invoice_total(SuperAdminInvoice.objects.filter(status="overdue"))
        sent_amount = self._sum_invoice_total(SuperAdminInvoice.objects.filter(status="sent"))

        trend = 0
        if previous_mrr:
            trend = round(((float(current_mrr) - float(previous_mrr)) / float(previous_mrr)) * 100, 2)

        payload = {
            "current_mrr": to_money(current_mrr),
            "previous_mrr": to_money(previous_mrr),
            "gst_collected": to_money(current_mrr) * 0.18,
            "outstanding_amount": to_money(overdue_amount),
            "at_risk_amount": to_money(sent_amount),
            "trend_percent": trend,
        }
        return Response(payload)


class BillingExportGstr1View(SuperAdminBaseView):
    def get(self, request):
        invoices = SuperAdminInvoice.objects.exclude(status="cancelled").order_by("invoice_date")

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow([
            "invoice_number",
            "invoice_date",
            "school_name",
            "buyer_gstin",
            "seller_gstin",
            "taxable_value",
            "igst",
            "cgst",
            "sgst",
            "total",
            "status",
        ])
        for inv in invoices:
            tax = inv.tax_breakdown or {}
            writer.writerow(
                [
                    inv.invoice_number,
                    inv.invoice_date,
                    inv.school_name,
                    inv.buyer_gstin,
                    inv.seller_gstin,
                    tax.get("subtotal", 0),
                    tax.get("igst", 0),
                    tax.get("cgst", 0),
                    tax.get("sgst", 0),
                    tax.get("grand_total", 0),
                    inv.status,
                ]
            )

        audit_super_admin_action(request=request, action="billing.export.gstr1", details={"rows": invoices.count()})

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="gstr1-{timezone.now():%Y%m%d}.csv"'
        return response


class AuditListView(SuperAdminBaseView):
    def get(self, request):
        qs = TenantAuditLog.objects.all().order_by("-created_at")

        actor = request.query_params.get("actor")
        action = request.query_params.get("action")
        tenant_id = request.query_params.get("tenant_id")
        severity = request.query_params.get("severity")
        date_from = request.query_params.get("date_from")
        date_to = request.query_params.get("date_to")

        if actor:
            qs = qs.filter(actor_username__icontains=actor)
        if action:
            qs = qs.filter(action=action)
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)
        if date_from:
            qs = qs.filter(created_at__date__gte=date_from)
        if date_to:
            qs = qs.filter(created_at__date__lte=date_to)
        if severity == "critical":
            qs = qs.filter(status="failed")
        elif severity == "warning":
            qs = qs.filter(status="partial")
        elif severity == "info":
            qs = qs.exclude(status__in=["failed", "partial"])

        paginator = SuperAdminPagination()
        page = paginator.paginate_queryset(qs, request)
        serializer = AuditEventSerializer(page, many=True)
        return paginator.get_paginated_response(serializer.data)


class AuditExportView(SuperAdminBaseView):
    def get(self, request):
        qs = TenantAuditLog.objects.all().order_by("-created_at")
        tenant_id = request.query_params.get("tenant_id")
        if tenant_id:
            qs = qs.filter(tenant_id=tenant_id)

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["timestamp", "actor", "actor_ip", "action", "status", "tenant_id", "detail", "error_message"])
        for event in qs:
            writer.writerow(
                [
                    event.created_at.isoformat(),
                    event.actor_username or "system",
                    event.actor_ip or "",
                    event.action,
                    event.status,
                    event.tenant_id or "",
                    event.details,
                    event.error_message or "",
                ]
            )

        audit_super_admin_action(request=request, action="audit.export", details={"rows": qs.count()})

        response = HttpResponse(output.getvalue(), content_type="text/csv")
        response["Content-Disposition"] = f'attachment; filename="audit-log-{timezone.now():%Y%m%d}.csv"'
        return response


class AuditActorsView(SuperAdminBaseView):
    def get(self, request):
        actors = (
            TenantAuditLog.objects.exclude(actor_username__isnull=True)
            .exclude(actor_username="")
            .values_list("actor_username", flat=True)
            .distinct()
            .order_by("actor_username")
        )
        return Response(list(actors))


class TenantActivityTimelineView(SuperAdminBaseView):
    def get(self, request, tenant_id: str):
        qs = TenantAuditLog.objects.filter(tenant_id=tenant_id).order_by("-created_at")[:100]
        data = AuditEventSerializer(qs, many=True).data
        return Response({"tenant_id": tenant_id, "events": data})


class PoliciesView(SuperAdminBaseView):
    DEFAULTS = [
        {
            "key": "password.min_length",
            "category": "security",
            "description": "Minimum password length",
            "value": 8,
            "value_type": "number",
            "is_toggle": False,
            "is_overridable": False,
            "default_value": 8,
        },
        {
            "key": "security.require_mfa",
            "category": "security",
            "description": "Require MFA for super-admin accounts",
            "value": False,
            "value_type": "boolean",
            "is_toggle": True,
            "is_overridable": False,
            "default_value": False,
        },
        {
            "key": "billing.gst_rate",
            "category": "billing",
            "description": "Default GST rate",
            "value": 18,
            "value_type": "number",
            "is_toggle": False,
            "is_overridable": True,
            "default_value": 18,
        },
        {
            "key": "onboarding.auto_activate",
            "category": "system",
            "description": "Auto-activate tenants after provisioning",
            "value": True,
            "value_type": "boolean",
            "is_toggle": True,
            "is_overridable": False,
            "default_value": True,
        },
    ]

    def _ensure_defaults(self):
        for item in self.DEFAULTS:
            SuperAdminPolicy.objects.get_or_create(
                key=item["key"],
                defaults={
                    "category": item["category"],
                    "description": item["description"],
                    "value": item["value"],
                    "value_type": item["value_type"],
                    "is_toggle": item["is_toggle"],
                    "is_overridable": item["is_overridable"],
                    "default_value": item["default_value"],
                    "updated_by": "system",
                },
            )

    def get(self, request):
        self._ensure_defaults()
        groups = []
        categories = {
            "security": "Security",
            "data_isolation": "Data Isolation",
            "billing": "Billing",
            "system": "System",
        }

        for key, label in categories.items():
            queryset = SuperAdminPolicy.objects.filter(category=key).order_by("key")
            groups.append(
                {
                    "category": key,
                    "label": label,
                    "description": f"{label} policies",
                    "policies": PolicySerializer(queryset, many=True).data,
                }
            )
        return Response(groups)

    def patch(self, request):
        self._ensure_defaults()
        updated_keys = []
        for key, value in request.data.items():
            policy = SuperAdminPolicy.objects.filter(key=key).first()
            if not policy:
                continue
            previous = policy.value
            policy.value = value
            policy.version += 1
            policy.updated_by = request.user.username
            policy.save(update_fields=["value", "version", "updated_by", "updated_at"])
            updated_keys.append(key)
            audit_super_admin_action(
                request=request,
                action="policy.updated",
                details={"key": key, "before": previous, "after": value, "version": policy.version},
            )

        return Response({"updated": updated_keys})


class PoliciesExportView(SuperAdminBaseView):
    def get(self, request):
        fmt = request.query_params.get("format", "json")
        policies = list(SuperAdminPolicy.objects.values("key", "category", "value", "value_type", "version", "updated_by", "updated_at"))

        if fmt == "yaml":
            lines = []
            for item in policies:
                lines.append(f"{item['key']}: {item['value']}")
            payload = "\n".join(lines)
            content_type = "application/x-yaml"
            ext = "yaml"
        else:
            import json

            payload = json.dumps(policies, default=str, indent=2)
            content_type = "application/json"
            ext = "json"

        response = HttpResponse(payload, content_type=content_type)
        response["Content-Disposition"] = f'attachment; filename="policies-{timezone.now():%Y%m%d}.{ext}"'
        return response


class AnalyticsView(SuperAdminBaseView):
    def get(self, request):
        last_30 = timezone.now() - timezone.timedelta(days=30)
        tenant_growth = (
            SchoolTenant.objects.filter(provisioned_at__gte=last_30)
            .extra({"day": "date(provisioned_at)"})
            .values("day")
            .annotate(count=Count("id"))
            .order_by("day")
        )

        usage_by_module = (
            TenantAuditLog.objects.filter(created_at__gte=last_30)
            .values("action")
            .annotate(count=Count("id"))
            .order_by("-count")[:20]
        )

        mrr = BillingMrrView().get(request).data

        payload = {
            "success": True,
            "message": "Analytics fetched successfully",
            "data": {
                "tenant_growth": list(tenant_growth),
                "usage_analytics": list(usage_by_module),
                "module_usage": list(usage_by_module),
                "attendance_trends": [],
                "revenue_analytics": mrr,
                "api_usage_analytics": {
                    "last_30d_events": TenantAuditLog.objects.filter(created_at__gte=last_30).count(),
                },
                "onboarding_analytics": {
                    "onboarding": SchoolTenant.objects.filter(status="onboarding").count(),
                    "trial": SchoolTenant.objects.filter(plan="trial").count(),
                },
            },
            "meta": {
                "generated_at": timezone.now(),
                "source": "public-schema",
            },
        }
        return Response(payload)


class SystemHealthView(SuperAdminBaseView):
    def get(self, request):
        db_status = "ok"
        db_error = None
        try:
            with connection.cursor() as cursor:
                cursor.execute("SELECT 1")
                cursor.fetchone()
        except Exception as exc:
            db_status = "failed"
            db_error = str(exc)

        health = {
            "db_health": {"status": db_status, "error": db_error},
            "migration_health": {
                "failed_events_24h": TenantAuditLog.objects.filter(
                    action__icontains="migration",
                    status="failed",
                    created_at__gte=timezone.now() - timezone.timedelta(hours=24),
                ).count()
            },
            "tenant_routing_health": {
                "public_schema": getattr(connection, "schema_name", "public") == "public",
                "active_tenants": SchoolTenant.objects.filter(status="active").count(),
            },
            "queue_health": {"status": "unknown"},
            "auth_health": {"active_super_admins": User.objects.filter(is_superuser=True, is_active=True).count()},
            "storage_health": {"status": "unknown"},
            "api_latency": {"p95_ms": None},
            "schema_failures": TenantAuditLog.objects.filter(action__icontains="schema", status="failed").count(),
        }

        payload = {
            "success": db_status == "ok",
            "message": "System health fetched successfully" if db_status == "ok" else "System health has failures",
            "data": health,
            "meta": {
                "generated_at": timezone.now(),
                "environment": "staging" if "staging" in request.get_host().lower() else "runtime",
            },
        }
        return Response(payload)


class SchoolImpersonateView(SuperAdminBaseView):
    """Mint a short-lived impersonation JWT and return tenant subdomain handoff URL."""

    def post(self, request, tenant_id: str):
        tenant = get_object_or_404(SchoolTenant, tenant_id=tenant_id)

        target_username = request.data.get("username")
        target = None
        if target_username:
            target = User.objects.filter(username=target_username, school__tenant_id=tenant_id).first()
        if target is None:
            target = (
                User.objects.filter(school__tenant_id=tenant_id, is_staff=True, is_active=True)
                .order_by("-is_superuser", "id")
                .first()
            )
        if target is None:
            return Response(
                {"detail": "No active staff user available for impersonation in this tenant."},
                status=status.HTTP_404_NOT_FOUND,
            )

        refresh = RefreshToken.for_user(target)
        refresh["impersonated_by"] = request.user.username
        refresh["tenant_id"] = tenant.tenant_id
        access = refresh.access_token
        access["impersonated_by"] = request.user.username
        access["tenant_id"] = tenant.tenant_id

        scheme = "https" if request.is_secure() else "http"
        host = request.get_host().split(":")[0]
        port = ""
        if ":" in request.get_host():
            port = ":" + request.get_host().split(":")[1]
        target_host = f"{tenant.subdomain_url}.{host}{port}" if tenant.subdomain_url else f"{host}{port}"
        handoff_url = f"{scheme}://{target_host}/login?impersonate=1"

        audit_super_admin_action(
            request=request,
            action="auth.impersonate",
            tenant_id=tenant.tenant_id,
            details={"target_user_id": target.id, "target_username": target.username},
        )

        return Response(
            {
                "tenant_id": tenant.tenant_id,
                "username": target.username,
                "access": str(access),
                "refresh": str(refresh),
                "handoff_url": handoff_url,
                "expires_in": int(access.lifetime.total_seconds()),
            }
        )


class InvoiceMarkPaidView(SuperAdminBaseView):
    def post(self, request, invoice_id: str):
        invoice = get_object_or_404(SuperAdminInvoice, id=invoice_id)
        previous_status = invoice.status
        invoice.status = "paid"
        invoice.save(update_fields=["status", "updated_at"])

        audit_super_admin_action(
            request=request,
            action="invoice.mark_paid",
            tenant_id=invoice.tenant.tenant_id if invoice.tenant_id else None,
            details={
                "invoice_number": invoice.invoice_number,
                "previous_status": previous_status,
            },
        )
        return Response(InvoiceSerializer(invoice).data)


class InvoiceSendReminderView(SuperAdminBaseView):
    def post(self, request, invoice_id: str):
        invoice = get_object_or_404(SuperAdminInvoice, id=invoice_id)

        # No mailer wired in public schema; record an audit and bump status if still draft.
        if invoice.status == "draft":
            invoice.status = "sent"
            invoice.save(update_fields=["status", "updated_at"])

        audit_super_admin_action(
            request=request,
            action="invoice.reminder_sent",
            tenant_id=invoice.tenant.tenant_id if invoice.tenant_id else None,
            details={"invoice_number": invoice.invoice_number, "channel": "email"},
        )
        return Response(
            {
                "invoice_number": invoice.invoice_number,
                "status": invoice.status,
                "reminder_recorded": True,
            }
        )
