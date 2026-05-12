"use client";

import { useState, useEffect } from "react";
import { GraduationCap, Check, X } from "lucide-react";
import { SchoolClass } from "@/lib/types";

interface ClassModalProps {
  open: boolean;
  editing: SchoolClass | null;
  existingNames: string[];
  onClose: () => void;
  onSave: (cls: Omit<SchoolClass, "id"> & { id?: string }) => void;
}

interface FormErrors {
  name?: string;
}

export default function ClassModal({ open, editing, existingNames, onClose, onSave }: ClassModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [sectionsRaw, setSectionsRaw] = useState("");
  const [errors, setErrors] = useState<FormErrors>({});

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setCode(editing?.code ?? "");
      setSectionsRaw(editing?.sections.join(", ") ?? "");
      setErrors({});
    }
  }, [open, editing]);

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
    const trimmedName = name.trim();
    if (!trimmedName) errs.name = "Class name is required.";
    else {
      const dupe = existingNames.some(
        (n) => n.toLowerCase() === trimmedName.toLowerCase() && n !== editing?.name
      );
      if (dupe) errs.name = `A class named "${trimmedName}" already exists.`;
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Parse + dedupe sections (case-insensitive)
    const raw = sectionsRaw.split(",").map((s) => s.trim()).filter(Boolean);
    const seen = new Set<string>();
    const sections = raw.filter((s) => {
      const k = s.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    onSave({
      id: editing?.id,
      name: trimmedName,
      code: code.trim() || undefined,
      sections,
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
              <GraduationCap size={20} />
            </div>
            <div>
              <h2 className="font-[var(--font-playfair)] text-[22px] font-medium m-0 mb-1 tracking-tight leading-tight">
                {editing ? "Edit Class" : "New Class"}
              </h2>
              <p className="text-[13px] text-zinc-600 m-0">
                Add a class with sections. Sections can be edited inline after saving.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg border border-zinc-200 bg-white text-zinc-600 grid place-items-center hover:bg-zinc-50 hover:text-zinc-900 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6">
          <div className="grid grid-cols-1 gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <Field label="Class Name" error={errors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Grade 5"
                  autoFocus
                  className={inputClass(!!errors.name)}
                />
              </Field>
              <Field label="Display Code (optional)" hint="Short identifier shown on the card.">
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. G5"
                  maxLength={6}
                  className={inputClass(false)}
                />
              </Field>
            </div>

            <Field label="Sections (comma-separated)" hint="Leave blank to add sections later from the card.">
              <input
                type="text"
                value={sectionsRaw}
                onChange={(e) => setSectionsRaw(e.target.value)}
                placeholder="e.g. A, B, C"
                className={inputClass(false)}
              />
            </Field>
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
            {editing ? "Save Changes" : "Save Class"}
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

function Field({ label, hint, error, children }: {
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
  const base = "w-full px-3.5 py-2.5 rounded-[10px] text-[14px] bg-white transition focus:outline-none";
  return hasError
    ? `${base} border border-red-500 ring-2 ring-red-100`
    : `${base} border border-zinc-300 focus:border-violet-600 focus:ring-2 focus:ring-violet-100`;
}
