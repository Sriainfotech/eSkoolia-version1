"use client";

import { BookOpen, Pencil, Trash2 } from "lucide-react";

export type SubjectType = "core" | "language" | "elective" | "co-curricular";

export interface SubjectCardModel {
  id: string;
  name: string;
  code: string;
  emoji: string;
  type: SubjectType;
  isOptional: boolean;
  classCount: number;
}

interface SubjectCardProps {
  subject: SubjectCardModel;
  typeLabel: string;
  typeClassName: string;
  onEdit: (subject: SubjectCardModel) => void;
  onDelete: (subject: SubjectCardModel) => void;
}

export default function SubjectCard({
  subject,
  typeLabel,
  typeClassName,
  onEdit,
  onDelete,
}: SubjectCardProps) {
  return (
    <article className="h-full bg-white border border-zinc-200 rounded-xl p-3.5 flex flex-col gap-2.5 transition hover:shadow-md hover:-translate-y-0.5 hover:border-violet-200">
      <div className="flex items-start justify-between gap-2.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-50 to-orange-100 text-orange-700 grid place-items-center text-[16px] border border-orange-200 shrink-0">
            {subject.emoji || "📘"}
          </div>
          <div className="min-w-0">
            <h3 className="font-[var(--font-playfair)] text-[16px] leading-tight tracking-tight truncate">
              {subject.name}
            </h3>
            <div className="mt-0.5 text-[11.5px] text-zinc-600 flex items-center gap-1.5 flex-wrap">
              <span className="font-semibold">{subject.code}</span>
              <span className="w-[3px] h-[3px] rounded-full bg-zinc-300" />
              <span>{subject.classCount} class{subject.classCount === 1 ? "" : "es"}</span>
            </div>
          </div>
        </div>

        <div className="inline-flex items-center gap-1.5 shrink-0">
          <button
            onClick={() => onEdit(subject)}
            aria-label="Edit subject"
            className="w-[28px] h-[28px] rounded-lg border border-zinc-200 bg-white text-zinc-600 grid place-items-center hover:bg-zinc-50 hover:text-zinc-900 hover:border-zinc-300 transition"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(subject)}
            aria-label="Delete subject"
            className="w-[28px] h-[28px] rounded-lg border border-red-200 bg-red-50 text-red-600 grid place-items-center hover:bg-red-100 transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium border ${typeClassName}`}>
          {typeLabel}
        </span>
        {subject.isOptional && (
          <span className="px-2 py-0.5 rounded-full text-[11px] font-medium border border-sky-200 bg-sky-50 text-sky-700">
            Optional
          </span>
        )}
      </div>

      <div className="mt-auto flex items-center gap-1.5 pt-2 border-t border-zinc-200 text-[11.5px] text-zinc-600">
        <BookOpen size={13} className="text-zinc-400" />
        <span>Available for class mapping</span>
      </div>
    </article>
  );
}
