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
    HomeworkListCreateView,
    HomeworkDetailView,
    HomeworkSubmissionsListView,
    HomeworkSubmissionGradeView,
    LessonPlanListCreateView,
    LessonPlanDetailView,
    LessonTopicListView,
    TeacherNoticesView,
    TeacherMessagesView,
    StudentResultsView,
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
    # Sprint 6 — Homework
    path("homework/",                            HomeworkListCreateView.as_view(),       name="teacher-homework-list-create"),
    path("homework/<int:pk>/",                    HomeworkDetailView.as_view(),           name="teacher-homework-detail"),
    path("homework/<int:pk>/submissions/",        HomeworkSubmissionsListView.as_view(),  name="teacher-homework-submissions"),
    path("homework/submissions/<int:pk>/grade/",  HomeworkSubmissionGradeView.as_view(),  name="teacher-homework-submission-grade"),
    # Sprint 6 — Lesson Plans
    path("lessons/",                     LessonPlanListCreateView.as_view(),    name="teacher-lessons-list-create"),
    path("lessons/<int:pk>/",            LessonPlanDetailView.as_view(),        name="teacher-lesson-detail"),
    path("lesson-topics/",               LessonTopicListView.as_view(),         name="teacher-lesson-topics"),
    # Sprint 6 — Student Results tab
    path("students/<int:pk>/results/",   StudentResultsView.as_view(),          name="teacher-student-results"),
    # Sprint 7 — Notices & Messages
    path("notices/",                     TeacherNoticesView.as_view(),          name="teacher-notices"),
    path("messages/",                    TeacherMessagesView.as_view(),         name="teacher-messages"),
]
