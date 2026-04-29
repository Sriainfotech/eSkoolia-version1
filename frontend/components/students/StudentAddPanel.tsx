"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { StudentDocumentsUpload, type DocumentType as DocumentTypeKey } from "./StudentDocumentsUpload";
import {
  StudentGuardiansStep,
  makeEmptyGuardianDraft,
  type GuardianDraft,
  type GuardianFieldErrors,
} from "./StudentGuardiansStep";

type ApiList<T> = T[] | { results?: T[]; count?: number };

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
  is_draft?: boolean;
};

type StudentCreateResponse = {
  id?: number;
  message?: string;
  warning?: string;
  data?: {
    id?: number;
  };
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
  status?: number;
};

type MePayload = {
  id?: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
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

const CLASS_ORDER = ["LKG", "UKG", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

const MOTHER_TONGUES = [
  "Hindi",
  "English",
  "Bengali",
  "Telugu",
  "Marathi",
  "Tamil",
  "Urdu",
  "Gujarati",
  "Kannada",
  "Malayalam",
  "Odia",
  "Punjabi",
  "Assamese",
  "Maithili",
  "Sanskrit",
  "Konkani",
  "Nepali",
  "Sindhi",
  "Dogri",
  "Manipuri",
  "Bodo",
  "Santali",
  "Kashmiri",
  "Other",
];

const NAV_ITEMS = [
  { id: "identity", label: "Identity", description: "Basic profile, DOB, photo", index: 1 },
  { id: "academic", label: "Academic", description: "Class, section, year", index: 2 },
  { id: "contact", label: "Contact & address", description: "Phone, email, location", index: 3 },
  { id: "guardians", label: "Guardians", description: "Parent/guardian details", index: 4 },
  { id: "documents", label: "Documents", description: "Consent and student records", index: 5 },
  { id: "review", label: "Review", description: "Final check before submit", index: 6 },
] as const;

type NavItemId = (typeof NAV_ITEMS)[number]["id"];

const CLASS_AGE_RULES_STRICT: Record<string, { min: number; max: number }> = {
  LKG: { min: 3.5, max: 5.5 },
  UKG: { min: 4.5, max: 6.5 },
  "1": { min: 5.5, max: 7.5 },
  "2": { min: 6.5, max: 8.5 },
  "3": { min: 7.5, max: 9.5 },
  "4": { min: 8.5, max: 10.5 },
  "5": { min: 9.5, max: 11.5 },
  "6": { min: 10.5, max: 12.5 },
  "7": { min: 11.5, max: 13.5 },
  "8": { min: 12.5, max: 14.5 },
  "9": { min: 13.5, max: 15.5 },
  "10": { min: 14.5, max: 16.5 },
  "11": { min: 15.5, max: 18 },
  "12": { min: 16.5, max: 19 },
};

function toTitleCase(value: string): string {
  return value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatDobDisplayFromISO(value: string): string {
  if (!value) return "";
  const parts = value.split("-");
  if (parts.length !== 3) return "";
  return `${parts[2]} / ${parts[1]} / ${parts[0]}`;
}

function toDobMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 8);
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  if (digits.length <= 2) return dd;
  if (digits.length <= 4) return `${dd} / ${mm}`;
  return `${dd} / ${mm} / ${yyyy}`;
}

function parseDobMaskedToISO(masked: string): string {
  const digits = masked.replace(/\D/g, "");
  if (digits.length !== 8) return "";
  const dd = digits.slice(0, 2);
  const mm = digits.slice(2, 4);
  const yyyy = digits.slice(4, 8);
  const date = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";
  if (date.getFullYear() !== Number(yyyy) || date.getMonth() + 1 !== Number(mm) || date.getDate() !== Number(dd)) return "";
  return `${yyyy}-${mm}-${dd}`;
}

function getDraftTimeAgoText(dateValue: number | null): string {
  if (!dateValue) return "Draft not saved yet";
  const diffMs = Math.max(0, Date.now() - dateValue);
  const mins = Math.max(0, Math.floor(diffMs / 60000));
  if (mins < 1) return "Draft saved just now";
  if (mins === 1) return "Draft saved 1m ago";
  return `Draft saved ${mins}m ago`;
}

let cachedGeneratedAdmissionNo: string | null = null;
let pendingAdmissionNoRequest: Promise<string> | null = null;

function isProgressFieldFilled(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value === "string") return value.trim().length > 0;
  return Boolean(value);
}

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

