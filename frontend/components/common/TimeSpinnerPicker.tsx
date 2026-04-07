"use client";

import { useState, useEffect, useRef } from "react";

interface TimeSpinnerPickerProps {
  value: string; // HH:MM format
  onChange: (value: string) => void;
}

export function TimeSpinnerPicker({ value, onChange }: TimeSpinnerPickerProps) {
  const [hours, setHours] = useState("00");
  const [minutes, setMinutes] = useState("00");
  const [period, setPeriod] = useState<"AM" | "PM">("AM");
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (value) {
      const parts = value.split(":");
      let h = parseInt(parts[0] || "0", 10);
      const m = parseInt(parts[1] || "0", 10);

      const p = h >= 12 ? "PM" : "AM";
      const displayH = h % 12 || 12;
      setPeriod(p);
      setHours(String(displayH).padStart(2, "0"));
      setMinutes(String(m).padStart(2, "0"));
    }
  }, [value]);

  const updateValue = (h: string, m: string, p: string) => {
    let hour24 = parseInt(h, 10);
    if (p === "PM" && hour24 !== 12) hour24 += 12;
    if (p === "AM" && hour24 === 12) hour24 = 0;
    const newValue = `${String(hour24).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
    onChange(newValue);
  };

  const incrementHours = () => {
    let h = parseInt(hours, 10) + 1;
    if (h > 12) h = 1;
    const newH = String(h).padStart(2, "0");
    setHours(newH);
    updateValue(newH, minutes, period);
  };

  const decrementHours = () => {
    let h = parseInt(hours, 10) - 1;
    if (h < 1) h = 12;
    const newH = String(h).padStart(2, "0");
    setHours(newH);
    updateValue(newH, minutes, period);
  };

  const incrementMinutes = () => {
    let m = parseInt(minutes, 10) + 1;
    if (m > 59) m = 0;
    const newM = String(m).padStart(2, "0");
    setMinutes(newM);
    updateValue(hours, newM, period);
  };

  const decrementMinutes = () => {
    let m = parseInt(minutes, 10) - 1;
    if (m < 0) m = 59;
    const newM = String(m).padStart(2, "0");
    setMinutes(newM);
    updateValue(hours, newM, period);
  };

  const togglePeriod = () => {
    const newP = period === "AM" ? "PM" : "AM";
    setPeriod(newP);
    updateValue(hours, minutes, newP);
  };

  useEffect(() => {
    const onDocClick = (event: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const spinnerButtonStyle = {
    width: 18,
    height: 18,
    borderRadius: "50%",
    border: "1px solid #cbd5e1",
    background: "#f1f5f9",
    cursor: "pointer",
    fontSize: 9,
    padding: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.2s",
    color: "#475569",
  };

  const timeDisplayStyle = {
    padding: "5px 6px",
    border: "1px solid #cbd5e1",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    color: "#0f172a",
    background: "#fff",
    minWidth: 38,
  };

  return (
    <div ref={rootRef} style={{ position: "relative", width: "100%", maxWidth: 150, minWidth: 132 }}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        style={{
          width: "100%",
          height: 36,
          border: "1px solid #cbd5e1",
          borderRadius: 8,
          background: "#fff",
          color: "#0f172a",
          fontSize: 12,
          fontWeight: 600,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 8px",
          cursor: "pointer",
        }}
      >
        <span>{value ? `${hours}:${minutes} ${period}` : "Select time"}</span>
        <span style={{ color: "#64748b" }}>🕐</span>
      </button>

      {open ? (
        <div
          style={{
            position: "absolute",
            top: 40,
            left: 0,
            zIndex: 50,
            display: "flex",
            gap: 3,
            alignItems: "center",
            padding: "5px 6px",
            background: "#f8fafc",
            borderRadius: 8,
            border: "1px solid #e2e8f0",
            boxShadow: "0 8px 20px rgba(15, 23, 42, 0.12)",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "center" }}>
            <button
              type="button"
              onClick={decrementHours}
              onMouseDown={(e) => e.preventDefault()}
              style={spinnerButtonStyle as React.CSSProperties}
            >
              ▲
            </button>
            <div style={timeDisplayStyle as React.CSSProperties}>{hours}</div>
            <button
              type="button"
              onClick={incrementHours}
              onMouseDown={(e) => e.preventDefault()}
              style={spinnerButtonStyle as React.CSSProperties}
            >
              ▼
            </button>
          </div>

          <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>:</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 1, alignItems: "center" }}>
            <button
              type="button"
              onClick={decrementMinutes}
              onMouseDown={(e) => e.preventDefault()}
              style={spinnerButtonStyle as React.CSSProperties}
            >
              ▲
            </button>
            <div style={timeDisplayStyle as React.CSSProperties}>{minutes}</div>
            <button
              type="button"
              onClick={incrementMinutes}
              onMouseDown={(e) => e.preventDefault()}
              style={spinnerButtonStyle as React.CSSProperties}
            >
              ▼
            </button>
          </div>

          <button
            type="button"
            onClick={togglePeriod}
            onMouseDown={(e) => e.preventDefault()}
            style={{
              padding: "5px 6px",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: 11,
              fontWeight: 600,
              color: "#0f172a",
              background: "#fff",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {period}
          </button>
        </div>
      ) : null}
    </div>
  );
}
