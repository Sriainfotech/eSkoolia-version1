"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import styles from "./page.module.css";

type ApiList<T> = T[] | { count?: number; results?: T[] };

type AcademicYear = {
  id: number;
  name: string;
  is_current?: boolean;
};

type ClassSection = {
  id: number;
  name: string;
};

type ClassItem = {
  id: number;
  name: string;
  numeric_order?: number;
  sections?: ClassSection[];
};

type IncidentStudent = {
  student_id: number;
  student_name: string;
  point: number;
};

type IncidentRow = {
  incident_id: number;
  incident_title: string;
  incident_description?: string;
  per_point?: number;
  is_negative?: boolean;
  assignment_count: number;
  total_points: number;
  unique_student_count?: number;
  students: IncidentStudent[];
};

type SortMode = "severity" | "az";

function asList<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function formatSigned(value: number) {
  if (value > 0) return `+${value}`;
  return String(value);
}

function getPerPoint(row: IncidentRow) {
  if (typeof row.per_point === "number") return row.per_point;
  if (row.students.length > 0) return row.students[0].point;
  return 0;
}

function getUniqueStudentNames(students: IncidentStudent[]) {
  const seen = new Set<number>();
  const names: string[] = [];
  for (const student of students) {
    if (seen.has(student.student_id)) continue;
    seen.add(student.student_id);
    names.push(student.student_name || "Unknown Student");
  }
  return names;
}

function spinner() {
  return <span className={styles.spinner} aria-hidden="true" />;
}

function summaryCard(label: string, value: string, subLabel: string, icon: string, tone?: "positive" | "negative") {
  return (
    <div className={`white-box ${styles.whiteBox} ${styles.statCard}`}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValueRow}>
        <span className={styles.statIcon}>{icon}</span>
        <span className={`${styles.statValue} ${tone === "positive" ? styles.positive : ""} ${tone === "negative" ? styles.negative : ""}`}>{value}</span>
      </div>
      <div className={styles.statSub}>{subLabel}</div>
    </div>
  );
}

function emptyCard() {
  return (
    <div className={`white-box ${styles.whiteBox}`} style={{ textAlign: "center", padding: 24 }}>
      <div style={{ fontSize: 44, marginBottom: 6, opacity: 0.6 }}>📊</div>
      <h3 className={styles.sectionHeading} style={{ marginTop: 0, marginBottom: 6 }}>
        No incident data found
      </h3>
      <p className={styles.mutedText} style={{ margin: 0 }}>
        Try selecting a different academic year or check if incidents have been assigned.
      </p>
    </div>
  );
}

function errorCard(message: string, onRetry: () => void) {
  return (
    <div className={`white-box ${styles.whiteBox}`} style={{ borderLeft: "4px solid rgb(220,38,38)", paddingLeft: 12 }}>
      <h3 className={styles.sectionHeading} style={{ marginTop: 0, marginBottom: 8, color: "rgb(220,38,38)" }}>
        Failed to load report
      </h3>
      <p className={styles.mutedText} style={{ marginTop: 0 }}>{message}</p>
      <button type="button" onClick={onRetry} className={styles.secondaryButton}>
        Retry
      </button>
    </div>
  );
}

function skeletonBlock(height: number) {
  return <div className={styles.skeleton} style={{ height }} />;
}

