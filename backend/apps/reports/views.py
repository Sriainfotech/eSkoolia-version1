from decimal import Decimal
import hashlib
import json

from django.core.cache import cache
from django.core.paginator import EmptyPage, Paginator
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from .export_utils import build_export_response
from .serializers import (
    AcademicClassPerformanceFilterSerializer,
    AcademicClassPerformanceRowSerializer,
    AccountsExpenseFilterSerializer,
    AccountsExpenseRowSerializer,
    AccountsFeeCollectionFilterSerializer,
    AccountsFeeCollectionRowSerializer,
    BehaviourIncidentFilterSerializer,
    BehaviourIncidentRowSerializer,
    ExamMarksFilterSerializer,
    ExamMarksRowSerializer,
    ExamResultSummaryFilterSerializer,
    ExamResultSummaryRowSerializer,
    HrStaffAttendanceFilterSerializer,
    HrStaffAttendanceRowSerializer,
    InventoryStockFilterSerializer,
    InventoryStockRowSerializer,
    LibraryIssueReturnFilterSerializer,
    LibraryIssueReturnRowSerializer,
    StudentAttendanceFilterSerializer,
    StudentAttendanceRowSerializer,
    StudentListFilterSerializer,
    StudentListRowSerializer,
    TransportStudentFilterSerializer,
    TransportStudentRowSerializer,
)
from .services import ReportQueryService


def _safe_decimal(value, default: str = "0.00") -> Decimal:
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    return Decimal(str(value))


def _full_name(first_name: str | None, last_name: str | None) -> str:
    return f"{first_name or ''} {last_name or ''}".strip()


class BaseReportAPIView(APIView):
    permission_classes = [IsAuthenticated]
    filter_serializer_class = None
    row_serializer_class = None
    service_method = ""
    export_filename = "report"
    export_title = "Report"
    export_columns = ()
    cache_timeout_seconds = 120

    def get_school_id(self, request):
        if request.user.is_superuser and "school_id" in request.query_params:
            return int(request.query_params["school_id"])
        if request.user.school_id:
            return request.user.school_id
        school = getattr(request, "school", None)
        if school:
            return school.id
        return None

    def map_row(self, item):
        raise NotImplementedError

    def get_queryset(self, school_id, filters):
        service = getattr(ReportQueryService, self.service_method)
        return service(school_id, filters)

    def _build_cache_key(self, request, school_id, filters):
        payload = {
            "path": request.path,
            "query": request.query_params.dict(),
            "school_id": school_id,
            "user_id": request.user.id,
            "filters": filters,
            "service": self.service_method,
        }
        encoded = json.dumps(payload, sort_keys=True, default=str)
        digest = hashlib.sha256(encoded.encode("utf-8")).hexdigest()
        return f"reports:v1:{self.service_method}:{digest}"

    def get(self, request, *args, **kwargs):
        school_id = self.get_school_id(request)
        if not school_id:
            return Response({"detail": "School context is required."}, status=status.HTTP_400_BAD_REQUEST)

        filter_serializer = self.filter_serializer_class(data=request.query_params)
        filter_serializer.is_valid(raise_exception=True)
        filters = filter_serializer.validated_data

        export_format = filters.get("export")
        cache_key = None
        if not export_format:
            cache_key = self._build_cache_key(request, school_id, filters)
            cached_payload = cache.get(cache_key)
            if cached_payload is not None:
                return Response(cached_payload, status=status.HTTP_200_OK)

        queryset = self.get_queryset(school_id, filters)

        if export_format:
            rows = [self.map_row(item) for item in queryset]
            data = self.row_serializer_class(rows, many=True).data
            return build_export_response(
                export_format=export_format,
                rows=data,
                columns=self.export_columns,
                filename=self.export_filename,
                title=self.export_title,
            )

        page = filters.get("page", 1)
        page_size = filters.get("page_size", 20)
        paginator = Paginator(queryset, page_size)
        try:
            current_page = paginator.page(page)
        except EmptyPage:
            current_page = []

        rows = [self.map_row(item) for item in current_page]
        serialized_rows = self.row_serializer_class(rows, many=True)

        payload = {
            "count": paginator.count,
            "page": page,
            "page_size": page_size,
            "total_pages": paginator.num_pages,
            "results": serialized_rows.data,
        }

        if cache_key:
            cache.set(cache_key, payload, self.cache_timeout_seconds)

        return Response(
            payload,
            status=status.HTTP_200_OK,
        )


