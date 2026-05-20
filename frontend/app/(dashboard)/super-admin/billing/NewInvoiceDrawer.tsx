'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2, X, FileText, Loader2, AlertTriangle } from 'lucide-react';
import { createInvoice, getInvoices, getPlans, updateInvoice } from '@/lib/api/super-admin/billing';
import { getSchools } from '@/lib/api/super-admin/schools';
import type {
  Invoice,
  InvoiceLineItem,
  PlansCatalog,
  SchoolTenant,
  SubscriptionPlan,
} from '@/types/super-admin';

// ── State code map (must match billing/page.tsx) ─────────────────────────────
const STATE_CODE: Record<string, string> = {
  'Andhra Pradesh': '37', 'Telangana': '36', 'Karnataka': '29', 'Tamil Nadu': '33',
  'Kerala': '32', 'Maharashtra': '27', 'Gujarat': '24', 'Rajasthan': '08',
  'Madhya Pradesh': '23', 'Uttar Pradesh': '09', 'Bihar': '10', 'West Bengal': '19',
  'Odisha': '21', 'Jharkhand': '20', 'Chhattisgarh': '22', 'Haryana': '06',
  'Punjab': '03', 'Himachal Pradesh': '02', 'Uttarakhand': '05', 'Delhi': '07',
  'Goa': '30', 'Assam': '18', 'Manipur': '14', 'Meghalaya': '17',
  'Tripura': '16', 'Sikkim': '11',
};

const SELLER_DEFAULTS = {
  name: 'Eskoolia Technologies Pvt Ltd',
  gstin: '29AABCE1234F1ZS',
  state: 'Karnataka',
};

