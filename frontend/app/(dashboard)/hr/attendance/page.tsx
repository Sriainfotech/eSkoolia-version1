"use client";
/**
 * HR Attendance — Department accordion groups with daily attendance table.
 */
import { useState } from "react";
import { ChevronDown, ChevronRight, Check, X, Clock, Edit2, Save } from "lucide-react";
import {
  HrButton, HrBadge, HrKpiCard, HrModal, HrField, HrInput, HrSelect,
  HrHero, HrSkeleton, useHrToast,
} from "@/components/hr/HrUi";
import { useAttendance, useStaff, useDepartments, saveAttendanceBatch, updateAttendance } from "@/hooks/useHrApi";
import type { AttendanceRecord } from "@/types/hr";

const STATUS_OPTIONS = ["present", "absent", "late", "half_day", "on_leave"] as const;
type AttendanceStatus = typeof STATUS_OPTIONS[number];

const STATUS_META: Record<AttendanceStatus, { label: string; color: string; icon: React.ReactNode }> = {
  present:  { label: "Present",  color: "var(--green)", icon: <Check size={13} /> },
  absent:   { label: "Absent",   color: "var(--red)",   icon: <X size={13} /> },
  late:     { label: "Late",     color: "var(--amber)", icon: <Clock size={13} /> },
  half_day: { label: "Half Day", color: "#2563EB",      icon: <Clock size={13} /> },
  on_leave: { label: "On Leave", color: "#64748b",      icon: <Clock size={13} /> },
};

function today() {
  return new Date().toISOString().split("T")[0];
}

// ─── Edit Record Modal ─────────────────────────────────────────────────────────
function EditModal({
  record, onClose, onSaved,
}: {
  record: AttendanceRecord;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useHrToast();
  const [status, setStatus] = useState<AttendanceStatus>(record.status as AttendanceStatus);
  const [signIn, setSignIn] = useState(record.time_in ?? "");
  const [lunchOut, setLunchOut] = useState(record.lunch_out ?? "");
  const [lunchIn, setLunchIn] = useState(record.lunch_in ?? "");
  const [signOut, setSignOut] = useState(record.time_out ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateAttendance(record.id, {
        status, time_in: signIn, time_out: signOut,
        lunch_out: lunchOut, lunch_in: lunchIn,
      });
      toast("Attendance updated");
      onSaved(); onClose();
    } catch { toast("Failed to update", "error"); }
    finally { setSaving(false); }
  };

  return (
    <HrModal isOpen onClose={onClose} title={`Edit — ${record.staff_name}`} size="md">
      <div className="p-[20px] grid gap-4">
        <HrField label="Status">
          <HrSelect value={status} onChange={(e) => setStatus(e.target.value as AttendanceStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{STATUS_META[s].label}</option>
            ))}
          </HrSelect>
        </HrField>
        <div className="grid grid-cols-2 gap-4">
          <HrField label="Sign In">
            <HrInput type="time" value={signIn} onChange={(e) => setSignIn(e.target.value)} />
          </HrField>
          <HrField label="Sign Out">
            <HrInput type="time" value={signOut} onChange={(e) => setSignOut(e.target.value)} />
          </HrField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <HrField label="Lunch Out">
            <HrInput type="time" value={lunchOut} onChange={(e) => setLunchOut(e.target.value)} />
          </HrField>
          <HrField label="Lunch In">
            <HrInput type="time" value={lunchIn} onChange={(e) => setLunchIn(e.target.value)} />
          </HrField>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
          <HrButton variant="ghost" onClick={onClose}>Cancel</HrButton>
          <HrButton variant="primary" onClick={() => void handleSave()} loading={saving}>
            <Save size={13} /> Save
          </HrButton>
        </div>
      </div>
    </HrModal>
  );
}

