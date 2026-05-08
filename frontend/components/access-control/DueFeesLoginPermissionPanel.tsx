"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { PaginationControls } from "@/components/common/PaginationControls";
import { usePersistentPagination } from "@/hooks/usePersistentPagination";

type Option = { id: number; name: string };
type SectionOption = { id: number; name: string; class_id: number };

type CriteriaResponse = {
  classes: Option[];
  sections: SectionOption[];
};

type DueUserRow = {
  admission_no: string;
  roll_no: string;
  student_name: string;
  class_name: string;
  section_name: string;
  due_amount: string;
  student_user_id?: number | null;
  student_access_status?: boolean;
  parent_name?: string;
  parent_user_id?: number | null;
  parent_access_status?: boolean;
};

type UserResponse = {
  users: DueUserRow[];
};

const thCell: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 14px",
  borderBottom: "1px solid var(--bd)",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--ink-2)",
  whiteSpace: "nowrap",
  background: "var(--bg-2)",
};

const tdCell: React.CSSProperties = {
  padding: "10px 14px",
  borderBottom: "1px solid var(--bd)",
  fontSize: 13,
  color: "var(--ink-1)",
  verticalAlign: "middle",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  height: 36,
  boxSizing: "border-box",
  border: "1px solid var(--bd)",
  borderRadius: 8,
  padding: "0 10px",
  fontSize: 13,
  background: "var(--bg-1)",
  color: "var(--ink-1)",
};

export function DueFeesLoginPermissionPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination(
    "roles.due-fees-login-permission",
    1,
    10,
  );

  const [classes, setClasses] = useState<Option[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);

  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [name, setName] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");

  const [rows, setRows] = useState<DueUserRow[]>([]);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((s) => String(s.class_id) === classId);
  }, [sections, classId]);

  const totalCount = rows.length;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
  const pagedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages, setPage]);

  const loadCriteria = async () => {
    setLoadingCriteria(true);
    setError("");
    try {
      const payload = await apiRequestWithRefresh<CriteriaResponse>(
        "/api/v1/access-control/due-fees-login-permission/",
      );
      setClasses(payload.classes || []);
      setSections(payload.sections || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load criteria.");
    } finally {
      setLoadingCriteria(false);
    }
  };

  useEffect(() => {
    void loadCriteria();
  }, []);

  useEffect(() => {
    setSectionId("");
  }, [classId]);

  const searchUsers = async () => {
    if (!classId && !sectionId && !name.trim() && !admissionNo.trim()) {
      setError("Select class/section or enter name/admission no before searching.");
      setMessage("");
      setRows([]);
      return;
    }

    setLoading(true);
    setPage(1);
    setError("");
    setMessage("");
    try {
      const query = new URLSearchParams();
      if (classId) query.set("class", classId);
      if (sectionId) query.set("section", sectionId);
      if (name.trim()) query.set("name", name.trim());
      if (admissionNo.trim()) query.set("admission_no", admissionNo.trim());

      const payload = await apiRequestWithRefresh<UserResponse>(
        `/api/v1/access-control/due-fees-login-permission/users/?${query.toString()}`,
      );
      setRows(payload.users || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleBlocked = async (userId: number, blocked: boolean) => {
    setError("");
    setMessage("");
    setActionUserId(userId);
    try {
      await apiRequestWithRefresh("/api/v1/access-control/due-fees-login-permission/toggle/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, status: blocked }),
      });
      setRows((prev) =>
        prev.map((row) => {
          if (row.student_user_id === userId) {
            return { ...row, student_access_status: blocked };
          }
          if (row.parent_user_id === userId) {
            return { ...row, parent_access_status: blocked };
          }
          return row;
        }),
      );
      setMessage("Due fees login permission updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update due fees permission.");
    } finally {
      setActionUserId(null);
    }
  };

  return (
    <section style={{ padding: "24px 28px", background: "var(--bg-0)", minHeight: "100vh" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "var(--ink-1)", lineHeight: 1.2 }}>
          Due Fees Login{" "}
          <em style={{ fontStyle: "italic", fontWeight: 300, color: "var(--pu)" }}>Permission</em>
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
          Block or allow login access for students and parents with outstanding fee dues
        </p>
      </div>

      {/* Feedback */}
      {error && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            borderRadius: 8,
            color: "var(--err)",
            fontSize: 13,
          }}
          role="alert"
        >
          {error}
        </div>
      )}
      {message && (
        <div
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            borderRadius: 8,
            color: "var(--ok)",
            fontSize: 13,
          }}
          role="status"
        >
          {message}
        </div>
      )}

      {/* Filter card */}
      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--bd)",
          borderRadius: 14,
          boxShadow: "var(--sh-2)",
          padding: "18px 20px",
          marginBottom: 20,
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 14,
            marginBottom: 14,
          }}
        >
          <div>
            <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
              Class
            </label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={loading || loadingCriteria}
              style={inputStyle}
            >
              <option value="">Select class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
              Section
            </label>
            <select
              value={sectionId}
              onChange={(e) => setSectionId(e.target.value)}
              disabled={loading || loadingCriteria}
              style={inputStyle}
            >
              <option value="">Select section</option>
              {filteredSections.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
              Name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Student / Parent name"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
              Admission No
            </label>
            <input
              value={admissionNo}
              onChange={(e) => setAdmissionNo(e.target.value)}
              placeholder="Admission no"
              style={inputStyle}
            />
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={searchUsers}
            disabled={loading || loadingCriteria}
            style={{
              height: 36,
              border: "none",
              background: loading || loadingCriteria ? "var(--ink-3)" : "var(--pu)",
              color: "#fff",
              borderRadius: 8,
              padding: "0 20px",
              cursor: loading || loadingCriteria ? "not-allowed" : "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </div>

      {/* Table */}
      <div
        style={{
          background: "var(--bg-1)",
          border: "1px solid var(--bd)",
          borderRadius: 14,
          boxShadow: "var(--sh-2)",
          overflow: "auto",
        }}
      >
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
          <thead>
            <tr>
              <th style={thCell}>Admission</th>
              <th style={thCell}>Roll</th>
              <th style={thCell}>Student Name</th>
              <th style={thCell}>Class</th>
              <th style={thCell}>Student Access</th>
              <th style={thCell}>Parent</th>
              <th style={thCell}>Parent Access</th>
              <th style={thCell}>Due Amount</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={8} style={{ ...tdCell, color: "var(--ink-3)", textAlign: "center", padding: 32 }}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ ...tdCell, color: "var(--ink-3)", textAlign: "center", padding: 32 }}>
                  No records found. Use the filters above and click Search.
                </td>
              </tr>
            )}
            {!loading &&
              pagedRows.map((row) => (
                <tr
                  key={`${row.admission_no}-${row.roll_no || ""}`}
                  style={{ transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  <td style={tdCell}>{row.admission_no || "—"}</td>
                  <td style={tdCell}>{row.roll_no || "—"}</td>
                  <td style={{ ...tdCell, fontWeight: 500 }}>{row.student_name || "—"}</td>
                  <td style={tdCell}>
                    {row.class_name
                      ? `${row.class_name}${row.section_name ? ` (${row.section_name})` : ""}`
                      : "—"}
                  </td>
                  <td style={tdCell}>
                    {row.student_user_id ? (
                      <AccessToggle
                        checked={Boolean(row.student_access_status)}
                        disabled={actionUserId === row.student_user_id}
                        onChange={(v) => void toggleBlocked(row.student_user_id!, v)}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Not linked</span>
                    )}
                  </td>
                  <td style={tdCell}>{row.parent_name || "—"}</td>
                  <td style={tdCell}>
                    {row.parent_user_id ? (
                      <AccessToggle
                        checked={Boolean(row.parent_access_status)}
                        disabled={actionUserId === row.parent_user_id}
                        onChange={(v) => void toggleBlocked(row.parent_user_id!, v)}
                      />
                    ) : (
                      <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Not linked</span>
                    )}
                  </td>
                  <td style={tdCell}>
                    {row.due_amount ? (
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: "var(--err)",
                          background: "#FEF2F2",
                          border: "1px solid #FECACA",
                          borderRadius: 6,
                          padding: "2px 8px",
                        }}
                      >
                        {row.due_amount}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        currentPage={page}
        totalPages={totalPages}
        pageSize={pageSize}
        totalItems={totalCount}
        loading={loading}
        onPageChange={(nextPage) => setPage(nextPage)}
        onPageSizeChange={(nextSize) => {
          setPageSize(nextSize);
          setPage(1);
        }}
      />
    </section>
  );
}

/* ── Access toggle chip ──────────────────────────────────────── */

function AccessToggle({
  checked,
  disabled,
  onChange,
}: {
  checked: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        style={{
          width: 15,
          height: 15,
          accentColor: "var(--pu)",
          cursor: disabled ? "not-allowed" : "pointer",
        }}
      />
      <span
        style={{
          fontSize: 11,
          fontWeight: 600,
          borderRadius: 20,
          padding: "2px 8px",
          background: checked ? "#F0FDF4" : "#FEF2F2",
          color: checked ? "var(--ok)" : "var(--err)",
          border: `1px solid ${checked ? "#BBF7D0" : "#FECACA"}`,
        }}
      >
        {checked ? "Active" : "Blocked"}
      </span>
    </label>
  );
}
