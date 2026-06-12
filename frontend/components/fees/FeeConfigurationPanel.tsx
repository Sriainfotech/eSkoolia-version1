"use client";

import { useEffect, useRef, useState } from "react";
import { feesApi, listData, type AcademicYear, type FeeTypeListParams, type FeesGroup, type FeesType, type SchoolClass, type TermSettings, type FeeSchedule, type SearchParams } from "@/lib/fees-api";
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

type TermConfig = {
  id?: number;
  name: string;
  startDate: string;
  endDate: string;
  dueDate: string;
};

// ─── Static data ───────────────────────────────────────────────────────────────

const TABS: { id: Tab; label: string }[] = [
  { id: "fee-groups", label: "Fee Groups" },
  { id: "fee-types", label: "Fee Types" },
  { id: "fee-schedules", label: "Fee Schedules" },
  { id: "concession-rules", label: "Concession Rules" },
  { id: "late-fee-rules", label: "Late Fee Rules" },
];

const DEFAULT_TERMS: TermConfig[] = [
  { name: "Term 1 (Apr–Jul)", startDate: "2026-04-01", endDate: "2026-07-31", dueDate: "2026-04-10" },
  { name: "Term 2 (Aug–Nov)", startDate: "2026-08-01", endDate: "2026-11-30", dueDate: "2026-08-10" },
  { name: "Term 3 (Dec–Mar)", startDate: "2026-12-01", endDate: "2027-03-31", dueDate: "2026-12-10" },
  { name: "Term 4", startDate: "2027-04-01", endDate: "2027-05-31", dueDate: "2027-04-10" },
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

const FEE_TAXABLE_OPTIONS: Array<"Yes" | "No"> = ["Yes", "No"];
const FEE_STRUCTURE_OPTIONS: Array<"Monthly" | "Quarterly" | "Term-wise" | "Yearly" | "Custom"> = [
  "Monthly",
  "Quarterly",
  "Term-wise",
  "Yearly",
  "Custom",
];
const FEE_STATUS_OPTIONS: Array<"Active" | "Inactive"> = ["Active", "Inactive"];
const GL_CODE_REGEX = /^[0-9]{4}-[A-Z0-9]+$/;
const GL_CODE_SUGGESTIONS: Array<{ label: string; code: string }> = [
  { label: "Tuition Fee", code: "4001-TUITION" },
  { label: "Development Fee", code: "4002-DEVFEE" },
  { label: "Examination Fee", code: "4003-EXAM" },
  { label: "Transport Fee", code: "4004-TRANS" },
  { label: "Library Fee", code: "4005-LIBRARY" },
  { label: "Computer Fee", code: "4006-COMPUTER" },
  { label: "Sports Fee", code: "4007-SPORTS" },
  { label: "Activity Fee", code: "4008-ACTIVITY" },
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

  const [feeTypes, setFeeTypes] = useState<FeesType[]>([]);
  const [isLoadingTypes, setIsLoadingTypes] = useState(false);
  const [isSavingType, setIsSavingType] = useState(false);
  const [typeGroupId, setTypeGroupId] = useState<number | "">("");
  const [typeName, setTypeName] = useState("");
  const [typeGlCode, setTypeGlCode] = useState("");
  const [typeTaxable, setTypeTaxable] = useState<"Yes" | "No">("No");
  const [typeStructure, setTypeStructure] = useState<"Monthly" | "Quarterly" | "Term-wise" | "Yearly" | "Custom">("Term-wise");
  const [typeStatus, setTypeStatus] = useState<"Active" | "Inactive">("Active");
  const [typeErrors, setTypeErrors] = useState<Record<string, string>>({});
  const [typeSearch, setTypeSearch] = useState("");
  const [typeSortBy, setTypeSortBy] = useState<FeeTypeListParams["sort_by"]>("name");
  const [typeSortDir, setTypeSortDir] = useState<"asc" | "desc">("asc");
  const [typeStatusFilter, setTypeStatusFilter] = useState<"" | "active" | "inactive">("");
  const [typePage, setTypePage] = useState(1);
  const [typePageSize] = useState(10);
  const [typeTotalCount, setTypeTotalCount] = useState(0);
  const [typeTotalPages, setTypeTotalPages] = useState(1);
  const [editingType, setEditingType] = useState<FeesType | null>(null);
  const [isEditTypeOpen, setIsEditTypeOpen] = useState(false);
  const [isSavingTypeEdit, setIsSavingTypeEdit] = useState(false);
  const [editTypeGroupId, setEditTypeGroupId] = useState<number | "">("");
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeGlCode, setEditTypeGlCode] = useState("");
  const [editTypeTaxable, setEditTypeTaxable] = useState<"Yes" | "No">("No");
  const [editTypeStructure, setEditTypeStructure] = useState<"Monthly" | "Quarterly" | "Term-wise" | "Yearly" | "Custom">("Term-wise");
  const [editTypeStatus, setEditTypeStatus] = useState<"Active" | "Inactive">("Active");
  const [editTypeErrors, setEditTypeErrors] = useState<Record<string, string>>({});
  const [deleteType, setDeleteType] = useState<FeesType | null>(null);
  const [isDeleteTypeOpen, setIsDeleteTypeOpen] = useState(false);
  const [isDeletingType, setIsDeletingType] = useState(false);
  const [deleteTypeError, setDeleteTypeError] = useState("");

  // ── Term Settings state ──
  const [termSettings, setTermSettings] = useState<any[]>([]);
  const [initialTerms, setInitialTerms] = useState<TermConfig[]>([]);
  const [isLoadingTermSettings, setIsLoadingTermSettings] = useState(false);
  const [isSavingTermSettings, setIsSavingTermSettings] = useState(false);
  const [isTermSettingsOpen, setIsTermSettingsOpen] = useState(false);
  const [termSearch, setTermSearch] = useState("");
  const [termSortBy, setTermSortBy] = useState("term_number");
  const [termPage, setTermPage] = useState(1);
  const [termPageSize] = useState(10);

  // ── Fee Schedules state ──
  const [feeSchedules, setFeeSchedules] = useState<any[]>([]);
  const [isLoadingSchedules, setIsLoadingSchedules] = useState(false);
  const [scheduleSearch, setScheduleSearch] = useState("");
  const [scheduleSortBy, setScheduleSortBy] = useState("created_at");
  const [scheduleStatusFilter, setScheduleStatusFilter] = useState<"" | "active" | "inactive">("");
  const [schedulePage, setSchedulePage] = useState(1);
  const [schedulePageSize] = useState(10);
  const [scheduleTotalCount, setScheduleTotalCount] = useState(0);
  const [scheduleTotalPages, setScheduleTotalPages] = useState(1);

  // ── Create Schedule Form state ──
  const [isCreateScheduleOpen, setIsCreateScheduleOpen] = useState(false);
  const [scheduleAcademicYear, setScheduleAcademicYear] = useState<number | "">("");
  const [scheduleFeeGroup, setScheduleFeeGroup] = useState<number | "">("");
  const [scheduleFeeType, setScheduleFeeType] = useState<number | "">("");
  const [scheduleAmount, setScheduleAmount] = useState("");
  const [scheduleFrequency, setScheduleFrequency] = useState("Monthly");
  const [scheduleDueDate, setScheduleDueDate] = useState("");
  const [scheduleLateFee, setScheduleLateFee] = useState(false);
  const [scheduleGracePeriod, setScheduleGracePeriod] = useState<number | "">(0);
  const [scheduleLateFeeRule, setScheduleLateFeeRule] = useState("");
  const [scheduleTermBreakdown, setScheduleTermBreakdown] = useState<any[]>([]);
  const [scheduleStatus, setScheduleStatus] = useState("active");
  const [scheduleErrors, setScheduleErrors] = useState<Record<string, string>>({});
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // ── Edit Schedule state ──
  const [editingSchedule, setEditingSchedule] = useState<any | null>(null);
  const [isEditScheduleOpen, setIsEditScheduleOpen] = useState(false);
  const [editScheduleAcademicYear, setEditScheduleAcademicYear] = useState<number | "">("");
  const [editScheduleFeeGroup, setEditScheduleFeeGroup] = useState<number | "">("");
  const [editScheduleFeeType, setEditScheduleFeeType] = useState<number | "">("");
  const [editScheduleAmount, setEditScheduleAmount] = useState("");
  const [editScheduleFrequency, setEditScheduleFrequency] = useState("Monthly");
  const [editScheduleDueDate, setEditScheduleDueDate] = useState("");
  const [editScheduleLateFee, setEditScheduleLateFee] = useState(false);
  const [editScheduleGracePeriod, setEditScheduleGracePeriod] = useState<number | "">(0);
  const [editScheduleLateFeeRule, setEditScheduleLateFeeRule] = useState("");
  const [editScheduleTermBreakdown, setEditScheduleTermBreakdown] = useState<any[]>([]);
  const [editScheduleStatus, setEditScheduleStatus] = useState("active");
  const [editScheduleErrors, setEditScheduleErrors] = useState<Record<string, string>>({});
  const [isSavingScheduleEdit, setIsSavingScheduleEdit] = useState(false);

  // ── Delete Schedule state ──
  const [deleteSchedule, setDeleteSchedule] = useState<any | null>(null);
  const [isDeleteScheduleOpen, setIsDeleteScheduleOpen] = useState(false);
  const [isDeletingSchedule, setIsDeletingSchedule] = useState(false);
  const [deleteScheduleError, setDeleteScheduleError] = useState("");

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

  // ── Term Settings functions ──────────────────────────────────────────────────

  const generateDefaultTerms = (year?: AcademicYear, count = 3): TermConfig[] => {
    const startStr = year?.start_date || "2026-06-12";
    const endStr = year?.end_date || "2027-03-14";
    
    console.log(`[TermSettings] generateDefaultTerms called for year:`, year?.name, `start:`, startStr, `end:`, endStr, `count:`, count);
    const start = new Date(startStr);
    const end = new Date(endStr);
    const totalDuration = end.getTime() - start.getTime();
    const termDuration = totalDuration / count;
    
    const generated: TermConfig[] = [];
    for (let i = 0; i < count; i++) {
      const tStart = new Date(start.getTime() + i * termDuration);
      const tEnd = new Date(start.getTime() + (i + 1) * termDuration - 86400000); // end day before next
      // Set default due date 20 days after start of term, or fallback to end of term
      const tDue = new Date(tStart.getTime() + 20 * 86400000);
      const finalDue = tDue.getTime() < tEnd.getTime() ? tDue : tEnd;
      
      generated.push({
        name: `Term ${i + 1}`,
        startDate: tStart.toISOString().split("T")[0],
        endDate: tEnd.toISOString().split("T")[0],
        dueDate: finalDue.toISOString().split("T")[0],
      });
    }
    return generated;
  };

  const hasTermSettingsChanged = (): boolean => {
    const currentActiveTerms = terms.slice(0, numTerms);
    if (currentActiveTerms.length !== initialTerms.length) {
      return true;
    }
    for (let i = 0; i < numTerms; i++) {
      const cur = currentActiveTerms[i];
      const init = initialTerms[i];
      if (!init) return true;
      if ((cur.name || "").trim() !== (init.name || "").trim()) return true;
      if ((cur.startDate || "") !== (init.startDate || "")) return true;
      if ((cur.endDate || "") !== (init.endDate || "")) return true;
      if ((cur.dueDate || "") !== (init.dueDate || "")) return true;
    }
    return false;
  };

  const fetchTermSettings = async (yearId: number) => {
    setIsLoadingTermSettings(true);
    console.log(`[TermSettings] fetchTermSettings called for academic year: ${yearId}`);
    try {
      const payload = await feesApi.listTermSettings();
      const allSettings = listData(payload);
      const filtered = allSettings.filter(item => item.academic_year === yearId);
      console.log(`[TermSettings] Loaded records for academic year ID ${yearId}:`, filtered);
      
      setTermSettings(filtered);
      
      if (filtered.length > 0) {
        setNumTerms(filtered.length);
        const mapped = filtered.map(item => ({
          id: item.id,
          name: item.term_name,
          startDate: item.start_date,
          endDate: item.end_date,
          dueDate: item.default_due_date,
        }));
        setTerms(mapped);
        setInitialTerms(JSON.parse(JSON.stringify(mapped)));
      } else {
        const year = academicYears.find(y => y.id === yearId);
        const nextTerms = generateDefaultTerms(year, numTerms);
        setTerms(nextTerms);
        setInitialTerms([]);
      }
    } catch (err) {
      console.error("[TermSettings] Failed to fetch term settings:", err);
      showToast("Failed to load school term settings.");
    } finally {
      setIsLoadingTermSettings(false);
    }
  };

  const handleSaveTermSettings = async () => {
    if (!academicYearId) {
      showToast("Select an academic year first.");
      return;
    }

    if (!hasTermSettingsChanged()) {
      console.log("[TermSettings] [frontend/debug] Action: NO_CHANGE - No values changed since last load.");
      showToast("No changes detected.");
      return;
    }

    setIsSavingTermSettings(true);
    const actionType = initialTerms.length === 0 ? "CREATE" : "UPDATE";
    console.log(`[TermSettings] [frontend/debug] Action: ${actionType} - Changes detected. Preparing bulk payload...`);

    try {
      const payloadList = Array.from({ length: numTerms }).map((_, i) => {
        const term = terms[i];
        if (!term) {
          throw new Error(`Term configuration for Term ${i + 1} is missing.`);
        }
        if (!term.name || !term.name.trim()) {
          throw new Error(`Term Name is required for Term ${i + 1}.`);
        }
        if (!term.startDate || !term.endDate) {
          throw new Error(`Start Date and End Date are required for Term ${i + 1}.`);
        }
        if (!term.dueDate) {
          throw new Error(`Default Due Date is required for Term ${i + 1}.`);
        }

        const item: any = {
          academic_year: academicYearId,
          term_number: i + 1,
          term_name: term.name,
          start_date: term.startDate,
          end_date: term.endDate,
          default_due_date: term.dueDate,
        };

        const existingRecord = termSettings.find(ts => ts.term_number === i + 1);
        if (existingRecord && existingRecord.id) {
          item.id = existingRecord.id;
        }
        return item;
      });

      console.log("[TermSettings] Dispatching bulk API call with payload:", payloadList);
      await feesApi.createTermSettings(payloadList);

      console.log("[TermSettings] Term settings successfully saved in bulk.");
      showToast("Term settings updated successfully.");
      
      // Reload from backend
      await fetchTermSettings(academicYearId);
    } catch (error) {
      console.error("[TermSettings] Bulk save failed with error:", error);
      const e = error as { details?: unknown; message?: string };
      const errorMessage = e.message || "Failed to save term settings.";
      showToast(errorMessage);
    } finally {
      setIsSavingTermSettings(false);
    }
  };

  useEffect(() => {
    if (academicYearId) {
      fetchTermSettings(academicYearId);
    }
  }, [academicYearId, academicYears]);

  // ── Fee Schedules functions ──────────────────────────────────────────────────

  const fetchFeeSchedules = async () => {
    setIsLoadingSchedules(true);
    try {
      const payload = await feesApi.listSchedules({
        page: schedulePage,
        page_size: schedulePageSize,
        search: scheduleSearch.trim() || undefined,
        status: scheduleStatusFilter || undefined,
        sort_by: scheduleSortBy,
      });

      if (Array.isArray(payload)) {
        setFeeSchedules(payload);
        setScheduleTotalCount(payload.length);
        setScheduleTotalPages(1);
      } else if ("results" in payload) {
        const results = payload.results || [];
        setFeeSchedules(results);
        const count = (payload as { count?: number }).count || results.length;
        setScheduleTotalCount(count);
        setScheduleTotalPages(Math.max(1, Math.ceil(count / schedulePageSize)));
      } else {
        const rows = listData(payload as { results?: FeeSchedule[] });
        setFeeSchedules(rows);
        setScheduleTotalCount(rows.length);
        setScheduleTotalPages(1);
      }
    } catch (error) {
      showToast("Unable to load fee schedules.");
    } finally {
      setIsLoadingSchedules(false);
    }
  };

  const handleCreateSchedule = async () => {
    if (!academicYearId) {
      showToast("Select an academic year first.");
      return;
    }
    const nextErrors: Record<string, string> = {};
    if (!scheduleFeeGroup) nextErrors.fee_group = "Fee Group is required.";
    if (!scheduleFeeType) nextErrors.fee_type = "Fee Type is required.";
    
    if (scheduleFrequency === "Term-wise") {
      if (!scheduleTermBreakdown || scheduleTermBreakdown.length === 0) {
        showToast("Please configure school terms under 'School Term Settings' first.");
        return;
      }
      const hasInvalidTerm = scheduleTermBreakdown.some(tb => !tb.amount || isNaN(Number(tb.amount)) || Number(tb.amount) < 0 || !tb.due_date);
      if (hasInvalidTerm) {
        showToast("Please provide a valid amount and due date for all terms.");
        return;
      }
    } else {
      if (!scheduleAmount || isNaN(Number(scheduleAmount)) || Number(scheduleAmount) <= 0) nextErrors.amount = "Valid amount required.";
      if (!scheduleDueDate) nextErrors.due_date = "Due date is required.";
    }
    
    setScheduleErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast("Please fix validation errors before submitting.");
      return;
    }

    let finalAmount = scheduleAmount;
    let finalDueDate = scheduleDueDate;
    if (scheduleFrequency === "Term-wise") {
      const sum = scheduleTermBreakdown.reduce((acc, current) => acc + (Number(current.amount) || 0), 0);
      finalAmount = sum.toString();
      if (scheduleTermBreakdown.length > 0) {
        finalDueDate = scheduleTermBreakdown[0].due_date;
      }
    }

    setIsSavingSchedule(true);
    try {
      await feesApi.createSchedule({
        academic_year: academicYearId,
        fee_group: scheduleFeeGroup === "" ? undefined : scheduleFeeGroup,
        fee_type: scheduleFeeType === "" ? undefined : scheduleFeeType,
        amount: finalAmount,
        collection_frequency: scheduleFrequency,
        due_date: finalDueDate,
        late_fee_applicable: scheduleLateFee,
        grace_period: Number(scheduleGracePeriod) || 0,
        late_fee_rule: scheduleLateFeeRule,
        term_breakdown: scheduleFrequency === "Term-wise" ? scheduleTermBreakdown : [],
        status: scheduleStatus as "active" | "inactive",
      });
      showToast("Fee schedule created successfully.");
      setScheduleAcademicYear("");
      setScheduleFeeGroup("");
      setScheduleFeeType("");
      setScheduleAmount("");
      setScheduleFrequency("Monthly");
      setScheduleDueDate("");
      setScheduleLateFee(false);
      setScheduleGracePeriod(0);
      setScheduleLateFeeRule("");
      setScheduleTermBreakdown([]);
      setScheduleStatus("active");
      setIsCreateScheduleOpen(false);
      fetchFeeSchedules();
    } catch (error) {
      const e = error as { details?: unknown; message?: string };
      const mapped = mapApiFieldErrors(e.details);
      setScheduleErrors(mapped);
      const errorMsg = Object.values(mapped)[0] || e.message || "Failed to create fee schedule.";
      showToast(errorMsg as string);
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleUpdateSchedule = async () => {
    if (!editingSchedule) return;
    const nextErrors: Record<string, string> = {};
    if (!editScheduleFeeGroup) nextErrors.fee_group = "Fee Group is required.";
    if (!editScheduleFeeType) nextErrors.fee_type = "Fee Type is required.";
    
    if (editScheduleFrequency === "Term-wise") {
      if (!editScheduleTermBreakdown || editScheduleTermBreakdown.length === 0) {
        showToast("No terms configured for this academic year.");
        return;
      }
      const hasInvalidTerm = editScheduleTermBreakdown.some(tb => !tb.amount || isNaN(Number(tb.amount)) || Number(tb.amount) < 0 || !tb.due_date);
      if (hasInvalidTerm) {
        showToast("Please provide a valid amount and due date for all terms.");
        return;
      }
    } else {
      if (!editScheduleAmount || isNaN(Number(editScheduleAmount)) || Number(editScheduleAmount) <= 0) nextErrors.amount = "Valid amount required.";
      if (!editScheduleDueDate) nextErrors.due_date = "Due date is required.";
    }
    
    setEditScheduleErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast("Please fix validation errors before submitting.");
      return;
    }

    let finalAmount = editScheduleAmount;
    let finalDueDate = editScheduleDueDate;
    if (editScheduleFrequency === "Term-wise") {
      const sum = editScheduleTermBreakdown.reduce((acc, current) => acc + (Number(current.amount) || 0), 0);
      finalAmount = sum.toString();
      if (editScheduleTermBreakdown.length > 0) {
        finalDueDate = editScheduleTermBreakdown[0].due_date;
      }
    }

    setIsSavingScheduleEdit(true);
    try {
      await feesApi.updateSchedule(editingSchedule.id, {
        fee_group: editScheduleFeeGroup === "" ? undefined : editScheduleFeeGroup,
        fee_type: editScheduleFeeType === "" ? undefined : editScheduleFeeType,
        amount: finalAmount,
        collection_frequency: editScheduleFrequency,
        due_date: finalDueDate,
        late_fee_applicable: editScheduleLateFee,
        grace_period: Number(editScheduleGracePeriod) || 0,
        late_fee_rule: editScheduleLateFeeRule,
        term_breakdown: editScheduleFrequency === "Term-wise" ? editScheduleTermBreakdown : [],
        status: editScheduleStatus as "active" | "inactive",
      });
      showToast("Fee schedule updated successfully.");
      setIsEditScheduleOpen(false);
      setEditingSchedule(null);
      setEditScheduleGracePeriod(0);
      setEditScheduleLateFeeRule("");
      setEditScheduleTermBreakdown([]);
      fetchFeeSchedules();
    } catch (error) {
      const e = error as { details?: unknown; message?: string };
      const mapped = mapApiFieldErrors(e.details);
      setEditScheduleErrors(mapped);
      const errorMsg = Object.values(mapped)[0] || e.message || "Failed to update fee schedule.";
      showToast(errorMsg as string);
    } finally {
      setIsSavingScheduleEdit(false);
    }
  };

  const handleDeleteSchedule = async () => {
    if (!deleteSchedule) return;
    setIsDeletingSchedule(true);
    try {
      await feesApi.deleteSchedule(deleteSchedule.id);
      showToast("Fee schedule deleted successfully.");
      setIsDeleteScheduleOpen(false);
      setDeleteSchedule(null);
      setDeleteScheduleError("");
      fetchFeeSchedules();
    } catch (error) {
      const e = error as { details?: unknown; message?: string };
      const mapped = mapApiFieldErrors(e.details);
      const errorMsg = mapped.detail || e.message || "Failed to delete fee schedule.";
      setDeleteScheduleError(errorMsg as string);
    } finally {
      setIsDeletingSchedule(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "fee-schedules") return;
    fetchFeeSchedules();
  }, [activeTab, schedulePage, scheduleSortBy, scheduleStatusFilter]);

  useEffect(() => {
    if (activeTab !== "fee-schedules") return;
    const timer = setTimeout(() => {
      setSchedulePage(1);
      fetchFeeSchedules();
    }, 300);
    return () => clearTimeout(timer);
  }, [scheduleSearch]);

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

  const mapApiFieldErrors = (details: unknown): Record<string, string> => {
    const mapped: Record<string, string> = {};
    const errorBag = (details && typeof details === "object" ? (details as { errors?: Record<string, unknown> }).errors : null) ||
      (details && typeof details === "object" ? (details as Record<string, unknown>) : null);
    if (!errorBag || typeof errorBag !== "object") return mapped;

    const toMessage = (value: unknown): string => {
      if (Array.isArray(value)) return String(value[0] || "");
      return typeof value === "string" ? value : "";
    };

    const source = errorBag as Record<string, unknown>;
    if (source.fees_group) mapped.fees_group = toMessage(source.fees_group);
    if (source.non_field_errors && !Object.keys(mapped).length) mapped.general = toMessage(source.non_field_errors);
    if (source.name) mapped.name = toMessage(source.name);
    if (source.gl_code) mapped.gl_code = toMessage(source.gl_code);
    if (source.taxable) mapped.taxable = toMessage(source.taxable);
    if (source.default_structure) mapped.default_structure = toMessage(source.default_structure);
    if (source.status) mapped.status = toMessage(source.status);
    if (source.detail && !Object.keys(mapped).length) mapped.general = toMessage(source.detail);
    return mapped;
  };

  const validateGlCodeClient = (rawValue: string, currentId?: number): string => {
    const value = (rawValue || "").trim().toUpperCase();
    if (!value) return "GL Code is required.";
    if (!GL_CODE_REGEX.test(value)) return "Invalid GL Code format. Use XXXX-CODE (e.g., 4001-TUITION).";

    const duplicateCode = feeTypes.some(row => row.gl_code?.toUpperCase() === value && row.id !== currentId);
    if (duplicateCode) return "A Fee Type with this GL Code already exists.";

    const accountNumber = value.split("-")[0];
    const duplicateAccount = feeTypes.some(row => {
      if (row.id === currentId) return false;
      const rowCode = (row.gl_code || "").toUpperCase();
      return rowCode.startsWith(`${accountNumber}-`);
    });
    if (duplicateAccount) return `Account number ${accountNumber} is already used by another Fee Type. Use a unique account number.`;

    return "";
  };

  const normalizeFeeTypeName = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, "");

  const suggestedCodeForName = (name: string): string | null => {
    const normalized = normalizeFeeTypeName(name);
    if (!normalized) return null;
    const match = GL_CODE_SUGGESTIONS.find(option => {
      const optionName = normalizeFeeTypeName(option.label);
      return normalized.includes(optionName.replace("fee", "")) || optionName.includes(normalized);
    });
    return match?.code || null;
  };

  const getSuggestedCodes = (name: string): Array<{ label: string; code: string }> => {
    const preferred = suggestedCodeForName(name);
    if (!preferred) return GL_CODE_SUGGESTIONS;
    const first = GL_CODE_SUGGESTIONS.find(option => option.code === preferred);
    const rest = GL_CODE_SUGGESTIONS.filter(option => option.code !== preferred);
    return first ? [first, ...rest] : GL_CODE_SUGGESTIONS;
  };

  const fetchFeeTypes = async () => {
    setIsLoadingTypes(true);
    try {
      const payload = await feesApi.listTypes({
        page: typePage,
        page_size: typePageSize,
        search: typeSearch.trim() || undefined,
        status: typeStatusFilter || undefined,
        sort_by: typeSortBy,
        sort_dir: typeSortDir,
      });

      if (Array.isArray(payload)) {
        setFeeTypes(payload);
        setTypeTotalCount(payload.length);
        setTypeTotalPages(1);
      } else if ("results" in payload) {
        const results = payload.results || [];
        setFeeTypes(results);
        const count = (payload as { count?: number }).count || results.length;
        setTypeTotalCount(count);
        setTypeTotalPages(Math.max(1, Math.ceil(count / typePageSize)));
      } else {
        const rows = listData(payload as { results?: FeesType[] });
        setFeeTypes(rows);
        setTypeTotalCount(rows.length);
        setTypeTotalPages(1);
      }
    } catch (error) {
      showToast("Unable to load fee types.");
    } finally {
      setIsLoadingTypes(false);
    }
  };

  useEffect(() => {
    if (activeTab !== "fee-types") return;
    fetchFeeTypes();
  }, [activeTab, typePage, typeSortBy, typeSortDir, typeStatusFilter]);

  useEffect(() => {
    if (activeTab !== "fee-types") return;
    const timer = setTimeout(() => {
      setTypePage(1);
      fetchFeeTypes();
    }, 300);
    return () => clearTimeout(timer);
  }, [typeSearch]);

  const handleCreateType = async () => {
    if (!academicYearId) {
      showToast("Select an academic year first.");
      return;
    }
    const glCodeError = validateGlCodeClient(typeGlCode);
    const nextErrors: Record<string, string> = {};
    if (glCodeError) nextErrors.gl_code = glCodeError;
    setTypeErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast("Please fix validation errors before submitting.");
      return;
    }
    setIsSavingType(true);
    try {
      await feesApi.createType({
        academic_year: academicYearId,
        fees_group: typeGroupId !== "" ? typeGroupId : undefined,
        name: typeName,
        gl_code: typeGlCode,
        taxable: typeTaxable,
        default_structure: typeStructure,
        status: typeStatus,
      });
      showToast("Fee type created successfully.");
      setTypeGroupId("");
      setTypeName("");
      setTypeGlCode("");
      setTypeTaxable("No");
      setTypeStructure("Term-wise");
      setTypeStatus("Active");
      fetchFeeTypes();
    } catch (error) {
      const e = error as { details?: unknown; message?: string };
      const mapped = mapApiFieldErrors(e.details);
      setTypeErrors(mapped);
      const errorMsg = mapped.name || e.message || "Failed to create fee type.";
      showToast(errorMsg);
    } finally {
      setIsSavingType(false);
    }
  };

  const openEditTypeModal = (row: FeesType) => {
    setEditingType(row);
    setEditTypeGroupId(row.fees_group ?? "");
    setEditTypeName(row.name || "");
    setEditTypeGlCode(row.gl_code || "");
    setEditTypeTaxable((row.taxable || "No") as "Yes" | "No");
    setEditTypeStructure((row.default_structure || "Term-wise") as "Monthly" | "Quarterly" | "Term-wise" | "Yearly" | "Custom");
    setEditTypeStatus((row.status || "Active") as "Active" | "Inactive");
    setEditTypeErrors({});
    setIsEditTypeOpen(true);
  };

  const closeEditTypeModal = () => {
    setIsEditTypeOpen(false);
    setEditingType(null);
    setEditTypeErrors({});
  };

  const handleUpdateType = async () => {
    if (!editingType) return;
    const glCodeError = validateGlCodeClient(editTypeGlCode, editingType.id);
    const nextErrors: Record<string, string> = {};
    if (glCodeError) nextErrors.gl_code = glCodeError;
    setEditTypeErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      showToast("Please fix validation errors before submitting.");
      return;
    }
    setIsSavingTypeEdit(true);
    try {
      await feesApi.updateType(editingType.id, {
        fees_group: editTypeGroupId !== "" ? editTypeGroupId : undefined,
        name: editTypeName,
        gl_code: editTypeGlCode,
        taxable: editTypeTaxable,
        default_structure: editTypeStructure,
        status: editTypeStatus,
      });
      showToast("Fee type updated successfully.");
      closeEditTypeModal();
      fetchFeeTypes();
    } catch (error) {
      const e = error as { details?: unknown; message?: string };
      const mapped = mapApiFieldErrors(e.details);
      setEditTypeErrors(mapped);
      const errorMsg = mapped.name || e.message || "Failed to update fee type.";
      showToast(errorMsg);
    } finally {
      setIsSavingTypeEdit(false);
    }
  };

  const openDeleteTypeModal = (row: FeesType) => {
    setDeleteType(row);
    setDeleteTypeError("");
    setIsDeleteTypeOpen(true);
  };

  const closeDeleteTypeModal = () => {
    setDeleteType(null);
    setDeleteTypeError("");
    setIsDeleteTypeOpen(false);
  };

  const handleDeleteType = async () => {
    if (!deleteType) return;
    setDeleteTypeError("");
    setIsDeletingType(true);
    try {
      await feesApi.deleteType(deleteType.id);
      showToast("Fee type deleted successfully.");
      closeDeleteTypeModal();
      fetchFeeTypes();
    } catch (error) {
      const e = error as { message?: string };
      const message = e.message || "This fee type could not be deleted.";
      setDeleteTypeError(message);
      showToast(message);
    } finally {
      setIsDeletingType(false);
    }
  };

  const typePaginationPages = (() => {
    const pages: number[] = [];
    const start = Math.max(1, typePage - 2);
    const end = Math.min(typeTotalPages, start + 4);
    for (let page = start; page <= end; page += 1) pages.push(page);
    return pages;
  })();

  // ── Fee Types tab ────────────────────────────────────────────────────────────

  const renderFeeTypes = () => (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Create form */}
      <div style={card}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 3 }}>Create Fee Type</div>
        <div style={{ fontSize: 12.5, color: "#A0A3B8", marginBottom: 18 }}>
          Create fee types with GL code, taxation, structure, and status.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>FEE GROUP</div>
            <select
              value={typeGroupId}
              onChange={event => setTypeGroupId(event.target.value === "" ? "" : Number(event.target.value))}
              style={inputField("Select Fee Group")}
            >
              <option value="">Select Fee Group</option>
              {feeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
            {typeErrors.fees_group ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{typeErrors.fees_group}</div> : null}
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>FEE TYPE NAME</div>
            <input
              placeholder="Tuition Fee"
              style={inputField("Tuition Fee")}
              value={typeName}
              onChange={event => {
                const nextName = event.target.value;
                setTypeName(nextName);
                if (!typeGlCode.trim()) {
                  const suggested = suggestedCodeForName(nextName);
                  if (suggested) setTypeGlCode(suggested);
                }
              }}
            />
            {typeErrors.name ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{typeErrors.name}</div> : null}
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>GL CODE</div>
            <input
              placeholder="4001-TUITION"
              style={{ ...inputField("4001-TUITION"), border: typeErrors.gl_code ? "1px solid #ef4444" : "1px solid #E8E8EE" }}
              value={typeGlCode}
              onChange={event => {
                const value = event.target.value.toUpperCase();
                setTypeGlCode(value);
                if (typeErrors.gl_code) {
                  const msg = validateGlCodeClient(value);
                  setTypeErrors(prev => ({ ...prev, gl_code: msg }));
                }
              }}
            />
            <div style={{ marginTop: 6, color: "#6b7280", fontSize: 11.5 }}>Format: 4001-TUITION</div>
            {typeErrors.gl_code ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{typeErrors.gl_code}</div> : null}
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>TAXABLE</div>
            <select value={typeTaxable} onChange={event => setTypeTaxable(event.target.value as "Yes" | "No")} style={inputField("Taxable")}>
              {FEE_TAXABLE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            {typeErrors.taxable ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{typeErrors.taxable}</div> : null}
          </div>
          <div>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>DEFAULT STRUCTURE</div>
            <select value={typeStructure} onChange={event => setTypeStructure(event.target.value as "Monthly" | "Quarterly" | "Term-wise" | "Yearly" | "Custom")} style={inputField("Default Structure")}>
              {FEE_STRUCTURE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
            {typeErrors.default_structure ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{typeErrors.default_structure}</div> : null}
          </div>
        </div>
        {typeErrors.general ? <div style={{ marginBottom: 12, color: "#dc2626", fontSize: 12.5, fontWeight: 600 }}>{typeErrors.general}</div> : null}
        <button
          style={{ ...primaryBtn(), minWidth: 160, paddingLeft: 32, paddingRight: 32 }}
          onClick={handleCreateType}
          disabled={isSavingType}
        >
          {isSavingType ? "Saving..." : "Add"}
        </button>
      </div>

      {/* Table */}
      <div style={{ ...card, padding: 0, overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1.4fr .9fr .8fr", gap: 10, padding: "14px 16px", borderBottom: "1px solid #E8E8EE" }}>
          <input
            placeholder="Search by fee type name or GL code"
            value={typeSearch}
            onChange={event => setTypeSearch(event.target.value)}
            style={inputField("Search")}
          />
          <select value={typeSortBy || "name"} onChange={event => { setTypeSortBy(event.target.value as FeeTypeListParams["sort_by"]); setTypePage(1); }} style={inputField("Sort by")}>
            <option value="name">Sort: Name</option>
            <option value="gl_code">Sort: GL Code</option>
            <option value="status">Sort: Status</option>
            <option value="created_date">Sort: Created Date</option>
            <option value="updated_date">Sort: Updated Date</option>
          </select>
          <select value={typeStatusFilter} onChange={event => { setTypeStatusFilter(event.target.value as "" | "active" | "inactive"); setTypePage(1); }} style={inputField("Status filter")}>
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#F8F8FB" }}>
              {["NAME", "GL CODE", "TAXABLE", "DEFAULT STRUCTURE", "STATUS", "ACTIONS"].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoadingTypes ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, color: "#5B5E72" }}>Loading fee types...</td>
              </tr>
            ) : feeTypes.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ ...tdStyle, color: "#5B5E72" }}>No fee types found.</td>
              </tr>
            ) : (
              feeTypes.map((ft, i) => (
                <tr key={ft.id} style={{ borderBottom: i < feeTypes.length - 1 ? "1px solid #E8E8EE" : "none" }}>
                  <td style={{ ...tdStyle, fontWeight: 600 }}>{ft.name}</td>
                  <td style={tdMuted}>{ft.gl_code}</td>
                  <td style={tdMuted}>{ft.taxable}</td>
                  <td style={tdMuted}>{ft.default_structure}</td>
                  <td style={tdStyle}>{statusPill(ft.status)}</td>
                  <td style={tdStyle}>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <button style={outlineBtn(true)} onClick={() => openEditTypeModal(ft)}>Edit</button>
                      <button style={dangerBtn(true)} onClick={() => openDeleteTypeModal(ft)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
        {!isLoadingTypes && typeTotalCount > 0 && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 6, alignItems: "center", padding: "10px 14px", borderTop: "1px solid #E8E8EE" }}>
            <button type="button" onClick={() => setTypePage(prev => Math.max(1, prev - 1))} disabled={typePage <= 1} style={{ height: 28, minWidth: 44, borderRadius: 8, border: "1px solid #E8E8EE", background: "#fff", color: "#5B5E72", fontSize: 12, cursor: typePage <= 1 ? "not-allowed" : "pointer", opacity: typePage <= 1 ? 0.5 : 1 }}>
              Prev
            </button>
            {typePaginationPages.map(page => (
              <button key={page} type="button" onClick={() => setTypePage(page)} style={{ height: 28, minWidth: 28, borderRadius: 8, border: "1px solid #E8E8EE", background: page === typePage ? "#5B4FCF" : "#fff", color: page === typePage ? "#fff" : "#5B5E72", fontSize: 12, cursor: "pointer" }}>
                {page}
              </button>
            ))}
            <button type="button" onClick={() => setTypePage(prev => Math.min(typeTotalPages, prev + 1))} disabled={typePage >= typeTotalPages} style={{ height: 28, minWidth: 44, borderRadius: 8, border: "1px solid #E8E8EE", background: "#fff", color: "#5B5E72", fontSize: 12, cursor: typePage >= typeTotalPages ? "not-allowed" : "pointer", opacity: typePage >= typeTotalPages ? 0.5 : 1 }}>
              Next
            </button>
          </div>
        )}
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
        <button
          type="button"
          onClick={() => setIsTermSettingsOpen(prev => !prev)}
          style={{
            width: "100%",
            background: "none",
            border: "none",
            padding: 0,
            textAlign: "left",
            cursor: "pointer",
            outline: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 4 }}>
              School Term Settings
            </div>
            <div style={{ fontSize: 13, color: "#A0A3B8" }}>
              Set how many terms your school uses. This controls term slots in all fee schedules below.
            </div>
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#6D4AFF",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: "1px solid #E8E8EE",
              background: "#fff",
              transform: isTermSettingsOpen ? "rotate(180deg)" : "rotate(0deg)",
              transition: "transform 0.2s ease",
            }}
          >
            ▼
          </div>
        </button>

        <div
          style={{
            maxHeight: isTermSettingsOpen ? "1500px" : "0px",
            opacity: isTermSettingsOpen ? 1 : 0,
            overflow: "hidden",
            transition: "max-height 0.3s ease-in-out, opacity 0.25s ease-in-out, margin-top 0.25s ease-in-out",
            marginTop: isTermSettingsOpen ? 20 : 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: 24, marginBottom: 20 }}>
            <div style={{ flex: "0 0 auto", minWidth: 180 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 8 }}>
                NUMBER OF TERMS PER YEAR
              </div>
              <select
                value={numTerms}
                onChange={e => {
                  const count = Number(e.target.value);
                  setNumTerms(count);
                  const year = academicYears.find(y => y.id === academicYearId);
                  const nextTerms = generateDefaultTerms(year, count);
                  setTerms(nextTerms);
                }}
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
              <button
                style={{
                  ...primaryBtn(),
                  background: (isSavingTermSettings || !hasTermSettingsChanged()) ? "#a3a5b3" : "#6D4AFF",
                  opacity: (isSavingTermSettings || !hasTermSettingsChanged()) ? 0.65 : 1,
                  cursor: (isSavingTermSettings || !hasTermSettingsChanged()) ? "not-allowed" : "pointer",
                  transition: "all 0.2s ease"
                }}
                onClick={handleSaveTermSettings}
                disabled={isSavingTermSettings || !hasTermSettingsChanged()}
              >
                {isSavingTermSettings ? "Saving..." : "Save Term Settings"}
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
                <div style={{ flex: 1.5 }}>
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
                <div style={{ flex: 1.2 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>
                    START DATE
                  </div>
                  <input
                    type="date"
                    value={terms[i]?.startDate ?? ""}
                    onChange={e => {
                      const next = [...terms];
                      next[i] = { ...next[i], startDate: e.target.value };
                      setTerms(next);
                    }}
                    style={{
                      width: "100%", height: 40, border: "1px solid #E8E8EE",
                      borderRadius: 8, padding: "0 12px", fontSize: 13.5,
                      background: "#fff", cursor: "pointer",
                    }}
                  />
                </div>
                <div style={{ flex: 1.2 }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>
                    END DATE
                  </div>
                  <input
                    type="date"
                    value={terms[i]?.endDate ?? ""}
                    onChange={e => {
                      const next = [...terms];
                      next[i] = { ...next[i], endDate: e.target.value };
                      setTerms(next);
                    }}
                    style={{
                      width: "100%", height: 40, border: "1px solid #E8E8EE",
                      borderRadius: 8, padding: "0 12px", fontSize: 13.5,
                      background: "#fff", cursor: "pointer",
                    }}
                  />
                </div>
                <div style={{ flex: 1.2 }}>
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
      </div>

      {/* Fee Schedules List */}
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 4 }}>Fee Schedules</div>
            <div style={{ fontSize: 13, color: "#A0A3B8" }}>Manage fee collection schedules for each fee type per group.</div>
          </div>
          <button
            style={primaryBtn()}
            onClick={() => {
              setScheduleAcademicYear(academicYearId || "");
              setScheduleFeeGroup("");
              setScheduleFeeType("");
              setScheduleAmount("");
              setScheduleFrequency("Term-wise"); // set default to Term-wise
              setScheduleDueDate("");
              setScheduleLateFee(false);
              setScheduleGracePeriod(0);
              setScheduleLateFeeRule("");
              
              // Fill initial term breakdown
              const initialBreakdown = termSettings.map(term => ({
                term_number: term.term_number,
                term_name: term.term_name,
                amount: "",
                due_date: term.default_due_date || "",
              }));
              setScheduleTermBreakdown(initialBreakdown);

              setScheduleStatus("active");
              setScheduleErrors({});
              setIsCreateScheduleOpen(true);
            }}
          >
            + Create Schedule
          </button>
        </div>

        {/* Search & Filters */}
        <div style={{ display: "flex", gap: 12, marginBottom: 18, flexWrap: "wrap" }}>
          <input
            type="text"
            placeholder="Search by fee group, fee type, or academic year..."
            value={scheduleSearch}
            onChange={e => setScheduleSearch(e.target.value)}
            style={{
              flex: 1, minWidth: 200, height: 36, border: "1px solid #E8E8EE",
              borderRadius: 8, padding: "0 12px", fontSize: 13,
            }}
          />
          <select
            value={scheduleSortBy}
            onChange={e => setScheduleSortBy(e.target.value)}
            style={{
              height: 36, border: "1px solid #E8E8EE", borderRadius: 8,
              padding: "0 12px", fontSize: 13, background: "#fff", cursor: "pointer",
            }}
          >
            <option value="created_at">Latest First</option>
            <option value="fee_group">By Fee Group</option>
            <option value="fee_type">By Fee Type</option>
            <option value="amount">By Amount</option>
          </select>
          <select
            value={scheduleStatusFilter}
            onChange={e => setScheduleStatusFilter(e.target.value as "" | "active" | "inactive")}
            style={{
              height: 36, border: "1px solid #E8E8EE", borderRadius: 8,
              padding: "0 12px", fontSize: 13, background: "#fff", cursor: "pointer",
            }}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>

        {/* Schedules Table */}
        {isLoadingSchedules ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#A0A3B8" }}>
            <div style={{ fontSize: 14 }}>Loading fee schedules...</div>
          </div>
        ) : feeSchedules.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 20px", color: "#A0A3B8" }}>
            <div style={{ fontSize: 14 }}>No fee schedules found. Create one to get started.</div>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto", marginBottom: 16 }}>
              <table style={{
                width: "100%", borderCollapse: "collapse",
                fontSize: 13, color: "#181B2A",
              }}>
                <thead>
                  <tr style={{ borderBottom: "2px solid #E8E8EE", background: "#F8F8FB" }}>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 700 }}>Fee Group</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 700 }}>Fee Type</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 700 }}>Amount</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 700 }}>Frequency</th>
                    <th style={{ padding: "12px", textAlign: "left", fontWeight: 700 }}>Status</th>
                    <th style={{ padding: "12px", textAlign: "center", fontWeight: 700 }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {feeSchedules.map((schedule, idx) => (
                    <tr key={schedule.id} style={{
                      borderBottom: "1px solid #E8E8EE",
                      background: idx % 2 === 0 ? "#fff" : "#F8F8FB",
                    }}>
                      <td style={{ padding: "12px" }}>{schedule.fee_group_name || schedule.fee_group}</td>
                      <td style={{ padding: "12px" }}>{schedule.fee_type_name || schedule.fee_type}</td>
                      <td style={{ padding: "12px", fontWeight: 600 }}>₹{Number(schedule.amount).toLocaleString('en-IN')}</td>
                      <td style={{ padding: "12px" }}>{schedule.collection_frequency}</td>
                      <td style={{ padding: "12px" }}>
                        <span style={{
                          padding: "4px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600,
                          background: schedule.status === "active" ? "#dcfce7" : "#fee2e2",
                          color: schedule.status === "active" ? "#15803d" : "#991b1b",
                        }}>
                          {schedule.status}
                        </span>
                      </td>
                      <td style={{ padding: "12px", textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button
                            style={outlineBtn(true)}
                            onClick={() => {
                              setEditingSchedule(schedule);
                              setEditScheduleAcademicYear(schedule.academic_year);
                              setEditScheduleFeeGroup(schedule.fee_group);
                              setEditScheduleFeeType(schedule.fee_type);
                              setEditScheduleAmount(schedule.amount);
                              setEditScheduleFrequency(schedule.collection_frequency);
                              setEditScheduleDueDate(schedule.due_date);
                              setEditScheduleLateFee(schedule.late_fee_applicable);
                              setEditScheduleStatus(schedule.status);
                              setEditScheduleGracePeriod(schedule.grace_period || 0);
                              setEditScheduleLateFeeRule(schedule.late_fee_rule || "");
                              
                              if (schedule.term_breakdown && schedule.term_breakdown.length > 0) {
                                setEditScheduleTermBreakdown(JSON.parse(JSON.stringify(schedule.term_breakdown)));
                              } else {
                                const initialBreakdown = termSettings.map(term => ({
                                  term_number: term.term_number,
                                  term_name: term.term_name,
                                  amount: "",
                                  due_date: term.default_due_date || "",
                                }));
                                setEditScheduleTermBreakdown(initialBreakdown);
                              }
                              
                              setEditScheduleErrors({});
                              setIsEditScheduleOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            style={dangerBtn(true)}
                            onClick={() => {
                              setDeleteSchedule(schedule);
                              setDeleteScheduleError("");
                              setIsDeleteScheduleOpen(true);
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {scheduleTotalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", gap: 8, padding: "16px 0" }}>
                <button
                  disabled={schedulePage === 1}
                  onClick={() => setSchedulePage(Math.max(1, schedulePage - 1))}
                  style={{ padding: "6px 12px", border: "1px solid #E8E8EE", borderRadius: 6, cursor: schedulePage === 1 ? "default" : "pointer", opacity: schedulePage === 1 ? 0.5 : 1 }}
                >
                  ← Prev
                </button>
                <div style={{ padding: "6px 12px", color: "#A0A3B8" }}>
                  Page {schedulePage} of {scheduleTotalPages}
                </div>
                <button
                  disabled={schedulePage >= scheduleTotalPages}
                  onClick={() => setSchedulePage(Math.min(scheduleTotalPages, schedulePage + 1))}
                  style={{ padding: "6px 12px", border: "1px solid #E8E8EE", borderRadius: 6, cursor: schedulePage >= scheduleTotalPages ? "default" : "pointer", opacity: schedulePage >= scheduleTotalPages ? 0.5 : 1 }}
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  // ── Create/Edit Schedule Modal ───────────────────────────────────────

  const createScheduleModal = isCreateScheduleOpen && (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 9999,
    }} onClick={() => setIsCreateScheduleOpen(false)}>
      <div
        style={{
          background: "#fff", borderRadius: 12, padding: "28px", maxWidth: scheduleFrequency === "Term-wise" ? 950 : 540,
          width: "95%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
          transition: "max-width 0.2s ease-in-out",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #F1F1F4", paddingBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#181B2A", margin: 0 }}>Create Fee Schedule</h2>
          <button 
            onClick={() => setIsCreateScheduleOpen(false)}
            style={{ border: "none", background: "none", fontSize: 20, color: "#A0A3B8", cursor: "pointer", fontWeight: "bold" }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: "28px", flexDirection: scheduleFrequency === "Term-wise" ? "row" : "column", flexWrap: "wrap" }}>
          
          {/* Left / Main Section: General Configuration */}
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Academic Year</label>
              <select
                disabled
                value={scheduleAcademicYear}
                style={{
                  width: "100%", height: 40, border: "1px solid #E8E8EE",
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#F8F8FB", color: "#5B5E72",
                }}
              >
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Fee Group</label>
              <select
                value={scheduleFeeGroup}
                onChange={e => {
                  const val = Number(e.target.value) || "";
                  setScheduleFeeGroup(val);
                  setScheduleFeeType("");
                }}
                style={{
                  width: "100%", height: 40, border: `1px solid ${scheduleErrors.fee_group ? "#dc2626" : "#E8E8EE"}`,
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                }}
              >
                <option value="">Select fee group</option>
                {feeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {scheduleErrors.fee_group && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{scheduleErrors.fee_group}</div>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Fee Type</label>
              <select
                value={scheduleFeeType}
                onChange={e => setScheduleFeeType(Number(e.target.value) || "")}
                style={{
                  width: "100%", height: 40, border: `1px solid ${scheduleErrors.fee_type ? "#dc2626" : "#E8E8EE"}`,
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                }}
              >
                <option value="">Select fee type</option>
                {feeTypes.filter(t => !scheduleFeeGroup || t.fees_group === scheduleFeeGroup).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {scheduleErrors.fee_type && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{scheduleErrors.fee_type}</div>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Collection Frequency / Structure</label>
              <select
                value={scheduleFrequency}
                onChange={e => {
                  const val = e.target.value;
                  setScheduleFrequency(val);
                  if (val === "Term-wise" && scheduleTermBreakdown.length === 0) {
                    const initialBreakdown = termSettings.map(term => ({
                      term_number: term.term_number,
                      term_name: term.term_name,
                      amount: "",
                      due_date: term.default_due_date || "",
                    }));
                    setScheduleTermBreakdown(initialBreakdown);
                  }
                }}
                style={{
                  width: "100%", height: 40, border: "1px solid #E8E8EE",
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                }}
              >
                <option value="Term-wise">Term-wise</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Half-Yearly">Half-Yearly</option>
                <option value="Yearly">Yearly</option>
                <option value="One-Time">One-Time</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            {scheduleFrequency !== "Term-wise" && (
              <>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={scheduleAmount}
                    onChange={e => setScheduleAmount(e.target.value)}
                    style={{
                      width: "100%", height: 40, border: `1px solid ${scheduleErrors.amount ? "#dc2626" : "#E8E8EE"}`,
                      borderRadius: 8, padding: "0 12px", fontSize: 13,
                    }}
                    placeholder="0.00"
                  />
                  {scheduleErrors.amount && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{scheduleErrors.amount}</div>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Due Date</label>
                  <input
                    type="date"
                    value={scheduleDueDate}
                    onChange={e => setScheduleDueDate(e.target.value)}
                    style={{
                      width: "100%", height: 40, border: `1px solid ${scheduleErrors.due_date ? "#dc2626" : "#E8E8EE"}`,
                      borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                    }}
                  />
                  {scheduleErrors.due_date && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{scheduleErrors.due_date}</div>}
                </div>
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <input
                type="checkbox"
                id="scheduleLateFee"
                checked={scheduleLateFee}
                onChange={e => setScheduleLateFee(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <label htmlFor="scheduleLateFee" style={{ fontSize: 13, color: "#181B2A", fontWeight: 600, cursor: "pointer" }}>Late fee applicable</label>
            </div>

            {scheduleLateFee && (
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Grace Period (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={scheduleGracePeriod}
                    onChange={e => setScheduleGracePeriod(Number(e.target.value) || 0)}
                    style={{
                      width: "100%", height: 40, border: "1px solid #E8E8EE",
                      borderRadius: 8, padding: "0 12px", fontSize: 13,
                    }}
                    placeholder="0"
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Late Fee Rule</label>
                  <input
                    type="text"
                    value={scheduleLateFeeRule}
                    onChange={e => setScheduleLateFeeRule(e.target.value)}
                    style={{
                      width: "100%", height: 40, border: "1px solid #E8E8EE",
                      borderRadius: 8, padding: "0 12px", fontSize: 13,
                    }}
                    placeholder="e.g. ₹50 per day after grace period"
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Status</label>
              <select
                value={scheduleStatus}
                onChange={e => setScheduleStatus(e.target.value)}
                style={{
                  width: "100%", height: 40, border: "1px solid #E8E8EE",
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Right Section: Term Settings breakdown slots */}
          {scheduleFrequency === "Term-wise" && (
            <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ borderBottom: "1px solid #E8E8EE", paddingBottom: 6 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181B2A", margin: 0 }}>Term-wise Breakdown Slots</h3>
                <p style={{ fontSize: 11, color: "#A0A3B8", margin: "2px 0 0 0" }}>Specify amounts and due dates of each term. Total amount is calculated automatically.</p>
              </div>

              {scheduleTermBreakdown.length === 0 ? (
                <div style={{ padding: "30px 10px", border: "1px dashed #E8E8EE", borderRadius: 8, textAlign: "center", color: "#A0A3B8" }}>
                  <p style={{ fontSize: 13, margin: 0 }}>No terms configured for this Academic Year.</p>
                  <p style={{ fontSize: 11, margin: "4px 0 0 0" }}>Please configure terms first in the 'School Term Settings' collapsible section above.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "55vh", overflowY: "auto", paddingRight: 6 }}>
                  {scheduleTermBreakdown.map((tb, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 12, 
                        padding: "12px", 
                        background: "#F8F8FB", 
                        borderRadius: 10, 
                        border: "1px solid #E5E7EB" 
                      }}
                    >
                      <div style={{ 
                        width: 34, 
                        height: 34, 
                        borderRadius: "50%", 
                        background: "#EDE9FE", 
                        color: "#6D28D9", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        fontWeight: 700, 
                        fontSize: 12, 
                        flexShrink: 0,
                        border: "1px solid #C4B5FD"
                      }}>
                        T{tb.term_number || (i + 1)}
                      </div>
                      <div style={{ flex: 1, minWidth: 80 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#A0A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Term Name</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", marginTop: 2 }}>{tb.term_name}</div>
                      </div>
                      <div style={{ width: 110 }}>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#A0A3B8", marginBottom: 4 }}>AMOUNT (₹)</label>
                        <input
                          type="number"
                          value={tb.amount}
                          onChange={e => {
                            const next = [...scheduleTermBreakdown];
                            next[i] = { ...next[i], amount: e.target.value };
                            setScheduleTermBreakdown(next);
                            const total = next.reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);
                            setScheduleAmount(total > 0 ? total.toString() : "");
                          }}
                          style={{
                            width: "100%", height: 34, border: "1px solid #E8E8EE",
                            borderRadius: 6, padding: "0 8px", fontSize: 12.5,
                          }}
                          placeholder="₹0.00"
                        />
                      </div>
                      <div style={{ width: 140 }}>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#A0A3B8", marginBottom: 4 }}>DUE DATE</label>
                        <input
                          type="date"
                          value={tb.due_date}
                          onChange={e => {
                            const next = [...scheduleTermBreakdown];
                            next[i] = { ...next[i], due_date: e.target.value };
                            setScheduleTermBreakdown(next);
                          }}
                          style={{
                            width: "100%", height: 34, border: "1px solid #E8E8EE",
                            borderRadius: 6, padding: "0 8px", fontSize: 12, background: "#fff", cursor: "pointer",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {/* Dynamic Total Amount breakdown summary */}
                  <div style={{ 
                    marginTop: 8, 
                    padding: "12px", 
                    background: "#EEF2F6", 
                    borderRadius: 8, 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    border: "1px solid #D2D6DC"
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Total Fee Schedule Amount:</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>
                      ₹{Number(scheduleAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 28, borderTop: "1px solid #F1F1F4", paddingTop: 18 }}>
          <button
            style={{...outlineBtn(), flex: 1}}
            onClick={() => setIsCreateScheduleOpen(false)}
          >
            Cancel
          </button>
          <button
            style={{...primaryBtn(), flex: 1}}
            onClick={handleCreateSchedule}
            disabled={isSavingSchedule}
          >
            {isSavingSchedule ? "Creating..." : "Create Schedule"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Edit Schedule Modal ──────────────────────────────────────────────

  const editScheduleModal = isEditScheduleOpen && editingSchedule && (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 9999,
    }} onClick={() => setIsEditScheduleOpen(false)}>
      <div
        style={{
          background: "#fff", borderRadius: 12, padding: "28px", maxWidth: editScheduleFrequency === "Term-wise" ? 950 : 540,
          width: "95%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 50px rgba(0,0,0,0.15)",
          transition: "max-width 0.2s ease-in-out",
        }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20, borderBottom: "1px solid #F1F1F4", paddingBottom: 12 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#181B2A", margin: 0 }}>Edit Fee Schedule</h2>
          <button 
            onClick={() => setIsEditScheduleOpen(false)}
            style={{ border: "none", background: "none", fontSize: 20, color: "#A0A3B8", cursor: "pointer", fontWeight: "bold" }}
          >
            ×
          </button>
        </div>

        <div style={{ display: "flex", gap: "28px", flexDirection: editScheduleFrequency === "Term-wise" ? "row" : "column", flexWrap: "wrap" }}>
          
          {/* Left / Main Section: General Configuration */}
          <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Academic Year</label>
              <select
                disabled
                value={editScheduleAcademicYear}
                style={{
                  width: "100%", height: 40, border: "1px solid #E8E8EE",
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#F8F8FB", color: "#5B5E72",
                }}
              >
                {academicYears.map(y => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Fee Group</label>
              <select
                value={editScheduleFeeGroup}
                onChange={e => {
                  const val = Number(e.target.value) || "";
                  setEditScheduleFeeGroup(val);
                  setEditScheduleFeeType("");
                }}
                style={{
                  width: "100%", height: 40, border: `1px solid ${editScheduleErrors.fee_group ? "#dc2626" : "#E8E8EE"}`,
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                }}
              >
                <option value="">Select fee group</option>
                {feeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
              {editScheduleErrors.fee_group && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{editScheduleErrors.fee_group}</div>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Fee Type</label>
              <select
                value={editScheduleFeeType}
                onChange={e => setEditScheduleFeeType(Number(e.target.value) || "")}
                style={{
                  width: "100%", height: 40, border: `1px solid ${editScheduleErrors.fee_type ? "#dc2626" : "#E8E8EE"}`,
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                }}
              >
                <option value="">Select fee type</option>
                {feeTypes.filter(t => !editScheduleFeeGroup || t.fees_group === editScheduleFeeGroup).map(t => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {editScheduleErrors.fee_type && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{editScheduleErrors.fee_type}</div>}
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Collection Frequency / Structure</label>
              <select
                value={editScheduleFrequency}
                onChange={e => {
                  const val = e.target.value;
                  setEditScheduleFrequency(val);
                  if (val === "Term-wise" && editScheduleTermBreakdown.length === 0) {
                    const initialBreakdown = termSettings.map(term => ({
                      term_number: term.term_number,
                      term_name: term.term_name,
                      amount: "",
                      due_date: term.default_due_date || "",
                    }));
                    setEditScheduleTermBreakdown(initialBreakdown);
                  }
                }}
                style={{
                  width: "100%", height: 40, border: "1px solid #E8E8EE",
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                }}
              >
                <option value="Term-wise">Term-wise</option>
                <option value="Monthly">Monthly</option>
                <option value="Quarterly">Quarterly</option>
                <option value="Half-Yearly">Half-Yearly</option>
                <option value="Yearly">Yearly</option>
                <option value="One-Time">One-Time</option>
                <option value="Custom">Custom</option>
              </select>
            </div>

            {editScheduleFrequency !== "Term-wise" && (
              <>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Amount (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editScheduleAmount}
                    onChange={e => setEditScheduleAmount(e.target.value)}
                    style={{
                      width: "100%", height: 40, border: `1px solid ${editScheduleErrors.amount ? "#dc2626" : "#E8E8EE"}`,
                      borderRadius: 8, padding: "0 12px", fontSize: 13,
                    }}
                    placeholder="0.00"
                  />
                  {editScheduleErrors.amount && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{editScheduleErrors.amount}</div>}
                </div>

                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Due Date</label>
                  <input
                    type="date"
                    value={editScheduleDueDate}
                    onChange={e => setEditScheduleDueDate(e.target.value)}
                    style={{
                      width: "100%", height: 40, border: `1px solid ${editScheduleErrors.due_date ? "#dc2626" : "#E8E8EE"}`,
                      borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                    }}
                  />
                  {editScheduleErrors.due_date && <div style={{ fontSize: 12, color: "#dc2626", marginTop: 4 }}>{editScheduleErrors.due_date}</div>}
                </div>
              </>
            )}

            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 4 }}>
              <input
                type="checkbox"
                id="editScheduleLateFee"
                checked={editScheduleLateFee}
                onChange={e => setEditScheduleLateFee(e.target.checked)}
                style={{ width: 18, height: 18, cursor: "pointer" }}
              />
              <label htmlFor="editScheduleLateFee" style={{ fontSize: 13, color: "#181B2A", fontWeight: 600, cursor: "pointer" }}>Late fee applicable</label>
            </div>

            {editScheduleLateFee && (
              <div style={{ display: "flex", gap: "12px" }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Grace Period (Days)</label>
                  <input
                    type="number"
                    min="0"
                    value={editScheduleGracePeriod}
                    onChange={e => setEditScheduleGracePeriod(Number(e.target.value) || 0)}
                    style={{
                      width: "100%", height: 40, border: "1px solid #E8E8EE",
                      borderRadius: 8, padding: "0 12px", fontSize: 13,
                    }}
                    placeholder="0"
                  />
                </div>
                <div style={{ flex: 2 }}>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Late Fee Rule</label>
                  <input
                    type="text"
                    value={editScheduleLateFeeRule}
                    onChange={e => setEditScheduleLateFeeRule(e.target.value)}
                    style={{
                      width: "100%", height: 40, border: "1px solid #E8E8EE",
                      borderRadius: 8, padding: "0 12px", fontSize: 13,
                    }}
                    placeholder="e.g. ₹50 per day after grace period"
                  />
                </div>
              </div>
            )}

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, marginBottom: 6, color: "#5B5E72" }}>Status</label>
              <select
                value={editScheduleStatus}
                onChange={e => setEditScheduleStatus(e.target.value)}
                style={{
                  width: "100%", height: 40, border: "1px solid #E8E8EE",
                  borderRadius: 8, padding: "0 12px", fontSize: 13, background: "#fff",
                }}
              >
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          {/* Right Section: Term Settings breakdown slots */}
          {editScheduleFrequency === "Term-wise" && (
            <div style={{ flex: "1 1 420px", display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ borderBottom: "1px solid #E8E8EE", paddingBottom: 6 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: "#181B2A", margin: 0 }}>Term-wise Breakdown Slots</h3>
                <p style={{ fontSize: 11, color: "#A0A3B8", margin: "2px 0 0 0" }}>Specify amounts and due dates of each term. Total amount is calculated automatically.</p>
              </div>

              {editScheduleTermBreakdown.length === 0 ? (
                <div style={{ padding: "30px 10px", border: "1px dashed #E8E8EE", borderRadius: 8, textAlign: "center", color: "#A0A3B8" }}>
                  <p style={{ fontSize: 13, margin: 0 }}>No terms configured for this Academic Year.</p>
                  <p style={{ fontSize: 11, margin: "4px 0 0 0" }}>Please configure terms first in the 'School Term Settings' collapsible section above.</p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: "55vh", overflowY: "auto", paddingRight: 6 }}>
                  {editScheduleTermBreakdown.map((tb, i) => (
                    <div 
                      key={i} 
                      style={{ 
                        display: "flex", 
                        alignItems: "center", 
                        gap: 12, 
                        padding: "12px", 
                        background: "#F8F8FB", 
                        borderRadius: 10, 
                        border: "1px solid #E5E7EB" 
                      }}
                    >
                      <div style={{ 
                        width: 34, 
                        height: 34, 
                        borderRadius: "50%", 
                        background: "#EDE9FE", 
                        color: "#6D28D9", 
                        display: "flex", 
                        alignItems: "center", 
                        justifyContent: "center", 
                        fontWeight: 700, 
                        fontSize: 12, 
                        flexShrink: 0,
                        border: "1px solid #C4B5FD"
                      }}>
                        T{tb.term_number || (i + 1)}
                      </div>
                      <div style={{ flex: 1, minWidth: 80 }}>
                        <div style={{ fontSize: 10.5, fontWeight: 700, color: "#A0A3B8", textTransform: "uppercase", letterSpacing: "0.05em" }}>Term Name</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#1F2937", marginTop: 2 }}>{tb.term_name}</div>
                      </div>
                      <div style={{ width: 110 }}>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#A0A3B8", marginBottom: 4 }}>AMOUNT (₹)</label>
                        <input
                          type="number"
                          value={tb.amount}
                          onChange={e => {
                            const next = [...editScheduleTermBreakdown];
                            next[i] = { ...next[i], amount: e.target.value };
                            setEditScheduleTermBreakdown(next);
                            const total = next.reduce((sum, curr) => sum + (Number(curr.amount) || 0), 0);
                            setEditScheduleAmount(total > 0 ? total.toString() : "");
                          }}
                          style={{
                            width: "100%", height: 34, border: "1px solid #E8E8EE",
                            borderRadius: 6, padding: "0 8px", fontSize: 12.5,
                          }}
                          placeholder="₹0.00"
                        />
                      </div>
                      <div style={{ width: 140 }}>
                        <label style={{ display: "block", fontSize: 10.5, fontWeight: 700, color: "#A0A3B8", marginBottom: 4 }}>DUE DATE</label>
                        <input
                          type="date"
                          value={tb.due_date}
                          onChange={e => {
                            const next = [...editScheduleTermBreakdown];
                            next[i] = { ...next[i], due_date: e.target.value };
                            setEditScheduleTermBreakdown(next);
                          }}
                          style={{
                            width: "100%", height: 34, border: "1px solid #E8E8EE",
                            borderRadius: 6, padding: "0 8px", fontSize: 12, background: "#fff", cursor: "pointer",
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  
                  {/* Dynamic Total Amount breakdown summary */}
                  <div style={{ 
                    marginTop: 8, 
                    padding: "12px", 
                    background: "#EEF2F6", 
                    borderRadius: 8, 
                    display: "flex", 
                    justifyContent: "space-between", 
                    alignItems: "center",
                    border: "1px solid #D2D6DC"
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#475569" }}>Total Fee Schedule Amount:</span>
                    <span style={{ fontSize: 16, fontWeight: 800, color: "#1E293B" }}>
                      ₹{Number(editScheduleAmount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        <div style={{ display: "flex", gap: 10, marginTop: 28, borderTop: "1px solid #F1F1F4", paddingTop: 18 }}>
          <button
            style={{...outlineBtn(), flex: 1}}
            onClick={() => setIsEditScheduleOpen(false)}
          >
            Cancel
          </button>
          <button
            style={{...primaryBtn(), flex: 1}}
            onClick={handleUpdateSchedule}
            disabled={isSavingScheduleEdit}
          >
            {isSavingScheduleEdit ? "Updating..." : "Update Schedule"}
          </button>
        </div>
      </div>
    </div>
  );

  // ── Delete Schedule Modal ────────────────────────────────────────────

  const deleteScheduleModal = isDeleteScheduleOpen && deleteSchedule && (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "center", justifyContent: "center", zIndex: 9999,
    }} onClick={() => setIsDeleteScheduleOpen(false)}>
      <div
        style={{
          background: "#fff", borderRadius: 12, padding: "24px", maxWidth: 400,
          width: "90%", boxShadow: "0 10px 40px rgba(0,0,0,0.1)",
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 12, color: "#181B2A" }}>Delete Fee Schedule?</h2>
        <p style={{ fontSize: 14, color: "#5B5E72", marginBottom: 4 }}>
          Are you sure you want to delete this fee schedule? This action cannot be undone.
        </p>
        {deleteScheduleError && (
          <div style={{
            padding: "10px 12px", borderRadius: 6, background: "#fee2e2",
            color: "#991b1b", fontSize: 13, marginBottom: 16, borderLeft: "3px solid #dc2626",
          }}>
            {deleteScheduleError}
          </div>
        )}
        <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
          <button
            style={{...outlineBtn(), flex: 1}}
            onClick={() => setIsDeleteScheduleOpen(false)}
          >
            Cancel
          </button>
          <button
            style={{...dangerBtn(), flex: 1}}
            onClick={handleDeleteSchedule}
            disabled={isDeletingSchedule}
          >
            {isDeletingSchedule ? "Deleting..." : "Delete"}
          </button>
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

        {isEditTypeOpen && editingType && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,40,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 65, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 14, width: 560, maxWidth: "100%", boxShadow: "0 20px 50px rgba(20,24,40,.3)", overflow: "hidden" }}>
              <div style={{ padding: "18px 20px", borderBottom: "1px solid #E8E8EE", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontSize: 16, fontWeight: 700 }}>Edit Fee Type</div>
                <button onClick={closeEditTypeModal} style={{ width: 30, height: 30, border: "none", background: "transparent", fontSize: 22, color: "#8a90a2", cursor: "pointer", borderRadius: 7 }}>
                  &times;
                </button>
              </div>
              <div style={{ padding: 20, display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 14 }}>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 6 }}>FEE GROUP</div>
                  <select
                    value={editTypeGroupId}
                    onChange={event => setEditTypeGroupId(event.target.value === "" ? "" : Number(event.target.value))}
                    style={inputField("Select Fee Group")}
                  >
                    <option value="">Select Fee Group</option>
                    {feeGroups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  {editTypeErrors.fees_group ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{editTypeErrors.fees_group}</div> : null}
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 6 }}>FEE TYPE NAME</div>
                  <input
                    value={editTypeName}
                    onChange={event => {
                      const nextName = event.target.value;
                      setEditTypeName(nextName);
                      if (!editTypeGlCode.trim()) {
                        const suggested = suggestedCodeForName(nextName);
                        if (suggested) setEditTypeGlCode(suggested);
                      }
                    }}
                    style={inputField("Fee Type Name")}
                  />
                  {editTypeErrors.name ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{editTypeErrors.name}</div> : null}
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 6 }}>GL CODE</div>
                  <input
                    value={editTypeGlCode}
                    onChange={event => {
                      const value = event.target.value.toUpperCase();
                      setEditTypeGlCode(value);
                      if (editTypeErrors.gl_code && editingType) {
                        const msg = validateGlCodeClient(value, editingType.id);
                        setEditTypeErrors(prev => ({ ...prev, gl_code: msg }));
                      }
                    }}
                    style={{ ...inputField("GL Code"), border: editTypeErrors.gl_code ? "1px solid #ef4444" : "1px solid #E8E8EE" }}
                  />
                  <div style={{ marginTop: 6, color: "#6b7280", fontSize: 11.5 }}>Format: 4001-TUITION</div>
                  {editTypeErrors.gl_code ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{editTypeErrors.gl_code}</div> : null}
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 6 }}>TAXABLE</div>
                  <select value={editTypeTaxable} onChange={event => setEditTypeTaxable(event.target.value as "Yes" | "No")} style={inputField("Taxable")}>
                    {FEE_TAXABLE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                  {editTypeErrors.taxable ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{editTypeErrors.taxable}</div> : null}
                </div>
                <div>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 6 }}>DEFAULT STRUCTURE</div>
                  <select value={editTypeStructure} onChange={event => setEditTypeStructure(event.target.value as "Monthly" | "Quarterly" | "Term-wise" | "Yearly" | "Custom")} style={inputField("Default Structure")}>
                    {FEE_STRUCTURE_OPTIONS.map(option => <option key={option} value={option}>{option}</option>)}
                  </select>
                  {editTypeErrors.default_structure ? <div style={{ marginTop: 6, color: "#dc2626", fontSize: 12, fontWeight: 600 }}>{editTypeErrors.default_structure}</div> : null}
                </div>
                <div style={{ gridColumn: "1 / -1" }}>
                  <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#8a90a2", marginBottom: 8 }}>STATUS</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    {statusPill(editTypeStatus)}
                    <button
                      type="button"
                      onClick={() => setEditTypeStatus(prev => prev === "Active" ? "Inactive" : "Active")}
                      style={{
                        position: "relative",
                        width: 32,
                        height: 18,
                        borderRadius: 999,
                        border: "1px solid #E8E8EE",
                        background: editTypeStatus === "Active" ? "#e6f6ee" : "#f3f4f6",
                        cursor: "pointer",
                      }}
                      aria-label={editTypeStatus === "Active" ? "Deactivate fee type" : "Activate fee type"}
                    >
                      <span
                        style={{
                          position: "absolute",
                          top: 2,
                          left: editTypeStatus === "Active" ? 16 : 2,
                          width: 12,
                          height: 12,
                          borderRadius: "50%",
                          background: editTypeStatus === "Active" ? "#1d9e63" : "#8a90a2",
                          transition: "left 0.2s ease",
                        }}
                      />
                    </button>
                  </div>
                </div>
              </div>
              {editTypeErrors.general ? <div style={{ margin: "0 20px 14px", color: "#dc2626", fontSize: 12.5, fontWeight: 600 }}>{editTypeErrors.general}</div> : null}
              <div style={{ padding: "16px 20px", borderTop: "1px solid #E8E8EE", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={closeEditTypeModal} style={{ height: 40, padding: "0 18px", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid #d3d7e2", borderRadius: 8, color: "#3b4150", cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleUpdateType} disabled={isSavingTypeEdit} style={{ height: 40, padding: "0 18px", fontSize: 13, fontWeight: 700, background: "#5B4FCF", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer" }}>
                  {isSavingTypeEdit ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          </div>
        )}

        {isDeleteTypeOpen && deleteType && (
          <div style={{ position: "fixed", inset: 0, background: "rgba(20,24,40,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 66, padding: 20 }}>
            <div style={{ background: "#fff", borderRadius: 14, width: 430, maxWidth: "100%", boxShadow: "0 20px 50px rgba(20,24,40,.3)", overflow: "hidden" }}>
              <div style={{ padding: "22px 22px 8px" }}>
                <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Delete Fee Type?</div>
                <div style={{ fontSize: 13, color: "#3b4150", lineHeight: 1.5 }}>
                  This action cannot be undone.
                </div>
              </div>
              {deleteTypeError && (
                <div style={{ margin: "0 22px 10px", padding: "11px 13px", background: "#fdecec", borderRadius: 8, fontSize: 12.5, color: "#a23631" }}>
                  {deleteTypeError}
                </div>
              )}
              <div style={{ padding: "16px 22px", borderTop: "1px solid #E8E8EE", display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button onClick={closeDeleteTypeModal} style={{ height: 40, padding: "0 18px", fontSize: 13, fontWeight: 700, background: "#fff", border: "1px solid #d3d7e2", borderRadius: 8, color: "#3b4150", cursor: "pointer" }}>
                  Cancel
                </button>
                <button onClick={handleDeleteType} disabled={isDeletingType} style={{ height: 40, padding: "0 18px", fontSize: 13, fontWeight: 700, background: "#d8453f", border: "none", borderRadius: 8, color: "#fff", cursor: "pointer" }}>
                  {isDeletingType ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Fee Schedule Modals ─────────────────────────────────────── */}
        {createScheduleModal}
        {editScheduleModal}
        {deleteScheduleModal}

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
