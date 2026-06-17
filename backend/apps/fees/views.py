from django.shortcuts import get_object_or_404
from django.db.models import Sum, Q
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from decimal import Decimal
from django.utils import timezone

from .models import FeesGroup, FeesType, FeeAssignment, Payment, LedgerEntry, TermSettings, FeeSchedule, ConcessionRule, LateFeeRule
from .serializers import FeesGroupSerializer, FeesTypeSerializer, FeeAssignmentSerializer, PaymentSerializer, TermSettingsSerializer, FeeScheduleSerializer, ConcessionRuleSerializer, LateFeeRuleSerializer
from .services import FeeService, FeeServiceError
from config.pagination import ApiPageNumberPagination
from apps.core.models import AcademicYear

# --- Base Views for Reusability ---

class BaseFeeAPIView(APIView):
    """A base view with shared permission and pagination logic."""
    permission_classes = [permissions.IsAuthenticated]

    def get_paginated_response(self, queryset, serializer_class, request):
        paginator = ApiPageNumberPagination()
        page = paginator.paginate_queryset(queryset, request, view=self)
        if page is not None:
            serializer = serializer_class(page, many=True)
            return paginator.get_paginated_response(serializer.data)
        serializer = serializer_class(queryset, many=True)
        return Response(serializer.data)

# --- FeesGroup Views ---

class FeesGroupListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        groups = FeesGroup.objects.filter(academic_year__school=request.user.school)

        # Filter by academic year if provided
        academic_year = request.query_params.get('academic_year')
        if academic_year:
            groups = groups.filter(academic_year_id=academic_year)

        return self.get_paginated_response(groups, FeesGroupSerializer, request)

    def post(self, request):
        serializer = FeesGroupSerializer(data=request.data)
        if serializer.is_valid():
            # Ensure academic_year belongs to the user's school
            # This check should be more robust in a real app
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FeesGroupDetailAPIView(BaseFeeAPIView):
    def get_object(self, pk, user):
        return get_object_or_404(FeesGroup, pk=pk, academic_year__school=user.school)

    def get(self, request, pk):
        group = self.get_object(pk, request.user)
        serializer = FeesGroupSerializer(group)
        return Response(serializer.data)

    def patch(self, request, pk):
        group = self.get_object(pk, request.user)
        serializer = FeesGroupSerializer(group, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        group = self.get_object(pk, request.user)
        from django.db import transaction, IntegrityError
        from django.db.models import ProtectedError
        try:
            with transaction.atomic():
                group.schedules.all().delete()
                group.fee_types.all().delete()
                group.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Exception as e:
            return Response(
                {"message": f"Cannot delete: {str(e)}"},
                status=status.HTTP_400_BAD_REQUEST
            )

# --- FeesType Views (similar pattern) ---

class FeesTypeListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        queryset = FeesType.objects.filter(academic_year__school=request.user.school)

        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(gl_code__icontains=search))

        status_filter = (request.query_params.get("status") or "").strip().lower()
        if status_filter in {"active", "inactive"}:
            queryset = queryset.filter(status=status_filter)

        sort_by = (request.query_params.get("sort_by") or "name").strip().lower()
        sort_dir = (request.query_params.get("sort_dir") or "asc").strip().lower()
        sort_map = {
            "name": "name",
            "gl_code": "gl_code",
            "status": "status",
            "created_date": "created_at",
            "updated_date": "updated_at",
        }
        order_field = sort_map.get(sort_by, "name")
        prefix = "-" if sort_dir == "desc" else ""
        queryset = queryset.order_by(f"{prefix}{order_field}", "id")

        return self.get_paginated_response(queryset, FeesTypeSerializer, request)

    def post(self, request):
        serializer = FeesTypeSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FeesTypeDetailAPIView(BaseFeeAPIView):
    def get_object(self, pk, user):
        return get_object_or_404(FeesType, pk=pk, academic_year__school=user.school)

    def get(self, request, pk):
        fee_type = self.get_object(pk, request.user)
        serializer = FeesTypeSerializer(fee_type)
        return Response(serializer.data)

    def patch(self, request, pk):
        fee_type = self.get_object(pk, request.user)
        serializer = FeesTypeSerializer(fee_type, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        fee_type = self.get_object(pk, request.user)
        from django.db import transaction, IntegrityError
        from django.db.models import ProtectedError
        try:
            with transaction.atomic():
                fee_type.schedules.all().delete()
                fee_type.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (ProtectedError, IntegrityError):
            return Response(
                {"message": "Cannot delete this fee type because it has active fee assignments or payments."},
                status=status.HTTP_400_BAD_REQUEST
            )

# --- FeeAssignment Views ---

class FeeAssignmentListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        assignments = FeeAssignment.objects.filter(academic_year__school=request.user.school)

        # Optional filters from query params
        academic_year = request.query_params.get('academic_year')
        if academic_year:
            assignments = assignments.filter(academic_year_id=academic_year)

        student = request.query_params.get('student')
        if student:
            assignments = assignments.filter(student_id=student)

        return self.get_paginated_response(assignments, FeeAssignmentSerializer, request)

    def post(self, request):
        serializer = FeeAssignmentSerializer(data=request.data)
        if serializer.is_valid():
            # Use the service layer for business logic
            FeeService.assign_fees(created_by=request.user, **serializer.validated_data)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class FeeAssignmentDetailAPIView(BaseFeeAPIView):
    def get_object(self, pk, user):
        return get_object_or_404(FeeAssignment, pk=pk, academic_year__school=user.school)

    def get(self, request, pk):
        assignment = self.get_object(pk, request.user)
        serializer = FeeAssignmentSerializer(assignment)
        return Response(serializer.data)

    def patch(self, request, pk):
        assignment = self.get_object(pk, request.user)
        serializer = FeeAssignmentSerializer(assignment, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

    def delete(self, request, pk):
        assignment = self.get_object(pk, request.user)
        # Add logic to ensure you can't delete assignments with payments
        if assignment.payments.exists():
            return Response({"detail": "Cannot delete an assignment that has payments."}, status=status.HTTP_400_BAD_REQUEST)
        assignment.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- Payment Views ---

class PaymentListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        payments = Payment.objects.filter(assignment__academic_year__school=request.user.school)
        return self.get_paginated_response(payments, PaymentSerializer, request)

    def post(self, request):
        serializer = PaymentSerializer(data=request.data)
        if serializer.is_valid():
            FeeService.post_payment(collected_by=request.user, **serializer.validated_data)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class PaymentDetailAPIView(BaseFeeAPIView):
    def get_object(self, pk, user):
        return get_object_or_404(Payment, pk=pk, assignment__academic_year__school=user.school)

    def get(self, request, pk):
        payment = self.get_object(pk, request.user)
        serializer = PaymentSerializer(payment)
        return Response(serializer.data)

    def delete(self, request, pk):
        payment = self.get_object(pk, request.user)
        # Add logic for reversal instead of deletion
        FeeService.transition_payment(payment=payment, to_status='reversed', user=request.user, reason="Deletion requested by API.")
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- Custom Action Views ---

class FeeAssignmentSummaryAPIView(BaseFeeAPIView):
    def get(self, request):
        queryset = FeeAssignment.objects.filter(academic_year__school=request.user.school)
        total_assigned = queryset.aggregate(total=Sum("amount"))["total"] or Decimal("0.00")
        total_discount = queryset.aggregate(total=Sum("discount_amount"))["total"] or Decimal("0.00")
        total_concession = queryset.aggregate(total=Sum("concession_amount"))["total"] or Decimal("0.00")
        total_net = total_assigned - total_discount - total_concession
        
        paid_total = Payment.objects.filter(assignment__in=queryset, status='posted').aggregate(total=Sum("amount_paid"))["total"] or Decimal("0.00")
        due_total = total_net - paid_total

        data = {
            "count": queryset.count(),
            "total_assigned": str(total_assigned),
            "total_discount": str(total_discount),
            "total_net": str(total_net),
            "total_paid": str(paid_total),
            "total_due": str(due_total),
        }
        return Response(data)

class PaymentReceiptAPIView(BaseFeeAPIView):
    def get(self, request, pk):
        payment = get_object_or_404(Payment, pk=pk, assignment__academic_year__school=request.user.school)
        serializer = PaymentSerializer(payment)
        # In a real app, you'd format this into a proper receipt structure
        return Response(serializer.data)

class FeeAssignmentOverdueAPIView(BaseFeeAPIView):
    def get(self, request):
        today = timezone.localdate()
        # This is inefficient and should be optimized with annotations
        all_assignments = FeeAssignment.objects.filter(
            academic_year__school=request.user.school,
            due_date__lt=today
        ).prefetch_related('payments')

        overdue = [a for a in all_assignments if a.status != 'paid']
        
        return self.get_paginated_response(overdue, FeeAssignmentSerializer, request)

class FeeAssignmentCarryForwardAPIView(BaseFeeAPIView):
    def post(self, request):
        from_year_id = request.data.get("from_academic_year")
        to_year_id = request.data.get("to_academic_year")
        due_date_str = request.data.get("due_date")

        # Basic validation
        if not all([from_year_id, to_year_id, due_date_str]):
            return Response({"detail": "from_academic_year, to_academic_year, and due_date are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            from_year = get_object_or_404(AcademicYear, pk=from_year_id, school=request.user.school)
            to_year = get_object_or_404(AcademicYear, pk=to_year_id, school=request.user.school)
            due_date = timezone.datetime.fromisoformat(due_date_str).date()
        except (ValueError, TypeError):
            return Response({"detail": "Invalid date format for due_date."}, status=status.HTTP_400_BAD_REQUEST)
        
        result = FeeService.carry_forward_dues(
            from_academic_year=from_year,
            to_academic_year=to_year,
            due_date=due_date,
            user=request.user
        )
        return Response(result)

class PaymentTransitionAPIView(BaseFeeAPIView):
    def post(self, request, pk):
        payment = get_object_or_404(Payment, pk=pk, assignment__academic_year__school=request.user.school)
        to_status = request.data.get('status')
        reason = request.data.get('reason', '')

        if not to_status:
            return Response({"detail": "New 'status' is required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            updated_payment = FeeService.transition_payment(
                payment=payment,
                to_status=to_status,
                user=request.user,
                reason=reason
            )
            serializer = PaymentSerializer(updated_payment)
            return Response(serializer.data)
        except FeeServiceError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

# --- Term Settings Views ---

class TermSettingsListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        queryset = TermSettings.objects.filter(academic_year__school=request.user.school)
        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(Q(term_name__icontains=search) | Q(academic_year__name__icontains=search))
        sort_by = (request.query_params.get("sort_by") or "term_number").strip().lower()
        sort_map = {"term_number": "term_number", "created_date": "created_at", "updated_date": "updated_at"}
        order_field = sort_map.get(sort_by, "term_number")
        queryset = queryset.order_by(order_field, "id")
        return self.get_paginated_response(queryset, TermSettingsSerializer, request)

    def post(self, request):
        print("[DEBUG] request.data TYPE:", type(request.data), "data:", request.data)
        if isinstance(request.data, list):
            if not request.data:
                return Response([], status=status.HTTP_200_OK)

            academic_year_ids = {item.get("academic_year") for item in request.data if item.get("academic_year")}
            if not academic_year_ids:
                return Response(
                    {"success": False, "message": "academic_year is required for all terms."},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            if len(academic_year_ids) != 1:
                return Response(
                    {"success": False, "message": "All terms in a bulk save must belong to the exact same Academic Year."},
                    status=status.HTTP_400_BAD_REQUEST,
                )

            academic_year_id = list(academic_year_ids)[0]

            from django.db import transaction
            try:
                with transaction.atomic():
                    # Get existing terms for this academic_year belonging to the user's school
                    existing_terms = TermSettings.objects.filter(
                        academic_year_id=academic_year_id,
                        academic_year__school=request.user.school
                    )
                    existing_map = {item.term_number: item for item in existing_terms}

                    incoming_term_numbers = set()
                    saved_data = []

                    create_count = 0
                    update_count = 0
                    no_change_count = 0
                    delete_count = 0

                    for term_data in request.data:
                        term_num = term_data.get("term_number")
                        if term_num is None:
                            return Response(
                                {"success": False, "message": "term_number is required for all elements."},
                                status=status.HTTP_400_BAD_REQUEST,
                            )
                        incoming_term_numbers.add(term_num)

                        existing_obj = existing_map.get(term_num)
                        if existing_obj:
                            from datetime import datetime, date
                            def parse_date(date_val):
                                if isinstance(date_val, (date, datetime)):
                                    return date_val
                                if isinstance(date_val, str):
                                    try:
                                        return datetime.strptime(date_val.strip(), "%Y-%m-%d").date()
                                    except ValueError:
                                        pass
                                return None

                            income_start = parse_date(term_data.get("start_date"))
                            income_end = parse_date(term_data.get("end_date"))
                            income_due = parse_date(term_data.get("default_due_date"))
                            income_name = (term_data.get("term_name") or "").strip()

                            is_changed = (
                                existing_obj.term_name.strip() != income_name or
                                existing_obj.start_date != income_start or
                                existing_obj.end_date != income_end or
                                existing_obj.default_due_date != income_due
                            )

                            if is_changed:
                                print(f"[TermSettings] [backend/debug] Term {term_num}: UPDATE detected (name: {existing_obj.term_name} -> {income_name})")
                                serializer = TermSettingsSerializer(
                                    existing_obj,
                                    data=term_data,
                                    partial=True,
                                    context={"request": request}
                                )
                                if not serializer.is_valid():
                                    return Response(
                                        {
                                            "success": False,
                                            "message": f"Validation failed at term {term_num}.",
                                            "errors": serializer.errors,
                                        },
                                        status=status.HTTP_400_BAD_REQUEST,
                                    )
                                serializer.save()
                                saved_data.append(serializer.data)
                                update_count += 1
                            else:
                                print(f"[TermSettings] [backend/debug] Term {term_num}: NO_CHANGE detected")
                                serializer = TermSettingsSerializer(existing_obj)
                                saved_data.append(serializer.data)
                                no_change_count += 1
                        else:
                            print(f"[TermSettings] [backend/debug] Term {term_num}: CREATE detected")
                            serializer = TermSettingsSerializer(
                                data=term_data,
                                context={"request": request}
                            )
                            if not serializer.is_valid():
                                return Response(
                                    {
                                        "success": False,
                                        "message": f"Validation failed at term {term_num}.",
                                        "errors": serializer.errors,
                                    },
                                    status=status.HTTP_400_BAD_REQUEST,
                                )
                            serializer.save(created_by=request.user)
                            saved_data.append(serializer.data)
                            create_count += 1

                    # Delete any terms that were NOT in the incoming request payload
                    to_delete = existing_terms.exclude(term_number__in=incoming_term_numbers)
                    delete_count = to_delete.count()
                    if delete_count > 0:
                        print(f"[TermSettings] [backend/debug] Deleting {delete_count} extra terms not included in the payload.")
                        to_delete.delete()

                    if create_count > 0:
                        overall_action = "CREATE"
                    elif update_count > 0 or delete_count > 0:
                        overall_action = "UPDATE"
                    else:
                        overall_action = "NO_CHANGE"

                    print(f"[TermSettings] [backend/debug] Overall Action: {overall_action} (Created: {create_count}, Updated: {update_count}, Unchanged: {no_change_count}, Deleted: {delete_count})")

                return Response(saved_data, status=status.HTTP_201_CREATED)
            except Exception as e:
                return Response(
                    {"success": False, "message": f"Failed bulk save: {str(e)}"},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        serializer = TermSettingsSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

class TermSettingsDetailAPIView(BaseFeeAPIView):
    def get_object(self, pk, user):
        return get_object_or_404(TermSettings, pk=pk, academic_year__school=user.school)

    def get(self, request, pk):
        term_setting = self.get_object(pk, request.user)
        serializer = TermSettingsSerializer(term_setting)
        return Response(serializer.data)

    def put(self, request, pk):
        term_setting = self.get_object(pk, request.user)
        serializer = TermSettingsSerializer(term_setting, data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def patch(self, request, pk):
        term_setting = self.get_object(pk, request.user)
        serializer = TermSettingsSerializer(term_setting, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):
        term_setting = self.get_object(pk, request.user)
        term_setting.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- Fee Schedule Views ---

class FeeScheduleListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        queryset = FeeSchedule.objects.filter(academic_year__school=request.user.school, is_deleted=False)
        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(
                Q(fee_group__name__icontains=search) | Q(fee_type__name__icontains=search) | Q(academic_year__name__icontains=search)
            )
        status_filter = (request.query_params.get("status") or "").strip().lower()
        if status_filter in {"active", "inactive"}:
            queryset = queryset.filter(status=status_filter)
        sort_by = (request.query_params.get("sort_by") or "created_at").strip().lower()
        sort_map = {"created_at": "created_at", "updated_at": "updated_at", "amount": "amount", "fee_group": "fee_group__name", "fee_type": "fee_type__name"}
        order_field = sort_map.get(sort_by, "created_at")
        queryset = queryset.order_by(f"-{order_field}", "id")
        return self.get_paginated_response(queryset, FeeScheduleSerializer, request)

    def post(self, request):
        serializer = FeeScheduleSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(created_by=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

class FeeScheduleDetailAPIView(BaseFeeAPIView):
    def get_object(self, pk, user):
        return get_object_or_404(FeeSchedule, pk=pk, academic_year__school=user.school, is_deleted=False)

    def get(self, request, pk):
        schedule = self.get_object(pk, request.user)
        serializer = FeeScheduleSerializer(schedule)
        return Response(serializer.data)

    def put(self, request, pk):
        schedule = self.get_object(pk, request.user)
        serializer = FeeScheduleSerializer(schedule, data=request.data, context={"request": request})
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def patch(self, request, pk):
        schedule = self.get_object(pk, request.user)
        serializer = FeeScheduleSerializer(schedule, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):
        schedule = self.get_object(pk, request.user)
        has_assignments = FeeAssignment.objects.filter(fees_type=schedule.fee_type).exists()
        has_payments = Payment.objects.filter(assignment__fees_type=schedule.fee_type).exists()
        
        if has_assignments or has_payments:
            return Response(
                {"success": False, "message": "Deletion blocked.", "errors": {"detail": ["Cannot delete. This fee schedule is already in use."]}},
                status=status.HTTP_400_BAD_REQUEST,
            )

        schedule.is_deleted = True
        schedule.status = "inactive"
        schedule.deleted_by = request.user
        schedule.deleted_at = timezone.now()
        schedule.save(update_fields=["is_deleted", "status", "deleted_by", "deleted_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- Concession Rule Views ---

class ConcessionRuleListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        queryset = ConcessionRule.objects.filter(academic_year__school=request.user.school, is_deleted=False)
        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(applies_to__icontains=search))
        status_filter = (request.query_params.get("status") or "").strip().lower()
        if status_filter in {"active", "inactive"}:
            queryset = queryset.filter(status=status_filter)
        queryset = queryset.order_by("name", "id")
        return self.get_paginated_response(queryset, ConcessionRuleSerializer, request)

    def post(self, request):
        from django.db import IntegrityError
        serializer = ConcessionRuleSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            try:
                serializer.save(created_by=request.user)
            except IntegrityError:
                return Response(
                    {"success": False, "message": "Validation failed.", "errors": {"name": ["A rule with this name already exists for the academic year."]}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

class ConcessionRuleDetailAPIView(BaseFeeAPIView):
    def get_object(self, pk, user):
        return get_object_or_404(ConcessionRule, pk=pk, academic_year__school=user.school, is_deleted=False)

    def get(self, request, pk):
        rule = self.get_object(pk, request.user)
        return Response(ConcessionRuleSerializer(rule).data)

    def patch(self, request, pk):
        rule = self.get_object(pk, request.user)
        serializer = ConcessionRuleSerializer(rule, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):
        rule = self.get_object(pk, request.user)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- Late Fee Rule Views ---

class LateFeeRuleListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        queryset = LateFeeRule.objects.filter(academic_year__school=request.user.school, is_deleted=False)
        search = (request.query_params.get("search") or "").strip()
        if search:
            queryset = queryset.filter(Q(name__icontains=search) | Q(penalty_rule__icontains=search))
        status_filter = (request.query_params.get("status") or "").strip().lower()
        if status_filter in {"active", "inactive"}:
            queryset = queryset.filter(status=status_filter)
        queryset = queryset.order_by("name", "id")
        return self.get_paginated_response(queryset, LateFeeRuleSerializer, request)

    def post(self, request):
        from django.db import IntegrityError
        serializer = LateFeeRuleSerializer(data=request.data, context={"request": request})
        if serializer.is_valid():
            try:
                serializer.save(created_by=request.user)
            except IntegrityError:
                return Response(
                    {"success": False, "message": "Validation failed.", "errors": {"name": ["A rule with this name already exists for the academic year."]}},
                    status=status.HTTP_400_BAD_REQUEST,
                )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

class LateFeeRuleDetailAPIView(BaseFeeAPIView):
    def get_object(self, pk, user):
        return get_object_or_404(LateFeeRule, pk=pk, academic_year__school=user.school, is_deleted=False)

    def get(self, request, pk):
        rule = self.get_object(pk, request.user)
        return Response(LateFeeRuleSerializer(rule).data)

    def patch(self, request, pk):
        rule = self.get_object(pk, request.user)
        serializer = LateFeeRuleSerializer(rule, data=request.data, partial=True, context={"request": request})
        if serializer.is_valid():
            serializer.save(updated_by=request.user)
            return Response(serializer.data)
        return Response(
            {"success": False, "message": "Validation failed.", "errors": serializer.errors},
            status=status.HTTP_400_BAD_REQUEST,
        )

    def delete(self, request, pk):
        rule = self.get_object(pk, request.user)
        rule.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

