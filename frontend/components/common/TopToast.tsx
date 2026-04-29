"use client";

import { useEffect } from "react";

type TopToastProps = {
  message: string;
  tone?: "success" | "error";
  onClose?: () => void;
  autoCloseMs?: number;
};

export function TopToast({ message, tone = "success", onClose, autoCloseMs = 3000 }: TopToastProps) {
  useEffect(() => {
    if (!message || !onClose) return;
    const timer = window.setTimeout(() => onClose(), autoCloseMs);
    return () => window.clearTimeout(timer);
  }, [autoCloseMs, message, onClose]);

  if (!message) return null;

  const isSuccess = tone === "success";

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 18,
        right: 18,
        zIndex: 9999,
        minWidth: 280,
        maxWidth: 420,
        padding: "14px 16px",
        borderRadius: 12,
        background: isSuccess ? "#0f766e" : "#b91c1c",
        color: "#fff",
        boxShadow: "0 16px 40px rgba(15, 23, 42, 0.22)",
        display: "flex",
        alignItems: "center",
        gap: 12,
      }}
    >
      <div style={{ flex: 1, fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}>{message}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss message"
          style={{
            border: 0,
            background: "rgba(255,255,255,0.18)",
            color: "#fff",
            width: 28,
            height: 28,
            borderRadius: 999,
            cursor: "pointer",
            fontSize: 18,
            lineHeight: "28px",
          }}
        >
          ×
        </button>
      ) : null}
    </div>
  );
}