export default function BehaviourIncidentWiseReportPage() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);

  const [academicYear, setAcademicYear] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [yearError, setYearError] = useState("");

  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [hasSearched, setHasSearched] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>("severity");
  const [openNegative, setOpenNegative] = useState<Record<number, boolean>>({});
  const [openPositive, setOpenPositive] = useState<Record<number, boolean>>({});
  const [listPage, setListPage] = useState(1);
  const [listPageSize, setListPageSize] = useState(10);

  useEffect(() => {
    const loadLookups = async () => {
      try {
        const token = localStorage.getItem("school_erp_access_token");
        const headers: HeadersInit = {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        };

        const [yearRes, classRes] = await Promise.all([
          fetch("/api/v1/core/academic-years/", { headers }),
          fetch("/api/v1/core/classes/", { headers }),
        ]);

        if (!yearRes.ok || !classRes.ok) {
          throw new Error("Unable to load report lookups.");
        }

        const yearData = (await yearRes.json()) as ApiList<AcademicYear>;
        const classData = (await classRes.json()) as ApiList<ClassItem>;

        const yearList = asList(yearData);
        const classList = asList(classData).slice().sort((a, b) => {
          const aOrder = typeof a.numeric_order === "number" && a.numeric_order > 0 ? a.numeric_order : Number.MAX_SAFE_INTEGER;
          const bOrder = typeof b.numeric_order === "number" && b.numeric_order > 0 ? b.numeric_order : Number.MAX_SAFE_INTEGER;
          if (aOrder !== bOrder) return aOrder - bOrder;
          return (a.name || "").localeCompare(b.name || "");
        });

        setYears(yearList);
        setClasses(classList);

        const currentYear = yearList.find((row) => row.is_current) || yearList[0];
        if (currentYear) {
          setAcademicYear(String(currentYear.id));
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unable to load report lookups.");
      }
    };

    void loadLookups();
  }, []);

  const sections = useMemo(() => {
    if (!classId) return [] as ClassSection[];
    const selected = classes.find((row) => String(row.id) === classId);
    return selected?.sections || [];
  }, [classes, classId]);

  const negativeRows = useMemo(
    () =>
      rows
        .filter((row) => {
          const perPoint = getPerPoint(row);
          return typeof row.is_negative === "boolean" ? row.is_negative : perPoint < 0;
        })
        .slice()
        .sort((a, b) => a.total_points - b.total_points),
    [rows],
  );

  const positiveRows = useMemo(
    () =>
      rows
        .filter((row) => {
          const perPoint = getPerPoint(row);
          return typeof row.is_negative === "boolean" ? !row.is_negative : perPoint >= 0;
        })
        .slice()
        .sort((a, b) => b.total_points - a.total_points),
    [rows],
  );

  const combinedRows = useMemo(() => {
    const base = rows.slice();
    if (sortMode === "az") {
      return base.sort((a, b) => a.incident_title.localeCompare(b.incident_title));
    }
    return base.sort((a, b) => a.total_points - b.total_points);
  }, [rows, sortMode]);

  const listTotalPages = useMemo(() => Math.max(1, Math.ceil(combinedRows.length / listPageSize)), [combinedRows.length, listPageSize]);

  const visibleCombinedRows = useMemo(() => {
    const safePage = Math.min(listPage, listTotalPages);
    const start = (safePage - 1) * listPageSize;
    return combinedRows.slice(start, start + listPageSize);
  }, [combinedRows, listPage, listPageSize, listTotalPages]);

  useEffect(() => {
    setListPage(1);
  }, [sortMode, rows, listPageSize]);

  const summary = useMemo(() => {
    let totalAssignments = 0;
    let positivePoints = 0;
    let negativePoints = 0;
    rows.forEach((row) => {
      totalAssignments += row.assignment_count;
      if (row.total_points >= 0) positivePoints += row.total_points;
      else negativePoints += row.total_points;
    });
    return {
      totalIncidents: rows.length,
      totalAssignments,
      positivePoints,
      negativePoints,
    };
  }, [rows]);

  const loadReport = async () => {
    setHasSearched(true);

    if (!academicYear) {
      setYearError("Please select an academic year");
      return;
    }
    setYearError("");

    try {
      setLoading(true);
      setError("");

      const token = localStorage.getItem("school_erp_access_token");
      const headers: HeadersInit = {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      };

      const params = new URLSearchParams();
      params.set("academic_year", academicYear);
      if (classId) params.set("class_id", classId);
      if (sectionId) params.set("section_id", sectionId);

      const response = await fetch(`/api/v1/behaviour/assignments/incident-wise-report/?${params.toString()}`, { headers });
      if (!response.ok) {
        throw new Error("Unable to load incident-wise report.");
      }

      const payload = (await response.json()) as IncidentRow[];
      setRows(Array.isArray(payload) ? payload : []);
      setOpenNegative({});
      setOpenPositive({});
    } catch (e) {
      setRows([]);
      setError(e instanceof Error ? e.message : "Unable to load incident-wise report.");
    } finally {
      setLoading(false);
    }
  };

  const shouldShowData = hasSearched && !loading && !error;

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24, fontWeight: 700 }}>Incident Wise Report</h1>
            <div style={{ display: "flex", gap: 8, color: "rgb(100,116,139)", fontSize: 13 }}>
              <span>Dashboard</span>
              <span>/</span>
              <span>Behaviour Records</span>
              <span>/</span>
              <span>Incident Wise Report</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className={`white-box ${styles.whiteBox} ${styles.criteriaCard}`}>
            <h3 className={styles.sectionHeading} style={{ marginTop: 0, marginBottom: 12 }}>
              Select Criteria
            </h3>
            <div className={styles.criteriaGrid}>
              <div>
                <select
                  value={academicYear}
                  onChange={(event) => {
                    setAcademicYear(event.target.value);
                    if (event.target.value) setYearError("");
                  }}
                  className={styles.selectInput}
                >
                  <option value="">Academic Year</option>
                  {years.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
                {yearError ? <div className={styles.helperError}>{yearError}</div> : null}
              </div>

              <div>
                <select
                  value={classId}
                  onChange={(event) => {
                    setClassId(event.target.value);
                    setSectionId("");
                  }}
                  className={styles.selectInput}
                >
                  <option value="">All Classes</option>
                  {classes.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <select value={sectionId} onChange={(event) => setSectionId(event.target.value)} className={styles.selectInput} disabled={!classId}>
                  <option value="">All Sections</option>
                  {sections.map((row) => (
                    <option key={row.id} value={row.id}>
                      {row.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <button type="button" className={styles.primaryButton} onClick={() => void loadReport()} disabled={loading}>
                  {loading ? (
                    <span className={styles.buttonLoadingWrap}>
                      {spinner()}
                      Searching...
                    </span>
                  ) : (
                    "Search"
                  )}
                </button>
              </div>
            </div>
          </div>

          {loading && (
            <>
              <div className={styles.statsGrid}>
                {[0, 1, 2, 3].map((index) => (
                  <div key={index} className={`white-box ${styles.whiteBox} ${styles.statCard}`}>
                    {skeletonBlock(12)}
                    <div style={{ height: 8 }} />
                    {skeletonBlock(28)}
                    <div style={{ height: 8 }} />
                    {skeletonBlock(10)}
                  </div>
                ))}
              </div>

              <div className={styles.splitGrid}>
                <div className={`white-box ${styles.whiteBox}`}>{skeletonBlock(260)}</div>
                <div className={`white-box ${styles.whiteBox}`}>{skeletonBlock(260)}</div>
              </div>

              <div className={`white-box ${styles.whiteBox}`}>{skeletonBlock(300)}</div>
            </>
          )}

          {!loading && error ? errorCard(error, () => void loadReport()) : null}

          {shouldShowData && rows.length === 0 ? emptyCard() : null}

          {shouldShowData && rows.length > 0 && (
            <>
              <div className={styles.statsGrid}>
                {summaryCard("Total Incidents", String(summary.totalIncidents), "Unique incident types", "📋")}
                {summaryCard("Total Assignments", String(summary.totalAssignments), "Assigned records", "✅")}
                {summaryCard("Total Positive Points", `+${summary.positivePoints}`, "Rewards impact", "⬆", "positive")}
                {summaryCard("Total Negative Points", String(summary.negativePoints), "Penalties impact", "⬇", "negative")}
              </div>

              <div className={styles.splitGrid}>
                <div className={`white-box ${styles.whiteBox} ${styles.negativeCard}`}>
                  <div className={styles.cardHeaderRow}>
                    <h3 className={styles.sectionHeading} style={{ margin: 0 }}>
                      <span className={`${styles.dot} ${styles.dotNegative}`} /> Negative Incidents <span className={styles.countBadge}>({negativeRows.length})</span>
                    </h3>
                  </div>
                  <div className={styles.mutedText}>Violations & penalties sorted by severity</div>

                  <div className={styles.tableWrap}>
                    <table className={styles.reportTable}>
                      <thead>
                        <tr>
                          <th>Incident</th>
                          <th style={{ textAlign: "center" }}>Per Incident Point</th>
                          <th style={{ textAlign: "center" }}>Assigned</th>
                          <th style={{ textAlign: "right" }}>Total Points</th>
                          <th style={{ width: 30 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {negativeRows.map((row) => {
                          const isOpen = !!openNegative[row.incident_id];
                          const perPoint = getPerPoint(row);
                          return (
                            <Fragment key={`neg-${row.incident_id}`}>
                              <tr
                                className={styles.negativeRow}
                                onClick={() =>
                                  setOpenNegative((prev) => ({
                                    ...prev,
                                    [row.incident_id]: !prev[row.incident_id],
                                  }))
                                }
                                style={{ cursor: "pointer" }}
                              >
                                <td style={{ fontWeight: 500 }}>{row.incident_title}</td>
                                <td style={{ textAlign: "center" }}>
                                  <span className={styles.redBadge}>{formatSigned(perPoint)}</span>
                                </td>
                                <td style={{ textAlign: "center" }}>{row.assignment_count}</td>
                                <td style={{ textAlign: "right" }} className={styles.negativeStrong}>
                                  {formatSigned(row.total_points)}
                                </td>
                                <td style={{ textAlign: "right", color: "rgb(148,163,184)" }}>{isOpen ? "▼" : "▶"}</td>
                              </tr>
                              {isOpen ? (
                                <tr key={`neg-students-${row.incident_id}`}>
                                  <td colSpan={5}>
                                    <div className={styles.studentChipsWrap}>
                                      {row.students.map((student, index) => (
                                        <span className={styles.studentChipNegative} key={`neg-chip-${row.incident_id}-${student.student_id}-${index}`}>
                                          {student.student_name} ({formatSigned(student.point)})
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className={`white-box ${styles.whiteBox} ${styles.positiveCard}`}>
                  <div className={styles.cardHeaderRow}>
                    <h3 className={styles.sectionHeading} style={{ margin: 0 }}>
                      <span className={`${styles.dot} ${styles.dotPositive}`} /> Positive Incidents <span className={styles.countBadge}>({positiveRows.length})</span>
                    </h3>
                  </div>
                  <div className={styles.mutedText}>Achievements & rewards sorted by impact</div>

                  <div className={styles.tableWrap}>
                    <table className={styles.reportTable}>
                      <thead>
                        <tr>
                          <th>Incident</th>
                          <th style={{ textAlign: "center" }}>Per Incident Point</th>
                          <th style={{ textAlign: "center" }}>Assigned</th>
                          <th style={{ textAlign: "right" }}>Total Points</th>
                          <th style={{ width: 30 }} />
                        </tr>
                      </thead>
                      <tbody>
                        {positiveRows.map((row) => {
                          const isOpen = !!openPositive[row.incident_id];
                          const perPoint = getPerPoint(row);
                          return (
                            <Fragment key={`pos-${row.incident_id}`}>
                              <tr
                                className={styles.positiveRow}
                                onClick={() =>
                                  setOpenPositive((prev) => ({
                                    ...prev,
                                    [row.incident_id]: !prev[row.incident_id],
                                  }))
                                }
                                style={{ cursor: "pointer" }}
                              >
                                <td style={{ fontWeight: 500 }}>{row.incident_title}</td>
                                <td style={{ textAlign: "center" }}>
                                  <span className={styles.greenBadge}>{formatSigned(perPoint)}</span>
                                </td>
                                <td style={{ textAlign: "center" }}>{row.assignment_count}</td>
                                <td style={{ textAlign: "right" }} className={styles.positiveStrong}>
                                  {row.total_points > 0 ? `+${row.total_points}` : row.total_points}
                                </td>
                                <td style={{ textAlign: "right", color: "rgb(148,163,184)" }}>{isOpen ? "▼" : "▶"}</td>
                              </tr>
                              {isOpen ? (
                                <tr key={`pos-students-${row.incident_id}`}>
                                  <td colSpan={5}>
                                    <div className={styles.studentChipsWrap}>
                                      {row.students.map((student, index) => (
                                        <span className={styles.studentChipPositive} key={`pos-chip-${row.incident_id}-${student.student_id}-${index}`}>
                                          {student.student_name} ({formatSigned(student.point)})
                                        </span>
                                      ))}
                                    </div>
                                  </td>
                                </tr>
                              ) : null}
                            </Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>

              <div className={`white-box ${styles.whiteBox}`}>
                <h3 className={styles.sectionHeading} style={{ marginTop: 0, marginBottom: 10 }}>
                  All Incidents Overview
                </h3>

                <div className={styles.toggleRow}>
                  <button
                    type="button"
                    className={`${styles.toggleButton} ${sortMode === "severity" ? styles.toggleButtonActive : ""}`}
                    onClick={() => setSortMode("severity")}
                  >
                    Sort by Severity
                  </button>
                  <button
                    type="button"
                    className={`${styles.toggleButton} ${sortMode === "az" ? styles.toggleButtonActive : ""}`}
                    onClick={() => setSortMode("az")}
                  >
                    Sort A-Z
                  </button>
                </div>

                <div className={styles.tableWrap}>
                  <table className={styles.reportTable}>
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}>#</th>
                        <th>Incident</th>
                        <th>Type</th>
                        <th style={{ textAlign: "center" }}>Per Incident Point</th>
                        <th style={{ textAlign: "center" }}>Times Assigned</th>
                        <th style={{ textAlign: "right" }}>Total Points</th>
                        <th>Students Involved</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleCombinedRows.map((row, index) => {
                        const perPoint = getPerPoint(row);
                        const isNegative = typeof row.is_negative === "boolean" ? row.is_negative : perPoint < 0;
                        const uniqueNames = getUniqueStudentNames(row.students);
                        const shortNames = uniqueNames.slice(0, 2);
                        const extra = uniqueNames.length - shortNames.length;

                        return (
                          <tr key={`all-${row.incident_id}-${index}`}>
                            <td>{(listPage - 1) * listPageSize + index + 1}</td>
                            <td style={{ fontWeight: 500 }}>{row.incident_title}</td>
                            <td>
                              <span className={isNegative ? styles.redBadge : styles.greenBadge}>{isNegative ? "Penalty" : "Reward"}</span>
                            </td>
                            <td style={{ textAlign: "center" }}>{formatSigned(perPoint)}</td>
                            <td style={{ textAlign: "center" }}>{row.assignment_count}</td>
                            <td style={{ textAlign: "right" }} className={isNegative ? styles.negativeStrong : styles.positiveStrong}>
                              {formatSigned(row.total_points)}
                            </td>
                            <td className={styles.studentLine}>
                              {shortNames.join(", ")}
                              {extra > 0 ? ` and ${extra} more` : ""}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className={styles.paginationRow}>
                  <div className={styles.paginationText}>
                    Showing {visibleCombinedRows.length} of {combinedRows.length} incidents
                  </div>
                  <div className={styles.paginationControls}>
                    <span className={styles.paginationText}>Rows</span>
                    <select value={listPageSize} onChange={(event) => setListPageSize(Number(event.target.value))} className={styles.paginationSelect}>
                      {[10, 25, 50].map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() => setListPage((prev) => Math.max(1, prev - 1))}
                      disabled={listPage <= 1}
                    >
                      Prev
                    </button>
                    <span className={styles.paginationText}>
                      Page {Math.min(listPage, listTotalPages)} / {listTotalPages}
                    </span>
                    <button
                      type="button"
                      className={styles.paginationButton}
                      onClick={() => setListPage((prev) => Math.min(listTotalPages, prev + 1))}
                      disabled={listPage >= listTotalPages}
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
