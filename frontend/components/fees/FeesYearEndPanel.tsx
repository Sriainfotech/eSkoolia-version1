"use client";
import { useState } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type Resolution  =
  | "Carry dues to next year"
  | "Write off balance"
  | "Mark as scholarship / waiver"
  | "Legal follow-up"
  | "Discontinue — Archive student"
  | "Discontinue — Offboard & generate TC";
type FeeStatus   = "Pending" | "Payment Watch" | "Overdue" | "Escalated";

const SHORT_RES: Record<Resolution, string> = {
  "Carry dues to next year":             "Carry forward",
  "Write off balance":                   "Written off",
  "Mark as scholarship / waiver":        "Scholarship",
  "Legal follow-up":                     "Legal follow-up",
  "Discontinue — Archive student":       "Archived",
  "Discontinue — Offboard & generate TC":"Offboarded",
};

const FEE_STATUS_STYLE: Record<FeeStatus, { bg: string; color: string }> = {
  "Pending":       { bg:"#FEF3C7", color:"#D97706" },
  "Payment Watch": { bg:"#FEF3C7", color:"#D97706" },
  "Overdue":       { bg:"#FEE2E2", color:"#DC2626" },
  "Escalated":     { bg:"#FED7AA", color:"#EA580C" },
};

interface CFStudent {
  id: string; name: string; cls: string; group: string;
  outstanding: number; resolution: Resolution; feeStatus: FeeStatus;
}
interface CFClass { id: string; name: string; students: CFStudent[]; }

