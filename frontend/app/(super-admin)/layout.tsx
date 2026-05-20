'use client';

import React, { ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ToastContainer } from 'react-toastify';
import AuthGate from '@/components/layout/AuthGate';
import { apiRequestWithRefresh } from '@/lib/api-auth';
import { clearAuthTokens, getAccessToken, getRefreshToken } from '@/lib/auth';
import { API_BASE_URL } from '@/lib/api';
import { LayoutDashboard, Building2, CreditCard, FileText, Settings, LogOut, ChevronDown } from 'lucide-react';
import '@/styles/super-admin.css';
import 'react-toastify/dist/ReactToastify.css';

interface MePayload {
  is_superuser?: boolean;
  role?: string;
  email?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
}

const NAV_TABS = [
  { label: 'Dashboard',  href: '/super-admin/dashboard', icon: LayoutDashboard },
  { label: 'Schools',    href: '/super-admin/schools',   icon: Building2       },
  { label: 'Billing',    href: '/super-admin/billing',   icon: CreditCard      },
  { label: 'Audit Log',  href: '/super-admin/audit',     icon: FileText        },
  { label: 'Policies',   href: '/super-admin/policies',  icon: Settings        },
];

export default function SuperAdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [me, setMe] = useState<MePayload | null>(null);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const displayName = `${me?.first_name ?? ''} ${me?.last_name ?? ''}`.trim() || me?.username || 'Super Admin';
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || 'SA';

  useEffect(() => {
    let mounted = true;
    const loadProfile = async () => {
      try {
        const profile = await apiRequestWithRefresh<MePayload>('/api/v1/auth/me/');
        if (!mounted) return;
        setMe(profile);
        if (!profile?.is_superuser && profile?.role !== 'super_admin') {
          router.replace('/home');
          return;
        }
        setIsAuthorized(true);
      } catch {
        if (mounted) router.replace('/login');
      }
    };
    void loadProfile();
    return () => { mounted = false; };
  }, [router]);

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    const access = getAccessToken();
    const refresh = getRefreshToken();
    try {
      if (refresh) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (access) headers.Authorization = `Bearer ${access}`;
        await fetch(`${API_BASE_URL}/api/v1/auth/logout/`, {
          method: 'POST', headers, body: JSON.stringify({ refresh }),
        });
      }
    } finally {
      clearAuthTokens();
      router.replace('/login');
      setLoggingOut(false);
    }
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center" style={{ background: 'var(--bg-0)' }}>
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-b-2" style={{ borderColor: 'var(--pu)' }} />
          <p className="mt-4 text-sm" style={{ color: 'var(--ink-2)' }}>Verifying access…</p>
        </div>
      </div>
    );
  }

  return (
    <AuthGate>
      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-0)', overflow: 'hidden' }}>

        {/* ── Top Navigation Bar ─────────────────────────────────────── */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 50,
          height: 56,
          background: '#fff',
          borderBottom: '1px solid #e5e7eb',
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 0,
        }}>
          {/* Logo */}
          <Link href="/home" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 8, marginRight: 32 }}>
            <span style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'linear-gradient(135deg, #6D28D9 0%, #4F46E5 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontWeight: 700, fontSize: 16,
            }}>e</span>
            <span style={{ fontWeight: 700, fontSize: 16, color: '#111827', letterSpacing: '-0.02em' }}>
              eskoolia
            </span>
            <span style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.08em',
              color: '#6D28D9', background: '#EDE9FE',
              padding: '2px 6px', borderRadius: 4, marginLeft: 2,
            }}>SUPER</span>
          </Link>

          {/* Nav Tabs */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
            {NAV_TABS.map(({ label, href, icon: Icon }) => {
              const active = pathname?.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 6,
                    height: 36, padding: '0 14px', borderRadius: 8,
                    textDecoration: 'none', fontSize: 13.5, fontWeight: active ? 600 : 450,
                    color: active ? '#6D28D9' : '#374151',
                    background: active ? '#EDE9FE' : 'transparent',
                    transition: 'background 150ms, color 150ms',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#F5F3FF'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <Icon size={15} strokeWidth={1.8} />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right — user avatar + dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setAvatarOpen(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                height: 36, padding: '0 10px', borderRadius: 8,
                border: '1px solid #e5e7eb', background: '#fff',
                cursor: 'pointer', fontSize: 13,
              }}
            >
              <span style={{
                width: 28, height: 28, borderRadius: '50%',
                background: 'linear-gradient(135deg, #6D28D9, #4F46E5)',
                color: '#fff', fontWeight: 700, fontSize: 12,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>{initials}</span>
              <span style={{ fontWeight: 500, color: '#111827' }}>{displayName}</span>
              <span style={{ fontSize: 10, color: '#6D28D9', fontWeight: 700, letterSpacing: '0.06em' }}>SUPER ADMIN</span>
              <ChevronDown size={13} style={{ color: '#6b7280' }} />
            </button>

            {avatarOpen && (
              <div
                style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: 6,
                  background: '#fff', border: '1px solid #e5e7eb',
                  borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.10)',
                  minWidth: 180, padding: '6px 0', zIndex: 100,
                }}
                onMouseLeave={() => setAvatarOpen(false)}
              >
                <div style={{ padding: '8px 14px 10px', borderBottom: '1px solid #f3f4f6' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{displayName}</div>
                  <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>{me?.email}</div>
                </div>
                <Link
                  href="/home"
                  onClick={() => setAvatarOpen(false)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', fontSize: 13, color: '#374151',
                    textDecoration: 'none',
                  }}
                >
                  Back to School ERP
                </Link>
                <button
                  onClick={handleLogout}
                  disabled={loggingOut}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    width: '100%', padding: '8px 14px', fontSize: 13,
                    color: '#DC2626', background: 'none', border: 'none',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                >
                  <LogOut size={14} />
                  {loggingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            )}
          </div>
        </header>

        {/* ── Page Content ─────────────────────────────────────────────── */}
        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '28px 32px' }}>
          <div style={{ maxWidth: 1400, margin: '0 auto' }}>
            {children}
          </div>
        </main>
      </div>
      <ToastContainer position="top-right" autoClose={4000} hideProgressBar newestOnTop closeOnClick pauseOnHover theme="light" />
    </AuthGate>
  );
}

