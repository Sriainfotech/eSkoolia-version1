from decimal import Decimal

from django.db import transaction
from django.db.models import Sum
from django.db.models.functions import Coalesce
from django.utils.dateparse import parse_date
from rest_framework import permissions, viewsets
from config.pagination import ApiPageNumberPagination
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response

from .models import BankAccount, ChartOfAccount, FundTransfer, LedgerEntry
from .serializers import BankAccountSerializer, ChartOfAccountSerializer, FundTransferSerializer, LedgerEntrySerializer


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


class ChartOfAccountViewSet(SchoolScopedModelViewSet):
    queryset = ChartOfAccount.objects.select_related("school").all()
    serializer_class = ChartOfAccountSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["account_type", "is_active"]
    search_fields = ["code", "name", "description"]
    ordering_fields = ["code", "name", "created_at"]
    permission_codes = {"*": "accounts.chart_of_accounts.view"}


class BankAccountViewSet(SchoolScopedModelViewSet):
    queryset = BankAccount.objects.select_related("school").all()
    serializer_class = BankAccountSerializer
    pagination_class = ApiPageNumberPagination
    filterset_fields = ["is_active", "bank_name"]
    search_fields = ["name", "account_number", "bank_name", "branch"]
    ordering_fields = ["name", "current_balance", "created_at"]
    permission_codes = {
        "*": "accounts.bank_accounts.view",
        "statement": "accounts.bank_accounts.view",
    }

    @action(detail=True, methods=["get"], url_path="statement")
    def statement(self, request, pk=None):
        account = self.get_object()
        start_date_raw = request.query_params.get("start_date")
        end_date_raw = request.query_params.get("end_date")
        start_date = parse_date(start_date_raw) if start_date_raw else None
        end_date = parse_date(end_date_raw) if end_date_raw else None

        if start_date_raw and not start_date:
            raise ValidationError({"start_date": "Invalid start_date. Use YYYY-MM-DD."})
        if end_date_raw and not end_date:
            raise ValidationError({"end_date": "Invalid end_date. Use YYYY-MM-DD."})
        if start_date and end_date and end_date < start_date:
            raise ValidationError({"end_date": "end_date cannot be earlier than start_date."})

        outgoing_qs = account.outgoing_transfers.all()
        incoming_qs = account.incoming_transfers.all()
        if start_date:
            outgoing_qs = outgoing_qs.filter(transfer_date__gte=start_date)
            incoming_qs = incoming_qs.filter(transfer_date__gte=start_date)
        if end_date:
            outgoing_qs = outgoing_qs.filter(transfer_date__lte=end_date)
            incoming_qs = incoming_qs.filter(transfer_date__lte=end_date)

        total_outgoing = outgoing_qs.aggregate(total=Coalesce(Sum("amount"), Decimal("0.00"))).get("total")
        total_incoming = incoming_qs.aggregate(total=Coalesce(Sum("amount"), Decimal("0.00"))).get("total")

        return Response(
            {
                "bank_account_id": account.id,
                "bank_account_name": account.name,
                "range": {"start_date": start_date_raw, "end_date": end_date_raw},
                "incoming_total": str(total_incoming),
                "outgoing_total": str(total_outgoing),
                "net_movement": str(total_incoming - total_outgoing),
                "current_balance": str(account.current_balance),
            }
        )


class LedgerEntryViewSet(SchoolScopedModelViewSet):
    queryset = LedgerEntry.objects.select_related("school", "academic_year", "account", "created_by").all()
    serializer_class = LedgerEntrySerializer
    filterset_fields = ["academic_year", "account", "entry_type", "entry_date"]
    search_fields = ["reference_no", "description", "account__code", "account__name"]
    ordering_fields = ["entry_date", "amount", "created_at"]
    permission_codes = {
        "*": "accounts.ledger_entries.view",
        "summary": "accounts.ledger_entries.view",
        "trial_balance": "accounts.ledger_entries.view",
    }

    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")
        serializer.save(school=school, created_by=user)

    @action(detail=False, methods=["get"], url_path="summary")
    def summary(self, request):
        queryset = self.filter_queryset(self.get_queryset())
        debit_total = (
            queryset.filter(entry_type=LedgerEntry.ENTRY_DEBIT)
            .aggregate(total=Coalesce(Sum("amount"), Decimal("0.00")))
            .get("total")
        )
        credit_total = (
            queryset.filter(entry_type=LedgerEntry.ENTRY_CREDIT)
            .aggregate(total=Coalesce(Sum("amount"), Decimal("0.00")))
            .get("total")
        )
        balance = debit_total - credit_total

        return Response(
            {
                "count": queryset.count(),
                "total_debit": str(debit_total),
                "total_credit": str(credit_total),
                "net_balance": str(balance),
            }
        )

    @action(detail=False, methods=["get"], url_path="trial-balance")
    def trial_balance(self, request):
        queryset = self.filter_queryset(self.get_queryset()).select_related("account")
        account_map = {}

        for entry in queryset:
            item = account_map.setdefault(
                entry.account_id,
                {
                    "account_id": entry.account_id,
                    "account_code": entry.account.code,
                    "account_name": entry.account.name,
                    "account_type": entry.account.account_type,
                    "debit": Decimal("0.00"),
                    "credit": Decimal("0.00"),
                },
            )
            if entry.entry_type == LedgerEntry.ENTRY_DEBIT:
                item["debit"] += entry.amount
            else:
                item["credit"] += entry.amount

        rows = []
        total_debit = Decimal("0.00")
        total_credit = Decimal("0.00")
        for item in account_map.values():
            balance = item["debit"] - item["credit"]
            total_debit += item["debit"]
            total_credit += item["credit"]
            rows.append(
                {
                    "account_id": item["account_id"],
                    "account_code": item["account_code"],
                    "account_name": item["account_name"],
                    "account_type": item["account_type"],
                    "debit": str(item["debit"]),
                    "credit": str(item["credit"]),
                    "balance": str(balance),
                }
            )

        rows = sorted(rows, key=lambda x: (x["account_code"], x["account_name"]))

        return Response(
            {
                "accounts": rows,
                "total_debit": str(total_debit),
                "total_credit": str(total_credit),
                "difference": str(total_debit - total_credit),
            }
        )


class FundTransferViewSet(SchoolScopedModelViewSet):
    queryset = FundTransfer.objects.select_related("school", "from_bank", "to_bank", "created_by").all()
    serializer_class = FundTransferSerializer
    filterset_fields = ["from_bank", "to_bank", "transfer_date"]
    search_fields = ["reference_no", "note", "from_bank__name", "to_bank__name"]
    ordering_fields = ["transfer_date", "amount", "created_at"]
    permission_codes = {"*": "accounts.fund_transfer.view"}

    @transaction.atomic
    def perform_create(self, serializer):
        user = self.request.user
        school = user.school or getattr(self.request, "school", None)
        if not school and not user.is_superuser:
            raise PermissionDenied("School context is required.")

        transfer = serializer.save(school=school, created_by=user)

        from_bank = transfer.from_bank
        to_bank = transfer.to_bank
        amount = transfer.amount

        from_bank.current_balance = from_bank.current_balance - amount
        to_bank.current_balance = to_bank.current_balance + amount
        from_bank.save(update_fields=["current_balance", "updated_at"])
        to_bank.save(update_fields=["current_balance", "updated_at"])
