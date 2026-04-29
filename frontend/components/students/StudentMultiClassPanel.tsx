"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import s from "./StudentMultiClassPanel.module.css";
import { API_BASE_URL } from "@/lib/api";

interface EnrolledStudent { name:string; admissionNo:string; rollNo:string; className:string; sectionName:string; academicYear:string; }
interface AISuggestion { lang2:string; lang3:string; sport:string; art:string; }
interface MockStudent { id:number; name:string; admNo:string; rollNo:string; lang2:string; lang3:string; sport:string; art:string; status:"done"|"partial"|"empty"; optionalSubjects?:string[]; }
interface MockSection { id:number; letter:string; teacher:string; students:MockStudent[]; }
interface MockClass { id:number; label:string; sections:MockSection[]; }
interface KpiStats { enrolled:number; assigned:number; partial:number; pending:number; }
type Tab = "assign"|"filter"|"browse";

const MANDATORY_DEFAULT = ["English","Maths","Science","Social","Computers","PT","Art & Craft"];

function getMandatoryForClass(label:string):string[] {
  if(/Nursery|LKG|UKG/i.test(label))
    return ["General Studies","Drawing & Crafts","Stories & Rhymes","Play & Motor Skills","Music","PT & Games"];
  if(/Class [1-5]$/i.test(label))
    return ["English","Maths","Science","Social Studies","EVS","PT & Games","Art & Craft"];
  if(/Class [6-8]$/i.test(label))
    return ["English","Maths","Science","Social Studies","Computers","PT & Games","Art & Craft"];
  if(/Class 9|Class 10/i.test(label))
    return ["English","Maths","Physics","Chemistry","Biology","Social Science","Computer Science"];
  if(/Class 11|Class 12/i.test(label))
    return ["English","Mathematics","Physics","Chemistry","Computer Science","PT"];
  return MANDATORY_DEFAULT;
}
const AVATARS = ["#6c4cf1","#1eb980","#f5a623","#2c56a1","#a0264a","#5638d4","#915a1a","#e5534b"];
const initials = (n:string) => n.split(" ").map(x=>x[0]).join("").slice(0,2).toUpperCase();
const avatarBg = (n:string) => AVATARS[n.charCodeAt(0) % AVATARS.length];

