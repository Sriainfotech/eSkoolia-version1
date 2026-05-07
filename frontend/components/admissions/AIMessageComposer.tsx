"use client";

import { useState } from "react";
import { X, Send, RefreshCw, AlertCircle } from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { Lead } from "./LeadCard";

type AIVariants = {
  variant_a: string;
  variant_b: string;
  prompt_used?: string;
};

type Props = {
  lead: Lead;
  channel?: "whatsapp" | "sms" | "email";
  onClose: () => void;
  onSent?: () => void;
};

export default function AIMessageComposer({ lead, channel = "whatsapp", onClose, onSent }: Props) {
  const [variants, setVariants] = useState<AIVariants | null>(null);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [chosen, setChosen] = useState<"a" | "b">("a");
  const [editedA, setEditedA] = useState("");
  const [editedB, setEditedB] = useState("");
  const [consent, setConsent] = useState(false);
  const [emailSubject, setEmailSubject] = useState(`Admission Inquiry — ${lead.full_name}`);

  const generate = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await apiRequestWithRefresh("/api/v1/admissions/ai/generate/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lead_id: lead.id }),
      }) as Response;
      if (!res.ok) throw new Error("Failed to generate variants");
      const json = await res.json();
      const data: AIVariants = json.data ?? json;
      setVariants(data);
      setEditedA(data.variant_a);
      setEditedB(data.variant_b);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Generation failed");
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!consent) {
      setError("You must confirm consent before sending.");
      return;
    }
    const text = chosen === "a" ? editedA : editedB;
    setSending(true);
    setError("");
    const urlMap: Record<string, string> = {
      whatsapp: `/api/v1/admissions/inquiries/${lead.id}/actions/whatsapp/`,
      sms: `/api/v1/admissions/inquiries/${lead.id}/actions/sms/`,
      email: `/api/v1/admissions/inquiries/${lead.id}/actions/email/`,
    };
    try {
      const body: Record<string, string> =
        channel === "email"
          ? { subject: emailSubject, body: text }
          : { text };
      const res = await apiRequestWithRefresh(urlMap[channel], {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }) as Response;
      if (!res.ok) throw new Error("Send failed");
      onSent?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Send failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="AI Message Composer"
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
          borderRadius: 12,
          border: "1px solid var(--line)",
          width: "100%",
          maxWidth: 760,
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
            AI Message Composer — {channel.charAt(0).toUpperCase() + channel.slice(1)}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--muted)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <X size={20} />
          </button>
        </div>

        <p style={{ margin: 0, fontSize: 13, color: "var(--muted)" }}>
          Recipient: <b style={{ color: "var(--text)" }}>{lead.full_name}</b>{" "}
          {lead.phone && `· ${lead.phone}`}
        </p>

        {channel === "email" && (
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>Subject</label>
            <input
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
              style={{
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "6px 10px",
                fontSize: 13,
                color: "var(--text)",
                background: "var(--bg)",
              }}
            />
          </div>
        )}

        {/* Generate button */}
        {!variants ? (
          <button
            onClick={generate}
            disabled={loading}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "10px 20px",
              fontSize: 14,
              fontWeight: 600,
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.7 : 1,
            }}
          >
            <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
            {loading ? "Generating…" : "Generate AI Variants"}
          </button>
        ) : (
          <>
            {/* Side-by-side variants */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 12,
              }}
            >
              {(["a", "b"] as const).map((v) => (
                <div
                  key={v}
                  onClick={() => setChosen(v)}
                  style={{
                    border: `2px solid ${chosen === v ? "var(--accent)" : "var(--line)"}`,
                    borderRadius: 8,
                    padding: 12,
                    cursor: "pointer",
                    background: chosen === v ? "var(--accent)0D" : "var(--bg)",
                  }}
                  role="radio"
                  aria-checked={chosen === v}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === "Enter" && setChosen(v)}
                >
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", marginBottom: 6 }}>
                    Variant {v.toUpperCase()} — {v === "a" ? "Formal" : "Friendly"}
                  </div>
                  <textarea
                    value={v === "a" ? editedA : editedB}
                    onChange={(e) => v === "a" ? setEditedA(e.target.value) : setEditedB(e.target.value)}
                    rows={5}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: "100%",
                      border: "1px solid var(--line)",
                      borderRadius: 6,
                      padding: "6px 8px",
                      fontSize: 13,
                      color: "var(--text)",
                      background: "var(--surface)",
                      resize: "vertical",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={generate}
              disabled={loading}
              style={{
                alignSelf: "flex-start",
                display: "flex",
                alignItems: "center",
                gap: 6,
                background: "none",
                border: "1px solid var(--line)",
                borderRadius: 6,
                padding: "5px 12px",
                fontSize: 12,
                cursor: "pointer",
                color: "var(--muted)",
              }}
            >
              <RefreshCw size={13} />
              Regenerate
            </button>
          </>
        )}

        {/* Consent */}
        <label
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: 8,
            fontSize: 12,
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            style={{ marginTop: 2, accentColor: "var(--accent)" }}
          />
          I confirm that the recipient has provided consent to receive messages on this channel.
        </label>

        {error && (
          <div
            role="alert"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13,
              color: "#ef4444",
            }}
          >
            <AlertCircle size={14} />
            {error}
          </div>
        )}

        {/* Footer */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "1px solid var(--line)",
              borderRadius: 8,
              padding: "8px 18px",
              fontSize: 13,
              cursor: "pointer",
              color: "var(--muted)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={send}
            disabled={!variants || sending}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              background: "var(--accent)",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "8px 20px",
              fontSize: 13,
              fontWeight: 600,
              cursor: !variants || sending ? "not-allowed" : "pointer",
              opacity: !variants || sending ? 0.7 : 1,
            }}
          >
            <Send size={14} />
            {sending ? "Sending…" : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
}