// ─── Department Attendance Group ───────────────────────────────────────────────
function DeptAttendanceAccordion({
  deptName,
  records,
  onEdit,
  onToggleAbsent,
}: {
  deptName: string;
  records: AttendanceRecord[];
  onEdit: (r: AttendanceRecord) => void;
  onToggleAbsent: (r: AttendanceRecord) => void;
}) {
  const [open, setOpen] = useState(true);
  const present = records.filter((r) => r.status === "present").length;
  const absent = records.filter((r) => r.status === "absent").length;

  return (
    <div className="border border-[var(--line)] rounded-[12px] overflow-hidden mb-3">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 p-[12px_16px] text-left"
        style={{ background: open ? "#f8f6ff" : "#fafafa", borderLeft: "4px solid var(--strong)" }}
      >
        <span className="flex-1 font-[850] text-[14px]">{deptName}</span>
        <HrBadge variant="green">{present} present</HrBadge>
        <HrBadge variant="red">{absent} absent</HrBadge>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-[#fafafa] text-[11px] uppercase text-[#64748b] tracking-[0.08em]">
              <th className="px-3 py-[10px] text-left">Staff</th>
              <th className="px-3 py-[10px] text-left">Status</th>
              <th className="px-3 py-[10px] text-left">Sign In</th>
              <th className="px-3 py-[10px] text-left">Lunch</th>
              <th className="px-3 py-[10px] text-left">Sign Out</th>
              <th className="px-3 py-[10px] text-left">Mark Absent</th>
              <th className="px-3 py-[10px] text-left">Edit</th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => {
              const meta = STATUS_META[r.status as AttendanceStatus] ?? STATUS_META.present;
              return (
                <tr key={r.id} className="border-t border-[#f4f4f8] hover:bg-[#fafafd] transition-colors">
                  <td className="px-3 py-3 font-[750] text-[13px]">{r.staff_name}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1" style={{ color: meta.color }}>
                      {meta.icon}
                      <span className="text-[12px] font-[700]">{meta.label}</span>
                    </div>
                  </td>
                  <td className="px-3 py-3 text-[12px] text-[var(--muted)]">{r.time_in || "—"}</td>
                  <td className="px-3 py-3 text-[12px] text-[var(--muted)]">
                    {r.lunch_out ? `${r.lunch_out} – ${r.lunch_in ?? "?"}` : "—"}
                  </td>
                  <td className="px-3 py-3 text-[12px] text-[var(--muted)]">{r.time_out || "—"}</td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => onToggleAbsent(r)}
                      className="w-[22px] h-[22px] rounded-[5px] border-2 flex items-center justify-center transition-colors"
                      style={{
                        borderColor: r.status === "absent" ? "var(--red)" : "#cbd5e1",
                        background: r.status === "absent" ? "var(--red)" : "transparent",
                      }}
                      title={r.status === "absent" ? "Mark Present" : "Mark Absent"}
                    >
                      {r.status === "absent" && <X size={11} className="text-white" />}
                    </button>
                  </td>
                  <td className="px-3 py-3">
                    <HrButton variant="icon" size="icon" onClick={() => onEdit(r)}>
                      <Edit2 size={12} />
                    </HrButton>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Main Attendance Page ─────────────────────────────────────────────────────
export default function HrAttendancePage() {
  const [date, setDate] = useState(today);
  const { data, loading, refetch } = useAttendance(date);
  const { data: deptData } = useDepartments();
  const { toast } = useHrToast();

  const [editRecord, setEditRecord] = useState<AttendanceRecord | null>(null);
  const [saving, setSaving] = useState(false);

  const records = data?.results ?? [];
  const departments = deptData?.results ?? [];

  const presentCount = records.filter((r) => r.status === "present").length;
  const absentCount = records.filter((r) => r.status === "absent").length;
  const lateCount = records.filter((r) => r.status === "late").length;

  // Group by department
  const byDept = records.reduce<Record<string, AttendanceRecord[]>>((acc, r) => {
    const d = r.department_name || "Unassigned";
    (acc[d] = acc[d] || []).push(r);
    return acc;
  }, {});

  const handleToggleAbsent = async (r: AttendanceRecord) => {
    const newStatus = r.status === "absent" ? "present" : "absent";
    try {
      await updateAttendance(r.id, { status: newStatus });
      void refetch();
    } catch { toast("Failed to update", "error"); }
  };

  return (
    <div>
      <HrHero
        eyebrow="HR Module"
        title="Daily"
        accent="Attendance"
        sub="Track and manage staff attendance by department."
        actions={
          <div className="flex items-center gap-3">
            <HrInput
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{ width: "160px" }}
            />
          </div>
        }
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <HrKpiCard label="Total Staff" value={records.length} />
        <HrKpiCard label="Present" value={presentCount} color="var(--green)" />
        <HrKpiCard label="Absent" value={absentCount} color="var(--red)" />
        <HrKpiCard label="Late" value={lateCount} color="var(--amber)" />
      </div>

      {/* Attendance by Department */}
      {loading ? (
        <HrSkeleton rows={6} />
      ) : records.length === 0 ? (
        <div
          className="bg-white border border-[var(--line)] rounded-[14px] py-16 text-center text-[var(--muted)]"
          style={{ boxShadow: "var(--shadow)" }}
        >
          No attendance records for {date}. Records are generated when staff check in.
        </div>
      ) : (
        Object.entries(byDept).map(([deptName, deptRecords]) => (
          <DeptAttendanceAccordion
            key={deptName}
            deptName={deptName}
            records={deptRecords}
            onEdit={setEditRecord}
            onToggleAbsent={(r) => void handleToggleAbsent(r)}
          />
        ))
      )}

      {/* Edit Modal */}
      {editRecord && (
        <EditModal
          record={editRecord}
          onClose={() => setEditRecord(null)}
          onSaved={() => void refetch()}
        />
      )}
    </div>
  );
}
