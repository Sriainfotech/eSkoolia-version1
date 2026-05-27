"use client";
/**
 * HR Leave — Mode-toggled: Setup Wizard | Operations Board
 */
import { useState } from "react";
import { Plus, Edit2, Trash2, Check, X, Clock, AlertCircle } from "lucide-react";
import {
  HrButton, HrBadge, HrKpiCard, HrModal, HrField,
  HrInput, HrSelect, HrTextarea, HrStepWizard, HrHero,
  HrSkeleton, HrConfirmDialog, statusToBadge, useHrToast,
} from "@/components/hr/HrUi";
import {
  useLeaveTypes, createLeaveType, updateLeaveType,
  useLeaveApplications, updateLeaveStatus,
} from "@/hooks/useHrApi";
import type { LeaveType, LeaveApplication } from "@/types/hr";

const LEAVE_WIZARD_STEPS = [
  { label: "Leave Types",        hint: "Define categories" },
  { label: "Entitlement Matrix", hint: "Days per role" },
  { label: "Approval Chain",    hint: "Who approves" },
];

const LEAVE_UNITS = ["Days", "Hours"] as const;
const ENTITLEMENT_ROLES = ["Teacher", "Admin", "Support", "Finance", "All Roles"] as const;
const APPROVERS = ["HOD", "Principal", "Vice Principal", "HR Admin"] as const;

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

