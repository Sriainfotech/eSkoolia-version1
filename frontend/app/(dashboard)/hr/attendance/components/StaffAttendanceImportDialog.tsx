"use client";

import React, { FormEvent, useEffect, useRef, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { getAccessToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";

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
  onNotify?: (message: string, tone: "success" | "error") => void;
}

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function formatFileSize(bytes: number) {
  if (!Number.isFinite(bytes) || bytes < 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function StaffAttendanceImportDialog({ open, onClose, onImported, onNotify }: Props) {
  const notify = (message: string, tone: "success" | "error") => {
    if (onNotify) onNotify(message, tone);
  };

  const [attendanceDate, setAttendanceDate] = useState(todayIsoDate());
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [detailedErrors, setDetailedErrors] = useState<ImportError[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setAttendanceDate(todayIsoDate());
    setFile(null);
    setApiError("");
    setSuccessMessage("");
    setImportResult(null);
    setDetailedErrors([]);
    setErrors({});
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const downloadSample = async () => {
    try {
      const token = getAccessToken();
      const resp = await fetch(`${API_BASE_URL}/api/v1/hr/staff-attendance/download-sample/`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      const blob = await resp.blob();
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = "staff_attendance_sheet.xlsx";
      link.click();
    } catch (e) {
      setApiError(e instanceof Error ? e.message : "Could not download sample file.");
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) {
      setErrors({ file: "Please select a file" });
      return;
    }
    setApiError(""); setSuccessMessage(""); setImportResult(null); setDetailedErrors([]);
    setSaving(true);
    
    try {
      const fd = new FormData();
      fd.append("attendance_date", attendanceDate);
      fd.append("file", file);
      
      const resp = await apiRequestWithRefresh<ImportResponse>(
        "/api/v1/hr/staff-attendance/import/",
        { method: "POST", body: fd }
      );
      
      const imported = resp.data?.imported ?? 0;
      const failed = resp.data?.failed ?? 0;
      
      if (resp.success) {
        setSuccessMessage(`Successfully imported ${imported} records.`);
        notify(`Imported ${imported} records.`, "success");
        if (onImported) onImported();
        setTimeout(onClose, 1000);
      } else {
        setImportResult({ imported, failed });
        setDetailedErrors(resp.data?.errors ?? []);
        setApiError(resp.message || "Failed to import attendance.");
        notify("Import completed with errors.", "error");
      }
    } catch (err: any) {
        const msg = err instanceof Error ? err.message : "Operation failed";
        setApiError(msg);
        notify(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 py-8 overflow-y-auto" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-[600px] my-auto overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="px-6 py-4 border-b border-[#F0F0F6]">
          <h2 className="text-lg font-bold text-[#1A1A2E] m-0">Import Staff Attendance</h2>
          <p className="text-xs text-[#6B6B80] mt-0.5 m-0">Upload a CSV or Excel file to bulk-import staff attendance</p>
        </div>
        
        <form onSubmit={submit} className="p-6">
          <div className="mb-4">
            <label className="block text-xs font-semibold mb-1.5">Date</label>
            <input type="date" value={attendanceDate} onChange={e => setAttendanceDate(e.target.value)} className="w-full h-10 border rounded px-3 text-sm" />
          </div>
          
          <div className="mb-4">
            <div className="flex justify-between mb-2">
                <label className="block text-xs font-semibold">File</label>
                <button type="button" onClick={downloadSample} className="text-xs text-[#4729F4] hover:underline">Download Sample</button>
            </div>
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept=".csv,.xlsx" className="w-full text-sm" />
            {errors.file && <p className="text-xs text-red-500 mt-1">{errors.file}</p>}
          </div>
          
          {saving && <p className="text-xs text-blue-500">Importing...</p>}
          {apiError && <p className="text-xs text-red-500 mb-2">{apiError}</p>}
          {successMessage && <p className="text-xs text-green-600 mb-2">{successMessage}</p>}
          
          {detailedErrors.length > 0 && (
              <div className="max-h-40 overflow-auto bg-gray-50 text-xs p-2 rounded">
                  {detailedErrors.map((e, i) => (
                      <div key={i} className="text-red-600 mb-1">Row {e.row}: {e.message}</div>
                  ))}
              </div>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded text-sm">Cancel</button>
            <button type="submit" disabled={saving || !file} className="px-4 py-2 bg-[#4729F4] text-white rounded text-sm disabled:opacity-50">Import</button>
          </div>
        </form>
      </div>
    </div>
  );
}