// ── Helpers ──────────────────────────────────────────────────────────────────
function fmtINR(n: number) {
  return `₹ ${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function toISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDays(d: Date, days: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + days);
  return x;
}

// Mirrors backend build_invoice_number(): INV-YYYYMM-XXXXXXXX (8 hex chars, upper)
function generateInvoiceNumber(): string {
  const now = new Date();
  const yyyymm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  let suffix = '';
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) {
    const buf = new Uint8Array(4);
    crypto.getRandomValues(buf);
    suffix = Array.from(buf, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
  } else {
    suffix = Math.random().toString(16).slice(2, 10).toUpperCase().padEnd(8, '0');
  }
  return `INV-${yyyymm}-${suffix}`;
}

function amountInWords(num: number): string {
  if (!num) return 'Indian Rupees Zero Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n: number): string => n < 20 ? (ones[n] ?? '') : `${tens[Math.floor(n / 10)] ?? ''}${n % 10 ? ' ' + (ones[n % 10] ?? '') : ''}`;
  const three = (n: number): string => {
    const h = Math.floor(n / 100); const r = n % 100;
    return (h ? `${ones[h]} Hundred${r ? ' ' : ''}` : '') + (r ? two(r) : '');
  };
  const n = Math.round(num);
  const cr = Math.floor(n / 10000000);
  const lk = Math.floor((n % 10000000) / 100000);
  const th = Math.floor((n % 100000) / 1000);
  const rem = n % 1000;
  let words = '';
  if (cr) words += `${two(cr)} Crore `;
  if (lk) words += `${two(lk)} Lakh `;
  if (th) words += `${two(th)} Thousand `;
  if (rem) words += three(rem);
  return `Indian Rupees ${words.trim()} Only`;
}

// ── UI primitives (match Add School styling) ─────────────────────────────────
const inputCls =
  'h-[38px] w-full rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 text-[13px] text-[var(--ink-1)] outline-none transition focus:border-[var(--pu)] focus:shadow-[0_0_0_3px_rgba(109,74,255,.12)]';
const selectCls = inputCls;
const monoInputCls = `${inputCls} font-mono text-[12px]`;

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </span>
      {children}
      {hint && <span className="text-[11px] text-[var(--ink-3)]">{hint}</span>}
    </label>
  );
}

function SectionHead({ num, title }: { num: string; title: string }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="grid h-6 w-6 place-items-center rounded-md bg-[var(--pu-soft)] text-[11px] font-bold text-[var(--pu-deep)]">
        {num}
      </span>
      <h3 className="text-[14px] font-semibold text-[var(--ink-1)]">{title}</h3>
    </div>
  );
}

// ── Drawer ───────────────────────────────────────────────────────────────────
export interface NewInvoiceDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: (invoice: Invoice) => void;
  /**
   * When provided, the drawer opens in **edit mode**: fields are pre-filled
   * from this invoice, line items / amounts are locked (re-issue for amount
   * corrections), and submit calls `updateInvoice` instead of `createInvoice`.
   */
  invoice?: Invoice | null;
}

type LineDraft = {
  description: string;
  sac_code: string;
  quantity: number;
  unit_price: number;
};

const blankLine = (sac = '998313'): LineDraft => ({
  description: '',
  sac_code: sac,
  quantity: 1,
  unit_price: 0,
});

export default function NewInvoiceDrawer({ open, onClose, onCreated, invoice }: NewInvoiceDrawerProps) {
  const isEditMode = !!invoice;
  const today = useMemo(() => new Date(), []);
  const [schools, setSchools] = useState<SchoolTenant[]>([]);
  const [plans, setPlans] = useState<PlansCatalog | null>(null);
  const [loadingCatalogs, setLoadingCatalogs] = useState(false);

  const [tenantId, setTenantId] = useState('');
  const [planCode, setPlanCode] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(toISO(today));
  const [dueDate, setDueDate] = useState(toISO(addDays(today, 15)));
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [reverseCharge, setReverseCharge] = useState(false);
  const [statusValue, setStatusValue] = useState<'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled'>('draft');
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('Payment due within 15 days. Late payments attract interest @ 1.5% per month.');
  const [lines, setLines] = useState<LineDraft[]>([blankLine()]);
  const [submitting, setSubmitting] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<{
    id: string;
    invoice_number: string;
    status: string;
  } | null>(null);
  const [forceCreate, setForceCreate] = useState(false);

  // Reset / pre-fill state every time drawer opens.
  useEffect(() => {
    if (!open) return;
    if (invoice) {
      // Edit mode — hydrate from existing invoice
      setTenantId(invoice.tenant_id || '');
      setPlanCode('');
      setInvoiceDate(invoice.invoice_date || toISO(today));
      setDueDate(invoice.due_date || toISO(addDays(today, 15)));
      setInvoiceNumber(invoice.invoice_number || '');
      setReverseCharge(false);
      setStatusValue(invoice.status as typeof statusValue);
      setNotes(invoice.notes || '');
      setTerms(invoice.terms_conditions || '');
      setLines(
        (invoice.line_items || []).map((li) => ({
          description: String(li.description ?? ''),
          sac_code: String(li.sac_code ?? '998313'),
          quantity: Number(li.quantity ?? 1),
          unit_price: Number(li.unit_price ?? 0),
        })),
      );
    } else {
      setTenantId('');
      setPlanCode('');
      setInvoiceDate(toISO(today));
      setDueDate(toISO(addDays(today, 15)));
      setInvoiceNumber(generateInvoiceNumber());
      setReverseCharge(false);
      setStatusValue('draft');
      setNotes('');
      setTerms('Payment due within 15 days. Late payments attract interest @ 1.5% per month.');
      setLines([blankLine()]);
    }
    setDuplicateWarning(null);
    setForceCreate(false);
  }, [open, invoice, today]);

  // Load schools + plans EVERY time the drawer opens so newly created plans appear.
  useEffect(() => {
    if (!open) return;
    setLoadingCatalogs(true);
    Promise.all([
      getSchools({ page: 1, page_size: 200 }),
      getPlans(),
    ])
      .then(([sRes, pRes]) => {
        setSchools(sRes.results || []);
        setPlans(pRes);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : 'Failed to load schools/plans.');
      })
      .finally(() => setLoadingCatalogs(false));
  }, [open]);

  // Duplicate detection: skip entirely in edit mode (we're editing an existing
  // invoice, not creating a new one).
  useEffect(() => {
    if (!open || isEditMode) {
      setDuplicateWarning(null);
      return;
    }
    if (!tenantId || !invoiceDate) {
      setDuplicateWarning(null);
      return;
    }
    setForceCreate(false);
    const [year, month] = invoiceDate.split('-');
    const lastDay = new Date(Number(year), Number(month), 0).getDate();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      getInvoices({
        tenant_id: tenantId,
        date_from: `${year}-${month}-01`,
        date_to: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
        page_size: 10,
      })
        .then((res) => {
          if (controller.signal.aborted) return;
          const planDesc = lines[0]?.description?.trim() || '';
          const match = (res.results ?? []).find((inv) => {
            if (inv.status === 'cancelled') return false;
            if (!planDesc) return true;
            const invDesc = (inv.line_items?.[0] as { description?: string } | undefined)?.description?.trim() ?? '';
            return invDesc === planDesc;
          });
          setDuplicateWarning(
            match
              ? { id: match.id, invoice_number: match.invoice_number, status: match.status }
              : null,
          );
        })
        .catch(() => {
          // Silently ignore — duplicate check is best-effort; backend enforces via 409
        });
    }, 600);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, invoiceDate, isEditMode, open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const selectedSchool = useMemo(
    () => schools.find((s) => s.tenant_id === tenantId) || null,
    [schools, tenantId],
  );
  const selectedPlan = useMemo<SubscriptionPlan | null>(
    () => plans?.plans.find((p) => p.code === planCode) || null,
    [plans, planCode],
  );

  // Auto-pick the school's existing subscription plan when a school is selected.
  // Skips 'trial' / 'custom' (no matching catalog entry). User may still override.
  // Disabled in edit mode (line items already populated from the invoice).
  useEffect(() => {
    if (isEditMode) return;
    if (!selectedSchool || !plans) return;
    const schoolPlan = (selectedSchool.plan || '').toLowerCase();
    if (!schoolPlan || schoolPlan === 'trial' || schoolPlan === 'custom') return;
    const match = plans.plans.find((p) => p.code.toLowerCase() === schoolPlan);
    if (match) setPlanCode(match.code);
  }, [selectedSchool, plans, isEditMode]);

  // Auto-populate first line when plan picked (create mode only)
  useEffect(() => {
    if (isEditMode) return;
    if (!selectedPlan) return;
    setLines((prev) => {
      const next = [...prev];
      next[0] = {
        description: `Eskoolia ERP — ${selectedPlan.name} plan`,
        sac_code: plans?.sac_code || '998313',
        quantity: 1,
        unit_price: selectedPlan.price_inr,
      };
      return next;
    });
  }, [selectedPlan, plans?.sac_code, isEditMode]);

  // Tax math
  const subtotal = useMemo(
    () => lines.reduce((sum, l) => sum + (Number(l.quantity) || 0) * (Number(l.unit_price) || 0), 0),
    [lines],
  );
  const gstPercent = plans?.gst_percent ?? 18;
  const buyerState = selectedSchool?.state || invoice?.buyer_state || '';
  const sellerState = SELLER_DEFAULTS.state;
  const isInterState = !!buyerState && buyerState.trim().toLowerCase() !== sellerState.trim().toLowerCase();
  const igst = isInterState ? +(subtotal * (gstPercent / 100)).toFixed(2) : 0;
  const cgst = !isInterState ? +(subtotal * (gstPercent / 200)).toFixed(2) : 0;
  const sgst = !isInterState ? +(subtotal * (gstPercent / 200)).toFixed(2) : 0;
  const totalTax = +(igst + cgst + sgst).toFixed(2);
  const grandTotal = +(subtotal + totalTax).toFixed(2);

  const buyerCode = STATE_CODE[buyerState] || '';
  const sellerCode = STATE_CODE[sellerState] || '';

  // Line helpers
  const updateLine = (idx: number, patch: Partial<LineDraft>) =>
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, blankLine(plans?.sac_code || '998313')]);
  const removeLine = (idx: number) =>
    setLines((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  // Validation
  const canSubmit = isEditMode
    ? !!invoice && !!dueDate && !submitting
    : !!selectedSchool &&
      !!invoiceDate &&
      !!dueDate &&
      lines.length > 0 &&
      lines.every((l) => l.description.trim() && (Number(l.quantity) || 0) > 0 && (Number(l.unit_price) || 0) >= 0) &&
      subtotal > 0 &&
      !submitting &&
      (!duplicateWarning || forceCreate);

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isEditMode && invoice) {
        // Edit mode — only safely-editable fields are sent (status, due_date,
        // notes, terms_conditions). Line items / amounts are not allowed to
        // change once an invoice is issued (GST-compliant practice).
        const updated = await updateInvoice(String(invoice.id), {
          status: statusValue,
          due_date: dueDate,
          notes: notes.trim(),
          terms_conditions: terms.trim(),
        });
        toast.success(`Invoice ${updated.invoice_number} updated.`);
        onCreated(updated);
        onClose();
        return;
      }
      if (!selectedSchool) return;
      const lineItems: InvoiceLineItem[] = lines.map((l) => {
        const amount = +((Number(l.quantity) || 0) * (Number(l.unit_price) || 0)).toFixed(2);
        const gstAmount = +(amount * (gstPercent / 100)).toFixed(2);
        return {
          description: l.description.trim(),
          sac_code: l.sac_code || (plans?.sac_code || '998313'),
          quantity: Number(l.quantity) || 0,
          unit_price: Number(l.unit_price) || 0,
          amount,
          gst_percent: gstPercent,
          gst_amount: gstAmount,
        };
      });

      const created = await createInvoice({
        tenant_id: selectedSchool.tenant_id,
        invoice_number: invoiceNumber.trim() || undefined,
        ...(forceCreate ? { force: true } : {}),
        school_name: selectedSchool.name,
        invoice_date: invoiceDate,
        due_date: dueDate,
        status: statusValue,
        seller_name: SELLER_DEFAULTS.name,
        seller_gstin: SELLER_DEFAULTS.gstin,
        seller_state: SELLER_DEFAULTS.state,
        buyer_name: selectedSchool.name,
        buyer_gstin: selectedSchool.gstin || '',
        buyer_state: selectedSchool.state || '',
        line_items: lineItems,
        tax_breakdown: {
          subtotal: +subtotal.toFixed(2),
          igst,
          cgst,
          sgst,
          total_tax: totalTax,
          grand_total: grandTotal,
          amount_in_words: amountInWords(grandTotal),
        },
        notes: notes.trim() || undefined,
        terms_conditions: terms.trim() || undefined,
      } as unknown as Partial<Invoice>);

      toast.success(`Invoice ${created.invoice_number} ${statusValue === 'sent' ? 'sent' : 'saved as draft'}.`);
      onCreated(created);
      onClose();
    } catch (err: unknown) {
      // 409 Conflict = backend detected a duplicate; surface it as a warning
      // so the user can explicitly confirm before overriding.
      const apiErr = err as { status?: number; data?: { code?: string; detail?: string; existing_invoice?: { id: string; invoice_number: string; status: string } } };
      if (apiErr?.status === 409 && apiErr?.data?.code === 'duplicate_invoice') {
        const existing = apiErr.data?.existing_invoice;
        if (existing) setDuplicateWarning(existing);
        toast.warn(apiErr.data?.detail ?? 'Duplicate invoice detected. Review and confirm to override.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Failed to create invoice.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, isEditMode, invoice, selectedSchool, lines, gstPercent, invoiceNumber, invoiceDate, dueDate, statusValue, subtotal, igst, cgst, sgst, totalTax, grandTotal, notes, terms, plans?.sac_code, onClose, onCreated]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex">
      {/* Overlay */}
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="flex-1 bg-black/40 backdrop-blur-[2px] transition"
      />

      {/* Drawer */}
      <aside
        className="relative flex h-full w-full max-w-[1080px] flex-col bg-[var(--bg-1)] shadow-2xl"
        role="dialog"
        aria-label={isEditMode ? 'Edit invoice' : 'Create new invoice'}
      >
        {/* Header */}
        <header className="flex items-start justify-between border-b border-[var(--bd)] px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--pu-soft)] text-[var(--pu-deep)]">
              <FileText className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[18px] font-bold text-[var(--ink-1)]">
                {isEditMode ? (
                  <>Edit <span className="font-serif italic text-[var(--pu)]">Invoice</span></>
                ) : (
                  <>New <span className="font-serif italic text-[var(--pu)]">Invoice</span></>
                )}
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--ink-2)]">
                {isEditMode && invoice ? (
                  <>Invoice <span className="font-mono">{invoice.invoice_number}</span> · SAC {plans?.sac_code || '998313'} · GST {gstPercent}%</>
                ) : (
                  <>GST-compliant tax invoice · SAC {plans?.sac_code || '998313'} · GST {gstPercent}%</>
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--bd)] text-[var(--ink-2)] hover:bg-[var(--bg-3)]"
            aria-label="Close drawer"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        {/* Body — 2-col */}
        <div className="grid flex-1 grid-cols-1 overflow-hidden lg:grid-cols-[1fr_360px]">
          {/* Form */}
          <div className="overflow-y-auto px-6 py-5">
            {loadingCatalogs && (
              <div className="mb-4 flex items-center gap-2 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2 text-[12.5px] text-[var(--ink-2)]">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading schools and plans…
              </div>
            )}

            {isEditMode && (
              <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="flex-1 text-[12.5px] text-amber-800 dark:text-amber-300">
                    <p className="font-semibold">Editing an issued invoice</p>
                    <p className="mt-1 text-[12px]">
                      School, line items, amounts and GST cannot be modified once
                      issued. To correct those, cancel this invoice and create a
                      new one. You can still update <strong>status</strong>,{' '}
                      <strong>due date</strong>, <strong>notes</strong> and{' '}
                      <strong>payment terms</strong> here.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 1. Billed to */}
            <section className="mb-6">
              <SectionHead num="1" title="Billed to" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="School" required>
                  <select
                    title="School"
                    className={selectCls}
                    value={tenantId}
                    onChange={(e) => setTenantId(e.target.value)}
                    disabled={isEditMode}
                  >
                    <option value="">{isEditMode ? (invoice?.school_name || invoice?.buyer_name || 'School') : 'Select a school…'}</option>
                    {schools.map((s) => (
                      <option key={s.tenant_id} value={s.tenant_id}>
                        {s.name} {s.state ? `· ${s.state}` : ''}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label="Subscription plan"
                  hint={
                    selectedSchool
                      ? `Current subscription: ${selectedSchool.plan ? selectedSchool.plan.charAt(0).toUpperCase() + selectedSchool.plan.slice(1) : '—'} (auto-selected; override if needed)`
                      : 'Pick a school first to auto-select its plan'
                  }
                >
                  <select
                    title="Subscription plan"
                    className={selectCls}
                    value={planCode}
                    onChange={(e) => setPlanCode(e.target.value)}
                    disabled={isEditMode}
                  >
                    <option value="">— No plan —</option>
                    {plans?.plans.map((p) => {
                      const isCurrent =
                        !!selectedSchool && selectedSchool.plan?.toLowerCase() === p.code.toLowerCase();
                      return (
                        <option key={p.code} value={p.code}>
                          {p.name} · ₹{p.price_inr.toLocaleString('en-IN')}/
                          {p.billing_cycle === 'monthly' ? 'mo' : 'yr'}
                          {isCurrent ? ' · current' : ''}
                        </option>
                      );
                    })}
                  </select>
                </Field>
                <Field label="GSTIN">
                  <input
                    title="GSTIN"
                    className={monoInputCls}
                    value={selectedSchool?.gstin || invoice?.buyer_gstin || ''}
                    readOnly
                    placeholder="Auto from school"
                  />
                </Field>
                <Field label="State" hint={buyerCode ? `State code ${buyerCode}` : 'Selected school’s state'}>
                  <input
                    title="State"
                    className={inputCls}
                    value={selectedSchool?.state || invoice?.buyer_state || ''}
                    readOnly
                    placeholder="Auto from school"
                  />
                </Field>
              </div>
            </section>

            {/* Duplicate invoice warning banner */}
            {duplicateWarning && (
              <div className="mb-5 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-700 dark:bg-amber-950/40">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <div className="flex-1 text-[12.5px] text-amber-800 dark:text-amber-300">
                    <p className="font-semibold">
                      Duplicate detected — invoice{' '}
                      <span className="font-mono">{duplicateWarning.invoice_number}</span>{' '}
                      already exists for this school in this billing month
                      {' '}(<span className="capitalize">{duplicateWarning.status}</span>).
                    </p>
                    <p className="mt-1 text-[12px]">
                      Best practice: void or cancel the existing invoice before generating a new one.
                      If this is intentional (e.g. a correction or multi-license), confirm below.
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex items-center gap-2">
                  {!forceCreate ? (
                    <button
                      type="button"
                      onClick={() => setForceCreate(true)}
                      className="rounded-lg border border-amber-400 bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-800 hover:bg-amber-200 dark:border-amber-600 dark:bg-amber-900/50 dark:text-amber-200"
                    >
                      I understand — create anyway
                    </button>
                  ) : (
                    <span className="flex items-center gap-1.5 rounded-lg bg-amber-100 px-3 py-1.5 text-[12px] font-semibold text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                      <span className="h-2 w-2 rounded-full bg-amber-500" />
                      Override confirmed — submit when ready
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => { setDuplicateWarning(null); setForceCreate(false); }}
                    className="ml-auto text-[11.5px] text-amber-600 underline hover:text-amber-800"
                  >
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* 2. Invoice details */}
            <section className="mb-6">
              <SectionHead num="2" title="Invoice details" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <Field label="Invoice no." hint="Auto-generated">
                  <input
                    className={`${monoInputCls} cursor-not-allowed bg-[var(--bg-3)] text-[var(--ink-2)]`}
                    value={invoiceNumber}
                    readOnly
                    tabIndex={-1}
                    placeholder="INV-YYYYMM-XXXXXXXX"
                  />
                </Field>
                <Field label="Invoice date" required>
                  <input
                    title="Invoice date"
                    type="date"
                    className={`${inputCls} ${isEditMode ? 'cursor-not-allowed bg-[var(--bg-3)] text-[var(--ink-2)]' : ''}`}
                    value={invoiceDate}
                    onChange={(e) => setInvoiceDate(e.target.value)}
                    readOnly={isEditMode}
                  />
                </Field>
                <Field label="Due date" required>
                  <input
                    title="Due date"
                    type="date"
                    className={inputCls}
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </Field>
                <Field label="Status">
                  <select
                    title="Status"
                    className={selectCls}
                    value={statusValue}
                    onChange={(e) => setStatusValue(e.target.value as typeof statusValue)}
                  >
                    <option value="draft">Draft</option>
                    <option value="sent">Sent</option>
                    {isEditMode && <option value="paid">Paid</option>}
                    {isEditMode && <option value="overdue">Overdue</option>}
                    {isEditMode && <option value="cancelled">Cancelled</option>}
                  </select>
                </Field>
                <Field label="Reverse charge">
                  <select
                    title="Reverse charge"
                    className={selectCls}
                    value={reverseCharge ? 'yes' : 'no'}
                    onChange={(e) => setReverseCharge(e.target.value === 'yes')}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
                <Field label="Currency">
                  <input title="Currency" className={inputCls} value="INR" readOnly />
                </Field>
              </div>
            </section>

            {/* 3. Line items */}
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <SectionHead num="3" title="Line items" />
                {!isEditMode && (
                  <button
                    type="button"
                    onClick={addLine}
                    className="-mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-1)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink-1)] hover:bg-[var(--bg-3)]"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add line
                  </button>
                )}
              </div>

              <div className="overflow-hidden rounded-xl border border-[var(--bd)]">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-[var(--bg-2)] text-[11px] uppercase tracking-wide text-[var(--ink-2)]">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Description</th>
                      <th className="w-[90px] px-3 py-2 text-left font-semibold">SAC</th>
                      <th className="w-[70px] px-3 py-2 text-right font-semibold">Qty</th>
                      <th className="w-[120px] px-3 py-2 text-right font-semibold">Rate (₹)</th>
                      <th className="w-[130px] px-3 py-2 text-right font-semibold">Amount (₹)</th>
                      <th className="w-[40px] px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, idx) => {
                      const amount = (Number(line.quantity) || 0) * (Number(line.unit_price) || 0);
                      return (
                        <tr key={idx} className="border-t border-[var(--bd)]">
                          <td className="px-3 py-2">
                            <input
                              className={`${inputCls} h-9 ${isEditMode ? 'cursor-not-allowed bg-[var(--bg-3)]' : ''}`}
                              value={line.description}
                              onChange={(e) => updateLine(idx, { description: e.target.value })}
                              placeholder="e.g. Eskoolia ERP — Premium plan"
                              readOnly={isEditMode}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              title="SAC code"
                              className={`${monoInputCls} h-9 ${isEditMode ? 'cursor-not-allowed bg-[var(--bg-3)]' : ''}`}
                              value={line.sac_code}
                              onChange={(e) => updateLine(idx, { sac_code: e.target.value })}
                              readOnly={isEditMode}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              title="Quantity"
                              type="number"
                              min={0}
                              className={`${inputCls} h-9 text-right ${isEditMode ? 'cursor-not-allowed bg-[var(--bg-3)]' : ''}`}
                              value={line.quantity}
                              onChange={(e) => updateLine(idx, { quantity: Number(e.target.value) })}
                              readOnly={isEditMode}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              title="Rate"
                              type="number"
                              min={0}
                              step={0.01}
                              className={`${inputCls} h-9 text-right ${isEditMode ? 'cursor-not-allowed bg-[var(--bg-3)]' : ''}`}
                              value={line.unit_price}
                              onChange={(e) => updateLine(idx, { unit_price: Number(e.target.value) })}
                              readOnly={isEditMode}
                            />
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[12.5px] text-[var(--ink-1)]">
                            {amount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="px-1 py-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeLine(idx)}
                              disabled={lines.length === 1 || isEditMode}
                              className="grid h-7 w-7 place-items-center rounded-md text-[var(--ink-3)] hover:bg-[var(--danger-soft)] hover:text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-30"
                              aria-label="Remove line"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* 4. Notes & terms */}
            <section className="mb-6">
              <SectionHead num="4" title="Notes & terms" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Notes" hint="Internal or buyer-visible note">
                  <textarea
                    title="Notes"
                    className={`${inputCls} h-[88px] py-2`}
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes…"
                  />
                </Field>
                <Field label="Payment terms">
                  <textarea
                    title="Payment terms"
                    className={`${inputCls} h-[88px] py-2`}
                    value={terms}
                    onChange={(e) => setTerms(e.target.value)}
                  />
                </Field>
              </div>
            </section>
          </div>

          {/* Live preview / tax-logic panel */}
          <aside className="border-l border-[var(--bd)] bg-[var(--bg-2)] px-5 py-5 overflow-y-auto">
            <h4 className="mb-3 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
              Tax summary
            </h4>
            <div className="space-y-2 rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-4 py-3 text-[12.5px]">
              <Row label="Subtotal" value={fmtINR(subtotal)} />
              <Row label="Discount" value={fmtINR(0)} muted />
              <Row label="Taxable value" value={fmtINR(subtotal)} />
              {isInterState ? (
                <Row label={`IGST · ${gstPercent}%`} value={fmtINR(igst)} accent />
              ) : (
                <>
                  <Row label={`CGST · ${gstPercent / 2}%`} value={fmtINR(cgst)} accent />
                  <Row label={`SGST · ${gstPercent / 2}%`} value={fmtINR(sgst)} accent />
                </>
              )}
              <div className="mt-2 border-t border-dashed border-[var(--bd)] pt-2">
                <Row label="Total payable" value={fmtINR(grandTotal)} bold />
              </div>
              <p className="mt-1 text-[11px] italic text-[var(--ink-3)]">{amountInWords(grandTotal)}</p>
            </div>

            <h4 className="mb-3 mt-5 text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
              Tax logic applied
            </h4>
            <div className="space-y-2 rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-4 py-3 text-[12.5px]">
              <Row
                label="Seller state"
                value={
                  <span className="rounded-md bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[11.5px]">
                    {sellerCode || '—'} {sellerState}
                  </span>
                }
              />
              <Row
                label="Buyer state"
                value={
                  <span className="rounded-md bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[11.5px]">
                    {buyerCode || '—'} {buyerState || '—'}
                  </span>
                }
              />
              <Row label="Supply type" value={isInterState ? 'Inter-state' : 'Intra-state'} />
              <Row label="Applied" value={isInterState ? 'IGST' : 'CGST + SGST'} accent />
              <Row label="Reverse charge" value={reverseCharge ? 'Yes' : 'No'} />
              <Row
                label="SAC"
                value={
                  <span className="rounded-md bg-[var(--bg-2)] px-1.5 py-0.5 font-mono text-[11.5px]">
                    {plans?.sac_code || '998313'} — {plans?.sac_description || 'Education software'}
                  </span>
                }
              />
            </div>
          </aside>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-between gap-3 border-t border-[var(--bd)] bg-[var(--bg-1)] px-6 py-3">
          <div className="text-[12.5px] text-[var(--ink-2)]">
            Total payable{' '}
            <span className="ml-1 font-serif text-[18px] font-semibold text-[var(--ink-1)]">{fmtINR(grandTotal)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-1)] hover:bg-[var(--bg-3)]"
            >
              Cancel
            </button>
            {isEditMode ? (
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--pu)] px-4 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Save changes
              </button>
            ) : (
              <>
                <button
                  type="button"
                  onClick={() => { setStatusValue('draft'); void handleSubmit(); }}
                  disabled={!canSubmit}
                  className="rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-1)] hover:bg-[var(--bg-3)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && statusValue === 'draft' ? 'Saving…' : 'Save as draft'}
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusValue('sent'); void handleSubmit(); }}
                  disabled={!canSubmit}
                  className="inline-flex items-center gap-2 rounded-xl bg-[var(--pu)] px-4 py-2 text-[12.5px] font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting && statusValue === 'sent' && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  Save &amp; send
                </button>
              </>
            )}
          </div>
        </footer>
      </aside>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  accent,
  muted,
}: {
  label: string;
  value: React.ReactNode;
  bold?: boolean;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={`text-[12px] ${muted ? 'text-[var(--ink-3)]' : 'text-[var(--ink-2)]'}`}>{label}</span>
      <span
        className={[
          bold ? 'font-serif text-[15px] font-semibold text-[var(--ink-1)]' : 'font-mono text-[12.5px] text-[var(--ink-1)]',
          accent ? 'text-[var(--pu-deep)]' : '',
        ].join(' ')}
      >
        {value}
      </span>
    </div>
  );
}
