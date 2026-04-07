"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";
import { getAccessToken } from "@/lib/auth";
import { ActionButton } from "@/components/common/ActionButton";
import { useFormLoader } from "@/hooks/useFormLoader";

type ExamTypeRow = {
  id: number;
  title: string;
  is_average: boolean;
  average_mark: string;
  active_status: boolean;
};

type FormState = {
  id: number | null;
  exam_type_title: string;
  is_average: boolean;
  average_mark: string;
};

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
    const msg = body?.message || body?.detail || "Operation failed";
    throw new Error(msg);
  }
  return (await response.json()) as T;
}

async function apiDelete(path: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { headers: authHeaders(), cache: "no-store" });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const msg = body?.message || body?.detail || "Delete failed";
    throw new Error(msg);
  }
}

function fieldStyle() {
  return { width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 8, padding: "0 10px" } as const;
}

function boxStyle() {
  return { background: "var(--surface)", border: "1px solid var(--line)", borderRadius: "var(--radius)", padding: 16 } as const;
}

function buttonStyle(color = "var(--primary)") {
  return { height: 36, border: `1px solid ${color}`, background: color, color: "#fff", borderRadius: 8, padding: "0 12px", cursor: "pointer" } as const;
}

const defaultForm: FormState = {
  id: null,
  exam_type_title: "",
  is_average: false,
  average_mark: "0.00",
};

