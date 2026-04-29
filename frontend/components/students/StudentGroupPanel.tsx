"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Search, ChevronDown, X } from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { studentThemeClassName } from "./studentTheme";

/* ─── Types ──────────────────────────────────────────────────────── */
type GroupType = "HOUSE" | "CLUB" | "CUSTOM";

type StudentGroup = {
  id: number;
  name: string;
  type: GroupType;
  emoji: string;
  description: string;
  color: string;
  bg_color: string;
  capacity: number;
  students_count?: number;
};

type GroupStats = {
  totalStudents: number;
  assigned: number;
  unassigned: number;
  houseCount: number;
  clubCount: number;
};

type GroupStudent = {
  id: number;
  name: string;
  admissionNo: string;
  class: string;
  section: string;
  classIndex: number;
  currentGroupId: number | null;
  gender: string;
};

type SortwellHousePreview = {
  groupId: number;
  groupName: string;
  emoji: string;
  color: string;
  bgColor: string;
  count: number;
};

type ApiList<T> = T[] | { count: number; results: T[] };

type TabFilter = "all" | "house" | "club" | "custom";

type StudentOption = {
  id: number;
  first_name?: string;
  last_name?: string;
  admission_no?: string;
  student_group?: number | null;
};

type SchoolClassOption = { id: number; class_name?: string; name?: string };
type SectionOption = { id: number; name: string; school_class: number };
type ApiError = {
  message?: string;
  details?: { message?: string; field_errors?: Record<string, string | string[]> };
};

/* ─── Constants ───────────────────────────────────────────────── */
const CLASS_LIST = [
  { seq: "01", name: "Nursery", index: 0 },
  { seq: "02", name: "LKG", index: 1 },
  { seq: "03", name: "UKG", index: 2 },
  { seq: "04", name: "Grade 1", index: 3 },
  { seq: "05", name: "Grade 2", index: 4 },
  { seq: "06", name: "Grade 3", index: 5 },
  { seq: "07", name: "Grade 4", index: 6 },
  { seq: "08", name: "Grade 5", index: 7 },
  { seq: "09", name: "Grade 6", index: 8 },
  { seq: "10", name: "Grade 7", index: 9 },
  { seq: "11", name: "Grade 8", index: 10 },
  { seq: "12", name: "Grade 9", index: 11 },
  { seq: "13", name: "Grade 10", index: 12 },
];

const AVATAR_COLORS = [
  "#00b894",
  "#6c5ce7",
  "#e67e22",
  "#2980b9",
  "#e74c3c",
  "#27ae60",
  "#f39c12",
  "#8e44ad",
];

const TYPE_PRESETS: Record<GroupType, { color: string; bg_color: string; emoji: string }> = {
  HOUSE: { color: "#00b894", bg_color: "#e6f9f5", emoji: "🏠" },
  CLUB: { color: "#6c5ce7", bg_color: "#f0eeff", emoji: "⭐" },
  CUSTOM: { color: "#2980b9", bg_color: "#e8f4fd", emoji: "📚" },
};

const DEFAULT_GROUPS: Array<{
  name: string;
  type: GroupType;
  emoji: string;
  color: string;
  bg_color: string;
  capacity: number;
  description: string;
}> = [
  { name: "Tagore House", type: "HOUSE", emoji: "🎨", color: "#00b894", bg_color: "#e6f9f5", capacity: 200, description: "Arts, literature & cultural leadership" },
  { name: "Kalam House", type: "HOUSE", emoji: "🚀", color: "#6c5ce7", bg_color: "#f0eeff", capacity: 200, description: "Science, technology & innovation" },
  { name: "Gandhi House", type: "HOUSE", emoji: "☮️", color: "#e67e22", bg_color: "#fef3e8", capacity: 200, description: "Values, community & social leadership" },
  { name: "Bose House", type: "HOUSE", emoji: "⚡", color: "#e74c3c", bg_color: "#fdeaea", capacity: 200, description: "Courage, discipline & resilience" },
  { name: "Science Club", type: "CLUB", emoji: "🔬", color: "#2980b9", bg_color: "#e8f4fd", capacity: 80, description: "Hands-on science exploration" },
  { name: "Drama Club", type: "CLUB", emoji: "🎭", color: "#8e44ad", bg_color: "#f5eefb", capacity: 80, description: "Stagecraft and performance" },
  { name: "Eco Club", type: "CLUB", emoji: "🌿", color: "#27ae60", bg_color: "#eafaf1", capacity: 80, description: "Environment and sustainability" },
  { name: "Math Circle", type: "CLUB", emoji: "➗", color: "#f39c12", bg_color: "#fef9e7", capacity: 80, description: "Problem solving and olympiad prep" },
];

/* ─── Helpers ─────────────────────────────────────────────────── */
function unwrapList<T>(data: ApiList<T>): T[] {
  if (Array.isArray(data)) return data;
  return data.results;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0]?.toUpperCase() ?? "?";
  return (parts[0][0]?.toUpperCase() ?? "") + (parts[parts.length - 1][0]?.toUpperCase() ?? "");
}

function pct(count: number, cap: number): number {
  if (!cap) return 0;
  return Math.min(100, Math.round((count / cap) * 100));
}

