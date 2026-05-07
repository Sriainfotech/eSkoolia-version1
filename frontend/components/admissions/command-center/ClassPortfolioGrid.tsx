"use client";

import { motion, AnimatePresence, type Variants } from "framer-motion";
import { ChevronDown, ChevronUp, LayoutGrid, MoreVertical, Pencil, EyeOff, Eye, Check, X, AlertTriangle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { ClassConfig, ApiSection } from "@/types/admissions";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { toast } from "react-toastify";

interface Props {
  classes: ClassConfig[];
  selectedClassId: number | null;
  onSelectClass: (id: number | null) => void;
  onClassesUpdated: () => void;
  isLoading?: boolean;
}

const HIDDEN_KEY = "portfolio_hidden_classes";

const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.25, ease: "easeOut" } },
};
const stagger: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.05 } },
};

function HealthDot({ status }: { status: ClassConfig["healthStatus"] }) {
  const colors: Record<ClassConfig["healthStatus"], string> = {
    urgent:  "bg-red-500",
    active:  "bg-amber-400",
    healthy: "bg-green-500",
    quiet:   "bg-gray-400",
  };
  return (
    <span className={`inline-block w-2 h-2 rounded-full flex-shrink-0 ${colors[status]} ${status === "urgent" ? "animate-pulse" : ""}`} />
  );
}