// ─ Icons ─
const ChevronIcon = ({open}:{open:boolean}) => (
  <svg className={`${s.chevron} ${open?s.chevronOpen:""}`} width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const CheckIcon = () => (<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.2 7.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>);
const PencilIcon = ({size=13}:{size?:number}) => (<svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5L11.5 4.5L5 11H3V9L9.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const EditPenIcon = ({size=13}:{size?:number}) => (<svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M11.5 2a1.5 1.5 0 0 1 2.12 2.12l-.88.88-2.12-2.12.88-.88Z" fill="currentColor" opacity=".7"/><path d="M9.5 4l2.12 2.12L5 12.62 2.5 13.5l.88-2.5L9.5 4Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M2.5 13.5l.88-2.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>);
const SparkleIcon = ({size=14,color="#fff"}:{size?:number;color?:string}) => (<svg width={size} height={size} viewBox="0 0 16 16" fill="none"><path d="M8 1L9.3 5.7L14 7L9.3 8.3L8 13L6.7 8.3L2 7L6.7 5.7L8 1Z" fill={color} stroke={color} strokeWidth="0.5"/></svg>);
const LangIcon = () => (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.2 6.5C4.2 9.2 5.2 11 6.5 11s2.3-1.8 2.3-4.5S7.8 2 6.5 2 4.2 3.8 4.2 6.5Z" stroke="currentColor" strokeWidth="1.3"/><path d="M1.5 6.5h10" stroke="currentColor" strokeWidth="1.3"/></svg>);
const LockIcon = () => (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><rect x="2" y="6" width="9" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.4"/><path d="M4 6V4.5A2.5 2.5 0 0 1 9 4.5V6" stroke="currentColor" strokeWidth="1.4"/></svg>);
const FunnelIcon = () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12l-4.5 5V14L6.5 13V8L2 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>);
const TrophyIcon = () => (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M4 2h5v5a2.5 2.5 0 0 1-5 0V2Z" stroke="currentColor" strokeWidth="1.3"/><path d="M6.5 9v2M4.5 11h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M4 3.5H2.5A1 1 0 0 0 2 4.5C2 5.8 2.8 6.5 4 6.8M9 3.5h1.5a1 1 0 0 1 .5 1 2.2 2.2 0 0 1-2 2.3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>);
const PaletteIcon = () => (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 1.5A5 5 0 1 0 10 9.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><circle cx="4" cy="5" r="0.8" fill="currentColor"/><circle cx="6.5" cy="3.5" r="0.8" fill="currentColor"/><circle cx="9" cy="5" r="0.8" fill="currentColor"/><path d="M10 9.5a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3Z" stroke="currentColor" strokeWidth="1.3"/></svg>);
const UsersIcon = () => (<svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><circle cx="3.5" cy="3.5" r="1.5"/><path d="M0 8a3.5 3.5 0 0 1 7 0H0Z"/><circle cx="7" cy="3" r="1.3"/><path d="M5.5 8h4a2.8 2.8 0 0 0-4-2.5"/></svg>);
const LinkIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M5 7L7 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M8.5 4.5A2 2 0 0 0 5.5 7.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M3.5 7.5A2 2 0 0 0 6.5 4.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>);
const DocIcon = () => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 5H8M4.5 7.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9 4l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);
const PlusIcon = () => (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const TrashIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4 3l.5 7h3L8 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const XSmIcon = () => (<svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M1.5 1.5l6 6M7.5 1.5l-6 6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>);
const SaveIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 2h7l1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V2Z" stroke="currentColor" strokeWidth="1.2"/><path d="M4 2v3h4V2M4 7h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);

// ─ SubBadge ─
function SubBadge({tag,value,color,dim,err}:{tag:string;value:string;color:string;dim?:boolean;err?:boolean}) {
  return (
    <span className={`${s.subBadge} ${dim?s.subBadgeDim:""} ${err?s.subBadgeErr:""}`}>
      <span className={s.badgeTag} style={{background:color}}>{tag}</span>
      <span className={`${s.badgeVal} ${dim?s.badgeDimVal:""} ${err?s.badgeErrVal:""}`}>{value}</span>
    </span>
  );
}

// ─ PreviewBadges ─
function PreviewBadges({lang2,lang3,sports,arts}:{lang2:string;lang3:string;sports:string[];arts:string[]}) {
  const total = 7 + (lang2?1:0) + (lang3?1:0) + sports.length + arts.length;
  return (
    <div>
      <div className={s.previewLabel}>WILL BE ASSIGNED</div>
      <div className={s.badgeRow}>
        <SubBadge tag="MAN" value="+7" color="var(--tag-m)" dim />
        {lang2 ? <SubBadge tag="L2" value={lang2} color="var(--tag-l2)" /> : <SubBadge tag="L2" value="missing" color="var(--tag-err)" err />}
        {lang3 ? <SubBadge tag="L3" value={lang3} color="var(--tag-l3)" /> : <SubBadge tag="L3" value="missing" color="var(--tag-err)" err />}
        {sports.map(sp=><SubBadge key={sp} tag="SP" value={sp} color="var(--tag-sp)" />)}
        {arts.map(ar=><SubBadge key={ar} tag="AR" value={ar} color="var(--tag-ar)" />)}
        <span className={s.badgeTotal}>{total} total</span>
      </div>
    </div>
  );
}

// ─ AIBanner ─
function AIBanner({suggestion,loading,className,section,onApply}:{suggestion:AISuggestion|null;loading:boolean;className:string;section:string;onApply:(s:AISuggestion)=>void;}) {
  if (!loading && !suggestion) return null;
  return (
    <div className={s.aiBanner}>
      <span className={s.aiBannerIcon}><SparkleIcon size={16} color="#fff" /></span>
      {loading ? <div className={s.aiBannerSkeleton}/> : suggestion ? (
        <p className={s.aiBannerText}>
          <strong>AI suggestion</strong> &mdash; Peers in <strong>{className}&ndash;{section}</strong> most commonly chose{" "}
          <strong>{suggestion.lang2}</strong> (2nd lang), <strong>{suggestion.lang3}</strong> (3rd lang),{" "}
          <strong>{suggestion.sport}</strong> &amp; <strong>{suggestion.art}</strong>. Apply this combination?
        </p>
      ) : null}
      {!loading && suggestion && (
        <button className={s.aiBannerApply} onClick={()=>onApply(suggestion)}>
          <SparkleIcon size={11} color="var(--ink)"/> Apply
        </button>
      )}
    </div>
  );
}

// ─ Chk ─
function Chk({checked,onChange}:{checked:boolean;onChange?:()=>void}) {
  return <span className={`${s.checkBox} ${checked?s.checkBoxOn:""}`} onClick={onChange}>{checked&&<CheckIcon/>}</span>;
}

// ─ ModuleCard ─
interface CardDef { title:string; options:string[]; }
function ModuleCard({cardDef,icon,chipLabel,chipClass,multi,value,onChange,onCardChange,disabledOptions}:{
  cardDef:CardDef;icon:React.ReactNode;chipLabel:string;chipClass:string;
  multi:boolean;value:string|string[];
  onChange:(v:string|string[])=>void;
  onCardChange:(def:CardDef)=>void;
  disabledOptions?:string[];
}) {
  const {title,options}=cardDef;
  const [editMode,setEditMode]=useState(false);
  const [draftTitle,setDraftTitle]=useState(title);
  const [draftOpts,setDraftOpts]=useState<string[]>(options);
  const [editOptIdx,setEditOptIdx]=useState<number|null>(null);
  const [editOptVal,setEditOptVal]=useState("");
  const [newOpt,setNewOpt]=useState("");

  // keep draft in sync when parent updates
  useEffect(()=>{setDraftTitle(title);setDraftOpts(options);},[title,options]);

  const isSelected=(opt:string)=>multi?(value as string[]).includes(opt):value===opt;
  const isDisabled=(opt:string)=>!!(disabledOptions?.includes(opt));
  const toggle=(opt:string)=>{
    if(isDisabled(opt))return;
    if(multi){const arr=value as string[];onChange(arr.includes(opt)?arr.filter(x=>x!==opt):[...arr,opt]);}
    else{onChange(value===opt?"":opt);}
  };

  const saveCard=()=>{
    const t=draftTitle.trim()||title;
    const opts=draftOpts.filter(o=>o.trim());
    onCardChange({title:t,options:opts});
    // deselect any removed options
    if(multi){onChange((value as string[]).filter(v=>opts.includes(v)));}
    else if(!opts.includes(value as string)){onChange("");}
    setEditMode(false);
    setEditOptIdx(null);
  };
  const discardCard=()=>{
    setDraftTitle(title);setDraftOpts(options);setEditMode(false);setEditOptIdx(null);setNewOpt("");
  };
  const commitOpt=(idx:number)=>{
    const v=editOptVal.trim();
    if(v)setDraftOpts(prev=>prev.map((o,i)=>i===idx?v:o));
    setEditOptIdx(null);
  };
  const deleteOpt=(idx:number)=>{
    setDraftOpts(prev=>prev.filter((_,i)=>i!==idx));
  };
  const addOpt=()=>{
    const v=newOpt.trim();
    if(!v||draftOpts.includes(v))return;
    setDraftOpts(prev=>[...prev,v]);
    setNewOpt("");
  };

  if(editMode) return (
    <div className={`${s.optCard} ${s.optCardEditing}`}>
      <div className={s.cardEditHeader}>
        <input className={s.cardTitleInput} value={draftTitle} onChange={e=>setDraftTitle(e.target.value)} placeholder="Card title"/>
        <div className={s.cardEditActions}>
          <button className={s.cardEditSave} onClick={saveCard}><SaveIcon/> Save</button>
          <button className={s.cardEditCancel} onClick={discardCard}><XSmIcon/></button>
        </div>
      </div>
      <div className={s.cardOptsList}>
        {draftOpts.map((opt,idx)=>(
          <div key={idx} className={s.cardOptRow}>
            {editOptIdx===idx
              ?<input autoFocus className={s.cardOptInput} value={editOptVal}
                  onChange={e=>setEditOptVal(e.target.value)}
                  onBlur={()=>commitOpt(idx)}
                  onKeyDown={e=>{if(e.key==="Enter")commitOpt(idx);if(e.key==="Escape")setEditOptIdx(null);}}
                />
              :<span className={s.cardOptLabel}>{opt}</span>
            }
            <span className={s.cardOptBtns}>
              <button className={s.cardOptBtn} title="Edit" onClick={()=>{setEditOptIdx(idx);setEditOptVal(opt);}}><PencilIcon size={11}/></button>
              <button className={`${s.cardOptBtn} ${s.cardOptBtnDel}`} title="Delete" onClick={()=>deleteOpt(idx)}><TrashIcon/></button>
            </span>
          </div>
        ))}
        <div className={s.cardAddRow}>
          <input className={s.cardAddInput} value={newOpt} placeholder="+ Add option…"
            onChange={e=>setNewOpt(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter")addOpt();}}
          />
          <button className={s.cardAddBtn} onClick={addOpt}>Add</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className={s.optCard}>
      <div className={s.moduleHeader}>
        <span className={s.moduleTitle}>{icon} {title}</span>
        <div style={{display:"flex",alignItems:"center",gap:5}}>
          <span className={`${s.moduleChip} ${chipClass}`}>{chipLabel}</span>
          <button className={s.cardMenuBtn} title="Edit card" onClick={()=>{setDraftTitle(title);setDraftOpts(options);setEditMode(true);}}><EditPenIcon size={12}/></button>
        </div>
      </div>
      {options.map(opt=>(
        <label key={opt} className={`${s.optItem} ${isDisabled(opt)?s.optItemDisabled:""}`}>
          <Chk checked={isSelected(opt)} onChange={()=>toggle(opt)}/>{opt}
          {isDisabled(opt)&&<span className={s.disabledHint}>(already in L2)</span>}
        </label>
      ))}
    </div>
  );
}

// ─ StudentRow ─
function StudentRow({student,classLabel,onEdit}:{student:MockStudent;classLabel:string;onEdit:()=>void}) {
  const mandCount=getMandatoryForClass(classLabel).length;
  return (
    <div className={s.tblRow}>
      <span/>
      <div className={s.studentCell}>
        <span className={s.avatar} style={{background:avatarBg(student.name)}}>{initials(student.name)}</span>
        <span className={s.studentName}>{student.name}</span>
      </div>
      <span className={s.admNo}>{student.admNo}</span>
      <span className={s.rollNo}>{student.rollNo}</span>
      <div className={s.badgeRow}>
        <SubBadge tag="MAN" value={`+${mandCount}`} color="var(--tag-m)" dim/>
        {student.lang2&&<SubBadge tag="L2" value={student.lang2} color="var(--tag-l2)"/>}
        {student.lang3&&<SubBadge tag="L3" value={student.lang3} color="var(--tag-l3)"/>}
        {student.sport&&<SubBadge tag="SP" value={student.sport} color="var(--tag-sp)"/>}
        {student.art&&<SubBadge tag="AR" value={student.art} color="var(--tag-ar)"/>}
      </div>
      <div className={s.tblLastCol}>
        <span className={`${s.statusChip} ${student.status==="done"?s.sDone:student.status==="partial"?s.sPartial:s.sEmpty}`}>
          {student.status==="done"?"Done":student.status==="partial"?"Partial":"Empty"}
        </span>
        <button className={`${s.editBtn} ${student.status==="empty"?s.editBtnEmpty:""}`} onClick={onEdit}>
          {student.status==="empty"?<SparkleIcon size={13} color="var(--primary)"/>:<PencilIcon/>}
        </button>
      </div>
    </div>
  );
}

// ─ Ring (inline SVG progress circle, mirrors AttendanceRing) ─
function Ring({pct,size=34}:{pct:number;size?:number}) {
  const sw=3, r=(size/2)-sw, circ=2*Math.PI*r;
  const offset=circ-(pct/100)*circ;
  const color=pct===0?"#D8D8E4":pct>=85?"#4729F4":pct>=60?"#B4721B":"#C2264E";
  return (
    <div style={{position:"relative",width:size,height:size,flexShrink:0}}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{transform:"rotate(-90deg)"}}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#F0F0F6" strokeWidth={sw}/>
        {pct>0&&<circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}/>}
      </svg>
      <span style={{position:"absolute",inset:0,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:700,color:"#0B0B14"}}>
        {pct===0?"—":`${pct}%`}
      </span>
    </div>
  );
}

// ─ ClassAcc ─
const CLASS_SUB_LABELS:Record<string,string>={
  "Nursery":"Pre-Nursery / Nursery","LKG":"Lower Kindergarten","UKG":"Upper Kindergarten",
  "Class 1":"Primary","Class 2":"Primary","Class 3":"Primary","Class 4":"Primary","Class 5":"Primary",
  "Class 6":"Middle School","Class 7":"Middle School","Class 8":"Middle School",
  "Class 9":"Secondary","Class 10":"Secondary","Class 11":"Senior Secondary","Class 12":"Senior Secondary",
};

// Compact page list with ellipsis. e.g. (3,8) -> [1,2,3,4,"…",8]
function buildPageList(current:number,total:number):(number|"…")[] {
  if(total<=7) return Array.from({length:total},(_,i)=>i+1);
  const pages:(number|"…")[]=[];
  pages.push(1);
  const left=Math.max(2,current-1);
  const right=Math.min(total-1,current+1);
  if(left>2) pages.push("…");
  for(let p=left;p<=right;p++) pages.push(p);
  if(right<total-1) pages.push("…");
  pages.push(total);
  return pages;
}

function ClassAcc({cls,index,defaultOpen,onEdit}:{cls:MockClass;index:number;defaultOpen?:boolean;onEdit:(cl:MockClass,st:MockStudent)=>void;}) {
  const [open,setOpen]=useState(!!defaultOpen);
  const [activeSecIdx,setActiveSecIdx]=useState(0);
  const [page,setPage]=useState(1);
  const PAGE_SIZE=10;
  const all=cls.sections.flatMap(sc=>sc.students);
  const done=all.filter(x=>x.status==="done").length;
  const pct=all.length>0?Math.round((done/all.length)*100):0;
  const subLabel=CLASS_SUB_LABELS[cls.label]??"Grade";
  void index;

  const activeSec=cls.sections[activeSecIdx]??cls.sections[0];
  const totalRows=activeSec?activeSec.students.length:0;
  const totalPages=Math.max(1,Math.ceil(totalRows/PAGE_SIZE));
  const safePage=Math.min(page,totalPages);
  const startIdx=(safePage-1)*PAGE_SIZE;
  const visibleStudents=activeSec?activeSec.students.slice(startIdx,startIdx+PAGE_SIZE):[];

  // Reset page when the active section changes or when the dataset shrinks.
  useEffect(()=>{setPage(1);},[activeSecIdx,cls.sections]);

  return (
    <div className={`${s.classAcc} ${open?s.classAccOpen:""}`}>
      {/* Class header */}
      <div className={`${s.classHead} ${open?s.classHeadOpen:""}`} onClick={()=>setOpen(v=>!v)}>
        <svg className={`${s.classChevron} ${open?s.classChevronOpen:""}`} width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="m9 18 6-6-6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <div className={s.classNameBlock}>
          <span className={s.className}>{cls.label}</span>
          <span className={s.classSubLabel}>{subLabel}</span>
        </div>
        <div className={s.classPills}>
          <span className={s.pill}>{all.length} students</span>
          <span className={`${s.pill} ${s.pillGray}`}>{cls.sections.length} sections</span>
          {done>0&&<span className={`${s.pill} ${s.pillGreen}`}>{done} done</span>}
          {(all.length-done)>0&&<span className={`${s.pill} ${s.pillAmber}`}>{all.length-done} pending</span>}
        </div>
        <div className={s.classHeadRight}>
          <div className={s.ringWrap}><Ring pct={pct} size={34}/></div>
        </div>
      </div>

      {/* Body: section tabs + student table */}
      {open&&(
        <div className={s.secBody}>
          {cls.sections.length===0
            ?<div style={{padding:"14px",fontSize:12,color:"var(--ink-ghost)",textAlign:"center"}}>No sections configured.</div>
            :<>
              {/* Horizontal section tabs */}
              <div className={s.secTabs}>
                {cls.sections.map((sec,i)=>{
                  const sdone=sec.students.filter(x=>x.status==="done").length;
                  const isActive=activeSecIdx===i;
                  const isComplete=sec.students.length>0&&sdone===sec.students.length;
                  const isPartial=sec.students.length>0&&sdone>0&&sdone<sec.students.length;
                  let badgeCls=s.secTabBadge;
                  if(isComplete)badgeCls=`${s.secTabBadge} ${s.secTabBadgeGreen}`;
                  else if(isPartial)badgeCls=`${s.secTabBadge} ${s.secTabBadgeAmber}`;
                  else if(isActive)badgeCls=`${s.secTabBadge} ${s.secTabBadgeActive}`;
                  return (
                    <button key={sec.id}
                      className={`${s.secTab} ${isActive?s.secTabActive:""}`}
                      onClick={e=>{e.stopPropagation();setActiveSecIdx(i);}}>
                      Section {sec.letter}
                      <span className={badgeCls}>{sec.students.length}</span>
                    </button>
                  );
                })}
              </div>
              {/* Student table for active section */}
              {activeSec&&(
                <div className={s.tblWrap}>
                  <div className={s.tblHead}><span/><span>Student</span><span>Admission</span><span>Roll</span><span>Optional subjects</span><span/></div>
                  {visibleStudents.map(st=><StudentRow key={st.id} student={st} classLabel={cls.label} onEdit={()=>onEdit(cls,st)}/>)}
                  {activeSec.students.length===0&&(
                    <div style={{padding:"16px 14px",fontSize:12,color:"var(--ink-ghost)",textAlign:"center"}}>No students in this section.</div>
                  )}
                  <div className={s.tblFooter}>
                    <span className={s.tblFooterTxt}>
                      {totalRows===0
                        ?`0 students in Section ${activeSec.letter}`
                        :`${startIdx+1}\u2013${Math.min(startIdx+PAGE_SIZE,totalRows)} of ${totalRows} students in Section ${activeSec.letter}`}
                    </span>
                    {totalPages>1&&(
                      <div className={s.pager} onClick={e=>e.stopPropagation()}>
                        <button
                          type="button"
                          className={s.pagerBtn}
                          disabled={safePage<=1}
                          onClick={()=>setPage(p=>Math.max(1,p-1))}
                          aria-label="Previous page"
                        >‹</button>
                        {buildPageList(safePage,totalPages).map((p,i)=>(
                          p==="…"
                            ?<span key={`e${i}`} className={s.pagerEllipsis}>…</span>
                            :<button
                                key={p}
                                type="button"
                                className={`${s.pagerBtn} ${p===safePage?s.pagerBtnActive:""}`}
                                onClick={()=>setPage(p as number)}
                                aria-current={p===safePage?"page":undefined}
                              >{p}</button>
                        ))}
                        <button
                          type="button"
                          className={s.pagerBtn}
                          disabled={safePage>=totalPages}
                          onClick={()=>setPage(p=>Math.min(totalPages,p+1))}
                          aria-label="Next page"
                        >›</button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          }
        </div>
      )}
    </div>
  );
}

// ─ EditModal ─
interface SavedSubjects { lang2:string; lang3:string; sport:string; art:string; }
function EditModal({cls,student,cardDefs,onCardChange,onClose,onSave}:{cls:MockClass|null;student:MockStudent|null;cardDefs:{id:string;title:string;options:string[]}[];onCardChange:(id:string,def:CardDef)=>void;onClose:()=>void;onSave:(studentId:number,saved:SavedSubjects)=>void;}) {
  const [lang2,setLang2]=useState(student?.lang2??"");
  const [lang3,setLang3]=useState(student?.lang3??"");
  const [sports,setSports]=useState<string[]>(student?.sport?[student.sport]:[]);
  const [arts,setArts]=useState<string[]>(student?.art?[student.art]:[]);
  const [aiSug,setAiSug]=useState<AISuggestion|null>(null);
  const [aiLoading,setAiLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveErr,setSaveErr]=useState("");
  const l2Card=cardDefs.find(c=>c.id==="l2")!;
  const l3Card=cardDefs.find(c=>c.id==="l3")!;
  const spCard=cardDefs.find(c=>c.id==="sp")!;
  const arCard=cardDefs.find(c=>c.id==="ar")!;

  // Dynamic mandatory based on enrolled class
  const mandatory=getMandatoryForClass(cls?.label??"");

  useEffect(()=>{
    if(!student||!cls)return;
    setLang2(student.lang2??""); setLang3(student.lang3??"");
    setSports(student.sport?[student.sport]:[]);
    setArts(student.art?[student.art]:[]);
    setSaveErr("");
    const ctrl=new AbortController();
    const timer=setTimeout(()=>ctrl.abort(),3000);
    (async()=>{
      setAiLoading(true); setAiSug(null);
      try{
        const r=await fetch("/api/ai-subject-suggest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({className:cls.label,section:"A"}),signal:ctrl.signal});
        if(r.ok)setAiSug(await r.json());
      }catch{}finally{clearTimeout(timer);setAiLoading(false);}
    })();
    return()=>{ctrl.abort();clearTimeout(timer);};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[student?.id]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[onClose]);

  const handleSave=async()=>{
    if(!student||!cls)return;
    setSaving(true);setSaveErr("");
    try{
      const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
      const optionalNames=[...(lang2?[lang2]:[]),...(lang3?[lang3]:[]),...sports,...arts];
      const res=await fetch(`${API_BASE_URL}/api/v1/students/subject-assignments/upsert-optional/`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({student_id:student.id,subject_names:optionalNames}),
      });
      let json:{success?:boolean;message?:string}={};
      try{json=await res.json();}catch{}
      if(!res.ok){setSaveErr(json.message||`Save failed (${res.status})`);return;}
      onSave(student.id, {lang2, lang3, sport:sports[0]??"", art:arts[0]??""});
      onClose();
    }catch(e){setSaveErr("Network error. Please try again.");}
    finally{setSaving(false);}
  };

  if(!student||!cls)return null;
  return (
    <div className={s.backdrop} onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className={s.modal} onClick={e=>e.stopPropagation()}>
        <div className={s.modalHead}>
          <span className={s.modalAvatar} style={{background:avatarBg(student.name)}}>{initials(student.name)}</span>
          <div>
            <div className={s.modalClassLbl}>{cls.label}</div>
            <div className={s.modalStuName}>{student.name}</div>
            <div className={s.modalAdmNo}>{student.admNo}</div>
          </div>
        </div>
        <div className={s.modalBody}>
          <AIBanner suggestion={aiSug} loading={aiLoading} className={cls.label} section="A" onApply={sg=>{setLang2(sg.lang2);setLang3(sg.lang3);setSports([sg.sport]);setArts([sg.art]);}}/>
          <div className={s.mandatoryCard}>
            <div className={s.moduleHeader}>
              <span className={s.moduleTitle}><LockIcon/> Mandatory subjects <span className={s.moduleTitleSub}>(auto-checked, locked)</span></span>
              <span className={`${s.moduleChip} ${s.chipGreen}`}>{mandatory.length} / {mandatory.length}</span>
            </div>
            <div className={s.mandatoryGrid}>{mandatory.map((sub,idx)=>(
              <label key={idx} className={s.lockedItem}>
                <span className={s.checkLocked}><CheckIcon/></span>
                {sub}
              </label>
            ))}</div>
          </div>
          <div className={s.langGrid}>
            <ModuleCard cardDef={l2Card} icon={<LangIcon/>} chipLabel="pick 1" chipClass={s.chipBlue} multi={false} value={lang2} onChange={v=>{setLang2(v as string);if(lang3===v)setLang3("");}} onCardChange={d=>onCardChange("l2",d)}/>
            <ModuleCard cardDef={l3Card} icon={<LangIcon/>} chipLabel="pick 1" chipClass={s.chipBlue} multi={false} value={lang3} onChange={v=>setLang3(v as string)} onCardChange={d=>onCardChange("l3",d)} disabledOptions={lang2?[lang2]:[]}/>
          </div>
          <div className={s.actGrid}>
            <ModuleCard cardDef={spCard} icon={<TrophyIcon/>} chipLabel="1+ pick" chipClass={s.chipRed} multi={true} value={sports} onChange={v=>setSports(v as string[])} onCardChange={d=>onCardChange("sp",d)}/>
            <ModuleCard cardDef={arCard} icon={<PaletteIcon/>} chipLabel="1+ pick" chipClass={s.chipPurp} multi={true} value={arts} onChange={v=>setArts(v as string[])} onCardChange={d=>onCardChange("ar",d)}/>
          </div>
          <div className={s.previewCardInner}>
            <div className={s.previewCardTopRow}>
              <span className={s.previewLabel}>WILL BE ASSIGNED</span>
              {lang2&&lang3&&sports.length>0&&arts.length>0&&<span className={s.readyLabel}>Ready</span>}
            </div>
            <PreviewBadges lang2={lang2} lang3={lang3} sports={sports} arts={arts}/>
          </div>
          {saveErr&&<div className={s.saveErrMsg}>{saveErr}</div>}
        </div>
        <div className={s.modalFooter}>
          <button className={s.btnReset} onClick={onClose} disabled={saving}>Cancel</button>
          <button className={s.btnSave} onClick={handleSave} disabled={saving}>
            {saving?<span className={s.savingDot}/> : <CheckIcon/>} {saving?"Saving…":"Save & assign"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─ Main ─
export function StudentMultiClassPanel() {
  const router=useRouter();
  const [enrolled,setEnrolled]=useState<EnrolledStudent>({name:"",admissionNo:"",rollNo:"",className:"",sectionName:"",academicYear:""});
  const autoOpenedForEnrolledRef=useRef(false);
  useEffect(()=>{
    try{const raw=typeof window!=="undefined"&&localStorage.getItem("eskoolia_last_enrolled_student");if(raw)setEnrolled(JSON.parse(raw));}catch{}
  },[]);

  const [kpi,setKpi]=useState<KpiStats|null>(null);
  useEffect(()=>{
    (async()=>{
      try{
        const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
        const res=await fetch(`${API_BASE_URL}/api/v1/students/students/subject-assignment-stats/`,{
          headers:{Authorization:`Bearer ${token}`},cache:"no-store"
        });
        if(res.ok)setKpi(await res.json());
      }catch{}
    })();
  },[]);

  const [classList,setClassList]=useState<MockClass[]>([]);
  const [classListLoading,setClassListLoading]=useState(true);
  useEffect(()=>{
    (async()=>{
      try{
        const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
        const res=await fetch(`${API_BASE_URL}/api/v1/students/students/class-section-tree/`,{
          headers:{Authorization:`Bearer ${token}`},cache:"no-store"
        });
        if(res.ok){const data=await res.json();setClassList(data);}
      }catch{}finally{setClassListLoading(false);}
    })();
  },[]);

  const [activeTab,setActiveTab]=useState<Tab>("assign");
  const [filterOpen,setFilterOpen]=useState(false);
  const assignSecRef=useRef<HTMLDivElement|null>(null);
  const filterSecRef=useRef<HTMLDivElement|null>(null);
  const browseSecRef=useRef<HTMLDivElement|null>(null);
  const scrollToTab=(id:Tab)=>{
    const el=id==="assign"?assignSecRef.current:id==="filter"?filterSecRef.current:browseSecRef.current;
    if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
  };
  const [filterChips,setFilterChips]=useState<string[]>([]);
  const [lang2,setLang2]=useState("");const[lang3,setLang3]=useState("");
  const [sports,setSports]=useState<string[]>([]);const[arts,setArts]=useState<string[]>([]);

  const [mandatory,setMandatory]=useState<string[]>(MANDATORY_DEFAULT);
  const [editMandIdx,setEditMandIdx]=useState<number|null>(null);
  const [editMandVal,setEditMandVal]=useState("");
  const commitMand=(idx:number)=>{
    const v=editMandVal.trim();
    if(v)setMandatory(prev=>prev.map((s,i)=>i===idx?v:s));
    setEditMandIdx(null);
  };

  const [cardDefs,setCardDefs]=useState([
    {id:"l2",title:"2nd Language",options:["Hindi","Telugu"]},
    {id:"l3",title:"3rd Language",options:["Hindi","Telugu","French"]},
    {id:"sp",title:"Sports",options:["Football","Cricket","Basketball","Badminton"]},
    {id:"ar",title:"Arts",options:["Music","Dance","Instruments","FM Radio","NGC Club"]},
  ]);
  const updateCard=(id:string,def:CardDef)=>setCardDefs(prev=>prev.map(c=>c.id===id?{...c,...def}:c));
  const l2Card=cardDefs.find(c=>c.id==="l2")!;
  const l3Card=cardDefs.find(c=>c.id==="l3")!;
  const spCard=cardDefs.find(c=>c.id==="sp")!;
  const arCard=cardDefs.find(c=>c.id==="ar")!;
  const [aiSug,setAiSug]=useState<AISuggestion|null>(null);const[aiLoading,setAiLoading]=useState(false);
  const [editStudent,setEditStudent]=useState<MockStudent|null>(null);
  const [editClass,setEditClass]=useState<MockClass|null>(null);

  useEffect(()=>{
    if(autoOpenedForEnrolledRef.current||classListLoading||classList.length===0)return;
    if(!enrolled.admissionNo&&!enrolled.name)return;

    const norm=(value:string)=>String(value||"").trim().toLowerCase();
    const admission=norm(enrolled.admissionNo);
    const roll=norm(enrolled.rollNo);
    const name=norm(enrolled.name);

    const classCandidates=enrolled.className
      ?classList.filter((cl)=>norm(cl.label)===norm(enrolled.className))
      :classList;

    for(const cls of classCandidates){
      for(const sec of cls.sections){
        const matched=sec.students.find((st)=>{
          const admNo=norm(st.admNo);
          const rollNo=norm(st.rollNo);
          const studentName=norm(st.name);
          if(admission&&admNo===admission)return true;
          if(roll&&rollNo===roll)return true;
          return !!name&&studentName===name;
        });
        if(matched){
          setEditClass(cls);
          setEditStudent(matched);
          autoOpenedForEnrolledRef.current=true;
          return;
        }
      }
    }
  },[classListLoading,classList,enrolled]);

  const enrolledIdx=classList.findIndex(c=>c.label===enrolled.className);

  const fetchAI=useCallback(async(cn:string,sec:string)=>{
    if(!cn||!sec)return;setAiLoading(true);setAiSug(null);
    try{const r=await fetch("/api/ai-subject-suggest",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({className:cn,section:sec})});if(r.ok)setAiSug(await r.json());}
    catch{}finally{setAiLoading(false);}
  },[]);

  useEffect(()=>{if(enrolled.className&&enrolled.sectionName)fetchAI(enrolled.className,enrolled.sectionName);},[enrolled.className,enrolled.sectionName,fetchAI]);

  // Derive sports/arts/clubs counts from loaded classList (updates reactively after each save)
  const allStudents=classList.flatMap(cl=>cl.sections.flatMap(sec=>sec.students));
  const countSubject=(name:string)=>allStudents.filter(st=>(st.optionalSubjects??[st.sport,st.art,st.lang2,st.lang3].filter(Boolean)).some(s=>s.toLowerCase()===name.toLowerCase())).length;
  const totalAssigned=allStudents.length||1; // avoid divide-by-zero
  const mkRow=(name:string,color:string)=>{const count=countSubject(name);return{name,count,color,fill:Math.round((count/totalAssigned)*100)};};

  const SPORTS_ROW=[
    mkRow("Football","#f05a28"),mkRow("Cricket","#12a670"),
    mkRow("Badminton","#d94f7e"),mkRow("Basketball","#7c4df5"),
  ];
  const ARTS_ROW=[
    mkRow("Music","#4c6ef5"),mkRow("Dance","#e8890c"),mkRow("Instruments","#0ea0c0"),
  ];
  const CLUBS_ROW=[mkRow("NGC Club","#b5376e"),mkRow("FM Radio","#2aab72")];

  return (
    <div className={s.root}>
      {/* Header */}
      <div className={s.pageHeader}>
        <div className={s.breadcrumb}>
          <span>Dashboard</span>
          <svg className={s.breadSep} viewBox="0 0 11 11" fill="none"><path d="M4 2.5L7.5 5.5L4 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span>Student Information</span>
          <svg className={s.breadSep} viewBox="0 0 11 11" fill="none"><path d="M4 2.5L7.5 5.5L4 8.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span>Multi Subject Assignment</span>
        </div>
        <div className={s.titleRow}>
          <div>
            <h1 className={s.pageTitle}>Multi Subject <em>Assignment</em></h1>
            <p className={s.pageSubtitle}>One-time setup per student &mdash; locked until a change is requested</p>
          </div>
          <div className={s.kpiBlock}>
            {([
              {key:"enrolled" as const, label:"ENROLLED", color:"var(--ink)"},
              {key:"assigned" as const, label:"ASSIGNED", color:"var(--green)"},
              {key:"partial"  as const, label:"PARTIAL",  color:"var(--amber)"},
              {key:"pending"  as const, label:"PENDING",  color:"var(--red)"},
            ]).map(c=>(
              <div key={c.label} className={s.kpiCell}>
                <span className={s.kpiNum} style={{color:c.color}}>
                  {kpi!=null?kpi[c.key]:<span className={s.kpiSkeleton}/>}
                </span>
                <span className={s.kpiDot} style={{background:c.color}}/>
                <span className={s.kpiLabel}>{c.label}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={s.activityTicker}>
          {[{label:"Sports",icon:<TrophyIcon/>,items:SPORTS_ROW},{label:"Arts",icon:<PaletteIcon/>,items:ARTS_ROW},{label:"Clubs",icon:<UsersIcon/>,items:CLUBS_ROW}].map(row=>(
            <div key={row.label} className={s.tickerRow}>
              <span className={s.tickerLabel}>{row.icon} {row.label}</span>
              {row.items.map(item=>(
                <div key={item.name} className={s.tickerItem}>
                  <div className={s.miniBar}><div className={s.miniBarFill} style={{width:`${item.fill}%`,background:item.color}}/></div>
                  <span className={s.tickerName}>{item.name}</span>
                  <span className={s.tickerCount} style={{color:item.color}}>{item.count}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className={s.pageBody}>
        {/* Action Nav */}
        <div className={s.actionNav}>
          {([{id:"assign" as Tab,step:"01",label:"Assign subjects",icon:<PlusIcon/>},{id:"filter" as Tab,step:"02",label:"Smart filter",icon:<FunnelIcon/>},{id:"browse" as Tab,step:"03",label:"Browse & edit",icon:<DocIcon/>}]).map(t=>(
            <button key={t.id} className={`${s.navTab} ${activeTab===t.id?s.navTabActive:""}`}
              onClick={()=>{setActiveTab(t.id);if(t.id==="filter")setFilterOpen(true);scrollToTab(t.id);}}>
              <span className={s.navTabStep}>{t.step}</span>{t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Section 01 */}
        <div className={s.assignCard} ref={assignSecRef}>
          <div className={s.assignCardTop}>
            <div>
              <div className={s.assignCardTitle}>Assign subjects to enrolled student</div>
              <div className={s.assignCardSub}>Details auto-populate from enrollment. Pick optional subjects — AI suggests based on class &amp; peer patterns.</div>
            </div>
            {enrolled.name&&<span className={s.enrollChip}><LinkIcon/> From enrollment: {enrolled.name}</span>}
          </div>
          <div className={s.roGrid}>
            {[{label:"Student Name",value:enrolled.name||"—",mono:false},{label:"Admission No.",value:enrolled.admissionNo||"—",mono:true},{label:"Roll No.",value:enrolled.rollNo||"—",mono:true},{label:"Class",value:enrolled.className||"—",mono:false},{label:"Section",value:enrolled.sectionName||"—",mono:false},{label:"Academic Year",value:enrolled.academicYear||"2025-26",mono:false}].map(f=>(
              <div key={f.label} className={s.roField}><label>{f.label}</label><input readOnly value={f.value} className={`${s.roInput} ${f.mono?s.roInputMono:""}`}/></div>
            ))}
          </div>
          <AIBanner suggestion={aiSug} loading={aiLoading} className={enrolled.className||"Grade 8"} section={enrolled.sectionName||"A"} onApply={sg=>{setLang2(sg.lang2);setLang3(sg.lang3);setSports([sg.sport]);setArts([sg.art]);}}/>
          <div className={s.modulesCol}>
            <div className={s.mandatoryCard}>
              <div className={s.moduleHeader}>
                <span className={s.moduleTitle}><LockIcon/> Mandatory subjects <span className={s.moduleTitleSub}>(auto-checked, locked)</span></span>
                <span className={`${s.moduleChip} ${s.chipGreen}`}>{mandatory.length} / {mandatory.length}</span>
              </div>
              <div className={s.mandatoryGrid}>{mandatory.map((sub,idx)=>
                editMandIdx===idx
                  ?<span key={idx} className={s.lockedItem}>
                      <span className={s.checkLocked}><CheckIcon/></span>
                      <input autoFocus className={s.mandEditInput} value={editMandVal}
                        onChange={e=>setEditMandVal(e.target.value)}
                        onBlur={()=>commitMand(idx)}
                        onKeyDown={e=>{if(e.key==="Enter")commitMand(idx);if(e.key==="Escape")setEditMandIdx(null);}}
                      />
                    </span>
                  :<label key={idx} className={s.lockedItem}>
                      <span className={s.checkLocked}><CheckIcon/></span>
                      <span className={s.mandLabelWrap}>
                        {sub}
                        <button className={s.mandPencil} onClick={()=>{setEditMandIdx(idx);setEditMandVal(sub);}} title="Rename"><EditPenIcon size={11}/></button>
                      </span>
                    </label>
              )}</div>
            </div>
            <div className={s.optGrid}>
              <ModuleCard cardDef={l2Card} icon={<LangIcon/>} chipLabel="pick 1" chipClass={s.chipBlue} multi={false} value={lang2} onChange={v=>{setLang2(v as string);if(lang3===v)setLang3("");}} onCardChange={d=>updateCard("l2",d)}/>
              <ModuleCard cardDef={l3Card} icon={<LangIcon/>} chipLabel="pick 1" chipClass={s.chipBlue} multi={false} value={lang3} onChange={v=>setLang3(v as string)} onCardChange={d=>updateCard("l3",d)} disabledOptions={lang2?[lang2]:[]}/>
              <ModuleCard cardDef={spCard} icon={<TrophyIcon/>} chipLabel="1+ pick" chipClass={s.chipRed} multi={true} value={sports} onChange={v=>setSports(v as string[])} onCardChange={d=>updateCard("sp",d)}/>
              <ModuleCard cardDef={arCard} icon={<PaletteIcon/>} chipLabel="1+ pick" chipClass={s.chipPurp} multi={true} value={arts} onChange={v=>setArts(v as string[])} onCardChange={d=>updateCard("ar",d)}/>
            </div>
          </div>
          <hr className={s.previewDivider}/>
          <div className={s.saveRow}>
            <PreviewBadges lang2={lang2} lang3={lang3} sports={sports} arts={arts}/>
            <div className={s.saveButtons}>
              <button className={s.btnReset} onClick={()=>{setLang2("");setLang3("");setSports([]);setArts([]);}}>Reset</button>
              <button className={s.btnSave} onClick={()=>{if(typeof window!=="undefined")localStorage.removeItem("eskoolia_last_enrolled_student");router.push("/students/list");}}><CheckIcon/> Save &amp; assign to student</button>
            </div>
          </div>
        </div>

        {/* Section 02 Smart Filter */}
        <div className={s.filterCard} ref={filterSecRef}>
          <div className={`${s.filterTrigger} ${filterOpen?s.filterTriggerOpen:""}`} onClick={()=>setFilterOpen(v=>!v)}>
            <span className={s.stepBadge}>02</span>
            <span className={s.filterIconBox}><FunnelIcon/></span>
            <div><div className={s.filterTitle}>Smart filters</div><div className={s.filterSub}>Find students across any combination of class &middot; section &middot; language &middot; sport &middot; art.</div></div>
            <div className={s.triggerRight}>
              {filterChips.map(c=><span key={c} className={s.darkChip}>{c} <span className={s.darkChipX} onClick={e=>{e.stopPropagation();setFilterChips(fc=>fc.filter(x=>x!==c));}}>&#215;</span></span>)}
              {filterChips.length>0&&<button className={s.btnGhost} style={{fontSize:11,padding:"4px 8px"}} onClick={e=>{e.stopPropagation();setFilterChips([]);}}>Clear</button>}
              <ChevronIcon open={filterOpen}/>
            </div>
          </div>
          {filterOpen&&(
            <div className={s.filterBody}>
              <div className={s.filterGrid8}>
                <label className={s.fLbl}><span>Search</span><input className={s.filterInput} placeholder="Search students..."/></label>
                <label className={s.fLbl}><span>Class</span><select className={s.filterInput}>{["Nursery","LKG","UKG",...Array.from({length:10},(_,i)=>`Grade ${i+1}`)].map(o=><option key={o}>{o}</option>)}</select></label>
                <label className={s.fLbl}><span>Section</span><select className={s.filterInput}><option>All sections</option><option>A</option><option>B</option><option>C</option></select></label>
                <label className={s.fLbl}><span>2nd Language</span><select className={s.filterInput}><option>Any 2nd lang</option><option>Hindi</option><option>Telugu</option></select></label>
                <label className={s.fLbl}><span>3rd Language</span><select className={s.filterInput}><option>Any 3rd lang</option><option>Hindi</option><option>Telugu</option><option>French</option></select></label>
                <label className={s.fLbl}><span>Sport</span><select className={s.filterInput}><option>Any sport</option><option>Football</option><option>Cricket</option><option>Basketball</option><option>Badminton</option></select></label>
                <label className={s.fLbl}><span>Art</span><select className={s.filterInput}><option>Any art</option><option>Music</option><option>Dance</option><option>Instruments</option><option>FM Radio</option><option>NGC Club</option></select></label>
              </div>
              <div className={s.filterBottom}>
                <div style={{display:"flex",gap:6}}>{filterChips.map(c=><span key={c} className={s.darkChip}>{c} <span className={s.darkChipX} onClick={()=>setFilterChips(fc=>fc.filter(x=>x!==c))}>&#215;</span></span>)}</div>
                <div style={{display:"flex",gap:8}}><button className={s.btnGhost}>Save preset</button><button className={s.btnPrimary} onClick={()=>setFilterOpen(false)}>Apply</button></div>
              </div>
            </div>
          )}
        </div>

        {/* Section 03 Browse */}
        <div className={s.browseSection} ref={browseSecRef}>
          <div className={s.sectionHeading}>
            <span className={s.stepBadge}>03</span>
            <span className={s.sectionTitle}>Browse &amp; edit by class</span>
            <span className={s.sectionSub}>&mdash; click any class, then a section to expand.</span>
          </div>
          <div className={s.legendCard}>
            {[{tag:"MAN",color:"var(--tag-m)",label:"Mandatory"},{tag:"L2",color:"var(--tag-l2)",label:"2nd Language"},{tag:"L3",color:"var(--tag-l3)",label:"3rd Language"},{tag:"SP",color:"var(--tag-sp)",label:"Sport"},{tag:"AR",color:"var(--tag-ar)",label:"Art"}].map(item=>(
              <span key={item.tag} style={{display:"flex",alignItems:"center",gap:5}}>
                <span className={s.badgeTag} style={{background:item.color}}>{item.tag}</span>
                <span>{item.label}</span>
              </span>
            ))}
            <span className={s.legendNote}>Hover a badge for full name</span>
          </div>
          {classListLoading
            ?<div className={s.browseLoading}><span className={s.kpiSkeleton} style={{width:220,height:18,display:"inline-block"}}/><br/><br/><span style={{fontSize:12,color:"var(--ink-mute)"}}>Loading class data…</span></div>
            :classList.length===0
              ?<div className={s.browseLoading}><span style={{fontSize:12,color:"var(--ink-ghost)"}}>No classes found in the database.</span></div>
              :classList.map((cls,i)=>(
                <ClassAcc key={cls.id} cls={cls} index={i}
                  defaultOpen={i===(enrolledIdx>=0?enrolledIdx:0)}
                  onEdit={(cl,st)=>{setEditClass(cl);setEditStudent(st);}}/>
              ))
          }
        </div>
      </div>

      {/* Edit Modal */}
      {editStudent&&editClass&&<EditModal cls={editClass} student={editStudent} cardDefs={cardDefs} onCardChange={updateCard} onClose={()=>{setEditStudent(null);setEditClass(null);}} onSave={(studentId, saved)=>{
        // Refresh KPI stats
        (async()=>{
          try{
            const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
            const res=await fetch(`${API_BASE_URL}/api/v1/students/students/subject-assignment-stats/`,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
            if(res.ok)setKpi(await res.json());
          }catch{}
        })();
        // Update student row with new subject values and recompute status
        const optCount=[saved.lang2,saved.lang3,saved.sport,saved.art].filter(Boolean).length;
        const newStatus:MockStudent["status"]=optCount>=4?"done":optCount>0?"partial":"empty";
        setClassList(prev=>prev.map(cl=>({...cl,sections:cl.sections.map(sec=>({...sec,students:sec.students.map(st=>st.id===studentId?{...st,...saved,status:newStatus}:st)}))})));
      }}/>}
    </div>
  );
}
