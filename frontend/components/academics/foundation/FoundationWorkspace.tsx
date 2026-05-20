"use client";
import { useState } from "react";
import { useFoundationData } from "./hooks/useFoundationData";
import AcademicYearPane from "./panes/AcademicYearPane";
import ClassesPane from "./panes/ClassesPane";
import SectionsPane from "./panes/SectionsPane";
import RoomsPane from "./panes/RoomsPane";
import SubjectsPane from "./panes/SubjectsPane";

type WizStep = 1 | 2 | 3 | 4 | 5;
export type WorkspaceTab = "foundation" | "staff" | "timetable" | "planning" | "reports";

const TAB_META: Record<WorkspaceTab, { label: string; icon: string }> = {
  foundation: { label: "Foundation",      icon: "🏫" },
  staff:      { label: "Staff",           icon: "👩‍🏫" },
  timetable:  { label: "Timetable",       icon: "🗓"  },
  planning:   { label: "Planning Studio", icon: "📚" },
  reports:    { label: "Reports",         icon: "📊" },
};

const WZ_STEPS = [
  { n: 1 as WizStep, label: "Academic Year" },
  { n: 2 as WizStep, label: "Classes"       },
  { n: 3 as WizStep, label: "Sections"      },
  { n: 4 as WizStep, label: "Subjects"      },
  { n: 5 as WizStep, label: "Rooms"         },
];

interface Props {
  initialTab?: WorkspaceTab;
}

