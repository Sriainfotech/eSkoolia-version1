"use client";
/**
 * Examination › Results & Reports — "after marks are in" group: report-card
 * setup, then a single publish gate per section (readiness checklist +
 * moderation queue + merit list + per-student downloads). Static mockup only
 * (per product ask) — see ExamResultPublishPanel.tsx (hidden, waiting on real
 * endpoints) for the eventual wired version. Palette from lib/examTheme.ts.
 */
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ClipboardList, Users, FileText, Check, AlertTriangle,
  Award, Printer, Download,
} from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";
import { Accordion, Badge, ExamPicker, StepPills, type Tone } from "@/components/exams/ExamUi";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.ink2 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.purple, display: "inline-block" }} />
      {children}
    </div>
  );
}

function StatTile({ label, value, valueColor, note }: { label: string; value: string; valueColor: string; note: string }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px" }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 700, color: valueColor, lineHeight: 1, marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: T.ink2 }}>{note}</div>
    </div>
  );
}

function ToggleRow({ label, sub, on, onChange, disabled }: { label: string; sub: string; on: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "8px 0" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: T.ink1 }}>{label}</div>
        <div style={{ fontSize: 11.5, color: T.ink3 }}>{sub}</div>
      </div>
      <button
        type="button" disabled={disabled} onClick={() => !disabled && onChange(!on)}
        style={{
          width: 34, height: 20, borderRadius: 999, border: "none", cursor: disabled ? "default" : "pointer", padding: 0,
          background: on ? T.purple : T.borderStrong, position: "relative", flexShrink: 0, opacity: disabled ? 0.6 : 1,
        }}
      >
        <span style={{ position: "absolute", top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "left 0.15s" }} />
      </button>
    </div>
  );
}

interface ModerationFlag { id: string; student: string; detail: string; note: string }
const INITIAL_FLAGS: ModerationFlag[] = [
  { id: "f1", student: "Aarav Mehta", detail: "Mathematics 8A — 94/80, right on the C1/C2 boundary", note: "" },
  { id: "f2", student: "Sanjay Kapoor", detail: "Mathematics 8A — 18/80, marked one entry has already submitted", note: "" },
  { id: "f3", student: "Kavya Nair", detail: "Mathematics 8A — marked absent, but attendance shows present", note: "" },
];

const MERIT = [
  { name: "Ananya Rao", cls: "8A", pct: "89.4%" },
  { name: "Kabir Malhotra", cls: "8A", pct: "84.2%" },
  { name: "Zara Sheikh", cls: "8A", pct: "82.6%" },
];

const STUDENTS = [
  { name: "Ananya Rao", pct: "89.4%", grade: "A1" },
  { name: "Kabir Malhotra", pct: "84.2%", grade: "A2" },
  { name: "Zara Sheikh", pct: "82.6%", grade: "A2" },
  { name: "Amar Mehta", pct: "68.0%", grade: "B1" },
  { name: "Rohan Bhatt", pct: "62.4%", grade: "B2" },
  { name: "Sanjay Kapoor", pct: "38.0%", grade: "D" },
];

