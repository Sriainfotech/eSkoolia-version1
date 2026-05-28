'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Ban,
  Check,
  CheckCircle2,
  Download,
  Edit3,
  Eye,
  ExternalLink,
  FileText,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import {
  cancelInvoice,
  deletePlan,
  downloadFile,
  exportGstr1,
  getInvoices,
  getMrr,
  getPlans,
  markInvoicePaid,
} from '@/lib/api/super-admin/billing';
import type {
  Invoice,
  InvoiceStatus,
  MrrData,
  PaginatedResponse,
  PlansCatalog,
  SubscriptionPlan,
} from '@/types/super-admin';
import NewInvoiceDrawer from './NewInvoiceDrawer';
import NewPlanDrawer from './NewPlanDrawer';

// -- Formatting ----------------------------------------------------------------
function fmtINR(n: number, opts?: { compact?: boolean; symbol?: boolean; fraction?: number }) {
  const symbol = opts?.symbol !== false;
  if (opts?.compact) {
    // Indian style L / Cr abbreviations
    const abs = Math.abs(n);
    if (abs >= 1_00_00_000) return `${symbol ? '₹' : ''}${(n / 1_00_00_000).toFixed(2)}Cr`;
    if (abs >= 1_00_000) return `${symbol ? '₹' : ''}${(n / 1_00_000).toFixed(2)}L`;
    if (abs >= 1_000) return `${symbol ? '₹' : ''}${(n / 1_000).toFixed(0)}K`;
    return `${symbol ? '₹' : ''}${n.toFixed(0)}`;
  }
  const fraction = opts?.fraction ?? 2;
  return `${symbol ? '₹ ' : ''}${new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(n)}`;
}

