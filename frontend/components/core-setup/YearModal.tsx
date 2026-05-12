"use client";

import { useState, useEffect } from "react";
import { Calendar, Check, X } from "lucide-react";
import { AcademicYear } from "@/lib/types";
import { deriveYearName, deriveStatus } from "@/lib/utils";

interface YearModalProps {
  open: boolean;
  editing: AcademicYear | null;
  onClose: () => void;
  onSave: (year: Omit<AcademicYear, "id"> & { id?: string }) => void;
}

interface FormErrors {
  name?: string;
  start?: string;
  end?: string;
}

export default function YearModal({
  open,
  editing,
  onClose,
  onSave,
}: YearModalProps) {
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [active, setActive] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});

  // Reset form when modal opens/closes or editing target changes
  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setStart(editing?.start ?? "");
      setEnd(editing?.end ?? "");
      setActive(editing?.status === "active");
      setErrors({});
    }
  }, [open, editing]);

  // Esc to close + body scroll lock
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const handleSave = () => {
    const errs: FormErrors = {};
    let finalName = name.trim();

    if (!finalName && start && end) finalName = deriveYearName(start, end);
    if (!finalName) errs.name = "Name is required.";
    if (!start) errs.start = "Start date required.";
    if (!end) errs.end = "End date required.";
    if (start && end && new Date(end) <= new Date(start)) {
      errs.end = "End date must be after start.";
    }

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onSave({
      id: editing?.id,
      name: finalName,
      start,
      end,
      status: deriveStatus(start, end, active),
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-5 pt-15 pb-5 overflow-y-auto bg-[rgba(20,15,40,0.45)] backdrop-blur-sm animate-[fadeIn_.2s_ease]"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
    >
      <div className="bg-white rounded-3xl w-full max-w-[560px] border border-zinc-200 overflow-hidden shadow-2xl animate-[slideUp_.25s_cubic-bezier(.2,.8,.2,1)]">
        {/* Header */}
        <div className="px-7 pt-6 pb-4 border-b border-zinc-200 flex items-start justify-between gap-4 bg-gradient-to-b from-zinc-50 to-white">
          <div className="flex gap-3.5 items-start">
            <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 grid place-items-center shrink-0 shadow-[inset_0_0_0_1px_rgb(221_210_250)]">
              <Calendar size={20} />
            </div>
            <div>
              <h2 className="font-[var(--font-playfair)] text-[22px] font-medium m-0 mb-1 tracking-tight leading-tight">
                {editing ? "Edit Academic Year" : "New Academic Year"}
              </h2>
              <p className="text-[13px] text-zinc-600 m-0">
                Define the date range and whether this is the currently active
                year.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="w-8 h-8 rounded-lg border border-zinc-200 bg-white text-zinc-600 grid place-items-center hover:bg-zinc-50 hover:text-zinc-900 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6">
          <div className="grid grid-cols-1 gap-4">
            {/* Name */}
            <Field
              label="Academic Year Name"
              hint="Auto-generated from dates if left blank."
              error={errors.name}
            >
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 2026–2027"
                autoFocus
                className={inputClass(!!errors.name)}
              />
            </Field>

            {/* Dates */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Start Date" error={errors.start}>
                <input
                  type="date"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                  className={inputClass(!!errors.start)}
                />
              </Field>
              <Field label="End Date" error={errors.end}>
                <input
                  type="date"
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={inputClass(!!errors.end)}
                />
              </Field>
            </div>

            {/* Active toggle */}
            <div className="flex items-center justify-between gap-4 px-4 py-3.5 border border-zinc-200 rounded-xl bg-zinc-50">
              <div className="flex flex-col gap-0.5">
                <span className="text-[13.5px] font-medium">
                  Set as currently active year
                </span>
                <span className="text-xs text-zinc-600">
                  Only one year can be active at a time. Will deactivate the
                  existing active year.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActive(!active)}
                className={`relative w-[38px] h-[22px] rounded-full transition shrink-0 ${
                  active ? "bg-violet-600" : "bg-zinc-300"
                }`}
                aria-pressed={active}
              >
                <span
                  className={`absolute top-0.5 w-[18px] h-[18px] bg-white rounded-full shadow transition-all ${
                    active ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-4 border-t border-zinc-200 flex justify-end gap-2.5 bg-zinc-50">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-[10px] border border-zinc-300 bg-white text-zinc-900 text-[13.5px] font-medium hover:bg-zinc-100 transition"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-[10px] bg-violet-600 text-white text-[13.5px] font-medium hover:bg-violet-700 transition shadow-[0_2px_6px_rgba(124,58,237,.25)]"
          >
            <Check size={14} strokeWidth={2.5} />
            {editing ? "Save Changes" : "Save Year"}
          </button>
        </div>
      </div>

      <style jsx global>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes slideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  );
}

// ---------- Field wrapper ----------
function Field({
  label,
  hint,
  error,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[11.5px] font-semibold text-zinc-600 tracking-wider uppercase mb-1.5">
        {label}
      </label>
      {children}
      {error ? (
        <div className="text-[11.5px] text-red-600 mt-1.5">{error}</div>
      ) : hint ? (
        <div className="text-[11.5px] text-zinc-400 mt-1.5">{hint}</div>
      ) : null}
    </div>
  );
}

function inputClass(hasError: boolean): string {
  const base =
    "w-full px-3.5 py-2.5 rounded-[10px] text-[14px] bg-white transition focus:outline-none";
  return hasError
    ? `${base} border border-red-500 ring-2 ring-red-100`
    : `${base} border border-zinc-300 focus:border-violet-600 focus:ring-2 focus:ring-violet-100`;
}
