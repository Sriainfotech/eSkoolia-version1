"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load users.");
      setRows([]);
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
    <section className="admin-visitor-area up_st_admin_visitor">
      <div style={{ marginBottom: 14, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
        <h1 style={{ margin: 0, fontSize: 24 }}>Login Permission</h1>
        <div style={{ display: "flex", gap: 8, fontSize: 13, color: "var(--text-muted)", flexWrap: "wrap" }}>
          <span>Dashboard</span>
          <span>|</span>
          <span>Role Permission</span>
          <span>|</span>
          <span>Login Permission</span>
        </div>
      </div>

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginBottom: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, gap: 10, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Select Criteria</h3>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link href="/roles" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", textDecoration: "none", color: "var(--text)" }}>Role</Link>
            <Link href="/roles/assign-permission" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", textDecoration: "none", color: "var(--text)" }}>Assign Permission</Link>
            <Link href="/roles/due-fees-login-permission" style={{ border: "1px solid var(--line)", borderRadius: 8, padding: "8px 12px", textDecoration: "none", color: "var(--text)" }}>Due Fees Login Permission</Link>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: isStudentRole ? "repeat(5, minmax(0, 1fr))" : "repeat(2, minmax(0, 1fr))", gap: 10 }}>
          <div>
            <label style={{ display: "block", marginBottom: 4 }}>Role *</label>
            <select value={roleId} onChange={(e) => setRoleId(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }} disabled={loadingCriteria || loading}>
              <option value="">Select role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>

          {isStudentRole ? (
            <>
              <div>
                <label style={{ display: "block", marginBottom: 4 }}>Class *</label>
                <select value={classId} onChange={(e) => setClassId(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }} disabled={loading}>
                  <option value="">Select class</option>
                    {studentClasses.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4 }}>Section</label>
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }} disabled={loading}>
                  <option value="">Select section</option>
                  {studentFilteredSections.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4 }}>Name</label>
                <select
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: "100%", height: 36, boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }}
                >
                  <option value="">Select student</option>
                  {studentOptions.map((student) => {
                    const studentName = `${student.first_name || ""} ${student.last_name || ""}`.trim() || `Student ${student.id}`;
                    const admissionNo = student.admission_no ? ` (${student.admission_no})` : "";
                    const rollNo = student.roll_no ? ` [Roll: ${student.roll_no}]` : "";
                    return (
                      <option key={student.id} value={student.admission_no || String(student.id)}>
                        {studentName}{admissionNo}{rollNo}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label style={{ display: "block", marginBottom: 4 }}>Roll No</label>
                <input value={rollNo} onChange={(e) => setRollNo(e.target.value)} placeholder="Roll no" style={{ width: "100%", height: 36, boxSizing: "border-box", border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }} />
              </div>
            </>
          ) : null}
        </div>

        <div style={{ marginTop: 10, textAlign: "right" }}>
          <button type="button" onClick={searchUsers} disabled={loadingCriteria || loading} style={{ border: "1px solid var(--primary)", background: "var(--primary)", color: "#fff", borderRadius: 8, padding: "8px 14px", opacity: loadingCriteria || loading ? 0.7 : 1 }}>
            {loading ? "Searching..." : "Search"}
          </button>
        </div>
      </div>

      {error && <div style={{ marginBottom: 8, color: "var(--danger)" }}>{error}</div>}
      {message && <div style={{ marginBottom: 8, color: "var(--primary)" }}>{message}</div>}

      <div style={{ background: "var(--surface)", border: "1px solid var(--line)", borderRadius: 10, overflow: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", minWidth: isStudentRole ? 1250 : 980 }}>
          <thead>
            <tr style={{ background: "var(--surface-muted)" }}>
              {isStudentRole ? (
                <>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Admission</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Roll</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Class</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Student Permission</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Student Password</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Parent Permission</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Parent Password</th>
                </>
              ) : (
                <>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Staff No</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Name</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Role</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Email</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Login Permission</th>
                  <th style={{ textAlign: "left", padding: 8, borderBottom: "1px solid var(--line)" }}>Password</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={tableColSpan} style={{ padding: 10, color: "var(--text-muted)" }}>
                  No users found. Select role and click search.
                </td>
              </tr>
            )}
            {loading && (
              <tr>
                <td colSpan={tableColSpan} style={{ padding: 10, color: "var(--text-muted)" }}>Loading...</td>
              </tr>
            )}
            {!loading && rows.map((row) => (
              <tr key={row.user_id ?? row.admission_no ?? row.username}>
                {isStudentRole ? (
                  <>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.admission_no || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.roll_no || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      {row.class_name ? `${row.class_name}${row.section_name ? ` (${row.section_name})` : ""}` : "-"}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      {row.user_id ? (
                        <input
                          type="checkbox"
                          checked={row.access_status}
                          disabled={actionType === "toggle" && actionUserId === row.user_id}
                          onChange={(event) => void toggle(row.user_id, event.target.checked)}
                        />
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not linked</span>
                      )}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      {row.user_id ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="text"
                            value={passwordMap[row.user_id] || ""}
                            onChange={(event) => setPasswordMap((prev) => ({ ...prev, [row.user_id]: event.target.value }))}
                            placeholder="New password"
                            style={{ height: 30, minWidth: 120, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }}
                          />
                          <button type="button" onClick={() => void resetPassword(row.user_id, false)} style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 6, padding: "5px 8px" }}>
                            Update
                          </button>
                          <button type="button" onClick={() => void resetPassword(row.user_id, true)} style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 6, padding: "5px 8px" }}>
                            Default
                          </button>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Default = 123456</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not linked</span>
                      )}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      {row.parent_user_id ? (
                        <input
                          type="checkbox"
                          checked={Boolean(row.parent_access_status)}
                          disabled={actionType === "toggle" && actionUserId === row.parent_user_id}
                          onChange={(event) => void toggle(row.parent_user_id!, event.target.checked)}
                        />
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not linked</span>
                      )}
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      {row.parent_user_id ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                          <input
                            type="text"
                            value={passwordMap[row.parent_user_id] || ""}
                            onChange={(event) => setPasswordMap((prev) => ({ ...prev, [row.parent_user_id!]: event.target.value }))}
                            placeholder="Parent password"
                            style={{ height: 30, minWidth: 120, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }}
                          />
                          <button type="button" onClick={() => void resetPassword(row.parent_user_id!, false)} style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 6, padding: "5px 8px" }}>
                            Update
                          </button>
                          <button type="button" onClick={() => void resetPassword(row.parent_user_id!, true)} style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 6, padding: "5px 8px" }}>
                            Default
                          </button>
                          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Default = 123456</span>
                        </div>
                      ) : (
                        <span style={{ color: "var(--text-muted)", fontSize: 12 }}>Not linked</span>
                      )}
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.staff_no || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.role_name}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>{row.email || "-"}</td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <input
                        type="checkbox"
                        checked={row.access_status}
                        disabled={actionType === "toggle" && actionUserId === row.user_id}
                        onChange={(event) => void toggle(row.user_id, event.target.checked)}
                      />
                    </td>
                    <td style={{ padding: 8, borderBottom: "1px solid var(--line)" }}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                        <input
                          type="text"
                          value={passwordMap[row.user_id] || ""}
                          onChange={(event) => setPasswordMap((prev) => ({ ...prev, [row.user_id]: event.target.value }))}
                          placeholder="New password"
                          style={{ height: 30, minWidth: 120, border: "1px solid var(--line)", borderRadius: 6, padding: "0 8px" }}
                        />
                        <button type="button" onClick={() => void resetPassword(row.user_id, false)} style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 6, padding: "5px 8px" }}>
                          Update
                        </button>
                        <button type="button" onClick={() => void resetPassword(row.user_id, true)} style={{ border: "1px solid var(--line)", background: "var(--surface)", borderRadius: 6, padding: "5px 8px" }}>
                          Default
                        </button>
                        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Default = 123456</span>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
