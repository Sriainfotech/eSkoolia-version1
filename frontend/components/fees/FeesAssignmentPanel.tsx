"use client";

import { useEffect, useMemo, useState } from "react";
import { feesApi, listData, type AcademicYear, type FeeSchedule, type FeesAssignment, type FeesGroup, type StudentRow, type ConcessionRule } from "@/lib/fees-api";

type FilterTab = "all" | "unassigned" | "assigned";
type PlanId = "2-term" | "3-term" | "4-term" | "monthly" | "custom";

type UiStudent = {
  id: number;
  name: string;
  admissionNo: string;
  className: string;
  sectionName: string;
  classLabel: string;
  classId: number | null;
  groupName: string;
  annualTotal: number;
  assigned: boolean;
  planAgreed: boolean;
};

type UiClassSection = {
  id: string;
  name: string;
  students: UiStudent[];
};

type StudentAssignmentsMap = Record<number, FeesAssignment[]>;

const CONCESSION_NONE = "none";

const PAYMENT_PLANS: { id: PlanId; label: string; desc: string; installments: number | null }[] = [
  { id: "2-term", label: "2-Term Plan", desc: "Two due dates in the academic year.", installments: 2 },
  { id: "3-term", label: "3-Term Plan", desc: "Three due dates in the academic year.", installments: 3 },
  { id: "4-term", label: "4-Term Plan", desc: "Four due dates in the academic year.", installments: 4 },
  { id: "monthly", label: "Monthly Plan", desc: "Twelve monthly due dates.", installments: 12 },
  { id: "custom", label: "Custom Plan", desc: "Keep existing due dates.", installments: null },
];

function primaryBtn(small = false): React.CSSProperties {
  return {
    height: small ? 32 : 38,
    padding: small ? "0 14px" : "0 20px",
    background: "#6D4AFF",
    color: "#fff",
    border: "none",
    borderRadius: small ? 7 : 9,
    fontSize: small ? 12.5 : 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(109,74,255,0.20)",
  };
}

function outlineBtn(small = false): React.CSSProperties {
  return {
    height: small ? 32 : 38,
    padding: small ? "0 14px" : "0 16px",
    background: "#fff",
    color: "#181B2A",
    border: "1px solid #E8E8EE",
    borderRadius: small ? 7 : 9,
    fontSize: small ? 12.5 : 13,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  };
}

const TH: React.CSSProperties = {
  padding: "11px 16px",
  fontSize: 10.5,
  fontWeight: 700,
  letterSpacing: "0.07em",
  color: "#A0A3B8",
  textAlign: "left",
  borderBottom: "1px solid #E8E8EE",
};

function fmtRs(n: number) {
  return "Rs. " + n.toLocaleString("en-IN");
}

function parseMoney(value?: string | number | null): number {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function fullName(first?: string, last?: string): string {
  return `${first || ""} ${last || ""}`.trim() || "Student";
}

function initials(name: string): string {
  const p = name.trim().split(" ").filter(Boolean);
  return ((p[0]?.[0] || "S") + (p[1]?.[0] || "")).toUpperCase();
}

function avatarBg(name: string): string {
  const colors = ["#6D4AFF", "#0E7490", "#16a34a", "#d97706", "#dc2626", "#7C3AED", "#0284c7", "#9333ea", "#ca8a04", "#059669"];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return colors[h % colors.length];
}

function getPlanDates(year: AcademicYear | null, installments: number): string[] {
  if (!year?.start_date || !year?.end_date || installments <= 0) return [];
  const start = new Date(year.start_date);
  const end = new Date(year.end_date);
  const span = end.getTime() - start.getTime();
  const result: string[] = [];
  for (let i = 1; i <= installments; i++) {
    const t = new Date(start.getTime() + Math.floor((span * i) / (installments + 1)));
    result.push(t.toISOString().split("T")[0]);
  }
  return result;
}

async function fetchAllAssignmentsForYear(yearId: number): Promise<FeesAssignment[]> {
  const data = await feesApi.listAssignments({ page_size: 500, academic_year: yearId });
  return listData(data);
}

function mapSchedulesByGroup(schedules: FeeSchedule[]): Record<number, FeeSchedule[]> {
  const m: Record<number, FeeSchedule[]> = {};
  for (const s of schedules) {
    if ((s.status || "").toLowerCase() !== "active") continue;
    if (!m[s.fee_group]) m[s.fee_group] = [];
    m[s.fee_group].push(s);
  }
  return m;
}

function discountFactor(rule: ConcessionRule | null): number {
  if (!rule) return 0;
  const pct = parseMoney(rule.discount_percentage);
  if (pct <= 0) return 0;
  return Math.max(0, Math.min(100, pct)) / 100;
}

function ModalShell({ onClose, children, maxWidth = 680 }: { onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(14,16,32,0.40)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}
      onClick={onClose}
    >
      <div
        style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth, boxShadow: "0 24px 64px rgba(0,0,0,0.22)", animation: "modalIn 0.18s ease", maxHeight: "90vh", overflowY: "auto" }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function ModalHeader({ title, subtitle, onClose }: { title: string; subtitle: string; onClose: () => void }) {
  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", padding: "18px 20px 14px" }}>
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#181B2A", marginBottom: 3 }}>{title}</div>
          <div style={{ fontSize: 12, color: "#A0A3B8" }}>{subtitle}</div>
        </div>
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #E8E8EE", background: "#fff", cursor: "pointer", fontSize: 15, color: "#A0A3B8", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ height: 1, background: "#E8E8EE", margin: "0 20px" }} />
    </>
  );
}

