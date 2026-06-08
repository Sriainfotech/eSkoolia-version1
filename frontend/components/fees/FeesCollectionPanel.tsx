"use client";
import { useState, useMemo } from "react";

// ── Types ──────────────────────────────────────────────────────────────────────
interface Due { id:string; label:string; amount:number; due:string; }
interface LedgerEntry { date:string; title:string; note:string; amount:number|null; type:"charge"|"credit"|"note"; }
interface LateFeeCalc { label:string; dueRule:string; outstanding:number; daysOverdue:number; chargeableDays:number; rawPenalty:number; finalDue:number; }
interface StudentRecord { id:string; name:string; admNo:string; cls:string; group:string; status:"partial"|"cleared"|"overdue"; dues:Due[]; ledger:LedgerEntry[]; fullLedger:LedgerEntry[]; ledgerBalance:number; lateFeeCalc?:LateFeeCalc; }
interface Payment { rcpt:string; student:string; amount:number; method:string; }

// ── Mock data ──────────────────────────────────────────────────────────────────
const STUDENTS: StudentRecord[] = [
  {
    id:"s0105", name:"Kabir Sharma", admNo:"ADM-0105", cls:"6A", group:"Transport Users", status:"partial",
    dues:[
      { id:"d1", label:"Tuition Fee Term 2",  amount:12000, due:"10 Aug 2025" },
      { id:"d2", label:"Development Fund",     amount:4500,  due:"15 Sep 2025" },
      { id:"d3", label:"Transport Fee - May",  amount:2800,  due:"10 May 2026" },
    ],
    ledger:[
      { date:"10 Aug 2025", title:"Tuition Fee Term 2 assigned",  note:"Installment due date reached after 7-day grace period", amount:12000, type:"charge" },
      { date:"18 Aug 2025", title:"Late fee accrued",             note:"11 chargeable days x Rs. 50, capped at Rs. 1,500",      amount:550,   type:"charge" },
      { date:"21 Aug 2025", title:"Merit concession applied",     note:"Principal-approved concession for current term",         amount:3000,  type:"credit" },
      { date:"27 May 2026", title:"Payment arrangement logged",   note:"Parent agreed partial payment by 31 May 2026",           amount:null,  type:"note"   },
    ],
    fullLedger:[
      { date:"10 Apr 2025", title:"Tuition Fee Term 1 assigned",  note:"Charge created from Day Scholar annual schedule",       amount:12000, type:"charge" },
      { date:"12 Apr 2025", title:"Payment received",             note:"Cash receipt RCPT-25-1108 posted by Accountant",        amount:12000, type:"credit" },
      { date:"10 Aug 2025", title:"Tuition Fee Term 2 assigned",  note:"Installment due date reached after 7-day grace period", amount:12000, type:"charge" },
      { date:"18 Aug 2025", title:"Late fee accrued",             note:"11 chargeable days x Rs. 50, capped at Rs. 1,500",      amount:550,   type:"charge" },
      { date:"21 Aug 2025", title:"Merit concession applied",     note:"Principal-approved concession for current term",         amount:3000,  type:"credit" },
      { date:"27 May 2026", title:"Payment arrangement logged",   note:"Parent agreed partial payment by 31 May 2026",           amount:null,  type:"note"   },
    ],
    ledgerBalance:17130,
    lateFeeCalc:{ label:"Kabir Sharma · Tuition Fee Term 2", dueRule:"Due date 10 Aug 2025 · Rule: Rs. 50 daily after 7-day grace period, capped at Rs. 1,500", outstanding:12000, daysOverdue:21, chargeableDays:14, rawPenalty:700, finalDue:12700 },
  },
  {
    id:"s0102", name:"Aditi Sharma", admNo:"ADM-0102", cls:"6A", group:"Transport Users", status:"partial",
    dues:[
      { id:"d1", label:"Tuition Fee Term 3",  amount:12000, due:"01 Dec 2025" },
      { id:"d2", label:"Transport Fee - Apr", amount:2800,  due:"10 Apr 2026" },
    ],
    ledger:[
      { date:"01 Dec 2025", title:"Tuition Fee Term 3 assigned",   note:"Term 3 installment due",   amount:12000, type:"charge" },
      { date:"10 Apr 2026", title:"Transport Fee - April assigned", note:"Monthly transport fee",    amount:2800,  type:"charge" },
    ],
    fullLedger:[
      { date:"10 Apr 2025", title:"Tuition Fee Term 1 assigned",   note:"Charge created from Transport Users annual schedule",  amount:12000, type:"charge" },
      { date:"15 Apr 2025", title:"Payment received",              note:"Online payment RCPT-25-0892 posted",                   amount:12000, type:"credit" },
      { date:"10 Aug 2025", title:"Tuition Fee Term 2 assigned",   note:"Term 2 installment due",                              amount:12000, type:"charge" },
      { date:"12 Aug 2025", title:"Payment received",              note:"Bank transfer RCPT-25-1204 posted",                    amount:12000, type:"credit" },
      { date:"01 Dec 2025", title:"Tuition Fee Term 3 assigned",   note:"Term 3 installment due",                              amount:12000, type:"charge" },
      { date:"10 Apr 2026", title:"Transport Fee - April assigned", note:"Monthly transport fee",                              amount:2800,  type:"charge" },
    ],
    ledgerBalance:14800,
  },
  {
    id:"s0103", name:"Vivaan Sharma", admNo:"ADM-0103", cls:"6A", group:"Full Boarder", status:"partial",
    dues:[
      { id:"d1", label:"Hostel Fee Term 2", amount:18000, due:"10 Aug 2025" },
      { id:"d2", label:"Lunch Fee - May",   amount:4200,  due:"10 May 2026" },
    ],
    ledger:[
      { date:"10 Aug 2025", title:"Hostel Fee Term 2 assigned", note:"Second term hostel installment", amount:18000, type:"charge" },
      { date:"10 May 2026", title:"Lunch Fee - May assigned",   note:"Monthly lunch installment",       amount:4200,  type:"charge" },
      { date:"15 May 2026", title:"Payment received",           note:"Parent transferred via NEFT",     amount:10000, type:"credit" },
    ],
    fullLedger:[
      { date:"10 Apr 2025", title:"Hostel Fee Term 1 assigned", note:"First term hostel installment",   amount:18000, type:"charge" },
      { date:"14 Apr 2025", title:"Payment received",           note:"Cheque CHQ-0041 cleared",          amount:18000, type:"credit" },
      { date:"10 Aug 2025", title:"Hostel Fee Term 2 assigned", note:"Second term hostel installment",   amount:18000, type:"charge" },
      { date:"10 May 2026", title:"Lunch Fee - May assigned",   note:"Monthly lunch installment",        amount:4200,  type:"charge" },
      { date:"15 May 2026", title:"Payment received",           note:"Parent transferred via NEFT",      amount:10000, type:"credit" },
    ],
    ledgerBalance:12200,
  },
  {
    id:"s0101", name:"Aarav Sharma", admNo:"ADM-0101", cls:"6A", group:"Day Scholar", status:"cleared",
    dues:[],
    ledger:[
      { date:"10 Apr 2025", title:"Tuition Fee Term 1 assigned", note:"First term installment",         amount:12000, type:"charge" },
      { date:"15 Apr 2025", title:"Payment received",            note:"Paid in full via bank transfer",  amount:12000, type:"credit" },
    ],
    fullLedger:[
      { date:"10 Apr 2025", title:"Tuition Fee Term 1 assigned", note:"Day Scholar annual schedule",     amount:12000, type:"charge" },
      { date:"15 Apr 2025", title:"Payment received",            note:"Bank transfer RCPT-25-0741",       amount:12000, type:"credit" },
      { date:"10 Aug 2025", title:"Tuition Fee Term 2 assigned", note:"Term 2 installment",              amount:12000, type:"charge" },
      { date:"11 Aug 2025", title:"Payment received",            note:"Online RCPT-25-1190",              amount:12000, type:"credit" },
      { date:"01 Dec 2025", title:"Tuition Fee Term 3 assigned", note:"Term 3 installment",              amount:12000, type:"charge" },
      { date:"02 Dec 2025", title:"Payment received",            note:"UPI RCPT-25-2341",                 amount:12000, type:"credit" },
    ],
    ledgerBalance:0,
  },
  {
    id:"s0104", name:"Ananya Sharma", admNo:"ADM-0104", cls:"6A", group:"Day Scholar", status:"overdue",
    dues:[
      { id:"d1", label:"Tuition Fee Term 1", amount:12000, due:"10 Apr 2025" },
      { id:"d2", label:"Admission Fee",      amount:5000,  due:"01 Apr 2025" },
    ],
    ledger:[
      { date:"01 Apr 2025", title:"Admission Fee assigned",      note:"One-time admission fee",     amount:5000,  type:"charge" },
      { date:"10 Apr 2025", title:"Tuition Fee Term 1 assigned", note:"Term 1 installment",         amount:12000, type:"charge" },
      { date:"17 Apr 2025", title:"Late fee accrued",            note:"7 chargeable days × Rs. 50", amount:350,   type:"charge" },
    ],
    fullLedger:[
      { date:"01 Apr 2025", title:"Admission Fee assigned",      note:"One-time admission fee",          amount:5000,  type:"charge" },
      { date:"10 Apr 2025", title:"Tuition Fee Term 1 assigned", note:"Term 1 installment",              amount:12000, type:"charge" },
      { date:"17 Apr 2025", title:"Late fee accrued",            note:"7 chargeable days × Rs. 50",      amount:350,   type:"charge" },
      { date:"01 May 2025", title:"Payment arrangement note",    note:"Parent to settle by 15 May 2025", amount:null,  type:"note"   },
    ],
    ledgerBalance:17350,
    lateFeeCalc:{ label:"Ananya Sharma · Tuition Fee Term 1", dueRule:"Due date 10 Apr 2025 · Rule: Rs. 50 daily after 7-day grace period, capped at Rs. 1,500", outstanding:12000, daysOverdue:37, chargeableDays:30, rawPenalty:1500, finalDue:13500 },
  },
  {
    id:"s0165", name:"Kabir Nair", admNo:"ADM-0165", cls:"8A", group:"Day Scholar", status:"partial",
    dues:[
      { id:"d1", label:"Tuition Fee Term 2", amount:12000, due:"10 Aug 2025" },
    ],
    ledger:[
      { date:"10 Aug 2025", title:"Tuition Fee Term 2 assigned", note:"Term 2 installment due", amount:12000, type:"charge" },
    ],
    fullLedger:[
      { date:"10 Apr 2025", title:"Tuition Fee Term 1 assigned", note:"Day Scholar annual schedule",  amount:12000, type:"charge" },
      { date:"12 Apr 2025", title:"Payment received",            note:"NEFT RCPT-25-0801",             amount:12000, type:"credit" },
      { date:"10 Aug 2025", title:"Tuition Fee Term 2 assigned", note:"Term 2 installment due",        amount:12000, type:"charge" },
    ],
    ledgerBalance:12000,
  },
  {
    id:"s0225", name:"Kabir Iyer", admNo:"ADM-0225", cls:"10B", group:"Transport Users", status:"partial",
    dues:[
      { id:"d1", label:"Tuition Fee Term 3",  amount:12000, due:"01 Dec 2025" },
      { id:"d2", label:"Transport Fee - May", amount:2800,  due:"10 May 2026" },
    ],
    ledger:[
      { date:"01 Dec 2025", title:"Tuition Fee Term 3 assigned",  note:"Term 3 installment due",  amount:12000, type:"charge" },
      { date:"10 May 2026", title:"Transport Fee - May assigned",  note:"Monthly transport fee",   amount:2800,  type:"charge" },
    ],
    fullLedger:[
      { date:"10 Apr 2025", title:"Tuition Fee Term 1 assigned",  note:"Transport Users schedule", amount:12000, type:"charge" },
      { date:"14 Apr 2025", title:"Payment received",             note:"Wallet RCPT-25-0910",       amount:12000, type:"credit" },
      { date:"10 Aug 2025", title:"Tuition Fee Term 2 assigned",  note:"Term 2 installment",        amount:12000, type:"charge" },
      { date:"11 Aug 2025", title:"Payment received",             note:"UPI RCPT-25-1320",           amount:12000, type:"credit" },
      { date:"01 Dec 2025", title:"Tuition Fee Term 3 assigned",  note:"Term 3 installment due",    amount:12000, type:"charge" },
      { date:"10 May 2026", title:"Transport Fee - May assigned",  note:"Monthly transport fee",    amount:2800,  type:"charge" },
    ],
    ledgerBalance:14800,
  },
];

