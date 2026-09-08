"use client";
/**
 * Examination › Conduct & Marks — "during exam" group: exam-day attendance,
 * then marks entry, monitored subject-by-subject and cross-checked
 * student-by-student. Static mockup only (per product ask) — see
 * ExamMarksRegisterCreatePanel.tsx (hidden, waiting on real endpoints) for
 * the eventual wired version. Palette from lib/examTheme.ts.
 */
import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ClipboardList, UserCheck, CheckSquare } from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";
import { Accordion, Badge, ExamPicker, StepPills, ProgressBar, type Tone } from "@/components/exams/ExamUi";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.ink2 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.purple, display: "inline-block" }} />
      {children}
    </div>
  );
}

interface AttStudent { roll: string; name: string; present: boolean }
const SECTION_A_ATT: AttStudent[] = [
  { roll: "8A01", name: "Aarohi Nair", present: true },
  { roll: "8A02", name: "Krish Malhotra", present: true },
  { roll: "8A03", name: "Siya Agarwal", present: false },
  { roll: "8A04", name: "Rudra Prasad", present: true },
];
const SECTION_B_ATT: AttStudent[] = [
  { roll: "08B01", name: "Aarav Mehta", present: true },
  { roll: "08B02", name: "Diya Kulkarni", present: true },
  { roll: "08B03", name: "Kavya Nair", present: false },
  { roll: "08B04", name: "Rohan Bhatt", present: true },
];

const SUBJECTS = ["MATH", "SCI", "SST", "HINDI", "ENG", "COMP APPL"];
interface MarksStudent { roll: string; name: string; absent?: boolean; grades?: (string | null)[] }
const GRADE7_SECTION_A: MarksStudent[] = [
  { roll: "7A01", name: "Aadhya Ranganathan", grades: ["A1", "A1", "B1", "A2", null, null] },
  { roll: "7A02", name: "Dhruv Saxena", absent: true },
  { roll: "7A03", name: "Anaya Kulkarni", absent: true },
  { roll: "7A04", name: "Reyansh Oberoi", grades: ["B1", "A2", "B2", "B1", null, null] },
];

const gradeTone = (g: string): Tone => (g.startsWith("A") ? "ok" : g.startsWith("B") ? "info" : g.startsWith("C") ? "warn" : "danger");

