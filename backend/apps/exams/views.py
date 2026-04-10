from decimal import Decimal
from datetime import date as dt_date
from calendar import monthrange

from django.db import transaction
from django.db.models import Avg
from django.db.models import Q
from django.utils import timezone
from django.contrib.auth import get_user_model
from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.core.models import AcademicYear, Class, ClassRoom, Section, Subject
from apps.hr.models import Staff
from apps.students.models import Student
from apps.communication.models import HolidayCalendar

from .forms import ExamTypeModelForm
from .models import (
    AdmitCard,
    AdmitCardSetting,
    Exam,
    ExamAttendance,
    ExamAttendanceChild,
    ExamGradeScale,
    ExamMark,
    ExamMarkRegister,
    ExamMarkRegisterPart,
    ExamResultPublish,
    ExamRoutine,
    ExamSchedule,
    ExamSetup,
    ExamType,
    OnlineExam,
    OnlineExamTake,
    SeatPlan,
    SeatPlanSetting,
)
from .serializers import (
    AdmitCardSerializer,
    AdmitCardSettingSerializer,
    ExamAttendanceChildSerializer,
    ExamAttendanceReportSearchRequestSerializer,
    ExamAttendanceSearchRequestSerializer,
    ExamAttendanceStoreRequestSerializer,
    ExamGradeScaleSerializer,
    ExamMeritSearchRequestSerializer,
    ExamMarkSerializer,
    ExamMarkRegisterSearchRequestSerializer,
    ExamMarkRegisterSerializer,
    ExamMarkRegisterStoreRequestSerializer,
    ExamReportStudentSearchRequestSerializer,
    ExamResultPublishSearchRequestSerializer,
    ExamResultPublishStoreRequestSerializer,
    ExamRoutineSerializer,
    ExamCommandCenterScheduleSerializer,
    ExamRoutineStoreRequestSerializer,
    ExamPlanGenerateRequestSerializer,
    ExamPlanSearchRequestSerializer,
    ExamScheduleSerializer,
    ExamSetupSerializer,
    ExamSetupStoreRequestSerializer,
    ExamSerializer,
    ExamTypeSerializer,
    ExamTypeStoreRequestSerializer,
    ExamTypeUpdateRequestSerializer,
    OnlineExamSerializer,
    OnlineExamStoreRequestSerializer,
    OnlineExamTakeSerializer,
    OnlineExamUpdateRequestSerializer,
    SeatPlanSerializer,
    SeatPlanSettingSerializer,
)


class ExamTenantMixin:
    permission_classes = [permissions.IsAuthenticated]

    def _resolve_permission_code(self):
        class_name = self.__class__.__name__.lower()
        if "onlineexam" in class_name:
            return "examination.online_exam.view"
        if "admitcard" in class_name:
            return "examination.admit_card.view"
        if "seatplan" in class_name:
            return "examination.seat_plan.view"
        if "resultpublish" in class_name:
            return "examination.result_publish.view"
        if "attendance" in class_name:
            return "examination.exam_attendance.view"
        if "marksregister" in class_name or "mark" in class_name:
            return "examination.marks_register.view"
        if "schedule" in class_name:
            return "examination.exam_schedule.view"
        if "setup" in class_name:
            return "examination.exam_setup.view"
        if "merit" in class_name:
            return "examination.merit_list.view"
        if "report" in class_name:
            return "examination.student_mark_sheet.view"
        if "examtype" in class_name:
            return "examination.exam_type.view"
        if "gradescale" in class_name:
            return "examination.exam_type.view"
        return "examination.exam_type.view"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        user = request.user
        if user.is_superuser:
            return
        code = self._resolve_permission_code()
        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")

    def school_filter(self, request):
        return {} if request.user.is_superuser else {"school_id": request.user.school_id}

    def get_school(self, request):
        school = request.user.school or getattr(request, "school", None)
        if request.user.is_superuser and school:
            return school
        if not school:
            raise PermissionDenied("School context is required.")
        return school

    def get_current_academic_year(self, school_id):
        return AcademicYear.objects.filter(school_id=school_id, is_current=True).order_by("-start_date").first()

    def parse_is_average(self, value):
        if value in (True, 1):
            return True
        if isinstance(value, str):
            return value.strip().lower() in {"yes", "true", "1", "on"}
        return False

    def get_teachers(self, request):
        User = get_user_model()
        queryset = User.objects.filter(is_active=True, access_status=True)
        school_id = None
        if not request.user.is_superuser:
            school_id = request.user.school_id

        role_teacher_qs = queryset.filter(user_roles__role__name__icontains="teacher")
        if school_id:
            role_teacher_qs = role_teacher_qs.filter(Q(school_id=school_id) | Q(staff_profile__school_id=school_id))
        teacher_user_ids = set(role_teacher_qs.values_list("id", flat=True))

        staff_qs = Staff.objects.filter(status=Staff.STATUS_ACTIVE).filter(
            Q(role__name__icontains="teacher") | Q(designation__name__icontains="teacher")
        )
        if school_id:
            staff_qs = staff_qs.filter(school_id=school_id)

        def generate_username(staff):
            base = ""
            if staff.email:
                base = staff.email.split("@", 1)[0]
            if not base:
                joined = f"{(staff.first_name or '').strip()}.{(staff.last_name or '').strip()}".strip(".")
                base = joined or (staff.staff_no or "teacher")
            normalized = "".join(ch for ch in base.lower() if ch.isalnum() or ch in "._-").strip("._-") or "teacher"
            candidate = normalized
            serial = 1
            while User.objects.filter(username=candidate).exists():
                candidate = f"{normalized}{serial}"
                serial += 1
            return candidate

        for staff in staff_qs.only("id", "user_id", "email", "first_name", "last_name", "staff_no", "school_id", "updated_at"):
            if staff.user_id:
                teacher_user_ids.add(staff.user_id)
                continue

            if staff.email:
                matched_user = queryset.filter(email__iexact=staff.email).first()
                if matched_user:
                    if not hasattr(matched_user, "staff_profile"):
                        staff.user_id = matched_user.id
                        staff.save(update_fields=["user", "updated_at"])
                    teacher_user_ids.add(matched_user.id)
                    continue

            username = generate_username(staff)
            created_user = User.objects.create(
                username=username,
                first_name=(staff.first_name or "").strip(),
                last_name=(staff.last_name or "").strip(),
                email=(staff.email or "").strip(),
                school_id=staff.school_id,
                is_active=True,
                access_status=True,
            )
            created_user.set_unusable_password()
            created_user.save(update_fields=["password"])
            staff.user_id = created_user.id
            staff.save(update_fields=["user", "updated_at"])
            teacher_user_ids.add(created_user.id)

        if not teacher_user_ids:
            return queryset.none()

        return (
            queryset.filter(id__in=teacher_user_ids)
            .exclude(is_superuser=True)
            .exclude(is_school_admin=True)
            .order_by("first_name", "last_name", "username")
        )


class ExamTypeIndexAPIView(ExamTenantMixin, APIView):
    """Parity for legacy exam_type() listing."""

    def get(self, request):
        queryset = ExamType.objects.filter(**self.school_filter(request)).order_by("id")
        return Response(
            {
                "exams_types": [
                    {
                        "id": row.id,
                        "title": row.title,
                        "is_average": row.is_average,
                        "average_mark": str(row.average_mark),
                        "active_status": row.active_status,
                    }
                    for row in queryset
                ]
            }
        )


class ExamTypeEditAPIView(ExamTenantMixin, APIView):
    """Parity for legacy exam_type_edit()."""

    def get(self, request, exam_type_id):
        exam_type = ExamType.objects.filter(id=exam_type_id, **self.school_filter(request)).first()
        if not exam_type:
            return Response({"detail": "Exam type not found."}, status=status.HTTP_404_NOT_FOUND)
        return Response(
            {
                "id": exam_type.id,
                "title": exam_type.title,
                "is_average": exam_type.is_average,
                "average_mark": str(exam_type.average_mark),
                "active_status": exam_type.active_status,
            }
        )


class ExamTypeStoreAPIView(ExamTenantMixin, APIView):
    """Parity for legacy exam_type_store()."""

    def post(self, request):
        serializer = ExamTypeStoreRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        school = self.get_school(request)
        current_year = self.get_current_academic_year(school.id)
        title_form = ExamTypeModelForm(data={"title": serializer.validated_data["exam_type_title"]})
        if not title_form.is_valid():
            return Response({"exam_type_title": title_form.errors.get("title", ["Invalid exam name."])}, status=status.HTTP_400_BAD_REQUEST)

        title = title_form.cleaned_data["title"]
        is_average = self.parse_is_average(serializer.validated_data.get("is_average"))
        average_mark = serializer.validated_data.get("average_mark", Decimal("0.00"))

        duplicate = ExamType.objects.filter(
            school_id=school.id,
            academic_year=current_year,
            title__iexact=title,
        ).exists()
        if duplicate:
            return Response({"message": "Duplicate name found!"}, status=status.HTTP_400_BAD_REQUEST)

        if is_average and average_mark is None:
            return Response({"average_mark": ["This field is required when average exam is enabled."]}, status=status.HTTP_400_BAD_REQUEST)

        exam_type = ExamType.objects.create(
            school=school,
            academic_year=current_year,
            title=title,
            active_status=True,
            is_active=True,
            is_average=is_average,
            average_mark=average_mark or Decimal("0.00"),
        )
        return Response(
            {
                "message": "Operation successful",
                "exam_type": {
                    "id": exam_type.id,
                    "title": exam_type.title,
                    "is_average": exam_type.is_average,
                    "average_mark": str(exam_type.average_mark),
                },
            },
            status=status.HTTP_201_CREATED,
        )


class ExamTypeUpdateAPIView(ExamTenantMixin, APIView):
    """Parity for legacy exam_type_update()."""

    @transaction.atomic
    def post(self, request):
        serializer = ExamTypeUpdateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        school = self.get_school(request)
        exam_type = ExamType.objects.filter(id=serializer.validated_data["id"], school_id=school.id).first()
        if not exam_type:
            return Response({"detail": "Exam type not found."}, status=status.HTTP_404_NOT_FOUND)

        title_form = ExamTypeModelForm(data={"title": serializer.validated_data["exam_type_title"]})
        if not title_form.is_valid():
            return Response({"exam_type_title": title_form.errors.get("title", ["Invalid exam name."])}, status=status.HTTP_400_BAD_REQUEST)

        title = title_form.cleaned_data["title"]
        is_average = self.parse_is_average(serializer.validated_data.get("is_average"))
        average_mark = serializer.validated_data.get("average_mark", Decimal("0.00"))

        duplicate = ExamType.objects.filter(
            school_id=school.id,
            academic_year=exam_type.academic_year,
            title__iexact=title,
        ).exclude(id=exam_type.id).exists()
        if duplicate:
            return Response({"message": "Duplicate name found!"}, status=status.HTTP_400_BAD_REQUEST)

        exam_type.title = title
        exam_type.is_average = is_average
        exam_type.average_mark = average_mark if is_average else Decimal("0.00")
        exam_type.save(update_fields=["title", "is_average", "average_mark", "updated_at"])

        return Response({"message": "Operation successful"}, status=status.HTTP_200_OK)


