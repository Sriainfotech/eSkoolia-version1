"use client";
import { useState } from "react";
import { Plus, Upload, ChevronDown, X, GripVertical } from "lucide-react";
import {
  HrBadge, HrKpiCard, HrModal, HrField,
  HrInput, HrSelect, HrTextarea, HrStepWizard, HrConfirmDialog,
  HrSkeleton, useHrToast, HrDropdown,
} from "@/components/hr/HrUi";
import {
  useDepartments, useAllDepartments, useHierarchyDepts, useDesignations, useDepartmentTypes, useStaffList,
  createDepartment, updateDepartment,
  deleteDepartment, createDesignation, updateDesignation, deleteDesignation,
  reorderDesignations,
  createDepartmentType,
} from "@/hooks/useHrApi";
import type { Department, Designation } from "@/types/hr";

const WIZARD_STEPS = [
  { label: "Departments", hint: "Add independently" },
  { label: "Designations", hint: "Add independently" },
  { label: "Review", hint: "Confirm HR structure" },
];

const PREDEFINED_DEPT_TYPES = ["Academic", "Administrative", "Support", "Transport", "Finance"] as const;
const DEPT_TYPE_REGEX = /^[A-Za-z &-]+$/;

function isCustomDeptType(val: string | undefined): boolean {
  return !!val && !(PREDEFINED_DEPT_TYPES as readonly string[]).includes(val);
}

const WORKING_DAYS     = ["Monday - Friday", "Monday - Saturday", "All 7 days"] as const;
const STATUS_OPTS      = ["Active", "Inactive", "Archived"] as const;
const EMPLOYMENT_TYPES = ["Full-time", "Part-time", "Contract", "Visiting Guest"] as const;
const ROLE_TEMPLATES   = ["Teacher", "Admin", "Support", "Finance", "Transport", "Library"] as const;
const REPORTS_TO       = ["None", "HOD", "Principal", "Vice Principal"] as const;

const emptyDept  = (): Partial<Department>  => ({ name: "", short_code: "", dept_type: "Academic", status: "active", working_days: "Mon-Fri", email: "", description: "" });
const emptyDesig = (): Partial<Designation> => ({ name: "", short_code: "", department: undefined, is_active: true, reports_to: "None", employment_type: "Full-time", role_template: "Teacher", grade_level: "" });

