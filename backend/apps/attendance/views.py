from collections import defaultdict
import csv
from datetime import date, datetime
from io import BytesIO, StringIO

from django.http import HttpResponse
from django.db import IntegrityError, models, transaction
from django.db.models import Count, Case, When, IntegerField
from rest_framework import permissions, status
from rest_framework.exceptions import PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from config.pagination import ApiPageNumberPagination

from apps.core.models import Class, Section
from apps.students.models import Student

from .models import StudentAttendance, StudentAttendanceBulk
from .serializers import (
    StudentAttendanceSerializer,
    StudentAttendanceStoreRequestSerializer,
    StudentSearchRequestSerializer,
)
from .services import send_present_attendance_notifications


class AttendanceTenantMixin:
    permission_classes = [permissions.IsAuthenticated]

    def _required_permission_code(self):
        class_name = self.__class__.__name__.lower()
        if "import" in class_name or "downloadsample" in class_name:
            return "student_info.student_attendance_import.view"
        return "student_info.student_attendance.view"

    def initial(self, request, *args, **kwargs):
        super().initial(request, *args, **kwargs)
        user = request.user
        if user.is_superuser:
            return
        code = self._required_permission_code()
        if not hasattr(user, "has_permission_code") or not user.has_permission_code(code):
            raise PermissionDenied("You do not have permission to perform this action.")

    def school_filter(self, request):
        return {} if request.user.is_superuser else {"school_id": request.user.school_id}


