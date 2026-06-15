"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { API_BASE_URL } from "@/lib/api";
import { clearAuthTokens, getAccessToken } from "@/lib/auth";
import { clearPermissionsCache } from "@/hooks/usePermissions";

function NoAccessContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const reason = searchParams.get("reason");
  const isPortalPending = reason === "portal_pending";

  const [name, setName] = useState<string | null>(null);
  const [portalType, setPortalType] = useState<string | null>(null);

  useEffect(() => {
    const access = getAccessToken();
    if (!access) { router.replace("/login"); return; }
    fetch(`${API_BASE_URL}/api/v1/auth/me/`, {
      headers: { Authorization: `Bearer ${access}` },
    })
      .then((r) => r.ok ? r.json() : null)
      .then((me) => {
        if (!me) { router.replace("/login"); return; }
        const full = [me.first_name, me.last_name].filter(Boolean).join(" ");
        setName(full || me.username || "there");
        setPortalType(me.portal_type ?? null);
      })
      .catch(() => router.replace("/login"));
  }, [router]);

  function handleLogout() {
    clearAuthTokens();
    clearPermissionsCache();
    router.replace("/login");
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--bg-0)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontFamily: "var(--font-sans, system-ui, sans-serif)",
    }}>
      <div style={{
        background: "var(--bg-1)",
        border: "1px solid var(--bd)",
        borderRadius: 18,
        boxShadow: "0 4px 24px rgba(0,0,0,0.07)",
        padding: "52px 56px",
        maxWidth: 480,
        width: "100%",
        textAlign: "center",
      }}>
        {/* Logo / brand mark */}
        <div style={{
          width: 56,
          height: 56,
          borderRadius: 14,
          background: "linear-gradient(135deg, var(--pu) 0%, var(--pu-deep) 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 28px",
        }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z"/>
            <path d="M2 17l10 5 10-5"/>
            <path d="M2 12l10 5 10-5"/>
          </svg>
        </div>

        {/* Greeting */}
        <h1 style={{
          fontSize: 26,
          fontWeight: 600,
          color: "var(--ink-1)",
          margin: "0 0 6px",
          letterSpacing: "-0.02em",
          lineHeight: 1.2,
        }}>
          Welcome{name ? (
            <>
              ,{" "}
              <em style={{
                fontFamily: "var(--font-instrument-serif, 'Instrument Serif', Georgia, serif)",
                fontStyle: "italic",
                fontWeight: 400,
                color: "var(--pu)",
                fontSize: 30,
              }}>
                {name}
              </em>
            </>
          ) : null}
        </h1>

        {/* Divider */}
        <div style={{ width: 40, height: 2, background: "var(--pu-soft)", borderRadius: 2, margin: "20px auto" }} />

        {/* Message */}
        {isPortalPending ? (
          <>
            <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.65, margin: "0 0 8px" }}>
              Your {portalType ? `${portalType.charAt(0).toUpperCase()}${portalType.slice(1)} ` : ""}portal is coming soon.
            </p>
            <p style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6, margin: "0 0 36px" }}>
              This section of the platform is being set up. Please check back later or contact your school administrator.
            </p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 15, color: "var(--ink-2)", lineHeight: 1.65, margin: "0 0 8px" }}>
              Your account has been set up, but no permissions have been assigned to your role yet.
            </p>
            <p style={{ fontSize: 14, color: "var(--ink-3)", lineHeight: 1.6, margin: "0 0 36px" }}>
              Please contact your school administrator to get access.
            </p>
          </>
        )}

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            padding: "10px 24px",
            borderRadius: 8,
            border: "1px solid var(--bd-2)",
            background: "var(--bg-1)",
            color: "var(--ink-2)",
            fontSize: 14,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function NoAccessPage() {
  return (
    <Suspense>
      <NoAccessContent />
    </Suspense>
  );
}
