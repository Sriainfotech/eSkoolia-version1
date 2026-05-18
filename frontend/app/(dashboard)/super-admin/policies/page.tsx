'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  Check, ChevronDown, ChevronRight, Database, Download,
  Globe, Lock, RefreshCw, Settings, Shield, Zap,
} from 'lucide-react';
import {
  exportPolicies, downloadPoliciesConfig,
  getPolicies, getPolicySettings, updatePolicies,
} from '@/lib/api/super-admin/policies';
import type { GlobalPolicy, PolicyCategory, PolicyGroup, UpdatePoliciesRequest } from '@/types/super-admin';

// -- Category config -------------------------------------------------------
const CAT_CONFIG: Record<PolicyCategory, { label: string; desc: string; Icon: React.ElementType; iconBgCls: string; iconColorCls: string }> = {
  security:       { label: 'Security',       desc: 'Authentication, session & access controls',      Icon: Shield,   iconBgCls: 'bg-red-50',     iconColorCls: 'text-red-500'    },
  data_isolation: { label: 'Data Isolation', desc: 'Tenancy boundaries & audit retention',           Icon: Database, iconBgCls: 'bg-sky-50',     iconColorCls: 'text-sky-500'    },
  billing:        { label: 'Billing',        desc: 'GST rates & invoice payment terms',              Icon: Zap,      iconBgCls: 'bg-purple-50',  iconColorCls: 'text-purple-600' },
  system:         { label: 'System',         desc: 'Infrastructure, backups & tenancy switches',     Icon: Settings, iconBgCls: 'bg-emerald-50', iconColorCls: 'text-emerald-600'},
};

// -- Demo data -------------------------------------------------------------
const DEMO_GROUPS: PolicyGroup[] = [
  {
    category: 'security',
    label: 'Security',
    description: 'Authentication, session & access controls',
    policies: [
      { id: 'p1', key: 'password.min_length',    category: 'security',       description: 'Minimum password length for super-admin and platform accounts.', value: 10,   value_type: 'number',  is_toggle: false, is_overridable: false, default_value: 10,    updated_by: 'system' },
      { id: 'p2', key: 'session.timeout_minutes',category: 'security',       description: 'Session timeout before re-authentication is required.',          value: 30,   value_type: 'number',  is_toggle: false, is_overridable: false, default_value: 30,    updated_by: 'system' },
      { id: 'p3', key: 'mfa.required',           category: 'security',       description: 'Require MFA for super-admin accounts.',                          value: true, value_type: 'boolean', is_toggle: true,  is_overridable: false, default_value: true,  updated_by: 'system' },
    ],
  },
  {
    category: 'data_isolation',
    label: 'Data Isolation',
    description: 'Tenancy boundaries & audit retention',
    policies: [
      { id: 'p4', key: 'tenant.public_schema_only',category: 'data_isolation', description: 'Super-admin APIs are restricted to the public schema.', value: true, value_type: 'boolean', is_toggle: true,  is_overridable: false, default_value: true, updated_by: 'system' },
      { id: 'p5', key: 'audit.retention_days',     category: 'data_isolation', description: 'Audit log retention window in days.',                   value: 365, value_type: 'number',  is_toggle: false, is_overridable: false, default_value: 365,  updated_by: 'system' },
    ],
  },
  {
    category: 'billing',
    label: 'Billing',
    description: 'GST rates & invoice payment terms',
    policies: [
      { id: 'p6', key: 'gst.rate_percent',          category: 'billing', description: 'Default GST rate used for billing calculations.', value: 18, value_type: 'number', is_toggle: false, is_overridable: true, default_value: 18, updated_by: 'system' },
      { id: 'p7', key: 'invoice.payment_terms_days',category: 'billing', description: 'Payment due window for issued invoices.',         value: 15, value_type: 'number', is_toggle: false, is_overridable: true, default_value: 15, updated_by: 'system' },
    ],
  },
  {
    category: 'system',
    label: 'System',
    description: 'Infrastructure, backups & tenancy switches',
    policies: [
      { id: 'p8', key: 'backup.retention_days',  category: 'system', description: 'Daily backup retention window.',                               value: 30,    value_type: 'number',  is_toggle: false, is_overridable: true,  default_value: 30,    updated_by: 'system' },
      { id: 'p9', key: 'multi_tenancy.enabled',  category: 'system', description: 'Controls whether schema-based multi-tenancy is enabled.',     value: false, value_type: 'boolean', is_toggle: true,  is_overridable: false, default_value: false, updated_by: 'system' },
    ],
  },
];

