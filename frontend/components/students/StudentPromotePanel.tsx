"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { TopToast } from "@/components/common/TopToast";
import { promotionApi, type PromotionBatch, type PromotionRecord } from "@/lib/promotion-api";

import PromoteHeader, { type AcademicYearOption } from "@/app/(dashboard)/students/promote/components/PromoteHeader";
import PromoteKPICards from "@/app/(dashboard)/students/promote/components/PromoteKPICards";
import PromoteSmartFilter, {
  type StatusFilter,
} from "@/app/(dashboard)/students/promote/components/PromoteSmartFilter";
import ClassAccordionCard, {
  type ClassGroup,
} from "@/app/(dashboard)/students/promote/components/ClassAccordionCard";
import NotPromotedDialog, {
  type RetentionReason,
} from "@/app/(dashboard)/students/promote/components/NotPromotedDialog";
import ConfirmBatchModal from "@/app/(dashboard)/students/promote/components/ConfirmBatchModal";
import type { RecordDecision } from "@/app/(dashboard)/students/promote/components/PromoteStudentTable";
import type { SectionTabItem } from "@/app/(dashboard)/students/promote/components/PromoteSectionTabs";

// ── Types ──────────────────────────────────────────────────────────────────────

type ApiList<T> = T[] | { results?: T[] };
type AcademicYear = { id: number; name: string; is_current?: boolean };

// ── Helpers ────────────────────────────────────────────────────────────────────

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results ?? [];
}

function sanitizeLabel(value: string) {
  return String(value ?? "").replace(/<[^>]*>/g, "").trim();
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

const CLASS_NAME_ORDER: Record<string, number> = {
  PRENURSERY: 0,
  "PRE-NURSERY": 0,
  "PRE NURSERY": 0,
  PRE_NURSERY: 0,
  PREKG: 1,
  "PRE-KG": 1,
  "PRE KG": 1,
  NURSERY: 2,
  LKG: 3,
  UKG: 4,
};

function classSortKey(name: string): number {
  const upper = String(name ?? "").trim().toUpperCase();
  if (upper in CLASS_NAME_ORDER) return CLASS_NAME_ORDER[upper];
  // Match "Grade 5", "Class 7", "Standard 10", or just "5"
  const m = upper.match(/(\d+)/);
  if (m) return 100 + Number(m[1]);
  return 9999;
}

function compareClassNames(a: string, b: string): number {
  const ka = classSortKey(a);
  const kb = classSortKey(b);
  if (ka !== kb) return ka - kb;
  return a.localeCompare(b);
}

const apiGet = <T,>(path: string) =>
  apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });

// ── Main component ─────────────────────────────────────────────────────────────

