"use client";
import { useCallback, useEffect, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type {
  AcademicYear,
  SchoolClass,
  Subject,
  PagedResponse,
  FoundationStats,
  Toast,
} from "../types";

const PAGE_SIZE = 200;

function extractList<T>(res: PagedResponse<T> | T[]): T[] {
  if (Array.isArray(res)) return res;
  return (res as PagedResponse<T>).results ?? [];
}

export function useFoundationData() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);

  const [loadingYears, setLoadingYears] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(true);

  const [toast, setToast] = useState<Toast | null>(null);

  const showToast = useCallback((message: string, tone: Toast["tone"] = "success") => {
    setToast({ message, tone });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // ── Fetchers ─────────────────────────────────────────────────────────────

  const fetchYears = useCallback(async () => {
    setLoadingYears(true);
    try {
      const res = await apiRequestWithRefresh<PagedResponse<AcademicYear> | AcademicYear[]>(
        `/api/v1/core/academic-years/?page_size=${PAGE_SIZE}`
      );
      setYears(extractList(res));
    } catch {
      showToast("Failed to load academic years.", "error");
    } finally {
      setLoadingYears(false);
    }
  }, [showToast]);

  const fetchClasses = useCallback(async () => {
    setLoadingClasses(true);
    try {
      const res = await apiRequestWithRefresh<PagedResponse<SchoolClass> | SchoolClass[]>(
        `/api/v1/core/classes/?page_size=${PAGE_SIZE}`
      );
      setClasses(extractList(res));
    } catch {
      showToast("Failed to load classes.", "error");
    } finally {
      setLoadingClasses(false);
    }
  }, [showToast]);

  const fetchSubjects = useCallback(async () => {
    setLoadingSubjects(true);
    try {
      const res = await apiRequestWithRefresh<PagedResponse<Subject> | Subject[]>(
        `/api/v1/core/subjects/?page_size=${PAGE_SIZE}`
      );
      setSubjects(extractList(res));
    } catch {
      showToast("Failed to load subjects.", "error");
    } finally {
      setLoadingSubjects(false);
    }
  }, [showToast]);

  useEffect(() => {
    void fetchYears();
    void fetchClasses();
    void fetchSubjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived stats ─────────────────────────────────────────────────────────

  const stats: FoundationStats = {
    years: years.length,
    currentYear: years.find((y) => y.is_current)?.name ?? "—",
    classes: classes.length,
    sections: classes.reduce((s, c) => s + (c.sections?.length ?? 0), 0),
    subjects: subjects.length,
  };

  const loading = loadingYears || loadingClasses || loadingSubjects;

  return {
    years, setYears,
    classes, setClasses,
    subjects, setSubjects,
    loadingYears, loadingClasses, loadingSubjects, loading,
    fetchYears, fetchClasses, fetchSubjects,
    stats,
    toast, showToast,
  };
}
