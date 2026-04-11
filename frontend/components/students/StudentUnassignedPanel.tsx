"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";

type StudentRow = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name?: string;
  date_of_birth?: string | null;
  gender: "male" | "female" | "other";
  category?: number | null;
  guardian?: number | null;
  current_class?: number | null;
  current_section?: number | null;
  is_active: boolean;
};

type Guardian = { id: number; full_name: string; phone: string };
type StudentCategory = { id: number; name: string };
type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiPatch<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function apiPost<T>(path: string, payload?: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload ? JSON.stringify(payload) : undefined,
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

function sanitizeSearchInput(value: string) {
  return value.replace(/[<>'"`;]/g, "").replace(/--+/g, " ").slice(0, 80);
}

function validateSearchText(value: string) {
  if (!value) {
    return "";
  }
  if (!/^[A-Za-z0-9 _\-./@()]+$/.test(value)) {
    return "Search accepts letters, numbers, spaces, and basic symbols only.";
  }
  return "";
}

function skeletonCell() {
  return {
    height: 12,
    borderRadius: 999,
    background: "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
    backgroundSize: "200% 100%",
    animation: "unassignedShimmer 1.2s ease-in-out infinite",
  } as const;
}

export function StudentUnassignedPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("students.unassigned", 1, 25);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [categories, setCategories] = useState<StudentCategory[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [totalCount, setTotalCount] = useState(0);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [metaLoading, setMetaLoading] = useState(true);
  const [listLoading, setListLoading] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [assigningBulk, setAssigningBulk] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<StudentRow | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [listError, setListError] = useState("");
  const [searchError, setSearchError] = useState("");
  const [success, setSuccess] = useState("");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [assignClassId, setAssignClassId] = useState("");
  const [assignSectionId, setAssignSectionId] = useState("");
  const [jumpPageInput, setJumpPageInput] = useState("");

  const guardianMap = useMemo(() => new Map(guardians.map((item) => [item.id, item])), [guardians]);
  const categoryMap = useMemo(() => new Map(categories.map((item) => [item.id, item.name])), [categories]);
  const assignSectionOptions = useMemo(
    () => sections.filter((item) => String(item.school_class) === assignClassId),
    [sections, assignClassId],
  );
  const selectedRows = useMemo(() => students.filter((item) => selectedIds.includes(item.id)), [students, selectedIds]);
  const allVisibleSelected = students.length > 0 && students.every((item) => selectedIds.includes(item.id));

  const loadStudents = async (targetPage = page, targetPageSize = pageSize) => {
    const nextSearch = debouncedSearch.trim();
    const invalidSearch = validateSearchText(nextSearch);
    if (invalidSearch) {
      setSearchError(invalidSearch);
      setListError(invalidSearch);
      setStudents([]);
      setTotalCount(0);
      return;
    }

    try {
      setListLoading(true);
      setListError("");
      setSearchError("");
      const query = buildPaginationQuery(targetPage, targetPageSize, {
        unassigned: "true",
        search: nextSearch || undefined,
      });
      const studentData = await apiGet<ListApiResponse<StudentRow>>(`/api/v1/students/students/?${query}`);
      const items = extractListData(studentData);
      const meta = extractPaginationMeta(studentData);
      setStudents(items);
      setTotalCount(meta?.count ?? items.length);
      setSelectedIds([]);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      if (message === "401") {
        setListError("Session expired. Please login again.");
      } else if (message.includes("404")) {
        setListError("No student data endpoint found (404).");
      } else if (message.includes("500")) {
        setListError("Server error while loading students (500).");
      } else {
        setListError("Failed to load data.");
      }
    } finally {
      setListLoading(false);
    }
  };

  const load = async () => {
    try {
      setMetaLoading(true);
      setError("");
      const [guardianResult, categoryResult, classResult, sectionResult] = await Promise.allSettled([
        apiGet<ListApiResponse<Guardian>>("/api/v1/students/guardians/"),
        apiGet<ListApiResponse<StudentCategory>>("/api/v1/students/categories/"),
        apiGet<ListApiResponse<SchoolClass>>("/api/v1/core/classes/"),
        apiGet<ListApiResponse<Section>>("/api/v1/core/sections/?page_size=500"),
      ]);

      setGuardians(guardianResult.status === "fulfilled" ? extractListData(guardianResult.value) : []);
      setCategories(categoryResult.status === "fulfilled" ? extractListData(categoryResult.value) : []);
      setClasses(classResult.status === "fulfilled" ? extractListData(classResult.value) : []);
      setSections(sectionResult.status === "fulfilled" ? extractListData(sectionResult.value) : []);
    } catch {
      setError("Unable to load filter options.");
    } finally {
      setMetaLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(sanitizeSearchInput(search.trim()));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      void loadStudents();
    }, 10);
    return () => window.clearTimeout(handle);
  }, [page, pageSize, debouncedSearch]);

  useEffect(() => {
    if (!assignClassId) {
      setAssignSectionId("");
      return;
    }
    const exists = assignSectionOptions.some((item) => String(item.id) === assignSectionId);
    if (!exists) {
      setAssignSectionId("");
    }
  }, [assignClassId, assignSectionId, assignSectionOptions]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  const toggleSelection = (id: number) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      setSelectedIds((prev) => prev.filter((id) => !students.some((item) => item.id === id)));
      return;
    }
    setSelectedIds((prev) => Array.from(new Set([...prev, ...students.map((item) => item.id)])));
  };

  const removeStudents = async (ids: number[]) => {
    if (ids.length === 0) {
      return;
    }

    try {
      setDeletingId(ids[0]);
      setError("");
      setSuccess("");
      for (const id of ids) {
        await apiPost(`/api/v1/students/students/${id}/soft-delete/`);
      }
      setSuccess(ids.length > 1 ? "Selected students moved to deleted records." : "Student moved to deleted records.");
      setSelectedIds([]);
      await loadStudents(page, pageSize);
    } catch {
      setError("Unable to delete selected student(s).");
    } finally {
      setDeletingId(null);
      setDeleteCandidate(null);
      setBulkDeleteOpen(false);
    }
  };

  const assignSelectedStudents = async () => {
    if (!assignClassId || !assignSectionId || selectedRows.length === 0) {
      setError("Please select class, section, and at least one student.");
      return;
    }

    try {
      setAssigningBulk(true);
      setError("");
      setSuccess("");

      for (const row of selectedRows) {
        await apiPatch(`/api/v1/students/students/${row.id}/`, {
          current_class: Number(assignClassId),
          current_section: Number(assignSectionId),
          is_active: true,
        });
      }

      setAssignModalOpen(false);
      setAssignClassId("");
      setAssignSectionId("");
      setSelectedIds([]);
      setSuccess("Selected students assigned successfully.");
      await loadStudents(page, pageSize);
    } catch {
      setError("Unable to assign selected students.");
    } finally {
      setAssigningBulk(false);
    }
  };

  const goToPage = (nextPage: number) => {
    const safe = Math.min(Math.max(nextPage, 1), totalPages);
    setPage(safe);
  };

  return (
    <div className="legacy-panel unassigned-panel">
      <style>{`
        @keyframes unassignedShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        .unassigned-panel button:focus,
        .unassigned-panel input:focus,
        .unassigned-panel select:focus,
        .unassigned-panel a:focus {
          outline: 2px solid #4f46e5;
          outline-offset: 2px;
        }
      `}</style>
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Unassigned Student</h1>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "grid", gap: 6, justifyItems: "end", marginTop: 4 }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 18 }}>Jump To</span>
                <div style={{ display: "flex", gap: 8, marginLeft: 18 }}>
                <Link href="/students/multi-class" style={{ ...buttonStyle("#16a34a"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Multi Class Student
                </Link>
                <Link href="/students/delete-record" style={{ ...buttonStyle("#dc2626"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Delete Student Record
                </Link>
              </div>
              </div>
              <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
                <Link href="/dashboard" style={{ color: "inherit", textDecoration: "none" }}>Dashboard</Link>
                <span>/</span>
                <Link href="/students/list" style={{ color: "inherit", textDecoration: "none" }}>Student Information</Link>
                <span>/</span>
                <Link href="/students/unassigned" style={{ color: "inherit", textDecoration: "none" }}>Unassigned Student</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 12 }}>
          <div className="white-box" style={boxStyle()}>
            <div style={{ display: "grid", gap: 8 }}>
              <input
                value={search}
                onChange={(event) => {
                  setSearch(sanitizeSearchInput(event.target.value));
                  setPage(1);
                }}
                placeholder="Search by admission, roll, name"
                style={fieldStyle()}
                aria-label="Search unassigned students"
              />
              {searchError ? <p style={{ margin: 0, color: "var(--warning)", fontSize: 12 }}>{searchError}</p> : null}
            </div>
          </div>

          <div className="white-box" style={boxStyle()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <h3 style={{ margin: 0 }}>Records Found: {totalCount}</h3>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  type="button"
                  style={buttonStyle("#1d4ed8")}
                  disabled={selectedIds.length === 0}
                  onClick={() => setAssignModalOpen(true)}
                >
                  Bulk Assign to Class
                </button>
                <button
                  type="button"
                  style={buttonStyle("#dc2626")}
                  disabled={selectedIds.length === 0}
                  onClick={() => setBulkDeleteOpen(true)}
                >
                  Delete Selected
                </button>
              </div>
            </div>
            {error && <p style={{ color: "var(--warning)", marginBottom: 10 }}>{error}</p>}
            {success && <p style={{ color: "#0f766e", marginBottom: 10 }}>{success}</p>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <input type="checkbox" checked={allVisibleSelected} onChange={toggleAllVisible} aria-label="Select all students" />
                    </th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Roll No</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Guardian</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Date Of Birth</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Gender</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Type</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Phone</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listLoading || metaLoading ? (
                    Array.from({ length: 6 }).map((_, rowIndex) => (
                      <tr key={`skeleton-${rowIndex}`}>
                        {Array.from({ length: 10 }).map((__, colIndex) => (
                          <td key={`cell-${rowIndex}-${colIndex}`} style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                            <div style={{ ...skeletonCell(), width: colIndex === 0 ? 18 : colIndex === 3 ? "75%" : "60%" }} />
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : listError ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 14, color: "var(--warning)" }}>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                          <span>{listError}</span>
                          <button type="button" style={buttonStyle("#1d4ed8")} onClick={() => void loadStudents(page, pageSize)}>
                            Retry
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : students.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: 12, color: "var(--text-muted)" }}>
                        No Students Found
                      </td>
                    </tr>
                  ) : (
                    students.map((row) => {
                      const guardian = row.guardian ? guardianMap.get(row.guardian) : null;
                      const categoryName = row.category ? categoryMap.get(row.category) : null;
                      return (
                        <tr key={row.id}>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={() => toggleSelection(row.id)}
                              aria-label={`Select ${fullName(row)}`}
                            />
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.admission_no || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.roll_no || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{fullName(row)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{guardian?.full_name || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{formatDate(row.date_of_birth)}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textTransform: "capitalize" }}>{row.gender || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{categoryName || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{guardian?.phone || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                              <Link
                                href={`/students/add?mode=edit&id=${row.id}`}
                                style={{ ...buttonStyle("#0284c7"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}
                                aria-label="Edit Student"
                              >
                                Edit
                              </Link>
                              <Link
                                href={`/students/assign-class/${row.id}`}
                                style={{ ...buttonStyle("#0f766e"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}
                                aria-label="Assign Class"
                              >
                                Assign Class
                              </Link>
                              <button
                                type="button"
                                disabled={deletingId === row.id}
                                style={buttonStyle("#dc2626")}
                                onClick={() => setDeleteCandidate(row)}
                                aria-label="Delete Student"
                              >
                                Delete
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

            <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ color: "var(--text-muted)", fontSize: 13 }}>
                Page {page} of {totalPages} | Total {totalCount}
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  Rows
                  <select
                    value={pageSize}
                    onChange={(event) => {
                      setPageSize(Number(event.target.value));
                      setPage(1);
                    }}
                    style={{ ...fieldStyle(), width: 86 }}
                  >
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </label>

                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                  Jump
                  <input
                    value={jumpPageInput}
                    onChange={(event) => setJumpPageInput(event.target.value.replace(/[^0-9]/g, ""))}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" && jumpPageInput) {
                        goToPage(Number(jumpPageInput));
                        setJumpPageInput("");
                      }
                    }}
                    placeholder="Page"
                    style={{ ...fieldStyle(), width: 86 }}
                  />
                </label>

                <div style={{ display: "inline-flex", gap: 6 }}>
                  <button type="button" aria-label="First page" style={buttonStyle("#64748b")} disabled={page <= 1 || listLoading} onClick={() => goToPage(1)}>⏮</button>
                  <button type="button" aria-label="Previous page" style={buttonStyle("#64748b")} disabled={page <= 1 || listLoading} onClick={() => goToPage(page - 1)}>⏪</button>
                  <button type="button" aria-label="Next page" style={buttonStyle("#64748b")} disabled={page >= totalPages || listLoading} onClick={() => goToPage(page + 1)}>⏩</button>
                  <button type="button" aria-label="Last page" style={buttonStyle("#64748b")} disabled={page >= totalPages || listLoading} onClick={() => goToPage(totalPages)}>⏭</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <ConfirmationModal
        isOpen={deleteCandidate !== null}
        title="Delete Student"
        message={`Move ${deleteCandidate ? fullName(deleteCandidate) : "this student"} to deleted records?`}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={deletingId !== null}
        onConfirm={() => deleteCandidate ? void removeStudents([deleteCandidate.id]) : undefined}
        onCancel={() => setDeleteCandidate(null)}
      />

      <ConfirmationModal
        isOpen={bulkDeleteOpen}
        title="Delete Selected Students"
        message={`Move ${selectedIds.length} selected student${selectedIds.length === 1 ? "" : "s"} to deleted records?`}
        confirmLabel="Delete Selected"
        cancelLabel="Cancel"
        isConfirming={deletingId !== null}
        onConfirm={() => void removeStudents(selectedIds)}
        onCancel={() => setBulkDeleteOpen(false)}
      />

      {assignModalOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15, 23, 42, 0.55)",
            display: "grid",
            placeItems: "center",
            zIndex: 1000,
            padding: 16,
          }}
        >
          <div style={{ ...boxStyle(), maxWidth: 520, width: "100%" }}>
            <h3 style={{ margin: "0 0 12px" }}>Bulk Assign to Class</h3>
            <p style={{ margin: "0 0 12px", color: "var(--text-muted)" }}>
              Assign {selectedRows.length} selected student{selectedRows.length === 1 ? "" : "s"} to a class and section.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Class *</label>
                <select value={assignClassId} onChange={(event) => setAssignClassId(event.target.value)} style={fieldStyle()}>
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Section *</label>
                <select value={assignSectionId} onChange={(event) => setAssignSectionId(event.target.value)} style={fieldStyle()} disabled={!assignClassId}>
                  <option value="">Select section</option>
                  {assignSectionOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 14 }}>
              <button type="button" style={buttonStyle("#64748b")} onClick={() => setAssignModalOpen(false)} disabled={assigningBulk}>
                Cancel
              </button>
              <button
                type="button"
                style={buttonStyle("#1d4ed8")}
                onClick={() => void assignSelectedStudents()}
                disabled={!assignClassId || !assignSectionId || assigningBulk || selectedRows.length === 0}
              >
                {assigningBulk ? "Assigning..." : "Assign Selected"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
