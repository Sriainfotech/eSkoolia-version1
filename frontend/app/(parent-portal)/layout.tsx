"use client";

/**
 * Parent Portal Layout
 *
 * Provides ParentChildContext to all pages so the selected child
 * persists across navigation without re-fetching /parent/me/.
 *
 * The ChildSwitcher in the topbar lets the parent flip between
 * children. When only one child exists it just displays the child's
 * name without a dropdown.
 */

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { WidgetManager } from "@/components/home/WidgetManager";
import AuthGate from "@/components/layout/AuthGate";
import { ModulePill } from "@/components/nav/ModulePill";
import { NoteTrigger } from "@/components/notes/NoteTrigger";
import { clearAuthTokens, getAccessToken, getRefreshToken } from "@/lib/auth";
import { clearPermissionsCache } from "@/hooks/usePermissions";
import { useVisibleModules } from "@/hooks/useVisibleModules";
import { API_BASE_URL } from "@/lib/api";
import { PageNotesPanel } from "@/components/notes/PageNotesPanel";
import { ParentChildProvider, useParentChild } from "@/contexts/ParentChildContext";
import type { ChildSummary } from "@/lib/api/parent";

// ── Child Switcher ────────────────────────────────────────────────────────────

function ChildSwitcher() {
  const { children, selectedChild, setSelectedChildId } = useParentChild();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!selectedChild) return null;

  const initials = selectedChild.name
    .split(" ")
    .filter(Boolean)
    .map((w: string) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const hasMultiple = children.length > 1;

  function selectChild(c: ChildSummary) {
    setSelectedChildId(c.id);
    setOpen(false);
  }

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      {/* Child picker pill — matches design: avatar + name + grade/roll */}
      <button
        onClick={() => hasMultiple && setOpen((o) => !o)}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          gap: 8,
          height: 34,
          padding: "0 10px 0 4px",
          borderRadius: 99,
          border: "1px solid var(--bd-2)",
          background: "var(--bg-2)",
          cursor: hasMultiple ? "pointer" : "default",
          transition: "background 0.12s, border-color 0.12s",
        }}
        onMouseEnter={(e) => {
          if (hasMultiple) {
            (e.currentTarget as HTMLElement).style.background = "var(--pu-tint,#F6F3FF)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--pu-soft)";
          }
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-2)";
          (e.currentTarget as HTMLElement).style.borderColor = "var(--bd-2)";
        }}
      >
        {/* Avatar */}
        {selectedChild.photo_url ? (
          <img
            src={selectedChild.photo_url}
            alt={selectedChild.name}
            style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              background: "linear-gradient(135deg, var(--pu) 0%, var(--pu-deep) 100%)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 11,
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {initials}
          </div>
        )}

        {/* Name + grade */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}>
          <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: "-0.1px", lineHeight: 1.1, color: "var(--ink-1)", whiteSpace: "nowrap" }}>
            {selectedChild.name.split(" ")[0]}
          </span>
          <span style={{ fontSize: 9.5, color: "var(--ink-3)", lineHeight: 1.1, whiteSpace: "nowrap", letterSpacing: "0.05em", textTransform: "uppercase", fontWeight: 600, marginTop: 2 }}>
            {[selectedChild.class_name, selectedChild.section_name].filter(Boolean).join("-")}
            {selectedChild.roll_no ? ` · Roll ${selectedChild.roll_no}` : ""}
          </span>
        </div>

        {hasMultiple && (
          <ChevronDown size={11} strokeWidth={2} style={{ color: "var(--ink-3)", marginLeft: 2, flexShrink: 0 }} />
        )}
      </button>

      {open && hasMultiple && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            right: 0,
            minWidth: 200,
            background: "var(--bg-1)",
            border: "1px solid var(--bd)",
            borderRadius: 12,
            boxShadow: "var(--sh-3)",
            padding: 6,
            zIndex: 200,
          }}
        >
          <div style={{ padding: "4px 10px 6px", fontSize: 10, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
            Switch child
          </div>
          {children.map((c: ChildSummary) => {
            const isSelected = c.id === selectedChild.id;
            const ci = c.name.split(" ").filter(Boolean).map((w: string) => w[0]).slice(0, 2).join("").toUpperCase();
            return (
              <button
                key={c.id}
                onClick={() => selectChild(c)}
                style={{
                  width: "100%",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "7px 10px",
                  borderRadius: 8,
                  border: "none",
                  background: isSelected ? "var(--pu-tint,#F6F3FF)" : "transparent",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = "var(--bg-2)";
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {c.photo_url ? (
                  <img src={c.photo_url} alt={c.name} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                ) : (
                  <div style={{ width: 28, height: 28, borderRadius: "50%", background: isSelected ? "linear-gradient(135deg, var(--pu) 0%, var(--pu-deep) 100%)" : "var(--pu-soft)", color: isSelected ? "#fff" : "var(--pu)", display: "grid", placeItems: "center", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                    {ci}
                  </div>
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? "var(--ink-1)" : "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.name}
                  </div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>
                    {[c.class_name, c.section_name].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {isSelected && <Check size={13} color="var(--pu)" strokeWidth={2.5} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Parent TopBar ─────────────────────────────────────────────────────────────

function ParentTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const isHome = pathname === "/parent/home";
  const { me: guardianMe } = useParentChild();
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

  // Guardian name comes from /api/v1/parent/me/ via ParentChildContext
  const fullName = guardianMe?.name ?? "";
  const initials =
    fullName.split(" ").filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "P";

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
    } catch { /* always clear locally */ }
    clearAuthTokens();
    clearPermissionsCache();
    router.push("/login");
  }

  const navArrowBtn = (dir: "left" | "right", enabled: boolean) => (
    <button
      onClick={() => navScrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" })}
      disabled={!enabled}
      style={{
        flexShrink: 0, width: 24, height: 28, border: "none",
        cursor: enabled ? "pointer" : "default",
        background: enabled ? `linear-gradient(to ${dir === "left" ? "right" : "left"}, var(--bg-1) 50%, transparent)` : "transparent",
        display: "flex", alignItems: "center", justifyContent: "center",
        opacity: enabled ? 1 : 0.2, transition: "opacity 0.15s", borderRadius: 6, padding: 0, color: "var(--ink-2)",
      }}
    >
      {dir === "left" ? <ChevronLeft size={13} strokeWidth={2} /> : <ChevronRight size={13} strokeWidth={2} />}
    </button>
  );

  return (
    <header style={{ position: "sticky", top: 0, height: 56, background: "var(--bg-1)", borderBottom: "1px solid var(--bd)", zIndex: 50, display: "flex", alignItems: "center", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", width: "100%", height: "100%" }}>

        {/* Logo */}
        <Link href="/parent/home" style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none", flexShrink: 0 }}>
          <span style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg, var(--pu) 0%, var(--pu-deep) 100%)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 18, letterSpacing: "-0.04em", flexShrink: 0 }}>
            e
          </span>
          <span style={{ fontWeight: 600, fontSize: 17, letterSpacing: "-0.02em", color: "var(--ink-1)" }}>eskoolia</span>
        </Link>

        {/* Parent badge */}
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--pu)", background: "var(--pu-soft)", borderRadius: 6, padding: "3px 8px", flexShrink: 0 }}>
          Parent
        </div>

        {/* Module pills */}
        <nav style={{ display: "flex", alignItems: "center", gap: 2, marginLeft: 4, flex: "1 1 0", minWidth: 0, overflow: "hidden" }}>
          {navArrowBtn("left", canScrollLeft)}
          <div ref={navScrollRef} style={{ display: "flex", alignItems: "center", gap: 1, flex: 1, overflowX: "auto", scrollbarWidth: "none" }}>
            {navModules.map((mod) => <ModulePill key={mod.id} mod={mod} exactMatch />)}
          </div>
          {navArrowBtn("right", canScrollRight)}
        </nav>

        {/* Right side */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>

          {/* Child switcher */}
          <ChildSwitcher />

          {/* Widget manager — home only */}
          {isHome && <WidgetManager />}

          {/* Sticky notes */}
          <NoteTrigger />

          {/* Bell */}
          <button style={{ width: 34, height: 34, borderRadius: 8, border: "none", background: "transparent", color: "var(--ink-2)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Bell size={17} strokeWidth={1.5} />
          </button>

          {/* Avatar */}
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
              <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 190, background: "var(--bg-1)", border: "1px solid var(--bd)", borderRadius: 12, boxShadow: "var(--sh-3)", padding: 6, zIndex: 100 }}>
                <div style={{ padding: "6px 10px 8px", marginBottom: 4, borderBottom: "1px solid var(--bd)" }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-1)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fullName}</div>
                  <div style={{ fontSize: 11, color: "var(--ink-3)" }}>{guardianMe?.relation ?? "Parent"}</div>
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

// ── Parent SubNav ─────────────────────────────────────────────────────────────

function ParentSubNav() {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const allMods = useVisibleModules({ includeHome: true });
  const mod = allMods.find(
    (m) =>
      pathname === m.path ||
      m.sub.some((s) => pathname === s.path || pathname.startsWith(s.path + "/")) ||
      (m.path !== "/parent/home" && pathname.startsWith(m.path))
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
    <button onClick={() => scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" })} disabled={!enabled}
      style={{ flexShrink: 0, width: 28, height: 46, border: "none", cursor: enabled ? "pointer" : "default", background: enabled ? `linear-gradient(to ${dir === "left" ? "right" : "left"}, #fff 60%, transparent)` : "transparent", display: "flex", alignItems: "center", justifyContent: "center", opacity: enabled ? 1 : 0.25, padding: 0 }}>
      {dir === "left" ? <ChevronLeft size={15} color="var(--ink-2, #475569)" strokeWidth={2} /> : <ChevronRight size={15} color="var(--ink-2, #475569)" strokeWidth={2} />}
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
              <Link key={s.path} href={s.path}
                style={{ position: "relative", display: "flex", alignItems: "center", gap: 4, height: 46, padding: "1px 11px 0", fontSize: 12.5, fontWeight: isActive ? 600 : 400, lineHeight: 1.25, color: isActive ? "var(--pu, #3b5bdb)" : "var(--ink-2, #475569)", textDecoration: "none", whiteSpace: "nowrap", borderBottom: isActive ? "2px solid var(--pu, #3b5bdb)" : "2px solid transparent", flexShrink: 0, transition: "color 0.12s" }}>
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

// ── Shell + Layout ────────────────────────────────────────────────────────────

function ParentShell({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <ParentTopBar />
      <ParentSubNav />
      <main style={{ flex: 1, overflowY: "auto", background: "var(--bg-0, #FAFAFC)", padding: "22px 22px 60px" }}>
        {children}
      </main>
      <PageNotesPanel />
    </div>
  );
}

export default function ParentPortalLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <ParentChildProvider>
        <ParentShell>{children}</ParentShell>
      </ParentChildProvider>
    </AuthGate>
  );
}
