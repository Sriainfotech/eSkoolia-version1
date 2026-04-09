"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type ApiList<T> = T[] | { results?: T[] };

type AcademicYear = { id: number; name: string; is_current?: boolean };
type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };

type StudentRow = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name?: string;
  current_class?: number | null;
  current_section?: number | null;
  is_active: boolean;
};

type PromoteResponse = {
  success?: boolean;
  promoted?: number;
  failed?: number;
  total?: number;
  errors?: Array<{ student_id: number; admission_no: string; error: string }>;
  message?: string;
  detail?: string;
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
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

function fieldStyle(hasError = false) {
  return {
    width: "100%",
    height: 36,
    border: `1px solid ${hasError ? "#dc2626" : "var(--line)"}`,
    borderRadius: 8,
    padding: "0 10px",
    backgroundColor: hasError ? "#fef2f2" : "transparent",
    fontFamily: "inherit",
    fontSize: 13,
  } as const;
}

function btnStyle(color = "var(--primary)", disabled = false) {
  return {
    height: 36,
    padding: "0 14px",
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
  } as const;
}

function secondaryBtnStyle(disabled = false) {
  return {
    height: 36,
    padding: "0 14px",
    border: "1px solid var(--line)",
    background: "transparent",
    color: "var(--primary)",
    borderRadius: 8,
    cursor: disabled ? "not-allowed" : "pointer",
    fontSize: 13,
    opacity: disabled ? 0.6 : 1,
    fontFamily: "inherit",
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

function errorBoxStyle() {
  return {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: "var(--radius)",
    padding: 12,
    marginBottom: 12,
    color: "#dc2626",
    fontSize: 13,
  } as const;
}

function successBoxStyle() {
  return {
    background: "#ecfdf5",
    border: "1px solid #a7f3d0",
    borderRadius: "var(--radius)",
    padding: 12,
    marginBottom: 12,
    color: "#059669",
    fontSize: 13,
  } as const;
}

function fullName(row: StudentRow) {
  return `${row.first_name || ""} ${row.last_name || ""}`.trim() || "-";
}

function sanitizeLabel(value: string) {
  return String(value || "").replace(/<[^>]*>/g, "").trim();
}

function formatClassDisplayName(name: string, id: number) {
  const cleaned = sanitizeLabel(name);
  if (!cleaned) {
    return `Class ${id}`;
  }
  if (/^\d+$/.test(cleaned)) {
    return `Class ${cleaned}`;
  }
  return cleaned
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export function StudentPromotePanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [currentSections, setCurrentSections] = useState<Section[]>([]);
  const [promoteSections, setPromoteSections] = useState<Section[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);

  const [currentYearId, setCurrentYearId] = useState("");
  const [currentClassId, setCurrentClassId] = useState("");
  const [currentSectionId, setCurrentSectionId] = useState("");

  const [promoteYearId, setPromoteYearId] = useState("");
  const [promoteClassId, setPromoteClassId] = useState("");
  const [promoteSectionId, setPromoteSectionId] = useState("");

  const [checked, setChecked] = useState<Record<number, boolean>>({});

  const [loadingCriteria, setLoadingCriteria] = useState(true);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingCurrentSections, setLoadingCurrentSections] = useState(false);
  const [loadingPromoteSections, setLoadingPromoteSections] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Validation errors
  const [searchErrors, setSearchErrors] = useState<Record<string, string>>({});
  const [promoteErrors, setPromoteErrors] = useState<Record<string, string>>({});

  // Confirmation modal state
  const [showConfirm, setShowConfirm] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const validAcademicYears = useMemo(
    () => years.filter((item) => /^\d{4}-\d{4}$/.test(sanitizeLabel(item.name))),
    [years],
  );

  const normalizedClasses = useMemo(
    () => classes.map((item) => ({ ...item, display_name: formatClassDisplayName(item.name, item.id) })),
    [classes],
  );

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingCriteria(true);
        setError("");
        const [yearData, classData, sectionData] = await Promise.all([
          apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
          apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
          apiGet<ApiList<Section>>("/api/v1/core/sections/?page_size=200"),
        ]);
        const loadedYears = listData(yearData);
        setYears(loadedYears);
        setClasses(listData(classData));
        const allSections = listData(sectionData);
        setCurrentSections(allSections);
        setPromoteSections(allSections);

        const current = loadedYears.find((item) => item.is_current && /^\d{4}-\d{4}$/.test(sanitizeLabel(item.name)));
        if (current) {
          setCurrentYearId(String(current.id));

          const [start] = sanitizeLabel(current.name).split("-");
          const nextStart = Number(start) + 1;
          const nextYear = loadedYears.find((item) => sanitizeLabel(item.name) === `${nextStart}-${nextStart + 1}`);
          if (nextYear) {
            setPromoteYearId(String(nextYear.id));
          }
        }

        if (!current) {
          const now = new Date();
          const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
          const suggested = `${startYear + 1}-${startYear + 2}`;
          const suggestedYear = loadedYears.find((item) => sanitizeLabel(item.name) === suggested);
          if (suggestedYear) {
            setPromoteYearId(String(suggestedYear.id));
          }
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        setError(message && message !== "401" ? message : "Unable to load promote criteria.");
      } finally {
        setLoadingCriteria(false);
      }
    };
    void load();
  }, []);

  const loadSectionsForClass = async (targetClassId: string, type: "current" | "promote") => {
    if (!targetClassId) {
      if (type === "current") {
        setCurrentSections([]);
        setCurrentSectionId("");
      } else {
        setPromoteSections([]);
        setPromoteSectionId("");
      }
      return;
    }

    try {
      if (type === "current") {
        setLoadingCurrentSections(true);
        setCurrentSectionId("");
      } else {
        setLoadingPromoteSections(true);
        setPromoteSectionId("");
      }

      const data = await apiGet<ApiList<Section>>(`/api/v1/core/sections/?class=${encodeURIComponent(targetClassId)}&page_size=200`);
      const nextSections = listData(data);
      if (type === "current") {
        setCurrentSections(nextSections);
      } else {
        setPromoteSections(nextSections);
      }
    } catch {
      setError("Unable to load sections for selected class.");
    } finally {
      if (type === "current") {
        setLoadingCurrentSections(false);
      } else {
        setLoadingPromoteSections(false);
      }
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (currentClassId) {
        void loadSectionsForClass(currentClassId, "current");
      } else {
        setCurrentSections([]);
        setCurrentSectionId("");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [currentClassId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (promoteClassId) {
        void loadSectionsForClass(promoteClassId, "promote");
      } else {
        setPromoteSections([]);
        setPromoteSectionId("");
      }
    }, 300);
    return () => window.clearTimeout(timer);
  }, [promoteClassId]);

  const classMap = useMemo(() => new Map(normalizedClasses.map((item) => [item.id, item.display_name])), [normalizedClasses]);
  const sectionMap = useMemo(() => {
    const merged = [...currentSections, ...promoteSections];
    return new Map(merged.map((item) => [item.id, sanitizeLabel(item.name)]));
  }, [currentSections, promoteSections]);

  const searchedRows = useMemo(() => {
    return students.filter((row) => {
      if (!row.is_active) {
        return false;
      }
      if (currentClassId && String(row.current_class || "") !== currentClassId) {
        return false;
      }
      if (currentSectionId && String(row.current_section || "") !== currentSectionId) {
        return false;
      }
      return true;
    });
  }, [students, currentClassId, currentSectionId]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(searchedRows.length / pageSize));
  const paginatedRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return searchedRows.slice(start, start + pageSize);
  }, [searchedRows, currentPage]);

  const selectedIds = useMemo(
    () => Object.entries(checked).filter(([, value]) => value).map(([id]) => Number(id)),
    [checked],
  );

  // Validate search criteria
  const validateSearch = (): boolean => {
    const errors: Record<string, string> = {};
    if (!currentClassId) errors.class = "Please select current class";
    if (!currentSectionId) errors.section = "Please select current section";
    setSearchErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Validate promote criteria
  const validatePromote = (): boolean => {
    const errors: Record<string, string> = {};
    if (!promoteYearId) errors.year = "Please select next academic year";
    if (!promoteClassId) errors.class = "Please select next class";
    if (!promoteSectionId) errors.section = "Please select next section";

    // Check current class is not same as promote class
    if (promoteClassId && currentClassId && promoteClassId === currentClassId) {
      errors.class = "Next class cannot be the same as current class";
    }

    const selectedYear = validAcademicYears.find((item) => String(item.id) === promoteYearId);
    if (promoteYearId && !selectedYear) {
      errors.year = "Please select a valid academic year";
    }

    setPromoteErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const canSearch = Boolean(currentClassId && currentSectionId && !loadingStudents && !loadingCurrentSections);

  const search = async () => {
    if (!validateSearch()) {
      return;
    }

    try {
      setLoadingStudents(true);
      setError("");
      setSuccess("");
      setCurrentPage(1);
      const data = await apiGet<ApiList<StudentRow>>("/api/v1/students/students/?is_active=true");
      const rows = listData(data);
      setStudents(rows);
      const init: Record<number, boolean> = {};
      rows.forEach((row) => {
        init[row.id] = false;
      });
      setChecked(init);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Unable to fetch students for promotion.");
    } finally {
      setLoadingStudents(false);
    }
  };

  const setAll = (value: boolean) => {
    const next: Record<number, boolean> = {};
    paginatedRows.forEach((row) => {
      next[row.id] = value;
    });
    setChecked((prev) => ({ ...prev, ...next }));
  };

  const promoteConfirmed = async () => {
    if (!selectedIds.length) {
      setError("Please select at least one student");
      return;
    }

    if (!validatePromote()) {
      return;
    }

    try {
      setPromoting(true);
      setError("");
      setSuccess("");
      setShowConfirm(false);

      const payload = {
        student_ids: selectedIds,
        to_class: Number(promoteClassId),
        to_section: promoteSectionId ? Number(promoteSectionId) : null,
        to_academic_year: Number(promoteYearId),
        note: "Promoted from Student Promote panel",
      };

      const result = await apiPost<PromoteResponse>("/api/v1/students/students/promote/", payload);

      // Handle success response
      if (result.promoted !== undefined) {
        const total = result.promoted + (result.failed || 0);
        if (result.failed && result.failed > 0) {
          setSuccess(`✓ ${result.promoted} students promoted, ${result.failed} failed`);
          if (result.errors && result.errors.length > 0) {
            setError(`Failed students: ${result.errors.map((e) => e.admission_no).join(", ")}`);
          }
        } else {
          setSuccess(`✓ All ${result.promoted} students promoted successfully!`);
        }
      } else {
        setSuccess("Students promoted successfully.");
      }

      // Reset form
      setChecked({});
      setPromoteYearId("");
      setPromoteClassId("");
      setPromoteSectionId("");
      setPromoteErrors({});

      // Reload students
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await search();
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Unable to promote selected students.");
    } finally {
      setPromoting(false);
    }
  };

  const promote = () => {
    if (!selectedIds.length) {
      setError("Please select at least one student");
      return;
    }
    if (!validatePromote()) {
      return;
    }
    setShowConfirm(true);
  };

  return (
    <div className="legacy-panel student-promote-panel">
      <style>{`
        .student-promote-panel button:focus,
        .student-promote-panel select:focus,
        .student-promote-panel input:focus {
          outline: 2px solid #5D87FF;
          outline-offset: 2px;
        }
      `}</style>
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}><span aria-hidden="true" style={{ color: "#5D87FF" }}>🎓</span> Student Promote</h1>
            <div style={{ display: "flex", gap: 8, color: "#666666", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Student Information</span>
              <span>/</span>
              <span>Student Promote</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 16 }}>
          {/* Error/Success Messages */}
          {error && (
            <div style={errorBoxStyle()}>
              ⚠️ {error}
            </div>
          )}
          {success && (
            <div style={successBoxStyle()}>
              {success}
            </div>
          )}

          {/* Search Criteria Section */}
          <div className="white-box" style={boxStyle()}>
            <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 16, fontWeight: 600 }}><span aria-hidden="true" style={{ color: "#5D87FF" }}>🔍</span> Search Criteria</h3>
            <p style={{ margin: "0 0 12px", color: "var(--text-muted)", fontSize: 13 }}>Select criteria to view students</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(180px, 1fr)) auto", gap: 12, marginBottom: 6, alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>Academic Year</label>
                <select
                  aria-label="Current academic year"
                  value={currentYearId}
                  onChange={(e) => setCurrentYearId(e.target.value)}
                  style={fieldStyle()}
                  disabled={loadingCriteria}
                >
                  <option value="">Select Academic Year</option>
                  {validAcademicYears.map((item) => (
                    <option key={item.id} value={item.id}>
                      {sanitizeLabel(item.name)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                  Current Class <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  aria-label="Current class"
                  value={currentClassId}
                  onChange={(e) => {
                    setCurrentClassId(e.target.value);
                    setCurrentSections([]);
                    setSearchErrors((prev) => ({ ...prev, class: "" }));
                  }}
                  style={fieldStyle(!!searchErrors.class)}
                >
                  <option value="">Select Class</option>
                  {normalizedClasses.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.display_name}
                    </option>
                  ))}
                </select>
                {searchErrors.class && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{searchErrors.class}</p>}
              </div>

              <div>
                <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                  Current Section <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <select
                  aria-label="Current section"
                  value={currentSectionId}
                  onChange={(e) => {
                    setCurrentSectionId(e.target.value);
                    setSearchErrors((prev) => ({ ...prev, section: "" }));
                  }}
                  style={fieldStyle(!!searchErrors.section)}
                  disabled={!currentClassId || loadingCurrentSections}
                >
                  <option value="">{loadingCurrentSections ? "Loading sections..." : currentClassId ? "Select Section" : "Select Class First"}</option>
                  {currentSections.map((item) => (
                    <option key={item.id} value={item.id}>
                      {sanitizeLabel(item.name)}
                    </option>
                  ))}
                </select>
                {searchErrors.section && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{searchErrors.section}</p>}
              </div>

              <button
                type="button"
                onClick={() => void search()}
                style={btnStyle("var(--primary)", !canSearch)}
                disabled={!canSearch}
                aria-label="Search students"
              >
                {loadingStudents ? "⏳ Fetching..." : "🔍 Search"}
              </button>
            </div>
            {!currentClassId || !currentSectionId ? (
              <p style={{ margin: 0, fontSize: 12, color: "#dc2626" }}>Please select Class and Section to continue</p>
            ) : null}
          </div>

          {/* Students Table Section */}
          {students.length > 0 ? (
            <div className="white-box" style={boxStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>📋 Select Students ({selectedIds.length} selected)</h3>
                <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Page {currentPage} of {totalPages} | Total: {searchedRows.length}
                </span>
              </div>

              <div style={{ overflowX: "auto", marginBottom: 16 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)" }}>
                      <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left", width: 60 }}>
                        <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <input
                            type="checkbox"
                            onChange={(e) => setAll(e.target.checked)}
                            checked={paginatedRows.length > 0 && paginatedRows.every((row) => checked[row.id])}
                            aria-label="Select all students on current page"
                          />
                          All
                        </label>
                      </th>
                      <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left" }}>Admission No</th>
                      <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left" }}>Name</th>
                      <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left" }}>Class/Section</th>
                      <th style={{ padding: 12, borderBottom: "2px solid var(--line)", textAlign: "left" }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRows.map((row) => (
                      <tr key={row.id} style={{ borderBottom: "1px solid var(--line)" }}>
                        <td style={{ padding: 12 }}>
                          <input
                            type="checkbox"
                            checked={!!checked[row.id]}
                            onChange={(e) => setChecked((prev) => ({ ...prev, [row.id]: e.target.checked }))}
                            aria-label={`Select ${fullName(row)}`}
                          />
                        </td>
                        <td style={{ padding: 12, fontWeight: 500 }}>{row.admission_no || "-"}</td>
                        <td style={{ padding: 12 }}>{fullName(row)}</td>
                        <td style={{ padding: 12, fontSize: 13, color: "var(--text-muted)" }}>
                          {(classMap.get(row.current_class || 0) || "-") +
                            (row.current_section ? ` (${sectionMap.get(row.current_section) || "-"})` : "")}
                        </td>
                        <td style={{ padding: 12 }}>
                          <span style={{ background: "#ecfdf5", color: "#059669", padding: "4px 8px", borderRadius: 4, fontSize: 12, fontWeight: 500 }}>
                            Active ✓
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div style={{ display: "flex", gap: 6, justifyContent: "center", alignItems: "center", marginBottom: 16 }}>
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    style={secondaryBtnStyle(currentPage === 1)}
                  >
                    ← Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      style={{
                        ...secondaryBtnStyle(false),
                        background: currentPage === page ? "var(--primary)" : "transparent",
                        color: currentPage === page ? "#fff" : "var(--primary)",
                        fontWeight: currentPage === page ? 600 : 400,
                      }}
                    >
                      {page}
                    </button>
                  ))}
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    style={secondaryBtnStyle(currentPage === totalPages)}
                  >
                    Next →
                  </button>
                </div>
              )}

              {/* Promotion Preview Section */}
              <div style={{ background: "#f3f4f6", padding: 16, borderRadius: 8, marginBottom: 16 }}>
                <h4 style={{ marginTop: 0, marginBottom: 12, fontSize: 14, fontWeight: 600 }}>📋 Promotion Summary</h4>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  <div style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Students Selected</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: "var(--primary)" }}>{selectedIds.length}</div>
                  </div>
                  <div style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Destination</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {promoteClassId ? classMap.get(Number(promoteClassId)) || "N/A" : "Not selected"}
                      {promoteSectionId ? ` (${sectionMap.get(Number(promoteSectionId)) || "N/A"})` : ""}
                    </div>
                  </div>
                  <div style={{ background: "#fff", padding: 12, borderRadius: 6, border: "1px solid var(--line)" }}>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Next Academic Year</div>
                    <div style={{ fontSize: 14, fontWeight: 500 }}>
                      {promoteYearId ? validAcademicYears.find((y) => String(y.id) === promoteYearId)?.name || "N/A" : "Not selected"}
                    </div>
                  </div>
                </div>
              </div>

              {/* Promotion Options Section */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                    Next Academic Year <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    aria-label="Next academic year"
                    value={promoteYearId}
                    onChange={(e) => {
                      setPromoteYearId(e.target.value);
                      setPromoteErrors((prev) => ({ ...prev, year: "" }));
                    }}
                    style={fieldStyle(!!promoteErrors.year)}
                  >
                    <option value="">Select Year</option>
                    {validAcademicYears
                      .filter((item) => !currentYearId || String(item.id) !== currentYearId)
                      .map((item) => (
                        <option key={item.id} value={item.id}>
                          {sanitizeLabel(item.name)}
                        </option>
                      ))}
                  </select>
                  {promoteErrors.year && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{promoteErrors.year}</p>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                    Next Class <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    aria-label="Next class"
                    value={promoteClassId}
                    onChange={(e) => {
                      setPromoteClassId(e.target.value);
                      setPromoteSections([]);
                      setPromoteErrors((prev) => ({ ...prev, class: "" }));
                    }}
                    style={fieldStyle(!!promoteErrors.class)}
                  >
                    <option value="">Select Class</option>
                    {normalizedClasses.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.display_name}
                      </option>
                    ))}
                  </select>
                  {promoteErrors.class && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{promoteErrors.class}</p>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 13, marginBottom: 6, fontWeight: 500 }}>
                    Next Section <span style={{ color: "#dc2626" }}>*</span>
                  </label>
                  <select
                    aria-label="Next section"
                    value={promoteSectionId}
                    onChange={(e) => {
                      setPromoteSectionId(e.target.value);
                      setPromoteErrors((prev) => ({ ...prev, section: "" }));
                    }}
                    style={fieldStyle(!!promoteErrors.section)}
                    disabled={!promoteClassId || loadingPromoteSections}
                  >
                    <option value="">{loadingPromoteSections ? "Loading sections..." : promoteClassId ? "Select Section" : "Select Class First"}</option>
                    {promoteSections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {sanitizeLabel(item.name)}
                      </option>
                    ))}
                  </select>
                  {promoteErrors.section && <p style={{ color: "#dc2626", fontSize: 12, margin: "4px 0 0 0" }}>{promoteErrors.section}</p>}
                </div>

                <div style={{ display: "flex", alignItems: "flex-end", gap: 6 }}>
                  <button
                    type="button"
                    onClick={() => void promote()}
                    style={btnStyle("#16a34a", promoting || !selectedIds.length)}
                    disabled={promoting || !selectedIds.length}
                    aria-label="Promote selected students"
                  >
                    {promoting ? "⏳ Promoting..." : "⬆ Promote"}
                  </button>
                </div>
              </div>
            </div>
          ) : loadingStudents ? (
            <div className="white-box" style={boxStyle()}>
              <div style={{ marginBottom: 10, color: "var(--text-muted)", fontSize: 13 }}>Loading students...</div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ padding: 10, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Student</th>
                    <th style={{ padding: 10, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Class/Section</th>
                    <th style={{ padding: 10, borderBottom: "1px solid var(--line)", textAlign: "left" }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                        <div style={{ height: 12, width: "70%", borderRadius: 999, background: "#e2e8f0" }} />
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                        <div style={{ height: 12, width: "60%", borderRadius: 999, background: "#e2e8f0" }} />
                      </td>
                      <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                        <div style={{ height: 12, width: "45%", borderRadius: 999, background: "#e2e8f0" }} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : students.length === 0 && currentClassId && currentSectionId ? (
            <div className="white-box" style={boxStyle()}>
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>No students found</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>No active students found for the selected criteria. Try changing filters.</div>
              </div>
            </div>
          ) : (
            <div className="white-box" style={boxStyle()}>
              <div style={{ textAlign: "center", padding: 40 }}>
                <div style={{ fontSize: 48, marginBottom: 12 }}>🔎</div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Select criteria to view students</div>
                <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Select class and section above, then click Search to view students.</div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius)", padding: 24, maxWidth: 400, boxShadow: "0 10px 15px rgba(0,0,0,0.1)" }}>
            <h3 style={{ margin: "0 0 12px 0", fontSize: 18, fontWeight: 600 }}>⚠️ Confirm Promotion</h3>
            <p style={{ margin: "0 0 20px 0", color: "var(--text-muted)", lineHeight: 1.6 }}>
              You are about to promote <strong>{selectedIds.length}</strong> student{selectedIds.length !== 1 ? "s" : ""} from{" "}
              <strong>{classMap.get(Number(currentClassId)) || "N/A"}</strong> ({validAcademicYears.find((item) => String(item.id) === currentYearId)?.name || "N/A"}) to{" "}
              <strong>{classMap.get(Number(promoteClassId)) || "N/A"}</strong> ({validAcademicYears.find((item) => String(item.id) === promoteYearId)?.name || "N/A"}). Proceed?
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setShowConfirm(false)} style={secondaryBtnStyle(false)} aria-label="Cancel promotion">
                Cancel
              </button>
              <button onClick={() => void promoteConfirmed()} style={btnStyle("#16a34a", promoting)} disabled={promoting} aria-label="Confirm promotion">
                {promoting ? "Promoting..." : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
