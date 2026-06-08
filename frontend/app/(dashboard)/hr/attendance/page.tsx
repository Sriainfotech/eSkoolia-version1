"use client";
/**
 * HR Staff Attendance — full parity with Student Attendance, grouped by HR-setup
 * DEPARTMENTS. Week date strip + KPI cards + MARK ALL VISIBLE header; expand a
 * department to reveal its staff with a rich table (absent toggle, arrival,
 * sign-in/out, lunch, notes, edit), then Save. Persisted via
 * /api/v1/hr/staff-attendance/bulk-store/.
 */
import React, { useEffect, useMemo, useState } from "react";
import {
  useStaffList, useAllDepartments, useStaffAttendanceForDate, saveStaffAttendanceBulk,
} from "@/hooks/useHrApi";
import type { Staff } from "@/types/hr";
import { useHrToast } from "@/components/hr/HrUi";
import DeptTypeCard from "./components/DeptTypeCard";
import HrGlobalControls from "./components/HrGlobalControls";
import HrAttendanceKPIs from "./components/HrAttendanceKPIs";
import { useHrAttendanceData } from "./hooks/useHrAttendanceData";
import StaffMonthlyReport from "./StaffMonthlyReport";
import StaffAbsentNoteDialog from "./components/StaffAbsentNoteDialog";
import StaffAttendanceImportDialog from "./components/StaffAttendanceImportDialog";
import { getAccessToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

// ─── Status model (matches backend StaffAttendance.STATUS_CHOICES) ──────────────
type AttCode = "P" | "A" | "L" | "F" | "H";
const STATUS_META: Record<AttCode, { label: string; color: string; bg: string }> = {
  P: { label: "Present", color: "#0A8C5A", bg: "#E4F6ED" },
  A: { label: "Absent", color: "#C2264E", bg: "#FCE8EE" },
  L: { label: "Leave", color: "#2563EB", bg: "#EFF6FF" },
  F: { label: "Half Day", color: "#B4721B", bg: "#FDF1DC" },
  H: { label: "Holiday", color: "#6B6B7B", bg: "#F1F1F5" },
};

interface StaffMark {
  attendance_type?: AttCode;
  arrival_time?: string | null;
  sign_in_time?: string | null;
  sign_out_time?: string | null;
  lunch?: boolean;
  note?: string;
}

const AVATAR_COLORS = ["#4729F4", "#0A8C5A", "#B4721B", "#C2264E", "#2563EB", "#9333EA", "#0891B2"];
const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function today() { return fmt(new Date()); }
function nowHHMM() { return new Date().toTimeString().slice(0, 5); }
function hhmm(t?: string | null) { return t ? t.slice(0, 5) : null; }
function fmt(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function staffName(s: Staff) {
  return s.full_name?.trim() || `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || s.staff_no;
}
function initials(s: Staff) {
  const a = (s.first_name || "").trim()[0] || "";
  const b = (s.last_name || "").trim()[0] || "";
  return (a + b).toUpperCase() || (s.staff_no || "?").slice(0, 2).toUpperCase();
}
function ringColor(pct: number) {
  if (pct === 0) return "#D8D8E4";
  if (pct >= 90) return "#0A8C5A";
  if (pct >= 75) return "#4729F4";
  if (pct >= 50) return "#B4721B";
  return "#C2264E";
}
function getMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - ((day === 0 ? 7 : day) - 1));
  return d;
}
function getWeekDates(centerDate: string) {
  const monday = getMonday(new Date(`${centerDate}T00:00:00`));
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(monday); d.setDate(monday.getDate() + i); return d; });
}
function monthOptions(selectedDate: string) {
  const y = new Date(`${selectedDate}T00:00:00`).getFullYear();
  return Array.from({ length: 12 }, (_, m) => ({
    value: `${y}-${String(m + 1).padStart(2, "0")}`,
    label: new Date(y, m, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
  }));
}
function weekOptionsForMonth(monthValue: string) {
  const [yt, mt] = monthValue.split("-");
  const year = Number(yt); const month = Number(mt) - 1;
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const options: { value: string; label: string }[] = [];
  let cursor = getMonday(firstDay); let idx = 1;
  while (cursor <= lastDay || cursor.getMonth() === month) {
    const weekStart = new Date(cursor);
    const weekEnd = new Date(cursor); weekEnd.setDate(weekEnd.getDate() + 6);
    const inStart = weekStart.getMonth() === month ? weekStart : firstDay;
    const inEnd = weekEnd.getMonth() === month ? weekEnd : lastDay;
    options.push({ value: fmt(weekStart), label: `Week ${idx} (${inStart.getDate()}-${inEnd.getDate()})` });
    cursor.setDate(cursor.getDate() + 7); idx += 1;
    if (idx > 7) break;
  }
  return options;
}

// ─── Percentage ring ────────────────────────────────────────────────────────────
function Ring({ pct, size = 38, strokeWidth = 3.5 }: { pct: number; size?: number; strokeWidth?: number }) {
  const r = size / 2 - strokeWidth;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#F0F0F6" strokeWidth={strokeWidth} />
        {pct > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ringColor(pct)} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={c} strokeDashoffset={offset} />}
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-[#0B0B14]">{pct === 0 ? "—" : `${pct}%`}</span>
    </div>
  );
}

// ─── KPI card ───────────────────────────────────────────────────────────────────
function KpiCard({ label, value, sub, badge, badgeBg, badgeColor }: {
  label: string; value: string | number; sub?: string; badge: string; badgeBg: string; badgeColor: string;
}) {
  return (
    <article className="min-w-0 rounded-2xl border border-[#E5E7EB] bg-white px-4 py-3">
      <div className="flex items-center justify-between">
        <span className="truncate text-[11px] font-semibold uppercase tracking-[0.08em] text-[#64748B]">{label}</span>
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold" style={{ background: badgeBg, color: badgeColor }}>{badge}</span>
      </div>
      <div className="mt-2 text-[40px] font-bold leading-none text-[#111827]">{value}</div>
      {sub ? <span className="mt-2 block text-xs text-[#64748B]">{sub}</span> : null}
    </article>
  );
}

// ─── Department accordion card ──────────────────────────────────────────────────

// ─── Page ────────────────────────────────────────────────────────────────────
export default function HrStaffAttendancePage() {
  const [date, setDate] = useState(today());
  const { data: deptData } = useAllDepartments();
  const { staffByDept, marksByDept, loadingDepts, loadDepartment, updateMark, saveBulk } = useHrAttendanceData(date);
  const { toast } = useHrToast();

  const [saving, setSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [openDepts, setOpenDepts] = useState<Set<string>>(new Set());

  const departments = useMemo(() => deptData?.results ?? [], [deptData]);

  const deptsByType = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const d of departments) {
      if (typeFilter !== "all" && d.dept_type !== typeFilter) continue;
      const typeName = d.dept_type?.trim() || "Other";
      if (!groups[typeName]) groups[typeName] = [];
      groups[typeName].push(d);
    }
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]));
  }, [departments, typeFilter]);

  const deptTypes = useMemo(() => {
    const set = new Set<string>();
    for (const d of departments) if (d.dept_type) set.add(d.dept_type);
    return Array.from(set).sort();
  }, [departments]);

  useEffect(() => {
    if (deptsByType.length > 0 && openDepts.size === 0) {
      setOpenDepts(new Set([deptsByType[0][0]]));
    }
  }, [deptsByType, openDepts]);

  const handleMarkAllVisible = (statusCode: "P" | "A" | "L") => {
    let count = 0;
    deptsByType.forEach(([deptType, typeDepts]) => {
      if (openDepts.has(deptType)) {
        typeDepts.forEach((d: any) => {
          const staff = staffByDept[d.id] || [];
          staff.forEach((s: any) => {
            const marks = marksByDept[d.id] || {};
            const currentMark = marks[s.id] || {};
            const q = search.trim().toLowerCase();
            const matchesSearch = !q || (s.full_name || "").toLowerCase().includes(q) || (s.staff_no || "").toLowerCase().includes(q);
            const matchesStatus = statusFilter === "all" || (currentMark.attendance_type || "P") === statusFilter;
            
            if (matchesSearch && matchesStatus) {
              if (currentMark.attendance_type !== statusCode) {
                updateMark(d.id, s.id, { attendance_type: statusCode });
                count++;
              }
            }
          });
        });
      }
    });
    if (count > 0) {
      toast(`Marked ${count} staff as ${statusCode}`, "success");
    } else {
      toast("No visible staff to update. Make sure a department is open.", "info");
    }
  };

  const saveRows = async (deptId: number, staffIds: number[]) => {
    const marks = marksByDept[deptId] || {};
    const rows = staffIds
      .filter((id) => marks[id]?.attendance_type || marks[id]?.sign_in_time)
      .map((id) => {
        const m = marks[id];
        return {
          staff: id, attendance_date: date, attendance_type: m.attendance_type ?? "P",
          note: m.note ?? "", arrival_time: m.arrival_time ?? null,
          sign_in_time: m.sign_in_time ?? null, sign_out_time: m.sign_out_time ?? null, lunch: !!m.lunch,
        };
      });
    if (rows.length === 0) { toast("Mark at least one staff member first", "error"); return; }
    setSaving(true);
    await saveBulk(rows, () => {
      toast(`Attendance saved for ${rows.length} staff`, "success");
      loadDepartment(deptId);
      setSaving(false);
    }, (msg: string) => {
      toast(msg, "error");
      setSaving(false);
    });
  };

  const handleDownloadSample = async () => {
    try {
      const token = getAccessToken();
      const resp = await fetch(`${API_BASE_URL}/api/v1/hr/staff-attendance/download-sample/`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const blob = await resp.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "staff_attendance_sheet.xlsx";
      link.click();
    } catch (e: any) {
      toast(e.message || "Failed to download sample", "error");
    }
  };

  const handleExport = async () => {
    try {
      const token = getAccessToken();
      const resp = await fetch(`${API_BASE_URL}/api/v1/hr/staff-attendance/export/?date=${date}&format=csv`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const blob = await resp.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `staff_attendance_${date}.csv`;
      link.click();
    } catch (e: any) {
      toast(e.message || "Failed to export", "error");
    }
  };

  return (
    <div className="p-6 bg-[#F0EFFE] min-h-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 style={{ margin: 0, fontFamily: 'var(--font-playfair), "Playfair Display", Georgia, serif', fontSize: 32, fontWeight: 700, lineHeight: 1.15, letterSpacing: "-0.02em", color: "#0f172a" }}>
            Staff <span style={{ color: "#6c3ce1", fontFamily: 'var(--font-playfair), "Playfair Display", Georgia, serif', fontStyle: "italic", fontSize: 32, fontWeight: 400 }}>Attendance</span>
          </h1>
          <p className="text-sm text-[#6B6B80] mt-0.5">Track and manage daily staff attendance by department</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleDownloadSample} className="h-9 px-4 text-[13px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg shadow-sm flex items-center gap-2 hover:bg-[#FAFAFD] transition-colors">
            <svg className="w-4 h-4 text-[#6B6B7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Download Sample
          </button>
          <button onClick={() => setImportOpen(true)} className="h-9 px-4 text-[13px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg shadow-sm flex items-center gap-2 hover:bg-[#FAFAFD] transition-colors">
            <svg className="w-4 h-4 text-[#6B6B7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            Import
          </button>
          <button onClick={handleExport} className="h-9 px-4 text-[13px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg shadow-sm flex items-center gap-2 hover:bg-[#FAFAFD] transition-colors">
            <svg className="w-4 h-4 text-[#6B6B7B]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
            Export
          </button>
        </div>
      </div>

      <HrAttendanceKPIs
        departments={departments}
        staffByDept={staffByDept}
        marksByDept={marksByDept}
        loading={Object.values(loadingDepts).some(v => v)}
      />

      <HrGlobalControls
        selectedDate={date}
        onDateChange={setDate}
        searchQuery={search}
        onSearchChange={setSearch}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        typeFilter={typeFilter}
        onTypeFilterChange={setTypeFilter}
        deptTypes={deptTypes}
        onMarkAllVisible={handleMarkAllVisible}
      />

      <div className="space-y-3">
        {deptsByType.map(([deptType, typeDepts]) => (
          <DeptTypeCard
            key={deptType}
            deptType={deptType}
            departments={typeDepts}
            staffByDept={staffByDept}
            marksByDept={marksByDept}
            loadingDepts={loadingDepts}
            open={openDepts.has(deptType)}
            onToggle={() => setOpenDepts(p => { const n = new Set(p); if (n.has(deptType)) n.delete(deptType); else n.add(deptType); return n; })}
            loadDepartment={loadDepartment}
            updateMark={updateMark}
            saveRows={saveRows}
            saving={saving}
            search={search}
            statusFilter={statusFilter}
          />
        ))}
        {deptsByType.length === 0 && (
          <div className="py-20 text-center text-[#6B6B7B]">
            <div className="w-16 h-16 bg-[#E6E6EC] rounded-full flex items-center justify-center mx-auto mb-3 text-2xl">👥</div>
            <p className="text-[15px] font-semibold text-[#0B0B14]">No departments found</p>
            <p className="text-[13px] mt-1">Try adjusting your filters</p>
          </div>
        )}
      </div>

      {/* Monthly report */}
      <StaffMonthlyReport departments={departments} />
      <StaffAttendanceImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          Object.keys(loadingDepts).forEach(d => loadDepartment(Number(d)));
        }}
        onNotify={(msg, tone) => toast(msg, tone)}
      />
    </div>
  );
}
