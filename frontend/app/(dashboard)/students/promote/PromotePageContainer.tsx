'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequestWithRefresh } from '@/lib/api-auth';
import { promotionApi, type PromotionBatch, type PromotionRecord } from '@/lib/promotion-api';

import PromoteHeader, { type AcademicYearOption } from './components/PromoteHeader';
import PromoteKPICards from './components/PromoteKPICards';
import PromoteSmartFilter, {
  type ClassOption,
  type SectionOption,
  type StatusFilter,
} from './components/PromoteSmartFilter';
import ClassAccordionCard, { type ClassGroup } from './components/ClassAccordionCard';
import { type SectionTabItem } from './components/PromoteSectionTabs';
import { type RecordDecision } from './components/PromoteStudentTable';
import ConfirmBatchModal from './components/ConfirmBatchModal';
import NotPromotedDialog, { type RetentionReason } from './components/NotPromotedDialog';
import PromoteOverrideDialog from './components/PromoteOverrideDialog';

type ApiList<T> = T[] | { results?: T[] };
type AcademicYear = { id: number; name: string; is_current?: boolean };

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

// Format a class name coming from the API. Numeric values like "1", "10" are
// shown as "Grade 1", "Grade 10". Non-numeric values (Nursery, LKG, UKG, etc.)
// are kept as-is. Falls back to "Unassigned".
function formatClassLabel(raw: string | null | undefined): string {
  const s = String(raw ?? '').trim();
  if (!s) return 'Unassigned';
  if (/^\d+$/.test(s)) return `Grade ${s}`;
  return s;
}

// Order classes the same way they would appear in a school timetable:
// Nursery < LKG < UKG < Grade 1 < Grade 2 < ... < Grade 10 < everything else (A→Z).
function classRank(label: string): number {
  const l = label.toLowerCase().trim();
  if (l === 'nursery' || l === 'pre-nursery' || l === 'pre nursery') return -3;
  if (l === 'lkg') return -2;
  if (l === 'ukg') return -1;
  const m = l.match(/^grade\s+(\d+)$/i) ?? l.match(/^(\d+)$/);
  if (m) return parseInt(m[1], 10);
  return 9999;
}

function sanitize(s: string) {
  return String(s || '').replace(/<[^>]*>/g, '').trim();
}

function recordToDecision(rec: PromotionRecord): RecordDecision {
  return {
    status: rec.status,
    retention_reason: rec.retention_reason ?? '',
    failed_subject_ids: rec.failed_subject_ids ?? [],
    notes: rec.notes ?? '',
    ai_recommendation: rec.ai_recommendation ?? '',
  };
}

function buildDecisions(records: PromotionRecord[]): Record<number, RecordDecision> {
  const next: Record<number, RecordDecision> = {};
  for (const r of records) next[r.id] = recordToDecision(r);
  return next;
}

type Toast = { tone: 'success' | 'error' | 'info'; message: string } | null;

