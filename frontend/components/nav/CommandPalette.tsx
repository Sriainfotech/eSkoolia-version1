"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";
import { FLAT_INDEX } from "@/lib/routes";

interface IndexItem {
  modId: string;
  label: string;
  path: string;
  icon: React.ElementType;
  bg: string;
  ic: string;
  permission?: string;
}

function scoreItem(item: IndexItem, query: string): number {
  const q = query.toLowerCase();
  const label = item.label.toLowerCase();
  const path = item.path.toLowerCase();
  let score = 0;
  if (label.startsWith(q)) score += 2;
  if (label.includes(q)) score += 1;
  if (path.includes(q)) score += 1;
  return score;
}

export function CommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter + score results
  const results: IndexItem[] = (() => {
    if (!query.trim()) {
      return FLAT_INDEX.slice(0, 8);
    }
    return FLAT_INDEX
      .map((item) => ({ item, score: scoreItem(item, query.trim()) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8)
      .map(({ item }) => item);
  })();

  // Reset on open
  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Clamp selectedIndex
  useEffect(() => {
    if (selectedIndex >= results.length) setSelectedIndex(Math.max(0, results.length - 1));
  }, [results.length, selectedIndex]);

  const navigate = useCallback(
    (path: string) => {
      router.push(path);
      onClose();
    },
    [router, onClose]
  );

  // Keyboard handler
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      }
      if (e.key === "Enter" && results[selectedIndex]) {
        navigate(results[selectedIndex].path);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, results, selectedIndex, navigate, onClose]);

  // Scroll selected item into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 500,
        background: "rgba(15,18,34,0.32)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        paddingTop: "12vh",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 560,
          maxWidth: "calc(100vw - 32px)",
          maxHeight: "60vh",
          background: "var(--bg-1)",
          borderRadius: 16,
          boxShadow: "var(--sh-3), 0 0 0 1px var(--bd)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "0 16px",
            height: 52,
            borderBottom: "1px solid var(--bd)",
            flexShrink: 0,
          }}
        >
          <Search size={17} strokeWidth={1.5} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            placeholder="Search modules, pages…"
            style={{
              flex: 1,
              border: "none",
              outline: "none",
              background: "transparent",
              fontSize: 16,
              color: "var(--ink-1)",
              fontFamily: "inherit",
            }}
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              style={{
                border: "none",
                background: "transparent",
                cursor: "pointer",
                color: "var(--ink-3)",
                padding: 4,
              }}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
          <kbd
            style={{
              padding: "2px 6px",
              borderRadius: 5,
              border: "1px solid var(--bd)",
              fontSize: 11,
              color: "var(--ink-3)",
              fontFamily: "var(--font-mono, monospace)",
              background: "var(--bg-2)",
            }}
          >
            Esc
          </kbd>
        </div>

        {/* Results */}
        <div
          ref={listRef}
          style={{
            overflowY: "auto",
            padding: "6px",
          }}
        >
          {results.length === 0 && (
            <div
              style={{
                padding: "24px 16px",
                textAlign: "center",
                color: "var(--ink-3)",
                fontSize: 13,
              }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
          {results.map((item, idx) => {
            const Icon = item.icon;
            const isSelected = idx === selectedIndex;
            return (
              <div
                key={`${item.path}-${idx}`}
                onClick={() => navigate(item.path)}
                onMouseEnter={() => setSelectedIndex(idx)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  height: 44,
                  padding: "0 16px",
                  borderRadius: 8,
                  cursor: "pointer",
                  background: isSelected ? "var(--bg-2)" : "transparent",
                  transition: "background 100ms",
                }}
              >
                {/* Module color icon tile */}
                <span
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 6,
                    background: item.bg,
                    color: item.ic,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Icon size={14} strokeWidth={1.5} />
                </span>

                {/* Label */}
                <span
                  style={{
                    flex: 1,
                    fontSize: 13,
                    color: "var(--ink-1)",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {item.label}
                </span>

                {/* Route path */}
                <span
                  style={{
                    fontSize: 11,
                    color: "var(--ink-3)",
                    fontFamily: "var(--font-mono, monospace)",
                    flexShrink: 0,
                  }}
                >
                  {item.path}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div
          style={{
            padding: "8px 16px",
            borderTop: "1px solid var(--bd)",
            display: "flex",
            gap: 16,
            fontSize: 11,
            color: "var(--ink-3)",
            flexShrink: 0,
          }}
        >
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>Esc close</span>
        </div>
      </div>
    </div>
  );
}

/* Global ⌘K / Ctrl+K hook — mount this once in layout */
export function useCmdK(onOpen: () => void) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpen();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onOpen]);
}
