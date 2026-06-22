"use client";
import { useState, useMemo, useEffect } from "react";
import { feesApi, listData } from "@/lib/fees-api";

// ── Types ──────────────────────────────────────────────────────────────────────
type Category = "Day Scholar" | "Transport Users" | "Full Boarder" | "Unassigned";
type FilterTab = "all" | "unassigned" | "assigned";
type Schedule = "Term-wise" | "Monthly" | "Custom";

interface Student { id: string; name: string; admNo: string; category: Category; planAgreed: boolean; }
interface ClassSection { id: string; name: string; students: Student[]; }
interface FeeRow { type: string; schedule: Schedule; howPaid: string; annual: number; }
interface Override { group: string; annual: number; }

// ── Fee data ───────────────────────────────────────────────────────────────────






const INFO_STEPS = [
  { n: 1, title: "Select a fee group", body: "e.g. Day Scholar, Full Boarder. This determines which fee types apply." },
  { n: 2, title: "Choose an instalment plan", body: "term-wise, monthly, or a custom split. This controls when payments are due." },
  { n: 3, title: "Apply a concession", body: "if eligible — Merit, Staff Ward, Sibling, etc. Discounts are computed automatically." },
  { n: 4, title: "Save the assignment", body: "the student moves from Unassigned → Assigned and appears in the Collection tab." },
  { n: 5, title: "Use Bulk Assign", body: "to process a whole class at once when group and plan are the same for all students." },
];

const SCHEDULE_BADGE: Record<Schedule, { bg: string; color: string; border: string }> = {
  "Term-wise": { bg: "#dcfce7", color: "#15803d", border: "#86efac" },
  "Monthly": { bg: "#fef3c7", color: "#d97706", border: "#fde68a" },
  "Custom": { bg: "#fee2e2", color: "#dc2626", border: "#fca5a5" },
};

// ── Mock students ──────────────────────────────────────────────────────────────



const AVATAR_COLORS = ["#6D4AFF", "#0E7490", "#16a34a", "#d97706", "#dc2626", "#7C3AED", "#0284c7", "#9333ea", "#ca8a04", "#059669"];
function avatarBg(name: string) { let h = 0; for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR_COLORS[h % AVATAR_COLORS.length]; }
function initials(name: string) { const p = name.trim().split(" "); return (p[0][0] + (p[1]?.[0] ?? "")).toUpperCase(); }
function fmtRs(n: number) { return "Rs. " + n.toLocaleString("en-IN"); }
function fmtInr(n: number) { return "₹" + n.toLocaleString("en-IN"); }

// ── Style helpers ──────────────────────────────────────────────────────────────
function primaryBtn(small = false): React.CSSProperties {
  return { height: small ? 32 : 38, padding: small ? "0 14px" : "0 20px", background: "#6D4AFF", color: "#fff", border: "none", borderRadius: small ? 7 : 9, fontSize: small ? 12.5 : 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap", boxShadow: "0 2px 8px rgba(109,74,255,0.20)" };
}
function outlineBtn(small = false): React.CSSProperties {
  return { height: small ? 32 : 38, padding: small ? "0 14px" : "0 16px", background: "#fff", color: "#181B2A", border: "1px solid #E8E8EE", borderRadius: small ? 7 : 9, fontSize: small ? 12.5 : 13, fontWeight: 500, cursor: "pointer", whiteSpace: "nowrap" };
}
const TH: React.CSSProperties = { padding: "11px 16px", fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", textAlign: "left", borderBottom: "1px solid #E8E8EE" };
function InfoDot() {
  return <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 15, height: 15, borderRadius: "50%", background: "#E8E8EE", color: "#A0A3B8", fontSize: 9.5, fontWeight: 700, verticalAlign: "middle", marginLeft: 5, flexShrink: 0 }}>i</span>;
}

// ── Shared modal shell ─────────────────────────────────────────────────────────
function ModalShell({ onClose, children, maxWidth = 640 }: { onClose: () => void; children: React.ReactNode; maxWidth?: number }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(14,16,32,0.40)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth, boxShadow: "0 24px 64px rgba(0,0,0,0.22)", animation: "modalIn 0.18s ease", maxHeight: "90vh", overflowY: "auto" }} onClick={e => e.stopPropagation()}>
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
        <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: "50%", border: "1px solid #E8E8EE", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 15, color: "#A0A3B8", lineHeight: 1 }}>×</button>
      </div>
      <div style={{ height: 1, background: "#E8E8EE", margin: "0 20px" }} />
    </>
  );
}
function ModalFooter({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "12px 20px", borderTop: "1px solid #E8E8EE" }}>{children}</div>;
}

