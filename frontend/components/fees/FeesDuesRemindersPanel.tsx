"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { feesApi, DuesClassGroup, DueStudent, DueInteraction } from "@/lib/fees-api";

type TierNum = 1 | 2 | 3;

const TIERS = [
  { n: 1 as TierNum, label: "Tier 1: 1-15 days overdue" },
  { n: 2 as TierNum, label: "Tier 2: 16-30 days overdue" },
  { n: 3 as TierNum, label: "Tier 3: 31+ days overdue" },
];

const STATUS_STYLE: Record<string, { bg: string; color: string }> = {
  "Payment Watch": { bg: "#FEF3C7", color: "#D97706" },
  "Escalated":     { bg: "#FED7AA", color: "#EA580C" },
  "Defaulter":     { bg: "#FCE7F3", color: "#9D174D" },
  "Overdue":       { bg: "#FEE2E2", color: "#DC2626" },
};

function tierStatus(days: number): string {
  if (days <= 15) return "Payment Watch";
  if (days <= 30) return "Escalated";
  return "Defaulter";
}

const STAT_BORDERS = ["#F97316", "#F59E0B", "#6D4AFF", "#16a34a"];
const AV = ["#6D4AFF","#0E7490","#16a34a","#d97706","#dc2626","#7C3AED","#0284c7","#9333ea"];
function avBg(n: string) { let h = 0; for (const c of n) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AV[h % AV.length]; }
function ini(n: string) { const p = n.trim().split(" "); return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase(); }
function fmtRs(n: number | string) { return "Rs. " + Number(n).toLocaleString("en-IN"); }
function fmtDate(d: string | null) {
  if (!d) return "—";
  try { return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }); }
  catch { return d; }
}

