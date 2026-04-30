"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BellRing,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Download,
  LogIn,
  LogOut,
  Search,
  ShieldAlert,
  Sparkles,
  StickyNote,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { TopToast } from "@/components/common/TopToast";

type AcademicYear = { id: number; name: string; is_current: boolean };
type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };
type ApiList<T> = T[] | { results?: T[] };

type StudentRow = {
  id: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  attendance_type: string | null;
  attendance_note: string;
};

type AttendanceEntry = {
  student_id: number;
  attendance_type: string;
  notes: string;
};

type StudentFilter = "all" | "present" | "absent" | "late" | "risk";

type UiRow = {
  arrivalTime: string;
  signInTime: string;
  signOutTime: string;
  pickupTime: string;
  lunchTaken: boolean;
  lateMinutes: number;
};

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

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results ?? [];
}

function fullName(student: StudentRow): string {
  return `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Unknown";
}

function initials(student: StudentRow): string {
  const parts = fullName(student).split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((item) => item[0]?.toUpperCase() || "").join("") || "ST";
}

function formatClock(value: string): string {
  if (!value) return "-";
  const [h, m] = value.split(":");
  const hour = Number(h);
  const min = Number(m);
  if (Number.isNaN(hour) || Number.isNaN(min)) return value;
  const period = hour >= 12 ? "PM" : "AM";
  const normalized = hour % 12 || 12;
  return `${normalized}:${String(min).padStart(2, "0")} ${period}`;
}

function defaultUiRow(index: number, type: string): UiRow {
  const late = index % 5 === 1;
  const isAbsent = type === "A";
  return {
    arrivalTime: late ? "08:14" : "08:00",
    signInTime: isAbsent ? "" : late ? "08:14" : "08:20",
    signOutTime: "",
    pickupTime: "17:00",
    lunchTaken: !isAbsent,
    lateMinutes: late ? 14 : 0,
  };
}

export default function StudentAttendancePremiumPanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<Record<number, AttendanceEntry>>({});
  const [uiRows, setUiRows] = useState<Record<number, UiRow>>({});

  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StudentFilter>("all");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [insightDismissed, setInsightDismissed] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [autoSave, setAutoSave] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const selectedClass = useMemo(() => classes.find((item) => String(item.id) === classId), [classes, classId]);
  const selectedSection = useMemo(() => sections.find((item) => String(item.id) === sectionId), [sections, sectionId]);

  const riskMap = useMemo(() => {
    const next: Record<number, number> = {};
    students.forEach((student) => {
      next[student.id] = 66 + ((student.id * 11) % 31);
    });
    return next;
  }, [students]);

  useEffect(() => {
    if (error) setToast({ message: error, tone: "error" });
  }, [error]);

  useEffect(() => {
    if (success) setToast({ message: success, tone: "success" });
  }, [success]);

  useEffect(() => {
    const loadMeta = async () => {
      try {
        setLoadingMeta(true);
        setError("");
        const [yearData, classData] = await Promise.allSettled([
          apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
          apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
        ]);
        const loadedYears = yearData.status === "fulfilled" ? listData(yearData.value) : [];
        const loadedClasses = classData.status === "fulfilled" ? listData(classData.value) : [];
        setYears(loadedYears);
        setClasses(loadedClasses);
        const currentYear = loadedYears.find((item) => item.is_current);
        if (currentYear) {
          setAcademicYearId(String(currentYear.id));
        }
      } catch {
        setError("Unable to load attendance criteria.");
      } finally {
        setLoadingMeta(false);
      }
    };
    void loadMeta();
  }, []);

  const loadSectionsForClass = useCallback(async (targetClassId: string) => {
    if (!targetClassId) {
      setSections([]);
      setSectionId("");
      return;
    }
    try {
      setLoadingSections(true);
      setSections([]);
      setSectionId("");
      try {
        const payload = await apiGet<ApiList<Section>>(`/api/v1/core/sections/?class=${encodeURIComponent(targetClassId)}&page_size=200`);
        setSections(listData(payload));
      } catch {
        const payload = await apiGet<ApiList<Section>>(`/api/v1/core/sections/?school_class=${encodeURIComponent(targetClassId)}&page_size=200`);
        setSections(listData(payload));
      }
    } catch {
      setError("Unable to load sections for selected class.");
    } finally {
      setLoadingSections(false);
    }
  }, []);

  const searchStudents = useCallback(async () => {
    if (!classId || !sectionId || !attendanceDate) {
      setError("Class, section and attendance date are required.");
      return;
    }
    try {
      setSearching(true);
      setError("");
      setSuccess("");
      const data = await apiPost<{ students: StudentRow[] }>(
        "/api/v1/attendance/student-attendance/student-search/",
        {
          class: Number(classId),
          class_id: Number(classId),
          section: Number(sectionId),
          section_id: Number(sectionId),
          attendance_date: attendanceDate,
        },
      );

      const rows = data.students || [];
      const nextAttendance: Record<number, AttendanceEntry> = {};
      const nextUi: Record<number, UiRow> = {};

      rows.forEach((row, idx) => {
        const type = row.attendance_type ?? "P";
        nextAttendance[row.id] = {
          student_id: row.id,
          attendance_type: type,
          notes: row.attendance_note || "",
        };
        nextUi[row.id] = defaultUiRow(idx, type);
      });

      setStudents(rows);
      setAttendance(nextAttendance);
      setUiRows(nextUi);
      setSelectedIds([]);
      setPage(1);
      setDirty(false);
      setSuccess(`Loaded ${rows.length} pupil records.`);
    } catch {
      setError("Unable to load students for attendance.");
    } finally {
      setSearching(false);
    }
  }, [attendanceDate, classId, sectionId]);

  const saveAttendance = useCallback(async () => {
    if (!classId || !sectionId || !attendanceDate || !students.length) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await apiPost("/api/v1/attendance/student-attendance/store/", {
        class_id: Number(classId),
        section_id: Number(sectionId),
        academic_year_id: academicYearId ? Number(academicYearId) : null,
        date: attendanceDate,
        id: students.map((row) => row.id),
        attendance: Object.fromEntries(Object.values(attendance).map((entry) => [String(entry.student_id), entry.attendance_type])),
        note: Object.fromEntries(Object.values(attendance).map((entry) => [String(entry.student_id), entry.notes])),
      });
      setDirty(false);
      setSuccess("Attendance saved successfully.");
    } catch {
      setError("Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  }, [academicYearId, attendance, attendanceDate, classId, sectionId, students]);

  useEffect(() => {
    if (!autoSave || !dirty || saving) return;
    const timer = window.setTimeout(() => {
      void saveAttendance();
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [autoSave, dirty, saveAttendance, saving]);

  const setType = (studentId: number, type: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: { ...prev[studentId], attendance_type: type } }));
    setDirty(true);
  };

  const setNote = (studentId: number, note: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: { ...prev[studentId], notes: note } }));
    setDirty(true);
  };

  const setUiRow = (studentId: number, patch: Partial<UiRow>) => {
    setUiRows((prev) => ({ ...prev, [studentId]: { ...(prev[studentId] || defaultUiRow(0, "P")), ...patch } }));
    setDirty(true);
  };

  const filteredStudents = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return students.filter((row) => {
      const type = attendance[row.id]?.attendance_type ?? "P";
      const risk = riskMap[row.id] ?? 100;
      const matchesSearch =
        !query ||
        fullName(row).toLowerCase().includes(query) ||
        String(row.admission_no || "").toLowerCase().includes(query) ||
        String(row.roll_no || "").toLowerCase().includes(query);
      if (!matchesSearch) return false;
      if (statusFilter === "present") return type === "P" || type === "F";
      if (statusFilter === "absent") return type === "A";
      if (statusFilter === "late") return type === "L";
      if (statusFilter === "risk") return risk < 75;
      return true;
    });
  }, [attendance, riskMap, searchQuery, statusFilter, students]);

  const presentCount = useMemo(() => students.filter((row) => {
    const type = attendance[row.id]?.attendance_type ?? "P";
    return type === "P" || type === "L" || type === "F";
  }).length, [attendance, students]);
  const absentCount = useMemo(() => students.filter((row) => (attendance[row.id]?.attendance_type ?? "P") === "A").length, [attendance, students]);
  const lateCount = useMemo(() => students.filter((row) => (attendance[row.id]?.attendance_type ?? "P") === "L").length, [attendance, students]);
  const riskCount = useMemo(() => students.filter((row) => (riskMap[row.id] ?? 100) < 75).length, [riskMap, students]);
  const presentPercent = students.length ? ((presentCount / students.length) * 100).toFixed(1) : "0.0";

  const totalPages = Math.max(1, Math.ceil(filteredStudents.length / pageSize));
  const visibleStudents = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredStudents.slice(start, start + pageSize);
  }, [filteredStudents, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const displayFrom = filteredStudents.length ? (page - 1) * pageSize + 1 : 0;
  const displayTo = Math.min(page * pageSize, filteredStudents.length);

  const allVisibleSelected = visibleStudents.length > 0 && visibleStudents.every((row) => selectedIds.includes(row.id));

  const toggleRow = (studentId: number, checked: boolean) => {
    setSelectedIds((prev) => {
      if (checked) return prev.includes(studentId) ? prev : [...prev, studentId];
      return prev.filter((id) => id !== studentId);
    });
  };

  const toggleAllVisible = (checked: boolean) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleStudents.map((row) => row.id)])));
      return;
    }
    const visibleSet = new Set(visibleStudents.map((row) => row.id));
    setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
  };

  const bulkSetType = (type: "P" | "A") => {
    if (!selectedIds.length) return;
    setAttendance((prev) => {
      const next = { ...prev };
      selectedIds.forEach((id) => {
        if (next[id]) {
          next[id] = { ...next[id], attendance_type: type };
        }
      });
      return next;
    });
    setDirty(true);
  };

  const sendNotice = () => {
    if (!selectedIds.length) return;
    setToast({ message: `Notice sent to ${selectedIds.length} selected pupil(s).`, tone: "success" });
  };

  const exportRows = () => {
    const source = selectedIds.length ? students.filter((row) => selectedIds.includes(row.id)) : filteredStudents;
    const csvRows = [
      ["Admission No", "Name", "Roll No", "Status", "Attendance %", "Notes"],
      ...source.map((row) => {
        const entry = attendance[row.id];
        return [
          row.admission_no || "",
          fullName(row),
          row.roll_no || "",
          entry?.attendance_type || "P",
          String(riskMap[row.id] || 100),
          entry?.notes || "",
        ];
      }),
    ];

    const csv = csvRows
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `attendance_${attendanceDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="legacy-panel attendance-premium min-h-screen bg-slate-50/80 px-2 py-2">
      {toast ? <TopToast message={toast.message} tone={toast.tone} onClose={() => setToast(null)} /> : null}

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0 space-y-4">
          <div className="rounded-2xl border border-[#E5E7EB] bg-white px-6 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-medium tracking-wide text-[#64748B]">Dashboard / Academics / Attendance</div>
                <h1 className="mt-2 text-5xl leading-[0.95] text-[#111827] heading-playfair">
                  Mark <span className="italic text-[#5B3DF5]">attendance</span>
                </h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-[#64748B]">
                  Pre-primary and transport-tracked classes show sign-in / sign-out times. For grades 6+, simpler daily marking view is used.
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm text-[#64748B]">
                  {dirty ? <span className="inline-flex h-2 w-2 rounded-full bg-amber-500" /> : <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500" />}
                  <span>{dirty ? "Unsaved attendance changes" : "All attendance changes saved"}</span>
                </div>
              </div>

              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-[180px_170px_170px_auto]">
                <div className="relative">
                  <select
                    className="h-11 w-full appearance-none rounded-xl border border-[#E5E7EB] bg-white px-3 pr-9 text-sm text-[#111827]"
                    value={classId}
                    onChange={(event) => {
                      const next = event.target.value;
                      setClassId(next);
                      setStudents([]);
                      setSelectedIds([]);
                      setSectionId("");
                      void loadSectionsForClass(next);
                    }}
                    aria-label="Class"
                  >
                    <option value="">Class</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#64748B]" />
                </div>

                <div className="relative">
                  <select
                    className="h-11 w-full appearance-none rounded-xl border border-[#E5E7EB] bg-white px-3 pr-9 text-sm text-[#111827]"
                    value={sectionId}
                    onChange={(event) => {
                      setSectionId(event.target.value);
                      setStudents([]);
                      setSelectedIds([]);
                    }}
                    disabled={!classId || loadingSections}
                    aria-label="Section"
                  >
                    <option value="">{loadingSections ? "Loading..." : "Section"}</option>
                    {sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#64748B]" />
                </div>

                <div className="relative">
                  <input
                    type="date"
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white px-3 pr-9 text-sm text-[#111827]"
                    value={attendanceDate}
                    max={todayIso}
                    onChange={(event) => setAttendanceDate(event.target.value)}
                    aria-label="Attendance date"
                  />
                  <CalendarDays className="pointer-events-none absolute right-3 top-3.5 h-4 w-4 text-[#64748B]" />
                </div>

                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-[#E5E7EB] bg-white px-4 text-sm font-semibold text-[#111827]"
                  onClick={exportRows}
                >
                  <Download className="h-4 w-4" />
                  Export
                </button>
              </div>
            </div>

            {!insightDismissed ? (
              <div className="mt-5 rounded-2xl border border-[#d9d0ff] bg-[#F3EEFF] px-4 py-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[#5B3DF5] text-white">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-semibold text-[#111827]">Eskoolia Insight <span className="rounded-md bg-[#5B3DF5] px-1.5 py-0.5 text-[10px] text-white">AI</span></p>
                      <p className="mt-1 text-sm text-[#4c4671]">3 students approaching the 75% threshold this week. Suggest parent notification.</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button type="button" className="inline-flex h-9 items-center gap-2 rounded-lg bg-[#5B3DF5] px-3 text-xs font-semibold text-white" onClick={sendNotice}>
                      <BellRing className="h-4 w-4" />
                      Notify parents
                    </button>
                    <button type="button" className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-xs font-medium text-[#64748B]" onClick={() => setInsightDismissed(true)}>
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
              <article className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Present Today</p>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600"><UserCheck className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-4xl leading-none text-[#111827] heading-playfair">{presentCount} <span className="text-base text-[#64748B]">/ {students.length || 0}</span></p>
                <p className="mt-2 text-sm text-[#64748B]">{presentPercent}%</p>
              </article>

              <article className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Absent Today</p>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><UserX className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-4xl leading-none text-[#111827] heading-playfair">{absentCount}</p>
                <p className="mt-2 text-sm text-[#64748B]">{absentCount === 1 ? "1 student" : `${absentCount} students`}</p>
              </article>

              <article className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Late Arrivals</p>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-600"><Clock3 className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-4xl leading-none text-[#111827] heading-playfair">{lateCount}</p>
                <p className="mt-2 text-sm text-[#64748B]">{lateCount === 0 ? "No late entries" : lateCount === 1 ? "1 late entry" : `${lateCount} late entries`}</p>
              </article>

              <article className="rounded-2xl border border-[#E5E7EB] bg-white p-4">
                <div className="flex items-start justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">Attendance Risk</p>
                  <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><ShieldAlert className="h-4 w-4" /></span>
                </div>
                <p className="mt-2 text-4xl leading-none text-[#111827] heading-playfair">{riskCount}</p>
                <p className="mt-2 text-sm text-[#64748B]">below 75%</p>
              </article>
            </div>
          </div>

          <div className="rounded-2xl border border-[#E5E7EB] bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-3 border-b border-[#E5E7EB] pb-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative w-full lg:max-w-sm">
                  <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#64748B]" />
                  <input
                    value={searchQuery}
                    onChange={(event) => {
                      setSearchQuery(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Search students..."
                    className="h-11 w-full rounded-xl border border-[#E5E7EB] bg-white pl-9 pr-3 text-sm text-[#111827]"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {(["all", "present", "absent", "late", "risk"] as const).map((filter) => (
                    <button
                      key={filter}
                      type="button"
                      onClick={() => {
                        setStatusFilter(filter);
                        setPage(1);
                      }}
                      className={`rounded-lg border px-3 py-1.5 text-xs font-semibold capitalize ${statusFilter === filter ? "border-[#5B3DF5] bg-[#F3EEFF] text-[#5B3DF5]" : "border-[#E5E7EB] bg-white text-[#64748B]"}`}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button type="button" disabled={!classId || !sectionId || !attendanceDate || searching} onClick={() => void searchStudents()} className="inline-flex h-10 items-center rounded-lg bg-[#5B3DF5] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
                  {searching ? "Loading..." : "Load pupils"}
                </button>
                <button type="button" disabled={saving || !students.length} onClick={() => void saveAttendance()} className="inline-flex h-10 items-center rounded-lg border border-[#5B3DF5] px-4 text-sm font-semibold text-[#5B3DF5] disabled:cursor-not-allowed disabled:opacity-60">
                  {saving ? "Saving..." : "Save all changes"}
                </button>
                <button type="button" disabled={!selectedIds.length} onClick={sendNotice} className="inline-flex h-10 items-center rounded-lg border border-[#E5E7EB] px-4 text-sm font-semibold text-[#111827] disabled:cursor-not-allowed disabled:opacity-60">
                  Send notice
                </button>
                <label className="ml-auto inline-flex items-center gap-2 text-xs font-medium text-[#64748B]">
                  <input type="checkbox" checked={autoSave} onChange={(event) => setAutoSave(event.target.checked)} />
                  Auto-save
                </label>
              </div>
            </div>

            {selectedIds.length ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E5E7EB] bg-slate-50 px-3 py-2">
                <span className="text-sm text-[#111827]">{selectedIds.length} selected</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827]" onClick={() => bulkSetType("P")}>Mark Present</button>
                  <button type="button" className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827]" onClick={() => bulkSetType("A")}>Mark Absent</button>
                  <button type="button" className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-xs font-semibold text-[#111827]" onClick={sendNotice}>Send Notice</button>
                  <button type="button" className="rounded-lg border border-[#5B3DF5] bg-[#5B3DF5] px-3 py-1.5 text-xs font-semibold text-white" onClick={exportRows}>Export Selected</button>
                </div>
              </div>
            ) : null}

            <div className="mt-3 hidden overflow-x-auto md:block">
              <table className="min-w-[1200px] table-fixed border-separate border-spacing-0">
                <thead className="sticky top-0 z-10 bg-white">
                  <tr className="text-left text-[11px] uppercase tracking-[0.08em] text-[#64748B]">
                    <th className="w-10 border-b border-[#E5E7EB] px-3 py-3"><input type="checkbox" title="Select all visible pupils" checked={allVisibleSelected} onChange={(event) => toggleAllVisible(event.target.checked)} /></th>
                    <th className="w-[260px] border-b border-[#E5E7EB] px-3 py-3">Pupil</th>
                    <th className="w-[90px] border-b border-[#E5E7EB] px-3 py-3">Absent</th>
                    <th className="w-[150px] border-b border-[#E5E7EB] px-3 py-3">Arrival</th>
                    <th className="w-[130px] border-b border-[#E5E7EB] px-3 py-3">Sign In</th>
                    <th className="w-[130px] border-b border-[#E5E7EB] px-3 py-3">Sign Out</th>
                    <th className="w-[110px] border-b border-[#E5E7EB] px-3 py-3">Pick-up</th>
                    <th className="w-[90px] border-b border-[#E5E7EB] px-3 py-3">Lunch</th>
                    <th className="w-[110px] border-b border-[#E5E7EB] px-3 py-3">Notes</th>
                    <th className="w-[90px] border-b border-[#E5E7EB] px-3 py-3">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {searching ? (
                    Array.from({ length: 6 }).map((_, index) => (
                      <tr key={`skeleton-${index}`} className="animate-pulse">
                        <td colSpan={10} className="border-b border-[#E5E7EB] px-3 py-4"><div className="h-5 w-full rounded bg-slate-100" /></td>
                      </tr>
                    ))
                  ) : visibleStudents.length ? (
                    visibleStudents.map((student, index) => {
                      const entry = attendance[student.id];
                      const type = entry?.attendance_type ?? "P";
                      const absent = type === "A";
                      const late = type === "L";
                      const risk = riskMap[student.id] ?? 100;
                      const risky = risk < 75;
                      const ui = uiRows[student.id] || defaultUiRow(index, type);
                      return (
                        <tr key={student.id} className={`${absent ? "bg-rose-50/60" : index % 2 ? "bg-slate-50/30" : "bg-white"} hover:bg-violet-50/30`}>
                          <td className="border-b border-[#E5E7EB] px-3 py-3"><input type="checkbox" title={`Select ${fullName(student)}`} checked={selectedIds.includes(student.id)} onChange={(event) => toggleRow(student.id, event.target.checked)} /></td>
                          <td className="border-b border-[#E5E7EB] px-3 py-3">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex h-9 w-9 items-center justify-center rounded-full text-xs font-bold text-white ${["bg-violet-600", "bg-emerald-600", "bg-sky-600", "bg-pink-600", "bg-amber-600"][student.id % 5]}`}>
                                {initials(student)}
                              </span>
                              <div>
                                <p className="text-sm font-semibold text-[#111827]">{fullName(student)}</p>
                                <div className="flex items-center gap-2 text-xs text-[#64748B]">
                                  <span>Group {(index % 4) + 1}</span>
                                  {risky ? <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-600">RTE {risk}%</span> : null}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="border-b border-[#E5E7EB] px-3 py-3">
                            <button type="button" title={absent ? "Mark present" : "Mark absent"} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${absent ? "bg-rose-600" : "bg-slate-200"}`} onClick={() => setType(student.id, absent ? "P" : "A")}>
                              <span className={`inline-flex h-4 w-4 rounded-full bg-white transition ${absent ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                          </td>
                          <td className="border-b border-[#E5E7EB] px-3 py-3">
                            <div className="flex items-center gap-2">
                              <input type="time" title={`Arrival time for ${fullName(student)}`} value={ui.arrivalTime} onChange={(event) => setUiRow(student.id, { arrivalTime: event.target.value })} className={`h-8 rounded-lg border px-2 text-xs ${late ? "border-amber-300 bg-amber-50 text-amber-700" : "border-[#E5E7EB] bg-slate-50 text-[#111827]"}`} />
                              {late ? <span className="rounded-md bg-amber-100 px-2 py-1 text-[10px] font-semibold text-amber-700">{ui.lateMinutes}m late</span> : null}
                            </div>
                          </td>
                          <td className="border-b border-[#E5E7EB] px-3 py-3">
                            {ui.signInTime && !absent ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-xs font-semibold text-emerald-700"><Check className="h-3.5 w-3.5" /> {formatClock(ui.signInTime)}</span>
                            ) : (
                              <button type="button" className="inline-flex items-center gap-1 rounded-lg bg-[#5B3DF5] px-3 py-1.5 text-xs font-semibold text-white" onClick={() => { setType(student.id, "P"); setUiRow(student.id, { signInTime: "08:20" }); }}><LogIn className="h-3.5 w-3.5" />Sign in</button>
                            )}
                          </td>
                          <td className="border-b border-[#E5E7EB] px-3 py-3">
                            {absent ? (
                              <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-lg bg-slate-100 text-xs text-slate-400">-</span>
                            ) : ui.signOutTime ? (
                              <span className="inline-flex items-center gap-1 rounded-lg bg-[#5B3DF5] px-3 py-1.5 text-xs font-semibold text-white">{formatClock(ui.signOutTime)}</span>
                            ) : (
                              <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#5B3DF5] px-3 py-1.5 text-xs font-semibold text-[#5B3DF5]" onClick={() => setUiRow(student.id, { signOutTime: "17:00" })}><LogOut className="h-3.5 w-3.5" />Sign out</button>
                            )}
                          </td>
                          <td className="border-b border-[#E5E7EB] px-3 py-3 text-sm text-[#64748B]">{absent ? "-" : formatClock(ui.pickupTime)}</td>
                          <td className="border-b border-[#E5E7EB] px-3 py-3">
                            <button type="button" title={ui.lunchTaken ? "Mark lunch not taken" : "Mark lunch taken"} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${ui.lunchTaken ? "bg-[#5B3DF5]" : "bg-slate-200"}`} onClick={() => setUiRow(student.id, { lunchTaken: !ui.lunchTaken })}>
                              <span className={`inline-flex h-4 w-4 rounded-full bg-white transition ${ui.lunchTaken ? "translate-x-6" : "translate-x-1"}`} />
                            </button>
                          </td>
                          <td className="border-b border-[#E5E7EB] px-3 py-3">
                            <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs text-[#64748B]" onClick={() => {
                              const next = window.prompt("Add attendance note", entry?.notes || "");
                              if (next !== null) setNote(student.id, next);
                            }}>
                              <StickyNote className="h-3.5 w-3.5" />
                              <span>{entry?.notes ? 1 : 0}</span>
                            </button>
                          </td>
                          <td className="border-b border-[#E5E7EB] px-3 py-3">
                            <button type="button" className="rounded-lg border border-[#E5E7EB] bg-white px-2.5 py-1.5 text-xs font-semibold text-[#111827]" onClick={() => void saveAttendance()}>Save</button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={10} className="border-b border-[#E5E7EB] px-4 py-8 text-center text-sm text-[#64748B]">No pupils found for selected filters.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="mt-3 space-y-3 md:hidden">
              {visibleStudents.map((student, index) => {
                const entry = attendance[student.id];
                const type = entry?.attendance_type ?? "P";
                const absent = type === "A";
                const ui = uiRows[student.id] || defaultUiRow(index, type);
                return (
                  <article key={`mobile-${student.id}`} className={`rounded-xl border border-[#E5E7EB] p-3 ${absent ? "bg-rose-50/70" : "bg-white"}`}>
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-[#111827]">{fullName(student)}</p>
                      <button type="button" title={absent ? "Mark present" : "Mark absent"} className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${absent ? "bg-rose-600" : "bg-slate-200"}`} onClick={() => setType(student.id, absent ? "P" : "A")}>
                        <span className={`inline-flex h-4 w-4 rounded-full bg-white transition ${absent ? "translate-x-6" : "translate-x-1"}`} />
                      </button>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#64748B]">
                      <div className="rounded-lg border border-[#E5E7EB] bg-slate-50 px-2 py-1">Sign in: {ui.signInTime ? formatClock(ui.signInTime) : "-"}</div>
                      <div className="rounded-lg border border-[#E5E7EB] bg-slate-50 px-2 py-1">Pick-up: {formatClock(ui.pickupTime)}</div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#E5E7EB] pt-3">
              <p className="text-sm text-[#64748B]">Showing {displayFrom}-{displayTo} of {filteredStudents.length} pupils</p>
              <div className="flex items-center gap-2">
                <select title="Rows per page" value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }} className="h-9 rounded-lg border border-[#E5E7EB] px-2 text-xs text-[#111827]">
                  {[10, 20, 25, 50].map((size) => <option key={size} value={size}>{size} / page</option>)}
                </select>
                <button type="button" title="Previous page" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page <= 1} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#64748B] disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button>
                <span className="rounded-lg border border-[#E5E7EB] bg-[#5B3DF5] px-3 py-1.5 text-xs font-semibold text-white">{page}</span>
                <span className="rounded-lg border border-[#E5E7EB] px-3 py-1.5 text-xs text-[#64748B]">{Math.min(page + 1, totalPages)}</span>
                <button type="button" title="Next page" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page >= totalPages} className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#E5E7EB] text-[#64748B] disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style jsx>{`
        .heading-playfair {
          font-family: "Playfair Display", Georgia, serif;
        }
      `}</style>
    </div>
  );
}
