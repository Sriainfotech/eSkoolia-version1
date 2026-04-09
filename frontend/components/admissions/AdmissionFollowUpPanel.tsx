"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ToastContainer, toast } from "react-toastify";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { validateMeaningfulText } from "@/lib/meaningfulText";
import { DateConfirmDialog } from "@/components/common/DateConfirmDialog";
import { ConfirmationModal } from "@/components/common/ConfirmationModal";

type FollowUp = {
  id: number;
  author_name: string | null;
  response: string;
  note: string;
  created_at: string;
};

type ApiList<T> = T[] | { results?: T[]; count?: number; next?: string | null; previous?: string | null };

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
  reference_name?: string;
  source_name?: string;
  created_by_name?: string;
  active_status: number;
};

type DateConfirmState = {
  title: string;
  message: string;
  resolve: (value: boolean) => void;
} | null;

const RESPONSE_LIMIT = 500;
const NOTE_LIMIT = 1000;
const FOLLOW_UP_DEFAULT_PAGE_SIZE = 5;

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
    minHeight: 76,
    border: `1px solid ${hasError ? "#dc3545" : "#ced4da"}`,
    borderRadius: 8,
    padding: "8px 10px",
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

function daysBetween(start: string, end: string) {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.round((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24));
}

function sanitizeClientText(value: string) {
  return String(value || "").replace(/<script.*?>.*?<\/script>/gi, "").replace(/<[^>]*>/g, "");
}

function isValidIndianPhone(value: string) {
  return /^[6-9]\d{9}$/.test(String(value || "").trim());
}

function suggestActiveStatusFromResponse(value: string): { status: "1" | "2"; message: string } | null {
  const text = String(value || "").toLowerCase();
  if (!text.trim()) return null;

  const inactivePatterns = ["enrolled", "admission done", "joined", "declined", "not interested", "rejected", "closed"];
  const activePatterns = ["call back", "follow up", "pending", "waiting", "interested", "visit", "schedule"];

  if (inactivePatterns.some((pattern) => text.includes(pattern))) {
    return { status: "2", message: "Suggested: Mark as Inactive (lead looks closed)." };
  }
  if (activePatterns.some((pattern) => text.includes(pattern))) {
    return { status: "1", message: "Suggested: Keep Active (further follow-up likely needed)." };
  }
  return null;
}

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function nextPageFromList<T>(value: ApiList<T>): number | null {
  if (Array.isArray(value)) return null;
  const next = value.next;
  if (!next) return null;
  try {
    const url = new URL(next);
    const pageValue = url.searchParams.get("page");
    if (!pageValue) return null;
    const parsed = Number(pageValue);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  } catch {
    const queryPart = String(next).split("?")[1] || "";
    const params = new URLSearchParams(queryPart);
    const pageValue = params.get("page");
    if (!pageValue) return null;
    const parsed = Number(pageValue);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
  }
}

