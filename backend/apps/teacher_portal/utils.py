"""
Teacher Portal — Data Scope Utilities

These functions are the single source of truth for what a teacher
is allowed to access. Every teacher portal view that touches class,
section, or student data MUST call the appropriate assert function.

Scope is driven by actual assignment records in the database — not by
role names or hardcoded logic. When a school assigns a teacher to new
classes, the scope automatically expands. When assignments are removed,
access is revoked without any developer involvement.

Three distinct scopes:

1. ATTENDANCE scope
   → derived from ClassTeacherAssignment only
   → only the section(s) a teacher is the class teacher of
   → Kavya (Art teacher, no class teacher assignment) has an empty set here

2. SUBJECT scope
   → derived from ClassSubjectAssignment
   → (class_id, section_id, subject_id) triplets
   → controls what homework and lesson plans a teacher can create
   → Priya cannot create a Maths assignment for Class 4 (she teaches Hindi there)

3. STUDENT VIEW scope
   → union of ClassTeacherAssignment + ClassSubjectAssignment
   → any class/section where the teacher has ANY role
   → used to gate all student profile and student list endpoints

All scope functions accept a `user` (users.User instance) because
ClassSubjectAssignment.teacher and ClassTeacherAssignment.teacher
are both FK to users.User, not hr.Staff.
"""

from __future__ import annotations


from rest_framework.exceptions import PermissionDenied


# ── Academic year helper ──────────────────────────────────────────────────────

def get_current_academic_year(school):
    """
    Returns the current AcademicYear for the given school.
    Falls back to any active year if none is marked is_current.
    Returns None if no academic year exists (new school setup).
    """
    from apps.core.models import AcademicYear

    year = AcademicYear.objects.filter(school=school, is_current=True).first()
    if year is None:
        year = AcademicYear.objects.filter(school=school, is_active=True).first()
    return year


# ── Scope 1: Attendance ───────────────────────────────────────────────────────

def get_attendance_scope(user) -> frozenset[tuple[int, int]]:
    """
    Returns frozenset of (class_id, section_id) pairs where the user
    is the assigned class teacher.

    Only class teachers can mark attendance. A subject-only teacher
    (e.g. Art teacher across all classes) gets an empty set.
    """
    from apps.academics.models import ClassTeacherAssignment

    school = getattr(user, 'school', None)
    if not school:
        return frozenset()

    year = get_current_academic_year(school)
    qs = ClassTeacherAssignment.objects.filter(
        teacher=user,
        school=school,
        active_status=True,
    )
    if year:
        qs = qs.filter(academic_year=year)

    return frozenset(
        (row['school_class_id'], row['section_id'])
        for row in qs.values('school_class_id', 'section_id')
    )


# ── Scope 2: Subject (homework, lesson plans) ─────────────────────────────────

def get_subject_scope(user) -> frozenset[tuple[int, int, int]]:
    """
    Returns frozenset of (class_id, section_id, subject_id) triplets
    from ClassSubjectAssignment.

    A teacher can only create homework or lesson plans for subject+class
    combinations they are explicitly assigned to.

    Example: Priya is assigned Hindi to Class 4-A. She can create
    Hindi homework for Class 4-A. She cannot create Maths homework
    for Class 4-A even though she teaches Maths in Class 3-B.
    """
    from apps.academics.models import ClassSubjectAssignment

    school = getattr(user, 'school', None)
    if not school:
        return frozenset()

    year = get_current_academic_year(school)
    qs = ClassSubjectAssignment.objects.filter(
        teacher=user,
        school=school,
        active_status=True,
    )
    if year:
        qs = qs.filter(academic_year=year)

    return frozenset(
        (row['school_class_id'], row['section_id'], row['subject_id'])
        for row in qs.values('school_class_id', 'section_id', 'subject_id')
    )


# ── Scope 3: Student view ─────────────────────────────────────────────────────

