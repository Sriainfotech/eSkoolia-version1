"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Bell } from "lucide-react";
import type { MorningBriefData, StageTab } from "@/types/admissions";

interface Props {
  data: MorningBriefData;
  onCardClick: (stage: StageTab) => void;
  isLoading?: boolean;
  priorityText?: string;
}

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: "easeOut" } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
};

function AnimatedCount({ target }: { target: number }) {
  const [display, setDisplay] = useState(0);
  const frameRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setDisplay(0);
    if (target === 0) return;
    const steps = 20;
    let step = 0;
    frameRef.current = setInterval(() => {
      step++;
      setDisplay(Math.round((target * step) / steps));
      if (step >= steps) clearInterval(frameRef.current!);
    }, 30);
    return () => { if (frameRef.current) clearInterval(frameRef.current); };
  }, [target]);

  return <>{display}</>;
}

const CARDS: {
  key: keyof MorningBriefData;
  label: string;
  stage: StageTab;
  accent: string;
  bg: string;
  border: string;
  icon: string;
}[] = [
  { key: "newToday",        label: "New Applications",   stage: "new",     accent: "text-indigo-600", bg: "bg-indigo-50",  border: "border-indigo-100", icon: "✨" },
  { key: "overdueFollowUp", label: "Follow-up Overdue",  stage: "active",  accent: "text-amber-600",  bg: "bg-amber-50",   border: "border-amber-100",  icon: "⏰" },
  { key: "visitsToday",     label: "Visits Today",       stage: "pending", accent: "text-green-600",  bg: "bg-green-50",   border: "border-green-100",  icon: "🏫" },
  { key: "decisionsPending",label: "Decisions Pending",  stage: "pending", accent: "text-red-600",    bg: "bg-red-50",     border: "border-red-100",    icon: "⚖️" },
];

export function MorningBrief({ data, onCardClick, isLoading, priorityText }: Props) {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("acc_brief_collapsed") === "1";
  });

  const toggle = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem("acc_brief_collapsed", next ? "1" : "0");
      return next;
    });
  };

  return (
    <div>
      {/* Section header */}
      <div
        className="flex items-center gap-3 cursor-pointer py-3 px-4 hover:bg-gray-50 rounded-xl"
        onClick={toggle}
      >
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-xs font-bold text-gray-500">
          01
        </span>
        <Bell size={14} className="text-indigo-500" />
        <span className="text-sm font-semibold text-gray-800">Morning Brief</span>
        <span className="ml-2 text-xs text-gray-400">Today&apos;s priorities at a glance</span>
        <span className="ml-auto text-gray-400">
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </div>

      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.div
            key="brief-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1, transition: { duration: 0.3 } }}
            exit={{ height: 0, opacity: 0, transition: { duration: 0.2 } }}
            className="overflow-hidden"
          >
            <motion.div
              variants={stagger}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 lg:grid-cols-4 gap-3 px-4 pb-4"
            >
              {isLoading
                ? Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 h-24" />
                  ))
                : CARDS.map((c) => (
                    <motion.button
                      key={c.key}
                      variants={fadeUp}
                      whileHover={{ y: -2, transition: { duration: 0.15 } }}
                      onClick={() => onCardClick(c.stage)}
                      className={`text-left p-4 rounded-xl border ${c.bg} ${c.border} hover:shadow-md transition-shadow cursor-pointer w-full`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{c.icon}</span>
                        <span className={`text-2xl font-bold ${c.accent}`}>
                          <AnimatedCount target={data[c.key]} />
                        </span>
                      </div>
                      <p className="text-xs font-medium text-gray-600 leading-tight">{c.label}</p>
                    </motion.button>
                  ))}
            </motion.div>

            {/* Priority Narrative — smart one-liner derived from data */}
            {!isLoading && priorityText && (
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3, duration: 0.25 }}
                className="mx-4 mb-4 flex items-center gap-2 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5"
              >
                <span className="text-base flex-shrink-0">⚡</span>
                <p className="text-xs font-medium text-indigo-700 leading-tight">{priorityText}</p>
              </motion.div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
