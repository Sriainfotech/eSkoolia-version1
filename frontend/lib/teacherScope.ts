/**
 * Turns TeacherMe.subject_assignments (grouped by subject) into the flat
 * (class, section, subject) triplet shape that Homework/LessonPlanner
 * actually key off of — the same shape the backend's own
 * get_subject_scope() produces. Two things lean on this:
 *
 *  1. Cascading class → section → subject selects in the create forms,
 *     so a teacher can only pick combinations they're actually scoped to
 *     (the backend would 403 anything else anyway — this just avoids a
 *     round-trip failure for an option that was never going to work).
 *  2. Resolving display names for Homework rows, whose serializer only
 *     returns raw class_id/section_id/subject_id (no nested names) —
 *     unlike Lesson/LessonPlanner, which do include *_name fields.
 */

import type { SubjectAssignment } from '@/lib/api/teacher';

export interface ScopeTriplet {
  class_id: number;
  class_name: string;
  section_id: number;
  section_name: string;
  subject_id: number;
  subject_name: string;
}

export function flattenScope(subjectAssignments: SubjectAssignment[]): ScopeTriplet[] {
  const rows: ScopeTriplet[] = [];
  for (const subj of subjectAssignments) {
    for (const sec of subj.sections) {
      rows.push({
        class_id: sec.class_id,
        class_name: sec.class_name,
        section_id: sec.section_id,
        section_name: sec.section_name,
        subject_id: subj.subject_id,
        subject_name: subj.subject_name,
      });
    }
  }
  return rows;
}

export interface ResolvedScopeNames {
  class_name: string;
  section_name: string;
  subject_name: string;
}

export function resolveScopeName(
  triplets: ScopeTriplet[],
  classId: number,
  sectionId: number | null,
  subjectId: number,
): ResolvedScopeNames {
  const match = triplets.find(
    (t) => t.class_id === classId && t.section_id === sectionId && t.subject_id === subjectId,
  );
  if (match) return { class_name: match.class_name, section_name: match.section_name, subject_name: match.subject_name };

  // Fall back to a class/subject-only match (section null vs a real section id can
  // legitimately differ between the assignment scope and one specific homework row).
  const classMatch = triplets.find((t) => t.class_id === classId);
  const subjectMatch = triplets.find((t) => t.subject_id === subjectId);
  const sectionMatch = triplets.find((t) => t.section_id === sectionId);
  return {
    class_name: classMatch?.class_name ?? `Class ${classId}`,
    section_name: sectionMatch?.section_name ?? (sectionId ? `Section ${sectionId}` : '—'),
    subject_name: subjectMatch?.subject_name ?? `Subject ${subjectId}`,
  };
}

/** Distinct (class, section) pairs, ordered as they first appear — for tab chips. */
export function distinctClassSections(triplets: ScopeTriplet[]): { class_id: number; class_name: string; section_id: number; section_name: string }[] {
  const seen = new Set<string>();
  const out: { class_id: number; class_name: string; section_id: number; section_name: string }[] = [];
  for (const t of triplets) {
    const key = `${t.class_id}:${t.section_id}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ class_id: t.class_id, class_name: t.class_name, section_id: t.section_id, section_name: t.section_name });
  }
  return out;
}
