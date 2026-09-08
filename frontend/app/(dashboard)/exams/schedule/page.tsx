"use client";
/**
 * Examination › Schedule & Logistics — "every cycle" group: Timetable →
 * Admit Cards → Seat Plan. Static mockup only (per product ask): conflict
 * resolution and "generate" actions just flip local component state, nothing
 * calls the backend. Palette from lib/examTheme.ts.
 */
import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, Calendar, ExternalLink, Plus, AlertTriangle, Star,
  CreditCard, Grid3x3, Check,
} from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";

type StepId = 1 | 2 | 3;
const STEPS: { id: StepId; label: string }[] = [
  { id: 1, label: "Timetable" },
  { id: 2, label: "Admit Cards" },
  { id: 3, label: "Seat Plan" },
];

const DAYS = [
  { label: "MON", n: 14, exams: 6, conflictKey: null },
  { label: "TUE", n: 15, exams: 8, conflictKey: null },
  { label: "WED", n: 16, exams: 7, conflictKey: "room" as const },
  { label: "THU", n: 17, exams: 6, conflictKey: null },
  { label: "FRI", n: 18, exams: 5, conflictKey: "iyer" as const },
  { label: "SAT", n: 19, exams: 7, conflictKey: null },
  { label: "SUN", n: 20, exams: 0, conflictKey: null },
  { label: "MON", n: 21, exams: 8, conflictKey: null },
];

interface ScheduleRow {
  id: string; date: string; subject: string; cls: string; room: string; invigilator: string; marks: string;
  conflictKey: "room" | "iyer" | null;
}

const BASE_ROWS: ScheduleRow[] = [
  { id: "r1", date: "Sep 14 · 9:00–11:00", subject: "Mathematics", cls: "Grade 8A", room: "Room 101", invigilator: "Mr. Rao", marks: "80 / 26", conflictKey: null },
  { id: "r2", date: "Sep 16 · 10:00–12:00", subject: "Science", cls: "Grade 8B", room: "Room 204", invigilator: "Mr. Sharma", marks: "80 / 26", conflictKey: "room" },
  { id: "r3", date: "Sep 16 · 10:00–12:00", subject: "Mathematics", cls: "Grade 9A", room: "Room 204", invigilator: "Ms. Iyer", marks: "80 / 26", conflictKey: "room" },
  { id: "r4", date: "Sep 17 · 9:00–11:00", subject: "English", cls: "Grade 8A", room: "Room 101", invigilator: "Mrs. Fernandes", marks: "80 / 26", conflictKey: null },
  { id: "r5", date: "Sep 18 · 9:00–11:00", subject: "Social Science", cls: "Grade 6C", room: "Room 205", invigilator: "Ms. Iyer", marks: "80 / 26", conflictKey: "iyer" },
];

const STUDENTS = [
  { id: "s1", name: "Ananya Rao", cls: "Grade 8A", room: "Room 101" },
  { id: "s2", name: "Kabir Malhotra", cls: "Grade 8A", room: "Room 101" },
  { id: "s3", name: "Zara Sheikh", cls: "Grade 8A", room: "Room 101" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.ink2 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.purple, display: "inline-block" }} />
      {children}
    </div>
  );
}