/* ─── Component ───────────────────────────────────────────────── */
export function StudentGroupPanel() {
  // ── Data / loading ───────────────────────────────────────────────────────────
  const [rows, setRows] = useState<StudentGroup[]>([]);
  const [students, setStudents] = useState<GroupStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState<{ message: string; type: "success" | "error"; duration?: number } | null>(null);
  const [aiBannerDismissed, setAiBannerDismissed] = useState(false);
  const autoDefaultsSeededRef = useRef(false);

  // ── Selection State for Bulk Actions ─────────────────────────────────────────
  const [selectedStudentIds, setSelectedStudentIds] = useState<number[]>([]);
  const [bulkTargetGroupId, setBulkTargetGroupId] = useState("");

  // ── Filter State ─────────────────────────────────────────────────────────────
  const [filterClass, setFilterClass] = useState<string[]>([]);
  const [filterSection, setFilterSection] = useState<string[]>([]);
  const [filterHouse, setFilterHouse] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<"all" | "assigned" | "unassigned">("all");
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

  const [filterClub, setFilterClub] = useState<string[]>([]);

  const clearFilters = () => {
    setFilterClass([]);
    setFilterSection([]);
    setFilterHouse([]);
    setFilterClub([]);
    setFilterStatus("all");
    setSearch("");
  };

  const [stats, setStats] = useState<GroupStats | null>(null);

  // ── Tab filter ───────────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<TabFilter>("all");

  // ── Search / sort / pagination ───────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "count">("name");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);

  // ── Accordion / student cache ────────────────────────────────────────────────
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set());
  const [groupStudents, setGroupStudents] = useState<Record<number, GroupStudent[]>>({});
  const [loadingStudents, setLoadingStudents] = useState<Set<number>>(new Set());

  // ── Delete modal ─────────────────────────────────────────────────────────────
  const [deleteConfirm, setDeleteConfirm] = useState<StudentGroup | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Assign students modal ────────────────────────────────────────────────────
  const [assignGroup, setAssignGroup] = useState<StudentGroup | null>(null);
  const [assignStudents, setAssignStudents] = useState<StudentOption[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignSearch, setAssignSearch] = useState("");
  const [assignClasses, setAssignClasses] = useState<SchoolClassOption[]>([]);
  const [assignSections, setAssignSections] = useState<SectionOption[]>([]);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSectionId, setAssignSectionId] = useState("");

  // ── Sortwell modal ───────────────────────────────────────────────────────────
  const [sortwellOpen, setSortwellOpen] = useState(false);
  const [sortwellMethod, setSortwellMethod] = useState<"random" | "alpha" | "classwise" | "gender">("random");
  const [sortwellScope, setSortwellScope] = useState<"unassigned" | "all">("unassigned");
  const [sortwellPreview, setSortwellPreview] = useState<SortwellHousePreview[]>([]);
  const [sortwellTotal, setSortwellTotal] = useState(0);
  const [sortwellPreviewLoading, setSortwellPreviewLoading] = useState(false);
  const [sortwellRunning, setSortwellRunning] = useState(false);

  // ── Form state ───────────────────────────────────────────────────────────────
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [groupType, setGroupType] = useState<GroupType>("CUSTOM");
  const [emoji, setEmoji] = useState(TYPE_PRESETS.CUSTOM.emoji);
  const [color, setColor] = useState(TYPE_PRESETS.CUSTOM.color);
  const [bgColor, setBgColor] = useState(TYPE_PRESETS.CUSTOM.bg_color);
  const [capacity, setCapacity] = useState(40);
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // ── Club modal ───────────────────────────────────────────────────────────────
  const [showClubForm, setShowClubForm] = useState(false);
  const [clubName, setClubName] = useState("");
  const [clubDescription, setClubDescription] = useState("");
  const [clubEmoji, setClubEmoji] = useState("⭐");
  const [clubCapacity, setClubCapacity] = useState(40);
  const [savingClub, setSavingClub] = useState(false);

  // ── All students (global, used by accordion sections) ───────────────────────
  const [allStudents, setAllStudents] = useState<GroupStudent[]>([]);
  const [allStudentsLoading, setAllStudentsLoading] = useState(false);

  // ── Per-student in-flight assignment tracking ────────────────────────────────
  const [savingAssignIds, setSavingAssignIds] = useState<Set<number>>(new Set());

  // ── Expanded class rows (nested accordion) ───────────────────────────────────
  const [expandedClassRows, setExpandedClassRows] = useState<Set<string>>(new Set());

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function listData<T>(value: ApiList<T>): T[] {
    return Array.isArray(value) ? value : value.results || [];
  }

  function totalCountFromApi<T>(value: ApiList<T>): number {
    if (Array.isArray(value)) return value.length;
    return typeof value.count === "number" ? value.count : (value.results || []).length;
  }

  function sanitize(value: string) {
    return value.replace(/<[^>]*>/g, "").trim();
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

  async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
    return apiRequestWithRefresh<T>(path, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  async function apiDelete(path: string): Promise<void> {
    await apiRequestWithRefresh<void>(path, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
    });
  }

  // ── Data loading ─────────────────────────────────────────────────────────────
  const loadStats = useCallback(async () => {
    try {
      const data = await apiGet<GroupStats>("/api/v1/students/groups/stats/");
      setStats(data);
    } catch {
      // non-critical
    }
  }, []);

  const load = useCallback(async (
    targetPage = currentPage,
    targetPageSize = pageSize,
    targetSearch = debouncedSearch,
    targetSort = sortBy,
  ) => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams();
      params.set("page", String(targetPage));
      params.set("page_size", String(targetPageSize));
      if (targetSearch.trim()) params.set("search", targetSearch.trim());
      params.set("sort_by", targetSort);

      const data = await apiGet<ApiList<StudentGroup>>(`/api/v1/students/groups/?${params.toString()}`);
      setRows(listData(data));
      setTotalCount(totalCountFromApi(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load groups";
      setError(message && message !== "401" ? message : "Unable to load student groups.");
    } finally {
      setLoading(false);
    }
  }, [currentPage, pageSize, debouncedSearch, sortBy]);

  const loadGroupStudents = async (groupId: number) => {
    if (groupStudents[groupId] || loadingStudents.has(groupId)) return;
    setLoadingStudents((prev) => new Set(prev).add(groupId));
    try {
      const data = await apiGet<GroupStudent[]>(`/api/v1/students/groups/students/?groupId=${groupId}`);
      setGroupStudents((prev) => ({ ...prev, [groupId]: data }));
    } catch {
      setGroupStudents((prev) => ({ ...prev, [groupId]: [] }));
    } finally {
      setLoadingStudents((prev) => {
        const next = new Set(prev);
        next.delete(groupId);
        return next;
      });
    }
  };

  // ── Sortwell preview ─────────────────────────────────────────────────────────
  const fetchSortwellPreview = async (scope: "unassigned" | "all") => {
    setSortwellPreviewLoading(true);
    try {
      const data = await apiGet<{ houses: SortwellHousePreview[]; total: number; houseCount: number }>(
        `/api/v1/students/groups/sortwell-preview/?scope=${scope}`,
      );
      setSortwellPreview(data.houses || []);
      setSortwellTotal(data.total || 0);
    } catch {
      setSortwellPreview([]);
    } finally {
      setSortwellPreviewLoading(false);
    }
  };

  // ── Effects ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    void loadStats();
  }, [loadStats]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    void load(currentPage, pageSize, debouncedSearch, sortBy);
  }, [currentPage, pageSize, debouncedSearch, sortBy]); // eslint-disable-line

  useEffect(() => {
    if (toast) {
      const timer = setTimeout(() => setToast(null), toast.duration || 3000);
      return () => clearTimeout(timer);
    }
  }, [toast]);

  useEffect(() => { setCurrentPage(1); }, [pageSize]);

  useEffect(() => {
    if (loading || autoDefaultsSeededRef.current) return;
    autoDefaultsSeededRef.current = true;

    const seedDefaults = async () => {
      try {
        const allGroups = await apiGet<ApiList<StudentGroup>>("/api/v1/students/groups/?page=1&page_size=1000");
        const existingNames = new Set(
          listData(allGroups).map((g) => String(g.name || "").trim().toLowerCase()).filter(Boolean),
        );
        const missing = DEFAULT_GROUPS.filter((g) => !existingNames.has(g.name.toLowerCase()));
        if (!missing.length) return;

        let created = 0;
        for (const group of missing) {
          try {
            await apiPost("/api/v1/students/groups/", group);
            created += 1;
          } catch (err) {
            const msg = (err as ApiError)?.details?.message || (err as Error)?.message || "";
            const dup = msg.toLowerCase().includes("already") || msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("unique");
            if (!dup) {
              // Ignore non-blocking errors for default seeding to avoid breaking page usage.
            }
          }
        }

        if (created > 0) {
          await Promise.all([load(1, pageSize, debouncedSearch, sortBy), loadStats()]);
          setCurrentPage(1);
          setToast({ message: `✓ Added ${created} default groups`, type: "success" });
        }
      } catch {
        // Silent fail: page still remains fully usable without blocking the user.
      }
    };

    void seedDefaults();
  }, [loading, pageSize, debouncedSearch, sortBy, loadStats, load]);

  // ── Filtered rows by tab ─────────────────────────────────────────────────────
  const filteredRows = useMemo(() => {
    if (activeTab === "all") return rows;
    const map: Record<TabFilter, GroupType | null> = {
      all: null,
      house: "HOUSE",
      club: "CLUB",
      custom: "CUSTOM",
    };
    return rows.filter((r) => r.type === map[activeTab]);
  }, [rows, activeTab]);

  // Tab counts from rows
  const houseCount = rows.filter((r) => r.type === "HOUSE").length;
  const clubCount = rows.filter((r) => r.type === "CLUB").length;
  const customCount = rows.filter((r) => r.type === "CUSTOM").length;

  // ── Form helpers ─────────────────────────────────────────────────────────────
  const clearFieldError = (field: string) => {
    setFieldErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setDescription("");
    setGroupType("CUSTOM");
    setEmoji(TYPE_PRESETS.CUSTOM.emoji);
    setColor(TYPE_PRESETS.CUSTOM.color);
    setBgColor(TYPE_PRESETS.CUSTOM.bg_color);
    setCapacity(40);
    setFieldErrors({});
    setError("");
    setShowForm(false);
  };

  const onEdit = (row: StudentGroup) => {
    setEditingId(row.id);
    setName(row.name);
    setDescription(row.description || "");
    setGroupType(row.type || "CUSTOM");
    setEmoji(row.emoji || TYPE_PRESETS[row.type || "CUSTOM"].emoji);
    setColor(row.color || TYPE_PRESETS[row.type || "CUSTOM"].color);
    setBgColor(row.bg_color || TYPE_PRESETS[row.type || "CUSTOM"].bg_color);
    setCapacity(row.capacity || 40);
    setFieldErrors({});
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    const n = sanitize(name);
    if (!n) errors.name = "Group name is required";
    else if (n.length < 3) errors.name = "Minimum 3 characters required";
    else if (rows.some((r) => r.name.toLowerCase() === n.toLowerCase() && r.id !== editingId))
      errors.name = "Group name already exists";
    if (sanitize(description).length > 255) errors.description = "Maximum 255 characters";
    if (capacity < 1 || capacity > 9999) errors.capacity = "Capacity must be between 1 and 9999";
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!validateForm()) return;
    try {
      setSaving(true);
      setError("");
      const payload = {
        name: sanitize(name),
        description: sanitize(description),
        type: groupType,
        emoji,
        color,
        bg_color: bgColor,
        capacity,
      };
      const isEdit = !!editingId;
      if (isEdit) {
        await apiPatch(`/api/v1/students/groups/${editingId}/`, payload);
      } else {
        await apiPost("/api/v1/students/groups/", payload);
      }
      setToast({ message: isEdit ? "✓ Group updated" : "✓ Group created", type: "success" });
      resetForm();
      // Invalidate accordion cache for edited group
      if (editingId) {
        setGroupStudents((prev) => {
          const next = { ...prev };
          delete next[editingId];
          return next;
        });
      }
      await Promise.all([load(1, pageSize, debouncedSearch, sortBy), loadStats()]);
      setCurrentPage(1);
    } catch (err) {
      const err_ = err as ApiError;
      const message = err_.details?.message || err_.message || "Unable to save group";
      const nameErr = err_.details?.field_errors?.name;
      if (nameErr) setFieldErrors((prev) => ({ ...prev, name: Array.isArray(nameErr) ? String(nameErr[0]) : String(nameErr) }));
      setError(message && message !== "401" ? message : "Unable to save student group.");
      setToast({ message: "✗ Failed to save group", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  // ── Accordion ─────────────────────────────────────────────────────────────────
  const toggleAccordion = (groupId: number) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
        void loadGroupStudents(groupId);
      }
      return next;
    });
  };

  // ── Delete ───────────────────────────────────────────────────────────────────
  const confirmDelete = async () => {
    if (!deleteConfirm) return;
    try {
      setDeleting(true);
      setError("");
      await apiDelete(`/api/v1/students/groups/${deleteConfirm.id}/`);
      setToast({ message: "✓ Group deleted", type: "success" });
      if (editingId === deleteConfirm.id) resetForm();
      setDeleteConfirm(null);
      setGroupStudents((prev) => {
        const next = { ...prev };
        delete next[deleteConfirm.id];
        return next;
      });
      await Promise.all([load(currentPage, pageSize, debouncedSearch, sortBy), loadStats()]);
    } catch (err) {
      const msg = (err as ApiError)?.details?.message || (err as Error)?.message || "";
      setToast({ message: msg.toLowerCase().includes("students") ? "Cannot delete group with assigned students" : "✗ Failed to delete group", type: "error" });
    } finally {
      setDeleting(false);
    }
  };

  // ── Assign modal ─────────────────────────────────────────────────────────────
  const openAssignModal = async (row: StudentGroup) => {
    try {
      setAssignLoading(true);
      setAssignGroup(row);
      setAssignSearch("");
      setSelectedStudentIds([]);
      setAssignClassId("");
      setAssignSectionId("");
      const [classData, sectionData, studentData] = await Promise.all([
        apiGet<ApiList<SchoolClassOption>>("/api/v1/core/classes/?page_size=500"),
        apiGet<ApiList<SectionOption>>("/api/v1/core/sections/?page_size=500"),
        apiGet<ApiList<StudentOption>>("/api/v1/students/students/?is_active=true&page_size=500"),
      ]);
      setAssignClasses(listData(classData));
      setAssignSections(listData(sectionData));
      setAssignStudents(listData(studentData));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load students.";
      setError(message && message !== "401" ? message : "Unable to load students for assignment.");
      setAssignGroup(null);
    } finally {
      setAssignLoading(false);
    }
  };

  const loadAssignableStudents = async (classFilter = assignClassId, sectionFilter = assignSectionId) => {
    try {
      setAssignLoading(true);
      const params = new URLSearchParams();
      params.set("is_active", "true");
      params.set("page_size", "500");
      if (classFilter) params.set("class_id", classFilter);
      if (sectionFilter) params.set("section_id", sectionFilter);
      const data = await apiGet<ApiList<StudentOption>>(`/api/v1/students/students/?${params.toString()}`);
      setAssignStudents(listData(data));
      setSelectedStudentIds([]);
    } catch {
      setToast({ message: "Unable to load students.", type: "error" });
    } finally {
      setAssignLoading(false);
    }
  };

  const filteredSectionsByClass = useMemo(() => {
    if (!assignClassId) return assignSections;
    return assignSections.filter((s) => Number(s.school_class) === Number(assignClassId));
  }, [assignSections, assignClassId]);

  const filteredAssignableStudents = useMemo(() => {
    const q = assignSearch.trim().toLowerCase();
    return assignStudents.filter((s) => {
      if (s.student_group && s.student_group === assignGroup?.id) return false;
      if (!q) return true;
      const name = `${s.first_name || ""} ${s.last_name || ""}`.trim().toLowerCase();
      return name.includes(q) || String(s.admission_no || "").toLowerCase().includes(q);
    });
  }, [assignStudents, assignSearch, assignGroup]);

  const visibleAssignableIds = useMemo(() => filteredAssignableStudents.map((s) => s.id), [filteredAssignableStudents]);
  const allVisibleSelected = visibleAssignableIds.length > 0 && visibleAssignableIds.every((id) => selectedStudentIds.includes(id));

  const toggleSelectAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...visibleAssignableIds])));
    } else {
      setSelectedStudentIds((prev) => prev.filter((id) => !visibleAssignableIds.includes(id)));
    }
  };

  const submitAssignStudents = async () => {
    if (!assignGroup || selectedStudentIds.length === 0) {
      setToast({ message: "Select at least one student.", type: "error" });
      return;
    }
    try {
      setAssigning(true);
      await apiPost(`/api/v1/students/groups/${assignGroup.id}/assign-students/`, { student_ids: selectedStudentIds });
      // Invalidate accordion cache
      setGroupStudents((prev) => {
        const next = { ...prev };
        delete next[assignGroup.id];
        return next;
      });
      setAssignGroup(null);
      setSelectedStudentIds([]);
      setToast({ message: "✓ Students assigned successfully", type: "success" });
      await Promise.all([load(currentPage, pageSize, debouncedSearch, sortBy), loadStats()]);
    } catch {
      setToast({ message: "Unable to assign students.", type: "error" });
    } finally {
      setAssigning(false);
    }
  };

  const submitBulkAssign = async () => {
    if (!bulkTargetGroupId || selectedStudentIds.length === 0) return;
    try {
      setSaving(true);
      await apiPost("/api/v1/students/groups/bulk-assign/", {
        student_ids: selectedStudentIds,
        group_id: Number(bulkTargetGroupId),
      });
      setToast({ message: `✓ Moved ${selectedStudentIds.length} students`, type: "success" });
      setSelectedStudentIds([]);
      setBulkTargetGroupId("");
      // Refresh data
      setGroupStudents({});
      await Promise.all([load(currentPage, pageSize, debouncedSearch, sortBy), loadStats()]);
    } catch {
      setToast({ message: "✗ Bulk move failed", type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleApplyAiSuggestion = async () => {
    void runSortwell(); // Sortwell effectively handles the distribution of unassigned students
  };

  // ── Sortwell ──────────────────────────────────────────────────────────────────
  const openSortwell = async () => {
    setSortwellOpen(true);
    await fetchSortwellPreview(sortwellScope);
  };

  const runSortwell = async () => {
    try {
      setSortwellRunning(true);
      const result = await apiPost<{ assigned: number; distribution: { groupId: number; groupName: string; count: number }[] }>(
        "/api/v1/students/groups/sortwell/",
        { method: sortwellMethod, scope: sortwellScope },
      );
      setSortwellOpen(false);
      setToast({ message: `✓ ${result.assigned} students distributed across houses`, type: "success" });
      // Refresh everything
      setGroupStudents({});
      await Promise.all([load(1, pageSize, debouncedSearch, sortBy), loadStats()]);
      setCurrentPage(1);
    } catch {
      setToast({ message: "✗ Sortwell failed. Please try again.", type: "error" });
    } finally {
      setSortwellRunning(false);
    }
  };

  // ── All students loader (global, feeds accordion sections) ────────────────────
  const loadAllStudents = useCallback(async () => {
    setAllStudentsLoading(true);
    try {
      const params = new URLSearchParams();
      filterClass.forEach((c) => params.append("class", c));
      filterSection.forEach((s) => params.append("section", s));
      if (filterStatus === "unassigned") params.set("status", "unassigned");
      const data = await apiGet<GroupStudent[]>(`/api/v1/students/groups/students/?${params.toString()}`);
      setAllStudents(data);
    } catch {
      // non-critical
    } finally {
      setAllStudentsLoading(false);
    }
  }, [filterClass, filterSection, filterStatus]); // eslint-disable-line

  useEffect(() => { void loadAllStudents(); }, [loadAllStudents]);

  // ── Per-student individual assignment ─────────────────────────────────────────
  const handleAssignStudent = async (studentId: number, groupId: number | null) => {
    const prev = allStudents;
    setAllStudents((s) => s.map((x) => x.id === studentId ? { ...x, currentGroupId: groupId } : x));
    setSavingAssignIds((s) => { const n = new Set(s); n.add(studentId); return n; });
    try {
      await apiPost("/api/v1/students/groups/assign/", { studentId, groupId });
      setToast({ message: "✓ Assignment saved", type: "success" });
      await Promise.all([load(currentPage, pageSize, debouncedSearch, sortBy), loadStats()]);
    } catch {
      setAllStudents(prev);
      setToast({ message: "✗ Assignment failed", type: "error" });
    } finally {
      setSavingAssignIds((s) => { const n = new Set(s); n.delete(studentId); return n; });
    }
  };

  // ── Create club ───────────────────────────────────────────────────────────────
  const submitCreateClub = async () => {
    if (!clubName.trim()) return;
    setSavingClub(true);
    try {
      await apiPost("/api/v1/students/groups/", {
        name: clubName.trim(),
        description: clubDescription,
        emoji: clubEmoji || "⭐",
        type: "CLUB",
        capacity: clubCapacity,
      });
      setToast({ message: "✓ Club created", type: "success" });
      setShowClubForm(false);
      setClubName(""); setClubDescription(""); setClubEmoji("⭐"); setClubCapacity(40);
      await Promise.all([load(1, pageSize, debouncedSearch, sortBy), loadStats()]);
      setCurrentPage(1);
    } catch {
      setToast({ message: "✗ Failed to create club", type: "error" });
    } finally {
      setSavingClub(false);
    }
  };

  // ── Pagination ────────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  useEffect(() => {
    if (totalPages > 0 && currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  // ── Style helpers ─────────────────────────────────────────────────────────────
  const FIELD: React.CSSProperties = {
    width: "100%", height: 36, border: "1px solid #e2e8f0", borderRadius: 8,
    padding: "0 10px", backgroundColor: "#fff", fontFamily: "inherit", fontSize: 13, color: "#374151",
  };
  const FIELD_ERR: React.CSSProperties = { ...FIELD, border: "1px solid #dc2626", backgroundColor: "#fef2f2" };
  const BTN = (bg = "#10b981", disabled = false): React.CSSProperties => ({
    height: 38, padding: "0 18px", border: `1px solid ${bg}`, background: bg,
    transition: "all 0.2s",
    color: "#fff", borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 14, opacity: disabled ? 0.6 : 1, fontFamily: "inherit", fontWeight: 600,
    display: "inline-flex", alignItems: "center", gap: 6,
  });
  const GHOST = (disabled = false, color = "#374151"): React.CSSProperties => ({
    height: 36, padding: "0 14px", border: "1px solid #e2e8f0", background: "#fff",
    color, borderRadius: 8, cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13, opacity: disabled ? 0.6 : 1, fontFamily: "inherit", fontWeight: 500,
    display: "inline-flex", alignItems: "center", gap: 6,
  });
  const BOX: React.CSSProperties = {
    background: "#fff", border: "1px solid #e2e8f0",
    borderRadius: 12, padding: 20,
  };
  const typeLabel: Record<GroupType, string> = { HOUSE: "House", CLUB: "Club", CUSTOM: "Custom" };

  const houses = rows.filter((r) => r.type === "HOUSE");
  const clubs = rows.filter((r) => r.type === "CLUB");

  // ── Accordion helper ──────────────────────────────────────────────────────────
  const renderAccordionBody = (group: StudentGroup) => {
    const groupStudentList = allStudents.filter((s) => s.currentGroupId === group.id);
    return (
      <div style={{ borderTop: "1px solid var(--border)" }}>
        {allStudentsLoading ? (
          <div style={{ padding: 24, textAlign: "center", fontSize: 13, color: "var(--light)" }}>Loading students…</div>
        ) : (
          CLASS_LIST.map((cls) => {
            const classStudents = groupStudentList.filter((s) => s.class === cls.name);
            const rowKey = `${group.id}-${cls.seq}`;
            const isClassOpen = expandedClassRows.has(rowKey);
            const sections = [...new Set(classStudents.map((s) => s.section))].sort();
            return (
              <div key={cls.seq}>
                <div
                  className="cls-row-hd"
                  style={{ opacity: classStudents.length === 0 ? 0.55 : 1, cursor: classStudents.length === 0 ? "default" : "pointer" }}
                  onClick={() => {
                    if (!classStudents.length) return;
                    setExpandedClassRows((prev) => { const n = new Set(prev); n.has(rowKey) ? n.delete(rowKey) : n.add(rowKey); return n; });
                  }}
                >
                  <span style={{ width: 22, fontSize: 10, fontWeight: 600, color: "var(--hint)", flexShrink: 0 }}>{cls.seq}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--dark)" }}>{cls.name}</span>
                  <span style={{ fontSize: 10, fontWeight: 600, background: "var(--blue-l)", color: "var(--blue)", padding: "2px 7px", borderRadius: 20 }}>{classStudents.length} students</span>
                  {sections.map((sec) => (
                    <span key={sec} style={{ fontSize: 10, background: "var(--bg)", border: "1px solid var(--border)", color: "var(--light)", padding: "2px 6px", borderRadius: 20 }}>Sec {sec}</span>
                  ))}
                  {classStudents.length === 0
                    ? <span style={{ marginLeft: "auto", fontSize: 10, color: "var(--hint)", fontStyle: "italic" }}>No students assigned</span>
                    : <>
                        <div style={{ marginLeft: "auto", width: 70, height: 4, background: "var(--bg)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, Math.round(classStudents.length / Math.max(classStudents.length, 1) * 100))}%`, height: "100%", background: group.color }} />
                        </div>
                        <span style={{ fontSize: 13, color: "var(--hint)", transform: isClassOpen ? "rotate(90deg)" : "rotate(0)", transition: "0.2s", display: "inline-block" }}>▶</span>
                      </>
                  }
                </div>
                {isClassOpen && classStudents.length > 0 && (
                  <div style={{ borderBottom: "1px solid var(--border)" }}>
                    <table className="sg-tbl">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>
                            <input type="checkbox" style={{ accentColor: "var(--teal)" }} onChange={(e) => {
                              const ids = classStudents.map((s) => s.id);
                              if (e.target.checked) setSelectedStudentIds((prev) => Array.from(new Set([...prev, ...ids])));
                              else setSelectedStudentIds((prev) => prev.filter((id) => !ids.includes(id)));
                            }} />
                          </th>
                          <th>Student</th>
                          <th>Adm No.</th>
                          <th>Sec</th>
                          <th>Assign Group</th>
                          <th>AI Hint</th>
                        </tr>
                      </thead>
                      <tbody>
                        {classStudents.map((s) => (
                          <tr key={s.id} className={selectedStudentIds.includes(s.id) ? "sg-row-sel" : ""}>
                            <td><input type="checkbox" style={{ accentColor: "var(--teal)" }} checked={selectedStudentIds.includes(s.id)} onChange={(e) => setSelectedStudentIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((x) => x !== s.id))} /></td>
                            <td>
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{ width: 26, height: 26, borderRadius: "50%", background: AVATAR_COLORS[s.id % AVATAR_COLORS.length], color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 9, fontWeight: 700, flexShrink: 0 }}>{getInitials(s.name)}</div>
                                <div>
                                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--dark)" }}>{s.name}</div>
                                  <div style={{ fontSize: 10.5, color: "var(--light)" }}>{s.admissionNo}</div>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontFamily: "var(--font2)", color: "var(--light)", fontSize: 11 }}>{s.admissionNo}</td>
                            <td><span style={{ background: "var(--blue-l)", color: "var(--blue)", fontSize: 10, fontWeight: 600, borderRadius: 20, padding: "2px 7px" }}>Sec {s.section}</span></td>
                            <td>
                              <select
                                className={`sg-assign-sel${s.currentGroupId ? " hv" : ""}`}
                                value={s.currentGroupId ?? ""}
                                disabled={savingAssignIds.has(s.id)}
                                onChange={(e) => void handleAssignStudent(s.id, e.target.value ? Number(e.target.value) : null)}
                              >
                                <option value="">— Unassigned</option>
                                <optgroup label="Houses">{houses.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}</optgroup>
                                <optgroup label="Clubs">{clubs.map((g) => <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>)}</optgroup>
                              </select>
                            </td>
                            <td><span style={{ fontSize: 10, color: "var(--hint)" }}>—</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    );
  };

  const renderBulkBar = () => selectedStudentIds.length > 0 ? (
    <div className="bulk-bar">
      <span style={{ background: "var(--teal-m)", color: "var(--teal)", border: "1px solid rgba(0,184,148,0.3)", borderRadius: 20, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{selectedStudentIds.length} selected</span>
      <span style={{ fontSize: 12, color: "var(--mid)" }}>→ Move to:</span>
      <select value={bulkTargetGroupId} onChange={(e) => setBulkTargetGroupId(e.target.value)} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 6, padding: "4px 8px", fontFamily: "var(--font)", fontSize: 11.5, minWidth: 150 }}>
        <option value="">Select group</option>
        <optgroup label="Houses">{houses.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</optgroup>
        <optgroup label="Clubs">{clubs.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</optgroup>
      </select>
      <button onClick={() => void submitBulkAssign()} style={{ background: "var(--teal)", color: "#fff", border: "none", padding: "4px 12px", borderRadius: 6, fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}>Apply</button>
      <button onClick={() => setSelectedStudentIds([])} style={{ background: "none", border: "1px solid var(--border)", borderRadius: 6, color: "var(--light)", padding: "4px 8px", fontSize: 11, cursor: "pointer" }}>Clear</button>
    </div>
  ) : null;

  // ──────────────────────────────────────────────────────────────────────────────
  return (
    <div className={`${studentThemeClassName} legacy-panel student-group-panel`}>
      <style>{`
        :root {
          --bg: #f0f2f8; --white: #ffffff; --border: #e2e6f0; --border2: #d0d8ec;
          --dark: #1a2744; --mid: #4a5a7a; --light: #8fa3c8; --hint: #b5c4d8;
          --teal: #00b894; --teal-l: #e6f9f5; --teal-m: rgba(0,184,148,0.13); --purple: #6c5ce7; --purple-l: #f0eeff;
          --orange: #e67e22; --orange-l: #fef3e8; --red: #e74c3c; --blue: #2980b9; --blue-l: #e8f4fd;
          --font: 'Outfit', sans-serif; --font2: 'Inter', sans-serif;
          --r: 10px; --rl: 14px; --sh: 0 1px 4px rgba(26,39,68,0.07); --shm: 0 4px 18px rgba(26,39,68,0.10);
        }
        .student-group-panel { font-family: var(--font); color: var(--dark); }
        .sg-tab { padding: 8px 16px; border: none; background: none; cursor: pointer; font-size: 13px; font-weight: 500; border-bottom: 2px solid transparent; color: var(--mid); transition: 0.2s; }
        .sg-tab.active { border-bottom-color: var(--teal); color: var(--teal); }
        .sf-bar { background: var(--white); border: 1px solid var(--border); border-radius: var(--rl); display: flex; height: 46px; align-items: center; box-shadow: var(--sh); position: relative; }
        .sf-item { height: 46px; border: none; border-right: 1px solid var(--border); background: none; padding: 0 14px; font-size: 12.5px; color: var(--mid); cursor: pointer; display: flex; align-items: center; gap: 6px; }
        .sf-item:hover { background: var(--bg); color: var(--dark); }
        .sf-item.active { color: var(--teal); background: var(--teal-l); font-weight: 600; }
        .sf-dropdown { position: absolute; top: calc(100% + 4px); left: 0; background: var(--white); border: 1px solid var(--border); border-radius: var(--r); box-shadow: var(--shm); z-index: 50; min-width: 200px; padding: 8px; }
        .bulk-bar { background: rgba(0,184,148,0.06); border-bottom: 1px solid rgba(0,184,148,0.2); padding: 8px 16px; display: flex; align-items: center; gap: 10px; animation: slideIn 0.2s ease; }
        .ai-banner { background: linear-gradient(135deg, rgba(108,92,231,0.07), rgba(0,184,148,0.04)); border-bottom: 1px solid rgba(108,92,231,0.18); padding: 10px 16px; display: flex; align-items: center; gap: 10px; }
        .hc { background: var(--white); border: 1px solid var(--border); border-radius: var(--rl); overflow: hidden; box-shadow: var(--sh); transition: 0.2s; }
        .hc:hover { transform: translateY(-2px); box-shadow: var(--shm); }
        .hc-top { padding: 14px 15px 11px; }
        .hc-bot { padding: 9px 15px 11px; border-top: 1px solid var(--border); background: #fafbfd; display: flex; justify-content: space-between; align-items: center; }
        .class-row-hd { display: flex; align-items: center; gap: 8px; padding: 8px 16px; background: #fafbfd; border-bottom: 1px solid var(--border); cursor: pointer; transition: 0.15s; }
        .class-row-hd:hover { background: var(--bg); }
        @keyframes slideIn { from { transform: translateY(-10px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
        .pulse-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--purple); animation: pulse 1.8s infinite; }
        .sg-tab:hover { color: var(--primary); }
        .sg-card { background: var(--surface); border: 1px solid var(--line); border-radius: 10px; overflow: hidden; transition: box-shadow 0.15s; }
        .sg-card:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); }
        .sg-accordion { border-top: 1px solid var(--line); padding: 12px; }
        .sg-student-row { display: flex; gap: 8px; align-items: center; padding: 6px 8px; border-radius: 6px; font-size: 13px; }
        .sg-student-row:hover { background: var(--surface-muted, #f8f9fa); }
        @media (max-width: 640px) {
          .sg-cards-grid { grid-template-columns: 1fr !important; }
          .sg-form-grid { grid-template-columns: 1fr !important; }
        }
        /* New classes */
        .sg-acc { background: var(--white); border: 1px solid var(--border); border-radius: var(--rl); overflow: hidden; box-shadow: var(--sh); }
        .acc-hd { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; background: var(--white); transition: background 0.15s; user-select: none; }
        .acc-hd:hover { background: var(--bg); }
        .cls-row-hd { display: flex; align-items: center; gap: 8px; padding: 9px 16px; background: #fafbfd; border-bottom: 1px solid var(--border); cursor: pointer; transition: 0.15s; }
        .cls-row-hd:hover { background: var(--bg); }
        .sg-tbl { width: 100%; border-collapse: collapse; font-family: var(--font); }
        .sg-tbl th { text-align: left; font-size: 10px; text-transform: uppercase; color: var(--light); padding: 7px 14px; font-weight: 600; letter-spacing: 0.04em; background: #f6f8fb; border-bottom: 1px solid var(--border); }
        .sg-tbl td { padding: 8px 14px; border-bottom: 1px solid var(--border); font-size: 13px; }
        .sg-tbl tbody tr:hover { background: rgba(0,184,148,0.03); }
        .sg-row-sel { background: rgba(0,184,148,0.06) !important; }
        .sg-assign-sel { border: 1px solid var(--border); borderRadius: 6px; padding: 4px 8px; font-size: 12px; font-family: var(--font); color: var(--mid); background: var(--white); cursor: pointer; outline: none; }
        .sg-assign-sel.hv { border-color: var(--teal); color: var(--teal); background: var(--teal-l); }
        .sg-add-club-btn { background: none; border: 1px dashed var(--border2); color: var(--light); border-radius: 6px; padding: 3px 10px; font-size: 12px; font-family: var(--font); cursor: pointer; white-space: nowrap; }
        .sg-add-club-btn:hover { border-color: var(--teal); color: var(--teal); }
        .sw-pill { background: var(--bg); border: 1px solid var(--border); color: var(--mid); border-radius: 20px; padding: 5px 12px; font-size: 12px; font-family: var(--font); font-weight: 500; cursor: pointer; transition: 0.15s; }
        .sw-pill:hover { border-color: var(--purple); color: var(--purple); }
        .sw-pill.active { background: var(--purple-l); border-color: var(--purple); color: var(--purple); font-weight: 700; }
      `}</style>

      {/* ── Fixed Toast ──────────────────────────────────────────────── */}
      {toast && (
        <div style={{
          position: "fixed", bottom: 24, right: 24, zIndex: 2000,
          padding: "12px 18px", borderRadius: 10, fontSize: 13, fontWeight: 600,
          background: toast.type === "success" ? "#ecfdf5" : "#fef2f2",
          border: `1px solid ${toast.type === "success" ? "#a7f3d0" : "#fecaca"}`,
          color: toast.type === "success" ? "#059669" : "#dc2626",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: 240,
        }}>{toast.message}</div>
      )}

      {/* ── Page Header ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--teal)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 4 }}>Student Information</div>
          <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: "var(--dark)", lineHeight: 1.2 }}>Student Group</h1>
          <div style={{ fontSize: 13, color: "var(--light)", marginTop: 4 }}>Manage students across houses &amp; clubs — assign in bulk, class by class</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {(stats?.houseCount ?? 0) > 0 && (
            <button onClick={() => void openSortwell()} style={{
              display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 18px",
              background: "var(--white)", border: "1.5px solid var(--border2)", borderRadius: 10,
              color: "var(--mid)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)",
            }}>⊕ Sortwell +</button>
          )}
          <button onClick={() => { resetForm(); setShowForm(true); }} style={{
            display: "flex", alignItems: "center", gap: 7, height: 40, padding: "0 18px",
            background: "var(--teal)", border: "none", borderRadius: 10,
            color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)",
          }}>+ Add Group</button>
        </div>
      </div>

      {/* ── Stats Strip ──────────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 12, marginBottom: 18 }}>
        {[
          { label: "Total Students", value: stats?.totalStudents ?? 0, icon: "👤", color: "#1a2744", bg: "#f0f2f8" },
          { label: "Assigned", value: stats?.assigned ?? 0, icon: "✅", color: "#00b894", bg: "#e6f9f5" },
          { label: "Unassigned", value: stats?.unassigned ?? 0, icon: "⏳", color: "#e67e22", bg: "#fef3e8" },
          { label: "Houses", value: stats?.houseCount ?? 0, icon: "🏛", color: "#1a2744", bg: "#f0f2f8" },
          { label: "Clubs", value: stats?.clubCount ?? 0, icon: "🎨", color: "#2980b9", bg: "#e8f4fd" },
        ].map((s) => (
          <div key={s.label} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px", display: "flex", alignItems: "center", gap: 14, boxShadow: "var(--sh)" }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: s.bg, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, flexShrink: 0 }}>{s.icon}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 700, color: s.color, lineHeight: 1 }}>{loading ? "—" : s.value}</div>
              <div style={{ fontSize: 12, color: "var(--light)", marginTop: 3 }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Filter Bar ───────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", gap: 2, background: "var(--white)", border: "1px solid var(--border)", borderRadius: 12, padding: "0 4px", marginBottom: 18, flexWrap: "wrap", position: "relative", boxShadow: "var(--sh)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderRight: "1px solid var(--border)", fontSize: 13, color: "var(--mid)", fontWeight: 600 }}>
          <span>⊻</span> Filter
        </div>
        {[
          { key: "class", label: "Class", active: filterClass.length > 0, count: filterClass.length },
          { key: "section", label: "Section", active: filterSection.length > 0, count: filterSection.length },
          { key: "house", label: "House", active: filterHouse.length > 0, count: filterHouse.length, skip: houses.length === 0 },
          { key: "club", label: "Club", active: filterClub.length > 0, count: filterClub.length, skip: clubs.length === 0 },
          { key: "status", label: filterStatus !== "all" ? filterStatus.charAt(0).toUpperCase() + filterStatus.slice(1) : "Status", active: filterStatus !== "all", count: 0 },
        ].filter(f => !(f as any).skip).map((f) => (
          <button key={f.key} className={`sf-item${f.active ? " active" : ""}`} onClick={() => setActiveDropdown(activeDropdown === f.key ? null : f.key)}>
            {f.label} {f.active && f.count > 0 && <span style={{ background: "var(--teal)", color: "#fff", borderRadius: 10, padding: "1px 6px", fontSize: 10, marginLeft: 2 }}>{f.count}</span>} <ChevronDown size={12} />
            {activeDropdown === f.key && (
              <div className="sf-dropdown" onClick={(e) => e.stopPropagation()}>
                {f.key === "class" && CLASS_LIST.map(c => (
                  <label key={c.seq} style={{ display: "flex", gap: 8, padding: "6px 8px", cursor: "pointer", alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={filterClass.includes(c.name)} onChange={(e) => setFilterClass(p => e.target.checked ? [...p, c.name] : p.filter(x => x !== c.name))} style={{ accentColor: "var(--teal)" }} /> {c.name}
                  </label>
                ))}
                {f.key === "section" && ["A","B","C","D","E"].map(s => (
                  <label key={s} style={{ display: "flex", gap: 8, padding: "6px 8px", cursor: "pointer", alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={filterSection.includes(s)} onChange={(e) => setFilterSection(p => e.target.checked ? [...p, s] : p.filter(x => x !== s))} style={{ accentColor: "var(--teal)" }} /> Section {s}
                  </label>
                ))}
                {f.key === "house" && houses.map(h => (
                  <label key={h.id} style={{ display: "flex", gap: 8, padding: "6px 8px", cursor: "pointer", alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={filterHouse.includes(h.name)} onChange={(e) => setFilterHouse(p => e.target.checked ? [...p, h.name] : p.filter(x => x !== h.name))} style={{ accentColor: "var(--teal)" }} /> {h.emoji} {h.name}
                  </label>
                ))}
                {f.key === "club" && clubs.map(c => (
                  <label key={c.id} style={{ display: "flex", gap: 8, padding: "6px 8px", cursor: "pointer", alignItems: "center", fontSize: 13 }}>
                    <input type="checkbox" checked={filterClub.includes(c.name)} onChange={(e) => setFilterClub(p => e.target.checked ? [...p, c.name] : p.filter(x => x !== c.name))} style={{ accentColor: "var(--teal)" }} /> {c.emoji} {c.name}
                  </label>
                ))}
                {f.key === "status" && ["all","assigned","unassigned"].map(s => (
                  <div key={s} style={{ padding: "8px 10px", cursor: "pointer", fontSize: 13, textTransform: "capitalize", fontWeight: filterStatus === s ? 600 : 400, color: filterStatus === s ? "var(--teal)" : "var(--mid)" }} onClick={() => { setFilterStatus(s as typeof filterStatus); setActiveDropdown(null); }}>{s}</div>
                ))}
              </div>
            )}
          </button>
        ))}
        {(filterClass.length > 0 || filterSection.length > 0 || filterHouse.length > 0 || filterClub.length > 0 || filterStatus !== "all") && (
          <button onClick={clearFilters} style={{ marginLeft: "auto", border: "none", background: "none", color: "var(--red)", fontSize: 12, cursor: "pointer", padding: "0 12px" }}>✕ Clear</button>
        )}
      </div>

      {/* ── Quick Setup ───────────────────────────────────────────────── */}
      {rows.length === 0 && !loading && (
        <div style={{ textAlign: "center", padding: "48px 20px", background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, marginBottom: 18 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 6 }}>No groups yet</div>
          <div style={{ fontSize: 13, color: "var(--light)", marginBottom: 16 }}>Default groups are added automatically. You can create your own groups too.</div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
            <button onClick={() => { resetForm(); setShowForm(true); }} style={{ background: "var(--teal)", border: "none", color: "#fff", borderRadius: 10, padding: "10px 20px", fontSize: 13, fontWeight: 700, cursor: "pointer" }}>+ Add Group</button>
          </div>
        </div>
      )}

      {/* ── Edit/Create Form Modal ────────────────────────────────────── */}
      {showForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(26,39,68,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 16, padding: 28, maxWidth: 520, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.18)", maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--dark)" }}>{editingId ? "✏️ Edit Group" : "➕ New Group"}</h3>
              <button onClick={resetForm} style={{ background: "none", border: "none", fontSize: 20, color: "var(--light)", cursor: "pointer" }}>✕</button>
            </div>
            <form onSubmit={(e) => void submit(e)} style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--mid)" }}>Group Name *</label>
                  <input value={name} onChange={(e) => { setName(e.target.value); clearFieldError("name"); }} placeholder="e.g. Tagore House, Science Club" style={fieldErrors.name ? FIELD_ERR : FIELD} disabled={saving} />
                  {fieldErrors.name && <p style={{ color: "var(--red)", fontSize: 11, margin: "3px 0 0" }}>{fieldErrors.name}</p>}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--mid)" }}>Type</label>
                  <select value={groupType} onChange={(e) => { const t = e.target.value as GroupType; setGroupType(t); setEmoji(TYPE_PRESETS[t].emoji); setColor(TYPE_PRESETS[t].color); setBgColor(TYPE_PRESETS[t].bg_color); }} style={FIELD} disabled={saving}>
                    <option value="HOUSE">🏠 House</option>
                    <option value="CLUB">⭐ Club</option>
                    <option value="CUSTOM">📚 Custom</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--mid)" }}>Emoji</label>
                  <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={2} style={{ ...FIELD, fontSize: 18, textAlign: "center" }} disabled={saving} />
                </div>
                <div style={{ gridColumn: "1/-1" }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--mid)" }}>Description</label>
                  <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" style={FIELD} disabled={saving} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--mid)" }}>Capacity</label>
                  <input type="number" min={1} max={9999} value={capacity} onChange={(e) => setCapacity(Number(e.target.value))} style={fieldErrors.capacity ? FIELD_ERR : FIELD} disabled={saving} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, paddingTop: 20 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "5px 12px", background: bgColor, border: `2px solid ${color}`, borderRadius: 20, fontSize: 13, fontWeight: 600, color }}>{emoji} {sanitize(name) || "Preview"}</span>
                </div>
              </div>
              {error && <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: 10, color: "#dc2626", fontSize: 13 }}>{error}</div>}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" onClick={resetForm} disabled={saving} style={GHOST(saving)}>Cancel</button>
                <button type="submit" disabled={saving} style={BTN("var(--teal)" as string, saving)}>{saving ? "Saving…" : editingId ? "Update Group" : "Save Group"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── School Houses Card Section ────────────────────────────────── */}
      {(houses.length > 0 || loading) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--teal)", display: "inline-block" }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--dark)" }}>School Houses</span>
            </div>
            <span style={{ fontSize: 12, color: "var(--light)", fontWeight: 500 }}>{houses.length} Houses</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {houses.map((h) => {
              const cnt = h.students_count ?? 0;
              const pct = Math.min(100, Math.round((cnt / h.capacity) * 100));
              return (
                <div key={h.id} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh)", transition: "0.2s" }} className="sg-hcard">
                  <div style={{ height: 5, background: h.color }} />
                  <div style={{ padding: "16px 16px 12px" }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: h.bg_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 10 }}>{h.emoji}</div>
                    <div style={{ fontSize: 17, fontWeight: 700, color: "var(--dark)", marginBottom: 3 }}>{h.name}</div>
                    {h.description && <div style={{ fontSize: 12, color: "var(--light)", fontStyle: "italic", marginBottom: 10 }}>{h.description}</div>}
                    <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginBottom: 6 }}>
                      <span style={{ fontSize: 26, fontWeight: 700, color: h.color }}>{cnt}</span>
                      <span style={{ fontSize: 12, color: "var(--mid)" }}>students</span>
                      <span style={{ fontSize: 11, color: "var(--hint)" }}>of {h.capacity}</span>
                    </div>
                    <div style={{ marginBottom: 4 }}>
                      <div style={{ height: 5, background: "var(--bg)", borderRadius: 3, overflow: "hidden", marginBottom: 3 }}>
                        <div style={{ width: `${pct}%`, height: "100%", background: h.color, borderRadius: 3 }} />
                      </div>
                      <div style={{ textAlign: "right", fontSize: 11, color: "var(--hint)" }}>{pct}%</div>
                    </div>
                  </div>
                  <div style={{ padding: "8px 16px 12px", borderTop: "1px solid var(--border)", background: "#fafbfd", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 12, color: "var(--light)" }}>{cnt} students assigned</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => onEdit(h)} style={{ background: "none", border: "none", color: "var(--teal)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Edit</button>
                      <button onClick={() => setDeleteConfirm(h)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── School Clubs Card Section ─────────────────────────────────── */}
      {(clubs.length > 0 || true) && (
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--teal)", display: "inline-block" }} />
              <span style={{ fontSize: 16, fontWeight: 700, color: "var(--dark)" }}>School Clubs</span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 12, color: "var(--light)", fontWeight: 500 }}>{clubs.length} Clubs</span>
              <button onClick={() => setShowClubForm(true)} style={{ background: "var(--teal)", border: "none", color: "#fff", borderRadius: 8, padding: "5px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>+ Add Club</button>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
            {clubs.map((c) => {
              const cnt = c.students_count ?? 0;
              return (
                <div key={c.id} style={{ background: "var(--white)", border: "1px solid var(--border)", borderRadius: 14, overflow: "hidden", boxShadow: "var(--sh)", transition: "0.2s", padding: "16px" }} className="sg-hcard">
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 12, background: c.bg_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, flexShrink: 0 }}>{c.emoji}</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--dark)" }}>{c.name}</div>
                      <span style={{ fontSize: 10, fontWeight: 700, background: c.bg_color, color: c.color, border: `1px solid ${c.color}33`, borderRadius: 20, padding: "1px 8px" }}>CLUB</span>
                    </div>
                  </div>
                  {c.description && <div style={{ fontSize: 12, color: "var(--light)", fontStyle: "italic", marginBottom: 10 }}>{c.description}</div>}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--dark)" }}>{cnt} / {c.capacity}</span>
                    <div style={{ display: "flex", gap: 8 }}>
                      <button onClick={() => onEdit(c)} style={{ background: "none", border: "1px solid var(--border)", color: "var(--mid)", fontSize: 12, fontWeight: 600, cursor: "pointer", borderRadius: 6, padding: "3px 10px" }}>Edit</button>
                      <button onClick={() => setDeleteConfirm(c)} style={{ background: "none", border: "none", color: "var(--red)", fontSize: 12, cursor: "pointer" }}>Delete</button>
                    </div>
                  </div>
                </div>
              );
            })}
            {/* Ghost add card */}
            <div onClick={() => setShowClubForm(true)} style={{ background: "none", border: "2px dashed var(--border)", borderRadius: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, minHeight: 140, cursor: "pointer", color: "var(--hint)", transition: "0.15s" }} className="sg-ghost-card">
              <div style={{ width: 36, height: 36, borderRadius: "50%", border: "2px dashed var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20 }}>+</div>
              <span style={{ fontSize: 13 }}>New Club</span>
            </div>
          </div>
        </div>
      )}


      {/* ── House & Club Accordion Sections ────────────────────────────── */}
      <section style={{ padding: "0 0 24px" }}>
        <div style={{ display: "grid", gap: 14 }}>
          {/* ── Dedicated House Accordion Section ─────────────────────── */}
          {houses.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mid)", whiteSpace: "nowrap", padding: "0 8px" }}>🏠 Houses — Student Roster</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
              </div>
              {houses.map((group, idx) => {
                const isOpen = expandedGroups.has(group.id);
                const groupStudentCount = allStudents.filter(s => s.currentGroupId === group.id).length;
                return (
                  <div key={group.id} className="sg-acc" style={{ marginBottom: 8 }}>
                    {idx === 0 && (stats?.unassigned ?? 0) > 0 && !aiBannerDismissed && (
                      <div className="ai-banner">
                        <span style={{ color: "var(--purple)" }}>✦</span>
                        <div style={{ fontSize: 12, flex: 1 }}><strong>AI suggestion —</strong> {stats?.unassigned} unassigned students detected. Use Sortwell to auto-balance across houses.</div>
                        <button onClick={() => void openSortwell()} style={{ background: "var(--purple)", color: "#fff", border: "none", padding: "4px 10px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>Sortwell</button>
                        <button onClick={() => setAiBannerDismissed(true)} style={{ background: "none", border: "none", color: "var(--light)", cursor: "pointer", fontSize: 16 }}>✕</button>
                      </div>
                    )}
                    <div className="acc-hd" onClick={() => toggleAccordion(group.id)} style={{ borderLeft: `4px solid ${group.color}` }}>
                      <span style={{ fontSize: 22 }}>{group.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)" }}>{group.name}</div>
                        {group.description && <div style={{ fontSize: 11, color: "var(--light)", marginTop: 1 }}>{group.description}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: group.color }}>{groupStudentCount}</div>
                          <div style={{ fontSize: 10, color: "var(--light)" }}>/ {group.capacity}</div>
                        </div>
                        <div style={{ width: 60, height: 4, background: "var(--bg)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, Math.round(groupStudentCount / group.capacity * 100))}%`, height: "100%", background: group.color }} />
                        </div>
                        <span style={{ fontSize: 13, color: "var(--hint)", transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "0.2s", display: "inline-block" }}>▶</span>
                      </div>
                    </div>
                    {isOpen && <div>{renderBulkBar()}{renderAccordionBody(group)}</div>}
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Dedicated Club Accordion Section ──────────────────────── */}
          {clubs.length > 0 && (
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "var(--mid)", whiteSpace: "nowrap", padding: "0 8px" }}>⭐ Clubs — Student Roster</span>
                <div style={{ flex: 1, height: 1, background: "var(--border)" }} />
                <button className="sg-add-club-btn" onClick={() => setShowClubForm(true)}>+ Add Club</button>
              </div>
              {clubs.map((group) => {
                const isOpen = expandedGroups.has(group.id);
                const groupStudentCount = allStudents.filter(s => s.currentGroupId === group.id).length;
                return (
                  <div key={group.id} className="sg-acc" style={{ marginBottom: 8 }}>
                    <div className="acc-hd" onClick={() => toggleAccordion(group.id)} style={{ borderLeft: `4px solid ${group.color}` }}>
                      <span style={{ fontSize: 22 }}>{group.emoji}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--dark)" }}>{group.name}</div>
                        {group.description && <div style={{ fontSize: 11, color: "var(--light)", marginTop: 1 }}>{group.description}</div>}
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: 18, fontWeight: 700, color: group.color }}>{groupStudentCount}</div>
                          <div style={{ fontSize: 10, color: "var(--light)" }}>/ {group.capacity}</div>
                        </div>
                        <div style={{ width: 60, height: 4, background: "var(--bg)", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ width: `${Math.min(100, Math.round(groupStudentCount / group.capacity * 100))}%`, height: "100%", background: group.color }} />
                        </div>
                        <span style={{ fontSize: 13, color: "var(--hint)", transform: isOpen ? "rotate(90deg)" : "rotate(0)", transition: "0.2s", display: "inline-block" }}>▶</span>
                      </div>
                    </div>
                    {isOpen && <div>{renderBulkBar()}{renderAccordionBody(group)}</div>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* ── Delete Modal ───────────────────────────────────────────────── */}
      {deleteConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 420, width: "90%", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 10px", fontSize: 17, fontWeight: 600 }}>⚠️ Delete Group</h3>
            <p style={{ margin: "0 0 18px", color: "var(--text-muted)", lineHeight: 1.6 }}>
              Are you sure you want to delete <strong>&quot;{deleteConfirm.name}&quot;</strong>?
              {(deleteConfirm.students_count ?? 0) > 0 && (
                <span style={{ display: "block", marginTop: 8, color: "#dc2626", fontSize: 12 }}>
                  {deleteConfirm.students_count} student{deleteConfirm.students_count !== 1 ? "s" : ""} will be unassigned.
                </span>
              )}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDeleteConfirm(null)} disabled={deleting} style={GHOST(deleting)}>Cancel</button>
              <button onClick={() => void confirmDelete()} disabled={deleting} style={BTN("#dc2626", deleting)}>
                {deleting ? "Deleting..." : "🗑 Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Assign Students Modal ──────────────────────────────────────── */}
      {assignGroup && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 20, maxWidth: 640, width: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
              <span style={{ fontSize: 28 }}>{assignGroup.emoji}</span>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>Assign Students to {assignGroup.name}</h3>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{typeLabel[assignGroup.type]} · {assignGroup.students_count ?? 0} / {assignGroup.capacity} students</span>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
              <select value={assignClassId} onChange={(e) => { setAssignClassId(e.target.value); setAssignSectionId(""); void loadAssignableStudents(e.target.value, ""); }} style={FIELD}>
                <option value="">All classes</option>
                {assignClasses.map((c) => <option key={c.id} value={c.id}>{c.class_name || c.name || `Class ${c.id}`}</option>)}
              </select>
              <select value={assignSectionId} onChange={(e) => { setAssignSectionId(e.target.value); void loadAssignableStudents(assignClassId, e.target.value); }} style={FIELD} disabled={!assignClassId}>
                <option value="">{assignClassId ? "All sections" : "Select class first"}</option>
                {filteredSectionsByClass.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <input value={assignSearch} onChange={(e) => setAssignSearch(e.target.value)} placeholder="Search by name or admission no..." style={{ ...FIELD, marginBottom: 10 }} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8, fontSize: 13, color: "var(--text-muted)" }}>
              <input type="checkbox" checked={allVisibleSelected} onChange={(e) => toggleSelectAllVisible(e.target.checked)} disabled={assignLoading || visibleAssignableIds.length === 0} />
              Select all visible ({visibleAssignableIds.length})
            </label>
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, maxHeight: 260, overflowY: "auto", padding: 8 }}>
              {assignLoading ? (
                <p style={{ margin: 0, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>Loading students...</p>
              ) : filteredAssignableStudents.length === 0 ? (
                <p style={{ margin: 0, color: "var(--text-muted)", textAlign: "center", padding: 16 }}>No students available.</p>
              ) : filteredAssignableStudents.map((s) => {
                const label = `${s.first_name || ""} ${s.last_name || ""}`.trim() || s.admission_no || "Student";
                return (
                  <label key={s.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 4px", cursor: "pointer" }}>
                    <input type="checkbox" checked={selectedStudentIds.includes(s.id)} onChange={(e) => {
                      setSelectedStudentIds((prev) => e.target.checked ? [...prev, s.id] : prev.filter((id) => id !== s.id));
                    }} />
                    <span style={{ fontSize: 13 }}>{label}</span>
                    <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: "auto" }}>({s.admission_no || "N/A"})</span>
                  </label>
                );
              })}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 12, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{selectedStudentIds.length} selected</span>
              <div style={{ display: "flex", gap: 8 }}>
                <button style={GHOST(assigning)} disabled={assigning} onClick={() => { setAssignGroup(null); setSelectedStudentIds([]); }}>Cancel</button>
                <button style={BTN("#1d4ed8", assigning || selectedStudentIds.length === 0)} disabled={assigning || selectedStudentIds.length === 0} onClick={() => void submitAssignStudents()}>
                  {assigning ? "Assigning..." : "Assign Selected"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Sortwell Modal ─────────────────────────────────────────────── */}
      {sortwellOpen && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 24, maxWidth: 540, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.15)" }}>
            <h3 style={{ margin: "0 0 6px", fontSize: 17, fontWeight: 600 }}>🔀 Sortwell — Auto-distribute to Houses</h3>
            <p style={{ margin: "0 0 18px", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
              Automatically distributes students evenly across all house-type groups.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 6, fontWeight: 500 }}>Distribution Method</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {([
                    { value: "random", label: "🎲 Random" },
                    { value: "alpha", label: "🔤 Alphabetical" },
                    { value: "classwise", label: "🏫 Class-wise" },
                    { value: "gender", label: "⚖️ Gender Balance" },
                  ] as const).map((opt) => (
                    <button key={opt.value} className={`sw-pill${sortwellMethod === opt.value ? " active" : ""}`} onClick={() => setSortwellMethod(opt.value)}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, marginBottom: 6, fontWeight: 500 }}>Scope</label>
                <div style={{ display: "flex", gap: 6 }}>
                  {([
                    { value: "unassigned", label: "Unassigned only" },
                    { value: "all", label: "All students" },
                  ] as const).map((opt) => (
                    <button key={opt.value} className={`sw-pill${sortwellScope === opt.value ? " active" : ""}`} onClick={() => { setSortwellScope(opt.value); void fetchSortwellPreview(opt.value); }}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Preview */}
            <div style={{ background: "#f8f9fa", borderRadius: 10, padding: 14, marginBottom: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 10 }}>
                Preview — {sortwellTotal} student{sortwellTotal !== 1 ? "s" : ""} to distribute
              </div>
              {sortwellPreviewLoading ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading preview...</div>
              ) : sortwellPreview.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>No house groups found.</div>
              ) : (
                <div style={{ display: "grid", gap: 8 }}>
                  {sortwellPreview.map((h) => (
                    <div key={h.groupId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 20 }}>{h.emoji}</span>
                      <span style={{ flex: 1, fontWeight: 500, fontSize: 13 }}>{h.groupName}</span>
                      <span style={{
                        padding: "2px 10px", borderRadius: 12, fontSize: 12, fontWeight: 700,
                        background: h.bgColor || "#f0f0f0", color: h.color || "#333",
                      }}>
                        +{h.count}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {sortwellScope === "all" && (
              <div style={{ background: "#fff3cd", border: "1px solid #ffc107", borderRadius: 8, padding: 10, marginBottom: 14, fontSize: 13, color: "#856404" }}>
                ⚠️ <strong>Warning:</strong> This will clear all existing house assignments and redistribute everyone.
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={GHOST(sortwellRunning)} disabled={sortwellRunning} onClick={() => setSortwellOpen(false)}>Cancel</button>
              <button
                style={BTN("#6c5ce7", sortwellRunning || sortwellPreview.length === 0 || sortwellTotal === 0)}
                disabled={sortwellRunning || sortwellPreview.length === 0 || sortwellTotal === 0}
                onClick={() => void runSortwell()}
              >
                {sortwellRunning ? "Distributing..." : "🔀 Run Sortwell"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add Club Modal ─────────────────────────────────────────────── */}
      {showClubForm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, maxWidth: 420, width: "100%", boxShadow: "0 10px 40px rgba(0,0,0,0.18)" }}>
            <h3 style={{ margin: "0 0 18px", fontSize: 17, fontWeight: 700, color: "var(--dark)" }}>⭐ New Club</h3>
            <div style={{ display: "grid", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--mid)" }}>Club Name <span style={{ color: "var(--red)" }}>*</span></label>
                <input value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder="e.g. Science Club" style={{ ...FIELD, borderColor: clubName ? "var(--border)" : undefined }} disabled={savingClub} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--mid)" }}>Emoji</label>
                  <input value={clubEmoji} onChange={(e) => setClubEmoji(e.target.value)} placeholder="⭐" maxLength={2} style={{ ...FIELD, fontSize: 18, textAlign: "center" }} disabled={savingClub} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--mid)" }}>Capacity</label>
                  <input type="number" min={1} max={1000} value={clubCapacity} onChange={(e) => setClubCapacity(Number(e.target.value))} style={FIELD} disabled={savingClub} />
                </div>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4, color: "var(--mid)" }}>Description</label>
                <textarea value={clubDescription} onChange={(e) => setClubDescription(e.target.value)} placeholder="Optional description..." rows={2} style={{ ...FIELD, height: "auto", padding: "8px 10px", resize: "vertical" }} disabled={savingClub} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
              <button onClick={() => setShowClubForm(false)} disabled={savingClub} style={GHOST(savingClub)}>Cancel</button>
              <button onClick={() => void submitCreateClub()} disabled={savingClub || !clubName.trim()} style={BTN("var(--teal)" as string, savingClub || !clubName.trim())}>
                {savingClub ? "Creating..." : "✓ Create Club"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