const RECONCILIATION = [
  { id:"r1", ref:"HDFC statement UTR HDFC252705881",  match:"Matched to RCPT-25-4218 · Aditi Nair · Online",            score:98, status:"Matched"       },
  { id:"r2", ref:"Cheque CHQ842901 awaiting clearance",match:"Candidate: RCPT-25-4194 · Kabir Mehta · HDFC Bank",       score:72, status:"Review"         },
  { id:"r3", ref:"Wallet settlement batch PAYTM-7782", match:"6 receipts grouped · gateway fee difference Rs. 42",       score:91, status:"Matched"       },
  { id:"r4", ref:"Bank transfer UTR APS529801",        match:"No admission number in narration; possible ADM-0163",      score:64, status:"Needs mapping"  },
];

const INIT_PAYMENTS: Payment[] = [
  { rcpt:"RCPT-25-5314", student:"Palak Sharma",   amount:10900, method:"Bank Transfer" },
  { rcpt:"RCPT-25-5313", student:"Veer Sharma",    amount:9700,  method:"Wallet"        },
  { rcpt:"RCPT-25-5312", student:"Navya Sharma",   amount:8500,  method:"Online"        },
  { rcpt:"RCPT-25-5311", student:"Aditya Sharma",  amount:14500, method:"Bank Transfer" },
  { rcpt:"RCPT-25-5310", student:"Prisha Sharma",  amount:13300, method:"Wallet"        },
  { rcpt:"RCPT-25-5309", student:"Anika Sharma",   amount:12100, method:"Online"        },
  { rcpt:"RCPT-25-5308", student:"Ira Sharma",     amount:10900, method:"Bank Transfer" },
  { rcpt:"RCPT-25-5307", student:"Reyansh Sharma", amount:9700,  method:"Wallet"        },
  { rcpt:"RCPT-25-5306", student:"Saanvi Sharma",  amount:8500,  method:"Online"        },
  { rcpt:"RCPT-25-5305", student:"Ishaan Sharma",  amount:14500, method:"Bank Transfer" },
];

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
  partial:{bg:"#FEF3C7",color:"#D97706"},
  cleared:{bg:"#DCFCE7",color:"#15803D"},
  overdue:{bg:"#FEE2E2",color:"#DC2626"},
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
const _DEFAULT = STUDENTS[0]; // Kabir Sharma pre-loaded to show all sections

