"use client";

import { useEffect, useRef, useState, useCallback, KeyboardEvent } from "react";
import { ChevronDown, X, Search } from "lucide-react";

export interface MasterOption {
  id: number;
  name: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: MasterOption[];
  placeholder?: string;
  loading?: boolean;
  error?: string | null;
  /** Value for the "Other" free-text input (shown when value === "Other") */
  customValue?: string;
  /** Called when user types in the "Other" free-text input */
  onCustomChange?: (val: string) => void;
  /** Label shown on the "Other" text input */
  customPlaceholder?: string;
  disabled?: boolean;
}

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select",
  loading = false,
  error = null,
  customValue = "",
  onCustomChange,
  customPlaceholder = "Please specify…",
  disabled = false,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [highlighted, setHighlighted] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // All options, with "Other" pinned at end
  const baseOptions = options.filter((o) => o.name !== "Other");
  const hasOther = options.some((o) => o.name === "Other");

  const filtered = baseOptions.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase().trim())
  );
  if (hasOther && ("other".includes(search.toLowerCase().trim()) || search.trim() === "")) {
    // keep "Other" always visible (added manually below)
  }

  const allFiltered: Array<MasterOption | { id: "other"; name: "Other" }> = [
    ...filtered,
    ...(hasOther ? [{ id: "other" as const, name: "Other" as const }] : []),
  ];

  // Close on outside click
  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  // Focus search on open
  useEffect(() => {
    if (open) {
      setTimeout(() => searchRef.current?.focus(), 50);
      setHighlighted(-1);
      setSearch("");
    }
  }, [open]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlighted >= 0 && listRef.current) {
      const items = listRef.current.querySelectorAll("li[data-idx]");
      const el = items[highlighted] as HTMLElement | undefined;
      el?.scrollIntoView({ block: "nearest" });
    }
  }, [highlighted]);

  const select = useCallback(
    (name: string) => {
      onChange(name);
      setOpen(false);
      setSearch("");
    },
    [onChange]
  );

  const clear = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onChange("");
      if (onCustomChange) onCustomChange("");
    },
    [onChange, onCustomChange]
  );

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!open) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); }
      return;
    }
    if (e.key === "Escape") { setOpen(false); return; }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((h) => Math.min(h + 1, allFiltered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && highlighted >= 0) {
      e.preventDefault();
      const opt = allFiltered[highlighted];
      if (opt) select(opt.name);
    }
  }

  const displayLabel = value
    ? value === "Other" && customValue
      ? customValue
      : value
    : null;

  return (
    <div ref={containerRef} className="relative w-full" onKeyDown={onKeyDown}>
      {/* Trigger button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((o) => !o)}
        className={[
          "w-full flex items-center justify-between border border-[var(--line)] rounded-[11px] bg-white h-[40px] px-3 text-[var(--ink)] outline-none text-left",
          open ? "border-[#c4b5fd] shadow-[0_0_0_3px_rgba(108,60,225,0.12)]" : "hover:border-[#c4b5fd]",
          disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        ].join(" ")}
      >
        <span
          className={displayLabel ? "text-[var(--ink)]" : "text-[#94A3B8]"}
          style={{ fontSize: 14 }}
        >
          {loading ? "Loading…" : displayLabel ?? placeholder}
        </span>
        <span className="flex items-center gap-1">
          {value && !disabled && (
            <span
              role="button"
              aria-label="Clear"
              onClick={clear}
              className="text-[#94A3B8] hover:text-[var(--ink)] p-0.5 rounded-full"
            >
              <X size={12} />
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-[#94A3B8] transition-transform ${open ? "rotate-180" : ""}`}
          />
        </span>
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] w-full bg-white border border-[#e2e8f0] rounded-[11px] shadow-[0_8px_24px_-4px_rgba(15,18,34,0.14)] z-[200]">
          {/* Search input */}
          <div className="p-2 border-b border-[#f1f5f9]">
            <div className="flex items-center gap-2 border border-[#e2e8f0] rounded-[8px] px-2 bg-[#f8f8fc]">
              <Search size={13} className="text-[#94A3B8] shrink-0" />
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setHighlighted(-1); }}
                placeholder="Search…"
                className="w-full py-1.5 text-[13px] bg-transparent outline-none text-[var(--ink)] placeholder:text-[#94A3B8]"
              />
              {search && (
                <button type="button" onClick={() => setSearch("")} className="text-[#94A3B8] hover:text-[var(--ink)]">
                  <X size={12} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <ul
            ref={listRef}
            className="max-h-[200px] overflow-y-auto py-1"
          >
            {loading && (
              <li className="px-3 py-3 text-[13px] text-[#94A3B8] text-center">Loading…</li>
            )}
            {error && !loading && (
              <li className="px-3 py-2 text-[12px] text-[#dc2626] text-center">{error}</li>
            )}
            {!loading && !error && allFiltered.length === 0 && (
              <li className="px-3 py-3 text-[13px] text-[#94A3B8] text-center">No results</li>
            )}
            {!loading && !error && allFiltered.map((opt, idx) => (
              <li
                key={opt.id}
                data-idx={idx}
                onClick={() => select(opt.name)}
                className={[
                  "px-3 py-2 text-[13px] cursor-pointer",
                  idx === highlighted ? "bg-[#f3f0ff]" : "hover:bg-[#f3f0ff]",
                  opt.name === value ? "font-[700] text-[var(--brand)]" : "text-[var(--ink)]",
                  opt.name === "Other" ? "border-t border-[#f1f5f9] mt-1 pt-2" : "",
                ].join(" ")}
              >
                {opt.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Custom "Other" text input */}
      {value === "Other" && onCustomChange && (
        <input
          type="text"
          value={customValue}
          onChange={(e) => onCustomChange(e.target.value.replace(/[^a-zA-Z\s'-.]/g, ""))}
          placeholder={customPlaceholder}
          maxLength={80}
          className="mt-2 w-full border border-[var(--line)] rounded-[11px] bg-white h-[40px] px-3 text-[13px] text-[var(--ink)] outline-none placeholder:text-[#94A3B8] focus:border-[#c4b5fd] focus:shadow-[0_0_0_3px_rgba(108,60,225,0.12)]"
        />
      )}
    </div>
  );
}