def get_student_view_scope(user) -> frozenset[tuple[int, int]]:
    """
    Returns frozenset of (class_id, section_id) pairs where the teacher
    has ANY assignment — either class teacher or subject teacher.

    Used to gate student list and student profile endpoints.
    A teacher cannot view students from a class they have no connection to.
    """
    from apps.academics.models import ClassSubjectAssignment, ClassTeacherAssignment

    school = getattr(user, 'school', None)
    if not school:
        return frozenset()

    year = get_current_academic_year(school)

    # Subject assignments
    subj_qs = ClassSubjectAssignment.objects.filter(
        teacher=user, school=school, active_status=True
    )
    if year:
        subj_qs = subj_qs.filter(academic_year=year)
    subject_pairs = frozenset(
        (r['school_class_id'], r['section_id'])
        for r in subj_qs.values('school_class_id', 'section_id')
    )

    # Class teacher assignments
    ct_qs = ClassTeacherAssignment.objects.filter(
        teacher=user, school=school, active_status=True
    )
    if year:
        ct_qs = ct_qs.filter(academic_year=year)
    ct_pairs = frozenset(
        (r['school_class_id'], r['section_id'])
        for r in ct_qs.values('school_class_id', 'section_id')
    )

    return subject_pairs | ct_pairs


# ── Assert helpers (raise 403 on violation) ───────────────────────────────────

def assert_can_view_class(user, class_id: int, section_id: int) -> None:
    """
    Raises PermissionDenied if the teacher has no assignment in the
    requested class+section.

    Call this at the top of any view that accepts class_id + section_id
    as query params or path params.
    """
    scope = get_student_view_scope(user)
    if (class_id, section_id) not in scope:
        raise PermissionDenied(
            "You are not assigned to this class and section."
        )


def assert_can_mark_attendance(user, class_id: int, section_id: int) -> None:
    """
    Raises PermissionDenied if the teacher is not the class teacher
    of the requested section.

    Only class teachers can mark or edit attendance.
    """
    scope = get_attendance_scope(user)
    if (class_id, section_id) not in scope:
        raise PermissionDenied(
            "Only the class teacher of this section can mark attendance."
        )


def assert_can_create_homework(user, class_id: int, section_id: int, subject_id: int) -> None:
    """
    Raises PermissionDenied if the teacher is not assigned to teach
    this specific subject in this class+section.

    Prevents a Hindi teacher from creating Maths homework for a class
    where they only teach Hindi.

    Also used to gate lesson-plan creation — the underlying check (is this
    teacher assigned to teach this subject in this class+section?) is the
    same for both.
    """
    scope = get_subject_scope(user)
    if (class_id, section_id, subject_id) not in scope:
        raise PermissionDenied(
            "You are not assigned to teach this subject in this class and section."
        )


def build_subject_scope_q(user, class_field: str, section_field: str, subject_field: str):
    """
    Turns get_subject_scope(user) into a Django Q object over an arbitrary
    queryset's class/section/subject FK fields (possibly reached via `__`
    relation traversal, e.g. "homework__class_id_ref_id").

    Returns Q(pk__in=[]) — matches nothing — when the teacher has no subject
    assignments at all, so callers never need a separate empty-scope branch.
    """
    from django.db.models import Q

    scope = get_subject_scope(user)
    if not scope:
        return Q(pk__in=[])

    q = Q()
    for class_id, section_id, subject_id in scope:
        q |= Q(**{class_field: class_id, section_field: section_id, subject_field: subject_id})
    return q


def build_student_results(user, student_pk: int) -> dict:
    """
    Returns exam marks for one student (the Results tab on the student
    profile), gated the same way as build_student_profile: the teacher must
    have an assignment in the student's class+section.
    """
    from apps.students.models import Student
    from rest_framework.exceptions import NotFound

    school = getattr(user, 'school', None)
    try:
        student = Student.objects.select_related('current_class', 'current_section').get(
            pk=student_pk, school=school, is_active=True, is_deleted=False
        )
    except Student.DoesNotExist:
        raise NotFound("Student not found.")

    if student.current_class_id and student.current_section_id:
        assert_can_view_class(user, student.current_class_id, student.current_section_id)

    return _build_academic(student)


