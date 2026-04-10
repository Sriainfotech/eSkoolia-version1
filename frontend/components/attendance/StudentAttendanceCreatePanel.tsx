"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type AcademicYear = { id: number; name: string; is_current: boolean };
type SchoolClass = { id: number; name: string };
type Section = { id: number; school_class: number; name: string };
type ApiList<T> = T[] | { results?: T[] };

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

const ATTENDANCE_STATUSES = [
  { key: "P", label: "Present", color: "#16a34a" },
  { key: "L", label: "Late", color: "#d97706" },
  { key: "A", label: "Absent", color: "#dc2626" },
  { key: "F", label: "Half Day", color: "#2563eb" },
];

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

function fieldStyle() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px", fontSize: 13 } as const;
}

function btnStyle(color = "var(--primary)") {
  return { height: 36, padding: "0 14px", border: `1px solid ${color}`, background: color, color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 500 } as const;
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function Modal({ isOpen, title, message, onConfirm, onCancel }: { isOpen: boolean; title: string; message: string; onConfirm: () => void; onCancel: () => void }) {
  if (!isOpen) return null;
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 12, padding: 24, maxWidth: 400 }}>
        <h3 style={{ margin: "0 0 12px 0" }}>{title}</h3>
        <p style={{ margin: "0 0 20px 0", color: "var(--text-muted)", fontSize: 14 }}>{message}</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button type="button" onClick={onCancel} style={{ ...btnStyle("#6b7280"), background: "#e5e7eb", color: "#1f2937" }}>Cancel</button>
          <button type="button" onClick={onConfirm} style={btnStyle()}>Confirm</button>
        </div>
      </div>
    </div>
  );
}