class AccountsFeeCollectionReportView(BaseReportAPIView):
    filter_serializer_class = AccountsFeeCollectionFilterSerializer
    row_serializer_class = AccountsFeeCollectionRowSerializer
    service_method = "accounts_fee_collection"
    export_filename = "accounts_fee_collection_report"
    export_title = "Accounts Fee Collection Report"
    export_columns = (
        ("Payment ID", "payment_id"),
        ("Paid At", "paid_at"),
        ("Admission No", "admission_no"),
        ("Student", "student_name"),
        ("Class", "class_name"),
        ("Section", "section_name"),
        ("Fees Type", "fees_type"),
        ("Amount Paid", "amount_paid"),
        ("Method", "method"),
        ("Status", "assignment_status"),
        ("Reference", "transaction_reference"),
    )

    def map_row(self, item):
        return {
            "payment_id": item.id,
            "paid_at": item.paid_at,
            "admission_no": item.student.admission_no if item.student else "",
            "student_name": _full_name(getattr(item.student, "first_name", ""), getattr(item.student, "last_name", "")),
            "class_name": getattr(getattr(item.student, "current_class", None), "name", ""),
            "section_name": getattr(getattr(item.student, "current_section", None), "name", ""),
            "fees_type": getattr(getattr(item.assignment, "fees_type", None), "name", ""),
            "amount_paid": _safe_decimal(item.amount_paid),
            "method": item.method or "",
            "assignment_status": getattr(item.assignment, "status", "") or "",
            "transaction_reference": item.transaction_reference or "",
        }


class AccountsExpenseReportView(BaseReportAPIView):
    filter_serializer_class = AccountsExpenseFilterSerializer
    row_serializer_class = AccountsExpenseRowSerializer
    service_method = "accounts_expense"
    export_filename = "accounts_expense_report"
    export_title = "Accounts Expense Report"
    export_columns = (
        ("Ledger ID", "ledger_id"),
        ("Entry Date", "entry_date"),
        ("Account Code", "account_code"),
        ("Account Name", "account_name"),
        ("Amount", "amount"),
        ("Reference No", "reference_no"),
        ("Description", "description"),
        ("Created By", "created_by"),
    )

    def map_row(self, item):
        created_by = ""
        if item.created_by:
            created_by = item.created_by.get_full_name() or item.created_by.username
        return {
            "ledger_id": item.id,
            "entry_date": item.entry_date,
            "account_code": getattr(item.account, "code", "") if item.account else "",
            "account_name": getattr(item.account, "name", "") if item.account else "",
            "amount": _safe_decimal(item.amount),
            "reference_no": item.reference_no or "",
            "description": item.description or "",
            "created_by": created_by,
        }


class StudentListReportView(BaseReportAPIView):
    filter_serializer_class = StudentListFilterSerializer
    row_serializer_class = StudentListRowSerializer
    service_method = "student_list"
    export_filename = "student_list_report"
    export_title = "Student List Report"
    export_columns = (
        ("Student ID", "student_id"),
        ("Admission No", "admission_no"),
        ("Roll No", "roll_no"),
        ("Student", "student_name"),
        ("Class", "class_name"),
        ("Section", "section_name"),
        ("Guardian", "guardian_name"),
        ("Phone", "phone"),
        ("Gender", "gender"),
        ("Disabled", "is_disabled"),
    )

    def map_row(self, item):
        guardian_phone = ""
        if item.guardian:
            guardian_phone = getattr(item.guardian, "phone", "") or ""

        return {
            "student_id": item.id,
            "admission_no": item.admission_no or "",
            "roll_no": item.roll_no or "",
            "student_name": _full_name(item.first_name, item.last_name),
            "class_name": getattr(item.current_class, "name", "") if item.current_class else "",
            "section_name": getattr(item.current_section, "name", "") if item.current_section else "",
            "guardian_name": _full_name(
                getattr(item.guardian, "first_name", "") if item.guardian else "",
                getattr(item.guardian, "last_name", "") if item.guardian else "",
            ),
            "phone": guardian_phone,
            "gender": item.gender or "",
            "is_disabled": item.is_disabled,
        }


