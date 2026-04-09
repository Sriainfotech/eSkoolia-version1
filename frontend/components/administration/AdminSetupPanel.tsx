"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type ApiList<T> = T[] | { results?: T[] };

type AdminSetupRow = {
  id: number;
  type: "1" | "2" | "3" | "4";
  name: string;
  description?: string;
};

type FieldErrors = {
  type?: string;
  name?: string;
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

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && message !== "[object Object]") {
      return message;
    }
  }
  return fallback;
}

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function isMeaningless(value: string): boolean {
  const text = value.trim();
  if (!text) return true;
  if (/^(.)\1+$/.test(text)) return true;
  if (/^[^A-Za-z0-9]+$/.test(text)) return true;
  if (text.length >= 4 && /^(.{1,3})\1+$/.test(text)) return true;
  if (text.replace(/[^A-Za-z]/g, "").length < 2) return true;
  if (/<[^>]*>/i.test(text)) return true;
  return false;
}

function validateName(value: string): string | undefined {
  const text = value.trim();
  if (!text) return "Name is required.";
  if (text.length < 3) return "Name must be at least 3 characters.";
  if (!/^[A-Za-z]/.test(text)) return "Name must start with a letter.";
  if (isMeaningless(text)) return "Enter a meaningful name. Avoid repeated or random characters.";
  return undefined;
}

function validateDescription(value: string): string | undefined {
  const text = value.trim();
  if (!text) return undefined;
  if (text.length < 5) return "Description must be at least 5 characters.";
  if (isMeaningless(text)) return "Enter a meaningful description.";
  return undefined;
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
}

async function apiMutate<T>(path: string, method: "POST" | "PATCH", payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function boxStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
  } as const;
}

function fieldStyle() {
  return {
    width: "100%",
    height: 36,
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "0 10px",
  } as const;
}

function buttonStyle(color = "var(--primary)") {
  return {
    height: 36,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    padding: "0 12px",
    cursor: "pointer",
    fontSize: 13,
  } as const;
}

