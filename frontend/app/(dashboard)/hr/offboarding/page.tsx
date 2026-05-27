"use client";
/**
 * HR Offboarding — Exit form (accordion) + handover checklist + ex-staff directory.
 */
import { useState } from "react";
import { Plus, Check, X, ChevronDown, ChevronRight, Search, User } from "lucide-react";
import {
  HrButton, HrBadge, HrKpiCard, HrField, HrInput, HrSelect,
  HrTextarea, HrHero, HrSkeleton, HrConfirmDialog, HrAccordion,
  useHrToast,
} from "@/components/hr/HrUi";
import { useOffboarding, createOffboarding, completeOffboarding } from "@/hooks/useHrApi";
import type { OffboardingRecord } from "@/types/hr";

const EXIT_REASONS = [
  "Resignation", "Retirement", "Contract End", "Dismissal",
  "Redundancy", "Death", "Mutual Agreement", "Other",
] as const;

const DOCS_TO_ISSUE = [
  "Experience Letter", "Relieving Letter", "Salary Certificate",
  "NOC (No Objection Certificate)", "Pension Statement",
] as const;

const DEFAULT_CHECKLIST = [
  "ID card returned", "Access revoked (email, system)", "Device returned",
  "Keys returned", "Files/documents handed over", "Pending tasks documented",
  "Knowledge transfer session completed", "NOC obtained from Finance",
  "NOC obtained from Library", "NOC obtained from IT", "Insurance deregistered",
  "Exit interview completed",
];

const FINANCIAL_ITEMS = [
  "Final salary processed", "Leave encashment calculated",
  "Gratuity (if applicable)", "Tax computation (Form H)", "Arrears cleared",
];

