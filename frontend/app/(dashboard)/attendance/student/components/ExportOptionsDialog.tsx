'use client';
import React, { useEffect, useMemo, useState } from 'react';

export type ExportScope = 'day' | 'month' | 'range';

export interface ExportOptions {
  scope: ExportScope;
  date: string;        // YYYY-MM-DD (for 'day')
  dateFrom: string;    // for 'range'
  dateTo: string;      // for 'range'
  month: string;       // YYYY-MM (for 'month')
  classId: string;     // 'all' or numeric id
  sectionId: string;   // 'all' or numeric id
}

export interface ClassOption { id: string; name: string; sections?: { id: string; name: string }[] }

export interface ExportDialogConfig {
  defaultDate: string;
  classes: ClassOption[];
  initialClassId?: string;
  initialSectionId?: string;
}

interface DialogState extends ExportDialogConfig {
  resolve: (result: ExportOptions | null) => void;
}

let openExportDialog: ((cfg: ExportDialogConfig) => Promise<ExportOptions | null>) | null = null;

export function exportOptionsDialog(cfg: ExportDialogConfig): Promise<ExportOptions | null> {
  if (!openExportDialog) {
    return Promise.resolve({
      scope: 'day',
      date: cfg.defaultDate,
      dateFrom: cfg.defaultDate,
      dateTo: cfg.defaultDate,
      month: cfg.defaultDate.slice(0, 7),
      classId: cfg.initialClassId ?? 'all',
      sectionId: cfg.initialSectionId ?? 'all',
    });
  }
  return openExportDialog(cfg);
}

export default function ExportOptionsDialogHost() {
  const [state, setState] = useState<DialogState | null>(null);
  const [scope, setScope] = useState<ExportScope>('month');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [classId, setClassId] = useState('all');
  const [sectionId, setSectionId] = useState('all');

  useEffect(() => {
    openExportDialog = (cfg) =>
      new Promise((resolve) => {
        setScope('month');
        setDate(cfg.defaultDate);
        setMonth(cfg.defaultDate.slice(0, 7));
        setDateFrom(cfg.defaultDate);
        setDateTo(cfg.defaultDate);
        setClassId(cfg.initialClassId ?? 'all');
        setSectionId(cfg.initialSectionId ?? 'all');
        setState({ ...cfg, resolve });
      });
    return () => { openExportDialog = null; };
  }, []);

  const sections = useMemo(() => {
    if (!state) return [];
    if (classId === 'all') return [];
    const cls = state.classes.find((c) => String(c.id) === String(classId));
    return cls?.sections ?? [];
  }, [state, classId]);

  if (!state) return null;

  const close = (result: ExportOptions | null) => {
    state.resolve(result);
    setState(null);
  };

  const submit = () => {
    close({ scope, date, month, dateFrom, dateTo, classId, sectionId });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-4" onClick={() => close(null)}>
      <div
        role="dialog"
        aria-modal="true"
        className="bg-white rounded-2xl shadow-2xl w-[520px] max-w-full overflow-hidden border border-[#E6E6EC]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 pt-5 pb-2 border-b border-[#F0F0F6]">
          <h3 className="text-[15px] font-semibold text-[#0B0B14] m-0">Export Attendance Report</h3>
          <p className="text-[12px] text-[#6B6B7A] mt-1 m-0">Choose the date range and filter for the Excel report.</p>
        </div>

        <div className="px-6 py-4 space-y-4">
          {/* Scope */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA0AE] mb-2">Date Range</label>
            <div className="grid grid-cols-3 gap-2">
              {(['day', 'month', 'range'] as ExportScope[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  className={`h-9 px-3 text-[12px] font-semibold rounded-lg border transition-colors ${
                    scope === s
                      ? 'bg-[#4729F4] text-white border-[#4729F4]'
                      : 'bg-white text-[#3A3A4A] border-[#E6E6EC] hover:bg-[#F4F4F8]'
                  }`}
                >
                  {s === 'day' ? 'Single Day' : s === 'month' ? 'Whole Month' : 'Custom Range'}
                </button>
              ))}
            </div>
          </div>

          {/* Inputs depending on scope */}
          {scope === 'day' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA0AE] mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#E6E6EC] text-[13px] outline-none focus:border-[#4729F4]"
              />
            </div>
          )}
          {scope === 'month' && (
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA0AE] mb-1.5">Month</label>
              <input
                type="month"
                value={month}
                onChange={(e) => setMonth(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[#E6E6EC] text-[13px] outline-none focus:border-[#4729F4]"
              />
            </div>
          )}
          {scope === 'range' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA0AE] mb-1.5">From</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#E6E6EC] text-[13px] outline-none focus:border-[#4729F4]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA0AE] mb-1.5">To</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full h-9 px-3 rounded-lg border border-[#E6E6EC] text-[13px] outline-none focus:border-[#4729F4]"
                />
              </div>
            </div>
          )}

          {/* Class / Section */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA0AE] mb-1.5">Class</label>
              <select
                value={classId}
                onChange={(e) => { setClassId(e.target.value); setSectionId('all'); }}
                className="w-full h-9 px-2 rounded-lg border border-[#E6E6EC] text-[13px] outline-none focus:border-[#4729F4] bg-white"
              >
                <option value="all">All Classes</option>
                {state.classes.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-bold uppercase tracking-wide text-[#9CA0AE] mb-1.5">Section</label>
              <select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                disabled={classId === 'all' || sections.length === 0}
                className="w-full h-9 px-2 rounded-lg border border-[#E6E6EC] text-[13px] outline-none focus:border-[#4729F4] bg-white disabled:bg-[#F4F4F8] disabled:text-[#9CA0AE]"
              >
                <option value="all">All Sections</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6]">
          <button
            type="button"
            onClick={() => close(null)}
            className="h-9 px-4 text-[12px] font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg hover:bg-[#F4F4F8] transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            className="h-9 px-4 text-[12px] font-semibold text-white bg-[#4729F4] hover:bg-[#3a21d4] rounded-lg transition-colors"
          >
            Download Excel
          </button>
        </div>
      </div>
    </div>
  );
}
