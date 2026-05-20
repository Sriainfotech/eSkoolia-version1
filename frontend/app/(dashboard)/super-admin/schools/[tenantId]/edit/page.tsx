'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-toastify';
import { ArrowLeft, Save } from 'lucide-react';
import { getSchool, updateSchool } from '@/lib/api/super-admin/schools';
import type { SchoolTenant } from '@/types/super-admin';

// ── Style helpers ─────────────────────────────────────────────────────────────
const inputCls =
  'h-9 w-full rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 text-[13px] text-[var(--ink-1)] outline-none transition ' +
  'focus:border-[var(--pu)] focus:shadow-[0_0_0_3px_rgba(109,74,255,.12)] placeholder:text-[var(--ink-4)]';
const selectCls =
  'h-9 w-full rounded-lg border border-[var(--bd-2)] bg-[var(--bg-1)] px-3 text-[13px] text-[var(--ink-1)] outline-none transition ' +
  'focus:border-[var(--pu)] focus:shadow-[0_0_0_3px_rgba(109,74,255,.12)]';
const monoInputCls = inputCls + ' font-mono uppercase tracking-wider';
const labelCls = 'mb-1 block text-[11.5px] font-[550] text-[var(--ink-2)]';

function SectionHead({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[var(--pu-tint)] text-[11px] font-[700] text-[var(--pu-deep)]">
        {num}
      </span>
      <h3 className="text-[13px] font-[650] text-[var(--ink-1)]">{children}</h3>
    </div>
  );
}

