"use client";

import { Calendar, BookOpen, Armchair, Ruler } from "lucide-react";
import { CoreSetupStats } from "@/lib/types";

interface StatsRowProps {
  stats: CoreSetupStats;
}

export default function StatsRow({ stats }: StatsRowProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
      {/* Academic Years */}
      <div className="group relative h-full p-3.5 rounded-3xl bg-white border border-zinc-200 hover:-translate-y-0.5 hover:shadow-md transition">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-500 tracking-wider uppercase">
              Academic Years
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <Calendar size={16} />
          </div>
        </div>
        <div className="font-serif text-[36px] font-medium text-zinc-900 mb-1 leading-none">
          {stats.years}
        </div>
        <p className="text-[12px] text-zinc-600">1 currently active</p>
      </div>

      {/* Classes */}
      <div className="group relative h-full p-3.5 rounded-3xl bg-white border border-zinc-200 hover:-translate-y-0.5 hover:shadow-md transition">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-500 tracking-wider uppercase">
              Classes
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <BookOpen size={16} />
          </div>
        </div>
        <div className="font-serif text-[36px] font-medium text-zinc-900 mb-1 leading-none">
          {stats.classes}
        </div>
        <p className="text-[12px] text-zinc-600">Pre-KG to Grade 12</p>
      </div>

      {/* Sections */}
      <div className="group relative h-full p-3.5 rounded-3xl bg-white border border-zinc-200 hover:-translate-y-0.5 hover:shadow-md transition">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-500 tracking-wider uppercase">
              Sections
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <Armchair size={16} />
          </div>
        </div>
        <div className="font-serif text-[36px] font-medium text-zinc-900 mb-1 leading-none">
          {stats.sections}
        </div>
        <p className="text-[12px] text-zinc-600">Across all classes</p>
      </div>

      {/* Subjects */}
      <div className="group relative h-full p-3.5 rounded-3xl bg-white border border-zinc-200 hover:-translate-y-0.5 hover:shadow-md transition">
        <div className="flex items-start justify-between mb-2.5">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-semibold text-zinc-500 tracking-wider uppercase">
              Subjects
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center">
            <Ruler size={16} />
          </div>
        </div>
        <div className="font-serif text-[36px] font-medium text-zinc-900 mb-1 leading-none">
          {stats.subjects}
        </div>
        <p className="text-[12px] text-green-600 font-medium">+3 added this term</p>
      </div>
    </div>
  );
}
