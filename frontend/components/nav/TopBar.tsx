"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Bell,
  ChevronLeft,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { MODULES, type ModuleRoute } from "@/lib/routes";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { clearAuthTokens, getAccessToken, getRefreshToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { ModulePill } from "./ModulePill";
import { ModuleManager } from "./ModuleManager";
import { NoteTrigger } from "@/components/notes/NoteTrigger";
import { WidgetManager } from "@/components/home/WidgetManager";
import { useModuleStore } from "@/lib/moduleStore";

type MePayload = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  is_superuser?: boolean;
  is_school_admin?: boolean;
  permission_codes?: string[];
};

function getInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "U";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function hasAnyPermission(permission: string | undefined, me: MePayload): boolean {
  if (!permission) return true;
  if (me.is_superuser || me.is_school_admin) return true;
  const codes = new Set((me.permission_codes || []).filter(Boolean));
  if (codes.size === 0) return true;
  for (const code of codes) {
    if (code === "*" || code.startsWith(`${permission}.`)) return true;
  }
  return false;
}

function filterModules(modules: ModuleRoute[], me: MePayload): ModuleRoute[] {
  return modules
    .filter((m) => hasAnyPermission(m.permission, me))
    .map((m) => ({
      ...m,
      sub: m.sub.filter((s) => hasAnyPermission(s.permission ?? m.permission, me)),
    }));
}

