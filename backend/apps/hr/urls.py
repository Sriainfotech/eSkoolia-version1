from django.urls import path
from rest_framework.routers import DefaultRouter
from .attendance_endpoints import (
    StaffAttendanceDownloadSampleAPIView,
    StaffAttendanceExportAPIView,
    StaffAttendanceImportBulkAPIView,
)

from .views import (
    ApprovalChainPolicyViewSet,
    DepartmentViewSet,
    DepartmentTypeViewSet,
    DesignationViewSet,
    DesignationReorderView,
    LeaveDefineViewSet,
    LeaveRequestViewSet,
    LeaveTypeViewSet,
    OffboardingViewSet,
    PayrollRecordViewSet,
    StaffAttendanceViewSet,
    StaffViewSet,
    StaffDocumentViewSet,
    StaffOnboardDocumentListView,
    StaffOnboardDocumentUploadView,
    StaffOnboardDocumentPreviewView,
    StaffOnboardDocumentDeleteView,
    StaffOnboardDocumentStatusView,
    StaffOnboardDraftListView,
    StaffOnboardDraftSaveView,
    StaffOnboardDraftDeleteView,
    StaffOnboardBlankFormView,
    StaffOnboardFilledFormView,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="hr-department")
router.register("department-types", DepartmentTypeViewSet, basename="hr-department-type")
router.register("designations", DesignationViewSet, basename="hr-designation")
router.register("staff", StaffViewSet, basename="hr-staff")
router.register("staff-documents", StaffDocumentViewSet, basename="hr-staff-document")
router.register("leave-types", LeaveTypeViewSet, basename="hr-leave-type")
router.register("leave-defines", LeaveDefineViewSet, basename="hr-leave-define")
router.register("leave-requests", LeaveRequestViewSet, basename="hr-leave-request")
router.register("approval-chain-policies", ApprovalChainPolicyViewSet, basename="hr-approval-chain-policy")
router.register("staff-attendance", StaffAttendanceViewSet, basename="hr-staff-attendance")
router.register("payroll", PayrollRecordViewSet, basename="hr-payroll")
router.register("offboarding", OffboardingViewSet, basename="hr-offboarding")

urlpatterns = [
    path("designations/reorder/", DesignationReorderView.as_view(), name="hr-designation-reorder"),
    path("staff-attendance/download-sample/", StaffAttendanceDownloadSampleAPIView.as_view(), name="hr-staff-attendance-download-sample"),
    path("staff-attendance/export/", StaffAttendanceExportAPIView.as_view(), name="hr-staff-attendance-export"),
    path("staff-attendance/import/", StaffAttendanceImportBulkAPIView.as_view(), name="hr-staff-attendance-import"),
    # Onboarding wizard document endpoints
    path("onboard/documents/", StaffOnboardDocumentListView.as_view(), name="hr-onboard-doc-list"),
    path("onboard/documents/upload/", StaffOnboardDocumentUploadView.as_view(), name="hr-onboard-doc-upload"),
    path("onboard/documents/<int:pk>/preview/", StaffOnboardDocumentPreviewView.as_view(), name="hr-onboard-doc-preview"),
    path("onboard/documents/<int:pk>/", StaffOnboardDocumentDeleteView.as_view(), name="hr-onboard-doc-delete"),
    path("onboard/documents/<int:pk>/status/", StaffOnboardDocumentStatusView.as_view(), name="hr-onboard-doc-status"),
    # Onboarding wizard draft endpoints
    path("onboard/drafts/", StaffOnboardDraftListView.as_view(), name="hr-onboard-draft-list"),
    path("onboard/drafts/save/", StaffOnboardDraftSaveView.as_view(), name="hr-onboard-draft-save"),
    path("onboard/drafts/<int:pk>/", StaffOnboardDraftDeleteView.as_view(), name="hr-onboard-draft-delete"),
    # Blank onboarding form PDF
    path("onboard/blank-form/", StaffOnboardBlankFormView.as_view(), name="hr-onboard-blank-form"),
    # Filled onboarding form PDF (current wizard data)
    path("onboard/filled-form/", StaffOnboardFilledFormView.as_view(), name="hr-onboard-filled-form"),
] + router.urls