export default function ResultsAndReportsPage() {
  const [exam, setExam] = useState("Unit Test 3");
  const [step, setStep] = useState(1);

  // Step 1 — setup
  const [visibility, setVisibility] = useState({ classTeacher: true, subjectTeacher: false, admin: true });
  const [template, setTemplate] = useState("CBSE style");
  const [sections, setSections] = useState({
    photo: true, coScholastic: true, attendance: true, comments: true, overallNotes: true, improvement: true,
  });
  const [workflow, setWorkflow] = useState<"asyougo" | "bulk" | "custom">("asyougo");

  // Step 2 — publish
  const [flags, setFlags] = useState(INITIAL_FLAGS);
  const [reportCardsGenerated, setReportCardsGenerated] = useState(false);
  const [principalSignoff, setPrincipalSignoff] = useState(false);
  const [published, setPublished] = useState(false);

  const checksDone = [true, true, true, reportCardsGenerated, flags.length === 0].filter(Boolean).length;
  const allChecksDone = checksDone === 5 && principalSignoff;

  return (
    <div style={{ minHeight: "100%", background: T.page, padding: "12px 20px 40px" }}>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 12 }}>
          <Link href="/dashboard" style={{ color: T.ink2, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <Link href="/exams/command-center" style={{ color: T.ink2, textDecoration: "none" }}>Examinations</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <span style={{ color: T.ink1, fontWeight: 600 }}>Results & Reports</span>
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
          <Eyebrow>Results & Reports · {exam}</Eyebrow>
          <h1 style={{ margin: "6px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 30 }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, color: T.ink1 }}>One gate</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, color: T.purple }}>
              before results go live.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, maxWidth: 640, margin: "0 0 14px" }}>
            Build the report cards first, then publish once — merit lists and student reports regenerate
            from that action.
          </p>
        </div>

        <ExamPicker
          icon={ClipboardList} value={exam} onChange={setExam}
          options={["Periodic Test 1", "Half-Yearly Examination", "Periodic Test 2", "Unit Test 3", "Yearly Examination"]}
          note="Switching here switches Conduct & Marks too — one exam in focus at a time, everywhere."
        />

        <div style={{ marginBottom: 16 }}>
          <StepPills step={step} setStep={setStep} steps={["Report Card Setup", "Publish"]} />
        </div>

        {step === 1 ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.8fr) minmax(360px, 1.6fr)", gap: 18, alignItems: "start" }}>
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.ink1, marginBottom: 4 }}>Who can see report cards?</div>
              <ToggleRow label="Class Teacher" sub="Complete their own only" on={visibility.classTeacher} onChange={(v) => setVisibility((s) => ({ ...s, classTeacher: v }))} />
              <ToggleRow label="Subject Teacher" sub="Marks entry only" on={visibility.subjectTeacher} onChange={(v) => setVisibility((s) => ({ ...s, subjectTeacher: v }))} />
              <ToggleRow label="Admin" sub="Automatically always" on disabled onChange={() => {}} />
              <button type="button" style={{ background: "none", border: "none", color: T.purple, fontSize: 12.5, fontWeight: 600, cursor: "pointer", textAlign: "left", padding: "10px 0 0" }}>
                + Add a moderator role
              </button>
            </div>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.ink1, marginBottom: 4 }}>Report card structure</div>
              <p style={{ fontSize: 11.5, color: T.ink3, lineHeight: 1.5, margin: "0 0 12px" }}>
                This is just a fixed layout — later choose from a template library or upload the school&apos;s
                own PDF/Word template; then this screen only picks values, not layout.
              </p>

              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Template (placeholder, not wired)
              </div>
              <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                {["CBSE style", "ICSE style", "Cambridge style", "IB style"].map((t) => (
                  <button
                    key={t} type="button" onClick={() => setTemplate(t)}
                    style={{
                      height: 32, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border: `1px solid ${template === t ? T.purple : T.borderStrong}`,
                      background: template === t ? T.purpleSoft : "#fff",
                      color: template === t ? T.purple : T.ink2,
                    }}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Sections included
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                {([
                  ["photo", "Student photo"], ["coScholastic", "Co-scholastic attendance"], ["attendance", "Attendance summary"],
                  ["comments", "Subject teacher comments"], ["overallNotes", "Overall performance notes"], ["improvement", "Scope for improvement"],
                ] as const).map(([key, label]) => {
                  const on = sections[key];
                  return (
                    <button
                      key={key} type="button" onClick={() => setSections((s) => ({ ...s, [key]: !s[key] }))}
                      style={{
                        display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 10px", borderRadius: 999,
                        fontSize: 12, fontWeight: 600, cursor: "pointer",
                        border: `1px solid ${on ? T.purple : T.borderStrong}`,
                        background: on ? T.purpleSoft : "#fff", color: on ? T.purple : T.ink2,
                      }}
                    >
                      {on && <Check size={11} strokeWidth={3} />} {label}
                    </button>
                  );
                })}
              </div>

              <div style={{ fontSize: 12, color: T.ink2, marginBottom: 16 }}>
                Grading scale referenced: <strong style={{ color: T.ink1 }}>CBSE 9-Point Scale (School)</strong> ·{" "}
                <Link href="/exams/exam-type" style={{ color: T.purple, fontWeight: 600, textDecoration: "none" }}>Change scale</Link>
              </div>

              <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>
                Moderation workflow
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {([
                  ["asyougo", "As-you-go", "Flag & moderate as marks come in"],
                  ["bulk", "Bulk", "Moderate all at once, right before publish"],
                  ["custom", "Custom…", "Set your own rule per exam type"],
                ] as const).map(([key, label, sub]) => (
                  <button
                    key={key} type="button" onClick={() => setWorkflow(key)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                      border: `1px solid ${workflow === key ? T.purple : T.border}`,
                      background: workflow === key ? T.purpleSoft : "#fff", textAlign: "left",
                    }}
                  >
                    <span style={{
                      width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${workflow === key ? T.purple : T.borderStrong}`,
                      flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      {workflow === key && <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.purple }} />}
                    </span>
                    <span>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink1 }}>{label}</span>
                      <span style={{ fontSize: 11.5, color: T.ink3, marginLeft: 6 }}>— {sub}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 14, marginBottom: 16 }}>
              <StatTile label="Class average" value="74.2" valueColor={T.ink1} note="↑ 4.1 pts vs Half-Yearly" />
              <StatTile label="Pass rate" value="94%" valueColor={T.ok} note="60/63 students · 3 in re-test" />
              <StatTile label="Weakest area" value="English" valueColor={T.warn} note="Section avg. lowest of 6 subjects" />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <Accordion title="Grade 6" right={<Badge tone="ok">2 sections · published</Badge>} />
              <Accordion title="Grade 7" right={<Badge tone="warn">2 sections · marks entry in progress</Badge>} />
              <Accordion title="Grade 8" right={<Badge tone="warn">Section A · {checksDone} of 5 checks complete</Badge>} defaultOpen>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: T.ink1 }}>Section A</span>
                    <Badge tone={allChecksDone ? "ok" : "warn"}>{checksDone} of 5 checks complete</Badge>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14, alignItems: "start" }}>
                    {/* Readiness checklist */}
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.ink1, marginBottom: 10 }}>
                        <Check size={13} color={T.purple} /> Publish readiness — {checksDone}/5 complete
                      </div>
                      {[
                        { label: "Marks entered for all sections", sub: "32/32", done: true },
                        { label: "Grading scale applied", sub: "", done: true },
                        { label: "Overall marks compiled", sub: "32/32 entered", done: true },
                        { label: "Report cards generated", sub: reportCardsGenerated ? "32/32 ready" : "0/32 ready", done: reportCardsGenerated, action: () => setReportCardsGenerated(true) },
                        { label: "Moderation review complete", sub: flags.length === 0 ? "all clear" : `${flags.length} flagged`, done: flags.length === 0 },
                      ].map((c, i) => (
                        <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                          <span style={{
                            width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                            background: c.done ? T.ok : "#fff", border: `1.5px solid ${c.done ? T.ok : T.borderStrong}`,
                          }}>
                            {c.done && <Check size={10} color="#fff" strokeWidth={3} />}
                          </span>
                          <span style={{ fontSize: 12.5, color: c.done ? T.ink1 : T.ink2, flex: 1 }}>
                            {c.label} {c.sub && <span style={{ color: T.ink3 }}>({c.sub})</span>}
                          </span>
                          {!c.done && c.action && (
                            <button type="button" onClick={c.action} style={{ height: 26, padding: "0 8px", borderRadius: 6, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                              Generate
                            </button>
                          )}
                        </div>
                      ))}
                      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                        <span style={{
                          width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                          background: principalSignoff ? T.ok : "#fff", border: `1.5px solid ${principalSignoff ? T.ok : T.borderStrong}`,
                        }}>
                          {principalSignoff && <Check size={10} color="#fff" strokeWidth={3} />}
                        </span>
                        <span style={{ fontSize: 12.5, color: principalSignoff ? T.ink1 : T.ink2, flex: 1 }}>Principal sign-off</span>
                        {!principalSignoff && (
                          <button type="button" onClick={() => setPrincipalSignoff(true)} style={{ height: 26, padding: "0 8px", borderRadius: 6, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                            Sign off
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Moderation queue */}
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.danger, marginBottom: 10 }}>
                        <AlertTriangle size={13} /> Moderation queue — flagged entries
                      </div>
                      {flags.length === 0 ? (
                        <div style={{ fontSize: 12, color: T.ok, fontWeight: 600 }}>All flagged entries resolved.</div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                          {flags.map((f) => (
                            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 8, background: T.dangerSoft }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: 700, color: T.ink1 }}>{f.student}</div>
                                <div style={{ fontSize: 11, color: T.ink2 }}>{f.detail}</div>
                              </div>
                              <button
                                type="button" onClick={() => setFlags((rows) => rows.filter((r) => r.id !== f.id))}
                                style={{ height: 28, padding: "0 10px", borderRadius: 7, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                              >
                                Approve
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Grade distribution + Merit list */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14 }}>
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.ink1, marginBottom: 10 }}>Grade distribution</div>
                      {[["A1", 9, T.ok], ["A2", 7, T.ok], ["B1", 8, T.info], ["C1", 3, T.warn], ["D", 1, T.danger]].map(([label, count, color]) => (
                        <div key={label as string} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                          <span style={{ fontSize: 11, fontWeight: 700, color: T.ink2, width: 22 }}>{label}</span>
                          <div style={{ flex: 1, height: 8, borderRadius: 999, background: T.hoverSoft, overflow: "hidden" }}>
                            <div style={{ width: `${(Number(count) / 9) * 100}%`, height: "100%", background: color as string, borderRadius: 999 }} />
                          </div>
                          <span style={{ fontSize: 11, color: T.ink3, width: 16, textAlign: "right" }}>{count}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.ink1, marginBottom: 10 }}>
                        <Award size={13} color={T.purple} /> Merit list — top 3
                      </div>
                      {MERIT.map((m, i) => (
                        <div key={m.name} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                          <span style={{ width: 20, height: 20, borderRadius: "50%", background: T.purpleSoft, color: T.purple, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{i + 1}</span>
                          <span style={{ fontSize: 12.5, color: T.ink1, flex: 1 }}>{m.name} · {m.cls}</span>
                          <span style={{ fontSize: 12, fontWeight: 700, color: T.ok }}>{m.pct}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Student list */}
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.ink1 }}>
                        <Users size={13} color={T.purple} /> Students in this section
                      </div>
                      <button type="button" style={{ display: "flex", alignItems: "center", gap: 6, height: 30, padding: "0 12px", borderRadius: 8, border: `1px solid ${T.purple}`, background: T.purple, color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>
                        <Download size={12} /> Generate all 32 as PDF · download ZIP
                      </button>
                    </div>
                    {STUDENTS.map((s) => (
                      <div key={s.name} style={{ display: "grid", gridTemplateColumns: "1.5fr 80px 60px 70px", gap: 8, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${T.border}`, fontSize: 12.5, color: T.ink1 }}>
                        <span>{s.name}</span>
                        <span style={{ color: T.ink2 }}>{s.pct}</span>
                        <span><Badge tone={gradeToneFor(s.grade)}>{s.grade}</Badge></span>
                        <button type="button" style={{ display: "flex", alignItems: "center", gap: 5, height: 26, padding: "0 8px", borderRadius: 6, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                          <Printer size={11} /> Print
                        </button>
                      </div>
                    ))}
                    <div style={{ fontSize: 11.5, color: T.purple, fontWeight: 600, marginTop: 8, cursor: "pointer" }}>View all 32 students & print in bulk</div>
                  </div>

                  {/* Publish gate */}
                  <div style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                    borderRadius: 10, padding: "12px 16px",
                    background: allChecksDone ? T.okSoft : T.warnSoft,
                  }}>
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: allChecksDone ? T.ok : T.warn }}>
                      {allChecksDone
                        ? "All checks complete — ready to publish."
                        : `${5 - checksDone + (principalSignoff ? 0 : 1)} check(s) remaining in Grade 8A before this section can publish.`}
                    </span>
                    <button
                      type="button" disabled={!allChecksDone} onClick={() => setPublished(true)}
                      style={{
                        height: 38, padding: "0 18px", borderRadius: 9, border: "none",
                        background: allChecksDone ? T.purple : T.borderStrong,
                        color: allChecksDone ? "#fff" : T.ink3, fontSize: 12.5, fontWeight: 700,
                        cursor: allChecksDone ? "pointer" : "not-allowed", whiteSpace: "nowrap",
                      }}
                    >
                      {published ? "Published ✓" : "Publish results"}
                    </button>
                  </div>

                  {/* Downstream status cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
                    {[
                      { label: "Student Report", ready: published },
                      { label: "Admit Card", ready: true },
                      { label: "Seat Plan", ready: true },
                      { label: "Merit Report", ready: published },
                    ].map((c) => (
                      <div key={c.label} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                        <FileText size={16} color={c.ready ? T.ok : T.ink3} style={{ margin: "0 auto 6px" }} />
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink1 }}>{c.label}</div>
                        <div style={{ fontSize: 10.5, color: c.ready ? T.ok : T.ink3, marginTop: 2 }}>{c.ready ? "Ready" : "1 pending"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </Accordion>
              <Accordion title="Grade 9" right={<Badge tone="warn">1 section · attendance pending</Badge>} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function gradeToneFor(g: string): Tone {
  return g.startsWith("A") ? "ok" : g.startsWith("B") ? "info" : g.startsWith("C") ? "warn" : "danger";
}
