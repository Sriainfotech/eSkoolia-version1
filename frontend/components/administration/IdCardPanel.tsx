"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type ApiList<T> = T[] | { results?: T[] };

type IdCardRow = {
  id: number;
  title: string;
  page_layout_style: "horizontal" | "vertical";
  applicable_role_ids: number[];
  background_url?: string;
  profile_url?: string;
  logo_url?: string;
  signature_url?: string;
};

type RoleOption = {
  id: number;
  name: string;
};

type GenerateSetupResponse = {
  roles?: RoleOption[];
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function isMeaningless(str: string): boolean {
  if (!str || str.trim().length < 3) return true;
  const t = str.trim();
  if (/^(.)\1{2,}$/.test(t)) return true;
  if (/^[^a-zA-Z0-9]+$/.test(t)) return true;
  if (t.length >= 4 && /^(.{1,3})\1{2,}$/.test(t)) return true;
  if (t.length >= 3 && !/[aeiouAEIOU]/.test(t)) return true;
  return false;
}

function validateTitleValue(value: string): string {
  const val = value.trim();
  if (!val) return "ID Card title is required.";
  if (val.length < 3) return "Title must be at least 3 characters.";
  if (/^[^a-zA-Z0-9]+$/.test(val)) return "Title cannot contain only special characters.";
  if (isMeaningless(val)) return 'Please enter a meaningful title (e.g. "Student ID Card 2025").';
  return "";
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

async function apiForm<T>(path: string, method: "POST" | "PATCH", formData: FormData): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method,
    body: formData,
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

function compactFieldStyle() {
  return {
    width: "100%",
    height: 36,
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "0 10px",
  } as const;
}

export function IdCardPanel() {
  const [items, setItems] = useState<IdCardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [titleError, setTitleError] = useState("");
  const [search, setSearch] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [title, setTitle] = useState("");
  const [layout, setLayout] = useState<"horizontal" | "vertical">("horizontal");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [applyToAllRoles, setApplyToAllRoles] = useState(false);
  const [roles, setRoles] = useState<RoleOption[]>([]);
  const [rolesDropdownOpen, setRolesDropdownOpen] = useState(false);

  const [backgroundUpload, setBackgroundUpload] = useState<File | null>(null);
  const [profileUpload, setProfileUpload] = useState<File | null>(null);
  const [logoUpload, setLogoUpload] = useState<File | null>(null);
  const [signatureUpload, setSignatureUpload] = useState<File | null>(null);

  const [backgroundUrl, setBackgroundUrl] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [signatureUrl, setSignatureUrl] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const templateData = await apiGet<ApiList<IdCardRow>>("/api/v1/admissions/id-card-templates/");
      setItems(listData(templateData));

      let loadedRoles: RoleOption[] = [];
      try {
        const roleData = await apiGet<ApiList<RoleOption>>("/api/v1/access-control/roles/");
        loadedRoles = listData(roleData);
      } catch {
        loadedRoles = [];
      }

      if (loadedRoles.length === 0) {
        try {
          const generateSetup = await apiGet<GenerateSetupResponse>("/api/v1/admissions/id-card-templates/generate-setup/");
          loadedRoles = generateSetup.roles || [];
        } catch {
          loadedRoles = [];
        }
      }

      setRoles(loadedRoles);
    } catch {
      setError("Unable to load ID cards.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const reset = () => {
    setEditingId(null);
    setTitle("");
    setLayout("horizontal");
    setSelectedRoleIds([]);
    setApplyToAllRoles(false);
    setBackgroundUpload(null);
    setProfileUpload(null);
    setLogoUpload(null);
    setSignatureUpload(null);
    setBackgroundUrl("");
    setProfileUrl("");
    setLogoUrl("");
    setSignatureUrl("");
    setRolesDropdownOpen(false);
    setFieldErrors({});
    setTitleError("");
  };

  const edit = (row: IdCardRow) => {
    setEditingId(row.id);
    setTitle(row.title || "");
    setLayout((row.page_layout_style || "horizontal") as "horizontal" | "vertical");
    setSelectedRoleIds((row.applicable_role_ids || []).map((value) => String(value)));
    setApplyToAllRoles(!(row.applicable_role_ids || []).length);
    setBackgroundUpload(null);
    setProfileUpload(null);
    setLogoUpload(null);
    setSignatureUpload(null);
    setBackgroundUrl(row.background_url || "");
    setProfileUrl(row.profile_url || "");
    setLogoUrl(row.logo_url || "");
    setSignatureUrl(row.signature_url || "");
    setRolesDropdownOpen(false);
    setFieldErrors({});
    setTitleError("");
  };

  const parseRoleIds = () => {
    if (applyToAllRoles) return [];
    return selectedRoleIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0);
  };

  const roleNameById = useMemo(() => {
    return new Map(roles.map((role) => [role.id, role.name]));
  }, [roles]);

  const selectedRoleNames = useMemo(() => {
    if (applyToAllRoles) return [];
    return selectedRoleIds
      .map((id) => roles.find((role) => String(role.id) === id)?.name)
      .filter((name): name is string => Boolean(name));
  }, [applyToAllRoles, roles, selectedRoleIds]);

  const rolesDisplayText = useMemo(() => {
    if (applyToAllRoles) return "All roles";
    if (selectedRoleNames.length === 0) return "Select applicable roles";
    if (selectedRoleNames.length === 1) return selectedRoleNames[0];
    return `${selectedRoleNames[0]} + ${selectedRoleNames.length - 1} more`;
  }, [applyToAllRoles, selectedRoleNames]);

  const validateTitle = (value: string) => {
    const err = validateTitleValue(value);
    setTitleError(err);
    return !err;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const isValidTitle = validateTitle(title);
    if (!isValidTitle) {
      setFieldErrors({ title: titleError || "Invalid title." });
      setError("Please fix title validation errors.");
      return;
    }

    const formData = new FormData();
    formData.append("title", title.trim());
    formData.append("page_layout_style", layout);
    formData.append("applicable_role_ids", JSON.stringify(parseRoleIds()));

    if (backgroundUpload) formData.append("background_upload", backgroundUpload);
    if (profileUpload) formData.append("profile_upload", profileUpload);
    if (logoUpload) formData.append("logo_upload", logoUpload);
    if (signatureUpload) formData.append("signature_upload", signatureUpload);

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      setTitleError("");
      if (editingId) {
        await apiForm(`/api/v1/admissions/id-card-templates/${editingId}/`, "PATCH", formData);
        setSuccess("ID card updated successfully.");
      } else {
        await apiForm("/api/v1/admissions/id-card-templates/", "POST", formData);
        setSuccess("ID card saved successfully.");
      }
      reset();
      await load();
    } catch {
      setError(editingId ? "Unable to update ID card." : "Unable to save ID card.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    const ok = window.confirm("Are you sure to delete this ID card template?");
    if (!ok) return;
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await apiDelete(`/api/v1/admissions/id-card-templates/${id}/`);
      setItems((prev) => prev.filter((row) => row.id !== id));
      setSuccess("ID card deleted.");
    } catch {
      setError("Unable to delete ID card.");
    } finally {
      setBusyId(null);
    }
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((row) => [row.title, row.page_layout_style, (row.applicable_role_ids || []).join(",")].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  return (
    <div className="legacy-panel">
      <style>{`
        .idcard-form-title {
          font-size: 20px;
          font-weight: 700;
          color: #1a2b4a;
          margin-bottom: 20px;
          padding-bottom: 12px;
          border-bottom: 2px solid #4c6ef5;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .idcard-form-title .title-icon {
          width: 32px;
          height: 32px;
          background: linear-gradient(135deg, #4c6ef5, #7c3aed);
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 16px;
        }
        .idcard-form {
          display: flex;
          flex-direction: column;
          gap: 18px;
          width: 100%;
        }
        .idcard-form .form-group {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .idcard-form label.field-label {
          font-size: 13px;
          font-weight: 600;
          color: #374151;
          margin-bottom: 2px;
          display: block;
        }
        .idcard-form label.field-label .required-star {
          color: #ef4444;
          margin-left: 2px;
        }
        .idcard-form input.field-input,
        .idcard-form select.field-input {
          width: 100%;
          height: 42px;
          border: 1.5px solid #d1d5db;
          border-radius: 8px;
          padding: 0 14px;
          font-size: 14px;
          color: #1f2937;
          background: #fff;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .idcard-form select.field-input-multi {
          width: 100%;
          min-height: 110px;
          border: 1.5px solid #d1d5db;
          border-radius: 8px;
          padding: 8px;
          font-size: 14px;
          color: #1f2937;
          background: #fff;
          transition: border-color 0.2s, box-shadow 0.2s;
          box-sizing: border-box;
        }
        .idcard-form .role-dropdown {
          position: relative;
        }
        .idcard-form .role-dropdown-trigger {
          width: 100%;
          min-height: 44px;
          border: 1.5px solid #d1d5db;
          border-radius: 10px;
          background: #fff;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
          box-sizing: border-box;
        }
        .idcard-form .role-dropdown-trigger:hover {
          border-color: #4c6ef5;
          background: #fbfcff;
        }
        .idcard-form .role-dropdown-trigger.open {
          border-color: #4c6ef5;
          box-shadow: 0 0 0 3px rgba(76,110,245,0.12);
        }
        .idcard-form .role-dropdown-title {
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 2px;
          min-width: 0;
        }
        .idcard-form .role-dropdown-title strong {
          font-size: 13px;
          color: #111827;
          font-weight: 600;
        }
        .idcard-form .role-dropdown-title span {
          font-size: 12px;
          color: #6b7280;
        }
        .idcard-form .role-dropdown-panel {
          position: absolute;
          z-index: 20;
          top: calc(100% + 8px);
          left: 0;
          right: 0;
          background: #fff;
          border: 1px solid #dbe2ea;
          border-radius: 12px;
          box-shadow: 0 18px 40px rgba(15, 23, 42, 0.12);
          padding: 8px;
          max-height: 260px;
          overflow: auto;
        }
        .idcard-form .role-dropdown-search {
          width: 100%;
          height: 36px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          padding: 0 10px;
          margin-bottom: 8px;
          font-size: 13px;
          box-sizing: border-box;
        }
        .idcard-form .role-option {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          cursor: pointer;
          transition: background 0.2s ease;
          font-size: 13px;
          color: #374151;
        }
        .idcard-form .role-option span {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .idcard-form .role-option span small {
          color: #6b7280;
          font-size: 11px;
          line-height: 1.3;
        }
        .idcard-form .role-option:hover {
          background: #f8fbff;
        }
        .idcard-form .role-option input {
          width: 16px;
          height: 16px;
          margin: 0;
          accent-color: #4c6ef5;
          flex-shrink: 0;
        }
        .idcard-form .role-option.selected {
          background: #eef4ff;
          color: #1d4ed8;
        }
        .idcard-form .role-option-all {
          border-bottom: 1px solid #e5e7eb;
          margin-bottom: 4px;
          padding-bottom: 12px;
        }
        .idcard-form .role-selected-summary {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          margin-top: 4px;
        }
        .idcard-form .role-selected-badge {
          display: inline-flex;
          align-items: center;
          padding: 5px 10px;
          border-radius: 999px;
          background: #edf2ff;
          border: 1px solid #c7d2fe;
          color: #3730a3;
          font-size: 12px;
          font-weight: 600;
        }
        .idcard-form input.field-input:focus,
        .idcard-form select.field-input:focus,
        .idcard-form select.field-input-multi:focus {
          outline: none;
          border-color: #4c6ef5;
          box-shadow: 0 0 0 3px rgba(76,110,245,0.15);
        }
        .idcard-form .input-error {
          border-color: #ef4444 !important;
          box-shadow: 0 0 0 3px rgba(239,68,68,0.1) !important;
        }
        .idcard-form .input-success {
          border-color: #22c55e !important;
        }
        .idcard-form .helper-text {
          font-size: 11.5px;
          color: #6b7280;
          margin-top: 2px;
          line-height: 1.3;
        }
        .idcard-form .error-msg {
          font-size: 12px;
          color: #ef4444;
          margin-top: 3px;
          display: none;
          align-items: center;
          gap: 4px;
          line-height: 1.3;
        }
        .idcard-form .error-msg.visible {
          display: flex;
        }
        .idcard-form .file-upload-area {
          position: relative;
          border: 2px dashed #d1d5db;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          background: #f9fafb;
          transition: border-color 0.2s;
          cursor: pointer;
        }
        .idcard-form .file-upload-area:hover {
          border-color: #4c6ef5;
          background: #f0f4ff;
        }
        .idcard-form .file-upload-area input[type="file"] {
          position: absolute;
          inset: 0;
          opacity: 0;
          cursor: pointer;
          width: 100%;
          height: 100%;
        }
        .idcard-form .file-upload-label {
          font-size: 13px;
          color: #6b7280;
        }
        .idcard-form .file-upload-label strong {
          color: #4c6ef5;
        }
        .roles-empty-notice {
          padding: 12px;
          background: #fef3c7;
          border: 1px solid #fbbf24;
          border-radius: 8px;
          font-size: 13px;
          color: #92400e;
        }
        .role-badge {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          padding: 5px 9px;
          margin: 2px 4px 2px 0;
          border-radius: 999px;
          background: #edf2ff;
          color: #1d4ed8;
          border: 1px solid #c7d2fe;
          font-size: 11px;
          font-weight: 600;
          line-height: 1;
        }
        .role-badge.role-badge-muted {
          background: #f3f4f6;
          color: #6b7280;
          border-color: #e5e7eb;
        }
        .idcard-form .form-actions {
          display: flex;
          gap: 10px;
          justify-content: flex-start;
          margin-top: 8px;
        }
        .idcard-form .btn-submit {
          padding: 10px 28px;
          background: linear-gradient(135deg, #4c6ef5, #3b5bdb);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          box-shadow: 0 2px 8px rgba(76,110,245,0.3);
          height: 42px;
        }
        .idcard-form .btn-cancel {
          padding: 10px 22px;
          background: #fff;
          color: #6b7280;
          border: 1.5px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          height: 42px;
        }
        .idcard-form .btn-cancel:hover {
          background: #f3f4f6;
          border-color: #9ca3af;
        }
      `}</style>
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>ID Card</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Admin Section</span>
              <span>/</span>
              <span>ID Card</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0">
          <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 12 }}>
            <div className="white-box" style={boxStyle()}>
              <div className="idcard-form-title">
                <span className="title-icon">ID</span>
                {editingId ? "Edit ID Card" : "Create ID Card"}
              </div>

              <form className="idcard-form" noValidate onSubmit={submit}>
                <div className="form-group">
                  <label className="field-label" htmlFor="idcardTitle">ID Card Title <span className="required-star">*</span></label>
                  <input
                    type="text"
                    id="idcardTitle"
                    name="title"
                    required
                    minLength={3}
                    maxLength={100}
                    aria-describedby="titleHelper titleError"
                    value={title}
                    onChange={(e) => {
                      const value = e.target.value;
                      setTitle(value);
                      setFieldErrors((prev) => ({ ...prev, title: "" }));
                      setTitleError(validateTitleValue(value));
                    }}
                    onBlur={() => {
                      setTitleError(validateTitleValue(title));
                    }}
                    placeholder="e.g. Student ID Card 2025"
                    className={`field-input ${titleError ? "input-error" : title.trim() ? "input-success" : ""}`}
                  />
                  <span className="helper-text" id="titleHelper">
                    Enter a meaningful title (3-100 characters, letters, numbers and spaces).
                    <br />
                    <strong style={{ color: "#374151" }}>Example:</strong> Teacher ID Card, Student ID Card, etc.
                  </span>
                  <span className={`error-msg ${titleError ? "visible" : ""}`} id="titleError" role="alert">
                    <span>{titleError}</span>
                  </span>
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="idcardLayout">Layout <span className="required-star">*</span></label>
                  <select
                    id="idcardLayout"
                    name="layout"
                    required
                    aria-describedby="layoutHelper"
                    className="field-input"
                    value={layout}
                    onChange={(e) => setLayout(e.target.value as "horizontal" | "vertical")}
                  >
                    <option value="horizontal">Horizontal</option>
                    <option value="vertical">Vertical</option>
                  </select>
                  <span className="helper-text" id="layoutHelper">Choose the card orientation: Horizontal (landscape) or Vertical (portrait).</span>
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="idcardRoles">Applicable Roles</label>
                  {roles.length === 0 ? (
                    <div className="roles-empty-notice">Warning: No roles available. Please configure roles in the system settings first.</div>
                  ) : (
                    <div className="role-dropdown">
                      <button
                        type="button"
                        className={`role-dropdown-trigger ${rolesDropdownOpen ? "open" : ""}`}
                        onClick={() => setRolesDropdownOpen((prev) => !prev)}
                        aria-haspopup="listbox"
                        aria-expanded={rolesDropdownOpen}
                        aria-describedby="rolesHelper"
                      >
                        <span className="role-dropdown-title">
                          <strong>{rolesDisplayText}</strong>
                          <span>{applyToAllRoles ? "Applies to every role" : `${selectedRoleIds.length} selected`}</span>
                        </span>
                        <span style={{ color: "#6b7280", fontSize: 14 }}>{rolesDropdownOpen ? "▴" : "▾"}</span>
                      </button>
                      {rolesDropdownOpen && (
                        <div className="role-dropdown-panel" role="listbox" aria-multiselectable="true">
                          <label className={`role-option role-option-all ${applyToAllRoles ? "selected" : ""}`}>
                            <input
                              type="checkbox"
                              checked={applyToAllRoles}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setApplyToAllRoles(checked);
                                if (checked) {
                                  setSelectedRoleIds([]);
                                }
                              }}
                            />
                            <span>
                              <strong>All roles</strong>
                              <small>Use this template for every role in the school</small>
                            </span>
                          </label>
                          {roles.map((role) => {
                            const isSelected = selectedRoleIds.includes(String(role.id));
                            return (
                              <label key={role.id} className={`role-option ${isSelected ? "selected" : ""}`}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => {
                                    const checked = e.target.checked;
                                    setApplyToAllRoles(false);
                                    setSelectedRoleIds((prev) => {
                                      const roleId = String(role.id);
                                      if (checked) {
                                        return prev.includes(roleId) ? prev : [...prev, roleId];
                                      }
                                      return prev.filter((value) => value !== roleId);
                                    });
                                  }}
                                />
                                <span>{role.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}
                      {selectedRoleNames.length > 0 ? (
                        <div className="role-selected-summary" aria-label="Selected roles">
                          {selectedRoleNames.map((roleName) => (
                            <span key={roleName} className="role-selected-badge">{roleName}</span>
                          ))}
                        </div>
                      ) : applyToAllRoles ? (
                        <div className="role-selected-summary" aria-label="Selected roles">
                          <span className="role-selected-badge">All roles</span>
                        </div>
                      ) : null}
                    </div>
                  )}
                  <span className="helper-text" id="rolesHelper">Pick specific roles or choose All roles to apply this ID card to everyone.</span>
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="bgFront">Background Image (Front)</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="bgFront"
                      name="backgroundFront"
                      accept="image/png,image/jpeg,image/jpg"
                      aria-describedby="bgFrontHelper"
                      onChange={(e) => setBackgroundUpload(e.target.files?.[0] || null)}
                    />
                    <div className="file-upload-label"><strong>Click to upload</strong> or drag and drop<br />PNG, JPG (max 2MB)</div>
                  </div>
                  <span className="helper-text" id="bgFrontHelper">Upload the front background image for the ID card (recommended: 1000x600px for horizontal).</span>
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="bgBack">Background Image (Back)</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="bgBack"
                      name="backgroundBack"
                      accept="image/png,image/jpeg,image/jpg"
                      aria-describedby="bgBackHelper"
                      onChange={(e) => setProfileUpload(e.target.files?.[0] || null)}
                    />
                    <div className="file-upload-label"><strong>Click to upload</strong> or drag and drop<br />PNG, JPG (max 2MB)</div>
                  </div>
                  <span className="helper-text" id="bgBackHelper">Upload the back background image for the ID card.</span>
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="idcardLogo">School Logo</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="idcardLogo"
                      name="logo"
                      accept="image/png,image/jpeg,image/jpg,image/svg+xml"
                      aria-describedby="logoHelper"
                      onChange={(e) => setLogoUpload(e.target.files?.[0] || null)}
                    />
                    <div className="file-upload-label"><strong>Click to upload</strong> or drag and drop<br />PNG, JPG, SVG (max 1MB)</div>
                  </div>
                  <span className="helper-text" id="logoHelper">Upload the school logo to display on the ID card.</span>
                </div>

                <div className="form-group">
                  <label className="field-label" htmlFor="idcardSignature">Signature Image</label>
                  <div className="file-upload-area">
                    <input
                      type="file"
                      id="idcardSignature"
                      name="signature"
                      accept="image/png,image/jpeg,image/jpg"
                      aria-describedby="sigHelper"
                      onChange={(e) => setSignatureUpload(e.target.files?.[0] || null)}
                    />
                    <div className="file-upload-label"><strong>Click to upload</strong> or drag and drop<br />PNG, JPG (max 1MB)</div>
                  </div>
                  <span className="helper-text" id="sigHelper">Upload the authorized signature image for the ID card.</span>
                </div>

                <div style={{ fontSize: 12, color: "var(--text-muted)", display: "grid", gap: 4 }}>
                  {backgroundUrl ? <a href={backgroundUrl} target="_blank" rel="noreferrer">Background file</a> : null}
                  {profileUrl ? <a href={profileUrl} target="_blank" rel="noreferrer">Profile image</a> : null}
                  {logoUrl ? <a href={logoUrl} target="_blank" rel="noreferrer">Logo</a> : null}
                  {signatureUrl ? <a href={signatureUrl} target="_blank" rel="noreferrer">Signature</a> : null}
                </div>

                <div className="form-actions">
                  <button type="submit" disabled={saving} className="btn-submit">{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
                  {editingId ? <button type="button" onClick={reset} className="btn-cancel">Cancel</button> : null}
                </div>
              </form>
            </div>

            <div className="white-box" style={boxStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8 }}>
                <h3 style={{ margin: 0 }}>ID Card List</h3>
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Quick search" style={{ ...compactFieldStyle(), maxWidth: 240 }} />
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Title</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Layout</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Roles</th>
                      <th style={{ padding: 8, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!loading && filtered.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: 12, color: "var(--text-muted)" }}>No ID cards found.</td></tr>
                    ) : (
                      filtered.map((row) => (
                        <tr key={row.id}>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.title}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.page_layout_style}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            {(row.applicable_role_ids || []).length > 0 ? (
                              (row.applicable_role_ids || []).map((id) => (
                                <span key={id} className="role-badge">
                                  {roleNameById.get(id) || `Role ${id}`}
                                </span>
                              ))
                            ) : (
                              <span className="role-badge role-badge-muted">All Roles</span>
                            )}
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button type="button" onClick={() => edit(row)} style={buttonStyle("#0ea5e9")}>Edit</button>
                              <button type="button" disabled={busyId === row.id} onClick={() => void remove(row.id)} style={buttonStyle("#dc2626")}>Delete</button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {loading && <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading ID cards...</p>}
              {error && <p style={{ marginTop: 10, color: "var(--warning)" }}>{error}</p>}
              {success && <p style={{ marginTop: 10, color: "#0f766e" }}>{success}</p>}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
