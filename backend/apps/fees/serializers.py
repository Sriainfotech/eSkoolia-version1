import re
from rest_framework import serializers
from django.db import models
from decimal import Decimal
from .models import FeesGroup, FeesType, FeeAssignment, Payment, LedgerEntry, TermSettings, FeeSchedule, ConcessionRule, LateFeeRule
from apps.core.models import Class, AcademicYear

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
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True, required=False)
    taxable = serializers.CharField()
    default_structure = serializers.CharField()
    status = serializers.CharField()

    STRUCTURE_INPUT_MAP = {
        'monthly': 'monthly',
        'quarterly': 'quarterly',
        'term-wise': 'term_wise',
        'term_wise': 'term_wise',
        'yearly': 'yearly',
        'custom': 'custom',
    }
    STRUCTURE_OUTPUT_MAP = {
        'monthly': 'Monthly',
        'quarterly': 'Quarterly',
        'term_wise': 'Term-wise',
        'yearly': 'Yearly',
        'custom': 'Custom',
    }

    class Meta:
        model = FeesType
        fields = [
            'id',
            'academic_year',
            'fees_group',
            'name',
            'gl_code',
            'taxable',
            'default_structure',
            'status',
            'amount',
            'description',
            'is_active',
            'created_at',
            'updated_at',
            'created_by',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def validate_name(self, value):
        cleaned = (value or '').strip()
        if len(cleaned) < 3:
            raise serializers.ValidationError('must be at least 3 characters long.')
        if len(cleaned) > 100:
            raise serializers.ValidationError('must be at most 100 characters long.')

        request = self.context.get('request')
        school_id = getattr(getattr(request, 'user', None), 'school_id', None)
        queryset = FeesType.objects.filter(is_deleted=False)
        if school_id:
            queryset = queryset.filter(academic_year__school_id=school_id)
        queryset = queryset.filter(name__iexact=cleaned)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('must be unique.')
        return cleaned

    def validate_gl_code(self, value):
        code = (value or '').strip().upper()
        if not code:
            raise serializers.ValidationError('GL Code is required.')
        if not re.match(r'^[0-9]{4}-[A-Z0-9]+$', code):
            raise serializers.ValidationError('Invalid GL Code format. Use XXXX-CODE (e.g., 4001-TUITION).')

        queryset = FeesType.objects.filter(is_deleted=False, gl_code=code)
        if self.instance:
            queryset = queryset.exclude(pk=self.instance.pk)
        if queryset.exists():
            raise serializers.ValidationError('A Fee Type with this GL Code already exists.')

        account_number = code.split('-')[0]
        account_qs = FeesType.objects.filter(is_deleted=False, gl_code__startswith=f'{account_number}-')
        if self.instance:
            account_qs = account_qs.exclude(pk=self.instance.pk)
        if account_qs.exists():
            raise serializers.ValidationError(
                f'Account number {account_number} is already used by another Fee Type. Use a unique account number.'
            )
        return code

    def validate_taxable(self, value):
        normalized = (value or '').strip().lower()
        if normalized not in {'yes', 'no'}:
            raise serializers.ValidationError('must be Yes or No.')
        return normalized

    def validate_default_structure(self, value):
        normalized = self.STRUCTURE_INPUT_MAP.get((value or '').strip().lower())
        if not normalized:
            raise serializers.ValidationError('must be one of Monthly, Quarterly, Term-wise, Yearly, Custom.')
        return normalized

    def validate_status(self, value):
        normalized = (value or '').strip().lower()
        if normalized not in {'active', 'inactive'}:
            raise serializers.ValidationError('must be Active or Inactive.')
        return normalized

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        school_id = getattr(user, 'school_id', None)

        academic_year = attrs.get('academic_year') or getattr(self.instance, 'academic_year', None)
        if not academic_year:
            if school_id:
                academic_year = AcademicYear.objects.filter(school_id=school_id, is_current=True).first() or AcademicYear.objects.filter(school_id=school_id).first()
                if academic_year:
                    attrs['academic_year'] = academic_year
            if not attrs.get('academic_year'):
                raise serializers.ValidationError({'academic_year': ['is required.']})

        fees_group = attrs.get('fees_group') or getattr(self.instance, 'fees_group', None)
        if not fees_group and attrs.get('academic_year'):
            default_group, _ = FeesGroup.objects.get_or_create(
                academic_year=attrs['academic_year'],
                name='General',
                defaults={'created_by': user},
            )
            attrs['fees_group'] = default_group

        if 'status' in attrs:
            attrs['is_active'] = attrs['status'] == 'active'

        if 'amount' not in attrs and not self.instance:
            attrs['amount'] = Decimal('0.00')

        name = attrs.get('name')
        fees_group = attrs.get('fees_group')
        if name and fees_group:
            qs = FeesType.objects.filter(is_deleted=False, fees_group=fees_group, name__iexact=name.strip())
            if self.instance:
                qs = qs.exclude(pk=self.instance.pk)
            if qs.exists():
                group_name = fees_group.name
                raise serializers.ValidationError({
                    'name': f"A Fee Type named '{name}' already exists in the '{group_name}' group."
                })

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['taxable'] = 'Yes' if instance.taxable == 'yes' else 'No'
        data['default_structure'] = self.STRUCTURE_OUTPUT_MAP.get(instance.default_structure, instance.default_structure)
        data['status'] = 'Active' if instance.status == 'active' else 'Inactive'
        return data

class FeeAssignmentSerializer(serializers.ModelSerializer):
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    discount_amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)
    concession_amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True, required=False)
    status = serializers.CharField(read_only=True)
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

