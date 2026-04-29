import { apiRequestWithRefresh } from "@/lib/api-auth";

export type ApiList<T> = T[] | { results?: T[] };

export type PromotionRecord = {
  id: number;
  student: number;
  student_name: string;
  admission_no: string;
  from_class: number | null;
  from_class_name?: string;
  from_section: number | null;
  from_section_name?: string;
  to_class: number | null;
  to_class_name?: string;
  to_section: number | null;
  to_section_name?: string;
  status: "pending" | "promote" | "not_promoted";
  retention_reason?: string;
  failed_subject_ids?: number[];
  notes?: string;
  ai_recommendation?: string;
  decision_made_at?: string | null;
};

export type PromotionKpi = {
  total: number;
  promoted: number;
  not_promoted: number;
  pending: number;
  completion_percentage: number;
};

export type PromotionBatch = {
  id: number;
  academic_year: number;
  academic_year_name: string;
  target_year: number;
  target_year_name: string;
  status: "draft" | "in_progress" | "confirmed" | "finalized";
  created_by_name: string;
  created_at: string;
  confirmed_at?: string | null;
  total_students: number;
  promoted_count: number;
  retained_count: number;
  kpi: PromotionKpi;
  records: PromotionRecord[];
};

export const promotionApi = {
  createOrGetBatch: (payload: { academic_year: number; target_year: number }) =>
    apiRequestWithRefresh<PromotionBatch>("/api/v1/students/promotion-batches/create-or-get/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  getBatchByYear: (yearName: string) =>
    apiRequestWithRefresh<PromotionBatch>(`/api/v1/students/promotion-batches/by-year/${encodeURIComponent(yearName)}/`),

  updateRecord: (
    batchId: number,
    payload: {
      record_id: number;
      status: "pending" | "promote" | "not_promoted";
      retention_reason?: string;
      failed_subject_ids?: number[];
      notes?: string;
      to_class?: number | null;
      to_section?: number | null;
    },
  ) =>
    apiRequestWithRefresh<PromotionRecord>(`/api/v1/students/promotion-batches/${batchId}/update-record/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  bulkUpdate: (
    batchId: number,
    payload: {
      action: "promote" | "skip" | "reset";
      scope: "class" | "section" | "selection";
      class_id?: number;
      section_id?: number;
      record_ids?: number[];
    },
  ) =>
    apiRequestWithRefresh<{ updated: number; batch: PromotionBatch }>(`/api/v1/students/promotion-batches/${batchId}/bulk-update/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  aiRecommendation: (batchId: number, payload: { record_id: number; reason?: string }) =>
    apiRequestWithRefresh<{ recommendation: string }>(`/api/v1/students/promotion-batches/${batchId}/ai-recommendation/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }),

  confirmBatch: (batchId: number) =>
    apiRequestWithRefresh<{ message: string; batch: PromotionBatch }>(`/api/v1/students/promotion-batches/${batchId}/confirm/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }),

  finalizeBatch: (batchId: number) =>
    apiRequestWithRefresh<PromotionBatch>(`/api/v1/students/promotion-batches/${batchId}/finalize/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }),
};
