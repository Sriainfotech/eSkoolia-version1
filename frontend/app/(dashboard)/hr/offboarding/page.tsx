"use client";
/**
 * HR Offboarding — exit intake form (staff & exit details, handover/asset
 * checklist, financial clearance, documents to issue, approvals sign-off),
 * a Smart Filter panel, and the Ex-Staff Directory. Mirrors the Offboarding
 * model 1:1 (apps.hr.models.Offboarding) — see OffboardingSerializer
 * (fields = "__all__") and OffboardingViewSet's dedicated `complete` action.
 */
import { useEffect, useMemo, useState } from "react";
import { Download, Plus, Check, ChevronDown, ChevronRight, Search, Eye } from "lucide-react";
import {
  HrButton, HrBadge, HrKpiCard, HrField, HrInput, HrSelect,
  HrTextarea, HrHero, HrSkeleton, HrConfirmDialog, useHrToast,
} from "@/components/hr/HrUi";
import {
  useOffboarding, createOffboarding, updateOffboarding, completeOffboarding,
  useStaffList, useAllDepartments,
} from "@/hooks/useHrApi";
import type { OffboardingRecord, OffboardingChecklistItem } from "@/types/hr";

const EXIT_TYPES = ["Resignation", "Termination", "Retirement", "End of Contract", "Transfer", "Voluntary Exit"] as const;
const NOTICE_PERIOD_STATUSES = ["Served", "Bought Out", "Waived", "Partial"] as const;
const INTERVIEW_STATUSES = ["Pending", "Scheduled", "Conducted", "Waived"] as const;
const FF_STATUSES = ["Pending", "Processing", "Cleared"] as const;
const APPROVAL_STATUSES = ["Pending", "Approved", "Rejected"] as const;

const DEFAULT_HANDOVER_CHECKLIST = [
  "ID / Access Card returned", "Laptop / Tablet returned", "Physical keys returned", "Biometric deregistered",
  "Class / student handover done", "Knowledge transfer completed", "Library books returned", "Lab equipment returned",
  "ERP system access revoked", "School email access revoked", "Pending reports / grades submitted", "Transport duty handover",
];

const DEFAULT_DOCS_TO_ISSUE = [
  "Relieving letter issued", "Experience letter issued", "NOC / No objection issued",
  "Payslips (last 3 months) shared", "PF withdrawal form issued", "Service certificate issued",
];

function toChecklist(labels: string[]): OffboardingChecklistItem[] {
  return labels.map((label) => ({ label, done: false }));
}

