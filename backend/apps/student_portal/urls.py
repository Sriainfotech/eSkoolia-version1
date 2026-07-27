from django.urls import path

from .views import (
    StudentAcademicsView,
    StudentAttendanceView,
    StudentFeesView,
    StudentMeView,
    StudentNoticesView,
    StudentProfileView,
    StudentResultsView,
)

urlpatterns = [
    path("me/", StudentMeView.as_view(), name="student-me"),
    path("academics/", StudentAcademicsView.as_view(), name="student-academics"),
    path("attendance/", StudentAttendanceView.as_view(), name="student-attendance"),
    path("results/", StudentResultsView.as_view(), name="student-results"),
    path("fees/", StudentFeesView.as_view(), name="student-fees"),
    path("notices/", StudentNoticesView.as_view(), name="student-notices"),
    path("profile/", StudentProfileView.as_view(), name="student-profile"),
]
