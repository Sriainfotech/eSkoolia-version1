"use client";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import s from "./StudentMultiClassPanel.module.css";
import { API_BASE_URL } from "@/lib/api";

interface EnrolledStudent { name:string; admissionNo:string; rollNo:string; className:string; sectionName:string; academicYear:string; }
interface AISuggestion { lang2:string; lang3:string; sport:string; art:string; }
interface MockStudent { id:number; name:string; admNo:string; rollNo:string; status:"done"|"partial"|"empty"; optionalSubjects?:string[]; optionalByCategory?:Record<string,string[]>; }
interface MockSection {
  id:number;
  letter:string;
  teacher:string;
  students:MockStudent[];
  studentTotal?:number;
  studentPageSize?:number;
}
interface MockClass { id:number; label:string; sections:MockSection[]; }
interface KpiStats { enrolled:number; assigned:number; partial:number; pending:number; }
type Tab = "assign"|"filter"|"browse";

/* Subject categories now come from what the school admin configured in
   Academics ▸ Foundation ▸ Subjects (ClassSubjectEntry.subject_type), fetched
   per class via /api/v1/students/students/subject-categories/?class_id=. */
type CategoryKey = "first_language"|"second_language"|"third_language"|"sport"|"club"|"co_curricular"|"optional";
const CATEGORY_ORDER: CategoryKey[] = ["first_language","second_language","third_language","sport","club","co_curricular","optional"];
const CATEGORY_META: Record<CategoryKey, {title:string; tag:string; multi:boolean; cssVar:string}> = {
  first_language:  { title:"First Language",    tag:"L1", multi:false, cssVar:"--tag-l1" },
  second_language: { title:"Second Language",   tag:"L2", multi:false, cssVar:"--tag-l2" },
  third_language:  { title:"Third Language",    tag:"L3", multi:false, cssVar:"--tag-l3" },
  sport:           { title:"Sports",            tag:"SP", multi:true,  cssVar:"--tag-sp" },
  club:            { title:"Clubs",             tag:"CL", multi:true,  cssVar:"--tag-cl" },
  co_curricular:   { title:"Co-curricular",     tag:"CC", multi:true,  cssVar:"--tag-cc" },
  optional:        { title:"Optional Subjects", tag:"OP", multi:true,  cssVar:"--tag-op" },
};
type CategoryConfig = { mandatory:string[] } & Record<CategoryKey, string[]>;
const EMPTY_CATEGORY_CONFIG: CategoryConfig = {
  mandatory:[], first_language:[], second_language:[], third_language:[],
  sport:[], club:[], co_curricular:[], optional:[],
};

/** Fetch the subject-category catalog configured for a class (Foundation ▸ Subjects). */
function useCategoryConfig(classId:number|null) {
  const [data,setData] = useState<CategoryConfig|null>(null);
  const [loading,setLoading] = useState(false);
  useEffect(()=>{
    if(!classId){setData(null);return;}
    let cancelled=false;
    (async()=>{
      setLoading(true);
      try{
        const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
        const res=await fetch(`${API_BASE_URL}/api/v1/students/students/subject-categories/?class_id=${classId}`,{
          headers:{Authorization:`Bearer ${token}`},cache:"no-store"
        });
        if(res.ok){
          const json=await res.json();
          if(!cancelled)setData({ ...EMPTY_CATEGORY_CONFIG, ...json });
        }
      }catch{}finally{if(!cancelled)setLoading(false);}
    })();
    return()=>{cancelled=true;};
  },[classId]);
  return {catConfig:data, catLoading:loading};
}

