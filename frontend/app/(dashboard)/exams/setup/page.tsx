"use client";
/**
 * Examination › Exam Setup — "per exam cycle" group. Wired to the real
 * ExamSetup backend (apps/exams/views.py::ExamSetupIndexAPIView/SearchAPIView/
 * StoreAPIView/CloneAPIView via hooks/useExamsApi.ts) — replaces the earlier
 * static mockup. Palette from lib/examTheme.ts.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, CalendarClock, Plus, X, LayoutGrid, Check, Trash2 } from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";
import {
  cloneExamSetup,
  ExamsApiError,
  searchExamSetup,
  storeExamSetup,
  useExamSetupCriteria,
} from "@/hooks/useExamsApi";

interface Component { id: string; name: string; marks: string }

function defaultComponents(max: string): Component[] {
  const total = Number(max) || 0;
  const written = Math.round(total * 0.75);
  return [
    { id: "written", name: "Written", marks: String(written) },
    { id: "practical", name: "Practical", marks: String(total - written) },
  ];
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.ink2 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.purple, display: "inline-block" }} />
      {children}
    </div>
  );
}

const selectSx: React.CSSProperties = {
  width: "100%", height: 38, borderRadius: 8, border: `1px solid ${T.borderStrong}`,
  padding: "0 10px", fontSize: 13, color: T.ink1, background: "#fff", outline: "none",
};

export default function ExamSetupPage() {
  const { data: criteria, loading: criteriaLoading } = useExamSetupCriteria();

  const [step, setStep] = useState<1 | 2>(1);
  const [examTypeId, setExamTypeId] = useState<number | null>(null);
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  const [maxMarks, setMaxMarks] = useState("80");
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<number[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<number | null>(null);
  const [componentsBySubject, setComponentsBySubject] = useState<Record<number, Component[]>>({});
  const [loadingSubjectSetup, setLoadingSubjectSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [cloned, setCloned] = useState(false);
  const [cloning, setCloning] = useState(false);

  // Seed defaults once criteria loads.
  useEffect(() => {
    if (!criteria) return;
    if (examTypeId === null && criteria.exam_types.length) setExamTypeId(criteria.exam_types[0].id);
    if (classId === null && criteria.classes.length) setClassId(criteria.classes[0].id);
  }, [criteria, examTypeId, classId]);

  const sectionsForClass = useMemo(
    () => (criteria?.sections ?? []).filter((s) => s.class_id === classId),
    [criteria, classId],
  );

  useEffect(() => {
    if (!sectionsForClass.length) { setSectionId(null); return; }
    if (!sectionsForClass.some((s) => s.id === sectionId)) setSectionId(sectionsForClass[0].id);
  }, [sectionsForClass, sectionId]);

  useEffect(() => {
    if (!criteria) return;
    if (selectedSubjectIds.length === 0 && criteria.subjects.length) {
      setSelectedSubjectIds(criteria.subjects.slice(0, 5).map((s) => s.id));
    }
  }, [criteria, selectedSubjectIds.length]);

  useEffect(() => {
    if (!activeSubjectId && selectedSubjectIds.length) setActiveSubjectId(selectedSubjectIds[0]);
    if (activeSubjectId && !selectedSubjectIds.includes(activeSubjectId)) {
      setActiveSubjectId(selectedSubjectIds[0] ?? null);
    }
  }, [selectedSubjectIds, activeSubjectId]);

  const examTypeTitle = criteria?.exam_types.find((e) => e.id === examTypeId)?.title ?? "";
  const className = criteria?.classes.find((c) => c.id === classId)?.class_name ?? "";
  const subjectName = (id: number | null) => criteria?.subjects.find((s) => s.id === id)?.subject_name ?? "";

  const cloneCandidate = useMemo(() => {
    if (!criteria || !examTypeId) return null;
    const current = criteria.exam_types.find((e) => e.id === examTypeId);
    if (!current) return null;
    return (
      criteria.exam_types.find((e) => e.id !== examTypeId && e.title.toLowerCase() === current.title.toLowerCase() && e.id < examTypeId) ?? null
    );
  }, [criteria, examTypeId]);

  const toggleSubject = (id: number) =>
    setSelectedSubjectIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  // Load existing components for the active subject whenever the criteria selection changes.
  useEffect(() => {
    if (!activeSubjectId || !classId || !sectionId || !examTypeId) return;
    let cancelled = false;
    setLoadingSubjectSetup(true);
    searchExamSetup({ class_id: classId, section: sectionId, subject: activeSubjectId, exam_term_id: examTypeId })
      .then((res) => {
        if (cancelled) return;
        if (res.items.length) {
          setComponentsBySubject((all) => ({
            ...all,
            [activeSubjectId]: res.items.map((item) => ({ id: String(item.id), name: item.exam_title, marks: item.exam_mark })),
          }));
        }
      })
      .catch(() => { /* no existing setup yet — keep defaults */ })
      .finally(() => { if (!cancelled) setLoadingSubjectSetup(false); });
    return () => { cancelled = true; };
  }, [activeSubjectId, classId, sectionId, examTypeId]);

  const activeComponents = (activeSubjectId !== null ? componentsBySubject[activeSubjectId] : undefined) ?? defaultComponents(maxMarks);
  const setActiveComponents = (updater: (rows: Component[]) => Component[]) => {
    if (activeSubjectId === null) return;
    setComponentsBySubject((all) => ({ ...all, [activeSubjectId]: updater(all[activeSubjectId] ?? defaultComponents(maxMarks)) }));
  };
  const currentTotal = activeComponents.reduce((sum, c) => sum + (Number(c.marks) || 0), 0);
  const targetTotal = Number(maxMarks) || 0;

  const handleClone = async () => {
    if (!cloneCandidate || !examTypeId || !classId || !sectionId) return;
    setCloning(true);
    setSaveError(null);
    try {
      await cloneExamSetup({ from_exam_term_id: cloneCandidate.id, to_exam_term_id: examTypeId, class_id: classId, section: sectionId });
      setCloned(true);
      setComponentsBySubject({});
    } catch (e) {
      setSaveError(e instanceof ExamsApiError ? e.message : "Failed to clone last year's setup.");
    } finally {
      setCloning(false);
    }
  };

  const handleSave = async () => {
    if (!examTypeId || !classId || !sectionId || !selectedSubjectIds.length) return;
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      for (const subjectId of selectedSubjectIds) {
        const components = componentsBySubject[subjectId] ?? defaultComponents(maxMarks);
        await storeExamSetup({
          class_id: classId,
          section: sectionId,
          subject: subjectId,
          exam_term_id: examTypeId,
          total_exam_mark: maxMarks,
          totalMark: String(components.reduce((sum, c) => sum + (Number(c.marks) || 0), 0)),
          exam_title: components.map((c) => c.name),
          exam_mark: components.map((c) => c.marks),
        });
      }
      setSaveSuccess(true);
    } catch (e) {
      setSaveError(e instanceof ExamsApiError ? e.message : "Failed to save exam setup.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ minHeight: "100%", background: T.page, padding: "12px 20px 40px" }}>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 12 }}>
          <Link href="/dashboard" style={{ color: T.ink2, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <Link href="/exams/command-center" style={{ color: T.ink2, textDecoration: "none" }}>Examinations</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <span style={{ color: T.ink1, fontWeight: 600 }}>Exam Setup</span>
        </nav>

        <Link
          href="/exams/command-center"
          style={{
            display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 600,
            color: T.ink1, textDecoration: "none", border: `1px solid ${T.borderStrong}`,
            borderRadius: 8, padding: "6px 12px", background: "#fff", marginBottom: 16,
          }}
        >
          <ArrowLeft size={13} /> Back to Command Center
        </Link>

        {/* Hero */}
        <div style={{ marginBottom: 18 }}>
          <Eyebrow>Exam Setup · {examTypeTitle || "Loading…"} · Per exam cycle</Eyebrow>
          <h1 style={{ margin: "6px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 30 }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, color: T.ink1 }}>Which classes sit it,</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, color: T.purple }}>
              and how it&apos;s marked.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, maxWidth: 640, margin: "0 0 14px" }}>
            The pattern rarely changes cycle to cycle — start from last term instead of rebuilding it from scratch.
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            {([[1, "Step 1 · Choose Classes & Subjects"], [2, "Step 2 · Mark Distribution"]] as const).map(([n, label]) => {
              const done = n < step;
              const active = n === step;
              return (
                <button
                  key={n} type="button" onClick={() => setStep(n)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5,
                    height: 30, padding: "0 12px", borderRadius: 999, fontSize: 11.5, fontWeight: 700,
                    textTransform: "uppercase", letterSpacing: "0.03em", cursor: "pointer",
                    border: `1px solid ${active ? T.purple : done ? T.ok : T.borderStrong}`,
                    background: active ? T.purple : done ? T.okSoft : "#fff",
                    color: active ? "#fff" : done ? T.ok : T.ink3,
                  }}
                >
                  {done && <Check size={11} strokeWidth={3} />}
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {saveError && (
          <div style={{ background: T.dangerSoft, color: T.danger, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>
            {saveError}
          </div>
        )}
        {saveSuccess && (
          <div style={{ background: T.okSoft, color: T.ok, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>
            Exam setup saved.
          </div>
        )}

        {/* Reuse banner */}
        {cloneCandidate && (
          <div style={{
            display: "flex", alignItems: "center", gap: 14, background: T.purpleSoft,
            border: `1px solid ${T.purple}33`, borderRadius: 14, padding: "16px 18px", marginBottom: 16,
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <RotateCcw size={16} color={T.purple} strokeWidth={2} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink1 }}>Reuse {cloneCandidate.title}&apos;s setup</div>
              <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>
                Same classes, subjects and mark distribution as before — tweak only what&apos;s different.
              </div>
            </div>
            <button
              type="button"
              onClick={handleClone}
              disabled={cloning || cloned}
              style={{
                height: 38, padding: "0 16px", borderRadius: 9, border: `1px solid ${T.purple}`,
                background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: cloning || cloned ? "default" : "pointer",
                whiteSpace: "nowrap", flexShrink: 0, opacity: cloning ? 0.7 : 1,
              }}
            >
              {cloned ? "Cloned ✓" : cloning ? "Cloning…" : `Clone from ${cloneCandidate.title}`}
            </button>
          </div>
        )}

        {step === 1 ? (
          <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: T.ink1, marginBottom: 16 }}>
              <CalendarClock size={15} color={T.purple} strokeWidth={2} />
              Exam criteria
            </div>

            {criteriaLoading ? (
              <div style={{ fontSize: 12.5, color: T.ink3 }}>Loading criteria…</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                  <select style={selectSx} value={examTypeId ?? ""} onChange={(e) => setExamTypeId(Number(e.target.value))}>
                    {(criteria?.exam_types ?? []).map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                  </select>
                  <select style={selectSx} value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))}>
                    {(criteria?.classes ?? []).map((o) => <option key={o.id} value={o.id}>{o.class_name}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  <select style={selectSx} value={sectionId ?? ""} onChange={(e) => setSectionId(Number(e.target.value))}>
                    {sectionsForClass.map((o) => <option key={o.id} value={o.id}>{o.section_name}</option>)}
                  </select>
                  <input
                    style={selectSx} value={maxMarks} placeholder="Max marks"
                    onChange={(e) => setMaxMarks(e.target.value.replace(/[^0-9]/g, ""))}
                  />
                </div>

                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                  Subjects
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                  {(criteria?.subjects ?? []).map((s) => {
                    const active = selectedSubjectIds.includes(s.id);
                    return (
                      <button
                        key={s.id} type="button" onClick={() => toggleSubject(s.id)}
                        style={{
                          display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                          borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                          border: `1px solid ${active ? T.purple : T.borderStrong}`,
                          background: active ? T.purpleSoft : "#fff",
                          color: active ? T.purple : T.ink2,
                        }}
                      >
                        {s.subject_name}
                        {active && <X size={12} />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: T.ink1, marginBottom: 12 }}>
              <LayoutGrid size={15} color={T.purple} strokeWidth={2} />
              Mark distribution
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.purple, background: T.purpleSoft, borderRadius: 999, padding: "5px 12px" }}>{className}</span>
              {selectedSubjectIds.map((id) => (
                <button
                  key={id} type="button" onClick={() => setActiveSubjectId(id)}
                  style={{
                    fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
                    border: `1px solid ${activeSubjectId === id ? T.purple : T.borderStrong}`,
                    background: activeSubjectId === id ? T.purpleSoft : "#fff",
                    color: activeSubjectId === id ? T.purple : T.ink2,
                  }}
                >
                  {subjectName(id)}
                </button>
              ))}
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink2, background: T.hoverSoft, borderRadius: 999, padding: "5px 12px" }}>Total {maxMarks} marks</span>
            </div>

            {loadingSubjectSetup ? (
              <div style={{ fontSize: 12.5, color: T.ink3, marginBottom: 12 }}>Loading existing setup…</div>
            ) : (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 100px 24px", gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                  <span>Component</span><span>Marks</span><span />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {activeComponents.map((c) => (
                    <div key={c.id} style={{ display: "grid", gridTemplateColumns: "1fr 100px 24px", gap: 8, alignItems: "center" }}>
                      <input
                        style={selectSx} value={c.name}
                        onChange={(e) => setActiveComponents((rows) => rows.map((r) => (r.id === c.id ? { ...r, name: e.target.value } : r)))}
                      />
                      <input
                        style={{ ...selectSx, textAlign: "center" }} value={c.marks}
                        onChange={(e) => setActiveComponents((rows) => rows.map((r) => (r.id === c.id ? { ...r, marks: e.target.value.replace(/[^0-9]/g, "") } : r)))}
                      />
                      <button
                        type="button"
                        onClick={() => setActiveComponents((rows) => rows.filter((r) => r.id !== c.id))}
                        style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, padding: 4, display: "flex" }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setActiveComponents((rows) => [...rows, { id: String(Date.now()), name: "", marks: "0" }])}
                  style={{
                    display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", marginBottom: 16,
                    borderRadius: 9, border: `1px dashed ${T.borderStrong}`, background: "#fff",
                    color: T.ink2, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  <Plus size={13} /> Add component
                </button>

                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  borderRadius: 10, padding: "10px 14px",
                  background: currentTotal === targetTotal ? T.okSoft : T.warnSoft,
                  color: currentTotal === targetTotal ? T.ok : T.warn,
                }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                    {currentTotal === targetTotal && <Check size={13} strokeWidth={3} />}
                    Target {targetTotal} · Current {currentTotal} · {currentTotal === targetTotal ? "Matched" : "Mismatched"}
                  </span>
                  <span style={{ fontSize: 11.5, color: T.ink3 }}>Applies to selected section</span>
                </div>
              </>
            )}
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
          <Link
            href="/exams/command-center"
            style={{
              height: 42, padding: "0 20px", borderRadius: 10, border: `1px solid ${T.borderStrong}`,
              background: "#fff", color: T.ink1, fontSize: 13.5, fontWeight: 600, cursor: "pointer",
              display: "flex", alignItems: "center", textDecoration: "none",
            }}
          >
            Cancel
          </Link>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !selectedSubjectIds.length}
            style={{
              height: 42, padding: "0 22px", borderRadius: 10, border: `1px solid ${T.purple}`,
              background: T.purple, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: saving ? "default" : "pointer",
              opacity: saving || !selectedSubjectIds.length ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save Exam Setup"}
          </button>
        </div>
      </div>
    </div>
  );
}
