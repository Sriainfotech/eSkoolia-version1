from django.urls import path
from rest_framework.routers import DefaultRouter
from .views import (
	AdmissionPincodeLookupAPIView,
	AdmissionFollowUpViewSet,
	AdmissionInquiryViewSet,
	AdminSetupEntryViewSet,
	CertificateTemplateViewSet,
	CertificateReadOnlyViewSet,
	ComplaintEntryViewSet,
	IdCardTemplateViewSet,
	IdCardReadOnlyViewSet,
	PhoneCallLogEntryViewSet,
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

urlpatterns = [
	path("pincode-details/", AdmissionPincodeLookupAPIView.as_view(), name="admission-pincode-details"),
	*router.urls,
]