// --- Edit Seats Modal ---
function EditSeatsModal({
  cls,
  onClose,
  onSaved,
}: {
  cls: ClassConfig;
  onClose: () => void;
  onSaved: () => void;
}) {
  // Each section gets its own capacity input
  const [values, setValues] = useState<Record<number, string>>(
    Object.fromEntries(cls.sections.map((s) => [s.id, String(s.capacity)]))
  );
  const [noSectionCap, setNoSectionCap] = useState(String(cls.capacity));
  const [saving, setSaving] = useState(false);

  const hasSection = cls.sections.length > 0;

  const handleSave = async () => {
    setSaving(true);
    try {
      if (hasSection) {
        await Promise.all(
          cls.sections.map((sec) => {
            const cap = parseInt(values[sec.id] ?? String(sec.capacity), 10);
            if (isNaN(cap) || cap < 1) throw new Error(`Invalid capacity for section ${sec.name}`);
            return apiRequestWithRefresh(`/api/v1/core/sections/${sec.id}/`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ capacity: cap }),
            });
          })
        );
      } else {
        // No sections — nothing to PATCH, just store locally as override
        const cap = parseInt(noSectionCap, 10);
        if (isNaN(cap) || cap < 1) { toast.error("Enter a valid capacity."); setSaving(false); return; }
        // store local override
        const overrides = JSON.parse(localStorage.getItem("class_capacity_overrides") ?? "{}") as Record<string, number>;
        overrides[String(cls.id)] = cap;
        localStorage.setItem("class_capacity_overrides", JSON.stringify(overrides));
      }
      toast.success("Seats updated.", { autoClose: 2000 });
      onSaved();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update seats.";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 8 }}
        transition={{ duration: 0.2 }}
        className="bg-white rounded-2xl shadow-xl border border-gray-100 w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900 text-base">Edit Seats — {cls.name}</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X size={15} />
          </button>
        </div>

        {hasSection ? (
          <div className="space-y-3 mb-5">
            <p className="text-xs text-gray-500">Set seat capacity per section. Changes are saved to the server.</p>
            {cls.sections.map((sec) => (
              <div key={sec.id} className="flex items-center gap-3">
                <span className="text-sm text-gray-700 w-20 font-medium">Section {sec.name}</span>
                <input
                  type="number"
                  min={1}
                  max={200}
                  value={values[sec.id] ?? String(sec.capacity)}
                  onChange={(e) => setValues((v) => ({ ...v, [sec.id]: e.target.value }))}
                  className="flex-1 h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
                <span className="text-xs text-gray-400">seats</span>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 mb-5">
            <p className="text-xs text-gray-500">No sections configured. Set a total seat count for this class (stored locally).</p>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-700 w-20 font-medium">Total seats</span>
              <input
                type="number"
                min={1}
                max={500}
                value={noSectionCap}
                onChange={(e) => setNoSectionCap(e.target.value)}
                className="flex-1 h-9 border border-gray-200 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>
        )}

        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Cancel</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-60 flex items-center gap-2"
          >
            {saving ? <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Check size={13} />}
            Save
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// --- Card context menu ---
function CardMenu({
  onEdit,
  onHide,
  isManageMode,
}: {
  onEdit: () => void;
  onHide: () => void;
  isManageMode: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        className="w-6 h-6 rounded-md flex items-center justify-center text-gray-400 hover:text-gray-700 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-opacity"
        title="Class options"
      >
        <MoreVertical size={12} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-7 z-50 bg-white border border-gray-200 rounded-xl shadow-xl min-w-[140px] py-1 overflow-hidden"
          >
            <button
              onClick={() => { setOpen(false); onEdit(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50"
            >
              <Pencil size={11} className="text-indigo-500" />
              Edit seats
            </button>
            <button
              onClick={() => { setOpen(false); onHide(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50"
            >
              <EyeOff size={11} />
              {isManageMode ? "Hide class" : "Remove from view"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

type PortfolioFilter = "all" | "active" | "overdue" | "almost-full";

const PORTFOLIO_FILTERS: { key: PortfolioFilter; label: string }[] = [
  { key: "all",         label: "All" },
  { key: "active",      label: "Has Applications" },
  { key: "overdue",     label: "Overdue" },
  { key: "almost-full", label: "Almost Full" },
];

export function ClassPortfolioGrid({ classes, selectedClassId, onSelectClass, onClassesUpdated, isLoading }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(HIDDEN_KEY) ?? "[]") as number[];
      return new Set(stored);
    } catch { return new Set(); }
  });
  const [showManage, setShowManage] = useState(false);
  const [editingClass, setEditingClass] = useState<ClassConfig | null>(null);
  const [portfolioFilter, setPortfolioFilter] = useState<PortfolioFilter>("all");

  const persistHidden = (ids: Set<number>) => {
    localStorage.setItem(HIDDEN_KEY, JSON.stringify([...ids]));
    setHiddenIds(new Set(ids));
  };

  const hideClass = (id: number) => {
    const next = new Set(hiddenIds);
    next.add(id);
    persistHidden(next);
    if (selectedClassId === id) onSelectClass(null);
    toast.info("Class hidden from portfolio. Use 'Manage' to restore.", { autoClose: 3000 });
  };

  const restoreClass = (id: number) => {
    const next = new Set(hiddenIds);
    next.delete(id);
    persistHidden(next);
  };

  const visibleClasses = classes.filter((c) => !hiddenIds.has(c.id));
  const hiddenClasses = classes.filter((c) => hiddenIds.has(c.id));

  /** Apply quick-filter to visible classes */
  const filteredClasses = visibleClasses.filter((c) => {
    if (portfolioFilter === "active")      return c.pipelineCount > 0;
    if (portfolioFilter === "overdue")     return c.overdueCount > 0;
    if (portfolioFilter === "almost-full") return c.capacity > 0 && c.enrolledCount / c.capacity >= 0.7;
    return true;
  });

  /** Counts for filter pill badges */
  const filterCounts: Record<PortfolioFilter, number> = {
    all:         visibleClasses.length,
    active:      visibleClasses.filter((c) => c.pipelineCount > 0).length,
    overdue:     visibleClasses.filter((c) => c.overdueCount > 0).length,
    "almost-full": visibleClasses.filter((c) => c.capacity > 0 && c.enrolledCount / c.capacity >= 0.7).length,
  };

  const allPipeline = visibleClasses.reduce((s, c) => s + c.pipelineCount, 0);
  const allEnrolled = visibleClasses.reduce((s, c) => s + c.enrolledCount, 0);

  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 cursor-pointer py-3 px-4 hover:bg-gray-50 rounded-xl" onClick={() => setCollapsed((v) => !v)}>
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-gray-100 text-xs font-bold text-gray-500">02</span>
        <LayoutGrid size={14} className="text-indigo-500" />
        <span className="text-sm font-semibold text-gray-800">Class Portfolio</span>
        <span className="ml-2 text-xs text-gray-400">Select a class to view its pipeline</span>
        {hiddenIds.size > 0 && (
          <span className="ml-2 inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-600 border border-amber-200 rounded-full px-2 py-0.5">
            <AlertTriangle size={9} />
            {hiddenIds.size} hidden
          </span>
        )}
        <div className="ml-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setShowManage((v) => !v)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${showManage ? "bg-indigo-600 text-white border-indigo-600" : "border-gray-200 text-gray-500 hover:bg-gray-100"}`}
          >
            {showManage ? "Done" : "Manage"}
          </button>
          <span className="text-gray-400">{collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}</span>
        </div>
      </div>

      {!collapsed && (
        <>
          {/* Quick filter pills */}
          {!isLoading && (
            <div className="flex items-center gap-2 px-4 pb-3 flex-wrap">
              {PORTFOLIO_FILTERS.map((f) => {
                const isActive = portfolioFilter === f.key;
                const count = filterCounts[f.key];
                return (
                  <button
                    key={f.key}
                    onClick={() => setPortfolioFilter(f.key)}
                    className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border transition-all ${
                      isActive
                        ? "bg-indigo-600 text-white border-indigo-600 shadow-sm"
                        : "bg-white text-gray-500 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
                    }`}
                  >
                    {f.label}
                    <span className={`inline-flex items-center justify-center min-w-[16px] h-4 text-[10px] font-bold rounded-full px-1 ${
                      isActive ? "bg-white/25 text-white" : "bg-gray-100 text-gray-500"
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
              {portfolioFilter !== "all" && filteredClasses.length === 0 && (
                <span className="text-xs text-gray-400 ml-1">No classes match this filter</span>
              )}
            </div>
          )}

          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 px-4 pb-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="animate-pulse rounded-xl border border-gray-100 bg-gray-50 h-24" />
              ))}
            </div>
          ) : (
            <>
              <motion.div
                variants={stagger}
                initial="hidden"
                animate="show"
                className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 px-4 pb-2"
              >
                {/* All Classes card */}
                <motion.button
                  variants={scaleIn}
                  whileHover={{ y: -2, transition: { duration: 0.15 } }}
                  onClick={() => onSelectClass(null)}
                  className={`group text-left p-3 rounded-xl border transition-all cursor-pointer w-full ${
                    selectedClassId === null
                      ? "border-indigo-500 bg-indigo-50 shadow-sm"
                      : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className="w-2 h-2 rounded-full bg-indigo-500 flex-shrink-0" />
                    <span className="text-xs font-semibold text-gray-800 truncate">All Classes</span>
                  </div>
                  <div className="text-lg font-bold text-indigo-600">{allPipeline}</div>
                  <div className="text-[10px] text-gray-500">pipeline · {allEnrolled} enrolled</div>
                </motion.button>

                {/* Per-class cards */}
                {filteredClasses.map((cls) => {
                  const pct = cls.capacity > 0 ? Math.min(100, Math.round((cls.enrolledCount / cls.capacity) * 100)) : 0;
                  const isSelected = selectedClassId === cls.id;
                  return (
                    <motion.div
                      key={cls.id}
                      variants={scaleIn}
                      whileHover={{ y: -2, transition: { duration: 0.15 } }}
                      onClick={() => onSelectClass(cls.id)}
                      className={`group relative text-left p-3 rounded-xl border transition-all cursor-pointer w-full ${
                        isSelected
                          ? "border-indigo-500 bg-indigo-50 shadow-sm"
                          : "border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm"
                      }`}
                    >
                      {/* Header row */}
                      <div className="flex items-center gap-1.5 mb-1">
                        <HealthDot status={cls.healthStatus} />
                        <span className="text-xs font-semibold text-gray-800 truncate flex-1">{cls.name}</span>
                        <CardMenu
                          onEdit={() => setEditingClass(cls)}
                          onHide={() => hideClass(cls.id)}
                          isManageMode={showManage}
                        />
                      </div>
                      <div className="text-lg font-bold text-gray-800">{cls.pipelineCount}</div>
                      <div className="text-[10px] text-gray-400 mb-1.5">
                        {cls.enrolledCount}/{cls.capacity} seats
                      </div>
                      {/* Capacity bar */}
                      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={`h-full rounded-full ${pct > 90 ? "bg-red-400" : pct > 60 ? "bg-amber-400" : "bg-green-400"}`}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </motion.div>

              {/* Hidden classes restore section — shown only in Manage mode */}
              <AnimatePresence>
                {showManage && hiddenClasses.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="px-4 pb-4 overflow-hidden"
                  >
                    <div className="border border-dashed border-amber-200 bg-amber-50/50 rounded-xl p-3">
                      <p className="text-xs font-medium text-amber-700 mb-2 flex items-center gap-1.5">
                        <EyeOff size={11} />
                        Hidden classes — click to restore
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {hiddenClasses.map((cls) => (
                          <button
                            key={cls.id}
                            onClick={() => restoreClass(cls.id)}
                            className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-white border border-amber-200 text-amber-700 rounded-full hover:bg-amber-100 transition-colors"
                          >
                            <Eye size={10} />
                            {cls.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Manage mode hint */}
              {showManage && hiddenClasses.length === 0 && (
                <p className="px-4 pb-3 text-xs text-gray-400">
                  Hover over a class card and click ⋮ to edit seats or hide it from this view.
                </p>
              )}
            </>
          )}
        </>
      )}

      {/* Edit Seats Modal */}
      <AnimatePresence>
        {editingClass && (
          <EditSeatsModal
            cls={editingClass}
            onClose={() => setEditingClass(null)}
            onSaved={() => { onClassesUpdated(); setEditingClass(null); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

