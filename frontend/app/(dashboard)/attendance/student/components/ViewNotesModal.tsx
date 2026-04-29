'use client';
import React, { useState, useEffect } from 'react';
import type { Student } from '../types';

interface Props {
  student: Student;
  onEditNote: (noteId: string, newText: string) => void;
  onDeleteNote: (noteId: string) => void;
  onClose: () => void;
}

export default function ViewNotesModal({ student, onEditNote, onDeleteNote, onClose }: Props) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  const toggleExpand = (id: string) => {
    if (editingId === id) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleEditClick = (e: React.MouseEvent, noteId: string, currentText: string) => {
    e.stopPropagation();
    setDeleteConfirmId(null);
    setEditingId(noteId);
    setEditText(currentText);
    setExpandedIds((prev) => { const next = new Set(prev); next.add(noteId); return next; });
  };

  const handleSaveEdit = (noteId: string) => {
    if (editText.trim()) onEditNote(noteId, editText.trim());
    setEditingId(null);
  };

  const handleDeleteClick = (e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    setEditingId(null);
    setDeleteConfirmId(noteId);
  };

  const handleConfirmDelete = (noteId: string) => {
    onDeleteNote(noteId);
    setDeleteConfirmId(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[420px] max-w-[90vw] max-h-[80vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F6] flex-shrink-0">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0B0B14] m-0">Notes</h3>
            <p className="text-[11px] text-[#9CA0AE] m-0 mt-0.5">{student.full_name}</p>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-md border-none cursor-pointer bg-[#F4F4F8] text-[#6B6B7B] hover:bg-[#E6E6EC] transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {student.notes.length === 0 ? (
            <p className="text-[12px] text-[#9CA0AE] text-center py-6 m-0">No notes added yet.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {student.notes.map((note, idx) => {
                const isExpanded = expandedIds.has(note.id);
                const isEditing = editingId === note.id;
                const isConfirmingDelete = deleteConfirmId === note.id;
                return (
                  <div key={note.id} className="border border-[#E6E6EC] rounded-lg overflow-hidden">
                    {/* Note header row */}
                    <div
                      className="w-full flex items-center justify-between px-3 py-2 bg-[#FAFAFD] cursor-pointer hover:bg-[#F4F4F8] transition-colors"
                      onClick={() => toggleExpand(note.id)}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-[10px] font-bold text-[#4729F4] bg-[#EEEBFF] px-1.5 py-px rounded flex-shrink-0">
                          #{idx + 1}
                        </span>
                        <span className="text-[11px] font-medium text-[#3A3A4A] truncate">
                          {note.text.slice(0, 60)}{note.text.length > 60 ? '…' : ''}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <span className="text-[10px] text-[#9CA0AE] mr-1">{note.created_at}</span>
                        {/* Edit button */}
                        <button
                          onClick={(e) => handleEditClick(e, note.id, note.text)}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#EEEBFF] text-[#9CA0AE] hover:text-[#4729F4] border-none bg-transparent cursor-pointer transition-colors"
                          title="Edit note"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                        </button>
                        {/* Delete button */}
                        <button
                          onClick={(e) => handleDeleteClick(e, note.id)}
                          className="w-5 h-5 flex items-center justify-center rounded hover:bg-[#FCE8EE] text-[#9CA0AE] hover:text-[#C2264E] border-none bg-transparent cursor-pointer transition-colors"
                          title="Delete note"
                        >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                          </svg>
                        </button>
                        {/* Expand arrow */}
                        <svg
                          className={`w-3 h-3 text-[#9CA0AE] transition-transform duration-150 ${isExpanded || isEditing ? 'rotate-180' : ''}`}
                          fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24"
                        >
                          <path d="m6 9 6 6 6-6" />
                        </svg>
                      </div>
                    </div>

                    {/* Delete confirmation */}
                    {isConfirmingDelete && (
                      <div className="px-3 py-2.5 bg-[#FFF5F7] border-t border-[#F0F0F6] flex items-center justify-between gap-2">
                        <span className="text-[11px] text-[#C2264E]">Delete this note?</span>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="h-6 px-2.5 text-[10px] font-semibold text-[#6B6B7B] bg-[#F4F4F8] rounded border-none cursor-pointer hover:bg-[#E6E6EC] transition-colors"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => handleConfirmDelete(note.id)}
                            className="h-6 px-2.5 text-[10px] font-semibold text-white bg-[#C2264E] rounded border-none cursor-pointer hover:bg-[#a01e40] transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Expanded / editing body */}
                    {!isConfirmingDelete && (isExpanded || isEditing) && (
                      <div className="px-3 py-2.5 bg-white border-t border-[#F0F0F6]">
                        {isEditing ? (
                          <div className="flex flex-col gap-2">
                            <textarea
                              value={editText}
                              onChange={(e) => setEditText(e.target.value)}
                              className="w-full text-[12px] text-[#3A3A4A] border border-[#E6E6EC] rounded-md px-2 py-1.5 resize-none outline-none focus:border-[#4729F4] leading-relaxed"
                              rows={3}
                              autoFocus
                            />
                            <div className="flex gap-1.5 justify-end">
                              <button
                                onClick={() => setEditingId(null)}
                                className="h-6 px-2.5 text-[10px] font-semibold text-[#6B6B7B] bg-[#F4F4F8] rounded border-none cursor-pointer hover:bg-[#E6E6EC] transition-colors"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handleSaveEdit(note.id)}
                                className="h-6 px-2.5 text-[10px] font-semibold text-white bg-[#4729F4] rounded border-none cursor-pointer hover:bg-[#3a21d4] transition-colors"
                              >
                                Save
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-[12px] text-[#3A3A4A] m-0 leading-relaxed whitespace-pre-wrap">{note.text}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-5 py-3 border-t border-[#F0F0F6] bg-[#FAFAFD] flex-shrink-0">
          <button
            onClick={onClose}
            className="h-8 px-4 text-[11px] font-semibold text-white bg-[#4729F4] rounded-lg border-none cursor-pointer hover:bg-[#3a21d4] transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
