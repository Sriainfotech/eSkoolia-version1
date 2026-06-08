"use client";

import React, { useState, useEffect } from "react";
import type { Department, Staff } from "@/types/hr";
import type { StaffMark } from "../hooks/useHrAttendanceData";
import StaffAbsentNoteDialog from "./StaffAbsentNoteDialog";

interface DeptTypeCardProps {
  deptType: string;
  departments: Department[];
  staffByDept: Record<number, Staff[]>;
  marksByDept: Record<number, Record<number, StaffMark>>;
  loadingDepts: Record<number, boolean>;
  open: boolean;
  onToggle: () => void;
  loadDepartment: (deptId: number) => void;
  updateMark: (deptId: number, staffId: number, patch: Partial<StaffMark>) => void;
  saveRows: (deptId: number, staffIds: number[]) => Promise<void>;
  saving: boolean;
  search: string;
  statusFilter: string;
}

export default function DeptTypeCard({
  deptType,
  departments,
  staffByDept,
  marksByDept,
  loadingDepts,
  open,
  onToggle,
  loadDepartment,
  updateMark,
  saveRows,
  saving,
  search,
  statusFilter,
}: DeptTypeCardProps) {
  // When opened, load all departments under this type
  useEffect(() => {
    if (open) {
      departments.forEach(d => loadDepartment(d.id));
    }
  }, [open, departments, loadDepartment]);

  const [selectedStaff, setSelectedStaff] = useState<Record<number, Set<number>>>({});
  const [editingNote, setEditingNote] = useState<{
    deptId: number;
    staffId: number;
    staffName: string;
    currentReason: string;
  } | null>(null);

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-all mb-3 ${open ? 'border-[#E0DBFD] shadow-sm border-l-4 border-l-[#4729F4]' : 'border-[#E6E6EC]'}`}>
      <div onClick={onToggle} className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer select-none transition-colors ${open ? 'bg-[#F8F6FF]' : 'hover:bg-[#FAFAFD]'}`}>
        <svg className={`w-4 h-4 text-[#9CA0AE] shrink-0 transition-transform duration-200 ${open ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path d="m9 18 6-6-6-6" />
        </svg>
        <div className="flex flex-col shrink-0">
          <span className="text-[13px] font-semibold text-[#0B0B14]">{deptType || "Unassigned"}</span>
        </div>
        <div className="flex-1" />
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FAFAFD] text-[#3A3A4A] border border-[#E6E6EC] whitespace-nowrap">
          {departments.length} departments
        </span>
      </div>

      {open && (
        <div className="border-t border-[#F0F0F6]">
          {departments.map(d => {
            const staff = staffByDept[d.id] || [];
            const marks = marksByDept[d.id] || {};
            const loading = loadingDepts[d.id];
            const deptSelected = selectedStaff[d.id] || new Set<number>();

            const filteredStaff = staff.filter(s => {
              const q = search.trim().toLowerCase();
              if (q && !(s.full_name || "").toLowerCase().includes(q) && !(s.staff_no || "").toLowerCase().includes(q)) return false;
              const status = marks[s.id]?.attendance_type || "P";
              if (statusFilter !== "all" && status !== statusFilter) return false;
              return true;
            });

            const present = staff.filter(s => (marks[s.id]?.attendance_type || "P") === "P").length;
            const absent = staff.filter(s => marks[s.id]?.attendance_type === "A").length;
            const signedInCount = staff.filter(s => !!marks[s.id]?.sign_in_time && !marks[s.id]?.sign_out_time).length;

            return (
              <div key={d.id} className="border-b border-[#F0F0F6] last:border-b-0">
                <div className="bg-[#FAFAFD] px-5 py-2.5 flex items-center justify-between border-b border-[#EDEDF5]">
                  <span className="text-[12px] font-bold text-[#3A3A4A]">{d.name}</span>
                  <div className="flex gap-2">
                    <span className="text-[10px] text-[#6B6B7B]">{staff.length} staff</span>
                  </div>
                </div>

                {loading ? (
                  <div className="p-4 flex flex-col gap-2">
                    <div className="h-10 bg-[#F0F0F5] animate-pulse rounded-lg" />
                    <div className="h-10 bg-[#F0F0F5] animate-pulse rounded-lg opacity-80" />
                  </div>
                ) : filteredStaff.length === 0 ? (
                  <div className="py-6 text-center text-sm text-[#9B9BAD]">No staff found.</div>
                ) : (
                  <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                    <table className="w-full border-collapse" style={{ minWidth: 960 }}>
                      <thead className="sticky top-0 z-10 bg-[#FAFAFD] border-b-[1.5px] border-[#EDEDF5]">
                        <tr>
                          <th className="px-3 py-2.5 text-left w-9">
                            <input
                              type="checkbox"
                              onChange={(e) => {
                                const newSet = new Set<number>();
                                if (e.target.checked) filteredStaff.forEach(s => newSet.add(s.id));
                                setSelectedStaff(prev => ({ ...prev, [d.id]: newSet }));
                              }}
                              checked={filteredStaff.length > 0 && filteredStaff.every(s => deptSelected.has(s.id))}
                              className="w-3.5 h-3.5 accent-[#4729F4]"
                            />
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[180px]">
                            Staff
                          </th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap w-[70px]">
                            Staff No
                          </th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap w-[80px]">
                            Absent
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[140px]">
                            Arrival
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[120px]">
                            Sign In
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[110px]">
                            Sign Out
                          </th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap w-[70px]">
                            Lunch
                          </th>
                          <th className="px-3 py-2.5 text-center text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap w-[60px]">
                            Notes
                          </th>
                          <th className="px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-wide text-[#9CA0AE] whitespace-nowrap min-w-[100px]">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredStaff.map(s => {
                          const mk = marks[s.id] || {};
                          const isAbsent = mk.attendance_type === "A";
                          const isLeave = mk.attendance_type === "L";
                          const hasActiveSignIn = !!mk.sign_in_time && !mk.sign_out_time && !isAbsent;
                          const signedIn = !!mk.sign_in_time;
                          const statusDotClass = hasActiveSignIn ? 'bg-[#0A8C5A]' : 'bg-[#9CA0AE]';
                          const isSelected = deptSelected.has(s.id);

                          return (
                            <tr key={s.id} className={`group border-b border-[#F4F4F8] transition-colors hover:bg-[#FAFAFD] ${isSelected ? 'bg-[#F4F2FF] border-l-[3px] border-l-[#4729F4]' : 'border-l-[3px] border-l-transparent'}`}>
                              {/* Checkbox */}
                              <td className="px-3 py-2.5 whitespace-nowrap w-9">
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={e => {
                                    const newSet = new Set(deptSelected);
                                    if (e.target.checked) newSet.add(s.id);
                                    else newSet.delete(s.id);
                                    setSelectedStaff(prev => ({ ...prev, [d.id]: newSet }));
                                  }}
                                  className="w-3.5 h-3.5 accent-[#4729F4]"
                                />
                              </td>
                              
                              {/* Staff */}
                              <td className="px-3 py-2.5 whitespace-nowrap min-w-[180px] max-w-[220px]">
                                <div className="flex items-center gap-2.5">
                                  <div className="relative flex-shrink-0">
                                    <div className="w-8 h-8 rounded-full bg-[#E0DBFD] flex items-center justify-center text-[10px] font-bold text-[#4729F4]">
                                      {(s.first_name?.[0] || "") + (s.last_name?.[0] || "")}
                                    </div>
                                    <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border-2 border-white ${statusDotClass}`} />
                                  </div>
                                  <div className="min-w-0 flex flex-col">
                                    <span className="text-[12px] font-semibold text-[#0B0B14] truncate max-w-[140px]">
                                      {s.full_name || s.first_name}
                                    </span>
                                    {mk.note && (
                                      <div className="text-[10px] flex items-center gap-1 flex-wrap mt-0.5">
                                        <span className="text-[9px] font-bold text-[#B4721B] bg-[#FDF1DC] px-1.5 py-px rounded whitespace-nowrap flex-shrink-0 truncate max-w-[100px]">
                                          {mk.note}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </td>

                              {/* Staff No */}
                              <td className="px-3 py-2.5 whitespace-nowrap w-[70px] text-center text-[12px] font-medium text-[#5A5E70]">
                                {s.staff_no || '—'}
                              </td>

                              {/* Absent toggle */}
                              <td className="px-3 py-2.5 whitespace-nowrap w-[80px] text-center">
                                <button
                                  onClick={() => {
                                    if (isAbsent) {
                                      updateMark(d.id, s.id, { attendance_type: "P", note: "" });
                                    } else {
                                      updateMark(d.id, s.id, { attendance_type: "A" });
                                      setEditingNote({ deptId: d.id, staffId: s.id, staffName: s.full_name || s.first_name || "", currentReason: mk.note || "" });
                                    }
                                  }}
                                  disabled={hasActiveSignIn}
                                  className="relative w-8 h-[18px] rounded-full border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer"
                                  style={{ backgroundColor: isAbsent ? '#C2264E' : '#E6E6EC' }}
                                >
                                  <span className="absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform duration-200" style={{ left: isAbsent ? '18px' : '2px' }} />
                                </button>
                              </td>

                              {/* Arrival */}
                              <td className="px-3 py-2.5 whitespace-nowrap min-w-[140px]">
                                {mk.arrival_time ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold bg-[#F4F4F8] text-[#3A3A4A]">
                                    {mk.arrival_time.slice(0, 5)}
                                  </span>
                                ) : (
                                  <span className="text-[#9CA0AE] text-[12px]">—</span>
                                )}
                              </td>

                              {/* Sign In */}
                              <td className="px-3 py-2.5 whitespace-nowrap min-w-[120px]">
                                {mk.sign_in_time ? (
                                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold ${hasActiveSignIn ? 'bg-[#E4F6ED] text-[#0A8C5A]' : 'bg-[#F4F4F8] text-[#3A3A4A]'}`}>
                                    {mk.sign_in_time.slice(0, 5)}
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => updateMark(d.id, s.id, { sign_in_time: new Date().toTimeString().slice(0, 5), attendance_type: "P" })}
                                    disabled={isAbsent}
                                    className="bg-[#4729F4] text-white h-[28px] px-3 rounded-lg text-[11px] font-bold border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer enabled:hover:bg-[#3a21d4]"
                                  >
                                    Sign in
                                  </button>
                                )}
                              </td>

                              {/* Sign Out */}
                              <td className="px-3 py-2.5 whitespace-nowrap min-w-[110px]">
                                {mk.sign_out_time ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#F4F4F8] text-[#3A3A4A] text-[11px] font-semibold">
                                    {mk.sign_out_time.slice(0, 5)}
                                  </span>
                                ) : signedIn ? (
                                  <button
                                    onClick={() => updateMark(d.id, s.id, { sign_out_time: new Date().toTimeString().slice(0, 5) })}
                                    className="bg-[#F4F4F8] text-[#3A3A4A] h-[28px] px-3 rounded-lg text-[11px] font-bold border border-[#E6E6EC] cursor-pointer hover:bg-[#E6E6EC] transition-colors"
                                  >
                                    Sign out
                                  </button>
                                ) : (
                                  <span className="text-[#9CA0AE] text-[12px]">—</span>
                                )}
                              </td>

                              {/* Lunch toggle */}
                              <td className="px-3 py-2.5 whitespace-nowrap w-[70px] text-center">
                                <button
                                  onClick={() => updateMark(d.id, s.id, { lunch: !mk.lunch })}
                                  disabled={!signedIn}
                                  className="relative w-8 h-[18px] rounded-full border-none transition-colors disabled:opacity-40 disabled:cursor-not-allowed enabled:cursor-pointer inline-block align-middle"
                                  style={{ backgroundColor: mk.lunch ? '#4729F4' : '#E6E6EC' }}
                                >
                                  <span className="absolute top-[2px] w-[14px] h-[14px] bg-white rounded-full transition-transform duration-200" style={{ left: mk.lunch ? '18px' : '2px' }} />
                                </button>
                              </td>

                              {/* Notes count */}
                              <td className="px-3 py-2.5 whitespace-nowrap w-[60px] text-center">
                                {mk.note ? (
                                  <span className="inline-flex items-center justify-center bg-[#4729F4] text-white text-[9px] font-bold w-5 h-5 rounded-full">
                                    1
                                  </span>
                                ) : (
                                  <span className="text-[#9CA0AE] text-[12px]">—</span>
                                )}
                              </td>

                              {/* Actions */}
                              <td className="px-3 py-2.5 whitespace-nowrap w-[100px]">
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => setEditingNote({ deptId: d.id, staffId: s.id, staffName: s.full_name || s.first_name || "", currentReason: mk.note || "" })}
                                    title="Add / edit note"
                                    className="w-6 h-6 rounded-md border-none cursor-pointer bg-[#E6E6EC] text-[#6B6B7B] flex items-center justify-center hover:bg-[#EEEBFF] hover:text-[#4729F4] transition-colors"
                                  >
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                      <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                                      <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                  </button>
                                  {mk.note && (
                                    <button
                                      onClick={() => updateMark(d.id, s.id, { note: "" })}
                                      title="Delete note"
                                      className="w-6 h-6 rounded-md border-none cursor-pointer bg-[#E6E6EC] text-[#6B6B7B] flex items-center justify-center hover:bg-[#FCE8EE] hover:text-[#C2264E] transition-colors"
                                    >
                                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                                        <polyline points="3 6 5 6 21 6" />
                                        <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
                                        <path d="M10 11v6M14 11v6" />
                                        <path d="M9 6V4h6v2" />
                                      </svg>
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Footer for the department */}
                <div className="px-5 py-2.5 bg-[#FAFAFD] flex items-center justify-between border-t border-[#F0F0F6]">
                  <div className="flex gap-2.5">
                    <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#0A8C5A]" />{present} present
                    </span>
                    <span className="flex items-center gap-1 text-[11px] font-medium text-[#3A3A4A]">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#C2264E]" />{absent} absent
                    </span>
                  </div>
                  <button
                    onClick={() => {
                      const idsToSave = Array.from(deptSelected).length > 0 ? Array.from(deptSelected) : staff.map(s => s.id);
                      saveRows(d.id, idsToSave);
                    }}
                    disabled={saving}
                    className="h-8 px-4 text-[11px] font-semibold text-white bg-[#4729F4] rounded-lg hover:bg-[#3a21d4] disabled:opacity-50"
                  >
                    Save Attendance
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {editingNote && (
        <StaffAbsentNoteDialog
          staff={{ full_name: editingNote.staffName, first_name: editingNote.staffName } as Staff}
          initialReason={editingNote.currentReason}
          onConfirm={(reason: string) => {
            updateMark(editingNote.deptId, editingNote.staffId, { note: reason });
            setEditingNote(null);
          }}
          onSkip={() => setEditingNote(null)}
        />
      )}
    </div>
  );
}
