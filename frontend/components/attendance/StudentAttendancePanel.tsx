"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type AcademicYear = { id: number; name: string; is_current: boolean };
type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };
type ApiList<T> = T[] | { results?: T[] };
type ApiPaginated<T> = T[] | { results?: T[]; count?: number; report?: T[]; data?: T[] };

type StudentRow = {
  id: number;
  admission_no: string;
  first_name: string;
  last_name: string;
  roll_no: string;
  attendance_type: string | null;
  attendance_note: string;
};

type AttendanceEntry = {
  student_id: number;
  attendance_type: string;
  notes: string;
};

type MonthlyReport = {
  student_id: number;
  admission_no: string;
  name: string;
  present: number;
  absent: number;
  late: number;
  half_day: number;
  holiday: number;
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

function listData<T>(v: ApiList<T>): T[] {
  return Array.isArray(v) ? v : v.results ?? [];
}

function parsePaginatedRows<T>(payload: ApiPaginated<T>): { rows: T[]; count: number } {
  if (Array.isArray(payload)) {
    return { rows: payload, count: payload.length };
  }
  const rows = payload.results || payload.report || payload.data || [];
  return { rows, count: payload.count || rows.length };
}

function startAndEndDateOfMonth(year: number, month: number): { dateFrom: string; dateTo: string } {
  const first = new Date(year, month - 1, 1);
  const last = new Date(year, month, 0);
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  return { dateFrom: toIso(first), dateTo: toIso(last) };
}

function fieldStyle() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" } as const;
}

