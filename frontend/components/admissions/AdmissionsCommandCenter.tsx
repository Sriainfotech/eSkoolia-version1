"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import {
  Zap,
  Calendar,
  SlidersHorizontal,
  Search,
  Phone,
  PhoneCall,
  Clock,
  Plus,
  X,
  AlertCircle,
  BarChart2,
  RefreshCw,
  TrendingUp,
  Sparkles,
  Copy,
  CheckCircle2,
  MessageSquare,
  Send,
  Users,
  FileCheck,
} from "lucide-react";
import { apiRequestWithRefresh } from "@/lib/api-auth";

/* ─────────────────────────────── types ─────────────────────────────── */
type ApiList<T> = T[] | { results?: T[] };

type Inquiry = {
  id: number;
  full_name: string;
  phone: string;
  email: string;
  address: string;
  description: string;
  query_date: string | null;
  follow_up_date: string | null;
  next_follow_up_date: string | null;
  assigned: string;
  reference: number | null;
  reference_name?: string;
  source: number | null;
  source_name?: string;
  school_class: number | null;
  class_name_resolved?: string;
  no_of_child: number;
  active_status: number;
  status: string;
  note: string;
  lead_score?: number;
  documents_status?: string;
  last_contacted_at?: string;
};

type AdminSetup = { id: number; type: string; name: string };
type SchoolClass = { id: number; name: string };
type BulkJobPayload = { action: string; lead_ids: number[]; payload: Record<string, string> };

type DrawerForm = {
  full_name: string;
  phone: string;
  email: string;
  school_class: string;
  no_of_child: string;
  source: string;
  reference: string;
  query_date: string;
  next_follow_up_date: string;
  assigned: string;
  description: string;
  active_status: "1" | "2";
  note: string;
  child_name: string;
  child_dob: string;
  child_gender: string;
  parent_occupation: string;
  previous_school: string;
  reason_for_change: string;
  budget_range: string;
  preferred_contact_time: string;
  sibling_count: string;
  specific_requirements: string;
  relationship: string;
  alternate_phone: string;
  home_area: string;
  has_sibling_enrolled: string;
  sibling_name: string;
  sibling_class_name: string;
  referred_by: string;
  preferred_visit_date: string;
  preferred_visit_time: string;
};

type LogForm = {
  outcome: string;
  note: string;
  next_follow_up_date: string;
  status: string;
};

/* ─── outcome options for Log modal ─── */
const OUTCOMES = [
  { value: "called_interested", label: "📞 Called – Interested" },
  { value: "called_no_answer", label: "📵 Called – No Answer" },
  { value: "called_callback", label: "🔁 Called – Callback Requested" },
  { value: "called_not_interested", label: "❌ Called – Not Interested" },
  { value: "whatsapp_sent", label: "💬 WhatsApp Sent" },
  { value: "visit_scheduled", label: "📅 Campus Visit Scheduled" },
  { value: "visit_done", label: "🏫 Campus Visit Done" },
  { value: "documents_collected", label: "📋 Documents Collected" },
  { value: "enrolled", label: "🎉 Enrolled" },
];

const STATUS_CHOICES = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "visited", label: "Visited" },
  { value: "enrolled", label: "Enrolled" },
  { value: "declined", label: "Declined" },
];

const BROADCAST_TEMPLATES = {
  followup: "Hi {{name}}! 👋 Just following up on your inquiry about admission. We'd love to help you — when would be a good time to talk? — Admissions Team",
  visit: "Hi {{name}}! 🏫 We'd like to invite you for a campus visit. Please reply with your preferred date and we'll arrange everything. — Admissions Team",
  urgency: "Hi {{name}}! ⚠️ We have limited seats available for your chosen grade. Please confirm your interest soon to avoid missing out! — Admissions Team",
};

const REQUIRED_DOCS = [
  { key: "birth_cert", label: "Birth Certificate" },
  { key: "tc", label: "Transfer Certificate (TC)" },
  { key: "aadhar", label: "Aadhar Card Copy" },
  { key: "photos", label: "Passport Photos (4 copies)" },
  { key: "report_card", label: "Previous Report Card" },
  { key: "address_proof", label: "Address Proof" },
];

/* ─────────────────────────────── helpers ─────────────────────────────── */
function listData<T>(value: ApiList<T> | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : value.results ?? [];
}

