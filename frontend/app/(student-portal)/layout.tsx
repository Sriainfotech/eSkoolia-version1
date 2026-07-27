"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import AuthGate from "@/components/layout/AuthGate";
import { ModulePill } from "@/components/nav/ModulePill";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { clearAuthTokens, getAccessToken, getRefreshToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { clearPermissionsCache, usePermissions } from "@/hooks/usePermissions";
import { NoteTrigger } from "@/components/notes/NoteTrigger";
import { NotificationBell } from "@/components/nav/NotificationBell";
import { WidgetManager } from "@/components/home/WidgetManager";
import { PageNotesPanel } from "@/components/notes/PageNotesPanel";

function StudentTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { me } = usePermissions();
  const isHome = pathname === "/student/home";
  const navModules = useVisibleModules({ includeHome: true });
  const [avatarOpen, setAvatarOpen] = useState(false);
  const avatarRef = useRef<HTMLDivElement>(null);
  const navScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (avatarRef.current && !avatarRef.current.contains(e.target as Node)) {
        setAvatarOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const checkNavScroll = () => {
    const el = navScrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  };

  useEffect(() => {
    const el = navScrollRef.current;
    if (!el) return;
    checkNavScroll();
    el.addEventListener("scroll", checkNavScroll, { passive: true });
    const ro = new ResizeObserver(checkNavScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", checkNavScroll);
      ro.disconnect();
    };
  }, []);

  const fullName = `${me?.first_name || ""} ${me?.last_name || ""}`.trim() || me?.username || "Student";
  const initials = fullName
    .split(" ")
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase() || "S";

  async function handleLogout() {
    const refresh = getRefreshToken();
    try {
      if (refresh) {
        const token = getAccessToken();
        await fetch(`${API_BASE_URL}/api/v1/auth/logout/`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify({ refresh }),
        });
      }
    } catch {
      // Always clear locally.
    }
    clearAuthTokens();
    clearPermissionsCache();
    router.push("/login");
  }

  const navArrowBtn = (dir: "left" | "right", enabled: boolean) => (
    <button
      onClick={() => navScrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" })}
      disabled={!enabled}
      style={{
        flexShrink: 0,
        width: 24,
        height: 28,
        border: "none",
        cursor: enabled ? "pointer" : "default",
        background: enabled ? `linear-gradient(to ${dir === "left" ? "right" : "left"}, var(--bg-1) 50%, transparent)` : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: enabled ? 1 : 0.2,
        transition: "opacity 0.15s",
        borderRadius: 6,
        padding: 0,
        color: "var(--ink-2)",
      }}
    >
      {dir === "left" ? <ChevronLeft size={13} strokeWidth={2} /> : <ChevronRight size={13} strokeWidth={2} />}
    </button>
  );

  return (
    <header style={{ position: "sticky", top: 0, height: 56, background: "var(--bg-1)", borderBottom: "1px solid var(--bd)", zIndex: 50, display: "flex", alignItems: "center", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", width: "100%", height: "100%" }}>
        <Link href="/student/home" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, var(--pu) 0%, var(--pu-deep) 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, letterSpacing: "-0.04em", flexShrink: 0 }}>
            e
          </span>
          <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-0.02em", color: "var(--ink-1)" }}>eskoolia</span>
        </Link>

        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--pu)", background: "var(--pu-soft)", borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>
          Student
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: 4, flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
          {navArrowBtn("left", canScrollLeft)}
          <div ref={navScrollRef} style={{ display: "flex", alignItems: "center", gap: 1, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
            {navModules.map((mod) => <ModulePill key={mod.id} mod={mod} exactMatch />)}
          </div>
          {navArrowBtn("right", canScrollRight)}
        </nav>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          {isHome && <WidgetManager />}
          <NoteTrigger />
          <NotificationBell />

          <div ref={avatarRef} style={{ position: "relative", flexShrink: 0 }}>
            <button onClick={() => setAvatarOpen((o) => !o)} style={{ display: "flex", alignItems: "center", gap: 6, height: 34, padding: "0 6px", borderRadius: 8, border: "none", background: "transparent", cursor: "pointer" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--pu)", color: "#fff", display: "grid", placeItems: "center", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>
                {initials}
              </div>
              <span style={{ fontSize: 12, color: "var(--ink-1)", fontWeight: 500, maxWidth: 90, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {fullName}
              </span>
              <ChevronDown size={12} strokeWidth={1.5} style={{ color: "var(--ink-3)", flexShrink: 0 }} />
            </button>

            {avatarOpen && (
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 200, background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 12, boxShadow: "var(--sh-3)", padding: 6, zIndex: 100 }}>
                <div style={{ padding: "6px 10px 8px", marginBottom: 4, borderBottom: "1px solid var(--bd)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>Student</div>
                </div>
                <button onClick={handleLogout} style={{ width: "100%", textAlign: "left", display: "flex", alignItems: "center", height: 32, padding: "0 10px", borderRadius: 6, border: "none", background: "transparent", fontSize: 12.5, color: "var(--err)", cursor: "pointer" }}>
                  Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function StudentSubNav() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const allMods = useVisibleModules({ includeHome: true });
  const mod = allMods.find(
    (m) =>
      pathname === m.path ||
      m.sub.some((s) => pathname === s.path || pathname.startsWith(s.path + "/")) ||
      (m.path !== "/student/home" && pathname.startsWith(m.path))
  );

  function checkScroll() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 4);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();
    el.addEventListener("scroll", checkScroll, { passive: true });
    return () => el.removeEventListener("scroll", checkScroll);
  }, [mod]);

  if (!mod || mod.sub.length === 0) return null;

  const activeTab = mod.sub.find((s) => pathname === s.path || pathname.startsWith(s.path + "/"));

  const arrowBtn = (dir: "left" | "right", enabled: boolean) => (
    <button
      onClick={() => scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" })}
      disabled={!enabled}
      style={{
        flexShrink: 0,
        width: 28,
        height: 46,
        border: "none",
        cursor: enabled ? "pointer" : "default",
        background: enabled
          ? `linear-gradient(to ${dir === "left" ? "right" : "left"}, #fff 60%, transparent)`
          : "transparent",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        opacity: enabled ? 1 : 0.25,
        padding: 0,
      }}
    >
      {dir === "left"
        ? <ChevronLeft size={15} color="var(--ink-2, #475569)" strokeWidth={2} />
        : <ChevronRight size={15} color="var(--ink-2, #475569)" strokeWidth={2} />}
    </button>
  );

  return (
    <div style={{ background: "#fff", borderBottom: "1px solid var(--bd, #dbe4f0)" }}>
      <div style={{ display: "flex", alignItems: "center", minHeight: 46, padding: "0 22px 0 8px", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, paddingRight: 12, marginRight: 7, borderRight: "1px solid var(--bd, #dbe4f0)", flexShrink: 0 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: mod.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <mod.icon size={11} color={mod.ic} strokeWidth={1.8} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-2, #475569)", whiteSpace: "nowrap" }}>{mod.name}</span>
        </div>

        {arrowBtn("left", canScrollLeft)}

        <div ref={scrollRef} style={{ display: "flex", overflowX: "auto", overflowY: "visible", scrollbarWidth: "none", gap: 0, flex: 1 }}>
          {mod.sub.map((s) => {
            const isActive = s === activeTab;
            const SubIcon = s.icon ?? mod.icon;
            return (
              <Link
                key={s.path}
                href={s.path}
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  height: 46,
                  padding: "1px 11px 0",
                  fontSize: 12.5,
                  fontWeight: isActive ? 600 : 400,
                  lineHeight: 1.25,
                  color: isActive ? "var(--pu, #3b5bdb)" : "var(--ink-2, #475569)",
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                  borderBottom: isActive ? "2px solid var(--pu, #3b5bdb)" : "2px solid transparent",
                  flexShrink: 0,
                  transition: "color 0.12s",
                }}
              >
                <SubIcon size={12} strokeWidth={1.8} />
                {s.label}
              </Link>
            );
          })}
        </div>

        {arrowBtn("right", canScrollRight)}
      </div>
    </div>
  );
}

function StudentShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <StudentTopBar />
      <StudentSubNav />
      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-0, #FAFAFC)", padding: "22px 22px 60px" }}>
        {children}
      </main>
      <PageNotesPanel />
    </div>
  );
}

export default function StudentPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <StudentShell>{children}</StudentShell>
    </AuthGate>
  );
}