function fmtDate(iso?: string) {
  if (!iso) return '\u2014';
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function isInterState(invoice: Invoice) {
  // Normalise state codes ("29") to names ("Karnataka") for backward-compat
  // with invoices that stored the numeric state code rather than the name.
  const codeMap: Record<string, string> = {
    '37': 'andhra pradesh', '12': 'arunachal pradesh', '18': 'assam', '10': 'bihar',
    '22': 'chhattisgarh', '07': 'delhi', '30': 'goa', '24': 'gujarat', '06': 'haryana',
    '02': 'himachal pradesh', '20': 'jharkhand', '29': 'karnataka', '32': 'kerala',
    '23': 'madhya pradesh', '27': 'maharashtra', '21': 'odisha', '03': 'punjab',
    '08': 'rajasthan', '11': 'sikkim', '33': 'tamil nadu', '36': 'telangana',
    '16': 'tripura', '09': 'uttar pradesh', '05': 'uttarakhand', '19': 'west bengal',
  };
  const norm = (s?: string) => {
    const t = (s ?? '').trim();
    return (codeMap[t] ?? t).toLowerCase();
  };
  return norm(invoice.seller_state) !== norm(invoice.buyer_state);
}

function stateCode(name?: string): string {
  if (!name) return '';
  const map: Record<string, string> = {
    'andhra pradesh': '37',
    'arunachal pradesh': '12',
    'assam': '18',
    'bihar': '10',
    'chhattisgarh': '22',
    'delhi': '07',
    'goa': '30',
    'gujarat': '24',
    'haryana': '06',
    'himachal pradesh': '02',
    'jharkhand': '20',
    'karnataka': '29',
    'kerala': '32',
    'madhya pradesh': '23',
    'maharashtra': '27',
    'odisha': '21',
    'punjab': '03',
    'rajasthan': '08',
    'sikkim': '11',
    'tamil nadu': '33',
    'telangana': '36',
    'tripura': '16',
    'uttar pradesh': '09',
    'uttarakhand': '05',
    'west bengal': '19',
  };
  return map[name.trim().toLowerCase()] ?? '';
}

// -- Sparkline -----------------------------------------------------------------
function Spark({ data, color = 'var(--pu)' }: { data: number[]; color?: string }) {
  if (!data || data.length < 2) {
    return <svg width={68} height={22} />;
  }
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 68;
  const H = 22;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * (H - 2) - 1;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  return (
    <svg width={W} height={H} className="overflow-visible">
      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

// -- KPI Card ------------------------------------------------------------------
function KpiCard({
  label,
  value,
  trend,
  trendTone = 'up',
  footnote,
  spark,
  sparkColor,
}: {
  label: string;
  value: string;
  trend?: string;
  trendTone?: 'up' | 'down' | 'neutral';
  footnote?: string;
  spark?: number[];
  sparkColor?: string;
}) {
  const trendColor =
    trendTone === 'down' ? 'text-[var(--danger)]' : trendTone === 'neutral' ? 'text-[var(--ink-3)]' : 'text-emerald-600';
  return (
    <div className="rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] px-4 py-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">{label}</span>
        {spark && <Spark data={spark} color={sparkColor} />}
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="sa-kpi-value text-[28px] leading-none text-[var(--ink-1)]">{value}</span>
        {trend && <span className={`text-xs font-semibold ${trendColor}`}>{trend}</span>}
      </div>
      {footnote && <div className="mt-2 text-[11.5px] text-[var(--ink-3)]">{footnote}</div>}
    </div>
  );
}

// -- Plan Card -----------------------------------------------------------------
function PlanCard({
  plan,
  onEdit,
  onDelete,
}: {
  plan: SubscriptionPlan;
  onEdit: (p: SubscriptionPlan) => void;
  onDelete: (p: SubscriptionPlan) => void;
}) {
  return (
    <div
      className={`group relative rounded-2xl border p-4 ${
        plan.popular
          ? 'border-[var(--pu)] bg-[var(--pu-tint)]'
          : 'border-[var(--bd)] bg-[var(--bg-1)]'
      }`}
    >
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
        <button
          type="button"
          title="Edit plan"
          aria-label="Edit plan"
          onClick={() => onEdit(plan)}
          className="grid h-7 w-7 place-items-center rounded-md border border-[var(--bd)] bg-[var(--bg-1)] text-[var(--ink-2)] shadow-sm hover:bg-[var(--bg-3)]"
        >
          <Edit3 className="h-3 w-3" />
        </button>
        <button
          type="button"
          title="Delete plan"
          aria-label="Delete plan"
          onClick={() => onDelete(plan)}
          className="grid h-7 w-7 place-items-center rounded-md border border-[var(--bd)] bg-[var(--bg-1)] text-[var(--danger)] shadow-sm hover:bg-red-50"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
      <div className="flex items-start justify-between pr-16">
        <p className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-2)]">
          {plan.name}
        </p>
        {plan.popular && (
          <span className="rounded-full bg-[var(--pu)] px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white">
            Popular
          </span>
        )}
      </div>
      <p className="mt-2 sa-kpi-value text-[26px] leading-none text-[var(--ink-1)]">
        {fmtINR(plan.price_inr, { fraction: 0 })}
        <span className="sa-kpi-value text-[12px] font-medium text-[var(--ink-3)]">/mo</span>
      </p>
      <p className="mt-2 text-[11.5px] leading-snug text-[var(--ink-2)]">{plan.description}</p>
    </div>
  );
}

// -- Status Chip ---------------------------------------------------------------
const STATUS_META: Record<InvoiceStatus, { label: string; dot: string; text: string }> = {
  draft: { label: 'Draft', dot: 'bg-[var(--ink-3)]', text: 'text-[var(--ink-2)]' },
  sent: { label: 'Sent', dot: 'bg-amber-500', text: 'text-amber-700' },
  paid: { label: 'Paid', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  overdue: { label: 'Overdue', dot: 'bg-[var(--danger)]', text: 'text-[var(--danger)]' },
  cancelled: { label: 'Cancelled', dot: 'bg-[var(--ink-3)]', text: 'text-[var(--ink-3)]' },
};

function StatusChip({ status, daysOverdue }: { status: InvoiceStatus; daysOverdue?: number }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  const label = status === 'overdue' && daysOverdue ? `${m.label} � ${daysOverdue}d` : m.label;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {label}
    </span>
  );
}

// -- Tax Logic Pill ------------------------------------------------------------
function Pill({ children, tone = 'default' }: { children: React.ReactNode; tone?: 'default' | 'purple' }) {
  const cls =
    tone === 'purple'
      ? 'bg-[var(--pu-tint)] text-[var(--pu-deep)]'
      : 'bg-[var(--bg-3)] text-[var(--ink-2)]';
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-[10.5px] font-semibold ${cls}`}>
      {children}
    </span>
  );
}

// -- Amount in words (Indian) -------------------------------------------------
function amountInWords(num: number): string {
  if (!num || num <= 0) return 'Zero';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  const teens = [
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  function two(n: number): string {
    if (n < 10) return ones[n] || '';
    if (n < 20) return teens[n - 10] || '';
    const t = Math.floor(n / 10);
    const o = n % 10;
    return `${tens[t]}${o ? ' ' + ones[o] : ''}`;
  }
  function three(n: number): string {
    const h = Math.floor(n / 100);
    const r = n % 100;
    return `${h ? ones[h] + ' Hundred' + (r ? ' ' : '') : ''}${two(r)}`;
  }
  const whole = Math.floor(num);
  const paise = Math.round((num - whole) * 100);
  const crore = Math.floor(whole / 10000000);
  const lakh = Math.floor((whole % 10000000) / 100000);
  const thousand = Math.floor((whole % 100000) / 1000);
  const rest = whole % 1000;
  let s = '';
  if (crore) s += `${two(crore)} Crore `;
  if (lakh) s += `${two(lakh)} Lakh `;
  if (thousand) s += `${two(thousand)} Thousand `;
  if (rest) s += three(rest);
  s = s.trim() || 'Zero';
  let words = `Indian Rupees ${s} Only`;
  if (paise) words = `Indian Rupees ${s} and ${two(paise)} Paise Only`;
  return words;
}

// -- Tax Invoice Card ----------------------------------------------------------
function TaxInvoiceCard({
  invoice,
  sellerGstin,
  sellerState,
  onMarkPaid,
  onDownloadPdf,
  onEdit,
  onCancel,
  actionBusy,
}: {
  invoice: Invoice | null;
  sellerGstin: string;
  sellerState: string;
  onMarkPaid: () => void;
  onDownloadPdf: () => void;
  onEdit: () => void;
  onCancel: () => void;
  actionBusy: boolean;
}) {
  if (!invoice) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--bd)] bg-[var(--bg-1)] p-10 text-center text-sm text-[var(--ink-3)]">
        No invoice selected. Click a row in &ldquo;Recent invoices&rdquo; to preview it here.
      </div>
    );
  }
  const inter = isInterState(invoice);
  const tax = invoice.tax_breakdown || ({} as Invoice['tax_breakdown']);
  const sellerCode = stateCode(sellerState || invoice.seller_state);
  const buyerCode = stateCode(invoice.buyer_state);
  const amountWords = tax.amount_in_words || amountInWords(Number(tax.grand_total || 0));

  return (
    <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
      {/* Print stylesheet: hide everything except the invoice body when printing.
          The browser print dialog allows saving as PDF (Download PDF action). */}
      <style jsx global>{`
        @media print {
          body * { visibility: hidden !important; }
          #invoice-printable, #invoice-printable * { visibility: visible !important; }
          #invoice-printable {
            position: absolute !important;
            inset: 0 !important;
            width: 100% !important;
            border: none !important;
            box-shadow: none !important;
            padding: 24px !important;
          }
        }
      `}</style>
      {/* LEFT: Invoice body (2/3) */}
      <div
        id="invoice-printable"
        className={`relative overflow-hidden rounded-2xl border bg-[var(--bg-1)] px-6 pb-5 pt-5 xl:col-span-2 ${
          invoice.status === 'cancelled' ? 'border-rose-300' : 'border-[var(--bd)]'
        }`}
      >
        {invoice.status === 'cancelled' && (
          <>
            {/* Diagonal CANCELLED watermark (hidden in print to avoid obscuring archive copy) */}
            <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center print:hidden">
              <span className="-rotate-12 select-none rounded-md border-4 border-rose-300/80 px-6 py-2 font-serif text-[64px] font-black uppercase tracking-widest text-rose-400/40">
                Cancelled
              </span>
            </div>
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[11.5px] text-rose-700">
              <Ban className="h-3.5 w-3.5" />
              <span>
                This invoice has been <span className="font-semibold">cancelled</span> and is kept for audit. Create a new invoice to re-bill.
              </span>
            </div>
          </>
        )}
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-serif text-[28px] leading-tight text-[var(--ink-1)]">Tax Invoice</h3>
            <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-3)]">
              Original for recipient
            </p>
          </div>
          <div className="flex items-start gap-2">
            <span className="mt-1 inline-flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#7C5BFF] to-[#5836E0] text-[12px] font-bold text-white">
              e
            </span>
            <div className="text-right">
              <p className="text-[13px] font-semibold text-[var(--ink-1)]">{invoice.seller_name || 'Eskoolia Technologies Pvt Ltd'}</p>
              <p className="text-[10.5px] leading-snug text-[var(--ink-3)]">
                12th Floor, Bagmane Tech Park,<br />
                CV Raman Nagar, Bengaluru,<br />
                {sellerState || invoice.seller_state} 560048 � India
              </p>
              <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">
                GSTIN <span className="font-mono text-[var(--ink-2)]">{sellerGstin || invoice.seller_gstin || '�'}</span>
              </p>
            </div>
          </div>
        </div>

        <hr className="my-4 border-[var(--bd)]" />

        {/* Billed to / Invoice details / Place of supply */}
        <div className="grid grid-cols-3 gap-5 text-[12px]">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Billed to</p>
            <p className="mt-1 text-[13px] font-semibold text-[var(--ink-1)]">{invoice.buyer_name || invoice.school_name}</p>
            <p className="text-[11px] leading-snug text-[var(--ink-3)]">{invoice.buyer_state}</p>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">
              GSTIN <span className="font-mono text-[var(--ink-2)]">{invoice.buyer_gstin || 'Unregistered'}</span>
            </p>
            {invoice.tenant_id && (
              <p className="text-[10.5px] text-[var(--ink-3)]">
                Tenant <span className="font-mono text-[var(--ink-2)]">{invoice.tenant_id}</span>
              </p>
            )}
          </div>
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Invoice details</p>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">Invoice no.</p>
            <p className="font-mono text-[12px] font-semibold text-[var(--ink-1)]">{invoice.invoice_number}</p>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">Invoice date</p>
            <p className="text-[12px] font-semibold text-[var(--ink-1)]">{fmtDate(invoice.invoice_date)}</p>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">
              Due date <span className="ml-1 text-[var(--ink-1)]">{fmtDate(invoice.due_date)}</span>
            </p>
          </div>
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Place of supply</p>
            <p className="mt-1 text-[12px] font-semibold text-[var(--ink-1)]">
              {buyerCode && <span className="font-mono text-[var(--ink-3)]">{buyerCode} � </span>}
              {invoice.buyer_state}
            </p>
            <p className="text-[11px] text-[var(--ink-3)]">{inter ? 'Inter-state supply' : 'Intra-state supply'}</p>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">
              Reverse charge <span className="text-[var(--ink-1)]">— {invoice.reverse_charge ? 'Yes' : 'No'}</span>
            </p>
            <p className="text-[10.5px] text-[var(--ink-3)]">
              Currency <span className="text-[var(--ink-1)]">� INR</span>
            </p>
          </div>
        </div>

        {/* Line items */}
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">
                <th className="pb-2 text-left">Description</th>
                <th className="pb-2 text-right">SAC</th>
                <th className="pb-2 text-right">Qty</th>
                <th className="pb-2 text-right">Rate (₹)</th>
                <th className="pb-2 text-right">Amount (₹)</th>
              </tr>
            </thead>
            <tbody>
              {invoice.line_items?.map((item, i) => (
                <tr key={i} className="align-top">
                  <td className="py-2.5">
                    <p className="text-[13px] font-medium text-[var(--ink-1)]">{item.description}</p>
                  </td>
                  <td className="py-2.5 text-right font-mono text-[var(--ink-2)]">{item.sac_code}</td>
                  <td className="py-2.5 text-right text-[var(--ink-2)]">{item.quantity}</td>
                  <td className="py-2.5 text-right text-[var(--ink-2)]">{fmtINR(Number(item.unit_price), { symbol: false })}</td>
                  <td className="py-2.5 text-right font-medium text-[var(--ink-1)]">{fmtINR(Number(item.amount), { symbol: false })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals */}
        <div className="mt-3 grid grid-cols-2">
          <div />
          <div className="space-y-1 text-[12px]">
            <Row label="Subtotal" value={fmtINR(Number(tax.subtotal || 0))} />
            <Row label="Discount" value={fmtINR(0)} />
            <Row label="Taxable value" value={fmtINR(Number(tax.subtotal || 0))} />
            {inter ? (
              <Row label="IGST @ 18%" value={fmtINR(Number(tax.igst || 0))} />
            ) : (
              <>
                <Row label="CGST @ 9%" value={fmtINR(Number(tax.cgst || 0))} />
                <Row label="SGST @ 9%" value={fmtINR(Number(tax.sgst || 0))} />
              </>
            )}
            <Row label="Round off" value={fmtINR(0)} />
            <div className="flex items-center justify-between border-t border-[var(--bd)] pt-2 text-[13px] font-bold text-[var(--ink-1)]">
              <span>Total payable</span>
              <span>{fmtINR(Number(tax.grand_total || 0))}</span>
            </div>
          </div>
        </div>

        {/* Amount in words */}
        <div className="mt-4 rounded-lg bg-[var(--bg-3)] px-3 py-2 text-[11.5px] text-[var(--ink-2)]">
          <span className="italic">Amount in words � </span>
          <span className="font-semibold text-[var(--ink-1)]">{amountWords}</span>
        </div>

        {/* Payment terms + Notes */}
        <div className="mt-4 grid grid-cols-2 gap-5 text-[11px] text-[var(--ink-3)]">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.1em]">Payment terms</p>
            <p className="mt-1 leading-snug">
              Payable within 15 days of invoice date. Bank transfer to{' '}
              <Pill>HDFC 0000123456789</Pill> � IFSC <Pill>HDFC0001234</Pill> � A/c name Eskoolia
              Technologies Pvt Ltd � UPI <Pill>eskoolia@hdfcbank</Pill> � Reference{' '}
              <Pill>{invoice.invoice_number}</Pill> in remittance.
            </p>
          </div>
          <div className="text-right">
            <p className="mt-1 text-[11px] text-[var(--ink-3)]">For {invoice.seller_name || 'Eskoolia Technologies Pvt Ltd'}</p>
            <p className="text-[12px] font-bold text-[var(--ink-1)]">Authorised Signatory</p>
          </div>
        </div>

        <div className="mt-3 text-[11px] text-[var(--ink-3)]">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em]">Notes</p>
          <p className="mt-1 leading-snug">
            Whether tax payable under reverse charge — {invoice.reverse_charge ? 'Yes' : 'No'}. This is a computer-generated invoice; signature not required if digitally signed.
          </p>
        </div>
      </div>

      {/* RIGHT: GST breakdown + Tax logic + Actions */}
      <div className="space-y-3 xl:col-span-1">
        {/* GST Breakdown */}
        <div className="rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] p-4">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">GST breakdown</p>
          <div className="mt-3 space-y-2 text-[12px]">
            <Row label="Taxable value" value={fmtINR(Number(tax.subtotal || 0))} />
            {inter ? (
              <Row label="IGST � 18%" value={fmtINR(Number(tax.igst || 0))} />
            ) : (
              <>
                <Row label="CGST � 9%" value={fmtINR(Number(tax.cgst || 0))} />
                <Row label="SGST � 9%" value={fmtINR(Number(tax.sgst || 0))} />
              </>
            )}
            <div className="flex items-center justify-between border-t border-[var(--bd)] pt-2">
              <span className="font-semibold text-[var(--ink-1)]">Total invoice</span>
              <span className="font-bold text-emerald-600">{fmtINR(Number(tax.grand_total || 0))}</span>
            </div>
          </div>
        </div>

        {/* Tax Logic Applied */}
        <div className="rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] p-4">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Tax logic applied</p>
          <div className="mt-3 space-y-1.5 text-[11.5px]">
            <LogicRow label="Seller state" right={<><Pill>{sellerCode || '�'}</Pill> <span className="ml-1 text-[var(--ink-2)]">{sellerState || invoice.seller_state}</span></>} />
            <LogicRow label="Buyer state" right={<><Pill>{buyerCode || '�'}</Pill> <span className="ml-1 text-[var(--ink-2)]">{invoice.buyer_state}</span></>} />
            <LogicRow label="Supply type" right={<span className="font-semibold text-[var(--ink-1)]">{inter ? 'Inter-state' : 'Intra-state'}</span>} />
            <LogicRow label="Applied" right={<span className="font-semibold text-[var(--ink-1)]">{inter ? 'IGST' : 'CGST + SGST'}</span>} />
            <LogicRow label="SAC" right={<><Pill>998313</Pill> <span className="ml-1 text-[var(--ink-2)]">Education software</span></>} />
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] p-4">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Invoice actions</p>
          <div className="mt-3 grid grid-cols-1 gap-1.5">
            <ActionRow icon={<Download className="h-3.5 w-3.5" />} label="Download PDF" onClick={onDownloadPdf} />
            <ActionRow
              icon={<ExternalLink className="h-3.5 w-3.5" />}
              label="Send to buyer"
              disabled={invoice.status === 'cancelled'}
              onClick={() => toast.info('Send to buyer coming soon')}
            />
            <ActionRow
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label={actionBusy ? 'Updating…' : 'Mark as paid'}
              disabled={actionBusy || invoice.status === 'paid' || invoice.status === 'cancelled'}
              onClick={onMarkPaid}
            />
            <ActionRow
              icon={<Edit3 className="h-3.5 w-3.5" />}
              label="Edit invoice"
              disabled={invoice.status === 'paid' || invoice.status === 'cancelled'}
              onClick={onEdit}
            />
            <ActionRow
              icon={<Ban className="h-3.5 w-3.5" />}
              label={actionBusy ? 'Cancelling…' : 'Cancel invoice'}
              disabled={actionBusy || invoice.status === 'paid' || invoice.status === 'cancelled'}
              onClick={onCancel}
              variant="danger"
            />
          </div>
          {invoice.status === 'paid' && (
            <p className="mt-2 text-[10.5px] leading-snug text-[var(--ink-3)]">
              Paid invoices cannot be cancelled. Issue a credit note to reverse a paid invoice.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--ink-3)]">{label}</span>
      <span className="font-mono text-[12px] text-[var(--ink-1)]">{value}</span>
    </div>
  );
}

function LogicRow({ label, right }: { label: string; right: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[var(--ink-3)]">{label}</span>
      <span className="flex items-center">{right}</span>
    </div>
  );
}

function ActionRow({
  icon,
  label,
  onClick,
  disabled,
  variant = 'default',
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'default' | 'danger';
}) {
  const isDanger = variant === 'danger';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex w-full items-center gap-2 rounded-xl border px-3 py-2 text-[12px] font-medium transition-colors disabled:opacity-40 ${
        isDanger
          ? 'border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:hover:bg-rose-50'
          : 'border-[var(--bd)] bg-[var(--bg-1)] text-[var(--ink-1)] hover:bg-[var(--bg-3)]'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// -- ConfirmDialog ------------------------------------------------------------
interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: 'danger' | 'default';
  onConfirm: () => void;
}

function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  variant = 'default',
  onConfirm,
  onCancel,
}: ConfirmOptions & { open: boolean; onCancel: () => void }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onCancel}
        aria-hidden
      />
      {/* Card */}
      <div className="relative w-full max-w-sm rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] p-6 shadow-2xl">
        <h2 className="text-[15px] font-semibold text-[var(--ink-1)]">{title}</h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[var(--ink-2)]">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-[var(--bd)] bg-[var(--bg-1)] px-4 py-2 text-[13px] font-medium text-[var(--ink-2)] hover:bg-[var(--bg-3)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { onConfirm(); onCancel(); }}
            className={`rounded-lg px-4 py-2 text-[13px] font-semibold text-white ${
              variant === 'danger'
                ? 'bg-rose-600 hover:bg-rose-700'
                : 'bg-[var(--pu)] hover:bg-[var(--pu-dark)]'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// -- Page ----------------------------------------------------------------------
export default function SuperAdminBillingPage() {
  const [mrr, setMrr] = useState<MrrData | null>(null);
  const [plans, setPlans] = useState<PlansCatalog | null>(null);
  const [invoices, setInvoices] = useState<PaginatedResponse<Invoice> | null>(null);
  const [selected, setSelected] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionBusy, setActionBusy] = useState(false);
  const [newInvoiceOpen, setNewInvoiceOpen] = useState(false);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<(ConfirmOptions & { open: boolean }) | null>(null);

  const openConfirm = (opts: ConfirmOptions) =>
    setConfirmDialog({ ...opts, open: true });
  const closeConfirm = () =>
    setConfirmDialog((d) => (d ? { ...d, open: false } : null));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [mrrData, plansData, invData] = await Promise.all([
        getMrr(),
        getPlans(),
        getInvoices({ page: 1, page_size: 6 }),
      ]);
      setMrr(mrrData);
      setPlans(plansData);
      setInvoices(invData);
      if (invData.results.length > 0 && !selected) {
        setSelected(invData.results[0] ?? null);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to load billing data.');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleExport = async () => {
    try {
      const blob = await exportGstr1();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(blob, `gstr1-${stamp}.xlsx`);
      toast.success('GSTR-1 exported.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'GSTR export failed.');
    }
  };

  const handleMarkPaid = async (target?: Invoice) => {
    const inv = target ?? selected;
    if (!inv) return;
    setActionBusy(true);
    try {
      const updated = await markInvoicePaid(String(inv.id));
      setSelected(updated);
      toast.success(`Invoice ${updated.invoice_number} marked as paid.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mark paid failed.');
    } finally {
      setActionBusy(false);
    }
  };

  const handleDownloadPdf = (target?: Invoice) => {
    const inv = target ?? selected;
    if (!inv) return;
    // Ensure the row clicked is the one rendered into the printable area before print.
    if (target && selected?.id !== target.id) {
      setSelected(target);
      // Defer print until React paints the new invoice in #invoice-printable.
      setTimeout(() => window.print(), 50);
      return;
    }
    window.print();
  };

  const handleEdit = () => {
    if (!selected) return;
    setEditingInvoice(selected);
  };

  const handleCancel = async (target?: Invoice) => {
    const inv = target ?? selected;
    if (!inv) return;
    if (inv.status === 'paid') {
      toast.error('Paid invoices cannot be cancelled. Issue a credit note instead.');
      return;
    }
    if (inv.status === 'cancelled') return;
    openConfirm({
      title: `Cancel invoice ${inv.invoice_number}?`,
      message:
        'This marks the invoice as cancelled and cannot be undone. The invoice will remain visible for audit. Create a new invoice to re-bill.',
      confirmLabel: 'Cancel Invoice',
      variant: 'danger',
      onConfirm: async () => {
        setActionBusy(true);
        try {
          const updated = await cancelInvoice(String(inv.id));
          setSelected(updated);
          toast.success(`Invoice ${updated.invoice_number} cancelled.`);
          await load();
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Cancel invoice failed.');
        } finally {
          setActionBusy(false);
        }
      },
    });
  };

  const today = useMemo(() => new Date(), []);
  const monthLabel = mrr?.gst_month_label || today.toLocaleString('en-US', { month: 'short' }).toUpperCase();
  const fyLabel = mrr?.fiscal_year_label || `FY ${today.getFullYear()}-${(today.getFullYear() + 1).toString().slice(-2)}`;
  const sellerGstin = mrr?.seller_gstin || (selected?.seller_gstin ?? '');
  const sellerState = mrr?.seller_state || (selected?.seller_state ?? '');

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] px-6 py-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-[32px] font-bold leading-tight text-[var(--ink-1)]">
              Tenants &amp; <span className="font-serif italic text-[var(--pu)]">Billing</span>
            </h1>
            <p className="mt-1 max-w-3xl text-[12.5px] leading-snug text-[var(--ink-2)]">
              GST-compliant invoicing across all schools.{' '}
              {sellerGstin && (
                <>
                  � Seller GSTIN <span className="font-mono text-[var(--ink-1)]">{sellerGstin}</span>{' '}
                </>
              )}
              {sellerState && <>� {sellerState}.</>} Place of supply auto-detected from buyer state code � IGST for inter-state, CGST + SGST for intra-state.
            </p>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => void handleExport()}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-3.5 py-2 text-[12.5px] font-semibold text-[var(--ink-1)] hover:bg-[var(--bg-3)]"
            >
              <Download className="h-3.5 w-3.5" />
              Export GSTR-1
            </button>
            <button
              type="button"
              onClick={() => setNewInvoiceOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--pu)] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:opacity-90"
            >
              <Plus className="h-3.5 w-3.5" />
              New invoice
            </button>
          </div>
        </div>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="MRR"
          value={loading || !mrr ? '�' : fmtINR(mrr.current_mrr, { compact: true })}
          trend={
            !loading && mrr && mrr.trend_percent
              ? `${mrr.trend_percent > 0 ? '+' : ''}${mrr.trend_percent}%`
              : undefined
          }
          trendTone={(mrr?.trend_percent ?? 0) >= 0 ? 'up' : 'down'}
          footnote="Recurring � pre-GST"
          spark={mrr?.mrr_series}
          sparkColor="var(--pu)"
        />
        <KpiCard
          label={`GST Collected (${monthLabel})`}
          value={loading || !mrr ? '�' : fmtINR(mrr.gst_collected, { compact: true })}
          trend={
            !loading && mrr && (mrr.gst_trend_percent ?? 0)
              ? `${(mrr.gst_trend_percent ?? 0) > 0 ? '+' : ''}${mrr.gst_trend_percent}%`
              : undefined
          }
          trendTone={(mrr?.gst_trend_percent ?? 0) >= 0 ? 'up' : 'down'}
          footnote={
            mrr
              ? `IGST ${fmtINR(mrr.gst_igst ?? 0, { compact: true })} � CGST+SGST ${fmtINR(
                  mrr.gst_cgst_sgst ?? 0,
                  { compact: true },
                )}`
              : 'Tax collected this cycle'
          }
          spark={mrr?.gst_series}
          sparkColor="#16a34a"
        />
        <KpiCard
          label="Outstanding"
          value={loading || !mrr ? '�' : fmtINR(mrr.outstanding_amount, { compact: true })}
          trend={
            mrr?.outstanding_count
              ? `${mrr.outstanding_count} invoice${mrr.outstanding_count === 1 ? '' : 's'}`
              : undefined
          }
          trendTone="down"
          footnote={
            mrr?.outstanding_avg_overdue_days
              ? `Avg days overdue: ${mrr.outstanding_avg_overdue_days}`
              : 'Open receivables'
          }
          spark={mrr?.outstanding_series}
          sparkColor="var(--danger)"
        />
        <KpiCard
          label="Invoices YTD"
          value={loading || !mrr ? '�' : String(mrr.invoices_ytd ?? 0)}
          trend={mrr?.invoices_paid ? `${mrr.invoices_paid} paid` : undefined}
          trendTone="up"
          footnote={fyLabel}
          spark={mrr?.invoices_series}
          sparkColor="var(--pu)"
        />
      </div>

      {/* Subscription Plans */}
      <section className="rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] px-5 py-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--pu-tint)] text-[var(--pu)]">
              <Receipt className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[var(--ink-1)]">Subscription plans</p>
              <p className="text-[11px] text-[var(--ink-3)]">
                India-priced � GST {plans?.gst_percent ?? 18}% under SAC{' '}
                <span className="font-mono">{plans?.sac_code ?? '998313'}</span> ({plans?.sac_description ?? 'Education software'})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setNewPlanOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pu)] px-3 py-1.5 text-[11.5px] font-semibold text-white shadow-sm transition hover:bg-[var(--pu-deep)]"
          >
            <Plus className="h-3 w-3" /> Add plan
          </button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {(plans?.plans ?? []).map((p) => (
            <PlanCard
              key={p.code}
              plan={p}
              onEdit={(plan) => {
                setEditingPlan(plan);
                setNewPlanOpen(true);
              }}
              onDelete={(plan) => {
                openConfirm({
                  title: `Delete plan "${plan.name}"?`,
                  message: 'This cannot be undone. Schools on this plan will lose access to it.',
                  confirmLabel: 'Delete',
                  variant: 'danger',
                  onConfirm: async () => {
                    try {
                      await deletePlan(plan.code);
                      toast.success(`Plan "${plan.name}" deleted.`);
                      await load();
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to delete plan.');
                    }
                  },
                });
              }}
            />
          ))}
          {(!plans || plans.plans.length === 0) && (
            <div className="col-span-full py-6 text-center text-[12px] text-[var(--ink-3)]">
              {loading ? 'Loading plans�' : 'No plans configured.'}
            </div>
          )}
        </div>
      </section>

      {/* Tax Invoice + Recent Invoices */}
      <TaxInvoiceCard
        invoice={selected}
        sellerGstin={sellerGstin}
        sellerState={sellerState}
        onMarkPaid={() => handleMarkPaid()}
        onDownloadPdf={() => handleDownloadPdf()}
        onEdit={handleEdit}
        onCancel={() => handleCancel()}
        actionBusy={actionBusy}
      />

      {/* Recent invoices */}
      <section className="rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] px-5 py-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--pu-tint)] text-[var(--pu)]">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[13px] font-semibold text-[var(--ink-1)]">Recent invoices</p>
              <p className="text-[11px] text-[var(--ink-3)]">
                {invoices ? `${invoices.results.length} of ${invoices.count} invoices` : ''} � {fyLabel}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--ink-1)] hover:bg-[var(--bg-3)]"
          >
            <Download className="h-3 w-3" />
            Export
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="border-b border-[var(--bd)] text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">
                <th className="py-2.5 pr-3 text-left">Invoice</th>
                <th className="py-2.5 pr-3 text-left">School · GSTIN</th>
                <th className="py-2.5 pr-3 text-left">Place of supply</th>
                <th className="py-2.5 pr-3 text-left">Issued / Due</th>
                <th className="py-2.5 pr-3 text-left">Tax</th>
                <th className="py-2.5 pr-3 text-left">Status</th>
                <th className="py-2.5 pr-3 text-right">Total</th>
                <th className="py-2.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[12px] text-[var(--ink-3)]">Loading…</td>
                </tr>
              )}
              {!loading && invoices && invoices.results.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-[12px] text-[var(--ink-3)]">No invoices yet.</td>
                </tr>
              )}
              {!loading &&
                invoices?.results.map((inv) => {
                  const inter = isInterState(inv);
                  const isSel = selected?.id === inv.id;
                  const buyerCode = stateCode(inv.buyer_state);
                  const today2 = new Date();
                  const dueDate = inv.due_date ? new Date(inv.due_date) : null;
                  const daysOverdue =
                    dueDate && inv.status === 'overdue' ? Math.max(0, Math.round((today2.getTime() - dueDate.getTime()) / 86400000)) : undefined;
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => setSelected(inv)}
                      title="Click to view in invoice panel above"
                      className={`cursor-pointer border-b border-[var(--bd)] align-top transition-colors hover:bg-[var(--bg-3)] ${
                        isSel ? 'bg-[var(--pu-tint)] shadow-[inset_3px_0_0_0_var(--pu)]' : ''
                      }`}
                    >
                      <td className="py-3 pr-3">
                        <div className="flex items-center gap-1.5">
                          <p className="font-mono text-[12px] font-semibold text-[var(--ink-1)]">{inv.invoice_number}</p>
                        </div>
                        <p className="font-mono text-[10.5px] text-[var(--ink-3)]">SAC 998313</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-[13px] font-medium text-[var(--ink-1)]">{inv.school_name}</p>
                        <p className="font-mono text-[10.5px] text-[var(--ink-3)]">{inv.buyer_gstin || 'Unregistered'}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-[12px] text-[var(--ink-1)]">
                          {buyerCode && <span className="font-mono text-[var(--ink-3)]">{buyerCode} · </span>}
                          {inv.buyer_state}
                        </p>
                        <p className="text-[10.5px] text-[var(--ink-3)]">{inter ? 'Inter-state' : 'Intra-state'}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-[12px] text-[var(--ink-1)]">{fmtDate(inv.invoice_date)}</p>
                        <p className="text-[10.5px] text-[var(--ink-3)]">Due {fmtDate(inv.due_date)}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <Pill tone="purple">{inter ? 'IGST 18%' : 'CGST+SGST 18%'}</Pill>
                      </td>
                      <td className="py-3 pr-3">
                        <StatusChip status={inv.status} daysOverdue={daysOverdue} />
                      </td>
                      <td className="py-3 pr-3 text-right">
                        <p className="sa-kpi-value text-[14px] text-[var(--ink-1)]">
                          {fmtINR(Number(inv.tax_breakdown?.grand_total || 0), { compact: true })}
                        </p>
                        <p className="font-mono text-[10.5px] text-[var(--ink-3)]">
                          {fmtINR(Number(inv.tax_breakdown?.grand_total || 0), { symbol: false })}
                        </p>
                      </td>
                      <td className="py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            title="View in Tax Invoice panel"
                            aria-label="View invoice"
                            onClick={() => {
                              setSelected(inv);
                              setTimeout(() => {
                                document
                                  .getElementById('invoice-printable')
                                  ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                              }, 50);
                            }}
                            className="grid h-7 w-7 place-items-center rounded-md border border-[var(--bd)] bg-[var(--bg-1)] text-[var(--pu)] hover:bg-[var(--pu-tint)]"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            title="Download PDF"
                            aria-label="Download PDF"
                            onClick={() => handleDownloadPdf(inv)}
                            className="grid h-7 w-7 place-items-center rounded-md border border-[var(--bd)] bg-[var(--bg-1)] text-[var(--ink-2)] hover:bg-[var(--bg-3)]"
                          >
                            <Download className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            title={inv.status === 'paid' ? 'Already paid' : inv.status === 'cancelled' ? 'Cancelled invoice' : 'Mark as paid'}
                            aria-label="Mark as paid"
                            disabled={actionBusy || inv.status === 'paid' || inv.status === 'cancelled'}
                            onClick={() => handleMarkPaid(inv)}
                            className="grid h-7 w-7 place-items-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 disabled:hover:bg-emerald-50"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                          </button>
                          <button
                            type="button"
                            title={inv.status === 'paid' ? 'Paid invoice — issue credit note instead' : inv.status === 'cancelled' ? 'Already cancelled' : 'Cancel invoice'}
                            aria-label="Cancel invoice"
                            disabled={actionBusy || inv.status === 'paid' || inv.status === 'cancelled'}
                            onClick={() => handleCancel(inv)}
                            className="grid h-7 w-7 place-items-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:opacity-40 disabled:hover:bg-rose-50"
                          >
                            <Ban className="h-3 w-3" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <NewInvoiceDrawer
        open={newInvoiceOpen || !!editingInvoice}
        invoice={editingInvoice}
        onClose={() => {
          setNewInvoiceOpen(false);
          setEditingInvoice(null);
        }}
        onCreated={(inv) => {
          setSelected(inv);
          setEditingInvoice(null);
          void load();
        }}
      />

      <NewPlanDrawer
        open={newPlanOpen}
        existing={editingPlan}
        onClose={() => {
          setNewPlanOpen(false);
          setEditingPlan(null);
        }}
        onCreated={() => {
          setEditingPlan(null);
          void load();
        }}
      />

      {confirmDialog && (
        <ConfirmDialog
          open={confirmDialog.open}
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          variant={confirmDialog.variant}
          onConfirm={confirmDialog.onConfirm}
          onCancel={closeConfirm}
        />
      )}
    </div>
  );
}