def build_pending_items(user) -> dict:
    """
    Extra notification-chip counts for TeacherMeView.pending_items, beyond
    attendance_pending (computed inline there from the class-teacher check).

    homework_to_review  — submissions not yet marked complete, across every
                           homework in the teacher's subject scope.
    lesson_plans_pending — this teacher's own lesson plans still in Draft.
    unread_messages      — unread in-app messages addressed to this teacher.
    """
    from apps.academics.models import HomeworkSubmission, LessonPlanner
    from apps.communication.models import InAppMessage

    school = getattr(user, 'school', None)
    if not school:
        return {'homework_to_review': 0, 'lesson_plans_pending': 0, 'unread_messages': 0}

    scope_q = build_subject_scope_q(
        user,
        'homework__class_id_ref_id', 'homework__section_id_ref_id', 'homework__subject_id_ref_id',
    )
    homework_to_review = HomeworkSubmission.objects.filter(
        scope_q, homework__school=school
    ).exclude(complete_status='C').count()

    lesson_plans_pending = LessonPlanner.objects.filter(
        teacher=user, school=school, workflow_status=LessonPlanner.WORKFLOW_DRAFT,
    ).count()

    unread_messages = InAppMessage.objects.filter(recipient=user, is_read=False).count()

    return {
        'homework_to_review': homework_to_review,
        'lesson_plans_pending': lesson_plans_pending,
        'unread_messages': unread_messages,
    }


# ── Teaching summary (used by /teacher/me/) ───────────────────────────────────

def build_teaching_summary(user) -> dict:
    """
    Builds the full teaching summary for the /teacher/me/ response.
    Groups ClassSubjectAssignment rows by subject, with student counts
    per section. Also returns the class teacher assignment if any.

    This is the data the frontend uses to compute the view layout
    (single-subject-many-classes vs multi-subject, class-teacher card, etc.)
    """
    from apps.academics.models import ClassSubjectAssignment, ClassTeacherAssignment
    from apps.students.models import Student

    school = getattr(user, 'school', None)
    if not school:
        return {'class_teacher_for': None, 'subject_assignments': []}

    year = get_current_academic_year(school)

    # ── Class teacher assignment ──────────────────────────────────────────────
    ct_qs = ClassTeacherAssignment.objects.select_related(
        'school_class', 'section'
    ).filter(teacher=user, school=school, active_status=True)
    if year:
        ct_qs = ct_qs.filter(academic_year=year)

    ct = ct_qs.first()
    class_teacher_for = None
    if ct:
        student_count = Student.objects.filter(
            current_class=ct.school_class,
            current_section=ct.section,
            is_active=True,
            is_deleted=False,
        ).count()
        class_teacher_for = {
            'class_id': ct.school_class_id,
            'class_name': ct.school_class.name if ct.school_class else '',
            'section_id': ct.section_id,
            'section_name': ct.section.name if ct.section else '',
            'student_count': student_count,
        }

    # ── Subject assignments ───────────────────────────────────────────────────
    subj_qs = ClassSubjectAssignment.objects.select_related(
        'school_class', 'section', 'subject'
    ).filter(teacher=user, school=school, active_status=True)
    if year:
        subj_qs = subj_qs.filter(academic_year=year)
    subj_qs = subj_qs.order_by(
        'subject__name', 'school_class__numeric_order', 'section__name'
    )

    # Group by subject
    subjects: dict[int, dict] = {}
    for a in subj_qs:
        sid = a.subject_id
        if sid not in subjects:
            subjects[sid] = {
                'subject_id': sid,
                'subject_name': a.subject.name if a.subject else '',
                'total_sections': 0,
                'total_students': 0,
                'sections': [],
            }

        student_count = Student.objects.filter(
            current_class=a.school_class,
            current_section=a.section,
            is_active=True,
            is_deleted=False,
        ).count()

        subjects[sid]['sections'].append({
            'class_id': a.school_class_id,
            'class_name': a.school_class.name if a.school_class else '',
            'section_id': a.section_id,
            'section_name': a.section.name if a.section else '',
            'student_count': student_count,
        })
        subjects[sid]['total_sections'] += 1
        subjects[sid]['total_students'] += student_count

    return {
        'class_teacher_for': class_teacher_for,
        'subject_assignments': list(subjects.values()),
    }


