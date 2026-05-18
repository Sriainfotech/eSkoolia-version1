'use client';

import { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Check,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Download,
  FileText,
  Minus,
  ReceiptIndianRupee,
  Send,
  TrendingDown,
  TrendingUp,
  X,
} from 'lucide-react';
import {
  downloadFile,
  exportGstr1,
  getInvoices,
  getMrr,
  markInvoicePaid,
  sendInvoiceReminder,
} from '@/lib/api/super-admin/billing';
import type { Invoice, InvoiceStatus, MrrData, PaginatedResponse } from '@/types/super-admin';

// ── Sparkline ─────────────────────────────────────────────────────────────────
function Spark({ data, color = 'var(--pu)' }: { data: number[]; color?: string }) {
  if (data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const W = 72;
  const H = 26;
  const pts = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * W;
      const y = H - ((v - min) / range) * H;
      return `${x},${y}`;
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
  trendUp,
  footnote,
  spark,
}: {
  label: string;
  value: string;
  trend?: string;
  trendUp?: boolean;
  footnote?: string;
  spark?: number[];
}) {
  return (
    <div className="sa-panel flex flex-col gap-2 p-5">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--ink-3)]">{label}</span>
      <div className="flex items-end justify-between gap-2">
        <span className="font-serif text-2xl font-bold text-[var(--ink-1)]">{value}</span>
        {spark && (
          <Spark
            data={spark}
            color={trendUp === false ? 'var(--danger)' : 'var(--pu)'}
          />
        )}
      </div>
      <div className="flex items-center justify-between">
        {trend !== undefined ? (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-semibold ${
              trendUp === true
                ? 'text-emerald-600'
                : trendUp === false
                  ? 'text-[var(--danger)]'
                  : 'text-[var(--ink-3)]'
            }`}
          >
            {trendUp === true ? (
              <TrendingUp className="h-3 w-3" />
            ) : trendUp === false ? (
              <TrendingDown className="h-3 w-3" />
            ) : (
              <Minus className="h-3 w-3" />
            )}
            {trend}
          </span>
        ) : (
          <span />
        )}
        {footnote && <span className="text-xs text-[var(--ink-3)]">{footnote}</span>}
      </div>
    </div>
  );
}

// ── Status Chip ───────────────────────────────────────────────────────────────
const STATUS_META: Record<
  InvoiceStatus,
  { label: string; color: string; icon: React.ReactNode }
> = {
  draft: {
    label: 'Draft',
    color: 'bg-[var(--bg-3)] text-[var(--ink-2)]',
    icon: <FileText className="h-3 w-3" />,
  },
  sent: {
    label: 'Sent',
    color: 'bg-[var(--info-soft)] text-[var(--info)]',
    icon: <Send className="h-3 w-3" />,
  },
  paid: {
    label: 'Paid',
    color: 'bg-[var(--ok-soft)] text-emerald-700',
    icon: <Check className="h-3 w-3" />,
  },
  overdue: {
    label: 'Overdue',
    color: 'bg-[var(--danger-soft)] text-[var(--danger)]',
    icon: <CircleAlert className="h-3 w-3" />,
  },
  cancelled: {
    label: 'Cancelled',
    color: 'bg-[var(--warn-soft)] text-amber-700',
    icon: <X className="h-3 w-3" />,
  },
};

function StatusChip({ status }: { status: InvoiceStatus }) {
  const m = STATUS_META[status] ?? STATUS_META.draft;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.color}`}
    >
      {m.icon}
      {m.label}
    </span>
  );
}

// ── Plan Pricing ──────────────────────────────────────────────────────────────
interface Plan {
  name: string;
  price: number;
  maxStudents: string;
  popular?: boolean;
  color: string;
  features: string[];
}

