"use client";
/**
 * Examination › Exam Configuration — "set once, rarely changes" group. Wired
 * to the real backend (apps/exams/views.py — ExamTypeViewSet extended with
 * counts_to_average/weight_percent, plus the new ExamGradeScaleGroupViewSet /
 * ExamGradeScaleViewSet for named, style-scoped grading scales) via
 * hooks/useExamsApi.ts — replaces the earlier static mockup. Edits are kept
 * in local state and diffed against the server on "Save configuration",
 * same pattern as exams/setup/page.tsx. Palette from lib/examTheme.ts.
 */
import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Star, TrendingUp, Trash2, Plus } from "lucide-react";
import { examTheme as T } from "@/lib/examTheme";
import {
  createExamType,
  createGradeScaleBand,
  createGradeScaleGroup,
  deleteExamType,
  deleteGradeScaleBand,
  ExamsApiError,
  updateExamType,
  updateGradeScaleGroup,
  useExamGradeScaleBands,
  useExamGradeScaleGroups,
  useExamTypes,
} from "@/hooks/useExamsApi";
import type { ExamGradeScaleGroup, ExamType, GradeScaleStyle } from "@/types/exams";

interface ExamTypeRow { id: string; serverId: number | null; name: string; countsToAvg: boolean; weight: string }
interface GradeRow { id: string; serverId: number | null; label: string; min: string; max: string; points: string; fail: boolean }

const STYLE_DEFAULT_NAME: Record<GradeScaleStyle, string> = {
  percentage: "Percentage Scale",
  letter: "Letter Grade Scale",
  gpa: "GPA Scale",
};

function toRow(t: ExamType): ExamTypeRow {
  return { id: String(t.id), serverId: t.id, name: t.title, countsToAvg: t.counts_to_average, weight: t.weight_percent };
}

function toGradeRow(g: { id: number; name: string; min_percent: string; max_percent: string; gpa: string; is_fail: boolean }): GradeRow {
  return { id: String(g.id), serverId: g.id, label: g.name, min: g.min_percent, max: g.max_percent, points: g.gpa, fail: g.is_fail };
}