class StudentAttendanceReportView(BaseReportAPIView):
    filter_serializer_class = StudentAttendanceFilterSerializer
    row_serializer_class = StudentAttendanceRowSerializer
    service_method = "student_attendance"
    export_filename = "student_attendance_report"
    export_title = "Student Attendance Report"
    export_columns = (
        ("Attendance ID", "attendance_id"),
        ("Date", "attendance_date"),
        ("Type", "attendance_type"),
        ("Admission No", "admission_no"),
        ("Student", "student_name"),
        ("Class", "class_name"),
        ("Section", "section_name"),
        ("Notes", "notes"),
    )

    def map_row(self, item):
        return {
            "attendance_id": item.id,
            "attendance_date": item.attendance_date,
            "attendance_type": item.attendance_type or "",
            "admission_no": item.student.admission_no if item.student else "",
            "student_name": _full_name(
                getattr(item.student, "first_name", "") if item.student else "",
                getattr(item.student, "last_name", "") if item.student else "",
            ),
            "class_name": getattr(getattr(item.student, "current_class", None), "name", ""),
            "section_name": getattr(getattr(item.student, "current_section", None), "name", ""),
            "notes": item.note or "",
        }


class ExamMarksReportView(BaseReportAPIView):
    filter_serializer_class = ExamMarksFilterSerializer
    row_serializer_class = ExamMarksRowSerializer
    service_method = "exam_marks"
    export_filename = "exam_marks_report"
    export_title = "Exam Marks Report"
    export_columns = (
        ("Register ID", "register_id"),
        ("Exam Term", "exam_term"),
        ("Class", "class_name"),
        ("Section", "section_name"),
        ("Subject", "subject_name"),
        ("Admission No", "admission_no"),
        ("Student", "student_name"),
        ("Total Marks", "total_marks"),
        ("GPA", "gpa"),
        ("Grade", "grade"),
        ("Absent", "is_absent"),
    )

    def map_row(self, item):
        return {
            "register_id": item.id,
            "exam_term": getattr(item.exam_term, "title", "") if item.exam_term else "",
            "class_name": getattr(item.school_class, "name", "") if item.school_class else "",
            "section_name": getattr(item.section, "name", "") if item.section else "",
            "subject_name": getattr(item.subject, "name", "") if item.subject else "",
            "admission_no": item.student.admission_no if item.student else "",
            "student_name": _full_name(
                getattr(item.student, "first_name", "") if item.student else "",
                getattr(item.student, "last_name", "") if item.student else "",
            ),
            "total_marks": _safe_decimal(getattr(item, "total_marks", None)),
            "gpa": _safe_decimal(getattr(item, "total_gpa_point", None), default="0.00"),
            "grade": getattr(item, "total_grade", "") or "",
            "is_absent": bool(getattr(item, "is_absent", False)),
        }


