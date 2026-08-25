"use client";

import { useEffect, useMemo, useState } from "react";
import {
  BookOpen, Check, CheckCircle2, ChevronDown, ChevronRight, ClipboardList,
  FileText, LayoutGrid, Pencil, Table2, Trash2, User, X,
} from "lucide-react";
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from "@/lib/api-auth";
import ConfirmDeleteDialog from "@/components/academics/foundation/ConfirmDeleteDialog";
import {
  createHomework,
  createLesson,
  createLessonPlan,
  createLessonTopic,
  deleteLessonPlan,
  deleteLessonTopic,
  evaluateSubmission,
  parentSyllabusPdfUrl,
  reviewLessonPlan,
  submitLessonPlan,
  updateLessonPlan,
  updateLessonTopic,
  uploadContent,
  useApprovalLog,
  useClassOverview,
  useHomeworkList,
  useHomeworkSubmissions,
  useLessonGroups,
  useLessonPlanners,
  useLessonTopics,
  useUploadedContent,
  toggleTopicDone,
  type ClassOverviewRow,
} from "@/hooks/usePlanningApi";
import type { Homework, Lesson, LessonPlanner, LessonTopicDetail, SchoolClass, Section, Subject, WorkflowStatus } from "@/types/academics";

type Tab = "overview" | "detail" | "subject" | "syllabus" | "workflow";

async function fetchList<T>(path: string): Promise<T[]> {
  const res = await apiRequestWithRefresh<{ results?: T[]; data?: T[] } | T[]>(path);
  if (Array.isArray(res)) return res;
  return res.results ?? res.data ?? [];
}

/**
 * apiRequestWithRefreshResponse always prepends the frontend's own
 * API_BASE_URL to whatever path it's given, so this must return a bare
 * path — never a second host layered on top of the first. Three shapes
 * show up in practice:
 *  - a full URL ("http://backend-host/media/...")            -> strip host
 *  - an already-rooted path ("/api/v1/..." or "/media/...")   -> keep as-is
 *  - a bare storage-relative name ("academics/uploaded-content/x.pdf" —
 *    confirmed live: UploadedContentSerializer's `upload_file` field
 *    serializes the raw FileField.name, not `.url`) -> needs the /media/
 *    prefix added, since that's the only route serve_media listens on
 *    (apps/core/media_views.py).
 */
function toApiPath(urlOrPath: string): string {
  if (/^https?:\/\//i.test(urlOrPath)) {
    try {
      const u = new URL(urlOrPath);
      return u.pathname + u.search;
    } catch { /* fall through to relative handling below */ }
  }
  const cleaned = urlOrPath.replace(/^\/+/, "");
  if (cleaned.startsWith("media/") || cleaned.startsWith("api/")) {
    return `/${cleaned}`;
  }
  return `/media/${cleaned}`;
}

async function downloadAuthed(url: string, filename: string) {
  const res = await apiRequestWithRefreshResponse(toApiPath(url), { method: "GET" });
  if (!res.ok) throw new Error("Could not download the file.");
  const blob = await res.blob();
  const objUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = objUrl; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  window.URL.revokeObjectURL(objUrl);
}

const LEVEL_LABEL: Record<string, string> = {
  pre_primary: "Pre-Primary", primary: "Primary", middle: "Middle",
  secondary: "Secondary", senior_secondary: "Senior Secondary",
};

// Deterministic soft-pastel tag per subject name, reused across All Classes / Class Detail / Subject-wise.
const SUBJECT_PALETTE = [
  { bg: "#EFF6FF", border: "#93C5FD", text: "#1D4ED8" },
  { bg: "#F0FDF4", border: "#86EFAC", text: "#15803D" },
  { bg: "#FDF2F8", border: "#F0ABFC", text: "#A21CAF" },
  { bg: "#FFF7ED", border: "#FDBA74", text: "#C2410C" },
  { bg: "#ECFDF5", border: "#6EE7B7", text: "#065F46" },
  { bg: "#EEE9FF", border: "#A78BFA", text: "#5B21B6" },
  { bg: "#FEF3C7", border: "#FCD34D", text: "#B45309" },
  { bg: "#FEE2E2", border: "#FCA5A5", text: "#B91C1C" },
];
function subjectColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return SUBJECT_PALETTE[Math.abs(h) % SUBJECT_PALETTE.length];
}
function pctColor(pct: number) {
  if (pct >= 80) return "#15803D";
  if (pct >= 60) return "#B45309";
  return "#B91C1C";
}

