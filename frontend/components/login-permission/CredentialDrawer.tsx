'use client';

import { useState } from 'react';
import { X, Eye, EyeOff, Loader2, Copy, Check } from 'lucide-react';
import { loginPermissionApi } from '@/lib/login-permission/api';
import { initials } from '@/lib/login-permission/utils';
import type { LPUser } from '@/lib/login-permission/types';
import { SetInitialPasswordModal } from './SetInitialPasswordModal';

interface Props {
  user: LPUser;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function CredentialDrawer({ user, onClose, onSuccess, onError }: Props) {
  const [loading, setLoading]       = useState(false);
  const [result, setResult]         = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [copied, setCopied]         = useState(false);
  const [showInitialModal, setShowInitialModal] = useState(false);
  const isNew = !user.lastLogin;

  async function handleAction(action: 'reset_temp' | 'set_initial') {
    setLoading(true);
    try {
      const res = await loginPermissionApi.singleCredential(user.id, action);
      setResult(res.passwordBackup);
      onSuccess(res.message);
    } catch {
      onError('Failed to update credentials');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-[120] bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed right-0 top-0 bottom-0 z-[130] w-full max-w-sm bg-[var(--bg-1,#fff)] border-l border-[var(--bd,#dbe4f0)] shadow-2xl flex flex-col animate-[slideInRight_.2s_ease]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--bd,#dbe4f0)]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white"
              style={{ background: 'var(--pu,#3b5bdb)' }}
            >
              {initials(user.name)}
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--ink-1,#0f172a)] leading-tight">
                {user.name}
              </p>
              <p className="text-xs text-[var(--ink-3,#64748b)]">
                {user.staffId}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--ink-3,#64748b)] hover:bg-[var(--bg-0,#f8fafc)] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* User info card */}
          <div className="rounded-xl border border-[var(--bd,#dbe4f0)] bg-[var(--bg-0,#f8fafc)] p-4 text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-[var(--ink-3,#64748b)]">Role</span>
              <span className="font-medium text-[var(--ink-1,#0f172a)]">{user.role}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3,#64748b)]">Email</span>
              <span className="font-medium text-[var(--ink-1,#0f172a)] truncate max-w-[180px]">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3,#64748b)]">Login Access</span>
              <span
                className={`font-medium ${user.loginAccess ? 'text-emerald-600' : 'text-red-500'}`}
              >
                {user.loginAccess ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--ink-3,#64748b)]">Last Login</span>
              <span className="font-medium text-[var(--ink-1,#0f172a)]">
                {user.lastLogin
                  ? new Date(user.lastLogin).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
                  : 'Never'}
              </span>
            </div>
            {user.mustChange && (
              <div className="mt-1 text-xs text-amber-600 bg-amber-50 rounded-lg px-2.5 py-1.5">
                Must change password on next login
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--ink-3,#64748b)]">
              Credential Actions
            </p>

            {/* Reset temp password — always available */}
            <button
              disabled={loading}
              onClick={() => handleAction('reset_temp')}
              className="w-full px-4 py-3 rounded-xl border border-[var(--bd,#dbe4f0)] hover:border-[var(--pu,#3b5bdb)] hover:bg-[var(--pu-soft,#e0eaff)] transition-colors disabled:opacity-50 text-left"
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-sm font-medium text-[var(--ink-1,#0f172a)]">
                  Reset password
                </p>
                <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-[var(--ink-3,#64748b)] leading-relaxed">
                System generates a secure random password and emails it to {user.email}. A one-time backup copy is shown here. Use this whenever the user has a working email.
              </p>
              {loading && (
                <Loader2 size={13} className="mt-2 animate-spin text-[var(--pu,#3b5bdb)]" />
              )}
            </button>

            {/* Set initial password — only if never logged in */}
            {isNew && (
              <button
                disabled={loading}
                onClick={() => setShowInitialModal(true)}
                className="w-full px-4 py-3 rounded-xl border border-[var(--bd,#dbe4f0)] hover:border-amber-400 hover:bg-amber-50 transition-colors disabled:opacity-50 text-left"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-[var(--ink-1,#0f172a)]">
                    Set initial password
                  </p>
                  <span className="text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                    No-email fallback
                  </span>
                </div>
                <p className="text-xs text-[var(--ink-3,#64748b)] leading-relaxed">
                  You type the password yourself — for onboarding a user with no working email, so you can share it directly. Available only because this user has never logged in.
                </p>
              </button>
            )}
          </div>

          {/* Result: show temp password */}
          {result && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2 animate-[fadeIn_.2s_ease]">
              <p className="text-xs font-semibold text-emerald-700">
                Temporary Password
              </p>
              <div className="flex items-center gap-2">
                <input
                  readOnly
                  type={showPassword ? 'text' : 'password'}
                  value={result}
                  className="flex-1 font-mono text-sm bg-white border border-emerald-200 rounded-lg px-3 py-2 outline-none"
                />
                <button
                  onClick={() => setShowPassword((v) => !v)}
                  className="p-2 rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
                <button
                  onClick={handleCopy}
                  className="p-2 rounded-lg border border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-100 transition-colors"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
              <p className="text-xs text-emerald-600">
                The user will be required to change this on next login.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--bd,#dbe4f0)]">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-xl border border-[var(--bd,#dbe4f0)] text-sm font-medium text-[var(--ink-2,#475569)] hover:bg-[var(--bg-0,#f8fafc)] transition-colors"
          >
            Close
          </button>
        </div>
      </div>

      {/* Set Initial Password modal */}
      {showInitialModal && (
        <SetInitialPasswordModal
          user={user}
          onClose={() => setShowInitialModal(false)}
          onSuccess={(msg, pwd) => {
            setShowInitialModal(false);
            if (pwd) setResult(pwd);
            onSuccess(msg);
          }}
          onError={onError}
        />
      )}
    </>
  );
}