// ─── Exit Form ────────────────────────────────────────────────────────────────
function ExitForm({ onSubmit }: { onSubmit: (data: Partial<OffboardingRecord>) => Promise<void> }) {
  const [open, setOpen] = useState(true);
  const { toast } = useHrToast();
  const [saving, setSaving] = useState(false);
  const [checklist, setChecklist] = useState<Record<string, boolean>>(
    Object.fromEntries(DEFAULT_CHECKLIST.map((c) => [c, false]))
  );
  const [financials, setFinancials] = useState<Record<string, boolean>>(
    Object.fromEntries(FINANCIAL_ITEMS.map((f) => [f, false]))
  );
  const [docs, setDocs] = useState<Record<string, boolean>>(
    Object.fromEntries(DOCS_TO_ISSUE.map((d) => [d, false]))
  );
  const [form, setForm] = useState<Partial<OffboardingRecord>>({
    exit_reason: "Resignation",
    last_working_date: "",
    notice_period_days: 30,
    exit_interview_notes: "",
  });

  const set = (k: keyof OffboardingRecord, v: unknown) => setForm((f) => ({ ...f, [k]: v }));

  const handleSave = async () => {
    if (!form.staff || !form.last_working_date) {
      toast("Staff ID and last working date are required", "error"); return;
    }
    setSaving(true);
    try {
      await onSubmit({
        ...form,
        handover_checklist: checklist,
        financial_clearance: financials,
        documents_to_issue: Object.keys(docs).filter((k) => docs[k]),
      });
      toast("Exit record submitted");
    } catch { toast("Failed to save exit record", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="bg-white border border-[var(--line)] rounded-[14px] overflow-hidden mb-4" style={{ boxShadow: "var(--shadow)" }}>
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center gap-3 p-[14px_20px] text-left"
        style={{ background: open ? "#fef9ee" : "#fafafa", borderLeft: "4px solid var(--amber)" }}
      >
        <span className="flex-1 font-[850] text-[15px]">📋 New Exit Form</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      {open && (
        <div className="p-[24px_28px] grid gap-6">
          {/* Basic exit info */}
          <section>
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Exit Details</div>
            <div className="grid grid-cols-2 gap-4">
              <HrField label="Staff ID" required>
                <HrInput
                  value={String(form.staff ?? "")}
                  onChange={(e) => set("staff", Number(e.target.value))}
                  placeholder="Enter staff ID or search"
                />
              </HrField>
              <HrField label="Exit Reason" required>
                <HrSelect value={form.exit_reason ?? "Resignation"} onChange={(e) => set("exit_reason", e.target.value)}>
                  {EXIT_REASONS.map((r) => <option key={r}>{r}</option>)}
                </HrSelect>
              </HrField>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-4">
              <HrField label="Last Working Date" required>
                <HrInput type="date" value={form.last_working_date ?? ""} onChange={(e) => set("last_working_date", e.target.value)} />
              </HrField>
              <HrField label="Notice Period (days)">
                <HrInput
                  type="number" min={0}
                  value={form.notice_period_days ?? 30}
                  onChange={(e) => set("notice_period_days", Number(e.target.value))}
                />
              </HrField>
            </div>
            <div className="mt-4">
              <HrField label="Exit Interview Notes">
                <HrTextarea
                  rows={3}
                  value={form.exit_interview_notes ?? ""}
                  onChange={(e) => set("exit_interview_notes", e.target.value)}
                  placeholder="Key points from exit interview…"
                />
              </HrField>
            </div>
          </section>

          {/* Handover checklist */}
          <section>
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Handover Checklist</div>
            <div className="grid grid-cols-2 gap-2">
              {DEFAULT_CHECKLIST.map((item) => (
                <label key={item} className="flex items-center gap-2 cursor-pointer p-[8px_10px] rounded-[8px] border border-[var(--line)] hover:bg-[#fafafa] transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[var(--brand)]"
                    checked={checklist[item]}
                    onChange={(e) => setChecklist((c) => ({ ...c, [item]: e.target.checked }))}
                  />
                  <span className="text-[12px]">{item}</span>
                </label>
              ))}
            </div>
            <div className="mt-2 text-[12px] text-[var(--muted)]">
              {Object.values(checklist).filter(Boolean).length} / {DEFAULT_CHECKLIST.length} completed
            </div>
          </section>

          {/* Financial clearance */}
          <section>
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Financial Clearance</div>
            <div className="grid grid-cols-2 gap-2">
              {FINANCIAL_ITEMS.map((item) => (
                <label key={item} className="flex items-center gap-2 cursor-pointer p-[8px_10px] rounded-[8px] border border-[var(--line)] hover:bg-[#fafafa] transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 accent-[var(--brand)]"
                    checked={financials[item]}
                    onChange={(e) => setFinancials((f) => ({ ...f, [item]: e.target.checked }))}
                  />
                  <span className="text-[12px]">{item}</span>
                </label>
              ))}
            </div>
          </section>

          {/* Documents to issue */}
          <section>
            <div className="text-[11px] font-[700] uppercase tracking-[0.08em] text-[var(--muted)] mb-3">Documents to Issue</div>
            <div className="flex flex-wrap gap-2">
              {DOCS_TO_ISSUE.map((doc) => (
                <label
                  key={doc}
                  className="flex items-center gap-2 cursor-pointer px-3 py-2 rounded-[8px] border transition-colors text-[12px]"
                  style={{
                    borderColor: docs[doc] ? "var(--brand)" : "var(--line)",
                    background: docs[doc] ? "var(--soft)" : "white",
                    color: docs[doc] ? "var(--brand)" : "#64748b",
                  }}
                >
                  <input
                    type="checkbox"
                    className="w-3 h-3 accent-[var(--brand)]"
                    checked={docs[doc]}
                    onChange={(e) => setDocs((d) => ({ ...d, [doc]: e.target.checked }))}
                  />
                  {doc}
                </label>
              ))}
            </div>
          </section>

          {/* Submit */}
          <div className="flex justify-end gap-2 pt-4 border-t border-[#f1f5f9]">
            <HrButton variant="ghost" onClick={() => setOpen(false)}>Cancel</HrButton>
            <HrButton variant="primary" onClick={() => void handleSave()} loading={saving}>
              Submit Exit Record
            </HrButton>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Ex-Staff Table ───────────────────────────────────────────────────────────
function ExStaffTable() {
  const [search, setSearch] = useState("");
  const [reasonFilter, setReasonFilter] = useState("");
  const { data, loading, refetch } = useOffboarding({ search, exit_reason: reasonFilter });
  const { toast } = useHrToast();
  const [completing, setCompleting] = useState<number | null>(null);
  const [completing2, setCompleting2] = useState(false);

  const records = data?.results ?? [];

  const handleComplete = async () => {
    if (!completing) return;
    setCompleting2(true);
    try {
      await completeOffboarding(completing);
      toast("Offboarding marked complete");
      void refetch();
    } catch { toast("Failed", "error"); }
    finally { setCompleting2(false); setCompleting(null); }
  };

  return (
    <div>
      <div className="flex gap-3 mb-4 items-center">
        <div className="flex-1 min-w-[200px] relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ex-staff…"
            className="w-full pl-9 pr-3 py-[9px] border border-[var(--line)] rounded-[8px] text-[13px] outline-none focus:border-[var(--brand)]"
          />
        </div>
        <HrSelect value={reasonFilter} onChange={(e) => setReasonFilter(e.target.value)}>
          <option value="">All Reasons</option>
          {EXIT_REASONS.map((r) => <option key={r}>{r}</option>)}
        </HrSelect>
      </div>

      {loading ? <HrSkeleton rows={4} /> : records.length === 0 ? (
        <div className="bg-white border border-[var(--line)] rounded-[14px] py-14 text-center text-[var(--muted)]">
          No offboarding records yet.
        </div>
      ) : (
        <div className="bg-white border border-[var(--line)] rounded-[14px] overflow-hidden" style={{ boxShadow: "var(--shadow)" }}>
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-[#fafafa] text-[11px] uppercase text-[#64748b] tracking-[0.08em]">
                <th className="px-4 py-3 text-left">Staff</th>
                <th className="px-4 py-3 text-left">Exit Reason</th>
                <th className="px-4 py-3 text-left">Last Working Day</th>
                <th className="px-4 py-3 text-left">Checklist</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const checkDone = Object.values(r.handover_checklist ?? {}).filter(Boolean).length;
                const checkTotal = Object.keys(r.handover_checklist ?? {}).length;
                return (
                  <tr key={r.id} className="border-t border-[#f4f4f8] hover:bg-[#fafafd] transition-colors">
                    <td className="px-4 py-3 font-[750] text-[13px]">{r.staff_name}</td>
                    <td className="px-4 py-3">
                      <HrBadge variant={r.exit_reason === "Dismissal" ? "red" : r.exit_reason === "Retirement" ? "purple" : "grey"}>
                        {r.exit_reason}
                      </HrBadge>
                    </td>
                    <td className="px-4 py-3 text-[12px] text-[var(--muted)]">{r.last_working_date}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 max-w-[80px] h-[5px] rounded-full bg-[#e2e8f0] overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: checkTotal ? `${(checkDone / checkTotal) * 100}%` : "0%",
                              background: checkDone === checkTotal ? "var(--green)" : "var(--amber)",
                            }}
                          />
                        </div>
                        <span className="text-[11px] text-[var(--muted)]">{checkDone}/{checkTotal}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <HrBadge variant={r.is_complete ? "green" : "amber"}>
                        {r.is_complete ? "Complete" : "In Progress"}
                      </HrBadge>
                    </td>
                    <td className="px-4 py-3">
                      {!r.is_complete && (
                        <HrButton variant="green" size="sm" onClick={() => setCompleting(r.id)}>
                          <Check size={12} /> Complete
                        </HrButton>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <HrConfirmDialog
        isOpen={!!completing}
        onClose={() => setCompleting(null)}
        onConfirm={() => void handleComplete()}
        title="Mark Offboarding Complete"
        message="This will finalize the exit process for this staff member."
        confirmLabel="Complete"
        loading={completing2}
      />
    </div>
  );
}

// ─── Main Offboarding Page ────────────────────────────────────────────────────
export default function HrOffboardingPage() {
  const { data, refetch } = useOffboarding({});
  const { toast } = useHrToast();

  const records = data?.results ?? [];
  const inProgress = records.filter((r) => !r.is_complete).length;
  const complete = records.filter((r) => r.is_complete).length;

  const handleCreate = async (formData: Partial<OffboardingRecord>) => {
    await createOffboarding(formData);
    void refetch();
  };

  return (
    <div>
      <HrHero
        eyebrow="HR Module"
        title="Staff"
        accent="Offboarding"
        sub="Manage exit processes, handover checklists and documentation."
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <HrKpiCard label="Total Exits" value={data?.count ?? "—"} />
        <HrKpiCard label="In Progress" value={inProgress} color="var(--amber)" />
        <HrKpiCard label="Completed" value={complete} color="var(--green)" />
        <HrKpiCard label="This Month" value="—" />
      </div>

      {/* Exit Form (default expanded) */}
      <ExitForm onSubmit={handleCreate} />

      {/* Ex-staff directory */}
      <div className="mt-6">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-[18px] font-[800] m-0" style={{ fontFamily: "var(--serif)" }}>Ex-Staff Directory</h2>
          <HrBadge variant="grey">{data?.count ?? 0} records</HrBadge>
        </div>
        <ExStaffTable />
      </div>
    </div>
  );
}
