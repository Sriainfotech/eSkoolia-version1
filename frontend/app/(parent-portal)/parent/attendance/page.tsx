"use client";

import { useEffect, useState, useCallback } from "react";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import {
  fetchAttendanceCalendar,
  type AttendanceCalendar,
  type AttendanceDay,
} from "@/lib/api/parent";

// ── Constants ─────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  P: { label: "Present",  color: "var(--ok)",  bg: "rgba(34,197,94,0.12)" },
  A: { label: "Absent",   color: "#DC2626",     bg: "#FEF2F2" },
  L: { label: "Late",     color: "#D97706",     bg: "#FFFBEB" },
  F: { label: "Half Day", color: "var(--pu)",   bg: "var(--pu-soft)" },
  H: { label: "Holiday",  color: "#0284C7",     bg: "#F0F9FF" },
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function toYYYYMM(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

// ── Skeleton ──────────────────────────────────────────────────────────────────

function Skeleton({ h = 16, w = "100%" }: { h?: number; w?: string | number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: 8,
      backgroundImage: "linear-gradient(90deg,var(--line,#dbe4f0) 25%,var(--bg-2,#f5f5fb) 50%,var(--line,#dbe4f0) 75%)",
      backgroundSize: "200% 100%", animation: "shimmer 1.4s ease-in-out infinite",
    }} />
  );
}

// ── Calendar grid ─────────────────────────────────────────────────────────────