class StudentAttendanceListCreateAPIView(AttendanceTenantMixin, APIView):
    def get(self, request):
        queryset = StudentAttendance.objects.select_related("student")
        if not request.user.is_superuser:
            if not request.user.school_id:
                return Response([])
            queryset = queryset.filter(school_id=request.user.school_id)

        params = request.query_params
        if params.get("class_id"):
            queryset = queryset.filter(class_id=params["class_id"])
        if params.get("section_id"):
            queryset = queryset.filter(section_id=params["section_id"])
        if params.get("student_id"):
            queryset = queryset.filter(student_id=params["student_id"])
        if params.get("date"):
            queryset = queryset.filter(attendance_date=params["date"])
        if params.get("month"):
            queryset = queryset.filter(attendance_date__month=params["month"])
        if params.get("year"):
            queryset = queryset.filter(attendance_date__year=params["year"])
        if params.get("academic_year_id"):
            queryset = queryset.filter(academic_year_id=params["academic_year_id"])

        ordered_queryset = queryset.order_by("-attendance_date", "student_id")
        paginator = ApiPageNumberPagination()
        page = paginator.paginate_queryset(ordered_queryset, request)
        serializer = StudentAttendanceSerializer(page if page is not None else ordered_queryset, many=True)
        if page is not None:
            return paginator.get_paginated_response(serializer.data)
        return Response(serializer.data)

    def post(self, request):
        serializer = StudentAttendanceSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            serializer.save(school=request.user.school)
        except IntegrityError:
            return Response(
                {"detail": "Attendance already exists for this student on the selected date."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class StudentAttendanceRetrieveUpdateDeleteAPIView(AttendanceTenantMixin, APIView):
    def get_object(self, request, pk):
        queryset = StudentAttendance.objects.all()
        if not request.user.is_superuser:
            queryset = queryset.filter(school_id=request.user.school_id)
        return get_object_or_404(queryset, pk=pk)

    def get(self, request, pk):
        obj = self.get_object(request, pk)
        return Response(StudentAttendanceSerializer(obj).data)

    def put(self, request, pk):
        obj = self.get_object(request, pk)
        serializer = StudentAttendanceSerializer(obj, data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(school=request.user.school)
        return Response(serializer.data)

    def patch(self, request, pk):
        obj = self.get_object(request, pk)
        serializer = StudentAttendanceSerializer(obj, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save(school=request.user.school)
        return Response(serializer.data)

    def delete(self, request, pk):
        obj = self.get_object(request, pk)
        obj.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudentAttendanceIndexAPIView(AttendanceTenantMixin, APIView):
    """Parity with PHP index(): returns classes used in the criteria form."""

    def get(self, request):
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        return Response([
            {"id": c.id, "class_name": c.name}
            for c in classes
        ])


class StudentSearchAPIView(AttendanceTenantMixin, APIView):
    """Parity with PHP studentSearch() with enhanced validation."""

    def post(self, request):
        req = StudentSearchRequestSerializer(data=request.data)
        req.is_valid(raise_exception=True)

        class_id = req.validated_data["class"]
        section_id = req.validated_data["section"]
        attendance_date = req.validated_data["attendance_date"]

        # Validate date is not in future
        from datetime import date as date_type
        if attendance_date > date_type.today():
            return Response(
                {"success": False, "message": "Attendance cannot be marked for future dates"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        include_legacy_payload = str(request.data.get("include_legacy_payload", "false")).lower() in {
            "1",
            "true",
            "yes",
        }

        students = list(
            Student.objects.filter(
            current_class_id=class_id,
            is_active=True,
            **self.school_filter(request),
            )
            .filter(
            # Include students assigned to this section OR students with the right class but no section
            models.Q(current_section_id=section_id) | models.Q(current_section_id__isnull=True)
            )
            .order_by("id")
            .values("id", "admission_no", "first_name", "last_name", "roll_no")
        )

        attendance_type = ""

        # Query attendance by student_ids (not class/section) so records saved
        # without class_id/section_id are still found (backward-compatible).
        student_ids = [s["id"] for s in students]
        attendance_rows = {
            row.student_id: row
            for row in StudentAttendance.objects.filter(
                attendance_date=attendance_date,
                student_id__in=student_ids,
                **self.school_filter(request),
            )
        }

        table_students = []
        for student in students:
            sid = student["id"]
            att = attendance_rows.get(sid)
            if attendance_type == "" and att:
                attendance_type = att.attendance_type
            table_students.append(
                {
                    "id": sid,
                    "admission_no": student["admission_no"],
                    "first_name": student["first_name"],
                    "last_name": student["last_name"],
                    "roll_no": student["roll_no"],
                    "attendance_type": att.attendance_type if att else None,
                    "attendance_note": att.notes if att else "",
                    "lunch": att.lunch if att else False,
                }
            )

        response_data = {
            "date": attendance_date,
            "class_id": class_id,
            "section_id": section_id,
            "attendance_type": attendance_type,
            "students": table_students,
        }

        # Optional backward-compatible payload for legacy clients.
        if include_legacy_payload:
            class_info = Class.objects.filter(id=class_id).first()
            section_info = Section.objects.filter(id=section_id).first()
            classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")

            already_assigned_students = []
            new_students = []
            for student in students:
                sid = student["id"]
                att = attendance_rows.get(sid)
                if att:
                    already_assigned_students.append(
                        {
                            "id": att.id,
                            "student_id": att.student_id,
                            "attendance_type": att.attendance_type,
                            "notes": att.notes,
                            "lunch": att.lunch,
                        }
                    )
                else:
                    new_students.append(student)

            response_data.update(
                {
                    "classes": [{"id": c.id, "class_name": c.name} for c in classes],
                    "already_assigned_students": already_assigned_students,
                    "new_students": new_students,
                    "search_info": {
                        "class_name": class_info.name if class_info else "",
                        "section_name": section_info.name if section_info else "",
                        "date": attendance_date,
                    },
                }
            )

        return Response(response_data)


class StudentAttendanceStoreAPIView(AttendanceTenantMixin, APIView):
    """Parity with PHP studentAttendanceStore() with enhanced validation."""

    def post(self, request):
        try:
            req = StudentAttendanceStoreRequestSerializer(data=request.data)
            req.is_valid(raise_exception=True)
            data = req.validated_data

            attendance_map = data.get("attendance") or data.get("attendance_type") or {}
            lunch_map = data.get("lunch") or {}
            lock_attendance = data.get("lock_attendance", False)

            if not attendance_map and not lunch_map:
                return Response(
                    {"success": False, "message": "Please provide attendance or lunch data"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            attendance_ids = set(data.get("id", []))
            attendance_ids_str = {str(i) for i in attendance_ids}
            lunch_count = len([v for k, v in lunch_map.items() if str(k) in attendance_ids_str])
            status_count = len([v for k, v in attendance_map.items() if str(k) in attendance_ids_str])

            # Require full status coverage only for status submissions.
            if attendance_map and status_count != len(attendance_ids):
                return Response(
                    {"success": False, "message": "Please mark attendance for all students"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            # Require full lunch coverage only for lunch-only submissions.
            if not attendance_map and lunch_map and lunch_count != len(attendance_ids):
                return Response(
                    {"success": False, "message": "Please mark lunch status for all students"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            school_scope = self.school_filter(request)
            student_scope = Student.objects.filter(id__in=attendance_ids, **school_scope)
            if data.get("class_id"):
                student_scope = student_scope.filter(current_class_id=data.get("class_id"))
            if data.get("section_id"):
                student_scope = student_scope.filter(
                    models.Q(current_section_id=data.get("section_id")) | models.Q(current_section_id__isnull=True)
                )

            students = list(student_scope.select_related("guardian"))
            if not students:
                return Response(
                    {"success": False, "message": "No students found for selected class and section"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            student_map = {s.id: s for s in students}

            note_map = data.get("note") or data.get("attendance_note") or {}

            with transaction.atomic():
                for student_id in data["id"]:
                    if student_id not in student_map:
                        continue

                    existing_lunch = False
                    existing_type = None
                    # Delete existing attendance for same date
                    existing = StudentAttendance.objects.filter(
                        student_id=student_id,
                        attendance_date=data["date"],
                        **school_scope,
                    ).first()
                    if existing and not existing.is_locked:
                        existing_lunch = existing.lunch
                        existing_type = existing.attendance_type
                        existing.delete()
                    elif existing and existing.is_locked:
                        return Response(
                            {"success": False, "message": "Cannot update locked attendance. Only admin can override."},
                            status=status.HTTP_400_BAD_REQUEST,
                        )

                    attendance = StudentAttendance()
                    attendance.student_id = student_id
                    if data.get("mark_holiday"):
                        attendance.attendance_type = "H"
                        attendance.notes = "Holiday"
                    else:
                        raw_type = attendance_map.get(str(student_id))
                        if raw_type is None:
                            raw_type = attendance_map.get(student_id)
                        
                        # Validate attendance type
                        valid_types = ["P", "A", "L", "F", "H"]
                        if raw_type and raw_type not in valid_types:
                            return Response(
                                {"success": False, "message": "Invalid attendance status"},
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                        attendance.attendance_type = raw_type or existing_type or "P"

                        raw_note = note_map.get(str(student_id))
                        if raw_note is None:
                            raw_note = note_map.get(student_id)
                        
                        # Validate note length
                        note_text = raw_note or ""
                        if len(note_text) > 250:
                            return Response(
                                {"success": False, "message": "Note cannot exceed 250 characters"},
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                        attendance.notes = note_text

                    raw_lunch = lunch_map.get(str(student_id))
                    if raw_lunch is None:
                        raw_lunch = lunch_map.get(student_id)
                    attendance.lunch = bool(raw_lunch) if raw_lunch is not None else existing_lunch

                    attendance.attendance_date = data["date"]
                    attendance.school = request.user.school
                    attendance.academic_year_id = data.get("academic_year_id")
                    attendance.class_id = data.get("class_id")
                    attendance.section_id = data.get("section_id")
                    attendance.marked_by = request.user
                    attendance.is_locked = lock_attendance
                    attendance.save()

                    if attendance_map and attendance.attendance_type == "P" and existing_type != "P":
                        student = student_map.get(student_id)
                        if student:
                            send_present_attendance_notifications(student, attendance.attendance_date)

            return Response(
                {"success": True, "message": "Attendance saved successfully"},
                status=status.HTTP_200_OK,
            )
        except Exception as e:
            detail = getattr(e, "detail", None)
            if detail is not None:
                if isinstance(detail, dict):
                    first_message = "Validation failed"
                    for value in detail.values():
                        if isinstance(value, (list, tuple)) and value:
                            first_message = str(value[0])
                            break
                        if isinstance(value, str):
                            first_message = value
                            break
                    return Response(
                        {"success": False, "message": first_message, "field_errors": detail},
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                return Response(
                    {"success": False, "message": str(detail)},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(
                {"success": False, "message": f"Failed to save attendance: {str(e)}"},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class StudentAttendanceHolidayAPIView(AttendanceTenantMixin, APIView):
    """Parity with PHP studentAttendanceHoliday()."""

    def post(self, request):
        class_id = request.data.get("class_id")
        section_id = request.data.get("section_id")
        attendance_date = request.data.get("attendance_date")
        purpose = request.data.get("purpose", "mark")

        students = Student.objects.filter(
            current_class_id=class_id,
            current_section_id=section_id,
            is_active=True,
            **self.school_filter(request),
        )

        if purpose == "mark":
            for student in students:
                existing = StudentAttendance.objects.filter(
                    student_id=student.id,
                    attendance_date=attendance_date,
                    **self.school_filter(request),
                ).first()
                if existing:
                    existing.delete()

                attendance = StudentAttendance(
                    attendance_type="H",
                    notes="Holiday",
                    attendance_date=attendance_date,
                    student_id=student.id,
                    school=request.user.school,
                    academic_year_id=request.data.get("academic_year_id"),
                    class_id=class_id,
                    section_id=section_id,
                )
                attendance.save()

        elif purpose == "unmark":
            for student in students:
                existing = StudentAttendance.objects.filter(
                    student_id=student.id,
                    attendance_date=attendance_date,
                    **self.school_filter(request),
                ).first()
                if existing:
                    existing.delete()

        return Response({"status": "ok"}, status=status.HTTP_200_OK)


class StudentAttendanceMonthlyReportAPIView(AttendanceTenantMixin, APIView):
    def get(self, request):
        class_id = request.query_params.get("class_id")
        section_id = request.query_params.get("section_id")
        month = request.query_params.get("month")
        year = request.query_params.get("year")

        if not class_id or not section_id or not month or not year:
            return Response(
                {"detail": "class_id, section_id, month, year are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            class_id_int = int(class_id)
            section_id_int = int(section_id)
            month_int = int(month)
            year_int = int(year)
        except (TypeError, ValueError):
            return Response(
                {"detail": "class_id, section_id, month, year must be numeric."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if month_int < 1 or month_int > 12:
            return Response(
                {"detail": "month must be between 1 and 12."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if year_int < 2000 or year_int > 2100:
            return Response(
                {"detail": "year must be a valid 4-digit year."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        records = (
            StudentAttendance.objects.filter(
                class_id=class_id_int,
                section_id=section_id_int,
                attendance_date__month=month_int,
                attendance_date__year=year_int,
                **self.school_filter(request),
            )
            .select_related("student")
            .order_by("student_id", "attendance_date")
        )

        grouped = defaultdict(lambda: {"P": 0, "A": 0, "L": 0, "F": 0, "H": 0, "name": "", "admission_no": ""})
        for rec in records:
            sid = rec.student_id
            grouped[sid]["name"] = f"{rec.student.first_name} {rec.student.last_name}".strip()
            grouped[sid]["admission_no"] = rec.student.admission_no
            grouped[sid][rec.attendance_type] = grouped[sid].get(rec.attendance_type, 0) + 1

        result = [
            {
                "student_id": sid,
                "admission_no": info["admission_no"],
                "name": info["name"],
                "present": info["P"],
                "absent": info["A"],
                "late": info["L"],
                "half_day": info["F"],
                "holiday": info["H"],
            }
            for sid, info in grouped.items()
        ]
        paginator = ApiPageNumberPagination()
        page = paginator.paginate_queryset(result, request)
        if page is not None:
            return paginator.get_paginated_response(page)
        return Response(result)


class StudentAttendanceImportAPIView(AttendanceTenantMixin, APIView):
    """Parity with PHP studentAttendanceImport() for criteria/form data."""

    def get(self, request):
        classes = Class.objects.filter(**self.school_filter(request)).order_by("numeric_order", "name")
        return Response(
            {
                "classes": [{"id": c.id, "class_name": c.name} for c in classes],
            }
        )


class StudentAttendanceDownloadSampleAPIView(AttendanceTenantMixin, APIView):
    """Parity with PHP downloadStudentAtendanceFile()."""
    
    # Allow any authenticated user to download sample (no special permission needed)
    def _required_permission_code(self):
        return None  # No permission code check for sample download

    def get(self, request):
        try:
            from openpyxl import Workbook
        except Exception:
            return Response({"detail": "openpyxl is required for sample export."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "student_attendance_sheet"
        headers = ["admission_no", "attendance_date", "attendance_type", "note"]
        sheet.append(headers)

        output = BytesIO()
        workbook.save(output)
        output.seek(0)

        response = HttpResponse(
            output.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = 'attachment; filename="student_attendance_sheet.xlsx"'
        return response


class StudentAttendanceBulkStoreAPIView(AttendanceTenantMixin, APIView):
    """Parity with PHP studentAttendanceBulkStore()."""

    parser_classes = [MultiPartParser, FormParser]

    def _normalize_date(self, value):
        if value is None or value == "":
            return None
        if isinstance(value, date):
            return value
        if isinstance(value, datetime):
            return value.date()
        if isinstance(value, (int, float)):
            try:
                from openpyxl.utils.datetime import from_excel

                converted = from_excel(value)
                if isinstance(converted, datetime):
                    return converted.date()
                if isinstance(converted, date):
                    return converted
            except Exception:
                return None
        if isinstance(value, str):
            text = value.strip()
            for fmt in ["%Y-%m-%d", "%m/%d/%Y", "%d/%m/%Y", "%Y/%m/%d"]:
                try:
                    return datetime.strptime(text, fmt).date()
                except ValueError:
                    continue
        return None

    def post(self, request):
        attendance_date = request.data.get("attendance_date")
        class_id = request.data.get("class")
        section_id = request.data.get("section")
        uploaded_file = request.FILES.get("file")

        # Validation: Required fields
        if not attendance_date or not class_id or not section_id or not uploaded_file:
            return Response(
                {"detail": "attendance_date, file, class and section are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validation: File format
        ext = uploaded_file.name.split(".")[-1].lower() if "." in uploaded_file.name else ""
        if ext not in {"csv", "xlsx", "xls"}:
            return Response(
                {"detail": "The file must be a file of type: xlsx, csv or xls"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validation: File size (5MB max)
        file_size_mb = uploaded_file.size / (1024 * 1024)
        if file_size_mb > 5:
            return Response(
                {"detail": f"File size exceeds 5MB limit (current: {file_size_mb:.2f}MB)"},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Validation: Date format and range
        request_date = self._normalize_date(attendance_date)
        if not request_date:
            return Response({"detail": "Invalid attendance_date."}, status=status.HTTP_400_BAD_REQUEST)

        # Validation: Date not in future
        from datetime import date as date_type
        if request_date > date_type.today():
            return Response(
                {"detail": "Cannot import attendance for future dates."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school_scope = self.school_filter(request)
        class_qs = Class.objects.filter(id=class_id, **school_scope)
        if not class_qs.exists():
            return Response({"detail": "Invalid class selected."}, status=status.HTTP_400_BAD_REQUEST)
        section_qs = Section.objects.filter(id=section_id, school_class_id=class_id)
        if not request.user.is_superuser:
            section_qs = section_qs.filter(school_class__school_id=request.user.school_id)
        if not section_qs.exists():
            return Response({"detail": "Invalid section selected for class."}, status=status.HTTP_400_BAD_REQUEST)

        imported_rows = []
        errors: list[dict] = []
        row_number = 2  # Start from 2 (header is row 1)

        # Parse file
        if ext == "csv":
            try:
                content = uploaded_file.read().decode("utf-8", errors="ignore")
                reader = csv.DictReader(StringIO(content))
                for row in reader:
                    imported_rows.append((row_number, row))
                    row_number += 1
            except Exception as e:
                return Response(
                    {"detail": f"Failed to parse CSV file: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        else:
            try:
                from openpyxl import load_workbook
            except Exception:
                return Response({"detail": "openpyxl is required for xlsx import."}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

            try:
                workbook = load_workbook(uploaded_file, data_only=True)
                sheet = workbook.active
                rows = list(sheet.iter_rows(values_only=True))
                if not rows:
                    return Response({"detail": "File is empty."}, status=status.HTTP_400_BAD_REQUEST)

                headers = [str(h).strip() if h is not None else "" for h in rows[0]]
                header_map = {h: i for i, h in enumerate(headers)}

                for idx, row in enumerate(rows[1:], start=2):
                    row_dict = {}
                    for header, col_idx in header_map.items():
                        if col_idx < len(row):
                            row_dict[header] = row[col_idx]
                    imported_rows.append((idx, row_dict))
            except Exception as e:
                return Response(
                    {"detail": f"Failed to parse Excel file: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        school_filter = school_scope
        processed_count = 0
        failed_count = 0

        # Validate and process rows
        valid_attendance_types = ["P", "A", "L", "F", "H"]

        for row_num, row_data in imported_rows:
            row_errors = []
            admission_no = str(row_data.get("admission_no") or "").strip()
            attendance_type = str(row_data.get("attendance_type") or "").strip()
            note = str(row_data.get("note") or "").strip()

            # Validate admission_no
            if not admission_no:
                row_errors.append({"field": "admission_no", "message": "Admission number is required"})

            # Validate attendance_type
            if attendance_type and attendance_type not in valid_attendance_types:
                row_errors.append({
                    "field": "attendance_type",
                    "message": "Invalid attendance type. Use one of P (Present), A (Absent), L (Late), F (Half Day), H (Holiday)."
                })

            # Validate note length
            if len(note) > 250:
                row_errors.append({"field": "note", "message": "Note cannot exceed 250 characters"})

            if row_errors:
                for err in row_errors:
                    errors.append({
                        "row": row_num,
                        "field": err["field"],
                        "message": err["message"]
                    })
                failed_count += 1
                continue

            # Check student exists
            student = Student.objects.filter(admission_no=admission_no, **school_filter).first()
            if not student:
                errors.append({
                    "row": row_num,
                    "field": "admission_no",
                    "message": f"Admission number '{admission_no}' was not found in this school."
                })
                failed_count += 1
                continue

            # Ensure uploaded admission number belongs to the selected class and section.
            selected_class_id = int(class_id)
            selected_section_id = int(section_id)
            if student.current_class_id != selected_class_id or student.current_section_id != selected_section_id:
                errors.append({
                    "row": row_num,
                    "field": "admission_no",
                    "message": (
                        f"Admission number '{admission_no}' does not belong to the selected "
                        "class/section."
                    ),
                })
                failed_count += 1
                continue

            try:
                # Delete existing attendance for this student on the date
                StudentAttendance.objects.filter(
                    student_id=student.id,
                    attendance_date=request_date,
                    **school_filter,
                ).delete()

                # Create new attendance record
                attendance = StudentAttendance()
                attendance.student_id = student.id
                attendance.attendance_date = request_date
                attendance.attendance_type = attendance_type or "P"
                attendance.notes = note
                attendance.school = request.user.school
                attendance.academic_year_id = request.data.get("academic_year_id")
                attendance.class_id = class_id
                attendance.section_id = section_id
                attendance.save()

                processed_count += 1
            except Exception as e:
                errors.append({
                    "row": row_num,
                    "field": "system",
                    "message": f"Failed to save record: {str(e)[:100]}"
                })
                failed_count += 1

        # Determine response based on results
        if processed_count == 0 and failed_count > 0:
            # All failed
            return Response(
                {
                    "success": False,
                    "message": f"Failed to import any records. {failed_count} errors found.",
                    "data": {
                        "imported": 0,
                        "failed": failed_count,
                        "errors": errors[:50]  # Limit to first 50 errors
                    }
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        elif failed_count > 0:
            # Partial success
            return Response(
                {
                    "success": True,
                    "message": f"{processed_count} records imported, {failed_count} failed",
                    "data": {
                        "imported": processed_count,
                        "failed": failed_count,
                        "errors": errors[:50]  # Limit to first 50 errors
                    }
                },
                status=status.HTTP_200_OK,
            )
        else:
            # Full success
            return Response(
                {
                    "success": True,
                    "message": f"Successfully imported {processed_count} attendance records",
                    "data": {
                        "imported": processed_count,
                        "failed": 0,
                        "errors": []
                    }
                },
                status=status.HTTP_200_OK,
            )


class ClassAttendanceSummaryAPIView(AttendanceTenantMixin, APIView):
    """Returns per-class attendance breakdown for a given date."""

    def get(self, request):
        from datetime import date as date_type
        date_str = request.query_params.get("date") or str(date_type.today())
        try:
            parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"success": False, "message": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school_filter = self.school_filter(request)

        # Per-class student totals — query directly from Student model using current_class FK
        student_counts = (
            Student.objects.filter(is_active=True, **school_filter)
            .exclude(current_class=None)
            .values("current_class_id")
            .annotate(count=Count("id"))
        )
        total_by_class: dict[int, int] = {row["current_class_id"]: row["count"] for row in student_counts}

        # Per-class attendance aggregates for the date
        rows = (
            StudentAttendance.objects.filter(attendance_date=parsed_date, **school_filter)
            .values("class_id")
            .annotate(
                present=Count(Case(When(attendance_type="P", then=1), output_field=IntegerField())),
                absent=Count(Case(When(attendance_type="A", then=1), output_field=IntegerField())),
                late=Count(Case(When(attendance_type="L", then=1), output_field=IntegerField())),
            )
        )

        counts_by_class: dict[int, dict] = {}
        for row in rows:
            cid = row["class_id"]
            if cid is not None:
                counts_by_class[cid] = {
                    "present": row["present"] or 0,
                    "absent": row["absent"] or 0,
                    "late": row["late"] or 0,
                }

        # Build result using union of both sets so all classes are represented
        all_class_ids = set(total_by_class.keys()) | set(counts_by_class.keys())
        result = []
        for cls_id in all_class_ids:
            total = total_by_class.get(cls_id, 0)
            c = counts_by_class.get(cls_id, {"present": 0, "absent": 0, "late": 0})
            marked = c["present"] + c["absent"] + c["late"]
            result.append({
                "class_id": cls_id,
                "total": total,
                "present": c["present"],
                "absent": c["absent"],
                "late": c["late"],
                "unmarked": max(0, total - marked),
                "pct": round((c["present"] / total) * 100) if total > 0 else 0,
            })

        return Response({"date": date_str, "classes": result})


class StudentAttendanceDailySummaryAPIView(AttendanceTenantMixin, APIView):
    """Returns aggregated attendance counts for a given date (school-wide)."""

    def get(self, request):
        from datetime import date as date_type
        date_str = request.query_params.get("date") or str(date_type.today())
        try:
            parsed_date = datetime.strptime(date_str, "%Y-%m-%d").date()
        except ValueError:
            return Response(
                {"success": False, "message": "Invalid date format. Use YYYY-MM-DD."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        school_filter = self.school_filter(request)

        total = Student.objects.filter(is_active=True, **school_filter).count()

        counts = StudentAttendance.objects.filter(
            attendance_date=parsed_date,
            **school_filter,
        ).aggregate(
            present=Count(Case(When(attendance_type="P", then=1), output_field=IntegerField())),
            absent=Count(Case(When(attendance_type="A", then=1), output_field=IntegerField())),
            late=Count(Case(When(attendance_type="L", then=1), output_field=IntegerField())),
        )

        present = counts.get("present") or 0
        absent = counts.get("absent") or 0
        late = counts.get("late") or 0
        marked = present + absent + late
        unmarked = max(0, total - marked)

        return Response({
            "date": date_str,
            "total_students": total,
            "present": present,
            "absent": absent,
            "late": late,
            "unmarked": unmarked,
        })
