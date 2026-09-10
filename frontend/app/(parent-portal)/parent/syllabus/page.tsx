"use client";

/**
 * Parent Portal — Syllabus
 *
 * Topic-coverage view per subject: a progress bar (topics_done/total) plus
 * the underlying checklist, collapsed by default (mirrors the expandable
 * SubjectCard pattern from the teacher home screen).
 */

import { useCallback, useEffect, useState } from "react";
import { BookOpen, CheckCircle2, Circle } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildSyllabus, type SyllabusGroupItem } from "@/lib/api/parent";

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: "var(--bg-2)" }} />;
}

function SyllabusCard({ group }: { group: SyllabusGroupItem }) {
  const [expanded, setExpanded] = useState(false);
  const pct = group.topics_total > 0 ? Math.round((group.topics_done / group.topics_total) * 100) : 0;
  return (
    <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden" }}>
      <div onClick={() => setExpanded((e) => !e)} style={{ padding: "14px 18px", cursor: "pointer", display: "flex", alignItems: "center", gap: 14 }}>
        <div style={{ width: 38, height: 38, borderRadius: 10, background: "#FDF4FF", display: "grid", placeItems: "center", flex: "none" }}>
          <BookOpen size={17} color="#A21CAF" />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1)" }}>{group.subject}</div>
          <div style={{ fontSize: 12, color: "var(--ink-2)", marginTop: 2 }}>{group.lesson_name}</div>
        </div>
        <div style={{ textAlign: "right", flex: "none" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#A21CAF" }}>{group.topics_done}/{group.topics_total} topics</div>
          <div style={{ width: 90, height: 5, borderRadius: 3, background: "var(--bd)", marginTop: 5, overflow: "hidden" }}>
            <div style={{ width: `${pct}%`, height: "100%", background: "#A21CAF" }} />
          </div>
        </div>
      </div>
      {expanded && group.topics.length > 0 && (
        <div style={{ borderTop: "1px solid var(--bd)", padding: "12px 18px", display: "flex", flexDirection: "column", gap: 6 }}>
          {group.topics.map((t, idx) => {
            const done = t.status === "Completed";
            return (
              <div key={idx} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: done ? "var(--ink-2)" : "var(--ink-1)" }}>
                {done ? <CheckCircle2 size={14} color="var(--ok)" /> : <Circle size={14} color="var(--ink-3)" />}
                <span style={{ textDecoration: done ? "line-through" : "none" }}>{t.title}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function ParentSyllabusPage() {
  const { children, selectedChild, setSelectedChildId, loading: ctxLoading } = useParentChild();
  const [groups, setGroups] = useState<SyllabusGroupItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    fetchChildSyllabus(selectedChild.id).then(setGroups).catch(() => setError(true)).finally(() => setLoading(false));
  }, [selectedChild?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)" }}>
        <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          Syllabus{" "}
          <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "#A21CAF", fontSize: 38, letterSpacing: "-0.02em" }}>Coverage</em>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>How far each subject has progressed through its syllabus.</p>
      </div>

      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          {children.map((c) => {
            const sel = c.id === selectedChild?.id;
            const initials = c.name.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button key={c.id} onClick={() => setSelectedChildId(c.id)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 24, border: `1.5px solid ${sel ? "var(--pu)" : "var(--bd)"}`, background: sel ? "var(--pu-soft)" : "#fff", color: sel ? "var(--pu)" : "var(--ink-2)", fontSize: 13, fontWeight: sel ? 600 : 400, cursor: "pointer" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: sel ? "var(--pu)" : "var(--pu-soft)", color: sel ? "#fff" : "var(--pu)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>{initials}</div>
                <span>{c.name.split(" ")[0]}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "12px 16px", color: "#B91C1C", fontSize: 13, marginBottom: 20 }}>
          Could not load the syllabus. Please refresh.
        </div>
      )}

      {(loading || ctxLoading) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} h={70} />)}
        </div>
      ) : groups.length === 0 ? (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <BookOpen size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>No syllabus published yet</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Topic coverage will appear here once teachers start logging lessons.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {groups.map((g) => <SyllabusCard key={g.id} group={g} />)}
        </div>
      )}
    </div>
  );
}
