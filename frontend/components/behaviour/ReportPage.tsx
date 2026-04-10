"use client";

import { useEffect, useMemo, useState } from "react";
import FormInput from "@/components/common/FormInput";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type ApiList<T> = T[] | { results?: T[] };

type AcademicYear = { id: number; name: string; is_current?: boolean };
type ClassItem = { id: number; name?: string; class_name?: string };
type SectionItem = { id: number; name?: string; section_name?: string; school_class?: number };

type RankStudent = {
  rank: number;
  student_id: number;
  admission_no: string;
  student_name: string;
  incident_count: number;
  total_points: number;
};

type RankSection = {
  section_id: number | null;
  section_name: string;
  total_students: number;
  total_incidents: number;
  total_points: number;
  students: RankStudent[];
};

type RankClass = {
  class_id: number | null;
  class_name: string;
  total_sections: number;
  total_students: number;
  total_incidents: number;
  total_points: number;
  sections: RankSection[];
};

type RankReportResponse = {
  meta: {
    scope: string;
    academic_year_id: number | null;
    class_id: number | null;
    section_id: number | null;
    point: number | null;
    operator: string;
    q: string;
  };
  classes: RankClass[];
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

function svgEmptyState() {
  return (
    <svg viewBox="0 0 220 160" className="mx-auto h-40 w-auto" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="20" y="18" width="180" height="124" rx="22" fill="#EFF6FF" />
      <rect x="44" y="42" width="132" height="14" rx="7" fill="#BFDBFE" />
      <rect x="44" y="66" width="92" height="10" rx="5" fill="#DBEAFE" />
      <rect x="44" y="84" width="112" height="10" rx="5" fill="#DBEAFE" />
      <circle cx="150" cy="104" r="22" fill="#DBEAFE" />
      <path d="M144 104l4 4 9-11" stroke="#2563EB" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M34 126h152" stroke="#93C5FD" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

function classLabel(row: ClassItem) {
  return row.name || row.class_name || `Class ${row.id}`;
}

function sectionLabel(row: SectionItem) {
  return row.name || row.section_name || `Section ${row.id}`;
}

export default function ReportPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [academicYearId, setAcademicYearId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [keyword, setKeyword] = useState("");
  const [operator, setOperator] = useState<"above" | "below">("above");
  const [point, setPoint] = useState("0");
  const [report, setReport] = useState<RankReportResponse | null>(null);
  const [activeClassMap, setActiveClassMap] = useState<Record<string, boolean>>({});
  const [activeSectionMap, setActiveSectionMap] = useState<Record<string, string>>({});
  const [sectionPageMap, setSectionPageMap] = useState<Record<string, number>>({});
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [hasSearched, setHasSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const [yearData, classData, sectionData] = await Promise.all([
          apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
          apiGet<ApiList<ClassItem>>("/api/v1/core/classes/"),
          apiGet<ApiList<SectionItem>>("/api/v1/core/sections/"),
        ]);
        const nextYears = listData(yearData);
        setYears(nextYears);
        setClasses(listData(classData));
        setSections(listData(sectionData));
        const currentYear = nextYears.find((row) => row.is_current) || nextYears[0];
        if (currentYear) {
          setAcademicYearId(String(currentYear.id));
        }
      } catch {
        setError("Unable to load lookup data.");
      }
    };

    void loadLookups();
  }, []);

  useEffect(() => {
    if (!report) return;
    setActiveClassMap((prev) => {
      const next = { ...prev };
      report.classes.forEach((item) => {
        const key = String(item.class_id ?? item.class_name);
        if (next[key] === undefined) {
          next[key] = true;
        }
      });
      return next;
    });
    setActiveSectionMap((prev) => {
      const next = { ...prev };
      report.classes.forEach((item) => {
        const classKey = String(item.class_id ?? item.class_name);
        if (!item.sections.length) return;
        if (!next[classKey] || !item.sections.some((section) => section.section_id !== null && String(section.section_id) === next[classKey])) {
          next[classKey] = String(item.sections[0].section_id ?? item.sections[0].section_name);
        }
      });
      return next;
    });
  }, [report]);

  useEffect(() => {
    setSectionPageMap({});
  }, [report, activeSectionMap, rowsPerPage]);

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((row) => String(row.school_class ?? "") === classId);
  }, [sections, classId]);

  const loadReport = async (scope: "class" | "school") => {
    try {
      setLoading(true);
      setHasSearched(true);
      setError("");

      const params = new URLSearchParams();
      if (academicYearId) params.set("academic_year_id", academicYearId);
      if (scope !== "school") {
        if (classId) params.set("class_id", classId);
        if (sectionId) params.set("section_id", sectionId);
      }
      params.set("scope", scope);
      params.set("operator", operator);
      params.set("point", point || "0");
      if (keyword.trim()) params.set("q", keyword.trim());

      const data = await apiGet<RankReportResponse>(`/api/v1/behaviour/assignments/student-rank-report/?${params.toString()}`);
      setReport(data);
    } catch (err) {
      setReport(null);
      setError(err instanceof Error ? err.message : "Unable to load rank report.");
    } finally {
      setLoading(false);
    }
  };

  const emptyState = !hasSearched && !loading;

  const totals = useMemo(() => {
    const summary = { classes: 0, sections: 0, students: 0, incidents: 0, points: 0 };
    report?.classes.forEach((item) => {
      summary.classes += 1;
      summary.sections += item.sections.length;
      summary.students += item.total_students;
      summary.incidents += item.total_incidents;
      summary.points += item.total_points;
    });
    return summary;
  }, [report]);

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div className="flex items-center justify-between gap-3">
            <h1 className="m-0 text-2xl font-bold text-slate-900">Student Behaviour Rank Report</h1>
            <div className="flex gap-2 text-sm text-slate-500">
              <span>Dashboard</span>
              <span>/</span>
              <span>Behaviour Records</span>
              <span>/</span>
              <span>Student Behaviour Rank Report</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
              <label className="block space-y-1.5">
                <span className="block text-sm font-semibold text-slate-700">Academic Year</span>
                <select
                  value={academicYearId}
                  onChange={(event) => setAcademicYearId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Select academic year</option>
                  {years.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                <small className="block text-xs text-slate-500">Required for report aggregation.</small>
              </label>
              <label className="block space-y-1.5">
                <span className="block text-sm font-semibold text-slate-700">Class</span>
                <select
                  value={classId}
                  onChange={(event) => {
                    setClassId(event.target.value);
                    setSectionId("");
                  }}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">All Classes</option>
                  {classes.map((row) => (
                    <option key={row.id} value={row.id}>
                      {classLabel(row)}
                    </option>
                  ))}
                </select>
                <small className="block text-xs text-slate-500">Optional unless you want a single class view.</small>
              </label>
              <label className="block space-y-1.5">
                <span className="block text-sm font-semibold text-slate-700">Section</span>
                <select
                  value={sectionId}
                  disabled={!classId}
                  onChange={(event) => setSectionId(event.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
                >
                  <option value="">All Sections</option>
                  {filteredSections.map((row) => (
                    <option key={row.id} value={row.id}>
                      {sectionLabel(row)}
                    </option>
                  ))}
                </select>
                <small className="block text-xs text-slate-500">Select a class first. Sections load after class selection.</small>
              </label>
              <FormInput
                label="Student Search"
                helperText="Blocks 3+ repeating characters like aaa or 111."
                value={keyword}
                onChange={setKeyword}
                placeholder="Search student, admission no, roll no"
              />
              <label className="block space-y-1.5">
                <span className="block text-sm font-semibold text-slate-700">Points</span>
                <div className="grid grid-cols-[140px_1fr] gap-2">
                  <select
                    value={operator}
                    onChange={(event) => setOperator(event.target.value as "above" | "below")}
                    className="h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  >
                    <option value="above">Above / Equal</option>
                    <option value="below">Below</option>
                  </select>
                  <FormInput
                    label="Points"
                    value={point}
                    onChange={setPoint}
                    numeric
                    placeholder="0"
                    helperText="Digits only. e, +, - are blocked."
                  />
                </div>
              </label>
              <div className="flex flex-wrap items-end gap-2 xl:col-span-2">
                <button
                  type="button"
                  onClick={() => void loadReport("class")}
                  className="h-10 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
                >
                  Search
                </button>
                <button
                  type="button"
                  onClick={() => void loadReport("school")}
                  className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Show Whole School
                </button>
                <div className="text-sm text-slate-500">
                  Whole school ignores class and section filters but preserves the same hierarchy.
                </div>
              </div>
            </div>
          </div>

          {loading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500 shadow-sm">Loading rank report...</div>
          )}

          {emptyState && !loading && (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
              {svgEmptyState()}
              <h2 className="mt-4 text-xl font-semibold text-slate-900">Search first to view behaviour ranks</h2>
              <p className="mx-auto mt-2 max-w-2xl text-sm text-slate-500">
                Choose criteria and click Search, or use Show Whole School to load the full hierarchical rank report.
              </p>
            </div>
          )}

          {!emptyState && !loading && report && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                <SummaryCard label="Classes" value={String(totals.classes)} />
                <SummaryCard label="Sections" value={String(totals.sections)} />
                <SummaryCard label="Students" value={String(totals.students)} />
                <SummaryCard label="Incidents" value={String(totals.incidents)} />
                <SummaryCard label="Total Points" value={String(totals.points)} />
              </div>

              <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
                <div className="text-sm text-slate-600">
                  Scope: <span className="font-semibold text-slate-900">{report.meta.scope === "school" ? "Whole School" : "Filtered Class/Section"}</span>
                </div>
                <div className="text-sm text-slate-600">
                  Academic Year: <span className="font-semibold text-slate-900">{years.find((row) => String(row.id) === String(report.meta.academic_year_id))?.name || "-"}</span>
                </div>
              </div>

              {report.classes.length === 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500 shadow-sm">
                  No rank data found for the selected criteria.
                </div>
              )}

              {report.classes.map((classRow) => {
                const classKey = String(classRow.class_id ?? classRow.class_name);
                const isOpen = activeClassMap[classKey] ?? true;
                const activeSectionKey = activeSectionMap[classKey] || String(classRow.sections[0]?.section_id ?? classRow.sections[0]?.section_name ?? "");
                const activeSection = classRow.sections.find((section) => String(section.section_id ?? section.section_name) === activeSectionKey) || classRow.sections[0];

                return (
                  <div key={classKey} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                    <button
                      type="button"
                      onClick={() =>
                        setActiveClassMap((prev) => ({
                          ...prev,
                          [classKey]: !isOpen,
                        }))
                      }
                      className="flex w-full items-center justify-between border-b border-slate-200 bg-gradient-to-r from-slate-50 to-white px-5 py-4 text-left"
                    >
                      <div>
                        <div className="text-lg font-bold text-slate-900">{classRow.class_name}</div>
                        <div className="text-sm text-slate-500">
                          {classRow.total_students} students | {classRow.total_incidents} incidents | {classRow.total_points} points
                        </div>
                      </div>
                      <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-sm font-semibold text-slate-700">
                        {isOpen ? "Collapse" : "Expand"}
                      </div>
                    </button>

                    <div className={`grid transition-all duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                      <div className="overflow-hidden">
                        <div className="p-4">
                          <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
                            {classRow.sections.map((sectionRow) => {
                              const sectionKey = String(sectionRow.section_id ?? sectionRow.section_name);
                              const selected = activeSectionKey === sectionKey;
                              return (
                                <button
                                  key={sectionKey}
                                  type="button"
                                  onClick={() =>
                                    setActiveSectionMap((prev) => ({
                                      ...prev,
                                      [classKey]: sectionKey,
                                    }))
                                  }
                                  className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                                    selected ? "bg-blue-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                  }`}
                                >
                                  {sectionRow.section_name} ({sectionRow.total_students})
                                </button>
                              );
                            })}
                          </div>

                          {activeSection ? (
                            <div className="overflow-hidden rounded-2xl border border-slate-200">
                              {(() => {
                                const paginationKey = `${classKey}:${activeSection.section_id ?? activeSection.section_name}`;
                                const currentPage = sectionPageMap[paginationKey] || 1;
                                const totalPages = Math.max(1, Math.ceil(activeSection.students.length / rowsPerPage));
                                const safePage = Math.min(currentPage, totalPages);
                                const startIndex = (safePage - 1) * rowsPerPage;
                                const visibleStudents = activeSection.students.slice(startIndex, startIndex + rowsPerPage);

                                return (
                                  <>
                                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                                      <div>
                                        Showing <span className="font-semibold text-slate-900">{visibleStudents.length}</span> of{' '}
                                        <span className="font-semibold text-slate-900">{activeSection.students.length}</span> students
                                      </div>
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-slate-500">Rows</span>
                                        <select
                                          value={rowsPerPage}
                                          onChange={(event) => setRowsPerPage(Number(event.target.value))}
                                          className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                                        >
                                          {[10, 25, 50].map((size) => (
                                            <option key={size} value={size}>
                                              {size}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                              <div className="max-h-[520px] overflow-auto">
                                <table className="min-w-full border-collapse text-sm">
                                  <thead className="sticky top-0 z-10 bg-slate-50 shadow-sm">
                                    <tr>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">Rank</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-800">Admission No</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">Student Name</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">Incident Count</th>
                                      <th className="border-b border-slate-200 px-4 py-3 text-left font-semibold text-slate-600">Total Points</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {visibleStudents.map((student) => (
                                      <tr key={student.student_id} className="hover:bg-slate-50">
                                        <td className="border-b border-slate-100 px-4 py-3 font-bold text-slate-900">{student.rank}</td>
                                        <td className="border-b border-slate-100 px-4 py-3 font-extrabold tracking-wide text-slate-950">{student.admission_no}</td>
                                        <td className="border-b border-slate-100 px-4 py-3 text-slate-700">{student.student_name}</td>
                                        <td className="border-b border-slate-100 px-4 py-3 text-slate-700">{student.incident_count}</td>
                                        <td className="border-b border-slate-100 px-4 py-3 text-slate-700">{student.total_points}</td>
                                      </tr>
                                    ))}
                                    {activeSection.students.length === 0 && (
                                      <tr>
                                        <td colSpan={5} className="px-4 py-6 text-center text-slate-500">
                                          No students found in this section.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                              <div className="flex items-center justify-between border-t border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">
                                <div>
                                  Page <span className="font-semibold text-slate-900">{safePage}</span> of{' '}
                                  <span className="font-semibold text-slate-900">{totalPages}</span>
                                </div>
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    disabled={safePage <= 1}
                                    onClick={() =>
                                      setSectionPageMap((prev) => ({
                                        ...prev,
                                        [paginationKey]: Math.max(1, safePage - 1),
                                      }))
                                    }
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Prev
                                  </button>
                                  <button
                                    type="button"
                                    disabled={safePage >= totalPages}
                                    onClick={() =>
                                      setSectionPageMap((prev) => ({
                                        ...prev,
                                        [paginationKey]: Math.min(totalPages, safePage + 1),
                                      }))
                                    }
                                    className="rounded-lg border border-slate-300 px-3 py-1.5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                                  >
                                    Next
                                  </button>
                                </div>
                              </div>
                                  </>
                                );
                              })()}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error ? <p className="mt-4 text-sm font-medium text-rose-600">{error}</p> : null}
        </div>
      </section>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-bold text-slate-900">{value}</div>
    </div>
  );
}
