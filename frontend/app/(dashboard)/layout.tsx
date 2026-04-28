import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";
import AuthGate from "@/components/layout/AuthGate";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
      {/* Viewport-locked shell: nothing here scrolls except the <main> below. */}
      <div className="erp-shell h-screen flex overflow-hidden">
        {/* Sidebar owns its own width (.aside in Sidebar.module.css) + independent scroll. */}
        <Sidebar />

        {/* Right column: fixed-height flex-column so Topbar + main stack cleanly. */}
        <div className="flex-1 h-screen flex flex-col overflow-hidden min-w-0">
          {/* Topbar = the "fixed header" (Back + Logout + admin). Never scrolls. */}
          <Topbar />

          {/* The only scrollable region on the page. */}
          <main
            id="main-content"
            className="dashboard-main flex-1 overflow-y-auto min-h-0"
          >
            {children}
          </main>
        </div>
      </div>
    </AuthGate>
  );
}
