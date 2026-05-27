'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'react-toastify';
import {
  Archive, BookOpen, Bus, Calendar, ChevronDown, Check, CheckCheck, Copy, Download,
  Edit2, ExternalLink, FileText, Filter, Info, Pause, Plus, RefreshCw, RotateCcw, Shield, Trash2,
  Users, BarChart2, DollarSign, Bell, X,
} from 'lucide-react';
import { getSchools, impersonateSchool, provisionSchool, updateSchool, deleteSchool, uploadSchoolLogo, getLLMStates, toggleSchoolLLM } from '@/lib/api/super-admin/schools';
import type { LLMSchoolState } from '@/lib/api/super-admin/schools';
import { getPlans } from '@/lib/api/super-admin/billing';
import { apiRequestWithRefreshResponse } from '@/lib/api-auth';
import type {
  BoardType, HealthFlagsCounts, PaginatedResponse, PlanType, ProvisionSchoolRequest, ProvisionSchoolResponse,
  SchoolFilters, SchoolTenant, SchoolStatus, SubscriptionPlan,
} from '@/types/super-admin';

const PAGE_SIZE = 10;

const BOARDS = [
  { value: 'CBSE',   label: 'CBSE — Central Board of Secondary Education' },
  { value: 'ICSE',   label: 'ICSE / ISC — CISCE' },
  { value: 'SSC_TG', label: 'SSC — Telangana State Board' },
  { value: 'SSC_AP', label: 'SSC — Andhra Pradesh State Board' },
  { value: 'OTHER',  label: 'Other (IB / Cambridge / State)' },
] as const;

const DEFAULT_SCHOOLS: PaginatedResponse<SchoolTenant> = { count: 0, next: null, previous: null, results: [] };

const AVATAR_GRADIENT_CLS = [
  'bg-[linear-gradient(135deg,#7C5BFF,#5836E0)]',
  'bg-[linear-gradient(135deg,#A65D08,#7d4006)]',
  'bg-[linear-gradient(135deg,#1A4ACF,#0f3196)]',
  'bg-[linear-gradient(135deg,#0E9F6E,#0d7a55)]',
  'bg-[linear-gradient(135deg,#992558,#6c1a3d)]',
  'bg-[linear-gradient(135deg,#0369A1,#055478)]',
  'bg-[linear-gradient(135deg,#06794F,#045236)]',
  'bg-[linear-gradient(135deg,#E0463A,#a8281f)]',
];

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'] as const;
const MONTHS_SHORT = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'] as const;

const MONTH_ROWS = [[0,1,2,3],[4,5,6,7],[8,9,10,11]] as const;

