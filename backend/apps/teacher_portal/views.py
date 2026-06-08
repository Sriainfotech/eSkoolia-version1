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

from .permissions import IsTeacherPortalUser
from .utils import (
    build_my_classes,
    build_student_credentials,
    build_student_profile,
    build_students_list,
    build_teaching_summary,
    build_todays_periods,
    build_weekly_timetable,
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
            'homework_to_review': 0,
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

        return Response({
            "date": str(attendance_date),
            "class_id": class_id,
            "section_id": section_id,
            "students": table_students,
            "is_marked": any_marked,
            "is_locked": any_locked,
            "can_edit": can_edit,
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
                new_type = raw_type if raw_type else ex_type
                if not new_type:
                    continue

                raw_note = note_map.get(sid_str)
                if raw_note is None:
                    raw_note = note_map.get(student_id)
                note_text = ex_note if raw_note is None else (raw_note or "")

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

        return Response({"success": True, "message": "Attendance saved successfully"}, status=http_status.HTTP_200_OK)
