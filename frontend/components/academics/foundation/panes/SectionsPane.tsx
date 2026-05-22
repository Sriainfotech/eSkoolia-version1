"use client";
import { useState, useEffect } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { SchoolClass, Section, Toast } from "../types";
import ConfirmDeleteDialog from "../ConfirmDeleteDialog";

interface Props {
  classes: SchoolClass[];
  loading: boolean;
  onRefresh: () => void;
  showToast: (msg: string, tone?: Toast["tone"]) => void;
  onBack: () => void;
  onNext: () => void;
}

type Pattern = "alpha" | "num" | "roman";

const PATTERNS: Record<Pattern, string[]> = {
  alpha: ["A","B","C","D","E","F","G","H","I","J"],
  num:   ["1","2","3","4","5","6","7","8","9","10"],
  roman: ["I","II","III","IV","V","VI","VII","VIII","IX","X"],
};

const PATTERN_LABELS: Record<Pattern, string> = {
  alpha: "A, B, C",
  num:   "1, 2, 3",
  roman: "I, II, III",
};

function flatErrors(body: unknown): string {
  if (!body || typeof body !== "object") return "Failed to save.";
  const p = body as Record<string, unknown>;
  const src = (p.errors ?? p) as Record<string, unknown>;
  return Object.values(src).flatMap((v) => (Array.isArray(v) ? v : [v])).join(" ") || "Failed to save.";
}

