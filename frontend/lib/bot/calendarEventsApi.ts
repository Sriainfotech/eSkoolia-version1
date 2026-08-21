import { API_BASE_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface CalendarEvent {
  id: number;
  weekStartDate: string;
  dayIndex: number;
  time: string;
  title: string;
  category: string;
  note: string;
  done: boolean;
  aiGenerated: boolean;
  created_at: string;
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** apps/assistant/models.py::PersonalCalendarEvent — the bot's planner-task
 *  intent and WeekAhead.tsx's own planner UI both read/write here. NOT the
 *  same thing as the still-unbuilt /api/calendar/week-ahead/ academic
 *  calendar feed — see the model docstring before merging the two. */
export async function listCalendarEvents(weekStart: string): Promise<CalendarEvent[]> {
  const res = await fetch(`${API_BASE_URL}/api/v1/assistant/calendar-events/?weekStart=${weekStart}`, {
    headers: authHeaders(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function createCalendarEvent(weekStart: string, event: {
  dayIndex: number; time: string; title: string; category: string; note?: string; aiGenerated?: boolean;
}): Promise<CalendarEvent | null> {
  const res = await fetch(`${API_BASE_URL}/api/v1/assistant/calendar-events/?weekStart=${weekStart}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ weekStart, ...event }),
  });
  return res.ok ? res.json() : null;
}

export async function updateCalendarEvent(id: number, patch: Partial<Pick<CalendarEvent, 'done' | 'title' | 'time' | 'category' | 'note'>>): Promise<CalendarEvent | null> {
  const res = await fetch(`${API_BASE_URL}/api/v1/assistant/calendar-events/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify(patch),
  });
  return res.ok ? res.json() : null;
}

export async function deleteCalendarEvent(id: number): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/v1/assistant/calendar-events/${id}/`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  return res.ok;
}
