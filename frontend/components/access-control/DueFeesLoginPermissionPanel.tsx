"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

export function DueFeesLoginPermissionPanel() {
  const { page, pageSize, setPage, setPageSize } = usePersistentPagination("roles.due-fees-login-permission", 1, 10);

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
      const payload = await apiRequestWithRefresh<CriteriaResponse>("/api/v1/access-control/due-fees-login-permission/");
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
    <section>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 14 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24 }}>Due Fees Login Permission</h1>
          <p style={{ marginTop: 8, color: "var(--text-muted)" }}>
            Manage login blocking for users with fee dues.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Link href="/roles" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", textDecoration: "none", color: "var(--text)" }}>Role</Link>
          <Link href="/roles/assign-permission" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", textDecoration: "none", color: "var(--text)" }}>Assign Permission</Link>
          <Link href="/roles/login-permission" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", textDecoration: "none", color: "var(--text)" }}>Login Permission</Link>
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: 10 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>Class</label>
            <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }} disabled={loading || loadingCriteria}>
              <option value="">Select class</option>
              {classes.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>Section</label>
            <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }} disabled={loading || loadingCriteria}>
              <option value="">Select section</option>
              {filteredSections.map((item) => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Student/Parent name" style={{ width: "100%", height: 36, boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>Admission No</label>
            <input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} placeholder="Admission no" style={{ width: "100%", height: 36, boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }} />
          </div>
        </div>

        <div style={{ marginTop: 10, textAlign: "right" }}>
          <button type="button" onClick={searchUsers} disabled={loading || loadingCriteria} style={{ border: "1px solid var(--primary)", background: "var(--primary)", color: "#fff", borderRadius: 8, padding: "8px 14px", opacity: loading || loadingCriteria ? 0.7 : 1 }}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {error && <div style={{ marginBottom: 8, color: "var(--danger)" }}>{error}</div>}
      {message && <div style={{ marginBottom: 8, color: "var(--primary)" }}>{message}</div>}

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 1100 }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)" }}>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Admission</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Roll</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Class</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Student Permission</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Parent</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Parent Permission</th>
              <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Due Amount</th>
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={8} style={{ padding: 10, color: "var(--text-muted)" }}>
                  No users found. Use criteria and click search.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={8} style={{ padding: 10, color: "var(--text-muted)" }}>Loading...</td>
              </tr>
            )}
            {!loading && pagedRows.map((row) => (
              <tr key={`${row.admission_no}-${row.roll_no || ""}`}>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.admission_no || "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.roll_no || "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.student_name || "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                  {row.class_name ? `${row.class_name}${row.section_name ? ` (${row.section_name})` : ""}` : "-"}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                  {row.student_user_id ? (
                    <input
                      type="checkbox"
                      checked={Boolean(row.student_access_status)}
                      disabled={actionUserId === row.student_user_id}
                      onChange={(event) => void toggleBlocked(row.student_user_id!, event.target.checked)}
                    />
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not linked</span>
                  )}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.parent_name || "-"}</td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                  {row.parent_user_id ? (
                    <input
                      type="checkbox"
                      checked={Boolean(row.parent_access_status)}
                      disabled={actionUserId === row.parent_user_id}
                      onChange={(event) => void toggleBlocked(row.parent_user_id!, event.target.checked)}
                    />
                  ) : (
                    <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not linked</span>
                  )}
                </td>
                <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.due_amount || "-"}</td>
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
