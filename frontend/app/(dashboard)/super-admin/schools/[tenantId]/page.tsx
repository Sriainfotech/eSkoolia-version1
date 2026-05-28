'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { ArrowLeft, Copy, Edit2, Eye, EyeOff, KeyRound, Pause, RotateCcw, ExternalLink } from 'lucide-react';
import { getSchool, resetSchoolAdminPassword, updateSchool } from '@/lib/api/super-admin/schools';
import type { ResetAdminPasswordResponse } from '@/lib/api/super-admin/schools';
import type { SchoolTenant } from '@/types/super-admin';

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
function avatarGradient(id: string) {
  return AVATAR_GRADIENT_CLS[id.charCodeAt(id.length - 1) % AVATAR_GRADIENT_CLS.length] ?? AVATAR_GRADIENT_CLS[0]!;
}
function schoolInitials(name: string) {
  return name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

function StatusBadge({ status }: { status: string }) {
  const cfg: Record<string, { dot: string; text: string; bg: string }> = {
    active:     { dot: '#0d7a55', text: '#0d7a55', bg: '#dcfce7' },
    trial:      { dot: '#b45309', text: '#b45309', bg: '#fef3c7' },
    suspended:  { dot: '#dc2626', text: '#dc2626', bg: '#fee2e2' },
    onboarding: { dot: '#0369a1', text: '#0369a1', bg: '#dbeafe' },
    archived:   { dot: '#6b7280', text: '#6b7280', bg: '#f3f4f6' },
  };
  const c = cfg[status] ?? { dot: '#6b7280', text: '#6b7280', bg: '#f3f4f6' };
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12px] font-[600]"
      style={{ background: c.bg, color: c.text, borderColor: c.dot + '33' }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: c.dot }} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | number | boolean | null }) {
  const display =
    value === null || value === undefined || value === '' ? (
      <span className="text-[var(--ink-4)]">&mdash;</span>
    ) : typeof value === 'boolean' ? (
      <span className={value ? 'font-[550] text-[#0d7a55]' : 'text-[var(--ink-3)]'}>
        {value ? 'Enabled' : 'Disabled'}
      </span>
    ) : (
      <span className="text-[var(--ink-1)]">{String(value)}</span>
    );
  return (
    <div className="flex min-h-[36px] items-start gap-3 border-b border-[var(--bd)] py-2.5 last:border-0">
      <span className="w-[160px] flex-shrink-0 text-[11.5px] font-[550] text-[var(--ink-3)]">{label}</span>
      <span className="flex-1 text-[13px]">{display}</span>
    </div>
  );
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="sa-panel divide-y divide-[var(--bd)] overflow-hidden">
      <div className="bg-[var(--bg-2)] px-5 py-3">
        <h2 className="text-[11.5px] font-[650] uppercase tracking-[0.08em] text-[var(--ink-3)]">{title}</h2>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  );
}

const BOARD_LABELS: Record<string, string> = {
  CBSE: 'CBSE', ICSE: 'ICSE', SSC_TG: 'SSC TG', SSC_AP: 'SSC AP', OTHER: 'Other',
};
const REGION_LABELS: Record<string, string> = {
  'ap-south-1':     'Asia Pacific — Mumbai',
  'ap-southeast-1': 'Asia Pacific — Singapore',
  'us-east-1':      'US East — N. Virginia',
  'eu-west-1':      'Europe — Ireland',
};
const STATE_LABELS: Record<string, string> = {
  '36': 'Telangana', '37': 'Andhra Pradesh', '29': 'Karnataka', '33': 'Tamil Nadu',
  '27': 'Maharashtra', '07': 'Delhi', '09': 'Uttar Pradesh', '06': 'Haryana',
  '08': 'Rajasthan', '19': 'West Bengal', '21': 'Odisha', '32': 'Kerala', '24': 'Gujarat',
};

