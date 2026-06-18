import re
from django.db import models
from django.conf import settings
from django.core.exceptions import ValidationError
from decimal import Decimal
from django.contrib.contenttypes.fields import GenericForeignKey
from django.contrib.contenttypes.models import ContentType

# Non-negotiable: All money fields use Decimal
MONEY_FIELD_KWARGS = {"max_digits": 12, "decimal_places": 2}

class FeesGroup(models.Model):
    """
    A category for fee types, e.g., 'Tuition Fees', 'Transport Fees'.
    Tenant-scoped via academic_year.
    """
    academic_year = models.ForeignKey('core.AcademicYear', on_delete=models.PROTECT)
    name = models.CharField(max_length=100)
    description = models.TextField(blank=True)
    applicable_classes = models.ManyToManyField("core.Class", blank=True, related_name="fee_groups")
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_fees_groups')

    class Meta:
        unique_together = ('academic_year', 'name')
        ordering = ['name']

    def __str__(self):
        return self.name

class FeesType(models.Model):
    """
    A specific fee item, e.g., 'Term 1 Tuition', 'Bus Route A Fee'.
    Belongs to a FeeGroup.
    """
    TAXABLE_CHOICES = [
        ('yes', 'Yes'),
        ('no', 'No'),
    ]
    DEFAULT_STRUCTURE_CHOICES = [
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('term_wise', 'Term-wise'),
        ('yearly', 'Yearly'),
        ('custom', 'Custom'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]

    academic_year = models.ForeignKey('core.AcademicYear', on_delete=models.PROTECT)
    fees_group = models.ForeignKey(FeesGroup, on_delete=models.PROTECT, related_name='fee_types')
    name = models.CharField(max_length=100)
    gl_code = models.CharField(max_length=50)
    taxable = models.CharField(max_length=3, choices=TAXABLE_CHOICES, default='no')
    default_structure = models.CharField(max_length=20, choices=DEFAULT_STRUCTURE_CHOICES, default='term_wise')
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    amount = models.DecimalField(**MONEY_FIELD_KWARGS)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_fee_types',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_fee_types')

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f"{self.fees_group.name} - {self.name}"

    def clean(self):
        super().clean()
        code = (self.gl_code or '').strip().upper()
        if not code:
            raise ValidationError({'gl_code': 'GL Code is required.'})
        if not re.match(r'^[0-9]{4}-[A-Z0-9]+$', code):
            raise ValidationError({'gl_code': 'Invalid GL Code format. Use XXXX-CODE (e.g., 4001-TUITION).'})

        qs = FeesType.objects.filter(is_deleted=False, gl_code=code)
        if self.pk:
            qs = qs.exclude(pk=self.pk)
        if qs.exists():
            raise ValidationError({'gl_code': 'A Fee Type with this GL Code already exists.'})

        account_number = code.split('-')[0]
        account_qs = FeesType.objects.filter(is_deleted=False, gl_code__startswith=f"{account_number}-")
        if self.pk:
            account_qs = account_qs.exclude(pk=self.pk)
        if account_qs.exists():
            raise ValidationError({'gl_code': f'Account number {account_number} is already used by another Fee Type. Use a unique account number.'})

    def save(self, *args, **kwargs):
        if self.gl_code:
            self.gl_code = self.gl_code.strip().upper()
        self.full_clean()
        super().save(*args, **kwargs)

