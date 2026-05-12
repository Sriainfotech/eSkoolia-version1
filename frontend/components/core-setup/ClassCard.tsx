"use client";

import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Pencil, Plus, X } from "lucide-react";
import { SchoolClass } from "@/lib/types";

interface ClassCardProps {
  schoolClass: SchoolClass;
  onEdit: (cls: SchoolClass) => void;
  onDelete: (cls: SchoolClass) => void;
  onAddSection: (classId: string, sectionName: string) => { ok: boolean; reason?: string };
  onRemoveSection: (classId: string, sectionName: string) => void;
}

export default function ClassCard({
  schoolClass,
  onEdit,
  onDelete,
  onAddSection,
  onRemoveSection,
}: ClassCardProps) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const badge = schoolClass.code || schoolClass.name.slice(0, 2).toUpperCase();

  const commit = (cancel = false) => {
    const value = draft.trim();
    setAdding(false);
    setDraft("");
    if (cancel || !value) return;
    onAddSection(schoolClass.id, value);
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") commit();
    else if (e.key === "Escape") commit(true);
  };

  return (
    <div className="h-full bg-white border border-zinc-200 rounded-xl p-3.5 flex flex-col gap-2.5 transition hover:shadow-md hover:-translate-y-0.5 hover:border-violet-200">
      {/* Header */}
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-violet-50 to-violet-100 text-violet-600 grid place-items-center font-[var(--font-playfair)] font-semibold text-[14px] shadow-[inset_0_0_0_1px_rgb(221_210_250)] shrink-0">
            {badge}
          </div>
          <div className="flex flex-col gap-0.5 min-w-0">
            <div className="font-[var(--font-playfair)] text-[16px] font-medium tracking-tight leading-tight truncate">
              {schoolClass.name}
            </div>
            <div className="text-[11.5px] text-zinc-600 flex items-center gap-1.5 flex-wrap">
              <span>{schoolClass.sections.length} section{schoolClass.sections.length === 1 ? "" : "s"}</span>
              {schoolClass.code && (
                <>
                  <span className="w-[3px] h-[3px] rounded-full bg-zinc-300" />
                  <span>Code: {schoolClass.code}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => onEdit(schoolClass)}
          aria-label="Edit class"
          className="w-[28px] h-[28px] rounded-lg border border-zinc-200 bg-white text-zinc-600 grid place-items-center hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 transition"
        >
          <Pencil size={13} />
        </button>
      </div>

      {/* Sections */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] tracking-[.08em] uppercase text-zinc-400 font-semibold">Sections</span>
          <span className="text-[10px] font-semibold px-1.5 py-px rounded-full bg-zinc-50 text-zinc-600">
            {schoolClass.sections.length}
          </span>
        </div>

        <div className="flex flex-wrap gap-1 min-h-[26px] items-start">
          {schoolClass.sections.length === 0 && !adding && (
            <div className="text-[11.5px] text-zinc-400 italic py-0.5">No sections yet. Add one below ↓</div>
          )}

          {schoolClass.sections.map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 pl-2 pr-1.5 py-0.5 rounded-full bg-violet-100 text-violet-600 border border-violet-200 text-[11.5px] font-medium hover:bg-violet-200 transition"
            >
              {s}
              <button
                onClick={() => onRemoveSection(schoolClass.id, s)}
                aria-label={`Remove section ${s}`}
                className="w-3.5 h-3.5 rounded-full grid place-items-center opacity-60 hover:opacity-100 hover:bg-violet-300/30 transition"
              >
                <X size={10} strokeWidth={2.5} />
              </button>
            </span>
          ))}

          {adding ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKey}
              onBlur={() => commit()}
              maxLength={8}
              placeholder="A"
              className="w-16 px-2 py-0.5 rounded-full border border-violet-600 text-[11.5px] outline-none bg-white ring-2 ring-violet-100"
            />
          ) : (
            <button
              onClick={() => setAdding(true)}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-transparent text-zinc-600 border border-dashed border-zinc-300 text-[11.5px] font-medium hover:border-solid hover:border-violet-600 hover:text-violet-600 hover:bg-violet-50 transition"
            >
              <Plus size={10} strokeWidth={2.5} />
              Add section
            </button>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-auto flex gap-1.5 pt-2 border-t border-zinc-200">
        <button
          onClick={() => onEdit(schoolClass)}
          className="flex-1 justify-center px-2.5 py-1 rounded-lg bg-violet-50 text-violet-600 border border-violet-200 text-[11.5px] font-medium hover:bg-violet-100 transition"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(schoolClass)}
          className="flex-1 justify-center px-2.5 py-1 rounded-lg bg-red-50 text-red-600 border border-red-200 text-[11.5px] font-medium hover:bg-red-100 transition"
        >
          Delete
        </button>
      </div>
    </div>
  );
}