export default function SchoolViewPage({ params }: { params: { tenantId: string } }) {
  const { tenantId } = params;
  const router = useRouter();

  const [school,       setSchool]       = useState<SchoolTenant | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [actioning,    setActioning]    = useState(false);
  const [resetting,    setResetting]    = useState(false);
  const [resetResult,  setResetResult]  = useState<ResetAdminPasswordResponse | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied,       setCopied]       = useState<'user' | 'pass' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSchool(await getSchool(tenantId));
    } catch {
      toast.error('Could not load school data.');
      router.replace('/super-admin/schools');
    } finally {
      setLoading(false);
    }
  }, [tenantId, router]);

  useEffect(() => { void load(); }, [load]);

  const handleResetPassword = async () => {
    if (!school) return;
    setResetting(true);
    try {
      const result = await resetSchoolAdminPassword(tenantId);
      setResetResult(result);
      setShowPassword(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Password reset failed.');
    } finally {
      setResetting(false);
    }
  };

  const copyToClipboard = async (text: string, field: 'user' | 'pass') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(field);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      toast.error('Could not copy to clipboard.');
    }
  };

  const handleStatusChange = async (newStatus: 'active' | 'suspended') => {
    if (!school) return;
    setActioning(true);
    try {
      const updated = await updateSchool(tenantId, { status: newStatus });
      setSchool(updated);
      toast.success(
        newStatus === 'active'
          ? `${school.name} reactivated.`
          : `${school.name} suspended.`
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setActioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-[var(--ink-3)]">Loading school…</p>
      </div>
    );
  }
  if (!school) return null;

  const initials    = schoolInitials(school.name);
  const gradCls     = avatarGradient(school.tenant_id);
  const isSuspended = school.status === 'suspended';
  const isArchived  = school.status === 'archived';

  return (
    <>
    <div className="mx-auto max-w-3xl space-y-5 p-6">

      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-1.5 text-xs font-[550] text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
      >
        <ArrowLeft size={13} /> Back to Schools
      </button>

      <div className="sa-panel p-5">
        <div className="flex flex-wrap items-start gap-4">
          <span
            className={`flex h-[56px] w-[56px] flex-shrink-0 items-center justify-center rounded-[14px] text-[20px] font-[700] text-white shadow-[inset_0_1px_0_rgba(255,255,255,.15)] ${gradCls}`}
          >
            {initials}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-[20px] font-[750] tracking-[-0.3px] text-[var(--ink-1)]">
                {school.name}
              </h1>
              <StatusBadge status={school.status} />
            </div>
            <p className="mt-1 font-mono text-[12px] text-[var(--ink-3)]">
              {school.tenant_id}
              {school.subdomain_url && (
                <>
                  {' · '}
                  <a
                    href={`https://${school.subdomain_url}.eskoolia.com`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-[var(--pu)] transition-colors"
                  >
                    {school.subdomain_url}.eskoolia.com <ExternalLink size={10} />
                  </a>
                </>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isSuspended && (
              <button
                onClick={() => void handleStatusChange('active')}
                disabled={actioning}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#059669] px-3.5 py-2 text-[13px] font-[600] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
              >
                <RotateCcw size={13} /> Reactivate
              </button>
            )}
            {!isSuspended && !isArchived && (
              <button
                onClick={() => void handleStatusChange('suspended')}
                disabled={actioning}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--bd)] px-3.5 py-2 text-[13px] font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
              >
                <Pause size={13} /> Suspend
              </button>
            )}
            {!isArchived && (
              <button
                onClick={() => void handleResetPassword()}
                disabled={resetting || actioning}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--bd)] px-3.5 py-2 text-[13px] font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
              >
                <KeyRound size={13} />
                {resetting ? 'Resetting…' : 'Reset Admin Password'}
              </button>
            )}
            {!isArchived && (
              <Link
                href={`/super-admin/schools/${tenantId}/edit`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pu)] px-3.5 py-2 text-[13px] font-[600] text-white hover:opacity-90 transition-opacity"
              >
                <Edit2 size={13} /> Edit School
              </Link>
            )}
          </div>
        </div>
      </div>

      <SectionCard title="Identity &amp; Plan">
        <InfoRow label="School name"   value={school.name} />
        <InfoRow label="Short code"    value={school.short_code} />
        <InfoRow
          label="Subdomain URL"
          value={school.subdomain_url ? `${school.subdomain_url}.eskoolia.com` : null}
        />
        <InfoRow
          label="Plan"
          value={school.plan ? school.plan.charAt(0).toUpperCase() + school.plan.slice(1) : null}
        />
        <InfoRow
          label="Status"
          value={school.status ? school.status.charAt(0).toUpperCase() + school.status.slice(1) : null}
        />
        <InfoRow label="Seats"      value={school.seats ?? null} />
        <InfoRow label="API access" value={school.api_access} />
        <InfoRow label="SSO method" value={school.sso_method} />
      </SectionCard>

      <SectionCard title="Academic &amp; Geography">
        <InfoRow label="Board" value={BOARD_LABELS[school.board ?? ''] ?? school.board} />
        <InfoRow label="State" value={STATE_LABELS[school.state ?? ''] ?? school.state} />
        <InfoRow
          label="Region"
          value={
            school.region
              ? (school.region as string).charAt(0).toUpperCase() + (school.region as string).slice(1)
              : null
          }
        />
        <InfoRow
          label="UDISE code"
          value={(school.udiseCode ?? school.udise_code) as string | null}
        />
      </SectionCard>

      <SectionCard title="GST &amp; Legal">
        <InfoRow label="GSTIN" value={school.gstin} />
        <InfoRow label="PAN"   value={school.pan} />
      </SectionCard>

      <SectionCard title="Infrastructure">
        <InfoRow
          label="Shard region"
          value={REGION_LABELS[school.shard_region ?? ''] ?? school.shard_region}
        />
        <InfoRow
          label="Storage region"
          value={REGION_LABELS[school.storage_region ?? ''] ?? school.storage_region}
        />
        <InfoRow
          label="Backup retention"
          value={school.backup_retention != null ? `${school.backup_retention} days` : null}
        />
        <InfoRow
          label="Provisioned at"
          value={
            school.provisioned_at
              ? new Date(school.provisioned_at).toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : null
          }
        />
      </SectionCard>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={() => router.back()}
          className="text-[12px] font-[550] text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
        >
          ← Back to Schools
        </button>
        {!isArchived && (
          <Link
            href={`/super-admin/schools/${tenantId}/edit`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--pu)] px-4 py-2 text-[13px] font-[600] text-white hover:opacity-90 transition-opacity"
          >
            <Edit2 size={13} /> Edit School
          </Link>
        )}
      </div>

    </div>

    {/* ── One-time credential reveal modal ─────────────────────────────── */}
    {resetResult && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
        onClick={() => setResetResult(null)}
      >
        <div
          className="w-full max-w-md rounded-2xl bg-[var(--bg-1)] shadow-2xl border border-[var(--bd)] p-6 space-y-4"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start gap-3">
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-amber-100">
              <KeyRound size={17} className="text-amber-600" />
            </span>
            <div>
              <h2 className="text-[15px] font-[700] text-[var(--ink-1)]">New Admin Credentials</h2>
              <p className="text-[12px] text-[var(--ink-3)]">{school?.name}</p>
            </div>
          </div>

          {/* Warning banner */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] text-amber-800">
            <span className="font-[650]">Shown once only.</span> Copy these credentials now — they will not be shown again after you close this dialog.
          </div>

          {/* Username */}
          <div className="space-y-1">
            <label className="text-[11px] font-[650] uppercase tracking-wider text-[var(--ink-3)]">Username</label>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2.5">
              <span className="flex-1 font-mono text-[13px] text-[var(--ink-1)] select-all">{resetResult.admin_username}</span>
              <button
                onClick={() => void copyToClipboard(resetResult.admin_username, 'user')}
                className="flex-shrink-0 rounded-lg p-1 text-[var(--ink-3)] hover:bg-[var(--bg-3)] hover:text-[var(--ink-1)] transition-colors"
                title="Copy username"
              >
                <Copy size={13} />
              </button>
            </div>
            {copied === 'user' && <p className="text-[11px] text-[#0d7a55]">Copied!</p>}
          </div>

          {/* Password */}
          <div className="space-y-1">
            <label className="text-[11px] font-[650] uppercase tracking-wider text-[var(--ink-3)]">Password</label>
            <div className="flex items-center gap-2 rounded-xl border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2.5">
              <span className="flex-1 font-mono text-[13px] text-[var(--ink-1)] select-all">
                {showPassword ? resetResult.admin_password : '•'.repeat(resetResult.admin_password.length)}
              </span>
              <button
                onClick={() => setShowPassword(v => !v)}
                className="flex-shrink-0 rounded-lg p-1 text-[var(--ink-3)] hover:bg-[var(--bg-3)] hover:text-[var(--ink-1)] transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
              <button
                onClick={() => void copyToClipboard(resetResult.admin_password, 'pass')}
                className="flex-shrink-0 rounded-lg p-1 text-[var(--ink-3)] hover:bg-[var(--bg-3)] hover:text-[var(--ink-1)] transition-colors"
                title="Copy password"
              >
                <Copy size={13} />
              </button>
            </div>
            {copied === 'pass' && <p className="text-[11px] text-[#0d7a55]">Copied!</p>}
          </div>

          {/* Close */}
          <button
            onClick={() => setResetResult(null)}
            className="w-full rounded-xl bg-[var(--pu)] py-2.5 text-[13px] font-[600] text-white hover:opacity-90 transition-opacity"
          >
            I&apos;ve saved these credentials — Close
          </button>
        </div>
      </div>
    )}
    </>
  );
}
