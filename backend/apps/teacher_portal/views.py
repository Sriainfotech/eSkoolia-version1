"""
Teacher Portal API views.
Views: TeacherMeView, TeacherTimetableView, MyClassesView, StudentListView,
       TeacherAttendanceFetchView, TeacherAttendanceStoreView

Data-scope rule enforced in every view:
  user = request.user
  All querysets filtered by school=user.school AND assignment scope from utils.py.
  Never trust URL params for class/section access — always assert via utils.

Sprint 0: TeacherMeView — verified routing + data scope foundation.
Sprint 2: TeacherTimetableView — weekly timetable.
Sprint 3: MyClassesView, StudentListView — class list + student roster.
Sprint 5: TeacherAttendanceFetchView, TeacherAttendanceStoreView — attendance marking.
"""

from datetime import date as date_type, datetime

from django.db import transaction
from rest_framework import status as http_status
from rest_framework.exceptions import ParseError
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.authentication import JWTAuthentication

from apps.attendance.holiday_utils import get_calendar_holiday

from .permissions import IsTeacherPortalUser
from .utils import (
    assert_can_create_homework,
    build_my_classes,
    build_pending_items,
    build_student_credentials,
    build_student_profile,
    build_student_results,
    build_students_list,
    build_subject_scope_q,
    build_teaching_summary,
    build_todays_periods,
    build_weekly_timetable,
    get_current_academic_year,
)


class TeacherMeView(APIView):
    """
    GET /api/v1/teacher/me/

    Returns the authenticated teacher's full profile:
      - Personal details (name, photo, designation, department)
      - class_teacher_for: the section they are class teacher of (or null)
      - subject_assignments: all subjects they teach, grouped by subject,
        with (class, section, student_count) per assignment
      - pending_items: counts the frontend uses for notification chips

    The frontend uses subject_assignments to dynamically compute the
    home screen layout:
      - 1 subject across many classes → group by class grade
      - Multiple subjects → group by subject
      - class_teacher_for present → pin class teacher card at top

    No hardcoded layout logic. The portal adapts automatically when
    the school admin changes class or subject assignments.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request):
        user = request.user

        # Fetch staff with department and designation in one query
        from apps.hr.models import Staff
        try:
            staff = Staff.objects.select_related(
                'department', 'designation', 'school'
            ).get(user=user)
        except Staff.DoesNotExist:
            return Response(
                {"detail": "Staff profile not found. Contact your administrator."},
                status=404
            )

        # Build teaching summary using utils — this is the scope-aware data
        summary = build_teaching_summary(user)

        # Today's periods from ClassRoutineSlot
        todays_periods = build_todays_periods(user)

        pending_items = {
            **build_pending_items(user),
            'attendance_pending': bool(summary['class_teacher_for']),
        }

        # Safe photo URL — only if file actually exists
        photo_url = None
        if staff.staff_photo:
            try:
                photo_url = request.build_absolute_uri(staff.staff_photo.url)
            except Exception:
                photo_url = None

        return Response({
            'staff_id': staff.staff_no,
            'name': f"{staff.first_name} {staff.last_name}".strip(),
            'first_name': staff.first_name,
            'last_name': staff.last_name,
            'email': staff.email,
            'phone': staff.phone,
            'designation': staff.designation.name if staff.designation else '',
            'designation_id': staff.designation_id,
            'department': staff.department.name if staff.department else '',
            'department_id': staff.department_id,
            'photo_url': photo_url,

            # Class teacher assignment (null if subject-only teacher)
            'class_teacher_for': summary['class_teacher_for'],

            # All subject+class+section assignments — used to build the portal layout
            'subject_assignments': summary['subject_assignments'],

            # Today's timetable slots — used by TeacherDayPlanner widget
            'todays_periods': todays_periods,

            # Notification chips on the home screen
            'pending_items': pending_items,
        })


class TeacherTimetableView(APIView):
    """
    GET /api/v1/teacher/timetable/

    Returns the teacher's weekly timetable from ClassRoutineSlot,
    scoped to request.user only. Grouped by day (Mon–Sat).
    Includes KPI counts for the timetable screen header cards.

    Scope-enforced: teacher only sees their own slots.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request):
        timetable = build_weekly_timetable(request.user)
        return Response(timetable)


