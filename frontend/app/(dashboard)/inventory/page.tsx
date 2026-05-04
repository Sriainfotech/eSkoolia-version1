"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ItemCategoryPanel } from "@/components/inventory/ItemCategoryPanel";
import { ItemStorePanel } from "@/components/inventory/ItemStorePanel";
import { SupplierPanel } from "@/components/inventory/SupplierPanel";
import { ItemPanel } from "@/components/inventory/ItemPanel";
import { ItemReceivePanel } from "@/components/inventory/ItemReceivePanel";
import { ItemIssuePanel } from "@/components/inventory/ItemIssuePanel";
import { ItemSellPanel } from "@/components/inventory/ItemSellPanel";

export default function InventoryPage() {
  const [activeTab, setActiveTab] = useState("categories");

  const tabs = [
    { id: "categories", label: "Categories", icon: "📦" },
    { id: "stores", label: "Stores", icon: "🏢" },
    { id: "suppliers", label: "Suppliers", icon: "🤝" },
    { id: "items", label: "Items", icon: "📋" },
    { id: "receives", label: "Receives", icon: "📥" },
    { id: "issues", label: "Issues", icon: "📤" },
    { id: "sales", label: "Sales", icon: "💰" },
  ];

  return (
    <div>
      {/* Page header / breadcrumbs (matches the visual style used by other
          dashboard pages such as students/list, finance, etc.) */}
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div className="student-page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 24px 0" }}>
            <h1 className="student-page-title" style={{ margin: 0, fontSize: 22 }}>Inventory</h1>
            <div className="student-page-crumbs" style={{ display: "flex", gap: 6, fontSize: 12, color: "var(--text-muted)" }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Inventory</span>
              <span>/</span>
              <span style={{ color: "var(--primary)", textTransform: "capitalize" }}>{tabs.find((t) => t.id === activeTab)?.label || activeTab}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Navigation Tabs */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          padding: "16px",
          borderBottom: "1px solid var(--line)",
          overflowX: "auto",
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: "8px 16px",
              border: "none",
              borderBottom: activeTab === tab.id ? "2px solid var(--primary)" : "2px solid transparent",
              backgroundColor: "transparent",
              color: activeTab === tab.id ? "var(--primary)" : "var(--text-secondary)",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: activeTab === tab.id ? "600" : "500",
              whiteSpace: "nowrap",
              transition: "all 200ms",
            }}
          >
            <span style={{ marginRight: "8px" }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ padding: "24px" }}>
        {activeTab === "categories" && <ItemCategoryPanel />}
        {activeTab === "stores" && <ItemStorePanel />}
        {activeTab === "suppliers" && <SupplierPanel />}
        {activeTab === "items" && <ItemPanel />}
        {activeTab === "receives" && <ItemReceivePanel />}
        {activeTab === "issues" && <ItemIssuePanel />}
        {activeTab === "sales" && <ItemSellPanel />}
      </div>
    </div>
  );
}
