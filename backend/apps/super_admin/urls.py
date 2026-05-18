"""Super Admin Console URL Configuration.

Public-schema routes used by the Sprint 0/1 frontend contracts.
Legacy aliases are kept so older documents still resolve.
"""

from django.urls import path

from .views import (
    AuditLogExportView,
    AuditLogListView,
    BillingGSTR1ExportView,
    BillingInvoiceListCreateView,
    BillingMRRView,
    DashboardKPIView,
    PolicySettingsView,
    PoliciesExportView,
    PoliciesView,
    SchoolTenantDetailView,
    SchoolTenantListView,
    SchoolTenantProvisionView,
)

urlpatterns = [
    path("dashboard/", DashboardKPIView.as_view(), name="dashboard"),
    path("dashboard/kpis/", DashboardKPIView.as_view(), name="dashboard-kpis"),
    path("schools/", SchoolTenantListView.as_view(), name="schools"),
    path("school-tenants/", SchoolTenantListView.as_view(), name="school-tenants"),
    path("schools/provision/", SchoolTenantProvisionView.as_view(), name="schools-provision"),
    path("school-tenants/provision/", SchoolTenantProvisionView.as_view(), name="school-tenants-provision"),
    path("schools/<str:tenant_id>/", SchoolTenantDetailView.as_view(), name="schools-detail"),
    path("school-tenants/<str:tenant_id>/", SchoolTenantDetailView.as_view(), name="school-tenants-detail"),
    path("audit/", AuditLogListView.as_view(), name="audit"),
    path("audit-logs/", AuditLogListView.as_view(), name="audit-logs"),
    path("audit/export/", AuditLogExportView.as_view(), name="audit-export"),
    path("billing/invoices/", BillingInvoiceListCreateView.as_view(), name="billing-invoices"),
    path("billing/mrr/", BillingMRRView.as_view(), name="billing-mrr"),
    path("billing/export/gstr1/", BillingGSTR1ExportView.as_view(), name="billing-gstr1-export"),
    path("policies/", PoliciesView.as_view(), name="policies"),
    path("policies/settings/", PolicySettingsView.as_view(), name="policies-settings"),
    path("policies/export/", PoliciesExportView.as_view(), name="policies-export"),
]
