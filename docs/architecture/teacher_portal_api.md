# Teacher Portal API Reference

Base path: `/api/v1/teacher/`

Every endpoint requires `Authorization: Bearer <JWT>` and enforces
`IsTeacherPortalUser` (must have a `role.portal_type="teacher"` and a linked
`hr.Staff` record for `request.user.school`). No endpoint here accepts a
`school_id` parameter — the school is always `request.user.school`.

## Scope model

All data-scope logic lives in `apps/teacher_portal/utils.py`. Three scopes,
each derived from live assignment rows (never from role names):

| Scope | Source | Used by |
|---|---|---|
| Attendance | `ClassTeacherAssignment` | attendance fetch/store |
| Subject | `ClassSubjectAssignment` | homework, lesson plans, `/homework/`, `/lessons/` |
| Student view | `ClassTeacherAssignment` ∪ `ClassSubjectAssignment` | student list/profile/results |

`assert_can_view_class(user, class_id, section_id)` — 403 if the teacher has
no assignment (of any kind) in that class+section.

`assert_can_create_homework(user, class_id, section_id, subject_id)` — 403 if
the teacher is not assigned to teach that subject in that class+section. Also
used to gate lesson-plan create/update — the underlying check is identical.

`build_subject_scope_q(user, class_field, section_field, subject_field)` —
turns the subject scope into a `Q` object over any queryset's class/section/
subject fields (supports `__` relation traversal), so list endpoints can
filter to "everything in my scope" in one query.

---

## Home / Timetable / Classes (pre-existing)

| Method | URL | Notes |
|---|---|---|
| GET | `/me/` | Profile, class-teacher assignment, subject assignments, today's periods, `pending_items` |
| GET | `/timetable/` | Weekly timetable, grouped by day |
| GET | `/my-classes/` | All class+section pairs assigned to the teacher |
| GET | `/students/?class_id=&section_id=` | Student roster for one class+section |
| GET | `/students/<id>/` | Student profile (tabbed) |
| GET | `/students/<id>/credentials/` | Student/guardian portal account info |
| POST | `/students/<id>/reset-password/` | Reset student/guardian portal password |
| POST | `/attendance/students/` | Fetch roster + attendance for a date |
| POST | `/attendance/store/` | Save attendance for a date |

### `pending_items` (on `/me/`)

```json
{
  "homework_to_review": 3,
  "lesson_plans_pending": 1,
  "unread_messages": 2,
  "attendance_pending": true
}
```

- `homework_to_review` — `HomeworkSubmission` rows with `complete_status != 'C'`, across every homework in the teacher's subject scope.
- `lesson_plans_pending` — the teacher's own `LessonPlanner` rows with `workflow_status="draft"`.
- `unread_messages` — unread `InAppMessage` rows where the teacher is recipient.
- `attendance_pending` — `true` if the teacher is a class teacher (unchanged from before).

---

## Homework

Backing models: `apps.academics.models.Homework`, `HomeworkSubmission`.
Reuses `apps.academics.serializers.HomeworkSerializer` /
`HomeworkSubmissionSerializer` (same validation as the admin API — dates,
class/section match, school match — plus the teacher-scope assertion added
here).

### `GET /homework/`

List homework in the teacher's subject scope. Optional query params:
`class_id`, `section_id`, `subject_id` (further narrow within scope).

Response: array of `HomeworkSerializer` objects (id, class_id, section_id,
subject_id, homework_date, submission_date, evaluation_date, marks,
description, file, created_by, evaluations[...], ...).

### `POST /homework/`

Body: `class_id`, `section_id` (optional), `subject_id`, `homework_date`,
`submission_date`, `evaluation_date` (optional), `marks` (optional),
`description`, `file` (optional).

`school`, `academic_year` (current year if not supplied) and `created_by`
are set server-side. 403 if `(class_id, section_id, subject_id)` is not in
the teacher's subject scope.

