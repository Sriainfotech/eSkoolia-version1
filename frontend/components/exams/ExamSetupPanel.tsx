"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";

type SchoolClass = { id: number; class_name?: string; name?: string };
type Section = { id: number; section_name?: string; name?: string; class_id?: number; school_class?: number };
type Subject = { id: number; subject_name?: string; name?: string };
type ExamType = { id: number; title: string };

type SetupRow = {
  id?: number;
  exam_title: string;
  exam_mark: string;
};

type ConfiguredExamRow = {
  id: number;
  exam_name: string;
  classes: string;
  status: "Active" | "Draft";
};

// Mock data — the exam-setup list endpoint isn't wired up yet, so this table
// renders sample rows to show the intended layout (Exam Name, Classes, Status, Actions).
const MOCK_CONFIGURED_EXAMS: ConfiguredExamRow[] = [
  { id: 1, exam_name: "Mid Term Examination", classes: "Class 5, Class 6", status: "Active" },
  { id: 2, exam_name: "Final Examination", classes: "Class 5-A, Class 5-B, Class 6-A", status: "Draft" },
  { id: 3, exam_name: "Unit Test 1", classes: "Class 7", status: "Active" },
];

function authHeaders(): Record<string, string> {
  const token = getAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", headers: authHeaders() });
  if (!response.ok) throw new Error(`GET failed ${response.status}`);
  return (await response.json()) as T;
}

async function apiPost<T>(path: string, payload: unknown): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.message || body?.detail || `POST failed ${response.status}`);
  }
  return (await response.json()) as T;
}

function fieldStyle() {
  return {
    width: "100%",
    height: 40,
    border: "1px solid #cbd5e1",
    borderRadius: 12,
    padding: "0 12px",
    background: "#fff",
  } as const;
}

function boxStyle() {
  return {
    background: "#f8fbff",
    border: "1px solid #dbeafe",
    borderRadius: 24,
    padding: 18,
  } as const;
}

function buttonStyle(color = "var(--primary)") {
  return {
    height: 38,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 10,
    padding: "0 14px",
    cursor: "pointer",
    fontWeight: 600,
  } as const;
}

function isDigitsOnly(value: string) {
  return /^\d*$/.test(value);
}

function isMeaningfulTitle(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(.)\1{2,}$/i.test(trimmed)) return false;
  if (/^[^A-Za-z0-9\s]+$/.test(trimmed)) return false;
  return true;
}

