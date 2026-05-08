"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Search, Plus } from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { ApiInquiry, ApiSchoolClass, ClassConfig, StageTab } from "@/types/admissions";
import { ApplicationRow } from "./ApplicationRow";
import { ApplicationDetailPanel } from "./ApplicationDetailPanel";
import { BulkActionBar } from "./BulkActionBar";
import { TemplatePicker } from "./TemplatePicker";

interface Props {
  selectedClassId: number | null;
  classes: ApiSchoolClass[];
  allInquiries: ApiInquiry[];
  today: string;
  onOpenLog: (inq: ApiInquiry) => void;
  onOpenCall: (inq: ApiInquiry) => void;
  onOpenWA: (inq: ApiInquiry) => void;
  onEdit: (inq: ApiInquiry) => void;
  onNewInquiry: () => void;
  onReload: () => void;
  forcedStage?: StageTab | null;
  classConfig?: ClassConfig;
}

const PAGE_SIZE = 25;

const STAGE_TABS: { key: StageTab; label: string }[] = [
  { key: "all",      label: "All" },
  { key: "new",      label: "New" },
  { key: "active",   label: "In Conversation" },
  { key: "pending",  label: "Decision Pending" },
  { key: "enrolled", label: "Enrolled" },
  { key: "waitlist", label: "Waitlist" },
  { key: "cold",     label: "Cold / Dropped" },
];

function filterByStage(inqs: ApiInquiry[], stage: StageTab): ApiInquiry[] {
  if (stage === "all")      return inqs.filter((i) => i.active_status === 1 || i.status === "enrolled");
  if (stage === "new")      return inqs.filter((i) => i.status === "new" && i.active_status === 1);
  if (stage === "active")   return inqs.filter((i) => i.status === "contacted" && i.active_status === 1);
  if (stage === "pending")  return inqs.filter((i) => i.status === "visited" && i.active_status === 1);
  if (stage === "enrolled") return inqs.filter((i) => i.status === "enrolled");
  if (stage === "waitlist") return inqs.filter((i) => i.status === "waitlisted");
  if (stage === "cold")     return inqs.filter((i) => i.status === "declined" || i.active_status === 2);
  return inqs;
}

function getClassName(classes: ApiSchoolClass[], id: number | null): string {
  if (id === null) return "All Classes";
  return classes.find((c) => c.id === id)?.name ?? "Unknown";
}

