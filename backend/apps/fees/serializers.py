from rest_framework import serializers
from django.db import models
from decimal import Decimal
from .models import FeesGroup, FeesType, FeeAssignment, Payment, LedgerEntry
from apps.core.models import Class

class FeesGroupSerializer(serializers.ModelSerializer):
    applicable_classes = serializers.PrimaryKeyRelatedField(
        queryset=Class.objects.all(),
        many=True,
        required=False,
    )
    class Meta:
        model = FeesGroup
        fields = ['id', 'academic_year', 'name', 'description', 'applicable_classes', 'is_active', 'created_at', 'created_by']
        read_only_fields = ['created_at', 'created_by']

    def validate_applicable_classes(self, value):
        if value is None:
            return value
        if len(value) == 0:
            raise serializers.ValidationError("Please select at least one applicable class.")
        return value

class FeesTypeSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)

    class Meta:
        model = FeesType
        fields = ['id', 'academic_year', 'fees_group', 'name', 'amount', 'description', 'is_active', 'created_at', 'created_by']
        read_only_fields = ['created_at', 'created_by']

class FeeAssignmentSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    concession_amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    status = serializers.CharField(source='status', read_only=True)
    total_paid = serializers.SerializerMethodField()
    net_due = serializers.SerializerMethodField()

    class Meta:
        model = FeeAssignment
        fields = [
            'id', 'academic_year', 'student', 'fees_type', 'due_date', 
            'amount', 'discount_amount', 'concession_amount',
            'status', 'total_paid', 'net_due',
            'created_at', 'created_by'
        ]
        read_only_fields = ['created_at', 'created_by', 'status', 'total_paid', 'net_due']

    def get_total_paid(self, obj):
        # This should use the ledger for accuracy
        paid = obj.payments.filter(status='posted').aggregate(total=models.Sum('amount_paid'))['total'] or Decimal('0.00')
        return str(paid)

    def get_net_due(self, obj):
        # This should use the ledger for accuracy
        net_amount = obj.amount - obj.discount_amount - obj.concession_amount
        paid = obj.payments.filter(status='posted').aggregate(total=models.Sum('amount_paid'))['total'] or Decimal('0.00')
        due = net_amount - paid
        return str(due)


class PaymentSerializer(serializers.ModelSerializer):
    amount_paid = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)

    class Meta:
        model = Payment
        fields = [
            'id', 'assignment', 'student', 'amount_paid', 'method', 'status', 
            'paid_at', 'transaction_reference', 'note', 
            'collected_by', 'created_at'
        ]
        read_only_fields = ['collected_by', 'created_at']
