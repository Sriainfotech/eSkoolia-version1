import { FLAT_INDEX } from '@/lib/routes';

export const SYN: Record<string, string> = {
  fee: 'fees', pay: 'fees payments', collect: 'fees payments',
  attend: 'attendance', present: 'attendance', absent: 'attendance',
  enroll: 'students list', register: 'students add', 'new student': 'students add',
  visitor: 'visitor book', guest: 'visitor book',
  mark: 'marks register', grade: 'marks',
  bus: 'transport bus tracking', route: 'transport routes',
  staff: 'hr', teacher: 'hr', leave: 'hr leave',
  salary: 'payroll', book: 'library', borrow: 'library issues',
  incident: 'behaviour', complaint: 'admin complaint',
  admission: 'admissions admission-query',
  permission: 'roles', role: 'roles',
};

function normalize(s: string) {
  return s.toLowerCase().trim().replace(/[?.!]+$/, '').replace(/\s+/g, ' ');
}

function strip(s: string) {
  return s.replace(/^(open|go to|goto|show( me)?|take me to|navigate to|find)\s+/i, '').replace(/\s+page$/i, '');
}

export function exactMatch(q: string) {
  const norm = normalize(q);
  const stripped = strip(norm);
  return FLAT_INDEX.find(it =>
    it.label.toLowerCase() === stripped ||
    it.label.toLowerCase() === norm ||
    it.path.toLowerCase() === stripped
  ) ?? null;
}

export function localFuzzySearch(q: string) {
  const norm = normalize(q);
  const stripped = strip(norm);
  let expanded = stripped;
  for (const [k, v] of Object.entries(SYN)) {
    if (stripped.includes(k)) { expanded = expanded.replace(k, v); break; }
  }
  const terms = expanded.split(' ').filter(Boolean);

  return FLAT_INDEX
    .map(it => {
      const label = it.label.toLowerCase();
      const path = it.path.toLowerCase();
      let score = 0;
      for (const t of terms) {
        if (label.includes(t)) score += label.startsWith(t) ? 3 : 2;
        if (path.includes(t)) score += 1;
      }
      return { ...it, score };
    })
    .filter(it => it.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
}
