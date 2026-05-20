'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, ShieldCheck } from 'lucide-react';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || '/api';

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('school_erp_access_token');
}

export default function ChangePasswordPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const token = getAccessToken();
    if (!token) router.replace('/login');
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    const token = getAccessToken();
    if (!token) {
      router.replace('/login');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/auth/change-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ new_password: newPassword }),
      });

      const data = await res.json().catch(() => ({})) as { ok?: boolean; detail?: string; message?: string };

      if (!res.ok) {
        setError(data.detail || data.message || 'Failed to change password. Please try again.');
        return;
      }

      setSuccess(true);
      setTimeout(() => router.replace('/home'), 1500);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-0,#f1f5f9)] px-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border border-[var(--bd,#dbe4f0)] overflow-hidden">
        {/* Top accent */}
        <div className="h-1.5 bg-gradient-to-r from-[var(--pu,#3b5bdb)] to-indigo-400" />

        <div className="p-7">
          {/* Icon + heading */}
          <div className="flex flex-col items-center text-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-[var(--pu-soft,#e0eaff)] flex items-center justify-center mb-3">
              <ShieldCheck size={22} className="text-[var(--pu,#3b5bdb)]" />
            </div>
            <h1 className="text-lg font-bold text-[var(--ink-1,#0f172a)]">Set Your Password</h1>
            <p className="text-sm text-[var(--ink-3,#64748b)] mt-1">
              You must set a new password before continuing.
            </p>
          </div>

          {success ? (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
              <p className="text-sm font-semibold text-emerald-700">Password changed!</p>
              <p className="text-xs text-emerald-600 mt-1">Redirecting you to the dashboard…</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* New password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--ink-2,#475569)]">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => { setNewPassword(e.target.value); setError(''); }}
                    placeholder="Min. 6 characters"
                    required
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-[var(--bd,#dbe4f0)] text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--pu,#3b5bdb)] focus:border-[var(--pu,#3b5bdb)] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3,#94a3b8)] hover:text-[var(--ink-2)]"
                  >
                    {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--ink-2,#475569)]">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => { setConfirmPassword(e.target.value); setError(''); }}
                    placeholder="Re-enter password"
                    required
                    className="w-full h-10 px-3 pr-10 rounded-lg border border-[var(--bd,#dbe4f0)] text-sm font-mono outline-none focus:ring-2 focus:ring-[var(--pu,#3b5bdb)] focus:border-[var(--pu,#3b5bdb)] transition-colors"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3,#94a3b8)] hover:text-[var(--ink-2)]"
                  >
                    {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <p className="text-xs text-red-500 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-[var(--pu,#3b5bdb)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Saving…' : 'Set New Password'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
