"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ChevronDown, Send, ArrowRight, Trash2 } from "lucide-react";

interface Props {
  selectedCount: number;
  isLoading?: boolean;
  onSendMessage: () => void;
  onMoveStage: (stage: string) => void;
  onAssign: (name: string) => void;
  onDelete: () => void;
  onClear: () => void;
}

const STAGE_OPTIONS = [
  { value: "new",       label: "New" },
  { value: "contacted", label: "In Conversation" },
  { value: "visited",   label: "Decision Pending" },
  { value: "enrolled",  label: "Enrolled" },
  { value: "declined",  label: "Cold / Dropped" },
];

export function BulkActionBar({ selectedCount, isLoading, onSendMessage, onMoveStage, onAssign, onDelete, onClear }: Props) {
  const [showStageMenu, setShowStageMenu] = useState(false);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [assignInput, setAssignInput] = useState("");

  return (
    <AnimatePresence>
      {selectedCount > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1, transition: { duration: 0.25, ease: "easeOut" } }}
          exit={{ y: 80, opacity: 0, transition: { duration: 0.2 } }}
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4 min-w-[420px] max-w-[90vw] ${isLoading ? "opacity-70 pointer-events-none" : ""}`}
        >
          <span className="text-sm font-semibold whitespace-nowrap">
            {selectedCount} selected
          </span>
          <div className="w-px h-5 bg-white/20" />

          {/* Send Message — hidden for now */}
          {/* <button
            onClick={() => { setShowStageMenu(false); setShowAssignMenu(false); onSendMessage(); }}
            className="flex items-center gap-1.5 text-sm bg-green-500 hover:bg-green-400 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
          >
            <Send size={13} /> Message
          </button> */}

          {/* Move Stage */}
          <div className="relative">
            <button
              onClick={() => { setShowStageMenu((v) => !v); setShowAssignMenu(false); }}
              className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              <ArrowRight size={13} /> Stage <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {showStageMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-full mb-2 left-0 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 py-1 min-w-[180px] z-50"
                >
                  {STAGE_OPTIONS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => { onMoveStage(s.value); setShowStageMenu(false); }}
                      className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Assign */}
          <div className="relative">
            <button
              onClick={() => { setShowAssignMenu((v) => !v); setShowStageMenu(false); }}
              className="flex items-center gap-1.5 text-sm bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap"
            >
              👤 Assign <ChevronDown size={12} />
            </button>
            <AnimatePresence>
              {showAssignMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="absolute bottom-full mb-2 left-0 bg-white text-gray-800 rounded-xl shadow-xl border border-gray-100 p-3 min-w-[200px] z-50"
                >
                  <input
                    autoFocus
                    value={assignInput}
                    onChange={(e) => setAssignInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && assignInput.trim()) {
                        onAssign(assignInput.trim());
                        setAssignInput("");
                        setShowAssignMenu(false);
                      }
                    }}
                    placeholder="Name, press Enter…"
                    className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-xs text-gray-400 mt-1.5">Press Enter to assign</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="flex-1" />

          {/* Delete */}
          <button
            onClick={onDelete}
            className="p-1.5 hover:bg-red-500/20 rounded-lg transition-colors text-red-400 hover:text-red-300"
            title="Delete selected"
          >
            <Trash2 size={15} />
          </button>

          {/* Clear */}
          <button
            onClick={onClear}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors text-white/60 hover:text-white"
            title="Clear selection"
          >
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