# ── Today's periods (used by /teacher/me/) ────────────────────────────────────

def build_todays_periods(user) -> list:
    """
    Returns today's ClassRoutineSlots for the teacher, ordered by start_time.
    Each slot includes is_now=True if current server time falls within
    the period's start_time–end_time window.
    """
    from datetime import datetime
    from apps.academics.models import ClassRoutineSlot

    school = getattr(user, 'school', None)
    if not school:
        return []

    today_name = datetime.now().strftime('%A').lower()   # e.g. "wednesday"
    now_time   = datetime.now().time()

    year = get_current_academic_year(school)
    qs = ClassRoutineSlot.objects.select_related(
        'school_class', 'section', 'subject'
    ).filter(
        teacher=user,
        school=school,
        day=today_name,
        active_status=True,
        is_break=False,
    )
    if year:
        qs = qs.filter(academic_year=year)
    qs = qs.order_by('start_time')

    periods = []
    for slot in qs:
        is_now = False
        is_done = False
        if slot.start_time and slot.end_time:
            is_now  = slot.start_time <= now_time <= slot.end_time
            is_done = slot.end_time < now_time

        periods.append({
            'period':       slot.class_period_id,
            'subject':      slot.subject.name if slot.subject else '',
            'class_name':   slot.school_class.name if slot.school_class else '',
            'section_name': slot.section.name if slot.section else '',
            'room':         slot.room or '',
            'from':         slot.start_time.strftime('%H:%M') if slot.start_time else '',
            'to':           slot.end_time.strftime('%H:%M') if slot.end_time else '',
            'is_now':       is_now,
            'is_done':      is_done,
        })
    return periods


# ── My Classes (used by /teacher/my-classes/) ────────────────────────────────

def build_my_classes(user) -> list:
    """
    Returns a deduplicated list of all class+section pairs assigned to the
    teacher — either as class teacher or as a subject teacher.

    Each entry includes:
      - class_id / class_name / section_id / section_name
      - is_class_teacher: True if this teacher is the class teacher of that section
      - subjects: list of subjects they teach in that section
      - student_count: live count from the students table

    Ordered by class numeric_order then section name so tabs appear in a
    sensible grade-ascending order.

    This is scope-safe by construction: it queries only the requesting user's
    own assignments. No URL param needed — no injection possible.
    """
    from apps.academics.models import ClassSubjectAssignment, ClassTeacherAssignment
    from apps.students.models import Student

    school = getattr(user, 'school', None)
    if not school:
        return []

    year = get_current_academic_year(school)

    # ── Class teacher assignments ─────────────────────────────────────────────
    ct_qs = ClassTeacherAssignment.objects.select_related(
        'school_class', 'section'
    ).filter(teacher=user, school=school, active_status=True)
    if year:
        ct_qs = ct_qs.filter(academic_year=year)

    ct_map: dict[tuple[int, int], bool] = {}
    for ct in ct_qs:
        ct_map[(ct.school_class_id, ct.section_id)] = True

    # ── Subject assignments ───────────────────────────────────────────────────
    subj_qs = ClassSubjectAssignment.objects.select_related(
        'school_class', 'section', 'subject'
    ).filter(teacher=user, school=school, active_status=True)
    if year:
        subj_qs = subj_qs.filter(academic_year=year)
    subj_qs = subj_qs.order_by(
        'school_class__numeric_order', 'section__name', 'subject__name'
    )

    # Group by (class_id, section_id)
    classes: dict[tuple[int, int], dict] = {}
    for a in subj_qs:
        key = (a.school_class_id, a.section_id)
        if key not in classes:
            classes[key] = {
                'class_id':      a.school_class_id,
                'class_name':    a.school_class.name if a.school_class else '',
                'section_id':    a.section_id,
                'section_name':  a.section.name if a.section else '',
                'is_class_teacher': key in ct_map,
                'subjects':      [],
                'student_count': 0,
            }
        classes[key]['subjects'].append(a.subject.name if a.subject else '')

    # Add class-teacher-only classes (teacher is CT but no subject assigned)
    for ct in ct_qs:
        key = (ct.school_class_id, ct.section_id)
        if key not in classes:
            classes[key] = {
                'class_id':      ct.school_class_id,
                'class_name':    ct.school_class.name if ct.school_class else '',
                'section_id':    ct.section_id,
                'section_name':  ct.section.name if ct.section else '',
                'is_class_teacher': True,
                'subjects':      [],
                'student_count': 0,
            }

    # Populate live student counts in bulk — one query per class/section pair
    for key, entry in classes.items():
        entry['student_count'] = Student.objects.filter(
            current_class_id=key[0],
            current_section_id=key[1],
            is_active=True,
            is_deleted=False,
        ).count()

    return list(classes.values())


