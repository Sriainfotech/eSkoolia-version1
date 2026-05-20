"use client";
import type { WizardStep } from "./types";

const STEPS: { key: WizardStep; label: string; icon: string }[] = [
  { key: "year",     label: "Academic Year", icon: "📅" },
  { key: "classes",  label: "Classes",       icon: "🏫" },
  { key: "sections", label: "Sections",      icon: "📂" },
  { key: "subjects", label: "Subjects",      icon: "📚" },
];

interface Props {
  step: WizardStep;
  completedSteps: Set<WizardStep>;
  onStep: (s: WizardStep) => void;
  currentYear: string;
  onChangeYear?: () => void;
}

export default function WorkspaceHeader({
  step,
  completedSteps,
  onStep,
  currentYear,
  onChangeYear,
}: Props) {
  const completed = STEPS.filter((s) => completedSteps.has(s.key)).length;
  const pct = Math.round((completed / STEPS.length) * 100);

  return (
    <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-6 h-12 border-b border-gray-100">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Foundation Setup</span>
        <button
          onClick={onChangeYear}
          className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-200 text-indigo-700 text-xs font-semibold hover:bg-indigo-100 transition-colors"
        >
          <span>📅</span>
          <span>{currentYear}</span>
          <span className="text-indigo-400">▾</span>
        </button>

        {/* Progress bar */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-gray-400 font-medium">{completed}/{STEPS.length} complete</span>
          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400 transition-all duration-500"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Wizard step tabs */}
      <div className="flex items-center px-4 h-10 overflow-x-auto gap-0.5">
        {STEPS.map((s, idx) => {
          const done = completedSteps.has(s.key);
          const active = step === s.key;
          return (
            <button
              key={s.key}
              onClick={() => onStep(s.key)}
              className={[
                "flex items-center gap-1.5 px-3 h-10 text-xs font-semibold rounded-none border-b-2 transition-all whitespace-nowrap",
                active
                  ? "text-indigo-600 border-indigo-600 bg-indigo-50"
                  : done
                  ? "text-green-600 border-transparent hover:border-green-300 hover:bg-green-50"
                  : "text-gray-400 border-transparent hover:text-gray-600 hover:bg-gray-50",
              ].join(" ")}
            >
              <span
                className={[
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold",
                  active ? "bg-indigo-600 text-white" : done ? "bg-green-500 text-white" : "bg-gray-200 text-gray-500",
                ].join(" ")}
              >
                {done ? "✓" : idx + 1}
              </span>
              <span>{s.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
