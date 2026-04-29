'use client';
import React, { useState, useEffect, useRef } from 'react';
import type { Student } from '../types';

interface Props {
  student: Student;
  /** If provided, the modal pre-fills with this text (edit mode). */
  initialNote?: string;
  onSave: (student: Student, note: string) => void;
  onClose: () => void;
}

export default function NotesModal({ student, initialNote = '', onSave, onClose }: Props) {
  const [note, setNote] = useState(initialNote);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isEditing = initialNote.length > 0;

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-xl w-[400px] max-w-[90vw] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#F0F0F6]">
          <div>
            <h3 className="text-[14px] font-semibold text-[#0B0B14] m-0">{isEditing ? 'Edit Note' : 'Add Note'}</h3>
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
        <div className="px-5 py-4">
          <textarea
            ref={textareaRef}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={250}
            placeholder="Enter a note for this student..."
            className="w-full h-24 px-3 py-2 rounded-lg border border-[#E6E6EC] text-[12px] text-[#0B0B14] resize-none focus:outline-none focus:border-[#4729F4] focus:ring-1 focus:ring-[#4729F4]/20 placeholder:text-[#9CA0AE]"
          />
          <p className="text-[10px] text-[#9CA0AE] mt-1 text-right m-0">
            {note.length}/250
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-[#F0F0F6] bg-[#FAFAFD]">
          <button
            onClick={onClose}
            className="h-8 px-3 text-[11px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg cursor-pointer hover:bg-[#F4F4F8] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => { if (note.trim()) onSave(student, note.trim()); }}
            disabled={!note.trim()}
            className="h-8 px-4 text-[11px] font-semibold text-white bg-[#4729F4] rounded-lg border-none cursor-pointer hover:bg-[#3a21d4] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isEditing ? 'Update Note' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  );
}

