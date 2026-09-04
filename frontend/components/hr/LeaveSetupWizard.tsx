"use client";
/**
 * HR Leave Setup wizard — Leave Types, Entitlements, and Approval Chain.
 * Rendered as its own page (/hr/leave/setup) rather than a modal so that
 * modals opened from within it (Add Role, Govt Reference) are not nested
 * inside another modal's DOM tree.
 */
import { useEffect, useMemo, useState } from "react";
import { Plus, Check, X, ChevronRight, Landmark, Scale, Download, Trash2 } from "lucide-react";
import {
  HrButton, HrBadge, HrModal, HrField,
  HrInput, HrSelect, HrStepWizard,
  HrSkeleton, HrConfirmDialog, useHrToast,
} from "@/components/hr/HrUi";
import {
  useLeaveTypes, createLeaveType, updateLeaveType, deleteLeaveType,
  useApprovalChainPolicies, saveApprovalChainPolicy, deleteApprovalChainPolicy, useRoleCoverage,
  useAcademicYears, useRoles, useEntitlementMatrix, useDesignations, useAllDepartments,
  setEntitlementCell, addEntitlementRole, removeEntitlementRole, resetEntitlementDefaults,
} from "@/hooks/useHrApi";
import type { LeaveType, ApprovalChainPolicy, RoleOption } from "@/types/hr";
import { leaveTypeAbbrev, leaveTypeColor, leaveMetaLine } from "@/lib/hr/leaveTypeFormat";

const LEAVE_WIZARD_STEPS = [
  { label: "Leave Types",  hint: "Define categories" },
  { label: "Entitlements", hint: "Days per role" },
  { label: "Approval Chain", hint: "Who approves" },
];

// ─── Leave Types step — expandable rows, edited in place. "+ Add custom leave
// type" creates a row with sensible defaults immediately (no separate modal)
// and opens it for editing right away, matching the rest of this step's
// click-a-row-to-edit pattern. Fields are edited locally and committed in
// one PATCH via the Save Changes button. ───────────────────────────────────
const YES_NO = [{ v: false, l: "No" }, { v: true, l: "Yes" }] as const;

function YesNoSelect({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <HrSelect value={value ? "1" : "0"} onChange={(e) => onChange(e.target.value === "1")}>
      {YES_NO.map((o) => <option key={o.l} value={o.v ? "1" : "0"}>{o.l}</option>)}
    </HrSelect>
  );
}