class ExamTypeDeleteAPIView(ExamTenantMixin, APIView):
    """Parity for legacy exam_type_delete()."""

    def get(self, request, exam_type_id):
        school = self.get_school(request)
        exam_type = ExamType.objects.filter(id=exam_type_id, school_id=school.id).first()
        if not exam_type:
            return Response({"detail": "Exam type not found."}, status=status.HTTP_404_NOT_FOUND)

        if Exam.objects.filter(exam_type_id=exam_type.id, school_id=school.id).exists():
            return Response(
                {"message": "This data already used in: exams. Please remove those data first"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        exam_type.delete()
        return Response({"message": "Operation successful"}, status=status.HTTP_200_OK)


class ExamSetupIndexAPIView(ExamTenantMixin, APIView):
    """Parity for exam setup criteria screen data."""

    def get(self, request):
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        sections = Section.objects.filter(school_class_id__in=classes.values_list("id", flat=True)).order_by("name")
        subjects = Subject.objects.filter(**self.school_filter(request)).order_by("name")
        exam_types = ExamType.objects.filter(**self.school_filter(request), active_status=True).order_by("id")

        return Response(
            {
                "classes": [{"id": c.id, "class_name": c.name} for c in classes],
                "sections": [{"id": s.id, "section_name": s.name, "class_id": s.school_class_id} for s in sections],
                "subjects": [{"id": s.id, "subject_name": s.name} for s in subjects],
                "exam_types": [{"id": e.id, "title": e.title} for e in exam_types],
            }
        )


class ExamSetupSearchAPIView(ExamTenantMixin, APIView):
    def get(self, request):
        class_id = request.query_params.get("class")
        section_id = request.query_params.get("section")
        subject_id = request.query_params.get("subject")
        exam_term_id = request.query_params.get("exam_term_id")

        if not all([class_id, section_id, subject_id, exam_term_id]):
            return Response(
                {"detail": "class, section, subject and exam_term_id are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        queryset = ExamSetup.objects.filter(
            school_class_id=class_id,
            section_id=section_id,
            subject_id=subject_id,
            exam_term_id=exam_term_id,
            **self.school_filter(request),
        ).order_by("id")
        data = ExamSetupSerializer(queryset, many=True).data
        total = sum(Decimal(item["exam_mark"]) for item in data) if data else Decimal("0.00")
        return Response({"items": data, "totalMark": str(total.quantize(Decimal("0.01")))})


class ExamSetupStoreAPIView(ExamTenantMixin, APIView):
    """Parity for legacy examSetupStore()."""

    @transaction.atomic
    def post(self, request):
        payload = dict(request.data)
        if "class" in request.data and "class_id" not in request.data:
            payload["class_id"] = request.data.get("class")

        serializer = ExamSetupStoreRequestSerializer(data=payload)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        total_exam_mark = Decimal(data["total_exam_mark"])
        total_mark = Decimal(data["totalMark"])

        if total_exam_mark != total_mark:
            return Response({"message": "Operation Failed"}, status=status.HTTP_400_BAD_REQUEST)

        school = self.get_school(request)
        current_year = self.get_current_academic_year(school.id)

        class_id = data["class"]
        section_id = data["section"]
        subject_id = data["subject"]
        exam_term_id = data["exam_term_id"]

        ExamSetup.objects.filter(
            school=school,
            school_class_id=class_id,
            section_id=section_id,
            subject_id=subject_id,
            exam_term_id=exam_term_id,
        ).delete()

        rows = []
        for i, title in enumerate(data["exam_title"]):
            mark = Decimal(data["exam_mark"][i])
            rows.append(
                ExamSetup(
                    school=school,
                    academic_year=current_year,
                    exam_term_id=exam_term_id,
                    school_class_id=class_id,
                    section_id=section_id,
                    subject_id=subject_id,
                    exam_title=title,
                    exam_mark=mark,
                    created_by=request.user,
                )
            )

        ExamSetup.objects.bulk_create(rows)
        return Response({"message": "Operation successful"}, status=status.HTTP_201_CREATED)


class ExamSetupSubjectByClassAPIView(ExamTenantMixin, APIView):
    def get(self, request):
        class_id = request.query_params.get("class_id")
        if not class_id:
            return Response({"detail": "class_id is required."}, status=status.HTTP_400_BAD_REQUEST)

        subjects = Subject.objects.filter(**self.school_filter(request)).order_by("name")
        return Response([{"id": s.id, "subject_name": s.name} for s in subjects])


class ExamScheduleIndexAPIView(ExamTenantMixin, APIView):
    """Parity criteria for exam schedule create/report pages."""

    def get(self, request):
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        sections = Section.objects.filter(school_class_id__in=classes.values_list("id", flat=True)).order_by("name")
        rooms = ClassRoom.objects.filter(**self.school_filter(request), active_status=True).order_by("room_no")
        exam_types = ExamType.objects.filter(**self.school_filter(request), active_status=True).order_by("id")
        periods = request.user.school.class_periods.filter(period_type="exam").order_by("start_time", "period") if request.user.school_id else []
        teachers = self.get_teachers(request)

        return Response(
            {
                "classes": [{"id": c.id, "class_name": c.name} for c in classes],
                "sections": [{"id": s.id, "section_name": s.name, "class_id": s.school_class_id} for s in sections],
                "rooms": [{"id": r.id, "room_no": r.room_no} for r in rooms],
                "exam_types": [{"id": e.id, "title": e.title} for e in exam_types],
                "exam_periods": [{"id": p.id, "period": p.period} for p in periods],
                "teachers": [
                    {
                        "id": t.id,
                        "full_name": (f"{(t.first_name or '').strip()} {(t.last_name or '').strip()}").strip() or t.username,
                    }
                    for t in teachers
                ],
            }
        )


class ExamScheduleSearchAPIView(ExamTenantMixin, APIView):
    """Parity for exam schedule search by exam term/class/section."""

    def post(self, request):
        exam_type_id = request.data.get("exam_type") or request.data.get("exam_type_id")
        class_id = request.data.get("class") or request.data.get("class_id")
        section_id = request.data.get("section")

        try:
            exam_type_id = int(exam_type_id)
            class_id = int(class_id)
            section_id = int(section_id) if section_id not in (None, "") else None
        except (TypeError, ValueError):
            return Response({"detail": "Invalid class/section/exam type ids."}, status=status.HTTP_400_BAD_REQUEST)

        if section_id == 0:
            section_id = None

        if not exam_type_id or not class_id:
            return Response({"detail": "exam_type and class are required."}, status=status.HTTP_400_BAD_REQUEST)

        setup_subjects = ExamSetup.objects.filter(
            exam_term_id=exam_type_id,
            school_class_id=class_id,
            **self.school_filter(request),
        )
        if section_id:
            setup_subjects = setup_subjects.filter(section_id=section_id)

        subject_ids = setup_subjects.values_list("subject_id", flat=True).distinct()
        subjects = Subject.objects.filter(id__in=subject_ids).order_by("name")

        routines = ExamRoutine.objects.filter(
            exam_term_id=exam_type_id,
            school_class_id=class_id,
            **self.school_filter(request),
        ).select_related("subject", "school_class", "section", "teacher", "exam_term", "exam_period")
        if section_id:
            routines = routines.filter(section_id=section_id)

        exam_type = ExamType.objects.filter(id=exam_type_id, **self.school_filter(request)).first()
        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None

        return Response(
            {
                "examName": exam_type.title if exam_type else "",
                "search_info": {
                    "class_name": class_obj.name if class_obj else "",
                    "section_name": section_obj.name if section_obj else "All Sections",
                },
                "subjects": [{"id": s.id, "subject_name": s.name} for s in subjects],
                "exam_schedule": ExamRoutineSerializer(routines, many=True).data,
            }
        )


class ExamScheduleStoreAPIView(ExamTenantMixin, APIView):
    """Parity for addExamRoutineStore() with strict duplicate prevention."""

    @transaction.atomic
    def post(self, request):
        serializer = ExamRoutineStoreRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        school = self.get_school(request)
        current_year = self.get_current_academic_year(school.id)
        class_id = data["class_id"]
        section_id = data.get("section_id")
        exam_type_id = data["exam_type_id"]

        base_qs = ExamRoutine.objects.filter(
            school=school,
            school_class_id=class_id,
            exam_term_id=exam_type_id,
        )
        if section_id:
            base_qs = base_qs.filter(section_id=section_id)
        base_qs.delete()

        rows = []
        for row in data["routine"]:
            subject_id = row["subject"]
            row_section_id = row.get("section")

            if row_section_id:
                section = Section.objects.filter(id=row_section_id, school_class_id=class_id).first()
                if not section:
                    return Response({"section": ["Selected section does not belong to selected class."]}, status=status.HTTP_400_BAD_REQUEST)

            subject = Subject.objects.filter(id=subject_id, **self.school_filter(request)).first()
            if not subject:
                return Response({"subject": ["Selected subject does not belong to your school."]}, status=status.HTTP_400_BAD_REQUEST)

            teacher_id = row.get("teacher_id")
            teacher = None
            if teacher_id:
                teacher = self.get_teachers(request).filter(id=teacher_id).first()

            rows.append(
                ExamRoutine(
                    school=school,
                    academic_year=current_year,
                    exam_term_id=exam_type_id,
                    school_class_id=class_id,
                    section_id=row_section_id,
                    subject_id=subject_id,
                    teacher=teacher,
                    exam_period_id=row.get("exam_period_id"),
                    exam_date=row["date"],
                    start_time=row["start_time"],
                    end_time=row["end_time"],
                    room=(row.get("room") or "").strip(),
                )
            )

        ExamRoutine.objects.bulk_create(rows)
        return Response({"message": "Exam routine has been assigned successfully"}, status=status.HTTP_201_CREATED)


class ExamCommandCenterAPIView(ExamTenantMixin, APIView):
    """Resource timeline API for exam master command center."""

    def _normalize_payload(self, request_data):
        payload = request_data.copy()
        if "exam_type_id" in payload and "exam_term" not in payload:
            payload["exam_term"] = payload.get("exam_type_id")
        if "class_id" in payload and "school_class" not in payload:
            payload["school_class"] = payload.get("class_id")
        if "section_id" in payload and "section" not in payload:
            payload["section"] = payload.get("section_id")
        if "subject_id" in payload and "subject" not in payload:
            payload["subject"] = payload.get("subject_id")
        if "teacher_id" in payload and "teacher" not in payload:
            payload["teacher"] = payload.get("teacher_id")
        if "period" in payload and "exam_period" not in payload:
            payload["exam_period"] = payload.get("period")
        payload.setdefault("room", "")
        return payload

    def get(self, request):
        exam_type_id = request.query_params.get("exam_type_id")
        selected_date = request.query_params.get("date")
        class_id = request.query_params.get("class_id")
        section_id = request.query_params.get("section_id")
        room_id = request.query_params.get("room_id")

        if not selected_date:
            return Response({"detail": "date is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            parsed_date = dt_date.fromisoformat(selected_date)
        except ValueError:
            return Response({"detail": "Invalid date format."}, status=status.HTTP_400_BAD_REQUEST)

        schedules = ExamRoutine.objects.filter(**self.school_filter(request), exam_date=parsed_date).select_related(
            "exam_term",
            "school_class",
            "section",
            "subject",
            "teacher",
            "exam_period",
        )

        if exam_type_id not in (None, ""):
            schedules = schedules.filter(exam_term_id=exam_type_id)
        if class_id not in (None, ""):
            schedules = schedules.filter(school_class_id=class_id)
        if section_id not in (None, "", "0"):
            schedules = schedules.filter(section_id=section_id)

        room_map_qs = ClassRoom.objects.filter(**self.school_filter(request)).only("id", "room_no")
        room_map = {row.room_no.upper(): row.id for row in room_map_qs}

        if room_id not in (None, "", "0"):
            room_obj = ClassRoom.objects.filter(id=room_id, **self.school_filter(request)).first()
            if room_obj:
                schedules = schedules.filter(room__iexact=room_obj.room_no)
            else:
                schedules = schedules.none()

        data = [
            {
                "id": row.id,
                "exam_type": row.exam_term_id,
                "exam_type_name": row.exam_term.title,
                "class_name": row.school_class.name,
                "class_id": row.school_class_id,
                "section": row.section.name if row.section else "All",
                "section_id": row.section_id,
                "subject": row.subject.name,
                "subject_id": row.subject_id,
                "teacher": (
                    (f"{(row.teacher.first_name or '').strip()} {(row.teacher.last_name or '').strip()}").strip() if row.teacher else ""
                )
                or (row.teacher.username if row.teacher else ""),
                "teacher_id": row.teacher_id,
                "room": row.room,
                "room_id": room_map.get((row.room or "").upper()),
                "date": row.exam_date.isoformat(),
                "period": row.exam_period_id,
                "period_name": row.exam_period.period if row.exam_period else "",
                "start_time": row.start_time.strftime("%H:%M:%S"),
                "end_time": row.end_time.strftime("%H:%M:%S"),
            }
            for row in schedules.order_by("start_time", "room", "id")
        ]
        return Response(data)

    @transaction.atomic
    def post(self, request):
        school = self.get_school(request)
        payload = self._normalize_payload(request.data)
        serializer = ExamCommandCenterScheduleSerializer(
            data=payload,
            context={"request": request, "school": school},
        )
        serializer.is_valid(raise_exception=True)
        current_year = self.get_current_academic_year(school.id)
        obj = serializer.save(school=school, academic_year=current_year)
        return Response(ExamCommandCenterScheduleSerializer(obj).data, status=status.HTTP_201_CREATED)


class ExamCommandCenterDetailAPIView(ExamTenantMixin, APIView):
    @transaction.atomic
    def put(self, request, schedule_id):
        school = self.get_school(request)
        instance = ExamRoutine.objects.filter(id=schedule_id, **self.school_filter(request)).first()
        if not instance:
            return Response({"detail": "Schedule not found."}, status=status.HTTP_404_NOT_FOUND)

        payload = request.data.copy()
        if "exam_type_id" in payload and "exam_term" not in payload:
            payload["exam_term"] = payload.get("exam_type_id")
        if "class_id" in payload and "school_class" not in payload:
            payload["school_class"] = payload.get("class_id")
        if "section_id" in payload and "section" not in payload:
            payload["section"] = payload.get("section_id")
        if "subject_id" in payload and "subject" not in payload:
            payload["subject"] = payload.get("subject_id")
        if "teacher_id" in payload and "teacher" not in payload:
            payload["teacher"] = payload.get("teacher_id")
        if "period" in payload and "exam_period" not in payload:
            payload["exam_period"] = payload.get("period")

        serializer = ExamCommandCenterScheduleSerializer(
            instance,
            data=payload,
            partial=False,
            context={"request": request, "school": school},
        )
        serializer.is_valid(raise_exception=True)
        obj = serializer.save()
        return Response(ExamCommandCenterScheduleSerializer(obj).data)

    @transaction.atomic
    def delete(self, request, schedule_id):
        instance = ExamRoutine.objects.filter(id=schedule_id, **self.school_filter(request)).first()
        if not instance:
            return Response(status=status.HTTP_204_NO_CONTENT)
        instance.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExamRoomListAPIView(ExamTenantMixin, APIView):
    def get(self, request):
        rooms = ClassRoom.objects.filter(**self.school_filter(request), active_status=True).order_by("room_no")
        return Response(
            [
                {
                    "id": row.id,
                    "name": row.room_no,
                    "description": "Main Hall" if "HALL" in row.room_no.upper() else "Exam Room",
                }
                for row in rooms
            ]
        )


class ExamHolidayListAPIView(ExamTenantMixin, APIView):
    def get(self, request):
        month = request.query_params.get("month")
        year = request.query_params.get("year")

        holidays = HolidayCalendar.objects.filter(is_active=True).filter(
            Q(school_id=request.user.school_id) | Q(school_id__isnull=True)
        )

        if month and year:
            try:
                month_int = int(month)
                year_int = int(year)
                first_day = dt_date(year_int, month_int, 1)
                last_day = dt_date(year_int, month_int, monthrange(year_int, month_int)[1])
                holidays = holidays.filter(holiday_date__lte=last_day).filter(
                    Q(end_date__isnull=True, holiday_date__gte=first_day) | Q(end_date__gte=first_day)
                )
            except (TypeError, ValueError):
                return Response({"detail": "Invalid month/year."}, status=status.HTTP_400_BAD_REQUEST)

        return Response(
            [
                {
                    "id": row.id,
                    "title": row.holiday_title,
                    "start_date": row.holiday_date.isoformat(),
                    "end_date": row.end_date.isoformat() if row.end_date else row.holiday_date.isoformat(),
                    "is_active": row.is_active,
                    "description": row.description,
                }
                for row in holidays.order_by("holiday_date", "id")
            ]
        )


class ExamScheduleReportSearchAPIView(ExamTenantMixin, APIView):
    """Parity for exam schedule report search by exam/class/section."""

    def post(self, request):
        exam_type_id = request.data.get("exam_type") or request.data.get("exam")
        class_id = request.data.get("class")
        section_id = request.data.get("section")

        if not exam_type_id or not class_id:
            return Response({"detail": "exam_type and class are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            exam_type_id = int(exam_type_id)
            class_id = int(class_id)
            section_id = int(section_id) if section_id not in (None, "") else None
        except (TypeError, ValueError):
            return Response({"detail": "Invalid class/section/exam type ids."}, status=status.HTTP_400_BAD_REQUEST)

        if section_id == 0:
            section_id = None

        routines = ExamRoutine.objects.filter(
            exam_term_id=exam_type_id,
            school_class_id=class_id,
            **self.school_filter(request),
        ).select_related("subject", "school_class", "section", "teacher", "exam_term", "exam_period")
        if section_id:
            routines = routines.filter(section_id=section_id)

        exam_type = ExamType.objects.filter(id=exam_type_id, **self.school_filter(request)).first()
        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None

        return Response(
            {
                "examName": exam_type.title if exam_type else "",
                "class_name": class_obj.name if class_obj else "",
                "section_name": section_obj.name if section_obj else "All Sections",
                "exam_schedules": ExamRoutineSerializer(routines.order_by("exam_date", "start_time"), many=True).data,
            }
        )


class ExamSchedulePrintAPIView(ExamTenantMixin, APIView):
    """Parity print payload endpoint for exam schedule output."""

    def get(self, request):
        exam_type_id = request.query_params.get("exam_id") or request.query_params.get("exam_type")
        class_id = request.query_params.get("class_id") or request.query_params.get("class")
        section_id = request.query_params.get("section_id") or request.query_params.get("section")

        if not exam_type_id or not class_id:
            return Response({"detail": "exam_id and class_id are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            exam_type_id = int(exam_type_id)
            class_id = int(class_id)
            section_id = int(section_id) if section_id not in (None, "") else None
        except (TypeError, ValueError):
            return Response({"detail": "Invalid class/section/exam ids."}, status=status.HTTP_400_BAD_REQUEST)

        if section_id == 0:
            section_id = None

        routines = ExamRoutine.objects.filter(
            exam_term_id=exam_type_id,
            school_class_id=class_id,
            **self.school_filter(request),
        ).select_related("subject", "school_class", "section", "teacher", "exam_term", "exam_period")
        if section_id:
            routines = routines.filter(section_id=section_id)

        return Response(
            {
                "exam_schedules": ExamRoutineSerializer(routines.order_by("exam_date", "start_time"), many=True).data,
                "print": True,
            }
        )


class ExamAttendanceIndexAPIView(ExamTenantMixin, APIView):
    """Parity criteria for exam attendance create/report screens."""

    def get(self, request):
        exams = ExamType.objects.filter(**self.school_filter(request), active_status=True).order_by("id")
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        sections = Section.objects.filter(school_class_id__in=classes.values_list("id", flat=True)).order_by("name")
        subjects = Subject.objects.filter(**self.school_filter(request)).order_by("name")

        return Response(
            {
                "exams": [{"id": row.id, "title": row.title} for row in exams],
                "classes": [{"id": row.id, "class_name": row.name} for row in classes],
                "sections": [{"id": row.id, "section_name": row.name, "class_id": row.school_class_id} for row in sections],
                "subjects": [{"id": row.id, "subject_name": row.name} for row in subjects],
            }
        )


class ExamAttendanceCreateSearchAPIView(ExamTenantMixin, APIView):
    """Parity for exam attendance create search flow."""

    def post(self, request):
        serializer = ExamAttendanceSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam"]
        subject_id = data["subject"]
        class_id = data["class"]
        section_id = data.get("section")
        exam_date = data.get("exam_date")
        if section_id in (0, "0"):
            section_id = None

        schedule_qs = ExamRoutine.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            subject_id=subject_id,
            **self.school_filter(request),
        )
        if section_id:
            schedule_qs = schedule_qs.filter(section_id=section_id)

        if not schedule_qs.exists():
            return Response({"message": "You have to create exam schedule first"}, status=status.HTTP_400_BAD_REQUEST)

        if exam_date:
            if not schedule_qs.filter(exam_date=exam_date).exists():
                return Response({"message": "No exam scheduled for selected date."}, status=status.HTTP_400_BAD_REQUEST)
            if exam_date > timezone.localdate():
                return Response({"message": "Cannot record attendance for a future exam date."}, status=status.HTTP_400_BAD_REQUEST)

        students_qs = Student.objects.filter(
            current_class_id=class_id,
            is_active=True,
            **self.school_filter(request),
        ).values("id", "admission_no", "first_name", "last_name", "roll_no", "current_section_id")
        if section_id:
            students_qs = students_qs.filter(current_section_id=section_id)
        students_qs = students_qs.order_by("id")

        if not students_qs.exists():
            return Response({"message": "No students found in selected class/section."}, status=status.HTTP_400_BAD_REQUEST)

        attendance_qs = ExamAttendance.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            subject_id=subject_id,
            **self.school_filter(request),
        )
        if section_id:
            attendance_qs = attendance_qs.filter(section_id=section_id)
        attendance = attendance_qs.first()
        child_map = {}
        if attendance:
            child_map = {
                row["student_id"]: row["attendance_type"]
                for row in attendance.children.values("student_id", "attendance_type")
            }

        student_rows = []
        for student in students_qs:
            child_attendance_type = child_map.get(student["id"])
            student_rows.append(
                {
                    "student_record_id": student["id"],
                    "student": student["id"],
                    "class": class_id,
                    "section": section_id or student["current_section_id"],
                    "admission_no": student["admission_no"],
                    "first_name": student["first_name"],
                    "last_name": student["last_name"],
                    "roll_no": student["roll_no"],
                    "attendance_type": child_attendance_type or "P",
                }
            )

        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None
        subject_obj = Subject.objects.filter(id=subject_id, **self.school_filter(request)).first()

        exam_attendance_childs = []
        if attendance:
            exam_attendance_childs = list(
                attendance.children.values(
                    "id",
                    "student_id",
                    "student_record_id",
                    "school_class_id",
                    "section_id",
                    "attendance_type",
                    "student__admission_no",
                    "student__first_name",
                    "student__last_name",
                    "student__roll_no",
                )
            )
            exam_attendance_childs = [
                {
                    "id": row["id"],
                    "student": row["student_id"],
                    "student_record_id": row["student_record_id"],
                    "admission_no": row["student__admission_no"],
                    "first_name": row["student__first_name"],
                    "last_name": row["student__last_name"],
                    "roll_no": row["student__roll_no"],
                    "school_class": row["school_class_id"],
                    "section": row["section_id"],
                    "attendance_type": row["attendance_type"],
                }
                for row in exam_attendance_childs
            ]

        return Response(
            {
                "students": student_rows,
                "exam_attendance_childs": exam_attendance_childs,
                "search_info": {
                    "class_name": class_obj.name if class_obj else "",
                    "section_name": section_obj.name if section_obj else "All Sections",
                    "subject_name": subject_obj.name if subject_obj else "",
                },
                "exam_id": exam_term_id,
                "subject_id": subject_id,
                "class_id": class_id,
                "section_id": section_id,
                "exam_date": str(exam_date) if exam_date else "",
            }
        )


class ExamAttendanceStoreAPIView(ExamTenantMixin, APIView):
    """Parity for exam attendance store flow."""

    @transaction.atomic
    def post(self, request):
        serializer = ExamAttendanceStoreRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam_id"]
        subject_id = data["subject_id"]
        class_id = data["class_id"]
        section_id = data.get("section_id")
        if section_id in (0, "0"):
            section_id = None

        school = self.get_school(request)
        current_year = self.get_current_academic_year(school.id)

        attendance = ExamAttendance.objects.filter(
            school=school,
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            section_id=section_id,
            subject_id=subject_id,
        ).first()
        if not attendance:
            attendance = ExamAttendance.objects.create(
                school=school,
                academic_year=current_year,
                exam_term_id=exam_term_id,
                school_class_id=class_id,
                section_id=section_id,
                subject_id=subject_id,
            )

        attendance.children.all().delete()

        requested_student_ids = []
        for _, attendance_data in data["attendance"].items():
            if not isinstance(attendance_data, dict):
                continue
            student_id = attendance_data.get("student")
            if student_id:
                requested_student_ids.append(student_id)

        student_rows = Student.objects.filter(
            id__in=requested_student_ids,
            **self.school_filter(request),
        ).values("id", "current_section_id")
        valid_students = {row["id"]: row["current_section_id"] for row in student_rows}

        children = []
        for record_id, attendance_data in data["attendance"].items():
            if not isinstance(attendance_data, dict):
                continue
            student_id = attendance_data.get("student")
            if not student_id:
                continue

            student_section_id = valid_students.get(student_id)
            if student_section_id is None and student_id not in valid_students:
                continue

            row_class_id = attendance_data.get("class") or class_id
            row_section_id = attendance_data.get("section") or section_id or student_section_id
            attendance_type = attendance_data.get("attendance_type") or "P"
            if attendance_type not in {"P", "A"}:
                attendance_type = "P"

            children.append(
                ExamAttendanceChild(
                    attendance=attendance,
                    student_id=student_id,
                    student_record_id=int(record_id) if str(record_id).isdigit() else student_id,
                    school_class_id=row_class_id,
                    section_id=row_section_id,
                    attendance_type=attendance_type,
                )
            )

        ExamAttendanceChild.objects.bulk_create(children)
        return Response({"message": "Operation successful"}, status=status.HTTP_200_OK)


class ExamAttendanceReportSearchAPIView(ExamTenantMixin, APIView):
    """Parity for exam attendance report search flow."""

    def post(self, request):
        serializer = ExamAttendanceReportSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam"]
        subject_id = data["subject"]
        class_id = data["class"]
        section_id = data.get("section")
        if section_id in (0, "0"):
            section_id = None

        attendance_qs = ExamAttendance.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            subject_id=subject_id,
            **self.school_filter(request),
        )
        if section_id:
            attendance_qs = attendance_qs.filter(section_id=section_id)
        attendance = attendance_qs.first()

        if not attendance:
            return Response({"message": "No Record Found", "exam_attendance_childs": []}, status=status.HTTP_200_OK)

        return Response(
            {
                "exam_attendance_childs": ExamAttendanceChildSerializer(attendance.children.all(), many=True).data,
            }
        )


class ExamMarksRegisterIndexAPIView(ExamTenantMixin, APIView):
    """Parity criteria payload for marks register and add marks pages."""

    def get(self, request):
        exams = ExamType.objects.filter(**self.school_filter(request), active_status=True).order_by("id")
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        sections = Section.objects.filter(school_class_id__in=classes.values_list("id", flat=True)).order_by("name")
        subjects = Subject.objects.filter(**self.school_filter(request)).order_by("name")

        return Response(
            {
                "exams": [{"id": row.id, "title": row.title} for row in exams],
                "classes": [{"id": row.id, "class_name": row.name} for row in classes],
                "sections": [{"id": row.id, "section_name": row.name, "class_id": row.school_class_id} for row in sections],
                "subjects": [{"id": row.id, "subject_name": row.name} for row in subjects],
            }
        )


class ExamMarksRegisterCreateSearchAPIView(ExamTenantMixin, APIView):
    """Parity for marks register create search flow."""

    def _setup_rows(self, request, exam_term_id, class_id, subject_id, section_id):
        setup_qs = ExamSetup.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            subject_id=subject_id,
            **self.school_filter(request),
        ).order_by("id")
        if section_id:
            setup_qs = setup_qs.filter(section_id=section_id)

        rows = list(setup_qs)
        if section_id or not rows:
            return rows

        deduped = []
        seen_titles = set()
        for row in rows:
            key = row.exam_title.strip().lower()
            if key in seen_titles:
                continue
            seen_titles.add(key)
            deduped.append(row)
        return deduped

    def post(self, request):
        serializer = ExamMarkRegisterSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam"]
        subject_id = data["subject"]
        class_id = data["class"]
        section_id = data.get("section")
        if section_id in (0, "0"):
            section_id = None

        attendance_qs = ExamAttendance.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            subject_id=subject_id,
            **self.school_filter(request),
        )
        if section_id:
            attendance_qs = attendance_qs.filter(section_id=section_id)
        if not attendance_qs.exists():
            return Response(
                {"message": "Exam attendance has not been taken yet for this subject. Attendance must be recorded before entering marks."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        setup_rows = self._setup_rows(request, exam_term_id, class_id, subject_id, section_id)
        if not setup_rows:
            return Response({"message": "No result found or exam setup is not done!"}, status=status.HTTP_400_BAD_REQUEST)

        students_qs = Student.objects.filter(current_class_id=class_id, is_active=True, **self.school_filter(request))
        if section_id:
            students_qs = students_qs.filter(current_section_id=section_id)
        students_qs = students_qs.order_by("roll_no", "id")

        if not students_qs.exists():
            return Response({"message": "Student is not found in according this class and section!"}, status=status.HTTP_400_BAD_REQUEST)

        registers_qs = ExamMarkRegister.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            subject_id=subject_id,
            student_id__in=students_qs.values_list("id", flat=True),
            **self.school_filter(request),
        ).prefetch_related("parts")
        if section_id:
            registers_qs = registers_qs.filter(section_id=section_id)
        register_map = {row.student_id: row for row in registers_qs}

        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None
        exam_obj = ExamType.objects.filter(id=exam_term_id, **self.school_filter(request)).first()

        student_rows = []
        for student in students_qs:
            register = register_map.get(student.id)
            part_marks = {}
            if register:
                part_marks = {str(part.exam_setup_id): str(part.marks) for part in register.parts.all()}
            student_rows.append(
                {
                    "student_record_id": student.id,
                    "student": student.id,
                    "class": class_id,
                    "section": student.current_section_id,
                    "admission_no": student.admission_no,
                    "first_name": student.first_name,
                    "last_name": student.last_name,
                    "roll_no": student.roll_no,
                    "marks": part_marks,
                    "teacher_remarks": register.teacher_remarks if register else "",
                    "is_absent": bool(register.is_absent) if register else False,
                    "total_marks": str(register.total_marks) if register else "0.00",
                    "total_gpa_point": str(register.total_gpa_point) if register else "0.00",
                    "total_gpa_grade": register.total_gpa_grade if register else "",
                }
            )

        return Response(
            {
                "students": student_rows,
                "marks_entry_form": [
                    {"id": row.id, "exam_title": row.exam_title, "exam_mark": str(row.exam_mark)} for row in setup_rows
                ],
                "search_info": {
                    "exam_name": exam_obj.title if exam_obj else "",
                    "class_name": class_obj.name if class_obj else "",
                    "section_name": section_obj.name if section_obj else "All Sections",
                },
                "exam_id": exam_term_id,
                "subject_id": subject_id,
                "class_id": class_id,
                "section_id": section_id,
            }
        )


class ExamMarksRegisterStoreAPIView(ExamTenantMixin, APIView):
    """Parity for marks register save flow with grade calculation."""

    @transaction.atomic
    def post(self, request):
        serializer = ExamMarkRegisterStoreRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam_id"]
        class_id = data["class_id"]
        section_id = data.get("section_id")
        subject_id = data["subject_id"]
        if section_id in (0, "0"):
            section_id = None

        school = self.get_school(request)
        current_year = self.get_current_academic_year(school.id)

        setup_qs = ExamSetup.objects.filter(
            school=school,
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            subject_id=subject_id,
        ).order_by("id")
        setup_by_id = {row.id: row for row in setup_qs}
        if not setup_by_id:
            return Response({"message": "No result found or exam setup is not done!"}, status=status.HTTP_400_BAD_REQUEST)

        grade_scales = list(ExamGradeScale.objects.filter(school=school).order_by("-min_percent"))

        for record_id, row in data["markStore"].items():
            if not isinstance(row, dict):
                continue

            student_id = row.get("student")
            if not student_id:
                continue

            student = Student.objects.filter(id=student_id, school=school, is_active=True).first()
            if not student:
                continue

            row_section_id = row.get("section") or section_id or student.current_section_id
            marks_map = row.get("marks") or {}
            raw_setup_ids = []
            if isinstance(row.get("exam_Sids"), dict):
                raw_setup_ids.extend(list(row.get("exam_Sids").values()))
            elif isinstance(row.get("exam_Sids"), list):
                raw_setup_ids.extend(list(row.get("exam_Sids")))
            raw_setup_ids.extend(list(marks_map.keys()))

            setup_ids = []
            for raw_id in raw_setup_ids:
                try:
                    setup_id = int(raw_id)
                except (TypeError, ValueError):
                    continue
                if setup_id not in setup_by_id:
                    continue
                if setup_id not in setup_ids:
                    setup_ids.append(setup_id)

            if not setup_ids:
                continue

            total_marks = Decimal("0.00")
            full_marks = Decimal("0.00")
            parts_payload = []

            for setup_id in setup_ids:
                setup = setup_by_id[setup_id]
                full_marks += setup.exam_mark
                raw_mark = marks_map.get(str(setup_id), marks_map.get(setup_id, 0))
                try:
                    mark_value = Decimal(str(raw_mark or 0))
                except Exception:
                    return Response({"message": "Invalid marks value provided."}, status=status.HTTP_400_BAD_REQUEST)

                if mark_value < 0:
                    mark_value = Decimal("0.00")
                if mark_value > setup.exam_mark:
                    return Response(
                        {"message": f"Marks cannot exceed setup full mark for '{setup.exam_title}'."},
                        status=status.HTTP_400_BAD_REQUEST,
                    )

                total_marks += mark_value
                parts_payload.append((setup_id, mark_value))

            absent_raw = row.get("absent_students")
            is_absent = False
            if isinstance(absent_raw, list):
                is_absent = str(record_id) in {str(v) for v in absent_raw}
            elif absent_raw not in (None, "", False, 0, "0"):
                is_absent = str(absent_raw) == str(record_id)

            percent = Decimal("0.00")
            if full_marks > 0:
                percent = (total_marks * Decimal("100.00")) / full_marks

            grade = None
            for scale in grade_scales:
                if scale.min_percent <= percent <= scale.max_percent:
                    grade = scale
                    break

            register, _ = ExamMarkRegister.objects.get_or_create(
                school=school,
                exam_term_id=exam_term_id,
                school_class_id=class_id,
                section_id=row_section_id,
                subject_id=subject_id,
                student_id=student.id,
                defaults={
                    "academic_year": current_year,
                    "student_record_id": int(record_id) if str(record_id).isdigit() else student.id,
                    "created_by": request.user,
                },
            )

            register.academic_year = current_year
            register.student_record_id = int(record_id) if str(record_id).isdigit() else student.id
            register.is_absent = is_absent
            register.total_marks = total_marks
            register.total_gpa_point = grade.gpa if grade else Decimal("0.00")
            register.total_gpa_grade = grade.name if grade else ""
            register.teacher_remarks = (row.get("teacher_remarks") or "").strip()
            register.created_by = request.user
            register.save()

            register.parts.all().delete()
            ExamMarkRegisterPart.objects.bulk_create(
                [
                    ExamMarkRegisterPart(register=register, exam_setup_id=setup_id, marks=mark_value)
                    for setup_id, mark_value in parts_payload
                ]
            )

        return Response({"message": "Operation successful"}, status=status.HTTP_200_OK)


class ExamMarksRegisterReportSearchAPIView(ExamTenantMixin, APIView):
    """Parity for marks register report search flow."""

    def post(self, request):
        serializer = ExamMarkRegisterSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam"]
        subject_id = data["subject"]
        class_id = data["class"]
        section_id = data.get("section")
        if section_id in (0, "0"):
            section_id = None

        registers = ExamMarkRegister.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            subject_id=subject_id,
            **self.school_filter(request),
        ).select_related("student", "school_class", "section", "exam_term", "subject").prefetch_related("parts__exam_setup")
        if section_id:
            registers = registers.filter(section_id=section_id)

        setup_qs = ExamSetup.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            subject_id=subject_id,
            **self.school_filter(request),
        ).order_by("id")
        if section_id:
            setup_qs = setup_qs.filter(section_id=section_id)

        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None
        exam_obj = ExamType.objects.filter(id=exam_term_id, **self.school_filter(request)).first()

        return Response(
            {
                "marks_registers": ExamMarkRegisterSerializer(registers.order_by("student__roll_no", "student_id"), many=True).data,
                "marks_entry_form": [
                    {"id": row.id, "exam_title": row.exam_title, "exam_mark": str(row.exam_mark)} for row in setup_qs
                ],
                "search_info": {
                    "exam_name": exam_obj.title if exam_obj else "",
                    "class_name": class_obj.name if class_obj else "",
                    "section_name": section_obj.name if section_obj else "All Sections",
                },
            }
        )


class ExamResultPublishIndexAPIView(ExamTenantMixin, APIView):
    """Parity criteria payload for result publish screen."""

    def get(self, request):
        exams = ExamType.objects.filter(**self.school_filter(request), active_status=True).order_by("id")
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        sections = Section.objects.filter(school_class_id__in=classes.values_list("id", flat=True)).order_by("name")

        return Response(
            {
                "exams": [{"id": row.id, "title": row.title} for row in exams],
                "classes": [{"id": row.id, "class_name": row.name} for row in classes],
                "sections": [{"id": row.id, "section_name": row.name, "class_id": row.school_class_id} for row in sections],
            }
        )


class ExamResultPublishSearchAPIView(ExamTenantMixin, APIView):
    """Parity for result publishing criteria search."""

    def post(self, request):
        serializer = ExamResultPublishSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam"]
        class_id = data["class"]
        section_id = data.get("section")
        if section_id in (0, "0"):
            section_id = None

        marks_qs = ExamMarkRegister.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            **self.school_filter(request),
        )
        if section_id:
            marks_qs = marks_qs.filter(section_id=section_id)

        publish_qs = ExamResultPublish.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            **self.school_filter(request),
        )
        if section_id:
            publish_qs = publish_qs.filter(section_id=section_id)
        published_row = publish_qs.first()

        exam_obj = ExamType.objects.filter(id=exam_term_id, **self.school_filter(request)).first()
        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None

        return Response(
            {
                "search_info": {
                    "exam_name": exam_obj.title if exam_obj else "",
                    "class_name": class_obj.name if class_obj else "",
                    "section_name": section_obj.name if section_obj else "All Sections",
                },
                "total_mark_entries": marks_qs.count(),
                "is_published": bool(published_row.is_published) if published_row else False,
                "published_at": str(published_row.published_at) if published_row and published_row.published_at else None,
            }
        )


class ExamResultPublishStoreAPIView(ExamTenantMixin, APIView):
    """Parity for result publish action."""

    @transaction.atomic
    def post(self, request):
        serializer = ExamResultPublishStoreRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam_id"]
        class_id = data["class_id"]
        section_id = data.get("section_id")
        if section_id in (0, "0"):
            section_id = None

        marks_qs = ExamMarkRegister.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            **self.school_filter(request),
        )
        if section_id:
            marks_qs = marks_qs.filter(section_id=section_id)

        if not marks_qs.exists():
            return Response({"message": "Cannot publish result without mark entries."}, status=status.HTTP_400_BAD_REQUEST)

        school = self.get_school(request)
        current_year = self.get_current_academic_year(school.id)

        publish_row, _ = ExamResultPublish.objects.get_or_create(
            school=school,
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            section_id=section_id,
            defaults={"academic_year": current_year},
        )
        publish_row.academic_year = current_year
        publish_row.is_published = True
        publish_row.published_at = timezone.now()
        publish_row.published_by = request.user
        publish_row.save(update_fields=["academic_year", "is_published", "published_at", "published_by", "updated_at"])

        return Response({"message": "Operation successful"}, status=status.HTTP_200_OK)


