from django.urls import path

from .views import (
    BotTelemetryCreateView,
    FAQListView,
    FAQLookupView,
    MessageTemplateLookupView,
    PersonalCalendarEventDetailView,
    PersonalCalendarEventListCreateView,
)

urlpatterns = [
    path('faq/', FAQListView.as_view(), name='assistant-faq-list'),
    path('faq/<slug:topic_key>/', FAQLookupView.as_view(), name='assistant-faq-lookup'),
    path('message-templates/<str:topic_key>/', MessageTemplateLookupView.as_view(), name='assistant-message-template-lookup'),
    path('telemetry/', BotTelemetryCreateView.as_view(), name='assistant-telemetry-create'),
    path('calendar-events/', PersonalCalendarEventListCreateView.as_view(), name='assistant-calendar-events'),
    path('calendar-events/<int:pk>/', PersonalCalendarEventDetailView.as_view(), name='assistant-calendar-event-detail'),
]
