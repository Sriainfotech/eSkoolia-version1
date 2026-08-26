from django.urls import path

from .views import (
    ChildAttendanceCalendarView,
    ChildDetailView,
    ChildFeesView,
    ChildrenListView,
    ParentBehaviourView,
    ParentHealthView,
    ParentHomeworkView,
    ParentMeView,
    ParentMessagesView,
    ParentNoticesView,
    ParentReportCardView,
    ParentResultsView,
    ParentSyllabusView,
    ParentTimetableView,
)

urlpatterns = [
    path("me/", ParentMeView.as_view(), name="parent-me"),
    path("children/", ChildrenListView.as_view(), name="parent-children"),
    path("children/<int:pk>/", ChildDetailView.as_view(), name="parent-child-detail"),
    path("attendance/", ChildAttendanceCalendarView.as_view(), name="parent-attendance"),
    path("fees/", ChildFeesView.as_view(), name="parent-fees"),
    path("notices/", ParentNoticesView.as_view(), name="parent-notices"),
    # Item 5 — Academics
    path("timetable/", ParentTimetableView.as_view(), name="parent-timetable"),
    path("homework/", ParentHomeworkView.as_view(), name="parent-homework"),
    path("syllabus/", ParentSyllabusView.as_view(), name="parent-syllabus"),
    # Item 6 — Exam Results and Report Card
    path("results/", ParentResultsView.as_view(), name="parent-results"),
    path("results/report-card/", ParentReportCardView.as_view(), name="parent-report-card"),
    # Item 7 — Messages
    path("messages/", ParentMessagesView.as_view(), name="parent-messages"),
    # Item 8 — Behaviour Log
    path("behaviour/", ParentBehaviourView.as_view(), name="parent-behaviour"),
    # Item 9 — Health Log
    path("health/", ParentHealthView.as_view(), name="parent-health"),
]