function buildCardDefs(catConfig:CategoryConfig|null) {
  if(!catConfig) return [] as {id:CategoryKey;title:string;options:string[]}[];
  return CATEGORY_ORDER
    .filter(key=>catConfig[key]?.length)
    .map(key=>({ id:key, title:CATEGORY_META[key].title, options:catConfig[key] }));
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
function PreviewBadges({mandatoryCount,selections}:{mandatoryCount:number;selections:Record<string,string|string[]>}) {
  const activeCats = CATEGORY_ORDER.filter(k=>k in selections);
  const optCount = activeCats.reduce((acc,k)=>{
    const v = selections[k];
    return acc + (Array.isArray(v) ? v.length : (v ? 1 : 0));
  }, 0);
  const total = mandatoryCount + optCount;
  return (
    <div>
      <div className={s.previewLabel}>WILL BE ASSIGNED</div>
      <div className={s.badgeRow}>
        <SubBadge tag="MAN" value={`+${mandatoryCount}`} color="var(--tag-m)" dim />
        {activeCats.map(k=>{
          const meta = CATEGORY_META[k];
          const v = selections[k];
          if(meta.multi){
            const arr = Array.isArray(v) ? v : [];
            return arr.map(name=><SubBadge key={`${k}-${name}`} tag={meta.tag} value={name} color={`var(${meta.cssVar})`} />);
          }
          const val = typeof v === "string" ? v : "";
          return val
            ? <SubBadge key={k} tag={meta.tag} value={val} color={`var(${meta.cssVar})`} />
            : <SubBadge key={k} tag={meta.tag} value="missing" color="var(--tag-err)" err />;
        })}
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
function StudentRow({student,mandatoryCount,onEdit}:{student:MockStudent;mandatoryCount:number;onEdit:()=>void}) {
  const byCat = student.optionalByCategory ?? {};
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
        <SubBadge tag="MAN" value={`+${mandatoryCount}`} color="var(--tag-m)" dim/>
        {CATEGORY_ORDER.flatMap(k=>{
          const meta = CATEGORY_META[k];
          return (byCat[k]??[]).map(name=>
            <SubBadge key={`${k}-${name}`} tag={meta.tag} value={name} color={`var(${meta.cssVar})`}/>
          );
        })}
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
  const {catConfig}=useCategoryConfig(open?cls.id:null);
  const mandatoryCount=catConfig?.mandatory.length??0;
  const [activeSecIdx,setActiveSecIdx]=useState(0);
  const [page,setPage]=useState(1);
  // Per-section page cache: { [sectionId]: { [pageNumber]: students } }
  const [pageCache,setPageCache]=useState<Record<number,Record<number,MockStudent[]>>>({});
  const [pageLoading,setPageLoading]=useState(false);
  const sectionTotal=(sec?:MockSection)=>sec?(sec.studentTotal??sec.students.length):0;
  const allTotal=cls.sections.reduce((acc,sc)=>acc+sectionTotal(sc),0);
  // For done/pending counts, fall back to whatever students are loaded.
  const loadedAll=cls.sections.flatMap(sc=>sc.students);
  const done=loadedAll.filter(x=>x.status==="done").length;
  const pct=allTotal>0?Math.round((done/allTotal)*100):0;
  const subLabel=CLASS_SUB_LABELS[cls.label]??"Grade";
  void index;

  const activeSec=cls.sections[activeSecIdx]??cls.sections[0];
  const PAGE_SIZE=activeSec?.studentPageSize??10;
  const totalRows=sectionTotal(activeSec);
  const totalPages=Math.max(1,Math.ceil(totalRows/PAGE_SIZE));
  const safePage=Math.min(page,totalPages);
  const startIdx=(safePage-1)*PAGE_SIZE;

  // Resolve which students to render for the current page.
  const cachedPage=activeSec?pageCache[activeSec.id]?.[safePage]:undefined;
  const visibleStudents=cachedPage??(safePage===1?activeSec?.students??[]:[]);

  // Reset page when the active section changes.
  useEffect(()=>{setPage(1);},[activeSecIdx]);

  // Fetch a section page from the backend on demand.
  useEffect(()=>{
    if(!open||!activeSec)return;
    if(safePage===1)return; // page 1 is included in the tree response
    if(pageCache[activeSec.id]?.[safePage])return;
    let cancelled=false;
    (async()=>{
      try{
        setPageLoading(true);
        const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
        const url=`${API_BASE_URL}/api/v1/students/students/section-students/?class_id=${cls.id}&section_id=${activeSec.id}&page=${safePage}&page_size=${PAGE_SIZE}`;
        const res=await fetch(url,{headers:{Authorization:`Bearer ${token}`},cache:"no-store"});
        if(!res.ok)return;
        const data=await res.json();
        if(cancelled)return;
        setPageCache(prev=>({
          ...prev,
          [activeSec.id]:{...(prev[activeSec.id]||{}),[safePage]:data.students||[]},
        }));
      }catch{}finally{
        if(!cancelled)setPageLoading(false);
      }
    })();
    return()=>{cancelled=true;};
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[open,activeSec?.id,safePage,PAGE_SIZE,cls.id]);

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
          <span className={s.pill}>{allTotal} students</span>
          <span className={`${s.pill} ${s.pillGray}`}>{cls.sections.length} sections</span>
          {done>0&&<span className={`${s.pill} ${s.pillGreen}`}>{done} done</span>}
          {(allTotal-done)>0&&<span className={`${s.pill} ${s.pillAmber}`}>{allTotal-done} pending</span>}
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
                  const secCount=sectionTotal(sec);
                  const sdone=sec.students.filter(x=>x.status==="done").length;
                  const isActive=activeSecIdx===i;
                  const isComplete=secCount>0&&sdone===secCount;
                  const isPartial=secCount>0&&sdone>0&&sdone<secCount;
                  let badgeCls=s.secTabBadge;
                  if(isComplete)badgeCls=`${s.secTabBadge} ${s.secTabBadgeGreen}`;
                  else if(isPartial)badgeCls=`${s.secTabBadge} ${s.secTabBadgeAmber}`;
                  else if(isActive)badgeCls=`${s.secTabBadge} ${s.secTabBadgeActive}`;
                  return (
                    <button key={sec.id}
                      className={`${s.secTab} ${isActive?s.secTabActive:""}`}
                      onClick={e=>{e.stopPropagation();setActiveSecIdx(i);}}>
                      Section {sec.letter}
                      <span className={badgeCls}>{secCount}</span>
                    </button>
                  );
                })}
              </div>
              {/* Student table for active section */}
              {activeSec&&(
                <div className={s.tblWrap}>
                  <div className={s.tblHead}><span/><span>Student</span><span>Admission</span><span>Roll</span><span>Optional subjects</span><span/></div>
                  {pageLoading&&visibleStudents.length===0?(
                    <div style={{padding:"16px 14px",fontSize:12,color:"var(--ink-ghost)",textAlign:"center"}}>Loading…</div>
                  ):(
                    visibleStudents.map(st=><StudentRow key={st.id} student={st} mandatoryCount={mandatoryCount} onEdit={()=>onEdit(cls,st)}/>)
                  )}
                  {totalRows===0&&!pageLoading&&(
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

// ─ Category icon / disabled-options helpers (shared by EditModal + main page) ─
function iconForCategory(key:CategoryKey) {
  if(key.endsWith("language")) return <LangIcon/>;
  if(key==="sport") return <TrophyIcon/>;
  if(key==="club") return <UsersIcon/>;
  return <PaletteIcon/>;
}
function singlePickDisabledOptions(cardDefs:{id:CategoryKey}[], selections:Record<string,string|string[]>, currentId:CategoryKey) {
  return cardDefs
    .filter(cd=>!CATEGORY_META[cd.id].multi && cd.id!==currentId)
    .map(cd=>selections[cd.id])
    .filter((v):v is string=>typeof v==="string" && v.length>0);
}

// ─ EditModal ─
function EditModal({cls,student,onClose,onSave}:{cls:MockClass|null;student:MockStudent|null;onClose:()=>void;onSave:(studentId:number,byCategory:Record<string,string[]>,status:"done"|"partial"|"empty")=>void;}) {
  const {catConfig}=useCategoryConfig(cls?.id??null);
  const [cardDefs,setCardDefs]=useState<{id:CategoryKey;title:string;options:string[]}[]>([]);
  useEffect(()=>{ setCardDefs(buildCardDefs(catConfig)); },[catConfig]);
  const updateCard=(id:CategoryKey,def:CardDef)=>setCardDefs(prev=>prev.map(c=>c.id===id?{...c,title:def.title,options:def.options}:c));

  const [selections,setSelections]=useState<Record<string,string|string[]>>({});
  const [aiSug,setAiSug]=useState<AISuggestion|null>(null);
  const [aiLoading,setAiLoading]=useState(false);
  const [saving,setSaving]=useState(false);
  const [saveErr,setSaveErr]=useState("");

  const mandatory=catConfig?.mandatory??[];

  useEffect(()=>{
    if(!student||!cls)return;
    const initial:Record<string,string|string[]>={};
    for(const key of CATEGORY_ORDER){
      const meta=CATEGORY_META[key];
      const existing=student.optionalByCategory?.[key]??[];
      initial[key]=meta.multi?existing:(existing[0]??"");
    }
    setSelections(initial);
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
  },[student?.id,cls?.id]);

  useEffect(()=>{
    const h=(e:KeyboardEvent)=>{if(e.key==="Escape")onClose();};
    window.addEventListener("keydown",h);return()=>window.removeEventListener("keydown",h);
  },[onClose]);

  const applySuggestion=(sg:AISuggestion)=>{
    setSelections(prev=>{
      const next={...prev};
      if("second_language" in next) next.second_language=sg.lang2;
      if("third_language" in next) next.third_language=sg.lang3;
      if("sport" in next) next.sport=[sg.sport];
      if("co_curricular" in next) next.co_curricular=[sg.art];
      return next;
    });
  };

  const setSelection=(id:CategoryKey,v:string|string[])=>{
    setSelections(prev=>{
      const next={...prev,[id]:v};
      const meta=CATEGORY_META[id];
      if(!meta.multi && typeof v==="string" && v){
        for(const cd of cardDefs){
          if(cd.id!==id && !CATEGORY_META[cd.id].multi && next[cd.id]===v) next[cd.id]="";
        }
      }
      return next;
    });
  };

  const handleSave=async()=>{
    if(!student||!cls)return;
    setSaving(true);setSaveErr("");
    try{
      const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
      const assignments:{category:string;subject_name:string}[]=[];
      for(const key of CATEGORY_ORDER){
        const v=selections[key];
        if(Array.isArray(v)) v.forEach(name=>assignments.push({category:key,subject_name:name}));
        else if(v) assignments.push({category:key,subject_name:v});
      }
      const res=await fetch(`${API_BASE_URL}/api/v1/students/subject-assignments/upsert-optional/`,{
        method:"POST",
        headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},
        body:JSON.stringify({student_id:student.id,assignments}),
      });
      let json:{success?:boolean;message?:string}={};
      try{json=await res.json();}catch{}
      if(!res.ok){setSaveErr(json.message||`Save failed (${res.status})`);return;}
      const byCategory:Record<string,string[]>={};
      for(const key of CATEGORY_ORDER){
        const v=selections[key];
        byCategory[key]=Array.isArray(v)?v:(v?[v]:[]);
      }
      const filledCount=cardDefs.filter(cd=>{
        const v=selections[cd.id];
        return Array.isArray(v)?v.length>0:!!v;
      }).length;
      const newStatus:"done"|"partial"|"empty" =
        cardDefs.length===0||filledCount>=cardDefs.length?"done":filledCount>0?"partial":"empty";
      onSave(student.id, byCategory, newStatus);
      onClose();
    }catch(e){setSaveErr("Network error. Please try again.");}
    finally{setSaving(false);}
  };

  if(!student||!cls)return null;
  const allFilled = cardDefs.every(cd=>{
    const v=selections[cd.id];
    return Array.isArray(v) ? v.length>0 : !!v;
  });
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
          <AIBanner suggestion={aiSug} loading={aiLoading} className={cls.label} section="A" onApply={applySuggestion}/>
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
          <div className={s.optGrid}>
            {cardDefs.map(cd=>{
              const meta=CATEGORY_META[cd.id];
              const value=selections[cd.id]??(meta.multi?[]:"");
              return (
                <ModuleCard
                  key={cd.id}
                  cardDef={cd}
                  icon={iconForCategory(cd.id)}
                  chipLabel={meta.multi?"1+ pick":"pick 1"}
                  chipClass={meta.multi?s.chipRed:s.chipBlue}
                  multi={meta.multi}
                  value={value}
                  onChange={v=>setSelection(cd.id,v)}
                  onCardChange={d=>updateCard(cd.id,d)}
                  disabledOptions={singlePickDisabledOptions(cardDefs,selections,cd.id)}
                />
              );
            })}
          </div>
          <div className={s.previewCardInner}>
            <div className={s.previewCardTopRow}>
              <span className={s.previewLabel}>WILL BE ASSIGNED</span>
              {allFilled && cardDefs.length>0 && <span className={s.readyLabel}>Ready</span>}
            </div>
            <PreviewBadges mandatoryCount={mandatory.length} selections={selections}/>
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
  const refreshKpi=useCallback(async()=>{
    try{
      const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
      const res=await fetch(`${API_BASE_URL}/api/v1/students/students/subject-assignment-stats/`,{
        headers:{Authorization:`Bearer ${token}`},cache:"no-store"
      });
      if(res.ok)setKpi(await res.json());
    }catch{}
  },[]);
  useEffect(()=>{ void refreshKpi(); },[refreshKpi]);

  const [classList,setClassList]=useState<MockClass[]>([]);
  const [classListLoading,setClassListLoading]=useState(true);
  useEffect(()=>{
    (async()=>{
      try{
        const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
        const res=await fetch(`${API_BASE_URL}/api/v1/students/students/class-section-tree/?page_size=10`,{
          headers:{Authorization:`Bearer ${token}`},cache:"no-store"
        });
        if(res.ok){
          const data=await res.json();
          // Normalise pagination metadata returned by backend.
          const normalised=(Array.isArray(data)?data:[]).map((cl:any)=>({
            ...cl,
            sections:(cl.sections||[]).map((sec:any)=>({
              ...sec,
              studentTotal:typeof sec.student_total==="number"?sec.student_total:(sec.students?.length??0),
              studentPageSize:typeof sec.student_page_size==="number"?sec.student_page_size:10,
            })),
          }));
          setClassList(normalised);
        }
      }catch{}finally{setClassListLoading(false);}
    })();
  },[]);

  const [activeTab,setActiveTab]=useState<Tab>("assign");
  // Collapsed until a student arrives here via the Student Enroll ▸ Submit redirect
  // (localStorage "eskoolia_last_enrolled_student") — no point showing a half-empty
  // "Class: —" form on a cold visit to this page.
  const hasEnrolledContext=!!(enrolled.name||enrolled.admissionNo);
  const [assignOpen,setAssignOpen]=useState(false);
  useEffect(()=>{ if(hasEnrolledContext) setAssignOpen(true); },[hasEnrolledContext]);
  const [filterOpen,setFilterOpen]=useState(false);
  const assignSecRef=useRef<HTMLDivElement|null>(null);
  const filterSecRef=useRef<HTMLDivElement|null>(null);
  const browseSecRef=useRef<HTMLDivElement|null>(null);
  const scrollToTab=(id:Tab)=>{
    const el=id==="assign"?assignSecRef.current:id==="filter"?filterSecRef.current:browseSecRef.current;
    if(el)el.scrollIntoView({behavior:"smooth",block:"start"});
  };
  const [filterChips,setFilterChips]=useState<string[]>([]);
  const [selections,setSelections]=useState<Record<string,string|string[]>>({});

  const enrolledClassId=classList.find(c=>c.label===enrolled.className)?.id ?? null;
  const {catConfig}=useCategoryConfig(enrolledClassId);
  const mandatory=catConfig?.mandatory??[];
  const [cardDefs,setCardDefs]=useState<{id:CategoryKey;title:string;options:string[]}[]>([]);
  useEffect(()=>{ setCardDefs(buildCardDefs(catConfig)); },[catConfig]);
  const updateCard=(id:CategoryKey,def:CardDef)=>setCardDefs(prev=>prev.map(c=>c.id===id?{...c,title:def.title,options:def.options}:c));
  const setSelection=(id:CategoryKey,v:string|string[])=>{
    setSelections(prev=>{
      const next={...prev,[id]:v};
      if(!CATEGORY_META[id].multi && typeof v==="string" && v){
        for(const cd of cardDefs){
          if(cd.id!==id && !CATEGORY_META[cd.id].multi && next[cd.id]===v) next[cd.id]="";
        }
      }
      return next;
    });
  };
  const resetSelections=()=>setSelections({});
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

  const allStudents=classList.flatMap(cl=>cl.sections.flatMap(sec=>sec.students));

  // School-wide activity ticker: every sport/club/co_curricular/optional subject configured in
  // Academics ▸ Foundation ▸ Subjects, with its real assigned-student count (0 if none yet).
  // Fetched separately (not derived from the paginated classList) so newly-added subjects show
  // up immediately and counts aren't limited to whichever students happen to be loaded.
  const TICKER_CATEGORIES:CategoryKey[]=["sport","club","co_curricular","optional"];
  const TICKER_PALETTE=["#f05a28","#12a670","#d94f7e","#7c4df5","#4c6ef5","#e8890c","#0ea0c0","#b5376e"];
  const [tickerData,setTickerData]=useState<Record<string,{name:string;count:number}[]>|null>(null);
  const refreshTicker=useCallback(async()=>{
    try{
      const token=typeof window!=="undefined"?localStorage.getItem("school_erp_access_token")??"":"";
      const res=await fetch(`${API_BASE_URL}/api/v1/students/students/subject-categories-summary/`,{
        headers:{Authorization:`Bearer ${token}`},cache:"no-store"
      });
      if(res.ok)setTickerData(await res.json());
    }catch{}
  },[]);
  useEffect(()=>{ void refreshTicker(); },[refreshTicker]);
  const totalEnrolled=kpi?.enrolled||1; // avoid divide-by-zero
  const tickerRows=TICKER_CATEGORIES.map(key=>{
    const rows=tickerData?.[key]??[];
    const items=rows.map((it,i)=>({
      name:it.name, count:it.count,
      color:TICKER_PALETTE[i%TICKER_PALETTE.length],
      fill:Math.round((it.count/totalEnrolled)*100),
    }));
    return {label:CATEGORY_META[key].title, icon:iconForCategory(key), items};
  }).filter(row=>row.items.length>0);

  // Subject names configured per category, for the (display-only) Smart Filter dropdowns
  const filterOptionsFor=(key:CategoryKey)=>{
    if(tickerData && key in tickerData) return tickerData[key].map(it=>it.name);
    return Array.from(new Set(allStudents.flatMap(st=>st.optionalByCategory?.[key]??[])));
  };

  return (
    <div className={s.root}>
      <div className={s.pageCard}>
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
            <h1 className={s.pageTitle} style={{ margin: 0, fontFamily: 'var(--font-playfair), Georgia, "Times New Roman", serif', fontSize: '32px', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.15, color: '#0f172a' }}>Multi Subject <em style={{ fontFamily: 'var(--font-playfair), Georgia, "Times New Roman", serif', fontStyle: 'italic', fontSize: '32px', fontWeight: 400, color: '#6c3ce1' }}>Assignment</em></h1>
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
          {tickerRows.map(row=>(
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
              onClick={()=>{setActiveTab(t.id);if(t.id==="filter")setFilterOpen(true);if(t.id==="assign")setAssignOpen(true);scrollToTab(t.id);}}>
              <span className={s.navTabStep}>{t.step}</span>{t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Section 01 */}
        <div className={s.assignCard} ref={assignSecRef}>
          <div className={s.assignCardTop} style={{cursor:"pointer"}} onClick={()=>setAssignOpen(v=>!v)}>
            <div>
              <div className={s.assignCardTitle}>Assign subjects to enrolled student</div>
              <div className={s.assignCardSub}>
                {hasEnrolledContext
                  ?<>Details auto-populate from enrollment. Pick optional subjects — AI suggests based on class &amp; peer patterns.</>
                  :<>Opens automatically when a student is redirected here from Student Enroll &middot; Submit.</>}
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {enrolled.name&&<span className={s.enrollChip}><LinkIcon/> From enrollment: {enrolled.name}</span>}
              <ChevronIcon open={assignOpen}/>
            </div>
          </div>
          {assignOpen&&<>
          <div className={s.roGrid}>
            {[{label:"Student Name",value:enrolled.name||"—",mono:false},{label:"Admission No.",value:enrolled.admissionNo||"—",mono:true},{label:"Roll No.",value:enrolled.rollNo||"—",mono:true},{label:"Class",value:enrolled.className||"—",mono:false},{label:"Section",value:enrolled.sectionName||"—",mono:false},{label:"Academic Year",value:enrolled.academicYear||"2026-27",mono:false}].map(f=>(
              <div key={f.label} className={s.roField}><label>{f.label}</label><input readOnly value={f.value} className={`${s.roInput} ${f.mono?s.roInputMono:""}`}/></div>
            ))}
          </div>
          <AIBanner suggestion={aiSug} loading={aiLoading} className={enrolled.className||"Grade 8"} section={enrolled.sectionName||"A"} onApply={sg=>{
            setSelections(prev=>{
              const next={...prev};
              if("second_language" in next) next.second_language=sg.lang2;
              if("third_language" in next) next.third_language=sg.lang3;
              if("sport" in next) next.sport=[sg.sport];
              if("co_curricular" in next) next.co_curricular=[sg.art];
              return next;
            });
          }}/>
          <div className={s.modulesCol}>
            <div className={s.mandatoryCard}>
              <div className={s.moduleHeader}>
                <span className={s.moduleTitle}><LockIcon/> Mandatory subjects <span className={s.moduleTitleSub}>(auto-checked, locked)</span></span>
                <span className={`${s.moduleChip} ${s.chipGreen}`}>{mandatory.length} / {mandatory.length}</span>
              </div>
              <div className={s.mandatoryGrid}>{mandatory.map((sub,idx)=>
                <label key={idx} className={s.lockedItem}>
                  <span className={s.checkLocked}><CheckIcon/></span>
                  {sub}
                </label>
              )}</div>
            </div>
            <div className={s.optGrid}>
              {cardDefs.map(cd=>{
                const meta=CATEGORY_META[cd.id];
                const value=selections[cd.id]??(meta.multi?[]:"");
                return (
                  <ModuleCard
                    key={cd.id}
                    cardDef={cd}
                    icon={iconForCategory(cd.id)}
                    chipLabel={meta.multi?"1+ pick":"pick 1"}
                    chipClass={meta.multi?s.chipRed:s.chipBlue}
                    multi={meta.multi}
                    value={value}
                    onChange={v=>setSelection(cd.id,v)}
                    onCardChange={d=>updateCard(cd.id,d)}
                    disabledOptions={singlePickDisabledOptions(cardDefs,selections,cd.id)}
                  />
                );
              })}
            </div>
          </div>
          <hr className={s.previewDivider}/>
          <div className={s.saveRow}>
            <PreviewBadges mandatoryCount={mandatory.length} selections={selections}/>
            <div className={s.saveButtons}>
              <button className={s.btnReset} onClick={resetSelections}>Reset</button>
              <button className={s.btnSave} onClick={()=>{if(typeof window!=="undefined")localStorage.removeItem("eskoolia_last_enrolled_student");router.push("/students/list");}}><CheckIcon/> Save &amp; assign to student</button>
            </div>
          </div>
          </>}
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
                {(["first_language","second_language","third_language","sport","club","co_curricular","optional"] as CategoryKey[]).map(key=>(
                  <label key={key} className={s.fLbl}><span>{CATEGORY_META[key].title}</span>
                    <select className={s.filterInput}>
                      <option>{`Any ${CATEGORY_META[key].title.toLowerCase()}`}</option>
                      {filterOptionsFor(key).map(name=><option key={name}>{name}</option>)}
                    </select>
                  </label>
                ))}
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
            {[{tag:"MAN",color:"var(--tag-m)",label:"Mandatory"},...CATEGORY_ORDER.map(key=>({tag:CATEGORY_META[key].tag,color:`var(${CATEGORY_META[key].cssVar})`,label:CATEGORY_META[key].title}))].map(item=>(
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
      {editStudent&&editClass&&<EditModal cls={editClass} student={editStudent} onClose={()=>{setEditStudent(null);setEditClass(null);}} onSave={(studentId, byCategory, newStatus)=>{
        void refreshKpi();
        void refreshTicker();
        // Update student row with new subject values and recompute status
        const optionalSubjects=Object.values(byCategory).flat();
        setClassList(prev=>prev.map(cl=>({...cl,sections:cl.sections.map(sec=>({...sec,students:sec.students.map(st=>st.id===studentId?{...st,optionalByCategory:byCategory,optionalSubjects,status:newStatus}:st)}))})));
      }}/>}
      </div>{/* pageCard */}
    </div>
  );
}