class ExamReportIndexAPIView(ExamTenantMixin, APIView):
    """Parity criteria payload for marksheet and merit report screens."""

    def get(self, request):
        exams = ExamType.objects.filter(**self.school_filter(request), active_status=True).order_by("id")
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        sections = Section.objects.filter(school_class_id__in=classes.values_list("id", flat=True)).order_by("name")
        students = Student.objects.filter(is_active=True, **self.school_filter(request)).order_by("roll_no", "id")

        return Response(
            {
                "exams": [{"id": row.id, "title": row.title} for row in exams],
                "classes": [{"id": row.id, "class_name": row.name} for row in classes],
                "sections": [{"id": row.id, "section_name": row.name, "class_id": row.school_class_id} for row in sections],
                "students": [
                    {
                        "id": row.id,
                        "admission_no": row.admission_no,
                        "first_name": row.first_name,
                        "last_name": row.last_name,
                        "roll_no": row.roll_no,
                        "class_id": row.current_class_id,
                        "section_id": row.current_section_id,
                    }
                    for row in students
                ],
            }
        )


class ExamReportStudentSearchAPIView(ExamTenantMixin, APIView):
    """Parity for student marksheet report search."""

    def post(self, request):
        serializer = ExamReportStudentSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam"]
        class_id = data["class"]
        section_id = data.get("section")
        student_id = data["student"]
        if section_id in (0, "0"):
            section_id = None

        registers = ExamMarkRegister.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            student_id=student_id,
            **self.school_filter(request),
        ).select_related("subject", "student")
        if section_id:
            registers = registers.filter(section_id=section_id)

        if not registers.exists():
            return Response({"message": "Ops! Your result is not found! Please check mark register", "subjects": []}, status=status.HTTP_200_OK)

        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None
        exam_obj = ExamType.objects.filter(id=exam_term_id, **self.school_filter(request)).first()
        student_obj = registers.first().student

        publish_qs = ExamResultPublish.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            **self.school_filter(request),
        )
        if section_id:
            publish_qs = publish_qs.filter(section_id=section_id)
        publish_row = publish_qs.first()

        grand_total = Decimal("0.00")
        total_gpa = Decimal("0.00")
        subject_rows = []
        for row in registers.order_by("subject__name"):
            grand_total += row.total_marks or Decimal("0.00")
            total_gpa += row.total_gpa_point or Decimal("0.00")
            subject_rows.append(
                {
                    "subject_id": row.subject_id,
                    "subject_name": row.subject.name,
                    "total_marks": str(row.total_marks),
                    "grade": row.total_gpa_grade,
                    "gpa": str(row.total_gpa_point),
                    "is_absent": row.is_absent,
                    "remarks": row.teacher_remarks,
                }
            )

        avg_gpa = Decimal("0.00")
        if subject_rows:
            avg_gpa = total_gpa / Decimal(len(subject_rows))

        return Response(
            {
                "student": {
                    "id": student_obj.id,
                    "admission_no": student_obj.admission_no,
                    "name": f"{student_obj.first_name} {student_obj.last_name}".strip(),
                    "roll_no": student_obj.roll_no,
                },
                "search_info": {
                    "exam_name": exam_obj.title if exam_obj else "",
                    "class_name": class_obj.name if class_obj else "",
                    "section_name": section_obj.name if section_obj else "All Sections",
                },
                "subjects": subject_rows,
                "grand_total": str(grand_total.quantize(Decimal("0.01"))),
                "average_gpa": str(avg_gpa.quantize(Decimal("0.01"))),
                "result_published": bool(publish_row.is_published) if publish_row else False,
            }
        )


