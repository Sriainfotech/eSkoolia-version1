# Parent Portal API Reference

Base path: `/api/v1/parent/`

Every endpoint requires `Authorization: Bearer <JWT>` and enforces
`IsParentPortalUser` (must have a `role.portal_type="parent"` and a linked
`students.Guardian` via `request.user.guardian_profile`).

## Scope model

Every view starts from `request.user.guardian_profile` and, for endpoints
that take a `child_id`, resolves it through
`Student.objects.get(id=child_id, guardian=guardian, status="active")` —
implemented once as `apps.parent_portal.views._resolve_child(request)` and
reused by every endpoint added in items 5–9. A `child_id` that does not
belong to the authenticated guardian returns `404`, not `403` — this avoids
leaking whether a given student id exists at all.

`child_id` is a **required** query param on every endpoint below unless
noted otherwise; its absence returns `400`.

---

## Home / Children / Attendance / Fees / Notices (pre-existing)

| Method | URL | Notes |
|---|---|---|
| GET | `/me/` | Guardian profile + lightweight children list |
| GET | `/children/` | Children with 90-day attendance stats |
| GET | `/children/<id>/` | One child's full profile |
| GET | `/attendance/?child_id=&month=YYYY-MM` | Daily attendance + holidays for a month |
| GET | `/fees/?child_id=` | Fee assignments grouped by fees group |
| GET | `/notices/` | Published notices where `inform_to` is empty or contains `"parent"` |

---

## Academics

### `GET /timetable/?child_id=<id>`

`ClassRoutineSlot` rows for the child's `current_class` + `current_section`
(current academic year, `is_break=False`), sorted Monday→Saturday then by
start time.

```json
{ "child_id": 42, "slots": [
  { "day_of_week": "monday", "period_number": "1", "subject": "Maths",
    "teacher": "Priya Sharma", "start_time": "09:00", "end_time": "09:40", "room": "204" }
] }
```

### `GET /homework/?child_id=<id>`

`Homework` rows for the child's current class — class-wide homework
(`section_id_ref` is null) plus homework scoped to the child's own section —
ordered by `homework_date` descending. Each row includes the child's own
`HomeworkSubmission` (if the teacher has recorded one).

```json
[{ "id": 1, "subject": "Science", "section_name": "A", "homework_date": "2026-08-20",
   "submission_date": "2026-08-25", "description": "...", "file": null, "marks": 10.0,
   "submission": { "complete_status": "C", "marks": 9.0, "note": "Good work", "file": null } }]
```

### `GET /syllabus/?child_id=<id>`

`LessonTopic` groups (class-wide or the child's section) for every subject
in the child's current class, each with its `LessonTopicDetail` rows and a
completion count.

```json
[{ "id": 5, "subject": "English", "lesson_name": "Grammar Basics",
   "topics_done": 3, "topics_total": 6,
   "topics": [{ "title": "Nouns", "status": "Completed" }] }]
```

---

## Exam Results and Report Card

Both endpoints only return marks belonging to a **published** exam
(`exam.is_result_published=True`) — unpublished results never reach a
parent.

### `GET /results/?child_id=<id>`

Marks grouped by exam type (term):

```json
{ "child_id": 42, "terms": [
  { "term": "Mid Term", "marks": [
    { "subject": "Maths", "exam_name": "Mid Term 2026", "obtained": 78.0,
      "full_marks": 100.0, "pass_marks": 33.0, "absent": false, "exam_date": "2026-08-10" }
  ] }
] }
```

### `GET /results/report-card/?child_id=<id>`

One row per subject per term, with a grade looked up from
`ExamGradeScale` (by percentage, school-scoped) and a computed
`pass_fail`:

```json
{ "child_id": 42, "rows": [
  { "subject": "Maths", "term": "Mid Term", "obtained": 78.0, "full_marks": 100.0,
    "pass_marks": 33.0, "grade": "A", "pass_fail": "Pass" }
] }
```

`pass_fail` is `"Absent"` when the mark is flagged absent, otherwise
`"Pass"`/`"Fail"` from `obtained >= pass_marks`. `grade` is `""` when no
`ExamGradeScale` band matches (or the student was absent).

---

## Messages (Two-Way)

### `GET /messages/`

In-app messages where the guardian's portal account is sender or
recipient, newest first (capped at 200).

### `POST /messages/`

Body: `recipient_id`, `subject`, `body`, `category` (optional). `sender` is
set server-side to `request.user`; `school` is set from the guardian's
school.

---

## Behaviour Log

### `GET /behaviour/?child_id=<id>`

`AssignedIncident` rows for the child, newest first:

```json
[{ "id": 3, "incident_title": "Helped a classmate", "point": 5,
   "date": "2026-08-15", "note": "Positive behaviour recognition." }]
```

`note` is the underlying `Incident.description`.

---

## Health Log

### `GET /health/?child_id=<id>`

The child's medical profile fields, as captured at admission
(`students.Student` model — read-only, no separate health record model):

```json
{ "child_id": 42, "vision": "6/6", "medical_conditions": [], "allergies": ["Peanuts"],
  "current_medications": "", "treating_doctor": "", "vaccinations": ["MMR", "DTP"],
  "medical_notes": "", "is_pwd": false, "disability_types": [],
  "disability_percent": null, "disability_accommodations": "", "disability_notes": "" }
```

---

## Error shapes

- `400` — `child_id` missing, or serializer validation errors.
- `404` — `child_id` does not resolve to one of the guardian's active children
  (deliberately indistinguishable from "student doesn't exist").