export function AdminSetupPanel() {
  const [items, setItems] = useState<AdminSetupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [touched, setTouched] = useState<{ type: boolean; name: boolean; description: boolean }>({
    type: false,
    name: false,
    description: false,
  });

  const [editingId, setEditingId] = useState<number | null>(null);
  const [type, setType] = useState<AdminSetupRow["type"] | "">("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<ApiList<AdminSetupRow>>("/api/v1/admissions/admin-setups/");
      setItems(listData(data));
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Unable to load admin setups."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setType("");
    setName("");
    setDescription("");
    setFieldErrors({});
    setTouched({ type: false, name: false, description: false });
  };

  const edit = (row: AdminSetupRow) => {
    setEditingId(row.id);
    setType(row.type);
    setName(row.name || "");
    setDescription(row.description || "");
    setFieldErrors({});
    setTouched({ type: false, name: false, description: false });
  };

  const upsertFieldError = (key: keyof FieldErrors, value: string | undefined) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: FieldErrors = {};
    if (!type) nextErrors.type = "Please select a type.";

    const nameError = validateName(name);
    if (nameError) nextErrors.name = nameError;

    const descriptionError = validateDescription(description);
    if (descriptionError) nextErrors.description = descriptionError;

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setTouched({ type: true, name: true, description: true });
      setError("Please fix the highlighted validation errors.");
      return;
    }

    const payload = {
      type,
      name: name.trim(),
      description: description.trim(),
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      if (editingId) {
        await apiMutate(`/api/v1/admissions/admin-setups/${editingId}/`, "PATCH", payload);
        setSuccess("Admin setup updated successfully.");
      } else {
        await apiMutate("/api/v1/admissions/admin-setups/", "POST", payload);
        setSuccess("Admin setup saved successfully.");
      }
      reset();
      await load();
    } catch (error: unknown) {
      setError(getErrorMessage(error, editingId ? "Unable to update admin setup." : "Unable to save admin setup."));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    const ok = window.confirm("Are you sure to delete this admin setup entry?");
    if (!ok) return;
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await apiDelete(`/api/v1/admissions/admin-setups/${id}/`);
      setItems((prev) => prev.filter((row) => row.id !== id));
      setSuccess("Admin setup deleted.");
    } catch (error: unknown) {
      setError(getErrorMessage(error, "Unable to delete admin setup."));
    } finally {
      setBusyId(null);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<AdminSetupRow["type"], AdminSetupRow[]>();
    TYPE_OPTIONS.forEach((opt) => map.set(opt.value, []));
    items.forEach((row) => {
      const current = map.get(row.type) || [];
      current.push(row);
      map.set(row.type, current);
    });
    return map;
  }, [items]);

  const getInputClass = (error?: string, hasValue?: boolean) => {
    if (error) return "input-error";
    if (hasValue) return "input-success";
    return "";
  };

  return (
    <div className="legacy-panel">
      <style>{`
        .white-box {
          background: #ffffff !important;
          border-radius: 14px !important;
          box-shadow: 0 1px 3px rgba(0,0,0,0.04), 0 8px 24px rgba(0,0,0,0.06) !important;
          padding: 24px !important;
          border: 1px solid #eef0f6 !important;
        }
        .white-box h3 {
          color: #2d3250 !important;
          font-size: 1.25rem !important;
          font-weight: 700 !important;
          margin-bottom: 20px !important;
          padding-bottom: 10px !important;
          border-bottom: 2px solid #eef0f6 !important;
          letter-spacing: -0.01em !important;
        }
        .form-group-enhanced { margin-bottom: 20px; position: relative; }
        .form-group-enhanced label {
          display: block;
          font-weight: 600;
          font-size: 0.85rem;
          color: #3b3f5c;
          margin-bottom: 6px;
          letter-spacing: 0.01em;
        }
        .required-star { color: #e8657a; font-weight: 700; margin-left: 2px; }
        .helper-text { display: block; font-size: 0.75rem; color: #9ca3b4; margin-top: 4px; line-height: 1.4; }
        .error-message { display: none; font-size: 0.78rem; color: #d94f5c; margin-top: 4px; font-weight: 500; line-height: 1.3; }
        .error-message.visible { display: block; }
        .form-group-enhanced select,
        .form-group-enhanced input,
        .form-group-enhanced textarea {
          width: 100%;
          padding: 10px 14px;
          border: 1.5px solid #dde0ea;
          border-radius: 8px;
          font-size: 0.9rem;
          color: #3b3f5c;
          background-color: #fafbfd;
          transition: all 0.2s ease;
          outline: none;
          box-sizing: border-box;
          font-family: inherit;
        }
        .form-group-enhanced select:focus,
        .form-group-enhanced input:focus,
        .form-group-enhanced textarea:focus {
          border-color: #7c83db;
          box-shadow: 0 0 0 3px rgba(124, 131, 219, 0.1);
          background-color: #fff;
        }
        .form-group-enhanced .input-error {
          border-color: #e8657a !important;
          box-shadow: 0 0 0 3px rgba(232, 101, 122, 0.08) !important;
          background-color: #fef5f6 !important;
        }
        .form-group-enhanced .input-success {
          border-color: #5ab88d !important;
          box-shadow: 0 0 0 3px rgba(90, 184, 141, 0.08) !important;
          background-color: #f5fcf8 !important;
        }
        .form-group-enhanced select { max-width: 280px; padding: 9px 12px; }
        .form-group-enhanced input[type="text"] { max-width: 400px; }
        .form-group-enhanced textarea { min-height: 72px; max-height: 150px; resize: vertical; }
        .btn-save-enhanced {
          background: linear-gradient(135deg, #6c72cb 0%, #4e54a8 100%) !important;
          color: #fff !important;
          border: none !important;
          padding: 10px 30px !important;
          border-radius: 8px !important;
          font-size: 0.92rem !important;
          font-weight: 600 !important;
          cursor: pointer !important;
          transition: all 0.25s ease !important;
          box-shadow: 0 2px 8px rgba(78, 84, 168, 0.25) !important;
          letter-spacing: 0.02em !important;
        }
        .btn-save-enhanced:hover { box-shadow: 0 4px 14px rgba(78, 84, 168, 0.35) !important; transform: translateY(-1px) !important; }
        .char-counter { font-size: 0.72rem; color: #b0b5c6; text-align: right; margin-top: 3px; }
        .category-accordion {
          border-radius: 10px;
          overflow: hidden;
          margin-bottom: 10px;
          border: 1px solid #eef0f6;
          transition: all 0.3s ease;
          position: relative;
          background: #fff;
        }
        .category-accordion::before {
          content: "";
          position: absolute;
          top: 0;
          left: 0;
          bottom: 0;
          width: 4px;
          border-radius: 10px 0 0 10px;
        }
        .category-accordion[open] { box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06); border-color: #dde0ea; }
        .category-accordion.cat-purpose::before { background: #7c83db; }
        .category-accordion.cat-purpose > summary { color: #4e54a8; }
        .category-accordion.cat-purpose > summary:hover { background: #f4f4fc; }
        .category-accordion.cat-purpose .cat-badge { background: #ededfa; color: #5a5fba; }
        .category-accordion.cat-complaint::before { background: #e8849a; }
        .category-accordion.cat-complaint > summary { color: #a84e60; }
        .category-accordion.cat-complaint > summary:hover { background: #fdf4f6; }
        .category-accordion.cat-complaint .cat-badge { background: #fce8ec; color: #c4566b; }
        .category-accordion.cat-source::before { background: #5ab88d; }
        .category-accordion.cat-source > summary { color: #3a7d5f; }
        .category-accordion.cat-source > summary:hover { background: #f2faf6; }
        .category-accordion.cat-source .cat-badge { background: #e6f6ee; color: #3e8a66; }
        .category-accordion.cat-reference::before { background: #d4a54a; }
        .category-accordion.cat-reference > summary { color: #8b6a24; }
        .category-accordion.cat-reference > summary:hover { background: #fdf8f0; }
        .category-accordion.cat-reference .cat-badge { background: #faf0da; color: #9e7a30; }
        .category-accordion > summary {
          padding: 13px 16px 13px 20px;
          cursor: pointer;
          font-weight: 650;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          list-style: none;
          user-select: none;
          transition: background 0.2s ease;
        }
        .cat-summary-left { display: flex; align-items: center; gap: 10px; }
        .cat-badge { font-size: 0.7rem; padding: 3px 10px; border-radius: 20px; font-weight: 600; }
        .cat-chevron { transition: transform 0.3s ease; opacity: 0.5; }
        .category-accordion[open] .cat-chevron { transform: rotate(180deg); opacity: 0.8; }
        .cat-items-container { padding: 6px 16px 14px 20px; }
        .cat-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 10px 12px;
          margin-bottom: 4px;
          border-radius: 8px;
          background: #fafbfd;
          border: 1px solid transparent;
          transition: all 0.2s ease;
        }
        .cat-item:hover { background: #f5f6fa; border-color: #e8eaf0; }
        .cat-item-info h4 { margin: 0 0 1px; font-size: 0.85rem; font-weight: 600; color: #3b3f5c; }
        .cat-item-info p { margin: 0; font-size: 0.73rem; color: #9ca3b4; }
        .cat-item-actions { display: flex; gap: 5px; }
        .icon-btn {
          width: 32px;
          height: 32px;
          border: none;
          border-radius: 7px;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.2s ease;
        }
        .icon-btn-edit { background: #ededfa; color: #6c72cb; }
        .icon-btn-edit:hover { background: #6c72cb; color: #fff; }
        .icon-btn-delete { background: #fce8ec; color: #d4616f; }
        .icon-btn-delete:hover { background: #d4616f; color: #fff; }
        .cat-empty { text-align: center; padding: 16px; color: #b8bdd0; font-style: italic; font-size: 0.83rem; }
      `}</style>
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Admin Setup</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Admin Section</span>
              <span>/</span>
              <span>Admin Setup</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0">
          <div style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 12 }}>
            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Admin Setup" : "Add Admin Setup"}</h3>
              <form onSubmit={submit} id="admin-setup-form">
                <div className="form-group-enhanced">
                  <label htmlFor="admin-type">Type <span className="required-star">*</span></label>
                  <select
                    id="admin-type"
                    value={type}
                    onChange={(e) => {
                      setType(e.target.value as AdminSetupRow["type"]);
                      if (touched.type || e.target.value) upsertFieldError("type", e.target.value ? undefined : "Please select a type.");
                    }}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, type: true }));
                      upsertFieldError("type", type ? undefined : "Please select a type. This field is required.");
                    }}
                    className={getInputClass(fieldErrors.type, Boolean(type))}
                    aria-describedby="type-helper type-error"
                  >
                    <option value="">-- Select a type --</option>
                    {TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  <span className="helper-text" id="type-helper">Select the category type for this admin setup entry.</span>
                  <span className={`error-message ${fieldErrors.type ? "visible" : ""}`} id="type-error">{fieldErrors.type || ""}</span>
                </div>

                <div className="form-group-enhanced">
                  <label htmlFor="admin-name">Name <span className="required-star">*</span></label>
                  <input
                    id="admin-name"
                    type="text"
                    value={name}
                    maxLength={100}
                    onChange={(e) => {
                      const value = e.target.value;
                      setName(value);
                      if (touched.name || value.length > 0) upsertFieldError("name", validateName(value));
                    }}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, name: true }));
                      upsertFieldError("name", validateName(name));
                    }}
                    className={getInputClass(fieldErrors.name, name.trim().length > 0 && !fieldErrors.name)}
                    aria-describedby="name-helper name-error"
                    autoComplete="off"
                  />
                  <span className="helper-text" id="name-helper">Enter a meaningful name (3-100 characters). Must start with a letter.</span>
                  <span className={`error-message ${fieldErrors.name ? "visible" : ""}`} id="name-error">{fieldErrors.name || ""}</span>
                  <div className="char-counter" id="name-counter">{name.length} / 100</div>
                </div>

                <div className="form-group-enhanced">
                  <label htmlFor="admin-desc">Description</label>
                  <textarea
                    id="admin-desc"
                    value={description}
                    maxLength={500}
                    onChange={(e) => {
                      const value = e.target.value;
                      setDescription(value);
                      if (touched.description || value.length > 0) upsertFieldError("description", validateDescription(value));
                    }}
                    onBlur={() => {
                      setTouched((prev) => ({ ...prev, description: true }));
                      upsertFieldError("description", validateDescription(description));
                    }}
                    className={getInputClass(fieldErrors.description, description.trim().length > 0 && !fieldErrors.description)}
                    aria-describedby="desc-helper desc-error"
                  />
                  <span className="helper-text" id="desc-helper">Optional: Brief description (5-500 chars). Avoid meaningless text.</span>
                  <span className={`error-message ${fieldErrors.description ? "visible" : ""}`} id="desc-error">{fieldErrors.description || ""}</span>
                  <div className="char-counter" id="desc-counter">{description.length} / 500</div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={saving} className="btn-save-enhanced">{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
                  {editingId ? <button type="button" onClick={reset} style={buttonStyle("#6b7280")}>Cancel</button> : null}
                </div>
              </form>
            </div>

            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Admin Setup List</h3>
              <div style={{ display: "grid", gap: 10 }}>
                {TYPE_OPTIONS.map((group) => {
                  const rows = grouped.get(group.value) || [];
                  return (
                    <details key={group.value} className={`category-accordion ${CATEGORY_CLASS[group.value]}`}>
                      <summary>
                        <span className="cat-summary-left">
                          <span>{group.label}</span>
                          <span className="cat-badge">{rows.length} items</span>
                        </span>
                        <span className="cat-chevron">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
                            <polyline points="6 9 12 15 18 9"/>
                          </svg>
                        </span>
                      </summary>
                      <div className="cat-items-container">
                        {rows.length === 0 ? (
                          <div className="cat-empty">No entries yet.</div>
                        ) : (
                          rows.map((row) => (
                            <div key={row.id} className="cat-item">
                              <div className="cat-item-info">
                                <h4>{row.name}</h4>
                                <p>{row.description || "No description"}</p>
                              </div>
                              <div className="cat-item-actions">
                                <button type="button" className="icon-btn icon-btn-edit" onClick={() => edit(row)} title="Edit">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                </button>
                                <button type="button" className="icon-btn icon-btn-delete" disabled={busyId === row.id} onClick={() => void remove(row.id)} title="Delete">
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="15" height="15"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>
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

              {loading && <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading admin setups...</p>}
              {error && <p style={{ marginTop: 10, color: "var(--warning)" }}>{error}</p>}
              {success && <p style={{ marginTop: 10, color: "#0f766e" }}>{success}</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
