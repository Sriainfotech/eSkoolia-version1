"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home, GraduationCap, CalendarDays, BookOpen, FileText, Star,
  CreditCard, Bell, MessageCircle, Bus, Leaf, Shield, User,
  Activity, Trophy, Users, LayoutGrid, Clock,
} from "lucide-react";
import { useParentChild } from "@/contexts/ParentChildContext";
import { fetchChildDetail, type ChildDetail } from "@/lib/api/parent";
import { useWidgetStore } from "@/lib/widgetStore";
import { ParentAttendanceWidget } from "@/components/widgets/parent/ParentAttendanceWidget";
import { ParentResultsWidget }    from "@/components/widgets/parent/ParentResultsWidget";
import { ParentNoticesWidget }    from "@/components/widgets/parent/ParentNoticesWidget";
import { ParentFeesWidget }       from "@/components/widgets/parent/ParentFeesWidget";

// ── Helpers ───────────────────────────────────────────────────────────────────

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function today(): string {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
}

// ── Tile types ────────────────────────────────────────────────────────────────

interface TileDef {
  n: string; sub: string; icon: React.ElementType;
  col: string; bg: string; path: string; tag?: string;
}

// ── Data ──────────────────────────────────────────────────────────────────────

const QUICK: TileDef[] = [
  { n: "Attendance",       sub: "DAILY LOG",      icon: CalendarDays,   col: "#0E9F6E", bg: "var(--ok-soft)",     path: "/parent/attendance" },
  { n: "Timetable",        sub: "ACADEMICS",       icon: CalendarDays,   col: "#5836E0", bg: "var(--pu-soft)",     path: "/parent/children"   },
  { n: "Pay Fees",         sub: "FEES",            icon: CreditCard,     col: "#A65D08", bg: "var(--warn-soft)",   path: "/parent/fees"       },
  { n: "Permission Slips", sub: "APPROVALS",       icon: FileText,       col: "#1A4ACF", bg: "var(--info-soft)",   path: "/parent/notices"    },
  { n: "Apply Leave",      sub: "ATTENDANCE",      icon: Leaf,           col: "#0E9F6E", bg: "var(--ok-soft)",     path: "/parent/attendance" },
  { n: "Bus Tracking",     sub: "TRANSPORT",       icon: Bus,            col: "#992558", bg: "#FCE6F0",            path: "/parent/home"       },
  { n: "Homework",         sub: "ACADEMICS",       icon: FileText,       col: "#5836E0", bg: "var(--pu-soft)",     path: "/parent/children"   },
  { n: "Message Teacher",  sub: "COMMUNICATION",   icon: MessageCircle,  col: "#E0463A", bg: "var(--danger-soft)", path: "/parent/notices"    },
];

const ALL_MODULES: TileDef[] = [
  { n: "Dashboard",     sub: "Home",          icon: Home,          col: "#5836E0", bg: "var(--pu-soft)",     path: "/parent/home",       tag: "CHILD" },
  { n: "Academics",     sub: "4 pages",       icon: GraduationCap, col: "#0E9F6E", bg: "var(--ok-soft)",     path: "/parent/children"   },
  { n: "Attendance",    sub: "3 pages",       icon: CalendarDays,  col: "#0E9F6E", bg: "var(--ok-soft)",     path: "/parent/attendance" },
  { n: "Fees",          sub: "2 pages",       icon: CreditCard,    col: "#A65D08", bg: "var(--warn-soft)",   path: "/parent/fees"       },
  { n: "Communication", sub: "3 pages",       icon: MessageCircle, col: "#5836E0", bg: "var(--pu-soft)",     path: "/parent/notices"    },
  { n: "Student Life",  sub: "4 pages",       icon: Trophy,        col: "#0369A1", bg: "#E0EAFE",            path: "/parent/children"   },
  { n: "Transport",     sub: "2 pages",       icon: Bus,           col: "#992558", bg: "#FCE6F0",            path: "/parent/home"       },
  { n: "Documents",     sub: "TC · Bonafide", icon: FileText,      col: "#1A4ACF", bg: "var(--info-soft)",   path: "/parent/children"   },
  { n: "Cafeteria",     sub: "Menu · Wallet", icon: LayoutGrid,    col: "#5A607A", bg: "var(--bg-2)",        path: "/parent/home"       },
  { n: "Profile",       sub: "Account",       icon: User,          col: "#5A607A", bg: "var(--bg-2)",        path: "/parent/home"       },
];

// ── Recently Visited (localStorage) ──────────────────────────────────────────

const RECENTS_KEY = "parent_recents";
interface RecentItem { n: string; sub: string; path: string; ts: number; }

function getRecents(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENTS_KEY) ?? "[]"); } catch { return []; }
}

