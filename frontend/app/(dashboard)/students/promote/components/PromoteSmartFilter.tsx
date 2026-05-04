'use client';

import React, { useEffect, useMemo, useState } from 'react';

export type StatusFilter = 'all' | 'pending' | 'promote' | 'not_promoted';
export type ClassOption = { key: string; classLabel: string };
export type SectionOption = { key: string; label: string };

interface Props {
  classOptions: ClassOption[];
  sectionOptions?: SectionOption[];
  classKey?: string;
  sectionKey?: string;
  status?: StatusFilter;
  search?: string;
  // aliases used by StudentPromotePanel
  smartSearch?: string;
  smartStatus?: StatusFilter;
  smartClassId?: string;
  onClassChange: (key: string) => void;
  onSectionChange?: (key: string) => void;
  onStatusChange: (s: StatusFilter) => void;
  onSearchChange: (s: string) => void;
  onSearchSubmit?: () => void;
  onReset: () => void;
  fieldStyle?: unknown;
  secondaryBtnStyle?: unknown;
}

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all',          label: 'All' },
  { value: 'pending',      label: 'Pending' },
  { value: 'promote',      label: 'Promote' },
  { value: 'not_promoted', label: 'Not Promoted' },
];

const STATUS_LABEL: Record<StatusFilter, string> = {
  all: 'All',
  pending: 'Pending',
  promote: 'Promote',
  not_promoted: 'Not Promoted',
};

// Inline icons (avoid importing the student-groups page module)
const FilterIco = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);
const XIco = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

