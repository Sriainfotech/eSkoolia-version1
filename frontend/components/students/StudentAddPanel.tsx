"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiRequestWithRefresh } from "@/lib/api-auth";

type ApiList<T> = T[] | { results?: T[] };

type StudentCategory = {
  id: number;
  name: string;
};

type Guardian = {
  id: number;
  full_name: string;
  relation: string;
  phone: string;
};

type SchoolClass = {
  id: number;
  name: string;
};

type AcademicYear = {
  id: number;
  name: string;
};

type Section = {
  id: number;
  school_class: number;
  name: string;
};

type StudentCreatePayload = {
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  academic_year: number;
  gender: string;
  custom_gender?: string;
  blood_group?: string;
  phone?: string;
  email?: string;
  address_line?: string;
  city?: string;
  state?: string;
  pincode?: string;
  photo?: string;
  status: "active" | "inactive" | "transferred" | "dropped";
  category?: number;
  guardian?: number;
  current_class: number;
  current_section: number;
  is_disabled: boolean;
  is_active: boolean;
};

type ApiError = Error & {
  details?: {
    field_errors?: Record<string, string | string[]>;
    message?: string;
  };
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

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

function fieldStyle() {
  return {
    width: "100%",
    height: 38,
    border: "1px solid var(--line)",
    borderRadius: 8,
    padding: "0 10px",
    background: "#fff",
  } as const;
}

function boxStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
  } as const;
}

function buttonStyle(color = "var(--primary)") {
  return {
    height: 36,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    padding: "0 14px",
    cursor: "pointer",
    fontWeight: 600,
  } as const;
}

