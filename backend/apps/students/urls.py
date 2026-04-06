from rest_framework.routers import DefaultRouter
from .views import (
    GuardianViewSet,
    StudentCategoryViewSet,
    StudentDocumentViewSet,
    StudentGroupViewSet,
    StudentMultiClassRecordViewSet,
    StudentPromotionHistoryViewSet,
    StudentRecordAuditViewSet,
    StudentSubjectAssignmentViewSet,
    StudentTransferHistoryViewSet,
    StudentViewSet,
)

router = DefaultRouter()
router.register("categories", StudentCategoryViewSet, basename="student-category")
router.register("groups", StudentGroupViewSet, basename="student-group")
router.register("guardians", GuardianViewSet, basename="guardian")
router.register("students", StudentViewSet, basename="student")
router.register("promotions", StudentPromotionHistoryViewSet, basename="student-promotion")
router.register("documents", StudentDocumentViewSet, basename="student-document")
router.register("transfers", StudentTransferHistoryViewSet, basename="student-transfer")
router.register("multi-class-records", StudentMultiClassRecordViewSet, basename="student-multi-class-record")
router.register("subject-assignments", StudentSubjectAssignmentViewSet, basename="student-subject-assignment")
router.register("record-audits", StudentRecordAuditViewSet, basename="student-record-audit")

urlpatterns = router.urls
