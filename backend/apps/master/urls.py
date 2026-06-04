from django.urls import path
from .views import CountryListView, EmploymentTypeListView, LanguageListView, ReligionListView

urlpatterns = [
    path("languages/", LanguageListView.as_view(), name="master-languages"),
    path("religions/", ReligionListView.as_view(), name="master-religions"),
    path("countries/", CountryListView.as_view(), name="master-countries"),
    path("employment-types/", EmploymentTypeListView.as_view(), name="master-employment-types"),
]