class MyClassesView(APIView):
    """
    GET /api/v1/teacher/my-classes/

    Returns all class+section pairs assigned to the requesting teacher —
    either as class teacher or as a subject teacher. Deduplicated and
    ordered by grade.

    Scope-safe by construction: queries only from the requesting user's
    own assignment records. No URL params — no injection possible.

    Response shape:
      [
        {
          class_id, class_name, section_id, section_name,
          is_class_teacher, subjects[], student_count
        },
        ...
      ]
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request):
        classes = build_my_classes(request.user)
        return Response(classes)


class StudentListView(APIView):
    """
    GET /api/v1/teacher/students/?class_id=<int>&section_id=<int>

    Returns the student roster for a specific class+section.

    Data-scope enforced:
      - 400 if class_id or section_id params are missing or non-integer
      - 403 if the teacher has no assignment in the requested class+section
        (raised inside build_students_list → assert_can_view_class)

    Response shape:
      [
        {
          id, student_id, name, roll_no, admission_no, gender,
          photo_url, attendance_pct, avg_score
        },
        ...
      ]

    attendance_pct and avg_score are placeholders (null) until
    Sprint 5 (Attendance) and Sprint 6 (Results) are built.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request):
        # Validate required params
        try:
            class_id   = int(request.query_params['class_id'])
            section_id = int(request.query_params['section_id'])
        except (KeyError, ValueError, TypeError):
            raise ParseError("Both class_id and section_id are required integer query params.")

        students = build_students_list(request.user, class_id, section_id)
        return Response(students)


class StudentProfileView(APIView):
    """
    GET /api/v1/teacher/students/<int:pk>/

    Returns a permission-scoped student profile.

    sections_available[] tells the frontend exactly which tabs to render.
    It is built server-side from the requesting teacher's live permission
    codes — not from a role name and not from any client-supplied value.

    Data-scope:
      - 404 if the student does not exist or is inactive/deleted.
      - 403 if the student is not in any class+section assigned to this teacher.

    Per-section data:
      overview     — always returned (basic demographics + guardian)
      academic     — exam marks (requires results.view)
      attendance   — last 90 days (requires attendance.view)
      behaviour    — incident history (requires behaviour.view)
      homework     — placeholder [] (Sprint 6)
      communication — placeholder [] (Sprint 7)
      notes        — placeholder null

    Sprint 4: read-only data for all tabs.
    edit_allowed per tab (attendance.manage, results.manage) is gated in
    the frontend via the same usePermissions().can() hook.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request, pk: int):
        profile = build_student_profile(request.user, pk)
        return Response(profile)


# ── Sprint 5: Credentials ────────────────────────────────────────────────────

class StudentCredentialsView(APIView):
    """
    GET /api/v1/teacher/students/<pk>/credentials/

    Returns portal account info (username, active status, last login) for:
      - The student themselves
      - Their guardian (parent portal account)

    Scope: teacher must be assigned to the student's class+section.
    Permission: students.view
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request, pk: int):
        data = build_student_credentials(request.user, pk)
        return Response(data)


