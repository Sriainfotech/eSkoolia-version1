"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck, RefreshCw, CalendarRange, Users2, FileText, CalendarClock, Scale, StickyNote,
  ClipboardCheck, Pencil, Trash2, Plus, ChevronLeft, ChevronRight, CheckCircle2, Loader2,
  AlertTriangle, Sparkles, History as HistoryIcon, CircleOff, CalendarDays,
} from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { extractListData, type ListApiResponse } from "@/lib/pagination";
import { WizardHelpButton } from "./WizardHelpButton";
import { useUnsavedChangesGuard } from "@/contexts/UnsavedChangesContext";

interface LeavePolicy {
  id: number;
  name: string;
  max_days_per_year: number;
  is_paid: boolean;
  is_active: boolean;
  is_builtin: boolean;
  can_carry_forward: boolean;
  max_carry_forward_days: number;
  carry_forward_type: "limited" | "unlimited";
  carry_forward_expiry_days: number;
  carry_forward_mode: "automatic" | "manual";
  policy_note: string;
  applicable_departments: string[];
  applicable_designations: string[];
  applicable_employment_types: string[];
  applicable_gender: "all" | "male" | "female";
  minimum_service_period: number;
  attachment_required: boolean;
  medical_certificate_required: boolean;
  medical_certificate_after_days: number;
  minimum_notice_period: number;
  minimum_leave_duration: number;
  maximum_leave_duration: number;
  maximum_consecutive_days: number;
  allow_half_day: boolean;
  allow_backdated_leave: boolean;
  maximum_backdated_days: number;
  allow_future_leave: boolean;
  maximum_future_days: number;
  sandwich_leave_enabled: boolean;
  count_holidays_as_leave: boolean;
  count_weekoffs_as_leave: boolean;
  allow_negative_balance: boolean;
  convert_to_lop: boolean;
  allow_leave_cancellation: boolean;
  cancellation_allowed_until: number;
  allow_probation_leave: boolean;
  allow_notice_period_leave: boolean;
  allow_leave_extension: boolean;
  allow_leave_combination: boolean;
}

interface LookupItem {
  id: number;
  name: string;
}

interface AuditEntry {
  id: number;
  actor_name: string;
  action: string;
  created_at: string;
}

type FieldSpec = { key: keyof LeavePolicy; label: string; type: "number" | "checkbox" | "select" | "text" };

const FIELD_GROUPS: Array<{ title: string; icon: typeof RefreshCw; fields: FieldSpec[] }> = [
  {
    title: "Carry-Forward",
    icon: RefreshCw,
    fields: [
      { key: "can_carry_forward", label: "Allow carry-forward", type: "checkbox" },
      { key: "carry_forward_type", label: "Carry-forward type", type: "select" },
      { key: "carry_forward_mode", label: "Carry-forward mode", type: "select" },
      { key: "max_carry_forward_days", label: "Max carry-forward days", type: "number" },
      { key: "carry_forward_expiry_days", label: "Carry-forward expiry (days, 0 = never)", type: "number" },
    ],
  },
  {
    title: "Duration Limits",
    icon: CalendarRange,
    fields: [
      { key: "minimum_leave_duration", label: "Min. days per request (0 = none)", type: "number" },
      { key: "maximum_leave_duration", label: "Max days per request (0 = none)", type: "number" },
      { key: "maximum_consecutive_days", label: "Max consecutive days (0 = none)", type: "number" },
      { key: "allow_half_day", label: "Allow half-day", type: "checkbox" },
      { key: "allow_backdated_leave", label: "Allow backdated leave", type: "checkbox" },
      { key: "maximum_backdated_days", label: "Max backdated days", type: "number" },
      { key: "allow_future_leave", label: "Allow future-dated leave", type: "checkbox" },
      { key: "maximum_future_days", label: "Max days in advance (0 = none)", type: "number" },
    ],
  },
  {
    title: "Eligibility",
    icon: Users2,
    fields: [
      { key: "applicable_gender", label: "Applicable gender", type: "select" },
      { key: "minimum_service_period", label: "Min. service period (months)", type: "number" },
      { key: "minimum_notice_period", label: "Min. notice period (days)", type: "number" },
      { key: "allow_probation_leave", label: "Allow during probation", type: "checkbox" },
      { key: "allow_notice_period_leave", label: "Allow during notice period", type: "checkbox" },
    ],
  },
  {
    title: "Documentation",
    icon: FileText,
    fields: [
      { key: "attachment_required", label: "Attachment required", type: "checkbox" },
      { key: "medical_certificate_required", label: "Medical certificate required", type: "checkbox" },
      { key: "medical_certificate_after_days", label: "...required after this many days", type: "number" },
    ],
  },
  {
    title: "Holidays & Week-offs",
    icon: CalendarClock,
    fields: [
      { key: "sandwich_leave_enabled", label: "Sandwich leave rule", type: "checkbox" },
      { key: "count_holidays_as_leave", label: "Count holidays as leave", type: "checkbox" },
      { key: "count_weekoffs_as_leave", label: "Count week-offs as leave", type: "checkbox" },
    ],
  },
  {
    title: "Balance & Cancellation",
    icon: Scale,
    fields: [
      { key: "allow_negative_balance", label: "Allow negative balance", type: "checkbox" },
      { key: "convert_to_lop", label: "Convert to Loss of Pay when exhausted", type: "checkbox" },
      { key: "allow_leave_cancellation", label: "Allow cancellation", type: "checkbox" },
      { key: "cancellation_allowed_until", label: "...within this many days of start (0 = anytime)", type: "number" },
      { key: "allow_leave_extension", label: "Allow extension", type: "checkbox" },
      { key: "allow_leave_combination", label: "Allow combining with other leave types", type: "checkbox" },
    ],
  },
  {
    title: "Note",
    icon: StickyNote,
    fields: [
      { key: "policy_note", label: "Policy note shown to staff", type: "text" },
    ],
  },
];

