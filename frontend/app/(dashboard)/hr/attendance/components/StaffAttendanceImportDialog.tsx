'use client';

import React, { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { apiRequestWithRefresh } from '@/lib/api-auth';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';
import type { Department } from '@/types/hr';

type ImportError = { row?: number; field?: string; message: string };
type ImportResponse = {
  success?: boolean;
  message?: string;
  data?: { imported: number; failed: number; errors: ImportError[] };
};

interface Props {
  open: boolean;
  onClose: () => void;
  onImported?: () => void;
  onNotify?: (message: string, tone: 'success' | 'error') => void;
}

function listData<T>(value: T[] | { results?: T[] } | null | undefined): T[] {
  if (Array.isArray(value)) return value;
  return value?.results || [];
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
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

export default function StaffAttendanceImportDialog({ open, onClose, onImported, onNotify }: Props) {
  const notify = (message: string, tone: 'success' | 'error') => {
    if (onNotify) onNotify(message, tone);
  };

  const [departments, setDepartments] = useState<Department[]>([]);
  const [departmentId, setDepartmentId] = useState('');
  const [deptDropdownOpen, setDeptDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate());
  const [file, setFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [detailedErrors, setDetailedErrors] = useState<ImportError[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const today = useMemo(() => todayIsoDate(), []);

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

  useEffect(() => {
    if (!open) return;
    setDepartmentId('');
    setDeptDropdownOpen(false);
    setAttendanceDate(todayIsoDate());
    setFile(null);
    setApiError('');
    setSuccessMessage('');
    setImportResult(null);
    setDetailedErrors([]);
    setErrors({});
    setUploadProgress(0);
    setDragActive(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await apiRequestWithRefresh<Department[] | { results?: Department[] }>(
          '/api/v1/hr/departments/?page_size=200',
          { headers: { 'Content-Type': 'application/json' } }
        );
        if (cancelled) return;
        setDepartments(listData(data));
      } catch {
        if (!cancelled) setApiError('Failed to load departments. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDeptDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fileError = useMemo(() => getFileValidationError(file), [file]);
  const canSubmit = Boolean(departmentId && attendanceDate && file && !fileError && !saving && !loading);

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
      const resp = await fetch(`${API_BASE_URL}/api/v1/hr/staff-attendance/download-sample/`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const blob = await resp.blob();
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'staff_attendance_sheet.xlsx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
      setApiError('');
    } catch (e) {
      setApiError(e instanceof Error ? e.message : 'Could not download sample file.');
    }
  };

  const validateForm = () => {
    const next: Record<string, string> = {};
    if (!departmentId) next.departmentId = 'Please select a department';
    if (!attendanceDate) next.attendanceDate = 'Please select an attendance date';
    else if (attendanceDate > today) next.attendanceDate = 'Cannot import attendance for future dates';
    const fe = getFileValidationError(file);
    if (fe) next.file = fe;
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!validateForm()) {
      setApiError('Please fix the errors above before importing.');
      return;
    }
    if (!file) return;
    setApiError(''); setSuccessMessage(''); setImportResult(null); setDetailedErrors([]);
    setSaving(true);
    setUploadProgress(20);

    try {
      const fd = new FormData();
      fd.append('department_id', departmentId);
      fd.append('attendance_date', attendanceDate);
      fd.append('file', file);
      
      setUploadProgress(55);
      const resp = await apiRequestWithRefresh<ImportResponse>(
        '/api/v1/hr/staff-attendance/import/',
        { method: 'POST', body: fd }
      );
      setUploadProgress(85);

      const imported = resp.data?.imported ?? 0;
      const failed = resp.data?.failed ?? 0;
      
      if (resp.success) {
        setSuccessMessage(`Successfully imported ${imported} records.`);
        notify(`Imported ${imported} records.`, 'success');
        if (onImported) onImported();
        setTimeout(onClose, 1000);
      } else {
        setImportResult({ imported, failed });
        setDetailedErrors(resp.data?.errors ?? []);
        setApiError(resp.message || 'Failed to import attendance.');
        notify('Import completed with errors.', 'error');
      }
      setUploadProgress(100);
      window.setTimeout(() => setUploadProgress(0), 500);
    } catch (err: any) {
      const msg = err instanceof Error ? err.message : 'Operation failed';
      setApiError(msg);
      notify(msg, 'error');
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
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-[860px] my-auto overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F0F0F6] bg-white">
          <div className="min-w-0">
            <h2 className="text-lg font-bold text-[#1A1A2E] m-0">Import Staff Attendance</h2>
            <p className="text-xs text-[#6B6B80] mt-0.5 m-0">
              Upload a CSV or Excel file to bulk-import staff attendance
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-[#6B6B80] hover:bg-[#F5F5FA] hover:text-[#1A1A2E] transition"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="relative" ref={dropdownRef}>
              <label className="block text-xs font-semibold text-[#1A1A2E] mb-1.5">
                Select Department <span className="text-[#DC2626]">*</span>
              </label>
              <button
                type="button"
                onClick={() => setDeptDropdownOpen(!deptDropdownOpen)}
                disabled={loading}
                className={`w-full h-10 text-sm rounded-lg border bg-white text-[#1A1A2E] px-3 flex items-center justify-between focus:outline-none focus:ring-2 focus:ring-[#4729F4] disabled:bg-[#F5F5FA] ${
                  errors.departmentId ? 'border-[#DC2626]' : 'border-[#E6E6EC]'
                }`}
              >
                <span className="truncate">
                  {loading 
                    ? 'Loading departments…' 
                    : departments.find(d => String(d.id) === departmentId)?.name || 'Select Department'}
                </span>
                <svg className="w-4 h-4 text-[#6B6B80]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {deptDropdownOpen && (
                <div className="absolute z-50 w-full mt-1 bg-white border border-[#E6E6EC] rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  <div 
                    className="px-3 py-2 text-sm text-[#3A3A4A] cursor-pointer hover:bg-[#F5F5FA] transition-colors"
                    onClick={() => {
                      setDepartmentId('');
                      setErrors((p) => ({ ...p, departmentId: '' }));
                      setDeptDropdownOpen(false);
                    }}
                  >
                    Select Department
                  </div>
                  {departments.map((d) => (
                    <div 
                      key={d.id} 
                      className={`px-3 py-2 text-sm cursor-pointer transition-colors ${String(d.id) === departmentId ? 'bg-[#F0EFFE] text-[#4729F4] font-semibold' : 'text-[#3A3A4A] hover:bg-[#F5F5FA]'}`}
                      onClick={() => {
                        setDepartmentId(String(d.id));
                        setErrors((p) => ({ ...p, departmentId: '' }));
                        setDeptDropdownOpen(false);
                      }}
                    >
                      {d.name || `Department ${d.id}`}
                    </div>
                  ))}
                </div>
              )}
              {errors.departmentId && <p className="text-[11px] text-[#DC2626] mt-1">{errors.departmentId}</p>}
            </div>

            <div>
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
          </div>

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

          {apiError && (
            <div className="mb-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2 text-[12px] text-[#991B1B]">
              {apiError}
            </div>
          )}
          
          {successMessage && (
            <div className="mb-3 rounded-lg border border-[#A7F3D0] bg-[#ECFDF5] px-3 py-2 text-[12px] text-[#065F46]">
              {successMessage}
            </div>
          )}

          {detailedErrors.length > 0 && (
            <div className="mb-3 rounded-xl border border-[#E6E6EC] bg-white">
              <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#F0F0F6]">
                <h4 className="text-xs font-bold text-[#1A1A2E] m-0">Import Errors ({detailedErrors.length})</h4>
              </div>
              <div className="max-h-44 overflow-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-[#FAFAFD] text-[#6B6B80] uppercase text-[10px]">
                      <th className="px-3 py-2 text-left font-semibold">Row</th>
                      <th className="px-3 py-2 text-left font-semibold">Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detailedErrors.slice(0, 20).map((er, i) => (
                      <tr key={i} className="border-t border-[#F0F0F6]">
                        <td className="px-3 py-1.5 text-[#3A3A4A]">{er.row || 'N/A'}</td>
                        <td className="px-3 py-1.5 text-[#991B1B]">{er.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {importResult && importResult.failed > 0 && (
            <div className="mb-3 rounded-lg border border-[#FDE68A] bg-[#FFFBEB] px-3 py-2 text-[12px] text-[#92400E]">
              <strong>{importResult.imported}</strong> imported, <strong>{importResult.failed}</strong> failed.
            </div>
          )}
        </form>

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
            type="submit"
            onClick={submit}
            disabled={!canSubmit}
            className="h-9 px-5 text-sm font-bold text-white bg-[#4729F4] rounded-lg hover:bg-[#3a21d4] transition disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
          >
            {saving ? 'Importing…' : 'Import Attendance'}
          </button>
        </div>
      </div>
    </div>
  );
}