function downloadCSV(rows: string[][], filename: string) {
  const csv = rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function emptyForm(): Partial<OffboardingRecord> {
  return {
    staff: undefined,
    exit_type: "",
    exit_reason: "",
    last_working_day: "",
    notice_period_status: "",
    notice_period_days: null,
    exit_interview_conducted: "Pending",
    exit_interview_notes: "",
    interview_date: null,
    primary_reason: "",
    handover_checklist: toChecklist(DEFAULT_HANDOVER_CHECKLIST),
    ff_status: "Pending",
    salary_dues_cleared: false,
    advance_loan: 0,
    gratuity_applicable: false,
    pf_esi_settlement: "Pending",
    docs_to_issue: toChecklist(DEFAULT_DOCS_TO_ISSUE),
    hod_approval: "Pending",
    principal_approval: "Pending",
    hr_signoff: "Pending",
    finance_clearance: "Pending",
    hr_notes: "",
  };
}

function formFromRecord(r: OffboardingRecord): Partial<OffboardingRecord> {
  return {
    staff: r.staff,
    exit_type: r.exit_type,
    exit_reason: r.exit_reason,
    last_working_day: r.last_working_day,
    notice_period_status: r.notice_period_status,
    notice_period_days: r.notice_period_days,
    exit_interview_conducted: r.exit_interview_conducted,
    exit_interview_notes: r.exit_interview_notes,
    interview_date: r.interview_date,
    primary_reason: r.primary_reason,
    handover_checklist: r.handover_checklist?.length ? r.handover_checklist : toChecklist(DEFAULT_HANDOVER_CHECKLIST),
    ff_status: r.ff_status,
    salary_dues_cleared: r.salary_dues_cleared,
    advance_loan: r.advance_loan,
    gratuity_applicable: r.gratuity_applicable,
    pf_esi_settlement: r.pf_esi_settlement,
    docs_to_issue: r.docs_to_issue?.length ? r.docs_to_issue : toChecklist(DEFAULT_DOCS_TO_ISSUE),
    hod_approval: r.hod_approval,
    principal_approval: r.principal_approval,
    hr_signoff: r.hr_signoff,
    finance_clearance: r.finance_clearance,
    hr_notes: r.hr_notes,
  };
}

// ─── Checklist grid — shared by the handover checklist and documents-to-issue,
// both stored as OffboardingChecklistItem[] JSON so custom items can be added ──
const CHECKLIST_GRID_COLS: Record<2 | 3 | 4, string> = {
  2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4",
};

function ChecklistGrid({
  items, onChange, columns = 2,
}: {
  items: OffboardingChecklistItem[];
  onChange: (items: OffboardingChecklistItem[]) => void;
  columns?: 2 | 3 | 4;
}) {
  const [newLabel, setNewLabel] = useState("");

  const toggle = (idx: number) => onChange(items.map((it, i) => (i === idx ? { ...it, done: !it.done } : it)));
  const addItem = () => {
    const label = newLabel.trim();
    if (!label) return;
    onChange([...items, { label, done: false }]);
    setNewLabel("");
  };
  const doneCount = items.filter((i) => i.done).length;

  return (
    <div>
      <div className={`grid gap-2 ${CHECKLIST_GRID_COLS[columns]}`}>
        {items.map((item, idx) => (
          <label
            key={`${item.label}-${idx}`}
            className="flex items-center gap-2 cursor-pointer p-[8px_10px] rounded-[8px] border border-[var(--line)] hover:bg-[#fafafa] transition-colors"
          >
            <input type="checkbox" className="w-4 h-4 accent-[var(--brand)]" checked={item.done} onChange={() => toggle(idx)} />
            <span className="text-[12px]">{item.label}</span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addItem(); } }}
          placeholder="Add a checklist item…"
          className="flex-1 max-w-[260px] h-[32px] px-3 border border-[var(--line)] rounded-[8px] text-[12px] outline-none focus:border-[var(--brand)]"
        />
        <button type="button" onClick={addItem} className="text-[12px] font-[750] text-[var(--brand)]">+ Add checklist item</button>
      </div>
      <div className="mt-2 text-[11.5px] text-[var(--muted)]">{doneCount} / {items.length} completed</div>
    </div>
  );
}

// ─── Initiate / Edit Offboarding form ────────────────────────────────────────
function OffboardingForm({
  open, onToggleOpen, editing, onSaved, onCancelEdit,
}: {
  open: boolean;
  onToggleOpen: () => void;
  editing: OffboardingRecord | null;
  onSaved: () => void;
  onCancelEdit: () => void;
}) {
  const { toast } = useHrToast();
  const { data: staffData, loading: staffLoading } = useStaffList();
  const staffOptions = useMemo(() => staffData?.results ?? [], [staffData]);
  const [form, setForm] = useState<Partial<OffboardingRecord>>(emptyForm());
  const [saving, setSaving] = useState<"draft" | "complete" | null>(null);

  useEffect(() => {
    setForm(editing ? formFromRecord(editing) : emptyForm());
  }, [editing]);

  const set = <K extends keyof OffboardingRecord>(k: K, v: Partial<OffboardingRecord>[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const selectedStaff = staffOptions.find((s) => s.id === form.staff);

  const resetAndClose = () => {
    onCancelEdit();
    setForm(emptyForm());
  };

  const handleSave = async (complete: boolean) => {
    if (!form.staff) { toast("Select a staff member", "error"); return; }
    if (!form.last_working_day) { toast("Last working day is required", "error"); return; }
    if (!form.exit_type) { toast("Exit type is required", "error"); return; }

    setSaving(complete ? "complete" : "draft");
    try {
      const payload: Partial<OffboardingRecord> = {
        ...form,
        interview_date: form.interview_date || null,
        notice_period_days: form.notice_period_days ?? null,
      };
      const saved = editing
        ? await updateOffboarding(editing.id, payload)
        : await createOffboarding(payload);
      if (complete) {
        await completeOffboarding(saved.id);
        toast("Offboarding marked complete");
      } else {
        toast(editing ? "Draft updated" : "Draft saved");
      }
      onSaved();
      resetAndClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save exit record", "error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="bg-white border border-[var(--line)] rounded-[14px] overflow-hidden mb-4" style={{ boxShadow: "var(--shadow)" }}>
      <button
        onClick={onToggleOpen}
        className="w-full flex items-center gap-3 p-[16px_20px] text-left"
        style={{ background: open ? "linear-gradient(to right, #fff, #fbfaff)" : "#fafafa" }}
      >
        <span className="w-9 h-9 rounded-[10px] bg-[var(--soft)] text-[var(--brand)] flex items-center justify-center text-[16px] flex-none">📋</span>
        <span className="flex-1">
          <div className="font-[850] text-[15px]">{editing ? "Edit Offboarding Record" : "Initiate Offboarding"}</div>
          <div className="text-[12px] text-[var(--muted)]">
            {editing ? `Updating exit record for ${editing.staff_name}` : "Complete the exit checklist for a departing staff member"}
          </div>
        </span>
        {open ? <ChevronDown size={16} className="text-[var(--muted)]" /> : <ChevronRight size={16} className="text-[var(--muted)]" />}
      </button>

      {open && (
        <div className="p-[24px_28px] grid gap-6 border-t border-[var(--line)]">
          <section>
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Staff & Exit Details</div>
            <div className="grid grid-cols-3 gap-4">
              <HrField label="Select Staff Member" required>
                <HrSelect
                  value={form.staff ?? ""}
                  onChange={(e) => set("staff", e.target.value ? Number(e.target.value) : undefined)}
                  disabled={staffLoading || !!editing}
                >
                  <option value="">-- Choose staff --</option>
                  {staffOptions.map((s) => (
                    <option key={s.id} value={s.id}>{s.full_name || `${s.first_name} ${s.last_name}`.trim()}</option>
                  ))}
                </HrSelect>
              </HrField>
              <HrField label="Staff ID">
                <HrInput value={selectedStaff?.staff_no ?? ""} placeholder="Auto-filled" disabled />
              </HrField>
              <HrField label="Department">
                <HrInput value={selectedStaff?.department_name ?? ""} placeholder="Auto-filled" disabled />
              </HrField>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <HrField label="Designation">
                <HrInput value={selectedStaff?.designation_name ?? ""} placeholder="Auto-filled" disabled />
              </HrField>
              <HrField label="Joining Date">
                <HrInput value={selectedStaff?.joining_date ?? ""} placeholder="Auto-filled" disabled />
              </HrField>
              <HrField label="Last Working Day" required>
                <HrInput type="date" value={form.last_working_day ?? ""} onChange={(e) => set("last_working_day", e.target.value)} />
              </HrField>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <HrField label="Exit Type" required>
                <HrSelect value={form.exit_type ?? ""} onChange={(e) => set("exit_type", e.target.value as OffboardingRecord["exit_type"])}>
                  <option value="">Select exit type</option>
                  {EXIT_TYPES.map((t) => <option key={t}>{t}</option>)}
                </HrSelect>
              </HrField>
              <HrField label="Notice Period Status">
                <HrSelect
                  value={form.notice_period_status ?? ""}
                  onChange={(e) => set("notice_period_status", e.target.value as OffboardingRecord["notice_period_status"])}
                >
                  <option value="">Select status</option>
                  {NOTICE_PERIOD_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </HrSelect>
              </HrField>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <HrField label="Exit Interview Conducted">
                <HrSelect
                  value={form.exit_interview_conducted ?? "Pending"}
                  onChange={(e) => set("exit_interview_conducted", e.target.value as OffboardingRecord["exit_interview_conducted"])}
                >
                  {INTERVIEW_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </HrSelect>
              </HrField>
              <HrField label="Interview Date">
                <HrInput type="date" value={form.interview_date ?? ""} onChange={(e) => set("interview_date", e.target.value)} />
              </HrField>
            </div>
            <div className="mt-4">
              <HrField label="Primary Reason For Leaving">
                <HrTextarea
                  rows={3}
                  value={form.primary_reason ?? ""}
                  onChange={(e) => set("primary_reason", e.target.value)}
                  placeholder="Brief reason shared by staff or as noted by HR…"
                />
              </HrField>
            </div>
          </section>

          <section>
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Handover & Asset Return Checklist</div>
            <ChecklistGrid items={form.handover_checklist ?? []} onChange={(items) => set("handover_checklist", items)} columns={4} />
          </section>

          <section>
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Financial Clearance</div>
            <div className="grid grid-cols-3 gap-4">
              <HrField label="F&F Settlement Status">
                <HrSelect value={form.ff_status ?? "Pending"} onChange={(e) => set("ff_status", e.target.value as OffboardingRecord["ff_status"])}>
                  {FF_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </HrSelect>
              </HrField>
              <HrField label="Salary Dues Cleared">
                <HrSelect value={form.salary_dues_cleared ? "yes" : "no"} onChange={(e) => set("salary_dues_cleared", e.target.value === "yes")}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </HrSelect>
              </HrField>
              <HrField label="Advance / Loan Outstanding">
                <HrInput
                  type="number" min={0} step="0.01"
                  value={form.advance_loan ?? 0}
                  onChange={(e) => set("advance_loan", Number(e.target.value))}
                  placeholder="e.g. Rs.0 or Rs.12,000"
                />
              </HrField>
            </div>
            <div className="grid grid-cols-3 gap-4 mt-4">
              <HrField label="Gratuity Applicable">
                <HrSelect value={form.gratuity_applicable ? "yes" : "no"} onChange={(e) => set("gratuity_applicable", e.target.value === "yes")}>
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </HrSelect>
              </HrField>
              <HrField label="PF / ESI Settlement">
                <HrSelect
                  value={form.pf_esi_settlement ?? "Pending"}
                  onChange={(e) => set("pf_esi_settlement", e.target.value as OffboardingRecord["pf_esi_settlement"])}
                >
                  {APPROVAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </HrSelect>
              </HrField>
            </div>
          </section>

          <section>
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Documents to Issue</div>
            <ChecklistGrid items={form.docs_to_issue ?? []} onChange={(items) => set("docs_to_issue", items)} columns={3} />
          </section>

          <section>
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Approvals & Sign-off</div>
            <div className="grid grid-cols-4 gap-4">
              <HrField label="HOD / Dept Head">
                <HrSelect value={form.hod_approval ?? "Pending"} onChange={(e) => set("hod_approval", e.target.value as OffboardingRecord["hod_approval"])}>
                  {APPROVAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </HrSelect>
              </HrField>
              <HrField label="Principal Approval">
                <HrSelect
                  value={form.principal_approval ?? "Pending"}
                  onChange={(e) => set("principal_approval", e.target.value as OffboardingRecord["principal_approval"])}
                >
                  {APPROVAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </HrSelect>
              </HrField>
              <HrField label="HR Sign-off">
                <HrSelect value={form.hr_signoff ?? "Pending"} onChange={(e) => set("hr_signoff", e.target.value as OffboardingRecord["hr_signoff"])}>
                  {APPROVAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </HrSelect>
              </HrField>
              <HrField label="Finance Clearance">
                <HrSelect
                  value={form.finance_clearance ?? "Pending"}
                  onChange={(e) => set("finance_clearance", e.target.value as OffboardingRecord["finance_clearance"])}
                >
                  {APPROVAL_STATUSES.map((s) => <option key={s}>{s}</option>)}
                </HrSelect>
              </HrField>
            </div>
            <div className="mt-4">
              <HrField label="HR Notes / Additional Remarks">
                <HrTextarea
                  rows={3}
                  value={form.hr_notes ?? ""}
                  onChange={(e) => set("hr_notes", e.target.value)}
                  placeholder="Any special conditions, disputes, or remarks for records…"
                />
              </HrField>
            </div>
          </section>

          <div className="flex justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
            {editing && <HrButton variant="ghost" onClick={resetAndClose}>Cancel Edit</HrButton>}
            <HrButton variant="ghost" onClick={() => void handleSave(false)} loading={saving === "draft"}>Save Draft</HrButton>
            <HrButton variant="primary" onClick={() => void handleSave(true)} loading={saving === "complete"}>
              <Check size={14} /> Complete Offboarding
            </HrButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Smart Filter ────────────────────────────────────────────────────────────
interface DirectoryFilters { department: string; exitType: string; from: string; to: string; search: string }
const EMPTY_FILTERS: DirectoryFilters = { department: "", exitType: "", from: "", to: "", search: "" };

function SmartFilterPanel({
  departments, filters, onChange,
}: {
  departments: { id: number; name: string }[];
  filters: DirectoryFilters;
  onChange: (next: DirectoryFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const set = (k: keyof DirectoryFilters, v: string) => onChange({ ...filters, [k]: v });
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="bg-white border border-[var(--line)] rounded-[14px] overflow-hidden mb-4" style={{ boxShadow: "var(--shadow)" }}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center gap-3 p-[14px_18px] text-left">
        <span className="w-9 h-9 rounded-[10px] bg-[var(--soft)] text-[var(--brand)] flex items-center justify-center text-[15px] flex-none">⚖️</span>
        <span className="flex-1">
          <div className="font-[800] text-[14px]">Smart Filter{activeCount > 0 ? ` (${activeCount})` : ""}</div>
          <div className="text-[11.5px] text-[var(--muted)]">Filter ex-staff by department, exit type or date range</div>
        </span>
        {open ? <ChevronDown size={16} className="text-[var(--muted)]" /> : <ChevronRight size={16} className="text-[var(--muted)]" />}
      </button>
      {open && (
        <div className="p-[16px_18px] border-t border-[var(--line)] grid gap-3">
          <div className="grid grid-cols-4 gap-3">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={filters.search}
                onChange={(e) => set("search", e.target.value)}
                placeholder="Search staff…"
                className="w-full pl-8 pr-3 py-[9px] border border-[var(--line)] rounded-[8px] text-[13px] outline-none focus:border-[var(--brand)]"
              />
            </div>
            <HrSelect value={filters.department} onChange={(e) => set("department", e.target.value)}>
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </HrSelect>
            <HrSelect value={filters.exitType} onChange={(e) => set("exitType", e.target.value)}>
              <option value="">All Exit Types</option>
              {EXIT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </HrSelect>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="date" value={filters.from} onChange={(e) => set("from", e.target.value)}
                className="w-full px-2 py-[9px] border border-[var(--line)] rounded-[8px] text-[12px] outline-none focus:border-[var(--brand)]"
              />
              <input
                type="date" value={filters.to} onChange={(e) => set("to", e.target.value)}
                className="w-full px-2 py-[9px] border border-[var(--line)] rounded-[8px] text-[12px] outline-none focus:border-[var(--brand)]"
              />
            </div>
          </div>
          {activeCount > 0 && (
            <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="text-[12px] text-[var(--brand)] font-[750] text-left">
              Clear all filters
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Ex-Staff Directory ───────────────────────────────────────────────────────
function ExStaffDirectory({
  records, loading, onEdit, onComplete,
}: {
  records: OffboardingRecord[];
  loading: boolean;
  onEdit: (r: OffboardingRecord) => void;
  onComplete: (r: OffboardingRecord) => void;
}) {
  if (loading) return <HrSkeleton rows={4} />;
  if (records.length === 0) {
    return (
      <div className="bg-white border border-[var(--line)] rounded-[14px] py-14 text-center text-[var(--muted)]">
        No offboarding records yet.
      </div>
    );
  }
  return (
    <div className="bg-white border border-[var(--line)] rounded-[14px] overflow-hidden overflow-x-auto" style={{ boxShadow: "var(--shadow)" }}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="bg-[#fafafa] text-[11px] uppercase text-[#64748b] tracking-[0.08em]">
            <th className="px-4 py-3 text-left">Staff</th>
            <th className="px-4 py-3 text-left">Staff ID</th>
            <th className="px-4 py-3 text-left">Department</th>
            <th className="px-4 py-3 text-left">Designation</th>
            <th className="px-4 py-3 text-left">Status</th>
            <th className="px-4 py-3 text-left">Reason / Note</th>
            <th className="px-4 py-3 text-left">Actions</th>
          </tr>
        </thead>
        <tbody>
          {records.map((r) => (
            <tr key={r.id} className="border-t border-[#f4f4f8] hover:bg-[#fafafd] transition-colors align-top">
              <td className="px-4 py-3 font-[750] text-[13px]">{r.staff_name}</td>
              <td className="px-4 py-3 text-[12px] text-[var(--muted)]">{r.staff_id}</td>
              <td className="px-4 py-3 text-[12px]">{r.department || "—"}</td>
              <td className="px-4 py-3 text-[12px]">{r.designation || "—"}</td>
              <td className="px-4 py-3">
                <HrBadge variant={r.status === "completed" ? "green" : r.status === "in_progress" ? "blue" : "amber"}>
                  {r.status === "in_progress" ? "In Progress" : r.status === "completed" ? "Completed" : "Initiated"}
                </HrBadge>
              </td>
              <td className="px-4 py-3 text-[12px] text-[var(--muted)] max-w-[220px] truncate" title={r.primary_reason}>
                {r.primary_reason || "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <HrButton variant="icon" size="icon" onClick={() => onEdit(r)} title="View / Edit">
                    <Eye size={14} />
                  </HrButton>
                  {r.status !== "completed" && (
                    <HrButton variant="green" size="sm" onClick={() => onComplete(r)}>
                      <Check size={12} /> Complete
                    </HrButton>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Offboarding Page ────────────────────────────────────────────────────
export default function HrOffboardingPage() {
  const { data, loading, refetch } = useOffboarding({});
  const { data: deptData } = useAllDepartments();
  const { toast } = useHrToast();

  const [formOpen, setFormOpen] = useState(true);
  const [editing, setEditing] = useState<OffboardingRecord | null>(null);
  const [completing, setCompleting] = useState<OffboardingRecord | null>(null);
  const [completingLoading, setCompletingLoading] = useState(false);
  const [filters, setFilters] = useState<DirectoryFilters>(EMPTY_FILTERS);
  const [directoryOpen, setDirectoryOpen] = useState(true);

  const records = useMemo(() => data?.results ?? [], [data]);
  const departments = useMemo(() => (deptData?.results ?? []).map((d) => ({ id: d.id, name: d.name })), [deptData]);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (filters.department) {
        const deptName = departments.find((d) => String(d.id) === filters.department)?.name;
        if (!deptName || r.department !== deptName) return false;
      }
      if (filters.exitType && r.exit_type !== filters.exitType) return false;
      if (filters.from && (!r.last_working_day || r.last_working_day < filters.from)) return false;
      if (filters.to && (!r.last_working_day || r.last_working_day > filters.to)) return false;
      if (filters.search) {
        const q = filters.search.toLowerCase();
        if (!r.staff_name.toLowerCase().includes(q) && !r.staff_id.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [records, filters, departments]);

  const now = new Date();
  const pendingClearance = records.filter((r) => r.status !== "completed").length;
  const completedThisMonth = records.filter((r) => {
    if (r.status !== "completed" || !r.completed_at) return false;
    const d = new Date(r.completed_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
  const exStaffTotal = records.filter((r) => r.status === "completed").length;
  const noticeValues = records.map((r) => r.notice_period_days).filter((n): n is number => n != null);
  const avgNotice = noticeValues.length ? Math.round(noticeValues.reduce((a, b) => a + b, 0) / noticeValues.length) : 30;

  const handleEdit = (r: OffboardingRecord) => {
    setEditing(r);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleInitiateExit = () => {
    setEditing(null);
    setFormOpen(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleComplete = async () => {
    if (!completing) return;
    setCompletingLoading(true);
    try {
      await completeOffboarding(completing.id);
      toast("Offboarding marked complete");
      void refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setCompletingLoading(false);
      setCompleting(null);
    }
  };

  const handleExport = () => {
    const rows = [
      ["Staff", "Staff ID", "Department", "Designation", "Exit Type", "Last Working Day", "Status", "Reason"],
      ...filteredRecords.map((r) => [
        r.staff_name, r.staff_id, r.department, r.designation, r.exit_type, r.last_working_day, r.status, r.primary_reason || "",
      ]),
    ];
    downloadCSV(rows, `offboarding-records-${new Date().toISOString().slice(0, 10)}.csv`);
  };

  return (
    <div>
      <HrHero
        eyebrow="HR Operations"
        title="Staff"
        accent="Offboarding"
        sub="Manage exits, clearance checklists, and maintain an ex-staff directory."
        actions={
          <>
            <HrButton variant="ghost" onClick={handleExport}>
              <Download size={14} /> Export Records
            </HrButton>
            <HrButton variant="primary" onClick={handleInitiateExit}>
              <Plus size={14} /> Initiate Exit
            </HrButton>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-5">
        <HrKpiCard label="Pending Clearance" value={pendingClearance} sub="Awaiting F&F settlement" color="var(--amber)" />
        <HrKpiCard label="Completed This Month" value={completedThisMonth} sub="Full exits processed" color="var(--green)" />
        <HrKpiCard label="Ex-Staff Total" value={exStaffTotal} sub="Inactive & offboarded" />
        <HrKpiCard label="Avg Notice Served" value={avgNotice} sub="Days (school standard 30d)" />
      </div>

      <OffboardingForm
        open={formOpen}
        onToggleOpen={() => setFormOpen((o) => !o)}
        editing={editing}
        onSaved={() => void refetch()}
        onCancelEdit={() => setEditing(null)}
      />

      <SmartFilterPanel departments={departments} filters={filters} onChange={setFilters} />

      <button onClick={() => setDirectoryOpen((o) => !o)} className="w-full flex items-center gap-3 p-[6px_2px] mb-3 text-left">
        <span className="w-9 h-9 rounded-[10px] bg-[var(--soft)] text-[var(--brand)] flex items-center justify-center text-[15px] flex-none">👥</span>
        <span className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-[16px] font-[800] m-0" style={{ fontFamily: "var(--serif)" }}>Ex-Staff Directory</h2>
            {directoryOpen ? <ChevronDown size={15} className="text-[var(--muted)]" /> : <ChevronRight size={15} className="text-[var(--muted)]" />}
          </div>
          <div className="text-[11.5px] text-[var(--muted)]">{filteredRecords.length} ex-staff records</div>
        </span>
      </button>
      {directoryOpen && (
        <ExStaffDirectory records={filteredRecords} loading={loading} onEdit={handleEdit} onComplete={(r) => setCompleting(r)} />
      )}

      <HrConfirmDialog
        isOpen={!!completing}
        onClose={() => setCompleting(null)}
        onConfirm={() => void handleComplete()}
        title="Mark Offboarding Complete"
        message="This will finalize the exit process for this staff member."
        confirmLabel="Complete"
        loading={completingLoading}
      />
    </div>
  );
}