const EMPLOYMENT_TYPES = [
  { value: "permanent", label: "Permanent" },
  { value: "contract", label: "Contract" },
];

const IDENTITY_KEYS = ["name", "max_days_per_year", "is_paid", "is_active"] as const;
// Rendered as custom checkbox pickers on the Eligibility step, not via FIELD_GROUPS —
// must be listed here explicitly or their edits are silently dropped from the save payload.
const SCOPE_KEYS = ["applicable_departments", "applicable_designations", "applicable_employment_types"] as const;
const ALL_FIELD_KEYS = FIELD_GROUPS.flatMap((g) => g.fields.map((f) => f.key));

const WIZARD_DEFAULTS: Partial<LeavePolicy> = {
  name: "", max_days_per_year: 10, is_paid: true, is_active: true,
  can_carry_forward: false, max_carry_forward_days: 0, carry_forward_type: "limited", carry_forward_expiry_days: 0, carry_forward_mode: "automatic",
  minimum_leave_duration: 0, maximum_leave_duration: 0, maximum_consecutive_days: 0, allow_half_day: true,
  allow_backdated_leave: false, maximum_backdated_days: 0, allow_future_leave: true, maximum_future_days: 0,
  applicable_gender: "all", minimum_service_period: 0, minimum_notice_period: 0, allow_probation_leave: false, allow_notice_period_leave: false,
  attachment_required: false, medical_certificate_required: false, medical_certificate_after_days: 0,
  sandwich_leave_enabled: false, count_holidays_as_leave: false, count_weekoffs_as_leave: false,
  allow_negative_balance: false, convert_to_lop: false, allow_leave_cancellation: true, cancellation_allowed_until: 0,
  allow_leave_extension: false, allow_leave_combination: false,
  policy_note: "",
  applicable_departments: [], applicable_designations: [], applicable_employment_types: [],
};

const WIZARD_STEPS: Array<{ label: string; icon: typeof BadgeCheck }> = [
  { label: "Identity", icon: BadgeCheck },
  ...FIELD_GROUPS.map((g) => ({ label: g.title, icon: g.icon })),
  { label: "Review", icon: ClipboardCheck },
];

