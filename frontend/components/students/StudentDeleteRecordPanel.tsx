"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type ApiList<T> = T[] | { results?: T[]; count?: number; next?: string | null; previous?: string | null };

type StudentRow = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name?: string;
  date_of_birth?: string | null;
  current_class?: number | null;
  current_section?: number | null;
  guardian?: number | null;
  status?: string;
  is_deleted?: boolean;
  is_active: boolean;
};

type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };
type Guardian = { id: number; phone: string; full_name: string };
type MePayload = { id: number; is_superuser: boolean; is_school_admin?: boolean };

type StudentAuditRow = {
  id: number;
  student: number | null;
  student_name: string;
  student_admission_no?: string | null;
  action: "soft_delete" | "restore" | "permanent_delete";
  performed_by_name?: string | null;
  note?: string;
  created_at: string;
};

type ApiError = Error & {
  details?: {
    message?: string;
    field_errors?: Record<string, string | string[]>;
  };
};

type ConfirmState = {
  mode: "soft-delete" | "restore" | "permanent-delete";
  student: StudentRow;
} | null;

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiPost<T>(path: string, payload?: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
  });
}

async function apiDelete<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
  });
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
    height: 34,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    padding: "0 10px",
    cursor: "pointer",
  } as const;
}

function fullName(row: StudentRow) {
  return `${row.first_name || ""} ${row.last_name || ""}`.trim() || "-";
}

function parseError(error: unknown): string {
  const apiError = error as ApiError;
  const detailsMessage = apiError?.details?.message;
  if (detailsMessage) {
    return detailsMessage;
  }

  if (error instanceof Error) {
    const lower = error.message.toLowerCase();
    if (lower.includes("failed to fetch") || lower.includes("network")) {
      return "Network error. Please check your connection";
    }
    if (lower.includes("permission") || lower.includes("403")) {
      return "You do not have permission to delete student records";
    }
    return error.message;
  }

  return "Failed to delete student. Please try again";
}

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString();
}