async function fetchAllPages<T>(basePath: string, pageSize = 100): Promise<T[]> {
  let page = 1;
  const rows: T[] = [];
  while (page <= 50) {
    const separator = basePath.includes("?") ? "&" : "?";
    const payload = await apiGet<ApiList<T>>(`${basePath}${separator}page=${page}&page_size=${pageSize}`);
    const items = listData(payload);
    rows.push(...items);
    if (items.length < pageSize) break;
    page += 1;
  }
  return rows;
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

async function apiPutJson<T>(path: string, payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method: "PUT",
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

async function fetchNextAdmissionNoFromApi(): Promise<string> {
  if (cachedGeneratedAdmissionNo) {
    return cachedGeneratedAdmissionNo;
  }

  if (!pendingAdmissionNoRequest) {
    pendingAdmissionNoRequest = (async () => {
      const payload = await apiGet<{ success?: boolean; admission_no?: string }>("/api/v1/students/students/next-admission-no/");
      const admissionNo = String(payload?.admission_no || "").trim();
      if (!admissionNo) {
        throw new Error("Unable to fetch next admission number.");
      }
      cachedGeneratedAdmissionNo = admissionNo;
      return admissionNo;
    })();
  }

  try {
    return await pendingAdmissionNoRequest;
  } finally {
    pendingAdmissionNoRequest = null;
  }
}

function invalidateGeneratedAdmissionNoCache(): void {
  cachedGeneratedAdmissionNo = null;
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
  return "Unable to complete request.";
}

function getErrorStatus(error: unknown): number | null {
  const apiError = error as ApiError;
  if (typeof apiError?.status === "number") {
    return apiError.status;
  }
  if (error instanceof Error) {
    const match = error.message.match(/status\s+(\d{3})/i);
    if (match) {
      return Number(match[1]);
    }
  }
  return null;
}

function parseEnrollmentSaveError(error: unknown): string {
  const fieldMessages = parseFieldErrors(error);
  if (fieldMessages.length > 0) {
    return fieldMessages[0];
  }

  const directMessage = parseError(error);
  const status = getErrorStatus(error);
  const genericStatusMessage = /^Request failed with status\s+\d{3}$/i.test(directMessage);

  if (!genericStatusMessage && directMessage) {
    return directMessage;
  }

  switch (status) {
    case 400:
    case 422:
      return "Unable to save student. Please review the form fields and try again.";
    case 401:
      return "Your session expired. Please log in again and retry saving the student.";
    case 403:
      return "You do not have permission to enroll students.";
    case 404:
      return "Unable to save student right now. Enrollment service was not found (404). Please refresh and try again.";
    case 409:
      return "Unable to save student due to a duplicate/conflict record. Please verify admission and roll numbers.";
    case 500:
    case 502:
    case 503:
    case 504:
      return "Server is temporarily unavailable while saving student. Please try again in a moment.";
    default:
      return "Unable to save student. Please try again.";
  }
}

function parseFieldErrors(error: unknown): string[] {
  const apiError = error as ApiError;
  const source = apiError?.details?.field_errors;
  if (!source) return [];

  const errors: string[] = [];
  for (const [field, value] of Object.entries(source)) {
    const fieldLabel = field.replace(/_/g, " ");
    if (Array.isArray(value)) {
      const first = String(value[0] || "").trim();
      if (first) errors.push(`${fieldLabel}: ${first}`);
      continue;
    }
    const text = String(value || "").trim();
    if (text) errors.push(`${fieldLabel}: ${text}`);
  }
  return errors;
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
  if (!clean) return false;
  // Accept numeric classes like "1".."12" that are a single character.
  if (/^\d+$/.test(clean)) {
    return true;
  }
  if (["abc", "adc", "asdf", "test", "demo"].includes(lowered)) return false;
  return /[A-Za-z0-9]/.test(clean);
}

function getInitialsFromName(value: string): string {
  const parts = sanitizeText(value)
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
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
  const STUDENT_DRAFT_STORAGE_KEY = "students:add:draft:v1";
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
  const [currentUser, setCurrentUser] = useState<MePayload | null>(null);

  const [admissionNo, setAdmissionNo] = useState("");
  const [isManualEdit, setIsManualEdit] = useState(false);
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
  const [photoCleared, setPhotoCleared] = useState(false);
  const [photoPreviewOpen, setPhotoPreviewOpen] = useState(false);
  const [capturedPhotoFile, setCapturedPhotoFile] = useState<File | null>(null);
  const [capturedPhotoPreviewUrl, setCapturedPhotoPreviewUrl] = useState("");
  const [statusValue, setStatusValue] = useState<"active" | "inactive" | "transferred" | "dropped">("active");
  const [categoryId, setCategoryId] = useState("");
  const [guardianId, setGuardianId] = useState("");
  const [classId, setClassId] = useState("");
  const [sectionId, setSectionId] = useState("");
  const [isDisabled, setIsDisabled] = useState(false);

  const [guardianDrafts, setGuardianDrafts] = useState<GuardianDraft[]>(() => [
    makeEmptyGuardianDraft(true),
  ]);
  const [guardianCardErrors, setGuardianCardErrors] = useState<GuardianFieldErrors[]>([{}]);
  const [guardianSubmitError, setGuardianSubmitError] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sectionLoading, setSectionLoading] = useState(false);
  const [sectionLoadError, setSectionLoadError] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "error">("success");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
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
  const [activeNavSection, setActiveNavSection] = useState<NavItemId>("identity");
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);
  const [draftLabel, setDraftLabel] = useState("Draft not saved yet");
  const [currentEnrolledCount, setCurrentEnrolledCount] = useState("1,533");
  const [admissionNoEditable, setAdmissionNoEditable] = useState(false);
  const [dobDisplay, setDobDisplay] = useState("");
  const [classAgeWarning, setClassAgeWarning] = useState("");
  const [motherTongue, setMotherTongue] = useState("");
  const [otherMotherTongue, setOtherMotherTongue] = useState("");
  const [religion, setReligion] = useState("Prefer not to say");
  const [nationality, setNationality] = useState("Indian");
  const [otherNationality, setOtherNationality] = useState("");
  const [admissionType, setAdmissionType] = useState("New admission");
  const [previousSchoolName, setPreviousSchoolName] = useState("");
  const [rteCertificateNo, setRteCertificateNo] = useState("");
  const [consentChecked, setConsentChecked] = useState(false);
  const [medicalNotes, setMedicalNotes] = useState("");
  const [docBirthCertificate, setDocBirthCertificate] = useState(false);
  const [docAadhaar, setDocAadhaar] = useState(false);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState("");
  const toastTimerRef = useRef<number | null>(null);
  const admissionNoRef = useRef("");
  const isManualEditRef = useRef(false);
  const admissionNoInitRequestedRef = useRef(false);

  // Track newly created student ID so documents can be uploaded immediately after creation
  const [newlyCreatedStudentId, setNewlyCreatedStudentId] = useState<number | null>(null);
  const [autoSaving, setAutoSaving] = useState(false);

  // Consolidated document upload state with proper status management
  type DocumentStatus = "idle" | "validating" | "uploading" | "success" | "error";
  
  interface DocumentState {
    status: DocumentStatus;
    fileName: string;
    url: string | null;
    error: string | null;
    uploadedAt: string | null;
  }

  const [documents, setDocuments] = useState<{
    birth_certificate: DocumentState;
    aadhaar_card: DocumentState;
    medical_information: DocumentState;
  }>({
    birth_certificate: { status: "idle", fileName: "", url: null, error: null, uploadedAt: null },
    aadhaar_card: { status: "idle", fileName: "", url: null, error: null, uploadedAt: null },
    medical_information: { status: "idle", fileName: "", url: null, error: null, uploadedAt: null },
  });

  // Track last error toast ID to avoid duplicates
  const [lastErrorToastId, setLastErrorToastId] = useState<string | null>(null);

  const pinIsValid = /^\d{6}$/.test(pincode.trim());
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

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

  const orderedClasses = useMemo(() => {
    return [...validClasses].sort((a, b) => {
      const aName = String(a.name || "").trim();
      const bName = String(b.name || "").trim();
      const aIndex = CLASS_ORDER.indexOf(aName);
      const bIndex = CLASS_ORDER.indexOf(bName);
      if (aIndex === -1 && bIndex === -1) return aName.localeCompare(bName);
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;
      return aIndex - bIndex;
    });
  }, [validClasses]);

  const selectedClass = useMemo(
    () => orderedClasses.find((item) => String(item.id) === classId) || null,
    [orderedClasses, classId],
  );

  const selectedSection = useMemo(
    () => sections.find((item) => String(item.id) === sectionId) || null,
    [sections, sectionId],
  );

  const studentForm = useMemo(
    () => ({
      admission_no: admissionNo.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      date_of_birth: dateOfBirth,
      gender: gender,
      class_id: classId,
      class_name: String(selectedClass?.name || "").trim(),
      section_id: sectionId,
      academic_year_id: academicYearId,
    }),
    [admissionNo, firstName, lastName, dateOfBirth, gender, classId, selectedClass, sectionId, academicYearId],
  );

  const studentFormRef = useRef(studentForm);

  useEffect(() => {
    studentFormRef.current = studentForm;
  }, [studentForm]);

  useEffect(() => {
    isManualEditRef.current = isManualEdit;
  }, [isManualEdit]);

  useEffect(() => {
    admissionNoRef.current = admissionNo;
  }, [admissionNo]);

  // Keep guardianId (the FK the student payload uses) in sync with the primary
  // draft's resolved ID. This matters for the auto-save path, which reads
  // guardianId directly, and keeps edit mode coherent after a picker link.
  useEffect(() => {
    const primary = guardianDrafts[0];
    const linked = primary?.linkedExistingId ?? null;
    const desired = linked ? String(linked) : "";
    if (desired !== guardianId) setGuardianId(desired);
  }, [guardianDrafts, guardianId]);

  // Hydrate the primary guardian card when the form loads an existing student (edit
  // mode) or a saved draft. Runs when guardianId is set AND the school's guardian
  // pool has arrived AND the primary card is still untouched (to avoid stomping
  // user edits after hydration).
  useEffect(() => {
    if (!guardianId) return;
    const numeric = Number(guardianId);
    if (!Number.isFinite(numeric)) return;
    const primary = guardianDrafts[0];
    if (!primary) return;
    if (primary.linkedExistingId === numeric) return;
    if (primary.fullName.trim() || primary.phone.trim()) return;
    const match = guardians.find((g) => g.id === numeric);
    if (!match) return;
    setGuardianDrafts((prev) => {
      if (prev.length === 0) return prev;
      const next = [...prev];
      next[0] = {
        ...next[0],
        isPrimary: true,
        linkedExistingId: match.id,
        fullName: match.full_name || "",
        relation: match.relation || "Father",
        phone: match.phone || "",
      };
      return next;
    });
  }, [guardianId, guardians, guardianDrafts]);

  const stateOptions = useMemo(() => Object.keys(stateCityMap).sort((a, b) => a.localeCompare(b)), [stateCityMap]);

  const currentUserInitials = useMemo(() => {
    const first = String(currentUser?.first_name || "").trim();
    const last = String(currentUser?.last_name || "").trim();
    const username = String(currentUser?.username || "").trim();
    const email = String(currentUser?.email || "").trim();

    if (first || last) {
      return getInitialsFromName(`${first} ${last}`);
    }
    if (username) {
      return getInitialsFromName(username.replace(/[._-]+/g, " "));
    }
    if (email.includes("@")) {
      return getInitialsFromName(email.split("@")[0] || "");
    }
    return "U";
  }, [currentUser]);

  const canSubmit = !loading && !saving && !photoUploading && !sectionLoading && !classId ? false : !loading && !saving && !photoUploading && !sectionLoading;

  const progressFields = [
    rollNo,
    firstName,
    lastName,
    dateOfBirth,
    academicYearId,
    gender === "other" ? customGender : "",
    bloodGroup,
    phone,
    email,
    addressLine,
    city,
    district,
    stateName,
    pincode,
    photo,
    categoryId,
    guardianId,
    classId,
    sectionId,
    motherTongue,
    motherTongue === "Other" ? otherMotherTongue : "",
    religion !== "Prefer not to say" ? religion : "",
    nationality !== "Indian" ? nationality : "",
    nationality === "Other" ? otherNationality : "",
    admissionType !== "New admission" ? admissionType : "",
    previousSchoolName,
    rteCertificateNo,
    consentChecked,
    medicalNotes,
    docBirthCertificate,
    docAadhaar,
    isDisabled,
    statusValue !== "active" ? statusValue : "",
  ];

  const completedProgressFields = progressFields.filter(isProgressFieldFilled).length;
  const footerProgressPercent = progressFields.length > 0 ? Math.round((completedProgressFields / progressFields.length) * 100) : 0;
  const footerProgressBucket = Math.min(100, Math.floor(footerProgressPercent / 10) * 10);
  const footerProgressClass = `progress-fill-${footerProgressBucket}`;

  const loadBaseLookups = async () => {
    try {
      setLoading(true);
      setError("");

      // Kick off all lookup requests in parallel and apply each as it arrives,
      // so dropdowns light up progressively instead of waiting for the slowest
      // (guardian pagination) to finish.
      const yearPromise = apiGet<ApiList<AcademicYear>>("/api/v1/core/academic-years/?page_size=200")
        .then((data) => setAcademicYears(listData(data)))
        .catch(() => {});
      const classPromise = fetchAllPages<SchoolClass>("/api/v1/core/classes/", 500)
        .then((rows) => setClasses(rows))
        .catch(() => {});
      const categoryPromise = fetchAllPages<StudentCategory>("/api/v1/students/categories/?status=active", 500)
        .then((rows) => setCategories(rows))
        .catch(() => {});
      const guardianPromise = fetchAllPages<Guardian>("/api/v1/students/guardians/", 500)
        .then((rows) => setGuardians(rows))
        .catch(() => {});
      const mePromise = apiGet<MePayload>("/api/v1/auth/me/")
        .then((me) => setCurrentUser(me))
        .catch(() => setCurrentUser(null));

      // Unblock the form as soon as the small/critical lookups are in.
      // Heavy paged fetches (categories/guardians) continue in the background.
      await Promise.all([yearPromise, classPromise, mePromise]);
      setLoading(false);

      // Still await the heavy ones so any caller awaiting loadBaseLookups
      // (e.g. the existing flow) sees a fully-resolved promise, but the UI
      // is already interactive at this point.
      await Promise.all([categoryPromise, guardianPromise]);
    } catch (loadError) {
      setError(parseError(loadError));
      setLoading(false);
    }
  };

  const saveDraftSnapshot = () => {
    if (typeof window === "undefined") return;
    const payload = {
      savedAt: Date.now(),
      admissionNo,
      isManualEdit,
      rollNo,
      firstName,
      lastName,
      dateOfBirth,
      academicYearId,
      gender,
      customGender,
      bloodGroup,
      phone,
      email,
      addressLine,
      city,
      district,
      stateName,
      pincode,
      photo,
      photoName,
      statusValue,
      categoryId,
      guardianId,
      classId,
      sectionId,
      isDisabled,
      motherTongue,
      otherMotherTongue,
      religion,
      nationality,
      otherNationality,
      admissionType,
      previousSchoolName,
      rteCertificateNo,
      consentChecked,
      medicalNotes,
      docBirthCertificate,
      docAadhaar,
    };
    window.localStorage.setItem(STUDENT_DRAFT_STORAGE_KEY, JSON.stringify(payload));
  };

  const restoreDraftSnapshot = () => {
    if (typeof window === "undefined" || isExistingStudentMode) return false;
    const raw = window.localStorage.getItem(STUDENT_DRAFT_STORAGE_KEY);
    if (!raw) return false;

    try {
      const draft = JSON.parse(raw) as Record<string, unknown>;
      setAdmissionNo(String(draft.admissionNo || ""));
      setIsManualEdit(Boolean(draft.isManualEdit));
      setRollNo(String(draft.rollNo || ""));
      setFirstName(String(draft.firstName || ""));
      setLastName(String(draft.lastName || ""));
      setDateOfBirth(String(draft.dateOfBirth || ""));
      setAcademicYearId(String(draft.academicYearId || ""));
      setGender(String(draft.gender || "male"));
      setCustomGender(String(draft.customGender || ""));
      setBloodGroup(String(draft.bloodGroup || ""));
      setPhone(String(draft.phone || ""));
      setEmail(String(draft.email || ""));
      setAddressLine(String(draft.addressLine || ""));
      setCity(String(draft.city || ""));
      setDistrict(String(draft.district || ""));
      setStateName(String(draft.stateName || ""));
      setPincode(String(draft.pincode || ""));
      setPhoto(String(draft.photo || ""));
      setPhotoName(String(draft.photoName || ""));
      setStatusValue((String(draft.statusValue || "active") as "active" | "inactive" | "transferred" | "dropped"));
      setCategoryId(String(draft.categoryId || ""));
      setGuardianId(String(draft.guardianId || ""));
      const restoredClassId = String(draft.classId || "");
      const restoredSectionId = String(draft.sectionId || "");
      setClassId(restoredClassId);
      setSectionId("");
      setPendingSectionId(restoredSectionId);
      setIsDisabled(Boolean(draft.isDisabled));
      setMotherTongue(String(draft.motherTongue || ""));
      setOtherMotherTongue(String(draft.otherMotherTongue || ""));
      setReligion(String(draft.religion || "Prefer not to say"));
      setNationality(String(draft.nationality || "Indian"));
      setOtherNationality(String(draft.otherNationality || ""));
      setAdmissionType(String(draft.admissionType || "New admission"));
      setPreviousSchoolName(String(draft.previousSchoolName || ""));
      setRteCertificateNo(String(draft.rteCertificateNo || ""));
      setConsentChecked(Boolean(draft.consentChecked));
      setMedicalNotes(String(draft.medicalNotes || ""));
      setDocBirthCertificate(Boolean(draft.docBirthCertificate));
      setDocAadhaar(Boolean(draft.docAadhaar));
      setDraftSavedAt(typeof draft.savedAt === "number" ? draft.savedAt : Date.now());
      return true;
    } catch {
      window.localStorage.removeItem(STUDENT_DRAFT_STORAGE_KEY);
      return false;
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
    setIsManualEdit(false);
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
    setPhotoCleared(false);
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

  const initializeAdmissionNo = async (force = false) => {
    if (isExistingStudentMode) return;
    if (admissionNoInitRequestedRef.current) return;
    if (isManualEditRef.current) return;
    if (!force && admissionNoRef.current.trim()) return;

    admissionNoInitRequestedRef.current = true;
    try {
      const nextAdmissionNo = await fetchNextAdmissionNoFromApi();
      setAdmissionNo((prev) => {
        if (isManualEditRef.current) return prev;
        return prev.trim() ? prev : nextAdmissionNo;
      });
    } catch (e) {
      console.error("Failed to initialize admission number:", e);
    }
  };

  // Track which student id (or "new"/"draft") we've already hydrated for, so the
  // effect can safely re-run when useSearchParams() updates after hydration in
  // App Router (the first render can briefly read empty params, which would
  // otherwise leave the edit form blank with stale "new student" defaults).
  const hydratedKeyRef = useRef<string | null>(null);
  const baseLookupsLoadedRef = useRef(false);

  useEffect(() => {
    const targetKey = isExistingStudentMode && studentId ? `student:${studentId}` : "new";
    if (hydratedKeyRef.current === targetKey) return;
    hydratedKeyRef.current = targetKey;

    const loadAll = async () => {
      try {
        // Edit-mode fast-path: kick off the student detail fetch in PARALLEL
        // with the heavier base-lookup paging (classes/categories/guardians).
        // The form fields are bound to the student data, so applying it the
        // moment it arrives lets the user see populated values within ~150 ms
        // instead of waiting 3-5 s for guardian pagination to finish.
        const studentPromise = isExistingStudentMode && studentId
          ? loadStudentForMode(studentId).catch((studentError) => {
              setError(parseError(studentError));
            })
          : null;

        if (!baseLookupsLoadedRef.current) {
          baseLookupsLoadedRef.current = true;
          await loadBaseLookups();
        }

        if (studentPromise) {
          await studentPromise;
        } else {
          const restored = restoreDraftSnapshot();
          if (!restored) {
            await initializeAdmissionNo();
          }
        }
      } catch (loadError) {
        setError(parseError(loadError));
      }
    };
    void loadAll();
  }, [isExistingStudentMode, studentId]);

  useEffect(() => {
    const flag = window.localStorage.getItem("eskoolia_scan_banner_dismissed") === "true";
    setBannerDismissed(flag);
  }, []);

  useEffect(() => {
    setDraftLabel(getDraftTimeAgoText(draftSavedAt));
    const timer = window.setInterval(() => {
      setDraftLabel(getDraftTimeAgoText(draftSavedAt));
    }, 60000);
    return () => window.clearInterval(timer);
  }, [draftSavedAt]);

  useEffect(() => {
    const fetchCount = async () => {
      try {
        // TODO: GET /api/students/count when backend endpoint is ready.
        const data = await apiGet<{ count?: number }>("/api/v1/students/students/?page_size=1");
        if (typeof data?.count === "number") {
          setCurrentEnrolledCount(new Intl.NumberFormat("en-IN").format(data.count));
        }
      } catch {
        setCurrentEnrolledCount("1,533");
      }
    };
    void fetchCount();
  }, []);

  useEffect(() => {
    // The scroll happens on .enroll-scroll (the form's inner scrollable area)
    // rather than the window or <main>, since the footer lives outside the scroll.
    // Fall back to window if the element hasn't mounted yet or at the mobile
    // breakpoint where overflow is visible.
    const scrollEl =
      (typeof document !== "undefined" &&
        (document.querySelector(".enroll-scroll") as HTMLElement | null)) || null;

    const getScrollTop = () =>
      scrollEl ? scrollEl.scrollTop : window.scrollY;
    const getViewportHeight = () =>
      scrollEl ? scrollEl.clientHeight : window.innerHeight;
    const getScrollHeight = () =>
      scrollEl ? scrollEl.scrollHeight : document.documentElement.scrollHeight;

    const updateActiveSection = () => {
      const stickyOffset = 120;
      const scrollTop = getScrollTop();
      const scanLine = scrollTop + stickyOffset;
      let nextActive: NavItemId = NAV_ITEMS[0]?.id || "identity";

      for (const item of NAV_ITEMS) {
        const section = document.getElementById(item.id);
        if (!section) continue;
        // offsetTop is relative to the offsetParent; use getBoundingClientRect
        // so it works consistently whether the scroll container is window or an element.
        const rect = section.getBoundingClientRect();
        const containerTop = scrollEl ? scrollEl.getBoundingClientRect().top : 0;
        const sectionTopWithinScroll = rect.top - containerTop + scrollTop;
        if (sectionTopWithinScroll <= scanLine) {
          nextActive = item.id;
        }
      }

      if (getViewportHeight() + scrollTop >= getScrollHeight() - 4) {
        nextActive = NAV_ITEMS[NAV_ITEMS.length - 1]?.id || nextActive;
      }

      setActiveNavSection((prev) => (prev === nextActive ? prev : nextActive));
    };

    updateActiveSection();
    const scrollTarget: Window | HTMLElement = scrollEl ?? window;
    scrollTarget.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => {
      scrollTarget.removeEventListener("scroll", updateActiveSection);
      window.removeEventListener("resize", updateActiveSection);
    };
  }, [loading]);

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

  useEffect(() => {
    if (!dateOfBirth) return;
    setDobDisplay(formatDobDisplayFromISO(dateOfBirth));
  }, [dateOfBirth]);

  const showToast = (message: string, type: "success" | "error" = "success", durationMs = 60000) => {
    setToastType(type);
    setToastMessage(message);

    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }

    toastTimerRef.current = window.setTimeout(() => {
      setToastMessage("");
      toastTimerRef.current = null;
    }, durationMs);
  };

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!dateOfBirth || !classId) {
      setClassAgeWarning("");
      return;
    }
    const selectedClass = orderedClasses.find((item) => String(item.id) === classId);
    const className = String(selectedClass?.name || "").trim();
    const rule = CLASS_AGE_RULES_STRICT[className];
    if (!rule) {
      setClassAgeWarning("");
      return;
    }
    const dobDate = new Date(`${dateOfBirth}T00:00:00`);
    if (Number.isNaN(dobDate.getTime())) return;
    const yearName = String(validAcademicYears.find((item) => String(item.id) === academicYearId)?.name || "");
    const refYear = /^\d{4}/.test(yearName) ? Number(yearName.slice(0, 4)) : new Date().getFullYear();
    const refDate = new Date(`${refYear}-06-01T00:00:00`);
    const age = (refDate.getTime() - dobDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000);
    if (age < rule.min || age > rule.max) {
      setClassAgeWarning(`Age-class mismatch: expected ${rule.min}-${rule.max} years for this grade.`);
      return;
    }
    setClassAgeWarning("");
  }, [dateOfBirth, classId, academicYearId, orderedClasses, validAcademicYears]);

  useEffect(() => {
    if (!success) return;
    showToast(success, "success", 60000);
  }, [success]);

  useEffect(() => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      let changed = false;

      const clearIf = (field: string, condition: boolean) => {
        if (next[field] && condition) {
          delete next[field];
          changed = true;
        }
      };

      const cleanFirstName = sanitizeText(firstName);
      const cleanLastName = sanitizeText(lastName);
      const dobDate = dateOfBirth ? new Date(dateOfBirth) : null;
      const hasValidDobDate = Boolean(dobDate && !Number.isNaN(dobDate.getTime()) && dobDate <= new Date());

      let hasValidClassAge = true;
      if (hasValidDobDate && classId) {
        const age = (Date.now() - (dobDate as Date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (age < 3) {
          hasValidClassAge = false;
        } else {
          const selectedClass = validClasses.find((item) => String(item.id) === classId);
          const className = String(selectedClass?.name || "");
          const classMatch = className.match(/\d+/);
          const classNumber = classMatch ? Number(classMatch[0]) : null;
          if (classNumber && CLASS_AGE_RULES[classNumber]) {
            const [minAge, maxAge] = CLASS_AGE_RULES[classNumber];
            hasValidClassAge = age >= minAge && age <= maxAge;
          }
        }
      }

      clearIf("first_name", Boolean(cleanFirstName && isAlphabetsOnly(cleanFirstName)));
      clearIf("last_name", Boolean(cleanLastName && isAlphabetsOnly(cleanLastName)));
      clearIf("dob", Boolean(hasValidDobDate && hasValidClassAge));
      clearIf("gender", Boolean(gender));
      clearIf("custom_gender", gender !== "other" || Boolean(sanitizeText(customGender)));
      clearIf("mother_tongue", Boolean(motherTongue));
      clearIf("other_mother_tongue", motherTongue !== "Other" || Boolean(sanitizeText(otherMotherTongue)));
      clearIf("nationality", Boolean(nationality));
      clearIf("other_nationality", nationality !== "Other" || Boolean(sanitizeText(otherNationality)));
      clearIf("academic_year", Boolean(academicYearId && validAcademicYears.some((row) => String(row.id) === academicYearId)));
      clearIf("class", Boolean(classId && validClasses.some((row) => String(row.id) === classId)));
      clearIf("section", Boolean(sectionId && sections.some((item) => String(item.id) === sectionId)));
      clearIf("phone", isValidPhone(phone));
      clearIf("email", !email.trim() || isValidEmail(email));
      clearIf("state", Boolean(sanitizeText(stateName)));
      clearIf("district", Boolean(sanitizeText(district)));
      clearIf("city", Boolean(sanitizeText(city)));
      clearIf("pincode", !pincode.trim() || isValidPincode(pincode));
      clearIf("guardian", Boolean(guardianId));
      clearIf("consent", Boolean(consentChecked));
      clearIf("rte_certificate", admissionType !== "RTE Quota" || Boolean(sanitizeText(rteCertificateNo)));

      return changed ? next : prev;
    });
  }, [
    firstName,
    lastName,
    dateOfBirth,
    classId,
    validClasses,
    gender,
    customGender,
    motherTongue,
    otherMotherTongue,
    nationality,
    otherNationality,
    academicYearId,
    validAcademicYears,
    sectionId,
    sections,
    phone,
    email,
    stateName,
    district,
    city,
    pincode,
    guardianId,
    consentChecked,
    admissionType,
    rteCertificateNo,
  ]);

  const resetStudentForm = () => {
    setAdmissionNo("");
    setIsManualEdit(false);
    admissionNoInitRequestedRef.current = false;
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
    setPhotoCleared(false);
    setStatusValue("active");
    setCategoryId("");
    setGuardianId("");
    setGuardianDrafts([makeEmptyGuardianDraft(true)]);
    setGuardianCardErrors([{}]);
    setGuardianSubmitError(null);
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
    setAdmissionNoEditable(false);
    setDobDisplay("");
    setClassAgeWarning("");
    setMotherTongue("");
    setOtherMotherTongue("");
    setReligion("Prefer not to say");
    setNationality("Indian");
    setOtherNationality("");
    setAdmissionType("New admission");
    setPreviousSchoolName("");
    setRteCertificateNo("");
    setConsentChecked(false);
    setMedicalNotes("");
    setDocBirthCertificate(false);
    setDocAadhaar(false);
    setDraftSavedAt(null);
  };

  const setSingleFieldError = (field: string, message: string) => {
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (message) next[field] = message;
      else delete next[field];
      return next;
    });
  };

  const saveDraftNow = () => {
    setDraftSavedAt(Date.now());
    saveDraftSnapshot();
    showToast("Draft saved successfully.", "success", 5000);
  };

  const clearDraftNow = () => {
    if (typeof window !== "undefined") {
      window.localStorage.removeItem(STUDENT_DRAFT_STORAGE_KEY);
    }
    resetStudentForm();
    void initializeAdmissionNo(true);
    setError("");
    setSuccess("");
    showToast("Draft cleared.", "success", 4000);
    jumpToSection("identity");
  };

  const dismissScanBanner = () => {
    setBannerDismissed(true);
    window.localStorage.setItem("eskoolia_scan_banner_dismissed", "true");
  };

  const jumpToSection = (id: string) => {
    const target = document.getElementById(id);
    if (!target) return;
    // Directly set the active section before scrolling to ensure proper state
    setActiveNavSection(id as NavItemId);
    // Use a small delay to allow state update, then scroll
    window.setTimeout(() => {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 50);
  };

  const getSectionIndex = (id: string): number => {
    return NAV_ITEMS.findIndex((item) => item.id === id);
  };

  const FIELD_SECTION_MAP: Record<string, NavItemId> = {
    admission_no: "identity",
    roll_no: "identity",
    first_name: "identity",
    last_name: "identity",
    dob: "identity",
    date_of_birth: "identity",
    gender: "identity",
    custom_gender: "identity",
    blood_group: "identity",
    mother_tongue: "identity",
    other_mother_tongue: "identity",
    nationality: "identity",
    other_nationality: "identity",
    photo: "identity",
    academic_year: "academic",
    class: "academic",
    section: "academic",
    category: "academic",
    rte_certificate: "academic",
    phone: "contact",
    email: "contact",
    address_line: "contact",
    city: "contact",
    district: "contact",
    state: "contact",
    pincode: "contact",
    guardian: "guardians",
    consent: "documents",
  };

  const jumpToFirstErrorSection = (errors: Record<string, string>) => {
    const errorFields = Object.keys(errors);
    if (errorFields.length === 0) return;

    let targetSection: NavItemId | null = null;
    for (const nav of NAV_ITEMS) {
      const hasErrorInSection = errorFields.some((field) => FIELD_SECTION_MAP[field] === nav.id);
      if (hasErrorInSection) {
        targetSection = nav.id;
        break;
      }
    }

    if (!targetSection) {
      targetSection = FIELD_SECTION_MAP[errorFields[0]] || null;
    }

    if (targetSection) {
      jumpToSection(targetSection);
    }
  };

  const renderSectionNavButtons = (currentSectionId: string) => {
    const currentIndex = getSectionIndex(currentSectionId);
    const hasPrev = currentIndex > 0;
    const hasNext = currentIndex < NAV_ITEMS.length - 1;
    const prevItem = hasPrev ? NAV_ITEMS[currentIndex - 1] : null;
    const nextItem = hasNext ? NAV_ITEMS[currentIndex + 1] : null;

    return (
      <div className="section-nav-buttons">
        {hasPrev ? (
          <button
            type="button"
            onClick={() => jumpToSection(prevItem!.id)}
            className="btn-nav-prev"
          >
            ← {prevItem!.label}
          </button>
        ) : (
          <div />
        )}
        {hasNext ? (
          <button
            type="button"
            onClick={() => jumpToSection(nextItem!.id)}
            className="btn-nav-next"
          >
            {nextItem!.label} →
          </button>
        ) : (
          <div />
        )}
      </div>
    );
  };

  const onDobMaskedChange = (nextMasked: string) => {
    const masked = toDobMask(nextMasked);
    setDobDisplay(masked);
    const iso = parseDobMaskedToISO(masked);
    setDateOfBirth(iso);
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

    if (!motherTongue) {
      nextErrors.mother_tongue = "Mother tongue is required.";
    }
    if (motherTongue === "Other" && !sanitizeText(otherMotherTongue)) {
      nextErrors.other_mother_tongue = "Please specify language.";
    }

    if (!nationality) {
      nextErrors.nationality = "Nationality is required.";
    }
    if (nationality === "Other" && !sanitizeText(otherNationality)) {
      nextErrors.other_nationality = "Please specify nationality.";
    }

    if (admissionType === "RTE Quota" && !sanitizeText(rteCertificateNo)) {
      nextErrors.rte_certificate = "RTE certificate number is required.";
    }

    if (!consentChecked) {
      nextErrors.consent = "Guardian consent confirmation is required.";
    }

    // Guardian check: validate the DRAFT state in the UI, not `guardianId`.
    // `guardianId` is a FK to a persisted Guardian record and only gets set
    // inside persistGuardianDrafts() during submit — so at validation time a
    // freshly-typed primary card would always fail this gate. A guardian card
    // counts as valid if it's already linked to an existing guardian OR if all
    // three required fields (name, relation, phone) have content.
    const hasValidGuardian = guardianDrafts.some((d) => {
      if (d.linkedExistingId != null) return true;
      return !!(d.fullName?.trim() && d.relation?.trim() && d.phone?.trim());
    });
    if (!hasValidGuardian) {
      nextErrors.guardian = "At least one guardian is required before enrollment.";
    }

    return nextErrors;
  };

  const syncApiFieldErrors = (apiError: ApiError) => {
    let source: Record<string, string | string[]> = apiError.details?.field_errors || {};
    if (Object.keys(source).length === 0 && apiError.details && typeof apiError.details === "object" && !Array.isArray(apiError.details)) {
      const detailsPayload = apiError.details as Record<string, unknown>;
      const fallbackSource: Record<string, string | string[]> = {};
      for (const [field, value] of Object.entries(detailsPayload)) {
        if (["message", "detail", "error", "success", "status", "code", "non_field_errors", "field_errors"].includes(field)) {
          continue;
        }
        if (typeof value === "string" || Array.isArray(value)) {
          fallbackSource[field] = value as string | string[];
        }
      }
      source = fallbackSource;
    }

    const mapped: Record<string, string> = {};
    for (const [field, value] of Object.entries(source)) {
      const mappedField = field === "date_of_birth" ? "dob" : field === "current_class" ? "class" : field === "current_section" ? "section" : field;
      mapped[mappedField] = Array.isArray(value) ? String(value[0] || "") : String(value || "");
    }
    setFieldErrors(mapped);
    return mapped;
  };

  /**
   * Persist all guardian draft cards. For each draft:
   *   - If `linkedExistingId` is set, it's already in the backend → reuse the ID.
   *   - If fully empty and non-primary, skip.
   *   - Otherwise validate and POST to create the Guardian record.
   *
   * Returns:
   *   { primaryId }     — the ID that should be linked to the student's guardian FK, or
   *   { cardErrors }    — per-card field-level errors when validation fails.
   *
   * Mutates state: updates draft cards with resolved `linkedExistingId` after a successful POST.
   */
  const persistGuardianDrafts = async (): Promise<
    { ok: true; primaryId: number | null; updatedDrafts: GuardianDraft[] }
    | { ok: false; cardErrors: GuardianFieldErrors[] }
  > => {
    const cardErrors: GuardianFieldErrors[] = guardianDrafts.map(() => ({}));
    const resolvedIds: (number | null)[] = guardianDrafts.map(() => null);

    // Validate synchronously first so we can short-circuit before any POST
    guardianDrafts.forEach((draft, idx) => {
      const fullName = sanitizeText(draft.fullName);
      const phone = (draft.phone || "").replace(/\D/g, "").slice(0, 10);
      const email = (draft.email || "").trim();
      const isEmpty = !fullName && !phone && !email && !(draft.occupation || "").trim();

      if (!draft.isPrimary && isEmpty && draft.linkedExistingId == null) {
        // Empty non-primary cards are silently skipped.
        return;
      }

      if (draft.linkedExistingId != null) {
        resolvedIds[idx] = draft.linkedExistingId;
        return;
      }

      const err: GuardianFieldErrors = {};
      if (!fullName) {
        err.fullName = "Full name is required";
      } else if (!isAlphabetsOnly(fullName)) {
        err.fullName = "Full name can only contain letters and spaces";
      }
      if (!draft.relation) {
        err.relation = "Relation is required";
      }
      if (!phone) {
        err.phone = "Phone is required";
      } else if (!isValidPhone(phone)) {
        err.phone = "Phone must be exactly 10 digits";
      }
      if (email && !isValidEmail(email)) {
        err.email = "Email format is invalid";
      }
      cardErrors[idx] = err;
    });

    // Cross-card check: each Relation (Father / Mother / Guardian / etc.) may
    // only be used by ONE guardian card. Bank the first occurrence and flag
    // any later card that re-uses the same relation.
    const seenRelations = new Map<string, number>();
    guardianDrafts.forEach((draft, idx) => {
      const fullName = sanitizeText(draft.fullName);
      const phone = (draft.phone || "").replace(/\D/g, "").slice(0, 10);
      const email = (draft.email || "").trim();
      const isEmpty = !fullName && !phone && !email && !(draft.occupation || "").trim();
      if (!draft.isPrimary && isEmpty && draft.linkedExistingId == null) return;

      const rel = sanitizeText(draft.relation || "").toLowerCase();
      if (!rel) return;
      if (seenRelations.has(rel)) {
        const dupMsg = `Relation "${draft.relation}" is already assigned to Guardian ${seenRelations.get(rel)! + 1}. Pick a different relation.`;
        cardErrors[idx] = { ...(cardErrors[idx] || {}), relation: dupMsg };
      } else {
        seenRelations.set(rel, idx);
      }
    });

    const hasErrors = cardErrors.some((e) => Object.keys(e).length > 0);
    if (hasErrors) {
      return { ok: false, cardErrors };
    }

    // POST any draft that still needs creating
    const updatedDrafts: GuardianDraft[] = [...guardianDrafts];
    for (let idx = 0; idx < guardianDrafts.length; idx++) {
      const draft = guardianDrafts[idx];
      if (resolvedIds[idx] != null) continue; // already resolved (linked or skipped)

      const fullName = sanitizeText(draft.fullName);
      const phone = (draft.phone || "").replace(/\D/g, "").slice(0, 10);
      const isEmpty = !fullName && !phone;
      if (!draft.isPrimary && isEmpty) continue; // empty non-primary → skip

      try {
        const created = await apiPostJson<Guardian & { email?: string; occupation?: string }>(
          "/api/v1/students/guardians/",
          {
            full_name: fullName,
            relation: sanitizeText(draft.relation) || "Father",
            phone,
            email: sanitizeText(draft.email) || "",
            occupation: sanitizeText(draft.occupation) || "",
          },
        );
        resolvedIds[idx] = created.id;
        updatedDrafts[idx] = {
          ...draft,
          linkedExistingId: created.id,
          fullName,
          phone,
        };
        // Add to the school's guardian pool so the picker can see it next time
        setGuardians((prev) =>
          prev.some((g) => g.id === created.id) ? prev : [...prev, created],
        );
      } catch (createError) {
        const msg = parseError(createError) || "Failed to save this guardian";
        cardErrors[idx] = { ...cardErrors[idx], fullName: msg };
        return { ok: false, cardErrors };
      }
    }

    setGuardianDrafts(updatedDrafts);

    const primaryId = resolvedIds[0];
    return { ok: true, primaryId: primaryId ?? null, updatedDrafts };
  };


  const uploadStudentPhoto = async (file: File): Promise<boolean> => {
    if (!["image/jpeg", "image/png"].includes(file.type)) {
      setSingleFieldError("photo", "Only JPEG and PNG files are allowed");
      return false;
    }
    if (file.size > 4 * 1024 * 1024) {
      setSingleFieldError("photo", "Please choose an image up to 4MB before compression");
      return false;
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
      setPhotoCleared(false);
      setSuccess("Photo uploaded securely.");
      return true;
    } catch (uploadError) {
      setSingleFieldError("photo", parseError(uploadError));
      setPhoto("");
      setPhotoName("");
      return false;
    } finally {
      setPhotoUploading(false);
    }
  };

  const clearCapturedPhotoDraft = () => {
    setCapturedPhotoFile(null);
    setCapturedPhotoPreviewUrl((prev) => {
      if (prev) {
        URL.revokeObjectURL(prev);
      }
      return "";
    });
  };

  const clearStudentPhoto = () => {
    setPhoto("");
    setPhotoName("");
    setPhotoCleared(true);
    setPhotoPreviewOpen(false);
    setSingleFieldError("photo", "");
  };

  const stopStudentCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  };

  const closeStudentCamera = () => {
    stopStudentCamera();
    clearCapturedPhotoDraft();
    setCameraOpen(false);
    setCameraError("");
  };

  const openStudentFilePicker = () => {
    if (isViewMode || photoUploading) return;
    photoInputRef.current?.click();
  };

  const openStudentCamera = () => {
    if (isViewMode || photoUploading) return;
    if (
      typeof navigator !== "undefined" &&
      navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === "function"
    ) {
      clearCapturedPhotoDraft();
      setCameraError("");
      setCameraOpen(true);
      return;
    }
    photoInputRef.current?.click();
  };

  const captureStudentPhoto = async () => {
    try {
      const video = cameraVideoRef.current;
      if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
        throw new Error("Camera is not ready yet.");
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        throw new Error("Camera capture is not supported in this browser.");
      }
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
      if (!blob) {
        throw new Error("Unable to capture photo.");
      }

      const file = new File([blob], `student-photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      setCapturedPhotoFile(file);
      setCapturedPhotoPreviewUrl((prev) => {
        if (prev) {
          URL.revokeObjectURL(prev);
        }
        return URL.createObjectURL(file);
      });
      setCameraError("");
    } catch (captureError) {
      setCameraError(parseError(captureError) || "Unable to capture photo.");
    }
  };

  const retakeCapturedPhoto = () => {
    clearCapturedPhotoDraft();
    setCameraError("");
  };

  const applyCapturedPhoto = async () => {
    if (!capturedPhotoFile) return;
    const uploaded = await uploadStudentPhoto(capturedPhotoFile);
    if (!uploaded) return;
    closeStudentCamera();
    setPhotoPreviewOpen(true);
  };

  // Auto-save student draft when Identity + Academic fields are complete
  const autoSaveStudentDraft = async (): Promise<number | null> => {
    // If already saved, return the ID
    if (newlyCreatedStudentId) {
      return newlyCreatedStudentId;
    }

    const snapshot = studentFormRef.current;
    const classIdNum = Number(snapshot.class_id);
    const sectionIdNum = Number(snapshot.section_id);
    const academicYearNum = Number(snapshot.academic_year_id);
    const missingFields: string[] = [];
    if (!snapshot.first_name) missingFields.push("First Name");
    if (!snapshot.last_name) missingFields.push("Last Name");
    if (!snapshot.admission_no) missingFields.push("Admission Number");
    if (!snapshot.date_of_birth) missingFields.push("Date of Birth");
    if (!snapshot.gender) missingFields.push("Gender");
    if (!snapshot.academic_year_id || Number.isNaN(academicYearNum) || academicYearNum <= 0) missingFields.push("Academic Year");
    if (!snapshot.class_id || Number.isNaN(classIdNum) || classIdNum <= 0) missingFields.push("Class");
    if (!snapshot.section_id || Number.isNaN(sectionIdNum) || sectionIdNum <= 0) missingFields.push("Section");

    if (missingFields.length > 0) {
      showToast(`⚠️ Please complete Identity and Academic details before uploading documents. Missing: ${missingFields.join(", ")}`, "error");
      return null;
    }

    const admissionAvailable = await runAdmissionAvailabilityCheck(snapshot.admission_no);
    if (!admissionAvailable) {
      jumpToSection("identity");
      showToast("⚠️ Admission number already exists. Please enter a unique admission number before uploading documents.", "error");
      return null;
    }

    setAutoSaving(true);
    try {
      const isStudentActive = statusValue === "active";
      const payload: StudentCreatePayload = {
        admission_no: snapshot.admission_no || "",
        roll_no: rollNo.trim() || undefined,
        first_name: snapshot.first_name,
        last_name: snapshot.last_name,
        date_of_birth: snapshot.date_of_birth || undefined,
        academic_year: academicYearNum,
        gender: snapshot.gender === "other" ? customGender : snapshot.gender,
        custom_gender: gender === "other" ? customGender : undefined,
        blood_group: bloodGroup.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        address_line: addressLine.trim() || undefined,
        city: city.trim() || undefined,
        district: district.trim() || undefined,
        state: stateName.trim() || undefined,
        pincode: pincode.trim() || undefined,
        photo: photo ? photo : undefined,
        status: statusValue,
        category: categoryId ? Number(categoryId) : undefined,
        guardian: guardianId ? Number(guardianId) : undefined,
        current_class: classIdNum,
        current_section: sectionIdNum,
        is_disabled: isDisabled,
        is_active: isStudentActive,
        is_draft: true,
      };

      const response = await apiPostJson<StudentCreateResponse>("/api/v1/students/students/", payload);
      const createdStudentId = Number(response?.id ?? response?.data?.id);

      if (Number.isFinite(createdStudentId) && createdStudentId > 0) {
        setNewlyCreatedStudentId(createdStudentId);
        invalidateGeneratedAdmissionNoCache();
        console.log("✅ Student auto-saved with ID:", createdStudentId);
        showToast("✅ Student draft saved. Ready for document uploads.", "success");
        return createdStudentId;
      } else {
        throw new Error("No student ID returned from server");
      }
    } catch (err) {
      const fieldErrors = parseFieldErrors(err);
      const admissionError = fieldErrors.find((msg) => msg.toLowerCase().startsWith("admission no:"));
      if (admissionError) {
        const specific = admissionError.split(":").slice(1).join(":").trim() || "Admission number already exists";
        setSingleFieldError("admission_no", specific);
        jumpToSection("identity");
        showToast(`❌ ${specific}. Please use a unique admission number.`, "error");
        console.error("❌ Auto-save duplicate admission number:", err);
        return null;
      }

      const errorMsg = fieldErrors.length > 0
        ? `Unable to save student record. ${fieldErrors[0]}`
        : (parseError(err) || "Failed to save student draft.");
      showToast(`❌ ${errorMsg}`, "error");
      console.error("❌ Auto-save error:", err);
      return null;
    } finally {
      setAutoSaving(false);
    }
  };

  // Validate required identity fields for student creation
  const validateIdentityFields = (): { valid: boolean; missingFields: string[]; academicIncomplete: boolean } => {
    const snapshot = studentFormRef.current;
    const missingFields: string[] = [];
    let academicIncomplete = false;
    
    if (!snapshot.first_name) missingFields.push("First Name");
    if (!snapshot.last_name) missingFields.push("Last Name");
    if (!snapshot.date_of_birth) missingFields.push("Date of Birth");
    if (!snapshot.gender) missingFields.push("Gender");
    if (!snapshot.academic_year_id || Number(snapshot.academic_year_id) <= 0) {
      missingFields.push("Academic Year");
      academicIncomplete = true;
    }
    if (!snapshot.class_id || Number(snapshot.class_id) <= 0) {
      missingFields.push("Class");
      academicIncomplete = true;
    }
    if (!snapshot.section_id || Number(snapshot.section_id) <= 0) {
      missingFields.push("Section");
      academicIncomplete = true;
    }

    console.log("🔍 Identity field validation:", {
      valid: missingFields.length === 0,
      missingFields,
      formState: snapshot,
      filledFields: {
        firstName: !!snapshot.first_name,
        lastName: !!snapshot.last_name,
        dob: !!snapshot.date_of_birth,
        gender: !!snapshot.gender,
        academicYear: !!snapshot.academic_year_id,
        classId: !!snapshot.class_id,
        sectionId: !!snapshot.section_id,
      },
    });

    return { valid: missingFields.length === 0, missingFields, academicIncomplete };
  };

  // Document Upload Handler - Completely rewritten with proper state management
  const uploadDocumentFile = async (
    file: File,
    documentType: string
  ) => {
    console.log("📂 Upload initiated:", { documentType, fileName: file.name, fileSize: file.size });

    // ============================================================
    // STEP 1: FILE VALIDATION
    // ============================================================
    const allowedTypes = [".pdf", ".jpg", ".jpeg", ".png"];
    const fileName = file.name.toLowerCase();
    if (!allowedTypes.some((ext) => fileName.endsWith(ext))) {
      const errorMsg = "❌ Only PDF, JPG, JPEG, and PNG files are allowed.";
      console.error("📋 File type validation failed:", errorMsg);
      showToast(errorMsg, "error");
      return;
    }

    if (file.size > 5242880) {
      const errorMsg = "❌ File size must be less than 5MB.";
      console.error("📋 File size validation failed:", errorMsg);
      showToast(errorMsg, "error");
      return;
    }

    console.log("✅ File validation passed");

    // ============================================================
    // STEP 2: UPDATE STATE - SET UPLOADING
    // ============================================================
    setDocuments((prev) => ({
      ...prev,
      [documentType]: {
        ...prev[documentType as keyof typeof prev],
        status: "uploading" as DocumentStatus,
        error: null,
      },
    }));

    console.log("🔄 Set status to uploading for:", documentType);

    try {
      // ============================================================
      // STEP 3: CHECK STUDENT ID & VALIDATE IDENTITY FIELDS
      // ============================================================
      let effectiveStudentId = studentId || newlyCreatedStudentId;
      
      console.log("📋 Student ID check:", {
        currentStudentId: studentId,
        newlyCreatedId: newlyCreatedStudentId,
        effective: effectiveStudentId,
      });

      if (!effectiveStudentId) {
        // No student ID - must validate identity fields first
        const { valid, missingFields, academicIncomplete } = validateIdentityFields();

        if (!valid) {
          const errorMsg = academicIncomplete
            ? "Please complete Academic section and select Class before uploading documents."
            : `Please complete required Identity fields first: ${missingFields.join(", ")}`;
          console.warn("❌ Identity fields incomplete:", missingFields);
          
          // Keep document cards stable and show a toast-driven validation message.
          setDocuments((prev) => ({
            ...prev,
            [documentType]: {
              ...prev[documentType as keyof typeof prev],
              status: "idle" as DocumentStatus,
              error: null,
            },
          }));

          showToast(`⚠️ ${errorMsg}`, "error");
          return;
        }

        // Identity fields are complete - attempt auto-save
        console.log("✅ Identity fields complete, attempting auto-save...");
        try {
          effectiveStudentId = await autoSaveStudentDraft();

          if (!effectiveStudentId) {
            // autoSaveStudentDraft has already surfaced the precise reason
            // (missing field, duplicate admission no, server error, etc.)
            // via showToast. Bail out silently so we don't overwrite that
            // helpful message with a generic "no student ID" warning.
            setDocuments((prev) => ({
              ...prev,
              [documentType]: {
                ...prev[documentType as keyof typeof prev],
                status: "idle" as DocumentStatus,
                error: null,
              },
            }));
            return;
          }

          console.log("✅ Auto-save successful, student ID:", effectiveStudentId);
          setNewlyCreatedStudentId(effectiveStudentId);
        } catch (saveErr) {
          const fieldErrors = parseFieldErrors(saveErr);
          const errorMsg = fieldErrors.length > 0
            ? `Unable to save student record. ${fieldErrors[0]}`
            : (parseError(saveErr) || "Unable to prepare student draft before upload.");
          console.error("❌ Auto-save failed:", saveErr);

          setDocuments((prev) => ({
            ...prev,
            [documentType]: {
              ...prev[documentType as keyof typeof prev],
              status: "idle" as DocumentStatus,
              error: null,
            },
          }));

          showToast(`⚠️ ${errorMsg}`, "error");
          return;
        }
      }

      // ============================================================
      // STEP 4: UPLOAD DOCUMENT
      // ============================================================
      const formData = new FormData();
      formData.append("student_id", String(effectiveStudentId));
      formData.append("student_draft_id", String(effectiveStudentId));
      formData.append("document_type", documentType);
      formData.append("file", file);

      console.log("🚀 Uploading document:", {
        studentId: effectiveStudentId,
        documentType,
        fileName: file.name,
        endpoint: "/api/v1/students/documents/upload_document/",
      });

      const response = await apiRequestWithRefresh("/api/v1/students/documents/upload_document/", {
        method: "POST",
        body: formData,
      }) as { id?: unknown; file?: string; file_url?: string; original_name?: string; uploaded_at?: string } | null;

      console.log("📥 Upload response received:", response);

      // ============================================================
      // STEP 5: VALIDATE RESPONSE
      // ============================================================
      const isSuccess = response && (
        response.id || 
        response.file || 
        response.original_name || 
        response.uploaded_at
      );

      if (!isSuccess) {
        throw new Error("Invalid response from server - missing required fields");
      }

      // ============================================================
      // STEP 6: UPDATE STATE - SUCCESS
      // ============================================================
      const displayFileName = response.original_name || file.name;
      const fileUrl = response.file_url || response.file || null;

      setDocuments((prev) => ({
        ...prev,
        [documentType]: {
          status: "success" as DocumentStatus,
          fileName: displayFileName,
          url: fileUrl,
          error: null,
          uploadedAt: response.uploaded_at || new Date().toISOString(),
        },
      }));

      console.log("✅ Document state updated to SUCCESS:", {
        documentType,
        fileName: displayFileName,
        uploadedAt: response.uploaded_at,
      });

      // Clear any previous error toast
      setLastErrorToastId(null);

      // Show success toast
      showToast(`✅ ${documentType.replace(/_/g, " ").toUpperCase()} uploaded successfully!`, "success");

    } catch (err) {
      // ============================================================
      // STEP 7: HANDLE ERROR
      // ============================================================
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("❌ Document upload failed:", {
        documentType,
        error: errorMessage,
        fullError: err,
      });

      // Update state to error
      setDocuments((prev) => {
        const current = prev[documentType as keyof typeof prev];
        if (current.status === "success") {
          return prev;
        }
        return {
          ...prev,
          [documentType]: {
            ...current,
            status: "idle" as DocumentStatus,
            error: null,
          },
        };
      });

      // Show error toast
      const displayError = errorMessage.startsWith("❌") || errorMessage.startsWith("⚠️") 
        ? errorMessage 
        : `❌ ${errorMessage}`;
      
      showToast(displayError, "error");
    }
  };

  const handleDocumentPick = async (documentType: DocumentTypeKey, file: File) => {
    console.log("📂 File selected for upload:", {
      documentType,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
    });
    try {
      await uploadDocumentFile(file, documentType);
    } catch (err) {
      console.error("❌ Unexpected error in handleDocumentPick:", err);
    }
  };

  useEffect(() => {
    return () => {
      if (capturedPhotoPreviewUrl) {
        URL.revokeObjectURL(capturedPhotoPreviewUrl);
      }
    };
  }, [capturedPhotoPreviewUrl]);

  useEffect(() => {
    if (!cameraOpen) {
      stopStudentCamera();
      return;
    }

    let cancelled = false;

    const startCamera = async () => {
      setCameraError("");
      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error("Camera access is not supported on this device.");
        }

        // Try preferred camera constraints first, then fall back for desktop/browser compatibility.
        const constraintsList: MediaStreamConstraints[] = [
          {
            video: {
              facingMode: { ideal: "environment" },
              width: { ideal: 1280 },
              height: { ideal: 960 },
            },
            audio: false,
          },
          {
            video: {
              facingMode: "user",
              width: { ideal: 1280 },
              height: { ideal: 960 },
            },
            audio: false,
          },
          { video: true, audio: false },
        ];

        let stream: MediaStream | null = null;
        let lastError: unknown = null;

        for (const constraints of constraintsList) {
          try {
            stream = await navigator.mediaDevices.getUserMedia(constraints);
            break;
          } catch (streamError) {
            lastError = streamError;
          }
        }

        if (!stream) {
          throw lastError ?? new Error("Unable to access camera.");
        }

        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        stopStudentCamera();
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          const videoEl = cameraVideoRef.current;
          videoEl.srcObject = stream;
          videoEl.muted = true;
          videoEl.setAttribute("playsinline", "true");

          try {
            await videoEl.play();
          } catch {
            // Some browsers need metadata before playback can start.
            await new Promise<void>((resolve) => {
              const onLoaded = () => {
                videoEl.removeEventListener("loadedmetadata", onLoaded);
                void videoEl.play().finally(() => resolve());
              };
              videoEl.addEventListener("loadedmetadata", onLoaded, { once: true });
            });
          }
        }
      } catch (error) {
        if (!cancelled) {
          const apiError = error as Error;
          if (apiError?.name === "NotAllowedError") {
            setCameraError("Camera permission was blocked. Allow camera access in the browser and try again.");
            return;
          }
          setCameraError(parseError(error) || "Unable to access camera.");
        }
      }
    };

    void startCamera();

    return () => {
      cancelled = true;
      stopStudentCamera();
    };
  }, [cameraOpen]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (isViewMode) return;
    setSuccess("");
    setError("");
    setGuardianSubmitError(null);
    setGuardianCardErrors(guardianDrafts.map(() => ({})));

    const nextErrors = validateClient();
    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError(`Please fix ${Object.keys(nextErrors).length} validation error(s).`);
      jumpToFirstErrorSection(nextErrors);
      return;
    }

    if (!admissionChecked) {
      const ok = await runAdmissionAvailabilityCheck();
      if (!ok) {
        setError("Please resolve admission number validation first.");
        jumpToSection("identity");
        return;
      }
    }

    // Persist any un-linked guardian drafts to the backend; use the primary's
    // resolved ID as the student's guardian FK.
    const persistResult = await persistGuardianDrafts();
    if (!persistResult.ok) {
      setGuardianCardErrors(persistResult.cardErrors);
      setGuardianSubmitError("Please fix the highlighted guardian fields.");
      jumpToSection("guardians");
      return;
    }
    const resolvedPrimaryGuardianId = persistResult.primaryId;
    if (!resolvedPrimaryGuardianId) {
      setGuardianSubmitError("Please add at least one guardian (Guardian 1 is required).");
      jumpToSection("guardians");
      return;
    }
    if (guardianId !== String(resolvedPrimaryGuardianId)) {
      setGuardianId(String(resolvedPrimaryGuardianId));
    }

    try {
      setSaving(true);
      const isStudentActive = !isDisabled && statusValue === "active";
      const payload: StudentCreatePayload = {
        admission_no: sanitizeText(admissionNo).replace(/-/g, ""),
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
        photo: photo ? photo : (isEditMode && photoCleared ? "" : undefined),
        status: statusValue,
        category: categoryId ? Number(categoryId) : undefined,
        guardian: resolvedPrimaryGuardianId,
        current_class: Number(classId),
        current_section: Number(sectionId),
        is_disabled: isDisabled,
        is_active: isStudentActive,
      };

      // Success handler — stay on /students/add, reset the form, fetch a
      // fresh admission number, toast, and scroll the form back to the top.
      // Edit mode keeps its redirect since the user came FROM the list.
      const finishSuccessAsEnrollment = (toastMessage: string) => {
        invalidateGeneratedAdmissionNoCache();
        if (typeof window !== "undefined") {
          window.localStorage.removeItem(STUDENT_DRAFT_STORAGE_KEY);
        }
        // Clear everything the next enrollment shouldn't inherit.
        resetStudentForm();
        setDocuments({
          birth_certificate: { status: "idle", fileName: "", url: null, error: null, uploadedAt: null },
          aadhaar_card: { status: "idle", fileName: "", url: null, error: null, uploadedAt: null },
          medical_information: { status: "idle", fileName: "", url: null, error: null, uploadedAt: null },
        });
        setNewlyCreatedStudentId(null);
        setError("");
        showToast(toastMessage, "success", 5000);
        // Scroll the form's internal scroll container (not window — body is
        // overflow:hidden in this layout).
        if (typeof document !== "undefined") {
          const scrollEl = document.querySelector(".enroll-scroll") as HTMLElement | null;
          scrollEl?.scrollTo({ top: 0, behavior: "smooth" });
        }
        // Trigger a new admission number fetch on the next tick so the reset
        // has applied before initializeAdmissionNo() gates on the ref.
        setTimeout(() => {
          void initializeAdmissionNo(true);
        }, 0);
      };

      if (isEditMode && studentId) {
        await apiPutJson<{ message?: string }>(`/api/v1/students/students/${studentId}/`, payload);
        setSuccess("Student updated successfully.");
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem("students:list:flash", "Student updated successfully.");
        }
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = "/students/list";
          }
        }, 800);
      } else if (newlyCreatedStudentId) {
        // Auto-save (triggered by document upload) already created a DRAFT
        // student row with this admission_no. POSTing again would collide on
        // the uniqueness check. Finalize that draft via PUT and flip
        // is_draft → false so it becomes a real enrolled student.
        const finalizePayload: StudentCreatePayload = { ...payload, is_draft: false };
        await apiPutJson<{ message?: string }>(
          `/api/v1/students/students/${newlyCreatedStudentId}/`,
          finalizePayload,
        );
        finishSuccessAsEnrollment("Student enrolled successfully");
      } else {
        // Fresh POST — no auto-save happened (user submitted without
        // uploading any documents first). Create the student, then reset
        // the form for the next enrollment.
        const response = await apiPostJson<StudentCreateResponse>("/api/v1/students/students/", payload);
        const createdStudentId = Number(response?.id ?? response?.data?.id);
        if (Number.isFinite(createdStudentId) && createdStudentId > 0) {
          console.log("✅ New student created with ID:", createdStudentId);
        }
        const toastMsg = response?.warning
          ? `Student enrolled successfully. ${response.warning}`
          : "Student enrolled successfully";
        finishSuccessAsEnrollment(toastMsg);
        
        // Write enrollment data so multi-subject page can auto-populate
        if (typeof window !== "undefined") {
          const enrolledClass = orderedClasses.find((item) => String(item.id) === classId);
          const enrolledSection = sections.find((item) => String(item.id) === sectionId);
          const enrolledAcYear = academicYears.find((item) => String(item.id) === academicYearId);
          const enrollmentPayload = {
            name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            admissionNo: String(response?.admission_no || admissionNo).trim(),
            rollNo: String(response?.roll_no || rollNo).trim(),
            className: String(enrolledClass?.name || ""),
            sectionName: String(enrolledSection?.name || ""),
            academicYear: String(enrolledAcYear?.name || ""),
          };
          window.localStorage.setItem("eskoolia_last_enrolled_student", JSON.stringify(enrollmentPayload));
        }

        // Navigate to multi-subject assignment after short delay
        setTimeout(() => {
          if (typeof window !== "undefined") {
            window.location.href = "/students/multi-class";
          }
        }, 900);
      }
    } catch (submitError) {
      const mappedErrors = syncApiFieldErrors(submitError as ApiError);
      setError(parseEnrollmentSaveError(submitError));
      jumpToFirstErrorSection(mappedErrors);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="enroll-page student-add-panel-wrap">
      <form onSubmit={submit} noValidate>
        <div className="enroll-scroll">
        <div className="top-row">
          <p className="crumbs">
            <a href="/dashboard">Dashboard</a> / <a href="/students/list">Students</a> / <strong>Enroll</strong>
          </p>
          <div className="draft-right">
            <span className="dot-green" />
            <span>{draftLabel}</span>
            <span className="avatar-circle">{currentUserInitials}</span>
          </div>
        </div>

        <div className="page-title-row">
          <div>
            <h1 className="hero-title">
              Enroll a <span className="title-accent">student</span>
            </h1>
            <p className="hero-subtitle">Admit a new student into the school records. We&apos;ll generate an admission number, place them in a class &amp; section, and notify their guardian.</p>
          </div>
          <div className="hero-kpi">
            <p className="hero-kpi-count">{currentEnrolledCount}</p>
            <p className="hero-kpi-label">CURRENTLY ENROLLED</p>
          </div>
        </div>

        {!bannerDismissed ? (
          <div className="scan-banner">
            <div className="scan-left">
              <div className="scan-icon-wrap">QR</div>
              <div>
                <p className="scan-title">Scan to pre-fill <span className="badge-new">NEW</span></p>
                <p className="scan-copy">Got their Aadhaar QR, previous school ID, or pre-admission slip? Scan it once and we&apos;ll fill the form automatically.</p>
              </div>
            </div>
            <div className="scan-actions">
              <button type="button" className="scan-now">Scan now</button>
              <button type="button" className="scan-dismiss" onClick={dismissScanBanner}>X</button>
            </div>
          </div>
        ) : null}

        {error ? <div className="banner-error">{error}</div> : null}

        <div className="enroll-body">
          <aside className="section-nav-wrap">
            <nav className="section-nav" aria-label="Enroll navigation">
              <ul className="section-nav-list">
                {NAV_ITEMS.map((item) => (
                  <li key={item.id} className={activeNavSection === item.id ? "nav-item active" : "nav-item"} data-target={item.id}>
                    <button type="button" className="nav-item-inner" onClick={() => jumpToSection(item.id)}>
                      <span className="nav-bullet">{item.index}</span>
                      <span className="nav-text">
                        <span className="nav-label">{item.label}</span>
                        <span className="nav-copy">{item.description}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <div className="heads-up-card">
                <p className="heads-up-title">Heads up</p>
                <p className="heads-up-body">Fields marked <span className="star">*</span> are required. You can save a draft anytime and come back.</p>
              </div>
            </nav>
          </aside>

          <div className="section-content">
            <section className="section-card" id="identity">
              <div className="section-card-header">
                <div>
                  <h2 className="section-title">Student <span className="title-accent">identity</span></h2>
                  <p className="section-subtitle">Name, photo, date of birth, and a few basics.</p>
                </div>
                <span className="section-counter">01 / 06</span>
              </div>

              <div className="photo-upload-block">
                <button type="button" className={photo ? "photo-circle has-photo" : "photo-circle"} onClick={openStudentFilePicker}>
                  {photo ? <img src={photo} alt="Student" /> : <><span className="camera-icon">+</span><span className="photo-label">ADD PHOTO</span></>}
                </button>
                <div className="photo-meta">
                  <p className="photo-title">Student photo</p>
                  <p className="photo-desc">Square JPG or PNG, at least 400x400px. We&apos;ll crop it into a circle for ID cards and reports.</p>
                  <div className="photo-actions">
                    <button type="button" className="btn-upload-file" onClick={openStudentFilePicker}>{photo ? "Change" : "Upload file"}</button>
                    {photo ? (
                      <>
                        <button type="button" className="btn-upload-file" onClick={() => setPhotoPreviewOpen(true)}>View image</button>
                        <button type="button" className="btn-take-photo" onClick={clearStudentPhoto}>Remove</button>
                      </>
                    ) : (
                      <button type="button" className="btn-take-photo" onClick={openStudentCamera}>Take photo</button>
                    )}
                  </div>
                  <input
                    ref={photoInputRef}
                    id="photo"
                    type="file"
                    accept="image/*"
                    title="Student photo upload"
                    hidden
                    onClick={(event) => {
                      event.currentTarget.value = "";
                    }}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) void uploadStudentPhoto(file);
                    }}
                    disabled={isViewMode || photoUploading}
                  />
                  {fieldErrors.photo ? <p className="error-msg">{fieldErrors.photo}</p> : null}
                </div>
              </div>

              <div className="grid-3">
                <div className="field-wrapper field-inline-action">
                  <label className="field-label">Admission number <span className="req">*</span></label>
                  <input
                    className={fieldErrors.admission_no ? "field-input error" : "field-input"}
                    value={admissionNo}
                    title="Admission number"
                    placeholder="ADM20260342"
                    maxLength={10}
                    onChange={(e) => {
                      setAdmissionNo(e.target.value.slice(0, 10));
                      setIsManualEdit(true);
                      setAdmissionChecked(false);
                      setSingleFieldError("admission_no", "");
                    }}
                    onBlur={() => {
                      const normalized = sanitizeText(admissionNo).replace(/[\s-]/g, "").slice(0, 10);
                      setAdmissionNo(normalized);
                      setIsManualEdit(true);
                      void runAdmissionAvailabilityCheck(normalized);
                    }}
                    readOnly={!admissionNoEditable}
                  />
                  <button type="button" className="edit-btn" onClick={() => setAdmissionNoEditable((prev) => !prev)}>{admissionNoEditable ? "Lock" : "Edit"}</button>
                  <p className="help-text">Auto-generated. Click Edit to customize.</p>
                  {checkingAdmission ? <p className="status-info">Checking availability...</p> : null}
                  {fieldErrors.admission_no ? <p className="error-msg">{fieldErrors.admission_no}</p> : null}
                </div>

                <div className="field-wrapper">
                  <label className="field-label">Roll number <span className="badge badge-assigned-later">ASSIGNED LATER</span></label>
                  <input className="field-input" title="Roll number" value="Auto when class is set" readOnly disabled />
                  <p className="help-text">Rolls are assigned after class allocation.</p>
                </div>

                <div className="field-wrapper">
                  <label className="field-label">Status</label>
                  <div className="status-toggle">
                    <button type="button" className={statusValue === "active" ? "toggle-pill active" : "toggle-pill"} onClick={() => setStatusValue("active")}>Active</button>
                    <button type="button" className={statusValue === "inactive" ? "toggle-pill active" : "toggle-pill"} onClick={() => setStatusValue("inactive")}>Inactive</button>
                  </div>
                </div>
              </div>

              <div className="grid-3 mt-20">
                <div className="field-wrapper"><label className="field-label">First name <span className="req">*</span></label><input className={fieldErrors.first_name ? "field-input error" : "field-input"} value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="e.g. Rahul" />{fieldErrors.first_name ? <p className="error-msg">{fieldErrors.first_name}</p> : null}</div>
                <div className="field-wrapper"><label className="field-label">Middle name <span className="badge badge-optional">OPTIONAL</span></label><input className="field-input" title="Middle name" value={customGender} onChange={(e) => setCustomGender(e.target.value)} placeholder="e.g. Kumar" /></div>
                <div className="field-wrapper"><label className="field-label">Last name <span className="req">*</span></label><input className={fieldErrors.last_name ? "field-input error" : "field-input"} value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="e.g. Sharma" />{fieldErrors.last_name ? <p className="error-msg">{fieldErrors.last_name}</p> : null}</div>
              </div>

              <div className="grid-3 mt-20">
                <div className="field-wrapper"><label className="field-label">Date of birth <span className="req">*</span></label><input type="date" title="Date of birth" className={fieldErrors.dob ? "field-input error" : "field-input"} value={dateOfBirth} max={todayIso} onChange={(e) => { setDateOfBirth(e.target.value); setSingleFieldError("dob", ""); }} />{fieldErrors.dob ? <p className="error-msg">{fieldErrors.dob}</p> : null}</div>
                <div className="field-wrapper"><label className="field-label">Gender <span className="req">*</span></label><select className={fieldErrors.gender ? "field-select error" : "field-select"} title="Gender" value={gender} onChange={(e) => setGender(e.target.value)}><option value="">Select</option><option value="male">Male</option><option value="female">Female</option><option value="other">Other</option></select>{fieldErrors.gender ? <p className="error-msg">{fieldErrors.gender}</p> : null}</div>
                <div className="field-wrapper"><label className="field-label">Blood group <span className="badge badge-optional">OPTIONAL</span></label><select className="field-select" title="Blood group" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)}><option value="">Select</option>{"A+,A-,B+,B-,AB+,AB-,O+,O-".split(",").map((bg) => <option key={bg} value={bg}>{bg}</option>)}</select></div>
              </div>

              <div className="grid-3 mt-20">
                <div className="field-wrapper"><label className="field-label">Mother tongue <span className="req">*</span></label><select className={fieldErrors.mother_tongue ? "field-select error" : "field-select"} title="Mother tongue" value={motherTongue} onChange={(e) => setMotherTongue(e.target.value)}><option value="">Select</option>{MOTHER_TONGUES.map((row) => <option key={row} value={row}>{row}</option>)}</select>{fieldErrors.mother_tongue ? <p className="error-msg">{fieldErrors.mother_tongue}</p> : null}{motherTongue === "Other" ? <input className={fieldErrors.other_mother_tongue ? "field-input error mt-8" : "field-input mt-8"} title="Other mother tongue" value={otherMotherTongue} onChange={(e) => setOtherMotherTongue(e.target.value)} placeholder="Specify language" /> : null}</div>
                <div className="field-wrapper"><label className="field-label">Religion <span className="badge badge-optional">OPTIONAL</span></label><select className="field-select" title="Religion" value={religion} onChange={(e) => setReligion(e.target.value)}><option value="Prefer not to say">Prefer not to say</option><option>Hindu</option><option>Muslim</option><option>Christian</option><option>Sikh</option><option>Buddhist</option><option>Jain</option><option>Other</option></select></div>
                <div className="field-wrapper"><label className="field-label">Nationality <span className="req">*</span></label><select className={fieldErrors.nationality ? "field-select error" : "field-select"} title="Nationality" value={nationality} onChange={(e) => setNationality(e.target.value)}><option value="Indian">Indian</option><option value="Nepali">Nepali</option><option value="Bhutanese">Bhutanese</option><option value="Other">Other</option></select>{nationality === "Other" ? <input className={fieldErrors.other_nationality ? "field-input error mt-8" : "field-input mt-8"} title="Other nationality" value={otherNationality} onChange={(e) => setOtherNationality(e.target.value)} placeholder="Specify nationality" /> : null}</div>
              </div>
              {renderSectionNavButtons("identity")}
            </section>

            <section className="section-card" id="academic">
              <div className="section-card-header"><div><h2 className="section-title">Academic <span className="title-accent">placement</span></h2><p className="section-subtitle">Which year, class, section, and category this student belongs to.</p></div><span className="section-counter">02 / 06</span></div>
              <div className="grid-3">
                <div className="field-wrapper"><label className="field-label">Academic year <span className="req">*</span></label><select className={fieldErrors.academic_year ? "field-select error" : "field-select"} title="Academic year" value={academicYearId} onChange={(e) => setAcademicYearId(e.target.value)}><option value="">Select</option>{validAcademicYears.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.academic_year ? <p className="error-msg">{fieldErrors.academic_year}</p> : null}</div>
                <div className="field-wrapper"><label className="field-label">Class <span className="req">*</span></label><select className={fieldErrors.class ? "field-select error" : "field-select"} title="Class" value={classId} onChange={(e) => setClassId(e.target.value)}><option value="">Choose a class</option>{orderedClasses.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{fieldErrors.class ? <p className="error-msg">{fieldErrors.class}</p> : null}</div>
                <div className="field-wrapper"><label className="field-label">Section <span className="req">*</span></label><select className={fieldErrors.section ? "field-select error" : "field-select"} title="Section" value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId || sectionLoading}><option value="">{classId ? (sectionLoading ? "Loading sections..." : "Select Section") : "Pick class first"}</option>{sections.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>{sectionLoadError ? <p className="error-msg">{sectionLoadError}</p> : null}{fieldErrors.section ? <p className="error-msg">{fieldErrors.section}</p> : null}</div>
              </div>
              {classAgeWarning ? <p className="age-warning">{classAgeWarning}</p> : null}
              <div className="grid-2 mt-20">
                <div className="field-wrapper"><label className="field-label">Category <span className="badge badge-optional">OPTIONAL</span></label><select className={fieldErrors.category ? "field-select error" : "field-select"} title="Category" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}><option value="">Select category</option>{validCategories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></div>
                <div className="field-wrapper"><label className="field-label">Admission type</label><select className="field-select" title="Admission type" value={admissionType} onChange={(e) => setAdmissionType(e.target.value)}><option>New admission</option><option>Transfer</option><option>Re-admission</option><option>RTE Quota</option></select></div>
              </div>
              {admissionType === "Transfer" ? <div className="field-wrapper mt-20"><label className="field-label">Previous school name</label><input className="field-input" title="Previous school name" value={previousSchoolName} onChange={(e) => setPreviousSchoolName(e.target.value)} /></div> : null}
              {admissionType === "RTE Quota" ? <div className="field-wrapper mt-20"><label className="field-label">RTE certificate number <span className="req">*</span></label><input className={fieldErrors.rte_certificate ? "field-input error" : "field-input"} title="RTE certificate number" value={rteCertificateNo} onChange={(e) => setRteCertificateNo(e.target.value)} />{fieldErrors.rte_certificate ? <p className="error-msg">{fieldErrors.rte_certificate}</p> : null}</div> : null}
              {renderSectionNavButtons("academic")}
            </section>

            <section className="section-card" id="contact">
              <div className="section-card-header"><div><h2 className="section-title">Contact & <span className="title-accent">address</span></h2><p className="section-subtitle">How we reach the student and where they live.</p></div><span className="section-counter">03 / 06</span></div>
              <div className="grid-2">
                <div className="field-wrapper"><label className="field-label">Phone <span className="req">*</span></label><input className={fieldErrors.phone ? "field-input error" : "field-input"} title="Phone number" value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))} placeholder="10-digit mobile number" />{fieldErrors.phone ? <p className="error-msg">{fieldErrors.phone}</p> : null}</div>
                <div className="field-wrapper"><label className="field-label">Email <span className="badge badge-recommended">RECOMMENDED</span></label><input className={fieldErrors.email ? "field-input error" : "field-input"} title="Student email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="student@example.com" />{fieldErrors.email ? <p className="error-msg">{fieldErrors.email}</p> : null}</div>
              </div>
              <div className="grid-2 mt-20">
                <div className="field-wrapper"><label className="field-label">Pincode <span className="req">*</span></label><input className={fieldErrors.pincode ? "field-input error" : "field-input"} title="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} maxLength={6} />{pinLookupMessage ? <p className="status-info">{pinLookupMessage}</p> : null}{fieldErrors.pincode ? <p className="error-msg">{fieldErrors.pincode}</p> : null}</div>
                <div className="field-wrapper"><label className="field-label">Address line</label><input className="field-input" title="Address line" value={addressLine} onChange={(e) => setAddressLine(e.target.value)} /></div>
              </div>
              <div className="grid-3 mt-20">
                <div className="field-wrapper"><label className="field-label">State <span className="req">*</span></label>{manualAddressMode ? <input className={fieldErrors.state ? "field-input error" : "field-input"} title="State" value={stateName} onChange={(e) => setStateName(e.target.value)} /> : <select className={fieldErrors.state ? "field-select error" : "field-select"} title="State" value={stateName} onChange={(e) => { const nextState = e.target.value; setStateName(nextState); setDistrict(""); setCity(""); void loadCitiesForState(nextState); }} disabled={!pinIsValid}><option value="">Select State</option>{stateOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>}{fieldErrors.state ? <p className="error-msg">{fieldErrors.state}</p> : null}</div>
                <div className="field-wrapper"><label className="field-label">District <span className="req">*</span></label><input className={fieldErrors.district ? "field-input error" : "field-input"} title="District" value={district} onChange={(e) => setDistrict(e.target.value)} disabled={!manualAddressMode && !pinIsValid} />{fieldErrors.district ? <p className="error-msg">{fieldErrors.district}</p> : null}</div>
                <div className="field-wrapper"><label className="field-label">City <span className="req">*</span></label>{manualAddressMode || cityOptions.length === 0 ? <input className={fieldErrors.city ? "field-input error" : "field-input"} title="City" value={city} onChange={(e) => setCity(e.target.value)} disabled={!manualAddressMode && !pinIsValid} /> : <select className={fieldErrors.city ? "field-select error" : "field-select"} title="City" value={city} onChange={(e) => setCity(e.target.value)}><option value="">Select City</option>{cityOptions.map((item) => <option key={item} value={item}>{item}</option>)}</select>}{fieldErrors.city ? <p className="error-msg">{fieldErrors.city}</p> : null}</div>
              </div>
              {renderSectionNavButtons("contact")}
            </section>

            <StudentGuardiansStep
              drafts={guardianDrafts}
              onDraftsChange={(next) => {
                setGuardianDrafts(next);
                setGuardianCardErrors(next.map(() => ({})));
                setGuardianSubmitError(null);
                // Live-clear the "at least one guardian required" error as soon
                // as any draft has its 3 required fields filled (or is linked
                // to an existing guardian).
                const hasValidGuardian = next.some((d) => {
                  if (d.linkedExistingId != null) return true;
                  return !!(d.fullName?.trim() && d.relation?.trim() && d.phone?.trim());
                });
                if (hasValidGuardian) {
                  setFieldErrors((prev) => {
                    if (!prev.guardian) return prev;
                    const { guardian: _removed, ...rest } = prev;
                    return rest;
                  });
                }
              }}
              existingGuardians={guardians}
              sectionCounter="04 / 06"
              errorsByCard={guardianCardErrors}
              submitError={guardianSubmitError ?? fieldErrors.guardian ?? null}
              navButtonsSlot={renderSectionNavButtons("guardians")}
            />

            <StudentDocumentsUpload
              documents={documents}
              onPickFile={handleDocumentPick}
              consentChecked={consentChecked}
              onConsentChange={setConsentChecked}
              consentError={fieldErrors.consent}
              sectionCounter="05 / 06"
              navButtonsSlot={renderSectionNavButtons("documents")}
            />

            {/* REVIEW SECTION */}
            <section className="section-card" id="review">
              <div className="section-card-header">
                <div>
                  <h2 className="section-title">Final <span className="title-accent">review</span></h2>
                  <p className="section-subtitle">Double-check before you save. You can edit any section above.</p>
                </div>
                <span className="section-counter">06 / 06</span>
              </div>

              <div className="review-summary-grid">
                <div className="review-item">
                  <div className="review-label">ADMISSION NO</div>
                  <div className="review-value">{admissionNo || "Not yet entered"}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">FULL NAME</div>
                  <div className="review-value">{[firstName, lastName].filter(Boolean).join(" ") || "Not yet entered"}</div>
                </div>
                <div className="review-item">
                  <div className="review-label">CLASS / SECTION</div>
                  <div className="review-value">
                    {selectedClass || selectedSection
                      ? `${selectedClass?.name || classId} / ${selectedSection?.name || sectionId}`
                      : "Not yet entered"}
                  </div>
                </div>
                <div className="review-item">
                  <div className="review-label">CONTACT</div>
                  <div className="review-value">{phone || "Not yet entered"}</div>
                </div>
              </div>

              {renderSectionNavButtons("review")}
            </section>
          </div>
        </div>

        </div>{/* /.enroll-scroll */}

        <footer className="enroll-footer">
          <div className="footer-progress-wrap" aria-label="Enrollment progress">
            <span className="footer-progress-label">Progress</span>
            <div className="footer-progress-track" title="Enrollment progress">
              <span className={`footer-progress-fill ${footerProgressClass}`} />
            </div>
            <span className="footer-progress-value">{footerProgressPercent}% complete</span>
          </div>

          {error ? <p className="footer-status footer-status-error">{error}</p> : null}

          <div className="footer-actions">
            <button type="button" className="btn-discard" onClick={clearDraftNow}>Discard</button>
            <button type="button" className="btn-draft" onClick={saveDraftNow}>Save draft</button>
            {isViewMode && studentId ? (
              <Link href={`/students/add?mode=edit&id=${studentId}`} className="btn-save btn-save-cta">Edit student →</Link>
            ) : (
              <button type="submit" disabled={!canSubmit} className="btn-save btn-save-cta">{saving ? "Saving..." : isEditMode ? "Update student →" : "Enroll student →"}</button>
            )}
          </div>
        </footer>
      </form>

      {photoPreviewOpen && photo ? (
        <div role="dialog" aria-modal="true" aria-label="Student photo preview" onClick={() => setPhotoPreviewOpen(false)} className="photo-preview-overlay">
          <div onClick={(event) => event.stopPropagation()} className="photo-preview-card">
            <button type="button" onClick={() => setPhotoPreviewOpen(false)} aria-label="Close photo preview" className="photo-preview-close">
              X
            </button>
            <img src={photo} alt="Student full preview" className="photo-preview-image" />
          </div>
        </div>
      ) : null}

      {cameraOpen ? (
        <div role="dialog" aria-modal="true" aria-label="Capture student photo" onClick={closeStudentCamera} className="camera-overlay">
          <div className="camera-card" onClick={(event) => event.stopPropagation()}>
            <div className="camera-head">
              <div>
                <h3>Take photo</h3>
                <p>Use your camera to capture the student photo.</p>
              </div>
              <button type="button" className="camera-close" onClick={closeStudentCamera} aria-label="Close camera">X</button>
            </div>
            <div className="camera-body">
              {cameraError ? <p className="camera-error">{cameraError}</p> : null}
              {capturedPhotoPreviewUrl ? (
                <img src={capturedPhotoPreviewUrl} alt="Captured student preview" className="camera-preview-image" />
              ) : (
                <video ref={cameraVideoRef} className="camera-video" autoPlay playsInline muted />
              )}
            </div>
            <div className="camera-actions">
              {capturedPhotoPreviewUrl ? (
                <>
                  <button type="button" className="btn-upload-file" onClick={retakeCapturedPhoto} disabled={photoUploading}>Retake</button>
                  <button type="button" className="btn-take-photo" onClick={() => void applyCapturedPhoto()} disabled={photoUploading}>Use photo</button>
                </>
              ) : (
                <>
                  <button type="button" className="btn-take-photo" onClick={captureStudentPhoto} disabled={photoUploading}>Capture</button>
                  <button type="button" className="btn-upload-file" onClick={closeStudentCamera}>Cancel</button>
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div className={toastType === "success" ? "save-toast save-toast-success" : "save-toast save-toast-error"} role="status" aria-live="polite">
          {toastMessage}
        </div>
      ) : null}

      <style jsx>{`
        /* Root fills the available <main> area AND bleeds through
           .dashboard-main's 18px padding so the footer can span full width. */
        .enroll-page {
          --brand: #6c3ce1;
          --ink: #111827;
          --muted: #6b7280;
          --line: #e5e7eb;
          --bg: #fafafb;
          color: var(--ink);
          height: 100%;
          margin: -18px;
          display: flex;
          flex-direction: column;
          min-width: 0;
          min-height: 0;
        }

        .student-add-panel-wrap form {
          flex: 1;
          min-width: 0;
          min-height: 0;
          display: flex;
          flex-direction: column;
          overflow: visible;
        }

        /* The only scrollable region on this page. Internal padding restores
           gutters that .enroll-page's negative margin bled out.
           overflow-x: hidden + min-width: 0 prevent children (wide grids,
           long labels) from forcing the container to grow sideways at
           narrow widths. */
        .enroll-scroll {
          flex: 1;
          min-width: 0;
          min-height: 0;
          overflow-y: auto;
          overflow-x: hidden;
          padding: 18px;
        }

        /* Action bar — lives OUTSIDE .enroll-scroll so it's always visible.
           flex-shrink: 0 keeps it at its natural height; the scroll sibling
           (flex: 1) takes all remaining vertical space. */
        .enroll-footer {
          flex-shrink: 0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 16px;
          min-height: 72px;
          background: #ffffff;
          border-top: 1px solid #ececf2;
          padding: 14px 24px;
          box-shadow: 0 -4px 12px rgba(15, 23, 42, 0.05);
          z-index: 40;
        }

        .top-row,
        .page-title-row,
        .scan-banner,
        .banner-error,
        .enroll-body {
          width: 100%;
          max-width: none;
          margin-left: 0;
          margin-right: 0;
        }

        .top-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin: 0 0 16px;
        }

        .crumbs {
          font-size: 13px;
          color: var(--muted);
          margin: 0;
        }

        .crumbs a {
          color: var(--muted);
          text-decoration: none;
        }

        .draft-right {
          display: flex;
          align-items: center;
          gap: 10px;
          color: var(--muted);
          font-size: 13px;
        }

        .dot-green {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #10b981;
        }

        .avatar-circle {
          width: 32px;
          height: 32px;
          border-radius: 50%;
          background: var(--brand);
          color: #fff;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          font-weight: 700;
        }

        .page-title-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
          gap: 20px;
          padding: 0;
        }

        .hero-title {
          margin: 0;
          font-size: 40px;
          font-weight: 700;
          font-family: var(--font-playfair-display), Georgia, "Times New Roman", serif;
          letter-spacing: -0.02em;
          line-height: 1.1;
        }

        .title-accent {
          color: var(--brand);
          font-style: italic;
          font-family: var(--font-playfair-display), Georgia, "Times New Roman", serif;
          font-weight: 400;
        }

        .hero-subtitle {
          max-width: 520px;
          color: var(--muted);
          line-height: 1.5;
          margin-top: 8px;
          font-size: 14px;
        }

        .hero-kpi {
          text-align: right;
        }

        .hero-kpi-count {
          font-size: 40px;
          font-weight: 700;
          margin: 0;
        }

        .hero-kpi-label {
          margin: 4px 0 0;
          font-size: 11px;
          letter-spacing: 0.1em;
          color: var(--muted);
          font-weight: 600;
        }

        .scan-banner {
          background: #1a1a2e;
          border-radius: 12px;
          padding: 20px 24px;
          margin: 0 0 24px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .scan-left {
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }

        .scan-icon-wrap {
          width: 40px;
          height: 40px;
          border-radius: 8px;
          background: rgba(108, 60, 225, 0.8);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
        }

        .scan-title {
          color: #fff;
          font-size: 15px;
          font-weight: 700;
          margin: 0;
        }

        .badge-new {
          margin-left: 8px;
          background: #10b981;
          color: #fff;
          border-radius: 999px;
          padding: 2px 8px;
          font-size: 10px;
          font-weight: 600;
        }

        .scan-copy {
          color: #9ca3af;
          margin: 4px 0 0;
          font-size: 13px;
          line-height: 1.5;
        }

        .scan-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .scan-now {
          border: none;
          background: var(--brand);
          color: #fff;
          border-radius: 8px;
          padding: 10px 20px;
          cursor: pointer;
        }

        .scan-dismiss {
          width: 32px;
          height: 32px;
          border-radius: 6px;
          border: none;
          background: rgba(255, 255, 255, 0.15);
          color: #fff;
          cursor: pointer;
        }

        .banner-error,
        .banner-success {
          width: 100%;
          margin: 0 0 12px;
          border-radius: 8px;
          padding: 10px 12px;
          font-size: 13px;
        }

        .banner-error {
          color: #b91c1c;
          background: #fee2e2;
          border: 1px solid #fecaca;
        }

        .banner-success {
          color: #065f46;
          background: #d1fae5;
          border: 1px solid #a7f3d0;
        }

        .enroll-body {
          display: flex;
          gap: 24px;
          align-items: flex-start;
          overflow: visible;
        }

        .section-nav-wrap {
          --sidebar-stick-top: 10px;
          position: sticky;
          top: var(--sidebar-stick-top);
          width: 280px;
          height: fit-content;
          max-height: calc(100vh - var(--sidebar-stick-top) - 12px);
          flex-shrink: 0;
          align-self: flex-start;
          z-index: 2;
        }

        .section-nav {
          max-height: inherit;
          overflow-y: auto;
          overscroll-behavior: contain;
          padding-right: 4px;
        }

        .section-nav-list {
          list-style: none;
          margin: 0;
          padding: 0;
        }

        .nav-item {
          position: relative;
          margin-bottom: 4px;
        }

        .nav-item-inner {
          width: 100%;
          border: none;
          background: transparent;
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 8px 12px 8px 8px;
          border-radius: 6px;
          cursor: pointer;
          text-align: left;
        }

        .nav-item-inner:hover {
          background: #f3f4f6;
        }

        .nav-bullet {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          background: #f3f4f6;
          color: #9ca3af;
          border: 1px solid #e5e7eb;
        }

        .nav-label {
          font-size: 14px;
          color: #6b7280;
          line-height: 1.2;
        }

        .nav-text {
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .nav-copy {
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.3;
        }

        .nav-item.active::before {
          content: "";
          position: absolute;
          left: 0;
          top: 4px;
          bottom: 4px;
          width: 3px;
          border-radius: 0 2px 2px 0;
          background: var(--brand);
        }

        .nav-item.active .nav-bullet {
          background: var(--brand);
          color: #fff;
          border-color: var(--brand);
        }

        .nav-item.active .nav-item-inner {
          background: #f5f3ff;
        }

        .nav-item.active .nav-label {
          color: var(--brand);
          font-weight: 600;
        }

        .nav-item.active .nav-copy {
          color: #6d28d9;
        }

        .heads-up-card {
          margin-top: 20px;
          background: #ede9fe;
          border-radius: 8px;
          padding: 12px 14px;
        }

        .heads-up-title {
          margin: 0 0 4px;
          font-size: 13px;
          font-weight: 700;
        }

        .heads-up-body {
          margin: 0;
          font-size: 12px;
          color: #6b7280;
          line-height: 1.5;
        }

        .star {
          color: #dc2626;
          font-weight: 700;
        }

        .section-nav-buttons {
          display: flex;
          gap: 12px;
          margin-top: 28px;
          justify-content: space-between;
        }

        .btn-nav-prev {
          padding: 10px 20px;
          border: 1px solid var(--line);
          background: transparent;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          color: var(--ink);
          transition: all 0.2s ease;
        }

        .btn-nav-prev:hover {
          background: #f3f4f6;
          border-color: #d1d5db;
        }

        .btn-nav-next {
          padding: 10px 20px;
          border: 1px solid var(--primary);
          background: var(--primary);
          color: #fff;
          border-radius: 8px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
          transition: all 0.2s ease;
        }

        .btn-nav-next:hover {
          opacity: 0.9;
          transform: translateY(-1px);
        }

        .section-content {
          flex: 1;
          min-width: 0;
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .section-card {
          background: #fff;
          border: 1px solid #e5e7eb;
          border-radius: 12px;
          padding: 24px;
          scroll-margin-top: 108px;
        }

        .section-card-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 24px;
        }

        .section-title {
          font-size: 28px;
          margin: 0;
          font-weight: 700;
          font-family: var(--font-playfair-display), Georgia, "Times New Roman", serif;
          letter-spacing: -0.015em;
          line-height: 1.15;
        }

        .section-subtitle {
          margin: 6px 0 0;
          font-size: 14px;
          color: #6b7280;
        }

        .section-counter {
          font-size: 13px;
          color: #9ca3af;
          margin-left: 16px;
          white-space: nowrap;
        }

        .grid-3 {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
        }

        .grid-2 {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }

        .field-wrapper {
          min-width: 0;
        }

        .field-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 500;
          color: #374151;
          margin-bottom: 6px;
        }

        .req {
          color: #dc2626;
          font-weight: 700;
        }

        .field-input,
        .field-select,
        .field-textarea {
          width: 100%;
          min-width: 0;              /* critical: lets inputs shrink inside narrow grid cells */
          max-width: 100%;
          padding: 10px 12px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          font-size: 14px;
          background: #fff;
          box-sizing: border-box;
        }

        .field-input:focus,
        .field-select:focus,
        .field-textarea:focus {
          border-color: var(--brand);
          box-shadow: 0 0 0 3px rgba(108, 60, 225, 0.12);
          outline: none;
        }

        .field-input.error,
        .field-select.error,
        .field-textarea.error {
          border-color: #dc2626;
          background: #fef2f2;
        }

        .help-text {
          font-size: 12px;
          color: #6b7280;
          margin-top: 4px;
        }

        .error-msg {
          font-size: 12px;
          color: #dc2626;
          margin: 4px 0 0;
        }

        .status-info {
          font-size: 12px;
          color: #6b7280;
          margin: 4px 0 0;
        }

        .badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 7px;
          border-radius: 999px;
        }

        .badge-optional,
        .badge-assigned-later {
          background: #f3f4f6;
          color: #6b7280;
        }

        .badge-recommended {
          background: #ecfdf5;
          color: #065f46;
        }

        .badge-required-doc {
          background: #fef3c7;
          color: #92400e;
        }

        .field-inline-action {
          position: relative;
        }

        .edit-btn {
          position: absolute;
          right: 10px;
          top: 34px;
          border: none;
          background: transparent;
          color: var(--brand);
          cursor: pointer;
          font-size: 12px;
        }

        .photo-upload-block {
          display: flex;
          align-items: flex-start;
          gap: 24px;
          margin-bottom: 24px;
        }

        .photo-circle {
          width: 128px;
          height: 128px;
          border-radius: 50%;
          border: 2px dashed #d1d5db;
          background: #fafafa;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
        }

        .photo-circle.has-photo {
          border: none;
          overflow: hidden;
        }

        .photo-circle img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .camera-icon {
          font-size: 26px;
          color: #9ca3af;
        }

        .photo-label {
          font-size: 9px;
          letter-spacing: 0.12em;
          color: #9ca3af;
          margin-top: 6px;
        }

        .photo-title {
          margin: 0 0 4px;
          font-size: 14px;
          font-weight: 600;
        }

        .photo-desc {
          margin: 0 0 12px;
          font-size: 12px;
          color: #6b7280;
          line-height: 1.4;
        }

        .photo-actions {
          display: flex;
          gap: 12px;
        }

        .btn-upload-file {
          padding: 7px 14px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
          text-decoration: none;
          color: #374151;
          font-size: 13px;
        }

        .btn-take-photo {
          border: none;
          background: none;
          color: var(--brand);
          text-decoration: underline;
          cursor: pointer;
          font-size: 13px;
        }

        .status-toggle {
          display: flex;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          overflow: hidden;
        }

        .toggle-pill {
          flex: 1;
          border: none;
          background: #f9fafb;
          color: #6b7280;
          padding: 10px 0;
          cursor: pointer;
        }

        .toggle-pill.active {
          background: var(--brand);
          color: #fff;
          font-weight: 600;
        }

        .doc-check {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
        }

        .consent-row {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
        }

        .review-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }

        .age-warning {
          margin: 12px 0 0;
          border: 1px solid #f59e0b;
          background: #fffbeb;
          color: #92400e;
          border-radius: 8px;
          padding: 8px 10px;
          font-size: 12px;
        }

        /* .sticky-footer / .sticky-footer-inner rules removed — the action bar
           is now .enroll-footer, a flex sibling of .enroll-scroll (not sticky). */

        .footer-progress-wrap {
          display: flex;
          align-items: center;
          gap: 12px;
          min-width: 320px;
          max-width: 52%;
          flex: 1;
        }

        .footer-progress-label {
          font-size: 13px;
          color: #6b7280;
          white-space: nowrap;
        }

        .footer-progress-track {
          position: relative;
          width: 220px;
          height: 6px;
          border-radius: 999px;
          background: #e5e7eb;
          overflow: hidden;
          flex-shrink: 0;
        }

        .footer-progress-fill {
          display: block;
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, #6c3ce1 0%, #4f39f6 100%);
          transition: width 0.25s ease;
          width: 0;
        }

        .footer-progress-fill.progress-fill-0 { width: 0%; }
        .footer-progress-fill.progress-fill-10 { width: 10%; }
        .footer-progress-fill.progress-fill-20 { width: 20%; }
        .footer-progress-fill.progress-fill-30 { width: 30%; }
        .footer-progress-fill.progress-fill-40 { width: 40%; }
        .footer-progress-fill.progress-fill-50 { width: 50%; }
        .footer-progress-fill.progress-fill-60 { width: 60%; }
        .footer-progress-fill.progress-fill-70 { width: 70%; }
        .footer-progress-fill.progress-fill-80 { width: 80%; }
        .footer-progress-fill.progress-fill-90 { width: 90%; }
        .footer-progress-fill.progress-fill-100 { width: 100%; }

        .footer-progress-value {
          font-size: 14px;
          font-weight: 600;
          color: #6b7280;
          white-space: nowrap;
        }

        .footer-actions {
          display: flex;
          gap: 14px;
          align-items: center;
          flex-shrink: 0;
        }

        .btn-discard {
          border: none;
          background: transparent;
          color: #6b7280;
          cursor: pointer;
          font-size: 14px;
          padding: 8px 4px;
        }

        .btn-discard:hover {
          color: #374151;
        }

        .btn-draft {
          padding: 12px 22px;
          border: 1px solid #d1d5db;
          border-radius: 14px;
          background: #fff;
          color: #374151;
          cursor: pointer;
          font-size: 14px;
          line-height: 1.2;
          text-decoration: none;
        }

        .btn-draft:hover {
          border-color: #9ca3af;
          background: #f9fafb;
        }

        .footer-status {
          margin: 0;
          padding: 6px 10px;
          border-radius: 8px;
          font-size: 12px;
          max-width: 55%;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          border: 1px solid transparent;
        }

        .footer-status-success {
          color: #065f46;
          background: #d1fae5;
          border-color: #a7f3d0;
        }

        .footer-status-error {
          color: #b91c1c;
          background: #fee2e2;
          border-color: #fecaca;
        }

        .save-toast {
          position: fixed;
          right: 18px;
          top: 20px;
          z-index: 1200;
          min-width: 240px;
          max-width: min(420px, calc(100vw - 24px));
          border-radius: 10px;
          padding: 12px 14px;
          font-size: 13px;
          font-weight: 500;
          box-shadow: 0 10px 30px rgba(15, 23, 42, 0.2);
          border: 1px solid transparent;
        }

        .save-toast-success {
          color: #065f46;
          background: #d1fae5;
          border-color: #a7f3d0;
        }

        .save-toast-error {
          color: #b91c1c;
          background: #fee2e2;
          border-color: #fecaca;
        }

        .btn-cancel {
          padding: 9px 14px;
          border: 1px solid #d1d5db;
          border-radius: 8px;
          text-decoration: none;
          color: #374151;
          font-size: 14px;
        }

        .btn-save {
          padding: 12px 26px;
          border: 1px solid var(--brand);
          background: var(--brand);
          color: #fff;
          border-radius: 14px;
          cursor: pointer;
          text-decoration: none;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 8px 22px rgba(79, 57, 246, 0.2);
        }

        .btn-save-cta:hover {
          background: #5a2ee0;
          border-color: #5a2ee0;
        }

        .btn-green {
          padding: 9px 14px;
          border: 1px solid #0f766e;
          background: #0f766e;
          color: #fff;
          border-radius: 8px;
          cursor: pointer;
        }

        .photo-preview-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.68);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 16px;
        }

        .photo-preview-card {
          position: relative;
          max-width: 720px;
          width: 100%;
          background: #fff;
          border-radius: 12px;
          padding: 12px;
          border: 1px solid #e2e8f0;
        }

        .photo-preview-close {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #cbd5e1;
          background: #fff;
          cursor: pointer;
          font-weight: 700;
        }

        .photo-preview-image {
          width: 100%;
          max-height: 80vh;
          object-fit: contain;
          border-radius: 8px;
          background: #f8fafc;
        }

        .camera-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.72);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1100;
          padding: 16px;
        }

        .camera-card {
          width: min(600px, 95%);
          max-height: 85vh;
          background: #fff;
          border-radius: 14px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
          box-shadow: 0 18px 50px rgba(15, 23, 42, 0.28);
          display: flex;
          flex-direction: column;
        }

        .camera-head {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 12px;
          padding: 16px 18px;
          border-bottom: 1px solid #e5e7eb;
        }

        .camera-head h3 {
          margin: 0;
          font-size: 18px;
          color: #111827;
        }

        .camera-head p {
          margin: 4px 0 0;
          font-size: 13px;
          color: #6b7280;
        }

        .camera-close {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #d1d5db;
          background: #fff;
          cursor: pointer;
          font-weight: 700;
        }

        .camera-body {
          padding: 16px 18px;
          background: #0f172a;
          flex: 1;
          overflow-y: auto;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .camera-video {
          width: 100%;
          max-height: 50vh;
          aspect-ratio: 4 / 3;
          object-fit: cover;
          background: #020617;
          border-radius: 12px;
        }

        .camera-preview-image {
          width: 100%;
          max-height: 50vh;
          aspect-ratio: 4 / 3;
          object-fit: contain;
          background: #020617;
          border-radius: 12px;
        }

        .camera-error {
          margin: 0 0 12px;
          color: #fecaca;
          font-size: 13px;
        }

        .camera-actions {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 18px 18px;
          background: #fff;
        }

        .mt-20 {
          margin-top: 20px;
        }

        .mt-8 {
          margin-top: 8px;
        }

        /* Review Section */
        .review-summary-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
          background: #F8F9FB;
          padding: 20px;
          border-radius: 12px;
        }

        .review-item {
          display: flex;
          flex-direction: column;
        }

        .review-label {
          font-size: 11px;
          letter-spacing: 0.1em;
          font-weight: 600;
          color: #64748B;
          margin-bottom: 6px;
        }

        .review-value {
          font-size: 14px;
          color: #111827;
          line-height: 1.5;
        }

        /* ============================================================
           MEDIUM BREAKPOINT (≤1280px): keep Claude-style two-column
           layout — stepper on the left (vertical, readable labels),
           form on the right. Just narrow the stepper column so the
           form has room to breathe.
           ============================================================ */
        @media (max-width: 1280px) {
          .hero-title {
            font-size: 32px;
          }
          .section-title {
            font-size: 24px;
          }
          .section-card {
            padding: 20px;
          }
          .grid-3 {
            grid-template-columns: repeat(2, 1fr);
          }

          /* Narrow stepper column but keep it vertical with full labels. */
          .section-nav-wrap {
            width: 220px;
            min-width: 220px;
            flex-shrink: 0;
          }

          /* Defensive: never clip, ellipsize, or hide step text. */
          .nav-label,
          .nav-copy {
            white-space: normal;
            overflow: visible;
            text-overflow: unset;
          }
          .nav-text {
            min-width: 0;
            white-space: normal;
          }
        }

        @media (max-width: 1024px) {
          /* Wrap footer onto 2 rows so Progress bar + 3 buttons don't collide. */
          .enroll-footer {
            flex-wrap: wrap;
            padding: 12px 16px;
          }
          .footer-progress-wrap {
            min-width: 0;
            max-width: 100%;
            flex: 1 1 100%;
          }
          .footer-actions {
            flex: 0 0 auto;
            margin-left: auto;
          }
        }

        /* ============================================================
           MOBILE (≤900px): at this width the global sidebar also
           stacks on top (Sidebar.module.css) — the stepper column
           can't fit alongside the form anymore, so flatten it to a
           horizontal pill strip above the form.
           ============================================================ */
        @media (max-width: 900px) {
          .enroll-body {
            flex-direction: column;
          }

          .section-nav-wrap {
            position: relative;
            top: auto;
            width: 100%;
            min-width: 0;
            max-height: none;
            background: #ffffff;
            border: 1px solid #e5e7eb;
            border-radius: 12px;
            padding: 10px 12px;
            z-index: 5;
          }

          .section-nav {
            max-height: none;
            overflow-x: auto;
            overflow-y: visible;
            padding-right: 0;
            scrollbar-width: thin;
          }

          .section-nav-list {
            display: flex;
            flex-direction: row;
            gap: 6px;
            align-items: stretch;
          }

          .nav-item {
            margin-bottom: 0;
            flex-shrink: 0;
          }

          .nav-item-inner {
            align-items: center;
            gap: 8px;
            padding: 6px 12px 6px 8px;
            white-space: nowrap;
            border-radius: 999px;
          }

          /* Compact mode only — sub-copy dropped on mobile to fit in a row. */
          .nav-copy {
            display: none;
          }

          .nav-item.active::before {
            display: none;
          }
          .nav-item.active .nav-item-inner {
            background: #ede9fe;
          }
        }

        @media (max-width: 768px) {
          .grid-3,
          .grid-2,
          .review-grid {
            grid-template-columns: 1fr;
          }

          .review-summary-grid {
            grid-template-columns: 1fr;
          }

          .page-title-row,
          .top-row,
          .scan-banner {
            flex-direction: column;
            align-items: flex-start;
          }

          .hero-kpi {
            text-align: left;
          }

          .scan-actions {
            width: 100%;
          }

          .enroll-footer {
            width: 100%;
            flex-direction: column;
            align-items: stretch;
            padding: 14px 16px;
          }

          .footer-progress-wrap,
          .footer-actions {
            width: 100%;
            max-width: 100%;
          }

          .footer-actions {
            justify-content: space-between;
          }

          .footer-progress-track {
            width: 100%;
          }

          .footer-status {
            max-width: 100%;
            white-space: normal;
          }
        }
      `}</style>
    </div>
  );
}