// ─── Setup Wizard ─────────────────────────────────────────────────────────────
function LeaveSetupWizard() {
  const [wizardStep, setWizardStep] = useState(1);
  const { data, loading, refetch } = useLeaveTypes();
  const leaveTypes = data?.results ?? [];
  const [addOpen, setAddOpen] = useState(false);
  const [editType, setEditType] = useState<LeaveType | null>(null);

  // Entitlement matrix local state
  const [matrix, setMatrix] = useState<{ role: string; leave_type: string; days: number }[]>([]);
  const [matrixRow, setMatrixRow] = useState({ role: "All Roles", leave_type: "", days: 14 });

  // Approval chain local state
  const [chain, setChain] = useState<{ level: number; approver: string }[]>([
    { level: 1, approver: "HOD" },
    { level: 2, approver: "Principal" },
  ]);

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
          <h2 className="m-0 mb-5 text-[20px] font-[800]" style={{ fontFamily: "var(--serif)" }}>Approval Chain</h2>
          <div className="flex flex-col gap-3 mb-4">
            {chain.map((c, i) => (
              <div key={i} className="flex items-center gap-3 border border-[var(--line)] rounded-[10px] px-4 py-3">
                <div
                  className="w-[28px] h-[28px] rounded-full flex items-center justify-center text-white font-[900] text-[12px] shrink-0"
                  style={{ background: "var(--brand)" }}
                >
                  {c.level}
                </div>
                <HrSelect
                  value={c.approver}
                  onChange={(e) => setChain((ch) => ch.map((x, j) => j === i ? { ...x, approver: e.target.value } : x))}
                >
                  {APPROVERS.map((a) => <option key={a}>{a}</option>)}
                </HrSelect>
                <HrButton variant="red" size="icon" onClick={() => setChain((ch) => ch.filter((_, j) => j !== i).map((x, j) => ({ ...x, level: j + 1 })))}>
                  <X size={12} />
                </HrButton>
              </div>
            ))}
          </div>
          <HrButton variant="ghost" onClick={() => setChain((ch) => [...ch, { level: ch.length + 1, approver: "HOD" }])}>
            <Plus size={13} /> Add approval level
          </HrButton>
          <div className="flex justify-between mt-5">
            <HrButton variant="ghost" onClick={() => setWizardStep(2)}>← Back</HrButton>
            <HrButton variant="green" onClick={() => alert("Leave setup saved (demo)")}>
              <Check size={14} /> Save Setup
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

// ─── Operations Board ─────────────────────────────────────────────────────────
const statusIcon = (s: string) => {
  if (s === "approved") return <Check size={13} className="text-[var(--green)]" />;
  if (s === "rejected") return <X size={13} className="text-[var(--red)]" />;
  return <Clock size={13} className="text-[var(--amber)]" />;
};

function OperationsBoard() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data, loading, refetch } = useLeaveApplications({ status: statusFilter });
  const { toast } = useHrToast();
  const [acting, setActing] = useState<{ id: number; action: "approved" | "rejected" } | null>(null);
  const [loading2, setLoading2] = useState(false);

  const applications = data?.results ?? [];
  const pending = applications.filter((a) => a.status === "pending").length;
  const approved = applications.filter((a) => a.status === "approved").length;

  const handleAction = async () => {
    if (!acting) return;
    setLoading2(true);
    try {
      await updateLeaveStatus(acting.id, acting.action);
      toast(`Leave ${acting.action}`);
      void refetch();
    } catch { toast("Failed", "error"); }
    finally { setLoading2(false); setActing(null); }
  };

  return (
    <div>
      <div className="grid grid-cols-4 gap-3 mb-5">
        <HrKpiCard label="Total Applications" value={data?.count ?? "—"} />
        <HrKpiCard label="Pending" value={pending} color="var(--amber)" />
        <HrKpiCard label="Approved" value={approved} color="var(--green)" />
        <HrKpiCard label="Rejected" value={applications.filter((a) => a.status === "rejected").length} color="var(--red)" />
      </div>

      <div className="flex gap-3 mb-4">
        <HrSelect value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
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
        <div className="bg-white border border-[var(--line)] rounded-[14px] overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#fafafa] text-[11px] uppercase text-[#64748b] tracking-[0.08em]">
                <th className="px-4 py-3 text-left">Staff</th>
                <th className="px-4 py-3 text-left">Leave Type</th>
                <th className="px-4 py-3 text-left">From</th>
                <th className="px-4 py-3 text-left">To</th>
                <th className="px-4 py-3 text-left">Days</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {applications.map((app) => (
                <tr key={app.id} className="border-t border-[#f4f4f8] hover:bg-[#fafafd] transition-colors">
                  <td className="px-4 py-3 font-[750] text-[13px]">{app.staff_name}</td>
                  <td className="px-4 py-3 text-[13px]">{app.leave_type_name}</td>
                  <td className="px-4 py-3 text-[12px] text-[var(--muted)]">{app.start_date}</td>
                  <td className="px-4 py-3 text-[12px] text-[var(--muted)]">{app.end_date}</td>
                  <td className="px-4 py-3 text-[13px]">{app.days_requested}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      {statusIcon(app.status)}
                      <HrBadge variant={app.status === "approved" ? "green" : app.status === "rejected" ? "red" : "amber"}>
                        {app.status}
                      </HrBadge>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {app.status === "pending" && (
                      <div className="flex gap-1">
                        <HrButton variant="green" size="sm" onClick={() => setActing({ id: app.id, action: "approved" })}>
                          <Check size={12} /> Approve
                        </HrButton>
                        <HrButton variant="red" size="sm" onClick={() => setActing({ id: app.id, action: "rejected" })}>
                          <X size={12} /> Reject
                        </HrButton>
                      </div>
                    )}
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
        title={`${acting?.action === "approved" ? "Approve" : "Reject"} Leave`}
        message="This action will update the leave status immediately."
        confirmLabel={acting?.action === "approved" ? "Approve" : "Reject"}
        danger={acting?.action === "rejected"}
        loading={loading2}
      />
    </div>
  );
}

// ─── Main Leave Page ──────────────────────────────────────────────────────────
export default function HrLeavePage() {
  const [mode, setMode] = useState<"setup" | "ops">("ops");

  return (
    <div>
      <HrHero
        eyebrow="HR Module"
        title="Leave"
        accent="Management"
        sub="Configure leave policies and manage staff leave applications."
        actions={
          <div className="flex gap-0 border border-[var(--line)] rounded-[8px] overflow-hidden">
            {(["ops", "setup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className="px-4 py-[8px] text-[13px] font-[700] border-0 transition-colors"
                style={{
                  background: mode === m ? "var(--brand)" : "white",
                  color: mode === m ? "white" : "var(--muted)",
                }}
              >
                {m === "ops" ? "Operations Board" : "Setup Wizard"}
              </button>
            ))}
          </div>
        }
      />
      {mode === "ops" ? <OperationsBoard /> : <LeaveSetupWizard />}
    </div>
  );
}
