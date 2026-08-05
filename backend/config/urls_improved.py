"""
Main URL configuration for the School ERP API.
Organizes all app routes and provides API documentation.
"""

from django.contrib import admin
from django.urls import path, include, re_path
from drf_spectacular.views import SpectacularAPIView, SpectacularSwaggerView, SpectacularRedocView
from apps.users.views import HealthView

# API Documentation routes
swagger_urls = [
    re_path(r'^api/schema/$', SpectacularAPIView.as_view(), name='schema'),
    re_path(r'^api/docs/$', SpectacularSwaggerView.as_view(url_name='schema'), name='swagger-ui'),
    re_path(r'^api/redoc/$', SpectacularRedocView.as_view(url_name='schema'), name='redoc'),
]

# Health check endpoint
health_urls = [
    path('health/', HealthView.as_view(), name='health-check'),
]

# Authentication routes
auth_urls = [
    path('auth/', include('apps.users.urls')),
]

# API v1 routes
api_v1_urls = [
    path('academics/', include('apps.academics.urls')),
    path('students/', include('apps.students.urls')),
    path('admissions/', include('apps.admissions.urls')),
    path('attendance/', include('apps.attendance.urls')),
    path('access-control/', include('apps.access_control.urls')),
    path('core/', include('apps.core.urls')),
]

urlpatterns = [
    # Django admin (only in development)
    path('admin/', admin.site.urls),
    
    # API Documentation
    *swagger_urls,
    
    # Health check
    *health_urls,
    
    # Authentication
    *auth_urls,
    
    # API v1
    path('api/', include(api_v1_urls)),
]
