"use client";

import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { ToastContainer, toast } from "react-toastify";
import s from "./VisitorBookPanel.module.css";

type Tab = "add" | "filter" | "list";

// --- Icons ---
const ChevronIcon = ({ open }: { open: boolean }) => (
  <svg className={`${s.chevron} ${open ? s.chevronOpen : ""}`} width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);
const CheckIcon = () => (<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.2 7.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round" /></svg>);
const PencilIcon = ({ size = 13 }: { size?: number }) => (<svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5L11.5 4.5L5 11H3V9L9.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const FunnelIcon = () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12l-4.5 5V14L6.5 13V8L2 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" /></svg>);
const DocIcon = () => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3" /><path d="M4.5 5H8M4.5 7.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" /><path d="M9 4l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>);
const PlusIcon = () => (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>);
const TrashIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4 3l.5 7h3L8 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" /></svg>);
const LinkIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6.5 3.5a2 2 0 112.83 2.83l-1.5 1.5a2 2 0 01-2.83 0m-2.83 2.83a2 2 0 11-2.83-2.83l1.5-1.5a2 2 0 012.83 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" /></svg>);

type ApiList<T> = T[] | { results?: T[]; count?: number; next?: string | null; previous?: string | null };

type PhoneCallRow = {
  id: number;
  name?: string;
  phone: string;
  date?: string;
  next_follow_up_date?: string;
  call_duration?: string;
  description?: string;
  call_type: "I" | "O";
};

type SortKey = "name" | "phone" | "date" | "next_follow_up_date" | "call_duration" | "call_type";
type SortDir = "asc" | "desc";

function getErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message && message !== "[object Object]") return message;
  }
  return fallback;
}

function listData<T>(value: ApiList<T>): T[] {
  return Array.isArray(value) ? value : value.results || [];
}

function getTotalCount<T>(value: ApiList<T>): number {
  if (Array.isArray(value)) return value.length;
  if (typeof value.count === "number") return value.count;
  return (value.results || []).length;
}

async function apiGet<T>(path: string): Promise<T> {
  return apiRequestWithRefresh<T>(path, { headers: { "Content-Type": "application/json" } });
}

async function apiMutate<T>(path: string, method: "POST" | "PATCH", payload: unknown): Promise<T> {
  return apiRequestWithRefresh<T>(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, { method: "DELETE", headers: { "Content-Type": "application/json" } });
}

function displayValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return <span style={{ color: "#94a3b8", fontStyle: "italic" }}>N/A</span>;
  return text;
}

