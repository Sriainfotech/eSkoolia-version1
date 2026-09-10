"use client";

/**
 * Parent Portal — Health Log
 *
 * Read-only medical profile as captured at admission (students.Student —
 * there's no separate health-record model). Renders as a set of labeled
 * fact cards; list-shaped fields (allergies, vaccinations, etc.) render as
 * chip rows, empty ones are hidden rather than shown as "None".
 */

import { useCallback, useEffect, useState } from "react";
import { HeartPulse, Eye, Pill, Syringe, Stethoscope, Accessibility } from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildHealth, type HealthProfile } from "@/lib/api/parent";

function Skeleton({ h = 16 }: { h?: number }) {
  return <div style={{ height: h, borderRadius: 8, background: "var(--bg-2)" }} />;
}

function ChipRow({ items }: { items: string[] }) {
  if (items.length === 0) return <span style={{ fontSize: 12.5, color: "var(--ink-3)" }}>None recorded</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {items.map((item, i) => (
        <span key={i} style={{ fontSize: 12, fontWeight: 600, color: "var(--pu)", background: "var(--pu-soft)", padding: "3px 10px", borderRadius: 20 }}>{item}</span>
      ))}
    </div>
  );
}

function Field({ icon: Icon, label, children }: { icon: typeof HeartPulse; label: string; children: React.ReactNode }) {
  return (
    <div style={{ border: "1px solid var(--bd)", borderRadius: 12, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 8 }}>
        <Icon size={14} color="var(--ink-3)" strokeWidth={1.8} />
        <span style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      </div>
      {children}
    </div>
  );
}

export default function ParentHealthPage() {
  const { children, selectedChild, setSelectedChildId, loading: ctxLoading } = useParentChild();
  const [data, setData] = useState<HealthProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(() => {
    if (!selectedChild) return;
    setLoading(true);
    setError(false);
    fetchChildHealth(selectedChild.id).then(setData).catch(() => setError(true)).finally(() => setLoading(false));
  }, [selectedChild?.id]);

  useEffect(() => { load(); }, [load]);

  return (
    <div style={{ background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 18, boxShadow: "var(--sh-1)", padding: "28px 30px" }}>
      <div style={{ marginBottom: 22, paddingBottom: 20, borderBottom: "1px solid var(--bd)" }}>
        <h1 style={{ fontSize: 34, fontWeight: 600, color: "var(--ink-1)", margin: "0 0 5px", lineHeight: 1.05, letterSpacing: "-0.03em", display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
          Health{" "}
          <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontWeight: 400, fontStyle: "italic", color: "#0F766E", fontSize: 38, letterSpacing: "-0.02em" }}>Log</em>
        </h1>
        <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)", marginTop: 10, lineHeight: 1.55 }}>Medical profile as recorded at admission.</p>
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
          Could not load the health log. Please refresh.
        </div>
      )}

      {(loading || ctxLoading) ? (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} h={90} />)}
        </div>
      ) : !data ? null : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12 }}>
            <Field icon={Eye} label="Vision">
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-1)" }}>{data.vision || "Not recorded"}</span>
            </Field>
            <Field icon={Stethoscope} label="Treating Doctor">
              <span style={{ fontSize: 14, fontWeight: 600, color: "var(--ink-1)" }}>{data.treating_doctor || "Not recorded"}</span>
            </Field>
            <Field icon={Accessibility} label="PWD Status">
              <span style={{ fontSize: 14, fontWeight: 600, color: data.is_pwd ? "var(--info)" : "var(--ink-1)" }}>
                {data.is_pwd ? `Yes${data.disability_percent != null ? ` · ${data.disability_percent}%` : ""}` : "No"}
              </span>
            </Field>
          </div>

          <Field icon={HeartPulse} label="Medical Conditions"><ChipRow items={data.medical_conditions} /></Field>
          <Field icon={Pill} label="Allergies"><ChipRow items={data.allergies} /></Field>
          {data.current_medications && (
            <Field icon={Pill} label="Current Medications">
              <span style={{ fontSize: 13.5, color: "var(--ink-1)" }}>{data.current_medications}</span>
            </Field>
          )}
          <Field icon={Syringe} label="Vaccinations"><ChipRow items={data.vaccinations} /></Field>
          {data.is_pwd && data.disability_types.length > 0 && (
            <Field icon={Accessibility} label="Disability Type(s)"><ChipRow items={data.disability_types} /></Field>
          )}
          {data.is_pwd && data.disability_accommodations.length > 0 && (
            <Field icon={Accessibility} label="Accommodations"><ChipRow items={data.disability_accommodations} /></Field>
          )}
          {(data.medical_notes || data.disability_notes) && (
            <Field icon={HeartPulse} label="Notes">
              <span style={{ fontSize: 13.5, color: "var(--ink-1)", whiteSpace: "pre-wrap" }}>
                {[data.medical_notes, data.disability_notes].filter(Boolean).join(" · ")}
              </span>
            </Field>
          )}
        </div>
      )}
    </div>
  );
}
