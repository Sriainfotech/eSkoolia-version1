"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type Option = { id: number; name: string };
type SectionOption = { id: number; name: string; class_id: number };

type CriteriaResponse = {
  roles: Option[];
  classes: Option[];
  sections: SectionOption[];
};

type StudentOption = {
  id: number;
  first_name?: string;
  last_name?: string;
  admission_no?: string;
  roll_no?: string;
  current_class?: number | null;
  current_section?: number | null;
};

type LoginUserRow = {
  user_id: number;
  username: string;
  name: string;
  email: string;
  role_id: number;
  role_name: string;
  access_status: boolean;
  staff_no: string;
  admission_no: string;
  roll_no: string;
  class_name: string;
  section_name: string;
  parent_user_id?: number | null;
  parent_username?: string;
  parent_name?: string;
  parent_email?: string;
  parent_access_status?: boolean;
};

type UserResponse = {
  role: { id: number; name: string };
  users: LoginUserRow[];
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

export function LoginPermissionPanel() {
  const [roles, setRoles] = useState<Option[]>([]);
  const [classes, setClasses] = useState<Option[]>([]);
  const [sections, setSections] = useState<SectionOption[]>([]);
  const [studentRows, setStudentRows] = useState<StudentOption[]>([]);

  const [roleId, setRoleId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [name, setName] = useState("");
  const [admissionNo, setAdmissionNo] = useState("");
  const [rollNo, setRollNo] = useState("");

  const [rows, setRows] = useState<LoginUserRow[]>([]);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [loadingCriteria, setLoadingCriteria] = useState(false);
  const [loading, setLoading] = useState(false);
  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [actionType, setActionType] = useState<"toggle" | "password" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [passwordMap, setPasswordMap] = useState<Record<number, string>>({});

  const selectedRole = useMemo(() => roles.find((r) => String(r.id) === roleId) || null, [roles, roleId]);
  const isStudentRole = useMemo(() => {
    if (!selectedRole) return false;
    return selectedRole.name.toLowerCase().includes("student");
  }, [selectedRole]);

  const filteredSections = useMemo(() => {
    if (!classId) return sections;
    return sections.filter((s) => String(s.class_id) === classId);
  }, [sections, classId]);

  const studentClassIds = useMemo(() => {
    return new Set(
      studentRows
        .map((row) => row.current_class)
        .filter((value): value is number => typeof value === "number" && value > 0),
    );
  }, [studentRows]);

  const studentSectionIds = useMemo(() => {
    if (!classId) {
      return new Set(
        studentRows
          .map((row) => row.current_section)
          .filter((value): value is number => typeof value === "number" && value > 0),
      );
    }
    const selectedClassId = Number(classId);
    return new Set(
      studentRows
        .filter((row) => row.current_class === selectedClassId)
        .map((row) => row.current_section)
        .filter((value): value is number => typeof value === "number" && value > 0),
    );
  }, [studentRows, classId]);

  const studentClasses = useMemo(() => {
    return classes.filter((item) => studentClassIds.has(item.id));
  }, [classes, studentClassIds]);

  const studentFilteredSections = useMemo(() => {
    return filteredSections.filter((item) => studentSectionIds.has(item.id));
  }, [filteredSections, studentSectionIds]);

  const studentOptions = useMemo(() => {
    return studentRows.filter((row) => {
      if (!classId || !sectionId) return false;
      if (row.current_class !== Number(classId)) return false;
      if (row.current_section !== Number(sectionId)) return false;
      return true;
    });
  }, [studentRows, classId, sectionId]);

  const loadCriteria = async () => {
    setLoadingCriteria(true);
    setError("");
    try {
      const [payload, studentPayload] = await Promise.all([
        apiRequestWithRefresh<CriteriaResponse>("/api/v1/access-control/login-access-control/"),
        apiRequestWithRefresh<{ results?: StudentOption[] }>("/api/v1/students/students/?is_active=true&page_size=1000"),
      ]);
      setRoles(payload.roles || []);
      setClasses(payload.classes || []);
      setSections(payload.sections || []);
      setStudentRows(studentPayload.results || []);
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
    setName("");
  }, [classId]);

  useEffect(() => {
    setName("");
  }, [sectionId]);

  const searchUsers = async () => {
    if (!roleId) {
      setError("Select role first.");
      return;
    }
    if (isStudentRole && !classId) {
      setError("Select class for student role.");
      return;
    }

    setLoading(true);
    setError("");
    setMessage("");
    try {
      const query = new URLSearchParams();
      query.set("role", roleId);
      if (classId) query.set("class", classId);
      if (sectionId) query.set("section", sectionId);
      if (isStudentRole && name.trim()) {
        query.set("admission_no", name.trim());
      } else if (name.trim()) {
        query.set("name", name.trim());
      }
      if (admissionNo.trim()) query.set("admission_no", admissionNo.trim());
      if (rollNo.trim()) query.set("roll_no", rollNo.trim());

      const payload = await apiRequestWithRefresh<UserResponse>(
        `/api/v1/access-control/login-access-control/users/?${query.toString()}`,
      );
      setRows(payload.users || []);
      setCurrentPage(1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
      setRows([]);
      setCurrentPage(1);
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (userId: number, checked: boolean) => {
    setError("");
    setMessage("");
    setActionUserId(userId);
    setActionType("toggle");
    try {
      await apiRequestWithRefresh("/api/v1/access-control/login-access-control/toggle/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, status: checked }),
      });
      setRows((prev) => prev.map((row) => (row.user_id === userId ? { ...row, access_status: checked } : row)));
      setMessage("Login permission updated.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update permission.");
    } finally {
      setActionUserId(null);
      setActionType(null);
    }
  };

  const resetPassword = async (userId: number, defaultPassword = false) => {
    setError("");
    setMessage("");
    setActionUserId(userId);
    setActionType("password");
    try {
      const entered = (passwordMap[userId] || "").trim();
      const password = defaultPassword ? "123456" : entered;
      if (!password) {
        setError("Enter password before update.");
        setActionUserId(null);
        setActionType(null);
        return;
      }
      await apiRequestWithRefresh("/api/v1/access-control/login-access-control/reset-password/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, password, default_password: defaultPassword }),
      });
      setMessage(defaultPassword ? "Password reset to 123456." : "Password updated.");
      if (!defaultPassword) {
        setPasswordMap((prev) => ({ ...prev, [userId]: "" }));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to reset password.");
    } finally {
      setActionUserId(null);
      setActionType(null);
    }
  };

  const tableColSpan = isStudentRole ? 8 : 6;

  return (
    <section style={{ padding: "24px 28px", background: "var(--bg-0)", minHeight: "100vh" }}>
      {/* Page Header */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "var(--ink-1)", lineHeight: 1.2 }}>
          Login{" "}
          <em style={{ fontStyle: "italic", fontWeight: 300, color: "var(--pu)" }}>Permission</em>
        </h1>
        <p style={{ margin: "4px 0 0", fontSize: 13, color: "var(--ink-3)" }}>
          Control who can log into the system and manage passwords
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
            gridTemplateColumns: isStudentRole
              ? "repeat(auto-fill, minmax(170px, 1fr))"
              : "repeat(auto-fill, minmax(220px, 1fr))",
            gap: 14,
            marginBottom: 14,
          }}
        >
          {/* Role */}
          <div>
            <label
              style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}
            >
              Role <span style={{ color: "var(--err)" }}>*</span>
            </label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              disabled={loadingCriteria || loading}
              style={inputStyle}
            >
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          {isStudentRole && (
            <>
              {/* Class */}
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
                  Class <span style={{ color: "var(--err)" }}>*</span>
                </label>
                <select
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                  disabled={loading}
                  style={inputStyle}
                >
                  <option value="">Select class</option>
                  {studentClasses.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              {/* Section */}
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
                  Section
                </label>
                <select
                  value={sectionId}
                  onChange={(e) => setSectionId(e.target.value)}
                  disabled={loading}
                  style={inputStyle}
                >
                  <option value="">Select section</option>
                  {studentFilteredSections.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              {/* Student name */}
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
                  Student
                </label>
                <select
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={inputStyle}
                >
                  <option value="">Select student</option>
                  {studentOptions.map((student) => {
                    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || `Student ${student.id}`;
                    const admNo = student.admission_no ? ` (${student.admission_no})` : "";
                    const rlNo = student.roll_no ? ` [Roll: ${student.roll_no}]` : "";
                    return (
                      <option key={student.id} value={student.admission_no || String(student.id)}>
                        {studentName}{admNo}{rlNo}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Roll No */}
              <div>
                <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "var(--ink-2)" }}>
                  Roll No
                </label>
                <input
                  value={rollNo}
                  onChange={(e) => setRollNo(e.target.value)}
                  placeholder="Roll no"
                  style={inputStyle}
                />
              </div>
            </>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={searchUsers}
            disabled={loadingCriteria || loading}
            style={{
              height: 36,
              border: "none",
              background: loadingCriteria || loading ? "var(--ink-3)" : "var(--pu)",
              color: "#fff",
              borderRadius: 8,
              padding: "0 20px",
              cursor: loadingCriteria || loading ? "not-allowed" : "pointer",
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
        {/* Page-size toggle */}
        {rows.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "10px 14px", borderBottom: "1px solid var(--bd)" }}>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Rows per page:</span>
            {[10, 25, 50, 100].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => { setPageSize(n); setCurrentPage(1); }}
                style={{
                  height: 24,
                  minWidth: 32,
                  border: `1px solid ${pageSize === n ? "var(--pu)" : "var(--bd)"}`,
                  borderRadius: 6,
                  background: pageSize === n ? "var(--pu)" : "var(--bg-0)",
                  color: pageSize === n ? "#fff" : "var(--ink-2)",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                  padding: "0 6px",
                }}
              >
                {n}
              </button>
            ))}
            <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)" }}>
              {rows.length} total
            </span>
          </div>
        )}
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isStudentRole ? 1250 : 980 }}>
          <thead>
            <tr>
              {isStudentRole ? (
                <>
                  <th style={thCell}>Admission</th>
                  <th style={thCell}>Roll</th>
                  <th style={thCell}>Name</th>
                  <th style={thCell}>Class</th>
                  <th style={thCell}>Student Login</th>
                  <th style={thCell}>Student Password</th>
                  <th style={thCell}>Parent Login</th>
                  <th style={thCell}>Parent Password</th>
                </>
              ) : (
                <>
                  <th style={thCell}>Staff No</th>
                  <th style={thCell}>Name</th>
                  <th style={thCell}>Role</th>
                  <th style={thCell}>Email</th>
                  <th style={thCell}>Login Access</th>
                  <th style={thCell}>Password</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={tableColSpan} style={{ ...tdCell, color: "var(--ink-3)", textAlign: "center", padding: 32 }}>
                  Loading…
                </td>
              </tr>
            )}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={tableColSpan} style={{ ...tdCell, color: "var(--ink-3)", textAlign: "center", padding: 32 }}>
                  No users found. Select a role and click Search.
                </td>
              </tr>
            )}
            {!loading &&
              rows.slice((currentPage - 1) * pageSize, currentPage * pageSize).map((row) => (
                <tr
                  key={row.user_id ?? row.admission_no ?? row.username}
                  style={{ transition: "background 0.1s" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "var(--bg-2)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "")}
                >
                  {isStudentRole ? (
                    <>
                      <td style={tdCell}>{row.admission_no || "—"}</td>
                      <td style={tdCell}>{row.roll_no || "—"}</td>
                      <td style={{ ...tdCell, fontWeight: 500 }}>{row.name}</td>
                      <td style={tdCell}>
                        {row.class_name
                          ? `${row.class_name}${row.section_name ? ` (${row.section_name})` : ""}`
                          : "—"}
                      </td>
                      <td style={tdCell}>
                        {row.user_id ? (
                          <AccessToggle
                            checked={row.access_status}
                            disabled={actionType === "toggle" && actionUserId === row.user_id}
                            onChange={(v) => void toggle(row.user_id, v)}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Not linked</span>
                        )}
                      </td>
                      <td style={tdCell}>
                        {row.user_id ? (
                          <PasswordCell
                            userId={row.user_id}
                            value={passwordMap[row.user_id] || ""}
                            onChange={(v) => setPasswordMap((prev) => ({ ...prev, [row.user_id]: v }))}
                            onUpdate={() => void resetPassword(row.user_id, false)}
                            onDefault={() => void resetPassword(row.user_id, true)}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Not linked</span>
                        )}
                      </td>
                      <td style={tdCell}>
                        {row.parent_user_id ? (
                          <AccessToggle
                            checked={Boolean(row.parent_access_status)}
                            disabled={actionType === "toggle" && actionUserId === row.parent_user_id}
                            onChange={(v) => void toggle(row.parent_user_id!, v)}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Not linked</span>
                        )}
                      </td>
                      <td style={tdCell}>
                        {row.parent_user_id ? (
                          <PasswordCell
                            userId={row.parent_user_id}
                            value={passwordMap[row.parent_user_id] || ""}
                            onChange={(v) =>
                              setPasswordMap((prev) => ({ ...prev, [row.parent_user_id!]: v }))
                            }
                            onUpdate={() => void resetPassword(row.parent_user_id!, false)}
                            onDefault={() => void resetPassword(row.parent_user_id!, true)}
                          />
                        ) : (
                          <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Not linked</span>
                        )}
                      </td>
                    </>
                  ) : (
                    <>
                      <td style={tdCell}>{row.staff_no || "—"}</td>
                      <td style={{ ...tdCell, fontWeight: 500 }}>{row.name}</td>
                      <td style={tdCell}>{row.role_name}</td>
                      <td style={tdCell}>{row.email || "—"}</td>
                      <td style={tdCell}>
                        <AccessToggle
                          checked={row.access_status}
                          disabled={actionType === "toggle" && actionUserId === row.user_id}
                          onChange={(v) => void toggle(row.user_id, v)}
                        />
                      </td>
                      <td style={tdCell}>
                        <PasswordCell
                          userId={row.user_id}
                          value={passwordMap[row.user_id] || ""}
                          onChange={(v) => setPasswordMap((prev) => ({ ...prev, [row.user_id]: v }))}
                          onUpdate={() => void resetPassword(row.user_id, false)}
                          onDefault={() => void resetPassword(row.user_id, true)}
                        />
                      </td>
                    </>
                  )}
                </tr>
              ))}
          </tbody>
        </table>

        {/* Pagination controls */}
        {rows.length > pageSize && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "12px 14px", borderTop: "1px solid var(--bd)" }}>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              style={{
                height: 30, minWidth: 72, border: "1px solid var(--bd)", borderRadius: 6,
                background: currentPage === 1 ? "var(--bg-2)" : "var(--bg-0)",
                color: currentPage === 1 ? "var(--ink-3)" : "var(--ink-1)",
                fontSize: 12, fontWeight: 600, cursor: currentPage === 1 ? "not-allowed" : "pointer",
              }}
            >
              ← Prev
            </button>
            {Array.from({ length: Math.ceil(rows.length / pageSize) }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === Math.ceil(rows.length / pageSize) || Math.abs(p - currentPage) <= 1)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && (p as number) - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} style={{ fontSize: 12, color: "var(--ink-3)", padding: "0 2px" }}>…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setCurrentPage(p as number)}
                    style={{
                      height: 30, minWidth: 32, border: `1px solid ${currentPage === p ? "var(--pu)" : "var(--bd)"}`,
                      borderRadius: 6,
                      background: currentPage === p ? "var(--pu)" : "var(--bg-0)",
                      color: currentPage === p ? "#fff" : "var(--ink-1)",
                      fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 6px",
                    }}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(Math.ceil(rows.length / pageSize), p + 1))}
              disabled={currentPage === Math.ceil(rows.length / pageSize)}
              style={{
                height: 30, minWidth: 72, border: "1px solid var(--bd)", borderRadius: 6,
                background: currentPage === Math.ceil(rows.length / pageSize) ? "var(--bg-2)" : "var(--bg-0)",
                color: currentPage === Math.ceil(rows.length / pageSize) ? "var(--ink-3)" : "var(--ink-1)",
                fontSize: 12, fontWeight: 600,
                cursor: currentPage === Math.ceil(rows.length / pageSize) ? "not-allowed" : "pointer",
              }}
            >
              Next →
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Small reusable sub-components ─────────────────────────────── */

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
        style={{ width: 15, height: 15, accentColor: "var(--pu)", cursor: disabled ? "not-allowed" : "pointer" }}
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

