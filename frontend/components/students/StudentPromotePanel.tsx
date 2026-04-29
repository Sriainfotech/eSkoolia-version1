"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { TopToast } from "@/components/common/TopToast";
import { studentThemeClassName } from "./studentTheme";
import { promotionApi, type PromotionBatch, type PromotionRecord } from "@/lib/promotion-api";
import SmartFilter from "@/app/(dashboard)/students/promote/components/PromoteSmartFilter";
import ClassAccordion from "@/app/(dashboard)/students/promote/components/ClassAccordionCard";

// ---- Types ----

type ApiList<T> = T[] | { results?: T[] };
type AcademicYear = { id: number; name: string; is_current?: boolean };
type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };

type StudentRow = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name?: string;
  current_class?: number | null;
  current_section?: number | null;
  is_active: boolean;
};

type PromoteResponse = {
  success?: boolean;
  promoted?: number;
  failed?: number;
  total?: number;
  errors?: Array<{ student_id: number; admission_no: string; error: string }>;
  message?: string;
  detail?: string;
};

type RecordDecision = {
  status: "pending" | "promote" | "not_promoted";
  retention_reason: string;
  notes: string;
};

// ---- Helpers ----

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function fieldStyle(hasError = false) {
  return {
    width: "100%",
    height: 36,
    border: `1px solid ${hasError ? "#dc2626" : "var(--line)"}`,
    borderRadius: 8,
    padding: "0 10px",
    backgroundColor: hasError ? "#fef2f2" : "transparent",
    fontFamily: "inherit",
    fontSize: 13,
  } as const;
}

function btnStyle(color = "var(--primary)", disabled = false) {
  return {
    height: 36,
    padding: "0 14px",
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  } as const;
}

function secondaryBtnStyle(disabled = false) {
  return {
    height: 36,
    padding: "0 14px",
    border: "1px solid var(--line)",
    background: "transparent",
    color: "var(--primary)",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  } as const;
}

function boxStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
  } as const;
}

function errorBoxStyle() {
  return {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "var(--radius)",
    padding: 12,
    marginBottom: 12,
    color: "#dc2626",
    fontSize: 13,
  } as const;
}

function successBoxStyle() {
  return {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: "var(--radius)",
    padding: 12,
    marginBottom: 12,
    color: "#059669",
    fontSize: 13,
  } as const;
}

function BatchStatusBadge({ status }: { status: PromotionBatch["status"] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    draft:       { label: "Draft",       color: "#92400e", bg: "#fef3c7" },
    in_progress: { label: "In Progress", color: "#1d4ed8", bg: "#dbeafe" },
    confirmed:   { label: "Confirmed",   color: "#065f46", bg: "#d1fae5" },
    finalized:   { label: "Finalized",   color: "#3730a3", bg: "#e0e7ff" },
  };
  const s = map[status] ?? { label: status, color: "#374151", bg: "#f3f4f6" };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "3px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>
      {s.label}
    </span>
  );
}

