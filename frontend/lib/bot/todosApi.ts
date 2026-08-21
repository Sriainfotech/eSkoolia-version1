import { API_BASE_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

export interface RemoteTodo {
  id: number;
  text: string;
  category: string;
  priority: string;
  dueAt: string | null;
  aiGenerated: boolean;
  aiReason: string;
  completed: boolean;
}

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/** apps/todos/ (TodoItem) — already existed and already backs the
 *  dashboard's Smart To-Do widget. The bot's own To-Do panel (previously
 *  eskoolia_todos localStorage-only) now shares this same endpoint. */
export async function listTodos(): Promise<RemoteTodo[]> {
  const res = await fetch(`${API_BASE_URL}/api/user/todos/`, { headers: authHeaders() });
  return res.ok ? res.json() : [];
}

export async function createTodo(text: string): Promise<RemoteTodo | null> {
  const res = await fetch(`${API_BASE_URL}/api/user/todos/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ text }),
  });
  return res.ok ? res.json() : null;
}

export async function toggleTodo(id: number, completed: boolean): Promise<RemoteTodo | null> {
  const res = await fetch(`${API_BASE_URL}/api/user/todos/${id}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ completed }),
  });
  return res.ok ? res.json() : null;
}

export async function deleteTodo(id: number): Promise<boolean> {
  const res = await fetch(`${API_BASE_URL}/api/user/todos/${id}/`, { method: 'DELETE', headers: authHeaders() });
  return res.ok;
}