export default function StudentAttendanceCreatePanel() {
  const [years, setYears] = useState<AcademicYear[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().slice(0, 10));
  const [academicYearId, setAcademicYearId] = useState("");

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [attendance, setAttendance] = useState<Record<number, AttendanceEntry>>({});
  const [markHoliday, setMarkHoliday] = useState(false);
  const [lockAttendance, setLockAttendance] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: "" });

  useEffect(() => {
    const load = async () => {
      try {
        setError("");
        const [yearData, classData, sectionData] = await Promise.allSettled([
          apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
          apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
          apiGet<ApiList<Section>>("/api/v1/core/sections/"),
        ]);

        const loadedYears = yearData.status === "fulfilled" ? listData(yearData.value) : [];
        const loadedClasses = classData.status === "fulfilled" ? listData(classData.value) : [];
        let loadedSections: Section[] = sectionData.status === "fulfilled" ? listData(sectionData.value) : [];

        if (!loadedSections.length) {
          loadedSections = loadedClasses.flatMap((schoolClass) => {
            const classWithSections = schoolClass as SchoolClass & { sections?: Array<{ id: number; name: string }> };
            return (classWithSections.sections || []).map((section) => ({
              id: section.id,
              name: section.name,
              school_class: schoolClass.id,
            }));
          });
        }

        setYears(loadedYears);
        setClasses(loadedClasses);
        setSections(loadedSections);
      } catch (err) {
        const message = err instanceof Error ? err.message : "";
        setError(message && message !== "401" ? message : "Unable to load attendance criteria.");
      }
    };
    void load();
  }, []);

  const filteredSections = useMemo(() => {
    const id = Number(classId);
    if (!id) return [];
    return sections.filter((s) => s.school_class === id);
  }, [classId, sections]);

  const searchStudents = async () => {
    if (!classId || !sectionId || !attendanceDate) {
      setError("Please select academic year, class, section, and date");
      return;
    }

    // Check date is not in future
    const selectedDate = new Date(attendanceDate);
    const today = new Date();
    if (selectedDate > today) {
      setError("Attendance cannot be marked for future dates");
      return;
    }

    try {
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

      if (!data.students || data.students.length === 0) {
        setError("No students found for selected class and section");
        return;
      }

      setStudents(data.students || []);
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
      setCurrentPage(1);
      setHasChanges(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Failed to load students.");
    }
  };

  const setType = (studentId: number, type: string) => {
    setAttendance((prev) => ({ ...prev, [studentId]: { ...prev[studentId], attendance_type: type } }));
    setHasChanges(true);
  };

  const setNote = (studentId: number, note: string) => {
    if (note.length > 250) {
      setError("Note cannot exceed 250 characters");
      return;
    }
    setAttendance((prev) => ({ ...prev, [studentId]: { ...prev[studentId], notes: note } }));
    setHasChanges(true);
  };

  const markAllPresent = () => {
    const updated: Record<number, AttendanceEntry> = {};
    students.forEach((s) => {
      updated[s.id] = { ...attendance[s.id], attendance_type: "P" };
    });
    setAttendance(updated);
    setHasChanges(true);
  };

  const markAllAbsent = () => {
    const updated: Record<number, AttendanceEntry> = {};
    students.forEach((s) => {
      updated[s.id] = { ...attendance[s.id], attendance_type: "A" };
    });
    setAttendance(updated);
    setHasChanges(true);
  };

  const countByStatus = (status: string) => Object.values(attendance).filter((a) => a.attendance_type === status).length;
  const presentCount = countByStatus("P");
  const absentCount = countByStatus("A");
  const lateCount = countByStatus("L");
  const halfDayCount = countByStatus("F");

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        s.admission_no.toLowerCase().includes(query) ||
        s.first_name.toLowerCase().includes(query) ||
        s.last_name.toLowerCase().includes(query) ||
        (s.roll_no && s.roll_no.toLowerCase().includes(query))
    );
  }, [students, searchQuery]);

  const totalPages = Math.ceil(filteredStudents.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStudents = filteredStudents.slice(startIndex, endIndex);

  const saveAttendance = async (shouldLock = false) => {
    if (!students.length) {
      setError("No students loaded");
      return;
    }

    // Validate all students have status
    const allMarked = students.every((s) => attendance[s.id]?.attendance_type);
    if (!allMarked) {
      setError("Please mark attendance for all students");
      return;
    }

    setConfirmModal({ isOpen: false, message: "" });
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = await apiPost<{ success: boolean; message: string }>(
        "/api/v1/attendance/student-attendance/store/",
        {
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
          lock_attendance: shouldLock,
        }
      );

      if (response.success) {
        setSuccess(shouldLock ? "Attendance saved and locked successfully" : response.message);
        setHasChanges(false);
        await searchStudents();
      } else {
        setError(response.message || "Failed to save attendance");
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "";
      setError(message && message !== "401" ? message : "Failed to save attendance. Please try again");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveClick = () => {
    setConfirmModal({
      isOpen: true,
      message: lockAttendance ? "Are you sure you want to submit and lock this attendance? You won't be able to edit after locking." : "Are you sure you want to submit attendance?",
    });
  };

  const typeColor: Record<string, string> = { P: "#16a34a", A: "#dc2626", L: "#d97706", F: "#2563eb", H: "#6b7280" };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Student Attendance</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span><span>/</span><span>Attendance</span><span>/</span><span>Student Attendance</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">

          {/* Search Filters Box */}
          <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
            <div style={{ fontWeight: 600, marginBottom: 12 }}>Search Students</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto", gap: 8, marginBottom: 10 }}>
              <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} style={fieldStyle()}>
                <option value="">Academic Year</option>
                {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              <select
                value={classId}
                onChange={(e) => {
                  setClassId(e.target.value);
                  setSectionId("");
                  setLoaded(false);
                  setStudents([]);
                }}
                style={fieldStyle()}
              >
                <option value="">Class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select
                value={sectionId}
                onChange={(e) => {
                  setSectionId(e.target.value);
                  setLoaded(false);
                  setStudents([]);
                }}
                style={fieldStyle()}
              >
                <option value="">Section</option>
                {filteredSections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => {
                  setAttendanceDate(e.target.value);
                  setLoaded(false);
                }}
                style={fieldStyle()}
              />
              <button type="button" onClick={() => void searchStudents()} style={btnStyle()}>Search</button>
            </div>
            {error && <p style={{ color: "#dc2626", marginTop: 8, fontSize: 13 }}>{error}</p>}
          </div>

          {/* Attendance Marking Box */}
          {loaded && students.length > 0 && (
            <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
              {/* Summary Bar */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12, marginBottom: 16 }}>
                <div style={{ background: "#ecfdf5", border: "1px solid #d1fae5", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Total Students</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: "#047857" }}>{students.length}</div>
                </div>
                <div style={{ background: "#ecfdf5", border: "1px solid #d1fae5", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Present</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: typeColor.P }}>{presentCount}</div>
                </div>
                <div style={{ background: "#fee2e2", border: "1px solid #fecaca", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Absent</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: typeColor.A }}>{absentCount}</div>
                </div>
                <div style={{ background: "#fef3c7", border: "1px solid #fde68a", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Late</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: typeColor.L }}>{lateCount}</div>
                </div>
                <div style={{ background: "#dbeafe", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12 }}>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 4 }}>Half Day</div>
                  <div style={{ fontSize: 20, fontWeight: 600, color: typeColor.F }}>{halfDayCount}</div>
                </div>
              </div>

              {/* Header with Holiday Toggle and Bulk Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <label style={{ fontSize: 13, display: "flex", gap: 6, alignItems: "center" }}>
                    <input
                      type="checkbox"
                      checked={markHoliday}
                      onChange={(e) => {
                        setMarkHoliday(e.target.checked);
                        setHasChanges(true);
                      }}
                      disabled={loaded && students.length > 0}
                    />
                    <span>Mark as Holiday</span>
                  </label>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="button" onClick={() => markAllPresent()} style={btnStyle("#10b981")}>Mark All Present</button>
                  <button type="button" onClick={() => markAllAbsent()} style={btnStyle("#ef4444")}>Mark All Absent</button>
                </div>
              </div>

              {/* Search Within Table */}
              <div style={{ marginBottom: 12 }}>
                <input
                  type="text"
                  placeholder="Search by admission no, name, or roll number..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  style={{ ...fieldStyle(), width: "100%", height: 32 }}
                />
              </div>

              {/* Attendance Table */}
              <div style={{ overflowX: "auto", marginBottom: 12 }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                    <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                      <th style={{ padding: 8, borderBottom: "2px solid var(--line)", minWidth: 100 }}>Admission No</th>
                      <th style={{ padding: 8, borderBottom: "2px solid var(--line)", minWidth: 150 }}>Name</th>
                      <th style={{ padding: 8, borderBottom: "2px solid var(--line)", minWidth: 80 }}>Roll No</th>
                      <th style={{ padding: 8, borderBottom: "2px solid var(--line)", minWidth: 250 }}>Status</th>
                      <th style={{ padding: 8, borderBottom: "2px solid var(--line)", minWidth: 200 }}>Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedStudents.map((student) => {
                      const entry = attendance[student.id];
                      const curType = entry?.attendance_type ?? "P";
                      return (
                        <tr key={student.id} style={{ background: "white" }}>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", fontSize: 13 }}>{student.admission_no}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", fontSize: 13 }}>{student.first_name} {student.last_name}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", fontSize: 13 }}>{student.roll_no || "-"}</td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                              {ATTENDANCE_STATUSES.map((status) => (
                                <button
                                  key={status.key}
                                  type="button"
                                  onClick={() => setType(student.id, status.key)}
                                  style={{
                                    padding: "4px 10px",
                                    border: `2px solid ${status.color}`,
                                    background: curType === status.key ? status.color : "#fff",
                                    color: curType === status.key ? "#fff" : status.color,
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    fontSize: 11,
                                    fontWeight: 600,
                                    transition: "all 0.2s",
                                  }}
                                >
                                  {status.label}
                                </button>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                            <input
                              value={entry?.notes ?? ""}
                              onChange={(e) => setNote(student.id, e.target.value)}
                              placeholder="Optional note (max 250 chars)"
                              maxLength={250}
                              style={{ ...fieldStyle(), height: 30, width: "100%", fontSize: 12 }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {filteredStudents.length > itemsPerPage && (
                <div style={{ marginBottom: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      style={{ ...fieldStyle(), width: 70, height: 32 }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                    </select>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>entries</span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                      style={{ ...btnStyle(), opacity: currentPage === 1 ? 0.5 : 1, cursor: currentPage === 1 ? "not-allowed" : "pointer" }}
                    >
                      ← Previous
                    </button>
                    <span style={{ fontSize: 13, fontWeight: 500, minWidth: 80, textAlign: "center" }}>Page {currentPage} of {totalPages}</span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                      style={{ ...btnStyle(), opacity: currentPage === totalPages ? 0.5 : 1, cursor: currentPage === totalPages ? "not-allowed" : "pointer" }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}

              {/* Save Options */}
              <div style={{ display: "flex", gap: 8, alignItems: "center", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid var(--line)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <input
                    type="checkbox"
                    checked={lockAttendance}
                    onChange={(e) => setLockAttendance(e.target.checked)}
                  />
                  <label style={{ fontSize: 13 }}>Lock attendance after saving (prevents further edits)</label>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => void handleSaveClick()}
                    disabled={saving || !hasChanges}
                    style={{ ...btnStyle(), opacity: (!hasChanges || saving) ? 0.6 : 1, cursor: (!hasChanges || saving) ? "not-allowed" : "pointer" }}
                  >
                    {saving ? "Saving..." : "Save Attendance"}
                  </button>
                </div>
              </div>

              {/* Status Messages */}
              {hasChanges && (
                <p style={{ color: "#d97706", marginTop: 8, fontSize: 13, fontWeight: 500 }}>You have unsaved changes</p>
              )}
              {success && <p style={{ color: "#059669", marginTop: 8, fontSize: 13, fontWeight: 500 }}>{success}</p>}
              {error && <p style={{ color: "#dc2626", marginTop: 8, fontSize: 13 }}>{error}</p>}
            </div>
          )}

          {/* No Students Message */}
          {loaded && students.length === 0 && (
            <div className="white-box" style={{ ...boxStyle(), marginBottom: 12, textAlign: "center", padding: 32 }}>
              <p style={{ color: "var(--text-muted)", fontSize: 14 }}>No students found for the selected class and section.</p>
            </div>
          )}

        </div>
      </section>

      {/* Confirmation Modal */}
      <Modal
        isOpen={confirmModal.isOpen}
        title="Confirm Attendance Submission"
        message={confirmModal.message}
        onConfirm={() => void saveAttendance(lockAttendance)}
        onCancel={() => setConfirmModal({ isOpen: false, message: "" })}
      />
    </div>
  );
}