export function AdmissionFollowUpPanel({ inquiryId }: { inquiryId: number }) {
  const router = useRouter();
  const [item, setItem] = useState<Inquiry | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [followDate, setFollowDate] = useState("");
  const [nextFollowUpDate, setNextFollowUpDate] = useState("");
  const [activeStatus, setActiveStatus] = useState<"1" | "2">("1");
  const [response, setResponse] = useState("");
  const [note, setNote] = useState("");

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [fieldWarnings, setFieldWarnings] = useState<Record<string, string>>({});
  const [fieldTouched, setFieldTouched] = useState<Record<string, boolean>>({});
  const [submitted, setSubmitted] = useState(false);
  const [dateConfirm, setDateConfirm] = useState<DateConfirmState>(null);
  const [deleteTarget, setDeleteTarget] = useState<FollowUp | null>(null);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [followUpPage, setFollowUpPage] = useState(1);
  const [followUpPageSize, setFollowUpPageSize] = useState(FOLLOW_UP_DEFAULT_PAGE_SIZE);
  const [followUpsTotalCount, setFollowUpsTotalCount] = useState(0);
  const [followUpsLoading, setFollowUpsLoading] = useState(false);

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const sevenDaysAgo = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  }, []);

  const askDateConfirmation = (title: string, message: string) =>
    new Promise<boolean>((resolve) => {
      setDateConfirm({ title, message, resolve });
    });

  const loadFollowUps = useCallback(async (targetPage: number, targetPageSize: number) => {
    try {
      setFollowUpsLoading(true);
      const params = new URLSearchParams();
      params.set("inquiry", String(inquiryId));
      params.set("page_size", String(targetPageSize));
      params.set("page", String(targetPage));
      const data = await apiRequestWithRefresh<ApiList<FollowUp>>(`/api/v1/admissions/follow-ups/?${params.toString()}`);
      const rows = listData(data);
      setFollowUps(rows);
      if (!Array.isArray(data)) {
        setFollowUpsTotalCount(Number(data.count || rows.length));
      } else {
        setFollowUpsTotalCount(rows.length);
      }
    } catch {
      setError("Unable to load follow-up history.");
    } finally {
      setFollowUpsLoading(false);
    }
  }, [inquiryId]);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiRequestWithRefresh<Inquiry>(`/api/v1/admissions/inquiries/${inquiryId}/`);
      setItem(data);
      setFollowDate(data.follow_up_date || today);
      setNextFollowUpDate(data.next_follow_up_date || today);
      setActiveStatus(String(data.active_status || 1) as "1" | "2");
      setFollowUpPage(1);
      await loadFollowUps(1, followUpPageSize);
    } catch {
      setError("Unable to load admission query details.");
    } finally {
      setLoading(false);
    }
  }, [inquiryId, loadFollowUps, today, followUpPageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  const validateField = useCallback((key: "followDate" | "nextFollowUpDate" | "response" | "note", value: string, phase: "input" | "blur" | "submit") => {
    if (key === "followDate") {
      if (!value) return phase === "input" ? "" : "Follow up date is required.";
      if (value > today) return "Follow-up date cannot be in the future.";
      return "";
    }

    if (key === "nextFollowUpDate") {
      if (!value) return phase === "input" ? "" : "Next follow up date is required.";
      if (value < today) return "Next follow-up date cannot be in the past.";
      if (followDate && value < followDate) return "Next follow-up date must be on or after the follow-up date.";
      return "";
    }

    if (key === "response") {
      if (!value.trim()) return phase === "input" ? "" : "Response is required.";
      if (value.trim().length < 2) return "Response must be at least 2 characters.";
      if (value.length > RESPONSE_LIMIT) return `Response must not exceed ${RESPONSE_LIMIT} characters.`;
      const check = validateMeaningfulText(value, "Response");
      return check.valid ? "" : (check.error || "Please enter a meaningful response.");
    }

    if (key === "note") {
      if (!value.trim()) return "";
      if (value.length > NOTE_LIMIT) return `Note must not exceed ${NOTE_LIMIT} characters.`;
      const check = validateMeaningfulText(value, "Note");
      return check.valid ? "" : (check.error || "Please enter a meaningful note.");
    }

    return "";
  }, [followDate, today]);

  const setFieldError = (key: string, value: string) => {
    setFieldErrors((prev) => ({ ...prev, [key]: value }));
  };

  const setTouched = (key: string) => {
    setFieldTouched((prev) => ({ ...prev, [key]: true }));
  };

  const shouldShowError = (key: string) => submitted || Boolean(fieldTouched[key]);

  const statusSuggestion = useMemo(() => suggestActiveStatusFromResponse(response), [response]);

  const phoneValidationMessage = useMemo(() => {
    if (!item?.phone) return "";
    return isValidIndianPhone(item.phone) ? "" : "Phone number format looks invalid (expected Indian 10-digit mobile).";
  }, [item]);

  const liveValidationErrors = useMemo(
    () => ({
      followDate: validateField("followDate", followDate, "submit"),
      nextFollowUpDate: validateField("nextFollowUpDate", nextFollowUpDate, "submit"),
      response: validateField("response", response, "submit"),
      note: validateField("note", note, "submit"),
    }),
    [followDate, nextFollowUpDate, response, note, validateField],
  );

  const hasValidationErrors = useMemo(
    () => Object.values(liveValidationErrors).some((value) => Boolean(value)),
    [liveValidationErrors],
  );

  const saveDisabled = saving || loading || hasValidationErrors;

  const visibleFollowUps = useMemo(() => followUps, [followUps]);
  const followUpTotalPages = useMemo(
    () => Math.max(1, Math.ceil(followUpsTotalCount / followUpPageSize)),
    [followUpsTotalCount, followUpPageSize],
  );
  const canFollowUpPrev = followUpPage > 1;
  const canFollowUpNext = followUpPage < followUpTotalPages;

  const goToFollowUpPage = async (nextPage: number) => {
    const safePage = Math.max(1, Math.min(followUpTotalPages, nextPage));
    setFollowUpPage(safePage);
    await loadFollowUps(safePage, followUpPageSize);
  };

  const handleFollowDateChange = async (value: string) => {
    setFollowDate(value);
    setFieldWarnings((prev) => ({ ...prev, followDate: "" }));
    if (fieldTouched.followDate || submitted) {
      setFieldError("followDate", validateField("followDate", value, "submit"));
    }

    if (!value || value > today) return;

    if (value < sevenDaysAgo) {
      const keep = await askDateConfirmation(
        "Follow Up Date is more than a week old",
        `You selected ${value}. This is more than 7 days ago. Are you sure this follow-up happened on this date?`,
      );

      if (!keep) {
        setFollowDate("");
        setFieldError("followDate", "Follow up date is required.");
        document.getElementById("fu-follow-date")?.focus();
        return;
      }

      setFieldWarnings((prev) => ({ ...prev, followDate: "⚠ This follow-up date is older than 7 days." }));
    }

    if (nextFollowUpDate && nextFollowUpDate < value) {
      setFieldError("nextFollowUpDate", "Next follow-up date must be on or after the follow-up date.");
    }
  };

  const handleNextFollowDateChange = async (value: string) => {
    setNextFollowUpDate(value);
    setFieldWarnings((prev) => ({ ...prev, nextFollowUpDate: "" }));
    if (fieldTouched.nextFollowUpDate || submitted) {
      setFieldError("nextFollowUpDate", validateField("nextFollowUpDate", value, "submit"));
    }

    if (!value || !followDate || value < followDate) return;

    const diff = daysBetween(followDate, value);
    if (diff > 30) {
      const keep = await askDateConfirmation(
        "Follow-up date is more than a month away",
        `You selected ${value}, which is ${diff} days after the follow-up date. Follow-ups are typically scheduled within 30 days. Are you sure?`,
      );

      if (!keep) {
        setNextFollowUpDate("");
        setFieldError("nextFollowUpDate", "Next follow up date is required.");
        document.getElementById("fu-next-follow-date")?.focus();
        return;
      }

      setFieldWarnings((prev) => ({ ...prev, nextFollowUpDate: "⚠ Next follow-up is scheduled more than 30 days out." }));
    }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);

    const nextErrors: Record<string, string> = {
      followDate: validateField("followDate", followDate, "submit"),
      nextFollowUpDate: validateField("nextFollowUpDate", nextFollowUpDate, "submit"),
      response: validateField("response", response, "submit"),
      note: validateField("note", note, "submit"),
    };

    Object.keys(nextErrors).forEach((key) => {
      if (!nextErrors[key]) delete nextErrors[key];
    });

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      setError("Please fix the errors below before submitting.");
      toast.error("Please fix the errors below before submitting.", { autoClose: 5000 });
      const firstId = nextErrors.followDate ? "fu-follow-date" : nextErrors.nextFollowUpDate ? "fu-next-follow-date" : nextErrors.response ? "fu-response" : "fu-note";
      document.getElementById(firstId)?.scrollIntoView({ behavior: "smooth", block: "center" });
      document.getElementById(firstId)?.focus();
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      await apiRequestWithRefresh("/api/v1/admissions/follow-ups/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inquiry: inquiryId,
          response: sanitizeClientText(response).trim().slice(0, RESPONSE_LIMIT),
          note: sanitizeClientText(note).trim().slice(0, NOTE_LIMIT),
          follow_up_date: followDate,
          next_follow_up_date: nextFollowUpDate || null,
          active_status: Number(activeStatus),
        }),
      });
      setResponse("");
      setNote("");
      setFieldTouched({});
      setFieldErrors({});
      setSubmitted(false);
      setSuccess("Follow-up saved successfully.");
      toast.success("Follow-up saved successfully.", { autoClose: 4000 });
      await loadFollowUps(1, followUpPageSize);
      setFollowUpPage(1);
      await load();
    } catch {
      setError("Unable to save follow-up.");
      toast.error("Unable to save follow-up.", { autoClose: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const removeFollowUp = async (id: number) => {
    try {
      await apiRequestWithRefresh(`/api/v1/admissions/follow-ups/${id}/`, { method: "DELETE" });
      toast.success("Follow-up deleted successfully.", { autoClose: 4000 });
      const nextPage = followUpPage > 1 && visibleFollowUps.length <= 1 ? followUpPage - 1 : followUpPage;
      setFollowUpPage(nextPage);
      await loadFollowUps(nextPage, followUpPageSize);
      await load();
    } catch {
      setError("Unable to delete follow-up.");
      toast.error("Unable to delete follow-up.", { autoClose: 6000 });
    }
  };

  const detailsConflict = useMemo(() => {
    if (!item) return { conflict: false, message: "", conflictType: "" };
    if (item.next_follow_up_date && item.follow_up_date && item.next_follow_up_date < item.follow_up_date) {
      return {
        conflict: true,
        conflictType: "inverted",
        message: `⚠ Date Issue: Next Follow Up Date (${item.next_follow_up_date}) is before Last Follow Up Date (${item.follow_up_date}). Please correct this.`,
      };
    }
    if (item.next_follow_up_date && item.next_follow_up_date < today) {
      return {
        conflict: true,
        conflictType: "overdue",
        message: `⚠ Date Issue: Next Follow Up Date (${item.next_follow_up_date}) is in the past. Please correct this.`,
      };
    }
    if (item.next_follow_up_date && item.follow_up_date && item.next_follow_up_date === item.follow_up_date) {
      return {
        conflict: true,
        conflictType: "match",
        message: `⚠ Date Issue: Next Follow Up Date matches Last Follow Up Date. Please schedule the next follow-up date.`,
      };
    }
    return { conflict: false, message: "", conflictType: "" };
  }, [item, today]);

  return (
    <div className="legacy-panel">
      <ToastContainer position="top-right" newestOnTop />

      <section className="sms-breadcrumb mb-20">
        <div className="container-fluid">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <h1 style={{ margin: 0, fontSize: 24 }}>Admission Follow-Up</h1>
            <nav aria-label="Breadcrumb">
              <ol style={{ display: "flex", gap: 8, color: "var(--text-muted)", fontSize: 13, listStyle: "none", margin: 0, padding: 0 }}>
                <li><a href="/dashboard">Dashboard</a></li>
                <li>/</li>
                <li><button type="button" onClick={() => router.push("/administration/admission-query")} style={{ border: 0, background: "transparent", color: "var(--text-muted)", cursor: "pointer", padding: 0 }}>Admission Query</button></li>
                <li>/</li>
                <li aria-current="page">Follow Up</li>
              </ol>
            </nav>
          </div>
        </div>
      </section>

      <section className="admin-visitor-area up_admin_visitor">
        <div className="container-fluid p-0" style={{ display: "grid", gap: 12 }}>
          <div className="follow-grid" style={{ display: "grid", gridTemplateColumns: "minmax(420px,2fr) minmax(280px,1fr)", gap: 12, alignItems: "start" }}>
            <div className="white-box" style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Follow-Up Form</h3>
              <form onSubmit={submit} style={{ display: "grid", gap: 10 }}>
                <div className="form-group">
                  <label htmlFor="fu-follow-date">Follow Up Date *</label>
                  <input id="fu-follow-date" name="follow_date" type="date" required max={today} value={followDate} onChange={(e) => void handleFollowDateChange(e.target.value)} onBlur={() => { setTouched("followDate"); setFieldError("followDate", validateField("followDate", followDate, "blur")); }} style={fieldStyle(Boolean(fieldErrors.followDate) && shouldShowError("followDate"))} aria-invalid={Boolean(fieldErrors.followDate) && shouldShowError("followDate")} />
                  <small className="form-error text-danger" style={{ display: fieldErrors.followDate && shouldShowError("followDate") ? "block" : "none" }}>{fieldErrors.followDate || ""}</small>
                  {fieldWarnings.followDate ? <small className="date-warning-text">{fieldWarnings.followDate}</small> : null}
                </div>

                <div className="form-group">
                  <label htmlFor="fu-next-follow-date">Next Follow Up Date *</label>
                  <input id="fu-next-follow-date" name="next_follow_date" type="date" required min={followDate && followDate > today ? followDate : today} value={nextFollowUpDate} onChange={(e) => void handleNextFollowDateChange(e.target.value)} onBlur={() => { setTouched("nextFollowUpDate"); setFieldError("nextFollowUpDate", validateField("nextFollowUpDate", nextFollowUpDate, "blur")); }} style={fieldStyle(Boolean(fieldErrors.nextFollowUpDate) && shouldShowError("nextFollowUpDate"))} aria-invalid={Boolean(fieldErrors.nextFollowUpDate) && shouldShowError("nextFollowUpDate")} />
                  <small className="form-error text-danger" style={{ display: fieldErrors.nextFollowUpDate && shouldShowError("nextFollowUpDate") ? "block" : "none" }}>{fieldErrors.nextFollowUpDate || ""}</small>
                  {fieldWarnings.nextFollowUpDate ? <small className="date-warning-text">{fieldWarnings.nextFollowUpDate}</small> : null}
                </div>

                <div className="form-group">
                  <label htmlFor="fu-status">Status</label>
                  <select id="fu-status" name="status" value={activeStatus} onChange={(e) => setActiveStatus(e.target.value as "1" | "2")} style={fieldStyle()}>
                    <option value="1">Active</option>
                    <option value="2">Inactive</option>
                  </select>
                  <small className="form-error text-danger" style={{ display: "none" }} />
                </div>

                <div className="form-group">
                  <label htmlFor="fu-response">Response *</label>
                  <textarea id="fu-response" name="response" required minLength={2} maxLength={RESPONSE_LIMIT} placeholder="e.g. Spoke with parent, scheduled campus visit" value={response} onChange={(e) => { const sanitized = sanitizeClientText(e.target.value).slice(0, RESPONSE_LIMIT); setResponse(sanitized); if (fieldTouched.response || submitted) setFieldError("response", validateField("response", sanitized, "submit")); }} onBlur={() => { setTouched("response"); setFieldError("response", validateField("response", response, "blur")); }} style={textAreaStyle(Boolean(fieldErrors.response) && shouldShowError("response"))} aria-invalid={Boolean(fieldErrors.response) && shouldShowError("response")} />
                  <small className="field-counter">{response.length}/{RESPONSE_LIMIT} characters</small>
                  <small className="form-error text-danger" style={{ display: fieldErrors.response && shouldShowError("response") ? "block" : "none" }}>{fieldErrors.response || ""}</small>
                  {statusSuggestion ? (
                    <small className="field-hint" style={{ display: "block", marginTop: 4 }}>
                      {statusSuggestion.message} <button type="button" onClick={() => setActiveStatus(statusSuggestion.status)} style={{ border: 0, background: "transparent", color: "#0ea5e9", cursor: "pointer", padding: 0 }}>Apply</button>
                    </small>
                  ) : null}
                </div>

                <div className="form-group">
                  <label htmlFor="fu-note">Note</label>
                  <textarea id="fu-note" name="note" maxLength={NOTE_LIMIT} placeholder="e.g. Parent requested fee structure details" value={note} onChange={(e) => { const sanitized = sanitizeClientText(e.target.value).slice(0, NOTE_LIMIT); setNote(sanitized); if (fieldTouched.note || submitted) setFieldError("note", validateField("note", sanitized, "submit")); }} onBlur={() => { setTouched("note"); setFieldError("note", validateField("note", note, "blur")); }} style={textAreaStyle(Boolean(fieldErrors.note) && shouldShowError("note"))} aria-invalid={Boolean(fieldErrors.note) && shouldShowError("note")} />
                  <small className="field-counter">{note.length}/{NOTE_LIMIT} characters</small>
                  <small className="form-error text-danger" style={{ display: fieldErrors.note && shouldShowError("note") ? "block" : "none" }}>{fieldErrors.note || ""}</small>
                </div>

                <div>
                  <button type="submit" disabled={saveDisabled} style={{ ...buttonStyle(), minHeight: 42, padding: "0 18px", fontWeight: 700, opacity: saveDisabled ? 0.7 : 1 }} aria-disabled={saveDisabled}>{saving ? "Saving..." : "✓ Save Follow-Up"}</button>
                </div>
              </form>

              <h3 style={{ marginTop: 20, marginBottom: 12 }}>Follow-Up History</h3>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 8, flexWrap: "wrap" }}>
                <small style={{ color: "var(--text-muted)" }}>Total: {followUpsTotalCount}</small>
                <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#334155" }}>
                  Rows
                  <select
                    value={followUpPageSize}
                    onChange={async (event) => {
                      const nextSize = Number(event.target.value);
                      setFollowUpPageSize(nextSize);
                      setFollowUpPage(1);
                      await loadFollowUps(1, nextSize);
                    }}
                    style={{ ...fieldStyle(), minHeight: 30, width: 90, padding: "0 8px" }}
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </label>
              </div>
              <div style={{ overflowX: "auto", maxHeight: 420, overflowY: "auto" }}>
                <table aria-label="Follow Up List" style={{ width: "100%", borderCollapse: "collapse", minWidth: 640 }}>
                  <caption className="sr-only">Follow Up List</caption>
                  <thead>
                    <tr style={{ background: "var(--surface-muted)" }}>
                      <th scope="col" style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>Query By</th>
                      <th scope="col" style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>Response</th>
                      <th scope="col" style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>Note</th>
                      <th scope="col" style={{ padding: 10, textAlign: "left", borderBottom: "1px solid var(--line)", whiteSpace: "nowrap" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {followUpsLoading ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 10, borderBottom: "1px solid var(--line)", color: "var(--text-muted)" }}>
                          Loading follow-up history...
                        </td>
                      </tr>
                    ) : null}
                    {!followUpsLoading && visibleFollowUps.length === 0 ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 10, borderBottom: "1px solid var(--line)", color: "var(--text-muted)" }}>
                          No follow-up records found.
                        </td>
                      </tr>
                    ) : null}
                    {visibleFollowUps.map((row) => (
                      <tr key={row.id}>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{sanitizeClientText(row.author_name || "-") || "-"}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{sanitizeClientText(row.response || "-") || "-"}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>{sanitizeClientText(row.note || "-") || "-"}</td>
                        <td style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                          <button type="button" onClick={() => setDeleteTarget(row)} style={buttonStyle("#dc2626")}>Delete</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div style={{ marginTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <small style={{ color: "var(--text-muted)" }}>Page {followUpPage} / {followUpTotalPages}</small>
                <div style={{ display: "inline-flex", gap: 6 }}>
                  <button type="button" disabled={!canFollowUpPrev || followUpsLoading} onClick={() => void goToFollowUpPage(followUpPage - 1)} style={{ ...buttonStyle("#64748b"), opacity: !canFollowUpPrev || followUpsLoading ? 0.7 : 1 }}>Previous</button>
                  <button type="button" disabled={!canFollowUpNext || followUpsLoading} onClick={() => void goToFollowUpPage(followUpPage + 1)} style={{ ...buttonStyle("#64748b"), opacity: !canFollowUpNext || followUpsLoading ? 0.7 : 1 }}>Next</button>
                </div>
              </div>
            </div>

            <div className={`white-box ${detailsConflict.conflict ? "date-conflict" : ""}`} style={boxStyle()}>
              <h3 style={{ marginTop: 0, marginBottom: 12 }}>Details</h3>
              {detailsConflict.conflict ? <div className="date-warning">{detailsConflict.message}</div> : null}
              {loading ? <div style={{ color: "var(--text-muted)" }}>Loading details...</div> : null}
              {item ? (
                <div className="details-grid" style={{ display: "grid", gap: 8, fontSize: 14 }}>
                  <div className="details-row"><span className="details-key">Created By</span><span className="details-value">{sanitizeClientText(item.created_by_name || "-") || "-"}</span></div>
                  <div className="details-row"><span className="details-key">Query Date</span><span className="details-value">{item.query_date || "-"}</span></div>
                  <div className="details-row"><span className="details-key">Last Follow Up Date</span><span className={`details-value ${detailsConflict.conflict ? "date-value-red" : ""}`}>{item.follow_up_date || "-"}</span></div>
                  <div className="details-row"><span className="details-key">Next Follow Up Date</span><span className={`details-value ${detailsConflict.conflict ? "date-value-red" : ""}`}>{item.next_follow_up_date || "-"}</span></div>
                  <div className="details-row"><span className="details-key">Phone</span><span className="details-value">{sanitizeClientText(item.phone || "-") || "-"}</span></div>
                  {phoneValidationMessage ? <div className="details-inline-error">{phoneValidationMessage}</div> : null}
                  <div className="details-row"><span className="details-key">Address</span><span className="details-value">{sanitizeClientText(item.address || "-") || "-"}</span></div>
                  <div className="details-row"><span className="details-key">Reference</span><span className="details-value">{sanitizeClientText(item.reference_name || "-") || "-"}</span></div>
                  <div className="details-row"><span className="details-key">Description</span><span className="details-value">{sanitizeClientText(item.description || "-") || "-"}</span></div>
                  <div className="details-row"><span className="details-key">Source</span><span className="details-value"><span className={`source-badge ${sourceSlug(item.source_name || "")}`}>{sanitizeClientText(item.source_name || "N/A") || "N/A"}</span></span></div>
                  <div className="details-row"><span className="details-key">Assigned</span><span className="details-value">{sanitizeClientText(item.assigned || "-") || "-"}</span></div>
                  <div className="details-row"><span className="details-key">Email</span><span className="details-value">{sanitizeClientText(item.email || "-") || "-"}</span></div>
                </div>
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
        onAccept={() => {
          if (!dateConfirm) return;
          dateConfirm.resolve(true);
          setDateConfirm(null);
        }}
        onCancel={() => {
          if (!dateConfirm) return;
          dateConfirm.resolve(false);
          setDateConfirm(null);
        }}
      />

      <ConfirmationModal
        isOpen={Boolean(deleteTarget)}
        title="Confirm Delete"
        message="Are you sure you want to delete this follow-up entry? This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onCancel={() => setDeleteTarget(null)}
        onConfirm={async () => {
          if (!deleteTarget) return;
          const id = deleteTarget.id;
          setDeleteTarget(null);
          await removeFollowUp(id);
        }}
      />

      <style jsx>{`
        .follow-grid {
          max-width: 100%;
        }

        .details-row {
          display: grid;
          grid-template-columns: 140px 1fr;
          gap: 10px;
          align-items: start;
          padding: 6px 0;
          border-bottom: 1px solid #eef2f7;
        }

        .details-key {
          color: #334155;
          font-weight: 600;
        }

        .details-value {
          color: #0f172a;
          line-height: 1.45;
          word-break: break-word;
        }

        .details-inline-error {
          color: #dc2626;
          font-size: 12px;
          margin-top: -2px;
          margin-bottom: 4px;
        }

        .form-group label {
          color: #334155;
          font-weight: 600;
        }

        @media (max-width: 1100px) {
          .follow-grid {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 640px) {
          .details-row {
            grid-template-columns: 1fr;
            gap: 4px;
          }
        }
      `}</style>
    </div>
  );
}