/* ─── Main TopBar export ─── */
export function TopBarNew({ onCmdK }: { onCmdK: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MePayload | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const { isEnabled: isModuleEnabled } = useModuleStore();

  useEffect(() => {
    let mounted = true;
    apiRequestWithRefresh<MePayload>("/api/v1/auth/me/")
      .then((data) => { if (mounted) setMe(data); })
      .catch(() => { if (mounted) setMe(null); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const checkNavScroll = useCallback(() => {
    const el = navScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    checkNavScroll();
    el.addEventListener("scroll", checkNavScroll, { passive: true });
    const ro = new ResizeObserver(checkNavScroll);
    ro.observe(el);
    return () => { el.removeEventListener("scroll", checkNavScroll); ro.disconnect(); };
  }, [checkNavScroll, me]);

  const scrollNav = (dir: "left" | "right") => {
    const el = navScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  const visibleModules = me ? filterModules(MODULES, me) : MODULES;
  const activeModules = visibleModules.filter(m => isModuleEnabled(m.id));

  const currentUserLabel = (() => {
    const first = String(me?.first_name || "").trim();
    const last = String(me?.last_name || "").trim();
    const username = String(me?.username || "").trim();
    const full = `${first} ${last}`.trim();
    return full || username || "Admin";
  })();

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    const access = getAccessToken();
    const refresh = getRefreshToken();
    try {
      if (refresh) {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (access) headers.Authorization = `Bearer ${access}`;
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

  const isHome = pathname === "/home" || pathname === "/dashboard" || pathname === "/";

  const navArrowBtn = (dir: "left" | "right", enabled: boolean) => (
    <button
      onClick={() => scrollNav(dir)}
      disabled={!enabled}
      style={{
        flexShrink: 0, width: 24, height: 28, border: "none",
        cursor: enabled ? "pointer" : "default",
        background: enabled
          ? `linear-gradient(to ${dir === "left" ? "right" : "left"}, var(--bg-1) 50%, transparent)`
          : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: enabled ? 1 : 0.2, transition: "opacity 0.15s",
        borderRadius: 6, padding: 0,
        color: "var(--ink-2)",
      }}
    >
      {dir === "left"
        ? <ChevronLeft size={13} strokeWidth={2} />
        : <ChevronRight size={13} strokeWidth={2} />
      }
    </button>
  );

  return (
    <>
      <header
        style={{
          position: "sticky",
          top: 0,
          height: 56,
          background: "var(--bg-1)",
          borderBottom: "1px solid var(--bd)",
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "0 16px",
            width: "100%",
            height: "100%",
          }}
        >
          {/* Back button — shown on all pages except home */}
          {!isHome && (
            <button
              type="button"
              onClick={() => router.back()}
              title="Go back"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: "4px 2px",
                borderRadius: 6,
                flexShrink: 0,
                color: "var(--ink-3)",
              }}
            >
              <ChevronLeft size={14} strokeWidth={1.5} />
            </button>
          )}

          {/* Logo */}
          <Link
            href="/home"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              textDecoration: "none",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: 9,
                background: "linear-gradient(135deg, var(--pu) 0%, var(--pu-deep) 100%)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: 18,
                letterSpacing: "-0.04em",
                flexShrink: 0,
              }}
            >
              e
            </span>
            <span
              style={{
                fontWeight: 600,
                fontSize: 17,
                letterSpacing: "-0.02em",
                color: "var(--ink-1)",
              }}
            >
              eskoolia
            </span>
          </Link>

          {/* Module pills — scrollable with arrow buttons, all modules shown */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              marginLeft: 8,
              flex: "1 1 0",
              minWidth: 0,
              overflow: "hidden",
            }}
            className="hidden md:flex"
          >
            {navArrowBtn("left", canScrollLeft)}
            <div
              ref={navScrollRef}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 1,
                flex: 1,
                overflowX: "auto",
                scrollbarWidth: "none",
              }}
            >
              {activeModules.map(m => (
                <ModulePill key={m.id} mod={m} />
              ))}
            </div>
            {navArrowBtn("right", canScrollRight)}
          </nav>

          {/* Right side — fixed, never grows */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 6,
              flexShrink: 0,
            }}
          >
            {/* ⌘K trigger — xl screens only */}
            <button
              onClick={onCmdK}
              className="hidden xl:flex"
              style={{
                alignItems: "center",
                gap: 8,
                height: 34,
                padding: "0 10px",
                borderRadius: 8,
                border: "1px solid var(--bd)",
                background: "var(--bg-2)",
                color: "var(--ink-3)",
                fontSize: 12,
                cursor: "pointer",
                transition: "border-color 180ms, background 180ms",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-1)";
                (e.currentTarget as HTMLElement).style.borderColor = "rgba(109,74,255,0.4)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = "var(--bg-2)";
                (e.currentTarget as HTMLElement).style.borderColor = "var(--bd)";
              }}
            >
              <Search size={14} strokeWidth={1.5} />
              <span>Search…</span>
              <kbd
                style={{
                  marginLeft: 6,
                  fontFamily: "var(--font-mono, monospace)",
                  fontSize: 10,
                  color: "var(--ink-3)",
                  background: '#fff',
                  border: '1px solid var(--bd)',
                  borderRadius: 4,
                  padding: '1px 5px',
                  lineHeight: 1.4,
                }}
              >
                ⌘K
              </kbd>
            </button>

            {/* ⌘K icon-only — md/lg */}
            <button
              onClick={onCmdK}
              className="hidden md:flex xl:hidden"
              style={{
                alignItems: "center",
                justifyContent: "center",
                width: 34,
                height: 34,
                borderRadius: 8,
                border: "1px solid var(--bd)",
                background: "var(--bg-2)",
                color: "var(--ink-3)",
                cursor: "pointer",
              }}
              title="Search (⌘K)"
            >
              <Search size={15} strokeWidth={1.5} />
            </button>

            {/* Sticky Notes trigger */}
            <NoteTrigger />

            {/* Module manager — home page only */}
            {isHome && (
              <div className="hidden md:block">
                <ModuleManager />
              </div>
            )}

            {/* Widget manager — home page only */}
            {isHome && (
              <div className="hidden md:block">
                <WidgetManager />
              </div>
            )}

            {/* Notifications */}
            <button
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--ink-2)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bell size={17} strokeWidth={1.5} />
            </button>

            {/* Avatar menu */}
            <div ref={avatarRef} style={{ position: "relative", flexShrink: 0 }}>
              <button
                onClick={() => setAvatarOpen((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  height: 34,
                  padding: "0 6px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: "50%",
                    background: "var(--pu)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 11,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(currentUserLabel)}
                </div>
                <span
                  className="hidden lg:block"
                  style={{
                    fontSize: 12,
                    color: "var(--ink-1)",
                    fontWeight: 500,
                    maxWidth: 90,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {currentUserLabel}
                </span>
                <ChevronDown size={12} strokeWidth={1.5} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
              </button>

              {avatarOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    right: 0,
                    width: 190,
                    background: "var(--bg-1)",
                    border: "1px solid var(--bd)",
                    borderRadius: 12,
                    boxShadow: "var(--sh-3)",
                    padding: 6,
                    zIndex: 100,
                  }}
                >
                  <div
                    style={{
                      padding: "6px 10px 8px",
                      marginBottom: 4,
                      borderBottom: "1px solid var(--bd)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        fontWeight: 600,
                        color: "var(--ink-1)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {currentUserLabel}
                    </div>
                    {me?.email && (
                      <div
                        style={{
                          fontSize: 11,
                          color: "var(--ink-3)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {me.email}
                      </div>
                    )}
                  </div>
                  <button
                    onClick={handleLogout}
                    disabled={loggingOut}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      alignItems: "center",
                      height: 32,
                      padding: "0 10px",
                      borderRadius: 6,
                      border: "none",
                      background: "transparent",
                      fontSize: 12.5,
                      color: "var(--err)",
                      cursor: loggingOut ? "not-allowed" : "pointer",
                    }}
                  >
                    {loggingOut ? "Logging out…" : "Logout"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
    </>
  );
}