export default function ExamSetupPanel() {
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [examTypes, setExamTypes] = useState<ExamType[]>([]);

  const [classIds, setClassIds] = useState<string[]>([]);
  const [classMenuOpen, setClassMenuOpen] = useState(false);
  const [sectionIds, setSectionIds] = useState<string[]>([]);
  const [sectionMenuOpen, setSectionMenuOpen] = useState(false);
  const [subjectIds, setSubjectIds] = useState<string[]>([]);
  const [subjectMenuOpen, setSubjectMenuOpen] = useState(false);
  const [subjectQuery, setSubjectQuery] = useState("");
  const [examTermIds, setExamTermIds] = useState<string[]>([]);
  const [examTermMenuOpen, setExamTermMenuOpen] = useState(false);
  const [examTermQuery, setExamTermQuery] = useState("");
  const [totalExamMark, setTotalExamMark] = useState("0");

  const [rows, setRows] = useState<SetupRow[]>([{ exam_title: "", exam_mark: "0" }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const subjectMenuRef = useRef<HTMLDivElement | null>(null);
  const examTermMenuRef = useRef<HTMLDivElement | null>(null);
  const classMenuRef = useRef<HTMLDivElement | null>(null);
  const sectionMenuRef = useRef<HTMLDivElement | null>(null);

  const filteredSections = useMemo(() => {
    if (classIds.length === 0) return [];
    const ids = classIds.map(Number);
    return sections.filter((s) => ids.includes((s.class_id ?? s.school_class) as number));
  }, [classIds, sections]);

  // Drop any selected sections that no longer belong to the selected class(es).
  useEffect(() => {
    setSectionIds((prev) => prev.filter((value) => filteredSections.some((s) => String(s.id) === value)));
  }, [filteredSections]);

  const criteriaReady = Boolean(classIds.length > 0 && sectionIds.length > 0 && subjectIds.length > 0 && examTermIds.length > 0);
  const primaryClassId = classIds[0] || "";
  const primarySectionId = sectionIds[0] || "";
  const primarySubjectId = subjectIds[0] || "";
  const primaryExamTermId = examTermIds[0] || "";
  const filteredSubjects = useMemo(() => {
    const q = subjectQuery.trim().toLowerCase();
    if (!q) return subjects;
    return subjects.filter((item) => (item.subject_name || item.name || `Subject ${item.id}`).toLowerCase().includes(q));
  }, [subjects, subjectQuery]);
  const filteredExamTypes = useMemo(() => {
    const q = examTermQuery.trim().toLowerCase();
    if (!q) return examTypes;
    return examTypes.filter((item) => item.title.toLowerCase().includes(q));
  }, [examTypes, examTermQuery]);
  const totalExamMarkError = useMemo(() => {
    if (!totalExamMark.trim()) return "Total exam mark is required.";
    if (!isDigitsOnly(totalExamMark)) return "Digits only.";
    return "";
  }, [totalExamMark]);

  const rowErrors = useMemo(
    () =>
      rows.map((row) => {
        const titleError = row.exam_title.trim()
          ? isMeaningfulTitle(row.exam_title)
            ? ""
            : "Use a meaningful title (not !!! or zzz)."
          : "Title is required.";
        const markError = !row.exam_mark.trim()
          ? "Mark is required."
          : isDigitsOnly(row.exam_mark)
            ? ""
            : "Digits only.";

        return { titleError, markError };
      }),
    [rows]
  );

  const hasRowErrors = useMemo(
    () => rowErrors.some((item) => item.titleError || item.markError),
    [rowErrors]
  );

  const totalMarkNumber = useMemo(
    () => rows.reduce((sum, row) => sum + Number(row.exam_mark || 0), 0),
    [rows]
  );

  const totalMark = useMemo(() => totalMarkNumber.toFixed(2), [totalMarkNumber]);
  const totalExamMarkNumber = useMemo(() => Number(totalExamMark || 0), [totalExamMark]);
  const isSumMatched = useMemo(
    () => Math.abs(totalMarkNumber - totalExamMarkNumber) < 0.0001,
    [totalMarkNumber, totalExamMarkNumber]
  );

  const canSave = criteriaReady && !totalExamMarkError && !hasRowErrors && isSumMatched && !loading;

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiGet<{
          classes: SchoolClass[];
          sections: Section[];
          subjects: Subject[];
          exam_types: ExamType[];
        }>("/api/v1/exams/exam-setup/index/");
        setClasses(data.classes || []);
        setSections(data.sections || []);
        setSubjects(data.subjects || []);
        setExamTypes(data.exam_types || []);
      } catch {
        setError("Failed to load exam setup criteria.");
      }
    };
    void load();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const examTypeId = params.get("exam_type_id");
    if (examTypeId) setExamTermIds([examTypeId]);
  }, []);

  const searchExisting = async () => {
    if (!primaryClassId || !primarySectionId || !primarySubjectId || !primaryExamTermId) return;
    if (classIds.length !== 1) return;
    if (sectionIds.length !== 1) return;
    if (subjectIds.length !== 1) return;
    if (examTermIds.length !== 1) return;

    try {
      const data = await apiGet<{ items: Array<{ exam_title: string; exam_mark: string }>; totalMark: string }>(
        `/api/v1/exams/exam-setup/search/?class=${primaryClassId}&section=${primarySectionId}&subject=${primarySubjectId}&exam_term_id=${primaryExamTermId}`
      );
      if ((data.items || []).length > 0) {
        setRows(data.items.map((item) => ({ exam_title: item.exam_title, exam_mark: item.exam_mark })));
        setTotalExamMark(data.totalMark || "0");
      }
    } catch {
      // Keep empty form if no setup is found.
    }
  };

  const onClassesChange = (values: string[]) => {
    setClassIds(values);
  };

  const toggleClass = (classValue: string) => {
    setClassIds((prev) => (prev.includes(classValue) ? prev.filter((id) => id !== classValue) : [...prev, classValue]));
  };

  const onSectionsChange = (values: string[]) => {
    setSectionIds(values);
  };

  const toggleSection = (sectionValue: string) => {
    setSectionIds((prev) => (prev.includes(sectionValue) ? prev.filter((id) => id !== sectionValue) : [...prev, sectionValue]));
  };

  const onExamTermsChange = (values: string[]) => {
    setExamTermIds(values);
  };

  const toggleExamTerm = (examValue: string) => {
    setExamTermIds((prev) => (prev.includes(examValue) ? prev.filter((id) => id !== examValue) : [...prev, examValue]));
  };

  const onSubjectsChange = (values: string[]) => {
    setSubjectIds(values);
  };

  const toggleSubject = (subjectValue: string) => {
    setSubjectIds((prev) => (prev.includes(subjectValue) ? prev.filter((id) => id !== subjectValue) : [...prev, subjectValue]));
  };

  useEffect(() => {
    void searchExisting();
  }, [primaryClassId, classIds.length, primarySectionId, sectionIds.length, primarySubjectId, subjectIds.length, primaryExamTermId, examTermIds.length]);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (subjectMenuRef.current && !subjectMenuRef.current.contains(event.target as Node)) {
        setSubjectMenuOpen(false);
      }

      if (examTermMenuRef.current && !examTermMenuRef.current.contains(event.target as Node)) {
        setExamTermMenuOpen(false);
      }

      if (classMenuRef.current && !classMenuRef.current.contains(event.target as Node)) {
        setClassMenuOpen(false);
      }

      if (sectionMenuRef.current && !sectionMenuRef.current.contains(event.target as Node)) {
        setSectionMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const addRow = () => setRows((prev) => [...prev, { exam_title: "", exam_mark: "0" }]);

  const removeRow = (index: number) => {
    setRows((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));
  };

  const updateRow = (index: number, key: "exam_title" | "exam_mark", value: string) => {
    if (key === "exam_mark" && !isDigitsOnly(value)) return;
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, [key]: value } : row)));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (classIds.length === 0 || sectionIds.length === 0 || subjectIds.length === 0 || examTermIds.length === 0) {
      setError("Class(es), section(s), subject(s) and exam term(s) are required.");
      return;
    }

    if (rows.some((row) => !row.exam_title.trim())) {
      setError("Each exam title is required.");
      return;
    }

    if (totalExamMarkError || hasRowErrors) {
      setError("Please fix validation errors before saving.");
      return;
    }

    if (!isSumMatched) {
      setError("Distribution sum must match total exam mark.");
      return;
    }

    try {
      setLoading(true);
      const payloadBase = {
        total_exam_mark: Number(totalExamMark || 0).toFixed(2),
        totalMark: Number(totalMark || 0).toFixed(2),
        exam_title: rows.map((row) => row.exam_title.trim()),
        exam_mark: rows.map((row) => Number(row.exam_mark || 0).toFixed(2)),
      };

      const results = await Promise.allSettled(
        classIds.flatMap((classValue) =>
          sectionIds.flatMap((sectionValue) =>
            subjectIds.flatMap((subjectValue) =>
              examTermIds.map((examTermValue) =>
                apiPost("/api/v1/exams/exam-setup/store/", {
                  ...payloadBase,
                  class: Number(classValue),
                  section: Number(sectionValue),
                  subject: Number(subjectValue),
                  exam_term_id: Number(examTermValue),
                })
              )
            )
          )
        )
      );

      const failed = results.filter((item) => item.status === "rejected") as PromiseRejectedResult[];
      const successCount = results.length - failed.length;

      if (failed.length > 0) {
        const firstMessage = failed[0].reason instanceof Error ? failed[0].reason.message : "Operation failed";
        if (successCount > 0) {
          setError(`${successCount} setup(s) saved, ${failed.length} failed. ${firstMessage}`);
        } else {
          setError(firstMessage);
        }
        return;
      }

      setSuccess(successCount > 1 ? `Operation successful for ${successCount} setup(s)` : "Operation successful");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Operation failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Exam Setup</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span><span>/</span><span>Examinations</span><span>/</span><span>Exam Setup</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <form onSubmit={(e) => void submit(e)}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: 14, alignItems: "start" }}>
              <div className="white-box" style={boxStyle()}>
                <div style={{ marginBottom: 10 }}>
                  <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: "#dbeafe", color: "#1d4ed8", fontSize: 12, fontWeight: 700 }}>STEP 1</span>
                </div>
                <h3 style={{ marginTop: 0, marginBottom: 6, color: "#0f172a" }}>Exam Criteria</h3>
                <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>
                  Select exam term, class, section and subject first. Distribution setup depends on this criteria.
                </p>

                <div style={{ display: "grid", gap: 10 }}>
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Exam Term(s) *</label>
                    <div ref={examTermMenuRef} style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setExamTermMenuOpen((prev) => !prev)}
                        style={{
                          ...fieldStyle(),
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          textAlign: "left",
                          borderColor: examTermIds.length === 0 ? "#ef4444" : "#cbd5e1",
                        }}
                      >
                        <span style={{ color: examTermIds.length ? "#0f172a" : "#94a3b8", fontWeight: 500 }}>
                          {examTermIds.length ? `${examTermIds.length} exam term(s) selected` : "Select exam term(s)"}
                        </span>
                        <span style={{ color: "#64748b" }}>{examTermMenuOpen ? "▲" : "▼"}</span>
                      </button>

                      {examTermMenuOpen && (
                        <div
                          style={{
                            position: "absolute",
                            zIndex: 30,
                            top: "calc(100% + 6px)",
                            left: 0,
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            background: "#fff",
                            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.14)",
                            padding: 10,
                          }}
                        >
                          <input
                            type="text"
                            value={examTermQuery}
                            onChange={(e) => setExamTermQuery(e.target.value)}
                            placeholder="Search exam term"
                            style={{ ...fieldStyle(), height: 34, marginBottom: 8 }}
                          />
                          <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6 }}>
                            {filteredExamTypes.map((item) => {
                              const value = String(item.id);
                              const checked = examTermIds.includes(value);
                              return (
                                <label
                                  key={item.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 4px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    background: checked ? "#eff6ff" : "transparent",
                                  }}
                                >
                                  <input type="checkbox" checked={checked} onChange={() => toggleExamTerm(value)} />
                                  <span style={{ fontSize: 13 }}>{item.title}</span>
                                </label>
                              );
                            })}
                            {filteredExamTypes.length === 0 && (
                              <p style={{ margin: 0, fontSize: 12, color: "#64748b", padding: "4px 2px" }}>No exam term found.</p>
                            )}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                            <button
                              type="button"
                              style={{ ...buttonStyle("#64748b"), height: 30, fontSize: 12, padding: "0 10px" }}
                              onClick={() => onExamTermsChange(examTypes.map((item) => String(item.id)))}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              style={{ ...buttonStyle("#dc2626"), height: 30, fontSize: 12, padding: "0 10px" }}
                              onClick={() => onExamTermsChange([])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {examTermIds.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {examTermIds.slice(0, 4).map((value) => {
                          const item = examTypes.find((row) => String(row.id) === value);
                          const label = item ? item.title : value;
                          return (
                            <span key={value} style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                              {label}
                            </span>
                          );
                        })}
                        {examTermIds.length > 4 && (
                          <span style={{ background: "#e2e8f0", color: "#334155", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                            +{examTermIds.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>Select one or many exam terms to create setup in one save.</p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
                      Selected: {examTermIds.length}
                    </p>
                    {examTermIds.length > 1 && (
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                        Existing setup auto-load works for single exam term mode; multi mode applies this setup to all selected terms.
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Class(es) *</label>
                    <div ref={classMenuRef} style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setClassMenuOpen((prev) => !prev)}
                        style={{
                          ...fieldStyle(),
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          textAlign: "left",
                          borderColor: classIds.length === 0 ? "#ef4444" : "#cbd5e1",
                        }}
                      >
                        <span style={{ color: classIds.length ? "#0f172a" : "#94a3b8", fontWeight: 500 }}>
                          {classIds.length ? `${classIds.length} class(es) selected` : "Select class(es)"}
                        </span>
                        <span style={{ color: "#64748b" }}>{classMenuOpen ? "▲" : "▼"}</span>
                      </button>

                      {classMenuOpen && (
                        <div
                          style={{
                            position: "absolute",
                            zIndex: 30,
                            top: "calc(100% + 6px)",
                            left: 0,
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            background: "#fff",
                            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.14)",
                            padding: 10,
                          }}
                        >
                          <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6 }}>
                            {classes.map((item) => {
                              const value = String(item.id);
                              const checked = classIds.includes(value);
                              const label = item.class_name || item.name || `Class ${item.id}`;
                              return (
                                <label
                                  key={item.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 4px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    background: checked ? "#eff6ff" : "transparent",
                                  }}
                                >
                                  <input type="checkbox" checked={checked} onChange={() => toggleClass(value)} />
                                  <span style={{ fontSize: 13 }}>{label}</span>
                                </label>
                              );
                            })}
                            {classes.length === 0 && (
                              <p style={{ margin: 0, fontSize: 12, color: "#64748b", padding: "4px 2px" }}>No class found.</p>
                            )}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                            <button
                              type="button"
                              style={{ ...buttonStyle("#64748b"), height: 30, fontSize: 12, padding: "0 10px" }}
                              onClick={() => onClassesChange(classes.map((item) => String(item.id)))}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              style={{ ...buttonStyle("#dc2626"), height: 30, fontSize: 12, padding: "0 10px" }}
                              onClick={() => onClassesChange([])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {classIds.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {classIds.slice(0, 4).map((value) => {
                          const item = classes.find((row) => String(row.id) === value);
                          const label = item ? item.class_name || item.name || `Class ${item.id}` : value;
                          return (
                            <span key={value} style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                              {label}
                            </span>
                          );
                        })}
                        {classIds.length > 4 && (
                          <span style={{ background: "#e2e8f0", color: "#334155", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                            +{classIds.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Select one or many classes. Sections are filtered based on selected class(es).
                    </p>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Section(s) *</label>
                    <div ref={sectionMenuRef} style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setSectionMenuOpen((prev) => !prev)}
                        disabled={classIds.length === 0}
                        style={{
                          ...fieldStyle(),
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          textAlign: "left",
                          borderColor: sectionIds.length === 0 ? "#ef4444" : "#cbd5e1",
                          opacity: classIds.length === 0 ? 0.6 : 1,
                          cursor: classIds.length === 0 ? "not-allowed" : "pointer",
                        }}
                      >
                        <span style={{ color: sectionIds.length ? "#0f172a" : "#94a3b8", fontWeight: 500 }}>
                          {sectionIds.length ? `${sectionIds.length} section(s) selected` : "Select section(s)"}
                        </span>
                        <span style={{ color: "#64748b" }}>{sectionMenuOpen ? "▲" : "▼"}</span>
                      </button>

                      {sectionMenuOpen && (
                        <div
                          style={{
                            position: "absolute",
                            zIndex: 30,
                            top: "calc(100% + 6px)",
                            left: 0,
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            background: "#fff",
                            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.14)",
                            padding: 10,
                          }}
                        >
                          <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6 }}>
                            {filteredSections.map((item) => {
                              const value = String(item.id);
                              const checked = sectionIds.includes(value);
                              const label = item.section_name || item.name || `Section ${item.id}`;
                              return (
                                <label
                                  key={item.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 4px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    background: checked ? "#eff6ff" : "transparent",
                                  }}
                                >
                                  <input type="checkbox" checked={checked} onChange={() => toggleSection(value)} />
                                  <span style={{ fontSize: 13 }}>{label}</span>
                                </label>
                              );
                            })}
                            {filteredSections.length === 0 && (
                              <p style={{ margin: 0, fontSize: 12, color: "#64748b", padding: "4px 2px" }}>Select a class first.</p>
                            )}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                            <button
                              type="button"
                              style={{ ...buttonStyle("#64748b"), height: 30, fontSize: 12, padding: "0 10px" }}
                              onClick={() => onSectionsChange(filteredSections.map((item) => String(item.id)))}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              style={{ ...buttonStyle("#dc2626"), height: 30, fontSize: 12, padding: "0 10px" }}
                              onClick={() => onSectionsChange([])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {sectionIds.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {sectionIds.slice(0, 4).map((value) => {
                          const item = filteredSections.find((row) => String(row.id) === value);
                          const label = item ? item.section_name || item.name || `Section ${item.id}` : value;
                          return (
                            <span key={value} style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                              {label}
                            </span>
                          );
                        })}
                        {sectionIds.length > 4 && (
                          <span style={{ background: "#e2e8f0", color: "#334155", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                            +{sectionIds.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Select one or many sections to assign this exam to multiple cohorts at once.
                    </p>
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Subject(s) *</label>
                    <div ref={subjectMenuRef} style={{ position: "relative" }}>
                      <button
                        type="button"
                        onClick={() => setSubjectMenuOpen((prev) => !prev)}
                        style={{
                          ...fieldStyle(),
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          textAlign: "left",
                          borderColor: subjectIds.length === 0 ? "#ef4444" : "#cbd5e1",
                        }}
                      >
                        <span style={{ color: subjectIds.length ? "#0f172a" : "#94a3b8", fontWeight: 500 }}>
                          {subjectIds.length ? `${subjectIds.length} subject(s) selected` : "Select subject(s)"}
                        </span>
                        <span style={{ color: "#64748b" }}>{subjectMenuOpen ? "▲" : "▼"}</span>
                      </button>

                      {subjectMenuOpen && (
                        <div
                          style={{
                            position: "absolute",
                            zIndex: 30,
                            top: "calc(100% + 6px)",
                            left: 0,
                            width: "100%",
                            border: "1px solid #cbd5e1",
                            borderRadius: 12,
                            background: "#fff",
                            boxShadow: "0 10px 28px rgba(15, 23, 42, 0.14)",
                            padding: 10,
                          }}
                        >
                          <input
                            type="text"
                            value={subjectQuery}
                            onChange={(e) => setSubjectQuery(e.target.value)}
                            placeholder="Search subject"
                            style={{ ...fieldStyle(), height: 34, marginBottom: 8 }}
                          />
                          <div style={{ maxHeight: 180, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8, padding: 6 }}>
                            {filteredSubjects.map((item) => {
                              const value = String(item.id);
                              const checked = subjectIds.includes(value);
                              const label = item.subject_name || item.name || `Subject ${item.id}`;
                              return (
                                <label
                                  key={item.id}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 8,
                                    padding: "6px 4px",
                                    borderRadius: 6,
                                    cursor: "pointer",
                                    background: checked ? "#eff6ff" : "transparent",
                                  }}
                                >
                                  <input type="checkbox" checked={checked} onChange={() => toggleSubject(value)} />
                                  <span style={{ fontSize: 13 }}>{label}</span>
                                </label>
                              );
                            })}
                            {filteredSubjects.length === 0 && (
                              <p style={{ margin: 0, fontSize: 12, color: "#64748b", padding: "4px 2px" }}>No subject found.</p>
                            )}
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                            <button
                              type="button"
                              style={{ ...buttonStyle("#64748b"), height: 30, fontSize: 12, padding: "0 10px" }}
                              onClick={() => onSubjectsChange(subjects.map((item) => String(item.id)))}
                            >
                              Select All
                            </button>
                            <button
                              type="button"
                              style={{ ...buttonStyle("#dc2626"), height: 30, fontSize: 12, padding: "0 10px" }}
                              onClick={() => onSubjectsChange([])}
                            >
                              Clear
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {subjectIds.length > 0 && (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                        {subjectIds.slice(0, 4).map((value) => {
                          const item = subjects.find((row) => String(row.id) === value);
                          const label = item ? item.subject_name || item.name || `Subject ${item.id}` : value;
                          return (
                            <span key={value} style={{ background: "#dbeafe", color: "#1d4ed8", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                              {label}
                            </span>
                          );
                        })}
                        {subjectIds.length > 4 && (
                          <span style={{ background: "#e2e8f0", color: "#334155", borderRadius: 999, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                            +{subjectIds.length - 4} more
                          </span>
                        )}
                      </div>
                    )}

                    <p style={{ margin: "6px 0 0", fontSize: 12, color: "#64748b" }}>
                      Select one or many subjects and save setup for all selected subjects in one go.
                    </p>
                    <p style={{ margin: "4px 0 0", fontSize: 12, color: "#1d4ed8", fontWeight: 600 }}>
                      Selected: {subjectIds.length}
                    </p>
                    {subjectIds.length > 1 && (
                      <p style={{ margin: "4px 0 0", fontSize: 12, color: "#64748b" }}>
                        Existing setup auto-load works for single subject mode; multi mode applies this setup to all selected subjects.
                      </p>
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontWeight: 600 }}>Total Exam Mark *</label>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={totalExamMark}
                      onChange={(e) => {
                        if (!isDigitsOnly(e.target.value)) return;
                        setTotalExamMark(e.target.value);
                      }}
                      style={{ ...fieldStyle(), width: 130, borderColor: totalExamMarkError ? "#ef4444" : "#cbd5e1" }}
                    />
                    <p style={{ margin: "6px 0 0", fontSize: 12, color: totalExamMarkError ? "#dc2626" : "#64748b" }}>
                      {totalExamMarkError || "Digits only. Example: 100"}
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <div className="white-box" style={{ ...boxStyle(), marginBottom: 12 }}>
                  <div style={{ marginBottom: 10 }}>
                    <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: criteriaReady ? "#dbeafe" : "#e2e8f0", color: criteriaReady ? "#1d4ed8" : "#475569", fontSize: 12, fontWeight: 700 }}>STEP 2</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                    <div>
                      <h3 style={{ margin: 0, color: "#0f172a" }}>Mark Distributions</h3>
                      <p style={{ margin: "4px 0 0", color: "#64748b", fontSize: 13 }}>Add distribution components after setting criteria.</p>
                    </div>
                    <button type="button" onClick={addRow} style={buttonStyle()} disabled={!criteriaReady}>Add Row</button>
                  </div>

                  {!criteriaReady && (
                    <div style={{ marginBottom: 10, padding: "8px 10px", borderRadius: 10, background: "#eff6ff", color: "#1d4ed8", fontSize: 12, fontWeight: 600 }}>
                      Complete Step 1 to enable distribution editing.
                    </div>
                  )}

                  <div style={{ width: "100%", overflowX: "auto" }}>
                  <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                        <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Exam Title</th>
                        <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Exam Mark</th>
                        <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((row, index) => (
                        <tr key={`row-${index}`}>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", minWidth: 260 }}>
                            <input
                              value={row.exam_title}
                              onChange={(e) => updateRow(index, "exam_title", e.target.value)}
                              placeholder="e.g. Written, Oral"
                              disabled={!criteriaReady}
                              style={{ ...fieldStyle(), borderColor: rowErrors[index]?.titleError ? "#ef4444" : "#cbd5e1" }}
                            />
                            <p style={{ margin: "6px 0 0", fontSize: 12, color: rowErrors[index]?.titleError ? "#dc2626" : "#64748b" }}>
                              {rowErrors[index]?.titleError || "Meaningful title only."}
                            </p>
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 130 }}>
                            <input
                              type="text"
                              inputMode="numeric"
                              value={row.exam_mark}
                              onChange={(e) => updateRow(index, "exam_mark", e.target.value)}
                              disabled={!criteriaReady}
                              style={{ ...fieldStyle(), width: 110, borderColor: rowErrors[index]?.markError ? "#ef4444" : "#cbd5e1" }}
                            />
                            <p style={{ margin: "6px 0 0", fontSize: 12, color: rowErrors[index]?.markError ? "#dc2626" : "#64748b" }}>
                              {rowErrors[index]?.markError || "Digits only."}
                            </p>
                          </td>
                          <td style={{ padding: 8, borderBottom: "1px solid var(--line)", width: 110, whiteSpace: "nowrap" }}>
                            <button type="button" onClick={() => removeRow(index)} style={buttonStyle("#dc2626")} disabled={!criteriaReady}>Delete</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <th style={{ padding: 8, borderTop: "1px solid var(--line)", textAlign: "left" }}>Total Sum</th>
                        <th style={{ padding: 8, borderTop: "1px solid var(--line)", textAlign: "left", color: isSumMatched ? "#0f766e" : "#b45309" }}>{totalMark}</th>
                        <th style={{ padding: 8, borderTop: "1px solid var(--line)" }} />
                      </tr>
                    </tfoot>
                  </table>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <div style={{ fontSize: 13, color: isSumMatched ? "#0f766e" : "#b45309" }}>
                      Target: {Number(totalExamMark || 0).toFixed(2)} | Current: {totalMark} {isSumMatched ? "(Matched)" : "(Not Matched)"}
                    </div>
                    <button
                      type="submit"
                      style={{ ...buttonStyle(), opacity: canSave ? 1 : 0.55, cursor: canSave ? "pointer" : "not-allowed" }}
                      disabled={!canSave}
                    >
                      {loading ? "Saving..." : "Save Exam Setup"}
                    </button>
                  </div>
                  {error && <p style={{ color: "var(--warning)", marginTop: 10 }}>{error}</p>}
                  {success && <p style={{ color: "#059669", marginTop: 10 }}>{success}</p>}
                </div>
              </div>
            </div>
          </form>

          <div className="white-box" style={{ ...boxStyle(), marginTop: 16 }}>
            <h3 style={{ marginTop: 0, marginBottom: 12, color: "#0f172a" }}>Configured Exams</h3>
            <div style={{ width: "100%", overflowX: "auto" }}>
              <table style={{ width: "100%", minWidth: 680, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Exam Name</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Classes</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Status</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {MOCK_CONFIGURED_EXAMS.map((row) => (
                    <tr key={row.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.exam_name}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.classes}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                        <span
                          style={{
                            display: "inline-block",
                            padding: "2px 10px",
                            borderRadius: 999,
                            fontSize: 12,
                            fontWeight: 600,
                            background: row.status === "Active" ? "#dcfce7" : "#e2e8f0",
                            color: row.status === "Active" ? "#166534" : "#475569",
                          }}
                        >
                          {row.status}
                        </span>
                      </td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          <button type="button" onClick={() => console.log("Edit exam setup", row)} style={buttonStyle("#2563eb")}>Edit</button>
                          <button type="button" onClick={() => console.log("Delete exam setup", row)} style={buttonStyle("#dc2626")}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {MOCK_CONFIGURED_EXAMS.length === 0 && (
                    <tr>
                      <td colSpan={4} style={{ padding: 8, color: "var(--text-muted)" }}>No exams configured yet.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
