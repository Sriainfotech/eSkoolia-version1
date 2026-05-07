from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
	AdmissionPincodeLookupAPIView,
	AdmissionFollowUpViewSet,
	AdmissionInquiryViewSet,
	AdminSetupEntryViewSet,
	AIGenerateView,
	AnalyticsOverviewView,
	BulkJobViewSet,
	CertificateTemplateViewSet,
	CertificateReadOnlyViewSet,
	ComplaintEntryViewSet,
	ConsentLogView,
	IdCardTemplateViewSet,
	IdCardReadOnlyViewSet,
	PhoneCallLogEntryViewSet,
	PipelineViewSet,
	PostalDispatchEntryViewSet,
	PostalReceiveEntryViewSet,
	VisitorBookEntryViewSet,
)

router = DefaultRouter()
router.register("inquiries", AdmissionInquiryViewSet, basename="admission-inquiry")
router.register("follow-ups", AdmissionFollowUpViewSet, basename="admission-followup")
router.register("visitors", VisitorBookEntryViewSet, basename="visitor-book")
router.register("complaints", ComplaintEntryViewSet, basename="complaint-entry")
router.register("postal-receive", PostalReceiveEntryViewSet, basename="postal-receive-entry")
router.register("postal-dispatch", PostalDispatchEntryViewSet, basename="postal-dispatch-entry")
router.register("phone-call-logs", PhoneCallLogEntryViewSet, basename="phone-call-log-entry")
router.register("admin-setups", AdminSetupEntryViewSet, basename="admin-setup-entry")
router.register("id-card-templates", IdCardTemplateViewSet, basename="id-card-template")
router.register("certificate-templates", CertificateTemplateViewSet, basename="certificate-template")
router.register("id-cards", IdCardReadOnlyViewSet, basename="id-card")
router.register("certificates", CertificateReadOnlyViewSet, basename="certificate")
# Command Center
router.register("pipeline", PipelineViewSet, basename="pipeline")
router.register("bulk", BulkJobViewSet, basename="bulk-job")

urlpatterns = [
	path("pincode-details/", AdmissionPincodeLookupAPIView.as_view(), name="admission-pincode-details"),
	path("ai/generate/", AIGenerateView.as_view(), name="ai-generate"),
	path("consent/", ConsentLogView.as_view(), name="consent-log"),
	path("analytics/overview/", AnalyticsOverviewView.as_view(), name="analytics-overview"),
	*router.urls,
]

