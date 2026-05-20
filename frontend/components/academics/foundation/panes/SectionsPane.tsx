"use client";
import { useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { SchoolClass, Section, Toast } from "../types";

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
  const [creating, setCreating]       = useState(false);
  const [renamingId, setRenamingId]   = useState<number | null>(null);
  const [renameVal, setRenameVal]     = useState("");
  const [deletingId, setDeletingId]   = useState<number | null>(null);

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
    let ok = 0;
    const duplicates: string[] = [];
    const otherErrors: string[] = [];
    for (const classId of Array.from(selectedClsIds)) {
      const className = classes.find((c) => c.id === classId)?.name ?? `Class ${classId}`;
      for (const secName of preview) {
        try {
          await apiRequestWithRefresh("/api/v1/core/sections/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ school_class: classId, name: secName, capacity: 40 }),
          });
          ok++;
        } catch (err: unknown) {
          const raw = err instanceof Error ? err.message : String(err);
          let msg = raw;
          try {
            const parsed = JSON.parse(raw);
            const fieldErrs = parsed?.error?.field_errors ?? parsed?.field_errors ?? {};
            const nonField = fieldErrs.non_field_errors ?? parsed?.error?.message ?? parsed?.message;
            msg = Array.isArray(nonField) ? nonField.join(" ") : (nonField ?? raw);
          } catch { /* not JSON */ }
          if (/unique set|already exist|duplicate/i.test(msg)) {
            duplicates.push(`${className} - ${secName}`);
          } else {
            otherErrors.push(`${className} - ${secName}: ${msg}`);
          }
        }
      }
    }
    if (ok > 0) showToast(`${ok} section${ok > 1 ? "s" : ""} created ✓`);
    if (duplicates.length > 0) {
      const sample = duplicates.slice(0, 3).join(", ");
      const more = duplicates.length > 3 ? ` and ${duplicates.length - 3} more` : "";
      showToast(`Already exists: ${sample}${more}. Rename or delete the existing one first.`, "error");
    }
    if (otherErrors.length > 0) {
      showToast(otherErrors[0], "error");
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
    if (!confirm(`Delete section "${sec.name}"?`)) return;
    setDeletingId(sec.id);
    try {
      await apiRequestWithRefresh(`/api/v1/core/sections/${sec.id}/`, { method: "DELETE" });
      showToast(`Section "${sec.name}" deleted.`);
      onRefresh();
    } catch { showToast("Failed to delete section.", "error"); }
    finally { setDeletingId(null); }
  }

  // All sections grouped by class
  const allSections = classes.flatMap((cls) =>
    (cls.sections ?? []).map((sec) => ({ ...sec, className: cls.name }))
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
          <button onClick={onNext} className="px-3 py-[7px] rounded-[10px] border border-[#E8ECEF] text-[13px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors">Next: Rooms →</button>
        </div>
      </div>

      {/* ── Right: sections created ── */}
      <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-5">
        <div className="flex items-center justify-between mb-3.5">
          <div className="text-[14px] font-bold text-[#1A1D1F]">Sections Created</div>
          <span className="text-[11px] text-[#9FA6AD]">Click ✏ to rename · ✕ to delete</span>
        </div>

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
            {classes.filter((c) => (c.sections?.length ?? 0) > 0).map((cls) => (
              <div key={cls.id}>
                <p className="text-[11px] font-bold text-[#6F767E] uppercase tracking-wide mb-1.5">{cls.name}</p>
                <div className="flex flex-wrap gap-2">
                  {cls.sections.map((sec) =>
                    renamingId === sec.id ? (
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
    </div>
  );
}