function pBtn(sm = false): React.CSSProperties {
  return { height: sm ? 30 : 36, padding: sm ? "0 12px" : "0 18px", background: "#6D4AFF", color: "#fff", border: "none", borderRadius: sm ? 7 : 9, fontSize: sm ? 12 : 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(109,74,255,0.20)" };
}
function oBtn(sm = false): React.CSSProperties {
  return { height: sm ? 30 : 36, padding: sm ? "0 12px" : "0 16px", background: "#fff", color: "#181B2A", border: "1px solid #E8E8EE", borderRadius: sm ? 7 : 9, fontSize: sm ? 12 : 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" };
}
const TH: React.CSSProperties = { padding: "10px 16px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", textAlign: "left", borderBottom: "1px solid #E8E8EE" };
const TD: React.CSSProperties = { padding: "13px 16px", fontSize: 13.5, color: "#181B2A", verticalAlign: "middle" };

const RESOLVE_ACTIONS = [
  { key: "collect_now",       emoji: "💳", label: "Collect Now",          sub: "Switch to collection desk for this student" },
  { key: "send_reminder",     emoji: "🔔", label: "Send Final Reminder",   sub: "Log reminder and mark Final Reminder Sent" },
  { key: "payment_plan",      emoji: "📋", label: "Create Payment Plan",   sub: "Set up instalments with agreed dates" },
  { key: "write_off",         emoji: "✏️", label: "Write Off",             sub: "Write off balance with reason and approval" },
  { key: "escalate",          emoji: "ℹ️", label: "Escalate",              sub: "Flag for principal or legal follow-up" },
  { key: "start_offboarding", emoji: "🟠", label: "Start Offboarding",     sub: "Student leaving — begin clearance process" },
];
const OB_CHECKLIST = [
  "Collect outstanding fee balance",
  "Library clearance confirmed",
  "Transport clearance confirmed",
  "Hostel / Lunch clearance confirmed",
  "Transfer Certificate issued",
  "Caution deposit refund processed (if applicable)",
  "Parent portal access closed",
  "Student record archived",
];
const WO_REASONS = ["Financial hardship", "Scholarship grant", "Management decision", "Duplicate charge", "Other"];
const ESC_TO     = ["Principal", "Vice Principal", "Accountant", "Management", "Legal"];

export default function FeesDuesRemindersPanel() {
  const [activeTier,   setActiveTier]   = useState<TierNum>(1);
  const [groups,       setGroups]       = useState<DuesClassGroup[]>([]);
  const [summary,      setSummary]      = useState<{
    total_overdue_amount: string; students_with_dues: number;
    avg_days_overdue: number; pct_collected: number;
  } | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [expanded,     setExpanded]     = useState<Set<string>>(new Set());
  const [resolved,     setResolved]     = useState<Set<string>>(new Set());
  const [selSet,       setSelSet]       = useState<Set<string>>(new Set());
  const [toast,        setToast]        = useState("");

  // Resolve Outstanding Dues modal
  const [resolveTarget,  setResolveTarget]  = useState<DueStudent | null>(null);
  const [resolveAction,  setResolveAction]  = useState("");
  const [resolveSaving,  setResolveSaving]  = useState(false);
  // Payment Plan sub-form
  const [ppInst1, setPpInst1] = useState("");
  const [ppDue1,  setPpDue1]  = useState("");
  const [ppInst2, setPpInst2] = useState("");
  const [ppDue2,  setPpDue2]  = useState("");
  const [ppNote,  setPpNote]  = useState("");
  // Write Off sub-form
  const [woReason,   setWoReason]   = useState(WO_REASONS[0]);
  const [woApproved, setWoApproved] = useState("Principal");
  const [woNote,     setWoNote]     = useState("");
  // Escalate sub-form
  const [escTo,       setEscTo]       = useState(ESC_TO[0]);
  const [escPriority, setEscPriority] = useState("High");
  const [escNotes,    setEscNotes]    = useState("");
  // Offboarding checklist
  const [obChecked, setObChecked] = useState<Set<string>>(new Set());

  const [followUp,     setFollowUp]     = useState<DueStudent | null>(null);
  const [interactions, setInteractions] = useState<DueInteraction[]>([]);
  const [interLoading, setInterLoading] = useState(false);
  const [followNote,   setFollowNote]   = useState("");
  const [agreedAmt,    setAgreedAmt]    = useState("");
  const [agreedDate,   setAgreedDate]   = useState("");
  const [saving,       setSaving]       = useState(false);

  const toast_ = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3200); };

  const fetchData = useCallback(async (tier: TierNum) => {
    setLoading(true);
    try {
      const [grpRes, sumRes] = await Promise.allSettled([
        feesApi.getDuesByClass(String(tier)),
        feesApi.getDuesSummary(),
      ] as const);
      if (grpRes.status === "fulfilled") {
        const data = grpRes.value as DuesClassGroup[];
        setGroups(data);
        setExpanded(new Set(data.map(g => g.cls)));
      }
      if (sumRes.status === "fulfilled") setSummary(sumRes.value as typeof summary);
    } catch { toast_("Failed to load dues data."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(activeTier); }, [activeTier, fetchData]);

  // Apply resolved filter per group
  const filteredGroups = useMemo(() =>
    groups.map(g => ({ ...g, students: g.students.filter(s => !resolved.has(s.id)) }))
          .filter(g => g.students.length > 0),
  [groups, resolved]);

  const allStudents = useMemo(() => filteredGroups.flatMap(g => g.students), [filteredGroups]);

  const toggleExpand = (cls: string) =>
    setExpanded(p => { const n = new Set(p); n.has(cls) ? n.delete(cls) : n.add(cls); return n; });
  const toggleSel = (id: string) =>
    setSelSet(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const openResolveModal = (st: DueStudent) => {
    setResolveTarget(st);
    setResolveAction("");
    setPpInst1(""); setPpDue1(""); setPpInst2(""); setPpDue2(""); setPpNote("");
    setWoReason(WO_REASONS[0]); setWoApproved("Principal"); setWoNote("");
    setEscTo(ESC_TO[0]); setEscPriority("High"); setEscNotes("");
    setObChecked(new Set());
  };

  const handleConfirmAction = async () => {
    if (!resolveTarget || !resolveAction) return;
    setResolveSaving(true);
    try {
      if (resolveAction === "collect_now") {
        toast_(`Redirecting to collection desk for ${resolveTarget.name}.`);
        setResolveTarget(null);
      } else if (resolveAction === "send_reminder") {
        await feesApi.sendDueReminders([resolveTarget.id], "Final reminder — please clear outstanding fee immediately.");
        toast_(`Final reminder sent to ${resolveTarget.name}.`);
        setResolveTarget(null);
      } else if (resolveAction === "payment_plan") {
        const planNote = `Payment plan: Instalment 1 ₹${ppInst1} by ${ppDue1}, Instalment 2 ₹${ppInst2} by ${ppDue2}.${ppNote ? " " + ppNote : ""}`;
        await feesApi.createDueInteraction({ student: resolveTarget.id, interaction_type: "note", note: planNote, agreed_amount: ppInst1 || undefined, agreed_date: ppDue1 || undefined });
        toast_(`Payment plan saved for ${resolveTarget.name}.`);
        setResolveTarget(null);
      } else if (resolveAction === "write_off") {
        await feesApi.resolveStudentDue(resolveTarget.id, `Write off — ${woReason}. Approved by: ${woApproved}.${woNote ? " " + woNote : ""}`);
        setResolved(p => new Set([...p, resolveTarget.id]));
        if (followUp?.id === resolveTarget.id) setFollowUp(null);
        toast_(`Balance written off for ${resolveTarget.name}.`);
        setResolveTarget(null);
      } else if (resolveAction === "escalate") {
        await feesApi.createDueInteraction({ student: resolveTarget.id, interaction_type: "note", note: `Escalated to ${escTo} (${escPriority} priority).${escNotes ? " " + escNotes : ""}` });
        toast_(`Escalated ${resolveTarget.name}'s dues to ${escTo}.`);
        setResolveTarget(null);
      } else if (resolveAction === "start_offboarding") {
        await feesApi.resolveStudentDue(resolveTarget.id, "Student offboarding initiated. All clearance items confirmed.");
        setResolved(p => new Set([...p, resolveTarget.id]));
        if (followUp?.id === resolveTarget.id) setFollowUp(null);
        toast_(`Offboarding started for ${resolveTarget.name}.`);
        setResolveTarget(null);
      }
    } catch { toast_("Action failed. Please try again."); }
    finally { setResolveSaving(false); }
  };

  const openFollowUp = async (st: DueStudent) => {
    setFollowUp(st);
    setFollowNote("");
    setAgreedAmt("");
    setAgreedDate("");
    setInterLoading(true);
    try {
      const data = await feesApi.getDueInteractions(st.id);
      setInteractions(Array.isArray(data) ? data : []);
    } catch { setInteractions([]); }
    finally { setInterLoading(false); }
  };

  const saveFollowUp = async () => {
    if (!followUp || !followNote.trim()) { toast_("Please enter a note."); return; }
    setSaving(true);
    try {
      await feesApi.createDueInteraction({
        student: followUp.id,
        interaction_type: "note",
        note: followNote,
        agreed_amount: agreedAmt || undefined,
        agreed_date: agreedDate || undefined,
      });
      toast_(`Follow-up saved for ${followUp.name}.`);
      setFollowUp(null);
    } catch { toast_("Failed to save follow-up."); }
    finally { setSaving(false); }
  };

  const sendReminders = async (ids?: string[]) => {
    const targets = ids ?? [...selSet];
    if (targets.length === 0) { toast_("Select students first."); return; }
    try {
      const res = await feesApi.sendDueReminders(targets, "Fee payment reminder from school administration.") as { sent: number };
      toast_(`Reminder sent to ${res.sent} student(s).`);
      setSelSet(new Set());
    } catch { toast_("Failed to send reminders."); }
  };

  const [reportLoading, setReportLoading] = useState(false);

  const generateReport = async () => {
    setReportLoading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
      const PW = doc.internal.pageSize.getWidth();
      const PH = doc.internal.pageSize.getHeight();
      const M  = 12;
      let y    = M;

      const tierLabel = TIERS.find(t => t.n === activeTier)?.label ?? "";
      const today     = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

      // ── Header bar ──────────────────────────────────────────
      doc.setFillColor(109, 74, 255);
      doc.rect(0, 0, PW, 16, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("DUES & REMINDERS REPORT", M, 11);
      doc.setFontSize(8); doc.setFont("helvetica", "normal");
      doc.text(`${tierLabel}  ·  Generated: ${today}`, PW - M, 11, { align: "right" });
      y = 24;

      // ── Summary boxes ────────────────────────────────────────
      if (summary) {
        const stats = [
          { label: "TOTAL OVERDUE",       value: fmtRs(parseFloat(summary.total_overdue_amount)) },
          { label: "STUDENTS WITH DUES",  value: String(summary.students_with_dues) },
          { label: "AVG DAYS OVERDUE",    value: String(summary.avg_days_overdue) },
          { label: "% COLLECTED",         value: `${summary.pct_collected}%` },
        ];
        const bw = (PW - M * 2 - 9) / 4;
        stats.forEach((s, i) => {
          const bx = M + i * (bw + 3);
          doc.setFillColor(248, 248, 251); doc.roundedRect(bx, y, bw, 14, 2, 2, "F");
          doc.setTextColor(160, 163, 184); doc.setFontSize(6.5); doc.setFont("helvetica", "bold");
          doc.text(s.label, bx + 3, y + 5);
          doc.setTextColor(24, 27, 42); doc.setFontSize(10); doc.setFont("helvetica", "bold");
          doc.text(s.value, bx + 3, y + 11);
        });
        y += 20;
      }

      // ── Column layout ────────────────────────────────────────
      const CW  = [58, 24, 30, 22, 34, 28]; // widths
      const COL = ["STUDENT", "ADM NO", "AMOUNT DUE", "DAYS", "LAST REMINDER", "STATUS"];
      const tableW = CW.reduce((a, b) => a + b, 0);

      const drawTableHeader = (ty: number) => {
        doc.setFillColor(240, 240, 248); doc.rect(M, ty, tableW, 6.5, "F");
        doc.setTextColor(100, 103, 130); doc.setFontSize(7); doc.setFont("helvetica", "bold");
        let cx = M + 2;
        COL.forEach((h, i) => { doc.text(h, cx, ty + 4.5); cx += CW[i]; });
        return ty + 7;
      };

      // ── Groups ───────────────────────────────────────────────
      filteredGroups.forEach(group => {
        if (y > PH - 40) { doc.addPage(); y = M; }

        // Class header
        doc.setFillColor(235, 232, 255); doc.rect(M, y, tableW, 7, "F");
        doc.setDrawColor(200, 190, 255); doc.rect(M, y, tableW, 7, "S");
        doc.setTextColor(80, 40, 200); doc.setFontSize(8.5); doc.setFont("helvetica", "bold");
        doc.text(`Class ${group.cls}  ·  ${group.students.length} student${group.students.length !== 1 ? "s" : ""} with dues`, M + 3, y + 5);
        y += 8;
        y = drawTableHeader(y);

        // Student rows
        group.students.forEach((st, ri) => {
          if (y > PH - 14) { doc.addPage(); y = M; y = drawTableHeader(y); }

          const rowBg = ri % 2 === 0 ? [255, 255, 255] : [250, 250, 254];
          doc.setFillColor(rowBg[0], rowBg[1], rowBg[2]); doc.rect(M, y, tableW, 7, "F");
          doc.setDrawColor(232, 232, 238); doc.line(M, y + 7, M + tableW, y + 7);

          doc.setTextColor(24, 27, 42); doc.setFontSize(8); doc.setFont("helvetica", "normal");

          const status = tierStatus(st.days_overdue);
          const vals   = [st.name, st.admNo, fmtRs(st.amount_due), String(st.days_overdue), fmtDate(st.last_reminder), status];
          const statusBg: Record<string, [number,number,number]> = {
            "Payment Watch": [254,243,199], "Escalated": [254,215,170], "Defaulter": [252,231,243],
          };
          const statusFg: Record<string, [number,number,number]> = {
            "Payment Watch": [217,119,6], "Escalated": [234,88,12], "Defaulter": [157,23,77],
          };

          let cx = M + 2;
          vals.forEach((v, i) => {
            if (i === 5) {
              const bg = statusBg[v] ?? [243,244,246];
              const fg = statusFg[v] ?? [55,65,81];
              const tw = doc.getTextWidth(v);
              doc.setFillColor(bg[0], bg[1], bg[2]); doc.roundedRect(cx, y + 1.5, tw + 5, 4.5, 1.2, 1.2, "F");
              doc.setTextColor(fg[0], fg[1], fg[2]); doc.setFont("helvetica", "bold");
              doc.text(v, cx + 2.5, y + 5);
              doc.setFont("helvetica", "normal"); doc.setTextColor(24, 27, 42);
            } else {
              doc.text(v, cx, y + 5);
            }
            cx += CW[i];
          });
          y += 7;
        });
        y += 5;
      });

      // ── Footer on every page ─────────────────────────────────
      const total = (doc as any).getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setTextColor(180, 180, 195); doc.setFontSize(7); doc.setFont("helvetica", "normal");
        doc.text(`Eskoolia School ERP  ·  Dues & Reminders Report  ·  Page ${p} of ${total}`, PW / 2, PH - 4, { align: "center" });
      }

      const dateStr = new Date().toISOString().split("T")[0];
      doc.save(`dues-report-tier${activeTier}-${dateStr}.pdf`);
      toast_("Report downloaded.");
    } catch (e) {
      console.error(e);
      toast_("Failed to generate report.");
    } finally {
      setReportLoading(false);
    }
  };

  const exportCSV = async () => {
    try {
      const res = await feesApi.exportDuesCSV();
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a"); a.href = url; a.download = "dues-report.csv"; a.click();
      URL.revokeObjectURL(url);
    } catch { toast_("Failed to export CSV."); }
  };

  // Pick first overdue student for the Late Fee Calculator preview
  const previewStudent = allStudents[0] ?? null;

  const STATS = summary ? [
    { label: "TOTAL OVERDUE AMOUNT", value: fmtRs(parseFloat(summary.total_overdue_amount)), sub: "Across unpaid and partial records" },
    { label: "STUDENTS WITH DUES",   value: String(summary.students_with_dues), sub: "Filtered by active academic year" },
    { label: "AVERAGE DAYS OVERDUE", value: String(summary.avg_days_overdue),   sub: "Weighted across due students" },
    { label: "% COLLECTED",          value: `${summary.pct_collected}%`,        sub: "Year-to-date collection" },
  ] : [];

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastUp { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        .dr-row:hover td { background:#FAFAFF!important; }
      `}</style>

      {/* ── Page header ───────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.09em", color:"#6D4AFF", marginBottom:5, textTransform:"uppercase" }}>Collections Follow-up</div>
          <h1 style={{ margin:"0 0 6px", fontSize:34, fontWeight:800, color:"#181B2A", lineHeight:1.1 }}>Dues &amp; Reminders</h1>
          <p style={{ margin:0, fontSize:14, color:"#A0A3B8" }}>Escalation tiers, class-wise due lists, and a detailed interaction log for each student.</p>
        </div>
        <button style={{ ...oBtn(), marginTop:8 }} onClick={exportCSV}>Export CSV</button>
      </div>

      {/* ── Stats grid ────────────────────────────────────────── */}
      {STATS.length > 0 && (
        <>
          <div style={{ display:"flex", border:"1px solid #E8E8EE", borderRadius:12, overflow:"hidden", background:"#fff" }}>
            {STATS.map((s, i) => (
              <div key={s.label} style={{ flex:1, padding:"22px 24px", borderLeft:`4px solid ${STAT_BORDERS[i]}`, borderRight: i < STATS.length - 1 ? "1px solid #E8E8EE" : "none" }}>
                <div style={{ fontSize:10.5, fontWeight:700, letterSpacing:"0.07em", color:"#A0A3B8", marginBottom:10, textTransform:"uppercase" as const }}>{s.label}</div>
                <div style={{ fontSize:28, fontWeight:800, color:"#181B2A", lineHeight:1.1, marginBottom:6 }}>{s.value}</div>
                <div style={{ fontSize:12.5, color:"#A0A3B8" }}>{s.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ height:3, background:"linear-gradient(90deg,#F97316 0%,#F59E0B 25%,#6D4AFF 50%,#16a34a 100%)", marginBottom:20 }}/>
        </>
      )}

      {/* ── Tier tabs + actions ───────────────────────────────── */}
      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:20, flexWrap:"wrap" as const }}>
        {TIERS.map(t => (
          <button key={t.n} onClick={() => setActiveTier(t.n)} style={{
            height:36, padding:"0 18px",
            border: activeTier === t.n ? "none" : "1px solid #E8E8EE",
            borderRadius:20,
            background: activeTier === t.n ? "#6D4AFF" : "#fff",
            color: activeTier === t.n ? "#fff" : "#5B5E72",
            fontSize:13, fontWeight: activeTier === t.n ? 600 : 400,
            cursor:"pointer", transition:"all 0.15s",
            boxShadow: activeTier === t.n ? "0 2px 8px rgba(109,74,255,0.22)" : "none",
          }}>{t.label}</button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", gap:8 }}>
          <button style={oBtn()} onClick={() => sendReminders()}>Send Reminder to All Selected</button>
          <button style={{ ...oBtn(), opacity: reportLoading ? 0.7 : 1 }} onClick={generateReport} disabled={reportLoading}>
            {reportLoading ? "Generating…" : "Generate Report"}
          </button>
        </div>
      </div>

      {/* ── Late Fee Calculator Preview ───────────────────────── */}
      {previewStudent && (
        <div style={{ background:"#fff", border:"1px solid #E8E8EE", borderRadius:12, padding:"20px 24px", marginBottom:20 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:16 }}>
            <div>
              <div style={{ fontSize:15, fontWeight:700, color:"#181B2A", marginBottom:3 }}>Late Fee Calculator Preview</div>
              <div style={{ fontSize:13, color:"#A0A3B8" }}>Transparent penalty calculation shown before reminder, receipt, or ledger posting.</div>
            </div>
            <button style={oBtn()} onClick={() => toast_("Breakdown copied to clipboard.")}>Copy Breakdown</button>
          </div>
          <div style={{ border:"1px solid #E8E8EE", borderRadius:10, padding:"16px 18px" }}>
            <div style={{ fontSize:14, fontWeight:600, color:"#181B2A", marginBottom:3 }}>
              {previewStudent.name} · Outstanding Fee
            </div>
            <div style={{ fontSize:12.5, color:"#A0A3B8", marginBottom:14 }}>
              Overdue by {previewStudent.days_overdue} days · Amount due: {fmtRs(previewStudent.amount_due)}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:10 }}>
              {[
                { label:"OUTSTANDING",     value: fmtRs(previewStudent.amount_due) },
                { label:"DAYS OVERDUE",    value: String(previewStudent.days_overdue) },
                { label:"CHARGEABLE DAYS", value: String(Math.max(0, previewStudent.days_overdue - 7)) },
                { label:"STATUS",          value: previewStudent.status },
                { label:"CLASS",           value: `Class ${previewStudent.cls}` },
              ].map(s => (
                <div key={s.label} style={{ padding:"12px 14px", border:"1px solid #E8E8EE", borderRadius:8 }}>
                  <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.07em", color:"#A0A3B8", marginBottom:6 }}>{s.label}</div>
                  <div style={{ fontSize:15, fontWeight:700, color:"#181B2A" }}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Class sections ────────────────────────────────────── */}
      {loading ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#A0A3B8", fontSize:14 }}>Loading dues data…</div>
      ) : filteredGroups.length === 0 ? (
        <div style={{ textAlign:"center", padding:"60px 0", color:"#A0A3B8", fontSize:14 }}>No overdue students found for this tier.</div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
          {filteredGroups.map(group => {
            const { cls, total_students, assigned_students, students: clsStudents } = group;
            const isExpanded = expanded.has(cls);
            const allSel = clsStudents.length > 0 && clsStudents.every(s => selSet.has(s.id));

            return (
              <div key={cls} style={{ background:"#fff", border:"1px solid #E8E8EE", borderRadius:12, overflow:"hidden" }}>

                {/* Section header */}
                <div style={{ display:"flex", alignItems:"center", gap:14, padding:"15px 20px" }}>
                  <div style={{ width:4, height:44, borderRadius:2, background:"#6D4AFF", flexShrink:0 }}/>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:15, fontWeight:700, color:"#181B2A", marginBottom:3 }}>Class {cls}</div>
                    <div style={{ fontSize:12.5, color:"#A0A3B8" }}>
                      {total_students} students · {assigned_students} assigned · {Math.max(0, total_students - assigned_students)} unassigned
                    </div>
                  </div>
                  <button style={oBtn(true)} onClick={() => sendReminders(clsStudents.map(s => s.id))}>Remind All</button>
                  <span style={{ fontSize:12, fontWeight:600, padding:"4px 10px", borderRadius:20, background:"#FEE2E2", color:"#DC2626", flexShrink:0 }}>
                    {clsStudents.length} due
                  </span>
                  <button onClick={() => toggleExpand(cls)} style={{ width:30, height:30, border:"1px solid #E8E8EE", borderRadius:7, background:"#fff", color:"#5B5E72", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition:"transform 0.2s" }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                </div>

                {/* Student table */}
                {isExpanded && (
                  <div style={{ borderTop:"1px solid #E8E8EE", animation:"fadeIn 0.15s ease" }}>
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ background:"#F8F8FB" }}>
                          <th style={{ ...TH, width:44 }}>
                            <input type="checkbox" checked={allSel} onChange={() => {
                              if (allSel) setSelSet(p => { const n = new Set(p); clsStudents.forEach(s => n.delete(s.id)); return n; });
                              else        setSelSet(p => { const n = new Set(p); clsStudents.forEach(s => n.add(s.id));    return n; });
                            }}/>
                          </th>
                          <th style={TH}>STUDENT</th>
                          <th style={TH}>AMOUNT DUE</th>
                          <th style={TH}>DAYS OVERDUE</th>
                          <th style={TH}>LAST REMINDER</th>
                          <th style={TH}>FEE STATUS</th>
                          <th style={TH}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {clsStudents.map((st, i) => (
                          <tr key={st.id} className="dr-row"
                            onClick={() => openFollowUp(st)}
                            style={{ borderBottom: i < clsStudents.length - 1 ? "1px solid #E8E8EE" : "none", background: selSet.has(st.id) ? "#F5F3FF" : "#fff", cursor:"pointer" }}>
                            <td style={{ ...TD, width:44 }} onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={selSet.has(st.id)} onChange={() => toggleSel(st.id)}/>
                            </td>
                            <td style={TD}>
                              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                                <div style={{ width:36, height:36, borderRadius:"50%", flexShrink:0, background:avBg(st.name), color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:12.5, fontWeight:700 }}>{ini(st.name)}</div>
                                <div>
                                  <div style={{ fontSize:13.5, fontWeight:600, color:"#181B2A" }}>{st.name}</div>
                                  <div style={{ fontSize:12, color:"#A0A3B8", marginTop:2 }}>{st.admNo} · Class {st.cls}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ ...TD, fontWeight:600 }}>{fmtRs(st.amount_due)}</td>
                            <td style={{ ...TD, fontWeight:600, color: st.days_overdue > 30 ? "#DC2626" : st.days_overdue > 15 ? "#D97706" : "#181B2A" }}>{st.days_overdue}</td>
                            <td style={{ ...TD, color:"#5B5E72" }}>{fmtDate(st.last_reminder)}</td>
                            <td style={TD}>
                              <span style={{ fontSize:12, fontWeight:600, padding:"4px 12px", borderRadius:20, background:STATUS_STYLE[tierStatus(st.days_overdue)].bg, color:STATUS_STYLE[tierStatus(st.days_overdue)].color, whiteSpace:"nowrap" as const }}>
                                {tierStatus(st.days_overdue)}
                              </span>
                            </td>
                            <td style={TD} onClick={e => e.stopPropagation()}>
                              <div style={{ display:"flex", gap:8 }}>
                                <button style={pBtn(true)} onClick={() => openResolveModal(st)}>Resolve</button>
                                <button style={oBtn(true)} onClick={() => openFollowUp(st)}>Log Call</button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Follow-up Side Panel ──────────────────────────────── */}
      {followUp && (
        <>
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.18)", zIndex:400 }} onClick={() => setFollowUp(null)}/>
          <div style={{ position:"fixed", top:0, right:0, bottom:0, width:400, background:"#fff", borderLeft:"1px solid #E8E8EE", boxShadow:"-8px 0 32px rgba(0,0,0,0.12)", zIndex:500, display:"flex", flexDirection:"column", animation:"slideIn 0.22s ease" }}>
            {/* Header */}
            <div style={{ padding:"18px 20px 14px", borderBottom:"1px solid #E8E8EE", flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:16, fontWeight:700, color:"#181B2A", marginBottom:3 }}>{followUp.name} Follow-up</div>
                  <div style={{ fontSize:12, color:"#A0A3B8" }}>{followUp.admNo} · Class {followUp.cls} · Due {fmtRs(followUp.amount_due)}</div>
                </div>
                <button onClick={() => setFollowUp(null)} style={{ width:28, height:28, borderRadius:6, border:"1px solid #E8E8EE", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16, color:"#A0A3B8" }}>×</button>
              </div>
            </div>

            {/* Body */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 20px" }}>
              {/* Student card */}
              <div style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#F5F3FF", border:"1px solid #c4b5fd", borderRadius:10, marginBottom:18 }}>
                <div style={{ width:40, height:40, borderRadius:"50%", background:avBg(followUp.name), color:"#fff", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:700, flexShrink:0 }}>{ini(followUp.name)}</div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:14, fontWeight:700, color:"#181B2A", marginBottom:2 }}>{followUp.name}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:6 }}>
                    {followUp.last_reminder
                      ? <span style={{ fontSize:11.5, color:"#6D4AFF", fontWeight:500 }}>Reminder sent</span>
                      : <span style={{ fontSize:11.5, color:"#A0A3B8" }}>{followUp.days_overdue} days overdue</span>
                    }
                  </div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:5, flexShrink:0 }}>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20, background:STATUS_STYLE[tierStatus(followUp.days_overdue)].bg, color:STATUS_STYLE[tierStatus(followUp.days_overdue)].color }}>
                    {tierStatus(followUp.days_overdue)}
                  </span>
                  <span style={{ fontSize:11, fontWeight:700, padding:"2px 9px", borderRadius:20, background:"#FEE2E2", color:"#DC2626" }}>unpaid</span>
                </div>
              </div>

              {/* Interaction timeline */}
              {interLoading ? (
                <div style={{ fontSize:13, color:"#A0A3B8", textAlign:"center", padding:"12px 0" }}>Loading history…</div>
              ) : interactions.length > 0 ? (
                <div style={{ marginBottom:20 }}>
                  {interactions.map((e, i) => (
                    <div key={e.id} style={{ display:"flex", gap:12, paddingBottom: i < interactions.length - 1 ? 14 : 0 }}>
                      <div style={{ display:"flex", flexDirection:"column", alignItems:"center", flexShrink:0 }}>
                        <div style={{ width:10, height:10, borderRadius:"50%", background:"#6D4AFF", marginTop:3, flexShrink:0 }}/>
                        {i < interactions.length - 1 && <div style={{ width:2, flex:1, background:"#E8E8EE", marginTop:4 }}/>}
                      </div>
                      <div style={{ paddingBottom: i < interactions.length - 1 ? 14 : 0 }}>
                        <div style={{ fontSize:13.5, fontWeight:600, color:"#181B2A", marginBottom:2 }}>{e.note}</div>
                        <div style={{ fontSize:11.5, color:"#A0A3B8" }}>{fmtDate(e.created_at)} · {e.created_by_name || "System"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize:13, color:"#A0A3B8", marginBottom:20, textAlign:"center", padding:"12px 0" }}>No interaction log yet.</div>
              )}

              {/* Add note */}
              <div style={{ marginBottom:16 }}>
                <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>ADD NOTE / LOG CALL</div>
                <textarea
                  value={followNote}
                  onChange={e => setFollowNote(e.target.value)}
                  placeholder="e.g. Spoke to parent. Expected payment by end of month."
                  style={{ width:"100%", minHeight:80, border:"1px solid #E8E8EE", borderRadius:9, padding:"10px 12px", fontSize:13.5, resize:"vertical", boxSizing:"border-box" as const, fontFamily:"inherit" }}
                />
              </div>

              {/* Agreed amount + date */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", color:"#A0A3B8", marginBottom:7 }}>AGREED AMOUNT</div>
                  <input value={agreedAmt} onChange={e => setAgreedAmt(e.target.value)} type="number" placeholder="0"
                    style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, boxSizing:"border-box" as const }}/>
                </div>
                <div>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.07em", color:"#A0A3B8", marginBottom:7 }}>AGREED DATE</div>
                  <input value={agreedDate} onChange={e => setAgreedDate(e.target.value)} type="date"
                    style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, boxSizing:"border-box" as const }}/>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding:"14px 20px", borderTop:"1px solid #E8E8EE", flexShrink:0 }}>
              <button
                style={{ ...pBtn(), width:"100%", height:40, fontSize:14, borderRadius:9, opacity: saving ? 0.7 : 1 }}
                onClick={saveFollowUp}
                disabled={saving}
              >
                {saving ? "Saving…" : "Save Follow-up"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Resolve Outstanding Dues Modal ───────────────────── */}
      {resolveTarget && (
        <>
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.35)", zIndex:600 }} onClick={() => !resolveSaving && setResolveTarget(null)}/>
          <div style={{ position:"fixed", top:"50%", left:"50%", transform:"translate(-50%,-50%)", width:520, maxHeight:"90vh", background:"#fff", borderRadius:16, boxShadow:"0 24px 64px rgba(0,0,0,0.22)", zIndex:700, display:"flex", flexDirection:"column", animation:"fadeIn 0.18s ease" }}>

            {/* Header */}
            <div style={{ padding:"20px 24px 14px", borderBottom:"1px solid #E8E8EE", flexShrink:0 }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                <div>
                  <div style={{ fontSize:17, fontWeight:700, color:"#181B2A", marginBottom:3 }}>Resolve Outstanding Dues</div>
                  <div style={{ fontSize:12.5, color:"#A0A3B8" }}>{resolveTarget.name} · {resolveTarget.admNo} · Due: {fmtRs(resolveTarget.amount_due)} · {resolveTarget.days_overdue} days overdue</div>
                </div>
                <button onClick={() => setResolveTarget(null)} disabled={resolveSaving} style={{ width:28, height:28, borderRadius:6, border:"1px solid #E8E8EE", background:"#fff", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16, color:"#A0A3B8" }}>×</button>
              </div>
              <div style={{ fontSize:13, color:"#5B5E72", marginTop:10 }}>Choose one action to resolve or progress this student's outstanding balance.</div>
            </div>

            {/* Scrollable body */}
            <div style={{ flex:1, overflowY:"auto", padding:"16px 24px 20px" }}>

              {/* Action cards */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom: resolveAction ? 18 : 0 }}>
                {RESOLVE_ACTIONS.map(act => {
                  const sel = resolveAction === act.key;
                  return (
                    <button key={act.key} onClick={() => setResolveAction(sel ? "" : act.key)}
                      style={{ padding:"12px 14px", border: sel ? "2px solid #6D4AFF" : "1px solid #E8E8EE", borderRadius:10, background: sel ? "#F5F3FF" : "#fff", textAlign:"left", cursor:"pointer", transition:"all 0.12s" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                        <span style={{ fontSize:14 }}>{act.emoji}</span>
                        <span style={{ fontSize:13.5, fontWeight:600, color:"#181B2A" }}>{act.label}</span>
                      </div>
                      <div style={{ fontSize:12, color:"#A0A3B8", lineHeight:1.4 }}>{act.sub}</div>
                    </button>
                  );
                })}
              </div>

              {/* Write Off sub-form */}
              {resolveAction === "write_off" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>REASON FOR WRITE-OFF</div>
                    <select value={woReason} onChange={e => setWoReason(e.target.value)}
                      style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, background:"#fff" }}>
                      {WO_REASONS.map(r => <option key={r}>{r}</option>)}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>APPROVED BY</div>
                    <input value={woApproved} onChange={e => setWoApproved(e.target.value)} placeholder="Principal"
                      style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, boxSizing:"border-box" as const }}/>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>NOTE</div>
                    <textarea value={woNote} onChange={e => setWoNote(e.target.value)} placeholder="Additional context for audit trail..."
                      style={{ width:"100%", minHeight:72, border:"1px solid #E8E8EE", borderRadius:9, padding:"10px 12px", fontSize:13.5, resize:"vertical", boxSizing:"border-box" as const, fontFamily:"inherit" }}/>
                  </div>
                </div>
              )}

              {/* Escalate sub-form */}
              {resolveAction === "escalate" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>ESCALATE TO</div>
                      <select value={escTo} onChange={e => setEscTo(e.target.value)}
                        style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, background:"#fff" }}>
                        {ESC_TO.map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>PRIORITY</div>
                      <select value={escPriority} onChange={e => setEscPriority(e.target.value)}
                        style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, background:"#fff" }}>
                        {["High","Medium","Low"].map(r => <option key={r}>{r}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>NOTES</div>
                    <textarea value={escNotes} onChange={e => setEscNotes(e.target.value)} placeholder="Summary for escalation report..."
                      style={{ width:"100%", minHeight:80, border:"1px solid #E8E8EE", borderRadius:9, padding:"10px 12px", fontSize:13.5, resize:"vertical", boxSizing:"border-box" as const, fontFamily:"inherit" }}/>
                  </div>
                </div>
              )}

              {/* Payment Plan sub-form */}
              {resolveAction === "payment_plan" && (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12 }}>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>INSTALMENT 1</div>
                      <input value={ppInst1} onChange={e => setPpInst1(e.target.value)} type="number" placeholder="Amount"
                        style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, boxSizing:"border-box" as const }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>DUE DATE</div>
                      <input value={ppDue1} onChange={e => setPpDue1(e.target.value)} type="date"
                        style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, boxSizing:"border-box" as const }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>INSTALMENT 2</div>
                      <input value={ppInst2} onChange={e => setPpInst2(e.target.value)} type="number" placeholder="Amount"
                        style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, boxSizing:"border-box" as const }}/>
                    </div>
                    <div>
                      <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>DUE DATE</div>
                      <input value={ppDue2} onChange={e => setPpDue2(e.target.value)} type="date"
                        style={{ width:"100%", height:40, border:"1px solid #E8E8EE", borderRadius:9, padding:"0 12px", fontSize:13.5, boxSizing:"border-box" as const }}/>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:7 }}>AGREEMENT NOTE</div>
                    <textarea value={ppNote} onChange={e => setPpNote(e.target.value)} placeholder="e.g. Parent confirmed via phone on 27 May 2026"
                      style={{ width:"100%", minHeight:72, border:"1px solid #E8E8EE", borderRadius:9, padding:"10px 12px", fontSize:13.5, resize:"vertical", boxSizing:"border-box" as const, fontFamily:"inherit" }}/>
                  </div>
                </div>
              )}

              {/* Offboarding checklist */}
              {resolveAction === "start_offboarding" && (
                <div>
                  <div style={{ fontSize:10, fontWeight:700, letterSpacing:"0.08em", color:"#A0A3B8", marginBottom:10 }}>STUDENT OFFBOARDING CHECKLIST</div>
                  <div style={{ display:"flex", flexDirection:"column", gap:4 }}>
                    {OB_CHECKLIST.map(item => (
                      <label key={item} style={{ display:"flex", alignItems:"center", gap:12, padding:"10px 14px", border:"1px solid #E8E8EE", borderRadius:8, cursor:"pointer", background: obChecked.has(item) ? "#FAFAFF" : "#fff" }}>
                        <input type="checkbox" checked={obChecked.has(item)}
                          onChange={() => setObChecked(p => { const n = new Set(p); n.has(item) ? n.delete(item) : n.add(item); return n; })}
                          style={{ width:15, height:15, accentColor:"#6D4AFF" }}/>
                        <span style={{ fontSize:13.5, color:"#181B2A" }}>{item}</span>
                      </label>
                    ))}
                  </div>
                  <div style={{ fontSize:12, color:"#A0A3B8", marginTop:10, fontStyle:"italic" }}>All items must be checked before the record can be archived.</div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding:"14px 24px", borderTop:"1px solid #E8E8EE", flexShrink:0, display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button style={{ ...oBtn(), minWidth:80 }} onClick={() => setResolveTarget(null)} disabled={resolveSaving}>Cancel</button>
              <button
                style={{ ...pBtn(), minWidth:150, opacity: (!resolveAction || resolveSaving || (resolveAction === "start_offboarding" && obChecked.size < OB_CHECKLIST.length)) ? 0.5 : 1 }}
                onClick={handleConfirmAction}
                disabled={!resolveAction || resolveSaving || (resolveAction === "start_offboarding" && obChecked.size < OB_CHECKLIST.length)}
              >
                {resolveSaving ? "Processing…" : "Confirm Action"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:24, right:24, background:"#1e293b", color:"#fff", padding:"12px 20px", borderRadius:10, fontSize:13.5, fontWeight:500, boxShadow:"0 8px 28px rgba(0,0,0,0.22)", zIndex:9999, maxWidth:420, animation:"toastUp 0.2s ease" }}>
          {toast}
        </div>
      )}
    </>
  );
}
