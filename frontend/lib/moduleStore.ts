'use client';
import { useState, useEffect, useCallback } from 'react';
import { MODULES } from './routes';

const LS_KEY = 'eskoolia_module_prefs_v1';

function computeDefault(): Record<string, boolean> {
  return Object.fromEntries(MODULES.map(m => [m.id, true]));
}

let _store: Record<string, boolean> = computeDefault();
let _loaded = false;
const _listeners = new Set<() => void>();

function _notifyAll() { _listeners.forEach(fn => fn()); }

function _loadOnce() {
  if (_loaded) return;
  _loaded = true;
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Record<string, boolean>;
      _store = { ..._store, ...parsed };
    }
  } catch { /* ignore */ }
}

export function useModuleStore() {
  const [, setTick] = useState(0);

  useEffect(() => {
    _loadOnce();
    setTick(v => v + 1);
    const update = () => setTick(v => v + 1);
    _listeners.add(update);
    return () => { _listeners.delete(update); };
  }, []);

  const toggle = useCallback((id: string) => {
    _store = { ..._store, [id]: !_store[id] };
    try { localStorage.setItem(LS_KEY, JSON.stringify(_store)); } catch { /* ignore */ }
    _notifyAll();
  }, []);

  const isEnabled = (id: string): boolean => _store[id] ?? true;

  const enabledCount = MODULES.filter(m => _store[m.id] ?? true).length;

  return { isEnabled, toggle, enabledCount };
}
