"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { buildPaginationQuery, extractListData, extractPaginationMeta, type ListApiResponse } from "@/lib/pagination";
import { PaginationControls } from "@/components/common/PaginationControls";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";

type SchoolClass = {
  id: number;
  name: string;
};

type Section = {
  id: number;
  school_class: number;
  name: string;
};

type StudentRow = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name?: string;
  date_of_birth?: string | null;
  gender: "male" | "female" | "other";
  blood_group?: string;
  phone?: string;
  category?: number | null;
  guardian?: number | null;
  current_class?: number | null;
  current_section?: number | null;
  is_disabled: boolean;
  is_active: boolean;
  created_at: string;
};

type Guardian = {
  id: number;
  full_name: string;
  phone?: string;
};

type StudentCategory = {
  id: number;
  name: string;
};

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
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

function actionLinkStyle(color: string) {
  return {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 30,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 6,
    padding: "0 10px",
    textDecoration: "none",
    fontSize: 12,
    fontWeight: 600,
  } as const;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs = 10000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("Request timed out")), timeoutMs);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function getClassSortRank(className: string): number {
  const normalized = className.trim().toUpperCase();
  if (!normalized) return 9999;
  if (normalized === "LKG") return 1;
  if (normalized === "UKG") return 2;

  const numericMatch = normalized.match(/\d+/);
  if (numericMatch) {
    const grade = Number(numericMatch[0]);
    if (!Number.isNaN(grade)) {
      return 100 + grade;
    }
  }

  return 1000;
}

