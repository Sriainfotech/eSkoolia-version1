"use client";

type AdministrationPlaceholderPanelProps = {
  title: string;
};
//
export function AdministrationPlaceholderPanel({ title }: AdministrationPlaceholderPanelProps) {
  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Admin Section</span>
              <span>/</span>
              <span>{title}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div
            className="white-box"
            style={{
              background: "var(--surface)",
              border: "1px solid var(--line)",
              borderRadius: "var(--radius)",
              padding: 16,
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>{title}</h3>
            <p style={{ margin: 0, color: "var(--text-muted)" }}>
              This module route is now active. I will implement this screen with full PHP-style parity next.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
