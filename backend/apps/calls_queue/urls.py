from rest_framework.routers import DefaultRouter

from .views import CallQueueEntryViewSet

router = DefaultRouter()
router.register("", CallQueueEntryViewSet, basename="call-queue-entry")

urlpatterns = router.urls
