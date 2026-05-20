from django.db import models


DAY_CHOICES = [
    ("monday", "Monday"),
    ("tuesday", "Tuesday"),
    ("wednesday", "Wednesday"),
    ("thursday", "Thursday"),
    ("friday", "Friday"),
    ("saturday", "Saturday"),
    ("sunday", "Sunday"),
]


class ClassSubjectAssignment(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="class_subject_assignments")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="class_subject_assignments",
    )
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="subject_assignments")
    section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="subject_assignments",
    )
    subject = models.ForeignKey("core.Subject", on_delete=models.CASCADE, related_name="class_assignments")
    teacher = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="class_subject_assignments",
    )
    is_optional = models.BooleanField(default=False)
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "class_subject_assignments"
        ordering = ["school_class_id", "section_id", "subject_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "academic_year", "school_class", "section", "subject"],
                name="uq_class_section_subject_assignment",
            ),
        ]


class ClassTeacherAssignment(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="class_teacher_assignments")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="class_teacher_assignments",
    )
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="teacher_assignments")
    section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="teacher_assignments",
    )
    teacher = models.ForeignKey("users.User", on_delete=models.CASCADE, related_name="class_teacher_assignments")
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "class_teacher_assignments"
        ordering = ["school_class_id", "section_id", "teacher_id"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "academic_year", "school_class", "section"],
                name="uq_class_teacher_assignment_scope",
            ),
        ]


class ClassRoutineSlot(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="class_routine_slots")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="class_routine_slots",
    )
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="routine_slots")
    section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="routine_slots",
    )
    subject = models.ForeignKey(
        "core.Subject",
        on_delete=models.CASCADE,
        null=True,
        blank=True,
        related_name="routine_slots",
    )
    teacher = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="routine_slots",
    )
    day = models.CharField(max_length=10, choices=DAY_CHOICES)
    day_id = models.PositiveSmallIntegerField(null=True, blank=True)
    class_period_id = models.PositiveIntegerField(null=True, blank=True)
    start_time = models.TimeField()
    end_time = models.TimeField()
    room_id = models.PositiveIntegerField(null=True, blank=True)
    room = models.CharField(max_length=50, blank=True)
    is_break = models.BooleanField(default=False)
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "class_routine_slots"
        ordering = ["day", "start_time"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "academic_year", "school_class", "section", "day", "start_time"],
                name="uq_class_routine_slot",
            ),
        ]


class ClassOptionalSubjectSetup(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="class_optional_setups")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="class_optional_setups",
    )
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="optional_setups")
    gpa_above = models.DecimalField(max_digits=4, decimal_places=2, default=0)
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "class_optional_subject_setup"
        constraints = [
            models.UniqueConstraint(
                fields=["school", "academic_year", "school_class"],
                name="uq_optional_setup_scope",
            ),
        ]


class OptionalSubjectAssignment(models.Model):
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="optional_subject_assignments")
    subject = models.ForeignKey("core.Subject", on_delete=models.CASCADE, related_name="optional_student_assignments")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="optional_subject_assignments",
    )
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "optional_subject_assignments"
        constraints = [
            models.UniqueConstraint(
                fields=["student", "academic_year"],
                name="uq_optional_subject_student_year",
            ),
        ]


class Homework(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="homeworks")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="homeworks",
    )
    class_id_ref = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="homeworks")
    section_id_ref = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="homeworks",
    )
    subject_id_ref = models.ForeignKey("core.Subject", on_delete=models.CASCADE, related_name="homeworks")
    homework_date = models.DateField()
    submission_date = models.DateField()
    evaluation_date = models.DateField(null=True, blank=True)
    marks = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    description = models.TextField()
    file = models.CharField(max_length=400, blank=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_homeworks",
    )
    evaluated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="evaluated_homeworks",
    )
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "homeworks"
        ordering = ["-homework_date", "-created_at"]


class HomeworkSubmission(models.Model):
    COMPLETE_STATUS_CHOICES = [
        ("C", "Completed"),
        ("I", "Incomplete"),
        ("P", "Pending"),
    ]

    homework = models.ForeignKey(Homework, on_delete=models.CASCADE, related_name="evaluations")
    student = models.ForeignKey("students.Student", on_delete=models.CASCADE, related_name="homework_submissions")
    marks = models.DecimalField(max_digits=8, decimal_places=2, default=0)
    complete_status = models.CharField(max_length=1, choices=COMPLETE_STATUS_CHOICES, default="P")
    note = models.TextField(blank=True)
    file = models.CharField(max_length=400, blank=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_homework_submissions",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "homework_submissions"
        ordering = ["-created_at"]
        constraints = [
            models.UniqueConstraint(fields=["homework", "student"], name="uq_homework_student_submission"),
        ]


class UploadedContent(models.Model):
    CONTENT_TYPE_CHOICES = [
        ("as", "Assignment"),
        ("st", "Study Material"),
        ("sy", "Syllabus"),
        ("ot", "Others Download"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="uploaded_contents")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_contents",
    )
    content_title = models.CharField(max_length=200)
    content_type = models.CharField(max_length=2, choices=CONTENT_TYPE_CHOICES)
    available_for_admin = models.BooleanField(default=False)
    available_for_all_classes = models.BooleanField(default=False)
    class_id_ref = models.ForeignKey(
        "core.Class",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_contents",
    )
    section_id_ref = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_contents",
    )
    upload_date = models.DateField()
    description = models.TextField(blank=True)
    source_url = models.URLField(blank=True)
    upload_file = models.CharField(max_length=400, blank=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="uploaded_contents",
    )
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "uploaded_contents"
        ordering = ["-upload_date", "-created_at"]


