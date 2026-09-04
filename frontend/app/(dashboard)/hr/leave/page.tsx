"use client";
/**
 * HR Leave Management — Applications (list + approve/reject) and Coverage
 * (month calendar of who's out) tabs, plus Configure Policy / Apply on
 * Behalf actions. Approval routes through a per-designation L1/L2 chain
 * (Configure Policy > Approval Chain); L2 only applies once a request's
 * duration reaches that policy's l2_trigger_days. Configure Policy itself
 * lives at /hr/leave/setup (its own page, not a modal) — see LeaveSetupWizard.
 */
import { Fragment, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Check, X, Eye, ChevronLeft, ChevronRight, ShieldAlert, SkipForward } from "lucide-react";
import {
  HrButton, HrBadge, HrKpiCard, HrModal, HrField,
  HrInput, HrSelect, HrTextarea, HrHero, HrDrawer,
  HrSkeleton, HrConfirmDialog, useHrToast,
} from "@/components/hr/HrUi";
import {
  useLeaveTypes,
  useLeaveApplications, updateLeaveStatus, adminApproveLeave, applyOnBehalf,
  useLeaveStats, useLeaveCoverageMonth, useLeaveCoverageDay,
  useLeaveRequestDetail, setSubstituteName,
  useStaffList,
} from "@/hooks/useHrApi";
import { usePermissions } from "@/hooks/usePermissions";
import type { LeaveApplication } from "@/types/hr";
import { leaveTypeAbbrev } from "@/lib/hr/leaveTypeFormat";
// ─── Apply on Behalf ───────────────────────────────────────────────────────────
function ApplyOnBehalfModal({
  isOpen, onClose, onSaved,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useHrToast();
  const { me } = usePermissions();
  const isSchoolAdmin = !!me && (me.is_superuser || !!me.is_school_admin);
  const { data: staffData, loading: staffLoading, error: staffError, refetch: refetchStaff } = useStaffList();
  const { data: leaveTypeData, loading: leaveTypesLoading, error: leaveTypesError, refetch: refetchLeaveTypes } = useLeaveTypes();
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
    bypass_reason: "",
  });
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const visibleStaff = form.role ? staffOptions.filter((s) => s.designation_name === form.role) : staffOptions;
  const resetForm = () => setForm({
    staff: "", leave_type: "", from_date: "", to_date: "", reason: "",
    half_day_type: "", absence_type: "", role: "", bypass_chain: false, bypass_reason: "",
  });

  const handleSave = async () => {
    if (!form.staff || !form.leave_type || !form.from_date || !form.to_date) {
      toast("Staff, leave type, and dates are required", "error");
      return;
    }
    const bypassChain = isSchoolAdmin && form.bypass_chain;
    if (bypassChain && !form.bypass_reason.trim()) {
      toast("A reason is required to bypass the approval chain", "error");
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
        bypass_chain: bypassChain,
        approval_note: bypassChain ? form.bypass_reason.trim() : undefined,
      });
      toast(bypassChain ? "Leave applied and approved — approval chain bypassed" : "Leave applied on behalf successfully");
      onSaved(); onClose();
      resetForm();
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
            <HrSelect value={form.staff} onChange={(e) => set("staff", e.target.value)} disabled={staffLoading}>
              <option value="">{staffLoading ? "Loading…" : "Select…"}</option>
              {visibleStaff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name || `${s.first_name} ${s.last_name}`.trim()}
                  {s.department_name ? ` — ${s.department_name}` : ""}
                </option>
              ))}
            </HrSelect>
            {!staffLoading && !staffError && staffOptions.length === 0 && (
              <div className="text-[12px] text-[var(--muted)]">No active staff found for your school.</div>
            )}
            {staffError && (
              <button type="button" onClick={() => void refetchStaff()} className="text-[12px] text-[var(--red)] underline text-left">
                {staffError} — tap to retry
              </button>
            )}
          </HrField>
          <HrField label="Leave Type" required>
            <HrSelect value={form.leave_type} onChange={(e) => set("leave_type", e.target.value)} disabled={leaveTypesLoading}>
              <option value="">{leaveTypesLoading ? "Loading…" : "Select…"}</option>
              {leaveTypes.map((lt) => <option key={lt.id} value={lt.id}>{lt.name}</option>)}
            </HrSelect>
            {!leaveTypesLoading && !leaveTypesError && leaveTypes.length === 0 && (
              <div className="text-[12px] text-[var(--muted)]">No leave types configured yet — set them up under Configure Policy.</div>
            )}
            {leaveTypesError && (
              <button type="button" onClick={() => void refetchLeaveTypes()} className="text-[12px] text-[var(--red)] underline text-left">
                {leaveTypesError} — tap to retry
              </button>
            )}
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
        {isSchoolAdmin && (
          <div className="grid gap-3 bg-[#fafafa] border border-[var(--line)] rounded-[10px] p-3">
            <label className="flex items-start gap-2 cursor-pointer">
              <input
                type="checkbox" className="w-4 h-4 mt-[2px] accent-[var(--brand)]"
                checked={form.bypass_chain} onChange={(e) => set("bypass_chain", e.target.checked)}
              />
              <span className="text-[13px]">
                <strong>Admin Approved — bypass approval chain.</strong>{" "}
                <span className="text-[var(--muted)]">Use only when the normal L1/L2 approvers are unavailable — approves immediately and is logged.</span>
              </span>
            </label>
            {form.bypass_chain && (
              <HrField label="Bypass Reason" required>
                <HrTextarea
                  value={form.bypass_reason}
                  onChange={(e) => set("bypass_reason", e.target.value)}
                  placeholder="e.g. Both normal approvers are unavailable."
                  rows={2}
                />
              </HrField>
            )}
          </div>
        )}
        <div className="flex justify-end gap-2 pt-2 border-t border-[#f1f5f9]">
          <HrButton variant="ghost" onClick={onClose}>Cancel</HrButton>
          <HrButton
            variant="primary" onClick={() => void handleSave()} loading={saving}
            disabled={isSchoolAdmin && form.bypass_chain && !form.bypass_reason.trim()}
          >
            Submit Leave
          </HrButton>
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

  // While the request still sits at L1, an L2 step doesn't exist yet (it's
  // only created once L1 approves) — but if the policy will require one for
  // this request's duration, show a "future" placeholder dot so the chain
  // doesn't read as single-step when it isn't.
  const showProjectedL2 = app.approval_steps.length === 1 && !!app.projected_l2_role_label;

  return (
    <div>
      {app.current_approval_level && (
        <div className="text-[10px] font-[800] text-[var(--pu)] uppercase tracking-[0.04em] mb-1">
          {app.current_approval_level}
        </div>
      )}
      <div className="flex items-start">
      {app.approval_steps.map((step, i) => (
        <Fragment key={step.sequence}>
          <div className="flex flex-col items-center gap-1 min-w-[56px]">
            {step.status === "approved" ? (
              <span className="w-7 h-7 rounded-full bg-[var(--green)] text-white flex items-center justify-center"><Check size={14} /></span>
            ) : step.status === "rejected" ? (
              <span className="w-7 h-7 rounded-full bg-[var(--red)] text-white flex items-center justify-center"><X size={14} /></span>
            ) : step.status === "bypassed" ? (
              <span className="w-7 h-7 rounded-full bg-[#64748b] text-white flex items-center justify-center"><SkipForward size={12} /></span>
            ) : (
              <span className="w-7 h-7 rounded-full bg-[var(--amber)] flex items-center justify-center">
                <span className="w-2 h-2 rounded-full bg-white" />
              </span>
            )}
            <span className="text-[11px] text-[var(--muted)] whitespace-nowrap">{step.approver_name || step.role_label || "—"}</span>
          </div>
          {(i < app.approval_steps.length - 1 || showProjectedL2) && (
            <div className="h-[2px] w-4 bg-[#e5e7eb] mt-[13px] flex-shrink-0" />
          )}
        </Fragment>
      ))}
      {showProjectedL2 && (
        <div className="flex flex-col items-center gap-1 min-w-[56px]">
          <span className="w-7 h-7 rounded-full bg-white border-2 border-[#e5e7eb] flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-[var(--ink-2)]" />
          </span>
        </div>
      )}
      </div>
    </div>
  );
}

