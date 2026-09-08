"use client";
/**
 * Examination › Exam Setup — "per exam cycle" group.
 * Static mockup only (per product ask): nothing here calls the backend yet —
 * see ExamSetupPanel.tsx (hidden, real component, waiting on real endpoints)
 * for the eventual wired version. Palette from lib/examTheme.ts.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, RotateCcw, CalendarClock, Plus, X, LayoutGrid, Check, Trash2 } from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";

const ALL_SUBJECTS = ["Mathematics", "Science", "English", "Social Science", "Hindi", "Computer Science", "Art"];

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
  const [step, setStep] = useState<1 | 2>(1);
  const [cloned, setCloned] = useState(false);
  const [examType, setExamType] = useState("Yearly Examination");
  const [grade, setGrade] = useState("Grade 8A");
  const [section, setSection] = useState("Section A");
  const [maxMarks, setMaxMarks] = useState("80");
  const [subjects, setSubjects] = useState<string[]>(["Mathematics", "Science", "English", "Social Science", "Hindi"]);
  const [activeSubject, setActiveSubject] = useState("Mathematics");
  const [componentsBySubject, setComponentsBySubject] = useState<Record<string, Component[]>>({});

  const toggleSubject = (s: string) =>
    setSubjects((cur) => (cur.includes(s) ? cur.filter((x) => x !== s) : [...cur, s]));

  const activeComponents = componentsBySubject[activeSubject] ?? defaultComponents(maxMarks);
  const setActiveComponents = (updater: (rows: Component[]) => Component[]) =>
    setComponentsBySubject((all) => ({ ...all, [activeSubject]: updater(all[activeSubject] ?? defaultComponents(maxMarks)) }));
  const currentTotal = activeComponents.reduce((sum, c) => sum + (Number(c.marks) || 0), 0);
  const targetTotal = Number(maxMarks) || 0;

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
          <Eyebrow>Exam Setup · Final Examination · Per exam cycle</Eyebrow>
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

        {/* Reuse banner */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14, background: T.purpleSoft,
          border: `1px solid ${T.purple}33`, borderRadius: 14, padding: "16px 18px", marginBottom: 16,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <RotateCcw size={16} color={T.purple} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: T.ink1 }}>Reuse last year&apos;s Yearly Examination setup</div>
            <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>
              Same classes, subjects and mark distribution as AY 2025-26 — tweak only what&apos;s different.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCloned(true)}
            style={{
              height: 38, padding: "0 16px", borderRadius: 9, border: `1px solid ${T.purple}`,
              background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              whiteSpace: "nowrap", flexShrink: 0,
            }}
          >
            {cloned ? "Cloned ✓" : "Clone from Yearly Examination, AY 2025-26"}
          </button>
        </div>

        {step === 1 ? (
          <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: T.ink1, marginBottom: 16 }}>
              <CalendarClock size={15} color={T.purple} strokeWidth={2} />
              Exam criteria
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
              <select style={selectSx} value={examType} onChange={(e) => setExamType(e.target.value)}>
                {["Periodic Test 1", "Half-Yearly Examination", "Periodic Test 2", "Yearly Examination"].map((o) => <option key={o}>{o}</option>)}
              </select>
              <select style={selectSx} value={grade} onChange={(e) => setGrade(e.target.value)}>
                {["Grade 6A", "Grade 7A", "Grade 8A", "Grade 9A", "Grade 10A"].map((o) => <option key={o}>{o}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <select style={selectSx} value={section} onChange={(e) => setSection(e.target.value)}>
                {["Section A", "Section B", "Section C"].map((o) => <option key={o}>{o}</option>)}
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
              {ALL_SUBJECTS.map((s) => {
                const active = subjects.includes(s);
                return (
                  <button
                    key={s} type="button" onClick={() => toggleSubject(s)}
                    style={{
                      display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                      borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${active ? T.purple : T.borderStrong}`,
                      background: active ? T.purpleSoft : "#fff",
                      color: active ? T.purple : T.ink2,
                    }}
                  >
                    {s}
                    {active && <X size={12} />}
                  </button>
                );
              })}
              <button
                type="button"
                style={{
                  display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
                  borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
                  border: `1px dashed ${T.borderStrong}`, background: "#fff", color: T.ink2,
                }}
              >
                <Plus size={12} /> Add subject
              </button>
            </div>
          </div>
        ) : (
          <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, fontWeight: 700, color: T.ink1, marginBottom: 12 }}>
              <LayoutGrid size={15} color={T.purple} strokeWidth={2} />
              Mark distribution
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: T.purple, background: T.purpleSoft, borderRadius: 999, padding: "5px 12px" }}>{grade}</span>
              {subjects.map((s) => (
                <button
                  key={s} type="button" onClick={() => setActiveSubject(s)}
                  style={{
                    fontSize: 12, fontWeight: 600, borderRadius: 999, padding: "5px 12px", cursor: "pointer",
                    border: `1px solid ${activeSubject === s ? T.purple : T.borderStrong}`,
                    background: activeSubject === s ? T.purpleSoft : "#fff",
                    color: activeSubject === s ? T.purple : T.ink2,
                  }}
                >
                  {s}
                </button>
              ))}
              <span style={{ fontSize: 12, fontWeight: 600, color: T.ink2, background: T.hoverSoft, borderRadius: 999, padding: "5px 12px" }}>Total {maxMarks} marks</span>
            </div>

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
              <span style={{ fontSize: 11.5, color: T.ink3 }}>Applies to all selected sections</span>
            </div>
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
            style={{
              height: 42, padding: "0 22px", borderRadius: 10, border: `1px solid ${T.purple}`,
              background: T.purple, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: "pointer",
            }}
          >
            Save Exam Setup
          </button>
        </div>
      </div>
    </div>
  );
}