class ExamMeritSearchAPIView(ExamTenantMixin, APIView):
    """Parity for merit report search by exam/class/section."""

    def post(self, request):
        serializer = ExamMeritSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        exam_term_id = data["exam"]
        class_id = data["class"]
        section_id = data.get("section")
        if section_id in (0, "0"):
            section_id = None

        registers = ExamMarkRegister.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            **self.school_filter(request),
        ).select_related("student")
        if section_id:
            registers = registers.filter(section_id=section_id)

        grouped = {}
        for row in registers:
            item = grouped.setdefault(
                row.student_id,
                {
                    "student_id": row.student_id,
                    "admission_no": row.student.admission_no,
                    "student_name": f"{row.student.first_name} {row.student.last_name}".strip(),
                    "roll_no": row.student.roll_no,
                    "subjects": 0,
                    "total_marks": Decimal("0.00"),
                    "total_gpa": Decimal("0.00"),
                },
            )
            item["subjects"] += 1
            item["total_marks"] += row.total_marks or Decimal("0.00")
            item["total_gpa"] += row.total_gpa_point or Decimal("0.00")

        merit_rows = []
        for _, item in grouped.items():
            avg_gpa = Decimal("0.00")
            if item["subjects"] > 0:
                avg_gpa = item["total_gpa"] / Decimal(item["subjects"])
            merit_rows.append(
                {
                    "student_id": item["student_id"],
                    "admission_no": item["admission_no"],
                    "student_name": item["student_name"],
                    "roll_no": item["roll_no"],
                    "subject_count": item["subjects"],
                    "total_marks": str(item["total_marks"].quantize(Decimal("0.01"))),
                    "average_gpa": str(avg_gpa.quantize(Decimal("0.01"))),
                }
            )

        merit_rows.sort(key=lambda r: (Decimal(r["total_marks"]), Decimal(r["average_gpa"])), reverse=True)
        for idx, row in enumerate(merit_rows, start=1):
            row["position"] = idx

        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None
        exam_obj = ExamType.objects.filter(id=exam_term_id, **self.school_filter(request)).first()

        return Response(
            {
                "search_info": {
                    "exam_name": exam_obj.title if exam_obj else "",
                    "class_name": class_obj.name if class_obj else "",
                    "section_name": section_obj.name if section_obj else "All Sections",
                },
                "merit_list": merit_rows,
            }
        )