function FlagsCell({ app }: { app: LeaveApplication }) {
  const flags: React.ReactNode[] = [];
  if (app.approved_via_admin_override) flags.push(<HrBadge key="override" variant="grey">Admin Approved</HrBadge>);
  if (app.coverage_risk) flags.push(<HrBadge key="cov" variant="amber">Coverage risk</HrBadge>);
  if (app.is_on_behalf) flags.push(<HrBadge key="beh" variant="blue">By Admin</HrBadge>);
  if (app.half_day_type) flags.push(<HrBadge key="hd" variant="grey">{app.half_day_type}</HrBadge>);
  if (flags.length === 0) return <span className="text-[var(--muted)]">—</span>;
  return <div className="flex flex-wrap gap-1">{flags}</div>;
}

// ─── Leave detail drawer ────────────────────────────────────────────────────
function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1 text-[13px]">
      <span className="text-[var(--muted)]">{label}</span>
      <span className="font-[750] text-right">{value}</span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] font-[850] mb-2">{children}</div>;
}

function daysAgo(iso: string) {
  const diffMs = Date.now() - new Date(iso).getTime();
  return Math.max(0, Math.floor(diffMs / 86400000));
}

function ApprovalChainVisual({
  steps, projectedL2RoleLabel,
}: {
  steps: LeaveApplication["approval_steps"];
  projectedL2RoleLabel?: string;
}) {
  if (steps.length === 0) {
    return <div className="text-[13px] text-[var(--muted)]">No approval chain for this request.</div>;
  }
  const activeIndex = steps.findIndex((s) => s.status === "pending");
  // L2 doesn't exist as a real step until L1 approves — show a placeholder
  // so a chain that will need two approvals doesn't read as single-step.
  const showProjectedL2 = steps.length === 1 && !!projectedL2RoleLabel;
  return (
    <div className="flex items-start gap-0">
      {steps.map((step, i) => {
        const isActive = i === activeIndex;
        const isFuture = activeIndex !== -1 && i > activeIndex;
        let caption: string;
        if (step.status === "approved") caption = "Approved";
        else if (step.status === "rejected") caption = "Rejected";
        else if (step.status === "bypassed") caption = "Bypassed by Admin";
        else if (isActive) caption = `Waiting ${daysAgo(step.became_active_at)}d`;
        else if (isFuture) caption = `Awaiting L${activeIndex + 1}`;
        else caption = "—";

        return (
          <Fragment key={step.sequence}>
            <div className="flex flex-col items-center gap-1.5 min-w-[86px]">
              {step.status === "approved" ? (
                <span className="w-9 h-9 rounded-full bg-[var(--green)] text-white flex items-center justify-center"><Check size={16} /></span>
              ) : step.status === "rejected" ? (
                <span className="w-9 h-9 rounded-full bg-[var(--red)] text-white flex items-center justify-center"><X size={16} /></span>
              ) : step.status === "bypassed" ? (
                <span className="w-9 h-9 rounded-full bg-[#64748b] text-white flex items-center justify-center"><SkipForward size={15} /></span>
              ) : isActive ? (
                <span className="w-9 h-9 rounded-full bg-[var(--amber)] flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-white" />
                </span>
              ) : (
                <span className="w-9 h-9 rounded-full bg-white border-2 border-[#e5e7eb] flex items-center justify-center">
                  <span className="w-2 h-2 rounded-full bg-[var(--ink-2)]" />
                </span>
              )}
              <span className="text-[12px] font-[800] text-center">{step.role_label || `L${step.sequence}`}</span>
              <span className="text-[11px] text-[var(--muted)] text-center whitespace-nowrap">
                {step.status === "bypassed" ? "Assigned to: " : ""}{step.approver_name || "Unassigned"}
              </span>
              {step.status === "bypassed" && step.acted_by_name && (
                <span className="text-[11px] text-[#64748b] font-[700] text-center whitespace-nowrap">Bypassed by: {step.acted_by_name}</span>
              )}
              <span className="text-[10px] text-[var(--muted)] text-center">{caption}</span>
            </div>
            {(i < steps.length - 1 || showProjectedL2) && <div className="h-[2px] flex-1 bg-[#e5e7eb] mt-[17px]" />}
          </Fragment>
        );
      })}
      {showProjectedL2 && (
        <div className="flex flex-col items-center gap-1.5 min-w-[86px]">
          <span className="w-9 h-9 rounded-full bg-white border-2 border-[#e5e7eb] flex items-center justify-center">
            <span className="w-2 h-2 rounded-full bg-[var(--ink-2)]" />
          </span>
          <span className="text-[12px] font-[800] text-center">{projectedL2RoleLabel}</span>
          <span className="text-[11px] text-[var(--muted)] text-center whitespace-nowrap">Unassigned</span>
          <span className="text-[10px] text-[var(--muted)] text-center">Awaiting L1</span>
        </div>
      )}
    </div>
  );
}