function Field({ label, required, span, children }: {
  label: string; required?: boolean; span?: string; children: React.ReactNode;
}) {
  return (
    <div className={span ? `col-span-${span}` : ''}>
      <label className={labelCls}>
        {label}{required && <span className="ml-0.5 text-[var(--danger)]">*</span>}
      </label>
      {children}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function EditSchoolPage({ params }: { params: { tenantId: string } }) {
  const { tenantId } = params;
  const router = useRouter();

  const [loading, setLoading]   = useState(true);
  const [saving,  setSaving]    = useState(false);
  const [school,  setSchool]    = useState<SchoolTenant | null>(null);

  // Flat form state — mirrors SchoolTenantUpdateSerializer fields
  const [form, setForm] = useState({
    name:              '',
    short_code:        '',
    subdomain_url:     '',
    plan:              'trial',
    status:            'active',
    api_access:        true,
    board:             'OTHER',
    state:             '',
    region:            '',
    gstin:             '',
    pan:               '',
    udise_code:        '',
    seats:             '',
    shard_region:      '',
    storage_region:    '',
    backup_retention:  '30',
    sso_method:        'native',
  });

  const set = (k: keyof typeof form, v: string | boolean) =>
    setForm(f => ({ ...f, [k]: v }));

  // Load school data on mount
  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getSchool(tenantId);
      setSchool(data);
      setForm({
        name:             data.name             ?? '',
        short_code:       data.short_code       ?? '',
        subdomain_url:    data.subdomain_url     ?? '',
        plan:             data.plan             ?? 'trial',
        status:           data.status           ?? 'active',
        api_access:       data.api_access       ?? true,
        board:            data.board            ?? 'OTHER',
        state:            data.state            ?? '',
        region:           (data.region as string) ?? '',
        gstin:            data.gstin            ?? '',
        pan:              data.pan              ?? '',
        udise_code:       (data.udiseCode as string) ?? '',
        seats:            data.seats != null ? String(data.seats) : '',
        shard_region:     data.shard_region     ?? '',
        storage_region:   data.storage_region   ?? '',
        backup_retention: data.backup_retention != null ? String(data.backup_retention) : '30',
        sso_method:       data.sso_method       ?? 'native',
      });
    } catch {
      toast.error('Could not load school data.');
      router.replace('/super-admin/schools');
    } finally {
      setLoading(false);
    }
  }, [tenantId, router]);

  useEffect(() => { void load(); }, [load]);

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('School name is required.'); return; }
    setSaving(true);
    try {
      await updateSchool(tenantId, {
        name:             form.name.trim()            || undefined,
        short_code:       form.short_code.trim()      || undefined,
        subdomain_url:    form.subdomain_url.trim()   || undefined,
        plan:             form.plan   as SchoolTenant['plan'],
        status:           form.status as SchoolTenant['status'],
        api_access:       form.api_access,
        board:            form.board  as SchoolTenant['board'],
        state:            form.state            || undefined,
        region:           (form.region          || undefined) as SchoolTenant['region'],
        gstin:            form.gstin.toUpperCase() || undefined,
        pan:              form.pan.toUpperCase()   || undefined,
        udiseCode:        form.udise_code        || undefined,
        seats:            form.seats ? Number(form.seats) : undefined,
        shard_region:     form.shard_region     || undefined,
        storage_region:   form.storage_region   || undefined,
        backup_retention: form.backup_retention ? Number(form.backup_retention) : undefined,
        sso_method:       form.sso_method       || undefined,
      });
      toast.success(`${form.name} updated successfully.`);
      router.push('/super-admin/schools');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Update failed.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-[var(--ink-3)]">Loading school data…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">

      {/* ── Header ────────────────────────────────────────────────────── */}
      <div>
        <button
          onClick={() => router.back()}
          className="mb-3 inline-flex items-center gap-1.5 text-xs font-[550] text-[var(--ink-3)] hover:text-[var(--ink-1)] transition-colors"
        >
          <ArrowLeft size={13} /> Back to Schools
        </button>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-[550] uppercase tracking-widest text-[var(--ink-3)]">
              <span className="font-serif italic font-light">School Tenancy</span> · Edit
            </p>
            <h1 className="mt-0.5 text-2xl font-bold text-[var(--ink-1)]">Edit School</h1>
            <p className="mt-1 font-mono text-[11.5px] text-[var(--ink-3)]">{tenantId}</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => router.back()}
              disabled={saving}
              className="rounded-xl border border-[var(--bd)] px-4 py-2 text-sm font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--pu)] px-4 py-2 text-sm font-[600] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Save size={14} />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>

      {/* ── 01 Basic identity ─────────────────────────────────────────── */}
      <div className="sa-panel p-5">
        <SectionHead num="01">Basic identity</SectionHead>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="School name" required span="2">
            <input className={inputCls} value={form.name}
              onChange={e => set('name', e.target.value)} placeholder="e.g. Delhi Public School" />
          </Field>
          <Field label="Short code">
            <input className={monoInputCls} value={form.short_code}
              onChange={e => set('short_code', e.target.value.toUpperCase())} placeholder="DPS" maxLength={10} />
          </Field>
          <Field label="Subdomain URL">
            <input className={inputCls} value={form.subdomain_url}
              onChange={e => set('subdomain_url', e.target.value.toLowerCase())} placeholder="dps-noida" />
          </Field>
        </div>
      </div>

      {/* ── 02 Plan & status ──────────────────────────────────────────── */}
      <div className="sa-panel p-5">
        <SectionHead num="02">Plan &amp; status</SectionHead>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Plan">
            <select className={selectCls} value={form.plan} onChange={e => set('plan', e.target.value)} title="Plan">
              <option value="trial">Trial</option>
              <option value="starter">Starter</option>
              <option value="standard">Standard</option>
              <option value="premium">Premium</option>
              <option value="enterprise">Enterprise</option>
              <option value="custom">Custom</option>
            </select>
          </Field>
          <Field label="Status">
            <select className={selectCls} value={form.status} onChange={e => set('status', e.target.value)} title="Status">
              <option value="pending">Pending</option>
              <option value="provisioning">Provisioning</option>
              <option value="onboarding">Onboarding</option>
              <option value="active">Active</option>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
              <option value="archived">Archived</option>
            </select>
          </Field>
          <Field label="Seats (licensed)">
            <input type="number" className={inputCls} value={form.seats}
              onChange={e => set('seats', e.target.value)} placeholder="500" min={0} />
          </Field>
          <Field label="API access">
            <select className={selectCls} value={form.api_access ? 'yes' : 'no'}
              onChange={e => set('api_access', e.target.value === 'yes')} title="API access">
              <option value="yes">Enabled</option>
              <option value="no">Disabled</option>
            </select>
          </Field>
        </div>
      </div>

      {/* ── 03 Academic & geography ───────────────────────────────────── */}
      <div className="sa-panel p-5">
        <SectionHead num="03">Academic &amp; geography</SectionHead>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Board">
            <select className={selectCls} value={form.board} onChange={e => set('board', e.target.value)} title="Board">
              <option value="CBSE">CBSE</option>
              <option value="ICSE">ICSE</option>
              <option value="SSC_TG">SSC TG</option>
              <option value="SSC_AP">SSC AP</option>
              <option value="OTHER">Other</option>
            </select>
          </Field>
          <Field label="State">
            <select className={selectCls} value={form.state} onChange={e => set('state', e.target.value)} title="State">
              <option value="">— Select —</option>
              <option value="36">Telangana (36)</option>
              <option value="37">Andhra Pradesh (37)</option>
              <option value="29">Karnataka (29)</option>
              <option value="33">Tamil Nadu (33)</option>
              <option value="27">Maharashtra (27)</option>
              <option value="07">Delhi (07)</option>
              <option value="09">Uttar Pradesh (09)</option>
              <option value="06">Haryana (06)</option>
              <option value="08">Rajasthan (08)</option>
              <option value="19">West Bengal (19)</option>
              <option value="21">Odisha (21)</option>
              <option value="32">Kerala (32)</option>
              <option value="24">Gujarat (24)</option>
            </select>
          </Field>
          <Field label="Region">
            <select className={selectCls} value={form.region} onChange={e => set('region', e.target.value)} title="Region">
              <option value="">— Select —</option>
              <option value="north">North</option>
              <option value="south">South</option>
              <option value="east">East</option>
              <option value="west">West</option>
              <option value="northeast">North East</option>
            </select>
          </Field>
          <Field label="UDISE Code">
            <input className={monoInputCls} value={form.udise_code}
              onChange={e => set('udise_code', e.target.value)} placeholder="36201012801" maxLength={11} />
          </Field>
        </div>
      </div>

      {/* ── 04 GST & legal ────────────────────────────────────────────── */}
      <div className="sa-panel p-5">
        <SectionHead num="04">GST &amp; legal</SectionHead>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="GSTIN">
            <input className={monoInputCls} value={form.gstin}
              onChange={e => set('gstin', e.target.value.toUpperCase())} placeholder="36AAACE9988K1ZP" maxLength={15} />
          </Field>
          <Field label="PAN">
            <input className={monoInputCls} value={form.pan}
              onChange={e => set('pan', e.target.value.toUpperCase())} placeholder="AAACE9988K" maxLength={10} />
          </Field>
        </div>
      </div>

      {/* ── 05 Technical / infrastructure ─────────────────────────────── */}
      <div className="sa-panel p-5">
        <SectionHead num="05">Technical &amp; infrastructure</SectionHead>
        <div className="grid grid-cols-2 gap-4 max-sm:grid-cols-1">
          <Field label="Shard region">
            <select className={selectCls} value={form.shard_region} onChange={e => set('shard_region', e.target.value)} title="Shard region">
              <option value="">— Select —</option>
              <option value="ap-south-1">Asia Pacific — Mumbai (ap-south-1)</option>
              <option value="ap-southeast-1">Asia Pacific — Singapore (ap-southeast-1)</option>
              <option value="us-east-1">US East — N. Virginia (us-east-1)</option>
              <option value="eu-west-1">Europe — Ireland (eu-west-1)</option>
            </select>
          </Field>
          <Field label="Storage region">
            <select className={selectCls} value={form.storage_region} onChange={e => set('storage_region', e.target.value)} title="Storage region">
              <option value="">— Select —</option>
              <option value="ap-south-1">Asia Pacific — Mumbai (ap-south-1)</option>
              <option value="ap-southeast-1">Asia Pacific — Singapore (ap-southeast-1)</option>
              <option value="us-east-1">US East — N. Virginia (us-east-1)</option>
              <option value="eu-west-1">Europe — Ireland (eu-west-1)</option>
            </select>
          </Field>
          <Field label="SSO method">
            <select className={selectCls} value={form.sso_method} onChange={e => set('sso_method', e.target.value)} title="SSO method">
              <option value="native">Native (username/password)</option>
              <option value="google">Google OAuth</option>
              <option value="microsoft">Microsoft OAuth</option>
              <option value="saml">SAML 2.0</option>
            </select>
          </Field>
          <Field label="Backup retention (days)">
            <input type="number" className={inputCls} value={form.backup_retention}
              onChange={e => set('backup_retention', e.target.value)} placeholder="30" min={1} max={365} />
          </Field>
        </div>
      </div>

      {/* ── Sticky footer ─────────────────────────────────────────────── */}
      <div className="sticky bottom-0 -mx-6 border-t border-[var(--bd)] bg-[var(--bg-1)] px-6 py-4">
        <div className="flex justify-end gap-3">
          <button
            onClick={() => router.back()}
            disabled={saving}
            className="rounded-xl border border-[var(--bd)] px-5 py-2 text-sm font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-[var(--pu)] px-5 py-2 text-sm font-[600] text-white hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>

    </div>
  );
}
