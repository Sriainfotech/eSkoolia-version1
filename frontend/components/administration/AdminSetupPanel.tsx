"use client";

import { FormEvent, useEffect, useState, useRef } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { ToastContainer, toast } from "react-toastify";
import s from "./VisitorBookPanel.module.css";

type Tab = "add" | "list";

// --- Icons ---
const PlusIcon = () => (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const DocIcon = () => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 5H8M4.5 7.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9 4l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);
const CheckIcon = () => (<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.2 7.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>);
const LinkIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6.5 3.5a2 2 0 112.83 2.83l-1.5 1.5a2 2 0 01-2.83 0m-2.83 2.83a2 2 0 11-2.83-2.83l1.5-1.5a2 2 0 012.83 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>);

type ApiList<T> = T[] | { results?: T[]; count?: number; next?: string | null; previous?: string | null };

type AdminSetupRow = {
  id: number;
  type: "1" | "2" | "3" | "4";
  name: string;
  description?: string;
};

const TYPE_OPTIONS: Array<{ value: AdminSetupRow["type"]; label: string }> = [
  { value: "1", label: "Purpose" },
  { value: "2", label: "Complaint Type" },
  { value: "3", label: "Source" },
  { value: "4", label: "Reference" },
];

const CATEGORY_CLASS: Record<AdminSetupRow["type"], string> = {
  "1": "cat-purpose",
  "2": "cat-complaint",
  "3": "cat-source",
  "4": "cat-reference",
};

type GroupRowsMap = Record<AdminSetupRow["type"], AdminSetupRow[]>;
type GroupNumberMap = Record<AdminSetupRow["type"], number>;

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const apiError = error as Error & { details?: Record<string, unknown> };
    if (apiError.details && typeof apiError.details === "object") {
      const msg = (apiError.details.message as string | undefined);
      if (msg && typeof msg === "string") {
        const trimmed = msg.trim();
        if (trimmed && trimmed !== "[object Object]") {
          return trimmed;
        }
      }
    }
    const message = error.message.trim();
    if (message && message !== "[object Object]") return message;
  }
  return fallback;
}

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function getTotalCount<T>(value: ApiList<T>): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value.count === "number") return value.count;
  return (value.results || []).length;
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiMutate<T>(path: string, method: "POST" | "PATCH", payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, { method: "DELETE", headers: { "Content-Type": "application/json" } });
}

