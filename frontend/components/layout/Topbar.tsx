"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { clearAuthTokens, getAccessToken, getRefreshToken } from "@/lib/auth";

export function Topbar() {
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);

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
      <div />
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
        <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Admin</span>
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
          A
        </div>
      </div>
    </header>
  );
}