function LeaveTypeRuleEditor({
  leaveType, onSaved, onDeleted,
}: {
  leaveType: LeaveType;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const { toast } = useHrToast();
  const [draft, setDraft] = useState({
    name: leaveType.name,
    is_paid: leaveType.is_paid,
    max_days_per_year: leaveType.max_days_per_year,
    can_carry_forward: leaveType.can_carry_forward,
    max_carry_forward_days: leaveType.max_carry_forward_days,
    max_encashment_days: leaveType.max_encashment_days,
    attachment_required: leaveType.attachment_required,
    minimum_notice_period: leaveType.minimum_notice_period,
    allow_half_day: leaveType.allow_half_day,
    is_govt_mandated: leaveType.is_govt_mandated,
    maximum_consecutive_days: leaveType.maximum_consecutive_days,
    is_active: leaveType.is_active,
  });
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof typeof draft>(k: K, v: (typeof draft)[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  const handleSave = async () => {
    if (draft.name.trim().length < 3) {
      toast("Leave name must be at least 3 characters", "error");
      return;
    }
    setSaving(true);
    try {
      await updateLeaveType(leaveType.id, { ...draft, name: draft.name.trim() });
      toast("Leave type saved");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update leave type", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteLeaveType(leaveType.id);
      toast("Leave type removed");
      onDeleted();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to remove leave type", "error");
    } finally {
      setDeleting(false);
      setDeleteOpen(false);
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HrField label="Leave Name">
          <HrInput value={draft.name} onChange={(e) => set("name", e.target.value)} />
        </HrField>
        <HrField
          label="Max Days / Year"
          hint="Maximum number of days allowed for this leave type according to the leave policy."
        >
          <HrInput
            type="number" min={0} value={draft.max_days_per_year}
            onChange={(e) => set("max_days_per_year", Number(e.target.value))}
          />
        </HrField>
        <HrField label="Paid Status">
          <YesNoSelectPaid value={draft.is_paid} onChange={(v) => set("is_paid", v)} />
        </HrField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HrField label="Carry Forward">
          <YesNoSelect value={draft.can_carry_forward} onChange={(v) => set("can_carry_forward", v)} />
        </HrField>
        <HrField label="Carry Max (days)">
          <HrInput
            type="number" min={0} value={draft.max_carry_forward_days} disabled={!draft.can_carry_forward}
            onChange={(e) => set("max_carry_forward_days", Number(e.target.value))}
          />
        </HrField>
        <HrField label="Encash (days)">
          <HrInput
            type="number" min={0} value={draft.max_encashment_days}
            onChange={(e) => set("max_encashment_days", Number(e.target.value))}
          />
        </HrField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HrField label="Proof Required">
          <HrSelect
            value={draft.attachment_required ? "1" : "0"}
            onChange={(e) => set("attachment_required", e.target.value === "1")}
          >
            <option value="0">Not required</option>
            <option value="1">Required</option>
          </HrSelect>
        </HrField>
        <HrField label="Notice (days)">
          <HrInput
            type="number" min={0} value={draft.minimum_notice_period}
            onChange={(e) => set("minimum_notice_period", Number(e.target.value))}
          />
        </HrField>
        <HrField label="Half-Day Allowed">
          <YesNoSelect value={draft.allow_half_day} onChange={(v) => set("allow_half_day", v)} />
        </HrField>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <HrField label="Statutory (Govt Mandated)">
          <YesNoSelect value={draft.is_govt_mandated} onChange={(v) => set("is_govt_mandated", v)} />
        </HrField>
        <HrField label="Max Consecutive Days (0 = unlimited)">
          <HrInput
            type="number" min={0} value={draft.maximum_consecutive_days}
            onChange={(e) => set("maximum_consecutive_days", Number(e.target.value))}
          />
        </HrField>
        <HrField label="Active">
          <YesNoSelect value={draft.is_active} onChange={(v) => set("is_active", v)} />
        </HrField>
      </div>
      <div className="flex justify-between">
        <HrButton variant="red" onClick={() => setDeleteOpen(true)}>
          <Trash2 size={14} /> Remove this type
        </HrButton>
        <HrButton variant="primary" onClick={() => void handleSave()} loading={saving}>
          Save Changes
        </HrButton>
      </div>

      <HrConfirmDialog
        isOpen={deleteOpen} onClose={() => setDeleteOpen(false)} onConfirm={() => void handleDelete()}
        title="Remove leave type?"
        message={`"${leaveType.name}" will be permanently removed. Built-in types and types already used by a leave request or entitlement can't be deleted — deactivate them instead.`}
        confirmLabel="Remove" danger loading={deleting}
      />
    </div>
  );
}

// Named distinctly from the generic Yes/No select since "Paid"/"Unpaid" reads
// better than "Yes"/"No" for this specific field.
function YesNoSelectPaid({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <HrSelect value={value ? "1" : "0"} onChange={(e) => onChange(e.target.value === "1")}>
      <option value="1">Paid</option>
      <option value="0">Unpaid</option>
    </HrSelect>
  );
}

function LeaveTypeRow({
  leaveType, index, isOpen, onToggle, onSaved, onDeleted,
}: {
  leaveType: LeaveType;
  index: number;
  isOpen: boolean;
  onToggle: () => void;
  onSaved: () => void;
  onDeleted: () => void;
}) {
  const isNew = leaveType.name === "New Leave Type";
  const abbrev = leaveTypeAbbrev(leaveType.name);
  const color = leaveTypeColor(abbrev, index);
  return (
    <div className="border border-[var(--line)] rounded-[10px] overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[#fafafa]"
      >
        {isNew ? (
          <HrBadge variant="purple">NEW</HrBadge>
        ) : (
          <span
            className="text-[10px] font-[900] px-2 py-1 rounded-[6px] flex-none"
            style={{ background: color.bg, color: color.fg }}
          >
            {abbrev}
          </span>
        )}
        <span className="font-[750] text-[13px] flex-none">{leaveType.name}</span>
        <HrBadge variant={leaveType.is_paid ? "green" : "grey"}>{leaveType.is_paid ? "Paid" : "Unpaid"}</HrBadge>
        {leaveType.is_govt_mandated && <HrBadge variant="blue">★ Gov</HrBadge>}
        <span className="text-[12px] text-[var(--muted)] flex-1 truncate">{leaveMetaLine(leaveType)}</span>
        <ChevronRight
          size={16} className="text-gray-400 flex-none transition-transform"
          style={{ transform: isOpen ? "rotate(90deg)" : "none" }}
        />
      </button>
      {isOpen && (
        <div className="border-t border-[#f1f5f9] p-4">
          <LeaveTypeRuleEditor leaveType={leaveType} onSaved={onSaved} onDeleted={onDeleted} />
        </div>
      )}
    </div>
  );
}

// ─── Government Leave & Benefit Reference ─────────────────────────────────────
interface GovtReferenceRow {
  id: string;
  label: string;
  baseline: string;
}

const GOVT_REFERENCE_DEFAULTS: GovtReferenceRow[] = [
  { id: "casual", label: "Casual Leave", baseline: "12 days / year" },
  { id: "sick", label: "Sick Leave", baseline: "12 days / year" },
  { id: "earned", label: "Earned / Annual Leave", baseline: "15 days after 240 days' service" },
  { id: "el_accum", label: "EL Accumulation", baseline: "Up to 60 days" },
  { id: "el_encash", label: "EL Encashment", baseline: "8 days / year" },
  { id: "holidays", label: "Paid Holidays", baseline: "State-notified national & festival holidays" },
  { id: "maternity", label: "Maternity Leave", baseline: "26 weeks (eligible women under Maternity Benefit Act)" },
  { id: "paternity", label: "Paternity Leave", baseline: "15 days (school policy — not statutory)" },
  { id: "comp_off", label: "Compensatory Off", baseline: "1 day for every notified holiday worked" },
];

const GOVT_REFERENCE_STORAGE_KEY = "eskoolia_hr_govt_reference_custom_rows";

function loadCustomReferenceRows(): GovtReferenceRow[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GOVT_REFERENCE_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as GovtReferenceRow[]) : [];
  } catch {
    return [];
  }
}

function saveCustomReferenceRows(rows: GovtReferenceRow[]) {
  try {
    window.localStorage.setItem(GOVT_REFERENCE_STORAGE_KEY, JSON.stringify(rows));
  } catch {
    // best-effort — private browsing / storage disabled
  }
}

function GovtReferenceModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { toast } = useHrToast();
  const [customRows, setCustomRows] = useState<GovtReferenceRow[]>([]);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) setCustomRows(loadCustomReferenceRows());
  }, [isOpen]);

  const addRow = () => {
    const next = [...customRows, { id: `custom-${Date.now()}`, label: "", baseline: "" }];
    setCustomRows(next);
    saveCustomReferenceRows(next);
  };

  const updateRow = (id: string, field: "label" | "baseline", value: string) => {
    const next = customRows.map((r) => (r.id === id ? { ...r, [field]: value } : r));
    setCustomRows(next);
    saveCustomReferenceRows(next);
  };

  const removeRow = (id: string) => {
    const next = customRows.filter((r) => r.id !== id);
    setCustomRows(next);
    saveCustomReferenceRows(next);
  };

  const handleDownloadPDF = async () => {
    setDownloading(true);
    try {
      const { jsPDF } = await import("jspdf");
      const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const PW = doc.internal.pageSize.getWidth();
      const M = 16;
      let y = M;

      doc.setFillColor(109, 74, 255);
      doc.rect(0, 0, PW, 18, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(13); doc.setFont("helvetica", "bold");
      doc.text("Government Leave & Benefit Reference", M, 12);
      y = 26;

      doc.setTextColor(90, 90, 100); doc.setFontSize(9); doc.setFont("helvetica", "normal");
      const introLines = doc.splitTextToSize(
        "Safe baseline reference - edit to match your school's policy. These values do not auto-apply to entitlements; use them as a guide.",
        PW - 2 * M,
      );
      doc.text(introLines, M, y);
      y += introLines.length * 4.5 + 6;

      const col2X = M + 80;
      doc.setFillColor(240, 240, 248); doc.rect(M, y, PW - 2 * M, 7, "F");
      doc.setTextColor(100, 103, 130); doc.setFontSize(8); doc.setFont("helvetica", "bold");
      doc.text("LEAVE / BENEFIT", M + 2, y + 5);
      doc.text("STATUTORY BASELINE", col2X + 2, y + 5);
      y += 12;

      doc.setFont("helvetica", "normal"); doc.setFontSize(9); doc.setTextColor(30, 30, 40);
      [...GOVT_REFERENCE_DEFAULTS, ...customRows].forEach((row) => {
        if (!row.label.trim() && !row.baseline.trim()) return;
        if (y > 275) { doc.addPage(); y = M; }
        const baselineLines = doc.splitTextToSize(row.baseline, PW - 2 * M - 82) as string[];
        doc.text(row.label, M + 2, y);
        doc.text(baselineLines, col2X + 2, y);
        y += Math.max(8, baselineLines.length * 4.5);
        doc.setDrawColor(232, 232, 238); doc.line(M, y - 4, PW - M, y - 4);
      });

      y += 4;
      if (y > 255) { doc.addPage(); y = M; }
      const disclaimerLines = doc.splitTextToSize(
        "This is informational guidance based on AP/Telangana norms at time of writing. Leave law changes frequently. Verify all entitlements against the latest notifications on official government websites before finalising your school's leave policy. Eskoolia is not liable for any errors or omissions in this reference data.",
        PW - 2 * M - 6,
      ) as string[];
      doc.setFillColor(255, 251, 235); doc.rect(M, y, PW - 2 * M, 9 + disclaimerLines.length * 4, "F");
      doc.setTextColor(146, 108, 15); doc.setFontSize(7.5); doc.setFont("helvetica", "bold");
      doc.text("For reference only.", M + 3, y + 5);
      doc.setFont("helvetica", "normal");
      doc.text(disclaimerLines, M + 3, y + 9);

      doc.save("govt-leave-benefit-reference.pdf");
    } catch {
      toast("Failed to generate PDF", "error");
    } finally {
      setDownloading(false);
    }
  };

  return (
    <HrModal isOpen={isOpen} onClose={onClose} title="" size="md">
      <div className="flex items-center justify-between gap-3 p-[18px_20px] border-b border-[var(--line)]">
        <div className="flex items-center gap-2">
          <Scale size={18} />
          <h2 className="m-0 text-[17px] font-[900]">Government Leave &amp; Benefit Reference</h2>
        </div>
        <button
          onClick={onClose}
          className="w-[28px] h-[28px] flex-none border border-[var(--line)] rounded-[8px] bg-white text-gray-500 flex items-center justify-center hover:bg-[var(--soft)] hover:text-[var(--brand)]"
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-[18px_20px]">
        <p className="m-0 mb-4 text-[13px] text-[var(--muted)]">
          Safe baseline reference — edit to match your school&apos;s policy. These values do not auto-apply to
          entitlements; use them as a guide when filling Step 2.
        </p>

        <div className="max-h-[360px] overflow-y-auto -mx-1 px-1">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-white">
              <tr className="text-[11px] uppercase text-[#64748b] tracking-[0.06em] border-b border-[var(--line)]">
                <th className="px-2 py-2 text-left">Leave / Benefit</th>
                <th className="px-2 py-2 text-left">Statutory Baseline</th>
                <th className="w-6" />
              </tr>
            </thead>
            <tbody>
              {GOVT_REFERENCE_DEFAULTS.map((row) => (
                <tr key={row.id} className="border-b border-[#f4f4f8]">
                  <td className="px-2 py-3 text-[13px] font-[600]">{row.label}</td>
                  <td className="px-2 py-3 text-[13px] text-[#374151]">{row.baseline}</td>
                  <td />
                </tr>
              ))}
              {customRows.map((row) => (
                <tr key={row.id} className="border-b border-[#f4f4f8] group">
                  <td className="px-2 py-2">
                    <input
                      value={row.label} placeholder="Leave / benefit name"
                      onChange={(e) => updateRow(row.id, "label", e.target.value)}
                      className="w-full text-[13px] font-[600] border-0 outline-none bg-transparent focus:bg-[var(--soft)] rounded px-1 py-1"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={row.baseline} placeholder="Statutory baseline"
                      onChange={(e) => updateRow(row.id, "baseline", e.target.value)}
                      className="w-full text-[13px] text-[#374151] border-0 outline-none bg-transparent focus:bg-[var(--soft)] rounded px-1 py-1"
                    />
                  </td>
                  <td className="px-1">
                    <button
                      type="button" onClick={() => removeRow(row.id)}
                      className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500"
                      aria-label="Remove row"
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button" onClick={addRow}
          className="w-full mt-3 py-2.5 border border-dashed border-[var(--line)] rounded-[10px] text-[13px] font-[700] text-[var(--brand)] hover:bg-[var(--soft)]"
        >
          + Add row
        </button>

        <div className="mt-4 flex items-start gap-2 text-[12px] text-[#92400e] bg-[#fffbeb] border border-[#fde68a] rounded-[10px] p-3">
          <span>ⓘ</span>
          <span>
            <strong>For reference only.</strong> This is informational guidance based on AP/Telangana norms at
            time of writing. Leave law changes frequently. Please verify all entitlements against the latest
            notifications on official government websites before finalising your school&apos;s leave policy.
            Eskoolia is not liable for any errors or omissions in this reference data.
          </span>
        </div>

        <div className="flex justify-end gap-2 mt-4 pt-3 border-t border-[#f1f5f9]">
          <HrButton variant="ghost" onClick={() => void handleDownloadPDF()} loading={downloading}>
            <Download size={14} /> Download PDF
          </HrButton>
          <HrButton variant="primary" onClick={onClose}>Done</HrButton>
        </div>
      </div>
    </HrModal>
  );
}

function LeaveTypesStep({ onNext }: { onNext: () => void }) {
  const { toast } = useHrToast();
  const { data, loading, refetch } = useLeaveTypes();
  // Alphabetical, except a just-added, not-yet-renamed row ("New Leave
  // Type") is pinned to the end instead of sorting wherever "N" happens to
  // fall — so a new row always lands where you'd look for it, and once
  // renamed it takes its normal alphabetical place on the next refetch.
  const leaveTypes = useMemo(() => {
    const list = data?.results ?? [];
    return [...list].sort((a, b) => {
      const aNew = a.name === "New Leave Type";
      const bNew = b.name === "New Leave Type";
      if (aNew !== bNew) return aNew ? 1 : -1;
      return a.name.localeCompare(b.name);
    });
  }, [data]);
  const [govtRefOpen, setGovtRefOpen] = useState(false);
  const [openId, setOpenId] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);

  const handleAddCustomType = async () => {
    setAdding(true);
    try {
      const created = await createLeaveType({
        name: "New Leave Type", is_paid: true, max_days_per_year: 12,
        allow_half_day: true, minimum_notice_period: 1, can_carry_forward: false,
      });
      await refetch();
      setOpenId(created.id);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add leave type", "error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="bg-white border border-[var(--line)] rounded-[14px] p-[24px_28px]" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex justify-between items-start mb-1 gap-4">
        <div>
          <h2 className="m-0 text-[20px] font-[800]" style={{ fontFamily: "var(--serif)" }}>Leave Types</h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Click any row to expand and edit its rules</p>
        </div>
        <div className="flex items-center gap-2 flex-none">
          <span className="text-[12px] text-[var(--muted)] font-[650] whitespace-nowrap">{leaveTypes.length} types defined</span>
          <HrButton variant="ghost" onClick={() => setGovtRefOpen(true)}>
            <Landmark size={14} /> Govt Reference
          </HrButton>
        </div>
      </div>

      {loading ? <HrSkeleton rows={4} /> : leaveTypes.length === 0 ? (
        <div className="py-10 text-center text-[var(--muted)]">No leave types yet.</div>
      ) : (
        <div className="grid gap-2.5 mt-4">
          {leaveTypes.map((lt, i) => (
            <LeaveTypeRow
              key={lt.id} leaveType={lt} index={i}
              isOpen={openId === lt.id}
              onToggle={() => setOpenId((cur) => (cur === lt.id ? null : lt.id))}
              onSaved={() => void refetch()}
              onDeleted={() => { setOpenId(null); void refetch(); }}
            />
          ))}
        </div>
      )}

      <div className="flex justify-center mt-4">
        <HrButton
          variant="ghost" onClick={() => void handleAddCustomType()} loading={adding}
          className="w-full border-dashed justify-center"
        >
          <Plus size={14} /> Add custom leave type
        </HrButton>
      </div>

      <div className="mt-4 flex items-start gap-2 text-[12px] text-[var(--muted)] bg-[#fafafa] border border-[var(--line)] rounded-[10px] p-3">
        <span>ⓘ</span>
        <span><strong>Reference only</strong> — verify AP/Telangana government mandates with legal counsel before publishing.</span>
      </div>

      <div className="flex justify-end mt-4">
        <HrButton variant="primary" onClick={onNext}>Entitlements →</HrButton>
      </div>

      <GovtReferenceModal isOpen={govtRefOpen} onClose={() => setGovtRefOpen(false)} />
    </div>
  );
}

// ─── Entitlements step ─────────────────────────────────────────────────────────
function EntitlementCell({
  value, onSave,
}: {
  value: number | undefined;
  onSave: (days: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value ?? 0));
  const [saving, setSaving] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => { setDraft(String(value ?? 0)); setEditing(true); }}
        className="w-[52px] h-[30px] rounded-[7px] text-[13px] font-[700] hover:bg-[var(--soft)]"
      >
        {value === undefined ? <span className="text-gray-300">—</span> : value}
      </button>
    );
  }

  const commit = async () => {
    setSaving(true);
    const parsed = Math.max(0, Math.min(366, Number(draft) || 0));
    await onSave(parsed);
    setSaving(false);
    setEditing(false);
  };

  return (
    <input
      autoFocus type="number" min={0} max={366} disabled={saving}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => void commit()}
      onKeyDown={(e) => {
        if (e.key === "Enter") void commit();
        if (e.key === "Escape") setEditing(false);
      }}
      className="w-[52px] h-[30px] rounded-[7px] border border-[var(--brand)] text-[13px] font-[700] text-center outline-none"
    />
  );
}