const WIZARD_HELP_STEPS = [
  { label: "Identity", description: "Name the leave type, set the days allowed per year, and mark it paid/active." },
  { label: "Carry-Forward", description: "Whether unused days roll into next year, any cap, and whether it happens automatically or needs a manual run." },
  { label: "Duration Limits", description: "Min/max days per request, half-day requests, and how far back or ahead staff can book." },
  { label: "Eligibility", description: "Who this leave type applies to — gender, minimum service period, notice period, probation." },
  { label: "Documentation", description: "Whether an attachment or medical certificate is required, and after how many days." },
  { label: "Holidays & Week-offs", description: "How holidays and weekly offs inside a leave request are counted (sandwich rule, etc.)." },
  { label: "Balance & Cancellation", description: "Negative balances, converting exhausted leave to Loss of Pay, and cancellation/extension rules." },
  { label: "Note", description: "An optional note shown to staff when they apply for this leave type." },
  { label: "Review", description: "Check everything at a glance before saving." },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const inputStyle = { border: "1px solid var(--bd-2)", borderRadius: 10, padding: "9px 11px", fontSize: 14, background: "var(--bg-1)", color: "var(--ink-1)", width: "100%" } as const;
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" };

type StatTone = "purple" | "blue" | "amber" | "rose";
const STAT_TONES: Record<StatTone, { bg: string; fg: string }> = {
  purple: { bg: "var(--pu-tint)", fg: "var(--pu)" },
  blue: { bg: "var(--info-soft)", fg: "var(--info)" },
  amber: { bg: "var(--warn-soft)", fg: "var(--warn)" },
  rose: { bg: "var(--danger-soft)", fg: "var(--danger)" },
};

function StatTile({ icon: Icon, tone, label, value }: { icon: typeof BadgeCheck; tone: StatTone; label: string; value: React.ReactNode }) {
  const t = STAT_TONES[tone];
  return (
    <div style={{ display: "flex", gap: 9, alignItems: "flex-start", padding: "9px 11px", borderRadius: 10, background: "var(--bg-2)" }}>
      <div style={{ flexShrink: 0, width: 26, height: 26, borderRadius: 8, background: t.bg, color: t.fg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={13} strokeWidth={2.25} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-1)", marginTop: 1, lineHeight: 1.3 }}>{value}</div>
      </div>
    </div>
  );
}

function IconButton({ icon: Icon, label, onClick, disabled, tone = "neutral" }: {
  icon: typeof Pencil; label: string; onClick: () => void; disabled?: boolean; tone?: "neutral" | "purple" | "ok" | "danger";
}) {
  const toneColor = tone === "purple" ? "var(--pu)" : tone === "ok" ? "var(--ok)" : tone === "danger" ? "var(--danger)" : "var(--ink-2)";
  return (
    <button
      className="lp-icon-btn"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, background: "var(--bg-1)",
        border: "1px solid var(--bd-2)", borderRadius: 8, padding: "6px 11px", fontSize: 11.5, fontWeight: 600,
        cursor: disabled ? "default" : "pointer", color: toneColor, opacity: disabled ? 0.55 : 1,
      }}
    >
      <Icon size={12} strokeWidth={2.25} />
      {label}
    </button>
  );
}

function eligibilitySummary(p: Partial<LeavePolicy>, departments: LookupItem[], designations: LookupItem[]): string {
  const parts: string[] = [];
  if (p.applicable_gender && p.applicable_gender !== "all") parts.push(p.applicable_gender === "male" ? "Male only" : "Female only");
  const deptNames = (p.applicable_departments ?? []).map((id) => departments.find((d) => String(d.id) === id)?.name).filter(Boolean);
  if (deptNames.length) parts.push(deptNames.join(", "));
  const desigNames = (p.applicable_designations ?? []).map((id) => designations.find((d) => String(d.id) === id)?.name).filter(Boolean);
  if (desigNames.length) parts.push(desigNames.join(", "));
  const empTypes = (p.applicable_employment_types ?? []).map((v) => EMPLOYMENT_TYPES.find((t) => t.value === v)?.label).filter(Boolean);
  if (empTypes.length) parts.push(empTypes.join(", "));
  if ((p.minimum_service_period ?? 0) > 0) parts.push(`${p.minimum_service_period}mo+ service`);
  return parts.length ? parts.join(" · ") : "All staff";
}

