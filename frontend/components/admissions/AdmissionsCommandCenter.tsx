"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ToastContainer, toast } from "react-toastify";
import { X, RefreshCw, Plus, Search, Send, Phone, MessageSquare, FileCheck, Copy, CheckCircle2, Sparkles, BarChart2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { ApiInquiry, ApiSchoolClass, ApiAdminSetup, ApiList, ClassConfig, DrawerForm, LogForm, MorningBriefData, StageTab } from "@/types/admissions";
import { MorningBrief } from "./command-center/MorningBrief";
import { ClassPortfolioGrid } from "./command-center/ClassPortfolioGrid";
import { ClassWorkspace } from "./command-center/ClassWorkspace";
import AIMessageComposer from "./AIMessageComposer";

function listData<T>(value: ApiList<T> | undefined | null): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : value.results ?? [];
}

function formatDate(value?: string | null) {
  if (!value) return "-";
  const d = new Date(`${value}T00:00:00`);
  if (Number.isNaN(d.getTime())) return value;
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function initialDrawerForm(today: string): DrawerForm {
  const tomorrow = new Date(new Date(today + "T00:00:00").getTime() + 864e5).toISOString().slice(0, 10);
  return { full_name: "", phone: "", email: "", school_class: "", no_of_child: "1", source: "", reference: "", query_date: today, next_follow_up_date: today, assigned: "", description: "", active_status: "1", note: "", child_name: "", child_dob: "", child_gender: "", parent_occupation: "", previous_school: "", reason_for_change: "", budget_range: "", preferred_contact_time: "", sibling_count: "0", specific_requirements: "", relationship: "", alternate_phone: "", home_area: "", has_sibling_enrolled: "", sibling_name: "", sibling_class_name: "", referred_by: "", preferred_visit_date: tomorrow, preferred_visit_time: "" };
}

type ParentType = "difficult" | "busy" | "fee_sensitive" | "faq_heavy" | "standard";

function detectParentType(note: string | null | undefined): ParentType {
  const n = (note || "").toLowerCase();
  if (/rude|angry|upset|complain|threaten|difficult|aggressive|shout/.test(n)) return "difficult";
  if (/busy|no time|call back|call me later|not now|tied up|in a meeting/.test(n)) return "busy";
  if (/fee|expensive|costly|afford|budget|price|cheap|discount|scholarship/.test(n)) return "fee_sensitive";
  const qCount = (n.match(/\?/g) || []).length;
  if (qCount >= 2 || /curriculum|syllabus|ratio|extracurricular|how many|what about|is there/.test(n)) return "faq_heavy";
  return "standard";
}

function generateCallScript(inq: ApiInquiry) {
  const grade = inq.class_name_resolved || "the grade";
  const first = inq.full_name.split(" ")[0] || "the parent";
  const parentType = detectParentType(inq.note);

  if (parentType === "difficult") {
    return [
      { tip: `[Goal] De-escalate first — do NOT push enrollment on this call`, type: "goal" as const },
      { tip: `[Opener] "Hello ${first}, I'm calling personally to address your concerns."`, type: "insight" as const },
      { tip: `[Listen] Let them speak fully without interruption — say "I understand" and "That's valid."`, type: "insight" as const },
      { tip: `[Empathy] "I completely understand your frustration. Let me personally ensure this is resolved."`, type: "question" as const },
      { tip: `[Offer] Offer a direct callback with the Head of Admissions within 24 hours`, type: "objection" as const },
      { tip: `[Close] "Can I schedule a call with our Admissions Head tomorrow at a time that suits you?"`, type: "goal" as const },
    ];
  }

  if (parentType === "busy") {
    return [
      { tip: `[Goal] Land a visit commitment in under 60 seconds — no small talk`, type: "goal" as const },
      { tip: `[Opener] "Hi ${first}, just 30 seconds — I know you're busy. We have a seat opening in ${grade}."`, type: "insight" as const },
      { tip: `[Pitch] One sentence: "Top faculty, strong results, safe campus — your child deserves this."`, type: "insight" as const },
      { tip: `[Ask] "Can we do a 20-minute visit this Saturday? I'll keep it brief and to the point."`, type: "question" as const },
      { tip: `[If no] "I'll WhatsApp you a 1-minute video tour. What time is best to send it?"`, type: "objection" as const },
      { tip: `[After call] Text them immediately to confirm the slot before they forget`, type: "goal" as const },
    ];
  }

  if (parentType === "fee_sensitive") {
    return [
      { tip: `[Goal] Reframe value before touching numbers — never lead with fees`, type: "goal" as const },
      { tip: `[Opener] "Hello ${first}, before we talk fees — let me share what makes us truly worth it."`, type: "insight" as const },
      { tip: `[Value] Highlight outcomes: board results, alumni success, co-curricular achievements`, type: "insight" as const },
      { tip: `[Flex] "We have quarterly payment options and limited merit scholarships available."`, type: "question" as const },
      { tip: `[Compare] "Many parents find fees comparable to private tuition + school separately."`, type: "objection" as const },
      { tip: `[Close] Invite for campus visit: "Come see the facilities — the investment will make sense."`, type: "goal" as const },
    ];
  }

  if (parentType === "faq_heavy") {
    return [
      { tip: `[Goal] Don't answer questions one-by-one — invite to an open Q&A visit instead`, type: "goal" as const },
      { tip: `[Opener] "Hello ${first}, you've asked some great questions. Let me do better — invite you to our open house."`, type: "insight" as const },
      { tip: `[Redirect] "Our Principal and Dept. Heads will answer everything in person with real examples."`, type: "insight" as const },
      { tip: `[Triage] Answer only the 1 most urgent question — defer the rest to the visit`, type: "question" as const },
      { tip: `[Offer] "I'll send our school FAQ brochure now. Let's book a 30-min Q&A visit too."`, type: "objection" as const },
      { tip: `[Close] "When works this week? I'll block time with our Admissions Head personally."`, type: "goal" as const },
    ];
  }

  // Standard script (no strong signal from notes)
  const tips: { tip: string; type: "goal" | "question" | "objection" | "insight" }[] = [
    { tip: `[Goal] Schedule campus visit within 48 hours for ${grade}`, type: "goal" },
  ];
  if (!inq.follow_up_date || inq.status === "new") {
    tips.push({ tip: `[Opener] "Hello! Calling about ${grade} admission. Good time to talk?"`, type: "insight" });
    tips.push({ tip: `[Question] "What made you consider our school for your child?"`, type: "question" });
  } else if (inq.status === "contacted") {
    tips.push({ tip: "[Tip] Reference previous conversation — show continuity.", type: "insight" });
    tips.push({ tip: "[Question] \"What's holding you back from scheduling a campus visit?\"", type: "question" });
  } else if (inq.status === "visited") {
    tips.push({ tip: "[Post-visit] \"How did you find the campus? Any questions on fees?\"", type: "insight" });
  }
  tips.push({ tip: "[Objection] Fees concern: \"We have flexible quarterly payment plans.\"", type: "objection" });
  tips.push({ tip: "[Objection] Distance concern: \"We have transport routes covering most areas.\"", type: "objection" });
  return tips;
}

function generateWhatsAppMessages(inq: ApiInquiry): string[] {
  const firstName = inq.full_name.split(" ")[0] || "there";
  const grade = inq.class_name_resolved ? `Grade ${inq.class_name_resolved}` : "your child's grade";
  return [
    `Hello ${firstName}!\n\nThank you for your inquiry about admission for ${grade}.\n\nWe'd love to give you a personal campus tour.\n\nWould you like to schedule a visit this week?\n\nWarm regards,\nAdmissions Team`,
    `Hi ${firstName}!\n\nFriendly reminder about your admission inquiry for ${grade}.\n\nSeats are filling up fast! Book a visit today.\n\nBest wishes,\nAdmissions Team`,
    `Dear ${firstName},\n\nGreat speaking with you about ${grade} admission!\n\nWe offer:\n- Experienced faculty & modern infrastructure\n- Holistic development programs\n- Safe & supportive environment\n\nAdmissions Team`,
  ];
}

function generateAITip(form: DrawerForm, sources: ApiAdminSetup[], classes: ApiSchoolClass[]) {
  const sourceName = sources.find((s) => String(s.id) === form.source)?.name || "";
  const gradeName = classes.find((c) => String(c.id) === form.school_class)?.name || "";
  const parentFirst = form.full_name.split(" ")[0] || "there";
  let headline = "AI Insight";
  let insight = "Follow up within 24 hours for best conversion rates.";
  if (sourceName.toLowerCase().includes("instagram") || sourceName.toLowerCase().includes("facebook")) {
    headline = "Social Media Lead";
    insight = `Social media leads like ${parentFirst} convert best when contacted within 2 hours.`;
  } else if (sourceName.toLowerCase().includes("word") || sourceName.toLowerCase().includes("mouth")) {
    headline = "Referral Lead - High Intent";
    insight = `${parentFirst} was referred - referral leads convert at 2-3x the rate!`;
  } else if (sourceName.toLowerCase().includes("google")) {
    headline = "Google Search Lead";
    insight = `${parentFirst} was actively searching - respond within 30 minutes.`;
  }
  if (gradeName) insight += ` Grade ${gradeName} has been popular this season.`;
  const visitDate = form.preferred_visit_date ? `on ${form.preferred_visit_date}` : "this week";
  const suggestedMsg = `Hi ${parentFirst}! Thank you for your interest. Can you visit ${visitDate}? We have limited seats for ${gradeName || "the grade"}. - Admissions Team`;
  return { headline, insight, suggestedMsg };
}

function getHealthStatus(enrolled: number, capacity: number, overdueCount: number): ClassConfig["healthStatus"] {
  if (capacity > 0 && enrolled / capacity > 0.9) return "urgent";
  if (overdueCount > 10) return "urgent";
  if (enrolled === 0) return "quiet";
  if (overdueCount > 3) return "active";
  return "healthy";
}

const OUTCOMES = [
  { value: "called_interested",     label: "Called - Interested" },
  { value: "called_no_answer",      label: "Called - No Answer" },
  { value: "called_callback",       label: "Called - Callback Requested" },
  { value: "called_not_interested", label: "Called - Not Interested" },
  { value: "whatsapp_sent",         label: "WhatsApp Sent" },
  { value: "visit_scheduled",       label: "Campus Visit Scheduled" },
  { value: "visit_done",            label: "Campus Visit Done" },
  { value: "documents_collected",   label: "Documents Collected" },
  { value: "enrolled",              label: "Enrolled" },
];

const STAGE_LABELS: Record<string, string> = {
  new: "New", contacted: "In Conversation", visited: "Decision Pending",
  enrolled: "Enrolled", waitlisted: "Waitlist", declined: "Cold / Dropped",
};

const BROADCAST_TEMPLATES = {
  followup: "Hi {{name}}! Following up on your inquiry. When would be a good time to talk? - Admissions Team",
  visit:    "Hi {{name}}! We'd like to invite you for a campus visit. Reply with your preferred date. - Admissions Team",
  urgency:  "Hi {{name}}! Limited seats available. Please confirm your interest soon! - Admissions Team",
};

const REQUIRED_DOCS = [
  { key: "birth_cert",    label: "Birth Certificate" },
  { key: "tc",            label: "Transfer Certificate (TC)" },
  { key: "aadhar",        label: "Aadhar Card Copy" },
  { key: "photos",        label: "Passport Photos (4 copies)" },
  { key: "report_card",   label: "Previous Report Card" },
  { key: "address_proof", label: "Address Proof" },
];

const inp = (err = false): React.CSSProperties => ({ width: "100%", height: 36, border: `1px solid ${err ? "#dc2626" : "var(--line, #e5e7eb)"}`, borderRadius: 8, padding: "0 10px", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" });
const btnPrimary: React.CSSProperties = { height: 36, background: "var(--primary, #4f46e5)", border: "1px solid var(--primary, #4f46e5)", color: "#fff", borderRadius: 8, padding: "0 14px", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 6 };
const btnGhost: React.CSSProperties = { height: 36, background: "transparent", border: "1px solid var(--line, #e5e7eb)", color: "var(--text, #111)", borderRadius: 8, padding: "0 12px", cursor: "pointer", fontSize: 13, display: "flex", alignItems: "center", gap: 6 };
const overlay: React.CSSProperties = { position: "fixed", inset: 0, zIndex: 300, background: "rgba(0,0,0,.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" };

export function AdmissionsCommandCenter() {
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const [inquiries, setInquiries] = useState<ApiInquiry[]>([]);
  const [classes, setClasses] = useState<ApiSchoolClass[]>([]);
  const [sources, setSources] = useState<ApiAdminSetup[]>([]);
  const [references, setReferences] = useState<ApiAdminSetup[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedClassId, setSelectedClassId] = useState<number | null | undefined>(undefined);
  const [forcedStage, setForcedStage] = useState<StageTab | null>(null);

  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [admissionSection, setAdmissionSection] = useState(0);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [drawerForm, setDrawerForm] = useState<DrawerForm>(initialDrawerForm(new Date().toISOString().slice(0, 10)));
  const [drawerErrors, setDrawerErrors] = useState<Record<string, string>>({});
  const [drawerSaving, setDrawerSaving] = useState(false);
  const [quickAddMode, setQuickAddMode] = useState(true);

  const [showLogModal, setShowLogModal] = useState(false);
  const [logInquiry, setLogInquiry] = useState<ApiInquiry | null>(null);
  const [logForm, setLogForm] = useState<LogForm>({ outcome: "", note: "", next_follow_up_date: "", status: "" });
  const [logSaving, setLogSaving] = useState(false);

  const [showCallModal, setShowCallModal] = useState(false);
  const [callInquiry, setCallInquiry] = useState<ApiInquiry | null>(null);
  const [callStep, setCallStep] = useState<"contact" | "coaching" | "converted">("contact");
  const [callTips, setCallTips] = useState<{ tip: string; type: "goal" | "question" | "objection" | "insight" }[]>([]);

  const [showWAModal, setShowWAModal] = useState(false);
  const [waInquiry, setWAInquiry] = useState<ApiInquiry | null>(null);
  const [waMessages, setWAMessages] = useState<string[]>([]);
  const [waSelected, setWASelected] = useState(0);
  const [waEdited, setWAEdited] = useState("");
  const [waCopied, setWACopied] = useState(false);

  const [showBroadcastModal, setShowBroadcastModal] = useState(false);
  const [broadcastMsg, setBroadcastMsg] = useState("");
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [broadcastDone, setBroadcastDone] = useState(0);

  const [showDocModal, setShowDocModal] = useState(false);
  const [docInquiry, setDocInquiry] = useState<ApiInquiry | null>(null);
  const [docStatuses, setDocStatuses] = useState<Record<string, string>>({});

  const [showAITip, setShowAITip] = useState(false);
  const [aiTipForm, setAITipForm] = useState<DrawerForm | null>(null);
  const [globalSearch, setGlobalSearch] = useState("");
  const [showAIComposer, setShowAIComposer] = useState(false);

  const loadAll = async () => {
    setLoading(true); setError("");
    const [sourceResult, refResult, classResult, inquiryResult] = await Promise.allSettled([
      apiRequestWithRefresh<ApiList<ApiAdminSetup>>("/api/v1/admissions/admin-setups/?type=3&page=1&page_size=50"),
      apiRequestWithRefresh<ApiList<ApiAdminSetup>>("/api/v1/admissions/admin-setups/?type=4&page=1&page_size=50"),
      apiRequestWithRefresh<ApiList<ApiSchoolClass>>("/api/v1/core/classes/"),
      apiRequestWithRefresh<ApiList<ApiInquiry>>("/api/v1/admissions/inquiries/?page_size=200"),
    ]);
    if (sourceResult.status === "fulfilled") setSources(listData(sourceResult.value));
    if (refResult.status === "fulfilled") setReferences(listData(refResult.value));
    if (classResult.status === "fulfilled") setClasses(listData(classResult.value));
    if (inquiryResult.status === "fulfilled") {
      setInquiries(listData(inquiryResult.value));
    } else {
      const msg = inquiryResult.reason instanceof Error ? inquiryResult.reason.message : "";
      setError(msg === "401" || msg.toLowerCase().includes("unauthori")
        ? "Session expired. Please refresh or log in again."
        : "Unable to load admissions data. Please check your connection.");
    }
    setLoading(false);
  };

  useEffect(() => { void loadAll(); }, []);

  const stats = useMemo(() => {
    const total    = inquiries.length;
    const enrolled = inquiries.filter((i) => i.status === "enrolled").length;
    const weekAgo  = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
    const newThisWeek = inquiries.filter((i) => i.query_date && i.query_date >= weekAgo).length;
    const overdue  = inquiries.filter((i) => i.active_status === 1 && i.next_follow_up_date && i.next_follow_up_date < today).length;
    return { total, enrolled, newThisWeek, overdue };
  }, [inquiries, today]);

  const briefData: MorningBriefData = useMemo(() => ({
    newToday:         inquiries.filter((i) => i.query_date === today).length,
    overdueFollowUp:  inquiries.filter((i) => i.active_status === 1 && i.next_follow_up_date && i.next_follow_up_date < today).length,
    visitsToday:      inquiries.filter((i) => i.active_status === 1 && i.next_follow_up_date === today).length,
    decisionsPending: inquiries.filter((i) => i.status === "visited" && i.active_status === 1).length,
  }), [inquiries, today]);

  const classConfigs: ClassConfig[] = useMemo(() => classes.map((cls) => {
    const ci = inquiries.filter((i) => i.school_class === cls.id);
    const enrolledCount = ci.filter((i) => i.status === "enrolled").length;
    const pipelineCount = ci.filter((i) => i.active_status === 1).length;
    const overdueCount  = ci.filter((i) => i.active_status === 1 && i.next_follow_up_date && i.next_follow_up_date < today).length;
    const sections = cls.sections ?? [];
    const capacity = sections.length > 0 ? sections.reduce((s, sec) => s + (sec.capacity ?? 0), 0) : 30;
    return { id: cls.id, name: cls.name, sections, capacity, enrolledCount, pipelineCount, overdueCount, healthStatus: getHealthStatus(enrolledCount, capacity, overdueCount) };
  }), [classes, inquiries, today]);

  const showWorkspace = selectedClassId !== undefined;

  /** One-liner that tells the counsellor where to focus — derived purely from existing data, zero API cost */
  const priorityText = useMemo(() => {
    const { overdueFollowUp, newToday, visitsToday, decisionsPending } = briefData;
    if (overdueFollowUp > 0 && visitsToday > 0)
      return `${overdueFollowUp} follow-up${overdueFollowUp > 1 ? "s" : ""} overdue · ${visitsToday} visit${visitsToday > 1 ? "s" : ""} scheduled today — start with overdue.`;
    if (overdueFollowUp > 5)
      return `${overdueFollowUp} follow-ups are overdue — clear these before taking new inquiries.`;
    if (overdueFollowUp > 0)
      return `${overdueFollowUp} follow-up${overdueFollowUp > 1 ? "s" : ""} overdue — reach out before end of day.`;
    if (visitsToday > 0)
      return `${visitsToday} campus visit${visitsToday > 1 ? "s" : ""} today — confirm time slots and prepare welcome kits.`;
    if (decisionsPending > 0)
      return `${decisionsPending} application${decisionsPending > 1 ? "s" : ""} awaiting a decision — follow up to close.`;
    if (newToday > 0)
      return `${newToday} new inquiry${newToday > 1 ? "s" : ""} today — respond within 30 minutes for best conversion.`;
    return "All clear — great time to proactively reach out to cold leads.";
  }, [briefData]);

  const openNewAdmission = () => {
    setEditingId(null); setDrawerForm(initialDrawerForm(today)); setDrawerErrors({}); setAdmissionSection(0); setQuickAddMode(true); setShowAdmissionModal(true);
  };

  const openEditAdmission = (inq: ApiInquiry) => {
    setEditingId(inq.id);
    setDrawerForm({
      full_name: inq.full_name || "", phone: inq.phone || "", email: inq.email || "",
      school_class: inq.school_class ? String(inq.school_class) : "",
      no_of_child: String(inq.no_of_child || 1), source: inq.source ? String(inq.source) : "",
      reference: inq.reference ? String(inq.reference) : "", query_date: inq.query_date || today,
      next_follow_up_date: inq.next_follow_up_date || today, assigned: inq.assigned || "",
      description: inq.description || "", active_status: String(inq.active_status) === "2" ? "2" : "1",
      note: inq.note || "", child_name: "", child_dob: "", child_gender: "", parent_occupation: "",
      previous_school: "", reason_for_change: "", budget_range: "", preferred_contact_time: "",
      sibling_count: "0", specific_requirements: "", relationship: "", alternate_phone: "",
      home_area: "", has_sibling_enrolled: "", sibling_name: "", sibling_class_name: "",
      referred_by: "", preferred_visit_date: new Date(Date.now() + 864e5).toISOString().slice(0, 10), preferred_visit_time: "",
    });
    setDrawerErrors({}); setAdmissionSection(0); setShowAdmissionModal(true);
  };

  const setDf = (key: keyof DrawerForm, val: string) => setDrawerForm((prev) => ({ ...prev, [key]: val }));

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
      full_name: drawerForm.full_name.trim(), phone: drawerForm.phone.trim(), email: drawerForm.email.trim(),
      description: combinedDescription, query_date: drawerForm.query_date,
      next_follow_up_date: drawerForm.next_follow_up_date, assigned: drawerForm.assigned.trim(),
      reference: Number(drawerForm.reference), source: Number(drawerForm.source),
      school_class: drawerForm.school_class ? Number(drawerForm.school_class) : null,
      no_of_child: Number(drawerForm.no_of_child), active_status: Number(drawerForm.active_status),
      note: drawerForm.note.trim(),
    };
    try {
      setDrawerSaving(true);
      if (editingId) {
        await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${editingId}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("Inquiry updated.", { autoClose: 3000 });
      } else {
        await apiRequestWithRefresh("/api/v1/admissions/inquiries/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        toast.success("New inquiry added.", { autoClose: 3000 });
        setAITipForm({ ...drawerForm }); setShowAITip(true);
      }
      setShowAdmissionModal(false); void loadAll();
    } catch { toast.error(editingId ? "Unable to update inquiry." : "Unable to create inquiry.", { autoClose: 5000 }); }
    finally { setDrawerSaving(false); }
  };

  const openLogModal = (inq: ApiInquiry) => {
    const nextDate = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    setLogInquiry(inq); setLogForm({ outcome: "", note: "", next_follow_up_date: nextDate, status: inq.status || "contacted" }); setShowLogModal(true);
  };

  const submitLog = async () => {
    if (!logInquiry) return;
    if (!logForm.outcome) { toast.error("Please select an outcome."); return; }
    const outcomeLabel = OUTCOMES.find((o) => o.value === logForm.outcome)?.label || logForm.outcome;
    const timestamp = new Date().toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" });
    const logEntry = `[${timestamp}] ${outcomeLabel}${logForm.note ? ": " + logForm.note : ""}`;
    const updatedNote = logInquiry.note ? `${logInquiry.note}\n${logEntry}` : logEntry;
    const newStatus = logForm.outcome === "enrolled" ? "enrolled" : logForm.outcome === "called_not_interested" ? "declined" : logForm.outcome === "visit_done" || logForm.outcome === "visit_scheduled" ? "visited" : logForm.outcome.startsWith("called_") || logForm.outcome === "whatsapp_sent" ? "contacted" : logForm.status;
    try {
      setLogSaving(true);
      await apiRequestWithRefresh(`/api/v1/admissions/inquiries/${logInquiry.id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: updatedNote, follow_up_date: today, next_follow_up_date: logForm.next_follow_up_date, status: newStatus, active_status: newStatus === "enrolled" || newStatus === "declined" ? 2 : 1 }) });
      toast.success("Contact logged!", { autoClose: 2500 }); setShowLogModal(false); void loadAll();
    } catch { toast.error("Failed to log contact. Please try again."); }
    finally { setLogSaving(false); }
  };

  const openCallModal = (inq: ApiInquiry) => { setCallInquiry(inq); setCallStep("contact"); setCallTips(generateCallScript(inq)); setShowCallModal(true); };
  const handleCallPlaced = (method: "app" | "desk") => { if (method === "app" && callInquiry?.phone) window.location.href = `tel:${callInquiry.phone}`; setCallStep("coaching"); };
  const handleCallOutcome = (outcome: "converted" | "log") => {
    if (outcome === "converted") {
      setCallStep("converted");
      if (callInquiry) apiRequestWithRefresh(`/api/v1/admissions/inquiries/${callInquiry.id}/`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "enrolled", active_status: 2, follow_up_date: today }) }).then(() => { toast.success("Enrolled!", { autoClose: 3000 }); void loadAll(); }).catch(() => {});
    } else { setShowCallModal(false); setCallStep("contact"); if (callInquiry) openLogModal(callInquiry); }
  };
  const handleConversionChoice = (choiceKey: string) => {
    if (!callInquiry) return;
    const msgMap: Record<string, string> = {
      fee_structure: `Dear ${callInquiry.full_name.split(" ")[0]},\n\nCongratulations on your admission!\n\nFee structure: [Fee details to be shared]\n\nPayment modes: Online / DD / Challan\n\nAdmissions Team`,
      school_tour: `Dear ${callInquiry.full_name.split(" ")[0]},\n\nWelcome to our school family!\n\nTours available Mon-Fri 9AM-12PM, Sat 9AM-11AM.\n\nPlease reply with your preferred date!\n\nAdmissions Team`,
      parent_visit: `Dear ${callInquiry.full_name.split(" ")[0]},\n\nThank you for choosing us!\n\nMeetings: Weekdays 10AM-4PM, Sat 10AM-12PM.\n\nPlease confirm your preferred time!\n\nAdmissions Team`,
      document_collection: `Dear ${callInquiry.full_name.split(" ")[0]},\n\nDocuments needed:\n- Birth certificate\n- Previous school TC\n- Report card (last 2 years)\n- 4 passport photos\n- Aadhar card copy\n\nAdmissions Team`,
      form_filling: `Dear ${callInquiry.full_name.split(" ")[0]},\n\nPlease fill the official enrollment form.\n\nOur team will guide you. Contact us to schedule.\n\nAdmissions Team`,
    };
    if (callInquiry.phone && msgMap[choiceKey]) window.open(`https://wa.me/91${callInquiry.phone}?text=${encodeURIComponent(msgMap[choiceKey])}`, "_blank");
    setShowCallModal(false); setCallStep("contact");
  };

  const openWAModal = (inq: ApiInquiry) => {
    if (!inq.phone) { toast.error("No phone number available."); return; }
    const msgs = generateWhatsAppMessages(inq);
    setWAInquiry(inq); setWAMessages(msgs); setWASelected(0); setWAEdited(msgs[0]); setWACopied(false); setShowWAModal(true);
  };
  const copyWAMessage = async () => {
    try { await navigator.clipboard.writeText(waEdited); setWACopied(true); setTimeout(() => setWACopied(false), 2000); toast.success("Message copied!", { autoClose: 1500 }); }
    catch { toast.error("Copy failed. Select and copy manually."); }
  };
  const sendWADirect = () => {
    if (!waInquiry?.phone) return;
    window.open(`https://wa.me/91${waInquiry.phone}?text=${encodeURIComponent(waEdited)}`, "_blank");
    setShowWAModal(false);
    const nextDate = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
    setLogInquiry(waInquiry); setLogForm({ outcome: "whatsapp_sent", note: "WhatsApp sent via Command Center", next_follow_up_date: nextDate, status: "contacted" }); setShowLogModal(true);
  };

  return (
    <div style={{ fontFamily: "inherit" }}>
      <ToastContainer position="top-right" newestOnTop />
      {error && (<div className="mx-4 mt-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2">{error}<button onClick={() => void loadAll()} className="ml-2 underline">Retry</button></div>)}
      <div className="p-4 md:p-6">
        {loading ? (
          <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-6 space-y-4">
            {[1, 2, 3].map((i) => (<div key={i} className="animate-pulse"><div className="h-6 bg-gray-100 rounded-lg w-48 mb-3" /><div className="grid grid-cols-4 gap-3">{[1,2,3,4].map((j) => <div key={j} className="h-20 bg-gray-50 rounded-xl" />)}</div></div>))}
          </div>
        ) : (
          <div className="rounded-2xl shadow-sm border border-gray-100 bg-white p-6 space-y-1">

            {/* Page title + actions row */}
            <div className="flex flex-wrap items-center gap-3 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <BarChart2 size={18} className="text-indigo-500" />
                <h1 className="text-xl font-bold text-gray-900">
                  Admissions{" "}<em className="text-indigo-500 not-italic font-light">Command Center</em>
                </h1>
                <span className="flex items-center gap-1 text-xs text-green-600 font-medium ml-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />Live
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <span className="text-xs bg-gray-100 text-gray-700 px-2.5 py-1 rounded-full font-medium">Total: {stats.total}</span>
                {stats.overdue > 0 && <span className="text-xs bg-red-50 text-red-700 border border-red-200 px-2.5 py-1 rounded-full font-semibold">{stats.overdue} Overdue</span>}
                <span className="text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-medium">{stats.newThisWeek} this week</span>
                {stats.enrolled > 0 && <span className="text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">{stats.enrolled} enrolled</span>}
              </div>
              <div className="flex gap-2 items-center ml-auto flex-wrap">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input value={globalSearch} onChange={(e) => setGlobalSearch(e.target.value)} placeholder="Search name, phone..." className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg w-44 focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
                <button onClick={() => void loadAll()} title="Refresh" className="border border-gray-200 rounded-lg p-2 text-gray-400 hover:text-gray-700 transition-colors"><RefreshCw size={14} /></button>
                <button onClick={() => { setBroadcastMsg(""); setBroadcastDone(0); setShowBroadcastModal(true); }} className="flex items-center gap-1.5 border border-indigo-200 bg-indigo-50 text-indigo-700 rounded-lg px-3 py-1.5 text-sm hover:bg-indigo-100 transition-colors"><Send size={12} /> Broadcast</button>
                <button onClick={openNewAdmission} className="flex items-center gap-1.5 bg-indigo-600 text-white rounded-lg px-4 py-1.5 text-sm font-semibold shadow-sm hover:bg-indigo-700 transition-colors"><Plus size={13} /> New Admission</button>
              </div>
            </div>

            <MorningBrief data={briefData} onCardClick={(stage: StageTab) => {
              // Show all-classes workspace and jump to the relevant stage
              setSelectedClassId(null);
              setForcedStage(stage);
              // Reset forcedStage after one tick so next manual tab click works normally
              setTimeout(() => setForcedStage(null), 200);
            }} isLoading={loading} priorityText={priorityText} />
            <div className="border-t border-gray-100 my-1" />
            <ClassPortfolioGrid classes={classConfigs} selectedClassId={selectedClassId ?? null} onSelectClass={(id) => setSelectedClassId(id)} onClassesUpdated={() => void loadAll()} isLoading={loading} />
            <AnimatePresence>
              {showWorkspace && (<><div className="border-t border-gray-100 my-1" />
                <ClassWorkspace
                  selectedClassId={selectedClassId ?? null}
                  classes={classes}
                  allInquiries={globalSearch ? inquiries.filter((i) => i.full_name.toLowerCase().includes(globalSearch.toLowerCase()) || i.phone.includes(globalSearch)) : inquiries}
                  today={today}
                  onOpenLog={openLogModal}
                  onOpenCall={openCallModal}
                  onOpenWA={openWAModal}
                  onEdit={openEditAdmission}
                  onNewInquiry={openNewAdmission}
                  onReload={() => void loadAll()}
                  forcedStage={forcedStage}
                  classConfig={selectedClassId != null ? classConfigs.find((c) => c.id === selectedClassId) : undefined}
                />
              </>)}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* LOG MODAL */}
      {showLogModal && logInquiry && (
        <div style={{ position: "fixed", inset: 0, zIndex: 300, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,.5)" }} onClick={() => setShowLogModal(false)} />
          <div style={{ position: "relative", width: "min(460px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.25)", overflow: "hidden" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", background: "var(--primary, #4f46e5)", color: "#fff" }}>
              <div><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Log Contact Update</h3><p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.85 }}>{logInquiry.full_name}</p></div>
              <button onClick={() => setShowLogModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, display: "flex", color: "#fff" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Outcome *</label>
                <select value={logForm.outcome} onChange={(e) => setLogForm((f) => ({ ...f, outcome: e.target.value }))} style={{ ...inp(), background: "#fff", width: "100%" }}>
                  <option value="">Select outcome...</option>
                  {OUTCOMES.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Note (optional)</label>
                <textarea value={logForm.note} onChange={(e) => setLogForm((f) => ({ ...f, note: e.target.value }))} placeholder="What was discussed?" style={{ ...inp(), height: 72, padding: "8px 10px", resize: "vertical" as const, width: "100%" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, marginBottom: 4 }}>Next Follow-up Date</label>
                <input type="date" value={logForm.next_follow_up_date} onChange={(e) => setLogForm((f) => ({ ...f, next_follow_up_date: e.target.value }))} style={inp()} />
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[{ label: "+1 day", days: 1 }, { label: "+2 days", days: 2 }, { label: "+1 week", days: 7 }, { label: "+2 weeks", days: 14 }].map(({ label, days }) => (
                  <button key={days} onClick={() => setLogForm((f) => ({ ...f, next_follow_up_date: new Date(Date.now() + days * 864e5).toISOString().slice(0, 10) }))} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--line, #e5e7eb)", background: "transparent", cursor: "pointer" }}>{label}</button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, padding: "12px 20px", borderTop: "1px solid var(--line, #e5e7eb)", background: "#f8fafc" }}>
              <button onClick={() => void submitLog()} disabled={logSaving} style={{ ...btnPrimary, flex: 1, justifyContent: "center" }}>{logSaving ? "Saving..." : "Save Log"}</button>
              <button onClick={() => setShowLogModal(false)} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* CALL FLOW MODAL */}
      {showCallModal && callInquiry && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(500px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
            {callStep === "contact" && (<>
              <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Ready to Call</h3><p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.9 }}>Review contact details before dialing</p></div>
                <button onClick={() => setShowCallModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ background: "#f0fdf4", border: "2px solid #10b981", borderRadius: 12, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#065f46" }}>{callInquiry.full_name}</div>
                  <div style={{ fontSize: 14, color: "#047857", fontWeight: 700 }}>Phone: {callInquiry.phone}</div>
                  {callInquiry.class_name_resolved && <div style={{ fontSize: 13, color: "#059669" }}>Grade: {callInquiry.class_name_resolved}</div>}
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={() => handleCallPlaced("app")} style={{ flex: 1, height: 42, background: "#059669", border: "none", color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Call via App</button>
                  <button onClick={() => handleCallPlaced("desk")} style={{ flex: 1, height: 42, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#4f46e5", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Landline / Desk</button>
                </div>
              </div>
            </>)}
            {callStep === "coaching" && (<>
              <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#6d28d9,#7c3aed)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}><Sparkles size={20} /><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>AI Call Coach</h3></div>
                <button onClick={() => { setShowCallModal(false); setCallStep("contact"); }} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
              </div>
              <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 8 }}>
                {callTips.map((tip, i) => {
                  const tc: Record<string, { bg: string; border: string; color: string }> = { goal: { bg: "#eff6ff", border: "#bfdbfe", color: "#1d4ed8" }, question: { bg: "#f0fdf4", border: "#bbf7d0", color: "#047857" }, objection: { bg: "#fefce8", border: "#fde68a", color: "#92400e" }, insight: { bg: "#f5f3ff", border: "#ddd6fe", color: "#6d28d9" } };
                  const c = tc[tip.type];
                  return <div key={i} style={{ padding: "8px 12px", background: c.bg, border: `1px solid ${c.border}`, borderRadius: 8 }}><span style={{ fontSize: 12, color: c.color }}>{tip.tip}</span></div>;
                })}
                <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
                  <button onClick={() => handleCallOutcome("converted")} style={{ flex: 1, height: 42, background: "#059669", border: "none", color: "#fff", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Student Enrolled!</button>
                  <button onClick={() => handleCallOutcome("log")} style={{ flex: 1, height: 42, background: "#eff6ff", border: "1px solid #bfdbfe", color: "#4f46e5", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>Log Update</button>
                </div>
              </div>
            </>)}
            {callStep === "converted" && (<>
              <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#059669,#10b981)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>Congratulations! Student enrolled!</h3></div>
                <button onClick={() => { setShowCallModal(false); setCallStep("contact"); }} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
              </div>
              <div style={{ padding: 20 }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[{ key: "fee_structure", label: "Share Fee Structure" }, { key: "school_tour", label: "Book School Tour" }, { key: "parent_visit", label: "Parent Meet Appointment" }, { key: "document_collection", label: "Document Checklist" }, { key: "form_filling", label: "Enrollment Form" }].map((opt) => (
                    <button key={opt.key} onClick={() => handleConversionChoice(opt.key)} style={{ height: 44, border: "1px solid var(--line, #e5e7eb)", borderRadius: 10, background: "#f8fafc", fontSize: 13, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 10, padding: "0 16px" }}>
                      {opt.label}<span style={{ marginLeft: "auto", fontSize: 11, color: "#16a34a", fontWeight: 700 }}>Send via WA</span>
                    </button>
                  ))}
                </div>
              </div>
            </>)}
          </div>
        </div>
      )}

      {/* WHATSAPP MODAL */}
      {showWAModal && waInquiry && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(540px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#15803d,#16a34a)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}><MessageSquare size={20} /><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>WhatsApp Composer — {waInquiry.full_name}</h3></div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => { setShowWAModal(false); setShowAIComposer(true); }}
                  title="Let AI draft a personalised message using this lead's full history"
                  style={{ background: "rgba(255,255,255,.15)", border: "1px solid rgba(255,255,255,.4)", cursor: "pointer", borderRadius: 8, padding: "4px 10px", color: "#fff", fontSize: 12, fontWeight: 700, display: "flex", alignItems: "center", gap: 4 }}
                ><Sparkles size={12} /> AI Compose</button>
                <button onClick={() => setShowWAModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
              </div>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
                {waMessages.map((msg, i) => (
                  <button key={i} onClick={() => { setWASelected(i); setWAEdited(msg); }} style={{ textAlign: "left", padding: "8px 12px", borderRadius: 8, border: `1.5px solid ${waSelected === i ? "#16a34a" : "var(--line, #e5e7eb)"}`, background: waSelected === i ? "#f0fdf4" : "#fff", cursor: "pointer", fontSize: 12 }}>
                    <span style={{ fontWeight: 700 }}>Template {i + 1}</span><span style={{ color: "#6b7280", marginLeft: 6 }}>{msg.slice(0, 100)}...</span>
                  </button>
                ))}
              </div>
              <textarea value={waEdited} onChange={(e) => setWAEdited(e.target.value)} style={{ width: "100%", minHeight: 160, border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical" as const, boxSizing: "border-box" as const }} />
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button onClick={() => void copyWAMessage()} style={{ height: 40, padding: "0 16px", border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, background: waCopied ? "#f0fdf4" : "#fff", color: waCopied ? "#059669" : "var(--text)", cursor: "pointer", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 5 }}>{waCopied ? <CheckCircle2 size={14} /> : <Copy size={14} />}{waCopied ? "Copied!" : "Copy"}</button>
                <button onClick={sendWADirect} style={{ flex: 1, height: 40, background: "#16a34a", border: "none", color: "#fff", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>Open WhatsApp</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* AI MESSAGE COMPOSER (T1) — real AI endpoint, auto-logs on send */}
      {showAIComposer && waInquiry && (
        <AIMessageComposer
          lead={waInquiry}
          channel="whatsapp"
          onClose={() => setShowAIComposer(false)}
          onSent={() => {
            setShowAIComposer(false);
            const nextDate = new Date(Date.now() + 2 * 864e5).toISOString().slice(0, 10);
            setLogInquiry(waInquiry);
            setLogForm({ outcome: "whatsapp_sent", note: "AI-composed WhatsApp sent via Command Center", next_follow_up_date: nextDate, status: "contacted" });
            setShowLogModal(true);
          }}
        />
      )}

      {/* ADMISSION FORM MODAL */}
      {showAdmissionModal && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(600px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "92vh", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "16px 20px", background: "var(--primary, #4f46e5)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{editingId ? "Edit Inquiry" : "New Admission Inquiry"}</h2>
                {!editingId && <p style={{ margin: "2px 0 0", fontSize: 11, opacity: 0.8 }}>Quick Add captures in 10 seconds · Full form adds more detail</p>}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {/* Quick Add / Full Form toggle — only for new inquiries */}
                {!editingId && (
                  <div style={{ display: "flex", background: "rgba(255,255,255,.15)", borderRadius: 8, padding: 2 }}>
                    <button
                      type="button"
                      onClick={() => setQuickAddMode(true)}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: quickAddMode ? "#fff" : "transparent", color: quickAddMode ? "var(--primary, #4f46e5)" : "rgba(255,255,255,.85)", transition: "all 0.15s" }}
                    >⚡ Quick</button>
                    <button
                      type="button"
                      onClick={() => { setQuickAddMode(false); setAdmissionSection(0); }}
                      style={{ padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700, background: !quickAddMode ? "#fff" : "transparent", color: !quickAddMode ? "var(--primary, #4f46e5)" : "rgba(255,255,255,.85)", transition: "all 0.15s" }}
                    >📋 Full</button>
                  </div>
                )}
                <button onClick={() => setShowAdmissionModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
              </div>
            </div>

            {/* Full form — 3-step stepper (only when not quickAddMode or editing) */}
            {(!quickAddMode || editingId) && (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 20px", background: "#f8fafc", borderBottom: "1px solid var(--line, #e5e7eb)", flexShrink: 0 }}>
                {[{ label: "Parent/Guardian" }, { label: "Child Details" }, { label: "Preferences" }].map((step, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center" }}>
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700, background: i <= admissionSection ? "var(--primary, #4f46e5)" : "#fff", color: i <= admissionSection ? "#fff" : "#6b7280", border: i <= admissionSection ? "2px solid var(--primary, #4f46e5)" : "2px solid #d1d5db" }}>{i + 1}</div>
                      <span style={{ fontSize: 10, fontWeight: i === admissionSection ? 700 : 500, color: i <= admissionSection ? "var(--primary, #4f46e5)" : "#6b7280", whiteSpace: "nowrap" }}>{step.label}</span>
                    </div>
                    {i < 2 && <div style={{ width: 40, height: 2, background: i < admissionSection ? "var(--primary, #4f46e5)" : "#d1d5db", margin: "0 8px", marginBottom: 18 }} />}
                  </div>
                ))}
              </div>
            )}
            <form onSubmit={(e) => {
              e.preventDefault();
              if (quickAddMode && !editingId) {
                // Quick Add validation: only name + phone + follow-up required
                const errs: Record<string, string> = {};
                if (!drawerForm.full_name.trim()) errs.full_name = "Name is required.";
                else if (!/^[A-Za-z\s\-']+$/.test(drawerForm.full_name)) errs.full_name = "Name can only contain letters.";
                if (!drawerForm.phone.trim()) errs.phone = "Phone is required.";
                else if (!/^[6-9]\d{9}$/.test(drawerForm.phone)) errs.phone = "Enter a valid 10-digit Indian mobile number.";
                if (!drawerForm.next_follow_up_date) errs.next_follow_up_date = "Next follow-up date is required.";
                if (Object.keys(errs).length > 0) { setDrawerErrors(errs); return; }
                // T7: Duplicate phone check against in-memory inquiries (zero API cost)
                const dupPhone = drawerForm.phone.trim();
                const duplicate = inquiries.find((i) => i.phone === dupPhone);
                if (duplicate) {
                  setDrawerErrors({ phone: `Already in system: ${duplicate.full_name} · ${STAGE_LABELS[duplicate.status] ?? duplicate.status}` });
                  return;
                }
                // Auto-fill non-required fields with safe defaults
                const quickForm: DrawerForm = {
                  ...drawerForm,
                  assigned: drawerForm.assigned.trim() || "Unassigned",
                  source: drawerForm.source || (sources[0] ? String(sources[0].id) : ""),
                  reference: drawerForm.reference || (references[0] ? String(references[0].id) : ""),
                };
                const payload = {
                  full_name: quickForm.full_name.trim(),
                  phone: quickForm.phone.trim(),
                  email: quickForm.email.trim(),
                  description: quickForm.description.trim(),
                  query_date: quickForm.query_date,
                  next_follow_up_date: quickForm.next_follow_up_date,
                  assigned: quickForm.assigned,
                  reference: quickForm.reference ? Number(quickForm.reference) : null,
                  source: quickForm.source ? Number(quickForm.source) : null,
                  school_class: quickForm.school_class ? Number(quickForm.school_class) : null,
                  no_of_child: Number(quickForm.no_of_child) || 1,
                  active_status: 1,
                  note: quickForm.note.trim(),
                };
                setDrawerSaving(true);
                void apiRequestWithRefresh("/api/v1/admissions/inquiries/", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify(payload),
                }).then(() => {
                  toast.success("Inquiry added.", { autoClose: 3000 });
                  setAITipForm({ ...quickForm });
                  setShowAITip(true);
                  setShowAdmissionModal(false);
                  void loadAll();
                }).catch(() => {
                  toast.error("Unable to create inquiry.", { autoClose: 5000 });
                }).finally(() => setDrawerSaving(false));
                return;
              }
              void submitDrawer(e);
            }} style={{ flex: 1, overflowY: "auto", padding: 20 }}>

              {/* ⚡ Quick Add form — 5 essential fields, flat, no wizard */}
              {quickAddMode && !editingId && (
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 10, padding: "10px 14px", fontSize: 12, color: "#1d4ed8" }}>
                    <strong>Quick Add</strong> — capture a lead in seconds. Add more details later from the inquiry page.
                  </div>
                  <PopField label="Parent / Guardian Name *" error={drawerErrors.full_name}>
                    <input value={drawerForm.full_name} onChange={(e) => setDf("full_name", e.target.value)} style={inp(Boolean(drawerErrors.full_name))} placeholder="e.g. Rahul Sharma" autoFocus />
                  </PopField>
                  <PopField label="Mobile Number *" error={drawerErrors.phone}>
                    <div style={{ display: "flex", gap: 6 }}>
                      <span style={{ width: 48, height: 36, border: "1px solid var(--line)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0, background: "#f8fafc" }}>+91</span>
                      <input value={drawerForm.phone} onChange={(e) => setDf("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} style={{ ...inp(Boolean(drawerErrors.phone)), flex: 1 }} placeholder="9876543210" inputMode="numeric" />
                    </div>
                  </PopField>
                  <PopField label="Grade Applying For">
                    <select value={drawerForm.school_class} onChange={(e) => setDf("school_class", e.target.value)} style={inp()}>
                      <option value="">Select Grade</option>
                      {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </PopField>
                  <PopField label="How did they hear about us?">
                    <select value={drawerForm.source} onChange={(e) => setDf("source", e.target.value)} style={inp()}>
                      <option value="">Select Source</option>
                      {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </PopField>
                  <PopField label="Next Follow-up *" error={drawerErrors.next_follow_up_date}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <input value={drawerForm.next_follow_up_date} onChange={(e) => setDf("next_follow_up_date", e.target.value)} style={inp(Boolean(drawerErrors.next_follow_up_date))} type="date" />
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                        {[{ label: "+1 day", days: 1 }, { label: "+2 days", days: 2 }, { label: "+1 week", days: 7 }].map(({ label, days }) => (
                          <button key={days} type="button" onClick={() => setDf("next_follow_up_date", new Date(Date.now() + days * 864e5).toISOString().slice(0, 10))} style={{ fontSize: 11, padding: "3px 9px", borderRadius: 6, border: "1px solid var(--line, #e5e7eb)", background: "transparent", cursor: "pointer" }}>{label}</button>
                        ))}
                      </div>
                    </div>
                  </PopField>
                  <div style={{ display: "flex", gap: 8, marginTop: 4, paddingTop: 16, borderTop: "1px solid var(--line, #e5e7eb)" }}>
                    <button type="submit" disabled={drawerSaving} style={{ ...btnPrimary, flex: 1, justifyContent: "center" }}>
                      {drawerSaving ? "Saving..." : "⚡ Add Inquiry"}
                    </button>
                    <button type="button" onClick={() => setShowAdmissionModal(false)} style={{ ...btnGhost, flex: 1, justifyContent: "center" }}>Cancel</button>
                  </div>
                </div>
              )}

              {/* Full 3-step form (when editing or quickAddMode is off) */}
              {(!quickAddMode || editingId) && <>
              {admissionSection === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PopField label="Parent / Guardian Full Name *" error={drawerErrors.full_name}><input value={drawerForm.full_name} onChange={(e) => setDf("full_name", e.target.value)} style={inp(Boolean(drawerErrors.full_name))} placeholder="e.g. Rahul Sharma" /></PopField>
                  <PopField label="Relationship"><select value={drawerForm.relationship} onChange={(e) => setDf("relationship", e.target.value)} style={inp()}><option value="">Select</option><option>Father</option><option>Mother</option><option>Guardian</option><option>Other</option></select></PopField>
                  <PopField label="Mobile Number *" error={drawerErrors.phone}><div style={{ display: "flex", gap: 6 }}><span style={{ width: 48, height: 36, border: "1px solid var(--line)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 600, flexShrink: 0, background: "#f8fafc" }}>+91</span><input value={drawerForm.phone} onChange={(e) => setDf("phone", e.target.value.replace(/\D/g, "").slice(0, 10))} style={{ ...inp(Boolean(drawerErrors.phone)), flex: 1 }} placeholder="9876543210" inputMode="numeric" /></div></PopField>
                  <PopField label="Email"><input value={drawerForm.email} onChange={(e) => setDf("email", e.target.value)} style={inp()} placeholder="parent@example.com" type="email" /></PopField>
                  <PopField label="Home Area / Locality"><input value={drawerForm.home_area} onChange={(e) => setDf("home_area", e.target.value)} style={inp()} placeholder="e.g. Koramangala" /></PopField>
                </div>
              )}
              {admissionSection === 1 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PopField label="Child's Full Name"><input value={drawerForm.child_name} onChange={(e) => setDf("child_name", e.target.value)} style={inp()} placeholder="Child's full name" /></PopField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <PopField label="Date of Birth"><input value={drawerForm.child_dob} onChange={(e) => setDf("child_dob", e.target.value)} style={inp()} type="date" /></PopField>
                    <PopField label="Gender"><select value={drawerForm.child_gender} onChange={(e) => setDf("child_gender", e.target.value)} style={inp()}><option value="">Select</option><option>Boy</option><option>Girl</option><option>Prefer not to say</option></select></PopField>
                  </div>
                  <PopField label="Grade Applying For"><select value={drawerForm.school_class} onChange={(e) => setDf("school_class", e.target.value)} style={inp()}><option value="">Select Grade</option>{classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></PopField>
                  <PopField label="Previous School"><input value={drawerForm.previous_school} onChange={(e) => setDf("previous_school", e.target.value)} style={inp()} placeholder="Previous school name" /></PopField>
                  <PopField label="Special Needs / Support"><textarea value={drawerForm.specific_requirements} onChange={(e) => setDf("specific_requirements", e.target.value)} style={{ ...inp(), height: 64, padding: "8px 10px", resize: "vertical" as const }} placeholder="Any special needs..." /></PopField>
                </div>
              )}
              {admissionSection === 2 && (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <PopField label="How did you hear about us?" error={drawerErrors.source}><select value={drawerForm.source} onChange={(e) => setDf("source", e.target.value)} style={inp(Boolean(drawerErrors.source))}><option value="">Select</option>{sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></PopField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <PopField label="Preferred Visit Date"><input value={drawerForm.preferred_visit_date} onChange={(e) => setDf("preferred_visit_date", e.target.value)} style={inp()} type="date" /></PopField>
                    <PopField label="Preferred Visit Time"><select value={drawerForm.preferred_visit_time} onChange={(e) => setDf("preferred_visit_time", e.target.value)} style={inp()}><option value="">Select</option><option>Morning 9-11 AM</option><option>Afternoon 1-3 PM</option><option>Evening 4-6 PM</option><option>Flexible</option></select></PopField>
                  </div>
                  <PopField label="Parent's Message / Notes"><textarea value={drawerForm.description} onChange={(e) => setDf("description", e.target.value)} style={{ ...inp(), height: 64, padding: "8px 10px", resize: "vertical" as const }} placeholder="Any message from the parent..." /></PopField>
                  <PopField label="Internal Note"><textarea value={drawerForm.note} onChange={(e) => setDf("note", e.target.value)} style={{ ...inp(), height: 56, padding: "8px 10px", resize: "vertical" as const }} placeholder="Internal notes..." /></PopField>
                  <PopField label="Assigned Counsellor *" error={drawerErrors.assigned}><input value={drawerForm.assigned} onChange={(e) => setDf("assigned", e.target.value)} style={inp(Boolean(drawerErrors.assigned))} placeholder="e.g. Mr. Sharma" /></PopField>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <PopField label="Query Date *" error={drawerErrors.query_date}><input value={drawerForm.query_date} onChange={editingId ? (e) => setDf("query_date", e.target.value) : undefined} readOnly={!editingId} style={{ ...inp(Boolean(drawerErrors.query_date)), background: !editingId ? "#f8fafc" : undefined }} type="date" /></PopField>
                    <PopField label="Next Follow-up *" error={drawerErrors.next_follow_up_date}><input value={drawerForm.next_follow_up_date} onChange={(e) => setDf("next_follow_up_date", e.target.value)} style={inp(Boolean(drawerErrors.next_follow_up_date))} type="date" /></PopField>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <PopField label="Reference *" error={drawerErrors.reference}><select value={drawerForm.reference} onChange={(e) => setDf("reference", e.target.value)} style={inp(Boolean(drawerErrors.reference))}><option value="">Select</option>{references.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select></PopField>
                    <PopField label="Status"><select value={drawerForm.active_status} onChange={(e) => setDf("active_status", e.target.value as "1" | "2")} style={inp()}><option value="1">Active</option><option value="2">Inactive</option></select></PopField>
                  </div>
                </div>
              )}
              <div style={{ display: "flex", gap: 8, marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--line, #e5e7eb)", justifyContent: admissionSection === 0 ? "flex-end" : "space-between" }}>
                {admissionSection > 0 && <button type="button" onClick={() => setAdmissionSection((s) => s - 1)} style={btnGhost}>Back</button>}
                {admissionSection < 2 && <button type="button" onClick={() => { if (admissionSection === 0) { const errs: Record<string, string> = {}; if (!drawerForm.full_name.trim()) errs.full_name = "Required"; if (!drawerForm.phone.trim() || !/^[6-9]\d{9}$/.test(drawerForm.phone)) errs.phone = "Invalid phone"; if (Object.keys(errs).length > 0) { setDrawerErrors(errs); return; } setDrawerErrors({}); } setAdmissionSection((s) => s + 1); }} style={btnPrimary}>Next</button>}
                {admissionSection === 2 && <button type="submit" disabled={drawerSaving} style={btnPrimary}>{drawerSaving ? "Saving..." : editingId ? "Update" : "Save"}</button>}
              </div>
              </>}
            </form>
          </div>
        </div>
      )}

      {/* AI TIP */}
      {showAITip && aiTipForm && (() => {
        const tip = generateAITip(aiTipForm, sources, classes);
        return (
          <div style={{ position: "fixed", bottom: 24, right: 24, zIndex: 400, width: 320, background: "#fff", borderRadius: 14, boxShadow: "0 8px 32px rgba(0,0,0,.18)", borderLeft: "4px solid var(--primary, #4f46e5)" }}>
            <div style={{ padding: "12px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{tip.headline}</span>
                <button onClick={() => setShowAITip(false)} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 16 }}>x</button>
              </div>
              <p style={{ margin: "0 0 8px", fontSize: 12, lineHeight: 1.5 }}>{tip.insight}</p>
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", fontSize: 11, lineHeight: 1.5, marginBottom: 8, whiteSpace: "pre-wrap" }}>{tip.suggestedMsg}</div>
              <button onClick={() => { if (aiTipForm.phone) window.open(`https://wa.me/91${aiTipForm.phone}?text=${encodeURIComponent(tip.suggestedMsg)}`, "_blank"); setShowAITip(false); }} style={{ width: "100%", height: 32, background: "#16a34a", border: "none", color: "#fff", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Send WhatsApp</button>
            </div>
          </div>
        );
      })()}

      {/* BROADCAST MODAL */}
      {showBroadcastModal && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(520px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#4f46e5,#0ea5e9)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>WhatsApp Broadcast</h3><p style={{ margin: "3px 0 0", fontSize: 12, opacity: 0.9 }}>{inquiries.filter((i) => i.active_status === 1 && i.phone).length} active contacts</p></div>
              <button onClick={() => setShowBroadcastModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 14 }}>
                {[{ key: "followup", label: "Follow-up" }, { key: "visit", label: "Visit Invite" }, { key: "urgency", label: "Seat Urgency" }, { key: "custom", label: "Custom" }].map(t => (
                  <button key={t.key} onClick={() => setBroadcastMsg(t.key === "custom" ? "" : BROADCAST_TEMPLATES[t.key as keyof typeof BROADCAST_TEMPLATES])} style={{ padding: "4px 12px", borderRadius: 7, border: "1px solid var(--line, #e5e7eb)", background: "#f8fafc", fontSize: 12, cursor: "pointer" }}>{t.label}</button>
                ))}
              </div>
              <textarea value={broadcastMsg} onChange={e => setBroadcastMsg(e.target.value)} placeholder="Your message... use {{name}} for parent's name" style={{ width: "100%", minHeight: 120, border: "1px solid var(--line, #e5e7eb)", borderRadius: 8, padding: "10px 12px", fontSize: 13, fontFamily: "inherit", resize: "vertical" as const, boxSizing: "border-box" as const }} />
              {broadcastDone > 0 && <div style={{ padding: "8px 12px", background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, fontSize: 12, color: "#047857", margin: "8px 0" }}>Broadcast queued for {broadcastDone} contacts!</div>}
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                <button disabled={!broadcastMsg.trim() || broadcastSending} onClick={async () => { const targets = inquiries.filter((i) => i.active_status === 1 && i.phone); setBroadcastSending(true); try { await apiRequestWithRefresh<unknown>("/api/v1/admissions/bulk-jobs/", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "send_whatsapp", lead_ids: targets.map(i => i.id), payload: { text: broadcastMsg } }) }); setBroadcastDone(targets.length); toast.success("Broadcast queued!"); } catch { toast.error("Broadcast failed."); } finally { setBroadcastSending(false); } }} style={{ ...btnPrimary, flex: 1, justifyContent: "center" }}>{broadcastSending ? "Sending..." : `Send to All ${inquiries.filter(i => i.active_status === 1 && i.phone).length}`}</button>
                <button onClick={() => setShowBroadcastModal(false)} style={btnGhost}>Cancel</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENT MODAL */}
      {showDocModal && docInquiry && (
        <div style={overlay}>
          <div style={{ position: "relative", width: "min(480px, 100%)", background: "#fff", borderRadius: 16, boxShadow: "0 20px 60px rgba(0,0,0,.3)", overflow: "hidden", maxHeight: "92vh", overflowY: "auto" }}>
            <div style={{ padding: "16px 20px", background: "linear-gradient(135deg,#7c3aed,#6d28d9)", color: "#fff", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div><h3 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Document Checklist</h3><p style={{ margin: "2px 0 0", fontSize: 12, opacity: 0.9 }}>{docInquiry.full_name}</p></div>
              <button onClick={() => setShowDocModal(false)} style={{ background: "rgba(255,255,255,.2)", border: "none", cursor: "pointer", borderRadius: 8, padding: 6, color: "#fff", display: "flex" }}><X size={18} /></button>
            </div>
            <div style={{ padding: 20 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                {REQUIRED_DOCS.map(doc => { const status = docStatuses[doc.key] || "not_requested"; const nextStatus = status === "not_requested" ? "requested" : status === "requested" ? "received" : "not_requested"; const colors = { not_requested: { color: "#6b7280", bg: "#f9fafb", border: "#e5e7eb" }, requested: { color: "#d97706", bg: "#fef3c7", border: "#fde68a" }, received: { color: "#059669", bg: "#f0fdf4", border: "#bbf7d0" } } as const; const cfg = colors[status as keyof typeof colors] || colors.not_requested; return (<div key={doc.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: cfg.bg, borderRadius: 8, border: `1px solid ${cfg.border}` }}><span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{doc.label}</span><span style={{ fontSize: 10, fontWeight: 700, color: cfg.color }}>{status.replace("_", " ")}</span><button onClick={() => setDocStatuses(prev => ({ ...prev, [doc.key]: nextStatus }))} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, border: "1px solid var(--line, #e5e7eb)", background: "#fff", cursor: "pointer" }}>Next</button></div>); })}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button onClick={() => { const all: Record<string, string> = {}; REQUIRED_DOCS.forEach(d => { all[d.key] = "received"; }); setDocStatuses(all); }} style={{ ...btnGhost, flex: "1 1 auto" }}><FileCheck size={13} /> Mark All</button>
                <button onClick={() => setShowDocModal(false)} style={btnGhost}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PopField({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "var(--text,#111)", marginBottom: 4 }}>{label}</label>
      {children}
      {error && <p style={{ margin: "3px 0 0", fontSize: 11, color: "#dc2626" }}>{error}</p>}
    </div>
  );
}