export function StudentListPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("students.list", 1, 10);
  const [rows, setRows] = useState<StudentRow[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [categories, setCategories] = useState<StudentCategory[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [queryMode, setQueryMode] = useState<"none" | "filtered" | "whole">("none");
  const [appliedFilters, setAppliedFilters] = useState<{
    search: string;
    classId: string;
    sectionId: string;
    statusFilter: "all" | "active" | "inactive";
  }>({
    search: "",
    classId: "",
    sectionId: "",
    statusFilter: "all",
  });
  const [loading, setLoading] = useState(true);
  const [filterLoading, setFilterLoading] = useState(true);
  const [error, setError] = useState("");

  const classNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of classes) map.set(item.id, item.name);
    return map;
  }, [classes]);

  const sectionNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of sections) map.set(item.id, item.name);
    return map;
  }, [sections]);

  const guardianById = useMemo(() => {
    const map = new Map<number, Guardian>();
    for (const item of guardians) map.set(item.id, item);
    return map;
  }, [guardians]);

  const categoryNameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const item of categories) map.set(item.id, item.name);
    return map;
  }, [categories]);

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((section) => String(section.school_class) === classId);
  }, [sections, classId]);

  const sortedRows = useMemo(() => {
    return [...rows].sort((a, b) => {
      const classNameA = classNameById.get(Number(a.current_class)) || "Unassigned";
      const classNameB = classNameById.get(Number(b.current_class)) || "Unassigned";
      const classRankA = getClassSortRank(classNameA);
      const classRankB = getClassSortRank(classNameB);

      if (classRankA !== classRankB) {
        return classRankA - classRankB;
      }

      const byClassName = classNameA.localeCompare(classNameB, undefined, { numeric: true, sensitivity: "base" });
      if (byClassName !== 0) return byClassName;

      const sectionNameA = sectionNameById.get(Number(a.current_section)) || "";
      const sectionNameB = sectionNameById.get(Number(b.current_section)) || "";
      const bySection = sectionNameA.localeCompare(sectionNameB, undefined, { numeric: true, sensitivity: "base" });
      if (bySection !== 0) return bySection;

      const admissionA = String(a.admission_no || "").trim();
      const admissionB = String(b.admission_no || "").trim();
      if (admissionA && admissionB) {
        const byAdmission = admissionA.localeCompare(admissionB, undefined, { numeric: true, sensitivity: "base" });
        if (byAdmission !== 0) return byAdmission;
      }
      return a.id - b.id;
    });
  }, [rows, classNameById, sectionNameById]);

  const loadStudents = async (targetPage = page, targetPageSize = pageSize) => {
    try {
      setLoading(true);
      setError("");
      const query = buildPaginationQuery(targetPage, targetPageSize, {
        search: appliedFilters.search.trim() || undefined,
        current_class: appliedFilters.classId || undefined,
        current_section: appliedFilters.sectionId || undefined,
        is_active:
          appliedFilters.statusFilter === "all"
            ? undefined
            : appliedFilters.statusFilter === "active"
              ? "true"
              : "false",
      });
      const studentData = await withTimeout(apiGet<ListApiResponse<StudentRow>>(`/api/v1/students/students/?${query}`), 10000);
      const items = extractListData(studentData);
      const meta = extractPaginationMeta(studentData);
      setRows(items);
      setTotalCount(meta?.count ?? items.length);
    } catch (loadError) {
      const message = loadError instanceof Error && loadError.message.includes("timed out")
        ? "Failed to load data (request timed out)."
        : "Failed to load data.";
      setRows([]);
      setTotalCount(0);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const load = async () => {
    try {
      setFilterLoading(true);
      setError("");
      const [classData, sectionData, guardianData, categoryData] = await Promise.all([
        withTimeout(apiGet<ListApiResponse<SchoolClass>>("/api/v1/core/classes/"), 8000),
        apiGet<ListApiResponse<Section>>("/api/v1/core/sections/"),
        apiGet<ListApiResponse<Guardian>>("/api/v1/students/guardians/"),
        apiGet<ListApiResponse<StudentCategory>>("/api/v1/students/categories/"),
      ]);
      setClasses(extractListData(classData));
      setSections(extractListData(sectionData));
      setGuardians(extractListData(guardianData));
      setCategories(extractListData(categoryData));
    } catch {
      setError("Unable to load filter options.");
    } finally {
      setFilterLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (queryMode === "none") {
      setRows([]);
      setTotalCount(0);
      setLoading(false);
      return;
    }
    void loadStudents();
  }, [page, pageSize, queryMode, appliedFilters]);

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Student List</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Student Information</span>
              <span>/</span>
              <span>Student List</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <div className="student-filter-grid" role="group" aria-label="Student list filters">
              <select
                value={classId}
                onChange={(event) => {
                  setClassId(event.target.value);
                  setSectionId("");
                  setPage(1);
                }}
                style={fieldStyle()}
                aria-label="Filter by class"
                disabled={filterLoading}
              >
                <option value="">Select Class</option>
                {classes.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select
                value={sectionId}
                onChange={(event) => {
                  setSectionId(event.target.value);
                  setPage(1);
                }}
                style={fieldStyle()}
                disabled={!classId}
                aria-label="Filter by section"
              >
                <option value="">Select Section</option>
                {filteredSections.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                value={searchInput}
                onChange={(event) => {
                  setSearchInput(event.target.value);
                }}
                placeholder="Search by name or roll no"
                style={fieldStyle()}
                aria-label="Search students"
              />
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value as "all" | "active" | "inactive");
                }}
                style={fieldStyle()}
                aria-label="Filter by status"
              >
                <option value="all">Status: All</option>
                <option value="active">Status: Active</option>
                <option value="inactive">Status: Inactive</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  const hasAnyFilter = Boolean(
                    searchInput.trim() || classId || sectionId || statusFilter !== "all",
                  );
                  if (!hasAnyFilter) {
                    setError("Use a search value or filter before searching, or click Show Whole Students.");
                    setQueryMode("none");
                    setRows([]);
                    setTotalCount(0);
                    return;
                  }

                  setError("");
                  setAppliedFilters({
                    search: searchInput,
                    classId,
                    sectionId,
                    statusFilter,
                  });
                  setQueryMode("filtered");
                  setPage(1);
                }}
                style={buttonStyle("#0f766e")}
                aria-label="Search students"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setSearchInput("");
                  setClassId("");
                  setSectionId("");
                  setStatusFilter("all");
                  setAppliedFilters({
                    search: "",
                    classId: "",
                    sectionId: "",
                    statusFilter: "all",
                  });
                  setQueryMode("whole");
                  setPage(1);
                }}
                style={buttonStyle("#1d4ed8")}
                aria-label="Show whole students list"
              >
                Show Whole Students
              </button>
              <button
                type="button"
                onClick={() => {
                  setClassId("");
                  setSectionId("");
                  setSearchInput("");
                  setStatusFilter("all");
                  setAppliedFilters({
                    search: "",
                    classId: "",
                    sectionId: "",
                    statusFilter: "all",
                  });
                  setQueryMode("none");
                  setRows([]);
                  setTotalCount(0);
                  setError("");
                  setPage(1);
                }}
                style={buttonStyle("#6b7280")}
                aria-label="Reset all filters"
              >
                🗑 Reset
              </button>
            </div>
          </div>

          <div className="white-box" style={boxStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Student List</h3>
            {error && <p style={{ color: "var(--warning)", marginBottom: 10 }}>{error}</p>}
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }} aria-label="Student list table">
                <thead>
                  <tr>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>SL</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Roll No</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Date Of Birth</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Gender</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Type</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Phone</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Class</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Section</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th>
                    <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {queryMode === "none" ? (
                    <tr>
                      <td colSpan={12} style={{ padding: 12, color: "var(--text-muted)" }}>
                        Use Search or Show Whole Students to view data.
                      </td>
                    </tr>
                  ) : loading ? (
                    <tr>
                      <td colSpan={12} style={{ padding: 12, color: "var(--text-muted)" }}>
                        <span role="status" aria-live="polite">Loading students...</span>
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ padding: 12, color: "var(--text-muted)" }}>
                        {error ? "Failed to load data" : "No Students Found"}
                      </td>
                    </tr>
                  ) : (
                    sortedRows.map((row, index) => (
                      <tr key={row.id} tabIndex={0} className="student-row-focusable">
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{(page - 1) * pageSize + index + 1}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.admission_no || "-"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.roll_no || "-"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          {`${row.first_name || ""} ${row.last_name || ""}`.trim() || "-"}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.date_of_birth || "Data Not Available"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)", textTransform: "capitalize" }}>{row.gender || "-"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.category ? categoryNameById.get(row.category) || "Data Not Available" : "Data Not Available"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          {row.phone || (row.guardian ? guardianById.get(row.guardian)?.phone : "") || "Data Not Available"}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{classNameById.get(Number(row.current_class)) || "-"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{sectionNameById.get(Number(row.current_section)) || "-"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          {row.is_active ? (row.is_disabled ? "Disabled" : "Active") : "Inactive"}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                            <Link href={`/students/add?mode=view&id=${row.id}`} style={actionLinkStyle("#0f766e")}>
                              View
                            </Link>
                            <Link href={`/students/add?mode=edit&id=${row.id}`} style={actionLinkStyle("#1d4ed8")}>
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {queryMode !== "none" ? (
              <PaginationControls
                currentPage={page}
                totalPages={totalPages}
                totalItems={totalCount}
                pageSize={pageSize}
                loading={loading}
                pageSizeOptions={[10, 25]}
                onPageChange={(nextPage) => setPage(nextPage)}
                onPageSizeChange={(nextSize) => {
                  setPageSize(nextSize);
                  setPage(1);
                }}
              />
            ) : null}
          </div>
        </div>
      </section>

      <style jsx>{`
        .student-filter-grid {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 10px;
          align-items: center;
        }

        .student-row-focusable:focus {
          outline: 2px solid #2563eb;
          outline-offset: -2px;
          background: #eff6ff;
        }

        :global(.admin-visitor-area button:focus),
        :global(.admin-visitor-area select:focus),
        :global(.admin-visitor-area input:focus) {
          outline: 2px solid #2563eb;
          outline-offset: 1px;
        }

        :global(.admin-visitor-area button) {
          border-radius: 10px;
        }

        :global(.admin-visitor-area .pagination button) {
          background: #1d4ed8;
          border-color: #1d4ed8;
          color: #fff;
        }

        @media (max-width: 992px) {
          .student-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }
        }

        @media (max-width: 640px) {
          .student-filter-grid {
            grid-template-columns: 1fr;
          }

          :global(.admin-visitor-area button) {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
}
