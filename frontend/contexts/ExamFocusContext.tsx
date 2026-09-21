"use client";

import { createContext, useContext, useEffect, useState } from "react";

const STORAGE_KEY = "exam_focus_exam_type_id";

interface ExamFocusApi {
  /** The exam type (term) currently in focus across the Examination module, or null before a choice exists. */
  examTypeId: number | null;
  setExamTypeId: (id: number | null) => void;
  /**
   * True once the provider has attempted to read a previously-stored focus from
   * localStorage. Pages that seed a default ("pick the first exam in the list")
   * should wait for this before doing so — otherwise a page can seed its own
   * default and overwrite the stored value a beat before the provider gets to
   * read it back.
   */
  hydrated: boolean;
}

const ExamFocusContext = createContext<ExamFocusApi | null>(null);

/**
 * Shared "which exam is in focus" state for the whole Examination module,
 * mounted once in app/(dashboard)/exams/layout.tsx so it survives client-side
 * navigation between the module's six pages (a Next.js layout stays mounted
 * across sibling route changes) — that's what stops the exam from being
 * re-picked on every page. localStorage persistence on top of that means it
 * also survives a full reload or a direct link into any one page.
 */
export function ExamFocusProvider({ children }: { children: React.ReactNode }) {
  const [examTypeId, setExamTypeIdState] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      const parsed = stored ? Number(stored) : NaN;
      if (Number.isFinite(parsed)) setExamTypeIdState(parsed);
    } catch {
      // localStorage unavailable (private browsing, etc.) — pages fall back to their own default.
    } finally {
      setHydrated(true);
    }
  }, []);

  const setExamTypeId = (id: number | null) => {
    setExamTypeIdState(id);
    try {
      if (id === null) window.localStorage.removeItem(STORAGE_KEY);
      else window.localStorage.setItem(STORAGE_KEY, String(id));
    } catch {
      // ignore — focus still works for the rest of this session via state alone.
    }
  };

  return (
    <ExamFocusContext.Provider value={{ examTypeId, setExamTypeId, hydrated }}>
      {children}
    </ExamFocusContext.Provider>
  );
}

export function useExamFocus(): ExamFocusApi {
  const ctx = useContext(ExamFocusContext);
  if (!ctx) {
    throw new Error("useExamFocus must be used within an ExamFocusProvider (see app/(dashboard)/exams/layout.tsx)");
  }
  return ctx;
}