def build_students_list(user, class_id: int, section_id: int) -> list:
    """
    Returns the full student list for a given class+section, scoped to the
    requesting teacher.

    Raises PermissionDenied (→ HTTP 403) if the teacher has no assignment
    in that class+section. This is the data-scope enforcement for Sprint 3.

    Fields returned per student:
      - id (PK), student_id (UUID), name, roll_no, admission_no, gender
      - photo_url (raw URL string from the photo field)
      - attendance_pct — (P + L) / (P + A + L + F) × 100 over last 90 days
      - avg_score (placeholder None until Results module in Sprint 6)

    Students are ordered by roll_no ascending; fall back to first_name when
    roll_no is absent.
    """
    from datetime import date, timedelta
    from collections import defaultdict
    from apps.students.models import Student
    from apps.attendance.models import StudentAttendance

    # ── Scope gate: 403 if not assigned ──────────────────────────────────────
    assert_can_view_class(user, class_id, section_id)

    school = getattr(user, 'school', None)
    if not school:
        return []

    students_qs = list(
        Student.objects.filter(
            school=school,
            current_class_id=class_id,
            current_section_id=section_id,
            is_active=True,
            is_deleted=False,
        ).order_by('roll_no', 'first_name', 'last_name')
    )

    if not students_qs:
        return []

    # Bulk attendance query — single DB hit for all students
    since = date.today() - timedelta(days=90)
    student_pks = [s.pk for s in students_qs]
    att_counts: dict = defaultdict(lambda: [0, 0])  # [present+late, total]
    for row in StudentAttendance.objects.filter(
        student_id__in=student_pks,
        school=school,
        attendance_date__gte=since,
        attendance_type__in=['P', 'A', 'L', 'F'],
    ).values('student_id', 'attendance_type'):
        sid = row['student_id']
        att_counts[sid][1] += 1
        if row['attendance_type'] in ('P', 'L'):
            att_counts[sid][0] += 1

    pct_map = {}
    for sid, (present, total) in att_counts.items():
        pct_map[sid] = round(present / total * 100, 1) if total > 0 else None

    students = []
    for s in students_qs:
        full_name = f"{s.first_name} {s.last_name}".strip()
        students.append({
            'id':             s.pk,
            'student_id':     str(s.student_id),
            'name':           full_name,
            'roll_no':        s.roll_no or '',
            'admission_no':   s.admission_no or '',
            'gender':         s.gender or '',
            'photo_url':      s.photo or None,
            'attendance_pct': pct_map.get(s.pk),
            'avg_score':      None,
        })

    return students


