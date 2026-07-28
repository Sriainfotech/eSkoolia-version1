from rest_framework.routers import DefaultRouter

from .views import TodoItemViewSet

router = DefaultRouter()
router.register("", TodoItemViewSet, basename="todo")

urlpatterns = router.urls
