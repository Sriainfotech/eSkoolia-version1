'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import { Plus, Trash2, X, Tag, Loader2, Star, Check } from 'lucide-react';
import { createPlan, updatePlan } from '@/lib/api/super-admin/billing';
import type { SubscriptionPlan } from '@/types/super-admin';

// ── UI primitives (match NewInvoiceDrawer styling) ───────────────────────────
const inputCls =
  'h-[38px] w-full rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 text-[13px] text-[var(--ink-1)] outline-none transition focus:border-[var(--pu)] focus:shadow-[0_0_0_3px_rgba(109,74,255,.12)]';
const selectCls = inputCls;
const monoInputCls = `${inputCls} font-mono text-[12px]`;
const textareaCls =
  'min-h-[80px] w-full rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 py-2 text-[13px] text-[var(--ink-1)] outline-none transition focus:border-[var(--pu)] focus:shadow-[0_0_0_3px_rgba(109,74,255,.12)]';

function Field({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--ink-2)]">
        {label} {required && <span className="text-[var(--danger)]">*</span>}
      </span>
      {children}
      {error
        ? <span className="text-[11px] font-medium text-[var(--danger)]">{error}</span>
        : hint && <span className="text-[11px] text-[var(--ink-3)]">{hint}</span>}
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

// Slugify name → code suggestion (lowercase snake_case, matches
// Stripe/Razorpay-style plan identifiers used as immutable billing keys).
function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 64);
}

