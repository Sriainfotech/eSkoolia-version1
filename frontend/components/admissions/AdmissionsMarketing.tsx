"use client";

import { useState } from "react";
import {
  Send,
  Plus,
  Copy,
  CheckCircle2,
  MessageSquare,
  Mail,
  Phone,
  Calendar,
  Users,
  Zap,
  Star,
  X,
  ChevronDown,
  RefreshCw,
  Eye,
} from "lucide-react";

/* ─────────────────────── template data ─────────────────────── */
type Template = {
  id: string;
  name: string;
  category: string;
  channel: "whatsapp" | "email" | "sms";
  body: string;
  subject?: string;
  variables: string[];
  useCase: string;
};

const TEMPLATES: Template[] = [
  // WhatsApp
  {
    id: "wa-t1",
    name: "Thank You for Inquiry",
    category: "Welcome",
    channel: "whatsapp",
    useCase: "Auto-sent on form creation",
    variables: ["{parent_name}", "{school_name}", "{child_name}", "{grade}", "{portal_link}", "{counsellor_name}"],
    body: `Hi {parent_name} 👋 Thank you for your interest in {school_name}!

We've received your inquiry for {child_name}'s admission to {grade}. Our team will reach out within 24 hours.

Track your inquiry status here: {portal_link}

— {counsellor_name}, {school_name} Admissions`,
  },
  {
    id: "wa-t2",
    name: "First Follow-up Call Confirmation",
    category: "Follow-up",
    channel: "whatsapp",
    useCase: "When reaching out for first time",
    variables: ["{parent_name}", "{counsellor_name}", "{school_name}", "{child_name}", "{grade}"],
    body: `Hi {parent_name}, this is {counsellor_name} from {school_name}.

I'm reaching out regarding {child_name}'s admission inquiry for {grade}. Would you be available for a quick 5-minute call today?

Please reply with a convenient time 🙏`,
  },
  {
    id: "wa-t3",
    name: "Visit Invitation",
    category: "Visit",
    channel: "whatsapp",
    useCase: "Invite parent for campus tour",
    variables: ["{parent_name}", "{school_name}", "{grade}", "{child_name}", "{preferred_visit_date}"],
    body: `Hi {parent_name} 😊 We'd love to show you {school_name}!

{grade} has limited seats this year — a campus visit will help {child_name} see why families love us.

Can you visit on {preferred_visit_date}? Reply YES to confirm ✅`,
  },
  {
    id: "wa-t4",
    name: "Visit Reminder",
    category: "Visit",
    channel: "whatsapp",
    useCase: "Auto-sent 24 hrs before visit",
    variables: ["{parent_name}", "{child_name}", "{school_name}", "{visit_date}", "{visit_time}"],
    body: `Hi {parent_name}, just a reminder — {child_name}'s school visit at {school_name} is tomorrow ({visit_date}) at {visit_time}.

Please use the main entrance. Looking forward to meeting you! 🏫

— {school_name} Team`,
  },
  {
    id: "wa-t5",
    name: "Post-Visit Thank You",
    category: "Post-Visit",
    channel: "whatsapp",
    useCase: "After campus visit",
    variables: ["{parent_name}", "{child_name}", "{school_name}", "{counsellor_phone}", "{portal_link}"],
    body: `Hi {parent_name}, it was wonderful meeting you and {child_name} today! We hope you loved the campus.

If you have any questions, I'm here to help: {counsellor_phone}

To complete {child_name}'s enrollment: {portal_link} 🎒`,
  },
  {
    id: "wa-t6",
    name: "Seat Filling Fast",
    category: "Urgency",
    channel: "whatsapp",
    useCase: "When grade is 80%+ full",
    variables: ["{parent_name}", "{grade}", "{school_name}", "{seats_left}", "{child_name}", "{counsellor_name}"],
    body: `Hi {parent_name}, a quick update — {grade} at {school_name} has only {seats_left} seats remaining for 2026-27.

We'd hate for {child_name} to miss out! Should we reserve a spot? Reply YES and I'll guide you 🙏

— {counsellor_name}`,
  },
  {
    id: "wa-t7",
    name: "Re-engagement (Cold Lead)",
    category: "Re-engagement",
    channel: "whatsapp",
    useCase: "Cold leads 10+ days old",
    variables: ["{parent_name}", "{child_name}", "{school_name}", "{portal_link}"],
    body: `Hi {parent_name} 👋 We noticed {child_name}'s admission inquiry is still open at {school_name}.

We completely understand if you're still deciding — we're happy to answer any questions.

Would a quick campus visit help? {portal_link}`,
  },
  {
    id: "wa-t8",
    name: "Sibling Discount Offer",
    category: "Offer",
    channel: "whatsapp",
    useCase: "Families with siblings enrolled",
    variables: ["{parent_name}", "{sibling_name}", "{school_name}", "{child_name}", "{sibling_discount}", "{grade}", "{offer_expiry}", "{school_phone}"],
    body: `Hi {parent_name} 🎉 Since {sibling_name} is already part of the {school_name} family, {child_name} is eligible for our {sibling_discount}% sibling discount for {grade} admission.

This offer is valid till {offer_expiry}. Shall we proceed?

Call us: {school_phone}`,
  },
  {
    id: "wa-t9",
    name: "Enrollment Confirmed",
    category: "Enrollment",
    channel: "whatsapp",
    useCase: "On successful enrollment",
    variables: ["{parent_name}", "{child_name}", "{school_name}", "{grade}"],
    body: `🎊 Congratulations {parent_name}! {child_name} is officially enrolled at {school_name} for {grade}, Academic Year 2026-27.

Welcome to our school family! Please visit the office to submit documents.

See you soon! 📚`,
  },
  {
    id: "wa-t10",
    name: "Open House Invite",
    category: "Event",
    channel: "whatsapp",
    useCase: "Open house event promotion",
    variables: ["{parent_name}", "{school_name}", "{event_date}", "{event_time}", "{rsvp_link}", "{child_name}"],
    body: `Hi {parent_name} 🏫 You're invited to {school_name}'s Open House on {event_date} at {event_time}!

Meet our teachers, tour the campus, and see why 95% of visiting families choose us.

RSVP here: {rsvp_link} — Limited seats. Bring {child_name}! 🌟`,
  },
  // Email Templates
  {
    id: "em-t11",
    name: "Inquiry Acknowledgment",
    category: "Welcome",
    channel: "email",
    useCase: "Detailed acknowledgment on inquiry creation",
    subject: "Your admission inquiry for {child_name} — {school_name}",
    variables: ["{parent_name}", "{child_name}", "{grade}", "{counsellor_name}", "{portal_link}", "{school_phone}", "{school_name}"],
    body: `Dear {parent_name},

Thank you for your interest in {school_name}! We've received your admission inquiry for {child_name} applying to {grade} for the 2026-27 academic year.

Here's what happens next:
1. Our counsellor {counsellor_name} will call you within 24 hours
2. We'll invite you for a campus visit — the best way to experience our school
3. We'll guide you through the enrollment process step by step

Track your inquiry status anytime: {portal_link}

Any questions? Reply to this email or call {school_phone}.

Warm regards,
{counsellor_name}
{school_name} Admissions Team`,
  },
  {
    id: "em-t12",
    name: "Visit Booking Confirmation",
    category: "Visit",
    channel: "email",
    useCase: "Confirm campus visit details",
    subject: "Your campus visit is confirmed — {school_name}",
    variables: ["{parent_name}", "{child_name}", "{visit_date}", "{visit_time}", "{school_address}", "{counsellor_name}", "{counsellor_phone}", "{school_name}"],
    body: `Dear {parent_name},

Great news! Your campus visit for {child_name} has been confirmed:
📅 Date: {visit_date}
⏰ Time: {visit_time}
📍 Venue: {school_address}
👤 Your counsellor: {counsellor_name} ({counsellor_phone})

Please arrive 5 minutes early. Parking is available at the main gate.

What to bring: Any school records or transfer certificate (optional)

Looking forward to meeting you!

Warm regards,
{school_name} Admissions Team`,
  },
  {
    id: "em-t13",
    name: "Monthly Newsletter",
    category: "Nurture",
    channel: "email",
    useCase: "Monthly update to all active inquiries",
    subject: "Updates from {school_name} — {month_year}",
    variables: ["{parent_name}", "{school_name}", "{month_year}", "{event_date}", "{grade}", "{deadline_date}", "{seats_left}", "{school_phone}", "{school_website}"],
    body: `Dear {parent_name},

Here's a quick update for families considering {school_name}:

🏆 This month's highlights:
• [Achievement 1]
• [Achievement 2]
• [Achievement 3]

📅 Upcoming:
• Open House: {event_date}
• Admission deadline for {grade}: {deadline_date}

💺 Seats remaining in {grade}: {seats_left}

Questions? Reply to this email or call {school_phone}.

{school_name} Admissions Team | {school_website}`,
  },
  {
    id: "em-t14",
    name: "Post-Decline Save Attempt",
    category: "Save",
    channel: "email",
    useCase: "After a lead is marked declined",
    subject: "We understand — and we're here if you change your mind",
    variables: ["{parent_name}", "{school_name}", "{child_name}"],
    body: `Dear {parent_name},

Thank you for considering {school_name} for {child_name}.

We understand you've chosen a different path for now, and we completely respect your decision.

If circumstances change or you'd like to reconsider, we'd be honoured to welcome {child_name} to our school family. Our doors are always open.

Wishing {child_name} all the very best 🌟

Warm regards,
{school_name} Admissions Team`,
  },
  {
    id: "em-t15",
    name: "Referral Ask",
    category: "Referral",
    channel: "email",
    useCase: "After enrollment — ask for referrals",
    subject: "Could you help another family find the right school?",
    variables: ["{parent_name}", "{child_name}", "{school_name}", "{referral_benefit}"],
    body: `Dear {parent_name},

It's been wonderful having {child_name} at {school_name}!

We'd love to welcome more great families like yours. If you know of any families looking for a school, please share our details — we offer a referral benefit for you: {referral_benefit}.

Simply ask them to mention your name when they enquire!

With gratitude,
{school_name} Team`,
  },
];