export function StudentPromotePanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(true);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const [fromYearId, setFromYearId] = useState("");
  const [toYearId, setToYearId] = useState("");

  const [batch, setBatch] = useState<PromotionBatch | null>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);
  const [savingDecisions, setSavingDecisions] = useState(false);
  const [confirmingBatch, setConfirmingBatch] = useState(false);

  const [decisions, setDecisions] = useState<Record<number, RecordDecision>>({});

  const [classKey, setClassKey] = useState("all");
  const [sectionKey, setSectionKey] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [npDialog, setNpDialog] = useState<{ record: PromotionRecord } | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  const showToast = useCallback(
    (message: string, tone: "success" | "error") => setToast({ message, tone }),
    [],
  );

  // ── Load academic years (current + 3 prior) ─────────────────────────────────

  useEffect(() => {
    (async () => {
      try {
        setLoadingCriteria(true);
        const yearData = await apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/");
        const loaded = listData(yearData).filter((y) => /^\d{4}-\d{4}$/.test(sanitizeLabel(y.name)));
        setYears(loaded);

        const current = loaded.find((y) => y.is_current);
        if (current) {
          setFromYearId(String(current.id));
          const start = parseAcademicYearStart(current.name);
          if (start != null) {
            const next = loaded.find((y) => sanitizeLabel(y.name) === `${start + 1}-${start + 2}`);
            if (next) setToYearId(String(next.id));
          }
        }
      } catch {
        showToast("Unable to load academic years.", "error");
      } finally {
        setLoadingCriteria(false);
      }
    })();
  }, [showToast]);

  // ── Year option lists: From = current + 3 prior; To = future or current+1+ ──

  const fromYearOptions = useMemo<AcademicYearOption[]>(() => {
    const current = years.find((y) => y.is_current);
    const sorted = [...years].sort((a, b) => {
      const sa = parseAcademicYearStart(a.name) ?? 0;
      const sb = parseAcademicYearStart(b.name) ?? 0;
      return sb - sa;
    });
    if (!current) return sorted.slice(0, 4).map((y) => ({ id: y.id, name: y.name }));
    const cs = parseAcademicYearStart(current.name) ?? 0;
    return sorted
      .filter((y) => {
        const s = parseAcademicYearStart(y.name);
        return s != null && s <= cs && s >= cs - 3;
      })
      .map((y) => ({ id: y.id, name: y.name }));
  }, [years]);

  const toYearOptions = useMemo<AcademicYearOption[]>(() => {
    const fromId = Number(fromYearId);
    const fromYear = years.find((y) => y.id === fromId);
    const fs = fromYear ? parseAcademicYearStart(fromYear.name) : null;
    return years
      .filter((y) => {
        if (y.id === fromId) return false;
        if (fs == null) return true;
        const s = parseAcademicYearStart(y.name);
        return s != null && s > fs;
      })
      .sort((a, b) => (parseAcademicYearStart(a.name) ?? 0) - (parseAcademicYearStart(b.name) ?? 0))
      .map((y) => ({ id: y.id, name: y.name }));
  }, [years, fromYearId]);

  // ── Initialise decisions from batch ─────────────────────────────────────────

  const initDecisions = useCallback((records: PromotionRecord[]) => {
    const d: Record<number, RecordDecision> = {};
    records.forEach((r) => {
      d[r.id] = {
        status: r.status,
        retention_reason: r.retention_reason ?? "",
        failed_subject_ids: r.failed_subject_ids ?? [],
        notes: r.notes ?? "",
        ai_recommendation: r.ai_recommendation ?? "",
      };
    });
    setDecisions(d);
    setExpanded({});
  }, []);

  const loadBatch = async () => {
    if (!fromYearId || !toYearId) {
      showToast("Please select both From and To academic years.", "error");
      return;
    }
    if (fromYearId === toYearId) {
      showToast("From and To years must be different.", "error");
      return;
    }
    setLoadingBatch(true);
    try {
      const result = await promotionApi.createOrGetBatch({
        academic_year: Number(fromYearId),
        target_year: Number(toYearId),
      });
      setBatch(result);
      initDecisions(result.records);
      setSelectedIds(new Set());
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load batch.", "error");
    } finally {
      setLoadingBatch(false);
    }
  };

  const refreshBatch = async () => {
    if (!batch) return;
    try {
      const yearName = batch.academic_year_name;
      const refreshed = await promotionApi.getBatchByYear(yearName);
      setBatch(refreshed);
      initDecisions(refreshed.records);
    } catch {
      // ignore
    }
  };

  // ── Filter options ──────────────────────────────────────────────────────────

  const classOptions = useMemo(() => {
    if (!batch) return [];
    const map = new Map<string, { key: string; classLabel: string }>();
    batch.records.forEach((r) => {
      const key = r.from_class == null ? "unassigned" : String(r.from_class);
      if (!map.has(key)) {
        map.set(key, { key, classLabel: r.from_class_name ?? "Unassigned Class" });
      }
    });
    return Array.from(map.values()).sort((a, b) => compareClassNames(a.classLabel, b.classLabel));
  }, [batch]);

  const sectionOptions = useMemo(() => {
    if (!batch || classKey === "all") return [];
    const map = new Map<string, { key: string; label: string }>();
    batch.records.forEach((r) => {
      const cKey = r.from_class == null ? "unassigned" : String(r.from_class);
      if (cKey !== classKey) return;
      const sKey = r.from_section == null ? "none" : String(r.from_section);
      if (!map.has(sKey)) {
        map.set(sKey, { key: sKey, label: r.from_section_name ?? "—" });
      }
    });
    return Array.from(map.values());
  }, [batch, classKey]);

  // ── Filtered records ───────────────────────────────────────────────────────

  const filteredRecords = useMemo(() => {
    if (!batch) return [] as PromotionRecord[];
    const q = search.trim().toLowerCase();
    return batch.records.filter((r) => {
      if (status !== "all") {
        const s = decisions[r.id]?.status ?? r.status;
        if (s !== status) return false;
      }
      const cKey = r.from_class == null ? "unassigned" : String(r.from_class);
      if (classKey !== "all" && cKey !== classKey) return false;
      const sKey = r.from_section == null ? "none" : String(r.from_section);
      if (sectionKey !== "all" && sKey !== sectionKey) return false;
      if (!q) return true;
      return [r.student_name, r.admission_no, r.from_class_name ?? "", r.from_section_name ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(q);
    });
  }, [batch, search, status, classKey, sectionKey, decisions]);

  // ── Group into class → section ─────────────────────────────────────────────

  const classGroups = useMemo<ClassGroup[]>(() => {
    const map = new Map<string, {
      classKey: string; classId: number | null; className: string;
      sectionMap: Map<string, SectionTabItem>;
    }>();
    filteredRecords.forEach((r) => {
      const cKey = r.from_class == null ? "unassigned" : String(r.from_class);
      if (!map.has(cKey)) {
        map.set(cKey, {
          classKey: cKey,
          classId: r.from_class,
          className: r.from_class_name ?? "Unassigned Class",
          sectionMap: new Map(),
        });
      }
      const cls = map.get(cKey)!;
      const sKey = r.from_section == null ? "none" : String(r.from_section);
      if (!cls.sectionMap.has(sKey)) {
        cls.sectionMap.set(sKey, {
          key: sKey,
          sectionId: r.from_section,
          sectionName: r.from_section_name ?? "—",
          records: [],
        });
      }
      cls.sectionMap.get(sKey)!.records.push(r);
    });
    return Array.from(map.values())
      .map((c) => {
        const sections = Array.from(c.sectionMap.values()).sort((a, b) =>
          a.sectionName.localeCompare(b.sectionName),
        );
        const totalRecords = sections.reduce((acc, s) => acc + s.records.length, 0);
        return {
          classKey: c.classKey,
          classId: c.classId,
          className: c.className,
          totalRecords,
          sections,
        };
      })
      .sort((a, b) => compareClassNames(a.className, b.className));
  }, [filteredRecords]);

  // ── Decision handlers ──────────────────────────────────────────────────────

  const handleStatusChange = useCallback(
    (recordId: number, newStatus: RecordDecision["status"]) => {
      setDecisions((prev) => ({
        ...prev,
        [recordId]: {
          ...(prev[recordId] ?? {
            status: "pending",
            retention_reason: "",
            failed_subject_ids: [],
            notes: "",
            ai_recommendation: "",
          }),
          status: newStatus,
          ...(newStatus !== "not_promoted"
            ? { retention_reason: "", failed_subject_ids: [], ai_recommendation: "" }
            : {}),
        },
      }));
    },
    [],
  );

  const handleSelect = useCallback((recordId: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(recordId);
      else next.delete(recordId);
      return next;
    });
  }, []);

  const handleSelectMany = useCallback((ids: number[], checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) ids.forEach((id) => next.add(id));
      else ids.forEach((id) => next.delete(id));
      return next;
    });
  }, []);

  const handleNotPromotedConfirm = async (data: {
    record_id: number;
    reason: RetentionReason;
    notes: string;
    ai_recommendation: string;
  }) => {
    if (!batch) return;
    try {
      await promotionApi.updateRecord(batch.id, {
        record_id: data.record_id,
        status: "not_promoted",
        retention_reason: data.reason,
        notes: data.notes,
      });
      setDecisions((prev) => ({
        ...prev,
        [data.record_id]: {
          ...(prev[data.record_id] ?? {
            status: "not_promoted",
            retention_reason: data.reason,
            failed_subject_ids: [],
            notes: data.notes,
            ai_recommendation: data.ai_recommendation,
          }),
          status: "not_promoted",
          retention_reason: data.reason,
          notes: data.notes,
          ai_recommendation: data.ai_recommendation,
        },
      }));
      setNpDialog(null);
      await refreshBatch();
      showToast("Student marked as Not Promoted.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to save retention.", "error");
    }
  };

  // ── Bulk actions ──────────────────────────────────────────────────────────

  const handleBulkPromote = async (records: PromotionRecord[]) => {
    if (!batch || records.length === 0) return;
    try {
      await promotionApi.bulkUpdate(batch.id, {
        action: "promote",
        scope: "selection",
        record_ids: records.map((r) => r.id),
      });
      records.forEach((r) => handleStatusChange(r.id, "promote"));
      await refreshBatch();
      showToast(`${records.length} student${records.length === 1 ? "" : "s"} marked Promote.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bulk promote failed.", "error");
    }
  };

  const handleBulkNotPromoted = async (records: PromotionRecord[]) => {
    if (!batch || records.length === 0) return;
    try {
      await promotionApi.bulkUpdate(batch.id, {
        action: "skip",
        scope: "selection",
        record_ids: records.map((r) => r.id),
      });
      records.forEach((r) => handleStatusChange(r.id, "not_promoted"));
      await refreshBatch();
      showToast(`${records.length} student${records.length === 1 ? "" : "s"} marked Not Promoted.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Bulk action failed.", "error");
    }
  };

  const handleBulkReset = async (records: PromotionRecord[]) => {
    if (!batch || records.length === 0) return;
    try {
      await promotionApi.bulkUpdate(batch.id, {
        action: "reset",
        scope: "selection",
        record_ids: records.map((r) => r.id),
      });
      records.forEach((r) => handleStatusChange(r.id, "pending"));
      await refreshBatch();
      showToast(`${records.length} decision${records.length === 1 ? "" : "s"} reset.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Reset failed.", "error");
    }
  };

  // ── Save / Confirm ──────────────────────────────────────────────────────

  const handleSaveDraft = async () => {
    if (!batch) return;
    setSavingDecisions(true);
    try {
      const dirty = batch.records.filter((r) => {
        const d = decisions[r.id];
        if (!d) return false;
        return (
          d.status !== r.status ||
          (d.retention_reason ?? "") !== (r.retention_reason ?? "") ||
          (d.notes ?? "") !== (r.notes ?? "")
        );
      });
      for (const rec of dirty) {
        const d = decisions[rec.id];
        await promotionApi.updateRecord(batch.id, {
          record_id: rec.id,
          status: d.status,
          retention_reason: d.retention_reason,
          notes: d.notes,
        });
      }
      await refreshBatch();
      showToast(`Saved ${dirty.length} change${dirty.length === 1 ? "" : "s"}.`, "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Save failed.", "error");
    } finally {
      setSavingDecisions(false);
    }
  };

  const handleConfirmBatch = async () => {
    if (!batch) return;
    setConfirmingBatch(true);
    try {
      await promotionApi.confirmBatch(batch.id);
      await refreshBatch();
      setShowConfirmModal(false);
      showToast("Batch confirmed and students promoted.", "success");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Confirm failed.", "error");
    } finally {
      setConfirmingBatch(false);
    }
  };

  const isReadOnly = batch?.status === "confirmed" || batch?.status === "finalized";

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full bg-[#F5F5FA]">
      {toast && <TopToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} />}

      <div className="flex-1 overflow-y-auto px-6 py-5">
        <PromoteHeader
          fromYears={fromYearOptions}
          toYears={toYearOptions}
          fromYearId={fromYearId}
          toYearId={toYearId}
          onFromYearChange={setFromYearId}
          onToYearChange={setToYearId}
          onLoad={loadBatch}
          loading={loadingBatch || loadingCriteria}
          totalStudents={batch?.kpi.total}
        />

        <PromoteKPICards kpi={batch?.kpi ?? null} />

        <PromoteSmartFilter
          classOptions={classOptions}
          sectionOptions={sectionOptions}
          classKey={classKey}
          sectionKey={sectionKey}
          status={status}
          search={searchInput}
          onClassChange={(k) => { setClassKey(k); setSectionKey("all"); }}
          onSectionChange={setSectionKey}
          onStatusChange={setStatus}
          onSearchChange={setSearchInput}
          onSearchSubmit={() => setSearch(searchInput)}
          onReset={() => {
            setClassKey("all");
            setSectionKey("all");
            setStatus("all");
            setSearchInput("");
            setSearch("");
          }}
        />

        {!batch && !loadingBatch && (
          <div className="bg-white rounded-xl border border-dashed border-[#E6E6EC] p-10 text-center text-sm text-[#6B6B7B]">
            Choose two academic years above and click <strong>Load batch</strong> to begin.
          </div>
        )}

        {loadingBatch && (
          <div className="bg-white rounded-xl border border-[#E6E6EC] p-10 text-center text-sm text-[#6B6B7B]">
            Loading promotion batch…
          </div>
        )}

        {batch && classGroups.length === 0 && !loadingBatch && (
          <div className="bg-white rounded-xl border border-dashed border-[#E6E6EC] p-10 text-center text-sm text-[#6B6B7B]">
            No students match the current filters.
          </div>
        )}

        <div className="space-y-3">
          {classGroups.map((group) => (
            <ClassAccordionCard
              key={group.classKey}
              group={group}
              isOpen={!!expanded[group.classKey]}
              isReadOnly={isReadOnly}
              decisions={decisions}
              selectedIds={selectedIds}
              onToggle={() =>
                setExpanded((prev) => ({ ...prev, [group.classKey]: !prev[group.classKey] }))
              }
              onSelect={handleSelect}
              onSelectMany={handleSelectMany}
              onStatusChange={handleStatusChange}
              onOpenNotPromoted={(record) => setNpDialog({ record })}
              onPromoteAll={handleBulkPromote}
              onNotPromotedAll={(records) => {
                if (records.length === 1) {
                  setNpDialog({ record: records[0] });
                } else {
                  void handleBulkNotPromoted(records);
                }
              }}
              onResetAll={handleBulkReset}
            />
          ))}
        </div>
      </div>

      {/* Sticky footer */}
      {batch && (
        <div className="border-t border-[#E6E6EC] bg-white px-6 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="text-xs text-[#6B6B7B]">
            Status: <strong className="text-[#0B0B14] uppercase">{batch.status}</strong>
            {" · "}
            {batch.kpi.completion_percentage}% decided
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSaveDraft}
              disabled={isReadOnly || savingDecisions}
              className="h-9 px-4 text-sm font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg hover:bg-[#F4F4F8] transition-colors disabled:opacity-40"
            >
              {savingDecisions ? "Saving…" : "Save Draft"}
            </button>
            <button
              onClick={() => setShowConfirmModal(true)}
              disabled={isReadOnly || batch.kpi.pending > 0}
              className="h-9 px-5 text-sm font-bold text-white bg-[#4729F4] rounded-lg hover:bg-[#3a21d4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              ✓ Confirm &amp; Promote
            </button>
          </div>
        </div>
      )}

      {npDialog && batch && (
        <NotPromotedDialog
          batchId={batch.id}
          record={npDialog.record}
          initialReason={decisions[npDialog.record.id]?.retention_reason}
          initialNotes={decisions[npDialog.record.id]?.notes}
          initialAi={decisions[npDialog.record.id]?.ai_recommendation}
          onConfirm={handleNotPromotedConfirm}
          onCancel={() => setNpDialog(null)}
        />
      )}

      {showConfirmModal && batch && (
        <ConfirmBatchModal
          kpi={batch.kpi}
          targetYearName={batch.target_year_name}
          submitting={confirmingBatch}
          onConfirm={handleConfirmBatch}
          onCancel={() => setShowConfirmModal(false)}
        />
      )}
    </div>
  );
}
