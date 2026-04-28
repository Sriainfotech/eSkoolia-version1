"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { API_BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { ChevronDown, ChevronLeft, ChevronRight, Clock3, Edit3, Plus, Search, Trash2, X } from "lucide-react";
import { useToast } from "@/components/common/Toast";

type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; section_name?: string; name?: string; class_id?: number };
type ExamType = { id: number; title: string };
type Subject = { id: number; subject_name?: string; name?: string };
type Teacher = { id: number; full_name: string };
type ExamPeriod = { id: number; period: string };
type ClassRoom = { id: number; room_no: string };
type HolidayItem = { id: number; title: string; start_date: string; end_date: string; is_active: boolean; description: string };

type ScheduleItem = {
  id: number;
  exam_type: number;
  exam_type_name: string;
  class_name: string;
  class_id: number;
  section: string;
  section_id: number | null;
  subject: string;
  subject_id: number;
  teacher: string;
  teacher_id: number | null;
  room: string;
  room_id: number | null;
  date: string;
  period: number | null;
  period_name: string;
  start_time: string;
  end_time: string;
};

type ModalState = {
  open: boolean;
  roomId: number | null;
  roomName: string;
  slotKey: string;
  timeLabel: string;
  date: string;
  editingSchedule?: ScheduleItem | null;
};

type ToastItem = { id: number; type: "success" | "conflict" | "delete" | "holiday"; message: string };

type PopoverState = { schedule: ScheduleItem; top: number; left: number; preferLeft: boolean } | null;

type TimelineGridItem = {
  start: number;
  end: number;
  label: string;
};

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", headers: authHeaders() });
  if (!response.ok) throw new Error(`GET failed ${response.status}`);
  return (await response.json()) as T;
}

async function apiRequest<T>(path: string, method: string, payload?: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: authHeaders(),
    body: payload ? JSON.stringify(payload) : undefined,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.detail || body?.message || body?.conflict_type || "Operation failed");
  }
  if (method === "DELETE") {
    return undefined as T;
  }
  return (await response.json()) as T;
}

