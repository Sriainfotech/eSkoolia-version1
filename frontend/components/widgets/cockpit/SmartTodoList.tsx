'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { Plus, Check, Trash2, Info, Sparkles } from 'lucide-react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface TodoItem {
  id: string;
  text: string;
  category: 'academic' | 'ops' | 'comms' | 'personal';
  priority: string;
  dueAt: string | null;
  aiGenerated: boolean;
  aiReason?: string;
  completed: boolean;
}

type Tab = 'all' | 'academic' | 'ops' | 'comms' | 'personal';

const TABS: { key: Tab; label: string; color: string; bg: string }[] = [
  { key: 'all',      label: 'All',      color: '#6D4AFF', bg: '#EEEAFF' },
  { key: 'academic', label: 'Academic', color: '#3B82F6', bg: '#DBEAFE' },
  { key: 'ops',      label: 'Ops',      color: '#F59E0B', bg: '#FEF3C7' },
  { key: 'comms',    label: 'Comms',    color: '#22C55E', bg: '#D1FAE5' },
  { key: 'personal', label: 'Personal', color: '#DB2777', bg: '#FCE7F3' },
];

const MOCK_TODOS: TodoItem[] = [
  { id: '1', text: 'Class 10 syllabus at 64% — Term 1 exam in 18 days', category: 'academic', priority: 'high', dueAt: null, aiGenerated: true, aiReason: 'Syllabus completion stuck for 5 days', completed: false },
  { id: '2', text: '5 students failed Math mid-term — schedule remedial?', category: 'academic', priority: 'normal', dueAt: null, aiGenerated: true, aiReason: 'Identified from mid-term result sheet', completed: false },
  { id: '3', text: 'Bus Route 7 maintenance overdue (8 days)', category: 'ops', priority: 'high', dueAt: null, aiGenerated: true, aiReason: 'Last maintenance logged 8 days ago', completed: false },
  { id: '4', text: '12 fees overdue — send reminder?', category: 'ops', priority: 'normal', dueAt: null, aiGenerated: true, aiReason: 'Fee due date passed 3 days ago', completed: false },
  { id: '5', text: '5 parent callbacks queued', category: 'comms', priority: 'high', dueAt: null, aiGenerated: false, completed: false },
  { id: '6', text: 'Term holiday SMS — schedule for Friday', category: 'comms', priority: 'normal', dueAt: 'Fri', aiGenerated: false, completed: false },
];

function formatDue(due: string | null) {
  if (!due) return null;
  try {
    const d = new Date(due);
    if (isNaN(d.getTime())) return due;
    const diff = Math.floor((d.getTime() - Date.now()) / 86400000);
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Today';
    if (diff === 1) return 'Tomorrow';
    return `in ${diff}d`;
  } catch { return due; }
}

