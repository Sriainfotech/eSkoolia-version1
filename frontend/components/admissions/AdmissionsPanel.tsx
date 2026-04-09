"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { validateMeaningfulText } from "@/lib/meaningfulText";
import { DateConfirmDialog } from "@/components/common/DateConfirmDialog";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";

type ApiList<T> = T[] | { results?: T[] };

type Inquiry = {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  query_date: string | null;
  follow_up_date: string | null;
  next_follow_up_date: string | null;
  assigned: string;
  reference: number | null;
  reference_name?: string;
  source: number | null;
  source_name?: string;
  school_class: number | null;
  class_name_resolved?: string;
  no_of_child: number;
  active_status: number;
  status: string;
  note: string;
};

type AdminSetup = {
  id: number;
  type: "1" | "2" | "3" | "4";
  name: string;
};

type SchoolClass = {
  id: number;
  name: string;
};

type InquiryForm = {
  full_name: string;
  phone: string;
  email: string;
  address: string;
  pincode: string;
  state_name: string;
  district_name: string;
  post_office_name: string;
  description: string;
  query_date: string;
  next_follow_up_date: string;
  assigned: string;
  reference: string;
  source: string;
  school_class: string;
  no_of_child: string;
  active_status: "1" | "2";
  status: string;
  note: string;
};

type PincodeLookupResponse = {
  success: boolean;
  message?: string;
  field_errors?: Record<string, string | string[]>;
  data?: {
    pincode: string;
    state: string;
    district: string;
    post_office: string;
    multiple_post_offices: boolean;
    post_offices: Array<{
      name: string;
      district: string;
      state: string;
    }>;
  };
};

type SortKey = "full_name" | "query_date" | "next_follow_up_date";

type SortDir = "asc" | "desc";

type DateConfirmState = {
  title: string;
  message: string;
  resolve: (value: boolean) => void;
} | null;

const initialForm = (): InquiryForm => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    full_name: "",
    phone: "",
    email: "",
    address: "",
    pincode: "",
    state_name: "",
    district_name: "",
    post_office_name: "",
    description: "",
    query_date: today,
    next_follow_up_date: today,
    assigned: "",
    reference: "",
    source: "",
    school_class: "",
    no_of_child: "1",
    active_status: "1",
    status: "new",
    note: "",
  };
};

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function boxStyle() {
  return {
    background: "var(--surface)",
    border: "1px solid var(--line)",
    borderRadius: "var(--radius)",
    padding: 16,
  } as const;
}

function fieldStyle(hasError = false) {
  return {
    width: "100%",
    minHeight: 36,
    border: `1px solid ${hasError ? "#dc3545" : "#ced4da"}`,
    borderRadius: 8,
    padding: "0 10px",
  } as const;
}

function textAreaStyle(hasError = false) {
  return {
    width: "100%",
    minHeight: 72,
    border: `1px solid ${hasError ? "#dc3545" : "#ced4da"}`,
    borderRadius: 8,
    padding: "8px 10px",
    resize: "vertical" as const,
  };
}

function buttonStyle(color = "var(--primary)") {
  return {
    height: 36,
    border: `1px solid ${color}`,
    background: color,
    color: "#fff",
    borderRadius: 8,
    padding: "0 12px",
    cursor: "pointer",
    fontSize: 13,
  } as const;
}

function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDisplayDate(value?: string | null) {
  if (!value) return "-";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return [
    String(date.getDate()).padStart(2, "0"),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getFullYear()),
  ].join("/");
}

function isSameDate(value: string | null | undefined, target: string) {
  if (!value) return false;
  return value === target;
}

function SectionDivider({ title }: { title: string }) {
  return (
    <div className="aq-divider" aria-hidden="true">
      <span>{title}</span>
    </div>
  );
}

function sourceSlug(value: string) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "newspaper ad") return "source-newspaper-ad";
  if (raw === "phone call") return "source-phone-call";
  if (raw === "referral") return "source-referral";
  if (raw === "school event") return "source-school-event";
  if (raw === "social media") return "source-social-media";
  if (raw === "walk-in") return "source-walk-in";
  if (raw === "website") return "source-website";
  return "source-default";
}

