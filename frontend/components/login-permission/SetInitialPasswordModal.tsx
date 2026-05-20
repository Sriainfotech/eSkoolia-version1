'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, Loader2, Copy, Check, ShieldCheck, KeyRound } from 'lucide-react';
import { loginPermissionApi } from '@/lib/login-permission/api';
import type { LPUser } from '@/lib/login-permission/types';

interface Props {
  user: LPUser;
  onClose: () => void;
  onSuccess: (msg: string, passwordBackup: string) => void;
  onError: (msg: string) => void;
}

const DEFAULT_PASSWORD = '123456';

export function SetInitialPasswordModal({ user, onClose, onSuccess, onError }: Props) {
  const [mode, setMode] = useState<'default' | 'manual' | null>(null);
  const [manualPwd, setManualPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [validationError, setValidationError] = useState('');

  async function handleSubmit() {
    if (!mode) return;
    if (mode === 'manual') {
      if (!manualPwd.trim()) {
        setValidationError('Please enter a password.');
        return;
      }
      if (manualPwd.trim().length < 6) {
        setValidationError('Password must be at least 6 characters.');
        return;
      }
    }
    setValidationError('');
    setLoading(true);
    try {
      const res = await loginPermissionApi.setInitialPassword(
        user.id,
        mode,
        mode === 'manual' ? manualPwd.trim() : undefined
      );
      if (!res.ok) {
        onError(res.message || 'Failed to set password.');
        return;
      }
      setResult(res.passwordBackup || (mode === 'default' ? DEFAULT_PASSWORD : manualPwd));
      onSuccess(res.message, res.passwordBackup || '');
    } catch {
      onError('Unexpected error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* clipboard unavailable */ }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={result ? undefined : onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[var(--bd,#dbe4f0)] flex flex-col animate-[fadeIn_.15s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bd,#dbe4f0)]">
          <div>
            <p className="text-sm font-semibold text-[var(--ink-1,#0f172a)]">Set Initial Password</p>
            <p className="text-xs text-[var(--ink-3,#64748b)] mt-0.5">{user.name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-1.5 rounded-lg text-[var(--ink-3,#64748b)] hover:bg-[var(--bg-0,#f8fafc)] transition-colors disabled:opacity-40"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* After success — show password backup */}
          {result ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
                <p className="text-xs font-semibold text-emerald-700">Password set successfully</p>
                <div className="flex items-center gap-2">
                  <input
                    readOnly
                    type={showPwd ? 'text' : 'password'}
                    value={result}
                    className="flex-1 font-mono text-sm bg-white border border-emerald-200 rounded-lg px-3 py-2 outline-none"
                  />
                  <button
                    onClick={() => setShowPwd(v => !v)}
                    className="p-2 rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button
                    onClick={() => handleCopy(result)}
                    className="p-2 rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100 transition-colors"
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </div>
                <p className="text-xs text-emerald-600">
                  The user must change this password on first login.
                </p>
              </div>
              <button
                onClick={onClose}
                className="w-full py-2.5 rounded-xl border border-[var(--bd,#dbe4f0)] text-sm font-medium text-[var(--ink-2,#475569)] hover:bg-[var(--bg-0,#f8fafc)] transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Option cards */}
              <p className="text-xs text-[var(--ink-3,#64748b)]">
                Choose how to set the password for <span className="font-medium text-[var(--ink-1)]">{user.name}</span>:
              </p>

              <div className="space-y-2">
                {/* Default password option */}
                <button
                  onClick={() => { setMode('default'); setValidationError(''); }}
                  className={[
                    'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                    mode === 'default'
                      ? 'border-[var(--pu,#3b5bdb)] bg-[var(--pu-soft,#e0eaff)]'
                      : 'border-[var(--bd,#dbe4f0)] hover:border-[var(--pu,#3b5bdb)]',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <ShieldCheck size={14} className="text-[var(--pu,#3b5bdb)] shrink-0" />
                    <span className="text-sm font-medium text-[var(--ink-1,#0f172a)]">
                      Use Default Password
                    </span>
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[var(--pu-soft,#e0eaff)] text-[var(--pu,#3b5bdb)]">
                      Quick
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-3,#64748b)] pl-5">
                    Sets the password to <span className="font-mono font-semibold">{DEFAULT_PASSWORD}</span>. User must change it on first login.
                  </p>
                </button>

                {/* Manual password option */}
                <button
                  onClick={() => { setMode('manual'); setValidationError(''); }}
                  className={[
                    'w-full text-left px-4 py-3 rounded-xl border transition-colors',
                    mode === 'manual'
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-[var(--bd,#dbe4f0)] hover:border-amber-400',
                  ].join(' ')}
                >
                  <div className="flex items-center gap-2 mb-0.5">
                    <KeyRound size={14} className="text-amber-500 shrink-0" />
                    <span className="text-sm font-medium text-[var(--ink-1,#0f172a)]">
                      Set Manual Password
                    </span>
                    <span className="ml-auto text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                      Custom
                    </span>
                  </div>
                  <p className="text-xs text-[var(--ink-3,#64748b)] pl-5">
                    You type the password — share it with the user directly. Must change on first login.
                  </p>
                </button>
              </div>

              {/* Manual password input */}
              {mode === 'manual' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-[var(--ink-2,#475569)]">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPwd ? 'text' : 'password'}
                      value={manualPwd}
                      onChange={e => { setManualPwd(e.target.value); setValidationError(''); }}
                      placeholder="Min. 6 characters"
                      className={[
                        'w-full h-10 px-3 pr-10 rounded-lg border text-sm font-mono outline-none transition-colors',
                        validationError
                          ? 'border-red-400 focus:ring-2 focus:ring-red-200'
                          : 'border-[var(--bd,#dbe4f0)] focus:ring-2 focus:ring-[var(--pu,#3b5bdb)] focus:border-[var(--pu,#3b5bdb)]',
                      ].join(' ')}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPwd(v => !v)}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--ink-3,#94a3b8)] hover:text-[var(--ink-2)]"
                    >
                      {showPwd ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {validationError && (
                    <p className="text-xs text-red-500">{validationError}</p>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="flex-1 py-2.5 rounded-xl border border-[var(--bd,#dbe4f0)] text-sm font-medium text-[var(--ink-2,#475569)] hover:bg-[var(--bg-0,#f8fafc)] transition-colors disabled:opacity-40"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!mode || loading}
                  className="flex-1 py-2.5 rounded-xl bg-[var(--pu,#3b5bdb)] text-white text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 size={14} className="animate-spin" />}
                  {loading ? 'Setting…' : 'Set Password'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
