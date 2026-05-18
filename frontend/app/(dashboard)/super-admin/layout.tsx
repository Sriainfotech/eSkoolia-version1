'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { apiRequestWithRefresh } from '@/lib/api-auth';

interface Me {
  is_superuser?: boolean;
  role_names?: string[];
}

/**
 * Super-admin auth guard.
 * Pages here are served inside the main (dashboard) layout (TopBarNew + ModuleSubNav).
 * This layout ONLY checks that the user has super-admin access; all navigation comes from the parent.
 */
export default function SuperAdminAuthLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    let mounted = true;
    apiRequestWithRefresh<Me>('/api/v1/auth/me/')
      .then((me) => {
        if (!mounted) return;
        if (me?.is_superuser || me?.role_names?.includes('super_admin')) {
          setOk(true);
        } else {
          router.replace('/home');
        }
      })
      .catch(() => {
        if (mounted) router.replace('/login');
      });
    return () => { mounted = false; };
  }, [router]);

  if (!ok) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              display: 'inline-block', width: 32, height: 32, borderRadius: '50%',
              border: '3px solid #EDE9FE', borderTopColor: '#6D28D9',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          <p style={{ marginTop: 12, fontSize: 13, color: '#6b7280' }}>Verifying access…</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <>
      {children}
      <ToastContainer position="bottom-right" autoClose={4000} hideProgressBar newestOnTop closeOnClick pauseOnHover theme="light" />
    </>
  );
}
