"use client";
import type { FoundationStats } from "./types";

const CARDS = [
  { key: "years"    as const, label: "Academic Years",  icon: "📅", color: "bg-indigo-50 text-indigo-600" },
  { key: "classes"  as const, label: "Classes",         icon: "🏫", color: "bg-blue-50 text-blue-600"   },
  { key: "sections" as const, label: "Sections",        icon: "📂", color: "bg-violet-50 text-violet-600"},
  { key: "subjects" as const, label: "Subjects",        icon: "📚", color: "bg-emerald-50 text-emerald-600"},
];

interface Props {
  stats: FoundationStats;
  loading: boolean;
}

export default function StatsBar({ stats, loading }: Props) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
      {CARDS.map((c) => (
        <div
          key={c.key}
          className="bg-white border border-gray-200 rounded-xl px-4 py-3 flex items-center gap-3 shadow-sm"
        >
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center text-lg flex-shrink-0 ${c.color}`}>
            {c.icon}
          </div>
          <div>
            <p className="text-[11px] font-600 text-gray-400 uppercase tracking-wide">{c.label}</p>
            {loading ? (
              <div className="mt-1 h-5 w-8 rounded bg-gray-200 animate-pulse" />
            ) : (
              <p className="text-xl font-800 text-gray-900 leading-none mt-0.5">
                {c.key === "years" ? stats.years : stats[c.key]}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
