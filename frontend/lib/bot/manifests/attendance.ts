import type { BotAction, BotActionResult, BotModuleManifest } from '@/types/bot';
import { API_BASE_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

const markAbsentAction: BotAction = {
  id: 'mark-absent',
  label: 'Mark Absent',
  // Same permission code that gates the Attendance module in lib/routes.ts's
  // MODULES array — reuse it rather than inventing a second code for the bot.
  requiredPermissionCode: 'student_info.student_attendance.view',
  requiresConfirmation: true,
  description: 'Mark a student absent for a given date with a reason.',
  parameters: {
    student_id: { type: 'number', description: 'Student ID', required: true },
    attendance_date: { type: 'date', description: 'Date of absence, YYYY-MM-DD', required: true },
    notes: { type: 'string', description: 'Reason for absence', required: true },
  },
  execute: async (params): Promise<BotActionResult> => {
    const token = getAccessToken();
    const res = await fetch(`${API_BASE_URL}/api/v1/attendance/student-attendance/chatbot-mark/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        student_id: params.student_id,
        attendance_type: 'A',
        notes: params.notes,
        attendance_date: params.attendance_date,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, message: (err as { detail?: string; error?: { message?: string } }).detail || err?.error?.message || 'Failed to mark attendance.' };
    }
    const data = await res.json();
    return { success: true, message: `Marked ${data.student_name ?? 'student'} absent.`, data };
  },
};

export const attendanceManifest: BotModuleManifest = {
  id: 'attendance',
  label: 'Attendance',
  entity: {
    // Marking absence targets a Student entity, so this manifest searches
    // the same endpoint the students manifest does — the target of its
    // action is a student, not an attendance record.
    endpoint: '/api/v1/students/students/',
    searchFields: ['search'],
    displayFields: ['fullName', 'admissionNo', 'className', 'section'],
  },
  keywords: [
    'absent', 'attendance', 'mark absent', 'sick', 'ill', 'not coming',
    'present', 'report absence',
  ],
  actions: [markAbsentAction],
  requiredFeatureFlag: 'attendance_enabled',
};
