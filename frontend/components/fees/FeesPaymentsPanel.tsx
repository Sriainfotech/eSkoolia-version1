"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────
type FeedStatus = "Verified" | "Posted";

type FeedItem = {
  id: string;
  initials: string;
  name: string;
  amount: string;
  method: string;
  time: string;
  status: FeedStatus;
  bg: string;
  isNew?: boolean;
};

type TaskBtn = { label: string; variant: "primary" | "outline"; toast: string; href?: string };
type Task = { id: string; color: string; title: string; desc: string; buttons: TaskBtn[] };
type AuditItem = { id: string; initials: string; event: string; desc: string; date: string; bg: string };

// ─── Static data ──────────────────────────────────────────────────────────────
const KPI = [
  { label: "TOTAL COLLECTED THIS MONTH", value: "Rs. 48,07,040", sub: "92 receipts posted", border: "#16a34a" },
  { label: "OUTSTANDING DUES", value: "Rs. 21,72,460", sub: "38 students need follow-up", border: "#f59e0b" },
  { label: "OVERDUE (>30 DAYS)", value: "Rs. 6,70,000", sub: "Tier 3 escalation active", border: "#ef4444" },
  { label: "PAYMENTS TODAY", value: "Rs. 0", sub: "0 receipts posted today", border: "#8b5cf6" },
];

const TASKS: Task[] = [
  {
    id: "t1", color: "#ef4444",
    title: "23 students in Class 8A haven't paid Term 2 fees",
    desc: "Due in 3 days. Reminder template: polite final notice.",
    buttons: [
      { label: "Remind All", variant: "outline", toast: "Reminders sent to 23 students in Class 8A.", href: undefined },
      { label: "View",       variant: "outline", toast: "",                                        href: "/fees/dues-reminders" },
    ],
  },
  {
    id: "t2", color: "#f59e0b",
    title: "5 cheque payments pending clearance",
    desc: "Finance needs bank confirmation before receipts are finalized.",
    buttons: [
      { label: "Mark Cleared", variant: "primary", toast: "5 cheque payments marked as cleared." },
    ],
  },
  {
    id: "t3", color: "#f59e0b",
    title: "Transport Users schedule has 2 missing April amounts",
    desc: "Configuration gap affects new admissions added this week.",
    buttons: [
      { label: "Fix Schedule", variant: "outline", toast: "Opening fee schedule configuration..." },
    ],
  },
  {
    id: "t4", color: "#22c55e",
    title: "Carry forward incomplete for 2024-25",
    desc: "11 balances still pending review before rollover.",
    buttons: [
      { label: "Complete Now", variant: "outline", toast: "Opening carry-forward review panel..." },
    ],
  },
];

const INITIAL_FEED: FeedItem[] = [
  { id: "f1", initials: "AS", name: "Advait Sharma", amount: "9,700", method: "Wallet", time: "13:02", status: "Verified", bg: "#7C3AED" },
  { id: "f2", initials: "TS", name: "Tanvi Sharma", amount: "8,500", method: "Online", time: "13:02", status: "Verified", bg: "#0E7490" },
  { id: "f3", initials: "KS", name: "Krish Sharma", amount: "14,500", method: "Bank Transfer", time: "13:02", status: "Posted", bg: "#9333EA" },
  { id: "f4", initials: "AS", name: "Ayaan Sharma", amount: "13,300", method: "Wallet", time: "13:00", status: "Verified", bg: "#7C3AED" },
  { id: "f5", initials: "DS", name: "Devika Sharma", amount: "12,100", method: "Online", time: "12:59", status: "Verified", bg: "#0E7490" },
  { id: "f6", initials: "AS", name: "Arnav Sharma", amount: "12,100", method: "Online", time: "13:02", status: "Verified", bg: "#7C3AED" },
  { id: "f7", initials: "DS", name: "Divya Sharma", amount: "10,900", method: "Bank Transfer", time: "13:02", status: "Posted", bg: "#16a34a" },
];

const AUDIT: AuditItem[] = [
  { id: "a1", initials: "PM", event: "Payment posted", desc: "RCPT-25-4218 posted for Aditi Nair by Finance Admin", date: "27 May, 10:42 AM", bg: "#3B82F6" },
  { id: "a2", initials: "AS", event: "Fee assignment edited", desc: "Transport Users schedule assigned to ADM-0142 with Merit 25% concession", date: "27 May, 10:16 AM", bg: "#7C3AED" },
  { id: "a3", initials: "CN", event: "Concession approved", desc: "Need-Based Full concession approved by Principal for Vihaan Reddy", date: "26 May, 4:30 PM", bg: "#0E7490" },
  { id: "a4", initials: "DL", event: "Receipt deleted", desc: "Draft receipt RCPT-25-4189 removed before posting; reason captured", date: "26 May, 2:05 PM", bg: "#ef4444" },
  { id: "a5", initials: "YR", event: "Rollover reviewed", desc: "2024-25 carry forward batch marked ready for final approval", date: "25 May, 5:12 PM", bg: "#6B7280" },
];

