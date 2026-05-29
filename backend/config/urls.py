from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import include, path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView
from apps.users.views import HealthView

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", HealthView.as_view(), name="health-check"),
    # Legacy compatibility endpoints expected by older UAT documents.
    path("admissions/", include("apps.admissions.urls")),
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path("api/docs/", SpectacularSwaggerView.as_view(url_name="schema"), name="swagger-ui"),
    path("api/v1/auth/", include("apps.users.urls")),
    path("api/v1/access-control/", include("apps.access_control.urls")),
    path("api/v1/admissions/", include("apps.admissions.urls")),
    path("api/v1/core/", include("apps.core.urls")),
    path("api/v1/students/", include("apps.students.urls")),
    path("api/v1/academics/", include("apps.academics.urls")),
    path("api/v1/attendance/", include("apps.attendance.urls")),
    path("api/v1/fees/", include("apps.fees.urls")),
    path("api/v1/exams/", include("apps.exams.urls")),
    path("api/v1/finance/", include("apps.finance.urls")),
    path("api/v1/hr/", include("apps.hr.urls")),
    path("api/v1/library/", include("apps.library.urls")),
    path("api/v1/behaviour/", include("apps.behaviour.urls")),
    path("api/v1/reports/", include("apps.reports.urls")),
    path("api/v1/tenancy/", include("apps.tenancy.urls")),
    path("api/super-admin/", include("apps.super_admin.urls")),
    path("api/v1/super-admin/", include("apps.super_admin.urls")),
    path("api/chat/", include("apps.chat.urls")),
    path("api/v1/utilities/communication/", include("apps.communication.urls")),
    path("api/v1/competitions/", include("apps.competitions.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Local non-DEBUG setups (daphne) still need /media/ served by Django
    # so uploaded school logos and other user media are reachable.
    # In real production, serve /media/ via nginx/CDN instead.
    from django.views.static import serve as _media_serve
    from django.urls import re_path
    urlpatterns += [
        re_path(
            r"^media/(?P<path>.*)$",
            _media_serve,
            {"document_root": settings.MEDIA_ROOT},
        ),
    ]
