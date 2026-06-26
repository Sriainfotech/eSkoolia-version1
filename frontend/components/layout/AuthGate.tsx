"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/auth";
import { refreshAccessToken } from "@/lib/api-auth";

type AuthGateProps = { children: ReactNode };

const USE_MOCK = process.env.NEXT_PUBLIC_USE_MOCK === 'true';

/** Add new portals here as they are built. */
const PORTAL_HOMES: Partial<Record<string, string>> = {
  teacher: '/teacher/home',
  parent:  '/parent/home',
  // student: '/student/home',  ← add when student portal is built
};

/**
 * Returns the home route for a non-admin portal user, or null if this user
 * belongs to the admin console (portal_type 'admin' / 'custom' / undefined).
 */
function nonAdminHome(portalType: string | undefined): string | null {
  return (portalType && PORTAL_HOMES[portalType]) ?? null;
}

/**
 * Returns true when the user belongs to any non-admin portal — even one not
 * yet built (e.g. 'student'). Used to prevent these users from reaching the
 * admin console, and to skip the "no permissions" redirect for them.
 */
function isNonAdminPortalUser(portalType: string | undefined): boolean {
  return !!portalType && portalType !== 'admin' && portalType !== 'custom';
}

/**
 * Returns true if the current pathname is part of the admin console.
 * Any non-admin portal user must never reach these paths.
 */
function isAdminRoute(pathname: string): boolean {
  return (
    !pathname.startsWith('/teacher') &&
    !pathname.startsWith('/parent') &&
    !pathname.startsWith('/student') &&
    !pathname.startsWith('/login') &&
    !pathname.startsWith('/change-password') &&
    !pathname.startsWith('/no-access')
  );
}

type MeShape = {
  must_change_password?: boolean;
  portal_type?: string;
  is_superuser?: boolean;
  is_school_admin?: boolean;
  permission_codes?: string[];
};

/**
 * Applies all portal-based redirect rules given a resolved /me response.
 * Returns true if a redirect was issued (caller should return early).
 */
function applyPortalRedirects(
  me: MeShape,
  pathname: string,
  router: ReturnType<typeof useRouter>,
): boolean {
  const redirect = nonAdminHome(me.portal_type);

  if (redirect) {
    // User has a built portal — block admin routes and cross-portal access.
    const isWrongPortal =
      isAdminRoute(pathname) ||
      (me.portal_type === 'teacher' && pathname.startsWith('/parent')) ||
      (me.portal_type === 'parent'  && pathname.startsWith('/teacher'));
    if (isWrongPortal) {
      router.replace(redirect);
      return true;
    }
    return false;
  }

  // Non-admin portal user whose portal is not yet built (e.g. student) —
  // block admin routes and show a "portal coming soon" message.
  if (isNonAdminPortalUser(me.portal_type) && isAdminRoute(pathname)) {
    router.replace('/no-access?reason=portal_pending');
    return true;
  }

  // Admin-type user with no permissions assigned — show no-access page.
  const hasNoPermissions =
    !me.is_superuser &&
    !me.is_school_admin &&
    !isNonAdminPortalUser(me.portal_type) &&
    !(me.permission_codes?.length);
  if (hasNoPermissions && !pathname.startsWith('/no-access')) {
    router.replace('/no-access');
    return true;
  }

  return false;
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

          // ── Real mode: call /me and apply portal routing ───────────────
          try {
            let meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
              headers: { Authorization: `Bearer ${access}` },
            });
            // Token expired — delegate to shared mutex-guarded refresh so concurrent
            // page hooks all piggy-back on one refresh call instead of racing.
            if (meRes.status === 401 && refresh) {
              const newAccess = await refreshAccessToken();
              if (!newAccess) return; // _doRefresh already cleared tokens + redirected
              meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
                headers: { Authorization: `Bearer ${newAccess}` },
              });
            }
            if (meRes.ok) {
              const me = await meRes.json() as MeShape;
              if (me.must_change_password) {
                router.replace('/change-password');
                return;
              }
              if (applyPortalRedirects(me, pathname, router)) return;
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

      const data = (await response.json()) as { access?: string; refresh?: string };
      if (!data.access) {
        clearAuthTokens();
        router.replace(`/login?next=${encodeURIComponent(pathname || "/dashboard")}`);
        return;
      }

      setAuthTokens(data.access, data.refresh ?? refresh);

      // Re-run all portal checks with the newly minted access token
      if (pathname !== '/change-password') {
        try {
          const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
            headers: { Authorization: `Bearer ${data.access}` },
          });
          if (meRes.ok) {
            const me = await meRes.json() as MeShape;
            if (me.must_change_password) {
              router.replace('/change-password');
              return;
            }
            if (applyPortalRedirects(me, pathname, router)) return;
          }
        } catch { /* non-blocking */ }
      }
      // (token was just refreshed — no need for a secondary refresh here)

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
