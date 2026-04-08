"use client";

import { MouseEventHandler } from "react";

type ActionButtonVariant = "primary" | "danger" | "secondary";

type ActionButtonProps = {
  label: string;
  loadingLabel?: string;
  isLoading?: boolean;
  onClick: MouseEventHandler<HTMLButtonElement>;
  variant?: ActionButtonVariant;
  type?: "button" | "submit" | "reset";
  disabled?: boolean;
};

function colorsFor(variant: ActionButtonVariant) {
  if (variant === "danger") return { border: "#dc2626", bg: "#dc2626" };
  if (variant === "secondary") return { border: "#6b7280", bg: "#6b7280" };
  return { border: "var(--primary)", bg: "var(--primary)" };
}

export function ActionButton({
  label,
  loadingLabel,
  isLoading = false,
  onClick,
  variant = "primary",
  type = "button",
  disabled = false,
}: ActionButtonProps) {
  const palette = colorsFor(variant);
  const isDisabled = disabled || isLoading;

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={isDisabled}
      style={{
        height: 36,
        border: `1px solid ${palette.border}`,
        background: palette.bg,
        color: "#fff",
        borderRadius: 8,
        padding: "0 12px",
        cursor: isDisabled ? "not-allowed" : "pointer",
        opacity: isDisabled ? 0.85 : 1,
      }}
    >
      {isLoading ? (loadingLabel || `${label}...`) : label}
    </button>
  );
}
