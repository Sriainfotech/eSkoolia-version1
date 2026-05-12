"use client";

import { useState, useEffect } from "react";
import { BookOpen, Check, X } from "lucide-react";
import { SubjectCardModel, SubjectType } from "./SubjectCard";

interface SubjectModalProps {
  open: boolean;
  editing: SubjectCardModel | null;
  existingNames: string[];
  onClose: () => void;
  onSave: (subject: Omit<SubjectCardModel, "id" | "classCount"> & { id?: string }) => void;
}

interface FormErrors {
  name?: string;
  code?: string;
}

const EMOJI_OPTIONS = ["📘", "🔬", "📐", "✏️", "🌍", "🎨", "🎵", "⚽", "🖥️", "📚", "🧮", "🔭"];
const SUBJECT_TYPES: { value: SubjectType; label: string }[] = [
  { value: "core", label: "Core" },
  { value: "language", label: "Language" },
  { value: "elective", label: "Elective" },
  { value: "co-curricular", label: "Co-Curricular" },
];

export default function SubjectModal({
  open,
  editing,
  existingNames,
  onClose,
  onSave,
}: SubjectModalProps) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [emoji, setEmoji] = useState("📘");
  const [type, setType] = useState<SubjectType>("core");
  const [isOptional, setIsOptional] = useState(false);
  const [errors, setErrors] = useState<FormErrors>({});
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  useEffect(() => {
    if (open) {
      setName(editing?.name ?? "");
      setCode(editing?.code ?? "");
      setEmoji(editing?.emoji ?? "📘");
      setType(editing?.type ?? "core");
      setIsOptional(editing?.isOptional ?? false);
      setErrors({});
      setShowEmojiPicker(false);
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
    if (!trimmedName) errs.name = "Subject name is required.";
    else {
      const dupe = existingNames.some(
        (n) => n.toLowerCase() === trimmedName.toLowerCase() && n !== editing?.name
      );
      if (dupe) errs.name = `A subject named "${trimmedName}" already exists.`;
    }

    const trimmedCode = code.trim();
    if (trimmedCode && trimmedCode.length > 8) errs.code = "Code must be 8 characters or less.";

    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    onSave({
      id: editing?.id,
      name: trimmedName,
      code: trimmedCode || "N/A",
      emoji: emoji || "📘",
      type,
      isOptional,
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
            <div className="w-[42px] h-[42px] rounded-xl bg-gradient-to-br from-orange-50 to-orange-100 text-orange-600 grid place-items-center shrink-0 shadow-[inset_0_0_0_1px_rgb(254_230_204)]">
              <BookOpen size={20} />
            </div>
            <div>
              <h2 className="font-[var(--font-playfair)] text-[22px] font-medium m-0 mb-1 tracking-tight leading-tight">
                {editing ? "Edit Subject" : "New Subject"}
              </h2>
              <p className="text-[13px] text-zinc-600 m-0">
                Create or modify a subject for your school curriculum.
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
            {/* Name + Code Row */}
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-3.5">
              <Field label="Subject Name" error={errors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Mathematics"
                  autoFocus
                  className={inputClass(!!errors.name)}
                />
              </Field>
              <Field label="Code" error={errors.code}>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="e.g. MATH"
                  maxLength={8}
                  className={inputClass(!!errors.code)}
                />
              </Field>
            </div>

            {/* Emoji Picker */}
            <div>
              <label className="block text-[11.5px] font-semibold text-zinc-600 tracking-wider uppercase mb-1.5">
                Icon / Emoji
              </label>
              <div className="relative">
                <button
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className="w-full px-3.5 py-2.5 rounded-[10px] border border-zinc-300 bg-white text-left text-[14px] flex items-center gap-2.5 hover:border-violet-400 hover:bg-violet-50 transition focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
                >
                  <span className="text-[20px]">{emoji}</span>
                  <span className="text-zinc-600 flex-1">Click to pick</span>
                </button>
                {showEmojiPicker && (
                  <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-zinc-300 rounded-[10px] shadow-xl p-2 grid gap-1 grid-cols-6">
                    {EMOJI_OPTIONS.map((e) => (
                      <button
                        key={e}
                        onClick={() => {
                          setEmoji(e);
                          setShowEmojiPicker(false);
                        }}
                        className="w-8 h-8 text-[18px] rounded-lg hover:bg-zinc-100 transition flex items-center justify-center"
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Type Selection */}
            <Field label="Subject Type">
              <div className="flex flex-wrap gap-2">
                {SUBJECT_TYPES.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setType(t.value)}
                    className={`px-3 py-1.5 rounded-[8px] text-[12.5px] font-medium transition ${
                      type === t.value
                        ? "bg-violet-600 text-white border border-violet-600"
                        : "border border-zinc-300 text-zinc-600 bg-white hover:border-violet-300 hover:bg-violet-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </Field>

            {/* Optional Toggle */}
            <div className="flex items-center gap-2.5 p-3 rounded-[10px] bg-sky-50 border border-sky-200">
              <input
                type="checkbox"
                id="isOptional"
                checked={isOptional}
                onChange={(e) => setIsOptional(e.target.checked)}
                className="w-4 h-4 rounded border-sky-300 accent-sky-600 cursor-pointer"
              />
              <label htmlFor="isOptional" className="flex-1 text-[13px] text-sky-900 font-medium cursor-pointer">
                Mark as optional for student enrollment
              </label>
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
            {editing ? "Save Changes" : "Create Subject"}
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
  const base = "w-full px-3.5 py-2.5 rounded-[10px] text-[14px] bg-white transition focus:outline-none";
  return hasError
    ? `${base} border border-red-500 ring-2 ring-red-100`
    : `${base} border border-zinc-300 focus:border-violet-600 focus:ring-2 focus:ring-violet-100`;
}
