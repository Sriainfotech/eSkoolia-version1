"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { Toast } from "../types";
import ConfirmDeleteDialog from "../ConfirmDeleteDialog";

interface Props {
  showToast: (msg: string, tone?: Toast["tone"]) => void;
  onBack: () => void;
  onNext?: () => void;
}

interface Room {
  id: number;
  room_no: string;
  floor: string;
  capacity: number;
  section: number | null;
  section_label: string;
  active_status: boolean;
  created_at?: string;
}

interface RoomResponse { success: boolean; data: Room; }

interface SchoolClass { id: number; name: string }
interface Section { id: number; name: string; school_class: number }

function parseError(err: unknown): string {
  if (!(err instanceof Error)) return "Failed to save.";
  try {
    const body = JSON.parse(err.message) as { message?: string; errors?: Record<string, unknown> };
    if (body.errors) {
      const msgs = Object.values(body.errors).flatMap((v) => (Array.isArray(v) ? v : [v]));
      return (msgs.join(" ") || body.message) ?? "Failed to save.";
    }
    return body.message ?? err.message;
  } catch { return err.message; }
}

const API           = "/api/v1/core/class-rooms/";
const CLASSES_API   = "/api/v1/core/classes/?page_size=200";
const SECTIONS_API  = "/api/v1/core/sections/?page_size=500";

