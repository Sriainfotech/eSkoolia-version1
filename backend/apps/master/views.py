from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .constants import LANGUAGES, RELIGIONS, COUNTRIES, EMPLOYMENT_TYPES


def _to_items(names):
    return [{"id": i + 1, "name": name} for i, name in enumerate(names)]


# Pre-build once at import time — constants never change
_LANGUAGES_DATA        = _to_items(LANGUAGES)
_RELIGIONS_DATA        = _to_items(RELIGIONS)
_COUNTRIES_DATA        = _to_items(COUNTRIES)
_EMPLOYMENT_TYPES_DATA = _to_items(EMPLOYMENT_TYPES)


class LanguageListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_LANGUAGES_DATA)


class ReligionListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_RELIGIONS_DATA)


class CountryListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_COUNTRIES_DATA)


class EmploymentTypeListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(_EMPLOYMENT_TYPES_DATA)
