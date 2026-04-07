from django.db import IntegrityError, transaction
import csv
import io
import re
from datetime import datetime
from django.utils import timezone
from django.db.models.deletion import ProtectedError
from django.db.models import Count, Q
from rest_framework import permissions, status, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from .models import (
    Guardian,
    Student,
    StudentCategory,
    StudentDocument,
    StudentGroup,
    StudentMultiClassRecord,
    StudentRecordAudit,
    StudentSubjectAssignment,
    StudentPromotionHistory,
    StudentTransferHistory,
)
from .serializers import (
    GuardianSerializer,
    StudentCategorySerializer,
    StudentDocumentSerializer,
    StudentGroupSerializer,
    StudentMultiClassBulkSaveSerializer,
    StudentMultiClassRecordSerializer,
    StudentRecordAuditSerializer,
    StudentSubjectAssignmentRequestSerializer,
    StudentSubjectAssignmentSerializer,
    StudentPromoteRequestSerializer,
    StudentPromotionHistorySerializer,
    StudentSerializer,
    StudentTransferHistorySerializer,
)


class TenantScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    model = None
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
        user = self.request.user
        qs = self.model.objects.all()
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        school = self.request.user.school
        if not school and getattr(self.request, "school", None):
            school = self.request.school
        if school:
            serializer.save(school=school)
            return
        # Superuser without school can provide school explicitly in payload
        serializer.save()

    def create(self, request, *args, **kwargs):
        try:
            return super().create(request, *args, **kwargs)
        except IntegrityError:
            raise ValidationError({"detail": "Duplicate value violates a uniqueness constraint."})

    def update(self, request, *args, **kwargs):
        try:
            return super().update(request, *args, **kwargs)
        except IntegrityError:
            raise ValidationError({"detail": "Duplicate value violates a uniqueness constraint."})

    def partial_update(self, request, *args, **kwargs):
        try:
            return super().partial_update(request, *args, **kwargs)
        except IntegrityError:
            raise ValidationError({"detail": "Duplicate value violates a uniqueness constraint."})


