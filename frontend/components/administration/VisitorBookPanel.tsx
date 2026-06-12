"use client";

import { FormEvent, useEffect, useMemo, useState, useRef } from "react";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import { ToastContainer, toast } from "react-toastify";
import s from "./VisitorBookPanel.module.css";

type Tab = "add" | "filter" | "list";

// --- Icons ---
const ChevronIcon = ({open}:{open:boolean}) => (
  <svg className={`${s.chevron} ${open?s.chevronOpen:""}`} width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M3.5 5.25L7 8.75L10.5 5.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
);
const CheckIcon = () => (<svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4.2 7.5L8 3" stroke="white" strokeWidth="1.6" strokeLinecap="round"/></svg>);
const PencilIcon = ({size=13}:{size?:number}) => (<svg width={size} height={size} viewBox="0 0 14 14" fill="none"><path d="M9.5 2.5L11.5 4.5L5 11H3V9L9.5 2.5Z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const FunnelIcon = () => (<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M2 3h12l-4.5 5V14L6.5 13V8L2 3Z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>);
const DocIcon = () => (<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="8" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.3"/><path d="M4.5 5H8M4.5 7.5H7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><path d="M9 4l2 2-2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>);
const PlusIcon = () => (<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 2v9M2 6.5h9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>);
const TrashIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 3h8M5 3V2h2v1M4 3l.5 7h3L8 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>);
const LinkIcon = () => (<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6.5 3.5a2 2 0 112.83 2.83l-1.5 1.5a2 2 0 01-2.83 0m-2.83 2.83a2 2 0 11-2.83-2.83l1.5-1.5a2 2 0 012.83 0" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>);

type ApiList<T> = T[] | { results?: T[]; count?: number; next?: string | null; previous?: string | null };

type AdminSetupRow = { id: number; type: "1" | "2" | "3" | "4"; name: string };
type SelectOption = { value: string; label: string };
type VisitorRow = {
  id: number;
  purpose: string;
  name: string;
  phone?: string;
  visitor_id: string;
  no_of_person: number;
  date: string;
  in_time: string;
  out_time: string;
  file_url?: string;
  created_by_name?: string | null;
};

type SortKey = "name" | "date" | "in_time" | "out_time";
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

async function apiForm<T>(path: string, method: "POST" | "PATCH", formData: FormData): Promise<T> {
  return apiRequestWithRefresh<T>(path, { method, body: formData });
}

async function apiDelete(path: string): Promise<void> {
  await apiRequestWithRefresh<void>(path, { method: "DELETE", headers: { "Content-Type": "application/json" } });
}

function displayValue(value: unknown) {
  const text = String(value ?? "").trim();
  if (!text || text === "-") return <span style={{ color: "#94a3b8", fontStyle: "italic" }}>N/A</span>;
  return text;
}

function parseTimeToMinutes(value: string) {
  const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})/);
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function VisitorBookPanel() {
  const [items, setItems] = useState<VisitorRow[]>([]);
  const [purposeOptions, setPurposeOptions] = useState<SelectOption[]>([]);
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
  const [purpose, setPurpose] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [noOfPerson, setNoOfPerson] = useState("1");
  const [date, setDate] = useState("");
  const [inTime, setInTime] = useState("");
  const [outTime, setOutTime] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [fileUpload, setFileUpload] = useState<File | null>(null);

  // Filters
  const [search, setSearch] = useState("");
  const [filterPurpose, setFilterPurpose] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [filterChips, setFilterChips] = useState<string[]>([]);

  // Table
  const [tableBusy, setTableBusy] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [deleteTarget, setDeleteTarget] = useState<VisitorRow | null>(null);

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

  const load = async (targetPage = page, targetPageSize = pageSize) => {
    try {
      setLoading(true);
      setError("");
      const [visitorData, setupData] = await Promise.all([
        apiGet<ApiList<VisitorRow>>(`/api/v1/admissions/visitors/?page=${targetPage}&page_size=${targetPageSize}`),
        apiGet<ApiList<AdminSetupRow>>("/api/v1/admissions/admin-setups/"),
      ]);
      const rows = listData(visitorData);
      const count = getTotalCount(visitorData);
      setItems(rows);
      setTotalRecords(count);
      setTotalPages(Math.max(1, Math.ceil(count / targetPageSize)));
      const setups = listData(setupData);
      setPurposeOptions(setups.filter((entry) => entry.type === "1").map((entry) => ({ value: String(entry.id), label: entry.name })));
    } catch (err: unknown) {
      setError(getErrorMessage(err, "Unable to load visitor book records."));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setDate(todayDate);
  }, [todayDate]);

  useEffect(() => {
    void load(page, pageSize);
  }, [page, pageSize]);

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
  }, [loading, search, items, sortKey, sortDir, page, pageSize, filterPurpose, filterDate]);

  const resetForm = () => {
    setEditingId(null);
    setPurpose("");
    setName("");
    setPhone("");
    setNoOfPerson("1");
    setDate(todayDate);
    setInTime("");
    setOutTime("");
    setFileUrl("");
    setFileUpload(null);
    setFieldErrors({});
    setFormBanner("");
  };

  const editRow = (row: VisitorRow) => {
    const matchedPurpose = purposeOptions.find((option) => option.value === row.purpose || option.label === row.purpose);
    setEditingId(row.id);
    setPurpose(matchedPurpose?.value || row.purpose || "");
    setName(row.name || "");
    setPhone(row.phone || "");
    setNoOfPerson(String(row.no_of_person || 1));
    setDate(row.date || "");
    setInTime(row.in_time || "");
    setOutTime(row.out_time || "");
    setFileUrl(row.file_url || "");
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
    if (!purpose.trim()) nextErrors.purpose = "Purpose is required.";
    if (!name.trim()) nextErrors.name = "Name is required.";
    if (name.trim() && !/^[A-Za-z\s\-']+$/.test(name.trim())) nextErrors.name = "Name must contain only letters, spaces, and hyphens";
    if (!date) nextErrors.date = "Date is required.";
    if (!inTime.trim()) nextErrors.inTime = "In time is required.";
    if (!outTime.trim()) nextErrors.outTime = "Out time is required.";
    if (phone.trim() && !/^\+?\d{10,12}$/.test(phone.trim())) nextErrors.phone = "Phone number must be 10-12 digits";

    const personCount = Number(noOfPerson);
    if (!noOfPerson.trim() || !Number.isInteger(personCount) || personCount < 1 || personCount > 99) nextErrors.noOfPerson = "Enter a valid number of persons";
    const inMinutes = parseTimeToMinutes(inTime);
    const outMinutes = parseTimeToMinutes(outTime);
    if (inMinutes !== null && outMinutes !== null && outMinutes <= inMinutes) nextErrors.outTime = "Out time must be after in time.";
    if (fileUpload && fileUpload.size > 5 * 1024 * 1024) nextErrors.attachment = "Attachment must be 5MB or smaller.";

    if (Object.keys(nextErrors).length > 0) {
      setFieldErrors(nextErrors);
      setFormBanner("Please fix the errors below before submitting.");
      setError("Please fix the errors below before submitting.");
      toast.error("Please fix the errors below before submitting.", { autoClose: 5000 });
      return;
    }

    const formData = new FormData();
    formData.append("purpose", purpose.trim());
    formData.append("name", name.trim());
    formData.append("phone", phone.trim());
    formData.append("no_of_person", String(personCount));
    formData.append("date", date);
    formData.append("in_time", inTime.trim());
    formData.append("out_time", outTime.trim());
    if (fileUpload) formData.append("file_upload", fileUpload);

    try {
      setSaving(true);
      setError("");
      setSuccess("");
      setFieldErrors({});
      setFormBanner("");
      if (editingId) {
        await apiForm(`/api/v1/admissions/visitors/${editingId}/`, "PATCH", formData);
        setSuccess("Record updated successfully.");
        toast.success("Record updated successfully.", { autoClose: 4000 });
      } else {
        await apiForm("/api/v1/admissions/visitors/", "POST", formData);
        setSuccess("Record created successfully.");
        toast.success("Record created successfully.", { autoClose: 4000 });
      }
      resetForm();
      await load();
      setActiveTab("list");
      scrollToTab("list");
    } catch (err: unknown) {
      const message = getErrorMessage(err, editingId ? "Unable to update visitor." : "Unable to add visitor.");
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
      await apiDelete(`/api/v1/admissions/visitors/${id}/`);
      setSuccess("Record deleted successfully.");
      toast.success("Record deleted successfully.", { autoClose: 4000 });
      const nextPage = page > 1 && items.length === 1 ? page - 1 : page;
      if (nextPage !== page) {
        setPage(nextPage);
      } else {
        await load(nextPage, pageSize);
      }
    } catch (err: unknown) {
      const message = getErrorMessage(err, "Unable to delete visitor record.");
      setError(message);
      toast.error(message, { autoClose: 6000 });
    } finally {
      setBusyId(null);
    }
  };

  const applyFilters = () => {
    const chips: string[] = [];
    if (search.trim()) chips.push(`Search: ${search}`);
    if (filterPurpose) {
      const pLabel = purposeOptions.find(o => o.value === filterPurpose)?.label || filterPurpose;
      chips.push(`Purpose: ${pLabel}`);
    }
    if (filterDate) chips.push(`Date: ${filterDate}`);
    setFilterChips(chips);
    setFilterOpen(false);
  };

  const clearFilters = () => {
    setSearch("");
    setFilterPurpose("");
    setFilterDate("");
    setFilterChips([]);
  };

  const filteredSorted = useMemo(() => {
    let next = [...items];
    const q = search.trim().toLowerCase();
    if (q) {
      next = next.filter((row) => [row.name, row.purpose, row.phone || "", row.visitor_id].join(" ").toLowerCase().includes(q));
    }
    if (filterPurpose) {
      next = next.filter(row => row.purpose === filterPurpose || purposeOptions.find(o => o.value === filterPurpose)?.label === row.purpose);
    }
    if (filterDate) {
      next = next.filter(row => row.date === filterDate);
    }

    next.sort((a, b) => {
      const mult = sortDir === "asc" ? 1 : -1;
      if (sortKey === "name") return a.name.localeCompare(b.name) * mult;
      if (sortKey === "date") return a.date.localeCompare(b.date) * mult;
      if (sortKey === "in_time") return a.in_time.localeCompare(b.in_time) * mult;
      return a.out_time.localeCompare(b.out_time) * mult;
    });
    return next;
  }, [items, search, sortKey, sortDir, filterPurpose, filterDate, purposeOptions]);

  return (
    <div className={s.root} style={{ padding: "16px 24px" }}>
      <ToastContainer position="top-right" newestOnTop closeOnClick pauseOnHover />
      
      <div className={s.pageCard}>
        <div className={s.pageBody} style={{ padding: "20px" }}>
          
          {/* Action Nav */}
          <div className={s.actionNav}>
            {[
              { id: "add" as Tab, step: "01", label: editingId ? "Edit Visitor" : "Add Visitor", icon: <PlusIcon /> },
              { id: "filter" as Tab, step: "02", label: "Smart Filter", icon: <FunnelIcon /> },
              { id: "list" as Tab, step: "03", label: "Visitor List", icon: <DocIcon /> }
            ].map(t => (
              <button key={t.id} type="button" className={`${s.navTab} ${activeTab === t.id ? s.navTabActive : ""}`}
                onClick={() => { setActiveTab(t.id); if (t.id === "filter") setFilterOpen(true); scrollToTab(t.id); }}>
                <span className={s.navTabStep}>{t.step}</span>{t.icon} {t.label}
              </button>
            ))}
          </div>

          {/* Section 01: Add/Edit Visitor */}
          <div className={s.assignCard} ref={addSecRef}>
            <div className={s.assignCardTop}>
              <div>
                <div className={s.assignCardTitle}>{editingId ? "Edit Visitor Details" : "Register New Visitor"}</div>
                <div className={s.assignCardSub}>Fields marked with * are mandatory. Please fill in the visitor information accurately.</div>
              </div>
              {editingId && <span className={s.enrollChip}><LinkIcon/> Editing Visitor: {name}</span>}
            </div>
            
            {formBanner && (
              <div style={{ background: "#fff5f5", border: "1px solid #ffd0cc", color: "var(--red)", padding: "10px 14px", borderRadius: 10, marginBottom: 16, fontSize: 13, fontWeight: 600 }}>
                {formBanner}
              </div>
            )}

            <form onSubmit={submit}>
              {/* Fields styled exactly like Multiple Subject Assignment read-only grid */}
              <div className={s.roGrid} style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: "12px 16px" }}>
                <div className={s.roField}>
                  <label>Purpose *</label>
                  <select required value={purpose} onChange={(e) => setPurpose(e.target.value)} className={s.roInput}>
                    <option value="" disabled hidden>Select Purpose *</option>
                    {purposeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </div>
                
                <div className={s.roField}>
                  <label>Student / Visitor Name *</label>
                  <input type="text" required value={name} onChange={(e) => setName(e.target.value)} className={s.roInput} placeholder="Enter name" />
                </div>
                
                <div className={s.roField}>
                  <label>Phone No.</label>
                  <input type="tel" inputMode="tel" maxLength={13} pattern="\+?\d{10,12}" value={phone} onChange={(e) => setPhone(e.target.value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "").slice(0, 13))} className={s.roInput} placeholder="e.g. +919876543210" />
                </div>
                
                <div className={s.roField}>
                  <label>Number of Persons *</label>
                  <input type="number" min={1} max={99} value={noOfPerson} onChange={(e) => setNoOfPerson(e.target.value)} className={s.roInput} />
                </div>
                
                <div className={s.roField}>
                  <label>Date *</label>
                  <input type="date" max={todayDate} value={date} onChange={(e) => setDate(e.target.value)} className={s.roInput} />
                </div>
                
                <div className={s.roField}>
                  <label>In Time *</label>
                  <input type="time" value={inTime} onChange={(e) => setInTime(e.target.value)} className={s.roInput} />
                </div>
                
                <div className={s.roField}>
                  <label>Out Time *</label>
                  <input type="time" value={outTime} onChange={(e) => setOutTime(e.target.value)} className={s.roInput} />
                </div>
                
                <div className={s.roField}>
                  <label>Attachment</label>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf,.doc,.docx" onChange={(e) => setFileUpload(e.target.files?.[0] ?? null)} className={s.roInput} style={{ padding: "4px 8px" }} />
                </div>
              </div>

              <hr className={s.previewDivider} style={{ marginTop: 20 }} />
              <div className={s.saveRow}>
                <div>
                  <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>All records are securely saved into the visitor log module.</span>
                </div>
                <div className={s.saveButtons}>
                  <button type="button" className={s.btnReset} onClick={resetForm}>{editingId ? "Cancel" : "Reset"}</button>
                  <button type="submit" disabled={saving} className={s.btnSave} style={{ minWidth: 140, justifyContent: "center" }}>
                    <CheckIcon /> {saving ? "Saving..." : editingId ? "Update Visitor" : "Save Visitor"}
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
                <div className={s.filterSub}>Find visitors easily by search, purpose, or date.</div>
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
                    <input className={s.filterInput} value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Name, Phone, ID..." />
                  </label>
                  <label className={s.fLbl}>
                    <span>Purpose</span>
                    <select className={s.filterInput} value={filterPurpose} onChange={(e) => setFilterPurpose(e.target.value)}>
                      <option value="">Any Purpose</option>
                      {purposeOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
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
              <span className={s.sectionTitle}>Browse Visitor List</span>
              <span className={s.sectionSub}>&mdash; view, edit, or delete existing records.</span>
            </div>

            <div style={{ background: "#fff", border: "1px solid var(--line)", borderRadius: "12px", overflow: "hidden" }}>
              <div className={s.tblWrap}>
                <div className={s.tblHead} style={{ gridTemplateColumns: "40px 2fr 1.5fr 1.5fr 1fr 100px", background: "#f8f8fc" }}>
                  <span>SL</span>
                  <span onClick={() => toggleSort("name")} style={{ cursor: "pointer" }}>Name {sortKey === "name" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                  <span>Phone</span>
                  <span>Purpose</span>
                  <span onClick={() => toggleSort("date")} style={{ cursor: "pointer" }}>Date {sortKey === "date" ? (sortDir === "asc" ? "↑" : "↓") : ""}</span>
                  <span style={{ textAlign: "right" }}>Actions</span>
                </div>
                
                {!loading && filteredSorted.length === 0 && (
                  <div style={{ padding: "32px", textAlign: "center", color: "var(--ink-mute)", fontSize: 13 }}>No visitor records found matching criteria.</div>
                )}

                {filteredSorted.map((row, index) => (
                  <div key={row.id} className={s.tblRow} style={{ gridTemplateColumns: "40px 2fr 1.5fr 1.5fr 1fr 100px" }}>
                    <span style={{ fontSize: 11, color: "var(--ink-mute)" }}>{(page - 1) * pageSize + index + 1}</span>
                    <div className={s.studentCell}>
                      <span className={s.studentName}>{row.name}</span>
                    </div>
                    <span className={s.admNo}>{displayValue(row.phone)}</span>
                    <span className={s.admNo}>{displayValue(row.purpose)}</span>
                    <span className={s.admNo}>{row.date}</span>
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
            <p style={{ margin: "0 0 24px", color: "var(--ink-mute)", fontSize: 13 }}>Are you sure you want to delete this visitor record? This action cannot be undone.</p>
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
