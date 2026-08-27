from rest_framework.routers import DefaultRouter
from django.urls import path

from .views import SchoolViewSet, school_info_view, my_school_info_view, whoami_view

router = DefaultRouter()
router.register("schools", SchoolViewSet, basename="school")

urlpatterns = router.urls + [
    # Public endpoint: returns school name/logo for the login page (no auth required)
    path("school-info/", school_info_view, name="school-info"),
    # Authenticated endpoint: returns full school details for receipts / documents
    path("my-school-info/", my_school_info_view, name="my-school-info"),
    # Public diagnostic: reflects Host-header-based tenant resolution for this request
    path("whoami/", whoami_view, name="tenancy-whoami"),
]