function AddRoleModal({
  isOpen, onClose, roles, allRolesCount, rolesLoading, rolesError, onRetry, onPick, busy,
}: {
  isOpen: boolean;
  onClose: () => void;
  roles: { id: number; name: string }[];
  allRolesCount: number;
  rolesLoading: boolean;
  rolesError: string | null;
  onRetry: () => void;
  onPick: (roleId: number) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState<string>("");
  return (
    <HrModal isOpen={isOpen} onClose={onClose} title="Add Role Column" size="sm">
      <div className="p-[20px] grid gap-4">
        {rolesLoading ? (
          <div className="text-[13px] text-[var(--muted)]">Loading roles…</div>
        ) : rolesError ? (
          <div className="text-[13px] text-[var(--red)]">
            {rolesError}{" "}
            <button type="button" onClick={onRetry} className="underline font-[700]">Retry</button>
          </div>
        ) : allRolesCount === 0 ? (
          <div className="text-[13px] text-[var(--muted)]">
            No roles configured for your school yet — add roles under Access Control &gt; Roles first.
          </div>
        ) : roles.length === 0 ? (
          <div className="text-[13px] text-[var(--muted)]">All active roles already have an entitlement column.</div>
        ) : (
          <HrField label="Role">
            <HrSelect value={selected} onChange={(e) => setSelected(e.target.value)}>
              <option value="">Select a role…</option>
              {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </HrSelect>
          </HrField>
        )}
        <div className="flex justify-end gap-2">
          <HrButton variant="ghost" onClick={onClose}>Cancel</HrButton>
          <HrButton
            variant="primary" disabled={!selected} loading={busy}
            onClick={() => selected && onPick(Number(selected))}
          >
            Add
          </HrButton>
        </div>
      </div>
    </HrModal>
  );
}

function EntitlementsStep({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  const { toast } = useHrToast();
  const { data: ayData, loading: ayLoading, error: ayError, refetch: refetchAy } = useAcademicYears();
  const years = useMemo(() => ayData?.results ?? [], [ayData]);
  const [academicYearId, setAcademicYearId] = useState<number | null>(null);

  useEffect(() => {
    if (academicYearId === null && years.length > 0) {
      const current = years.find((y) => y.is_current) ?? years[0];
      setAcademicYearId(current.id);
    }
  }, [years, academicYearId]);

  const { data: matrixResp, loading: matrixLoading, error: matrixError, refetch: refetchMatrix } = useEntitlementMatrix(academicYearId);
  const matrix = matrixResp?.data ?? null;

  const { data: rolesData, loading: rolesLoading, error: rolesError, refetch: refetchRoles } = useRoles();
  const allRoles = useMemo(() => (rolesData?.results ?? []).filter((r) => r.is_active), [rolesData]);
  const usedRoleIds = useMemo(
    () => new Set((matrix?.columns ?? []).map((c) => c.role_id).filter((id): id is number => id !== null)),
    [matrix],
  );
  const availableRoles = useMemo(
    () => allRoles.filter((r) => !usedRoleIds.has(r.id)),
    [allRoles, usedRoleIds],
  );

  const [addRoleOpen, setAddRoleOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleSetCell = async (leaveTypeId: number, colKey: string, days: number) => {
    if (!academicYearId) return;
    const roleId = colKey === "all_staff" ? null : Number(colKey.split(":")[1]);
    try {
      await setEntitlementCell({ leave_type: leaveTypeId, role: roleId, academic_year: academicYearId, days });
      void refetchMatrix();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to update entitlement", "error");
    }
  };

  const handleAddRole = async (roleId: number) => {
    if (!academicYearId) return;
    setBusy(true);
    try {
      await addEntitlementRole({ role: roleId, academic_year: academicYearId });
      toast("Role added to entitlement matrix");
      void refetchMatrix();
      setAddRoleOpen(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add role", "error");
    } finally { setBusy(false); }
  };

  const handleRemoveRole = async (roleId: number | null) => {
    if (!academicYearId) return;
    try {
      await removeEntitlementRole({ role: roleId, academic_year: academicYearId });
      toast("Column removed");
      void refetchMatrix();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to remove column", "error");
    }
  };

  const handleReset = async () => {
    if (!academicYearId) return;
    setBusy(true);
    try {
      await resetEntitlementDefaults({ academic_year: academicYearId });
      toast("Entitlements reset to defaults");
      void refetchMatrix();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to reset entitlements", "error");
    } finally { setBusy(false); }
  };

  return (
    <div className="bg-white border border-[var(--line)] rounded-[14px] p-[24px_28px]" style={{ boxShadow: "var(--shadow)" }}>
      <div className="flex justify-between items-start mb-1 gap-4">
        <div>
          <h2 className="m-0 text-[20px] font-[800]" style={{ fontFamily: "var(--serif)" }}>Entitlements by Role</h2>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Click any cell to edit. — = not entitled. Roles can be added or removed.</p>
          <p className="mt-1 text-[12px] text-[var(--muted)]">
            Each cell is the number of days granted to that role for this leave type during the academic year —
            this may be different from the maximum allowed by the leave policy.
          </p>
        </div>
        <div className="flex gap-2 flex-none">
          <HrButton variant="ghost" onClick={() => setAddRoleOpen(true)}><Plus size={14} /> Add role</HrButton>
          <HrButton variant="ghost" onClick={() => void handleReset()} loading={busy}>Reset defaults</HrButton>
        </div>
      </div>

      {ayLoading ? (
        <HrSkeleton rows={4} />
      ) : ayError ? (
        <div className="py-10 text-center text-[var(--red)] text-[13px]">
          {ayError}{" "}
          <button type="button" onClick={() => void refetchAy()} className="underline font-[700]">Retry</button>
        </div>
      ) : years.length === 0 ? (
        <div className="py-10 text-center text-[var(--muted)]">
          No academic year configured yet — set one up under Academics &gt; Academic Year before configuring entitlements.
        </div>
      ) : matrixLoading ? (
        <HrSkeleton rows={4} />
      ) : matrixError ? (
        <div className="py-10 text-center text-[var(--red)] text-[13px]">
          {matrixError}{" "}
          <button type="button" onClick={() => void refetchMatrix()} className="underline font-[700]">Retry</button>
        </div>
      ) : !matrix ? (
        <div className="py-10 text-center text-[var(--muted)]">No entitlement data available.</div>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full border-collapse">
            <thead>
              <tr className="text-[11px] uppercase text-[#64748b] tracking-[0.06em] border-b border-[var(--line)]">
                <th className="px-2 py-2 text-left">Leave Type</th>
                {matrix.columns.map((col) => (
                  <th key={col.key} className="px-3 py-2 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      {col.name}
                      {col.removable && (
                        <button
                          type="button" onClick={() => void handleRemoveRole(col.role_id)}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={`Remove ${col.name} column`}
                        >
                          <X size={11} />
                        </button>
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((row, i) => {
                const abbrev = leaveTypeAbbrev(row.leave_type.name);
                const color = leaveTypeColor(abbrev, i);
                return (
                  <tr key={row.leave_type.id} className="border-b border-[#f4f4f8]">
                    <td className="px-2 py-2.5">
                      <span className="inline-flex items-center gap-2 whitespace-nowrap">
                        <span className="w-2 h-2 rounded-full flex-none" style={{ background: color.fg }} />
                        <span className="font-[650] text-[13px]">{row.leave_type.name}</span>
                        {row.leave_type.is_govt_mandated && <span className="text-[var(--brand)] text-[12px]">★</span>}
                      </span>
                    </td>
                    {matrix.columns.map((col) => (
                      <td key={col.key} className="px-3 py-2 text-right">
                        <EntitlementCell
                          value={row.entitlements[col.key]}
                          onSave={(days) => handleSetCell(row.leave_type.id, col.key, days)}
                        />
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex flex-wrap gap-x-5 gap-y-1 mt-4 text-[11px] text-[var(--muted)]">
        <span>✓ at/above statutory min</span>
        <span>⚠ below statutory min</span>
        <span>— = not entitled</span>
        <span>★ = govt mandated type</span>
      </div>

      {years.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 mt-4">
          <span className="text-[12px] font-[700] text-[#374151] whitespace-nowrap">Academic Year:</span>
          <span className="inline-block w-[220px]">
            <HrSelect value={academicYearId ?? ""} onChange={(e) => setAcademicYearId(Number(e.target.value))}>
              {years.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
            </HrSelect>
          </span>
          <span className="text-[11px] text-[var(--muted)]">(Leave balances reset at the start of each academic year)</span>
        </div>
      )}

      <div className="flex justify-between mt-5">
        <HrButton variant="ghost" onClick={onBack}>← Back</HrButton>
        <HrButton variant="primary" onClick={onNext}>Approval Chain →</HrButton>
      </div>

      <AddRoleModal
        isOpen={addRoleOpen} onClose={() => setAddRoleOpen(false)}
        roles={availableRoles} allRolesCount={allRoles.length}
        rolesLoading={rolesLoading} rolesError={rolesError} onRetry={() => void refetchRoles()}
        busy={busy}
        onPick={(id) => void handleAddRole(id)}
      />
    </div>
  );
}

// ─── Approval Chain step ───────────────────────────────────────────────────────
type ChainRuleDraft = {
  l1_approver_role: number | null;
  l2_approver_role: number | null;
  l2_trigger_days: number;
  response_window_days: number;
  is_active: boolean;
};

function draftFromPolicy(p: ApprovalChainPolicy): ChainRuleDraft {
  return {
    l1_approver_role: p.l1_approver_role,
    l2_approver_role: p.l2_approver_role,
    l2_trigger_days: p.l2_trigger_days,
    response_window_days: p.response_window_days,
    is_active: p.is_active,
  };
}

function draftsEqual(a: ChainRuleDraft, b: ChainRuleDraft) {
  return a.l1_approver_role === b.l1_approver_role && a.l2_approver_role === b.l2_approver_role
    && a.l2_trigger_days === b.l2_trigger_days && a.response_window_days === b.response_window_days
    && a.is_active === b.is_active;
}

function ChainRuleFields({
  draft, onChange, roles, roleLabel, unresolvedWarning,
}: {
  draft: ChainRuleDraft;
  onChange: (patch: Partial<ChainRuleDraft>) => void;
  roles: RoleOption[];
  roleLabel: (r: { id: number; name: string }) => string;
  unresolvedWarning: (roleId: number | null) => string | null;
}) {
  return (
    <>
      <td className="px-2 py-3 align-top">
        <HrSelect
          value={draft.l1_approver_role ?? ""}
          onChange={(e) => onChange({ l1_approver_role: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">Use Reporting Manager only</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{roleLabel(r)}</option>)}
        </HrSelect>
        {unresolvedWarning(draft.l1_approver_role) && (
          <div className="mt-1.5 text-[11px] text-[var(--amber)] max-w-[220px]">{unresolvedWarning(draft.l1_approver_role)}</div>
        )}
      </td>
      <td className="px-2 py-3 align-top">
        <HrSelect
          value={draft.l2_approver_role ?? ""}
          onChange={(e) => onChange({ l2_approver_role: e.target.value ? Number(e.target.value) : null })}
        >
          <option value="">-</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{roleLabel(r)}</option>)}
        </HrSelect>
        {unresolvedWarning(draft.l2_approver_role) && (
          <div className="mt-1.5 text-[11px] text-[var(--amber)] max-w-[220px]">{unresolvedWarning(draft.l2_approver_role)}</div>
        )}
      </td>
      <td className="px-2 py-3 align-top">
        <HrInput
          type="number" min={0} className="w-[80px]"
          value={draft.l2_trigger_days}
          onChange={(e) => onChange({ l2_trigger_days: Number(e.target.value) })}
        />
        <div className="mt-1.5 text-[11px] text-[var(--muted)] max-w-[140px]">
          {draft.l2_trigger_days === 0
            ? "0 = L2 is disabled — it will never trigger."
            : `L2 required for leaves of ${draft.l2_trigger_days}+ day${draft.l2_trigger_days === 1 ? "" : "s"}.`}
        </div>
      </td>
      <td className="px-2 py-3 align-top">
        <HrSelect
          value={String(draft.response_window_days)}
          onChange={(e) => onChange({ response_window_days: Number(e.target.value) })}
        >
          {[1, 2, 3, 5, 7].map((n) => <option key={n} value={n}>{n} day{n > 1 ? "s" : ""}</option>)}
        </HrSelect>
      </td>
      <td className="px-2 py-3 align-top">
        <button
          type="button"
          onClick={() => onChange({ is_active: !draft.is_active })}
          className="text-[11px] font-[700] px-2.5 py-1 rounded-full"
          style={draft.is_active
            ? { background: "var(--green-soft, #ecfdf5)", color: "var(--green, #059669)" }
            : { background: "#f1f5f9", color: "#64748b" }}
        >
          {draft.is_active ? "Active" : "Inactive"}
        </button>
      </td>
    </>
  );
}

function ApprovalChainRuleRow({
  policy, roles, roleLabel, unresolvedWarning, onChanged,
}: {
  policy: ApprovalChainPolicy;
  roles: RoleOption[];
  roleLabel: (r: { id: number; name: string }) => string;
  unresolvedWarning: (roleId: number | null) => string | null;
  onChanged: () => void;
}) {
  const { toast } = useHrToast();
  const [draft, setDraft] = useState<ChainRuleDraft>(() => draftFromPolicy(policy));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const dirty = !draftsEqual(draft, draftFromPolicy(policy));
  const deletable = policy.designation !== null || policy.department !== null;

  const save = async () => {
    setSaving(true);
    try {
      await saveApprovalChainPolicy(policy.id, draft);
      toast("Rule saved");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to save rule", "error");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setDeleting(true);
    try {
      await deleteApprovalChainPolicy(policy.id);
      toast("Rule removed");
      onChanged();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to remove rule", "error");
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <tr className="border-t border-[var(--line)]">
      <td className="px-2 py-3 font-[750] align-top">
        {policy.designation_name}
        <div className="text-[11px] text-[var(--muted)] font-[500]">{policy.department_name}</div>
      </td>
      <ChainRuleFields draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} roles={roles} roleLabel={roleLabel} unresolvedWarning={unresolvedWarning} />
      <td className="px-2 py-3 align-top">
        <div className="flex items-center gap-1.5">
          <HrButton variant="primary" onClick={() => void save()} loading={saving} disabled={!dirty}>
            <Check size={13} /> Save
          </HrButton>
          {deletable && (
            <button
              type="button"
              title="Remove rule"
              onClick={() => setConfirmOpen(true)}
              className="w-7 h-7 rounded-[8px] border border-[var(--line)] text-[var(--red)] flex items-center justify-center"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </td>
      <HrConfirmDialog
        isOpen={confirmOpen} onClose={() => setConfirmOpen(false)} onConfirm={() => void remove()}
        title="Remove this rule?"
        message={`Staff matching "${policy.designation_name} / ${policy.department_name}" will fall back to the next-most-general rule (or "All Staff" if none matches).`}
        confirmLabel="Remove" danger loading={deleting}
      />
    </tr>
  );
}

function AddChainRuleRow({ roles, roleLabel, unresolvedWarning, onAdded, onCancel }: {
  roles: RoleOption[];
  roleLabel: (r: { id: number; name: string }) => string;
  unresolvedWarning: (roleId: number | null) => string | null;
  onAdded: () => void;
  onCancel: () => void;
}) {
  const { toast } = useHrToast();
  const [designationId, setDesignationId] = useState<number | "">("");
  const [departmentId, setDepartmentId] = useState<number | "">("");
  const { data: designationData } = useDesignations(departmentId || undefined);
  const designations = designationData?.results ?? [];
  const { data: departmentData } = useAllDepartments();
  const departments = departmentData?.results ?? [];
  const [draft, setDraft] = useState<ChainRuleDraft>({
    l1_approver_role: null, l2_approver_role: null, l2_trigger_days: 3, response_window_days: 2, is_active: true,
  });
  const [saving, setSaving] = useState(false);

  const create = async () => {
    if (!designationId) {
      toast("Pick a designation for this rule", "error");
      return;
    }
    setSaving(true);
    try {
      await saveApprovalChainPolicy(null, {
        designation: designationId, department: departmentId || null, ...draft,
      });
      toast("Rule added");
      onAdded();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to add rule", "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <tr className="border-t border-[var(--line)] bg-[#fafafa]">
      <td className="px-2 py-3 align-top">
        <HrSelect value={designationId} onChange={(e) => setDesignationId(e.target.value ? Number(e.target.value) : "")}>
          <option value="">Select designation…</option>
          {designations.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </HrSelect>
        <HrSelect className="mt-1.5" value={departmentId} onChange={(e) => {
          setDepartmentId(e.target.value ? Number(e.target.value) : "");
          setDesignationId("");
        }}>
          <option value="">All Departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </HrSelect>
      </td>
      <ChainRuleFields draft={draft} onChange={(patch) => setDraft((d) => ({ ...d, ...patch }))} roles={roles} roleLabel={roleLabel} unresolvedWarning={unresolvedWarning} />
      <td className="px-2 py-3 align-top">
        <div className="flex items-center gap-1.5">
          <HrButton variant="primary" onClick={() => void create()} loading={saving}>
            <Check size={13} /> Add
          </HrButton>
          <HrButton variant="ghost" onClick={onCancel}>Cancel</HrButton>
        </div>
      </td>
    </tr>
  );
}

function ApprovalChainStep({ onBack }: { onBack: () => void }) {
  const { data: policyData, loading: policyLoading, refetch: refetchPolicies } = useApprovalChainPolicies();
  const policies = policyData?.results ?? [];
  const sortedPolicies = useMemo(() => {
    return [...policies].sort((a, b) => {
      if (a.designation === null && a.department === null) return -1;
      if (b.designation === null && b.department === null) return 1;
      return a.designation_name.localeCompare(b.designation_name) || a.department_name.localeCompare(b.department_name);
    });
  }, [policies]);
  const { data: rolesData, loading: rolesLoading, error: rolesError, refetch: refetchRoles } = useRoles();
  const roles = useMemo(() => (rolesData?.results ?? []).filter((r) => r.is_active), [rolesData]);
  const { data: coverageData } = useRoleCoverage();
  const coverageByRoleId = useMemo(() => {
    const map = new Map<number, boolean>();
    for (const entry of coverageData?.roles ?? []) map.set(entry.id, entry.resolvable);
    return map;
  }, [coverageData]);
  const roleLabel = (r: { id: number; name: string }) =>
    coverageByRoleId.get(r.id) === false ? `${r.name} (⚠ no matching staff)` : r.name;
  const unresolvedWarning = (roleId: number | null) => {
    if (roleId === null) return null;
    if (coverageByRoleId.get(roleId) !== false) return null;
    const name = roles.find((r) => r.id === roleId)?.name ?? "this role";
    return `⚠ No active staff currently hold a Designation matching "${name}" — this step will be left unassigned until someone does (an admin can still approve it directly).`;
  };
  const [addingRule, setAddingRule] = useState(false);

  return (
    <div className="bg-white border border-[var(--line)] rounded-[14px] p-[24px_28px]" style={{ boxShadow: "var(--shadow)" }}>
      <h2 className="m-0 text-[20px] font-[800]" style={{ fontFamily: "var(--serif)" }}>Approval Chain of Command</h2>
      <p className="mt-1 mb-4 text-[13px] text-[var(--muted)]">
        Add a rule per designation (optionally scoped to a department) for who approves at L1/L2 — the most specific
        matching rule wins, falling back to "All Designations / All Departments". If a staff member has a{" "}
        <strong>Reporting Manager</strong> set on their profile, that person is used as L1 (and their own manager as
        L2) instead of guessing by role — the rule below only applies when no Reporting Manager is set.
      </p>
      {rolesError && (
        <div className="mb-3 text-[12px] text-[var(--red)]">
          {rolesError}{" "}
          <button type="button" onClick={() => void refetchRoles()} className="underline font-[700]">Retry</button>
        </div>
      )}
      {policyLoading || rolesLoading ? <HrSkeleton rows={1} /> : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="text-[11px] uppercase text-[#64748b] tracking-[0.06em]">
              <th className="px-2 py-2 text-left">Designation / Department</th>
              <th className="px-2 py-2 text-left">L1 Approver</th>
              <th className="px-2 py-2 text-left">L2 Approver</th>
              <th className="px-2 py-2 text-left">L2 triggers after (days)</th>
              <th className="px-2 py-2 text-left">Response window</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left"></th>
            </tr>
          </thead>
          <tbody>
            {sortedPolicies.map((policy) => (
              <ApprovalChainRuleRow
                key={policy.id} policy={policy} roles={roles} roleLabel={roleLabel}
                unresolvedWarning={unresolvedWarning} onChanged={() => void refetchPolicies()}
              />
            ))}
            {addingRule && (
              <AddChainRuleRow
                roles={roles} roleLabel={roleLabel} unresolvedWarning={unresolvedWarning}
                onAdded={() => { setAddingRule(false); void refetchPolicies(); }}
                onCancel={() => setAddingRule(false)}
              />
            )}
          </tbody>
        </table>
      )}
      {!addingRule && (
        <button
          type="button"
          onClick={() => setAddingRule(true)}
          className="mt-3 text-[12.5px] font-[700] text-[var(--pu)] flex items-center gap-1"
        >
          <Plus size={14} /> Add Rule
        </button>
      )}
      <div className="mt-4 flex items-start gap-2 text-[12px] text-[var(--muted)] bg-[#fafafa] border border-[var(--line)] rounded-[10px] p-3">
        <span>ⓘ</span>
        <span><strong>Admin override:</strong> If both L1 and L2 approvers are unavailable, HR Admin can approve directly with a note. This is automatically logged.</span>
      </div>
      <div className="flex justify-between mt-5">
        <HrButton variant="ghost" onClick={onBack}>← Back</HrButton>
      </div>
    </div>
  );
}

// ─── Setup Wizard (relocated behind "Configure Policy") ───────────────────────
export function LeaveSetupWizard({ onClose }: { onClose: () => void }) {
  const [wizardStep, setWizardStep] = useState(1);

  return (
    <div
      className="bg-white border border-[var(--line)] rounded-[16px] overflow-hidden max-w-[1400px] mx-auto"
      style={{ boxShadow: "var(--shadow)" }}
    >
      <div className="flex items-start justify-between gap-4 p-[20px_24px] border-b border-[var(--line)]">
        <div>
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--muted)] font-[700]">One-time configuration</div>
          <h1 className="m-0 text-[26px] font-[900] leading-tight" style={{ fontFamily: "var(--serif)" }}>
            Leave <span className="italic text-[var(--brand)]">Setup</span>
          </h1>
          <p className="m-0 mt-1 text-[13px] text-[var(--muted)]">
            Define types, entitlements, and approval chains. Update anytime if policy changes.
          </p>
        </div>
        <HrButton variant="ghost" onClick={onClose} className="flex-none">
          <X size={14} /> Close Setup
        </HrButton>
      </div>

      <div className="p-[20px_24px]">
        <div className="mb-6">
          <HrStepWizard steps={LEAVE_WIZARD_STEPS} currentStep={wizardStep} onStepClick={setWizardStep} />
        </div>

        {wizardStep === 1 && <LeaveTypesStep onNext={() => setWizardStep(2)} />}
        {wizardStep === 2 && <EntitlementsStep onBack={() => setWizardStep(1)} onNext={() => setWizardStep(3)} />}
        {wizardStep === 3 && <ApprovalChainStep onBack={() => setWizardStep(2)} />}
      </div>
    </div>
  );
}
