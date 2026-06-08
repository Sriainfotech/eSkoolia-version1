from django.shortcuts import get_object_or_404
from django.db.models import Sum
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions
from decimal import Decimal
from django.utils import timezone

from .models import FeesGroup, FeesType, FeeAssignment, Payment
from .serializers import FeesGroupSerializer, FeesTypeSerializer, FeeAssignmentSerializer, PaymentSerializer
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
        group.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- FeesType Views (similar pattern) ---

class FeesTypeListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        types = FeesType.objects.filter(academic_year__school=request.user.school)
        return self.get_paginated_response(types, FeesTypeSerializer, request)

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
        fee_type.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

# --- FeeAssignment Views ---

class FeeAssignmentListCreateAPIView(BaseFeeAPIView):
    def get(self, request):
        assignments = FeeAssignment.objects.filter(academic_year__school=request.user.school)
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

