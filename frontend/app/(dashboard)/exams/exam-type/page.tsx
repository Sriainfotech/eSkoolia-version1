"use client";
/**
 * Examination › Exam Configuration — "set once, rarely changes" group.
 * Static mockup only (per product ask): exam types + grading scale are local
 * component state, nothing is sent to the backend yet. Palette from
 * lib/examTheme.ts (matches Command Center / Academics Foundation).
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star, TrendingUp, Trash2, Plus } from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";

interface ExamTypeRow { id: string; name: string; countsToAvg: boolean; weight: string }
interface GradeRow { id: string; label: string; min: string; max: string; points: string; fail: boolean }

type MarkingStyle = "percentage" | "letter" | "gpa";

const INITIAL_EXAM_TYPES: ExamTypeRow[] = [
  { id: "1", name: "Periodic Test 1", countsToAvg: true, weight: "10" },
  { id: "2", name: "Half-Yearly Examination", countsToAvg: true, weight: "20" },
  { id: "3", name: "Periodic Test 2", countsToAvg: true, weight: "10" },
  { id: "4", name: "Yearly Examination", countsToAvg: true, weight: "60" },
];

const INITIAL_LETTER_GRADES: GradeRow[] = [
  { id: "a1", label: "A1", min: "91", max: "100", points: "10.0", fail: false },
  { id: "a2", label: "A2", min: "81", max: "90", points: "9.0", fail: false },
  { id: "b1", label: "B1", min: "71", max: "80", points: "8.0", fail: false },
  { id: "b2", label: "B2", min: "61", max: "70", points: "7.0", fail: false },
  { id: "c1", label: "C1", min: "51", max: "60", points: "6.0", fail: false },
  { id: "c2", label: "C2", min: "41", max: "50", points: "5.0", fail: false },
  { id: "d", label: "D", min: "33", max: "40", points: "4.0", fail: false },
  { id: "e1", label: "E1 — Fail", min: "21", max: "32", points: "0", fail: true },
  { id: "e2", label: "E2 — Fail", min: "0", max: "20", points: "0", fail: true },
];

const INITIAL_GPA_GRADES: GradeRow[] = [
  { id: "g10", label: "10.0", min: "91", max: "100", points: "", fail: false },
  { id: "g9", label: "9.0", min: "81", max: "90", points: "", fail: false },
  { id: "g8", label: "8.0", min: "71", max: "80", points: "", fail: false },
  { id: "g7", label: "7.0", min: "61", max: "70", points: "", fail: false },
  { id: "g6", label: "6.0", min: "51", max: "60", points: "", fail: false },
  { id: "g5", label: "5.0", min: "41", max: "50", points: "", fail: false },
  { id: "g4", label: "4.0", min: "33", max: "40", points: "", fail: false },
  { id: "g0", label: "0.0", min: "0", max: "32", points: "", fail: true },
];

function Toggle({ on, onChange, danger }: { on: boolean; onChange: (v: boolean) => void; danger?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      style={{
        width: 34, height: 20, borderRadius: 999, border: "none", cursor: "pointer", padding: 0,
        background: on ? (danger ? T.danger : T.purple) : T.borderStrong,
        position: "relative", flexShrink: 0, transition: "background 0.15s",
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%",
        background: "#fff", transition: "left 0.15s", boxShadow: "0 1px 2px rgba(0,0,0,0.25)",
      }} />
    </button>
  );
}

function TrashBtn({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ background: "none", border: "none", cursor: "pointer", color: T.ink3, padding: 4, display: "flex" }}>
      <Trash2 size={14} />
    </button>
  );
}

const inputSx: React.CSSProperties = {
  width: "100%", height: 34, borderRadius: 8, border: `1px solid ${T.borderStrong}`,
  padding: "0 10px", fontSize: 12.5, color: T.ink1, background: "#fff", outline: "none",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.ink2 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.purple, display: "inline-block" }} />
      {children}
    </div>
  );
}

function SectionCard({ icon: Icon, title, subtitle, children }: { icon: React.ElementType; title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: T.ink1, marginBottom: 4 }}>
          <Icon size={15} color={T.purple} strokeWidth={2} />
          {title}
        </div>
        <div style={{ fontSize: 11.5, color: T.ink3, lineHeight: 1.4 }}>{subtitle}</div>
      </div>
      {children}
    </div>
  );
}

function gradeRowsEditor(
  rows: GradeRow[],
  setRows: React.Dispatch<React.SetStateAction<GradeRow[]>>,
  labelHeader: string,
  showPoints: boolean,
) {
  const update = (id: string, patch: Partial<GradeRow>) =>
    setRows((r) => r.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  const remove = (id: string) => setRows((r) => r.filter((row) => row.id !== id));
  const add = () => setRows((r) => [...r, { id: String(Date.now()), label: "", min: "0", max: "0", points: "", fail: false }]);

  const cols = showPoints ? "1.3fr 0.8fr 0.8fr 0.8fr 0.7fr 24px" : "1.3fr 0.8fr 0.8fr 0.7fr 24px";

  return (
    <>
      <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
        <span>{labelHeader}</span><span>Min %</span><span>Max %</span>
        {showPoints && <span>Points</span>}
        <span>Fail</span><span />
      </div>
      {rows.map((row) => (
        <div key={row.id} style={{ display: "grid", gridTemplateColumns: cols, gap: 8, alignItems: "center" }}>
          <input style={inputSx} value={row.label} onChange={(e) => update(row.id, { label: e.target.value })} />
          <input style={{ ...inputSx, textAlign: "center" }} value={row.min} onChange={(e) => update(row.id, { min: e.target.value.replace(/[^0-9]/g, "") })} />
          <input style={{ ...inputSx, textAlign: "center" }} value={row.max} onChange={(e) => update(row.id, { max: e.target.value.replace(/[^0-9]/g, "") })} />
          {showPoints && (
            <input style={{ ...inputSx, textAlign: "center" }} value={row.points} onChange={(e) => update(row.id, { points: e.target.value })} />
          )}
          <div style={{ display: "flex", justifyContent: "center" }}>
            <Toggle on={row.fail} onChange={(v) => update(row.id, { fail: v })} danger />
          </div>
          <TrashBtn onClick={() => remove(row.id)} />
        </div>
      ))}
      <button
        type="button" onClick={add}
        style={{
          display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
          height: 38, borderRadius: 9, border: `1px dashed ${T.borderStrong}`, background: "#fff",
          color: T.ink2, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        }}
      >
        <Plus size={13} /> Add {showPoints ? "grade band" : "GPA band"}
      </button>
    </>
  );
}

export default function ExamConfigurationPage() {
  const [examTypes, setExamTypes] = useState<ExamTypeRow[]>(INITIAL_EXAM_TYPES);
  const [letterGrades, setLetterGrades] = useState<GradeRow[]>(INITIAL_LETTER_GRADES);
  const [gpaGrades, setGpaGrades] = useState<GradeRow[]>(INITIAL_GPA_GRADES);
  const [letterScaleName, setLetterScaleName] = useState("CBSE 9-Point Scale (School)");
  const [gpaScaleName, setGpaScaleName] = useState("10-Point GPA Scale");
  const [minPassPct, setMinPassPct] = useState("33");
  const [markingStyle, setMarkingStyle] = useState<MarkingStyle>("letter");

  const updateType = (id: string, patch: Partial<ExamTypeRow>) =>
    setExamTypes((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeType = (id: string) => setExamTypes((rows) => rows.filter((r) => r.id !== id));
  const addType = () =>
    setExamTypes((rows) => [...rows, { id: String(Date.now()), name: "", countsToAvg: false, weight: "0" }]);

  return (
    <div style={{ minHeight: "100%", background: T.page, padding: "12px 20px 40px" }}>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 12 }}>
          <Link href="/dashboard" style={{ color: T.ink2, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <Link href="/exams/command-center" style={{ color: T.ink2, textDecoration: "none" }}>Examinations</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <span style={{ color: T.ink1, fontWeight: 600 }}>Exam Configuration</span>
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
        <div style={{ marginBottom: 20 }}>
          <Eyebrow>Exam Configuration · Set once, rarely changes</Eyebrow>
          <h1 style={{ margin: "6px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 30 }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, color: T.ink1 }}>Defined by</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, color: T.purple }}>
              your school, not by us.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, maxWidth: 640, margin: 0 }}>
            Nothing here is a preset — name your own exam types, weight them however your report cards
            actually work, and build a grading scale from a blank table. Change it here once and every
            future Exam Setup inherits it.
          </p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(420px, 1.35fr)", gap: 18, alignItems: "start" }}>
          {/* Exam types */}
          <SectionCard icon={Star} title="Exam types your school uses" subtitle="Every field below is editable — these are examples from one school's setup, not built-in options.">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 150px 90px 24px", gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              <span>Name</span><span>Counts to report card avg.</span><span>Weight %</span><span />
            </div>
            {examTypes.map((row) => (
              <div key={row.id} style={{ display: "grid", gridTemplateColumns: "1fr 150px 90px 24px", gap: 8, alignItems: "center" }}>
                <input
                  style={inputSx} value={row.name} placeholder="e.g. Pre-Board, Class Test, Periodic Test 3"
                  onChange={(e) => updateType(row.id, { name: e.target.value })}
                />
                <div style={{ display: "flex", justifyContent: "center" }}>
                  <Toggle on={row.countsToAvg} onChange={(v) => updateType(row.id, { countsToAvg: v })} />
                </div>
                <input
                  style={{ ...inputSx, textAlign: "center" }} value={row.weight}
                  onChange={(e) => updateType(row.id, { weight: e.target.value.replace(/[^0-9]/g, "") })}
                />
                <TrashBtn onClick={() => removeType(row.id)} />
              </div>
            ))}
            <button
              type="button" onClick={addType}
              style={{
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                height: 38, borderRadius: 9, border: `1px dashed ${T.borderStrong}`, background: "#fff",
                color: T.ink2, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}
            >
              <Plus size={13} /> Add exam type
            </button>
          </SectionCard>

          {/* Grading scale */}
          <SectionCard icon={TrendingUp} title="How your school marks students" subtitle="Pick the marking style your school actually reports on report cards — each one changes what's below.">
            <div style={{ display: "flex", gap: 6 }}>
              {([
                ["percentage", "Percentage only"],
                ["letter", "Letter grades"],
                ["gpa", "GPA / points only"],
              ] as const).map(([key, label]) => (
                <button
                  key={key} type="button" onClick={() => setMarkingStyle(key)}
                  style={{
                    flex: 1, height: 34, borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    border: `1px solid ${markingStyle === key ? T.purple : T.borderStrong}`,
                    background: markingStyle === key ? T.purpleSoft : "#fff",
                    color: markingStyle === key ? T.purple : T.ink2,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {markingStyle === "percentage" && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  Minimum passing %
                </div>
                <input
                  style={{ ...inputSx, maxWidth: 140 }} value={minPassPct}
                  onChange={(e) => setMinPassPct(e.target.value.replace(/[^0-9]/g, ""))}
                />
                <p style={{ fontSize: 11.5, color: T.ink3, lineHeight: 1.5, margin: "8px 0 0" }}>
                  Report cards show the raw percentage — no grade or GPA conversion happens. Switch back to
                  Letter grades or GPA/points if this school needs a scale instead.
                </p>
              </div>
            )}

            {markingStyle === "letter" && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  Scale name
                </div>
                <input style={inputSx} value={letterScaleName} onChange={(e) => setLetterScaleName(e.target.value)} />
                <p style={{ fontSize: 11.5, color: T.ink3, lineHeight: 1.5, margin: "8px 0 14px" }}>
                  This 9-band scale (A1–E2) is what CBSE prescribes for a school&apos;s own Periodic Test / Half-Yearly /
                  Yearly reporting. It&apos;s different from the Board&apos;s own Class 10/12 result grading, which CBSE
                  computes centrally on a relative, cohort-wide basis — not something this module needs to replicate.
                </p>
                {gradeRowsEditor(letterGrades, setLetterGrades, "Grade label", true)}
                <button
                  type="button"
                  style={{ background: "none", border: "none", color: T.purple, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: "10px 0 0" }}
                >
                  + Add another grading scale
                </button>
              </div>
            )}

            {markingStyle === "gpa" && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  Scale name
                </div>
                <input style={inputSx} value={gpaScaleName} onChange={(e) => setGpaScaleName(e.target.value)} />
                <p style={{ fontSize: 11.5, color: T.ink3, lineHeight: 1.5, margin: "8px 0 14px" }}>
                  No letter labels — the GPA value itself is what shows on the report card.
                </p>
                {gradeRowsEditor(gpaGrades, setGpaGrades, "GPA value", false)}
              </div>
            )}
          </SectionCard>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 20 }}>
          <span style={{ fontSize: 12, color: T.ink3 }}>Applies to every future exam · last edited 3 months ago</span>
          <button
            type="button"
            style={{
              height: 42, padding: "0 22px", borderRadius: 10, border: `1px solid ${T.purple}`,
              background: T.purple, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
            }}
          >
            Save configuration
          </button>
        </div>
      </div>
    </div>
  );
}
