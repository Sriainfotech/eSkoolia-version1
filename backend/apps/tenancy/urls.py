from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import SchoolViewSet, school_info_view
from .api import provision_tenant_view

router = DefaultRouter()
router.register("schools", SchoolViewSet, basename="school")

urlpatterns = router.urls + [
    # Super-admin tenant provisioning API (staging/dev only)
    path("super-admin/schools/provision/", provision_tenant_view, name="provision-tenant"),
    # Public endpoint: returns school name/logo for the login page (no auth required)
    path("school-info/", school_info_view, name="school-info"),
]

