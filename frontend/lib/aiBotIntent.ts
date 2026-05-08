import { FLAT_INDEX } from '@/lib/routes';

/** Keywords that indicate a module/page intent rather than a student name */
const MODULE_KEYWORDS = [
  'attendance','fees','exam','result','homework','transport','bus','library',
  'certificate','admission','report','marks','student list','staff','leave',
  'inventory','finance','hr','behaviour','lesson','setup','roles','open','go to',
  'show me','navigate','take me','admin','utilities','communication',
];

export type Intent =
  | { kind: 'navigate'; path: string; label: string }
  | { kind: 'phone-lookup'; phone: string }
  | { kind: 'report-absence'; query: string }
  | { kind: 'report-bus'; query: string }
  | { kind: 'report-lunch'; query: string }
  | { kind: 'report-emergency'; query: string }
  | { kind: 'student-lookup'; query: string }
  | { kind: 'enquiry-lookup'; query: string }
  | { kind: 'parent-qa'; topic: string; raw: string }
  | { kind: 'planner-task'; day: string; time: string; title: string; raw: string }
  | { kind: 'compose-message'; topic: string; raw: string }
  | { kind: 'fuzzy-pages'; query: string };

/** Exact page match against the flat route index */
function exactPageMatch(norm: string) {
  return FLAT_INDEX.find(e => {
    const label = e.label.toLowerCase();
    const synonyms = (e as { synonyms?: string[] }).synonyms ?? [];
    return label === norm
      || label.replace(/\s+/g, '') === norm.replace(/\s+/g, '')
      || synonyms.some((s: string) => s.toLowerCase() === norm);
  }) ?? null;
}

const QA_TOPICS: Array<{ key: string; patterns: RegExp[] }> = [
  { key: 'fees-class',      patterns: [/fee[s]?.*class/i, /how much.*class/i, /fee structure/i, /class.*fee/i] },
  { key: 'holidays',        patterns: [/holida/i, /school.*closed/i, /off day/i, /vacation/i] },
  { key: 'school-timing',   patterns: [/school time/i, /timing/i, /what time.*school/i, /open.*time/i, /close.*time/i] },
  { key: 'transport-route', patterns: [/bus route/i, /which bus/i, /route.*\d/i, /transport for/i] },
  { key: 'admission-process', patterns: [/how to.*admit/i, /admission process/i, /enroll/i, /new student.*admit/i] },
  { key: 'exam-schedule',   patterns: [/exam.*schedule/i, /when.*exam/i, /exam.*date/i, /exam.*when/i, /next exam/i] },
  { key: 'syllabus',        patterns: [/syllabus/i, /curriculum/i, /what.*taught/i, /chapter/i] },
];

function matchParentQATopic(norm: string): string | null {
  for (const t of QA_TOPICS) {
    if (t.patterns.some(p => p.test(norm))) return t.key;
  }
  return null;
}

/**
 * Parse a free-text bot query into a typed intent.
 * Priority: exact page match → planner task → compose message → student lookup → parent Q&A → fuzzy fallback
 */