function MonthYearPicker({
  value,
  onChange,
  minValue,
}: {
  value: { month: string; year: string };
  onChange: (v: { month: string; year: string }) => void;
  minValue?: { month: string; year: string };
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cy = new Date().getFullYear();
  const todayMonth = new Date().getMonth();
  const YEARS = Array.from({ length: 14 }, (_, i) => String(cy - 3 + i));
  const idx = MONTHS.indexOf(value.month as typeof MONTHS[number]);
  const shortLabel = MONTHS_SHORT[idx] ?? value.month.slice(0, 3);

  // Minimum allowed numeric value (year*12 + monthIndex). -Infinity when no min.
  const minNumeric = minValue
    ? parseInt(minValue.year) * 12 + MONTHS.indexOf(minValue.month as typeof MONTHS[number])
    : -Infinity;
  const minYear = minValue ? parseInt(minValue.year) : -Infinity;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  // When picker opens, scroll so the selected year row is near the top
  useEffect(() => {
    if (!open || !scrollRef.current) return;
    const el = scrollRef.current.querySelector<HTMLElement>(`[data-year="${value.year}"]`);
    if (el) el.scrollIntoView({ block: 'start', behavior: 'instant' });
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 text-[13px] text-[var(--ink-1)] transition hover:border-[var(--pu)] focus:outline-none"
      >
        <Calendar size={13} className="shrink-0 text-[var(--ink-3)]" />
        <span>{shortLabel}, {value.year}</span>
        <ChevronDown size={12} className={`shrink-0 text-[var(--ink-3)] transition-transform duration-150 ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          ref={scrollRef}
          className="absolute left-0 top-full z-50 mt-1.5 w-[256px] overflow-y-auto rounded-xl border border-[var(--bd-2)] bg-[var(--bg-0)] shadow-xl max-h-[300px]"
        >
          {YEARS.map(y => {
            const isSelectedYear = y === value.year;
            const isYearDisabled = parseInt(y) < minYear;
            return (
              <div key={y}>
                <div
                  data-year={y}
                  onMouseDown={e => {
                    e.preventDefault();
                    if (!isYearDisabled) onChange({ ...value, year: y });
                  }}
                  className={`select-none bg-gray-100 px-4 py-2.5 text-[13px] font-semibold leading-tight transition ${
                    isYearDisabled
                      ? 'cursor-not-allowed text-gray-300 opacity-50'
                      : 'cursor-pointer text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  {y}
                </div>
                {isSelectedYear && !isYearDisabled && (
                  <div className="bg-white px-2 pb-3 pt-1.5">
                    {MONTH_ROWS.map((row, ri) => (
                      <div key={ri} className={`grid grid-cols-4${ri < 2 ? ' mb-2' : ''}`}>
                        {row.map(i => {
                          const isSel = i === idx;
                          const isToday = i === todayMonth && y === String(cy);
                          // Disable months whose numeric value <= start (end must be strictly after start)
                          const isMonthDisabled = (parseInt(y) * 12 + i) <= minNumeric;
                          return (
                            <button
                              key={i}
                              type="button"
                              disabled={isMonthDisabled}
                              onMouseDown={e => {
                                e.preventDefault();
                                if (!isMonthDisabled) {
                                  onChange({ ...value, month: MONTHS[i]! });
                                  setOpen(false);
                                }
                              }}
                              className={`rounded-lg py-2.5 text-[13px] font-semibold transition ${
                                isMonthDisabled
                                  ? 'cursor-not-allowed text-gray-300 opacity-40'
                                  : isSel
                                  ? 'bg-blue-600 text-white'
                                  : isToday
                                  ? 'border-2 border-blue-500 text-blue-600'
                                  : 'text-gray-500 hover:bg-gray-100 hover:text-gray-800'
                              }`}
                            >
                              {MONTHS_SHORT[i]}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function avatarGradient(tenantId: string) {
  const code = tenantId.charCodeAt(tenantId.length - 1) % AVATAR_GRADIENT_CLS.length;
  return AVATAR_GRADIENT_CLS[code] ?? AVATAR_GRADIENT_CLS[0]!;
}

function schoolInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

// Sparkline SVG
function Spark({ color }: { color: string }) {
  return (
    <svg width="64" height="22" viewBox="0 0 64 22" className="opacity-70">
      <path d="M2 18 L12 15 L22 16 L32 12 L42 9 L52 7 L62 3" stroke={color} strokeWidth="1.5" strokeLinecap="round" fill="none" />
    </svg>
  );
}

// Chip
type ChipVariant = 'default' | 'indigo' | 'ok' | 'warn' | 'danger' | 'info' | 'ghost';
function Chip({ label, variant = 'default' }: { label: string; variant?: ChipVariant }) {
  const cls: Record<ChipVariant, string> = {
    default: 'bg-[var(--bg-2)] text-[var(--ink-2)] border-[var(--bd)]',
    indigo:  'bg-[var(--pu-soft)] text-[var(--pu-deep)] border-transparent',
    ok:      'bg-[var(--ok-soft)] text-[#0d7a55] border-transparent',
    warn:    'bg-[var(--warn-soft)] text-[var(--warn)] border-transparent',
    danger:  'bg-[var(--danger-soft)] text-[var(--danger)] border-transparent',
    info:    'bg-[var(--info-soft)] text-[var(--info)] border-transparent',
    ghost:   'bg-transparent border-[var(--bd-2)] text-[var(--ink-2)]',
  };
  return (
    <span className={`inline-flex h-6 items-center rounded-full border px-[9px] text-[11.5px] font-[550] ${cls[variant]}`}>
      {label}
    </span>
  );
}

function boardVariant(board?: BoardType): ChipVariant {
  if (board === 'CBSE') return 'indigo';
  if (board === 'ICSE') return 'info';
  if (board === 'SSC_AP' || board === 'SSC_TG') return 'warn';
  return 'default';
}
function boardLabel(board?: BoardType) {
  if (board === 'SSC_AP') return 'SSC AP';
  if (board === 'SSC_TG') return 'SSC TG';
  return board ?? '\u2014';
}

function planVariant(plan?: PlanType | string): ChipVariant {
  if (plan === 'enterprise') return 'ok';
  if (plan === 'premium')    return 'indigo';
  if (plan === 'custom')     return 'info';
  return 'ghost';
}
function planLabel(plan?: PlanType | string) {
  if (!plan) return '\u2014';
  return plan.charAt(0).toUpperCase() + plan.slice(1);
}

// StatusDot
function StatusDot({ status }: { status: SchoolStatus | string }) {
  const cls: Record<string, string> = {
    active:     'text-[#0d7a55]',
    trial:      'text-[var(--warn)]',
    suspended:  'text-[var(--danger)]',
    onboarding: 'text-[var(--info)]',
    archived:   'text-[var(--ink-3)]',
  };
  const labels: Record<string, string> = {
    active: 'Active', trial: 'Trial', suspended: 'Suspended',
    onboarding: 'Onboarding', archived: 'Archived',
  };
  return (
    <span className={`inline-flex items-center gap-1.5 text-[12px] font-[550] ${cls[status] ?? 'text-[var(--ink-3)]'}`}>
      <span className="h-[7px] w-[7px] rounded-full bg-current opacity-90" />
      {labels[status] ?? status}
    </span>
  );
}

// FilterPill
function FilterPill({ label, count, active, onClick }: { label: string; count?: number; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border px-3 text-[12px] transition-all ${active
        ? 'border-transparent bg-[var(--pu-soft)] font-[550] text-[var(--pu-deep)]'
        : 'border-[var(--bd)] bg-[var(--bg-2)] text-[var(--ink-2)] hover:bg-[var(--bg-3)]'}`}
    >
      {label}
      {count !== undefined ? (
        <span className={`rounded-full border px-1.5 font-mono text-[10.5px] ${active ? 'border-transparent text-[var(--pu-deep)]' : 'border-[var(--bd)] bg-white text-[var(--ink-3)]'}`}>
          {count}
        </span>
      ) : null}
    </button>
  );
}

// Accordion
function Accordion({
  num, icon, title, subtitle, meta, featured, open, onToggle, children,
}: {
  num: string; icon: React.ReactNode; title: string; subtitle: string;
  meta?: React.ReactNode; featured?: boolean; open: boolean; onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`mb-3.5 overflow-hidden rounded-[14px] border bg-[var(--bg-1)] transition-all ${
        featured
          ? open ? 'border-[var(--pu)] shadow-[0_4px_24px_-16px_rgba(79,53,204,.3)]' : 'border-[var(--pu-soft)]'
          : open ? 'border-[var(--bd-2)]' : 'border-[var(--bd)]'
      }`}
    >
      <button
        type="button"
        onClick={onToggle}
        className={`flex w-full items-center gap-3.5 px-[22px] py-[18px] text-left transition-colors hover:bg-[var(--bg-2)] ${
          featured ? (open ? 'bg-gradient-to-b from-[#EEEAFF] to-[#F6F3FF]' : 'bg-gradient-to-b from-[#F6F3FF] to-white') : ''
        }`}
      >
        <span className={`rounded-[6px] border px-[7px] py-[3px] font-mono text-[11px] font-medium tracking-[0.04em] transition-colors ${
          open || featured
            ? 'border-transparent bg-[var(--pu-soft)] text-[var(--pu-deep)]'
            : 'border-[var(--bd)] bg-[var(--bg-2)] text-[var(--ink-3)]'
        }`}>{num}</span>
        <span className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg ${featured ? 'bg-[var(--pu)] text-white' : 'bg-[var(--pu-soft)] text-[var(--pu-deep)]'}`}>
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] font-semibold tracking-[-0.2px] text-[var(--ink-1)]">{title}</span>
          <span className="mt-0.5 block text-[12px] text-[var(--ink-2)]">{subtitle}</span>
        </span>
        {meta ? <span className="flex flex-shrink-0 items-center gap-2">{meta}</span> : null}
        <ChevronDown className={`h-[22px] w-[22px] flex-shrink-0 transition-transform duration-[250ms] ${open ? 'rotate-180 text-[var(--ink-1)]' : 'text-[var(--ink-3)]'}`} />
      </button>
      <div className={`overflow-hidden transition-[max-height] duration-[350ms] ease-in-out ${open ? 'max-h-[6000px]' : 'max-h-0'}`}>
        <div className={`px-[22px] pb-6 pt-0 ${open ? `border-t ${featured ? 'border-[var(--pu-soft)]' : 'border-[var(--bd)]'}` : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

// KPI Card
function KpiCard({
  label, value, trend, trendDown, footnote, sparkColor, pulse,
}: {
  label: string; value: string | number; trend: React.ReactNode;
  trendDown?: boolean; footnote: string; sparkColor: string; pulse?: boolean;
}) {
  return (
    <div className="relative min-h-[148px] overflow-hidden rounded-[14px] border border-[var(--bd)] bg-[var(--bg-1)] p-[18px] transition-all hover:border-[var(--bd-2)] hover:shadow-[0_4px_14px_-10px_rgba(15,18,34,.1)]">
      <p className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--ink-2)]">{label}</p>
      <div className="mt-3.5 flex items-end gap-2.5">
        <span className="font-serif text-[50px] font-normal leading-[0.95] tracking-[-1.5px] [font-variant-numeric:tabular-nums]">{value}</span>
        <span className={`mb-2 flex items-center gap-1 text-[11px] font-[550] ${trendDown ? 'text-[var(--danger)]' : 'text-[var(--ok)]'}`}>
          {pulse ? <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-[var(--ok)]" /> : null}
          {trend}
        </span>
      </div>
      <p className="mt-3.5 text-[11.5px] text-[var(--ink-2)]">{footnote}</p>
      <span className="absolute right-3.5 top-4"><Spark color={sparkColor} /></span>
    </div>
  );
}

// Section heading
function SectionHead({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <h4 className="mb-3.5 flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[0.09em] text-[var(--ink-3)]">
      <span className="inline-flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-[var(--pu-soft)] font-mono text-[10.5px] font-bold text-[var(--pu-deep)]">{num}</span>
      {children}
    </h4>
  );
}

// Field
function Fld({
  label, required, hint, span, error, children,
}: {
  label: string; required?: boolean; hint?: string; span?: '2' | '3'; error?: string; children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${span === '2' ? 'col-span-2' : span === '3' ? 'col-span-3' : ''}`}>
      <span className="flex items-center gap-1 text-[11.5px] font-[550] text-[var(--ink-2)]">
        {label}
        {required ? <span className="text-[var(--danger)]">*</span> : null}
        {hint ? <span className="ml-auto text-[10.5px] font-normal text-[var(--ink-3)]">{hint}</span> : null}
      </span>
      {children}
      {error && <span className="text-[11px] font-medium text-[var(--danger)]">{error}</span>}
    </label>
  );
}

const inputCls = 'h-[38px] w-full rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 text-[13px] text-[var(--ink-1)] outline-none transition focus:border-[var(--pu)] focus:shadow-[0_0_0_3px_rgba(109,74,255,.12)]';
const selectCls = inputCls;
const monoInputCls = `${inputCls} font-mono text-[12px]`;
const lockedInputCls = `${inputCls} cursor-not-allowed bg-[var(--bg-2)] font-mono text-[12px] font-semibold text-[var(--pu-deep)]`;

// ── Edit school modal ─────────────────────────────────────────────────────────
function EditSchoolModal({
  school, busy, plans, onSave, onCancel,
}: {
  school: SchoolTenant;
  busy: boolean;
  plans: SubscriptionPlan[];
  onSave: (patch: Partial<SchoolTenant>) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = React.useState({
    name: school.name ?? '',
    plan: (school.plan ?? 'trial') as string,
    status: (school.status ?? 'active') as string,
    board: (school.board ?? 'OTHER') as string,
    state: school.state ?? '',
    gstin: school.gstin ?? '',
    seats: school.seats ?? '',
  });
  const set = (k: keyof typeof form, v: string | number) => setForm(f => ({ ...f, [k]: v }));

  const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
  const gstinError = form.gstin && !GSTIN_RE.test(form.gstin)
    ? 'Invalid GSTIN — must be 15 chars, e.g. 27AABCU9603R1ZX'
    : '';
  const saveDisabled = busy || !form.name.trim() || !!gstinError;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 backdrop-blur-sm pt-16 pb-8">
      <div className="w-full max-w-lg rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] p-6 shadow-2xl mx-4">
        <div className="mb-5 flex items-start justify-between">
          <div>
            <h2 className="text-[15px] font-[700] text-[var(--ink-1)]">Edit school</h2>
            <p className="mt-0.5 font-mono text-[11.5px] text-[var(--ink-3)]">{school.tenant_id}</p>
          </div>
          <button type="button" onClick={onCancel}
            className="text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors text-lg leading-none">&times;</button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">School name</label>
            <input className={inputCls} value={form.name} onChange={e => set('name', e.target.value)} placeholder="School name" />
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">Plan</label>
            <select className={selectCls} value={form.plan} onChange={e => set('plan', e.target.value)} title="Plan">
              {plans.length > 0
                ? plans.map(p => <option key={p.code} value={p.code}>{p.name}</option>)
                : (
                  <>
                    <option value="trial">Trial</option>
                    <option value="premium">Premium</option>
                    <option value="enterprise">Enterprise</option>
                    <option value="custom">Custom</option>
                  </>
                )
              }
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">Status</label>
            <select className={selectCls} value={form.status} onChange={e => set('status', e.target.value)} title="Status">
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="onboarding">Onboarding</option>
              <option value="pending">Pending</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">Board</label>
            <select className={selectCls} value={form.board} onChange={e => set('board', e.target.value)} title="Board">
              {BOARDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">State</label>
            <select className={selectCls} value={form.state} onChange={e => set('state', e.target.value)} title="State">
              <option value="">— Select —</option>
              <option value="36">Telangana (36)</option>
              <option value="37">Andhra Pradesh (37)</option>
              <option value="29">Karnataka (29)</option>
              <option value="33">Tamil Nadu (33)</option>
              <option value="27">Maharashtra (27)</option>
              <option value="07">Delhi (07)</option>
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">GSTIN</label>
            <input className={`${monoInputCls}${gstinError ? ' border-[var(--danger)] focus:ring-[var(--danger)]/20' : ''}`}
              value={form.gstin} onChange={e => set('gstin', e.target.value.toUpperCase())}
              placeholder="27AABCU9603R1ZX" maxLength={15} />
            {gstinError && <p className="mt-1 text-[11px] text-[var(--danger)]">{gstinError}</p>}
          </div>
          <div>
            <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">Seats</label>
            <input type="number" className={inputCls} value={form.seats}
              onChange={e => set('seats', e.target.value)} placeholder="500" min={0} />
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
            className="rounded-xl border border-[var(--bd)] px-4 py-2 text-sm font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors">
            Cancel
          </button>
          <button type="button" disabled={saveDisabled}
            onClick={() => onSave({
              name: form.name.trim(),
              plan: form.plan as SchoolTenant['plan'],
              status: form.status as SchoolTenant['status'],
              board: form.board as SchoolTenant['board'],
              state: form.state || undefined,
              gstin: form.gstin || undefined,
              seats: form.seats ? Number(form.seats) : undefined,
            })}
            className="rounded-xl bg-[var(--pu)] px-4 py-2 text-sm font-[600] text-white hover:opacity-90 disabled:opacity-50 transition-opacity">
            {busy ? 'Saving\u2026' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirmation dialog ───────────────────────────────────────────────────────
function ConfirmDialog({
  type, school, busy, onConfirm, onCancel,
}: {
  type: 'suspend' | 'archive' | 'restore' | 'reactivate' | 'permanent_delete';
  school: SchoolTenant;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const title =
    type === 'suspend'        ? 'Suspend school?'           :
    type === 'archive'        ? 'Archive school?'           :
    type === 'restore'        ? 'Restore school?'           :
    type === 'reactivate'     ? 'Reactivate school?'        :
                                'Permanently delete school?';

  const confirmLabel = busy
    ? ({ suspend: 'Suspending\u2026', archive: 'Archiving\u2026', restore: 'Restoring\u2026', reactivate: 'Reactivating\u2026', permanent_delete: 'Deleting\u2026' }[type])
    : ({ suspend: 'Yes, suspend', archive: 'Yes, archive', restore: 'Yes, restore', reactivate: 'Yes, reactivate', permanent_delete: 'Yes, delete permanently' }[type]);

  const btnCls = (type === 'restore' || type === 'reactivate')
    ? 'rounded-xl bg-[#059669] px-4 py-2 text-sm font-[600] text-white hover:opacity-90 disabled:opacity-50 transition-opacity'
    : 'rounded-xl bg-[var(--danger)] px-4 py-2 text-sm font-[600] text-white hover:opacity-90 disabled:opacity-50 transition-opacity';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] p-6 shadow-2xl">
        <h2 className="mb-2 text-base font-[700] text-[var(--ink-1)]">{title}</h2>
        <p className="mb-5 text-sm text-[var(--ink-2)]">
          {type === 'suspend' && (
            <><strong>{school.name}</strong> will be suspended immediately \u2014 all users will lose access.</>
          )}
          {type === 'archive' && (
            <><strong>{school.name}</strong> will be archived and marked as inactive.{' '}
            Users from this school may lose access to the platform, but historical data will be preserved.</>
          )}
          {type === 'restore' && (
            <><strong>{school.name}</strong> will be restored and reactivated.{' '}
            Users and administrators may regain access based on their previous permissions.</>
          )}
          {type === 'reactivate' && (
            <><strong>{school.name}</strong> will be reactivated immediately — all users will regain access and the status will return to Active.</>
          )}
          {type === 'permanent_delete' && (
            <><strong>{school.name}</strong> and <strong>all associated data</strong> will be permanently deleted.{' '}
            This action cannot be undone.</>
          )}
        </p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-xl border border-[var(--bd)] px-4 py-2 text-sm font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={btnCls}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// PAGE
// Valid status tab values — must stay in sync with backend _VALID_STATUS_PARAMS
const VALID_STATUS_TABS = new Set(['all', 'active', 'trial', 'suspended', 'archived'] as const);
type StatusTab = 'all' | 'active' | 'trial' | 'suspended' | 'archived';

export default function SuperAdminSchoolsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [response, setResponse] = useState<PaginatedResponse<SchoolTenant>>(DEFAULT_SCHOOLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [globalStats, setGlobalStats] = useState({ total: 0, active: 0, trial: 0, attention: 0, archived: 0 });
  const [statusFilter, setStatusFilter] = useState<StatusTab>('active');
  const [pendingPlan,   setPendingPlan]   = useState('');
  const [pendingBoard,  setPendingBoard]  = useState('');
  const [pendingState,  setPendingState]  = useState('');
  const [planFilter,    setPlanFilter]    = useState('');
  const [boardFilter,   setBoardFilter]   = useState('');
  const [stateFilter,   setStateFilter]   = useState('');

  const [exportBusy, setExportBusy] = useState(false);

  const handleExportSchoolsXlsx = async () => {
    if (exportBusy) return;
    setExportBusy(true);
    try {
      const params = new URLSearchParams();
      const safeStatus = VALID_STATUS_TABS.has(statusFilter) ? statusFilter : 'all';
      if (safeStatus !== 'all') params.set('status', safeStatus);
      if (search.trim()) params.set('search', search.trim());
      if (planFilter) params.set('plan', planFilter);
      if (boardFilter) params.set('board', boardFilter);
      if (stateFilter) params.set('state', stateFilter);
      if (healthFlagFilter) params.set('health_flag', healthFlagFilter);
      const response = await apiRequestWithRefreshResponse(
        `/api/super-admin/schools/export-xlsx/?${params.toString()}`,
      );
      if (!response.ok) throw new Error(`Export failed: ${response.status}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `schools-export-${Date.now()}.xlsx`;
      document.body.appendChild(link);
      link.click();
      window.setTimeout(() => { URL.revokeObjectURL(url); link.remove(); }, 0);
    } catch {
      toast.error('Failed to export schools. Please try again.');
    } finally {
      setExportBusy(false);
    }
  };

  const [accAddOpen, setAccAddOpen] = useState(false);
  const [accFiltersOpen, setAccFiltersOpen] = useState(true);
  const [accListOpen, setAccListOpen] = useState(true);

  const [healthFlagFilter, setHealthFlagFilter] = useState<string>('');
  const [healthFlagCounts, setHealthFlagCounts] = useState<HealthFlagsCounts>({
    billing_overdue: 0, storage_80: 0, trial_ending: 0, gstin_missing: 0,
  });

  // Auto-open "Add School" accordion when navigated here with ?add=1
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setAccAddOpen(true);
      // Remove the query param without adding a history entry
      router.replace('/super-admin/schools', { scroll: false });
      setTimeout(() => document.getElementById('acc-add')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlan[]>([]);
  useEffect(() => {
    getPlans().then(catalog => {
      setSubscriptionPlans(catalog.plans);
      if (catalog.plans.length > 0) {
        const validCodes = new Set(catalog.plans.map(p => p.code));
        setProvisionForm(f => validCodes.has(f.plan) ? f : { ...f, plan: catalog.plans[0]!.code as PlanType });
      }
    }).catch(() => {});
  }, []);

  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [credsResult, setCredsResult] = useState<ProvisionSchoolResponse | null>(null);
  const [credsCopied, setCredsCopied] = useState<'user' | 'pass' | null>(null);
  const [provisionForm, setProvisionForm] = useState<ProvisionSchoolRequest>({
    name: '', subdomain_url: '', state: '', board: 'OTHER', plan: 'trial',
    shard_region: '', storage_region: '', backup_retention: 30, sso_method: 'native',
    admin_username: '', admin_password: '',
  });


  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [llmStates, setLlmStates] = useState<Map<string, LLMSchoolState>>(new Map());
  const [llmToggling, setLlmToggling] = useState<Set<string>>(new Set());
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'suspend' | 'archive' | 'restore' | 'reactivate' | 'permanent_delete'; school: SchoolTenant } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);
  const [editSchool, setEditSchool] = useState<SchoolTenant | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [editFields, setEditFields] = useState({ short_code: '', gstin: '', pan: '', udise_code: '', seats: '', api_access: 'disabled', brand_color: '', gst_registered: 'yes', principal_name: '', principal_email: '', principal_phone: '', campus_address: '', city: '', pin_code: '', affiliation_number: '' });
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [logoDragging, setLogoDragging] = useState(false);
  const [acadYears, setAcadYears] = useState<string[]>(() => {
    const y = new Date().getFullYear();
    return [
      `June ${y} \u2013 May ${y + 1}`,
      `April ${y} \u2013 March ${y + 1}`,
      `June ${y - 1} \u2013 May ${y}`,
      `April ${y - 1} \u2013 March ${y}`,
    ];
  });
  const [addingAcadYear, setAddingAcadYear] = useState(false);
  const [acadYearDraft, setAcadYearDraft] = useState(() => {
    const y = new Date().getFullYear();
    return { startMonth: 'June', startYear: String(y), endMonth: 'May', endYear: String(y + 1) };
  });

  const rows = response.results;
  const activeCount   = rows.filter(s => !['archived', 'suspended'].includes(s.status as string)).length;
  const trialCount    = rows.filter(s => (s.plan as string) === 'trial' && !['archived', 'suspended'].includes(s.status as string)).length;
  const attnCount     = rows.filter(s => s.status === 'suspended').length;
  const archivedCount = rows.filter(s => s.status === 'archived').length;
  const activeFilterCount = [search, planFilter, boardFilter, stateFilter, statusFilter !== 'all' && statusFilter !== 'active' ? statusFilter : ''].filter(Boolean).length;
  const totalStudents = rows.reduce((a, b) => a + (b.students ?? 0), 0);
  const totalActiveStudents = rows.reduce((a, b) => a + (b.activeStudents ?? 0), 0);
  const totalInactiveStudents = totalStudents - totalActiveStudents;
  const totalStaff    = rows.reduce((a, b) => a + (b.staff ?? 0), 0);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Guard: only send a status param for values the backend recognises
    const safeStatus = VALID_STATUS_TABS.has(statusFilter) ? statusFilter : 'all';
    const filters: SchoolFilters = {
      page, page_size: PAGE_SIZE,
      search: search.trim() || undefined,
      status: safeStatus === 'all' ? undefined : (safeStatus as SchoolStatus),
      plan: planFilter as PlanType || undefined,
      board: boardFilter as BoardType || undefined,
      state: stateFilter || undefined,
      health_flag: healthFlagFilter || undefined,
    };
    try {
      const res = await getSchools(filters);
      setResponse(res);
      if (res.health_flags_counts) setHealthFlagCounts(res.health_flags_counts);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load schools.');
      setResponse(DEFAULT_SCHOOLS);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter, planFilter, boardFilter, stateFilter, healthFlagFilter]);

  useEffect(() => { void loadSchools(); }, [loadSchools]);
  useEffect(() => { getLLMStates().then(setLlmStates).catch(() => {}); }, []);
  useEffect(() => { setPage(1); }, [search, statusFilter, planFilter, boardFilter, stateFilter, healthFlagFilter]);

  // Fetch global stats — extracted so it can be re-called after any status change
  const loadGlobalStats = useCallback(() => {
    getSchools({ page_size: 200 }).then(res => {
      const all = res.results;
      setGlobalStats({
        total: res.count,
        active: all.filter(s => !['archived', 'suspended'].includes(s.status as string)).length,
        trial: all.filter(s => (s.plan as string) === 'trial' && !['archived', 'suspended'].includes(s.status as string)).length,
        attention: all.filter(s => s.status === 'suspended').length,
        archived: all.filter(s => s.status === 'archived').length,
      });
    }).catch(() => {});
  }, []);

  useEffect(() => { loadGlobalStats(); }, [loadGlobalStats]);

  const handleApplyFilters = useCallback(() => {
    setPlanFilter(pendingPlan);
    setBoardFilter(pendingBoard);
    setStateFilter(pendingState);
    setPage(1);
  }, [pendingPlan, pendingBoard, pendingState]);

  const handleProvisionSubmit = useCallback(async () => {
    setProvisionError(null);
    const errors: Record<string, string> = {};
    if (!provisionForm.name.trim()) errors.name = 'School name is required.';
    if (!provisionForm.state.trim()) errors.state = 'State is required.';
    if (!editFields.principal_name.trim()) errors.principal_name = 'Principal name is required.';
    if (!editFields.principal_email.trim()) errors.principal_email = 'Principal email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editFields.principal_email.trim())) errors.principal_email = 'Enter a valid email address.';
    if (!editFields.pan.trim()) errors.pan = 'PAN is required.';
    else if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(editFields.pan.trim())) errors.pan = 'PAN must be in format ABCDE1234F.';
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      setTimeout(() => {
        const el = document.querySelector('[data-field-error="true"]');
        if (el) (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 50);
      return;
    }
    setFieldErrors({});

    // ── EDIT MODE ──────────────────────────────────────────────
    if (editSchool) {
      setProvisioning(true);
      try {
        // Upload logo first if a new file was selected
        let logoUrl: string | undefined;
        if (logoFile) {
          try {
            const res = await uploadSchoolLogo(editSchool.tenant_id, logoFile);
            logoUrl = res.logo_url;
          } catch {
            toast.error('Logo upload failed — other changes were saved.');
          }
        }
        await updateSchool(editSchool.tenant_id, {
          name: provisionForm.name.trim(),
          state: provisionForm.state,
          board: provisionForm.board,
          plan: provisionForm.plan,
          shard_region: provisionForm.shard_region,
          storage_region: provisionForm.storage_region,
          backup_retention: provisionForm.backup_retention,
          sso_method: provisionForm.sso_method,
          short_code: editFields.short_code || undefined,
          gstin: editFields.gstin || undefined,
          pan: editFields.pan || undefined,
          udise_code: editFields.udise_code || undefined,
          seats: editFields.seats ? Number(editFields.seats) : undefined,
          api_access: editFields.api_access === 'enabled',
          brand_color: editFields.brand_color || undefined,
          logo_url: logoUrl,
          principal_name: editFields.principal_name || undefined,
          principal_email: editFields.principal_email || undefined,
          principal_phone: editFields.principal_phone || undefined,
          campus_address: editFields.campus_address || undefined,
          city: editFields.city || undefined,
          pin_code: editFields.pin_code || undefined,
          affiliation_number: editFields.affiliation_number || undefined,
        });
        toast.success(`${provisionForm.name} updated.`);
        setEditSchool(null);
        setAccAddOpen(false);
        setProvisionForm({ name: '', subdomain_url: '', state: '', board: 'OTHER', plan: 'trial', shard_region: '', storage_region: '', backup_retention: 30, sso_method: 'native', admin_username: '', admin_password: '' });
        setEditFields({ short_code: '', gstin: '', pan: '', udise_code: '', seats: '', api_access: 'disabled', brand_color: '', gst_registered: 'yes', principal_name: '', principal_email: '', principal_phone: '', campus_address: '', city: '', pin_code: '', affiliation_number: '' });
        setLogoFile(null);
        setLogoPreview(null);
        setSelectedColor(PALETTE_COLORS[0]!.hex);
        setFieldErrors({});
        await loadSchools();
        void loadGlobalStats();
      } catch (err) {
        setProvisionError(err instanceof Error ? err.message : 'Update failed.');
      } finally {
        setProvisioning(false);
      }
      return;
    }

    // ── ADD MODE ───────────────────────────────────────────────
    const sub = provisionForm.subdomain_url.trim().toLowerCase();
    if (!sub) { setProvisionError('Subdomain is required.'); return; }
    if (!/^[a-z0-9-]+$/.test(sub)) {
      setProvisionError('Subdomain may only contain lowercase letters, numbers, and hyphens.');
      return;
    }
    setProvisioning(true);
    try {
      const result = await provisionSchool({
        ...provisionForm,
        subdomain_url: sub,
        short_code: editFields.short_code || undefined,
        gstin: editFields.gstin || undefined,
        pan: editFields.pan || undefined,
        udise_code: editFields.udise_code || undefined,
        seats: editFields.seats ? Number(editFields.seats) : undefined,
        brand_color: editFields.brand_color || undefined,
        principal_name: editFields.principal_name || undefined,
        principal_email: editFields.principal_email || undefined,
        principal_phone: editFields.principal_phone || undefined,
        campus_address: editFields.campus_address || undefined,
        city: editFields.city || undefined,
        pin_code: editFields.pin_code || undefined,
        affiliation_number: editFields.affiliation_number || undefined,
      });
      // Upload logo after provisioning if a file was selected
      if (logoFile && result.tenant_id) {
        try {
          await uploadSchoolLogo(result.tenant_id, logoFile);
        } catch {
          toast.error('Logo upload failed — school was provisioned successfully.');
        }
      }
      setAccAddOpen(false);
      setProvisionForm({ name: '', subdomain_url: '', state: '', board: 'OTHER', plan: 'trial', shard_region: '', storage_region: '', backup_retention: 30, sso_method: 'native', admin_username: '', admin_password: '' });
      setEditFields({ short_code: '', gstin: '', pan: '', udise_code: '', seats: '', api_access: 'disabled', brand_color: '', gst_registered: 'yes', principal_name: '', principal_email: '', principal_phone: '', campus_address: '', city: '', pin_code: '', affiliation_number: '' });
      setLogoFile(null);
      setLogoPreview(null);
      setSelectedColor(PALETTE_COLORS[0]!.hex);
      setFieldErrors({});
      try { sessionStorage.removeItem('school_add_draft'); } catch { /* ignore */ }
      setCredsResult(result);
      toast.success('School provisioned — admin credentials ready below.');
      await loadSchools();
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : 'Provisioning failed.');
    } finally {
      setProvisioning(false);
    }
  }, [editSchool, editFields, loadSchools, loadGlobalStats, provisionForm]);

  const handleLLMToggle = useCallback(async (school: SchoolTenant) => {
    const llm = llmStates.get(school.tenant_id);
    if (!llm) return;
    const newVal = !llm.llm_enabled;
    setLlmToggling(s => new Set(s).add(school.tenant_id));
    setLlmStates(m => { const n = new Map(m); n.set(school.tenant_id, { ...llm, llm_enabled: newVal }); return n; });
    try {
      await toggleSchoolLLM(llm.id, newVal);
      toast.success(`LLM ${newVal ? 'enabled' : 'disabled'} for ${school.name}.`);
    } catch {
      setLlmStates(m => { const n = new Map(m); n.set(school.tenant_id, llm); return n; });
      toast.error(`Failed to ${newVal ? 'enable' : 'disable'} LLM for ${school.name}.`);
    } finally {
      setLlmToggling(s => { const n = new Set(s); n.delete(school.tenant_id); return n; });
    }
  }, [llmStates]);

  const handleImpersonate = useCallback(async (school: SchoolTenant) => {
    setImpersonatingId(school.tenant_id);
    try {
      const data = await impersonateSchool(school.tenant_id);
      try {
        sessionStorage.setItem('school_erp_impersonation', JSON.stringify({
          tenant_id: data.tenant_id, username: data.username,
          access: data.access, refresh: data.refresh,
          expires_at: Date.now() + data.expires_in * 1000,
        }));
      } catch { /* sessionStorage unavailable */ }
      // Build the handoff URL using the configured base domain (NEXT_PUBLIC_BASE_DOMAIN),
      // falling back to the current hostname. This ensures the URL resolves correctly
      // in both local dev (eskoolia.local) and production (eskoolia.com).
      const { protocol, port } = window.location;
      const baseDomain = process.env.NEXT_PUBLIC_BASE_DOMAIN || window.location.hostname;
      const portSuffix = port ? `:${port}` : '';
      const subdomain = school.subdomain_url || data.tenant_id;
      const handoffUrl = `${protocol}//${subdomain}.${baseDomain}${portSuffix}/login?impersonate=1&token=${data.access}&refresh=${data.refresh}`;
      window.open(handoffUrl, '_blank', 'noopener,noreferrer');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Impersonation failed.');
    } finally {
      setImpersonatingId(null);
    }
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmDialog) return;
    setConfirmBusy(true);
    const { type, school } = confirmDialog;
    if (!school.tenant_id) {
      toast.error(`Cannot ${type} "${school.name}": school has no tenant ID assigned. Check provisioning status.`);
      setConfirmDialog(null);
      setConfirmBusy(false);
      return;
    }
    try {
      if (type === 'suspend') {
        await updateSchool(school.tenant_id, { status: 'suspended' });
        toast.success(`${school.name} suspended.`);
      } else if (type === 'archive') {
        await deleteSchool(school.tenant_id);
        toast.success(`${school.name} archived.`);
      } else if (type === 'restore') {
        await updateSchool(school.tenant_id, { status: 'active' });
        toast.success(`${school.name} restored to active.`);
      } else if (type === 'reactivate') {
        await updateSchool(school.tenant_id, { status: 'active' });
        toast.success(`${school.name} reactivated successfully.`);
      } else {
        toast.error('Permanent delete is not yet available \u2014 contact system administrator.');
        setConfirmDialog(null);
        setConfirmBusy(false);
        return;
      }
      setConfirmDialog(null);
      await loadSchools();
      void loadGlobalStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${type} failed.`);
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmDialog, loadSchools, loadGlobalStats]);

  const handleSaveEdit = useCallback(async (data: Partial<SchoolTenant>) => {
    if (!editSchool) return;
    setEditBusy(true);
    try {
      await updateSchool(editSchool.tenant_id, data);
      toast.success(`${editSchool.name} updated.`);
      setEditSchool(null);
      await loadSchools();
      void loadGlobalStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setEditBusy(false);
    }
  }, [editSchool, loadSchools, loadGlobalStats]);

  const handleEditInForm = useCallback((school: SchoolTenant) => {
    setEditSchool(school);
    setProvisionForm({
      name: school.name,
      subdomain_url: school.subdomain_url ?? '',
      state: school.state ?? '',
      board: (school.board as BoardType) ?? 'OTHER',
      plan: (school.plan as PlanType) ?? 'trial',
      shard_region: school.shard_region ?? '',
      storage_region: school.storage_region ?? '',
      backup_retention: school.backup_retention ?? 30,
      sso_method: school.sso_method ?? 'native',
      admin_username: '',
      admin_password: '',
    });
    setEditFields({
      short_code: school.short_code ?? '',
      gstin: school.gstin ?? '',
      pan: school.pan ?? '',
      udise_code: school.udiseCode ?? '',
      seats: school.seats != null ? String(school.seats) : '',
      api_access: school.api_access ? 'enabled' : 'disabled',
      brand_color: school.brand_color ?? '',
      gst_registered: school.gstin ? 'yes' : 'no',
      principal_name: school.principal_name ?? '',
      principal_email: school.principal_email ?? '',
      principal_phone: school.principal_phone ?? '',
      campus_address: school.campus_address ?? '',
      city: school.city ?? '',
      pin_code: school.pin_code ?? '',
      affiliation_number: school.affiliation_number ?? '',
    });
    setSelectedColor(school.brand_color || PALETTE_COLORS[0]!.hex);
    setLogoPreview(school.logo_url || null);
    setLogoFile(null);
    setProvisionError(null);
    setFieldErrors({});
    setAccAddOpen(true);
    setTimeout(() => {
      document.getElementById('acc-add')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }, []);

  const moduleDefs = [
    { name: 'Admissions',    tag: 'Core',       icon: <Users size={14} />,        on: true },
    { name: 'Students',      tag: 'Core',       icon: <Users size={14} />,        on: true },
    { name: 'Attendance',    tag: 'Core',       icon: <Calendar size={14} />,     on: true },
    { name: 'Fees & Billing',tag: 'Core',       icon: <DollarSign size={14} />,   on: true },
    { name: 'Exams & Grades',tag: 'Academic',   icon: <BarChart2 size={14} />,    on: true },
    { name: 'Timetable',     tag: 'Academic',   icon: <Calendar size={14} />,     on: true },
    { name: 'Homework',      tag: 'Academic',   icon: <Edit2 size={14} />,        on: true },
    { name: 'Library',       tag: 'Operations', icon: <BookOpen size={14} />,     on: true },
    { name: 'Transport',     tag: 'Operations', icon: <Bus size={14} />,          on: true },
    { name: 'Hostel',        tag: 'Operations', icon: <Users size={14} />,        on: true },
    { name: 'HR & Payroll',  tag: 'Staff',      icon: <Users size={14} />,        on: false },
    { name: 'Communication', tag: 'Engagement', icon: <Bell size={14} />,         on: false },
    { name: 'Parent Portal', tag: 'Engagement', icon: <Users size={14} />,        on: false },
    { name: 'Reports & MIS', tag: 'Insights',   icon: <BarChart2 size={14} />,    on: false },
  ];

  const [enabledModules, setEnabledModules] = useState(() =>
    new Set(moduleDefs.filter(m => m.on).map(m => m.name))
  );

  const PALETTE_COLORS = [
    { hex: '#5836E0', bg: 'bg-[#5836E0]' },
    { hex: '#A65D08', bg: 'bg-[#A65D08]' },
    { hex: '#1A4ACF', bg: 'bg-[#1A4ACF]' },
    { hex: '#0E9F6E', bg: 'bg-[#0E9F6E]' },
    { hex: '#992558', bg: 'bg-[#992558]' },
    { hex: '#0369A1', bg: 'bg-[#0369A1]' },
    { hex: '#06794F', bg: 'bg-[#06794F]' },
    { hex: '#E0463A', bg: 'bg-[#E0463A]' },
  ];
  const [selectedColor, setSelectedColor] = useState(PALETTE_COLORS[0]!.hex);

  return (
    <>
    <div className="mx-auto max-w-[1280px] rounded-[18px] border border-[var(--bd)] bg-[var(--bg-1)] p-[28px_30px]">

      {/* TITLE ROW */}
      <div className="mb-7 flex flex-wrap items-end justify-between gap-6">
        <div>
          <h1 className="flex items-baseline gap-2.5 text-[34px] font-semibold leading-[1.05] tracking-[-1px] text-[var(--ink-1)]">
            School
            <span className="font-serif text-[38px] font-normal italic tracking-[-0.5px] text-[var(--pu)]">Management</span>
          </h1>
          <p className="mt-2.5 max-w-[680px] text-[13px] leading-[1.55] text-[var(--ink-2)]">
            Provision, monitor &amp; manage every school tenant.
            <span className="mx-1.5 text-[var(--ink-4)]">&middot;</span>
            Each school has its own{' '}
            <strong className="font-[550] text-[var(--ink-1)]">tenant ID</strong>, GSTIN, dedicated DB shard &amp; zero cross-tenant visibility.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => void handleExportSchoolsXlsx()} disabled={exportBusy} className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[var(--bd-2)] bg-[var(--bg-1)] px-3.5 text-[12.5px] font-[550] text-[var(--ink-1)] transition hover:bg-[var(--bg-2)] active:scale-[0.97] disabled:opacity-60 disabled:cursor-not-allowed">
            <Download className="h-3.5 w-3.5" /> {exportBusy ? 'Exporting…' : 'Export'}
          </button>
          <button
            type="button"
            onClick={() => {
              // Restore saved draft if present
              try {
                const raw = sessionStorage.getItem('school_add_draft');
                if (raw) {
                  const draft = JSON.parse(raw) as { provisionForm: typeof provisionForm; editFields: typeof editFields };
                  setProvisionForm(draft.provisionForm);
                  setEditFields(draft.editFields);
                  setSelectedColor(draft.editFields.brand_color || PALETTE_COLORS[0]!.hex);
                }
              } catch { /* ignore */ }
              setAccAddOpen(true);
              setTimeout(() => document.getElementById('acc-add')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[var(--pu)] px-3.5 text-[12.5px] font-[550] text-white shadow-[0_1px_2px_rgba(79,53,204,.25),inset_0_1px_0_rgba(255,255,255,.16)] transition hover:bg-[var(--pu-deep)] active:scale-[0.97]"
          >
            <Plus className="h-3.5 w-3.5" /> Add school
          </button>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="mb-6 grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
        <KpiCard label="Total Schools" value={globalStats.total || response.count || rows.length}
          trend="+3 QoQ" footnote="Telangana &amp; Andhra Pradesh" sparkColor="#5836E0" />
        <KpiCard label="Active Tenants" value={globalStats.active || activeCount}
          trend="Healthy" footnote={`${totalStudents.toLocaleString('en-IN')} enrolled · ${totalActiveStudents.toLocaleString('en-IN')} active`}
          sparkColor="#0E9F6E" pulse />
        <KpiCard label="On Trial" value={globalStats.trial || trialCount}
          trend="Avg conv 68%" footnote="Trial-to-paid conversion" sparkColor="#A65D08" />
        <KpiCard label="Needs Attention" value={globalStats.attention > 0 ? globalStats.attention : attnCount}
          trend={globalStats.attention > 0 ? `${globalStats.attention} suspended` : 'All clear'}
          trendDown={globalStats.attention > 0}
          footnote="Open across tenants" sparkColor="#E0463A" />
      </div>

      {/* CREDENTIALS BANNER — shown after provisioning */}
      {credsResult && credsResult.admin_username && (
        <div className="mb-5 rounded-[13px] border border-[#0E9F6E] bg-[#F0FDF8] p-4">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-[#065F46]">
              School provisioned — save these credentials now
            </span>
            <button
              onClick={() => setCredsResult(null)}
              className="rounded p-1 text-[#065F46] hover:bg-[#D1FAE5]"
              aria-label="Dismiss credentials"
            >
              <X size={14} />
            </button>
          </div>
          <p className="mb-3 text-xs text-[#047857]">
            These credentials will not be shown again. Share them securely with the school admin.
          </p>
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-2 rounded-[8px] border border-[#6EE7B7] bg-white px-3 py-2 font-mono text-sm">
              <span className="text-[#6B7280]">Username:</span>
              <span className="font-semibold text-[#111827]">{credsResult.admin_username}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(credsResult!.admin_username!); setCredsCopied('user'); setTimeout(() => setCredsCopied(null), 2000); }}
                className="ml-1 rounded p-0.5 text-[#6B7280] hover:text-[#047857]"
                title="Copy username"
              >
                {credsCopied === 'user' ? <CheckCheck size={13} className="text-[#0E9F6E]" /> : <Copy size={13} />}
              </button>
            </div>
            <div className="flex items-center gap-2 rounded-[8px] border border-[#6EE7B7] bg-white px-3 py-2 font-mono text-sm">
              <span className="text-[#6B7280]">Password:</span>
              <span className="font-semibold text-[#111827]">{credsResult.admin_password}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(credsResult!.admin_password!); setCredsCopied('pass'); setTimeout(() => setCredsCopied(null), 2000); }}
                className="ml-1 rounded p-0.5 text-[#6B7280] hover:text-[#047857]"
                title="Copy password"
              >
                {credsCopied === 'pass' ? <CheckCheck size={13} className="text-[#0E9F6E]" /> : <Copy size={13} />}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ACCORDION 01 — ADD SCHOOL */}
      <div id="acc-add">
        <Accordion num="01" featured open={accAddOpen} onToggle={() => {
          if (accAddOpen && editSchool) {
            setEditSchool(null);
            setProvisionForm({ name: '', subdomain_url: '', state: '', board: 'OTHER', plan: 'trial', shard_region: '', storage_region: '', backup_retention: 30, sso_method: 'native', admin_username: '', admin_password: '' });
            setEditFields({ short_code: '', gstin: '', pan: '', udise_code: '', seats: '', api_access: 'disabled', brand_color: '', gst_registered: '', principal_name: '', principal_email: '', principal_phone: '', campus_address: '', city: '', pin_code: '', affiliation_number: '' });
            setLogoFile(null);
            setLogoPreview(null);
            setSelectedColor(PALETTE_COLORS[0]!.hex);
          }
          setAccAddOpen(v => !v);
        }}
          icon={editSchool ? <Edit2 size={16} /> : <Plus size={16} />}
          title={editSchool ? `Edit school \u00b7 ${editSchool.name}` : 'Add a new school'}
          subtitle={editSchool
            ? `Editing ${editSchool.tenant_id} \u00b7 Update plan, board, state or data regions`
            : 'Provisions a new isolated tenant \u00b7 8 sections \u00b7 Identity, branding, contacts, GST, plan & data residency'}
          meta={editSchool
            ? <Chip label={`Editing \u00b7 ${editSchool.tenant_id}`} variant="indigo" />
            : <Chip label="Auto-generates tenant ID" variant="indigo" />}
        >
          {/* Info banner */}
          <div className="mt-5 flex items-start gap-3 rounded-[11px] border border-[var(--pu-soft)] bg-gradient-to-b from-[#F6F3FF] to-white p-[14px_16px]">
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[7px] bg-[var(--pu)] text-white">
              <Shield size={16} />
            </span>
            <div>
              <h4 className="mb-1 text-[13px] font-semibold">How tenant isolation works</h4>
              <p className="text-[11.5px] leading-[1.55] text-[var(--ink-2)]">
                On submit, Eskoolia provisions a new tenant with an immutable{' '}
                <code className="rounded border border-[var(--bd)] bg-white px-[5px] py-px font-mono text-[10.5px] text-[var(--pu-deep)]">tenant_id</code>,
                a dedicated DB schema in the chosen region, and a sandboxed S3 bucket. All ERP queries run with{' '}
                <code className="rounded border border-[var(--bd)] bg-white px-[5px] py-px font-mono text-[10.5px] text-[var(--pu-deep)]">WHERE tenant_id = :school</code>.
                Zero cross-tenant visibility \u2014 only Super Admin can read across.
              </p>
            </div>
          </div>

          {/* 01 School identity */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="01">School identity</SectionHead>
            <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2">
              <Fld label="School name" required span="2" error={fieldErrors.name}>
                <input
                  className={`${inputCls}${fieldErrors.name ? ' !border-[var(--danger)] focus:!border-[var(--danger)]' : ''}`}
                  data-field-error={fieldErrors.name ? 'true' : undefined}
                  placeholder="e.g. Vasavi Vidyalaya Public School"
                  value={provisionForm.name}
                  onChange={e => {
                    setProvisionForm(f => ({ ...f, name: e.target.value }));
                    if (fieldErrors.name) setFieldErrors(f => ({ ...f, name: '' }));
                  }}
                />
              </Fld>
              <Fld label="Short code" required hint="Uppercase">
                <input className={`${monoInputCls} uppercase`} placeholder="VVP-HYD" maxLength={10}
                  value={editFields.short_code}
                  onChange={e => setEditFields(f => ({ ...f, short_code: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '') }))} />
              </Fld>
              <Fld label="Subdomain URL" required={!editSchool} hint={editSchool ? 'Immutable \u00b7 cannot be changed' : 'Lowercase \u00b7 no spaces'} span="2">
                <div className={`flex overflow-hidden rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] transition ${editSchool ? 'opacity-60' : 'focus-within:border-[var(--pu)] focus-within:shadow-[0_0_0_3px_rgba(109,74,255,.12)]'}`}>
                  <span className="flex items-center border-r border-[var(--bd-2)] bg-[var(--bg-2)] px-[11px] font-mono text-[12px] text-[var(--ink-3)]">https://</span>
                  <input className="h-9 flex-1 border-none bg-transparent px-3 text-[13px] outline-none"
                    placeholder="vasavi-hyd"
                    readOnly={!!editSchool}
                    maxLength={63}
                    value={provisionForm.subdomain_url}
                    onChange={e => !editSchool && setProvisionForm(f => ({ ...f, subdomain_url: e.target.value }))} />
                  <span className="flex items-center border-l border-[var(--bd-2)] bg-[var(--bg-2)] px-[11px] font-mono text-[12px] text-[var(--ink-3)]">.eskoolia.com</span>
                </div>
              </Fld>
              <Fld label="School type">
                <select className={selectCls} title="School type">
                  <option>K-12 \u00b7 Day school</option><option>K-12 \u00b7 Residential</option>
                  <option>Pre-primary only</option><option>Secondary only</option>
                  <option>Higher Secondary / Jr. College</option>
                </select>
              </Fld>
              <Fld label="Established year">
                <input type="number" className={inputCls} placeholder="1998"
                  min={1800} max={new Date().getFullYear()} />
              </Fld>
              <Fld label="Medium of instruction">
                <select className={selectCls} title="Medium of instruction">
                  <option>English</option><option>English &amp; Hindi</option>
                  <option>English &amp; Telugu</option><option>Telugu</option>
                </select>
              </Fld>
              <Fld label="Academic year start">
                {addingAcadYear ? (() => {
                  const label = `${acadYearDraft.startMonth} ${acadYearDraft.startYear} \u2013 ${acadYearDraft.endMonth} ${acadYearDraft.endYear}`;
                  const isDup = acadYears.includes(label);
                  const startVal = parseInt(acadYearDraft.startYear) * 12 + MONTHS.indexOf(acadYearDraft.startMonth as typeof MONTHS[number]);
                  const endVal   = parseInt(acadYearDraft.endYear)   * 12 + MONTHS.indexOf(acadYearDraft.endMonth   as typeof MONTHS[number]);
                  const isSameMonth   = endVal === startVal;
                  const isEndBefore   = endVal < startVal;
                  const isShortSpan   = !isEndBefore && !isSameMonth && (endVal - startVal) < 3;
                  const hasError = isDup || isSameMonth || isEndBefore;
                  return (
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <MonthYearPicker
                          value={{ month: acadYearDraft.startMonth, year: acadYearDraft.startYear }}
                          onChange={v => setAcadYearDraft(d => ({ ...d, startMonth: v.month, startYear: v.year }))}
                        />
                        <span className="select-none text-[13px] text-[var(--ink-3)]">&#x2013;</span>
                        <MonthYearPicker
                          value={{ month: acadYearDraft.endMonth, year: acadYearDraft.endYear }}
                          onChange={v => setAcadYearDraft(d => ({ ...d, endMonth: v.month, endYear: v.year }))}
                          minValue={{ month: acadYearDraft.startMonth, year: acadYearDraft.startYear }}
                        />
                      </div>
                      {isEndBefore && (
                        <p className="text-[11px] text-red-600 font-medium">&#x26D4; End month must come after start month.</p>
                      )}
                      {isSameMonth && (
                        <p className="text-[11px] text-red-600 font-medium">&#x26D4; Start and end cannot be the same month.</p>
                      )}
                      {isShortSpan && (
                        <p className="text-[11px] text-amber-600">&#x26A0;&#xFE0F; Span is less than 3 months &mdash; is this intentional?</p>
                      )}
                      {isDup && (
                        <p className="text-[11px] text-amber-600">&#x26A0;&#xFE0F; &ldquo;{label}&rdquo; is already in the list.</p>
                      )}
                      <div className="flex gap-1.5">
                        <button type="button" disabled={hasError}
                          onClick={() => { setAcadYears(y => [label, ...y]); setAddingAcadYear(false); }}
                          className="inline-flex h-8 items-center rounded-lg border border-[var(--pu)] bg-[var(--pu)] px-3 text-[12px] font-medium text-white disabled:opacity-40 disabled:cursor-not-allowed">
                          Add
                        </button>
                        <button type="button" onClick={() => setAddingAcadYear(false)}
                          className="inline-flex h-8 items-center rounded-lg border border-[var(--bd-2)] px-3 text-[12px] text-[var(--ink-2)] hover:bg-[var(--bg-2)]">
                          Cancel
                        </button>
                      </div>
                    </div>
                  );
                })() : (
                  <div className="flex gap-1.5">
                    <select className={`${selectCls} flex-1`} title="Academic year start">
                      {Array.from(new Set(acadYears))
                        .filter(yr => { const m = yr.match(/\d{4}/); return m ? parseInt(m[0]) >= new Date().getFullYear() : true; })
                        .sort((a, b) => { const ma = a.match(/\d{4}/); const mb = b.match(/\d{4}/); return (mb ? parseInt(mb[0]) : 0) - (ma ? parseInt(ma[0]) : 0); })
                        .map(yr => <option key={yr} value={yr}>{yr}</option>)}
                    </select>
                    <button type="button" title="Add academic year"
                      onClick={() => setAddingAcadYear(true)}
                      className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] text-[var(--ink-2)] transition hover:border-[var(--pu)] hover:text-[var(--pu)]">
                      <Plus size={14} />
                    </button>
                  </div>
                )}
              </Fld>
            </div>
          </div>

          {/* 02 Board affiliation */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="02">Board affiliation</SectionHead>
            <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2">
              <Fld label="Board" required>
                <select className={selectCls} title="Board" value={provisionForm.board}
                  onChange={e => setProvisionForm(f => ({ ...f, board: e.target.value as BoardType }))}>
                  <option value="">Select board…</option>
                  {BOARDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                </select>
              </Fld>
              <Fld label="Affiliation number">
                <input className={monoInputCls} placeholder="CBSE/AFF/930451"
                  maxLength={64}
                  value={editFields.affiliation_number}
                  onChange={e => setEditFields(f => ({ ...f, affiliation_number: e.target.value.replace(/[^A-Za-z0-9/\- ]/g, '') }))} />
              </Fld>
              <Fld label="UDISE+ code" hint="11 digits">
                <input className={monoInputCls} placeholder="36050200101" maxLength={11}
                  inputMode="numeric"
                  value={editFields.udise_code}
                  onChange={e => setEditFields(f => ({ ...f, udise_code: e.target.value.replace(/\D/g, '') }))} />
              </Fld>
              <Fld label="State" required error={fieldErrors.state}>
                <select
                  className={`${selectCls}${fieldErrors.state ? ' !border-[var(--danger)] focus:!border-[var(--danger)]' : ''}`}
                  data-field-error={fieldErrors.state ? 'true' : undefined}
                  title="State"
                  value={provisionForm.state}
                  onChange={e => {
                    setProvisionForm(f => ({ ...f, state: e.target.value }));
                    if (fieldErrors.state) setFieldErrors(f => ({ ...f, state: '' }));
                  }}
                >
                  <option value="">Select state\u2026</option>
                  {[['36','Telangana'],['37','Andhra Pradesh'],['29','Karnataka'],['33','Tamil Nadu'],['27','Maharashtra'],['07','Delhi']].map(([code, name]) => (
                    <option key={code} value={code}>{name} ({code})</option>
                  ))}
                </select>
              </Fld>
              <Fld label="Affiliation valid till">
                <input type="date" className={inputCls} defaultValue="2030-03-31" min={new Date().toISOString().slice(0, 10)} title="Affiliation valid till" />
              </Fld>
            </div>
          </div>

          {/* 03 Branding */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="03">Branding</SectionHead>
            <div className="grid grid-cols-2 gap-3.5">
              <Fld label="School logo">
                <label
                  onDragOver={e => { e.preventDefault(); setLogoDragging(true); }}
                  onDragLeave={() => setLogoDragging(false)}
                  onDrop={e => {
                    e.preventDefault();
                    setLogoDragging(false);
                    const file = e.dataTransfer.files?.[0];
                    if (file) {
                      if (!file.type.startsWith('image/')) { toast.error('Only image files are accepted (PNG, JPG, SVG). PDF files are not supported.'); return; }
                      setLogoFile(file); setLogoPreview(URL.createObjectURL(file));
                    }
                  }}
                  className={`flex cursor-pointer items-center gap-3 rounded-[9px] border border-dashed bg-[var(--bg-2)] p-[10px_12px] transition-colors ${logoDragging ? 'border-[var(--pu)] bg-[rgba(109,74,255,0.06)]' : 'border-[var(--bd-3)]'}`}
                >
                  {logoPreview
                    ? <img src={logoPreview} alt="Logo preview" className="h-11 w-11 flex-shrink-0 rounded-[9px] object-contain" />
                    : <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#7C5BFF] to-[#5836E0] text-[13px] font-semibold text-white">
                        {provisionForm.name ? schoolInitials(provisionForm.name) : 'VV'}
                      </span>
                  }
                  <span className="text-[11.5px] leading-[1.45] text-[var(--ink-2)]">
                    <b className="mb-0.5 block text-[12.5px] font-semibold text-[var(--ink-1)]">
                      {logoFile ? logoFile.name : 'Drop a PNG or SVG here'}
                    </b>
                    or <span className="font-semibold text-[var(--pu-deep)]">browse files</span> &middot; 1:1 ratio &middot; max 1 MB
                  </span>
                  <input
                    id="logo-upload"
                    type="file"
                    accept="image/png,image/svg+xml,image/jpeg,image/webp"
                    className="hidden"
                    onChange={e => {
                      const file = e.target.files?.[0];
                      if (file) {
                        if (!file.type.startsWith('image/')) { toast.error('Only image files are accepted (PNG, JPG, SVG). PDF files are not supported.'); e.target.value = ''; return; }
                        setLogoFile(file); setLogoPreview(URL.createObjectURL(file));
                      }
                    }}
                  />
                </label>
                {logoFile && (
                  <button type="button" className="mt-1 text-[11px] text-[var(--ink-3)] hover:text-red-500 transition-colors"
                    onClick={() => { setLogoFile(null); setLogoPreview(editSchool?.logo_url || null); }}>
                    Remove selected file
                  </button>
                )}
              </Fld>
              <Fld label="Primary brand color">
                <div className="flex h-[38px] items-center gap-1.5">
                  {PALETTE_COLORS.map(c => (
                    <button key={c.hex} type="button" onClick={() => { setSelectedColor(c.hex); setEditFields(f => ({ ...f, brand_color: c.hex })); }} title={c.hex}
                      className={`relative h-7 w-7 rounded-[7px] border-2 transition-all ${c.bg} ${selectedColor === c.hex ? 'scale-105 border-[var(--ink-1)]' : 'border-transparent'}`}>
                      {selectedColor === c.hex ? <span className="pointer-events-none absolute inset-[3px] rounded border-2 border-white" /> : null}
                    </button>
                  ))}
                </div>
                <span className="mt-1 text-[10.5px] text-[var(--ink-3)]">Applied across portal headers, badges &amp; the parent app.</span>
              </Fld>
            </div>
          </div>

          {/* 04 Principal & contact */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="04">Principal &amp; primary contact</SectionHead>
            <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2">
              <Fld label="Principal name" required error={fieldErrors.principal_name}>
                <input className={`${inputCls}${fieldErrors.principal_name ? ' !border-[var(--danger)]' : ''}`} placeholder="Dr. M. Iyer" value={editFields.principal_name}
                  data-field-error={fieldErrors.principal_name ? 'true' : undefined}
                  onChange={e => { setEditFields(f => ({ ...f, principal_name: e.target.value })); if (fieldErrors.principal_name) setFieldErrors(p => ({ ...p, principal_name: '' })); }} />
              </Fld>
              <Fld label="Designation"><input className={inputCls} defaultValue="Principal" title="Designation" /></Fld>
              <Fld label="Email" required error={fieldErrors.principal_email}>
                <input type="email" className={`${inputCls}${fieldErrors.principal_email ? ' !border-[var(--danger)]' : ''}`} placeholder="principal@school.edu.in" value={editFields.principal_email}
                  data-field-error={fieldErrors.principal_email ? 'true' : undefined}
                  onChange={e => { setEditFields(f => ({ ...f, principal_email: e.target.value })); if (fieldErrors.principal_email) setFieldErrors(p => ({ ...p, principal_email: '' })); }} />
              </Fld>
              <Fld label="Mobile">
                <div className="flex overflow-hidden rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] transition focus-within:border-[var(--pu)] focus-within:shadow-[0_0_0_3px_rgba(109,74,255,.12)]">
                  <span className="flex items-center border-r border-[var(--bd-2)] bg-[var(--bg-2)] px-[11px] font-mono text-[12px] text-[var(--ink-3)]">+91</span>
                  <input type="tel" className="h-9 flex-1 border-none bg-transparent px-3 text-[13px] outline-none" placeholder="98765 43210" maxLength={10} inputMode="numeric"
                    value={editFields.principal_phone}
                    onChange={e => setEditFields(f => ({ ...f, principal_phone: e.target.value.replace(/\D/g, '') }))} />
                </div>
              </Fld>
              <Fld label="Alternate contact"><input type="tel" className={inputCls} placeholder="+91 98765 43211" inputMode="numeric" maxLength={13}
                onInput={e => { (e.target as HTMLInputElement).value = (e.target as HTMLInputElement).value.replace(/[^0-9+]/g, ''); }} /></Fld>
              <Fld label="Owner role at school">
                <select className={selectCls} title="Owner role at school">
                  <option>Principal</option><option>Correspondent</option>
                  <option>Trustee / Secretary</option><option>Owner / Founder</option><option>IT Admin</option>
                </select>
              </Fld>
            </div>
          </div>

          {/* 05 Campus address */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="05">Campus address &amp; geography</SectionHead>
            <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2">
              <Fld label="Street address" span="3">
                <textarea className="min-h-[72px] w-full resize-y rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 py-[10px] text-[13px] leading-relaxed outline-none transition focus:border-[var(--pu)] focus:shadow-[0_0_0_3px_rgba(109,74,255,.12)]"
                  placeholder="Plot 22, Road No. 12, Banjara Hills"
                  value={editFields.campus_address}
                  onChange={e => setEditFields(f => ({ ...f, campus_address: e.target.value }))} />
              </Fld>
              <Fld label="City"><input className={inputCls} placeholder="Hyderabad" value={editFields.city} onChange={e => setEditFields(f => ({ ...f, city: e.target.value }))} /></Fld>
              <Fld label="State">
                <select className={selectCls} title="State">
                  {[['36','Telangana'],['37','Andhra Pradesh'],['29','Karnataka'],['33','Tamil Nadu'],['27','Maharashtra'],['07','Delhi']].map(([code, name]) => (
                    <option key={code}>{name} ({code})</option>
                  ))}
                </select>
              </Fld>
              <Fld label="PIN code"><input className={monoInputCls} placeholder="500034" maxLength={6} inputMode="numeric"
                value={editFields.pin_code}
                onChange={e => setEditFields(f => ({ ...f, pin_code: e.target.value.replace(/\D/g, '') }))} /></Fld>
            </div>
          </div>

          {/* 06 GST & legal */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="06">GST &amp; legal</SectionHead>
            <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2">
              <Fld label="GST registration">
                <select className={selectCls} title="GST registration"
                  value={editFields.gst_registered}
                  onChange={e => setEditFields(f => ({ ...f, gst_registered: e.target.value }))}>
                  <option value="yes">GST-registered</option>
                  <option value="no">Unregistered (exempt)</option>
                </select>
              </Fld>
              <Fld label="PAN" required error={fieldErrors.pan}>
                <input className={`${monoInputCls} uppercase${fieldErrors.pan ? ' !border-[var(--danger)]' : ''}`} placeholder="AAACE9988K" maxLength={10}
                  value={editFields.pan}
                  data-field-error={fieldErrors.pan ? 'true' : undefined}
                  onChange={e => { setEditFields(f => ({ ...f, pan: e.target.value.toUpperCase() })); if (fieldErrors.pan) setFieldErrors(p => ({ ...p, pan: '' })); }} />
              </Fld>
              <Fld label="Legal entity name"><input className={inputCls} placeholder="Vasavi Educational Trust" /></Fld>
              <Fld label="Entity type">
                <select className={selectCls} title="Entity type">
                  <option>Educational Trust</option><option>Society (Reg. Soc. Act 1860)</option>
                  <option>Section 8 Company</option><option>Private Limited</option><option>Sole proprietorship</option>
                </select>
              </Fld>
              <Fld label="Trust / Reg. number"><input className={monoInputCls} placeholder="AP/2008/SOC/01122" /></Fld>
            </div>
          </div>

          {/* 07 Plan & capacity */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="07">Plan &amp; capacity limits</SectionHead>
            <div className="grid grid-cols-4 gap-3.5 max-md:grid-cols-2">
              <Fld label="Subscription plan" required span="2">
                <select className={selectCls} title="Subscription plan" value={provisionForm.plan}
                  onChange={e => setProvisionForm(f => ({ ...f, plan: e.target.value as PlanType }))}>
                  {subscriptionPlans.length > 0
                    ? subscriptionPlans.map(p => (
                        <option key={p.code} value={p.code}>{p.name}</option>
                      ))
                    : <>
                        <option value="starter">Starter</option>
                        <option value="premium">Premium</option>
                        <option value="enterprise">Enterprise</option>
                      </>
                  }
                </select>
              </Fld>
              <Fld label="Trial period">
                <select className={selectCls} title="Trial period"><option>30 days</option><option>14 days</option><option>No trial</option></select>
              </Fld>
              <Fld label="Go-live date">
                <input type="date" className={inputCls} defaultValue="2026-06-01" min={new Date().toISOString().slice(0, 10)} title="Go-live date" />
              </Fld>
              <Fld label="Student seat limit"><input type="number" className={inputCls} title="Student seat limit" placeholder="2000"
                value={editFields.seats} onChange={e => setEditFields(f => ({ ...f, seats: e.target.value }))} /></Fld>
              <Fld label="Staff seat limit"><input type="number" className={inputCls} defaultValue={200} title="Staff seat limit" /></Fld>
              <Fld label="Storage cap" hint="GB"><input type="number" className={inputCls} defaultValue={50} title="Storage cap" /></Fld>
              <Fld label="Billing cycle">
                <select className={selectCls} title="Billing cycle"><option>Annual \u00b7 pay upfront</option><option>Half-yearly</option><option>Quarterly</option><option>Monthly</option></select>
              </Fld>
            </div>
          </div>

          {/* 08 Modules — hidden */}
          <div className="hidden border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="08">Modules to enable</SectionHead>
            <div className="grid grid-cols-4 gap-2.5 max-md:grid-cols-2">
              {moduleDefs.map(m => {
                const on = enabledModules.has(m.name);
                return (
                  <button key={m.name} type="button"
                    onClick={() => setEnabledModules(prev => {
                      const s = new Set(prev);
                      if (s.has(m.name)) s.delete(m.name); else s.add(m.name);
                      return s;
                    })}
                    className={`flex cursor-pointer items-center gap-2.5 rounded-[9px] border p-[10px_12px] text-left transition-all ${
                      on ? 'border-[var(--pu)] bg-[var(--pu-tint,#F6F3FF)]' : 'border-[var(--bd-2)] bg-[var(--bg-1)] hover:bg-[var(--bg-2)]'
                    }`}
                  >
                    <span className={`flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-[6px] transition-all ${on ? 'bg-[var(--pu)] text-white' : 'bg-[var(--bg-3)] text-[var(--ink-2)]'}`}>
                      {m.icon}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-[550] leading-[1.2]">{m.name}</span>
                      <span className="mt-px block text-[9.5px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-3)]">{m.tag}</span>
                    </span>
                    <span className={`flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded border-[1.5px] transition-all ${on ? 'border-[var(--pu)] bg-[var(--pu)] text-white' : 'border-[var(--bd-3)]'}`}>
                      {on ? <Check size={8} strokeWidth={3} /> : null}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="mt-2.5 text-[11px] text-[var(--ink-3)]">Tap a tile to enable / disable. Disabled modules are hidden from the school&apos;s UI entirely.</p>
          </div>

          {/* 08 Data residency */}
          <div className="py-5">
            <SectionHead num="08">
              Data residency &amp; provisioning
              <span className="ml-auto text-[10.5px] font-[400] normal-case tracking-normal text-[var(--ink-4)]">Auto-filled \u00b7 super-admin can override</span>
            </SectionHead>
            <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2">
              <Fld label="Tenant ID" hint="Auto \u00b7 immutable">
                <input className={lockedInputCls} value={editSchool?.tenant_id ?? 'Auto-generated'} readOnly title="Tenant ID" />
              </Fld>
              <Fld label="DB shard region">
                <select className={selectCls} title="DB shard region" value={provisionForm.shard_region ?? ''}
                  onChange={e => setProvisionForm(f => ({ ...f, shard_region: e.target.value }))}>
                  <option value="ap-south-1">ap-south-1 \u00b7 Mumbai</option>
                  <option value="ap-south-2">ap-south-2 \u00b7 Hyderabad</option>
                </select>
              </Fld>
              <Fld label="Storage bucket">
                <input className={lockedInputCls}
                  value={editSchool ? `eskoolia-${editSchool.tenant_id.toLowerCase().replace(/_/g, '-')}` : 'Auto-generated'}
                  readOnly title="Storage bucket" />
              </Fld>
              <Fld label="Backup retention">
                <select className={selectCls} title="Backup retention"
                  value={String(provisionForm.backup_retention ?? 30)}
                  onChange={e => setProvisionForm(f => ({ ...f, backup_retention: Number(e.target.value) }))}>
                  <option value="30">30 days · daily snapshots</option>
                  <option value="90">90 days</option>
                  <option value="365">1 year</option>
                </select>
              </Fld>
              <Fld label="SSO method">
                <select className={selectCls} title="SSO method"
                  value={provisionForm.sso_method ?? 'native'}
                  onChange={e => setProvisionForm(f => ({ ...f, sso_method: e.target.value }))}>
                  <option value="native">Email + password</option>
                  <option value="google">Google Workspace</option>
                  <option value="microsoft">Microsoft 365</option>
                  <option value="saml">SAML 2.0</option>
                </select>
              </Fld>
              <Fld label="API access">
                <select className={selectCls} title="API access"
                  value={editFields.api_access}
                  onChange={e => setEditFields(f => ({ ...f, api_access: e.target.value }))}>
                  <option value="disabled">Disabled (default)</option>
                  <option value="enabled">Enabled (read + write)</option>
                </select>
              </Fld>
            </div>
          </div>

          {!editSchool && (
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="09">
              Admin login credentials
              <span className="ml-auto text-[10.5px] font-[400] normal-case tracking-normal text-[var(--ink-4)]">
                Leave blank to auto-generate
              </span>
            </SectionHead>
            <div className="mb-3 flex items-start gap-2.5 rounded-[10px] border border-[#D1FAE5] bg-[#F0FDF8] p-[10px_12px]">
              <Info size={13} className="mt-px flex-shrink-0 text-[#059669]" />
              <p className="text-[11.5px] leading-[1.55] text-[#065F46]">
                These credentials let the school admin log in to the ERP portal.
                Fill them in manually, or click <strong>Generate</strong> — either way they appear in the green banner after provisioning.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3.5 max-md:grid-cols-1">
              <Fld label="Admin username" hint="Lowercase · no spaces · e.g. vasavi_admin">
                <input
                  className={inputCls}
                  placeholder={provisionForm.subdomain_url ? `${provisionForm.subdomain_url.replace(/-/g, '_')}_admin` : 'Auto: subdomain_admin'}
                  value={provisionForm.admin_username ?? ''}
                  onChange={e => setProvisionForm(f => ({ ...f, admin_username: e.target.value.toLowerCase().replace(/\s/g, '_') }))}
                />
              </Fld>
              <Fld label="Admin password" hint="Min 10 chars · mix of letters, numbers, symbols">
                <div className="flex gap-2">
                  <input
                    className={`${inputCls} flex-1 font-mono tracking-wider`}
                    type="text"
                    placeholder="Leave blank to auto-generate"
                    value={provisionForm.admin_password ?? ''}
                    onChange={e => setProvisionForm(f => ({ ...f, admin_password: e.target.value }))}
                  />
                  <button
                    type="button"
                    title="Generate a secure random password"
                    onClick={() => {
                      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
                      const pwd = Array.from({ length: 14 }, (_, i) => {
                        if (i === 0) return chars.slice(0, 26)[Math.floor(Math.random() * 26)];
                        if (i === 13) return '!@#$'[Math.floor(Math.random() * 4)];
                        return chars[Math.floor(Math.random() * chars.length)];
                      }).sort(() => Math.random() - 0.5).join('');
                      setProvisionForm(f => ({ ...f, admin_password: pwd }));
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[var(--bd-2)] bg-[var(--bg-2)] px-3 text-[12px] font-[550] text-[var(--ink-1)] hover:bg-[var(--bg-1)] flex-shrink-0"
                  >
                    <RefreshCw size={12} /> Generate
                  </button>
                </div>
              </Fld>
            </div>
          </div>
          )}

          {/* Footer */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bd)] pt-[18px]">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-2)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              {editSchool
                ? 'Tenant ID & subdomain are immutable. Only name, plan, board, state and regions can be changed.'
                : 'Tenant ID & subdomain are immutable once provisioned. A welcome email is sent to the principal automatically.'}
            </span>
            <div className="flex gap-2">
              {editSchool ? (
                <button type="button"
                  onClick={() => { setEditSchool(null); setAccAddOpen(false); setProvisionForm({ name: '', subdomain_url: '', state: '', board: 'OTHER', plan: 'trial', shard_region: '', storage_region: '', backup_retention: 30, sso_method: 'native', admin_username: '', admin_password: '' }); setEditFields({ short_code: '', gstin: '', pan: '', udise_code: '', seats: '', api_access: 'disabled', brand_color: '', gst_registered: 'yes', principal_name: '', principal_email: '', principal_phone: '', campus_address: '', city: '', pin_code: '', affiliation_number: '' }); setLogoFile(null); setLogoPreview(null); setSelectedColor(PALETTE_COLORS[0]!.hex); setProvisionError(null); }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border-0 bg-transparent px-3.5 text-[12.5px] font-[550] text-[var(--ink-1)] hover:bg-[var(--bg-2)]">
                  Cancel edit
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => {
                    setAccAddOpen(false);
                    setProvisionForm({ name: '', subdomain_url: '', state: '', board: 'OTHER', plan: 'trial', shard_region: '', storage_region: '', backup_retention: 30, sso_method: 'native', admin_username: '', admin_password: '' });
                    setEditFields({ short_code: '', gstin: '', pan: '', udise_code: '', seats: '', api_access: 'disabled', brand_color: '', gst_registered: 'yes', principal_name: '', principal_email: '', principal_phone: '', campus_address: '', city: '', pin_code: '', affiliation_number: '' });
                    setLogoFile(null);
                    setLogoPreview(null);
                    setSelectedColor(PALETTE_COLORS[0]!.hex);
                    setProvisionError(null);
                  }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border-0 bg-transparent px-3.5 text-[12.5px] font-[550] text-[var(--ink-1)] hover:bg-[var(--bg-2)]">
                    Cancel
                  </button>
                  <button type="button"
                    onClick={() => {
                      try {
                        sessionStorage.setItem('school_add_draft', JSON.stringify({ provisionForm, editFields }));
                      } catch { /* storage unavailable */ }
                      toast.success('Draft saved — your progress is preserved for this session.');
                    }}
                    className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[var(--bd-2)] bg-[var(--bg-1)] px-3.5 text-[12.5px] font-[550] text-[var(--ink-1)] hover:bg-[var(--bg-2)]">
                    Save as draft
                  </button>
                </>
              )}
              <button type="button" disabled={provisioning} onClick={() => void handleProvisionSubmit()}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[var(--pu)] px-3.5 text-[12.5px] font-[550] text-white shadow-[0_1px_2px_rgba(79,53,204,.25),inset_0_1px_0_rgba(255,255,255,.16)] transition hover:bg-[var(--pu-deep)] disabled:opacity-60">
                <Check className="h-3.5 w-3.5" />
                {provisioning
                  ? (editSchool ? 'Saving\u2026' : 'Provisioning\u2026')
                  : (editSchool ? 'Save changes' : 'Provision school')}
              </button>
            </div>
          </div>
          {provisionError ? <p className="mt-2 text-[12px] text-[var(--danger)]">{provisionError}</p> : null}
        </Accordion>
      </div>

      {/* ACCORDION 02 — SMART FILTERS */}
      <Accordion num="02" open={accFiltersOpen} onToggle={() => setAccFiltersOpen(v => !v)}
        icon={<Filter size={16} />}
        title="Smart filters"
        subtitle="Find schools by status, plan, board, region &amp; billing health"
        meta={activeFilterCount > 0 ? <Chip label={`${activeFilterCount} active`} variant="indigo" /> : undefined}
      >
        <div className="pt-5">
          <div className="mb-[18px] grid grid-cols-5 gap-3 max-md:grid-cols-2">
            <div className="col-span-2">
              <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">Search</label>
              <div className="flex overflow-hidden rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] transition focus-within:border-[var(--pu)] focus-within:shadow-[0_0_0_3px_rgba(109,74,255,.12)]">
                <span className="flex items-center border-r border-[var(--bd-2)] bg-white px-[11px] text-[var(--ink-3)]"><ExternalLink size={13} /></span>
                <input className="h-[38px] flex-1 bg-transparent px-3 text-[13px] outline-none"
                  placeholder="Name, tenant ID, GSTIN, UDISE, owner email\u2026"
                  value={search} onChange={e => setSearch(e.target.value)} />
              </div>
            </div>
            {/* Plan */}
            <div>
              <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">Plan</label>
              <select className={selectCls} title="Plan" value={pendingPlan} onChange={e => setPendingPlan(e.target.value)}>
                <option value="">All plans</option>
                <option value="trial">Trial</option>
                <option value="starter">Starter</option>
                <option value="standard">Standard</option>
                <option value="premium">Premium</option>
                <option value="enterprise">Enterprise</option>
              </select>
            </div>
            {/* Board */}
            <div>
              <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">Board</label>
              <select className={selectCls} title="Board" value={pendingBoard} onChange={e => setPendingBoard(e.target.value)}>
                <option value="">All boards</option>
                {BOARDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
            {/* State */}
            <div>
              <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">State</label>
              <select className={selectCls} title="State" value={pendingState} onChange={e => setPendingState(e.target.value)}>
                <option value="">All states</option>
                <option value="36">Telangana (36)</option>
                <option value="37">Andhra Pradesh (37)</option>
              </select>
            </div>
            {/* Region */}
            <div>
              <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">Region</label>
              <select className={selectCls} title="Region">
                <option value="">All regions</option>
                <option value="ap-south-1">ap-south-1 Mumbai</option>
                <option value="ap-south-2">ap-south-2 Hyderabad</option>
              </select>
            </div>
          </div>

          <div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-2)]">Health flags</div>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  { key: 'billing_overdue', label: 'Billing overdue', count: healthFlagCounts.billing_overdue },
                  { key: 'storage_80',      label: 'Storage 80%+',    count: healthFlagCounts.storage_80 },
                  { key: 'trial_ending',    label: 'Trial ending <7d', count: healthFlagCounts.trial_ending },
                  { key: 'gstin_missing',   label: 'GSTIN missing',   count: healthFlagCounts.gstin_missing },
                ] as const
              ).map(o => (
                <FilterPill
                  key={o.key}
                  label={o.label}
                  count={o.count}
                  active={healthFlagFilter === o.key}
                  onClick={() => setHealthFlagFilter(prev => prev === o.key ? '' : o.key)}
                />
              ))}
            </div>
          </div>

          <div className="mt-4 flex justify-end border-t border-dashed border-[var(--bd-2)] pt-4">
            <button
              onClick={handleApplyFilters}
              className="rounded-lg bg-[#5B4FCF] px-5 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#4A3FBF] active:scale-95"
            >
              Apply filters
            </button>
          </div>

        </div>
      </Accordion>

      {/* ACCORDION 03 — SCHOOLS LIST */}
      <Accordion num="03" open={accListOpen} onToggle={() => setAccListOpen(v => !v)}
        icon={<Users size={16} />}
        title="Schools list"
        subtitle={`${rows.length} of ${response.count || rows.length} shown \u00b7 sorted by last activity`}
        meta={
          <>
            <Chip label={`${totalStudents.toLocaleString('en-IN')} students`} variant="ok" />
            {totalActiveStudents > 0 && totalActiveStudents < totalStudents && (
              <>
                <Chip label={`${totalActiveStudents.toLocaleString('en-IN')} active`} variant="ok" />
                <Chip label={`${totalInactiveStudents.toLocaleString('en-IN')} inactive`} variant="default" />
              </>
            )}
            <Chip label={`${totalStaff.toLocaleString('en-IN')} staff`} variant="info" />
          </>
        }
      >
        <div className="pt-4">
          {/* ── Status quick tabs — counts come from server status_counts (always accurate) ── */}
          <div className="mb-4 flex flex-wrap gap-1.5">
            {([
              { value: 'all'       as const, label: 'All',       count: response.status_counts?.all       ?? globalStats.total   ?? response.count },
              { value: 'active'    as const, label: 'Active',    count: response.status_counts?.active    ?? globalStats.active },
              { value: 'trial'     as const, label: 'Trial',     count: response.status_counts?.trial     ?? globalStats.trial },
              { value: 'suspended' as const, label: 'Suspended', count: response.status_counts?.suspended ?? globalStats.attention },
              { value: 'archived'  as const, label: 'Archived',  count: response.status_counts?.archived  ?? globalStats.archived },
            ] as const).map(tab => (
              <button
                key={tab.value}
                type="button"
                onClick={() => setStatusFilter(tab.value)}
                className={[
                  'inline-flex items-center gap-1.5 rounded-full px-3.5 py-[5px] text-[12px] font-[550] transition-colors',
                  statusFilter === tab.value
                    ? 'bg-[var(--pu)] text-white shadow-sm'
                    : 'border border-[var(--bd-2)] bg-[var(--bg-1)] text-[var(--ink-2)] hover:bg-[var(--bg-2)]',
                ].join(' ')}
              >
                {tab.label}
                <span className={[
                  'rounded-full px-1.5 py-[1px] text-[10.5px] font-[600]',
                  statusFilter === tab.value
                    ? 'bg-white/20 text-white'
                    : tab.value === 'archived' ? 'bg-[var(--ink-4)] text-[var(--ink-2)]'
                    : tab.value === 'suspended' ? 'bg-red-100 text-red-600'
                    : 'bg-[var(--bg-3)] text-[var(--ink-2)]',
                ].join(' ')}>{tab.count}</span>
              </button>
            ))}
          </div>
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-[var(--ink-2)]">
              Active filter: <strong className="font-[550] text-[var(--pu-deep)]">
                {statusFilter === 'all' ? 'All \u00b7 Active' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              </strong>
            </p>
            <div className="flex gap-1.5">
              <button type="button" onClick={() => void handleExportSchoolsXlsx()} disabled={exportBusy} className="inline-flex h-[30px] items-center gap-1.5 rounded-[7px] border border-[var(--bd-2)] bg-[var(--bg-1)] px-[11px] text-[12px] font-[550] text-[var(--ink-1)] hover:bg-[var(--bg-2)] disabled:opacity-60 disabled:cursor-not-allowed">
                <Download size={12} /> {exportBusy ? 'Exporting…' : 'Export'}
              </button>
              <button type="button" onClick={() => void loadSchools()} className="inline-flex h-[30px] items-center gap-1.5 rounded-[7px] border border-[var(--bd-2)] bg-[var(--bg-1)] px-[11px] text-[12px] font-[550] text-[var(--ink-1)] hover:bg-[var(--bg-2)]">
                <RefreshCw size={12} /> Refresh
              </button>
            </div>
          </div>

          {loading ? (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    {['School','Tenant \u00b7 State','Board','GSTIN','Plan \u00b7 Students','Status','Actions'].map((h, i) => (
                      <th key={h} className={`border-y border-[var(--bd)] bg-[var(--bg-2)] px-3.5 py-[9px] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-3)] first:rounded-l-lg first:border-l first:pl-[18px] last:rounded-r-lg last:border-r last:pr-[18px] whitespace-nowrap ${i === 0 ? 'w-[24%]' : ''}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="border-b border-[var(--bd)] py-3.5 pl-[18px] pr-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-[38px] w-[38px] flex-shrink-0 rounded-[10px] bg-[var(--bg-3)]" />
                          <div className="space-y-1.5"><div className="h-3 w-32 rounded bg-[var(--bg-3)]" /><div className="h-2.5 w-24 rounded bg-[var(--bg-3)]" /></div>
                        </div>
                      </td>
                      {[28, 20, 36, 32, 16].map((w, j) => (
                        <td key={j} className="border-b border-[var(--bd)] px-3.5 py-3.5">
                          <div className={`h-3 w-${w} rounded bg-[var(--bg-3)]`} />
                        </td>
                      ))}
                      <td className="border-b border-[var(--bd)] px-3.5 py-3.5">
                        <div className="h-6 w-16 rounded-full bg-[var(--bg-3)]" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : error ? (
            <div className="rounded-lg border border-[var(--danger-soft)] bg-[var(--danger-soft)] p-4 text-[13px] text-[var(--danger)]">{error}</div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-16 text-center">
              <p className="text-[13px] font-medium text-[var(--ink-2)]">No schools found</p>
              <p className="text-[12px] text-[var(--ink-3)]">Try adjusting the filters or add a new school above.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-0">
                <thead>
                  <tr>
                    {['School','Tenant \u00b7 State','Board','GSTIN','Plan \u00b7 Students','Status','LLM','Actions'].map((h, i) => (
                      <th key={h}
                        className={`border-y border-[var(--bd)] bg-[var(--bg-2)] px-3.5 py-[9px] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-3)] first:rounded-l-lg first:border-l first:pl-[18px] last:rounded-r-lg last:border-r last:pr-[18px] whitespace-nowrap ${i === 0 ? 'w-[24%]' : ''} ${i === 7 ? 'text-right' : 'text-left'}`}
                      >{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map(school => {
                    const initials = schoolInitials(school.name);
                    const gradCls = avatarGradient(school.tenant_id);
                    return (
                      <tr key={school.tenant_id} className="group transition-colors hover:bg-[var(--bg-2)]">
                        <td className="border-b border-[var(--bd)] py-3.5 pl-[18px] pr-3.5 align-middle">
                          <div className="flex min-w-[240px] items-center gap-2.5">
                            <span className={`flex h-[38px] w-[38px] flex-shrink-0 items-center justify-center rounded-[10px] text-[13px] font-semibold text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] ${gradCls}`}>
                              {initials}
                            </span>
                            <span className="min-w-0 flex-1">
                              <Link
                                href={`/super-admin/schools/${school.tenant_id}`}
                                className="block text-[13.5px] font-semibold tracking-[-0.1px] hover:text-[var(--pu)] transition-colors"
                              >
                                {school.name}
                              </Link>
                              <span className="mt-px block font-mono text-[11.5px] text-[var(--ink-3)]">{school.subdomain_url}.eskoolia.com</span>
                              {(school as { campus?: string }).campus ? (
                                <span className="mt-0.5 block text-[10.5px] text-[var(--ink-4)]">{(school as { campus?: string }).campus}</span>
                              ) : null}
                            </span>
                          </div>
                        </td>
                        <td className="border-b border-[var(--bd)] px-3.5 py-3.5 align-middle">
                          <span className="block font-mono text-[12px] font-medium">{school.tenant_id}</span>
                          <span className="mt-0.5 block text-[11.5px] text-[var(--ink-3)]">{school.state ?? school.shard_region ?? '\u2014'}</span>
                        </td>
                        <td className="border-b border-[var(--bd)] px-3.5 py-3.5 align-middle">
                          <Chip label={boardLabel(school.board)} variant={boardVariant(school.board)} />
                          {school.udiseCode ? (
                            <span className="mt-1.5 block font-mono text-[10.5px] text-[var(--ink-3)]">{school.udiseCode}</span>
                          ) : null}
                        </td>
                        <td className="border-b border-[var(--bd)] px-3.5 py-3.5 align-middle">
                          {school.gstin ? (
                            <span className="block font-mono text-[11.5px]">{school.gstin}</span>
                          ) : (
                            <span className="text-[11.5px] text-[var(--ink-4)]">Unregistered</span>
                          )}
                          {school.pan ? <span className="mt-0.5 block font-mono text-[11.5px] text-[var(--ink-3)]">PAN {school.pan}</span> : null}
                        </td>
                        <td className="border-b border-[var(--bd)] px-3.5 py-3.5 align-middle">
                          <Chip label={planLabel(school.plan)} variant={planVariant(school.plan)} />
                          <span className="mt-1.5 block text-[11.5px] text-[var(--ink-3)]">
                            <strong className="font-serif text-[16px] font-normal text-[var(--ink-1)]">
                              {(school.students ?? 0).toLocaleString('en-IN')}
                            </strong>
                            {school.seats ? ` / ${school.seats.toLocaleString('en-IN')} seats` : ''}
                          </span>
                        </td>
                        <td className="border-b border-[var(--bd)] px-3.5 py-3.5 align-middle">
                          <StatusDot status={school.status} />
                          {school.lastActivity ? (
                            <span className="mt-0.5 block text-[11.5px] text-[var(--ink-3)]">{school.lastActivity}</span>
                          ) : null}
                        </td>
                        <td className="border-b border-[var(--bd)] px-3.5 py-3.5 align-middle">
                          <button
                            type="button"
                            disabled={llmToggling.has(school.tenant_id) || !llmStates.has(school.tenant_id)}
                            title={!llmStates.has(school.tenant_id) ? 'School not in LLM registry' : llmStates.get(school.tenant_id)?.llm_enabled ? 'Click to disable LLM' : 'Click to enable LLM'}
                            onClick={() => void handleLLMToggle(school)}
                            className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none disabled:cursor-not-allowed disabled:opacity-40 ${llmStates.get(school.tenant_id)?.llm_enabled ? 'bg-emerald-500' : 'bg-gray-300'}`}
                          >
                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200 ${llmStates.get(school.tenant_id)?.llm_enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                          </button>
                        </td>
                        <td className="border-b border-[var(--bd)] px-3.5 py-3.5 align-middle text-right">
                          <span className="inline-flex gap-0.5 opacity-55 transition-opacity group-hover:opacity-100">
                            {(school.status === 'archived' ? [
                              { title: 'Open',             icon: <ExternalLink size={13} />, action: () => window.open(`/super-admin/schools/${school.tenant_id}`, '_blank') },
                              { title: 'Restore',          icon: <RotateCcw size={13} />,   action: () => setConfirmDialog({ type: 'restore', school }) },
                              { title: 'Audit Logs',       icon: <FileText size={13} />,    action: () => window.open(`/super-admin/schools/${school.tenant_id}/audit`, '_blank') },
                              { title: 'Permanent Delete', icon: <Trash2 size={13} />,      action: () => setConfirmDialog({ type: 'permanent_delete', school }) },
                            ] : school.status === 'suspended' ? [
                              { title: 'Open',        icon: <ExternalLink size={13} />, action: () => window.open(`/super-admin/schools/${school.tenant_id}`, '_blank') },
                              { title: 'Edit',        icon: <Edit2 size={13} />,        action: () => handleEditInForm(school) },
                              { title: 'Reactivate',  icon: <RotateCcw size={13} />,    action: () => setConfirmDialog({ type: 'reactivate', school }) },
                              { title: 'Archive',     icon: <Archive size={13} />,      action: () => setConfirmDialog({ type: 'archive', school }) },
                            ] : [
                              { title: 'Open',        icon: <ExternalLink size={13} />, action: () => window.open(`/super-admin/schools/${school.tenant_id}`, '_blank') },
                              { title: 'Edit',        icon: <Edit2 size={13} />,        action: () => handleEditInForm(school) },
                              { title: 'Impersonate', icon: <Users size={13} />,        action: () => void handleImpersonate(school), loading: impersonatingId === school.tenant_id },
                              { title: 'Suspend',     icon: <Pause size={13} />,        action: () => setConfirmDialog({ type: 'suspend', school }) },
                              { title: 'Archive',     icon: <Archive size={13} />,      action: () => setConfirmDialog({ type: 'archive', school }) },
                            ]).map(btn => (
                              <button key={btn.title} type="button" title={btn.title}
                                disabled={('loading' in btn && btn.loading === true) || ('disabled' in btn && btn.disabled === true)}
                                onClick={e => { e.stopPropagation(); if (!('disabled' in btn && btn.disabled === true)) btn.action(); }}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] border border-transparent bg-transparent text-[var(--ink-3)] transition-all hover:border-[var(--bd)] hover:bg-[var(--bg-2)] hover:text-[var(--ink-1)] disabled:opacity-40"
                              >
                                {btn.icon}
                              </button>
                            ))}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {!loading && !error && response.count > PAGE_SIZE ? (
            <div className="mt-4 flex items-center justify-between text-[12px] text-[var(--ink-2)]">
              <span>{(page - 1) * PAGE_SIZE + 1}\u2013{Math.min(page * PAGE_SIZE, response.count)} of {response.count} schools</span>
              <div className="flex items-center gap-1">
                <button type="button" disabled={page <= 1} onClick={() => setPage(p => p - 1)} title="Previous page"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] border border-transparent bg-transparent text-[var(--ink-3)] transition hover:border-[var(--bd)] hover:bg-[var(--bg-2)] disabled:opacity-30">
                  <ChevronDown className="rotate-90" size={13} />
                </button>
                <button type="button" className="inline-flex h-[30px] items-center justify-center rounded-[7px] border-0 bg-[var(--pu-soft)] px-3 text-[12px] font-[550] text-[var(--pu-deep)]">
                  {page}
                </button>
                <button type="button" disabled={!response.next} onClick={() => setPage(p => p + 1)} title="Next page"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-[7px] border border-transparent bg-transparent text-[var(--ink-3)] transition hover:border-[var(--bd)] hover:bg-[var(--bg-2)] disabled:opacity-30">
                  <ChevronDown className="-rotate-90" size={13} />
                </button>
              </div>
              <span>Rows per page: <strong className="text-[var(--ink-1)]">{PAGE_SIZE}</strong></span>
            </div>
          ) : null}
        </div>
      </Accordion>

    </div>

    {confirmDialog && (
      <ConfirmDialog
        type={confirmDialog.type}
        school={confirmDialog.school}
        busy={confirmBusy}
        onConfirm={() => void handleConfirmAction()}
        onCancel={() => setConfirmDialog(null)}
      />
    )}

    </>
  );
}
