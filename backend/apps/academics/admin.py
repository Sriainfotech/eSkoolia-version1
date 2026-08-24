from django.contrib import admin
from .models import (
	ClassOptionalSubjectSetup,
	ClassRoutineSlot,
	ClassSubjectAssignment,
	ClassTeacherAssignment,
	Homework,
	HomeworkSubmission,
	Lesson,
	LessonPlanApprovalLog,
	LessonPlanner,
	LessonPlanTopic,
	LessonTopic,
	LessonTopicDetail,
	OptionalSubjectAssignment,
	UploadedContent,
)

admin.site.register(ClassSubjectAssignment)
admin.site.register(ClassTeacherAssignment)
admin.site.register(ClassRoutineSlot)
admin.site.register(ClassOptionalSubjectSetup)
admin.site.register(OptionalSubjectAssignment)
admin.site.register(Homework)
admin.site.register(HomeworkSubmission)
admin.site.register(UploadedContent)
admin.site.register(Lesson)
admin.site.register(LessonTopic)
admin.site.register(LessonTopicDetail)
admin.site.register(LessonPlanner)
admin.site.register(LessonPlanTopic)
admin.site.register(LessonPlanApprovalLog)