function formatDate(value?: string | null) {
  if (!value) return "–";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function initialDrawerForm(today: string): DrawerForm {
  const tomorrow = new Date(new Date(today + "T00:00:00").getTime() + 864e5).toISOString().slice(0, 10);
  return {
    full_name: "",
    phone: "",
    email: "",
    school_class: "",
    no_of_child: "1",
    source: "",
    reference: "",
    query_date: today,
    next_follow_up_date: today,
    assigned: "",
    description: "",
    active_status: "1",
    note: "",
    child_name: "",
    child_dob: "",
    child_gender: "",
    parent_occupation: "",
    previous_school: "",
    reason_for_change: "",
    budget_range: "",
    preferred_contact_time: "",
    sibling_count: "0",
    specific_requirements: "",
    relationship: "",
    alternate_phone: "",
    home_area: "",
    has_sibling_enrolled: "",
    sibling_name: "",
    sibling_class_name: "",
    referred_by: "",
    preferred_visit_date: tomorrow,
    preferred_visit_time: "",
  };
}

function generateCallScript(inq: Inquiry): { tip: string; type: "goal" | "question" | "objection" | "insight" }[] {
  const grade = inq.class_name_resolved || "the grade";
  const tips: { tip: string; type: "goal" | "question" | "objection" | "insight" }[] = [
    { tip: `🎯 Primary goal: Schedule a campus visit within 48 hours for ${grade}`, type: "goal" },
  ];
  if (!inq.follow_up_date || inq.status === "new") {
    tips.push({ tip: `👋 Start warm: "Hello! Calling from [School] regarding ${grade} admission. Good time to talk?"`, type: "insight" });
    tips.push({ tip: `❓ Ask: "What made you consider our school for your child?"`, type: "question" });
    tips.push({ tip: `❓ Ask: "Tell me about your child – interests, strengths, any special needs?"`, type: "question" });
  } else if (inq.status === "contacted") {
    tips.push({ tip: `🔄 Reference previous conversation. Show continuity and interest.`, type: "insight" });
    tips.push({ tip: `⚡ Mention seat availability urgency for the upcoming academic year`, type: "insight" });
    tips.push({ tip: `❓ Ask: "What's holding you back from scheduling a campus visit?"`, type: "question" });
  } else if (inq.status === "visited") {
    tips.push({ tip: `🏫 Post-visit: "How did you find the campus? Any questions on fees or curriculum?"`, type: "insight" });
    tips.push({ tip: `🎯 Offer a Principal/Academic Head meeting to push for decision`, type: "goal" });
  }
  tips.push({ tip: `💡 If fees concern: "We have flexible payment plans and scholarship programs."`, type: "objection" });
  tips.push({ tip: `💡 If distance concern: "We have transport routes covering most areas."`, type: "objection" });
  tips.push({ tip: `💡 If comparing schools: "Our key differentiator is holistic development + modern infra."`, type: "objection" });
  return tips;
}

function generateWhatsAppMessages(inq: Inquiry): string[] {
  const firstName = inq.full_name.split(" ")[0] || "there";
  const grade = inq.class_name_resolved ? `Grade ${inq.class_name_resolved}` : "your child's grade";
  return [
    `Hello ${firstName}! 👋\n\nThank you for your inquiry about admission for ${grade}.\n\nWe'd love to give you a personal campus tour and answer all your questions.\n\n📅 Would you like to schedule a visit this week? Please let us know your preferred time!\n\nWarm regards,\nAdmissions Team`,
    `Hi ${firstName}! 😊\n\nFriendly reminder about your admission inquiry for ${grade}.\n\nWe still have seats available for the upcoming academic year. Admissions are on a first-come basis!\n\n🗓️ Book a campus visit today. Reply with a convenient time.\n\nBest wishes,\nAdmissions Team`,
    `Dear ${firstName},\n\nGreat speaking with you about ${grade} admission! 🌟\n\nWe offer:\n✅ Experienced faculty & modern infrastructure\n✅ Holistic development programs\n✅ Safe & supportive environment\n\nFeel free to call us anytime for queries!\n\nAdmissions Team`,
  ];
}

function getProgress(inq: Inquiry): { filled: number; label: string } {
  if (inq.status === "enrolled") return { filled: 4, label: "Enrolled" };
  if (inq.status === "visited") return { filled: 3, label: "Visited" };
  if (inq.status === "contacted" || inq.follow_up_date) return { filled: 2, label: "Contacted" };
  return { filled: 1, label: "Inquiry Received" };
}

function getSignal(inq: Inquiry, today: string): "hot" | "new" | "stale" | null {
  if (inq.next_follow_up_date && inq.next_follow_up_date < today && inq.follow_up_date) return "hot";
  const threeDaysAgo = new Date(Date.now() - 3 * 864e5).toISOString().slice(0, 10);
  if (inq.query_date && inq.query_date >= threeDaysAgo) return "new";
  const sevenDaysAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  if (!inq.follow_up_date && inq.query_date && inq.query_date < sevenDaysAgo) return "stale";
  return null;
}

function getSentimentBadge(inq: Inquiry, today: string) {
  if (!inq.next_follow_up_date) return { label: "No Follow-up", color: "#64748b", bg: "#f1f5f9" };
  if (inq.next_follow_up_date < today) return { label: "Overdue", color: "#b91c1c", bg: "#fef2f2" };
  if (inq.next_follow_up_date === today) return { label: "Due Today", color: "#b45309", bg: "#fffbeb" };
  return { label: "Scheduled", color: "#0369a1", bg: "#eff6ff" };
}

/* ─────────────────────────────── AI tip generator ─────────────────────────────── */
function generateAITip(
  form: DrawerForm,
  sources: AdminSetup[],
  classes: SchoolClass[]
): { headline: string; insight: string; suggestedMsg: string; actions: string[] } {
  const sourceName = sources.find((s) => String(s.id) === form.source)?.name || "";
  const gradeName = classes.find((c) => String(c.id) === form.school_class)?.name || "";
  const parentFirst = form.full_name.split(" ")[0] || "there";

  let headline = "📊 AI Insight";
  let insight = "Follow up within 24 hours for best conversion rates.";

  if (sourceName.toLowerCase().includes("instagram") || sourceName.toLowerCase().includes("facebook")) {
    headline = "📱 Social Media Lead";
    insight = `Social media leads like ${parentFirst} convert best when contacted within 2 hours. Send a WhatsApp first, then call.`;
  } else if (sourceName.toLowerCase().includes("word") || sourceName.toLowerCase().includes("mouth")) {
    headline = "🤝 Referral Lead — High Intent";
    insight = `${parentFirst} was referred by someone who knows your school. Referral leads convert at 2–3× the rate. Call within 1 hour!`;
  } else if (sourceName.toLowerCase().includes("google")) {
    headline = "🔍 Google Search Lead";
    insight = `${parentFirst} was actively searching — high intent. Respond within 30 minutes for best results.`;
  }

  if (gradeName) insight += ` Grade ${gradeName} has been popular this season.`;

  const visitDate = form.preferred_visit_date ? `on ${form.preferred_visit_date}` : "this week";
  const suggestedMsg = `Hi ${parentFirst}! 👋 Thank you for your interest. We'd love to show you around — can you visit ${visitDate}? We have limited seats for ${gradeName || "the grade"}. — Admissions Team`;

  return { headline, insight, suggestedMsg, actions: ["Send WhatsApp", "Dismiss"] };
}

/* ─────────────────────────────── CSS vars ─────────────────────────────── */
const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid var(--line, #e5e7eb)",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 1px 3px rgba(0,0,0,.07)",
};

const inp = (err = false): React.CSSProperties => ({
  width: "100%",
  height: 36,
  border: `1px solid ${err ? "#dc2626" : "var(--line, #e5e7eb)"}`,
  borderRadius: 8,
  padding: "0 10px",
  fontSize: 13,
  fontFamily: "inherit",
  boxSizing: "border-box",
});

const btnPrimary: React.CSSProperties = {
  height: 36,
  background: "var(--primary, #1d4ed8)",
  border: "1px solid var(--primary, #1d4ed8)",
  color: "#fff",
  borderRadius: 8,
  padding: "0 14px",
  cursor: "pointer",
  fontSize: 13,
  fontWeight: 600,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const btnGhost: React.CSSProperties = {
  height: 36,
  background: "transparent",
  border: "1px solid var(--line, #e5e7eb)",
  color: "var(--text, #111)",
  borderRadius: 8,
  padding: "0 12px",
  cursor: "pointer",
  fontSize: 13,
  display: "flex",
  alignItems: "center",
  gap: 6,
};

const overlay: React.CSSProperties = {
  position: "fixed",
  inset: 0,
  zIndex: 300,
  background: "rgba(0,0,0,.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "16px",
};

/* ─────────────────────────────── component ─────────────────────────────── */
export function AdmissionsCommandCenter() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth();
  const pipelineRef = useRef<HTMLDivElement>(null);

  /* ── data ── */
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sources, setSources] = useState<AdminSetup[]>([]);
  const [references, setReferences] = useState<AdminSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  /* ── pipeline filter state ── */
  const [activeTab, setActiveTab] = useState<"all" | "followup" | "recent">("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [filterClass, setFilterClass] = useState("");
  const [filterSource, setFilterSource] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterAssigned, setFilterAssigned] = useState("");
  const [filterDate, setFilterDate] = useState("");

  /* ── new admission modal ── */
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [admissionSection, setAdmissionSection] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drawerForm, setDrawerForm] = useState<DrawerForm>(initialDrawerForm(today));
  const [drawerErrors, setDrawerErrors] = useState<Record<string, string>>({});
  const [drawerSaving, setDrawerSaving] = useState(false);

  /* ── log update modal ── */
  const [showLogModal, setShowLogModal] = useState(false);
  const [logInquiry, setLogInquiry] = useState<Inquiry | null>(null);
  const [logForm, setLogForm] = useState<LogForm>({ outcome: "", note: "", next_follow_up_date: "", status: "" });
  const [logSaving, setLogSaving] = useState(false);

  /* ── call flow modal ── */
  const [showCallModal, setShowCallModal] = useState(false);
  const [callInquiry, setCallInquiry] = useState<Inquiry | null>(null);
  const [callStep, setCallStep] = useState<"contact" | "coaching" | "converted">("contact");
  const [callTips, setCallTips] = useState<{ tip: string; type: "goal" | "question" | "objection" | "insight" }[]>([]);

  /* ── whatsapp modal ── */
  const [showWAModal, setShowWAModal] = useState(false);
  const [waInquiry, setWAInquiry] = useState<Inquiry | null>(null);
  const [waMessages, setWAMessages] = useState<string[]>([]);
  const [waSelected, setWASelected] = useState(0);
  const [waEdited, setWAEdited] = useState("");
  const [waCopied, setWACopied] = useState(false);

  /* ── AI tip panel ── */
  const [showAITip, setShowAITip] = useState(false);
  const [aiTipForm, setAITipForm] = useState<DrawerForm | null>(null);

  /* ── bulk operations ── */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkAssignOpen, setBulkAssignOpen] = useState(false);
  const [bulkAssignVal, setBulkAssignVal] = useState("");
  const [bulkStatusOpen, setBulkStatusOpen] = useState(false);
  const [bulkFollowupOpen, setBulkFollowupOpen] = useState(false);
  const [bulkFollowupVal, setBulkFollowupVal] = useState("");

  /* ── lead score filter ── */
  const [filterScore, setFilterScore] = useState("");

  /* ── broadcast ── */
  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState(0);

  /* ── document manager ── */
  const [showDocModal, setShowDocModal] = useState(false);
  const [docInquiry, setDocInquiry] = useState<Inquiry | null>(null);
  const [docStatuses, setDocStatuses] = useState<Record<string, string>>({});

  /* ── data loading ── */
  const loadAll = async () => {
    setLoading(true);
    setError("");

    const [sourceResult, refResult, classResult, inquiryResult] = await Promise.allSettled([
      apiRequestWithRefresh<ApiList<AdminSetup>>("/api/v1/admissions/admin-setups/?type=3&page=1&page_size=50"),
      apiRequestWithRefresh<ApiList<AdminSetup>>("/api/v1/admissions/admin-setups/?type=4&page=1&page_size=50"),
      apiRequestWithRefresh<ApiList<SchoolClass>>("/api/v1/core/classes/"),
      apiRequestWithRefresh<ApiList<Inquiry>>("/api/v1/admissions/inquiries/?page_size=200"),
    ]);

    if (sourceResult.status === "fulfilled") setSources(listData(sourceResult.value));
    if (refResult.status === "fulfilled") setReferences(listData(refResult.value));
    if (classResult.status === "fulfilled") setClasses(listData(classResult.value));

    if (inquiryResult.status === "fulfilled") {
      setInquiries(listData(inquiryResult.value));
    } else {
      const msg = inquiryResult.reason instanceof Error ? inquiryResult.reason.message : "";
      if (msg === "401" || msg.toLowerCase().includes("unauthori")) {
        setError("Session expired. Please refresh the page or log in again.");
      } else {
        setError("Unable to load admissions data. Please check your connection and try again.");
      }
    }

    setLoading(false);
  };

  useEffect(() => { void loadAll(); }, []);

  /* ── derived ── */
  const priorityCalls = useMemo(
    () =>
      inquiries
        .filter((i) => i.active_status === 1 && i.next_follow_up_date && i.next_follow_up_date <= today)
        .sort((a, b) => (a.next_follow_up_date || "").localeCompare(b.next_follow_up_date || ""))
        .slice(0, 5),
    [inquiries, today]
  );

  const pipelineRows = useMemo(() => {
    let rows = inquiries.filter((i) => i.active_status === 1);
    if (activeTab === "followup") rows = rows.filter((i) => i.next_follow_up_date && i.next_follow_up_date <= today);
    if (activeTab === "recent") {
      const sinceStr = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
      rows = rows.filter((i) => i.query_date && i.query_date >= sinceStr);
    }
    if (filterDate) rows = rows.filter((i) => i.next_follow_up_date === filterDate);
    if (filterClass) rows = rows.filter((i) => String(i.school_class) === filterClass);
    if (filterSource) rows = rows.filter((i) => String(i.source) === filterSource);
    if (filterStatus) rows = rows.filter((i) => i.status === filterStatus);
    if (filterAssigned) rows = rows.filter((i) => (i.assigned || "").toLowerCase().includes(filterAssigned.toLowerCase()));
    if (search) {
      const q = search.toLowerCase();
      rows = rows.filter((i) =>
        i.full_name.toLowerCase().includes(q) ||
        i.phone.includes(q) ||
        (i.class_name_resolved || "").toLowerCase().includes(q)
      );
    }
    if (filterScore) rows = rows.filter((i) => (i.lead_score || 0) >= Number(filterScore));
    return rows.sort((a, b) => {
      const aD = a.next_follow_up_date || a.query_date || "";
      const bD = b.next_follow_up_date || b.query_date || "";
      return aD.localeCompare(bD);
    });
  }, [inquiries, activeTab, today, search, filterClass, filterSource, filterStatus, filterAssigned, filterDate, filterScore]);

  const activeFilterCount = [filterClass, filterSource, filterStatus, filterAssigned, filterDate, filterScore].filter(Boolean).length;

  const gradeStats = useMemo(() => {
    const maxCount = Math.max(1, ...classes.map((c) => inquiries.filter((i) => i.school_class === c.id).length));
    return classes.slice(0, 8).map((c) => {
      const count = inquiries.filter((i) => i.school_class === c.id).length;
      const pct = Math.round((count / maxCount) * 100);
      return { id: c.id, name: c.name, count, pct, isHigh: pct > 70 };
    });
  }, [classes, inquiries]);

  const calendarMap = useMemo(() => {
    const m: Record<string, number> = {};
    inquiries.filter((i) => i.next_follow_up_date).forEach((i) => {
      const d = i.next_follow_up_date as string;
      m[d] = (m[d] || 0) + 1;
    });
    return m;
  }, [inquiries]);

  const stats = useMemo(() => {
    const total = inquiries.length;
    const active = inquiries.filter((i) => i.active_status === 1).length;
    const followupDue = priorityCalls.length;
    const contacted = inquiries.filter((i) => i.follow_up_date).length;
    const enrolled = inquiries.filter((i) => i.status === "enrolled").length;
    const weekAgo = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const twoWeekAgo = new Date(Date.now() - 14 * 864e5).toISOString().slice(0, 10);
    const newThisWeek = inquiries.filter((i) => i.query_date && i.query_date >= weekAgo).length;
    const newLastWeek = inquiries.filter((i) => i.query_date && i.query_date >= twoWeekAgo && i.query_date < weekAgo).length;
    const sourceMap: Record<string, number> = {};
    inquiries.forEach((i) => { if (i.source_name) sourceMap[i.source_name] = (sourceMap[i.source_name] || 0) + 1; });
    const topSource = Object.entries(sourceMap).sort((a, b) => b[1] - a[1])[0];
    return { total, active, followupDue, contacted, enrolled, newThisWeek, newLastWeek, topSource };
  }, [inquiries, priorityCalls]);

  const assignees = useMemo(() => [...new Set(inquiries.map((i) => i.assigned).filter(Boolean))], [inquiries]);

  /* ── admission modal handlers ── */
  const openNewAdmission = () => {
    setEditingId(null);
    setDrawerForm(initialDrawerForm(today));
    setDrawerErrors({});
    setAdmissionSection(0);
    setShowAdmissionModal(true);
  };

  const openEditAdmission = (inq: Inquiry) => {
    setEditingId(inq.id);
    setDrawerForm({
      full_name: inq.full_name || "",
      phone: inq.phone || "",
      email: inq.email || "",
      school_class: inq.school_class ? String(inq.school_class) : "",
      no_of_child: String(inq.no_of_child || 1),
      source: inq.source ? String(inq.source) : "",
      reference: inq.reference ? String(inq.reference) : "",
      query_date: inq.query_date || today,
      next_follow_up_date: inq.next_follow_up_date || today,
      assigned: inq.assigned || "",
      description: inq.description || "",
      active_status: String(inq.active_status) === "2" ? "2" : "1",
      note: inq.note || "",
      child_name: "",
      child_dob: "",
      child_gender: "",
      parent_occupation: "",
      previous_school: "",
      reason_for_change: "",
      budget_range: "",
      preferred_contact_time: "",
      sibling_count: "0",
      specific_requirements: "",
      relationship: "",
      alternate_phone: "",
      home_area: "",
      has_sibling_enrolled: "",
      sibling_name: "",
      sibling_class_name: "",
      referred_by: "",
      preferred_visit_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10),
      preferred_visit_time: "",
    });
    setDrawerErrors({});
    setAdmissionSection(0);
    setShowAdmissionModal(true);
  };

  const setDf = (key: keyof DrawerForm, val: string) =>
    setDrawerForm((prev) => ({ ...prev, [key]: val }));

  const validateDrawer = () => {
    const errs: Record<string, string> = {};
    if (!drawerForm.full_name.trim()) errs.full_name = "Name is required.";
    else if (!/^[A-Za-z\s\-']+$/.test(drawerForm.full_name)) errs.full_name = "Name can only contain letters.";
    if (!drawerForm.phone.trim()) errs.phone = "Phone is required.";
    else if (!/^[6-9]\d{9}$/.test(drawerForm.phone)) errs.phone = "Enter a valid 10-digit Indian mobile number.";
    if (!drawerForm.assigned.trim()) errs.assigned = "Assigned To is required.";
    if (!drawerForm.source) errs.source = "Source is required.";
    if (!drawerForm.reference) errs.reference = "Reference is required.";
    if (!drawerForm.query_date) errs.query_date = "Query date is required.";
    if (!drawerForm.next_follow_up_date) errs.next_follow_up_date = "Next follow-up date is required.";
    return errs;
  };

  const submitDrawer = async (e: FormEvent) => {
    e.preventDefault();
    const errs = validateDrawer();
    if (Object.keys(errs).length > 0) { setDrawerErrors(errs); return; }

    const extFields = [
      drawerForm.child_name && `Child: ${drawerForm.child_name}`,
      drawerForm.child_dob && `DOB: ${drawerForm.child_dob}`,
      drawerForm.child_gender && `Gender: ${drawerForm.child_gender}`,
      drawerForm.parent_occupation && `Occupation: ${drawerForm.parent_occupation}`,
      drawerForm.previous_school && `Prev School: ${drawerForm.previous_school}`,
      drawerForm.reason_for_change && `Reason: ${drawerForm.reason_for_change}`,
      drawerForm.budget_range && `Budget: ${drawerForm.budget_range}`,
      drawerForm.preferred_contact_time && `Contact Time: ${drawerForm.preferred_contact_time}`,
      drawerForm.sibling_count !== "0" && `Siblings: ${drawerForm.sibling_count}`,
      drawerForm.specific_requirements && `Requirements: ${drawerForm.specific_requirements}`,
      drawerForm.relationship && `Relationship: ${drawerForm.relationship}`,
      drawerForm.alternate_phone && `Alt Phone: ${drawerForm.alternate_phone}`,
      drawerForm.home_area && `Area: ${drawerForm.home_area}`,
      drawerForm.has_sibling_enrolled === "yes" && `Sibling Enrolled: Yes${drawerForm.sibling_name ? " - " + drawerForm.sibling_name : ""}`,
      drawerForm.referred_by && `Referred By: ${drawerForm.referred_by}`,
      drawerForm.preferred_visit_date && `Visit Date: ${drawerForm.preferred_visit_date}`,
      drawerForm.preferred_visit_time && `Visit Time: ${drawerForm.preferred_visit_time}`,
    ].filter(Boolean).join(" | ");
    const combinedDescription = [drawerForm.description.trim(), extFields].filter(Boolean).join("\n");

    const payload = {
      full_name: drawerForm.full_name.trim(),
      phone: drawerForm.phone.trim(),
      email: drawerForm.email.trim(),
      description: combinedDescription,
      query_date: drawerForm.query_date,
      next_follow_up_date: drawerForm.next_follow_up_date,
      assigned: drawerForm.assigned.trim(),
      reference: Number(drawerForm.reference),
      source: Number(drawerForm.source),
      school_class: drawerForm.school_class ? Number(drawerForm.school_class) : null,
      no_of_child: Number(drawerForm.no_of_child),
      active_status: Number(drawerForm.active_status),
      note: drawerForm.note.trim(),
    };

    try {
      setDrawerSaving(true);
      if (editingId) {
        await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${editingId}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("Inquiry updated.", { autoClose: 3000 });
      } else {
        await apiRequestWithRefresh("/api/v1/admissions/inquiries/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        toast.success("New inquiry added.", { autoClose: 3000 });
        setAITipForm({ ...drawerForm });
        setShowAITip(true);
      }
      setShowAdmissionModal(false);
      void loadAll();
    } catch {
      toast.error(editingId ? "Unable to update inquiry." : "Unable to create inquiry.", { autoClose: 5000 });
    } finally {
      setDrawerSaving(false);
    }
  };

  /* ── log modal handlers ── */
  const openLogModal = (inq: Inquiry) => {
    const nextDate = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    setLogInquiry(inq);
    setLogForm({ outcome: "", note: "", next_follow_up_date: nextDate, status: inq.status || "contacted" });
    setShowLogModal(true);
  };

  const submitLog = async () => {
    if (!logInquiry) return;
    if (!logForm.outcome) { toast.error("Please select an outcome."); return; }
    const outcomeLabel = OUTCOMES.find((o) => o.value === logForm.outcome)?.label || logForm.outcome;
    const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
    const logEntry = `[${timestamp}] ${outcomeLabel}${logForm.note ? ": " + logForm.note : ""}`;
    const updatedNote = logInquiry.note ? `${logInquiry.note}\n${logEntry}` : logEntry;
    const newStatus =
      logForm.outcome === "enrolled" ? "enrolled"
      : logForm.outcome === "called_not_interested" ? "declined"
      : logForm.outcome === "visit_done" ? "visited"
      : logForm.outcome === "visit_scheduled" ? "visited"
      : logForm.outcome.startsWith("called_") || logForm.outcome === "whatsapp_sent" ? "contacted"
      : logForm.status;
    try {
      setLogSaving(true);
      await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${logInquiry.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: updatedNote,
          follow_up_date: today,
          next_follow_up_date: logForm.next_follow_up_date,
          status: newStatus,
          active_status: newStatus === "enrolled" || newStatus === "declined" ? 2 : 1,
        }),
      });
      toast.success("Contact logged!", { autoClose: 2500 });
      setShowLogModal(false);
      void loadAll();
    } catch {
      toast.error("Failed to log contact. Please try again.");
    } finally {
      setLogSaving(false);
    }
  };

  /* ── call flow handlers ── */
  const openCallModal = (inq: Inquiry) => {
    setCallInquiry(inq);
    setCallStep("contact");
    setCallTips(generateCallScript(inq));
    setShowCallModal(true);
  };

  const handleCallPlaced = (method: "app" | "desk") => {
    if (method === "app" && callInquiry?.phone) window.location.href = `tel:${callInquiry.phone}`;
    setCallStep("coaching");
  };

  const handleCallOutcome = (outcome: "converted" | "log") => {
    if (outcome === "converted") {
      setCallStep("converted");
      if (callInquiry) {
        apiRequestWithRefresh(`/api/v1/admissions/inquiries/${callInquiry.id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "enrolled", active_status: 2, follow_up_date: today }),
        }).then(() => { toast.success("🎉 Enrolled!", { autoClose: 3000 }); void loadAll(); }).catch(() => {});
      }
    } else {
      setShowCallModal(false);
      setCallStep("contact");
      if (callInquiry) openLogModal(callInquiry);
    }
  };

  const handleConversionChoice = (choiceKey: string) => {
    if (!callInquiry) return;
    const msgMap: Record<string, string> = {
      fee_structure: `Dear ${callInquiry.full_name.split(" ")[0]},\n\nCongratulations on your admission! 🎉\n\nHere is our fee structure for ${callInquiry.class_name_resolved || "the selected grade"}:\n\n📋 [Fee details to be shared]\n\n💳 Payment modes: Online / DD / Challan\n\nAdmissions Team`,
      school_tour: `Dear ${callInquiry.full_name.split(" ")[0]},\n\n🏫 Welcome to our school family!\n\nWe'd like to invite you for a school tour.\n\nTours available Mon–Fri 9AM–12PM, Sat 9AM–11AM.\n\nPlease reply with your preferred date!\n\nAdmissions Team`,
      parent_visit: `Dear ${callInquiry.full_name.split(" ")[0]},\n\n👋 Thank you for choosing us!\n\nWe'd like to schedule a meeting with our Principal.\n\nWeekdays 10AM–4PM, Sat 10AM–12PM.\n\nPlease confirm your preferred time!\n\nAdmissions Team`,
      document_collection: `Dear ${callInquiry.full_name.split(" ")[0]},\n\n📋 Documents needed for enrollment:\n• Birth certificate\n• Previous school TC\n• Report card (last 2 years)\n• 4 passport photos\n• Aadhar card copy\n\nAdmissions Team`,
      form_filling: `Dear ${callInquiry.full_name.split(" ")[0]},\n\n📝 Please fill the official enrollment form.\n\nOur team will guide you through the process. Contact us to schedule a form-filling appointment.\n\nAdmissions Team`,
    };
    if (callInquiry.phone && msgMap[choiceKey]) {
      window.open(`https://wa.me/91${callInquiry.phone}?text=${encodeURIComponent(msgMap[choiceKey])}`, "_blank");
    }
    setShowCallModal(false);
    setCallStep("contact");
  };

  /* ── whatsapp modal handlers ── */
  const openWAModal = (inq: Inquiry) => {
    if (!inq.phone) { toast.error("No phone number available."); return; }
    const msgs = generateWhatsAppMessages(inq);
    setWAInquiry(inq);
    setWAMessages(msgs);
    setWASelected(0);
    setWAEdited(msgs[0]);
    setWACopied(false);
    setShowWAModal(true);
  };

  const copyWAMessage = async () => {
    try {
      await navigator.clipboard.writeText(waEdited);
      setWACopied(true);
      setTimeout(() => setWACopied(false), 2000);
      toast.success("Message copied!", { autoClose: 1500 });
    } catch { toast.error("Copy failed. Select and copy manually."); }
  };

  const sendWADirect = () => {
    if (!waInquiry?.phone) return;
    window.open(`https://wa.me/91${waInquiry.phone}?text=${encodeURIComponent(waEdited)}`, "_blank");
    setShowWAModal(false);
    const nextDate = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    setLogInquiry(waInquiry);
    setLogForm({ outcome: "whatsapp_sent", note: "WhatsApp sent via Command Center", next_follow_up_date: nextDate, status: "contacted" });
    setShowLogModal(true);
  };

  /* ── quick status change ── */
  const quickStatus = async (inq: Inquiry, newStatus: string) => {
    try {
      await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${inq.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          follow_up_date: today,
          active_status: newStatus === "enrolled" || newStatus === "declined" ? 2 : 1,
        }),
      });
      toast.success(`Marked as ${newStatus}.`, { autoClose: 2000 });
      void loadAll();
    } catch {
      toast.error("Failed to update status.");
    }
  };

  /* ── bulk patch handler ── */
  const bulkPatch = async (patch: Record<string, unknown>) => {
    const ids = [...selectedIds];
    try {
      await Promise.all(ids.map(id =>
        apiRequestWithRefresh(`/api/v1/admissions/inquiries/${id}/`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        })
      ));
      toast.success(`Updated ${ids.length} inquiries.`, { autoClose: 2500 });
      setSelectedIds(new Set());
      void loadAll();
    } catch {
      toast.error("Some updates failed. Please try again.");
    }
  };

  /* ── today / filter / grade / calendar actions ── */
  const goToToday = () => {
    setActiveTab("followup");
    setFilterDate(today);
    setTimeout(() => pipelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleGradeClick = (classId: number) => {
    setFilterClass(filterClass === String(classId) ? "" : String(classId));
    setTimeout(() => pipelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const handleCalendarDayClick = (dateStr: string, count: number) => {
    if (count === 0) return;
    if (filterDate === dateStr) { setFilterDate(""); return; }
    setFilterDate(dateStr);
    if (dateStr !== today) setActiveTab("all");
    setTimeout(() => pipelineRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
  };

  const clearFilters = () => {
    setFilterClass(""); setFilterSource(""); setFilterStatus("");
    setFilterAssigned(""); setFilterDate(""); setSearch(""); setActiveTab("all");
    setFilterScore("");
  };

  /* ── mini calendar ── */
  const calendarDays = useMemo(() => {
    const firstDay = new Date(currentYear, currentMonth, 1).getDay();
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const days: Array<{ date: string; day: number; count: number } | null> = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      days.push({ date: dateStr, day: d, count: calendarMap[dateStr] || 0 });
    }
    return days;
  }, [currentYear, currentMonth, calendarMap]);

  const monthName = new Date(currentYear, currentMonth).toLocaleString("default", { month: "long" });

  /* ─────────────────── render ─────────────────── */
  return (
    <div style={{ fontFamily: "inherit", minHeight: "100vh" }}>
      <ToastContainer position="top-right" newestOnTop />

      {/* ── Smart Alert Ticker ── */}
      <div className="flex flex-wrap gap-2 mb-4" style={{ animation: "fade-in .4s ease" }}>
        <button
          onClick={goToToday}
          className="flex items-center gap-1.5 bg-red-50 border border-red-200 text-red-700 rounded-full px-3 py-1 text-sm font-medium shadow-sm cursor-pointer hover:bg-red-100 transition-colors"
        >
          <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" style={{ animation: "pulse-dot 2s infinite" }} />
          🔴 {stats.followupDue} priority call{stats.followupDue !== 1 ? "s" : ""} due
        </button>
        <span className="flex items-center gap-1.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-full px-3 py-1 text-sm font-medium shadow-sm">
          ✨ {stats.newThisWeek} new inquir{stats.newThisWeek !== 1 ? "ies" : "y"} today
        </span>
        <span className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-gray-600 rounded-full px-3 py-1 text-sm font-medium shadow-sm">
          📊 {stats.enrolled} enrolled so far
        </span>
        {stats.topSource && (
          <span className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 text-amber-700 rounded-full px-3 py-1 text-sm font-medium shadow-sm">
            🏆 Top source: {stats.topSource[0]}
          </span>
        )}
      </div>

      {/* ── Page Header ── */}
      <div className={`flex flex-wrap items-end justify-between gap-3 ${showFilters ? "mb-2" : "mb-5"}`}>
        <div>
          <h1 className="m-0 text-2xl font-bold text-gray-900">Admissions Command Center</h1>
          <p className="flex items-center gap-1.5 mt-1 text-sm text-gray-500">
            <span className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" style={{ animation: "pulse-dot 2s infinite" }} />
            Live · Academic Year {currentYear}–{(currentYear + 1).toString().slice(2)}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <button
            className="border border-gray-200 rounded-lg p-2 text-gray-400 hover:text-gray-700 transition-colors"
            onClick={() => void loadAll()}
            title="Refresh"
          >
            <RefreshCw size={15} />
          </button>
          <button
            className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-sm transition-colors ${activeTab === "followup" ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
            onClick={goToToday}
          >
            <Calendar size={13} /> Today
            {stats.followupDue > 0 && (
              <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 py-px rounded-full ml-0.5">
                {stats.followupDue}
              </span>
            )}
          </button>
          <button
            className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 text-sm transition-colors ${showFilters ? "border-blue-400 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
            onClick={() => setShowFilters((v) => !v)}
          >
            <SlidersHorizontal size={13} /> Filters
            {activeFilterCount > 0 && (
              <span className="bg-blue-600 text-white text-[10px] font-bold px-1.5 py-px rounded-full ml-0.5">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            className="flex items-center gap-1.5 border border-blue-200 bg-blue-50 text-blue-700 rounded-lg px-3 py-1.5 text-sm hover:bg-blue-100 transition-colors"
            onClick={() => { setBroadcastMsg(""); setBroadcastDone(0); setShowBroadcastModal(true); }}
          >
            <Send size={13} /> 📢 Broadcast
          </button>
          <button
            className="flex items-center gap-1.5 bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-semibold shadow-sm hover:bg-blue-700 transition-colors"
            onClick={openNewAdmission}
          >
            <Plus size={14} /> New Admission
          </button>
        </div>
      </div>

      {/* ── Filters Panel ── */}
      {showFilters && (
        <div style={{ background: "#f8fafc", border: "1px solid var(--line, #e5e7eb)", borderRadius: 10, padding: "12px 16px", marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 10, alignItems: "flex-end" }}>
          <div style={{ flex: "1 1 130px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Grade / Class</label>
            <select value={filterClass} onChange={(e) => setFilterClass(e.target.value)} style={{ ...inp(), background: "#fff" }}>
              <option value="">All Grades</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Source</label>
            <select value={filterSource} onChange={(e) => setFilterSource(e.target.value)} style={{ ...inp(), background: "#fff" }}>
              <option value="">All Sources</option>
              {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Status</label>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ ...inp(), background: "#fff" }}>
              <option value="">All Statuses</option>
              {STATUS_CHOICES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Assigned To</label>
            <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)} style={{ ...inp(), background: "#fff" }}>
              <option value="">All</option>
              {assignees.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>
          <div style={{ flex: "1 1 130px" }}>
            <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "var(--text-muted)", marginBottom: 4 }}>Min. Score</label>
            <select value={filterScore} onChange={(e) => setFilterScore(e.target.value)} style={{ ...inp(), background: "#fff" }}>
              <option value="">Any Score</option>
              <option value="80">⭐ 80+ Hot</option>
              <option value="60">60+ Warm</option>
              <option value="40">40+ Lukewarm</option>
            </select>
          </div>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} style={{ ...btnGhost, color: "#dc2626", borderColor: "#fecaca", height: 36 }}>
              <X size={13} /> Clear All
            </button>
          )}
        </div>
      )}

      {error && (
        <div style={{ padding: "10px 14px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, color: "#b91c1c", fontSize: 13, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
          <AlertCircle size={14} /> {error}
        </div>
      )}

      {/* ── Grade Capacity Rings ── */}
      {gradeStats.length > 0 && (
        <div className="flex overflow-x-auto gap-3 py-3 mb-4">
          {gradeStats.map((g) => {
            const isSelected = filterClass === String(g.id);
            const ringColor = g.pct >= 90 ? "#ef4444" : g.pct >= 60 ? "#3b82f6" : g.pct >= 30 ? "#f59e0b" : "#22c55e";
            const circumference = 226.2;
            const offset = circumference * (1 - g.pct / 100);
            return (
              <div
                key={g.id}
                onClick={() => handleGradeClick(g.id)}
                title={`Click to filter by ${g.name}`}
                className="flex-shrink-0 flex flex-col items-center cursor-pointer"
              >
                <div
                  className={`flex flex-col items-center rounded-2xl p-3 border transition-all duration-200 hover:scale-105 ${isSelected ? "border-blue-400 bg-blue-50 shadow-lg" : "border-gray-100 bg-white shadow-sm hover:shadow-md"}`}
                  style={{ width: 110 }}
                >
                  <svg viewBox="0 0 80 80" width="80" height="80">
                    <circle cx="40" cy="40" r="36" fill="none" stroke="#e5e7eb" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="36" fill="none"
                      stroke={ringColor}
                      strokeWidth="6"
                      strokeDasharray="226.2"
                      strokeDashoffset={offset}
                      strokeLinecap="round"
                      transform="rotate(-90 40 40)"
                      style={{ transition: "stroke-dashoffset 600ms ease" }}
                    />
                    <text x="40" y="37" textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="bold" fill="#111827">{g.pct}%</text>
                    <text x="40" y="52" textAnchor="middle" dominantBaseline="middle" fontSize="10" fill="#6b7280">{g.name.length > 6 ? g.name.slice(0, 5) + "…" : g.name}</text>
                  </svg>
                  <p className="text-xs text-gray-400 text-center mt-1 w-full truncate">{g.count} inquir{g.count === 1 ? "y" : "ies"}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── 3-Column Grid ── */}
      <div className="acc-grid">

        {/* ── Left: Priority Calls + Stats ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Today's Mission */}
          <div style={card}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="m-0 text-sm font-bold text-gray-900 flex items-center gap-1.5">
                🎯 Today&apos;s Mission
              </h2>
              {priorityCalls.length > 0 && (
                <span className="bg-red-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {priorityCalls.length}
                </span>
              )}
            </div>
            {loading ? (
              <p className="text-sm text-gray-400">Loading...</p>
            ) : priorityCalls.length === 0 ? (
              <div className="text-center py-5">
                <p className="text-2xl mb-1">🎉</p>
                <p className="text-sm text-gray-400 font-medium">All caught up!</p>
                <p className="text-xs text-gray-400 mt-0.5">No follow-ups due today</p>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {priorityCalls.map((inq) => {
                  const isOverdue = inq.next_follow_up_date! < today;
                  const stageColor = inq.status === "enrolled" ? "#22c55e" : inq.status === "visited" ? "#8b5cf6" : inq.status === "contacted" ? "#3b82f6" : "#f59e0b";
                  return (
                    <div key={inq.id}
                      className="bg-white rounded-xl p-3 shadow-sm border border-gray-100 hover:bg-gray-50 hover:translate-x-1 transition-all"
                      style={{ borderLeft: `4px solid ${stageColor}` }}
                    >
                      <div className="flex justify-between items-start mb-1">
                        <span className="text-xs font-semibold text-gray-900">{inq.full_name}</span>
                        {isOverdue ? (
                          <span className="text-[10px] font-bold text-red-700 bg-red-50 rounded-full px-2 py-px">Overdue</span>
                        ) : (
                          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 rounded-full px-2 py-px">Due Today</span>
                        )}
                      </div>
                      {inq.class_name_resolved && (
                        <p className="text-[10px] text-gray-500 mb-1.5">Grade: {inq.class_name_resolved}</p>
                      )}
                      <div className="flex justify-between items-center gap-2">
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          <Clock size={10} /> {formatDate(inq.next_follow_up_date)}
                        </span>
                        <div className="flex gap-1">
                          {inq.phone && (
                            <button onClick={() => openCallModal(inq)}
                              className="text-[11px] text-green-700 font-semibold flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors">
                              📞
                            </button>
                          )}
                          {inq.phone && (
                            <button onClick={() => openWAModal(inq)}
                              className="text-[11px] px-2 py-0.5 rounded-md bg-green-50 border border-green-200 cursor-pointer hover:bg-green-100 transition-colors">
                              💬
                            </button>
                          )}
                          <button onClick={() => openLogModal(inq)}
                            className="text-[11px] px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 cursor-pointer hover:bg-blue-100 transition-colors">
                            📝
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Pipeline Health */}
          <div style={card}>
            <h2 className="m-0 mb-3 text-sm font-bold flex items-center gap-2">
              <TrendingUp size={14} className="text-blue-600" />
              Pipeline Health
              <span className="w-2 h-2 rounded-full bg-green-500 ml-1" style={{ animation: "pulse-dot 2s infinite" }} />
            </h2>
            <div className="flex flex-col gap-3">
              {/* Total Inquiries */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500">Total Inquiries</span>
                  <span className="text-sm font-bold text-blue-600">{stats.total}</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: "100%" }} />
                </div>
              </div>
              {/* Follow-up Due */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500">Follow-up Due</span>
                  <span className={`text-sm font-bold text-amber-600 ${stats.followupDue > 0 ? "animate-pulse" : ""}`}>{stats.followupDue}</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: stats.total > 0 ? `${Math.round((stats.followupDue / stats.total) * 100)}%` : "0%" }} />
                </div>
              </div>
              {/* Enrolled */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-500">Enrolled</span>
                  <span className="text-sm font-bold text-green-600">{stats.enrolled}</span>
                </div>
                <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: stats.total > 0 ? `${Math.round((stats.enrolled / stats.total) * 100)}%` : "0%" }} />
                </div>
              </div>
            </div>
            {stats.topSource && (
              <div className="mt-3 px-2.5 py-1.5 bg-green-50 rounded-md border border-green-100">
                <span className="text-xs text-green-700 font-semibold">
                  🏆 Top Source: {stats.topSource[0]} ({stats.topSource[1]})
                </span>
              </div>
            )}
          </div>

          {/* Hot Leads by Score */}
          {(() => {
            const hotLeads = [...inquiries]
              .filter(i => (i.lead_score || 0) > 0)
              .sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0))
              .slice(0, 5);
            if (hotLeads.length === 0) return null;
            return (
              <div style={card}>
                <h2 style={{ margin: "0 0 10px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
                  <Zap size={14} color="#d97706" /> ⚡ Hot Leads by Score
                </h2>
                <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                  {hotLeads.map(inq => {
                    const score = inq.lead_score || 0;
                    const scoreBg = score >= 80 ? "#f0fdf4" : score >= 60 ? "#fef3c7" : score >= 40 ? "#fff7ed" : "#f9fafb";
                    const scoreColor = score >= 80 ? "#059669" : score >= 60 ? "#d97706" : score >= 40 ? "#ea580c" : "#6b7280";
                    return (
                      <div key={inq.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 99, background: scoreBg, color: scoreColor, flexShrink: 0 }}>
                          ⚡ {score}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{inq.full_name}</div>
                          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{inq.class_name_resolved || "—"}</div>
                        </div>
                        {inq.phone && (
                          <button onClick={() => openCallModal(inq)}
                            style={{ fontSize: 10, color: "#059669", fontWeight: 600, padding: "2px 7px", borderRadius: 5, background: "#f0fdf4", border: "1px solid #bbf7d0", cursor: "pointer", display: "flex", alignItems: "center", gap: 2, flexShrink: 0 }}>
                            <PhoneCall size={9} /> Call
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* ── Center: Pipeline ── */}
        <div ref={pipelineRef} style={card}>
          {/* Pipeline header */}
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 14, paddingBottom: 12, borderBottom: "1px solid var(--line, #e5e7eb)" }}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
              <input
                type="checkbox"
                checked={pipelineRows.length > 0 && pipelineRows.every(i => selectedIds.has(i.id))}
                onChange={() => {
                  if (pipelineRows.every(i => selectedIds.has(i.id))) {
                    setSelectedIds(new Set());
                  } else {
                    setSelectedIds(new Set(pipelineRows.map(i => i.id)));
                  }
                }}
                style={{ width: 16, height: 16, cursor: "pointer", marginTop: 2, flexShrink: 0 }}
                title="Select all visible"
              />
              <div>
                <h2 style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>Active Admission Pipelines</h2>
                {activeFilterCount > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginTop: 5, alignItems: "center" }}>
                    <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Filtered:</span>
                    {filterClass && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "#eff6ff", color: "var(--primary, #1d4ed8)", fontWeight: 600 }}>{classes.find((c) => String(c.id) === filterClass)?.name}</span>}
                    {filterStatus && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "#eff6ff", color: "var(--primary, #1d4ed8)", fontWeight: 600 }}>{filterStatus}</span>}
                    {filterDate && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 99, background: "#eff6ff", color: "var(--primary, #1d4ed8)", fontWeight: 600 }}>{formatDate(filterDate)}</span>}
                    <button onClick={clearFilters} style={{ fontSize: 10, color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>✕ Clear</button>
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
              {(["all", "followup", "recent"] as const).map((tab) => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  style={{ height: 30, padding: "0 10px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 600, border: activeTab === tab ? "1px solid var(--primary)" : "1px solid var(--line, #e5e7eb)", background: activeTab === tab ? "var(--primary, #1d4ed8)" : "transparent", color: activeTab === tab ? "#fff" : "var(--text-muted, #6b7280)" }}>
                  {tab === "all" ? "All" : tab === "followup" ? "Follow-up Due" : "Recent"}
                </button>
              ))}
              <div style={{ position: "relative" }}>
                <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name, phone…"
                  style={{ ...inp(), paddingLeft: 28, width: 160 }} />
              </div>
            </div>
          </div>

          {/* Pipeline cards */}
          {loading ? (
            <div style={{ padding: "30px 0", textAlign: "center", color: "var(--text-muted)", fontSize: 13 }}>Loading inquiries…</div>
          ) : pipelineRows.length === 0 ? (
            <div style={{ padding: "40px 0", textAlign: "center" }}>
              <Phone size={32} color="#d1d5db" style={{ marginBottom: 8 }} />
              <p style={{ margin: 0, fontSize: 14, color: "var(--text-muted)" }}>No inquiries found</p>
              <p style={{ margin: "4px 0 0", fontSize: 12, color: "var(--text-muted)" }}>Try a different filter or add a new inquiry</p>
              {activeFilterCount > 0 && (
                <button onClick={clearFilters} style={{ marginTop: 8, fontSize: 12, color: "var(--primary, #1d4ed8)", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>Clear filters</button>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {pipelineRows.map((inq) => {
                const prog = getProgress(inq);
                const badge = getSentimentBadge(inq, today);
                const signal = getSignal(inq, today);
                const initials = inq.full_name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
                const avatarBg = nameColor(inq.full_name);
                const isOverdue = badge.label === "Overdue";
                const score = inq.lead_score ?? 0;
                const stagePills = [
                  { label: "Inquiry", color: "#3b82f6" },
                  { label: "Contacted", color: "#14b8a6" },
                  { label: "Visited", color: "#f59e0b" },
                  { label: "Enrolled", color: "#22c55e" },
                ];

                return (
                  <div key={inq.id}
                    className="bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md hover:-translate-y-px transition-all p-4">
                    {/* TOP ROW */}
                    <div className="flex items-start gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(inq.id)}
                        onChange={() => setSelectedIds(prev => { const next = new Set(prev); next.has(inq.id) ? next.delete(inq.id) : next.add(inq.id); return next; })}
                        onClick={(e) => e.stopPropagation()}
                        className="w-4 h-4 cursor-pointer flex-shrink-0 mt-1"
                      />
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0 relative"
                        style={{ background: avatarBg }}
                      >
                        {initials}
                        {signal === "hot" && <span className="absolute -top-1 -right-1 text-xs" title="Overdue – hot lead">🔥</span>}
                        {signal === "stale" && <span className="absolute -top-1 -right-1 text-xs" title="No contact in 7+ days">❄️</span>}
                        {signal === "new" && <span className="absolute -top-1 -right-1 text-xs" title="New inquiry this week">✨</span>}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-1 flex-wrap">
                          <span className="font-semibold text-gray-900 text-xs">{inq.full_name}</span>
                          <div className="flex items-center gap-1 flex-wrap">
                            {inq.class_name_resolved && (
                              <span className="rounded-full bg-blue-50 text-blue-700 text-[10px] px-2 py-px">{inq.class_name_resolved}</span>
                            )}
                            {score > 0 && (
                              <span className={`text-[10px] font-bold px-1.5 py-px rounded-full ${score > 70 ? "bg-red-100 text-red-700" : score > 40 ? "bg-amber-100 text-amber-700" : "bg-blue-100 text-blue-700"}`}>
                                {score > 70 ? "🔥" : score > 40 ? "🟡" : "🔵"} {score}
                              </span>
                            )}
                            {isOverdue && (
                              <span className="text-[10px] text-red-600 bg-red-50 rounded-full px-2 py-px font-medium">
                                Overdue
                              </span>
                            )}
                          </div>
                        </div>
                        {inq.phone && <p className="text-[10px] text-gray-400 mt-0.5">{inq.phone}</p>}
                      </div>
                    </div>

                    {/* STAGE PROGRESS PILLS */}
                    <div className="flex gap-1 mb-2 ml-11">
                      {stagePills.map((stage, idx) => {
                        const isFilled = idx < prog.filled;
                        const isCurrent = idx === prog.filled - 1;
                        return (
                          <div
                            key={stage.label}
                            className="flex-1 h-5 rounded-full flex items-center justify-center text-[9px] font-semibold transition-all"
                            style={{
                              background: isFilled ? stage.color : "#f3f4f6",
                              color: isFilled ? "#fff" : "#9ca3af",
                            }}
                          >
                            {isCurrent && <span className="w-1.5 h-1.5 rounded-full bg-white mr-0.5 inline-block" />}
                            {stage.label.slice(0, 3)}
                          </div>
                        );
                      })}
                    </div>

                    {/* MIDDLE ROW */}
                    <div className="flex gap-1.5 flex-wrap mb-2.5 ml-11">
                      {inq.source_name && (
                        <span className="text-[10px] px-2 py-px rounded-md bg-slate-100 text-slate-600">📍 {inq.source_name}</span>
                      )}
                      {inq.assigned && (
                        <span className="text-[10px] px-2 py-px rounded-md bg-blue-50 text-blue-600">👤 {inq.assigned}</span>
                      )}
                      {[
                        { s: "contacted", label: "Contacted", color: "#0369a1", bg: "#eff6ff" },
                        { s: "visited", label: "Visited", color: "#7c3aed", bg: "#f5f3ff" },
                        { s: "enrolled", label: "Enrolled 🎉", color: "#047857", bg: "#f0fdf4" },
                        { s: "declined", label: "Declined", color: "#6b7280", bg: "#f9fafb" },
                      ].map(({ s, label, color, bg }) => (
                        <button key={s} onClick={() => void quickStatus(inq, s)}
                          style={{ fontSize: 9, padding: "1px 6px", borderRadius: 99, height: 18, border: `1px solid ${inq.status === s ? color : "#e5e7eb"}`, background: inq.status === s ? bg : "transparent", color: inq.status === s ? color : "#9ca3af", cursor: "pointer", fontWeight: inq.status === s ? 700 : 400 }}>
                          {label}
                        </button>
                      ))}
                    </div>

                    {/* BOTTOM ROW ACTIONS */}
                    <div className="flex justify-between items-center gap-2 ml-11 flex-wrap">
                      <div className="flex gap-0.5">
                        {inq.phone && (
                          <button onClick={() => openCallModal(inq)}
                            className="text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg px-2 py-1.5 text-xs flex items-center gap-0.5 transition-colors">
                            📞 Call
                          </button>
                        )}
                        {inq.phone && (
                          <button onClick={() => openWAModal(inq)}
                            className="text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg px-2 py-1.5 text-xs transition-colors">
                            💬 WA
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setDocInquiry(inq);
                            const init: Record<string, string> = {};
                            REQUIRED_DOCS.forEach(d => { init[d.key] = "not_requested"; });
                            setDocStatuses(init);
                            setShowDocModal(true);
                          }}
                          className="relative text-gray-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg px-2 py-1.5 text-xs transition-colors">
                          📄 Docs
                          {(inq.documents_status === "requested" || inq.documents_status === "partial") && (
                            <span className="absolute top-0 right-0 w-2 h-2 rounded-full bg-amber-500 border border-white" />
                          )}
                        </button>
                        <button onClick={() => openEditAdmission(inq)}
                          className="text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg px-2 py-1.5 text-xs transition-colors">
                          ✏️ Edit
                        </button>
                      </div>
                      <button onClick={() => openLogModal(inq)}
                        className="bg-blue-600 text-white rounded-lg px-3 py-1.5 text-xs font-semibold hover:bg-blue-700 transition-colors">
                        Log Update
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {pipelineRows.length > 0 && (
            <p style={{ margin: "12px 0 0", fontSize: 12, color: "var(--text-muted)", textAlign: "center" }}>
              Showing {pipelineRows.length} active {pipelineRows.length === 1 ? "inquiry" : "inquiries"}
            </p>
          )}
        </div>

        {/* ── Right: Conversion + Calendar ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Conversion Intel */}
          <div style={card}>
            <h2 className="m-0 mb-3 text-sm font-bold flex items-center gap-1.5">
              <BarChart2 size={14} className="text-blue-600" /> Conversion Intel
            </h2>
            {(() => {
              const visitedCount = inquiries.filter(i => i.status === "visited").length;
              const funnelStages = [
                { label: "Inquiry",   value: stats.total,                     color: "#3b82f6" },
                { label: "Contacted", value: stats.contacted,                  color: "#14b8a6" },
                { label: "Visited",   value: visitedCount + stats.enrolled,    color: "#f59e0b" },
                { label: "Enrolled",  value: stats.enrolled,                   color: "#22c55e" },
              ];
              const maxVal = funnelStages[0].value || 1;
              return (
                <div className="flex flex-col gap-2">
                  {funnelStages.map((stage, idx) => {
                    const barPct = Math.round((stage.value / maxVal) * 100);
                    const prev = funnelStages[idx - 1];
                    const dropOff = idx > 0 && prev.value > 0
                      ? Math.round(((prev.value - stage.value) / prev.value) * 100)
                      : null;
                    return (
                      <div key={stage.label}>
                        {dropOff !== null && dropOff > 0 && (
                          <div className="text-[10px] text-red-400 text-center my-0.5 font-medium">
                            ↓ {dropOff}% drop-off
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-gray-500 w-16 flex-shrink-0">{stage.label}</span>
                          <div className="flex-1 h-5 bg-gray-100 rounded-md overflow-hidden">
                            <div
                              className="h-full rounded-md flex items-center justify-end pr-1.5 transition-all duration-500"
                              style={{ width: `${barPct}%`, background: stage.color, minWidth: stage.value > 0 ? 28 : 0 }}
                            >
                              {stage.value > 0 && <span className="text-[10px] text-white font-bold">{stage.value}</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {stats.total > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 text-center">
                      <span className={`text-xs font-semibold ${stats.enrolled / stats.total > 0.3 ? "text-green-600" : stats.enrolled / stats.total > 0.1 ? "text-amber-600" : "text-red-500"}`}>
                        Overall: {Math.round((stats.enrolled / stats.total) * 100)}% convert
                      </span>
                    </div>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Mini Calendar */}
          <div style={card}>
            <h2 style={{ margin: "0 0 12px", fontSize: 14, fontWeight: 700, display: "flex", alignItems: "center", gap: 6 }}>
              <Calendar size={14} color="var(--primary, #1d4ed8)" /> Follow-up Calendar
            </h2>
            <p style={{ margin: "0 0 8px", fontSize: 12, color: "var(--text-muted)", textAlign: "center", fontWeight: 600 }}>
              {monthName} {currentYear}
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
              {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                <div key={i} style={{ textAlign: "center", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", paddingBottom: 2 }}>{d}</div>
              ))}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
              {calendarDays.map((day, idx) => {
                if (!day) return <div key={`empty-${idx}`} />;
                const isToday = day.date === today;
                const hasFollowUp = day.count > 0;
                const isSelected = filterDate === day.date;
                return (
                  <div
                    key={day.date}
                    onClick={() => handleCalendarDayClick(day.date, day.count)}
                    title={hasFollowUp ? `${day.count} follow-up${day.count > 1 ? "s" : ""} – click to filter` : undefined}
                    style={{
                      aspectRatio: "1", borderRadius: 4, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                      fontSize: 10, fontWeight: isToday || isSelected ? 700 : 400,
                      background: isToday ? "var(--primary, #1d4ed8)" : isSelected ? "#bfdbfe" : hasFollowUp ? "#dbeafe" : "transparent",
                      color: isToday ? "#fff" : hasFollowUp ? "#1d4ed8" : "var(--text)",
                      border: isSelected && !isToday ? "1.5px solid var(--primary, #1d4ed8)" : hasFollowUp && !isToday ? "1px solid #bfdbfe" : "none",
                      cursor: hasFollowUp ? "pointer" : "default",
                      lineHeight: 1,
                    }}>
                    <span>{day.day}</span>
                    {hasFollowUp && (
                      <span style={{ fontSize: 8, fontWeight: 700, color: isToday ? "rgba(255,255,255,.85)" : "#1d4ed8", marginTop: 1 }}>{day.count}</span>
                    )}
                  </div>
                );
              })}
            </div>
            {/* Today's follow-up summary */}
            {calendarMap[today] !== undefined && (
              <div style={{ marginTop: 8, padding: "5px 8px", background: "#eff6ff", borderRadius: 6, border: "1px solid #bfdbfe", textAlign: "center" }}>
                <span style={{ fontSize: 11, color: "var(--primary, #1d4ed8)", fontWeight: 700 }}>
                  📅 Today: {calendarMap[today] || 0} follow-up{(calendarMap[today] || 0) !== 1 ? "s" : ""}
                </span>
              </div>
            )}
            {Object.keys(calendarMap).length > 0 && (
              <p style={{ margin: "6px 0 0", fontSize: 10, color: "var(--text-muted)", textAlign: "center" }}>
                numbers = follow-up count · click to filter
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Log Update Modal ── */}
      {showLogModal && logInquiry && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} onClick={() => setShowLogModal(false)} />
          <div style={{ position: "relative", width: "min(460px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.25)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "var(--primary, #1d4ed8)", color: "#fff" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Log Contact Update</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.85 }}>{logInquiry.full_name} · {logInquiry.phone}</p>
              </div>
              <button onClick={() => setShowLogModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, display: "flex", color: "#fff" }}>
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Outcome *</label>
                <select value={logForm.outcome} onChange={(e) => setLogForm((f) => ({ ...f, outcome: e.target.value }))}
                  style={{ ...inp(), background: "#fff", width: "100%" }}>
                  <option value="">Select outcome…</option>
                  {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Note (optional)</label>
                <textarea value={logForm.note} onChange={(e) => setLogForm((f) => ({ ...f, note: e.target.value }))}
                  placeholder="What was discussed? Key points…"
                  style={{ ...inp(), height: 72, padding: "8px 10px", resize: "vertical" as const, width: "100%" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Next Follow-up Date</label>
                <input type="date" value={logForm.next_follow_up_date}
                  onChange={(e) => setLogForm((f) => ({ ...f, next_follow_up_date: e.target.value }))}
                  style={inp()} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[{ label: "+1 day", days: 1 }, { label: "+2 days", days: 2 }, { label: "+1 week", days: 7 }, { label: "+2 weeks", days: 14 }].map(({ label, days }) => (
                  <button key={days} onClick={() => setLogForm((f) => ({ ...f, next_follow_up_date: new Date(Date.now() + days * 864e5).toISOString().slice(0, 10) }))}
                    style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--line, #e5e7eb)", background: "transparent", cursor: "pointer", color: "var(--text-muted)" }}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--line, #e5e7eb)", background: "#f8fafc" }}>
              <button onClick={() => void submitLog()} disabled={logSaving}
                style={{ ...btnPrimary, flex: 1, justifyContent: "center" }}>
                {logSaving ? "Saving…" : "✓ Save Log"}
              </button>
              <button onClick={() => setShowLogModal(false)} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Call Flow Modal ── */}
      {showCallModal && callInquiry && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(500px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            {callStep === "contact" && (
              <>
                <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📞 Ready to Call</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.9 }}>Review contact details before dialing</p>
                  </div>
                  <button onClick={() => setShowCallModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
                </div>
                <div style={{ padding: 20 }}>
                  {/* Contact card */}
                  <div style={{ background: "#f0fdf4", border: "2px solid #10b981", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: "#065f46", marginBottom: 4 }}>{callInquiry.full_name}</div>
                    <div style={{ fontSize: 14, color: "#047857", fontWeight: 700, marginBottom: 4 }}>📱 {callInquiry.phone}</div>
                    {callInquiry.class_name_resolved && <div style={{ fontSize: 13, color: "#059669" }}>Grade: {callInquiry.class_name_resolved}</div>}
                  </div>
                  {/* Context grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
                    {[
                      { label: "Inquiry Date", value: formatDate(callInquiry.query_date) },
                      { label: "Last Contacted", value: callInquiry.follow_up_date ? formatDate(callInquiry.follow_up_date) : "Never" },
                      { label: "Status", value: callInquiry.status || "new" },
                      { label: "Source", value: callInquiry.source_name || "—" },
                    ].map((item) => (
                      <div key={item.label} style={{ background: "#f8fafc", borderRadius: 8, padding: "8px 12px" }}>
                        <div style={{ fontSize: 10, color: "var(--text-muted)", fontWeight: 600, marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{item.value}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button onClick={() => handleCallPlaced("app")}
                      style={{ flex: 1, height: 42, background: "#059669", border: "none", color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      📱 Call via App
                    </button>
                    <button onClick={() => handleCallPlaced("desk")}
                      style={{ flex: 1, height: 42, background: "#eff6ff", border: "1px solid #bfdbfe", color: "var(--primary, #1d4ed8)", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      ☎️ Landline / Desk Phone
                    </button>
                  </div>
                </div>
              </>
            )}

            {callStep === "coaching" && (
              <>
                <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <Sparkles size={20} />
                    <div>
                      <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>AI Call Coach</h3>
                      <span style={{ fontSize: 11, background: "rgba(255,255,255,.2)", padding: "2px 8px", borderRadius: 99, fontWeight: 600 }}>📞 In Progress…</span>
                    </div>
                  </div>
                  <button onClick={() => { setShowCallModal(false); setCallStep("contact"); }} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
                </div>
                <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                  <p style={{ margin: "0 0 4px", fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>Calling: {callInquiry.full_name} · {callInquiry.phone}</p>
                  {callTips.map((tip, i) => {
                    const tipColors: Record<string, { bg: string; border: string; color: string }> = {
                      goal:      { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" },
                      question:  { bg: "#f0fdf4", border: "#bbf7d0", color: "#047857" },
                      objection: { bg: "#fefce8", border: "#fde68a", color: "#92400e" },
                      insight:   { bg: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" },
                    };
                    const tc = tipColors[tip.type];
                    return (
                      <div key={i} style={{ padding: "8px 12px", background: tc.bg, border: `1px solid ${tc.border}`, borderRadius: 8 }}>
                        <span style={{ fontSize: 12, color: tc.color, fontWeight: tip.type === "goal" ? 700 : 500 }}>{tip.tip}</span>
                      </div>
                    );
                  })}
                  <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                    <button onClick={() => handleCallOutcome("converted")}
                      style={{ flex: 1, height: 42, background: "#059669", border: "none", color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      🎉 Student Enrolled!
                    </button>
                    <button onClick={() => handleCallOutcome("log")}
                      style={{ flex: 1, height: 42, background: "#eff6ff", border: "1px solid #bfdbfe", color: "var(--primary, #1d4ed8)", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      📝 Log Update
                    </button>
                  </div>
                </div>
              </>
            )}

            {callStep === "converted" && (
              <>
                <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Congratulations! 🎉</h3>
                    <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.9 }}>Student enrolled! Choose next step</p>
                  </div>
                  <button onClick={() => { setShowCallModal(false); setCallStep("contact"); }} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
                </div>
                <div style={{ padding: 20 }}>
                  <p style={{ margin: "0 0 14px", fontSize: 13, color: "var(--text-muted)" }}>Send a WhatsApp message to {callInquiry.full_name}:</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[
                      { key: "fee_structure", icon: "💰", label: "Share Fee Structure" },
                      { key: "school_tour",    icon: "🏫", label: "Book School Tour" },
                      { key: "parent_visit",   icon: "👨‍👩‍👧", label: "Parent Meet Appointment" },
                      { key: "document_collection", icon: "📋", label: "Document Checklist" },
                      { key: "form_filling",   icon: "📝", label: "Enrollment Form" },
                    ].map((opt) => (
                      <button key={opt.key} onClick={() => handleConversionChoice(opt.key)}
                        style={{ height: 44, border: "1px solid var(--line, #e5e7eb)", borderRadius: 10, background: "#f8fafc", color: "var(--text)", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "0 16px", textAlign: "left" }}>
                        <span style={{ fontSize: 18 }}>{opt.icon}</span> {opt.label}
                        <span style={{ marginLeft: "auto", fontSize: 11, color: "#16a34a", fontWeight: 700 }}>Send via WA →</span>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── WhatsApp Flow Modal ── */}
      {showWAModal && waInquiry && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(540px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#15803d,#16a34a)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <MessageSquare size={20} />
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>AI WhatsApp Composer</h3>
                  <p style={{ margin: "2px 0 0", fontSize: 11, opacity: 0.9 }}>To: {waInquiry.full_name} · {waInquiry.phone}</p>
                </div>
              </div>
              <button onClick={() => setShowWAModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Template selector */}
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Choose a template:</p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {waMessages.map((msg, i) => (
                  <button key={i} onClick={() => { setWASelected(i); setWAEdited(msg); }}
                    style={{ textAlign: "left", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${waSelected === i ? "#16a34a" : "var(--line, #e5e7eb)"}`, background: waSelected === i ? "#f0fdf4" : "#fff", cursor: "pointer", fontSize: 12, color: "var(--text)" }}>
                    <span style={{ fontWeight: 700, color: waSelected === i ? "#15803d" : "var(--text-muted)" }}>Template {i + 1}</span>
                    <span style={{ color: "var(--text-muted)", marginLeft: 6 }}>{msg.slice(0, 100)}…</span>
                  </button>
                ))}
              </div>
              {/* Editable textarea */}
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Edit message:</label>
              <textarea value={waEdited} onChange={(e) => setWAEdited(e.target.value)}
                style={{ width: "100%", minHeight: 180, border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical" as const, boxSizing: "border-box" as const }} />
              <p style={{ margin: "6px 0 16px", fontSize: 11, color: "var(--text-muted)" }}>Recipient: +91 {waInquiry.phone}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => void copyWAMessage()}
                  style={{ height: 40, padding: "0 16px", border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, background: waCopied ? "#f0fdf4" : "#fff", color: waCopied ? "#059669" : "var(--text)", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>
                  {waCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {waCopied ? "Copied!" : "📋 Copy"}
                </button>
                <button onClick={sendWADirect}
                  style={{ flex: 1, height: 40, background: "#16a34a", border: "none", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
                  💬 Open WhatsApp →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── New/Edit Admission Modal (3-step wizard) ── */}
      {showAdmissionModal && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(600px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            {/* Header */}
            <div style={{ padding: "16px 20px", background: "var(--primary, #1d4ed8)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editingId ? "Edit Inquiry" : "New Admission Inquiry"}</h2>
                <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.85 }}>{editingId ? "Update details below" : "Fill in the details to add a new inquiry"}</p>
              </div>
              <button onClick={() => setShowAdmissionModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
            </div>
            {/* Step indicator */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid var(--line, #e5e7eb)", flexShrink: 0 }}>
              {[{ label: "Parent/Guardian" }, { label: "Child Details" }, { label: "Preferences" }].map((step, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: i <= admissionSection ? "var(--primary, #1d4ed8)" : "#fff", color: i <= admissionSection ? "#fff" : "var(--text-muted, #6b7280)", border: i <= admissionSection ? "2px solid var(--primary, #1d4ed8)" : "2px solid #d1d5db" }}>
                      {i + 1}
                    </div>
                    <span style={{ fontSize: 10, fontWeight: i === admissionSection ? 700 : 500, color: i <= admissionSection ? "var(--primary, #1d4ed8)" : "var(--text-muted, #6b7280)", whiteSpace: "nowrap" }}>{step.label}</span>
                  </div>
                  {i < 2 && <div style={{ width: 40, height: 2, background: i < admissionSection ? "var(--primary, #1d4ed8)" : "#d1d5db", margin: "0 8px", marginBottom: 18 }} />}
                </div>
              ))}
            </div>
            {/* Form */}
            <form onSubmit={submitDrawer} style={{ flex: 1, overflowY: "auto", padding: 20 }}>
              {/* STEP 0: Parent/Guardian */}
              {admissionSection === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PopField label="Parent / Guardian Full Name *" error={drawerErrors.full_name}>
                    <input value={drawerForm.full_name} onChange={(e) => setDf("full_name", e.target.value)} style={inp(Boolean(drawerErrors.full_name))} placeholder="e.g. Rahul Sharma" />
                  </PopField>
                  <PopField label="Relationship">
                    <select value={drawerForm.relationship} onChange={(e) => setDf("relationship", e.target.value)} style={inp()}>
                      <option value="">Select</option>
                      <option value="Father">Father</option>
                      <option value="Mother">Mother</option>
                      <option value="Guardian">Guardian</option>
                      <option value="Other">Other</option>
                    </select>
                  </PopField>
                  <PopField label="Mobile Number *" error={drawerErrors.phone}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ width: 48, height: 36, border: "1px solid var(--line)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0, background: "#f8fafc" }}>+91</span>
                      <input value={drawerForm.phone} onChange={(e) => setDf("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} style={{ ...inp(Boolean(drawerErrors.phone)), flex: 1 }} placeholder="9876543210" inputMode="numeric" />
                    </div>
                  </PopField>
                  <PopField label="Alternate Number">
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ width: 48, height: 36, border: "1px solid var(--line)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0, background: "#f8fafc" }}>+91</span>
                      <input value={drawerForm.alternate_phone} onChange={(e) => setDf("alternate_phone", e.target.value.replace(/\D/g, "").slice(0, 10))} style={{ ...inp(), flex: 1 }} placeholder="Optional" inputMode="numeric" />
                    </div>
                  </PopField>
                  <PopField label="Email">
                    <input value={drawerForm.email} onChange={(e) => setDf("email", e.target.value)} style={inp()} placeholder="parent@example.com" type="email" />
                  </PopField>
                  <PopField label="Home Area / Locality">
                    <input value={drawerForm.home_area} onChange={(e) => setDf("home_area", e.target.value)} style={inp()} placeholder="e.g. Koramangala, Bangalore" />
                  </PopField>
                </div>
              )}
              {/* STEP 1: Child Details */}
              {admissionSection === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PopField label="Child's Full Name">
                    <input value={drawerForm.child_name} onChange={(e) => setDf("child_name", e.target.value)} style={inp()} placeholder="Child's full name" />
                  </PopField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <PopField label="Date of Birth">
                      <input value={drawerForm.child_dob} onChange={(e) => setDf("child_dob", e.target.value)} style={inp()} type="date" />
                    </PopField>
                    <PopField label="Gender">
                      <select value={drawerForm.child_gender} onChange={(e) => setDf("child_gender", e.target.value)} style={inp()}>
                        <option value="">Select</option>
                        <option value="Boy">Boy</option>
                        <option value="Girl">Girl</option>
                        <option value="Prefer not to say">Prefer not to say</option>
                      </select>
                    </PopField>
                  </div>
                  <PopField label="Grade Applying For">
                    <select value={drawerForm.school_class} onChange={(e) => setDf("school_class", e.target.value)} style={inp()}>
                      <option value="">Select Grade</option>
                      {classes.map((c) => {
                        const cnt = inquiries.filter((i) => i.school_class === c.id).length;
                        return <option key={c.id} value={c.id}>{c.name}{cnt > 0 ? ` (${cnt} inquir${cnt !== 1 ? "ies" : "y"})` : ""}</option>;
                      })}
                    </select>
                  </PopField>
                  <PopField label="Previous School">
                    <input value={drawerForm.previous_school} onChange={(e) => setDf("previous_school", e.target.value)} style={inp()} placeholder="Name of previous school" />
                  </PopField>
                  <PopField label="Special Needs / Support">
                    <textarea value={drawerForm.specific_requirements} onChange={(e) => setDf("specific_requirements", e.target.value)} style={{ ...inp(), height: 72, padding: "8px 10px", resize: "vertical" as const }} placeholder="Any special needs or support required…" />
                  </PopField>
                  <PopField label="Sibling already enrolled?">
                    <div style={{ display: "flex", gap: 8 }}>
                      {[{ val: "yes", label: "Yes" }, { val: "no", label: "No" }].map(({ val, label }) => (
                        <button key={val} type="button" onClick={() => setDf("has_sibling_enrolled", drawerForm.has_sibling_enrolled === val ? "" : val)}
                          style={{ height: 36, padding: "0 18px", border: `2px solid ${drawerForm.has_sibling_enrolled === val ? "var(--primary, #1d4ed8)" : "var(--line, #e5e7eb)"}`, borderRadius: 8, background: drawerForm.has_sibling_enrolled === val ? "#eff6ff" : "#fff", color: drawerForm.has_sibling_enrolled === val ? "var(--primary, #1d4ed8)" : "var(--text, #111)", fontWeight: drawerForm.has_sibling_enrolled === val ? 700 : 400, fontSize: 13, cursor: "pointer" }}>
                          {label}
                        </button>
                      ))}
                    </div>
                  </PopField>
                  {drawerForm.has_sibling_enrolled === "yes" && (
                    <div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                        <PopField label="Sibling Name">
                          <input value={drawerForm.sibling_name} onChange={(e) => setDf("sibling_name", e.target.value)} style={inp()} placeholder="Sibling's name" />
                        </PopField>
                        <PopField label="Sibling Class">
                          <input value={drawerForm.sibling_class_name} onChange={(e) => setDf("sibling_class_name", e.target.value)} style={inp()} placeholder="e.g. Grade 5" />
                        </PopField>
                      </div>
                      <div style={{ background: "#fefce8", border: "1px solid #fde047", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#854d0e" }}>
                        ⭐ Sibling discount may apply! Confirm with admin.
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* STEP 2: Preferences & Assignment */}
              {admissionSection === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PopField label="How did you hear about us?" error={drawerErrors.source}>
                    <select value={drawerForm.source} onChange={(e) => setDf("source", e.target.value)} style={inp(Boolean(drawerErrors.source))}>
                      <option value="">Select</option>
                      {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </PopField>
                  {/word of mouth|mouth/i.test(sources.find((s) => String(s.id) === drawerForm.source)?.name || "") && (
                    <PopField label="Referred by (name)">
                      <input value={drawerForm.referred_by} onChange={(e) => setDf("referred_by", e.target.value)} style={inp()} placeholder="Who referred this family?" />
                    </PopField>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <PopField label="Preferred Visit Date">
                      <input value={drawerForm.preferred_visit_date} onChange={(e) => setDf("preferred_visit_date", e.target.value)} style={inp()} type="date" min={new Date(Date.now() + 864e5).toISOString().slice(0, 10)} />
                    </PopField>
                    <PopField label="Preferred Visit Time">
                      <select value={drawerForm.preferred_visit_time} onChange={(e) => setDf("preferred_visit_time", e.target.value)} style={inp()}>
                        <option value="">Select</option>
                        <option value="Morning 9–11 AM">Morning 9–11 AM</option>
                        <option value="Afternoon 1–3 PM">Afternoon 1–3 PM</option>
                        <option value="Evening 4–6 PM">Evening 4–6 PM</option>
                        <option value="Flexible">Flexible</option>
                      </select>
                    </PopField>
                  </div>
                  <PopField label="Parent's Message / Notes">
                    <textarea value={drawerForm.description} onChange={(e) => setDf("description", e.target.value)} style={{ ...inp(), height: 72, padding: "8px 10px", resize: "vertical" as const }} placeholder="Any message from the parent…" />
                  </PopField>
                  <PopField label="Internal Note">
                    <textarea value={drawerForm.note} onChange={(e) => setDf("note", e.target.value)} style={{ ...inp(), height: 60, padding: "8px 10px", resize: "vertical" as const }} placeholder="Internal notes (not shared with parent)…" />
                  </PopField>
                  <PopField label="Assigned Counsellor *" error={drawerErrors.assigned}>
                    <input value={drawerForm.assigned} onChange={(e) => setDf("assigned", e.target.value)} style={inp(Boolean(drawerErrors.assigned))} placeholder="e.g. Mr. Sharma" />
                  </PopField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <PopField label="Query Date *" error={drawerErrors.query_date}>
                      <input value={drawerForm.query_date} onChange={editingId ? (e) => setDf("query_date", e.target.value) : undefined} readOnly={!editingId} style={{ ...inp(Boolean(drawerErrors.query_date)), background: !editingId ? "#f8fafc" : undefined }} type="date" />
                    </PopField>
                    <PopField label="Next Follow-up *" error={drawerErrors.next_follow_up_date}>
                      <input value={drawerForm.next_follow_up_date} onChange={(e) => setDf("next_follow_up_date", e.target.value)} style={inp(Boolean(drawerErrors.next_follow_up_date))} type="date" />
                    </PopField>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <PopField label="Reference *" error={drawerErrors.reference}>
                      <select value={drawerForm.reference} onChange={(e) => setDf("reference", e.target.value)} style={inp(Boolean(drawerErrors.reference))}>
                        <option value="">Select</option>
                        {references.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </PopField>
                    <PopField label="Status">
                      <select value={drawerForm.active_status} onChange={(e) => setDf("active_status", e.target.value as "1" | "2")} style={inp()}>
                        <option value="1">Active</option>
                        <option value="2">Inactive</option>
                      </select>
                    </PopField>
                  </div>
                </div>
              )}

              {/* Navigation footer */}
              <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line, #e5e7eb)", justifyContent: admissionSection === 0 ? "flex-end" : "space-between" }}>
                {admissionSection > 0 && (
                  <button type="button" onClick={() => setAdmissionSection((s) => s - 1)} style={btnGhost}>← Back</button>
                )}
                {admissionSection < 2 && (
                  <button type="button" onClick={() => {
                    if (admissionSection === 0) {
                      const errs: Record<string, string> = {};
                      if (!drawerForm.full_name.trim()) errs.full_name = "Name is required.";
                      else if (!/^[A-Za-z\s\-']+$/.test(drawerForm.full_name)) errs.full_name = "Name can only contain letters.";
                      if (!drawerForm.phone.trim()) errs.phone = "Phone is required.";
                      else if (!/^[6-9]\d{9}$/.test(drawerForm.phone)) errs.phone = "Enter a valid 10-digit Indian mobile number.";
                      if (Object.keys(errs).length > 0) { setDrawerErrors(errs); return; }
                      setDrawerErrors({});
                    }
                    setAdmissionSection((s) => s + 1);
                  }} style={btnPrimary}>Next →</button>
                )}
                {admissionSection === 2 && (
                  <button type="submit" disabled={drawerSaving} style={btnPrimary}>
                    {drawerSaving ? "Saving…" : editingId ? "Update Inquiry" : "Save Inquiry"}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Bulk Action Bar ── */}
      {selectedIds.size > 0 && (
        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, height: 56, background: "#1d4ed8", color: "#fff", display: "flex", alignItems: "center", gap: 12, padding: "0 20px", zIndex: 500, boxShadow: "0 -4px 16px rgba(0,0,0,.2)" }}>
          <Users size={16} />
          <span style={{ fontSize: 13, fontWeight: 700, flexShrink: 0 }}>{selectedIds.size} selected</span>
          <div style={{ width: 1, height: 28, background: "rgba(255,255,255,.3)" }} />

          {/* Assign To */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => { setBulkAssignOpen(v => !v); setBulkStatusOpen(false); setBulkFollowupOpen(false); }}
              style={{ height: 34, padding: "0 12px", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Assign To ▾
            </button>
            {bulkAssignOpen && (
              <div style={{ position: "absolute", bottom: 42, left: 0, background: "#fff", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,.2)", padding: 8, display: "flex", gap: 6, zIndex: 600 }}>
                <input
                  autoFocus
                  value={bulkAssignVal}
                  onChange={e => setBulkAssignVal(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && bulkAssignVal.trim()) { void bulkPatch({ assigned: bulkAssignVal.trim() }); setBulkAssignOpen(false); setBulkAssignVal(""); } }}
                  placeholder="Assignee name, press Enter"
                  style={{ ...inp(), width: 200, color: "#111" }}
                />
              </div>
            )}
          </div>

          {/* Set Status */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => { setBulkStatusOpen(v => !v); setBulkAssignOpen(false); setBulkFollowupOpen(false); }}
              style={{ height: 34, padding: "0 12px", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Set Status ▾
            </button>
            {bulkStatusOpen && (
              <div style={{ position: "absolute", bottom: 42, left: 0, background: "#fff", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,.2)", padding: 8, zIndex: 600, minWidth: 140 }}>
                {STATUS_CHOICES.map(s => (
                  <button key={s.value} onClick={() => { void bulkPatch({ status: s.value }); setBulkStatusOpen(false); }}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 12px", background: "none", border: "none", cursor: "pointer", fontSize: 12, color: "#111", borderRadius: 5 }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#f0f4ff")}
                    onMouseLeave={e => (e.currentTarget.style.background = "none")}>
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Set Follow-up */}
          <div style={{ position: "relative" }}>
            <button
              onClick={() => { setBulkFollowupOpen(v => !v); setBulkAssignOpen(false); setBulkStatusOpen(false); }}
              style={{ height: 34, padding: "0 12px", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
              Set Follow-up 📅
            </button>
            {bulkFollowupOpen && (
              <div style={{ position: "absolute", bottom: 42, left: 0, background: "#fff", borderRadius: 8, boxShadow: "0 4px 20px rgba(0,0,0,.2)", padding: 8, display: "flex", gap: 6, zIndex: 600 }}>
                <input
                  autoFocus
                  type="date"
                  value={bulkFollowupVal}
                  onChange={e => setBulkFollowupVal(e.target.value)}
                  style={{ ...inp(), width: 160, color: "#111" }}
                />
                <button
                  onClick={() => { if (bulkFollowupVal) { void bulkPatch({ next_follow_up_date: bulkFollowupVal }); setBulkFollowupOpen(false); setBulkFollowupVal(""); } }}
                  style={{ height: 36, padding: "0 12px", background: "#1d4ed8", border: "none", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Apply
                </button>
              </div>
            )}
          </div>

          <button
            onClick={() => setSelectedIds(new Set())}
            style={{ marginLeft: "auto", height: 34, padding: "0 12px", background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.3)", borderRadius: 7, color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            <X size={13} /> Clear Selection
          </button>
        </div>
      )}

      {/* ── AI Conversion Tip Panel ── */}
      {showAITip && aiTipForm && (() => {
        const tip = generateAITip(aiTipForm, sources, classes);
        return (
          <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 400, width: 340, background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,.18)", borderLeft: "4px solid var(--primary, #1d4ed8)", animation: "slideIn .35s ease" }}>
            <div style={{ padding: "14px 16px 12px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text, #111)" }}>{tip.headline}</span>
                <button onClick={() => setShowAITip(false)} style={{ background: "none", border: "none", cursor: "pointer", padding: 2, color: "var(--text-muted, #6b7280)", lineHeight: 1, fontSize: 16 }}>✕</button>
              </div>
              <p style={{ margin: "0 0 10px", fontSize: 12, color: "#374151", lineHeight: 1.5 }}>{tip.insight}</p>
              <p style={{ margin: "0 0 4px", fontSize: 11, fontWeight: 600, color: "var(--text, #111)" }}>Suggested first message:</p>
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", fontSize: 11, color: "#1e3a8a", lineHeight: 1.5, marginBottom: 10, whiteSpace: "pre-wrap" }}>{tip.suggestedMsg}</div>
              <button
                onClick={() => { if (aiTipForm.phone) window.open(`https://wa.me/91${aiTipForm.phone}?text=${encodeURIComponent(tip.suggestedMsg)}`, "_blank"); setShowAITip(false); }}
                style={{ width: "100%", height: 34, background: "#16a34a", border: "none", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                📱 Send WhatsApp Now
              </button>
            </div>
          </div>
        );
      })()}

      {/* ── Broadcast Modal ── */}
      {showBroadcastModal && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(520px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>📢 WhatsApp Broadcast Blast</h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, opacity: 0.9 }}>
                  {selectedIds.size > 0
                    ? `Sending to ${selectedIds.size} selected inquiries`
                    : `Sending to ${pipelineRows.filter(i => i.phone).length} active inquiries with phone numbers`}
                </p>
              </div>
              <button onClick={() => setShowBroadcastModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <p style={{ margin: "0 0 8px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)" }}>Quick templates:</p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {[
                  { key: "followup", label: "Follow-up Reminder" },
                  { key: "visit",    label: "Visit Invitation" },
                  { key: "urgency",  label: "Seat Urgency" },
                  { key: "custom",   label: "Custom" },
                ].map(t => (
                  <button key={t.key}
                    onClick={() => setBroadcastMsg(t.key === "custom" ? "" : BROADCAST_TEMPLATES[t.key as keyof typeof BROADCAST_TEMPLATES])}
                    style={{ padding: "4px 12px", borderRadius: 7, border: "1px solid var(--line, #e5e7eb)", background: "#f8fafc", fontSize: 12, cursor: "pointer", color: "var(--text)" }}>
                    {t.label}
                  </button>
                ))}
              </div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Message</label>
              <textarea
                value={broadcastMsg}
                onChange={e => setBroadcastMsg(e.target.value)}
                placeholder="Type your message… use {{name}} for parent's first name"
                style={{ width: "100%", minHeight: 120, border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical" as const, boxSizing: "border-box" as const }}
              />
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, marginBottom: 12 }}>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{broadcastMsg.length} characters</span>
                <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
                  💡 <code>{`{{name}}`}</code> → parent&apos;s first name
                </span>
              </div>
              {broadcastDone > 0 && (
                <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#047857", marginBottom: 12 }}>
                  ✅ Broadcast queued for {broadcastDone} contacts!
                </div>
              )}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  disabled={!broadcastMsg.trim() || broadcastSending}
                  onClick={async () => {
                    const targets = selectedIds.size > 0
                      ? pipelineRows.filter(i => selectedIds.has(i.id) && i.phone)
                      : pipelineRows.filter(i => i.phone);
                    if (targets.length === 0) { toast.error("No contacts with phone numbers found."); return; }
                    setBroadcastSending(true);
                    try {
                      const jobPayload: BulkJobPayload = { action: "send_whatsapp", lead_ids: targets.map(i => i.id), payload: { text: broadcastMsg } };
                      await apiRequestWithRefresh<unknown>("/api/v1/admissions/bulk-jobs/", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(jobPayload),
                      });
                      setBroadcastDone(targets.length);
                      toast.success(`Broadcast queued for ${targets.length} contacts.`, { autoClose: 3000 });
                    } catch {
                      toast.error("Broadcast failed. Please try again.");
                    } finally {
                      setBroadcastSending(false);
                    }
                  }}
                  style={{ ...btnPrimary, flex: 1, justifyContent: "center", opacity: !broadcastMsg.trim() || broadcastSending ? 0.6 : 1 }}>
                  {broadcastSending ? "Sending…" : `📤 Send to All ${(selectedIds.size > 0 ? pipelineRows.filter(i => selectedIds.has(i.id) && i.phone) : pipelineRows.filter(i => i.phone)).length} Contacts`}
                </button>
                <button onClick={() => setShowBroadcastModal(false)} style={btnGhost}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Document Checklist Modal ── */}
      {showDocModal && docInquiry && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(480px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>📋 Document Checklist</h3>
                <p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.9 }}>{docInquiry.full_name}</p>
              </div>
              <button onClick={() => setShowDocModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              {/* Progress bar */}
              {(() => {
                const received = REQUIRED_DOCS.filter(d => docStatuses[d.key] === "received").length;
                const pct = Math.round((received / REQUIRED_DOCS.length) * 100);
                return (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text)" }}>{received} of {REQUIRED_DOCS.length} documents received</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: pct === 100 ? "#059669" : "#d97706" }}>{pct}%</span>
                    </div>
                    <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#059669" : "#d97706", borderRadius: 3, transition: "width .3s" }} />
                    </div>
                  </div>
                );
              })()}

              {/* Doc rows */}
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {REQUIRED_DOCS.map(doc => {
                  const status = docStatuses[doc.key] || "not_requested";
                  const nextStatus = status === "not_requested" ? "requested" : status === "requested" ? "received" : "not_requested";
                  const statusConfig: Record<string, { icon: string; label: string; color: string; bg: string; border: string }> = {
                    not_requested: { icon: "○", label: "Not Requested", color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" },
                    requested:     { icon: "●", label: "Requested",     color: "#d97706", bg: "#fef3c7", border: "#fde68a" },
                    received:      { icon: "✓", label: "Received",      color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" },
                  };
                  const cfg = statusConfig[status];
                  return (
                    <div key={doc.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: cfg.bg, borderRadius: 8, border: `1px solid ${cfg.border}` }}>
                      <span style={{ fontSize: 16, color: cfg.color, flexShrink: 0, width: 20, textAlign: "center" as const }}>{cfg.icon}</span>
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, color: "var(--text)" }}>{doc.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 700, color: cfg.color, padding: "1px 8px", borderRadius: 99, background: "rgba(255,255,255,.7)" }}>{cfg.label}</span>
                      <button
                        onClick={() => setDocStatuses(prev => ({ ...prev, [doc.key]: nextStatus }))}
                        style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--line, #e5e7eb)", background: "#fff", cursor: "pointer", color: "var(--text)", whiteSpace: "nowrap" as const }}>
                        → Next
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button
                  onClick={() => { const all: Record<string, string> = {}; REQUIRED_DOCS.forEach(d => { all[d.key] = "received"; }); setDocStatuses(all); }}
                  style={{ ...btnGhost, flex: "1 1 auto" }}>
                  <FileCheck size={13} /> Mark All Received
                </button>
                {docInquiry.phone && (
                  <button
                    onClick={() => {
                      const pending = REQUIRED_DOCS.filter(d => docStatuses[d.key] !== "received").map(d => d.label);
                      if (pending.length === 0) { toast.success("All documents already received!"); return; }
                      const msg = `Hi! 👋 A reminder for your admission at our school.\n\nPending documents:\n${pending.map(p => `• ${p}`).join("\n")}\n\nPlease submit at your earliest convenience.\n\nAdmissions Team`;
                      window.open(`https://wa.me/91${docInquiry.phone}?text=${encodeURIComponent(msg)}`, "_blank");
                    }}
                    style={{ ...btnGhost, flex: "1 1 auto", borderColor: "#86efac", color: "#16a34a" }}>
                    💬 WA Reminder
                  </button>
                )}
                <button onClick={() => setShowDocModal(false)} style={btnGhost}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Responsive CSS ── */}
      <style jsx>{`
        .acc-grid {
          display: grid;
          grid-template-columns: 280px 1fr 280px;
          gap: 14px;
          align-items: start;
        }
        @media (max-width: 1100px) {
          .acc-grid {
            grid-template-columns: 1fr 1fr;
          }
          .acc-grid > :nth-child(2) {
            grid-column: 1 / -1;
            order: -1;
          }
        }
        @media (max-width: 700px) {
          .acc-grid {
            grid-template-columns: 1fr;
          }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse-dot {
          0%, 100% { opacity: .4; }
          50% { opacity: 1; }
        }
        @keyframes fade-in {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: none; }
        }
      `}</style>
    </div>
  );
}

/* ── name → avatar color helper ── */
function nameColor(name: string) {
  const colors = ['#3b82f6','#8b5cf6','#ec4899','#14b8a6','#f59e0b','#ef4444','#10b981','#6366f1'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xff;
  return colors[hash % colors.length];
}

/* ── helper sub-component ── */
function PopField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text,#111)", marginBottom: 4 }}>{label}</label>
      {children}
      {error && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#dc2626" }}>{error}</p>}
    </div>
  );
}

const DrawerField = PopField;
