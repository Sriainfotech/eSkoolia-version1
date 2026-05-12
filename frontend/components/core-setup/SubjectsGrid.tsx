"use client";

import { useState, useMemo } from "react";
import { Search, Plus } from "lucide-react";
import SubjectCard, { SubjectCardModel, SubjectType } from "./SubjectCard";

interface SubjectsGridProps {
  subjects: SubjectCardModel[];
  onAdd: () => void;
  onEdit: (subject: SubjectCardModel) => void;
  onDelete: (subject: SubjectCardModel) => void;
}

const TYPE_CONFIG: Record<SubjectType, { label: string; className: string }> = {
  core: { label: "Core", className: "border border-emerald-200 bg-emerald-50 text-emerald-700" },
  language: { label: "Language", className: "border border-blue-200 bg-blue-50 text-blue-700" },
  elective: { label: "Elective", className: "border border-purple-200 bg-purple-50 text-purple-700" },
  "co-curricular": { label: "Co-Curricular", className: "border border-rose-200 bg-rose-50 text-rose-700" },
};

export default function SubjectsGrid({
  subjects,
  onAdd,
  onEdit,
  onDelete,
}: SubjectsGridProps) {
  const [search, setSearch] = useState("");
  const [selectedType, setSelectedType] = useState<SubjectType | null>(null);

  const filtered = useMemo(() => {
    return subjects.filter((s) => {
      const matchesSearch =
        !search ||
        s.name.toLowerCase().includes(search.toLowerCase()) ||
        s.code.toLowerCase().includes(search.toLowerCase());
      const matchesType = !selectedType || s.type === selectedType;
      return matchesSearch && matchesType;
    });
  }, [subjects, search, selectedType]);

  return (
    <div>
      {/* Toolbar */}
      <div className="px-5 py-3 bg-white border-b border-zinc-200">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
            <div className="relative max-w-[300px] flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subjects..."
                className="w-full pl-9 pr-3 py-2 border border-zinc-300 rounded-[10px] text-[13px] bg-white transition focus:outline-none focus:border-violet-600 focus:ring-2 focus:ring-violet-100"
              />
            </div>
          </div>
        </div>

        {/* Type filter chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">Filter:</span>
          <button
            onClick={() => setSelectedType(null)}
            className={`px-3 py-1 rounded-full text-[11.5px] font-medium transition ${
              selectedType === null
                ? "bg-violet-100 text-violet-700 border border-violet-200"
                : "bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200"
            }`}
          >
            All Types
          </button>
          {(Object.keys(TYPE_CONFIG) as SubjectType[]).map((type) => (
            <button
              key={type}
              onClick={() => setSelectedType(type === selectedType ? null : type)}
              className={`px-3 py-1 rounded-full text-[11.5px] font-medium transition ${
                type === selectedType
                  ? TYPE_CONFIG[type].className
                  : "bg-zinc-100 text-zinc-600 border border-zinc-200 hover:bg-zinc-200"
              }`}
            >
              {TYPE_CONFIG[type].label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="px-5 py-4 bg-white">
        <div className="grid gap-3 items-stretch" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
          {filtered.map((s) => (
            <SubjectCard
              key={s.id}
              subject={s}
              typeLabel={TYPE_CONFIG[s.type].label}
              typeClassName={TYPE_CONFIG[s.type].className}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}

          {/* Add-subject tile */}
          {!search && !selectedType && (
            <button
              onClick={onAdd}
              className="border border-dashed border-zinc-300 rounded-xl flex flex-col items-center justify-center gap-1.5 min-h-[150px] text-zinc-600 hover:border-solid hover:border-violet-600 hover:text-violet-600 hover:bg-violet-50 transition group"
            >
              <div className="w-8 h-8 rounded-[10px] bg-zinc-50 text-zinc-600 grid place-items-center transition group-hover:bg-violet-50 group-hover:text-violet-600">
                <Plus size={16} />
              </div>
              <div className="font-[var(--font-playfair)] text-[14px] font-medium">Add a subject</div>
            </button>
          )}

          {filtered.length === 0 && (search || selectedType) && (
            <div className="col-span-full text-center py-12 text-zinc-400 text-[13.5px]">
              {search && selectedType
                ? `No subjects match "${search}" in ${TYPE_CONFIG[selectedType].label}.`
                : search
                  ? `No subjects match "${search}".`
                  : `No ${TYPE_CONFIG[selectedType!].label} subjects found.`}
            </div>
          )}

          {filtered.length === 0 && !search && !selectedType && (
            <div className="col-span-full text-center py-12 text-zinc-400 text-[13.5px]">
              No subjects yet. Create your first one to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