// ─── Inline Department Form ───────────────────────────────────────────────────
function InlineDeptForm({ initial, onSaved, onCancel, stepLabel = "STEP 1 OF 2" }: {
  initial?: Partial<Department>;
  onSaved: (addAnother?: boolean) => void;
  onCancel: () => void;
  stepLabel?: string;
}) {
  const { toast } = useHrToast();
  const [form, setForm] = useState<Partial<Department>>(initial ?? emptyDept());
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const set = (k: keyof Department, v: string) => setForm((f) => ({ ...f, [k]: v }));

  // fetch dept types from API
  const { data: typesData, refetch: refetchTypes } = useDepartmentTypes();
  const allTypes = typesData?.data ?? [];

  // fetch staff for head / deputy_head dropdowns
  const { data: staffData } = useStaffList();
  const staffList = staffData?.results ?? [];

  // custom dept type popup state
  const [addTypeOpen, setAddTypeOpen] = useState(false);
  const [addTypeInput, setAddTypeInput] = useState("");
  const [addTypeInputError, setAddTypeInputError] = useState("");
  const [addTypeSaving, setAddTypeSaving] = useState(false);

  const openAddTypePopup = () => {
    setAddTypeInput(isCustomDeptType(form.dept_type) ? (form.dept_type ?? "") : "");
    setAddTypeInputError("");
    setAddTypeOpen(true);
  };

  const handleAddTypeConfirm = async () => {
    const val = addTypeInput.trim();
    if (!val) { setAddTypeInputError("Type name is required"); return; }
    if (!DEPT_TYPE_REGEX.test(val)) { setAddTypeInputError("Only letters, spaces, & and hyphens allowed"); return; }
    if (allTypes.some((t) => t.name.toLowerCase() === val.toLowerCase())) {
      setAddTypeInputError(`"${val}" already exists — select it from the dropdown`); return;
    }
    setAddTypeSaving(true);
    try {
      const created = await createDepartmentType(val);
      setForm((f) => ({ ...f, dept_type: created.name }));
      setErrors((e) => ({ ...e, dept_type: "" }));
      await refetchTypes();
      setAddTypeOpen(false);
    } catch (err) {
      setAddTypeInputError(err instanceof Error ? err.message : "Failed to create type");
    } finally {
      setAddTypeSaving(false);
    }
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = "Required";
    if (!form.short_code?.trim()) e.short_code = "Required";
    if (form.short_code && form.short_code.length > 6) e.short_code = "Max 6 chars";
    setErrors(e);
    return Object.keys(e).length === 0;
  };
  const handleSave = async (addAnother?: boolean) => {
    if (!validate()) return;
    setSaving(true);
    try {
      if (initial?.id) await updateDepartment(initial.id, form);
      else await createDepartment(form);
      toast("Department saved");
      if (addAnother) { setForm(emptyDept()); onSaved(true); }
      else onSaved();
    } catch (err) { toast(err instanceof Error ? err.message : "Failed to save department", "error"); }
    finally { setSaving(false); }
  };
  const isEdit = !!initial?.id;
  return (
    <div className="bg-white border border-[#E8E8F0] rounded-[14px] overflow-hidden mb-5"
      style={{ boxShadow: "0 2px 8px -2px rgba(15,18,34,0.07)" }}>
      <div className="flex items-center justify-between px-7 pt-6 pb-1">
        <span className="text-[11px] font-[800] tracking-[0.1em] text-[var(--brand)]">{stepLabel}</span>
        <div className="flex items-center gap-3">
          {!isEdit && <span className="text-[11px] text-[#94A3B8] font-[600]">Independent step</span>}
          <button onClick={onCancel} title="Close"
            className="w-7 h-7 flex items-center justify-center rounded-full text-[#94A3B8] hover:text-[#15172A] hover:bg-[#F1F5F9] transition-colors">
            <X size={14} />
          </button>
        </div>
      </div>
      <div className="px-7 pb-2">
        <div className="text-[22px] font-[900] text-[#15172A]">
          {isEdit ? `Edit: ${initial?.name}` : "Add Departments"}
        </div>
        <p className="text-[13px] text-[#5B5E72] mt-1">
          Departments form your school&apos;s top-level hierarchy. Add at least one before mapping designations.
        </p>
      </div>
      <div className="px-7 pb-7 grid gap-5 mt-2">
        <div>
          <div className="text-[10.5px] font-[900] tracking-[0.12em] text-[#94A3B8] uppercase mb-3">Identity</div>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <HrField label="Department Name" required error={errors.name}>
              <HrInput value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Science Department" />
            </HrField>
            <HrField label="Short Code" required error={errors.short_code}>
              <HrInput value={form.short_code ?? ""} maxLength={6}
                onChange={(e) => set("short_code", e.target.value.toUpperCase())} placeholder="E.G. SCI" />
            </HrField>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <HrField label="Department Type" error={errors.dept_type}>
              <div className="flex gap-2 items-center">
                <div className="flex-1">
                  <HrSelect value={form.dept_type ?? ""} onChange={(e) => { set("dept_type", e.target.value); setErrors((er) => ({ ...er, dept_type: "" })); }}>
                    <option value="">Select type…</option>
                    {allTypes.map((t) => <option key={t.name} value={t.name}>{t.name}</option>)}
                  </HrSelect>
                </div>
                <button
                  type="button"
                  onClick={openAddTypePopup}
                  title="Add custom type"
                  className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-[#E8E8F0] text-[var(--brand)] hover:bg-[var(--brand)] hover:text-white transition-colors text-[18px] font-bold leading-none"
                >
                  +
                </button>
              </div>
            </HrField>
            <HrField label="Status">
              <HrSelect value={form.status} onChange={(e) => set("status", e.target.value)}>
                {STATUS_OPTS.map((s) => <option key={s} value={s.toLowerCase()}>{s}</option>)}
              </HrSelect>
            </HrField>
            <HrField label="Working Days">
              <HrSelect value={form.working_days} onChange={(e) => set("working_days", e.target.value)}>
                {WORKING_DAYS.map((w) => <option key={w}>{w}</option>)}
              </HrSelect>
            </HrField>
          </div>
        </div>
        <div>
          <div className="text-[10.5px] font-[900] tracking-[0.12em] text-[#94A3B8] uppercase mb-3">Leadership</div>
          <div className="grid grid-cols-2 gap-4">
            <HrField label="Department Head">
              <HrSelect
                value={form.head_id != null ? String(form.head_id) : ""}
                onChange={(e) => setForm((f) => ({ ...f, head_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Select staff (optional)</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.full_name ?? `${s.first_name} ${s.last_name}`.trim()) || s.staff_no}
                  </option>
                ))}
              </HrSelect>
            </HrField>
            <HrField label="Deputy Head">
              <HrSelect
                value={form.deputy_head_id != null ? String(form.deputy_head_id) : ""}
                onChange={(e) => setForm((f) => ({ ...f, deputy_head_id: e.target.value ? Number(e.target.value) : null }))}
              >
                <option value="">Select staff (optional)</option>
                {staffList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {(s.full_name ?? `${s.first_name} ${s.last_name}`.trim()) || s.staff_no}
                  </option>
                ))}
              </HrSelect>
            </HrField>
          </div>
        </div>
        <div>
          <div className="text-[10.5px] font-[900] tracking-[0.12em] text-[#94A3B8] uppercase mb-3">Contact & Notes</div>
          <div className="grid grid-cols-2 gap-4">
            <HrField label="Department Email">
              <HrInput value={form.email ?? ""} onChange={(e) => set("email", e.target.value)}
                type="email" placeholder="e.g. science@school.edu" />
            </HrField>
            <HrField label="Description">
              <HrTextarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)}
                placeholder="Purpose, staff scope, reporting lines, responsibilities" />
            </HrField>
          </div>
        </div>
        <div className="flex items-center justify-between pt-4 border-t border-[#F1F5F9]">
          {!isEdit && (
            <button onClick={() => void handleSave(true)} disabled={saving}
              className="text-[13px] font-[600] text-[var(--brand)] hover:underline disabled:opacity-50">
              Save & add another
            </button>
          )}
          <div className="flex gap-3 ml-auto">
            <button onClick={onCancel} className="text-[13px] font-[600] text-[#64748b] hover:text-[#15172A]">Cancel</button>
            <button onClick={() => void handleSave()} disabled={saving}
              className="px-5 py-2 rounded-lg text-[13px] font-[700] text-white disabled:opacity-60"
              style={{ background: "var(--brand)" }}>
              {saving ? "Saving..." : isEdit ? "Save Changes" : "Save Department"}
            </button>
          </div>
        </div>
      </div>
      {/* Add custom dept type popup */}
      <HrModal isOpen={addTypeOpen} onClose={() => setAddTypeOpen(false)} title="Add Department Type" size="sm">
        <div className="px-6 py-5">
          <p className="text-[13px] text-[#5B5E72] mb-4">Enter a custom department type not listed in the dropdown.</p>
          <HrField label="Type Name" error={addTypeInputError}>
            <HrInput
              value={addTypeInput}
              maxLength={50}
              placeholder="e.g. Research & Development"
              autoFocus
              onChange={(e) => { setAddTypeInput(e.target.value.slice(0, 50)); setAddTypeInputError(""); }}
              onKeyDown={(e) => { if (e.key === "Enter") void handleAddTypeConfirm(); }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-[11px] text-[#94A3B8]">Letters, spaces, &amp; and hyphens only</span>
              <span className="text-[11px] text-[#94A3B8]">{addTypeInput.length}/50</span>
            </div>
          </HrField>
          <div className="flex gap-3 justify-end mt-5">
            <button onClick={() => setAddTypeOpen(false)} disabled={addTypeSaving} className="text-[13px] font-[600] text-[#64748b] hover:text-[#15172A] disabled:opacity-50">Cancel</button>
            <button
              onClick={() => void handleAddTypeConfirm()}
              disabled={addTypeSaving}
              className="px-4 py-2 rounded-lg text-[13px] font-[700] text-white disabled:opacity-60"
              style={{ background: "var(--brand)" }}
            >
              {addTypeSaving ? "Saving…" : "Add Type"}
            </button>
          </div>
        </div>
      </HrModal>
    </div>
  );
}