function toDateInput(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function timeLabelRange(startHour: number) {
  const suffix = startHour >= 12 ? "PM" : "AM";
  const displayHour = startHour === 0 ? 12 : startHour > 12 ? startHour - 12 : startHour;
  return `${displayHour}:00 ${suffix}`;
}

function formatTime(value: string) {
  if (!value) return "";
  return value.slice(0, 5);
}

function buildTimeSlots(): TimelineGridItem[] {
  const slots: TimelineGridItem[] = [];
  for (let hour = 8; hour <= 16; hour += 1) {
    slots.push({ start: hour, end: hour + 1, label: timeLabelRange(hour) });
  }
  return slots;
}

function hourIndexFromTime(value: string) {
  const [hour] = value.split(":").map(Number);
  return Number.isFinite(hour) ? hour : 0;
}

function classColor(className: string) {
  const map: Record<string, { start: string; end: string; solid: string }> = {
    "1": { start: "rgba(191,219,254,0.75)", end: "rgba(219,234,254,0.6)", solid: "#3b82f6" },
    "2": { start: "rgba(254,202,202,0.75)", end: "rgba(254,226,226,0.6)", solid: "#ef4444" },
    "3": { start: "rgba(187,247,208,0.75)", end: "rgba(220,252,231,0.6)", solid: "#22c55e" },
    "4": { start: "rgba(253,230,138,0.75)", end: "rgba(254,243,199,0.6)", solid: "#eab308" },
    "5": { start: "rgba(233,213,255,0.75)", end: "rgba(243,232,255,0.6)", solid: "#a855f7" },
    "7": { start: "rgba(254,215,170,0.75)", end: "rgba(255,237,213,0.6)", solid: "#f97316" },
    "8": { start: "rgba(186,230,253,0.75)", end: "rgba(224,242,254,0.6)", solid: "#0ea5e9" },
    "9": { start: "rgba(252,231,243,0.75)", end: "rgba(253,242,248,0.6)", solid: "#ec4899" },
    "10": { start: "rgba(165,243,252,0.75)", end: "rgba(207,250,254,0.6)", solid: "#06b6d4" },
    "11": { start: "rgba(209,250,229,0.75)", end: "rgba(220,252,231,0.6)", solid: "#10b981" },
    "12": { start: "rgba(224,231,255,0.75)", end: "rgba(238,242,255,0.6)", solid: "#6366f1" },
    UKG: { start: "rgba(255,228,230,0.75)", end: "rgba(255,241,242,0.6)", solid: "#f43f5e" },
  };

  const key = className.toString().toUpperCase();
  return map[key] || { start: "rgba(219,234,254,0.75)", end: "rgba(239,246,255,0.6)", solid: "#3b82f6" };
}

function greyLegendColor(className: string) {
  const palette = classColor(className);
  return {
    chip: "rgba(148,163,184,0.12)",
    border: "rgba(148,163,184,0.28)",
    text: "#475569",
    symbol: palette.solid,
  };
}

function roomSubtitle(roomNo: string) {
  const room = roomNo.toUpperCase();
  if (room.includes("HALL")) return "Main Hall";
  if (room.includes("LAB")) return "Lab Wing";
  if (room.includes("ROOM")) return "Classroom";
  if (room.includes("LIBRARY")) return "Library Wing";
  return "Exam Space";
}

function overlaps(slotHour: number, startTime: string, endTime: string) {
  const start = hourIndexFromTime(startTime);
  const end = hourIndexFromTime(endTime);
  return slotHour >= start && slotHour < Math.max(end, start + 1);
}

function toastIcon(type: ToastItem["type"]) {
  if (type === "success") return "✅";
  if (type === "delete") return "🗑";
  if (type === "holiday") return "🚫";
  return "⚠️";
}

function fieldStyle() {
  return {
    width: "100%",
    height: 38,
    border: "1.5px solid #e2e8f0",
    borderRadius: 10,
    padding: "0 12px",
    background: "#fff",
    color: "#1e293b",
    fontSize: 14,
    fontWeight: 600,
  } as const;
}

function labelStyle() {
  return {
    display: "block",
    marginBottom: 6,
    fontSize: 10,
    fontWeight: 700,
    color: "#94a3b8",
    textTransform: "uppercase" as const,
    letterSpacing: "1px",
  } as const;
}

function cardShadow() {
  return "0 1px 3px rgba(0,0,0,0.04), 0 6px 24px rgba(0,0,0,0.06)";
}

export default function ExamSchedulePanel() {
  const today = useMemo(() => toDateInput(new Date()), []);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [periods, setPeriods] = useState<ExamPeriod[]>([]);
  const [rooms, setRooms] = useState<ClassRoom[]>([]);
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [schedules, setSchedules] = useState<ScheduleItem[]>([]);

  const [selectedExamType, setSelectedExamType] = useState("");
  const [selectedDate, setSelectedDate] = useState(today);
  const [filterClass, setFilterClass] = useState("all");
  const [filterSection, setFilterSection] = useState("all");
  const [filterRoom, setFilterRoom] = useState("all");

  const [popover, setPopover] = useState<PopoverState>(null);
  const [modal, setModal] = useState<ModalState>({ open: false, roomId: null, roomName: "", slotKey: "", timeLabel: "", date: today, editingSchedule: null });
  const [toastStack, setToastStack] = useState<ToastItem[]>([]);
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [modalSaving, setModalSaving] = useState(false);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);

  const timeSlots = useMemo(() => buildTimeSlots(), []);
  const currentHour = new Date().getHours();
  const filteredSections = useMemo(() => {
    if (filterClass === "all") return sections;
    return sections.filter((section) => String(section.class_id) === filterClass);
  }, [filterClass, sections]);

  const filteredRooms = useMemo(() => {
    if (filterRoom === "all") return rooms;
    const room = rooms.find((row) => String(row.id) === filterRoom);
    return room ? [room] : rooms;
  }, [filterRoom, rooms]);

  const selectedExamTypeLabel = useMemo(() => examTypes.find((item) => String(item.id) === selectedExamType)?.title || "", [examTypes, selectedExamType]);

  const holidayDates = useMemo(() => {
    const list = new Set<string>();
    holidays.forEach((holiday) => {
      const start = parseDate(holiday.start_date);
      const end = parseDate(holiday.end_date || holiday.start_date);
      const cursor = new Date(start);
      while (cursor <= end) {
        list.add(toDateInput(cursor));
        cursor.setDate(cursor.getDate() + 1);
      }
    });
    return list;
  }, [holidays]);

  const roomColorMap = useMemo(() => {
    const map = new Map<number, { start: string; end: string; solid: string }>();
    classes.forEach((item) => map.set(item.id, classColor(item.class_name || item.name || String(item.id))));
    return map;
  }, [classes]);

  const addToast = (type: ToastItem["type"], message: string) => {
    // Map legacy custom toast types to the new toast hook
    if (type === "success") {
      toast.success(message);
      return;
    }
    if (type === "delete") {
      toast.success(message);
      return;
    }
    // preserve small in-page toast stack for special types
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToastStack((prev) => [...prev, { id, type, message }]);
    window.setTimeout(() => {
      setToastStack((prev) => prev.filter((item) => item.id !== id));
    }, 3000);
  };

  const loadStatic = async () => {
    const [indexData, holidayData] = await Promise.all([
      apiGet<{ classes: SchoolClass[]; sections: Section[]; rooms: ClassRoom[]; exam_types: ExamType[]; teachers: Teacher[]; exam_periods: ExamPeriod[] }>(
        "/api/v1/exams/exam-schedule/index/"
      ),
      apiGet<HolidayItem[]>(`/api/v1/exams/holidays/?month=${new Date(selectedDate).getMonth() + 1}&year=${new Date(selectedDate).getFullYear()}`),
    ]);
    setClasses(indexData.classes || []);
    setSections(indexData.sections || []);
    setRooms(indexData.rooms || []);
    setExamTypes(indexData.exam_types || []);
    setTeachers(indexData.teachers || []);
    setPeriods(indexData.exam_periods || []);
    setHolidays(holidayData || []);
  };

  const loadSchedules = async () => {
    if (!selectedExamType || !selectedDate) {
      setSchedules([]);
      return;
    }
    setLoading(true);
    try {
      const params = new URLSearchParams({ exam_type_id: selectedExamType, date: selectedDate });
      if (filterClass !== "all") params.set("class_id", filterClass);
      if (filterSection !== "all") params.set("section_id", filterSection);
      if (filterRoom !== "all") params.set("room_id", filterRoom);
      const data = await apiGet<ScheduleItem[]>(`/api/v1/exams/exam-command-center/?${params.toString()}`);
      setSchedules(data || []);
      setError("");
    } catch (e) {
      setSchedules([]);
      setError(e instanceof Error ? e.message : "Failed to load schedules.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    void loadStatic();
  }, []);

  useEffect(() => {
    void loadSchedules();
  }, [selectedExamType, selectedDate, filterClass, filterSection, filterRoom]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setPopover(null);
        setModal((current) => ({ ...current, open: false }));
      }
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, []);

  useEffect(() => {
    if (!popover) return;
    const handleOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setPopover(null);
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [popover]);

  useEffect(() => {
    if (!modal.open) return;
    const handleOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setModal((current) => ({ ...current, open: false }));
      }
    };
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [modal.open]);

  const refreshHolidayMonth = async (dateValue: string) => {
    try {
      const parsed = new Date(dateValue);
      const data = await apiGet<HolidayItem[]>(`/api/v1/exams/holidays/?month=${parsed.getMonth() + 1}&year=${parsed.getFullYear()}`);
      setHolidays(data || []);
    } catch {
      // keep existing holidays
    }
  };

  const openNewModal = (room: ClassRoom, slot: TimelineGridItem, dateValue: string) => {
    setModal({
      open: true,
      roomId: room.id,
      roomName: room.room_no,
      slotKey: `${room.id}-${slot.start}`,
      timeLabel: slot.label,
      date: dateValue,
      editingSchedule: null,
    });
  };

  const openEditModal = (schedule: ScheduleItem) => {
    const room = rooms.find((item) => item.room_no === schedule.room);
    setModal({
      open: true,
      roomId: room?.id || null,
      roomName: schedule.room,
      slotKey: `${room?.id || 0}-${hourIndexFromTime(schedule.start_time)}`,
      timeLabel: `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`,
      date: schedule.date,
      editingSchedule: schedule,
    });
  };

  const saveModal = async (payload: Record<string, unknown>) => {
    setModalSaving(true);
    try {
      const body = {
        exam_type_id: Number(selectedExamType),
        class_id: payload.class_id,
        section_id: payload.section_id,
        subject_id: payload.subject_id,
        teacher_id: payload.teacher_id,
        room_id: payload.room_id,
        date: payload.date,
        period: payload.period,
        start_time: payload.start_time,
        end_time: payload.end_time,
      };
      if (modal.editingSchedule) {
        await apiRequest<ScheduleItem>(`/api/v1/exams/exam-command-center/${modal.editingSchedule.id}/`, "PUT", body);
        toast.success(`Scheduled: updated ${modal.editingSchedule.class_name} ${modal.editingSchedule.subject}`);
      } else {
        await apiRequest<ScheduleItem>("/api/v1/exams/exam-command-center/", "POST", body);
        toast.success(`Scheduled: ${body.class_id} ${body.subject_id} in ${body.room_id} at ${body.start_time}`);
      }
      setModal((current) => ({ ...current, open: false }));
      await loadSchedules();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Operation failed";
      if (e instanceof Error && e.message.toLowerCase().includes("holiday")) {
        toast.warning(message);
      } else {
        toast.showApiError(e, message);
      }
    } finally {
      setModalSaving(false);
    }
  };

  const deleteSchedule = async (schedule: ScheduleItem) => {
    try {
      await apiRequest(`/api/v1/exams/exam-command-center/${schedule.id}/`, "DELETE");
      toast.success(`Deleted: ${schedule.class_name} ${schedule.subject}`);
      setPopover(null);
      await loadSchedules();
    } catch (e) {
      toast.showApiError(e, "Delete failed");
    }
  };

  const scheduleByRoomAndHour = useMemo(() => {
    const map = new Map<string, ScheduleItem[]>();
    filteredRooms.forEach((room) => {
      timeSlots.forEach((slot) => map.set(`${room.id}-${slot.start}`, []));
    });

    schedules.forEach((schedule) => {
      const room = rooms.find((item) => item.room_no === schedule.room);
      if (!room) return;
      timeSlots.forEach((slot) => {
        if (overlaps(slot.start, schedule.start_time, schedule.end_time)) {
          const key = `${room.id}-${slot.start}`;
          map.set(key, [...(map.get(key) || []), schedule]);
        }
      });
    });

    return map;
  }, [filteredRooms, rooms, schedules, timeSlots]);

  const holidayColumnForSlot = (slotLabel: string) => holidayDates.has(selectedDate);

  const renderPopover = () => {
    if (!popover || !mounted) return null;
    const schedule = popover.schedule;
    return createPortal(
      <div
        ref={popoverRef}
        style={{
          position: "fixed",
          top: Math.max(16, popover.top),
          left: popover.preferLeft ? Math.max(16, popover.left - 320) : popover.left,
          width: 290,
          background: "#fff",
          borderRadius: 16,
          boxShadow: "0 24px 48px -12px rgba(0,0,0,0.2), 0 0 0 1px rgba(0,0,0,0.05)",
          zIndex: 99998,
          padding: 16,
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "start", marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
              {schedule.class_name}: {schedule.subject}
            </div>
            <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 4 }}>{selectedExamTypeLabel}</div>
          </div>
          <button type="button" onClick={() => setPopover(null)} style={{ border: "none", background: "#f1f5f9", borderRadius: 999, width: 30, height: 30, cursor: "pointer" }}>
            <X size={16} />
          </button>
        </div>

        {[
          ["Room", schedule.room],
          ["Time", `${formatTime(schedule.start_time)} - ${formatTime(schedule.end_time)}`],
          ["Period", schedule.period_name || "-"],
          ["Teacher", schedule.teacher || "-"],
          ["Exam Type", schedule.exam_type_name || "-"],
        ].map(([label, value]) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "8px 0", borderBottom: "1px solid #f5f7fa", fontSize: 13 }}>
            <span style={{ color: "#64748b", fontWeight: 600 }}>{label}</span>
            <span style={{ color: "#0f172a", fontWeight: 700, textAlign: "right" }}>{value}</span>
          </div>
        ))}

        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
          <button type="button" onClick={() => openEditModal(schedule)} style={{ flex: 1, height: 36, border: "none", borderRadius: 10, background: "#eef2ff", color: "#4f46e5", fontWeight: 700, cursor: "pointer" }}>
            <Edit3 size={14} style={{ display: "inline", marginRight: 6 }} /> Edit
          </button>
          <button type="button" onClick={() => void deleteSchedule(schedule)} style={{ flex: 1, height: 36, border: "none", borderRadius: 10, background: "#fef2f2", color: "#dc2626", fontWeight: 700, cursor: "pointer" }}>
            <Trash2 size={14} style={{ display: "inline", marginRight: 6 }} /> Delete
          </button>
          <button type="button" onClick={() => setPopover(null)} style={{ width: 48, height: 36, border: "none", borderRadius: 10, background: "#f1f5f9", color: "#64748b", fontWeight: 700, cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      </div>,
      document.body
    );
  };

  const renderModal = () => {
    if (!modal.open || !mounted) return null;

    return createPortal(
      <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", backdropFilter: "blur(6px)", zIndex: 99997, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
        <div
          ref={modalRef}
          style={{
            width: 440,
            maxWidth: "100%",
            borderRadius: 20,
            background: "#fff",
            boxShadow: "0 32px 64px -12px rgba(0,0,0,0.3)",
            overflow: "hidden",
          }}
        >
          <div style={{ height: 3, background: "linear-gradient(90deg, #3b82f6 0%, #6366f1 35%, #8b5cf6 65%, #a855f7 100%)" }} />
          <div style={{ padding: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
              <div>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a" }}>{modal.editingSchedule ? "Edit Schedule" : "Schedule New Exam"}</div>
                <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 13 }}>
                  Room: {modal.roomName} | Time: {modal.timeLabel}
                </div>
              </div>
              <button type="button" onClick={() => setModal((current) => ({ ...current, open: false }))} style={{ border: "none", background: "#f1f5f9", width: 32, height: 32, borderRadius: 10, cursor: "pointer" }}>
                <X size={16} />
              </button>
            </div>

            <ScheduleForm
              classId={modal.editingSchedule ? String(modal.editingSchedule.class_id) : filterClass !== "all" ? filterClass : ""}
              setClassId={setFilterClass}
              sectionId={modal.editingSchedule ? String(modal.editingSchedule.section_id || "") : filterSection !== "all" ? filterSection : ""}
              setSectionId={setFilterSection}
              subjectId={modal.editingSchedule ? String(modal.editingSchedule.subject_id) : ""}
              teacherId={modal.editingSchedule ? String(modal.editingSchedule.teacher_id || "") : ""}
              date={modal.editingSchedule?.date || modal.date}
              startTime={formatTime(modal.editingSchedule?.start_time || modal.timeLabel.split(" - ")[0] || "08:00")}
              endTime={formatTime(modal.editingSchedule?.end_time || modal.timeLabel.split(" - ")[1] || "09:00")}
              periodId={modal.editingSchedule ? String(modal.editingSchedule.period || "") : ""}
              rooms={rooms}
              classes={classes}
              sections={sections}
              teachers={teachers}
              periods={periods}
              selectedRoomId={modal.roomId}
              onSave={saveModal}
              loading={modalSaving}
              onClose={() => setModal((current) => ({ ...current, open: false }))}
            />
          </div>
        </div>
      </div>,
      document.body
    );
  };

  const roomRows = filteredRooms;

  return (
    <div className="legacy-panel" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <div className="max-w-[1600px] mx-auto px-4 py-4 sm:px-6 lg:px-8">
        <section
          style={{
            borderRadius: 16,
            background: "#fff",
            boxShadow: cardShadow(),
            border: "1px solid rgba(0,0,0,0.06)",
            overflow: "hidden",
            marginBottom: 16,
          }}
        >
          <div style={{ height: 4, background: "linear-gradient(90deg, #3b82f6 0%, #6366f1 35%, #8b5cf6 65%, #a855f7 100%)" }} />
          <div style={{ padding: "20px 24px 12px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px" }}>Exam Master Command Center</h2>
                <div style={{ marginTop: 6, fontSize: 13, color: "#94a3b8" }}>Room-based scheduling with conflict detection</div>
              </div>
              <div style={{ display: "flex", gap: 8, color: "#94a3b8", fontSize: 13 }}>
                <span>Dashboard</span><span>/</span><span>Examinations</span><span>/</span><span>Exam Master Command Center</span>
              </div>
            </div>
          </div>

          <div style={{ padding: "16px 24px", background: "#fafbfd", borderTop: "1px solid #f1f5f9", borderBottom: "1px solid #f1f5f9" }}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              <ControlGroup label="Exam Type">
                <select value={selectedExamType} onChange={(e) => setSelectedExamType(e.target.value)} style={fieldStyle()}>
                  <option value="">Select exam type</option>
                  {examTypes.map((item) => (
                    <option key={item.id} value={item.id}>{item.title}</option>
                  ))}
                </select>
              </ControlGroup>
              <ControlGroup label="Schedule Date">
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    void refreshHolidayMonth(e.target.value);
                  }}
                  style={fieldStyle()}
                />
              </ControlGroup>
              <ControlGroup label="Class" grow>
                <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={fieldStyle()}>
                  <option value="all">All Classes</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.class_name || item.name || `Class ${item.id}`}</option>
                  ))}
                </select>
              </ControlGroup>
              <ControlGroup label="Section" narrow>
                <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} style={fieldStyle()}>
                  <option value="all">All</option>
                  {filteredSections.map((item) => (
                    <option key={item.id} value={item.id}>{item.section_name || item.name || `Section ${item.id}`}</option>
                  ))}
                </select>
              </ControlGroup>
              <ControlGroup label="Room" grow>
                <select value={filterRoom} onChange={(e) => setFilterRoom(e.target.value)} style={fieldStyle()}>
                  <option value="all">All Rooms</option>
                  {rooms.map((item) => (
                    <option key={item.id} value={item.id}>{item.room_no}</option>
                  ))}
                </select>
              </ControlGroup>
            </div>
          </div>

          <div style={{ padding: "12px 24px", display: "flex", flexWrap: "wrap", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.8, textTransform: "uppercase" }}>Color Index:</span>
            {classes.map((item) => {
              const palette = greyLegendColor(item.class_name || item.name || String(item.id));
              return (
                <span key={item.id} style={{ display: "inline-flex", alignItems: "center", gap: 6, borderRadius: 999, border: `1px solid ${palette.border}`, background: palette.chip, padding: "4px 10px", fontSize: 10.5, fontWeight: 700, color: palette.text }}>
                  <span style={{ width: 7, height: 7, borderRadius: 999, background: palette.symbol, display: "inline-block" }} />
                  {item.class_name || item.name || `Class ${item.id}`}
                </span>
              );
            })}
          </div>
        </section>

        <section
          style={{
            borderRadius: 16,
            background: "#fff",
            boxShadow: cardShadow(),
            border: "1px solid rgba(0,0,0,0.06)",
            overflow: "hidden",
          }}
        >
          <div style={{ overflowX: "auto" }} ref={gridRef}>
            <div style={{ minWidth: 1100, display: "grid", gridTemplateColumns: "130px repeat(9, minmax(105px, 1fr))" }}>
              <div style={{ padding: 14, background: "#f8fafc", borderBottom: "2px solid #e9eef5", borderRight: "2px solid #eef2f7", fontSize: 12, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1, color: "#475569" }}>Room</div>
              {timeSlots.map((slot) => (
                <div key={slot.label} style={{ position: "relative", padding: 14, background: "#f8fafc", borderBottom: "2px solid #e9eef5", textAlign: "center", fontSize: 11, fontWeight: 700, color: currentHour === slot.start ? "#6366f1" : "#64748b" }}>
                  {slot.label}
                  {currentHour === slot.start && <div style={{ position: "absolute", left: "50%", bottom: 0, width: 20, height: 3, borderRadius: 999, transform: "translateX(-50%)", background: "#6366f1" }} />}
                </div>
              ))}

              {roomRows.map((room) => {
                const isFilteredRoom = filterRoom !== "all" && String(room.id) === filterRoom;
                return (
                  <div key={room.id} style={{ display: "contents" }}>
                    <div style={{ minHeight: 78, padding: 12, borderRight: "2px solid #eef2f7", borderBottom: "1px solid #f1f5f9", background: "#fcfcfd" }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>{room.room_no}</div>
                      <div style={{ fontSize: 10, color: "#a0aec0", marginTop: 3 }}>{roomSubtitle(room.room_no)}</div>
                    </div>
                    {timeSlots.map((slot) => {
                      const cellSchedules = scheduleByRoomAndHour.get(`${room.id}-${slot.start}`) || [];
                      const isHoliday = holidayColumnForSlot(slot.label);
                      const isClassFocusMode = filterClass !== "all";
                      const hasClassSchedule = cellSchedules.some((schedule) => String(schedule.class_id) === filterClass);
                      const showEmptyFocus = !isHoliday && cellSchedules.length === 0 && isClassFocusMode;
                      return (
                        <div
                          key={`${room.id}-${slot.start}`}
                          onClick={() => {
                            if (isHoliday || !selectedExamType) return;
                            if (cellSchedules.length === 0) {
                              openNewModal(room, slot, selectedDate);
                            }
                          }}
                          style={{
                            position: "relative",
                            minHeight: 78,
                            padding: 8,
                            borderBottom: "1px solid #f1f5f9",
                            borderLeft: "1px solid #f8fafc",
                            background: isHoliday ? "repeating-linear-gradient(135deg, rgba(226,232,240,0.8) 0, rgba(226,232,240,0.8) 8px, rgba(241,245,249,0.9) 8px, rgba(241,245,249,0.9) 16px)" : "#fff",
                            cursor: isHoliday ? "not-allowed" : cellSchedules.length === 0 ? "pointer" : "default",
                            opacity: isClassFocusMode && !hasClassSchedule ? 0.32 : 1,
                            boxShadow: isClassFocusMode && hasClassSchedule ? "inset 0 0 0 1px rgba(99,102,241,0.4), 0 0 0 2px rgba(99,102,241,0.15)" : "none",
                            outline: showEmptyFocus ? "1px solid rgba(148,163,184,0.22)" : "none",
                            backgroundColor:
                              showEmptyFocus
                                ? "rgba(241,245,249,0.96)"
                                : isHoliday
                                  ? "transparent"
                                  : "#fff",
                            transition: "all 180ms ease",
                          }}
                        >
                          {!isHoliday && cellSchedules.length === 0 && selectedExamType && (
                            <div style={{ height: "100%", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 4 }}>
                              <div
                                style={{
                                  width: 38,
                                  height: 38,
                                  borderRadius: 999,
                                  border: filterClass !== "all" ? "2px dashed #94a3b8" : "2px dashed #cbd5e1",
                                  color: filterClass !== "all" ? "#64748b" : "#94a3b8",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: 900,
                                  fontSize: 20,
                                  lineHeight: 1,
                                  background: filterClass !== "all" ? "rgba(226,232,240,1)" : "#f8fafc",
                                  boxShadow: filterClass !== "all" ? "0 0 0 4px rgba(148,163,184,0.14)" : "none",
                                }}
                                title={filterClass !== "all" ? "Add exam in selected class" : "Select a class to add"}
                              >
                                +
                              </div>
                              {filterClass !== "all" && (
                                <span style={{ fontSize: 10, fontWeight: 700, color: "#94a3b8", letterSpacing: 0.4 }}>Add</span>
                              )}
                            </div>
                          )}
                          {isHoliday && <div style={{ fontSize: 10, color: "#64748b", fontWeight: 700 }}>Holiday</div>}
                          {!isHoliday && cellSchedules.length > 0 && (
                            <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                              {cellSchedules.map((schedule) => {
                                const palette = roomColorMap.get(schedule.class_id) || classColor(schedule.class_name);
                                const isClassMatch = filterClass === "all" || String(schedule.class_id) === filterClass;
                                return (
                                  <div
                                    key={schedule.id}
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      const rect = (event.currentTarget as HTMLDivElement).getBoundingClientRect();
                                      setPopover({
                                        schedule,
                                        top: rect.top,
                                        left: rect.right + 12,
                                        preferLeft: rect.right > window.innerWidth - 340,
                                      });
                                    }}
                                    style={{
                                      position: "relative",
                                      borderRadius: 10,
                                      padding: "10px 12px",
                                      background: `linear-gradient(135deg, ${palette.start}, ${palette.end})`,
                                      borderLeft: `3.5px solid ${palette.solid}`,
                                      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                                      backdropFilter: "blur(12px)",
                                      minHeight: 52,
                                      cursor: "pointer",
                                      transform: "translateY(0)",
                                      transition: "all 180ms ease",
                                      opacity: isClassMatch ? 1 : 0.6,
                                    }}
                                    onMouseEnter={(event) => {
                                      (event.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                                      (event.currentTarget as HTMLDivElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
                                    }}
                                    onMouseLeave={(event) => {
                                      (event.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                                      (event.currentTarget as HTMLDivElement).style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)";
                                    }}
                                  >
                                    <div style={{ position: "absolute", right: 8, top: 8, fontSize: 8, background: "rgba(255,255,255,0.65)", borderRadius: 5, padding: "2px 5px", color: "#475569", fontWeight: 700 }}>
                                      {formatTime(schedule.start_time)}
                                    </div>
                                    <div style={{ fontSize: 11.5, fontWeight: 700, color: "#0f172a", lineHeight: 1.25, paddingRight: 42, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                                      {schedule.class_name} - {schedule.subject}
                                    </div>
                                    <div style={{ marginTop: 4, fontSize: 10, color: "#334155" }}>
                                      Period {schedule.period_name || "-"} • {formatTime(schedule.start_time)}–{formatTime(schedule.end_time)}
                                    </div>
                                    <div style={{ marginTop: 2, fontSize: 10, color: "#64748b" }}>{schedule.teacher || ""}</div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
          {loading && <div style={{ padding: 16, color: "#64748b", fontSize: 13 }}>Loading schedules...</div>}
        </section>

        {error && <div style={{ marginTop: 12, color: "#b91c1c", fontSize: 13 }}>{error}</div>}
      </div>
      {renderPopover()}
      {renderModal()}
      <ToastContainer toasts={toastStack} />
    </div>
  );
}

function ControlGroup({ label, children, grow, narrow }: { label: string; children: React.ReactNode; grow?: boolean; narrow?: boolean }) {
  return (
    <div style={{ flex: narrow ? "0 0 92px" : grow ? "1 1 180px" : "0 0 180px", minWidth: narrow ? 92 : 160 }}>
      <label style={labelStyle()}>{label}</label>
      {children}
    </div>
  );
}

function ScheduleForm({
  classId,
  setClassId,
  sectionId,
  setSectionId,
  subjectId,
  teacherId,
  date,
  startTime,
  endTime,
  periodId,
  rooms,
  classes,
  sections,
  teachers,
  periods,
  selectedRoomId,
  onSave,
  loading,
  onClose,
}: {
  classId: string;
  setClassId: (value: string) => void;
  sectionId: string;
  setSectionId: (value: string) => void;
  subjectId: string;
  teacherId: string;
  date: string;
  startTime: string;
  endTime: string;
  periodId: string;
  rooms: ClassRoom[];
  classes: SchoolClass[];
  sections: Section[];
  teachers: Teacher[];
  periods: ExamPeriod[];
  selectedRoomId: number | null;
  onSave: (payload: Record<string, unknown>) => Promise<void>;
  loading: boolean;
  onClose: () => void;
}) {
  const [subjectOptions, setSubjectOptions] = useState<Subject[]>([]);
  const [classValue, setClassValue] = useState(classId);
  const [sectionValue, setSectionValue] = useState(sectionId);
  const [subjectValue, setSubjectValue] = useState(subjectId);
  const [teacherValue, setTeacherValue] = useState(teacherId);
  const [periodValue, setPeriodValue] = useState(periodId);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    setClassValue(classId);
    setSectionValue(sectionId);
    setSubjectValue(subjectId);
    setTeacherValue(teacherId);
    setPeriodValue(periodId);
  }, [classId, sectionId, subjectId, teacherId, periodId]);

  useEffect(() => {
    const loadSubjects = async () => {
      if (!classValue) {
        setSubjectOptions([]);
        return;
      }
      try {
        const data = await apiGet<{ subjects?: Subject[] } | Subject[]>(`/api/v1/exams/exam-setup/subjects/?class_id=${classValue}`);
        if (Array.isArray(data)) {
          setSubjectOptions(data);
        } else {
          setSubjectOptions(data.subjects || []);
        }
      } catch {
        setSubjectOptions([]);
      }
    };
    void loadSubjects();
  }, [classValue]);

  const filteredSections = useMemo(() => {
    if (!classValue) return [];
    return sections.filter((item) => String(item.class_id) === classValue);
  }, [classValue, sections]);

  const handleSave = async () => {
    if (!classValue || !sectionValue || !subjectValue || !teacherValue) {
      setFormError("Class, section, subject and teacher are required.");
      return;
    }
    const selectedRoom = selectedRoomId ? rooms.find((item) => item.id === selectedRoomId) : null;
    await onSave({
      class_id: Number(classValue),
      section_id: sectionValue ? Number(sectionValue) : null,
      subject_id: Number(subjectValue),
      teacher_id: Number(teacherValue),
      room_id: selectedRoom?.id || null,
      date,
      period: periodValue ? Number(periodValue) : null,
      start_time: `${startTime}:00`,
      end_time: `${endTime}:00`,
    });
  };

  return (
    <div style={{ marginTop: 16, display: "grid", gap: 12 }}>
      {formError && <div style={{ color: "#b91c1c", fontSize: 13 }}>{formError}</div>}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle()}>Class</label>
          <select value={classValue} onChange={(e) => setClassValue(e.target.value)} style={fieldStyle()}>
            <option value="">Select class</option>
            {classes.map((item) => <option key={item.id} value={item.id}>{item.class_name || item.name || `Class ${item.id}`}</option>)}
          </select>
        </div>
        <div>
          <label style={labelStyle()}>Section</label>
          <select value={sectionValue} onChange={(e) => setSectionValue(e.target.value)} style={fieldStyle()}>
            <option value="">Select section</option>
            {filteredSections.map((item) => <option key={item.id} value={item.id}>{item.section_name || item.name || `Section ${item.id}`}</option>)}
          </select>
        </div>
      </div>
      <div>
        <label style={labelStyle()}>Subject</label>
        <select value={subjectValue} onChange={(e) => setSubjectValue(e.target.value)} style={fieldStyle()}>
          <option value="">Select subject</option>
          {subjectOptions.map((item) => <option key={item.id} value={item.id}>{item.subject_name || item.name || `Subject ${item.id}`}</option>)}
        </select>
      </div>
      <div>
        <label style={labelStyle()}>Teacher</label>
        <select value={teacherValue} onChange={(e) => setTeacherValue(e.target.value)} style={fieldStyle()}>
          <option value="">Select teacher</option>
          {teachers.map((item) => <option key={item.id} value={item.id}>{item.full_name}</option>)}
        </select>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
        <div>
          <label style={labelStyle()}>Start Time</label>
          <input value={startTime} readOnly style={{ ...fieldStyle(), background: "#f8fafc" }} />
        </div>
        <div>
          <label style={labelStyle()}>End Time</label>
          <input value={endTime} readOnly style={{ ...fieldStyle(), background: "#f8fafc" }} />
        </div>
      </div>
      <div>
        <label style={labelStyle()}>Period</label>
        <select value={periodValue} onChange={(e) => setPeriodValue(e.target.value)} style={fieldStyle()}>
          <option value="">Select period</option>
          {periods.map((item) => <option key={item.id} value={item.id}>{item.period}</option>)}
        </select>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 4 }}>
        <button type="button" onClick={onClose} style={{ height: 38, border: "1px solid #cbd5e1", background: "#f1f5f9", color: "#64748b", borderRadius: 10, padding: "0 14px", cursor: "pointer", fontWeight: 700 }}>
          Cancel
        </button>
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={loading}
          style={{
            height: 38,
            border: "none",
            background: "linear-gradient(90deg, #3b82f6, #6366f1)",
            color: "#fff",
            borderRadius: 10,
            padding: "0 14px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: 700,
            boxShadow: "0 4px 12px rgba(99,102,241,0.3)",
          }}
        >
          {loading ? "Saving..." : "Schedule Exam"}
        </button>
      </div>
    </div>
  );
}

function ToastContainer({ toasts }: { toasts: ToastItem[] }) {
  return createPortal(
    <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 99999, display: "grid", gap: 10 }}>
      {toasts.map((toast) => (
        <div key={toast.id} style={{ background: "linear-gradient(135deg, #1e293b, #334155)", color: "#fff", borderRadius: 12, padding: "14px 22px", fontSize: 13, fontWeight: 600, boxShadow: "0 12px 40px rgba(0,0,0,0.25)", minWidth: 260 }}>
          {toastIcon(toast.type)} {toast.message}
        </div>
      ))}
    </div>,
    document.body
  );
}