class ExamReportStudentPrintAPIView(ExamTenantMixin, APIView):
    """Parity print payload for student marksheet report."""

    def get(self, request):
        exam_term_id = request.query_params.get("exam_id") or request.query_params.get("exam")
        class_id = request.query_params.get("class_id") or request.query_params.get("class")
        section_id = request.query_params.get("section_id") or request.query_params.get("section")
        student_id = request.query_params.get("student_id") or request.query_params.get("student")

        if not exam_term_id or not class_id or not student_id:
            return Response({"detail": "exam_id, class_id and student_id are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            exam_term_id = int(exam_term_id)
            class_id = int(class_id)
            student_id = int(student_id)
            section_id = int(section_id) if section_id not in (None, "") else None
        except (TypeError, ValueError):
            return Response({"detail": "Invalid exam/class/section/student ids."}, status=status.HTTP_400_BAD_REQUEST)

        if section_id == 0:
            section_id = None

        registers = ExamMarkRegister.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            student_id=student_id,
            **self.school_filter(request),
        ).select_related("subject", "student")
        if section_id:
            registers = registers.filter(section_id=section_id)

        if not registers.exists():
            return Response({"message": "Ops! Your result is not found! Please check mark register", "subjects": []}, status=status.HTTP_200_OK)

        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None
        exam_obj = ExamType.objects.filter(id=exam_term_id, **self.school_filter(request)).first()
        student_obj = registers.first().student

        publish_qs = ExamResultPublish.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            **self.school_filter(request),
        )
        if section_id:
            publish_qs = publish_qs.filter(section_id=section_id)
        publish_row = publish_qs.first()

        grand_total = Decimal("0.00")
        total_gpa = Decimal("0.00")
        subject_rows = []
        for row in registers.order_by("subject__name"):
            grand_total += row.total_marks or Decimal("0.00")
            total_gpa += row.total_gpa_point or Decimal("0.00")
            subject_rows.append(
                {
                    "subject_id": row.subject_id,
                    "subject_name": row.subject.name,
                    "total_marks": str(row.total_marks),
                    "grade": row.total_gpa_grade,
                    "gpa": str(row.total_gpa_point),
                    "is_absent": row.is_absent,
                    "remarks": row.teacher_remarks,
                }
            )

        avg_gpa = Decimal("0.00")
        if subject_rows:
            avg_gpa = total_gpa / Decimal(len(subject_rows))

        return Response(
            {
                "student": {
                    "id": student_obj.id,
                    "admission_no": student_obj.admission_no,
                    "name": f"{student_obj.first_name} {student_obj.last_name}".strip(),
                    "roll_no": student_obj.roll_no,
                },
                "search_info": {
                    "exam_name": exam_obj.title if exam_obj else "",
                    "class_name": class_obj.name if class_obj else "",
                    "section_name": section_obj.name if section_obj else "All Sections",
                },
                "subjects": subject_rows,
                "grand_total": str(grand_total.quantize(Decimal("0.01"))),
                "average_gpa": str(avg_gpa.quantize(Decimal("0.01"))),
                "result_published": bool(publish_row.is_published) if publish_row else False,
                "print": True,
            }
        )


