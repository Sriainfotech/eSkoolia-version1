"use client";

import { Download } from "lucide-react";

interface HeroProps {
  addLabel: string;
  onAddClick: () => void;
}

export default function Hero({ addLabel, onAddClick }: HeroProps) {
  return (
    <div className="relative mb-4">
      {/* Decorative blob */}
      <div className="absolute -top-12 -right-24 w-96 h-96 rounded-full bg-gradient-to-br from-violet-500 to-violet-600 opacity-6 blur-3xl pointer-events-none" />

      <div className="relative">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2.5 mb-4 text-[11px] font-semibold text-zinc-500 tracking-wider uppercase">
          <div className="w-4 h-px bg-zinc-300" />
          ACADEMICS · CORE SETUP
        </div>

        {/* Title & Subtitle */}
        <div className="mb-4">
          <h1 className="font-[var(--font-playfair)] text-[42px] font-medium leading-[1.15] tracking-tight mb-2 pb-[2px]">
            Core <span className="italic bg-gradient-to-r from-violet-600 to-violet-500 bg-clip-text text-transparent">Setup</span>
          </h1>
          <p className="text-[14px] text-zinc-600 max-w-2xl leading-relaxed">
            Configure academic years, classes, sections, and subjects · The foundation every other module depends on.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-2">
          <button
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-[10px] border border-zinc-200 bg-white text-zinc-900 text-[13px] font-medium hover:bg-zinc-50 transition"
            title="Export setup data"
          >
            <Download size={16} />
            Export
          </button>
          <button
            onClick={onAddClick}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-[10px] bg-violet-600 text-white text-[13px] font-medium hover:bg-violet-700 transition shadow-[0_2px_6px_rgba(124,58,237,.25)]"
          >
            + {addLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
