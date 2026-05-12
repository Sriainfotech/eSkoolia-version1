"use client";

import { useState, useRef, useEffect } from "react";
import dynamic from "next/dynamic";
import { Smile, X } from "lucide-react";

// Must be dynamically imported because emoji-picker-react uses browser APIs.
const EmojiPicker = dynamic(() => import("emoji-picker-react"), { ssr: false });

interface EmojiFieldProps {
  value: string;
  onChange: (emoji: string) => void;
}

export default function EmojiField({ value, onChange }: EmojiFieldProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3 rounded-xl border-2 border-violet-300 bg-violet-50/50 hover:bg-violet-50 transition text-left"
      >
        <div className="w-8 h-8 rounded-lg bg-white border border-zinc-200 grid place-items-center text-xl shrink-0">
          {value || <Smile size={16} className="text-zinc-400" />}
        </div>
        <span className="text-[13.5px] text-zinc-600 flex-1">
          {value ? "Click to change" : "Click to pick"}
        </span>
        {value && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.stopPropagation();
                onChange("");
              }
            }}
            className="text-zinc-400 hover:text-red-600 transition p-1 cursor-pointer"
            aria-label="Clear emoji"
          >
            <X size={14} />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 z-50 shadow-2xl rounded-xl overflow-hidden border border-zinc-200 max-w-[calc(100vw-3rem)]">
          <EmojiPicker
            onEmojiClick={(emojiData) => {
              onChange(emojiData.emoji);
              setOpen(false);
            }}
            width={350}
            height={400}
            searchPlaceHolder="Search emoji..."
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
            lazyLoadEmojis
          />
        </div>
      )}
    </div>
  );
}