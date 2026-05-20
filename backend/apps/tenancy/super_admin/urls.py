from django.urls import path

from .views import (
    AnalyticsView,
    AuditActorsView,
    AuditExportView,
    AuditListView,
    BillingExportGstr1View,
    BillingInvoicesView,
    BillingMrrView,
    BillingPlansView,
    DashboardView,
    InvoiceMarkPaidView,
    InvoiceSendReminderView,
    PoliciesExportView,
    PoliciesView,
    SchoolActivateView,
    SchoolDetailView,
    SchoolImpersonateView,
    SchoolListView,
    SchoolLogoUploadView,
    SchoolProvisionView,
    SchoolSuspendView,
    SystemHealthView,
    TenantActivityTimelineView,
    TenantFeatureToggleView,
    TenantMigrationStatusView,
    TenantSubscriptionView,
)

urlpatterns = [
    path("dashboard/", DashboardView.as_view(), name="sa-dashboard"),

    path("schools/", SchoolListView.as_view(), name="sa-schools-list"),
    path("schools/provision/", SchoolProvisionView.as_view(), name="sa-schools-provision"),
    path("schools/<str:tenant_id>/", SchoolDetailView.as_view(), name="sa-schools-detail"),
    path("schools/<str:tenant_id>/activate/", SchoolActivateView.as_view(), name="sa-schools-activate"),
    path("schools/<str:tenant_id>/suspend/", SchoolSuspendView.as_view(), name="sa-schools-suspend"),
    path("schools/<str:tenant_id>/feature-flags/", TenantFeatureToggleView.as_view(), name="sa-schools-feature-flags"),
    path("schools/<str:tenant_id>/subscription/", TenantSubscriptionView.as_view(), name="sa-schools-subscription"),
    path("schools/<str:tenant_id>/migration-status/", TenantMigrationStatusView.as_view(), name="sa-schools-migration-status"),
    path("schools/<str:tenant_id>/impersonate/", SchoolImpersonateView.as_view(), name="sa-schools-impersonate"),
    path("schools/<str:tenant_id>/logo/", SchoolLogoUploadView.as_view(), name="sa-schools-logo"),

    path("billing/invoices/", BillingInvoicesView.as_view(), name="sa-billing-invoices"),
    path("billing/invoices/<str:invoice_id>/mark-paid/", InvoiceMarkPaidView.as_view(), name="sa-billing-mark-paid"),
    path("billing/invoices/<str:invoice_id>/reminder/", InvoiceSendReminderView.as_view(), name="sa-billing-reminder"),
    path("billing/mrr/", BillingMrrView.as_view(), name="sa-billing-mrr"),
    path("billing/plans/", BillingPlansView.as_view(), name="sa-billing-plans"),
    path("billing/export/gstr1/", BillingExportGstr1View.as_view(), name="sa-billing-gstr1"),

    path("audit/", AuditListView.as_view(), name="sa-audit-list"),
    path("audit/export/", AuditExportView.as_view(), name="sa-audit-export"),
    path("audit/actors/", AuditActorsView.as_view(), name="sa-audit-actors"),
    path("audit/timeline/<str:tenant_id>/", TenantActivityTimelineView.as_view(), name="sa-audit-timeline"),

    path("policies/", PoliciesView.as_view(), name="sa-policies"),
    path("policies/export/", PoliciesExportView.as_view(), name="sa-policies-export"),

    path("analytics/", AnalyticsView.as_view(), name="sa-analytics"),
    path("system-health/", SystemHealthView.as_view(), name="sa-system-health"),
]