// ─── Department Card ──────────────────────────────────────────────────────────
function DeptCard({ dept, designationCount, onEdit, onDelete }: {
  dept: Department;
  designationCount: number;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="bg-white border border-[#E8E8F0] rounded-[12px] overflow-hidden"
      style={{ boxShadow: "0 1px 4px -1px rgba(15,18,34,0.06)" }}>
      <div className="flex items-center gap-3 px-5 py-4 cursor-pointer"
        style={{ borderLeft: "4px solid var(--brand)" }}
        onClick={() => setExpanded((v) => !v)}>
        <span className="text-[#94A3B8]">
          <ChevronDown size={15} style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 250ms ease" }} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="font-[850] text-[14.5px] text-[#15172A]">{dept.name}</div>
          <div className="flex gap-2 flex-wrap mt-1 items-center">
            <span className="text-[11.5px] text-[#64748b]">Department parent</span>
            <span className="text-[#CBD5E1] text-[10px]">|</span>
            <span className="text-[11.5px] text-[var(--brand)] font-[600]">{designationCount} designations</span>
            {dept.dept_type && (
              <>
                <span className="text-[#CBD5E1] text-[10px]">|</span>
                <span className="text-[11.5px] text-[#64748b]">{dept.dept_type}</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0" onClick={(e) => e.stopPropagation()}>
          <span className="text-[12.5px] font-[700] text-[#22C55E]">
            {dept.staff_count ? `${dept.staff_count} staff` : "-- staff"}
          </span>
          <button onClick={onEdit}
            className="text-[13px] font-[600] text-[#475569] hover:text-[#15172A] px-2 py-1 rounded hover:bg-[#f1f5f9]">
            Edit
          </button>
          <button onClick={onDelete}
            className="text-[13px] font-[600] text-[#E0463A] hover:text-[#be3028] px-2 py-1 rounded hover:bg-[#fff5f5]">
            Delete
          </button>
        </div>
      </div>
      {expanded && (
        <div className="grid grid-cols-3 divide-x divide-[#F1F5F9] border-t border-[#F1F5F9] bg-[#FAFAFA]">
          {[
            { value: dept.staff_count ?? "--", label: "Assigned staff" },
            { value: designationCount || "--", label: "Designation levels" },
            { value: dept.attendance_pct != null ? `${dept.attendance_pct}%` : "--%", label: "Attendance today" },
          ].map(({ value, label }) => (
            <div key={label} className="px-6 py-4">
              <div className="text-[22px] font-[800] text-[#15172A] leading-none">{value}</div>
              <div className="text-[11.5px] text-[#64748b] mt-1">{label}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Inline Designation Form ──────────────────────────────────────────────────
function InlineDesigForm({ initial, defaultDeptId, departments, onSaved, onCancel, stepLabel = "STEP 2 OF 2" }: {
  initial?: Partial<Designation>;
  defaultDeptId?: number;
  departments: Department[];
  onSaved: (addAnother?: boolean) => void;
  onCancel?: () => void;
  stepLabel?: string;
}) {
  const { toast } = useHrToast();
  const initForm = (): Partial<Designation> => ({
    ...emptyDesig(),
    ...(defaultDeptId ? { department: defaultDeptId } : {}),
    ...initial,
  });
  const [form, setForm] = useState<Partial<Designation>>(initForm);
  const [saving, setSaving] = useState(false);
  const set = (k: keyof Designation, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async (addAnother?: boolean) => {
    if (!form.name?.trim() || !form.department) {
      toast("Department and designation title are required", "error");
      return;
    }
    setSaving(true);
    try {
      if (initial?.id) await updateDesignation(initial.id, form);
      else await createDesignation(form);
      toast(initial?.id ? "Designation updated" : "Designation saved");
      onSaved(addAnother);
      if (addAnother) setForm({ ...emptyDesig(), department: form.department });
    } catch (err: unknown) {
      toast(err instanceof Error ? err.message : "Failed to save designation", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mb-5 bg-white border border-[#E8E8F0] rounded-[14px] p-[28px]"
      style={{ boxShadow: "0 2px 8px -2px rgba(15,18,34,0.07)" }}>
      <div className="text-[10px] font-[800] tracking-[0.12em] text-[#94A3B8] uppercase mb-1">{stepLabel}</div>
      <h2 className="text-[22px] font-[900] text-[#15172A] m-0 leading-tight mb-1">
        {initial?.id ? "Edit Designation" : "Add Designations"}
      </h2>
      <p className="text-[13px] text-[#5B5E72] m-0 mb-5">
        Define roles within each department. Each designation becomes a child node in the hierarchy.
      </p>

      {/* IDENTITY */}
      <div className="text-[10px] font-[800] tracking-[0.14em] text-[#94A3B8] uppercase mb-3 pb-1 border-b border-[#f1f5f9]">
        Identity
      </div>
      <div className="grid grid-cols-[2fr_2fr_1fr_1fr] gap-4 mb-5">
        <HrField label="Department" required>
          <HrDropdown
            value={form.department ?? ""}
            onChange={(val) => set("department", val ? Number(val) : undefined)}
            placeholder="Select department..."
            options={departments.map((d) => ({ value: d.id, label: d.name }))}
          />
        </HrField>
        <HrField label="Designation Title" required>
          <HrInput value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Senior Teacher" />
        </HrField>
        <HrField label="Short Code">
          <HrInput value={form.short_code ?? ""} maxLength={10}
            onChange={(e) => set("short_code", e.target.value.toUpperCase())} placeholder="e.g. SNR-TCH" />
        </HrField>
        <HrField label="Status">
          <HrSelect value={form.is_active ? "active" : "inactive"}
            onChange={(e) => set("is_active", e.target.value === "active")}>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </HrSelect>
        </HrField>
      </div>

      <p className="text-[12px] text-[#94A3B8] m-0 mb-4">
        Designation becomes a child node under the selected department in your org hierarchy.
      </p>
      <div className="flex items-center justify-between border-t border-[#f1f5f9] pt-4">
        <button onClick={() => void handleSave(true)} disabled={saving}
          className="text-[13px] font-[600] text-[var(--brand)] hover:underline disabled:opacity-50">
          Save &amp; add another
        </button>
        <div className="flex gap-3">
          {onCancel && (
            <button onClick={onCancel}
              className="px-4 py-2 rounded-lg text-[13px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]">
              Cancel
            </button>
          )}
          <button onClick={() => void handleSave()} disabled={saving}
            className="px-5 py-2 rounded-lg text-[13px] font-[700] text-white disabled:opacity-60"
            style={{ background: "var(--brand)" }}>
            {saving ? "Saving..." : initial?.id ? "Update" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Designation Dept Accordion Card ─────────────────────────────────────────
function DesignationDeptCard({ dept, deptDesigs, onAddChild, onEdit, onDelete, onReorder }: {
  dept: Department;
  deptDesigs: Designation[];
  onAddChild: () => void;
  onEdit: (d: Designation) => void;
  onDelete: (id: number) => void;
  onReorder: (items: { id: number; sort_order: number }[]) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(false);
  const [reordering, setReordering] = useState(false);

  const doReorder = async (fromIdx: number, toIdx: number) => {
    if (reordering) return;
    setReordering(true);
    try {
      const normalized = deptDesigs.map((d, i) => ({ id: d.id, sort_order: i }));
      const tmp = normalized[fromIdx].sort_order;
      normalized[fromIdx].sort_order = normalized[toIdx].sort_order;
      normalized[toIdx].sort_order = tmp;
      await onReorder(normalized);
    } finally {
      setReordering(false);
    }
  };

  return (
    <div className="bg-white border border-[#E8E8F0] rounded-[14px] overflow-hidden"
      style={{ boxShadow: "0 1px 4px -1px rgba(15,18,34,0.06)" }}>
      {/* Department header */}
      <div className="flex items-center justify-between px-5 py-4 cursor-pointer select-none"
        style={{ borderLeft: "3px solid var(--brand)" }}
        onClick={() => setExpanded((e) => !e)}>
        <div className="flex items-center gap-3 flex-wrap">
          <div>
            <div className="font-[800] text-[15px] text-[#15172A]">{dept.name}</div>
            <div className="text-[11px] text-[#94A3B8]">Parent department</div>
          </div>
          <HrBadge variant="purple">
            {deptDesigs.length} child designation{deptDesigs.length !== 1 ? "s" : ""}
          </HrBadge>
          <HrBadge variant={dept.status === "active" ? "green" : "grey"}>
            {dept.status ?? "active"}
          </HrBadge>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={(e) => { e.stopPropagation(); onAddChild(); }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-[700] text-white"
            style={{ background: "var(--brand)" }}>
            <Plus size={12} /> Add child
          </button>
          <ChevronDown
            size={16}
            className="text-[#94A3B8] transition-transform duration-300"
            style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)" }}
          />
        </div>
      </div>

      {/* Designations list — animated accordion via CSS grid rows */}
      <div
        style={{
          display: "grid",
          gridTemplateRows: expanded ? "1fr" : "0fr",
          transition: "grid-template-rows 280ms ease",
        }}
      >
        <div style={{ overflow: "hidden" }}>
          <div className="border-t border-[#f1f5f9]"
            style={{ opacity: expanded ? 1 : 0, transition: "opacity 200ms ease" }}>
            {deptDesigs.length === 0 ? (
              <div className="px-5 py-6 text-center text-[13px] text-[#94A3B8]">
                No designations yet.{" "}
                <button onClick={onAddChild} className="text-[var(--brand)] font-[600] hover:underline">
                  Add the first one
                </button>
              </div>
            ) : (
              deptDesigs.map((d, idx) => (
                <div key={d.id}
                  className="flex items-center gap-3 px-5 py-3 border-b border-[#f8f8fc] last:border-b-0 hover:bg-[#fafafd]">
                  <GripVertical size={15} className="text-[#CBD5E1] flex-shrink-0" />
                  <span className="text-[12px] font-[700] text-[#94A3B8] w-5 text-center flex-shrink-0">{idx + 1}</span>
                  <span className="font-[750] text-[14px] text-[#15172A] flex-1 min-w-0 truncate">{d.name}</span>
                  <div className="flex items-center gap-2 flex-wrap">
                    <HrBadge variant="purple">{dept.name}</HrBadge>
                    {d.role_template && <HrBadge variant="purple">Role: {d.role_template}</HrBadge>}
                    <HrBadge variant={d.is_active ? "green" : "grey"}>{d.is_active ? "Active" : "Inactive"}</HrBadge>
                  </div>
                  <div className="flex flex-col gap-0 flex-shrink-0">
                    <button disabled={idx === 0 || reordering} onClick={() => void doReorder(idx, idx - 1)}
                      className="w-6 h-5 flex items-center justify-center text-[#94A3B8] hover:text-[#475569] disabled:opacity-30 disabled:cursor-not-allowed text-[11px] font-bold">
                      ↑
                    </button>
                    <button disabled={idx === deptDesigs.length - 1 || reordering} onClick={() => void doReorder(idx, idx + 1)}
                      className="w-6 h-5 flex items-center justify-center text-[#94A3B8] hover:text-[#475569] disabled:opacity-30 disabled:cursor-not-allowed text-[11px] font-bold">
                      ↓
                    </button>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button onClick={() => onEdit(d)} className="text-[12px] font-[600] text-[#475569] hover:text-[#15172A]">Edit</button>
                    <button onClick={() => onDelete(d.id)} className="text-[12px] font-[600] text-[#E0463A]">Delete</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


// ─── Main Page ────────────────────────────────────────────────────────────────
export default function HrSetupPage() {
  const [step, setStep] = useState(1);
  const [deptPage, setDeptPage] = useState(1);
  const [desigDeptPage, setDesigDeptPage] = useState(1);
  const { data: deptData, loading: deptLoading, refetch: refetchDepts } = useDepartments(deptPage);
  const { data: allDeptData, refetch: refetchAllDepts } = useAllDepartments();
  const { data: hierDeptData, loading: hierDeptLoading, refetch: refetchHierDepts } = useHierarchyDepts(desigDeptPage);
  const { data: desigData, loading: desigLoading, refetch: refetchDesigs } = useDesignations();
  const { toast } = useHrToast();
  const departments    = deptData?.results ?? [];
  const allDepartments = allDeptData?.results ?? [];
  const hierDepts      = hierDeptData?.results ?? [];
  const designations   = desigData?.results ?? [];

  const [showAddForm, setShowAddForm]   = useState(false);
  const [editDept, setEditDept]         = useState<Department | null>(null);
  const [deleteDeptId, setDeleteDeptId] = useState<number | null>(null);
  const [deletingDept, setDeletingDept] = useState(false);

  const [editDesig, setEditDesig]         = useState<Designation | null>(null);
  const [desigDefaultDept, setDesigDefaultDept] = useState<number | undefined>(undefined);
  const [deleteDesigId, setDeleteDesigId] = useState<number | null>(null);
  const [deletingDesig, setDeletingDesig] = useState(false);

  const handleDeleteDept = async () => {
    if (!deleteDeptId) return;
    setDeletingDept(true);
    try {
      await deleteDepartment(deleteDeptId);
      toast("Department deleted");
      void refetchDepts(); void refetchAllDepts(); void refetchHierDepts();
      if (departments.length === 1 && deptPage > 1) setDeptPage((p) => p - 1);
    } catch { toast("Failed to delete", "error"); }
    finally { setDeletingDept(false); setDeleteDeptId(null); }
  };

  const handleDeleteDesig = async () => {
    if (!deleteDesigId) return;
    setDeletingDesig(true);
    try {
      await deleteDesignation(deleteDesigId);
      toast("Designation deleted");
      void refetchDesigs();
      void refetchHierDepts();
    } catch { toast("Failed to delete", "error"); }
    finally { setDeletingDesig(false); setDeleteDesigId(null); }
  };

  const handleReorderDesigs = async (items: { id: number; sort_order: number }[]) => {
    try {
      await reorderDesignations(items);
      void refetchDesigs();
    } catch { toast("Failed to reorder", "error"); }
  };

  const desigCountForDept = (deptId: number) =>
    designations.filter((d) => d.department === deptId).length;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-5">
        <div>
          <div className="text-[11px] font-[700] tracking-[0.1em] text-[#94A3B8] uppercase mb-0.5">HR configuration</div>
          <h1 className="text-[26px] font-[900] text-[#15172A] m-0 leading-tight">
            Staff <em className="not-italic font-[400]" style={{ fontFamily: "var(--serif)", color: "var(--brand)" }}>setup</em>
          </h1>
          <p className="text-[13px] text-[#5B5E72] mt-1 m-0">Define your organisation structure — departments and designations.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => toast("Import from CSV — available in full build", "info")}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]">
            <Upload size={13} /> Import
          </button>
          <button onClick={() => { setShowAddForm(true); setEditDept(null); }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-[13px] font-[700] text-white"
            style={{ background: "var(--brand)" }}>
            <Plus size={13} /> Add Department
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <HrKpiCard label="Departments"    value={deptData?.count  ?? "--"} />
        <HrKpiCard label="Designations"   value={desigData?.count ?? "--"} />
        <HrKpiCard label="Staff Assigned" value="--" />
        <HrKpiCard label="Missing Role"   value="--" color="var(--red)" />
      </div>

      {/* Step wizard */}
      <div className="mb-5">
        <HrStepWizard steps={WIZARD_STEPS} currentStep={step} onStepClick={setStep} />
      </div>

      {/* ── Step 1: Departments ── */}
      {step === 1 && (
        <div>
          {showAddForm && !editDept && (
            <InlineDeptForm
              onSaved={(a) => { void refetchDepts(); void refetchAllDepts(); if (!a) setShowAddForm(false); }}
              onCancel={() => setShowAddForm(false)}
            />
          )}
          {editDept && (
            <InlineDeptForm
              initial={editDept}
              stepLabel="EDIT DEPARTMENT"
              onSaved={() => { void refetchDepts(); void refetchAllDepts(); setEditDept(null); }}
              onCancel={() => setEditDept(null)}
            />
          )}
          {deptLoading ? (
            <HrSkeleton />
          ) : departments.length === 0 ? (
            <div className="text-center py-16 text-[var(--muted)] bg-white rounded-[14px] border border-[#E8E8F0]">
              No departments yet. Click &quot;+ Add Department&quot; to get started.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {departments.map((dept) => (
                <DeptCard
                  key={dept.id}
                  dept={dept}
                  designationCount={desigCountForDept(dept.id)}
                  onEdit={() => { setEditDept(dept); setShowAddForm(false); }}
                  onDelete={() => setDeleteDeptId(dept.id)}
                />
              ))}
            </div>
          )}
          {/* Pagination */}
          {(deptData?.count ?? 0) > 10 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <span className="text-[12.5px] text-[#64748b]">
                Showing {(deptPage - 1) * 10 + 1}–{Math.min(deptPage * 10, deptData?.count ?? 0)} of {deptData?.count ?? 0}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={!deptData?.previous}
                  onClick={() => setDeptPage((p) => p - 1)}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Prev
                </button>
                <span className="text-[12.5px] text-[#64748b]">
                  Page {deptPage} of {Math.ceil((deptData?.count ?? 0) / 10)}
                </span>
                <button
                  disabled={!deptData?.next}
                  onClick={() => setDeptPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg text-[13px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Next →
                </button>
              </div>
            </div>
          )}
          <div className="flex justify-end mt-5">
            <button onClick={() => setStep(2)}
              className="px-5 py-2 rounded-lg text-[13px] font-[700] text-white"
              style={{ background: "var(--brand)" }}>
              Go to Designations
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Designations ── */}
      {step === 2 && (
        <div>
          {/* Inline form — always visible; key resets state on edit/dept switch */}
          <InlineDesigForm
            key={editDesig ? `edit-${editDesig.id}` : `add-${desigDefaultDept ?? 0}`}
            initial={editDesig ?? undefined}
            defaultDeptId={desigDefaultDept}
            departments={allDepartments}
            onSaved={(addAnother) => {
              void refetchDesigs();
              void refetchHierDepts();
              setDesigDeptPage(1);
              if (!addAnother) { setEditDesig(null); setDesigDefaultDept(undefined); }
            }}
            onCancel={editDesig ? () => { setEditDesig(null); setDesigDefaultDept(undefined); } : undefined}
          />

          {/* Hierarchy section header */}
          {(hierDeptLoading || desigLoading || (hierDeptData?.count ?? 0) > 0) && (
            <div className="text-[11px] font-[800] tracking-[0.1em] text-[#94A3B8] uppercase mb-3">
              Designations Added
            </div>
          )}

          {hierDeptLoading || desigLoading ? (
            <HrSkeleton />
          ) : (
            <>
              <div className="flex flex-col gap-3">
                {hierDepts.map((dept) => {
                  const deptDesigs = designations
                    .filter((d) => d.department === dept.id)
                    .sort((a, b) => a.sort_order - b.sort_order);
                  return (
                    <DesignationDeptCard
                      key={dept.id}
                      dept={dept}
                      deptDesigs={deptDesigs}
                      onAddChild={() => { setEditDesig(null); setDesigDefaultDept(dept.id); }}
                      onEdit={(d) => { setEditDesig(d); setDesigDefaultDept(undefined); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                      onDelete={(id) => setDeleteDesigId(id)}
                      onReorder={handleReorderDesigs}
                    />
                  );
                })}
              </div>

              {/* Hierarchy pagination */}
              {(hierDeptData?.count ?? 0) > 5 && (
                <div className="flex items-center justify-between mt-4 px-1">
                  <span className="text-[12.5px] text-[#64748b]">
                    Showing {(desigDeptPage - 1) * 5 + 1}–{Math.min(desigDeptPage * 5, hierDeptData?.count ?? 0)} of {hierDeptData?.count ?? 0} departments
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      disabled={!hierDeptData?.previous}
                      onClick={() => setDesigDeptPage((p) => p - 1)}
                      className="px-3 py-1 rounded-md text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed"
                    >← Prev</button>
                    <span className="text-[12.5px] text-[#64748b] tabular-nums">
                      Page {desigDeptPage} of {Math.ceil((hierDeptData?.count ?? 0) / 5)}
                    </span>
                    <button
                      disabled={!hierDeptData?.next}
                      onClick={() => setDesigDeptPage((p) => p + 1)}
                      className="px-3 py-1 rounded-md text-[12.5px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed"
                    >Next →</button>
                  </div>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between mt-6">
            <button onClick={() => setStep(1)} className="text-[13px] font-[600] text-[#475569] hover:text-[#15172A]">← Departments</button>
            <button onClick={() => setStep(3)} className="px-5 py-2 rounded-lg text-[13px] font-[700] text-white"
              style={{ background: "var(--brand)" }}>Finish Setup →</button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review ── */}
      {step === 3 && (
        <div className="bg-white border border-[#E8E8F0] rounded-[14px] p-[48px_28px] text-center"
          style={{ boxShadow: "0 2px 8px -2px rgba(15,18,34,0.07)" }}>
          <div className="text-[52px] mb-4">✅</div>
          <h2 className="m-0 text-[26px] font-[800] text-[#15172A]">
            HR Structure <em className="not-italic" style={{ fontFamily: "var(--serif)", color: "var(--brand)" }}>Configured</em>
          </h2>
          <p className="text-[var(--muted)] mt-3 mb-6">
            {departments.length} departments and {designations.length} designations set up.
          </p>
          <div className="flex justify-center gap-3">
            <button onClick={() => setStep(1)}
              className="px-5 py-2 rounded-lg text-[13px] font-[600] border border-[#E2E8F0] text-[#475569] bg-white hover:bg-[#f8fafc]">
              Edit Setup
            </button>
            <button onClick={() => { window.location.href = "/hr/onboard"; }}
              className="px-5 py-2 rounded-lg text-[13px] font-[700] text-white" style={{ background: "var(--brand)" }}>
              Start Onboarding
            </button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <HrConfirmDialog
        isOpen={!!deleteDeptId} onClose={() => setDeleteDeptId(null)}
        onConfirm={() => void handleDeleteDept()}
        title="Delete Department" message="Staff assigned to it will be unlinked."
        confirmLabel="Yes, Delete" danger loading={deletingDept} />

      <HrConfirmDialog
        isOpen={!!deleteDesigId} onClose={() => setDeleteDesigId(null)}
        onConfirm={() => void handleDeleteDesig()}
        title="Delete Designation" message="Staff with this designation will be unlinked."
        confirmLabel="Yes, Delete" danger loading={deletingDesig} />
    </div>
  );
}