export function StudentDeleteRecordPanel() {
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [currentUser, setCurrentUser] = useState<MePayload | null>(null);
  const [audits, setAudits] = useState<StudentAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"records" | "audit">("records");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [deletedOnly, setDeletedOnly] = useState(true);

  const [loading, setLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmState, setConfirmState] = useState<ConfirmState>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const classMap = useMemo(() => new Map(classes.map((item) => [item.id, item.name])), [classes]);
  const sectionMap = useMemo(() => new Map(sections.map((item) => [item.id, item.name])), [sections]);
  const guardianMap = useMemo(() => new Map(guardians.map((item) => [item.id, item])), [guardians]);

  const sectionOptions = useMemo(() => {
    if (!classId) {
      return sections;
    }
    return sections.filter((item) => String(item.school_class) === classId);
  }, [sections, classId]);

  const validateSearch = (value: string) => {
    if (!value.trim()) {
      return "";
    }
    if (!/^[A-Za-z0-9 ]+$/.test(value.trim())) {
      return "Please enter valid search text";
    }
    return "";
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 350);
    return () => window.clearTimeout(timer);
  }, [search]);

  const loadMeta = async () => {
    try {
      setLoading(true);
      const [classData, sectionData, guardianData, me] = await Promise.all([
        apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
        apiGet<ApiList<Section>>("/api/v1/core/sections/"),
        apiGet<ApiList<Guardian>>("/api/v1/students/guardians/"),
        apiGet<MePayload>("/api/v1/auth/me/"),
      ]);
      setClasses(listData(classData));
      setSections(listData(sectionData));
      setGuardians(listData(guardianData));
      setCurrentUser(me);
    } catch (err) {
      setError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadStudents = async () => {
    const searchError = validateSearch(debouncedSearch);
    if (searchError) {
      setFieldErrors({ search: searchError });
      setError(searchError);
      return;
    }

    try {
      setListLoading(true);
      setError("");
      setFieldErrors({});

      const params = new URLSearchParams();
      params.set("include_deleted", "true");
      params.set("deleted_only", deletedOnly ? "true" : "false");
      if (classId) {
        params.set("class", classId);
      }
      if (sectionId) {
        params.set("section", sectionId);
      }
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }

      const studentData = await apiGet<ApiList<StudentRow>>(`/api/v1/students/students/?${params.toString()}`);
      setStudents(listData(studentData));
    } catch (err) {
      setError(parseError(err));
    } finally {
      setListLoading(false);
    }
  };

  const loadAudits = async () => {
    try {
      setAuditLoading(true);
      const params = new URLSearchParams();
      if (classId) {
        params.set("class", classId);
      }
      if (sectionId) {
        params.set("section", sectionId);
      }
      if (debouncedSearch) {
        params.set("search", debouncedSearch);
      }
      const data = await apiGet<ApiList<StudentAuditRow>>(`/api/v1/students/record-audits/?${params.toString()}`);
      setAudits(listData(data));
    } catch (err) {
      setError(parseError(err));
    } finally {
      setAuditLoading(false);
    }
  };

  useEffect(() => {
    void loadMeta();
  }, []);

  useEffect(() => {
    if (!loading) {
      void loadStudents();
      if (activeTab === "audit") {
        void loadAudits();
      }
    }
  }, [loading, classId, sectionId, deletedOnly, debouncedSearch, activeTab]);

  useEffect(() => {
    if (!classId) {
      setSectionId("");
      return;
    }
    const exists = sectionOptions.some((item) => String(item.id) === sectionId);
    if (!exists) {
      setSectionId("");
    }
  }, [classId, sectionId, sectionOptions]);

  const openConfirm = (mode: "soft-delete" | "restore" | "permanent-delete", student: StudentRow) => {
    setConfirmState({ mode, student });
  };

  const closeConfirm = () => {
    if (busyId) {
      return;
    }
    setConfirmState(null);
  };

  const performAction = async () => {
    if (!confirmState) {
      return;
    }

    const { mode, student } = confirmState;

    try {
      setBusyId(student.id);
      setError("");
      setSuccess("");

      if (mode === "soft-delete") {
        await apiPost(`/api/v1/students/students/${student.id}/soft-delete/`);
        setStudents((prev) =>
          prev.map((row) =>
            row.id === student.id
              ? { ...row, is_deleted: true, is_active: false, status: "deleted" }
              : row,
          ),
        );
        setSuccess("Student deleted successfully");
      } else if (mode === "restore") {
        await apiPost(`/api/v1/students/students/${student.id}/restore/`);
        setStudents((prev) =>
          prev.map((row) =>
            row.id === student.id
              ? { ...row, is_deleted: false, is_active: true, status: "active" }
              : row,
          ),
        );
        setSuccess("Student restored successfully");
      } else {
        await apiDelete(`/api/v1/students/students/${student.id}/permanent-delete/`);
        setStudents((prev) => prev.filter((row) => row.id !== student.id));
        setSuccess("Student permanently deleted successfully");
      }

      setConfirmState(null);
      if (activeTab === "audit") {
        await loadAudits();
      }
    } catch (err) {
      if (confirmState.mode === "restore") {
        setError("Failed to restore student");
      } else {
        const parsed = parseError(err);
        if (parsed === "Cannot delete student. Linked records exist") {
          setError("Cannot delete student. Linked records exist");
        } else if (parsed === "Unable to permanently delete student due to linked records") {
          setError("Unable to permanently delete student due to linked records");
        } else {
          setError(parsed || "Failed to delete student. Please try again");
        }
      }
    } finally {
      setBusyId(null);
    }
  };

  const noRows = !listLoading && students.length === 0;

  const actionLabel = (action: StudentAuditRow["action"]) => {
    if (action === "soft_delete") {
      return "Soft Delete";
    }
    if (action === "restore") {
      return "Restore";
    }
    return "Permanent Delete";
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Delete Student Record</h1>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/students/list" style={{ ...buttonStyle("#0ea5e9"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Student List
                </Link>
                <Link href="/students/multi-class" style={{ ...buttonStyle("#16a34a"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Student Subject Assignment
                </Link>
              </div>
              <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
                <span>Dashboard</span>
                <span>/</span>
                <span>Student Information</span>
                <span>/</span>
                <span>Delete Student Record</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 12 }}>
          <div className="white-box" style={boxStyle()}>
            <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8 }}>
              <div>
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by admission, roll, name"
                  style={fieldStyle()}
                />
                {fieldErrors.search && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.search}</p>}
              </div>
              <select value={classId} onChange={(event) => { setClassId(event.target.value); setSectionId(""); }} style={fieldStyle()}>
                <option value="">All Classes</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} style={fieldStyle()}>
                <option value="">All Sections</option>
                {sectionOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <input type="checkbox" checked={deletedOnly} onChange={(event) => setDeletedOnly(event.target.checked)} />
                Deleted Only
              </label>
            </div>
          </div>

          <div className="white-box" style={boxStyle()}>
            <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
              <button
                type="button"
                style={buttonStyle(activeTab === "records" ? "#1d4ed8" : "#64748b")}
                onClick={() => setActiveTab("records")}
              >
                Delete Records
              </button>
              <button
                type="button"
                style={buttonStyle(activeTab === "audit" ? "#1d4ed8" : "#64748b")}
                onClick={() => setActiveTab("audit")}
              >
                Audit Log
              </button>
            </div>

            {activeTab === "records" ? (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Delete Student Record</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Roll No</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Class (Section)</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Phone</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Date Of Birth</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {noRows ? (
                        <tr>
                          <td colSpan={8} style={{ padding: 12, color: "var(--text-muted)" }}>
                            No student records found
                          </td>
                        </tr>
                      ) : (
                        students.map((row) => {
                          const guardian = row.guardian ? guardianMap.get(row.guardian) : null;
                          const className = classMap.get(row.current_class || 0) || "-";
                          const sectionName = sectionMap.get(row.current_section || 0);
                          const deleted = !!row.is_deleted || row.status === "deleted";

                          return (
                            <tr key={row.id}>
                              <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.admission_no || "-"}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.roll_no || "-"}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{fullName(row)}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                                {className}{sectionName ? ` (${sectionName})` : ""}
                              </td>
                              <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{guardian?.phone || "-"}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{deleted ? "Deleted" : row.status || "Active"}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{formatDate(row.date_of_birth)}</td>
                              <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                                  {!deleted ? (
                                    <button
                                      type="button"
                                      disabled={busyId === row.id}
                                      style={buttonStyle("#b45309")}
                                      onClick={() => openConfirm("soft-delete", row)}
                                    >
                                      Delete
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={busyId === row.id}
                                      style={buttonStyle("#0284c7")}
                                      onClick={() => openConfirm("restore", row)}
                                    >
                                      Restore
                                    </button>
                                  )}

                                  {currentUser?.is_superuser && (
                                    <button
                                      type="button"
                                      disabled={busyId === row.id}
                                      style={buttonStyle("#dc2626")}
                                      onClick={() => openConfirm("permanent-delete", row)}
                                    >
                                      Permanent Delete
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {(loading || listLoading) && <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading records...</p>}
                {error && <p style={{ marginTop: 10, color: "var(--warning)" }}>{error}</p>}
                {success && <p style={{ marginTop: 10, color: "#0f766e" }}>{success}</p>}
              </>
            ) : (
              <>
                <h3 style={{ marginTop: 0, marginBottom: 12 }}>Delete and Restore Audit Log</h3>
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Time</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Student</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Performed By</th>
                        <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Note</th>
                      </tr>
                    </thead>
                    <tbody>
                      {!auditLoading && audits.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ padding: 12, color: "var(--text-muted)" }}>
                            No audit records found
                          </td>
                        </tr>
                      ) : (
                        audits.map((item) => (
                          <tr key={item.id}>
                            <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{formatDate(item.created_at)}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.student_name || "-"}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.student_admission_no || "-"}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{actionLabel(item.action)}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.performed_by_name || "-"}</td>
                            <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{item.note || "-"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {auditLoading && <p style={{ marginTop: 10, color: "var(--text-muted)" }}>Loading audit logs...</p>}
                {error && <p style={{ marginTop: 10, color: "var(--warning)" }}>{error}</p>}
                {success && <p style={{ marginTop: 10, color: "#0f766e" }}>{success}</p>}
              </>
            )}
          </div>
        </div>
      </section>

      {confirmState && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.5)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div style={{ ...boxStyle(), maxWidth: 460, width: "100%" }}>
            <h3 style={{ marginTop: 0 }}>
              {confirmState.mode === "restore"
                ? "Restore Student"
                : confirmState.mode === "permanent-delete"
                  ? "Permanent Delete Student"
                  : "Delete Student"}
            </h3>

            <p style={{ margin: "0 0 12px", color: "var(--text-muted)" }}>
              {confirmState.mode === "restore"
                ? `Are you sure you want to restore ${fullName(confirmState.student)}?`
                : confirmState.mode === "permanent-delete"
                  ? `Are you sure you want to permanently delete ${fullName(confirmState.student)}?`
                  : "Are you sure you want to delete this student?"}
            </p>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" style={buttonStyle("#64748b")} onClick={closeConfirm} disabled={busyId !== null}>
                Cancel
              </button>
              <button
                type="button"
                style={buttonStyle(confirmState.mode === "restore" ? "#0284c7" : "#dc2626")}
                onClick={() => void performAction()}
                disabled={busyId !== null}
              >
                {busyId !== null ? "Processing..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