export default function ConductAndMarksPage() {
  const [exam, setExam] = useState("Unit Test 3");
  const [step, setStep] = useState(1);

  return (
    <div style={{ minHeight: "100%", background: T.page, padding: "12px 20px 40px" }}>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 12 }}>
          <Link href="/dashboard" style={{ color: T.ink2, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <Link href="/exams/command-center" style={{ color: T.ink2, textDecoration: "none" }}>Examinations</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <span style={{ color: T.ink1, fontWeight: 600 }}>Conduct & Marks</span>
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
        <div style={{ marginBottom: 16 }}>
          <Eyebrow>Conduct & Marks · {exam}</Eyebrow>
          <h1 style={{ margin: "6px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 30 }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, color: T.ink1 }}>Marks are entered</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, color: T.purple }}>
              by the teacher who taught it.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, maxWidth: 640, margin: "0 0 14px" }}>
            Each subject teacher takes their own roll call and enters their own marks. This screen tracks
            who&apos;s done and who still needs a nudge.
          </p>
        </div>

        <ExamPicker
          icon={ClipboardList} value={exam} onChange={setExam}
          options={["Periodic Test 1", "Half-Yearly Examination", "Periodic Test 2", "Unit Test 3", "Yearly Examination"]}
          note="Switching here switches Results & Reports too — one exam in focus at a time, everywhere."
        />

        <div style={{ marginBottom: 16 }}>
          <StepPills step={step} setStep={setStep} steps={["Exam-day Attendance", "Marks Entry"]} />
        </div>

        {step === 1 ? (
          <>
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: T.ink1, marginBottom: 6 }}>
                <UserCheck size={15} color={T.purple} strokeWidth={2} /> Exam-day attendance — captured, not entered
              </div>
              <p style={{ fontSize: 12, color: T.ink2, lineHeight: 1.6, margin: 0 }}>
                Attendance was marked at the start of each exam session by the subject teacher in the room —
                separate from the daily register. <strong>173/181</strong> students marked present across the 6
                sections currently in session for {exam}. Expand a class below for name-by-name attendance, or
                view the full <span style={{ color: T.purple, fontWeight: 600 }}>Attendance Report ↗</span>.
              </p>
            </div>
            <p style={{ fontSize: 11.5, color: T.ink3, margin: "0 0 14px" }}>
              Grouped by Class · Section, the same way Results & Reports and Compilation status are.
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Accordion title="Grade 6" right={<Badge tone="ok">2 sections · 61/62 present</Badge>} />
              <Accordion title="Grade 7" right={<Badge tone="ok">2 sections · 60/63 present</Badge>} />
              <Accordion title="Grade 8" right={<Badge tone="warn">2 sections · 52/56 present</Badge>} defaultOpen>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[{ name: "Section A", rows: SECTION_A_ATT, present: 29, total: 32, tone: "warn" as Tone, note: "Showing 4 of 32 · 3 absent so far" },
                    { name: "Section B", rows: SECTION_B_ATT, present: 23, total: 24, tone: "ok" as Tone, note: "Showing 4 of 24 · matches Mr. Rao's roll call for Mathematics 8B." }]
                    .map((sec) => (
                      <div key={sec.name} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: T.ink1 }}>{sec.name}</span>
                          <Badge tone={sec.tone}>{sec.present}/{sec.total} present</Badge>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "70px 1fr 90px", gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 4px 6px" }}>
                          <span>Roll</span><span>Student</span><span>Attendance</span>
                        </div>
                        {sec.rows.map((s) => (
                          <div key={s.roll} style={{ display: "grid", gridTemplateColumns: "70px 1fr 90px", gap: 8, padding: "6px 4px", fontSize: 12.5, color: T.ink1, borderTop: `1px solid ${T.border}` }}>
                            <span style={{ fontFamily: "monospace" }}>{s.roll}</span>
                            <span>{s.name}</span>
                            <span><Badge tone={s.present ? "ok" : "danger"}>{s.present ? "Present" : "Absent"}</Badge></span>
                          </div>
                        ))}
                        <div style={{ fontSize: 11, color: T.ink3, marginTop: 6 }}>{sec.note}</div>
                      </div>
                    ))}
                </div>
              </Accordion>
              <Accordion title="Grade 9" right={<Badge tone="warn">1 section · not scheduled</Badge>}>
                <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.ink1 }}>Section A</span>
                    <Badge tone="warn">Not scheduled</Badge>
                  </div>
                  <div style={{ fontSize: 12, color: T.ink3 }}>
                    {exam} hasn&apos;t been scheduled for Grade 9A yet — nothing to take attendance for.
                  </div>
                </div>
              </Accordion>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.ink1, whiteSpace: "nowrap" }}>142 / 160 entered</span>
              <div style={{ flex: 1 }}><ProgressBar value={(142 / 160) * 100} /></div>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.purple }}>88%</span>
            </div>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden", marginBottom: 8 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 1fr 90px", gap: 8, padding: "10px 16px", fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${T.border}` }}>
                <span>Subject</span><span>Class</span><span>Teacher</span><span>Progress</span><span>Status</span><span />
              </div>
              {[
                { subject: "Mathematics", cls: "Grade 8A", teacher: "Mr. Rao", entered: 26, total: 26, status: "Complete", tone: "ok" as Tone },
                { subject: "Mathematics", cls: "Grade 8B", teacher: "Mr. Rao", entered: 18, total: 24, status: "In progress", tone: "warn" as Tone },
                { subject: "Science", cls: "Grade 7A", teacher: "Mrs. Deshmukh", entered: 32, total: 32, status: "Complete", tone: "ok" as Tone },
                { subject: "English", cls: "Grade 7A", teacher: "Mrs. Fernandes", entered: 18, total: 32, status: "14 pending", tone: "warn" as Tone, remind: true },
                { subject: "Computer Applications", cls: "Grade 7A", teacher: "Mr. Khan", entered: 0, total: 32, status: "Not started", tone: "danger" as Tone, remind: true },
              ].map((r, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr 1fr 1fr 1fr 90px", gap: 8, alignItems: "center", padding: "10px 16px", fontSize: 12.5, color: T.ink1, borderBottom: `1px solid ${T.border}` }}>
                  <span>{r.subject}</span>
                  <span>{r.cls}</span>
                  <span>{r.teacher}</span>
                  <span style={{ fontFamily: "monospace", fontSize: 11.5, color: T.ink2 }}>{r.entered}/{r.total}</span>
                  <span><Badge tone={r.tone}>{r.status}</Badge></span>
                  <span>
                    {r.remind && (
                      <button type="button" style={{ height: 28, padding: "0 10px", borderRadius: 7, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 11.5, fontWeight: 600, cursor: "pointer" }}>
                        Remind
                      </button>
                    )}
                  </span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 11.5, color: T.ink3, margin: "0 0 16px" }}>
              Also view the <span style={{ color: T.purple, fontWeight: 600 }}>Marks Register ↗</span> for a per-student printable view.
            </p>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5, fontWeight: 700, color: T.ink1, marginBottom: 6 }}>
                <CheckSquare size={15} color={T.purple} strokeWidth={2} /> Cross-check scores entered — by Class · Section
              </div>
              <p style={{ fontSize: 12, color: T.ink2, lineHeight: 1.6, margin: 0 }}>
                Every subject side by side per student, so a mismatch (a suspiciously low mark, a subject
                nobody&apos;s touched) is obvious before it reaches moderation. Grouped the same way Attendance
                and Compilation status are.
              </p>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Accordion title="Grade 6" right={<Badge tone="ok">2 sections · all subjects complete</Badge>} />
              <Accordion title="Grade 7" right={<Badge tone="warn">2 sections · English & Computer Applications pending</Badge>} defaultOpen>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: T.ink1 }}>Section A</span>
                      <Badge tone="warn">4/6 subjects complete</Badge>
                    </div>
                    <div style={{ overflowX: "auto" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "60px 1.3fr repeat(6, 62px)", gap: 6, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.03em", padding: "0 4px 6px", minWidth: 560 }}>
                        <span>Roll</span><span>Student</span>
                        {SUBJECTS.map((s) => <span key={s}>{s}</span>)}
                      </div>
                      {GRADE7_SECTION_A.map((s) => (
                        <div key={s.roll} style={{ display: "grid", gridTemplateColumns: "60px 1.3fr repeat(6, 62px)", gap: 6, padding: "6px 4px", fontSize: 12, color: T.ink1, borderTop: `1px solid ${T.border}`, alignItems: "center", minWidth: 560 }}>
                          <span style={{ fontFamily: "monospace", fontSize: 11 }}>{s.roll}</span>
                          <span>{s.name}</span>
                          {s.absent ? (
                            <span style={{ gridColumn: "span 6", color: T.danger, fontWeight: 600, fontSize: 11.5 }}>Absent for this examination</span>
                          ) : (
                            s.grades!.map((g, i) => (
                              <span key={i}>
                                {g ? <Badge tone={gradeTone(g)}>{g}</Badge> : <span style={{ color: T.ink3 }}>–</span>}
                              </span>
                            ))
                          )}
                        </div>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: T.ink3, marginTop: 8 }}>
                      Showing 4 of 22 · English is 18/32 entered, Computer Applications hasn&apos;t started — matches the monitor table above.
                    </div>
                  </div>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.ink1 }}>Section B</span>
                    <Badge tone="ok">6/6 subjects complete</Badge>
                  </div>
                </div>
              </Accordion>
              <Accordion title="Grade 8" right={<Badge tone="warn">2 sections · Mathematics 8B still in progress</Badge>} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