const PLANS: Plan[] = [
  {
    name: 'Starter',
    price: 2999,
    maxStudents: 'Up to 200',
    color: 'from-slate-50 to-slate-100',
    features: [
      'Admissions module',
      'Fee management',
      'Student profiles',
      'Basic reports',
      'Email support',
    ],
  },
  {
    name: 'Standard',
    price: 5999,
    maxStudents: 'Up to 500',
    popular: true,
    color: 'from-indigo-50 to-violet-50',
    features: [
      'Everything in Starter',
      'Attendance & timetable',
      'Exam & gradebook',
      'SMS + WhatsApp alerts',
      'Priority support',
    ],
  },
  {
    name: 'Premium',
    price: 9999,
    maxStudents: 'Up to 1,500',
    color: 'from-purple-50 to-fuchsia-50',
    features: [
      'Everything in Standard',
      'Transport tracking',
      'Library module',
      'HR & payroll',
      'Analytics dashboard',
      'Phone support',
    ],
  },
  {
    name: 'Enterprise',
    price: 24999,
    maxStudents: 'Unlimited',
    color: 'from-amber-50 to-orange-50',
    features: [
      'Everything in Premium',
      'Custom integrations',
      'Dedicated CSM',
      'SLA guarantee',
      'On-premise option',
      'Multi-branch mgmt',
    ],
  },
];

function PlanCard({ plan }: { plan: Plan }) {
  return (
    <div
      className={`relative rounded-2xl border border-[var(--bd)] bg-gradient-to-b ${plan.color} p-5`}
    >
      {plan.popular && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-[var(--pu)] px-3 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
          Most popular
        </span>
      )}
      <p className="text-sm font-semibold text-[var(--ink-1)]">{plan.name}</p>
      <p className="mt-2 font-serif text-3xl font-bold text-[var(--ink-1)]">
        ₹{plan.price.toLocaleString('en-IN')}
        <span className="font-sans text-sm font-normal text-[var(--ink-3)]">/mo</span>
      </p>
      <p className="mt-1 text-xs text-[var(--ink-3)]">{plan.maxStudents} students · +18% GST</p>
      <ul className="mt-4 space-y-1.5">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-1.5 text-xs text-[var(--ink-2)]">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function fmtINR(n: number) {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
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
  return (invoice.seller_state ?? '') !== (invoice.buyer_state ?? '');
}

// ── Demo / Fallback Data ──────────────────────────────────────────────────────
const DEMO_MRR: MrrData = {
  current_mrr: 1_147_800,
  previous_mrr: 1_092_400,
  gst_collected: 206_604,
  outstanding_amount: 324_100,
  at_risk_amount: 87_500,
  trend_percent: 5.1,
};

