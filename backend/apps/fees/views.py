from decimal import Decimal

from django.db.models import Sum
from django.db import transaction
from django.utils import timezone
from rest_framework.decorators import action
from rest_framework import permissions, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response

from .models import FeesAssignment, FeesGroup, FeesPayment, FeesType
from .serializers import FeesAssignmentSerializer, FeesGroupSerializer, FeesPaymentSerializer, FeesTypeSerializer


class SchoolScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = ApiPageNumberPagination
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


class FeesGroupViewSet(SchoolScopedModelViewSet):
    queryset = FeesGroup.objects.select_related("school", "academic_year").all()
    serializer_class = FeesGroupSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["academic_year", "is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "created_at", "updated_at"]
    permission_codes = {"*": "fees.fees_group.view"}


class FeesTypeViewSet(SchoolScopedModelViewSet):
    queryset = FeesType.objects.select_related("school", "academic_year", "fees_group").all()
    serializer_class = FeesTypeSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["academic_year", "fees_group", "is_active"]
    search_fields = ["name", "description"]
    ordering_fields = ["name", "amount", "created_at"]
    permission_codes = {"*": "fees.fees_type.view"}


class FeesAssignmentViewSet(SchoolScopedModelViewSet):
    queryset = FeesAssignment.objects.select_related("school", "academic_year", "student", "fees_type").all()
    serializer_class = FeesAssignmentSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["academic_year", "student", "fees_type", "status", "due_date"]
    search_fields = ["student__first_name", "student__last_name", "student__admission_no", "fees_type__name"]
    ordering_fields = ["due_date", "created_at", "amount"]
    permission_codes = {
        "list": "fees.fees_due.view",
        "retrieve": "fees.fees_due.view",
        "summary": "fees.fees_due.view",
        "overdue": "fees.fees_due.view",
        "create": "fees.fees_master.view",
        "update": "fees.fees_master.view",
        "partial_update": "fees.fees_master.view",
        "destroy": "fees.fees_master.view",
        "carry_forward": "fees.fees_carry_forward.view",
    }

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        total_assigned = queryset.aggregate(total=Sum("amount")).get("total") or Decimal("0.00")
        total_discount = queryset.aggregate(total=Sum("discount_amount")).get("total") or Decimal("0.00")
        total_net = max(total_assigned - total_discount, Decimal("0.00"))

        paid_total = (
            FeesPayment.objects.filter(assignment__in=queryset)
            .aggregate(total=Sum("amount_paid"))
            .get("total")
            or Decimal("0.00")
        )
        due_total = max(total_net - paid_total, Decimal("0.00"))

        data = {
            "count": queryset.count(),
            "total_assigned": str(total_assigned),
            "total_discount": str(total_discount),
            "total_net": str(total_net),
            "total_paid": str(paid_total),
            "total_due": str(due_total),
        }
        return Response(data)

    @action(detail=False, methods=["get"], url_path="overdue")
    def overdue(self, request):
        today = timezone.localdate()
        queryset = self.filter_queryset(
            self.get_queryset().filter(due_date__lt=today).exclude(status=FeesAssignment.STATUS_PAID)
        )
        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = self.get_serializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = self.get_serializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=["post"], url_path="carry-forward")
    @transaction.atomic
    def carry_forward(self, request):
        from_year_id = request.data.get("from_academic_year")
        to_year_id = request.data.get("to_academic_year")
        due_date_raw = request.data.get("due_date")

        if not from_year_id or not to_year_id:
            return Response({"detail": "from_academic_year and to_academic_year are required."}, status=400)
        if str(from_year_id) == str(to_year_id):
            return Response({"detail": "Target academic year must be different."}, status=400)

        due_date = timezone.localdate()
        if due_date_raw:
            try:
                due_date = timezone.datetime.fromisoformat(str(due_date_raw)).date()
            except ValueError:
                return Response({"detail": "Invalid due_date format."}, status=400)

        source_rows = self.get_queryset().filter(academic_year_id=from_year_id).exclude(status=FeesAssignment.STATUS_PAID)
        created = 0
        updated = 0
        total_amount = Decimal("0.00")

        for row in source_rows:
            carry_amount = row.due_amount
            if carry_amount <= Decimal("0.00"):
                continue

            target = FeesAssignment.objects.filter(
                school_id=row.school_id,
                academic_year_id=to_year_id,
                student_id=row.student_id,
                fees_type_id=row.fees_type_id,
                due_date=due_date,
            ).order_by("id").first()

            if target:
                target.amount = target.amount + carry_amount
                target.discount_amount = Decimal("0.00")
                target.status = FeesAssignment.STATUS_UNPAID
                target.save(update_fields=["amount", "discount_amount", "status", "updated_at"])
                updated += 1
            else:
                FeesAssignment.objects.create(
                    school_id=row.school_id,
                    academic_year_id=to_year_id,
                    student_id=row.student_id,
                    fees_type_id=row.fees_type_id,
                    due_date=due_date,
                    amount=carry_amount,
                    discount_amount=Decimal("0.00"),
                    status=FeesAssignment.STATUS_UNPAID,
                )
                created += 1

            total_amount += carry_amount

        return Response(
            {
                "message": "Operation successful",
                "created": created,
                "updated": updated,
                "total_amount": str(total_amount),
            }
        )


class FeesPaymentViewSet(SchoolScopedModelViewSet):
    queryset = FeesPayment.objects.select_related("school", "assignment", "student", "recorded_by").all()
    serializer_class = FeesPaymentSerializer
    filterset_fields = ["student", "method", "paid_at"]
    search_fields = ["transaction_reference", "student__first_name", "student__last_name", "student__admission_no"]
    ordering_fields = ["paid_at", "created_at", "amount_paid"]
    permission_codes = {
        "*": "fees.fees_collection.view",
        "receipt": "fees.fees_collection.view",
    }

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")

        payment = serializer.save(school=school, recorded_by=user)

        assignment = payment.assignment
        due_amount = assignment.due_amount
        if due_amount <= Decimal("0.00"):
            assignment.status = FeesAssignment.STATUS_PAID
        elif due_amount < assignment.net_amount:
            assignment.status = FeesAssignment.STATUS_PARTIAL
        else:
            assignment.status = FeesAssignment.STATUS_UNPAID
        assignment.save(update_fields=["status", "updated_at"])

    @action(detail=True, methods=["get"], url_path="receipt")
    def receipt(self, request, pk=None):
        payment = self.get_object()
        assignment = payment.assignment

        data = {
            "payment_id": payment.id,
            "transaction_reference": payment.transaction_reference,
            "method": payment.method,
            "paid_at": payment.paid_at,
            "amount_paid": str(payment.amount_paid),
            "student": {
                "id": payment.student_id,
                "admission_no": payment.student.admission_no,
                "name": f"{payment.student.first_name} {payment.student.last_name}".strip(),
            },
            "assignment": {
                "id": assignment.id,
                "fees_type": assignment.fees_type.name,
                "due_date": assignment.due_date,
                "amount": str(assignment.amount),
                "discount_amount": str(assignment.discount_amount),
                "net_amount": str(assignment.net_amount),
                "paid_amount": str(assignment.paid_amount),
                "due_amount": str(assignment.due_amount),
                "status": assignment.status,
            },
            "recorded_by": payment.recorded_by.get_full_name() if payment.recorded_by else None,
            "note": payment.note,
        }
        return Response(data)
