from django.urls import include, path
from rest_framework.routers import DefaultRouter

from .views import AIRequestLogViewSet, AIReviewView, CompetitionViewSet, ResultViewSet

router = DefaultRouter()
router.register(r"competitions", CompetitionViewSet, basename="competition")
router.register(r"results", ResultViewSet, basename="result")
router.register(r"ai/logs", AIRequestLogViewSet, basename="ai-log")

urlpatterns = [
    path("", include(router.urls)),
    path("ai/review/", AIReviewView.as_view(), name="ai-review"),
]
