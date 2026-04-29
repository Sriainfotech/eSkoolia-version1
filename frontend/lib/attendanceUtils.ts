'use client';

import { toast } from 'react-toastify';

export type AttendanceCsvStatus = 'P' | 'A' | 'L';

export interface AttendanceRecord {
  student_id: number;
  date: string;
  status: AttendanceCsvStatus | '';
  absent_reason: string;
  arrival_time: string;
  sign_in: string;
  sign_out: string;
  pickup_by: string;
  lunch: 'Yes' | 'No' | '';
  notes: string;
}

export interface AttendanceImportRowError {
  row: number;
  message: string;
}

const ATTENDANCE_CSV_COLUMNS: Array<keyof AttendanceRecord> = [
  'student_id',
  'date',
  'status',
  'absent_reason',
  'arrival_time',
  'sign_in',
  'sign_out',
  'pickup_by',
  'lunch',
  'notes',
];

const REQUIRED_COLUMNS: Array<keyof AttendanceRecord> = ['student_id', 'date', 'status'];
const VALID_STATUSES = new Set<AttendanceCsvStatus>(['P', 'A', 'L']);
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  cells.push(current);
  return cells.map((cell) => cell.trim());
}

function isValidDate(value: string): boolean {
  if (!DATE_PATTERN.test(value)) return false;
  const [yearText, monthText, dayText] = value.split('-');
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const candidate = new Date(Date.UTC(year, month - 1, day));
  return candidate.getUTCFullYear() === year && candidate.getUTCMonth() === month - 1 && candidate.getUTCDate() === day;
}

function isValidTime(value: string): boolean {
  return TIME_PATTERN.test(value);
}

function normalizeLunchValue(value: string): AttendanceRecord['lunch'] | null {
  if (!value) return '';
  const normalized = value.trim().toLowerCase();
  if (normalized === 'yes') return 'Yes';
  if (normalized === 'no') return 'No';
  return null;
}

function escapeCsvValue(value: string | number | null | undefined): string {
  const normalized = value == null ? '' : String(value);
  if (/[",\n\r]/.test(normalized)) {
    return `"${normalized.replace(/"/g, '""')}"`;
  }
  return normalized;
}

function buildDefaultFilename(records: AttendanceRecord[], providedFilename?: string): string {
  if (providedFilename?.trim()) return providedFilename.trim();
  const sourceDate = records.find((record) => DATE_PATTERN.test(record.date))?.date ?? new Date().toISOString().slice(0, 10);
  return `attendance_export_${sourceDate}.csv`;
}

export async function importAttendanceFromCSV(file: File): Promise<{
  records: AttendanceRecord[];
  errors: AttendanceImportRowError[];
}> {
  const text = (await file.text()).replace(/^\uFEFF/, '');
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    const errors = [{ row: 0, message: 'CSV file is empty.' }];
    toast.error('CSV import failed. The selected file is empty.', { autoClose: 5000 });
    return { records: [], errors };
  }

  const headerCells = parseCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const columnIndex = new Map<string, number>();
  headerCells.forEach((header, index) => {
    columnIndex.set(header, index);
  });

  const missingColumns = REQUIRED_COLUMNS.filter((column) => !columnIndex.has(column));
  if (missingColumns.length > 0) {
    const errors = [{ row: 1, message: `Missing required columns: ${missingColumns.join(', ')}` }];
    toast.error(`CSV import failed. Missing required columns: ${missingColumns.join(', ')}`, { autoClose: 6000 });
    return { records: [], errors };
  }

  const records: AttendanceRecord[] = [];
  const errors: AttendanceImportRowError[] = [];

  for (let lineIndex = 1; lineIndex < lines.length; lineIndex += 1) {
    const rowNumber = lineIndex + 1;
    const cells = parseCsvLine(lines[lineIndex]);
    const raw = Object.fromEntries(
      ATTENDANCE_CSV_COLUMNS.map((column) => [column, cells[columnIndex.get(column) ?? -1] ?? ''])
    ) as Record<keyof AttendanceRecord, string>;

    const studentId = Number.parseInt(raw.student_id, 10);
    if (!Number.isInteger(studentId) || studentId <= 0) {
      errors.push({ row: rowNumber, message: 'student_id must be a positive integer.' });
      continue;
    }

    if (!isValidDate(raw.date)) {
      errors.push({ row: rowNumber, message: 'date must use YYYY-MM-DD format.' });
      continue;
    }

    const status = raw.status.toUpperCase() as AttendanceCsvStatus;
    if (!VALID_STATUSES.has(status)) {
      errors.push({ row: rowNumber, message: 'status must be one of P, A, or L.' });
      continue;
    }

    const timeFields: Array<keyof Pick<AttendanceRecord, 'arrival_time' | 'sign_in' | 'sign_out'>> = [
      'arrival_time',
      'sign_in',
      'sign_out',
    ];
    const invalidTimeField = timeFields.find((field) => raw[field] && !isValidTime(raw[field]));
    if (invalidTimeField) {
      errors.push({ row: rowNumber, message: `${invalidTimeField} must use HH:MM format.` });
      continue;
    }

    const lunch = normalizeLunchValue(raw.lunch);
    if (lunch === null) {
      errors.push({ row: rowNumber, message: 'lunch must be Yes or No when provided.' });
      continue;
    }

    records.push({
      student_id: studentId,
      date: raw.date,
      status,
      absent_reason: raw.absent_reason,
      arrival_time: raw.arrival_time,
      sign_in: raw.sign_in,
      sign_out: raw.sign_out,
      pickup_by: raw.pickup_by,
      lunch,
      notes: raw.notes,
    });
  }

  if (errors.length === 0) {
    toast.success(`Imported ${records.length} attendance record(s) from CSV.`, { autoClose: 3500 });
  } else if (records.length > 0) {
    toast.warn(`Imported ${records.length} record(s); ${errors.length} row(s) failed validation.`, { autoClose: 5000 });
  } else {
    toast.error(`CSV import failed. ${errors.length} row(s) need attention.`, { autoClose: 6000 });
  }

  return { records, errors };
}

export function exportAttendanceToCSV(records: AttendanceRecord[], filename?: string): string {
  const csv = [
    ATTENDANCE_CSV_COLUMNS.join(','),
    ...records.map((record) =>
      ATTENDANCE_CSV_COLUMNS
        .map((column) => escapeCsvValue(record[column]))
        .join(',')
    ),
  ].join('\r\n');

  if (typeof window !== 'undefined') {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const objectUrl = window.URL.createObjectURL(blob);
    const link = window.document.createElement('a');
    link.href = objectUrl;
    link.setAttribute('download', buildDefaultFilename(records, filename));
    window.document.body.appendChild(link);
    link.click();
    window.document.body.removeChild(link);
    window.URL.revokeObjectURL(objectUrl);
  }

  return csv;
}