class ExamResultSummaryReportView(BaseReportAPIView):
    filter_serializer_class = ExamResultSummaryFilterSerializer
    row_serializer_class = ExamResultSummaryRowSerializer
    service_method = "exam_result_summary"
    export_filename = "exam_result_summary_report"
    export_title = "Exam Result Summary Report"
    export_columns = (
        ("Exam Term", "exam_term"),
        ("Class", "class_name"),
        ("Section", "section_name"),
        ("Total Students", "total_students"),
        ("Present", "present_students"),
        ("Absent", "absent_students"),
        ("Pass", "pass_students"),
        ("Fail", "fail_students"),
        ("Average Marks", "avg_marks"),
        ("Average GPA", "avg_gpa"),
    )

    def map_row(self, item):
        total_students = item.get("total_students", 0) or 0
        absent_students = item.get("absent_students", 0) or 0
        return {
            "exam_term": item.get("exam_term_name", "") or "",
            "class_name": item.get("class_name", "") or "",
            "section_name": item.get("section_name", "") or "",
            "total_students": total_students,
            "present_students": max(total_students - absent_students, 0),
            "absent_students": absent_students,
            "pass_students": item.get("pass_students", 0) or 0,
            "fail_students": item.get("fail_students", 0) or 0,
            "avg_marks": _safe_decimal(item.get("avg_marks")),
            "avg_gpa": _safe_decimal(item.get("avg_gpa"), default="0.00"),
        }


class LibraryIssueReturnReportView(BaseReportAPIView):
    filter_serializer_class = LibraryIssueReturnFilterSerializer
    row_serializer_class = LibraryIssueReturnRowSerializer
    service_method = "library_issue_return"
    export_filename = "library_issue_return_report"
    export_title = "Library Issue Return Report"
    export_columns = (
        ("Issue ID", "issue_id"),
        ("Issue Date", "issue_date"),
        ("Due Date", "due_date"),
        ("Return Date", "return_date"),
        ("Status", "status"),
        ("Book", "book_title"),
        ("Member Type", "member_type"),
        ("Member", "member_name"),
        ("Fine", "fine_amount"),
    )

    def map_row(self, item):
        member_type = getattr(item.member, "member_type", "") if item.member else ""
        member_name = ""
        if item.member:
            if item.member.student:
                member_name = _full_name(item.member.student.first_name, item.member.student.last_name)
            elif item.member.staff:
                member_name = _full_name(item.member.staff.first_name, item.member.staff.last_name)

        return {
            "issue_id": item.id,
            "issue_date": item.issue_date,
            "due_date": item.due_date,
            "return_date": item.return_date,
            "status": item.status or "",
            "book_title": getattr(item.book, "title", "") if item.book else "",
            "member_type": member_type,
            "member_name": member_name,
            "fine_amount": _safe_decimal(item.fine_amount),
        }


class AcademicClassPerformanceReportView(BaseReportAPIView):
    filter_serializer_class = AcademicClassPerformanceFilterSerializer
    row_serializer_class = AcademicClassPerformanceRowSerializer
    service_method = "academic_class_performance"
    export_filename = "academic_class_performance_report"
    export_title = "Academic Class Performance Report"
    export_columns = (
        ("Class", "class_name"),
        ("Section", "section_name"),
        ("Subject", "subject_name"),
        ("Students", "students_count"),
        ("Average Marks", "avg_marks"),
        ("Average GPA", "avg_gpa"),
    )

    def map_row(self, item):
        return {
            "class_name": item.get("class_name", "") or "",
            "section_name": item.get("section_name", "") or "",
            "subject_name": item.get("subject_name", "") or "",
            "students_count": item.get("students_count", 0) or 0,
            "avg_marks": _safe_decimal(item.get("avg_marks")),
            "avg_gpa": _safe_decimal(item.get("avg_gpa"), default="0.00"),
        }


