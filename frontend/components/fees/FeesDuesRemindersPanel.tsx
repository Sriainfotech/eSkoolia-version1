"use client";
import { useState, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
type FeeStatus = "Overdue" | "Payment Watch" | "Escalated" | "Defaulter";
type TierNum   = 1 | 2 | 3;

interface LogEntry { date:string; by:string; note:string; }
interface DueStudent {
  id:string; name:string; admNo:string; cls:string; clsId:string;
  amountDue:number; daysOverdue:number; lastReminder:string; status:FeeStatus;
  statusNote:string; log:LogEntry[];
}

function tierOf(d:number): TierNum { return d<=15 ? 1 : d<=30 ? 2 : 3; }

// ── Mock data ──────────────────────────────────────────────────────────────────
const DEFAULT_LOG: LogEntry[] = [
  { date:"18 May 2026", by:"System",        note:"Reminder sent by SMS and app notification"              },
  { date:"19 May 2026", by:"Finance Admin", note:"Parent called finance office and requested two weeks"   },
  { date:"20 May 2026", by:"System",        note:"Class teacher notified for diary note"                  },
  { date:"21 May 2026", by:"Finance Admin", note:"Escalation prepared for principal review"               },
];

const ALL_DUES: DueStudent[] = [
  // ── Tier 3 (31+ days) ──────────────────────────────────────────────────────
  { id:"s0120", name:"Devika Sharma", admNo:"ADM-0120", cls:"6A",  clsId:"6a",  amountDue:44500, daysOverdue:53, lastReminder:"5 May 2026",  status:"Payment Watch", statusNote:"Final notice stage",        log: DEFAULT_LOG },
  { id:"s0133", name:"Zara Sharma",   admNo:"ADM-0133", cls:"7B",  clsId:"7b",  amountDue:78000, daysOverdue:38, lastReminder:"2 May 2026",  status:"Payment Watch", statusNote:"Principal escalation due",  log: DEFAULT_LOG },
  { id:"s0153", name:"Mihika Sharma", admNo:"ADM-0153", cls:"7B",  clsId:"7b",  amountDue:44500, daysOverdue:58, lastReminder:"6 May 2026",  status:"Payment Watch", statusNote:"Awaiting parent response",  log:[
    { date:"10 May 2026", by:"System",        note:"Automated reminder sent via app"                       },
    { date:"12 May 2026", by:"Finance Admin", note:"No response — escalated to class teacher"              },
    { date:"16 May 2026", by:"Finance Admin", note:"Parent unreachable — noted for principal review"       },
  ]},
  { id:"s0302", name:"Bhavna Patel",  admNo:"ADM-0302", cls:"8A",  clsId:"8a",  amountDue:52900, daysOverdue:31, lastReminder:"10 May 2026", status:"Overdue",       statusNote:"First overdue notice",     log:[
    { date:"10 May 2026", by:"System", note:"Fee due date passed — overdue notice sent" },
    { date:"12 May 2026", by:"System", note:"Second reminder sent via SMS" },
  ]},
  { id:"s0404", name:"Fatima Kumar",  admNo:"ADM-0404", cls:"9A",  clsId:"9a",  amountDue:44500, daysOverdue:35, lastReminder:"8 May 2026",  status:"Payment Watch", statusNote:"Payment plan requested",   log:[
    { date:"8 May 2026",  by:"Finance Admin", note:"Parent requested instalment plan"                      },
    { date:"9 May 2026",  by:"Finance Admin", note:"Plan proposal sent to parent for review"               },
  ]},
  { id:"s0502", name:"Jai Singh",     admNo:"ADM-0502", cls:"10B", clsId:"10b", amountDue:78000, daysOverdue:32, lastReminder:"12 May 2026", status:"Overdue",       statusNote:"Pending bank transfer",    log:[
    { date:"12 May 2026", by:"System",        note:"Overdue alert triggered — reminder sent"               },
    { date:"14 May 2026", by:"Finance Admin", note:"Student reports bank delay — monitoring"               },
  ]},
  // ── Tier 2 (16-30 days) ────────────────────────────────────────────────────
  { id:"s0104", name:"Ananya Sharma", admNo:"ADM-0104", cls:"6A",  clsId:"6a",  amountDue:12000, daysOverdue:22, lastReminder:"14 May 2026", status:"Overdue",       statusNote:"Second reminder sent",     log:[{ date:"14 May 2026", by:"System", note:"Second reminder dispatched via SMS" }] },
  { id:"s0107", name:"Meera Sharma",  admNo:"ADM-0107", cls:"6A",  clsId:"6a",  amountDue:36000, daysOverdue:18, lastReminder:"18 May 2026", status:"Overdue",       statusNote:"First reminder sent",      log:[{ date:"18 May 2026", by:"System", note:"First automated reminder sent" }] },
  { id:"s0201", name:"Priya Verma",   admNo:"ADM-0201", cls:"7B",  clsId:"7b",  amountDue:36000, daysOverdue:24, lastReminder:"12 May 2026", status:"Overdue",       statusNote:"Awaiting response",        log:[{ date:"12 May 2026", by:"System", note:"SMS reminder sent; no response yet" }] },
  { id:"s0217", name:"Sanjay Verma",  admNo:"ADM-0217", cls:"7B",  clsId:"7b",  amountDue:44500, daysOverdue:27, lastReminder:"10 May 2026", status:"Payment Watch", statusNote:"Parent informed",          log:[{ date:"10 May 2026", by:"Finance Admin", note:"Parent acknowledged — payment expected soon" }] },
  { id:"s0308", name:"Hari Patel",    admNo:"ADM-0308", cls:"8A",  clsId:"8a",  amountDue:44500, daysOverdue:19, lastReminder:"8 May 2026",  status:"Overdue",       statusNote:"First reminder sent",      log:[{ date:"8 May 2026", by:"System", note:"Reminder sent via SMS and email" }] },
  { id:"s0318", name:"Arpit Patel",   admNo:"ADM-0318", cls:"8A",  clsId:"8a",  amountDue:78000, daysOverdue:23, lastReminder:"9 May 2026",  status:"Overdue",       statusNote:"Awaiting confirmation",   log:[{ date:"9 May 2026", by:"System", note:"Automated follow-up sent" }] },
  { id:"s0403", name:"Chirag Kumar",  admNo:"ADM-0403", cls:"9A",  clsId:"9a",  amountDue:52900, daysOverdue:28, lastReminder:"16 May 2026", status:"Overdue",       statusNote:"Second reminder issued",  log:[{ date:"16 May 2026", by:"System", note:"Second reminder — no reply recorded" }] },
  { id:"s0419", name:"Harini Kumar",  admNo:"ADM-0419", cls:"9A",  clsId:"9a",  amountDue:36000, daysOverdue:17, lastReminder:"17 May 2026", status:"Overdue",       statusNote:"New overdue",              log:[{ date:"17 May 2026", by:"System", note:"First reminder sent automatically" }] },
  { id:"s0508", name:"Preeti Singh",  admNo:"ADM-0508", cls:"10B", clsId:"10b", amountDue:44500, daysOverdue:18, lastReminder:"14 May 2026", status:"Overdue",       statusNote:"Reminder sent",            log:[{ date:"14 May 2026", by:"System", note:"SMS reminder dispatched" }] },
  { id:"s0514", name:"Usha Singh",    admNo:"ADM-0514", cls:"10B", clsId:"10b", amountDue:52900, daysOverdue:26, lastReminder:"11 May 2026", status:"Overdue",       statusNote:"Parent contacted",         log:[{ date:"11 May 2026", by:"Finance Admin", note:"Spoke to parent — payment by month end promised" }] },
  // ── Tier 1 (1-15 days) ─────────────────────────────────────────────────────
  { id:"s0103", name:"Vivaan Sharma", admNo:"ADM-0103", cls:"6A",  clsId:"6a",  amountDue:22200, daysOverdue:8,  lastReminder:"—", status:"Overdue", statusNote:"Grace period",       log:[] },
  { id:"s0110", name:"Arjun Sharma",  admNo:"ADM-0110", cls:"6A",  clsId:"6a",  amountDue:36000, daysOverdue:12, lastReminder:"—", status:"Overdue", statusNote:"Grace period",       log:[] },
  { id:"s0205", name:"Sanya Verma",   admNo:"ADM-0205", cls:"7B",  clsId:"7b",  amountDue:44500, daysOverdue:11, lastReminder:"—", status:"Overdue", statusNote:"New due",            log:[] },
  { id:"s0213", name:"Anjali Verma",  admNo:"ADM-0213", cls:"7B",  clsId:"7b",  amountDue:36000, daysOverdue:5,  lastReminder:"—", status:"Overdue", statusNote:"Just due",           log:[] },
  { id:"s0315", name:"Pari Patel",    admNo:"ADM-0315", cls:"8A",  clsId:"8a",  amountDue:36000, daysOverdue:7,  lastReminder:"—", status:"Overdue", statusNote:"Grace period",       log:[] },
  { id:"s0418", name:"Vedant Kumar",  admNo:"ADM-0418", cls:"9A",  clsId:"9a",  amountDue:78000, daysOverdue:13, lastReminder:"—", status:"Overdue", statusNote:"First due",          log:[] },
  { id:"s0515", name:"Tanuj Singh",   admNo:"ADM-0515", cls:"10B", clsId:"10b", amountDue:36000, daysOverdue:9,  lastReminder:"—", status:"Overdue", statusNote:"Grace period",       log:[] },
];

const CLASS_META = [
  { id:"6a",  name:"Class 6A",  total:28, assigned:25, unassigned:3 },
  { id:"7b",  name:"Class 7B",  total:31, assigned:26, unassigned:5 },
  { id:"8a",  name:"Class 8A",  total:26, assigned:22, unassigned:4 },
  { id:"9a",  name:"Class 9A",  total:29, assigned:25, unassigned:4 },
  { id:"10b", name:"Class 10B", total:24, assigned:21, unassigned:3 },
];

const STATS = [
  { label:"TOTAL OVERDUE AMOUNT", value:"Rs. 21,72,460", sub:"Across unpaid and partial records",  border:"#F97316" },
  { label:"STUDENTS WITH DUES",   value:"55",            sub:"Filtered by active academic year",   border:"#F59E0B" },
  { label:"AVERAGE DAYS OVERDUE", value:"17",            sub:"Weighted across due students",       border:"#6D4AFF" },
  { label:"% COLLECTED",          value:"68%",           sub:"Year-to-date collection",            border:"#16a34a" },
];

const TIERS = [
  { n:1 as TierNum, label:"Tier 1: 1-15 days overdue"  },
  { n:2 as TierNum, label:"Tier 2: 16-30 days overdue" },
  { n:3 as TierNum, label:"Tier 3: 31+ days overdue"   },
];

const LATE_FEE = {
  label:"Aarav Sharma · Tuition Fee Term 2",
  dueRule:"Due date 10 Aug 2025 · Rule: Rs. 50 daily after 7-day grace period, capped at Rs. 1,500",
  outstanding:12000, daysOverdue:42, chargeableDays:35, rawPenalty:1750, finalDue:13500,
};

const STATUS_STYLE: Record<FeeStatus,{bg:string;color:string}> = {
  "Overdue":       { bg:"#FEE2E2", color:"#DC2626" },
  "Payment Watch": { bg:"#FEF3C7", color:"#D97706" },
  "Escalated":     { bg:"#FED7AA", color:"#EA580C" },
  "Defaulter":     { bg:"#FCE7F3", color:"#9D174D" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const AV = ["#6D4AFF","#0E7490","#16a34a","#d97706","#dc2626","#7C3AED","#0284c7","#9333ea"];
function avBg(n:string){let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))>>>0;return AV[h%AV.length];}
function ini(n:string){const p=n.trim().split(" ");return(p[0][0]+(p[1]?.[0]??"")).toUpperCase();}
function fmtRs(n:number){return"Rs. "+n.toLocaleString("en-IN");}

function pBtn(sm=false):React.CSSProperties{return{height:sm?30:36,padding:sm?"0 12px":"0 18px",background:"#6D4AFF",color:"#fff",border:"none",borderRadius:sm?7:9,fontSize:sm?12:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(109,74,255,0.20)"};}
function oBtn(sm=false):React.CSSProperties{return{height:sm?30:36,padding:sm?"0 12px":"0 16px",background:"#fff",color:"#181B2A",border:"1px solid #E8E8EE",borderRadius:sm?7:9,fontSize:sm?12:13,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"};}
const TH:React.CSSProperties={padding:"10px 16px",fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",textAlign:"left",borderBottom:"1px solid #E8E8EE"};
const TD:React.CSSProperties={padding:"13px 16px",fontSize:13.5,color:"#181B2A",verticalAlign:"middle"};

// ── Component ─────────────────────────────────────────────────────────────────
export default function FeesDuesRemindersPanel() {
  const [activeTier, setActiveTier] = useState<TierNum>(3);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set(["6a"]));
  const [resolved,   setResolved]   = useState<Set<string>>(new Set());
  const [selSet,     setSelSet]     = useState<Set<string>>(new Set());
  const [toast,      setToast]      = useState("");

  // Follow-up panel state
  const [followUp,      setFollowUp]      = useState<DueStudent|null>(null);
  const [followNote,    setFollowNote]    = useState("Spoke to parent. Expected payment by 31 May 2026.");
  const [agreedAmount,  setAgreedAmount]  = useState("10000");
  const [agreedDate,    setAgreedDate]    = useState("31-05-2026");

  const toast_ = (m:string) => { setToast(m); setTimeout(()=>setToast(""),3000); };
  const toggleExpand = (id:string) => setExpanded(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const resolve = (id:string) => { setResolved(prev=>new Set([...prev,id])); setFollowUp(null); toast_("Student resolved — removed from dues list."); };
  const toggleSel = (id:string) => setSelSet(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const openFollowUp = (st:DueStudent) => {
    setFollowUp(st);
    setFollowNote("Spoke to parent. Expected payment by 31 May 2026.");
    setAgreedAmount("10000");
    setAgreedDate("31-05-2026");
  };

  const filtered = useMemo(()=>
    ALL_DUES.filter(s=>!resolved.has(s.id)&&tierOf(s.daysOverdue)===activeTier),
  [activeTier, resolved]);

  const byClass = (clsId:string) => filtered.filter(s=>s.clsId===clsId);

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastUp { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes slideIn { from{transform:translateX(100%);opacity:0} to{transform:translateX(0);opacity:1} }
        .dr-row:hover td { background:#FAFAFF!important; }
      `}</style>

      {/* ── Page header ───────────────────────────────────────── */}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,letterSpacing:"0.09em",color:"#6D4AFF",marginBottom:5,textTransform:"uppercase"}}>Collections Follow-up</div>
          <h1 style={{margin:"0 0 6px",fontSize:34,fontWeight:800,color:"#181B2A",lineHeight:1.1}}>Dues & Reminders</h1>
          <p style={{margin:0,fontSize:14,color:"#A0A3B8"}}>Escalation tiers, class-wise due lists, and a detailed interaction log for each student.</p>
        </div>
        <button style={{...oBtn(),marginTop:8}} onClick={()=>toast_("Exporting CSV…")}>Export CSV</button>
      </div>

      {/* ── Stats grid ────────────────────────────────────────── */}
      <div style={{display:"flex",border:"1px solid #E8E8EE",borderRadius:12,overflow:"hidden",background:"#fff"}}>
        {STATS.map((s,i)=>(
          <div key={s.label} style={{flex:1,padding:"22px 24px",borderLeft:`4px solid ${s.border}`,borderRight:i<STATS.length-1?"1px solid #E8E8EE":"none"}}>
            <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:10,textTransform:"uppercase"as const}}>{s.label}</div>
            <div style={{fontSize:28,fontWeight:800,color:"#181B2A",lineHeight:1.1,marginBottom:6}}>{s.value}</div>
            <div style={{fontSize:12.5,color:"#A0A3B8"}}>{s.sub}</div>
          </div>
        ))}
      </div>
      <div style={{height:3,background:"linear-gradient(90deg,#F97316 0%,#F59E0B 25%,#6D4AFF 50%,#16a34a 100%)",marginBottom:20}}/>

      {/* ── Tier tabs + actions ───────────────────────────────── */}
      <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:20,flexWrap:"wrap"as const}}>
        {TIERS.map(t=>(
          <button key={t.n} onClick={()=>setActiveTier(t.n)} style={{
            height:36,padding:"0 18px",
            border:activeTier===t.n?"none":"1px solid #E8E8EE",
            borderRadius:20,
            background:activeTier===t.n?"#6D4AFF":"#fff",
            color:activeTier===t.n?"#fff":"#5B5E72",
            fontSize:13,fontWeight:activeTier===t.n?600:400,
            cursor:"pointer",transition:"all 0.15s",
            boxShadow:activeTier===t.n?"0 2px 8px rgba(109,74,255,0.22)":"none",
          }}>{t.label}</button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button style={oBtn()} onClick={()=>{ if(selSet.size>0) toast_(`Sending reminders to ${selSet.size} student(s)…`); else toast_("Select students first."); }}>
            Send Reminder to All Selected
          </button>
          <button style={oBtn()} onClick={()=>toast_("Generating report…")}>Generate Report</button>
        </div>
      </div>

      {/* ── Late Fee Calculator Preview ───────────────────────── */}
      <div style={{background:"#fff",border:"1px solid #E8E8EE",borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>Late Fee Calculator Preview</div>
            <div style={{fontSize:13,color:"#A0A3B8"}}>Transparent penalty calculation shown before reminder, receipt, or ledger posting.</div>
          </div>
          <button style={oBtn()} onClick={()=>toast_("Breakdown copied to clipboard.")}>Copy Breakdown</button>
        </div>
        <div style={{border:"1px solid #E8E8EE",borderRadius:10,padding:"16px 18px"}}>
          <div style={{fontSize:14,fontWeight:600,color:"#181B2A",marginBottom:3}}>{LATE_FEE.label}</div>
          <div style={{fontSize:12.5,color:"#A0A3B8",marginBottom:14}}>{LATE_FEE.dueRule}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {[
              {label:"OUTSTANDING",     value:fmtRs(LATE_FEE.outstanding)},
              {label:"DAYS OVERDUE",    value:String(LATE_FEE.daysOverdue)},
              {label:"CHARGEABLE DAYS", value:String(LATE_FEE.chargeableDays)},
              {label:"RAW PENALTY",     value:fmtRs(LATE_FEE.rawPenalty)},
              {label:"FINAL DUE",       value:fmtRs(LATE_FEE.finalDue)},
            ].map(s=>(
              <div key={s.label} style={{padding:"12px 14px",border:"1px solid #E8E8EE",borderRadius:8}}>
                <div style={{fontSize:9.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>{s.label}</div>
                <div style={{fontSize:15,fontWeight:700,color:"#181B2A"}}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Class sections ────────────────────────────────────── */}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {CLASS_META.map(cls=>{
          const students   = byClass(cls.id);
          const isExpanded = expanded.has(cls.id);
          const dueCount   = students.length;
          const allSel     = dueCount>0&&students.every(s=>selSet.has(s.id));

          return (
            <div key={cls.id} style={{background:"#fff",border:"1px solid #E8E8EE",borderRadius:12,overflow:"hidden"}}>

              {/* Section header */}
              <div style={{display:"flex",alignItems:"center",gap:14,padding:"15px 20px"}}>
                <div style={{width:4,height:44,borderRadius:2,background:"#6D4AFF",flexShrink:0}}/>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>{cls.name}</div>
                  <div style={{fontSize:12.5,color:"#A0A3B8"}}>{cls.total} students · {cls.assigned} assigned · {cls.unassigned} unassigned</div>
                </div>
                <button style={oBtn(true)} onClick={()=>toast_(`Sending reminders to due students in ${cls.name}…`)}>Remind All</button>
                {dueCount>0&&(
                  <span style={{fontSize:12,fontWeight:600,padding:"4px 10px",borderRadius:20,background:"#FEE2E2",color:"#DC2626",flexShrink:0}}>
                    {dueCount} due
                  </span>
                )}
                <button onClick={()=>toggleExpand(cls.id)} style={{width:30,height:30,border:"1px solid #E8E8EE",borderRadius:7,background:"#fff",color:"#5B5E72",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{transform:isExpanded?"rotate(180deg)":"rotate(0deg)",transition:"transform 0.2s"}}><polyline points="6 9 12 15 18 9"/></svg>
                </button>
              </div>

              {/* Student table */}
              {isExpanded&&dueCount>0&&(
                <div style={{borderTop:"1px solid #E8E8EE",animation:"fadeIn 0.15s ease"}}>
                  <table style={{width:"100%",borderCollapse:"collapse"}}>
                    <thead>
                      <tr style={{background:"#F8F8FB"}}>
                        <th style={{...TH,width:44}}>
                          <input type="checkbox" checked={allSel} onChange={()=>{
                            if(allSel){setSelSet(p=>{const n=new Set(p);students.forEach(s=>n.delete(s.id));return n;});}
                            else{setSelSet(p=>{const n=new Set(p);students.forEach(s=>n.add(s.id));return n;});}
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
                      {students.map((st,i)=>(
                        <tr key={st.id} className="dr-row" style={{borderBottom:i<students.length-1?"1px solid #E8E8EE":"none",background:selSet.has(st.id)?"#F5F3FF":"#fff"}}>
                          <td style={{...TD,width:44}}>
                            <input type="checkbox" checked={selSet.has(st.id)} onChange={()=>toggleSel(st.id)}/>
                          </td>
                          <td style={TD}>
                            <div style={{display:"flex",alignItems:"center",gap:12}}>
                              <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,background:avBg(st.name),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12.5,fontWeight:700}}>{ini(st.name)}</div>
                              <div>
                                <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A"}}>{st.name}</div>
                                <div style={{fontSize:12,color:"#A0A3B8",marginTop:2}}>{st.admNo} · Class {st.cls}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{...TD,fontWeight:600}}>{fmtRs(st.amountDue)}</td>
                          <td style={{...TD,fontWeight:600,color:st.daysOverdue>30?"#DC2626":st.daysOverdue>15?"#D97706":"#181B2A"}}>{st.daysOverdue}</td>
                          <td style={{...TD,color:"#5B5E72"}}>{st.lastReminder}</td>
                          <td style={TD}>
                            <span style={{fontSize:12.5,fontWeight:600,padding:"4px 12px",borderRadius:20,background:STATUS_STYLE[st.status].bg,color:STATUS_STYLE[st.status].color}}>
                              {st.status}
                            </span>
                          </td>
                          <td style={TD}>
                            <div style={{display:"flex",gap:8}}>
                              <button style={pBtn(true)} onClick={()=>resolve(st.id)}>Resolve</button>
                              <button style={oBtn(true)} onClick={()=>openFollowUp(st)}>Log Call</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {isExpanded&&dueCount===0&&(
                <div style={{borderTop:"1px solid #E8E8EE",padding:"20px",textAlign:"center",color:"#A0A3B8",fontSize:13}}>
                  No students in this tier for {cls.name}.
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Follow-up Side Panel ──────────────────────────────── */}
      {followUp&&(
        <>
          {/* Backdrop */}
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.18)",zIndex:400}} onClick={()=>setFollowUp(null)}/>

          {/* Panel */}
          <div style={{
            position:"fixed",top:0,right:0,bottom:0,
            width:400,background:"#fff",
            borderLeft:"1px solid #E8E8EE",
            boxShadow:"-8px 0 32px rgba(0,0,0,0.12)",
            zIndex:500,display:"flex",flexDirection:"column",
            animation:"slideIn 0.22s ease",
          }}>
            {/* Panel header */}
            <div style={{padding:"18px 20px 14px",borderBottom:"1px solid #E8E8EE",flexShrink:0}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div>
                  <div style={{fontSize:16,fontWeight:700,color:"#181B2A",marginBottom:3}}>{followUp.name} Follow-up</div>
                  <div style={{fontSize:12,color:"#A0A3B8"}}>{followUp.admNo} · Class {followUp.cls} · Due {fmtRs(followUp.amountDue)}</div>
                </div>
                <button onClick={()=>setFollowUp(null)} style={{width:28,height:28,borderRadius:6,border:"1px solid #E8E8EE",background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:16,color:"#A0A3B8",lineHeight:1}}>×</button>
              </div>
            </div>

            {/* Scrollable body */}
            <div style={{flex:1,overflowY:"auto",padding:"16px 20px"}}>

              {/* Student card */}
              <div style={{display:"flex",alignItems:"center",gap:12,padding:"12px 14px",background:"#F5F3FF",border:"1px solid #c4b5fd",borderRadius:10,marginBottom:18}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:avBg(followUp.name),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:14,fontWeight:700,flexShrink:0}}>{ini(followUp.name)}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:700,color:"#181B2A"}}>{followUp.name}</div>
                  <div style={{fontSize:12,color:"#A0A3B8"}}>{followUp.statusNote}</div>
                </div>
                <span style={{fontSize:11.5,fontWeight:600,padding:"3px 10px",borderRadius:20,background:STATUS_STYLE[followUp.status].bg,color:STATUS_STYLE[followUp.status].color}}>
                  {followUp.status.toLowerCase()}
                </span>
              </div>

              {/* Interaction timeline */}
              {followUp.log.length>0&&(
                <div style={{marginBottom:20}}>
                  {followUp.log.map((e,i)=>(
                    <div key={i} style={{display:"flex",gap:12,paddingBottom:i<followUp.log.length-1?14:0,marginBottom:i<followUp.log.length-1?0:0}}>
                      <div style={{display:"flex",flexDirection:"column",alignItems:"center",flexShrink:0}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:"#6D4AFF",marginTop:3,flexShrink:0}}/>
                        {i<followUp.log.length-1&&<div style={{width:2,flex:1,background:"#E8E8EE",marginTop:4,marginBottom:0}}/>}
                      </div>
                      <div style={{paddingBottom:i<followUp.log.length-1?14:0}}>
                        <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A",marginBottom:2}}>{e.note}</div>
                        <div style={{fontSize:11.5,color:"#A0A3B8"}}>{e.date} · {e.by}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {followUp.log.length===0&&(
                <div style={{fontSize:13,color:"#A0A3B8",marginBottom:20,textAlign:"center",padding:"12px 0"}}>No interaction log yet.</div>
              )}

              {/* Add note / log call */}
              <div style={{marginBottom:16}}>
                <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.08em",color:"#A0A3B8",marginBottom:7}}>ADD NOTE / LOG CALL</div>
                <textarea
                  value={followNote}
                  onChange={e=>setFollowNote(e.target.value)}
                  placeholder="e.g. Spoke to parent. Expected payment by 31 May 2026."
                  style={{width:"100%",minHeight:80,border:"1px solid #E8E8EE",borderRadius:9,padding:"10px 12px",fontSize:13.5,resize:"vertical",boxSizing:"border-box"as const,fontFamily:"inherit"}}
                />
              </div>

              {/* Agreed amount + date */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14,marginBottom:4}}>
                <div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:7}}>AGREED AMOUNT</div>
                  <input value={agreedAmount} onChange={e=>setAgreedAmount(e.target.value)} type="number"
                    style={{width:"100%",height:40,border:"1px solid #E8E8EE",borderRadius:9,padding:"0 12px",fontSize:13.5,boxSizing:"border-box"as const}}/>
                </div>
                <div>
                  <div style={{fontSize:10,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:7}}>AGREED DATE</div>
                  <div style={{position:"relative"}}>
                    <input value={agreedDate} onChange={e=>setAgreedDate(e.target.value)}
                      style={{width:"100%",height:40,border:"1px solid #E8E8EE",borderRadius:9,padding:"0 36px 0 12px",fontSize:13.5,boxSizing:"border-box"as const}}/>
                    <span style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",fontSize:14}}>📅</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Panel footer */}
            <div style={{padding:"14px 20px",borderTop:"1px solid #E8E8EE",flexShrink:0}}>
              <button
                style={{...pBtn(),width:"100%",height:40,fontSize:14,borderRadius:9}}
                onClick={()=>{ toast_(`Follow-up saved for ${followUp.name}.`); setFollowUp(null); }}
              >
                Save Follow-up
              </button>
            </div>
          </div>
        </>
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