function PasswordCell({
  userId,
  value,
  onChange,
  onUpdate,
  onDefault,
}: {
  userId: number;
  value: string;
  onChange: (v: string) => void;
  onUpdate: () => void;
  onDefault: () => void;
}) {
  void userId;
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="New password"
        style={{
          height: 30,
          minWidth: 120,
          border: "1px solid var(--bd)",
          borderRadius: 6,
          padding: "0 8px",
          fontSize: 12,
          background: "var(--bg-1)",
          color: "var(--ink-1)",
        }}
      />
      <button
        type="button"
        onClick={onUpdate}
        style={{
          height: 30,
          border: "1px solid var(--bd)",
          background: "var(--bg-1)",
          borderRadius: 6,
          padding: "0 10px",
          fontSize: 12,
          cursor: "pointer",
          color: "var(--ink-2)",
          fontWeight: 500,
        }}
      >
        Update
      </button>
      <button
        type="button"
        onClick={onDefault}
        style={{
          height: 30,
          border: "1px solid var(--bd)",
          background: "var(--bg-1)",
          borderRadius: 6,
          padding: "0 10px",
          fontSize: 12,
          cursor: "pointer",
          color: "var(--ink-3)",
        }}
        title="Reset to 123456"
      >
        Default
      </button>
    </div>
  );
}