const DEMO_INVOICES: PaginatedResponse<Invoice> = {
  count: 6,
  next: null,
  previous: null,
  results: [
    {
      id: 'inv-001',
      invoice_number: 'ESK/2025-26/0042',
      school_name: 'Sunrise International School',
      tenant_id: 'tenant-001',
      invoice_date: '2026-05-01',
      due_date: '2026-05-15',
      status: 'overdue',
      seller_name: 'eSkoolia Technologies Pvt. Ltd.',
      seller_gstin: '29AABCE1234F1Z5',
      seller_state: 'Karnataka',
      buyer_name: 'Sunrise International School',
      buyer_gstin: '27AADCS5678G1Z2',
      buyer_state: 'Maharashtra',
      line_items: [
        {
          description: 'eSkoolia Premium Plan – May 2026',
          quantity: 1,
          unit_price: 9999,
          sac_code: '998315',
          amount: 9999,
          gst_percent: 18,
          gst_amount: 1799.82,
        },
      ],
      tax_breakdown: {
        subtotal: 9999,
        igst: 1799.82,
        total_tax: 1799.82,
        grand_total: 11798.82,
        amount_in_words:
          'Eleven Thousand Seven Hundred Ninety-Eight Rupees and Eighty-Two Paise',
      },
    },
    {
      id: 'inv-002',
      invoice_number: 'ESK/2025-26/0041',
      school_name: 'Delhi Public School – Sector 12',
      tenant_id: 'tenant-002',
      invoice_date: '2026-05-01',
      due_date: '2026-05-20',
      status: 'paid',
      seller_name: 'eSkoolia Technologies Pvt. Ltd.',
      seller_gstin: '29AABCE1234F1Z5',
      seller_state: 'Karnataka',
      buyer_name: 'DPS Sector 12 Society',
      buyer_gstin: '07AADCD9012H1Z3',
      buyer_state: 'Delhi',
      line_items: [
        {
          description: 'eSkoolia Standard Plan – May 2026',
          quantity: 1,
          unit_price: 5999,
          sac_code: '998315',
          amount: 5999,
          gst_percent: 18,
          gst_amount: 1079.82,
        },
        {
          description: 'SMS Bundle – 5,000 messages',
          quantity: 1,
          unit_price: 500,
          sac_code: '998439',
          amount: 500,
          gst_percent: 18,
          gst_amount: 90,
        },
      ],
      tax_breakdown: {
        subtotal: 6499,
        igst: 1169.82,
        total_tax: 1169.82,
        grand_total: 7668.82,
        amount_in_words:
          'Seven Thousand Six Hundred Sixty-Eight Rupees and Eighty-Two Paise',
      },
    },
    {
      id: 'inv-003',
      invoice_number: 'ESK/2025-26/0040',
      school_name: 'Greenwood Academy',
      tenant_id: 'tenant-003',
      invoice_date: '2026-05-01',
      due_date: '2026-05-20',
      status: 'sent',
      seller_name: 'eSkoolia Technologies Pvt. Ltd.',
      seller_gstin: '29AABCE1234F1Z5',
      seller_state: 'Karnataka',
      buyer_name: 'Greenwood Academy Trust',
      buyer_gstin: '29AADCG3456I1Z7',
      buyer_state: 'Karnataka',
      line_items: [
        {
          description: 'eSkoolia Starter Plan – May 2026',
          quantity: 1,
          unit_price: 2999,
          sac_code: '998315',
          amount: 2999,
          gst_percent: 18,
          gst_amount: 539.82,
        },
      ],
      tax_breakdown: {
        subtotal: 2999,
        cgst: 269.91,
        sgst: 269.91,
        total_tax: 539.82,
        grand_total: 3538.82,
        amount_in_words:
          'Three Thousand Five Hundred Thirty-Eight Rupees and Eighty-Two Paise',
      },
    },
    {
      id: 'inv-004',
      invoice_number: 'ESK/2025-26/0039',
      school_name: 'The Heritage School',
      tenant_id: 'tenant-004',
      invoice_date: '2026-04-01',
      due_date: '2026-04-20',
      status: 'paid',
      seller_name: 'eSkoolia Technologies Pvt. Ltd.',
      seller_gstin: '29AABCE1234F1Z5',
      seller_state: 'Karnataka',
      buyer_name: 'Heritage Educational Foundation',
      buyer_gstin: '33AADCH7890J1Z4',
      buyer_state: 'Tamil Nadu',
      line_items: [
        {
          description: 'eSkoolia Enterprise Plan – Apr 2026',
          quantity: 1,
          unit_price: 24999,
          sac_code: '998315',
          amount: 24999,
          gst_percent: 18,
          gst_amount: 4499.82,
        },
      ],
      tax_breakdown: {
        subtotal: 24999,
        igst: 4499.82,
        total_tax: 4499.82,
        grand_total: 29498.82,
        amount_in_words:
          'Twenty-Nine Thousand Four Hundred Ninety-Eight Rupees and Eighty-Two Paise',
      },
    },
    {
      id: 'inv-005',
      invoice_number: 'ESK/2025-26/0038',
      school_name: 'Vidya Niketan CBSE School',
      tenant_id: 'tenant-005',
      invoice_date: '2026-05-01',
      due_date: '2026-05-20',
      status: 'draft',
      seller_name: 'eSkoolia Technologies Pvt. Ltd.',
      seller_gstin: '29AABCE1234F1Z5',
      seller_state: 'Karnataka',
      buyer_name: 'Vidya Niketan Educational Trust',
      buyer_gstin: '36AADCV2345K1Z6',
      buyer_state: 'Telangana',
      line_items: [
        {
          description: 'eSkoolia Premium Plan – May 2026',
          quantity: 1,
          unit_price: 9999,
          sac_code: '998315',
          amount: 9999,
          gst_percent: 18,
          gst_amount: 1799.82,
        },
      ],
      tax_breakdown: {
        subtotal: 9999,
        igst: 1799.82,
        total_tax: 1799.82,
        grand_total: 11798.82,
        amount_in_words:
          'Eleven Thousand Seven Hundred Ninety-Eight Rupees and Eighty-Two Paise',
      },
    },
    {
      id: 'inv-006',
      invoice_number: "ESK/2025-26/0037",
      school_name: "St. Mary's Convent School",
      tenant_id: 'tenant-006',
      invoice_date: '2026-04-01',
      due_date: '2026-04-15',
      status: 'overdue',
      seller_name: 'eSkoolia Technologies Pvt. Ltd.',
      seller_gstin: '29AABCE1234F1Z5',
      seller_state: 'Karnataka',
      buyer_name: "St. Mary's Educational Society",
      buyer_gstin: '09AADCS4567L1Z8',
      buyer_state: 'Uttar Pradesh',
      line_items: [
        {
          description: 'eSkoolia Standard Plan – Apr 2026',
          quantity: 1,
          unit_price: 5999,
          sac_code: '998315',
          amount: 5999,
          gst_percent: 18,
          gst_amount: 1079.82,
        },
      ],
      tax_breakdown: {
        subtotal: 5999,
        igst: 1079.82,
        total_tax: 1079.82,
        grand_total: 7078.82,
        amount_in_words:
          'Seven Thousand Seventy-Eight Rupees and Eighty-Two Paise',
      },
    },
  ],
};

