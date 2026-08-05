"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck, KeyRound, Mail, Send, ClipboardCheck, Pencil, Trash2, Plus, ChevronLeft, ChevronRight,
  CheckCircle2, Loader2, AlertTriangle, Sparkles, History as HistoryIcon, CircleOff, Server, Star,
} from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { extractListData, type ListApiResponse } from "@/lib/pagination";
import { useUnsavedChangesGuard } from "@/contexts/UnsavedChangesContext";

interface SmtpConfig {
  id: number;
  name: string;
  smtp_type: "local" | "server";
  host: string;
  port: number;
  username: string;
  password_display: string;
  use_tls: boolean;
  from_email: string;
  bcc_email: string;
  sender_name: string;
  priority: "normal" | "high" | "low";
  receiver_email_type: "email_id" | "personal_email_id";
  is_active: boolean;
}

interface AuditEntry {
  id: number;
  actor_name: string;
  action: string;
  created_at: string;
}

type SmtpDraft = Omit<SmtpConfig, "id" | "password_display" | "is_active"> & { password: string };

const WIZARD_DEFAULTS: SmtpDraft = {
  name: "", smtp_type: "server", host: "", port: 587, username: "", password: "", use_tls: true,
  from_email: "", bcc_email: "", sender_name: "", priority: "normal", receiver_email_type: "email_id",
};

const WIZARD_STEPS: Array<{ label: string; icon: typeof BadgeCheck }> = [
  { label: "Basics", icon: BadgeCheck },
  { label: "Authentication", icon: KeyRound },
  { label: "Sender Identity", icon: Mail },
  { label: "Delivery", icon: Send },
  { label: "Test & Review", icon: ClipboardCheck },
];

const inputStyle = { border: "1px solid var(--bd-2)", borderRadius: 10, padding: "9px 11px", fontSize: 14, background: "var(--bg-1)", color: "var(--ink-1)", width: "100%" } as const;
const labelStyle = { display: "flex", flexDirection: "column" as const, gap: 6, fontSize: 12.5, fontWeight: 600, color: "var(--ink-2)" };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

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
      className="smtp-icon-btn"
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