class HrStaffAttendanceReportView(BaseReportAPIView):
    filter_serializer_class = HrStaffAttendanceFilterSerializer
    row_serializer_class = HrStaffAttendanceRowSerializer
    service_method = "hr_staff_attendance"
    export_filename = "hr_staff_attendance_report"
    export_title = "HR Staff Attendance Report"
    export_columns = (
        ("Attendance ID", "attendance_id"),
        ("Date", "attendance_date"),
        ("Type", "attendance_type"),
        ("Staff No", "staff_no"),
        ("Staff", "staff_name"),
        ("Department", "department"),
        ("Designation", "designation"),
        ("Note", "note"),
    )

    def map_row(self, item):
        return {
            "attendance_id": item.id,
            "attendance_date": item.attendance_date,
            "attendance_type": item.attendance_type or "",
            "staff_no": getattr(item.staff, "staff_no", "") if item.staff else "",
            "staff_name": _full_name(
                getattr(item.staff, "first_name", "") if item.staff else "",
                getattr(item.staff, "last_name", "") if item.staff else "",
            ),
            "department": getattr(getattr(item.staff, "department", None), "name", ""),
            "designation": getattr(getattr(item.staff, "designation", None), "title", ""),
            "note": item.note or "",
        }


class TransportStudentReportView(BaseReportAPIView):
    filter_serializer_class = TransportStudentFilterSerializer
    row_serializer_class = TransportStudentRowSerializer
    service_method = "transport_student"
    export_filename = "transport_student_report"
    export_title = "Transport Student Report"
    export_columns = (
        ("Student ID", "student_id"),
        ("Admission No", "admission_no"),
        ("Student", "student_name"),
        ("Class", "class_name"),
        ("Section", "section_name"),
        ("Route", "route_name"),
        ("Fare", "fare"),
        ("Vehicle No", "vehicle_no"),
        ("Vehicle Model", "vehicle_model"),
    )

    def map_row(self, item):
        return {
            "student_id": item.id,
            "admission_no": item.admission_no or "",
            "student_name": _full_name(item.first_name, item.last_name),
            "class_name": getattr(item.current_class, "name", "") if item.current_class else "",
            "section_name": getattr(item.current_section, "name", "") if item.current_section else "",
            "route_name": getattr(item.transport_route, "title", "") if item.transport_route else "",
            "fare": _safe_decimal(getattr(item.transport_route, "fare", None)) if item.transport_route else None,
            "vehicle_no": getattr(item.vehicle, "number", "") if item.vehicle else "",
            "vehicle_model": getattr(item.vehicle, "model", "") if item.vehicle else "",
        }


class InventoryStockReportView(BaseReportAPIView):
    filter_serializer_class = InventoryStockFilterSerializer
    row_serializer_class = InventoryStockRowSerializer
    service_method = "inventory_stock"
    export_filename = "inventory_stock_report"
    export_title = "Inventory Stock Report"
    export_columns = (
        ("Item ID", "item_id"),
        ("Item Code", "item_code"),
        ("Item", "item_name"),
        ("Category", "category"),
        ("Supplier", "supplier"),
        ("Quantity", "quantity"),
        ("Reorder Level", "reorder_level"),
        ("Stock Status", "stock_status"),
        ("Unit Cost", "unit_cost"),
        ("Unit Price", "unit_price"),
    )

    def map_row(self, item):
        quantity = _safe_decimal(item.quantity)
        reorder_level = _safe_decimal(item.reorder_level)
        return {
            "item_id": item.id,
            "item_code": item.item_code or "",
            "item_name": item.name or "",
            "category": getattr(item.category, "name", "") if item.category else "",
            "supplier": getattr(item.supplier, "name", "") if item.supplier else "",
            "quantity": quantity,
            "reorder_level": reorder_level,
            "stock_status": "Low" if quantity <= reorder_level else "Available",
            "unit_cost": _safe_decimal(item.unit_cost),
            "unit_price": _safe_decimal(item.unit_price),
        }