// Mirrors the backend's inclusive-range overlap check (apps/exams/serializers.py
// ExamGradeScaleSerializer.validate) so a conflict — e.g. two bands left at the
// "Add grade band" default of 0-0 — is reported with the offending band names
// instead of surfacing the generic 400 from the API.
function findOverlappingBandPair(rows: GradeRow[]): [GradeRow, GradeRow] | null {
  const named = rows.filter((r) => r.label.trim());
  for (let i = 0; i < named.length; i++) {
    for (let j = i + 1; j < named.length; j++) {
      const a = named[i];
      const b = named[j];
      const aMin = Number(a.min || "0");
      const aMax = Number(a.max || "0");
      const bMin = Number(b.min || "0");
      const bMax = Number(b.max || "0");
      if (aMin <= bMax && aMax >= bMin) return [a, b];
    }
  }
  return null;
}

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
  const add = () => setRows((r) => [...r, { id: `new-${Date.now()}`, serverId: null, label: "", min: "0", max: "0", points: "", fail: false }]);

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
          <input style={{ ...inputSx, textAlign: "center" }} value={row.min} onChange={(e) => update(row.id, { min: e.target.value.replace(/[^0-9.]/g, "") })} />
          <input style={{ ...inputSx, textAlign: "center" }} value={row.max} onChange={(e) => update(row.id, { max: e.target.value.replace(/[^0-9.]/g, "") })} />
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
  const { data: examTypesData, refetch: refetchExamTypes } = useExamTypes();
  const { data: groupsData, refetch: refetchGroups } = useExamGradeScaleGroups();

  const [examTypes, setExamTypes] = useState<ExamTypeRow[]>([]);
  const [markingStyle, setMarkingStyle] = useState<GradeScaleStyle>("letter");
  const [scaleName, setScaleName] = useState("");
  const [minPassPct, setMinPassPct] = useState("33");
  const [gradeRows, setGradeRows] = useState<GradeRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    if (examTypesData) setExamTypes(examTypesData.results.map(toRow));
  }, [examTypesData]);

  const groups = groupsData?.results ?? [];
  const activeGroup: ExamGradeScaleGroup | undefined = groups.find((g) => g.style === markingStyle);

  // Ensure a group exists for the currently-selected style so band edits always have somewhere to attach.
  useEffect(() => {
    if (!groupsData) return;
    if (activeGroup) return;
    void createGradeScaleGroup({ name: STYLE_DEFAULT_NAME[markingStyle], style: markingStyle, is_default: groups.length === 0 }).then(() => refetchGroups());
  }, [groupsData, activeGroup, markingStyle, groups.length, refetchGroups]);

  useEffect(() => {
    if (activeGroup) { setScaleName(activeGroup.name); setMinPassPct(activeGroup.min_pass_percent); }
  }, [activeGroup?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: bandsData, refetch: refetchBands } = useExamGradeScaleBands(activeGroup?.id ?? null);
  useEffect(() => {
    if (bandsData) setGradeRows(bandsData.results.map(toGradeRow));
  }, [bandsData]);

  const updateType = (id: string, patch: Partial<ExamTypeRow>) =>
    setExamTypes((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeType = (id: string) => setExamTypes((rows) => rows.filter((r) => r.id !== id));
  const addType = () =>
    setExamTypes((rows) => [...rows, { id: `new-${Date.now()}`, serverId: null, name: "", countsToAvg: false, weight: "0" }]);

  const handleSave = async () => {
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const originalTypeIds = new Set((examTypesData?.results ?? []).map((t) => t.id));
      const keptTypeIds = new Set(examTypes.filter((r) => r.serverId).map((r) => r.serverId));
      for (const id of originalTypeIds) {
        if (!keptTypeIds.has(id)) await deleteExamType(id);
      }
      for (const row of examTypes) {
        if (!row.name.trim()) continue;
        const patch = { title: row.name.trim(), counts_to_average: row.countsToAvg, weight_percent: row.weight || "0" };
        if (row.serverId) await updateExamType(row.serverId, patch);
        else await createExamType(patch);
      }

      if (activeGroup) {
        if (activeGroup.name !== scaleName || activeGroup.min_pass_percent !== minPassPct) {
          await updateGradeScaleGroup(activeGroup.id, { name: scaleName || STYLE_DEFAULT_NAME[markingStyle], min_pass_percent: minPassPct });
        }

        if (markingStyle !== "percentage") {
          const overlap = findOverlappingBandPair(gradeRows);
          if (overlap) {
            throw new Error(`"${overlap[0].label.trim()}" and "${overlap[1].label.trim()}" have overlapping percentage ranges — adjust their Min %/Max % before saving.`);
          }

          // Delete all existing bands and recreate from scratch rather than updating
          // in place: the backend rejects a band whose new range overlaps any sibling's
          // *current* range, so updating boundary-adjacent bands one at a time (e.g.
          // narrowing band A while widening band B into the gap) spuriously fails
          // against the other band's still-old, not-yet-saved range. Bands aren't
          // referenced by id elsewhere (looked up by percentage at read time), so
          // recreating them is safe.
          for (const band of bandsData?.results ?? []) {
            await deleteGradeScaleBand(band.id);
          }
          for (const row of gradeRows) {
            if (!row.label.trim()) continue;
            const patch = {
              group: activeGroup.id,
              name: row.label.trim(),
              min_percent: row.min || "0",
              max_percent: row.max || "0",
              gpa: row.points || "0",
              is_fail: row.fail,
            };
            await createGradeScaleBand(patch);
          }
        }
      }

      await Promise.all([refetchExamTypes(), refetchGroups(), refetchBands()]);
      setSaveSuccess(true);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Failed to save configuration.");
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
            Name your own exam types, weight them however your report cards actually work, and build a
            grading scale from a blank table. Change it here once and every future Exam Setup inherits it.
          </p>
        </div>

        {saveError && (
          <div style={{ background: T.dangerSoft, color: T.danger, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>{saveError}</div>
        )}
        {saveSuccess && (
          <div style={{ background: T.okSoft, color: T.ok, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, fontWeight: 600, marginBottom: 14 }}>Configuration saved.</div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "minmax(320px, 1fr) minmax(420px, 1.35fr)", gap: 18, alignItems: "start" }}>
          {/* Exam types */}
          <SectionCard icon={Star} title="Exam types your school uses" subtitle="Add, rename or remove — weight and averaging apply wherever this exam type is referenced.">
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
                  onChange={(e) => updateType(row.id, { weight: e.target.value.replace(/[^0-9.]/g, "") })}
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
                  onChange={(e) => setMinPassPct(e.target.value.replace(/[^0-9.]/g, ""))}
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
                <input style={inputSx} value={scaleName} onChange={(e) => setScaleName(e.target.value)} />
                <p style={{ fontSize: 11.5, color: T.ink3, lineHeight: 1.5, margin: "8px 0 14px" }}>
                  Build the grade bands (e.g. A1–E2) this school actually uses — nothing is preset.
                </p>
                {gradeRowsEditor(gradeRows, setGradeRows, "Grade label", true)}
              </div>
            )}

            {markingStyle === "gpa" && (
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: T.ink3, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  Scale name
                </div>
                <input style={inputSx} value={scaleName} onChange={(e) => setScaleName(e.target.value)} />
                <p style={{ fontSize: 11.5, color: T.ink3, lineHeight: 1.5, margin: "8px 0 14px" }}>
                  No letter labels — the GPA value itself is what shows on the report card.
                </p>
                {gradeRowsEditor(gradeRows, setGradeRows, "GPA value", false)}
              </div>
            )}
          </SectionCard>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", marginTop: 20 }}>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            style={{
              height: 42, padding: "0 22px", borderRadius: 10, border: `1px solid ${T.purple}`,
              background: T.purple, color: "#fff", fontSize: 13.5, fontWeight: 700, cursor: saving ? "default" : "pointer",
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? "Saving…" : "Save configuration"}
          </button>
        </div>
      </div>
    </div>
  );
}