# ── Student profile (used by /teacher/students/<pk>/) ────────────────────────

# Tab → permission code mapping (matches PDF Sprint Plan Section 4)
TAB_PERMISSIONS = {
    'overview':      'students.view',
    'academic':      'results.view',
    'attendance':    'attendance.view',
    'behaviour':     'behaviour.view',
    'homework':      'homework.view',
    'communication': 'messages.view',
    'notes':         None,   # always available — no permission required
    'credentials':   'students.view',
}


def build_student_profile(user, student_pk: int) -> dict:
    """
    Returns the full permission-scoped student profile for the teacher portal.

    Steps:
    1. Fetch the student — 404 if not found or deleted.
    2. Assert the teacher has at least one assignment in the student's class+section
       (assert_can_view_class raises 403 if not).
    3. Derive sections_available from the teacher's actual permission_codes.
    4. For each available section, build and attach the data.

    Data sections:
      overview     — always included (name, DOB, gender, guardian, etc.)
      academic     — ExamMark rows for this student (requires results.view)
      attendance   — Last 90 days of StudentAttendance (requires attendance.view)
      behaviour    — AssignedIncident rows (requires behaviour.view)
      homework     — placeholder [] (no model yet; Sprint 6 will fill this)
      communication — placeholder [] (Sprint 7)
      notes        — placeholder null (future)

    Permission resolution uses user.get_permission_codes() so it honours
    wildcard (*) and multi-role unions automatically.
    """
    from apps.students.models import Student
    from rest_framework.exceptions import NotFound

    # ── 1. Fetch student ──────────────────────────────────────────────────────
    school = getattr(user, 'school', None)
    try:
        student = Student.objects.select_related(
            'current_class', 'current_section', 'guardian'
        ).get(pk=student_pk, school=school, is_active=True, is_deleted=False)
    except Student.DoesNotExist:
        raise NotFound("Student not found.")

    # ── 2. Data-scope gate ────────────────────────────────────────────────────
    if student.current_class_id and student.current_section_id:
        assert_can_view_class(user, student.current_class_id, student.current_section_id)

    # ── 3. Build sections_available from live permission codes ────────────────
    codes = user.get_permission_codes()
    is_privileged = '*' in codes

    def has_perm(code: str | None) -> bool:
        if code is None:
            return True
        return is_privileged or code in codes

    sections_available = [tab for tab, perm in TAB_PERMISSIONS.items() if has_perm(perm)]

    # ── 4. Build base overview data (always) ──────────────────────────────────
    guardian = student.guardian
    overview = {
        'id':             student.pk,
        'student_id':     str(student.student_id),
        'name':           f"{student.first_name} {student.last_name}".strip(),
        'roll_no':        student.roll_no or '',
        'admission_no':   student.admission_no or '',
        'gender':         student.gender or '',
        'photo_url':      student.photo or None,
        'date_of_birth':  student.date_of_birth.isoformat() if student.date_of_birth else None,
        'blood_group':    student.blood_group or '',
        'phone':          student.phone or '',
        'email':          student.email or '',
        'class_name':     student.current_class.name if student.current_class else '',
        'section_name':   student.current_section.name if student.current_section else '',
        'class_id':       student.current_class_id,
        'section_id':     student.current_section_id,
        'guardian_name':  guardian.full_name if guardian else '',
        'guardian_phone': guardian.phone if guardian else '',
        'guardian_relation': guardian.relation if guardian else '',
    }

    profile: dict = {
        'sections_available': sections_available,
        'overview':           overview,
        'academic':           None,
        'attendance':         None,
        'behaviour':          None,
        'homework':           [],
        'communication':      [],
        'notes':              None,
    }

    # ── 5. Academic data (results.view) ───────────────────────────────────────
    if 'academic' in sections_available:
        profile['academic'] = _build_academic(student)

    # ── 6. Attendance data (attendance.view) ──────────────────────────────────
    if 'attendance' in sections_available:
        profile['attendance'] = _build_attendance(student)

    # ── 7. Behaviour data (behaviour.view) ────────────────────────────────────
    if 'behaviour' in sections_available:
        profile['behaviour'] = _build_behaviour(student)

    return profile


