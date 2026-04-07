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

// Validation helpers
function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  const phoneRegex = /^\d{10}$/; // Exactly 10 digits
  return phoneRegex.test(phone.trim().replace(/\D/g, ""));
}

function isValidPincode(pincode: string): boolean {
  const pincodeRegex = /^\d{6}$/; // Exactly 6 digits
  return pincodeRegex.test(pincode.trim().replace(/\D/g, ""));
}

function isAlphabetsOnly(value: string): boolean {
  return /^[A-Za-z\s'-]*$/.test(value);
}

function isValidAdmissionOrRoll(value: string): boolean {
  return /^[A-Za-z0-9]+$/.test(value.trim());
}

function isValidNumericRoll(value: string): boolean {
  return /^\d+$/.test(value.trim());
}

export function StudentAddPanel() {
  const CLASS_AGE_RULES: Record<number, [number, number]> = {
    1: [5, 7],
    2: [6, 8],
    3: [7, 9],
    4: [8, 10],
    5: [9, 11],
    6: [10, 12],
    7: [11, 13],
    8: [12, 14],
    9: [13, 15],
    10: [14, 16],
    11: [15, 17],
    12: [16, 18],
  };

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

  const [newGuardianName, setNewGuardianName] = useState("");
  const [newGuardianRelation, setNewGuardianRelation] = useState("Father");
  const [newGuardianPhone, setNewGuardianPhone] = useState("");
  const [newGuardianEmail, setNewGuardianEmail] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [guardianValidationError, setGuardianValidationError] = useState("");

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
    setFieldErrors({});
  };

  const validateClient = () => {
    const nextErrors: Record<string, string> = {};

    // Admission number validation
    if (!admissionNo.trim()) {
      nextErrors.admission_no = "Admission number is required";
    } else if (!isValidAdmissionOrRoll(admissionNo)) {
      nextErrors.admission_no = "Admission/Roll number should contain only numbers (or alphanumeric if needed)";
    }

    // Roll number validation
    if (rollNo.trim() && !isValidNumericRoll(rollNo)) {
      nextErrors.roll_no = "Roll number must contain numbers only";
    }

    // First name validation
    if (!firstName.trim()) {
      nextErrors.first_name = "First name is required";
    } else if (!isAlphabetsOnly(firstName.trim())) {
      nextErrors.first_name = "First name can only contain letters, spaces, and hyphens";
    } else if (firstName.trim().length < 2) {
      nextErrors.first_name = "First name must be at least 2 characters";
    }

    // Last name validation
    if (!lastName.trim()) {
      nextErrors.last_name = "Last name is required";
    } else if (!isAlphabetsOnly(lastName.trim())) {
      nextErrors.last_name = "Last name can only contain letters, spaces, and hyphens";
    }

    // Date of birth validation
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
          const years = Math.floor(age);
          const months = Math.round((age - years) * 12);
          nextErrors.dob = `Student must be at least 3 years old (Currently ${years} years ${months} months old)`;
        } else if (age > 25) {
          nextErrors.dob = "Student age should not exceed 25 years";
        } else if (classId) {
          const selectedClass = classes.find((item) => String(item.id) === classId);
          const className = String(selectedClass?.name || "");
          const classMatch = className.match(/\d+/);
          const classNumber = classMatch ? Number(classMatch[0]) : null;
          if (classNumber && CLASS_AGE_RULES[classNumber]) {
            const [minAge, maxAge] = CLASS_AGE_RULES[classNumber];
            if (age < minAge || age > maxAge) {
              nextErrors.dob = `Selected DOB does not match the required age for the selected class (Expected age: ${minAge}-${maxAge} years)`;
            }
          }
        }
      }
    }

    // Academic year validation
    if (!academicYearId) {
      nextErrors.academic_year = "Academic year is required";
    }

    // Gender validation
    if (!gender) {
      nextErrors.gender = "Gender is required";
    } else if (gender === "other" && !customGender.trim()) {
      nextErrors.custom_gender = "Please specify custom gender";
    }

    // Class validation
    if (!classId) {
      nextErrors.class = "Class is required";
    }

    // Section validation
    if (!sectionId) {
      nextErrors.section = "Section is required";
    } else if (!filteredSections.some((item) => String(item.id) === sectionId)) {
      nextErrors.section = "Selected section does not belong to selected class";
    }

    // Phone validation
    if (!phone.trim()) {
      nextErrors.phone = "Phone number is required";
    } else if (!isValidPhone(phone.trim())) {
      nextErrors.phone = "Phone number must be exactly 10 digits";
    }

    // Email validation
    if (email.trim()) {
      if (!isValidEmail(email.trim())) {
        nextErrors.email = "Invalid email format";
      }
    }

    // Pincode validation
    if (pincode.trim()) {
      if (!isValidPincode(pincode.trim())) {
        nextErrors.pincode = "Pincode must be exactly 6 digits";
      }
    }

    return nextErrors;
  };

  const isFormValid = !loading && Object.keys(validateClient()).length === 0;

  const syncApiFieldErrors = (apiError: ApiError) => {
    const source = apiError.details?.field_errors || {};
    const mapped: Record<string, string> = {};
    for (const [field, value] of Object.entries(source)) {
      const mappedField = field === "date_of_birth" ? "dob" : field === "current_class" ? "class" : field === "current_section" ? "section" : field;
      mapped[mappedField] = Array.isArray(value) ? String(value[0] || "") : String(value || "");
    }
    setFieldErrors(mapped);
  };

  const setSingleFieldError = (field: string, message: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) {
        next[field] = message;
      } else {
        delete next[field];
      }
      return next;
    });
  };

  const runLiveValidation = (
    field: "admission_no" | "roll_no" | "first_name" | "last_name" | "dob" | "phone" | "pincode",
    valueOverride?: string,
  ) => {
    if (field === "admission_no") {
      const value = typeof valueOverride === "string" ? valueOverride : admissionNo;
      if (!value.trim()) {
        setSingleFieldError("admission_no", "Admission number is required");
      } else if (!isValidAdmissionOrRoll(value)) {
        setSingleFieldError("admission_no", "Admission/Roll number should contain only numbers (or alphanumeric if needed)");
      } else {
        setSingleFieldError("admission_no", "");
      }
      return;
    }

    if (field === "roll_no") {
      const value = typeof valueOverride === "string" ? valueOverride : rollNo;
      if (value.trim() && !isValidNumericRoll(value)) {
        setSingleFieldError("roll_no", "Roll number must contain numbers only");
      } else {
        setSingleFieldError("roll_no", "");
      }
      return;
    }

    if (field === "first_name") {
      const value = typeof valueOverride === "string" ? valueOverride : firstName;
      if (!value.trim()) {
        setSingleFieldError("first_name", "First name is required");
      } else if (!isAlphabetsOnly(value.trim())) {
        setSingleFieldError("first_name", "First name can only contain letters, spaces, and hyphens");
      } else if (value.trim().length < 2) {
        setSingleFieldError("first_name", "First name must be at least 2 characters");
      } else {
        setSingleFieldError("first_name", "");
      }
      return;
    }

    if (field === "last_name") {
      const value = typeof valueOverride === "string" ? valueOverride : lastName;
      if (!value.trim()) {
        setSingleFieldError("last_name", "Last name is required");
      } else if (!isAlphabetsOnly(value.trim())) {
        setSingleFieldError("last_name", "Last name can only contain letters, spaces, and hyphens");
      } else {
        setSingleFieldError("last_name", "");
      }
      return;
    }

    if (field === "dob") {
      const value = typeof valueOverride === "string" ? valueOverride : dateOfBirth;
      if (!value) {
        setSingleFieldError("dob", "Date of birth is required");
        return;
      }
      const dobDate = new Date(value);
      const now = new Date();
      if (dobDate > now) {
        setSingleFieldError("dob", "Date of birth cannot be in the future");
        return;
      }
      const age = (now.getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
      if (age < 3) {
        setSingleFieldError("dob", "Student must be at least 3 years old");
        return;
      }
      const selectedClass = classes.find((item) => String(item.id) === classId);
      const className = String(selectedClass?.name || "");
      const classMatch = className.match(/\d+/);
      const classNumber = classMatch ? Number(classMatch[0]) : null;
      if (classNumber && CLASS_AGE_RULES[classNumber]) {
        const [minAge, maxAge] = CLASS_AGE_RULES[classNumber];
        if (age < minAge || age > maxAge) {
          setSingleFieldError("dob", `Selected DOB does not match the required age for the selected class (Expected age: ${minAge}-${maxAge} years)`);
          return;
        }
      }
      setSingleFieldError("dob", "");
      return;
    }

    if (field === "phone") {
      const value = typeof valueOverride === "string" ? valueOverride : phone;
      if (!value.trim()) {
        setSingleFieldError("phone", "Phone number is required");
      } else if (!isValidPhone(value.trim())) {
        setSingleFieldError("phone", "Phone number must be exactly 10 digits");
      } else {
        setSingleFieldError("phone", "");
      }
      return;
    }

    if (field === "pincode") {
      const value = typeof valueOverride === "string" ? valueOverride : pincode;
      if (value.trim() && !isValidPincode(value.trim())) {
        setSingleFieldError("pincode", "Pincode must be exactly 6 digits");
      } else {
        setSingleFieldError("pincode", "");
      }
    }
  };

  const addGuardianInline = async () => {
    setGuardianValidationError("");
    
    // Validation
    if (!newGuardianName.trim()) {
      setGuardianValidationError("Guardian name is required");
      return;
    }
    if (!isAlphabetsOnly(newGuardianName.trim())) {
      setGuardianValidationError("Guardian name can only contain letters and spaces");
      return;
    }
    if (newGuardianName.trim().length < 2) {
      setGuardianValidationError("Guardian name must be at least 2 characters");
      return;
    }
    if (!newGuardianPhone.trim()) {
      setGuardianValidationError("Guardian phone is required");
      return;
    }
    if (!isValidPhone(newGuardianPhone.trim())) {
      setGuardianValidationError("Guardian phone must be exactly 10 digits");
      return;
    }
    if (newGuardianEmail.trim() && !isValidEmail(newGuardianEmail.trim())) {
      setGuardianValidationError("Guardian email format is invalid");
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
      setGuardianValidationError("");
      setSuccess("Guardian added and selected successfully.");
    } catch (createError) {
      setGuardianValidationError(parseError(createError));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSuccess("");
    setError("");
    setGuardianValidationError("");

    // Validate all fields
    const nextErrors = validateClient();
    setFieldErrors(nextErrors);

    // Check guardian quick-add validation: if any field is filled, all must be valid
    const hasGuardianData = newGuardianName.trim() || newGuardianPhone.trim() || newGuardianEmail.trim();
    if (hasGuardianData) {
      if (!newGuardianName.trim()) {
        setGuardianValidationError("Guardian name is required if filling guardian details");
      } else if (!isAlphabetsOnly(newGuardianName.trim())) {
        setGuardianValidationError("Guardian name can only contain letters and spaces");
      } else if (newGuardianName.trim().length < 2) {
        setGuardianValidationError("Guardian name must be at least 2 characters");
      } else if (!newGuardianPhone.trim()) {
        setGuardianValidationError("Guardian phone is required if filling guardian details");
      } else if (!isValidPhone(newGuardianPhone.trim())) {
        setGuardianValidationError("Guardian phone must be exactly 10 digits");
      } else if (newGuardianEmail.trim() && !isValidEmail(newGuardianEmail.trim())) {
        setGuardianValidationError("Guardian email format is invalid");
      }
    }

    // Check if guardian validation failed
    if (hasGuardianData && (
      !newGuardianName.trim() ||
      !isAlphabetsOnly(newGuardianName.trim()) ||
      newGuardianName.trim().length < 2 ||
      !newGuardianPhone.trim() ||
      !isValidPhone(newGuardianPhone.trim()) ||
      (newGuardianEmail.trim() && !isValidEmail(newGuardianEmail.trim()))
    )) {
      return;
    }

    if (Object.keys(nextErrors).length > 0) {
      setError(`Please fix ${Object.keys(nextErrors).length} validation error(s)`);
      // Scroll to first error with small delay to ensure DOM is ready
      setTimeout(() => {
        const firstErrorKey = Object.keys(nextErrors)[0];
        const errorElement = document.querySelector(`[data-field="${firstErrorKey}"]`) as HTMLElement;
        if (errorElement) {
          errorElement.scrollIntoView({ behavior: "smooth", block: "center" });
          const input = errorElement.querySelector("input, select, textarea") as HTMLElement;
          if (input) input.focus();
        }
      }, 100);
      return;
    }

    try {
      setSaving(true);
      setError("");
      const isStudentActive = !isDisabled && statusValue === "active";
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
        is_active: isStudentActive,
      };
      const response = await apiPost<{ message?: string; warning?: string }>("/api/v1/students/students/", payload);
      setSuccess(response?.warning ? `Student added successfully. ${response.warning}` : "Student added successfully");
      resetStudentForm();
      
      // Redirect to student list after 1.5 seconds
      setTimeout(() => {
        if (typeof window !== "undefined") {
          window.location.href = "/students/list";
        }
      }, 1500);
    } catch (submitError) {
      syncApiFieldErrors(submitError as ApiError);
      const errorMsg = parseError(submitError);
      setError(errorMsg);
      
      // Handle specific errors
      if (errorMsg.includes("Admission number already exists") || errorMsg.includes("admission")) {
        setFieldErrors(prev => ({ ...prev, admission_no: "Admission number already exists" }));
      }
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
            {/* Helper text for required fields */}
            <div style={{ marginBottom: 12, padding: "8px 12px", backgroundColor: "#fef3c7", borderRadius: 8, fontSize: 12, color: "#92400e" }}>
              <strong>*</strong> Fields marked with asterisk are required
            </div>

            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Student Details</h3>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(160px, 1fr))", gap: 10 }}>
                <div data-field="admission_no">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Admission No *</label>
                  <input 
                    value={admissionNo} 
                    onChange={(e) => {
                      const value = e.target.value;
                      setAdmissionNo(value);
                      runLiveValidation("admission_no", value);
                    }} 
                    onBlur={() => runLiveValidation("admission_no")}
                    style={fieldStyle()} 
                    placeholder="e.g., ADM001"
                  />
                  {fieldErrors.admission_no && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.admission_no}</p>}
                </div>
                <div data-field="roll_no">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Roll No</label>
                  <input 
                    value={rollNo} 
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setRollNo(value);
                      runLiveValidation("roll_no", value);
                    }} 
                    onBlur={() => runLiveValidation("roll_no")}
                    style={fieldStyle()} 
                    placeholder="Roll number"
                    inputMode="numeric"
                  />
                  {fieldErrors.roll_no && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.roll_no}</p>}
                </div>
                <div data-field="first_name">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>First Name *</label>
                  <input 
                    value={firstName} 
                    onChange={(e) => {
                      const value = e.target.value;
                      setFirstName(value);
                      runLiveValidation("first_name", value);
                    }} 
                    onBlur={() => runLiveValidation("first_name")}
                    style={fieldStyle()} 
                    placeholder="John"
                  />
                  {fieldErrors.first_name && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.first_name}</p>}
                </div>
                <div data-field="last_name">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Last Name *</label>
                  <input 
                    value={lastName} 
                    onChange={(e) => {
                      const value = e.target.value;
                      setLastName(value);
                      runLiveValidation("last_name", value);
                    }} 
                    onBlur={() => runLiveValidation("last_name")}
                    style={fieldStyle()} 
                    placeholder="Doe"
                  />
                  {fieldErrors.last_name && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.last_name}</p>}
                </div>

                <div data-field="dob">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Date of Birth *</label>
                  <input 
                    type="date" 
                    value={dateOfBirth} 
                    onChange={(e) => {
                      const value = e.target.value;
                      setDateOfBirth(value);
                      runLiveValidation("dob", value);
                    }} 
                    onBlur={() => runLiveValidation("dob")}
                    style={fieldStyle()} 
                  />
                  {fieldErrors.dob && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.dob}</p>}
                </div>
                <div data-field="academic_year">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Academic Year *</label>
                  <select value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} style={fieldStyle()}>
                    <option value="">Select Academic Year</option>
                    {academicYears.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.academic_year && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.academic_year}</p>}
                </div>
                <div data-field="gender">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Gender *</label>
                  <select value={gender} onChange={(e) => setGender(e.target.value)} style={fieldStyle()}>
                    <option value="">Select Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {fieldErrors.gender && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.gender}</p>}
                </div>
                {gender === "other" && (
                  <div data-field="custom_gender">
                    <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Custom Gender *</label>
                    <input 
                      value={customGender} 
                      onChange={(e) => setCustomGender(e.target.value)} 
                      style={fieldStyle()} 
                      placeholder="Please specify"
                    />
                    {fieldErrors.custom_gender && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.custom_gender}</p>}
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

                <div data-field="class">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Class *</label>
                  <select value={classId} onChange={(e) => {
                    const value = e.target.value;
                    setClassId(value);
                    if (dateOfBirth) {
                      setTimeout(() => runLiveValidation("dob"), 0);
                    }
                  }} style={fieldStyle()}>
                    <option value="">Select Class</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.class && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.class}</p>}
                </div>
                <div data-field="section">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Section *</label>
                  <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} style={fieldStyle()} disabled={!classId}>
                    <option value="">{classId ? "Select Section" : "Select class first"}</option>
                    {filteredSections.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  {fieldErrors.section && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.section}</p>}
                </div>
                <div data-field="phone">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Phone *</label>
                  <input 
                    value={phone} 
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                      setPhone(value);
                      runLiveValidation("phone", value);
                    }} 
                    onBlur={() => runLiveValidation("phone")}
                    style={fieldStyle()} 
                    placeholder="10-digit number"
                    maxLength={10}
                  />
                  {fieldErrors.phone && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.phone}</p>}
                </div>
                <div data-field="email">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Email</label>
                  <input 
                    value={email} 
                    onChange={(e) => setEmail(e.target.value)} 
                    style={fieldStyle()} 
                    placeholder="student@example.com"
                    type="email"
                  />
                  {fieldErrors.email && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.email}</p>}
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
                <div data-field="pincode">
                  <label style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Pincode</label>
                  <input 
                    value={pincode} 
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                      setPincode(value);
                      runLiveValidation("pincode", value);
                    }} 
                    onBlur={() => runLiveValidation("pincode")}
                    style={fieldStyle()} 
                    placeholder="6-digit pincode"
                    maxLength={6}
                  />
                  {fieldErrors.pincode && <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12, fontWeight: 500 }}>⚠ {fieldErrors.pincode}</p>}
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

            <div style={{ display: "flex", justifyContent: "center", marginTop: 20, gap: 12 }}>
              <button 
                type="submit" 
                disabled={saving || loading} 
                style={{
                  ...buttonStyle(),
                  opacity: saving || loading ? 0.6 : 1,
                  cursor: saving || loading ? "not-allowed" : "pointer"
                } as React.CSSProperties}
              >
                {saving ? "🔄 Saving student..." : "✓ Save Student"}
              </button>
              <Link 
                href="/students/list" 
                style={{ ...buttonStyle("#6b7280"), display: "inline-flex", alignItems: "center", textDecoration: "none" } as React.CSSProperties}
              >
                Cancel
              </Link>
            </div>
          </form>

          {loading && (
            <div style={{ margin: 0, color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "12px" }}>
              <span>⏳ Loading form data...</span>
            </div>
          )}
          {error && (
            <div style={{ 
              margin: 0, 
              color: "#dc2626", 
              fontSize: 13,
              backgroundColor: "#fee2e2",
              padding: "12px",
              borderRadius: 8,
              border: "1px solid #fecaca",
              fontWeight: 500
            }}>
              ✕ {error}
            </div>
          )}
          {success && (
            <div style={{ 
              margin: 0, 
              color: "#065f46", 
              fontSize: 13,
              backgroundColor: "#d1fae5",
              padding: "12px",
              borderRadius: 8,
              border: "1px solid #a7f3d0",
              fontWeight: 500
            }}>
              ✓ {success}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
