"use client";

import { useState } from "react";
import { Mail, Send } from "lucide-react";
import { PostalReceivePanel } from "@/components/administration/PostalReceivePanel";
import { PostalDispatchPanel } from "@/components/administration/PostalDispatchPanel";

const TABS = [
  { id: "receive",  label: "Postal Received",   icon: Mail },
  { id: "dispatch", label: "Postal Dispatched",  icon: Send },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function PostalManagementPage() {
  const [active, setActive] = useState<TabId>("receive");

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
        {active === "receive"  && <PostalReceivePanel />}
        {active === "dispatch" && <PostalDispatchPanel />}
      </div>

    </div>
  );
}
