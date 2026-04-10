from collections import defaultdict

from django.db import transaction
from django.db.models import Count, Q, Sum
from django.db.models.functions import Coalesce
from rest_framework import permissions, status, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.students.models import Student, StudentMultiClassRecord

from .models import AssignedIncident, AssignedIncidentComment, BehaviourRecordSetting, Incident
from .serializers import (
    AssignedIncidentBulkCreateSerializer,
    AssignedIncidentCommentSerializer,
    AssignedIncidentSerializer,
    BehaviourRecordSettingSerializer,
    IncidentSerializer,
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


class IncidentViewSet(SchoolScopedModelViewSet):
    queryset = Incident.objects.select_related("school").all()
    serializer_class = IncidentSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["title", "point"]
    search_fields = ["title", "description"]
    ordering_fields = ["title", "point", "created_at"]
    permission_codes = {"*": "behaviour.incident.view"}


class AssignedIncidentViewSet(SchoolScopedModelViewSet):
    queryset = AssignedIncident.objects.select_related(
        "school",
        "academic_year",
        "incident",
        "student",
        "record",
        "assigned_by",
    ).prefetch_related("comments", "comments__user")
    serializer_class = AssignedIncidentSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["academic_year", "incident", "student"]
    search_fields = ["student__first_name", "student__last_name", "student__admission_no", "incident__title"]
    ordering_fields = ["created_at", "point"]
    permission_codes = {
        "*": "behaviour.assigned_incident.view",
        "assign_bulk": "behaviour.assigned_incident.view",
        "assign_incident": "behaviour.assigned_incident.view",
        "student_incident_report": "behaviour.assigned_incident.view",
        "students_summary": "behaviour.assigned_incident.view",
        "students_grouped": "behaviour.assigned_incident.view",
        "student_rank_report": "behaviour.assigned_incident.view",
        "class_section_rank_report": "behaviour.assigned_incident.view",
        "incident_wise_report": "behaviour.assigned_incident.view",
    }

    def get_queryset(self):
        queryset = super().get_queryset()

        academic_year_id = self.request.query_params.get("academic_year_id")
        class_id = self.request.query_params.get("class_id")
        section_id = self.request.query_params.get("section_id")
        student_id = self.request.query_params.get("student_id")
        incident_id = self.request.query_params.get("incident_id")
        name = self.request.query_params.get("name")
        roll_no = self.request.query_params.get("roll_no")

        if academic_year_id not in (None, ""):
            queryset = queryset.filter(academic_year_id=academic_year_id)
        if student_id not in (None, ""):
            queryset = queryset.filter(student_id=student_id)
        if incident_id not in (None, ""):
            queryset = queryset.filter(incident_id=incident_id)
        if name not in (None, ""):
            queryset = queryset.filter(
                Q(student__first_name__icontains=name)
                | Q(student__last_name__icontains=name)
                | Q(student__admission_no__icontains=name)
            )
        if roll_no not in (None, ""):
            queryset = queryset.filter(Q(record__roll_no__icontains=roll_no) | Q(student__roll_no__icontains=roll_no))

        if class_id not in (None, ""):
            queryset = queryset.filter(Q(record__school_class_id=class_id) | Q(student__current_class_id=class_id))
        if section_id not in (None, ""):
            queryset = queryset.filter(Q(record__section_id=section_id) | Q(student__current_section_id=section_id))

        return queryset

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")

        incident = serializer.validated_data["incident"]
        student = serializer.validated_data["student"]
        point = serializer.validated_data.get("point", incident.point)

        if incident.school_id != school.id:
            raise ValidationError({"incident": "Selected incident does not belong to your school."})
        if student.school_id != school.id:
            raise ValidationError({"student": "Selected student does not belong to your school."})

        serializer.save(school=school, point=point, assigned_by=user)

    def _assign_incidents_bulk(self, request, data):
        school = request.user.school or getattr(request, "school", None)
        if not school and not request.user.is_superuser:
            raise PermissionDenied("School context is required.")

        incidents = list(Incident.objects.filter(school=school, id__in=data["incident_ids"]))
        students = list(Student.objects.filter(school=school, id__in=data["student_ids"]))

        if not incidents:
            raise ValidationError({"incident_ids": "No valid incidents found."})
        if not students:
            raise ValidationError({"student_ids": "No valid students found."})

        record_map = {}
        student_ids = [s.id for s in students]
        default_records = (
            StudentMultiClassRecord.objects.filter(student_id__in=student_ids)
            .order_by("student_id", "-is_default", "id")
            .select_related("school_class", "section")
        )
        for record in default_records:
            if record.student_id not in record_map:
                record_map[record.student_id] = record

        created_count = 0
        skipped_count = 0

        with transaction.atomic():
            for student in students:
                record = record_map.get(student.id)
                effective_class_id = record.school_class_id if record else student.current_class_id
                effective_section_id = record.section_id if record else student.current_section_id
                if data.get("class_id") and effective_class_id != data["class_id"]:
                    continue
                if data.get("section_id") and effective_section_id != data["section_id"]:
                    continue

                for incident in incidents:
                    _obj, created = AssignedIncident.objects.get_or_create(
                        school=school,
                        academic_year_id=data.get("academic_year_id"),
                        incident=incident,
                        student=student,
                        record=record,
                        defaults={"point": incident.point, "assigned_by": request.user},
                    )
                    if created:
                        created_count += 1
                    else:
                        skipped_count += 1

        return Response(
            {
                "created": created_count,
                "skipped": skipped_count,
                "message": "Incidents assigned successfully.",
            },
            status=status.HTTP_200_OK,
        )

    @action(detail=False, methods=["post"], url_path="assign-bulk")
    def assign_bulk(self, request):
        serializer = AssignedIncidentBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        return self._assign_incidents_bulk(request, data)

    @action(detail=False, methods=["post"], url_path="assign-incident")
    def assign_incident(self, request):
        serializer = AssignedIncidentBulkCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        return self._assign_incidents_bulk(request, data)

    @action(detail=False, methods=["get"], url_path="students-grouped")
    def students_grouped(self, request):
        school = request.user.school or getattr(request, "school", None)
        if not school and not request.user.is_superuser:
            raise PermissionDenied("School context is required.")

        class_id = request.query_params.get("class_id")
        section_id = request.query_params.get("section_id")
        keyword = (request.query_params.get("q") or "").strip()

        queryset = (
            Student.objects.filter(school=school, is_active=True, is_deleted=False)
            .select_related("current_class", "current_section")
            .order_by("current_class__numeric_order", "current_class__name", "current_section__name", "admission_no")
        )

        if class_id not in (None, ""):
            queryset = queryset.filter(current_class_id=class_id)
        if section_id not in (None, ""):
            queryset = queryset.filter(current_section_id=section_id)
        if keyword:
            queryset = queryset.filter(
                Q(first_name__icontains=keyword)
                | Q(last_name__icontains=keyword)
                | Q(admission_no__icontains=keyword)
                | Q(roll_no__icontains=keyword)
            )

        grouped = {}
        for student in queryset:
            class_name = student.current_class.name if student.current_class_id else "Unassigned Class"
            section_name = student.current_section.name if student.current_section_id else "Unassigned Section"
            if class_name not in grouped:
                grouped[class_name] = {}
            if section_name not in grouped[class_name]:
                grouped[class_name][section_name] = []

            full_name = f"{(student.first_name or '').strip()} {(student.last_name or '').strip()}".strip()
            grouped[class_name][section_name].append(
                {
                    "id": student.id,
                    "admission_no": student.admission_no,
                    "roll_no": student.roll_no,
                    "first_name": student.first_name,
                    "last_name": student.last_name,
                    "full_name": full_name,
                    "class_id": student.current_class_id,
                    "section_id": student.current_section_id,
                }
            )

        return Response(grouped)

    @action(detail=False, methods=["get"], url_path="student-incident-report")
    def student_incident_report(self, request):
        queryset = self.get_queryset().order_by("-created_at")
        grouped = defaultdict(lambda: {"total_points": 0, "total_incidents": 0, "incidents": []})

        for row in queryset:
            key = row.student_id
            entry = grouped[key]
            entry["student_id"] = row.student_id
            entry["student_name"] = f"{(row.student.first_name or '').strip()} {(row.student.last_name or '').strip()}".strip()
            entry["admission_no"] = row.student.admission_no
            entry["class_id"] = row.record.school_class_id if row.record_id else row.student.current_class_id
            entry["section_id"] = row.record.section_id if row.record_id else row.student.current_section_id
            entry["total_points"] += row.point
            entry["total_incidents"] += 1
            entry["incidents"].append(
                {
                    "id": row.id,
                    "incident": row.incident.title,
                    "point": row.point,
                    "created_at": row.created_at,
                }
            )

        return Response(list(grouped.values()))

    @action(detail=False, methods=["get"], url_path="students-summary")
    def students_summary(self, request):
        school = request.user.school or getattr(request, "school", None)
        if not school and not request.user.is_superuser:
            raise PermissionDenied("School context is required.")

        academic_year_id = request.query_params.get("academic_year_id")
        class_id = request.query_params.get("class_id")
        section_id = request.query_params.get("section_id")
        name = request.query_params.get("name")
        roll_no = request.query_params.get("roll_no")

        students_qs = Student.objects.filter(school=school, is_active=True)
        if class_id not in (None, ""):
            students_qs = students_qs.filter(current_class_id=class_id)
        if section_id not in (None, ""):
            students_qs = students_qs.filter(current_section_id=section_id)
        if name not in (None, ""):
            students_qs = students_qs.filter(
                Q(first_name__icontains=name) | Q(last_name__icontains=name) | Q(admission_no__icontains=name)
            )
        if roll_no not in (None, ""):
            students_qs = students_qs.filter(roll_no__icontains=roll_no)

        students = list(students_qs.order_by("first_name", "last_name"))
        student_ids = [row.id for row in students]

        summary_qs = AssignedIncident.objects.filter(school=school, student_id__in=student_ids)
        if academic_year_id not in (None, ""):
            summary_qs = summary_qs.filter(academic_year_id=academic_year_id)

        totals_by_student = {
            row["student_id"]: {
                "total_incidents": row["total_incidents"],
                "total_points": row["total_points"],
            }
            for row in summary_qs.values("student_id").annotate(
                total_incidents=Count("id"),
                total_points=Coalesce(Sum("point"), 0),
            )
        }

        payload = []
        for student in students:
            totals = totals_by_student.get(student.id, {"total_incidents": 0, "total_points": 0})
            payload.append(
                {
                    "id": student.id,
                    "admission_no": student.admission_no,
                    "roll_no": student.roll_no,
                    "first_name": student.first_name,
                    "last_name": student.last_name,
                    "current_class": student.current_class_id,
                    "current_section": student.current_section_id,
                    "total_incidents": totals["total_incidents"],
                    "total_points": totals["total_points"],
                }
            )

        return Response(payload)

    @action(detail=False, methods=["get"], url_path="student-rank-report")
    def student_rank_report(self, request):
        queryset = self.get_queryset()
        operator = (request.query_params.get("operator") or "").strip().lower()
        threshold_raw = request.query_params.get("point")

        rows = (
            queryset.values(
                "student_id",
                "student__first_name",
                "student__last_name",
                "student__admission_no",
                "record__school_class_id",
                "record__section_id",
                "student__current_class_id",
                "student__current_section_id",
            )
            .annotate(
                total_points=Coalesce(Sum("point"), 0),
                total_incidents=Coalesce(Count("id"), 0),
            )
            .order_by("-total_points", "student__first_name", "student__last_name")
        )

        if threshold_raw not in (None, ""):
            try:
                threshold = int(threshold_raw)
            except ValueError:
                raise ValidationError({"point": "Point threshold must be a number."})
            if operator == "below":
                rows = rows.filter(total_points__lt=threshold)
            else:
                rows = rows.filter(total_points__gte=threshold)

        payload = []
        for row in rows:
            payload.append(
                {
                    "student_id": row["student_id"],
                    "student_name": f"{(row['student__first_name'] or '').strip()} {(row['student__last_name'] or '').strip()}".strip(),
                    "admission_no": row["student__admission_no"],
                    "class_id": row["record__school_class_id"] or row["student__current_class_id"],
                    "section_id": row["record__section_id"] or row["student__current_section_id"],
                    "total_points": row["total_points"],
                    "total_incidents": row["total_incidents"],
                }
            )

        return Response(payload)

    @action(detail=False, methods=["get"], url_path="class-section-rank-report")
    def class_section_rank_report(self, request):
        queryset = self.get_queryset()
        rows = (
            queryset.values(
                "record__school_class_id",
                "record__section_id",
                "student__current_class_id",
                "student__current_section_id",
            )
            .annotate(
                total_points=Coalesce(Sum("point"), 0),
                total_incidents=Coalesce(Count("id"), 0),
                student_count=Count("student", distinct=True),
            )
            .order_by("-total_points")
        )

        payload = []
        for row in rows:
            payload.append(
                {
                    "class_id": row["record__school_class_id"] or row["student__current_class_id"],
                    "section_id": row["record__section_id"] or row["student__current_section_id"],
                    "total_points": row["total_points"],
                    "total_incidents": row["total_incidents"],
                    "student_count": row["student_count"],
                }
            )
        return Response(payload)

    @action(detail=False, methods=["get"], url_path="incident-wise-report")
    def incident_wise_report(self, request):
        queryset = self.get_queryset().select_related("incident", "student")

        grouped = defaultdict(lambda: {"assignment_count": 0, "total_points": 0, "students": []})
        for row in queryset:
            key = row.incident_id
            entry = grouped[key]
            entry["incident_id"] = row.incident_id
            entry["incident_title"] = row.incident.title
            entry["assignment_count"] += 1
            entry["total_points"] += row.point
            entry["students"].append(
                {
                    "student_id": row.student_id,
                    "student_name": f"{(row.student.first_name or '').strip()} {(row.student.last_name or '').strip()}".strip(),
                    "point": row.point,
                }
            )

        return Response(list(grouped.values()))


class AssignedIncidentCommentViewSet(SchoolScopedModelViewSet):
    queryset = AssignedIncidentComment.objects.select_related("school", "assigned_incident", "user").all()
    serializer_class = AssignedIncidentCommentSerializer
    filterset_fields = ["assigned_incident"]
    permission_codes = {"*": "behaviour.assigned_incident_comment.view"}

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")

        assigned_incident = serializer.validated_data["assigned_incident"]
        if assigned_incident.school_id != school.id:
            raise ValidationError({"assigned_incident": "Selected incident does not belong to your school."})

        serializer.save(school=school, user=user)


class BehaviourRecordSettingAPIView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        user = request.user
        if user.is_superuser:
            return
        code = "behaviour.record_setting.view"
        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")

    def _get_school(self, request):
        school = request.user.school or getattr(request, "school", None)
        if not school and not request.user.is_superuser:
            raise PermissionDenied("School context is required.")
        return school

    def get(self, request):
        school = self._get_school(request)
        setting, _created = BehaviourRecordSetting.objects.get_or_create(school=school)
        return Response(BehaviourRecordSettingSerializer(setting).data)

    def patch(self, request):
        school = self._get_school(request)
        setting, _created = BehaviourRecordSetting.objects.get_or_create(school=school)
        serializer = BehaviourRecordSettingSerializer(setting, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)

    def put(self, request):
        school = self._get_school(request)
        setting, _created = BehaviourRecordSetting.objects.get_or_create(school=school)
        serializer = BehaviourRecordSettingSerializer(setting, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(serializer.data)