/* ─────────────────────── campaign mock data ─────────────────────── */
type Campaign = {
  id: string;
  name: string;
  status: "draft" | "scheduled" | "sent" | "active";
  channel: string;
  audience: string;
  sentCount?: number;
  deliveredPct?: number;
  replies?: number;
  scheduledFor?: string;
  sentAt?: string;
};

const DEMO_CAMPAIGNS: Campaign[] = [
  {
    id: "c1",
    name: "Grade 5 Seat Alert",
    status: "sent",
    channel: "WhatsApp",
    audience: "All Grade 5 inquiries",
    sentCount: 89,
    deliveredPct: 94,
    replies: 12,
    sentAt: "3 May 2026",
  },
  {
    id: "c2",
    name: "Open House — 15 May",
    status: "scheduled",
    channel: "WhatsApp + Email",
    audience: "All active inquiries (Grade 1–5)",
    sentCount: 487,
    scheduledFor: "12 May 2026, 9:00 AM",
  },
];

/* ─────────────────────── helpers ─────────────────────── */
function ChannelBadge({ ch }: { ch: Template["channel"] }) {
  const map = {
    whatsapp: { bg: "#dcfce7", color: "#15803d", label: "WhatsApp" },
    email: { bg: "#dbeafe", color: "#1d4ed8", label: "Email" },
    sms: { bg: "#fef9c3", color: "#a16207", label: "SMS" },
  };
  const s = map[ch];
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function StatusBadge({ status }: { status: Campaign["status"] }) {
  const map = {
    draft: { bg: "#f3f4f6", color: "#6b7280", label: "Draft" },
    scheduled: { bg: "#eff6ff", color: "#1d4ed8", label: "● Scheduled" },
    active: { bg: "#ecfdf5", color: "#059669", label: "● Active" },
    sent: { bg: "#f5f3ff", color: "#7c3aed", label: "✓ Sent" },
  };
  const s = map[status];
  return (
    <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 20, fontSize: 11.5, fontWeight: 600, background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

/* ─────────────────────── main component ─────────────────────── */
export function AdmissionsMarketing() {
  const [templateTab, setTemplateTab] = useState<Template["channel"]>("whatsapp");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [searchQ, setSearchQ] = useState("");
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>(DEMO_CAMPAIGNS);

  const filtered = TEMPLATES.filter(
    (t) => t.channel === templateTab && (searchQ === "" || t.name.toLowerCase().includes(searchQ.toLowerCase()) || t.category.toLowerCase().includes(searchQ.toLowerCase()))
  );

  function copyTemplate(t: Template) {
    const text = t.subject ? `Subject: ${t.subject}\n\n${t.body}` : t.body;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopiedId(t.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  const card: React.CSSProperties = {
    background: "#fff",
    border: "1px solid var(--line, #e5e7eb)",
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,.06)",
  };

  const preview = TEMPLATES.find((t) => t.id === previewId);

  return (
    <div style={{ padding: "24px 16px", maxWidth: 1280, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#fdf2f8", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Send size={20} color="#a21caf" strokeWidth={1.8} />
          </div>
          <div>
            <h1 style={{ fontSize: 18, fontWeight: 700, color: "var(--ink-1, #111)", margin: 0 }}>Admissions Marketing</h1>
            <p style={{ fontSize: 12, color: "var(--ink-2, #6b7280)", margin: 0 }}>Campaigns, templates, and event management</p>
          </div>
        </div>
        <button
          onClick={() => setShowNewCampaign(true)}
          style={{ display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 16px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          <Plus size={15} /> New Campaign
        </button>
      </div>

      {/* ── Active Campaigns ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line, #e5e7eb)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Zap size={15} color="#f59e0b" strokeWidth={1.8} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1, #111)" }}>Campaigns</span>
            <span style={{ fontSize: 11.5, color: "var(--ink-2, #6b7280)", background: "#f3f4f6", borderRadius: 20, padding: "1px 8px" }}>{campaigns.length}</span>
          </div>
        </div>

        {campaigns.length === 0 ? (
          <div style={{ padding: "48px 20px", textAlign: "center" }}>
            <Send size={40} color="#e5e7eb" />
            <p style={{ color: "var(--ink-2, #6b7280)", marginTop: 12, fontSize: 14 }}>No campaigns yet.</p>
            <p style={{ color: "#9ca3af", fontSize: 13 }}>Create your first campaign to start reaching parents at scale.</p>
            <button
              onClick={() => setShowNewCampaign(true)}
              style={{ marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 20px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, cursor: "pointer" }}
            >
              <Plus size={14} /> Create Campaign
            </button>
          </div>
        ) : (
          <div style={{ padding: "0 0 4px" }}>
            {campaigns.map((c) => (
              <div
                key={c.id}
                style={{ padding: "16px 20px", borderBottom: "1px solid var(--line, #e5e7eb)", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
              >
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-1, #111)" }}>{c.name}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <div style={{ fontSize: 12.5, color: "var(--ink-2, #6b7280)", marginBottom: 4 }}>
                    Channel: {c.channel} · Audience: {c.audience}
                  </div>
                  {c.status === "sent" && (
                    <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink-2, #6b7280)" }}>
                      <span>Sent {c.sentAt} · {c.sentCount} parents</span>
                      <span style={{ color: "#059669" }}>{c.deliveredPct}% delivered</span>
                      <span>{c.replies} replies</span>
                    </div>
                  )}
                  {c.status === "scheduled" && (
                    <div style={{ fontSize: 12, color: "#1d4ed8" }}>
                      Scheduled: {c.scheduledFor} · {c.sentCount} recipients
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={{ padding: "6px 12px", border: "1px solid var(--line, #e5e7eb)", borderRadius: 7, background: "#fff", fontSize: 12, cursor: "pointer", color: "var(--ink-2, #6b7280)" }}>Edit</button>
                  {c.status === "scheduled" && (
                    <button
                      onClick={() => setCampaigns((prev) => prev.filter((x) => x.id !== c.id))}
                      style={{ padding: "6px 12px", border: "1px solid #fca5a5", borderRadius: 7, background: "#fff", fontSize: 12, cursor: "pointer", color: "#dc2626" }}
                    >Cancel</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary bar */}
        {campaigns.some(c => c.status === "sent") && (
          <div style={{ padding: "12px 20px", background: "#f9fafb", borderTop: "1px solid var(--line, #e5e7eb)", display: "flex", gap: 24, flexWrap: "wrap" }}>
            {[
              { label: "Total Sent", value: campaigns.filter(c => c.sentCount).reduce((a, c) => a + (c.sentCount ?? 0), 0) },
              { label: "Avg Delivery", value: `${Math.round(campaigns.filter(c => c.deliveredPct).reduce((a, c) => a + (c.deliveredPct ?? 0), 0) / campaigns.filter(c => c.deliveredPct).length)}%` },
              { label: "Total Replies", value: campaigns.reduce((a, c) => a + (c.replies ?? 0), 0) },
            ].map((s) => (
              <div key={s.label}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1, #111)" }}>{s.value}</div>
                <div style={{ fontSize: 11.5, color: "var(--ink-2, #6b7280)" }}>{s.label}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Templates Library ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line, #e5e7eb)" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <MessageSquare size={15} color="#6366f1" strokeWidth={1.8} />
              <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1, #111)" }}>Message Templates Library</span>
              <span style={{ fontSize: 11.5, color: "var(--ink-2, #6b7280)", background: "#f3f4f6", borderRadius: 20, padding: "1px 8px" }}>{TEMPLATES.length} templates</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="Search templates…"
                style={{ height: 32, padding: "0 12px", border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, fontSize: 12.5, width: 180, outline: "none" }}
              />
            </div>
          </div>
          {/* Channel tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "none" }}>
            {(["whatsapp", "email", "sms"] as Template["channel"][]).map((ch) => {
              const labels = { whatsapp: "💬 WhatsApp", email: "📧 Email", sms: "📱 SMS" };
              const cnt = TEMPLATES.filter(t => t.channel === ch).length;
              return (
                <button
                  key={ch}
                  onClick={() => setTemplateTab(ch)}
                  style={{
                    height: 36, padding: "0 16px", border: "none",
                    borderBottom: templateTab === ch ? "2px solid #6366f1" : "2px solid transparent",
                    background: "transparent", fontSize: 13, fontWeight: templateTab === ch ? 700 : 400,
                    color: templateTab === ch ? "#6366f1" : "var(--ink-2, #6b7280)", cursor: "pointer",
                  }}
                >
                  {labels[ch]} ({cnt})
                </button>
              );
            })}
          </div>
        </div>

        <div style={{ padding: 20 }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "30px 0", color: "#9ca3af", fontSize: 13 }}>No templates match your search.</div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 14 }}>
              {filtered.map((t) => (
                <div
                  key={t.id}
                  style={{
                    border: "1px solid var(--line, #e5e7eb)", borderRadius: 10, padding: "14px 16px",
                    background: previewId === t.id ? "#fafafa" : "#fff",
                    transition: "box-shadow 0.15s",
                  }}
                >
                  {/* Template header */}
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1, #111)", marginBottom: 4 }}>{t.name}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <ChannelBadge ch={t.channel} />
                        <span style={{ fontSize: 11, color: "var(--ink-2, #6b7280)", background: "#f3f4f6", borderRadius: 20, padding: "1px 7px" }}>{t.category}</span>
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        onClick={() => setPreviewId(previewId === t.id ? null : t.id)}
                        title="Preview"
                        style={{ width: 30, height: 30, border: "1px solid var(--line, #e5e7eb)", borderRadius: 7, background: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        <Eye size={13} color="var(--ink-2, #6b7280)" />
                      </button>
                      <button
                        onClick={() => copyTemplate(t)}
                        title="Copy"
                        style={{ width: 30, height: 30, border: `1px solid ${copiedId === t.id ? "#10b981" : "var(--line, #e5e7eb)"}`, borderRadius: 7, background: copiedId === t.id ? "#d1fae5" : "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                      >
                        {copiedId === t.id ? <CheckCircle2 size={13} color="#10b981" /> : <Copy size={13} color="var(--ink-2, #6b7280)" />}
                      </button>
                    </div>
                  </div>

                  <div style={{ fontSize: 12, color: "#9ca3af", marginBottom: previewId === t.id ? 10 : 0, fontStyle: "italic" }}>
                    Use when: {t.useCase}
                  </div>

                  {/* Preview body */}
                  {previewId === t.id && (
                    <div>
                      {t.subject && (
                        <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 6 }}>
                          <span style={{ fontWeight: 600 }}>Subject: </span>{t.subject}
                        </div>
                      )}
                      <div
                        style={{
                          background: t.channel === "whatsapp" ? "#e7fce8" : "#f0f4ff",
                          borderRadius: 8, padding: "10px 12px", fontSize: 12.5, lineHeight: 1.6,
                          color: "var(--ink-1, #111)", whiteSpace: "pre-wrap", maxHeight: 200, overflowY: "auto",
                        }}
                      >
                        {t.body}
                      </div>
                      <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {t.variables.map((v) => (
                          <span key={v} style={{ fontSize: 11, background: "#eff6ff", color: "#1d4ed8", borderRadius: 4, padding: "1px 6px", fontFamily: "monospace" }}>{v}</span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Events Manager ── */}
      <div style={card}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--line, #e5e7eb)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Calendar size={15} color="#0ea5e9" strokeWidth={1.8} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1, #111)" }}>Events Manager</span>
          </div>
          <button
            style={{ display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px", background: "#0ea5e9", color: "#fff", border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={13} /> New Event
          </button>
        </div>
        <div style={{ padding: 20 }}>
          {/* Demo events */}
          {[
            { name: "Open House", date: "15 May 2026", time: "10:00 AM", rsvp: 14, capacity: 40 },
            { name: "Campus Tour", date: "22 May 2026", time: "11:00 AM", rsvp: 6, capacity: 20 },
          ].map((ev, i) => (
            <div
              key={i}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 0", borderBottom: "1px solid var(--line, #e5e7eb)", flexWrap: "wrap", gap: 10 }}
            >
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-1, #111)", marginBottom: 2 }}>{ev.name}</div>
                <div style={{ fontSize: 12.5, color: "var(--ink-2, #6b7280)" }}>
                  📅 {ev.date} · ⏰ {ev.time} · 🎟️ {ev.rsvp}/{ev.capacity} RSVPs
                </div>
                <div style={{ marginTop: 6, height: 5, width: 180, background: "#f3f4f6", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${(ev.rsvp / ev.capacity) * 100}%`, background: "#0ea5e9", borderRadius: 3 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={{ padding: "6px 12px", border: "1px solid var(--line, #e5e7eb)", borderRadius: 7, background: "#fff", fontSize: 12, cursor: "pointer" }}>Manage RSVPs</button>
                <button style={{ padding: "6px 12px", border: "1px solid #bfdbfe", borderRadius: 7, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, cursor: "pointer" }}>Send Reminder</button>
              </div>
            </div>
          ))}
          <p style={{ marginTop: 16, fontSize: 12.5, color: "#9ca3af", textAlign: "center" }}>
            Create an event to auto-generate RSVP links and bulk-invite all active inquiries with one click.
          </p>
        </div>
      </div>

      {/* ── New Campaign Modal ── */}
      {showNewCampaign && (
        <div
          style={{ position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={() => setShowNewCampaign(false)}
        >
          <div
            style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 50px rgba(0,0,0,.2)" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>New Campaign</h2>
              <button onClick={() => setShowNewCampaign(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 4 }}>
                <X size={18} color="var(--ink-2, #6b7280)" />
              </button>
            </div>
            <NewCampaignForm
              onSave={(camp) => {
                setCampaigns((prev) => [camp, ...prev]);
                setShowNewCampaign(false);
              }}
              onCancel={() => setShowNewCampaign(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── New Campaign Form ─── */
function NewCampaignForm({ onSave, onCancel }: { onSave: (c: Campaign) => void; onCancel: () => void }) {
  const [form, setForm] = useState({ name: "", channel: "WhatsApp", audience: "All active inquiries", scheduledFor: "" });
  const f = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((prev) => ({ ...prev, [k]: e.target.value }));

  const labelStyle: React.CSSProperties = { fontSize: 12.5, fontWeight: 600, color: "var(--ink-1, #111)", marginBottom: 4, display: "block" };
  const inputStyle: React.CSSProperties = { width: "100%", height: 38, border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, padding: "0 12px", fontSize: 13, outline: "none", boxSizing: "border-box" };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <label style={labelStyle}>Campaign Name</label>
        <input value={form.name} onChange={f("name")} placeholder="e.g. Open House May 2026" style={inputStyle} />
      </div>
      <div>
        <label style={labelStyle}>Channel</label>
        <select value={form.channel} onChange={f("channel")} style={{ ...inputStyle, background: "#fff" }}>
          <option>WhatsApp</option>
          <option>Email</option>
          <option>WhatsApp + Email</option>
          <option>SMS</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>Audience</label>
        <select value={form.audience} onChange={f("audience")} style={{ ...inputStyle, background: "#fff" }}>
          <option>All active inquiries</option>
          <option>All active inquiries (Grade 1–5)</option>
          <option>Cold leads (10+ days no contact)</option>
          <option>Post-visit (not yet enrolled)</option>
          <option>All enrolled families</option>
          <option>Custom filter</option>
        </select>
      </div>
      <div>
        <label style={labelStyle}>Schedule Date & Time</label>
        <input type="datetime-local" value={form.scheduledFor} onChange={f("scheduledFor")} style={inputStyle} />
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button onClick={onCancel} style={{ padding: "8px 18px", border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, background: "#fff", fontSize: 13, cursor: "pointer" }}>Cancel</button>
        <button
          onClick={() => {
            if (!form.name) return;
            onSave({
              id: `c${Date.now()}`,
              name: form.name,
              channel: form.channel,
              audience: form.audience,
              status: form.scheduledFor ? "scheduled" : "draft",
              sentCount: 0,
              scheduledFor: form.scheduledFor ? new Date(form.scheduledFor).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : undefined,
            });
          }}
          style={{ padding: "8px 18px", background: "#1d4ed8", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" }}
        >
          {form.scheduledFor ? "Schedule Campaign" : "Save Draft"}
        </button>
      </div>
    </div>
  );
}
