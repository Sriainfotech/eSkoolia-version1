"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";

type RoleItem = {
  id: number;
  name: string;
  is_system: boolean;
  created_at: string;
};

/** Deterministic background colour per role name — no hardcoding */
function getRoleColor(name: string): string {
  const palette = [
    "#F3E8FF", "#EFF6FF", "#DCFCE7", "#FEF9C3",
    "#EEEAFF", "#FEF3C7", "#E0F2FE", "#FCE7F3", "#FEF2F2", "#D1FAE5",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

type PanelMode = "add" | "edit" | null;

export function RoleManagementPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("roles.list", 1, 10);
  const [roles, setRoles] = useState<RoleItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldError, setFieldError] = useState("");
  const [deleteCandidate, setDeleteCandidate] = useState<RoleItem | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [roleName, setRoleName] = useState("");
  const [editingRoleId, setEditingRoleId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const [panelMode, setPanelMode] = useState<PanelMode>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  const loadRoles = async (targetPage = page, targetPageSize = pageSize) => {
    setLoading(true);
    setError("");
    try {
      const query = buildPaginationQuery(targetPage, targetPageSize, { search: search.trim() || undefined });
      const data = await apiRequestWithRefresh<ListApiResponse<RoleItem>>(`/api/v1/access-control/roles/?${query}`);
      const items = extractListData(data);
      const meta = extractPaginationMeta(data);
      setRoles(items);
      setTotalCount(meta?.count ?? items.length);
    } catch {
      setError("Unable to load role list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handle = window.setTimeout(() => { void loadRoles(); }, 250);
    return () => window.clearTimeout(handle);
  }, [page, pageSize, search]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const resetForm = () => {
    setEditingRoleId(null);
    setRoleName("");
    setFieldError("");
  };

  const closePanel = () => {
    setPanelMode(null);
    resetForm();
    setError("");
    setSuccess("");
  };

  const openAddPanel = () => {
    resetForm();
    setPanelMode("add");
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const openEditPanel = (row: RoleItem) => {
    setEditingRoleId(row.id);
    setRoleName(row.name);
    setFieldError("");
    setSuccess("");
    setPanelMode("edit");
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  const isValidRoleName = (value: string) => /^[A-Za-z0-9 ]+$/.test(value);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const normalized = roleName.trim();
    if (!normalized) {
      setFieldError("Role name is required.");
      return;
    }
    if (!isValidRoleName(normalized)) {
      setFieldError("Only letters, numbers, and spaces are allowed.");
      return;
    }
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldError("");
      const isUpdate = editingRoleId !== null;
      await apiRequestWithRefresh(`/api/v1/access-control/roles/${isUpdate ? `${editingRoleId}/` : ""}`, {
        method: isUpdate ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: normalized }),
      });
      setSuccess(isUpdate ? `"${normalized}" updated.` : `"${normalized}" created.`);
      closePanel();
      await loadRoles(page, pageSize);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save role.";
      setError(message);
      if (message.toLowerCase().includes("name")) setFieldError(message);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      setDeletingId(id);
      setError("");
      setSuccess("");
      await apiRequestWithRefresh(`/api/v1/access-control/roles/${id}/`, { method: "DELETE" });
      if (editingRoleId === id) resetForm();
      setSuccess("Role deleted.");
      const nextRoles = roles.filter((row) => row.id !== id);
      const nextPage = nextRoles.length === 0 && page > 1 ? page - 1 : page;
      if (nextPage !== page) setPage(nextPage);
      await loadRoles(nextPage, pageSize);
    } catch {
      setError("Unable to delete role.");
    } finally {
      setDeletingId(null);
      setDeleteCandidate(null);
    }
  };

  return (
    <section style={{ maxWidth: 1280, margin: "0 auto", padding: "24px 24px 40px" }}>

      {/* ── Page header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "var(--ink-1)" }}>
            Role{" "}
            <em style={{ color: "var(--pu)", fontStyle: "italic", fontWeight: 300 }}>Permission</em>
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
            Define roles and control which pages each role can access
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Search */}
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 13, color: "var(--ink-3)", pointerEvents: "none" }}>🔍</span>
            <input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search roles…"
              style={{
                paddingLeft: 30, paddingRight: 12, height: 36,
                border: "1px solid var(--bd)", borderRadius: 8,
                fontSize: 12, color: "var(--ink-1)", background: "var(--bg-1)",
                outline: "none", width: 200,
              }}
              onFocus={(e) => (e.target.style.borderColor = "var(--pu)")}
              onBlur={(e) => (e.target.style.borderColor = "var(--bd)")}
            />
          </div>
          <button
            type="button"
            onClick={openAddPanel}
            style={{
              height: 36, background: "var(--pu)", color: "#fff",
              border: "none", borderRadius: 8, padding: "0 16px",
              fontSize: 12, fontWeight: 600, cursor: "pointer",
            }}
          >
            + New Role
          </button>
        </div>
      </div>

      {/* ── Feedback banners ── */}
      {error && (
        <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "var(--err)" }}>
          {error}
        </div>
      )}
      {success && (
        <div style={{ background: "#DCFCE7", border: "1px solid #BBF7D0", borderRadius: 8, padding: "8px 14px", marginBottom: 12, fontSize: 12, color: "#16A34A" }}>
          {success}
        </div>
      )}

      {/* ── Split layout: cards + editor panel ── */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

        {/* ── Role cards ── */}
        <div style={{
          flex: 1, minWidth: 0,
          background: "var(--bg-1)", border: "1px solid var(--bd)",
          borderRadius: 14, boxShadow: "var(--sh-2)", padding: 20,
        }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 14 }}>
            All Roles{!loading ? ` · ${totalCount} defined` : ""}
          </div>

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} style={{ height: 54, borderRadius: 10, background: "var(--bg-2)", animation: "pulse 1.5s ease-in-out infinite" }} />
              ))}
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>

              {roles.map((role) => {
                const isSelected = panelMode === "edit" && editingRoleId === role.id;
                const bgColor = getRoleColor(role.name);
                return (
                  <div
                    key={role.id}
                    style={{
                      border: `1.5px solid ${isSelected ? "var(--pu)" : "var(--bd)"}`,
                      borderRadius: 10, padding: "10px 12px",
                      background: isSelected ? "#FAFAFF" : "var(--bg-1)",
                      cursor: "pointer", position: "relative",
                      display: "flex", alignItems: "center", gap: 10,
                      transition: "border-color 0.15s",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = "#C4B5FD";
                      const actions = e.currentTarget.querySelector<HTMLElement>(".role-hover-actions");
                      if (actions) actions.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.borderColor = "var(--bd)";
                      const actions = e.currentTarget.querySelector<HTMLElement>(".role-hover-actions");
                      if (actions) actions.style.opacity = "0";
                    }}
                  >
                    {/* Icon: first letter, deterministic colour */}
                    <div style={{
                      width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                      background: bgColor,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700, color: "var(--ink-2)",
                    }}>
                      {role.name.charAt(0).toUpperCase()}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-1)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {role.name}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--ink-3)", marginTop: 2 }}>
                        {role.is_system ? "System" : "Custom"}
                      </div>
                    </div>

                    {/* Hover actions */}
                    <div
                      className="role-hover-actions"
                      style={{ position: "absolute", top: 6, right: 6, display: "flex", gap: 4, opacity: 0, transition: "opacity 0.15s" }}
                    >
                      <button
                        type="button"
                        title="Assign permissions"
                        onClick={(e) => { e.stopPropagation(); }}
                        style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: "var(--pu-soft)", color: "var(--pu)", cursor: "pointer", fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 0 }}
                      >
                        <Link href={`/roles/assign-permission/${role.id}`} style={{ color: "inherit", textDecoration: "none", fontSize: 10 }} title="Assign">🔑</Link>
                      </button>
                      <button
                        type="button"
                        title="Edit role"
                        onClick={(e) => { e.stopPropagation(); openEditPanel(role); }}
                        style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: "var(--bg-2)", color: "var(--pu)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}
                      >✏</button>
                      {!role.is_system && (
                        <button
                          type="button"
                          title="Delete role"
                          onClick={(e) => { e.stopPropagation(); setDeleteCandidate(role); }}
                          style={{ width: 22, height: 22, borderRadius: 5, border: "none", background: "#FEF2F2", color: "var(--err)", cursor: "pointer", fontSize: 11, display: "flex", alignItems: "center", justifyContent: "center" }}
                        >🗑</button>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Add New Role dashed card */}
              <div
                onClick={openAddPanel}
                style={{
                  border: "1.5px dashed var(--bd)", borderRadius: 10,
                  padding: "10px 12px", cursor: "pointer",
                  display: "flex", alignItems: "center", gap: 10,
                  color: "var(--ink-3)", fontSize: 12, background: "transparent",
                  transition: "border-color 0.15s",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--pu)"; e.currentTarget.style.color = "var(--pu)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--bd)"; e.currentTarget.style.color = "var(--ink-3)"; }}
              >
                <div style={{ width: 30, height: 30, borderRadius: 8, border: "1.5px dashed var(--bd)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>+</div>
                Add New Role
              </div>

              {roles.length === 0 && !loading && (
                <div style={{ gridColumn: "1 / -1", textAlign: "center", padding: "32px 24px", color: "var(--ink-3)", fontSize: 13 }}>
                  No roles found{search ? ` matching "${search}"` : ""}. Create your first role.
                </div>
              )}
            </div>
          )}

          <div style={{ marginTop: 12, fontSize: 11, color: "var(--ink-2)", background: "var(--bg-2)", borderRadius: 8, padding: "8px 12px" }}>
            Hover any card → <strong style={{ color: "var(--ink-1)" }}>🔑 assign permissions</strong> · <strong style={{ color: "var(--ink-1)" }}>✏ edit</strong> · <strong style={{ color: "var(--ink-1)" }}>🗑 delete</strong>
          </div>

          {/* Pagination — only shown when there are multiple pages */}
          {totalPages > 1 && (
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12, color: "var(--ink-3)" }}>
              <span>Showing {roles.length} of {totalCount}</span>
              <div style={{ display: "flex", gap: 6 }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    style={{
                      width: 28, height: 28, borderRadius: 6, border: "1px solid var(--bd)",
                      background: p === page ? "var(--pu)" : "var(--bg-1)",
                      color: p === page ? "#fff" : "var(--ink-2)",
                      cursor: "pointer", fontSize: 12, fontWeight: p === page ? 600 : 400,
                    }}
                  >{p}</button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ── Slide-in editor panel ── */}
        {panelMode !== null && (
          <div style={{
            width: 290, flexShrink: 0,
            border: "1.5px solid var(--pu)", borderRadius: 10,
            background: "#FAFAFF", overflow: "hidden",
            boxShadow: "var(--sh-2)",
          }}>
            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "12px 14px",
              background: panelMode === "add" ? "var(--pu-soft)" : "#EFF6FF",
              borderBottom: "1px solid #C4B5FD",
            }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "var(--pu-deep)" }}>
                {panelMode === "add" ? "+ New Role" : "✏ Edit Role"}
              </span>
              <button
                type="button"
                onClick={closePanel}
                style={{ background: "none", border: "none", fontSize: 18, color: "var(--ink-3)", cursor: "pointer", lineHeight: 1 }}
              >×</button>
            </div>

            {/* Body */}
            <form onSubmit={submit}>
              <div style={{ padding: 14 }}>
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 10, fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", display: "block", marginBottom: 5 }}>
                    Role Name *
                  </label>
                  <input
                    ref={nameInputRef}
                    value={roleName}
                    onChange={(e) => { setRoleName(e.target.value); if (fieldError) setFieldError(""); }}
                    placeholder="e.g. Sports Coordinator"
                    style={{
                      width: "100%", padding: "8px 10px",
                      border: `1px solid ${fieldError ? "var(--err)" : "var(--bd)"}`,
                      borderRadius: 8, fontSize: 12, color: "var(--ink-1)",
                      background: "var(--bg-1)", outline: "none", fontFamily: "inherit",
                      boxShadow: fieldError ? "0 0 0 2px rgba(224,70,58,0.1)" : "none",
                    }}
                    onFocus={(e) => { if (!fieldError) e.target.style.borderColor = "var(--pu)"; e.target.style.boxShadow = "0 0 0 2px rgba(109,74,255,0.1)"; }}
                    onBlur={(e) => { if (!fieldError) e.target.style.borderColor = "var(--bd)"; e.target.style.boxShadow = "none"; }}
                  />
                  {fieldError && (
                    <span style={{ fontSize: 11, color: "var(--err)", marginTop: 4, display: "block" }}>{fieldError}</span>
                  )}
                </div>

                <div style={{ background: "var(--bg-2)", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "var(--ink-2)" }}>
                  {panelMode === "add"
                    ? "After creating, use the 🔑 button on the card to assign page permissions."
                    : "Changing the name does not affect existing permissions."}
                </div>
              </div>

              {/* Footer */}
              <div style={{ display: "flex", gap: 8, padding: "12px 14px", borderTop: "1px solid var(--bd)", background: "var(--bg-1)" }}>
                <button
                  type="button"
                  onClick={closePanel}
                  style={{ flex: 1, padding: "7px 14px", borderRadius: 8, border: "1px solid var(--bd)", background: "var(--bg-1)", color: "var(--ink-2)", fontSize: 11, cursor: "pointer" }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{ flex: 1, padding: "7px 14px", borderRadius: 8, border: "none", background: saving ? "var(--ink-3)" : "var(--pu)", color: "#fff", fontSize: 11, fontWeight: 600, cursor: saving ? "not-allowed" : "pointer" }}
                >
                  {saving ? "Saving…" : panelMode === "add" ? "Create Role" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        )}

      </div>

      {/* ── Delete confirmation modal (existing, untouched) ── */}
      <ConfirmationModal
        isOpen={deleteCandidate !== null}
        title="Delete Role"
        message={`Are you sure you want to delete "${deleteCandidate?.name}"? This cannot be undone.`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={deletingId !== null}
        onConfirm={() => (deleteCandidate ? void remove(deleteCandidate.id) : undefined)}
        onCancel={() => setDeleteCandidate(null)}
      />

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </section>
  );
}