export default function PromoteSmartFilter({
  classOptions,
  sectionOptions = [],
  classKey: classKeyProp,
  sectionKey: sectionKeyProp,
  status: statusProp,
  search: searchProp,
  smartSearch,
  smartStatus,
  smartClassId,
  onClassChange,
  onSectionChange,
  onStatusChange,
  onSearchChange,
  onSearchSubmit,
  onReset,
}: Props) {
  const classKey = classKeyProp ?? smartClassId ?? 'all';
  const sectionKey = sectionKeyProp ?? 'all';
  const status = statusProp ?? smartStatus ?? 'all';
  const search = searchProp ?? smartSearch ?? '';
  const handleSectionChange = onSectionChange ?? (() => {});
  const [filterOpen, setFilterOpen] = useState(false);

  // Pending (uncommitted) filter state — applied on "Apply Filter"
  const [pendingClass, setPendingClass] = useState(classKey);
  const [pendingSection, setPendingSection] = useState(sectionKey);
  const [pendingStatus, setPendingStatus] = useState<StatusFilter>(status);

  // Resync pending → applied if parent resets externally
  useEffect(() => { setPendingClass(classKey); }, [classKey]);
  useEffect(() => { setPendingSection(sectionKey); }, [sectionKey]);
  useEffect(() => { setPendingStatus(status); }, [status]);

  const hasFilterChanges =
    pendingClass !== classKey ||
    pendingSection !== sectionKey ||
    pendingStatus !== status;

  const applyFilters = () => {
    if (pendingClass !== classKey) onClassChange(pendingClass);
    if (pendingSection !== sectionKey) handleSectionChange(pendingSection);
    if (pendingStatus !== status) onStatusChange(pendingStatus);
    setFilterOpen(false);
  };

  // Active applied filter chips
  type Chip = { key: 'search' | 'class' | 'section' | 'status'; label: string; clear: () => void };
  const chips = useMemo<Chip[]>(() => {
    const out: Chip[] = [];
    if (search.trim()) {
      // Search is shown live in the input box itself — no separate chip needed.
    }
    if (classKey !== 'all') {
      const c = classOptions.find((o) => o.key === classKey);
      if (c) out.push({ key: 'class', label: c.classLabel, clear: () => { setPendingClass('all'); onClassChange('all'); } });
    }
    if (sectionKey !== 'all') {
      const s = sectionOptions.find((o) => o.key === sectionKey);
      if (s) out.push({ key: 'section', label: `Sec ${s.label}`, clear: () => { setPendingSection('all'); handleSectionChange('all'); } });
    }
    if (status !== 'all') {
      out.push({ key: 'status', label: STATUS_LABEL[status], clear: () => { setPendingStatus('all'); onStatusChange('all'); } });
    }
    return out;
  }, [search, classKey, sectionKey, status, classOptions, sectionOptions, onSearchChange, onSearchSubmit, onClassChange, handleSectionChange, onStatusChange]);

  const pendingCount =
    (pendingClass !== 'all' ? 1 : 0) +
    (pendingSection !== 'all' ? 1 : 0) +
    (pendingStatus !== 'all' ? 1 : 0);

  const handleResetAll = () => {
    setPendingClass('all');
    setPendingSection('all');
    setPendingStatus('all');
    onReset();
  };

  return (
    <div className="sg-filter-shell" style={{ marginBottom: 16 }}>
      {/* Always-visible: search + controls */}
      <div className="sg-search-row">
        <div className="sg-searchbox">
          <FilterIco />
          <input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onSearchSubmit?.(); }}
            placeholder="Search student, admission no, class or section"
          />
          {search && (
            <button className="sg-search-clear" onClick={() => { onSearchChange(''); onSearchSubmit?.(); }} aria-label="Clear search">
              <XIco />
            </button>
          )}
        </div>
        <button
          type="button"
          className={`sg-filter-toggle-btn${filterOpen ? ' open' : ''}`}
          onClick={() => setFilterOpen((v) => !v)}
        >
          <FilterIco />
          <span>Filters</span>
          {pendingCount > 0 && <span className="sg-filter-badge">{pendingCount}</span>}
          {hasFilterChanges && <span className="sg-filter-pending-dot" />}
          <span className="sg-filter-caret">{filterOpen ? '▲' : '▼'}</span>
        </button>
        {(chips.length > 0 || hasFilterChanges) && (
          <button type="button" className="sg-reset-btn" onClick={handleResetAll}>
            Reset all
          </button>
        )}
      </div>

      {/* Active applied filter chips */}
      {chips.length > 0 && (
        <div className="sg-active-strip">
          {chips.map((c, i) => (
            <span key={`${c.key}-${i}`} className="sg-active-chip">
              {c.label}
              <button className="sg-active-chip-x" onClick={c.clear} aria-label={`Remove ${c.label}`}>
                <XIco />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Collapsible filter pills */}
      {filterOpen && (
        <div className="sg-filter-body">
          {/* Status (always shown — quick switch) */}
          <div className="sg-filter-group">
            <div className="sg-filter-label">Decision Status</div>
            <div className="sg-pill-row">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  className={`sg-pill${pendingStatus === opt.value ? ' active' : ''}`}
                  onClick={() => setPendingStatus(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Class */}
          <div className="sg-filter-group">
            <div className="sg-filter-label">Class</div>
            <div className="sg-pill-row">
              <button
                type="button"
                className={`sg-pill${pendingClass === 'all' ? ' active' : ''}`}
                onClick={() => { setPendingClass('all'); setPendingSection('all'); }}
              >
                All
              </button>
              {classOptions.map((c) => (
                <button
                  key={c.key}
                  type="button"
                  className={`sg-pill${pendingClass === c.key ? ' active' : ''}`}
                  onClick={() => { setPendingClass(c.key); setPendingSection('all'); }}
                >
                  {c.classLabel}
                </button>
              ))}
            </div>
          </div>

          {/* Section (only when a class is chosen) */}
          {pendingClass !== 'all' && sectionOptions.length > 0 && (
            <div className="sg-filter-group">
              <div className="sg-filter-label">Section</div>
              <div className="sg-pill-row">
                <button
                  type="button"
                  className={`sg-pill${pendingSection === 'all' ? ' active' : ''}`}
                  onClick={() => setPendingSection('all')}
                >
                  All
                </button>
                {sectionOptions.map((s) => (
                  <button
                    key={s.key}
                    type="button"
                    className={`sg-pill${pendingSection === s.key ? ' active' : ''}`}
                    onClick={() => setPendingSection(s.key)}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Apply / Cancel */}
          <div className="sg-filter-apply-row">
            <button
              type="button"
              className={`sg-apply-btn${hasFilterChanges ? ' changed' : ''}`}
              onClick={applyFilters}
            >
              {hasFilterChanges ? '✓ Apply Filter' : '✓ Applied'}
            </button>
            {hasFilterChanges && (
              <button
                type="button"
                className="sg-cancel-btn"
                onClick={() => { setPendingClass(classKey); setPendingSection(sectionKey); setPendingStatus(status); setFilterOpen(false); }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