class ExamMeritPrintAPIView(ExamTenantMixin, APIView):
    """Parity print payload for merit list report."""

    def get(self, request):
        exam_term_id = request.query_params.get("exam_id") or request.query_params.get("exam")
        class_id = request.query_params.get("class_id") or request.query_params.get("class")
        section_id = request.query_params.get("section_id") or request.query_params.get("section")

        if not exam_term_id or not class_id:
            return Response({"detail": "exam_id and class_id are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            exam_term_id = int(exam_term_id)
            class_id = int(class_id)
            section_id = int(section_id) if section_id not in (None, "") else None
        except (TypeError, ValueError):
            return Response({"detail": "Invalid exam/class/section ids."}, status=status.HTTP_400_BAD_REQUEST)

        if section_id == 0:
            section_id = None

        registers = ExamMarkRegister.objects.filter(
            exam_term_id=exam_term_id,
            school_class_id=class_id,
            **self.school_filter(request),
        ).select_related("student")
        if section_id:
            registers = registers.filter(section_id=section_id)

        grouped = {}
        for row in registers:
            item = grouped.setdefault(
                row.student_id,
                {
                    "student_id": row.student_id,
                    "admission_no": row.student.admission_no,
                    "student_name": f"{row.student.first_name} {row.student.last_name}".strip(),
                    "roll_no": row.student.roll_no,
                    "subjects": 0,
                    "total_marks": Decimal("0.00"),
                    "total_gpa": Decimal("0.00"),
                },
            )
            item["subjects"] += 1
            item["total_marks"] += row.total_marks or Decimal("0.00")
            item["total_gpa"] += row.total_gpa_point or Decimal("0.00")

        merit_rows = []
        for _, item in grouped.items():
            avg_gpa = Decimal("0.00")
            if item["subjects"] > 0:
                avg_gpa = item["total_gpa"] / Decimal(item["subjects"])
            merit_rows.append(
                {
                    "student_id": item["student_id"],
                    "admission_no": item["admission_no"],
                    "student_name": item["student_name"],
                    "roll_no": item["roll_no"],
                    "subject_count": item["subjects"],
                    "total_marks": str(item["total_marks"].quantize(Decimal("0.01"))),
                    "average_gpa": str(avg_gpa.quantize(Decimal("0.01"))),
                }
            )

        merit_rows.sort(key=lambda r: (Decimal(r["total_marks"]), Decimal(r["average_gpa"])), reverse=True)
        for idx, row in enumerate(merit_rows, start=1):
            row["position"] = idx

        class_obj = Class.objects.filter(id=class_id, **self.school_filter(request)).first()
        section_obj = Section.objects.filter(id=section_id).first() if section_id else None
        exam_obj = ExamType.objects.filter(id=exam_term_id, **self.school_filter(request)).first()

        return Response(
            {
                "search_info": {
                    "exam_name": exam_obj.title if exam_obj else "",
                    "class_name": class_obj.name if class_obj else "",
                    "section_name": section_obj.name if section_obj else "All Sections",
                },
                "merit_list": merit_rows,
                "print": True,
            }
        )


class SchoolScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    permission_codes = {}

    def get_required_permission_code(self):
        action = getattr(self, "action", None)
        if action and action in self.permission_codes:
            return self.permission_codes[action]
        return self.permission_codes.get("*")

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        code = self.get_required_permission_code()
        if not code:
            return
        user = request.user
        if user.is_superuser:
            return
        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")

    def get_queryset(self):
        queryset = super().get_queryset()
        user = self.request.user
        if user.is_superuser:
            return queryset
        if user.school_id:
            return queryset.filter(school_id=user.school_id)
        return queryset.none()

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school)


class ExamTypeViewSet(SchoolScopedModelViewSet):
    queryset = ExamType.objects.select_related("school").all()
    serializer_class = ExamTypeSerializer
    filterset_fields = ["is_active"]
    search_fields = ["title", "description"]
    ordering_fields = ["title", "created_at"]
    permission_codes = {"*": "examination.exam_type.view"}


class ExamGradeScaleViewSet(SchoolScopedModelViewSet):
    queryset = ExamGradeScale.objects.select_related("school").all()
    serializer_class = ExamGradeScaleSerializer
    filterset_fields = ["is_fail"]
    search_fields = ["name"]
    ordering_fields = ["min_percent", "max_percent", "name"]
    permission_codes = {"*": "examination.exam_type.view"}


class ExamViewSet(SchoolScopedModelViewSet):
    queryset = Exam.objects.select_related("school", "academic_year", "exam_type").all()
    serializer_class = ExamSerializer
    filterset_fields = ["academic_year", "exam_type", "status", "start_date"]
    search_fields = ["name"]
    ordering_fields = ["start_date", "end_date", "created_at"]
    permission_codes = {
        "list": "examination.exam_type.view",
        "retrieve": "examination.exam_type.view",
        "create": "examination.exam_setup.view",
        "update": "examination.exam_setup.view",
        "partial_update": "examination.exam_setup.view",
        "destroy": "examination.exam_setup.view",
        "summary": "examination.exam_schedule_report.view",
        "publish_results": "examination.result_publish.view",
        "student_results": "examination.student_mark_sheet.view",
    }

    @action(detail=True, methods=["get"], url_path="summary")
    def summary(self, request, pk=None):
        exam = self.get_object()
        marks_qs = exam.marks.select_related("schedule")

        total_entries = marks_qs.count()
        absent_count = marks_qs.filter(absent=True).count()
        average_marks = marks_qs.filter(absent=False).aggregate(avg=Avg("obtained_marks")).get("avg")

        data = {
            "exam_id": exam.id,
            "name": exam.name,
            "status": exam.status,
            "schedule_count": exam.schedules.count(),
            "total_mark_entries": total_entries,
            "absent_count": absent_count,
            "average_marks": str(average_marks) if average_marks is not None else "0.00",
        }
        return Response(data)

    @action(detail=True, methods=["post"], url_path="publish-results")
    def publish_results(self, request, pk=None):
        exam = self.get_object()
        if not exam.marks.exists():
            raise ValidationError("Cannot publish result without mark entries.")

        exam.is_result_published = True
        exam.published_at = timezone.now()
        exam.published_by = request.user
        exam.status = Exam.STATUS_PUBLISHED
        exam.save(update_fields=["is_result_published", "published_at", "published_by", "status", "updated_at"])
        return Response({"exam_id": exam.id, "published": True, "published_at": exam.published_at})

    @action(detail=True, methods=["get"], url_path="student-results")
    def student_results(self, request, pk=None):
        exam = self.get_object()
        student_id = request.query_params.get("student_id")
        if not student_id:
            raise ValidationError({"student_id": "student_id query parameter is required."})

        marks_qs = exam.marks.select_related("schedule__subject", "student").filter(student_id=student_id)
        if not marks_qs.exists():
            return Response({"exam_id": exam.id, "student_id": student_id, "subjects": [], "total": "0.00"})

        grade_scales = ExamGradeScale.objects.filter(school_id=exam.school_id).order_by("-min_percent")

        subjects = []
        total = Decimal("0.00")
        for mark in marks_qs:
            full_marks = mark.schedule.full_marks or Decimal("0.00")
            obtained = Decimal("0.00") if mark.absent else mark.obtained_marks
            percent = Decimal("0.00")
            if full_marks > 0:
                percent = (obtained * Decimal("100.00")) / full_marks
            grade_name = None
            grade_gpa = None
            for scale in grade_scales:
                if scale.min_percent <= percent <= scale.max_percent:
                    grade_name = scale.name
                    grade_gpa = str(scale.gpa)
                    break

            total += obtained
            subjects.append(
                {
                    "subject": mark.schedule.subject.name,
                    "full_marks": str(full_marks),
                    "obtained_marks": str(obtained),
                    "percent": str(percent.quantize(Decimal("0.01"))),
                    "grade": grade_name,
                    "gpa": grade_gpa,
                    "absent": mark.absent,
                }
            )

        return Response(
            {
                "exam_id": exam.id,
                "student_id": int(student_id),
                "student_name": str(marks_qs.first().student),
                "subjects": subjects,
                "total": str(total),
                "result_published": exam.is_result_published,
            }
        )


class ExamScheduleViewSet(SchoolScopedModelViewSet):
    queryset = ExamSchedule.objects.select_related("school", "exam", "school_class", "section", "subject").all()
    serializer_class = ExamScheduleSerializer
    permission_codes = {"*": "examination.exam_schedule.view"}
    filterset_fields = ["exam", "school_class", "section", "subject", "exam_date"]
    search_fields = ["exam__name", "school_class__name", "subject__name", "room"]
    ordering_fields = ["exam_date", "start_time", "created_at"]


class ExamMarkViewSet(SchoolScopedModelViewSet):
    queryset = ExamMark.objects.select_related("school", "exam", "schedule", "student", "created_by").all()
    serializer_class = ExamMarkSerializer
    permission_codes = {"*": "examination.add_marks.view"}
    filterset_fields = ["exam", "schedule", "student", "absent"]
    search_fields = ["student__first_name", "student__last_name", "student__admission_no", "note"]
    ordering_fields = ["created_at", "obtained_marks"]

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school, created_by=user)


