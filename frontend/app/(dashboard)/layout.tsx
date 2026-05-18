"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import AuthGate from "@/components/layout/AuthGate";

/* ─── New nav (NEXT_PUBLIC_NEW_NAV=1) ─── */
import { TopBarNew } from "@/components/nav/TopBar";
import { CommandPalette, useCmdK } from "@/components/nav/CommandPalette";
import { AIBot } from "@/components/AIBot";
import { ModuleSubNav } from "@/components/nav/ModuleSubNav";
import { PageNotesPanel } from "@/components/notes/PageNotesPanel";

/* ─── Legacy nav (default) ─── */
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

import { getAccessToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import { saveRecentLS, shouldTrack } from "@/lib/recentsStore";

const USE_NEW_NAV = process.env.NEXT_PUBLIC_NEW_NAV === "1";

function useRecentsTracking() {
  const pathname = usePathname();
  useEffect(() => {
    if (!shouldTrack(pathname)) return;
    saveRecentLS(pathname);
    const token = getAccessToken();
    fetch(`${API_BASE_URL}/api/user/recents/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      {USE_NEW_NAV ? (
        <NewNavShell>{children}</NewNavShell>
      ) : (
        <LegacyShell>{children}</LegacyShell>
      )}
    </AuthGate>
  );
}
