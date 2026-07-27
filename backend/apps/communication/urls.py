from django.urls import path
from rest_framework.routers import DefaultRouter

from .views import (
    BroadcastAudienceOptionsView,
    BroadcastMessageView,
    CommunicationNotificationViewSet,
    CommunicationPreferenceViewSet,
    EmailMessageLogViewSet,
    EmailSmsLogViewSet,
    HolidayCalendarViewSet,
    InAppMessageViewSet,
    NoticeBoardViewSet,
)

router = DefaultRouter()
router.register("preferences", CommunicationPreferenceViewSet, basename="communication-preferences")
router.register("notifications", CommunicationNotificationViewSet, basename="communication-notifications")
router.register("messages", InAppMessageViewSet, basename="communication-messages")
router.register("emails", EmailMessageLogViewSet, basename="communication-emails")
router.register("email-logs", EmailSmsLogViewSet, basename="communication-email-logs")
router.register("notice-boards", NoticeBoardViewSet, basename="communication-notice-boards")
router.register("holiday-calendars", HolidayCalendarViewSet, basename="communication-holiday-calendars")

urlpatterns = [
    path("broadcast/audience-options/", BroadcastAudienceOptionsView.as_view(), name="broadcast-audience-options"),
    path("broadcast/", BroadcastMessageView.as_view(), name="broadcast-send"),
] + router.urls