export function SmartTodoList() {
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    try { return (localStorage.getItem('eskoolia_todoTab') as Tab) || 'all'; } catch { return 'all'; }
  });
  const [todos, setTodos] = useState<TodoItem[]>(MOCK_TODOS);
  const [input, setInput] = useState('');
  const [tooltip, setTooltip] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const fetchTodos = useCallback((tab: Tab) => {
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/user/todos/${tab !== 'all' ? `?category=${tab}` : ''}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (Array.isArray(d)) setTodos(d); })
      .catch(() => {});
  }, []);

  useEffect(() => { fetchTodos(activeTab); }, [activeTab, fetchTodos]);

  const switchTab = (t: Tab) => {
    setActiveTab(t);
    try { localStorage.setItem('eskoolia_todoTab', t); } catch { /* ignore */ }
  };

  const addTodo = () => {
    if (!input.trim()) return;
    const catMatch = input.match(/#(academic|ops|comms|personal)/i);
    const category = (catMatch?.[1]?.toLowerCase() as TodoItem['category']) || (activeTab === 'all' ? 'personal' : activeTab as TodoItem['category']);
    const text = input.replace(/#\w+/g, '').trim();
    const newItem: TodoItem = { id: Date.now().toString(), text, category, priority: 'normal', dueAt: null, aiGenerated: false, completed: false };
    setTodos(prev => [newItem, ...prev]);
    setInput('');
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/user/todos/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ text, category }),
    }).catch(() => {});
  };

  const toggle = (id: string) => {
    setTodos(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));
    const todo = todos.find(t => t.id === id);
    if (!todo) return;
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/user/todos/${id}/`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ completed: !todo.completed }),
    }).catch(() => {});
  };

  const deleteTodo = (id: string) => {
    setTodos(prev => prev.filter(t => t.id !== id));
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/user/todos/${id}/`, {
      method: 'DELETE',
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  };

  const visible = activeTab === 'all' ? todos : todos.filter(t => t.category === activeTab);
  const pending = visible.filter(t => !t.completed).length;

  return (
    <div style={{ background: '#fff', border: '1px solid var(--bd)', borderRadius: 16, padding: 14, boxShadow: 'var(--sh-1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Check size={14} color="var(--pu)" strokeWidth={2.5} />
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-1)' }}>Smart To-Do</span>
        </div>
        <span style={{ fontSize: 10.5, color: 'var(--ink-3)' }}>{pending} pending</span>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => switchTab(t.key)}
            style={{
              fontSize: 10, fontWeight: 700, padding: '3px 9px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: activeTab === t.key ? t.bg : 'var(--bg-2)',
              color: activeTab === t.key ? t.color : 'var(--ink-3)',
              flexShrink: 0, transition: 'all 0.15s',
            }}
          >{t.label}</button>
        ))}
      </div>

      {/* Add input */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addTodo()}
          placeholder="Add a task… (#academic #ops #comms)"
          style={{
            flex: 1, height: 32, padding: '0 10px', border: '1px solid var(--bd)', borderRadius: 8,
            fontSize: 12, background: 'var(--bg-0)', outline: 'none', color: 'var(--ink-1)',
          }}
        />
        <button onClick={addTodo} style={{ width: 32, height: 32, border: 'none', borderRadius: 8, background: 'var(--pu)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Plus size={14} color="#fff" strokeWidth={2.5} />
        </button>
      </div>

      {/* Todo items */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 260, overflowY: 'auto' }}>
        {visible.length === 0 && (
          <div style={{ fontSize: 12, color: 'var(--ink-3)', textAlign: 'center', padding: '16px 0' }}>No tasks — enjoy the clear day ✓</div>
        )}
        {visible.map(t => {
          const tabInfo = TABS.find(tab => tab.key === t.category) ?? TABS[0];
          const due = formatDue(t.dueAt);
          return (
            <div
              key={t.id}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: 8, padding: '7px 6px', borderRadius: 8,
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-0)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
            >
              {/* Custom checkbox */}
              <button
                onClick={() => toggle(t.id)}
                style={{
                  width: 16, height: 16, borderRadius: 4, border: `1.5px solid ${t.completed ? 'var(--pu)' : 'var(--bd)'}`,
                  background: t.completed ? 'var(--pu)' : 'transparent',
                  cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginTop: 1,
                }}
              >
                {t.completed && <Check size={9} color="#fff" strokeWidth={3} />}
              </button>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, color: t.completed ? 'var(--ink-3)' : 'var(--ink-1)', textDecoration: t.completed ? 'line-through' : 'none', lineHeight: 1.4 }}>
                  {t.text}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 9.5, fontWeight: 700, color: tabInfo.color, background: tabInfo.bg, padding: '1px 6px', borderRadius: 20 }}>
                    {tabInfo.label}
                  </span>
                  {due && (
                    <span style={{ fontSize: 9.5, fontFamily: 'monospace', color: due === 'Overdue' ? '#E0463A' : 'var(--ink-3)' }}>{due}</span>
                  )}
                  {t.aiGenerated && (
                    <span
                      title={t.aiReason}
                      onClick={() => setTooltip(tooltip === t.id ? null : (t.id ?? null))}
                      style={{ display: 'flex', alignItems: 'center', gap: 2, cursor: 'pointer' }}
                    >
                      <Sparkles size={9} color="#a78bfa" strokeWidth={2} />
                      <span style={{ fontSize: 9.5, color: '#a78bfa' }}>AI</span>
                    </span>
                  )}
                </div>
                {tooltip === t.id && t.aiReason && (
                  <div style={{ marginTop: 5, fontSize: 11, background: '#EEEAFF', color: '#4F35CC', borderRadius: 6, padding: '5px 8px', lineHeight: 1.4 }}>
                    <Info size={9} strokeWidth={2} style={{ display: 'inline', marginRight: 4 }} />
                    {t.aiReason}
                  </div>
                )}
              </div>

              <button
                onClick={() => deleteTodo(t.id)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, opacity: 0, transition: 'opacity 0.15s', flexShrink: 0 }}
                className="todo-delete-btn"
              >
                <Trash2 size={11} color="var(--ink-3)" />
              </button>
            </div>
          );
        })}
      </div>

      <style>{`.todo-delete-btn { opacity: 0 !important; } div:hover > .todo-delete-btn { opacity: 0.6 !important; } .todo-delete-btn:hover { opacity: 1 !important; }`}</style>
    </div>
  );
}
