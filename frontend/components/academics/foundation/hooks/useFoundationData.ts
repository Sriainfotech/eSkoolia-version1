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

  // Fix #W1 — ClassSubjectEntry existence check (step 4 progress indicator)
  const [subjectEntriesExist, setSubjectEntriesExist] = useState(false);
  // Fix #W2 — rooms existence check (step 5 progress indicator)
  const [roomsExist, setRoomsExist] = useState(false);

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

  // Fix #W1 — lightweight count-only fetch to know if ClassSubjectEntries exist (step 4 done indicator)
  const checkSubjectEntriesExist = useCallback(async () => {
    try {
      const res = await apiRequestWithRefresh<{ count?: number; results?: unknown[] } | unknown[]>(
        "/api/v1/academics/class-subject-entries/?page_size=1"
      );
      setSubjectEntriesExist(
        Array.isArray(res) ? res.length > 0 : ((res.count ?? 0) > 0 || (res.results?.length ?? 0) > 0)
      );
    } catch { /* non-blocking */ }
  }, []);

  // Fix #W2 — lightweight count-only fetch to know if rooms exist (step 5 done indicator)
  const checkRoomsExist = useCallback(async () => {
    try {
      const res = await apiRequestWithRefresh<{ count?: number; results?: unknown[] } | unknown[]>(
        "/api/v1/core/class-rooms/?page_size=1"
      );
      setRoomsExist(
        Array.isArray(res) ? res.length > 0 : ((res.count ?? 0) > 0 || (res.results?.length ?? 0) > 0)
      );
    } catch { /* non-blocking */ }
  }, []);

  useEffect(() => {
    void fetchYears();
    void fetchClasses();
    void fetchSubjects();
    void checkSubjectEntriesExist(); // Fix #W1
    void checkRoomsExist();          // Fix #W2
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
    subjectEntriesExist, setSubjectEntriesExist, // Fix #W1
    roomsExist, setRoomsExist,                   // Fix #W2
    loadingYears, loadingClasses, loadingSubjects, loading,
    fetchYears, fetchClasses, fetchSubjects,
    stats,
    toast, showToast,
  };
}
