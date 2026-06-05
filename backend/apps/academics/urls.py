from rest_framework.routers import DefaultRouter
from .views import (
	ClassOptionalSubjectSetupViewSet,
	ClassRoutineSlotViewSet,
	ClassSubjectAssignmentViewSet,
	ClassSubjectEntryViewSet,
	ClassTeacherAssignmentViewSet,
	HomeworkSubmissionViewSet,
	HomeworkViewSet,
	LessonPlannerViewSet,
	LessonTopicDetailViewSet,
	LessonTopicViewSet,
	LessonViewSet,
	OptionalSubjectAssignmentViewSet,
	UploadedContentViewSet,
	# Staff Assignment Module
	StaffTeachersView,
	StaffClassTeachersView,
	StaffSubjectAssignmentsView,
	StaffWorkloadView,
	StaffAuditLogView,
	StaffDashboardKPIView,
)

router = DefaultRouter()
router.register("class-subjects", ClassSubjectAssignmentViewSet, basename="class-subject-assignment")
router.register("class-subject-entries", ClassSubjectEntryViewSet, basename="class-subject-entry")
router.register("class-teachers", ClassTeacherAssignmentViewSet, basename="class-teacher-assignment")
router.register("class-routines", ClassRoutineSlotViewSet, basename="class-routine-slot")
router.register("optional-subject-setups", ClassOptionalSubjectSetupViewSet, basename="class-optional-subject-setup")
router.register("optional-subject-assignments", OptionalSubjectAssignmentViewSet, basename="optional-subject-assignment")
router.register("homeworks", HomeworkViewSet, basename="homework")
router.register("homework-submissions", HomeworkSubmissionViewSet, basename="homework-submission")
router.register("upload-contents", UploadedContentViewSet, basename="uploaded-content")
router.register("lessons", LessonViewSet, basename="lesson")
router.register("lesson-topics", LessonTopicViewSet, basename="lesson-topic")
router.register("lesson-topic-details", LessonTopicDetailViewSet, basename="lesson-topic-detail")
router.register("lesson-planners", LessonPlannerViewSet, basename="lesson-planner")
# Staff Assignment Module routes
router.register("staff/teachers", StaffTeachersView, basename="staff-teachers")
router.register("staff/class-teachers", StaffClassTeachersView, basename="staff-class-teachers")
router.register("staff/subject-assignments", StaffSubjectAssignmentsView, basename="staff-subject-assignments")
router.register("staff/workload", StaffWorkloadView, basename="staff-workload")
router.register("staff/audit-log", StaffAuditLogView, basename="staff-audit-log")
router.register("staff/kpi", StaffDashboardKPIView, basename="staff-kpi")

urlpatterns = router.urls
