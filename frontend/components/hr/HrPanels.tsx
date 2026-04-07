"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type ApiList<T> = T[] | { results?: T[]; data?: T[] };

function listData<T>(value: ApiList<T>): T[] {
  if (Array.isArray(value)) {
    return value;
  }

  const payload = value as unknown as { data?: unknown; results?: unknown };
  if (Array.isArray(payload.data)) {
    return payload.data as T[];
  }
  if (payload.data && typeof payload.data === "object") {
    const nested = payload.data as { data?: unknown; results?: unknown };
    if (Array.isArray(nested.data)) {
      return nested.data as T[];
    }
    if (Array.isArray(nested.results)) {
      return nested.results as T[];
    }
  }
  if (Array.isArray(payload.results)) {
    return payload.results as T[];
  }

  return [];
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, { method: "DELETE", headers: { "Content-Type": "application/json" } });
}

async function fetchAllPages<T>(path: string): Promise<T[]> {
  const merged: T[] = [];
  let nextPath = path;

  for (let i = 0; i < 80 && nextPath; i += 1) {
    const data = await apiGet<ApiList<T> & { next?: string | null }>(nextPath);
    merged.push(...listData<T>(data));

    const nextRaw = (data as { next?: string | null }).next;
    if (!nextRaw) {
      nextPath = "";
      continue;
    }

    if (nextRaw.startsWith("http")) {
      try {
        const nextUrl = new URL(nextRaw);
        nextPath = `${nextUrl.pathname}${nextUrl.search}`;
      } catch {
        nextPath = "";
      }
    } else {
      nextPath = nextRaw;
    }
  }

  return merged;
}

function fieldStyle() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" } as const;
}