function LeaveDetailDrawer({
  app, onClose, onActed,
}: {
  app: LeaveApplication | null;
  onClose: () => void;
  onActed: () => void;
}) {
  const { toast } = useHrToast();
  const { me } = usePermissions();
  const isSchoolAdmin = !!me && (me.is_superuser || !!me.is_school_admin);
  const { data: detail, loading: detailLoading, refetch: refetchDetail } = useLeaveRequestDetail(app?.id ?? null);
  const [substitute, setSubstitute] = useState("");
  const [savingSubstitute, setSavingSubstitute] = useState(false);
  const [acting, setActing] = useState<"approve" | "reject" | null>(null);
  const [actLoading, setActLoading] = useState(false);
  const [adminApproveOpen, setAdminApproveOpen] = useState(false);
  const [adminApproveReason, setAdminApproveReason] = useState("");
  const [adminApproveLoading, setAdminApproveLoading] = useState(false);

  useEffect(() => {
    setSubstitute(detail?.substitute_staff_name ?? "");
  }, [detail]);

  const handleSaveSubstitute = async () => {
    if (!app) return;
    setSavingSubstitute(true);
    try {
      await setSubstituteName(app.id, substitute.trim());
      toast("Substitute saved");
      void refetchDetail();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save substitute", "error");
    } finally {
      setSavingSubstitute(false);
    }
  };

  const handleAction = async () => {
    if (!app || !acting) return;
    setActLoading(true);
    try {
      await updateLeaveStatus(app.id, acting);
      toast(`Leave ${acting === "approve" ? "approved" : "rejected"}`);
      onActed();
      setActing(null);
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed", "error");
    } finally {
      setActLoading(false);
    }
  };

  const handleAdminApprove = async () => {
    if (!app) return;
    const reason = adminApproveReason.trim();
    if (!reason) {
      toast("A reason is required for Admin Approved", "error");
      return;
    }
    setAdminApproveLoading(true);
    try {
      await adminApproveLeave(app.id, reason);
      toast("Leave approved — approval chain bypassed");
      onActed();
      setAdminApproveOpen(false);
      setAdminApproveReason("");
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to admin-approve", "error");
    } finally {
      setAdminApproveLoading(false);
    }
  };

  const abbrev = app ? leaveTypeAbbrev(app.leave_type_name) : "";

  return (
    <>
      <HrDrawer isOpen={!!app} onClose={onClose} title={app ? `${app.staff_name} — ${abbrev}` : ""} width={420}>
        {app && (
          <div className="grid gap-5">
            <section>
              <SectionHeading>Staff</SectionHeading>
              <DetailRow label="Name" value={app.staff_name} />
              <DetailRow label="Role" value={app.staff_role || "—"} />
              <DetailRow label="Department" value={app.staff_grade || "—"} />
            </section>

            <div className="border-t border-[var(--line)]" />

            <section>
              <SectionHeading>Leave Details</SectionHeading>
              <DetailRow label="Type" value={<span className="inline-flex items-center gap-2"><HrBadge variant="purple">{abbrev}</HrBadge>{app.leave_type_name}</span>} />
              <DetailRow label="Dates" value={`${app.from_date} to ${app.to_date}`} />
              <DetailRow label="Duration" value={`${app.duration} day${app.duration === 1 ? "" : "s"}`} />
              {app.reason && <DetailRow label="Reason" value={app.reason} />}
            </section>

            <div className="border-t border-[var(--line)]" />

            <section>
              <SectionHeading>Approval Chain</SectionHeading>
              <ApprovalChainVisual steps={app.approval_steps} projectedL2RoleLabel={app.projected_l2_role_label} />
            </section>

            <div className="border-t border-[var(--line)]" />

            <section>
              <SectionHeading>Leave Balance</SectionHeading>
              {detailLoading ? (
                <HrSkeleton rows={1} />
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {(detail?.leave_balances ?? []).map((b) => (
                    <div key={b.leave_type_id} className="border border-[var(--line)] rounded-[10px] p-2.5 text-center">
                      <div className="text-[10px] font-[850] text-[var(--muted)] uppercase truncate">{leaveTypeAbbrev(b.leave_type_name)}</div>
                      <div className="text-[18px] font-[900]">{b.available_days ?? "—"}</div>
                      <div className="text-[10px] text-[var(--muted)]">
                        {b.total_days !== null ? `${b.used_days} used of ${b.total_days}` : "Not yet allocated"}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="border-t border-[var(--line)]" />

            <section>
              <SectionHeading>Coverage Impact</SectionHeading>
              {detailLoading ? <HrSkeleton rows={1} /> : detail && detail.coverage_impact.total > 0 ? (
                <div>
                  <div className="flex justify-between text-[13px] mb-1.5">
                    <span className="font-[750]">{detail.coverage_impact.department_name}</span>
                    <span className="text-[var(--muted)]">{detail.coverage_impact.available}/{detail.coverage_impact.total} avail</span>
                  </div>
                  <div className="h-[8px] rounded-full bg-[#f1f5f9] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--brand)]"
                      style={{ width: `${(detail.coverage_impact.available / detail.coverage_impact.total) * 100}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-[13px] text-[var(--muted)]">No department assigned — coverage impact unavailable.</div>
              )}
            </section>

            <div className="border-t border-[var(--line)]" />

            <section>
              <SectionHeading>Substitute / Cover</SectionHeading>
              <HrInput
                value={substitute}
                onChange={(e) => setSubstitute(e.target.value)}
                onBlur={() => detail && substitute.trim() !== detail.substitute_staff_name && void handleSaveSubstitute()}
                placeholder="Enter substitute teacher name…"
                disabled={savingSubstitute}
              />
            </section>

            {app.status === "pending" ? (
              <>
                <div className="border-t border-[var(--line)]" />
                <section>
                  <SectionHeading>Actions</SectionHeading>
                  <div className="flex gap-2">
                    <HrButton variant="green" className="flex-1 justify-center" onClick={() => setActing("approve")}>
                      <Check size={14} /> Approve
                    </HrButton>
                    <HrButton variant="red" className="flex-1 justify-center" onClick={() => setActing("reject")}>
                      <X size={14} /> Reject
                    </HrButton>
                  </div>
                  {isSchoolAdmin && (
                    <HrButton variant="ghost" className="w-full justify-center mt-2" onClick={() => setAdminApproveOpen(true)}>
                      <ShieldAlert size={14} /> Admin Approved (bypass chain)
                    </HrButton>
                  )}
                </section>
              </>
            ) : (
              <div className="flex flex-wrap gap-2 pt-1">
                <HrBadge variant={app.status === "approved" ? "green" : "red"}>{app.status}</HrBadge>
                <FlagsCell app={app} />
              </div>
            )}
          </div>
        )}
      </HrDrawer>

      <HrConfirmDialog
        isOpen={!!acting}
        onClose={() => setActing(null)}
        onConfirm={() => void handleAction()}
        title={`${acting === "approve" ? "Approve" : "Reject"} Leave`}
        message="This action will update the leave status immediately."
        confirmLabel={acting === "approve" ? "Approve" : "Reject"}
        danger={acting === "reject"}
        loading={actLoading}
      />

      <HrModal
        isOpen={adminApproveOpen}
        onClose={() => { setAdminApproveOpen(false); setAdminApproveReason(""); }}
        title="Admin Approved — Bypass Approval Chain"
        size="sm"
      >
        <div className="p-[20px] grid gap-3">
          <p className="text-[13px] text-[var(--muted)] m-0">
            This immediately approves the leave and marks every L1/L2 step "Bypassed by Admin" — no further approval
            is needed. The originally assigned approver stays on record; only who actually performed this bypass is
            recorded separately.
          </p>
          <HrField label="Reason" required>
            <HrTextarea
              value={adminApproveReason}
              onChange={(e) => setAdminApproveReason(e.target.value)}
              placeholder="e.g. Both normal approvers are unavailable."
              rows={3}
            />
          </HrField>
          <div className="flex justify-end gap-2 mt-1">
            <HrButton variant="ghost" onClick={() => { setAdminApproveOpen(false); setAdminApproveReason(""); }}>
              Cancel
            </HrButton>
            <HrButton
              variant="primary"
              onClick={() => void handleAdminApprove()}
              loading={adminApproveLoading}
              disabled={!adminApproveReason.trim()}
            >
              <Check size={14} /> Confirm Admin Approved
            </HrButton>
          </div>
        </div>
      </HrModal>
    </>
  );
}

// ─── Applications tab ─────────────────────────────────────────────────────────
function ApplicationsTab() {
  const [statusFilter, setStatusFilter] = useState("");
  const { data, loading, refetch } = useLeaveApplications({ status: statusFilter });
  const [viewing, setViewing] = useState<LeaveApplication | null>(null);

  const applications = data?.results ?? [];

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
                    <HrButton variant="icon" size="icon" onClick={() => setViewing(app)} title="View">
                      <Eye size={14} />
                    </HrButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LeaveDetailDrawer app={viewing} onClose={() => setViewing(null)} onActed={() => void refetch()} />
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
  const router = useRouter();
  const [tab, setTab] = useState<"applications" | "coverage">("applications");
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
            <HrButton variant="ghost" onClick={() => router.push("/hr/leave/setup")}>Configure Policy</HrButton>
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

      <ApplyOnBehalfModal
        isOpen={onBehalfOpen}
        onClose={() => setOnBehalfOpen(false)}
        onSaved={() => void refetchStats()}
      />
    </div>
  );
}