const MRR_SPARK  = [850000, 920000, 910000, 980000, 1020000, 1092400, 1147800];
const GST_SPARK  = [153000, 165600, 163800, 176400, 183600,  196632,  206604];
const OUT_SPARK  = [410000, 390000, 360000, 340000, 350000,  330000,  324100];
const RISK_SPARK = [120000, 110000, 95000,  92000,  88000,   90000,   87500];

const PAGE_SIZE = 10;

// ── Invoice Detail Panel ──────────────────────────────────────────────────────
function InvoiceDetailPanel({
  invoice,
  actionBusy,
  onReminder,
  onMarkPaid,
}: {
  invoice: Invoice;
  actionBusy: 'paid' | 'reminder' | null;
  onReminder: () => void;
  onMarkPaid: () => void;
}) {
  const inter = isInterState(invoice);

  return (
    <div className="overflow-hidden rounded-2xl border border-[var(--bd)] bg-[var(--bg-2)] text-sm">
      {/* Header */}
      <div className="flex items-start justify-between border-b border-[var(--bd)] bg-[var(--bg-2)] px-4 py-3">
        <div>
          <p className="font-mono text-xs font-semibold text-[var(--pu)]">
            {invoice.invoice_number}
          </p>
          <p className="mt-0.5 font-semibold text-[var(--ink-1)]">{invoice.school_name}</p>
          <p className="text-xs text-[var(--ink-3)]">
            Issued {fmtDate(invoice.invoice_date)} · Due {fmtDate(invoice.due_date)}
          </p>
        </div>
        <StatusChip status={invoice.status} />
      </div>

      {/* Seller / Buyer */}
      <div className="grid grid-cols-2 gap-px bg-[var(--bd)]">
        {(
          [
            {
              label: 'Seller',
              name: invoice.seller_name,
              gstin: invoice.seller_gstin,
              state: invoice.seller_state,
            },
            {
              label: 'Buyer',
              name: invoice.buyer_name,
              gstin: invoice.buyer_gstin,
              state: invoice.buyer_state,
            },
          ] as const
        ).map(({ label, name, gstin, state }) => (
          <div key={label} className="bg-[var(--bg-2)] px-4 py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
              {label}
            </p>
            <p className="mt-0.5 text-xs font-medium text-[var(--ink-1)] leading-snug">{name}</p>
            <p className="font-mono text-[10px] text-[var(--ink-3)]">GSTIN: {gstin}</p>
            <p className="text-[10px] text-[var(--ink-3)]">{state}</p>
          </div>
        ))}
      </div>

      {/* Line Items */}
      <div className="border-t border-[var(--bd)] px-4 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          Line Items
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
                <th className="pb-1.5 text-left">Description</th>
                <th className="pb-1.5 text-right">SAC</th>
                <th className="pb-1.5 text-right">Qty</th>
                <th className="pb-1.5 text-right">Rate</th>
                <th className="pb-1.5 text-right">GST%</th>
                <th className="pb-1.5 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--bd)]">
              {invoice.line_items.map((item, i) => (
                <tr key={i}>
                  <td className="py-1 pr-2 text-[var(--ink-1)] leading-snug">
                    {item.description}
                  </td>
                  <td className="py-1 text-right font-mono text-[var(--ink-3)]">
                    {item.sac_code}
                  </td>
                  <td className="py-1 text-right text-[var(--ink-2)]">{item.quantity}</td>
                  <td className="py-1 text-right text-[var(--ink-2)]">
                    {fmtINR(item.unit_price)}
                  </td>
                  <td className="py-1 text-right text-[var(--ink-2)]">
                    {item.gst_percent ?? 18}%
                  </td>
                  <td className="py-1 text-right font-medium text-[var(--ink-1)]">
                    {fmtINR(item.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Breakdown */}
      <div className="border-t border-[var(--bd)] px-4 py-3 space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
          Tax Breakdown
        </p>
        <div className="flex justify-between text-xs text-[var(--ink-2)]">
          <span>Subtotal</span>
          <span>{fmtINR(invoice.tax_breakdown.subtotal)}</span>
        </div>
        {inter ? (
          <div className="flex justify-between text-xs text-[var(--ink-2)]">
            <span>IGST @ 18%</span>
            <span>{fmtINR(invoice.tax_breakdown.igst ?? 0)}</span>
          </div>
        ) : (
          <>
            <div className="flex justify-between text-xs text-[var(--ink-2)]">
              <span>CGST @ 9%</span>
              <span>{fmtINR(invoice.tax_breakdown.cgst ?? 0)}</span>
            </div>
            <div className="flex justify-between text-xs text-[var(--ink-2)]">
              <span>SGST @ 9%</span>
              <span>{fmtINR(invoice.tax_breakdown.sgst ?? 0)}</span>
            </div>
          </>
        )}
        <div className="flex justify-between border-t border-[var(--bd)] pt-1.5 text-sm font-bold text-[var(--ink-1)]">
          <span>Grand Total</span>
          <span>{fmtINR(invoice.tax_breakdown.grand_total)}</span>
        </div>
        <p className="text-[10px] italic leading-snug text-[var(--ink-3)]">
          {invoice.tax_breakdown.amount_in_words}
        </p>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="border-t border-[var(--bd)] px-4 py-2.5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
            Notes
          </p>
          <p className="mt-0.5 text-xs text-[var(--ink-2)]">{invoice.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="border-t border-[var(--bd)] px-4 py-3 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={actionBusy !== null}
            onClick={onReminder}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[var(--bd)] px-3 py-2 text-xs font-semibold text-[var(--ink-1)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
            {actionBusy === 'reminder' ? 'Sending…' : 'Send Reminder'}
          </button>
          <button
            type="button"
            disabled={
              actionBusy !== null ||
              invoice.status === 'paid' ||
              invoice.status === 'cancelled'
            }
            onClick={onMarkPaid}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-[var(--pu)] px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <ReceiptIndianRupee className="h-3.5 w-3.5" />
            {actionBusy === 'paid' ? 'Updating…' : 'Mark Paid'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SuperAdminBillingPage() {
  const [mrr, setMrr] = useState<MrrData>(DEMO_MRR);
  const [invoices, setInvoices] = useState<PaginatedResponse<Invoice>>(DEMO_INVOICES);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice>(DEMO_INVOICES.results[0]);
  const [actionBusy, setActionBusy] = useState<'paid' | 'reminder' | null>(null);
  const [useLiveData, setUseLiveData] = useState(false);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    try {
      const [mrrData, invoiceData] = await Promise.all([
        getMrr(),
        getInvoices({
          page,
          page_size: PAGE_SIZE,
          school_name: search.trim() || undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
        }),
      ]);
      setMrr(mrrData);
      setInvoices(invoiceData);
      setUseLiveData(true);
      if (invoiceData.results.length > 0) {
        setSelectedInvoice(invoiceData.results[0]);
      }
    } catch {
      // API unavailable — silently show demo data
      setMrr(DEMO_MRR);
      setInvoices(DEMO_INVOICES);
      setSelectedInvoice(DEMO_INVOICES.results[0]);
      setUseLiveData(false);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  // When using demo data, filter client-side
  const rows = useLiveData
    ? invoices.results
    : DEMO_INVOICES.results.filter((inv) => {
        const matchStatus = statusFilter === 'all' || inv.status === statusFilter;
        const matchSearch =
          !search || inv.school_name.toLowerCase().includes(search.toLowerCase());
        return matchStatus && matchSearch;
      });

  const handleExport = async () => {
    try {
      const blob = await exportGstr1();
      const stamp = new Date().toISOString().slice(0, 10);
      downloadFile(blob, `gstr1-${stamp}.csv`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'GSTR export failed.');
    }
  };

  const handleReminder = async () => {
    setActionBusy('reminder');
    try {
      const res = await sendInvoiceReminder(String(selectedInvoice.id));
      toast.success(`Reminder sent for ${res.invoice_number}.`);
      await loadBilling();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reminder failed.');
    } finally {
      setActionBusy(null);
    }
  };

  const handleMarkPaid = async () => {
    setActionBusy('paid');
    try {
      const updated = await markInvoicePaid(String(selectedInvoice.id));
      setSelectedInvoice(updated);
      toast.success(`Invoice ${updated.invoice_number} marked as paid.`);
      await loadBilling();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Mark paid failed.');
    } finally {
      setActionBusy(null);
    }
  };

  const trendUp = mrr.trend_percent > 0;

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <header className="sa-panel px-6 py-5">
        <p className="font-serif italic text-sm tracking-wide text-[var(--pu)]">Super Admin</p>
        <h1 className="mt-0.5 text-2xl font-bold text-[var(--ink-1)] sm:text-3xl">Billing</h1>
        <p className="mt-1 text-sm text-[var(--ink-2)]">
          MRR tracking, GST invoice management and plan pricing.
          {!useLiveData && !loading && (
            <span className="ml-2 rounded-full bg-[var(--warn-soft)] px-2 py-0.5 text-[10px] font-semibold text-amber-700">
              Demo data
            </span>
          )}
        </p>
      </header>

      {/* KPI Row */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Current MRR"
          value={fmtINR(mrr.current_mrr)}
          trend={`${trendUp ? '+' : ''}${mrr.trend_percent}% vs last month`}
          trendUp={trendUp}
          footnote="Monthly Recurring Revenue"
          spark={MRR_SPARK}
        />
        <KpiCard
          label="GST Collected"
          value={fmtINR(mrr.gst_collected)}
          footnote="Current billing cycle"
          spark={GST_SPARK}
          trendUp
        />
        <KpiCard
          label="Outstanding"
          value={fmtINR(mrr.outstanding_amount)}
          footnote="Open receivables"
          spark={OUT_SPARK}
          trendUp={false}
        />
        <KpiCard
          label="At Risk"
          value={fmtINR(mrr.at_risk_amount)}
          footnote="Potential churn"
          spark={RISK_SPARK}
          trendUp={false}
        />
      </div>

      {/* Plan Pricing Grid */}
      <section className="sa-panel px-6 py-5">
        <div className="mb-5">
          <h2 className="text-base font-semibold text-[var(--ink-1)]">Plan Pricing</h2>
          <p className="text-xs text-[var(--ink-3)]">
            Per school per month · GST @ 18% applicable on all plans
          </p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {PLANS.map((plan) => (
            <PlanCard key={plan.name} plan={plan} />
          ))}
        </div>
      </section>

      {/* Invoice Management */}
      <section className="sa-panel px-6 py-5">
        {/* Section header */}
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-base font-semibold text-[var(--ink-1)]">Invoices</h2>
            <p className="text-xs text-[var(--ink-3)]">
              {invoices.count} total · click a row to
              inspect full GST details
            </p>
          </div>
          {/* Status filter chips */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['all', 'draft', 'sent', 'paid', 'overdue', 'cancelled'] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition-colors ${
                  statusFilter === s
                    ? 'bg-[var(--pu)] text-white'
                    : 'bg-[var(--bg-3)] text-[var(--ink-2)] hover:bg-[var(--bd-2)]'
                }`}
              >
                {s === 'all' ? 'All' : STATUS_META[s].label}
              </button>
            ))}
          </div>
        </div>

        {/* Search + Export row */}
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by school name…"
            className="w-full rounded-xl border border-[var(--bd)] bg-[var(--bg-1,#fff)] px-3 py-2 text-sm text-[var(--ink-1)] placeholder:text-[var(--ink-3)] focus:outline-none focus:ring-2 focus:ring-[var(--pu)] sm:max-w-64"
          />
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--bd)] px-3 py-2 text-xs font-semibold text-[var(--ink-1)] hover:bg-[var(--bg-3)] transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            Export GSTR-1
          </button>
        </div>
        {/* Loading */}
        {loading && (
          <div className="overflow-x-auto rounded-xl border border-[var(--bd)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--bd)] bg-[var(--bg-3)]">
                  {['Invoice #', 'School', 'Grand Total', 'Due Date', 'Status'].map(h => (
                    <th key={h} className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--bd)] animate-pulse">
                {Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-3 py-3"><div className="h-3 w-24 rounded bg-[var(--bg-3)]" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-36 rounded bg-[var(--bg-3)]" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-20 rounded bg-[var(--bg-3)]" /></td>
                    <td className="px-3 py-3"><div className="h-3 w-20 rounded bg-[var(--bg-3)]" /></td>
                    <td className="px-3 py-3"><div className="h-5 w-14 rounded-full bg-[var(--bg-3)]" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Content */}
        {!loading && (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-12">
            {/* Invoice Table — left */}
            <div className="xl:col-span-7">
              <div className="overflow-x-auto rounded-xl border border-[var(--bd)]">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[var(--bd)] bg-[var(--bg-3)]">
                      {['Invoice #', 'School', 'Grand Total', 'Due Date', 'Status'].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]"
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--bd)]">
                    {rows.length === 0 ? (
                      <tr>
                        <td
                          colSpan={5}
                          className="py-10 text-center text-sm text-[var(--ink-3)]"
                        >
                          No invoices match the current filters.
                        </td>
                      </tr>
                    ) : (
                      rows.map((inv) => (
                        <tr
                          key={inv.id}
                          onClick={() => {
                            setSelectedInvoice(inv);
                          }}
                          className={`cursor-pointer transition-colors hover:bg-[var(--bg-3)] ${
                            selectedInvoice?.id === inv.id ? 'bg-[var(--pu-tint)]' : ''
                          }`}
                        >
                          <td className="px-3 py-2.5 font-mono text-xs font-medium text-[var(--pu)]">
                            {inv.invoice_number}
                          </td>
                          <td className="px-3 py-2.5 text-[var(--ink-1)]">{inv.school_name}</td>
                          <td className="px-3 py-2.5 font-semibold text-[var(--ink-1)]">
                            {fmtINR(inv.tax_breakdown.grand_total)}
                          </td>
                          <td className="px-3 py-2.5 text-[var(--ink-2)]">
                            {fmtDate(inv.due_date)}
                          </td>
                          <td className="px-3 py-2.5">
                            <StatusChip status={inv.status} />
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination (live data only) */}
              {useLiveData && invoices.count > PAGE_SIZE && (
                <div className="mt-3 flex items-center justify-between text-xs text-[var(--ink-3)]">
                  <span>
                    {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, invoices.count)} of{' '}
                    {invoices.count}
                  </span>
                  <div className="flex gap-1">
                    <button
                      aria-label="Previous page"
                      disabled={page === 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="rounded-lg border border-[var(--bd)] p-1.5 disabled:opacity-40 hover:bg-[var(--bg-3)]"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </button>
                    <button
                      aria-label="Next page"
                      disabled={!invoices.next}
                      onClick={() => setPage((p) => p + 1)}
                      className="rounded-lg border border-[var(--bd)] p-1.5 disabled:opacity-40 hover:bg-[var(--bg-3)]"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Invoice Detail Panel — right */}
            <div className="xl:col-span-5">
              <InvoiceDetailPanel
                invoice={selectedInvoice}
                actionBusy={actionBusy}
                onReminder={handleReminder}
                onMarkPaid={handleMarkPaid}
              />
            </div>
          </div>
        )}
      </section>
    </div>
  );
}