class StudentResetPasswordView(APIView):
    """
    POST /api/v1/teacher/students/<pk>/reset-portal-password/

    Resets the portal password for a student or their guardian.

    Body: { target: "student" | "parent" }

    Generates a random 10-char password, sets must_change_password=True,
    and returns the new password once so the teacher can share it.

    Permission: students.manage
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def post(self, request, pk: int):
        import secrets
        import string
        from apps.students.models import Student
        from rest_framework.exceptions import NotFound, PermissionDenied as DRFPermissionDenied

        user = request.user
        codes = user.get_permission_codes()
        if '*' not in codes and 'students.manage' not in codes:
            raise DRFPermissionDenied("You need students.manage permission to reset passwords.")

        school = getattr(user, 'school', None)
        try:
            student = Student.objects.select_related(
                'user', 'guardian', 'guardian__user'
            ).get(pk=pk, school=school, is_active=True, is_deleted=False)
        except Student.DoesNotExist:
            raise NotFound("Student not found.")

        target = request.data.get('target', 'student')

        if target == 'parent':
            guardian = student.guardian
            if not guardian or not guardian.user:
                return Response(
                    {'detail': 'Parent has no portal account.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            target_user = guardian.user
        else:
            if not student.user:
                return Response(
                    {'detail': 'Student has no portal account.'},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )
            target_user = student.user

        alphabet = string.ascii_letters + string.digits
        new_password = ''.join(secrets.choice(alphabet) for _ in range(10))
        target_user.set_password(new_password)
        target_user.must_change_password = True
        target_user.save(update_fields=['password', 'must_change_password'])

        return Response({
            'success':      True,
            'new_password': new_password,
            'username':     target_user.username,
            'target':       target,
        })


# ── Sprint 5: Attendance ──────────────────────────────────────────────────────

class TeacherAttendanceFetchView(APIView):
    """
    POST /api/v1/teacher/attendance/students/

    Returns the student roster for a class+section on a given date,
    with attendance status pre-filled from existing StudentAttendance rows.

    Body: { class_id: int, section_id: int, date: "YYYY-MM-DD" }

    Scope: only the class+section where the requesting teacher is class teacher.
    Response mirrors the admin student-search endpoint so the admin
    AttendanceTable component can be reused on the teacher portal unchanged.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def post(self, request):
        from .utils import assert_can_view_class, assert_can_mark_attendance
        from apps.students.models import Student
        from apps.attendance.models import StudentAttendance

        class_id = request.data.get("class_id")
        section_id = request.data.get("section_id")
        raw_date = request.data.get("date") or request.data.get("attendance_date")

        if not class_id or not section_id or not raw_date:
            return Response(
                {"success": False, "message": "class_id, section_id and date are required"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            class_id = int(class_id)
            section_id = int(section_id)
            attendance_date = date_type.fromisoformat(str(raw_date))
        except (ValueError, TypeError):
            return Response(
                {"success": False, "message": "Invalid class_id, section_id or date format"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if attendance_date > date_type.today():
            return Response(
                {"success": False, "message": "Attendance cannot be marked for future dates"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        # Any teacher assigned to this class/section can view attendance
        assert_can_view_class(request.user, class_id, section_id)

        # Only the class teacher of this section can edit — expose as can_edit for frontend
        can_edit = False
        try:
            assert_can_mark_attendance(request.user, class_id, section_id)
            can_edit = True
        except Exception:
            pass

        school_id = request.user.school_id
        from django.db.models import Q
        students = list(
            Student.objects.filter(
                current_class_id=class_id,
                is_active=True,
                school_id=school_id,
            )
            .filter(
                Q(current_section_id=section_id) | Q(current_section_id__isnull=True)
            )
            .order_by("roll_no", "id")
            .values("id", "admission_no", "first_name", "last_name", "roll_no")
        )

        student_ids = [s["id"] for s in students]
        attendance_rows: dict = {}
        for row in StudentAttendance.objects.filter(
            attendance_date=attendance_date,
            student_id__in=student_ids,
            school_id=school_id,
        ).order_by("-id"):
            if row.student_id not in attendance_rows:
                attendance_rows[row.student_id] = row

        table_students = []
        for student in students:
            sid = student["id"]
            att = attendance_rows.get(sid)
            table_students.append({
                "id": sid,
                "admission_no": student["admission_no"],
                "first_name": student["first_name"],
                "last_name": student["last_name"],
                "roll_no": student["roll_no"],
                "attendance_type": att.attendance_type if att else None,
                "attendance_note": att.notes if att else "",
                "arrival_time": att.arrival_time.strftime("%H:%M") if att and att.arrival_time else None,
                "sign_in_time": att.sign_in_time.strftime("%H:%M") if att and att.sign_in_time else None,
                "sign_out_time": att.sign_out_time.strftime("%H:%M") if att and att.sign_out_time else None,
                "pickup_time": att.pickup_time.strftime("%H:%M") if att and att.pickup_time else None,
                "pickup_by": att.pickup_by if att else "",
                "lunch": att.lunch if att else False,
            })

        any_marked = any(att for att in attendance_rows.values())
        any_locked = any(att.is_locked for att in attendance_rows.values())
        calendar_holiday = get_calendar_holiday(school_id, attendance_date)

        return Response({
            "date": str(attendance_date),
            "class_id": class_id,
            "section_id": section_id,
            "students": table_students,
            "is_marked": any_marked,
            "is_locked": any_locked,
            "can_edit": can_edit,
            "is_holiday": calendar_holiday is not None,
            "holiday_name": calendar_holiday.name if calendar_holiday else None,
        })


class TeacherAttendanceStoreView(APIView):
    """
    POST /api/v1/teacher/attendance/store/

    Saves attendance for a class+section on a given date.
    Accepts the same payload format as the admin store endpoint so the
    admin useAttendance hook can be reused unchanged.

    Scope: only the class+section where the requesting teacher is class teacher.
    Locked rows cannot be updated (admin override only).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    @staticmethod
    def _normalize_time(value):
        if value in (None, "", "—"):
            return None
        if hasattr(value, "hour"):
            return value
        if isinstance(value, str):
            for fmt in ["%H:%M", "%H:%M:%S"]:
                try:
                    return datetime.strptime(value.strip(), fmt).time()
                except ValueError:
                    continue
        raise ValueError("Invalid time format. Use HH:MM.")

    def post(self, request):
        from .utils import assert_can_mark_attendance
        from apps.students.models import Student
        from apps.attendance.models import StudentAttendance
        from apps.core.models import AcademicYear

        data = request.data
        class_id = data.get("class_id")
        section_id = data.get("section_id")
        raw_date = data.get("date")

        if not class_id or not section_id or not raw_date:
            return Response(
                {"success": False, "message": "class_id, section_id and date are required"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        try:
            class_id = int(class_id)
            section_id = int(section_id)
            attendance_date = date_type.fromisoformat(str(raw_date))
        except (ValueError, TypeError):
            return Response(
                {"success": False, "message": "Invalid parameters"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if attendance_date > date_type.today():
            return Response(
                {"success": False, "message": "Cannot mark attendance for future dates"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if attendance_date < date_type.today():
            return Response(
                {"success": False, "message": "Cannot edit past attendance. Contact admin to make changes."},
                status=http_status.HTTP_403_FORBIDDEN,
            )

        assert_can_mark_attendance(request.user, class_id, section_id)

        school_id = request.user.school_id
        attendance_map = data.get("attendance") or {}
        note_map = data.get("note") or {}
        lunch_map = data.get("lunch") or {}
        arrival_time_map = data.get("arrival_time") or {}
        sign_in_time_map = data.get("sign_in_time") or {}
        sign_out_time_map = data.get("sign_out_time") or {}
        pickup_time_map = data.get("pickup_time") or {}
        pickup_by_map = data.get("pickup_by") or {}
        lock_attendance = bool(data.get("lock_attendance", False))

        student_ids_raw = data.get("id") or list(attendance_map.keys())
        try:
            student_ids = [int(i) for i in student_ids_raw]
        except (ValueError, TypeError):
            return Response(
                {"success": False, "message": "Invalid student id list"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        if not student_ids:
            return Response(
                {"success": False, "message": "No students provided"},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        valid_types = {"P", "A", "L", "F", "H"}
        for sid, atype in attendance_map.items():
            if atype not in valid_types:
                return Response(
                    {"success": False, "message": f"Invalid attendance type '{atype}'"},
                    status=http_status.HTTP_400_BAD_REQUEST,
                )

        students_qs = list(
            Student.objects.filter(id__in=student_ids, school_id=school_id)
            .values("id")
        )
        student_set = {s["id"] for s in students_qs}

        ay = (
            AcademicYear.objects.filter(school_id=school_id, is_current=True).first()
            or AcademicYear.objects.filter(school_id=school_id).order_by("-start_date").first()
        )
        academic_year_id = ay.id if ay else None

        # A school-calendar holiday always wins over whatever type was submitted —
        # matches every other attendance write path (admin store, bulk import, chatbot mark).
        calendar_holiday = get_calendar_holiday(school_id, attendance_date)

        existing_map: dict = {}
        for row in StudentAttendance.objects.filter(
            student_id__in=student_ids,
            attendance_date=attendance_date,
            school_id=school_id,
        ).order_by("-id"):
            if row.student_id not in existing_map:
                existing_map[row.student_id] = row

        locked = [sid for sid, r in existing_map.items() if r.is_locked]
        if locked:
            return Response(
                {"success": False, "message": "Cannot update locked attendance. Only admin can override."},
                status=http_status.HTTP_400_BAD_REQUEST,
            )

        with transaction.atomic():
            StudentAttendance.objects.filter(
                student_id__in=student_ids,
                attendance_date=attendance_date,
                school_id=school_id,
            ).delete()

            for student_id in student_ids:
                if student_id not in student_set:
                    continue

                existing = existing_map.get(student_id)
                ex_type = existing.attendance_type if existing else None
                ex_note = existing.notes or "" if existing else ""
                ex_lunch = existing.lunch if existing else False
                ex_arrival = existing.arrival_time if existing else None
                ex_sign_in = existing.sign_in_time if existing else None
                ex_sign_out = existing.sign_out_time if existing else None
                ex_pickup = existing.pickup_time if existing else None
                ex_pickup_by = existing.pickup_by or "" if existing else ""

                sid_str = str(student_id)
                raw_type = attendance_map.get(sid_str) or attendance_map.get(student_id)
                new_type = "H" if calendar_holiday else (raw_type if raw_type else ex_type)
                if not new_type:
                    continue

                raw_note = note_map.get(sid_str)
                if raw_note is None:
                    raw_note = note_map.get(student_id)
                note_text = ex_note if raw_note is None else (raw_note or "")
                if calendar_holiday and not note_text:
                    note_text = "Holiday"

                raw_lunch = lunch_map.get(sid_str)
                if raw_lunch is None:
                    raw_lunch = lunch_map.get(student_id)
                new_lunch = bool(raw_lunch) if raw_lunch is not None else ex_lunch

                try:
                    new_arrival = self._normalize_time(arrival_time_map.get(sid_str, arrival_time_map.get(student_id))) if (sid_str in arrival_time_map or student_id in arrival_time_map) else ex_arrival
                    new_sign_in = self._normalize_time(sign_in_time_map.get(sid_str, sign_in_time_map.get(student_id))) if (sid_str in sign_in_time_map or student_id in sign_in_time_map) else ex_sign_in
                    new_sign_out = self._normalize_time(sign_out_time_map.get(sid_str, sign_out_time_map.get(student_id))) if (sid_str in sign_out_time_map or student_id in sign_out_time_map) else ex_sign_out
                    new_pickup = self._normalize_time(pickup_time_map.get(sid_str, pickup_time_map.get(student_id))) if (sid_str in pickup_time_map or student_id in pickup_time_map) else ex_pickup
                except ValueError as e:
                    return Response({"success": False, "message": str(e)}, status=http_status.HTTP_400_BAD_REQUEST)

                raw_pb = pickup_by_map.get(sid_str) or pickup_by_map.get(student_id)
                new_pickup_by = str(raw_pb).strip() if raw_pb is not None else ex_pickup_by

                StudentAttendance.objects.create(
                    student_id=student_id,
                    attendance_type=new_type,
                    notes=note_text,
                    lunch=new_lunch,
                    arrival_time=new_arrival,
                    sign_in_time=new_sign_in,
                    sign_out_time=new_sign_out,
                    pickup_time=new_pickup,
                    pickup_by=new_pickup_by,
                    attendance_date=attendance_date,
                    school_id=school_id,
                    academic_year_id=academic_year_id,
                    class_id=class_id,
                    section_id=section_id,
                    marked_by=request.user,
                    is_locked=lock_attendance,
                )

        response_payload = {"success": True, "message": "Attendance saved successfully"}
        if calendar_holiday is not None:
            response_payload["message"] = f"{attendance_date} is a holiday ({calendar_holiday.name}) — marked as Holiday."
            response_payload["holiday_name"] = calendar_holiday.name
        return Response(response_payload, status=http_status.HTTP_200_OK)


# ── Sprint 6: Homework ────────────────────────────────────────────────────────

class HomeworkListCreateView(APIView):
    """
    GET /api/v1/teacher/homework/
    Returns homework assignments for the authenticated teacher's scope.
    Scoped by get_subject_scope(user) — only homework in the teacher's
    assigned classes/subjects. Optional class_id/section_id/subject_id
    query params narrow further within that scope.

    POST /api/v1/teacher/homework/
    Creates a homework assignment. school, academic_year and created_by
    are set server-side. class_id/section_id/subject_id are validated
    against the teacher's subject scope via assert_can_create_homework —
    a teacher cannot create homework for a subject they don't teach.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request):
        from apps.academics.models import Homework
        from apps.academics.serializers import HomeworkSerializer

        user = request.user
        scope_q = build_subject_scope_q(user, 'class_id_ref_id', 'section_id_ref_id', 'subject_id_ref_id')
        qs = Homework.objects.select_related(
            'class_id_ref', 'section_id_ref', 'subject_id_ref', 'created_by',
        ).filter(scope_q, school=user.school, active_status=True)

        class_id = request.query_params.get('class_id')
        section_id = request.query_params.get('section_id')
        subject_id = request.query_params.get('subject_id')
        if class_id:
            qs = qs.filter(class_id_ref_id=class_id)
        if section_id:
            qs = qs.filter(section_id_ref_id=section_id)
        if subject_id:
            qs = qs.filter(subject_id_ref_id=subject_id)

        serializer = HomeworkSerializer(
            qs.order_by('-homework_date', '-created_at'), many=True, context={'request': request},
        )
        return Response(serializer.data)

    def post(self, request):
        from apps.academics.serializers import HomeworkSerializer

        user = request.user
        serializer = HomeworkSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        school_class = serializer.validated_data['class_id_ref']
        section = serializer.validated_data.get('section_id_ref')
        subject = serializer.validated_data['subject_id_ref']
        assert_can_create_homework(user, school_class.id, section.id if section else None, subject.id)

        academic_year = serializer.validated_data.get('academic_year') or get_current_academic_year(user.school)
        homework = serializer.save(school=user.school, academic_year=academic_year, created_by=user)
        return Response(
            HomeworkSerializer(homework, context={'request': request}).data, status=http_status.HTTP_201_CREATED,
        )


class HomeworkDetailView(APIView):
    """
    GET    /api/v1/teacher/homework/<id>/
    PATCH  /api/v1/teacher/homework/<id>/
    DELETE /api/v1/teacher/homework/<id>/

    Fetches, updates, or deletes a single homework assignment. In every
    case the homework's (class, section, subject) triplet is asserted
    against the teacher's subject scope before returning any data — a
    teacher cannot read or modify homework outside their own subjects,
    even by guessing an id.

    DELETE is a soft delete (active_status=False), matching the Homework
    model's existing active_status flag rather than removing the row.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def _get_homework(self, request, pk):
        from apps.academics.models import Homework
        from rest_framework.exceptions import NotFound

        user = request.user
        try:
            homework = Homework.objects.select_related(
                'class_id_ref', 'section_id_ref', 'subject_id_ref', 'created_by',
            ).get(pk=pk, school=user.school, active_status=True)
        except Homework.DoesNotExist:
            raise NotFound("Homework not found.")

        assert_can_create_homework(
            user, homework.class_id_ref_id, homework.section_id_ref_id, homework.subject_id_ref_id,
        )
        return homework

    def get(self, request, pk):
        from apps.academics.serializers import HomeworkSerializer
        homework = self._get_homework(request, pk)
        return Response(HomeworkSerializer(homework, context={'request': request}).data)

    def patch(self, request, pk):
        from apps.academics.serializers import HomeworkSerializer

        homework = self._get_homework(request, pk)
        serializer = HomeworkSerializer(homework, data=request.data, partial=True, context={'request': request})
        serializer.is_valid(raise_exception=True)

        # Re-check scope if the caller is moving the homework to a different class/section/subject
        new_class = serializer.validated_data.get('class_id_ref', homework.class_id_ref)
        new_section = serializer.validated_data.get('section_id_ref', homework.section_id_ref)
        new_subject = serializer.validated_data.get('subject_id_ref', homework.subject_id_ref)
        assert_can_create_homework(
            request.user, new_class.id, new_section.id if new_section else None, new_subject.id,
        )

        homework = serializer.save()
        return Response(HomeworkSerializer(homework, context={'request': request}).data)

    def delete(self, request, pk):
        homework = self._get_homework(request, pk)
        homework.active_status = False
        homework.save(update_fields=['active_status', 'updated_at'])
        return Response(status=http_status.HTTP_204_NO_CONTENT)


class HomeworkSubmissionsListView(APIView):
    """
    GET /api/v1/teacher/homework/<id>/submissions/

    Returns every student submission recorded against one homework
    assignment. The homework itself is scope-checked the same way as
    HomeworkDetailView before any submissions are returned.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request, pk):
        from apps.academics.models import Homework, HomeworkSubmission
        from apps.academics.serializers import HomeworkSubmissionSerializer
        from rest_framework.exceptions import NotFound

        user = request.user
        try:
            homework = Homework.objects.get(pk=pk, school=user.school, active_status=True)
        except Homework.DoesNotExist:
            raise NotFound("Homework not found.")

        assert_can_create_homework(
            user, homework.class_id_ref_id, homework.section_id_ref_id, homework.subject_id_ref_id,
        )

        submissions = HomeworkSubmission.objects.select_related('student', 'created_by').filter(
            homework=homework,
        ).order_by('student__roll_no', 'student__first_name')
        return Response(
            HomeworkSubmissionSerializer(submissions, many=True, context={'request': request}).data,
        )


class HomeworkSubmissionGradeView(APIView):
    """
    PATCH /api/v1/teacher/homework/submissions/<id>/grade/

    Grades one student's homework submission — sets marks, complete_status
    and/or note. The parent homework is scope-checked before the update is
    allowed, same rule as every other homework endpoint. Only marks,
    complete_status and note may be changed here — homework/student links
    are immutable once a submission exists.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def patch(self, request, pk):
        from apps.academics.models import HomeworkSubmission
        from apps.academics.serializers import HomeworkSubmissionSerializer
        from rest_framework.exceptions import NotFound

        user = request.user
        try:
            submission = HomeworkSubmission.objects.select_related('homework', 'student').get(
                pk=pk, homework__school=user.school,
            )
        except HomeworkSubmission.DoesNotExist:
            raise NotFound("Submission not found.")

        homework = submission.homework
        assert_can_create_homework(
            user, homework.class_id_ref_id, homework.section_id_ref_id, homework.subject_id_ref_id,
        )

        allowed = {k: v for k, v in request.data.items() if k in ('marks', 'complete_status', 'note')}
        serializer = HomeworkSubmissionSerializer(
            submission, data=allowed, partial=True, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)
        submission = serializer.save()
        return Response(HomeworkSubmissionSerializer(submission, context={'request': request}).data)


# ── Sprint 6: Lesson Plans ─────────────────────────────────────────────────────

class LessonPlanListCreateView(APIView):
    """
    GET /api/v1/teacher/lessons/
    Lists lesson plans (LessonPlanner rows) within the teacher's subject
    scope, filtered by get_subject_scope(user) on (class, section, subject).
    Optional class_id/section_id/subject_id/workflow_status query params
    narrow further within that scope.

    POST /api/v1/teacher/lessons/
    Creates a lesson plan. teacher and school are set server-side —
    class_id/subject_id (and section_id if present) must match a subject
    the requesting teacher is actually assigned to teach.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request):
        from apps.academics.models import LessonPlanner
        from apps.academics.serializers import LessonPlannerSerializer

        user = request.user
        scope_q = build_subject_scope_q(user, 'school_class_id', 'section_id', 'subject_id')
        qs = LessonPlanner.objects.select_related(
            'school_class', 'section', 'subject', 'lesson', 'topic', 'lesson_detail', 'topic_detail', 'teacher',
        ).prefetch_related('topics__topic').filter(scope_q, school=user.school)

        class_id = request.query_params.get('class_id')
        section_id = request.query_params.get('section_id')
        subject_id = request.query_params.get('subject_id')
        workflow_status = request.query_params.get('workflow_status')
        if class_id:
            qs = qs.filter(school_class_id=class_id)
        if section_id:
            qs = qs.filter(section_id=section_id)
        if subject_id:
            qs = qs.filter(subject_id=subject_id)
        if workflow_status:
            qs = qs.filter(workflow_status=workflow_status)

        serializer = LessonPlannerSerializer(qs.order_by('-lesson_date'), many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request):
        from apps.academics.serializers import LessonPlannerSerializer

        user = request.user
        serializer = LessonPlannerSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)

        school_class = serializer.validated_data['school_class']
        section = serializer.validated_data.get('section')
        subject = serializer.validated_data['subject']
        assert_can_create_homework(user, school_class.id, section.id if section else None, subject.id)

        academic_year = serializer.validated_data.get('academic_year') or get_current_academic_year(user.school)
        lesson_plan = serializer.save(
            school=user.school, academic_year=academic_year, teacher=user, created_by=user, updated_by=user,
        )
        return Response(
            LessonPlannerSerializer(lesson_plan, context={'request': request}).data,
            status=http_status.HTTP_201_CREATED,
        )


class LessonPlanDetailView(APIView):
    """
    GET   /api/v1/teacher/lessons/<id>/
    PATCH /api/v1/teacher/lessons/<id>/

    Returns / updates one lesson plan, including its topics (LessonPlanTopic
    rows via the serializer's `topics` field). Scope-checked the same way
    as the list/create endpoint — the lesson plan's (class, section,
    subject) triplet must be in the teacher's subject scope.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def _get_lesson_plan(self, request, pk):
        from apps.academics.models import LessonPlanner
        from rest_framework.exceptions import NotFound

        user = request.user
        try:
            lesson_plan = LessonPlanner.objects.select_related(
                'school_class', 'section', 'subject', 'lesson', 'topic', 'lesson_detail', 'topic_detail', 'teacher',
            ).prefetch_related('topics__topic').get(pk=pk, school=user.school)
        except LessonPlanner.DoesNotExist:
            raise NotFound("Lesson plan not found.")

        assert_can_create_homework(
            user, lesson_plan.school_class_id, lesson_plan.section_id, lesson_plan.subject_id,
        )
        return lesson_plan

    def get(self, request, pk):
        from apps.academics.serializers import LessonPlannerSerializer
        lesson_plan = self._get_lesson_plan(request, pk)
        return Response(LessonPlannerSerializer(lesson_plan, context={'request': request}).data)

    def patch(self, request, pk):
        from apps.academics.serializers import LessonPlannerSerializer

        lesson_plan = self._get_lesson_plan(request, pk)
        serializer = LessonPlannerSerializer(
            lesson_plan, data=request.data, partial=True, context={'request': request},
        )
        serializer.is_valid(raise_exception=True)

        new_class = serializer.validated_data.get('school_class', lesson_plan.school_class)
        new_section = serializer.validated_data.get('section', lesson_plan.section)
        new_subject = serializer.validated_data.get('subject', lesson_plan.subject)
        assert_can_create_homework(
            request.user, new_class.id, new_section.id if new_section else None, new_subject.id,
        )

        lesson_plan = serializer.save(updated_by=request.user)
        return Response(LessonPlannerSerializer(lesson_plan, context={'request': request}).data)


class LessonTopicListView(APIView):
    """
    GET /api/v1/teacher/lesson-topics/?lesson=<id>

    Lists LessonTopic groups (each with its nested LessonTopicDetail rows)
    for one Lesson. lesson is required. Scope-checked against the
    teacher's subject scope via the LessonTopic's own (class, section,
    subject).
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request):
        from apps.academics.models import LessonTopic
        from apps.academics.serializers import LessonTopicSerializer

        lesson_id = request.query_params.get('lesson')
        if not lesson_id:
            raise ParseError("lesson query param is required.")

        user = request.user
        scope_q = build_subject_scope_q(user, 'school_class_id', 'section_id', 'subject_id')
        qs = LessonTopic.objects.select_related(
            'school_class', 'section', 'subject', 'lesson',
        ).prefetch_related('topics').filter(scope_q, school=user.school, lesson_id=lesson_id, active_status=True)

        serializer = LessonTopicSerializer(qs, many=True, context={'request': request})
        return Response(serializer.data)


# ── Sprint 7: Notices & Messages ────────────────────────────────────────────────

class TeacherNoticesView(APIView):
    """
    GET /api/v1/teacher/notices/

    Returns published notices for the teacher's school. Filters to
    notices where inform_to is empty (broadcast to all) or contains
    'teacher' — mirrors apps.parent_portal.views.ParentNoticesView's
    'parent' check.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request):
        from apps.communication.models import NoticeBoard

        user = request.user
        today = date_type.today()
        notices_qs = NoticeBoard.objects.filter(
            school=user.school,
            is_published=True,
            publish_on__lte=today,
        ).order_by('-publish_on', '-notice_date')[:50]

        result = []
        for n in notices_qs:
            inform_to = n.inform_to or []
            if inform_to and 'teacher' not in [str(x).lower() for x in inform_to]:
                continue
            result.append({
                'id': n.id,
                'title': n.notice_title,
                'message': n.notice_message,
                'notice_date': str(n.notice_date),
                'publish_on': str(n.publish_on),
            })

        return Response(result)


class TeacherMessagesView(APIView):
    """
    GET  /api/v1/teacher/messages/
    Returns in-app messages where the teacher is sender or recipient.

    POST /api/v1/teacher/messages/
    Creates an in-app message. sender is set server-side to request.user;
    recipient_id must be supplied in the body.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request):
        from django.db.models import Q
        from apps.communication.models import InAppMessage
        from apps.communication.serializers import InAppMessageSerializer

        user = request.user
        messages = InAppMessage.objects.select_related('sender', 'recipient').filter(
            Q(sender=user) | Q(recipient=user),
        ).order_by('-created_at')[:200]
        return Response(InAppMessageSerializer(messages, many=True, context={'request': request}).data)

    def post(self, request):
        from apps.communication.serializers import InAppMessageSerializer

        user = request.user
        serializer = InAppMessageSerializer(data=request.data, context={'request': request})
        serializer.is_valid(raise_exception=True)
        message = serializer.save(sender=user, school=user.school)
        return Response(
            InAppMessageSerializer(message, context={'request': request}).data, status=http_status.HTTP_201_CREATED,
        )


# ── Sprint 6: Student Results tab ───────────────────────────────────────────────

class StudentResultsView(APIView):
    """
    GET /api/v1/teacher/students/<pk>/results/

    Returns exam marks for one student — the Results tab on the student
    profile. Scope-checked via assert_can_view_class (through
    build_student_results) exactly like StudentProfileView.
    """

    authentication_classes = [JWTAuthentication]
    permission_classes = [IsTeacherPortalUser]

    def get(self, request, pk):
        results = build_student_results(request.user, pk)
        return Response(results)