class TermSettings(models.Model):
    """
    Defines term structure for an Academic Year.
    Maps term number, name, dates, and default due date.
    """
    academic_year = models.ForeignKey('core.AcademicYear', on_delete=models.CASCADE, related_name='term_settings')
    term_number = models.PositiveIntegerField(help_text="1, 2, 3, 4 etc.")
    term_name = models.CharField(max_length=100, help_text="e.g. Term 1 (Apr-Jul)")
    start_date = models.DateField()
    end_date = models.DateField()
    default_due_date = models.DateField(help_text="Default fee due date for this term")

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_term_settings')

    class Meta:
        unique_together = ('academic_year', 'term_number')
        ordering = ['term_number']

    def clean(self):
        super().clean()
        if not self.term_name or not self.term_name.strip():
            raise ValidationError({'term_name': 'Term name is required.'})
        if not self.default_due_date:
            raise ValidationError({'default_due_date': 'Default due date is required.'})
        if self.start_date and self.end_date and self.start_date > self.end_date:
            raise ValidationError({'start_date': 'Start date must be before end date.'})
        if self.academic_year and self.default_due_date:
            if not (self.academic_year.start_date <= self.default_due_date <= self.academic_year.end_date):
                raise ValidationError({'default_due_date': 'Due date must fall within the academic year range.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.academic_year} - {self.term_name}"

class FeeSchedule(models.Model):
    """
    Defines collection schedule for a specific Fee Type in a Fee Group.
    Links fee type → collection frequency → due dates per term.
    """
    FREQUENCY_CHOICES = [
        ('monthly', 'Monthly'),
        ('quarterly', 'Quarterly'),
        ('term_wise', 'Term-wise'),
        ('half_yearly', 'Half-Yearly'),
        ('yearly', 'Yearly'),
        ('one_time', 'One-Time'),
        ('custom', 'Custom'),
    ]
    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]

    academic_year = models.ForeignKey('core.AcademicYear', on_delete=models.PROTECT)
    fee_group = models.ForeignKey(FeesGroup, on_delete=models.PROTECT, related_name='schedules', null=True, blank=True)
    fee_type = models.ForeignKey(FeesType, on_delete=models.PROTECT, related_name='schedules')
    
    amount = models.DecimalField(**MONEY_FIELD_KWARGS, help_text="Amount for this schedule")
    collection_frequency = models.CharField(max_length=20, choices=FREQUENCY_CHOICES)
    due_date = models.DateField(help_text="Primary due date for collection")
    late_fee_applicable = models.BooleanField(default=False)
    grace_period = models.PositiveIntegerField(default=0, help_text="Grace period in days")
    late_fee_rule = models.CharField(max_length=255, blank=True, default="", help_text="Late fee rule description")
    term_breakdown = models.JSONField(default=list, blank=True, help_text="Array of term-wise amounts and due dates")
    
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')
    description = models.TextField(blank=True)
    
    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_fee_schedules',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_fee_schedules')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_fee_schedules')

    class Meta:
        ordering = ['-created_at']
        constraints = [
            models.UniqueConstraint(
                fields=['academic_year', 'fee_group', 'fee_type'],
                condition=models.Q(fee_group__isnull=False, is_deleted=False),
                name='unique_schedule_with_group'
            ),
            models.UniqueConstraint(
                fields=['academic_year', 'fee_type'],
                condition=models.Q(fee_group__isnull=True, is_deleted=False),
                name='unique_schedule_without_group'
            ),
        ]

    def clean(self):
        super().clean()
        if not self.fee_type:
            raise ValidationError({'fee_type': 'Fee type is required.'})
        if not self.amount or self.amount <= 0:
            raise ValidationError({'amount': 'Amount must be greater than 0.'})
        if not self.collection_frequency:
            raise ValidationError({'collection_frequency': 'Collection frequency is required.'})
        if not self.due_date:
            raise ValidationError({'due_date': 'Due date is required.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.fee_group} - {self.fee_type} ({self.collection_frequency})"


class ConcessionRule(models.Model):
    """Concession/discount rule configuration for a school academic year."""

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]

    academic_year = models.ForeignKey('core.AcademicYear', on_delete=models.PROTECT, related_name='concession_rules')
    name = models.CharField(max_length=120)
    applies_to = models.CharField(max_length=150, help_text='Scope of concession (e.g., Tuition Fee)')
    discount_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_concession_rules',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_concession_rules')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_concession_rules')

    class Meta:
        unique_together = ('academic_year', 'name')
        ordering = ['name']

    def clean(self):
        super().clean()
        if not self.name or not self.name.strip():
            raise ValidationError({'name': 'Rule name is required.'})
        if self.discount_percentage is None:
            raise ValidationError({'discount_percentage': 'Discount percentage is required.'})
        if self.discount_percentage < 0 or self.discount_percentage > 100:
            raise ValidationError({'discount_percentage': 'Discount percentage must be between 0 and 100.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.name} ({self.discount_percentage}%)"


class LateFeeRule(models.Model):
    """Late fee policy configuration for a school academic year."""

    STATUS_CHOICES = [
        ('active', 'Active'),
        ('inactive', 'Inactive'),
    ]

    academic_year = models.ForeignKey('core.AcademicYear', on_delete=models.PROTECT, related_name='late_fee_rules')
    name = models.CharField(max_length=120)
    grace_period_days = models.PositiveIntegerField(default=0)
    penalty_rule = models.CharField(max_length=255)
    cap_amount = models.DecimalField(max_digits=12, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=10, choices=STATUS_CHOICES, default='active')

    is_deleted = models.BooleanField(default=False)
    deleted_at = models.DateTimeField(null=True, blank=True)
    deleted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='deleted_late_fee_rules',
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_late_fee_rules')
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='updated_late_fee_rules')

    class Meta:
        unique_together = ('academic_year', 'name')
        ordering = ['name']

    def clean(self):
        super().clean()
        if not self.name or not self.name.strip():
            raise ValidationError({'name': 'Rule name is required.'})
        if not self.penalty_rule or not self.penalty_rule.strip():
            raise ValidationError({'penalty_rule': 'Penalty rule is required.'})
        if self.cap_amount is not None and self.cap_amount < 0:
            raise ValidationError({'cap_amount': 'Cap amount cannot be negative.'})

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return self.name

class FeeAssignment(models.Model):
    """
    Assigns a fee type to a student. This is the core "charge" record.
    The status is computed from ledger entries, not stored.
    """
    academic_year = models.ForeignKey('core.AcademicYear', on_delete=models.PROTECT)
    student = models.ForeignKey('students.Student', on_delete=models.PROTECT, related_name='fee_assignments')
    fees_type = models.ForeignKey(FeesType, on_delete=models.PROTECT, related_name='assignments')
    
    due_date = models.DateField()
    amount = models.DecimalField(**MONEY_FIELD_KWARGS, help_text="Original fee amount at time of assignment")
    discount_amount = models.DecimalField(**MONEY_FIELD_KWARGS, default=Decimal('0.00'), help_text="Discount given at time of assignment")
    concession_amount = models.DecimalField(**MONEY_FIELD_KWARGS, default=Decimal('0.00'), help_text="Concession applied after assignment")

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_fee_assignments')

    class Meta:
        ordering = ['-due_date']

    @property
    def status(self) -> str:
        net_amount = self.amount - self.discount_amount - self.concession_amount
        if hasattr(self, '_prefetched_objects_cache') and 'payments' in self._prefetched_objects_cache:
            paid = sum(p.amount_paid for p in self.payments.all() if p.status == 'posted')
        else:
            paid = self.payments.filter(status='posted').aggregate(total=models.Sum('amount_paid'))['total'] or Decimal('0.00')
        
        if paid >= net_amount:
            return 'paid'
        elif paid > Decimal('0.00'):
            return 'partial'
        else:
            return 'unpaid'

    def __str__(self):
        return f"Assignment of {self.fees_type.name} to {self.student}"

class Payment(models.Model):
    """
    A record of a payment received from a student.
    """
    METHOD_CHOICES = [
        ('cash', 'Cash'),
        ('bank', 'Bank Transfer'),
        ('online', 'Online Gateway'),
        ('wallet', 'Wallet'),
        ('cheque', 'Cheque'),
    ]
    STATUS_CHOICES = [
        ('pending_clearance', 'Pending Clearance'),
        ('pending_reconciliation', 'Pending Reconciliation'),
        ('pending_verification', 'Pending Verification'),
        ('posted', 'Posted'),
        ('bounced', 'Bounced'),
        ('reversed', 'Reversed'),
    ]
    
    assignment = models.ForeignKey(FeeAssignment, on_delete=models.PROTECT, related_name='payments')
    student = models.ForeignKey('students.Student', on_delete=models.PROTECT, related_name='fee_payments')
    
    amount_paid = models.DecimalField(**MONEY_FIELD_KWARGS)
    method = models.CharField(max_length=20, choices=METHOD_CHOICES)
    status = models.CharField(max_length=30, choices=STATUS_CHOICES)
    paid_at = models.DateTimeField()
    
    transaction_reference = models.CharField(max_length=255, blank=True, null=True)
    note = models.TextField(blank=True)

    collected_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='collected_payments')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-paid_at']

    def __str__(self):
        return f"Payment of {self.amount_paid} for {self.student} via {self.method}"

