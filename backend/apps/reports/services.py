from __future__ import annotations

from datetime import date

from django.db.models import Avg, Count, F, Q

from apps.attendance.models import StudentAttendance
from apps.behaviour.models import AssignedIncident
from apps.core.models import Item
from apps.exams.models import ExamMarkRegister
from apps.fees.models import FeesPayment
from apps.finance.models import LedgerEntry
from apps.hr.models import StaffAttendance
from apps.library.models import BookIssue
from apps.students.models import Student


class ReportQueryService:
    @staticmethod
    def _apply_date_range(queryset, field_name: str, start_date: date | None, end_date: date | None):
        if start_date:
            queryset = queryset.filter(**{f"{field_name}__gte": start_date})
        if end_date:
            queryset = queryset.filter(**{f"{field_name}__lte": end_date})
        return queryset

    @staticmethod
    def accounts_fee_collection(school_id: int, filters: dict):
        queryset = FeesPayment.objects.select_related(
            "student",
            "student__current_class",
            "student__current_section",
            "assignment",
            "assignment__fees_type",
        ).filter(school_id=school_id).only(
            "id",
            "paid_at",
            "amount_paid",
            "method",
            "transaction_reference",
            "student__admission_no",
            "student__first_name",
            "student__last_name",
            "student__current_class__name",
            "student__current_section__name",
            "assignment__status",
            "assignment__fees_type__name",
        )

        queryset = ReportQueryService._apply_date_range(
            queryset,
            "paid_at__date",
            filters.get("start_date"),
            filters.get("end_date"),
        )

        if filters.get("student_id"):
            queryset = queryset.filter(student_id=filters["student_id"])
        if filters.get("class_id"):
            queryset = queryset.filter(student__current_class_id=filters["class_id"])
        if filters.get("section_id"):
            queryset = queryset.filter(student__current_section_id=filters["section_id"])
        if filters.get("method"):
            queryset = queryset.filter(method=filters["method"])
        if filters.get("status"):
            queryset = queryset.filter(assignment__status=filters["status"])
        if filters.get("keyword"):
            keyword = filters["keyword"]
            queryset = queryset.filter(
                Q(student__admission_no__icontains=keyword)
                | Q(student__first_name__icontains=keyword)
                | Q(student__last_name__icontains=keyword)
                | Q(transaction_reference__icontains=keyword)
            )

        return queryset.order_by("-paid_at", "-id")

    @staticmethod
    def accounts_expense(school_id: int, filters: dict):
        queryset = LedgerEntry.objects.select_related("account", "created_by").filter(
            school_id=school_id,
            account__account_type="expense",
        ).only(
            "id",
            "entry_date",
            "amount",
            "reference_no",
            "description",
            "account__code",
            "account__name",
            "created_by__first_name",
            "created_by__last_name",
            "created_by__username",
        )

        queryset = ReportQueryService._apply_date_range(
            queryset,
            "entry_date",
            filters.get("start_date"),
            filters.get("end_date"),
        )

        if filters.get("account_id"):
            queryset = queryset.filter(account_id=filters["account_id"])
        if filters.get("keyword"):
            keyword = filters["keyword"]
            queryset = queryset.filter(
                Q(account__name__icontains=keyword)
                | Q(account__code__icontains=keyword)
                | Q(reference_no__icontains=keyword)
            )

        return queryset.order_by("-entry_date", "-id")

    @staticmethod
    def student_list(school_id: int, filters: dict):
        queryset = Student.objects.select_related(
            "current_class",
            "current_section",
            "guardian",
        ).filter(school_id=school_id).only(
            "id",
            "admission_no",
            "roll_no",
            "first_name",
            "last_name",
            "gender",
            "is_disabled",
            "current_class__name",
            "current_section__name",
            "guardian__first_name",
            "guardian__last_name",
            "guardian__phone",
            "guardian__email",
        )

        if filters.get("class_id"):
            queryset = queryset.filter(current_class_id=filters["class_id"])
        if filters.get("section_id"):
            queryset = queryset.filter(current_section_id=filters["section_id"])
        if filters.get("student_id"):
            queryset = queryset.filter(id=filters["student_id"])
        if filters.get("gender"):
            queryset = queryset.filter(gender=filters["gender"])
        if "is_disabled" in filters:
            queryset = queryset.filter(is_disabled=filters["is_disabled"])
        if filters.get("keyword"):
            keyword = filters["keyword"]
            queryset = queryset.filter(
                Q(admission_no__icontains=keyword)
                | Q(roll_no__icontains=keyword)
                | Q(first_name__icontains=keyword)
                | Q(last_name__icontains=keyword)
            )

        return queryset.order_by("first_name", "last_name", "id")

    @staticmethod
    def guardian_report(school_id: int, filters: dict):
        queryset = ReportQueryService.student_list(school_id, filters).filter(guardian__isnull=False)
        if filters.get("keyword"):
            keyword = filters["keyword"]
            queryset = queryset.filter(
                Q(guardian__first_name__icontains=keyword)
                | Q(guardian__last_name__icontains=keyword)
                | Q(guardian__phone__icontains=keyword)
                | Q(guardian__email__icontains=keyword)
            )
        return queryset

    @staticmethod
    def student_dormitory(school_id: int, filters: dict):
        # Keep current behavior aligned with available converted schema while preserving PHP route contract.
        return ReportQueryService.student_list(school_id, filters)

    @staticmethod
    def student_attendance(school_id: int, filters: dict):
        queryset = StudentAttendance.objects.select_related(
            "student",
            "student__current_class",
            "student__current_section",
        ).filter(school_id=school_id).only(
            "id",
            "attendance_date",
            "attendance_type",
            "notes",
            "student__admission_no",
            "student__first_name",
            "student__last_name",
            "student__current_class__name",
            "student__current_section__name",
        )

        queryset = ReportQueryService._apply_date_range(
            queryset,
            "attendance_date",
            filters.get("start_date"),
            filters.get("end_date"),
        )

        if filters.get("student_id"):
            queryset = queryset.filter(student_id=filters["student_id"])
        if filters.get("class_id"):
            queryset = queryset.filter(class_id=filters["class_id"])
        if filters.get("section_id"):
            queryset = queryset.filter(section_id=filters["section_id"])
        if filters.get("attendance_type"):
            queryset = queryset.filter(attendance_type=filters["attendance_type"])

        return queryset.order_by("-attendance_date", "student_id")

    @staticmethod
    def exam_marks(school_id: int, filters: dict):
        queryset = ExamMarkRegister.objects.select_related(
            "exam_term",
            "school_class",
            "section",
            "subject",
            "student",
        ).filter(school_id=school_id).only(
            "id",
            "total_marks",
            "total_gpa_point",
            "total_gpa_grade",
            "is_absent",
            "exam_term__title",
            "school_class__name",
            "section__name",
            "subject__name",
            "student__admission_no",
            "student__first_name",
            "student__last_name",
        )

        if filters.get("exam_term_id"):
            queryset = queryset.filter(exam_term_id=filters["exam_term_id"])
        if filters.get("class_id"):
            queryset = queryset.filter(school_class_id=filters["class_id"])
        if filters.get("section_id"):
            queryset = queryset.filter(section_id=filters["section_id"])
        if filters.get("student_id"):
            queryset = queryset.filter(student_id=filters["student_id"])
        if filters.get("subject_id"):
            queryset = queryset.filter(subject_id=filters["subject_id"])

        return queryset.order_by("student_id", "id")

    @staticmethod
    def exam_result_summary(school_id: int, filters: dict):
        queryset = ExamMarkRegister.objects.filter(school_id=school_id)

        if filters.get("exam_term_id"):
            queryset = queryset.filter(exam_term_id=filters["exam_term_id"])
        if filters.get("class_id"):
            queryset = queryset.filter(school_class_id=filters["class_id"])
        if filters.get("section_id"):
            queryset = queryset.filter(section_id=filters["section_id"])

        return (
            queryset.values(
                exam_term_name=F("exam_term__title"),
                class_name=F("school_class__name"),
                section_name=F("section__name"),
            )
            .annotate(
                total_students=Count("student_id", distinct=True),
                absent_students=Count("id", filter=Q(is_absent=True)),
                pass_students=Count("id", filter=Q(is_absent=False, total_gpa_point__gt=0)),
                fail_students=Count("id", filter=Q(is_absent=False, total_gpa_point__lte=0)),
                avg_marks=Avg("total_marks"),
                avg_gpa=Avg("total_gpa_point"),
            )
            .order_by("exam_term_name", "class_name", "section_name")
        )

    @staticmethod
    def library_issue_return(school_id: int, filters: dict):
        queryset = BookIssue.objects.select_related(
            "book",
            "member",
            "member__student",
            "member__staff",
        ).filter(school_id=school_id).only(
            "id",
            "issue_date",
            "due_date",
            "return_date",
            "status",
            "fine_amount",
            "book__title",
            "member__member_type",
            "member__card_no",
            "member__student__admission_no",
            "member__student__first_name",
            "member__student__last_name",
            "member__staff__staff_no",
            "member__staff__first_name",
            "member__staff__last_name",
        )

        queryset = ReportQueryService._apply_date_range(
            queryset,
            "issue_date",
            filters.get("start_date"),
            filters.get("end_date"),
        )

        if filters.get("status"):
            queryset = queryset.filter(status=filters["status"])
        if filters.get("member_type"):
            queryset = queryset.filter(member__member_type=filters["member_type"])
        if filters.get("book_id"):
            queryset = queryset.filter(book_id=filters["book_id"])
        if filters.get("keyword"):
            keyword = filters["keyword"]
            queryset = queryset.filter(
                Q(book__title__icontains=keyword)
                | Q(member__card_no__icontains=keyword)
                | Q(member__student__admission_no__icontains=keyword)
                | Q(member__student__first_name__icontains=keyword)
                | Q(member__staff__staff_no__icontains=keyword)
                | Q(member__staff__first_name__icontains=keyword)
            )

        return queryset.order_by("-issue_date", "-id")

    @staticmethod
    def academic_class_performance(school_id: int, filters: dict):
        queryset = ExamMarkRegister.objects.filter(school_id=school_id)

        if filters.get("exam_term_id"):
            queryset = queryset.filter(exam_term_id=filters["exam_term_id"])
        if filters.get("class_id"):
            queryset = queryset.filter(school_class_id=filters["class_id"])
        if filters.get("section_id"):
            queryset = queryset.filter(section_id=filters["section_id"])
        if filters.get("subject_id"):
            queryset = queryset.filter(subject_id=filters["subject_id"])

        return (
            queryset.values(
                class_name=F("school_class__name"),
                section_name=F("section__name"),
                subject_name=F("subject__name"),
            )
            .annotate(
                students_count=Count("student_id", distinct=True),
                avg_marks=Avg("total_marks"),
                avg_gpa=Avg("total_gpa_point"),
            )
            .order_by("class_name", "section_name", "subject_name")
        )

    @staticmethod
    def hr_staff_attendance(school_id: int, filters: dict):
        queryset = StaffAttendance.objects.select_related(
            "staff",
            "staff__department",
            "staff__designation",
        ).filter(school_id=school_id).only(
            "id",
            "attendance_date",
            "attendance_type",
            "note",
            "staff__staff_no",
            "staff__first_name",
            "staff__last_name",
            "staff__department__name",
            "staff__designation__title",
        )

        queryset = ReportQueryService._apply_date_range(
            queryset,
            "attendance_date",
            filters.get("start_date"),
            filters.get("end_date"),
        )

        if filters.get("department_id"):
            queryset = queryset.filter(staff__department_id=filters["department_id"])
        if filters.get("designation_id"):
            queryset = queryset.filter(staff__designation_id=filters["designation_id"])
        if filters.get("attendance_type"):
            queryset = queryset.filter(attendance_type=filters["attendance_type"])
        if filters.get("staff_id"):
            queryset = queryset.filter(staff_id=filters["staff_id"])
        if filters.get("keyword"):
            keyword = filters["keyword"]
            queryset = queryset.filter(
                Q(staff__staff_no__icontains=keyword)
                | Q(staff__first_name__icontains=keyword)
                | Q(staff__last_name__icontains=keyword)
            )

        return queryset.order_by("-attendance_date", "staff_id")

    @staticmethod
    def transport_student(school_id: int, filters: dict):
        queryset = Student.objects.select_related(
            "current_class",
            "current_section",
            "transport_route",
            "vehicle",
        ).filter(school_id=school_id).filter(Q(transport_route__isnull=False) | Q(vehicle__isnull=False)).only(
            "id",
            "admission_no",
            "first_name",
            "last_name",
            "current_class__name",
            "current_section__name",
            "transport_route__title",
            "transport_route__fare",
            "vehicle__number",
            "vehicle__model",
        )

        if filters.get("class_id"):
            queryset = queryset.filter(current_class_id=filters["class_id"])
        if filters.get("section_id"):
            queryset = queryset.filter(current_section_id=filters["section_id"])
        if filters.get("route_id"):
            queryset = queryset.filter(transport_route_id=filters["route_id"])
        if filters.get("vehicle_id"):
            queryset = queryset.filter(vehicle_id=filters["vehicle_id"])
        if filters.get("keyword"):
            keyword = filters["keyword"]
            queryset = queryset.filter(
                Q(admission_no__icontains=keyword)
                | Q(first_name__icontains=keyword)
                | Q(last_name__icontains=keyword)
            )

        return queryset.order_by("first_name", "last_name")

    @staticmethod
    def inventory_stock(school_id: int, filters: dict):
        queryset = Item.objects.select_related("category", "supplier").filter(school_id=school_id).only(
            "id",
            "item_code",
            "name",
            "quantity",
            "reorder_level",
            "unit_cost",
            "unit_price",
            "category__name",
            "supplier__name",
        )

        if filters.get("category_id"):
            queryset = queryset.filter(category_id=filters["category_id"])
        if filters.get("supplier_id"):
            queryset = queryset.filter(supplier_id=filters["supplier_id"])
        if filters.get("low_stock_only"):
            queryset = queryset.filter(quantity__lte=F("reorder_level"))
        if filters.get("keyword"):
            keyword = filters["keyword"]
            queryset = queryset.filter(
                Q(item_code__icontains=keyword)
                | Q(name__icontains=keyword)
                | Q(category__name__icontains=keyword)
            )

        return queryset.order_by("item_code", "name")

    @staticmethod
    def behaviour_incidents(school_id: int, filters: dict):
        queryset = AssignedIncident.objects.select_related(
            "incident",
            "student",
            "student__current_class",
            "student__current_section",
            "record",
            "record__school_class",
            "record__section",
            "assigned_by",
        ).filter(school_id=school_id).only(
            "id",
            "created_at",
            "incident__title",
            "incident__point",
            "student__admission_no",
            "student__first_name",
            "student__last_name",
            "student__current_class__name",
            "student__current_section__name",
            "record__school_class__name",
            "record__section__name",
            "assigned_by__first_name",
            "assigned_by__last_name",
            "assigned_by__username",
        )

        queryset = ReportQueryService._apply_date_range(
            queryset,
            "created_at__date",
            filters.get("start_date"),
            filters.get("end_date"),
        )

        if filters.get("incident_id"):
            queryset = queryset.filter(incident_id=filters["incident_id"])
        if filters.get("student_id"):
            queryset = queryset.filter(student_id=filters["student_id"])
        if filters.get("class_id"):
            queryset = queryset.filter(
                Q(record__school_class_id=filters["class_id"]) | Q(student__current_class_id=filters["class_id"])
            )
        if filters.get("section_id"):
            queryset = queryset.filter(
                Q(record__section_id=filters["section_id"]) | Q(student__current_section_id=filters["section_id"])
            )
        if filters.get("keyword"):
            keyword = filters["keyword"]
            queryset = queryset.filter(
                Q(incident__title__icontains=keyword)
                | Q(student__admission_no__icontains=keyword)
                | Q(student__first_name__icontains=keyword)
                | Q(student__last_name__icontains=keyword)
            )

        return queryset.order_by("-created_at", "-id")
