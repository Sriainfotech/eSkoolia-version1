from django.urls import path, include

urlpatterns = [
    path('v1/reports/', include('apps.reports.urls')),
    path('v1/wallet/', include('apps.wallet.urls')),
]