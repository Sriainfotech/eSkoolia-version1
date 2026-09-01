"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import AuthGate from "@/components/layout/AuthGate";

/* ─── Top nav (default) ─── */
import { TopBarNew } from "@/components/nav/TopBar";
import { CommandPalette, useCmdK } from "@/components/nav/CommandPalette";
import { AIBot } from "@/components/AIBot";
import { ModuleSubNav } from "@/components/nav/ModuleSubNav";
import { PageNotesPanel } from "@/components/notes/PageNotesPanel";

/* ─── Legacy sidebar nav — retired, kept for reference only ───
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
──────────────────────────────────────────────────────────── */

import { saveRecentLS, shouldTrack } from "@/lib/recentsStore";

function useRecentsTracking() {
  const pathname = usePathname();
  useEffect(() => {
    if (!shouldTrack(pathname)) return;
    saveRecentLS(pathname);
    fetch("/api/user/recents/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: pathname }),
    }).catch(() => {});
  }, [pathname]);
}

function NewNavShell({ children }: { children: React.ReactNode }) {
  const [cmdOpen, setCmdOpen] = useState(false);
  useCmdK(() => setCmdOpen(true));
  useRecentsTracking();

  return (
    <div className="h-screen flex flex-col overflow-hidden" style={{ background: "var(--bg-0)" }}>
      <TopBarNew onCmdK={() => setCmdOpen(true)} />
      <ModuleSubNav />
      <main
        id="main-content"
        className="flex-1 overflow-y-auto min-h-0 main-content-new-nav"
        style={{ padding: '18px 32px' }}
      >
        {children}
      </main>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <PageNotesPanel />
      <AIBot />
    </div>
  );
}

/* ─── Legacy sidebar shell — retired, kept for reference only ───
function LegacyShell({ children }: { children: React.ReactNode }) {
  useRecentsTracking();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  return (
    <div className="erp-shell h-screen flex overflow-hidden">
      <Sidebar mobileOpen={mobileNavOpen} onMobileClose={() => setMobileNavOpen(false)} />
      <div className="flex-1 h-screen flex flex-col overflow-hidden min-w-0">
        <Topbar onMenuToggle={() => setMobileNavOpen((o) => !o)} mobileMenuOpen={mobileNavOpen} />
        <main
          id="main-content"
          className="dashboard-main flex-1 overflow-y-auto min-h-0"
        >
          {children}
        </main>
      </div>
      <AIBot />
    </div>
  );
}
──────────────────────────────────────────────────────────── */

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      <NewNavShell>{children}</NewNavShell>
    </AuthGate>
  );
}
