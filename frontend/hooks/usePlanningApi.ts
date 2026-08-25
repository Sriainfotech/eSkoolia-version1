/**
 * Planning Studio API hooks — same apiRequestWithRefresh pattern as useHrApi.ts.
 */
import { useCallback, useEffect, useState } from "react";
import { apiRequestWithRefresh, apiRequestWithRefreshResponse } from "@/lib/api-auth";
import type {
  Homework,
  HomeworkSubmission,
  Lesson,
  LessonGroup,
  LessonPlanApprovalLogEntry,
  LessonPlanner,
  LessonTopicDetail,
  PagedResponse,
  UploadedContent,
  WorkflowStatus,
} from "@/types/academics";

export class PlanningApiError extends Error {
  errors?: Record<string, unknown>;
  constructor(message: string, errors?: Record<string, unknown>) {
    super(message);
    this.errors = errors;
  }
}

async function throwApiError(res: Response): Promise<never> {
  const body = await res.json().catch(() => ({})) as { message?: string; errors?: Record<string, unknown> };
  throw new PlanningApiError(body.message ?? "Request failed", body.errors);
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

async function postJson<T>(path: string, body: unknown, method: "POST" | "PATCH" = "POST"): Promise<T> {
  const res = await apiRequestWithRefreshResponse(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return throwApiError(res);
  const json = await res.json();
  return (json.data ?? json) as T;
}

async function deleteJson(path: string): Promise<void> {
  const res = await apiRequestWithRefreshResponse(path, { method: "DELETE" });
  if (!res.ok) return throwApiError(res);
}

// ─── Overview (All Classes cards + Matrix) ──────────────────────────────────

export interface ClassOverviewSubject {
  subject_id: number; subject_name: string; done: number; total: number; pct: number;
}
export interface ClassOverviewRow {
  class_id: number; class_name: string; section_id: number; section_name: string;
  level: string | null; teacher_id: number | null; teacher_name: string;
  overall_pct: number; subjects: ClassOverviewSubject[]; lessons_count: number; hw_due_count: number;
}

export function useClassOverview() {
  const { data, loading, error, refetch } = useFetch<ClassOverviewRow[]>("/api/v1/academics/lessons/overview/");
  return { rows: data ?? [], loading, error, refetch };
}

// ─── Lessons (chapters) & topics ────────────────────────────────────────────

export function useLessonGroups(classId?: number | null, sectionId?: number | null, subjectId?: number | null) {
  const params = new URLSearchParams();
  if (classId) params.set("class_id", String(classId));
  if (sectionId) params.set("section_id", String(sectionId));
  if (subjectId) params.set("subject_id", String(subjectId));
  const { data, loading, error, refetch } = useFetch<LessonGroup[]>(
    `/api/v1/academics/lessons/grouped/?${params.toString()}`, [classId, sectionId, subjectId],
  );
  return { groups: data ?? [], loading, error, refetch };
}

export async function createLesson(body: {
  class_id: number; section_id: number | null; subject_id: number; lesson_title: string;
}): Promise<Lesson> {
  return postJson<Lesson>("/api/v1/academics/lessons/", body);
}

export function useLessonTopics(lessonId: number | null) {
  const { data, loading, error, refetch } = useFetch<PagedResponse<LessonTopicDetail> | LessonTopicDetail[]>(
    lessonId ? `/api/v1/academics/lesson-topic-details/?lesson=${lessonId}&page_size=100` : "", [lessonId],
  );
  return { topics: lessonId ? extractList(data) : [], loading, error, refetch };
}

/**
 * Creates a topic under a chapter. The backend models this as a bulk
 * operation (POST with `topic` as a list of title strings) that creates
 * a LessonTopic container plus one LessonTopicDetail per title — there is
 * no single-topic create endpoint. `section_id` is required by the backend
 * (unlike Lesson, a topic can't apply to "all sections").
 */
export async function createLessonTopic(body: {
  class_id: number; section_id: number; subject_id: number; lesson_id: number; topic: string[];
}): Promise<void> {
  await postJson("/api/v1/academics/lesson-topics/", body);
}

export async function toggleTopicDone(id: number, done: boolean): Promise<void> {
  await postJson(`/api/v1/academics/lesson-topic-details/${id}/`, { completed_status: done ? "Completed" : "Planned" }, "PATCH");
}

export async function updateLessonTopic(id: number, topic_title: string): Promise<LessonTopicDetail> {
  return postJson<LessonTopicDetail>(`/api/v1/academics/lesson-topic-details/${id}/`, { topic_title }, "PATCH");
}

export async function deleteLessonTopic(id: number): Promise<void> {
  await deleteJson(`/api/v1/academics/lesson-topic-details/${id}/`);
}

// ─── Lesson Planners (the actual lesson plan + workflow) ───────────────────

export function useLessonPlanners(filters: { classId?: number | null; sectionId?: number | null; subjectId?: number | null; workflowStatus?: WorkflowStatus | null }) {
  const params = new URLSearchParams();
  if (filters.classId) params.set("class_id", String(filters.classId));
  if (filters.sectionId) params.set("section_id", String(filters.sectionId));
  if (filters.subjectId) params.set("subject_id", String(filters.subjectId));
  if (filters.workflowStatus) params.set("workflow_status", filters.workflowStatus);
  const { data, loading, error, refetch } = useFetch<PagedResponse<LessonPlanner> | LessonPlanner[]>(
    `/api/v1/academics/lesson-planners/?${params.toString()}&page_size=200`,
    [filters.classId, filters.sectionId, filters.subjectId, filters.workflowStatus],
  );
  return { plans: extractList(data), loading, error, refetch };
}

export async function createLessonPlan(body: Record<string, unknown>): Promise<LessonPlanner> {
  return postJson<LessonPlanner>("/api/v1/academics/lesson-planners/", body);
}

export async function updateLessonPlan(id: number, body: Record<string, unknown>): Promise<LessonPlanner> {
  return postJson<LessonPlanner>(`/api/v1/academics/lesson-planners/${id}/`, body, "PATCH");
}

export async function deleteLessonPlan(id: number): Promise<void> {
  await deleteJson(`/api/v1/academics/lesson-planners/${id}/`);
}

export async function submitLessonPlan(id: number): Promise<LessonPlanner> {
  return postJson<LessonPlanner>(`/api/v1/academics/lesson-planners/${id}/submit/`, {});
}

export async function reviewLessonPlan(id: number, workflow_status: WorkflowStatus, notes?: string): Promise<LessonPlanner> {
  return postJson<LessonPlanner>(`/api/v1/academics/lesson-planners/${id}/review/`, { workflow_status, notes });
}

export function useApprovalLog(lessonPlannerId?: number | null) {
  const qs = lessonPlannerId ? `?lesson_planner_id=${lessonPlannerId}&page_size=100` : "?page_size=100";
  const { data, loading, error, refetch } = useFetch<PagedResponse<LessonPlanApprovalLogEntry> | LessonPlanApprovalLogEntry[]>(
    `/api/v1/academics/lesson-plan-approval-log/${qs}`, [lessonPlannerId],
  );
  return { entries: extractList(data), loading, error, refetch };
}

// ─── Homework ───────────────────────────────────────────────────────────────

export function useHomeworkList(classId?: number | null, sectionId?: number | null, subjectId?: number | null) {
  const params = new URLSearchParams();
  if (classId) params.set("class_id", String(classId));
  if (sectionId) params.set("section_id", String(sectionId));
  if (subjectId) params.set("subject_id", String(subjectId));
  const { data, loading, error, refetch } = useFetch<PagedResponse<Homework> | Homework[]>(
    `/api/v1/academics/homeworks/?${params.toString()}&page_size=100`, [classId, sectionId, subjectId],
  );
  return { homeworks: extractList(data), loading, error, refetch };
}

export async function createHomework(body: Record<string, unknown>): Promise<Homework> {
  return postJson<Homework>("/api/v1/academics/homeworks/", body);
}

export function useHomeworkSubmissions(homeworkId: number | null) {
  const { data, loading, error, refetch } = useFetch<PagedResponse<HomeworkSubmission> | HomeworkSubmission[]>(
    homeworkId ? `/api/v1/academics/homework-submissions/?homework=${homeworkId}&page_size=200` : "", [homeworkId],
  );
  return { submissions: homeworkId ? extractList(data) : [], loading, error, refetch };
}

export async function evaluateSubmission(id: number, marks: number, note?: string): Promise<void> {
  await postJson(`/api/v1/academics/homework-submissions/${id}/`, { marks, complete_status: "C", note }, "PATCH");
}

// ─── Uploaded content (syllabus / study material) ──────────────────────────

export function useUploadedContent(classId?: number | null, contentType?: string) {
  const params = new URLSearchParams();
  if (classId) params.set("class_id", String(classId));
  if (contentType) params.set("content_type", contentType);
  const { data, loading, error, refetch } = useFetch<PagedResponse<UploadedContent> | UploadedContent[]>(
    `/api/v1/academics/upload-contents/?${params.toString()}&page_size=100`, [classId, contentType],
  );
  return { items: extractList(data), loading, error, refetch };
}

export async function uploadContent(formData: FormData): Promise<UploadedContent> {
  const res = await apiRequestWithRefreshResponse("/api/v1/academics/upload-contents/", { method: "POST", body: formData });
  if (!res.ok) return throwApiError(res);
  const json = await res.json();
  return (json.data ?? json) as UploadedContent;
}

// ─── Parent Syllabus PDF ────────────────────────────────────────────────────

export function parentSyllabusPdfUrl(classId: string | number, detail: "topics" | "chapters", schoolName?: string): string {
  const params = new URLSearchParams({ class_id: String(classId), detail });
  if (schoolName) params.set("school_name", schoolName);
  return `/api/v1/academics/lessons/parent-syllabus-pdf/?${params.toString()}`;
}
