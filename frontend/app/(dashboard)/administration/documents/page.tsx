"use client";

import { useState } from "react";
import { FileBadge, Award, CreditCard, BadgeCheck } from "lucide-react";
import { IdCardPanel } from "@/components/administration/IdCardPanel";
import { GenerateIdCardPanel } from "@/components/administration/GenerateIdCardPanel";
import { CertificatePanel } from "@/components/administration/CertificatePanel";
import { GenerateCertificatePanel } from "@/components/administration/GenerateCertificatePanel";

type MainTab = "id-cards" | "certificates";
type SubTab  = "design" | "generate";

const MAIN_TABS: Array<{ id: MainTab; label: string; icon: typeof FileBadge }> = [
  { id: "id-cards",     label: "ID Cards",     icon: FileBadge },
  { id: "certificates", label: "Certificates", icon: Award     },
];

const SUB_TABS: Array<{ id: SubTab; label: string; icon: typeof CreditCard }> = [
  { id: "design",   label: "Design Template",  icon: CreditCard  },
  { id: "generate", label: "Generate & Print",  icon: BadgeCheck  },
];

export default function DocumentsStudioPage() {
  const [mainTab, setMainTab] = useState<MainTab>("id-cards");
  const [subTab,  setSubTab]  = useState<SubTab>("design");

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
        {MAIN_TABS.map((tab) => {
          const isActive = mainTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => { setMainTab(tab.id); setSubTab("design"); }}
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

      {/* Secondary pill tab bar */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 24px",
        background: "var(--bg-2)",
        borderBottom: "1px solid var(--bd)",
      }}>
        {SUB_TABS.map((tab) => {
          const isActive = subTab === tab.id;
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setSubTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 5,
                padding: "5px 14px",
                fontSize: 12,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#fff" : "var(--ink-2)",
                background: isActive ? "var(--pu)" : "transparent",
                border: `1px solid ${isActive ? "var(--pu)" : "var(--bd)"}`,
                borderRadius: 20,
                cursor: "pointer",
                transition: "all 0.12s",
                whiteSpace: "nowrap",
              }}
            >
              <Icon size={12} strokeWidth={1.8} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Panel content */}
      <div style={{ flex: 1, overflow: "auto", background: "var(--bg-0)" }}>
        {mainTab === "id-cards"     && subTab === "design"   && <IdCardPanel />}
        {mainTab === "id-cards"     && subTab === "generate" && <GenerateIdCardPanel />}
        {mainTab === "certificates" && subTab === "design"   && <CertificatePanel />}
        {mainTab === "certificates" && subTab === "generate" && <GenerateCertificatePanel />}
      </div>

    </div>
  );
}