class OnlineExamIndexAPIView(ExamTenantMixin, APIView):
    """Parity for online exam index page payload."""

    def get(self, request):
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        sections = Section.objects.filter(school_class_id__in=classes.values_list("id", flat=True)).order_by("name")
        subjects = Subject.objects.filter(**self.school_filter(request)).order_by("name")
        online_exams = OnlineExam.objects.filter(**self.school_filter(request)).select_related("school_class", "section", "subject").order_by("-id")

        return Response(
            {
                "classes": [{"id": c.id, "class_name": c.name} for c in classes],
                "sections": [{"id": s.id, "section_name": s.name, "class_id": s.school_class_id} for s in sections],
                "subjects": [{"id": s.id, "subject_name": s.name} for s in subjects],
                "online_exams": OnlineExamSerializer(online_exams, many=True).data,
            }
        )


class OnlineExamStoreAPIView(ExamTenantMixin, APIView):
    """Parity for online exam store flow."""

    @transaction.atomic
    def post(self, request):
        serializer = OnlineExamStoreRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        school = self.get_school(request)
        current_year = self.get_current_academic_year(school.id)
        class_id = data["class"]
        subject_id = data["subject"]
        title = data["title"]

        rows = []
        for section_id in data["section"]:
            duplicate = OnlineExam.objects.filter(
                school=school,
                school_class_id=class_id,
                section_id=section_id,
                subject_id=subject_id,
                title__iexact=title,
            ).exists()
            if duplicate:
                return Response({"message": "Duplicate name found!"}, status=status.HTTP_400_BAD_REQUEST)

            end_dt = timezone.datetime.combine(data["date"], data["end_time"])
            if timezone.is_naive(end_dt):
                end_dt = timezone.make_aware(end_dt, timezone.get_current_timezone())

            rows.append(
                OnlineExam(
                    school=school,
                    academic_year=current_year,
                    title=title,
                    school_class_id=class_id,
                    section_id=section_id,
                    subject_id=subject_id,
                    date=data["date"],
                    start_time=data["start_time"],
                    end_time=data["end_time"],
                    end_date_time=end_dt,
                    percentage=data.get("percentage") or Decimal("0.00"),
                    instruction=data.get("instruction") or "",
                    status=OnlineExam.STATUS_DRAFT,
                    auto_mark=data.get("auto_mark", False),
                )
            )

        OnlineExam.objects.bulk_create(rows)
        return Response({"message": "Operation successful"}, status=status.HTTP_201_CREATED)


class OnlineExamUpdateAPIView(ExamTenantMixin, APIView):
    """Parity for online exam update flow."""

    @transaction.atomic
    def post(self, request):
        serializer = OnlineExamUpdateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        online_exam = OnlineExam.objects.filter(id=data["id"], **self.school_filter(request)).first()
        if not online_exam:
            return Response({"detail": "Online exam not found."}, status=status.HTTP_404_NOT_FOUND)

        section_id = data["section"][0]
        duplicate = OnlineExam.objects.filter(
            school_id=online_exam.school_id,
            school_class_id=data["class"],
            section_id=section_id,
            subject_id=data["subject"],
            title__iexact=data["title"],
        ).exclude(id=online_exam.id).exists()
        if duplicate:
            return Response({"message": "Duplicate name found!"}, status=status.HTTP_400_BAD_REQUEST)

        end_dt = timezone.datetime.combine(data["date"], data["end_time"])
        if timezone.is_naive(end_dt):
            end_dt = timezone.make_aware(end_dt, timezone.get_current_timezone())

        online_exam.title = data["title"]
        online_exam.school_class_id = data["class"]
        online_exam.section_id = section_id
        online_exam.subject_id = data["subject"]
        online_exam.date = data["date"]
        online_exam.start_time = data["start_time"]
        online_exam.end_time = data["end_time"]
        online_exam.end_date_time = end_dt
        online_exam.percentage = data.get("percentage") or Decimal("0.00")
        online_exam.instruction = data.get("instruction") or ""
        online_exam.auto_mark = data.get("auto_mark", False)
        online_exam.save()

        return Response({"message": "Operation successful"}, status=status.HTTP_200_OK)


class OnlineExamDeleteAPIView(ExamTenantMixin, APIView):
    def post(self, request):
        exam_id = request.data.get("id") or request.data.get("online_exam_id")
        if not exam_id:
            return Response({"detail": "id is required."}, status=status.HTTP_400_BAD_REQUEST)

        exam = OnlineExam.objects.filter(id=exam_id, **self.school_filter(request)).first()
        if not exam:
            return Response({"detail": "Online exam not found."}, status=status.HTTP_404_NOT_FOUND)

        exam.delete()
        return Response({"message": "Operation successful"}, status=status.HTTP_200_OK)


class OnlineExamPublishAPIView(ExamTenantMixin, APIView):
    def get(self, request, online_exam_id):
        exam = OnlineExam.objects.filter(id=online_exam_id, **self.school_filter(request)).first()
        if not exam:
            return Response({"detail": "Online exam not found."}, status=status.HTTP_404_NOT_FOUND)
        exam.status = OnlineExam.STATUS_PUBLISHED
        exam.save(update_fields=["status", "updated_at"])
        return Response({"message": "Operation successful"}, status=status.HTTP_200_OK)


class OnlineExamPublishCancelAPIView(ExamTenantMixin, APIView):
    def get(self, request, online_exam_id):
        exam = OnlineExam.objects.filter(id=online_exam_id, **self.school_filter(request)).first()
        if not exam:
            return Response({"detail": "Online exam not found."}, status=status.HTTP_404_NOT_FOUND)
        exam.status = OnlineExam.STATUS_DRAFT
        exam.save(update_fields=["status", "updated_at"])
        return Response({"message": "Operation successful"}, status=status.HTTP_200_OK)