function Chip({ label, checked, onToggle }: { label: string; checked: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle}
      style={{
        display: "flex", alignItems: "center", gap: 6, height: 32, padding: "0 12px",
        borderRadius: 999, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
        border: `1px solid ${checked ? T.purple : T.borderStrong}`,
        background: checked ? T.purpleSoft : "#fff",
        color: checked ? T.purple : T.ink2,
      }}
    >
      <span style={{
        width: 14, height: 14, borderRadius: 4, border: `1.5px solid ${checked ? T.purple : T.borderStrong}`,
        background: checked ? T.purple : "#fff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}>
        {checked && <Check size={10} color="#fff" strokeWidth={3} />}
      </span>
      {label}
    </button>
  );
}

export default function ScheduleLogisticsPage() {
  const [step, setStep] = useState<StepId>(1);
  const [roomConflict, setRoomConflict] = useState(true);
  const [iyerConflict, setIyerConflict] = useState(true);
  const [admitFields, setAdmitFields] = useState({
    photo: true, name: true, admissionNo: true, classSection: true, examName: true, ayLabel: false,
  });
  const [seatFields, setSeatFields] = useState({ school: true, roll: true, photo: true, seatLabel: false });
  const [generatedAdmit, setGeneratedAdmit] = useState<Set<string>>(new Set(["s1"]));
  const [generatedSeat, setGeneratedSeat] = useState<Set<string>>(new Set(["s1"]));

  const conflictCount = (roomConflict ? 1 : 0) + (iyerConflict ? 1 : 0);
  const rows = BASE_ROWS.map((r) => ({
    ...r,
    isConflict: (r.conflictKey === "room" && roomConflict) || (r.conflictKey === "iyer" && iyerConflict),
  }));

  return (
    <div style={{ minHeight: "100%", background: T.page, padding: "12px 20px 40px" }}>
      <div style={{ background: T.card, border: `1px solid ${T.cardBorder}`, borderRadius: 16, padding: 24 }}>
        {/* Breadcrumb */}
        <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, marginBottom: 12 }}>
          <Link href="/dashboard" style={{ color: T.ink2, textDecoration: "none" }}>Dashboard</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <Link href="/exams/command-center" style={{ color: T.ink2, textDecoration: "none" }}>Examinations</Link>
          <span style={{ color: T.ink3 }}>/</span>
          <span style={{ color: T.ink1, fontWeight: 600 }}>Schedule & Logistics</span>
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
          <Eyebrow>Schedule & Logistics · Half-Yearly Examination</Eyebrow>
          <h1 style={{ margin: "6px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 30 }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, color: T.ink1 }}>The part that&apos;s</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, color: T.purple }}>
              different every time.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, maxWidth: 640, margin: "0 0 14px" }}>
            Dates, rooms and invigilators change every cycle even when the exam pattern doesn&apos;t.
            Admit cards and seating both build off this timetable.
          </p>

          <div style={{ display: "flex", gap: 8 }}>
            {STEPS.map((s) => {
              const done = s.id < step;
              const active = s.id === step;
              return (
                <button
                  key={s.id} type="button" onClick={() => setStep(s.id)}
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
                  Step {s.id} · {s.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Header card */}
        <div style={{
          display: "flex", alignItems: "center", gap: 14, background: "#fff",
          border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16,
        }}>
          <div style={{ width: 36, height: 36, borderRadius: 10, background: T.purpleSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Calendar size={16} color={T.purple} strokeWidth={2} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink1 }}>Half-Yearly Examination</div>
            <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>Grades 6-9 · 11 sections · Sep 14–21, 2026</div>
          </div>
          {step === 1 && (
            <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
              <button type="button" style={{
                display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 9,
                border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 12.5, fontWeight: 600, cursor: "pointer",
              }}>
                View schedule report <ExternalLink size={12} />
              </button>
              <button type="button" style={{
                display: "flex", alignItems: "center", gap: 6, height: 36, padding: "0 14px", borderRadius: 9,
                border: `1px solid ${T.purple}`, background: T.purple, color: "#fff", fontSize: 12.5, fontWeight: 700, cursor: "pointer",
              }}>
                <Plus size={13} /> Assign new slot
              </button>
            </div>
          )}
        </div>

        {step === 1 && (
          <>
            {conflictCount > 0 && (
              <div style={{
                display: "flex", alignItems: "center", gap: 12, background: T.dangerSoft,
                border: `1px solid ${T.danger}44`, borderRadius: 12, padding: "12px 16px", marginBottom: 14,
              }}>
                <AlertTriangle size={16} color={T.danger} strokeWidth={2} style={{ flexShrink: 0 }} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: T.danger }}>
                  {conflictCount} conflict{conflictCount > 1 ? "s" : ""} need attention
                </div>
                <button
                  type="button" onClick={() => { setRoomConflict(false); setIyerConflict(false); }}
                  style={{
                    height: 34, padding: "0 14px", borderRadius: 8, border: `1px solid ${T.danger}`,
                    background: T.danger, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", flexShrink: 0,
                  }}
                >
                  Auto-resolve all
                </button>
              </div>
            )}

            {(roomConflict || iyerConflict) && (
              <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 16, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 700, color: T.ink1, marginBottom: 10 }}>
                  <Star size={14} color={T.purple} strokeWidth={2} /> Suggested fixes
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {roomConflict && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: T.hoverSoft }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink1 }}>
                          Room 204, Sep 16, 10:00–12:00 — Grade 8B Science and Grade 9A Mathematics are both booked here.
                        </div>
                        <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>Room 203 is free at that time and fits Grade 9A.</div>
                      </div>
                      <button
                        type="button" onClick={() => setRoomConflict(false)}
                        style={{ height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                      >
                        Apply fix
                      </button>
                    </div>
                  )}
                  {iyerConflict && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 10, background: T.hoverSoft }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: T.ink1 }}>
                          Ms. Iyer, Sep 18, 9:00 AM — assigned to invigilate two rooms in the same slot.
                        </div>
                        <div style={{ fontSize: 11.5, color: T.ink3, marginTop: 2 }}>Mr. Khan has no exam duty at that time.</div>
                      </div>
                      <button
                        type="button" onClick={() => setIyerConflict(false)}
                        style={{ height: 32, padding: "0 12px", borderRadius: 8, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 12, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}
                      >
                        Apply fix
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Day picker */}
            <div style={{ display: "flex", gap: 8, marginBottom: 16, overflowX: "auto" }}>
              {DAYS.map((d, i) => {
                const conflict = (d.conflictKey === "room" && roomConflict) || (d.conflictKey === "iyer" && iyerConflict);
                return (
                  <div
                    key={i}
                    style={{
                      minWidth: 62, textAlign: "center", padding: "8px 4px", borderRadius: 10,
                      border: `1px solid ${conflict ? T.danger : T.border}`,
                      background: conflict ? T.dangerSoft : "#fff", flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: 10, fontWeight: 700, color: conflict ? T.danger : T.ink3 }}>{d.label}</div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: conflict ? T.danger : T.ink1 }}>{d.n}</div>
                    <div style={{ fontSize: 10, color: conflict ? T.danger : T.ink3, marginTop: 2 }}>
                      {d.exams > 0 ? `${d.exams} exams` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Schedule table */}
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr 1fr 0.8fr", gap: 8, padding: "10px 16px", fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", borderBottom: `1px solid ${T.border}` }}>
                <span>Date & time</span><span>Subject</span><span>Class</span><span>Room</span><span>Invigilator</span><span>Marks</span>
              </div>
              {rows.map((r) => (
                <div
                  key={r.id}
                  style={{
                    display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr 1fr 0.8fr", gap: 8,
                    padding: "12px 16px", fontSize: 12.5, color: T.ink1,
                    background: r.isConflict ? T.dangerSoft : "#fff",
                    borderBottom: `1px solid ${T.border}`,
                  }}
                >
                  <span>{r.date}</span>
                  <span>{r.subject}</span>
                  <span>{r.cls}</span>
                  <span style={{ color: r.isConflict ? T.danger : T.ink1, fontWeight: r.isConflict ? 700 : 400 }}>{r.room}</span>
                  <span style={{ color: r.isConflict && r.conflictKey === "iyer" ? T.danger : T.ink1, fontWeight: r.isConflict && r.conflictKey === "iyer" ? 700 : 400 }}>{r.invigilator}</span>
                  <span>{r.marks}</span>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.purpleSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <CreditCard size={16} color={T.purple} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink1 }}>Admit Cards</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>Generated straight from the timetable above — nothing to re-enter.</div>
              </div>
            </div>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Include on the card
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                <Chip label="Student photo" checked={admitFields.photo} onToggle={() => setAdmitFields((f) => ({ ...f, photo: !f.photo }))} />
                <Chip label="Student name" checked={admitFields.name} onToggle={() => setAdmitFields((f) => ({ ...f, name: !f.name }))} />
                <Chip label="Admission no." checked={admitFields.admissionNo} onToggle={() => setAdmitFields((f) => ({ ...f, admissionNo: !f.admissionNo }))} />
                <Chip label="Class & section" checked={admitFields.classSection} onToggle={() => setAdmitFields((f) => ({ ...f, classSection: !f.classSection }))} />
                <Chip label="Exam name" checked={admitFields.examName} onToggle={() => setAdmitFields((f) => ({ ...f, examName: !f.examName }))} />
                <Chip label="Academic year label" checked={admitFields.ayLabel} onToggle={() => setAdmitFields((f) => ({ ...f, ayLabel: !f.ayLabel }))} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 4px 8px" }}>
                <span>Student</span><span>Class</span><span>Status</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {STUDENTS.map((s) => {
                  const done = generatedAdmit.has(s.id);
                  return (
                    <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, padding: "8px 4px", fontSize: 13, color: T.ink1, borderTop: `1px solid ${T.border}` }}>
                      <span>{s.name}</span>
                      <span>{s.cls}</span>
                      <span>
                        {done
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: T.ok, background: T.okSoft, borderRadius: 999, padding: "3px 10px" }}>Already generated</span>
                          : <span style={{ fontSize: 12, color: T.ink3 }}>Not yet generated</span>}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button" onClick={() => setGeneratedAdmit(new Set(STUDENTS.map((s) => s.id)))}
                style={{ marginTop: 16, height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${T.ok}`, background: T.ok, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Generate Admit Cards
              </button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: "16px 18px", marginBottom: 16 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: T.purpleSoft, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <Grid3x3 size={16} color={T.purple} strokeWidth={2} />
              </div>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: T.ink1 }}>Seat Plan</div>
                <div style={{ fontSize: 12, color: T.ink2, marginTop: 2 }}>Rooms come from the timetable — assign seats within them.</div>
              </div>
            </div>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 8 }}>
                Include on the seating chart
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                <Chip label="School name" checked={seatFields.school} onToggle={() => setSeatFields((f) => ({ ...f, school: !f.school }))} />
                <Chip label="Roll no." checked={seatFields.roll} onToggle={() => setSeatFields((f) => ({ ...f, roll: !f.roll }))} />
                <Chip label="Student photo" checked={seatFields.photo} onToggle={() => setSeatFields((f) => ({ ...f, photo: !f.photo }))} />
                <Chip label="Seat number label" checked={seatFields.seatLabel} onToggle={() => setSeatFields((f) => ({ ...f, seatLabel: !f.seatLabel }))} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", padding: "0 4px 8px" }}>
                <span>Student</span><span>Room</span><span>Status</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {STUDENTS.map((s) => {
                  const done = generatedSeat.has(s.id);
                  return (
                    <div key={s.id} style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 8, padding: "8px 4px", fontSize: 13, color: T.ink1, borderTop: `1px solid ${T.border}` }}>
                      <span>{s.name}</span>
                      <span>{s.room}</span>
                      <span>
                        {done
                          ? <span style={{ fontSize: 11, fontWeight: 700, color: T.ok, background: T.okSoft, borderRadius: 999, padding: "3px 10px" }}>Already generated</span>
                          : <span style={{ fontSize: 12, color: T.ink3 }}>Not yet generated</span>}
                      </span>
                    </div>
                  );
                })}
              </div>

              <button
                type="button" onClick={() => setGeneratedSeat(new Set(STUDENTS.map((s) => s.id)))}
                style={{ marginTop: 16, height: 40, padding: "0 18px", borderRadius: 10, border: `1px solid ${T.ok}`, background: T.ok, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
              >
                Generate Seat Plan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