class StudentCategoryViewSet(TenantScopedModelViewSet):
    model = StudentCategory
    serializer_class = StudentCategorySerializer
    pagination_class = ApiPageNumberPagination
    permission_codes = {"*": "student_info.student_category.view"}

    def _build_validation_error_response(self, field_errors=None, message="Validation failed"):
        return Response(
            {
                "success": False,
                "error_code": "VALIDATION_ERROR",
                "message": message,
                "field_errors": field_errors or {},
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _normalize_field_errors(self, serializer_errors):
        normalized = {}
        for field, errors in serializer_errors.items():
            if isinstance(errors, (list, tuple)):
                normalized[field] = [str(error) for error in errors]
            else:
                normalized[field] = [str(errors)]
        return normalized

    def _first_error_message(self, field_errors):
        for errors in field_errors.values():
            if isinstance(errors, list) and errors:
                return str(errors[0])
        return "Validation failed"

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._build_validation_error_response(field_errors, self._first_error_message(field_errors))

        try:
            self.perform_create(serializer)
        except IntegrityError:
            return self._build_validation_error_response(
                {"name": ["Category name already exists."]},
                "Category name already exists.",
            )

        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                "success": True,
                "message": "Student category created successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            field_errors = self._normalize_field_errors(serializer.errors)
            return self._build_validation_error_response(field_errors, self._first_error_message(field_errors))

        try:
            self.perform_update(serializer)
        except IntegrityError:
            return self._build_validation_error_response(
                {"name": ["Category name already exists."]},
                "Category name already exists.",
            )

        return Response(
            {
                "success": True,
                "message": "Student category updated successfully.",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.students.exists():
            return self._build_validation_error_response(
                {},
                "Cannot delete category as it is assigned to students",
            )

        self.perform_destroy(instance)
        return Response(
            {
                "success": True,
                "message": "Student category deleted successfully.",
            },
            status=status.HTTP_200_OK,
        )


class StudentGroupViewSet(TenantScopedModelViewSet):
    model = StudentGroup
    serializer_class = StudentGroupSerializer
    pagination_class = ApiPageNumberPagination
    permission_codes = {"*": "student_info.student_group.view"}

    def get_queryset(self):
        user = self.request.user
        qs = StudentGroup.objects.all()
        if user.is_superuser:
            return qs.annotate(students_count=Count("students", distinct=True)).order_by("name")
        if user.school_id:
            return qs.filter(school_id=user.school_id).annotate(students_count=Count("students", distinct=True)).order_by("name")
        return qs.none()

    def destroy(self, request, *args, **kwargs):
        """
        Delete a student group.
        
        Returns 400 error if the group has assigned students.
        """
        instance = self.get_object()
        
        # Check if group has assigned students
        if instance.students.exists():
            return Response(
                {
                    "success": False,
                    "message": f"Cannot delete group with assigned students. This group has {instance.students.count()} students assigned.",
                    "field_errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )
        
        # Proceed with deletion
        self.perform_destroy(instance)
        
        return Response(
            {
                "success": True,
                "message": "Student group deleted successfully.",
            },
            status=status.HTTP_200_OK,
        )


class GuardianViewSet(TenantScopedModelViewSet):
    model = Guardian
    serializer_class = GuardianSerializer
    pagination_class = ApiPageNumberPagination
    permission_codes = {"*": "student_info.add_student.view"}


class StudentViewSet(TenantScopedModelViewSet):
    model = Student
    serializer_class = StudentSerializer
    pagination_class = ApiPageNumberPagination
    permission_codes = {
        "list": "student_info.student_list.view",
        "retrieve": "student_info.student_list.view",
        "create": "student_info.add_student.view",
        "update": "student_info.add_student.view",
        "partial_update": "student_info.add_student.view",
        "destroy": "student_info.delete_student_record.view",
        "soft_delete": "student_info.delete_student_record.view",
        "restore": "student_info.delete_student_record.view",
        "permanent_delete": "student_info.delete_student_record.view",
        "promote": "student_info.student_promote.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = Student.objects.select_related(
            "school",
            "academic_year",
            "category",
            "student_group",
            "guardian",
            "current_class",
            "current_section",
            "admission_inquiry",
        ).prefetch_related("documents")

        search = (self.request.query_params.get("search") or "").strip()
        class_id = self.request.query_params.get("class")
        section_id = self.request.query_params.get("section")
        academic_year_id = self.request.query_params.get("academic_year")
        include_deleted = (self.request.query_params.get("include_deleted") or "").strip().lower() in {"1", "true", "yes"}
        deleted_only = (self.request.query_params.get("deleted_only") or "").strip().lower() in {"1", "true", "yes"}

        if deleted_only:
            qs = qs.filter(is_deleted=True)
        elif not include_deleted:
            qs = qs.filter(is_deleted=False)

        if search and not re.fullmatch(r"[A-Za-z0-9 ]+", search):
            raise ValidationError({"search": "Please enter valid search text"})

        if class_id:
            qs = qs.filter(current_class_id=class_id)
        if section_id:
            qs = qs.filter(current_section_id=section_id)
        if academic_year_id:
            qs = qs.filter(academic_year_id=academic_year_id)
        if search:
            qs = qs.filter(
                Q(first_name__icontains=search)
                | Q(last_name__icontains=search)
                | Q(admission_no__icontains=search)
                | Q(roll_no__icontains=search)
            )

        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    def _field_alias(self, field):
        aliases = {
            "current_class": "class",
            "current_section": "section",
            "date_of_birth": "dob",
        }
        return aliases.get(field, field)

    def _normalize_field_errors(self, serializer_errors):
        normalized = {}
        for field, errors in serializer_errors.items():
            key = self._field_alias(str(field))
            if isinstance(errors, (list, tuple)):
                normalized[key] = str(errors[0]) if errors else "Validation failed"
            else:
                normalized[key] = str(errors)
        return normalized

    def _validation_response(self, serializer_errors=None, message="Validation failed"):
        return Response(
            {
                "success": False,
                "message": message,
                "field_errors": self._normalize_field_errors(serializer_errors or {}),
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _normalize_import_row(self, raw_row):
        key_aliases = {
            "admission no": "admission_no",
            "admission_no": "admission_no",
            "admission number": "admission_no",
            "admission_number": "admission_no",
            "roll no": "roll_no",
            "roll_no": "roll_no",
            "roll number": "roll_no",
            "roll_number": "roll_no",
            "first name": "first_name",
            "first_name": "first_name",
            "last name": "last_name",
            "last_name": "last_name",
            "dob": "date_of_birth",
            "date of birth": "date_of_birth",
            "date_of_birth": "date_of_birth",
            "academic year": "academic_year",
            "academic_year": "academic_year",
            "class": "current_class",
            "current class": "current_class",
            "current_class": "current_class",
            "section": "current_section",
            "current section": "current_section",
            "current_section": "current_section",
            "custom gender": "custom_gender",
            "custom_gender": "custom_gender",
            "blood group": "blood_group",
            "blood_group": "blood_group",
            "address": "address_line",
            "address line": "address_line",
            "address_line": "address_line",
            "pin": "pincode",
            "zip": "pincode",
            "postal code": "pincode",
            "postal_code": "pincode",
            "student category": "category",
            "student_category": "category",
        }

        cleaned = {}
        for key, value in (raw_row or {}).items():
            key_text = str(key or "").strip()
            if not key_text:
                continue
            normalized_key = key_aliases.get(key_text.lower(), key_text.replace(" ", "_").lower())

            value_text = "" if value is None else str(value).strip()
            if value_text == "":
                cleaned[normalized_key] = ""
                continue

            if normalized_key == "date_of_birth":
                parsed = None
                for fmt in ("%Y-%m-%d", "%d-%m-%Y", "%d/%m/%Y"):
                    try:
                        parsed = datetime.strptime(value_text, fmt).date().isoformat()
                        break
                    except ValueError:
                        continue
                cleaned[normalized_key] = parsed or value_text
                continue

            if normalized_key in {"academic_year", "current_class", "current_section", "category", "guardian"}:
                cleaned[normalized_key] = int(value_text) if value_text.isdigit() else value_text
                continue

            if normalized_key in {"is_active", "is_disabled"}:
                lowered = value_text.lower()
                if lowered in {"true", "1", "yes", "y"}:
                    cleaned[normalized_key] = True
                elif lowered in {"false", "0", "no", "n"}:
                    cleaned[normalized_key] = False
                else:
                    cleaned[normalized_key] = value_text
                continue

            cleaned[normalized_key] = value_text

        return cleaned

    def _duplicate_warning(self, validated_data):
        first_name = (validated_data.get("first_name") or "").strip()
        last_name = (validated_data.get("last_name") or "").strip()
        dob = validated_data.get("date_of_birth")
        phone = (validated_data.get("phone") or "").strip()
        if not (first_name and dob and phone):
            return None

        queryset = Student.objects.filter(
            school_id=self.request.user.school_id,
            first_name__iexact=first_name,
            last_name__iexact=last_name,
            date_of_birth=dob,
            phone=phone,
        )
        if queryset.exists():
            return "Possible duplicate found: same name, DOB and phone already exists"
        return None

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        if not serializer.is_valid():
            return self._validation_response(serializer.errors)

        warning = self._duplicate_warning(serializer.validated_data)

        try:
            self.perform_create(serializer)
        except IntegrityError:
            return self._validation_response({"admission_no": ["Admission number already exists"]})

        headers = self.get_success_headers(serializer.data)
        return Response(
            {
                "success": True,
                "message": "Student added successfully",
                "warning": warning,
                "data": serializer.data,
            },
            status=status.HTTP_201_CREATED,
            headers=headers,
        )

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop("partial", False)
        instance = self.get_object()
        serializer = self.get_serializer(instance, data=request.data, partial=partial)
        if not serializer.is_valid():
            return self._validation_response(serializer.errors)

        try:
            self.perform_update(serializer)
        except IntegrityError:
            return self._validation_response({"admission_no": ["Admission number already exists"]})

        return Response(
            {
                "success": True,
                "message": "Student updated successfully",
                "data": serializer.data,
            },
            status=status.HTTP_200_OK,
        )

    def partial_update(self, request, *args, **kwargs):
        kwargs["partial"] = True
        return self.update(request, *args, **kwargs)

    @action(detail=False, methods=["post"], url_path="promote")
    def promote(self, request):
        serializer = StudentPromoteRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        school_id = request.user.school_id
        if not school_id and not request.user.is_superuser:
            raise ValidationError("User school context is required.")

        target_class_id = data["to_class"]
        target_section_id = data.get("to_section")
        target_year_id = data.get("to_academic_year")

        from apps.core.models import AcademicYear, Class, Section

        # Validate target class/section/year belongs to same school for tenant safety
        class_qs = Class.objects.filter(id=target_class_id)
        if not request.user.is_superuser:
            class_qs = class_qs.filter(school_id=school_id)
        target_class = class_qs.first()
        if not target_class:
            raise ValidationError("Target class not found in your school.")

        if target_section_id:
            section_qs = Section.objects.filter(id=target_section_id, school_class_id=target_class_id)
            if not section_qs.exists():
                raise ValidationError("Target section not found under target class.")

        if target_year_id:
            year_qs = AcademicYear.objects.filter(id=target_year_id)
            if not request.user.is_superuser:
                year_qs = year_qs.filter(school_id=school_id)
            if not year_qs.exists():
                raise ValidationError("Target academic year not found in your school.")

        students_qs = Student.objects.filter(id__in=data["student_ids"])
        if not request.user.is_superuser:
            students_qs = students_qs.filter(school_id=school_id)
        students = list(students_qs)

        if not students:
            raise ValidationError("No students found for promotion.")

        # Track promoted count and errors for partial success
        promoted_count = 0
        failed_count = 0
        errors_list = []

        # Process each student individually to support partial success
        for st in students:
            try:
                # Validate: prevent promoting to same class
                if st.current_class_id == target_class_id:
                    failed_count += 1
                    errors_list.append({
                        "student_id": st.id,
                        "admission_no": st.admission_no,
                        "error": f"Cannot promote to the same class ({target_class.name})"
                    })
                    continue

                # Create promotion history
                StudentPromotionHistory.objects.create(
                    student=st,
                    from_class=st.current_class,
                    from_section=st.current_section,
                    to_class_id=target_class_id,
                    to_section_id=target_section_id,
                    to_academic_year_id=target_year_id,
                    note=data.get("note", ""),
                    promoted_by=request.user,
                )

                # Update student's current class and section
                st.current_class_id = target_class_id
                st.current_section_id = target_section_id
                st.save(update_fields=["current_class", "current_section", "updated_at"])
                promoted_count += 1

            except Exception as e:
                failed_count += 1
                errors_list.append({
                    "student_id": st.id,
                    "admission_no": st.admission_no,
                    "error": str(e)
                })
                continue

        # Return comprehensive response
        response_data = {
            "promoted": promoted_count,
            "failed": failed_count,
            "total": promoted_count + failed_count,
            "success": failed_count == 0
        }

        if errors_list:
            # Limit errors to first 50 for response
            response_data["errors"] = errors_list[:50]

        # Determine status code based on promotion success
        if promoted_count == 0:
            # Complete failure
            return Response(response_data, status=status.HTTP_400_BAD_REQUEST)
        elif failed_count > 0:
            # Partial success
            return Response(response_data, status=status.HTTP_200_OK)
        else:
            # Complete success
            return Response(response_data, status=status.HTTP_200_OK)

    def destroy(self, request, *args, **kwargs):
        return self.soft_delete(request, *args, **kwargs)

    def _linked_record_exists(self, student):
        from apps.attendance.models import StudentAttendance, SubjectAttendance
        from apps.exams.models import ExamAttendanceChild, ExamMark, ExamMarkRegister, OnlineExamTake
        from apps.fees.models import FeesAssignment, FeesPayment

        return (
            StudentAttendance.objects.filter(student=student).exists()
            or SubjectAttendance.objects.filter(student=student).exists()
            or ExamMark.objects.filter(student=student).exists()
            or ExamAttendanceChild.objects.filter(student=student).exists()
            or ExamMarkRegister.objects.filter(student=student).exists()
            or OnlineExamTake.objects.filter(student=student).exists()
            or FeesAssignment.objects.filter(student=student).exists()
            or FeesPayment.objects.filter(student=student).exists()
        )

    def _audit_log(self, *, action, student, request, note="", metadata=None):
        school = student.school or getattr(request.user, "school", None)
        if not school:
            return
        StudentRecordAudit.objects.create(
            school=school,
            student=student,
            action=action,
            performed_by=request.user,
            note=note,
            metadata=metadata or {},
        )

    @action(detail=True, methods=["post"], url_path="soft-delete")
    def soft_delete(self, request, *args, **kwargs):
        student = self.get_object()
        if student.is_deleted:
            return Response(
                {"success": False, "message": "Student record already deleted", "field_errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if self._linked_record_exists(student):
            return Response(
                {"success": False, "message": "Cannot delete student. Linked records exist", "field_errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student.is_deleted = True
        student.is_active = False
        student.is_disabled = True
        student.status = "deleted"
        student.deleted_at = timezone.now()
        student.deleted_by = request.user
        student.save(update_fields=["is_deleted", "is_active", "is_disabled", "status", "deleted_at", "deleted_by", "updated_at"])

        self._audit_log(
            action=StudentRecordAudit.ACTION_SOFT_DELETE,
            student=student,
            request=request,
            note="Student soft-deleted",
            metadata={"student_id": student.id, "admission_no": student.admission_no},
        )

        return Response({"success": True, "message": "Student deleted successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["post"], url_path="restore")
    def restore(self, request, *args, **kwargs):
        student = self.get_object()
        if not student.is_deleted:
            return Response(
                {"success": False, "message": "Student is not deleted", "field_errors": {}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        student.is_deleted = False
        student.is_disabled = False
        student.is_active = True
        student.status = "active"
        student.deleted_at = None
        student.deleted_by = None
        student.save(update_fields=["is_deleted", "is_disabled", "is_active", "status", "deleted_at", "deleted_by", "updated_at"])

        self._audit_log(
            action=StudentRecordAudit.ACTION_RESTORE,
            student=student,
            request=request,
            note="Student restored",
            metadata={"student_id": student.id, "admission_no": student.admission_no},
        )

        return Response({"success": True, "message": "Student restored successfully"}, status=status.HTTP_200_OK)

    @action(detail=True, methods=["delete"], url_path="permanent-delete")
    def permanent_delete(self, request, *args, **kwargs):
        if not request.user.is_superuser:
            return Response(
                {"success": False, "message": "You do not have permission to delete student records", "field_errors": {}},
                status=status.HTTP_403_FORBIDDEN,
            )

        student = self.get_object()
        if self._linked_record_exists(student):
            return Response(
                {
                    "success": False,
                    "message": "Unable to permanently delete student due to linked records",
                    "field_errors": {},
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        self._audit_log(
            action=StudentRecordAudit.ACTION_PERMANENT_DELETE,
            student=student,
            request=request,
            note="Student permanently deleted",
            metadata={"student_id": student.id, "admission_no": student.admission_no},
        )

        student.delete()
        return Response({"success": True, "message": "Student permanently deleted successfully"}, status=status.HTTP_200_OK)

    @action(detail=False, methods=["post"], url_path="bulk-import")
    def bulk_import(self, request):
        upload = request.FILES.get("file")
        if not upload:
            return self._validation_response({"file": ["Please upload a file"]})

        filename = (upload.name or "").lower()
        if not filename.endswith((".csv", ".xlsx")):
            return self._validation_response({"file": ["Only CSV or XLSX files are supported"]})

        rows = []
        if filename.endswith(".csv"):
            decoded = upload.read().decode("utf-8", errors="ignore")
            reader = csv.DictReader(io.StringIO(decoded))
            rows = list(reader)
        else:
            try:
                from openpyxl import load_workbook
            except Exception:
                return self._validation_response({"file": ["XLSX import requires openpyxl installation"]})
            workbook = load_workbook(upload, read_only=True)
            worksheet = workbook.active
            header = [str(cell.value or "").strip() for cell in next(worksheet.iter_rows(min_row=1, max_row=1))]
            for data_row in worksheet.iter_rows(min_row=2, values_only=True):
                rows.append({header[index]: value for index, value in enumerate(data_row)})

        created = 0
        errors = []
        for index, row in enumerate(rows, start=2):
            normalized_row = self._normalize_import_row(row)
            if not any(str(value or "").strip() for value in normalized_row.values()):
                continue

            serializer = self.get_serializer(data=normalized_row)
            if serializer.is_valid():
                try:
                    self.perform_create(serializer)
                    created += 1
                except IntegrityError:
                    errors.append({"row": index, "field_errors": {"admission_no": "Admission number already exists"}})
            else:
                errors.append({"row": index, "field_errors": self._normalize_field_errors(serializer.errors)})

        return Response(
            {
                "success": len(errors) == 0,
                "message": "Bulk import completed",
                "created": created,
                "failed": len(errors),
                "errors": errors,
            },
            status=status.HTTP_200_OK,
        )


class StudentDocumentViewSet(TenantScopedModelViewSet):
    serializer_class = StudentDocumentSerializer
    model = StudentDocument
    permission_codes = {"*": "student_info.student_list.view"}

    def get_queryset(self):
        user = self.request.user
        qs = StudentDocument.objects.select_related("student__school")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()


class StudentTransferHistoryViewSet(TenantScopedModelViewSet):
    serializer_class = StudentTransferHistorySerializer
    model = StudentTransferHistory
    permission_codes = {"*": "student_info.delete_student_record.view"}

    def get_queryset(self):
        user = self.request.user
        qs = StudentTransferHistory.objects.select_related("student__school", "from_school", "to_school")
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()


class StudentPromotionHistoryViewSet(TenantScopedModelViewSet):
    serializer_class = StudentPromotionHistorySerializer
    model = StudentPromotionHistory
    permission_codes = {"*": "student_info.student_promote.view"}

    def get_queryset(self):
        user = self.request.user
        qs = StudentPromotionHistory.objects.select_related(
            "student__school",
            "from_class",
            "from_section",
            "to_class",
            "to_section",
            "from_academic_year",
            "to_academic_year",
            "promoted_by",
        )
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()


class StudentMultiClassRecordViewSet(TenantScopedModelViewSet):
    serializer_class = StudentMultiClassRecordSerializer
    model = StudentMultiClassRecord
    permission_codes = {
        "*": "student_info.multi_class_student.view",
        "bulk_save": "student_info.multi_class_student.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = StudentMultiClassRecord.objects.select_related("student", "school_class", "section", "student__school")

        student_id = self.request.query_params.get("student")
        if student_id:
            qs = qs.filter(student_id=student_id)

        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()

    def perform_create(self, serializer):
        record = serializer.save()
        if record.is_default:
            StudentMultiClassRecord.objects.filter(student_id=record.student_id).exclude(id=record.id).update(is_default=False)
            Student.objects.filter(id=record.student_id).update(
                current_class_id=record.school_class_id,
                current_section_id=record.section_id,
            )

    def perform_update(self, serializer):
        record = serializer.save()
        if record.is_default:
            StudentMultiClassRecord.objects.filter(student_id=record.student_id).exclude(id=record.id).update(is_default=False)
            Student.objects.filter(id=record.student_id).update(
                current_class_id=record.school_class_id,
                current_section_id=record.section_id,
            )

    @action(detail=False, methods=["post"], url_path="bulk-save")
    def bulk_save(self, request):
        serializer = StudentMultiClassBulkSaveSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data

        student_id = data["student_id"]
        user = request.user
        student_qs = Student.objects.filter(id=student_id)
        if not user.is_superuser:
            student_qs = student_qs.filter(school_id=user.school_id)
        student = student_qs.first()
        if not student:
            raise ValidationError("Student not found in your school.")

        records = data.get("records", [])
        default_seen = False

        with transaction.atomic():
            StudentMultiClassRecord.objects.filter(student=student).delete()
            created = []

            for item in records:
                school_class_id = item["school_class"]
                section_id = item.get("section")
                is_default = bool(item.get("is_default", False))
                if is_default:
                    if default_seen:
                        is_default = False
                    default_seen = True

                from apps.core.models import Class, Section

                class_qs = Class.objects.filter(id=school_class_id)
                if not user.is_superuser:
                    class_qs = class_qs.filter(school_id=student.school_id)
                if not class_qs.exists():
                    raise ValidationError("One or more classes are invalid for this student school.")

                if section_id:
                    section_qs = Section.objects.filter(id=section_id, school_class_id=school_class_id)
                    if not section_qs.exists():
                        raise ValidationError("One or more sections do not belong to selected class.")

                created.append(
                    StudentMultiClassRecord.objects.create(
                        student=student,
                        school_class_id=school_class_id,
                        section_id=section_id,
                        roll_no=item.get("roll_no", ""),
                        is_default=is_default,
                    )
                )

            default_record = next((item for item in created if item.is_default), None)
            if not default_record and created:
                default_record = created[0]
                default_record.is_default = True
                default_record.save(update_fields=["is_default", "updated_at"])

            if default_record:
                student.current_class_id = default_record.school_class_id
                student.current_section_id = default_record.section_id
                student.save(update_fields=["current_class", "current_section", "updated_at"])

        response_data = StudentMultiClassRecordSerializer(
            StudentMultiClassRecord.objects.filter(student=student).order_by("-is_default", "id"),
            many=True,
        ).data
        return Response({"student_id": student.id, "records": response_data}, status=status.HTTP_200_OK)


class StudentSubjectAssignmentViewSet(TenantScopedModelViewSet):
    serializer_class = StudentSubjectAssignmentSerializer
    model = StudentSubjectAssignment
    permission_codes = {
        "*": "student_info.multi_class_student.view",
        "assign_individual": "student_info.multi_class_student.view",
        "assign_bulk": "student_info.multi_class_student.view",
    }

    def get_queryset(self):
        user = self.request.user
        qs = StudentSubjectAssignment.objects.select_related(
            "student",
            "subject",
            "academic_year",
            "school_class",
            "section",
            "assigned_by",
        )
        student_id = self.request.query_params.get("student_id")
        if student_id:
            qs = qs.filter(student_id=student_id)
        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(student__school_id=user.school_id)
        return qs.none()

    def _validation_response(self, field_errors=None, message="Validation failed"):
        normalized = {}
        for key, value in (field_errors or {}).items():
            if isinstance(value, (list, tuple)):
                normalized[key] = str(value[0]) if value else "Validation failed"
            else:
                normalized[key] = str(value)
        return Response(
            {
                "success": False,
                "message": message,
                "field_errors": normalized,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    def _resolve_students(self, *, student_ids, class_id, section_id, user):
        queryset = Student.objects.filter(id__in=student_ids, current_class_id=class_id, current_section_id=section_id)
        if not user.is_superuser:
            queryset = queryset.filter(school_id=user.school_id)
        return list(queryset)

    def _create_assignments(self, *, students, subject_ids, academic_year_id, class_id, section_id, is_optional, user):
        existing = StudentSubjectAssignment.objects.filter(
            student_id__in=[row.id for row in students],
            subject_id__in=subject_ids,
            academic_year_id=academic_year_id,
        )
        if existing.exists():
            return self._validation_response({"subject_ids": "Subject already assigned to this student"})

        payload = [
            StudentSubjectAssignment(
                student_id=student.id,
                subject_id=subject_id,
                academic_year_id=academic_year_id,
                school_class_id=class_id,
                section_id=section_id,
                is_optional=is_optional,
                assigned_by=user,
            )
            for student in students
            for subject_id in subject_ids
        ]
        StudentSubjectAssignment.objects.bulk_create(payload)
        return None

    @action(detail=False, methods=["post"], url_path="assign-individual")
    def assign_individual(self, request):
        serializer = StudentSubjectAssignmentRequestSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return self._validation_response(serializer.errors)

        data = serializer.validated_data
        student_id = request.data.get("student_id")
        if not student_id:
            return self._validation_response({"student_id": "Please select a student"})

        students = self._resolve_students(
            student_ids=[int(student_id)],
            class_id=data["school_class"],
            section_id=data["section"],
            user=request.user,
        )
        if not students:
            return self._validation_response({"student_id": "Unable to load students. Please try again"})

        with transaction.atomic():
            error = self._create_assignments(
                students=students,
                subject_ids=data["subject_ids"],
                academic_year_id=data["academic_year"],
                class_id=data["school_class"],
                section_id=data["section"],
                is_optional=data.get("is_optional", False),
                user=request.user,
            )
            if error:
                return error

        return Response({"success": True, "message": "Subjects assigned successfully"}, status=status.HTTP_200_OK)


class StudentRecordAuditViewSet(TenantScopedModelViewSet):
    serializer_class = StudentRecordAuditSerializer
    model = StudentRecordAudit
    permission_codes = {"*": "student_info.delete_student_record.view"}
    http_method_names = ["get", "head", "options"]

    def get_queryset(self):
        user = self.request.user
        qs = StudentRecordAudit.objects.select_related("student", "performed_by", "school", "student__current_class", "student__current_section")

        student_id = self.request.query_params.get("student_id")
        action = (self.request.query_params.get("action") or "").strip()
        search = (self.request.query_params.get("search") or "").strip()
        class_id = self.request.query_params.get("class")
        section_id = self.request.query_params.get("section")

        if student_id:
            qs = qs.filter(student_id=student_id)
        if action:
            qs = qs.filter(action=action)
        if class_id:
            qs = qs.filter(student__current_class_id=class_id)
        if section_id:
            qs = qs.filter(student__current_section_id=section_id)
        if search:
            qs = qs.filter(
                Q(student__first_name__icontains=search)
                | Q(student__last_name__icontains=search)
                | Q(student__admission_no__icontains=search)
                | Q(note__icontains=search)
            )

        if user.is_superuser:
            return qs
        if user.school_id:
            return qs.filter(school_id=user.school_id)
        return qs.none()

    @action(detail=False, methods=["post"], url_path="assign-bulk")
    def assign_bulk(self, request):
        serializer = StudentSubjectAssignmentRequestSerializer(data=request.data, context={"request": request})
        if not serializer.is_valid():
            return self._validation_response(serializer.errors)

        data = serializer.validated_data
        student_ids = data.get("student_ids") or request.data.get("student_ids") or []

        if student_ids:
            students = self._resolve_students(
                student_ids=student_ids,
                class_id=data["school_class"],
                section_id=data["section"],
                user=request.user,
            )
        else:
            students_qs = Student.objects.filter(current_class_id=data["school_class"], current_section_id=data["section"])
            if not request.user.is_superuser:
                students_qs = students_qs.filter(school_id=request.user.school_id)
            students = list(students_qs)

        if not students:
            return self._validation_response({"students": "Unable to load students. Please try again"})

        with transaction.atomic():
            error = self._create_assignments(
                students=students,
                subject_ids=data["subject_ids"],
                academic_year_id=data["academic_year"],
                class_id=data["school_class"],
                section_id=data["section"],
                is_optional=data.get("is_optional", False),
                user=request.user,
            )
            if error:
                return error

        return Response({"success": True, "message": "Subjects assigned successfully"}, status=status.HTTP_200_OK)
