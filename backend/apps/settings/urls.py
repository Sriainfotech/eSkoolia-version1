from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DocumentBrandingHeaderImageView,
    DocumentBrandingPreviewView,
    DocumentBrandingSettingsView,
    DocumentBrandingUploadLetterheadView,
    LeaveBalanceViewSet,
    LeaveCarryForwardHistoryView,
    LeaveCarryForwardPreviewView,
    LeaveCarryForwardRunView,
    LeaveCarryForwardYearsView,
    LeaveOpeningBalanceImportView,
    LeavePolicyViewSet,
    SchoolAttendancePolicyViewSet,
    SchoolInfoLogoUploadView,
    SchoolInfoView,
    SchoolPolicyDocumentViewSet,
    SchoolSMTPSettingsViewSet,
    SettingsAuditLogViewSet,
    StaffHolidayCalendarView,
    StaffHolidayExclusionViewSet,
)

router = DefaultRouter()
router.register("leave-policy", LeavePolicyViewSet, basename="settings-leave-policy")
router.register("leave-balances", LeaveBalanceViewSet, basename="settings-leave-balance")
router.register("staff-holiday-exclusions", StaffHolidayExclusionViewSet, basename="settings-staff-holiday-exclusion")
router.register("smtp", SchoolSMTPSettingsViewSet, basename="settings-smtp")
router.register("audit-log", SettingsAuditLogViewSet, basename="settings-audit-log")
router.register("documents", SchoolPolicyDocumentViewSet, basename="settings-document")
router.register("attendance-policies", SchoolAttendancePolicyViewSet, basename="settings-attendance-policy")

urlpatterns = [
    path("school-info/", SchoolInfoView.as_view(), name="settings-school-info"),
    path("school-info/logo/", SchoolInfoLogoUploadView.as_view(), name="settings-school-info-logo"),
    path("document-branding/", DocumentBrandingSettingsView.as_view(), name="settings-document-branding"),
    path(
        "document-branding/upload-letterhead/",
        DocumentBrandingUploadLetterheadView.as_view(),
        name="settings-document-branding-upload-letterhead",
    ),
    path(
        "document-branding/header-image/",
        DocumentBrandingHeaderImageView.as_view(),
        name="settings-document-branding-header-image",
    ),
    path(
        "document-branding/preview/",
        DocumentBrandingPreviewView.as_view(),
        name="settings-document-branding-preview",
    ),
    path("staff-holiday-calendar/", StaffHolidayCalendarView.as_view(), name="settings-staff-holiday-calendar"),
    path("leave-carry-forward/years/", LeaveCarryForwardYearsView.as_view(), name="settings-leave-cf-years"),
    path("leave-carry-forward/preview/", LeaveCarryForwardPreviewView.as_view(), name="settings-leave-cf-preview"),
    path("leave-carry-forward/run/", LeaveCarryForwardRunView.as_view(), name="settings-leave-cf-run"),
    path("leave-carry-forward/history/", LeaveCarryForwardHistoryView.as_view(), name="settings-leave-cf-history"),
    path("leave-balances/import/", LeaveOpeningBalanceImportView.as_view(), name="settings-leave-balance-import"),
] + router.urls
