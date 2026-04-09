"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
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
  district?: string;
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

type StudentDetail = {
  id: number;
  admission_no: string;
  roll_no?: string;
  first_name: string;
  last_name: string;
  date_of_birth?: string;
  academic_year?: number;
  gender?: string;
  custom_gender?: string;
  blood_group?: string;
  phone?: string;
  email?: string;
  address_line?: string;
  city?: string;
  district?: string;
  state?: string;
  pincode?: string;
  photo?: string;
  status?: "active" | "inactive" | "transferred" | "dropped";
  category?: number | null;
  guardian?: number | null;
  current_class?: number | null;
  current_section?: number | null;
  is_disabled?: boolean;
};

type ApiError = Error & {
  details?: {
    field_errors?: Record<string, string | string[]>;
    message?: string;
  };
};

type PincodeLookupResponse = {
  success?: boolean;
  message?: string;
  data?: {
    pincode?: string;
    state?: string;
    district?: string;
    city?: string;
    city_options?: string[];
    multiple_post_offices?: boolean;
    selected_post_office?: {
      name?: string;
      branch_type?: string;
      delivery_status?: string;
      district?: string;
      state?: string;
      region?: string;
      division?: string;
      circle?: string;
      taluk?: string;
      block?: string;
      country?: string;
      pincode?: string;
    };
    post_offices?: Array<{
      name?: string;
      branch_type?: string;
      delivery_status?: string;
      district?: string;
      state?: string;
      region?: string;
      division?: string;
      circle?: string;
      taluk?: string;
      block?: string;
      country?: string;
      pincode?: string;
    }>;
  };
};

const DEFAULT_STATE_CITY_MAP: Record<string, string[]> = {
  "Andhra Pradesh": ["Vijayawada", "Guntur", "Visakhapatnam"],
  Telangana: ["Hyderabad", "Warangal", "Karimnagar"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai"],
  Karnataka: ["Bengaluru", "Mysuru", "Mangaluru"],
  Maharashtra: ["Mumbai", "Pune", "Nagpur"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara"],
  Rajasthan: ["Jaipur", "Jodhpur", "Kota"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior"],
  Kerala: ["Kochi", "Thiruvananthapuram", "Kozhikode"],
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiPostJson<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "POST",
    body: formData,
  });
}

async function apiPutJson<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

function fieldStyle(hasError = false) {
  return {
    width: "100%",
    minHeight: 40,
    border: `1px solid ${hasError ? "#dc2626" : "var(--line)"}`,
    borderRadius: 10,
    padding: "10px 12px",
    lineHeight: 1.3,
    background: "#fff",
  } as const;
}

function helperTextStyle() {
  return {
    margin: "4px 0 0",
    color: "#64748b",
    fontSize: 12,
    lineHeight: 1.4,
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
    minHeight: 40,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 10,
    padding: "0 14px",
    cursor: "pointer",
    fontWeight: 600,
    fontSize: 14,
  } as const;
}

function parseError(error: unknown) {
  const apiError = error as ApiError;
  const message = apiError?.details?.message;
  if (message) return message;
  if (error instanceof Error && error.message) return error.message;
  return "Unable to save student.";
}

function parsePincodeError(error: unknown): string {
  const apiError = error as ApiError;
  const fieldError = apiError?.details?.field_errors?.pincode;
  if (Array.isArray(fieldError) && fieldError.length > 0) return String(fieldError[0] || "").trim();
  if (typeof fieldError === "string") return fieldError.trim();
  if (apiError?.details?.message) return apiError.details.message.trim();
  if (error instanceof Error && error.message) return error.message.trim();
  return "";
}

function sanitizeText(value: string): string {
  return value.replace(/<[^>]*>/g, "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

function isValidPhone(phone: string): boolean {
  return /^\d{10}$/.test(phone.trim());
}

function isValidPincode(pincode: string): boolean {
  return /^\d{6}$/.test(pincode.trim());
}

function isLikelyValidClassName(value: string): boolean {
  const clean = sanitizeText(value);
  const lowered = clean.toLowerCase();
  if (!clean || clean.length < 2) return false;
  if (["abc", "adc", "asdf", "test", "demo"].includes(lowered)) return false;
  return /[A-Za-z0-9]/.test(clean);
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

async function compressImage(file: File, maxWidth = 1200, quality = 0.8): Promise<File> {
  const src = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Unable to read image."));
    reader.readAsDataURL(file);
  });

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Invalid image."));
    image.src = src;
  });

  let width = img.width;
  let height = img.height;
  if (width > maxWidth) {
    height = Math.round((height * maxWidth) / width);
    width = maxWidth;
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Image processing is not supported in this browser.");
  ctx.drawImage(img, 0, 0, width, height);

  const outputType = file.type === "image/png" ? "image/png" : "image/jpeg";
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, outputType, quality));
  if (!blob) throw new Error("Failed to compress image.");

  return new File([blob], file.name.replace(/\s+/g, "_"), { type: outputType });
}