export default function RoomsPane({ showToast, onBack, onNext }: Props) {
  const [rooms, setRooms]         = useState<Room[]>([]);
  const [classes, setClasses]     = useState<SchoolClass[]>([]);
  const [sections, setSections]   = useState<Section[]>([]);
  const [loading, setLoading]     = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [roomNo, setRoomNo]       = useState("");
  const [floor, setFloor]         = useState("");
  const [capacity, setCapacity]   = useState("35");
  const [classId, setClassId]     = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState("");

  const [deletingId, setDelId]    = useState<number | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Room | null>(null);
  const [togglingId, setTogId]    = useState<number | null>(null);
  const roomNoRef                  = useRef<HTMLInputElement>(null);

  useEffect(() => { void bootstrap(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function bootstrap() {
    setLoading(true);
    try {
      const [roomsRes, classesRes, sectionsRes] = await Promise.all([
        apiRequestWithRefresh<{ results?: Room[] } | Room[]>(`${API}?page_size=200`),
        apiRequestWithRefresh<{ results?: SchoolClass[] } | SchoolClass[]>(CLASSES_API),
        apiRequestWithRefresh<{ results?: Section[] } | Section[]>(SECTIONS_API),
      ]);
      setRooms(Array.isArray(roomsRes) ? roomsRes : (roomsRes.results ?? []));
      setClasses(Array.isArray(classesRes) ? classesRes : (classesRes.results ?? []));
      setSections(Array.isArray(sectionsRes) ? sectionsRes : (sectionsRes.results ?? []));
    } catch {
      setRooms([]); setClasses([]); setSections([]);
    } finally { setLoading(false); }
  }

  async function refreshRooms() {
    try {
      const res = await apiRequestWithRefresh<{ results?: Room[] } | Room[]>(`${API}?page_size=200`);
      setRooms(Array.isArray(res) ? res : (res.results ?? []));
    } catch { /* ignore */ }
  }

  const classNameById = useMemo(() => {
    const m = new Map<number, string>();
    classes.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [classes]);

  // Classes that actually have at least one section available
  const availableClasses = useMemo(() => {
    const classIdsWithSections = new Set(sections.map((s) => s.school_class));
    return classes.filter((c) => classIdsWithSections.has(c.id));
  }, [classes, sections]);

  // Sections that belong to the currently selected class
  const filteredSections = useMemo(() => {
    if (!classId) return [] as Section[];
    const cid = parseInt(classId);
    return sections.filter((s) => s.school_class === cid);
  }, [sections, classId]);

  function handleClassChange(value: string) {
    setClassId(value);
    setSectionId(""); // reset section whenever class changes
  }

  function openEdit(r: Room) {
    setEditingId(r.id);
    setRoomNo(r.room_no);
    setFloor(r.floor ?? "");
    setCapacity(String(r.capacity ?? 35));
    if (r.section) {
      const sec = sections.find((s) => s.id === r.section);
      setClassId(sec ? String(sec.school_class) : "");
      setSectionId(String(r.section));
    } else {
      setClassId("");
      setSectionId("");
    }
    setError("");
    roomNoRef.current?.focus();
  }

  function cancelEdit() {
    setEditingId(null); setRoomNo(""); setFloor(""); setCapacity("35");
    setClassId(""); setSectionId(""); setError("");
    roomNoRef.current?.focus();
  }

  function validateRoomNo(value: string): string {
    const trimmed = value.trim().toUpperCase();
    if (!trimmed) return "";
    if (trimmed.length > 10) return "Room number must be 10 characters or less.";
    if (!/^[A-Z0-9][A-Z0-9\- ]{0,9}$/.test(trimmed)) {
      return "Room number can use letters, numbers, spaces and hyphens only.";
    }
    if (trimmed.length >= 2 && /^(.)\1+$/.test(trimmed.replace(/[\- ]/g, ""))) {
      return "Please don't use the same character repeated — enter a real room number like 101 or A-12.";
    }
    return "";
  }

  function onRoomNoChange(value: string) {
    const sliced = value.slice(0, 10);
    setRoomNo(sliced);
    const msg = validateRoomNo(sliced);
    setError(msg);
  }

  async function save() {
    const trimmed = roomNo.trim().toUpperCase();
    if (!trimmed) { setError("Room number is required."); return; }
    const liveErr = validateRoomNo(trimmed);
    if (liveErr) { setError(liveErr); return; }
    // Fix #5D — removed forced digit guard; rooms like LAB, OFFICE, LIBRARY are valid without digits
    const cap = parseInt(capacity);
    if (!cap || cap <= 0) { setError("Capacity must be a positive number."); return; }
    if (cap > 200) { setError("Capacity must not exceed 200."); return; }
    if (floor.trim().length > 64) { setError("Floor / Block must be 64 characters or less."); return; }
    setSaving(true); setError("");
    const payload = {
      room_no: trimmed,
      floor: floor.trim(),
      capacity: cap,
      section: sectionId ? parseInt(sectionId) : null,
    };
    try {
      if (editingId !== null) {
        const resp = await apiRequestWithRefresh<RoomResponse>(`${API}${editingId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setRooms((prev) => prev.map((r) => (r.id === editingId ? resp.data : r)));
        showToast(`Room "${trimmed}" updated.`);
        cancelEdit();
      } else {
        const resp = await apiRequestWithRefresh<RoomResponse>(API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setRooms((prev) => [...prev, resp.data]);
        showToast(`Room "${trimmed}" added.`);
        setRoomNo(""); setFloor(""); setCapacity("35"); setClassId(""); setSectionId("");
        roomNoRef.current?.focus();
      }
    } catch (err: unknown) {
      const msg = parseError(err);
      setError(msg);
      showToast(msg, "error");
      // If the backend says the room already exists but it's not in our
      // local list, refresh from server so the user can see/manage the
      // conflicting row instead of being stuck.
      if (/already exists/i.test(msg)) {
        void refreshRooms();
      }
    } finally { setSaving(false); }
  }

  async function deleteRoom(r: Room) {
    setPendingDelete(r);
  }

  async function confirmDeleteRoom() {
    const r = pendingDelete;
    if (!r) return;
    setDelId(r.id);
    try {
      await apiRequestWithRefresh(`${API}${r.id}/`, { method: "DELETE" });
      setRooms((prev) => prev.filter((x) => x.id !== r.id));
      showToast(`Room "${r.room_no}" removed.`);
      setPendingDelete(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      if (/\b404\b|not[_ ]?found/i.test(msg)) {
        showToast("This room no longer exists. Refreshing the list\u2026", "error");
        setRooms((prev) => prev.filter((x) => x.id !== r.id));
        setPendingDelete(null);
      } else {
        showToast(parseError(err), "error");
      }
    }
    finally { setDelId(null); }
  }

  async function toggleActive(r: Room) {
    setTogId(r.id);
    try {
      const resp = await apiRequestWithRefresh<RoomResponse>(`${API}${r.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active_status: !r.active_status }),
      });
      setRooms((prev) => prev.map((x) => (x.id === r.id ? resp.data : x)));
      showToast(resp.data.active_status ? "Room activated." : "Room deactivated.");
    } catch (err: unknown) { showToast(parseError(err), "error"); }
    finally { setTogId(null); }
  }

  const isEditing   = editingId !== null;
  const canComplete = rooms.length > 0;

  return (
    <div className="flex flex-col gap-3">
      {/* Status / completion bar */}
      <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] px-4 py-2.5 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-[3px] rounded-full bg-[#EEF0FF] text-[#5B4FCF] text-[10px] font-bold uppercase tracking-wide">Final Step</span>
          <span className="text-[12px] font-semibold text-[#1A1D1F]">Set Up Classrooms</span>
          <span className="text-[11px] text-[#9FA6AD]">Add physical rooms to finish onboarding.</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {rooms.length > 0 && !loading && (
            <span className="flex items-center gap-1 text-[11px] font-semibold text-[#22C55E]">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
              {rooms.length} room{rooms.length !== 1 ? "s" : ""} added
            </span>
          )}
          <button
            onClick={canComplete ? () => onNext?.() : undefined}
            disabled={!canComplete}
            title={!canComplete ? "Add at least one room to complete setup" : "Finish onboarding"}
            className={["flex items-center gap-1.5 px-3.5 py-[6px] rounded-[9px] text-[12px] font-bold transition-all", canComplete ? "bg-[#22C55E] text-white hover:bg-[#15803D] shadow-sm" : "bg-[#F0F2F5] text-[#9FA6AD] cursor-not-allowed"].join(" ")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            Complete Setup
          </button>
        </div>
      </div>

      {/* Main 2-column */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Left: Add / Edit form */}
        <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-4">
          <div className="mb-2.5">
            <div className="text-[13px] font-bold text-[#1A1D1F]">{isEditing ? "Edit Room" : "Add Classroom"}</div>
            <div className="text-[11px] text-[#9FA6AD] mt-0.5">
              {isEditing ? `Editing "${rooms.find((r) => r.id === editingId)?.room_no ?? ""}"` : "Enter room details, then click Add Room."}
            </div>
          </div>

          <div className="mb-2.5">
            <label className="text-[10px] font-semibold text-[#6F767E] uppercase tracking-wide block mb-1">Room Number <span className="text-[#EF4444]">*</span></label>
            <input ref={roomNoRef} value={roomNo} maxLength={10}
              onChange={(e) => onRoomNoChange(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
              placeholder="e.g. 101, A-02, LAB1"
              className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[9px] px-2.5 py-[6px] text-[12px] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors" />
            <p className="text-[10px] text-[#9FA6AD] mt-0.5">Letters, numbers, hyphens — saved as UPPERCASE. Max 10 chars.</p> {/* Fix #5D */}
          </div>

          <div className="mb-2.5">
            <label className="text-[10px] font-semibold text-[#6F767E] uppercase tracking-wide block mb-1">Floor / Block</label>
            <input value={floor} maxLength={64}
              onChange={(e) => setFloor(e.target.value.slice(0, 64))}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
              placeholder="e.g. Ground, First, Block A"
              className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[9px] px-2.5 py-[6px] text-[12px] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors" />
          </div>

          <div className="mb-2.5">
            <label className="text-[10px] font-semibold text-[#6F767E] uppercase tracking-wide block mb-1">Capacity <span className="text-[#EF4444]">*</span></label>
            <input type="number" min={1} max={200} value={capacity} onChange={(e) => setCapacity(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") void save(); }}
              className="w-full bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[9px] px-2.5 py-[6px] text-[12px] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors" />
            <p className="text-[10px] text-[#9FA6AD] mt-0.5">Max 200 students per room.</p>
          </div>

          <div className="mb-2.5">
            <label className="text-[10px] font-semibold text-[#6F767E] uppercase tracking-wide block mb-1">Assign to Section</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <select
                value={classId}
                onChange={(e) => handleClassChange(e.target.value)}
                aria-label="Select class"
                className="w-full h-[30px] bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[9px] px-2 text-[12px] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors"
              >
                <option value="">Select Class</option>
                {availableClasses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                disabled={!classId}
                aria-label="Select section"
                className="w-full h-[30px] bg-[#F0F2F5] border-[1.5px] border-[#E8ECEF] rounded-[9px] px-2 text-[12px] outline-none focus:border-[#5B4FCF] focus:bg-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <option value="">{classId ? "Select Section" : "Select class first"}</option>
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            {/* Fix #5E — show helper when no sections exist yet */}
            {availableClasses.length === 0 ? (
              <p className="text-[10px] text-[#F59E0B] mt-1">No sections found. Add sections in Step 3 first.</p>
            ) : (
              <p className="text-[10px] text-[#9FA6AD] mt-1">Optional — pick a class, then a section.</p>
            )}
          </div>

          {error && <p className="text-[11px] text-[#B91C1C] bg-[#FEE2E2] border border-[#FCA5A5] rounded-[8px] px-2.5 py-1.5 mb-2.5">{error}</p>}

          <div className="flex gap-2 flex-wrap">
            <button onClick={onBack} className="px-3 py-[6px] rounded-[9px] border border-[#E8ECEF] text-[12px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors">Back</button>
            {isEditing && <button onClick={cancelEdit} className="px-3 py-[6px] rounded-[9px] border border-[#E8ECEF] text-[12px] text-[#6F767E] hover:bg-[#F0F2F5] transition-colors">Cancel</button>}
            <button onClick={() => void save()} disabled={saving}
              className="flex items-center gap-1 px-3.5 py-[6px] rounded-[9px] bg-[#5B4FCF] text-white text-[12px] font-semibold hover:bg-[#4A3FBF] disabled:opacity-50 transition-colors">
              {saving ? (isEditing ? "Saving..." : "Adding...") : (isEditing ? "Save Changes" : "+ Add Room")}
            </button>
          </div>

          {!loading && rooms.length === 0 && !isEditing && (
            <div className="mt-3 flex items-start gap-2 bg-[#EEF0FF] border border-[#C7C2F0] rounded-[9px] px-3 py-2">
              <svg className="text-[#5B4FCF] flex-shrink-0 mt-0.5" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <p className="text-[11px] text-[#5B4FCF]">Add at least one room to enable <strong>Complete Setup</strong>.</p>
            </div>
          )}
        </div>

        {/* Right: Room Assignments table */}
        <div className="bg-white rounded-xl border border-[#E8ECEF] shadow-[0_1px_4px_rgba(0,0,0,.08)] p-4 flex flex-col">
          <div className="flex items-center justify-between mb-2.5">
            <div className="text-[13px] font-bold text-[#1A1D1F]">Room Assignments</div>
            {rooms.length > 0 && !loading && (
              <span className="text-[11px] text-[#9FA6AD]">
                {rooms.filter((r) => r.active_status).length} active
                {rooms.some((r) => !r.active_status) && ` · ${rooms.filter((r) => !r.active_status).length} inactive`}
              </span>
            )}
          </div>

          {loading ? (
            <div className="space-y-1.5">{[1,2,3].map((i) => <div key={i} className="h-9 rounded-[8px] bg-[#F0F2F5] animate-pulse" />)}</div>
          ) : rooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-44 text-center">
              <div className="w-12 h-12 rounded-full bg-[#F0F2F5] flex items-center justify-center mb-3">
                <svg className="text-[#9FA6AD]" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
              </div>
              <p className="text-[12px] font-semibold text-[#6F767E]">No rooms yet</p>
              <p className="text-[11px] text-[#9FA6AD] mt-0.5">Rooms appear here as you add them.</p>
            </div>
          ) : (
            <div className="overflow-y-auto max-h-[420px] -mx-1 px-1">
              <table className="w-full text-[12px]">
                <thead>
                  <tr className="text-[10px] font-bold text-[#6F767E] uppercase tracking-wide border-b border-[#E8ECEF]">
                    <th className="text-left py-1.5 px-2">Room</th>
                    <th className="text-left py-1.5 px-2">Floor</th>
                    <th className="text-left py-1.5 px-2">Cap</th>
                    <th className="text-left py-1.5 px-2">Section</th>
                    <th className="text-right py-1.5 px-2 w-[110px]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rooms.map((r) => {
                    const inactive = !r.active_status;
                    return (
                      <tr key={r.id}
                        className={[
                          "border-b border-[#F0F2F5] last:border-b-0 group transition-colors",
                          editingId === r.id ? "bg-[#EEF0FF]" : "hover:bg-[#FAFBFC]",
                          inactive ? "opacity-60" : "",
                        ].join(" ")}>
                        <td className="py-2 px-2">
                          <span className={["font-bold text-[#1A1D1F]", inactive ? "line-through" : ""].join(" ")}>{r.room_no}</span>
                          {inactive && (
                            <span className="ml-1.5 px-1.5 py-[1px] rounded-[4px] bg-[#FEE2E2] text-[#B91C1C] text-[9px] font-bold uppercase tracking-wide">Inactive</span>
                          )}
                        </td>
                        <td className="py-2 px-2 text-[#6F767E]">{r.floor || <span className="text-[#C7CDD4]">—</span>}</td>
                        <td className="py-2 px-2 text-[#6F767E]">{r.capacity}</td>
                        <td className="py-2 px-2 text-[#6F767E]">{r.section_label || <span className="text-[#C7CDD4]">—</span>}</td>
                        <td className="py-1.5 px-2">
                          <div className="flex items-center justify-end gap-0.5">
                            <button onClick={() => openEdit(r)} disabled={editingId === r.id} title="Edit"
                              className="p-1 rounded-[5px] text-[#9FA6AD] hover:text-[#5B4FCF] hover:bg-[#EEF0FF] disabled:opacity-40 transition-all">
                              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </button>
                            <button onClick={() => void toggleActive(r)} disabled={togglingId === r.id}
                              title={r.active_status ? "Deactivate" : "Activate"}
                              className={["p-1 rounded-[5px] transition-all disabled:opacity-40",
                                r.active_status
                                  ? "text-[#9FA6AD] hover:text-[#F59E0B] hover:bg-[#FEF3C7]"
                                  : "text-[#22C55E] hover:text-[#15803D] hover:bg-[#DCFCE7]",
                              ].join(" ")}>
                              {r.active_status ? (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              ) : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              )}
                            </button>
                            <button onClick={() => void deleteRoom(r)} disabled={deletingId === r.id} title="Delete"
                              className="p-1 rounded-[5px] text-[#9FA6AD] hover:text-[#EF4444] hover:bg-[#FEE2E2] disabled:opacity-40 transition-all">
                              {deletingId === r.id ? <span className="text-[9px]">...</span> : (
                                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <ConfirmDeleteDialog
        open={!!pendingDelete}
        title="Delete Room"
        message={
          <>
            Are you sure you want to delete room <strong>“{pendingDelete?.room_no}”</strong>? This room
            will no longer be available for class assignments.
          </>
        }
        loading={deletingId === pendingDelete?.id}
        onConfirm={() => void confirmDeleteRoom()}
        onCancel={() => setPendingDelete(null)}
      />
    </div>
  );
}
