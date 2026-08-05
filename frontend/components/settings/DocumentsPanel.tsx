"use client";

import { useEffect, useRef, useState } from "react";
import {
  BadgeCheck, UploadCloud, ClipboardCheck, Pencil, Trash2, Plus, ChevronLeft, ChevronRight,
  CheckCircle2, Loader2, AlertTriangle, Sparkles, History as HistoryIcon, FileText, Eye,
} from "lucide-react";
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from "@/lib/api-auth";
import { extractListData, type ListApiResponse } from "@/lib/pagination";
import { useUnsavedChangesGuard } from "@/contexts/UnsavedChangesContext";

interface PolicyDocument {
  id: number;
  title: string;
  category: "code_of_conduct" | "rulebook" | "norms" | "other";
  file: string;
  file_name: string;
  file_type: string;
  file_size: number;
  uploaded_at: string;
}

interface AuditEntry {
  id: number;
  actor_name: string;
  action: string;
  created_at: string;
}

const CATEGORY_LABELS: Record<PolicyDocument["category"], string> = {
  code_of_conduct: "Code of Conduct",
  rulebook: "Rule Book",
  norms: "School Norms",
  other: "Other",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

const CREATE_STEPS: Array<{ label: string; icon: typeof BadgeCheck }> = [
  { label: "Details", icon: BadgeCheck },
  { label: "Upload", icon: UploadCloud },
  { label: "Review", icon: ClipboardCheck },
];
const EDIT_STEPS: Array<{ label: string; icon: typeof BadgeCheck }> = [
  { label: "Details", icon: BadgeCheck },
  { label: "Review", icon: ClipboardCheck },
];

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
      className="doc-icon-btn"
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

export function DocumentsPanel() {
  const [docs, setDocs] = useState<PolicyDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filterCategory, setFilterCategory] = useState("");

  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const [editingDoc, setEditingDoc] = useState<PolicyDocument | null>(null);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<PolicyDocument["category"]>("other");
  const [file, setFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);

  const [historyOpenId, setHistoryOpenId] = useState<number | null>(null);
  const [history, setHistory] = useState<AuditEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  const load = async (categoryFilter = filterCategory) => {
    setLoading(true);
    setError(null);
    try {
      const query = categoryFilter ? `?category=${categoryFilter}` : "";
      const data = await apiRequestWithRefresh<ListApiResponse<PolicyDocument>>(`/api/v1/settings/documents/${query}`);
      setDocs(extractListData(data));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load documents.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCreate = () => {
    setEditingDoc(null);
    setTitle("");
    setCategory("other");
    setFile(null);
    if (fileRef.current) fileRef.current.value = "";
    setWizardStep(0);
    setWizardOpen(true);
  };

  const startEdit = (doc: PolicyDocument) => {
    setEditingDoc(doc);
    setTitle(doc.title);
    setCategory(doc.category);
    setFile(null);
    setWizardStep(0);
    setWizardOpen(true);
  };

  const closeWizard = () => {
    setWizardOpen(false);
    setEditingDoc(null);
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      setError("Title is required.");
      throw new Error("Title is required.");
    }
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingDoc) {
        await apiRequestWithRefresh(`/api/v1/settings/documents/${editingDoc.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, category }),
        });
        setSuccess("Document updated.");
      } else {
        if (!file) {
          setError("A file is required.");
          setSaving(false);
          throw new Error("A file is required.");
        }
        const formData = new FormData();
        formData.append("title", title);
        formData.append("category", category);
        formData.append("file", file);
        await apiRequestWithRefresh("/api/v1/settings/documents/", { method: "POST", body: formData });
        setSuccess("Document uploaded.");
      }
      closeWizard();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save document.");
      throw err;
    } finally {
      setSaving(false);
    }
  };

  const isDirty = wizardOpen && (
    title !== (editingDoc?.title ?? "") ||
    category !== (editingDoc?.category ?? "other") ||
    file !== null
  );
  useUnsavedChangesGuard(isDirty, () => handleSubmit());

  const handleView = async (doc: PolicyDocument) => {
    setError(null);
    try {
      // doc.file is served by the authenticated media proxy (serve_media) —
      // a plain <a href> would carry no Authorization header (JWT lives in
      // localStorage, not a cookie), so fetch it as a blob instead.
      const path = new URL(doc.file, window.location.origin).pathname;
      const res = await apiRequestWithRefreshResponse(path);
      if (!res.ok) throw new Error(`Failed to open document (${res.status}).`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener,noreferrer");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to open document.");
    }
  };

  const handleDelete = async (doc: PolicyDocument) => {
    if (!confirm(`Delete "${doc.title}"?`)) return;
    setBusyId(doc.id);
    setError(null);
    try {
      await apiRequestWithRefresh(`/api/v1/settings/documents/${doc.id}/`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete document.");
    } finally {
      setBusyId(null);
    }
  };

  const toggleHistory = async (doc: PolicyDocument) => {
    if (historyOpenId === doc.id) {
      setHistoryOpenId(null);
      return;
    }
    setHistoryOpenId(doc.id);
    setHistoryLoading(true);
    try {
      const data = await apiRequestWithRefresh<ListApiResponse<AuditEntry>>(
        `/api/v1/settings/audit-log/?module=SchoolPolicyDocument&object_id=${doc.id}`
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
            Policy{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>
              Documents
            </em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55, maxWidth: 560 }}>
            Code of conduct, rule books, and school norms for staff. Visible on every staff member&apos;s profile.
          </p>
        </div>
        {!loading && docs.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--pu-tint)", color: "var(--pu)", borderRadius: 999, padding: "6px 12px", fontSize: 11.5, fontWeight: 700, flexShrink: 0 }}>
            <Sparkles size={12} strokeWidth={2.5} />
            {docs.length} {docs.length === 1 ? "document" : "documents"}
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
          <Loader2 size={16} className="doc-spin" /> Loading documents…
        </div>
      )}

      {!loading && !wizardOpen && (
        <div style={{ marginTop: 20, display: "flex", gap: 10, alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--ink-2)" }}>
            Filter by category
            <select
              value={filterCategory}
              onChange={(e) => { setFilterCategory(e.target.value); void load(e.target.value); }}
              style={{ border: "1px solid var(--bd)", borderRadius: 10, padding: "6px 10px", fontSize: 13 }}
            >
              <option value="">All</option>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
        </div>
      )}

      {!loading && !wizardOpen && docs.length === 0 && (
        <div style={{ marginTop: 24, border: "1px dashed var(--bd-3)", borderRadius: 14, padding: "34px 24px", textAlign: "center", background: "radial-gradient(circle at 50% 0%, var(--pu-tint), transparent 70%)" }}>
          <div style={{ width: 44, height: 44, borderRadius: 13, background: "var(--pu-tint)", color: "var(--pu)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 14px" }}>
            <FileText size={21} strokeWidth={2} />
          </div>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: "var(--ink-1)", margin: "0 0 6px" }}>Upload your first policy document</h2>
          <p style={{ margin: "0 auto 18px", maxWidth: 420, fontSize: 12.5, color: "var(--ink-2)", lineHeight: 1.6 }}>
            Code of conduct, rule book, or school norms — a short guided upload, then visible on every staff profile.
          </p>
          <button className="doc-primary-btn" onClick={startCreate} style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} strokeWidth={2.5} /> Upload Document
          </button>
        </div>
      )}

      {!loading && !wizardOpen && docs.length > 0 && (
        <>
          <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
            {docs.map((doc) => (
              <div key={doc.id} style={{ position: "relative", borderRadius: 13, padding: "13px 16px 11px 18px", background: "var(--bg-1)", border: "1px solid var(--bd)", boxShadow: "var(--sh-1)", overflow: "hidden" }}>
                <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3, background: "var(--pu)" }} />
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <div style={{ flexShrink: 0, width: 32, height: 32, borderRadius: 9, background: "var(--bg-2)", color: "var(--ink-2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <FileText size={15} strokeWidth={2} />
                    </div>
                    <div>
                      <strong style={{ color: "var(--ink-1)", fontSize: 14, fontWeight: 700 }}>{doc.title}</strong>
                      <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>
                        {CATEGORY_LABELS[doc.category]}{doc.file_type ? ` · ${doc.file_type}` : ""} · {formatSize(doc.file_size)} · {formatDate(doc.uploaded_at)}
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                    <IconButton icon={Eye} label="View" tone="neutral" onClick={() => void handleView(doc)} />
                    <IconButton icon={Pencil} label="Edit" tone="purple" onClick={() => startEdit(doc)} />
                    <IconButton icon={Trash2} label="Delete" tone="danger" onClick={() => void handleDelete(doc)} disabled={busyId === doc.id} />
                  </div>
                </div>

                <div style={{ marginTop: 8, display: "flex", justifyContent: "flex-end" }}>
                  <button className="doc-link-btn" onClick={() => void toggleHistory(doc)} style={{ background: "none", border: "none", padding: 0, fontSize: 11, fontWeight: 600, color: "var(--pu)", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}>
                    <HistoryIcon size={12} /> {historyOpenId === doc.id ? "Hide history" : "View history"}
                  </button>
                </div>

                {historyOpenId === doc.id && (
                  <div style={{ marginTop: 8, borderTop: "1px solid var(--bd)", paddingTop: 9 }}>
                    {historyLoading && (
                      <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--ink-2)" }}>
                        <Loader2 size={12} className="doc-spin" /> Loading…
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

          <button className="doc-primary-btn" onClick={startCreate} style={{ marginTop: 16, background: "var(--pu)", color: "#fff", border: "none", borderRadius: 9, padding: "9px 16px", fontSize: 12.5, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Plus size={14} strokeWidth={2.5} /> Upload Another Document
          </button>
        </>
      )}

      {wizardOpen && (
        <DocumentWizard
          isEditing={editingDoc !== null}
          step={wizardStep}
          setStep={setWizardStep}
          title={title}
          setTitle={setTitle}
          category={category}
          setCategory={setCategory}
          file={file}
          setFile={setFile}
          fileRef={fileRef}
          existingFileName={editingDoc?.file_name}
          saving={saving}
          onCancel={closeWizard}
          onSubmit={() => void handleSubmit().catch(() => {})}
        />
      )}

      <style jsx>{`
        .doc-icon-btn:hover:not(:disabled) { background: var(--bg-2); border-color: var(--bd-3); }
        .doc-primary-btn:hover { background: var(--pu-deep); }
        .doc-link-btn:hover { text-decoration: underline; }
        .doc-spin { animation: doc-rotate 0.8s linear infinite; }
        @keyframes doc-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

function DocumentWizard({
  isEditing, step, setStep, title, setTitle, category, setCategory, file, setFile, fileRef, existingFileName, saving, onCancel, onSubmit,
}: {
  isEditing: boolean;
  step: number;
  setStep: (n: number) => void;
  title: string;
  setTitle: (v: string) => void;
  category: PolicyDocument["category"];
  setCategory: (v: PolicyDocument["category"]) => void;
  file: File | null;
  setFile: (f: File | null) => void;
  fileRef: React.RefObject<HTMLInputElement>;
  existingFileName?: string;
  saving: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const steps = isEditing ? EDIT_STEPS : CREATE_STEPS;
  const uploadStepIndex = isEditing ? -1 : 1;
  const reviewStepIndex = steps.length - 1;

  const hasTitle = Boolean(title.trim());
  const canGoNext = step === 0 ? hasTitle : step === uploadStepIndex ? Boolean(file) : true;
  const canJumpTo = (target: number) => isEditing || target === 0 || hasTitle;

  return (
    <div style={{ marginTop: 20, border: "1px solid var(--bd)", borderRadius: 14, padding: "22px 24px", background: "var(--bg-1)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 22 }}>
        {steps.map((s, i) => {
          const StepIcon = s.icon;
          const isDone = i < step;
          const isActive = i === step;
          const jumpable = canJumpTo(i) && i !== step;
          return (
            <div key={s.label} style={{ display: "flex", alignItems: "center", flex: i < steps.length - 1 ? 1 : "0 0 auto" }}>
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
              {i < steps.length - 1 && (
                <div style={{ flex: 1, height: 2, background: isDone ? "var(--pu-soft)" : "var(--bd)", margin: "0 4px 18px" }} />
              )}
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0,1fr))", gap: 18 }}>
          <label style={labelStyle}>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} autoFocus />
          </label>
          <label style={labelStyle}>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value as PolicyDocument["category"])} style={inputStyle}>
              {Object.entries(CATEGORY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          {isEditing && existingFileName && (
            <div style={{ gridColumn: "1 / -1", fontSize: 12, color: "var(--ink-3)", background: "var(--bg-2)", borderRadius: 10, padding: "10px 12px" }}>
              File stays as-is when editing: <strong style={{ color: "var(--ink-2)" }}>{existingFileName}</strong>. Delete and re-upload to replace the file itself.
            </div>
          )}
        </div>
      )}

      {step === uploadStepIndex && (
        <div>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 14px" }}>PDF, JPEG or PNG, up to 25MB.</p>
          <label style={{ ...labelStyle, display: "flex", flexDirection: "column", gap: 8 }}>
            File
            <input
              ref={fileRef}
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 13 }}
            />
          </label>
          {file && (
            <div style={{ marginTop: 12, fontSize: 12, color: "var(--ink-2)", background: "var(--bg-2)", borderRadius: 10, padding: "10px 12px" }}>
              Selected: <strong style={{ color: "var(--ink-1)" }}>{file.name}</strong> ({formatSize(file.size)})
            </div>
          )}
        </div>
      )}

      {step === reviewStepIndex && (
        <div>
          <p style={{ fontSize: 13, color: "var(--ink-2)", margin: "0 0 16px", display: "flex", alignItems: "center", gap: 8 }}>
            <ClipboardCheck size={15} /> Review before saving:
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10 }}>
            <StatTile icon={BadgeCheck} tone="purple" label="Title" value={title || "—"} />
            <StatTile icon={FileText} tone="blue" label="Category" value={CATEGORY_LABELS[category]} />
            <StatTile icon={UploadCloud} tone="amber" label="File" value={isEditing ? (existingFileName ?? "unchanged") : file ? file.name : "—"} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 26, display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--bd)", paddingTop: 20 }}>
        <div>
          {step > 0 && (
            <button className="doc-icon-btn" onClick={() => setStep(step - 1)} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--bg-1)", border: "1px solid var(--bd-2)", borderRadius: 10, padding: "9px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink-2)" }}>
              <ChevronLeft size={15} /> Back
            </button>
          )}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button onClick={onCancel} style={{ background: "transparent", border: "1px solid var(--bd-2)", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "var(--ink-2)" }}>
            Cancel
          </button>
          {isEditing && step < steps.length - 1 && (
            <button
              onClick={onSubmit}
              disabled={saving}
              style={{ background: "var(--bg-1)", color: "var(--pu)", border: "1px solid var(--pu-soft)", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {saving ? (<><Loader2 size={15} className="doc-spin" /> Saving…</>) : (<><CheckCircle2 size={15} /> Save &amp; Exit</>)}
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              className="doc-primary-btn"
              onClick={() => canGoNext && setStep(step + 1)}
              disabled={!canGoNext}
              style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: canGoNext ? "pointer" : "default", opacity: canGoNext ? 1 : 0.5, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              Next <ChevronRight size={15} />
            </button>
          ) : (
            <button
              className="doc-primary-btn"
              onClick={onSubmit}
              disabled={saving || (!isEditing && !file)}
              style={{ background: "var(--pu)", color: "#fff", border: "none", borderRadius: 10, padding: "9px 20px", fontSize: 13, fontWeight: 700, cursor: saving ? "default" : "pointer", opacity: saving ? 0.7 : 1, display: "inline-flex", alignItems: "center", gap: 6 }}
            >
              {saving ? (<><Loader2 size={15} className="doc-spin" /> Saving…</>) : isEditing ? (<><CheckCircle2 size={15} /> Save Changes</>) : (<><Plus size={15} /> Upload</>)}
            </button>
          )}
        </div>
      </div>

      <style jsx>{`
        .doc-icon-btn:hover:not(:disabled) { background: var(--bg-2); border-color: var(--bd-3); }
        .doc-primary-btn:hover:not(:disabled) { background: var(--pu-deep); }
        .doc-spin { animation: doc-rotate 0.8s linear infinite; }
        @keyframes doc-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