const DEMO_SETTINGS: Record<string, Record<string, unknown>> = {
  system:        { name: 'eSkoolia Platform', version: '1.0.0', environment: 'production', multi_tenancy_enabled: false, timezone: 'Asia/Kolkata' },
  notification:  { email_enabled: true,  sms_enabled: false, push_enabled: true,  webhook_enabled: true  },
  integrations:  { google_sso: true, microsoft_sso: true, saml_enabled: false, ldap_enabled: false },
  storage:       { provider: 's3', bucket: 'eskoolia-prod', cdn_enabled: true,  max_file_size_mb: 100 },
  api:           { rate_limiting: true, api_versioning: 'v1', api_documentation_url: '/api/docs/', swagger_ui_enabled: true },
};

// -- Toggle ----------------------------------------------------------------
function Toggle({ checked, onChange, disabled, label }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <label className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer items-center ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => !disabled && onChange(e.target.checked)}
        disabled={disabled}
        aria-label={label ?? 'Toggle'}
        className="sr-only"
      />
      <span className={`relative inline-flex h-5 w-9 rounded-full border-2 border-transparent transition-colors ${checked ? 'bg-[var(--pu)]' : 'bg-[var(--bd-2)]'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
      </span>
    </label>
  );
}

// -- PolicyRow -------------------------------------------------------------
function PolicyRow({
  policy, draftValue, onChangeToggle, onChangeNumber, dirty,
}: {
  policy: GlobalPolicy;
  draftValue: string | number | boolean;
  onChangeToggle: (key: string, v: boolean) => void;
  onChangeNumber: (key: string, v: string) => void;
  dirty: boolean;
}) {
  return (
    <div className={`flex items-start justify-between gap-4 rounded-xl border px-4 py-3.5 transition-colors ${
      dirty ? 'border-[var(--pu-soft)] bg-[var(--pu-tint)]' : 'border-[var(--bd)] bg-[var(--bg-1)]'
    }`}>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="font-mono text-xs font-[600] text-[var(--ink-1)]">{policy.key}</p>
          {!policy.is_overridable && (
            <span className="rounded-full border border-[var(--bd)] bg-[var(--bg-3)] px-1.5 py-0.5 text-[10px] font-[550] text-[var(--ink-3)]">
              locked
            </span>
          )}
          {dirty && (
            <span className="rounded-full border border-[var(--pu-soft)] bg-[var(--pu-tint)] px-1.5 py-0.5 text-[10px] font-[550] text-[var(--pu-deep)]">
              unsaved
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs leading-relaxed text-[var(--ink-3)]">{policy.description}</p>
      </div>

      <div className="flex-shrink-0 pt-0.5">
        {policy.is_toggle ? (
          <Toggle
            checked={Boolean(draftValue)}
            label={policy.description}
            onChange={v => onChangeToggle(policy.key, v)}
          />
        ) : (
          <input
            type="number"
            title={policy.key}
            aria-label={policy.description}
            value={String(draftValue)}
            onChange={e => onChangeNumber(policy.key, e.target.value)}
            className="w-20 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-2 py-1 text-right text-xs font-mono font-[550] text-[var(--ink-1)] focus:outline-none focus:ring-2 focus:ring-[var(--pu-tint)]"
          />
        )}
      </div>
    </div>
  );
}

// -- Settings section ------------------------------------------------------
function SettingSection({ title, data }: { title: string; data: Record<string, unknown> }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="rounded-xl border border-[var(--bd)] bg-[var(--bg-1)]">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <p className="text-xs font-[600] uppercase tracking-wider text-[var(--ink-2)]">{title}</p>
        {open ? <ChevronDown className="h-3.5 w-3.5 text-[var(--ink-3)]" /> : <ChevronRight className="h-3.5 w-3.5 text-[var(--ink-3)]" />}
      </button>
      {open && (
        <div className="grid grid-cols-2 gap-x-8 gap-y-2 border-t border-[var(--bd)] px-4 py-3">
          {Object.entries(data).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 text-xs">
              <span className="font-mono text-[var(--ink-3)]">{k}</span>
              <span className={`font-[550] ${
                v === true  ? 'text-emerald-600' :
                v === false ? 'text-[var(--danger)]' :
                'text-[var(--ink-1)]'
              }`}>
                {String(v)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// -- Main page -------------------------------------------------------------
export default function SuperAdminPoliciesPage() {
  const [groups,      setGroups]      = useState<PolicyGroup[]>([]);
  const [settings,    setSettings]    = useState<Record<string, Record<string, unknown>>>({});
  const [loading,     setLoading]     = useState(true);
  const [useLiveData, setUseLiveData] = useState(false);
  const [drafts,      setDrafts]      = useState<Record<string, string | number | boolean>>({});
  const [saving,      setSaving]      = useState(false);
  const [exporting,   setExporting]   = useState(false);
  const [activeTab,   setActiveTab]   = useState<PolicyCategory>('security');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [g, s] = await Promise.all([getPolicies(), getPolicySettings()]);
      setGroups(g);
      setSettings(s);
      setUseLiveData(true);
    } catch {
      setGroups(DEMO_GROUPS);
      setSettings(DEMO_SETTINGS);
      setUseLiveData(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Seed drafts when data loads
  useEffect(() => {
    const init: Record<string, string | number | boolean> = {};
    groups.forEach(g => g.policies.forEach(p => { init[p.key] = p.value; }));
    setDrafts(init);
  }, [groups]);

  const dirtyKeys = useMemo(() => {
    const dirty = new Set<string>();
    groups.forEach(g => g.policies.forEach(p => {
      if (drafts[p.key] !== undefined && drafts[p.key] !== p.value) dirty.add(p.key);
    }));
    return dirty;
  }, [groups, drafts]);

  const handleToggle = (key: string, v: boolean) => setDrafts(d => ({ ...d, [key]: v }));
  const handleNumber = (key: string, v: string) => {
    const n = parseFloat(v);
    if (!Number.isNaN(n)) setDrafts(d => ({ ...d, [key]: n }));
  };

  const handleSave = async () => {
    if (dirtyKeys.size === 0) return;
    setSaving(true);
    try {
      const updates: UpdatePoliciesRequest = {};
      dirtyKeys.forEach(k => { updates[k] = drafts[k]; });
      await updatePolicies(updates);
      await load();
      toast.success('Policies saved successfully.');
    } catch {
      toast.error('Save failed — check your connection and try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleExport = async (format: 'json' | 'yaml') => {
    setExporting(true);
    try {
      const blob = await exportPolicies(format);
      downloadPoliciesConfig(blob, format);
    } catch {
      toast.error('Export failed.');
    } finally {
      setExporting(false);
    }
  };

  const activeGroup = groups.find(g => g.category === activeTab);

  return (
    <div className="space-y-6 p-6">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-[550] uppercase tracking-widest text-[var(--ink-3)]">
            <span className="font-serif italic font-light">Super Admin</span> · Config
          </p>
          <h1 className="mt-0.5 text-2xl font-bold text-[var(--ink-1)]">Policies &amp; Settings</h1>
          <p className="mt-1 text-sm text-[var(--ink-3)]">Platform-wide configuration and feature controls</p>
        </div>
        <div className="flex items-center gap-2">
          {!useLiveData && (
            <span className="rounded-full border border-[#FDE68A] bg-[var(--warn-soft)] px-2.5 py-1 text-[11px] font-[550] text-[#92400E]">
              Demo data
            </span>
          )}
          <button
            onClick={load} disabled={loading}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2 text-xs font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={() => handleExport('json')} disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2 text-xs font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            JSON
          </button>
          <button
            onClick={() => handleExport('yaml')} disabled={exporting}
            className="flex items-center gap-1.5 rounded-lg border border-[var(--bd)] bg-[var(--bg-2)] px-3 py-2 text-xs font-[550] text-[var(--ink-2)] hover:bg-[var(--bg-3)] disabled:opacity-50 transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            YAML
          </button>
        </div>
      </div>

      {/* ── Main 2-col layout ──────────────────────────────────────── */}
      <div className="flex gap-6">

        {/* Left: Policies editor */}
        <div className="min-w-0 flex-1 space-y-4">

          {/* Category tabs */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {(Object.keys(CAT_CONFIG) as PolicyCategory[]).map(cat => {
              const { label, Icon, iconBgCls, iconColorCls } = CAT_CONFIG[cat];
              const groupPolicies = groups.find(g => g.category === cat)?.policies ?? [];
              const hasDirty = groupPolicies.some(p => dirtyKeys.has(p.key));
              return (
                <button
                  key={cat}
                  onClick={() => setActiveTab(cat)}
                  className={`flex flex-shrink-0 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-[550] transition-colors ${
                    activeTab === cat
                      ? 'border-[var(--pu-soft)] bg-[var(--pu-tint)] text-[var(--pu-deep)]'
                      : 'border-[var(--bd)] bg-[var(--bg-2)] text-[var(--ink-2)] hover:bg-[var(--bg-3)]'
                  }`}
                >
                  <div className={`flex h-5 w-5 items-center justify-center rounded-md ${activeTab === cat ? 'bg-[var(--pu-soft)]' : iconBgCls}`}>
                    <Icon className={`h-3 w-3 ${activeTab === cat ? 'text-[var(--pu-deep)]' : iconColorCls}`} />
                  </div>
                  {label}
                  {hasDirty && <span className="h-1.5 w-1.5 rounded-full bg-[var(--pu)]" />}
                </button>
              );
            })}
          </div>

          {/* Active category panel */}
          {loading ? (
            <div className="sa-panel space-y-3 p-5">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between rounded-xl border border-[var(--bd)] px-4 py-4">
                  <div className="space-y-1.5">
                    <div className="h-3 w-40 rounded bg-[var(--bg-3)] animate-pulse" />
                    <div className="h-2.5 w-64 rounded bg-[var(--bg-3)] animate-pulse" />
                  </div>
                  <div className="h-5 w-9 rounded-full bg-[var(--bg-3)] animate-pulse" />
                </div>
              ))}
            </div>
          ) : activeGroup ? (
            <div className="sa-panel p-5">
              <div className="mb-4 flex items-center gap-3">
                {(() => {
                  const cfg = CAT_CONFIG[activeGroup.category];
                  return (
                    <>
                      <div className={`flex h-9 w-9 items-center justify-center rounded-xl ${cfg.iconBgCls}`}>
                        <cfg.Icon className={`h-4.5 w-4.5 ${cfg.iconColorCls}`} />
                      </div>
                      <div>
                        <p className="text-sm font-[650] text-[var(--ink-1)]">{cfg.label}</p>
                        <p className="text-xs text-[var(--ink-3)]">{cfg.desc}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="space-y-2">
                {activeGroup.policies.map(p => (
                  <PolicyRow
                    key={p.key}
                    policy={p}
                    draftValue={drafts[p.key] ?? p.value}
                    onChangeToggle={handleToggle}
                    onChangeNumber={handleNumber}
                    dirty={dirtyKeys.has(p.key)}
                  />
                ))}
              </div>

              {/* Save bar */}
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[var(--bd)] pt-4">
                <p className="text-xs text-[var(--ink-3)]">
                  {dirtyKeys.size > 0 ? `${dirtyKeys.size} unsaved change${dirtyKeys.size > 1 ? 's' : ''}` : 'No pending changes'}
                </p>
                <button
                  onClick={handleSave}
                  disabled={saving || dirtyKeys.size === 0}
                  className="rounded-lg bg-[var(--pu)] px-4 py-2 text-xs font-[600] text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </div>
          ) : (
            <div className="sa-panel flex flex-col items-center justify-center gap-2 py-16">
              <Settings className="h-8 w-8 text-[var(--ink-3)]" />
              <p className="text-sm text-[var(--ink-2)]">No policies loaded</p>
            </div>
          )}
        </div>

        {/* Right: System settings (read-only) */}
        <div className="w-72 flex-shrink-0 space-y-4">
          <div className="sa-panel p-4">
            <div className="mb-3 flex items-center gap-2">
              <Globe className="h-4 w-4 text-[var(--ink-3)]" />
              <p className="text-xs font-[650] text-[var(--ink-1)]">Platform Settings</p>
              <span className="ml-auto rounded-full border border-[var(--bd)] bg-[var(--bg-3)] px-1.5 py-0.5 text-[10px] font-[550] text-[var(--ink-3)]">
                read-only
              </span>
            </div>

            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-3 rounded bg-[var(--bg-3)] animate-pulse" />
                ))}
              </div>
            ) : (
              <div className="space-y-3">
                {Object.entries(settings).map(([section, data]) => (
                  <SettingSection key={section} title={section} data={data} />
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="sa-panel p-4 space-y-2">
            <div className="mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-[var(--ink-3)]" />
              <p className="text-xs font-[650] text-[var(--ink-1)]">Quick Actions</p>
            </div>
            <button className="w-full rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-3 py-2.5 text-left text-xs transition-colors hover:bg-[var(--bg-3)]">
              <p className="font-[550] text-[var(--ink-1)]">Reset to defaults</p>
              <p className="mt-0.5 text-[var(--ink-3)]">Restore all policies to their default values</p>
            </button>
            <button className="w-full rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-3 py-2.5 text-left text-xs transition-colors hover:bg-[var(--bg-3)]">
              <p className="font-[550] text-[var(--ink-1)]">Force MFA enrollment</p>
              <p className="mt-0.5 text-[var(--ink-3)]">Send MFA setup emails to all admins</p>
            </button>
            <button className="w-full rounded-xl border border-[var(--bd)] bg-[var(--bg-1)] px-3 py-2.5 text-left text-xs transition-colors hover:bg-[var(--bg-3)]">
              <p className="font-[550] text-[var(--ink-1)]">Flush all sessions</p>
              <p className="mt-0.5 text-[var(--ink-3)]">Immediately invalidate all active user sessions</p>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}