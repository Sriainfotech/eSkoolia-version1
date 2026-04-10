"use client";

import type { InputHTMLAttributes } from "react";

type FormInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & {
  label: string;
  helperText?: string;
  error?: string;
  value: string;
  onChange: (value: string) => void;
  numeric?: boolean;
  blockRepeatingChars?: boolean;
};

function hasTripleRepeat(value: string) {
  return /(.)\1{2,}/.test(value);
}

export default function FormInput({
  label,
  helperText,
  error,
  value,
  onChange,
  numeric = false,
  blockRepeatingChars = true,
  type = "text",
  onKeyDown,
  ...props
}: FormInputProps) {
  const handleChange = (nextValue: string) => {
    if (numeric) {
      const digitsOnly = nextValue.replace(/\D/g, "");
      onChange(digitsOnly);
      return;
    }

    if (blockRepeatingChars && hasTripleRepeat(nextValue)) {
      return;
    }

    onChange(nextValue);
  };

  const handleKeyDown: InputHTMLAttributes<HTMLInputElement>["onKeyDown"] = (event) => {
    if (numeric && ["e", "E", "+", "-"].includes(event.key)) {
      event.preventDefault();
      return;
    }

    onKeyDown?.(event);
  };

  return (
    <label className="block space-y-1.5">
      <span className="block text-sm font-semibold text-slate-700">{label}</span>
      <input
        {...props}
        type={numeric ? "text" : type}
        value={value}
        onChange={(event) => handleChange(event.target.value)}
        onKeyDown={handleKeyDown}
        inputMode={numeric ? "numeric" : props.inputMode}
        className={`h-10 w-full rounded-lg border px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 ${
          error ? "border-rose-400 bg-rose-50/40" : "border-slate-300 bg-white"
        } ${props.className || ""}`}
      />
      {helperText ? <small className="block text-xs text-slate-500">{helperText}</small> : null}
      {error ? <small className="block text-xs font-medium text-rose-600">{error}</small> : null}
    </label>
  );
}
