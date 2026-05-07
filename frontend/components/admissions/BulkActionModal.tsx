"use client";

import { useState, useEffect } from "react";
import { X, AlertCircle, CheckCircle, Loader } from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { Lead } from "./LeadCard";

type Action = "send_whatsapp" | "send_sms" | "send_email" | "assign" | "update_status" | "update_stage";

const ACTION_LABELS: Record<Action, string> = {
  send_whatsapp: "Send WhatsApp",
  send_sms: "Send SMS",
  send_email: "Send Email",
  assign: "Assign Counselor",
  update_status: "Update Status",
  update_stage: "Move Pipeline Stage",
};

type JobStatus = {
  status: "pending" | "running" | "done" | "failed";
  processed: number;
  failed: number;
  total: number;
  error_detail?: { lead_id: number; error: string }[];
};

type Props = {
  selectedLeads: Lead[];
  onClose: () => void;
  onDone?: () => void;
};

export default function BulkActionModal({ selectedLeads, onClose, onDone }: Props) {
  const [action, setAction] = useState<Action>("send_whatsapp");
  const [text, setText] = useState("");
  const [subject, setSubject] = useState("");
  const [assignee, setAssignee] = useState("");
  const [statusVal, setStatusVal] = useState("contacted");
  const [submitting, setSubmitting] = useState(false);
  const [jobId, setJobId] = useState<number | null>(null);
  const [jobStatus, setJobStatus] = useState<JobStatus | null>(null);
  const [error, setError] = useState("");

  // Poll for job progress
  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await apiRequestWithRefresh(`/api/v1/admissions/bulk/${jobId}/`);
        if (res.ok) {
          const json = await res.json();
          const data: JobStatus = json.data ?? json;
          setJobStatus(data);
          if (data.status === "done" || data.status === "failed") {
            clearInterval(interval);
          }
        }
      } catch {
        // keep polling
      }
    }, 2000);
    return () => clearInterval(interval);
  }, [jobId]);

  const buildPayload = () => {
    if (action === "send_whatsapp" || action === "send_sms") return { text };
    if (action === "send_email") return { subject, body: text };
    if (action === "assign") return { assigned: assignee };
    if (action === "update_status") return { status: statusVal };
    return {};
  };

  const submit = async () => {
    if (!selectedLeads.length) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await apiRequestWithRefresh("/api/v1/admissions/bulk/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          lead_ids: selectedLeads.map((l) => l.id),
          payload: buildPayload(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? "Failed to start job");
      setJobId(json.job_id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSubmitting(false);
    }
  };

  const done = jobStatus?.status === "done" || jobStatus?.status === "failed";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bulk Action"
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          border: "1px solid var(--line)",
          borderRadius: 12,
          width: "100%",
          maxWidth: 520,
          maxHeight: "90vh",
          overflowY: "auto",
          padding: 24,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--text)" }}>
            Bulk Action
          </h2>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--muted)" }}>
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          {selectedLeads.length} lead{selectedLeads.length !== 1 ? "s" : ""} selected
        </p>

        {!jobId && (
          <>
            {/* Action picker */}
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>Action</label>
              <select
                value={action}
                onChange={(e) => setAction(e.target.value as Action)}
                style={{
                  border: "1px solid var(--line)",
                  borderRadius: 6,
                  padding: "7px 10px",
                  fontSize: 13,
                  color: "var(--text)",
                  background: "var(--bg)",
                }}
              >
                {(Object.keys(ACTION_LABELS) as Action[]).map((a) => (
                  <option key={a} value={a}>{ACTION_LABELS[a]}</option>
                ))}
              </select>
            </div>

            {/* Dynamic fields */}
            {(action === "send_whatsapp" || action === "send_sms") && (
              <Textarea label="Message" value={text} onChange={setText} />
            )}
            {action === "send_email" && (
              <>
                <Field label="Subject" value={subject} onChange={setSubject} />
                <Textarea label="Body" value={text} onChange={setText} />
              </>
            )}
            {action === "assign" && (
              <Field label="Assign to (name/ID)" value={assignee} onChange={setAssignee} />
            )}
            {action === "update_status" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>New Status</label>
                <select
                  value={statusVal}
                  onChange={(e) => setStatusVal(e.target.value)}
                  style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "var(--text)", background: "var(--bg)" }}
                >
                  {["new", "contacted", "visited", "enrolled", "not_interested"].map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>
            )}

            {error && (
              <div role="alert" style={{ display: "flex", gap: 6, fontSize: 13, color: "#ef4444" }}>
                <AlertCircle size={14} /> {error}
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button onClick={onClose} style={{ background: "none", border: "1px solid var(--line)", borderRadius: 8, padding: "8px 18px", fontSize: 13, cursor: "pointer", color: "var(--muted)" }}>
                Cancel
              </button>
              <button
                onClick={submit}
                disabled={submitting}
                style={{ background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
              >
                {submitting ? "Starting…" : "Run Action"}
              </button>
            </div>
          </>
        )}

        {/* Progress */}
        {jobId && jobStatus && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {done ? (
                jobStatus.status === "done"
                  ? <CheckCircle size={20} color="#22c55e" />
                  : <AlertCircle size={20} color="#ef4444" />
              ) : (
                <Loader size={20} color="var(--accent)" style={{ animation: "spin 1s linear infinite" }} />
              )}
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {done ? (jobStatus.status === "done" ? "Completed" : "Finished with errors") : "Processing…"}
              </span>
            </div>

            {/* Progress bar */}
            <div style={{ background: "var(--line)", borderRadius: 8, height: 8, overflow: "hidden" }}>
              <div
                style={{
                  background: jobStatus.failed > 0 ? "#f59e0b" : "var(--accent)",
                  height: "100%",
                  width: `${jobStatus.total ? (jobStatus.processed / jobStatus.total) * 100 : 0}%`,
                  transition: "width 0.4s",
                }}
              />
            </div>

            <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
              {jobStatus.processed} / {jobStatus.total} processed · {jobStatus.failed} failed
            </p>

            {jobStatus.error_detail && jobStatus.error_detail.length > 0 && (
              <details style={{ fontSize: 12, color: "#ef4444" }}>
                <summary style={{ cursor: "pointer" }}>Show errors ({jobStatus.error_detail.length})</summary>
                <ul style={{ marginTop: 6, paddingLeft: 16 }}>
                  {jobStatus.error_detail.map((e, i) => (
                    <li key={i}>Lead #{e.lead_id}: {e.error}</li>
                  ))}
                </ul>
              </details>
            )}

            {done && (
              <button
                onClick={() => { onDone?.(); onClose(); }}
                style={{ alignSelf: "flex-end", background: "var(--accent)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
              >
                Done
              </button>
            )}
          </div>
        )}

        {jobId && !jobStatus && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--muted)", fontSize: 13 }}>
            <Loader size={16} color="var(--accent)" />
            Waiting for job to start…
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "var(--text)", background: "var(--bg)" }}
      />
    </div>
  );
}

function Textarea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>{label}</label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={4}
        style={{ border: "1px solid var(--line)", borderRadius: 6, padding: "7px 10px", fontSize: 13, color: "var(--text)", background: "var(--bg)", resize: "vertical" }}
      />
    </div>
  );
}