export default function SectionsPane({ classes, loading, onRefresh, showToast, onBack, onNext }: Props) {
  const [selectedClsIds, setSelected] = useState<Set<number>>(new Set());
  const [count, setCount]             = useState(3);
  const [pattern, setPattern]         = useState<Pattern>("alpha");
  const [appliedPattern, setAppliedPattern] = useState<Pattern | null>(null);
  const [creating, setCreating]       = useState(false);
  const [sectionCapacity, setSectionCapacity] = useState(40); // Fix #3F
  const [renamingId, setRenamingId]   = useState<number | null>(null);
  const [renameVal, setRenameVal]     = useState("");
  const [deletingId, setDeletingId]   = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Section | null>(null);
  const [selectMode, setSelectMode]   = useState(false);
  const [selectedSecIds, setSelectedSecIds] = useState<Set<number>>(new Set());
  const [pendingBulkDelete, setPendingBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  // Optimistic UI: IDs removed from view immediately on delete confirm
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<number>>(new Set());

  // When classes prop updates (after a refresh), clean up any IDs that are no longer present.
  // This avoids clearing pendingDeleteIds prematurely before loading=true kicks in.
  useEffect(() => {
    if (pendingDeleteIds.size === 0) return;
    const existingIds = new Set(classes.flatMap((c) => (c.sections ?? []).map((s) => s.id)));
    const stale = [...pendingDeleteIds].filter((id) => !existingIds.has(id));
    if (stale.length > 0) {
      setPendingDeleteIds((prev) => {
        const next = new Set(prev);
        stale.forEach((id) => next.delete(id));
        return next;
      });
    }
  }, [classes]);

  const preview = PATTERNS[pattern].slice(0, Math.max(1, Math.min(count, 10)));

  function toggleClass(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function selectAll() {
    setSelected(new Set(classes.map((c) => c.id)));
  }

  async function createSections() {
    if (selectedClsIds.size === 0) { showToast("Select at least one class.", "error"); return; }
    setCreating(true);
    const classIds = Array.from(selectedClsIds);
    const newNames = preview;
    const newNamesLower = new Set(newNames.map((n) => n.toLowerCase()));

    // Collect existing section names from selected classes that are NOT in the new target set.
    // These will be deleted by the replace API, giving a true upsert / positional-replace behavior.
    const oldNamesSet = new Set<string>();
    for (const clsId of classIds) {
      const cls = classes.find((c) => c.id === clsId);
      (cls?.sections ?? []).forEach((s) => {
        if (!newNamesLower.has(s.name.toLowerCase())) {
          oldNamesSet.add(s.name);
        }
      });
    }
    const oldNames = Array.from(oldNamesSet);

    try {
      const res = await apiRequestWithRefresh<{ deleted: number; created: number }>(
        "/api/v1/core/sections/replace/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            class_ids: classIds,
            old_names: oldNames,
            new_names: newNames,
            capacity: sectionCapacity,
          }),
        }
      );
      if (res.created > 0 || res.deleted > 0) {
        const parts: string[] = [];
        if (res.created > 0) parts.push(`${res.created} section${res.created !== 1 ? "s" : ""} created`);
        if (res.deleted > 0) parts.push(`${res.deleted} old section${res.deleted !== 1 ? "s" : ""} removed`);
        showToast(parts.join(", ") + " ✓");
        setAppliedPattern(pattern);
      } else {
        showToast("Sections already match — nothing changed.", "error");
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create sections.";
      showToast(msg, "error");
    }

    setSelected(new Set());
    onRefresh();
    setCreating(false);
  }

  function startRename(sec: Section) {
    setRenamingId(sec.id);
    setRenameVal(sec.name);
  }

  async function saveRename() {
    if (!renamingId) return;
    try {
      await apiRequestWithRefresh(`/api/v1/core/sections/${renamingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameVal }),
      });
      showToast("Section renamed.");
      setRenamingId(null);
      onRefresh();
    } catch (err: unknown) {
      if (err instanceof Error) {
        try { showToast(flatErrors(JSON.parse(err.message) as unknown), "error"); }
        catch { showToast(err.message, "error"); }
      }
    }
  }

  async function deleteSection(sec: Section) {
    setPendingDelete(sec);
  }

  async function confirmDeleteSection() {
    const sec = pendingDelete;
    if (!sec) return;
    // Optimistic: hide section immediately and close dialog
    setPendingDelete(null);
    setPendingDeleteIds((prev) => new Set([...prev, sec.id]));
    setDeletingId(sec.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/sections/${sec.id}/`, { method: "DELETE" });
      showToast(`Section "${sec.name}" deleted.`);
      // Don't clear pendingDeleteIds here — useEffect cleans it up once classes prop refreshes.
      onRefresh();
    } catch (err: unknown) {
      // Restore section in view on failure
      setPendingDeleteIds((prev) => { const next = new Set(prev); next.delete(sec.id); return next; });
      const msg = err instanceof Error ? err.message : "";
      if (/\b404\b|not[_ ]?found/i.test(msg)) {
        showToast("This section no longer exists. Refreshing the list\u2026", "error");
        setPendingDeleteIds(new Set());
        onRefresh();
      } else {
        showToast("Failed to delete section.", "error");
      }
    }
    finally { setDeletingId(null); }
  }

  function toggleSecSelection(id: number) {
    setSelectedSecIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function enterSelectMode() {
    setRenamingId(null);
    setSelectMode(true);
  }

  async function confirmBulkDelete() {
    const ids = Array.from(selectedSecIds);
    // Optimistic: hide selected sections immediately and close dialog
    setPendingBulkDelete(false);
    setSelectMode(false);
    setSelectedSecIds(new Set());
    setPendingDeleteIds((prev) => new Set([...prev, ...ids]));
    setBulkDeleting(true);
    try {
      const res = await apiRequestWithRefresh<{ deleted: number }>(
        "/api/v1/core/sections/bulk-delete/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids }),
        }
      );
      showToast(`${res.deleted} section${res.deleted !== 1 ? "s" : ""} deleted ✓`);
      // Don't clear pendingDeleteIds here — useEffect cleans it up once classes prop refreshes.
      onRefresh();
    } catch (err: unknown) {
      // Restore sections in view on failure
      setPendingDeleteIds((prev) => { const next = new Set(prev); ids.forEach((id) => next.delete(id)); return next; });
      const msg = err instanceof Error ? err.message : "Failed to delete sections.";
      showToast(msg, "error");
    }
    setBulkDeleting(false);
  }

  // All sections grouped by class, excluding optimistically-deleted ones
  const allSections = classes.flatMap((cls) =>
    (cls.sections ?? []).filter((s) => !pendingDeleteIds.has(s.id)).map((sec) => ({ ...sec, className: cls.name }))
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* ── Left: create form ── */}
      <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-5">
        <div className="mb-3.5">
          <div className="text-[14px] font-bold text-[#1A1D1F]">Create Sections</div>
          <div className="text-[11px] text-[#6F767E] mt-0.5">Select one or more classes and define their sections</div>
        </div>

        {/* Class multi-select pills */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-[#6F767E] block mb-1.5">
            Apply to Classes{" "}
            <span className="text-[#9FA6AD] font-normal">(click to select/deselect)</span>
          </label>
          <div className="bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] p-2.5 min-h-[44px]">
            {classes.length === 0 ? (
              <span className="text-[12px] text-[#9FA6AD] italic">No classes — go back to Step 2</span>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {classes.map((cls) => {
                  const sel = selectedClsIds.has(cls.id);
                  return (
                    <button
                      key={cls.id}
                      onClick={() => toggleClass(cls.id)}
                      className={[
                        "px-2.5 py-1 rounded-full text-[12px] font-semibold border transition-all",
                        sel
                          ? "bg-[#5B4FCF] text-white border-[#5B4FCF]"
                          : "bg-white text-[#6F767E] border-[#D2D7DC] hover:border-[#5B4FCF] hover:text-[#5B4FCF]",
                      ].join(" ")}
                    >
                      {cls.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Count + Pattern */}
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-semibold text-[#6F767E] block mb-1">No. of Sections</label>
            <input
              type="number"
              value={count}
              min={1} max={10}
              onChange={(e) => setCount(Math.max(1, Math.min(10, Number(e.target.value))))}
              className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
            />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-[#6F767E] block mb-1">Name Pattern</label>
            <select
              value={pattern}
              onChange={(e) => setPattern(e.target.value as Pattern)}
              className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
            >
              <option value="alpha">A, B, C…</option>
              <option value="num">1, 2, 3…</option>
              <option value="roman">I, II, III…</option>
            </select>
          </div>
        </div>

        {/* Fix #3F — capacity per section input */}
        <div className="mb-3">
          <label className="text-[11px] font-semibold text-[#6F767E] block mb-1">Capacity per Section</label>
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={sectionCapacity}
              min={1}
              max={200}
              onChange={(e) => setSectionCapacity(Math.max(1, Math.min(200, Number(e.target.value) || 1)))}
              className="w-24 bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[10px] px-2.5 py-1.5 text-[13px] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors text-center"
            />
            <span className="text-[12px] text-[#9FA6AD]">students · default 40 · max 200</span>
          </div>
        </div>

        {/* Pattern change warning banner */}
        {appliedPattern !== null && appliedPattern !== pattern && selectedClsIds.size > 0 && (
          <div className="mb-3 flex items-start gap-2 px-3 py-2 rounded-[10px] bg-[#FFF8EC] border border-[#FFD166] text-[12px] text-[#7A5C00]">
            <span className="mt-px">⚠</span>
            <span>
              Pattern changed from <strong>{PATTERN_LABELS[appliedPattern]}</strong> to{" "}
              <strong>{PATTERN_LABELS[pattern]}</strong>. Clicking <em>Create Sections</em> will
              remove the old sections and create new ones for the selected classes.
            </span>
          </div>
        )}

        {/* Preview chips */}
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="text-[12px] text-[#6F767E]">Preview:</span>
          {preview.map((p) => (
            <span
              key={p}
              className="inline-flex items-center px-2.5 py-0.5 rounded-md bg-[#EEF0FF] text-[#5B4FCF] text-[12px] font-bold border border-[#C7C3F0]"
            >
              {p}
            </span>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 flex-wrap">
          <button onClick={onBack} className="px-3 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors">← Back</button>
          <button
            onClick={() => void createSections()}
            disabled={creating || selectedClsIds.size === 0}
            className="flex items-center gap-1.5 px-3.5 py-[7px] rounded-[10px] bg-[#5B4FCF] text-white text-[13px] font-semibold hover:bg-[#4A3FBF] disabled:opacity-50 transition-colors"
          >
            {creating ? "Creating…" : "+ Create Sections"}
          </button>
          <button
            onClick={selectAll}
            className="px-3.5 py-[7px] rounded-[10px] bg-[#EEF0FF] text-[#5B4FCF] text-[13px] font-semibold hover:bg-[#DDD9F5] transition-colors"
          >
            Select All Classes
          </button>
          <button onClick={onNext} className="px-3 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors">Next: Subjects →</button> {/* Fix #3E */}
        </div>
      </div>

      {/* ── Right: sections created ── */}
      <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="text-[14px] font-bold text-[#1A1D1F]">Sections Created</div>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <button
                  onClick={() => setSelectedSecIds(new Set(allSections.map((s) => s.id)))}
                  className="text-[11px] text-[#6F767E] hover:text-[#1A1D1F] transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={() => { setSelectMode(false); setSelectedSecIds(new Set()); }}
                  className="text-[11px] text-[#6F767E] hover:text-[#1A1D1F] transition-colors"
                >
                  Cancel Selection
                </button>
              </>
            ) : (
              <>
                <span className="text-[11px] text-[#9FA6AD]">Click ✏ to rename · ✕ to delete</span>
                {allSections.length > 0 && (
                  <button
                    onClick={enterSelectMode}
                    className="text-[11px] text-[#5B4FCF] font-semibold hover:underline transition-colors"
                  >
                    Select
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Action bar: visible only when 1+ sections are selected ── */}
        {selectMode && selectedSecIds.size > 0 && (
          <div className="flex items-center justify-between mb-3 px-3.5 py-2 rounded-[10px] bg-[#EEF0FF] border border-[#C7C4F0]">
            <span className="text-[12px] font-semibold text-[#5B4FCF]">
              {selectedSecIds.size} section{selectedSecIds.size !== 1 ? "s" : ""} selected
            </span>
            <button
              onClick={() => setPendingBulkDelete(true)}
              className="px-3 py-1 rounded-[8px] bg-[#DC2626] text-white text-[12px] font-semibold hover:bg-[#B91C1C] transition-colors"
            >
              Delete Selected
            </button>
          </div>
        )}

        {loading ? (
          <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-[#F0F2F5] animate-pulse" />)}</div>
        ) : allSections.length === 0 ? (
          <div className="text-center py-10 text-[#9FA6AD]">
            <p className="text-2xl mb-2">📂</p>
            <p className="text-[13px] font-medium">No sections yet</p>
            <p className="text-[11px] mt-1">Select classes and click Create Sections.</p>
          </div>
        ) : (
          <div className="overflow-y-auto max-h-[420px] space-y-3">
            {classes.filter((c) => (c.sections?.filter((s) => !pendingDeleteIds.has(s.id))?.length ?? 0) > 0).map((cls) => (
              <div key={cls.id}>
                <p className="text-[11px] font-bold text-[#6F767E] uppercase tracking-wide mb-1.5">{cls.name}</p>
                <div className="flex flex-wrap gap-2">
                  {cls.sections.filter((s) => !pendingDeleteIds.has(s.id)).map((sec) =>
                    selectMode ? (
                      <button
                        key={sec.id}
                        onClick={() => toggleSecSelection(sec.id)}
                        className={[
                          "flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-[12px] transition-all",
                          selectedSecIds.has(sec.id)
                            ? "bg-[#EEF0FF] border-[#5B4FCF] ring-1 ring-[#5B4FCF]"
                            : "bg-[#F0F2F5] border-[#E8ECEF] hover:border-[#5B4FCF] hover:bg-[#F8F7FF]",
                        ].join(" ")}
                      >
                        <span
                          className={[
                            "w-3.5 h-3.5 rounded-sm border flex items-center justify-center text-[9px] flex-shrink-0",
                            selectedSecIds.has(sec.id)
                              ? "bg-[#5B4FCF] border-[#5B4FCF] text-white"
                              : "border-[#D2D7DC] bg-white",
                          ].join(" ")}
                        >
                          {selectedSecIds.has(sec.id) && "✓"}
                        </span>
                        <span className="font-semibold text-[#1A1D1F]">{sec.name}</span>
                        <span className="text-[#9FA6AD] text-[10px]">({sec.student_count}/{sec.capacity})</span>
                      </button>
                    ) : renamingId === sec.id ? (
                      <div key={sec.id} className="flex items-center gap-1">
                        <input
                          autoFocus
                          value={renameVal}
                          onChange={(e) => setRenameVal(e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") void saveRename(); if (e.key === "Escape") setRenamingId(null); }}
                          className="w-16 text-[12px] border-[1.5px] border-[#5B4FCF] rounded-md px-1.5 py-0.5 bg-white outline-none"
                        />
                        <button onClick={() => void saveRename()} className="text-[#5B4FCF] text-[11px] font-bold hover:underline">✓</button>
                        <button onClick={() => setRenamingId(null)} className="text-[#9FA6AD] text-[11px]">✕</button>
                      </div>
                    ) : (
                      <div
                        key={sec.id}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#F0F2F5] border border-[#E8ECEF] text-[12px]"
                      >
                        <span className="font-semibold text-[#1A1D1F]">{sec.name}</span>
                        <span className="text-[#9FA6AD] text-[10px]">({sec.student_count}/{sec.capacity})</span>
                        <button
                          onClick={() => startRename(sec)}
                          className="ml-1 text-[#6F767E] hover:text-[#5B4FCF] text-[10px]"
                          title="Rename"
                        >✏</button>
                        <button
                          onClick={() => void deleteSection(sec)}
                          disabled={deletingId === sec.id}
                          className="text-[#9FA6AD] hover:text-[#EF4444] text-[10px] disabled:opacity-40"
                          title="Delete"
                        >
                          {deletingId === sec.id ? "…" : "✕"}
                        </button>
                      </div>
                    )
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        title="Delete Section"
        message={
          <>
            Are you sure you want to delete section <strong>“{pendingDelete?.name}”</strong>? Any students
            currently assigned to this section will be unlinked.
          </>
        }
        loading={deletingId === pendingDelete?.id}
        onConfirm={() => void confirmDeleteSection()}
        onCancel={() => setPendingDelete(null)}
      />
      <ConfirmDeleteDialog
        open={pendingBulkDelete}
        title="Delete Sections"
        message="Are you sure you want to delete the selected sections? Students linked to these sections will be unassigned."
        loading={bulkDeleting}
        onConfirm={() => void confirmBulkDelete()}
        onCancel={() => setPendingBulkDelete(false)}
      />    </div>
  );
}