export function StudentAddPanel() {
  const searchParams = useSearchParams();
  const modeParam = (searchParams.get("mode") || "add").toLowerCase();
  const isViewMode = modeParam === "view";
  const isEditMode = modeParam === "edit";
  const studentIdParam = searchParams.get("id") || "";
  const studentId = /^\d+$/.test(studentIdParam) ? Number(studentIdParam) : null;
  const isExistingStudentMode = Boolean(studentId && (isViewMode || isEditMode));

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
  const [district, setDistrict] = useState("");
  const [stateName, setStateName] = useState("");
  const [pincode, setPincode] = useState("");
  const [photo, setPhoto] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [photoUploading, setPhotoUploading] = useState(false);
  const [statusValue, setStatusValue] = useState<"active" | "inactive" | "transferred" | "dropped">("active");
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
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionLoadError, setSectionLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [guardianValidationError, setGuardianValidationError] = useState("");
  const [checkingAdmission, setCheckingAdmission] = useState(false);
  const [admissionChecked, setAdmissionChecked] = useState(false);
  const [pinLookupLoading, setPinLookupLoading] = useState(false);
  const [pinLookupMessage, setPinLookupMessage] = useState("");
  const [cityLoading, setCityLoading] = useState(false);
  const [cityOptions, setCityOptions] = useState<string[]>([]);
  const [stateCityMap, setStateCityMap] = useState<Record<string, string[]>>(DEFAULT_STATE_CITY_MAP);
  const [manualAddressMode, setManualAddressMode] = useState(false);
  const [lastPinLookup, setLastPinLookup] = useState("");
  const [pendingSectionId, setPendingSectionId] = useState("");

  const pinIsValid = /^\d{6}$/.test(pincode.trim());

  const validAcademicYears = useMemo(
    () => academicYears.filter((item) => /^\d{4}-\d{4}$/.test(String(item.name || "").trim())),
    [academicYears],
  );

  const validCategories = useMemo(
    () =>
      categories.filter((item) => {
        const name = String(item.name || "").trim();
        const lowered = name.toLowerCase();
        if (!name || name.length < 2) return false;
        if (["abc", "asdf", "gk", "test", "demo"].includes(lowered)) return false;
        return /^[A-Za-z0-9][A-Za-z0-9 ]{1,99}$/.test(name);
      }),
    [categories],
  );

  const validClasses = useMemo(
    () =>
      classes.filter((item) => {
        const name = String(item.name || "");
        return isLikelyValidClassName(name);
      }),
    [classes],
  );

  const stateOptions = useMemo(() => Object.keys(stateCityMap).sort((a, b) => a.localeCompare(b)), [stateCityMap]);

  const canSubmit = !loading && !saving && !photoUploading && !sectionLoading && !classId ? false : !loading && !saving && !photoUploading && !sectionLoading;

  const loadBaseLookups = async () => {
    try {
      setLoading(true);
      setError("");
      const [yearData, categoryData, guardianData, classData] = await Promise.all([
        apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/?page_size=200"),
        apiGet<ApiList<StudentCategory>>("/api/v1/students/categories/?page_size=200"),
        apiGet<ApiList<Guardian>>("/api/v1/students/guardians/?page_size=200"),
        apiGet<ApiList<SchoolClass>>("/api/v1/core/classes/?page_size=200"),
      ]);
      setAcademicYears(listData(yearData));
      setCategories(listData(categoryData));
      setGuardians(listData(guardianData));
      setClasses(listData(classData));
    } catch (loadError) {
      setError(parseError(loadError));
    } finally {
      setLoading(false);
    }
  };

  const loadSectionsForClass = async (targetClassId: string) => {
    if (!targetClassId) {
      setSections([]);
      setSectionId("");
      setSectionLoadError("");
      return;
    }

    try {
      setSectionLoading(true);
      setSectionLoadError("");
      setSections([]);
      setSectionId("");
      const data = await apiGet<ApiList<Section>>(`/api/v1/core/sections/?class=${encodeURIComponent(targetClassId)}&page_size=200`);
      setSections(listData(data));
    } catch (loadError) {
      setSections([]);
      setSectionLoadError(parseError(loadError) || "Unable to load sections for selected class.");
    } finally {
      setSectionLoading(false);
    }
  };

  const loadStudentForMode = async (targetStudentId: number) => {
    const data = await apiGet<StudentDetail>(`/api/v1/students/students/${targetStudentId}/`);
    setAdmissionNo(String(data.admission_no || ""));
    setRollNo(String(data.roll_no || ""));
    setFirstName(String(data.first_name || ""));
    setLastName(String(data.last_name || ""));
    setDateOfBirth(String(data.date_of_birth || ""));
    setAcademicYearId(data.academic_year ? String(data.academic_year) : "");
    setGender(String(data.gender || "male"));
    setCustomGender(String(data.custom_gender || ""));
    setBloodGroup(String(data.blood_group || ""));
    setPhone(String(data.phone || ""));
    setEmail(String(data.email || ""));
    setAddressLine(String(data.address_line || ""));
    setCity(String(data.city || ""));
    setDistrict(String(data.district || ""));
    setStateName(String(data.state || ""));
    setPincode(String(data.pincode || ""));
    setPhoto(String(data.photo || ""));
    setPhotoName(data.photo ? "Uploaded photo" : "");
    setStatusValue(data.status || "active");
    setCategoryId(data.category ? String(data.category) : "");
    setGuardianId(data.guardian ? String(data.guardian) : "");
    const nextClassId = data.current_class ? String(data.current_class) : "";
    const nextSectionId = data.current_section ? String(data.current_section) : "";
    setClassId(nextClassId);
    setPendingSectionId(nextSectionId);
    setIsDisabled(Boolean(data.is_disabled));
    setAdmissionChecked(true);
    setPinLookupMessage("");
  };

  const updateStateCityMap = (nextState: string, nextCities: string[]) => {
    const cleanState = sanitizeText(nextState);
    const cleanCities = Array.from(new Set(nextCities.map((value) => sanitizeText(value)).filter(Boolean)));
    if (!cleanState || cleanCities.length === 0) return;
    setStateCityMap((prev) => {
      const existing = prev[cleanState] || [];
      return {
        ...prev,
        [cleanState]: Array.from(new Set([...existing, ...cleanCities])).sort((a, b) => a.localeCompare(b)),
      };
    });
  };

  const loadCitiesForState = async (targetState: string) => {
    const cleanState = sanitizeText(targetState);
    if (!cleanState) {
      setCityOptions([]);
      setCity("");
      return;
    }

    setCityLoading(true);
    try {
      await new Promise((resolve) => window.setTimeout(resolve, 120));
      const uniqueOptions = Array.from(new Set(stateCityMap[cleanState] || [])).sort((a, b) => a.localeCompare(b));
      setCityOptions(uniqueOptions);
      setCity((prev) => (uniqueOptions.includes(prev) ? prev : uniqueOptions[0] || ""));
    } finally {
      setCityLoading(false);
    }
  };

  const lookupAddressByPincode = async (pinCode: string) => {
    const pin = pinCode.trim();
    if (!/^\d{6}$/.test(pin) || pin === lastPinLookup) return;

    setPinLookupLoading(true);
    setPinLookupMessage("");
    setSingleFieldError("pincode", "");
    setLastPinLookup(pin);

    try {
      const response = await apiGet<PincodeLookupResponse>(`/api/v1/students/students/pincode-details/?pincode=${encodeURIComponent(pin)}`);
      const data = response.data;
      const resolvedState = sanitizeText(String(data?.state || ""));
      const resolvedDistrict = sanitizeText(String(data?.district || ""));
      const resolvedCity = sanitizeText(String(data?.city || ""));
      const resolvedCityOptions = Array.from(new Set((data?.city_options || []).map((value) => sanitizeText(String(value))).filter(Boolean)));

      if (!response.success || !resolvedState || !resolvedDistrict || (!resolvedCity && resolvedCityOptions.length === 0)) {
        setSingleFieldError("pincode", "Invalid PIN Code");
        setPinLookupMessage("Invalid PIN Code");
        setManualAddressMode(true);
        setStateName("");
        setDistrict("");
        setCity("");
        setCityOptions([]);
        return;
      }

      updateStateCityMap(resolvedState, resolvedCityOptions.length > 0 ? resolvedCityOptions : [resolvedCity]);
      setManualAddressMode(false);
      setStateName(resolvedState);
      setDistrict(resolvedDistrict);

      const nextCities = resolvedCityOptions.length > 0 ? resolvedCityOptions : [resolvedCity];
      setCityOptions(nextCities);
      setCity(nextCities.includes(resolvedCity) ? resolvedCity : nextCities[0]);

      setPinLookupMessage(
        data?.multiple_post_offices
          ? `Address auto-filled from PIN code. Multiple post offices found; first city selected.`
          : "Address auto-filled from PIN code.",
      );
      setSingleFieldError("pincode", "");
      setSingleFieldError("state", "");
      setSingleFieldError("district", "");
      setSingleFieldError("city", "");
    } catch (error) {
      const message = parsePincodeError(error) || "Could not auto-fetch address. Please enter State, District, and City manually.";
      if (/invalid pin code/i.test(message)) {
        setSingleFieldError("pincode", "Invalid PIN Code");
        setPinLookupMessage("Invalid PIN Code");
        setStateName("");
        setDistrict("");
        setCity("");
        setCityOptions([]);
      } else {
        setPinLookupMessage(message.includes("Pincode must be exactly 6 digits") ? message : "Could not auto-fetch address. Please enter State, District, and City manually.");
      }
      setManualAddressMode(true);
    } finally {
      setPinLookupLoading(false);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      try {
        await loadBaseLookups();
        if (isExistingStudentMode && studentId) {
          await loadStudentForMode(studentId);
        }
      } catch (loadError) {
        setError(parseError(loadError));
      }
    };
    void loadAll();
  }, []);

  useEffect(() => {
    if (!classId) {
      setSections([]);
      setSectionId("");
      return;
    }
    void loadSectionsForClass(classId);
  }, [classId]);

  useEffect(() => {
    if (!pendingSectionId || sections.length === 0) return;
    const matched = sections.some((row) => String(row.id) === pendingSectionId);
    if (matched) {
      setSectionId(pendingSectionId);
      setPendingSectionId("");
    }
  }, [pendingSectionId, sections]);

  useEffect(() => {
    if (!/^\d{6}$/.test(pincode.trim())) {
      setPinLookupMessage("");
      setLastPinLookup("");
      setStateName("");
      setDistrict("");
      setCity("");
      setCityOptions([]);
      return;
    }

    const timer = window.setTimeout(() => {
      void lookupAddressByPincode(pincode);
    }, 400);

    return () => window.clearTimeout(timer);
  }, [pincode]);

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
    setDistrict("");
    setStateName("");
    setPincode("");
    setPhoto("");
    setPhotoName("");
    setStatusValue("active");
    setCategoryId("");
    setGuardianId("");
    setClassId("");
    setSectionId("");
    setSections([]);
    setIsDisabled(false);
    setFieldErrors({});
    setAdmissionChecked(false);
    setPinLookupMessage("");
    setPinLookupLoading(false);
    setCityLoading(false);
    setCityOptions([]);
    setStateCityMap(DEFAULT_STATE_CITY_MAP);
    setManualAddressMode(false);
    setLastPinLookup("");
  };

  const setSingleFieldError = (field: string, message: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  const runAdmissionAvailabilityCheck = async (valueOverride?: string): Promise<boolean> => {
    const value = sanitizeText(typeof valueOverride === "string" ? valueOverride : admissionNo);
    setAdmissionChecked(false);
    if (!value) {
      setSingleFieldError("admission_no", "Admission number is required");
      return false;
    }
    if (!isValidAdmissionOrRoll(value)) {
      setSingleFieldError("admission_no", "Admission number should contain only letters and numbers");
      return false;
    }

    try {
      setCheckingAdmission(true);
      const query = new URLSearchParams({ admission_no: value });
      if (isEditMode && studentId) query.set("exclude_id", String(studentId));
      const payload = await apiGet<{ exists: boolean }>(`/api/v1/students/students/check-admission-no/?${query.toString()}`);
      if (payload.exists) {
        setSingleFieldError("admission_no", "Admission number already exists");
        setAdmissionChecked(false);
        return false;
      } else {
        setSingleFieldError("admission_no", "");
        setAdmissionChecked(true);
        return true;
      }
    } catch {
      setSingleFieldError("admission_no", "Unable to verify admission number right now");
      return false;
    } finally {
      setCheckingAdmission(false);
    }
  };

  const validateClient = () => {
    const nextErrors: Record<string, string> = {};

    const validatePhoneInline = (value: string) => {
      if (!value.trim()) return "Phone number is required";
      if (!isValidPhone(value)) return "Phone number must be exactly 10 digits";
      return "";
    };

    if (!sanitizeText(admissionNo)) {
      nextErrors.admission_no = "Admission number is required";
    } else if (!isValidAdmissionOrRoll(admissionNo)) {
      nextErrors.admission_no = "Admission number should contain only letters and numbers";
    }

    if (rollNo.trim() && !isValidNumericRoll(rollNo)) {
      nextErrors.roll_no = "Roll number must contain numbers only";
    }

    const cleanFirstName = sanitizeText(firstName);
    const cleanLastName = sanitizeText(lastName);
    if (!cleanFirstName) nextErrors.first_name = "First name is required";
    else if (!isAlphabetsOnly(cleanFirstName)) nextErrors.first_name = "First name can contain only letters, spaces, apostrophe, and hyphen";

    if (!cleanLastName) nextErrors.last_name = "Last name is required";
    else if (!isAlphabetsOnly(cleanLastName)) nextErrors.last_name = "Last name can contain only letters, spaces, apostrophe, and hyphen";

    if (!dateOfBirth) nextErrors.dob = "Date of birth is required";
    else {
      const dobDate = new Date(dateOfBirth);
      const now = new Date();
      if (dobDate > now) {
        nextErrors.dob = "Date of birth cannot be in the future";
      } else {
        const age = (now.getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age < 3) nextErrors.dob = "Student must be at least 3 years old";
        const selectedClass = validClasses.find((item) => String(item.id) === classId);
        const className = String(selectedClass?.name || "");
        const classMatch = className.match(/\d+/);
        const classNumber = classMatch ? Number(classMatch[0]) : null;
        if (classNumber && CLASS_AGE_RULES[classNumber]) {
          const [minAge, maxAge] = CLASS_AGE_RULES[classNumber];
          if (age < minAge || age > maxAge) {
            nextErrors.dob = `Expected age for selected class is ${minAge}-${maxAge} years`;
          }
        }
      }
    }

    if (!academicYearId) nextErrors.academic_year = "Academic year is required";
    else if (!validAcademicYears.some((row) => String(row.id) === academicYearId)) nextErrors.academic_year = "Please select a valid academic year";

    if (!gender) nextErrors.gender = "Gender is required";
    if (gender === "other" && !sanitizeText(customGender)) nextErrors.custom_gender = "Please specify custom gender";

    if (!classId) nextErrors.class = "Class is required";
    else if (!validClasses.some((row) => String(row.id) === classId)) nextErrors.class = "Please select a valid class";
    if (!sectionId) nextErrors.section = "Section is required";
    else if (!sections.some((item) => String(item.id) === sectionId)) nextErrors.section = "Selected section is invalid";

    const phoneError = validatePhoneInline(phone);
    if (phoneError) nextErrors.phone = phoneError;

    if (!sanitizeText(stateName)) nextErrors.state = "State is required";
    if (!sanitizeText(district)) nextErrors.district = "District is required";
    if (!sanitizeText(city)) nextErrors.city = "City is required";
    if (email.trim() && !isValidEmail(email)) nextErrors.email = "Please enter a valid email address";
    if (pincode.trim() && !isValidPincode(pincode)) nextErrors.pincode = "Pincode must be exactly 6 digits";

    if (categoryId && !validCategories.some((row) => String(row.id) === categoryId)) {
      nextErrors.category = "Please select a valid category";
    }

    if (classId && sectionLoading) nextErrors.section = "Please wait until sections are loaded";
    if (classId && !sectionLoading && sections.length === 0) nextErrors.section = "No sections found for selected class. Use refresh.";

    return nextErrors;
  };

  const syncApiFieldErrors = (apiError: ApiError) => {
    const source = apiError.details?.field_errors || {};
    const mapped: Record<string, string> = {};
    for (const [field, value] of Object.entries(source)) {
      const mappedField = field === "date_of_birth" ? "dob" : field === "current_class" ? "class" : field === "current_section" ? "section" : field;
      mapped[mappedField] = Array.isArray(value) ? String(value[0] || "") : String(value || "");
    }
    setFieldErrors(mapped);
  };

  const addGuardianInline = async () => {
    setGuardianValidationError("");
    const guardianName = sanitizeText(newGuardianName);
    const guardianPhone = newGuardianPhone.replace(/\D/g, "").slice(0, 10);

    if (!guardianName) {
      setGuardianValidationError("Guardian name is required");
      return;
    }
    if (!isAlphabetsOnly(guardianName)) {
      setGuardianValidationError("Guardian name can only contain letters and spaces");
      return;
    }
    if (!guardianPhone || !isValidPhone(guardianPhone)) {
      setGuardianValidationError("Guardian phone must be exactly 10 digits");
      return;
    }
    if (newGuardianEmail.trim() && !isValidEmail(newGuardianEmail.trim())) {
      setGuardianValidationError("Guardian email format is invalid");
      return;
    }

    try {
      setError("");
      const created = await apiPostJson<Guardian>("/api/v1/students/guardians/", {
        full_name: guardianName,
        relation: sanitizeText(newGuardianRelation) || "Father",
        phone: guardianPhone,
        email: sanitizeText(newGuardianEmail),
      });
      setGuardians((prev) => [...prev, created]);
      setGuardianId(String(created.id));
      setNewGuardianName("");
      setNewGuardianRelation("Father");
      setNewGuardianPhone("");
      setNewGuardianEmail("");
      setSuccess("Guardian added and selected successfully.");
    } catch (createError) {
      setGuardianValidationError(parseError(createError));
    }
  };

  const uploadStudentPhoto = async (file: File) => {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setSingleFieldError("photo", "Only JPEG and PNG files are allowed");
      return;
    }
    if (file.size > 4 * 1024 * 1024) {
      setSingleFieldError("photo", "Please choose an image up to 4MB before compression");
      return;
    }

    try {
      setPhotoUploading(true);
      setSingleFieldError("photo", "");
      const compressed = await compressImage(file);
      const formData = new FormData();
      formData.append("photo", compressed);
      const res = await apiPostForm<{ data?: { photo?: string } }>("/api/v1/students/students/upload-photo/", formData);
      const uploadedUrl = String(res?.data?.photo || "");
      if (!uploadedUrl) throw new Error("Photo upload failed");
      setPhoto(uploadedUrl);
      setPhotoName(file.name);
      setSuccess("Photo uploaded securely.");
    } catch (uploadError) {
      setSingleFieldError("photo", parseError(uploadError));
      setPhoto("");
      setPhotoName("");
    } finally {
      setPhotoUploading(false);
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isViewMode) return;
    setSuccess("");
    setError("");
    setGuardianValidationError("");

    const nextErrors = validateClient();
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError(`Please fix ${Object.keys(nextErrors).length} validation error(s).`);
      return;
    }

    if (!admissionChecked) {
      const ok = await runAdmissionAvailabilityCheck();
      if (!ok) {
        setError("Please resolve admission number validation first.");
        return;
      }
    }

    try {
      setSaving(true);
      const isStudentActive = !isDisabled && statusValue === "active";
      const payload: StudentCreatePayload = {
        admission_no: sanitizeText(admissionNo),
        roll_no: rollNo.trim() || undefined,
        first_name: sanitizeText(firstName),
        last_name: sanitizeText(lastName),
        date_of_birth: dateOfBirth || undefined,
        academic_year: Number(academicYearId),
        gender,
        custom_gender: gender === "other" ? sanitizeText(customGender) : undefined,
        blood_group: bloodGroup.trim() || undefined,
        phone: phone.trim() || undefined,
        email: sanitizeText(email) || undefined,
        address_line: sanitizeText(addressLine) || undefined,
        city: sanitizeText(city) || undefined,
        district: sanitizeText(district) || undefined,
        state: sanitizeText(stateName) || undefined,
        pincode: pincode.trim() || undefined,
        photo: photo || undefined,
        status: statusValue,
        category: categoryId ? Number(categoryId) : undefined,
        guardian: guardianId ? Number(guardianId) : undefined,
        current_class: Number(classId),
        current_section: Number(sectionId),
        is_disabled: isDisabled,
        is_active: isStudentActive,
      };

      if (isEditMode && studentId) {
        await apiPutJson<{ message?: string }>(`/api/v1/students/students/${studentId}/`, payload);
        setSuccess("Student updated successfully.");
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = "/students/list";
          }
        }, 800);
      } else {
        const response = await apiPostJson<{ message?: string; warning?: string }>("/api/v1/students/students/", payload);
        setSuccess(response?.warning ? `Student added successfully. ${response.warning}` : "Student added successfully.");
        resetStudentForm();
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = "/students/list";
          }
        }, 1200);
      }
    } catch (submitError) {
      syncApiFieldErrors(submitError as ApiError);
      setError(parseError(submitError));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="legacy-panel student-add-panel-wrap">
      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>
              {isViewMode ? "View Student" : isEditMode ? "Edit Student" : "Add Student"}
            </h1>
            <div style={{ display: "grid", gap: 8, justifyItems: "end" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <Link href="/students/list" style={{ ...buttonStyle("#0f766e"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Student List
                </Link>
                <Link href="/students/multi-class" style={{ ...buttonStyle("#1d4ed8"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Student Subject Assignment
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_st_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 12 }}>
          <form onSubmit={submit} noValidate>
            <p style={{ margin: "0 0 12px", color: "#334155", fontSize: 13 }}>
              Required fields are marked with *.
            </p>

            <fieldset disabled={isViewMode} style={{ border: 0, margin: 0, padding: 0 }}>
            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Basic Information</h3>
              <div className="student-grid">
                <div className="field-admission" data-field="admission_no">
                  <label htmlFor="admission_no" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Admission No *</label>
                  <input
                    id="admission_no"
                    value={admissionNo}
                    onChange={(e) => {
                      setAdmissionNo(e.target.value);
                      setAdmissionChecked(false);
                      setSingleFieldError("admission_no", "");
                    }}
                    onBlur={() => void runAdmissionAvailabilityCheck()}
                    style={fieldStyle(Boolean(fieldErrors.admission_no))}
                    placeholder="e.g., ADM001"
                    aria-invalid={Boolean(fieldErrors.admission_no)}
                  />
                  <p style={helperTextStyle()}>Use letters and numbers only (example: ADM001).</p>
                  {checkingAdmission ? <p style={{ margin: "4px 0 0", color: "#1d4ed8", fontSize: 12 }}>Checking availability...</p> : null}
                  {fieldErrors.admission_no ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.admission_no}</p> : null}
                </div>

                <div data-field="roll_no">
                  <label htmlFor="roll_no" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Roll No</label>
                  <input
                    id="roll_no"
                    value={rollNo}
                    onChange={(e) => {
                      const value = e.target.value.replace(/\D/g, "");
                      setRollNo(value);
                      setSingleFieldError("roll_no", value && !isValidNumericRoll(value) ? "Roll number must contain numbers only" : "");
                    }}
                    style={fieldStyle(Boolean(fieldErrors.roll_no))}
                    inputMode="numeric"
                  />
                  <p style={helperTextStyle()}>Digits only. This can be auto-generated if left blank.</p>
                  {fieldErrors.roll_no ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.roll_no}</p> : null}
                </div>

                <div data-field="first_name">
                  <label htmlFor="first_name" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>First Name *</label>
                  <input id="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} style={fieldStyle(Boolean(fieldErrors.first_name))} />
                  {fieldErrors.first_name ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.first_name}</p> : null}
                </div>

                <div data-field="last_name">
                  <label htmlFor="last_name" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Last Name *</label>
                  <input id="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} style={fieldStyle(Boolean(fieldErrors.last_name))} />
                  {fieldErrors.last_name ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.last_name}</p> : null}
                </div>

                <div data-field="dob">
                  <label htmlFor="dob" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Date of Birth *</label>
                  <input id="dob" type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} style={fieldStyle(Boolean(fieldErrors.dob))} />
                  {fieldErrors.dob ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.dob}</p> : null}
                </div>

                <div data-field="academic_year">
                  <label htmlFor="academic_year" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Academic Year *</label>
                  <select id="academic_year" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)} style={fieldStyle(Boolean(fieldErrors.academic_year))}>
                    <option value="">Select Academic Year</option>
                    {validAcademicYears.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  <p style={helperTextStyle()}>Only valid academic years are listed.</p>
                  {fieldErrors.academic_year ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.academic_year}</p> : null}
                </div>

                <div data-field="gender">
                  <label htmlFor="gender" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Gender *</label>
                  <select id="gender" value={gender} onChange={(e) => setGender(e.target.value)} style={fieldStyle(Boolean(fieldErrors.gender))}>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                  {fieldErrors.gender ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.gender}</p> : null}
                </div>

                {gender === "other" ? (
                  <div data-field="custom_gender">
                    <label htmlFor="custom_gender" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Custom Gender *</label>
                    <input id="custom_gender" value={customGender} onChange={(e) => setCustomGender(e.target.value)} style={fieldStyle(Boolean(fieldErrors.custom_gender))} />
                    {fieldErrors.custom_gender ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.custom_gender}</p> : null}
                  </div>
                ) : null}

                <div>
                  <label htmlFor="blood_group" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Blood Group</label>
                  <select id="blood_group" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} style={fieldStyle()}>
                    <option value="">Select Blood Group</option>
                    {"A+,A-,B+,B-,AB+,AB-,O+,O-".split(",").map((bg) => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>

                <div data-field="category">
                  <label htmlFor="category" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Category</label>
                  <select id="category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} style={fieldStyle(Boolean(fieldErrors.category))}>
                    <option value="">Select Category</option>
                    {validCategories.map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                  </select>
                  {fieldErrors.category ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.category}</p> : null}
                </div>

                <div data-field="class">
                  <label htmlFor="class" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Class *</label>
                  <select
                    id="class"
                    value={classId}
                    onChange={(e) => setClassId(e.target.value)}
                    style={fieldStyle(Boolean(fieldErrors.class))}
                  >
                    <option value="">Select Class</option>
                    {validClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <p style={helperTextStyle()}>Only valid classes are listed.</p>
                  {fieldErrors.class ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.class}</p> : null}
                </div>

                <div data-field="section">
                  <label htmlFor="section" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Section *</label>
                  <select
                    id="section"
                    value={sectionId}
                    onChange={(e) => setSectionId(e.target.value)}
                    style={fieldStyle(Boolean(fieldErrors.section))}
                    disabled={!classId || sectionLoading}
                  >
                    <option value="">{classId ? (sectionLoading ? "Loading sections..." : "Select Section") : "Select class first"}</option>
                    {sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  {sectionLoadError ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{sectionLoadError}</p> : null}
                  {fieldErrors.section ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.section}</p> : null}
                </div>

                <div data-field="photo">
                  <label htmlFor="photo" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Student Photo (JPEG/PNG)</label>
                  <input
                    id="photo"
                    type="file"
                    accept="image/jpeg,image/png"
                    style={fieldStyle(Boolean(fieldErrors.photo))}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadStudentPhoto(file);
                    }}
                  />
                  {photoName ? <p style={{ margin: "4px 0 0", color: "#0f766e", fontSize: 12 }}>Uploaded: {photoName}</p> : null}
                  {fieldErrors.photo ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.photo}</p> : null}
                </div>

                <div>
                  <label htmlFor="status" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Status</label>
                  <select id="status" value={statusValue} onChange={(e) => setStatusValue(e.target.value as "active" | "inactive" | "transferred" | "dropped")} style={fieldStyle()}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                    <option value="transferred">Transferred</option>
                    <option value="dropped">Dropped</option>
                  </select>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 26 }}>
                  <label htmlFor="is_disabled" style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                    <input id="is_disabled" type="checkbox" checked={isDisabled} onChange={(e) => setIsDisabled(e.target.checked)} />
                    Mark student disabled
                  </label>
                </div>
              </div>
            </div>

            <div className="white-box" style={{ ...boxStyle(), marginTop: 12 }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Contact Information</h3>
              <div className="student-grid">
                <div data-field="phone">
                  <label htmlFor="phone" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Phone *</label>
                  <input
                    id="phone"
                    value={phone}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 10);
                      setPhone(value);
                      if (!value) {
                        setSingleFieldError("phone", "Phone number is required");
                      } else if (!isValidPhone(value)) {
                        setSingleFieldError("phone", "Phone number must be exactly 10 digits");
                      } else {
                        setSingleFieldError("phone", "");
                      }
                    }}
                    onBlur={() => {
                      if (!phone.trim()) {
                        setSingleFieldError("phone", "Phone number is required");
                      } else if (!isValidPhone(phone)) {
                        setSingleFieldError("phone", "Phone number must be exactly 10 digits");
                      } else {
                        setSingleFieldError("phone", "");
                      }
                    }}
                    style={fieldStyle(Boolean(fieldErrors.phone))}
                    inputMode="numeric"
                    maxLength={10}
                  />
                  <p style={helperTextStyle()}>Enter exactly 10 digits (numbers only).</p>
                  {fieldErrors.phone ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.phone}</p> : null}
                </div>

                <div data-field="email">
                  <label htmlFor="email" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Email</label>
                  <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={fieldStyle(Boolean(fieldErrors.email))} />
                  <p style={helperTextStyle()}>Optional, but recommended for school communication.</p>
                  {fieldErrors.email ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.email}</p> : null}
                </div>

                <div className="field-address">
                  <label htmlFor="address_line" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Address Line</label>
                  <input id="address_line" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} style={fieldStyle()} />
                  <p style={helperTextStyle()}>House no., street, and landmark.</p>
                </div>

                <div className="field-pincode" data-field="pincode">
                  <label htmlFor="pincode" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Pincode</label>
                  <input
                    id="pincode"
                    value={pincode}
                    onChange={(e) => {
                      const value = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
                      setPincode(value);
                      if (value.length < 6) {
                        setSingleFieldError("pincode", "");
                        setPinLookupMessage("");
                      }
                    }}
                    style={fieldStyle(Boolean(fieldErrors.pincode))}
                    inputMode="numeric"
                    maxLength={6}
                  />
                  <p style={helperTextStyle()}>Enter 6 digits to auto-fill State, District, and City.</p>
                  {pinLookupLoading ? <p style={{ margin: "4px 0 0", color: "#1d4ed8", fontSize: 12 }}>Fetching state, district, and city from PIN...</p> : null}
                  {pinLookupMessage ? <p style={{ margin: "4px 0 0", color: pinLookupMessage.includes("auto-filled") ? "#0f766e" : "#92400e", fontSize: 12 }}>{pinLookupMessage}</p> : null}
                  {fieldErrors.pincode ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.pincode}</p> : null}
                  <button
                    type="button"
                    style={{ ...buttonStyle("#475569"), minHeight: 34, marginTop: 6 }}
                    onClick={() => setManualAddressMode((prev) => !prev)}
                  >
                    {manualAddressMode ? "Use PIN Auto-Fill" : "Enter Address Manually"}
                  </button>
                </div>

                <div>
                  <label htmlFor="state" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>State *</label>
                  {manualAddressMode ? (
                    <input id="state" value={stateName} onChange={(e) => setStateName(e.target.value)} style={fieldStyle(Boolean(fieldErrors.state))} placeholder="Enter state" />
                  ) : (
                    <select
                      id="state"
                      value={stateName}
                      onChange={(e) => {
                        const nextState = e.target.value;
                        setStateName(nextState);
                        setDistrict("");
                        setCity("");
                        void loadCitiesForState(nextState);
                      }}
                      style={fieldStyle(Boolean(fieldErrors.state))}
                      disabled={!pinIsValid}
                    >
                      <option value="">Select State</option>
                      {stateOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  )}
                  {fieldErrors.state ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.state}</p> : null}
                </div>

                <div>
                  <label htmlFor="district" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>District *</label>
                  <input
                    id="district"
                    value={district}
                    onChange={(e) => setDistrict(e.target.value)}
                    style={fieldStyle(Boolean(fieldErrors.district))}
                    placeholder={pinLookupLoading ? "Fetching district from PIN..." : "Enter district"}
                    disabled={!manualAddressMode && !pinIsValid}
                  />
                  {fieldErrors.district ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.district}</p> : null}
                </div>

                <div>
                  <label htmlFor="city" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>City *</label>
                  {manualAddressMode || cityOptions.length === 0 ? (
                    <input
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={fieldStyle(Boolean(fieldErrors.city))}
                      placeholder={cityLoading ? "Loading cities..." : "Enter city"}
                      disabled={!manualAddressMode && !pinIsValid}
                    />
                  ) : (
                    <select
                      id="city"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={fieldStyle(Boolean(fieldErrors.city))}
                      disabled={cityLoading || !pinIsValid}
                    >
                      <option value="">{cityLoading ? "Loading cities..." : "Select City"}</option>
                      {cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}
                    </select>
                  )}
                  {cityLoading ? <p style={{ margin: "4px 0 0", color: "#1d4ed8", fontSize: 12 }}>Loading city list...</p> : null}
                  {fieldErrors.city ? <p style={{ margin: "4px 0 0", color: "#dc2626", fontSize: 12 }}>{fieldErrors.city}</p> : null}
                </div>
              </div>
            </div>

            <div className="white-box" style={{ ...boxStyle(), marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
                <h3 style={{ marginTop: 0, marginBottom: 8 }}>Guardian Details</h3>
                <span style={{ color: "#475569", fontSize: 12 }}>Optional: add guardian now or link later from guardian module.</span>
              </div>
              <div className="student-grid">
                <div>
                  <label htmlFor="guardian_select" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Select Existing Guardian</label>
                  <select id="guardian_select" value={guardianId} onChange={(e) => setGuardianId(e.target.value)} style={fieldStyle()}>
                    <option value="">Select Guardian</option>
                    {guardians.map((g) => <option key={g.id} value={g.id}>{g.full_name} ({g.phone})</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor="new_guardian_name" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Guardian Name</label>
                  <input id="new_guardian_name" value={newGuardianName} onChange={(e) => setNewGuardianName(e.target.value)} style={fieldStyle()} />
                </div>
                <div>
                  <label htmlFor="new_guardian_relation" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Relation</label>
                  <select id="new_guardian_relation" value={newGuardianRelation} onChange={(e) => setNewGuardianRelation(e.target.value)} style={fieldStyle()}>
                    <option value="Father">Father</option>
                    <option value="Mother">Mother</option>
                    <option value="Others">Others</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="new_guardian_phone" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Phone</label>
                  <input id="new_guardian_phone" value={newGuardianPhone} onChange={(e) => setNewGuardianPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} maxLength={10} style={fieldStyle()} />
                </div>
                <div>
                  <label htmlFor="new_guardian_email" style={{ display: "block", marginBottom: 6, fontSize: 13 }}>Email</label>
                  <input id="new_guardian_email" type="email" value={newGuardianEmail} onChange={(e) => setNewGuardianEmail(e.target.value)} style={fieldStyle()} />
                </div>
              </div>

              <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button type="button" onClick={() => void addGuardianInline()} style={buttonStyle("#0f766e")}>Add Guardian</button>
              </div>
              {guardianValidationError ? <p style={{ margin: "8px 0 0", color: "#dc2626", fontSize: 12 }}>{guardianValidationError}</p> : null}
            </div>
            </fieldset>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 20, gap: 12, flexWrap: "wrap" }}>
              <Link href="/students/list" style={{ ...buttonStyle("#6b7280"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                Cancel
              </Link>
              {isViewMode && studentId ? (
                <Link href={`/students/add?mode=edit&id=${studentId}`} style={{ ...buttonStyle("#1d4ed8"), display: "inline-flex", alignItems: "center", textDecoration: "none" }}>
                  Edit Student
                </Link>
              ) : (
                <button type="submit" disabled={!canSubmit} style={{ ...buttonStyle("#1d4ed8"), opacity: !canSubmit ? 0.6 : 1 }}>
                  {saving ? "Saving..." : isEditMode ? "Update Student" : "Save Student"}
                </button>
              )}
            </div>
          </form>

          {loading ? (
            <div style={{ margin: 0, color: "var(--text-muted)", fontSize: 14, textAlign: "center", padding: "12px" }}>Loading form data...</div>
          ) : null}
          {error ? (
            <div style={{ margin: 0, color: "#b91c1c", fontSize: 13, backgroundColor: "#fee2e2", padding: "12px", borderRadius: 8, border: "1px solid #fecaca", fontWeight: 500 }}>
              {error}
            </div>
          ) : null}
          {success ? (
            <div style={{ margin: 0, color: "#065f46", fontSize: 13, backgroundColor: "#d1fae5", padding: "12px", borderRadius: 8, border: "1px solid #a7f3d0", fontWeight: 500 }}>
              {success}
            </div>
          ) : null}
        </div>
      </section>

      <style jsx>{`
        .student-add-panel-wrap {
          overflow-x: hidden;
        }

        .student-grid {
          display: grid;
          grid-template-columns: repeat(4, minmax(190px, 1fr));
          gap: 12px;
        }

        .field-address {
          grid-column: span 2;
        }

        .field-admission,
        .field-pincode {
          grid-column: span 1;
        }

        input:focus,
        select:focus,
        button:focus,
        a:focus {
          outline: 3px solid #93c5fd;
          outline-offset: 1px;
        }

        @media (max-width: 1100px) {
          .student-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
          }

          .field-address {
            grid-column: span 2;
          }
        }

        @media (max-width: 640px) {
          .student-grid {
            grid-template-columns: 1fr;
          }

          .field-address,
          .field-admission,
          .field-pincode {
            grid-column: span 1;
          }
        }
      `}</style>
    </div>
  );
}