function buttonStyle(color = "var(--primary)") {
  return { height: 34, border: `1px solid ${color}`, background: color, color: "#fff", borderRadius: 8, padding: "0 10px", cursor: "pointer" } as const;
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function breadcrumb(title: string) {
  return (
    <section className="sms-breadcrumb mb-20">
      <div className="container-fluid">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
          <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
            <span>Dashboard</span>
            <span>/</span>
            <span>Human Resource</span>
            <span>/</span>
            <span>{title}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

type Department = {
  id: number;
  name: string;
  description: string;
  is_active: boolean;
};

type Designation = {
  id: number;
  department: number;
  name: string;
  is_active: boolean;
};

type Staff = {
  id: number;
  role: number | null;
  staff_no: string;
  first_name: string;
  last_name: string;
  fathers_name: string;
  mothers_name: string;
  date_of_birth: string | null;
  gender: "male" | "female" | "other" | "";
  marital_status: "single" | "married" | "";
  email: string;
  phone: string;
  emergency_mobile: string;
  driving_license: string;
  staff_photo: string;
  current_address: string;
  permanent_address: string;
  qualification: string;
  experience: string;
  epf_no: string;
  bank_account_name: string;
  bank_account_no: string;
  bank_name: string;
  bank_branch: string;
  bank_mobile_no: string;
  contract_type: "permanent" | "contract" | "";
  location: string;
  facebook_url: string;
  twitter_url: string;
  linkedin_url: string;
  instagram_url: string;
  resume: string;
  joining_letter: string;
  tenth_certificate: string;
  eleventh_certificate: string;
  aadhar_card: string;
  driving_license_doc: string;
  other_document: string;
  casual_leave: number;
  medical_leave: number;
  maternity_leave: number;
  show_public: boolean;
  department: number | null;
  designation: number | null;
  join_date: string;
  basic_salary: string;
  status: "active" | "inactive" | "terminated";
};

type Student = {
  id: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  current_class?: number | null;
  current_section?: number | null;
};

type SchoolClassOption = {
  id: number;
  name: string;
};

type SectionOption = {
  id: number;
  name: string;
  school_class?: number | null;
};

type LeaveType = {
  id: number;
  name: string;
  max_days_per_year: number;
  is_paid: boolean;
  is_active: boolean;
};

type Role = {
  id: number;
  name: string;
};

type LeaveDefine = {
  id: number;
  role: number | null;
  role_name: string;
  staff: number | null;
  staff_name: string;
  student: number | null;
  student_name: string;
  school_class: number | null;
  class_name: string;
  section: number | null;
  section_name: string;
  leave_type: number;
  leave_type_name: string;
  days: number;
};

type LeaveRequest = {
  id: number;
  staff: number;
  leave_type: number;
  from_date: string;
  to_date: string;
  created_at: string;
  reason: string;
  attachment: string; // This line is unchanged, but included for context
  approval_note: string;
  status: "pending" | "approved" | "rejected";
};
type MePayload = {
  is_superuser: boolean;
  is_school_admin: boolean;
  permission_codes: string[];
};

type StaffAttendance = {
  id: number;
  staff: number;
  staff_name: string;
  attendance_date: string;
  attendance_type: "P" | "A" | "L" | "F" | "H";
  note: string;
};

type AttendanceReport = {
  total: number;
  by_type: Record<string, number>;
};

type PayrollRecord = {
  id: number;
  staff: number;
  payroll_month: number;
  payroll_year: number;
  basic_salary: string;
  allowance: string;
  deduction: string;
  net_salary: string;
  status: "draft" | "processed" | "paid";
  paid_at: string | null;
};

type PayrollSummary = {
  total_records: number;
  total_basic_salary: string;
  total_allowance: string;
  total_deduction: string;
  total_net_salary: string;
};

export function HrDepartmentsPanel() {
  const [rows, setRows] = useState<Department[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; description?: string }>({});
  const formBoxRef = useRef<HTMLDivElement | null>(null);

  const filteredRows = useMemo(() => {
    if (statusFilter === "all") return rows;
    if (statusFilter === "active") return rows.filter((item) => item.is_active);
    return rows.filter((item) => !item.is_active);
  }, [rows, statusFilter]);

  const validateName = (raw: string): string | null => {
    const value = raw.trim();
    if (!value) return "Department name is required.";
    if (value.length < 3 || value.length > 50) return "Department name length must be between 3 and 50 characters.";
    if (!/^[A-Za-z ]+$/.test(value)) return "Department name can contain only letters and spaces.";
    return null;
  };

  const validateDescription = (raw: string): string | null => {
    if (raw.trim().length > 255) return "Description must not exceed 255 characters.";
    return null;
  };

  const applyServerError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("department name") || lower.includes("name")) {
      setFieldErrors((prev) => ({ ...prev, name: message }));
      return;
    }
    if (lower.includes("description")) {
      setFieldErrors((prev) => ({ ...prev, description: message }));
      return;
    }
    setError(message);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<ApiList<Department>>("/api/v1/hr/departments/");
      setRows(listData(data));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load departments.";
      setError(message || "Unable to load departments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setToast("");
    setFieldErrors({});

    const nameError = validateName(name);
    const descError = validateDescription(description);
    if (nameError || descError) {
      setFieldErrors({ name: nameError || undefined, description: descError || undefined });
      setError("Please fix the highlighted fields.");
      return;
    }

    try {
      setSaving(true);
      const payload = { name: name.trim(), description: description.trim(), is_active: isActive };
      if (editingId) {
        await apiPatch(`/api/v1/hr/departments/${editingId}/`, payload);
        setToast("Department updated successfully.");
      } else {
        await apiPost("/api/v1/hr/departments/", payload);
        setToast("Department created successfully.");
      }
      setEditingId(null);
      setName("");
      setDescription("");
      setIsActive(true);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save department.";
      applyServerError(message || "Unable to save department.");
    } finally {
      setSaving(false);
    }
  };

  const removeDepartment = async (id: number) => {
    try {
      setError("");
      setToast("");
      setDeletingId(id);
      await apiDelete(`/api/v1/hr/departments/${id}/`);
      setToast("Department deleted successfully.");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete department.";
      setError(message || "Unable to delete department.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Departments")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div ref={formBoxRef} className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Department" : "Add Department"}</h3>
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8 }}>
            <div>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Department name *"
                style={{ ...fieldStyle(), borderColor: fieldErrors.name ? "#dc2626" : "var(--line)" }}
              />
              {fieldErrors.name ? <p style={{ color: "#dc2626", marginTop: 4, marginBottom: 0, fontSize: 12 }}>{fieldErrors.name}</p> : null}
            </div>
            <div>
              <input
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  if (fieldErrors.description) setFieldErrors((prev) => ({ ...prev, description: undefined }));
                }}
                placeholder="Description"
                style={{ ...fieldStyle(), borderColor: fieldErrors.description ? "#dc2626" : "var(--line)" }}
              />
              {fieldErrors.description ? <p style={{ color: "#dc2626", marginTop: 4, marginBottom: 0, fontSize: 12 }}>{fieldErrors.description}</p> : null}
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
              <p style={{ marginTop: 4, marginBottom: 0, fontSize: 12, color: "var(--text-muted)" }}>
                Active departments are available for new assignments; inactive departments stay in history only.
              </p>
            </div>
            <button type="submit" style={buttonStyle()} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
          </form>
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h4 style={{ margin: 0 }}>Department List</h4>
            <div style={{ display: "grid", gap: 4 }}>
              <label htmlFor="department-status-filter" style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Status Filter
              </label>
              <select
                id="department-status-filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                style={{ ...fieldStyle(), height: 34, minWidth: 170 }}
              >
                <option value="all">All</option>
                <option value="active">Active only</option>
                <option value="inactive">Inactive only</option>
              </select>
            </div>
          </div>
          {loading ? <p style={{ marginTop: 0, marginBottom: 10, color: "var(--text-muted)" }}>Loading departments...</p> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Description</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.description || "-"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 10px",
                        borderRadius: 999,
                        fontSize: 12,
                        fontWeight: 600,
                        color: row.is_active ? "#166534" : "#991b1b",
                        background: row.is_active ? "#dcfce7" : "#fee2e2",
                        border: `1px solid ${row.is_active ? "#86efac" : "#fca5a5"}`,
                      }}
                    >
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        title="Edit department"
                        aria-label="Edit department"
                        style={{ ...buttonStyle("#0ea5e9"), width: 34, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        onClick={() => {
                          setEditingId(row.id);
                          setName(row.name);
                          setDescription(row.description || "");
                          setIsActive(row.is_active);
                          formBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M12 20h9" />
                          <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                      <button
                        type="button"
                        title="Delete department"
                        aria-label="Delete department"
                        style={{ ...buttonStyle("#dc2626"), width: 34, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                        disabled={deletingId === row.id}
                        onClick={() => void removeDepartment(row.id)}
                      >
                        {deletingId === row.id ? "..." : (
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M3 6h18" />
                            <path d="M8 6V4h8v2" />
                            <path d="M19 6l-1 14H6L5 6" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--line)" }}>
                    No departments found for selected filter.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div></section>
    </div>
  );
}

export function HrDesignationsPanel() {
  const [rows, setRows] = useState<Designation[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [departmentId, setDepartmentId] = useState("");
  const [name, setName] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ department?: string; name?: string }>({});
  const formBoxRef = useRef<HTMLDivElement | null>(null);

  const sortedRows = useMemo(() => {
    const departmentName = (id: number) => (departments.find((item) => item.id === id)?.name || "").toLowerCase();
    return [...rows].sort((a, b) => {
      const deptCompare = departmentName(a.department).localeCompare(departmentName(b.department));
      if (deptCompare !== 0) return deptCompare;
      return a.name.localeCompare(b.name);
    });
  }, [rows, departments]);

  const filteredRows = useMemo(() => {
    return sortedRows.filter((row) => {
      if (statusFilter === "active" && !row.is_active) return false;
      if (statusFilter === "inactive" && row.is_active) return false;
      if (departmentFilter !== "all" && String(row.department) !== departmentFilter) return false;
      return true;
    });
  }, [sortedRows, statusFilter, departmentFilter]);

  const validateDepartment = (value: string): string | null => {
    if (!value) return "Department is required.";
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return "Please select a valid department.";
    if (!departments.some((item) => item.id === id)) return "Please select a valid department from the list.";
    return null;
  };

  const validateName = (raw: string): string | null => {
    const value = raw.trim();
    if (!value) return "Designation name is required.";
    if (value.length < 3 || value.length > 50) return "Designation name length must be between 3 and 50 characters.";
    if (!/^[A-Za-z ]+$/.test(value)) return "Designation name can contain only letters and spaces.";
    return null;
  };

  const applyServerError = (message: string) => {
    const lower = message.toLowerCase();
    if (lower.includes("department")) {
      setFieldErrors((prev) => ({ ...prev, department: message }));
      return;
    }
    if (lower.includes("designation") || lower.includes("name")) {
      setFieldErrors((prev) => ({ ...prev, name: message }));
      return;
    }
    setError(message);
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [designationData, departmentData] = await Promise.all([
        apiGet<ApiList<Designation>>("/api/v1/hr/designations/"),
        apiGet<ApiList<Department>>("/api/v1/hr/departments/?is_active=true"),
      ]);
      setRows(listData(designationData));
      setDepartments(listData(departmentData));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load designations.";
      setError(message || "Unable to load designations.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    setError("");
    setToast("");
    setFieldErrors({});

    const departmentError = validateDepartment(departmentId);
    const nameError = validateName(name);
    if (departmentError || nameError) {
      setFieldErrors({ department: departmentError || undefined, name: nameError || undefined });
      setError("Please fix the highlighted fields.");
      return;
    }

    try {
      setSaving(true);
      const payload = { department: Number(departmentId), name: name.trim(), is_active: isActive };
      if (editingId) {
        await apiPatch(`/api/v1/hr/designations/${editingId}/`, payload);
        setToast("Designation updated successfully.");
      } else {
        await apiPost("/api/v1/hr/designations/", payload);
        setToast("Designation created successfully.");
      }
      setEditingId(null);
      setDepartmentId("");
      setName("");
      setIsActive(true);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save designation.";
      applyServerError(message || "Unable to save designation.");
    } finally {
      setSaving(false);
    }
  };

  const removeDesignation = async (id: number) => {
    try {
      setError("");
      setToast("");
      setDeletingId(id);
      await apiDelete(`/api/v1/hr/designations/${id}/`);
      setToast("Designation deleted successfully.");
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to delete designation.";
      setError(message || "Unable to delete designation.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Designations")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div ref={formBoxRef} className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Designation" : "Add Designation"}</h3>
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto auto", gap: 8 }}>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Department *
              </label>
              <select
                value={departmentId}
                onChange={(e) => {
                  setDepartmentId(e.target.value);
                  if (fieldErrors.department) setFieldErrors((prev) => ({ ...prev, department: undefined }));
                }}
                style={{ ...fieldStyle(), borderColor: fieldErrors.department ? "#dc2626" : "var(--line)" }}
              >
                <option value="">Department</option>
                {departments.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              {fieldErrors.department ? <p style={{ color: "#dc2626", marginTop: 4, marginBottom: 0, fontSize: 12 }}>{fieldErrors.department}</p> : null}
            </div>
            <div>
              <label style={{ display: "block", marginBottom: 4, fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                Designation *
              </label>
              <input
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (fieldErrors.name) setFieldErrors((prev) => ({ ...prev, name: undefined }));
                }}
                placeholder="Designation name *"
                style={{ ...fieldStyle(), borderColor: fieldErrors.name ? "#dc2626" : "var(--line)" }}
              />
              {fieldErrors.name ? <p style={{ color: "#dc2626", marginTop: 4, marginBottom: 0, fontSize: 12 }}>{fieldErrors.name}</p> : null}
            </div>
            <div>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Active</label>
              <p style={{ marginTop: 4, marginBottom: 0, fontSize: 12, color: "var(--text-muted)" }}>
                Active designations are available in staff assignment; inactive designations remain for records.
              </p>
            </div>
            <button type="submit" style={buttonStyle()} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
          </form>
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10 }}>
            <h4 style={{ margin: 0 }}>Designation List</h4>
            <div style={{ display: "flex", gap: 8 }}>
              <div style={{ display: "grid", gap: 4 }}>
                <label htmlFor="designation-department-filter" style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Department Filter
                </label>
                <select
                  id="designation-department-filter"
                  value={departmentFilter}
                  onChange={(e) => setDepartmentFilter(e.target.value)}
                  style={{ ...fieldStyle(), height: 34, minWidth: 190 }}
                >
                  <option value="all">All Departments</option>
                  {departments.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                </select>
              </div>
              <div style={{ display: "grid", gap: 4 }}>
                <label htmlFor="designation-status-filter" style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Status Filter
                </label>
                <select
                  id="designation-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
                  style={{ ...fieldStyle(), height: 34, minWidth: 170 }}
                >
                  <option value="all">All</option>
                  <option value="active">Active only</option>
                  <option value="inactive">Inactive only</option>
                </select>
              </div>
            </div>
          </div>
          {loading ? <p style={{ marginTop: 0, marginBottom: 10, color: "var(--text-muted)" }}>Loading designations...</p> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Department</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Designation</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {filteredRows.map((row) => {
                const department = departments.find((item) => item.id === row.department);
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{department?.name || row.department}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                          color: row.is_active ? "#166534" : "#991b1b",
                          background: row.is_active ? "#dcfce7" : "#fee2e2",
                          border: `1px solid ${row.is_active ? "#86efac" : "#fca5a5"}`,
                        }}
                      >
                        {row.is_active ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button
                          type="button"
                          title="Edit designation"
                          aria-label="Edit designation"
                          style={{ ...buttonStyle("#0ea5e9"), width: 34, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          onClick={() => {
                            setEditingId(row.id);
                            setDepartmentId(String(row.department));
                            setName(row.name);
                            setIsActive(row.is_active);
                            formBoxRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 20h9" />
                            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          title="Delete designation"
                          aria-label="Delete designation"
                          style={{ ...buttonStyle("#dc2626"), width: 34, padding: 0, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
                          disabled={deletingId === row.id}
                          onClick={() => void removeDesignation(row.id)}
                        >
                          {deletingId === row.id ? "..." : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M3 6h18" />
                              <path d="M8 6V4h8v2" />
                              <path d="M19 6l-1 14H6L5 6" />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!loading && filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ padding: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--line)" }}>
                    No designations found for selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div></section>
    </div>
  );
}

export function HrStaffPanel() {
  const router = useRouter();
  const [roles, setRoles] = useState<Role[]>([]);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [rolesError, setRolesError] = useState("");
  const [dropdownErrors, setDropdownErrors] = useState<{ roles?: string; departments?: string; designations?: string }>({});
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    staff_no?: string;
    role?: string;
    first_name?: string;
    email?: string;
    join_date?: string;
    date_of_birth?: string;
    phone?: string;
    current_address?: string;
    permanent_address?: string;
    emergency_mobile?: string;
    staff_photo?: string;
    other_document?: string;
    epf_no?: string;
    basic_salary?: string;
    contract_type?: string;
    bank_account_name?: string;
    bank_account_no?: string;
    bank_mobile_no?: string;
    bank_name?: string;
    bank_branch?: string;
    ifsc_code?: string;
    facebook_url?: string;
    twitter_url?: string;
    linkedin_url?: string;
    instagram_url?: string;
  }>({});
  const [editingStaffId, setEditingStaffId] = useState<number | null>(null);
  const [editParam] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("edit") || "";
  });
  const [activeTab, setActiveTab] = useState<"basic" | "payroll" | "bank" | "social" | "document">("basic");

  const [staffNo, setStaffNo] = useState("");
  const [roleId, setRoleId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [designationId, setDesignationId] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [fathersName, setFathersName] = useState("");
  const [mothersName, setMothersName] = useState("");
  const [email, setEmail] = useState("");
  const [gender, setGender] = useState<"" | "male" | "female" | "other">("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [joinDate, setJoinDate] = useState(new Date().toISOString().slice(0, 10));
  const [phone, setPhone] = useState("");
  const [maritalStatus, setMaritalStatus] = useState<"" | "single" | "married">("");
  const [emergencyMobile, setEmergencyMobile] = useState("");
  const [drivingLicense, setDrivingLicense] = useState("");
  const [staffPhoto, setStaffPhoto] = useState("");
  const [showPublic, setShowPublic] = useState(false);
  const [currentAddress, setCurrentAddress] = useState("");
  const [permanentAddress, setPermanentAddress] = useState("");
  const [qualification, setQualification] = useState("");
  const [experience, setExperience] = useState("");

  const [epfNo, setEpfNo] = useState("");
  const [basicSalary, setBasicSalary] = useState("0.00");
  const [allowance, setAllowance] = useState("0.00");
  const [deduction, setDeduction] = useState("0.00");
  const [contractType, setContractType] = useState<"" | "permanent" | "contract">("");
  const [location, setLocation] = useState("");

  const [bankAccountName, setBankAccountName] = useState("");
  const [bankAccountNo, setBankAccountNo] = useState("");
  const [bankName, setBankName] = useState("");
  const [bankBranch, setBankBranch] = useState("");
  const [bankMobileNo, setBankMobileNo] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [facebookUrl, setFacebookUrl] = useState("");
  const [twitterUrl, setTwitterUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [instagramUrl, setInstagramUrl] = useState("");

  const [resume, setResume] = useState("");
  const [joiningLetter, setJoiningLetter] = useState("");
  const [tenthCertificate, setTenthCertificate] = useState("");
  const [eleventhCertificate, setEleventhCertificate] = useState("");
  const [aadharCard, setAadharCard] = useState("");
  const [drivingLicenseDoc, setDrivingLicenseDoc] = useState("");
  const [otherDocument, setOtherDocument] = useState("");

  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [joiningLetterFile, setJoiningLetterFile] = useState<File | null>(null);
  const [tenthCertFile, setTenthCertFile] = useState<File | null>(null);
  const [eleventhCertFile, setEleventhCertFile] = useState<File | null>(null);
  const [aadharFile, setAadharFile] = useState<File | null>(null);
  const [drivingLicenseFile, setDrivingLicenseFile] = useState<File | null>(null);
  const [otherDocFile, setOtherDocFile] = useState<File | null>(null);

  const staffPhotoRef = useRef<HTMLInputElement | null>(null);
  const importStaffRef = useRef<HTMLInputElement | null>(null);
  const resumeRef = useRef<HTMLInputElement | null>(null);
  const joiningLetterRef = useRef<HTMLInputElement | null>(null);
  const tenthCertRef = useRef<HTMLInputElement | null>(null);
  const eleventhCertRef = useRef<HTMLInputElement | null>(null);
  const aadharRef = useRef<HTMLInputElement | null>(null);
  const drivingLicenseRef = useRef<HTMLInputElement | null>(null);
  const otherDocRef = useRef<HTMLInputElement | null>(null);
  const [staffPhotoPreview, setStaffPhotoPreview] = useState("");

  const filteredDesignations = useMemo(() => {
    if (!departmentId) return designations;
    return designations.filter((item) => item.department === Number(departmentId));
  }, [departmentId, designations]);

  const todayStr = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateMobile = (value: string) => !value.trim() || /^\d{1,12}$/.test(value.trim());
  const validateOptionalUrl = (value: string) => !value.trim() || /^https?:\/\/[^\s/$.?#].[^\s]*$/i.test(value.trim());

  const scrollToField = (field: keyof typeof fieldErrors) => {
    const tabByField: Partial<Record<keyof typeof fieldErrors, typeof activeTab>> = {
      epf_no: "payroll",
      basic_salary: "payroll",
      contract_type: "payroll",
      bank_account_name: "bank",
      bank_account_no: "bank",
      bank_name: "bank",
      bank_branch: "bank",
      bank_mobile_no: "bank",
      ifsc_code: "bank",
      facebook_url: "social",
      twitter_url: "social",
      linkedin_url: "social",
      instagram_url: "social",
    };
    const targetTab = tabByField[field] || "basic";
    setActiveTab(targetTab);
    setTimeout(() => {
      const element = document.getElementById(`staff-field-${String(field)}`);
      if (!element) return;
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      if ("focus" in element) {
        (element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).focus();
      }
    }, 50);
  };

  const addYearsSafe = (dateString: string, years: number) => {
    const date = new Date(`${dateString}T00:00:00`);
    const month = date.getMonth();
    date.setFullYear(date.getFullYear() + years);
    // Handle leap-day edge cases by moving to last valid day of previous month.
    if (date.getMonth() !== month) {
      date.setDate(0);
    }
    return date.toISOString().slice(0, 10);
  };

  const salaryNetPreview = useMemo(() => {
    const basic = Number(basicSalary || "0");
    const allow = Number(allowance || "0");
    const deduct = Number(deduction || "0");
    if (!Number.isFinite(basic) || !Number.isFinite(allow) || !Number.isFinite(deduct)) return "0.00";
    return (basic + allow - deduct).toFixed(2);
  }, [basicSalary, allowance, deduction]);

  const getSubmitFieldErrors = () => {
    const nextErrors: typeof fieldErrors = {};
    const minAgeYears = 18;
    const maxAgeYears = 80;

    if (!staffNo.trim()) nextErrors.staff_no = "Staff no is required.";
    if (!roleId) nextErrors.role = "Role is required.";
    if (!firstName.trim()) {
      nextErrors.first_name = "First name is required.";
    } else if (!/^[A-Za-z ]{2,50}$/.test(firstName.trim())) {
      nextErrors.first_name = "First name can contain only letters and spaces.";
    }
    if (lastName.trim() && !/^[A-Za-z ]{2,50}$/.test(lastName.trim())) {
      nextErrors.first_name = "Last name can contain only letters and spaces.";
    }
    if (!email.trim()) {
      nextErrors.email = "Email is required.";
    } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      nextErrors.email = "Enter a valid email address.";
    }
    if (!joinDate) {
      nextErrors.join_date = "Joining date is required.";
    } else if (joinDate > todayStr) {
      nextErrors.join_date = "Joining date cannot be in the future.";
    }
    if (dateOfBirth) {
      if (dateOfBirth > todayStr) {
        nextErrors.date_of_birth = "Date of birth cannot be in the future.";
      }

      const eighteenthBirthday = addYearsSafe(dateOfBirth, minAgeYears);
      if (eighteenthBirthday > todayStr) {
        nextErrors.date_of_birth = `Employee must be at least ${minAgeYears} years old.`;
      }

      const oldestAllowedDob = addYearsSafe(todayStr, -maxAgeYears);
      if (dateOfBirth < oldestAllowedDob) {
        nextErrors.date_of_birth = `Employee age should not exceed ${maxAgeYears} years.`;
      }

      if (joinDate && joinDate < dateOfBirth) {
        nextErrors.join_date = "Joining date cannot be earlier than date of birth.";
      }

      if (joinDate && joinDate < eighteenthBirthday) {
        nextErrors.join_date = `Joining date must be after employee turns ${minAgeYears}.`;
      }
    }
    if (!validateMobile(phone)) nextErrors.phone = phone.trim().length > 12 ? "Mobile number must not exceed 12 digits." : "Mobile number must contain digits only.";
    if (!phone.trim()) nextErrors.phone = "Mobile number is required.";
    if (!validateMobile(emergencyMobile)) nextErrors.emergency_mobile = emergencyMobile.trim().length > 12 ? "Mobile number must not exceed 12 digits." : "Mobile number must contain digits only.";
    if (!staffPhoto.trim()) nextErrors.staff_photo = "Staff photo is required.";
    if (!currentAddress.trim()) nextErrors.current_address = "Current address is required.";
    if (!permanentAddress.trim()) nextErrors.permanent_address = "Permanent address is required.";
    if (!otherDocument.trim()) nextErrors.other_document = "Signature upload is required.";

    if (!bankAccountName.trim()) nextErrors.bank_account_name = "Account holder name is required";
    if (!bankAccountNo.trim()) {
      nextErrors.bank_account_no = "Enter valid account number";
    } else if (!/^\d{6,30}$/.test(bankAccountNo.trim())) {
      nextErrors.bank_account_no = "Enter valid account number";
    }
    if (!bankName.trim()) nextErrors.bank_name = "Bank name is required";
    if (!bankBranch.trim()) nextErrors.bank_branch = "Branch name is required";
    if (!ifscCode.trim()) {
      nextErrors.ifsc_code = "IFSC code is required.";
    } else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifscCode.trim().toUpperCase())) {
      nextErrors.ifsc_code = "Enter a valid IFSC code (e.g., HDFC0001234).";
    }

    if (!basicSalary.trim()) {
      nextErrors.basic_salary = "Enter valid salary amount";
    } else {
      const parsedSalary = Number(basicSalary);
      if (!Number.isFinite(parsedSalary) || parsedSalary <= 0) {
        nextErrors.basic_salary = "Enter valid salary amount";
      }
    }
    if (!contractType) nextErrors.contract_type = "Select contract type";

    if (epfNo.trim() && !/^[A-Za-z0-9\-/]{4,30}$/.test(epfNo.trim())) {
      nextErrors.epf_no = "Enter a valid EPF number.";
    }

    if (!validateOptionalUrl(facebookUrl)) nextErrors.facebook_url = "Enter a valid URL";
    if (!validateOptionalUrl(twitterUrl)) nextErrors.twitter_url = "Enter a valid URL";
    if (!validateOptionalUrl(linkedinUrl)) nextErrors.linkedin_url = "Enter a valid URL";
    if (!validateOptionalUrl(instagramUrl)) nextErrors.instagram_url = "Enter a valid URL";

    return nextErrors;
  };

  const applyApiErrorToField = (message: string): keyof typeof fieldErrors | null => {
    const lowered = message.toLowerCase();
    if (lowered.includes("staff number") || lowered.includes("staff no")) {
      setFieldErrors((prev) => ({ ...prev, staff_no: message }));
      return "staff_no";
    }
    if (lowered.includes("role")) {
      setFieldErrors((prev) => ({ ...prev, role: message }));
      return "role";
    }
    if (lowered.includes("email")) {
      setFieldErrors((prev) => ({ ...prev, email: message }));
      return "email";
    }
    if (lowered.includes("joining date") || lowered.includes("join date")) {
      setFieldErrors((prev) => ({ ...prev, join_date: message }));
      return "join_date";
    }
    if (lowered.includes("date of birth")) {
      setFieldErrors((prev) => ({ ...prev, date_of_birth: message }));
      return "date_of_birth";
    }
    if (lowered.includes("mobile") || lowered.includes("phone")) {
      setFieldErrors((prev) => ({ ...prev, phone: message }));
      return "phone";
    }
    if (lowered.includes("current address")) {
      setFieldErrors((prev) => ({ ...prev, current_address: message }));
      return "current_address";
    }
    if (lowered.includes("permanent address")) {
      setFieldErrors((prev) => ({ ...prev, permanent_address: message }));
      return "permanent_address";
    }
    if (lowered.includes("signature") || lowered.includes("other document")) {
      setFieldErrors((prev) => ({ ...prev, other_document: message }));
      return "other_document";
    }
    if (lowered.includes("account holder")) {
      setFieldErrors((prev) => ({ ...prev, bank_account_name: message }));
      return "bank_account_name";
    }
    if (lowered.includes("account number") || lowered.includes("bank account")) {
      setFieldErrors((prev) => ({ ...prev, bank_account_no: message }));
      return "bank_account_no";
    }
    if (lowered.includes("bank name")) {
      setFieldErrors((prev) => ({ ...prev, bank_name: message }));
      return "bank_name";
    }
    if (lowered.includes("branch")) {
      setFieldErrors((prev) => ({ ...prev, bank_branch: message }));
      return "bank_branch";
    }
    if (lowered.includes("ifsc")) {
      setFieldErrors((prev) => ({ ...prev, ifsc_code: message }));
      return "ifsc_code";
    }
    if (lowered.includes("salary")) {
      setFieldErrors((prev) => ({ ...prev, basic_salary: message }));
      return "basic_salary";
    }
    if (lowered.includes("contract type")) {
      setFieldErrors((prev) => ({ ...prev, contract_type: message }));
      return "contract_type";
    }
    if (lowered.includes("epf")) {
      setFieldErrors((prev) => ({ ...prev, epf_no: message }));
      return "epf_no";
    }
    if (lowered.includes("facebook")) {
      setFieldErrors((prev) => ({ ...prev, facebook_url: message }));
      return "facebook_url";
    }
    if (lowered.includes("twitter")) {
      setFieldErrors((prev) => ({ ...prev, twitter_url: message }));
      return "twitter_url";
    }
    if (lowered.includes("linkedin")) {
      setFieldErrors((prev) => ({ ...prev, linkedin_url: message }));
      return "linkedin_url";
    }
    if (lowered.includes("instagram")) {
      setFieldErrors((prev) => ({ ...prev, instagram_url: message }));
      return "instagram_url";
    }
    return null;
  };

  const resetForm = () => {
    setActiveTab("basic");
    setStaffNo("");
    setRoleId("");
    setDepartmentId("");
    setDesignationId("");
    setFirstName("");
    setLastName("");
    setFathersName("");
    setMothersName("");
    setEmail("");
    setGender("");
    setDateOfBirth("");
    setJoinDate(new Date().toISOString().slice(0, 10));
    setPhone("");
    setMaritalStatus("");
    setEmergencyMobile("");
    setDrivingLicense("");
    setStaffPhoto("");
    setStaffPhotoPreview("");
    setShowPublic(false);
    setCurrentAddress("");
    setPermanentAddress("");
    setQualification("");
    setExperience("");
    setEpfNo("");
    setBasicSalary("0.00");
    setAllowance("0.00");
    setDeduction("0.00");
    setContractType("");
    setLocation("");
    setBankAccountName("");
    setBankAccountNo("");
    setBankName("");
    setBankBranch("");
    setBankMobileNo("");
    setIfscCode("");
    try {
      localStorage.removeItem("hr_staff_form_draft");
    } catch {
      // ignore storage errors
    }
    setFacebookUrl("");
    setTwitterUrl("");
    setLinkedinUrl("");
    setInstagramUrl("");
    setResume("");
    setResumeFile(null);
    setJoiningLetter("");
    setJoiningLetterFile(null);
    setTenthCertificate("");
    setTenthCertFile(null);
    setEleventhCertificate("");
    setEleventhCertFile(null);
    setAadharCard("");
    setAadharFile(null);
    setDrivingLicenseDoc("");
    setDrivingLicenseFile(null);
    setOtherDocument("");
    setOtherDocFile(null);
  };

  const handleImportStaffCsv = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) {
      setError("CSV file is empty.");
      return;
    }

    const headers = lines[0].split(",").map((item) => item.trim().toLowerCase());
    const values = lines[1].split(",").map((item) => item.trim());
    const map = new Map<string, string>();
    headers.forEach((header, idx) => map.set(header, values[idx] || ""));

    setFirstName(map.get("first_name") || firstName);
    setLastName(map.get("last_name") || lastName);
    setEmail(map.get("email") || email);
    setPhone(map.get("phone") || phone);
    setDepartmentId(map.get("department_id") || departmentId);
    setDesignationId(map.get("designation_id") || designationId);
    setRoleId(map.get("role_id") || roleId);
    setJoinDate(map.get("join_date") || joinDate);
    setToast("Imported first CSV row into the form. Review and save.");
  };

  const load = async () => {
    try {
      setError("");
      setDropdownErrors({});
      setRolesLoading(true);
      setRolesError("");

      const [roleDataResult, departmentDataResult, designationDataResult, nextStaffNoResult] = await Promise.allSettled([
        apiGet<unknown>("/api/v1/access-control/roles/"),
        apiGet<ApiList<Department>>("/api/v1/hr/departments/?is_active=true"),
        apiGet<ApiList<Designation>>("/api/v1/hr/designations/?is_active=true"),
        apiGet<{ staff_no?: string }>("/api/v1/hr/staff/next-staff-no/"),
      ]);

      if (roleDataResult.status === "fulfilled") {
        const payload = roleDataResult.value as { results?: Role[]; data?: Role[] } | Role[];
        const mappedRoles = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.data)
            ? payload.data
            : payload.results || [];
        // Ensure options always use backend id -> value and name -> label.
        setRoles(mappedRoles.map((role) => ({ id: role.id, name: role.name })));
        setRolesError("");
      } else {
        setRoles([]);
        setRolesError("Failed to load roles");
        setDropdownErrors((prev) => ({ ...prev, roles: "Failed to load roles" }));
      }

      if (departmentDataResult.status === "fulfilled") {
        setDepartments(listData(departmentDataResult.value));
      } else {
        setDepartments([]);
        setDropdownErrors((prev) => ({ ...prev, departments: "Failed to load departments" }));
      }
      if (designationDataResult.status === "fulfilled") {
        setDesignations(listData(designationDataResult.value));
      } else {
        setDesignations([]);
        setDropdownErrors((prev) => ({ ...prev, designations: "Failed to load designations" }));
      }
      if (!editParam && nextStaffNoResult.status === "fulfilled") {
        const nextValue = (nextStaffNoResult.value.staff_no || "").trim();
        setStaffNo((prev) => prev || nextValue);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load staff.";
      setError("Unable to load staff.");
      if (message && message !== "Unable to load staff.") {
        setError(message);
      }
    } finally {
      setRolesLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (editParam) return;
    try {
      const raw = localStorage.getItem("hr_staff_form_draft");
      if (!raw) return;
      const draft = JSON.parse(raw) as Partial<Record<string, string | boolean>>;
      setStaffNo(String(draft.staffNo || ""));
      setRoleId(String(draft.roleId || ""));
      setDepartmentId(String(draft.departmentId || ""));
      setDesignationId(String(draft.designationId || ""));
      setFirstName(String(draft.firstName || ""));
      setLastName(String(draft.lastName || ""));
      setEmail(String(draft.email || ""));
      setPhone(String(draft.phone || ""));
      setJoinDate(String(draft.joinDate || joinDate));
      setDateOfBirth(String(draft.dateOfBirth || ""));
      setBasicSalary(String(draft.basicSalary || "0.00"));
      setAllowance(String(draft.allowance || "0.00"));
      setDeduction(String(draft.deduction || "0.00"));
      setBankAccountName(String(draft.bankAccountName || ""));
      setBankAccountNo(String(draft.bankAccountNo || ""));
      setBankName(String(draft.bankName || ""));
      setBankBranch(String(draft.bankBranch || ""));
      setIfscCode(String(draft.ifscCode || ""));
      setBankMobileNo(String(draft.bankMobileNo || ""));
      setShowPublic(Boolean(draft.showPublic));
    } catch {
      // ignore malformed draft
    }
  }, [editParam]);

  useEffect(() => {
    if (editParam || editingStaffId) return;
    try {
      localStorage.setItem(
        "hr_staff_form_draft",
        JSON.stringify({
          staffNo,
          roleId,
          departmentId,
          designationId,
          firstName,
          lastName,
          email,
          phone,
          joinDate,
          dateOfBirth,
          basicSalary,
          allowance,
          deduction,
          bankAccountName,
          bankAccountNo,
          bankName,
          bankBranch,
          ifscCode,
          bankMobileNo,
          showPublic,
        })
      );
    } catch {
      // ignore storage errors
    }
  }, [
    editParam,
    editingStaffId,
    staffNo,
    roleId,
    departmentId,
    designationId,
    firstName,
    lastName,
    email,
    phone,
    joinDate,
    dateOfBirth,
    basicSalary,
    allowance,
    deduction,
    bankAccountName,
    bankAccountNo,
    bankName,
    bankBranch,
    ifscCode,
    bankMobileNo,
    showPublic,
  ]);

  useEffect(() => {
    if (!editParam) {
      setEditingStaffId(null);
      return;
    }

    try {
      localStorage.removeItem("hr_staff_form_draft");
    } catch {
      // ignore storage access issues
    }

    const parsedId = Number(editParam);
    if (!Number.isFinite(parsedId) || parsedId <= 0) {
      setError("Invalid staff id for editing.");
      return;
    }

    const loadEditStaff = async () => {
      try {
        setError("");
        setSuccess("");
        const row = await apiGet<Staff>(`/api/v1/hr/staff/${parsedId}/`);
        setEditingStaffId(row.id);
        setActiveTab("basic");
        setStaffNo(row.staff_no || "");
        setRoleId(row.role ? String(row.role) : "");
        setDepartmentId(row.department ? String(row.department) : "");
        setDesignationId(row.designation ? String(row.designation) : "");
        setFirstName(row.first_name || "");
        setLastName(row.last_name || "");
        setFathersName(row.fathers_name || "");
        setMothersName(row.mothers_name || "");
        setEmail(row.email || "");
        setGender((row.gender || "") as "" | "male" | "female" | "other");
        setDateOfBirth(row.date_of_birth || "");
        setJoinDate(row.join_date || new Date().toISOString().slice(0, 10));
        setPhone(row.phone || "");
        setMaritalStatus((row.marital_status || "") as "" | "single" | "married");
        setEmergencyMobile(row.emergency_mobile || "");
        setDrivingLicense(row.driving_license || "");
        setStaffPhoto(row.staff_photo || "");
        setStaffPhotoPreview(/^https?:\/\//i.test(row.staff_photo || "") ? (row.staff_photo || "") : "");
        setShowPublic(Boolean(row.show_public));
        setCurrentAddress(row.current_address || "");
        setPermanentAddress(row.permanent_address || "");
        setQualification(row.qualification || "");
        setExperience(row.experience || "");
        setEpfNo(row.epf_no || "");
        setBasicSalary(String(row.basic_salary || "0.00"));
        const custom = (row as unknown as { custom_field?: { allowance?: string | number; deduction?: string | number; ifsc_code?: string } }).custom_field || {};
        setAllowance(String(custom.allowance || "0.00"));
        setDeduction(String(custom.deduction || "0.00"));
        setContractType((row.contract_type || "") as "" | "permanent" | "contract");
        setLocation(row.location || "");
        setBankAccountName(row.bank_account_name || "");
        setBankAccountNo(row.bank_account_no || "");
        setBankName(row.bank_name || "");
        setBankBranch(row.bank_branch || "");
        setBankMobileNo(row.bank_mobile_no || "");
        setIfscCode(String((row as unknown as { custom_field?: { ifsc_code?: string } }).custom_field?.ifsc_code || ""));
        setFacebookUrl(row.facebook_url || "");
        setTwitterUrl(row.twitter_url || "");
        setLinkedinUrl(row.linkedin_url || "");
        setInstagramUrl(row.instagram_url || "");
        setResume(row.resume || "");
        setJoiningLetter(row.joining_letter || "");
        setTenthCertificate(row.tenth_certificate || "");
        setEleventhCertificate(row.eleventh_certificate || "");
        setAadharCard(row.aadhar_card || "");
        setDrivingLicenseDoc(row.driving_license_doc || "");
        setOtherDocument(row.other_document || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to load staff details.");
      }
    };

    void loadEditStaff();
  }, [editParam]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const submitErrors = getSubmitFieldErrors();
    setFieldErrors(submitErrors);
    if (Object.keys(submitErrors).length > 0) {
      setError("");
      setToast("");
      const firstField = Object.keys(submitErrors)[0] as keyof typeof fieldErrors;
      scrollToField(firstField);
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setToast("");
      const payload = {
        staff_no: staffNo.trim(),
        role: roleId ? Number(roleId) : null,
        department: departmentId ? Number(departmentId) : null,
        designation: designationId ? Number(designationId) : null,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        fathers_name: fathersName.trim(),
        mothers_name: mothersName.trim(),
        email: email.trim(),
        gender,
        date_of_birth: dateOfBirth || null,
        join_date: joinDate,
        phone: phone.trim(),
        marital_status: maritalStatus,
        emergency_mobile: emergencyMobile.trim(),
        driving_license: drivingLicense.trim(),
        staff_photo: staffPhoto.trim(),
        show_public: showPublic,
        current_address: currentAddress.trim(),
        permanent_address: permanentAddress.trim(),
        qualification: qualification.trim(),
        experience: experience.trim(),
        epf_no: epfNo.trim(),
        basic_salary: basicSalary || "0.00",
        contract_type: contractType,
        location: location.trim(),
        bank_account_name: bankAccountName.trim(),
        bank_account_no: bankAccountNo.trim(),
        bank_name: bankName.trim(),
        bank_branch: bankBranch.trim(),
        bank_mobile_no: bankMobileNo.trim(),
        custom_field: {
          ifsc_code: ifscCode.trim().toUpperCase(),
          allowance: allowance.trim() || "0.00",
          deduction: deduction.trim() || "0.00",
        },
        facebook_url: facebookUrl.trim(),
        twitter_url: twitterUrl.trim(),
        linkedin_url: linkedinUrl.trim(),
        instagram_url: instagramUrl.trim(),
        resume: resume.trim(),
        joining_letter: joiningLetter.trim(),
        tenth_certificate: tenthCertificate.trim(),
        eleventh_certificate: eleventhCertificate.trim(),
        aadhar_card: aadharCard.trim(),
        driving_license_doc: drivingLicenseDoc.trim(),
        other_document: otherDocument.trim(),
        status: "active",
      };

      if (editingStaffId) {
        await apiPatch(`/api/v1/hr/staff/${editingStaffId}/`, payload);
        try {
          localStorage.removeItem("hr_staff_form_draft");
        } catch {
          // ignore storage errors
        }
        setSuccess("Staff has been updated successfully.");
        router.push("/hr/staff-directory?updated=1");
        return;
      }

      await apiPost("/api/v1/hr/staff/", payload);

      try {
        localStorage.removeItem("hr_staff_form_draft");
      } catch {
        // ignore storage errors
      }
      resetForm();
      setSuccess("Staff has been added successfully.");
      await load();
      router.push("/hr/staff-directory?created=1");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save staff.";
      const mappedField = applyApiErrorToField(message);
      if (mappedField) {
        scrollToField(mappedField);
      }
      setError(message);
      setToast(message);
    } finally {
      setSaving(false);
    }
  };

  const tabs: Array<{ key: "basic" | "payroll" | "bank" | "social" | "document"; label: string }> = [
    { key: "basic", label: "Basic Info" },
    { key: "payroll", label: "Payroll Details" },
    { key: "bank", label: "Bank Info Details" },
    { key: "social", label: "Social Links Details" },
    { key: "document", label: "Document Info" },
  ];

  const sectionGrid = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 } as const;

  return (
    <div className="legacy-panel">
      {breadcrumb(editingStaffId ? "Edit Staff" : "Add New Staff")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>{editingStaffId ? "Edit Staff Information" : "Staff Information"}</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              <input
                ref={importStaffRef}
                type="file"
                accept=".csv,text/csv"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  void handleImportStaffCsv(file).catch(() => {
                    setError("Unable to import CSV file.");
                  });
                  e.target.value = "";
                }}
              />
              <button type="button" style={buttonStyle("#7c3aed")} onClick={() => importStaffRef.current?.click()}>Import Staff</button>
              <button type="submit" form="staff-form" style={buttonStyle()} disabled={saving || rolesLoading}>
                {saving ? "Saving..." : editingStaffId ? "Update Staff" : "Save Staff"}
              </button>
              <button type="button" style={buttonStyle("#6b7280")} onClick={resetForm} disabled={saving}>Reset Form</button>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, borderBottom: "1px solid var(--line)", paddingBottom: 8, marginBottom: 12, flexWrap: "wrap" }}>
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                style={{
                  height: 34,
                  padding: "0 14px",
                  borderRadius: 8,
                  border: "1px solid var(--line)",
                  background: activeTab === tab.key ? "#e6ebff" : "var(--surface)",
                  color: "var(--text)",
                  cursor: "pointer",
                  fontSize: 12,
                  textTransform: "uppercase",
                  fontWeight: 600,
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <form id="staff-form" onSubmit={submit} style={{ display: "grid", gap: 12 }}>
            {activeTab === "basic" && (
              <div style={{ display: "grid", gap: 16 }}>
                {/* Basic Information: system id + personal + contact + family + photo */}
                <section style={{ ...boxStyle(), padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 14, textTransform: "uppercase", color: "var(--text-muted)" }}>Basic Information</h4>
                  <div style={sectionGrid}>
                    {/* 1) System Identifier */}
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Staff No *</span><input value={staffNo} onChange={(e) => { setStaffNo(e.target.value); clearFieldError("staff_no"); }} style={{ ...fieldStyle(), background: "#f8fafc", borderColor: fieldErrors.staff_no ? "#dc2626" : "var(--line)" }} readOnly title="Auto generated" />{fieldErrors.staff_no ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.staff_no}</span> : null}</label>
                    <div />
                    <div />
                    <div />

                    {/* 2) Personal Details */}
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>First Name *</span><input value={firstName} onChange={(e) => { setFirstName(e.target.value); clearFieldError("first_name"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.first_name ? "#dc2626" : "var(--line)" }} />{fieldErrors.first_name ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.first_name}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Last Name</span><input value={lastName} onChange={(e) => setLastName(e.target.value)} style={fieldStyle()} /></label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Gender</span><select value={gender} onChange={(e) => setGender(e.target.value as "" | "male" | "female" | "other")} style={fieldStyle()}><option value="">Gender</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select></label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Date Of Birth</span><input type="date" value={dateOfBirth} onChange={(e) => { setDateOfBirth(e.target.value); clearFieldError("date_of_birth"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.date_of_birth ? "#dc2626" : "var(--line)" }} />{fieldErrors.date_of_birth ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.date_of_birth}</span> : null}</label>

                    {/* 3) Contact Details */}
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Email *</span><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); clearFieldError("email"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.email ? "#dc2626" : "var(--line)" }} />{fieldErrors.email ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.email}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Mobile *</span><input value={phone} onChange={(e) => { setPhone(e.target.value.replace(/\D/g, "").slice(0, 12)); clearFieldError("phone"); }} maxLength={12} style={{ ...fieldStyle(), borderColor: fieldErrors.phone ? "#dc2626" : "var(--line)" }} />{fieldErrors.phone ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.phone}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Emergency Mobile</span><input value={emergencyMobile} onChange={(e) => { setEmergencyMobile(e.target.value.replace(/\D/g, "").slice(0, 12)); clearFieldError("emergency_mobile"); }} maxLength={12} style={{ ...fieldStyle(), borderColor: fieldErrors.emergency_mobile ? "#dc2626" : "var(--line)" }} />{fieldErrors.emergency_mobile ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.emergency_mobile}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Marital Status</span><select value={maritalStatus} onChange={(e) => setMaritalStatus(e.target.value as "" | "single" | "married")} style={fieldStyle()}><option value="">Marital Status</option><option value="single">Single</option><option value="married">Married</option></select></label>

                    {/* 5) Family Details */}
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Father Name</span><input value={fathersName} onChange={(e) => setFathersName(e.target.value)} style={fieldStyle()} /></label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Mother Name</span><input value={mothersName} onChange={(e) => setMothersName(e.target.value)} style={fieldStyle()} /></label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Driving License</span><input value={drivingLicense} onChange={(e) => setDrivingLicense(e.target.value)} style={fieldStyle()} /></label>
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Show As Expert Staff</span>
                      <div style={{ display: "flex", gap: 16, alignItems: "center", height: 36 }}>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="radio" checked={showPublic} onChange={() => setShowPublic(true)} /> Yes</label>
                        <label style={{ display: "flex", gap: 6, alignItems: "center" }}><input type="radio" checked={!showPublic} onChange={() => setShowPublic(false)} /> No</label>
                      </div>
                    </div>

                    {/* 7) File Upload */}
                    <div style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Staff Photo *</span>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 86px", gap: 6 }}>
                        <input readOnly value={staffPhoto || "Staff Photo"} style={{ ...fieldStyle(), borderColor: fieldErrors.staff_photo ? "#dc2626" : "var(--line)" }} />
                        <button type="button" style={buttonStyle("#7c3aed")} onClick={() => staffPhotoRef.current?.click()}>Browse</button>
                        <input
                          ref={staffPhotoRef}
                          type="file"
                          accept=".jpg,.jpeg,.png,image/jpeg,image/png"
                          style={{ display: "none" }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (!file) {
                              setStaffPhoto("");
                              setStaffPhotoPreview("");
                              clearFieldError("staff_photo");
                              return;
                            }
                            const isAllowedType = ["image/jpeg", "image/png"].includes(file.type);
                            if (!isAllowedType) {
                              const message = "Only JPG and PNG files are allowed.";
                              setFieldErrors((prev) => ({ ...prev, staff_photo: message }));
                              setError(message);
                              setToast(message);
                              e.target.value = "";
                              return;
                            }
                            if (file.size > 2 * 1024 * 1024) {
                              const message = "File size must be 2MB or less.";
                              setFieldErrors((prev) => ({ ...prev, staff_photo: message }));
                              setError(message);
                              setToast(message);
                              e.target.value = "";
                              return;
                            }
                            setStaffPhoto(file.name);
                            setStaffPhotoPreview(URL.createObjectURL(file));
                            clearFieldError("staff_photo");
                          }}
                        />
                      </div>
                      <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted formats: JPG, JPEG, PNG (max 2MB).</span>
                      {staffPhotoPreview ? <img src={staffPhotoPreview} alt="Staff photo preview" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid var(--line)" }} /> : null}
                      {fieldErrors.staff_photo ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.staff_photo}</span> : null}
                    </div>
                  </div>
                </section>

                {/* Job Details: grouped organizational fields in one block */}
                <section style={{ ...boxStyle(), padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 14, textTransform: "uppercase", color: "var(--text-muted)" }}>Job Details</h4>
                  <div style={sectionGrid}>
                    <label style={{ display: "grid", gap: 6 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Role *</span>
                      <select value={roleId} onChange={(e) => { setRoleId(e.target.value); clearFieldError("role"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.role ? "#dc2626" : "var(--line)" }} disabled={rolesLoading}>
                        <option value="">{rolesLoading ? "Loading roles..." : "Role *"}</option>
                        {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                      {rolesError ? <span style={{ color: "#dc2626", fontSize: 12 }}>{rolesError}</span> : null}
                      {fieldErrors.role ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.role}</span> : null}
                    </label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Department</span><select value={departmentId} onChange={(e) => { setDepartmentId(e.target.value); setDesignationId(""); }} style={fieldStyle()}><option value="">Department</option>{departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{dropdownErrors.departments ? <span style={{ color: "#dc2626", fontSize: 12 }}>{dropdownErrors.departments}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Designation</span><select value={designationId} onChange={(e) => setDesignationId(e.target.value)} style={fieldStyle()}><option value="">Designation</option>{filteredDesignations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}</select>{dropdownErrors.designations ? <span style={{ color: "#dc2626", fontSize: 12 }}>{dropdownErrors.designations}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Date Of Joining *</span><input type="date" value={joinDate} onChange={(e) => { setJoinDate(e.target.value); clearFieldError("join_date"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.join_date ? "#dc2626" : "var(--line)" }} />{fieldErrors.join_date ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.join_date}</span> : null}</label>
                  </div>
                </section>

                {/* Additional Information: long-text details grouped at end */}
                <section style={{ ...boxStyle(), padding: 12 }}>
                  <h4 style={{ margin: "0 0 10px 0", fontSize: 14, textTransform: "uppercase", color: "var(--text-muted)" }}>Additional Information</h4>
                  <div style={sectionGrid}>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Current Address *</span><textarea value={currentAddress} onChange={(e) => { setCurrentAddress(e.target.value); clearFieldError("current_address"); }} style={{ width: "100%", minHeight: 84, border: `1px solid ${fieldErrors.current_address ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: 10 }} />{fieldErrors.current_address ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.current_address}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Permanent Address *</span><textarea value={permanentAddress} onChange={(e) => { setPermanentAddress(e.target.value); clearFieldError("permanent_address"); }} style={{ width: "100%", minHeight: 84, border: `1px solid ${fieldErrors.permanent_address ? "#dc2626" : "var(--line)"}`, borderRadius: 8, padding: 10 }} />{fieldErrors.permanent_address ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.permanent_address}</span> : null}</label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Qualifications</span><textarea value={qualification} onChange={(e) => setQualification(e.target.value)} style={{ width: "100%", minHeight: 84, border: "1px solid var(--line)", borderRadius: 8, padding: 10 }} /></label>
                    <label style={{ display: "grid", gap: 6 }}><span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Experience</span><textarea value={experience} onChange={(e) => setExperience(e.target.value)} style={{ width: "100%", minHeight: 84, border: "1px solid var(--line)", borderRadius: 8, padding: 10 }} /></label>
                  </div>
                </section>
              </div>
            )}

            {activeTab === "payroll" && (
              <div style={sectionGrid}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>EPF Number</span>
                  <input id="staff-field-epf_no" value={epfNo} onChange={(e) => { setEpfNo(e.target.value); clearFieldError("epf_no"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.epf_no ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.epf_no ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.epf_no}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Basic Salary *</span>
                  <input id="staff-field-basic_salary" type="number" min="0" step="0.01" value={basicSalary} onChange={(e) => { setBasicSalary(e.target.value); clearFieldError("basic_salary"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.basic_salary ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.basic_salary ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.basic_salary}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Allowances</span>
                  <input type="number" min="0" step="0.01" value={allowance} onChange={(e) => setAllowance(e.target.value)} style={fieldStyle()} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Deductions</span>
                  <input type="number" min="0" step="0.01" value={deduction} onChange={(e) => setDeduction(e.target.value)} style={fieldStyle()} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Net Salary (Preview)</span>
                  <input readOnly value={salaryNetPreview} style={{ ...fieldStyle(), background: "#f8fafc" }} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Contract Type *</span>
                  <select id="staff-field-contract_type" value={contractType} onChange={(e) => { setContractType(e.target.value as "" | "permanent" | "contract"); clearFieldError("contract_type"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.contract_type ? "#dc2626" : "var(--line)" }}><option value="">Contract Type</option><option value="permanent">Permanent</option><option value="contract">Contract</option></select>
                  {fieldErrors.contract_type ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.contract_type}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Location</span>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} style={fieldStyle()} />
                </label>
              </div>
            )}

            {activeTab === "bank" && (
              <div style={sectionGrid}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Account Holder Name *</span>
                  <input id="staff-field-bank_account_name" value={bankAccountName} onChange={(e) => { setBankAccountName(e.target.value); clearFieldError("bank_account_name"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.bank_account_name ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.bank_account_name ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_account_name}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Account Number *</span>
                  <input id="staff-field-bank_account_no" value={bankAccountNo} onChange={(e) => { setBankAccountNo(e.target.value); clearFieldError("bank_account_no"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.bank_account_no ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.bank_account_no ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_account_no}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Bank Name *</span>
                  <input id="staff-field-bank_name" value={bankName} onChange={(e) => { setBankName(e.target.value); clearFieldError("bank_name"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.bank_name ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.bank_name ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_name}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Branch Name *</span>
                  <input id="staff-field-bank_branch" value={bankBranch} onChange={(e) => { setBankBranch(e.target.value); clearFieldError("bank_branch"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.bank_branch ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.bank_branch ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_branch}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>IFSC Code *</span>
                  <input value={ifscCode} onChange={(e) => setIfscCode(e.target.value.toUpperCase())} placeholder="e.g., SBIN0001234" style={fieldStyle()} maxLength={11} />
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Bank Contact Mobile</span>
                  <input value={bankMobileNo} onChange={(e) => { setBankMobileNo(e.target.value.replace(/\D/g, "").slice(0, 12)); clearFieldError("bank_mobile_no"); }} maxLength={12} placeholder="e.g., 9876543210" style={{ ...fieldStyle(), borderColor: fieldErrors.bank_mobile_no ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.bank_mobile_no ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.bank_mobile_no}</span> : null}
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Optional: Bank customer service contact number</span>
                </label>
              </div>
            )}

            {activeTab === "social" && (
              <div style={sectionGrid}>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Facebook URL</span>
                  <input id="staff-field-facebook_url" value={facebookUrl} onChange={(e) => { setFacebookUrl(e.target.value); clearFieldError("facebook_url"); }} placeholder="Enter Facebook profile URL" style={{ ...fieldStyle(), borderColor: fieldErrors.facebook_url ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.facebook_url ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.facebook_url}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Twitter URL</span>
                  <input id="staff-field-twitter_url" value={twitterUrl} onChange={(e) => { setTwitterUrl(e.target.value); clearFieldError("twitter_url"); }} placeholder="Enter Twitter profile URL" style={{ ...fieldStyle(), borderColor: fieldErrors.twitter_url ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.twitter_url ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.twitter_url}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>LinkedIn URL</span>
                  <input id="staff-field-linkedin_url" value={linkedinUrl} onChange={(e) => { setLinkedinUrl(e.target.value); clearFieldError("linkedin_url"); }} placeholder="Enter LinkedIn profile URL" style={{ ...fieldStyle(), borderColor: fieldErrors.linkedin_url ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.linkedin_url ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.linkedin_url}</span> : null}
                </label>
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Instagram URL</span>
                  <input id="staff-field-instagram_url" value={instagramUrl} onChange={(e) => { setInstagramUrl(e.target.value); clearFieldError("instagram_url"); }} placeholder="Enter Instagram profile URL" style={{ ...fieldStyle(), borderColor: fieldErrors.instagram_url ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.instagram_url ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.instagram_url}</span> : null}
                </label>
              </div>
            )}

            {activeTab === "document" && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12 }}>
                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Resume</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 86px", gap: 6 }}>
                    <input readOnly value={resume || "Resume"} style={fieldStyle()} />
                    <button type="button" style={buttonStyle("#7c3aed")} onClick={() => resumeRef.current?.click()}>Browse</button>
                    <input ref={resumeRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setResumeFile(file); setResume(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, DOC, DOCX, JPG, PNG</span>
                  {resumeFile && <a href={URL.createObjectURL(resumeFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a>}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Joining Letter</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 86px", gap: 6 }}>
                    <input readOnly value={joiningLetter || "Joining Letter"} style={fieldStyle()} />
                    <button type="button" style={buttonStyle("#7c3aed")} onClick={() => joiningLetterRef.current?.click()}>Browse</button>
                    <input ref={joiningLetterRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setJoiningLetterFile(file); setJoiningLetter(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, DOC, DOCX, JPG, PNG</span>
                  {joiningLetterFile && <a href={URL.createObjectURL(joiningLetterFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a>}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>10th Certificate</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 86px", gap: 6 }}>
                    <input readOnly value={tenthCertificate || "10th Certificate"} style={fieldStyle()} />
                    <button type="button" style={buttonStyle("#7c3aed")} onClick={() => tenthCertRef.current?.click()}>Browse</button>
                    <input ref={tenthCertRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setTenthCertFile(file); setTenthCertificate(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, JPG, JPEG, PNG</span>
                  {tenthCertFile && <a href={URL.createObjectURL(tenthCertFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a>}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>11th/12th Certificate</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 86px", gap: 6 }}>
                    <input readOnly value={eleventhCertificate || "11th/12th Certificate"} style={fieldStyle()} />
                    <button type="button" style={buttonStyle("#7c3aed")} onClick={() => eleventhCertRef.current?.click()}>Browse</button>
                    <input ref={eleventhCertRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setEleventhCertFile(file); setEleventhCertificate(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, JPG, JPEG, PNG</span>
                  {eleventhCertFile && <a href={URL.createObjectURL(eleventhCertFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a>}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Aadhar Card</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 86px", gap: 6 }}>
                    <input readOnly value={aadharCard || "Aadhar Card"} style={fieldStyle()} />
                    <button type="button" style={buttonStyle("#7c3aed")} onClick={() => aadharRef.current?.click()}>Browse</button>
                    <input ref={aadharRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setAadharFile(file); setAadharCard(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, JPG, JPEG, PNG</span>
                  {aadharFile && <a href={URL.createObjectURL(aadharFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a>}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Driving License</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 86px", gap: 6 }}>
                    <input readOnly value={drivingLicenseDoc || "Driving License"} style={fieldStyle()} />
                    <button type="button" style={buttonStyle("#7c3aed")} onClick={() => drivingLicenseRef.current?.click()}>Browse</button>
                    <input ref={drivingLicenseRef} type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setDrivingLicenseFile(file); setDrivingLicenseDoc(file.name); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, JPG, JPEG, PNG</span>
                  {drivingLicenseFile && <a href={URL.createObjectURL(drivingLicenseFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a>}
                </div>

                <div style={{ display: "grid", gap: 6 }}>
                  <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Signature Upload *</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 86px", gap: 6 }}>
                    <input readOnly value={otherDocument || "Signature Upload"} style={{ ...fieldStyle(), borderColor: fieldErrors.other_document ? "#dc2626" : "var(--line)" }} />
                    <button type="button" style={buttonStyle("#7c3aed")} onClick={() => otherDocRef.current?.click()}>Browse</button>
                    <input ref={otherDocRef} type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" style={{ display: "none" }} onChange={(e) => { const file = e.target.files?.[0]; if (file) { setOtherDocFile(file); setOtherDocument(file.name); clearFieldError("other_document"); } }} />
                  </div>
                  <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Accepted: PDF, DOC, DOCX, JPG, PNG</span>
                  {otherDocFile && <a href={URL.createObjectURL(otherDocFile)} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "#7c3aed", textDecoration: "underline" }}>Preview / Download</a>}
                  {fieldErrors.other_document ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.other_document}</span> : null}
                </div>
              </div>
            )}

            <div style={{ display: "none" }}>
              <button type="submit">Save</button>
            </div>
          </form>
          {toast ? <p style={{ color: "#dc2626", marginTop: 8 }}>{toast}</p> : null}
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {success && <p style={{ color: "#16a34a", marginTop: 8 }}>{success}</p>}
        </div>
      </div></section>
    </div>
  );
}

export function HrStaffDirectoryPanel() {
  const [rows, setRows] = useState<Staff[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [designations, setDesignations] = useState<Designation[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<number | null>(null);

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDepartment, setFilterDepartment] = useState("");
  const [filterRole, setFilterRole] = useState("");
  const [filterDesignation, setFilterDesignation] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const [roleResult, departmentResult, designationResult, staffResult] = await Promise.allSettled([
        apiGet<ApiList<Role>>("/api/v1/access-control/roles/"),
        apiGet<ApiList<Department>>("/api/v1/hr/departments/?is_active=true"),
        apiGet<ApiList<Designation>>("/api/v1/hr/designations/?is_active=true"),
        fetchAllPages<Staff>("/api/v1/hr/staff/"),
      ]);

      // Process roles
      if (roleResult.status === "fulfilled") {
        const payload = roleResult.value as { results?: Role[]; data?: Role[] } | Role[];
        const roleList = Array.isArray(payload)
          ? payload
          : Array.isArray(payload.data)
            ? payload.data
            : payload.results || [];
        setRoles(roleList);
      } else {
        setRoles([]);
      }

      // Process departments
      if (departmentResult.status === "fulfilled") {
        setDepartments(listData(departmentResult.value));
      } else {
        setDepartments([]);
      }

      // Process designations
      if (designationResult.status === "fulfilled") {
        setDesignations(listData(designationResult.value));
      } else {
        setDesignations([]);
      }

      // Process staff
      if (staffResult.status === "fulfilled") {
        setRows(staffResult.value);
      } else {
        setRows([]);
      }

      setCurrentPage(1);

      const dropdownFailures = [roleResult, departmentResult, designationResult].filter((r) => r.status === "rejected");
      const staffFailed = staffResult.status === "rejected";

      if (dropdownFailures.length === 3) {
        setError("Unable to load dropdown options right now. Please refresh the page or check the backend API.");
      } else if (staffFailed) {
        console.warn("Staff rows failed to load:", staffResult.status === "rejected" ? staffResult.reason : "Unknown error");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to load staff directory";
      setError(`ΓÜá∩╕Å Error: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filteredDesignationOptions = useMemo(() => {
    const activeDesignations = designations.filter((designation) => designation.is_active);
    if (!filterDepartment) {
      return activeDesignations;
    }
    return activeDesignations.filter((designation) => designation.department === Number(filterDepartment));
  }, [designations, filterDepartment]);

  // Filtering & searching logic
  const filteredRows = useMemo(() => {
    let result = [...rows];

    // Search filter (Staff No or Name)
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((row) => {
        const staffNo = (row.staff_no || "").toLowerCase();
        const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").toLowerCase();
        return staffNo.includes(query) || fullName.includes(query);
      });
    }

    // Role filter
    if (filterRole) {
      result = result.filter((row) => row.role === Number(filterRole));
    }

    // Department filter
    if (filterDepartment) {
      result = result.filter((row) => row.department === Number(filterDepartment));
    }

    // Designation filter
    if (filterDesignation) {
      result = result.filter((row) => row.designation === Number(filterDesignation));
    }

    // Status filter
    if (filterStatus === "active") {
      result = result.filter((row) => row.status === "active");
    } else if (filterStatus === "inactive") {
      result = result.filter((row) => row.status !== "active");
    }

    // Sort by department name, then by name
    result.sort((a, b) => {
      const deptA = departments.find((d) => d.id === a.department)?.name || "";
      const deptB = departments.find((d) => d.id === b.department)?.name || "";
      if (deptA !== deptB) return deptA.localeCompare(deptB);

      const nameA = [a.first_name, a.last_name].filter(Boolean).join(" ");
      const nameB = [b.first_name, b.last_name].filter(Boolean).join(" ");
      return nameA.localeCompare(nameB);
    });

    return result;
  }, [rows, searchQuery, filterDepartment, filterRole, filterDesignation, filterStatus, departments]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const startIdx = (currentPage - 1) * itemsPerPage;
  const endIdx = startIdx + itemsPerPage;
  const paginatedRows = filteredRows.slice(startIdx, endIdx);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const toggleStaffStatus = async (staffId: number, currentStatus: string) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    try {
      setTogglingStatusId(staffId);
      await apiPatch(`/api/v1/hr/staff/${staffId}/`, { status: newStatus });
      setSuccess(`Staff status updated to ${newStatus}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to update staff status.");
    } finally {
      setTogglingStatusId(null);
    }
  };

  const deleteStaff = async (row: Staff) => {
    const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim() || row.staff_no || `#${row.id}`;
    if (!window.confirm(`Delete staff member \"${fullName}\" (${row.staff_no || "no staff no"})?`)) return;
    try {
      setLoading(true);
      await apiDelete(`/api/v1/hr/staff/${row.id}/`);
      setSuccess("Staff has been deleted successfully.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to delete staff.");
    } finally {
      setLoading(false);
    }
  };

  const refreshStaffList = async () => {
    setSearchQuery("");
    setFilterDepartment("");
    setFilterRole("");
    setFilterDesignation("");
    setFilterStatus("all");
    setCurrentPage(1);
    setSuccess("");
    await load();
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Staff Directory")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <h3 style={{ margin: 0 }}>Staff List</h3>
            <button type="button" style={buttonStyle("#334155")} onClick={() => void refreshStaffList()} disabled={loading}>
              {loading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {/* Messages */}
          {error && <p style={{ color: "var(--warning)", marginTop: 8, marginBottom: 8 }}>{error}</p>}
          {success && <p style={{ color: "#16a34a", marginTop: 8, marginBottom: 8 }}>{success}</p>}

          {/* Search & Filter Controls */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 10, marginBottom: 16, padding: "12px", background: "#f8fafc", borderRadius: 8 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Search (ID or Name)</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search staff..."
                style={{ ...fieldStyle(), width: "100%" }}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Role</label>
              <select
                value={filterRole}
                onChange={(e) => {
                  setFilterRole(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: "100%" }}
              >
                <option value="">All Roles</option>
                {([...roles]
                  .sort((a, b) => a.name.localeCompare(b.name)))
                  .map((role) => (
                    <option key={role.id} value={String(role.id)}>
                      {role.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Department</label>
              <select
                value={filterDepartment}
                onChange={(e) => {
                  setFilterDepartment(e.target.value);
                  setFilterDesignation("");
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: "100%" }}
              >
                <option value="">All Departments</option>
                {departments
                  .filter((d) => d.is_active)
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((dept) => (
                    <option key={dept.id} value={String(dept.id)}>
                      {dept.name}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Designation</label>
              <select
                value={filterDesignation}
                onChange={(e) => {
                  setFilterDesignation(e.target.value);
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: "100%" }}
              >
                <option value="">All Designations</option>
                {filteredDesignationOptions.map((desig) => (
                  <option key={desig.id} value={String(desig.id)}>
                    {desig.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Status</label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as "all" | "active" | "inactive");
                  setCurrentPage(1);
                }}
                style={{ ...fieldStyle(), width: "100%" }}
              >
                <option value="all">All Staff</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* Results info */}
          <div style={{ marginBottom: 12, fontSize: 12, color: "var(--text-muted)" }}>
            Showing {paginatedRows.length === 0 ? "0" : startIdx + 1}ΓÇô{Math.min(endIdx, filteredRows.length)} of {filteredRows.length} staff member{filteredRows.length !== 1 ? "s" : ""}
          </div>

          {/* Table */}
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Staff No</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Name</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Role</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Department</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Designation</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Phone</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Status</th>
                  <th style={{ textAlign: "center", padding: 8, borderBottom: "1px solid var(--line)", fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>
                      {filteredRows.length === 0 ? "No staff found matching your filters." : "No staff found."}
                    </td>
                  </tr>
                ) : (
                  paginatedRows.map((row) => {
                    const roleName = roles.find((r) => r.id === row.role)?.name || "-";
                    const departmentName = departments.find((d) => d.id === row.department)?.name || "-";
                    const designationName = designations.find((d) => d.id === row.designation)?.name || "-";
                    const fullName = [row.first_name, row.last_name].filter(Boolean).join(" ").trim();
                    const isActive = row.status === "active";
                    const rowBackground = isActive ? "transparent" : "#fef2f2";

                    return (
                      <tr
                        key={row.id}
                        style={{
                          background: rowBackground,
                          borderBottom: "1px solid var(--line)",
                          opacity: isActive ? 1 : 0.7,
                        }}
                      >
                        <td style={{ padding: 8 }}>{row.staff_no || "-"}</td>
                        <td style={{ padding: 8, fontWeight: isActive ? 500 : 400 }}>{fullName || "-"}</td>
                        <td style={{ padding: 8 }}>{roleName}</td>
                        <td style={{ padding: 8 }}>{departmentName}</td>
                        <td style={{ padding: 8 }}>{designationName}</td>
                        <td style={{ padding: 8 }}>{row.phone || "-"}</td>
                        <td style={{ padding: 8 }}>
                          <span
                            style={{
                              display: "inline-block",
                              padding: "4px 12px",
                              borderRadius: 999,
                              fontSize: 11,
                              fontWeight: 600,
                              color: isActive ? "#166534" : "#991b1b",
                              background: isActive ? "#dcfce7" : "#fee2e2",
                              border: `1px solid ${isActive ? "#86efac" : "#fca5a5"}`,
                              cursor: "pointer",
                              userSelect: "none",
                            }}
                            onClick={() => void toggleStaffStatus(row.id, row.status)}
                            title="Click to toggle status"
                          >
                            {isActive ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td style={{ padding: 8, textAlign: "center" }}>
                          <div style={{ display: "flex", gap: 4, justifyContent: "center", alignItems: "center" }}>
                            <button
                              type="button"
                              title="Edit staff member"
                              aria-label="Edit staff member"
                              style={{
                                width: 34,
                                height: 34,
                                padding: 0,
                                border: "1px solid #0ea5e9",
                                background: "#0ea5e9",
                                color: "#fff",
                                borderRadius: 6,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onClick={() => {
                                if (typeof window !== "undefined") window.location.href = `/hr/staff?edit=${row.id}`;
                              }}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M12 20h9" />
                                <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              title="Delete staff member"
                              aria-label="Delete staff member"
                              style={{
                                width: 34,
                                height: 34,
                                padding: 0,
                                border: "1px solid #dc2626",
                                background: "#dc2626",
                                color: "#fff",
                                borderRadius: 6,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                              onClick={() => void deleteStaff(row)}
                              disabled={loading}
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M3 6h18" />
                                <path d="M8 6V4h8v2" />
                                <path d="M19 6l-1 14H6L5 6" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                style={buttonStyle("#334155")}
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
              >
                ΓåÉ Previous
              </button>

              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    style={{
                      width: 34,
                      height: 34,
                      border: currentPage === page ? "1px solid var(--primary)" : "1px solid var(--line)",
                      background: currentPage === page ? "var(--primary)" : "var(--surface)",
                      color: currentPage === page ? "#fff" : "var(--text)",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: currentPage === page ? 600 : 400,
                    }}
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>

              <button
                type="button"
                style={buttonStyle("#334155")}
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
              >
                Next ΓåÆ
              </button>
            </div>
          )}
        </div>
      </div></section>
    </div>
  );
}

export function HrLeaveTypesPanel() {
  const [rows, setRows] = useState<LeaveType[]>([]);
  const [name, setName] = useState("");
  const [maxDays, setMaxDays] = useState("1");
  const [isPaid, setIsPaid] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [paidFilter, setPaidFilter] = useState<"all" | "paid" | "unpaid">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [fieldErrors, setFieldErrors] = useState<{ name?: string; max_days_per_year?: string; is_active?: string }>({});
  const formRef = useRef<HTMLDivElement | null>(null);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (paidFilter === "paid" && !row.is_paid) return false;
      if (paidFilter === "unpaid" && row.is_paid) return false;
      if (statusFilter === "active" && !row.is_active) return false;
      if (statusFilter === "inactive" && row.is_active) return false;
      return true;
    });
  }, [rows, paidFilter, statusFilter]);

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: typeof fieldErrors = {};
    const normalizedName = name.trim();
    const parsedDays = Number(maxDays);

    if (!normalizedName) {
      nextErrors.name = "Leave name is required.";
    } else {
      if (normalizedName.length < 3) {
        nextErrors.name = "Leave name must be at least 3 characters.";
      } else if (!/^[A-Za-z ]+$/.test(normalizedName)) {
        nextErrors.name = "Leave name can contain only letters and spaces.";
      }
    }

    if (!maxDays.trim()) {
      nextErrors.max_days_per_year = "Max days is required.";
    } else if (!Number.isFinite(parsedDays)) {
      nextErrors.max_days_per_year = "Max days must be a number.";
    } else if (parsedDays <= 0) {
      nextErrors.max_days_per_year = "Max days must be greater than 0.";
    } else if (parsedDays > 365) {
      nextErrors.max_days_per_year = "Max days cannot exceed 365.";
    }

    if (isPaid && Number.isFinite(parsedDays) && parsedDays <= 0) {
      nextErrors.max_days_per_year = "Paid leave must have max days greater than 0.";
    }

    return nextErrors;
  };

  const mapApiMessageToField = (message: string): keyof typeof fieldErrors | null => {
    const lowered = message.toLowerCase();
    if (lowered.includes("duplicate") || lowered.includes("already exists") || lowered.includes("already exist")) return "name";
    if (lowered.includes("name") || lowered.includes("leave type")) return "name";
    if (lowered.includes("max") || lowered.includes("days")) return "max_days_per_year";
    if (lowered.includes("active") || lowered.includes("deactivate")) return "is_active";
    return null;
  };

  const load = async () => {
    try {
      setError("");
      const data = await apiGet<ApiList<LeaveType>>("/api/v1/hr/leave-types/");
      setRows(listData(data));
    } catch {
      setError("Unable to load leave types.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("");
      setToast("");
      return;
    }

    try {
      setSaving(true);
      setFieldErrors({});
      setError("");
      setToast("");
      const payload = { name: name.trim(), max_days_per_year: Number(maxDays || "0"), is_paid: isPaid, is_active: isActive };
      if (editingId) {
        await apiPatch(`/api/v1/hr/leave-types/${editingId}/`, payload);
        setToast("Leave type updated successfully.");
      } else {
        await apiPost("/api/v1/hr/leave-types/", payload);
        setToast("Leave type created successfully.");
      }
      setEditingId(null);
      setName("");
      setMaxDays("1");
      setIsPaid(true);
      setIsActive(true);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      const field = mapApiMessageToField(message);
      if (field) {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Types of Leaves")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div ref={formRef} className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Leave Type" : "Add Different Types of Leaves"}</h3>
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1.2fr 180px auto auto auto", gap: 8, alignItems: "start" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Leave Reason *</label>
              <input value={name} onChange={(e) => { setName(e.target.value); clearFieldError("name"); }} placeholder="e.g. Casual Leave" style={{ ...fieldStyle(), borderColor: fieldErrors.name ? "#dc2626" : "var(--line)" }} />
              {fieldErrors.name ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.name}</span> : null}
            </div>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Max Days *</label>
              <input type="number" min="1" step="1" value={maxDays} onChange={(e) => { setMaxDays(e.target.value); clearFieldError("max_days_per_year"); }} placeholder="1 or more" style={{ ...fieldStyle(), borderColor: fieldErrors.max_days_per_year ? "#dc2626" : "var(--line)" }} />
              {fieldErrors.max_days_per_year ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.max_days_per_year}</span> : null}
            </div>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: "end" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Type</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, height: 36 }}><input type="checkbox" checked={isPaid} onChange={(e) => setIsPaid(e.target.checked)} /> Paid</span>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, alignSelf: "end" }}>
              <span style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Status</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, height: 36 }}><input type="checkbox" checked={isActive} onChange={(e) => { setIsActive(e.target.checked); clearFieldError("is_active"); }} /> Active</span>
            </label>
            <div style={{ display: "flex", gap: 8, alignItems: "end" }}>
              <button type="submit" style={buttonStyle()} disabled={saving}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
              <button type="button" style={buttonStyle("#6b7280")} onClick={() => {
                setEditingId(null);
                setName("");
                setMaxDays("1");
                setIsPaid(true);
                setIsActive(true);
                setFieldErrors({});
                setError("");
                setToast("");
              }} disabled={saving}>
                Reset
              </button>
            </div>
          </form>
          {fieldErrors.is_active ? <p style={{ color: "#dc2626", marginTop: 8, marginBottom: 0 }}>{fieldErrors.is_active}</p> : null}
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Paid Filter</label>
              <select value={paidFilter} onChange={(e) => setPaidFilter(e.target.value as "all" | "paid" | "unpaid")} style={fieldStyle()}>
                <option value="all">All Types</option>
                <option value="paid">Paid Only</option>
                <option value="unpaid">Unpaid Only</option>
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600, display: "block", marginBottom: 4 }}>Status Filter</label>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")} style={fieldStyle()}>
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "end", gap: 8 }}>
              <button type="button" style={buttonStyle("#334155")} onClick={() => { setPaidFilter("all"); setStatusFilter("all"); }}>
                Clear Filters
              </button>
            </div>
          </div>

          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Max Days</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Paid</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} style={{ background: row.is_active ? "transparent" : "#fef2f2" }}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.max_days_per_year}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.is_paid ? "Yes" : "No"}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: row.is_active ? "#166534" : "#991b1b", background: row.is_active ? "#dcfce7" : "#fee2e2", border: `1px solid ${row.is_active ? "#86efac" : "#fca5a5"}` }}>
                      {row.is_active ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button type="button" style={buttonStyle("#0ea5e9")} onClick={() => {
                        setEditingId(row.id);
                        setName(row.name);
                        setMaxDays(String(row.max_days_per_year));
                        setIsPaid(row.is_paid);
                        setIsActive(row.is_active);
                        setError("");
                        setToast("");
                        formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                      }}>Edit</button>
                      <button
                        type="button"
                        style={buttonStyle("#dc2626")}
                        disabled={deletingId === row.id}
                        onClick={() => {
                          if (!window.confirm(`Delete leave type \"${row.name}\"?`)) return;
                          setDeletingId(row.id);
                          void apiDelete(`/api/v1/hr/leave-types/${row.id}/`)
                            .then(async () => {
                              setToast("Leave type deleted successfully.");
                              setError("");
                              await load();
                            })
                            .catch((err) => {
                              setError(err instanceof Error ? err.message : "Validation failed");
                            })
                            .finally(() => setDeletingId(null));
                        }}
                      >
                        {deletingId === row.id ? "Deleting..." : "Delete"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, textAlign: "center", color: "var(--text-muted)" }}>
                    No leave types found for the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div></section>
    </div>
  );
}

export function HrLeaveDefinePanel() {
  const [rows, setRows] = useState<LeaveDefine[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [staffRows, setStaffRows] = useState<Staff[]>([]);
  const [studentRows, setStudentRows] = useState<Student[]>([]);
  const [classRows, setClassRows] = useState<SchoolClassOption[]>([]);
  const [sectionRows, setSectionRows] = useState<SectionOption[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [studentLoading, setStudentLoading] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [staffFilter, setStaffFilter] = useState("all");
  const [leaveTypeFilter, setLeaveTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "role" | "staff" | "student">("all");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;
  const formRef = useRef<HTMLDivElement | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    role?: string;
    staff?: string;
    school_class?: string;
    section?: string;
    student?: string;
    leave_type?: string;
    days?: string;
  }>({});

  const [roleId, setRoleId] = useState("");
  const [scopeType, setScopeType] = useState<"all" | "class" | "individual">("all");
  const [staffId, setStaffId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [studentId, setStudentId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [days, setDays] = useState("0");

  const selectedRole = roles.find((item) => String(item.id) === roleId);
  const isStudentRole = !!selectedRole && selectedRole.name.trim().toLowerCase() === "student";
  const filteredRows = useMemo(() => {
    let items = [...rows];

    if (searchQuery.trim()) {
      const query = searchQuery.trim().toLowerCase();
      items = items.filter((item) => {
        const scopeText = [item.role_name, item.staff_name, item.student_name, item.class_name, item.section_name, item.leave_type_name]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return scopeText.includes(query) || String(item.days).includes(query);
      });
    }

    if (roleFilter !== "all") {
      items = items.filter((item) => String(item.role || "") === roleFilter || item.role_name === roleFilter);
    }

    if (staffFilter !== "all") {
      items = items.filter((item) => String(item.staff || "") === staffFilter || item.staff_name === staffFilter);
    }

    if (leaveTypeFilter !== "all") {
      items = items.filter((item) => String(item.leave_type || "") === leaveTypeFilter || item.leave_type_name === leaveTypeFilter);
    }

    if (statusFilter === "role") {
      items = items.filter((item) => !!item.role && !item.staff && !item.student);
    } else if (statusFilter === "staff") {
      items = items.filter((item) => !!item.staff);
    } else if (statusFilter === "student") {
      items = items.filter((item) => !!item.student || !!item.school_class || !!item.section);
    }

    items.sort((a, b) => {
      const priority = (row: LeaveDefine) => (row.staff ? 0 : row.student ? 1 : 2);
      const pDiff = priority(a) - priority(b);
      if (pDiff !== 0) return pDiff;
      const typeDiff = (a.leave_type_name || "").localeCompare(b.leave_type_name || "");
      if (typeDiff !== 0) return typeDiff;
      return Number(a.days) - Number(b.days);
    });

    return items;
  }, [rows, searchQuery, roleFilter, staffFilter, leaveTypeFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / itemsPerPage));
  const paginatedRows = filteredRows.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, staffFilter, leaveTypeFilter, statusFilter]);

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sectionRows.filter((item) => String(item.school_class || "") === classId);
  }, [sectionRows, classId]);
  const filteredStudents = useMemo(() => {
    return studentRows.filter((item) => {
      if (classId && String(item.current_class || "") !== classId) return false;
      if (sectionId && String(item.current_section || "") !== sectionId) return false;
      return true;
    });
  }, [studentRows, classId, sectionId]);

  const noLeaveDefinitions = !loading && !error && rows.length === 0;

  const mapLoadError = (message: string) => {
    const lowered = message.toLowerCase();
    if (lowered.includes("permission") || lowered.includes("forbidden") || lowered.includes("403")) {
      return "You do not have permission to view this data.";
    }
    if (lowered.includes("failed to fetch") || lowered.includes("network")) {
      return "Network error. Please check your connection.";
    }
    return "Unable to load leave data. Please try again.";
  };

  const fieldIdMap: Record<keyof typeof fieldErrors, string> = {
    role: "leave-define-role",
    staff: "leave-define-staff",
    school_class: "leave-define-class",
    section: "leave-define-section",
    student: "leave-define-student",
    leave_type: "leave-define-leave-type",
    days: "leave-define-days",
  };

  const scrollToFirstError = (errors: typeof fieldErrors) => {
    const firstField = (Object.keys(errors) as Array<keyof typeof fieldErrors>).find((key) => !!errors[key]);
    if (!firstField) return;
    const elementId = fieldIdMap[firstField];
    const element = document.getElementById(elementId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.focus();
  };

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validateForm = () => {
    const nextErrors: typeof fieldErrors = {};
    const parsedDays = Number(days);

    if (!roleId && !staffId) {
      nextErrors.role = "Select either role or staff.";
      nextErrors.staff = "Select either role or staff.";
    }
    if (roleId && staffId && !isStudentRole) {
      nextErrors.role = "Choose either role or staff, not both.";
      nextErrors.staff = "Choose either role or staff, not both.";
    }
    if (isStudentRole) {
      if (staffId) {
        nextErrors.staff = "Staff selection is not allowed for Student role.";
      }
      if (scopeType === "class") {
        if (!classId) {
          nextErrors.school_class = "Class is required for class scope.";
        }
        if (!sectionId) {
          nextErrors.section = "Section is required for class scope.";
        }
      }
      if (scopeType === "individual") {
        if (!classId) {
          nextErrors.school_class = "Class is required for individual scope.";
        }
        if (!sectionId) {
          nextErrors.section = "Section is required for individual scope.";
        }
        if (!studentId) {
          nextErrors.student = "Student is required for individual scope.";
        }
      }
    } else if (studentId) {
      nextErrors.student = "Student can be selected only when role is Student.";
    } else if (classId || sectionId) {
      nextErrors.school_class = "Class/Section can be selected only when role is Student.";
    }
    if (!leaveTypeId) {
      nextErrors.leave_type = "Leave type is required.";
    }
    if (!days.trim()) {
      nextErrors.days = "Days is required.";
    } else if (!Number.isInteger(parsedDays)) {
      nextErrors.days = "Days must be an integer.";
    } else if (parsedDays <= 0) {
      nextErrors.days = "Days must be greater than 0";
    }

    return nextErrors;
  };

  const mapApiMessageToField = (message: string): keyof typeof fieldErrors | null => {
    const lowered = message.toLowerCase();
    if (lowered.includes("role")) return "role";
    if (lowered.includes("staff")) return "staff";
    if (lowered.includes("class")) return "school_class";
    if (lowered.includes("section")) return "section";
    if (lowered.includes("student")) return "student";
    if (lowered.includes("leave type")) return "leave_type";
    if (lowered.includes("days")) return "days";
    return null;
  };

  const resetForm = () => {
    setEditingId(null);
    setRoleId("");
    setStaffId("");
    setClassId("");
    setSectionId("");
    setStudentId("");
    setLeaveTypeId("");
    setDays("0");
    setScopeType("all");
    setFieldErrors({});
    setError("");
    setToast("");
  };

  const loadStaffByRole = async (selectedRoleId: string) => {
    setStaffLoading(true);
    try {
      const endpoint = selectedRoleId
        ? `/api/v1/hr/staff/?status=active&role=${selectedRoleId}`
        : "/api/v1/hr/staff/?status=active";
      const staffData = await apiGet<ApiList<Staff>>(endpoint);
      const items = listData(staffData);
      if (selectedRoleId) {
        const selectedRoleNumber = Number(selectedRoleId);
        setStaffRows(items.filter((item) => item.role === selectedRoleNumber));
      } else {
        setStaffRows(items);
      }
    } catch {
      setStaffRows([]);
    } finally {
      setStaffLoading(false);
    }
  };

  const loadStudents = async () => {
    setStudentLoading(true);
    try {
      const studentData = await apiGet<ApiList<Student>>("/api/v1/students/students/");
      const items = listData(studentData);
      setStudentRows(items.filter((item) => item.is_active));
    } catch {
      setStudentRows([]);
    } finally {
      setStudentLoading(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [defineDataResult, roleDataResult, leaveTypeDataResult] = await Promise.allSettled([
        apiGet<ApiList<LeaveDefine>>("/api/v1/hr/leave-defines/"),
        apiGet<ApiList<Role>>("/api/v1/access-control/roles/"),
        apiGet<ApiList<LeaveType>>("/api/v1/hr/leave-types/?is_active=true"),
      ]);

      const [classDataResult, sectionDataResult] = await Promise.allSettled([
        apiGet<ApiList<SchoolClassOption>>("/api/v1/core/classes/"),
        apiGet<ApiList<SectionOption>>("/api/v1/core/sections/"),
      ]);

      if (defineDataResult.status === "fulfilled") {
        setRows(listData(defineDataResult.value));
      } else {
        setRows([]);
      }

      if (roleDataResult.status === "fulfilled") {
        setRoles(listData(roleDataResult.value));
      } else {
        setRoles([]);
      }

      if (leaveTypeDataResult.status === "fulfilled") {
        setLeaveTypes(listData(leaveTypeDataResult.value));
      } else {
        setLeaveTypes([]);
      }

      if (classDataResult.status === "fulfilled") {
        setClassRows(listData(classDataResult.value));
      } else {
        setClassRows([]);
      }

      if (sectionDataResult.status === "fulfilled") {
        setSectionRows(listData(sectionDataResult.value));
      } else {
        setSectionRows([]);
      }

      await Promise.all([loadStaffByRole(roleId), loadStudents()]);

      if (
        defineDataResult.status === "rejected"
        || roleDataResult.status === "rejected"
        || leaveTypeDataResult.status === "rejected"
        || classDataResult.status === "rejected"
        || sectionDataResult.status === "rejected"
      ) {
        const firstRejected = [
          defineDataResult,
          roleDataResult,
          leaveTypeDataResult,
          classDataResult,
          sectionDataResult,
        ].find((item) => item.status === "rejected");
        const errorMessage = firstRejected && firstRejected.status === "rejected"
          ? (firstRejected.reason instanceof Error ? firstRejected.reason.message : String(firstRejected.reason || ""))
          : "";
        setError(mapLoadError(errorMessage));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(mapLoadError(message));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    void loadStaffByRole(roleId);
  }, [roleId]);

  useEffect(() => {
    if (!isStudentRole) {
      return;
    }

    if (scopeType === "all") {
      setClassId("");
      setSectionId("");
      setStudentId("");
    }
    if (scopeType === "class") {
      setStudentId("");
    }
  }, [scopeType, isStudentRole]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("");
      setToast("");
      scrollToFirstError(nextErrors);
      return;
    }

    try {
      setSaving(true);
      setFieldErrors({});
      setError("");
      setToast("");
      const payload = {
        role: roleId ? Number(roleId) : null,
        staff: staffId ? Number(staffId) : null,
        school_class: classId ? Number(classId) : null,
        section: sectionId ? Number(sectionId) : null,
        student: studentId ? Number(studentId) : null,
        leave_type: Number(leaveTypeId),
        days: Number(days || "0"),
      };
      if (editingId) {
        await apiPatch(`/api/v1/hr/leave-defines/${editingId}/`, payload);
        setToast("Leave policy updated successfully.");
      } else {
        await apiPost("/api/v1/hr/leave-defines/", payload);
        setToast("Leave policy created successfully.");
      }
      resetForm();
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Validation failed";
      const field = mapApiMessageToField(message);
      if (field) {
        setFieldErrors((prev) => ({ ...prev, [field]: message }));
      }
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Define Leave Policy")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div ref={formRef} className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Leave Policy" : "Add Leave Policy"}</h3>
          <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
            {/* Scope Selection */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>1. Scope Selection</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Role *</label>
                  <select
                    id="leave-define-role"
                    value={roleId}
                    onChange={(e) => {
                      const value = e.target.value;
                      const nextRole = roles.find((item) => String(item.id) === value);
                      const nextIsStudentRole = !!nextRole && nextRole.name.trim().toLowerCase() === "student";
                      setRoleId(value);
                      clearFieldError("role");
                      if (value && !nextIsStudentRole) {
                        setStaffId("");
                        setStudentId("");
                      }
                      if (nextIsStudentRole) {
                        setScopeType("all");
                        setStaffId("");
                        clearFieldError("staff");
                      } else {
                        setClassId("");
                        setSectionId("");
                        setStudentId("");
                        clearFieldError("school_class");
                        clearFieldError("section");
                        clearFieldError("student");
                      }
                    }}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.role ? "#dc2626" : "var(--line)" }}
                  >
                    <option value="">Select Role</option>
                    {roles.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {fieldErrors.role ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.role}</span> : null}
                </div>

                {isStudentRole ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Scope</label>
                    <select
                      id="leave-define-scope"
                      value={scopeType}
                      onChange={(e) => setScopeType(e.target.value as "all" | "class" | "individual")}
                      style={fieldStyle()}
                    >
                      <option value="all">All Students</option>
                      <option value="class">Class / Section</option>
                      <option value="individual">Individual Student</option>
                    </select>
                  </div>
                ) : (
                  <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Staff *</label>
                    <select
                      id="leave-define-staff"
                      value={staffId}
                      onChange={(e) => { setStaffId(e.target.value); clearFieldError("staff"); if (e.target.value) setRoleId(""); }}
                      style={{ ...fieldStyle(), borderColor: fieldErrors.staff ? "#dc2626" : "var(--line)" }}
                      disabled={staffLoading || isStudentRole}
                    >
                      <option value="">{staffLoading ? "Loading staff..." : "Select Staff"}</option>
                      {staffRows.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
                    </select>
                    {fieldErrors.staff ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.staff}</span> : null}
                  </div>
                )}
              </div>
            </div>

            {/* Filters */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>2. Search and Filters</h4>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 10 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Search</label>
                  <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Search by role, staff, leave type" style={fieldStyle()} />
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Role Filter</label>
                  <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={fieldStyle()}>
                    <option value="all">All Roles</option>
                    {roles.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Staff Filter</label>
                  <select value={staffFilter} onChange={(e) => setStaffFilter(e.target.value)} style={fieldStyle()}>
                    <option value="all">All Staff</option>
                    {staffRows.map((item) => <option key={item.id} value={String(item.id)}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Leave Type Filter</label>
                  <select value={leaveTypeFilter} onChange={(e) => setLeaveTypeFilter(e.target.value)} style={fieldStyle()}>
                    <option value="all">All Leave Types</option>
                    {leaveTypes.map((item) => <option key={item.id} value={String(item.id)}>{item.name}</option>)}
                  </select>
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Scope Filter</label>
                  <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "role" | "staff" | "student")} style={fieldStyle()}>
                    <option value="all">All Records</option>
                    <option value="role">Role Based</option>
                    <option value="staff">Staff Specific</option>
                    <option value="student">Student Based</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "end" }}>
                  <button type="button" style={buttonStyle("#6b7280")} onClick={() => { setSearchQuery(""); setRoleFilter("all"); setStaffFilter("all"); setLeaveTypeFilter("all"); setStatusFilter("all"); setCurrentPage(1); }}>
                    Clear Filters
                  </button>
                </div>
              </div>
            </div>

            {isStudentRole ? (
              <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>3. Student Scope Details</h4>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                  {scopeType !== "all" ? (
                    <>
                      <div style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Class</label>
                        <select
                          id="leave-define-class"
                          value={classId}
                          onChange={(e) => {
                            setClassId(e.target.value);
                            setSectionId("");
                            setStudentId("");
                            clearFieldError("school_class");
                            clearFieldError("section");
                            clearFieldError("student");
                          }}
                          style={{ ...fieldStyle(), borderColor: fieldErrors.school_class ? "#dc2626" : "var(--line)" }}
                        >
                          <option value="">Select Class</option>
                          {classRows.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        {fieldErrors.school_class ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.school_class}</span> : null}
                      </div>

                      <div style={{ display: "grid", gap: 4 }}>
                        <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Section</label>
                        <select
                          id="leave-define-section"
                          value={sectionId}
                          onChange={(e) => {
                            setSectionId(e.target.value);
                            setStudentId("");
                            clearFieldError("section");
                            clearFieldError("student");
                          }}
                          style={{ ...fieldStyle(), borderColor: fieldErrors.section ? "#dc2626" : "var(--line)" }}
                          disabled={!classId}
                        >
                          <option value="">{classId ? "Select Section" : "Select Class first"}</option>
                          {filteredSections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        {fieldErrors.section ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.section}</span> : null}
                      </div>
                    </>
                  ) : (
                    <div style={{ gridColumn: "1 / span 2", color: "var(--text-muted)", fontSize: 13 }}>
                      Leave will be applied to all students.
                    </div>
                  )}

                  {scopeType === "individual" ? (
                    <div style={{ display: "grid", gap: 4 }}>
                      <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Student</label>
                      <select
                        id="leave-define-student"
                        value={studentId}
                        onChange={(e) => { setStudentId(e.target.value); clearFieldError("student"); }}
                        style={{ ...fieldStyle(), borderColor: fieldErrors.student ? "#dc2626" : "var(--line)" }}
                        disabled={studentLoading || !classId || !sectionId}
                      >
                        <option value="">{studentLoading ? "Loading students..." : !classId || !sectionId ? "Select class and section first" : "Select Student"}</option>
                        {filteredStudents.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.admission_no})</option>)}
                      </select>
                      {fieldErrors.student ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.student}</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            {/* Leave Details */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>4. Leave Allocation Details</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Leave Type *</label>
                  <select id="leave-define-leave-type" value={leaveTypeId} onChange={(e) => { setLeaveTypeId(e.target.value); clearFieldError("leave_type"); }} style={{ ...fieldStyle(), borderColor: fieldErrors.leave_type ? "#dc2626" : "var(--line)" }}>
                    <option value="">Select Leave Type</option>
                    {leaveTypes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {fieldErrors.leave_type ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.leave_type}</span> : null}
                </div>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Days *</label>
                  <input id="leave-define-days" type="number" min="1" step="1" value={days} onChange={(e) => { setDays(e.target.value); clearFieldError("days"); }} placeholder="Enter days greater than 0" style={{ ...fieldStyle(), borderColor: fieldErrors.days ? "#dc2626" : "var(--line)" }} />
                  {fieldErrors.days ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.days}</span> : null}
                </div>
              </div>
            </div>

            {/* Save Action */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "flex", justifyContent: "flex-end" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <button type="button" style={buttonStyle("#6b7280")} onClick={resetForm} disabled={saving || loading}>Reset</button>
                <button type="submit" style={buttonStyle()} disabled={saving || loading}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
              </div>
            </div>
          </form>
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 8, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Leave Allocation Rules</h3>
            <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
              Showing {paginatedRows.length === 0 ? 0 : (currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, filteredRows.length)} of {filteredRows.length}
            </div>
          </div>
          <p style={{ marginTop: 0, marginBottom: 10, color: "var(--text-muted)", fontSize: 12 }}>
            Priority order: staff-specific rules override student-based rules, which override role-based rules.
          </p>
          {loading ? <p style={{ marginTop: 0, color: "var(--text-muted)" }}>Loading leave policy data...</p> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Scope</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Leave Type</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Days</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Priority</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {noLeaveDefinitions ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--line)" }}>
                    No leave definitions found.
                  </td>
                </tr>
              ) : null}
              {paginatedRows.map((row) => (
                <tr key={row.id} style={{ background: row.staff ? "#ecfeff" : row.student ? "#f5f3ff" : "transparent" }}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    {row.student_name
                      ? `${row.student_name} (${row.class_name || "-"}/${row.section_name || "-"})`
                      : row.class_name && row.section_name
                        ? `Students: ${row.class_name} - ${row.section_name}`
                        : row.role_name === "Student"
                          ? "All Students"
                          : row.role_name || row.staff_name || "-"}
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.leave_type_name || row.leave_type}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.days}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, color: row.staff ? "#0f766e" : row.student ? "#6d28d9" : "#475569", background: row.staff ? "#ccfbf1" : row.student ? "#ede9fe" : "#e2e8f0" }}>
                      {row.staff ? "Staff priority" : row.student ? "Student priority" : "Role priority"}
                    </span>
                  </td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      <button
                        type="button"
                        style={buttonStyle("#0ea5e9")}
                        onClick={() => {
                          if (row.role_name === "Student") {
                            if (row.student) {
                              setScopeType("individual");
                            } else if (row.school_class && row.section) {
                              setScopeType("class");
                            } else {
                              setScopeType("all");
                            }
                          }
                          setEditingId(row.id);
                          setRoleId(row.role ? String(row.role) : "");
                          setStaffId(row.staff ? String(row.staff) : "");
                          setClassId(row.school_class ? String(row.school_class) : "");
                          setSectionId(row.section ? String(row.section) : "");
                          setStudentId(row.student ? String(row.student) : "");
                          setLeaveTypeId(String(row.leave_type));
                          setDays(String(row.days));
                          setError("");
                          setToast("");
                          formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                        }}
                      >
                        Edit
                      </button>
                      <button type="button" style={buttonStyle("#dc2626")} onClick={() => {
                        const scopeLabel = row.student_name
                          ? row.student_name
                          : row.staff_name
                            ? row.staff_name
                            : row.role_name || "rule";
                        if (!window.confirm(`Delete leave policy for \"${scopeLabel}\" (${row.leave_type_name || row.leave_type})?`)) return;
                        void apiDelete(`/api/v1/hr/leave-defines/${row.id}/`).then(async () => {
                          setToast("Leave policy deleted successfully.");
                          await load();
                        }).catch((err) => setError(err instanceof Error ? err.message : "Unable to delete leave policy."));
                      }}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {paginatedRows.length === 0 && filteredRows.length > 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: 12, textAlign: "center", color: "var(--text-muted)" }}>
                    No leave definitions match the selected filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
          {totalPages > 1 ? (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 14 }}>
              <button type="button" style={buttonStyle("#334155")} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Previous</button>
              <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    style={{ width: 34, height: 34, border: currentPage === page ? "1px solid var(--primary)" : "1px solid var(--line)", background: currentPage === page ? "var(--primary)" : "var(--surface)", color: currentPage === page ? "#fff" : "var(--text)", borderRadius: 6, cursor: "pointer" }}
                  >
                    {page}
                  </button>
                ))}
              </div>
              <button type="button" style={buttonStyle("#334155")} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Next</button>
            </div>
          ) : null}
        </div>
      </div></section>
    </div>
  );
}

export function HrStaffAttendancePanel() {
  const [staffRows, setStaffRows] = useState<Staff[]>([]);
  const [rows, setRows] = useState<StaffAttendance[]>([]);
  const [report, setReport] = useState<AttendanceReport | null>(null);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [attendanceDateError, setAttendanceDateError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "P" | "A" | "L" | "F" | "H">("all");
  const [currentPage, setCurrentPage] = useState(1);

  const [statusByStaff, setStatusByStaff] = useState<Record<number, "P" | "A" | "L" | "F" | "H">>({});
  const [noteByStaff, setNoteByStaff] = useState<Record<number, string>>({});
  const [noteErrorsByStaff, setNoteErrorsByStaff] = useState<Record<number, string>>({});

  const PAGE_SIZE = 25;
  const MAX_NOTE_LENGTH = 200;
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const statusLabel: Record<string, string> = {
    P: "Present",
    A: "Absent",
    L: "Leave",
    F: "Half Day",
    H: "Holiday",
  };

  const isWeekend = useMemo(() => {
    if (!attendanceDate) return false;
    const day = new Date(`${attendanceDate}T00:00:00`).getDay();
    return day === 0 || day === 6;
  }, [attendanceDate]);

  const fetchAllPages = async <T,>(path: string): Promise<T[]> => {
    const merged: T[] = [];
    let nextPath = path;

    for (let i = 0; i < 50 && nextPath; i += 1) {
      const data = await apiGet<ApiList<T> & { next?: string | null }>(nextPath);
      merged.push(...listData<T>(data));

      const nextRaw = (data as { next?: string | null }).next;
      if (!nextRaw) {
        nextPath = "";
        continue;
      }

      if (nextRaw.startsWith("http")) {
        try {
          const nextUrl = new URL(nextRaw);
          nextPath = `${nextUrl.pathname}${nextUrl.search}`;
        } catch {
          nextPath = "";
        }
      } else {
        nextPath = nextRaw;
      }
    }

    return merged;
  };

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const [staffList, attendanceList, reportData] = await Promise.all([
        fetchAllPages<Staff>("/api/v1/hr/staff/?status=active"),
        fetchAllPages<StaffAttendance>(`/api/v1/hr/staff-attendance/?attendance_date=${attendanceDate}`),
        apiGet<AttendanceReport>(`/api/v1/hr/staff-attendance/report/?attendance_date=${attendanceDate}`),
      ]);

      const statusMap: Record<number, "P" | "A" | "L" | "F" | "H"> = {};
      const noteMap: Record<number, string> = {};
      attendanceList.forEach((item) => {
        statusMap[item.staff] = item.attendance_type;
        noteMap[item.staff] = item.note || "";
      });

      setStaffRows(staffList);
      setRows(attendanceList);
      setReport(reportData);
      setStatusByStaff(statusMap);
      setNoteByStaff(noteMap);
      setNoteErrorsByStaff({});
    } catch {
      setError("Unable to load staff attendance.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [attendanceDate]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter, attendanceDate]);

  const filteredStaffRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return staffRows.filter((staff) => {
      const status = statusByStaff[staff.id] || "P";
      const matchesSearch = !term
        || `${staff.first_name} ${staff.last_name}`.toLowerCase().includes(term)
        || (staff.staff_no || "").toLowerCase().includes(term);
      const matchesStatus = statusFilter === "all" || status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [staffRows, statusByStaff, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredStaffRows.length / PAGE_SIZE));
  const paginatedStaffRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredStaffRows.slice(start, start + PAGE_SIZE);
  }, [filteredStaffRows, currentPage]);

  const liveSummary = useMemo(() => {
    const byType: Record<string, number> = { P: 0, A: 0, L: 0, F: 0, H: 0 };
    staffRows.forEach((staff) => {
      const code = statusByStaff[staff.id] || "P";
      byType[code] = (byType[code] || 0) + 1;
    });
    return {
      total: staffRows.length,
      by_type: byType,
    };
  }, [staffRows, statusByStaff]);

  const setBulkStatus = (status: "P" | "A" | "L" | "F" | "H") => {
    setStatusByStaff((prev) => {
      const next = { ...prev };
      staffRows.forEach((staff) => {
        next[staff.id] = status;
      });
      return next;
    });
    setToast(`All employees marked as ${statusLabel[status]}.`);
  };

  const onNoteChange = (staffId: number, value: string) => {
    if (value.length > MAX_NOTE_LENGTH) {
      setNoteErrorsByStaff((prev) => ({ ...prev, [staffId]: `Maximum ${MAX_NOTE_LENGTH} characters allowed.` }));
      return;
    }

    setNoteByStaff((prev) => ({ ...prev, [staffId]: value }));
    setNoteErrorsByStaff((prev) => ({ ...prev, [staffId]: "" }));
  };

  const saveAttendance = async () => {
    if (!attendanceDate) {
      setAttendanceDateError("Attendance date is required.");
      setError("Please select attendance date.");
      return;
    }

    if (attendanceDate > today) {
      setAttendanceDateError("Future dates are not allowed.");
      setError("Attendance date cannot be in the future.");
      return;
    }

    if (Object.values(noteErrorsByStaff).some((message) => !!message)) {
      setError("Please fix note validation errors before saving.");
      return;
    }

    if (staffRows.length === 0) {
      setError("No active employees found for attendance.");
      return;
    }

    if (!window.confirm(`Save attendance for ${staffRows.length} employees on ${attendanceDate}?`)) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      const payload = {
        rows: staffRows.map((staff) => ({
          staff: staff.id,
          attendance_date: attendanceDate,
          attendance_type: statusByStaff[staff.id] || "P",
          note: (noteByStaff[staff.id] || "").trim(),
        })),
      };
      const response = await apiPost<{ detail?: string; count?: number }>("/api/v1/hr/staff-attendance/bulk-store/", payload);
      await load();
      setToast(response?.detail ? `${response.detail} (${response?.count || 0} rows)` : "Attendance saved successfully.");
    } catch {
      setError("Unable to save staff attendance.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Staff Attendance")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Attendance Date</h3>
          <div style={{ display: "grid", gridTemplateColumns: "220px auto auto", gap: 8, alignItems: "end" }}>
            <div style={{ display: "grid", gap: 4 }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Date *</label>
              <input
                type="date"
                value={attendanceDate}
                max={today}
                onChange={(e) => {
                  setAttendanceDate(e.target.value);
                  setAttendanceDateError("");
                  setError("");
                }}
                style={{ ...fieldStyle(), borderColor: attendanceDateError ? "#dc2626" : "var(--line)" }}
              />
              {attendanceDateError ? <span style={{ color: "#dc2626", fontSize: 12 }}>{attendanceDateError}</span> : null}
            </div>
            <button type="button" style={buttonStyle("#0ea5e9")} onClick={() => void load()} disabled={loading || saving}>{loading ? "Loading..." : "Load"}</button>
            <button type="button" style={buttonStyle()} onClick={() => void saveAttendance()} disabled={loading || saving}>{saving ? "Saving..." : "Save Attendance"}</button>
          </div>
          <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" style={buttonStyle("#059669")} onClick={() => setBulkStatus("P")} disabled={loading || saving}>Mark All Present</button>
            <button type="button" style={buttonStyle("#dc2626")} onClick={() => setBulkStatus("A")} disabled={loading || saving}>Mark All Absent</button>
            <button type="button" style={buttonStyle("#d97706")} onClick={() => setBulkStatus("L")} disabled={loading || saving}>Mark All Leave</button>
            <button type="button" style={buttonStyle("#0f766e")} onClick={() => setBulkStatus("F")} disabled={loading || saving}>Mark All Half Day</button>
            <button type="button" style={buttonStyle("#334155")} onClick={() => setBulkStatus("H")} disabled={loading || saving}>Mark All Holiday</button>
          </div>
          {isWeekend ? <p style={{ color: "#d97706", marginTop: 8, marginBottom: 0 }}>Selected date is a weekend. You can use "Mark All Holiday" if this is a non-working day.</p> : null}
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {toast ? <p style={{ color: "#16a34a", marginTop: 8 }}>{toast}</p> : null}
        </div>

        {(report || liveSummary) && (
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Attendance Summary (Live)</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0, 1fr))", gap: 8 }}>
              <div>Total: <strong>{liveSummary.total}</strong></div>
              <div>Present: <strong>{liveSummary.by_type?.P || 0}</strong></div>
              <div>Absent: <strong>{liveSummary.by_type?.A || 0}</strong></div>
              <div>Leave: <strong>{liveSummary.by_type?.L || 0}</strong></div>
              <div>Half Day: <strong>{liveSummary.by_type?.F || 0}</strong></div>
              <div>Holiday: <strong>{liveSummary.by_type?.H || 0}</strong></div>
            </div>
            <p style={{ marginTop: 8, marginBottom: 0, color: "var(--text-muted)", fontSize: 12 }}>Saved snapshot for selected date: {report?.total || 0} records.</p>
          </div>
        )}

        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>Mark Attendance</h3>
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name or staff no" style={{ ...fieldStyle(), width: 240 }} />
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | "P" | "A" | "L" | "F" | "H")} style={{ ...fieldStyle(), width: 180 }}>
                <option value="all">All Statuses</option>
                <option value="P">Present</option>
                <option value="A">Absent</option>
                <option value="L">Leave</option>
                <option value="F">Half Day</option>
                <option value="H">Holiday</option>
              </select>
            </div>
          </div>

          <p style={{ marginTop: 0, marginBottom: 8, color: "var(--text-muted)", fontSize: 12 }}>
            Showing {paginatedStaffRows.length} of {filteredStaffRows.length} filtered employees ({staffRows.length} total).
          </p>

          <div style={{ maxHeight: 520, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8 }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, background: "#f8fafc", textAlign: "left", padding: 10, borderBottom: "1px solid var(--line)" }}>Staff</th>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, background: "#f8fafc", textAlign: "left", padding: 10, borderBottom: "1px solid var(--line)" }}>Status *</th>
                  <th style={{ position: "sticky", top: 0, zIndex: 1, background: "#f8fafc", textAlign: "left", padding: 10, borderBottom: "1px solid var(--line)" }}>Note (Max {MAX_NOTE_LENGTH})</th>
                </tr>
              </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>Loading employees...</td>
                </tr>
              )}
              {!loading && paginatedStaffRows.length === 0 && (
                <tr>
                  <td colSpan={3} style={{ padding: 12, color: "var(--text-muted)", textAlign: "center" }}>No employees match current filters.</td>
                </tr>
              )}
              {paginatedStaffRows.map((staff, index) => (
                <tr key={staff.id} style={{ background: index % 2 === 0 ? "#ffffff" : "#fcfdff" }}>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{staff.first_name} {staff.last_name} ({staff.staff_no})</td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                    <select
                      value={statusByStaff[staff.id] || "P"}
                      onChange={(e) => {
                        setStatusByStaff((prev) => ({ ...prev, [staff.id]: e.target.value as "P" | "A" | "L" | "F" | "H" }));
                      }}
                      style={fieldStyle()}
                    >
                      {Object.entries(statusLabel).map(([code, label]) => <option key={code} value={code}>{label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                    <input
                      value={noteByStaff[staff.id] || ""}
                      onChange={(e) => onNoteChange(staff.id, e.target.value)}
                      placeholder="Reason or context (optional)"
                      style={{ ...fieldStyle(), borderColor: noteErrorsByStaff[staff.id] ? "#dc2626" : "var(--line)" }}
                    />
                    {noteErrorsByStaff[staff.id] ? <div style={{ color: "#dc2626", fontSize: 12, marginTop: 4 }}>{noteErrorsByStaff[staff.id]}</div> : <div style={{ color: "var(--text-muted)", fontSize: 11, marginTop: 4 }}>{(noteByStaff[staff.id] || "").length}/{MAX_NOTE_LENGTH} characters</div>}
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>

          {totalPages > 1 ? (
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, justifyContent: "flex-end" }}>
              <button type="button" style={buttonStyle("#334155")} onClick={() => setCurrentPage((page) => Math.max(1, page - 1))} disabled={currentPage === 1}>Prev</button>
              <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Page {currentPage} of {totalPages}</span>
              <button type="button" style={buttonStyle("#334155")} onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))} disabled={currentPage === totalPages}>Next</button>
            </div>
          ) : null}
        </div>

        <div className="white-box" style={boxStyle()}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Saved Entries</h3>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Staff</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Date</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Note</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.staff_name || row.staff}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.attendance_date}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{statusLabel[row.attendance_type] || row.attendance_type}</td>
                  <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.note || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div></section>
    </div>
  );
}

export function HrLeaveRequestsPanel() {
  const [rows, setRows] = useState<LeaveRequest[]>([]);
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([]);
  const [staffRows, setStaffRows] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [actionByRow, setActionByRow] = useState<Record<number, string>>({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [currentUser, setCurrentUser] = useState<MePayload | null>(null);

  const [applyDate] = useState(new Date().toISOString().slice(0, 10));
  const [staffId, setStaffId] = useState("");
  const [leaveTypeId, setLeaveTypeId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [reason, setReason] = useState("");
  const [attachment, setAttachment] = useState("");
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  
  const [fieldErrors, setFieldErrors] = useState<{
    staff?: string;
    leaveType?: string;
    fromDate?: string;
    toDate?: string;
    reason?: string;
    attachment?: string;
  }>({});
  
  const minReasonLength = 20;
  const maxReasonLength = 500;
  const maxFileSize = 5 * 1024 * 1024; // 5MB
  const allowedFileTypes = ["application/pdf", "image/jpeg", "image/png"];
  const allowedFileExtensions = [".pdf", ".jpg", ".jpeg", ".png"];
  const canSelectStaff = !!currentUser && (currentUser.is_superuser || currentUser.is_school_admin);
  const canModerateLeave = !!currentUser && (
    currentUser.is_superuser
    || currentUser.is_school_admin
    || currentUser.permission_codes.includes("human_resource.apply_leave.view")
    || currentUser.permission_codes.includes("human_resource.apply_leave.edit")
    || currentUser.permission_codes.includes("human_resource.apply_leave.delete")
  );

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [leaveData, typeData, meData, staffData] = await Promise.all([
        apiGet<ApiList<LeaveRequest>>("/api/v1/hr/leave-requests/"),
        apiGet<ApiList<LeaveType>>("/api/v1/hr/leave-types/?is_active=true"),
        apiGet<MePayload>("/api/v1/auth/me/"),
        apiGet<ApiList<Staff>>("/api/v1/hr/staff/?status=active"),
      ]);
      setRows(listData(leaveData));
      setLeaveTypes(listData(typeData));
      setCurrentUser(meData);
      setStaffRows(listData(staffData));
    } catch {
      setError("Unable to load leave requests.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const validateForm = () => {
    const nextErrors: typeof fieldErrors = {};

    if (canSelectStaff && !staffId.trim()) {
      nextErrors.staff = "Employee is required.";
    }
    
    if (!leaveTypeId.trim()) {
      nextErrors.leaveType = "Leave type is required.";
    }
    
    if (!fromDate.trim()) {
      nextErrors.fromDate = "From date is required.";
    }
    
    if (!toDate.trim()) {
      nextErrors.toDate = "To date is required.";
    }
    
    if (fromDate && toDate) {
      if (toDate < fromDate) {
        nextErrors.toDate = "To date cannot be earlier than From date.";
      }
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const fromDateObj = new Date(fromDate);
      const sixMonthsFromNow = new Date(today);
      sixMonthsFromNow.setMonth(sixMonthsFromNow.getMonth() + 6);
      
      if (fromDateObj < today) {
        nextErrors.fromDate = "From date cannot be in the past.";
      }
      if (fromDateObj > sixMonthsFromNow) {
        nextErrors.fromDate = "From date cannot be more than 6 months in the future.";
      }
    }
    
    if (!reason.trim()) {
      nextErrors.reason = "Reason is required.";
    } else if (reason.trim().length < minReasonLength) {
      nextErrors.reason = `Reason must be at least ${minReasonLength} characters.`;
    }
    if (reason.trim() && reason.trim().length > maxReasonLength) {
      nextErrors.reason = `Reason cannot exceed ${maxReasonLength} characters.`;
    }
    
    if (attachmentFile) {
      if (!allowedFileTypes.includes(attachmentFile.type)) {
        nextErrors.attachment = "Only PDF, JPG, and PNG files are allowed.";
      }
      if (attachmentFile.size > maxFileSize) {
        nextErrors.attachment = `File size cannot exceed ${maxFileSize / (1024 * 1024)}MB.`;
      }
    }
    
    return nextErrors;
  };

  const clearFieldError = (field: keyof typeof fieldErrors) => {
    if (!fieldErrors[field]) return;
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((row) => {
      const leaveType = leaveTypes.find((item) => item.id === row.leave_type);
      return (
        (leaveType?.name || "").toLowerCase().includes(term)
        || row.from_date.includes(term)
        || row.to_date.includes(term)
        || row.status.toLowerCase().includes(term)
      );
    });
  }, [rows, leaveTypes, search]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const nextErrors = validateForm();
    setFieldErrors(nextErrors);
    
    if (Object.keys(nextErrors).length > 0) {
      setError("Please fix the errors below before submitting.");
      return;
    }
    
    try {
      setSaving(true);
      const selectedLeaveType = leaveTypes.find((item) => item.id === Number(leaveTypeId));
      if (selectedLeaveType && fromDate && toDate) {
        const requestedDays = Math.floor((new Date(`${toDate}T00:00:00`).getTime() - new Date(`${fromDate}T00:00:00`).getTime()) / (1000 * 60 * 60 * 24)) + 1;
        if (requestedDays > selectedLeaveType.max_days_per_year) {
          const message = "Leave limit exceeded";
          setFieldErrors((prev) => ({ ...prev, toDate: message }));
          setError(message);
          return;
        }
      }
      const payload = {
        ...(canSelectStaff && staffId ? { staff: Number(staffId) } : {}),
        leave_type: Number(leaveTypeId),
        from_date: fromDate,
        to_date: toDate,
        reason: reason.trim(),
        attachment: attachmentFile?.name || "",
      };
      if (editingId) {
        await apiPatch(`/api/v1/hr/leave-requests/${editingId}/`, payload);
        setToast("Leave request updated successfully.");
      } else {
        await apiPost("/api/v1/hr/leave-requests/", payload);
        setToast("Leave request submitted successfully.");
      }
      setEditingId(null);
      setStaffId("");
      setLeaveTypeId("");
      setFromDate("");
      setToDate("");
      setReason("");
      setAttachment("");
      setAttachmentFile(null);
      await load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unable to save leave request.";
      setError(message);
    } finally {
      setSaving(false);
    }
  };

  const deletePending = async (row: LeaveRequest) => {
    const leaveTypeName = leaveTypes.find((item) => item.id === row.leave_type)?.name || `#${row.leave_type}`;
    if (!window.confirm(`Delete pending leave request for ${leaveTypeName} (${row.from_date} to ${row.to_date})?`)) return;
    try {
      setError("");
      await apiDelete(`/api/v1/hr/leave-requests/${row.id}/`);
      await load();
    } catch {
      setError("Unable to delete leave request.");
    }
  };

  const viewLeave = (row: LeaveRequest) => {
    const leaveType = leaveTypes.find((item) => item.id === row.leave_type);
    const message = [
      `Leave Type: ${leaveType?.name || row.leave_type}`,
      `From: ${row.from_date}`,
      `To: ${row.to_date}`,
      `Reason: ${row.reason || "-"}`,
      `Attachment: ${row.attachment || "-"}`,
      `Status: ${row.status}`,
      `Approval Note: ${row.approval_note || "-"}`,
    ].join("\n");
    window.alert(message);
  };

  const handleRowAction = async (row: LeaveRequest, action: string) => {
    setActionByRow((prev) => ({ ...prev, [row.id]: "" }));
    if (action === "view") {
      viewLeave(row);
      return;
    }
    if (action === "edit" && row.status === "pending") {
      startEdit(row);
      return;
    }
    if (action === "delete" && row.status === "pending") {
      await deletePending(row);
      return;
    }
    if (action === "approve" && row.status === "pending" && canModerateLeave) {
      try {
        setError("");
        const note = window.prompt("Approval note (optional):", "") || "";
        await apiPost(`/api/v1/hr/leave-requests/${row.id}/approve/`, { approval_note: note.trim() });
        setToast("Leave request approved successfully.");
        await load();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to approve leave request.";
        setError(message);
      }
      return;
    }
    if (action === "reject" && row.status === "pending" && canModerateLeave) {
      try {
        setError("");
        const note = window.prompt("Rejection note (optional):", "") || "";
        await apiPost(`/api/v1/hr/leave-requests/${row.id}/reject/`, { approval_note: note.trim() });
        setToast("Leave request rejected successfully.");
        await load();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Unable to reject leave request.";
        setError(message);
      }
    }
  };

  const statusText = (status: LeaveRequest["status"]) => {
    if (status === "rejected") return "Cancelled";
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const statusColor = (status: LeaveRequest["status"]) => {
    if (status === "approved") return "#059669";
    if (status === "rejected") return "#dc2626";
    return "#d97706";
  };

  const startEdit = (row: LeaveRequest) => {
    setEditingId(row.id);
    setStaffId(String(row.staff ?? ""));
    setLeaveTypeId(String(row.leave_type));
    setFromDate(row.from_date);
    setToDate(row.to_date);
    setReason(row.reason || "");
    setAttachment(row.attachment || "");
  };

  const cancelEdit = () => {
    setEditingId(null);
    setStaffId("");
    setLeaveTypeId("");
    setFromDate("");
    setToDate("");
    setReason("");
    setAttachment("");
    setAttachmentFile(null);
    setFieldErrors({});
    setError("");
    setToast("");
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Apply Leave")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Leave Request" : "Apply for Leave"}</h3>
          
          <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
            {/* Leave Details Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>1. Leave Details</h4>
              <p style={{ margin: 0, fontSize: 12, color: "var(--text-muted)" }}>
                {canSelectStaff
                  ? "Select the employee who is applying for leave."
                  : "This request will be created for your linked staff profile."}
              </p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {canSelectStaff ? (
                  <div style={{ display: "grid", gap: 4 }}>
                    <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Employee *</label>
                    <select
                      value={staffId}
                      onChange={(e) => { setStaffId(e.target.value); clearFieldError("staff"); }}
                      style={{ ...fieldStyle(), borderColor: fieldErrors.staff ? "#dc2626" : "var(--line)" }}
                    >
                      <option value="">Select Employee</option>
                      {staffRows.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
                    </select>
                    {fieldErrors.staff ? <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.staff}</span> : null}
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Required for admin and school admin users.</span>
                  </div>
                ) : null}
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Application Date</label>
                  <input type="date" value={applyDate} readOnly style={{ ...fieldStyle(), background: "#f7f7f7" }} />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Auto-filled with today's date</span>
                </div>
                
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>Leave Type *</label>
                  <select 
                    value={leaveTypeId} 
                    onChange={(e) => { setLeaveTypeId(e.target.value); clearFieldError("leaveType"); }}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.leaveType ? "#dc2626" : "var(--line)" }}
                  >
                    <option value="">-- Select Leave Type --</option>
                    {leaveTypes.map((item) => <option key={item.id} value={item.id}>{item.name} (Max: {item.max_days_per_year} days)</option>)}
                  </select>
                  {fieldErrors.leaveType && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.leaveType}</span>}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Required field</span>
                </div>
              </div>
            </div>

            {/* Date Range Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>2. Leave Period</h4>
              <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "var(--text-muted)" }}>Select the date range for your leave request. You cannot request leave for past dates or more than 6 months in advance.</p>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>From Date *</label>
                  <input 
                    type="date" 
                    value={fromDate}
                    onChange={(e) => { setFromDate(e.target.value); clearFieldError("fromDate"); }}
                    min={new Date().toISOString().slice(0, 10)}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.fromDate ? "#dc2626" : "var(--line)" }}
                  />
                  {fieldErrors.fromDate && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.fromDate}</span>}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>YYYY-MM-DD format</span>
                </div>
                
                <div style={{ display: "grid", gap: 4 }}>
                  <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>To Date *</label>
                  <input 
                    type="date"
                    value={toDate}
                    onChange={(e) => { setToDate(e.target.value); clearFieldError("toDate"); }}
                    min={fromDate || new Date().toISOString().slice(0, 10)}
                    style={{ ...fieldStyle(), borderColor: fieldErrors.toDate ? "#dc2626" : "var(--line)" }}
                  />
                  {fieldErrors.toDate && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.toDate}</span>}
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Must be on or after From Date</span>
                </div>
              </div>
            </div>

            {/* Reason Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>3. Reason for Leave</h4>
              
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>
                  Reason for Leave * {reason.trim().length > 0 ? `(${reason.trim().length} / ${maxReasonLength} characters)` : ""}
                </label>
                <textarea 
                  value={reason}
                  onChange={(e) => { setReason(e.target.value); clearFieldError("reason"); }}
                  placeholder="Enter your reason for leave"
                  style={{ 
                    width: "100%", 
                    minHeight: 100, 
                    border: `1px solid ${fieldErrors.reason ? "#dc2626" : "var(--line)"}`,
                    borderRadius: 8, 
                    padding: 10,
                    fontFamily: "inherit"
                  }}
                />
                {fieldErrors.reason && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.reason}</span>}
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  {reason.trim().length === 0 ? "Required field" : "Valid length"}
                </span>
              </div>
            </div>

            {/* File Upload Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "grid", gap: 10 }}>
              <h4 style={{ margin: 0, fontSize: 14 }}>4. Supporting Documents (Optional)</h4>
              <p style={{ margin: "0 0 10px 0", fontSize: 12, color: "var(--text-muted)" }}>Upload supporting documents (PDF, JPG, PNG). File size limit: 5MB.</p>
              
              <div style={{ display: "grid", gap: 4 }}>
                <label style={{ fontSize: 12, color: "var(--text-muted)", textTransform: "uppercase", fontWeight: 600 }}>File (Optional)</label>
                <input
                  type="file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAttachmentFile(file);
                      setAttachment(file.name);
                      clearFieldError("attachment");
                    }
                  }}
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ ...fieldStyle(), borderColor: fieldErrors.attachment ? "#dc2626" : "var(--line)" }}
                />
                {fieldErrors.attachment && <span style={{ color: "#dc2626", fontSize: 12 }}>{fieldErrors.attachment}</span>}
                {attachmentFile && <div style={{ color: "#059669", fontSize: 12 }}>Γ£ô Selected: {attachmentFile.name} ({(attachmentFile.size / 1024).toFixed(2)} KB)</div>}
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Allowed: PDF, JPG, PNG | Max size: 5MB</span>
              </div>
            </div>

            {/* Submit Section */}
            <div style={{ border: "1px solid var(--line)", borderRadius: 8, padding: 12, display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" style={buttonStyle("#6b7280")} onClick={cancelEdit}>Reset</button>
              <button type="submit" style={buttonStyle()} disabled={saving || loading}>{saving ? "Saving..." : editingId ? "Update" : "Submit Leave Request"}</button>
            </div>
          </form>

          {error && <p style={{ color: "#dc2626", marginTop: 12, padding: 10, background: "#fee2e2", borderRadius: 6, fontSize: 13 }}>{error}</p>}
          {toast && <p style={{ color: "#059669", marginTop: 12, padding: 10, background: "#ecfdf5", borderRadius: 6, fontSize: 13 }}>{toast}</p>}
        </div>

        <div className="white-box" style={boxStyle()}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <h3 style={{ margin: 0 }}>Your Leave Requests</h3>
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." style={{ ...fieldStyle(), width: 200 }} />
          </div>
          {loading ? <p style={{ color: "var(--text-muted)" }}>Loading leave requests...</p> : null}
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Type</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>From</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>To</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Applied</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{ padding: 12, textAlign: "center", color: "var(--text-muted)" }}>
                    {search ? "No leave requests match your search." : "No leave requests yet."}
                  </td>
                </tr>
              )}
              {filteredRows.map((row) => {
                const leaveType = leaveTypes.find((item) => item.id === row.leave_type);
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{leaveType?.name || row.leave_type}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.from_date}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.to_date}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <span style={{ display: "inline-block", padding: "3px 8px", borderRadius: 6, color: "#fff", background: statusColor(row.status), fontSize: 12 }}>
                        {statusText(row.status)}
                      </span>
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <select
                        value={actionByRow[row.id] || ""}
                        onChange={(e) => {
                          const action = e.target.value;
                          setActionByRow((prev) => ({ ...prev, [row.id]: action }));
                          void handleRowAction(row, action);
                        }}
                        style={fieldStyle()}
                      >
                        <option value="">Action</option>
                        <option value="view">View</option>
                        {row.status === "pending" && <option value="edit">Edit</option>}
                        {row.status === "pending" && <option value="delete">Delete</option>}
                        {row.status === "pending" && canModerateLeave && <option value="approve">Approve</option>}
                        {row.status === "pending" && canModerateLeave && <option value="reject">Reject</option>}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div></section>
    </div>
  );
}

export function HrPayrollPanel() {
  const [rows, setRows] = useState<PayrollRecord[]>([]);
  const [staffRows, setStaffRows] = useState<Staff[]>([]);
  const [summary, setSummary] = useState<PayrollSummary | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [staffId, setStaffId] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [basicSalary, setBasicSalary] = useState("0.00");
  const [allowance, setAllowance] = useState("0.00");
  const [deduction, setDeduction] = useState("0.00");
  const [statusFilter, setStatusFilter] = useState<"" | "draft" | "processed" | "paid">("");
  const [searchStaffId, setSearchStaffId] = useState("");
  const [searchMonth, setSearchMonth] = useState("");
  const [searchYear, setSearchYear] = useState("");

  const load = async (overrides?: Partial<{ statusFilter: string; searchStaffId: string; searchMonth: string; searchYear: string }>) => {
    try {
      setError("");
      const effectiveStatus = overrides?.statusFilter ?? statusFilter;
      const effectiveStaff = overrides?.searchStaffId ?? searchStaffId;
      const effectiveMonth = overrides?.searchMonth ?? searchMonth;
      const effectiveYear = overrides?.searchYear ?? searchYear;

      const params = new URLSearchParams();
      if (effectiveStatus) params.set("status", effectiveStatus);
      if (effectiveStaff) params.set("staff", effectiveStaff);
      if (effectiveMonth) params.set("payroll_month", effectiveMonth);
      if (effectiveYear) params.set("payroll_year", effectiveYear);
      const suffix = params.toString() ? `?${params.toString()}` : "";

      const [payrollData, staffData, summaryData] = await Promise.all([
        apiGet<ApiList<PayrollRecord>>(`/api/v1/hr/payroll/${suffix}`),
        apiGet<ApiList<Staff>>("/api/v1/hr/staff/?status=active"),
        apiGet<PayrollSummary>(`/api/v1/hr/payroll/summary/${suffix}`),
      ]);
      const loadedStaffRows = listData(staffData);
      const loadedRows = listData(payrollData);
      loadedRows.sort((a, b) => {
        if (a.payroll_year !== b.payroll_year) return a.payroll_year - b.payroll_year;
        if (a.payroll_month !== b.payroll_month) return a.payroll_month - b.payroll_month;
        const staffA = loadedStaffRows.find((item) => item.id === a.staff);
        const staffB = loadedStaffRows.find((item) => item.id === b.staff);
        const nameA = `${staffA?.first_name || ""} ${staffA?.last_name || ""}`.trim();
        const nameB = `${staffB?.first_name || ""} ${staffB?.last_name || ""}`.trim();
        return nameA.localeCompare(nameB, undefined, { sensitivity: "base", numeric: true });
      });
      setRows(loadedRows);
      setStaffRows(loadedStaffRows);
      setSummary(summaryData);
    } catch {
      setError("Unable to load payroll records.");
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const runSearch = async () => {
    await load();
  };

  const resetSearch = async () => {
    const cleared = { statusFilter: "", searchStaffId: "", searchMonth: "", searchYear: "" };
    setStatusFilter(cleared.statusFilter as "" | "draft" | "processed" | "paid");
    setSearchStaffId(cleared.searchStaffId);
    setSearchMonth(cleared.searchMonth);
    setSearchYear(cleared.searchYear);
    await load(cleared);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!staffId || !month || !year) {
      setError("Staff, month and year are required.");
      return;
    }
    try {
      setError("");
      setSuccess("");
      await apiPost("/api/v1/hr/payroll/", {
        staff: Number(staffId),
        payroll_month: Number(month),
        payroll_year: Number(year),
        basic_salary: basicSalary || "0.00",
        allowance: allowance || "0.00",
        deduction: deduction || "0.00",
      });
      setStaffId("");
      setBasicSalary("0.00");
      setAllowance("0.00");
      setDeduction("0.00");
      setSuccess("Payroll record saved successfully.");
      await load();
    } catch {
      setError("Unable to save payroll record.");
    }
  };

  const markPaid = async (id: number) => {
    try {
      setError("");
      setSuccess("");
      await apiPost(`/api/v1/hr/payroll/${id}/mark-paid/`, {});
      setSuccess("Payroll marked as paid.");
      await load();
    } catch {
      setError("Unable to mark payroll as paid.");
    }
  };

  return (
    <div className="legacy-panel">
      {breadcrumb("Payroll")}
      <section className="admin-visitor-area up_st_admin_visitor"><div className="container-fluid p-0">
        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12 }}>Add Payroll</h3>
          <form onSubmit={submit} style={{ display: "grid", gridTemplateColumns: "1fr 100px 100px 1fr 1fr 1fr auto", gap: 8 }}>
            <select value={staffId} onChange={(e) => setStaffId(e.target.value)} style={fieldStyle()}>
              <option value="">Staff</option>
              {staffRows.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
            </select>
            <input type="number" min="1" max="12" value={month} onChange={(e) => setMonth(e.target.value)} placeholder="Month" style={fieldStyle()} />
            <input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} placeholder="Year" style={fieldStyle()} />
            <input type="number" min="0" step="0.01" value={basicSalary} onChange={(e) => setBasicSalary(e.target.value)} placeholder="Basic salary" style={fieldStyle()} />
            <input type="number" min="0" step="0.01" value={allowance} onChange={(e) => setAllowance(e.target.value)} placeholder="Allowance" style={fieldStyle()} />
            <input type="number" min="0" step="0.01" value={deduction} onChange={(e) => setDeduction(e.target.value)} placeholder="Deduction" style={fieldStyle()} />
            <button type="submit" style={buttonStyle()}>Save</button>
          </form>
          {error && <p style={{ color: "var(--warning)", marginTop: 8 }}>{error}</p>}
          {success && <p style={{ color: "#16a34a", marginTop: 8 }}>{success}</p>}
        </div>

        <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Search Criteria</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 120px 120px 180px auto auto", gap: 8 }}>
            <select value={searchStaffId} onChange={(e) => setSearchStaffId(e.target.value)} style={fieldStyle()}>
              <option value="">All Staff</option>
              {staffRows.map((item) => <option key={item.id} value={item.id}>{item.first_name} {item.last_name} ({item.staff_no})</option>)}
            </select>
            <input type="number" min="1" max="12" value={searchMonth} onChange={(e) => setSearchMonth(e.target.value)} placeholder="Month" style={fieldStyle()} />
            <input type="number" min="2000" max="2100" value={searchYear} onChange={(e) => setSearchYear(e.target.value)} placeholder="Year" style={fieldStyle()} />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "" | "draft" | "processed" | "paid")} style={fieldStyle()}>
              <option value="">All Status</option>
              <option value="draft">Draft</option>
              <option value="processed">Processed</option>
              <option value="paid">Paid</option>
            </select>
            <button type="button" style={buttonStyle("#0ea5e9")} onClick={() => void runSearch()}>Search</button>
            <button type="button" style={buttonStyle("#6b7280")} onClick={() => void resetSearch()}>Reset</button>
          </div>
        </div>

        {summary && (
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 10 }}>Payroll Summary</h3>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: 8 }}>
              <div>Total: <strong>{summary.total_records}</strong></div>
              <div>Basic: <strong>{summary.total_basic_salary}</strong></div>
              <div>Allowance: <strong>{summary.total_allowance}</strong></div>
              <div>Deduction: <strong>{summary.total_deduction}</strong></div>
              <div>Net: <strong>{summary.total_net_salary}</strong></div>
            </div>
          </div>
        )}

        <div className="white-box" style={boxStyle()}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>No</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Staff</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Month</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Year</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Basic</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Allowance</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Deduction</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Net</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th><th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th></tr></thead>
            <tbody>
              {rows.map((row, index) => {
                const staff = staffRows.find((item) => item.id === row.staff);
                return (
                  <tr key={row.id}>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{index + 1}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{staff ? `${staff.first_name} ${staff.last_name}` : row.staff}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.payroll_month}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.payroll_year}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.basic_salary}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.allowance}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.deduction}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.net_salary}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textTransform: "capitalize" }}>{row.status}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      {row.status !== "paid" ? (
                        <button type="button" style={buttonStyle("#059669")} onClick={() => void markPaid(row.id)}>Mark Paid</button>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>No action</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div></section>
    </div>
  );
}