// ── Fee schedule table (shared by Assign + Edit modals) ────────────────────────
function FeeScheduleTable({ group, concession, onGroupChange, onConcessionChange, feeSchedules, concessions }: {
  group: string; concession: string;
  onGroupChange: (g: string) => void; onConcessionChange: (c: string) => void;
  feeSchedules: Record<string, any[]>; concessions: string[];
}) {
  const rows = feeSchedules[group] ?? [];
  const total = rows.reduce((s, r) => s + r.annual, 0);
  return (
    <div style={{ padding: "14px 20px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>FEE GROUP</div>
          <select value={group} onChange={e => onGroupChange(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 10px", fontSize: 12.5, background: "#fff", cursor: "pointer" }}>
            <option>Day Scholar</option><option>Transport Users</option><option>Full Boarder</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>CONCESSION</div>
          <select value={concession} onChange={e => onConcessionChange(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 10px", fontSize: 12.5, background: "#fff", cursor: "pointer" }}>
            {concessions.map(c => <option key={c}>{c}</option>)}
          </select>
        </div>
      </div>
      <div style={{ border: "1px solid #E8E8EE", borderRadius: 10, overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", background: "#F8F8FB", borderBottom: "1px solid #E8E8EE" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#181B2A", letterSpacing: "0.04em" }}>FEE SCHEDULE — {group.toUpperCase()}</div>
          <div style={{ fontSize: 10.5, color: "#A0A3B8" }}>Defined in Fee Configuration · read-only</div>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.4fr auto", padding: "8px 14px", background: "#FAFAFA", borderBottom: "1px solid #E8E8EE" }}>
          {["Fee Type", "Payment Schedule", "How it's paid", "Annual Total"].map(h => (
            <div key={h} style={{ fontSize: 10, fontWeight: 600, color: "#A0A3B8" }}>{h}</div>
          ))}
        </div>
        {rows.map((row: any, i: number) => {
          const b = SCHEDULE_BADGE[row.schedule as keyof typeof SCHEDULE_BADGE] || { bg: "#fff", color: "#000", border: "#ccc" };
          return (
            <div key={row.type} style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1.4fr auto", padding: "10px 14px", alignItems: "center", borderBottom: i < rows.length - 1 ? "1px solid #F0F0F0" : "none", background: "#fff" }}>
              <div style={{ fontSize: 12.5, color: "#181B2A" }}>{row.type}</div>
              <div><span style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 20, background: b.bg, color: b.color, border: `1px solid ${b.border}` }}>{row.schedule}</span></div>
              <div style={{ fontSize: 12, color: "#5B5E72" }}>{row.howPaid}</div>
              <div style={{ fontSize: 12.5, fontWeight: 600, color: "#181B2A", textAlign: "right", minWidth: 66 }}>{fmtInr(row.annual)}</div>
            </div>
          );
        })}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderTop: "2px solid #E8E8EE", background: "#F8F8FB" }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#181B2A" }}>Annual fees for this group</div>
          <div style={{ fontSize: 13.5, fontWeight: 700, color: "#181B2A" }}>{fmtInr(total)}</div>
        </div>
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 11.5, color: "#A0A3B8", lineHeight: 1.6, fontStyle: "italic" }}>
        Each fee type's payment schedule is set in Fee Configuration. To customise a schedule for this student, use the Enroll Student tab → Step 11.
      </p>
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function FeesAssignmentPanel() {
  const [students, setStudents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [groups, setGroups] = useState<any[]>([]);
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDynamicData = async () => {
    setLoading(true);
    try {
      const [stRes, clRes, asgnRes, grpRes, schRes] = await Promise.all([
        feesApi.listStudents(),
        feesApi.listClasses(),
        feesApi.listAssignments(),
        feesApi.listGroups(),
        feesApi.listSchedules()
      ]);
      setStudents(listData(stRes));
      setClasses(listData(clRes));
      setAssignments(listData(asgnRes));
      setGroups(listData(grpRes));
      setSchedules(listData(schRes));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDynamicData();
  }, []);

  const PAYMENT_PLANS = [
    { id: "2-term", label: "2-Term Plan", desc: "Two equal instalments per year" },
    { id: "3-term", label: "3-Term Plan", desc: "Three equal instalments per year" },
    { id: "4-term", label: "4-Term Plan", desc: "Four equal instalments per year" },
    { id: "monthly", label: "Monthly Plan", desc: "12 equal monthly payments" },
    { id: "custom", label: "Custom Plan", desc: "Admin-defined irregular schedule" },
  ];

  const FEE_SCHEDULES = useMemo(() => {
    const map: Record<string, FeeRow[]> = {};
    groups.forEach(g => {
      const gScheds = schedules.filter(s => s.fee_group === g.id);
      map[g.name] = gScheds.map(s => ({
        type: typeof s.fee_type === "object" && s.fee_type !== null ? s.fee_type.name : "Fee",
        schedule: s.collection_frequency || "Term-wise",
        howPaid: "From config",
        annual: parseFloat(s.amount || "0")
      }));
    });
    return map;
  }, [groups, schedules]);

  const ANNUAL_FEE = useMemo(() => {
    const map: Record<string, number | null> = { Unassigned: null };
    groups.forEach(g => {
      map[g.name] = (FEE_SCHEDULES[g.name] || []).reduce((s, r) => s + r.annual, 0);
    });
    return map;
  }, [FEE_SCHEDULES, groups]);

  const CONCESSIONS = ["None", "Staff Ward 50%", "Merit 25%", "Need-Based Full", "Sibling 10%"];

  const CLASS_DATA = useMemo(() => {
    const classMap = new Map<string, ClassSection>();
    classes.forEach(c => classMap.set(c.id.toString(), { id: c.id.toString(), name: c.name, students: [] }));

    students.forEach(st => {
      const clsId = st.current_class?.toString() || "unassigned";
      if (!classMap.has(clsId)) {
        classMap.set(clsId, { id: clsId, name: st.current_class_name || "Unassigned", students: [] });
      }

      const stAsgns = assignments.filter(a => a.student === st.id);
      const isAssigned = stAsgns.length > 0;
      let cat = "Unassigned";
      if (isAssigned) {
        const asgn = stAsgns[0];
        const sched = schedules.find(s => s.fee_type === asgn.fees_type || (s.fee_type && s.fee_type.id === asgn.fees_type));
        if (sched) {
          const grp = groups.find(g => g.id === sched.fee_group);
          if (grp) cat = grp.name;
        } else {
          cat = "Assigned";
        }
      }

      classMap.get(clsId)!.students.push({
        id: st.id.toString(),
        name: `${st.first_name || ""} ${st.last_name || ""}`.trim(),
        admNo: st.admission_no || `ID-${st.id}`,
        category: cat as any,
        planAgreed: isAssigned
      });
    });
    return Array.from(classMap.values());
  }, [classes, students, assignments, groups, schedules]);

  const TOTAL_STUDENTS = CLASS_DATA.reduce((s, c) => s + c.students.length, 0);

  // Filters
  const [search, setSearch] = useState("");
  const [yearFilter, setYearFilter] = useState("2025-26");
  const [classFilter, setClassFilter] = useState("all");
  const [groupFilter, setGroupFilter] = useState("all");
  const [tab, setTab] = useState<FilterTab>("all");
  const [expanded, setExpanded] = useState<Set<string>>(new Set(["6a"]));
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState("");

  // Session assignments (tracks UI-level changes)
  const [overrides, setOverrides] = useState<Record<string, Override>>({});

  // Assign / Edit modal
  const [assignModal, setAssignModal] = useState<{ student: Student; clsName: string; isEdit: boolean } | null>(null);
  const [modalGroup, setModalGroup] = useState("Day Scholar");
  const [modalConcession, setModalConcession] = useState("None");

  // Change Plan modal
  const [changePlanModal, setChangePlanModal] = useState<{ student: Student } | null>(null);
  const [selectedPlan, setSelectedPlan] = useState("3-term");
  const [planReason, setPlanReason] = useState("");

  // Bulk Assign modal
  const [bulkModal, setBulkModal] = useState<{ clsId: string; clsName: string } | null>(null);
  const [bulkClass, setBulkClass] = useState("all");
  const [bulkGroup, setBulkGroup] = useState("Day Scholar");

  // Info modal
  const [showInfoModal, setShowInfoModal] = useState(false);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(""), 3000); };

  // Helper — effective category for a student (accounts for session overrides)
  const effectiveCat = (st: Student): string => overrides[st.id]?.group ?? (st.category === "Unassigned" ? "Unassigned" : st.category);
  const isAssigned = (st: Student): boolean => overrides[st.id] !== undefined || st.category !== "Unassigned";

  // Dynamic stats
  const stats = useMemo(() => {
    let asgn = 0;
    for (const cls of CLASS_DATA) for (const st of cls.students) if (isAssigned(st)) asgn++;
    return { assigned: asgn, unassigned: TOTAL_STUDENTS - asgn, total: TOTAL_STUDENTS };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [overrides]);

  // Filtered class list
  const filteredClasses = useMemo(() => {
    const q = search.toLowerCase();
    return CLASS_DATA
      .filter(cls => classFilter === "all" || cls.id === classFilter)
      .map(cls => ({
        ...cls,
        students: cls.students.filter(st => {
          const eCat = effectiveCat(st);
          const asgnd = isAssigned(st);
          const mSearch = !q || st.name.toLowerCase().includes(q) || st.admNo.toLowerCase().includes(q);
          const mTab = tab === "all" || (tab === "unassigned" ? !asgnd : asgnd);
          const mGroup = groupFilter === "all" || eCat === groupFilter;
          return mSearch && mTab && mGroup;
        }),
      }))
      .filter(cls => cls.students.length > 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, classFilter, groupFilter, tab, overrides]);

  // Actions
  const openAssignModal = (st: Student, clsName: string) => { setAssignModal({ student: st, clsName, isEdit: false }); setModalGroup("Day Scholar"); setModalConcession("None"); };
  const openEditModal = (st: Student, clsName: string) => { setAssignModal({ student: st, clsName, isEdit: true }); setModalGroup((overrides[st.id]?.group ?? st.category) as string); setModalConcession("None"); };
  const openChangePlan = (st: Student) => { setChangePlanModal({ student: st }); setSelectedPlan("3-term"); setPlanReason(""); };
  const openBulkModal = (clsId: string, clsName: string) => { setBulkModal({ clsId, clsName }); setBulkClass(clsId); setBulkGroup("Day Scholar"); };

  const confirmAssign = () => {
    if (!assignModal) return;
    const rows = FEE_SCHEDULES[modalGroup] ?? [];
    const total = rows.reduce((s, r) => s + r.annual, 0);
    setOverrides(prev => ({ ...prev, [assignModal.student.id]: { group: modalGroup, annual: total } }));
    setAssignModal(null);
    showToast(`${assignModal.isEdit ? "Assignment updated" : "Fees assigned"} for ${assignModal.student.name} — ${modalGroup}.`);
  };

  const confirmPlanSwitch = () => {
    if (!changePlanModal) return;
    const plan = PAYMENT_PLANS.find(p => p.id === selectedPlan);
    setChangePlanModal(null);
    showToast(`Payment plan switched to ${plan?.label} for ${changePlanModal.student.name}.`);
  };

  const confirmBulkAssign = () => {
    const targetIds = bulkClass === "all" ? CLASS_DATA.map(c => c.id) : [bulkClass];
    const rows = FEE_SCHEDULES[bulkGroup] ?? [];
    const total = rows.reduce((s, r) => s + r.annual, 0);
    const newOv: Record<string, Override> = {};
    for (const cls of CLASS_DATA) {
      if (!targetIds.includes(cls.id)) continue;
      for (const st of cls.students) if (!isAssigned(st)) newOv[st.id] = { group: bulkGroup, annual: total };
    }
    setOverrides(prev => ({ ...prev, ...newOv }));
    setBulkModal(null);
    showToast(`Bulk assigned ${Object.keys(newOv).length} students to ${bulkGroup}.`);
  };

  const toggleExpand = (id: string) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelect = (id: string) => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleSelectAll = (students: Student[], all: boolean) => setSelected(prev => { const n = new Set(prev); students.forEach(s => all ? n.delete(s.id) : n.add(s.id)); return n; });

  const TABS = [
    { key: "all" as FilterTab, label: `All ${stats.total}` },
    { key: "unassigned" as FilterTab, label: `Unassigned ${stats.unassigned}` },
    { key: "assigned" as FilterTab, label: `Assigned ${stats.assigned}` },
  ];


  return (
    <>
      <style>{`
        @keyframes fadeIn  { from{opacity:0;transform:translateY(-4px)} to{opacity:1;transform:translateY(0)} }
        @keyframes toastUp { from{opacity:0;transform:translateY(8px)}  to{opacity:1;transform:translateY(0)} }
        @keyframes modalIn { from{opacity:0;transform:scale(0.96)}       to{opacity:1;transform:scale(1)}     }
        .fa-row:hover { background:#FAFAFF !important; }
      `}</style>

      {/* ── Page header ─────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.09em", color: "#6D4AFF", marginBottom: 6, textTransform: "uppercase" }}>Student Fee Mapping</div>
          <h1 style={{ margin: "0 0 8px", fontSize: 32, fontWeight: 700, color: "#181B2A", lineHeight: 1.1 }}>Fee Assignment</h1>
          <p style={{ margin: 0, fontSize: 14, color: "#A0A3B8" }}>Assign fee structures to students class by class, with concession and override support.</p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 8 }}>
          <button
            onClick={() => setShowInfoModal(true)}
            style={{ width: 34, height: 34, borderRadius: "50%", border: "1.5px solid #E8E8EE", background: "#fff", color: "#6D4AFF", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 14, fontWeight: 700 }}
          >i</button>
          <button style={primaryBtn()} onClick={() => openBulkModal("all", "All Classes")}>+ Bulk Assign</button>
        </div>
      </div>

      {/* ── Stats bar ────────────────────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 20px", background: "#fff", border: "1px solid #E8E8EE", borderRadius: "10px 10px 0 0", borderBottom: "none" }}>
        <div style={{ fontSize: 13.5, color: "#5B5E72" }}>
          <span style={{ fontWeight: 700, color: "#181B2A" }}>{stats.assigned}</span>{" assigned · "}
          <span style={{ fontWeight: 700, color: "#F59E0B" }}>{stats.unassigned}</span>{" unassigned · "}
          <span style={{ fontWeight: 700, color: "#181B2A" }}>{stats.total}</span>{" total students"}
        </div>
        <button style={{ ...outlineBtn(true), fontSize: 13, color: "#6D4AFF", borderColor: "#c4b5fd" }} onClick={() => openBulkModal("all", "All Classes")}>
          Assign all unassigned →
        </button>
      </div>
      <div style={{ height: 3, background: "linear-gradient(90deg,#F59E0B,#FCD34D 50%,#FEF3C7)" }} />

      {/* ── Filters ──────────────────────────────────────────────────── */}
      <div style={{ background: "#fff", border: "1px solid #E8E8EE", borderTop: "none", borderRadius: "0 0 10px 10px", padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-end" }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 7 }}>SEARCH</div>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 15, pointerEvents: "none" }}>🔍</span>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Name or admission number..."
              style={{ width: "100%", height: 40, border: "1px solid #E8E8EE", borderRadius: 9, paddingLeft: 38, paddingRight: 12, fontSize: 13.5, boxSizing: "border-box" }} />
          </div>
        </div>
        {[
          { label: "YEAR", value: yearFilter, set: setYearFilter, w: 120, opts: <><option>2025-26</option><option>2024-25</option></> },
          { label: "CLASS", value: classFilter, set: setClassFilter, w: 150, opts: <><option value="all">All Classes</option>{CLASS_DATA.map(c => <option key={c.id} value={c.id}>{c.name.replace("Class ", "")}</option>)}</> },
          { label: "FEE GROUP", value: groupFilter, set: setGroupFilter, w: 160, opts: <><option value="all">All Groups</option><option value="Day Scholar">Day Scholar</option><option value="Transport Users">Transport Users</option><option value="Full Boarder">Full Boarder</option></> },
        ].map(f => (
          <div key={f.label} style={{ minWidth: f.w }}>
            <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 7 }}>{f.label}</div>
            <select value={f.value} onChange={e => f.set(e.target.value)} style={{ height: 40, border: "1px solid #E8E8EE", borderRadius: 9, padding: "0 12px", fontSize: 13.5, background: "#fff", cursor: "pointer", width: "100%" }}>
              {f.opts}
            </select>
          </div>
        ))}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, margin: "16px 0" }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{ height: 36, padding: "0 18px", border: tab === t.key ? "none" : "1px solid #E8E8EE", borderRadius: 20, background: tab === t.key ? "#6D4AFF" : "#fff", color: tab === t.key ? "#fff" : "#5B5E72", fontSize: 13, fontWeight: 600, cursor: "pointer", boxShadow: tab === t.key ? "0 2px 8px rgba(109,74,255,0.22)" : "none", transition: "all 0.15s" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Class sections ───────────────────────────────────────────── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {filteredClasses.map(cls => {
          const origCls = CLASS_DATA.find(c => c.id === cls.id)!;
          const totalCls = origCls.students.length;
          const asgndCls = origCls.students.filter(s => isAssigned(s)).length;
          const isExpanded = expanded.has(cls.id);
          const allSel = cls.students.length > 0 && cls.students.every(s => selected.has(s.id));

          return (
            <div key={cls.id} style={{ background: "#fff", border: "1px solid #E8E8EE", borderRadius: 12, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", padding: "16px 20px", gap: 14 }}>
                <div style={{ width: 4, height: 44, borderRadius: 2, background: "#6D4AFF", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "#181B2A", marginBottom: 3 }}>{cls.name}</div>
                  <div style={{ fontSize: 12.5, color: "#A0A3B8" }}>{totalCls} students · {asgndCls} assigned · {totalCls - asgndCls} unassigned</div>
                </div>
                <button style={outlineBtn(true)} onClick={() => openBulkModal(cls.id, cls.name)}>Bulk Assign</button>
                <button onClick={() => toggleExpand(cls.id)} style={{ height: 32, padding: "0 14px", border: "1px solid #E8E8EE", borderRadius: 7, background: "#fff", color: "#5B5E72", fontSize: 12.5, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}>
                  {cls.students.length} shown
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transform: isExpanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}><polyline points="6 9 12 15 18 9" /></svg>
                </button>
              </div>

              {isExpanded && (
                <div style={{ borderTop: "1px solid #E8E8EE", animation: "fadeIn 0.15s ease" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr style={{ background: "#F8F8FB" }}>
                        <th style={{ ...TH, width: 44 }}><input type="checkbox" checked={allSel} onChange={() => toggleSelectAll(cls.students, allSel)} /></th>
                        <th style={TH}>STUDENT</th>
                        <th style={TH}><span style={{ display: "inline-flex", alignItems: "center" }}>PAYMENT SCHEDULES<InfoDot /></span></th>
                        <th style={TH}><span style={{ display: "inline-flex", alignItems: "center" }}>ANNUAL TOTAL<InfoDot /></span></th>
                        <th style={TH}><span style={{ display: "inline-flex", alignItems: "center" }}>AGREED PLAN<InfoDot /></span></th>
                        <th style={TH}>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cls.students.map((st, ri) => {
                        const ov = overrides[st.id];
                        const asgnd = isAssigned(st);
                        const eCat = effectiveCat(st);
                        const annual = ov ? ov.annual : ANNUAL_FEE[st.category as Category];
                        const isSel = selected.has(st.id);
                        return (
                          <tr key={st.id} className="fa-row" style={{ borderBottom: ri < cls.students.length - 1 ? "1px solid #E8E8EE" : "none", background: isSel ? "#F5F3FF" : "#fff" }}>
                            <td style={{ padding: "14px 16px", width: 44 }}><input type="checkbox" checked={isSel} onChange={() => toggleSelect(st.id)} /></td>
                            <td style={{ padding: "14px 16px" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: avatarBg(st.name), color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12.5, fontWeight: 700 }}>{initials(st.name)}</div>
                                <div>
                                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "#181B2A" }}>{st.name}</div>
                                  <div style={{ fontSize: 12, color: "#A0A3B8", marginTop: 2 }}>{st.admNo} · <span style={{ color: !asgnd ? "#F59E0B" : "#5B5E72" }}>{eCat}</span></div>
                                </div>
                              </div>
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              {!asgnd ? <span style={{ color: "#A0A3B8", fontSize: 15 }}>—</span>
                                : <span style={{ fontSize: 12.5, fontWeight: 500, padding: "4px 12px", borderRadius: 20, background: "#F0F0F8", color: "#181B2A", border: "1px solid #E0E0F0" }}>Group schedule</span>}
                            </td>
                            <td style={{ padding: "14px 16px", fontSize: 13.5, fontWeight: annual ? 600 : 400, color: annual ? "#181B2A" : "#A0A3B8" }}>
                              {annual ? fmtRs(annual) : "—"}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              {st.planAgreed || ov ? (
                                <span style={{ fontSize: 12.5, fontWeight: 600, padding: "4px 12px", borderRadius: 20, background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }}>✓ Plan Agreed</span>
                              ) : (
                                <span style={{ fontSize: 12.5, fontWeight: 500, padding: "4px 12px", borderRadius: 20, background: "#F3F4F6", color: "#6B7280" }}>No plan yet</span>
                              )}
                            </td>
                            <td style={{ padding: "14px 16px" }}>
                              {!asgnd ? (
                                <button style={primaryBtn(true)} onClick={() => openAssignModal(st, cls.name)}>Assign →</button>
                              ) : (
                                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                  <button style={outlineBtn(true)} onClick={() => openEditModal(st, cls.name)}>Edit Assignment</button>
                                  <button style={outlineBtn(true)} onClick={() => openChangePlan(st)}>Change Plan</button>
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
        {filteredClasses.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#A0A3B8", fontSize: 14 }}>No students match the current filters.</div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL 1 — Assign Fees / Edit Assignment                        */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {assignModal && (
        <ModalShell onClose={() => setAssignModal(null)}>
          <ModalHeader
            title={assignModal.isEdit ? "Edit Assignment" : "Assign Fees"}
            subtitle={`${assignModal.student.name} · ${assignModal.student.admNo} · ${assignModal.clsName}`}
            onClose={() => setAssignModal(null)}
          />
          <FeeScheduleTable
            group={modalGroup} concession={modalConcession}
            onGroupChange={setModalGroup} onConcessionChange={setModalConcession}
            feeSchedules={FEE_SCHEDULES} concessions={CONCESSIONS}
          />
          <ModalFooter>
            <button style={{ ...outlineBtn(), minWidth: 90 }} onClick={() => setAssignModal(null)}>Cancel</button>
            <button style={{ ...primaryBtn(), minWidth: 130 }} onClick={confirmAssign}>
              {assignModal.isEdit ? "Save Changes" : "Assign Fees"}
            </button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL 2 — Change Payment Plan                                   */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {changePlanModal && (
        <ModalShell onClose={() => setChangePlanModal(null)}>
          <ModalHeader
            title="Change Payment Plan"
            subtitle={`${changePlanModal.student.name} · current: 3-Term Plan`}
            onClose={() => setChangePlanModal(null)}
          />
          <div style={{ padding: "14px 20px" }}>
            <p style={{ margin: "0 0 16px", fontSize: 12.5, color: "#5B5E72", lineHeight: 1.6 }}>
              Switching plans takes effect from the next due date. A plan-change record is logged automatically.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 2, marginBottom: 18 }}>
              {PAYMENT_PLANS.map((plan, i) => {
                const isChosen = selectedPlan === plan.id;
                const isCurrent = plan.id === "3-term";
                return (
                  <label key={plan.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", border: "1px solid", borderColor: isChosen ? "#6D4AFF" : "#E8E8EE", borderRadius: 9, cursor: "pointer", background: isChosen ? "#F5F3FF" : "#fff", marginBottom: i < PAYMENT_PLANS.length - 1 ? 6 : 0 }}>
                    <input type="radio" name="plan" checked={isChosen} onChange={() => setSelectedPlan(plan.id)} style={{ accentColor: "#6D4AFF", width: 15, height: 15, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#181B2A" }}>{plan.label}</span>
                        {isCurrent && <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: "#dcfce7", color: "#15803d", border: "1px solid #86efac" }}>Current</span>}
                      </div>
                      <div style={{ fontSize: 12, color: "#A0A3B8" }}>{plan.desc}</div>
                    </div>
                  </label>
                );
              })}
            </div>
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", color: "#A0A3B8", marginBottom: 6 }}>REASON FOR CHANGE</div>
              <textarea
                value={planReason} onChange={e => setPlanReason(e.target.value)}
                placeholder="e.g. Parent requested monthly billing from June 2026"
                style={{ width: "100%", minHeight: 70, border: "1px solid #E8E8EE", borderRadius: 8, padding: "10px 12px", fontSize: 12.5, resize: "vertical", boxSizing: "border-box", fontFamily: "inherit" }}
              />
            </div>
          </div>
          <ModalFooter>
            <button style={{ ...outlineBtn(), minWidth: 90 }} onClick={() => setChangePlanModal(null)}>Cancel</button>
            <button style={{ ...primaryBtn(), minWidth: 160 }} onClick={confirmPlanSwitch}>Confirm Plan Switch</button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL 3 & 4 — Bulk Assign Fees                                  */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {bulkModal && (
        <ModalShell onClose={() => setBulkModal(null)} maxWidth={600}>
          <ModalHeader
            title="Bulk Assign Fees"
            subtitle={`Assign a fee group to all unassigned students in ${bulkClass === "all" ? "All Classes" : CLASS_DATA.find(c => c.id === bulkClass)?.name ?? bulkClass}.`}
            onClose={() => setBulkModal(null)}
          />
          <div style={{ padding: "14px 20px" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>CLASS</div>
                <select value={bulkClass} onChange={e => setBulkClass(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 10px", fontSize: 12.5, background: "#fff", cursor: "pointer" }}>
                  <option value="all">All Classes</option>
                  {CLASS_DATA.map(c => <option key={c.id} value={c.id}>{c.name.replace("Class ", "")}</option>)}
                </select>
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", color: "#A0A3B8", marginBottom: 6 }}>FEE GROUP</div>
                <select value={bulkGroup} onChange={e => setBulkGroup(e.target.value)} style={{ width: "100%", height: 36, border: "1px solid #E8E8EE", borderRadius: 8, padding: "0 10px", fontSize: 12.5, background: "#fff", cursor: "pointer" }}>
                  <option>Day Scholar</option><option>Transport Users</option><option>Full Boarder</option>
                </select>
              </div>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#5B5E72" }}>Applies to unassigned rows only. A plan-history entry is created for each student assigned.</p>
          </div>
          <ModalFooter>
            <button style={{ ...outlineBtn(), minWidth: 90 }} onClick={() => setBulkModal(null)}>Cancel</button>
            <button style={{ ...primaryBtn(), minWidth: 160 }} onClick={confirmBulkAssign}>Assign to Unassigned</button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* MODAL 5 — How Fee Assignment works (Info)                       */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      {showInfoModal && (
        <ModalShell onClose={() => setShowInfoModal(false)} maxWidth={620}>
          <ModalHeader title="How Fee Assignment works" subtitle="A quick guide to assigning fees to students" onClose={() => setShowInfoModal(false)} />
          <div style={{ padding: "14px 20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {INFO_STEPS.map(step => (
                <div key={step.n} style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "10px 14px", border: "1px solid #E8E8EE", borderRadius: 9 }}>
                  <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#6D4AFF", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, flexShrink: 0 }}>{step.n}</div>
                  <div style={{ paddingTop: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#181B2A" }}>{step.title}</span>
                    <span style={{ fontSize: 13, color: "#5B5E72" }}> — {step.body}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ padding: "12px 14px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 9 }}>
              <span style={{ fontSize: 12.5, color: "#92400E", lineHeight: 1.6 }}>
                💡 <strong>Tip:</strong> For custom fee arrangements agreed with parents, use the <em>Enroll Student</em> tab (Step 11) to build a documented fee plan first, then assign here.
              </span>
            </div>
          </div>
          <ModalFooter>
            <button style={{ ...primaryBtn(), minWidth: 90 }} onClick={() => setShowInfoModal(false)}>Got it</button>
          </ModalFooter>
        </ModalShell>
      )}

      {/* Toast */}
      {toast && (
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "#1e293b", color: "#fff", padding: "12px 20px", borderRadius: 10, fontSize: 13.5, fontWeight: 500, lineHeight: 1.4, boxShadow: "0 8px 28px rgba(0,0,0,0.22)", zIndex: 9999, maxWidth: 420, animation: "toastUp 0.2s ease" }}>
          {toast}
        </div>
      )}
    </>
  );
}
