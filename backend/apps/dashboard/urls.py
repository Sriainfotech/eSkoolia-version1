from django.urls import path
from .views import DashboardKPIView

urlpatterns = [
    path("kpis/", DashboardKPIView.as_view(), name="dashboard-kpis"),
]
