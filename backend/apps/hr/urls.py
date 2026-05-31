from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    DepartmentViewSet,
    DepartmentTypeViewSet,
    DesignationViewSet,
    DesignationReorderView,
    LeaveDefineViewSet,
    LeaveRequestViewSet,
    LeaveTypeViewSet,
    PayrollRecordViewSet,
    StaffAttendanceViewSet,
    StaffViewSet,
    StaffDocumentViewSet,
    StaffOnboardDocumentListView,
    StaffOnboardDocumentUploadView,
    StaffOnboardDocumentPreviewView,
    StaffOnboardDocumentDeleteView,
    StaffOnboardDocumentStatusView,
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
router.register("staff-attendance", StaffAttendanceViewSet, basename="hr-staff-attendance")
router.register("payroll", PayrollRecordViewSet, basename="hr-payroll")

urlpatterns = [
    path("designations/reorder/", DesignationReorderView.as_view(), name="hr-designation-reorder"),
    # Onboarding wizard document endpoints
    path("onboard/documents/", StaffOnboardDocumentListView.as_view(), name="hr-onboard-doc-list"),
    path("onboard/documents/upload/", StaffOnboardDocumentUploadView.as_view(), name="hr-onboard-doc-upload"),
    path("onboard/documents/<int:pk>/preview/", StaffOnboardDocumentPreviewView.as_view(), name="hr-onboard-doc-preview"),
    path("onboard/documents/<int:pk>/", StaffOnboardDocumentDeleteView.as_view(), name="hr-onboard-doc-delete"),
    path("onboard/documents/<int:pk>/status/", StaffOnboardDocumentStatusView.as_view(), name="hr-onboard-doc-status"),
] + router.urls
