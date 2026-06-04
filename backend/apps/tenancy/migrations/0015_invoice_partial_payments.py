"""Partial-payment ledger for SuperAdminInvoice.

Adds:
- partially_paid choice on SuperAdminInvoice.status
- paid_amount, due_amount, last_payment_on derived fields
- SuperAdminInvoicePayment ledger table
- Backfill: legacy 'paid' invoices get paid_amount = grand_total + a synthetic
  adjustment payment so historical receipts aren't lost.
"""

from decimal import Decimal

import uuid
from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


def backfill_invoice_totals(apps, schema_editor):
    Invoice = apps.get_model("tenancy", "SuperAdminInvoice")
    Payment = apps.get_model("tenancy", "SuperAdminInvoicePayment")
    for inv in Invoice.objects.all().iterator():
        tb = inv.tax_breakdown or {}
        grand = tb.get("grand_total")
        if grand is None:
            grand = (tb.get("subtotal") or 0) + (tb.get("total_tax") or 0)
        try:
            grand = Decimal(str(grand))
        except Exception:
            grand = Decimal("0")

        if inv.status == "paid":
            inv.paid_amount = grand
            inv.due_amount = Decimal("0")
            inv.last_payment_on = inv.updated_at.date() if inv.updated_at else inv.invoice_date
            Payment.objects.create(
                invoice=inv,
                amount=grand,
                paid_on=inv.last_payment_on or inv.invoice_date,
                method="adjustment",
                reference_no="BACKFILL",
                notes="Auto-created during 0015 migration for historical paid invoice.",
            )
        else:
            inv.paid_amount = Decimal("0")
            inv.due_amount = grand
            inv.last_payment_on = None
        inv.save(update_fields=["paid_amount", "due_amount", "last_payment_on"])


def noop_reverse(apps, schema_editor):
    # Reversing the schema change is enough; data backfill is informational.
    return


class Migration(migrations.Migration):

    dependencies = [
        ("tenancy", "0014_school_llm_enabled"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.AlterField(
            model_name="superadmininvoice",
            name="status",
            field=models.CharField(
                choices=[
                    ("draft", "Draft"),
                    ("sent", "Sent"),
                    ("partially_paid", "Partially Paid"),
                    ("paid", "Paid"),
                    ("overdue", "Overdue"),
                    ("cancelled", "Cancelled"),
                ],
                default="draft",
                db_index=True,
                max_length=16,
            ),
        ),
        migrations.AddField(
            model_name="superadmininvoice",
            name="paid_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="superadmininvoice",
            name="due_amount",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
        migrations.AddField(
            model_name="superadmininvoice",
            name="last_payment_on",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.CreateModel(
            name="SuperAdminInvoicePayment",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("amount", models.DecimalField(decimal_places=2, max_digits=12)),
                ("paid_on", models.DateField(db_index=True)),
                (
                    "method",
                    models.CharField(
                        choices=[
                            ("bank_transfer", "Bank Transfer"),
                            ("upi", "UPI"),
                            ("cheque", "Cheque"),
                            ("cash", "Cash"),
                            ("razorpay", "Razorpay"),
                            ("stripe", "Stripe"),
                            ("adjustment", "Adjustment / Credit Note"),
                            ("other", "Other"),
                        ],
                        default="bank_transfer",
                        max_length=24,
                    ),
                ),
                ("reference_no", models.CharField(blank=True, max_length=128)),
                ("notes", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                (
                    "invoice",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="payments",
                        to="tenancy.superadmininvoice",
                    ),
                ),
                (
                    "received_by",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        related_name="+",
                        to=settings.AUTH_USER_MODEL,
                    ),
                ),
            ],
            options={
                "db_table": "super_admin_invoice_payments",
                "ordering": ["-paid_on", "-created_at"],
                "indexes": [
                    models.Index(fields=["invoice", "paid_on"], name="sa_inv_pay_inv_paid_idx"),
                ],
            },
        ),
        migrations.RunPython(backfill_invoice_totals, noop_reverse),
    ]