function parseError(error: unknown) {
  const apiError = error as ApiError;
  const message = apiError?.details?.message;
  if (message) {
    return message;
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Unable to save student.";
}

export function StudentAddPanel() {
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [categories, setCategories] = useState<StudentCategory[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sections, setSections] = useState<Section[]>([]);

  const [admissionNo, setAdmissionNo] = useState("");
  const [rollNo, setRollNo] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [academicYearId, setAcademicYearId] = useState("");
  const [gender, setGender] = useState("male");
  const [customGender, setCustomGender] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [addressLine, setAddressLine] = useState("");
  const [city, setCity] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [photo, setPhoto] = useState("");
  const [statusValue, setStatusValue] = useState<"active" | "inactive" | "transferred" | "dropped">("active");
  const [religion, setReligion] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [guardianId, setGuardianId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);
  const [isActive, setIsActive] = useState(true);

  const [newGuardianName, setNewGuardianName] = useState("");
  const [newGuardianRelation, setNewGuardianRelation] = useState("Father");
  const [newGuardianPhone, setNewGuardianPhone] = useState("");
  const [newGuardianEmail, setNewGuardianEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const filteredSections = useMemo(() => {
    if (!classId) return [];
    return sections.filter((section) => String(section.school_class) === classId);
  }, [sections, classId]);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const [yearData, categoryData, guardianData, classData, sectionData] = await Promise.all([
        apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/"),
        apiGet<ApiList<StudentCategory>>("/api/v1/students/categories/"),
        apiGet<ApiList<Guardian>>("/api/v1/students/guardians/"),
        apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/"),
        apiGet<ApiList<Section>>("/api/v1/core/sections/"),
      ]);
      setAcademicYears(listData(yearData));
      setCategories(listData(categoryData));
      setGuardians(listData(guardianData));
      setClasses(listData(classData));
      setSections(listData(sectionData));
    } catch (loadError) {
      setError(parseError(loadError));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!classId) {
      setSectionId("");
      return;
    }
    const exists = filteredSections.some((section) => String(section.id) === sectionId);
    if (!exists) {
      setSectionId("");
    }
  }, [classId, filteredSections, sectionId]);

  const resetStudentForm = () => {
    setAdmissionNo("");
    setRollNo("");
    setFirstName("");
    setLastName("");
    setDateOfBirth("");
    setAcademicYearId("");
    setGender("male");
    setCustomGender("");
    setBloodGroup("");
    setPhone("");
    setEmail("");
    setAddressLine("");
    setCity("");
    setStateName("");
    setPincode("");
    setPhoto("");
    setStatusValue("active");
    setReligion("");
    setCategoryId("");
    setGuardianId("");
    setClassId("");
    setSectionId("");
    setIsDisabled(false);
    setIsActive(true);
    setFieldErrors({});
  };

  const validateClient = () => {
    const nextErrors: Record<string, string> = {};
    if (!admissionNo.trim()) {
      nextErrors.admission_no = "Admission number is required";
    }
    if (!firstName.trim()) {
      nextErrors.first_name = "First name is required";
    } else if (!/^[A-Za-z ]+$/.test(firstName.trim())) {
      nextErrors.first_name = "First name can only contain letters and spaces";
    }
    if (lastName.trim() && !/^[A-Za-z ]+$/.test(lastName.trim())) {
      nextErrors.last_name = "Last name can only contain letters and spaces";
    }
    if (!dateOfBirth) {
      nextErrors.dob = "Date of birth is required";
    } else {
      const dobDate = new Date(dateOfBirth);
      const now = new Date();
      if (dobDate > now) {
        nextErrors.dob = "Date of birth cannot be in the future";
      } else {
        const age = (now.getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age < 3) {
          nextErrors.dob = "Student must be at least 3 years old";
        }
      }
    }
    if (!academicYearId) {
      nextErrors.academic_year = "Academic year is required";
    }
    if (!classId) {
      nextErrors.class = "Please select a class";
    }
    if (!sectionId) {
      nextErrors.section = "Section is required";
    } else if (!filteredSections.some((item) => String(item.id) === sectionId)) {
      nextErrors.section = "Selected section does not belong to selected class";
    }
    if (gender === "other" && !customGender.trim()) {
      nextErrors.custom_gender = "Custom gender is required";
    }
    if (!phone.trim() && !email.trim()) {
      nextErrors.phone = "At least one contact method (phone or email) is required";
    }
    if (phone.trim() && !/^\+?\d{7,15}$/.test(phone.trim())) {
      nextErrors.phone = "Please enter a valid phone number";
    }
    return nextErrors;
  };

  const isFormValid = !loading && Object.keys(validateClient()).length === 0;

  const syncApiFieldErrors = (apiError: ApiError) => {
    const source = apiError.details?.field_errors || {};
    const mapped: Record<string, string> = {};
    for (const [field, value] of Object.entries(source)) {
      mapped[field] = Array.isArray(value) ? String(value[0] || "") : String(value || "");
    }
    setFieldErrors(mapped);
  };

  const addGuardianInline = async () => {
    if (!newGuardianName.trim() || !newGuardianRelation.trim() || !newGuardianPhone.trim()) {
      setError("Guardian name, relation, and phone are required.");
      return;
    }
    if (!/^\d{1,12}$/.test(newGuardianPhone.trim())) {
      setError(newGuardianPhone.trim().length > 12
        ? "Phone number must not exceed 12 digits."
        : "Phone number must contain digits only.");
      return;
    }
    try {
      setError("");
      const created = await apiPost<Guardian>("/api/v1/students/guardians/", {
        full_name: newGuardianName.trim(),
        relation: newGuardianRelation.trim(),
        phone: newGuardianPhone.trim(),
        email: newGuardianEmail.trim(),
      });
      setGuardians((prev) => [...prev, created]);
      setGuardianId(String(created.id));
      setNewGuardianName("");
      setNewGuardianRelation("Father");
      setNewGuardianPhone("");
      setNewGuardianEmail("");
      setSuccess("Guardian added and selected.");
    } catch (createError) {
      setError(parseError(createError));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSuccess("");
    const nextErrors = validateClient();
    setFieldErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setError("Validation failed");
      return;
    }

    try {
      setSaving(true);
      setError("");
      const payload: StudentCreatePayload = {
        admission_no: admissionNo.trim(),
        roll_no: rollNo.trim() || undefined,
        first_name: firstName.trim(),
        last_name: lastName.trim() || "",
        date_of_birth: dateOfBirth,
        academic_year: Number(academicYearId),
        gender,
        custom_gender: gender === "other" ? customGender.trim() : undefined,
        blood_group: bloodGroup.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address_line: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        state: stateName.trim() || undefined,
        pincode: pincode.trim() || undefined,
        photo: photo.trim() || undefined,
        status: statusValue,
        category: categoryId ? Number(categoryId) : undefined,
        guardian: guardianId ? Number(guardianId) : undefined,
        current_class: Number(classId),
        current_section: Number(sectionId),
        is_disabled: isDisabled,
        is_active: isActive,
      };
      const response = await apiPost<{ message?: string; warning?: string }>("/api/v1/students/students/", payload);
      setSuccess(response?.warning ? `Student added successfully. ${response.warning}` : "Student added successfully");
      resetStudentForm();
    } catch (submitError) {
      syncApiFieldErrors(submitError as ApiError);
      setError(parseError(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Add Student</h1>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8 }}>
                <Link href="/students/list" style={{ ...buttonStyle("#0ea5e9"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Student List
                </Link>
                <Link href="/students/multi-class" style={{ ...buttonStyle("#16a34a"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Student Subject Assignment
                </Link>
              </div>
              <div style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13 }}>
                <span>Dashboard</span>
                <span>/</span>
                <span>Student Information</span>
                <span>/</span>
                <span>Add Student</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 12 }}>
          <form onSubmit={submit}>
            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Student Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 10 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Admission No *</label>
                  <input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} style={fieldStyle()} />
                  {fieldErrors.admission_no && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.admission_no}</p>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Roll No</label>
                  <input value={rollNo} onChange={(e) => setRollNo(e.target.value)} style={fieldStyle()} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>First Name *</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} style={fieldStyle()} />
                  {fieldErrors.first_name && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.first_name}</p>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} style={fieldStyle()} />
                  {fieldErrors.last_name && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.last_name}</p>}
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Date Of Birth *</label>
                  <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={fieldStyle()} />
                  {fieldErrors.dob && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.dob}</p>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Academic Year *</label>
                  <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} style={fieldStyle()}>
                    <option value="">Select Academic Year</option>
                    {academicYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.academic_year && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.academic_year}</p>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Gender *</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} style={fieldStyle()}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {gender === "other" && (
                  <div>
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Custom Gender *</label>
                    <input value={customGender} onChange={(e) => setCustomGender(e.target.value)} style={fieldStyle()} />
                    {fieldErrors.custom_gender && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.custom_gender}</p>}
                  </div>
                )}
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Blood Group</label>
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} style={fieldStyle()}>
                    <option value="">Select Blood Group</option>
                    <option value="A+">A+</option>
                    <option value="A-">A-</option>
                    <option value="B+">B+</option>
                    <option value="B-">B-</option>
                    <option value="AB+">AB+</option>
                    <option value="AB-">AB-</option>
                    <option value="O+">O+</option>
                    <option value="O-">O-</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Religion</label>
                  <select value={religion} onChange={(e) => setReligion(e.target.value)} style={fieldStyle()}>
                    <option value="">Select Religion</option>
                    <option value="Islam">Islam</option>
                    <option value="Hinduism">Hinduism</option>
                    <option value="Christianity">Christianity</option>
                    <option value="Buddhism">Buddhism</option>
                    <option value="Sikhism">Sikhism</option>
                    <option value="Judaism">Judaism</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Category</label>
                  <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={fieldStyle()}>
                    <option value="">Select Category</option>
                    {categories.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Class *</label>
                  <select value={classId} onChange={(e) => setClassId(e.target.value)} style={fieldStyle()}>
                    <option value="">Select Class</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.class && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.class}</p>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Section *</label>
                  <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()} disabled={!classId}>
                    <option value="">Select Section</option>
                    {filteredSections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.section && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.section}</p>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Phone</label>
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} style={fieldStyle()} />
                  {fieldErrors.phone && <p style={{ margin: "6px 0 0", color: "var(--warning)", fontSize: 12 }}>{fieldErrors.phone}</p>}
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Email</label>
                  <input value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle()} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Address Line</label>
                  <input value={addressLine} onChange={(e) => setAddressLine(e.target.value)} style={fieldStyle()} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>City</label>
                  <input value={city} onChange={(e) => setCity(e.target.value)} style={fieldStyle()} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>State</label>
                  <input value={stateName} onChange={(e) => setStateName(e.target.value)} style={fieldStyle()} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Pincode</label>
                  <input value={pincode} onChange={(e) => setPincode(e.target.value)} style={fieldStyle()} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Photo URL</label>
                  <input value={photo} onChange={(e) => setPhoto(e.target.value)} style={fieldStyle()} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Status</label>
                  <select value={statusValue} onChange={(e) => setStatusValue(e.target.value as "active" | "inactive" | "transferred" | "dropped")} style={fieldStyle()}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="transferred">Transferred</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, paddingTop: 24 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={isDisabled} onChange={(e) => setIsDisabled(e.target.checked)} />
                    Disabled
                  </label>
                  <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13 }}>
                    <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
                    Active
                  </label>
                </div>
              </div>
            </div>

            <div className="white-box" style={{ ...boxStyle(), marginTop: 12 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Guardian Details (Quick Add)</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 10 }}>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Full Name</label>
                  <input value={newGuardianName} onChange={(e) => setNewGuardianName(e.target.value)} style={fieldStyle()} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Relation</label>
                  <select value={newGuardianRelation} onChange={(e) => setNewGuardianRelation(e.target.value)} style={fieldStyle()}>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Phone</label>
                  <input value={newGuardianPhone} onChange={(e) => setNewGuardianPhone(e.target.value.replace(/\D/g, "").slice(0, 12))} maxLength={12} style={fieldStyle()} />
                </div>
                <div>
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Email</label>
                  <input value={newGuardianEmail} onChange={(e) => setNewGuardianEmail(e.target.value)} style={fieldStyle()} />
                </div>
              </div>
              <div style={{ marginTop: 12 }}>
                <button type="button" onClick={() => void addGuardianInline()} style={buttonStyle("#0ea5e9")}>
                  Add Guardian
                </button>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: 12 }}>
              <button type="submit" disabled={saving || !isFormValid} style={buttonStyle()}>
                {saving ? "Saving..." : "Save Student"}
              </button>
            </div>
          </form>

          {loading && <p style={{ margin: 0, color: "var(--text-muted)" }}>Loading form data...</p>}
          {error && <p style={{ margin: 0, color: "var(--warning)" }}>{error}</p>}
          {success && <p style={{ margin: 0, color: "#0f766e" }}>{success}</p>}
        </div>
      </section>
    </div>
  );
}