def build_student_credentials(user, student_pk: int) -> dict:
    """
    Returns portal account info for the student and their guardian.
    Scope: same as StudentProfileView — teacher must be assigned to the class.
    """
    from apps.students.models import Student
    from rest_framework.exceptions import NotFound

    school = getattr(user, 'school', None)
    try:
        student = Student.objects.select_related(
            'user', 'guardian', 'guardian__user',
        ).get(pk=student_pk, school=school, is_active=True, is_deleted=False)
    except Student.DoesNotExist:
        raise NotFound("Student not found.")

    if student.current_class_id and student.current_section_id:
        assert_can_view_class(user, student.current_class_id, student.current_section_id)

    def _account_info(u):
        if not u:
            return {'has_account': False}
        return {
            'has_account':  True,
            'username':     u.username,
            'is_active':    u.is_active and u.access_status,
            'last_login':   u.last_login.isoformat() if u.last_login else None,
            'date_joined':  u.date_joined.isoformat() if u.date_joined else None,
        }

    guardian = student.guardian
    parent = {
        'guardian_name':     guardian.full_name if guardian else None,
        'guardian_relation': guardian.relation if guardian else None,
        **_account_info(guardian.user if guardian else None),
    }

    return {
        'student': _account_info(student.user),
        'parent':  parent,
    }


def _build_academic(student) -> dict:
    """
    Returns exam marks for the student grouped by exam term.
    Each row: exam_name, subject, obtained, full_marks, pass_marks, absent, date.
    """
    from apps.exams.models import ExamMark

    marks_qs = ExamMark.objects.select_related(
        'exam', 'exam__exam_type', 'schedule__subject'
    ).filter(
        student=student,
        school=student.school,
    ).order_by('exam__exam_type__title', 'schedule__exam_date')

    rows = []
    for m in marks_qs:
        rows.append({
            'exam_name':    m.exam.name if m.exam else '',
            'term':         m.exam.exam_type.title if (m.exam and m.exam.exam_type) else '',
            'subject':      m.schedule.subject.name if (m.schedule and m.schedule.subject) else '',
            'obtained':     float(m.obtained_marks),
            'full_marks':   float(m.schedule.full_marks) if m.schedule else 100.0,
            'pass_marks':   float(m.schedule.pass_marks) if m.schedule else 33.0,
            'absent':       m.absent,
            'exam_date':    m.schedule.exam_date.isoformat() if (m.schedule and m.schedule.exam_date) else None,
        })

    return {'marks': rows}


def _build_attendance(student) -> dict:
    """
    Returns last 90 days of attendance records for the student.
    Also returns summary counts for the period.
    """
    from datetime import date, timedelta
    from apps.attendance.models import StudentAttendance

    since = date.today() - timedelta(days=90)

    records_qs = StudentAttendance.objects.filter(
        student=student,
        school=student.school,
        attendance_date__gte=since,
    ).order_by('-attendance_date')

    STATUS_LABELS = {
        'P': 'Present',
        'A': 'Absent',
        'L': 'Late',
        'F': 'Half Day',
        'H': 'Holiday',
    }

    records = []
    counts = {'P': 0, 'A': 0, 'L': 0, 'F': 0, 'H': 0}
    for rec in records_qs:
        t = rec.attendance_type
        counts[t] = counts.get(t, 0) + 1
        records.append({
            'date':   rec.attendance_date.isoformat(),
            'status': t,
            'label':  STATUS_LABELS.get(t, t),
            'notes':  rec.notes or '',
        })

    total_school_days = counts['P'] + counts['A'] + counts['L'] + counts['F']
    attendance_pct = (
        round((counts['P'] + counts['L']) / total_school_days * 100, 1)
        if total_school_days > 0 else None
    )

    return {
        'records':        records,
        'summary': {
            'present':        counts['P'],
            'absent':         counts['A'],
            'late':           counts['L'],
            'half_day':       counts['F'],
            'holiday':        counts['H'],
            'attendance_pct': attendance_pct,
        },
    }