class Lesson(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="lessons")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lessons",
    )
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="lessons")
    section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lessons",
    )
    subject = models.ForeignKey("core.Subject", on_delete=models.CASCADE, related_name="lessons")
    lesson_title = models.CharField(max_length=255)
    active_status = models.BooleanField(default=True)
    user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lesson_rows",
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_lessons",
    )
    updated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_lessons",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lessons"
        ordering = ["school_class_id", "section_id", "subject_id", "id"]


class LessonTopic(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="lesson_topics")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lesson_topics",
    )
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="topic_groups")
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="lesson_topics")
    section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lesson_topics",
    )
    subject = models.ForeignKey("core.Subject", on_delete=models.CASCADE, related_name="lesson_topics")
    active_status = models.BooleanField(default=True)
    user = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lesson_topic_rows",
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_lesson_topics",
    )
    updated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_lesson_topics",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lesson_topics"
        ordering = ["school_class_id", "section_id", "subject_id", "lesson_id", "id"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "academic_year", "school_class", "section", "subject", "lesson"],
                name="uq_lesson_topic_scope",
            ),
        ]


class LessonTopicDetail(models.Model):
    topic = models.ForeignKey(LessonTopic, on_delete=models.CASCADE, related_name="topics")
    lesson = models.ForeignKey(Lesson, on_delete=models.CASCADE, related_name="topic_details")
    topic_title = models.CharField(max_length=255)
    completed_status = models.CharField(max_length=50, blank=True)
    competed_date = models.DateField(null=True, blank=True)
    active_status = models.BooleanField(default=True)
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_lesson_topic_details",
    )
    updated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_lesson_topic_details",
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lesson_topic_details"
        ordering = ["id"]


class LessonPlanner(models.Model):
    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="lesson_plans")
    academic_year = models.ForeignKey(
        "core.AcademicYear",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lesson_plans",
    )
    day = models.PositiveSmallIntegerField(null=True, blank=True)
    active_status = models.BooleanField(default=True)
    lesson = models.ForeignKey(
        Lesson,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planner_lesson_refs",
    )
    topic = models.ForeignKey(
        LessonTopicDetail,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="planner_topic_refs",
    )
    lesson_detail = models.ForeignKey(
        Lesson,
        on_delete=models.CASCADE,
        related_name="lesson_plans",
    )
    topic_detail = models.ForeignKey(
        LessonTopicDetail,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lesson_plans",
    )
    sub_topic = models.CharField(max_length=255, blank=True)
    lecture_youube_link = models.TextField(blank=True)
    lecture_vedio = models.TextField(blank=True)
    attachment = models.CharField(max_length=400, blank=True)
    teaching_method = models.TextField(blank=True)
    general_objectives = models.TextField(blank=True)
    previous_knowlege = models.TextField(blank=True)
    comp_question = models.TextField(blank=True)
    zoom_setup = models.TextField(blank=True)
    presentation = models.TextField(blank=True)
    note = models.TextField(blank=True)
    lesson_date = models.DateField()
    competed_date = models.DateField(null=True, blank=True)
    completed_status = models.CharField(max_length=50, blank=True)
    room_id = models.PositiveIntegerField(null=True, blank=True)
    teacher = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lesson_plans",
    )
    class_period_id = models.PositiveIntegerField(null=True, blank=True)
    subject = models.ForeignKey("core.Subject", on_delete=models.CASCADE, related_name="lesson_plans")
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="lesson_plans")
    section = models.ForeignKey(
        "core.Section",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="lesson_plans",
    )
    created_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="created_lesson_plans",
    )
    updated_by = models.ForeignKey(
        "users.User",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="updated_lesson_plans",
    )
    routine_id = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lesson_planners"
        ordering = ["lesson_date", "routine_id", "id"]


class LessonPlanTopic(models.Model):
    topic = models.ForeignKey(LessonTopicDetail, on_delete=models.CASCADE, related_name="plan_topics")
    lesson_planner = models.ForeignKey(LessonPlanner, on_delete=models.CASCADE, related_name="topics")
    sub_topic_title = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "lesson_plan_topics"
        ordering = ["id"]


class ClassSubjectEntry(models.Model):
    """Simplified per-class subject catalog used during Foundation setup."""

    TYPE_CORE = "core"
    TYPE_CO_CURRICULAR = "co_curricular"
    TYPE_OPTIONAL = "optional"
    TYPE_CHOICES = [
        (TYPE_CORE, "Core"),
        (TYPE_CO_CURRICULAR, "Co-curricular"),
        (TYPE_OPTIONAL, "Optional"),
    ]

    school = models.ForeignKey("tenancy.School", on_delete=models.CASCADE, related_name="class_subject_entries")
    school_class = models.ForeignKey("core.Class", on_delete=models.CASCADE, related_name="subject_entries")
    name = models.CharField(max_length=200)
    code = models.CharField(max_length=20, blank=True)
    subject_type = models.CharField(max_length=20, choices=TYPE_CHOICES, default=TYPE_CORE)
    periods_per_week = models.PositiveSmallIntegerField(default=5)
    active_status = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "class_subject_entries"
        ordering = ["school_class_id", "name"]
        constraints = [
            models.UniqueConstraint(
                fields=["school", "school_class", "code"],
                name="uq_class_subject_entry",
            ),
        ]

    def __str__(self):
        return f"{self.school_class} - {self.name}"