function btnStyle(color = "var(--primary)") {
  return { height: 36, padding: "0 14px", border: `1px solid ${color}`, background: color, color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13 } as const;
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function LegacyBreadcrumb({ title }: { title: string }) {
  return (
    <section className="sms-breadcrumb mb-20">
      <div className="container-fluid">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h1 style={{ margin: 0, fontSize: 24 }}>{title}</h1>
          <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
            <span>Dashboard</span><span>/</span><span>Attendance</span><span>/</span><span>{title}</span>
          </div>
        </div>
      </div>
    </section>
  );
}

export default function StudentAttendancePanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loadingSections, setLoadingSections] = useState(false);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [academicYearId, setAcademicYearId] = useState("");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<Record<number, AttendanceEntry>>({});
  const [markHoliday, setMarkHoliday] = useState(false);
  const [attendanceTypeBanner, setAttendanceTypeBanner] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [studentsPage, setStudentsPage] = useState(1);
  const [studentsPageSize, setStudentsPageSize] = useState(25);
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(25);

  // Report state
  const [reportMonth, setReportMonth] = useState(String(new Date().getMonth() + 1));
  const [reportYear, setReportYear] = useState(String(new Date().getFullYear()));
  const [report, setReport] = useState<MonthlyReport[]>([]);
  const [reportLoaded, setReportLoaded] = useState(false);
  const [reportLoading, setReportLoading] = useState(false);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const validAcademicYears = useMemo(
    () => years.filter((item) => /^(\d{4})(-\d{4})?$/.test(String(item.name || "").trim())),
    [years],
  );
  const reportYearOptions = useMemo(() => {
    const fromAcademicYears = validAcademicYears
      .map((item) => {
        const value = String(item.name || "").trim();
        const match = value.match(/^(\d{4})(?:-(\d{4}))?$/);
        return match ? Number(match[1]) : null;
      })
      .filter((item): item is number => item !== null);

    const all = Array.from(new Set([new Date().getFullYear(), ...fromAcademicYears]));
    return all.sort((a, b) => b - a);
  }, [validAcademicYears]);

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const [yearData, classData] = await Promise.allSettled([
          apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
          apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
        ]);

        const loadedYears = yearData.status === "fulfilled" ? listData(yearData.value) : [];
        const loadedClasses = classData.status === "fulfilled" ? listData(classData.value) : [];

        setYears(loadedYears);
        setClasses(loadedClasses);
        setSections([]);

        const currentAcademicYear = loadedYears.find((item) => item.is_current && /^(\d{4})(-\d{4})?$/.test(String(item.name || "").trim()));
        if (currentAcademicYear) {
          setAcademicYearId(String(currentAcademicYear.id));
        }

        if (!loadedClasses.length) {
          setError("Unable to load attendance criteria.");
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        setError(message && message !== "401" ? message : "Unable to load attendance criteria.");
      }
    };
    void load();
  }, []);

  const loadSectionsForClass = async (targetClassId: string) => {
    if (!targetClassId) {
      setSections([]);
      setSectionId("");
      return;
    }
    try {
      setLoadingSections(true);
      setSections([]);
      setSectionId("");
      const data = await apiGet<ApiList<Section>>(`/api/v1/core/sections/?class=${encodeURIComponent(targetClassId)}&page_size=200`);
      setSections(listData(data));
    } catch {
      setError("Unable to load sections for selected class.");
    } finally {
      setLoadingSections(false);
    }
  };

  const isSearchDisabled = !classId || !sectionId || !attendanceDate || loadingSections || searching;

  const isValidReportYear = useMemo(() => /^(\d{4})$/.test(reportYear), [reportYear]);

  const searchStudents = async () => {
    if (!classId || !sectionId || !attendanceDate) {
      setError("Class, section and date are required.");
      return;
    }
    try {
      setSearching(true);
      setError("");
      setSuccess("");
      const data = await apiPost<{
        students: StudentRow[];
        attendance_type: string;
      }>(
        "/api/v1/attendance/student-attendance/student-search/",
        {
          class: Number(classId),
          class_id: Number(classId),
          section: Number(sectionId),
          section_id: Number(sectionId),
          attendance_date: attendanceDate,
        }
      );
      setStudents(data.students || []);
      setAttendanceTypeBanner(data.attendance_type || "");
      const init: Record<number, AttendanceEntry> = {};
      (data.students || []).forEach((s) => {
        init[s.id] = {
          student_id: s.id,
          attendance_type: s.attendance_type ?? "P",
          notes: s.attendance_note ?? "",
        };
      });
      setAttendance(init);
      setLoaded(true);
      setStudentsPage(1);
      setSuccess(`Loaded ${(data.students || []).length} student records.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Failed to load students.");
    } finally {
      setSearching(false);
    }
  };

  const setType = (studentId: number, type: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: { ...prev[studentId], attendance_type: type } }));
  };

  const setNote = (studentId: number, note: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: { ...prev[studentId], notes: note } }));
  };

  const saveAttendance = async () => {
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await apiPost("/api/v1/attendance/student-attendance/store/", {
        class_id: Number(classId),
        section_id: Number(sectionId),
        academic_year_id: academicYearId ? Number(academicYearId) : null,
        date: attendanceDate,
        id: students.map((s) => s.id),
        attendance: Object.fromEntries(
          Object.values(attendance).map((a) => [String(a.student_id), a.attendance_type])
        ),
        note: Object.fromEntries(
          Object.values(attendance).map((a) => [String(a.student_id), a.notes])
        ),
        mark_holiday: markHoliday,
      });
      await searchStudents();
      setSuccess("Attendance saved successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Unable to save attendance.");
    } finally {
      setSaving(false);
    }
  };

  const triggerHoliday = async (purpose: "mark" | "unmark") => {
    if (!classId || !sectionId || !attendanceDate) return;
    try {
      setSuccess("");
      await apiPost("/api/v1/attendance/student-attendance/holiday/", {
        class_id: Number(classId),
        section_id: Number(sectionId),
        attendance_date: attendanceDate,
        academic_year_id: academicYearId ? Number(academicYearId) : null,
        purpose,
      });
      await searchStudents();
      setSuccess(purpose === "mark" ? "Holiday marked successfully." : "Holiday unmarked successfully.");
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Unable to update holiday status.");
    }
  };

  const loadReport = async () => {
    if (!classId || !sectionId || !reportMonth || !reportYear) {
      setError("Class, section, month and year are required for report.");
      return;
    }
    if (!isValidReportYear) {
      setError("Please select a valid report year.");
      return;
    }
    try {
      setReportLoading(true);
      setError("");
      setSuccess("");
      const primaryUrl = `/api/v1/attendance/student-attendance/report/?class_id=${classId}&section_id=${sectionId}&month=${reportMonth}&year=${reportYear}`;
      let parsed: { rows: MonthlyReport[]; count: number } | null = null;

      try {
        const primaryData = await apiGet<ApiPaginated<MonthlyReport>>(primaryUrl);
        parsed = parsePaginatedRows(primaryData);
      } catch {
        // Backward-compatible fallback for deployments expecting class/section params.
        const fallbackUrl = `/api/v1/attendance/student-attendance/report/?class=${classId}&section=${sectionId}&month=${reportMonth}&year=${reportYear}`;
        const fallbackData = await apiGet<ApiPaginated<MonthlyReport>>(fallbackUrl);
        parsed = parsePaginatedRows(fallbackData);
      }

      if (!parsed) {
        throw new Error("Unable to parse report response.");
      }

      setReport(parsed.rows);
      setReportLoaded(true);
      setReportPage(1);
      setSuccess(`Report loaded: ${parsed.count} records.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Failed to load attendance report.");
      setReport([]);
      setReportLoaded(false);
    } finally {
      setReportLoading(false);
    }
  };

  const typeColor: Record<string, string> = { P: "#16a34a", A: "#dc2626", L: "#d97706", F: "#2563eb", H: "#6b7280" };
  const totalStudentPages = Math.max(1, Math.ceil(students.length / studentsPageSize));
  const visibleStudents = useMemo(() => {
    const start = (studentsPage - 1) * studentsPageSize;
    return students.slice(start, start + studentsPageSize);
  }, [students, studentsPage, studentsPageSize]);
  const studentDisplayFrom = students.length === 0 ? 0 : (studentsPage - 1) * studentsPageSize + 1;
  const studentDisplayTo = Math.min(studentsPage * studentsPageSize, students.length);
  const totalReportPages = Math.max(1, Math.ceil(report.length / reportPageSize));
  const visibleReport = useMemo(() => {
    const start = (reportPage - 1) * reportPageSize;
    return report.slice(start, start + reportPageSize);
  }, [report, reportPage, reportPageSize]);

  const goToStudentPage = (nextPage: number) => {
    const safePage = Math.min(Math.max(nextPage, 1), totalStudentPages);
    setStudentsPage(safePage);
  };

  return (
    <div className="legacy-panel student-attendance-panel">
      <style>{`
        .student-attendance-panel button:focus,
        .student-attendance-panel select:focus,
        .student-attendance-panel input:focus,
        .student-attendance-panel a:focus {
          outline: 2px solid #4f46e5;
          outline-offset: 2px;
        }
      `}</style>
      <LegacyBreadcrumb title="Student Attendance" />
      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">

          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontWeight: 600 }}>Search Students</div>
            </div>
            <p style={{ margin: "0 0 10px", color: "var(--text-muted)", fontSize: 13 }}>
              Workflow: Select criteria | Search students | Mark attendance | Generate monthly report.
            </p>
            {error && <p style={{ color: "#dc2626", margin: "0 0 10px" }}>{error}</p>}
            {success && <p style={{ color: "#0f766e", margin: "0 0 10px" }}>{success}</p>}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <label style={{ minWidth: 150 }}>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Academic Year</span>
              <select aria-label="Select academic year" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} style={fieldStyle()}>
                <option value="">Academic year</option>
                {validAcademicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              </label>
              <label style={{ minWidth: 150 }}>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Class *</span>
              <select
                aria-label="Select class"
                value={classId}
                onChange={(e) => {
                  const nextClassId = e.target.value;
                  setClassId(nextClassId);
                  setLoaded(false);
                  setStudents([]);
                  void loadSectionsForClass(nextClassId);
                }}
                style={fieldStyle()}
              >
                <option value="">Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              </label>
              <label style={{ minWidth: 150 }}>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Section *</span>
              <select
                aria-label="Select section"
                value={sectionId}
                onChange={(e) => { setSectionId(e.target.value); setLoaded(false); setStudents([]); }}
                style={fieldStyle()}
                disabled={!classId || loadingSections}
              >
                <option value="">{loadingSections ? "Loading sections..." : classId ? "Section" : "Select class first"}</option>
                {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              </label>
              <label style={{ minWidth: 170 }}>
                <span style={{ display: "block", fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Attendance Date *</span>
              <input
                aria-label="Select attendance date"
                type="date"
                value={attendanceDate}
                max={todayIso}
                onChange={(e) => {
                  const nextDate = e.target.value > todayIso ? todayIso : e.target.value;
                  setAttendanceDate(nextDate);
                  if (nextDate) {
                    const [year, month] = nextDate.split("-");
                    if (year && month) {
                      setReportYear(year);
                      setReportMonth(String(Number(month)));
                    }
                  }
                }}
                style={fieldStyle()}
              />
              </label>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 8 }}>
                <button type="button" disabled={isSearchDisabled} onClick={() => void searchStudents()} style={btnStyle()}>
                  {searching ? "Searching..." : "Search"}
                </button>
                <Link href="/attendance/student/import" style={{ textDecoration: "none" }}>
                  <button type="button" style={btnStyle("#6b7280")}>Import Attendance</button>
                </Link>
              </div>
            </div>
          </div>

          {loaded && (
            <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <div style={{ fontWeight: 600 }}>Mark Attendance — {attendanceDate}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="checkbox" checked={markHoliday} onChange={(e) => setMarkHoliday(e.target.checked)} />
                    Mark All Holiday
                  </label>
                  <button type="button" onClick={() => void triggerHoliday("mark")} style={btnStyle("#6b7280")}>Holiday Day</button>
                  <button type="button" onClick={() => void triggerHoliday("unmark")} style={btnStyle("#6b7280")}>Unmark Holiday</button>
                  <button type="button" disabled={saving} onClick={() => void saveAttendance()} style={btnStyle()}>{saving ? "Saving..." : "Save Attendance"}</button>
                </div>
              </div>
              {attendanceTypeBanner === "H" && <div style={{ background: "#fff8e1", border: "1px solid #fbbf24", padding: 8, borderRadius: 8, marginBottom: 8 }}>Attendance already submitted as Holiday.</div>}
              {attendanceTypeBanner && attendanceTypeBanner !== "H" && <div style={{ background: "#ecfdf5", border: "1px solid #10b981", padding: 8, borderRadius: 8, marginBottom: 8 }}>Attendance already submitted.</div>}
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Roll Number</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Note</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleStudents.map((student) => {
                    const entry = attendance[student.id];
                    const curType = entry?.attendance_type ?? "P";
                    return (
                      <tr key={student.id}>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 140 }}>{student.admission_no}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{student.first_name} {student.last_name}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{student.roll_no || "-"}</td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 280 }}>
                          {(["P", "L", "A", "F"] as const).map((type) => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => setType(student.id, type)}
                              style={{
                                marginRight: 4,
                                padding: "4px 12px",
                                border: `1px solid ${typeColor[type]}`,
                                background: curType === type ? typeColor[type] : "#fff",
                                color: curType === type ? "#fff" : typeColor[type],
                                borderRadius: 6,
                                cursor: "pointer",
                                fontSize: 12,
                                fontWeight: 600,
                              }}
                            >
                              {type === "P" ? "Present" : type === "A" ? "Absent" : type === "L" ? "Late" : "Half Day"}
                            </button>
                          ))}
                        </td>
                        <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                          <input
                            value={entry?.notes ?? ""}
                            onChange={(e) => setNote(student.id, e.target.value)}
                            placeholder="Note"
                            style={{ ...fieldStyle(), height: 30, width: "100%" }}
                          />
                        </td>
                      </tr>
                    );
                  })}
                  {visibleStudents.length === 0 && (
                    <tr><td colSpan={5} style={{ padding: 8, color: "var(--text-muted)" }}>No students found.</td></tr>
                  )}
                </tbody>
              </table>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>
                  Showing {studentDisplayFrom}-{studentDisplayTo} of {students.length} | Page {studentsPage} of {totalStudentPages}
                </span>
                <div style={{ display: "flex", gap: 8 }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                    Page size
                    <select
                      value={studentsPageSize}
                      onChange={(e) => {
                        setStudentsPageSize(Number(e.target.value));
                        setStudentsPage(1);
                      }}
                      style={{ ...fieldStyle(), width: 96 }}
                    >
                      {[5, 10, 15, 20, 25, 30, 40, 50, 75, 100].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={() => goToStudentPage(1)} disabled={studentsPage <= 1} style={btnStyle("#64748b")}>First</button>
                  <button type="button" onClick={() => goToStudentPage(studentsPage - 1)} disabled={studentsPage <= 1} style={btnStyle("#64748b")}>Previous</button>
                  <button type="button" onClick={() => goToStudentPage(studentsPage + 1)} disabled={studentsPage >= totalStudentPages} style={btnStyle("#64748b")}>Next</button>
                  <button type="button" onClick={() => goToStudentPage(totalStudentPages)} disabled={studentsPage >= totalStudentPages} style={btnStyle("#64748b")}>Last</button>
                </div>
              </div>
            </div>
          )}

          <div className="white-box" style={boxStyle()}>
            <div style={{ fontWeight: 600, marginBottom: 10 }}>Monthly Attendance Report</div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
              <select value={reportMonth} onChange={(e) => setReportMonth(e.target.value)} style={{ ...fieldStyle(), width: 140 }}>
                {Array.from({ length: 12 }, (_, i) => (
                  <option key={i + 1} value={i + 1}>
                    {new Date(0, i).toLocaleString("default", { month: "long" })}
                  </option>
                ))}
              </select>
              <select
                aria-label="Report year"
                value={reportYear}
                onChange={(e) => setReportYear(e.target.value.replace(/[^0-9]/g, "").slice(0, 4))}
                style={{ ...fieldStyle(), width: 140 }}
              >
                {reportYearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void loadReport()}
                style={btnStyle()}
                disabled={reportLoading || !classId || !sectionId || !isValidReportYear}
              >
                {reportLoading ? "Generating..." : "Generate Report"}
              </button>
            </div>
            {reportLoaded && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Admission No</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.P }}>Present</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.A }}>Absent</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.L }}>Late</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.F }}>Half Day</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.H }}>Holiday</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleReport.map((row) => (
                    <tr key={row.student_id}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.admission_no}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.P, fontWeight: 600 }}>{row.present}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.A, fontWeight: 600 }}>{row.absent}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.L, fontWeight: 600 }}>{row.late}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.F, fontWeight: 600 }}>{row.half_day}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", color: typeColor.H, fontWeight: 600 }}>{row.holiday}</td>
                    </tr>
                  ))}
                  {visibleReport.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: 8, color: "var(--text-muted)" }}>No attendance data for selected period.</td></tr>
                  )}
                </tbody>
              </table>
            )}
            {reportLoaded && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10, gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Page {reportPage} of {totalReportPages}</span>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                    Page size
                    <select
                      value={reportPageSize}
                      onChange={(e) => {
                        setReportPageSize(Number(e.target.value));
                        setReportPage(1);
                      }}
                      style={{ ...fieldStyle(), width: 96 }}
                    >
                      {[5, 10, 15, 20, 25, 30, 40, 50, 75, 100].map((size) => (
                        <option key={size} value={size}>{size}</option>
                      ))}
                    </select>
                  </label>
                  <button type="button" onClick={() => setReportPage((prev) => Math.max(1, prev - 1))} disabled={reportPage <= 1} style={btnStyle("#64748b")}>Previous</button>
                  <button type="button" onClick={() => setReportPage((prev) => Math.min(totalReportPages, prev + 1))} disabled={reportPage >= totalReportPages} style={btnStyle("#64748b")}>Next</button>
                </div>
              </div>
            )}
          </div>

        </div>
      </section>
    </div>
  );
}