### `GET /homework/<id>/`

Single homework. 403 if outside subject scope, 404 if not found/inactive.

### `PATCH /homework/<id>/`

Partial update. If class/section/subject is being changed, the *new*
triplet is re-checked against subject scope.

### `DELETE /homework/<id>/`

Soft delete — sets `active_status=False`. 204 on success.

### `GET /homework/<id>/submissions/`

List every `HomeworkSubmission` for one homework (scope-checked via the
parent homework). Response: array of `HomeworkSubmissionSerializer` objects.

### `PATCH /homework/submissions/<id>/grade/`

Body: any of `marks`, `complete_status` (`C`/`I`/`P`), `note`. Only these
three fields may change here. Scope-checked via the submission's parent
homework.

---

## Lesson Plans

Backing models: `LessonPlanner`, `Lesson`, `LessonTopic`, `LessonTopicDetail`.
Reuses `LessonPlannerSerializer` / `LessonTopicSerializer` from
`apps.academics.serializers`.

### `GET /lessons/`

List `LessonPlanner` rows in the teacher's subject scope. Optional query
params: `class_id`, `section_id`, `subject_id`, `workflow_status`
(`draft` / `submitted` / `under_review` / `approved` / `revision_requested`).

### `POST /lessons/`

Body (required): `class_id`, `subject_id`, `lesson_detail_id` (an existing
`Lesson` id — the "lesson group" this plan belongs to), `lesson_date`.
Optional: `section_id`, `lesson_id`, `topic_id`, `topic_detail_id`,
`sub_topic`, `teaching_method`, `general_objectives`,
`previous_knowledge`, `video_url`, `note`, etc. (full field list in
`LessonPlannerSerializer`).

`school`, `academic_year` (current year if not supplied), `teacher`
(always `request.user` — a teacher can only author their own plans),
`created_by`, `updated_by` are set server-side. 403 if
`(class_id, section_id, subject_id)` is outside the teacher's subject scope.

### `GET /lessons/<id>/`

Single lesson plan, including its `topics` (`LessonPlanTopic` rows).

### `PATCH /lessons/<id>/`

Partial update. Re-checks scope if class/section/subject changes.

### `GET /lesson-topics/?lesson=<id>`

Lists `LessonTopic` groups (each with nested `LessonTopicDetail` rows) for
one `Lesson`. `lesson` query param is required (400 if missing).
Scope-checked via the `LessonTopic`'s own (class, section, subject).

---

## Notices & Messages

### `GET /notices/`

Published notices (`is_published=True`, `publish_on <= today`) for the
teacher's school, where `inform_to` is empty (broadcast) or contains
`"teacher"`. Response: `[{id, title, message, notice_date, publish_on}]`.

### `GET /messages/`

In-app messages where the teacher is sender or recipient, newest first
(capped at 200). Response: array of `InAppMessageSerializer` objects.

### `POST /messages/`

Body: `recipient_id`, `subject`, `body`, `category` (optional, default
`general`). `sender` is set server-side to `request.user`.

---

## Student Results tab

### `GET /students/<id>/results/`

Returns exam marks for one student (`ExamMark` rows), grouped implicitly by
term via each row's `term`/`subject` fields:

```json
{ "marks": [
  { "exam_name": "...", "term": "...", "subject": "...", "obtained": 78.0,
    "full_marks": 100.0, "pass_marks": 33.0, "absent": false, "exam_date": "2026-02-10" }
] }
```

Scope-checked via `assert_can_view_class` — same rule as `/students/<id>/`.

---

## Error shapes

- `400` — missing/invalid params, or serializer validation errors
  (`{"field": ["message"]}` from DRF, or `{"detail": "..."}` for manual checks).
- `403` — scope violation (`PermissionDenied`, DRF default `{"detail": "..."}`).
- `404` — not found, or deliberately indistinguishable from "not yours"
  where enumeration is a concern.
