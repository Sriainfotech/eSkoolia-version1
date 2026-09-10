"use client";

/**
 * ComposeParentMessageModal
 *
 * Recipient picker is simpler than the teacher-side version: a parent's
 * only safe scoped audience is their selected child's own teachers
 * (fetchChildTeachers), so there's no nested lookup — one call resolves
 * the whole list directly to portal user ids.
 */

import { useEffect, useState } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { fetchChildTeachers, sendParentMessage, type ChildTeacherItem, type InAppMessageItem } from "@/lib/api/parent";

interface ReplyTo { recipientId: number; recipientName: string; subject: string }

interface Props {
  childId: number;
  replyTo?: ReplyTo;
  onClose: () => void;
  onSent: (message: InAppMessageItem) => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "9px 12px", borderRadius: 9, border: "1px solid var(--bd)",
  fontSize: 13.5, color: "var(--ink-1)", background: "var(--bg-1)", outline: "none",
};

export default function ComposeParentMessageModal({ childId, replyTo, onClose, onSent }: Props) {
  const [teachers, setTeachers] = useState<ChildTeacherItem[]>([]);
  const [recipientId, setRecipientId] = useState<number | "">(replyTo?.recipientId ?? "");
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : "");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (replyTo) return;
    fetchChildTeachers(childId).then(setTeachers).catch(() => setTeachers([]));
  }, [childId, replyTo]);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientId || !subject.trim() || !body.trim()) {
      setError("Choose a teacher, then fill in a subject and message.");
      return;
    }
    setSending(true);
    setError(null);
    try {
      const message = await sendParentMessage({ recipient_id: Number(recipientId), subject: subject.trim(), body: body.trim() });
      onSent(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send this message. Please try again.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div role="dialog" aria-modal="true" aria-label={replyTo ? "Reply" : "New message"}
      style={{ position: "fixed", inset: 0, background: "rgba(15,18,34,0.45)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}
      onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSend}
        style={{ background: "var(--bg-1)", borderRadius: 16, width: "100%", maxWidth: 480, maxHeight: "90vh", overflowY: "auto", boxShadow: "var(--sh-3)" }}>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "20px 24px", borderBottom: "1px solid var(--bd)" }}>
          <div style={{ width: 34, height: 34, borderRadius: 10, background: "#F0F9FF", display: "grid", placeItems: "center", flex: "none" }}>
            <Send size={16} color="#0369A1" strokeWidth={2} />
          </div>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink-1)", flex: 1 }}>{replyTo ? "Reply" : "New Message"}</h3>
          <button type="button" onClick={onClose} aria-label="Close"
            style={{ background: "var(--bg-2)", border: "none", borderRadius: 8, width: 30, height: 30, display: "grid", placeItems: "center", cursor: "pointer", color: "var(--ink-3)" }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>
          {error && (
            <div style={{ background: "var(--danger-soft)", border: "1px solid transparent", borderRadius: 9, padding: "10px 13px", color: "var(--danger)", fontSize: 12.5 }}>{error}</div>
          )}

          {replyTo ? (
            <div style={{ background: "var(--pu-soft)", borderRadius: 9, padding: "9px 13px", fontSize: 13, color: "var(--pu)", fontWeight: 600 }}>
              To: {replyTo.recipientName}
            </div>
          ) : (
            <div>
              <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>
                Message which teacher?
              </label>
              <select style={inputStyle} value={recipientId} onChange={(e) => setRecipientId(e.target.value ? Number(e.target.value) : "")}>
                <option value="">{teachers.length === 0 ? "Loading teachers…" : "Choose a teacher"}</option>
                {teachers.map((t) => <option key={t.id} value={t.id}>{t.name} — {t.role}</option>)}
              </select>
            </div>
          )}

          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Subject</label>
            <input style={inputStyle} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          </div>
          <div>
            <label style={{ display: "block", fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>Message</label>
            <textarea style={{ ...inputStyle, minHeight: 110, resize: "vertical", fontFamily: "inherit" }} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your message…" />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid var(--bd)" }}>
          <button type="button" onClick={onClose}
            style={{ padding: "9px 18px", borderRadius: 9, border: "1px solid var(--bd)", background: "var(--bg-1)", color: "var(--ink-2)", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            Cancel
          </button>
          <button type="submit" disabled={sending || !recipientId}
            style={{ display: "flex", alignItems: "center", gap: 6, padding: "9px 20px", borderRadius: 9, border: "none", background: "#0369A1", color: "#fff", fontSize: 13, fontWeight: 600, cursor: sending ? "default" : "pointer", opacity: sending || !recipientId ? 0.6 : 1 }}>
            {sending ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
            Send
          </button>
        </div>
      </form>
      <style>{`.spin { animation: spin 0.8s linear infinite; } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