def _build_behaviour(student) -> dict:
    """
    Returns all behaviour incident assignments for the student.
    Positive points = commendations; negative = incidents.
    """
    from apps.behaviour.models import AssignedIncident

    incidents_qs = AssignedIncident.objects.select_related(
        'incident', 'assigned_by'
    ).filter(
        student=student,
        school=student.school,
    ).order_by('-created_at')

    records = []
    total_points = 0
    for ai in incidents_qs:
        records.append({
            'title':       ai.incident.title if ai.incident else '',
            'point':       ai.point,
            'description': ai.incident.description if ai.incident else '',
            'assigned_by': (
                f"{ai.assigned_by.first_name} {ai.assigned_by.last_name}".strip()
                if ai.assigned_by else ''
            ),
            'date': ai.created_at.date().isoformat(),
        })
        total_points += ai.point

    return {
        'records':      records,
        'total_points': total_points,
    }


# ── Weekly timetable (used by /teacher/timetable/) ────────────────────────────

ORDERED_DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

def build_weekly_timetable(user) -> dict:
    """
    Returns the teacher's full weekly timetable grouped by day.
    Also computes KPI counts used by the timetable screen header.
    """
    from datetime import datetime, timedelta
    from apps.academics.models import ClassRoutineSlot

    school = getattr(user, 'school', None)
    if not school:
        return {'days': [], 'kpis': {}, 'week_of': ''}

    today     = datetime.now().date()
    today_day = today.strftime('%A').lower()
    now_time  = datetime.now().time()

    # Start of current Mon–Sat week
    day_idx    = ORDERED_DAYS.index(today_day) if today_day in ORDERED_DAYS else 0
    week_start = today - timedelta(days=day_idx)
    week_of    = week_start.strftime('%Y-%m-%d')

    year = get_current_academic_year(school)
    qs = ClassRoutineSlot.objects.select_related(
        'school_class', 'section', 'subject'
    ).filter(
        teacher=user,
        school=school,
        active_status=True,
    )
    if year:
        qs = qs.filter(academic_year=year)
    qs = qs.order_by('day_id', 'start_time')

    # Group by day
    days_map: dict[str, list] = {d: [] for d in ORDERED_DAYS}
    total_teaching = 0
    cover_count    = 0

    for slot in qs:
        if slot.day not in days_map:
            continue
        is_now  = False
        is_done = False
        if slot.day == today_day and slot.start_time and slot.end_time:
            is_now  = slot.start_time <= now_time <= slot.end_time
            is_done = slot.end_time < now_time

        entry = {
            'period':       slot.class_period_id,
            'subject':      slot.subject.name if slot.subject else '',
            'class_name':   slot.school_class.name if slot.school_class else '',
            'section_name': slot.section.name if slot.section else '',
            'room':         slot.room or '',
            'from':         slot.start_time.strftime('%H:%M') if slot.start_time else '',
            'to':           slot.end_time.strftime('%H:%M') if slot.end_time else '',
            'is_break':     slot.is_break,
            'is_now':       is_now,
            'is_done':      is_done,
        }
        days_map[slot.day].append(entry)
        if not slot.is_break:
            total_teaching += 1

    days_out = [
        {
            'day':       d.capitalize(),
            'day_key':   d,
            'is_today':  d == today_day,
            'periods':   days_map[d],
        }
        for d in ORDERED_DAYS
    ]

    kpis = {
        'total_periods': total_teaching,
        'free_periods':  0,          # calculated after period grid is known
        'cover_assignments': cover_count,
        'teaching_days': sum(1 for d in days_out if len(d['periods']) > 0),
    }

    return {'days': days_out, 'kpis': kpis, 'week_of': week_of}
