"use client";

import { useEffect, useRef, useState } from "react";
import { feesApi, listData, type AcademicYear, type FeesGroup, type SchoolClass } from "@/lib/fees-api";
import { sortAcademicsClasses } from "@/lib/classOrdering";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Tab = "fee-groups" | "fee-types" | "fee-schedules" | "concession-rules" | "late-fee-rules";
type FeeStructure = "Term-wise" | "Monthly" | "Custom";

type AmountChip = { label: string; value: string };

type FeeTypeRow = {
  id: string;
  name: string;
  structure: FeeStructure;
  amounts: AmountChip[];
  grace: string;
  lateRule: string;
};

type FeeGroup = {
  id: string;
  initials: string;
  name: string;
  bg: string;
  summary: string;
  feeTypes: FeeTypeRow[];
};

type TermConfig = { name: string; dueDate: string };

// ─── Static data ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "fee-groups", label: "Fee Groups" },
  { id: "fee-types", label: "Fee Types" },
  { id: "fee-schedules", label: "Fee Schedules" },
  { id: "concession-rules", label: "Concession Rules" },
  { id: "late-fee-rules", label: "Late Fee Rules" },
];

const DEFAULT_TERMS: TermConfig[] = [
  { name: "Term 1 (Apr–Jul)", dueDate: "2026-04-10" },
  { name: "Term 2 (Aug–Nov)", dueDate: "2026-08-10" },
  { name: "Term 3 (Dec–Mar)", dueDate: "2026-12-10" },
  { name: "Term 4", dueDate: "2027-03-10" },
];

const ACADEMIC_TERMS = [
  { label: "Term 1", range: "01 Jun 2025 → 09 Sept 2025" },
  { label: "Term 2", range: "10 Sept 2025 → 19 Dec 2025" },
  { label: "Term 3", range: "20 Dec 2025 → 30 Mar 2026" },
  { label: "Term 4", range: "01 Apr 2026 → 31 May 2026" },
];

const FEE_GROUPS: FeeGroup[] = [
  {
    id: "day-scholar",
    initials: "DS",
    name: "Day Scholar",
    bg: "#7C3AED",
    summary: "6 fee types configured · ₹36,000 / yr + ₹5,000 custom + ₹2,000 custom + ₹4,500 / yr + ₹2,400 / yr + ₹3,000 custom",
    feeTypes: [
      {
        id: "ds-tuition", name: "Tuition Fee", structure: "Term-wise",
        amounts: [
          { label: "T1", value: "₹12,000" }, { label: "T2", value: "₹12,000" },
          { label: "T3", value: "₹12,000" }, { label: "T4", value: "₹12,000" },
        ],
        grace: "7 days", lateRule: "Rs. 50 daily, cap Rs. 1,500",
      },
      {
        id: "ds-admission", name: "Admission Fee", structure: "Custom",
        amounts: [{ label: "I1", value: "₹5,000 (01 Apr)" }],
        grace: "0 days", lateRule: "None",
      },
      {
        id: "ds-caution", name: "Caution Deposit", structure: "Custom",
        amounts: [{ label: "I1", value: "₹2,000 (01 Apr)" }],
        grace: "0 days", lateRule: "None",
      },
      {
        id: "ds-admin", name: "Administrative Fee", structure: "Term-wise",
        amounts: [
          { label: "T1", value: "₹1,500" }, { label: "T2", value: "₹1,500" },
          { label: "T3", value: "₹1,500" }, { label: "T4", value: "₹1,500" },
        ],
        grace: "10 days", lateRule: "Rs. 25 daily",
      },
      {
        id: "ds-lab", name: "Lab Fee", structure: "Term-wise",
        amounts: [
          { label: "T1", value: "₹800" }, { label: "T2", value: "₹800" },
          { label: "T3", value: "₹800" }, { label: "T4", value: "₹800" },
        ],
        grace: "10 days", lateRule: "None",
      },
      {
        id: "ds-building", name: "Building Fund", structure: "Custom",
        amounts: [
          { label: "I1", value: "₹1,500 (01 Apr)" },
          { label: "I2", value: "₹1,500 (01 Oct)" },
        ],
        grace: "15 days", lateRule: "None",
      },
    ],
  },
  {
    id: "transport-users",
    initials: "TU",
    name: "Transport Users",
    bg: "#0E7490",
    summary: "1 fee type configured · ₹2,800 / mo",
    feeTypes: [
      {
        id: "tu-transport", name: "Transport Fee", structure: "Monthly",
        amounts: [{ label: "", value: "₹2,800/month" }],
        grace: "5 days", lateRule: "Rs. 100 flat/week",
      },
    ],
  },
  {
    id: "full-boarder",
    initials: "FB",
    name: "Full Boarder",
    bg: "#16a34a",
    summary: "4 fee types configured · ₹42,000 / yr + ₹54,000 / yr + ₹4,200 / mo + ₹15,000 custom",
    feeTypes: [
      {
        id: "fb-tuition", name: "Tuition Fee", structure: "Term-wise",
        amounts: [
          { label: "T1", value: "₹14,000" }, { label: "T2", value: "₹14,000" },
          { label: "T3", value: "₹14,000" }, { label: "T4", value: "₹14,000" },
        ],
        grace: "7 days", lateRule: "Rs. 50 daily, cap Rs. 1,500",
      },
      {
        id: "fb-hostel", name: "Hostel Fee", structure: "Term-wise",
        amounts: [
          { label: "T1", value: "₹18,000" }, { label: "T2", value: "₹18,000" },
          { label: "T3", value: "₹18,000" }, { label: "T4", value: "₹18,000" },
        ],
        grace: "7 days", lateRule: "Rs. 100 daily",
      },
      {
        id: "fb-lunch", name: "Lunch Fee", structure: "Monthly",
        amounts: [{ label: "", value: "₹4,200/month" }],
        grace: "7 days", lateRule: "None",
      },
      {
        id: "fb-development", name: "Development Fund", structure: "Custom",
        amounts: [{ label: "I1", value: "₹15,000 (01 Jun)" }],
        grace: "10 days", lateRule: "None",
      },
    ],
  },
];

const CONCESSION_RULES = [
  { id: "staff",   name: "Staff Ward 50%",   scope: "Tuition Fee only",  discount: "50%",  status: "Active" },
  { id: "merit",   name: "Merit 25%",         scope: "Tuition + Dev Fund", discount: "25%", status: "Active" },
  { id: "need",    name: "Need-Based Full",   scope: "All fee types",     discount: "100%", status: "Active" },
  { id: "sibling", name: "Sibling 10%",       scope: "Tuition Fee only",  discount: "10%",  status: "Draft"  },
];

const LATE_FEE_RULES = [
  { id: "lr1", name: "Tuition late rule",        grace: "7 days",  penalty: "Rs. 50 daily",   cap: "Rs. 1,500" },
  { id: "lr2", name: "Transport weekly penalty", grace: "5 days",  penalty: "Rs. 200 / week", cap: "Rs. 800"   },
  { id: "lr3", name: "Development fund grace",   grace: "10 days", penalty: "Rs. 100 daily",  cap: "Rs. 2,000" },
  { id: "lr4", name: "Lunch fee reminder only",  grace: "3 days",  penalty: "None",           cap: "None"      },
];

const FEE_GROUPS_DATA = [
  { id: 1, name: "Day Scholar",        description: "Students attending regular day school",        students: "47 students", status: "Active" },
  { id: 2, name: "Transport Users",    description: "Students using school transport service",       students: "31 students", status: "Active" },
  { id: 3, name: "Full Boarder",       description: "Residential students on full board",           students: "12 students", status: "Active" },
  { id: 4, name: "Scholarship Review", description: "Students under financial assistance review",   students: "8 students",  status: "Draft"  },
];