function relTime(ts: number): string {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 60) return m <= 1 ? "Just now" : `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return d === 1 ? "Yesterday" : `${d}d ago`;
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function SecHeader({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 22, marginBottom: 10 }}>
      <Icon size={11} strokeWidth={2} style={{ color: "var(--ink-3)" }} />
      <span style={{ fontSize: 10.5, fontWeight: 600, color: "var(--ink-2)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
        {label}
      </span>
      <span style={{ marginLeft: "auto", fontSize: 10.5, fontWeight: 600, color: "var(--ink-3)", letterSpacing: "0.06em" }}>
        {count}
      </span>
    </div>
  );
}

function QuickTile({ mod }: { mod: TileDef }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(mod.path)}
      style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "0 2px 10px -2px rgba(15,18,34,0.08)"; el.style.borderColor = "rgba(124,91,255,0.25)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "none"; el.style.borderColor = "var(--bd)"; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 9, background: mod.bg, color: mod.col, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <mod.icon size={17} strokeWidth={1.75} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{mod.n}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{mod.sub}</div>
      </div>
    </div>
  );
}

function RecentTile({ item }: { item: RecentItem }) {
  const router = useRouter();
  const mod = ALL_MODULES.find(m => m.path === item.path) ?? QUICK.find(m => m.path === item.path);
  const Icon = mod?.icon ?? FileText;
  return (
    <div
      onClick={() => router.push(item.path)}
      style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "10px 12px", display: "flex", alignItems: "center", gap: 10, cursor: "pointer", transition: "box-shadow 0.15s, border-color 0.15s" }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "0 2px 10px -2px rgba(15,18,34,0.08)"; el.style.borderColor = "rgba(124,91,255,0.25)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "none"; el.style.borderColor = "var(--bd)"; }}
    >
      <div style={{ width: 36, height: 36, borderRadius: 9, background: mod?.bg ?? "var(--pu-soft)", color: mod?.col ?? "var(--pu)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={17} strokeWidth={1.75} />
      </div>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)", lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.n}</div>
        <div style={{ fontSize: 11, color: "var(--ink-3)", marginTop: 1 }}>{item.sub} · {relTime(item.ts)}</div>
      </div>
    </div>
  );
}

function ModTile({ mod }: { mod: TileDef }) {
  const router = useRouter();
  return (
    <div
      onClick={() => router.push(mod.path)}
      style={{ background: "#fff", border: "1px solid var(--bd)", borderRadius: 12, padding: "12px 8px", textAlign: "center", cursor: "pointer", transition: "transform 0.18s, box-shadow 0.18s, border-color 0.18s", display: "flex", flexDirection: "column", alignItems: "center", gap: 6, position: "relative", minHeight: 80 }}
      onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "translateY(-2px)"; el.style.boxShadow = "0 4px 12px -4px rgba(15,18,34,0.10)"; el.style.borderColor = "rgba(124,91,255,0.35)"; }}
      onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.transform = "none"; el.style.boxShadow = "none"; el.style.borderColor = "var(--bd)"; }}
    >
      {mod.tag && (
        <span style={{ position: "absolute", top: 6, right: 6, fontSize: 8, fontWeight: 700, background: "var(--pu)", color: "#fff", padding: "1px 5px", borderRadius: 99, letterSpacing: "0.06em" }}>{mod.tag}</span>
      )}
      <div style={{ width: 36, height: 36, borderRadius: 10, background: mod.bg, color: mod.col, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <mod.icon size={17} strokeWidth={1.5} />
      </div>
      <div style={{ fontSize: 11.5, fontWeight: 600, color: "var(--ink-1)", lineHeight: 1.25, wordBreak: "break-word" }}>{mod.n}</div>
    </div>
  );
}

// ── Center content ────────────────────────────────────────────────────────────

function ParentCenter({ me, childLabel }: { me: ReturnType<typeof useParentChild>["me"]; childLabel: string }) {
  const [recents, setRecents] = useState<RecentItem[]>([]);
  useEffect(() => { setRecents(getRecents()); }, []);

  const firstName = me?.name.split(" ")[0] ?? "…";

  return (
    <div style={{ minWidth: 0 }}>
      {/* Greeting */}
      <section style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 24, flexWrap: "wrap", marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 600, letterSpacing: "-0.5px", lineHeight: 1.25, margin: 0, color: "var(--ink-1)" }}>
            {greeting()},{" "}
            <em style={{ fontFamily: "var(--font-instrument-serif,'Instrument Serif',Georgia,serif)", fontStyle: "italic", color: "var(--pu)", fontWeight: 400, fontSize: 26 }}>
              {firstName}&apos;s family
            </em>
          </h1>
          <p style={{ fontSize: 13, color: "var(--ink-2)", marginTop: 4 }}>
            {today()}
            {me && <> &nbsp;·&nbsp; {me.children_count} {me.children_count === 1 ? "child" : "children"} enrolled</>}
          </p>
        </div>
        {/* Meta chips */}
        <div style={{ display: "flex", gap: 0, border: "1px solid var(--bd)", borderRadius: 9, overflow: "hidden", background: "#fff", flexShrink: 0 }}>
          <div style={{ padding: "8px 14px", borderRight: "1px solid var(--bd)" }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Academic Year</div>
            <div style={{ fontFamily: "var(--font-mono,'JetBrains Mono',ui-monospace,monospace)", fontSize: 13, fontWeight: 600, color: "var(--ink-1)", marginTop: 3 }}>2025–26</div>
          </div>
          {childLabel && (
            <div style={{ padding: "8px 14px" }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--ink-3)", letterSpacing: "0.08em", textTransform: "uppercase" }}>Child</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink-1)", marginTop: 3 }}>{childLabel}</div>
            </div>
          )}
        </div>
      </section>

      {/* Quick Access */}
      <SecHeader icon={Star} label="Quick Access" count={`${QUICK.length} PINNED`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 10, marginBottom: 4 }}>
        {QUICK.map(t => <QuickTile key={t.n} mod={t} />)}
      </div>

      {/* Recently Visited */}
      {recents.length > 0 && (
        <>
          <SecHeader icon={Clock} label="Recently Visited" count="LAST 7 DAYS" />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 10, marginBottom: 4 }}>
            {recents.slice(0, 8).map((r, i) => <RecentTile key={i} item={r} />)}
          </div>
        </>
      )}

      {/* All Modules */}
      <SecHeader icon={GraduationCap} label="All Modules" count={`${ALL_MODULES.length} GROUPS`} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(108px, 1fr))", gap: 8 }}>
        {ALL_MODULES.map(m => <ModTile key={m.n} mod={m} />)}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ParentHomePage() {
  const { me, selectedChild } = useParentChild();
  const [detail, setDetail] = useState<ChildDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const { isEnabled } = useWidgetStore();

  useEffect(() => {
    if (!selectedChild) return;
    setDetail(null);
    setDetailLoading(true);
    fetchChildDetail(selectedChild.id)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setDetailLoading(false));
  }, [selectedChild?.id]);

  const childFirstName = selectedChild?.name.split(" ")[0] ?? null;
  const childLabel = selectedChild
    ? [
        selectedChild.name,
        [selectedChild.class_name, selectedChild.section_name].filter(Boolean).join("-"),
        selectedChild.roll_no ? `Roll ${selectedChild.roll_no}` : null,
      ].filter(Boolean).join(" · ")
    : "";

  const showLeft  = isEnabled("parent-attendance") || isEnabled("parent-results");
  const showRight = isEnabled("parent-notices")    || isEnabled("parent-fees");

  return (
    <div
      data-left={showLeft ? "on" : "off"}
      data-right={showRight ? "on" : "off"}
      style={{ display: "grid", gap: 28, maxWidth: 1680, margin: "0 auto", padding: "24px 28px 56px", gridTemplateColumns: "1fr" }}
      className="home-grid"
    >
      {/* Left rail */}
      <div className="home-left-rail" style={{ minWidth: 0, overflow: "hidden" }}>
        {showLeft && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isEnabled("parent-attendance") && <ParentAttendanceWidget childName={childFirstName} detail={detail} loading={detailLoading} />}
            {isEnabled("parent-results")    && <ParentResultsWidget    childName={childFirstName} detail={detail} loading={detailLoading} />}
          </div>
        )}
      </div>

      {/* Center */}
      <ParentCenter me={me} childLabel={childLabel} />

      {/* Right rail */}
      <div className="home-right-rail" style={{ minWidth: 0, overflow: "hidden" }}>
        {showRight && (
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {isEnabled("parent-notices") && <ParentNoticesWidget />}
            {isEnabled("parent-fees")    && <ParentFeesWidget />}
          </div>
        )}
      </div>

      <style>{`
        .home-left-rail  { display: none; }
        .home-right-rail { display: none; }
        @media (min-width: 1024px) {
          .home-grid { grid-template-columns: 272px 1fr 0px !important; gap: 32px !important; }
          .home-left-rail  { display: block !important; }
          .home-right-rail { display: block !important; }
          .home-grid[data-left="off"] { grid-template-columns: 0px 1fr 0px !important; }
        }
        @media (min-width: 1360px) {
          .home-grid { grid-template-columns: 280px 1fr 300px !important; gap: 32px !important; }
          .home-grid[data-left="off"]  { grid-template-columns: 0px 1fr 300px !important; }
          .home-grid[data-right="off"] { grid-template-columns: 280px 1fr 0px !important; }
          .home-grid[data-left="off"][data-right="off"] { grid-template-columns: 0px 1fr 0px !important; }
        }
        @media (min-width: 1560px) {
          .home-grid { grid-template-columns: 296px 1fr 320px !important; gap: 36px !important; }
          .home-grid[data-left="off"]  { grid-template-columns: 0px 1fr 320px !important; }
          .home-grid[data-right="off"] { grid-template-columns: 296px 1fr 0px !important; }
          .home-grid[data-left="off"][data-right="off"] { grid-template-columns: 0px 1fr 0px !important; }
        }
      `}</style>
    </div>
  );
}
