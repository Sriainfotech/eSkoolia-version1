'use client';

import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequestWithRefresh } from '@/lib/api-auth';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; school_class: number; name: string };
type ImportError = { row?: number; field?: string; message: string };
type ImportResponse = {
  success?: boolean;
  detail?: string;
  message?: string;
  data?: { imported: number; failed: number; errors: ImportError[] };
  imported_count?: number;
  failed_count?: number;
  error_details?: ImportError[];
};

interface ImportedDetails {
  classId: number;
  sectionId: number;
  date: string;
  imported: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: (details: ImportedDetails) => void;
  /** Push a transient toast on the parent page. */
  onNotify?: (message: string, tone: 'success' | 'error') => void;
}

function listData<T>(value: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value?.results || [];
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatDisplayDate(value: string) {
  if (!value) return '-';
  const parts = value.split('-');
  if (parts.length !== 3) return value;
  return `${parts[2]}-${parts[1]}-${parts[0]}`;
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileValidationError(file: File | null) {
  if (!file) return 'Please upload a file';
  const validType =
    ['text/csv', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'].includes(file.type) ||
    /\.(csv|xlsx|xls)$/i.test(file.name);
  if (!validType) return 'Upload a valid CSV or Excel file (.csv, .xlsx, .xls)';
  if (file.size > 5 * 1024 * 1024) return 'File size exceeds 5MB limit';
  return '';
}

function getReadableClassName(c: SchoolClass) {
  return c.class_name || c.name || `Class ${c.id}`;
}

export default function StudentAttendanceImportDialog({ open, onClose, onImported, onNotify }: Props) {
  const notify = (message: string, tone: 'success' | 'error') => {
    if (onNotify) onNotify(message, tone);
  };

  const summarizeFirstError = (errs: ImportError[]): string => {
    if (!errs || errs.length === 0) return '';
    const first = errs[0];
    const rowPart = first.row ? `Row ${first.row}` : 'Row ?';
    const fieldPart = first.field ? ` (${first.field})` : '';
    const more = errs.length > 1 ? ` (+${errs.length - 1} more)` : '';
    return `${rowPart}${fieldPart}: ${first.message}${more}`;
  };

  // Compact one-line summary used inside toast notifications. Strips long
  // remediation text and collapses whitespace so the toast stays single-line.
  const toToastLine = (text: string, max = 110): string => {
    const compact = text.replace(/\s+/g, ' ').trim();
    return compact.length > max ? `${compact.slice(0, max - 1)}\u2026` : compact;
  };

  const summarizeFirstErrorShort = (errs: ImportError[]): string => {
    if (!errs || errs.length === 0) return '';
    const first = errs[0];
    const rowPart = first.row ? `Row ${first.row}` : 'Row ?';
    const fieldPart = first.field ? ` ${first.field}` : '';
    // Keep only the first sentence of the message so the toast stays short.
    const shortMsg = String(first.message).split('.')[0].trim();
    const more = errs.length > 1 ? ` (+${errs.length - 1} more)` : '';
    return `${rowPart}${fieldPart}: ${shortMsg}${more}`;
  };
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate());
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [detailedErrors, setDetailedErrors] = useState<ImportError[]>([]);

  const [confirmOpen, setConfirmOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = useMemo(() => todayIsoDate(), []);

  // Body scroll lock + ESC
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Reset on close
  useEffect(() => {
    if (open) return;
    setApiError('');
    setSuccessMessage('');
    setImportResult(null);
    setDetailedErrors([]);
    setErrors({});
    setUploadProgress(0);
    setConfirmOpen(false);
  }, [open]);

  // Fully reset form fields every time the dialog is (re-)opened so the
  // previous class / section / file selection does not leak across imports.
  useEffect(() => {
    if (!open) return;
    setClassId('');
    setSectionId('');
    setSections([]);
    setAttendanceDate(todayIsoDate());
    setFile(null);
    setApiError('');
    setSuccessMessage('');
    setImportResult(null);
    setDetailedErrors([]);
    setErrors({});
    setUploadProgress(0);
    setConfirmOpen(false);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open]);

  // Load classes
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await apiRequestWithRefresh<{ classes: SchoolClass[] }>(
          '/api/v1/attendance/student-attendance/import/',
          { headers: { 'Content-Type': 'application/json' } },
        );
        if (cancelled) return;
        setClasses(data.classes || []);
        setSections([]);
      } catch {
        if (!cancelled) setApiError('Failed to load form data. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  const loadSectionsForClass = async (targetClassId: string) => {
    if (!targetClassId) {
      setSections([]); setSectionId('');
      return;
    }
    try {
      setSectionLoading(true);
      setSections([]); setSectionId('');
      try {
        const data = await apiRequestWithRefresh<Section[] | { results?: Section[] }>(
          `/api/v1/core/sections/?class=${encodeURIComponent(targetClassId)}&page_size=200`,
          { headers: { 'Content-Type': 'application/json' } },
        );
        setSections(listData(data));
      } catch {
        const fb = await apiRequestWithRefresh<Section[] | { results?: Section[] }>(
          `/api/v1/core/sections/?school_class=${encodeURIComponent(targetClassId)}&page_size=200`,
          { headers: { 'Content-Type': 'application/json' } },
        );
        setSections(listData(fb));
      }
    } catch {
      setApiError('Failed to load sections for selected class.');
    } finally {
      setSectionLoading(false);
    }
  };

  const filteredSections = useMemo(() => {
    const id = Number(classId);
    if (!id) return [];
    return sections.filter((s) => s.school_class === id);
  }, [classId, sections]);

  const selectedClass = useMemo(() => classes.find((c) => String(c.id) === classId), [classes, classId]);
  const selectedSection = useMemo(() => filteredSections.find((s) => String(s.id) === sectionId), [filteredSections, sectionId]);
  const fileError = useMemo(() => getFileValidationError(file), [file]);
  const canSubmit = Boolean(classId && sectionId && attendanceDate && file && !fileError && !saving && !loading && !sectionLoading);

  // Drag & drop
  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  };
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation();
    setDragActive(false);
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    const err = getFileValidationError(f);
    if (err) {
      setFile(null);
      setErrors((p) => ({ ...p, file: err }));
    } else {
      setFile(f);
      setErrors((p) => ({ ...p, file: '' }));
    }
  };
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const err = getFileValidationError(f);
    setFile(err ? null : f);
    setErrors((p) => ({ ...p, file: err }));
  };
  const clearFile = () => {
    setFile(null);
    setErrors((p) => ({ ...p, file: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const downloadSample = async () => {
    try {
      const token = getAccessToken();
      if (!token) {
        setApiError('Authentication required. Please login again.');
        return;
      }
      const resp = await fetch(`${API_BASE_URL}/api/v1/attendance/student-attendance/download-sample/`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const blob = await resp.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'student_attendance_sheet.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      setApiError('');
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Could not download sample file.');
    }
  };

  const downloadErrorReport = () => {
    if (detailedErrors.length === 0) return;
    const header = 'Row,Field,Error\n';
    const rows = detailedErrors
      .map((er) => `${er.row || 'N/A'},"${er.field || 'N/A'}","${(er.message || '').replace(/"/g, '""')}"`)
      .join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `attendance_import_errors_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!classId) next.classId = 'Please select a class';
    if (!sectionId) next.sectionId = 'Please select a section';
    if (!attendanceDate) next.attendanceDate = 'Please select an attendance date';
    else if (attendanceDate > today) next.attendanceDate = 'Cannot import attendance for future dates';
    const fe = getFileValidationError(file);
    if (fe) next.file = fe;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setApiError('Please fix the errors above before importing.');
      return;
    }
    setApiError(''); setSuccessMessage(''); setImportResult(null); setDetailedErrors([]);
    setConfirmOpen(true);
  };

  const confirmImport = async () => {
    if (!file) return;
    try {
      setSaving(true);
      setConfirmOpen(false);
      setUploadProgress(20);
      const fd = new FormData();
      fd.append('class', classId);
      fd.append('section', sectionId);
      fd.append('attendance_date', attendanceDate);
      fd.append('file', file);
      setUploadProgress(55);
      const resp = await apiRequestWithRefresh<ImportResponse>(
        '/api/v1/attendance/student-attendance/bulk-store/',
        { method: 'POST', headers: {}, body: fd },
      );
      setUploadProgress(85);

      const imported = Number(resp.data?.imported ?? resp.imported_count ?? 0);
      const failed = Number(resp.data?.failed ?? resp.failed_count ?? 0);
      const errs = resp.data?.errors || resp.error_details || [];

      const firstErrorSummary = summarizeFirstError(errs);
      const firstErrorShort = summarizeFirstErrorShort(errs);
      if (resp.success === false || failed > 0) {
        setImportResult({ imported, failed });
        setDetailedErrors(errs);
        if (imported <= 0) {
          const baseMsg =
            resp.message || resp.detail || `Failed to import. ${failed} error${failed === 1 ? '' : 's'} found.`;
          const fullMsg = firstErrorSummary ? `${baseMsg} — ${firstErrorSummary}` : baseMsg;
          setApiError(fullMsg);
          setSuccessMessage('');
          const toastMsg = firstErrorShort
            ? `Import failed (${failed}) — ${firstErrorShort}`
            : baseMsg;
          notify(toToastLine(toastMsg), 'error');
        } else {
          setApiError('');
          const partialMsg = `${imported} record${imported === 1 ? '' : 's'} imported, ${failed} failed`;
          setSuccessMessage(partialMsg);
          const toastMsg = firstErrorShort
            ? `${partialMsg} — ${firstErrorShort}`
            : partialMsg;
          notify(toToastLine(toastMsg), 'error');
        }
      } else {
        setApiError('');
        const okMsg = `Successfully imported ${imported} attendance record${imported === 1 ? '' : 's'}`;
        setSuccessMessage(okMsg);
        setFile(null);
        setImportResult(null);
        setDetailedErrors([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
        notify(okMsg, 'success');
        // Notify parent so it can refresh & jump to the imported class/section accordion.
        const cId = Number(classId);
        const sId = Number(sectionId);
        if (onImported && Number.isFinite(cId) && Number.isFinite(sId)) {
          onImported({ classId: cId, sectionId: sId, date: attendanceDate, imported });
        }
        // Auto-close after a short delay so the user sees the success state.
        window.setTimeout(() => onClose(), 900);
      }
      setUploadProgress(100);
      window.setTimeout(() => setUploadProgress(0), 500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      const details = (err as { details?: unknown } | null)?.details as ImportResponse | undefined;
      if (details && typeof details === 'object') {
        const imported = Number(details.data?.imported ?? details.imported_count ?? 0);
        const failed = Number(details.data?.failed ?? details.failed_count ?? 0);
        const errs = details.data?.errors || details.error_details || [];
        setImportResult({ imported, failed });
        setDetailedErrors(errs);
        const baseMsg = details.message || details.detail || msg;
        const firstErrorSummary = summarizeFirstError(errs);
        const firstErrorShort = summarizeFirstErrorShort(errs);
        const fullMsg = firstErrorSummary ? `${baseMsg} — ${firstErrorSummary}` : baseMsg;
        setApiError(fullMsg);
        const toastMsg = firstErrorShort
          ? `Import failed — ${firstErrorShort}`
          : baseMsg;
        notify(toToastLine(toastMsg), 'error');
      } else if (msg === '401') {
        setApiError('Session expired. Please log in again.');
        notify('Session expired. Please log in again.', 'error');
      } else {
        setApiError(msg);
        notify(msg, 'error');
      }
      setUploadProgress(0);
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Import Attendance"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[860px] my-auto overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F6] bg-white">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1A1A2E] m-0">Import Attendance</h2>
            <p className="text-xs text-[#6B6B80] mt-0.5 m-0">
              Upload a CSV or Excel file to bulk-import student attendance
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#6B6B80] hover:bg-[#F5F5FA] hover:text-[#1A1A2E] transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5">
          {/* Class + Section */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label htmlFor="att-class" className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">
                Select Class <span className="text-[#DC2626]">*</span>
              </label>
              <select
                id="att-class"
                value={classId}
                onChange={(e) => {
                  const v = e.target.value;
                  setClassId(v);
                  setSectionId('');
                  setErrors((p) => ({ ...p, classId: '' }));
                  void loadSectionsForClass(v);
                }}
                disabled={loading}
                className={`w-full h-10 text-sm rounded-lg border bg-white text-[#1A1A2E] px-3 focus:outline-none focus:ring-2 focus:ring-[#4729F4] disabled:bg-[#F5F5FA] ${
                  errors.classId ? 'border-[#DC2626]' : 'border-[#E6E6EC]'
                }`}
              >
                <option value="">Select Class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>{getReadableClassName(c)}</option>
                ))}
              </select>
              {errors.classId && <p className="text-[11px] text-[#DC2626] mt-1">{errors.classId}</p>}
            </div>

            <div>
              <label htmlFor="att-section" className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">
                Select Section <span className="text-[#DC2626]">*</span>
              </label>
              <select
                id="att-section"
                value={sectionId}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  setErrors((p) => ({ ...p, sectionId: '' }));
                }}
                disabled={!classId || loading || sectionLoading}
                className={`w-full h-10 text-sm rounded-lg border bg-white text-[#1A1A2E] px-3 focus:outline-none focus:ring-2 focus:ring-[#4729F4] disabled:bg-[#F5F5FA] ${
                  errors.sectionId ? 'border-[#DC2626]' : 'border-[#E6E6EC]'
                }`}
              >
                <option value="">{sectionLoading ? 'Loading sections…' : classId ? 'Select Section' : 'Select class first'}</option>
                {filteredSections.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {errors.sectionId && <p className="text-[11px] text-[#DC2626] mt-1">{errors.sectionId}</p>}
            </div>
          </div>

          {/* Date */}
          <div className="mb-4">
            <label htmlFor="att-date" className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">
              Attendance Date <span className="text-[#DC2626]">*</span>
            </label>
            <input
              id="att-date"
              type="date"
              value={attendanceDate}
              max={today}
              onChange={(e) => {
                setAttendanceDate(e.target.value);
                setErrors((p) => ({ ...p, attendanceDate: '' }));
              }}
              disabled={loading}
              className={`w-full h-10 text-sm rounded-lg border bg-white text-[#1A1A2E] px-3 focus:outline-none focus:ring-2 focus:ring-[#4729F4] ${
                errors.attendanceDate ? 'border-[#DC2626]' : 'border-[#E6E6EC]'
              }`}
            />
            <p className="text-[11px] text-[#6B6B80] mt-1">Format: DD-MM-YYYY</p>
            {errors.attendanceDate && <p className="text-[11px] text-[#DC2626] mt-1">{errors.attendanceDate}</p>}
          </div>

          {/* Upload */}
          <div className="mb-4">
            <div className="flex items-center justify-between flex-wrap gap-2 mb-1.5">
              <label className="block text-xs font-semibold text-[#1A1A2E]">
                Upload File <span className="text-[#DC2626]">*</span>
              </label>
              <button
                type="button"
                onClick={downloadSample}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#E6E6EC] bg-white text-xs font-medium text-[#1A1A2E] hover:bg-[#F5F5FA] transition"
              >
                <svg width="13" height="13" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M7.5 1v9m0 0L4.5 7m3 3L10.5 7M2 12h11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Download Sample (XLSX)
              </button>
            </div>

            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileInputRef.current?.click();
                }
              }}
              className={`rounded-xl border-2 border-dashed px-6 py-8 text-center cursor-pointer transition ${
                dragActive
                  ? 'border-[#4729F4] bg-[#F0EFFE]'
                  : errors.file
                    ? 'border-[#DC2626] bg-[#FEF2F2]'
                    : 'border-[#E6E6EC] bg-[#FAFAFD] hover:border-[#4729F4] hover:bg-[#F0EFFE]'
              }`}
            >
              <div className="mx-auto mb-2 inline-flex h-12 w-12 items-center justify-center rounded-full bg-white border border-[#E6E6EC]">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#4729F4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
              </div>
              <p className="text-sm font-semibold text-[#1A1A2E] m-0">
                {file ? file.name : 'Drag & drop your file here'}
              </p>
              <p className="text-xs text-[#6B6B80] mt-1 m-0">
                {file ? `${formatFileSize(file.size)} · CSV or Excel file` : 'or click to select (.csv, .xlsx, .xls, max 5MB)'}
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading || saving}
            />
            <div className="mt-2 flex items-center justify-between flex-wrap gap-2">
              {file ? (
                <button
                  type="button"
                  onClick={clearFile}
                  className="text-xs font-medium text-[#DC2626] hover:underline"
                >
                  Remove file
                </button>
              ) : <span />}
              <p className="text-[11px] text-[#6B6B80] m-0">Allowed: CSV/XLSX/XLS · Max 5MB</p>
            </div>
            {errors.file && <p className="text-[11px] text-[#DC2626] mt-1">{errors.file}</p>}
          </div>

          {/* Progress */}
          {saving && (
            <div className="mb-4">
              <div className="h-1.5 rounded-full bg-[#E6E6EC] overflow-hidden">
                <div
                  className="h-full bg-[#4729F4] transition-all"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
              <p className="text-[11px] text-[#6B6B80] mt-1">Uploading…</p>
            </div>
          )}

          {/* Alerts */}
          {apiError && (
            <div className="mb-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#991B1B]">
              {apiError}
            </div>
          )}
          {successMessage && (
            <div
              className={
                importResult && importResult.failed > 0
                  ? 'mb-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#92400E]'
                  : 'mb-3 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-[12px] text-[#065F46]'
              }
            >
              {successMessage}
              {importResult && importResult.failed > 0 && (
                <span className="block mt-0.5 text-[11px] text-[#92400E]/90">
                  Scroll down to see the per-row errors and download the report.
                </span>
              )}
            </div>
          )}

          {/* Detailed errors */}
          {detailedErrors.length > 0 && (
            <div className="mb-3 rounded-xl border border-[#E6E6EC] bg-white">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F0F0F6]">
                <h4 className="text-xs font-bold text-[#1A1A2E] m-0">
                  Import Errors ({detailedErrors.length})
                </h4>
                <button
                  type="button"
                  onClick={downloadErrorReport}
                  className="text-xs font-medium text-[#4729F4] hover:underline"
                >
                  Download report
                </button>
              </div>
              <div className="max-h-44 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#FAFAFD] text-[#6B6B80] uppercase text-[10px]">
                      <th className="px-3 py-2 text-left font-semibold">Row</th>
                      <th className="px-3 py-2 text-left font-semibold">Field</th>
                      <th className="px-3 py-2 text-left font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedErrors.slice(0, 10).map((er, i) => (
                      <tr key={i} className="border-t border-[#F0F0F6]">
                        <td className="px-3 py-1.5 text-[#3A3A4A]">{er.row || 'N/A'}</td>
                        <td className="px-3 py-1.5 text-[#3A3A4A]">{er.field || 'N/A'}</td>
                        <td className="px-3 py-1.5 text-[#991B1B]">{er.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {detailedErrors.length > 10 && (
                  <p className="px-3 py-2 text-[11px] text-[#6B6B80] m-0">
                    … and {detailedErrors.length - 10} more (see report)
                  </p>
                )}
              </div>
            </div>
          )}

          {importResult && (
            <div className="mb-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#92400E]">
              <strong>{importResult.imported}</strong> imported, <strong>{importResult.failed}</strong> failed.
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6]">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-9 px-4 text-sm font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg hover:bg-[#F5F5FA] transition disabled:opacity-40"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              if (validateForm()) setConfirmOpen(true);
              else setApiError('Please fix the errors above before importing.');
            }}
            disabled={!canSubmit}
            className="h-9 px-5 text-sm font-bold text-white bg-[#4729F4] rounded-lg hover:bg-[#3a21d4] transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <circle cx="12" cy="12" r="9" strokeOpacity="0.25" />
                  <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                </svg>
                Importing…
              </>
            ) : (
              <>
                <svg width="14" height="14" viewBox="0 0 15 15" fill="none" aria-hidden="true">
                  <path d="M7.5 1v9m0 0L4.5 7m3 3L10.5 7M2 12h11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                Import Attendance
              </>
            )}
          </button>
        </div>
      </div>

      {/* Confirm sub-modal */}
      {confirmOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4"
          onClick={() => setConfirmOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-[440px] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[#F0F0F6]">
              <h3 className="text-base font-bold text-[#1A1A2E] m-0">Confirm Attendance Import</h3>
              <p className="text-xs text-[#6B6B80] mt-1 m-0">Review the details before importing.</p>
            </div>
            <div className="px-5 py-4 space-y-2 text-xs">
              <div className="flex justify-between"><span className="text-[#6B6B80]">Class</span><strong className="text-[#1A1A2E]">{selectedClass ? getReadableClassName(selectedClass) : '-'}</strong></div>
              <div className="flex justify-between"><span className="text-[#6B6B80]">Section</span><strong className="text-[#1A1A2E]">{selectedSection?.name || '-'}</strong></div>
              <div className="flex justify-between"><span className="text-[#6B6B80]">Date</span><strong className="text-[#1A1A2E]">{formatDisplayDate(attendanceDate)}</strong></div>
              <div className="flex justify-between gap-2"><span className="text-[#6B6B80]">File</span><strong className="text-[#1A1A2E] truncate min-w-0">{file ? `${file.name} (${formatFileSize(file.size)})` : '-'}</strong></div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 bg-[#FAFAFD] border-t border-[#F0F0F6]">
              <button
                type="button"
                onClick={() => setConfirmOpen(false)}
                className="h-9 px-4 text-sm font-semibold text-[#3A3A4A] bg-white border border-[#E6E6EC] rounded-lg hover:bg-[#F5F5FA]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmImport}
                className="h-9 px-5 text-sm font-bold text-white bg-[#4729F4] rounded-lg hover:bg-[#3a21d4]"
              >
                Confirm Import
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
