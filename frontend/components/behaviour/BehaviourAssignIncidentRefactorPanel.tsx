"use client";

import { useEffect, useMemo, useReducer, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

const STUDENT_PAGE_SIZE_OPTIONS = [5, 10, 12, 20, 50, 100];

type Incident = {
  id: number;
  title: string;
  point: number;
  description?: string;
};

type StudentRow = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  class_id?: number | null;
  section_id?: number | null;
};

type GroupedStudents = Record<string, Record<string, StudentRow[]>>;

type ClassItem = {
  id: number;
  name?: string;
  class_name?: string;
};

type SectionItem = {
  id: number;
  name?: string;
  section_name?: string;
  school_class?: number;
  class_id?: number;
  school_class_id?: number;
};

type SelectionState = {
  selectedIncidentIds: number[];
  selectedStudentIds: number[];
  openSections: Record<string, boolean>;
};

type SelectionAction =
  | { type: "toggleIncident"; id: number }
  | { type: "toggleStudent"; id: number }
  | { type: "toggleSection"; key: string }
  | { type: "setAllSections"; sectionKeys: string[]; open: boolean }
  | { type: "selectSectionStudents"; studentIds: number[]; checked: boolean }
  | { type: "clearAll" };

const initialSelectionState: SelectionState = {
  selectedIncidentIds: [],
  selectedStudentIds: [],
  openSections: {},
};

function selectionReducer(state: SelectionState, action: SelectionAction): SelectionState {
  switch (action.type) {
    case "toggleIncident": {
      const exists = state.selectedIncidentIds.includes(action.id);
      return {
        ...state,
        selectedIncidentIds: exists
          ? state.selectedIncidentIds.filter((id) => id !== action.id)
          : [...state.selectedIncidentIds, action.id],
      };
    }
    case "toggleStudent": {
      const exists = state.selectedStudentIds.includes(action.id);
      return {
        ...state,
        selectedStudentIds: exists
          ? state.selectedStudentIds.filter((id) => id !== action.id)
          : [...state.selectedStudentIds, action.id],
      };
    }
    case "toggleSection": {
      return {
        ...state,
        openSections: {
          ...state.openSections,
          [action.key]: !state.openSections[action.key],
        },
      };
    }
    case "setAllSections": {
      const nextOpenSections = { ...state.openSections };
      action.sectionKeys.forEach((key) => {
        nextOpenSections[key] = action.open;
      });
      return {
        ...state,
        openSections: nextOpenSections,
      };
    }
    case "selectSectionStudents": {
      if (action.checked) {
        const nextSet = new Set([...state.selectedStudentIds, ...action.studentIds]);
        return { ...state, selectedStudentIds: Array.from(nextSet) };
      }
      return {
        ...state,
        selectedStudentIds: state.selectedStudentIds.filter((id) => !action.studentIds.includes(id)),
      };
    }
    case "clearAll": {
      return { ...state, selectedIncidentIds: [], selectedStudentIds: [] };
    }
    default:
      return state;
  }
}

