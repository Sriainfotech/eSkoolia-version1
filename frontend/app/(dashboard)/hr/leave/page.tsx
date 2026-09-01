"use client";
/**
 * HR Leave Management — Applications (list + approve/reject) and Coverage
 * (month calendar of who's out) tabs, plus Configure Policy / Apply on
 * Behalf actions. Approval routes through a per-designation L1/L2 chain
 * (Configure Policy > Approval Chain); L2 only applies once a request's
 * duration reaches that policy's l2_trigger_days.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Check, X, Eye, ChevronLeft, ChevronRight } from "lucide-react";
import {
  HrButton, HrBadge, HrKpiCard, HrModal, HrField,
  HrInput, HrSelect, HrTextarea, HrStepWizard, HrHero, HrDrawer,
  HrSkeleton, HrConfirmDialog, useHrToast,
} from "@/components/hr/HrUi";
import {
  useLeaveTypes, createLeaveType, updateLeaveType,
  useLeaveApplications, updateLeaveStatus, applyOnBehalf,
  useLeaveStats, useLeaveCoverageMonth, useLeaveCoverageDay,
  useApprovalChainPolicies, saveApprovalChainPolicy,
  useStaffList,
} from "@/hooks/useHrApi";
import type { LeaveType, LeaveApplication, ApproverRole } from "@/types/hr";

const LEAVE_WIZARD_STEPS = [
  { label: "Leave Types",        hint: "Define categories" },
  { label: "Entitlement Matrix", hint: "Days per role" },
  { label: "Approval Chain",    hint: "Who approves" },
];

const LEAVE_UNITS = ["Days", "Hours"] as const;
const ENTITLEMENT_ROLES = ["Teacher", "Admin", "Support", "Finance", "All Roles"] as const;
const APPROVERS = ["HOD", "Principal", "Vice Principal", "HR Admin"] as const;

function leaveTypeAbbrev(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "—";
  if (words.length === 1) return words[0].slice(0, 3).toUpperCase();
  return words.map((w) => w[0]).join("").toUpperCase();
}

// ─── Leave Type Form ──────────────────────────────────────────────────────────
function LeaveTypeModal({
  isOpen, onClose, initial, onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  initial?: Partial<LeaveType>;
  onSaved: () => void;
}) {
  const { toast } = useHrToast();
  const [form, setForm] = useState<Partial<LeaveType>>(
    initial ?? { name: "", code: "", unit: "Days", max_days: 14, is_paid: true, carry_forward: false, description: "" }
  );
  const [saving, setSaving] = useState(false);

  const set = (k: keyof LeaveType, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.name?.trim() || !form.code?.trim()) {
      toast("Name and code are required", "error"); return;
    }
    setSaving(true);
    try {
      if (initial?.id) await updateLeaveType(initial.id, form);
      else await createLeaveType(form);
      toast("Leave type saved");
      onSaved(); onClose();
    } catch { toast("Failed to save", "error"); }
    finally { setSaving(false); }
  };

  return (
    <HrModal isOpen={isOpen} onClose={onClose} title={initial?.id ? "Edit Leave Type" : "Add Leave Type"} size="md">
      <div className="p-[20px] grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <HrField label="Leave Name" required>
            <HrInput value={form.name ?? ""} onChange={(e) => set("name", e.target.value)} placeholder="Annual Leave" />
          </HrField>
          <HrField label="Code" required>
            <HrInput
              value={form.code ?? ""} maxLength={8}
              onChange={(e) => set("code", e.target.value.toUpperCase())}
              placeholder="ANNUAL"
            />
          </HrField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <HrField label="Unit">
            <HrSelect value={form.unit ?? "Days"} onChange={(e) => set("unit", e.target.value)}>
              {LEAVE_UNITS.map((u) => <option key={u}>{u}</option>)}
            </HrSelect>
          </HrField>
          <HrField label="Max Days/Year">
            <HrInput
              type="number" min={1}
              value={form.max_days ?? ""}
              onChange={(e) => set("max_days", Number(e.target.value))}
            />
          </HrField>
          <HrField label="Status">
            <HrSelect value={form.status ?? "active"} onChange={(e) => set("status", e.target.value)}>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </HrSelect>
          </HrField>
        </div>
        <div className="flex gap-5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-[var(--brand)]"
              checked={!!form.is_paid} onChange={(e) => set("is_paid", e.target.checked)} />
            <span className="text-[13px]">Paid Leave</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-[var(--brand)]"
              checked={!!form.carry_forward} onChange={(e) => set("carry_forward", e.target.checked)} />
            <span className="text-[13px]">Carry Forward</span>
          </label>
        </div>
        <HrField label="Description">
          <HrTextarea value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} />
        </HrField>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
          <HrButton variant="ghost" onClick={onClose}>Cancel</HrButton>
          <HrButton variant="primary" onClick={() => void handleSave()} loading={saving}>Save</HrButton>
        </div>
      </div>
    </HrModal>
  );
}

// ─── Setup Wizard (relocated behind "Configure Policy") ───────────────────────
function LeaveSetupWizard() {
  const { toast } = useHrToast();
  const [wizardStep, setWizardStep] = useState(1);
  const { data, loading, refetch } = useLeaveTypes();
  const leaveTypes = data?.results ?? [];
  const [addOpen, setAddOpen] = useState(false);
  const [editType, setEditType] = useState<LeaveType | null>(null);

  // Entitlement matrix local state
  const [matrix, setMatrix] = useState<{ role: string; leave_type: string; days: number }[]>([]);
  const [matrixRow, setMatrixRow] = useState({ role: "All Roles", leave_type: "", days: 14 });

  // Approval chain — the "All Staff" default policy (designation = null).
  const { data: policyData, loading: policyLoading, refetch: refetchPolicies } = useApprovalChainPolicies();
  const allStaffPolicy = (policyData?.results ?? []).find((p) => p.designation === null) ?? null;
  const [chainDraft, setChainDraft] = useState<{
    l1_approver_role: ApproverRole; l2_approver_role: ApproverRole; l2_trigger_days: number; response_window_days: number;
  }>({ l1_approver_role: "HOD", l2_approver_role: "", l2_trigger_days: 3, response_window_days: 2 });
  const [chainSaving, setChainSaving] = useState(false);
  const [chainLoaded, setChainLoaded] = useState(false);
  useEffect(() => {
    if (allStaffPolicy && !chainLoaded) {
      setChainDraft({
        l1_approver_role: allStaffPolicy.l1_approver_role,
        l2_approver_role: allStaffPolicy.l2_approver_role,
        l2_trigger_days: allStaffPolicy.l2_trigger_days,
        response_window_days: allStaffPolicy.response_window_days,
      });
      setChainLoaded(true);
    }
  }, [allStaffPolicy, chainLoaded]);

  const publishPolicy = async () => {
    setChainSaving(true);
    try {
      await saveApprovalChainPolicy(allStaffPolicy?.id ?? null, { designation: null, ...chainDraft });
      toast("Approval chain policy published");
      void refetchPolicies();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to publish policy", "error");
    } finally {
      setChainSaving(false);
    }
  };

  return (
    <div>
      <div className="mb-5">
        <HrStepWizard steps={LEAVE_WIZARD_STEPS} currentStep={wizardStep} onStepClick={setWizardStep} />
      </div>

      {wizardStep === 1 && (
        <div className="bg-white border border-[var(--line)] rounded-[14px] p-[24px_28px]" style={{ boxShadow: "var(--shadow)" }}>
          <div className="flex justify-between items-center mb-4">
            <h2 className="m-0 text-[20px] font-[800]" style={{ fontFamily: "var(--serif)" }}>Leave Types</h2>
            <HrButton variant="primary" onClick={() => setAddOpen(true)}>
              <Plus size={14} /> Add Leave Type
            </HrButton>
          </div>
          {loading ? <HrSkeleton /> : leaveTypes.length === 0 ? (
            <div className="py-10 text-center text-[var(--muted)]">No leave types yet.</div>
          ) : (
            <div className="grid gap-3">
              {leaveTypes.map((lt) => (
                <div key={lt.id} className="flex items-center gap-3 border border-[var(--line)] rounded-[10px] px-4 py-3">
                  <div className="flex-1">
                    <div className="font-[750]">{lt.name}</div>
                    <div className="flex gap-2 mt-1">
                      <HrBadge variant="purple">{lt.code}</HrBadge>
                      <HrBadge variant={lt.is_paid ? "green" : "grey"}>{lt.is_paid ? "Paid" : "Unpaid"}</HrBadge>
                      <HrBadge variant="grey">{lt.max_days} days/year</HrBadge>
                      {lt.carry_forward && <HrBadge variant="blue">Carry Forward</HrBadge>}
                    </div>
                  </div>
                  <HrButton variant="icon" size="icon" onClick={() => setEditType(lt)}><Edit2 size={13} /></HrButton>
                </div>
              ))}
            </div>
          )}
          <div className="flex justify-end mt-4">
            <HrButton variant="primary" onClick={() => setWizardStep(2)}>Entitlement Matrix →</HrButton>
          </div>
        </div>
      )}

      {wizardStep === 2 && (
        <div className="bg-white border border-[var(--line)] rounded-[14px] p-[24px_28px]" style={{ boxShadow: "var(--shadow)" }}>
          <h2 className="m-0 mb-5 text-[20px] font-[800]" style={{ fontFamily: "var(--serif)" }}>Entitlement Matrix</h2>
          <div className="flex gap-3 mb-4">
            <HrSelect value={matrixRow.role} onChange={(e) => setMatrixRow((r) => ({ ...r, role: e.target.value }))}>
              {ENTITLEMENT_ROLES.map((r) => <option key={r}>{r}</option>)}
            </HrSelect>
            <HrSelect value={matrixRow.leave_type} onChange={(e) => setMatrixRow((r) => ({ ...r, leave_type: e.target.value }))}>
              <option value="">Leave Type…</option>
              {leaveTypes.map((lt) => <option key={lt.id} value={lt.code}>{lt.name}</option>)}
            </HrSelect>
            <HrInput
              type="number" min={1} value={matrixRow.days}
              onChange={(e) => setMatrixRow((r) => ({ ...r, days: Number(e.target.value) }))}
              className="w-[90px]"
            />
            <HrButton variant="primary" onClick={() => {
              if (!matrixRow.leave_type) return;
              setMatrix((m) => [...m, { ...matrixRow }]);
              setMatrixRow((r) => ({ ...r, leave_type: "" }));
            }}>
              <Plus size={14} /> Add
            </HrButton>
          </div>
          {matrix.length === 0 ? (
            <div className="py-8 text-center text-[var(--muted)] border border-dashed border-[var(--line)] rounded-[10px]">
              No entitlements added yet.
            </div>
          ) : (
            <table className="w-full border-collapse border border-[var(--line)] rounded-[10px] overflow-hidden">
              <thead>
                <tr className="bg-[#fafafa] text-[11px] uppercase text-[#64748b]">
                  <th className="px-3 py-2 text-left">Role</th>
                  <th className="px-3 py-2 text-left">Leave Type</th>
                  <th className="px-3 py-2 text-left">Days / Year</th>
                  <th className="px-3 py-2 text-left">Remove</th>
                </tr>
              </thead>
              <tbody>
                {matrix.map((row, i) => (
                  <tr key={i} className="border-t border-[#f4f4f8]">
                    <td className="px-3 py-2">{row.role}</td>
                    <td className="px-3 py-2">{row.leave_type}</td>
                    <td className="px-3 py-2">{row.days}</td>
                    <td className="px-3 py-2">
                      <HrButton variant="red" size="icon" onClick={() => setMatrix((m) => m.filter((_, j) => j !== i))}>
                        <X size={12} />
                      </HrButton>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex justify-between mt-4">
            <HrButton variant="ghost" onClick={() => setWizardStep(1)}>← Back</HrButton>
            <HrButton variant="primary" onClick={() => setWizardStep(3)}>Approval Chain →</HrButton>
          </div>
        </div>
      )}

      {wizardStep === 3 && (
        <div className="bg-white border border-[var(--line)] rounded-[14px] p-[24px_28px]" style={{ boxShadow: "var(--shadow)" }}>
          <h2 className="m-0 text-[20px] font-[800]" style={{ fontFamily: "var(--serif)" }}>Approval Chain of Command</h2>
          <p className="mt-1 mb-4 text-[13px] text-[var(--muted)]">
            Set who approves leave for each designation. L2 activates for long leaves or if L1 is unavailable.
          </p>
          {policyLoading ? <HrSkeleton rows={1} /> : (
            <table className="w-full border-collapse">
              <thead>
                <tr className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">
                  <th className="px-2 py-2 text-left">Designation</th>
                  <th className="px-2 py-2 text-left">L1 Approver</th>
                  <th className="px-2 py-2 text-left">L2 Approver</th>
                  <th className="px-2 py-2 text-left">L2 triggers after (days)</th>
                  <th className="px-2 py-2 text-left">Response window</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-t border-[var(--line)]">
                  <td className="px-2 py-3 font-[750]">All Staff</td>
                  <td className="px-2 py-3">
                    <HrSelect
                      value={chainDraft.l1_approver_role}
                      onChange={(e) => setChainDraft((d) => ({ ...d, l1_approver_role: e.target.value as ApproverRole }))}
                    >
                      {APPROVERS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </HrSelect>
                  </td>
                  <td className="px-2 py-3">
                    <HrSelect
                      value={chainDraft.l2_approver_role}
                      onChange={(e) => setChainDraft((d) => ({ ...d, l2_approver_role: e.target.value as ApproverRole }))}
                    >
                      <option value="">-</option>
                      {APPROVERS.map((a) => <option key={a} value={a}>{a}</option>)}
                    </HrSelect>
                  </td>
                  <td className="px-2 py-3">
                    <HrInput
                      type="number" min={0} className="w-[80px]"
                      value={chainDraft.l2_trigger_days}
                      onChange={(e) => setChainDraft((d) => ({ ...d, l2_trigger_days: Number(e.target.value) }))}
                    />
                  </td>
                  <td className="px-2 py-3">
                    <HrSelect
                      value={String(chainDraft.response_window_days)}
                      onChange={(e) => setChainDraft((d) => ({ ...d, response_window_days: Number(e.target.value) }))}
                    >
                      {[1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n} day{n > 1 ? "s" : ""}</option>)}
                    </HrSelect>
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <div className="mt-4 flex items-start gap-2 text-[12px] text-[var(--muted)] bg-[#fafafa] border border-[var(--line)] rounded-[10px] p-3">
            <span>ⓘ</span>
            <span><strong>Admin override:</strong> If both L1 and L2 approvers are unavailable, HR Admin can approve directly with a note. This is automatically logged.</span>
          </div>
          <div className="flex justify-between mt-5">
            <HrButton variant="ghost" onClick={() => setWizardStep(2)}>← Back</HrButton>
            <HrButton variant="primary" onClick={() => void publishPolicy()} loading={chainSaving}>
              <Check size={14} /> Publish Policy
            </HrButton>
          </div>
        </div>
      )}

      {/* Modals */}
      <LeaveTypeModal isOpen={addOpen} onClose={() => setAddOpen(false)} onSaved={() => void refetch()} />
      {editType && (
        <LeaveTypeModal
          isOpen={!!editType} onClose={() => setEditType(null)}
          initial={editType} onSaved={() => { void refetch(); setEditType(null); }}
        />
      )}
    </div>
  );
}

function ConfigurePolicyModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  return (
    <HrModal isOpen={isOpen} onClose={onClose} title="Configure Leave Policy" size="xl">
      <div className="p-[20px]">
        <LeaveSetupWizard />
      </div>
    </HrModal>
  );
}

// ─── Apply on Behalf ───────────────────────────────────────────────────────────
function ApplyOnBehalfModal({
  isOpen, onClose, onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useHrToast();
  const { data: staffData } = useStaffList();
  const { data: leaveTypeData } = useLeaveTypes();
  const staffOptions = useMemo(() => staffData?.results ?? [], [staffData]);
  const leaveTypes = leaveTypeData?.results ?? [];
  const roleOptions = useMemo(
    () => Array.from(new Set(staffOptions.map((s) => s.designation_name).filter(Boolean))),
    [staffOptions],
  );

  const [form, setForm] = useState({
    staff: "", leave_type: "", from_date: "", to_date: "", reason: "",
    half_day_type: "" as "" | "AM" | "PM",
    absence_type: "" as "" | "emergency" | "unplanned" | "retroactive",
    role: "",
    bypass_chain: false,
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const visibleStaff = form.role ? staffOptions.filter((s) => s.designation_name === form.role) : staffOptions;

  const handleSave = async () => {
    if (!form.staff || !form.leave_type || !form.from_date || !form.to_date) {
      toast("Staff, leave type, and dates are required", "error");
      return;
    }
    setSaving(true);
    try {
      await applyOnBehalf({
        staff: Number(form.staff),
        leave_type: Number(form.leave_type),
        from_date: form.from_date,
        to_date: form.to_date,
        reason: form.reason,
        half_day_type: form.half_day_type,
        absence_type: form.absence_type,
        bypass_chain: form.bypass_chain,
      });
      toast("Leave applied on behalf successfully");
      onSaved(); onClose();
      setForm({ staff: "", leave_type: "", from_date: "", to_date: "", reason: "", half_day_type: "", absence_type: "", role: "", bypass_chain: false });
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to apply leave", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <HrModal isOpen={isOpen} onClose={onClose} title="Apply Leave on Behalf" subtitle="For emergency, unplanned, or retroactive leave where staff cannot apply themselves." size="md">
      <div className="p-[20px] grid gap-4">
        <div className="grid grid-cols-2 gap-4">
          <HrField label="Staff Member" required>
            <HrSelect value={form.staff} onChange={(e) => set("staff", e.target.value)}>
              <option value="">Select…</option>
              {visibleStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || `${s.first_name} ${s.last_name}`.trim()}
                  {s.department_name ? ` — ${s.department_name}` : ""}
                </option>
              ))}
            </HrSelect>
          </HrField>
          <HrField label="Leave Type" required>
            <HrSelect value={form.leave_type} onChange={(e) => set("leave_type", e.target.value)}>
              <option value="">Select…</option>
              {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
            </HrSelect>
          </HrField>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <HrField label="Type of Absence">
            <HrSelect value={form.absence_type} onChange={(e) => set("absence_type", e.target.value as typeof form.absence_type)}>
              <option value="">—</option>
              <option value="emergency">Emergency</option>
              <option value="unplanned">Unplanned</option>
              <option value="retroactive">Retroactive</option>
            </HrSelect>
          </HrField>
          <HrField label="Role">
            <HrSelect value={form.role} onChange={(e) => set("role", e.target.value)}>
              <option value="">All Staff</option>
              {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
            </HrSelect>
          </HrField>
        </div>
        <div className="grid grid-cols-3 gap-4">
          <HrField label="From Date" required>
            <HrInput type="date" value={form.from_date} onChange={(e) => set("from_date", e.target.value)} />
          </HrField>
          <HrField label="To Date" required>
            <HrInput type="date" value={form.to_date} onChange={(e) => set("to_date", e.target.value)} />
          </HrField>
          <HrField label="Duration">
            <HrSelect value={form.half_day_type} onChange={(e) => set("half_day_type", e.target.value as typeof form.half_day_type)}>
              <option value="">Full day(s)</option>
              <option value="AM">Morning (AM)</option>
              <option value="PM">Afternoon (PM)</option>
            </HrSelect>
          </HrField>
        </div>
        <HrField label="Reason" required>
          <HrTextarea value={form.reason} onChange={(e) => set("reason", e.target.value)} placeholder="Reason for leave…" />
        </HrField>
        <label className="flex items-start gap-2 cursor-pointer bg-[#fafafa] border border-[var(--line)] rounded-[10px] p-3">
          <input
            type="checkbox" className="w-4 h-4 mt-[2px] accent-[var(--brand)]"
            checked={form.bypass_chain} onChange={(e) => set("bypass_chain", e.target.checked)}
          />
          <span className="text-[13px]">
            <strong>Admin approved — bypass approval chain.</strong>{" "}
            <span className="text-[var(--muted)]">Use only when the normal L1/L2 approvers are unavailable — approves immediately and is logged.</span>
          </span>
        </label>
        <div className="flex justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
          <HrButton variant="ghost" onClick={onClose}>Cancel</HrButton>
          <HrButton variant="primary" onClick={() => void handleSave()} loading={saving}>Submit Leave</HrButton>
        </div>
      </div>
    </HrModal>
  );
}

// ─── Approval Chain cell — one icon + approver name per chain step ───────────
function ApprovalChainCell({ app }: { app: LeaveApplication }) {
  if (app.approval_steps.length === 0) {
    // No chain to show (e.g. admin-bypass on-behalf approval) — fall back
    // to the overall outcome.
    if (app.status === "approved") {
      return (
        <div className="flex flex-col items-center gap-1">
          <span className="w-6 h-6 rounded-full bg-[var(--green)] text-white flex items-center justify-center"><Check size={12} /></span>
          <span className="text-[11px] text-[var(--muted)]">{app.approved_by_name || "—"}</span>
        </div>
      );
    }
    return <span className="text-[var(--muted)]">—</span>;
  }

  return (
    <div className="flex items-start gap-3">
      {app.approval_steps.map((step) => (
        <div key={step.sequence} className="flex flex-col items-center gap-1">
          {step.status === "approved" ? (
            <span className="w-6 h-6 rounded-full bg-[var(--green)] text-white flex items-center justify-center"><Check size={12} /></span>
          ) : step.status === "rejected" ? (
            <span className="w-6 h-6 rounded-full bg-[var(--red)] text-white flex items-center justify-center"><X size={12} /></span>
          ) : (
            <span className="w-6 h-6 rounded-full border-2 border-[var(--amber)]" />
          )}
          <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">{step.approver_name || step.role_label || "—"}</span>
        </div>
      ))}
    </div>
  );
}

function FlagsCell({ app }: { app: LeaveApplication }) {
  const flags: React.ReactNode[] = [];
  if (app.coverage_risk) flags.push(<HrBadge key="cov" variant="amber">Coverage risk</HrBadge>);
  if (app.is_on_behalf) flags.push(<HrBadge key="beh" variant="blue">By Admin</HrBadge>);
  if (app.half_day_type) flags.push(<HrBadge key="hd" variant="grey">{app.half_day_type}</HrBadge>);
  if (flags.length === 0) return <span className="text-[var(--muted)]">—</span>;
  return <div className="flex flex-wrap gap-1">{flags}</div>;
}

// ─── Applications tab ─────────────────────────────────────────────────────────
function ApplicationsTab() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data, loading, refetch } = useLeaveApplications({ status: statusFilter });
  const { toast } = useHrToast();
  const [acting, setActing] = useState<{ id: number; action: "approve" | "reject" } | null>(null);
  const [actLoading, setActLoading] = useState(false);
  const [viewing, setViewing] = useState<LeaveApplication | null>(null);

  const applications = data?.results ?? [];

  const handleAction = async () => {
    if (!acting) return;
    setActLoading(true);
    try {
      await updateLeaveStatus(acting.id, acting.action);
      toast(`Leave ${acting.action === "approve" ? "approved" : "rejected"}`);
      void refetch();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setActLoading(false); setActing(null);
    }
  };

  return (
    <div>
      <div className="flex gap-3 mb-4">
        <HrSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-[180px]">
          <option value="">All status</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </HrSelect>
      </div>

      {loading ? <HrSkeleton rows={5} /> : applications.length === 0 ? (
        <div className="bg-white border border-[var(--line)] rounded-[14px] py-14 text-center text-[var(--muted)]">
          No leave applications found.
        </div>
      ) : (
        <div className="bg-white border border-[var(--line)] rounded-[14px] overflow-hidden overflow-x-auto" style={{ boxShadow: "var(--shadow)" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#fafafa] text-[11px] uppercase text-[#64748b] tracking-[0.08em]">
                <th className="px-4 py-3 text-left">Staff</th>
                <th className="px-4 py-3 text-left">Type</th>
                <th className="px-4 py-3 text-left">Dates</th>
                <th className="px-4 py-3 text-left">Approval Chain</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Flags</th>
                <th className="px-4 py-3 text-left">​</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-t border-[#f4f4f8] hover:bg-[#fafafd] transition-colors align-top">
                  <td className="px-4 py-3">
                    <div className="font-[750] text-[13px]">{app.staff_name}</div>
                    <div className="text-[11px] text-[var(--muted)]">
                      {[app.staff_role, app.staff_grade].filter(Boolean).join(" · ")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span title={app.leave_type_name}>
                      <HrBadge variant="purple">{leaveTypeAbbrev(app.leave_type_name)}</HrBadge>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-[12px]">
                    <div>{app.from_date} → {app.to_date}</div>
                    <div className="text-[var(--muted)]">{app.duration}d</div>
                  </td>
                  <td className="px-4 py-3"><ApprovalChainCell app={app} /></td>
                  <td className="px-4 py-3">
                    {app.status === "pending" && app.days_stuck > 0 ? (
                      <HrBadge variant="red">stuck {app.days_stuck}d</HrBadge>
                    ) : (
                      <HrBadge variant={app.status === "approved" ? "green" : app.status === "rejected" ? "red" : "amber"}>
                        {app.status}
                      </HrBadge>
                    )}
                  </td>
                  <td className="px-4 py-3"><FlagsCell app={app} /></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <HrButton variant="icon" size="icon" onClick={() => setViewing(app)} title="View">
                        <Eye size={14} />
                      </HrButton>
                      {app.status === "pending" && (
                        <>
                          <HrButton variant="green" size="icon" title="Approve" onClick={() => setActing({ id: app.id, action: "approve" })}>
                            <Check size={13} />
                          </HrButton>
                          <HrButton variant="red" size="icon" title="Reject" onClick={() => setActing({ id: app.id, action: "reject" })}>
                            <X size={13} />
                          </HrButton>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <HrConfirmDialog
        isOpen={!!acting}
        onClose={() => setActing(null)}
        onConfirm={() => void handleAction()}
        title={`${acting?.action === "approve" ? "Approve" : "Reject"} Leave`}
        message="This action will update the leave status immediately."
        confirmLabel={acting?.action === "approve" ? "Approve" : "Reject"}
        danger={acting?.action === "reject"}
        loading={actLoading}
      />

      <HrDrawer isOpen={!!viewing} onClose={() => setViewing(null)} title="Leave Application">
        {viewing && (
          <div className="grid gap-4">
            <div>
              <div className="text-[16px] font-[800]">{viewing.staff_name}</div>
              <div className="text-[12px] text-[var(--muted)]">
                {[viewing.staff_role, viewing.staff_grade].filter(Boolean).join(" · ")}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-[13px]">
              <div><span className="text-[var(--muted)]">Type: </span>{viewing.leave_type_name}</div>
              <div><span className="text-[var(--muted)]">Duration: </span>{viewing.duration} day(s)</div>
              <div><span className="text-[var(--muted)]">From: </span>{viewing.from_date}</div>
              <div><span className="text-[var(--muted)]">To: </span>{viewing.to_date}</div>
            </div>
            {viewing.reason && (
              <div>
                <div className="text-[11px] uppercase text-[var(--muted)] font-[850] mb-1">Reason</div>
                <div className="text-[13px]">{viewing.reason}</div>
              </div>
            )}
            {viewing.approval_note && (
              <div>
                <div className="text-[11px] uppercase text-[var(--muted)] font-[850] mb-1">Approval Note</div>
                <div className="text-[13px]">{viewing.approval_note}</div>
              </div>
            )}
            {viewing.approval_steps.length > 0 && (
              <div>
                <div className="text-[11px] uppercase text-[var(--muted)] font-[850] mb-2">Approval Chain</div>
                <div className="grid gap-2">
                  {viewing.approval_steps.map((step) => (
                    <div key={step.sequence} className="flex items-center gap-2 text-[13px]">
                      <HrBadge variant={step.status === "approved" ? "green" : step.status === "rejected" ? "red" : "amber"}>
                        L{step.sequence} · {step.role_label || "—"}
                      </HrBadge>
                      <span>{step.approver_name || "Unassigned"}</span>
                      {step.note && <span className="text-[var(--muted)]">— {step.note}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--line)]">
              <HrBadge variant={viewing.status === "approved" ? "green" : viewing.status === "rejected" ? "red" : "amber"}>
                {viewing.status}
              </HrBadge>
              <FlagsCell app={viewing} />
            </div>
          </div>
        )}
      </HrDrawer>
    </div>
  );
}

// ─── Coverage tab ─────────────────────────────────────────────────────────────
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function CoverageTab() {
  const today = useMemo(() => new Date(), []);
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 });
  const monthStr = `${cursor.year}-${String(cursor.month).padStart(2, "0")}`;
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const { data: monthData, loading: monthLoading } = useLeaveCoverageMonth(monthStr);
  const { data: dayData, loading: dayLoading } = useLeaveCoverageDay(selectedDate);

  const dayCounts = useMemo(() => {
    const map = new Map<string, { approved: number; pending: number; rejected: number }>();
    for (const d of monthData?.days ?? []) map.set(d.date, d);
    return map;
  }, [monthData]);

  const firstOfMonth = new Date(cursor.year, cursor.month - 1, 1);
  const daysInMonth = new Date(cursor.year, cursor.month, 0).getDate();
  const leadingBlanks = firstOfMonth.getDay();
  const todayStr = today.toISOString().slice(0, 10);

  const changeMonth = (delta: number) => {
    setSelectedDate(null);
    setCursor((c) => {
      const m = c.month + delta;
      if (m < 1) return { year: c.year - 1, month: 12 };
      if (m > 12) return { year: c.year + 1, month: 1 };
      return { year: c.year, month: m };
    });
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: leadingBlanks }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="grid grid-cols-[minmax(280px,340px)_1fr] gap-5 items-start">
      <div className="bg-white border border-[var(--line)] rounded-[14px] p-4" style={{ boxShadow: "var(--shadow)" }}>
        <div className="flex items-center justify-between mb-3">
          <HrButton variant="icon" size="icon" onClick={() => changeMonth(-1)}><ChevronLeft size={14} /></HrButton>
          <div className="font-[800] text-[15px]" style={{ fontFamily: "var(--serif)" }}>
            {firstOfMonth.toLocaleString(undefined, { month: "long", year: "numeric" })}
          </div>
          <HrButton variant="icon" size="icon" onClick={() => changeMonth(1)}><ChevronRight size={14} /></HrButton>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-[var(--muted)] font-[800] mb-1">
          {WEEKDAY_LABELS.map((d) => <div key={d}>{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={`b${i}`} />;
            const dateStr = `${cursor.year}-${String(cursor.month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const counts = dayCounts.get(dateStr);
            const isSelected = selectedDate === dateStr;
            const isToday = dateStr === todayStr;
            return (
              <button
                key={dateStr}
                onClick={() => setSelectedDate(dateStr)}
                className="aspect-square rounded-[8px] flex flex-col items-center justify-center gap-[3px] text-[12px] transition-colors"
                style={{
                  background: isSelected ? "var(--brand)" : "transparent",
                  color: isSelected ? "white" : "var(--ink)",
                  border: isToday && !isSelected ? "1px solid var(--brand)" : "1px solid transparent",
                }}
              >
                <span className="font-[700]">{day}</span>
                <span className="flex gap-[2px]">
                  {!!counts?.approved && <span className="w-[5px] h-[5px] rounded-full" style={{ background: isSelected ? "white" : "var(--green)" }} />}
                  {!!counts?.pending && <span className="w-[5px] h-[5px] rounded-full" style={{ background: isSelected ? "white" : "var(--amber)" }} />}
                  {!!counts?.rejected && <span className="w-[5px] h-[5px] rounded-full" style={{ background: isSelected ? "white" : "var(--red)" }} />}
                </span>
              </button>
            );
          })}
        </div>
        <div className="flex gap-4 mt-4 pt-3 border-t border-[var(--line)] text-[11px] text-[var(--muted)]">
          <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-full" style={{ background: "var(--green)" }} /> Approved</span>
          <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-full" style={{ background: "var(--amber)" }} /> Pending</span>
          <span className="flex items-center gap-1"><span className="w-[7px] h-[7px] rounded-full" style={{ background: "var(--red)" }} /> Rejected</span>
        </div>
        {monthLoading && <div className="mt-2 text-[11px] text-[var(--muted)]">Loading…</div>}
      </div>

      <div className="bg-white border border-[var(--line)] rounded-[14px] p-5 min-h-[300px]" style={{ boxShadow: "var(--shadow)" }}>
        {!selectedDate ? (
          <div className="text-[var(--muted)] text-[13px]">Select a day to see who&apos;s on leave.</div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-[var(--line)]">
              <div className="font-[800] text-[16px]" style={{ fontFamily: "var(--serif)" }}>{selectedDate}</div>
              {selectedDate < todayStr && <span className="text-[11px] italic text-[var(--muted)]">Past date — actual records.</span>}
            </div>
            {dayLoading ? <HrSkeleton rows={3} /> : (
              <div className="grid gap-5">
                <div>
                  <div className="text-[12px] font-[850] text-[var(--green)] mb-2">✓ APPROVED ({dayData?.approved.length ?? 0})</div>
                  {!dayData?.approved.length ? (
                    <div className="text-[13px] text-[var(--muted)]">No approved leaves.</div>
                  ) : (
                    <div className="grid gap-1">
                      {dayData.approved.map((r) => (
                        <div key={r.id} className="text-[13px]">{r.staff_name} <span className="text-[var(--muted)]">— {r.leave_type_name}</span></div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <div className="text-[12px] font-[850] text-[var(--amber)] mb-2">● PENDING QUEUE ({dayData?.pending.length ?? 0})</div>
                  {!dayData?.pending.length ? (
                    <div className="text-[13px] text-[var(--muted)]">No pending applications.</div>
                  ) : (
                    <div className="grid gap-1">
                      {dayData.pending.map((r) => (
                        <div key={r.id} className="text-[13px]">{r.staff_name} <span className="text-[var(--muted)]">— {r.leave_type_name}</span></div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Leave Page ──────────────────────────────────────────────────────────
export default function HrLeavePage() {
  const [tab, setTab] = useState<"applications" | "coverage">("applications");
  const [policyOpen, setPolicyOpen] = useState(false);
  const [onBehalfOpen, setOnBehalfOpen] = useState(false);
  const { data: stats, refetch: refetchStats } = useLeaveStats();

  return (
    <div>
      <HrHero
        eyebrow="HR / Staff Management"
        title="Leave"
        accent="Management"
        sub="Monitor all leave applications, approvals, and team coverage."
        actions={
          <>
            <HrButton variant="ghost" onClick={() => setPolicyOpen(true)}>Configure Policy</HrButton>
            <HrButton variant="primary" onClick={() => setOnBehalfOpen(true)}>
              <Plus size={14} /> Apply on Behalf
            </HrButton>
          </>
        }
      />

      <div className="grid grid-cols-4 gap-3 mb-5">
        <HrKpiCard label="Pending Approval" value={stats?.pending_approval ?? "—"} color="var(--brand)" />
        <HrKpiCard label="Stuck in Chain" value={stats?.stuck_in_chain ?? "—"} color="var(--red)" />
        <HrKpiCard label="Coverage at Risk" value={stats?.coverage_at_risk ?? "—"} color="var(--amber)" />
        <HrKpiCard label="Applied Today" value={stats?.applied_today ?? "—"} />
      </div>

      <div className="flex gap-5 mb-5 border-b border-[var(--line)]">
        {(["applications", "coverage"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className="pb-3 text-[14px] font-[750] border-0 bg-transparent cursor-pointer capitalize"
            style={{
              color: tab === t ? "var(--brand)" : "var(--muted)",
              borderBottom: tab === t ? "2px solid var(--brand)" : "2px solid transparent",
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "applications" ? <ApplicationsTab /> : <CoverageTab />}

      <ConfigurePolicyModal isOpen={policyOpen} onClose={() => setPolicyOpen(false)} />
      <ApplyOnBehalfModal
        isOpen={onBehalfOpen}
        onClose={() => setOnBehalfOpen(false)}
        onSaved={() => void refetchStats()}
      />
    </div>
  );
}
