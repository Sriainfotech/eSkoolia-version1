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
    academic_year = models.ForeignKey('core.AcademicYear', on_delete=models.PROTECT)
    fees_group = models.ForeignKey(FeesGroup, on_delete=models.PROTECT, related_name='fee_types')
    name = models.CharField(max_length=100)
    amount = models.DecimalField(**MONEY_FIELD_KWARGS)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)

    created_at = models.DateTimeField(auto_now_add=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name='created_fee_types')

    class Meta:
        unique_together = ('fees_group', 'name')
        ordering = ['name']

    def __str__(self):
        return f"{self.fees_group.name} - {self.name}"

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