export default function PromotePageContainer() {
  // Academic years
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [loadingYears, setLoadingYears] = useState(true);
  const [fromYearId, setFromYearId] = useState('');
  const [toYearId, setToYearId] = useState('');

  // Batch
  const [batch, setBatch] = useState<PromotionBatch | null>(null);
  const [loadingBatch, setLoadingBatch] = useState(false);

  // Decisions / selections
  const [decisions, setDecisions] = useState<Record<number, RecordDecision>>({});
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Filters
  const [classKey, setClassKey] = useState<string>('all');
  const [sectionKey, setSectionKey] = useState<string>('all');
  const [status, setStatus] = useState<StatusFilter>('all');
  const [searchInput, setSearchInput] = useState('');
  const [searchActive, setSearchActive] = useState('');

  // Accordion expanded
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Modals
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmingBatch, setConfirmingBatch] = useState(false);
  const [notPromotedTarget, setNotPromotedTarget] = useState<PromotionRecord | null>(null);
  // Fix 3: When the user flips an already-"not_promoted" student back to "Promote",
  // capture a reason for the override before persisting.
  const [promoteOverrideTarget, setPromoteOverrideTarget] = useState<PromotionRecord | null>(null);

  // Toast / errors
  const [toast, setToast] = useState<Toast>(null);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // ---- Initial year load ----
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoadingYears(true);
        const data = await apiRequestWithRefresh<ApiList<AcademicYear>>('/api/v1/core/academic-years/');
        if (cancelled) return;
        const ys = listData(data).filter((y) => /^\d{4}-\d{4}$/.test(sanitize(y.name)));
        setYears(ys);
        const current = ys.find((y) => y.is_current);
        if (current) {
          setFromYearId(String(current.id));
          const startYear = Number(sanitize(current.name).split('-')[0]);
          const next = ys.find((y) => sanitize(y.name) === `${startYear + 1}-${startYear + 2}`);
          if (next) setToYearId(String(next.id));
        }
      } catch (err) {
        setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Unable to load academic years.' });
      } finally {
        if (!cancelled) setLoadingYears(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const yearOptions: AcademicYearOption[] = useMemo(
    () => years.map((y) => ({ id: y.id, name: sanitize(y.name) })),
    [years],
  );

  const isReadOnly = batch?.status === 'confirmed' || batch?.status === 'finalized';

  // ---- Load batch ----
  const handleLoad = useCallback(async () => {
    if (!fromYearId || !toYearId) return;
    if (fromYearId === toYearId) {
      setToast({ tone: 'error', message: 'From and To academic years must be different.' });
      return;
    }
    try {
      setLoadingBatch(true);
      const result = await promotionApi.createOrGetBatch({
        academic_year: Number(fromYearId),
        target_year: Number(toYearId),
      });
      setBatch(result);
      setDecisions(buildDecisions(result.records));
      setSelectedIds(new Set());
      setExpanded({});
      setClassKey('all');
      setSectionKey('all');
      setStatus('all');
      setSearchInput('');
      setSearchActive('');
      setToast({ tone: 'success', message: `Batch loaded · ${result.records.length} students` });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Unable to load batch.' });
    } finally {
      setLoadingBatch(false);
    }
  }, [fromYearId, toYearId]);

  // ---- Filter options ----
  const classOptions: ClassOption[] = useMemo(() => {
    if (!batch) return [];
    const map = new Map<string, ClassOption>();
    for (const r of batch.records) {
      const key = r.from_class == null ? 'unassigned' : String(r.from_class);
      if (!map.has(key)) {
        map.set(key, { key, classLabel: formatClassLabel(r.from_class_name) });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      const diff = classRank(a.classLabel) - classRank(b.classLabel);
      return diff !== 0 ? diff : a.classLabel.localeCompare(b.classLabel);
    });
  }, [batch]);

  const sectionOptions: SectionOption[] = useMemo(() => {
    if (!batch || classKey === 'all') return [];
    const map = new Map<string, SectionOption>();
    for (const r of batch.records) {
      const ckey = r.from_class == null ? 'unassigned' : String(r.from_class);
      if (ckey !== classKey) continue;
      const skey = r.from_section == null ? 'no-section' : String(r.from_section);
      if (!map.has(skey)) {
        map.set(skey, { key: skey, label: r.from_section_name || 'No section' });
      }
    }
    return Array.from(map.values());
  }, [batch, classKey]);

  // ---- Filtered records ----
  const filteredRecords = useMemo(() => {
    if (!batch) return [];
    const q = searchActive.trim().toLowerCase();
    return batch.records.filter((r) => {
      const recStatus = decisions[r.id]?.status ?? r.status;
      if (status !== 'all' && recStatus !== status) return false;
      const ckey = r.from_class == null ? 'unassigned' : String(r.from_class);
      if (classKey !== 'all' && ckey !== classKey) return false;
      if (classKey !== 'all' && sectionKey !== 'all') {
        const skey = r.from_section == null ? 'no-section' : String(r.from_section);
        if (skey !== sectionKey) return false;
      }
      if (q) {
        const hay = `${r.student_name} ${r.admission_no} ${r.from_class_name || ''} ${r.from_section_name || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [batch, decisions, status, classKey, sectionKey, searchActive]);

  // ---- Group by class -> sections ----
  const classGroups: ClassGroup[] = useMemo(() => {
    const cmap = new Map<string, { classId: number | null; className: string; sections: Map<string, SectionTabItem> }>();
    for (const r of filteredRecords) {
      const ckey = r.from_class == null ? 'unassigned' : String(r.from_class);
      let cg = cmap.get(ckey);
      if (!cg) {
        cg = {
          classId: r.from_class,
          className: formatClassLabel(r.from_class_name),
          sections: new Map(),
        };
        cmap.set(ckey, cg);
      }
      const skey = r.from_section == null ? 'no-section' : String(r.from_section);
      let sec = cg.sections.get(skey);
      if (!sec) {
        sec = {
          key: skey,
          sectionId: r.from_section,
          sectionName: r.from_section_name || '—',
          records: [],
        };
        cg.sections.set(skey, sec);
      }
      sec.records.push(r);
    }
    return Array.from(cmap.entries()).map(([key, v]) => ({
      classKey: key,
      classId: v.classId,
      className: v.className,
      totalRecords: Array.from(v.sections.values()).reduce((s, sec) => s + sec.records.length, 0),
      sections: Array.from(v.sections.values()).sort((a, b) => a.sectionName.localeCompare(b.sectionName)),
    })).sort((a, b) => {
      const diff = classRank(a.className) - classRank(b.className);
      return diff !== 0 ? diff : a.className.localeCompare(b.className);
    });
  }, [filteredRecords]);

  // Auto-expand first group when batch loads / filters change to non-empty
  useEffect(() => {
    if (classGroups.length === 0) return;
    setExpanded((prev) => {
      if (Object.values(prev).some(Boolean)) return prev;
      return { [classGroups[0].classKey]: true };
    });
  }, [classGroups]);

  // ---- KPI (recomputed live from decisions) ----
  const liveKpi = useMemo(() => {
    if (!batch) return null;
    let promoted = 0, not_promoted = 0, pending = 0;
    for (const r of batch.records) {
      const s = decisions[r.id]?.status ?? r.status;
      if (s === 'promote') promoted++;
      else if (s === 'not_promoted') not_promoted++;
      else pending++;
    }
    const total = batch.records.length;
    const decided = promoted + not_promoted;
    return {
      total,
      promoted,
      not_promoted,
      pending,
      completion_percentage: total > 0 ? Math.round((decided / total) * 100) : 0,
    };
  }, [batch, decisions]);

  // ---- Decision actions ----
  const updateDecisionLocal = useCallback((recordId: number, patch: Partial<RecordDecision>) => {
    setDecisions((prev) => {
      const cur = prev[recordId] ?? { status: 'pending', retention_reason: '', failed_subject_ids: [], notes: '', ai_recommendation: '' };
      return { ...prev, [recordId]: { ...cur, ...patch } };
    });
  }, []);

  const persistRecord = useCallback(async (recordId: number, payload: { status: RecordDecision['status']; retention_reason?: string; notes?: string; }) => {
    if (!batch) return;
    try {
      const updated = await promotionApi.updateRecord(batch.id, {
        record_id: recordId,
        status: payload.status,
        retention_reason: payload.retention_reason,
        notes: payload.notes,
      });
      setBatch((prev) => prev ? {
        ...prev,
        records: prev.records.map((r) => r.id === recordId ? { ...r, ...updated } : r),
      } : prev);
      updateDecisionLocal(recordId, recordToDecision(updated as PromotionRecord));
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Failed to save decision.' });
    }
  }, [batch, updateDecisionLocal]);

  const handleStatusChange = useCallback((recordId: number, newStatus: RecordDecision['status']) => {
    if (newStatus === 'not_promoted') return; // handled via dialog
    // Fix 3: changing FROM not_promoted TO promote requires an override reason.
    if (newStatus === 'promote') {
      const current = decisions[recordId]?.status;
      if (current === 'not_promoted') {
        const rec = batch?.records.find((r) => r.id === recordId);
        if (rec) {
          setPromoteOverrideTarget(rec);
          return;
        }
      }
    }
    updateDecisionLocal(recordId, { status: newStatus, retention_reason: '', notes: '' });
    void persistRecord(recordId, { status: newStatus, retention_reason: '', notes: '' });
  }, [batch, decisions, updateDecisionLocal, persistRecord]);

  const handlePromoteOverrideConfirm = useCallback(async (recordId: number, overrideNote: string) => {
    updateDecisionLocal(recordId, { status: 'promote', retention_reason: '', notes: overrideNote });
    await persistRecord(recordId, { status: 'promote', retention_reason: '', notes: overrideNote });
    setPromoteOverrideTarget(null);
    setToast({ tone: 'success', message: 'Override saved — student will be promoted.' });
  }, [updateDecisionLocal, persistRecord]);

  const handleOpenNotPromoted = useCallback((rec: PromotionRecord) => {
    setNotPromotedTarget(rec);
  }, []);

  const handleNotPromotedConfirm = useCallback(async (data: {
    record_id: number;
    reason: RetentionReason;
    notes: string;
    ai_recommendation: string;
  }) => {
    updateDecisionLocal(data.record_id, {
      status: 'not_promoted',
      retention_reason: data.reason,
      notes: data.notes,
      ai_recommendation: data.ai_recommendation,
    });
    await persistRecord(data.record_id, {
      status: 'not_promoted',
      retention_reason: data.reason,
      notes: data.notes,
    });
    setNotPromotedTarget(null);
    setToast({ tone: 'success', message: 'Retention reason saved.' });
  }, [updateDecisionLocal, persistRecord]);

  // ---- Selection ----
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

  // ---- Bulk actions ----
  const bulkApply = useCallback(async (records: PromotionRecord[], action: 'promote' | 'skip' | 'reset') => {
    if (!batch || records.length === 0) return;
    try {
      const result = await promotionApi.bulkUpdate(batch.id, {
        action,
        scope: 'selection',
        record_ids: records.map((r) => r.id),
      });
      setBatch(result.batch);
      setDecisions(buildDecisions(result.batch.records));
      setSelectedIds(new Set());
      setToast({
        tone: 'success',
        message: `${result.updated} record${result.updated === 1 ? '' : 's'} updated`,
      });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Bulk update failed.' });
    }
  }, [batch]);

  const handlePromoteAll = useCallback((records: PromotionRecord[]) => {
    // Fix 2: "Promote All" must only touch students currently in "pending".
    // Already-decided "not_promoted" students must not be silently flipped.
    const eligible = records.filter((r) => (decisions[r.id]?.status ?? r.status) === 'pending');
    if (eligible.length === 0) {
      setToast({ tone: 'info', message: 'No pending students to promote in this section.' });
      return;
    }
    bulkApply(eligible, 'promote');
  }, [bulkApply, decisions]);
  const handleNotPromotedAll = useCallback((records: PromotionRecord[]) => {
    // Symmetric: only flip pending students; never overwrite an existing "promote" decision silently.
    const eligible = records.filter((r) => (decisions[r.id]?.status ?? r.status) === 'pending');
    if (eligible.length === 0) {
      setToast({ tone: 'info', message: 'No pending students left in this section.' });
      return;
    }
    bulkApply(eligible, 'skip');
  }, [bulkApply, decisions]);
  const handleResetAll = useCallback((records: PromotionRecord[]) => bulkApply(records, 'reset'), [bulkApply]);

  // ---- Confirm batch ----
  const handleConfirm = useCallback(async () => {
    if (!batch) return;
    try {
      setConfirmingBatch(true);
      const result = await promotionApi.confirmBatch(batch.id);
      setBatch(result.batch);
      setDecisions(buildDecisions(result.batch.records));
      setConfirmOpen(false);
      setToast({ tone: 'success', message: result.message || 'Batch confirmed.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Confirm failed.' });
    } finally {
      setConfirmingBatch(false);
    }
  }, [batch]);

  const handleFinalize = useCallback(async () => {
    if (!batch) return;
    try {
      const result = await promotionApi.finalizeBatch(batch.id);
      setBatch(result);
      setDecisions(buildDecisions(result.records));
      setToast({ tone: 'success', message: 'Batch finalized.' });
    } catch (err) {
      setToast({ tone: 'error', message: err instanceof Error ? err.message : 'Finalize failed.' });
    }
  }, [batch]);

  // ---- UI ----
  return (
    <div style={{ padding: '8px' }}>
      <div style={{ background: '#f8f8fc', border: '1px solid #dfdfea', borderRadius: '16px', padding: '18px' }}>
        <PromoteHeader
          fromYears={yearOptions}
          toYears={yearOptions}
          fromYearId={fromYearId}
          toYearId={toYearId}
          onFromYearChange={setFromYearId}
          onToYearChange={setToYearId}
          onLoad={handleLoad}
          loading={loadingYears || loadingBatch}
          totalStudents={batch?.records.length}
        />

        {/* Status badge + actions row */}
        {batch && (
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide"
              style={{
                background:
                  batch.status === 'finalized' ? '#E0E7FF' :
                  batch.status === 'confirmed' ? '#D1FAE5' :
                  batch.status === 'in_progress' ? '#DBEAFE' :
                  '#FEF3C7',
                color:
                  batch.status === 'finalized' ? '#3730A3' :
                  batch.status === 'confirmed' ? '#065F46' :
                  batch.status === 'in_progress' ? '#1D4ED8' :
                  '#92400E',
              }}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {batch.status.replace('_', ' ')}
            </span>
            <span className="text-[12px] text-[#6B6B7B]">
              {batch.academic_year_name} → <strong className="text-[#0B0B14]">{batch.target_year_name}</strong>
            </span>

            <div className="ml-auto flex items-center gap-2">
              {batch.status !== 'confirmed' && batch.status !== 'finalized' && (
                <button
                  onClick={() => setConfirmOpen(true)}
                  disabled={!liveKpi || liveKpi.pending > 0}
                  className="h-9 rounded-lg bg-[#4729F4] px-4 text-sm font-semibold text-white hover:bg-[#3a21d4] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Confirm &amp; Promote
                </button>
              )}
              {batch.status === 'confirmed' && (
                <button
                  onClick={handleFinalize}
                  className="h-9 rounded-lg bg-[#16A34A] px-4 text-sm font-semibold text-white hover:bg-[#15803D]"
                >
                  Finalize Batch
                </button>
              )}
            </div>
          </div>
        )}

        {/* KPI */}
        {batch && <PromoteKPICards kpi={liveKpi} />}

        {/* Smart Filter */}
        {batch && (
          <PromoteSmartFilter
            classOptions={classOptions}
            sectionOptions={sectionOptions}
            classKey={classKey}
            sectionKey={sectionKey}
            status={status}
            search={searchInput}
            onClassChange={(k) => { setClassKey(k); setSectionKey('all'); }}
            onSectionChange={setSectionKey}
            onStatusChange={setStatus}
            onSearchChange={setSearchInput}
            onSearchSubmit={() => setSearchActive(searchInput)}
            onReset={() => {
              setClassKey('all'); setSectionKey('all'); setStatus('all');
              setSearchInput(''); setSearchActive('');
            }}
          />
        )}

        {/* Class accordions */}
        {batch && classGroups.length === 0 && (
          <div className="rounded-2xl border border-[#E6E6EC] bg-white px-6 py-12 text-center text-sm text-[#6B6B7B]">
            No students match the current filters.
          </div>
        )}

        {batch && classGroups.length > 0 && (
          <div className="space-y-3">
            {classGroups.map((group) => (
              <ClassAccordionCard
                key={group.classKey}
                group={group}
                isOpen={!!expanded[group.classKey]}
                isReadOnly={isReadOnly}
                decisions={decisions}
                selectedIds={selectedIds}
                onToggle={() => setExpanded((p) => ({ ...p, [group.classKey]: !p[group.classKey] }))}
                onSelect={handleSelect}
                onSelectMany={handleSelectMany}
                onStatusChange={handleStatusChange}
                onOpenNotPromoted={handleOpenNotPromoted}
                onPromoteAll={handlePromoteAll}
                onNotPromotedAll={handleNotPromotedAll}
                onResetAll={handleResetAll}
              />
            ))}
          </div>
        )}

        {/* Empty / initial state */}
        {!batch && !loadingBatch && (
          <div className="rounded-2xl border border-dashed border-[#E6E6EC] bg-white px-6 py-16 text-center">
            <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF2FF]">
              <svg className="h-6 w-6 text-[#4729F4]" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-[#0B0B14]">Start a promotion batch</h3>
            <p className="mx-auto mt-1 max-w-md text-sm text-[#6B6B7B]">
              Select the source and target academic years, then click <strong>Load batch</strong> to begin reviewing students.
            </p>
          </div>
        )}
      </div>

      {/* Modals */}
      {confirmOpen && batch && liveKpi && (
        <ConfirmBatchModal
          kpi={liveKpi}
          targetYearName={batch.target_year_name}
          onConfirm={handleConfirm}
          onCancel={() => setConfirmOpen(false)}
          submitting={confirmingBatch}
        />
      )}

      {notPromotedTarget && batch && (
        <NotPromotedDialog
          batchId={batch.id}
          record={notPromotedTarget}
          initialReason={decisions[notPromotedTarget.id]?.retention_reason}
          initialNotes={decisions[notPromotedTarget.id]?.notes}
          initialAi={decisions[notPromotedTarget.id]?.ai_recommendation}
          onConfirm={handleNotPromotedConfirm}
          onCancel={() => setNotPromotedTarget(null)}
        />
      )}

      {promoteOverrideTarget && (
        <PromoteOverrideDialog
          record={promoteOverrideTarget}
          previousRetentionReason={decisions[promoteOverrideTarget.id]?.retention_reason}
          onConfirm={handlePromoteOverrideConfirm}
          onCancel={() => setPromoteOverrideTarget(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 max-w-md rounded-xl px-4 py-3 text-sm font-semibold shadow-lg"
          style={{
            background:
              toast.tone === 'success' ? '#ECFDF5' :
              toast.tone === 'error' ? '#FEF2F2' :
              '#EEF2FF',
            color:
              toast.tone === 'success' ? '#065F46' :
              toast.tone === 'error' ? '#991B1B' :
              '#3730A3',
            border: `1px solid ${
              toast.tone === 'success' ? '#A7F3D0' :
              toast.tone === 'error' ? '#FECACA' :
              '#C7D2FE'
            }`,
          }}
        >
          {toast.message}
        </div>
      )}
    </div>
  );
}
