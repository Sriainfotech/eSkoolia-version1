'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-toastify';
import {
  Archive, BookOpen, Bus, Calendar, ChevronDown, Check, CheckCheck, Copy, Download,
  Edit2, ExternalLink, Filter, Info, Pause, Plus, RefreshCw, Shield,
  Users, BarChart2, DollarSign, Bell, X,
} from 'lucide-react';
import { getSchools, impersonateSchool, provisionSchool, updateSchool, deleteSchool } from '@/lib/api/super-admin/schools';
import type {
  BoardType, PaginatedResponse, PlanType, ProvisionSchoolRequest, ProvisionSchoolResponse,
  SchoolFilters, SchoolTenant, SchoolStatus,
} from '@/types/super-admin';

const PAGE_SIZE = 10;

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
  label, required, hint, span, children,
}: {
  label: string; required?: boolean; hint?: string; span?: '2' | '3'; children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1.5 ${span === '2' ? 'col-span-2' : span === '3' ? 'col-span-3' : ''}`}>
      <span className="flex items-center gap-1 text-[11.5px] font-[550] text-[var(--ink-2)]">
        {label}
        {required ? <span className="text-[var(--danger)]">*</span> : null}
        {hint ? <span className="ml-auto text-[10.5px] font-normal text-[var(--ink-3)]">{hint}</span> : null}
      </span>
      {children}
    </label>
  );
}

const inputCls = 'h-[38px] w-full rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 text-[13px] text-[var(--ink-1)] outline-none transition focus:border-[var(--pu)] focus:shadow-[0_0_0_3px_rgba(109,74,255,.12)]';
const selectCls = inputCls;
const monoInputCls = `${inputCls} font-mono text-[12px]`;
const lockedInputCls = `${inputCls} cursor-not-allowed bg-[var(--bg-2)] font-mono text-[12px] font-semibold text-[var(--pu-deep)]`;

// ── Confirmation dialog ───────────────────────────────────────────────────────
function ConfirmDialog({
  type, school, busy, onConfirm, onCancel,
}: {
  type: 'suspend' | 'archive';
  school: SchoolTenant;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl border border-[var(--bd)] bg-[var(--bg-1)] p-6 shadow-2xl">
        <h2 className="mb-2 text-base font-[700] text-[var(--ink-1)]">
          {type === 'suspend' ? 'Suspend school?' : 'Archive school?'}
        </h2>
        <p className="mb-5 text-sm text-[var(--ink-2)]">
          {type === 'suspend'
            ? <><strong>{school.name}</strong> will be suspended immediately — all users will lose access.</>  
            : <><strong>{school.name}</strong> will be permanently archived and removed from the platform. This cannot be undone.</>
          }
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
            className="rounded-xl bg-[var(--danger)] px-4 py-2 text-sm font-[600] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {busy
              ? (type === 'suspend' ? 'Suspending\u2026' : 'Archiving\u2026')
              : (type === 'suspend' ? 'Yes, suspend' : 'Yes, archive')
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// PAGE
export default function SuperAdminSchoolsPage() {
  const [response, setResponse] = useState<PaginatedResponse<SchoolTenant>>(DEFAULT_SCHOOLS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<SchoolStatus | 'all'>('all');

  const [accAddOpen, setAccAddOpen] = useState(false);
  const [accFiltersOpen, setAccFiltersOpen] = useState(true);
  const [accListOpen, setAccListOpen] = useState(true);

  const [provisioning, setProvisioning] = useState(false);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [credsResult, setCredsResult] = useState<ProvisionSchoolResponse | null>(null);
  const [credsCopied, setCredsCopied] = useState<'user' | 'pass' | null>(null);
  const [provisionForm, setProvisionForm] = useState<ProvisionSchoolRequest>({
    name: '', subdomain_url: '', state: '', board: 'OTHER', plan: 'trial',
    shard_region: '', storage_region: '', admin_username: '', admin_password: '',
  });

  const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{ type: 'suspend' | 'archive'; school: SchoolTenant } | null>(null);
  const [confirmBusy, setConfirmBusy] = useState(false);

  const rows = response.results;
  const activeCount   = rows.filter(s => s.status === 'active').length;
  const trialCount    = rows.filter(s => s.status === 'trial').length;
  const attnCount     = rows.filter(s => s.status === 'suspended').length;
  const totalStudents = rows.reduce((a, b) => a + (b.students ?? 0), 0);
  const totalStaff    = rows.reduce((a, b) => a + (b.staff ?? 0), 0);

  const loadSchools = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters: SchoolFilters = {
      page, page_size: PAGE_SIZE,
      search: search.trim() || undefined,
      status: statusFilter === 'all' ? undefined : statusFilter,
    };
    try {
      setResponse(await getSchools(filters));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load schools.');
      setResponse(DEFAULT_SCHOOLS);
    } finally {
      setLoading(false);
    }
  }, [page, search, statusFilter]);

  useEffect(() => { void loadSchools(); }, [loadSchools]);
  useEffect(() => { setPage(1); }, [search, statusFilter]);

  const handleProvisionSubmit = useCallback(async () => {
    setProvisionError(null);
    const sub = provisionForm.subdomain_url.trim().toLowerCase();
    if (!provisionForm.name.trim() || !sub || !provisionForm.state.trim()) {
      setProvisionError('School name, subdomain, and state are required.');
      return;
    }
    if (!/^[a-z0-9-]+$/.test(sub)) {
      setProvisionError('Subdomain may only contain lowercase letters, numbers, and hyphens.');
      return;
    }
    setProvisioning(true);
    try {
      const result = await provisionSchool({ ...provisionForm, subdomain_url: sub });
      setAccAddOpen(false);
      setProvisionForm({ name: '', subdomain_url: '', state: '', board: 'OTHER', plan: 'trial', shard_region: '', storage_region: '', admin_username: '', admin_password: '' });
      setCredsResult(result);
      toast.success('School provisioned — admin credentials ready below.');
      await loadSchools();
    } catch (err) {
      setProvisionError(err instanceof Error ? err.message : 'Provisioning failed.');
    } finally {
      setProvisioning(false);
    }
  }, [loadSchools, provisionForm]);

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
      window.open(data.handoff_url, '_blank', 'noopener,noreferrer');
    } finally {
      setImpersonatingId(null);
    }
  }, []);

  const handleConfirmAction = useCallback(async () => {
    if (!confirmDialog) return;
    setConfirmBusy(true);
    const { type, school } = confirmDialog;
    try {
      if (type === 'suspend') {
        await updateSchool(school.tenant_id, { status: 'suspended' });
        toast.success(`${school.name} suspended.`);
      } else {
        await deleteSchool(school.tenant_id);
        toast.success(`${school.name} archived.`);
      }
      setConfirmDialog(null);
      await loadSchools();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `${type === 'suspend' ? 'Suspend' : 'Archive'} failed.`);
    } finally {
      setConfirmBusy(false);
    }
  }, [confirmDialog, loadSchools]);

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
    <div className="rounded-[18px] border border-[var(--bd)] bg-[var(--bg-1)] p-[28px_30px]">

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
          <button type="button" className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[var(--bd-2)] bg-[var(--bg-1)] px-3.5 text-[12.5px] font-[550] text-[var(--ink-1)] transition hover:bg-[var(--bg-2)] active:scale-[0.97]">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <button
            type="button"
            onClick={() => {
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
        <KpiCard label="Total Schools" value={response.count || rows.length}
          trend="+3 QoQ" footnote="Telangana &amp; Andhra Pradesh" sparkColor="#5836E0" />
        <KpiCard label="Active Tenants" value={activeCount}
          trend="Healthy" footnote={`${totalStudents.toLocaleString('en-IN')} students`}
          sparkColor="#0E9F6E" pulse />
        <KpiCard label="On Trial" value={trialCount}
          trend="Avg conv 68%" footnote="Trial-to-paid conversion" sparkColor="#A65D08" />
        <KpiCard label="Needs Attention" value={attnCount}
          trend={attnCount > 0 ? `${attnCount} suspended` : 'All clear'}
          trendDown={attnCount > 0}
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
        <Accordion num="01" featured open={accAddOpen} onToggle={() => setAccAddOpen(v => !v)}
          icon={<Plus size={16} />}
          title="Add a new school"
          subtitle="Provisions a new isolated tenant \u00b7 9 sections \u00b7 Identity, branding, contacts, GST, plan, modules & data residency"
          meta={<Chip label="Auto-generates tenant ID" variant="indigo" />}
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
              <Fld label="School name" required span="2">
                <input className={inputCls} placeholder="e.g. Vasavi Vidyalaya Public School"
                  value={provisionForm.name} onChange={e => setProvisionForm(f => ({ ...f, name: e.target.value }))} />
              </Fld>
              <Fld label="Short code" required hint="Uppercase">
                <input className={`${monoInputCls} uppercase`} placeholder="VVP-HYD" maxLength={10} />
              </Fld>
              <Fld label="Subdomain URL" required hint="Lowercase \u00b7 no spaces" span="2">
                <div className="flex overflow-hidden rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] transition focus-within:border-[var(--pu)] focus-within:shadow-[0_0_0_3px_rgba(109,74,255,.12)]">
                  <span className="flex items-center border-r border-[var(--bd-2)] bg-[var(--bg-2)] px-[11px] font-mono text-[12px] text-[var(--ink-3)]">https://</span>
                  <input className="h-9 flex-1 border-none bg-transparent px-3 text-[13px] outline-none"
                    placeholder="vasavi-hyd"
                    value={provisionForm.subdomain_url}
                    onChange={e => setProvisionForm(f => ({ ...f, subdomain_url: e.target.value }))} />
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
                <input type="number" className={inputCls} placeholder="1998" />
              </Fld>
              <Fld label="Medium of instruction">
                <select className={selectCls} title="Medium of instruction">
                  <option>English</option><option>English &amp; Hindi</option>
                  <option>English &amp; Telugu</option><option>Telugu</option>
                </select>
              </Fld>
              <Fld label="Academic year start">
                <select className={selectCls} title="Academic year start">
                  <option>June 2025 \u2013 May 2026</option><option>April 2025 \u2013 March 2026</option>
                </select>
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
                  <option value="CBSE">CBSE \u2014 Central Board (Delhi)</option>
                  <option value="ICSE">ICSE \u2014 CISCE</option>
                  <option value="SSC_TG">SSC TG \u2014 Telangana State Board</option>
                  <option value="SSC_AP">SSC AP \u2014 Andhra Pradesh Board</option>
                  <option value="OTHER">IB / Cambridge / Other</option>
                </select>
              </Fld>
              <Fld label="Affiliation number" required>
                <input className={monoInputCls} placeholder="CBSE/AFF/930451" />
              </Fld>
              <Fld label="UDISE+ code" required hint="11 digits">
                <input className={monoInputCls} placeholder="36050200101" maxLength={11} />
              </Fld>
              <Fld label="State" required>
                <select className={selectCls} title="State" value={provisionForm.state}
                  onChange={e => setProvisionForm(f => ({ ...f, state: e.target.value }))}>
                  <option value="">Select state\u2026</option>
                  {[['36','Telangana'],['37','Andhra Pradesh'],['29','Karnataka'],['33','Tamil Nadu'],['27','Maharashtra'],['07','Delhi']].map(([code, name]) => (
                    <option key={code} value={code}>{name} ({code})</option>
                  ))}
                </select>
              </Fld>
              <Fld label="Affiliation valid till">
                <input type="date" className={inputCls} defaultValue="2030-03-31" title="Affiliation valid till" />
              </Fld>
            </div>
          </div>

          {/* 03 Branding */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="03">Branding</SectionHead>
            <div className="grid grid-cols-2 gap-3.5">
              <Fld label="School logo">
                <div className="flex items-center gap-3 rounded-[9px] border border-dashed border-[var(--bd-3)] bg-[var(--bg-2)] p-[10px_12px]">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[9px] bg-gradient-to-br from-[#7C5BFF] to-[#5836E0] text-[13px] font-semibold text-white">VV</span>
                  <span className="text-[11.5px] leading-[1.45] text-[var(--ink-2)]">
                    <b className="mb-0.5 block text-[12.5px] font-semibold text-[var(--ink-1)]">Drop a PNG or SVG here</b>
                    or <span className="cursor-pointer font-semibold text-[var(--pu-deep)]">browse files</span> \u00b7 1:1 ratio \u00b7 max 1 MB
                  </span>
                </div>
              </Fld>
              <Fld label="Primary brand color">
                <div className="flex h-[38px] items-center gap-1.5">
                  {PALETTE_COLORS.map(c => (
                    <button key={c.hex} type="button" onClick={() => setSelectedColor(c.hex)} title={c.hex}
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
              <Fld label="Principal name" required><input className={inputCls} placeholder="Dr. M. Iyer" /></Fld>
              <Fld label="Designation"><input className={inputCls} defaultValue="Principal" title="Designation" /></Fld>
              <Fld label="Email" required><input type="email" className={inputCls} placeholder="principal@school.edu.in" /></Fld>
              <Fld label="Mobile" required>
                <div className="flex overflow-hidden rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] transition focus-within:border-[var(--pu)] focus-within:shadow-[0_0_0_3px_rgba(109,74,255,.12)]">
                  <span className="flex items-center border-r border-[var(--bd-2)] bg-[var(--bg-2)] px-[11px] font-mono text-[12px] text-[var(--ink-3)]">+91</span>
                  <input type="tel" className="h-9 flex-1 border-none bg-transparent px-3 text-[13px] outline-none" placeholder="98765 43210" maxLength={11} />
                </div>
              </Fld>
              <Fld label="Alternate contact"><input type="tel" className={inputCls} placeholder="+91 98765 43211" /></Fld>
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
              <Fld label="Street address" required span="3">
                <textarea className="min-h-[72px] w-full resize-y rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 py-[10px] text-[13px] leading-relaxed outline-none transition focus:border-[var(--pu)] focus:shadow-[0_0_0_3px_rgba(109,74,255,.12)]"
                  placeholder="Plot 22, Road No. 12, Banjara Hills" />
              </Fld>
              <Fld label="City" required><input className={inputCls} placeholder="Hyderabad" /></Fld>
              <Fld label="State" required>
                <select className={selectCls} title="State">
                  {[['36','Telangana'],['37','Andhra Pradesh'],['29','Karnataka'],['33','Tamil Nadu'],['27','Maharashtra'],['07','Delhi']].map(([code, name]) => (
                    <option key={code}>{name} ({code})</option>
                  ))}
                </select>
              </Fld>
              <Fld label="PIN code" required><input className={monoInputCls} placeholder="500034" maxLength={6} /></Fld>
            </div>
          </div>

          {/* 06 GST & legal */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="06">GST &amp; legal</SectionHead>
            <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2">
              <Fld label="GST registration">
                <select className={selectCls} title="GST registration"><option value="yes">GST-registered</option><option value="no">Unregistered (exempt)</option></select>
              </Fld>
              <Fld label="GSTIN" hint="15 chars">
                <input className={`${monoInputCls} uppercase`} placeholder="36AAACE9988K1ZP" maxLength={15} />
              </Fld>
              <Fld label="PAN" required>
                <input className={`${monoInputCls} uppercase`} placeholder="AAACE9988K" maxLength={10} />
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
                  <option value="trial">Starter \u2014 \u20b94,500/mo</option>
                  <option value="standard">Standard \u2014 \u20b99,000/mo</option>
                  <option value="premium">Premium \u2014 \u20b919,500/mo</option>
                  <option value="enterprise">Enterprise \u2014 \u20b934,500/mo</option>
                </select>
              </Fld>
              <Fld label="Trial period">
                <select className={selectCls} title="Trial period"><option>30 days</option><option>14 days</option><option>No trial</option></select>
              </Fld>
              <Fld label="Go-live date">
                <input type="date" className={inputCls} defaultValue="2026-06-01" title="Go-live date" />
              </Fld>
              <Fld label="Student seat limit"><input type="number" className={inputCls} defaultValue={2000} title="Student seat limit" /></Fld>
              <Fld label="Staff seat limit"><input type="number" className={inputCls} defaultValue={200} title="Staff seat limit" /></Fld>
              <Fld label="Storage cap" hint="GB"><input type="number" className={inputCls} defaultValue={50} title="Storage cap" /></Fld>
              <Fld label="Billing cycle">
                <select className={selectCls} title="Billing cycle"><option>Annual \u00b7 pay upfront</option><option>Half-yearly</option><option>Quarterly</option><option>Monthly</option></select>
              </Fld>
            </div>
          </div>

          {/* 08 Modules */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
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

          {/* 09 Data residency */}
          <div className="py-5">
            <SectionHead num="09">
              Data residency &amp; provisioning
              <span className="ml-auto text-[10.5px] font-[400] normal-case tracking-normal text-[var(--ink-4)]">Auto-filled \u00b7 super-admin can override</span>
            </SectionHead>
            <div className="grid grid-cols-3 gap-3.5 max-md:grid-cols-2">
              <Fld label="Tenant ID" hint="Auto \u00b7 immutable">
                <input className={lockedInputCls} value="TNT_TG010K" readOnly title="Tenant ID" />
              </Fld>
              <Fld label="DB shard region">
                <select className={selectCls} title="DB shard region" value={provisionForm.shard_region ?? ''}
                  onChange={e => setProvisionForm(f => ({ ...f, shard_region: e.target.value }))}>
                  <option value="ap-south-1">ap-south-1 \u00b7 Mumbai</option>
                  <option value="ap-south-2">ap-south-2 \u00b7 Hyderabad</option>
                </select>
              </Fld>
              <Fld label="Storage bucket">
                <input className={lockedInputCls} value="eskoolia-tnt_tg010k" readOnly title="Storage bucket" />
              </Fld>
              <Fld label="Backup retention">
                <select className={selectCls} title="Backup retention"><option>30 days \u00b7 daily snapshots</option><option>90 days</option><option>1 year</option></select>
              </Fld>
              <Fld label="SSO method">
                <select className={selectCls} title="SSO method"><option>Email + password</option><option>Google Workspace</option><option>Microsoft 365</option><option>SAML 2.0</option></select>
              </Fld>
              <Fld label="API access">
                <select className={selectCls} title="API access"><option>Disabled (default)</option><option>Read-only key</option><option>Read + write key</option></select>
              </Fld>
            </div>
          </div>

          {/* 10 Admin credentials */}
          <div className="border-b border-dashed border-[var(--bd-2)] py-5">
            <SectionHead num="10">
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

          {/* Footer */}
          <div className="mt-2 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--bd)] pt-[18px]">
            <span className="flex items-center gap-1.5 text-[11.5px] text-[var(--ink-2)]">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              Tenant ID &amp; subdomain are immutable once provisioned. A welcome email is sent to the principal automatically.
            </span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setAccAddOpen(false)}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border-0 bg-transparent px-3.5 text-[12.5px] font-[550] text-[var(--ink-1)] hover:bg-[var(--bg-2)]">
                Cancel
              </button>
              <button type="button"
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] border border-[var(--bd-2)] bg-[var(--bg-1)] px-3.5 text-[12.5px] font-[550] text-[var(--ink-1)] hover:bg-[var(--bg-2)]">
                Save as draft
              </button>
              <button type="button" disabled={provisioning} onClick={() => void handleProvisionSubmit()}
                className="inline-flex h-9 items-center gap-1.5 rounded-[9px] bg-[var(--pu)] px-3.5 text-[12.5px] font-[550] text-white shadow-[0_1px_2px_rgba(79,53,204,.25),inset_0_1px_0_rgba(255,255,255,.16)] transition hover:bg-[var(--pu-deep)] disabled:opacity-60">
                <Check className="h-3.5 w-3.5" />
                {provisioning ? 'Provisioning\u2026' : 'Provision school'}
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
        meta={<Chip label="3 active" variant="indigo" />}
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
            {(['Plan','Board','State','Region'] as const).map(lbl => (
              <div key={lbl}>
                <label className="mb-1.5 block text-[11.5px] font-[550] text-[var(--ink-2)]">{lbl}</label>
                <select className={selectCls} title={lbl}>
                  <option>All {lbl.toLowerCase()}s</option>
                  {lbl === 'Plan' && <><option>Starter</option><option>Standard</option><option>Premium</option><option>Enterprise</option></>}
                  {lbl === 'Board' && <><option>CBSE</option><option>ICSE</option><option>SSC TG</option><option>SSC AP</option></>}
                  {lbl === 'State' && <><option>Telangana (36)</option><option>Andhra Pradesh (37)</option></>}
                  {lbl === 'Region' && <><option>ap-south-1 Mumbai</option><option>ap-south-2 Hyderabad</option></>}
                </select>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-2)]">Status</div>
              <div className="flex flex-wrap gap-1.5">
                {([
                  { value: 'all' as const,      label: 'All',       count: rows.length },
                  { value: 'active' as const,    label: 'Active',    count: activeCount },
                  { value: 'trial' as const,     label: 'Trial',     count: trialCount },
                  { value: 'suspended' as const, label: 'Suspended', count: attnCount },
                  { value: 'archived' as const,  label: 'Archived',  count: 0 },
                ] as const).map(o => (
                  <FilterPill key={o.value} label={o.label} count={o.count}
                    active={statusFilter === o.value} onClick={() => setStatusFilter(o.value)} />
                ))}
              </div>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.04em] text-[var(--ink-2)]">Health flags</div>
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Billing overdue', count: 1 },
                  { label: 'Storage 80%+',    count: 2 },
                  { label: 'Trial ending <7d',count: 1 },
                  { label: 'GSTIN missing',   count: 2 },
                ].map(o => (
                  <FilterPill key={o.label} label={o.label} count={o.count} active={false} onClick={() => {}} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-[18px] flex flex-wrap items-center justify-between gap-2.5 border-t border-dashed border-[var(--bd-2)] pt-[14px]">
            <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-[var(--ink-3)]">Saved presets</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {['All active Telangana','Trial \u2192 conversion review','GSTIN missing'].map(p => (
                <FilterPill key={p} label={p} active={false} onClick={() => {}} />
              ))}
              <button type="button" className="inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full border border-dashed border-[var(--bd)] bg-transparent px-3 text-[12px] text-[var(--pu-deep)] hover:bg-[var(--pu-soft)]">
                + Save current
              </button>
              <button type="button" className="inline-flex h-[30px] cursor-pointer items-center gap-1.5 rounded-full bg-[var(--pu)] px-3 text-[12px] font-[550] text-white hover:bg-[var(--pu-deep)]">
                Apply
              </button>
            </div>
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
            <Chip label={`${totalStaff.toLocaleString('en-IN')} staff`} variant="info" />
          </>
        }
      >
        <div className="pt-4">
          <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-[12.5px] text-[var(--ink-2)]">
              Active filter: <strong className="font-[550] text-[var(--pu-deep)]">
                {statusFilter === 'all' ? 'All \u00b7 Active' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
              </strong>
            </p>
            <div className="flex gap-1.5">
              <button type="button" className="inline-flex h-[30px] items-center gap-1.5 rounded-[7px] border border-[var(--bd-2)] bg-[var(--bg-1)] px-[11px] text-[12px] font-[550] text-[var(--ink-1)] hover:bg-[var(--bg-2)]">
                <Download size={12} /> Export
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
                    {['School','Tenant \u00b7 State','Board','GSTIN','Plan \u00b7 Students','Status','Actions'].map((h, i) => (
                      <th key={h}
                        className={`border-y border-[var(--bd)] bg-[var(--bg-2)] px-3.5 py-[9px] text-[10.5px] font-semibold uppercase tracking-[0.07em] text-[var(--ink-3)] first:rounded-l-lg first:border-l first:pl-[18px] last:rounded-r-lg last:border-r last:pr-[18px] whitespace-nowrap ${i === 0 ? 'w-[24%]' : ''} ${i === 6 ? 'text-right' : 'text-left'}`}
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
                        <td className="border-b border-[var(--bd)] py-3.5 pl-3.5 pr-[18px] text-right align-middle">
                          <span className="inline-flex gap-0.5 opacity-55 transition-opacity group-hover:opacity-100">
                            {[
                              { title: 'Open',        icon: <ExternalLink size={13} />, action: () => window.open(`https://${school.subdomain_url}.eskoolia.com`, '_blank', 'noopener') },
                              { title: 'Edit',        icon: <Edit2 size={13} />,        action: () => {} },
                              { title: 'Impersonate', icon: <Users size={13} />,        action: () => void handleImpersonate(school), loading: impersonatingId === school.tenant_id },
                              { title: 'Suspend',     icon: <Pause size={13} />,        action: () => setConfirmDialog({ type: 'suspend', school }) },
                              { title: 'Archive',     icon: <Archive size={13} />,      action: () => setConfirmDialog({ type: 'archive', school }) },
                            ].map(btn => (
                              <button key={btn.title} type="button" title={btn.title}
                                disabled={'loading' in btn && btn.loading}
                                onClick={e => { e.stopPropagation(); btn.action(); }}
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
