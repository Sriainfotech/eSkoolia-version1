"""Public URL routes — served from the shared (public) schema.

These routes handle:
  - Health checks
  - Authentication (login, logout, password reset)
  - Super-admin console APIs
  - Tenant management / provisioning
  - Public school-info endpoint (for login page branding)

Active when MULTI_TENANCY_ENABLED=True and django-tenants routes
public-schema requests here. When the flag is off, config/urls.py
serves as the unified fallback.
"""
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.users.views import HealthView

urlpatterns = [
    path("health/", HealthView.as_view(), name="health-check"),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    # Auth: login, logout, me, change-password, forgot-password, OTP reset
    path("api/v1/auth/", include("apps.users.urls")),
    # Tenant management + public school-info
    path("api/v1/tenancy/", include("apps.tenancy.urls")),
    # Super-admin console (both v1 and legacy paths)
    path("api/super-admin/", include("apps.super_admin.urls")),
    path("api/v1/super-admin/", include("apps.super_admin.urls")),
]
