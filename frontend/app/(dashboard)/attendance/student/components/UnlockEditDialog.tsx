'use client';
import React, { useState, useEffect, useRef } from 'react';
import { getAccessToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';

interface Props {
  onUnlock: () => void;
  onClose: () => void;
}

export default function UnlockEditDialog({ onUnlock, onClose }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Small delay so the modal is painted before focus
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError('Please enter your password.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      // Retrieve the current user's username via the /me/ endpoint
      const token = getAccessToken();
      const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      if (!meRes.ok) {
        setError('Could not verify your identity. Please refresh and try again.');
        return;
      }
      const me = (await meRes.json()) as { username?: string; email?: string };
      const loginValue = me.username ?? me.email ?? '';
      if (!loginValue) {
        setError('Could not determine your login identity. Please refresh and try again.');
        return;
      }

      // Re-authenticate with the entered password
      const loginRes = await fetch(`${API_BASE_URL}/api/v1/auth/login/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: loginValue, password }),
      });

      if (!loginRes.ok) {
        setError('Incorrect password. Please try again.');
        setPassword('');
        inputRef.current?.focus();
        return;
      }

      onUnlock();
    } catch {
      setError('Verification failed. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-6 mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="w-7 h-7 rounded-lg bg-[#FDF1DC] flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-[#B4721B]" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                  <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              </span>
              <h2 className="text-[15px] font-bold text-[#0B0B14] m-0">Unlock Past Date Editing</h2>
            </div>
            <p className="text-[12px] text-[#6B6B7B] leading-relaxed">
              Re-enter your password to enable editing for this past date.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#9CA0AE] hover:text-[#3A3A4A] shrink-0 mt-0.5"
            aria-label="Close"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-4">
          <div>
            <label className="text-[11px] font-semibold text-[#6B6B7B] uppercase tracking-wide block mb-1.5">
              Password
            </label>
            <input
              ref={inputRef}
              type="password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              placeholder="Enter your login password"
              autoComplete="current-password"
              className="w-full h-10 px-3 rounded-lg border border-[#E6E6EC] text-[13px] text-[#0B0B14] focus:outline-none focus:ring-2 focus:ring-[#4729F4]/30 focus:border-[#4729F4] transition"
            />
            {error && (
              <p className="text-[11px] text-[#C2264E] mt-1.5 flex items-center gap-1">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <circle cx={12} cy={12} r={10} />
                  <path d="m15 9-6 6M9 9l6 6" />
                </svg>
                {error}
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="h-9 px-4 rounded-lg border border-[#E6E6EC] bg-white text-[12px] font-semibold text-[#3A3A4A] hover:bg-[#F4F4F8] transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !password.trim()}
              className="h-9 px-5 rounded-lg bg-[#4729F4] text-white text-[12px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed enabled:hover:bg-[#3a21d4] transition-colors"
            >
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}>
                    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                  </svg>
                  Verifying…
                </span>
              ) : 'Unlock Editing'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