class OnlineExamMarksRegisterAPIView(ExamTenantMixin, APIView):
    """Parity payload for online exam marks register screen."""

    def get(self, request, online_exam_id):
        exam = OnlineExam.objects.filter(id=online_exam_id, **self.school_filter(request)).select_related("school_class", "section", "subject").first()
        if not exam:
            return Response({"detail": "Online exam not found."}, status=status.HTTP_404_NOT_FOUND)

        students = Student.objects.filter(
            current_class_id=exam.school_class_id,
            current_section_id=exam.section_id,
            is_active=True,
            **self.school_filter(request),
        ).order_by("roll_no", "id")
        takes = OnlineExamTake.objects.filter(online_exam_id=exam.id, student_id__in=students.values_list("id", flat=True))
        present_students = list(takes.values_list("student_id", flat=True))

        return Response(
            {
                "online_exam": OnlineExamSerializer(exam).data,
                "students": [
                    {
                        "id": s.id,
                        "admission_no": s.admission_no,
                        "first_name": s.first_name,
                        "last_name": s.last_name,
                        "roll_no": s.roll_no,
                    }
                    for s in students
                ],
                "present_students": present_students,
            }
        )


class OnlineExamResultAPIView(ExamTenantMixin, APIView):
    """Parity payload for online exam result view."""

    def get(self, request, online_exam_id):
        exam = OnlineExam.objects.filter(id=online_exam_id, **self.school_filter(request)).select_related("school_class", "section", "subject").first()
        if not exam:
            return Response({"detail": "Online exam not found."}, status=status.HTTP_404_NOT_FOUND)

        takes = OnlineExamTake.objects.filter(online_exam_id=exam.id).select_related("student").order_by("student__roll_no", "student_id")
        present_students = list(takes.values_list("student_id", flat=True))

        return Response(
            {
                "online_exam": OnlineExamSerializer(exam).data,
                "present_students": present_students,
                "students": OnlineExamTakeSerializer(takes, many=True).data,
                "total_marks": str((takes.aggregate(total=Avg("total_marks")).get("total") or Decimal("0.00"))),
            }
        )


class ExamPlanAdmitCardSettingAPIView(ExamTenantMixin, APIView):
    def get(self, request):
        school = self.get_school(request)
        year = self.get_current_academic_year(school.id)
        setting = AdmitCardSetting.objects.filter(school=school, academic_year=year).first()
        if not setting:
            setting = AdmitCardSetting.objects.filter(school=school).order_by("-id").first()
            if setting:
                setting.pk = None
                setting.academic_year = year
                setting.save()
            else:
                setting = AdmitCardSetting.objects.create(school=school, academic_year=year)
        return Response({"setting": AdmitCardSettingSerializer(setting).data})

    def post(self, request):
        school = self.get_school(request)
        year = self.get_current_academic_year(school.id)
        setting = AdmitCardSetting.objects.filter(school=school, academic_year=year).first()
        if not setting:
            setting = AdmitCardSetting(school=school, academic_year=year)

        serializer = AdmitCardSettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(school=school, academic_year=year)
        return Response({"message": "Operation successful", "setting": serializer.data}, status=status.HTTP_200_OK)


class ExamPlanSeatPlanSettingAPIView(ExamTenantMixin, APIView):
    def get(self, request):
        school = self.get_school(request)
        year = self.get_current_academic_year(school.id)
        setting = SeatPlanSetting.objects.filter(school=school, academic_year=year).first()
        if not setting:
            setting = SeatPlanSetting.objects.filter(school=school).order_by("-id").first()
            if setting:
                setting.pk = None
                setting.academic_year = year
                setting.save()
            else:
                setting = SeatPlanSetting.objects.create(school=school, academic_year=year)
        return Response({"setting": SeatPlanSettingSerializer(setting).data})

    def post(self, request):
        school = self.get_school(request)
        year = self.get_current_academic_year(school.id)
        setting = SeatPlanSetting.objects.filter(school=school, academic_year=year).first()
        if not setting:
            setting = SeatPlanSetting(school=school, academic_year=year)

        serializer = SeatPlanSettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(school=school, academic_year=year)
        return Response({"message": "Operation successful", "setting": serializer.data}, status=status.HTTP_200_OK)


class ExamPlanAdmitCardIndexAPIView(ExamTenantMixin, APIView):
    def get(self, request):
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        sections = Section.objects.filter(school_class_id__in=classes.values_list("id", flat=True)).order_by("name")
        exams = ExamType.objects.filter(**self.school_filter(request), active_status=True).order_by("title")
        return Response(
            {
                "exams": [{"id": e.id, "title": e.title} for e in exams],
                "classes": [{"id": c.id, "class_name": c.name} for c in classes],
                "sections": [{"id": s.id, "section_name": s.name, "class_id": s.school_class_id} for s in sections],
            }
        )


class ExamPlanAdmitCardSearchAPIView(ExamTenantMixin, APIView):
    def post(self, request):
        serializer = ExamPlanSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        has_schedule = ExamSchedule.objects.filter(
            exam_id=data["exam"],
            school_class_id=data["class"],
            section_id=data["section"],
            **self.school_filter(request),
        ).exists()
        if not has_schedule:
            return Response({"message": "Exam schedule is not ready."}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(
            current_class_id=data["class"],
            current_section_id=data["section"],
            is_active=True,
            **self.school_filter(request),
        ).order_by("roll_no", "id")
        current_year = self.get_current_academic_year(self.get_school(request).id)
        old_ids = list(
            AdmitCard.objects.filter(
                school=self.get_school(request),
                academic_year=current_year,
                exam_term_id=data["exam"],
                student_id__in=students.values_list("id", flat=True),
            ).values_list("student_id", flat=True)
        )

        return Response(
            {
                "exam_id": data["exam"],
                "class_id": data["class"],
                "section_id": data["section"],
                "records": [
                    {
                        "student_record_id": s.id,
                        "student_id": s.id,
                        "admission_no": s.admission_no,
                        "roll_no": s.roll_no,
                        "first_name": s.first_name,
                        "last_name": s.last_name,
                    }
                    for s in students
                ],
                "old_admit_ids": old_ids,
            }
        )


class ExamPlanAdmitCardGenerateAPIView(ExamTenantMixin, APIView):
    @transaction.atomic
    def post(self, request):
        serializer = ExamPlanGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        exam_type_id = serializer.validated_data["exam_type_id"]
        payload = serializer.validated_data.get("data") or {}

        selected_ids = []
        for value in payload.values():
            if isinstance(value, dict) and "student_record_id" in value:
                selected_ids.append(int(value["student_record_id"]))
        selected_ids = list(dict.fromkeys(selected_ids))
        if not selected_ids:
            return Response({"message": "No student selected."}, status=status.HTTP_400_BAD_REQUEST)

        school = self.get_school(request)
        year = self.get_current_academic_year(school.id)
        created_rows = []
        for student_id in selected_ids:
            row, created = AdmitCard.objects.get_or_create(
                school=school,
                academic_year=year,
                exam_term_id=exam_type_id,
                student_id=student_id,
                defaults={"created_by": request.user, "student_record_id": student_id},
            )
            if created:
                created_rows.append(row)

        cards = AdmitCard.objects.filter(
            school=school,
            academic_year=year,
            exam_term_id=exam_type_id,
            student_id__in=selected_ids,
        ).select_related("student")

        return Response(
            {
                "message": "Operation successful",
                "created_count": len(created_rows),
                "admitcards": AdmitCardSerializer(cards, many=True).data,
            },
            status=status.HTTP_200_OK,
        )


class ExamPlanSeatPlanIndexAPIView(ExamTenantMixin, APIView):
    def get(self, request):
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        sections = Section.objects.filter(school_class_id__in=classes.values_list("id", flat=True)).order_by("name")
        exams = ExamType.objects.filter(**self.school_filter(request), active_status=True).order_by("title")
        return Response(
            {
                "exams": [{"id": e.id, "title": e.title} for e in exams],
                "classes": [{"id": c.id, "class_name": c.name} for c in classes],
                "sections": [{"id": s.id, "section_name": s.name, "class_id": s.school_class_id} for s in sections],
            }
        )


class ExamPlanSeatPlanSearchAPIView(ExamTenantMixin, APIView):
    def post(self, request):
        serializer = ExamPlanSearchRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        has_schedule = ExamSchedule.objects.filter(
            exam_id=data["exam"],
            school_class_id=data["class"],
            section_id=data["section"],
            **self.school_filter(request),
        ).exists()
        if not has_schedule:
            return Response({"message": "Exam schedule is not ready."}, status=status.HTTP_400_BAD_REQUEST)

        students = Student.objects.filter(
            current_class_id=data["class"],
            current_section_id=data["section"],
            is_active=True,
            **self.school_filter(request),
        ).order_by("roll_no", "id")
        current_year = self.get_current_academic_year(self.get_school(request).id)
        old_ids = list(
            SeatPlan.objects.filter(
                school=self.get_school(request),
                academic_year=current_year,
                exam_term_id=data["exam"],
                student_id__in=students.values_list("id", flat=True),
            ).values_list("student_id", flat=True)
        )

        return Response(
            {
                "exam_id": data["exam"],
                "class_id": data["class"],
                "section_id": data["section"],
                "records": [
                    {
                        "student_record_id": s.id,
                        "student_id": s.id,
                        "admission_no": s.admission_no,
                        "roll_no": s.roll_no,
                        "first_name": s.first_name,
                        "last_name": s.last_name,
                    }
                    for s in students
                ],
                "seat_plan_ids": old_ids,
            }
        )


class ExamPlanSeatPlanGenerateAPIView(ExamTenantMixin, APIView):
    @transaction.atomic
    def post(self, request):
        serializer = ExamPlanGenerateRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        exam_type_id = serializer.validated_data["exam_type_id"]
        payload = serializer.validated_data.get("data") or {}

        selected_ids = []
        for value in payload.values():
            if isinstance(value, dict) and "student_record_id" in value:
                selected_ids.append(int(value["student_record_id"]))
        selected_ids = list(dict.fromkeys(selected_ids))
        if not selected_ids:
            return Response({"message": "No student selected."}, status=status.HTTP_400_BAD_REQUEST)

        school = self.get_school(request)
        year = self.get_current_academic_year(school.id)
        created_rows = []
        for student_id in selected_ids:
            row, created = SeatPlan.objects.get_or_create(
                school=school,
                academic_year=year,
                exam_term_id=exam_type_id,
                student_id=student_id,
                defaults={"created_by": request.user, "student_record_id": student_id},
            )
            if created:
                created_rows.append(row)

        seats = SeatPlan.objects.filter(
            school=school,
            academic_year=year,
            exam_term_id=exam_type_id,
            student_id__in=selected_ids,
        ).select_related("student")

        return Response(
            {
                "message": "Operation successful",
                "created_count": len(created_rows),
                "seat_plans": SeatPlanSerializer(seats, many=True).data,
            },
            status=status.HTTP_200_OK,
        )
