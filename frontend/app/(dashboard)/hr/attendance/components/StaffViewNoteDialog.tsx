"use client";
import React, { useState } from "react";
import type { Staff } from "@/types/hr";

interface Props {
  staff: Staff;
  note: string;
  onEditNote: (index: number, newText: string) => void;
  onDeleteNote: (index: number) => void;
  onClose: () => void;
}

export default function StaffViewNoteDialog({ staff, note, onEditNote, onDeleteNote, onClose }: Props) {
  const staffName = staff.full_name?.trim() || `${staff.first_name ?? ""} ${staff.last_name ?? ""}`.trim() || staff.staff_no;
  
  const notesList = note ? note.split('|||') : [];
  const displayDate = new Date().toISOString(); 

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  const handleEditClick = (idx: number, text: string) => {
    setEditingIndex(idx);
    setEditText(text);
  };

  const handleSaveEdit = (idx: number) => {
    if (editText.trim()) {
      onEditNote(idx, editText.trim());
    }
    setEditingIndex(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[480px] max-w-[92vw] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-[#F0F0F6] flex items-start justify-between bg-white relative">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0B0B14] m-0">Notes</h3>
            <p className="text-[11px] text-[#9CA0AE] m-0 mt-0.5">{staffName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-lg bg-[#FAFAFD] text-[#9CA0AE] border border-[#E6E6EC] hover:bg-[#F4F4F8] hover:text-[#0B0B14] transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        <div className="p-5 overflow-y-auto max-h-[60vh] bg-[#FAFAFD]">
          {notesList.length === 0 ? (
            <p className="text-[12px] text-[#9CA0AE] text-center py-6 m-0">No notes added yet.</p>
          ) : (
            notesList.map((n, idx) => (
              <div key={idx} className="bg-white border border-[#E6E6EC] rounded-xl p-3.5 mb-2.5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#4729F4] bg-[#F0EFFE] px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                  <span className="text-[10px] text-[#9CA0AE]">Note</span>
                </div>
                
                {editingIndex === idx ? (
                  <div className="flex flex-col gap-2 mt-1">
                    <textarea
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      className="w-full text-[12px] text-[#3A3A4A] border border-[#E6E6EC] rounded-md px-2 py-1.5 resize-none outline-none focus:border-[#4729F4] leading-relaxed"
                      rows={3}
                      autoFocus
                    />
                    <div className="flex gap-1.5 justify-end">
                      <button
                        onClick={() => setEditingIndex(null)}
                        className="h-6 px-2.5 text-[10px] font-semibold text-[#6B6B7B] bg-[#F4F4F8] rounded border-none cursor-pointer hover:bg-[#E6E6EC] transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleSaveEdit(idx)}
                        className="h-6 px-2.5 text-[10px] font-semibold text-white bg-[#4729F4] rounded border-none cursor-pointer hover:bg-[#3a21d4] transition-colors"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-[12px] text-[#3A3A4A] m-0 mt-1 whitespace-pre-wrap leading-relaxed">
                      {n}
                    </p>
                    <div className="flex items-center justify-end gap-1.5 pt-2 mt-1 border-t border-[#F0F0F6]">
                      <button
                        type="button"
                        onClick={() => handleEditClick(idx, n)}
                        className="w-7 h-7 rounded-lg border-none bg-white text-[#6B6B7B] hover:text-[#4729F4] hover:bg-[#F0EFFE] transition-colors flex items-center justify-center cursor-pointer"
                        title="Edit note"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteNote(idx)}
                        className="w-7 h-7 rounded-lg border-none bg-white text-[#6B6B7B] hover:text-[#C2264E] hover:bg-[#FCE8EE] transition-colors flex items-center justify-center cursor-pointer"
                        title="Delete note"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" /><path d="M9 6V4h6v2" /></svg>
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="px-5 py-3 border-t border-[#F0F0F6] bg-white flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-6 text-[12px] font-semibold text-white bg-[#4729F4] rounded-lg cursor-pointer hover:bg-[#3A21D4] transition-colors border-none"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
