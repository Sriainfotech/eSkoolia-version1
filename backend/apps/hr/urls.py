from rest_framework.routers import DefaultRouter

from .views import (
    DepartmentViewSet,
    DesignationViewSet,
    LeaveDefineViewSet,
    LeaveRequestViewSet,
    LeaveTypeViewSet,
    PayrollRecordViewSet,
    StaffAttendanceViewSet,
    StaffViewSet,
    StaffDocumentViewSet,
)

router = DefaultRouter()
router.register("departments", DepartmentViewSet, basename="hr-department")
router.register("designations", DesignationViewSet, basename="hr-designation")
router.register("staff", StaffViewSet, basename="hr-staff")
router.register("staff-documents", StaffDocumentViewSet, basename="hr-staff-document")
router.register("leave-types", LeaveTypeViewSet, basename="hr-leave-type")
router.register("leave-defines", LeaveDefineViewSet, basename="hr-leave-define")
router.register("leave-requests", LeaveRequestViewSet, basename="hr-leave-request")
router.register("staff-attendance", StaffAttendanceViewSet, basename="hr-staff-attendance")
router.register("payroll", PayrollRecordViewSet, basename="hr-payroll")

urlpatterns = router.urls
