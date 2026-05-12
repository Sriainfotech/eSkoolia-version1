"use client";

import { useState, useMemo } from "react";
import { Search, Plus } from "lucide-react";
import { SchoolClass } from "@/lib/types";
import ClassCard from "./ClassCard";

interface ClassesGridProps {
  classes: SchoolClass[];
  onEdit: (cls: SchoolClass) => void;
  onAdd: () => void;
  onDelete: (cls: SchoolClass) => void;
  onAddSection: (classId: string, sectionName: string) => { ok: boolean; reason?: string };
  onRemoveSection: (classId: string, sectionName: string) => void;
}

export default function ClassesGrid({
  classes,
  onEdit,
  onAdd,
  onDelete,
  onAddSection,
  onRemoveSection,
}: ClassesGridProps) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    if (!search) return classes;
    const q = search.toLowerCase();
    return classes.filter(
      (c) => c.name.toLowerCase().includes(q) || (c.code || "").toLowerCase().includes(q)
    );
  }, [classes, search]);

  return (
    <div>
      {/* Toolbar */}
      <div className="px-5 py-3 bg-white border-b border-zinc-200 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[220px]">
          <div className="relative max-w-[300px] flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search classes..."
              className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-[10px] text-[13px] bg-white transition focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
            />
          </div>
        </div>
      </div>

      {/* Grid */}
      <div className="px-5 py-4 bg-white">
        <div className="grid gap-3 items-stretch" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
          {filtered.map((c) => (
            <ClassCard
              key={c.id}
              schoolClass={c}
              onEdit={onEdit}
              onDelete={onDelete}
              onAddSection={onAddSection}
              onRemoveSection={onRemoveSection}
            />
          ))}

          {/* Add-class tile (always shown, even when filtered) */}
          {!search && (
            <button
              onClick={onAdd}
              className="border border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center gap-1.5 min-h-[170px] text-zinc-600 hover:border-solid hover:border-violet-600 hover:text-violet-600 hover:bg-violet-50 transition group"
            >
              <div className="w-8 h-8 rounded-[10px] bg-zinc-50 text-zinc-600 grid place-items-center transition group-hover:bg-violet-50 group-hover:text-violet-600">
                <Plus size={16} />
              </div>
              <div className="font-[var(--font-playfair)] text-[14px] font-medium">Add a new class</div>
            </button>
          )}

          {filtered.length === 0 && search && (
            <div className="col-span-full text-center py-12 text-zinc-400 text-[13.5px]">
              No classes match &quot;{search}&quot;.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
