"use client";
/**
 * Field components used only by the Staff Onboard wizard
 * (frontend/app/(dashboard)/hr/onboard/page.tsx), styled to be a visual match
 * of the Student Enroll page's field system (`.field-wrapper` / `.field-label` /
 * `.field-input` / `.field-select`, defined as global CSS in that page).
 *
 * Deliberately separate from the shared `HrField`/`HrInput`/`HrSelect`/`HrDropdown`
 * in `./HrUi.tsx`, which other HR pages (staff directory, departments, leave,
 * etc.) still use — this file exists so the onboard page's look can match the
 * student page without changing HR's look everywhere else. Prop signatures are
 * identical to the Hr* originals so call sites don't need to change, only the
 * import source does.
 */
import React, { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

export function OnboardField({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="field-wrapper">
      <label className="field-label">
        {label}
        {required && <span className="req">*</span>}
      </label>
      {children}
      {error && <span className="error-msg">{error}</span>}
    </div>
  );
}

export function OnboardInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={["field-input", props.className ?? ""].join(" ").trim()}
    />
  );
}

export function OnboardSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={["field-select", props.className ?? ""].join(" ").trim()}
    />
  );
}

export function OnboardTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={["field-textarea", props.className ?? ""].join(" ").trim()}
    />
  );
}

/** Custom dropdown (matches HrDropdown's prop API) styled like `.field-select`. */
export function OnboardDropdown({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled,
}: {
  value: string | number;
  onChange: (val: string) => void;
  options: { value: string | number; label: string }[];
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = options.find((o) => String(o.value) === String(value));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%" }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="field-select"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          textAlign: "left",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.5 : 1,
          borderColor: open ? "var(--brand)" : undefined,
          boxShadow: open ? "0 0 0 3px rgba(108,60,225,0.12)" : undefined,
        }}
      >
        <span style={{ color: selected ? "#111827" : "#9ca3af" }}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          size={14}
          color="#9ca3af"
          style={{ transition: "transform 0.15s", transform: open ? "rotate(180deg)" : "none", flexShrink: 0 }}
        />
      </button>

      {open && (
        <ul
          style={{
            position: "absolute", left: 0, top: "calc(100% + 4px)", width: "100%",
            background: "#fff", border: "1px solid #e5e7eb", borderRadius: 8,
            boxShadow: "0 8px 24px -4px rgba(15,18,34,0.14)", zIndex: 200,
            maxHeight: 220, overflowY: "auto", padding: "4px 0", margin: 0, listStyle: "none",
          }}
        >
          {placeholder && (
            <li
              onClick={() => { onChange(""); setOpen(false); }}
              style={{ padding: "8px 12px", fontSize: 13, color: "#94a3b8", cursor: "pointer" }}
            >
              {placeholder}
            </li>
          )}
          {options.map((o) => (
            <li
              key={o.value}
              onClick={() => { onChange(String(o.value)); setOpen(false); }}
              style={{
                padding: "8px 12px", fontSize: 13, cursor: "pointer",
                background: String(o.value) === String(value) ? "#f3f0ff" : "transparent",
                fontWeight: String(o.value) === String(value) ? 700 : 400,
                color: String(o.value) === String(value) ? "var(--brand)" : "#111827",
              }}
              onMouseEnter={(e) => { if (String(o.value) !== String(value)) e.currentTarget.style.background = "#f3f0ff"; }}
              onMouseLeave={(e) => { if (String(o.value) !== String(value)) e.currentTarget.style.background = "transparent"; }}
            >
              {o.label}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
