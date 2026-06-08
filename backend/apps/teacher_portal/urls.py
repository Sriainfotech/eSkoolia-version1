from django.urls import path
from .views import (
    TeacherMeView,
    TeacherTimetableView,
    MyClassesView,
    StudentListView,
    StudentProfileView,
    StudentCredentialsView,
    StudentResetPasswordView,
    TeacherAttendanceFetchView,
    TeacherAttendanceStoreView,
)

urlpatterns = [
    path("me/",                          TeacherMeView.as_view(),               name="teacher-me"),
    path("timetable/",                   TeacherTimetableView.as_view(),        name="teacher-timetable"),
    # Sprint 3
    path("my-classes/",                  MyClassesView.as_view(),               name="teacher-my-classes"),
    path("students/",                    StudentListView.as_view(),              name="teacher-students"),
    # Sprint 4
    path("students/<int:pk>/",           StudentProfileView.as_view(),          name="teacher-student-profile"),
    # Sprint 5 — Credentials
    path("students/<int:pk>/credentials/",        StudentCredentialsView.as_view(),      name="teacher-student-credentials"),
    path("students/<int:pk>/reset-password/",     StudentResetPasswordView.as_view(),    name="teacher-student-reset-password"),
    # Sprint 5 — Attendance
    path("attendance/students/",         TeacherAttendanceFetchView.as_view(),  name="teacher-attendance-fetch"),
    path("attendance/store/",            TeacherAttendanceStoreView.as_view(),  name="teacher-attendance-store"),
]