const FEE_TYPES_DATA = [
  { id: 1, name: "Tuition Fee",      glCode: "4001-TUITION", taxable: "No",           structure: "Term-wise" },
  { id: 2, name: "Transport Fee",    glCode: "4002-TRANS",   taxable: "No",           structure: "Monthly"   },
  { id: 3, name: "Development Fund", glCode: "4003-DEVFUND", taxable: "No",           structure: "Custom"    },
  { id: 4, name: "Lunch Fee",        glCode: "4004-LUNCH",   taxable: "Yes (GST 5%)", structure: "Monthly"   },
];

// ─── Style helpers ─────────────────────────────────────────────────────────────

const STRUCTURE_BADGE: Record<FeeStructure, { bg: string; color: string; border: string }> = {
  "Term-wise": { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  "Monthly": { bg: "#fef3c7", color: "#d97706", border: "#fde68a" },
  "Custom": { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5" },
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #E8E8EE",
  borderRadius: 12,
  padding: "20px 24px",
};

function primaryBtn(small = false): React.CSSProperties {
  return {
    height: small ? 32 : 40,
    padding: small ? "0 14px" : "0 20px",
    background: "#6D4AFF",
    color: "#fff",
    border: "none",
    borderRadius: small ? 7 : 9,
    fontSize: small ? 12.5 : 13.5,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    boxShadow: "0 2px 8px rgba(109,74,255,0.20)",
  } as const;
}

function outlineBtn(small = false): React.CSSProperties {
  return {
    height: small ? 32 : 40,
    padding: small ? "0 14px" : "0 18px",
    background: "#fff",
    color: "#181B2A",
    border: "1px solid #E8E8EE",
    borderRadius: small ? 7 : 9,
    fontSize: small ? 12.5 : 13.5,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  } as const;
}

function dangerBtn(small = false): React.CSSProperties {
  return {
    height: small ? 32 : 40,
    padding: small ? "0 14px" : "0 18px",
    background: "#fff",
    color: "#dc2626",
    border: "1px solid #fca5a5",
    borderRadius: small ? 7 : 9,
    fontSize: small ? 12.5 : 13.5,
    fontWeight: 500,
    cursor: "pointer",
    whiteSpace: "nowrap",
  } as const;
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function FeeConfigurationPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("fee-schedules");
  const [numTerms, setNumTerms] = useState(3);
  const [terms, setTerms] = useState<TermConfig[]>(DEFAULT_TERMS);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");
  const [showInfo, setShowInfo] = useState(false);
  const [academicYears, setAcademicYears] = useState<AcademicYear[]>([]);
  const [academicYearId, setAcademicYearId] = useState<number | null>(null);
  const [feeGroups, setFeeGroups] = useState<FeesGroup[]>([]);
  const [isLoadingGroups, setIsLoadingGroups] = useState(false);
  const [feeGroupName, setFeeGroupName] = useState("");
  const [feeGroupDescription, setFeeGroupDescription] = useState("");
  const [availableClasses, setAvailableClasses] = useState<SchoolClass[]>([]);
  const [feeGroupClassIds, setFeeGroupClassIds] = useState<number[]>([]);
  const [classSearch, setClassSearch] = useState("");
  const [isClassDropdownOpen, setIsClassDropdownOpen] = useState(false);
  const [classError, setClassError] = useState("");
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  const [isCreateGroupOpen, setIsCreateGroupOpen] = useState(true);
  const [feeGroupPage, setFeeGroupPage] = useState(1);
  const feeGroupPageSize = 5;
  const [editingGroup, setEditingGroup] = useState<FeesGroup | null>(null);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editClassIds, setEditClassIds] = useState<number[]>([]);
  const [editClassSearch, setEditClassSearch] = useState("");
  const [isEditClassDropdownOpen, setIsEditClassDropdownOpen] = useState(false);
  const [editClassError, setEditClassError] = useState("");
  const [editStatus, setEditStatus] = useState(true);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deleteGroup, setDeleteGroup] = useState<FeesGroup | null>(null);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [togglingGroupId, setTogglingGroupId] = useState<number | null>(null);
  const classDropdownRef = useRef<HTMLDivElement | null>(null);
  const editClassDropdownRef = useRef<HTMLDivElement | null>(null);

  // ── Add Fee Schedule inline form ──
  const [showAddForm, setShowAddForm] = useState(false);
  const [formGroup, setFormGroup] = useState(FEE_GROUPS[0].name);
  const [formFeeType, setFormFeeType] = useState("Tuition Fee");
  const [formStructure, setFormStructure] = useState("Term-wise");
  const [formGrace, setFormGrace] = useState("7");
  const [formLateRule, setFormLateRule] = useState("Rs. 50 daily, cap Rs. 1,500");
  const [formAmounts, setFormAmounts] = useState<string[]>(["12000", "12000", "12000", "12000"]);

  const resetAddForm = () => {
    setFormGroup(FEE_GROUPS[0].name);
    setFormFeeType("Tuition Fee");
    setFormStructure("Term-wise");
    setFormGrace("7");
    setFormLateRule("Rs. 50 daily, cap Rs. 1,500");
    setFormAmounts(["12000", "12000", "12000", "12000"]);
    setShowAddForm(false);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  useEffect(() => {
    let active = true;
    feesApi
      .listAcademicYears()
      .then(payload => {
        if (!active) return;
        const years = listData(payload);
        setAcademicYears(years);
        const current = years.find(year => year.is_current) || years[0];
        setAcademicYearId(current?.id ?? null);
      })
      .catch(() => {
        if (!active) return;
        showToast("Unable to load academic years.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    feesApi
      .listClasses()
      .then(payload => {
        if (!active) return;
        const sorted = sortAcademicsClasses(listData(payload));
        setAvailableClasses(sorted);
      })
      .catch(() => {
        if (!active) return;
        showToast("Unable to load classes.");
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (
        classDropdownRef.current &&
        !classDropdownRef.current.contains(event.target as Node)
      ) {
        setIsClassDropdownOpen(false);
      }
      if (
        editClassDropdownRef.current &&
        !editClassDropdownRef.current.contains(event.target as Node)
      ) {
        setIsEditClassDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const fetchFeeGroups = async () => {
    setIsLoadingGroups(true);
    try {
      const payload = await feesApi.listGroups();
      setFeeGroups(listData(payload));
    } catch (error) {
      showToast("Unable to load fee groups.");
    } finally {
      setIsLoadingGroups(false);
    }
  };

  useEffect(() => {
    fetchFeeGroups();
  }, []);

  function ghostBtn(small = false): React.CSSProperties {
    return {
      height: small ? 30 : 36,
      padding: small ? "0 12px" : "0 16px",
      background: "#f7f7fb",
      color: "#4b5563",
      border: "1px solid #e4e7f1",
      borderRadius: small ? 7 : 9,
      fontSize: small ? 12 : 13,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap",
    } as const;
  }

  const handleCreateGroup = async () => {
    if (!academicYearId) {
      showToast("Select an academic year first.");
      return;
    }
    if (!feeGroupName.trim()) {
      showToast("Group name is required.");
      return;
    }
    if (feeGroupClassIds.length === 0) {
      setClassError("Please select at least one applicable class.");
      showToast("Please select at least one applicable class.");
      return;
    }

    setIsSavingGroup(true);
    try {
      await feesApi.createGroup({
        academic_year: academicYearId,
        name: feeGroupName.trim(),
        description: feeGroupDescription.trim() || undefined,
        applicable_classes: feeGroupClassIds,
      });
      showToast("Fee group saved.");
      await fetchFeeGroups();
      setFeeGroupName("");
      setFeeGroupDescription("");
      setFeeGroupClassIds([]);
      setClassSearch("");
      setClassError("");
    } catch (error) {
      showToast("Failed to save fee group.");
    } finally {
      setIsSavingGroup(false);
    }
  };

  const toggleGroup = (id: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const openEditPanel = (group: FeesGroup) => {
    setEditingGroup(group);
    setEditName(group.name);
    setEditDescription(group.description || "");
    setEditClassIds(group.applicable_classes || []);
    setEditClassSearch("");
    setEditClassError("");
    setEditStatus(group.is_active);
    setIsEditOpen(true);
  };

  const closeEditPanel = () => {
    setIsEditOpen(false);
    setEditingGroup(null);
  };

  const handleSaveEdit = async () => {
    if (!editingGroup) return;
    if (!editName.trim()) {
      showToast("Group name is required.");
      return;
    }
    if (editClassIds.length === 0) {
      setEditClassError("Please select at least one applicable class.");
      showToast("Please select at least one applicable class.");
      return;
    }
    setIsSavingEdit(true);
    try {
      await feesApi.updateGroup(editingGroup.id, {
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        applicable_classes: editClassIds,
        is_active: editStatus,
      });
      showToast("Fee group updated.");
      await fetchFeeGroups();
      closeEditPanel();
    } catch (error) {
      showToast("Failed to update fee group.");
    } finally {
      setIsSavingEdit(false);
    }
  };

  const openDeleteDialog = (group: FeesGroup) => {
    setDeleteError("");
    setDeleteGroup(group);
    setIsDeleteOpen(true);
  };

  const closeDeleteDialog = () => {
    setIsDeleteOpen(false);
    setDeleteGroup(null);
    setDeleteError("");
  };

  const getStudentCount = (group: FeesGroup) => {
    const anyGroup = group as FeesGroup & { student_count?: number; studentCount?: number };
    return anyGroup.student_count ?? anyGroup.studentCount ?? 0;
  };

  const totalFeeGroupPages = Math.max(1, Math.ceil(feeGroups.length / feeGroupPageSize));
  const feeGroupPageSafe = Math.min(feeGroupPage, totalFeeGroupPages);
  const feeGroupStart = (feeGroupPageSafe - 1) * feeGroupPageSize;
  const feeGroupEnd = feeGroupStart + feeGroupPageSize;
  const visibleFeeGroups = feeGroups.slice(feeGroupStart, feeGroupEnd);

  const handleDeleteGroup = async () => {
    if (!deleteGroup) return;
    setIsDeleting(true);
    setDeleteError("");
    try {
      await feesApi.deleteGroup(deleteGroup.id);
      await fetchFeeGroups();
      closeDeleteDialog();
      showToast("Fee group deleted.");
    } catch (error) {
      setDeleteError("This fee group could not be deleted. Please try again.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleToggleGroup = async (group: FeesGroup) => {
    setTogglingGroupId(group.id);
    try {
      await feesApi.updateGroup(group.id, { is_active: !group.is_active });
      await fetchFeeGroups();
    } catch (error) {
      showToast("Failed to update status.");
    } finally {
      setTogglingGroupId(null);
    }
  };

  const currentAcademicYearName =
    academicYears.find(year => year.id === academicYearId)?.name || "Unknown";

  const getDisplayAmounts = (row: FeeTypeRow): AmountChip[] =>
    row.structure === "Term-wise" ? row.amounts.slice(0, numTerms) : row.amounts;

  const fmtDate = (s: string): string => {
    try {
      const d = new Date(s + "T00:00:00");
      return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
    } catch { return s; }
  };

  // ── Shared helpers ───────────────────────────────────────────────────────────

  const inputField = (_placeholder: string): React.CSSProperties => ({
    width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8,
    padding: "0 12px", fontSize: 13.5, background: "#fff",
  });

  const thStyle: React.CSSProperties = {
    padding: "12px 16px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.07em",
    color: "#A0A3B8",
    textAlign: "left",
    borderBottom: "1px solid #E8E8EE",
  };

  const tdStyle: React.CSSProperties = { padding: "15px 16px", fontSize: 13.5, color: "#181B2A" };
  const tdMuted: React.CSSProperties = { padding: "15px 16px", fontSize: 13.5, color: "#5B5E72" };

  const statusPill = (status: string) => (
    <span style={{
      fontSize: 11,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 12,
      background: status === "Active" ? "#dcfce7" : "#f3f4f6",
      color: status === "Active" ? "#15803d" : "#6B7280",
      lineHeight: "16px",
    }}>
      {status}
    </span>
  );

  const rowActions = (group: FeesGroup) => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button style={outlineBtn(true)} onClick={() => openEditPanel(group)}>Edit</button>
      <button style={dangerBtn(true)} onClick={() => openDeleteDialog(group)}>Delete</button>
    </div>
  );

  const rowActionsLite = (label: string) => (
    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
      <button style={outlineBtn(true)} onClick={() => showToast(`Edit ${label} — would open editor in production.`)}>Edit</button>
      <button style={dangerBtn(true)} onClick={() => showToast(`Delete ${label} — confirm in production.`)}>Delete</button>
    </div>
  );

  const groupCardStyle: React.CSSProperties = {
    background: "#fff",
    border: "1px solid #E8E8EE",
    borderRadius: 12,
    padding: "18px 20px",
    boxShadow: "0 1px 2px rgba(20,24,40,.04)",
    position: "relative",
  };

  const groupAccentStyle: React.CSSProperties = {
    position: "absolute",
    left: 0,
    top: 14,
    bottom: 14,
    width: 5,
    background: "#5B4FCF",
    borderRadius: "0 4px 4px 0",
  };

  // ── Fee Groups tab ──────────────────────────────────────────────────────────

  const renderFeeGroups = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Create form */}
      <div style={card}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 3 }}>Create Fee Group</div>
            <div style={{ fontSize: 12.5, color: "#A0A3B8" }}>
              Rows update immediately — each action maps to a feesApi call in production.
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsCreateGroupOpen(prev => !prev)}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              border: "1px solid #E8E8EE",
              background: "#fff",
              color: "#5B5E72",
              cursor: "pointer",
              fontSize: 16,
              lineHeight: "32px",
              transform: isCreateGroupOpen ? "rotate(0deg)" : "rotate(-90deg)",
              transition: "transform 0.2s ease",
            }}
            aria-label={isCreateGroupOpen ? "Collapse create fee group" : "Expand create fee group"}
          >
            ▼
          </button>
        </div>
        {isCreateGroupOpen && (
          <>
            <div style={{ fontSize: 11.5, color: "#6B7280", margin: "12px 0" }}>
              Academic year: {currentAcademicYearName}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>GROUP NAME</div>
                <input
                  placeholder="Day Scholar"
                  style={inputField("Day Scholar")}
                  value={feeGroupName}
                  onChange={event => setFeeGroupName(event.target.value)}
                />
              </div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>DESCRIPTION</div>
                <input
                  placeholder="Regular day school students"
                  style={inputField("Regular day school students")}
                  value={feeGroupDescription}
                  onChange={event => setFeeGroupDescription(event.target.value)}
                />
              </div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>APPLICABLE CLASSES</div>
                <div ref={classDropdownRef} style={{ position: "relative" }}>
                  <button
                    type="button"
                    onClick={() => setIsClassDropdownOpen(prev => !prev)}
                    style={{
                      ...inputField(""),
                      width: "100%",
                      textAlign: "left",
                      display: "flex",
                      flexWrap: "wrap",
                      gap: 6,
                      padding: "8px 10px",
                      minHeight: 40,
                      alignItems: "center",
                    }}
                  >
                    {feeGroupClassIds.length === 0 ? (
                      <span style={{ color: "#9aa0b2", fontSize: 13 }}>Select classes</span>
                    ) : (
                      feeGroupClassIds.map(id => (
                        <span
                          key={id}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "4px 8px",
                            borderRadius: 999,
                            background: "#f4f5fb",
                            color: "#1f2937",
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {availableClasses.find(item => item.id === id)?.name || "Class"}
                          <button
                            type="button"
                            onClick={event => {
                              event.stopPropagation();
                              setFeeGroupClassIds(prev => prev.filter(value => value !== id));
                            }}
                            style={{
                              border: "none",
                              background: "transparent",
                              cursor: "pointer",
                              fontSize: 12,
                              color: "#6b7280",
                            }}
                            aria-label="Remove class"
                          >
                            ×
                          </button>
                        </span>
                      ))
                    )}
                  </button>
                  {isClassDropdownOpen && (
                    <div
                      style={{
                        position: "absolute",
                        zIndex: 20,
                        top: "100%",
                        left: 0,
                        right: 0,
                        marginTop: 6,
                        background: "#fff",
                        borderRadius: 12,
                        border: "1px solid #E8E8EE",
                        boxShadow: "0 16px 40px rgba(15, 23, 42, 0.12)",
                        padding: 12,
                      }}
                    >
                      <input
                        placeholder="Search classes"
                        value={classSearch}
                        onChange={event => setClassSearch(event.target.value)}
                        style={{
                          ...inputField(""),
                          width: "100%",
                          marginBottom: 10,
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                        <button
                          type="button"
                          onClick={() => setFeeGroupClassIds(availableClasses.map(item => item.id))}
                          style={ghostBtn(true)}
                        >
                          Select all
                        </button>
                        <button
                          type="button"
                          onClick={() => setFeeGroupClassIds([])}
                          style={ghostBtn(true)}
                        >
                          Clear all
                        </button>
                      </div>
                      <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                        {availableClasses
                          .filter(item => item.name?.toLowerCase().includes(classSearch.trim().toLowerCase()))
                          .map(item => {
                            const checked = feeGroupClassIds.includes(item.id);
                            return (
                              <button
                                type="button"
                                key={item.id}
                                onClick={() => {
                                  setClassError("");
                                  setFeeGroupClassIds(prev =>
                                    prev.includes(item.id)
                                      ? prev.filter(value => value !== item.id)
                                      : [...prev, item.id]
                                  );
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 10,
                                  padding: "8px 10px",
                                  borderRadius: 10,
                                  border: "1px solid #EEF0F4",
                                  background: checked ? "#f2f3ff" : "#fff",
                                  color: "#1f2937",
                                  cursor: "pointer",
                                }}
                              >
                                <span
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 4,
                                    border: checked ? "1px solid #5B4FCF" : "1px solid #cbd5f0",
                                    background: checked ? "#5B4FCF" : "#fff",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    color: "#fff",
                                    fontSize: 11,
                                  }}
                                >
                                  {checked ? "✓" : ""}
                                </span>
                                <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
                              </button>
                            );
                          })}
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsClassDropdownOpen(false)}
                        style={{
                          marginTop: 12,
                          width: "100%",
                          height: 36,
                          borderRadius: 10,
                          border: "none",
                          background: "#111827",
                          color: "#fff",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Apply selection
                      </button>
                    </div>
                  )}
                </div>
                {classError ? (
                  <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{classError}</div>
                ) : null}
                <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                  {feeGroupClassIds.length} Classes Selected
                </div>
              </div>
            </div>
            <button
              style={{ ...primaryBtn(), minWidth: 160, paddingLeft: 32, paddingRight: 32 }}
              onClick={handleCreateGroup}
              disabled={isSavingGroup}
            >
              {isSavingGroup ? "Saving..." : "Add"}
            </button>
          </>
        )}
      </div>

      {/* Fee group cards */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {isLoadingGroups ? (
          <div style={{ ...card, color: "#5B5E72" }}>Loading fee groups...</div>
        ) : feeGroups.length === 0 ? (
          <div style={{ ...card, color: "#5B5E72" }}>No fee groups yet.</div>
        ) : (
          visibleFeeGroups.map(group => {
            const studentCount = getStudentCount(group);
            const studentLabel = studentCount > 0 ? `${studentCount} students` : "—";
            return (
              <div key={group.id} style={groupCardStyle}>
                <div style={groupAccentStyle} />
                <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1.6fr .7fr .8fr auto", gap: 16, alignItems: "center" }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#1d2230" }}>{group.name}</div>
                  <div style={{ fontSize: 12.5, color: "#3b4150" }}>{group.description || "—"}</div>
                  <div style={{ fontSize: 12.5, color: "#3b4150" }}>{studentLabel}</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {statusPill(group.is_active ? "Active" : "Inactive")}
                    <button
                      type="button"
                      onClick={() => handleToggleGroup(group)}
                      disabled={togglingGroupId === group.id}
                      style={{
                        position: "relative",
                        width: 32,
                        height: 18,
                        borderRadius: 999,
                        border: "1px solid #E8E8EE",
                        background: group.is_active ? "#e6f6ee" : "#f3f4f6",
                        cursor: togglingGroupId === group.id ? "not-allowed" : "pointer",
                        opacity: togglingGroupId === group.id ? 0.6 : 1,
                      }}
                      aria-label={group.is_active ? "Deactivate group" : "Activate group"}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: group.is_active ? 16 : 2,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: group.is_active ? "#1d9e63" : "#8a90a2",
                          transition: "left 0.2s ease",
                        }}
                      />
                    </button>
                  </div>
                  <div>{rowActions(group)}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
      {!isLoadingGroups && feeGroups.length > 0 && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setFeeGroupPage(prev => Math.max(1, prev - 1))}
            disabled={feeGroupPageSafe <= 1}
            style={{
              height: 28,
              minWidth: 28,
              borderRadius: 8,
              border: "1px solid #E8E8EE",
              background: "#fff",
              color: "#5B5E72",
              fontSize: 12,
              cursor: feeGroupPageSafe <= 1 ? "not-allowed" : "pointer",
              opacity: feeGroupPageSafe <= 1 ? 0.5 : 1,
            }}
            aria-label="Previous page"
          >
            &lt;
          </button>
          {Array.from({ length: totalFeeGroupPages }, (_, index) => {
            const page = index + 1;
            return (
              <button
                key={page}
                type="button"
                onClick={() => setFeeGroupPage(page)}
                style={{
                  height: 28,
                  minWidth: 28,
                  borderRadius: 8,
                  border: "1px solid #E8E8EE",
                  background: page === feeGroupPageSafe ? "#5B4FCF" : "#fff",
                  color: page === feeGroupPageSafe ? "#fff" : "#5B5E72",
                  fontSize: 12,
                  cursor: "pointer",
                }}
                aria-current={page === feeGroupPageSafe ? "page" : undefined}
              >
                {page}
              </button>
            );
          })}
          <button
            type="button"
            onClick={() => setFeeGroupPage(prev => Math.min(totalFeeGroupPages, prev + 1))}
            disabled={feeGroupPageSafe >= totalFeeGroupPages}
            style={{
              height: 28,
              minWidth: 28,
              borderRadius: 8,
              border: "1px solid #E8E8EE",
              background: "#fff",
              color: "#5B5E72",
              fontSize: 12,
              cursor: feeGroupPageSafe >= totalFeeGroupPages ? "not-allowed" : "pointer",
              opacity: feeGroupPageSafe >= totalFeeGroupPages ? 0.5 : 1,
            }}
            aria-label="Next page"
          >
            &gt;
          </button>
        </div>
      )}
    </div>
  );

  // ── Fee Types tab ────────────────────────────────────────────────────────────

  const renderFeeTypes = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Create form */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 3 }}>Create Fee Type</div>
        <div style={{ fontSize: 12.5, color: "#A0A3B8", marginBottom: 18 }}>
          Rows update immediately — each action maps to a feesApi call in production.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
          {[
            { label: "FEE TYPE NAME",      ph: "Tuition Fee" },
            { label: "GL CODE",            ph: "4001-TUITION" },
            { label: "TAXABLE",            ph: "No" },
            { label: "DEFAULT STRUCTURE",  ph: "Term-wise" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>{f.label}</div>
              <input placeholder={f.ph} style={inputField(f.ph)} />
            </div>
          ))}
        </div>
        <button
          style={{ ...primaryBtn(), minWidth: 160, paddingLeft: 32, paddingRight: 32 }}
          onClick={() => showToast("Fee type added — would save to feesApi in production.")}
        >
          Add
        </button>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8F8FB" }}>
              {["NAME", "GL CODE", "TAXABLE", "DEFAULT STRUCTURE", "ACTIONS"].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {FEE_TYPES_DATA.map((ft, i) => (
              <tr key={ft.id} style={{ borderBottom: i < FEE_TYPES_DATA.length - 1 ? "1px solid #E8E8EE" : "none" }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{ft.name}</td>
                <td style={tdMuted}>{ft.glCode}</td>
                <td style={tdMuted}>{ft.taxable}</td>
                <td style={tdMuted}>{ft.structure}</td>
                <td style={tdStyle}>{rowActionsLite(ft.name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Fee Schedules tab ────────────────────────────────────────────────────────

  const renderFeeSchedules = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>

      {/* Academic Calendar card */}
      <div style={{ background: "#eef0ff", border: "1px solid #ddd8f8", borderRadius: 12, padding: "18px 22px", marginBottom: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "#6D4AFF" }}>
              📅 ACADEMIC CALENDAR
            </span>
            <span style={{ fontSize: 12, fontWeight: 700, background: "#6D4AFF", color: "#fff", padding: "2px 10px", borderRadius: 20 }}>
              2025-26
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, background: "#E8E8EE", color: "#5B5E72", padding: "2px 10px", borderRadius: 20 }}>
              CBSE
            </span>
            <span style={{ fontSize: 12, fontWeight: 600, background: "#dcfce7", color: "#15803d", padding: "2px 10px", borderRadius: 20 }}>
              Active Year
            </span>
          </div>
          <button
            style={{ ...outlineBtn(true), fontSize: 12, height: 30 }}
            onClick={() => showToast("Academic calendar dates applied to term settings.")}
          >
            Use These Dates →
          </button>
        </div>

        <div style={{ display: "flex", gap: 40, marginTop: 14, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 4 }}>YEAR START</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#181B2A" }}>01 Jun 2025</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 4 }}>YEAR END</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#181B2A" }}>31 Mar 2026</div>
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 4 }}>BASED ON</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#181B2A" }}>{numTerms} Fee Term{numTerms > 1 ? "s" : ""}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {ACADEMIC_TERMS.slice(0, numTerms).map(t => (
            <div key={t.label} style={{
              background: "#fff", border: "1px solid #c7c2f8", borderRadius: 10,
              padding: "10px 16px", flex: "1 1 160px", minWidth: 160,
            }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6D4AFF", marginBottom: 4 }}>{t.label}</div>
              <div style={{ fontSize: 12.5, color: "#5B5E72" }}>{t.range}</div>
            </div>
          ))}
        </div>
      </div>

      {/* School Term Settings */}
      <div style={{ ...card, marginBottom: 20, borderRadius: 12 }}>
        <div style={{ marginBottom: 18 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 4 }}>School Term Settings</div>
          <div style={{ fontSize: 13, color: "#A0A3B8" }}>
            Set how many terms your school uses. This controls term slots in all fee schedules below.
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 20 }}>
          <div style={{ flex: "0 0 auto", minWidth: 180 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 8 }}>
              NUMBER OF TERMS PER YEAR
            </div>
            <select
              value={numTerms}
              onChange={e => setNumTerms(Number(e.target.value))}
              style={{
                height: 40, border: "1px solid #E8E8EE", borderRadius: 8,
                padding: "0 12px", fontSize: 13.5, width: "100%",
                background: "#fff", cursor: "pointer",
              }}
            >
              {[1, 2, 3, 4].map(n => (
                <option key={n} value={n}>{n} Term{n > 1 ? "s" : ""} per year</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 1, paddingTop: 20 }}>
            <div style={{ fontSize: 13, color: "#A0A3B8", lineHeight: 1.5 }}>
              Changing the term count re-slots all fee schedules.<br />
              Term names and due dates below update automatically.
            </div>
          </div>
          <div style={{ paddingTop: 18 }}>
            <button style={primaryBtn()} onClick={() => showToast("Term settings saved successfully.")}>
              Save Term Settings
            </button>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
          {Array.from({ length: numTerms }).map((_, i) => (
            <div
              key={i}
              style={{
                display: "flex", alignItems: "center", gap: 20,
                padding: "18px 0",
                borderTop: i > 0 ? "1px solid #E8E8EE" : "none",
              }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: "#6D4AFF", color: "#fff",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
              }}>
                {i + 1}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>
                  TERM {i + 1} NAME
                </div>
                <input
                  type="text"
                  value={terms[i]?.name ?? `Term ${i + 1}`}
                  onChange={e => {
                    const next = [...terms];
                    next[i] = { ...next[i], name: e.target.value };
                    setTerms(next);
                  }}
                  style={{
                    width: "100%", height: 40, border: "1px solid #E8E8EE",
                    borderRadius: 8, padding: "0 12px", fontSize: 13.5,
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>
                  DEFAULT DUE DATE
                </div>
                <input
                  type="date"
                  value={terms[i]?.dueDate ?? "2026-04-10"}
                  onChange={e => {
                    const next = [...terms];
                    next[i] = { ...next[i], dueDate: e.target.value };
                    setTerms(next);
                  }}
                  style={{
                    width: "100%", height: 40, border: "1px solid #E8E8EE",
                    borderRadius: 8, padding: "0 12px", fontSize: 13.5,
                    background: "#fff", cursor: "pointer",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fee Schedule per Group */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: showAddForm ? 16 : 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 4 }}>Fee Schedule per Group</div>
            <div style={{ fontSize: 13, color: "#A0A3B8", lineHeight: 1.5 }}>
              Each group contains multiple fee types — configure amounts and collection structures independently for each type.
            </div>
          </div>
          {showAddForm ? (
            <button
              style={{ ...outlineBtn(), color: "#dc2626", borderColor: "#fca5a5" }}
              onClick={resetAddForm}
            >
              – Close Form
            </button>
          ) : (
            <button style={primaryBtn()} onClick={() => { setFormGroup(FEE_GROUPS[0].name); setShowAddForm(true); }}>
              + Add Fee Schedule
            </button>
          )}
        </div>

        {/* ── Inline Add Fee Schedule Form ────────────────────────────── */}
        {showAddForm && (
          <div style={{
            border: "1px solid #E8E8EE", borderRadius: 12,
            padding: "20px 22px", marginBottom: 16,
            background: "#fff",
            animation: "expandIn 0.18s ease",
          }}>
            {/* Row 1: Fee Group | Fee Type | Collection Structure */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 18 }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>FEE GROUP</div>
                <select
                  value={formGroup}
                  onChange={e => setFormGroup(e.target.value)}
                  style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 12px", fontSize: 13.5, background: "#fff", cursor: "pointer" }}
                >
                  {FEE_GROUPS.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>FEE TYPE</div>
                <select
                  value={formFeeType}
                  onChange={e => setFormFeeType(e.target.value)}
                  style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 12px", fontSize: 13.5, background: "#fff", cursor: "pointer" }}
                >
                  {["Tuition Fee", "Admission Fee", "Caution Deposit", "Administrative Fee", "Lab Fee", "Building Fund", "Transport Fee", "Hostel Fee", "Lunch Fee", "Development Fund"].map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>COLLECTION STRUCTURE</div>
                <select
                  value={formStructure}
                  onChange={e => setFormStructure(e.target.value)}
                  style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 12px", fontSize: 13.5, background: "#fff", cursor: "pointer" }}
                >
                  <option value="Term-wise">Term-wise ({numTerms} term{numTerms > 1 ? "s" : ""})</option>
                  <option value="Monthly">Monthly</option>
                  <option value="Custom">Custom</option>
                </select>
              </div>
            </div>

            {/* Row 2: Grace Period | Late Fee Rule */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>GRACE PERIOD (DAYS)</div>
                <input
                  type="number"
                  min="0"
                  value={formGrace}
                  onChange={e => setFormGrace(e.target.value)}
                  style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 12px", fontSize: 13.5 }}
                />
              </div>
              <div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>LATE FEE RULE</div>
                <input
                  type="text"
                  value={formLateRule}
                  onChange={e => setFormLateRule(e.target.value)}
                  placeholder="e.g. Rs. 50 daily, cap Rs. 1,500"
                  style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 12px", fontSize: 13.5 }}
                />
              </div>
            </div>

            {/* Term / installment rows */}
            {formStructure === "Term-wise" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 22 }}>
                {Array.from({ length: numTerms }).map((_, i) => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "16px 0",
                    borderTop: i > 0 ? "1px solid #E8E8EE" : "none",
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: "#6D4AFF", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700,
                    }}>
                      {i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>
                        {terms[i]?.name?.toUpperCase() ?? `TERM ${i + 1}`} — AMOUNT (RS.)
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={formAmounts[i] ?? ""}
                        onChange={e => {
                          const next = [...formAmounts];
                          next[i] = e.target.value;
                          setFormAmounts(next);
                        }}
                        style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 12px", fontSize: 13.5 }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>DUE DATE</div>
                      <div style={{
                        height: 40, border: "1px solid #E8E8EE", borderRadius: 8,
                        padding: "0 12px", fontSize: 13.5, display: "flex", alignItems: "center",
                        color: "#181B2A", background: "#F8F8FB",
                      }}>
                        {fmtDate(terms[i]?.dueDate ?? "")}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {formStructure === "Monthly" && (
              <div style={{ marginBottom: 22 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>AMOUNT PER MONTH (RS.)</div>
                <input
                  type="number"
                  min="0"
                  value={formAmounts[0] ?? ""}
                  onChange={e => { const next = [...formAmounts]; next[0] = e.target.value; setFormAmounts(next); }}
                  style={{ width: "50%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 12px", fontSize: 13.5 }}
                />
              </div>
            )}

            {formStructure === "Custom" && (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 22 }}>
                {[0, 1].map(i => (
                  <div key={i} style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "16px 0",
                    borderTop: i > 0 ? "1px solid #E8E8EE" : "none",
                  }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
                      background: "#6D4AFF", color: "#fff",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: 13, fontWeight: 700,
                    }}>
                      I{i + 1}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>
                        INSTALMENT {i + 1} — AMOUNT (RS.)
                      </div>
                      <input
                        type="number"
                        min="0"
                        value={formAmounts[i] ?? ""}
                        onChange={e => { const next = [...formAmounts]; next[i] = e.target.value; setFormAmounts(next); }}
                        style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 12px", fontSize: 13.5 }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>DUE DATE</div>
                      <input
                        type="date"
                        style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 12px", fontSize: 13.5, background: "#fff" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Action buttons */}
            <div style={{ display: "flex", gap: 10 }}>
              <button
                style={primaryBtn()}
                onClick={() => { showToast(`Fee schedule saved for ${formGroup} — ${formFeeType}.`); resetAddForm(); }}
              >
                Save Schedule
              </button>
              <button style={outlineBtn()} onClick={resetAddForm}>Cancel</button>
            </div>
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FEE_GROUPS.map(group => {
            const isExpanded = expandedGroups.has(group.id);
            return (
              <div key={group.id} style={{ border: "1px solid #E8E8EE", borderRadius: 12, overflow: "hidden" }}>

                {/* Group header row — click anywhere to toggle */}
                <div
                  onClick={() => toggleGroup(group.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 14,
                    padding: "16px 20px",
                    background: "#fff",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  <div style={{
                    width: 42, height: 42, borderRadius: 10, flexShrink: 0,
                    background: group.bg, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 13, fontWeight: 700,
                  }}>
                    {group.initials}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 3 }}>{group.name}</div>
                    <div style={{ fontSize: 12.5, color: "#A0A3B8", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {group.summary}
                    </div>
                  </div>
                  {/* Stop propagation so "+ Add Fee Type" doesn't also toggle */}
                  <div onClick={e => e.stopPropagation()}>
                    <button
                      style={{ ...outlineBtn(true), fontSize: 12.5 }}
                      onClick={() => { setFormGroup(group.name); setShowAddForm(true); }}
                    >
                      + Add Fee Type
                    </button>
                  </div>
                  {/* Chevron */}
                  <svg
                    width="16" height="16" viewBox="0 0 24 24" fill="none"
                    stroke="#A0A3B8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                    style={{
                      flexShrink: 0,
                      transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.22s ease",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>

                {/* Expanded fee type rows */}
                {isExpanded && (
                  <div style={{ borderTop: "1px solid #E8E8EE" }}>
                    {/* Column headers */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "1.4fr 1fr 2.4fr 0.8fr 1.6fr 0.7fr",
                      padding: "10px 20px",
                      background: "#F8F8FB",
                      borderBottom: "1px solid #E8E8EE",
                    }}>
                      {["FEE TYPE", "STRUCTURE", "AMOUNT / PLAN", "GRACE", "LATE FEE RULE", "ACTIONS"].map(h => (
                        <div key={h} style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8" }}>
                          {h}
                        </div>
                      ))}
                    </div>

                    {group.feeTypes.map((row, ri) => (
                      <div
                        key={row.id}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "1.4fr 1fr 2.4fr 0.8fr 1.6fr 0.7fr",
                          padding: "18px 20px",
                          alignItems: "center",
                          borderBottom: ri < group.feeTypes.length - 1 ? "1px solid #E8E8EE" : "none",
                          background: "#fff",
                          animation: "expandIn 0.18s ease",
                        }}
                      >
                        <div style={{ fontSize: 13.5, fontWeight: 600, color: "#181B2A" }}>{row.name}</div>
                        <div>
                          <span style={{
                            fontSize: 11.5, fontWeight: 600,
                            padding: "3px 10px", borderRadius: 20,
                            background: STRUCTURE_BADGE[row.structure].bg,
                            color: STRUCTURE_BADGE[row.structure].color,
                            border: `1px solid ${STRUCTURE_BADGE[row.structure].border}`,
                          }}>
                            {row.structure}
                          </span>
                        </div>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {getDisplayAmounts(row).map(chip => (
                            <span key={chip.label + chip.value} style={{
                              fontSize: 12, fontWeight: 500, padding: "3px 9px", borderRadius: 6,
                              background: "#F0F0F8", color: "#181B2A", border: "1px solid #E0E0F0",
                            }}>
                              {chip.label ? `${chip.label}: ${chip.value}` : chip.value}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: 13, color: "#5B5E72" }}>{row.grace}</div>
                        <div style={{ fontSize: 12.5, color: row.lateRule === "None" ? "#A0A3B8" : "#5B5E72" }}>
                          {row.lateRule}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                          <button style={outlineBtn(true)} onClick={() => showToast(`Edit ${row.name} — coming soon.`)}>
                            Edit
                          </button>
                          <button style={dangerBtn(true)} onClick={() => showToast(`Delete ${row.name} — confirm in production.`)}>
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  // ── Concession Rules tab ─────────────────────────────────────────────────────

  const renderConcessionRules = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Create form */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 3 }}>Create Concession Rule</div>
        <div style={{ fontSize: 12.5, color: "#A0A3B8", marginBottom: 18 }}>
          Rows update immediately — each action maps to a feesApi call in production.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
          {[
            { label: "RULE NAME",   ph: "Staff Ward 50%" },
            { label: "APPLIES TO", ph: "Tuition Fee" },
            { label: "DISCOUNT %", ph: "50%" },
            { label: "STATUS",     ph: "Active" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>{f.label}</div>
              <input placeholder={f.ph} style={inputField(f.ph)} />
            </div>
          ))}
        </div>
        <button
          style={{ ...primaryBtn(), minWidth: 160, paddingLeft: 32, paddingRight: 32 }}
          onClick={() => showToast("Concession rule added — would save to feesApi in production.")}
        >
          Add
        </button>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8F8FB" }}>
              {["NAME", "SCOPE", "DISCOUNT", "STATUS", "ACTIONS"].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {CONCESSION_RULES.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < CONCESSION_RULES.length - 1 ? "1px solid #E8E8EE" : "none" }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
                <td style={tdMuted}>{r.scope}</td>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.discount}</td>
                <td style={tdStyle}>{statusPill(r.status)}</td>
                <td style={tdStyle}>{rowActionsLite(r.name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ── Late Fee Rules tab ───────────────────────────────────────────────────────

  const renderLateFeeRules = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Create form */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 3 }}>Create Late Fee Rule</div>
        <div style={{ fontSize: 12.5, color: "#A0A3B8", marginBottom: 18 }}>
          Rows update immediately — each action maps to a feesApi call in production.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
          {[
            { label: "RULE NAME",     ph: "Tuition late rule" },
            { label: "GRACE PERIOD", ph: "7 days" },
            { label: "PENALTY",      ph: "Rs. 50 daily" },
            { label: "CAP AMOUNT",   ph: "Rs. 1,500" },
          ].map(f => (
            <div key={f.label}>
              <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>{f.label}</div>
              <input placeholder={f.ph} style={inputField(f.ph)} />
            </div>
          ))}
        </div>
        <button
          style={{ ...primaryBtn(), minWidth: 160, paddingLeft: 32, paddingRight: 32 }}
          onClick={() => showToast("Late fee rule added — would save to feesApi in production.")}
        >
          Add
        </button>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8F8FB" }}>
              {["NAME", "GRACE", "PENALTY", "CAP", "ACTIONS"].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {LATE_FEE_RULES.map((r, i) => (
              <tr key={r.id} style={{ borderBottom: i < LATE_FEE_RULES.length - 1 ? "1px solid #E8E8EE" : "none" }}>
                <td style={{ ...tdStyle, fontWeight: 600 }}>{r.name}</td>
                <td style={tdMuted}>{r.grace}</td>
                <td style={tdMuted}>{r.penalty}</td>
                <td style={tdMuted}>{r.cap}</td>
                <td style={tdStyle}>{rowActionsLite(r.name)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  const tabContent: Record<Tab, () => React.ReactNode> = {
    "fee-groups": renderFeeGroups,
    "fee-types": renderFeeTypes,
    "fee-schedules": renderFeeSchedules,
    "concession-rules": renderConcessionRules,
    "late-fee-rules": renderLateFeeRules,
  };

  // ── Main render ──────────────────────────────────────────────────────────────

  return (
    <>
      <style>{`
        @keyframes expandIn {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0);    }
        }
        @keyframes toastUp {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
      `}</style>

      <div>
        {/* ── Page header ────────────────────────────────────────────── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: "#6D4AFF", marginBottom: 6, textTransform: "uppercase" }}>
              Configurable Fee Engine
            </div>
            <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 700, color: "#181B2A", lineHeight: 1.1 }}>
              Fee Configuration
            </h1>
            <p style={{ margin: 0, fontSize: 14, color: "#A0A3B8", lineHeight: 1.5 }}>
              Create groups, fee types, schedules, concessions, and late fee rules without hardcoded school assumptions.
            </p>
          </div>
          <button
            style={{ ...primaryBtn(), marginTop: 8 }}
            onClick={() => showToast("Configuration saved successfully.")}
          >
            Save Configuration
          </button>
        </div>

        {isEditOpen && (
          <>
            <div
              onClick={closeEditPanel}
              style={{ position: "fixed", inset: 0, background: "rgba(20,24,40,.3)", zIndex: 40 }}
            />
            <div
              style={{
                position: "fixed",
                top: 0,
                right: 0,
                height: "100%",
                width: 380,
                maxWidth: "92vw",
                background: "#fff",
                boxShadow: "-8px 0 28px rgba(20,24,40,.16)",
                zIndex: 50,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "18px 20px", borderBottom: "1px solid #E8E8EE" }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Edit Fee Group</div>
                <button onClick={closeEditPanel} style={{ width: 30, height: 30, border: "none", background: "transparent", fontSize: 22, color: "#8a90a2", cursor: "pointer", borderRadius: 7 }}>
                  &times;
                </button>
              </div>
              <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
                <div style={{ marginBottom: 15 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 6 }}>GROUP NAME</div>
                  <input value={editName} onChange={event => setEditName(event.target.value)} style={inputField("Group Name")} />
                </div>
                <div style={{ marginBottom: 15 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 6 }}>DESCRIPTION</div>
                  <input value={editDescription} onChange={event => setEditDescription(event.target.value)} style={inputField("Description")} />
                </div>
                <div style={{ marginBottom: 15 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 6 }}>APPLICABLE CLASSES</div>
                  <div ref={editClassDropdownRef} style={{ position: "relative" }}>
                    <button
                      type="button"
                      onClick={() => setIsEditClassDropdownOpen(prev => !prev)}
                      style={{
                        ...inputField(""),
                        width: "100%",
                        textAlign: "left",
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 6,
                        padding: "8px 10px",
                        minHeight: 40,
                        alignItems: "center",
                      }}
                    >
                      {editClassIds.length === 0 ? (
                        <span style={{ color: "#9aa0b2", fontSize: 13 }}>Select classes</span>
                      ) : (
                        editClassIds.map(id => (
                          <span
                            key={id}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 6,
                              padding: "4px 8px",
                              borderRadius: 999,
                              background: "#f4f5fb",
                              color: "#1f2937",
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {availableClasses.find(item => item.id === id)?.name || "Class"}
                            <button
                              type="button"
                              onClick={event => {
                                event.stopPropagation();
                                setEditClassIds(prev => prev.filter(value => value !== id));
                              }}
                              style={{
                                border: "none",
                                background: "transparent",
                                cursor: "pointer",
                                fontSize: 12,
                                color: "#6b7280",
                              }}
                              aria-label="Remove class"
                            >
                              ×
                            </button>
                          </span>
                        ))
                      )}
                    </button>
                    {isEditClassDropdownOpen && (
                      <div
                        style={{
                          position: "absolute",
                          zIndex: 20,
                          top: "100%",
                          left: 0,
                          right: 0,
                          marginTop: 6,
                          background: "#fff",
                          borderRadius: 12,
                          border: "1px solid #E8E8EE",
                          boxShadow: "0 16px 40px rgba(15, 23, 42, 0.12)",
                          padding: 12,
                        }}
                      >
                        <input
                          placeholder="Search classes"
                          value={editClassSearch}
                          onChange={event => setEditClassSearch(event.target.value)}
                          style={{
                            ...inputField(""),
                            width: "100%",
                            marginBottom: 10,
                          }}
                        />
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                          <button
                            type="button"
                            onClick={() => setEditClassIds(availableClasses.map(item => item.id))}
                            style={ghostBtn(true)}
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditClassIds([])}
                            style={ghostBtn(true)}
                          >
                            Clear all
                          </button>
                        </div>
                        <div style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                          {availableClasses
                            .filter(item => item.name?.toLowerCase().includes(editClassSearch.trim().toLowerCase()))
                            .map(item => {
                              const checked = editClassIds.includes(item.id);
                              return (
                                <button
                                  type="button"
                                  key={item.id}
                                  onClick={() => {
                                    setEditClassError("");
                                    setEditClassIds(prev =>
                                      prev.includes(item.id)
                                        ? prev.filter(value => value !== item.id)
                                        : [...prev, item.id]
                                    );
                                  }}
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 10,
                                    padding: "8px 10px",
                                    borderRadius: 10,
                                    border: "1px solid #EEF0F4",
                                    background: checked ? "#f2f3ff" : "#fff",
                                    color: "#1f2937",
                                    cursor: "pointer",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 16,
                                      height: 16,
                                      borderRadius: 4,
                                      border: checked ? "1px solid #5B4FCF" : "1px solid #cbd5f0",
                                      background: checked ? "#5B4FCF" : "#fff",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "#fff",
                                      fontSize: 11,
                                    }}
                                  >
                                    {checked ? "✓" : ""}
                                  </span>
                                  <span style={{ fontSize: 13, fontWeight: 600 }}>{item.name}</span>
                                </button>
                              );
                            })}
                        </div>
                        <button
                          type="button"
                          onClick={() => setIsEditClassDropdownOpen(false)}
                          style={{
                            marginTop: 12,
                            width: "100%",
                            height: 36,
                            borderRadius: 10,
                            border: "none",
                            background: "#111827",
                            color: "#fff",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Apply selection
                        </button>
                      </div>
                    )}
                  </div>
                  {editClassError ? (
                    <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{editClassError}</div>
                  ) : null}
                  <div style={{ marginTop: 6, fontSize: 12, color: "#6b7280" }}>
                    {editClassIds.length} Classes Selected
                  </div>
                </div>
                <div style={{ marginBottom: 15 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 6 }}>STATUS</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    {statusPill(editStatus ? "Active" : "Inactive")}
                    <button
                      type="button"
                      onClick={() => setEditStatus(prev => !prev)}
                      style={{
                        position: "relative",
                        width: 32,
                        height: 18,
                        borderRadius: 999,
                        border: "1px solid #E8E8EE",
                        background: editStatus ? "#e6f6ee" : "#f3f4f6",
                        cursor: "pointer",
                      }}
                      aria-label={editStatus ? "Deactivate group" : "Activate group"}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: editStatus ? 16 : 2,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: editStatus ? "#1d9e63" : "#8a90a2",
                          transition: "left 0.2s ease",
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
              <div style={{ padding: "16px 20px", borderTop: "1px solid #E8E8EE", display: "flex", gap: 10 }}>
                <button onClick={closeEditPanel} style={{ height: 42, padding: "0 18px", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid #d3d7e2", borderRadius: 8, color: "#3b4150", cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleSaveEdit} disabled={isSavingEdit} style={{ height: 42, flex: 1, background: "#5B4FCF", color: "#fff", border: "none", borderRadius: 8, fontWeight: 700, cursor: "pointer" }}>
                  {isSavingEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </>
        )}

        {isDeleteOpen && deleteGroup && (() => {
          const studentCount = getStudentCount(deleteGroup);
          const hasDependents = studentCount > 0;
          return (
            <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,40,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60, padding: 20 }}>
              <div style={{ background: "#fff", borderRadius: 14, width: 420, maxWidth: "100%", boxShadow: "0 20px 50px rgba(20,24,40,.3)", overflow: "hidden" }}>
                <div style={{ padding: "22px 22px 6px", display: "flex", gap: 14, alignItems: "flex-start" }}>
                  <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#fdecec", color: "#d8453f", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 18, fontWeight: 700 }}>!</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 5 }}>Delete "{deleteGroup.name}"?</div>
                    <div style={{ fontSize: 13, color: "#3b4150", lineHeight: 1.5 }}>
                      {hasDependents
                        ? "This fee group is in use and cannot be deleted."
                        : "This will permanently remove the fee group. This action cannot be undone."}
                    </div>
                  </div>
                </div>
                {hasDependents && (
                  <div style={{ margin: "14px 22px 0", padding: "11px 13px", background: "#fdecec", borderRadius: 8, fontSize: 12.5, color: "#a23631" }}>
                    {studentCount} student(s) are assigned to this group. Reassign or offboard them first.
                  </div>
                )}
                {deleteError && (
                  <div style={{ margin: "14px 22px 0", padding: "11px 13px", background: "#fdecec", borderRadius: 8, fontSize: 12.5, color: "#a23631" }}>
                    {deleteError}
                  </div>
                )}
                <div style={{ padding: "18px 22px", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button onClick={closeDeleteDialog} style={{ height: 40, padding: "0 18px", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid #d3d7e2", borderRadius: 8, color: "#3b4150", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button
                    onClick={handleDeleteGroup}
                    disabled={hasDependents || isDeleting}
                    style={{ height: 40, padding: "0 18px", fontSize: 13, fontWeight: 700, background: "#d8453f", border: "none", borderRadius: 8, color: "#fff", cursor: hasDependents ? "not-allowed" : "pointer", opacity: hasDependents ? 0.4 : 1 }}
                  >
                    {isDeleting ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── Tab bar ────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 24 }}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  height: 36, padding: "0 18px",
                  border: isActive ? "none" : "1px solid #E8E8EE",
                  borderRadius: 20,
                  background: isActive ? "#6D4AFF" : "#fff",
                  color: isActive ? "#fff" : "#5B5E72",
                  fontSize: 13, fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s",
                  boxShadow: isActive ? "0 2px 8px rgba(109,74,255,0.22)" : "none",
                }}
              >
                {tab.label}
              </button>
            );
          })}
          {/* Info icon */}
          <div style={{ marginLeft: "auto", position: "relative" }}>
            <button
              onClick={() => setShowInfo(v => !v)}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                border: "1.5px solid #E8E8EE",
                background: showInfo ? "#EDE9FE" : "#fff",
                color: "#6D4AFF",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 14, fontWeight: 700,
              }}
              title="About fee configuration"
            >
              i
            </button>
            {showInfo && (
              <div style={{
                position: "absolute", top: 40, right: 0, zIndex: 50,
                background: "#fff", border: "1px solid #E8E8EE",
                borderRadius: 10, padding: "14px 16px",
                width: 280, boxShadow: "0 8px 24px rgba(0,0,0,0.10)",
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#181B2A", marginBottom: 6 }}>Fee Configuration</div>
                <div style={{ fontSize: 12.5, color: "#A0A3B8", lineHeight: 1.6 }}>
                  Configure fee groups, types, and schedules independently. Term counts control how many installments appear across all schedule rows. Concession and late fee rules are referenced during fee assignment.
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Tab content ────────────────────────────────────────────── */}
        {tabContent[activeTab]?.()}

        {/* ── Toast ──────────────────────────────────────────────────── */}
        {toast && (
          <div style={{
            position: "fixed", top: 24, right: 24,
            background: "#1e293b", color: "#fff",
            padding: "12px 20px", borderRadius: 10,
            fontSize: 13.5, fontWeight: 500, lineHeight: 1.4,
            boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
            zIndex: 9999, maxWidth: 420,
            animation: "toastUp 0.2s ease",
          }}>
            {toast}
          </div>
        )}
      </div>
    </>
  );
}
