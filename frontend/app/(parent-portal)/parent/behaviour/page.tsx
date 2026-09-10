"use client";

/**
 * Parent Portal — Behaviour Log
 *
 * AssignedIncident history for the selected child — positive points read
 * as commendations, negative as incidents.
 */

import { useCallback, useEffect, useState } from "react";
import { Star, ThumbsUp, ThumbsDown } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildBehaviour, type BehaviourEntry } from "@/lib/api/parent";

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: "var(--bg-2)" }} />;
}

export default function ParentBehaviourPage() {
  const { children, selectedChild, setSelectedChildId, loading: ctxLoading } = useParentChild();
  const [entries, setEntries] = useState<BehaviourEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    fetchChildBehaviour(selectedChild.id).then(setEntries).catch(() => setError(true)).finally(() => setLoading(false));
  }, [selectedChild?.id]);

  useEffect(() => { load(); }, [load]);

  const totalPoints = entries.reduce((sum, e) => sum + e.point, 0);

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)" }}>
        <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          Behaviour{" "}
          <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "#0369A1", fontSize: 38, letterSpacing: "-0.02em" }}>Log</em>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>Commendations and incidents recorded for your child.</p>
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
          Could not load the behaviour log. Please refresh.
        </div>
      )}

      {!loading && !ctxLoading && entries.length > 0 && (
        <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: totalPoints >= 0 ? "var(--ok-soft)" : "var(--danger-soft)", borderRadius: 10, padding: "10px 16px", marginBottom: 20 }}>
          <Star size={15} color={totalPoints >= 0 ? "var(--ok)" : "var(--danger)"} />
          <span style={{ fontSize: 13, fontWeight: 700, color: totalPoints >= 0 ? "var(--ok)" : "var(--danger)" }}>{totalPoints >= 0 ? "+" : ""}{totalPoints} total points</span>
        </div>
      )}

      {(loading || ctxLoading) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {[1, 2, 3].map((i) => <Skeleton key={i} h={64} />)}
        </div>
      ) : entries.length === 0 ? (
        <div style={{ background: "var(--bg-2)", border: "1px solid var(--bd)", borderRadius: 12, padding: 40, textAlign: "center" }}>
          <Star size={28} color="var(--ink-3)" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-2)", marginBottom: 4 }}>No behaviour records yet</div>
          <div style={{ fontSize: 12.5, color: "var(--ink-3)" }}>Commendations and incidents will show up here.</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {entries.map((e) => {
            const positive = e.point >= 0;
            const Icon = positive ? ThumbsUp : ThumbsDown;
            return (
              <div key={e.id} style={{ display: "flex", alignItems: "flex-start", gap: 14, border: "1px solid var(--bd)", borderRadius: 12, padding: "13px 16px" }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: positive ? "var(--ok-soft)" : "var(--danger-soft)", display: "grid", placeItems: "center", flex: "none" }}>
                  <Icon size={15} color={positive ? "var(--ok)" : "var(--danger)"} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13.5, fontWeight: 700, color: "var(--ink-1)" }}>{e.incident_title}</span>
                    <span style={{ fontSize: 11, fontWeight: 700, color: positive ? "var(--ok)" : "var(--danger)" }}>{positive ? "+" : ""}{e.point} pts</span>
                  </div>
                  {e.note && <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "var(--ink-2)" }}>{e.note}</p>}
                  <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 4 }}>
                    {new Date(e.date + "T00:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