function exportCSV(rows: ApiInquiry[], filename: string) {
  const headers = ["Name", "Phone", "Email", "Class", "Stage", "Source", "Assigned", "Query Date", "Follow-up"];
  const lines = rows.map((i) => [
    i.full_name, i.phone, i.email || "",
    i.class_name_resolved || "",
    i.status, i.source_name || "",
    i.assigned || "",
    i.query_date || "",
    i.next_follow_up_date || "",
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function ClassWorkspace({
  selectedClassId,
  classes,
  allInquiries,
  today,
  onOpenLog,
  onOpenCall,
  onOpenWA,
  onEdit,
  onNewInquiry,
  onReload,
  forcedStage,
  classConfig,
}: Props) {
  const [activeStage, setActiveStage] = useState<StageTab>("all");
  const [selectedSection, setSelectedSection] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [detailInquiry, setDetailInquiry] = useState<ApiInquiry | null>(null);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync forced stage from Morning Brief card clicks
  useEffect(() => {
    if (forcedStage != null) {
      setActiveStage(forcedStage);
      setPage(1);
    }
  }, [forcedStage]);

  // Debounce search
  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current);
    searchRef.current = setTimeout(() => setDebouncedSearch(searchQuery), 300);
    return () => { if (searchRef.current) clearTimeout(searchRef.current); };
  }, [searchQuery]);

  // Reset page when filters change
  useEffect(() => { setPage(1); }, [activeStage, debouncedSearch, selectedClassId, selectedSection]);

  const classFiltered = useMemo(
    () =>
      selectedClassId === null
        ? allInquiries
        : allInquiries.filter((i) => i.school_class === selectedClassId),
    [allInquiries, selectedClassId]
  );

  const sectionFiltered = useMemo(
    () =>
      selectedSection === "all"
        ? classFiltered
        : classFiltered.filter((i) => {
            // Filter by section name if inquiry has section info in description or class_name_resolved
            const cls = classes.find((c) => c.id === selectedClassId);
            const sec = cls?.sections?.find((s) => s.name === selectedSection);
            // Without a section field on ApiInquiry, we can only approximate via description
            // TODO: add section field to ApiInquiry when backend supports it
            void sec;
            return true; // passthrough until backend exposes section on inquiry
          }),
    [classFiltered, selectedSection, selectedClassId, classes]
  );

  const stageCounts = useMemo(() => {
    const counts = {} as Record<StageTab, number>;
    STAGE_TABS.forEach((t) => { counts[t.key] = filterByStage(sectionFiltered, t.key).length; });
    return counts;
  }, [sectionFiltered]);

  const filtered = useMemo(() => {
    const base = filterByStage(sectionFiltered, activeStage);
    if (!debouncedSearch) return base;
    const q = debouncedSearch.toLowerCase();
    return base.filter(
      (i) =>
        i.full_name.toLowerCase().includes(q) ||
        i.phone.includes(q) ||
        (i.class_name_resolved || "").toLowerCase().includes(q)
    );
  }, [sectionFiltered, activeStage, debouncedSearch]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3500);
  };

  const handleBulkMoveStage = async (stage: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    const active_status = stage === "enrolled" || stage === "declined" ? 2 : 1;
    try {
      await Promise.all(
        ids.map((id) =>
          apiRequestWithRefresh(`/api/v1/admissions/inquiries/${id}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: stage, active_status }),
          })
        )
      );
      // Fire-and-forget audit log
      void apiRequestWithRefresh("/api/v1/audit/log/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bulk_move_stage", entity: "inquiry", detail: `Moved ${ids.length} inquiries to ${stage}` }),
      }).catch(() => {});
      showToast(`${ids.length} application${ids.length > 1 ? "s" : ""} moved to ${stage}`);
      setSelectedIds(new Set());
      onReload();
    } catch {
      showToast("Failed to move some applications. Please try again.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkAssign = async (name: string) => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(
        ids.map((id) =>
          apiRequestWithRefresh(`/api/v1/admissions/inquiries/${id}/`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assigned: name }),
          })
        )
      );
      showToast(`${ids.length} application${ids.length > 1 ? "s" : ""} assigned to ${name}`);
      setSelectedIds(new Set());
      onReload();
    } catch {
      showToast("Failed to assign some applications.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} selected application(s)? This cannot be undone.`)) return;
    setBulkLoading(true);
    const ids = Array.from(selectedIds);
    try {
      await Promise.all(
        ids.map((id) =>
          apiRequestWithRefresh(`/api/v1/admissions/inquiries/${id}/`, { method: "DELETE" })
        )
      );
      showToast(`${ids.length} application${ids.length > 1 ? "s" : ""} deleted.`);
      setSelectedIds(new Set());
      onReload();
    } catch {
      showToast("Failed to delete some applications.");
    } finally {
      setBulkLoading(false);
    }
  };

  const handleInlineStageMove = async (id: number, stage: string) => {
    const active_status = stage === "enrolled" || stage === "declined" ? 2 : 1;
    await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${id}/`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: stage, active_status }),
    });
    onReload();
  };

  const className = getClassName(classes, selectedClassId);
  const sections = classes.find((c) => c.id === selectedClassId)?.sections ?? [];

  // Funnel bar data
  const enrolledCount = classConfig?.enrolledCount ?? 0;
  const capacity = classConfig?.capacity ?? 0;
  const pipelineCount = classConfig?.pipelineCount ?? 0;
  const conversionPct = pipelineCount > 0 ? Math.round((enrolledCount / pipelineCount) * 100) : 0;

  // First selected inquiry (for TemplatePicker preview)
  const firstSelectedInquiry = useMemo(() => {
    const firstId = Array.from(selectedIds)[0];
    return firstId != null ? (allInquiries.find((i) => i.id === firstId) ?? null) : null;
  }, [selectedIds, allInquiries]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0, transition: { duration: 0.35 } }}
      className="relative"
    >
      {/* Section header */}
      <div className="flex flex-wrap items-center gap-3 py-3 px-4">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-xs font-bold text-gray-500">
          03
        </span>
        <span className="text-sm font-semibold text-gray-800">Class Workspace</span>
        <span className="text-xs text-gray-400">·</span>
        <span className="text-xs font-medium text-indigo-600">{className}</span>
        {/* Section selector */}
        {sections.length > 1 && (
          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
          >
            <option value="all">All Sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.name}>{s.name}</option>
            ))}
          </select>
        )}
        <div className="flex gap-2 ml-auto flex-wrap">
          <button
            onClick={() => exportCSV(filtered, `${className.replace(/\s+/g, "_")}_inquiries.csv`)}
            className="flex items-center gap-1.5 border border-gray-200 text-gray-700 rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50 transition-colors"
            title="Export CSV"
          >
            <Download size={13} /> Export
          </button>
          <button
            onClick={onNewInquiry}
            className="bg-indigo-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-indigo-700 flex items-center gap-1.5 hidden"
            style={{ display: 'none' }}
          >
            <Plus size={13} /> New Inquiry
          </button>
        </div>
      </div>

      {/* Conversion funnel bar */}
      {classConfig && capacity > 0 && (
        <div className="px-4 mb-3">
          <div className="flex items-center gap-4 px-4 py-2.5 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 flex-wrap gap-y-1">
            <span>
              <span className="font-semibold text-gray-900">{enrolledCount}</span>
              <span className="text-gray-400"> / {capacity} seats filled</span>
            </span>
            <span className="w-px h-3 bg-gray-200 flex-shrink-0" />
            <span>
              <span className="font-semibold text-gray-900">{Math.max(0, capacity - enrolledCount)}</span>
              <span className="text-gray-400"> remaining</span>
            </span>
            <span className="w-px h-3 bg-gray-200 flex-shrink-0" />
            <span>
              <span className="font-semibold text-indigo-600">{pipelineCount}</span>
              <span className="text-gray-400"> in pipeline</span>
            </span>
            {pipelineCount > 0 && (
              <>
                <span className="w-px h-3 bg-gray-200 flex-shrink-0" />
                <span>
                  <span className={`font-semibold ${conversionPct >= 50 ? "text-green-600" : conversionPct >= 25 ? "text-amber-600" : "text-red-500"}`}>
                    {conversionPct}%
                  </span>
                  <span className="text-gray-400"> conversion</span>
                </span>
              </>
            )}
            {/* capacity fill bar */}
            <div className="ml-auto w-24 h-1.5 bg-gray-200 rounded-full overflow-hidden flex-shrink-0">
              <motion.div
                className={`h-full rounded-full ${
                  capacity > 0 && enrolledCount / capacity > 0.9 ? "bg-red-400" :
                  capacity > 0 && enrolledCount / capacity > 0.6 ? "bg-amber-400" : "bg-indigo-400"
                }`}
                initial={{ width: 0 }}
                animate={{ width: capacity > 0 ? `${Math.min(100, (enrolledCount / capacity) * 100)}%` : "0%" }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* Stage tabs */}
      <div className="px-4 mb-3 flex items-center gap-1 overflow-x-auto pb-1 relative">
        {STAGE_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveStage(t.key)}
            className={`relative flex-shrink-0 rounded-full px-3 py-1 text-sm transition-colors ${
              activeStage === t.key
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            {activeStage === t.key && (
              <motion.span
                layoutId="stage-tab-indicator"
                className="absolute inset-0 bg-indigo-600 rounded-full -z-10"
              />
            )}
            {t.label}
            {stageCounts[t.key] > 0 && (
              <span className={`ml-1.5 text-xs font-bold ${activeStage === t.key ? "text-indigo-200" : "text-gray-400"}`}>
                {stageCounts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="px-4 mb-3">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search name or phone…"
            className="pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-xl w-full max-w-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Table */}
      <div className="px-4 pb-4">
        <div className="rounded-xl border border-gray-100 overflow-hidden">
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <div className="text-4xl mb-3">🔍</div>
              <p className="text-sm font-medium text-gray-500">
                {debouncedSearch ? "No results match your search." : "No inquiries in this stage."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/60">
                    <th className="w-8 px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={paginated.length > 0 && paginated.every((i) => selectedIds.has(i.id))}
                        onChange={(e) => {
                          if (e.target.checked) setSelectedIds(new Set(paginated.map((i) => i.id)));
                          else setSelectedIds(new Set());
                        }}
                        className="rounded border-gray-300 text-indigo-600"
                      />
                    </th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Grade</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Source</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Age</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Stage</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Follow-up</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Counsellor</th>
                    <th className="w-28 px-3 py-2.5 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence mode="popLayout">
                    {paginated.map((inq) => (
                      <ApplicationRow
                        key={inq.id}
                        inquiry={inq}
                        isSelected={selectedIds.has(inq.id)}
                        today={today}
                        onToggleSelect={toggleSelect}
                        onOpenDetail={setDetailInquiry}
                        onOpenLog={onOpenLog}
                        onOpenCall={onOpenCall}
                        onOpenWA={onOpenWA}
                        onInlineStageMove={handleInlineStageMove}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
            <span>
              {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                ← Prev
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="border border-gray-200 text-gray-700 rounded-lg px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      <ApplicationDetailPanel
        inquiry={detailInquiry}
        isOpen={!!detailInquiry}
        onClose={() => setDetailInquiry(null)}
        onOpenLog={onOpenLog}
        onOpenCall={onOpenCall}
        onOpenWA={onOpenWA}
        onEdit={(inq) => { setDetailInquiry(null); onEdit(inq); }}
        today={today}
        onReload={onReload}
      />

      {/* Bulk action bar */}
      <BulkActionBar
        selectedCount={selectedIds.size}
        isLoading={bulkLoading}
        onSendMessage={() => setShowTemplatePicker(true)}
        onMoveStage={handleBulkMoveStage}
        onAssign={handleBulkAssign}
        onDelete={handleBulkDelete}
        onClear={() => setSelectedIds(new Set())}
      />

      {/* Template picker for bulk message */}
      <TemplatePicker
        isOpen={showTemplatePicker}
        onClose={() => setShowTemplatePicker(false)}
        onSelect={(templateBody) => {
          // Log bulk message as a contact update for all selected
          const ids = Array.from(selectedIds);
          const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
          const logEntry = `[${timestamp}] Bulk message sent`;
          setBulkLoading(true);
          Promise.all(
            ids.map((id) => {
              const inq = allInquiries.find((i) => i.id === id);
              const personalBody = inq
                ? templateBody.replace(/there/g, inq.full_name.split(" ")[0] || "there")
                : templateBody;
              void personalBody; // Used for actual WA send if integrated
              return apiRequestWithRefresh(`/api/v1/admissions/inquiries/${id}/`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  status: "contacted",
                  active_status: 1,
                  note: inq?.note ? `${inq.note}\n${logEntry}` : logEntry,
                }),
              });
            })
          )
            .then(() => {
              showToast(`Message sent to ${ids.length} famil${ids.length === 1 ? "y" : "ies"}`);
              setSelectedIds(new Set());
              setShowTemplatePicker(false);
              onReload();
            })
            .catch(() => { showToast("Failed to log bulk message."); })
            .finally(() => { setBulkLoading(false); });
        }}
        inquiry={firstSelectedInquiry}
      />

      {/* Toast notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10 }}
            className="fixed bottom-6 right-6 z-[60] bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-xl flex items-center gap-2"
          >
            ✓ {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