function parseComposedAddress(value: string) {
  const source = String(value || "").trim();
  if (!source) {
    return {
      addressLine: "",
      postOffice: "",
      district: "",
      state: "",
      pincode: "",
    };
  }

  const postOfficeMatch = source.match(/(?:^|,\s*)Post Office:\s*([^,]+)(?=,|$)/i);
  const districtMatch = source.match(/(?:^|,\s*)District:\s*([^,]+)(?=,|$)/i);
  const stateMatch = source.match(/(?:^|,\s*)State:\s*([^,]+)(?=,|$)/i);
  const pincodeMatch = source.match(/(?:^|,\s*)PIN:\s*(\d{6})(?=,|$)/i);

  const cleanedAddress = source
    .replace(/(?:^|,\s*)Post Office:\s*[^,]+(?=,|$)/gi, "")
    .replace(/(?:^|,\s*)District:\s*[^,]+(?=,|$)/gi, "")
    .replace(/(?:^|,\s*)State:\s*[^,]+(?=,|$)/gi, "")
    .replace(/(?:^|,\s*)PIN:\s*\d{6}(?=,|$)/gi, "")
    .replace(/^,\s*|,\s*$/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  return {
    addressLine: cleanedAddress,
    postOffice: (postOfficeMatch?.[1] || "").trim(),
    district: (districtMatch?.[1] || "").trim(),
    state: (stateMatch?.[1] || "").trim(),
    pincode: (pincodeMatch?.[1] || "").trim(),
  };
}

export function AdmissionsPanel() {
  const router = useRouter();
  const [items, setItems] = useState<Inquiry[]>([]);
  const [sources, setSources] = useState<AdminSetup[]>([]);
  const [references, setReferences] = useState<AdminSetup[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<InquiryForm>(initialForm());
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filterErrors, setFilterErrors] = useState<Record<string, string>>({});
  const [rowActions, setRowActions] = useState<Record<number, "" | "add_query" | "edit" | "delete">>({});

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("query_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [dateConfirm, setDateConfirm] = useState<DateConfirmState>(null);
  const [deleteTarget, setDeleteTarget] = useState<Inquiry | null>(null);
  const [pincodeLookupLoading, setPincodeLookupLoading] = useState(false);
  const [pincodeLookupInfo, setPincodeLookupInfo] = useState("");
  const [postOfficeOptions, setPostOfficeOptions] = useState<Array<{ name: string; district: string; state: string }>>([]);

  const lastPincodeLookupRef = useRef("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const sixtyDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 60);
    return d.toISOString().slice(0, 10);
  }, []);
  const fortyFiveDaysAhead = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 45);
    return d.toISOString().slice(0, 10);
  }, []);

  const askDateConfirmation = (title: string, message: string) =>
    new Promise<boolean>((resolve) => {
      setDateConfirm({ title, message, resolve });
    });

  const handleDateConfirmResult = (accepted: boolean) => {
    if (!dateConfirm) return;
    dateConfirm.resolve(accepted);
    setDateConfirm(null);
  };

  const setFormValue = (key: keyof InquiryForm, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const validateSearchDates = (from: string, to: string) => {
    const nextErrors: Record<string, string> = {};
    if (from && to && from > to) {
      nextErrors.date_from = "Date From cannot be after Date To.";
      nextErrors.date_to = "Date To cannot be before Date From.";
    }
    setFilterErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const loadOptions = async () => {
    const [setupData, classData] = await Promise.all([
      apiRequestWithRefresh<ApiList<AdminSetup>>("/api/v1/admissions/admin-setups/"),
      apiRequestWithRefresh<ApiList<SchoolClass>>("/api/v1/core/classes/"),
    ]);

    const setupRows = listData(setupData);
    setSources(setupRows.filter((row) => row.type === "3"));
    setReferences(setupRows.filter((row) => row.type === "4"));
    setClasses(listData(classData));
  };

  const loadInquiries = async () => {
    const params = new URLSearchParams();
    if (dateFrom) params.set("date_from", dateFrom);
    if (dateTo) params.set("date_to", dateTo);
    if (sourceFilter) params.set("source", sourceFilter);
    if (statusFilter) params.set("status", statusFilter);

    const query = params.toString();
    const data = await apiRequestWithRefresh<ApiList<Inquiry>>(`/api/v1/admissions/inquiries/${query ? `?${query}` : ""}`);
    setItems(listData(data));
  };

  const loadAll = async () => {
    try {
      setLoading(true);
      setError("");
      await Promise.all([loadOptions(), loadInquiries()]);
    } catch {
      setError("Unable to load admission query data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAll();
  }, []);

  const resetForm = () => {
    setEditingId(null);
    setForm(initialForm());
    setFieldErrors({});
    setFieldWarnings({});
    setPincodeLookupInfo("");
    setPostOfficeOptions([]);
    lastPincodeLookupRef.current = "";
  };

  const validateMeaningfulField = (key: keyof InquiryForm, value: string, fieldLabel: string) => {
    if (!value.trim()) return "";
    const result = validateMeaningfulText(value, fieldLabel);
    return result.valid ? "" : result.error || "Please enter a meaningful value.";
  };

  const validateField = (key: keyof InquiryForm, value: string, phase: "input" | "blur" | "submit") => {
    if (key === "full_name") {
      if (!value.trim()) return phase === "input" ? "" : "Name is required.";
      if (!/^[A-Za-z\s\-']+$/.test(value)) return "Name can only contain letters, spaces, hyphens and apostrophes.";
      if (value.trim().length < 2) return "Name must be at least 2 characters.";
      const meaningful = validateMeaningfulField(key, value, "Name");
      if (meaningful) return "Please enter a meaningful name.";
      return "";
    }

    if (key === "phone") {
      if (!value.trim()) return phase === "input" ? "" : "Phone number is required.";
      if (!/^\d+$/.test(value)) return "Only digits (0-9) are allowed.";
      if (!/^[6-9]\d{9}$/.test(value)) return "Enter a valid 10-digit Indian mobile number starting with 6-9.";
      return "";
    }

    if (key === "email") {
      if (!value.trim()) return "";
      const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailPattern.test(value)) return "Please enter a valid email address (e.g., name@domain.com).";
      const domain = value.split("@")[1] || "";
      if (!domain.includes(".")) return "Please enter a valid email address.";
      return "";
    }

    if (key === "address") {
      if (!value.trim()) return "";
      if (value.trim().length <= 2) return "Address is too short to be valid.";
      const meaningful = validateMeaningfulField(key, value, "Address");
      return meaningful;
    }

    if (key === "pincode") {
      if (!value.trim()) return "";
      if (!/^\d{6}$/.test(value.trim())) return "Pincode must be exactly 6 digits.";
      return "";
    }

    if (key === "description") {
      if (!value.trim()) return "";
      const meaningful = validateMeaningfulField(key, value, "Description");
      return meaningful;
    }

    if (key === "assigned") {
      if (!value.trim()) return phase === "input" ? "" : "Assigned staff member is required.";
      if (value.trim().length < 2) return "Name must be at least 2 characters.";
      if (!/[A-Za-z]/.test(value)) return "Assigned name must contain letters.";
      const meaningful = validateMeaningfulField(key, value, "Assigned");
      return meaningful;
    }

    if (key === "reference") {
      if (!value) return phase === "input" ? "" : "Reference is required. Please select a reference.";
      return "";
    }

    if (key === "source") {
      if (!value) return phase === "input" ? "" : "Source is required. Please select a source.";
      return "";
    }

    if (key === "no_of_child") {
      if (!value.trim()) return phase === "input" ? "" : "Number of children is required.";
      const count = Number(value);
      if (count < 1) return "Must be at least 1.";
      if (count > 20) return "Cannot exceed 20.";
      return "";
    }

    if (key === "query_date") {
      if (!value) return phase === "input" ? "" : "Query date is required.";
      if (value > today) return "Query date cannot be in the future.";
      if (value < sixtyDaysAgo) return "Query date cannot be older than 60 days.";
      return "";
    }

    if (key === "next_follow_up_date") {
      if (!value) return phase === "input" ? "" : "Next follow-up date is required.";
      if (value < today) return "Follow-up date cannot be in the past.";
      if (value > fortyFiveDaysAhead) return "Follow-up date cannot be more than 45 days ahead.";
      if (form.query_date && value < form.query_date) return "Follow-up date must be on or after the Query Date.";
      return "";
    }

    return "";
  };

  const setFieldError = (key: keyof InquiryForm, message: string) => {
    setFieldErrors((prev) => ({ ...prev, [key]: message }));
  };

  const handleInput = (key: keyof InquiryForm, value: string) => {
    let nextValue = value;
    let forcedError = "";

    if (key === "phone") {
      if (/\D/.test(value)) {
        forcedError = "Only digits (0-9) are allowed.";
      }
      nextValue = value.replace(/\D/g, "").slice(0, 10);
    }
    if (key === "pincode") {
      if (/\D/.test(value)) {
        forcedError = "Only digits (0-9) are allowed.";
      }
      nextValue = value.replace(/\D/g, "").slice(0, 6);
      if (!nextValue) {
        setPincodeLookupInfo("");
        setPostOfficeOptions([]);
        setForm((prev) => ({ ...prev, state_name: "", district_name: "", post_office_name: "" }));
        lastPincodeLookupRef.current = "";
      }
    }
    if (key === "no_of_child") {
      if (/\D/.test(value)) {
        forcedError = "Only digits are allowed.";
      }
      nextValue = value.replace(/\D/g, "").slice(0, 2);
    }

    setFormValue(key, nextValue);

    const message = validateField(key, nextValue, "input");
    setFieldError(key, forcedError || message);
  };

  const handleBlur = (key: keyof InquiryForm) => {
    const message = validateField(key, form[key], "blur");
    setFieldError(key, message);
  };

  useEffect(() => {
    const pincode = form.pincode.trim();
    if (!pincode) return;
    if (pincode.length < 6) {
      setPincodeLookupInfo("");
      return;
    }
    if (!/^\d{6}$/.test(pincode)) {
      setFieldError("pincode", "Pincode must be exactly 6 digits.");
      return;
    }
    if (lastPincodeLookupRef.current === pincode) {
      return;
    }

    const timer = window.setTimeout(() => {
      const loadPincode = async () => {
        try {
          setPincodeLookupLoading(true);
          setPincodeLookupInfo("");
          setFieldError("pincode", "");

          const response = await apiRequestWithRefresh<PincodeLookupResponse>(
            `/api/v1/admissions/pincode-details/?pincode=${encodeURIComponent(pincode)}`,
          );

          if (!response?.success || !response.data) {
            const message = response?.message || "Invalid PIN Code";
            setFieldError("pincode", message);
            setPincodeLookupInfo(message);
            setForm((prev) => ({ ...prev, state_name: "", district_name: "", post_office_name: "" }));
            setPostOfficeOptions([]);
            return;
          }

          const postOffices = response.data.post_offices || [];
          const firstOffice = postOffices[0] || { name: response.data.post_office || "", district: response.data.district || "", state: response.data.state || "" };
          setPostOfficeOptions(postOffices);
          setForm((prev) => ({
            ...prev,
            state_name: response.data?.state || firstOffice.state || "",
            district_name: response.data?.district || firstOffice.district || "",
            post_office_name: response.data?.post_office || firstOffice.name || "",
          }));

          if (response.data.multiple_post_offices) {
            setPincodeLookupInfo("Multiple post offices found. First one selected.");
          } else {
            setPincodeLookupInfo("Address details fetched successfully.");
          }

          lastPincodeLookupRef.current = pincode;
        } catch {
          setFieldError("pincode", "Unable to fetch pincode details right now.");
          setPincodeLookupInfo("Unable to fetch pincode details right now.");
          setForm((prev) => ({ ...prev, state_name: "", district_name: "", post_office_name: "" }));
          setPostOfficeOptions([]);
        } finally {
          setPincodeLookupLoading(false);
        }
      };

      void loadPincode();
    }, 400);

    return () => window.clearTimeout(timer);
  }, [form.pincode]);

  const handleQueryDateChange = async (value: string) => {
    setFieldWarnings((prev) => ({ ...prev, query_date: "" }));
    handleInput("query_date", value);

    if (!value) return;
    if (value > today) return;

    if (value < sixtyDaysAgo) {
      const keep = await askDateConfirmation(
        "Confirm Older Query Date",
        `You selected ${value}. This is older than 60 days. Are you sure this is correct?`,
      );

      if (!keep) {
        setFormValue("query_date", "");
        setFieldError("query_date", "Query date is required.");
        document.getElementById("aq-query-date")?.focus();
        return;
      }

      setFieldWarnings((prev) => ({ ...prev, query_date: "⚠ This query date is older than 60 days." }));
    }

    if (form.next_follow_up_date && form.next_follow_up_date < value) {
      setFieldError("next_follow_up_date", "Follow-up date must be on or after the Query Date.");
    }
  };

  const handleNextFollowDateChange = async (value: string) => {
    setFieldWarnings((prev) => ({ ...prev, next_follow_up_date: "" }));
    handleInput("next_follow_up_date", value);

    if (!value || !form.query_date) return;

    if (value < form.query_date || value < today || value > fortyFiveDaysAhead) {
      return;
    }

    const diffFromToday = daysBetween(today, value);
    if (diffFromToday > 4) {
      const keep = await askDateConfirmation(
        "Confirm Follow-up Date",
        `The selected follow-up date is ${diffFromToday} days from today. Are you sure?`,
      );

      if (!keep) {
        setFormValue("next_follow_up_date", "");
        setFieldError("next_follow_up_date", "Next follow-up date is required.");
        document.getElementById("aq-followup-date")?.focus();
        return;
      }

      setFieldWarnings((prev) => ({ ...prev, next_follow_up_date: "⚠ Follow-up date is more than 4 days away." }));
    }

    if (value < today) {
      setFieldWarnings((prev) => ({ ...prev, next_follow_up_date: "⚠ Follow-up date is in the past. Consider updating to a future date." }));
    }
  };

  const validateAll = () => {
    const keys: (keyof InquiryForm)[] = [
      "full_name",
      "phone",
      "email",
      "address",
      "pincode",
      "description",
      "query_date",
      "next_follow_up_date",
      "assigned",
      "reference",
      "source",
      "no_of_child",
    ];

    const nextErrors: Record<string, string> = {};
    keys.forEach((key) => {
      const message = validateField(key, form[key], "submit");
      if (message) nextErrors[key] = message;
    });

    setFieldErrors(nextErrors);
    return nextErrors;
  };

  const focusFirstInvalid = (errors: Record<string, string>) => {
    const order = [
      "aq-name",
      "aq-phone",
      "aq-email",
      "aq-address",
      "aq-pincode",
      "aq-description",
      "aq-query-date",
      "aq-followup-date",
      "aq-assigned",
      "aq-reference",
      "aq-source",
      "aq-no-of-child",
    ];

    for (const id of order) {
      const key = id.replace("aq-", "").replace("followup-date", "next_follow_up_date").replace("query-date", "query_date").replace("no-of-child", "no_of_child");
      if (errors[key]) {
        const node = document.getElementById(id);
        node?.scrollIntoView({ behavior: "smooth", block: "center" });
        (node as HTMLElement | null)?.focus?.();
        break;
      }
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const submitErrors = validateAll();
    if (Object.keys(submitErrors).length > 0) {
      setError("Please fix the errors below before submitting.");
      toast.error("Please fix the errors below before submitting.", { autoClose: 5000 });
      focusFirstInvalid(submitErrors);
      return;
    }

    const composedAddress = [
      form.address.trim(),
      form.post_office_name ? `Post Office: ${form.post_office_name.trim()}` : "",
      form.district_name ? `District: ${form.district_name.trim()}` : "",
      form.state_name ? `State: ${form.state_name.trim()}` : "",
      form.pincode ? `PIN: ${form.pincode.trim()}` : "",
    ].filter(Boolean).join(", ");

    const payload = {
      full_name: form.full_name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim(),
      address: composedAddress,
      description: form.description.trim(),
      query_date: form.query_date,
      next_follow_up_date: form.next_follow_up_date,
      assigned: form.assigned.trim(),
      reference: Number(form.reference),
      source: Number(form.source),
      school_class: form.school_class ? Number(form.school_class) : null,
      no_of_child: Number(form.no_of_child),
      active_status: Number(form.active_status),
      status: form.status,
      note: form.note.trim(),
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      if (editingId) {
        await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${editingId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSuccess("Admission query updated successfully.");
        toast.success("Admission query updated successfully.", { autoClose: 4000 });
      } else {
        await apiRequestWithRefresh("/api/v1/admissions/inquiries/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        setSuccess("Admission query created successfully.");
        toast.success("Admission query created successfully.", { autoClose: 4000 });
      }
      resetForm();
      await loadInquiries();
    } catch {
      setError(editingId ? "Unable to update admission query." : "Unable to create admission query.");
      toast.error(editingId ? "Unable to update admission query." : "Unable to create admission query.", { autoClose: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const edit = (row: Inquiry) => {
    const parsedAddress = parseComposedAddress(row.address || "");
    setEditingId(row.id);
    setForm({
      full_name: row.full_name || "",
      phone: row.phone || "",
      email: row.email || "",
      address: parsedAddress.addressLine,
      pincode: parsedAddress.pincode,
      state_name: parsedAddress.state,
      district_name: parsedAddress.district,
      post_office_name: parsedAddress.postOffice,
      description: row.description || "",
      query_date: row.query_date || "",
      next_follow_up_date: row.next_follow_up_date || "",
      assigned: row.assigned || "",
      reference: row.reference ? String(row.reference) : "",
      source: row.source ? String(row.source) : "",
      school_class: row.school_class ? String(row.school_class) : "",
      no_of_child: String(row.no_of_child || 1),
      active_status: String(row.active_status || 1) as "1" | "2",
      status: row.status || "new",
      note: row.note || "",
    });
    setFieldErrors({});
    setFieldWarnings({});
    setPincodeLookupInfo("");
    setPostOfficeOptions(parsedAddress.postOffice ? [{ name: parsedAddress.postOffice, district: parsedAddress.district, state: parsedAddress.state }] : []);
    lastPincodeLookupRef.current = parsedAddress.pincode || "";
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const remove = async (id: number) => {
    try {
      setDeletingId(id);
      setError("");
      setSuccess("");
      await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${id}/`, { method: "DELETE" });
      setItems((prev) => prev.filter((row) => row.id !== id));
      setSuccess("Admission query deleted.");
      toast.success("Admission query deleted.", { autoClose: 4000 });
    } catch {
      setError("Unable to delete admission query.");
      toast.error("Unable to delete admission query.", { autoClose: 6000 });
    } finally {
      setDeletingId(null);
    }
  };

  const runSelectedAction = async (item: Inquiry) => {
    const action = rowActions[item.id] || "";
    if (!action) return;

    if (action === "add_query") {
      router.push(`/administration/admission-query/${item.id}`);
      return;
    }

    if (action === "edit") {
      edit(item);
      return;
    }

    if (action === "delete") {
      setDeleteTarget(item);
    }
  };

  const selectedActionButton = (action: "" | "add_query" | "edit" | "delete") => {
    if (action === "add_query") return { label: "Add Query", color: "#0f766e" };
    if (action === "edit") return { label: "Edit", color: "#0ea5e9" };
    if (action === "delete") return { label: "Delete", color: "#dc2626" };
    return { label: "Run", color: "#94a3b8" };
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  };

  const sorted = useMemo(() => {
    const rows = [...items];
    rows.sort((a, b) => {
      const m = sortDir === "asc" ? 1 : -1;
      if (sortKey === "full_name") return (a.full_name || "").localeCompare(b.full_name || "") * m;
      if (sortKey === "query_date") return (a.query_date || "").localeCompare(b.query_date || "") * m;
      return (a.next_follow_up_date || "").localeCompare(b.next_follow_up_date || "") * m;
    });
    return rows;
  }, [items, sortKey, sortDir]);

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageRows = sorted.slice(startIndex, startIndex + pageSize);

  useEffect(() => {
    if (page !== safePage) setPage(safePage);
  }, [page, safePage]);

  const showingStart = total === 0 ? 0 : startIndex + 1;
  const showingEnd = Math.min(total, startIndex + pageSize);

  const getDateAlert = (item: Inquiry) => {
    const todayDate = today;
    if (item.next_follow_up_date && item.follow_up_date && item.next_follow_up_date < item.follow_up_date) {
      return {
        active: true,
        tooltip: `⚠ Next Follow Up is before Last Follow Up. Data needs correction.`,
      };
    }
    if (item.next_follow_up_date && item.next_follow_up_date < todayDate) {
      return {
        active: true,
        tooltip: `⚠ Follow-up is overdue. Next follow-up was due on ${item.next_follow_up_date}.`,
      };
    }
    if (item.query_date && item.next_follow_up_date && item.query_date === item.next_follow_up_date) {
      return {
        active: true,
        tooltip: "⚠ Follow-up date has not been updated since the query was created.",
      };
    }
    return { active: false, tooltip: "" };
  };

  const searchNow = async () => {
    if (!validateSearchDates(dateFrom, dateTo)) return;
    await loadInquiries();
  };

  return (
    <div className="legacy-panel">
      <ToastContainer position="top-right" newestOnTop />

      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Admission Query</h1>
            <nav aria-label="Breadcrumb">
              <ol style={{ display: "flex", gap: 8, color: "#555", fontSize: 13, listStyle: "none", margin: 0, padding: 0 }}>
                <li><a href="/dashboard">Dashboard</a></li>
                <li>/</li>
                <li><a href="/administration">Admin Section</a></li>
                <li>/</li>
                <li aria-current="page">Admission Query</li>
              </ol>
            </nav>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 12, maxWidth: "100%" }}>
          <div className="white-box" style={{ ...boxStyle(), maxWidth: "100%" }}>
            <h3 style={{ marginTop: 0, marginBottom: 12 }}>Select Criteria</h3>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-group" style={{ minWidth: 220, flex: "1 1 220px" }}>
                <label htmlFor="sc-date-from">Date From</label>
                <input id="sc-date-from" name="date_from" type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); void validateSearchDates(e.target.value, dateTo); }} style={fieldStyle(Boolean(filterErrors.date_from))} />
                <small className="form-error text-danger" style={{ display: filterErrors.date_from ? "block" : "none" }}>{filterErrors.date_from || ""}</small>
              </div>
              <div className="form-group" style={{ minWidth: 220, flex: "1 1 220px" }}>
                <label htmlFor="sc-date-to">Date To</label>
                <input id="sc-date-to" name="date_to" type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); void validateSearchDates(dateFrom, e.target.value); }} style={fieldStyle(Boolean(filterErrors.date_to))} />
                <small className="form-error text-danger" style={{ display: filterErrors.date_to ? "block" : "none" }}>{filterErrors.date_to || ""}</small>
              </div>
              <div className="form-group" style={{ minWidth: 220, flex: "1 1 220px" }}>
                <label htmlFor="sc-source">Source</label>
                <select id="sc-source" name="filter_source" value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value)} style={fieldStyle()}>
                  <option value="" disabled>Select Source</option>
                  <option value="">All</option>
                  {sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <small className="form-error text-danger" style={{ display: "none" }} />
              </div>
              <div className="form-group" style={{ minWidth: 220, flex: "1 1 220px" }}>
                <label htmlFor="sc-status">Status</label>
                <select id="sc-status" name="filter_status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={fieldStyle()}>
                  <option value="" disabled>Select Status</option>
                  <option value="">All</option>
                  <option value="1">Active</option>
                  <option value="2">Inactive</option>
                </select>
                <small className="form-error text-danger" style={{ display: "none" }} />
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button type="button" onClick={() => void searchNow()} style={buttonStyle()}>Search</button>
                <button type="button" onClick={() => { setDateFrom(""); setDateTo(""); setSourceFilter(""); setStatusFilter(""); setFilterErrors({}); void loadInquiries(); }} style={buttonStyle("#64748b")}>Reset Filters</button>
              </div>
            </div>
          </div>

          <div className="admission-grid" style={{ display: "grid", gridTemplateColumns: "minmax(340px,1fr) minmax(460px,2fr)", gap: 12, alignItems: "start" }}>
            <div className="white-box" style={{ ...boxStyle(), height: "auto" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>{editingId ? "Edit Admission Query" : "Add Admission Query"}</h3>
              <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
                <SectionDivider title="PERSONAL INFORMATION" />
                <div className="form-group">
                  <label htmlFor="aq-name">Name</label>
                  <input id="aq-name" name="name" type="text" required minLength={2} maxLength={100} pattern="[A-Za-z\s\-']+" placeholder="e.g. John Doe" value={form.full_name} onChange={(e) => handleInput("full_name", e.target.value)} onBlur={() => handleBlur("full_name")} style={fieldStyle(Boolean(fieldErrors.full_name))} />
                  <small className="field-hint">Parent or guardian full name</small>
                  <small className="field-counter">{form.full_name.length}/100 characters</small>
                  <small className="form-error text-danger" style={{ display: fieldErrors.full_name ? "block" : "none" }}>{fieldErrors.full_name || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="aq-phone">Phone</label>
                  <div className="aq-phone-row">
                    <div className="aq-cc">+91</div>
                    <input id="aq-phone" name="phone" type="text" required minLength={10} maxLength={10} pattern="[6-9][0-9]{9}" inputMode="numeric" placeholder="e.g. 9876543210" value={form.phone} onKeyDown={(e) => { if (!["Backspace", "Delete", "ArrowLeft", "ArrowRight", "Tab"].includes(e.key) && !/^[0-9]$/.test(e.key)) e.preventDefault(); }} onChange={(e) => handleInput("phone", e.target.value)} onBlur={() => handleBlur("phone")} style={fieldStyle(Boolean(fieldErrors.phone))} />
                  </div>
                  <small className="field-hint">Enter valid phone number</small>
                  <small className="field-counter">{form.phone.length}/{form.phone.length >= 10 ? "10 digits ✓" : "10 digits"}</small>
                  <small className="form-error text-danger" style={{ display: fieldErrors.phone ? "block" : "none" }}>{fieldErrors.phone || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="aq-email">Email</label>
                  <input id="aq-email" name="email" type="email" maxLength={254} placeholder="e.g. parent@example.com" value={form.email} onChange={(e) => handleInput("email", e.target.value)} onBlur={() => handleBlur("email")} style={fieldStyle(Boolean(fieldErrors.email))} />
                  <small className="form-error text-danger" style={{ display: fieldErrors.email ? "block" : "none" }}>{fieldErrors.email || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="aq-address">Address Line</label>
                  <textarea id="aq-address" name="address" maxLength={500} placeholder="e.g. 123, Main Street" value={form.address} onChange={(e) => handleInput("address", e.target.value)} onBlur={() => handleBlur("address")} style={textAreaStyle(Boolean(fieldErrors.address))} />
                  <small className="field-counter">{form.address.length}/500 characters</small>
                  <small className="form-error text-danger" style={{ display: fieldErrors.address ? "block" : "none" }}>{fieldErrors.address || ""}</small>
                </div>

                <SectionDivider title="ADDRESS" />

                <div className="form-group">
                  <label htmlFor="aq-pincode">Pincode</label>
                  <input
                    id="aq-pincode"
                    name="pincode"
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="e.g. 560001"
                    value={form.pincode}
                    onChange={(e) => handleInput("pincode", e.target.value)}
                    onBlur={() => handleBlur("pincode")}
                    style={fieldStyle(Boolean(fieldErrors.pincode))}
                  />
                  {pincodeLookupLoading ? <small className="field-hint">Fetching state and district from pincode...</small> : null}
                  {pincodeLookupInfo ? <small className="field-hint">{pincodeLookupInfo}</small> : null}
                  <small className="form-error text-danger" style={{ display: fieldErrors.pincode ? "block" : "none" }}>{fieldErrors.pincode || ""}</small>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 10 }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="aq-state">State</label>
                    <input id="aq-state" name="state_name" type="text" value={form.state_name} readOnly style={{ ...fieldStyle(), background: "#f8fafc" }} />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label htmlFor="aq-district">District</label>
                    <input id="aq-district" name="district_name" type="text" value={form.district_name} readOnly style={{ ...fieldStyle(), background: "#f8fafc" }} />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="aq-post-office">Post Office</label>
                  {postOfficeOptions.length > 1 ? (
                    <select
                      id="aq-post-office"
                      name="post_office_name"
                      value={form.post_office_name}
                      onChange={(e) => {
                        const selectedName = e.target.value;
                        const selectedOffice = postOfficeOptions.find((item) => item.name === selectedName);
                        setForm((prev) => ({
                          ...prev,
                          post_office_name: selectedName,
                          district_name: selectedOffice?.district || prev.district_name,
                          state_name: selectedOffice?.state || prev.state_name,
                        }));
                      }}
                      style={fieldStyle()}
                    >
                      {postOfficeOptions.map((office) => (
                        <option key={office.name} value={office.name}>{office.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input id="aq-post-office" name="post_office_name" type="text" value={form.post_office_name} readOnly style={{ ...fieldStyle(), background: "#f8fafc" }} />
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="aq-description">Description</label>
                  <textarea id="aq-description" name="description" maxLength={1000} placeholder="e.g. Parent enquired about admission for Class 5" value={form.description} onChange={(e) => handleInput("description", e.target.value)} onBlur={() => handleBlur("description")} style={textAreaStyle(Boolean(fieldErrors.description))} />
                  <small className="field-hint">Brief details about this enquiry</small>
                  <small className="field-counter">{form.description.length}/1000 characters</small>
                  <small className="form-error text-danger" style={{ display: fieldErrors.description ? "block" : "none" }}>{fieldErrors.description || ""}</small>
                </div>

                <SectionDivider title="QUERY DETAILS" />

                <div className="form-group">
                  <label htmlFor="aq-query-date">Query Date *</label>
                  <input id="aq-query-date" name="query_date" type="date" required min={sixtyDaysAgo} max={today} value={form.query_date} onChange={(e) => void handleQueryDateChange(e.target.value)} onBlur={() => handleBlur("query_date")} style={fieldStyle(Boolean(fieldErrors.query_date))} />
                  <small className="form-error text-danger" style={{ display: fieldErrors.query_date ? "block" : "none" }}>{fieldErrors.query_date || ""}</small>
                  {fieldWarnings.query_date ? <small className="date-warning-text">{fieldWarnings.query_date}</small> : null}
                </div>

                <div className="form-group">
                  <label htmlFor="aq-followup-date">Next Follow-up Date *</label>
                  <input id="aq-followup-date" name="next_followup_date" type="date" required min={today} max={fortyFiveDaysAhead} value={form.next_follow_up_date} onChange={(e) => void handleNextFollowDateChange(e.target.value)} onBlur={() => handleBlur("next_follow_up_date")} style={fieldStyle(Boolean(fieldErrors.next_follow_up_date))} />
                  <small className="form-error text-danger" style={{ display: fieldErrors.next_follow_up_date ? "block" : "none" }}>{fieldErrors.next_follow_up_date || ""}</small>
                  {fieldWarnings.next_follow_up_date ? <small className="date-warning-text">{fieldWarnings.next_follow_up_date}</small> : null}
                </div>

                <div className="form-group">
                  <label htmlFor="aq-assigned">Assigned *</label>
                  <input id="aq-assigned" name="assigned" type="text" required minLength={2} maxLength={100} placeholder="e.g. Mr. Sharma" list="aq-assigned-list" value={form.assigned} onChange={(e) => handleInput("assigned", e.target.value)} onBlur={() => handleBlur("assigned")} style={fieldStyle(Boolean(fieldErrors.assigned))} />
                  <datalist id="aq-assigned-list">
                    {Array.from(new Set(items.map((x) => x.assigned).filter(Boolean))).map((entry) => <option key={entry} value={entry} />)}
                  </datalist>
                  <small className="form-error text-danger" style={{ display: fieldErrors.assigned ? "block" : "none" }}>{fieldErrors.assigned || ""}</small>
                </div>

                <SectionDivider title="CLASSIFICATION" />

                <div className="form-group">
                  <label htmlFor="aq-reference">Reference *</label>
                  <select id="aq-reference" name="reference" required value={form.reference} onChange={(e) => handleInput("reference", e.target.value)} onBlur={() => handleBlur("reference")} style={fieldStyle(Boolean(fieldErrors.reference))}>
                    <option value="" disabled>Select Reference</option>
                    {references.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <small className="form-error text-danger" style={{ display: fieldErrors.reference ? "block" : "none" }}>{fieldErrors.reference || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="aq-source">Source *</label>
                  <select id="aq-source" name="source" required value={form.source} onChange={(e) => handleInput("source", e.target.value)} onBlur={() => handleBlur("source")} style={fieldStyle(Boolean(fieldErrors.source))}>
                    <option value="" disabled>Select Source</option>
                    {sources.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <small className="form-error text-danger" style={{ display: fieldErrors.source ? "block" : "none" }}>{fieldErrors.source || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="aq-class">Class</label>
                  <select id="aq-class" name="class" value={form.school_class} onChange={(e) => setFormValue("school_class", e.target.value)} style={fieldStyle()}>
                    <option value="" disabled>Select Class</option>
                    <option value="">None</option>
                    {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                  </select>
                  <small className="form-error text-danger" style={{ display: "none" }} />
                </div>

                <div className="form-group">
                  <label htmlFor="aq-no-of-child">Number of Children *</label>
                  <input id="aq-no-of-child" name="no_of_child" type="number" required min={1} max={20} step={1} placeholder="e.g. 1" value={form.no_of_child} onKeyDown={(e) => { if (["e", "E", ".", "+", "-"].includes(e.key)) e.preventDefault(); }} onChange={(e) => handleInput("no_of_child", e.target.value)} onBlur={() => handleBlur("no_of_child")} style={fieldStyle(Boolean(fieldErrors.no_of_child))} />
                  <small className="form-error text-danger" style={{ display: fieldErrors.no_of_child ? "block" : "none" }}>{fieldErrors.no_of_child || ""}</small>
                </div>

                <div className="form-group">
                  <label htmlFor="aq-status">Status</label>
                  <select id="aq-status" name="status" value={form.active_status} onChange={(e) => setFormValue("active_status", e.target.value as "1" | "2")} style={fieldStyle()}>
                    <option value="1">Active</option>
                    <option value="2">Inactive</option>
                  </select>
                  <small className="form-error text-danger" style={{ display: "none" }} />
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button type="submit" disabled={saving} style={buttonStyle()}>{saving ? "Saving..." : editingId ? "Update" : "Save"}</button>
                  {editingId ? <button type="button" onClick={resetForm} style={buttonStyle("#6b7280")}>Cancel</button> : null}
                </div>
              </form>
            </div>

            <div className="white-box" style={{ ...boxStyle(), maxWidth: "100%" }}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Query List</h3>
              {loading ? <div style={{ color: "var(--text-muted)" }}>Loading admission queries...</div> : null}
              {!loading && items.length === 0 ? <div style={{ color: "var(--text-muted)" }}>No admission queries found.</div> : null}
              {!loading && items.length > 0 ? (
                <>
                  <div style={{ overflowX: "auto" }}>
                    <table aria-label="Admission Query List" style={{ width: "100%", borderCollapse: "collapse", minWidth: 980 }}>
                      <caption className="sr-only">Admission Query List</caption>
                      <thead>
                        <tr style={{ background: "var(--surface-muted)" }}>
                          <th scope="col" onClick={() => toggleSort("full_name")} style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", cursor: "pointer", whiteSpace: "nowrap" }}>Name {sortKey === "full_name" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                          <th scope="col" style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>Phone</th>
                          <th scope="col" style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>Source</th>
                          <th scope="col" onClick={() => toggleSort("query_date")} style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", cursor: "pointer", whiteSpace: "nowrap" }}>Query Date {sortKey === "query_date" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                          <th scope="col" style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>Last Follow Up</th>
                          <th scope="col" onClick={() => toggleSort("next_follow_up_date")} style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", cursor: "pointer", whiteSpace: "nowrap" }}>Next Follow Up {sortKey === "next_follow_up_date" ? (sortDir === "asc" ? "▲" : "▼") : ""}</th>
                          <th scope="col" style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pageRows.map((item) => {
                          const alert = getDateAlert(item);
                          const isTodayFollowUp = isSameDate(item.next_follow_up_date, today);
                          return (
                            <tr key={item.id} className={`${alert.active ? "date-alert" : ""} ${isTodayFollowUp ? "aq-today-row" : ""}`.trim()} title={alert.tooltip}>
                              <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{item.full_name || "-"}</td>
                              <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{item.phone || "-"}</td>
                              <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}><span className={`source-badge ${sourceSlug(item.source_name || "")}`}>{item.source_name || "N/A"}</span></td>
                              <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{formatDisplayDate(item.query_date)}</td>
                              <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{formatDisplayDate(item.follow_up_date)}</td>
                              <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                                {formatDisplayDate(item.next_follow_up_date)}
                                {isTodayFollowUp ? <div className="aq-today-badge">FOLLOW-UP TODAY</div> : null}
                              </td>
                              <td style={{ padding: 10, borderBottom: "1px solid var(--line)", minWidth: 230 }}>
                                <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 6, alignItems: "center" }}>
                                  <select
                                    value={rowActions[item.id] || ""}
                                    onChange={(event) => setRowActions((prev) => ({ ...prev, [item.id]: event.target.value as "" | "add_query" | "edit" | "delete" }))}
                                    style={fieldStyle()}
                                  >
                                    <option value="" disabled>Select Action</option>
                                    <option value="add_query">Add Query</option>
                                    <option value="edit">Edit</option>
                                    <option value="delete">Delete</option>
                                  </select>
                                  <button
                                    type="button"
                                    disabled={!rowActions[item.id] || deletingId === item.id}
                                    onClick={() => void runSelectedAction(item)}
                                    style={buttonStyle(selectedActionButton(rowActions[item.id] || "").color)}
                                  >
                                    {deletingId === item.id && (rowActions[item.id] || "") === "delete"
                                      ? "Deleting..."
                                      : selectedActionButton(rowActions[item.id] || "").label}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
                    <span style={{ color: "var(--text-muted)", fontSize: 13 }}>Showing {showingStart}-{showingEnd} of {total} records</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} style={{ ...fieldStyle(), width: 110 }}>
                        <option value={10}>10</option>
                        <option value={25}>25</option>
                        <option value={50}>50</option>
                      </select>
                      <button type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={safePage === 1} style={buttonStyle("#64748b")}>Previous</button>
                      <button type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={safePage >= totalPages} style={buttonStyle("#64748b")}>Next</button>
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          </div>

          {error ? <p style={{ color: "var(--warning)", margin: 0 }}>{error}</p> : null}
          {success ? <p style={{ color: "#0f766e", margin: 0 }}>{success}</p> : null}
        </div>
      </section>

      <DateConfirmDialog
        open={Boolean(dateConfirm)}
        title={dateConfirm?.title || ""}
        message={dateConfirm?.message || ""}
        onAccept={() => handleDateConfirmResult(true)}
        onCancel={() => handleDateConfirmResult(false)}
      />

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Confirm Delete"
        message="Are you sure you want to delete this admission query? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        isConfirming={Boolean(deleteTarget && deletingId === deleteTarget.id)}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          await remove(id);
        }}
      />

      <style jsx>{`
        .admission-grid {
          max-width: 100%;
        }

        .aq-divider {
          display: flex;
          align-items: center;
          gap: 10px;
          margin: 14px 0 8px;
          user-select: none;
        }

        .aq-divider span {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.1px;
          color: var(--primary);
          white-space: nowrap;
        }

        .aq-divider::after {
          content: "";
          flex: 1;
          height: 1px;
          background: var(--line);
        }

        .field-hint {
          display: block;
          font-size: 11px;
          color: var(--text-muted);
          margin-top: 3px;
          line-height: 1.3;
        }

        .aq-phone-row {
          display: flex;
          gap: 6px;
          align-items: center;
        }

        .aq-cc {
          width: 56px;
          min-width: 56px;
          height: 36px;
          border: 1px solid var(--line);
          border-radius: 8px;
          background: var(--surface-muted);
          text-align: center;
          font-size: 13px;
          font-weight: 600;
          color: var(--text);
          line-height: 36px;
        }

        .aq-phone-row :global(input) {
          flex: 1;
        }

        .aq-today-row {
          background: linear-gradient(90deg, #eaf2ff 0%, #f8fbff 100%);
        }

        .aq-today-badge {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          margin-top: 4px;
          background: linear-gradient(135deg, #1d4ed8, #3b82f6);
          color: #fff;
          font-size: 9px;
          font-weight: 700;
          letter-spacing: 0.3px;
          padding: 2px 7px;
          border-radius: 8px;
          box-shadow: 0 1px 4px rgba(29, 78, 216, 0.25);
        }

        @media (max-width: 1200px) {
          .admission-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}
