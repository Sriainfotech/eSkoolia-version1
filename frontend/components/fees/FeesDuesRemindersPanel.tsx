"use client";
import { useState, useMemo, useEffect, useCallback } from "react";
import { feesApi, type DuesRemindersData, type DuesReminderStudent, type DuesReminderClass } from "@/lib/fees-api";

// ── Types ──────────────────────────────────────────────────────────────────────
type FeeStatus = "Overdue" | "Payment Watch" | "Escalated" | "Defaulter";
type TierNum   = 1 | 2 | 3;

function tierOf(d:number): TierNum { return d<=15 ? 1 : d<=30 ? 2 : 3; }

const TIERS = [
  { n:1 as TierNum, label:"Tier 1: 1-15 days overdue"  },
  { n:2 as TierNum, label:"Tier 2: 16-30 days overdue" },
  { n:3 as TierNum, label:"Tier 3: 31+ days overdue"   },
];

const STAT_BORDERS = ["#F97316", "#F59E0B", "#6D4AFF", "#16a34a"];

const STATUS_STYLE: Record<FeeStatus,{bg:string;color:string}> = {
  "Overdue":       { bg:"#FEE2E2", color:"#DC2626" },
  "Payment Watch": { bg:"#FEF3C7", color:"#D97706" },
  "Escalated":     { bg:"#FED7AA", color:"#EA580C" },
  "Defaulter":     { bg:"#FCE7F3", color:"#9D174D" },
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const AV = ["#6D4AFF","#0E7490","#16a34a","#d97706","#dc2626","#7C3AED","#0284c7","#9333ea"];
function avBg(n:string){let h=0;for(const c of n)h=(h*31+c.charCodeAt(0))>>>0;return AV[h%AV.length];}
function ini(n:string){const p=(n||"?").trim().split(" ");return(p[0][0]+(p[1]?.[0]??"")).toUpperCase();}
function fmtRs(n:number){return"Rs. "+Math.round(n).toLocaleString("en-IN");}

function pBtn(sm=false):React.CSSProperties{return{height:sm?30:36,padding:sm?"0 12px":"0 18px",background:"#6D4AFF",color:"#fff",border:"none",borderRadius:sm?7:9,fontSize:sm?12:13,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap",boxShadow:"0 2px 8px rgba(109,74,255,0.20)"};}
function oBtn(sm=false):React.CSSProperties{return{height:sm?30:36,padding:sm?"0 12px":"0 16px",background:"#fff",color:"#181B2A",border:"1px solid #E8E8EE",borderRadius:sm?7:9,fontSize:sm?12:13,fontWeight:500,cursor:"pointer",whiteSpace:"nowrap"};}
const TH:React.CSSProperties={padding:"10px 16px",fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",textAlign:"left",borderBottom:"1px solid #E8E8EE"};
const TD:React.CSSProperties={padding:"13px 16px",fontSize:13.5,color:"#181B2A",verticalAlign:"middle"};

// ── Component ─────────────────────────────────────────────────────────────────
export default function FeesDuesRemindersPanel() {
  const [data,    setData]    = useState<DuesRemindersData|null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");

  const [activeTier, setActiveTier] = useState<TierNum>(3);
  const [expanded,   setExpanded]   = useState<Set<string>>(new Set());
  const [resolved,   setResolved]   = useState<Set<string>>(new Set());
  const [selSet,     setSelSet]     = useState<Set<string>>(new Set());
  const [toast,      setToast]      = useState("");

  // Follow-up panel state
  const [followUp,      setFollowUp]      = useState<DuesReminderStudent|null>(null);
  const [followNote,    setFollowNote]    = useState("");
  const [agreedAmount,  setAgreedAmount]  = useState("");
  const [agreedDate,    setAgreedDate]    = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setError("");
    feesApi.duesReminders()
      .then((res) => {
        setData(res);
        // Expand the first class that actually has dues so the table isn't hidden.
        const firstWithDues = res.classes.find((c) => res.students.some((s) => s.cls_id === c.id));
        if (firstWithDues) setExpanded(new Set([firstWithDues.id]));
      })
      .catch((e) => setError(e?.message || "Failed to load dues & reminders."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const toast_ = (m:string) => { setToast(m); setTimeout(()=>setToast(""),3000); };
  const toggleExpand = (id:string) => setExpanded(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });
  const resolve = (id:string) => { setResolved(prev=>new Set([...prev,id])); setFollowUp(null); toast_("Student resolved — removed from dues list."); };
  const toggleSel = (id:string) => setSelSet(prev=>{ const n=new Set(prev); n.has(id)?n.delete(id):n.add(id); return n; });

  const openFollowUp = (st:DuesReminderStudent) => {
    setFollowUp(st);
    setFollowNote("");
    setAgreedAmount(String(Math.round(st.amount_due)));
    setAgreedDate("");
  };

  const students = data?.students ?? [];
  const classes  = data?.classes ?? [];

  const filtered = useMemo(()=>
    students.filter(s=>!resolved.has(s.id)&&tierOf(s.days_overdue)===activeTier),
  [students, activeTier, resolved]);

  const byClass = (clsId:string) => filtered.filter(s=>s.cls_id===clsId);

  // Only render class sections that have students in the active tier, plus
  // keep classes with any dues so the layout stays meaningful.
  const visibleClasses = useMemo(()=>{
    const withDues = new Set(students.filter(s=>!resolved.has(s.id)).map(s=>s.cls_id));
    return classes.filter(c=>withDues.has(c.id));
  }, [classes, students, resolved]);

  const stats = data?.stats;
  const STATS = stats ? [
    { label:"TOTAL OVERDUE AMOUNT", value:fmtRs(stats.total_overdue_amount) },
    { label:"STUDENTS WITH DUES",   value:String(stats.students_with_dues) },
    { label:"AVERAGE DAYS OVERDUE", value:String(stats.average_days_overdue) },
    { label:"% COLLECTED",          value:`${stats.percent_collected}%` },
  ] : [];

  const lateFee = data?.late_fee_preview ?? null;

  const exportExcel = async () => {
    const rows = students.filter(s=>!resolved.has(s.id));
    if (rows.length === 0) { toast_("No dues to export."); return; }
    const XLSX = await import("xlsx");
    const aoa = [
      ["Student","Admission No","Class","Amount Due","Days Overdue","Tier","Fee Status","Status Note","Last Reminder"],
      ...rows.map(s=>[
        s.name, s.adm_no, s.cls, Math.round(s.amount_due), s.days_overdue,
        `Tier ${tierOf(s.days_overdue)}`, s.status, s.status_note, s.last_reminder,
      ]),
    ];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{wch:22},{wch:16},{wch:14},{wch:12},{wch:13},{wch:8},{wch:15},{wch:30},{wch:14}];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dues & Reminders");
    XLSX.writeFile(wb, `dues-reminders-${new Date().toISOString().slice(0,10)}.xlsx`);
    toast_(`Exported ${rows.length} record(s) to Excel.`);
  };

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
        <button style={{...oBtn(),marginTop:8}} onClick={exportExcel}>Export Excel</button>
      </div>

      {loading && (
        <div style={{padding:"60px 0",textAlign:"center",color:"#A0A3B8",fontSize:14}}>Loading dues & reminders…</div>
      )}

      {!loading && error && (
        <div style={{padding:"24px",border:"1px solid #FECACA",background:"#FEF2F2",borderRadius:12,color:"#DC2626",fontSize:14,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <span>{error}</span>
          <button style={oBtn()} onClick={load}>Retry</button>
        </div>
      )}

      {!loading && !error && data && (
      <>
      {/* ── Stats grid ────────────────────────────────────────── */}
      <div style={{display:"flex",border:"1px solid #E8E8EE",borderRadius:12,overflow:"hidden",background:"#fff"}}>
        {STATS.map((s,i)=>(
          <div key={s.label} style={{flex:1,padding:"22px 24px",borderLeft:`4px solid ${STAT_BORDERS[i]}`,borderRight:i<STATS.length-1?"1px solid #E8E8EE":"none"}}>
            <div style={{fontSize:10.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:10,textTransform:"uppercase"as const}}>{s.label}</div>
            <div style={{fontSize:28,fontWeight:800,color:"#181B2A",lineHeight:1.1}}>{s.value}</div>
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
      {lateFee && (
      <div style={{background:"#fff",border:"1px solid #E8E8EE",borderRadius:12,padding:"20px 24px",marginBottom:20}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
          <div>
            <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>Late Fee Calculator Preview</div>
            <div style={{fontSize:13,color:"#A0A3B8"}}>Transparent penalty calculation shown before reminder, receipt, or ledger posting.</div>
          </div>
          <button style={oBtn()} onClick={()=>toast_("Breakdown copied to clipboard.")}>Copy Breakdown</button>
        </div>
        <div style={{border:"1px solid #E8E8EE",borderRadius:10,padding:"16px 18px"}}>
          <div style={{fontSize:14,fontWeight:600,color:"#181B2A",marginBottom:3}}>{lateFee.label}</div>
          <div style={{fontSize:12.5,color:"#A0A3B8",marginBottom:14}}>{lateFee.due_rule}</div>
          <div style={{display:"grid",gridTemplateColumns:"repeat(5,1fr)",gap:10}}>
            {[
              {label:"OUTSTANDING",     value:fmtRs(lateFee.outstanding)},
              {label:"DAYS OVERDUE",    value:String(lateFee.days_overdue)},
              {label:"CHARGEABLE DAYS", value:String(lateFee.chargeable_days)},
              {label:"RAW PENALTY",     value:fmtRs(lateFee.raw_penalty)},
              {label:"FINAL DUE",       value:fmtRs(lateFee.final_due)},
            ].map(s=>(
              <div key={s.label} style={{padding:"12px 14px",border:"1px solid #E8E8EE",borderRadius:8}}>
                <div style={{fontSize:9.5,fontWeight:700,letterSpacing:"0.07em",color:"#A0A3B8",marginBottom:6}}>{s.label}</div>
                <div style={{fontSize:15,fontWeight:700,color:"#181B2A"}}>{s.value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      )}

      {/* ── Class sections ────────────────────────────────────── */}
      {visibleClasses.length===0 && (
        <div style={{background:"#fff",border:"1px solid #E8E8EE",borderRadius:12,padding:"40px",textAlign:"center",color:"#A0A3B8",fontSize:14}}>
          No outstanding dues found for the active academic year.
        </div>
      )}
      <div style={{display:"flex",flexDirection:"column",gap:12}}>
        {visibleClasses.map((cls:DuesReminderClass)=>{
          const clsStudents = byClass(cls.id);
          const isExpanded  = expanded.has(cls.id);
          const dueCount    = clsStudents.length;
          const allSel      = dueCount>0&&clsStudents.every(s=>selSet.has(s.id));

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
                            if(allSel){setSelSet(p=>{const n=new Set(p);clsStudents.forEach(s=>n.delete(s.id));return n;});}
                            else{setSelSet(p=>{const n=new Set(p);clsStudents.forEach(s=>n.add(s.id));return n;});}
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
                      {clsStudents.map((st,i)=>(
                        <tr key={st.id} className="dr-row" style={{borderBottom:i<clsStudents.length-1?"1px solid #E8E8EE":"none",background:selSet.has(st.id)?"#F5F3FF":"#fff"}}>
                          <td style={{...TD,width:44}}>
                            <input type="checkbox" checked={selSet.has(st.id)} onChange={()=>toggleSel(st.id)}/>
                          </td>
                          <td style={TD}>
                            <div style={{display:"flex",alignItems:"center",gap:12}}>
                              <div style={{width:36,height:36,borderRadius:"50%",flexShrink:0,background:avBg(st.name),color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12.5,fontWeight:700}}>{ini(st.name)}</div>
                              <div>
                                <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A"}}>{st.name}</div>
                                <div style={{fontSize:12,color:"#A0A3B8",marginTop:2}}>{st.adm_no} · {st.cls}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{...TD,fontWeight:600}}>{fmtRs(st.amount_due)}</td>
                          <td style={{...TD,fontWeight:600,color:st.days_overdue>30?"#DC2626":st.days_overdue>15?"#D97706":"#181B2A"}}>{st.days_overdue}</td>
                          <td style={{...TD,color:"#5B5E72"}}>{st.last_reminder}</td>
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
      </>
      )}

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
                  <div style={{fontSize:12,color:"#A0A3B8"}}>{followUp.adm_no} · {followUp.cls} · Due {fmtRs(followUp.amount_due)}</div>
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
                  <div style={{fontSize:12,color:"#A0A3B8"}}>{followUp.status_note}</div>
                </div>
                <span style={{fontSize:11.5,fontWeight:600,padding:"3px 10px",borderRadius:20,background:STATUS_STYLE[followUp.status].bg,color:STATUS_STYLE[followUp.status].color}}>
                  {followUp.status.toLowerCase()}
                </span>
              </div>

              {/* Interaction timeline */}
              {followUp.log.length>0&&(
                <div style={{marginBottom:20}}>
                  {followUp.log.map((e,i)=>(
                    <div key={i} style={{display:"flex",gap:12,paddingBottom:i<followUp.log.length-1?14:0}}>
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
                    <input value={agreedDate} onChange={e=>setAgreedDate(e.target.value)} placeholder="DD-MM-YYYY"
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
