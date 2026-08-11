"use client";

import Link from "next/link";
import {
  Users,
  GraduationCap,
  HandCoins,
  Landmark,
  BookOpen,
  Bus,
  Package,
  AlertTriangle,
  Briefcase,
  BarChart2,
  Building2,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import { getGroupedReportDefinitions } from "@/lib/reports-config";

const MODULE_META: Record<string, { label: string; icon: LucideIcon; color: string }> = {
  students: { label: "Student Reports", icon: Users, color: "#3B82F6" },
  fees: { label: "Fees Reports", icon: HandCoins, color: "#10B981" },
  accounts: { label: "Accounts Reports", icon: Landmark, color: "#F59E0B" },
  academics: { label: "Academics Reports", icon: GraduationCap, color: "#8B5CF6" },
  academic: { label: "Academic Reports", icon: GraduationCap, color: "#8B5CF6" },
  examination: { label: "Examination Reports", icon: ClipboardList, color: "#EC4899" },
  hr: { label: "HR Reports", icon: Briefcase, color: "#EF4444" },
  library: { label: "Library Reports", icon: BookOpen, color: "#06B6D4" },
  transport: { label: "Transport Reports", icon: Bus, color: "#6366F1" },
  dormitory: { label: "Dormitory Reports", icon: Building2, color: "#0EA5E9" },
  inventory: { label: "Inventory Reports", icon: Package, color: "#84CC16" },
  behaviour: { label: "Behaviour Reports", icon: AlertTriangle, color: "#DC2626" },
};

function moduleMeta(module: string) {
  return (
    MODULE_META[module] ?? {
      label: `${module.charAt(0).toUpperCase()}${module.slice(1)} Reports`,
      icon: BarChart2,
      color: "#6B7280",
    }
  );
}

export default function ReportsHubPage() {
  const groups = getGroupedReportDefinitions();
  const modules = Object.keys(groups).sort();

  return (
    <div>
      <section
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--bd)",
          borderRadius: 14,
          padding: "18px 22px",
          marginBottom: 20,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 700, color: "var(--ink-1)" }}>Reports</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
            {Object.values(groups).reduce((total, defs) => total + defs.length, 0)} reports across{" "}
            {modules.length} modules
          </p>
        </div>
      </section>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: 20,
        }}
      >
        {modules.map((module) => {
          const meta = moduleMeta(module);
          const Icon = meta.icon;
          return (
            <div
              key={module}
              style={{
                background: "var(--bg-1)",
                border: "1px solid var(--bd)",
                borderRadius: 14,
                overflow: "hidden",
                boxShadow: "var(--sh-1, none)",
              }}
            >
              <div
                style={{
                  padding: "14px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  borderBottom: "1px solid var(--bd)",
                }}
              >
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 32,
                    height: 32,
                    borderRadius: 9,
                    background: `${meta.color}1A`,
                    color: meta.color,
                    flexShrink: 0,
                  }}
                >
                  <Icon size={16} />
                </span>
                <h3 style={{ margin: 0, fontSize: 14.5, fontWeight: 650, color: "var(--ink-1)" }}>
                  {meta.label}
                </h3>
              </div>
              <div style={{ padding: "6px 0" }}>
                {groups[module]!.map((definition) => (
                  <Link
                    key={definition.key}
                    href={`/reports/${definition.key}`}
                    style={{
                      display: "block",
                      padding: "9px 16px",
                      textDecoration: "none",
                      borderBottom: "1px solid var(--bd)",
                    }}
                  >
                    <div style={{ fontSize: 13.5, fontWeight: 550, color: "var(--ink-1)" }}>
                      {definition.title}
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
