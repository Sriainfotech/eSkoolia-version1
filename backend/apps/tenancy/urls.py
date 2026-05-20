from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import SchoolViewSet
from .api import provision_tenant_view

router = DefaultRouter()
router.register("schools", SchoolViewSet, basename="school")

urlpatterns = router.urls + [
    # Super-admin tenant provisioning API (staging/dev only)
    path("super-admin/schools/provision/", provision_tenant_view, name="provision-tenant"),
]

