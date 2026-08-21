import { FLAT_INDEX } from '@/lib/routes';

export type Intent =
  | { kind: 'navigate'; path: string; label: string }
  | { kind: 'phone-lookup'; phone: string }
  | { kind: 'report-absence'; query: string }
  | { kind: 'report-bus'; query: string }
  | { kind: 'report-lunch'; query: string }
  | { kind: 'report-emergency'; query: string }
  | { kind: 'enquiry-lookup'; query: string }
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

/**
 * Parse a free-text bot query into a typed intent.
 *
 * Student/attendance/fees lookups and parent FAQ answers are NOT handled
 * here anymore — 'fuzzy-pages' is the catch-all signal for "none of the
 * intents below matched"; components/AIBot.tsx tries the manifest-driven
 * IntentResolver and then the FAQProvider before falling back to actual
 * page search. See lib/bot/ for that generic, module-agnostic layer.
 *
 * Priority: phone → call-log reporting → exact page match → planner task
 * → compose message → enquiry lookup → fuzzy fallback (resolver/FAQ/pages)
 */
export function parseIntent(q: string): Intent {
  const norm = q.toLowerCase().trim();

  // 0. Phone number — detect before anything else
  //    Accepts: 9876543210 | +91 9876543210 | +919876543210 | 91 9876543210
  const phoneMatch = q.trim().match(/^(?:\+91[-\s]?|91[-\s]?)?([6-9]\d{9})$/);
  if (phoneMatch) {
    return { kind: 'phone-lookup', phone: phoneMatch[1] };
  }

  // 0.5. Call-log reporting intents — explicit "report/mark" verbs or clear triggers.
  //      Absence is also handled by the attendance manifest's mark-absent
  //      action (lib/bot/manifests/attendance.ts) when the query already
  //      names a student; this trigger is the fallback that launches the
  //      richer multi-step AbsenceFlow UI when it doesn't.
  if (/\b(report\s+abs[e]?nce|mark\s+abs[e]?nt|child\s+is\s+(sick|ill|unwell)|child\s+(won'?t|cannot|can'?t)\s+(come|attend)|not\s+coming\s+today|sick\s+today|home\s+sick|calling\s+.*abs[e]?nt|abs[e]?nt\s+today)\b/i.test(norm)) {
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
  //    Admissions is not one of the pilot manifests yet — stays a direct
  //    intent for now (see lib/bot/manifestLoader.ts's TODO list).
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

  // 5. Fall through — components/AIBot.tsx tries the manifest resolver,
  //    then the FAQ provider, before treating this as a page search.
  return { kind: 'fuzzy-pages', query: norm };
}
