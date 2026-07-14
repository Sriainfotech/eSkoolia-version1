"use client";

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  feesApi,
  listData,
  type ConcessionRule,
  type FeeSchedule,
  type FeesGroup,
  type FeesType,
} from "@/lib/fees-api";

export type FeeLineOverride = {
  overrideAmount?: string;
  specialOfferPct?: string;
  reason?: string;
};

export type FeePlanState = {
  feeGroupId: string;
  concessionId: string; // "" = None
  overrides: Record<number, FeeLineOverride>; // keyed by fees_type id
};

export const EMPTY_FEE_PLAN: FeePlanState = { feeGroupId: "", concessionId: "", overrides: {} };

export type FeeAssignmentPayload = {
  fees_type: number;
  due_date: string;
  amount: string;
  discount_amount: string;
  concession_amount: string;
  reason: string;
};

export interface StudentFeesStepHandle {
  /** Every resolved fee-plan line, ready to POST to /api/v1/fees/assignments/ (academic_year + student still need to be added by the caller). */
  getAssignmentPayloads: () => FeeAssignmentPayload[];
  hasSelection: () => boolean;
}

export type FeePlanSummary = {
  groupName: string;
  concessionName: string;
  lineCount: number;
  annualTotal: number;
};

interface Props {
  academicYearId: string;
  academicYearName?: string;
  classId: string;
  studentDisplayName: string;
  admissionNo: string;
  isDraft: boolean;
  value: FeePlanState;
  onChange: (next: FeePlanState) => void;
  onSummaryChange?: (summary: FeePlanSummary) => void;
  showToast: (message: string, type?: "success" | "error", durationMs?: number) => void;
  sectionCounter?: string;
  navButtonsSlot?: ReactNode;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

function fmtInr(n: number): string {
  return "₹" + (Number.isFinite(n) ? n : 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

type ResolvedLine = {
  feesType: FeesType;
  schedule: FeeSchedule | null;
  standardAmount: number;
  baseAmount: number;
  isOverridden: boolean;
  concessionPct: number;
  specialOfferPct: number;
  concessionAmount: number;
  finalAmount: number;
  dueDate: string;
  structureLabel: string;
};

const StudentFeesStep = forwardRef<StudentFeesStepHandle, Props>(function StudentFeesStep(
  {
    academicYearId,
    academicYearName,
    classId,
    studentDisplayName,
    admissionNo,
    isDraft,
    value,
    onChange,
    onSummaryChange,
    showToast,
    sectionCounter = "10 / 10",
    navButtonsSlot,
  },
  ref
) {
  const [groups, setGroups] = useState<FeesGroup[]>([]);
  const [types, setTypes] = useState<FeesType[]>([]);
  const [schedules, setSchedules] = useState<FeeSchedule[]>([]);
  const [concessions, setConcessions] = useState<ConcessionRule[]>([]);
  // Unscoped by academic year — used only to tell the admin *which* years have
  // fee groups configured, when the selected year comes back empty.
  const [groupYearsWithData, setGroupYearsWithData] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState(false);
  const [openOfferFor, setOpenOfferFor] = useState<number | null>(null);
  const autoSelectedRef = useRef(false);

  useEffect(() => {
    if (!academicYearId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      feesApi.listGroups({ academic_year: Number(academicYearId) }),
      feesApi.listTypes({ page_size: 1000 }),
      feesApi.listSchedules({ academic_year: Number(academicYearId) }),
      feesApi.listConcessionRules({ page_size: 200 }),
      feesApi.listGroups(),
    ])
      .then(([g, t, s, c, gAll]) => {
        if (cancelled) return;
        setGroups(listData<FeesGroup>(g));
        setTypes(listData<FeesType>(t));
        setSchedules(listData<FeeSchedule>(s));
        setConcessions(listData<ConcessionRule>(c));
        setGroupYearsWithData(new Set(listData<FeesGroup>(gAll).map((row) => row.academic_year)));
      })
      .catch(() => {
        if (!cancelled) showToast("Failed to load fee configuration. You can skip this step and assign fees later from Fees → Assignment.", "error");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYearId]);

  const filteredGroups = useMemo(() => {
    const clsNum = Number(classId);
    return groups.filter((g) => {
      if (g.is_active === false) return false;
      if (!g.applicable_classes || g.applicable_classes.length === 0) return true;
      return g.applicable_classes.includes(clsNum);
    });
  }, [groups, classId]);

  // Auto-select the first applicable group once data loads, so the table isn't empty by default.
  useEffect(() => {
    if (autoSelectedRef.current) return;
    if (value.feeGroupId) {
      autoSelectedRef.current = true;
      return;
    }
    if (filteredGroups.length > 0) {
      autoSelectedRef.current = true;
      onChange({ ...value, feeGroupId: String(filteredGroups[0].id) });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredGroups]);

  const activeConcessions = useMemo(
    () =>
      concessions.filter(
        (c) => (c.status ?? "Active") === "Active" && (!c.academic_year || String(c.academic_year) === academicYearId)
      ),
    [concessions, academicYearId]
  );

  const selectedConcession = useMemo(
    () => activeConcessions.find((c) => String(c.id) === value.concessionId) || null,
    [activeConcessions, value.concessionId]
  );

  const groupTypes = useMemo(() => {
    if (!value.feeGroupId) return [];
    return types.filter(
      (t) =>
        String(t.fees_group) === value.feeGroupId &&
        (t.status ?? "Active") === "Active" &&
        (!t.academic_year || String(t.academic_year) === academicYearId)
    );
  }, [types, value.feeGroupId, academicYearId]);

  const resolvedLines: ResolvedLine[] = useMemo(() => {
    return groupTypes.map((feesType) => {
      const schedule =
        schedules.find(
          (s) =>
            String(s.fee_type) === String(feesType.id) &&
            (!s.fee_group || String(s.fee_group) === value.feeGroupId) &&
            (s.status ?? "active") === "active"
        ) || null;

      const standardAmount = schedule ? parseFloat(schedule.amount || "0") : parseFloat(feesType.amount || "0");
      const override = value.overrides[feesType.id];
      const overrideAmountRaw = override?.overrideAmount?.trim();
      const isOverridden = !!overrideAmountRaw;
      const baseAmount = isOverridden ? parseFloat(overrideAmountRaw as string) || 0 : standardAmount;

      const concessionPct = selectedConcession ? parseFloat(selectedConcession.discount_percentage || "0") : 0;
      const specialOfferRaw = override?.specialOfferPct?.trim();
      const specialOfferPct = specialOfferRaw ? Math.min(100, Math.max(0, parseFloat(specialOfferRaw) || 0)) : 0;
      const totalPct = Math.min(100, concessionPct + specialOfferPct);
      const concessionAmount = round2((baseAmount * totalPct) / 100);
      const finalAmount = round2(baseAmount - concessionAmount);

      const dueDate = schedule?.due_date || todayISO();
      const structureLabel = feesType.default_structure || schedule?.collection_frequency || "Custom";

      return {
        feesType,
        schedule,
        standardAmount,
        baseAmount,
        isOverridden,
        concessionPct,
        specialOfferPct,
        concessionAmount,
        finalAmount,
        dueDate,
        structureLabel,
      };
    });
  }, [groupTypes, schedules, value.feeGroupId, value.overrides, selectedConcession]);

  const annualTotal = useMemo(() => resolvedLines.reduce((sum, r) => sum + r.finalAmount, 0), [resolvedLines]);

  const selectedGroup = useMemo(
    () => filteredGroups.find((g) => String(g.id) === value.feeGroupId) || groups.find((g) => String(g.id) === value.feeGroupId) || null,
    [filteredGroups, groups, value.feeGroupId]
  );

  useEffect(() => {
    onSummaryChange?.({
      groupName: selectedGroup?.name || "",
      concessionName: selectedConcession?.name || "",
      lineCount: resolvedLines.length,
      annualTotal,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedGroup, selectedConcession, resolvedLines.length, annualTotal]);

  useImperativeHandle(
    ref,
    () => ({
      getAssignmentPayloads: () =>
        resolvedLines.map((r) => {
          const override = value.overrides[r.feesType.id];
          const reasonParts: string[] = [];
          if (r.isOverridden) {
            reasonParts.push(`Amount overridden from ${fmtInr(r.standardAmount)} to ${fmtInr(r.baseAmount)} at enrollment.`);
          }
          if (selectedConcession) {
            reasonParts.push(`Concession applied: ${selectedConcession.name} (${r.concessionPct}%).`);
          }
          if (r.specialOfferPct > 0) {
            reasonParts.push(`Special offer of ${r.specialOfferPct}% applied to ${r.feesType.name}.`);
          }
          if (override?.reason?.trim()) {
            reasonParts.push(`Note: ${override.reason.trim()}`);
          }
          return {
            fees_type: r.feesType.id,
            due_date: r.dueDate,
            amount: r.baseAmount.toFixed(2),
            discount_amount: "0.00",
            concession_amount: r.concessionAmount.toFixed(2),
            reason: reasonParts.join(" "),
          };
        }),
      hasSelection: () => resolvedLines.length > 0,
    }),
    [resolvedLines, value.overrides, selectedConcession]
  );

  const setOverride = (feesTypeId: number, patch: Partial<FeeLineOverride>) => {
    const next: FeePlanState = {
      ...value,
      overrides: {
        ...value.overrides,
        [feesTypeId]: { ...(value.overrides[feesTypeId] || {}), ...patch },
      },
    };
    onChange(next);
  };

  const statusBadge = isDraft ? "Draft" : "Active";
  const missingPrereqs = !academicYearId || !classId;

  return (
    <section className="fp-shell" id="fees">
      <header className="fp-header">
        <div>
          <p className="fp-eyebrow">Fee assignment &amp; agreement</p>
          <h2 className="fp-title">
            Fee <span className="fp-title-em">plan</span>
          </h2>
          <p className="fp-subtitle">
            Review the fee structure for this student&apos;s group. Override individual amounts where a different
            rate was agreed, apply concessions, and add a reason for any change — creating a logged, auditable fee
            agreement.
          </p>
        </div>
        <span className="fp-counter">{sectionCounter}</span>
      </header>

      {missingPrereqs ? (
        <div className="fp-empty">
          Select an academic year and class in <strong>Academic placement</strong> first — fee groups are matched to
          the student&apos;s class.
        </div>
      ) : (
        <>
          <div className="fp-summary">
            <div className="fp-summary-left">
              <span className="fp-avatar">{initials(studentDisplayName)}</span>
              <div>
                <div className="fp-summary-name">
                  {studentDisplayName || "New student"} <span className="fp-badge">{statusBadge}</span>
                </div>
                <div className="fp-summary-meta">
                  {admissionNo ? `ADM-${admissionNo}` : "Admission no. pending"}
                  {selectedConcession ? ` · ${selectedConcession.name}` : ""}
                </div>
              </div>
            </div>
            <div className="fp-summary-right">
              <span className="fp-total-label">Annual total (after all discounts)</span>
              <span className="fp-total-amount">{fmtInr(annualTotal)}</span>
            </div>
          </div>

          <div className="fp-selector-row">
            <span className="fp-selector-label">Fee group</span>
            <div className="fp-pills">
              {filteredGroups.length === 0 ? (
                <span className="fp-hint">
                  {groups.length === 0 && groupYearsWithData.size > 0 && !groupYearsWithData.has(Number(academicYearId))
                    ? `No fee groups are configured for ${academicYearName || "this academic year"} — they've only been set up for a different academic year. Add fee groups for this year in Fees → Fee Groups, or re-check the academic year on Step 2.`
                    : groups.length === 0
                      ? "No fee groups are configured for this school yet — set them up in Fees → Fee Groups, or skip this step and assign fees later."
                      : "None of the configured fee groups apply to this student's class yet."}
                </span>
              ) : (
                filteredGroups.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    className={`fp-pill ${String(g.id) === value.feeGroupId ? "is-active" : ""}`}
                    onClick={() => onChange({ ...value, feeGroupId: String(g.id) })}
                  >
                    {g.name}
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="fp-selector-row">
            <span className="fp-selector-label">Concession</span>
            <div className="fp-pills">
              <button
                type="button"
                className={`fp-pill ${!value.concessionId ? "is-active" : ""}`}
                onClick={() => onChange({ ...value, concessionId: "" })}
              >
                None
              </button>
              {activeConcessions.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={`fp-pill ${String(c.id) === value.concessionId ? "is-active" : ""}`}
                  onClick={() => onChange({ ...value, concessionId: String(c.id) })}
                >
                  {c.name}
                  {c.discount_percentage ? ` ${parseFloat(c.discount_percentage)}%` : ""}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="fp-empty">Loading fee structure…</div>
          ) : !value.feeGroupId ? (
            <div className="fp-empty">Choose a fee group above to see its fee types.</div>
          ) : resolvedLines.length === 0 ? (
            <div className="fp-empty">
              No active fee types are configured for this group yet. You can skip this step and assign fees later
              from Fees → Assignment.
            </div>
          ) : (
            <div className="fp-table-wrap">
              <table className="fp-table">
                <thead>
                  <tr>
                    <th>Fee type</th>
                    <th>Standard amt</th>
                    <th>Override amount</th>
                    <th>Concession / special offer</th>
                    <th>Final amount</th>
                    <th>Due date</th>
                  </tr>
                </thead>
                <tbody>
                  {resolvedLines.map((r) => {
                    const override = value.overrides[r.feesType.id];
                    return (
                      <tr key={r.feesType.id}>
                        <td>
                          <div className="fp-fee-name">{r.feesType.name}</div>
                          <span className="fp-structure-badge">{r.structureLabel}</span>
                        </td>
                        <td className="fp-amount-cell">{fmtInr(r.standardAmount)}</td>
                        <td>
                          <input
                            type="number"
                            min={0}
                            className="fp-input"
                            placeholder="As standard"
                            value={override?.overrideAmount ?? ""}
                            onChange={(e) => setOverride(r.feesType.id, { overrideAmount: e.target.value })}
                          />
                        </td>
                        <td>
                          {selectedConcession ? (
                            <div className="fp-concession-line">{selectedConcession.name} ({r.concessionPct}%)</div>
                          ) : (
                            <div className="fp-concession-line fp-muted">No concession</div>
                          )}
                          {openOfferFor === r.feesType.id ? (
                            <input
                              type="number"
                              min={0}
                              max={100}
                              autoFocus
                              className="fp-input fp-input-sm"
                              placeholder="Offer %"
                              value={override?.specialOfferPct ?? ""}
                              onChange={(e) => setOverride(r.feesType.id, { specialOfferPct: e.target.value })}
                              onBlur={() => { if (!override?.specialOfferPct) setOpenOfferFor(null); }}
                            />
                          ) : (
                            <button type="button" className="fp-link-btn" onClick={() => setOpenOfferFor(r.feesType.id)}>
                              + Add special offer %
                            </button>
                          )}
                          {(r.isOverridden || r.specialOfferPct > 0) && (
                            <input
                              type="text"
                              className="fp-input fp-input-sm fp-reason-input"
                              placeholder="Reason for this change (for the audit log)"
                              value={override?.reason ?? ""}
                              onChange={(e) => setOverride(r.feesType.id, { reason: e.target.value })}
                            />
                          )}
                        </td>
                        <td className="fp-amount-cell fp-final-amount">{fmtInr(r.finalAmount)}</td>
                        <td>
                          {r.schedule?.term_breakdown && r.schedule.term_breakdown.length > 0 ? (
                            <div className="fp-schedule-chips">
                              {r.schedule.term_breakdown.map((t, i) => (
                                <span key={i} className="fp-schedule-chip">
                                  {t.term_name}: {t.due_date}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="fp-schedule-chip">{r.dueDate}</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={4}>
                      <strong>Annual total ({resolvedLines.length} fee type{resolvedLines.length === 1 ? "" : "s"})</strong>
                    </td>
                    <td className="fp-amount-cell fp-final-amount">
                      <strong>{fmtInr(annualTotal)}</strong>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          <p className="fp-footnote">
            Fees are assigned once you finish enrollment on the Review step. You can always adjust the plan later
            from Fees → Assignment.
          </p>
        </>
      )}

      {navButtonsSlot}

      <style jsx>{`
        .fp-shell {
          padding: 28px 24px;
        }
        .fp-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
        }
        .fp-eyebrow {
          margin: 0 0 4px;
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: #6c3ce1;
        }
        .fp-title {
          margin: 0;
          font-size: 26px;
          font-weight: 800;
          color: #111827;
        }
        .fp-title-em {
          font-style: italic;
          color: #6c3ce1;
          font-weight: 600;
        }
        .fp-subtitle {
          margin: 6px 0 0;
          font-size: 13px;
          color: #6b7280;
          max-width: 640px;
          line-height: 1.5;
        }
        .fp-counter {
          flex-shrink: 0;
          font-size: 12px;
          font-weight: 600;
          color: #9ca3af;
          background: #f3f4f6;
          border-radius: 999px;
          padding: 4px 12px;
        }
        .fp-empty {
          padding: 20px;
          border: 1px dashed #e5e7eb;
          border-radius: 12px;
          background: #f9fafb;
          color: #6b7280;
          font-size: 13px;
        }
        .fp-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          padding: 16px 20px;
          margin-bottom: 18px;
          background: #fff;
        }
        .fp-summary-left {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .fp-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #ede9fe;
          color: #6c3ce1;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 14px;
          flex-shrink: 0;
        }
        .fp-summary-name {
          font-size: 14px;
          font-weight: 700;
          color: #111827;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .fp-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          background: #f3f4f6;
          color: #6b7280;
        }
        .fp-summary-meta {
          margin-top: 2px;
          font-size: 12px;
          color: #9ca3af;
        }
        .fp-summary-right {
          text-align: right;
          flex-shrink: 0;
        }
        .fp-total-label {
          display: block;
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          color: #9ca3af;
        }
        .fp-total-amount {
          display: block;
          margin-top: 2px;
          font-size: 22px;
          font-weight: 800;
          color: #6c3ce1;
        }
        .fp-selector-row {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-bottom: 12px;
          flex-wrap: wrap;
        }
        .fp-selector-label {
          font-size: 10px;
          font-weight: 700;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: #9ca3af;
          width: 90px;
          flex-shrink: 0;
        }
        .fp-pills {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
        .fp-pill {
          padding: 6px 14px;
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #fff;
          font-size: 12.5px;
          font-weight: 600;
          color: #374151;
          cursor: pointer;
        }
        .fp-pill.is-active {
          border-color: #6c3ce1;
          color: #6c3ce1;
          background: #f5f3ff;
        }
        .fp-hint {
          font-size: 12px;
          color: #9ca3af;
        }
        .fp-table-wrap {
          border: 1px solid #e5e7eb;
          border-radius: 14px;
          overflow-x: auto;
          margin-top: 8px;
        }
        .fp-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .fp-table thead th {
          text-align: left;
          padding: 10px 14px;
          background: #f9fafb;
          color: #9ca3af;
          font-size: 10.5px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
          border-bottom: 1px solid #e5e7eb;
          white-space: nowrap;
        }
        .fp-table tbody td {
          padding: 12px 14px;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: top;
        }
        .fp-table tfoot td {
          padding: 12px 14px;
          background: #f9fafb;
          font-size: 13px;
          color: #111827;
        }
        .fp-fee-name {
          font-weight: 600;
          color: #111827;
        }
        .fp-structure-badge {
          display: inline-block;
          margin-top: 4px;
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 999px;
          background: #dcfce7;
          color: #15803d;
        }
        .fp-amount-cell {
          font-weight: 600;
          color: #374151;
          white-space: nowrap;
        }
        .fp-final-amount {
          color: #111827;
          font-weight: 700;
        }
        .fp-input {
          width: 120px;
          padding: 7px 10px;
          border: 1px solid #e5e7eb;
          border-radius: 8px;
          font-size: 13px;
          color: #111827;
          font-family: inherit;
        }
        .fp-input-sm {
          margin-top: 6px;
          width: 100%;
          min-width: 160px;
        }
        .fp-reason-input {
          margin-top: 6px;
        }
        .fp-concession-line {
          font-size: 12.5px;
          color: #374151;
          font-weight: 600;
        }
        .fp-muted {
          color: #9ca3af;
          font-weight: 500;
        }
        .fp-link-btn {
          margin-top: 4px;
          background: none;
          border: none;
          padding: 0;
          color: #6c3ce1;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          text-decoration: underline;
        }
        .fp-schedule-chips {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .fp-schedule-chip {
          display: inline-block;
          font-size: 11px;
          font-weight: 600;
          color: #374151;
          background: #f3f4f6;
          border-radius: 6px;
          padding: 3px 8px;
          white-space: nowrap;
          width: fit-content;
        }
        .fp-footnote {
          margin: 16px 0 0;
          font-size: 12px;
          color: #9ca3af;
        }
      `}</style>
    </section>
  );
});

export default StudentFeesStep;