export default function FoundationWorkspace({ initialTab = "foundation" }: Props) {
  const [wzStep, setWzStep] = useState<WizStep>(1);

  const {
    years, classes, subjects,
    loadingYears, loadingClasses, loadingSubjects,
    fetchYears, fetchClasses, fetchSubjects,
    toast, showToast,
  } = useFoundationData();

  const done = new Set<WizStep>();
  if (years.length > 0)                                     done.add(1);
  if (classes.length > 0)                                   done.add(2);
  if (classes.some((c) => (c.sections?.length ?? 0) > 0))  done.add(3);
  if (subjects.length > 0)                                  done.add(4);

  const completedCount = [1, 2, 3, 4, 5].filter((n) => done.has(n as WizStep)).length;

  return (
    <div className="min-h-screen bg-[#F0F2F5]">
      <div className="px-7 py-[22px] pb-10">
        {initialTab !== "foundation" ? (
          /* ── Coming Soon placeholder for non-Foundation tabs ── */
          <div className="flex flex-col items-center justify-center py-32 text-gray-400">
            <p className="text-6xl mb-5">{TAB_META[initialTab].icon}</p>
            <p className="text-lg font-semibold text-[#1A1D1F]">{TAB_META[initialTab].label}</p>
            <p className="text-sm text-[#6F767E] mt-2">This workspace module is coming in the next phase.</p>
            <div className="mt-6 px-4 py-2 rounded-full bg-[#EEF0FF] text-[#5B4FCF] text-[13px] font-semibold">
              Under Development
            </div>
          </div>
        ) : (
          /* ── Foundation workspace ── */
          <>
            {/* Year archive + progress row */}
            <div className="flex items-center justify-between gap-3 mb-3.5 flex-wrap">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[12px] font-semibold text-[#6F767E]">Academic Year:</span>
                {years.length === 0 ? (
                  <span className="text-[12px] text-[#9FA6AD] italic">No years yet — create one in Step 1</span>
                ) : (
                  years.map((y) => (
                    <button
                      key={y.id}
                      onClick={() => setWzStep(1)}
                      className={[
                        "flex items-center gap-1 px-3 py-1 rounded-full text-[12px] font-semibold border transition-all",
                        y.is_current
                          ? "bg-[#5B4FCF] text-white border-[#5B4FCF]"
                          : "bg-[#F0F2F5] text-[#6F767E] border-[#E8ECEF] hover:border-[#5B4FCF] hover:text-[#5B4FCF]",
                      ].join(" ")}
                    >
                      {y.name}
                      {y.is_current && <span>✓</span>}
                    </button>
                  ))
                )}
              </div>
              {/* Setup progress */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <span className="text-[11px] text-[#6F767E]">Setup progress</span>
                <div className="w-20 h-1.5 bg-[#E8ECEF] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(completedCount / 5) * 100}%`,
                      background: "linear-gradient(90deg,#5B4FCF,#8B7FE8)",
                    }}
                  />
                </div>
                <span className="text-[11px] font-semibold text-[#5B4FCF]">{completedCount}/5</span>
              </div>
            </div>

            {/* Wizard strip */}
            <div className="flex items-center bg-white rounded-xl border border-[#E8ECEF] px-4 py-3 mb-[18px] overflow-x-auto gap-0 shadow-sm">
              {WZ_STEPS.map((s, i) => {
                const isAct  = wzStep === s.n;
                const isDone = done.has(s.n);
                return (
                  <div key={s.n} className="flex items-center">
                    <button
                      onClick={() => setWzStep(s.n)}
                      className={[
                        "flex items-center gap-1.5 px-2.5 py-1 rounded-lg transition-all flex-shrink-0",
                        isAct ? "bg-[#F5F3FF]" : "hover:bg-[#F0F2F5]",
                      ].join(" ")}
                    >
                      <span
                        className={[
                          "w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold border-2 flex-shrink-0 transition-all",
                          isAct   ? "bg-[#5B4FCF] border-[#5B4FCF] text-white"
                          : isDone ? "bg-[#22C55E] border-[#22C55E] text-white"
                          : "bg-[#F0F2F5] border-[#D2D7DC] text-[#9FA6AD]",
                        ].join(" ")}
                      >
                        {!isAct && isDone ? "✓" : s.n}
                      </span>
                      <span
                        className={[
                          "text-[12px] font-semibold",
                          isAct   ? "text-[#5B4FCF]"
                          : isDone ? "text-[#15803D]"
                          : "text-[#9FA6AD]",
                        ].join(" ")}
                      >
                        {s.label}
                      </span>
                    </button>
                    {i < WZ_STEPS.length - 1 && (
                      <span className="text-[#D2D7DC] text-xl mx-0.5 flex-shrink-0 select-none">›</span>
                    )}
                  </div>
                );
              })}
              <div className="ml-auto pl-4 flex-shrink-0 text-[11px] text-[#6F767E] whitespace-nowrap hidden sm:block">
                Click any step to jump
              </div>
            </div>

            {/* Wizard pane */}
            {wzStep === 1 && (
              <AcademicYearPane
                years={years}
                loading={loadingYears}
                onRefresh={() => void fetchYears()}
                showToast={showToast}
                onNext={() => setWzStep(2)}
              />
            )}
            {wzStep === 2 && (
              <ClassesPane
                classes={classes}
                loading={loadingClasses}
                onRefresh={() => void fetchClasses()}
                showToast={showToast}
                onBack={() => setWzStep(1)}
                onNext={() => setWzStep(3)}
              />
            )}
            {wzStep === 3 && (
              <SectionsPane
                classes={classes}
                loading={loadingClasses}
                onRefresh={() => void fetchClasses()}
                showToast={showToast}
                onBack={() => setWzStep(2)}
                onNext={() => setWzStep(4)}
              />
            )}
            {wzStep === 4 && (
              <SubjectsPane
                classes={classes}
                showToast={showToast}
                onBack={() => setWzStep(3)}
                onComplete={() => setWzStep(5)}
              />
            )}
            {wzStep === 5 && (
              <RoomsPane
                showToast={showToast}
                onBack={() => setWzStep(4)}
                onNext={() => showToast("Foundation setup complete!", "success")}
              />
            )}
          </>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={[
            "fixed top-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg text-[13px] font-semibold shadow-2xl max-w-sm",
            toast.tone === "success" ? "bg-[#1A1D1F] text-white" : "bg-[#EF4444] text-white",
          ].join(" ")}
        >
          <span className="shrink-0">{toast.tone === "success" ? "✓" : "✕"}</span>
          <span className="break-words">{toast.message}</span>
        </div>
      )}
    </div>
  );
}