class LedgerEntry(models.Model):
    """
    Append-only financial ledger. The source of truth for all balances.
    Rows are never updated or deleted. Corrections are new, reversing entries.
    """
    ENTRY_TYPE_CHOICES = [
        ('charge', 'Fee Charge'),
        ('payment', 'Payment'),
        ('concession', 'Concession'),
        ('reversal', 'Reversal'),
        ('adjustment', 'Adjustment'), # For write-offs, etc.
    ]

    student = models.ForeignKey('students.Student', on_delete=models.PROTECT, related_name='ledger_entries')
    assignment = models.ForeignKey(FeeAssignment, on_delete=models.PROTECT, related_name='ledger_entries', null=True, blank=True)
    payment = models.ForeignKey(Payment, on_delete=models.PROTECT, related_name='ledger_entries', null=True, blank=True)
    
    entry_type = models.CharField(max_length=20, choices=ENTRY_TYPE_CHOICES)
    amount = models.DecimalField(**MONEY_FIELD_KWARGS, help_text="Positive for charges, negative for payments/credits")
    
    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_ledger_entries')
    
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['created_at']
        verbose_name_plural = "Ledger Entries"

    def save(self, *args, **kwargs):
        if self.pk is not None:
            raise ValidationError("Ledger entries cannot be updated.")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise ValidationError("Ledger entries cannot be deleted.")

    def __str__(self):
        return f"Ledger: {self.student} - {self.entry_type} of {self.amount}"

class AuditEvent(models.Model):
    """
    Records significant state changes or actions for auditing purposes.
    """
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT)
    event_type = models.CharField(max_length=100)
    timestamp = models.DateTimeField(auto_now_add=True)
    reason = models.TextField(blank=True)
    
    content_type = models.ForeignKey(ContentType, on_delete=models.CASCADE)
    object_id = models.PositiveIntegerField()
    content_object = GenericForeignKey('content_type', 'object_id')

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        return f"Audit: {self.event_type} by {self.user} at {self.timestamp}"