function listData<T>(value: T[] | { results?: T[] }): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    headers: { "Content-Type": "application/json" },
  });
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function studentName(student: StudentRow) {
  return student.full_name || `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Unnamed Student";
}

export default function BehaviourAssignIncidentRefactorPanel() {
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [groupedStudents, setGroupedStudents] = useState<GroupedStudents>({});
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [studentPageSize, setStudentPageSize] = useState(5);
  const [sectionPageMap, setSectionPageMap] = useState<Record<string, number>>({});
  const [selection, dispatch] = useReducer(selectionReducer, initialSelectionState);

  const positiveIncidents = useMemo(() => incidents.filter((row) => row.point > 0), [incidents]);
  const negativeIncidents = useMemo(() => incidents.filter((row) => row.point < 0), [incidents]);

  const groupedEntries = useMemo(() => {
    return Object.entries(groupedStudents).flatMap(([className, sectionMap]) =>
      Object.entries(sectionMap).map(([sectionName, students]) => ({
        className,
        sectionName,
        sectionKey: `${className}__${sectionName}`,
        students,
      }))
    );
  }, [groupedStudents]);

  const accordionStats = useMemo(() => {
    const total = groupedEntries.length;
    const openCount = groupedEntries.filter((entry) => selection.openSections[entry.sectionKey] ?? true).length;
    return { total, openCount };
  }, [groupedEntries, selection.openSections]);

  const filteredSections = useMemo(() => {
    if (!classId) return sections;
    return sections.filter((row) => {
      const value = row.school_class ?? row.class_id ?? row.school_class_id;
      return String(value || "") === classId;
    });
  }, [sections, classId]);

  const loadData = async (keyword = "", classFilter = "", sectionFilter = "") => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams();
      if (keyword) params.set("q", keyword);
      if (classFilter) params.set("class_id", classFilter);
      if (sectionFilter) params.set("section_id", sectionFilter);

      const [incidentData, groupedData, classData, sectionData] = await Promise.all([
        apiGet<Incident[] | { results?: Incident[] }>("/api/v1/behaviour/incidents/?page_size=500"),
        apiGet<GroupedStudents>(`/api/v1/behaviour/assignments/students-grouped/?${params.toString()}`),
        apiGet<ClassItem[] | { results?: ClassItem[] }>("/api/v1/core/classes/?page_size=500"),
        apiGet<SectionItem[] | { results?: SectionItem[] }>("/api/v1/core/sections/?page_size=500"),
      ]);

      setIncidents(listData(incidentData));
      setGroupedStudents(groupedData || {});
      setClasses(listData(classData));
      setSections(listData(sectionData));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load incident assignment data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setSectionPageMap((prev) => {
      const next: Record<string, number> = {};
      groupedEntries.forEach((entry) => {
        const totalPages = Math.max(1, Math.ceil(entry.students.length / studentPageSize));
        const current = prev[entry.sectionKey] || 1;
        next[entry.sectionKey] = Math.min(Math.max(current, 1), totalPages);
      });
      return next;
    });
  }, [groupedEntries, studentPageSize]);

  const handleSearch = () => {
    void loadData(search.trim(), classId, sectionId);
  };

  const handleClassChange = (value: string) => {
    setClassId(value);
    setSectionId("");
    dispatch({ type: "clearAll" });
    void loadData(search.trim(), value, "");
  };

  const handleSectionChange = (value: string) => {
    setSectionId(value);
    dispatch({ type: "clearAll" });
    void loadData(search.trim(), classId, value);
  };

  const handlePageSizeChange = (value: string) => {
    const nextSize = Number(value) || 5;
    setStudentPageSize(nextSize);
    setSectionPageMap({});
  };

  const sectionSelectionState = (students: StudentRow[]) => {
    if (!students.length) return { checked: false, indeterminate: false };
    const selectedCount = students.filter((row) => selection.selectedStudentIds.includes(row.id)).length;
    return {
      checked: selectedCount === students.length,
      indeterminate: selectedCount > 0 && selectedCount < students.length,
    };
  };

  const assignSelected = async () => {
    if (selection.selectedIncidentIds.length === 0 || selection.selectedStudentIds.length === 0) {
      setError("Select incidents and students first.");
      return;
    }

    try {
      setSubmitting(true);
      setError("");
      setSuccess("");

      await apiPost("/api/v1/behaviour/assignments/assign-incident/", {
        incident_ids: selection.selectedIncidentIds,
        student_ids: selection.selectedStudentIds,
      });

      setSuccess("Incidents assigned successfully.");
      dispatch({ type: "clearAll" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to assign incidents.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="legacy-panel pb-28">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div className="flex items-center justify-between gap-3">
            <h1 className="m-0 text-2xl font-bold">Student Incident Assignment</h1>
            <div className="flex gap-2 text-sm text-[var(--text-muted)]">
              <span>Dashboard</span>
              <span>/</span>
              <span>Behaviour Records</span>
              <span>/</span>
              <span>Assign Incident</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div className="mb-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-[1fr_220px_220px_auto]">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by student name, admission no, roll no"
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              />
              <select
                value={classId}
                onChange={(event) => handleClassChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="">All Classes</option>
                {classes.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name || row.class_name || `Class ${row.id}`}
                  </option>
                ))}
              </select>
              <select
                value={sectionId}
                onChange={(event) => handleSectionChange(event.target.value)}
                className="h-10 w-full rounded-lg border border-slate-300 px-3 text-sm"
              >
                <option value="">All Sections</option>
                {filteredSections.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.name || row.section_name || `Section ${row.id}`}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleSearch}
                className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-4 text-sm font-semibold text-slate-700"
              >
                Search
              </button>
            </div>
          </div>

          <div className="mb-3 grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold text-emerald-700">Positive Incidents</h3>
              <div className="grid gap-2">
                {positiveIncidents.map((incident) => (
                  <label key={incident.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-emerald-200 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selection.selectedIncidentIds.includes(incident.id)}
                        onChange={() => dispatch({ type: "toggleIncident", id: incident.id })}
                      />
                      <span className="text-sm font-medium text-slate-800">{incident.title}</span>
                    </div>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-bold text-emerald-700">+{incident.point}</span>
                  </label>
                ))}
                {positiveIncidents.length === 0 && <p className="text-sm text-slate-500">No positive incidents found.</p>}
              </div>
            </div>

            <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-4 shadow-sm">
              <h3 className="mb-2 text-base font-semibold text-rose-700">Negative Incidents</h3>
              <div className="grid gap-2">
                {negativeIncidents.map((incident) => (
                  <label key={incident.id} className="flex cursor-pointer items-center justify-between rounded-lg border border-rose-200 bg-white px-3 py-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={selection.selectedIncidentIds.includes(incident.id)}
                        onChange={() => dispatch({ type: "toggleIncident", id: incident.id })}
                      />
                      <span className="text-sm font-medium text-slate-800">{incident.title}</span>
                    </div>
                    <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700">{incident.point}</span>
                  </label>
                ))}
                {negativeIncidents.length === 0 && <p className="text-sm text-slate-500">No negative incidents found.</p>}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <p className="text-sm font-semibold text-slate-700">
                Accordion Sections: {accordionStats.openCount}/{accordionStats.total} open
              </p>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                  Rows / page
                  <select
                    value={studentPageSize}
                    onChange={(event) => handlePageSizeChange(event.target.value)}
                    className="h-9 rounded-lg border border-slate-300 bg-white px-2 text-xs font-semibold text-slate-700"
                  >
                    {STUDENT_PAGE_SIZE_OPTIONS.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "setAllSections",
                      sectionKeys: groupedEntries.map((entry) => entry.sectionKey),
                      open: true,
                    })
                  }
                  className="h-9 rounded-lg border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700"
                >
                  Expand All
                </button>
                <button
                  type="button"
                  onClick={() =>
                    dispatch({
                      type: "setAllSections",
                      sectionKeys: groupedEntries.map((entry) => entry.sectionKey),
                      open: false,
                    })
                  }
                  className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700"
                >
                  Collapse All
                </button>
              </div>
            </div>

            {groupedEntries.map((entry) => {
              const state = sectionSelectionState(entry.students);
              const isOpen = selection.openSections[entry.sectionKey] ?? true;
              const studentIds = entry.students.map((row) => row.id);
              const totalPages = Math.max(1, Math.ceil(entry.students.length / studentPageSize));
              const currentPage = sectionPageMap[entry.sectionKey] || 1;
              const pageStart = (currentPage - 1) * studentPageSize;
              const pageStudents = entry.students.slice(pageStart, pageStart + studentPageSize);
              const pageFrom = entry.students.length === 0 ? 0 : pageStart + 1;
              const pageTo = Math.min(pageStart + studentPageSize, entry.students.length);

              return (
                <div key={entry.sectionKey} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <button
                    type="button"
                    className="flex w-full items-center justify-between bg-slate-50 px-4 py-3 text-left"
                    onClick={() => dispatch({ type: "toggleSection", key: entry.sectionKey })}
                  >
                    <span className="text-sm font-semibold text-slate-800">
                      {entry.className} - {entry.sectionName} ({entry.students.length})
                    </span>
                    <span className="text-sm font-bold text-slate-500">{isOpen ? "−" : "+"}</span>
                  </button>

                  <div className={`transition-all duration-300 ease-in-out ${isOpen ? "max-h-[1200px]" : "max-h-0"} overflow-hidden`}>
                    <div className="border-t border-slate-200 p-4">
                      <label className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700">
                        <input
                          type="checkbox"
                          checked={state.checked}
                          ref={(el) => {
                            if (el) el.indeterminate = state.indeterminate;
                          }}
                          onChange={(event) =>
                            dispatch({
                              type: "selectSectionStudents",
                              studentIds,
                              checked: event.target.checked,
                            })
                          }
                        />
                        Select All in {entry.className} - {entry.sectionName}
                      </label>

                      <div className="overflow-x-auto">
                        <table className="min-w-full border-collapse">
                          <thead>
                            <tr className="bg-slate-100">
                              <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">Pick</th>
                              <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-700">Admission No</th>
                              <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">Roll</th>
                              <th className="border-b border-slate-200 px-3 py-2 text-left text-xs font-semibold text-slate-600">Student</th>
                            </tr>
                          </thead>
                          <tbody>
                            {pageStudents.map((student) => (
                              <tr key={student.id} className="hover:bg-slate-50">
                                <td className="border-b border-slate-100 px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={selection.selectedStudentIds.includes(student.id)}
                                    onChange={() => dispatch({ type: "toggleStudent", id: student.id })}
                                  />
                                </td>
                                <td className="border-b border-slate-100 px-3 py-2 text-sm font-bold tracking-wide text-slate-900">
                                  {student.admission_no || "-"}
                                </td>
                                <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{student.roll_no || "-"}</td>
                                <td className="border-b border-slate-100 px-3 py-2 text-sm text-slate-700">{studentName(student)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <p className="text-xs font-medium text-slate-500">
                          Showing {pageFrom}-{pageTo} of {entry.students.length} students
                        </p>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={currentPage <= 1}
                            onClick={() =>
                              setSectionPageMap((prev) => ({
                                ...prev,
                                [entry.sectionKey]: Math.max(1, currentPage - 1),
                              }))
                            }
                            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Prev
                          </button>
                          <span className="text-xs font-semibold text-slate-600">
                            Page {currentPage} / {totalPages}
                          </span>
                          <button
                            type="button"
                            disabled={currentPage >= totalPages}
                            onClick={() =>
                              setSectionPageMap((prev) => ({
                                ...prev,
                                [entry.sectionKey]: Math.min(totalPages, currentPage + 1),
                              }))
                            }
                            className="h-8 rounded-md border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {!loading && groupedEntries.length === 0 && (
              <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">No students found for the current filter.</div>
            )}
          </div>

          {loading && <p className="mt-3 text-sm text-slate-500">Loading incident assignment data...</p>}
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          {success && <p className="mt-3 text-sm text-emerald-600">{success}</p>}
        </div>
      </section>

      <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-semibold text-slate-700">
            {selection.selectedIncidentIds.length} Incidents selected for {selection.selectedStudentIds.length} Students
          </p>
          <button
            type="button"
            disabled={submitting || selection.selectedIncidentIds.length === 0 || selection.selectedStudentIds.length === 0}
            onClick={() => void assignSelected()}
            className="h-10 rounded-lg bg-blue-600 px-5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Assigning..." : "Confirm Assignment"}
          </button>
        </div>
      </div>
    </div>
  );
}
