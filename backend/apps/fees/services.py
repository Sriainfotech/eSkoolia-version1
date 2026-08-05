from decimal import Decimal
from django.db import models, transaction
from django.contrib.auth import get_user_model
from django.contrib.auth.models import AbstractBaseUser
from django.utils import timezone

from .models import FeeAssignment, Payment, LedgerEntry, AuditEvent, FeesType, FeesGroup
from apps.students.models import Student

User = get_user_model()

class FeeServiceError(Exception):
    """Custom exception for fee service errors."""
    pass

class FeeService:
    """
    Encapsulates business logic for the fees module.
    All database-mutating functions are decorated with @transaction.atomic.
    """

    @staticmethod
    def _create_ledger_entry(
        student: Student,
        entry_type: str,
        amount: Decimal,
        created_by: AbstractBaseUser,
        assignment: FeeAssignment | None = None,
        payment: Payment | None = None,
        notes: str = ""
    ) -> LedgerEntry:
        """Private helper to create a ledger entry."""
        if not isinstance(amount, Decimal):
            raise FeeServiceError("Amount for ledger entry must be a Decimal.")
        
        entry = LedgerEntry.objects.create(
            student=student,
            assignment=assignment,
            payment=payment,
            entry_type=entry_type,
            amount=amount,
            created_by=created_by,
            notes=notes,
        )
        return entry

    @staticmethod
    def _create_audit_event(
        user: AbstractBaseUser,
        event_type: str,
        instance,
        reason: str = ""
    ) -> AuditEvent:
        """Private helper to create an audit event."""
        event = AuditEvent.objects.create(
            user=user,
            event_type=event_type,
            content_object=instance,
            reason=reason,
        )
        return event

    @staticmethod
    @transaction.atomic
    def assign_fees(
        *,
        student: Student,
        fees_type: FeesType,
        due_date,
        amount: Decimal,
        discount_amount: Decimal,
        concession_amount: Decimal = Decimal('0.00'),
        created_by: AbstractBaseUser,
        academic_year,
        reason: str = "",
    ) -> FeeAssignment:
        """
        Assigns a fee to a student, creating the charge and concession ledger entries.
        """
        assignment = FeeAssignment.objects.create(
            academic_year=academic_year,
            student=student,
            fees_type=fees_type,
            due_date=due_date,
            amount=amount,
            discount_amount=discount_amount,
            concession_amount=concession_amount,
            created_by=created_by,
        )

        # 1. Create the main 'charge' ledger entry for the full amount.
        FeeService._create_ledger_entry(
            student=student,
            assignment=assignment,
            entry_type='charge',
            amount=amount,
            created_by=created_by,
            notes=f"Fee assigned: {fees_type.name}"
        )

        # 2. If there's a discount, create a negative 'concession' entry.
        if discount_amount > Decimal("0.00"):
            FeeService._create_ledger_entry(
                student=student,
                assignment=assignment,
                entry_type='concession',
                amount=-discount_amount,
                created_by=created_by,
                notes="Discount at time of assignment."
            )

        # 3. If there's a concession amount, create a negative 'concession' entry.
        if concession_amount > Decimal("0.00"):
            FeeService._create_ledger_entry(
                student=student,
                assignment=assignment,
                entry_type='concession',
                amount=-concession_amount,
                created_by=created_by,
                notes="Concession at time of assignment."
            )
        
        default_reason = f"Assigned {fees_type.name} to {student}."
        FeeService._create_audit_event(
            user=created_by,
            event_type="fee.assigned",
            instance=assignment,
            reason=f"{default_reason} {reason}".strip() if reason else default_reason,
        )

        return assignment

    @staticmethod
    @transaction.atomic
    def post_payment(
        *,
        assignment: FeeAssignment,
        amount_paid: Decimal,
        method: str,
        collected_by: AbstractBaseUser,
        paid_at=None,
        transaction_reference: str = "",
        note: str = ""
    ) -> Payment:
        """
        Creates a Payment record and its corresponding ledger entry if settled.
        """
        if paid_at is None:
            paid_at = timezone.now()

        # Determine initial status based on payment method
        initial_status_map = {
            'cash': 'posted',
            'wallet': 'posted',
            'bank': 'pending_reconciliation',
            'online': 'pending_verification',
            'cheque': 'pending_clearance',
        }
        initial_status = initial_status_map.get(method)
        if not initial_status:
            raise FeeServiceError(f"Invalid payment method: {method}")

        payment = Payment.objects.create(
            assignment=assignment,
            student=assignment.student,
            amount_paid=amount_paid,
            method=method,
            status=initial_status,
            paid_at=paid_at,
            transaction_reference=transaction_reference,
            note=note,
            collected_by=collected_by,
        )

        # Only create a ledger entry for immediately settled payments.
        # Others will get a ledger entry upon transition to 'posted'.
        if initial_status == 'posted':
            FeeService._create_ledger_entry(
                student=payment.student,
                assignment=assignment,
                payment=payment,
                entry_type='payment',
                amount=-amount_paid,
                created_by=collected_by,
                notes=f"Payment received via {method}."
            )

        FeeService._create_audit_event(
            user=collected_by,
            event_type="payment.posted",
            instance=payment,
            reason=f"Payment of {amount_paid} recorded via {method}."
        )
        
        return payment

    @staticmethod
    @transaction.atomic
    def transition_payment(
        *,
        payment: Payment,
        to_status: str,
        user: AbstractBaseUser,
        reason: str = ""
    ) -> Payment:
        """
        Transitions a payment to a new status, handling ledger entries for settlement or reversal.
        """
        from_status = payment.status
        
        # Define legal state transitions
        allowed_transitions = {
            'pending_clearance': ['posted', 'bounced'],
            'pending_reconciliation': ['posted', 'reversed'],
            'pending_verification': ['posted', 'reversed'],
            'posted': ['reversed'], # e.g., a chargeback
        }

        if to_status not in allowed_transitions.get(from_status, []):
            raise FeeServiceError(f"Illegal status transition from '{from_status}' to '{to_status}'.")

        is_settling = to_status == 'posted' and from_status != 'posted'
        is_reversing = to_status in ['bounced', 'reversed']

        payment.status = to_status
        payment.save()

        # If a payment is settling now, create the negative 'payment' ledger entry.
        if is_settling:
            FeeService._create_ledger_entry(
                student=payment.student,
                assignment=payment.assignment,
                payment=payment,
                entry_type='payment',
                amount=-payment.amount_paid,
                created_by=user,
                notes="Payment cleared/reconciled."
            )
        
        # If a previously settled payment is now reversing, create a positive 'reversal' entry.
        if is_reversing and from_status == 'posted':
            FeeService._create_ledger_entry(
                student=payment.student,
                assignment=payment.assignment,
                payment=payment,
                entry_type='reversal',
                amount=payment.amount_paid, # Positive amount to offset the original payment
                created_by=user,
                notes=f"Payment bounced or reversed. Reason: {reason}"
            )

        FeeService._create_audit_event(
            user=user,
            event_type=f"payment.transitioned.{to_status}",
            instance=payment,
            reason=reason
        )

        return payment

    @staticmethod
    def student_balance(*, student: Student) -> Decimal:
        """
        Calculates the total outstanding balance for a single student by summing their ledger entries.
        This is the ONLY source of truth for a student's balance.
        """
        balance = LedgerEntry.objects.filter(student=student).aggregate(
            balance=models.Sum('amount')
        )['balance'] or Decimal('0.00')
        return balance

    @staticmethod
    @transaction.atomic
    def carry_forward_dues(
        *,
        from_academic_year,
        to_academic_year,
        due_date,
        user: AbstractBaseUser
    ) -> dict:
        """
        Carries forward outstanding dues from one academic year to a new one.
        It creates a single new "Previous Dues" assignment in the target year.
        """
        students_with_dues = Student.objects.filter(
            fee_assignments__academic_year=from_academic_year
        ).distinct()

        created_count = 0
        total_amount_carried = Decimal("0.00")

        # Get or create a "Previous Dues" fee type in the target year
        # This assumes a 'General' fees group exists.
        general_group, _ = FeesGroup.objects.get_or_create(
            academic_year=to_academic_year, 
            name='General', 
            defaults={'created_by': user}
        )
        previous_dues_type, _ = FeesType.objects.get_or_create(
            academic_year=to_academic_year,
            fees_group=general_group,
            name="Previous Year Dues",
            defaults={'amount': Decimal('0.00'), 'created_by': user}
        )

        for student in students_with_dues:
            balance = FeeService.student_balance(student=student)
            
            # We only carry forward positive balances (money owed by the student)
            if balance > Decimal("0.00"):
                # Create a single new assignment for the total outstanding balance
                FeeService.assign_fees(
                    student=student,
                    fees_type=previous_dues_type,
                    due_date=due_date,
                    amount=balance,
                    discount_amount=Decimal("0.00"),
                    created_by=user,
                    academic_year=to_academic_year,
                )
                created_count += 1
                total_amount_carried += balance
        
        return {
            "message": "Carry forward operation completed.",
            "students_processed": students_with_dues.count(),
            "assignments_created": created_count,
            "total_amount_carried": str(total_amount_carried),
        }