export default function FeesCollectionPanel() {
  const [searchQ,     setSearchQ]     = useState(_DEFAULT.name);
  const [showDrop,    setShowDrop]    = useState(false);
  const [selected,    setSelected]    = useState<StudentRecord|null>(_DEFAULT);
  const [checked,     setChecked]     = useState<Set<string>>(new Set(_DEFAULT.dues.map(d=>d.id)));
  const [amtPaid,     setAmtPaid]     = useState(String(_DEFAULT.dues.reduce((a,d)=>a+d.amount,0)));
  const [method,      setMethod]      = useState("Cash");
  const [dateTime,    setDateTime]    = useState("27-05-2026 10:30");
  const [note,        setNote]        = useState("Parent requested receipt copy by email.");
  const [payments,    setPayments]    = useState<Payment[]>(INIT_PAYMENTS);
  const [rcptN,       setRcptN]       = useState(5315);
  const [toast,       setToast]       = useState("");
  const [showLedger,   setShowLedger]   = useState(false);
  const [simNotif,     setSimNotif]     = useState("");
  const [simIdx,       setSimIdx]       = useState(0);
  const [showConfirm,  setShowConfirm]  = useState(false);
  const [printNow,     setPrintNow]     = useState(true);
  const [sendSMS,      setSendSMS]      = useState(false);
  const [collectedBy,  setCollectedBy]  = useState("Finance Desk");
  const [counter,      setCounter]      = useState("Counter 1");

  const toast_ = (m:string)=>{setToast(m);setTimeout(()=>setToast(""),3000);};

  const results = useMemo(()=>{
    const q=searchQ.toLowerCase().trim();
    if(!q) return [];
    return STUDENTS.filter(s=>s.name.toLowerCase().includes(q)||s.admNo.toLowerCase().includes(q));
  },[searchQ]);

  const pick = (s:StudentRecord)=>{
    setSelected(s); setSearchQ(s.name); setShowDrop(false);
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

  const postPayment=()=>{
    if(!selected) return;
    const r=`RCPT-25-${rcptN}`;
    setPayments(p=>[{rcpt:r,student:selected.name,amount:parseInt(amtPaid)||0,method},...p]);
    setRcptN(n=>n+1);
    setShowConfirm(false);
    toast_(`Receipt ${r} posted for ${selected.name}.`);
    setSelected(null); setSearchQ(""); setChecked(new Set()); setAmtPaid(""); setNote(""); setMethod("Cash");
  };

  const selDues = selected?.dues.filter(d=>checked.has(d.id))??[];
  const total   = parseInt(amtPaid)||0;
  const nextR   = `RCPT-25-${rcptN}`;

  const SIM_PAYMENTS = [
    { method:"Wallet",        name:"Aarav Iyer"   },
    { method:"Bank Transfer", name:"Priya Sharma"  },
    { method:"Online",        name:"Rahul Verma"   },
    { method:"UPI",           name:"Kavya Singh"   },
    { method:"Cash",          name:"Rohan Mehta"   },
  ];
  const simulatePayment = () => {
    const p = SIM_PAYMENTS[simIdx % SIM_PAYMENTS.length];
    setSimNotif(`Incoming ${p.method} payment verified for ${p.name}`);
    setSimIdx(i => i + 1);
    setTimeout(() => setSimNotif(""), 4000);
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
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <h1 style={{margin:"0 0 6px",fontSize:34,fontWeight:700,color:"#181B2A",lineHeight:1.1}}>Collection</h1>
            <p style={{margin:0,fontSize:14,color:"#A0A3B8"}}>Search a student, record payment across one or more assignments, and issue a receipt.</p>
          </div>
          <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:10,marginTop:6}}>
            {simNotif&&(
              <div style={{display:"flex",alignItems:"center",gap:8,background:"#1e293b",color:"#fff",padding:"10px 16px",borderRadius:30,fontSize:13,fontWeight:500,animation:"toastUp 0.2s ease",boxShadow:"0 4px 16px rgba(0,0,0,0.22)"}}>
                <span style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",flexShrink:0,display:"inline-block"}}/>
                {simNotif}
              </div>
            )}
            <div style={{display:"flex",gap:10}}>
              <button style={oBtn()} onClick={()=>{ if(selected) setShowLedger(true); else toast_("Select a student first."); }}>Student Ledger</button>
              <button style={pBtn()} onClick={simulatePayment}>Simulate Incoming Payment</button>
            </div>
          </div>
        </div>
      </div>

      {/* ── Two-column grid ──────────────────────────────────────────── */}
      <div style={{display:"grid",gridTemplateColumns:"1.15fr 1fr",gap:20,alignItems:"flex-start"}}>

        {/* ═══ LEFT ═══ */}
        <div style={{display:"flex",flexDirection:"column",gap:16}}>

          {/* Student Search */}
          <div style={CARD}>
            <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>Student Search</div>
            <div style={{fontSize:13,color:"#A0A3B8",marginBottom:16}}>Type a name or admission number to load outstanding assignments.</div>

            <div style={{position:"relative"}}>
              <div style={{display:"flex",alignItems:"center",border:"1px solid #E8E8EE",borderRadius:9,padding:"0 14px",height:42}}>
                <span style={{color:"#A0A3B8",fontSize:13.5,marginRight:10,flexShrink:0,fontWeight:500}}>Search</span>
                <input
                  value={searchQ}
                  onChange={e=>{setSearchQ(e.target.value);setShowDrop(true);if(selected&&e.target.value!==selected.name)setSelected(null);}}
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
                {selected.dues.length===0&&<div style={{fontSize:13,color:"#A0A3B8",padding:"10px 0"}}>No outstanding dues.</div>}
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
                  <input value={amtPaid} onChange={e=>setAmtPaid(e.target.value)} type="number"
                    style={{width:"100%",height:40,border:"1px solid #E8E8EE",borderRadius:9,padding:"0 12px",fontSize:13.5,boxSizing:"border-box"}}/>
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

          {/* Student Ledger View */}
          <div style={CARD}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:selected?16:12}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>Student Ledger View</div>
                <div style={{fontSize:13,color:"#A0A3B8"}}>Per-student accounting timeline of charges, concessions, payments, and adjustments.</div>
              </div>
              <button style={{...oBtn(true),marginTop:2}} onClick={()=>{ if(selected) setShowLedger(true); else toast_("Select a student first."); }}>Open Full Ledger</button>
            </div>

            {selected ? (
              <>
                <div style={{display:"flex",alignItems:"center",gap:12,padding:"11px 14px",background:"#F5F3FF",border:"1px solid #c4b5fd",borderRadius:10,marginBottom:14}}>
                  <Avatar name={selected.name} size={38}/>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13.5,fontWeight:700,color:"#181B2A"}}>{selected.name}</div>
                    <div style={{fontSize:12,color:"#A0A3B8"}}>{selected.admNo} · Class {selected.cls} · {selected.group}</div>
                  </div>
                  <StatusPill label={selected.status} style={ST_STYLE[selected.status]}/>
                </div>

                {selected.ledger.map((e,i)=>(
                  <div key={i} style={{display:"flex",gap:12,padding:"11px 0",borderBottom:i<selected.ledger.length-1?"1px solid #F0F0F0":"none"}}>
                    <div style={{width:84,fontSize:11.5,color:"#A0A3B8",flexShrink:0,paddingTop:2}}>{e.date}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#181B2A",marginBottom:2}}>{e.title}</div>
                      <div style={{fontSize:12,color:"#A0A3B8"}}>{e.note}</div>
                    </div>
                    <div style={{fontSize:13,fontWeight:600,flexShrink:0,color:e.type==="credit"?"#16a34a":e.type==="charge"?"#dc2626":"#A0A3B8"}}>
                      {e.amount!=null?(e.type==="credit"?"-":"")+"Rs. "+e.amount.toLocaleString("en-IN"):"Note"}
                    </div>
                  </div>
                ))}

                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",paddingTop:14,marginTop:6,borderTop:"2px solid #E8E8EE"}}>
                  <div style={{fontSize:13.5,color:"#5B5E72"}}>Ledger balance</div>
                  <div style={{fontSize:18,fontWeight:700,color:"#6D4AFF"}}>Rs. {selected.ledgerBalance.toLocaleString("en-IN")}</div>
                </div>
              </>
            ) : (
              <div style={{textAlign:"center",padding:"20px 0",color:"#A0A3B8",fontSize:13}}>Select a student to view ledger</div>
            )}
          </div>

          {/* Payment Reconciliation */}
          <div style={CARD}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:16}}>
              <div>
                <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>Payment Reconciliation</div>
                <div style={{fontSize:13,color:"#A0A3B8"}}>Match bank, online, wallet, and cheque records against receipts.</div>
              </div>
              <button style={{...oBtn(true),marginTop:2}} onClick={()=>toast_("Refreshing…")}>Refresh</button>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {RECONCILIATION.map(r=>{
                const s=RC_STYLE[r.status];
                return(
                  <div key={r.id} style={{display:"flex",alignItems:"flex-start",gap:12,padding:"13px 16px",border:"1px solid #E8E8EE",borderRadius:10}}>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13,fontWeight:600,color:"#181B2A",marginBottom:3}}>{r.ref}</div>
                      <div style={{fontSize:12,color:"#A0A3B8",marginBottom:8}}>{r.match}</div>
                      <StatusPill label={r.status} style={s}/>
                    </div>
                    <ScoreCircle score={r.score}/>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Recent Payments */}
          <div style={{...CARD,padding:0,overflow:"hidden"}}>
            <div style={{padding:"18px 24px 14px"}}>
              <div style={{fontSize:15,fontWeight:700,color:"#181B2A",marginBottom:3}}>Recent Payments</div>
              <div style={{fontSize:13,color:"#A0A3B8"}}>Last posted transactions.</div>
            </div>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead>
                <tr style={{background:"#F8F8FB"}}>
                  {["RECEIPT","STUDENT","AMOUNT","METHOD","LIFECYCLE STATUS","ACTIONS"].map(h=>(
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payments.map((p,i)=>(
                  <tr key={p.rcpt} className="fc-row" style={{borderBottom:i<payments.length-1?"1px solid #E8E8EE":"none"}}>
                    <td style={{...TD,fontWeight:600,fontSize:12.5}}>{p.rcpt}</td>
                    <td style={TD}>{p.student}</td>
                    <td style={{...TD,fontWeight:600}}>{fmtRs(p.amount)}</td>
                    <td style={TD}>{p.method}</td>
                    <td style={TD}>
                      <span style={{fontSize:12,fontWeight:600,padding:"3px 10px",borderRadius:20,background:"#dcfce7",color:"#15803d",border:"1px solid #86efac"}}>Posted</span>
                    </td>
                    <td style={TD}>
                      <div style={{display:"flex",flexDirection:"column",gap:5}}>
                        <button style={oBtn(true)} onClick={()=>toast_(`Printing ${p.rcpt}…`)}>Receipt</button>
                        <button style={oBtn(true)} onClick={()=>toast_(`Reversing ${p.rcpt}…`)}>Reverse</button>
                        <button style={{...oBtn(true),color:"#dc2626",borderColor:"#fca5a5"}} onClick={()=>toast_(`Deleting ${p.rcpt}…`)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

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
                  Rs. {(parseInt(amtPaid)||0).toLocaleString("en-IN")}
                </div>
                <div style={{fontSize:13,color:"#A0A3B8"}}>{selected.name} · {selected.admNo} · Class {selected.cls}</div>
              </div>

              {/* Receipt + method rows */}
              <div style={{border:"1px solid #E8E8EE",borderRadius:10,overflow:"hidden",marginBottom:20}}>
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
              <button style={{height:38,padding:"0 20px",border:"none",borderRadius:9,background:"#6D4AFF",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px rgba(109,74,255,0.20)"}} onClick={postPayment}>
                Post {method} Payment
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
              <div style={{border:"1px solid #E8E8EE",borderRadius:10,overflow:"hidden",marginBottom:16}}>
                {selected.fullLedger.map((e,i)=>(
                  <div key={i} style={{display:"flex",gap:14,padding:"13px 16px",borderBottom:i<selected.fullLedger.length-1?"1px solid #F0F0F0":"none",background:"#fff"}}>
                    <div style={{width:88,fontSize:11.5,color:"#A0A3B8",flexShrink:0,paddingTop:2}}>{e.date}</div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:13.5,fontWeight:600,color:"#181B2A",marginBottom:2}}>{e.title}</div>
                      <div style={{fontSize:12,color:"#A0A3B8"}}>{e.note}</div>
                    </div>
                    <div style={{fontSize:13.5,fontWeight:600,flexShrink:0,color:e.type==="credit"?"#16a34a":e.type==="charge"?"#dc2626":"#A0A3B8"}}>
                      {e.amount!=null?(e.type==="credit"?"-":"")+"Rs. "+e.amount.toLocaleString("en-IN"):"Note"}
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
              <button style={{height:36,padding:"0 18px",border:"none",borderRadius:8,background:"#6D4AFF",color:"#fff",fontSize:13,fontWeight:600,cursor:"pointer",boxShadow:"0 2px 8px rgba(109,74,255,0.20)"}} onClick={()=>toast_("Generating ledger PDF…")}>Generate Ledger PDF</button>
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