// Simulate pool
const SIM_POOL = [
  { initials: "RN", name: "Riaan Nair", bg: "#3B82F6" },
  { initials: "SN", name: "Sia Nair", bg: "#7C3AED" },
  { initials: "KN", name: "Kiara Nair", bg: "#0E7490" },
  { initials: "AN", name: "Atharv Nair", bg: "#9333EA" },
  { initials: "RS", name: "Rohan Sharma", bg: "#6D28D9" },
  { initials: "PS", name: "Priya Singh", bg: "#0f766e" },
  { initials: "AK", name: "Arjun Kumar", bg: "#d97706" },
  { initials: "VR", name: "Vihaan Reddy", bg: "#16a34a" },
];
const SIM_AMOUNTS = [5500, 7200, 8800, 9100, 10200, 11500, 12300, 13700, 14200, 15800];
const SIM_METHODS = ["Cash", "Online", "Wallet", "Bank Transfer", "Cheque"];
let simCounter = 100;

function nowTime(): string {
  return new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false });
}
function fmtAmt(n: number): string {
  return n.toLocaleString("en-IN");
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--bd, #E8E8EE)",
  borderRadius: 12,
  padding: "20px 24px",
};

function btnStyle(v: "primary" | "outline"): React.CSSProperties {
  return v === "primary"
    ? { height: 32, padding: "0 14px", background: "var(--pu, #6D4AFF)", color: "#fff", border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }
    : { height: 32, padding: "0 14px", background: "#fff", color: "var(--ink-1, #181B2A)", border: "1px solid var(--bd, #E8E8EE)", borderRadius: 6, fontSize: 12.5, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function FeesPaymentsPanel() {
  const router = useRouter();
  const [feed, setFeed] = useState<FeedItem[]>(INITIAL_FEED);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [toast, setToast] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  }, []);

  const simulatePayment = useCallback(() => {
    const p = SIM_POOL[Math.floor(Math.random() * SIM_POOL.length)];
    const amount = SIM_AMOUNTS[Math.floor(Math.random() * SIM_AMOUNTS.length)];
    const method = SIM_METHODS[Math.floor(Math.random() * SIM_METHODS.length)];
    const status: FeedStatus = Math.random() > 0.3 ? "Verified" : "Posted";
    const id = `sim-${++simCounter}`;
    const item: FeedItem = {
      id, initials: p.initials, name: p.name,
      amount: fmtAmt(amount), method, time: nowTime(),
      status, bg: p.bg, isNew: true,
    };
    setFeed(prev => [item, ...prev.slice(0, 19)]);
    showToast(`Payment received: Rs. ${fmtAmt(amount)} from ${p.name} via ${method}.`);
    setTimeout(() => {
      setFeed(prev => prev.map(f => f.id === id ? { ...f, isNew: false } : f));
    }, 800);
  }, [showToast]);

  useEffect(() => {
    if (!autoRefresh) return;
    const t = setInterval(simulatePayment, 3500);
    return () => clearInterval(t);
  }, [autoRefresh, simulatePayment]);

  return (
    <>
      <style>{`
        @keyframes feedIn { from { opacity:0; transform:translateY(-5px) } to { opacity:1; transform:translateY(0) } }
        @keyframes toastUp { from { opacity:0; transform:translateY(8px) } to { opacity:1; transform:translateY(0) } }
      `}</style>

      <div>
        {/* ── Page header ──────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: "var(--pu, #6D4AFF)", marginBottom: 6, textTransform: "uppercase" }}>
              Fees Command Center
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 700, color: "var(--ink-1, #181B2A)", lineHeight: 1.1 }}>
              Home
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "var(--ink-3, #A0A3B8)", lineHeight: 1.5 }}>
              Daily fee operations, live payment updates, and priority queue for the finance desk.
            </p>
          </div>
          <button
            onClick={simulatePayment}
            style={{
              height: 40, padding: "0 20px", flexShrink: 0, marginTop: 8,
              background: "var(--pu, #6D4AFF)", color: "#fff",
              border: "none", borderRadius: 8, fontSize: 13.5, fontWeight: 600,
              cursor: "pointer", boxShadow: "0 2px 8px rgba(109,74,255,0.28)",
            }}
          >
            Simulate Incoming Payment
          </button>
        </div>

        {/* ── KPI cards ────────────────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
          {KPI.map(kpi => (
            <div key={kpi.label} style={{ ...card, borderLeft: `4px solid ${kpi.border}`, padding: "20px 22px" }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "var(--ink-3, #A0A3B8)", marginBottom: 14, textTransform: "uppercase" }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, color: "var(--ink-1, #181B2A)", marginBottom: 8, letterSpacing: "-0.5px" }}>
                {kpi.value}
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3, #A0A3B8)" }}>
                {kpi.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ── Two-column section ───────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "3fr 2fr", gap: 16, marginBottom: 24, alignItems: "start" }}>

          {/* Task Queue */}
          <div style={card}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-1, #181B2A)", marginBottom: 4 }}>
                Task Queue
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3, #A0A3B8)", lineHeight: 1.5 }}>
                Auto-generated actions from dues, cheques, and year-end checks.
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {TASKS.map(task => (
                <div
                  key={task.id}
                  style={{
                    display: "flex", alignItems: "flex-start", gap: 16,
                    padding: "14px 16px", borderRadius: 10,
                    border: "1px solid var(--bd, #E8E8EE)",
                    borderLeft: `4px solid ${task.color}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-1, #181B2A)", marginBottom: 5, lineHeight: 1.4 }}>
                      {task.title}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-3, #A0A3B8)", lineHeight: 1.5 }}>
                      {task.desc}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, flexShrink: 0, alignItems: "flex-start", marginTop: 2 }}>
                    {task.buttons.map(btn => (
                      <button
                        key={btn.label}
                        onClick={() => btn.href ? router.push(btn.href) : showToast(btn.toast)}
                        style={btnStyle(btn.variant)}
                      >
                        {btn.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Live Payment Feed */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-1, #181B2A)", marginBottom: 4 }}>
                  Live Payment Feed
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-3, #A0A3B8)", lineHeight: 1.5 }}>
                  Simulated webhook updates from app, bank transfer, and wallet payments.
                </div>
              </div>
              <button
                onClick={() => setAutoRefresh(r => !r)}
                style={{
                  flexShrink: 0, marginLeft: 10,
                  padding: "6px 10px", borderRadius: 6,
                  fontSize: 11.5, fontWeight: 600, cursor: "pointer",
                  lineHeight: 1.3, textAlign: "center",
                  background: autoRefresh ? "#dcfce7" : "var(--bg-1, #f8f8fb)",
                  color: autoRefresh ? "#15803d" : "var(--ink-2, #5B5E72)",
                  border: autoRefresh ? "1px solid #86efac" : "1px solid var(--bd, #E8E8EE)",
                  transition: "all 0.2s",
                }}
              >
                {autoRefresh ? "● Auto-\nrefresh" : "Auto-\nrefresh"}
              </button>
            </div>

            <div ref={feedRef} style={{ maxHeight: 380, overflowY: "auto", scrollbarWidth: "thin", display: "flex", flexDirection: "column", gap: 10, paddingRight: 4 }}>
              {feed.map((item, i) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "12px 14px",
                    border: "1px solid var(--bd, #E8E8EE)",
                    borderRadius: 10,
                    background: item.isNew ? "#f0fdf4" : "#fff",
                    animation: item.isNew ? "feedIn 0.3s ease" : "none",
                    transition: "background 0.5s ease",
                  }}
                >
                  <div style={{
                    width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: item.bg, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 12, fontWeight: 700,
                  }}>
                    {item.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-1, #181B2A)", marginBottom: 2 }}>
                      {item.name}
                    </div>
                    <div style={{ fontSize: 12.5, color: "var(--ink-3, #A0A3B8)" }}>
                      Rs. {item.amount} via {item.method} · {item.time}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 12.5, fontWeight: 600, flexShrink: 0,
                    color: item.status === "Verified" ? "#16a34a" : "var(--ink-3, #A0A3B8)",
                  }}>
                    {item.status}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Audit Trail ──────────────────────────────────────────── */}
        <div style={card}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 600, color: "var(--ink-1, #181B2A)", marginBottom: 4 }}>
                Audit Trail
              </div>
              <div style={{ fontSize: 13, color: "var(--ink-3, #A0A3B8)", lineHeight: 1.5 }}>
                Immutable finance events for payment, assignment, concession, and rollover changes.
              </div>
            </div>
            <button style={{
              height: 30, padding: "0 14px", flexShrink: 0,
              background: "var(--bg-1, #f8f8fb)", color: "var(--ink-1, #181B2A)",
              border: "1px solid var(--bd, #E8E8EE)", borderRadius: 6,
              fontSize: 12.5, fontWeight: 500, cursor: "pointer",
            }}>
              Today
            </button>
          </div>
          <div>
            {AUDIT.map((item, i) => (
              <div key={item.id} style={{
                display: "flex", alignItems: "flex-start", gap: 14,
                padding: "14px 0",
                borderTop: i > 0 ? "1px solid var(--bd, #E8E8EE)" : "none",
              }}>
                <div style={{
                  width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                  background: item.bg, color: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700,
                }}>
                  {item.initials}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-1, #181B2A)", marginBottom: 3 }}>
                    {item.event}
                  </div>
                  <div style={{ fontSize: 13, color: "var(--ink-3, #A0A3B8)", lineHeight: 1.45 }}>
                    {item.desc}
                  </div>
                </div>
                <div style={{ fontSize: 12.5, color: "var(--ink-3, #A0A3B8)", flexShrink: 0, whiteSpace: "nowrap", marginTop: 2 }}>
                  {item.date}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Toast ────────────────────────────────────────────────── */}
        {toast && (
          <div style={{
            position: "fixed", bottom: 24, right: 24,
            background: "#1e293b", color: "#fff",
            padding: "12px 20px", borderRadius: 10,
            fontSize: 13.5, fontWeight: 500, lineHeight: 1.4,
            boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
            zIndex: 9999, maxWidth: 420,
            animation: "toastUp 0.2s ease",
          }}>
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