export default function ExamTypePanel() {
  const [rows, setRows] = useState<ExamTypeRow[]>([]);
  const [form, setForm] = useState<FormState>(defaultForm);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Use the new form loader hook
  const form_loader = useFormLoader();

  const totalPages = Math.ceil(rows.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedRows = rows.slice(startIndex, endIndex);

  const load = async () => {
    try {
      form_loader.clearMessages();
      const data = await apiGet<{ exams_types: ExamTypeRow[] }>("/api/v1/exams/exam-type/");
      setRows(data.exams_types || []);
      setCurrentPage(1);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load exam types.";
      form_loader.setError(message);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.exam_type_title.trim()) {
      form_loader.setError("Exam name is required.");
      return;
    }
    if (form.is_average && !form.average_mark.trim()) {
      form_loader.setError("Average mark is required when average passing examination is enabled.");
      return;
    }

    await form_loader.execute("save", async () => {
      const payload = {
        id: form.id || undefined,
        exam_type_title: form.exam_type_title.trim(),
        is_average: form.is_average ? "yes" : "",
        average_mark: Number(form.average_mark || "0"),
      };
      if (form.id) {
        await apiPost("/api/v1/exams/exam-type/update/", payload);
      } else {
        await apiPost("/api/v1/exams/exam-type/store/", payload);
      }
      setForm(defaultForm);
      await load();
      form_loader.setSuccessMessage(form.id ? "Exam type updated successfully" : "Exam type saved successfully");
    });
  };

  const startEdit = async (id: number) => {
    try {
      form_loader.clearMessages();
      const data = await apiGet<ExamTypeRow>(`/api/v1/exams/exam-type/edit/${id}/`);
      setForm({
        id: data.id,
        exam_type_title: data.title,
        is_average: data.is_average,
        average_mark: data.average_mark || "0.00",
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load selected exam type.";
      form_loader.setError(message);
    }
  };

  const remove = async (id: number) => {
    await form_loader.execute("delete", async () => {
      await apiDelete(`/api/v1/exams/exam-type/delete/${id}/`);
      if (form.id === id) setForm(defaultForm);
      await load();
      form_loader.setSuccessMessage("Exam type deleted successfully");
    });
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Exam Type</h1>
            <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
              <span>Dashboard</span><span>/</span><span>Examination</span><span>/</span><span>Exam Type</span>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0">
          <div style={{ display: "grid", gridTemplateColumns: "320px minmax(0, 1fr)", gap: 12 }}>
            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{form.id ? "Edit Exam Type" : "Add Exam Type"}</h3>
              <form onSubmit={(e) => void submit(e)}>
                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "block", marginBottom: 6 }}>Exam Name *</label>
                  <input
                    value={form.exam_type_title}
                    onChange={(e) => setForm((prev) => ({ ...prev, exam_type_title: e.target.value }))}
                    style={fieldStyle()}
                  />
                </div>

                <div style={{ marginBottom: 10 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="checkbox"
                      checked={form.is_average}
                      onChange={(e) => setForm((prev) => ({ ...prev, is_average: e.target.checked }))}
                    />
                    <span>Average Passing Examination</span>
                  </label>
                </div>

                {form.is_average && (
                  <div style={{ marginBottom: 10 }}>
                    <label style={{ display: "block", marginBottom: 6 }}>Average Mark *</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.average_mark}
                      onChange={(e) => setForm((prev) => ({ ...prev, average_mark: e.target.value }))}
                      style={fieldStyle()}
                    />
                  </div>
                )}

                <div style={{ display: "flex", gap: 8 }}>
                  <ActionButton
                    type="submit"
                    label={form.id ? "Update Exam Type" : "Save Exam Type"}
                    loadingLabel={form.id ? "Updating..." : "Saving..."}
                    isLoading={form_loader.isSaving}
                    onClick={() => {}}
                    variant="primary"
                  />
                  {form.id && (
                    <button type="button" onClick={() => setForm(defaultForm)} style={buttonStyle("#6b7280")}>Cancel</button>
                  )}
                </div>
              </form>
              {form_loader.error && <p style={{ color: "#dc2626", marginTop: 10, fontSize: 13 }}>{form_loader.error}</p>}
              {form_loader.success && <p style={{ color: "#059669", marginTop: 10, fontSize: 13 }}>{form_loader.success}</p>}
            </div>

            <div className="white-box" style={boxStyle()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <h3 style={{ margin: 0 }}>Exam Type List</h3>
                <Link href="/exams/setup" style={{ textDecoration: "none" }}>
                  <button type="button" style={buttonStyle()}>Exam Setup</button>
                </Link>
              </div>

              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "var(--surface-muted)", textAlign: "left" }}>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>SL</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Exam Name</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Is Average Passing Exam</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Average Mark</th>
                    <th style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.map((row, index) => (
                    <tr key={row.id}>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{startIndex + index + 1}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.title}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.is_average ? "Yes" : "No"}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{Number(row.average_mark || 0).toFixed(2)}</td>
                      <td style={{ padding: 8, borderBottom: "1px solid var(--line)", display: "flex", gap: 8 }}>
                        <ActionButton
                          label="Edit"
                          isLoading={false}
                          onClick={() => void startEdit(row.id)}
                          variant="primary"
                        />
                        <ActionButton
                          label="Delete"
                          loadingLabel="Deleting"
                          isLoading={form_loader.isDeleting}
                          onClick={() => void remove(row.id)}
                          variant="danger"
                        />
                        <Link href={`/exams/setup?exam_type_id=${row.id}`} style={{ textDecoration: "none" }}>
                          <button type="button" style={buttonStyle("#059669")}>Exam Setup</button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: 8, color: "var(--text-muted)" }}>No exam type found.</td>
                    </tr>
                  )}
                </tbody>
              </table>

              {rows.length > 0 && (
                <div style={{ marginTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Show:</span>
                    <select
                      value={itemsPerPage}
                      onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      style={{
                        height: 32,
                        border: "1px solid var(--line)",
                        borderRadius: 6,
                        padding: "0 8px",
                        fontSize: 13,
                        background: "var(--surface)",
                        color: "var(--text)",
                        cursor: "pointer",
                      }}
                    >
                      <option value={10}>10</option>
                      <option value={25}>25</option>
                      <option value={50}>50</option>
                      <option value={100}>100</option>
                    </select>
                    <span style={{ fontSize: 13, color: "var(--text-muted)" }}>entries</span>
                    <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 8 }}>
                      Showing {startIndex + 1}-{Math.min(endIndex, rows.length)} of {rows.length} exam types
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <button
                      type="button"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                      style={{
                        ...buttonStyle(),
                        opacity: currentPage === 1 ? 0.5 : 1,
                        cursor: currentPage === 1 ? "not-allowed" : "pointer",
                      }}
                    >
                      ← Previous
                    </button>
                    <span style={{ padding: "0 12px", fontSize: 13, fontWeight: 500 }}>
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                      style={{
                        ...buttonStyle(),
                        opacity: currentPage === totalPages ? 0.5 : 1,
                        cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                      }}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
