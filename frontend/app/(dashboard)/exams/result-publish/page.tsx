"use client";
/**
 * Examination › Results & Reports — "after marks are in" group: report-card
 * setup, then a single publish gate per class/section (readiness checklist +
 * moderation queue + merit list + per-student report). Wired to the real
 * backend (apps/exams/views.py — the ExamResultPublish*, ReportCardSetting
 * and ExamResultModerationFlag view classes) via hooks/useExamsApi.ts —
 * replaces the earlier static mockup. Palette from lib/examTheme.ts.
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, ClipboardList, Users, FileText, Check, AlertTriangle, Award,
} from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";
import { Accordion, Badge, ExamPicker, StepPills, type Tone } from "@/components/exams/ExamUi";
import {
  approveModerationFlag,
  ExamsApiError,
  rejectModerationFlag,
  saveReportCardSetting,
  searchExamMerit,
  searchExamResultPublish,
  signoffExamResultPublish,
  storeExamResultPublish,
  useExamGradeScaleGroups,
  useExamMarksProgress,
  useExamResultPublishCriteria,
  useModerationFlags,
  useReportCardSetting,
} from "@/hooks/useExamsApi";
import type { MeritListRow, ReportCardSetting } from "@/types/exams";

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", color: T.ink2 }}>
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: T.purple, display: "inline-block" }} />
      {children}
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

const selectSx: React.CSSProperties = {
  height: 34, borderRadius: 8, border: `1px solid ${T.borderStrong}`,
  padding: "0 10px", fontSize: 12.5, color: T.ink1, background: "#fff", outline: "none",
};

function gradeToneFor(g: string): Tone {
  return g.startsWith("A") ? "ok" : g.startsWith("B") ? "info" : g.startsWith("C") ? "warn" : "danger";
}

export default function ResultsAndReportsPage() {
  const { data: criteria } = useExamResultPublishCriteria();
  const [examTitle, setExamTitle] = useState("");
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (!examTitle && criteria?.exams.length) setExamTitle(criteria.exams[0].title);
  }, [criteria, examTitle]);
  const examId = criteria?.exams.find((e) => e.title === examTitle)?.id ?? null;

  // ─── Step 1: report card setup ────────────────────────────────────────────
  const { data: settingData, refetch: refetchSetting } = useReportCardSetting();
  const setting = settingData?.setting;
  const { data: scaleGroups } = useExamGradeScaleGroups();
  const defaultScale = scaleGroups?.results.find((g) => g.is_default) ?? scaleGroups?.results[0];

  const patchSetting = async (patch: Partial<ReportCardSetting>) => {
    await saveReportCardSetting(patch);
    await refetchSetting();
  };

  // ─── Step 2: publish ──────────────────────────────────────────────────────
  const [classId, setClassId] = useState<number | null>(null);
  const [sectionId, setSectionId] = useState<number | null>(null);
  useEffect(() => {
    if (!criteria) return;
    if (classId === null && criteria.classes.length) setClassId(criteria.classes[0].id);
  }, [criteria, classId]);
  const sectionsForClass = useMemo(() => (criteria?.sections ?? []).filter((s) => s.class_id === classId), [criteria, classId]);
  useEffect(() => {
    if (!sectionsForClass.length) { setSectionId(null); return; }
    if (!sectionsForClass.some((s) => s.id === sectionId)) setSectionId(sectionsForClass[0].id);
  }, [sectionsForClass, sectionId]);

  const [readiness, setReadiness] = useState<{
    total_mark_entries: number; is_published: boolean; published_at: string | null;
    principal_signoff: boolean; pending_moderation_count: number;
  } | null>(null);
  const [readinessLoading, setReadinessLoading] = useState(false);
  const { data: progress } = useExamMarksProgress(examId, classId ?? undefined, sectionId ?? undefined);

  const reloadReadiness = () => {
    if (!examId || !classId) return;
    setReadinessLoading(true);
    searchExamResultPublish({ exam: examId, class_id: classId, section: sectionId ?? undefined })
      .then((res) => setReadiness(res))
      .catch(() => setReadiness(null))
      .finally(() => setReadinessLoading(false));
  };
  useEffect(reloadReadiness, [examId, classId, sectionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: flagsData, refetch: refetchFlags } = useModerationFlags({
    exam_term: examId ?? undefined, school_class: classId ?? undefined, section: sectionId ?? undefined, status: "pending",
  });
  const flags = flagsData?.results ?? [];

  const [merit, setMerit] = useState<MeritListRow[]>([]);
  useEffect(() => {
    if (!examId || !classId) { setMerit([]); return; }
    searchExamMerit({ exam: examId, class_id: classId, section: sectionId ?? undefined })
      .then((res) => setMerit(res.merit_list))
      .catch(() => setMerit([]));
  }, [examId, classId, sectionId]);

  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [signingOff, setSigningOff] = useState(false);

  const marksComplete = !!progress && progress.total_expected > 0 && progress.percent >= 100;
  const moderationClear = (readiness?.pending_moderation_count ?? 0) === 0;
  const signedOff = !!readiness?.principal_signoff;
  const checksDone = [marksComplete, moderationClear, signedOff].filter(Boolean).length;
  const allChecksDone = marksComplete && moderationClear && signedOff;

  const handleSignoff = async () => {
    if (!examId || !classId) return;
    setSigningOff(true);
    try {
      await signoffExamResultPublish({ exam_id: examId, class_id: classId, section_id: sectionId });
      reloadReadiness();
    } finally {
      setSigningOff(false);
    }
  };

  const handleApprove = async (id: number) => { await approveModerationFlag(id); await refetchFlags(); reloadReadiness(); };
  const handleReject = async (id: number) => { await rejectModerationFlag(id); await refetchFlags(); reloadReadiness(); };

  const handlePublish = async () => {
    if (!examId || !classId) return;
    setPublishing(true);
    setPublishError(null);
    try {
      await storeExamResultPublish({ exam_id: examId, class_id: classId, section_id: sectionId });
      reloadReadiness();
    } catch (e) {
      setPublishError(e instanceof ExamsApiError ? e.message : "Failed to publish.");
    } finally {
      setPublishing(false);
    }
  };

  const className = criteria?.classes.find((c) => c.id === classId)?.class_name ?? "";
  const sectionName = criteria?.sections.find((s) => s.id === sectionId)?.section_name ?? "";

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
          <Eyebrow>Results & Reports · {examTitle || "Loading…"}</Eyebrow>
          <h1 style={{ margin: "6px 0 6px", display: "flex", flexWrap: "wrap", alignItems: "baseline", gap: 8, fontSize: 30 }}>
            <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, color: T.ink1 }}>One gate</span>
            <span style={{ fontFamily: '"Playfair Display", Georgia, serif', fontStyle: "italic", fontWeight: 500, color: T.purple }}>
              before results go live.
            </span>
          </h1>
          <p style={{ fontSize: 13, color: T.ink2, lineHeight: 1.6, maxWidth: 640, margin: "0 0 14px" }}>
            Marks entered, moderation cleared, principal signed off — then publish once.
          </p>
        </div>

        <ExamPicker
          icon={ClipboardList} value={examTitle} onChange={setExamTitle}
          options={(criteria?.exams ?? []).map((e) => e.title)}
          note="Switching here switches Conduct & Marks too — one exam in focus at a time, everywhere."
        />

        <div style={{ marginBottom: 16 }}>
          <StepPills step={step} setStep={setStep} steps={["Report Card Setup", "Publish"]} />
        </div>

        {step === 1 ? (
          <div style={{ display: "grid", gridTemplateColumns: "minmax(260px, 0.8fr) minmax(360px, 1.6fr)", gap: 18, alignItems: "start" }}>
            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.ink1, marginBottom: 4 }}>Who can see report cards?</div>
              {setting && (
                <>
                  <ToggleRow label="Class Teacher" sub="Complete their own only" on={setting.visible_to_class_teacher} onChange={(v) => patchSetting({ visible_to_class_teacher: v })} />
                  <ToggleRow label="Subject Teacher" sub="Marks entry only" on={setting.visible_to_subject_teacher} onChange={(v) => patchSetting({ visible_to_subject_teacher: v })} />
                  <ToggleRow label="Admin" sub="Automatically always" on disabled onChange={() => {}} />
                </>
              )}
            </div>

            <div style={{ background: "#fff", border: `1px solid ${T.border}`, borderRadius: 14, padding: 18 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: T.ink1, marginBottom: 12 }}>Report card structure</div>

              {setting && (
                <>
                  <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Template</div>
                  <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
                    {([["cbse", "CBSE style"], ["icse", "ICSE style"], ["cambridge", "Cambridge style"], ["ib", "IB style"]] as const).map(([key, label]) => (
                      <button
                        key={key} type="button" onClick={() => patchSetting({ template: key })}
                        style={{
                          height: 32, padding: "0 12px", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                          border: `1px solid ${setting.template === key ? T.purple : T.borderStrong}`,
                          background: setting.template === key ? T.purpleSoft : "#fff",
                          color: setting.template === key ? T.purple : T.ink2,
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Sections included</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
                    {([
                      ["include_photo", "Student photo"], ["include_co_scholastic", "Co-scholastic attendance"], ["include_attendance", "Attendance summary"],
                      ["include_comments", "Subject teacher comments"], ["include_overall_notes", "Overall performance notes"], ["include_improvement", "Scope for improvement"],
                    ] as const).map(([key, label]) => {
                      const on = setting[key];
                      return (
                        <button
                          key={key} type="button" onClick={() => patchSetting({ [key]: !on } as Partial<ReportCardSetting>)}
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
                    Grading scale referenced: <strong style={{ color: T.ink1 }}>{defaultScale?.name ?? "Not configured yet"}</strong> ·{" "}
                    <Link href="/exams/exam-type" style={{ color: T.purple, fontWeight: 600, textDecoration: "none" }}>Change scale</Link>
                  </div>

                  <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 6 }}>Moderation workflow</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {([
                      ["as_you_go", "As-you-go", "Flag & moderate as marks come in"],
                      ["bulk", "Bulk", "Moderate all at once, right before publish"],
                      ["custom", "Custom…", "Set your own rule per exam type"],
                    ] as const).map(([key, label, sub]) => (
                      <button
                        key={key} type="button" onClick={() => patchSetting({ moderation_workflow: key })}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 9, cursor: "pointer",
                          border: `1px solid ${setting.moderation_workflow === key ? T.purple : T.border}`,
                          background: setting.moderation_workflow === key ? T.purpleSoft : "#fff", textAlign: "left",
                        }}
                      >
                        <span style={{
                          width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${setting.moderation_workflow === key ? T.purple : T.borderStrong}`,
                          flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          {setting.moderation_workflow === key && <span style={{ width: 7, height: 7, borderRadius: "50%", background: T.purple }} />}
                        </span>
                        <span>
                          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.ink1 }}>{label}</span>
                          <span style={{ fontSize: 11.5, color: T.ink3, marginLeft: 6 }}>— {sub}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
              <select style={selectSx} value={classId ?? ""} onChange={(e) => setClassId(Number(e.target.value))}>
                {(criteria?.classes ?? []).map((o) => <option key={o.id} value={o.id}>{o.class_name}</option>)}
              </select>
              <select style={selectSx} value={sectionId ?? ""} onChange={(e) => setSectionId(Number(e.target.value) || null)}>
                <option value="">All sections</option>
                {sectionsForClass.map((o) => <option key={o.id} value={o.id}>{o.section_name}</option>)}
              </select>
            </div>

            <Accordion
              title={`${className}-${sectionName || "All"}`}
              right={<Badge tone={allChecksDone ? "ok" : "warn"}>{checksDone} of 3 checks complete</Badge>}
              defaultOpen
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                {publishError && (
                  <div style={{ background: T.dangerSoft, color: T.danger, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600 }}>{publishError}</div>
                )}
                {readiness?.is_published && (
                  <div style={{ background: T.okSoft, color: T.ok, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600 }}>
                    Published{readiness.published_at ? ` on ${new Date(readiness.published_at).toLocaleString()}` : ""}.
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: 14, alignItems: "start" }}>
                  {/* Readiness checklist */}
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.ink1, marginBottom: 10 }}>
                      <Check size={13} color={T.purple} /> Publish readiness — {checksDone}/3 complete
                    </div>
                    {readinessLoading && <div style={{ fontSize: 12, color: T.ink3 }}>Loading…</div>}
                    {[
                      { label: "Marks entered for all subjects", sub: progress ? `${progress.total_entered}/${progress.total_expected}` : "", done: marksComplete },
                      { label: "Moderation review complete", sub: moderationClear ? "all clear" : `${readiness?.pending_moderation_count ?? 0} flagged`, done: moderationClear },
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
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                      <span style={{
                        width: 16, height: 16, borderRadius: 4, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                        background: signedOff ? T.ok : "#fff", border: `1.5px solid ${signedOff ? T.ok : T.borderStrong}`,
                      }}>
                        {signedOff && <Check size={10} color="#fff" strokeWidth={3} />}
                      </span>
                      <span style={{ fontSize: 12.5, color: signedOff ? T.ink1 : T.ink2, flex: 1 }}>Principal sign-off</span>
                      {!signedOff && (
                        <button type="button" onClick={handleSignoff} disabled={signingOff} style={{ height: 26, padding: "0 8px", borderRadius: 6, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 11, fontWeight: 600, cursor: "pointer" }}>
                          {signingOff ? "Signing…" : "Sign off"}
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
                              <div style={{ fontSize: 12, fontWeight: 700, color: T.ink1 }}>{f.student_name}</div>
                              <div style={{ fontSize: 11, color: T.ink2 }}>{f.reason}{f.detail ? ` — ${f.detail}` : ""}</div>
                            </div>
                            <button type="button" onClick={() => void handleApprove(f.id)} style={{ height: 28, padding: "0 10px", borderRadius: 7, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.ink1, fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                              Approve
                            </button>
                            <button type="button" onClick={() => void handleReject(f.id)} style={{ height: 28, padding: "0 10px", borderRadius: 7, border: `1px solid ${T.borderStrong}`, background: "#fff", color: T.danger, fontSize: 11.5, fontWeight: 600, cursor: "pointer", flexShrink: 0 }}>
                              Reject
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Merit list + student list */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.ink1, marginBottom: 10 }}>
                      <Award size={13} color={T.purple} /> Merit list — top 3
                    </div>
                    {merit.slice(0, 3).map((m) => (
                      <div key={m.student_id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "6px 0" }}>
                        <span style={{ width: 20, height: 20, borderRadius: "50%", background: T.purpleSoft, color: T.purple, fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{m.position}</span>
                        <span style={{ fontSize: 12.5, color: T.ink1, flex: 1 }}>{m.student_name} · {m.roll_no}</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: T.ok }}>{m.total_marks}</span>
                      </div>
                    ))}
                    {merit.length === 0 && <div style={{ fontSize: 12, color: T.ink3 }}>No marks entered yet.</div>}
                  </div>
                  <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 14 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: T.ink1, marginBottom: 10 }}>
                      <Users size={13} color={T.purple} /> Students in this section ({merit.length})
                    </div>
                    <div style={{ maxHeight: 220, overflowY: "auto" }}>
                      {merit.map((s) => (
                        <div key={s.student_id} style={{ display: "grid", gridTemplateColumns: "1.5fr 70px 60px", gap: 8, alignItems: "center", padding: "6px 0", borderTop: `1px solid ${T.border}`, fontSize: 12.5, color: T.ink1 }}>
                          <span>{s.student_name}</span>
                          <span style={{ color: T.ink2 }}>{s.total_marks}</span>
                          <span><Badge tone={gradeToneFor(Number(s.average_gpa) >= 8 ? "A" : Number(s.average_gpa) >= 6 ? "B" : "C")}>{s.average_gpa}</Badge></span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Publish gate */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
                  borderRadius: 10, padding: "12px 16px",
                  background: allChecksDone ? T.okSoft : T.warnSoft,
                }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: allChecksDone ? T.ok : T.warn }}>
                    {readiness?.is_published
                      ? "Already published."
                      : allChecksDone
                        ? "All checks complete — ready to publish."
                        : `${3 - checksDone} check(s) remaining before this section can publish.`}
                  </span>
                  <button
                    type="button" disabled={!allChecksDone || !!readiness?.is_published || publishing} onClick={handlePublish}
                    style={{
                      height: 38, padding: "0 18px", borderRadius: 9, border: "none",
                      background: allChecksDone && !readiness?.is_published ? T.purple : T.borderStrong,
                      color: allChecksDone && !readiness?.is_published ? "#fff" : T.ink3, fontSize: 12.5, fontWeight: 700,
                      cursor: allChecksDone && !readiness?.is_published ? "pointer" : "not-allowed", whiteSpace: "nowrap",
                    }}
                  >
                    {readiness?.is_published ? "Published ✓" : publishing ? "Publishing…" : "Publish results"}
                  </button>
                </div>

                {/* Downstream status cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
                  {[
                    { label: "Student Report", ready: !!readiness?.is_published },
                    { label: "Merit Report", ready: !!readiness?.is_published },
                    { label: "Admit Card & Seat Plan", ready: null },
                  ].map((c) => (
                    <div key={c.label} style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: "12px 10px", textAlign: "center" }}>
                      <FileText size={16} color={c.ready ? T.ok : T.ink3} style={{ margin: "0 auto 6px" }} />
                      <div style={{ fontSize: 11.5, fontWeight: 700, color: T.ink1 }}>{c.label}</div>
                      <div style={{ fontSize: 10.5, color: c.ready ? T.ok : T.ink3, marginTop: 2 }}>
                        {c.ready === null ? "Managed in Schedule & Logistics" : c.ready ? "Ready" : "Pending"}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </Accordion>
          </>
        )}
      </div>
    </div>
  );
}