export function LeavePolicyPanel() {
  const [policies, setPolicies] = useState<LeavePolicy[]>([]);
  const [departments, setDepartments] = useState<LookupItem[]>([]);
  const [designations, setDesignations] = useState<LookupItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Partial<LeavePolicy>>(WIZARD_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const openSnapshotRef = useRef<Partial<LeavePolicy>>(WIZARD_DEFAULTS);

  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [policiesData, deptData, desigData] = await Promise.all([
        apiRequestWithRefresh<ListApiResponse<LeavePolicy>>("/api/v1/settings/leave-policy/"),
        apiRequestWithRefresh<ListApiResponse<LookupItem>>("/api/v1/hr/departments/?page_size=200").catch(() => []),
        apiRequestWithRefresh<ListApiResponse<LookupItem>>("/api/v1/hr/designations/?page_size=200").catch(() => []),
      ]);
      setPolicies(extractListData(policiesData));
      setDepartments(extractListData(deptData as ListApiResponse<LookupItem>));
      setDesignations(extractListData(desigData as ListApiResponse<LookupItem>));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load leave policies.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const startCreate = () => {
    setEditingId(null);
    setDraft(WIZARD_DEFAULTS);
    openSnapshotRef.current = WIZARD_DEFAULTS;
    setWizardStep(0);
    setWizardOpen(true);
  };

  const startEdit = (policy: LeavePolicy) => {
    setEditingId(policy.id);
    setDraft(policy);
    openSnapshotRef.current = policy;
    setWizardStep(0);
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setEditingId(null);
  };

  const buildPayload = () =>
    Object.fromEntries([...IDENTITY_KEYS, ...ALL_FIELD_KEYS, ...SCOPE_KEYS].map((key) => [key, draft[key as keyof LeavePolicy]]));

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingId) {
        const updated = await apiRequestWithRefresh<LeavePolicy>(`/api/v1/settings/leave-policy/${editingId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        setPolicies((prev) => prev.map((p) => (p.id === editingId ? updated : p)));
        setSuccess("Leave type updated.");
      } else {
        const created = await apiRequestWithRefresh<LeavePolicy>("/api/v1/settings/leave-policy/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(buildPayload()),
        });
        setPolicies((prev) => [...prev, created]);
        setSuccess("Leave type created.");
      }
      closeWizard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save leave type.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const isDirty = wizardOpen && JSON.stringify(draft) !== JSON.stringify(openSnapshotRef.current);
  useUnsavedChangesGuard(isDirty, () => handleSubmit());

  const handleDelete = async (policy: LeavePolicy) => {
    if (!confirm(`Delete "${policy.name}"? This cannot be undone.`)) return;
    setBusyId(policy.id);
    setError(null);
    try {
      await apiRequestWithRefresh(`/api/v1/settings/leave-policy/${policy.id}/`, { method: "DELETE" });
      setPolicies((prev) => prev.filter((p) => p.id !== policy.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete leave type — it may be built-in or already in use.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleHistory = async (policy: LeavePolicy) => {
    if (historyOpenId === policy.id) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(policy.id);
    setHistoryLoading(true);
    try {
      const data = await apiRequestWithRefresh<ListApiResponse<AuditEntry>>(
        `/api/v1/settings/audit-log/?module=LeaveType&object_id=${policy.id}`
      );
      setHistory(extractListData(data));
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "26px 28px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: 0, lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            Leave{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>
              Policy
            </em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
            Create leave types and design their eligibility, carry-forward, and documentation rules. Per-staff day
            allocations still happen in HR &gt; Leave.
          </p>
        </div>
        {!loading && policies.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--pu-tint)", color: "var(--pu)", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
            <Sparkles size={12} strokeWidth={2.5} />
            {policies.length} leave {policies.length === 1 ? "type" : "types"} configured
          </div>
        )}
      </div>

      {error && (
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, color: "var(--danger)", background: "var(--danger-soft)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 500 }}>
          <AlertTriangle size={15} /> {error}
        </div>
      )}
      {success && (
        <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 8, color: "var(--ok)", background: "var(--ok-soft)", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 500 }}>
          <CheckCircle2 size={15} /> {success}
        </div>
      )}
      {loading && (
        <div style={{ marginTop: 28, display: "flex", alignItems: "center", gap: 10, color: "var(--ink-2)", fontSize: 14 }}>
          <Loader2 size={16} className="lp-spin" /> Loading leave policies…
        </div>
      )}

      {!loading && !wizardOpen && policies.length === 0 && (
        <div style={{ marginTop: 24, border: "1px dashed var(--bd-3)", borderRadius: 14, padding: "34px 24px", textAlign: "center", background: "radial-gradient(circle at 50% 0%, var(--pu-tint), transparent 70%)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--pu-tint)", color: "var(--pu)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <CalendarDays size={21} strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-1)", margin: "0 0 6px" }}>Set up your first leave type</h2>
          <p style={{ margin: "0 auto 18px", maxWidth: 420, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
            A short guided setup — days per year, carry-forward, eligibility, documentation and more. Staff will see
            these rules once saved.
          </p>
          <button className="lp-primary-btn" onClick={startCreate} style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} strokeWidth={2.5} /> Start Setup
          </button>
        </div>
      )}

      {!loading && !wizardOpen && policies.length > 0 && (
        <>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {policies.map((p) => (
              <div key={p.id} style={{ position: "relative", borderRadius: 13, padding: "14px 16px 12px 18px", background: "var(--bg-1)", border: "1px solid var(--bd)", boxShadow: "var(--sh-1)", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: p.is_active ? "var(--pu)" : "var(--bd-3)" }} />

                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: "var(--bg-2)", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <CalendarDays size={15} strokeWidth={2} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <strong style={{ color: "var(--ink-1)", fontSize: 14, fontWeight: 700 }}>{p.name}</strong>
                        {p.is_builtin && (
                          <span style={{ fontSize: 9.5, color: "var(--ink-2)", border: "1px solid var(--bd-2)", borderRadius: 999, padding: "2px 7px", fontWeight: 700 }}>Built-in</span>
                        )}
                        {!p.is_active && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, color: "var(--danger)", background: "var(--danger-soft)", fontWeight: 700, borderRadius: 999, padding: "2px 7px" }}>
                            <CircleOff size={9} /> Inactive
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>
                        {p.max_days_per_year || "Unlimited"} days/yr · {p.is_paid ? "Paid" : "Unpaid"}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <IconButton icon={Pencil} label="Edit" tone="purple" onClick={() => startEdit(p)} />
                    {!p.is_builtin && (
                      <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => void handleDelete(p)} disabled={busyId === p.id} />
                    )}
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  <StatTile icon={CalendarDays} tone="purple" label="Days / year" value={p.max_days_per_year || "Unlimited"} />
                  <StatTile icon={RefreshCw} tone="blue" label="Carry-forward" value={p.can_carry_forward ? `Up to ${p.max_carry_forward_days || "∞"} days` : "Off"} />
                  <StatTile icon={Users2} tone="amber" label="Eligibility" value={eligibilitySummary(p, departments, designations)} />
                  <StatTile icon={FileText} tone="rose" label="Documentation" value={p.medical_certificate_required ? `Medical cert. after ${p.medical_certificate_after_days}d` : p.attachment_required ? "Attachment required" : "None required"} />
                </div>

                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button className="lp-link-btn" onClick={() => void toggleHistory(p)} style={{ background: "none", border: "none", padding: 0, fontSize: 11, fontWeight: 600, color: "var(--pu)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <HistoryIcon size={12} /> {historyOpenId === p.id ? "Hide history" : "View history"}
                  </button>
                </div>

                {historyOpenId === p.id && (
                  <div style={{ marginTop: 8, borderTop: "1px solid var(--bd)", paddingTop: 9 }}>
                    {historyLoading && (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-2)" }}>
                        <Loader2 size={12} className="lp-spin" /> Loading…
                      </span>
                    )}
                    {!historyLoading && history.length === 0 && <span style={{ fontSize: 11.5, color: "var(--ink-2)" }}>No history yet.</span>}
                    {!historyLoading && history.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {history.map((h) => (
                          <div key={h.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11.5, color: "var(--ink-2)" }}>
                            <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--pu)", flexShrink: 0 }} />
                            <span style={{ color: "var(--ink-3)" }}>{formatDate(h.created_at)}</span>
                            <span>—</span>
                            <strong style={{ color: "var(--ink-1)", fontWeight: 600 }}>{h.action}</strong>
                            <span>by {h.actor_name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          <button className="lp-primary-btn" onClick={startCreate} style={{ marginTop: 16, background: "var(--pu)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} strokeWidth={2.5} /> Add Another Leave Type
          </button>
        </>
      )}

      {wizardOpen && (
        <LeavePolicyWizard
          draft={draft}
          setDraft={setDraft}
          step={wizardStep}
          setStep={setWizardStep}
          isEditing={editingId !== null}
          saving={saving}
          departments={departments}
          designations={designations}
          onCancel={closeWizard}
          onSubmit={() => void handleSubmit().catch(() => {})}
        />
      )}

      <CarryForwardSection />

      <style jsx>{`
        .lp-icon-btn:hover:not(:disabled) { background: var(--bg-2); border-color: var(--bd-3); }
        .lp-primary-btn:hover { background: var(--pu-deep); }
        .lp-link-btn:hover { text-decoration: underline; }
        .lp-spin { animation: lp-rotate 0.8s linear infinite; }
        @keyframes lp-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function LeavePolicyWizard({
  draft, setDraft, step, setStep, isEditing, saving, departments, designations, onCancel, onSubmit,
}: {
  draft: Partial<LeavePolicy>;
  setDraft: React.Dispatch<React.SetStateAction<Partial<LeavePolicy>>>;
  step: number;
  setStep: (n: number) => void;
  isEditing: boolean;
  saving: boolean;
  departments: LookupItem[];
  designations: LookupItem[];
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const set = <K extends keyof LeavePolicy>(key: K, value: LeavePolicy[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const hasName = Boolean(draft.name && draft.name.trim());
  const canGoNext = step === 0 ? hasName : true;
  const canJumpTo = (target: number) => isEditing || target === 0 || hasName;

  const toggleListValue = (key: "applicable_departments" | "applicable_designations" | "applicable_employment_types", value: string) => {
    setDraft((d) => {
      const current = (d[key] as string[] | undefined) ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...d, [key]: next };
    });
  };

  const renderField = ({ key, label, type }: FieldSpec) => {
    if (type === "checkbox") {
      return (
        <label key={key} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "var(--ink-2)", background: "var(--bg-2)", borderRadius: 10, padding: "10px 12px" }}>
          <input type="checkbox" checked={Boolean(draft[key])} onChange={(e) => set(key, e.target.checked as never)} />
          {label}
        </label>
      );
    }
    if (type === "select") {
      const options = key === "carry_forward_type" ? ["limited", "unlimited"] : key === "carry_forward_mode" ? ["automatic", "manual"] : ["all", "male", "female"];
      return (
        <label key={key} style={labelStyle}>
          {label}
          <select value={(draft[key] as string) ?? options[0]} onChange={(e) => set(key, e.target.value as never)} style={inputStyle}>
            {options.map((o) => <option key={o} value={o}>{o[0].toUpperCase() + o.slice(1)}</option>)}
          </select>
        </label>
      );
    }
    if (type === "text") {
      return (
        <label key={key} style={{ ...labelStyle, gridColumn: "1 / -1" }}>
          {label}
          <textarea rows={3} value={(draft[key] as string) ?? ""} onChange={(e) => set(key, e.target.value as never)} style={{ ...inputStyle, resize: "vertical" }} />
        </label>
      );
    }
    return (
      <label key={key} style={labelStyle}>
        {label}
        <input type="number" min={0} value={(draft[key] as number) ?? 0} onChange={(e) => set(key, Number(e.target.value) as never)} style={inputStyle} />
      </label>
    );
  };

  const groupStep = step >= 1 && step <= FIELD_GROUPS.length ? FIELD_GROUPS[step - 1] : null;

  return (
    <div style={{ marginTop: 20, border: "1px solid var(--bd)", borderRadius: 14, padding: "22px 24px", background: "var(--bg-1)" }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap", flex: 1 }}>
        {WIZARD_STEPS.map((s, i) => {
          const StepIcon = s.icon;
          const isDone = i < step;
          const isActive = i === step;
          const jumpable = canJumpTo(i) && i !== step;
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", flex: i < WIZARD_STEPS.length - 1 ? 1 : "0 0 auto" }}>
              <div
                onClick={() => jumpable && setStep(i)}
                title={jumpable ? `Jump to ${s.label}` : s.label}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 34, cursor: jumpable ? "pointer" : "default" }}
              >
                <div
                  style={{
                    width: 30, height: 30, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive ? "var(--pu)" : isDone ? "var(--pu-tint)" : "var(--bg-2)",
                    color: isActive ? "#fff" : isDone ? "var(--pu)" : "var(--ink-3)",
                    border: isActive ? "none" : `1px solid ${isDone ? "var(--pu-soft)" : "var(--bd-2)"}`,
                    transition: "all 0.15s ease", flexShrink: 0,
                  }}
                >
                  {isDone ? <CheckCircle2 size={15} strokeWidth={2.5} /> : <StepIcon size={14} strokeWidth={2.25} />}
                </div>
                <span style={{ fontSize: 9.5, fontWeight: 600, color: isActive ? "var(--pu)" : "var(--ink-3)", textAlign: "center", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
              {i < WIZARD_STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: isDone ? "var(--pu-soft)" : "var(--bd)", margin: "0 3px 16px" }} />
              )}
            </div>
          );
        })}
      </div>
      <WizardHelpButton
        title="Leave Type Wizard Guide"
        intro="Each step configures one part of the leave type. Jump to any step you've already unlocked using the icons above."
        steps={WIZARD_HELP_STEPS}
      />
      </div>

      {step === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 18 }}>
          <label style={{ ...labelStyle, gridColumn: "1 / -1" }}>
            Leave Type Name (e.g. &quot;Casual Leave&quot;, &quot;Earned Leave&quot;)
            <input value={draft.name ?? ""} onChange={(e) => set("name", e.target.value)} style={inputStyle} autoFocus />
          </label>
          <label style={labelStyle}>
            Max days/year (0 = unlimited/tracking-only)
            <input type="number" min={0} value={draft.max_days_per_year ?? 0} onChange={(e) => set("max_days_per_year", Number(e.target.value))} style={inputStyle} />
          </label>
          <div />
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "var(--ink-2)", background: "var(--bg-2)", borderRadius: 10, padding: "10px 12px" }}>
            <input type="checkbox" checked={Boolean(draft.is_paid)} onChange={(e) => set("is_paid", e.target.checked)} />
            Paid
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "var(--ink-2)", background: "var(--bg-2)", borderRadius: 10, padding: "10px 12px" }}>
            <input type="checkbox" checked={Boolean(draft.is_active)} onChange={(e) => set("is_active", e.target.checked)} />
            Active
          </label>
        </div>
      )}

      {groupStep && (
        <div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 14 }}>
            {groupStep.fields.map(renderField)}
          </div>
          {groupStep.title === "Eligibility" && (
            <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>Applicable departments (none checked = all)</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {departments.map((d) => {
                    const checked = (draft.applicable_departments ?? []).includes(String(d.id));
                    return (
                      <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: checked ? "#fff" : "var(--ink-2)", background: checked ? "var(--pu)" : "var(--bg-2)", border: `1px solid ${checked ? "var(--pu)" : "var(--bd-2)"}`, borderRadius: 999, padding: "7px 13px" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleListValue("applicable_departments", String(d.id))} style={{ display: "none" }} />
                        {checked ? <CheckCircle2 size={13} /> : null}
                        {d.name}
                      </label>
                    );
                  })}
                  {departments.length === 0 && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>No departments set up in HR yet.</span>}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>Applicable designations (none checked = all)</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {designations.map((d) => {
                    const checked = (draft.applicable_designations ?? []).includes(String(d.id));
                    return (
                      <label key={d.id} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: checked ? "#fff" : "var(--ink-2)", background: checked ? "var(--pu)" : "var(--bg-2)", border: `1px solid ${checked ? "var(--pu)" : "var(--bd-2)"}`, borderRadius: 999, padding: "7px 13px" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleListValue("applicable_designations", String(d.id))} style={{ display: "none" }} />
                        {checked ? <CheckCircle2 size={13} /> : null}
                        {d.name}
                      </label>
                    );
                  })}
                  {designations.length === 0 && <span style={{ fontSize: 12, color: "var(--ink-3)" }}>No designations set up in HR yet.</span>}
                </div>
              </div>
              <div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>Applicable employment types (none checked = all)</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                  {EMPLOYMENT_TYPES.map((t) => {
                    const checked = (draft.applicable_employment_types ?? []).includes(t.value);
                    return (
                      <label key={t.value} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 12.5, fontWeight: 600, cursor: "pointer", color: checked ? "#fff" : "var(--ink-2)", background: checked ? "var(--pu)" : "var(--bg-2)", border: `1px solid ${checked ? "var(--pu)" : "var(--bd-2)"}`, borderRadius: 999, padding: "7px 13px" }}>
                        <input type="checkbox" checked={checked} onChange={() => toggleListValue("applicable_employment_types", t.value)} style={{ display: "none" }} />
                        {checked ? <CheckCircle2 size={13} /> : null}
                        {t.label}
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {step === WIZARD_STEPS.length - 1 && (
        <div>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <ClipboardCheck size={15} /> Review before saving:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            <StatTile icon={BadgeCheck} tone="purple" label="Name" value={draft.name || "—"} />
            <StatTile icon={CalendarDays} tone="purple" label="Days / year" value={draft.max_days_per_year || "Unlimited"} />
            <StatTile icon={ClipboardCheck} tone="purple" label="Paid / Active" value={`${draft.is_paid ? "Paid" : "Unpaid"} · ${draft.is_active ? "Active" : "Inactive"}`} />
            <StatTile icon={RefreshCw} tone="blue" label="Carry-forward" value={draft.can_carry_forward ? `Up to ${draft.max_carry_forward_days || "∞"} days (${draft.carry_forward_mode})` : "Off"} />
            <StatTile icon={CalendarRange} tone="blue" label="Duration limits" value={`${draft.maximum_leave_duration || "No"} max · ${draft.allow_half_day ? "half-day ok" : "no half-day"}`} />
            <StatTile icon={Users2} tone="amber" label="Eligibility" value={eligibilitySummary(draft, departments, designations)} />
            <StatTile icon={FileText} tone="rose" label="Documentation" value={draft.medical_certificate_required ? `Medical cert. after ${draft.medical_certificate_after_days}d` : draft.attachment_required ? "Attachment required" : "None required"} />
            <StatTile icon={CalendarClock} tone="purple" label="Holidays/week-offs" value={`${draft.count_holidays_as_leave ? "Holidays count" : "Holidays excluded"} · ${draft.count_weekoffs_as_leave ? "Week-offs count" : "Week-offs excluded"}`} />
            <StatTile icon={Scale} tone="rose" label="Balance" value={draft.allow_negative_balance ? "Negative allowed" : draft.convert_to_lop ? "Converts to LOP" : "Standard"} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--bd)", paddingTop: 20 }}>
        <div>
          {step > 0 && (
            <button className="lp-icon-btn" onClick={() => setStep(step - 1)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-1)", border: "1px solid var(--bd-2)", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink-2)" }}>
              <ChevronLeft size={15} /> Back
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ background: "transparent", border: "1px solid var(--bd-2)", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink-2)" }}>
            Cancel
          </button>
          {isEditing && step < WIZARD_STEPS.length - 1 && (
            <button
              onClick={onSubmit}
              disabled={saving}
              style={{ background: "var(--bg-1)", color: "var(--pu)", border: "1px solid var(--pu-soft)", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {saving ? (<><Loader2 size={15} className="lp-spin" /> Saving…</>) : (<><CheckCircle2 size={15} /> Save &amp; Exit</>)}
            </button>
          )}
          {step < WIZARD_STEPS.length - 1 ? (
            <button
              className="lp-primary-btn"
              onClick={() => canGoNext && setStep(step + 1)}
              disabled={!canGoNext}
              style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: canGoNext ? "pointer" : "default", opacity: canGoNext ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              className="lp-primary-btn"
              onClick={onSubmit}
              disabled={saving}
              style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {saving ? (<><Loader2 size={15} className="lp-spin" /> Saving…</>) : isEditing ? (<><CheckCircle2 size={15} /> Save Changes</>) : (<><Plus size={15} /> Create Leave Type</>)}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .lp-icon-btn:hover:not(:disabled) { background: var(--bg-2); border-color: var(--bd-3); }
        .lp-primary-btn:hover:not(:disabled) { background: var(--pu-deep); }
        .lp-spin { animation: lp-rotate 0.8s linear infinite; }
        @keyframes lp-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

interface CarryForwardRow {
  staff_id: number;
  staff_name: string;
  leave_type_id: number;
  leave_type_name: string;
  carried_forward: string | number;
  skipped_reason: string | null;
}

interface CarryForwardLogRow {
  id: number;
  from_year: number;
  to_year: number;
  executed_by_name: string;
  process_mode: string;
  total_processed: number;
  total_skipped: number;
  total_failed: number;
  is_completed: boolean;
  created_at: string;
}

function CarryForwardSection() {
  const thisYear = new Date().getFullYear();
  const [fromYear, setFromYear] = useState(thisYear - 1);
  const [toYear, setToYear] = useState(thisYear);
  const [rows, setRows] = useState<CarryForwardRow[] | null>(null);
  const [history, setHistory] = useState<CarryForwardLogRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadHistory = async () => {
    try {
      const data = await apiRequestWithRefresh<ListApiResponse<CarryForwardLogRow>>("/api/v1/settings/leave-carry-forward/history/");
      setHistory(extractListData(data));
    } catch {
      // non-fatal — history is supplementary
    }
  };

  useEffect(() => {
    void loadHistory();
  }, []);

  const handlePreview = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const data = await apiRequestWithRefresh<{ rows: CarryForwardRow[] }>("/api/v1/settings/leave-carry-forward/preview/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_year: fromYear, to_year: toYear }),
      });
      setRows(data.rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to preview carry-forward.");
    } finally {
      setLoading(false);
    }
  };

  const handleRun = async () => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const log = await apiRequestWithRefresh<CarryForwardLogRow>("/api/v1/settings/leave-carry-forward/run/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from_year: fromYear, to_year: toYear }),
      });
      setSuccess(`Carry-forward run complete: ${log.total_processed} processed, ${log.total_skipped} skipped, ${log.total_failed} failed.`);
      setRows(null);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to run carry-forward.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ marginTop: 36, paddingTop: 24, borderTop: "1px solid var(--bd)" }}>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink-1)", margin: 0 }}>Leave Balance Carry-Forward</h2>
      <p style={{ margin: "6px 0 0", fontSize: 13, color: "var(--ink-2)" }}>
        Roll over unused balance from one year to the next for leave types with carry-forward enabled. Preview before running.
      </p>

      {error && <div style={{ marginTop: 14, color: "var(--err)", fontSize: 13 }}>{error}</div>}
      {success && <div style={{ marginTop: 14, color: "var(--ok)", fontSize: 13 }}>{success}</div>}

      <div style={{ marginTop: 16, display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
          From Year
          <input type="number" value={fromYear} onChange={(e) => setFromYear(Number(e.target.value))} style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 10px", fontSize: 14, width: 100 }} />
        </label>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13, color: "var(--ink-2)" }}>
          To Year
          <input type="number" value={toYear} onChange={(e) => setToYear(Number(e.target.value))} style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "8px 10px", fontSize: 14, width: 100 }} />
        </label>
        <button onClick={() => void handlePreview()} disabled={loading} style={{ background: "transparent", border: "1px solid var(--pu)", borderRadius: 10, padding: "9px 18px", fontSize: 13, cursor: "pointer", color: "var(--pu)" }}>
          {loading ? "…" : "Preview"}
        </button>
        {rows && rows.length > 0 && (
          <button onClick={() => void handleRun()} disabled={loading} style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: loading ? "default" : "pointer" }}>
            {loading ? "…" : "Run Carry-Forward"}
          </button>
        )}
      </div>

      {rows && (
        <div style={{ marginTop: 16 }}>
          {rows.length === 0 ? (
            <div style={{ color: "var(--ink-2)", fontSize: 13 }}>No carry-forward-eligible balances found for {fromYear}.</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ textAlign: "left", color: "var(--ink-2)", borderBottom: "1px solid var(--bd)" }}>
                  <th style={{ padding: "6px" }}>Staff</th>
                  <th style={{ padding: "6px" }}>Leave Type</th>
                  <th style={{ padding: "6px" }}>Carried Forward</th>
                  <th style={{ padding: "6px" }}>Note</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid var(--bd)" }}>
                    <td style={{ padding: "6px" }}>{r.staff_name}</td>
                    <td style={{ padding: "6px" }}>{r.leave_type_name}</td>
                    <td style={{ padding: "6px" }}>{r.carried_forward}</td>
                    <td style={{ padding: "6px", color: "var(--ink-2)" }}>{r.skipped_reason ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {history.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-1)", textTransform: "uppercase", letterSpacing: "0.03em" }}>Run History</h3>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
            {history.map((h) => (
              <div key={h.id} style={{ display: "flex", justifyContent: "space-between", fontSize: 13, color: "var(--ink-2)", padding: "6px 0", borderBottom: "1px solid var(--bd)" }}>
                <span>{h.from_year} → {h.to_year} by {h.executed_by_name}</span>
                <span>{h.total_processed} processed · {h.total_skipped} skipped · {h.total_failed} failed</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