function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 20px", borderTop: "1px solid #E8E8EE" }}>{children}</div>;
}

export default function FeesAssignmentPanel() {
  const [isLoading, setIsLoading] = useState(true);
  const [isMutating, setIsMutating] = useState(false);
  const [toast, setToast] = useState("");

  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [academicYearId, setAcademicYearId] = useState<number | null>(null);

  const [students, setStudents] = useState<StudentRow[]>([]);
  const [feeGroups, setFeeGroups] = useState<FeesGroup[]>([]);
  const [feeSchedules, setFeeSchedules] = useState<FeeSchedule[]>([]);
  const [concessionRules, setConcessionRules] = useState<ConcessionRule[]>([]);
  const [assignments, setAssignments] = useState<FeesAssignment[]>([]);

  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [tab, setTab] = useState<FilterTab>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const [assignModal, setAssignModal] = useState<{ student: UiStudent; isEdit: boolean } | null>(null);
  const [bulkModal, setBulkModal] = useState<{ classId: string; className: string } | null>(null);
  const [changePlanModal, setChangePlanModal] = useState<{ student: UiStudent } | null>(null);

  const [modalGroupId, setModalGroupId] = useState<number | null>(null);
  const [modalConcessionId, setModalConcessionId] = useState<string>(CONCESSION_NONE);
  const [bulkClass, setBulkClass] = useState("all");
  const [bulkGroupId, setBulkGroupId] = useState<number | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanId>("3-term");

  const activeYear = useMemo(
    () => academicYears.find(y => y.id === academicYearId) || null,
    [academicYears, academicYearId],
  );

  const scheduleByGroup = useMemo(() => mapSchedulesByGroup(feeSchedules), [feeSchedules]);

  const assignmentsByStudent = useMemo<StudentAssignmentsMap>(() => {
    const m: StudentAssignmentsMap = {};
    for (const a of assignments) {
      if (!m[a.student]) m[a.student] = [];
      m[a.student].push(a);
    }
    return m;
  }, [assignments]);

  const groupsById = useMemo(() => {
    const m: Record<number, FeesGroup> = {};
    for (const g of feeGroups) m[g.id] = g;
    return m;
  }, [feeGroups]);

  const groupNameForStudent = (studentId: number): string => {
    const first = assignmentsByStudent[studentId]?.[0];
    if (!first) return "Unassigned";
    // Map via schedule fee_type -> fee_group when possible.
    const schedule = feeSchedules.find(s => s.fee_type === first.fees_type);
    if (schedule?.fee_group_name) return schedule.fee_group_name;
    if (schedule?.fee_group && groupsById[schedule.fee_group]) return groupsById[schedule.fee_group].name;
    return "Assigned";
  };

  const classOptions = useMemo(() => {
    const set = new Set<string>();
    for (const st of students) {
      const className = (st as any).current_class_name || "";
      const sectionName = (st as any).current_section_name || "";
      if (className) {
        set.add(sectionName ? `${className} ${sectionName}` : className);
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [students]);

  const groupOptions = useMemo(() => {
    const names = feeGroups.map(g => g.name);
    return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
  }, [feeGroups]);

  const visibleConcessionRules = useMemo(() => {
    const activeRules = concessionRules.filter(c => (c.status || "").toLowerCase() !== "inactive");
    if (!academicYearId) return activeRules;

    // Keep all active concessions visible so admins can apply cross-year rules when needed,
    // while still prioritizing rules from the selected academic year.
    return [...activeRules].sort((a, b) => {
      const aMatch = Number(a.academic_year) === Number(academicYearId) ? 1 : 0;
      const bMatch = Number(b.academic_year) === Number(academicYearId) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return (a.name || "").localeCompare(b.name || "");
    });
  }, [concessionRules, academicYearId]);

  const uiStudents = useMemo<UiStudent[]>(() => {
    return students.map(st => {
      const stAssignments = assignmentsByStudent[st.id] || [];
      const assigned = stAssignments.length > 0;
      const annualTotal = stAssignments.reduce((sum, a) => sum + parseMoney(a.amount) - parseMoney(a.discount_amount) - parseMoney((a as any).concession_amount), 0);
      const className = (st as any).current_class_name || "";
      const sectionName = (st as any).current_section_name || "";
      const classLabel = className ? (sectionName ? `${className} ${sectionName}` : className) : "Unassigned";
      return {
        id: st.id,
        name: fullName(st.first_name, st.last_name),
        admissionNo: st.admission_no || "-",
        className,
        sectionName,
        classLabel,
        classId: (st as any).current_class || null,
        groupName: groupNameForStudent(st.id),
        annualTotal,
        assigned,
        planAgreed: assigned,
      };
    });
  }, [students, assignmentsByStudent, feeSchedules]);

  const stats = useMemo(() => {
    const assigned = uiStudents.filter(s => s.assigned).length;
    const total = uiStudents.length;
    return { assigned, unassigned: total - assigned, total };
  }, [uiStudents]);

  const filteredClassSections = useMemo<UiClassSection[]>(() => {
    const q = search.trim().toLowerCase();
    const base = uiStudents.filter(s => {
      const matchesSearch = !q || s.name.toLowerCase().includes(q) || s.admissionNo.toLowerCase().includes(q);
      const matchesClass = classFilter === "all" || s.classLabel === classFilter;
      const matchesGroup = groupFilter === "all" || s.groupName === groupFilter;
      const matchesTab = tab === "all" || (tab === "assigned" ? s.assigned : !s.assigned);
      return matchesSearch && matchesClass && matchesGroup && matchesTab;
    });

    const map = new Map<string, UiStudent[]>();
    for (const s of base) {
      const key = s.classLabel || "Unassigned";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }

    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([name, rows]) => ({
        id: name.toLowerCase().replace(/\s+/g, "-"),
        name,
        students: rows.sort((x, y) => x.name.localeCompare(y.name)),
      }));
  }, [uiStudents, search, classFilter, groupFilter, tab]);

  const refreshAssignments = async (yearId: number) => {
    const list = await fetchAllAssignmentsForYear(yearId);
    setAssignments(list);
  };

  const loadInitial = async () => {
    setIsLoading(true);
    try {
      const [yearsPayload, studentsPayload, groupsPayload, schedulesPayload, concessionsPayload] = await Promise.all([
        feesApi.listAcademicYears(),
        feesApi.listStudents({ page_size: 500, is_active: true }),
        feesApi.listGroups({ page_size: 500 }),
        feesApi.listSchedules({ page_size: 500 }),
        feesApi.listConcessionRules({ page_size: 500 }),
      ]);

      const years = listData(yearsPayload);
      const selectedYear = years.find(y => y.is_current) || years[0] || null;
      setAcademicYears(years);
      setAcademicYearId(selectedYear?.id || null);

      setStudents(listData(studentsPayload));
      setFeeGroups(listData(groupsPayload));
      setFeeSchedules(listData(schedulesPayload));
      setConcessionRules(listData(concessionsPayload));

      if (selectedYear?.id) {
        const list = await fetchAllAssignmentsForYear(selectedYear.id);
        setAssignments(list);
      } else {
        setAssignments([]);
      }
    } catch (e) {
      console.error("Failed to load Fee Assignment page", e);
      setToast("Failed to load fee assignment data.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInitial();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!filteredClassSections.length) return;
    setExpanded(prev => {
      if (prev.size) return prev;
      return new Set([filteredClassSections[0].id]);
    });
  }, [filteredClassSections]);

  const onYearChange = async (id: number) => {
    setAcademicYearId(id);
    setSelected(new Set());
    setAssignModal(null);
    setBulkModal(null);
    try {
      setIsLoading(true);
      await refreshAssignments(id);
    } catch (e) {
      console.error(e);
      setToast("Failed to load assignments for selected year.");
    } finally {
      setIsLoading(false);
    }
  };

  const openAssignModal = (student: UiStudent, isEdit: boolean) => {
    setAssignModal({ student, isEdit });
    const matchingGroup = feeGroups.find(g => g.name === student.groupName) || feeGroups[0] || null;
    setModalGroupId(matchingGroup?.id || null);
    setModalConcessionId(CONCESSION_NONE);
  };

  const getConcessionRule = (): ConcessionRule | null => {
    if (modalConcessionId === CONCESSION_NONE) return null;
    const id = Number(modalConcessionId);
    if (!id) return null;
    return concessionRules.find(r => r.id === id) || null;
  };

  const createAssignmentsForStudent = async (studentId: number, groupId: number, concession: ConcessionRule | null) => {
    if (!academicYearId) throw new Error("Select academic year first");
    const rows = (scheduleByGroup[groupId] || []).filter(s => s.academic_year === academicYearId);
    if (!rows.length) throw new Error("No active fee schedules found for this fee group in selected year.");
    const disc = discountFactor(concession);

    for (const row of rows) {
      const amount = parseMoney(row.amount);
      const discountAmount = amount * disc;
      await feesApi.createAssignment({
        academic_year: academicYearId,
        student: studentId,
        fees_type: row.fee_type,
        due_date: row.due_date,
        amount: amount.toFixed(2),
        discount_amount: discountAmount.toFixed(2),
      });
    }
  };

  const clearAssignmentsForStudent = async (studentId: number) => {
    const rows = assignmentsByStudent[studentId] || [];
    for (const a of rows) {
      const totalPaid = parseMoney((a as any).total_paid);
      if (totalPaid > 0) {
        throw new Error("Cannot edit assignments with posted payments.");
      }
    }
    for (const a of rows) {
      await feesApi.deleteAssignment(a.id);
    }
  };

  const confirmAssign = async () => {
    if (!assignModal || !modalGroupId) {
      setToast("Select a fee group first.");
      return;
    }
    setIsMutating(true);
    try {
      const concession = getConcessionRule();
      if (assignModal.isEdit) {
        await clearAssignmentsForStudent(assignModal.student.id);
      }
      await createAssignmentsForStudent(assignModal.student.id, modalGroupId, concession);
      await refreshAssignments(academicYearId!);
      setAssignModal(null);
      setToast(assignModal.isEdit ? "Assignment updated successfully." : "Fees assigned successfully.");
    } catch (e: any) {
      console.error(e);
      setToast(e?.message || "Failed to save assignment.");
    } finally {
      setIsMutating(false);
    }
  };

  const confirmBulkAssign = async () => {
    if (!academicYearId || !bulkGroupId) {
      setToast("Select academic year and fee group.");
      return;
    }

    const targetClass = bulkClass;
    const targetStudents = uiStudents.filter(s => {
      if (s.assigned) return false;
      if (targetClass === "all") return true;
      return s.classLabel === targetClass;
    });

    if (!targetStudents.length) {
      setToast("No unassigned students found for selected class.");
      return;
    }

    setIsMutating(true);
    try {
      for (const st of targetStudents) {
        await createAssignmentsForStudent(st.id, bulkGroupId, null);
      }
      await refreshAssignments(academicYearId);
      setBulkModal(null);
      setToast(`Bulk assigned ${targetStudents.length} students.`);
    } catch (e: any) {
      console.error(e);
      setToast(e?.message || "Bulk assignment failed.");
    } finally {
      setIsMutating(false);
    }
  };

  const confirmPlanSwitch = async () => {
    if (!changePlanModal || !activeYear) return;
    const rows = assignmentsByStudent[changePlanModal.student.id] || [];
    if (!rows.length) {
      setToast("No assignments found for this student.");
      return;
    }

    const plan = PAYMENT_PLANS.find(p => p.id === selectedPlan)!;
    if (plan.id === "custom") {
      setChangePlanModal(null);
      setToast("Custom plan selected. Existing due dates retained.");
      return;
    }

    const dueDates = getPlanDates(activeYear, plan.installments || 3);
    if (!dueDates.length) {
      setToast("Academic year dates are required to apply plan.");
      return;
    }

    setIsMutating(true);
    try {
      const sorted = [...rows].sort((a, b) => a.id - b.id);
      for (let i = 0; i < sorted.length; i++) {
        const due = dueDates[i % dueDates.length];
        await feesApi.updateAssignment(sorted[i].id, { due_date: due });
      }
      await refreshAssignments(academicYearId!);
      setChangePlanModal(null);
      setToast(`Payment plan switched to ${plan.label}.`);
    } catch (e) {
      console.error(e);
      setToast("Failed to switch payment plan.");
    } finally {
      setIsMutating(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = (rows: UiStudent[], allSelected: boolean) => {
    setSelected(prev => {
      const n = new Set(prev);
      for (const r of rows) {
        if (allSelected) n.delete(r.id);
        else n.add(r.id);
      }
      return n;
    });
  };

  const currentSchedules = useMemo(() => {
    if (!modalGroupId || !academicYearId) return [] as FeeSchedule[];
    return (scheduleByGroup[modalGroupId] || []).filter(s => s.academic_year === academicYearId);
  }, [modalGroupId, scheduleByGroup, academicYearId]);

  const currentModalTotal = useMemo(
    () => currentSchedules.reduce((sum, s) => sum + parseMoney(s.amount), 0),
    [currentSchedules],
  );

  const yearName = activeYear?.name || "";

  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastUp { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes modalIn { from{opacity:0;transform:scale(0.96)}       to{opacity:1;transform:scale(1)}     }
        .fa-row:hover { background:#FAFAFF !important; }
      `}</style>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: "#6D4AFF", marginBottom: 6, textTransform: "uppercase" }}>Student Fee Mapping</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 700, color: "#181B2A", lineHeight: 1.1 }}>Fee Assignment</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#A0A3B8" }}>Assign fee structures to students class by class, with concession and override support.</p>
        </div>
        <button
          style={primaryBtn()}
          onClick={() => {
            setBulkModal({ classId: "all", className: "All Classes" });
            setBulkClass("all");
            setBulkGroupId(feeGroups[0]?.id || null);
          }}
        >
          + Bulk Assign
        </button>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "#fff", border: "1px solid #E8E8EE", borderRadius: "10px 10px 0 0", borderBottom: "none" }}>
        <div style={{ fontSize: 13.5, color: "#5B5E72" }}>
          <span style={{ fontWeight: 700, color: "#181B2A" }}>{stats.assigned}</span> assigned · <span style={{ fontWeight: 700, color: "#F59E0B" }}>{stats.unassigned}</span> unassigned · <span style={{ fontWeight: 700, color: "#181B2A" }}>{stats.total}</span> total students
        </div>
        <button
          style={{ ...outlineBtn(true), fontSize: 13, color: "#6D4AFF", borderColor: "#c4b5fd" }}
          onClick={() => {
            setBulkModal({ classId: "all", className: "All Classes" });
            setBulkClass("all");
            setBulkGroupId(feeGroups[0]?.id || null);
          }}
        >
          Assign all unassigned →
        </button>
      </div>
      <div style={{ height: 3, background: "linear-gradient(90deg,#F59E0B,#FCD34D 50%,#FEF3C7)" }} />

      <div style={{ background: "#fff", border: "1px solid #E8E8EE", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 7 }}>SEARCH</div>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Name or admission number..."
            style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 9, padding: "0 12px", fontSize: 13.5, boxSizing: "border-box" }}
          />
        </div>

        <div style={{ minWidth: 130 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 7 }}>YEAR</div>
          <select value={academicYearId || ""} onChange={e => onYearChange(Number(e.target.value))} style={{ height: 40, border: "1px solid #E8E8EE", borderRadius: 9, padding: "0 12px", fontSize: 13.5, background: "#fff", width: "100%" }}>
            {academicYears.map(y => (
              <option key={y.id} value={y.id}>{y.name}</option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 170 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 7 }}>CLASS</div>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} style={{ height: 40, border: "1px solid #E8E8EE", borderRadius: 9, padding: "0 12px", fontSize: 13.5, background: "#fff", width: "100%" }}>
            <option value="all">All Classes</option>
            {classOptions.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: 170 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 7 }}>FEE GROUP</div>
          <select value={groupFilter} onChange={e => setGroupFilter(e.target.value)} style={{ height: 40, border: "1px solid #E8E8EE", borderRadius: 9, padding: "0 12px", fontSize: 13.5, background: "#fff", width: "100%" }}>
            <option value="all">All Groups</option>
            {groupOptions.map(g => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {([
          { key: "all", label: `All ${stats.total}` },
          { key: "unassigned", label: `Unassigned ${stats.unassigned}` },
          { key: "assigned", label: `Assigned ${stats.assigned}` },
        ] as { key: FilterTab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{ height: 36, padding: "0 18px", border: tab === t.key ? "none" : "1px solid #E8E8EE", borderRadius: 20, background: tab === t.key ? "#6D4AFF" : "#fff", color: tab === t.key ? "#fff" : "#5B5E72", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div style={{ textAlign: "center", color: "#A0A3B8", padding: "48px 0" }}>Loading fee assignment data...</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {filteredClassSections.map(cls => {
            const isExpanded = expanded.has(cls.id);
            const allSelected = cls.students.length > 0 && cls.students.every(s => selected.has(s.id));
            const assignedCount = cls.students.filter(s => s.assigned).length;

            return (
              <div key={cls.id} style={{ background: "#fff", border: "1px solid #E8E8EE", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 14 }}>
                  <div style={{ width: 4, height: 44, borderRadius: 2, background: "#6D4AFF", flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 3 }}>{cls.name}</div>
                    <div style={{ fontSize: 12.5, color: "#A0A3B8" }}>{cls.students.length} students · {assignedCount} assigned · {cls.students.length - assignedCount} unassigned</div>
                  </div>
                  <button
                    style={outlineBtn(true)}
                    onClick={() => {
                      setBulkModal({ classId: cls.id, className: cls.name });
                      setBulkClass(cls.name);
                      setBulkGroupId(feeGroups[0]?.id || null);
                    }}
                  >
                    Bulk Assign
                  </button>
                  <button style={{ ...outlineBtn(true), display: "flex", alignItems: "center", gap: 8 }} onClick={() => toggleExpand(cls.id)}>
                    {cls.students.length} shown
                  </button>
                </div>

                {isExpanded && (
                  <div style={{ borderTop: "1px solid #E8E8EE", animation: "fadeIn .15s ease" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr style={{ background: "#F8F8FB" }}>
                          <th style={{ ...TH, width: 44 }}>
                            <input type="checkbox" checked={allSelected} onChange={() => toggleSelectAll(cls.students, allSelected)} />
                          </th>
                          <th style={TH}>STUDENT</th>
                          <th style={TH}>PAYMENT SCHEDULES</th>
                          <th style={TH}>ANNUAL TOTAL</th>
                          <th style={TH}>AGREED PLAN</th>
                          <th style={TH}>ACTIONS</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cls.students.map((st, idx) => {
                          const checked = selected.has(st.id);
                          return (
                            <tr key={st.id} className="fa-row" style={{ borderBottom: idx < cls.students.length - 1 ? "1px solid #E8E8EE" : "none", background: checked ? "#F5F3FF" : "#fff" }}>
                              <td style={{ padding: "14px 16px", width: 44 }}>
                                <input type="checkbox" checked={checked} onChange={() => toggleSelect(st.id)} />
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: avatarBg(st.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700 }}>{initials(st.name)}</div>
                                  <div>
                                    <div style={{ fontSize: 13.5, fontWeight: 600, color: "#181B2A" }}>{st.name}</div>
                                    <div style={{ fontSize: 12, color: "#A0A3B8" }}>{st.admissionNo} · {st.groupName}</div>
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: "14px 16px", color: st.assigned ? "#181B2A" : "#A0A3B8", fontSize: 12.5 }}>{st.assigned ? "Group schedule" : "—"}</td>
                              <td style={{ padding: "14px 16px", fontSize: 13.5, fontWeight: st.annualTotal ? 600 : 400, color: st.annualTotal ? "#181B2A" : "#A0A3B8" }}>{st.annualTotal ? fmtRs(st.annualTotal) : "—"}</td>
                              <td style={{ padding: "14px 16px" }}>
                                {st.planAgreed ? (
                                  <span style={{ fontSize: 12.5, fontWeight: 600, padding: "4px 12px", borderRadius: 20, background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }}>✓ Plan Agreed</span>
                                ) : (
                                  <span style={{ fontSize: 12.5, fontWeight: 500, padding: "4px 12px", borderRadius: 20, background: "#F3F4F6", color: "#6B7280" }}>No plan yet</span>
                                )}
                              </td>
                              <td style={{ padding: "14px 16px" }}>
                                {!st.assigned ? (
                                  <button style={primaryBtn(true)} onClick={() => openAssignModal(st, false)}>Assign →</button>
                                ) : (
                                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                    <button style={outlineBtn(true)} onClick={() => openAssignModal(st, true)}>Edit Assignment</button>
                                    <button style={outlineBtn(true)} onClick={() => { setChangePlanModal({ student: st }); setSelectedPlan("3-term"); }}>Change Plan</button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}

          {!filteredClassSections.length && <div style={{ textAlign: "center", padding: "60px 0", color: "#A0A3B8", fontSize: 14 }}>No students match the current filters.</div>}
        </div>
      )}

      {assignModal && (
        <ModalShell onClose={() => setAssignModal(null)}>
          <ModalHeader title={assignModal.isEdit ? "Edit Assignment" : "Assign Fees"} subtitle={`${assignModal.student.name} · ${assignModal.student.admissionNo} · ${yearName}`} onClose={() => setAssignModal(null)} />
          <div style={{ padding: "14px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>FEE GROUP</div>
                <select value={modalGroupId || ""} onChange={e => setModalGroupId(Number(e.target.value) || null)} style={{ width: "100%", height: 36, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 10px", fontSize: 12.5 }}>
                  {feeGroups.filter(g => g.academic_year === academicYearId).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>CONCESSION</div>
                <select value={modalConcessionId} onChange={e => setModalConcessionId(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 10px", fontSize: 12.5 }}>
                  <option value={CONCESSION_NONE}>None</option>
                  {visibleConcessionRules.map(c => (
                    <option key={c.id} value={String(c.id)}>{c.name} ({c.discount_percentage}%)</option>
                  ))}
                </select>
              </div>
            </div>

            <div style={{ border: "1px solid #E8E8EE", borderRadius: 10, overflow: "hidden" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr", padding: "8px 14px", background: "#FAFAFA", borderBottom: "1px solid #E8E8EE" }}>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#A0A3B8" }}>Fee Type</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#A0A3B8" }}>Structure</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#A0A3B8", textAlign: "right" }}>Amount</div>
              </div>
              {currentSchedules.map((row, i) => (
                <div key={row.id || `${row.fee_type}-${i}`} style={{ display: "grid", gridTemplateColumns: "1.8fr 1fr 1fr", padding: "10px 14px", borderBottom: i < currentSchedules.length - 1 ? "1px solid #F0F0F0" : "none" }}>
                  <div style={{ fontSize: 12.5, color: "#181B2A" }}>{row.fee_type_name || `Fee Type #${row.fee_type}`}</div>
                  <div style={{ fontSize: 12, color: "#5B5E72" }}>{row.collection_frequency}</div>
                  <div style={{ fontSize: 12.5, fontWeight: 600, color: "#181B2A", textAlign: "right" }}>₹{parseMoney(row.amount).toLocaleString("en-IN")}</div>
                </div>
              ))}
              {!currentSchedules.length && <div style={{ padding: "12px 14px", fontSize: 12.5, color: "#A0A3B8" }}>No active schedules found for this fee group in selected year.</div>}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderTop: "2px solid #E8E8EE", background: "#F8F8FB" }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: "#181B2A" }}>Annual fees for this group</div>
                <div style={{ fontSize: 13.5, fontWeight: 700, color: "#181B2A" }}>₹{currentModalTotal.toLocaleString("en-IN")}</div>
              </div>
            </div>
          </div>
          <ModalFooter>
            <button style={{ ...outlineBtn(), minWidth: 90 }} onClick={() => setAssignModal(null)}>Cancel</button>
            <button style={{ ...primaryBtn(), minWidth: 130 }} onClick={confirmAssign} disabled={isMutating}>{isMutating ? "Saving..." : assignModal.isEdit ? "Save Changes" : "Assign Fees"}</button>
          </ModalFooter>
        </ModalShell>
      )}

      {changePlanModal && (
        <ModalShell onClose={() => setChangePlanModal(null)}>
          <ModalHeader title="Change Payment Plan" subtitle={`${changePlanModal.student.name} · ${changePlanModal.student.admissionNo}`} onClose={() => setChangePlanModal(null)} />
          <div style={{ padding: "14px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
            {PAYMENT_PLANS.map(plan => (
              <label key={plan.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1px solid", borderColor: selectedPlan === plan.id ? "#6D4AFF" : "#E8E8EE", borderRadius: 9, background: selectedPlan === plan.id ? "#F5F3FF" : "#fff" }}>
                <input type="radio" name="plan" checked={selectedPlan === plan.id} onChange={() => setSelectedPlan(plan.id)} style={{ accentColor: "#6D4AFF", width: 15, height: 15 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#181B2A" }}>{plan.label}</div>
                  <div style={{ fontSize: 12, color: "#A0A3B8" }}>{plan.desc}</div>
                </div>
              </label>
            ))}
          </div>
          <ModalFooter>
            <button style={{ ...outlineBtn(), minWidth: 90 }} onClick={() => setChangePlanModal(null)}>Cancel</button>
            <button style={{ ...primaryBtn(), minWidth: 160 }} onClick={confirmPlanSwitch} disabled={isMutating}>{isMutating ? "Updating..." : "Confirm Plan Switch"}</button>
          </ModalFooter>
        </ModalShell>
      )}

      {bulkModal && (
        <ModalShell onClose={() => setBulkModal(null)} maxWidth={600}>
          <ModalHeader title="Bulk Assign Fees" subtitle={`Assign a fee group to all unassigned students in ${bulkClass === "all" ? "All Classes" : bulkClass}.`} onClose={() => setBulkModal(null)} />
          <div style={{ padding: "14px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>CLASS</div>
                <select value={bulkClass} onChange={e => setBulkClass(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 10px", fontSize: 12.5 }}>
                  <option value="all">All Classes</option>
                  {classOptions.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>FEE GROUP</div>
                <select value={bulkGroupId || ""} onChange={e => setBulkGroupId(Number(e.target.value) || null)} style={{ width: "100%", height: 36, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 10px", fontSize: 12.5 }}>
                  {feeGroups.filter(g => g.academic_year === academicYearId).map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#5B5E72" }}>Applies to unassigned rows only and persists directly to backend assignments.</p>
          </div>
          <ModalFooter>
            <button style={{ ...outlineBtn(), minWidth: 90 }} onClick={() => setBulkModal(null)}>Cancel</button>
            <button style={{ ...primaryBtn(), minWidth: 160 }} onClick={confirmBulkAssign} disabled={isMutating}>{isMutating ? "Assigning..." : "Assign to Unassigned"}</button>
          </ModalFooter>
        </ModalShell>
      )}

      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#1e293b", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 13.5, boxShadow: "0 8px 28px rgba(0,0,0,0.22)", zIndex: 9999, maxWidth: 420, animation: "toastUp 0.2s ease" }}>
          {toast}
        </div>
      )}
    </>
  );
}
