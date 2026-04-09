"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; section_name?: string; name?: string; school_class?: number };
type AcademicYear = { id: number; name: string; is_current?: boolean; start_date?: string };
type ApiList<T> = T[] | { results?: T[] } | { data?: T[] };

type ReportRow = {
  student_id: number;
  name: string;
  admission_no: string;
  present: number;
  late: number;
  absent: number;
  half_day: number;
  holiday: number;
  days: Record<number, string>;
};

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

function fieldStyle() {
  return { width: "100%", height: 40, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px", background: "var(--surface)" } as const;
}

function buttonStyle() {
  return { height: 40, padding: "0 12px", border: "1px solid var(--primary)", background: "var(--primary)", color: "#fff", borderRadius: 8, cursor: "pointer" } as const;
}

function boxStyle() {
  return { background: "#f8fafc", border: "1px solid #dbe2ea", borderRadius: "var(--radius)", padding: 16 } as const;
}

function normalizeList<T>(payload: ApiList<T> | undefined | null): T[] {
  if (!payload) return [];
  if (Array.isArray(payload)) return payload;
  const results = (payload as { results?: T[] }).results;
  const data = (payload as { data?: T[] }).data;
  return results || data || [];
}

function isPositiveInteger(value: string) {
  return /^\d+$/.test(value) && Number(value) > 0;
}

function normalizeClassLabel(label: string, id: number) {
  const trimmed = label.trim();
  if (!trimmed) return String(id);
  if (/^\d+$/.test(trimmed)) return trimmed;
  if (/^class\s*\d+$/i.test(trimmed)) return trimmed.replace(/[^\d]/g, "");
  return trimmed;
}

function isClassOptionValid(row: SchoolClass) {
  if (!Number.isInteger(row.id) || row.id <= 0) return false;
  const label = (row.class_name || row.name || "").trim();
  if (!label) return false;
  if (/[<>]/.test(label)) return false;
  if (/^(adc|undefined|null|nan)$/i.test(label)) return false;
  return true;
}

function extractReportYear(row: AcademicYear | undefined) {
  if (!row) return null;
  const name = String(row.name || "").trim();
  const match = name.match(/(\d{4})/);
  if (match) return Number(match[1]);
  if (row.start_date && /^\d{4}-\d{2}-\d{2}$/.test(row.start_date)) return Number(row.start_date.slice(0, 4));
  return null;
}

function skeletonCell(width: string | number) {
  return {
    width,
    height: 12,
    borderRadius: 999,
    background: "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
    backgroundSize: "200% 100%",
    animation: "subjectAttendanceReportShimmer 1.2s ease-in-out infinite",
  } as const;
}

export default function SubjectAttendanceReportPanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [month, setMonth] = useState(String(new Date().getMonth() + 1).padStart(2, "0"));
  const [academicYearId, setAcademicYearId] = useState("");
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [days, setDays] = useState(0);
  const [printUrl, setPrintUrl] = useState("");
  const [error, setError] = useState("");
  const [requiredError, setRequiredError] = useState("");
  const [searching, setSearching] = useState(false);
  const [loadingSections, setLoadingSections] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const sectionRef = useRef<HTMLSelectElement | null>(null);

  const validClasses = useMemo(() => classes.filter(isClassOptionValid), [classes]);
  const validYears = useMemo(() => years.filter((item) => extractReportYear(item) !== null), [years]);
  const selectedAcademicYear = useMemo(() => validYears.find((item) => String(item.id) === academicYearId), [academicYearId, validYears]);
  const derivedReportYear = useMemo(() => extractReportYear(selectedAcademicYear), [selectedAcademicYear]);
  const canSearch = Boolean(classId && sectionId && academicYearId && month && derivedReportYear);

  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  useEffect(() => {
    const load = async () => {
      try {
        const [classData, yearData] = await Promise.all([
          apiGet<{ classes: SchoolClass[] }>("/api/v1/attendance/subject-attendance/report/"),
          apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/?page_size=200"),
        ]);
        setClasses(classData.classes || []);
        const loadedYears = normalizeList(yearData);
        setYears(loadedYears);
        const current = loadedYears.find((item) => item.is_current && extractReportYear(item) !== null);
        if (current) setAcademicYearId(String(current.id));
      } catch {
        setError("Unable to load attendance report criteria");
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSectionId("");
      return;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          setLoadingSections(true);
          setError("");
          const data = await apiGet<ApiList<Section>>(`/api/v1/core/sections/?class=${classId}&page_size=200`);
          const nextSections = normalizeList(data).filter((item) => Number(item.school_class) === Number(classId));
          setSections(nextSections);
        } catch {
          setSections([]);
          setError("Unable to load sections");
        } finally {
          setLoadingSections(false);
        }
      })();
    }, 300);

    return () => window.clearTimeout(timer);
  }, [classId]);

  useEffect(() => {
    if (!classId || loadingSections) return;
    sectionRef.current?.focus();
  }, [classId, loadingSections]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const search = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSearch) {
      setRequiredError("Please select all required fields");
      return;
    }
    try {
      setError("");
      setRequiredError("");
      setSearching(true);
      setHasSearched(true);
      const data = await apiPost<{ attendances: ReportRow[]; days: number; print_url: string }>("/api/v1/attendance/subject-attendance/report-search/", {
        class: Number(classId),
        section: Number(sectionId),
        month,
        year: Number(derivedReportYear),
      });
      setRows(data.attendances || []);
      setDays(data.days || 0);
      setPrintUrl(data.print_url || "");
      setPage(1);
    } catch {
      setError("Operation Failed");
      setRows([]);
      setDays(0);
      setPrintUrl("");
    } finally {
      setSearching(false);
    }
  };

  const exportExcel = () => {
    if (!rows.length) return;
    const header = ["Name", "Admission No", "P", "L", "A", "F", "H", "%", ...Array.from({ length: days }, (_, i) => String(i + 1))];
    const body = rows.map((r) => {
      const total = r.present + r.late + r.absent + r.half_day + r.holiday;
      const percent = total > 0 ? Math.round(((r.present + r.late + r.half_day) / total) * 100) : 0;
      return [
        `"${String(r.name || "").replace(/"/g, '""')}"`,
        `"${String(r.admission_no || "").replace(/"/g, '""')}"`,
        r.present,
        r.late,
        r.absent,
        r.half_day,
        r.holiday,
        `${percent}%`,
        ...Array.from({ length: days }, (_, i) => `"${String(r.days?.[i + 1] || "")}"`),
      ];
    });

    const csv = [header.join(","), ...body.map((line) => line.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `subject_attendance_report_${month}_${derivedReportYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const grand = rows.reduce(
    (acc, r) => {
      acc.P += r.present;
      acc.L += r.late;
      acc.A += r.absent;
      acc.F += r.half_day;
      acc.H += r.holiday;
      return acc;
    },
    { P: 0, L: 0, A: 0, F: 0, H: 0 }
  );

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Subject Attendance Report</h1>
            <div style={{ display: "flex", gap: 8, color: "#666", fontSize: 13 }}>
              <span>Dashboard</span><span>/</span><span>Student Information</span><span>/</span><span>Subject Attendance Report</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Select Criteria</h3>
            <form onSubmit={search} style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(160px, 1fr))", gap: 8, alignItems: "end" }}>
              <div>
                <label htmlFor="subject-report-class" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Class</label>
                <select
                  id="subject-report-class"
                  aria-required="true"
                  value={classId}
                  onChange={(e) => {
                    const next = e.target.value.trim();
                    setClassId(isPositiveInteger(next) ? next : "");
                    setSectionId("");
                    setRows([]);
                    setDays(0);
                    setPrintUrl("");
                    setHasSearched(false);
                    setRequiredError("");
                  }}
                  style={fieldStyle()}
                >
                  <option value="">Select Class</option>
                  {validClasses.map((c) => <option key={c.id} value={c.id}>{normalizeClassLabel(c.class_name || c.name || "", c.id)}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="subject-report-section" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Section</label>
                <select
                  id="subject-report-section"
                  aria-required="true"
                  ref={sectionRef}
                  value={sectionId}
                  disabled={!classId || loadingSections}
                  onChange={(e) => {
                    const next = e.target.value.trim();
                    setSectionId(isPositiveInteger(next) ? next : "");
                    setRequiredError("");
                  }}
                  style={{ ...fieldStyle(), opacity: !classId ? 0.7 : 1 }}
                >
                  <option value="">{!classId ? "Select Class First" : loadingSections ? "Loading..." : "Select Section"}</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{s.section_name || s.name || `Section ${s.id}`}</option>)}
                </select>
              </div>

              <div>
                <label htmlFor="subject-report-month" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Month</label>
                <select id="subject-report-month" value={month} onChange={(e) => setMonth(e.target.value)} style={fieldStyle()}>
                  {Array.from({ length: 12 }, (_, i) => {
                    const m = String(i + 1).padStart(2, "0");
                    return <option key={m} value={m}>{m}</option>;
                  })}
                </select>
              </div>

              <div>
                <label htmlFor="subject-report-year" style={{ display: "block", marginBottom: 6, fontSize: 12, fontWeight: 600 }}>Academic Year / Session</label>
                <select
                  id="subject-report-year"
                  aria-required="true"
                  value={academicYearId}
                  onChange={(e) => {
                    const next = e.target.value.trim();
                    setAcademicYearId(isPositiveInteger(next) ? next : "");
                    setRequiredError("");
                  }}
                  style={fieldStyle()}
                >
                  <option value="">Select Academic Year</option>
                  {validYears.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
              </div>

              <button type="submit" disabled={!canSearch || searching} style={{ ...buttonStyle(), opacity: !canSearch || searching ? 0.65 : 1 }}>
                {searching ? "Searching..." : "Search"}
              </button>
            </form>
            {requiredError && <div role="alert" style={{ color: "var(--warning)", marginTop: 8 }}>{requiredError}</div>}
            {error && <div style={{ color: "var(--warning)", marginTop: 8 }}>{error}</div>}
          </div>

          {searching && (
            <div className="white-box" style={boxStyle()} aria-live="polite" aria-busy="true">
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, border: "1px solid var(--line)" }}>Name</th>
                    <th style={{ padding: 8, border: "1px solid var(--line)" }}>Admission No</th>
                    <th style={{ padding: 8, border: "1px solid var(--line)" }}>Totals</th>
                    <th style={{ padding: 8, border: "1px solid var(--line)" }}>Days</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={`report-skeleton-${idx}`}>
                      <td style={{ padding: 8, border: "1px solid var(--line)" }}><div style={skeletonCell("70%")} /></td>
                      <td style={{ padding: 8, border: "1px solid var(--line)" }}><div style={skeletonCell("55%")} /></td>
                      <td style={{ padding: 8, border: "1px solid var(--line)" }}><div style={skeletonCell("65%")} /></td>
                      <td style={{ padding: 8, border: "1px solid var(--line)" }}><div style={skeletonCell("95%")} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!searching && !hasSearched && (
            <div className="white-box" style={{ ...boxStyle(), textAlign: "center", color: "var(--text-muted)" }}>
              <h4 style={{ margin: "0 0 6px", color: "var(--text)" }}>Please select criteria to generate the report</h4>
              <p style={{ margin: 0 }}>Choose class, section, month and academic year.</p>
            </div>
          )}

          {!searching && hasSearched && rows.length === 0 && (
            <div className="white-box" style={{ ...boxStyle(), textAlign: "center", color: "var(--text-muted)" }}>
              <h4 style={{ margin: "0 0 6px", color: "var(--text)" }}>No attendance report records found</h4>
              <p style={{ margin: 0 }}>Try different criteria.</p>
            </div>
          )}

          {!searching && rows.length > 0 && (
            <div className="white-box" style={boxStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10, flexWrap: "wrap", gap: 8 }}>
                <div>
                  <strong>P:</strong> {grand.P} <strong>L:</strong> {grand.L} <strong>A:</strong> {grand.A} <strong>F:</strong> {grand.F} <strong>H:</strong> {grand.H}
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button type="button" onClick={exportExcel} style={buttonStyle()}>Export to Excel</button>
                  {printUrl && <a href={`${API_BASE_URL}${printUrl}`} target="_blank" style={{ textDecoration: "none" }}><button type="button" style={buttonStyle()}>Print</button></a>}
                </div>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 900 }}>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)", textAlign: "center" }}>
                      <th style={{ padding: 8, border: "1px solid var(--line)" }}>Name</th>
                      <th style={{ padding: 8, border: "1px solid var(--line)" }}>Admission No</th>
                      <th style={{ padding: 8, border: "1px solid var(--line)" }}>P</th>
                      <th style={{ padding: 8, border: "1px solid var(--line)" }}>L</th>
                      <th style={{ padding: 8, border: "1px solid var(--line)" }}>A</th>
                      <th style={{ padding: 8, border: "1px solid var(--line)" }}>F</th>
                      <th style={{ padding: 8, border: "1px solid var(--line)" }}>H</th>
                      <th style={{ padding: 8, border: "1px solid var(--line)" }}>%</th>
                      {Array.from({ length: days }, (_, i) => i + 1).map((d) => <th key={d} style={{ padding: 8, border: "1px solid var(--line)" }}>{d}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {pagedRows.map((r) => {
                      const total = r.present + r.late + r.absent + r.half_day + r.holiday;
                      const percent = total > 0 ? Math.round(((r.present + r.late + r.half_day) / total) * 100) : 0;
                      return (
                        <tr key={r.student_id} style={{ textAlign: "center" }}>
                          <td style={{ padding: 8, border: "1px solid var(--line)", textAlign: "left" }}>{r.name}</td>
                          <td style={{ padding: 8, border: "1px solid var(--line)" }}>{r.admission_no}</td>
                          <td style={{ padding: 8, border: "1px solid var(--line)", color: "#16a34a" }}>{r.present}</td>
                          <td style={{ padding: 8, border: "1px solid var(--line)", color: "#d97706" }}>{r.late}</td>
                          <td style={{ padding: 8, border: "1px solid var(--line)", color: "#dc2626" }}>{r.absent}</td>
                          <td style={{ padding: 8, border: "1px solid var(--line)", color: "#2563eb" }}>{r.half_day}</td>
                          <td style={{ padding: 8, border: "1px solid var(--line)", color: "#6b7280" }}>{r.holiday}</td>
                          <td style={{ padding: 8, border: "1px solid var(--line)" }}>{percent}%</td>
                          {Array.from({ length: days }, (_, i) => i + 1).map((d) => <td key={d} style={{ padding: 8, border: "1px solid var(--line)" }}>{r.days?.[d] || ""}</td>)}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12, gap: 8, flexWrap: "wrap" }}>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                  Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, rows.length)} of {rows.length}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label htmlFor="subject-report-page-size" style={{ fontSize: 12 }}>Rows</label>
                  <select
                    id="subject-report-page-size"
                    value={String(pageSize)}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    style={{ ...fieldStyle(), width: 90, height: 34 }}
                  >
                    {[10, 25, 50, 100].map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                  <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={{ ...buttonStyle(), height: 34 }}>
                    Prev
                  </button>
                  <span style={{ minWidth: 80, textAlign: "center", fontSize: 13 }}>Page {page} / {totalPages}</span>
                  <button type="button" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={{ ...buttonStyle(), height: 34 }}>
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      <style jsx global>{`
        @keyframes subjectAttendanceReportShimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
        #subject-report-class:focus,
        #subject-report-section:focus,
        #subject-report-month:focus,
        #subject-report-year:focus,
        #subject-report-page-size:focus {
          outline: 2px solid rgba(59, 130, 246, 0.5);
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}
