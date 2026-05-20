"use client";

import { ReactNode, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { clearAuthTokens, getAccessToken, getRefreshToken, setAuthTokens } from "@/lib/auth";

type AuthGateProps = { children: ReactNode };

export default function AuthGate({ children }: AuthGateProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const ensureAuth = async () => {
      const access = getAccessToken();
      const refresh = getRefreshToken();

      if (access) {
        // Check if user must change password
        if (pathname !== '/change-password') {
          try {
            const meRes = await fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
              headers: { Authorization: `Bearer ${access}` },
            });
            if (meRes.ok) {
              const me = await meRes.json() as { must_change_password?: boolean };
              if (me.must_change_password) {
                router.replace('/change-password');
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