function RecordStatusBadge({ status }: { status: PromotionRecord["status"] }) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    promote:      { label: "Promote",      color: "#065f46", bg: "#d1fae5" },
    not_promoted: { label: "Not Promoted", color: "#dc2626", bg: "#fef2f2" },
    pending:      { label: "Pending",      color: "#92400e", bg: "#fef3c7" },
  };
  const s = map[status] ?? { label: status, color: "#374151", bg: "#f3f4f6" };
  return (
    <span style={{ background: s.bg, color: s.color, padding: "3px 8px", borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
      {s.label}
    </span>
  );
}

function fullName(row: StudentRow) {
  return `${row.first_name || ""} ${row.last_name || ""}`.trim() || "-";
}

function sanitizeLabel(value: string) {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}

function formatClassDisplayName(name: string, id: number) {
  const cleaned = sanitizeLabel(name);
  if (!cleaned) return `Class ${id}`;
  if (/^\d+$/.test(cleaned)) return `Class ${cleaned}`;
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function parseAcademicYearStart(name: string): number | null {
  const cleaned = sanitizeLabel(name);
  const match = cleaned.match(/^(\d{4})-(\d{4})$/);
  if (!match) return null;
  const start = Number(match[1]);
  const end = Number(match[2]);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end !== start + 1) return null;
  return start;
}

// ---- Component ----

export function StudentPromotePanel() {
  // ---- Tab ----
  const [activeTab, setActiveTab] = useState<"batch" | "quick">("batch");

  // ---- Shared criteria data ----
  const [years, setYears]     = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(true);
  const [toast, setToast]     = useState<{ message: string; tone: "success" | "error" } | null>(null);

  // ---- Quick Promote state ----
  const [currentSections, setCurrentSections]   = useState<Section[]>([]);
  const [promoteSections, setPromoteSections]   = useState<Section[]>([]);
  const [students, setStudents]                 = useState<StudentRow[]>([]);
  const [currentYearId, setCurrentYearId]       = useState("");
  const [currentClassId, setCurrentClassId]     = useState("");
  const [currentSectionId, setCurrentSectionId] = useState("");
  const [promoteYearId, setPromoteYearId]       = useState("");
  const [promoteClassId, setPromoteClassId]     = useState("");
  const [promoteSectionId, setPromoteSectionId] = useState("");
  const [checked, setChecked]                   = useState<Record<number, boolean>>({});
  const [loadingStudents, setLoadingStudents]               = useState(false);
  const [loadingCurrentSections, setLoadingCurrentSections] = useState(false);
  const [loadingPromoteSections, setLoadingPromoteSections] = useState(false);
  const [promoting, setPromoting]               = useState(false);
  const [error, setError]                       = useState("");
  const [success, setSuccess]                   = useState("");
  const [searchErrors, setSearchErrors]         = useState<Record<string, string>>({});
  const [promoteErrors, setPromoteErrors]       = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm]           = useState(false);
  const [currentPage, setCurrentPage]           = useState(1);
  const pageSize = 10;

  // ---- Batch Promote state ----
  const [batchFromYearId, setBatchFromYearId]         = useState("");
  const [batchToYearId, setBatchToYearId]             = useState("");
  const [batch, setBatch]                             = useState<PromotionBatch | null>(null);
  const [loadingBatch, setLoadingBatch]               = useState(false);
  const [recordDecisions, setRecordDecisions]         = useState<Record<number, RecordDecision>>({});
  const [savingDecisions, setSavingDecisions]         = useState(false);
  const [confirmingBatch, setConfirmingBatch]         = useState(false);
  const [finalizingBatch, setFinalizingBatch]         = useState(false);
  const [aiLoadingId, setAiLoadingId]                 = useState<number | null>(null);
  const [batchError, setBatchError]                   = useState("");
  const [batchSuccess, setBatchSuccess]               = useState("");
  const [showFinalizeConfirm, setShowFinalizeConfirm] = useState(false);
  const [smartSearch, setSmartSearch]                 = useState("");
  const [smartStatus, setSmartStatus]                 = useState<"all" | "pending" | "promote" | "not_promoted">("all");
  const [smartClassId, setSmartClassId]               = useState("all");
  const [expandedClassKeys, setExpandedClassKeys]     = useState<Record<string, boolean>>({});

  // ---- Shared computed ----
  const validAcademicYears = useMemo(
    () => years.filter((item) => /^\d{4}-\d{4}$/.test(sanitizeLabel(item.name))),
    [years],
  );

  const currentAcademicYearStart = useMemo(() => {
    const current = years.find((item) => item.is_current);
    if (!current) return null;
    return parseAcademicYearStart(current.name);
  }, [years]);

  const promotableAcademicYears = useMemo(() => {
    if (currentAcademicYearStart == null) return validAcademicYears;
    return validAcademicYears.filter((item) => {
      const start = parseAcademicYearStart(item.name);
      return start != null && start >= currentAcademicYearStart;
    });
  }, [validAcademicYears, currentAcademicYearStart]);

  const normalizedClasses = useMemo(
    () => classes.map((item) => ({ ...item, display_name: formatClassDisplayName(item.name, item.id) })),
    [classes],
  );

  const classMap = useMemo(
    () => new Map(normalizedClasses.map((item) => [item.id, item.display_name])),
    [normalizedClasses],
  );

  const sectionMap = useMemo(() => {
    const merged = [...currentSections, ...promoteSections];
    return new Map(merged.map((item) => [item.id, sanitizeLabel(item.name)]));
  }, [currentSections, promoteSections]);

  const filteredBatchRecords = useMemo(() => {
    if (!batch) return [];
    const q = smartSearch.trim().toLowerCase();
    return batch.records.filter((rec) => {
      if (smartStatus !== "all" && rec.status !== smartStatus) {
        return false;
      }
      const classKey = rec.from_class == null ? "unassigned" : String(rec.from_class);
      if (smartClassId !== "all" && classKey !== smartClassId) {
        return false;
      }
      if (!q) {
        return true;
      }
      const hay = [
        rec.student_name,
        rec.admission_no,
        rec.from_class_name || "",
        rec.from_section_name || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [batch, smartSearch, smartStatus, smartClassId]);

  const groupedBatchRecords = useMemo(() => {
    const map = new Map<string, { classId: number | null; classLabel: string; records: PromotionRecord[] }>();
    filteredBatchRecords.forEach((rec) => {
      const key = rec.from_class == null ? "unassigned" : String(rec.from_class);
      const existing = map.get(key);
      if (existing) {
        existing.records.push(rec);
      } else {
        map.set(key, {
          classId: rec.from_class,
          classLabel: rec.from_class_name || "Unassigned Class",
          records: [rec],
        });
      }
    });
    return Array.from(map.entries()).map(([key, value]) => ({ key, ...value }));
  }, [filteredBatchRecords]);

  const batchClassOptions = useMemo(() => {
    if (!batch) return [];
    const map = new Map<string, { key: string; classId: number | null; classLabel: string }>();
    batch.records.forEach((rec) => {
      const key = rec.from_class == null ? "unassigned" : String(rec.from_class);
      if (!map.has(key)) {
        map.set(key, {
          key,
          classId: rec.from_class,
          classLabel: rec.from_class_name || "Unassigned Class",
        });
      }
    });
    return Array.from(map.values());
  }, [batch]);

  // Quick promote pagination
  const searchedRows = useMemo(() => {
    return students.filter((row) => {
      if (!row.is_active) return false;
      if (currentClassId && String(row.current_class || "") !== currentClassId) return false;
      if (currentSectionId && String(row.current_section || "") !== currentSectionId) return false;
      return true;
    });
  }, [students, currentClassId, currentSectionId]);

  const totalPages = Math.max(1, Math.ceil(searchedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return searchedRows.slice(start, start + pageSize);
  }, [searchedRows, currentPage]);

  const selectedIds = useMemo(
    () => Object.entries(checked).filter(([, v]) => v).map(([id]) => Number(id)),
    [checked],
  );

  // ---- Initial load ----
  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCriteria(true);
        setError("");
        const [yearData, classData, sectionData] = await Promise.all([
          apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
          apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
          apiGet<ApiList<Section>>("/api/v1/core/sections/?page_size=200"),
        ]);
        const loadedYears = listData(yearData);
        setYears(loadedYears);
        setClasses(listData(classData));
        const allSections = listData(sectionData);
        setCurrentSections(allSections);
        setPromoteSections(allSections);

        const current = loadedYears.find((item) => item.is_current && /^\d{4}-\d{4}$/.test(sanitizeLabel(item.name)));
        if (current) {
          setCurrentYearId(String(current.id));
          setBatchFromYearId(String(current.id));
          const [start] = sanitizeLabel(current.name).split("-");
          const nextStart = Number(start) + 1;
          const nextYear = loadedYears.find((item) => sanitizeLabel(item.name) === `${nextStart}-${nextStart + 1}`);
          if (nextYear) {
            setPromoteYearId(String(nextYear.id));
            setBatchToYearId(String(nextYear.id));
          }
        } else {
          const now = new Date();
          const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          const suggested = `${startYear + 1}-${startYear + 2}`;
          const suggestedYear = loadedYears.find((item) => sanitizeLabel(item.name) === suggested);
          if (suggestedYear) setPromoteYearId(String(suggestedYear.id));
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        setError(message && message !== "401" ? message : "Unable to load promote criteria.");
      } finally {
        setLoadingCriteria(false);
      }
    };
    void load();
  }, []);

  // ---- Quick Promote: section loaders ----
  const loadSectionsForClass = async (targetClassId: string, type: "current" | "promote") => {
    if (!targetClassId) {
      if (type === "current") { setCurrentSections([]); setCurrentSectionId(""); }
      else { setPromoteSections([]); setPromoteSectionId(""); }
      return;
    }
    try {
      if (type === "current") { setLoadingCurrentSections(true); setCurrentSectionId(""); }
      else { setLoadingPromoteSections(true); setPromoteSectionId(""); }
      let nextSections: Section[] = [];
      try {
        const data = await apiGet<ApiList<Section>>(`/api/v1/core/sections/?class=${encodeURIComponent(targetClassId)}&page_size=200`);
        nextSections = listData(data);
      } catch {
        const fallback = await apiGet<ApiList<Section>>(`/api/v1/core/sections/?school_class=${encodeURIComponent(targetClassId)}&page_size=200`);
        nextSections = listData(fallback);
      }
      if (type === "current") setCurrentSections(nextSections);
      else setPromoteSections(nextSections);
    } catch {
      setError("Unable to load sections for selected class.");
    } finally {
      if (type === "current") setLoadingCurrentSections(false);
      else setLoadingPromoteSections(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (currentClassId) void loadSectionsForClass(currentClassId, "current");
      else { setCurrentSections([]); setCurrentSectionId(""); }
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentClassId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (promoteClassId) void loadSectionsForClass(promoteClassId, "promote");
      else { setPromoteSections([]); setPromoteSectionId(""); }
    }, 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promoteClassId]);

  useEffect(() => { if (error) setToast({ message: error, tone: "error" }); }, [error]);
  useEffect(() => { if (success) setToast({ message: success, tone: "success" }); }, [success]);

  // ---- Quick Promote: handlers ----
  const validateSearch = (): boolean => {
    const errors: Record<string, string> = {};
    if (!currentClassId) errors.class = "Please select current class";
    if (!currentSectionId) errors.section = "Please select current section";
    setSearchErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const validatePromote = (): boolean => {
    const errors: Record<string, string> = {};
    if (!promoteYearId) errors.year = "Please select next academic year";
    if (!promoteClassId) errors.class = "Please select next class";
    if (!promoteSectionId) errors.section = "Please select next section";
    if (promoteClassId && currentClassId && promoteClassId === currentClassId)
      errors.class = "Next class cannot be the same as current class";
    const selectedYear = promotableAcademicYears.find((item) => String(item.id) === promoteYearId);
    if (promoteYearId && !selectedYear) errors.year = "Please select current or future academic year";
    setPromoteErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canSearch = Boolean(currentClassId && currentSectionId && !loadingStudents && !loadingCurrentSections);

  const search = async () => {
    if (!validateSearch()) return;
    try {
      setLoadingStudents(true);
      setError(""); setSuccess(""); setCurrentPage(1);
      const data = await apiGet<ApiList<StudentRow>>("/api/v1/students/students/?is_active=true");
      const rows = listData(data);
      setStudents(rows);
      const init: Record<number, boolean> = {};
      rows.forEach((row) => { init[row.id] = false; });
      setChecked(init);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Unable to fetch students for promotion.");
    } finally {
      setLoadingStudents(false);
    }
  };

  const setAll = (value: boolean) => {
    const next: Record<number, boolean> = {};
    paginatedRows.forEach((row) => { next[row.id] = value; });
    setChecked((prev) => ({ ...prev, ...next }));
  };

  const promoteConfirmed = async () => {
    if (!selectedIds.length) { setError("Please select at least one student"); return; }
    if (!validatePromote()) return;
    try {
      setPromoting(true); setError(""); setSuccess(""); setShowConfirm(false);
      const payload = {
        student_ids: selectedIds,
        to_class: Number(promoteClassId),
        to_section: promoteSectionId ? Number(promoteSectionId) : null,
        to_academic_year: Number(promoteYearId),
        note: "Promoted from Student Promote panel",
      };
      const result = await apiPost<PromoteResponse>("/api/v1/students/students/promote/", payload);
      if (result.promoted !== undefined) {
        if (result.failed && result.failed > 0) {
          setSuccess(`✓ ${result.promoted} students promoted, ${result.failed} failed`);
          if (result.errors && result.errors.length > 0)
            setError(`Failed students: ${result.errors.map((e) => e.admission_no).join(", ")}`);
        } else {
          setSuccess(`✓ All ${result.promoted} students promoted successfully!`);
        }
      } else {
        setSuccess("Students promoted successfully.");
      }
      setStudents((prev) => prev.filter((row) => !selectedIds.includes(row.id)));
      setChecked((prev) => {
        const next = { ...prev };
        selectedIds.forEach((id) => { delete next[id]; });
        return next;
      });
      await search();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Unable to promote selected students.");
    } finally {
      setPromoting(false);
    }
  };

  const promote = () => {
    if (!selectedIds.length) { setError("Please select at least one student"); return; }
    if (!validatePromote()) return;
    setShowConfirm(true);
  };

  // ---- Batch Promote: handlers ----
  const initDecisions = (records: PromotionRecord[]) => {
    const decisions: Record<number, RecordDecision> = {};
    const expanded: Record<string, boolean> = {};
    records.forEach((rec) => {
      decisions[rec.id] = {
        status: rec.status,
        retention_reason: rec.retention_reason || "",
        notes: rec.notes || "",
      };
      const key = rec.from_class == null ? "unassigned" : String(rec.from_class);
      expanded[key] = true;
    });
    setRecordDecisions(decisions);
    setExpandedClassKeys(expanded);
  };

  const loadOrCreateBatch = async () => {
    if (!batchFromYearId || !batchToYearId) {
      setBatchError("Please select both From and To academic years");
      return;
    }
    if (batchFromYearId === batchToYearId) {
      setBatchError("From Year and To Year must be different");
      return;
    }
    setLoadingBatch(true);
    setBatchError(""); setBatchSuccess("");
    try {
      const result = await promotionApi.createOrGetBatch({
        academic_year: Number(batchFromYearId),
        target_year: Number(batchToYearId),
      });
      setBatch(result);
      initDecisions(result.records);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setBatchError(msg && msg !== "401" ? msg : "Failed to load or create batch. Ensure backend migration has run.");
    } finally {
      setLoadingBatch(false);
    }
  };

  const handleDecisionChange = (recordId: number, field: keyof RecordDecision, value: string) => {
    setRecordDecisions((prev) => ({
      ...prev,
      [recordId]: { ...prev[recordId], [field]: value },
    }));
  };

  const saveDecisions = async () => {
    if (!batch) return;
    const changed = batch.records.filter((rec) => {
      const d = recordDecisions[rec.id];
      if (!d) return false;
      return (
        d.status !== rec.status ||
        d.retention_reason !== (rec.retention_reason || "") ||
        d.notes !== (rec.notes || "")
      );
    });
    if (!changed.length) { setBatchSuccess("No changes to save."); return; }
    setSavingDecisions(true); setBatchError(""); setBatchSuccess("");
    try {
      for (const rec of changed) {
        const d = recordDecisions[rec.id];
        await promotionApi.updateRecord(batch.id, {
          record_id: rec.id,
          status: d.status,
          retention_reason: d.status === "not_promoted" && d.retention_reason ? d.retention_reason : undefined,
          notes: d.notes || undefined,
        });
      }
      // Reload batch for fresh KPIs
      const refreshed = await promotionApi.createOrGetBatch({
        academic_year: batch.academic_year,
        target_year: batch.target_year,
      });
      setBatch(refreshed);
      initDecisions(refreshed.records);
      setBatchSuccess(`✓ Saved ${changed.length} decision${changed.length !== 1 ? "s" : ""} successfully`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setBatchError(msg && msg !== "401" ? msg : "Failed to save decisions");
    } finally {
      setSavingDecisions(false);
    }
  };

  const bulkMark = async (action: "promote" | "skip" | "reset") => {
    if (!batch) return;
    setSavingDecisions(true); setBatchError(""); setBatchSuccess("");
    try {
      const result = await promotionApi.bulkUpdate(batch.id, {
        action,
        scope: "selection",
        record_ids: batch.records.map((r) => r.id),
      });
      setBatch(result.batch);
      initDecisions(result.batch.records);
      const label = action === "promote" ? "Promote" : action === "skip" ? "Not Promoted" : "Pending";
      setBatchSuccess(`✓ Marked ${result.updated} students as ${label}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setBatchError(msg && msg !== "401" ? msg : "Failed to bulk update decisions");
    } finally {
      setSavingDecisions(false);
    }
  };

  const getAiRec = async (recordId: number) => {
    if (!batch || aiLoadingId === recordId) return;
    setAiLoadingId(recordId); setBatchError("");
    try {
      const result = await promotionApi.aiRecommendation(batch.id, { record_id: recordId });
      setBatch((prev) =>
        prev
          ? { ...prev, records: prev.records.map((r) => r.id === recordId ? { ...r, ai_recommendation: result.recommendation } : r) }
          : prev,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setBatchError(msg && msg !== "401" ? msg : "AI recommendation failed");
    } finally {
      setAiLoadingId(null);
    }
  };

  const confirmBatch = async () => {
    if (!batch) return;
    setConfirmingBatch(true); setBatchError(""); setBatchSuccess("");
    try {
      const result = await promotionApi.confirmBatch(batch.id);
      setBatch(result.batch);
      setBatchSuccess("✓ " + result.message);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setBatchError(msg && msg !== "401" ? msg : "Failed to confirm batch");
    } finally {
      setConfirmingBatch(false);
    }
  };

  const finalizeBatch = async () => {
    if (!batch) return;
    setFinalizingBatch(true); setBatchError(""); setShowFinalizeConfirm(false);
    try {
      const result = await promotionApi.finalizeBatch(batch.id);
      setBatch(result);
      initDecisions(result.records);
      setBatchSuccess(`✓ Batch finalized! ${result.promoted_count} promoted, ${result.retained_count} retained.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setBatchError(msg && msg !== "401" ? msg : "Failed to finalize batch");
    } finally {
      setFinalizingBatch(false);
    }
  };

  // ---- Derived ----
  const batchIsEditable = batch && batch.status !== "finalized";
  const canConfirm = batch && (batch.status === "draft" || batch.status === "in_progress") && batch.kpi.pending === 0;

  // ---- Render ----
  return (
    <div className={`${studentThemeClassName} legacy-panel student-promote-panel`}>
      {toast ? (
        <TopToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />
      ) : null}
      <style>{`
        .student-promote-panel button:focus,
        .student-promote-panel select:focus,
        .student-promote-panel input:focus {
          outline: 2px solid #5D87FF;
          outline-offset: 2px;
        }
      `}</style>

      {/* Page Header */}
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div className="student-page-header">
            <h1 className="student-page-title">Student Promote</h1>
            <div className="student-page-crumbs">
              <span>Dashboard</span><span>/</span>
              <span>Student Information</span><span>/</span>
              <span>Student Promote</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 16 }}>

          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--line)" }}>
            {(["batch", "quick"] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                aria-selected={activeTab === tab}
                style={{
                  height: 40,
                  padding: "0 20px",
                  border: "none",
                  borderBottom: activeTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
                  background: "transparent",
                  color: activeTab === tab ? "var(--primary)" : "var(--text-muted)",
                  fontWeight: activeTab === tab ? 600 : 400,
                  fontSize: 14,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  marginBottom: -2,
                }}
              >
                {tab === "batch" ? "📋 Batch Promote" : "⚡ Quick Promote"}
              </button>
            ))}
          </div>

          {/* ===== BATCH PROMOTE TAB ===== */}
          {activeTab === "batch" && (
            <div style={{ display: "grid", gap: 16 }}>
              {batchError   && <div style={errorBoxStyle()}>⚠️ {batchError}</div>}
              {batchSuccess && <div style={successBoxStyle()}>{batchSuccess}</div>}

              {/* Year selector */}
              <div className="white-box" style={boxStyle()}>
                <h3 style={{ margin: "0 0 6px 0", fontSize: 15, fontWeight: 600 }}>📅 Promotion Years</h3>
                <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 13 }}>
                  Select the from-year and to-year, then load or create a batch.
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12, alignItems: "end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                      From Academic Year <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      aria-label="From academic year"
                      value={batchFromYearId}
                      onChange={(e) => setBatchFromYearId(e.target.value)}
                      style={fieldStyle()}
                      disabled={loadingCriteria}
                    >
                      <option value="">Select Year</option>
                      {validAcademicYears.map((y) => (
                        <option key={y.id} value={y.id}>{sanitizeLabel(y.name)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                      To Academic Year <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      aria-label="To academic year"
                      value={batchToYearId}
                      onChange={(e) => setBatchToYearId(e.target.value)}
                      style={fieldStyle()}
                      disabled={loadingCriteria}
                    >
                      <option value="">Select Year</option>
                      {promotableAcademicYears.map((y) => (
                        <option key={y.id} value={y.id}>{sanitizeLabel(y.name)}</option>
                      ))}
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={() => void loadOrCreateBatch()}
                    disabled={loadingBatch || !batchFromYearId || !batchToYearId || loadingCriteria}
                    style={btnStyle("var(--primary)", loadingBatch || !batchFromYearId || !batchToYearId)}
                    aria-label="Load or create promotion batch"
                  >
                    {loadingBatch ? "⏳ Loading..." : batch ? "🔄 Reload Batch" : "📋 Load / Create Batch"}
                  </button>
                </div>
              </div>

              {/* Batch loaded */}
              {batch && (
                <>
                  {/* KPI Cards */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
                    {[
                      { label: "Total Students", value: batch.kpi.total,                      color: "#1d4ed8", bg: "#dbeafe" },
                      { label: "Promoted",        value: batch.kpi.promoted,                   color: "#065f46", bg: "#d1fae5" },
                      { label: "Not Promoted",    value: batch.kpi.not_promoted,               color: "#dc2626", bg: "#fef2f2" },
                      { label: "Pending",         value: batch.kpi.pending,                    color: "#92400e", bg: "#fef3c7" },
                      { label: "Completion",      value: `${batch.kpi.completion_percentage}%`, color: "#3730a3", bg: "#e0e7ff" },
                    ].map((card) => (
                      <div key={card.label} style={{ background: card.bg, borderRadius: 8, padding: "12px 16px", border: `1px solid ${card.color}22` }}>
                        <div style={{ fontSize: 11, color: card.color, fontWeight: 600, textTransform: "uppercase", letterSpacing: 0.5 }}>{card.label}</div>
                        <div style={{ fontSize: 24, fontWeight: 700, color: card.color, marginTop: 4 }}>{card.value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Batch meta */}
                  <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", fontSize: 13, color: "var(--text-muted)" }}>
                    <span>Status: <BatchStatusBadge status={batch.status} /></span>
                    <span>Created by: <strong>{batch.created_by_name}</strong></span>
                    <span>{sanitizeLabel(batch.academic_year_name)} → {sanitizeLabel(batch.target_year_name)}</span>
                    {batch.confirmed_at && (
                      <span>Confirmed: {new Date(batch.confirmed_at).toLocaleDateString()}</span>
                    )}
                  </div>

                  {/* Bulk actions */}
                  {batchIsEditable && (
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <span style={{ fontSize: 13, color: "var(--text-muted)", marginRight: 4 }}>Bulk mark:</span>
                      <button type="button" onClick={() => void bulkMark("promote")} disabled={savingDecisions} style={btnStyle("#16a34a", savingDecisions)}>✓ All Promote</button>
                      <button type="button" onClick={() => void bulkMark("skip")}    disabled={savingDecisions} style={btnStyle("#dc2626", savingDecisions)}>✗ All Not Promoted</button>
                      <button type="button" onClick={() => void bulkMark("reset")}   disabled={savingDecisions} style={secondaryBtnStyle(savingDecisions)}>↺ Reset All</button>
                      <div style={{ marginLeft: "auto" }}>
                        <button type="button" onClick={() => void saveDecisions()} disabled={savingDecisions} style={btnStyle("var(--primary)", savingDecisions)} aria-label="Save all row decisions">
                          {savingDecisions ? "⏳ Saving..." : "💾 Save Decisions"}
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Smart filters */}
                  <SmartFilter
                    smartSearch={smartSearch}
                    smartStatus={smartStatus}
                    smartClassId={smartClassId}
                    classOptions={batchClassOptions}
                    onSearchChange={setSmartSearch}
                    onStatusChange={setSmartStatus}
                    onClassChange={setSmartClassId}
                    onReset={() => {
                      setSmartSearch("");
                      setSmartStatus("all");
                      setSmartClassId("all");
                    }}
                    fieldStyle={fieldStyle}
                    secondaryBtnStyle={secondaryBtnStyle}
                  />

                  {/* Records Table */}
                  <div className="white-box" style={boxStyle()}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <h3 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>👥 Student Records ({filteredBatchRecords.length})</h3>
                      <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Class Accordions: {groupedBatchRecords.length}</span>
                    </div>

                    {filteredBatchRecords.length === 0 ? (
                      <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>
                        <div style={{ fontSize: 36, marginBottom: 8 }}>📭</div>
                        <div>No students match the smart filter. Try changing filter values.</div>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "grid", gap: 10 }}>
                          {groupedBatchRecords.map((group) => {
                            const isOpen = expandedClassKeys[group.key] !== false;
                            return (
                              <ClassAccordion
                                key={group.key}
                                group={group}
                                isOpen={isOpen}
                                batchStatus={batch.status}
                                batchIsEditable={Boolean(batchIsEditable)}
                                recordDecisions={recordDecisions}
                                aiLoadingId={aiLoadingId}
                                onToggle={() => setExpandedClassKeys((prev) => ({ ...prev, [group.key]: !isOpen }))}
                                onDecisionChange={handleDecisionChange}
                                onAskAi={(recordId) => void getAiRec(recordId)}
                                fieldStyle={fieldStyle}
                                renderStatusBadge={(status) => <RecordStatusBadge status={status} />}
                              />
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Action footer */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, alignItems: "center" }}>
                    {batch.kpi.pending > 0 && batchIsEditable && (
                      <span style={{ fontSize: 13, color: "#92400e" }}>
                        ⚠️ {batch.kpi.pending} student{batch.kpi.pending !== 1 ? "s" : ""} still pending — resolve before confirming
                      </span>
                    )}
                    {(batch.status === "draft" || batch.status === "in_progress") && (
                      <button
                        type="button"
                        onClick={() => void confirmBatch()}
                        disabled={confirmingBatch || !canConfirm}
                        title={batch.kpi.pending > 0 ? "Resolve all pending decisions first" : ""}
                        style={btnStyle("#2563eb", confirmingBatch || !canConfirm)}
                        aria-label="Confirm promotion batch"
                      >
                        {confirmingBatch ? "⏳ Confirming..." : "✅ Confirm Batch"}
                      </button>
                    )}
                    {batch.status === "confirmed" && (
                      <button
                        type="button"
                        onClick={() => setShowFinalizeConfirm(true)}
                        disabled={finalizingBatch}
                        style={btnStyle("#16a34a", finalizingBatch)}
                        aria-label="Finalize and apply promotions"
                      >
                        {finalizingBatch ? "⏳ Finalizing..." : "🚀 Finalize & Apply Promotions"}
                      </button>
                    )}
                    {batch.status === "finalized" && (
                      <div style={{ ...successBoxStyle(), margin: 0 }}>
                        ✅ Batch finalized — {batch.promoted_count} promoted, {batch.retained_count} retained.
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Empty state */}
              {!batch && !loadingBatch && (
                <div className="white-box" style={{ ...boxStyle(), textAlign: "center", padding: 48 }}>
                  <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                  <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No Batch Loaded</div>
                  <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                    Select From and To academic years above, then click <strong>Load / Create Batch</strong>.
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ===== QUICK PROMOTE TAB ===== */}
          {activeTab === "quick" && (
            <div style={{ display: "grid", gap: 16 }}>
              {error   && <div style={errorBoxStyle()}>⚠️ {error}</div>}
              {success && <div style={successBoxStyle()}>{success}</div>}

              {/* Search Criteria */}
              <div className="white-box" style={boxStyle()}>
                <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 16, fontWeight: 600 }}>
                  <span aria-hidden="true" style={{ color: "#5D87FF" }}>🔍</span> Search Criteria
                </h3>
                <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 13 }}>Select criteria to view students</p>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr)) auto", gap: 12, marginBottom: 6, alignItems: "end" }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>Academic Year</label>
                    <select
                      aria-label="Current academic year"
                      value={currentYearId}
                      onChange={(e) => setCurrentYearId(e.target.value)}
                      style={fieldStyle()}
                      disabled={loadingCriteria}
                    >
                      <option value="">Select Academic Year</option>
                      {validAcademicYears.map((item) => (
                        <option key={item.id} value={item.id}>{sanitizeLabel(item.name)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                      Current Class <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      aria-label="Current class"
                      value={currentClassId}
                      onChange={(e) => { setCurrentClassId(e.target.value); setCurrentSections([]); setSearchErrors((prev) => ({ ...prev, class: "" })); }}
                      style={fieldStyle(!!searchErrors.class)}
                    >
                      <option value="">Select Class</option>
                      {normalizedClasses.map((item) => (
                        <option key={item.id} value={item.id}>{item.display_name}</option>
                      ))}
                    </select>
                    {searchErrors.class && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{searchErrors.class}</p>}
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                      Current Section <span style={{ color: "#dc2626" }}>*</span>
                    </label>
                    <select
                      aria-label="Current section"
                      value={currentSectionId}
                      onChange={(e) => { setCurrentSectionId(e.target.value); setSearchErrors((prev) => ({ ...prev, section: "" })); }}
                      style={fieldStyle(!!searchErrors.section)}
                      disabled={!currentClassId || loadingCurrentSections}
                    >
                      <option value="">{loadingCurrentSections ? "Loading sections..." : currentClassId ? "Select Section" : "Select Class First"}</option>
                      {currentSections.map((item) => (
                        <option key={item.id} value={item.id}>{sanitizeLabel(item.name)}</option>
                      ))}
                    </select>
                    {searchErrors.section && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{searchErrors.section}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => void search()}
                    style={btnStyle("var(--primary)", !canSearch)}
                    disabled={!canSearch}
                    aria-label="Search students"
                  >
                    {loadingStudents ? "⏳ Fetching..." : "🔍 Search"}
                  </button>
                </div>
                {(!currentClassId || !currentSectionId) && (
                  <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>Please select Class and Section to continue</p>
                )}
              </div>

              {/* Students Table */}
              {students.length > 0 ? (
                <div className="white-box" style={boxStyle()}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📋 Select Students ({selectedIds.length} selected)</h3>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                      Page {currentPage} of {totalPages} | Total: {searchedRows.length}
                    </span>
                  </div>
                  <div style={{ overflowX: "auto", marginBottom: 16 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "var(--surface-muted)" }}>
                          <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left", width: 60 }}>
                            <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <input
                                type="checkbox"
                                onChange={(e) => setAll(e.target.checked)}
                                checked={paginatedRows.length > 0 && paginatedRows.every((row) => checked[row.id])}
                                aria-label="Select all students on current page"
                              />
                              All
                            </label>
                          </th>
                          <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left" }}>Admission No</th>
                          <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left" }}>Name</th>
                          <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left" }}>Class/Section</th>
                          <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedRows.map((row) => (
                          <tr key={row.id} style={{ borderBottom: "1px solid var(--line)" }}>
                            <td style={{ padding: 12 }}>
                              <input
                                type="checkbox"
                                checked={!!checked[row.id]}
                                onChange={(e) => setChecked((prev) => ({ ...prev, [row.id]: e.target.checked }))}
                                aria-label={`Select ${fullName(row)}`}
                              />
                            </td>
                            <td style={{ padding: 12, fontWeight: 500 }}>{row.admission_no || "-"}</td>
                            <td style={{ padding: 12 }}>{fullName(row)}</td>
                            <td style={{ padding: 12, fontSize: 13, color: "var(--text-muted)" }}>
                              {(classMap.get(row.current_class || 0) || "-") +
                                (row.current_section ? ` (${sectionMap.get(row.current_section) || "-"})` : "")}
                            </td>
                            <td style={{ padding: 12 }}>
                              <span style={{ background: "#ecfdf5", color: "#059669", padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
                                Active ✓
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Quick Promote pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
                      <button onClick={() => setCurrentPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} style={secondaryBtnStyle(currentPage === 1)}>← Previous</button>
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          style={{ ...secondaryBtnStyle(false), background: currentPage === page ? "var(--primary)" : "transparent", color: currentPage === page ? "#fff" : "var(--primary)", fontWeight: currentPage === page ? 600 : 400 }}
                        >
                          {page}
                        </button>
                      ))}
                      <button onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))} disabled={currentPage === totalPages} style={secondaryBtnStyle(currentPage === totalPages)}>Next →</button>
                    </div>
                  )}

                  {/* Promotion Summary */}
                  <div style={{ background: "#f3f4f6", padding: 16, borderRadius: 8, marginBottom: 16 }}>
                    <h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>📋 Promotion Summary</h4>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                      <div style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Students Selected</div>
                        <div style={{ fontSize: 20, fontWeight: 600, color: "var(--primary)" }}>{selectedIds.length}</div>
                      </div>
                      <div style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Destination</div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {promoteClassId ? classMap.get(Number(promoteClassId)) || "N/A" : "Not selected"}
                          {promoteSectionId ? ` (${sectionMap.get(Number(promoteSectionId)) || "N/A"})` : ""}
                        </div>
                      </div>
                      <div style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
                        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Next Academic Year</div>
                        <div style={{ fontSize: 14, fontWeight: 500 }}>
                          {promoteYearId ? validAcademicYears.find((y) => String(y.id) === promoteYearId)?.name || "N/A" : "Not selected"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Promotion Options */}
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                        Next Academic Year <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <select
                        aria-label="Next academic year"
                        value={promoteYearId}
                        onChange={(e) => { setPromoteYearId(e.target.value); setPromoteErrors((prev) => ({ ...prev, year: "" })); }}
                        style={fieldStyle(!!promoteErrors.year)}
                      >
                        <option value="">Select Year</option>
                        {promotableAcademicYears.map((item) => (
                          <option key={item.id} value={item.id}>{sanitizeLabel(item.name)}</option>
                        ))}
                      </select>
                      {promoteErrors.year && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{promoteErrors.year}</p>}
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                        Next Class <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <select
                        aria-label="Next class"
                        value={promoteClassId}
                        onChange={(e) => { setPromoteClassId(e.target.value); setPromoteSections([]); setPromoteErrors((prev) => ({ ...prev, class: "" })); }}
                        style={fieldStyle(!!promoteErrors.class)}
                      >
                        <option value="">Select Class</option>
                        {normalizedClasses.map((item) => (
                          <option key={item.id} value={item.id}>{item.display_name}</option>
                        ))}
                      </select>
                      {promoteErrors.class && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{promoteErrors.class}</p>}
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                        Next Section <span style={{ color: "#dc2626" }}>*</span>
                      </label>
                      <select
                        aria-label="Next section"
                        value={promoteSectionId}
                        onChange={(e) => { setPromoteSectionId(e.target.value); setPromoteErrors((prev) => ({ ...prev, section: "" })); }}
                        style={fieldStyle(!!promoteErrors.section)}
                        disabled={!promoteClassId || loadingPromoteSections}
                      >
                        <option value="">{loadingPromoteSections ? "Loading sections..." : promoteClassId ? "Select Section" : "Select Class First"}</option>
                        {promoteSections.map((item) => (
                          <option key={item.id} value={item.id}>{sanitizeLabel(item.name)}</option>
                        ))}
                      </select>
                      {promoteErrors.section && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{promoteErrors.section}</p>}
                    </div>
                    <div style={{ display: "flex", alignItems: "flex-end" }}>
                      <button
                        type="button"
                        onClick={() => void promote()}
                        style={btnStyle("#16a34a", promoting || !selectedIds.length)}
                        disabled={promoting || !selectedIds.length}
                        aria-label="Promote selected students"
                      >
                        {promoting ? "⏳ Promoting..." : "⬆ Promote"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : loadingStudents ? (
                <div className="white-box" style={boxStyle()}>
                  <div style={{ marginBottom: 10, color: "var(--text-muted)", fontSize: 13 }}>Loading students...</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ padding: 10, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Student</th>
                        <th style={{ padding: 10, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Class/Section</th>
                        <th style={{ padding: 10, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 5 }).map((_, index) => (
                        <tr key={index}>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}><div style={{ height: 12, width: "70%", borderRadius: 999, background: "#e2e8f0" }} /></td>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}><div style={{ height: 12, width: "60%", borderRadius: 999, background: "#e2e8f0" }} /></td>
                          <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}><div style={{ height: 12, width: "45%", borderRadius: 999, background: "#e2e8f0" }} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : students.length === 0 && currentClassId && currentSectionId ? (
                <div className="white-box" style={boxStyle()}>
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No students found</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No active students found for the selected criteria. Try changing filters.</div>
                  </div>
                </div>
              ) : (
                <div className="white-box" style={boxStyle()}>
                  <div style={{ textAlign: "center", padding: 40 }}>
                    <div style={{ fontSize: 48, marginBottom: 12 }}>🔎</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Select criteria to view students</div>
                    <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Select class and section above, then click Search to view students.</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Quick Promote confirm modal */}
      {showConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius)", padding: 24, maxWidth: 400, width: "90%", boxShadow: "0 10px 15px rgba(0,0,0,0.1)" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600 }}>⚠️ Confirm Promotion</h3>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-muted)", lineHeight: 1.6 }}>
              You are about to promote <strong>{selectedIds.length}</strong> student{selectedIds.length !== 1 ? "s" : ""} from{" "}
              <strong>{classMap.get(Number(currentClassId)) || "N/A"}</strong> ({validAcademicYears.find((item) => String(item.id) === currentYearId)?.name || "N/A"}) to{" "}
              <strong>{classMap.get(Number(promoteClassId)) || "N/A"}</strong> ({validAcademicYears.find((item) => String(item.id) === promoteYearId)?.name || "N/A"}). Proceed?
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirm(false)} style={secondaryBtnStyle(false)} aria-label="Cancel promotion">Cancel</button>
              <button onClick={() => void promoteConfirmed()} style={btnStyle("#16a34a", promoting)} disabled={promoting} aria-label="Confirm promotion">
                {promoting ? "Promoting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Finalize confirm modal */}
      {showFinalizeConfirm && batch && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius)", padding: 24, maxWidth: 440, width: "90%", boxShadow: "0 10px 15px rgba(0,0,0,0.1)" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600 }}>🚀 Finalize Promotions</h3>
            <p style={{ margin: "0 0 8px 0", color: "var(--text-muted)", lineHeight: 1.6 }}>
              This will permanently apply all decisions for <strong>{batch.kpi.total}</strong> students:
            </p>
            <ul style={{ margin: "0 0 20px 16px", color: "var(--text-muted)", fontSize: 14, lineHeight: 1.8 }}>
              <li><strong style={{ color: "#065f46" }}>{batch.kpi.promoted}</strong> students will be promoted to next class</li>
              <li><strong style={{ color: "#dc2626" }}>{batch.kpi.not_promoted}</strong> students will be retained</li>
            </ul>
            <p style={{ margin: "0 0 20px 0", color: "#dc2626", fontSize: 13, fontWeight: 500 }}>⚠️ This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowFinalizeConfirm(false)} style={secondaryBtnStyle(false)}>Cancel</button>
              <button onClick={() => void finalizeBatch()} style={btnStyle("#16a34a", finalizingBatch)} disabled={finalizingBatch}>
                {finalizingBatch ? "⏳ Finalizing..." : "🚀 Yes, Finalize"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
