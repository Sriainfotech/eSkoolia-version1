from django.urls import path

from .views import (
    ChildAttendanceCalendarView,
    ChildDetailView,
    ChildFeesView,
    ChildrenListView,
    ParentMeView,
    ParentNoticesView,
)

urlpatterns = [
    path("me/", ParentMeView.as_view(), name="parent-me"),
    path("children/", ChildrenListView.as_view(), name="parent-children"),
    path("children/<int:pk>/", ChildDetailView.as_view(), name="parent-child-detail"),
    path("attendance/", ChildAttendanceCalendarView.as_view(), name="parent-attendance"),
    path("fees/", ChildFeesView.as_view(), name="parent-fees"),
    path("notices/", ParentNoticesView.as_view(), name="parent-notices"),
]
