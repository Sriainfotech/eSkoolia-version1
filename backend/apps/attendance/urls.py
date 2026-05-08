from django.urls import path

from .views import (
	StudentAttendanceBulkStoreAPIView,
	StudentAttendanceChatbotMarkAPIView,
	ClassAttendanceSummaryAPIView,
	StudentAttendanceDailySummaryAPIView,
	StudentAttendanceExportAPIView,
	StudentAttendanceDownloadSampleAPIView,
	StudentAttendanceImportAPIView,
	StudentAttendanceHolidayAPIView,
	StudentAttendanceIndexAPIView,
	StudentAttendanceListCreateAPIView,
	StudentAttendanceMonthlyReportAPIView,
	StudentAttendanceReportInsightsAPIView,
	StudentAttendanceRetrieveUpdateDeleteAPIView,
	StudentAttendanceStoreAPIView,
	StudentSearchAPIView,
)
from .subject_views import (
	SubjectAttendanceHolidayStoreAPIView,
	SubjectAttendanceIndexAPIView,
	SubjectAttendanceReportAPIView,
	SubjectAttendanceReportPrintAPIView,
	SubjectAttendanceReportSearchAPIView,
	SubjectAttendanceSearchAPIView,
	SubjectAttendanceStoreAPIView,
)

urlpatterns = [
	# Legacy aliases expected by older UAT/API scripts.
	path("student/", StudentAttendanceIndexAPIView.as_view(), name="student-attendance-legacy-index"),
	path("student/import/", StudentAttendanceImportAPIView.as_view(), name="student-attendance-legacy-import"),
	path("subject-attendance/", SubjectAttendanceIndexAPIView.as_view(), name="subject-attendance-legacy-index"),

	path("student-attendance/", StudentAttendanceListCreateAPIView.as_view(), name="student-attendance-list-create"),
	path("student-attendance/<int:pk>/", StudentAttendanceRetrieveUpdateDeleteAPIView.as_view(), name="student-attendance-detail"),
	path("student-attendance/index/", StudentAttendanceIndexAPIView.as_view(), name="student-attendance-index"),
	path("student-attendance/import/", StudentAttendanceImportAPIView.as_view(), name="student-attendance-import"),
	path("student-attendance/download-sample/", StudentAttendanceDownloadSampleAPIView.as_view(), name="student-attendance-download-sample"),
	path("student-attendance/chatbot-mark/", StudentAttendanceChatbotMarkAPIView.as_view(), name="student-attendance-chatbot-mark"),
	path("student-attendance/bulk-store/", StudentAttendanceBulkStoreAPIView.as_view(), name="student-attendance-bulk-store"),
	path("student-attendance/student-search/", StudentSearchAPIView.as_view(), name="student-search"),
	path("student-attendance/store/", StudentAttendanceStoreAPIView.as_view(), name="student-attendance-store"),
	path("student-attendance/holiday/", StudentAttendanceHolidayAPIView.as_view(), name="student-attendance-holiday"),
	path("student-attendance/report/", StudentAttendanceMonthlyReportAPIView.as_view(), name="student-attendance-report"),
	path("student-attendance/report-insights/", StudentAttendanceReportInsightsAPIView.as_view(), name="student-attendance-report-insights"),
	path("student-attendance/export/", StudentAttendanceExportAPIView.as_view(), name="student-attendance-export"),
	path("student-attendance/daily-summary/", StudentAttendanceDailySummaryAPIView.as_view(), name="student-attendance-daily-summary"),
	path("student-attendance/class-summary/", ClassAttendanceSummaryAPIView.as_view(), name="student-attendance-class-summary"),

	path("subject-attendance/index/", SubjectAttendanceIndexAPIView.as_view(), name="subject-attendance-index"),
	path("subject-attendance/search/", SubjectAttendanceSearchAPIView.as_view(), name="subject-attendance-search"),
	path("subject-attendance/store/", SubjectAttendanceStoreAPIView.as_view(), name="subject-attendance-store"),
	path("subject-attendance/holiday-store/", SubjectAttendanceHolidayStoreAPIView.as_view(), name="student-subject-holiday-store"),
	path("subject-attendance/report/", SubjectAttendanceReportAPIView.as_view(), name="subject-attendance-report-criteria"),
	path("subject-attendance/report-search/", SubjectAttendanceReportSearchAPIView.as_view(), name="subject-attendance-report-search"),
	path("subject-attendance/report/print/", SubjectAttendanceReportPrintAPIView.as_view(), name="subject-attendance-print"),
]