// ── Mock data ──────────────────────────────────────────────────────────────────
const CF_CLASSES: CFClass[] = [
  { id:"6a", name:"Class 6A", students:[
    { id:"s01", name:"Kabir Sharma",  cls:"6A", group:"Transport Users", outstanding:19580, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s02", name:"Ishaan Sharma", cls:"6A", group:"Full Boarder",    outstanding:78000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s03", name:"Meera Sharma",  cls:"6A", group:"Day Scholar",     outstanding:36000, feeStatus:"Payment Watch", resolution:"Carry dues to next year" },
    { id:"s04", name:"Neel Sharma",   cls:"6A", group:"Full Boarder",    outstanding:34320, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s05", name:"Tara Sharma",   cls:"6A", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s06", name:"Aryan Sharma",  cls:"6A", group:"Full Boarder",    outstanding:34320, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s07", name:"Nisha Sharma",  cls:"6A", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s08", name:"Devika Sharma", cls:"6A", group:"Transport Users", outstanding:44500, feeStatus:"Payment Watch", resolution:"Carry dues to next year" },
    { id:"s09", name:"Ayaan Sharma",  cls:"6A", group:"Day Scholar",     outstanding:15840, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s10", name:"Anika Sharma",  cls:"6A", group:"Transport Users", outstanding:44500, feeStatus:"Pending",       resolution:"Carry dues to next year" },
  ]},
  { id:"7b", name:"Class 7B", students:[
    { id:"s11", name:"Priya Verma",   cls:"7B", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s12", name:"Rahul Verma",   cls:"7B", group:"Transport Users", outstanding:44500, feeStatus:"Overdue",       resolution:"Carry dues to next year" },
    { id:"s13", name:"Neha Verma",    cls:"7B", group:"Full Boarder",    outstanding:78000, feeStatus:"Escalated",     resolution:"Carry dues to next year" },
    { id:"s14", name:"Karan Verma",   cls:"7B", group:"Day Scholar",     outstanding:52900, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s15", name:"Divya Verma",   cls:"7B", group:"Transport Users", outstanding:44500, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s16", name:"Gaurav Verma",  cls:"7B", group:"Day Scholar",     outstanding:36000, feeStatus:"Payment Watch", resolution:"Carry dues to next year" },
    { id:"s17", name:"Meena Verma",   cls:"7B", group:"Full Boarder",    outstanding:62400, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s18", name:"Suresh Verma",  cls:"7B", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
  ]},
  { id:"8a", name:"Class 8A", students:[
    { id:"s21", name:"Aman Patel",    cls:"8A", group:"Day Scholar",     outstanding:52900, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s22", name:"Esha Patel",    cls:"8A", group:"Transport Users", outstanding:44500, feeStatus:"Payment Watch", resolution:"Carry dues to next year" },
    { id:"s23", name:"Jatin Patel",   cls:"8A", group:"Full Boarder",    outstanding:78000, feeStatus:"Overdue",       resolution:"Carry dues to next year" },
    { id:"s24", name:"Komal Patel",   cls:"8A", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s25", name:"Nakul Patel",   cls:"8A", group:"Transport Users", outstanding:44500, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s26", name:"Smita Patel",   cls:"8A", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s27", name:"Vansh Patel",   cls:"8A", group:"Full Boarder",    outstanding:46800, feeStatus:"Pending",       resolution:"Carry dues to next year" },
  ]},
  { id:"9a", name:"Class 9A", students:[
    { id:"s31", name:"Chirag Kumar",  cls:"9A", group:"Day Scholar",     outstanding:52900, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s32", name:"Fatima Kumar",  cls:"9A", group:"Transport Users", outstanding:44500, feeStatus:"Payment Watch", resolution:"Carry dues to next year" },
    { id:"s33", name:"Krishna Kumar", cls:"9A", group:"Full Boarder",    outstanding:78000, feeStatus:"Escalated",     resolution:"Carry dues to next year" },
    { id:"s34", name:"Pallavi Kumar", cls:"9A", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s35", name:"Vedant Kumar",  cls:"9A", group:"Transport Users", outstanding:44500, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s36", name:"Aashi Kumar",   cls:"9A", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
    { id:"s37", name:"Dhanush Kumar", cls:"9A", group:"Full Boarder",    outstanding:62400, feeStatus:"Overdue",       resolution:"Carry dues to next year" },
    { id:"s38", name:"Ekta Kumar",    cls:"9A", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",       resolution:"Carry dues to next year" },
  ]},
  { id:"10b", name:"Class 10B", students:[
    { id:"s41", name:"Jai Singh",     cls:"10B", group:"Full Boarder",    outstanding:78000, feeStatus:"Pending",      resolution:"Carry dues to next year" },
    { id:"s42", name:"Madhav Singh",  cls:"10B", group:"Day Scholar",     outstanding:52900, feeStatus:"Pending",      resolution:"Carry dues to next year" },
    { id:"s43", name:"Onkar Singh",   cls:"10B", group:"Transport Users", outstanding:44500, feeStatus:"Payment Watch",resolution:"Carry dues to next year" },
    { id:"s44", name:"Rishabh Singh", cls:"10B", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",      resolution:"Carry dues to next year" },
    { id:"s45", name:"Varun Singh",   cls:"10B", group:"Full Boarder",    outstanding:46800, feeStatus:"Pending",      resolution:"Carry dues to next year" },
    { id:"s46", name:"Abhi Singh",    cls:"10B", group:"Day Scholar",     outstanding:36000, feeStatus:"Pending",      resolution:"Carry dues to next year" },
    { id:"s47", name:"Nishant Singh", cls:"10B", group:"Transport Users", outstanding:44500, feeStatus:"Pending",      resolution:"Carry dues to next year" },
  ]},
];

const TOTAL_STUDENTS = CF_CLASSES.reduce((s, c) => s + c.students.length, 0);

const REPORTS = [
  "Fee Collection Summary",
  "Class-wise Report",
  "Outstanding Dues Report",
  "Concession Report",
  "Payment Method Breakdown",
];

const WIZARD_STEPS = [
  { n:1, label:"Confirm totals"   },
  { n:2, label:"Set year & date"  },
  { n:3, label:"Copy structures"  },
  { n:4, label:"Execute rollover" },
];

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtInr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

function pBtn(sm = false): React.CSSProperties {
  return { height:sm?30:36, padding:sm?"0 12px":"0 18px", background:"#6D4AFF", color:"#fff", border:"none", borderRadius:sm?7:9, fontSize:sm?12:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap", boxShadow:"0 2px 8px rgba(109,74,255,0.20)" };
}
function oBtn(sm = false): React.CSSProperties {
  return { height:sm?30:36, padding:sm?"0 12px":"0 16px", background:"#fff", color:"#181B2A", border:"1px solid #E8E8EE", borderRadius:sm?7:9, fontSize:sm?12:13, fontWeight:500, cursor:"pointer", whiteSpace:"nowrap" };
}
const TH: React.CSSProperties = { padding:"10px 16px", fontSize:10.5, fontWeight:700, letterSpacing:"0.07em", color:"#A0A3B8", textAlign:"left", borderBottom:"1px solid #E8E8EE" };
const TD: React.CSSProperties = { padding:"13px 16px", fontSize:13.5, color:"#181B2A", verticalAlign:"middle" };

// ── Component ─────────────────────────────────────────────────────────────────
export default function FeesYearEndPanel() {
  const [applied,     setApplied]     = useState<Set<string>>(new Set(["s03"])); // Meera pre-applied
  const [appliedAt,   setAppliedAt]   = useState<Record<string, string>>({ s03:"5/6/2026" });
  const [resolutions, setResolutions] = useState<Record<string, Resolution>>({});
  const [expanded,    setExpanded]    = useState<Set<string>>(new Set(["6a"]));
  const [selSet,      setSelSet]      = useState<Set<string>>(new Set());
  const [wizardStep,  setWizardStep]  = useState(1);
  const [toast,       setToast]       = useState("");

  // Wizard step 2 state
  const [newYear,      setNewYear]      = useState("2026-27");
  const [yearStart,    setYearStart]    = useState("2026-04-01");
  const [yearEnd,      setYearEnd]      = useState("2027-03-31");
  // Wizard step 3 state
  const [copyGroups, setCopyGroups] = useState([
    { id:"ds", name:"Day Scholar",     copy:true },
    { id:"tu", name:"Transport Users", copy:true },
    { id:"fb", name:"Full Boarder",    copy:true },
  ]);

  const toast_ = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3000); };
  const toggleExpand = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const getRes = (id: string): Resolution => resolutions[id] ?? "Carry dues to next year";

  const today = new Date();
  const todayStr = `${today.getDate()}/${today.getMonth()+1}/${today.getFullYear()}`;

  const applyStudent = (id: string) => {
    setApplied(prev => new Set([...prev, id]));
    setAppliedAt(prev => ({ ...prev, [id]: todayStr }));
  };
  const applyClass = (cls: CFClass) => {
    const newIds = cls.students.filter(s => !applied.has(s.id)).map(s => s.id);
    setApplied(prev => new Set([...prev, ...newIds]));
    setAppliedAt(prev => { const n = { ...prev }; newIds.forEach(id => { n[id] = todayStr; }); return n; });
  };

  const totalApplied  = applied.size;
  const totalPending  = TOTAL_STUDENTS - totalApplied;

  return (
    <>
      <style>{`
        @keyframes toastUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        .ye-row:hover td { background:#FAFAFF!important; }
      `}</style>

      {/* ── Page header ───────────────────────────────────────────── */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:24 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.09em", color:"#6D4AFF", marginBottom:5, textTransform:"uppercase" }}>Academic Year Close</div>
          <h1 style={{ margin:"0 0 6px", fontSize:34, fontWeight:800, color:"#181B2A", lineHeight:1.1 }}>Year-End</h1>
          <p style={{ margin:0, fontSize:14, color:"#A0A3B8" }}>Resolve carry-forward dues, generate reports, and roll fee structures into the next academic year.</p>
        </div>
        <button style={{ ...pBtn(), marginTop:8, height:40, fontSize:13.5 }} onClick={() => toast_("Year-end review saved.")}>
          Save Year-End Review
        </button>
      </div>

      {/* ── Two-column layout ─────────────────────────────────────── */}
      <div style={{ display:"flex", gap:20, alignItems:"flex-start" }}>

        {/* ─── LEFT — main content ─────────────────────────────── */}
        <div style={{ flex:1, minWidth:0, display:"flex", flexDirection:"column", gap:16 }}>

          {/* Carry Forward card */}
          <div style={{ background:"#fff", border:"1px solid #E8E8EE", borderRadius:12, overflow:"hidden" }}>

            {/* Card header */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"16px 20px", borderBottom:"1px solid #E8E8EE" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                <span style={{ fontSize:15, fontWeight:700, color:"#181B2A" }}>Carry Forward</span>
                <span style={{ fontSize:13, color:"#A0A3B8" }}>2024-25 outstanding balances</span>
              </div>
              <button style={{ ...oBtn(true), color:"#6D4AFF", borderColor:"#c4b5fd" }} onClick={() => {
                CF_CLASSES.forEach(c => applyClass(c));
                toast_("All carry-forward dues applied.");
              }}>
                Carry all forward →
              </button>
            </div>

            {/* Global stats */}
            <div style={{ padding:"12px 20px", background:"#F8F8FB", borderBottom:"1px solid #E8E8EE" }}>
              <span style={{ fontSize:13.5, color:"#5B5E72" }}>
                <span style={{ fontWeight:700, color:"#181B2A" }}>{totalPending}</span> pending resolution ·{" "}
                <span style={{ fontWeight:700, color:"#16a34a" }}>{totalApplied}</span> resolved
              </span>
            </div>

            {/* Class sections */}
            {CF_CLASSES.map(cls => {
              const clsPending  = cls.students.filter(s => !applied.has(s.id)).length;
              const clsApplied  = cls.students.length - clsPending;
              const isExpanded  = expanded.has(cls.id);
              const allClsSel   = cls.students.every(s => selSet.has(s.id));

              return (
                <div key={cls.id} style={{ borderBottom:"1px solid #E8E8EE" }}>
                  {/* Class row */}
                  <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"12px 20px", background:"#fff" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{ fontSize:13.5, fontWeight:600, color:"#181B2A" }}>
                        <span style={{ fontWeight:700, color:"#181B2A" }}>{clsPending}</span> pending ·{" "}
                        <span style={{ fontWeight:700, color:"#16a34a" }}>{clsApplied}</span> resolved
                      </span>
                      <span style={{ fontSize:12, color:"#A0A3B8" }}>— {cls.name}</span>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                      <button style={{ ...oBtn(true), color:"#6D4AFF", borderColor:"#c4b5fd" }}
                        onClick={() => { applyClass(cls); toast_(`All dues in ${cls.name} carried forward.`); }}>
                        Carry all forward →
                      </button>
                      <button onClick={() => toggleExpand(cls.id)} style={{ width:28, height:28, border:"1px solid #E8E8EE", borderRadius:6, background:"#fff", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#A0A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform:isExpanded?"rotate(180deg)":"rotate(0deg)", transition:"transform 0.2s" }}>
                          <polyline points="6 9 12 15 18 9"/>
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Expanded student table */}
                  {isExpanded && (
                    <table style={{ width:"100%", borderCollapse:"collapse" }}>
                      <thead>
                        <tr style={{ background:"#F8F8FB" }}>
                          <th style={{ ...TH, width:44 }}>
                            <input type="checkbox" checked={allClsSel} onChange={() => {
                              if(allClsSel){setSelSet(p=>{const n=new Set(p);cls.students.forEach(s=>n.delete(s.id));return n;});}
                              else{setSelSet(p=>{const n=new Set(p);cls.students.forEach(s=>n.add(s.id));return n;});}
                            }}/>
                          </th>
                          <th style={TH}>STUDENT</th>
                          <th style={TH}>OUTSTANDING</th>
                          <th style={TH}>STATUS</th>
                          <th style={TH}>RESOLUTION</th>
                          <th style={TH}>ACTION</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cls.students.map((st, i) => {
                          const isApplied = applied.has(st.id);
                          const res       = getRes(st.id);
                          const fsStyle   = FEE_STATUS_STYLE[st.feeStatus];
                          const date      = appliedAt[st.id] ?? todayStr;

                          return (
                            <tr key={st.id} className="ye-row" style={{ borderBottom:i<cls.students.length-1?"1px solid #F0F0F0":"none", background:isApplied?"#F0FDF4":selSet.has(st.id)?"#F5F3FF":"#fff" }}>
                              <td style={{ ...TD, width:44 }}>
                                <input type="checkbox" checked={selSet.has(st.id)} onChange={() => setSelSet(p=>{ const n=new Set(p); n.has(st.id)?n.delete(st.id):n.add(st.id); return n; })}/>
                              </td>
                              {/* STUDENT */}
                              <td style={TD}>
                                <div style={{ fontSize:13.5, fontWeight:600, color:"#181B2A" }}>{st.name}</div>
                                <div style={{ fontSize:12, color:"#A0A3B8", marginTop:2 }}>Class {st.cls} · {st.group}</div>
                              </td>
                              {/* OUTSTANDING */}
                              <td style={{ ...TD, fontWeight:700, color:"#F97316" }}>{fmtInr(st.outstanding)}</td>
                              {/* STATUS — always shows feeStatus badge */}
                              <td style={TD}>
                                <span style={{ fontSize:12.5, fontWeight:600, padding:"4px 12px", borderRadius:20, background:fsStyle.bg, color:fsStyle.color }}>
                                  {st.feeStatus}
                                </span>
                              </td>
                              {/* RESOLUTION — dropdown when pending, plain text when applied */}
                              <td style={{ ...TD, minWidth:200 }}>
                                {isApplied ? (
                                  <span style={{ fontSize:13, color:"#5B5E72" }}>{SHORT_RES[res]}</span>
                                ) : (
                                  <select
                                    value={res}
                                    onChange={e => setResolutions(prev => ({ ...prev, [st.id]: e.target.value as Resolution }))}
                                    style={{ width:"100%", height:36, border:"1px solid #6D4AFF", borderRadius:8, padding:"0 10px", fontSize:13, background:"#fff", cursor:"pointer", color:"#181B2A" }}
                                  >
                                    <optgroup label="Continue enrollment">
                                      <option value="Carry dues to next year">Carry dues to next year</option>
                                      <option value="Write off balance">Write off balance</option>
                                      <option value="Mark as scholarship / waiver">Mark as scholarship / waiver</option>
                                      <option value="Legal follow-up">Legal follow-up</option>
                                    </optgroup>
                                    <optgroup label="Discontinue student">
                                      <option value="Discontinue — Archive student">Discontinue — Archive student</option>
                                      <option value="Discontinue — Offboard & generate TC">Discontinue — Offboard &amp; generate TC</option>
                                    </optgroup>
                                  </select>
                                )}
                              </td>
                              {/* ACTION */}
                              <td style={TD}>
                                {isApplied ? (
                                  <div>
                                    <span style={{ display:"inline-flex", alignItems:"center", gap:5, fontSize:12.5, fontWeight:600, padding:"4px 12px", borderRadius:20, background:"#dcfce7", color:"#15803d", border:"1px solid #86efac" }}>
                                      ✓ {SHORT_RES[res]}
                                    </span>
                                    <div style={{ fontSize:11, color:"#A0A3B8", marginTop:4, paddingLeft:2 }}>{date}</div>
                                  </div>
                                ) : (
                                  <button style={oBtn(true)} onClick={() => { applyStudent(st.id); toast_(`${SHORT_RES[res]} applied for ${st.name}.`); }}>
                                    Apply
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>
              );
            })}
          </div>

          {/* Year-End Reports card */}
          <div style={{ background:"#fff", border:"1px solid #E8E8EE", borderRadius:12, overflow:"hidden" }}>
            <div style={{ padding:"18px 20px", borderBottom:"1px solid #E8E8EE" }}>
              <div style={{ fontSize:15, fontWeight:700, color:"#181B2A", marginBottom:3 }}>Year-End Reports</div>
              <div style={{ fontSize:13, color:"#A0A3B8" }}>Generate PDF or CSV for audit, board review, and statutory filing.</div>
            </div>
            <table style={{ width:"100%", borderCollapse:"collapse" }}>
              <thead>
                <tr style={{ background:"#F8F8FB" }}>
                  {["REPORT NAME","PDF","CSV"].map(h=>(
                    <th key={h} style={{ ...TH, textAlign:h==="REPORT NAME"?"left":"center" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {REPORTS.map((r, i) => (
                  <tr key={r} className="ye-row" style={{ borderBottom:i<REPORTS.length-1?"1px solid #E8E8EE":"none" }}>
                    <td style={{ ...TD, fontWeight:600 }}>{r}</td>
                    <td style={{ ...TD, textAlign:"center" }}>
                      <button style={oBtn(true)} onClick={() => toast_(`Generating ${r} PDF…`)}>Generate PDF</button>
                    </td>
                    <td style={{ ...TD, textAlign:"center" }}>
                      <button style={oBtn(true)} onClick={() => toast_(`Exporting ${r} CSV…`)}>Export CSV</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ─── RIGHT — sticky Archive & Rollover wizard ─────────── */}
        <div style={{ width:340, flexShrink:0, position:"sticky", top:20, alignSelf:"flex-start" }}>
          <div style={{ background:"#fff", border:"1px solid #E8E8EE", borderRadius:12, overflow:"hidden" }}>

            {/* Wizard header */}
            <div style={{ padding:"16px 18px 14px", borderBottom:"1px solid #E8E8EE" }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:3 }}>
                <span style={{ fontSize:15, fontWeight:700, color:"#181B2A" }}>Archive & Rollover</span>
                <span style={{ width:18, height:18, borderRadius:"50%", background:"#E8E8EE", color:"#A0A3B8", fontSize:10, fontWeight:700, display:"inline-flex", alignItems:"center", justifyContent:"center" }}>i</span>
              </div>
              <div style={{ fontSize:12, color:"#A0A3B8" }}>Step-through wizard with confirmation gates.</div>
            </div>

            {/* Step indicator */}
            <div style={{ padding:"14px 18px 0" }}>
              <div style={{ display:"flex", gap:0, marginBottom:4 }}>
                {WIZARD_STEPS.map(s => (
                  <div key={s.n} style={{ flex:1, height:3, background:wizardStep>=s.n?"#6D4AFF":"#E8E8EE", borderRadius:s.n===1?2:s.n===4?2:0 }}/>
                ))}
              </div>
              <div style={{ display:"flex", gap:0 }}>
                {WIZARD_STEPS.map(s => (
                  <div key={s.n} style={{ flex:1, paddingTop:6, paddingRight:4 }}>
                    <div style={{ fontSize:10, fontWeight:wizardStep===s.n?700:400, color:wizardStep===s.n?"#6D4AFF":"#A0A3B8", lineHeight:1.3 }}>
                      {s.n}. {s.label}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Step content */}
            <div style={{ padding:"16px 18px" }}>

              {/* Step 1 — Confirm totals */}
              {wizardStep===1&&(
                <>
                  <div style={{ fontSize:13.5, fontWeight:700, color:"#181B2A", marginBottom:14 }}>Review 2025-26 final totals</div>
                  <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
                    {[
                      { label:"COLLECTED",    value:"Rs.\n38,14,200", color:"#16a34a" },
                      { label:"OUTSTANDING",  value:"Rs.\n6,42,800",  color:"#dc2626" },
                      { label:"CONCESSIONS",  value:"Rs.\n3,18,000",  color:"#6D4AFF" },
                    ].map(s=>(
                      <div key={s.label} style={{ border:"1px solid #E8E8EE", borderRadius:8, padding:"10px 8px", textAlign:"center" }}>
                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:"0.06em", color:"#A0A3B8", marginBottom:5 }}>{s.label}</div>
                        <div style={{ fontSize:12, fontWeight:700, color:s.color, lineHeight:1.3, whiteSpace:"pre-line" }}>{s.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize:12, color:"#A0A3B8", lineHeight:1.6 }}>
                    These figures are locked for review. Confirm they match your accounts before proceeding.
                  </div>
                </>
              )}

              {/* Step 2 — Set year & date */}
              {wizardStep===2&&(
                <>
                  {/* Two-field card */}
                  <div style={{ border:"1px solid #E8E8EE", borderRadius:10, padding:"14px 14px 16px", marginBottom:14 }}>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
                      {/* Next academic year */}
                      <div>
                        <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.07em", color:"#A0A3B8", marginBottom:8 }}>NEXT ACADEMIC YEAR</div>
                        <select value={newYear} onChange={e=>setNewYear(e.target.value)}
                          style={{ width:"100%", height:38, border:"1px solid #E8E8EE", borderRadius:8, padding:"0 10px", fontSize:13, background:"#fff", cursor:"pointer" }}>
                          <option>2026-27</option>
                          <option>2027-28</option>
                          <option>2028-29</option>
                        </select>
                      </div>
                      {/* Archive date */}
                      <div>
                        <div style={{ fontSize:9.5, fontWeight:700, letterSpacing:"0.07em", color:"#A0A3B8", marginBottom:8, lineHeight:1.3 }}>
                          YEAR-END / ARCHIVE DATE <span style={{ fontWeight:400 }}>(WHEN 2025-26 CLOSES)</span>
                        </div>
                        <div style={{ position:"relative" }}>
                          <input value={yearEnd} onChange={e=>setYearEnd(e.target.value)}
                            style={{ width:"100%", height:38, border:"1px solid #E8E8EE", borderRadius:8, padding:"0 32px 0 10px", fontSize:13, boxSizing:"border-box"as const, background:"#fff" }}/>
                          <span style={{ position:"absolute", right:9, top:"50%", transform:"translateY(-50%)", fontSize:15, pointerEvents:"none" }}>📅</span>
                        </div>
                      </div>
                    </div>
                    <p style={{ margin:"14px 0 0", fontSize:12, color:"#A0A3B8", lineHeight:1.6 }}>
                      The archive date determines the cut-off for all reports, carry-forwards, and the official year-end stamp on receipts.
                    </p>
                  </div>
                </>
              )}

              {/* Step 3 — Copy structures */}
              {wizardStep===3&&(
                <>
                  <p style={{ margin:"0 0 14px", fontSize:13, color:"#5B5E72", lineHeight:1.6 }}>
                    Select which groups to roll over, then click <strong style={{ color:"#181B2A" }}>Edit Amounts</strong> to hike fees for next year.
                  </p>
                  <div style={{ border:"1px solid #E8E8EE", borderRadius:10, overflow:"hidden" }}>
                    {copyGroups.map((g, i) => (
                      <div key={g.id} style={{ display:"flex", alignItems:"center", gap:10, padding:"13px 14px", borderBottom:i<copyGroups.length-1?"1px solid #F0F0F0":"none", background:"#fff" }}>
                        <input type="checkbox" checked={g.copy}
                          onChange={e=>setCopyGroups(prev=>prev.map(x=>x.id===g.id?{...x,copy:e.target.checked}:x))}
                          style={{ accentColor:"#6D4AFF", width:16, height:16, flexShrink:0 } as React.CSSProperties}/>
                        <span style={{ fontSize:12.5, fontWeight:500, color:"#A0A3B8", flexShrink:0 }}>Copy</span>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13.5, fontWeight:700, color:"#181B2A" }}>{g.name}</div>
                          <div style={{ fontSize:12, color:"#A0A3B8" }}>schedules & concessions</div>
                        </div>
                        <button style={{ height:28, padding:"0 10px", border:"1px solid #E8E8EE", borderRadius:7, background:"#fff", color:"#181B2A", fontSize:11.5, fontWeight:500, cursor:"pointer", flexShrink:0 }}
                          onClick={() => toast_(`Edit amounts for ${g.name} — coming soon.`)}>
                          Edit Amounts
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Step 4 — Execute rollover */}
              {wizardStep===4&&(
                <>
                  <div style={{ border:"1px solid #E8E8EE", borderRadius:10, padding:"16px 16px 14px", marginBottom:16 }}>
                    <div style={{ fontSize:14, fontWeight:700, color:"#181B2A", marginBottom:10 }}>Ready to execute rollover</div>
                    <p style={{ margin:0, fontSize:13, color:"#A0A3B8", lineHeight:1.7 }}>
                      Archive 2025-26 on <strong style={{ color:"#181B2A" }}>31 March 2026</strong>, copy selected fee structures with updated amounts, and carry forward approved dues to {newYear}.
                    </p>
                  </div>
                  <button
                    style={{ width:"100%", height:42, border:"none", borderRadius:9, background:"#6D4AFF", color:"#fff", fontSize:13.5, fontWeight:700, cursor:"pointer", boxShadow:"0 2px 8px rgba(109,74,255,0.25)" }}
                    onClick={() => toast_("Rollover executed — 2025-26 archived, 2026-27 created.")}
                  >
                    Confirm and Execute Rollover
                  </button>
                </>
              )}
            </div>

            {/* Wizard footer */}
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"12px 18px", borderTop:"1px solid #E8E8EE" }}>
              <button
                style={{ ...oBtn(true), color:wizardStep===1?"#A0A3B8":"#181B2A", cursor:wizardStep===1?"default":"pointer" }}
                onClick={() => { if(wizardStep>1) setWizardStep(s=>s-1); }}
                disabled={wizardStep===1}
              >
                ← Back
              </button>
              {wizardStep<4 ? (
                <button style={pBtn(true)} onClick={() => setWizardStep(s => Math.min(s+1, 4))}>
                  Next →
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast&&(
        <div style={{ position:"fixed", bottom:24, right:24, background:"#1e293b", color:"#fff", padding:"12px 20px", borderRadius:10, fontSize:13.5, fontWeight:500, boxShadow:"0 8px 28px rgba(0,0,0,0.22)", zIndex:9999, maxWidth:420, animation:"toastUp 0.2s ease" }}>
          {toast}
        </div>
      )}
    </>
  );
}
