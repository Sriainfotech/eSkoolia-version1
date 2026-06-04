"use client";

import { useMemo, useState } from "react";
import {
  ChevronDown,
  Eye,
  Pencil,
  FileText,
  MoreHorizontal,
  Search as SearchIcon,
  Plus,
  X,
} from "lucide-react";
import { useAllDepartments, useStaff } from "@/hooks/useHrApi";
import type { Department, Staff } from "@/types/hr";

// ─── helpers ─────────────────────────────────────────────────────────────────
function initials(s: Staff): string {
  const full = (s.full_name ?? `${s.first_name ?? ""} ${s.last_name ?? ""}`).trim();
  const parts = full.split(/\s+/).filter(Boolean);
  return (parts[0]?.[0] ?? "?").toUpperCase() + (parts[1]?.[0] ?? "").toUpperCase();
}

function fullName(s: Staff): string {
  return (s.full_name ?? `${s.first_name ?? ""} ${s.last_name ?? ""}`).trim() || s.staff_no;
}

function formatJoining(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatSalary(n?: number): string {
  if (!n && n !== 0) return "—";
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function rupeeTotalFromStaff(s: Staff): number {
  return (s.basic_salary ?? 0) + (s.hra ?? 0) + (s.da ?? 0)
    + (s.travel_allowance ?? 0) + (s.medical_allowance ?? 0) + (s.special_allowance ?? 0);
}

const STATUS_STYLES: Record<string, string> = {
  active:       "text-emerald-600 bg-emerald-50",
  probation:    "text-amber-600 bg-amber-50",
  inactive:     "text-slate-500 bg-slate-100",
  terminated:   "text-rose-600 bg-rose-50",
  offboarded:   "text-rose-600 bg-rose-50",
};

// ─── department accordion ────────────────────────────────────────────────────
function DepartmentAccordion({
  dept,
  staff,
  open,
  onToggle,
  selected,
  toggleSelect,
  onView,
}: {
  dept: { id: number | string; name: string };
  staff: Staff[];
  open: boolean;
  onToggle: () => void;
  selected: Set<number>;
  toggleSelect: (id: number) => void;
  onView: (s: Staff) => void;
}) {
  const total = staff.length;
  const active = staff.filter((s) => s.status === "active").length;
  const roles = new Set(staff.map((s) => s.designation_name).filter(Boolean)).size;
  const present = staff.filter((s) => s.is_present).length;
  const presentPct = total ? Math.round((present / total) * 100) : 0;
  const donutBg = `conic-gradient(var(--brand) ${presentPct * 3.6}deg, #E8E8EE 0deg)`;

  return (
    <div className="bg-white border border-[#E8E8EE] rounded-[14px] overflow-hidden mb-3 shadow-[0_12px_28px_-24px_rgba(15,23,42,.38)]">
      {/* header */}
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-3 cursor-pointer border-l-4 border-[var(--strong,#4F35CC)]"
        style={{ background: "linear-gradient(135deg,#fff 60%,#EEEAFF 100%)" }}
      >
        <button
          type="button"
          className="w-6 h-6 grid place-items-center rounded-md text-slate-500 hover:bg-[#EEEAFF] hover:text-[var(--brand,#6D4AFF)]"
          aria-label={open ? "Collapse" : "Expand"}
        >
          <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="text-[15px] font-[850] text-[#15172A]">{dept.name}</div>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Chip>{total} staff</Chip>
            <Chip tone="green">{active} active</Chip>
            <Chip tone="violet">{roles} roles</Chip>
            <Chip tone="blue">{present} present today</Chip>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-[10px] border border-[#E8E8EE] bg-white text-[12px] font-[700] text-[#15172A] hover:border-[var(--brand,#6D4AFF)] hover:text-[var(--brand,#6D4AFF)]"
        >
          <Plus size={13} /> Add staff
        </button>
        <div
          className="w-9 h-9 rounded-full grid place-items-center text-[10px] font-[800] text-white"
          style={{ background: donutBg }}
          title={`${presentPct}% present today`}
        >
          <div className="w-6 h-6 rounded-full bg-white grid place-items-center text-[10px] font-[800] text-[var(--brand,#6D4AFF)]">
            {presentPct}%
          </div>
        </div>
      </div>

      {/* body */}
      {open && (
        <div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-[13px]">
              <thead>
                <tr className="bg-[#FBFCFE] text-[11px] font-[800] tracking-[0.06em] text-[#53627A] uppercase">
                  <th className="w-[42px] py-3 pl-4">
                    <input type="checkbox" className="accent-[var(--brand,#6D4AFF)]" />
                  </th>
                  <th className="text-left py-3">Staff</th>
                  <th className="text-left py-3">Staff ID</th>
                  <th className="text-left py-3">Designation</th>
                  <th className="text-left py-3">Classes / Route</th>
                  <th className="text-left py-3">Joining</th>
                  <th className="text-left py-3">Status</th>
                  <th className="text-left py-3">Salary</th>
                  <th className="text-left py-3 pr-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {staff.map((s) => {
                  const sel = selected.has(s.id);
                  const statusKey = (s.status ?? "").toLowerCase();
                  return (
                    <tr
                      key={s.id}
                      className={`border-t border-[#EEF0F4] hover:bg-[#FAFAFD] ${sel ? "bg-[#F4F1FF]" : ""}`}
                    >
                      <td className="pl-4 py-3 align-middle">
                        <input
                          type="checkbox"
                          checked={sel}
                          onChange={() => toggleSelect(s.id)}
                          className="accent-[var(--brand,#6D4AFF)]"
                        />
                      </td>
                      <td className="py-3">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="relative shrink-0">
                            <div className="w-9 h-9 rounded-full bg-[var(--brand,#6D4AFF)] text-white grid place-items-center text-[12px] font-[800]">
                              {initials(s)}
                            </div>
                            {s.is_present && (
                              <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-[700] text-[#15172A] truncate">{fullName(s)}</div>
                            <div className="text-[11.5px] text-[#64748B] truncate">
                              {s.designation_name || "—"}
                              {s.mobile ? ` · ${s.mobile}` : ""}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="inline-flex items-center px-2 py-1 rounded-md bg-[#F4F4F8] text-[#15172A] text-[11.5px] font-[700] tracking-wide">
                          {s.staff_id || s.staff_no || "—"}
                        </span>
                      </td>
                      <td className="py-3 text-[#15172A]">{s.designation_name || "—"}</td>
                      <td className="py-3 text-[#15172A]">{s.classes_subjects || "—"}</td>
                      <td className="py-3 text-[#15172A]">{formatJoining(s.joining_date)}</td>
                      <td className="py-3">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-[700] capitalize ${STATUS_STYLES[statusKey] ?? "text-slate-600 bg-slate-100"}`}
                        >
                          {s.status || "—"}
                        </span>
                      </td>
                      <td className="py-3 font-[700] text-[#15172A]">
                        {formatSalary(rupeeTotalFromStaff(s))}
                      </td>
                      <td className="pr-4 py-3">
                        <div className="flex items-center gap-1.5 text-[#64748B]">
                          <IconBtn title="View" onClick={() => onView(s)}>
                            <Eye size={15} />
                          </IconBtn>
                          <IconBtn title="Edit"><Pencil size={14} /></IconBtn>
                          <IconBtn title="Documents"><FileText size={14} /></IconBtn>
                          <IconBtn title="More"><MoreHorizontal size={15} /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {staff.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-[#64748B] text-[13px]">
                      No staff in this department yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "slate" | "green" | "violet" | "blue";
}) {
  const map: Record<string, string> = {
    slate:  "bg-[#F4F4F8] text-[#5B5E72]",
    green:  "bg-emerald-50 text-emerald-600",
    violet: "bg-[#EEEAFF] text-[var(--brand,#6D4AFF)]",
    blue:   "bg-blue-50 text-blue-600",
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-[700] ${map[tone]}`}>
      {children}
    </span>
  );
}

function IconBtn({
  title,
  children,
  onClick,
}: {
  title: string;
  children: React.ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="w-7 h-7 grid place-items-center rounded-md hover:bg-[#EEEAFF] hover:text-[var(--brand,#6D4AFF)] transition-colors"
    >
      {children}
    </button>
  );
}

// ─── profile drawer ──────────────────────────────────────────────────────────
function ProfileDrawer({ staff, onClose }: { staff: Staff | null; onClose: () => void }) {
  if (!staff) return null;
  return (
    <div
      className="fixed inset-0 z-[900] flex justify-end bg-black/35"
      onClick={onClose}
    >
      <aside
        className="w-[390px] max-w-[94vw] h-full bg-white overflow-auto shadow-[-20px_0_45px_-26px_rgba(15,23,42,.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative px-5 pt-5 pb-4 border-b border-[#EEF0F4]">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-full text-slate-500 hover:bg-slate-100"
            aria-label="Close"
          >
            <X size={16} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-full bg-[var(--brand,#6D4AFF)] text-white grid place-items-center text-[16px] font-[800]">
              {initials(staff)}
            </div>
            <div className="min-w-0">
              <div className="text-[16px] font-[800] text-[#15172A] truncate">{fullName(staff)}</div>
              <div className="text-[12px] text-[#64748B] truncate">
                {staff.designation_name || "—"} · {staff.department_name || "—"}
              </div>
              <div className="text-[11px] text-[#94A3B8] mt-0.5">{staff.staff_id || staff.staff_no}</div>
            </div>
          </div>
        </div>

        <Section title="Contact">
          <Info label="Mobile" value={staff.mobile || "—"} />
          <Info label="Email" value={staff.official_email || staff.personal_email || staff.email || "—"} />
          <Info label="WhatsApp" value={staff.whatsapp || "—"} />
        </Section>

        <Section title="Employment">
          <Info label="Joining" value={formatJoining(staff.joining_date)} />
          <Info label="Type" value={staff.employment_type || "—"} />
          <Info label="Status" value={staff.status || "—"} />
          <Info label="Reports to" value={staff.reporting_manager_name || "—"} />
        </Section>

        <Section title="Compensation">
          <div className="bg-[#F8F6FF] border border-[#DDD6FE] rounded-[12px] p-3 mt-1">
            <div className="text-[11px] uppercase tracking-[0.08em] text-[#64748B] font-[800]">Gross monthly</div>
            <div className="text-[22px] font-[900] text-[var(--brand,#6D4AFF)] mt-0.5">
              {formatSalary(rupeeTotalFromStaff(staff))}
            </div>
          </div>
        </Section>
      </aside>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-[#EEF0F4]">
      <h4 className="text-[10px] font-[800] tracking-[0.08em] text-[#64748B] uppercase mb-2">{title}</h4>
      <div>{children}</div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 text-[12px] py-1 border-b border-dashed border-[#EEF2F7] last:border-0">
      <span className="text-[#64748B]">{label}</span>
      <strong className="text-[#15172A] text-right truncate">{value}</strong>
    </div>
  );
}

// ─── page ────────────────────────────────────────────────────────────────────
export default function HrDirectoryPage() {
  const { data: deptData, loading: deptLoading } = useAllDepartments();
  const [search, setSearch] = useState("");
  const [submittedSearch, setSubmittedSearch] = useState("");
  const { data: staffData, loading: staffLoading } = useStaff({ search: submittedSearch || undefined });

  const [filterOpen, setFilterOpen] = useState(false);
  const [openDeptId, setOpenDeptId] = useState<number | string | null>(null);
  const [expandAllMode, setExpandAllMode] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [profile, setProfile] = useState<Staff | null>(null);

  const departments: Department[] = deptData?.results ?? [];
  const staffList: Staff[] = staffData?.results ?? [];

  const grouped = useMemo(() => {
    const byDept = new Map<number | string, Staff[]>();
    for (const s of staffList) {
      const key = s.department ?? "__none";
      const bucket = byDept.get(key) ?? [];
      bucket.push(s);
      byDept.set(key, bucket);
    }
    const result: { dept: { id: number | string; name: string }; staff: Staff[] }[] = [];
    for (const d of departments) {
      const items = byDept.get(d.id) ?? [];
      if (items.length || !submittedSearch) {
        result.push({ dept: { id: d.id, name: d.name }, staff: items });
      }
    }
    const orphans = byDept.get("__none") ?? [];
    if (orphans.length) result.push({ dept: { id: "__none", name: "Unassigned" }, staff: orphans });
    return result;
  }, [departments, staffList, submittedSearch]);

  const toggleDept = (id: number | string) => {
    setExpandAllMode(false); // Exit expand-all mode when manually toggling
    setOpenDeptId((current) => (current === id ? null : id));
  };

  const collapseAll = () => {
    setExpandAllMode(false);
    setOpenDeptId(null);
  };

  const expandAll = () => {
    setExpandAllMode(true);
    setOpenDeptId(null); // Clear single-expand selection
  };

  const toggleSelect = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === staffList.length) setSelected(new Set());
    else setSelected(new Set(staffList.map((s) => s.id)));
  };

  const runSearch = () => setSubmittedSearch(search.trim());

  const totalStaff = staffList.length;
  const totalActive = staffList.filter((s) => s.status === "active").length;
  const totalPresent = staffList.filter((s) => s.is_present).length;

  return (
    <div className="max-w-[1400px] mx-auto">
      {/* Hero */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
        <div>
          <p className="text-[11px] uppercase tracking-[0.12em] text-[#64748B] font-[700] mb-1">Staff records</p>
          <h1
            className="text-[40px] leading-[1.1] font-[700] text-[#15172A] m-0"
            style={{ fontFamily: "var(--serif, Georgia, serif)", letterSpacing: "-0.02em" }}
          >
            Staff{" "}
            <span
              className="italic font-[400] text-[var(--brand,#6D4AFF)]"
              style={{ fontFamily: "var(--serif, Georgia, serif)" }}
            >
              directory
            </span>
          </h1>
          <p className="text-[14px] text-[#64748B] mt-1 max-w-[640px]">
            Department parent accordions with staff child rows, fast filters, and profile details in a side hover panel.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="h-10 px-4 rounded-[11px] border border-[#E8E8EE] bg-white text-[13.5px] font-[600] text-[#15172A] hover:border-[var(--brand,#6D4AFF)] hover:text-[var(--brand,#6D4AFF)]"
          >
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => { window.location.href = "/hr/onboard"; }}
            className="h-10 px-4 rounded-[11px] bg-[var(--brand,#6D4AFF)] text-white text-[13.5px] font-[700] hover:bg-[var(--strong,#4F35CC)] shadow-[0_8px_18px_-10px_rgba(108,60,225,.7)]"
          >
            Onboard Staff
          </button>
        </div>
      </div>

      {/* Smart Filter */}
      <div className="bg-white border border-[#E8E8EE] rounded-[14px] overflow-hidden mb-3 shadow-[0_4px_12px_-4px_rgba(15,18,34,.08)]">
        <button
          type="button"
          onClick={() => setFilterOpen((o) => !o)}
          className="w-full flex items-center gap-3 px-4 py-3 text-left border-l-4 border-[var(--strong,#4F35CC)]"
          style={{ background: "#FBFAFF" }}
        >
          <ChevronDown
            size={16}
            className={`text-[var(--brand,#6D4AFF)] transition-transform ${filterOpen ? "rotate-180" : "-rotate-90"}`}
          />
          <div className="flex-1 min-w-0">
            <div className="font-[800] text-[14px] text-[#15172A]">Smart Filter &amp; Bulk Actions</div>
            <div className="mt-1 flex gap-2">
              <Chip>No filters active</Chip>
              <Chip tone="violet">Grouped by department</Chip>
            </div>
          </div>
          <span className="text-[12px] text-[#64748B]">{filterOpen ? "Collapse" : "Expand to filter"}</span>
        </button>
        {filterOpen && (
          <div className="px-4 py-4 border-t border-[#EEF0F4] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <Field label="Department">
              <select className="h-9 px-2 border border-[#E8E8EE] rounded-[9px] bg-white text-[13px] w-full">
                <option>All departments</option>
                {departments.map((d) => <option key={d.id}>{d.name}</option>)}
              </select>
            </Field>
            <Field label="Status">
              <select className="h-9 px-2 border border-[#E8E8EE] rounded-[9px] bg-white text-[13px] w-full">
                <option>All</option>
                <option>Active</option>
                <option>Probation</option>
                <option>Inactive</option>
              </select>
            </Field>
            <Field label="Employment">
              <select className="h-9 px-2 border border-[#E8E8EE] rounded-[9px] bg-white text-[13px] w-full">
                <option>All types</option>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
              </select>
            </Field>
            <Field label="Present today">
              <select className="h-9 px-2 border border-[#E8E8EE] rounded-[9px] bg-white text-[13px] w-full">
                <option>Any</option>
                <option>Present</option>
                <option>Absent</option>
              </select>
            </Field>
          </div>
        )}
      </div>

      {/* Search row */}
      <div className="flex flex-wrap items-center gap-3 bg-white border border-[#E8E8EE] rounded-[14px] px-4 py-3 mb-3 shadow-[0_4px_12px_-4px_rgba(15,18,34,.08)]">
        <SearchIcon size={16} className="text-[var(--brand,#6D4AFF)] shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") runSearch(); }}
          placeholder="Search by name, ID, designation, phone…"
          className="flex-1 min-w-[200px] h-9 outline-none text-[14px] bg-transparent"
        />
        <button
          type="button"
          onClick={runSearch}
          className="h-9 px-4 rounded-[10px] bg-[var(--brand,#6D4AFF)] text-white text-[13px] font-[700] hover:bg-[var(--strong,#4F35CC)]"
        >
          Search
        </button>
        <div className="w-px h-5 bg-[#E8E8EE]" />
        <label className="inline-flex items-center gap-2 text-[12px] font-[700] text-[#5B5E72] cursor-pointer">
          <input
            type="checkbox"
            checked={staffList.length > 0 && selected.size === staffList.length}
            onChange={toggleSelectAll}
            className="accent-[var(--brand,#6D4AFF)]"
          />
          Select all
        </label>
        <button
          type="button"
          className="inline-flex items-center gap-1 h-8 px-3 rounded-[8px] bg-[#EEEAFF] text-[var(--brand,#6D4AFF)] text-[12px] font-[700]"
        >
          ↓ Export
        </button>
      </div>

      {/* All Staff card */}
      <div className="bg-white border border-[#E8E8EE] rounded-[14px] overflow-hidden shadow-[0_4px_12px_-4px_rgba(15,18,34,.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-[#EEF0F4]">
          <div>
            <strong className="block text-[14px] text-[#15172A]">All Staff</strong>
            <span className="text-[12px] text-[#64748B]">
              View opens a side hover panel. The table remains full width for large schools.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={collapseAll}
              className="h-8 px-3 rounded-[9px] border border-[#E8E8EE] bg-white text-[12.5px] font-[600] text-[#15172A] hover:border-[var(--brand,#6D4AFF)] hover:text-[var(--brand,#6D4AFF)]"
            >
              Collapse all
            </button>
            <button
              type="button"
              onClick={expandAll}
              className="h-8 px-3 rounded-[9px] border border-[#E8E8EE] bg-white text-[12.5px] font-[600] text-[#15172A] hover:border-[var(--brand,#6D4AFF)] hover:text-[var(--brand,#6D4AFF)]"
            >
              Expand all
            </button>
          </div>
        </div>

        <div className="p-3 bg-[#FAFAFB]">
          {(deptLoading || staffLoading) && (
            <div className="py-8 text-center text-[#64748B] text-[13px]">Loading staff…</div>
          )}
          {!deptLoading && !staffLoading && grouped.length === 0 && (
            <div className="py-8 text-center text-[#64748B] text-[13px]">
              No staff found{submittedSearch ? ` for "${submittedSearch}"` : ""}.
            </div>
          )}
          {grouped.map((g) => {
            const id = String(g.dept.id);
            const open = expandAllMode ? true : openDeptId === g.dept.id;
            return (
              <DepartmentAccordion
                key={id}
                dept={g.dept}
                staff={g.staff}
                open={open}
                onToggle={() => toggleDept(g.dept.id)}
                selected={selected}
                toggleSelect={toggleSelect}
                onView={setProfile}
              />
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-[#EEF0F4]">
          <span className="text-[12px] text-[#64748B]">
            Department accordions show staff as child table rows.
            {" "}
            <span className="text-[#94A3B8]">
              {totalStaff} staff · {totalActive} active · {totalPresent} present today
            </span>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={collapseAll}
              className="h-8 px-3 rounded-[9px] border border-[#E8E8EE] bg-white text-[12.5px] font-[600] text-[#15172A] hover:border-[var(--brand,#6D4AFF)] hover:text-[var(--brand,#6D4AFF)]"
            >
              Collapse all
            </button>
            <button
              type="button"
              className="h-8 px-3 rounded-[9px] border border-[#E8E8EE] bg-white text-[12.5px] font-[600] text-[#15172A] hover:border-[var(--brand,#6D4AFF)] hover:text-[var(--brand,#6D4AFF)]"
            >
              Export view
            </button>
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] flex items-center gap-2 bg-[#15172A] text-white rounded-full px-4 py-2 shadow-[0_18px_40px_-12px_rgba(15,23,42,.5)]">
          <span className="text-[12.5px] font-[700]">{selected.size} selected</span>
          <span className="w-px h-4 bg-white/20" />
          <BulkBtn>Deactivate</BulkBtn>
          <BulkBtn>Message</BulkBtn>
          <BulkBtn>Export</BulkBtn>
          <BulkBtn>Archive</BulkBtn>
          <button
            type="button"
            onClick={() => setSelected(new Set())}
            className="text-[12px] font-[700] text-white/70 hover:text-white px-2"
          >
            Clear
          </button>
        </div>
      )}

      <ProfileDrawer staff={profile} onClose={() => setProfile(null)} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[10.5px] font-[800] tracking-[0.1em] text-[#94A3B8] uppercase">{label}</span>
      {children}
    </label>
  );
}

function BulkBtn({ children }: { children: React.ReactNode }) {
  return (
    <button
      type="button"
      className="h-7 px-3 rounded-full bg-white/10 text-white text-[12px] font-[700] hover:bg-white/20"
    >
      {children}
    </button>
  );
}
