"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/auth";

type AuthGateProps = { children: ReactNode };

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

/**
 * Maps a portal_type (or role_names[0] from mock) to the home route
 * for that portal. Returns null for admin — they stay on the current route.
 */
function nonAdminHome(portalType: string | undefined): string | null {
  if (portalType === 'teacher') return '/teacher/home';
  if (portalType === 'parent')  return '/parent/home';
  return null;
}

/**
 * Returns true if the current pathname is part of the admin console
 * (i.e. NOT a teacher-portal or parent-portal route).
 * Teachers and parents should never be able to land on these paths.
 */
function isAdminRoute(pathname: string): boolean {
  return (
    !pathname.startsWith('/teacher') &&
    !pathname.startsWith('/parent') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/change-password') &&
    !pathname.startsWith('/no-access')
  );
}

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ensureAuth = async () => {
      const access = getAccessToken();
      const refresh = getRefreshToken();

      if (access) {
        if (pathname !== '/change-password') {
          // ── Mock mode: read portal_type from localStorage ──────────────
          if (USE_MOCK && access === 'mock-access-token') {
            try {
              const stored = localStorage.getItem('mock_user');
              if (stored) {
                const mockUser = JSON.parse(stored) as { role_names?: string[] };
                const portalType = mockUser.role_names?.[0];
                const redirect = nonAdminHome(portalType);
                if (redirect && isAdminRoute(pathname)) {
                  router.replace(redirect);
                  return;
                }
              }
            } catch { /* ignore */ }
            setReady(true);
            return;
          }

          // ── Real mode: call /me and check portal_type ──────────────────
          try {
            const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
              headers: { Authorization: `Bearer ${access}` },
            });
            if (meRes.ok) {
              const me = await meRes.json() as {
                must_change_password?: boolean;
                portal_type?: string;
                is_superuser?: boolean;
                is_school_admin?: boolean;
                permission_codes?: string[];
              };
              if (me.must_change_password) {
                router.replace('/change-password');
                return;
              }
              // Block non-admin users from admin routes
              const redirect = nonAdminHome(me.portal_type);
              if (redirect && isAdminRoute(pathname)) {
                router.replace(redirect);
                return;
              }
              // No permissions assigned — show the no-access page
              const hasNoPermissions =
                !me.is_superuser &&
                !me.is_school_admin &&
                !redirect &&                            // not teacher/parent portal
                !(me.permission_codes?.length);
              if (hasNoPermissions && !pathname.startsWith('/no-access')) {
                router.replace('/no-access');
                return;
              }
            }
          } catch { /* non-blocking */ }
        }
        setReady(true);
        return;
      }

      if (!refresh) {
        clearAuthTokens();
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }

      const response = await fetch(`${API_BASE_URL}/api/v1/auth/refresh/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh }),
      });

      if (!response.ok) {
        clearAuthTokens();
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }

      const data = (await response.json()) as { access?: string };
      if (!data.access) {
        clearAuthTokens();
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }

      setAuthTokens(data.access, refresh);

      // Re-run status checks with the newly minted access token
      if (pathname !== '/change-password') {
        try {
          const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
            headers: { Authorization: `Bearer ${data.access}` },
          });
          if (meRes.ok) {
            const me = await meRes.json() as {
              must_change_password?: boolean;
              portal_type?: string;
              is_superuser?: boolean;
              is_school_admin?: boolean;
              permission_codes?: string[];
            };
            if (me.must_change_password) {
              router.replace('/change-password');
              return;
            }
            // Block non-admin users from admin routes
            const redirect = nonAdminHome(me.portal_type);
            if (redirect && isAdminRoute(pathname)) {
              router.replace(redirect);
              return;
            }
            // No permissions assigned — show the no-access page
            const hasNoPermissions =
              !me.is_superuser &&
              !me.is_school_admin &&
              !redirect &&                            // not teacher/parent portal
              !(me.permission_codes?.length);
            if (hasNoPermissions && !pathname.startsWith('/no-access')) {
              router.replace('/no-access');
              return;
            }
          }
        } catch { /* non-blocking */ }
      }

      setReady(true);
    };

    void ensureAuth();
  }, [pathname, router]);

  if (!ready) {
    return (
      <div style={{ padding: 24, color: "var(--muted)" }}>Checking session...</div>
    );
  }

  return <>{children}</>;
}