class BehaviourIncidentsReportView(BaseReportAPIView):
    filter_serializer_class = BehaviourIncidentFilterSerializer
    row_serializer_class = BehaviourIncidentRowSerializer
    service_method = "behaviour_incidents"
    export_filename = "behaviour_incidents_report"
    export_title = "Behaviour Incidents Report"
    export_columns = (
        ("Assignment ID", "assignment_id"),
        ("Assigned At", "assigned_at"),
        ("Incident", "incident"),
        ("Point", "point"),
        ("Admission No", "admission_no"),
        ("Student", "student_name"),
        ("Class", "class_name"),
        ("Section", "section_name"),
        ("Assigned By", "assigned_by"),
    )

    def map_row(self, item):
        assigned_by = ""
        if item.assigned_by:
            assigned_by = item.assigned_by.get_full_name() or item.assigned_by.username

        class_name = ""
        section_name = ""
        if item.student:
            class_name = getattr(item.student.current_class, "name", "") if item.student.current_class else ""
            section_name = getattr(item.student.current_section, "name", "") if item.student.current_section else ""
        if not class_name and item.record:
            class_name = getattr(item.record.school_class, "name", "") if item.record.school_class else ""
        if not section_name and item.record:
            section_name = getattr(item.record.section, "name", "") if item.record.section else ""

        return {
            "assignment_id": item.id,
            "assigned_at": item.created_at,
            "incident": getattr(item.incident, "title", "") if item.incident else "",
            "point": getattr(item.incident, "point", 0) if item.incident else 0,
            "admission_no": getattr(item.student, "admission_no", "") if item.student else "",
            "student_name": _full_name(
                getattr(item.student, "first_name", "") if item.student else "",
                getattr(item.student, "last_name", "") if item.student else "",
            ),
            "class_name": class_name,
            "section_name": section_name,
            "assigned_by": assigned_by,
        }


class GuardianReportView(StudentListReportView):
    service_method = "guardian_report"
    export_filename = "guardian_report"
    export_title = "Guardian Report"


class BalanceFeesReportView(AccountsFeeCollectionReportView):
    export_filename = "balance_fees_report"
    export_title = "Balance Fees Report"


class CollectionReportView(AccountsFeeCollectionReportView):
    export_filename = "collection_report"
    export_title = "Collection Report"


class StudentFineReportView(AccountsFeeCollectionReportView):
    export_filename = "student_fine_report"
    export_title = "Student Fine Report"


class ClassReportView(AcademicClassPerformanceReportView):
    export_filename = "class_report"
    export_title = "Class Report"


class ClassRoutineReportView(AcademicClassPerformanceReportView):
    export_filename = "class_routine_report"
    export_title = "Class Routine Report"


class ExamRoutineReportView(ExamResultSummaryReportView):
    export_filename = "exam_routine_report"
    export_title = "Exam Routine Report"


class TeacherClassRoutineReportView(ExamResultSummaryReportView):
    export_filename = "teacher_class_routine_report"
    export_title = "Teacher Class Routine Report"


class MeritListReportView(ExamMarksReportView):
    export_filename = "merit_list_report"
    export_title = "Merit List Report"


class OnlineExamReportView(ExamResultSummaryReportView):
    export_filename = "online_exam_report"
    export_title = "Online Exam Report"


class MarkSheetReportStudentView(ExamMarksReportView):
    export_filename = "mark_sheet_report_student"
    export_title = "Mark Sheet Report Student"


class TabulationSheetReportView(ExamResultSummaryReportView):
    export_filename = "tabulation_sheet_report"
    export_title = "Tabulation Sheet Report"


class ProgressCardReportView(ExamMarksReportView):
    export_filename = "progress_card_report"
    export_title = "Progress Card Report"


class PayrollReportView(HrStaffAttendanceReportView):
    export_filename = "payroll_report"
    export_title = "Payroll Report"


class StudentDormitoryReportView(StudentListReportView):
    service_method = "student_dormitory"
    export_filename = "student_dormitory_report"
    export_title = "Student Dormitory Report"


class StudentTransportReportView(TransportStudentReportView):
    export_filename = "student_transport_report"
    export_title = "Student Transport Report"


# Legacy aliases to preserve existing frontend routes while migration is in progress.
class StudentReportView(StudentListReportView):
    pass


class ExamReportView(ExamMarksReportView):
    pass


class StaffReportView(HrStaffAttendanceReportView):
    pass


class FeesReportView(AccountsFeeCollectionReportView):
    pass


class AccountsReportView(AccountsExpenseReportView):
    pass
