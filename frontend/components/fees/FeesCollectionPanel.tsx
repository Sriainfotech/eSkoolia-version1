"use client";
import { useState, useMemo, useEffect } from "react";
import { feesApi, listData } from "@/lib/fees-api";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Due { id:string; label:string; amount:number; due:string; }
interface LedgerEntry { date:string; title:string; note:string; amount:number|null; type:"charge"|"credit"|"note"; }

function fmtDate(d: string): string {
  if (!d) return "";
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const [y,m,day] = d.split("-");
  if (!y || !m || !day) return d;
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`;
}
interface LateFeeCalc { label:string; dueRule:string; outstanding:number; daysOverdue:number; chargeableDays:number; rawPenalty:number; finalDue:number; }
interface StudentRecord { id:string; name:string; admNo:string; cls:string; group:string; status:"partial"|"cleared"|"overdue"|"unassigned"; dues:Due[]; ledger:LedgerEntry[]; fullLedger:LedgerEntry[]; ledgerBalance:number; lateFeeCalc?:LateFeeCalc; }
interface Payment { rcpt:string; student:string; amount:number; method:string; }
type Tab = "collection" | "ledger" | "payments";

// ── Mock data ──────────────────────────────────────────────────────────────────






// ── Helpers ────────────────────────────────────────────────────────────────────
const AV_COLORS = ["#6D4AFF","#0E7490","#16a34a","#d97706","#dc2626","#7C3AED","#0284c7","#9333ea","#ca8a04","#059669"];
function avBg(n:string){let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))>>>0;return AV_COLORS[h%AV_COLORS.length];}
function ini(n:string){const p=n.trim().split(" ");return(p[0][0]+(p[1]?.[0]??"")).toUpperCase();}
function fmtRs(n:number){return"Rs. "+n.toLocaleString("en-IN");}

function pBtn(sm=false):React.CSSProperties{return{height:sm?32:38,padding:sm?"0 14px":"0 20px",background:"#6D4AFF",color:"#fff",border:"none",borderRadius:sm?7:9,fontSize:sm?12.5:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(109,74,255,0.20)"};}
function oBtn(sm=false):React.CSSProperties{return{height:sm?32:38,padding:sm?"0 14px":"0 16px",background:"#fff",color:"#181B2A",border:"1px solid #E8E8EE",borderRadius:sm?7:9,fontSize:sm?12.5:13,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"};}

const CARD:React.CSSProperties={background:"#fff",border:"1px solid #E8E8EE",borderRadius:12,padding:"20px 24px"};
const TH:React.CSSProperties={padding:"10px 14px",fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",textAlign:"left",borderBottom:"1px solid #E8E8EE"};
const TD:React.CSSProperties={padding:"13px 14px",fontSize:13,color:"#181B2A",verticalAlign:"top"};

const ST_STYLE:{[k:string]:{bg:string;color:string}}={
  partial:    {bg:"#FEF3C7",color:"#D97706"},
  cleared:    {bg:"#DCFCE7",color:"#15803D"},
  overdue:    {bg:"#FEE2E2",color:"#DC2626"},
  unassigned: {bg:"#F3F4F6",color:"#6B7280"},
};
const RC_STYLE:{[k:string]:{bg:string;color:string}}={
  "Matched":      {bg:"#DCFCE7",color:"#15803D"},
  "Review":       {bg:"#FEF3C7",color:"#D97706"},
  "Needs mapping":{bg:"#FEE2E2",color:"#DC2626"},
};

function Avatar({name,size=36}:{name:string;size?:number}){
  return <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,background:avBg(name),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:size*0.35,fontWeight:700}}>{ini(name)}</div>;
}
function ScoreCircle({score}:{score:number}){
  const col=score>=90?"#16a34a":score>=70?"#d97706":"#dc2626";
  const bg =score>=90?"#dcfce7":score>=70?"#fef3c7":"#fee2e2";
  return <div style={{width:40,height:40,borderRadius:"50%",background:bg,color:col,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0}}>{score}%</div>;
}
function StatusPill({label,style}:{label:string;style:{bg:string;color:string}}){
  return <span style={{fontSize:11.5,fontWeight:600,padding:"3px 10px",borderRadius:20,background:style.bg,color:style.color}}>{label}</span>;
}

// ── Main component ─────────────────────────────────────────────────────────────
const METHOD_MAP: Record<string, string> = {
  "Cash": "cash", "Online": "online", "Bank Transfer": "bank",
  "Cheque": "cheque", "Wallet": "wallet",
};

function parseDateTimeToISO(dateStr: string): string {
  const [datePart, timePart] = dateStr.split(" ");
  const parts = datePart.split("-");
  if (parts[0].length === 4) return `${datePart}T${timePart || "00:00"}:00`;
  const [dd, mm, yyyy] = parts;
  return `${yyyy}-${mm}-${dd}T${timePart || "00:00"}:00`;
}

export default function FeesCollectionPanel() {
  const [studentsData, setStudentsData] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [paymentsList, setPaymentsList] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reconList, setReconList] = useState<any[]>([]);
  const [showReconModal, setShowReconModal] = useState(false);
  const [reconForm, setReconForm] = useState({ reference:"", amount:"", method:"bank", date:"", status:"review", match_note:"", notes:"" });
  const [reconSaving, setReconSaving] = useState(false);
  const [schoolHeader, setSchoolHeader] = useState({ name:"Eskoolia School", address:"123 School Lane, City — 000000", email:"admissions@eskoolia.in", logo_url:"" });
  const [showHeaderModal, setShowHeaderModal] = useState(false);
  const [headerDraft, setHeaderDraft] = useState<typeof schoolHeader>(schoolHeader);
  // Store only the selected student ID; derive the full record reactively from STUDENTS.
  // This ensures the ledger view auto-updates after refreshPaymentData() without any manual setSelected() call.
  const [selectedId, setSelectedId] = useState<string|null>(null);

  const fetchDynamicData = async () => {
    setLoading(true);
    // Use allSettled so a 500 on one endpoint doesn't block others from loading
    const [stRes, asgnRes, payRes, grpRes, reconRes, schoolRes] = await Promise.allSettled([
      feesApi.listStudents(),
      feesApi.listAssignments(),
      feesApi.listPayments(),
      feesApi.listGroups(),
      feesApi.listReconciliations(),
      feesApi.getMySchoolInfo(),
    ]);
    if (stRes.status    === "fulfilled") setStudentsData(listData(stRes.value));
    if (asgnRes.status  === "fulfilled") setAssignments(listData(asgnRes.value));
    if (payRes.status   === "fulfilled") setPaymentsList(listData(payRes.value));
    if (grpRes.status   === "fulfilled") setGroups(listData(grpRes.value));
    if (reconRes.status === "fulfilled") setReconList(listData(reconRes.value));
    if (schoolRes.status === "fulfilled") {
      const s = schoolRes.value as any;
      setSchoolHeader({
        name:     s.name     || "Eskoolia School",
        address:  s.address  || "",
        email:    s.email    || "",
        logo_url: s.logo_url || "",
      });
    }
    if (asgnRes.status === "rejected") console.error("Assignments failed:", asgnRes.reason);
    if (payRes.status  === "rejected") console.error("Payments failed:",    payRes.reason);
    setLoading(false);
  };

  const refreshPaymentData = async () => {
    const [asgnRes, payRes] = await Promise.allSettled([
      feesApi.listAssignments(),
      feesApi.listPayments(),
    ]);
    if (asgnRes.status === "fulfilled") setAssignments(listData(asgnRes.value));
    if (payRes.status  === "fulfilled") setPaymentsList(listData(payRes.value));
    if (asgnRes.status === "rejected")  console.error("Assignments refresh failed:", asgnRes.reason);
  };

  useEffect(() => {
    fetchDynamicData();
    const onVisible = () => { if (document.visibilityState === "visible") refreshPaymentData(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  const STUDENTS = useMemo(() => {
    return studentsData.map(st => {
      // Use String() for comparison — API can return IDs as number or string
      const stAsgns = assignments.filter(a => String(a.student) === String(st.id));
      const stPays  = paymentsList.filter(p => p.assignment && stAsgns.some(a => String(a.id) === String(p.assignment)));

      const ledger: LedgerEntry[] = [];
      let totalDue  = 0;
      let totalPaid = 0;
      const dues: Due[] = [];

      // Deduplicate assignments by (fees_type + due_date).
      // When duplicates exist (same fee type same due date), prefer the PAID one — so if the
      // student paid one of two duplicate records, the fee doesn't keep appearing as a due.
      const asgnByKey = new Map<string, any>();
      const statusRank = (s: string) => s === "paid" ? 2 : s === "partial" ? 1 : 0;
      stAsgns.forEach(a => {
        const key = `${a.fees_type}-${a.due_date}`;
        const existing = asgnByKey.get(key);
        if (!existing || statusRank(a.status) > statusRank(existing.status)) {
          asgnByKey.set(key, a); // keep the most-settled duplicate
        }
      });
      const uniqueAsgns = Array.from(asgnByKey.values());

      uniqueAsgns.forEach((a, i) => {
        const amt      = parseFloat(a.amount || "0");
        const feeLabel = a.fees_type_name || `Fee Assignment ${i + 1}`;
        totalDue += amt;

        // Pending (non-posted, non-reversed) payments also reduce what's still owed,
        // even though the backend's net_due only counts posted payments.
        const pendingPays = stPays.filter(p =>
          String(p.assignment) === String(a.id) &&
          p.status !== "posted" && p.status !== "reversed"
        );
        const pendingAmt = pendingPays.reduce((sum, p) => sum + parseFloat(p.amount_paid || "0"), 0);

        const dueStatus = a.status === "paid"    ? "Paid in full"
          : a.status === "partial"               ? "Partially paid"
          : pendingPays.length > 0               ? "Payment pending verification"
          : "Pending payment";
        ledger.push({ date: a.due_date || "2025-01-01", title: `${feeLabel} assigned`, note: `Due ${fmtDate(a.due_date || "")} · ${dueStatus}`, amount: amt, type: "charge" });

        if (a.status !== "paid") {
          const netDue = parseFloat(a.net_due || a.amount || "0");
          // Deduct pending payments so fees paid via bank/cheque/online don't keep showing
          const effectiveRemaining = Math.max(0, netDue - pendingAmt);
          if (effectiveRemaining > 0) {
            dues.push({ id: a.id.toString(), label: feeLabel, amount: effectiveRemaining, due: a.due_date || "N/A" });
          }
        }
      });

      const METHOD_LABEL: Record<string, string> = {
        cash: "Cash", online: "Online / UPI", bank: "Bank Transfer", cheque: "Cheque", wallet: "Wallet",
      };
      const STATUS_LABEL: Record<string, string> = {
        posted: "Settled", pending_clearance: "Pending clearance", pending_reconciliation: "Pending reconciliation",
        pending_verification: "Pending verification", reversed: "Reversed",
      };
      stPays.forEach(p => {
        const pAmt = parseFloat(p.amount_paid || "0");
        if (p.status === "posted") totalPaid += pAmt;
        const mLabel = METHOD_LABEL[p.method] || p.method || "Payment";
        const sLabel = STATUS_LABEL[p.status] || p.status || "";
        ledger.push({
          date: (p.paid_at || "").split("T")[0] || "2025-01-01",
          title: `Payment received — ${mLabel}`,
          note: sLabel,
          amount: pAmt,
          type: "credit",
        });
      });

      let status: "partial" | "cleared" | "overdue" | "unassigned";
      if (uniqueAsgns.length === 0) {
        status = "unassigned";  // No fees have been assigned yet
      } else if (totalDue === 0) {
        status = "cleared";     // Assigned but all amounts are zero (fully discounted)
      } else if (totalPaid >= totalDue) {
        status = "cleared";     // All dues paid
      } else if (totalPaid > 0) {
        status = "partial";     // Some paid, some remaining
      } else {
        status = "overdue";     // Has fees, no payments made yet
      }

      return {
        id: st.id.toString(),
        name: `${st.first_name || ""} ${st.last_name || ""}`.trim(),
        admNo: st.admission_no || `ID-${st.id}`,
        cls: st.current_class_name || "N/A",
        group: "Assigned",
        status: status,
        dues: dues,
        ledger: ledger,
        fullLedger: ledger,
        ledgerBalance: totalDue - totalPaid,
      };
    });
  }, [studentsData, assignments, paymentsList]);

  const INIT_PAYMENTS = useMemo(() => {
    return [...paymentsList]
      .sort((a, b) => (b.id || 0) - (a.id || 0))  // newest first
      .map((p) => {
        const stuRecord = STUDENTS.find(s => String(s.id) === String(p.student));
        const stuRaw    = !stuRecord ? studentsData.find((s: any) => String(s.id) === String(p.student)) : null;
        const name      = stuRecord?.name
          || (stuRaw ? `${stuRaw.first_name || ""} ${stuRaw.last_name || ""}`.trim() : "")
          || "Unknown";
        const asgn      = assignments.find((a: any) => String(a.id) === String(p.assignment));
        const stuData   = studentsData.find((s: any) => String(s.id) === String(p.student));
        return {
          id:      p.id,
          rcpt:    `PMT-${p.id}`,
          student: name,
          admNo:   stuData?.admission_no || stuRecord?.admNo || `STU-${p.student}`,
          cls:     stuData?.current_class_name || stuRecord?.cls || "—",
          feeName: asgn?.fees_type_name || "",
          amount:  parseFloat(p.amount_paid || "0"),
          method:  p.method || "cash",
          status:  p.status || "posted",
          date:    fmtDate((p.paid_at || "").split("T")[0]),
          txRef:   p.transaction_reference || "",
          noteText:p.note || "",
        };
      });
  }, [paymentsList, STUDENTS, studentsData, assignments]);

  // Derive the full selected student record reactively from STUDENTS.
  // When refreshPaymentData() updates assignments/paymentsList → STUDENTS recomputes →
  // selected automatically reflects the fresh ledger balance without any manual setSelected() call.
  const selected = useMemo<StudentRecord | null>(
    () => (selectedId ? (STUDENTS.find(s => s.id === selectedId) ?? null) : null),
    [STUDENTS, selectedId]
  );

  const [searchQ,     setSearchQ]     = useState("");
  const [showDrop,    setShowDrop]    = useState(false);
  const [isFocused,   setIsFocused]   = useState(false);
  const [checked,     setChecked]     = useState<Set<string>>(new Set());
  const [amtPaid,     setAmtPaid]     = useState("0");
  const [method,      setMethod]      = useState("Cash");
  const [dateTime,    setDateTime]    = useState("27-05-2026 10:30");
  const [note,        setNote]        = useState("Parent requested receipt copy by email.");
  // payments is derived from INIT_PAYMENTS (reactive memo) — no separate state needed
  const [rcptN,       setRcptN]       = useState(5315);
  const [toast,       setToast]       = useState("");
  const [activeTab,    setActiveTab]    = useState<Tab>("collection");
  const [showLedger,   setShowLedger]   = useState(false);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [printNow,     setPrintNow]     = useState(true);
  const [sendSMS,      setSendSMS]      = useState(false);
  const [collectedBy,  setCollectedBy]  = useState("Finance Desk");
  const [counter,      setCounter]      = useState("Counter 1");

  const toast_ = (m:string)=>{setToast(m);setTimeout(()=>setToast(""),3000);};

  const saveRecon = async () => {
    if (!reconForm.reference.trim()) { toast_("Reference / UTR is required."); return; }
    if (!reconForm.amount || isNaN(parseFloat(reconForm.amount))) { toast_("Enter a valid amount."); return; }
    if (!reconForm.date) { toast_("Date is required."); return; }
    setReconSaving(true);
    try {
      const created = await feesApi.createReconciliation({
        reference:  reconForm.reference.trim(),
        amount:     reconForm.amount,
        method:     reconForm.method as any,
        date:       reconForm.date,
        status:     reconForm.status as any,
        match_note: reconForm.match_note.trim(),
        notes:      reconForm.notes.trim(),
        score:      0,
      });
      setReconList(prev => [created, ...prev]);
      setShowReconModal(false);
      setReconForm({ reference:"", amount:"", method:"bank", date:"", status:"review", match_note:"", notes:"" });
      toast_("Reconciliation record added.");
    } catch (err) {
      console.error(err);
      toast_("Failed to save. Please try again.");
    } finally {
      setReconSaving(false);
    }
  };

  const results = useMemo(()=>{
    const q=searchQ.toLowerCase().trim();
    if(!q) return [];
    return STUDENTS.filter(s=>s.name.toLowerCase().includes(q)||s.admNo.toLowerCase().includes(q));
  },[searchQ, STUDENTS]);

  const pick = (s:StudentRecord)=>{
    setSelectedId(s.id); setSearchQ(s.name); setShowDrop(false);
    const ids=new Set(s.dues.map(d=>d.id)); setChecked(ids);
    setAmtPaid(String(s.dues.reduce((a,d)=>a+d.amount,0)));
    setNote(""); setMethod("Cash");
  };

  const toggle = (id:string)=>{
    const n=new Set(checked); n.has(id)?n.delete(id):n.add(id); setChecked(n);
    setAmtPaid(String(selected?.dues.filter(d=>n.has(d.id)).reduce((a,d)=>a+d.amount,0)??0));
  };

  const save=()=>{
    if(!selected||checked.size===0){toast_("Select a student and at least one item.");return;}
    setShowConfirm(true);
  };

  const postPayment = async () => {
    if (!selected || isSaving) return;
    setIsSaving(true);
    try {
      const r = `RCPT-25-${rcptN}`;
      const paidAt = parseDateTimeToISO(dateTime);
      const backendMethod = METHOD_MAP[method] || "cash";
      for (const due of selDues) {
        const dueAmt = selDues.length === 1 ? (parseInt(amtPaid) || due.amount) : due.amount;
        // Do NOT send student or status — backend derives them (student from assignment,
        // status from method via FeeService). Sending them causes a TypeError in post_payment().
        await feesApi.createPayment({
          assignment: Number(due.id),
          amount_paid: String(dueAmt),
          method: backendMethod as any,
          paid_at: paidAt,
          note: note || "",
        } as any);
      }
      // Refresh from server — STUDENTS memo recomputes → selected auto-updates with new balance
      await refreshPaymentData();
      // paymentsList refreshed via refreshPaymentData() above → INIT_PAYMENTS recomputes automatically
      setRcptN(n => n + 1);
      setShowConfirm(false);
      toast_(`Receipt ${r} posted for ${selected.name}.`);
      // Keep selected student visible so the user sees the updated ledger immediately
      setChecked(new Set()); setAmtPaid("0"); setNote(""); setMethod("Cash");
    } catch (err) {
      console.error("Payment failed:", err);
      toast_("Payment failed. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const selDues = selected?.dues.filter(d=>checked.has(d.id))??[];
  // When multiple dues are selected every due is paid in full — amtPaid is irrelevant.
  // When a single due is selected the user may enter a partial amount.
  const total = selDues.length === 1 ? (parseInt(amtPaid)||0) : selDues.reduce((s,d)=>s+d.amount,0);
  const nextR   = `RCPT-25-${rcptN}`;

  const downloadReceipt = (p: typeof INIT_PAYMENTS[0]) => {
    const METHOD_LABEL: Record<string,string> = { cash:"Cash", bank:"Bank Transfer", online:"Online / UPI", wallet:"Wallet", cheque:"Cheque" };
    const STATUS_CFG: Record<string,{label:string;bg:string;color:string;border:string}> = {
      posted:                {label:"Settled",                  bg:"#dcfce7",color:"#15803d",border:"#86efac"},
      pending_clearance:     {label:"Pending Clearance",        bg:"#fef3c7",color:"#d97706",border:"#fde68a"},
      pending_reconciliation:{label:"Pending Reconciliation",   bg:"#fef3c7",color:"#d97706",border:"#fde68a"},
      pending_verification:  {label:"Pending Verification",     bg:"#ede9fe",color:"#7c3aed",border:"#c4b5fd"},
      reversed:              {label:"Reversed",                 bg:"#fee2e2",color:"#dc2626",border:"#fca5a5"},
    };
    const st = STATUS_CFG[p.status] || STATUS_CFG.posted;
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Receipt ${p.rcpt}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;background:#fff;color:#181B2A}
.page{width:620px;margin:0 auto;padding:48px 40px}
.header{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:24px;border-bottom:2px solid #E8E8EE}
.header-left{display:flex;align-items:center;gap:16px}
.logo{width:60px;height:60px;border-radius:12px;background:#F3F4F6;display:flex;align-items:center;justify-content:center;font-size:34px;border:1px solid #E8E8EE;flex-shrink:0}
.school-name{font-size:22px;font-weight:700;color:#181B2A;margin-bottom:4px}
.school-addr{font-size:12px;color:#6B7280;line-height:1.5}
.rcpt-badge{background:#6D4AFF;color:#fff;font-size:11px;font-weight:700;padding:6px 16px;border-radius:20px;letter-spacing:0.08em;white-space:nowrap}
.receipt-title{font-size:20px;font-weight:700;color:#181B2A;margin-bottom:6px}
.receipt-sub{font-size:13px;color:#A0A3B8}
.rcpt-no{color:#6D4AFF;font-weight:700}
.amount-box{background:#F8F7FF;border:2px solid #6D4AFF;border-radius:12px;padding:20px 24px;margin:20px 0;display:flex;justify-content:space-between;align-items:center}
.amount-label{font-size:13px;color:#6D4AFF;font-weight:600}
.amount-value{font-size:28px;font-weight:800;color:#6D4AFF}
.section-title{font-size:10px;font-weight:700;letter-spacing:0.1em;color:#A0A3B8;text-transform:uppercase;margin-bottom:10px;margin-top:24px}
.row{display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid #F3F4F6}
.row:last-child{border-bottom:none}
.row-label{font-size:13px;color:#6B7280}
.row-value{font-size:13px;font-weight:600;color:#181B2A;text-align:right;max-width:55%}
.status-pill{display:inline-block;font-size:11px;font-weight:600;padding:3px 10px;border-radius:20px;background:${st.bg};color:${st.color};border:1px solid ${st.border}}
.note-box{padding:12px 16px;background:#F8F8FB;border-radius:8px;font-size:12.5px;color:#6B7280;line-height:1.5;margin-top:8px}
.footer{margin-top:40px;padding-top:16px;border-top:1px solid #E8E8EE;font-size:11px;color:#A0A3B8;text-align:center;line-height:1.7}
@media print{body{print-color-adjust:exact;-webkit-print-color-adjust:exact}@page{size:A4;margin:20mm}}
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div class="header-left">
      <div class="logo">&#127979;</div>
      <div>
        <div class="school-name">${schoolHeader.name}</div>
        <div class="school-addr">${schoolHeader.address}${schoolHeader.email ? ` &middot; ${schoolHeader.email}` : ""}</div>
      </div>
    </div>
    <div class="rcpt-badge">RECEIPT</div>
  </div>

  <div class="receipt-title">Payment Receipt</div>
  <div class="receipt-sub">Receipt No: <span class="rcpt-no">${p.rcpt}</span></div>

  <div class="amount-box">
    <div class="amount-label">Amount Paid</div>
    <div class="amount-value">Rs.&nbsp;${p.amount.toLocaleString("en-IN")}</div>
  </div>

  <div class="section-title">Payment Details</div>
  <div class="row"><span class="row-label">Date</span><span class="row-value">${p.date || "—"}</span></div>
  <div class="row"><span class="row-label">Payment Method</span><span class="row-value">${METHOD_LABEL[p.method] || p.method}</span></div>
  ${p.txRef ? `<div class="row"><span class="row-label">Transaction Reference</span><span class="row-value">${p.txRef}</span></div>` : ""}
  ${p.feeName ? `<div class="row"><span class="row-label">Fee Type</span><span class="row-value">${p.feeName}</span></div>` : ""}
  <div class="row"><span class="row-label">Status</span><span class="row-value"><span class="status-pill">${st.label}</span></span></div>

  <div class="section-title">Student Details</div>
  <div class="row"><span class="row-label">Student Name</span><span class="row-value">${p.student}</span></div>
  <div class="row"><span class="row-label">Admission No.</span><span class="row-value">${p.admNo}</span></div>
  <div class="row"><span class="row-label">Class</span><span class="row-value">${p.cls}</span></div>

  ${p.noteText ? `<div class="section-title">Notes</div><div class="note-box">${p.noteText}</div>` : ""}

  <div class="footer">
    This is a computer-generated receipt and does not require a signature.<br>
    ${schoolHeader.name}${schoolHeader.email ? ` &middot; ${schoolHeader.email}` : ""}
  </div>
</div>
</body>
</html>`;
    const win = window.open("", "_blank", "width=720,height=900");
    if (win) { win.document.write(html); win.document.close(); }
  };

  const generateLedgerPDF = async () => {
    if (!selected) return;

    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF("p", "mm", "a4");

    const W = 210;
    const M = 16;           // margin
    const CW = W - 2 * M;   // content width
    let y = M;

    const checkPage = (need: number) => {
      if (y + need > 282) { doc.addPage(); y = M; }
    };

    // ── LOGO IMAGE (school logo or 🏫 emoji via canvas) ──────────
    const getLogoDataUrl = (): string => {
      if (schoolHeader.logo_url) return schoolHeader.logo_url;
      // Render the school building emoji onto a canvas and export as PNG data URL
      const c = document.createElement("canvas");
      c.width = 64; c.height = 64;
      const ctx = c.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, 64, 64);
        ctx.font = "44px serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("🏫", 32, 34);
      }
      return c.toDataURL("image/png");
    };
    const logoDataUrl = getLogoDataUrl();

    // ── HEADER ──────────────────────────────────────────────────
    doc.setFillColor(248, 248, 251);
    doc.roundedRect(M, y, CW, 24, 2, 2, "F");

    // Logo box background
    doc.setFillColor(243, 244, 246);
    doc.setDrawColor(232, 232, 238);
    doc.setLineWidth(0.3);
    doc.roundedRect(M + 3, y + 4, 16, 16, 2, 2, "FD");
    // Embed logo image
    doc.addImage(logoDataUrl, "PNG", M + 3, y + 4, 16, 16);

    // School name
    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(24, 27, 42);
    doc.text(schoolHeader.name || "School", M + 23, y + 10);

    // School address/email
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(107, 114, 128);
    const addrLine = [schoolHeader.address, schoolHeader.email].filter(Boolean).join("  ·  ");
    doc.text(addrLine, M + 23, y + 17);

    // LEDGER badge
    doc.setFillColor(109, 74, 255);
    doc.roundedRect(W - M - 22, y + 8, 18, 8, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.5);
    doc.setTextColor(255, 255, 255);
    doc.text("LEDGER", W - M - 13, y + 13.2, { align: "center" });

    y += 30;

    // Divider
    doc.setDrawColor(232, 232, 238);
    doc.setLineWidth(0.4);
    doc.line(M, y, W - M, y);
    y += 7;

    // ── STUDENT CARD ─────────────────────────────────────────────
    doc.setFillColor(245, 243, 255);
    doc.setDrawColor(196, 181, 253);
    doc.setLineWidth(0.4);
    doc.roundedRect(M, y, CW, 18, 2, 2, "FD");

    // Avatar
    doc.setFillColor(109, 74, 255);
    doc.circle(M + 11, y + 9, 7, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(ini(selected.name), M + 11, y + 11.5, { align: "center" });

    // Name + meta
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(24, 27, 42);
    doc.text(selected.name, M + 22, y + 8);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text(`${selected.admNo}  ·  Class ${selected.cls}`, M + 22, y + 14.5);

    // Status
    const STATUS_COL: Record<string,[number,number,number]> = {
      partial:[217,119,6], cleared:[21,128,61], overdue:[220,38,38], unassigned:[107,114,128],
    };
    const [sr,sg,sb] = STATUS_COL[selected.status] || STATUS_COL.unassigned;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(sr, sg, sb);
    doc.text(selected.status.charAt(0).toUpperCase() + selected.status.slice(1), W - M - 4, y + 10, { align: "right" });

    y += 24;

    // ── TABLE HEADER ─────────────────────────────────────────────
    doc.setFillColor(248, 248, 251);
    doc.setDrawColor(232, 232, 238);
    doc.setLineWidth(0.3);
    doc.rect(M, y, CW, 8, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(160, 163, 184);
    doc.text("DATE",        M + 3,       y + 5.5);
    doc.text("DESCRIPTION", M + 32,      y + 5.5);
    doc.text("AMOUNT",      W - M - 3,   y + 5.5, { align: "right" });
    y += 8;

    // ── TABLE ROWS ───────────────────────────────────────────────
    selected.fullLedger.forEach((e, i) => {
      const hasNote = !!e.note;
      const rowH = hasNote ? 14 : 10;
      checkPage(rowH);

      if (i % 2 === 0) {
        doc.setFillColor(250, 250, 252);
        doc.rect(M, y, CW, rowH, "F");
      }

      // Row bottom border
      doc.setDrawColor(243, 244, 246);
      doc.setLineWidth(0.2);
      doc.line(M, y + rowH, W - M, y + rowH);

      const textY = hasNote ? y + 5.5 : y + 6.5;

      // Date
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(107, 114, 128);
      doc.text(fmtDate(e.date), M + 3, textY);

      // Title
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(24, 27, 42);
      doc.text(e.title, M + 32, textY);

      // Note (sub-line)
      if (hasNote) {
        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(160, 163, 184);
        doc.text(e.note, M + 32, y + 11);
      }

      // Amount
      if (e.amount != null) {
        const isCredit = e.type === "credit";
        const isCharge = e.type === "charge";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        if (isCredit)      doc.setTextColor(21, 128, 61);
        else if (isCharge) doc.setTextColor(220, 38, 38);
        else               doc.setTextColor(107, 114, 128);
        const prefix = isCredit ? "-" : "";
        doc.text(`${prefix}Rs. ${e.amount.toLocaleString("en-IN")}`, W - M - 3, textY, { align: "right" });
      }

      y += rowH;
    });

    // Table outer border (bottom)
    doc.setDrawColor(232, 232, 238);
    doc.setLineWidth(0.3);
    doc.line(M, y, W - M, y);
    y += 9;

    // ── BALANCE ROW ──────────────────────────────────────────────
    checkPage(16);
    const balance = selected.ledgerBalance;
    const [br, bg_, bb] = balance <= 0 ? [21,128,61] : [220,38,38];

    doc.setFillColor(248, 247, 255);
    doc.setDrawColor(109, 74, 255);
    doc.setLineWidth(0.5);
    doc.roundedRect(M, y, CW, 14, 2, 2, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(109, 74, 255);
    doc.text("Ledger Balance", M + 5, y + 9);

    doc.setTextColor(br, bg_, bb);
    doc.setFontSize(11);
    const balLabel = balance <= 0 ? "(Settled)" : "(Due)";
    doc.text(`Rs. ${Math.abs(balance).toLocaleString("en-IN")}  ${balLabel}`, W - M - 5, y + 9, { align: "right" });

    y += 20;

    // ── FOOTER ───────────────────────────────────────────────────
    const footY = 287;
    doc.setDrawColor(232, 232, 238);
    doc.setLineWidth(0.3);
    doc.line(M, footY, W - M, footY);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(160, 163, 184);
    doc.text(
      `This is a computer-generated ledger statement.  ·  ${schoolHeader.name}`,
      W / 2, footY + 5, { align: "center" }
    );

    doc.save(`Ledger-${selected.name}-${selected.admNo}.pdf`);
  };

  return (
    <>
      <style>{`
        @keyframes fadeIn{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fc-hover:hover{background:#F5F3FF!important;}
        .fc-row:hover td{background:#FAFAFF!important;}
      `}</style>

      {/* ── Header ──────────────────────────────────────────────────── */}
      <div style={{marginBottom:24}}>
        <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.09em",color:"#6D4AFF",marginBottom:5,textTransform:"uppercase"}}>Payment Desk</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
          <div>
            <h1 style={{margin:"0 0 6px",fontSize:34,fontWeight:700,color:"#181B2A",lineHeight:1.1}}>Collection</h1>
            <p style={{margin:0,fontSize:14,color:"#A0A3B8"}}>Search a student, record payment across one or more assignments, and issue a receipt.</p>
          </div>
        </div>

        {/* ── Tab Navigation ── */}
        <div style={{display:"flex",gap:4,borderBottom:"2px solid #E8E8EE",paddingBottom:0}}>
          {([
            {key:"collection",label:"Collection"},
            {key:"ledger",    label:"Student Ledger"},
            {key:"payments",  label:"Recent Payments"},
          ] as {key:Tab;label:string}[]).map(t=>(
            <button
              key={t.key}
              onClick={()=>setActiveTab(t.key)}
              style={{
                padding:"10px 20px",
                border:"none",
                background:"transparent",
                fontSize:14,
                fontWeight:activeTab===t.key?700:500,
                color:activeTab===t.key?"#6D4AFF":"#5B5E72",
                cursor:"pointer",
                borderBottom:activeTab===t.key?"3px solid #6D4AFF":"3px solid transparent",
                marginBottom:"-2px",
                borderRadius:0,
                transition:"color 0.15s",
              }}
            >{t.label}</button>
          ))}
        </div>
      </div>

      {/* ── Collection Tab ───────────────────────────────────────────── */}
      {activeTab==="collection"&&<div style={{display:"grid",gridTemplateColumns:"1.15fr 1fr",gap:20,alignItems:"flex-start"}}>

        {/* ═══ LEFT ═══ */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* Student Search */}
          <div style={CARD}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:3}}>
              <div style={{fontSize:15,fontWeight:700,color:"#181B2A"}}>Student Search</div>
              <button style={oBtn(true)} onClick={fetchDynamicData} disabled={loading} title="Reload all data">
                {loading ? "Loading…" : "⟳ Refresh"}
              </button>
            </div>
            <div style={{fontSize:13,color:"#A0A3B8",marginBottom:16}}>Type a name or admission number to load outstanding assignments.</div>

            <div style={{position:"relative"}}>
              <div style={{display:"flex",alignItems:"center",border:"1px solid #E8E8EE",borderRadius:9,padding:"0 14px",height:42}}>
                <span style={{color:"#A0A3B8",fontSize:13.5,marginRight:10,flexShrink:0,fontWeight:500}}>Search</span>
                <input
                  value={searchQ}
                  onChange={e=>{setSearchQ(e.target.value);setShowDrop(true);if(selectedId&&e.target.value!==selected?.name)setSelectedId(null);}}
                  onFocus={()=>setShowDrop(true)}
                  style={{border:"none",outline:"none",flex:1,fontSize:13.5,color:"#181B2A",background:"transparent"}}
                />
              </div>

              {/* Dropdown */}
              {showDrop&&results.length>0&&!selected&&(
                <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:30,background:"#fff",border:"1px solid #E8E8EE",borderRadius:9,boxShadow:"0 8px 24px rgba(0,0,0,0.10)",overflow:"hidden",animation:"fadeIn 0.14s ease"}}>
                  {results.map(s=>(
                    <div key={s.id} className="fc-hover" onClick={()=>pick(s)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",cursor:"pointer",borderBottom:"1px solid #F0F0F0",background:"#fff"}}>
                      <Avatar name={s.name}/>
                      <div style={{flex:1}}>
                        <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A"}}>{s.name}</div>
                        <div style={{fontSize:12,color:"#A0A3B8"}}>{s.admNo} · Class {s.cls} · {s.group}</div>
                      </div>
                      <StatusPill label={s.status} style={ST_STYLE[s.status]}/>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Selected card */}
            {selected&&(
              <div style={{display:"flex",alignItems:"center",gap:12,marginTop:14,padding:"12px 16px",background:"#F5F3FF",border:"1px solid #c4b5fd",borderRadius:10}}>
                <Avatar name={selected.name} size={40}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#181B2A"}}>{selected.name}</div>
                  <div style={{fontSize:12.5,color:"#A0A3B8"}}>{selected.admNo} · Class {selected.cls} · {selected.group}</div>
                </div>
                <StatusPill label={selected.status} style={ST_STYLE[selected.status]}/>
              </div>
            )}
          </div>

          {/* Payment Form */}
          {selected&&(
            <div style={CARD}>
              <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>Payment Form</div>
              <div style={{fontSize:13,color:"#A0A3B8",marginBottom:18}}>Conditional cheque and transaction fields appear by method.</div>

              {/* Due items */}
              <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:20}}>
                {selected.dues.length===0&&(
                  <div style={{fontSize:13,padding:"10px 0",color:selected.status==="unassigned"?"#D97706":"#A0A3B8"}}>
                    {selected.status==="unassigned"
                      ? "No fees have been assigned to this student yet. Go to the Fee Assignment panel to assign fees first."
                      : "All assigned fees are fully paid. Nothing outstanding."}
                  </div>
                )}
                {selected.dues.map(due=>(
                  <label key={due.id} style={{display:"flex",alignItems:"center",gap:14,padding:"13px 16px",border:"1px solid",borderColor:checked.has(due.id)?"#c4b5fd":"#E8E8EE",borderRadius:9,cursor:"pointer",background:checked.has(due.id)?"#FAFAFF":"#fff"}}>
                    <input type="checkbox" checked={checked.has(due.id)} onChange={()=>toggle(due.id)} style={{accentColor:"#6D4AFF",width:16,height:16,flexShrink:0} as React.CSSProperties}/>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A"}}>{due.label}</div>
                      <div style={{fontSize:12,color:"#A0A3B8",marginTop:2}}>Due {due.due}</div>
                    </div>
                    <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A"}}>{fmtRs(due.amount)}</div>
                  </label>
                ))}
              </div>

              {/* Amount + Method */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:14}}>
                <div>
                  <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:7}}>AMOUNT PAID</div>
                  <input
                    value={selDues.length > 1 ? String(total) : amtPaid}
                    onChange={selDues.length > 1 ? undefined : e=>setAmtPaid(e.target.value)}
                    readOnly={selDues.length > 1}
                    type="number"
                    style={{width:"100%",height:40,border:"1px solid #E8E8EE",borderRadius:9,padding:"0 12px",fontSize:13.5,boxSizing:"border-box",background:selDues.length>1?"#F8F8FB":"#fff",cursor:selDues.length>1?"not-allowed":"text"}}/>
                  {selDues.length > 1 && (
                    <div style={{fontSize:11,color:"#A0A3B8",marginTop:4}}>Auto-calculated — paying {selDues.length} items in full</div>
                  )}
                </div>
                <div>
                  <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:7}}>PAYMENT METHOD</div>
                  <select value={method} onChange={e=>setMethod(e.target.value)} style={{width:"100%",height:40,border:"1px solid #E8E8EE",borderRadius:9,padding:"0 12px",fontSize:13.5,background:"#fff",cursor:"pointer"}}>
                    <option>Cash</option><option>Online</option><option>Bank Transfer</option><option>Cheque</option><option>Wallet</option>
                  </select>
                </div>
              </div>

              {/* Date/Time */}
              <div style={{marginBottom:14}}>
                <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:7}}>DATE / TIME</div>
                <div style={{position:"relative"}}>
                  <input value={dateTime} onChange={e=>setDateTime(e.target.value)}
                    style={{width:"100%",height:40,border:"1px solid #E8E8EE",borderRadius:9,padding:"0 40px 0 12px",fontSize:13.5,boxSizing:"border-box"}}/>
                  <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}>📅</span>
                </div>
              </div>

              {/* Note */}
              <div style={{marginBottom:20}}>
                <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:7}}>NOTE</div>
                <textarea value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note (optional)"
                  style={{width:"100%",minHeight:76,border:"1px solid #E8E8EE",borderRadius:9,padding:"10px 12px",fontSize:13.5,resize:"vertical",boxSizing:"border-box",fontFamily:"inherit"}}/>
              </div>

              <button style={{...pBtn(),height:42,fontSize:14}} onClick={save}>Save & Print Receipt</button>
            </div>
          )}
        </div>

        {/* ═══ RIGHT ═══ */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* Receipt Preview */}
          <div style={CARD}>
            <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>Receipt Preview</div>
            <div style={{fontSize:13,color:"#A0A3B8",marginBottom:16}}>Formatted preview before Save & Print Receipt.</div>
            {selected&&selDues.length>0 ? (
              <div style={{border:"1px solid #E8E8EE",borderRadius:10,padding:"18px 20px"}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:14}}>
                  <div>
                    <div style={{fontSize:20,fontWeight:700,color:"#181B2A",lineHeight:1.2}}>Eskoolia</div>
                    <div style={{fontSize:12,color:"#A0A3B8",marginTop:2}}>Aravali Public School</div>
                  </div>
                  <div style={{textAlign:"right"}}>
                    <div style={{fontSize:12.5,fontWeight:600,color:"#181B2A"}}>{nextR}</div>
                    <div style={{fontSize:12,color:"#A0A3B8",marginTop:2}}>{dateTime}</div>
                  </div>
                </div>
                <div style={{height:1,background:"#E8E8EE",marginBottom:12}}/>
                {[
                  {l:"Student",       v:selected.name},
                  {l:"Class / Adm No",v:`${selected.cls} / ${selected.admNo}`},
                  ...selDues.map(d=>({l:d.label,v:fmtRs(d.amount)})),
                  {l:"Payment Method",v:method},
                ].map((r,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #F8F8F8"}}>
                    <span style={{fontSize:13,color:"#5B5E72"}}>{r.l}</span>
                    <span style={{fontSize:13,fontWeight:500,color:"#181B2A"}}>{r.v}</span>
                  </div>
                ))}
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:12,marginTop:6}}>
                  <span style={{fontSize:13.5,fontWeight:600,color:"#181B2A"}}>Total Received</span>
                  <span style={{fontSize:17,fontWeight:700,color:"#6D4AFF"}}>{fmtRs(total)}</span>
                </div>
              </div>
            ) : (
              <div style={{textAlign:"center",padding:"32px 0",color:"#A0A3B8",fontSize:13,border:"1px dashed #E8E8EE",borderRadius:10}}>
                Select a student and fee items to preview receipt
              </div>
            )}
          </div>

          {/* Payment Reconciliation */}
          <div style={CARD}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>Payment Reconciliation</div>
                <div style={{fontSize:13,color:"#A0A3B8"}}>Match bank, online, wallet, and cheque records against receipts.</div>
              </div>
              <button style={pBtn(true)} onClick={()=>setShowReconModal(true)}>+ Add</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {reconList.length===0&&(
                <div style={{fontSize:13,color:"#A0A3B8",padding:"16px 0",textAlign:"center"}}>No reconciliation records yet. Click + Add to create one.</div>
              )}
              {reconList.map((r:any)=>{
                const STATUS_MAP:{[k:string]:{bg:string;color:string}}={
                  matched:      {bg:"#DCFCE7",color:"#15803D"},
                  review:       {bg:"#FEF3C7",color:"#D97706"},
                  needs_mapping:{bg:"#FEE2E2",color:"#DC2626"},
                };
                const LABEL:{[k:string]:string}={matched:"Matched",review:"Review",needs_mapping:"Needs mapping"};
                const METHOD_LABEL:{[k:string]:string}={cash:"Cash",bank:"Bank",online:"Online / UPI",cheque:"Cheque",wallet:"Wallet"};
                const s=STATUS_MAP[r.status]||STATUS_MAP.review;
                return(
                  <div key={r.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 16px",border:"1px solid #E8E8EE",borderRadius:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#181B2A",marginBottom:3}}>{r.reference}</div>
                      <div style={{fontSize:12,color:"#A0A3B8",marginBottom:4}}>{METHOD_LABEL[r.method]||r.method} · Rs. {parseFloat(r.amount||"0").toLocaleString("en-IN")} · {r.date}</div>
                      {r.match_note&&<div style={{fontSize:12,color:"#A0A3B8",marginBottom:8}}>{r.match_note}</div>}
                      <StatusPill label={LABEL[r.status]||r.status} style={s}/>
                    </div>
                    {r.score>0&&<ScoreCircle score={r.score}/>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Add Reconciliation Modal */}
          {showReconModal&&(
            <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowReconModal(false)}>
              <div style={{background:"#fff",borderRadius:14,padding:"28px 32px",width:480,maxWidth:"95vw",boxShadow:"0 12px 40px rgba(0,0,0,0.18)"}} onClick={e=>e.stopPropagation()}>
                <div style={{fontSize:17,fontWeight:700,color:"#181B2A",marginBottom:4}}>Add Reconciliation Record</div>
                <div style={{fontSize:13,color:"#A0A3B8",marginBottom:22}}>Manually log a bank / payment reference for matching against receipts.</div>

                {/* Reference */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>REFERENCE / UTR *</div>
                  <input value={reconForm.reference} onChange={e=>setReconForm(p=>({...p,reference:e.target.value}))}
                    placeholder="e.g. HDFC252705881 or CHQ842901"
                    style={{width:"100%",border:"1px solid #E8E8EE",borderRadius:8,padding:"9px 13px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>

                {/* Amount + Method */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  <div>
                    <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>AMOUNT *</div>
                    <input type="number" value={reconForm.amount} onChange={e=>setReconForm(p=>({...p,amount:e.target.value}))}
                      placeholder="0.00"
                      style={{width:"100%",border:"1px solid #E8E8EE",borderRadius:8,padding:"9px 13px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>METHOD</div>
                    <select value={reconForm.method} onChange={e=>setReconForm(p=>({...p,method:e.target.value}))}
                      style={{width:"100%",border:"1px solid #E8E8EE",borderRadius:8,padding:"9px 13px",fontSize:13,outline:"none",boxSizing:"border-box",background:"#fff"}}>
                      <option value="cash">Cash</option>
                      <option value="bank">Bank Transfer</option>
                      <option value="online">Online / UPI</option>
                      <option value="cheque">Cheque</option>
                      <option value="wallet">Wallet</option>
                    </select>
                  </div>
                </div>

                {/* Date + Status */}
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                  <div>
                    <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>DATE *</div>
                    <input type="date" value={reconForm.date} onChange={e=>setReconForm(p=>({...p,date:e.target.value}))}
                      style={{width:"100%",border:"1px solid #E8E8EE",borderRadius:8,padding:"9px 13px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                  </div>
                  <div>
                    <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>STATUS</div>
                    <select value={reconForm.status} onChange={e=>setReconForm(p=>({...p,status:e.target.value}))}
                      style={{width:"100%",border:"1px solid #E8E8EE",borderRadius:8,padding:"9px 13px",fontSize:13,outline:"none",boxSizing:"border-box",background:"#fff"}}>
                      <option value="review">Review</option>
                      <option value="matched">Matched</option>
                      <option value="needs_mapping">Needs Mapping</option>
                    </select>
                  </div>
                </div>

                {/* Match note */}
                <div style={{marginBottom:14}}>
                  <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>MATCH / CANDIDATE RECEIPT</div>
                  <input value={reconForm.match_note} onChange={e=>setReconForm(p=>({...p,match_note:e.target.value}))}
                    placeholder="e.g. Matched to RCPT-25-4218 · Aditi Nair"
                    style={{width:"100%",border:"1px solid #E8E8EE",borderRadius:8,padding:"9px 13px",fontSize:13,outline:"none",boxSizing:"border-box"}}/>
                </div>

                {/* Notes */}
                <div style={{marginBottom:22}}>
                  <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>NOTES</div>
                  <textarea value={reconForm.notes} onChange={e=>setReconForm(p=>({...p,notes:e.target.value}))}
                    placeholder="Any additional details…" rows={2}
                    style={{width:"100%",border:"1px solid #E8E8EE",borderRadius:8,padding:"9px 13px",fontSize:13,outline:"none",resize:"vertical",boxSizing:"border-box"}}/>
                </div>

                <div style={{display:"flex",gap:10,justifyContent:"flex-end"}}>
                  <button style={oBtn()} onClick={()=>setShowReconModal(false)} disabled={reconSaving}>Cancel</button>
                  <button style={pBtn()} onClick={saveRecon} disabled={reconSaving}>
                    {reconSaving?"Saving…":"Save Record"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>}

      {/* ── Student Ledger Tab ──────────────────────────────────────── */}
      {activeTab==="ledger"&&(
        <div>
          <div style={{marginBottom:20}}>
            <div style={{fontSize:22,fontWeight:700,color:"#181B2A",marginBottom:4}}>Student Ledger</div>
            <div style={{fontSize:14,color:"#A0A3B8"}}>Per-student accounting timeline of charges, concessions, payments, and adjustments.</div>
          </div>

          {/* Student search for ledger tab */}
          {!selected&&(
            <div style={{...CARD,maxWidth:540,marginBottom:20}}>
              <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A",marginBottom:10}}>Search a student to view their ledger</div>
              <div style={{position:"relative"}}>
                <div style={{display:"flex",alignItems:"center",border:"1px solid #E8E8EE",borderRadius:9,padding:"0 14px",height:42}}>
                  <span style={{color:"#A0A3B8",fontSize:13.5,marginRight:10,flexShrink:0,fontWeight:500}}>Search</span>
                  <input
                    value={searchQ}
                    onChange={e=>{setSearchQ(e.target.value);setShowDrop(true);setSelectedId(null);}}
                    onFocus={()=>setShowDrop(true)}
                    style={{border:"none",outline:"none",flex:1,fontSize:13.5,color:"#181B2A",background:"transparent"}}
                  />
                </div>
                {showDrop&&results.length>0&&!selected&&(
                  <div style={{position:"absolute",top:"calc(100% + 4px)",left:0,right:0,zIndex:30,background:"#fff",border:"1px solid #E8E8EE",borderRadius:9,boxShadow:"0 8px 24px rgba(0,0,0,0.10)",overflow:"hidden",animation:"fadeIn 0.14s ease"}}>
                    {results.map(s=>(
                      <div key={s.id} className="fc-hover" onClick={()=>pick(s)} style={{display:"flex",alignItems:"center",gap:12,padding:"11px 16px",cursor:"pointer",borderBottom:"1px solid #F0F0F0",background:"#fff"}}>
                        <Avatar name={s.name}/>
                        <div style={{flex:1}}>
                          <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A"}}>{s.name}</div>
                          <div style={{fontSize:12,color:"#A0A3B8"}}>{s.admNo} · Class {s.cls}</div>
                        </div>
                        <StatusPill label={s.status} style={ST_STYLE[s.status]}/>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {selected&&(
            <div style={CARD}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
                <div style={{display:"flex",alignItems:"center",gap:12}}>
                  <Avatar name={selected.name} size={42}/>
                  <div>
                    <div style={{fontSize:15,fontWeight:700,color:"#181B2A"}}>{selected.name}</div>
                    <div style={{fontSize:12.5,color:"#A0A3B8"}}>{selected.admNo} · Class {selected.cls} · {selected.group}</div>
                  </div>
                  <StatusPill label={selected.status} style={ST_STYLE[selected.status]}/>
                </div>
                <div style={{display:"flex",gap:8}}>
                  <button style={oBtn(true)} onClick={()=>{ setSelectedId(null); setSearchQ(""); }}>Change Student</button>
                  <button style={oBtn(true)} onClick={()=>setShowLedger(true)}>Full Ledger PDF</button>
                </div>
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {selected.ledger.map((e,i)=>(
                  <div key={i} style={{display:"flex",gap:14,padding:"13px 16px",border:"1px solid #F0F0F0",borderRadius:10,background:"#fff"}}>
                    <div style={{width:88,fontSize:11.5,color:"#A0A3B8",flexShrink:0,paddingTop:2,lineHeight:1.4}}>{fmtDate(e.date)}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:700,color:"#181B2A",marginBottom:3}}>{e.title}</div>
                      <div style={{fontSize:12,color:"#A0A3B8",lineHeight:1.4}}>{e.note}</div>
                    </div>
                    <div style={{fontSize:13.5,fontWeight:600,flexShrink:0,color:e.type==="credit"?"#16a34a":e.type==="charge"?"#dc2626":"#A0A3B8",paddingTop:2}}>
                      {e.amount!=null?(e.type==="credit"?"−":"")+"Rs. "+e.amount.toLocaleString("en-IN"):"Note"}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14,borderTop:"2px solid #E8E8EE"}}>
                <div style={{fontSize:14,color:"#5B5E72"}}>Ledger balance</div>
                <div style={{fontSize:22,fontWeight:700,color:"#6D4AFF"}}>Rs. {selected.ledgerBalance.toLocaleString("en-IN")}</div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Recent Payments Tab ─────────────────────────────────────── */}
      {activeTab==="payments"&&(
        <div>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20}}>
            <div>
              <div style={{fontSize:22,fontWeight:700,color:"#181B2A",marginBottom:4}}>Recent Payments</div>
              <div style={{fontSize:14,color:"#A0A3B8"}}>
                {loading ? "Loading…" : `${INIT_PAYMENTS.length} payment${INIT_PAYMENTS.length===1?"":"s"} across all students`}
              </div>
            </div>
            <div style={{display:"flex",gap:8}}>
              <button style={oBtn(true)} onClick={()=>{setHeaderDraft(schoolHeader);setShowHeaderModal(true);}}>Edit Header</button>
              <button style={oBtn(true)} onClick={refreshPaymentData}>Refresh</button>
            </div>
          </div>
          <div style={{...CARD,padding:0,overflow:"hidden"}}>
            {loading ? (
              <div style={{padding:"48px 0",textAlign:"center",color:"#A0A3B8",fontSize:13}}>Loading payments…</div>
            ) : (
              <table style={{width:"100%",borderCollapse:"collapse"}}>
                <thead>
                  <tr style={{background:"#F8F8FB"}}>
                    {["#","DATE","STUDENT","AMOUNT","METHOD","STATUS","ACTIONS"].map(h=>(
                      <th key={h} style={TH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {INIT_PAYMENTS.map((p,i)=>{
                    const STATUS_CFG: Record<string,{bg:string;color:string;border:string;label:string}> = {
                      posted:                   {bg:"#dcfce7",color:"#15803d",border:"#86efac",  label:"Posted"},
                      pending_clearance:         {bg:"#fef3c7",color:"#d97706",border:"#fde68a",  label:"Pending clearance"},
                      pending_reconciliation:    {bg:"#fef3c7",color:"#d97706",border:"#fde68a",  label:"Pending reconciliation"},
                      pending_verification:      {bg:"#ede9fe",color:"#7c3aed",border:"#c4b5fd",  label:"Pending verification"},
                      reversed:                  {bg:"#fee2e2",color:"#dc2626",border:"#fca5a5",  label:"Reversed"},
                    };
                    const cfg = STATUS_CFG[p.status] || STATUS_CFG.posted;
                    const METHOD_LABEL: Record<string,string> = {cash:"Cash",bank:"Bank Transfer",online:"Online / UPI",wallet:"Wallet",cheque:"Cheque"};
                    return (
                      <tr key={p.id} className="fc-row" style={{borderBottom:i<INIT_PAYMENTS.length-1?"1px solid #E8E8EE":"none"}}>
                        <td style={{...TD,fontWeight:600,fontSize:12,color:"#6D4AFF"}}>{p.rcpt}</td>
                        <td style={{...TD,fontSize:12,color:"#A0A3B8",whiteSpace:"nowrap"}}>{p.date||"—"}</td>
                        <td style={{...TD,fontWeight:600}}>{p.student}</td>
                        <td style={{...TD,fontWeight:700,color:"#181B2A"}}>{fmtRs(p.amount)}</td>
                        <td style={{...TD,fontSize:12}}>{METHOD_LABEL[p.method]||p.method}</td>
                        <td style={TD}>
                          <span style={{fontSize:11.5,fontWeight:600,padding:"3px 10px",borderRadius:20,background:cfg.bg,color:cfg.color,border:`1px solid ${cfg.border}`,whiteSpace:"nowrap"}}>
                            {cfg.label}
                          </span>
                        </td>
                        <td style={TD}>
                          <button style={oBtn(true)} onClick={()=>downloadReceipt(p)}>Receipt</button>
                        </td>
                      </tr>
                    );
                  })}
                  {INIT_PAYMENTS.length===0&&(
                    <tr><td colSpan={7} style={{...TD,textAlign:"center",color:"#A0A3B8",padding:"48px 0"}}>No payments have been posted yet.</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ── Confirm Payment Modal ───────────────────────────────── */}
      {showConfirm&&selected&&(
        <div style={{position:"fixed",inset:0,background:"rgba(14,16,32,0.40)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setShowConfirm(false)}>
          <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:600,boxShadow:"0 24px 64px rgba(0,0,0,0.22)",animation:"fadeIn 0.18s ease"}} onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 24px 16px"}}>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:"#181B2A",marginBottom:3}}>
                  Confirm {method} Payment
                </div>
                <div style={{fontSize:12,color:"#A0A3B8"}}>Verify before posting — this cannot be undone without a reversal.</div>
              </div>
              <button onClick={()=>setShowConfirm(false)} style={{width:30,height:30,borderRadius:"50%",border:"1px solid #E8E8EE",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:17,color:"#A0A3B8",lineHeight:1}}>×</button>
            </div>
            <div style={{height:1,background:"#E8E8EE",margin:"0 24px"}}/>

            <div style={{padding:"20px 24px"}}>
              {/* Amount spotlight */}
              <div style={{textAlign:"center",marginBottom:24}}>
                <div style={{fontSize:12.5,color:"#A0A3B8",marginBottom:8}}>Amount to post</div>
                <div style={{fontSize:36,fontWeight:700,color:"#6D4AFF",lineHeight:1,marginBottom:8}}>
                  Rs. {total.toLocaleString("en-IN")}
                </div>
                <div style={{fontSize:13,color:"#A0A3B8"}}>{selected.name} · {selected.admNo} · Class {selected.cls}</div>
              </div>

              {/* Per-due breakdown */}
              <div style={{border:"1px solid #E8E8EE",borderRadius:10,overflow:"hidden",marginBottom:20}}>
                {selDues.map((d,i)=>(
                  <div key={d.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"10px 16px",borderBottom:"1px solid #F0F0F0",background:"#FAFAFF"}}>
                    <span style={{fontSize:12.5,color:"#5B5E72"}}>{d.label}</span>
                    <span style={{fontSize:12.5,fontWeight:600,color:"#181B2A"}}>{fmtRs(selDues.length===1?(parseInt(amtPaid)||d.amount):d.amount)}</span>
                  </div>
                ))}
                {[
                  {label:"Receipt No (preview)", value:`RCPT-25-${rcptN}`},
                  {label:"Payment Method",       value:method},
                ].map((r,i)=>(
                  <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"12px 16px",borderBottom:i===0?"1px solid #F0F0F0":"none"}}>
                    <span style={{fontSize:13,color:"#5B5E72"}}>{r.label}</span>
                    <span style={{fontSize:13,fontWeight:600,color:"#181B2A"}}>{r.value}</span>
                  </div>
                ))}
              </div>

              {/* Collected By + Counter */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:20}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:7}}>COLLECTED BY</div>
                  <input value={collectedBy} onChange={e=>setCollectedBy(e.target.value)}
                    style={{width:"100%",height:40,border:"1px solid #E8E8EE",borderRadius:9,padding:"0 12px",fontSize:13.5,boxSizing:"border-box"}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:7}}>COUNTER / DRAWER</div>
                  <select value={counter} onChange={e=>setCounter(e.target.value)}
                    style={{width:"100%",height:40,border:"1px solid #E8E8EE",borderRadius:9,padding:"0 12px",fontSize:13.5,background:"#fff",cursor:"pointer"}}>
                    <option>Counter 1</option><option>Counter 2</option><option>Counter 3</option><option>Cashier Office</option>
                  </select>
                </div>
              </div>

              {/* Checkboxes */}
              <div style={{display:"flex",flexDirection:"column",gap:12,marginBottom:4}}>
                <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                  <input type="checkbox" checked={printNow} onChange={e=>setPrintNow(e.target.checked)} style={{accentColor:"#6D4AFF",width:16,height:16} as React.CSSProperties}/>
                  <span style={{fontSize:13.5,color:"#181B2A"}}>Print receipt now</span>
                </label>
                <label style={{display:"flex",alignItems:"center",gap:10,cursor:"pointer"}}>
                  <input type="checkbox" checked={sendSMS} onChange={e=>setSendSMS(e.target.checked)} style={{accentColor:"#6D4AFF",width:16,height:16} as React.CSSProperties}/>
                  <span style={{fontSize:13.5,color:"#181B2A"}}>Send receipt to parent via SMS / app</span>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div style={{display:"flex",justifyContent:"flex-end",gap:12,padding:"14px 24px",borderTop:"1px solid #E8E8EE"}}>
              <button style={{height:38,padding:"0 20px",border:"1px solid #E8E8EE",borderRadius:9,background:"#fff",color:"#181B2A",fontSize:13,fontWeight:500,cursor:"pointer"}} onClick={()=>setShowConfirm(false)}>Cancel</button>
              <button style={{height:38,padding:"0 20px",border:"none",borderRadius:9,background:isSaving?"#a78bfa":"#6D4AFF",color:"#fff",fontSize:13,fontWeight:600,cursor:isSaving?"not-allowed":"pointer",boxShadow:"0 2px 8px rgba(109,74,255,0.20)"}} onClick={postPayment} disabled={isSaving}>
                {isSaving ? "Posting…" : `Post ${method} Payment`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Ledger Modal ─────────────────────────────────── */}
      {showLedger&&selected&&(
        <div style={{position:"fixed",inset:0,background:"rgba(14,16,32,0.40)",zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",padding:24}} onClick={()=>setShowLedger(false)}>
          <div style={{background:"#fff",borderRadius:16,width:"100%",maxWidth:640,boxShadow:"0 24px 64px rgba(0,0,0,0.22)",animation:"fadeIn 0.18s ease",maxHeight:"88vh",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>

            {/* Header */}
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",padding:"20px 24px 16px",flexShrink:0}}>
              <div>
                <div style={{fontSize:17,fontWeight:700,color:"#181B2A",marginBottom:3}}>Student Ledger View</div>
                <div style={{fontSize:12,color:"#A0A3B8"}}>{selected.name} · {selected.admNo} · Class {selected.cls}</div>
              </div>
              <button onClick={()=>setShowLedger(false)} style={{width:30,height:30,borderRadius:"50%",border:"1px solid #E8E8EE",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:17,color:"#A0A3B8",lineHeight:1}}>×</button>
            </div>
            <div style={{height:1,background:"#E8E8EE",marginBottom:0,flexShrink:0}}/>

            {/* Scrollable body */}
            <div style={{overflowY:"auto",flex:1,padding:"16px 24px"}}>

              {/* Student card */}
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:"#F5F3FF",border:"1px solid #c4b5fd",borderRadius:10,marginBottom:16}}>
                <Avatar name={selected.name} size={40}/>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#181B2A"}}>{selected.name}</div>
                  <div style={{fontSize:12,color:"#A0A3B8"}}>{selected.admNo} · Class {selected.cls} · {selected.group}</div>
                </div>
                <StatusPill label={selected.status} style={ST_STYLE[selected.status]}/>
              </div>

              {/* Full ledger entries */}
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {selected.fullLedger.map((e,i)=>(
                  <div key={i} style={{display:"flex",gap:14,padding:"13px 16px",border:"1px solid #E8E8EE",borderRadius:10,background:"#fff"}}>
                    <div style={{width:88,fontSize:11.5,color:"#A0A3B8",flexShrink:0,paddingTop:2,lineHeight:1.4}}>{fmtDate(e.date)}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:700,color:"#181B2A",marginBottom:3}}>{e.title}</div>
                      <div style={{fontSize:12,color:"#A0A3B8",lineHeight:1.4}}>{e.note}</div>
                    </div>
                    <div style={{fontSize:13.5,fontWeight:600,flexShrink:0,color:e.type==="credit"?"#16a34a":e.type==="charge"?"#dc2626":"#A0A3B8",paddingTop:2}}>
                      {e.amount!=null?(e.type==="credit"?"−":"")+"Rs. "+e.amount.toLocaleString("en-IN"):"Note"}
                    </div>
                  </div>
                ))}
              </div>

              {/* Ledger balance */}
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"4px 0 20px"}}>
                <div style={{fontSize:14,color:"#5B5E72"}}>Ledger balance</div>
                <div style={{fontSize:20,fontWeight:700,color:"#6D4AFF"}}>Rs. {selected.ledgerBalance.toLocaleString("en-IN")}</div>
              </div>

              {/* Late Fee Calculator Preview */}
              {selected.lateFeeCalc&&(
                <div style={{border:"1px solid #E8E8EE",borderRadius:10,overflow:"hidden",marginBottom:4}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"13px 16px",background:"#F8F8FB",borderBottom:"1px solid #E8E8EE"}}>
                    <div>
                      <div style={{fontSize:13.5,fontWeight:700,color:"#181B2A",marginBottom:2}}>Late Fee Calculator Preview</div>
                      <div style={{fontSize:12,color:"#A0A3B8"}}>Transparent penalty calculation shown before reminder, receipt, or ledger posting.</div>
                    </div>
                    <button style={{height:32,padding:"0 14px",border:"1px solid #E8E8EE",borderRadius:7,background:"#fff",color:"#181B2A",fontSize:12.5,fontWeight:500,cursor:"pointer",flexShrink:0,marginLeft:12}} onClick={()=>toast_("Breakdown copied to clipboard.")}>Copy Breakdown</button>
                  </div>
                  <div style={{padding:"14px 16px",background:"#fff"}}>
                    <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A",marginBottom:4}}>{selected.lateFeeCalc.label}</div>
                    <div style={{fontSize:12,color:"#A0A3B8",marginBottom:14}}>{selected.lateFeeCalc.dueRule}</div>
                    <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
                      {[
                        {label:"OUTSTANDING",   value:"Rs. "+selected.lateFeeCalc.outstanding.toLocaleString("en-IN")},
                        {label:"DAYS OVERDUE",  value:String(selected.lateFeeCalc.daysOverdue)},
                        {label:"CHARGEABLE DAYS",value:String(selected.lateFeeCalc.chargeableDays)},
                        {label:"RAW PENALTY",   value:"Rs. "+selected.lateFeeCalc.rawPenalty.toLocaleString("en-IN")},
                        {label:"FINAL DUE",     value:"Rs. "+selected.lateFeeCalc.finalDue.toLocaleString("en-IN")},
                      ].map(s=>(
                        <div key={s.label} style={{border:"1px solid #E8E8EE",borderRadius:8,padding:"10px 12px"}}>
                          <div style={{fontSize:9.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>{s.label}</div>
                          <div style={{fontSize:14,fontWeight:700,color:"#181B2A"}}>{s.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{display:"flex",justifyContent:"flex-end",gap:10,padding:"14px 24px",borderTop:"1px solid #E8E8EE",flexShrink:0}}>
              <button style={{height:36,padding:"0 18px",border:"1px solid #E8E8EE",borderRadius:8,background:"#fff",color:"#181B2A",fontSize:13,fontWeight:500,cursor:"pointer"}} onClick={()=>setShowLedger(false)}>Close</button>
              <button style={{height:36,padding:"0 18px",border:"none",borderRadius:8,background:"#6D4AFF",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px rgba(109,74,255,0.20)"}} onClick={()=>generateLedgerPDF()}>Generate Ledger PDF</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Header Modal */}
      {showHeaderModal&&(
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.45)",zIndex:1100,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={()=>setShowHeaderModal(false)}>
          <div style={{background:"#fff",borderRadius:14,padding:"28px 32px",width:460,maxWidth:"95vw",boxShadow:"0 12px 40px rgba(0,0,0,0.18)"}} onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:17,fontWeight:700,color:"#181B2A",marginBottom:4}}>Edit Receipt Header</div>
            <div style={{fontSize:13,color:"#A0A3B8",marginBottom:22}}>This header appears at the top of every downloaded receipt.</div>

            {/* Preview */}
            <div style={{display:"flex",alignItems:"center",gap:14,padding:"16px",border:"1px solid #E8E8EE",borderRadius:10,background:"#F8F8FB",marginBottom:22}}>
              <div style={{width:52,height:52,borderRadius:10,background:"#F3F4F6",border:"1px solid #E8E8EE",display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>🏫</div>
              <div>
                <div style={{fontSize:16,fontWeight:700,color:"#181B2A",marginBottom:3}}>{headerDraft.name||"School Name"}</div>
                <div style={{fontSize:12,color:"#6B7280"}}>
                  {headerDraft.address||"School Address"}
                  {headerDraft.email ? ` · ${headerDraft.email}` : ""}
                </div>
              </div>
            </div>

            {[
              {label:"School Name",    key:"name",    placeholder:"e.g. Eskoolia School"},
              {label:"Address",        key:"address", placeholder:"e.g. 123 School Lane, City — 000000"},
              {label:"Email / Contact",key:"email",   placeholder:"e.g. admissions@eskoolia.in"},
            ].map(f=>(
              <div key={f.key} style={{marginBottom:14}}>
                <div style={{fontSize:12,fontWeight:600,color:"#5B5E72",marginBottom:6}}>{f.label}</div>
                <input
                  value={(headerDraft as any)[f.key]}
                  onChange={e=>setHeaderDraft(d=>({...d,[f.key]:e.target.value}))}
                  placeholder={f.placeholder}
                  style={{width:"100%",height:36,border:"1px solid #E8E8EE",borderRadius:8,padding:"0 12px",fontSize:13,outline:"none",boxSizing:"border-box"}}
                />
              </div>
            ))}

            <div style={{display:"flex",justifyContent:"flex-end",gap:10,marginTop:24}}>
              <button style={oBtn(true)} onClick={()=>setShowHeaderModal(false)}>Cancel</button>
              <button style={pBtn(true)} onClick={()=>{setSchoolHeader(headerDraft);setShowHeaderModal(false);}}>Save Header</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast&&(
        <div style={{position:"fixed",bottom:24,right:24,background:"#1e293b",color:"#fff",padding:"12px 20px",borderRadius:10,fontSize:13.5,fontWeight:500,boxShadow:"0 8px 28px rgba(0,0,0,0.22)",zIndex:9999,maxWidth:420,animation:"toastUp 0.2s ease"}}>
          {toast}
        </div>
      )}
    </>
  );
}
