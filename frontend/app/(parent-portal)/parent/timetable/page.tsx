"use client";

/**
 * Parent Portal — Timetable
 *
 * Weekly schedule for the selected child, grouped by day. Reuses the same
 * child-tabs / skeleton / error-banner shell as fees/page.tsx for visual
 * consistency across the portal.
 */

import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Clock } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildTimetable, type ChildTimetable, type TimetableSlotItem } from "@/lib/api/parent";

const DAY_ORDER = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
const DAY_LABEL: Record<string, string> = {
  monday: "Monday", tuesday: "Tuesday", wednesday: "Wednesday", thursday: "Thursday",
  friday: "Friday", saturday: "Saturday", sunday: "Sunday",
};

function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: string | number }) {
  return <div style={{ height: h, width: w, borderRadius: 8, background: "var(--bg-2)" }} />;
}

const SUBJECT_COLORS = [
  { bg: "#EEF2FF", text: "#4F46E5" }, { bg: "#F0FDF4", text: "#15803D" },
  { bg: "#FFF7ED", text: "#C2410C" }, { bg: "#FDF4FF", text: "#A21CAF" },
  { bg: "#ECFDF5", text: "#047857" }, { bg: "#EFF6FF", text: "#1D4ED8" },
];
function subjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash + name.charCodeAt(i)) % SUBJECT_COLORS.length;
  return SUBJECT_COLORS[hash];
}

export default function ParentTimetablePage() {
  const { children, selectedChild, setSelectedChildId, loading: ctxLoading } = useParentChild();
  const [data, setData] = useState<ChildTimetable | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    fetchChildTimetable(selectedChild.id).then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  }, [selectedChild?.id]);

  useEffect(() => { load(); }, [load]);

  const byDay = new Map<string, TimetableSlotItem[]>();
  (data?.slots ?? []).forEach((s) => {
    const key = s.day_of_week?.toLowerCase() ?? "";
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(s);
  });
  const days = DAY_ORDER.filter((d) => byDay.has(d));

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)" }}>
        <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          Weekly{" "}
          <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "#047857", fontSize: 38, letterSpacing: "-0.02em" }}>Timetable</em>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>Your child&rsquo;s class schedule, period by period.</p>
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
          Could not load the timetable. Please refresh.
        </div>
      )}

      {(loading || ctxLoading) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} h={110} />)}
        </div>
      ) : days.length === 0 ? (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <CalendarDays size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>No timetable published yet</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Check back once the school sets the class schedule.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {days.map((day) => (
            <div key={day} style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "10px 18px", background: "var(--bg-2)", borderBottom: "1px solid var(--bd)", fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>
                {DAY_LABEL[day] ?? day}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, padding: "14px 18px" }}>
                {byDay.get(day)!.map((slot, idx) => {
                  const color = subjectColor(slot.subject || "?");
                  return (
                    <div key={idx} style={{ minWidth: 150, border: "1px solid var(--bd)", borderRadius: 10, padding: "10px 12px", background: color.bg }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: color.text }}>{slot.subject || "—"}</div>
                      <div style={{ fontSize: 11.5, color: "var(--ink-2)", marginTop: 4, display: "flex", alignItems: "center", gap: 4 }}>
                        <Clock size={11} /> {slot.start_time ?? "—"}{slot.end_time ? `–${slot.end_time}` : ""}
                      </div>
                      {slot.teacher && <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{slot.teacher}</div>}
                      {slot.room && <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Room {slot.room}</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