class TermSettingsSerializer(serializers.ModelSerializer):
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)

    class Meta:
        model = TermSettings
        fields = [
            'id',
            'academic_year',
            'academic_year_name',
            'term_number',
            'term_name',
            'start_date',
            'end_date',
            'default_due_date',
            'created_at',
            'updated_at',
            'created_by',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def validate_term_name(self, value):
        cleaned = (value or '').strip()
        if not cleaned:
            raise serializers.ValidationError('Term name is required.')
        if len(cleaned) < 2:
            raise serializers.ValidationError('Term name must be at least 2 characters.')
        if len(cleaned) > 100:
            raise serializers.ValidationError('Term name must be at most 100 characters.')
        return cleaned

    def validate(self, attrs):
        start_date = attrs.get('start_date') or getattr(self.instance, 'start_date', None)
        end_date = attrs.get('end_date') or getattr(self.instance, 'end_date', None)
        default_due_date = attrs.get('default_due_date') or getattr(self.instance, 'default_due_date', None)
        academic_year = attrs.get('academic_year') or getattr(self.instance, 'academic_year', None)

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError({'start_date': 'Start date must be before end date.'})

        if academic_year and default_due_date:
            if not (academic_year.start_date <= default_due_date <= academic_year.end_date):
                raise serializers.ValidationError({
                    'default_due_date': 'Due date must fall within the academic year range.'
                })

        if academic_year and start_date:
            if not (academic_year.start_date <= start_date <= academic_year.end_date):
                raise serializers.ValidationError({
                    'start_date': 'Start date must fall within the academic year range.'
                })

        if academic_year and end_date:
            if not (academic_year.start_date <= end_date <= academic_year.end_date):
                raise serializers.ValidationError({
                    'end_date': 'End date must fall within the academic year range.'
                })

        return attrs

class FeeScheduleSerializer(serializers.ModelSerializer):
    fee_group_name = serializers.CharField(source='fee_group.name', read_only=True)
    fee_type_name = serializers.CharField(source='fee_type.name', read_only=True)
    academic_year_name = serializers.CharField(source='academic_year.name', read_only=True)
    collection_frequency = serializers.CharField()
    status = serializers.CharField()
    amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True)

    FREQUENCY_INPUT_MAP = {
        'monthly': 'monthly',
        'quarterly': 'quarterly',
        'term-wise': 'term_wise',
        'term_wise': 'term_wise',
        'half-yearly': 'half_yearly',
        'half_yearly': 'half_yearly',
        'yearly': 'yearly',
        'one-time': 'one_time',
        'one_time': 'one_time',
        'custom': 'custom',
    }
    FREQUENCY_OUTPUT_MAP = {
        'monthly': 'Monthly',
        'quarterly': 'Quarterly',
        'term_wise': 'Term-wise',
        'half_yearly': 'Half-Yearly',
        'yearly': 'Yearly',
        'one_time': 'One-Time',
        'custom': 'Custom',
    }

    class Meta:
        model = FeeSchedule
        fields = [
            'id',
            'academic_year',
            'academic_year_name',
            'fee_group',
            'fee_group_name',
            'fee_type',
            'fee_type_name',
            'amount',
            'collection_frequency',
            'due_date',
            'late_fee_applicable',
            'grace_period',
            'late_fee_rule',
            'term_breakdown',
            'status',
            'description',
            'created_at',
            'updated_at',
            'created_by',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def validate_amount(self, value):
        if value is None or value <= 0:
            raise serializers.ValidationError('Amount must be greater than 0.')
        return value

    def validate_collection_frequency(self, value):
        normalized = self.FREQUENCY_INPUT_MAP.get((value or '').strip().lower())
        if not normalized:
            raise serializers.ValidationError(
                'Collection frequency must be one of: Monthly, Quarterly, Term-wise, Half-Yearly, Yearly, One-Time, Custom.'
            )
        return normalized

    def validate_status(self, value):
        normalized = (value or '').strip().lower()
        if normalized not in {'active', 'inactive'}:
            raise serializers.ValidationError('Status must be Active or Inactive.')
        return normalized

    def validate(self, attrs):
        request = self.context.get('request')
        user = getattr(request, 'user', None)
        school_id = getattr(user, 'school_id', None)

        fee_group = attrs.get('fee_group', getattr(self.instance, 'fee_group', None))
        fee_type = attrs.get('fee_type', getattr(self.instance, 'fee_type', None))
        academic_year = attrs.get('academic_year', getattr(self.instance, 'academic_year', None))

        if not fee_group:
            raise serializers.ValidationError({'fee_group': 'Fee group is required.'})
        if not fee_type:
            raise serializers.ValidationError({'fee_type': 'Fee type is required.'})
        if not academic_year:
            raise serializers.ValidationError({'academic_year': 'Academic year is required.'})

        qs = FeeSchedule.objects.filter(is_deleted=False, academic_year=academic_year, fee_group=fee_group, fee_type=fee_type)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError({
                'fee_type': 'This fee schedule already exists for the selected fee type.'
            })

        if 'status' in attrs:
            attrs['status'] = attrs['status'].lower()

        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['collection_frequency'] = self.FREQUENCY_OUTPUT_MAP.get(instance.collection_frequency, instance.collection_frequency)
        data['status'] = 'Active' if instance.status == 'active' else 'Inactive'
        data['amount'] = str(instance.amount)
        return data


class ConcessionRuleSerializer(serializers.ModelSerializer):
    status = serializers.CharField(required=False)
    discount_percentage = serializers.DecimalField(max_digits=5, decimal_places=2, coerce_to_string=True)

    class Meta:
        model = ConcessionRule
        fields = [
            'id',
            'academic_year',
            'name',
            'applies_to',
            'discount_percentage',
            'status',
            'created_at',
            'updated_at',
            'created_by',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def validate_status(self, value):
        normalized = (value or '').strip().lower()
        if normalized not in {'active', 'inactive'}:
            raise serializers.ValidationError('Status must be Active or Inactive.')
        return normalized

    def validate_discount_percentage(self, value):
        if value < 0 or value > 100:
            raise serializers.ValidationError('Discount percentage must be between 0 and 100.')
        return value

    def validate(self, attrs):
        if 'status' in attrs:
            attrs['status'] = attrs['status'].lower()
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['status'] = 'Active' if instance.status == 'active' else 'Inactive'
        return data


class LateFeeRuleSerializer(serializers.ModelSerializer):
    status = serializers.CharField(required=False)
    cap_amount = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=True, required=False, allow_null=True)

    class Meta:
        model = LateFeeRule
        fields = [
            'id',
            'academic_year',
            'name',
            'grace_period_days',
            'penalty_rule',
            'cap_amount',
            'status',
            'created_at',
            'updated_at',
            'created_by',
        ]
        read_only_fields = ['created_at', 'updated_at', 'created_by']

    def validate_status(self, value):
        normalized = (value or '').strip().lower()
        if normalized not in {'active', 'inactive'}:
            raise serializers.ValidationError('Status must be Active or Inactive.')
        return normalized

    def validate(self, attrs):
        if 'status' in attrs:
            attrs['status'] = attrs['status'].lower()
        return attrs

    def to_representation(self, instance):
        data = super().to_representation(instance)
        data['status'] = 'Active' if instance.status == 'active' else 'Inactive'
        return data
