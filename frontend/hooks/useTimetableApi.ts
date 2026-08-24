/**
 * Timetable API hooks — same apiRequestWithRefresh pattern as useHrApi.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from "@/lib/api-auth";
import type {
  ClashEntry,
  ClassPeriod,
  ClassRoutineSlot,
  LevelScheduleConfig,
  PagedResponse,
  Teacher,
} from "@/types/academics";

export class TimetableApiError extends Error {
  errors?: Record<string, unknown>;
  constructor(message: string, errors?: Record<string, unknown>) {
    super(message);
    this.errors = errors;
  }
}

async function throwApiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({})) as { message?: string; errors?: Record<string, unknown> };
  throw new TimetableApiError(body.message ?? "Request failed", body.errors);
}

function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchIt = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiRequestWithRefresh<T>(url, { method: "GET" });
      setData(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(false);
    }
  }, [url, ...deps]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { void fetchIt(); }, [fetchIt]);
  return { data, loading, error, refetch: fetchIt };
}

function extractList<T>(payload: PagedResponse<T> | T[] | { data?: T[] } | undefined | null): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  if ("results" in payload && Array.isArray(payload.results)) return payload.results;
  if ("data" in payload && Array.isArray(payload.data)) return payload.data as T[];
  return [];
}

// ─── Level Schedule Config (Configure Hours) ───────────────────────────────

export function useLevelScheduleConfigs(academicYearId?: number | null) {
  const qs = academicYearId ? `?academic_year_id=${academicYearId}&page_size=50` : "?page_size=50";
  const { data, loading, error, refetch } = useFetch<PagedResponse<LevelScheduleConfig> | LevelScheduleConfig[]>(
    `/api/v1/core/level-schedule-configs/${qs}`, [academicYearId],
  );
  return { configs: extractList(data), loading, error, refetch };
}

export async function saveLevelScheduleConfig(
  existingId: number | null,
  body: Partial<LevelScheduleConfig>,
): Promise<LevelScheduleConfig> {
  const path = existingId ? `/api/v1/core/level-schedule-configs/${existingId}/` : "/api/v1/core/level-schedule-configs/";
  const res = await apiRequestWithRefreshResponse(path, {
    method: existingId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError(res);
  const json = await res.json();
  return (json.data ?? json) as LevelScheduleConfig;
}

// ─── Class Periods (existing Foundation-adjacent resource) ────────────────

export function useClassPeriods() {
  const { data, loading, error, refetch } = useFetch<PagedResponse<ClassPeriod> | ClassPeriod[]>(
    "/api/v1/core/class-periods/?period_type=class&page_size=50",
  );
  return { periods: extractList(data), loading, error, refetch };
}

// ─── Class Routine Slots (the weekly grid) ─────────────────────────────────

export function useSectionRoutine(sectionId: number | null) {
  const { data, loading, error, refetch } = useFetch<PagedResponse<ClassRoutineSlot> | ClassRoutineSlot[]>(
    sectionId ? `/api/v1/academics/class-routines/?section_id=${sectionId}&page_size=200` : "",
    [sectionId],
  );
  return { slots: sectionId ? extractList(data) : [], loading, error, refetch };
}

export function useTeacherRoutine(teacherId: number | null) {
  const { data, loading, error, refetch } = useFetch<PagedResponse<ClassRoutineSlot> | ClassRoutineSlot[]>(
    teacherId ? `/api/v1/academics/class-routines/?teacher_id=${teacherId}&page_size=200` : "",
    [teacherId],
  );
  return { slots: teacherId ? extractList(data) : [], loading, error, refetch };
}

export async function saveSlot(
  existingId: number | null,
  body: {
    academic_year_id?: number | null; class_id: number; section_id: number;
    subject_id: number | null; teacher_id: number | null; day: string;
    start_time: string; end_time: string;
  },
): Promise<ClassRoutineSlot> {
  const path = existingId ? `/api/v1/academics/class-routines/${existingId}/` : "/api/v1/academics/class-routines/";
  const res = await apiRequestWithRefreshResponse(path, {
    method: existingId ? "PATCH" : "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError(res);
  const json = await res.json();
  return (json.data ?? json) as ClassRoutineSlot;
}

export async function clearSlot(id: number): Promise<void> {
  const res = await apiRequestWithRefreshResponse(`/api/v1/academics/class-routines/${id}/`, { method: "DELETE" });
  if (!res.ok && res.status !== 204) return throwApiError(res);
}

export async function autoGenerateRoutine(sectionId: number, academicYearId?: number | null): Promise<{ created_count: number }> {
  const res = await apiRequestWithRefreshResponse("/api/v1/academics/class-routines/auto-generate/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ section_id: sectionId, academic_year_id: academicYearId }),
  });
  if (!res.ok) return throwApiError(res);
  const json = await res.json();
  return json.data as { created_count: number };
}

export function useClashes() {
  const { data, loading, error, refetch } = useFetch<{
    data: { teacher_clashes: ClashEntry[]; room_clashes: ClashEntry[]; count: number };
  }>("/api/v1/academics/class-routines/clashes/");
  return {
    teacherClashes: data?.data?.teacher_clashes ?? [],
    roomClashes: data?.data?.room_clashes ?? [],
    count: data?.data?.count ?? 0,
    loading, error, refetch,
  };
}

// ─── Teachers (for the slot picker) ────────────────────────────────────────

export function useTeachersForSlot(subjectId: number | null, day: string | null, startTime: string | null, academicYearId?: number | null) {
  const params = new URLSearchParams();
  if (subjectId) params.set("subject", String(subjectId));
  if (day) params.set("available_day", day);
  if (startTime) params.set("available_start_time", startTime);
  if (academicYearId) params.set("academic_year_id", String(academicYearId));
  const { data, loading, error, refetch } = useFetch<Teacher[]>(
    `/api/v1/academics/staff/teachers/?${params.toString()}`, [subjectId, day, startTime, academicYearId],
  );
  return { teachers: data ?? [], loading, error, refetch };
}
