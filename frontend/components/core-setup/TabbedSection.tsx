"use client";

import { ReactNode } from "react";

export interface Tab {
  key: string;
  label: string;
  count: number;
  content: ReactNode;
}

interface TabbedSectionProps {
  activeKey: string;
  onTabChange: (key: string) => void;
  tabs: Tab[];
}

export default function TabbedSection({ activeKey, onTabChange, tabs }: TabbedSectionProps) {

  return (
    <div className="mb-4 rounded-3xl bg-white border border-zinc-200 overflow-hidden shadow-sm">
      {/* Header strip with badge and title */}
      <div className="px-5 py-3.5 border-b border-zinc-200 bg-gradient-to-r from-white to-zinc-50 flex items-start gap-2.5">
        <div className="w-10 h-10 rounded-lg bg-violet-50 text-violet-600 flex items-center justify-center font-[var(--font-playfair)] text-[13px] font-semibold">
          01
        </div>
        <div>
          <h2 className="font-[var(--font-playfair)] text-[20px] font-medium text-zinc-900 mb-0.5">
            Manage Setup
          </h2>
          <p className="text-[13px] text-zinc-600">
            Organize your academic structure for the year
          </p>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="px-5 border-b border-zinc-200 flex items-center overflow-x-auto">
        {tabs.map((tab) => {
          const isActive = activeKey === tab.key;
          const isAcademicClassSection = tab.key === "years" || tab.key === "classes" || tab.key === "sections";
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`px-3 py-2.5 text-[13px] font-medium whitespace-nowrap transition border-b-2 ${
                isActive
                  ? "text-violet-600 border-b-violet-600"
                  : "text-zinc-600 border-b-transparent hover:text-zinc-900"
              }`}
            >
              <span className={isAcademicClassSection ? "font-[var(--font-playfair)]" : ""}>{tab.label}</span>
              <span
                className={`ml-2 inline-block px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                  isActive
                    ? "bg-violet-50 text-violet-600"
                    : "bg-zinc-200 text-zinc-600"
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="px-5 py-4">
        {tabs.find((t) => t.key === activeKey)?.content}
      </div>
    </div>
  );
}