export function AdminSetupPanel() {
  const [groupRows, setGroupRows] = useState<GroupRowsMap>({ "1": [], "2": [], "3": [], "4": [] });
  const [groupPage, setGroupPage] = useState<GroupNumberMap>({ "1": 1, "2": 1, "3": 1, "4": 1 });
  const [groupPageSize, setGroupPageSize] = useState<GroupNumberMap>({ "1": 5, "2": 5, "3": 5, "4": 5 });
  const [groupTotalRecords, setGroupTotalRecords] = useState<GroupNumberMap>({ "1": 0, "2": 0, "3": 0, "4": 0 });
  const [groupTotalPages, setGroupTotalPages] = useState<GroupNumberMap>({ "1": 1, "2": 1, "3": 1, "4": 1 });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  
  const [editingId, setEditingId] = useState<number | null>(null);
  const [type, setType] = useState<AdminSetupRow["type"] | "">("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formBanner, setFormBanner] = useState("");

  const [activeTab, setActiveTab] = useState<Tab>("add");
  const addSecRef = useRef<HTMLDivElement | null>(null);
  const listSecRef = useRef<HTMLDivElement | null>(null);

  const scrollToTab = (id: Tab) => {
    const el = id === "add" ? addSecRef.current : listSecRef.current;
    if (el) setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const loadTypePage = async (groupType: AdminSetupRow["type"], targetPage: number, targetPageSize: number) => {
    const data = await apiGet<ApiList<AdminSetupRow>>(
      `/api/v1/admissions/admin-setups/?type=${groupType}&page=${targetPage}&page_size=${targetPageSize}`
    );
    const rows = listData(data);
    const total = getTotalCount(data);
    const pages = Math.max(1, Math.ceil(total / targetPageSize));

    setGroupRows((prev) => ({ ...prev, [groupType]: rows }));
    setGroupTotalRecords((prev) => ({ ...prev, [groupType]: total }));
    setGroupTotalPages((prev) => ({ ...prev, [groupType]: pages }));
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      await Promise.all(TYPE_OPTIONS.map((o) => loadTypePage(o.value, groupPage[o.value], groupPageSize[o.value])));
    } catch (err) {
      toast.error("Unable to load admin setups.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void loadAll(); }, []);

  const resetForm = () => {
    setEditingId(null);
    setType("");
    setName("");
    setDescription("");
    setFormBanner("");
  };

  const editRow = (row: AdminSetupRow) => {
    setEditingId(row.id);
    setType(row.type);
    setName(row.name || "");
    setDescription(row.description || "");
    setFormBanner("");
    setActiveTab("add");
    scrollToTab("add");
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!type) { setFormBanner("Please select a type."); return; }
    if (!name.trim()) { setFormBanner("Name is required."); return; }

    const payload = { type, name: name.trim(), description: description.trim() };

    try {
      setSaving(true);
      setFormBanner("");
      if (editingId) {
        await apiMutate(`/api/v1/admissions/admin-setups/${editingId}/`, "PATCH", payload);
        toast.success("Record updated successfully.");
      } else {
        await apiMutate("/api/v1/admissions/admin-setups/", "POST", payload);
        toast.success("Record created successfully.");
      }
      resetForm();
      await loadAll();
      setActiveTab("list");
      scrollToTab("list");
    } catch (err) {
      toast.error(getErrorMessage(err, editingId ? "Unable to update setup." : "Unable to save setup."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (row: AdminSetupRow) => {
    if (!window.confirm("Are you sure to delete this admin setup entry?")) return;
    try {
      setBusyId(row.id);
      await apiDelete(`/api/v1/admissions/admin-setups/${row.id}/`);
      toast.success("Record deleted successfully.");
      await loadTypePage(row.type, groupPage[row.type], groupPageSize[row.type]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Unable to delete admin setup."));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className={s.root} style={{ padding: "16px 24px" }}>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnHover />
      
      {/* Custom accordion CSS for list view */}
      <style>{`
        .category-accordion {
          border-radius: 10px; overflow: hidden; margin-bottom: 10px; border: 1px solid #eef0f6; transition: all 0.3s ease; position: relative; background: #fff;
        }
        .category-accordion::before { content: ""; position: absolute; top: 0; left: 0; bottom: 0; width: 4px; border-radius: 10px 0 0 10px; }
        .category-accordion[open] { box-shadow: 0 2px 12px rgba(0,0,0,0.06); border-color: #dde0ea; }
        .category-accordion.cat-purpose::before { background: #7c83db; }
        .category-accordion.cat-purpose > summary { color: #4e54a8; }
        .category-accordion.cat-purpose .cat-badge { background: #ededfa; color: #5a5fba; }
        .category-accordion.cat-complaint::before { background: #e8849a; }
        .category-accordion.cat-complaint > summary { color: #a84e60; }
        .category-accordion.cat-complaint .cat-badge { background: #fce8ec; color: #c4566b; }
        .category-accordion.cat-source::before { background: #5ab88d; }
        .category-accordion.cat-source > summary { color: #3a7d5f; }
        .category-accordion.cat-source .cat-badge { background: #e6f6ee; color: #3e8a66; }
        .category-accordion.cat-reference::before { background: #d4a54a; }
        .category-accordion.cat-reference > summary { color: #8b6a24; }
        .category-accordion.cat-reference .cat-badge { background: #faf0da; color: #9e7a30; }
        .category-accordion > summary {
          padding: 13px 16px 13px 20px; cursor: pointer; font-weight: 650; font-size: 0.9rem; display: flex; align-items: center; justify-content: space-between; list-style: none; user-select: none; outline: none;
        }
        .cat-summary-left { display: flex; align-items: center; gap: 10px; }
        .cat-badge { font-size: 0.7rem; padding: 3px 10px; border-radius: 20px; font-weight: 600; }
        .cat-items-container { padding: 6px 16px 14px 20px; }
        .cat-item {
          display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; margin-bottom: 4px; border-radius: 8px; background: #fafbfd; border: 1px solid transparent;
        }
        .cat-item:hover { background: #f5f6fa; border-color: #e8eaf0; }
        .cat-item-info h4 { margin: 0 0 1px; font-size: 0.85rem; font-weight: 600; color: #3b3f5c; }
        .cat-item-info p { margin: 0; font-size: 0.73rem; color: #9ca3b4; }
        .icon-btn { width: 32px; height: 32px; border: none; border-radius: 7px; cursor: pointer; display: flex; align-items: center; justify-content: center; }
        .icon-btn-edit { background: #ededfa; color: #6c72cb; }
        .icon-btn-edit:hover { background: #6c72cb; color: #fff; }
        .icon-btn-delete { background: #fce8ec; color: #d4616f; margin-left: 6px; }
        .icon-btn-delete:hover { background: #d4616f; color: #fff; }
      `}</style>

      <div className={s.pageCard}>
        <div className={s.pageBody} style={{ padding: "20px" }}>
          
          <div className={s.actionNav}>
            {[
              { id: "add" as Tab, step: "01", label: editingId ? "Edit Admin Setup" : "Add Admin Setup", icon: <PlusIcon /> },
              { id: "list" as Tab, step: "02", label: "Admin Setup List", icon: <DocIcon /> }
            ].map(t => (
              <button key={t.id} type="button" className={`${s.navTab} ${activeTab === t.id ? s.navTabActive : ""}`}
                onClick={() => { setActiveTab(t.id); scrollToTab(t.id); }}>
                <span className={s.navTabStep}>{t.step}</span>{t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Section 01: Add/Edit Setup */}
          <div className={s.assignCard} ref={addSecRef}>
            <div className={s.assignCardTop}>
              <div>
                <div className={s.assignCardTitle}>{editingId ? "Edit Admin Setup" : "Register New Admin Setup"}</div>
                <div className={s.assignCardSub}>Fields marked with * are mandatory. Add purpose, complaint types, or references.</div>
              </div>
              {editingId && <span className={s.enrollChip}><LinkIcon/> Editing: {name}</span>}
            </div>
            
            {formBanner && (
              <div style={{ background: "#fff5f5", border: "1px solid #ffd0cc", color: "var(--red)", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                {formBanner}
              </div>
            )}

            <form onSubmit={submit}>
              <div className={s.roGrid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px 16px" }}>
                
                <div className={s.roField}>
                  <label>Type *</label>
                  <select required value={type} onChange={(e) => setType(e.target.value as AdminSetupRow["type"])} className={s.roInput}>
                    <option value="" disabled hidden>Select Type</option>
                    {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                
                <div className={s.roField}>
                  <label>Name *</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={s.roInput} placeholder="e.g. Broken Furniture" />
                </div>
                
                <div className={s.roField} style={{ gridColumn: "1 / -1" }}>
                  <label>Description</label>
                  <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} className={s.roInput} placeholder="Optional description" />
                </div>
              </div>

              <hr className={s.previewDivider} style={{ marginTop: 20 }} />
              <div className={s.saveRow}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>This configuration will be available in corresponding sub-modules.</span>
                </div>
                <div className={s.saveButtons}>
                  <button type="button" className={s.btnReset} onClick={resetForm}>{editingId ? "Cancel" : "Reset"}</button>
                  <button type="submit" disabled={saving} className={s.btnSave} style={{ minWidth: 140, justifyContent: "center" }}>
                    <CheckIcon /> {saving ? "Saving..." : editingId ? "Update Setup" : "Save Setup"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section 02 Browse */}
          <div className={s.browseSection} ref={listSecRef}>
            <div className={s.sectionHeading}>
              <span className={s.stepBadge}>02</span>
              <span className={s.sectionTitle}>Browse Admin Setups</span>
              <span className={s.sectionSub}>&mdash; view, edit, or delete existing records.</span>
            </div>

            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden", padding: 16 }}>
              {TYPE_OPTIONS.map((group) => {
                const rows = groupRows[group.value] || [];
                const currentTotal = groupTotalRecords[group.value];
                return (
                  <details key={group.value} className={`category-accordion ${CATEGORY_CLASS[group.value]}`}>
                    <summary>
                      <span className="cat-summary-left">
                        <span>{group.label}</span>
                        <span className="cat-badge">{currentTotal} items</span>
                      </span>
                    </summary>
                    <div className="cat-items-container">
                      {rows.length === 0 ? (
                        <div style={{ textAlign: "center", padding: 16, color: "#94a3b8", fontSize: 13 }}>No entries yet.</div>
                      ) : (
                        rows.map((row) => (
                          <div key={row.id} className="cat-item">
                            <div className="cat-item-info">
                              <h4>{row.name}</h4>
                              <p>{row.description || "No description"}</p>
                            </div>
                            <div style={{ display: "flex" }}>
                              <button type="button" className="icon-btn icon-btn-edit" onClick={() => editRow(row)}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
                              </button>
                              <button type="button" className="icon-btn icon-btn-delete" disabled={busyId === row.id} onClick={() => void remove(row)}>
                                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </details>
                );
              })}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
