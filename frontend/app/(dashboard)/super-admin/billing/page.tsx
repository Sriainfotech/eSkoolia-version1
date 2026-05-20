'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Check,
  CheckCircle2,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  Plus,
  Receipt,
  Trash2,
} from 'lucide-react';
import {
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

// ── Formatting ────────────────────────────────────────────────────────────────
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
  if (!iso) return '—';
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
  return (invoice.seller_state ?? '').trim().toLowerCase() !== (invoice.buyer_state ?? '').trim().toLowerCase();
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

// ── Sparkline ─────────────────────────────────────────────────────────────────
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

// ── KPI Card ──────────────────────────────────────────────────────────────────
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

// ── Plan Card ─────────────────────────────────────────────────────────────────
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

// ── Status Chip ───────────────────────────────────────────────────────────────
const STATUS_META: Record<InvoiceStatus, { label: string; dot: string; text: string }> = {
  draft: { label: 'Draft', dot: 'bg-[var(--ink-3)]', text: 'text-[var(--ink-2)]' },
  sent: { label: 'Sent', dot: 'bg-amber-500', text: 'text-amber-700' },
  paid: { label: 'Paid', dot: 'bg-emerald-500', text: 'text-emerald-700' },
  overdue: { label: 'Overdue', dot: 'bg-[var(--danger)]', text: 'text-[var(--danger)]' },
  cancelled: { label: 'Cancelled', dot: 'bg-[var(--ink-3)]', text: 'text-[var(--ink-3)]' },
};

function StatusChip({ status, daysOverdue }: { status: InvoiceStatus; daysOverdue?: number }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  const label = status === 'overdue' && daysOverdue ? `${m.label} · ${daysOverdue}d` : m.label;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-medium ${m.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${m.dot}`} />
      {label}
    </span>
  );
}

// ── Tax Logic Pill ────────────────────────────────────────────────────────────
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

// ── Amount in words (Indian) ─────────────────────────────────────────────────
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

// ── Tax Invoice Card ──────────────────────────────────────────────────────────
function TaxInvoiceCard({
  invoice,
  sellerGstin,
  sellerState,
  onMarkPaid,
  actionBusy,
}: {
  invoice: Invoice | null;
  sellerGstin: string;
  sellerState: string;
  onMarkPaid: () => void;
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
      {/* LEFT: Invoice body (2/3) */}
      <div className="rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] px-6 pb-5 pt-5 xl:col-span-2">
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
                {sellerState || invoice.seller_state} 560048 · India
              </p>
              <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">
                GSTIN <span className="font-mono text-[var(--ink-2)]">{sellerGstin || invoice.seller_gstin || '—'}</span>
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
              {buyerCode && <span className="font-mono text-[var(--ink-3)]">{buyerCode} — </span>}
              {invoice.buyer_state}
            </p>
            <p className="text-[11px] text-[var(--ink-3)]">{inter ? 'Inter-state supply' : 'Intra-state supply'}</p>
            <p className="mt-1 text-[10.5px] text-[var(--ink-3)]">
              Reverse charge <span className="text-[var(--ink-1)]">— No</span>
            </p>
            <p className="text-[10.5px] text-[var(--ink-3)]">
              Currency <span className="text-[var(--ink-1)]">— INR</span>
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
          <span className="italic">Amount in words · </span>
          <span className="font-semibold text-[var(--ink-1)]">{amountWords}</span>
        </div>

        {/* Payment terms + Notes */}
        <div className="mt-4 grid grid-cols-2 gap-5 text-[11px] text-[var(--ink-3)]">
          <div>
            <p className="text-[9.5px] font-bold uppercase tracking-[0.1em]">Payment terms</p>
            <p className="mt-1 leading-snug">
              Payable within 15 days of invoice date. Bank transfer to{' '}
              <Pill>HDFC 0000123456789</Pill> · IFSC <Pill>HDFC0001234</Pill> · A/c name Eskoolia
              Technologies Pvt Ltd · UPI <Pill>eskoolia@hdfcbank</Pill> · Reference{' '}
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
            Whether tax payable under reverse charge — No. This is a computer-generated invoice; signature not required if digitally signed.
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
              <Row label="IGST · 18%" value={fmtINR(Number(tax.igst || 0))} />
            ) : (
              <>
                <Row label="CGST · 9%" value={fmtINR(Number(tax.cgst || 0))} />
                <Row label="SGST · 9%" value={fmtINR(Number(tax.sgst || 0))} />
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
            <LogicRow label="Seller state" right={<><Pill>{sellerCode || '—'}</Pill> <span className="ml-1 text-[var(--ink-2)]">{sellerState || invoice.seller_state}</span></>} />
            <LogicRow label="Buyer state" right={<><Pill>{buyerCode || '—'}</Pill> <span className="ml-1 text-[var(--ink-2)]">{invoice.buyer_state}</span></>} />
            <LogicRow label="Supply type" right={<span className="font-semibold text-[var(--ink-1)]">{inter ? 'Inter-state' : 'Intra-state'}</span>} />
            <LogicRow label="Applied" right={<span className="font-semibold text-[var(--ink-1)]">{inter ? 'IGST' : 'CGST + SGST'}</span>} />
            <LogicRow label="SAC" right={<><Pill>998313</Pill> <span className="ml-1 text-[var(--ink-2)]">Education software</span></>} />
          </div>
        </div>

        {/* Actions */}
        <div className="rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] p-4">
          <p className="text-[9.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-3)]">Invoice actions</p>
          <div className="mt-3 grid grid-cols-1 gap-1.5">
            <ActionRow icon={<Download className="h-3.5 w-3.5" />} label="Download PDF" onClick={() => toast.info('PDF export coming soon')} />
            <ActionRow icon={<ExternalLink className="h-3.5 w-3.5" />} label="Send to buyer" onClick={() => toast.info('Send to buyer coming soon')} />
            <ActionRow
              icon={<CheckCircle2 className="h-3.5 w-3.5" />}
              label={actionBusy ? 'Updating…' : 'Mark as paid'}
              disabled={actionBusy || invoice.status === 'paid' || invoice.status === 'cancelled'}
              onClick={onMarkPaid}
            />
            <ActionRow icon={<Edit3 className="h-3.5 w-3.5" />} label="Edit invoice" onClick={() => toast.info('Edit invoice coming soon')} />
          </div>
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
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-2 rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-3 py-2 text-[12px] font-medium text-[var(--ink-1)] transition-colors hover:bg-[var(--bg-3)] disabled:opacity-40"
    >
      {icon}
      {label}
    </button>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
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
      downloadFile(blob, `gstr1-${stamp}.csv`);
      toast.success('GSTR-1 exported.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'GSTR export failed.');
    }
  };

  const handleMarkPaid = async () => {
    if (!selected) return;
    setActionBusy(true);
    try {
      const updated = await markInvoicePaid(String(selected.id));
      setSelected(updated);
      toast.success(`Invoice ${updated.invoice_number} marked as paid.`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mark paid failed.');
    } finally {
      setActionBusy(false);
    }
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
                  · Seller GSTIN <span className="font-mono text-[var(--ink-1)]">{sellerGstin}</span>{' '}
                </>
              )}
              {sellerState && <>· {sellerState}.</>} Place of supply auto-detected from buyer state code · IGST for inter-state, CGST + SGST for intra-state.
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
          value={loading || !mrr ? '—' : fmtINR(mrr.current_mrr, { compact: true })}
          trend={
            !loading && mrr && mrr.trend_percent
              ? `${mrr.trend_percent > 0 ? '+' : ''}${mrr.trend_percent}%`
              : undefined
          }
          trendTone={(mrr?.trend_percent ?? 0) >= 0 ? 'up' : 'down'}
          footnote="Recurring · pre-GST"
          spark={mrr?.mrr_series}
          sparkColor="var(--pu)"
        />
        <KpiCard
          label={`GST Collected (${monthLabel})`}
          value={loading || !mrr ? '—' : fmtINR(mrr.gst_collected, { compact: true })}
          trend={
            !loading && mrr && (mrr.gst_trend_percent ?? 0)
              ? `${(mrr.gst_trend_percent ?? 0) > 0 ? '+' : ''}${mrr.gst_trend_percent}%`
              : undefined
          }
          trendTone={(mrr?.gst_trend_percent ?? 0) >= 0 ? 'up' : 'down'}
          footnote={
            mrr
              ? `IGST ${fmtINR(mrr.gst_igst ?? 0, { compact: true })} · CGST+SGST ${fmtINR(
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
          value={loading || !mrr ? '—' : fmtINR(mrr.outstanding_amount, { compact: true })}
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
          value={loading || !mrr ? '—' : String(mrr.invoices_ytd ?? 0)}
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
                India-priced · GST {plans?.gst_percent ?? 18}% under SAC{' '}
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
              onDelete={async (plan) => {
                if (!window.confirm(`Delete plan "${plan.name}"? This cannot be undone.`)) return;
                try {
                  await deletePlan(plan.code);
                  toast.success(`Plan "${plan.name}" deleted.`);
                  await load();
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Failed to delete plan.');
                }
              }}
            />
          ))}
          {(!plans || plans.plans.length === 0) && (
            <div className="col-span-full py-6 text-center text-[12px] text-[var(--ink-3)]">
              {loading ? 'Loading plans…' : 'No plans configured.'}
            </div>
          )}
        </div>
      </section>

      {/* Tax Invoice + Recent Invoices */}
      <TaxInvoiceCard
        invoice={selected}
        sellerGstin={sellerGstin}
        sellerState={sellerState}
        onMarkPaid={handleMarkPaid}
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
                {invoices ? `${invoices.results.length} of ${invoices.count} invoices` : ''} · {fyLabel}
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
                <th className="py-2.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[12px] text-[var(--ink-3)]">Loading…</td>
                </tr>
              )}
              {!loading && invoices && invoices.results.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-[12px] text-[var(--ink-3)]">No invoices yet.</td>
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
                      className={`cursor-pointer border-b border-[var(--bd)] align-top transition-colors hover:bg-[var(--bg-3)] ${isSel ? 'bg-[var(--pu-tint)]' : ''}`}
                    >
                      <td className="py-3 pr-3">
                        <p className="font-mono text-[12px] font-semibold text-[var(--ink-1)]">{inv.invoice_number}</p>
                        <p className="font-mono text-[10.5px] text-[var(--ink-3)]">SAC 998313</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-[13px] font-medium text-[var(--ink-1)]">{inv.school_name}</p>
                        <p className="font-mono text-[10.5px] text-[var(--ink-3)]">{inv.buyer_gstin || 'Unregistered'}</p>
                      </td>
                      <td className="py-3 pr-3">
                        <p className="text-[12px] text-[var(--ink-1)]">
                          {buyerCode && <span className="font-mono text-[var(--ink-3)]">{buyerCode} — </span>}
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
                      <td className="py-3 text-right">
                        <p className="sa-kpi-value text-[14px] text-[var(--ink-1)]">
                          {fmtINR(Number(inv.tax_breakdown?.grand_total || 0), { compact: true })}
                        </p>
                        <p className="font-mono text-[10.5px] text-[var(--ink-3)]">
                          {fmtINR(Number(inv.tax_breakdown?.grand_total || 0), { symbol: false })}
                        </p>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      </section>

      <NewInvoiceDrawer
        open={newInvoiceOpen}
        onClose={() => setNewInvoiceOpen(false)}
        onCreated={(inv) => {
          setSelected(inv);
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
    </div>
  );
}