function fmtINR(n: number) {
  return `₹ ${(Number.isFinite(n) ? n : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export interface NewPlanDrawerProps {
  open: boolean;
  onClose: () => void;
  onCreated: (plan: SubscriptionPlan) => void;
  /** When provided, the drawer is in EDIT mode; code becomes immutable. */
  existing?: SubscriptionPlan | null;
}

export default function NewPlanDrawer({ open, onClose, onCreated, existing }: NewPlanDrawerProps) {
  const isEdit = !!existing;
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [codeEdited, setCodeEdited] = useState(false);
  const [description, setDescription] = useState('');
  const [priceInr, setPriceInr] = useState<number>(0);
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('monthly');
  const [popular, setPopular] = useState(false);
  const [sortOrder, setSortOrder] = useState<number>(50);
  const [features, setFeatures] = useState<string[]>(['']);
  const [sacCode, setSacCode] = useState('998313');
  const [submitting, setSubmitting] = useState(false);
  const [planErrors, setPlanErrors] = useState<Record<string, string>>({});

  // Reset on open (or prefill when editing)
  useEffect(() => {
    if (!open) return;
    if (existing) {
      setName(existing.name);
      setCode(existing.code);
      setCodeEdited(true);
      setDescription(existing.description || '');
      setPriceInr(Number(existing.price_inr) || 0);
      setBillingCycle((existing.billing_cycle as 'monthly' | 'yearly') || 'monthly');
      setPopular(!!existing.popular);
      setSortOrder(existing.sort_order ?? 50);
      setFeatures(existing.features && existing.features.length ? [...existing.features] : ['']);
      setSacCode(existing.sac_code || '998313');
    } else {
      setName('');
      setCode('');
      setCodeEdited(false);
      setDescription('');
      setPriceInr(0);
      setBillingCycle('monthly');
      setPopular(false);
      setSortOrder(50);
      setFeatures(['']);
      setSacCode('998313');
    }
  }, [open, existing]);

  // Auto-derive code from name unless user has edited it (or we're editing existing)
  useEffect(() => {
    if (!codeEdited) setCode(slugify(name));
  }, [name, codeEdited]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const cleanFeatures = useMemo(
    () => features.map((f) => f.trim()).filter(Boolean),
    [features],
  );

  const gstAmount = useMemo(() => +(priceInr * 0.18).toFixed(2), [priceInr]);
  const grandTotal = useMemo(() => +(priceInr + gstAmount).toFixed(2), [priceInr, gstAmount]);

  const canSubmit =
    !!name.trim() && !!code.trim() && priceInr > 0 && cleanFeatures.length > 0 && !submitting;

  const updateFeature = (idx: number, value: string) =>
    setFeatures((prev) => prev.map((f, i) => (i === idx ? value : f)));
  const addFeature = () => setFeatures((prev) => [...prev, '']);
  const removeFeature = (idx: number) =>
    setFeatures((prev) => (prev.length === 1 ? prev : prev.filter((_, i) => i !== idx)));

  const handleSubmit = useCallback(async () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Plan name is required.';
    else if (name.trim().length > 50) errs.name = 'Plan name must be 50 characters or fewer.';
    if (!code.trim()) errs.code = 'Plan code is required.';
    if (priceInr <= 0) errs.price = 'Price must be greater than 0.';
    if (cleanFeatures.length === 0) errs.features = 'Add at least one feature.';
    if (Object.keys(errs).length > 0) { setPlanErrors(errs); return; }
    setPlanErrors({});
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const basePayload = {
        name: name.trim(),
        description: description.trim(),
        price_inr: priceInr,
        billing_cycle: billingCycle,
        popular,
        sort_order: sortOrder,
        features: cleanFeatures,
        sac_code: sacCode || '998313',
        is_active: true,
      };
      const saved = isEdit
        ? await updatePlan(existing!.code, basePayload)
        : await createPlan({ ...basePayload, code: code.trim() });
      toast.success(`Plan "${saved.name}" ${isEdit ? 'updated' : 'created'}.`);
      onCreated(saved);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to save plan.');
    } finally {
      setSubmitting(false);
    }
  }, [canSubmit, isEdit, existing, name, code, description, priceInr, billingCycle, popular, sortOrder, cleanFeatures, onCreated, onClose]);

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
        aria-label="Create new subscription plan"
      >
        {/* Header */}
        <header className="flex items-start justify-between border-b border-[var(--bd)] px-6 py-4">
          <div className="flex items-start gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-[var(--pu-soft)] text-[var(--pu-deep)]">
              <Tag className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-[18px] font-bold text-[var(--ink-1)]">
                {isEdit ? 'Edit' : 'New'}{' '}
                <span className="font-serif italic text-[var(--pu)]">Subscription plan</span>
              </h2>
              <p className="mt-0.5 text-[12px] text-[var(--ink-2)]">
                India-priced · GST 18% under SAC <span className="font-mono">998313</span> (Education software)
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
            {/* 1. Plan basics */}
            <section className="mb-6">
              <SectionHead num="1" title="Plan basics" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Plan name" required error={planErrors.name}>
                  <input
                    title="Plan name"
                    className={`${inputCls}${planErrors.name ? ' !border-[var(--danger)]' : ''}`}
                    maxLength={50}
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (planErrors.name) setPlanErrors(p => ({ ...p, name: '' })); }}
                    placeholder="e.g. Growth"
                  />
                  <span className="text-[11px] text-[var(--ink-3)] self-end">{name.length}/50</span>
                </Field>
                <Field label="Code" required hint={isEdit ? 'Code is immutable after creation.' : 'Auto-generated from name; you can override.'}>
                  <input
                    title="Plan code"
                    className={monoInputCls}
                    value={code}
                    disabled={isEdit}
                    autoComplete="off"
                    onChange={(e) => {
                      const next = slugify(e.target.value);
                      setCode(next);
                      // Only stop auto-deriving from `name` once the user
                      // actually diverges from the name-derived slug.
                      setCodeEdited(next !== slugify(name));
                    }}
                    placeholder="growth"
                  />
                </Field>
                <Field label="Description">
                  <input
                    title="Description"
                    className={inputCls}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="One-line tagline shown on the plan card."
                  />
                </Field>
                <Field label="Billing cycle">
                  <select
                    title="Billing cycle"
                    className={selectCls}
                    value={billingCycle}
                    onChange={(e) => setBillingCycle(e.target.value as 'monthly' | 'yearly')}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </Field>
                <Field label="Popular?" hint="Highlights the card with a 'Popular' badge.">
                  <select
                    title="Popular"
                    className={selectCls}
                    value={popular ? 'yes' : 'no'}
                    onChange={(e) => setPopular(e.target.value === 'yes')}
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </Field>
                <Field label="Sort order" hint="Lower numbers appear first.">
                  <input
                    title="Sort order"
                    type="number"
                    min={0}
                    className={inputCls}
                    value={sortOrder}
                    onChange={(e) => setSortOrder(Math.max(0, Number(e.target.value) || 0))}
                  />
                </Field>
              </div>
            </section>

            {/* 2. Pricing */}
            <section className="mb-6">
              <SectionHead num="2" title="Pricing" />
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <Field label="Price (₹)" required hint="Excluding GST.">
                  <input
                    title="Price"
                    type="number"
                    min={0}
                    step="0.01"
                    className={monoInputCls}
                    value={priceInr || ''}
                    onChange={(e) => setPriceInr(Math.max(0, Number(e.target.value) || 0))}
                    placeholder="0.00"
                  />
                </Field>
                <Field label="Currency">
                  <input title="Currency" className={inputCls} value="INR" readOnly />
                </Field>
                <Field label="SAC code" hint="6–8 digit service accounting code (default: 998313).">
                  <input
                    title="SAC code"
                    className={monoInputCls}
                    value={sacCode}
                    inputMode="numeric"
                    maxLength={8}
                    onChange={(e) => setSacCode(e.target.value.replace(/\D/g, ''))}
                    placeholder="998313"
                  />
                </Field>
              </div>
              <p className="mt-2 text-[11.5px] text-[var(--ink-3)]">
                GST 18% under SAC {sacCode || '998313'} will be applied automatically on invoices that use this plan.
              </p>
            </section>

            {/* 3. Features */}
            <section className="mb-6">
              <div className="mb-3 flex items-center justify-between">
                <SectionHead num="3" title="Features" />
                <button
                  type="button"
                  onClick={addFeature}
                  className="-mt-2 inline-flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-1)] px-2.5 py-1.5 text-[12px] font-semibold text-[var(--ink-1)] hover:bg-[var(--bg-3)]"
                >
                  <Plus className="h-3.5 w-3.5" /> Add feature
                </button>
              </div>
              <div className="space-y-2">
                {features.map((feat, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      title={`Feature ${idx + 1}`}
                      className={inputCls}
                      value={feat}
                      onChange={(e) => updateFeature(idx, e.target.value)}
                      placeholder="e.g. Up to 500 students"
                    />
                    <button
                      type="button"
                      onClick={() => removeFeature(idx)}
                      disabled={features.length === 1}
                      className="grid h-9 w-9 place-items-center rounded-lg border border-[var(--bd)] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-40"
                      aria-label="Remove feature"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Live preview */}
          <aside className="border-t border-[var(--bd)] bg-[var(--bg-2)] px-5 py-5 lg:border-l lg:border-t-0">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-[var(--ink-3)]">
              Preview
            </p>
            <div
              className={`rounded-xl border bg-[var(--bg-1)] p-4 ${
                popular ? 'border-[var(--pu)] shadow-[0_0_0_3px_rgba(109,74,255,.10)]' : 'border-[var(--bd)]'
              }`}
            >
              <div className="mb-1 flex items-center justify-between">
                <p className="text-[13px] font-semibold text-[var(--ink-1)]">
                  {name.trim() || 'Plan name'}
                </p>
                {popular && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[var(--pu-soft)] px-2 py-0.5 text-[10px] font-semibold text-[var(--pu-deep)]">
                    <Star className="h-2.5 w-2.5" /> Popular
                  </span>
                )}
              </div>
              <p className="font-mono text-[10.5px] text-[var(--ink-3)]">{code || 'code'}</p>
              {description && (
                <p className="mt-2 text-[12px] text-[var(--ink-2)]">{description}</p>
              )}
              <p className="mt-3 font-serif text-[24px] font-semibold text-[var(--ink-1)]">
                {fmtINR(priceInr)}
                <span className="ml-1 text-[12px] font-sans font-normal text-[var(--ink-3)]">
                  / {billingCycle === 'monthly' ? 'mo' : 'yr'}
                </span>
              </p>
              <p className="text-[11px] text-[var(--ink-3)]">
                + GST 18% = {fmtINR(gstAmount)} · Total {fmtINR(grandTotal)}
              </p>
              {cleanFeatures.length > 0 && (
                <ul className="mt-3 space-y-1.5 border-t border-[var(--bd)] pt-3">
                  {cleanFeatures.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-[12px] text-[var(--ink-1)]">
                      <Check className="mt-0.5 h-3 w-3 flex-shrink-0 text-[var(--pu)]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="mt-3 text-[11px] text-[var(--ink-3)]">
              This is how the card will look on the Subscription plans grid.
            </p>
          </aside>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-2 border-t border-[var(--bd)] bg-[var(--bg-1)] px-6 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[var(--bd)] bg-[var(--bg-1)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-1)] hover:bg-[var(--bg-3)]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit}
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--pu)] px-4 py-2 text-[12.5px] font-semibold text-white shadow-sm transition hover:bg-[var(--pu-deep)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {isEdit ? 'Save changes' : 'Save plan'}
          </button>
        </footer>
      </aside>
    </div>
  );
}