export default function PlanningStudioWorkspace() {
  const [tab, setTab] = useState<Tab>("overview");
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [openTarget, setOpenTarget] = useState<{ classId: number; sectionId: number } | null>(null);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const showToast = (message: string, tone: "success" | "error" = "success") => { setToast({ message, tone }); setTimeout(() => setToast(null), 3200); };

  useEffect(() => {
    void fetchList<SchoolClass>("/api/v1/core/classes/?page_size=200").then(setClasses);
    void fetchList<Subject>("/api/v1/core/subjects/?page_size=200").then(setSubjects);
  }, []);

  const sections = useMemo(() => classes.flatMap((c) => (c.sections ?? []).map((s) => ({ ...s, className: c.name }))), [classes]);

  const openClass = (classId: number, sectionId: number) => {
    setOpenTarget({ classId, sectionId });
    setTab("detail");
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--page)", padding: "20px 24px 60px" }}>
      <div className="mb-5">
        <div className="text-[11px] font-bold text-[#6F767E] tracking-[0.05em] uppercase mb-1">ACADEMICS</div>
        <h1 className="m-0 text-[28px] font-extrabold text-[#15172A]">Planning Studio</h1>
        <p className="mt-1.5 text-[13px] text-[#5B5E72]">Chapters, lessons, homework, and the syllabus — for every class, subject, and teacher.</p>
      </div>

      <div className="inline-flex gap-1 bg-[#F5F5FB] rounded-xl p-1 mb-5 flex-wrap">
        {([
          { id: "overview" as Tab, label: "All Classes", icon: LayoutGrid },
          { id: "detail" as Tab, label: "Class Detail", icon: FileText },
          { id: "subject" as Tab, label: "Subject-wise", icon: BookOpen },
          { id: "syllabus" as Tab, label: "Parent Syllabus", icon: ClipboardList },
          { id: "workflow" as Tab, label: "Workflow", icon: CheckCircle2 },
        ]).map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setTab(id)} className={["flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-[13px] font-semibold transition-all", tab === id ? "bg-white text-[#4F35CC] shadow-sm" : "text-[#5B5E72] hover:bg-white/60"].join(" ")}>
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === "overview" && <AllClassesTab onOpenClass={openClass} />}
      {tab === "detail" && (
        <ClassDetailTab
          classes={classes} sections={sections} subjects={subjects}
          openTarget={openTarget} onConsumedOpenTarget={() => setOpenTarget(null)}
          showToast={showToast}
        />
      )}
      {tab === "subject" && <SubjectWiseTab classes={classes} subjects={subjects} />}
      {tab === "syllabus" && <ParentSyllabusTab classes={classes} subjects={subjects} showToast={showToast} />}
      {tab === "workflow" && <WorkflowTab showToast={showToast} />}

      {toast && (
        <div className={["fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold shadow-2xl max-w-sm", toast.tone === "success" ? "bg-[#15172A] text-white" : "bg-[#E0463A] text-white"].join(" ")}>
          <span>{toast.tone === "success" ? "✓" : "✕"}</span><span>{toast.message}</span>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// All Classes — real per-subject coverage, clickable, Cards + Matrix
// ─────────────────────────────────────────────────────────────────────────────

function ProgressRing({ pct, size = 46 }: { pct: number; size?: number }) {
  const stroke = 4;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const color = pctColor(pct);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="flex-shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E8ECF5" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeDasharray={c} strokeDashoffset={c - (pct / 100) * c} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" textAnchor="middle" dominantBaseline="middle" fontSize={size * 0.28} fontWeight={800} fill={color}>{pct}%</text>
    </svg>
  );
}

function AllClassesTab({ onOpenClass }: { onOpenClass: (classId: number, sectionId: number) => void }) {
  const { rows, loading } = useClassOverview();
  const [view, setView] = useState<"cards" | "matrix">("cards");

  const byLevel = useMemo(() => {
    const map = new Map<string, ClassOverviewRow[]>();
    for (const r of rows) {
      const key = LEVEL_LABEL[r.level ?? ""] ?? "Other";
      map.set(key, [...(map.get(key) ?? []), r]);
    }
    return map;
  }, [rows]);

  if (loading) return <p className="text-[12px] text-[#9EA2C4]">Loading…</p>;
  if (rows.length === 0) return <div className="text-center py-24 text-[#9EA2C4] text-[13px]">No sections found yet — set up classes and sections in Foundation first.</div>;

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <span className="text-[11px] font-bold text-[#5B5E72] uppercase tracking-wide">View:</span>
        <button onClick={() => setView("cards")} className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold", view === "cards" ? "bg-[#6D4AFF] text-white" : "bg-[#F5F5FB] text-[#5B5E72]"].join(" ")}><LayoutGrid size={13} /> Cards</button>
        <button onClick={() => setView("matrix")} className={["flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold", view === "matrix" ? "bg-[#6D4AFF] text-white" : "bg-[#F5F5FB] text-[#5B5E72]"].join(" ")}><Table2 size={13} /> Matrix</button>
      </div>

      {[...byLevel.entries()].map(([level, levelRows]) => {
        const avg = Math.round(levelRows.reduce((s, r) => s + r.overall_pct, 0) / levelRows.length);
        return (
          <div key={level} className="mb-7">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-[#F59E0B]" />
              <b className="text-[13px] text-[#B45309]">{level}</b>
              <span className="text-[11px] text-[#9EA2C4]">{levelRows.length} sections</span>
              <span className="ml-auto text-[11px] font-bold" style={{ color: pctColor(avg) }}>Avg {avg}%</span>
            </div>
            {view === "cards" ? (
              <div className="grid gap-3.5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
                {levelRows.map((row) => <ClassCard key={row.section_id} row={row} onOpen={onOpenClass} />)}
              </div>
            ) : (
              <MatrixTable rows={levelRows} onOpen={onOpenClass} />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClassCard({ row, onOpen }: { row: ClassOverviewRow; onOpen: (c: number, s: number) => void }) {
  return (
    <button
      onClick={() => onOpen(row.class_id, row.section_id)}
      className="text-left rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4 hover:shadow-lg hover:border-[#6D4AFF] transition-all group"
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <div className="font-bold text-[14px] text-[#15172A]">{row.class_name} / {row.section_name}</div>
          {row.teacher_name ? (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="w-5 h-5 rounded-full bg-[#6D4AFF] text-white text-[9px] font-bold flex items-center justify-center">{row.teacher_name.split(" ").map((w) => w[0]).slice(0, 2).join("")}</span>
              <span className="text-[11px] text-[#5B5E72]">{row.teacher_name}</span>
            </div>
          ) : <div className="text-[11px] text-[#9EA2C4] italic mt-1 flex items-center gap-1"><User size={11} /> No class teacher assigned</div>}
        </div>
        <ProgressRing pct={row.overall_pct} />
      </div>
      <div className="space-y-1.5 mb-2">
        {row.subjects.slice(0, 4).map((s) => (
          <div key={s.subject_id}>
            <div className="flex items-center justify-between text-[11px] mb-0.5">
              <span className="text-[#5B5E72]">{s.subject_name}</span>
              <span className="font-bold" style={{ color: pctColor(s.pct) }}>{s.pct}%</span>
            </div>
            <div className="h-1 rounded-full bg-[#E8ECF5] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: pctColor(s.pct) }} /></div>
          </div>
        ))}
        {row.subjects.length === 0 && <div className="text-[11px] text-[#9EA2C4] italic">No chapters planned yet</div>}
        {row.subjects.length > 4 && <div className="text-[10.5px] text-[#9EA2C4]">+{row.subjects.length - 4} more subjects</div>}
      </div>
      <div className="flex items-center justify-between pt-2.5 border-t border-[#E8ECF5] mt-2">
        <span className="text-[11px] text-[#5B5E72]">{row.lessons_count} Lessons · {row.hw_due_count} HW Due</span>
        <span className="text-[12px] font-bold text-[#6D4AFF] group-hover:translate-x-0.5 transition-transform">Open →</span>
      </div>
    </button>
  );
}

function MatrixTable({ rows, onOpen }: { rows: ClassOverviewRow[]; onOpen: (c: number, s: number) => void }) {
  const subjectNames = useMemo(() => {
    const seen = new Map<number, string>();
    rows.forEach((r) => r.subjects.forEach((s) => seen.set(s.subject_id, s.subject_name)));
    return [...seen.entries()];
  }, [rows]);

  return (
    <div className="overflow-x-auto rounded-xl border border-[#DBE4F0] bg-white shadow-sm">
      <table className="w-full border-collapse min-w-[720px]">
        <thead>
          <tr className="text-[10.5px] text-[#9EA2C4] uppercase tracking-wide text-left">
            <th className="py-2.5 px-3">Class / Section</th>
            <th className="py-2.5 px-3">Overall</th>
            {subjectNames.map(([id, name]) => <th key={id} className="py-2.5 px-3 truncate max-w-[90px]">{name.slice(0, 9)}</th>)}
            <th className="py-2.5 px-3">HW Due</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.section_id} onClick={() => onOpen(row.class_id, row.section_id)} className="border-t border-[#F5F5FB] text-[13px] cursor-pointer hover:bg-[#F5F5FB]">
              <td className="py-2 px-3 font-semibold text-[#15172A]">{row.class_name} / {row.section_name}</td>
              <td className="py-2 px-3"><Pill pct={row.overall_pct} /></td>
              {subjectNames.map(([id]) => {
                const s = row.subjects.find((x) => x.subject_id === id);
                return <td key={id} className="py-2 px-3">{s ? <Pill pct={s.pct} /> : <span className="text-[#DBE4F0]">—</span>}</td>;
              })}
              <td className="py-2 px-3">{row.hw_due_count > 0 ? <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-[#FEF3C7] text-[#B45309]">{row.hw_due_count}</span> : <span className="text-[#DBE4F0]">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Pill({ pct }: { pct: number }) {
  const color = pctColor(pct);
  return <span className="text-[11px] font-bold px-2 py-0.5 rounded-full" style={{ background: `${color}1A`, color }}>{pct}%</span>;
}

// ─────────────────────────────────────────────────────────────────────────────
// Class Detail — subject accordion, matching the prototype's left-nav layout
// ─────────────────────────────────────────────────────────────────────────────

interface SubjectAccordionData { chapters: Lesson[]; done: number; total: number }

function ClassDetailTab({
  classes, sections, subjects, openTarget, onConsumedOpenTarget, showToast,
}: {
  classes: SchoolClass[];
  sections: (Section & { className: string })[];
  subjects: Subject[];
  openTarget: { classId: number; sectionId: number } | null;
  onConsumedOpenTarget: () => void;
  showToast: (m: string, t?: "success" | "error") => void;
}) {
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [sameSyllabus, setSameSyllabus] = useState(false);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedLesson, setSelectedLesson] = useState<Lesson | null>(null);

  useEffect(() => {
    if (openTarget) {
      setClassId(openTarget.classId);
      setSectionId(openTarget.sectionId);
      onConsumedOpenTarget();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openTarget]);

  const { groups, loading, refetch } = useLessonGroups(classId, sameSyllabus ? null : sectionId, null);

  const bySubject = useMemo(() => {
    const map = new Map<number, SubjectAccordionData>();
    for (const g of groups) {
      const entry = map.get(g.subject_id) ?? { chapters: [], done: 0, total: 0 };
      entry.chapters.push(...g.items);
      map.set(g.subject_id, entry);
    }
    for (const entry of map.values()) {
      entry.done = entry.chapters.reduce((s, c) => s + (c.topics_done ?? 0), 0);
      entry.total = entry.chapters.reduce((s, c) => s + (c.topics_total ?? 0), 0);
    }
    return map;
  }, [groups]);

  const toggle = (id: number) => setExpanded((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const addChapter = async (subjectId: number, title: string) => {
    if (!classId || !title.trim()) return;
    try {
      await createLesson({ class_id: classId, section_id: sameSyllabus ? null : sectionId, subject_id: subjectId, lesson_title: title.trim() });
      void refetch();
      showToast("Chapter added.");
    } catch { showToast("Could not add chapter.", "error"); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <select value={classId ?? ""} onChange={(e) => { setClassId(e.target.value ? +e.target.value : null); setSectionId(null); setSelectedLesson(null); }} className="input max-w-[180px]">
          <option value="">Class…</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={sectionId ?? ""} disabled={sameSyllabus} onChange={(e) => setSectionId(e.target.value ? +e.target.value : null)} className="input max-w-[160px] disabled:opacity-50">
          <option value="">All sections</option>
          {sections.filter((s) => (s.school_class as unknown as number) === classId).map((s) => <option key={s.id} value={s.id}>Sec {s.name}</option>)}
        </select>
        <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[#5B5E72] bg-[#F5F5FB] px-3 py-2 rounded-lg cursor-pointer">
          <input type="checkbox" checked={sameSyllabus} onChange={(e) => setSameSyllabus(e.target.checked)} />
          Same syllabus for all sections
        </label>
        {classId && <UploadContentButton classId={classId} sectionId={sameSyllabus ? null : sectionId} showToast={showToast} />}
      </div>

      {sameSyllabus && (
        <div className="rounded-lg bg-[#DCFCE7] text-[#15803D] text-[12px] px-3 py-2 mb-4">
          ✅ Same syllabus applies to all sections of this class — new chapters/topics here will show up for every section.
        </div>
      )}

      {!classId ? (
        <div className="text-center py-24 text-[#9EA2C4] text-[13px]">Pick a class to view its subjects.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-[320px_1fr] gap-4 items-start">
          <div className="space-y-3">
            {loading && <p className="text-[12px] text-[#9EA2C4]">Loading…</p>}
            {subjects.map((subj) => {
              const data = bySubject.get(subj.id);
              const pct = data && data.total ? Math.round((data.done / data.total) * 100) : 0;
              const color = subjectColor(subj.name);
              const isOpen = expanded.has(subj.id);
              return (
                <div key={subj.id} className="rounded-2xl border bg-white shadow-sm overflow-hidden transition-all" style={{ borderColor: isOpen ? color.border : "#E2E8F0" }}>
                  <button onClick={() => toggle(subj.id)} className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-[#FAFBFF]">
                    <div className="w-6 flex justify-center text-[#9EA2C4]">{isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}</div>
                    <span className="text-[13px] font-bold px-2.5 py-1 rounded-lg" style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}>{subj.name}</span>
                    <span className="text-[11px] font-semibold text-[#6B7280]">{data?.chapters.length ?? 0} chapters</span>
                    <span className="ml-auto text-[12px] font-extrabold" style={{ color: pctColor(pct) }}>{pct}%</span>
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4">
                      {(data?.chapters ?? []).map((ch) => {
                        const chPct = ch.topics_total ? Math.round((ch.topics_done! / ch.topics_total) * 100) : 0;
                        const isSelected = selectedLesson?.id === ch.id;
                        return (
                          <button
                            key={ch.id}
                            onClick={() => setSelectedLesson(ch)}
                            className={["w-full text-left flex items-center justify-between px-3 py-2.5 rounded-xl mb-1.5 transition-all border", isSelected ? "bg-[#EEEAFF] border-[#A78BFA] shadow-sm" : "bg-[#F8FAFC] border-transparent hover:border-[#E2E8F0] hover:bg-white"].join(" ")}
                          >
                            <span className={["text-[13px]", isSelected ? "font-bold text-[#4F35CC]" : "font-semibold text-[#15172A]"].join(" ")}>{ch.lesson_title}</span>
                            <span className="text-[10px] font-extrabold flex-shrink-0" style={{ color: pctColor(chPct) }}>{ch.topics_total ? `${chPct}%` : "0 lessons"}</span>
                          </button>
                        );
                      })}
                      <div className="px-1 mt-2">
                        <InlineAddChapter onAdd={(title) => void addChapter(subj.id, title)} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-5">
            {selectedLesson ? (
              <>
                <ChapterTopicsAndPlans lesson={selectedLesson} sections={sections} sameSyllabus={sameSyllabus} onTeachToast={showToast} onProgressChanged={refetch} />
                <HomeworkPanel classId={classId} sectionId={sameSyllabus ? null : sectionId} subjectId={selectedLesson.subject} showToast={showToast} />
                <UploadedContentPanel classId={classId} />
              </>
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-[#E2E8F0] p-12 flex flex-col items-center justify-center text-center">
                <span className="text-[32px] mb-3">📖</span>
                <span className="text-[14px] font-bold text-[#15172A] mb-1">Select a chapter</span>
                <span className="text-[12px] text-[#6B7280]">Pick a chapter from the left to view its topics, lessons, and homework.</span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InlineAddChapter({ onAdd }: { onAdd: (title: string) => void }) {
  const [show, setShow] = useState(false);
  const [title, setTitle] = useState("");
  if (!show) return <button onClick={() => setShow(true)} className="text-[11px] font-semibold text-[#4F35CC] mt-2">＋ Add Chapter</button>;
  return (
    <div className="flex gap-1 mt-2">
      <input autoFocus className="input" placeholder="Chapter title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && title.trim()) { onAdd(title.trim()); setTitle(""); setShow(false); } }} />
      <button onClick={() => { if (title.trim()) { onAdd(title.trim()); setTitle(""); setShow(false); } }} className="px-2 rounded-lg bg-[#6D4AFF] text-white text-[12px]">Add</button>
    </div>
  );
}

function ChapterTopicsAndPlans({
  lesson, sections, sameSyllabus, onTeachToast, onProgressChanged,
}: {
  lesson: Lesson;
  sections: (Section & { className: string })[];
  sameSyllabus: boolean;
  onTeachToast: (m: string, t?: "success" | "error") => void;
  onProgressChanged: () => void;
}) {
  const { topics, loading, refetch } = useLessonTopics(lesson.id);
  const { plans, refetch: refetchPlans } = useLessonPlanners({ classId: lesson.school_class, sectionId: lesson.section, subjectId: lesson.subject });
  const lessonPlans = plans.filter((p) => p.lesson_id === lesson.id);
  const blankForm = { sub_topic: "", lesson_date: new Date().toISOString().slice(0, 10), general_objectives: "", teaching_method: "Explanation", topic_ids: [] as number[] };
  const [showForm, setShowForm] = useState(false);
  const [editingPlanId, setEditingPlanId] = useState<number | null>(null);
  const [deletingPlan, setDeletingPlan] = useState<LessonPlanner | null>(null);
  const [planBusy, setPlanBusy] = useState(false);
  const [showTopicForm, setShowTopicForm] = useState(false);
  const [newTopicTitle, setNewTopicTitle] = useState("");
  const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
  const [editingTopicTitle, setEditingTopicTitle] = useState("");
  const [deletingTopic, setDeletingTopic] = useState<LessonTopicDetail | null>(null);
  const [topicBusy, setTopicBusy] = useState(false);
  const [form, setForm] = useState(blankForm);

  const fallbackSectionId = lesson.section ?? sections.find((s) => (s.school_class as unknown as number) === lesson.school_class)?.id ?? null;

  const addTopic = async () => {
    if (!newTopicTitle.trim() || !fallbackSectionId) return;
    try {
      await createLessonTopic({
        class_id: lesson.school_class, section_id: fallbackSectionId, subject_id: lesson.subject,
        lesson_id: lesson.id, topic: [newTopicTitle.trim()],
      });
      setNewTopicTitle(""); setShowTopicForm(false);
      void refetch();
      void onProgressChanged();
      onTeachToast("Topic added.");
    } catch (e) { onTeachToast(e instanceof Error ? e.message : "Could not add topic.", "error"); }
  };

  const toggleTopic = async (id: number, done: boolean) => {
    try {
      await toggleTopicDone(id, done);
      void refetch();
      void onProgressChanged();
    } catch (e) { onTeachToast(e instanceof Error ? e.message : "Could not update topic.", "error"); }
  };

  const startEditTopic = (t: LessonTopicDetail) => {
    setEditingTopicId(t.id);
    setEditingTopicTitle(t.topic_title);
  };

  const saveTopicEdit = async () => {
    const id = editingTopicId;
    const title = editingTopicTitle.trim();
    setEditingTopicId(null);
    if (!id) return;
    const original = topics.find((t) => t.id === id);
    if (!title || original?.topic_title === title) return;
    try {
      await updateLessonTopic(id, title);
      void refetch();
      onTeachToast("Topic updated.");
    } catch (e) { onTeachToast(e instanceof Error ? e.message : "Could not update topic.", "error"); }
  };

  const confirmDeleteTopic = async () => {
    if (!deletingTopic) return;
    setTopicBusy(true);
    try {
      await deleteLessonTopic(deletingTopic.id);
      onTeachToast("Topic deleted.");
      setDeletingTopic(null);
      void refetch();
      void onProgressChanged();
    } catch (e) { onTeachToast(e instanceof Error ? e.message : "Could not delete topic.", "error"); }
    finally { setTopicBusy(false); }
  };

  const openCreatePlanForm = () => { setEditingPlanId(null); setForm(blankForm); setShowForm(true); };
  const closePlanForm = () => { setShowForm(false); setEditingPlanId(null); setForm(blankForm); };

  const startEditPlan = (p: LessonPlanner) => {
    setEditingPlanId(p.id);
    const topicIds = p.topics?.length ? p.topics.map((t) => t.topic_id) : (p.topic_id ? [p.topic_id] : []);
    setForm({
      sub_topic: p.sub_topic || "",
      lesson_date: p.lesson_date,
      general_objectives: p.general_objectives || "",
      teaching_method: p.teaching_method || "Explanation",
      topic_ids: topicIds,
    });
    setShowForm(true);
  };

  const toggleFormTopic = (topicId: number, checked: boolean) => {
    setForm((f) => ({
      ...f,
      topic_ids: checked ? [...f.topic_ids, topicId] : f.topic_ids.filter((id) => id !== topicId),
    }));
  };

  const savePlan = async () => {
    const basePayload = {
      lesson: lesson.id,
      class_id: lesson.school_class, section_id: sameSyllabus ? null : lesson.section, subject_id: lesson.subject,
      lesson_date: form.lesson_date,
      general_Objectives: form.general_objectives, teaching_method: form.teaching_method,
    };
    const payload = form.topic_ids.length > 0
      ? { ...basePayload, customize: "customize", topic: form.topic_ids, sub_topic: [], session_title: form.sub_topic }
      : { ...basePayload, sub_topic: form.sub_topic };
    try {
      if (editingPlanId) {
        await updateLessonPlan(editingPlanId, payload);
        onTeachToast("Lesson updated.");
        closePlanForm();
      } else {
        await createLessonPlan(payload);
        onTeachToast("Lesson added — add another or close.");
        setForm(blankForm);
      }
      void refetchPlans();
    } catch (e) { onTeachToast(e instanceof Error ? e.message : "Could not save lesson.", "error"); }
  };

  const confirmDeletePlan = async () => {
    if (!deletingPlan) return;
    setPlanBusy(true);
    try {
      await deleteLessonPlan(deletingPlan.id);
      onTeachToast("Lesson deleted.");
      setDeletingPlan(null);
      void refetchPlans();
    } catch (e) { onTeachToast(e instanceof Error ? e.message : "Could not delete lesson.", "error"); }
    finally { setPlanBusy(false); }
  };

  const submit = async (id: number) => {
    try {
      await submitLessonPlan(id);
      void refetchPlans();
      void refetch();
      void onProgressChanged();
      onTeachToast("Submitted for review — linked topics marked done.");
    }
    catch (e) { onTeachToast(e instanceof Error ? e.message : "Could not submit.", "error"); }
  };

  return (
    <div className="rounded-2xl border border-[#E2E8F0] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9]" style={{ background: "linear-gradient(135deg,#1E1B4B 0%,#312E81 100%)" }}>
        <div className="text-white/60 text-[11px] font-semibold uppercase tracking-widest mb-0.5">Chapter Details</div>
        <div className="flex items-center justify-between">
          <div className="font-extrabold text-[16px] text-white truncate pr-4">{lesson.lesson_title}</div>
          <div className="flex items-center gap-2 shrink-0">
            <UploadContentButton
              classId={lesson.school_class} sectionId={sameSyllabus ? null : fallbackSectionId}
              showToast={onTeachToast} defaultType="st" label="📤 Material"
              className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold transition-all hover:bg-white/20"
              style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(4px)" }}
            />
            <button
              onClick={() => (showForm ? closePlanForm() : openCreatePlanForm())}
              className="px-3 py-1.5 rounded-lg text-white text-[12px] font-semibold transition-all shadow-sm hover:shadow-md"
              style={{ background: "linear-gradient(135deg,#6D4AFF,#4F35CC)" }}
            >
              ＋ Lesson
            </button>
          </div>
        </div>
      </div>

      <div className="p-5">
        {showForm && (
          <div className="rounded-xl border border-[#E2E8F0] p-4 mb-4 grid grid-cols-2 gap-3" style={{ background: "#F8FAFC" }}>
            <div className="col-span-2 text-[12px] font-bold text-[#15172A]">{editingPlanId ? "Edit Lesson" : "New Lesson"}</div>
            <input className="input col-span-2 shadow-sm" placeholder="Session title / notes" value={form.sub_topic} onChange={(e) => setForm({ ...form, sub_topic: e.target.value })} />
            <input type="date" className="input shadow-sm" value={form.lesson_date} onChange={(e) => setForm({ ...form, lesson_date: e.target.value })} />
            <select className="input shadow-sm" value={form.teaching_method} onChange={(e) => setForm({ ...form, teaching_method: e.target.value })}>
              <option>Explanation</option><option>Demonstration</option><option>Activity-based</option><option>Discussion</option>
            </select>
            <div className="col-span-2 rounded-lg border border-[#E2E8F0] bg-white p-2">
              <div className="text-[11px] font-semibold text-[#6B7280] mb-1 px-1">
                {topics.length ? "Topics covered (select any)" : "No topics yet — add one below to link"}
              </div>
              {topics.length > 0 && (
                <div className="max-h-28 overflow-y-auto">
                  {topics.map((t) => (
                    <label key={t.id} className="flex items-center gap-2 text-[12.5px] py-1 px-1 rounded hover:bg-[#F8FAFC] cursor-pointer">
                      <input
                        type="checkbox"
                        className="w-3.5 h-3.5 rounded border-gray-300 text-[#4F35CC] focus:ring-[#4F35CC]"
                        checked={form.topic_ids.includes(t.id)}
                        onChange={(e) => toggleFormTopic(t.id, e.target.checked)}
                      />
                      <span className="text-[#15172A]">{t.topic_title}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <textarea className="input col-span-2 shadow-sm" rows={2} placeholder="Learning objectives" value={form.general_objectives} onChange={(e) => setForm({ ...form, general_objectives: e.target.value })} />
            <button onClick={() => void savePlan()} disabled={!form.sub_topic.trim()} className="px-3 py-2.5 rounded-xl text-white text-[13px] font-bold transition-all disabled:opacity-40 shadow-sm hover:shadow-md" style={{ background: "linear-gradient(135deg,#6D4AFF,#4F35CC)" }}>{editingPlanId ? "Update Lesson" : "Save & add another"}</button>
            <button onClick={closePlanForm} className="px-3 py-2.5 rounded-xl border border-[#E2E8F0] text-[13px] font-bold text-[#6B7280] hover:bg-white transition-colors">{editingPlanId ? "Cancel" : "Close"}</button>
          </div>
        )}

        <div className="space-y-2 mb-6">
          {lessonPlans.map((p: LessonPlanner) => {
            const topicNames = p.topics?.length
              ? p.topics.map((pt) => topics.find((t) => t.id === pt.topic_id)?.topic_title).filter((n): n is string => !!n)
              : (p.topic_name ? [p.topic_name] : []);
            return (
              <LessonPlanRow key={p.id} plan={p} topicNames={topicNames} onSubmit={() => void submit(p.id)} onEdit={() => startEditPlan(p)} onDelete={() => setDeletingPlan(p)} />
            );
          })}
          {lessonPlans.length === 0 && <p className="text-[12px] text-[#9EA2C4] italic py-2">No lessons planned under this chapter yet.</p>}
        </div>

        <div className="pt-4 border-t border-[#E8ECF5]">
          <div className="flex items-center justify-between mb-3">
            <div className="text-[12px] font-extrabold text-[#15172A] uppercase tracking-wide">Topics</div>
            <button onClick={() => setShowTopicForm((s) => !s)} className="px-3 py-1.5 rounded-lg bg-[#EEEAFF] text-[#4F35CC] text-[11px] font-semibold transition-colors hover:bg-[#E0D4FF]">＋ Add Topic</button>
          </div>
          {showTopicForm && (
            <div className="flex gap-2 mb-3">
              <input autoFocus className="input flex-1 shadow-sm" placeholder="Topic title" value={newTopicTitle} onChange={(e) => setNewTopicTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void addTopic()} />
              <button onClick={() => void addTopic()} className="px-4 rounded-xl text-white text-[12px] font-bold shadow-sm" style={{ background: "linear-gradient(135deg,#6D4AFF,#4F35CC)" }}>Add</button>
            </div>
          )}
          {loading ? <p className="text-[12px] text-[#9EA2C4]">Loading…</p> : (
            <div className="grid grid-cols-1 gap-1.5">
              {topics.map((t) => (
                <div key={t.id} className="flex items-center gap-3 text-[13px] py-2 px-3 rounded-xl hover:bg-[#FAFBFF] transition-colors border border-transparent hover:border-[#F1F5F9]">
                  <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-[#4F35CC] focus:ring-[#4F35CC] shrink-0" checked={t.completed_status === "Completed"} onChange={(e) => void toggleTopic(t.id, e.target.checked)} />
                  {editingTopicId === t.id ? (
                    <input
                      autoFocus
                      className="input flex-1 py-1 text-[13px]"
                      value={editingTopicTitle}
                      onChange={(e) => setEditingTopicTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void saveTopicEdit(); if (e.key === "Escape") setEditingTopicId(null); }}
                    />
                  ) : (
                    <span
                      onClick={() => void toggleTopic(t.id, t.completed_status !== "Completed")}
                      className={["flex-1 font-medium cursor-pointer", t.completed_status === "Completed" ? "line-through text-[#9EA2C4]" : "text-[#15172A]"].join(" ")}
                    >
                      {t.topic_title}
                    </span>
                  )}
                  <div className="flex items-center gap-1 shrink-0">
                    {editingTopicId === t.id ? (
                      <>
                        <button type="button" title="Save" onMouseDown={(e) => e.preventDefault()} onClick={() => void saveTopicEdit()} className="w-6 h-6 flex items-center justify-center rounded-md text-[#4F35CC] hover:bg-[#F5F4FF] transition-colors">
                          <Check size={13} />
                        </button>
                        <button type="button" title="Cancel" onMouseDown={(e) => e.preventDefault()} onClick={() => setEditingTopicId(null)} className="w-6 h-6 flex items-center justify-center rounded-md text-[#9EA2C4] hover:text-red-500 hover:bg-red-50 transition-colors">
                          <X size={13} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" title="Edit topic" onClick={() => startEditTopic(t)} className="w-6 h-6 flex items-center justify-center rounded-md text-[#9EA2C4] hover:text-[#4F35CC] hover:bg-[#F5F4FF] transition-colors">
                          <Pencil size={12} />
                        </button>
                        <button type="button" title="Delete topic" onClick={() => setDeletingTopic(t)} className="w-6 h-6 flex items-center justify-center rounded-md text-[#9EA2C4] hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={12} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && topics.length === 0 && <p className="text-[12px] text-[#9EA2C4] italic pt-1">No topics yet — you can add them to break this chapter down.</p>}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={!!deletingPlan}
        title="Delete Lesson"
        message={<>Delete <strong>&quot;{deletingPlan?.sub_topic || "this lesson"}&quot;</strong>? This cannot be undone.</>}
        loading={planBusy}
        onConfirm={() => void confirmDeletePlan()}
        onCancel={() => setDeletingPlan(null)}
      />
      <ConfirmDeleteDialog
        open={!!deletingTopic}
        title="Delete Topic"
        message={<>Delete <strong>&quot;{deletingTopic?.topic_title}&quot;</strong>? This cannot be undone.</>}
        loading={topicBusy}
        onConfirm={() => void confirmDeleteTopic()}
        onCancel={() => setDeletingTopic(null)}
      />
    </div>
  );
}

const WORKFLOW_COLORS: Record<WorkflowStatus, string> = {
  draft: "bg-[#F8FAFC] text-[#64748B] border border-[#E2E8F0]",
  submitted: "bg-[#EFF6FF] text-[#1D4ED8] border border-[#BFDBFE]",
  under_review: "bg-[#F5F3FF] text-[#6D4AFF] border border-[#DDD6FE]",
  approved: "bg-[#F0FDF4] text-[#15803D] border border-[#BBF7D0]",
  revision_requested: "bg-[#FEF2F2] text-[#B91C1C] border border-[#FECACA]",
};
const WORKFLOW_LABEL: Record<WorkflowStatus, string> = {
  draft: "Draft", submitted: "Submitted", under_review: "Under Review", approved: "Approved", revision_requested: "Revision Requested",
};

function LessonPlanRow({ plan, topicNames, onSubmit, onEdit, onDelete }: { plan: LessonPlanner; topicNames: string[]; onSubmit: () => void; onEdit: () => void; onDelete: () => void }) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-[#E8ECF5] bg-[#FAFBFF] px-4 py-3 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[14px] font-bold text-[#15172A] mb-0.5">{plan.sub_topic || "Untitled lesson"}</div>
          <div className="text-[11px] font-medium text-[#6B7280] flex items-center gap-1.5">
            <span>📅 {plan.lesson_date}</span>
            <span>·</span>
            <span>{plan.completed_status || "Planned"}</span>
            {topicNames.length > 0 && (
              <>
                <span>·</span>
                <span className="text-[#4F35CC] font-semibold">🔗 {topicNames.join(", ")}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={["text-[10px] font-extrabold px-2.5 py-1 rounded-full uppercase tracking-widest", WORKFLOW_COLORS[plan.workflow_status]].join(" ")}>{WORKFLOW_LABEL[plan.workflow_status]}</span>
          {(plan.workflow_status === "draft" || plan.workflow_status === "revision_requested") && (
            <button onClick={onSubmit} className="px-3 py-1.5 rounded-lg bg-white border border-[#DBE4F0] text-[11px] font-bold text-[#4F35CC] hover:bg-[#F5F5FB] transition-colors shadow-sm">Submit →</button>
          )}
          <div className="flex items-center gap-1 shrink-0">
            <button type="button" title="Edit lesson" onClick={onEdit} className="w-7 h-7 flex items-center justify-center rounded-md text-[#9EA2C4] hover:text-[#4F35CC] hover:bg-[#F5F4FF] transition-colors">
              <Pencil size={13} />
            </button>
            <button type="button" title="Delete lesson" onClick={onDelete} className="w-7 h-7 flex items-center justify-center rounded-md text-[#9EA2C4] hover:text-red-500 hover:bg-red-50 transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
      {plan.workflow_status === "revision_requested" && plan.review_notes && (
        <div className="text-[11.5px] text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2">
          <span className="font-bold">Revision requested:</span> {plan.review_notes}
        </div>
      )}
    </div>
  );
}

function HomeworkPanel({ classId, sectionId, subjectId, showToast }: { classId: number; sectionId: number | null; subjectId: number; showToast: (m: string, t?: "success" | "error") => void }) {
  const { homeworks, refetch } = useHomeworkList(classId, sectionId, subjectId);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: "", submission_date: new Date().toISOString().slice(0, 10), marks: 10 });
  const [openId, setOpenId] = useState<number | null>(null);

  const add = async () => {
    try {
      await createHomework({
        class_id: classId, section_id: sectionId, subject_id: subjectId,
        homework_date: new Date().toISOString().slice(0, 10),
        submission_date: form.submission_date, description: form.description, marks: form.marks,
      });
      setShowForm(false); setForm({ description: "", submission_date: new Date().toISOString().slice(0, 10), marks: 10 });
      void refetch(); showToast("Homework assigned.");
    } catch { showToast("Could not add homework.", "error"); }
  };

  return (
    <div className="rounded-2xl border border-[#E8ECF5] bg-white shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-[#F1F5F9] flex items-center justify-between" style={{ background: "#FAFBFF" }}>
        <div>
          <div className="text-[#1D4ED8] text-[11px] font-semibold uppercase tracking-widest mb-0.5">Tasks</div>
          <div className="font-extrabold text-[15px] text-[#15172A]">Homework &amp; Assignments</div>
        </div>
        <div className="flex items-center gap-2">
          <UploadContentButton
            classId={classId} sectionId={sectionId} showToast={showToast} defaultType="as" label="📤 File"
            className="px-3 py-1.5 rounded-lg border border-[#DBE4F0] text-[#5B5E72] text-[12px] font-semibold hover:bg-white transition-colors bg-[#F5F5FB]"
          />
          <button onClick={() => setShowForm((s) => !s)} className="px-3 py-1.5 rounded-lg bg-[#EEEAFF] text-[#4F35CC] text-[12px] font-semibold hover:bg-[#E0D4FF] transition-colors">＋ Assign</button>
        </div>
      </div>
      
      <div className="p-5">
        {showForm && (
          <div className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4 mb-4 grid grid-cols-2 gap-3">
            <textarea className="input col-span-2 shadow-sm" rows={2} placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div>
              <label className="block text-[11px] font-bold text-[#5B5E72] mb-1">Due Date</label>
              <input type="date" className="input shadow-sm" value={form.submission_date} onChange={(e) => setForm({ ...form, submission_date: e.target.value })} />
            </div>
            <div>
              <label className="block text-[11px] font-bold text-[#5B5E72] mb-1">Max Marks</label>
              <input type="number" className="input shadow-sm" placeholder="Max marks" value={form.marks} onChange={(e) => setForm({ ...form, marks: +e.target.value })} />
            </div>
            <button onClick={() => void add()} disabled={!form.description.trim()} className="col-span-2 px-3 py-2.5 rounded-xl text-white text-[13px] font-bold transition-all disabled:opacity-40 shadow-sm hover:shadow-md mt-1" style={{ background: "linear-gradient(135deg,#6D4AFF,#4F35CC)" }}>Save Homework</button>
          </div>
        )}
        <div className="space-y-1.5">
          {homeworks.map((hw: Homework) => (
            <div key={hw.id} className="rounded-xl border border-[#E8ECF5] overflow-hidden">
              <button onClick={() => setOpenId(openId === hw.id ? null : hw.id)} className="w-full flex items-center justify-between text-left px-4 py-3 bg-white hover:bg-[#FAFBFF] transition-colors">
                <span className="text-[13px] font-semibold text-[#15172A]">{hw.description}</span>
                <span className="text-[11px] font-medium px-2 py-0.5 rounded bg-[#FEF3C7] text-[#B45309] border border-[#FDE68A]">Due {hw.submission_date}</span>
              </button>
              {openId === hw.id && (
                <div className="border-t border-[#F5F5FB] bg-[#FAFAFA] px-2 py-1">
                  <SubmissionsList homeworkId={hw.id} maxMarks={hw.marks ?? 0} />
                </div>
              )}
            </div>
          ))}
          {homeworks.length === 0 && <p className="text-[12px] text-[#9EA2C4] italic py-1">No homework assigned for this subject yet.</p>}
        </div>
      </div>
    </div>
  );
}

function UploadContentButton({ classId, sectionId, showToast, defaultType = "sy", label = "📤 Upload", className, style }: { classId: number; sectionId: number | null; showToast: (m: string, t?: "success" | "error") => void; defaultType?: "sy" | "as" | "st" | "ot"; label?: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [contentType, setContentType] = useState<"sy" | "as" | "st" | "ot">(defaultType);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!title.trim() || !file) return;
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("content_title", title.trim());
      fd.append("content_type", contentType);
      fd.append("class_id", String(classId));
      if (sectionId) fd.append("section_id", String(sectionId));
      fd.append("upload_date", new Date().toISOString().slice(0, 10));
      fd.append("file_upload", file);
      await uploadContent(fd);
      setOpen(false); setTitle(""); setFile(null);
      showToast("File uploaded.");
    } catch {
      showToast("Could not upload the file.", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <button onClick={() => setOpen(true)} className={className || "px-3.5 py-2 rounded-lg border border-[#DBE4F0] text-[#5B5E72] text-[13px] font-semibold"} style={style}>{label}</button>
      {open && (
        <div className="fixed inset-0 bg-[#0F172A]/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-3xl w-full max-w-sm p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-[16px] font-extrabold text-[#15172A] mb-4">Upload Content</h3>
            <label className="block text-[11px] font-bold text-[#5B5E72] mb-1 ml-1">Title</label>
            <input className="input mb-3 shadow-sm" placeholder="File title" value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className="block text-[11px] font-bold text-[#5B5E72] mb-1 ml-1">Type</label>
            <select className="input mb-3 shadow-sm" value={contentType} onChange={(e) => setContentType(e.target.value as typeof contentType)}>
              <option value="sy">Syllabus</option>
              <option value="as">Assignment</option>
              <option value="st">Study Material</option>
              <option value="ot">Other</option>
            </select>
            <label className="block text-[11px] font-bold text-[#5B5E72] mb-1 ml-1">File</label>
            <input type="file" className="input mb-5 shadow-sm text-[12px]" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <div className="flex gap-2">
              <button onClick={() => setOpen(false)} className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] bg-white text-[#475569] text-[13px] font-bold hover:bg-[#F8FAFC] transition-colors">Cancel</button>
              <button disabled={saving || !title.trim() || !file} onClick={() => void submit()} className="flex-1 py-2.5 rounded-xl text-white text-[13px] font-bold disabled:opacity-50 shadow-sm transition-all hover:shadow-md" style={{ background: "linear-gradient(135deg,#6D4AFF,#4F35CC)" }}>{saving ? "Uploading…" : "Upload"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function UploadedContentPanel({ classId }: { classId: number }) {
  const { items } = useUploadedContent(classId);
  if (items.length === 0) return null;
  return (
    <div className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4">
      <div className="font-bold text-[14px] text-[#15172A] mb-3">Uploaded Content</div>
      {items.map((it) => (
        <div key={it.id} className="flex items-center justify-between text-[13px] py-1.5 border-b border-[#F5F5FB] last:border-0">
          <span className="text-[#15172A]">{it.content_title}</span>
          {it.upload_file && (
            <button
              onClick={() => {
                const filename = it.upload_file!.split("/").pop() || "download";
                void downloadAuthed(it.upload_file!, filename).catch(() => alert("Could not download the file."));
              }}
              className="text-[11px] font-semibold text-[#4F35CC] hover:underline"
            >
              Download
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

function SubmissionsList({ homeworkId, maxMarks }: { homeworkId: number; maxMarks: number }) {
  const { submissions, refetch } = useHomeworkSubmissions(homeworkId);
  return (
    <div className="pl-3 pb-2">
      {submissions.map((s) => (
        <div key={s.id} className="flex items-center justify-between text-[12px] py-1">
          <span className="text-[#5B5E72]">Student #{s.student}</span>
          <div className="flex items-center gap-2">
            <span>{s.marks ?? "—"}/{maxMarks}</span>
            {s.marks === null && (
              <button onClick={() => { const v = prompt("Marks awarded?"); if (v) void evaluateSubmission(s.id, +v).then(() => void refetch()); }} className="text-[11px] font-semibold text-[#4F35CC]">Evaluate</button>
            )}
          </div>
        </div>
      ))}
      {submissions.length === 0 && <p className="text-[11px] text-[#9EA2C4] italic">No submissions yet.</p>}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Subject-wise — real per-chapter progress + topic preview, grouped by class
// ─────────────────────────────────────────────────────────────────────────────

function SubjectWiseTab({ classes, subjects }: { classes: SchoolClass[]; subjects: Subject[] }) {
  const [subjectId, setSubjectId] = useState<number | null>(null);
  const { groups, loading } = useLessonGroups(null, null, subjectId);

  const byClass = useMemo(() => {
    const map = new Map<number, { className: string; chapters: Lesson[] }>();
    for (const g of groups) {
      const entry = map.get(g.class_id) ?? { className: g.class_name, chapters: [] };
      entry.chapters.push(...g.items);
      map.set(g.class_id, entry);
    }
    return map;
  }, [groups]);

  return (
    <div>
      <select value={subjectId ?? ""} onChange={(e) => setSubjectId(e.target.value ? +e.target.value : null)} className="input max-w-xs mb-4">
        <option value="">Select a subject…</option>
        {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
      </select>
      {!subjectId ? (
        <div className="text-center py-24 text-[#9EA2C4] text-[13px]">Pick a subject to see its rollup across every class.</div>
      ) : loading ? <p className="text-[12px] text-[#9EA2C4]">Loading…</p> : (
        <div className="space-y-4">
          {[...byClass.entries()].map(([classId, data]) => {
            const totalTopics = data.chapters.reduce((s, c) => s + (c.topics_total ?? 0), 0);
            const doneTopics = data.chapters.reduce((s, c) => s + (c.topics_done ?? 0), 0);
            const pct = totalTopics ? Math.round((doneTopics / totalTopics) * 100) : 0;
            const sectionCount = classes.find((c) => c.id === classId)?.sections?.length ?? 0;
            return (
              <div key={classId} className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="font-bold text-[15px] text-[#15172A]">{data.className}</span>
                    <span className="text-[11px] text-[#9EA2C4] ml-2">{sectionCount} section{sectionCount === 1 ? "" : "s"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[14px]" style={{ color: pctColor(pct) }}>{pct}%</span>
                    <div className="w-24 h-1.5 rounded-full bg-[#E8ECF5] overflow-hidden"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: pctColor(pct) }} /></div>
                  </div>
                </div>
                {data.chapters.map((ch) => {
                  const chPct = ch.topics_total ? Math.round((ch.topics_done! / ch.topics_total) * 100) : 0;
                  return (
                    <div key={ch.id} className="py-2 border-t border-[#F5F5FB]">
                      <div className="flex items-center justify-between">
                        <span className="text-[13px] font-semibold text-[#15172A]">{ch.lesson_title}</span>
                        <span className="text-[11px] font-bold flex-shrink-0" style={{ color: pctColor(chPct) }}>{ch.topics_done ?? 0}/{ch.topics_total ?? 0} topics</span>
                      </div>
                      {(ch.topics_preview?.length ?? 0) > 0 && <div className="text-[11px] text-[#9EA2C4] mt-0.5">{ch.topics_preview!.join(" · ")}</div>}
                      <div className="h-1 rounded-full bg-[#E8ECF5] overflow-hidden mt-1"><div className="h-full rounded-full" style={{ width: `${chPct}%`, background: pctColor(chPct) }} /></div>
                    </div>
                  );
                })}
              </div>
            );
          })}
          {byClass.size === 0 && <p className="text-[12px] text-[#9EA2C4] italic">No chapters recorded for this subject yet.</p>}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Parent Syllabus — with a real, data-driven live preview
// ─────────────────────────────────────────────────────────────────────────────

function ParentSyllabusTab({ classes, subjects, showToast }: { classes: SchoolClass[]; subjects: Subject[]; showToast: (m: string, t?: "success" | "error") => void }) {
  const [classId, setClassId] = useState<string>("all");
  const [detail, setDetail] = useState<"topics" | "chapters">("topics");
  const [generating, setGenerating] = useState(false);

  const previewClassId = classId === "all" ? null : +classId;
  const { groups, loading } = useLessonGroups(previewClassId, null, null);
  const bySubject = useMemo(() => {
    const map = new Map<number, { subjectName: string; chapters: Lesson[] }>();
    for (const g of groups) {
      const entry = map.get(g.subject_id) ?? { subjectName: g.subject_name, chapters: [] };
      entry.chapters.push(...g.items);
      map.set(g.subject_id, entry);
    }
    return map;
  }, [groups]);
  const previewSubjects = subjects.filter((s) => bySubject.has(s.id));

  const generate = async () => {
    setGenerating(true);
    try {
      await downloadAuthed(parentSyllabusPdfUrl(classId, detail), "parent_syllabus.pdf");
      showToast("Syllabus PDF downloaded.");
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Could not generate the syllabus.", "error");
    } finally { setGenerating(false); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-5">
        <div className="font-bold text-[14px] text-[#15172A] mb-1">Generate Parent Syllabus</div>
        <div className="text-[12px] text-[#9EA2C4] mb-4">Dynamic PDF built live from Planning Studio data</div>
        <label className="text-[11px] font-semibold text-[#5B5E72]">Class</label>
        <select className="input mb-3" value={classId} onChange={(e) => setClassId(e.target.value)}>
          <option value="all">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <label className="text-[11px] font-semibold text-[#5B5E72]">Detail Level</label>
        <select className="input mb-4" value={detail} onChange={(e) => setDetail(e.target.value as "topics" | "chapters")}>
          <option value="topics">Chapters + Topics</option>
          <option value="chapters">Chapters Only</option>
        </select>
        <button disabled={generating} onClick={() => void generate()} className="px-4 py-2 rounded-lg bg-[#6D4AFF] text-white text-[13px] font-semibold disabled:opacity-50">
          {generating ? "Generating…" : "🖨 Print / Download"}
        </button>
      </div>

      <div className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-5">
        <div className="font-bold text-[14px] text-[#15172A] mb-3">Live Preview</div>
        <div className="rounded-lg border border-dashed border-[#DBE4F0] bg-[#F5F5FB] p-4 max-h-[520px] overflow-y-auto">
          <div className="text-center text-[11px] text-[#9EA2C4] uppercase tracking-wide mb-1">Academic Syllabus</div>
          <div className="text-center text-[15px] font-extrabold text-[#15172A] mb-3">{classId === "all" ? "All Classes" : classes.find((c) => c.id === +classId)?.name} · Full Year</div>
          {loading && <p className="text-[12px] text-[#9EA2C4] text-center">Loading…</p>}
          {!loading && previewSubjects.length === 0 && <p className="text-[12px] text-[#9EA2C4] text-center italic py-10">No chapters recorded for this selection yet.</p>}
          {previewSubjects.map((subj) => {
            const data = bySubject.get(subj.id)!;
            const color = subjectColor(subj.name);
            return (
              <div key={subj.id} className="mb-3">
                <div className="text-[12px] font-bold px-2 py-1 rounded-md mb-1.5" style={{ background: color.bg, color: color.text, border: `1px solid ${color.border}` }}>{data.subjectName}</div>
                {data.chapters.map((ch) => (
                  <div key={ch.id} className="pl-2 mb-1.5">
                    <div className="text-[12px] font-semibold text-[#15172A]">{ch.lesson_title} <span className="text-[10px] font-normal text-[#9EA2C4]">({ch.topics_total ?? 0} topics)</span></div>
                    {detail === "topics" && (ch.topics_preview ?? []).map((t, i) => (
                      <div key={i} className="text-[11px] text-[#5B5E72] pl-2">• {t}</div>
                    ))}
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Workflow
// ─────────────────────────────────────────────────────────────────────────────

function WorkflowTab({ showToast }: { showToast: (m: string, t?: "success" | "error") => void }) {
  const [filter, setFilter] = useState<WorkflowStatus | "">("");
  const { plans, refetch } = useLessonPlanners({ workflowStatus: filter || null });
  const { entries } = useApprovalLog();
  // "All Status" means every non-draft plan (drafts aren't in review yet,
  // so they don't belong in this queue) — a specific filter is already
  // applied server-side via workflowStatus above, so `plans` needs no
  // further narrowing in that case.
  const shown = filter ? plans : plans.filter((p) => p.workflow_status !== "draft");
  const [revisionTargetId, setRevisionTargetId] = useState<number | null>(null);
  const [actingId, setActingId] = useState<number | null>(null);

  const act = async (id: number, action: WorkflowStatus, notes = "") => {
    setActingId(id);
    try {
      await reviewLessonPlan(id, action, notes);
      void refetch();
      showToast(`Plan ${action.replace("_", " ")}.`);
    } catch (e) { showToast(e instanceof Error ? e.message : "Could not update the plan.", "error"); }
    finally { setActingId(null); }
  };

  const submitRevision = async (notes: string) => {
    if (revisionTargetId === null) return;
    await act(revisionTargetId, "revision_requested", notes);
    setRevisionTargetId(null);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-start">
      <div className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="font-bold text-[14px] text-[#15172A]">Lesson Plan Submissions</div>
          <select className="input max-w-[160px]" value={filter} onChange={(e) => setFilter(e.target.value as WorkflowStatus | "")}>
            <option value="">All Status</option>
            <option value="submitted">Submitted</option>
            <option value="under_review">Under Review</option>
            <option value="approved">Approved</option>
            <option value="revision_requested">Revision Requested</option>
          </select>
        </div>
        {shown.length === 0 && (
          <div className="text-center py-10">
            <p className="text-[12px] text-[#9EA2C4]">No plans {filter ? `with status "${WORKFLOW_LABEL[filter]}"` : "pending review"} yet.</p>
            <p className="text-[11px] text-[#DBE4F0] mt-1">Plans appear here once a teacher adds a lesson under a chapter in Class Detail and submits it.</p>
          </div>
        )}
        {shown.map((p) => (
          <div key={p.id} className="rounded-lg border border-[#E8ECF5] p-3 mb-2">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-[13px] font-bold text-[#15172A]">{p.sub_topic || "Untitled lesson"}</div>
                <div className="text-[11px] text-[#9EA2C4]">{p.class_name} {p.section_name ? `– ${p.section_name}` : ""} · {p.lesson_date}</div>
              </div>
              <span className={["text-[10px] font-bold px-2 py-1 rounded-full", WORKFLOW_COLORS[p.workflow_status]].join(" ")}>{WORKFLOW_LABEL[p.workflow_status]}</span>
            </div>
            {(p.workflow_status === "submitted" || p.workflow_status === "under_review") && (
              <div className="flex gap-2 mt-2">
                {p.workflow_status === "submitted" && <button onClick={() => void act(p.id, "under_review")} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#EEEAFF] text-[#4F35CC]">🔍 Start Review</button>}
                <button onClick={() => void act(p.id, "approved")} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#DCFCE7] text-[#15803D]">✓ Approve</button>
                <button onClick={() => setRevisionTargetId(p.id)} className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#FEE2E2] text-[#B91C1C]">↩ Request Revision</button>
              </div>
            )}
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-[#DBE4F0] bg-white shadow-sm p-4 max-h-[480px] overflow-y-auto">
        <div className="font-bold text-[14px] text-[#15172A] mb-3">Audit Log</div>
        {entries.map((e) => (
          <div key={e.id} className="flex gap-2 py-2 border-b border-[#F5F5FB] text-[12px]">
            <span className="w-1.5 h-1.5 rounded-full bg-[#6D4AFF] mt-1.5 flex-shrink-0" />
            <div>
              <span className="font-semibold">{e.by_name || "System"}</span> — {WORKFLOW_LABEL[e.action]} <span className="text-[#9EA2C4]">&quot;{e.lesson_title || "lesson plan"}&quot;</span>
              <div className="text-[#9EA2C4]">{e.note} · {new Date(e.created_at).toLocaleString()}</div>
            </div>
          </div>
        ))}
        {entries.length === 0 && <p className="text-[12px] text-[#9EA2C4] italic">No activity logged yet — approvals and revisions will appear here as they happen.</p>}
      </div>
      <RevisionNotesDialog
        open={revisionTargetId !== null}
        loading={actingId === revisionTargetId}
        onSubmit={(notes) => void submitRevision(notes)}
        onCancel={() => setRevisionTargetId(null)}
      />
    </div>
  );
}

function RevisionNotesDialog({
  open, loading, onSubmit, onCancel,
}: {
  open: boolean;
  loading: boolean;
  onSubmit: (notes: string) => void;
  onCancel: () => void;
}) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (open) setNotes("");
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, loading, onCancel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={() => !loading && onCancel()} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="revision-notes-title"
        className="relative z-10 w-full max-w-[440px] rounded-2xl bg-white border border-[#E8ECEF] shadow-[0_10px_40px_rgba(0,0,0,0.18)] p-5"
      >
        <h3 id="revision-notes-title" className="text-[15px] font-bold text-[#1A1D1F] leading-tight mb-1">Request Revision</h3>
        <p className="text-[12.5px] text-[#6F767E] mb-3">Let the teacher know what needs to change before this plan can be approved.</p>
        <textarea
          autoFocus
          rows={4}
          className="input w-full shadow-sm resize-none"
          placeholder="Revision notes for the teacher…"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="px-3.5 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] font-semibold text-[#6F767E] hover:bg-[#F0F2F5] transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(notes)}
            disabled={loading || !notes.trim()}
            className="px-3.5 py-[7px] rounded-[10px] bg-[#4F35CC] text-white text-[13px] font-semibold hover:bg-[#3F2AA3] transition-colors disabled:opacity-60"
          >
            {loading ? "Submitting…" : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}
