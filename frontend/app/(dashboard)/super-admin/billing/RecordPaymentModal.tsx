'use client';

import { useEffect, useMemo, useState } from 'react';
import { X } from 'lucide-react';
import type { Invoice, InvoicePaymentMethod } from '@/types/super-admin';

interface Props {
  invoice: Invoice;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    amount: number;
    paid_on: string;
    method: InvoicePaymentMethod;
    reference_no?: string;
    notes?: string;
  }) => Promise<void> | void;
}

const METHODS: { value: InvoicePaymentMethod; label: string }[] = [
  { value: 'bank_transfer', label: 'Bank Transfer' },
  { value: 'upi', label: 'UPI' },
  { value: 'cheque', label: 'Cheque' },
  { value: 'cash', label: 'Cash' },
  { value: 'razorpay', label: 'Razorpay' },
  { value: 'stripe', label: 'Stripe' },
  { value: 'adjustment', label: 'Adjustment / Credit Note' },
  { value: 'other', label: 'Other' },
];

function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);
}

export default function RecordPaymentModal({ invoice, busy, onClose, onSubmit }: Props) {
  const grandTotal = useMemo(
    () => Number(invoice.tax_breakdown?.grand_total ?? 0),
    [invoice]
  );
  const alreadyPaid = useMemo(() => Number(invoice.paid_amount ?? 0), [invoice]);
  const initialDue = useMemo(() => {
    const d = Number(invoice.due_amount ?? Math.max(grandTotal - alreadyPaid, 0));
    return Math.max(d, 0);
  }, [invoice, grandTotal, alreadyPaid]);

  const [amount, setAmount] = useState<string>(initialDue.toFixed(2));
  const [paidOn, setPaidOn] = useState<string>(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<InvoicePaymentMethod>('bank_transfer');
  const [referenceNo, setReferenceNo] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setAmount(initialDue.toFixed(2));
  }, [initialDue]);

  const numericAmount = Number(amount);
  const willFullySettle = numericAmount >= initialDue - 0.005 && numericAmount > 0;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!numericAmount || numericAmount <= 0) {
      setError('Enter a payment amount greater than 0.');
      return;
    }
    if (numericAmount > initialDue + 0.005) {
      setError(`Amount cannot exceed outstanding ${fmtINR(initialDue)}.`);
      return;
    }
    await onSubmit({
      amount: numericAmount,
      paid_on: paidOn,
      method,
      reference_no: referenceNo.trim() || undefined,
      notes: notes.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onClick={(e) => e.stopPropagation()}
        onSubmit={submit}
        className="w-full max-w-md rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] shadow-xl"
      >
        <div className="flex items-center justify-between border-b border-[var(--bd)] px-5 py-3">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-[var(--ink-3)]">Record Payment</div>
            <div className="text-[14px] font-semibold text-[var(--ink-1)]">{invoice.invoice_number}</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-7 w-7 place-items-center rounded-md text-[var(--ink-3)] hover:bg-[var(--bg-3)]"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-3 px-5 py-4 text-[12.5px]">
          <div className="grid grid-cols-3 gap-2 rounded-lg bg-[var(--bg-2)] p-3 text-center">
            <div>
              <div className="text-[10px] uppercase text-[var(--ink-3)]">Total</div>
              <div className="font-mono font-semibold">{fmtINR(grandTotal)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[var(--ink-3)]">Paid</div>
              <div className="font-mono font-semibold text-emerald-700">{fmtINR(alreadyPaid)}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase text-[var(--ink-3)]">Due</div>
              <div className="font-mono font-semibold text-amber-700">{fmtINR(initialDue)}</div>
            </div>
          </div>

          <label className="block">
            <span className="text-[11px] font-medium text-[var(--ink-2)]">Amount (₹)</span>
            <input
              type="number"
              step="0.01"
              min="0"
              max={initialDue}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded-md border border-[var(--bd)] bg-[var(--bg-1)] px-2 py-1.5 text-[13px] focus:border-[var(--pu)] focus:outline-none"
              required
            />
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">
              {willFullySettle ? 'This will fully settle the invoice (status → Paid).' : 'Partial amount allowed (status → Partially Paid).'}
            </p>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--ink-2)]">Paid on</span>
              <input
                type="date"
                value={paidOn}
                onChange={(e) => setPaidOn(e.target.value)}
                className="mt-1 w-full rounded-md border border-[var(--bd)] bg-[var(--bg-1)] px-2 py-1.5 text-[13px] focus:border-[var(--pu)] focus:outline-none"
                required
              />
            </label>
            <label className="block">
              <span className="text-[11px] font-medium text-[var(--ink-2)]">Method</span>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as InvoicePaymentMethod)}
                className="mt-1 w-full rounded-md border border-[var(--bd)] bg-[var(--bg-1)] px-2 py-1.5 text-[13px] focus:border-[var(--pu)] focus:outline-none"
              >
                {METHODS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="block">
            <span className="text-[11px] font-medium text-[var(--ink-2)]">Reference no. (UTR / cheque / txn)</span>
            <input
              type="text"
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="Optional"
              className="mt-1 w-full rounded-md border border-[var(--bd)] bg-[var(--bg-1)] px-2 py-1.5 text-[13px] focus:border-[var(--pu)] focus:outline-none"
            />
          </label>

          <label className="block">
            <span className="text-[11px] font-medium text-[var(--ink-2)]">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional"
              className="mt-1 w-full rounded-md border border-[var(--bd)] bg-[var(--bg-1)] px-2 py-1.5 text-[13px] focus:border-[var(--pu)] focus:outline-none"
            />
          </label>

          {error && <p className="text-[11.5px] text-rose-600">{error}</p>}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[var(--bd)] px-5 py-3">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="rounded-md border border-[var(--bd)] bg-[var(--bg-1)] px-3 py-1.5 text-[12px] font-medium text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy || initialDue <= 0}
            className="rounded-md bg-[var(--pu)] px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {busy ? 'Recording…' : willFullySettle ? 'Settle invoice' : 'Record partial payment'}
          </button>
        </div>
      </form>
    </div>
  );
}