export function SmtpSettingsPanel() {
  const [configs, setConfigs] = useState<SmtpConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<SmtpDraft>(WIZARD_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testSending, setTestSending] = useState(false);
  const openSnapshotRef = useRef<SmtpDraft>(WIZARD_DEFAULTS);

  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequestWithRefresh<ListApiResponse<SmtpConfig>>("/api/v1/settings/smtp/");
      setConfigs(extractListData(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load SMTP settings.");
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
    setTestEmail("");
    setWizardOpen(true);
  };

  const startEdit = (config: SmtpConfig) => {
    setEditingId(config.id);
    const snapshot = { ...WIZARD_DEFAULTS, ...config, password: "" };
    setDraft(snapshot);
    openSnapshotRef.current = snapshot;
    setWizardStep(0);
    setTestEmail("");
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setEditingId(null);
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload: Record<string, unknown> = { ...draft };
      if (!draft.password) delete payload.password;
      if (editingId) {
        const updated = await apiRequestWithRefresh<SmtpConfig>(`/api/v1/settings/smtp/${editingId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setConfigs((prev) => prev.map((c) => (c.id === editingId ? updated : c)));
        setSuccess("SMTP config updated.");
      } else {
        const created = await apiRequestWithRefresh<SmtpConfig>("/api/v1/settings/smtp/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setConfigs((prev) => [...prev, created]);
        setSuccess("SMTP config added.");
      }
      closeWizard();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save SMTP config.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const isDirty = wizardOpen && JSON.stringify(draft) !== JSON.stringify(openSnapshotRef.current);
  useUnsavedChangesGuard(isDirty, () => handleSubmit());

  const handleActivate = async (id: number) => {
    setBusyId(id);
    setError(null);
    try {
      await apiRequestWithRefresh(`/api/v1/settings/smtp/${id}/activate/`, { method: "POST" });
      setSuccess("Activated.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to activate.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (config: SmtpConfig) => {
    if (!confirm(`Delete "${config.name}"?`)) return;
    setBusyId(config.id);
    setError(null);
    try {
      await apiRequestWithRefresh(`/api/v1/settings/smtp/${config.id}/`, { method: "DELETE" });
      setConfigs((prev) => prev.filter((c) => c.id !== config.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setBusyId(null);
    }
  };

  const handleTestSend = async () => {
    setTestSending(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequestWithRefresh("/api/v1/settings/smtp/test_send/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...draft, to_email: testEmail || undefined }),
      });
      setSuccess("Test email sent.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send test email.");
    } finally {
      setTestSending(false);
    }
  };

  const toggleHistory = async (config: SmtpConfig) => {
    if (historyOpenId === config.id) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(config.id);
    setHistoryLoading(true);
    try {
      const data = await apiRequestWithRefresh<ListApiResponse<AuditEntry>>(
        `/api/v1/settings/audit-log/?module=SchoolSMTPSettings&object_id=${config.id}`
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
            SMTP{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>
              Settings
            </em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
            Configure the mail server used to send messages and emails through the ERP. Only one config can be active at a time.
          </p>
        </div>
        {!loading && configs.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--pu-tint)", color: "var(--pu)", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
            <Sparkles size={12} strokeWidth={2.5} />
            {configs.length} {configs.length === 1 ? "config" : "configs"}
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
          <Loader2 size={16} className="smtp-spin" /> Loading SMTP settings…
        </div>
      )}

      {!loading && !wizardOpen && configs.length === 0 && (
        <div style={{ marginTop: 24, border: "1px dashed var(--bd-3)", borderRadius: 14, padding: "34px 24px", textAlign: "center", background: "radial-gradient(circle at 50% 0%, var(--pu-tint), transparent 70%)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--pu-tint)", color: "var(--pu)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <Server size={21} strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-1)", margin: "0 0 6px" }}>Set up your first mail server</h2>
          <p style={{ margin: "0 auto 18px", maxWidth: 420, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
            A short guided setup — connection, authentication, sender identity, and delivery options, with a test send before you commit.
          </p>
          <button className="smtp-primary-btn" onClick={startCreate} style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} strokeWidth={2.5} /> Start Setup
          </button>
        </div>
      )}

      {!loading && !wizardOpen && configs.length > 0 && (
        <>
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 12 }}>
            {configs.map((c) => (
              <div key={c.id} style={{ position: "relative", borderRadius: 13, padding: "14px 16px 12px 18px", background: c.is_active ? "linear-gradient(135deg, var(--pu-tint) 0%, var(--bg-1) 45%)" : "var(--bg-1)", border: `1px solid ${c.is_active ? "var(--pu-soft)" : "var(--bd)"}`, boxShadow: "var(--sh-1)", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: c.is_active ? "var(--pu)" : "var(--bd-3)" }} />

                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: c.is_active ? "var(--pu)" : "var(--bg-2)", color: c.is_active ? "#fff" : "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <Server size={15} strokeWidth={2} />
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
                        <strong style={{ color: "var(--ink-1)", fontSize: 14, fontWeight: 700 }}>{c.name}</strong>
                        {c.is_active && (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontSize: 9.5, color: "var(--ok)", background: "var(--ok-soft)", fontWeight: 700, borderRadius: 999, padding: "2px 7px", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                            <Star size={9} fill="var(--ok)" strokeWidth={0} /> Active
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{c.host}:{c.port} · {c.from_email}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    {!c.is_active && (
                      <IconButton icon={Star} label="Activate" tone="ok" onClick={() => void handleActivate(c.id)} disabled={busyId === c.id} />
                    )}
                    <IconButton icon={Pencil} label="Edit" tone="purple" onClick={() => startEdit(c)} />
                    <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => void handleDelete(c)} disabled={busyId === c.id} />
                  </div>
                </div>

                <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 8 }}>
                  <StatTile icon={Server} tone="purple" label="Type" value={c.smtp_type === "server" ? "Server" : "Local"} />
                  <StatTile icon={KeyRound} tone="blue" label="Security" value={c.use_tls ? "TLS" : "None"} />
                  <StatTile icon={Send} tone="amber" label="Priority" value={c.priority[0].toUpperCase() + c.priority.slice(1)} />
                  <StatTile icon={Mail} tone="rose" label="Sender" value={c.sender_name || c.from_email || "—"} />
                </div>

                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button className="smtp-link-btn" onClick={() => void toggleHistory(c)} style={{ background: "none", border: "none", padding: 0, fontSize: 11, fontWeight: 600, color: "var(--pu)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <HistoryIcon size={12} /> {historyOpenId === c.id ? "Hide history" : "View history"}
                  </button>
                </div>

                {historyOpenId === c.id && (
                  <div style={{ marginTop: 8, borderTop: "1px solid var(--bd)", paddingTop: 9 }}>
                    {historyLoading && (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-2)" }}>
                        <Loader2 size={12} className="smtp-spin" /> Loading…
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

          <button className="smtp-primary-btn" onClick={startCreate} style={{ marginTop: 16, background: "var(--pu)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} strokeWidth={2.5} /> Add Another Config
          </button>
        </>
      )}

      {wizardOpen && (
        <SmtpWizard
          draft={draft}
          setDraft={setDraft}
          step={wizardStep}
          setStep={setWizardStep}
          isEditing={editingId !== null}
          saving={saving}
          testEmail={testEmail}
          setTestEmail={setTestEmail}
          testSending={testSending}
          onTestSend={() => void handleTestSend()}
          onCancel={closeWizard}
          onSubmit={() => void handleSubmit().catch(() => {})}
        />
      )}

      <style jsx>{`
        .smtp-icon-btn:hover:not(:disabled) { background: var(--bg-2); border-color: var(--bd-3); }
        .smtp-primary-btn:hover { background: var(--pu-deep); }
        .smtp-link-btn:hover { text-decoration: underline; }
        .smtp-spin { animation: smtp-rotate 0.8s linear infinite; }
        @keyframes smtp-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function SmtpWizard({
  draft, setDraft, step, setStep, isEditing, saving, testEmail, setTestEmail, testSending, onTestSend, onCancel, onSubmit,
}: {
  draft: SmtpDraft;
  setDraft: React.Dispatch<React.SetStateAction<SmtpDraft>>;
  step: number;
  setStep: (n: number) => void;
  isEditing: boolean;
  saving: boolean;
  testEmail: string;
  setTestEmail: (v: string) => void;
  testSending: boolean;
  onTestSend: () => void;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const set = <K extends keyof SmtpDraft>(key: K, value: SmtpDraft[K]) => setDraft((d) => ({ ...d, [key]: value }));

  const hasBasics = Boolean(draft.name.trim() && draft.host.trim());
  const canGoNext = step === 0 ? hasBasics : true;
  const canJumpTo = (target: number) => isEditing || target === 0 || hasBasics;

  return (
    <div style={{ marginTop: 20, border: "1px solid var(--bd)", borderRadius: 14, padding: "22px 24px", background: "var(--bg-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 22 }}>
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
                    width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: isActive ? "var(--pu)" : isDone ? "var(--pu-tint)" : "var(--bg-2)",
                    color: isActive ? "#fff" : isDone ? "var(--pu)" : "var(--ink-3)",
                    border: isActive ? "none" : `1px solid ${isDone ? "var(--pu-soft)" : "var(--bd-2)"}`,
                    transition: "all 0.15s ease", flexShrink: 0,
                  }}
                >
                  {isDone ? <CheckCircle2 size={16} strokeWidth={2.5} /> : <StepIcon size={15} strokeWidth={2.25} />}
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: isActive ? "var(--pu)" : "var(--ink-3)", textAlign: "center", whiteSpace: "nowrap" }}>
                  {s.label}
                </span>
              </div>
              {i < WIZARD_STEPS.length - 1 && (
                <div style={{ flex: 1, height: 2, background: isDone ? "var(--pu-soft)" : "var(--bd)", margin: "0 4px 18px" }} />
              )}
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 18 }}>
          <label style={labelStyle}>
            Config Name
            <input value={draft.name} onChange={(e) => set("name", e.target.value)} style={inputStyle} autoFocus />
          </label>
          <label style={labelStyle}>
            Type
            <select value={draft.smtp_type} onChange={(e) => set("smtp_type", e.target.value as SmtpDraft["smtp_type"])} style={inputStyle}>
              <option value="server">Server</option>
              <option value="local">Local</option>
            </select>
          </label>
          <label style={labelStyle}>
            Host
            <input value={draft.host} onChange={(e) => set("host", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Port
            <input type="number" value={draft.port} onChange={(e) => set("port", Number(e.target.value))} style={inputStyle} />
          </label>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 18 }}>
          <label style={labelStyle}>
            Username
            <input value={draft.username} onChange={(e) => set("username", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Password {isEditing && <span style={{ fontWeight: 400 }}>(leave blank to keep current)</span>}
            <input type="password" value={draft.password} onChange={(e) => set("password", e.target.value)} style={inputStyle} />
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, fontWeight: 600, color: "var(--ink-2)", gridColumn: "1 / -1", background: "var(--bg-2)", borderRadius: 10, padding: "12px 14px" }}>
            <input type="checkbox" checked={draft.use_tls} onChange={(e) => set("use_tls", e.target.checked)} />
            Use TLS
          </label>
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 18 }}>
          <label style={labelStyle}>
            From Email
            <input value={draft.from_email} onChange={(e) => set("from_email", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            BCC Email
            <input value={draft.bcc_email} onChange={(e) => set("bcc_email", e.target.value)} style={inputStyle} />
          </label>
          <label style={labelStyle}>
            Sender Name
            <input value={draft.sender_name} onChange={(e) => set("sender_name", e.target.value)} style={inputStyle} />
          </label>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 18 }}>
          <label style={labelStyle}>
            Priority
            <select value={draft.priority} onChange={(e) => set("priority", e.target.value as SmtpDraft["priority"])} style={inputStyle}>
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
          </label>
          <label style={labelStyle}>
            Receiver Email Type
            <select value={draft.receiver_email_type} onChange={(e) => set("receiver_email_type", e.target.value as SmtpDraft["receiver_email_type"])} style={inputStyle}>
              <option value="email_id">Official Email ID</option>
              <option value="personal_email_id">Personal Email ID</option>
            </select>
          </label>
        </div>
      )}

      {step === 4 && (
        <div>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <ClipboardCheck size={15} /> Review, and optionally send a test email before saving:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 20 }}>
            <StatTile icon={BadgeCheck} tone="purple" label="Name" value={draft.name || "—"} />
            <StatTile icon={Server} tone="purple" label="Connection" value={`${draft.host || "—"}:${draft.port}`} />
            <StatTile icon={KeyRound} tone="blue" label="Security" value={draft.use_tls ? "TLS" : "None"} />
            <StatTile icon={Mail} tone="rose" label="Sender" value={draft.sender_name || draft.from_email || "—"} />
            <StatTile icon={Send} tone="amber" label="Priority" value={draft.priority[0].toUpperCase() + draft.priority.slice(1)} />
          </div>
          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", background: "var(--bg-2)", borderRadius: 10, padding: "12px 14px" }}>
            <input placeholder="Send test to (default: you)" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} style={{ ...inputStyle, width: "auto", flex: "1 1 220px" }} />
            <button onClick={onTestSend} disabled={testSending} style={{ background: "transparent", border: "1px solid var(--pu)", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: testSending ? "default" : "pointer", color: "var(--pu)" }}>
              {testSending ? "Sending…" : "Send Test Email"}
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--bd)", paddingTop: 20 }}>
        <div>
          {step > 0 && (
            <button className="smtp-icon-btn" onClick={() => setStep(step - 1)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-1)", border: "1px solid var(--bd-2)", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink-2)" }}>
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
              {saving ? (<><Loader2 size={15} className="smtp-spin" /> Saving…</>) : (<><CheckCircle2 size={15} /> Save &amp; Exit</>)}
            </button>
          )}
          {step < WIZARD_STEPS.length - 1 ? (
            <button
              className="smtp-primary-btn"
              onClick={() => canGoNext && setStep(step + 1)}
              disabled={!canGoNext}
              style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: canGoNext ? "pointer" : "default", opacity: canGoNext ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              className="smtp-primary-btn"
              onClick={onSubmit}
              disabled={saving}
              style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {saving ? (<><Loader2 size={15} className="smtp-spin" /> Saving…</>) : isEditing ? (<><CheckCircle2 size={15} /> Save Changes</>) : (<><Plus size={15} /> Create Config</>)}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .smtp-icon-btn:hover:not(:disabled) { background: var(--bg-2); border-color: var(--bd-3); }
        .smtp-primary-btn:hover:not(:disabled) { background: var(--pu-deep); }
        .smtp-spin { animation: smtp-rotate 0.8s linear infinite; }
        @keyframes smtp-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