export function parseIntent(q: string): Intent {
  const norm = q.toLowerCase().trim();

  // 0. Phone number — detect before anything else
  //    Accepts: 9876543210 | +91 9876543210 | +919876543210 | 91 9876543210
  const phoneMatch = q.trim().match(/^(?:\+91[-\s]?|91[-\s]?)?([6-9]\d{9})$/);
  if (phoneMatch) {
    return { kind: 'phone-lookup', phone: phoneMatch[1] };
  }

  // 0.5. Call-log reporting intents — explicit "report/mark" verbs or clear triggers
  //      Must come before module-keyword/student-lookup checks
  if (/\b(report\s+abs[e]?nce|mark\s+abs[e]?nt|child\s+is\s+(sick|ill|unwell)|child\s+(won'?t|cannot|can'?t)\s+(come|attend)|not\s+coming\s+today|sick\s+today|home\s+sick|calling\s+.*abs[e]?nt|abs[e]?nt\s+today)\b/i.test(norm)) {
    // Try to extract a student name from the query
    const nameMatch = norm.match(/\b(?:mark|report)\s+(?:abs[e]?nt\s+)?(.+?)\s+(?:abs[e]?nt|sick|today)\b/i)
      || norm.match(/\b(.+?)\s+(?:is|won'?t|cannot|can'?t)\s+/i);
    const rawName = nameMatch ? nameMatch[1].trim() : '';
    const query = /^(report|mark|child|my|his|her|the)$/i.test(rawName) ? '' : rawName;
    return { kind: 'report-absence', query };
  }

  if (/\bbus\s*(late|delay|breakdown|issue|problem|miss|stuck|not\s+coming|broke)\b|\b(late\s+bus|bus\s+broke|bus\s+is\s+late|bus\s+delay|missed.*bus)\b/i.test(norm)) {
    return { kind: 'report-bus', query: norm };
  }

  if (/\b(forgot\s+(lunch|food|tiffin)|no\s+lunch|lunch\s+(forgot|concern|issue)|dietary\s+restriction|lunch\s+allergy|allergy\s+remind)\b/i.test(norm)) {
    return { kind: 'report-lunch', query: norm };
  }

  if (/\b(emergency\s+pickup|early\s+pickup|pick\s+up\s+early|pickup\s+early|urgent\s+pickup|pick\s+(him|her|child)\s+up\s+early)\b/i.test(norm)) {
    return { kind: 'report-emergency', query: norm };
  }

  // 1. Exact page/module match — navigate immediately
  const exact = exactPageMatch(norm);
  if (exact) return { kind: 'navigate', path: exact.path, label: exact.label };

  // 2. Planner task: "add wednesday 12pm meeting with parents of Anil"
  const plannerMatch = norm.match(
    /^add\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tue|wed|thu|fri|sat|sun)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(.+)/i
  );
  if (plannerMatch) {
    return { kind: 'planner-task', day: plannerMatch[1], time: plannerMatch[2], title: plannerMatch[3], raw: norm };
  }

  // 3. Compose / draft message
  const composeMatch = /^(compose|draft|write|create|generate)\s+(message|msg|reply|note|letter|email|sms|communication)\s+(?:to|for|about)?\s*(.+)/i.exec(norm);
  if (composeMatch) {
    return { kind: 'compose-message', topic: composeMatch[3] || norm, raw: norm };
  }

  // 4. Enquiry lookup: "find enquiry Mehta", "enquiry for Priya", "admission enquiry Arjun"
  //    Must come before student-lookup since "admission" is in MODULE_KEYWORDS
  const hasEnquiryKw = /enquir|inquir/i.test(norm);
  if (hasEnquiryKw) {
    const enquiryQuery = norm
      .replace(/^(find|search|lookup|show|get|look up)\s+/i, '')
      .replace(/admission\s+/i, '')
      .replace(/enquir[y]?\s*(for\s+)?/i, '')
      .replace(/inquir[y]?\s*(for\s+)?/i, '')
      .trim();
    if (enquiryQuery.length >= 2) return { kind: 'enquiry-lookup', query: enquiryQuery };
  }

  // 5. Student lookup: starts with a lookup verb OR looks like a proper name
  //    and doesn't contain module keywords
  const hasModuleKw = MODULE_KEYWORDS.some(k => norm.includes(k));
  const lookupVerb = /^(find|search|lookup|show|who is|get)\s+/i.test(norm);
  const looksLikeName = /^[a-z][\w\s\-']+$/i.test(norm)
    && norm.split(/\s+/).length <= 4
    && !hasModuleKw;

  if (lookupVerb || looksLikeName) {
    const query = norm
      .replace(/^(find|search|lookup|show|who is|get|look up)\s+/i, '')
      .replace(/^student[s]?\s+/i, '')   // remove leading "student(s)"
      .replace(/\s+student[s]?\s*$/i, '') // remove trailing "student(s)"
      .replace(/\s+class\s*\d+\w*/i, '')
      .trim();
    if (query.length >= 2 && !/^student[s]?$/i.test(query)) return { kind: 'student-lookup', query };
    // "find student" with no name → fuzzy fallback so user can type a name
  }

  // 5. Parent Q&A topics
  const qaTopic = matchParentQATopic(norm);
  if (qaTopic) return { kind: 'parent-qa', topic: qaTopic, raw: norm };

  // 6. Fuzzy page search fallback
  return { kind: 'fuzzy-pages', query: norm };
}
