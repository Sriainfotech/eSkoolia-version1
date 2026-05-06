"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Search,
  Bell,
  ChevronLeft,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { MODULES, type ModuleRoute } from "@/lib/routes";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { clearAuthTokens, getAccessToken, getRefreshToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { ModulePill } from "./ModulePill";
import { OverflowMenu } from "./OverflowMenu";
import { NoteTrigger } from "@/components/notes/NoteTrigger";
import { WidgetManager } from "@/components/home/WidgetManager";

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

/* ─── Mobile slide-out sheet ─── */
function MobileSheet({ modules, onClose }: { modules: ModuleRoute[]; onClose: () => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 200,
        background: "rgba(15,18,34,0.4)",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          bottom: 0,
          width: 300,
          background: "var(--bg-1)",
          overflowY: "auto",
          padding: "16px 0",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 16px 12px",
            borderBottom: "1px solid var(--bd)",
          }}
        >
          <LogoMark />
          <button
            onClick={onClose}
            style={{
              padding: 6,
              borderRadius: 8,
              border: "none",
              background: "transparent",
              cursor: "pointer",
              color: "var(--ink-2)",
            }}
          >
            <X size={18} strokeWidth={1.5} />
          </button>
        </div>
        <div style={{ paddingTop: 8 }}>
          {modules.map((mod) => {
            const Icon = mod.icon;
            const hasSub = mod.sub.length > 0;
            const isExpanded = expandedId === mod.id;
            return (
              <div key={mod.id}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "0 16px",
                    height: 44,
                    cursor: "pointer",
                    fontSize: 13,
                    fontWeight: 500,
                    color: "var(--ink-1)",
                  }}
                  onClick={() => hasSub && setExpandedId(isExpanded ? null : mod.id)}
                >
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
                      background: mod.bg,
                      color: mod.ic,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={15} strokeWidth={1.5} />
                  </span>
                  <Link
                    href={mod.path}
                    style={{ flex: 1, color: "inherit", textDecoration: "none" }}
                    onClick={onClose}
                  >
                    {mod.name}
                  </Link>
                  {hasSub && (
                    <ChevronDown
                      size={14}
                      strokeWidth={1.5}
                      style={{
                        transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                        transition: "transform 180ms",
                        color: "var(--ink-3)",
                      }}
                    />
                  )}
                </div>
                {hasSub && isExpanded && (
                  <div style={{ paddingLeft: 54, paddingBottom: 4 }}>
                    {mod.sub.map((s) => {
                      const SubIcon = s.icon ?? mod.icon;
                      return (
                        <Link
                          key={s.path}
                          href={s.path}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            height: 32,
                            padding: "0 8px",
                            borderRadius: 6,
                            fontSize: 12.5,
                            color: "var(--ink-2)",
                            textDecoration: "none",
                          }}
                          onClick={onClose}
                        >
                          <SubIcon size={13} strokeWidth={1.5} />
                          {s.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ─── Logo mark (reused in sheet too) ─── */
function LogoMark() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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
    </div>
  );
}

/* ─── Main TopBar export ─── */
export function TopBarNew({ onCmdK }: { onCmdK: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const [me, setMe] = useState<MePayload | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);

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

  const visibleModules = me ? filterModules(MODULES, me) : MODULES;

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
            gap: 16,
            padding: "0 24px",
            width: "100%",
            height: "100%",
          }}
        >
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
            {!isHome && (
              <ChevronLeft
                size={14}
                strokeWidth={1.5}
                style={{ color: "var(--ink-3)" }}
              />
            )}
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

          {/* Module pills — desktop (md+) */}
          <nav
            style={{
              display: "flex",
              alignItems: "center",
              gap: 2,
              marginLeft: 8,
              flexShrink: 1,
              minWidth: 0,
              overflowX: "auto",
              scrollbarWidth: "none",
            }}
            className="hidden md:flex"
          >
            {visibleModules.slice(0, 13).map(m => (
              <ModulePill key={m.id} mod={m} />
            ))}
            {visibleModules.length > 13 && <OverflowMenu mods={visibleModules.slice(13)} />}
          </nav>

          {/* Right side */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              flexShrink: 0,
            }}
          >
            {/* ⌘K trigger — desktop */}
            <button
              onClick={onCmdK}
              className="hidden md:flex"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                height: 36,
                padding: "0 12px",
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

            {/* Sticky Notes trigger */}
            <NoteTrigger />

            {/* Widget manager — visible only on home page */}
            {isHome && (
              <div className="hidden lg:block">
                <WidgetManager />
              </div>
            )}

            {/* Notifications */}
            <button
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--ink-2)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={17} strokeWidth={1.5} />
            </button>

            {/* Avatar menu */}
            <div ref={avatarRef} style={{ position: "relative" }}>
              <button
                onClick={() => setAvatarOpen((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  height: 36,
                  padding: "0 8px",
                  borderRadius: 8,
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                }}
              >
                <div
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: "50%",
                    background: "var(--pu)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontWeight: 700,
                    fontSize: 12,
                    flexShrink: 0,
                  }}
                >
                  {getInitials(currentUserLabel)}
                </div>
                <span
                  className="hidden lg:block"
                  style={{
                    fontSize: 12.5,
                    color: "var(--ink-1)",
                    fontWeight: 500,
                    maxWidth: 120,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {currentUserLabel}
                </span>
                <ChevronDown size={13} strokeWidth={1.5} style={{ color: "var(--ink-3)" }} />
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

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="flex md:hidden"
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                color: "var(--ink-2)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Menu size={18} strokeWidth={1.5} />
            </button>
          </div>
        </div>
      </header>

      {mobileOpen && (
        <MobileSheet
          modules={visibleModules}
          onClose={() => setMobileOpen(false)}
        />
      )}
    </>
  );
}
