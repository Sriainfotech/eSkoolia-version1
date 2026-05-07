"use client";

import { useState } from "react";
import { Settings, BookMarked } from "lucide-react";
import { AdminSetupPanel } from "@/components/administration/AdminSetupPanel";
import { StudentCategoryManagerPanel } from "@/components/students/StudentCategoryManagerPanel";

const TABS = [
  { id: "admin-setup",        label: "Admin Setup",       icon: Settings    },
  { id: "student-categories", label: "Student Categories", icon: BookMarked  },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SystemConfigPage() {
  const [active, setActive] = useState<TabId>("admin-setup");

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* Primary tab bar — matches ModuleSubNav style */}
      <div style={{
        display: "flex",
        alignItems: "flex-end",
        borderBottom: "2px solid var(--bd)",
        background: "#fff",
        padding: "0 24px",
        gap: 0,
      }}>
        {TABS.map((tab) => {
          const isActive = active === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActive(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "10px 18px",
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "var(--pu)" : "var(--ink-2)",
                background: "transparent",
                border: "none",
                borderBottom: isActive ? "2px solid var(--pu)" : "2px solid transparent",
                marginBottom: -2,
                cursor: "pointer",
                transition: "color 0.12s",
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={13} strokeWidth={1.8} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-0)" }}>
        {active === "admin-setup"        && <AdminSetupPanel />}
        {active === "student-categories" && <StudentCategoryManagerPanel />}
      </div>

    </div>
  );
}