function CalendarGrid({
  year, month, days, holidays,
}: {
  year: number; month: number;
  days: AttendanceDay[];
  holidays: { date: string; title: string }[];
}) {
  const dayMap = new Map(days.map((d) => [d.date, d.type]));
  const holidayMap = new Map(holidays.map((h) => [h.date, h.title]));

  const firstDay = new Date(year, month - 1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();

  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div>
      {/* Weekday headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>
        {WEEKDAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--ink-3)", padding: "4px 0", letterSpacing: "0.05em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day cells */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
        {cells.map((day, i) => {
          if (!day) return <div key={i} />;
          const dateStr = `${year}-${String(month).padStart(2,"0")}-${String(day).padStart(2,"0")}`;
          const type = dayMap.get(dateStr);
          const holiday = holidayMap.get(dateStr);
          const cfg = type ? TYPE_CONFIG[type] : (holiday ? TYPE_CONFIG.H : null);
          const isToday = dateStr === new Date().toISOString().slice(0, 10);

          return (
            <div
              key={i}
              title={holiday ?? (type ? TYPE_CONFIG[type]?.label : undefined)}
              style={{
                aspectRatio: "1",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 8,
                background: cfg ? cfg.bg : "var(--bg-2)",
                border: isToday ? "2px solid var(--pu)" : "1px solid transparent",
                cursor: "default",
              }}
            >
              <span style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: cfg ? cfg.color : "var(--ink-3)" }}>
                {day}
              </span>
              {type && (
                <span style={{ fontSize: 8, fontWeight: 700, color: cfg?.color, lineHeight: 1, marginTop: 1 }}>
                  {type === "F" ? "½" : type}
                </span>
              )}
              {!type && holiday && (
                <span style={{ fontSize: 8, fontWeight: 700, color: TYPE_CONFIG.H.color, lineHeight: 1, marginTop: 1 }}>H</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AttendancePage() {
  const { children, selectedChild, setSelectedChildId, loading: ctxLoading } = useParentChild();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [data, setData] = useState<AttendanceCalendar | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    fetchAttendanceCalendar(selectedChild.id, toYYYYMM(year, month))
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [selectedChild?.id, year, month]);

  useEffect(() => { load(); }, [load]);

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1); }
    else setMonth(m => m + 1);
  }

  const att = data?.summary;
  const noData = !loading && !ctxLoading && data && data.days.length === 0 && data.holidays.length === 0;

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>

      {/* Header */}
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
            Attendance{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "var(--pu)", fontSize: 38, letterSpacing: "-0.02em" }}>
              Calendar
            </em>
          </h1>
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>
            Monthly attendance record — click a day to see details.
          </p>
        </div>
      </div>

      {/* Child tabs */}
      {children.length > 1 && (
        <div style={{ display: "flex", gap: 8, marginBottom: 22, flexWrap: "wrap" }}>
          {children.map((c) => {
            const sel = c.id === selectedChild?.id;
            const initials = c.name.split(" ").filter(Boolean).map(w => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button key={c.id} onClick={() => setSelectedChildId(c.id)}
                style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 16px", borderRadius: 24,
                  border: `1.5px solid ${sel ? "var(--pu)" : "var(--bd)"}`,
                  background: sel ? "var(--pu-soft)" : "#fff",
                  color: sel ? "var(--pu)" : "var(--ink-2)", fontSize: 13, fontWeight: sel ? 600 : 400, cursor: "pointer" }}>
                <div style={{ width: 20, height: 20, borderRadius: "50%", background: sel ? "var(--pu)" : "var(--pu-soft)", color: sel ? "#fff" : "var(--pu)", display: "grid", placeItems: "center", fontSize: 9, fontWeight: 700 }}>{initials}</div>
                <span>{c.name.split(" ")[0]}</span>
                {c.class_name && <span style={{ fontSize: 11, opacity: 0.7 }}>{c.class_name}</span>}
              </button>
            );
          })}
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 24, alignItems: "start" }}>

        {/* Calendar */}
        <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden" }}>

          {/* Month nav */}
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", justifyContent: "space-between", background: "var(--bg-2)" }}>
            <button onClick={prevMonth} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bd)", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <ChevronLeft size={14} color="var(--ink-2)" />
            </button>
            <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink-1)" }}>
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button onClick={nextMonth} style={{ width: 30, height: 30, borderRadius: 8, border: "1px solid var(--bd)", background: "#fff", cursor: "pointer", display: "grid", placeItems: "center" }}>
              <ChevronRight size={14} color="var(--ink-2)" />
            </button>
          </div>

          <div style={{ padding: "16px 18px" }}>
            {(loading || ctxLoading) && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 3 }}>
                {Array.from({ length: 35 }).map((_, i) => <Skeleton key={i} h={40} />)}
              </div>
            )}
            {error && (
              <div style={{ padding: 20, textAlign: "center", color: "#DC2626", fontSize: 13 }}>
                Could not load attendance. Please try again.
              </div>
            )}
            {!loading && !error && !ctxLoading && data && (
              <CalendarGrid year={year} month={month} days={data.days} holidays={data.holidays} />
            )}
            {noData && (
              <div style={{ padding: 20, textAlign: "center", color: "var(--ink-3)", fontSize: 13 }}>
                No attendance records for this month.
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Summary card */}
          <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden" }}>
            <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--bd)", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 24, height: 24, borderRadius: 6, background: "var(--pu-soft)", display: "grid", placeItems: "center" }}>
                <CalendarDays size={12} color="var(--pu)" strokeWidth={1.8} />
              </div>
              <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink-1)" }}>
                {MONTH_NAMES[month - 1]} Summary
              </span>
            </div>
            <div style={{ padding: "14px 16px" }}>
              {(loading || ctxLoading) ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {[1,2,3,4].map(i => <Skeleton key={i} h={36} />)}
                </div>
              ) : att ? (
                <>
                  {att.pct !== null && (
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                        <span style={{ fontSize: 12, color: "var(--ink-2)" }}>Attendance Rate</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: att.pct >= 85 ? "var(--ok)" : att.pct >= 70 ? "#D97706" : "#DC2626" }}>{att.pct}%</span>
                      </div>
                      <div style={{ height: 5, borderRadius: 99, background: "var(--line,#dbe4f0)" }}>
                        <div style={{ height: "100%", width: `${att.pct}%`, borderRadius: 99, background: att.pct >= 85 ? "var(--ok)" : att.pct >= 70 ? "#D97706" : "#DC2626", transition: "width 0.5s ease" }} />
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    {[
                      { label: "Present",  val: att.present,  color: "var(--ok)" },
                      { label: "Absent",   val: att.absent,   color: "#DC2626" },
                      { label: "Late",     val: att.late,     color: "#D97706" },
                      { label: "Half Day", val: att.half_day, color: "var(--pu)" },
                    ].map(({ label, val, color }) => (
                      <div key={label} style={{ background: "var(--bg-2)", borderRadius: 10, padding: "10px 12px" }}>
                        <div style={{ fontSize: 20, fontWeight: 800, color, lineHeight: 1 }}>{val}</div>
                        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 2 }}>{label}</div>
                      </div>
                    ))}
                  </div>
                  {att.total > 0 && (
                    <div style={{ marginTop: 10, fontSize: 11.5, color: "var(--ink-3)", textAlign: "center" }}>
                      {att.total} school day{att.total !== 1 ? "s" : ""} recorded
                    </div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 12, color: "var(--ink-3)", textAlign: "center", padding: "8px 0" }}>No data</div>
              )}
            </div>
          </div>

          {/* Legend */}
          <div style={{ border: "1px solid var(--bd)", borderRadius: 14, padding: "14px 16px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)", marginBottom: 10 }}>Legend</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
              {(["P","A","L","F","H"] as const).map((type) => {
                const cfg = TYPE_CONFIG[type];
                return (
                  <div key={type} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 24, height: 24, borderRadius: 6, background: cfg.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: cfg.color }}>{type === "F" ? "½" : type}</span>
                    </div>
                    <span style={{ fontSize: 12.5, color: "var(--ink-2)" }}>{cfg.label}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Holidays this month */}
          {data?.holidays && data.holidays.length > 0 && (
            <div style={{ border: "1px solid var(--bd)", borderRadius: 14, overflow: "hidden" }}>
              <div style={{ padding: "11px 16px", borderBottom: "1px solid var(--bd)" }}>
                <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--ink-3)" }}>Holidays</span>
              </div>
              <div style={{ padding: "10px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
                {data.holidays.map((h) => (
                  <div key={h.date} style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: TYPE_CONFIG.H.bg, display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 10, fontWeight: 700, color: TYPE_CONFIG.H.color }}>{new Date(h.date + "T00:00:00").getDate()}</span>
                    </div>
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: "var(--ink-1)" }}>{h.title}</div>
                      <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{new Date(h.date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
