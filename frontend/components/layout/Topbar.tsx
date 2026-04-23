"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { clearAuthTokens, getAccessToken, getRefreshToken } from "@/lib/auth";
import { BackButton } from "@/components/common/BackButton";

type MePayload = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
};

function getInitialsFromName(name: string): string {
  const words = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();

  return `${words[0].slice(0, 1)}${words[words.length - 1].slice(0, 1)}`.toUpperCase();
}

export function Topbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const [currentUser, setCurrentUser] = useState<MePayload | null>(null);
  const showBackButton = pathname !== "/dashboard";

  useEffect(() => {
    let mounted = true;

    const loadCurrentUser = async () => {
      try {
        const me = await apiRequestWithRefresh<MePayload>("/api/v1/auth/me/");
        if (mounted) {
          setCurrentUser(me);
        }
      } catch {
        if (mounted) {
          setCurrentUser(null);
        }
      }
    };

    void loadCurrentUser();

    return () => {
      mounted = false;
    };
  }, []);

  const currentUserInitials = useMemo(() => {
    const first = String(currentUser?.first_name || "").trim();
    const last = String(currentUser?.last_name || "").trim();
    const username = String(currentUser?.username || "").trim();
    const email = String(currentUser?.email || "").trim();

    if (first || last) {
      return getInitialsFromName(`${first} ${last}`);
    }
    if (username) {
      return getInitialsFromName(username.replace(/[._-]+/g, " "));
    }
    if (email.includes("@")) {
      return getInitialsFromName(email.split("@")[0] || "");
    }
    return "U";
  }, [currentUser]);

  const currentUserLabel = useMemo(() => {
    const first = String(currentUser?.first_name || "").trim();
    const last = String(currentUser?.last_name || "").trim();
    const username = String(currentUser?.username || "").trim();
    const fullName = `${first} ${last}`.trim();

    if (fullName) return fullName;
    if (username) return username;
    return "Admin";
  }, [currentUser]);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    const access = getAccessToken();
    const refresh = getRefreshToken();

    try {
      if (refresh) {
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (access) {
          headers.Authorization = `Bearer ${access}`;
        }

        await fetch(`${API_BASE_URL}/api/v1/auth/logout/`, {
          method: "POST",
          headers,
          body: JSON.stringify({ refresh }),
        });
      }
    } finally {
      clearAuthTokens();
      router.replace("/login");
      setLoggingOut(false);
    }
  };

  return (
    <header
      style={{
        height: 64,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0 18px",
        borderBottom: "1px solid var(--line)",
        background: "var(--surface)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", minWidth: 0 }}>
        {showBackButton ? <BackButton /> : null}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          style={{
            border: "1px solid var(--line)",
            background: "transparent",
            borderRadius: 8,
            padding: "6px 10px",
            cursor: loggingOut ? "not-allowed" : "pointer",
            color: "var(--text)",
            fontSize: 13,
          }}
        >
          {loggingOut ? "Logging out..." : "Logout"}
        </button>
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{currentUserLabel}</span>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 999,
            background: "var(--primary)",
            color: "#fff",
            display: "grid",
            placeItems: "center",
            fontWeight: 700,
          }}
        >
          {currentUserInitials}
        </div>
      </div>
    </header>
  );
}
