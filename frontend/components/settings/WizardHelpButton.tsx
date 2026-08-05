"use client";

import { useEffect, useRef, useState } from "react";
import { Info, X } from "lucide-react";

export interface WizardHelpStep {
  label: string;
  description: string;
}

export function WizardHelpButton({ title, intro, steps }: { title: string; intro?: string; steps: WizardHelpStep[] }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={containerRef} style={{ position: "relative", flexShrink: 0 }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Guide: ${title}`}
        aria-expanded={open}
        title="What does each step do?"
        style={{
          width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
          background: open ? "var(--pu)" : "var(--bg-2)", color: open ? "#fff" : "var(--ink-2)",
          border: `1px solid ${open ? "var(--pu)" : "var(--bd-2)"}`, cursor: "pointer",
        }}
      >
        <Info size={14} strokeWidth={2.25} />
      </button>
      {open && (
        <div
          role="dialog"
          style={{
            position: "absolute", top: 34, right: 0, width: 300, zIndex: 30,
            background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 12,
            boxShadow: "0 10px 28px rgba(15,18,34,0.16)", padding: "14px 16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8, marginBottom: intro ? 6 : 10 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: "var(--ink-1)" }}>{title}</div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close guide"
              style={{ background: "none", border: "none", cursor: "pointer", color: "var(--ink-3)", padding: 0, lineHeight: 0, flexShrink: 0 }}
            >
              <X size={14} />
            </button>
          </div>
          {intro && <p style={{ margin: "0 0 10px", fontSize: 12, color: "var(--ink-2)", lineHeight: 1.5 }}>{intro}</p>}
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 8 }}>
            {steps.map((s) => (
              <li key={s.label} style={{ fontSize: 12, color: "var(--ink-2)", lineHeight: 1.45 }}>
                <strong style={{ color: "var(--ink-1)" }}>{s.label}:</strong> {s.description}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