function sanitizePlain(value: string) {
  return value.replace(/<[^>]*>/g, "").replace(/[<>&"']/g, "");
}

function formatCallDuration(duration: string): string {
  const text = String(duration || "").trim();
  if (!text) return "";
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) return text;
  const minMatch = text.match(/^(\d{1,4})\s*min(?:ute)?s?$/i);
  if (minMatch) {
    const mins = Number(minMatch[1]);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }
  if (/^\d+$/.test(text)) {
    const mins = Number(text);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:00`;
  }
  return text;
}

export function PhoneCallLogPanel() {
  const [items, setItems] = useState<PhoneCallRow[]>([]);
  const [totalRecords, setTotalRecords] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formBanner, setFormBanner] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);

  // Form Fields
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [date, setDate] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [callDuration, setCallDuration] = useState("");
  const [description, setDescription] = useState("");
  const [callType, setCallType] = useState<"I" | "O">("I");

  // Filters
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterChips, setFilterChips] = useState<string[]>([]);

  // Table
  const [tableBusy, setTableBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deleteTarget, setDeleteTarget] = useState<PhoneCallRow | null>(null);

  // Nav Tabs
  const [activeTab, setActiveTab] = useState<Tab>("add");
  const [filterOpen, setFilterOpen] = useState(false);
  const addSecRef = useRef<HTMLDivElement | null>(null);
  const filterSecRef = useRef<HTMLDivElement | null>(null);
  const listSecRef = useRef<HTMLDivElement | null>(null);

  const scrollToTab = (id: Tab) => {
    const el = id === "add" ? addSecRef.current : id === "filter" ? filterSecRef.current : listSecRef.current;
    if (el) {
      setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
  };

  const todayDate = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet<ApiList<PhoneCallRow>>("/api/v1/admissions/phone-call-logs/");
      const rows = listData(data);
      const count = getTotalCount(data);
      setItems(rows);
      setTotalRecords(count);
      setTotalPages(Math.max(1, Math.ceil(count / pageSize)));
    } catch (err: unknown) {
      const message = "Unable to load phone call logs.";
      setError(message);
      toast.error(message, { autoClose: 5000 });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDate(todayDate);
    setFollowUpDate(todayDate);
  }, [todayDate]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  useEffect(() => {
    if (!formBanner) return;
    const timer = window.setTimeout(() => setFormBanner(""), 5000);
    return () => window.clearTimeout(timer);
  }, [formBanner]);

  useEffect(() => {
    if (loading) {
      setTableBusy(true);
      return;
    }
    setTableBusy(true);
    const timer = window.setTimeout(() => setTableBusy(false), 250);
    return () => window.clearTimeout(timer);
  }, [loading, search, items, sortKey, sortDir, page, pageSize, filterType, filterDate]);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setPhone("");
    setDate(todayDate);
    setFollowUpDate(todayDate);
    setCallDuration("");
    setDescription("");
    setCallType("I");
    setFieldErrors({});
    setFormBanner("");
  };

  const editRow = (row: PhoneCallRow) => {
    setEditingId(row.id);
    setName(row.name || "");
    setPhone(row.phone || "");
    setDate(row.date || todayDate);
    setFollowUpDate(row.next_follow_up_date || "");
    setCallDuration(formatCallDuration(row.call_duration || ""));
    setDescription(sanitizePlain(row.description || ""));
    setCallType((row.call_type || "I") as "I" | "O");
    setFieldErrors({});
    setFormBanner("");
    setActiveTab("add");
    scrollToTab("add");
  };

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!name.trim()) nextErrors.name = "Name is required.";
    else if (name.trim().length < 2) nextErrors.name = "Name must be at least 2 characters.";
    else if (!/^[A-Za-z0-9\s\-'.,()]+$/.test(name.trim())) nextErrors.name = "Invalid characters in Name.";

    if (!phone.trim()) nextErrors.phone = "Phone is required.";
    else if (!/^\+?\d{10,12}$/.test(phone.trim())) nextErrors.phone = "Phone number must be 10-12 digits.";

    if (!date) nextErrors.date = "From Date is required.";
    else if (date > todayDate) nextErrors.date = "From Date cannot be in the future.";

    if (followUpDate) {
      if (date && followUpDate < date) nextErrors.followUpDate = "To Date cannot be before From Date.";
      if (followUpDate > todayDate) nextErrors.followUpDate = "To Date cannot be in the future.";
    }

    if (!callDuration.trim()) nextErrors.callDuration = "Call Duration is required.";
    else if (!/^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$/.test(callDuration.trim())) {
      nextErrors.callDuration = "Enter duration in HH:MM:SS format (e.g., 00:10:00).";
    }

    if (description && description.length > 500) nextErrors.description = "Description must not exceed 500 characters.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormBanner("Please fix the errors below before submitting.");
      setError("Please fix the errors below before submitting.");
      toast.error("Please fix the errors below before submitting.", { autoClose: 5000 });
      return;
    }

    const payload = {
      name: sanitizePlain(name).trim(),
      phone: phone.trim(),
      date: date || null,
      next_follow_up_date: followUpDate || null,
      call_duration: callDuration.trim(),
      description: sanitizePlain(description).trim(),
      call_type: callType,
    };

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      setFormBanner("");
      if (editingId) {
        await apiMutate(`/api/v1/admissions/phone-call-logs/${editingId}/`, "PATCH", payload);
        setSuccess("Record updated successfully.");
        toast.success("Record updated successfully.", { autoClose: 4000 });
      } else {
        await apiMutate("/api/v1/admissions/phone-call-logs/", "POST", payload);
        setSuccess("Record created successfully.");
        toast.success("Record created successfully.", { autoClose: 4000 });
      }
      resetForm();
      await load();
      setActiveTab("list");
      scrollToTab("list");
    } catch (err: unknown) {
      const message = getErrorMessage(err, editingId ? "Unable to update phone call." : "Unable to add phone call.");
      setError(message);
      toast.error(message, { autoClose: 6000 });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    try {
      setBusyId(id);
      setError("");
      setSuccess("");
      await apiDelete(`/api/v1/admissions/phone-call-logs/${id}/`);
      setSuccess("Record deleted successfully.");
      toast.success("Record deleted successfully.", { autoClose: 4000 });
      await load();
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Unable to delete phone call record.");
      setError(message);
      toast.error(message, { autoClose: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  const applyFilters = () => {
    const chips: string[] = [];
    if (search.trim()) chips.push(`Search: ${search}`);
    if (filterType) chips.push(`Type: ${filterType === "I" ? "Incoming" : "Outgoing"}`);
    if (filterDate) chips.push(`Date: ${filterDate}`);
    setFilterChips(chips);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterType("");
    setFilterDate("");
    setFilterChips([]);
  };

  const filteredSorted = useMemo(() => {
    let next = [...items];
    const q = search.trim().toLowerCase();
    if (q) {
      next = next.filter((row) => [row.name, row.phone, row.description].join(" ").toLowerCase().includes(q));
    }
    if (filterType) {
      next = next.filter(row => row.call_type === filterType);
    }
    if (filterDate) {
      next = next.filter(row => row.date === filterDate);
    }

    next.sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return String(a.name || "").localeCompare(String(b.name || "")) * mult;
      if (sortKey === "phone") return String(a.phone || "").localeCompare(String(b.phone || "")) * mult;
      if (sortKey === "date") return String(a.date || "").localeCompare(String(b.date || "")) * mult;
      if (sortKey === "next_follow_up_date") return String(a.next_follow_up_date || "").localeCompare(String(b.next_follow_up_date || "")) * mult;
      if (sortKey === "call_duration") return formatCallDuration(String(a.call_duration || "")).localeCompare(formatCallDuration(String(b.call_duration || ""))) * mult;
      return String(a.call_type || "").localeCompare(String(b.call_type || "")) * mult;
    });
    return next;
  }, [items, search, sortKey, sortDir, filterType, filterDate]);

  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = pageStart + pageSize;
  const pageRows = filteredSorted.slice(pageStart, pageEnd);

  return (
    <div className={s.root} style={{ padding: "16px 24px" }}>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnHover />

      <div className={s.pageCard}>
        <div className={s.pageBody} style={{ padding: "20px" }}>

          {/* Action Nav */}
          <div className={s.actionNav}>
            {[
              { id: "add" as Tab, step: "01", label: editingId ? "Edit Phone Call" : "Add Phone Call", icon: <PlusIcon /> },
              { id: "filter" as Tab, step: "02", label: "Smart Filter", icon: <FunnelIcon /> },
              { id: "list" as Tab, step: "03", label: "Call Logs", icon: <DocIcon /> }
            ].map(t => (
              <button key={t.id} type="button" className={`${s.navTab} ${activeTab === t.id ? s.navTabActive : ""}`}
                onClick={() => { setActiveTab(t.id); if (t.id === "filter") setFilterOpen(true); scrollToTab(t.id); }}>
                <span className={s.navTabStep}>{t.step}</span>{t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Section 01: Add/Edit Phone Call */}
          <div className={s.assignCard} ref={addSecRef}>
            <div className={s.assignCardTop}>
              <div>
                <div className={s.assignCardTitle}>{editingId ? "Edit Phone Call Details" : "Log New Phone Call"}</div>
                <div className={s.assignCardSub}>Fields marked with * are mandatory. Keep records of important incoming and outgoing calls.</div>
              </div>
              {editingId && <span className={s.enrollChip}><LinkIcon /> Editing Log: {name}</span>}
            </div>

            {formBanner && (
              <div style={{ background: "#fff5f5", border: "1px solid #ffd0cc", color: "var(--red)", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                {formBanner}
              </div>
            )}

            <form onSubmit={submit}>
              <div className={s.roGrid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px 16px" }}>

                <div className={s.roField}>
                  <label>Caller Name *</label>
                  <input type="text" required minLength={2} maxLength={100} value={name} onChange={(e) => setName(e.target.value)} className={s.roInput} placeholder="Enter name" />
                </div>

                <div className={s.roField}>
                  <label>Phone No. *</label>
                  <input type="tel" required inputMode="tel" maxLength={13} pattern="\+?\d{10,12}" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "").slice(0, 13))} className={s.roInput} placeholder="e.g. +919876543210" />
                </div>

                <div className={s.roField}>
                  <label>Call Type *</label>
                  <select required value={callType} onChange={(e) => setCallType(e.target.value as "I" | "O")} className={s.roInput}>
                    <option value="I">Incoming</option>
                    <option value="O">Outgoing</option>
                  </select>
                </div>

                <div className={s.roField}>
                  <label>Date *</label>
                  <input type="date" required max={todayDate} value={date} onChange={(e) => setDate(e.target.value)} className={s.roInput} />
                </div>

                <div className={s.roField}>
                  <label>Follow-up Date</label>
                  <input type="date" min={date || undefined} max={todayDate} value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} className={s.roInput} />
                </div>

                <div className={s.roField}>
                  <label>Call Duration *</label>
                  <input type="text" required pattern="^([0-9]{1,2}):([0-5][0-9]):([0-5][0-9])$" value={callDuration} onChange={(e) => setCallDuration(e.target.value)} className={s.roInput} placeholder="HH:MM:SS" />
                </div>

                <div className={s.roField} style={{ gridColumn: "1 / -1" }}>
                  <label>Description</label>
                  <input type="text" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} className={s.roInput} placeholder="Brief summary of the call" />
                </div>

              </div>

              <hr className={s.previewDivider} style={{ marginTop: 20 }} />
              <div className={s.saveRow}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>All records are securely saved into the communication log module.</span>
                </div>
                <div className={s.saveButtons}>
                  <button type="button" className={s.btnReset} onClick={resetForm}>{editingId ? "Cancel" : "Reset"}</button>
                  <button type="submit" disabled={saving} className={s.btnSave} style={{ minWidth: 140, justifyContent: "center" }}>
                    <CheckIcon /> {saving ? "Saving..." : editingId ? "Update Log" : "Save Log"}
                  </button>
                </div>
              </div>
            </form>
          </div>

          {/* Section 02 Smart Filter */}
          <div className={s.filterCard} ref={filterSecRef}>
            <div className={`${s.filterTrigger} ${filterOpen ? s.filterTriggerOpen : ""}`} onClick={() => setFilterOpen(v => !v)}>
              <span className={s.stepBadge}>02</span>
              <span className={s.filterIconBox}><FunnelIcon /></span>
              <div>
                <div className={s.filterTitle}>Smart filters</div>
                <div className={s.filterSub}>Find call logs easily by search, type, or date.</div>
              </div>
              <div className={s.triggerRight}>
                {filterChips.map(c => (
                  <span key={c} className={s.darkChip}>{c} <span className={s.darkChipX} onClick={(e) => { e.stopPropagation(); setFilterChips(fc => fc.filter(x => x !== c)); }}>&#215;</span></span>
                ))}
                {filterChips.length > 0 && (
                  <button type="button" className={s.btnGhost} style={{ fontSize: 11, padding: "4px 8px" }} onClick={(e) => { e.stopPropagation(); clearFilters(); }}>Clear</button>
                )}
                <ChevronIcon open={filterOpen} />
              </div>
            </div>
            {filterOpen && (
              <div className={s.filterBody}>
                <div className={s.filterGrid8} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))" }}>
                  <label className={s.fLbl}>
                    <span>Search</span>
                    <input className={s.filterInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, Phone..." />
                  </label>
                  <label className={s.fLbl}>
                    <span>Call Type</span>
                    <select className={s.filterInput} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
                      <option value="">All Types</option>
                      <option value="I">Incoming</option>
                      <option value="O">Outgoing</option>
                    </select>
                  </label>
                  <label className={s.fLbl}>
                    <span>Date</span>
                    <input type="date" className={s.filterInput} value={filterDate} onChange={(e) => setFilterDate(e.target.value)} />
                  </label>
                </div>
                <div className={s.filterBottom}>
                  <div style={{ display: "flex", gap: 6 }}>
                    {filterChips.map(c => <span key={c} className={s.darkChip}>{c} <span className={s.darkChipX} onClick={() => setFilterChips(fc => fc.filter(x => x !== c))}>&#215;</span></span>)}
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button type="button" className={s.btnGhost} onClick={clearFilters}>Clear filters</button>
                    <button type="button" className={s.btnPrimary} onClick={applyFilters}>Apply Filters</button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Section 03 Browse */}
          <div className={s.browseSection} ref={listSecRef}>
            <div className={s.sectionHeading}>
              <span className={s.stepBadge}>03</span>
              <span className={s.sectionTitle}>Browse Call Logs</span>
              <span className={s.sectionSub}>&mdash; view, edit, or delete existing records.</span>
            </div>

            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
              <div className={s.tblWrap}>
                <div className={s.tblHead} style={{ gridTemplateColumns: "40px 1.5fr 1fr 1fr 1fr 1fr 1fr 100px", background: "#f8f8fc" }}>
                  <span>SL</span>
                  <span onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>Name {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                  <span>Phone</span>
                  <span>Type</span>
                  <span onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>Date {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                  <span>Duration</span>
                  <span>Follow-up</span>
                  <span style={{ textAlign: "right" }}>Actions</span>
                </div>

                {!loading && filteredSorted.length === 0 && (
                  <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>No phone call records found matching criteria.</div>
                )}

                {pageRows.map((row, index) => (
                  <div key={row.id} className={s.tblRow} style={{ gridTemplateColumns: "40px 1.5fr 1fr 1fr 1fr 1fr 1fr 100px" }}>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{(page - 1) * pageSize + index + 1}</span>
                    <div className={s.studentCell}>
                      <span className={s.studentName}>{row.name}</span>
                    </div>
                    <span className={s.admNo}>{displayValue(row.phone)}</span>
                    <span className={s.admNo}>{row.call_type === "I" ? "Incoming" : "Outgoing"}</span>
                    <span className={s.admNo}>{row.date}</span>
                    <span className={s.admNo}>{displayValue(formatCallDuration(row.call_duration || ""))}</span>
                    <span className={s.admNo}>{displayValue(row.next_follow_up_date)}</span>
                    <div className={s.tblLastCol}>
                      <button type="button" className={s.editBtn} onClick={() => editRow(row)} title="Edit"><PencilIcon /></button>
                      <button type="button" className={s.editBtn} onClick={() => setDeleteTarget(row)} title="Delete" style={{ color: "var(--red)", borderColor: "rgba(229, 83, 75, 0.2)" }}><TrashIcon /></button>
                    </div>
                  </div>
                ))}

                <div className={s.tblFooter}>
                  <span className={s.tblFooterTxt}>
                    Showing page {page} of {totalPages} ({totalRecords} total records)
                  </span>

                  <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>Page size:</span>
                      <select value={pageSize} onChange={(e) => { setPage(1); setPageSize(Number(e.target.value)); }} style={{ padding: "4px 8px", fontSize: 11, borderRadius: 6, border: "1px solid var(--line)", background: "#fff", outline: "none" }}>
                        {[5, 10, 20, 30, 40, 50].map(sz => <option key={sz} value={sz}>{sz}</option>)}
                      </select>
                    </div>
                    <div className={s.pager}>
                      <button type="button" className={s.pagerBtn} disabled={loading || page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>‹</button>
                      <button type="button" className={s.pagerBtn} disabled={loading || page >= totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>›</button>
                    </div>
                  </div>
                </div>
              </div>
              {tableBusy && <div style={{ height: 3, background: "var(--primary)", width: "100%", animation: "pulse 1s infinite" }} />}
            </div>
          </div>

        </div>
      </div>

      {deleteTarget && (
        <div className={s.backdrop} onClick={() => setDeleteTarget(null)}>
          <div className={s.modal} style={{ maxWidth: 400, padding: 24, textAlign: "center" }} onClick={e => e.stopPropagation()}>
            <div style={{ width: 48, height: 48, background: "#fff5f5", borderRadius: "50%", color: "var(--red)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
              <TrashIcon />
            </div>
            <h3 style={{ margin: "0 0 8px", fontSize: 18, color: "var(--ink)" }}>Confirm Delete</h3>
            <p style={{ margin: "0 0 24px", color: "var(--ink-mute)", fontSize: 13 }}>Are you sure you want to delete this phone call log? This action cannot be undone.</p>
            <div style={{ display: "flex", gap: 12 }}>
              <button type="button" className={s.btnReset} style={{ flex: 1 }} onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button type="button" className={s.btnSave} style={{ flex: 1, background: "var(--red)", justifyContent: "center", boxShadow: "none" }} onClick={async () => { const id = deleteTarget.id; setDeleteTarget(null); await remove(id); }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
