'use client';

/**
 * inspireHubStore — tiny localStorage-backed CRUD layer.
 * Used as a draft/history store so the module is fully usable WITHOUT a backend
 * being wired yet. Drop-in replaceable with the real backend later.
 *
 *  • saveDraft(comp): merges by id (or assigns new). Returns saved record.
 *  • finalize(comp):  marks status='final' and stamps `finalised_at`.
 *  • remove(id):      deletes.
 *  • list({ status }): all records, newest first.
 *  • aggregates({ year }): computes house/club leaderboards, best-in-category,
 *                          monthly counts — used by the Dashboard tab.
 */

const KEY = 'inspirehub:competitions:v1';

// Normalize a free-text title to "Title Case" so the History list looks even.
// Preserves all-caps acronyms (>=2 letters all caps) and small words.
function titleCase(s) {
  if (!s || typeof s !== 'string') return s;
  const small = new Set(['a','an','and','as','at','but','by','for','in','of','on','or','the','to','vs','via']);
  return s.trim().split(/\s+/).map((w, i) => {
    if (/^[A-Z]{2,}$/.test(w)) return w;          // ACRONYM
    if (i > 0 && small.has(w.toLowerCase())) return w.toLowerCase();
    return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
  }).join(' ');
}

function read() {
  try {
    if (typeof window === 'undefined') return [];
    const raw = window.localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function write(rows) {
  try { window.localStorage.setItem(KEY, JSON.stringify(rows)); } catch {}
}

export const inspireHubStore = {
  list({ status } = {}) {
    const rows = read();
    return rows
      .filter((r) => (status ? r.status === status : true))
      .sort((a, b) => new Date(b.updated_at || b.date || 0) - new Date(a.updated_at || a.date || 0));
  },
  get(id) { return read().find((r) => r.id === id) || null; },
  saveDraft(comp) {
    const rows = read();
    const now = new Date().toISOString();
    const normalised = { ...comp, name: titleCase(comp.name) };
    const idx = rows.findIndex((r) => r.id === comp.id);
    if (idx >= 0) {
      rows[idx] = { ...rows[idx], ...normalised, status: comp.status || rows[idx].status || 'draft', updated_at: now };
    } else {
      rows.unshift({ ...normalised, id: comp.id || ('local-' + Date.now()), status: comp.status || 'draft', created_at: now, updated_at: now });
    }
    write(rows);
    return rows.find((r) => r.id === (comp.id || rows[0].id));
  },
  finalize(comp) {
    const saved = inspireHubStore.saveDraft({ ...comp, status: 'final' });
    const rows = read();
    const idx = rows.findIndex((r) => r.id === saved.id);
    if (idx >= 0) {
      rows[idx].finalised_at = new Date().toISOString();
      write(rows);
      return rows[idx];
    }
    return saved;
  },
  remove(id) {
    write(read().filter((r) => r.id !== id));
  },
  aggregates({ year } = {}) {
    const rows = read().filter((r) => r.status === 'final');
    const inYear = (d) => !year || (new Date(d || 0).getFullYear() === year);
    const events = rows.filter((r) => inYear(r.date));

    const housePoints = {};
    const studentTotals = {};
    const groupTotals = {};
    const recent = [];
    const monthly = Array(12).fill(0);

    events.forEach((c) => {
      const m = new Date(c.date || c.updated_at || 0).getMonth();
      monthly[m] += 1;

      // Aggregate from results
      (c.results || []).forEach((r) => {
        const pts = Number(r.points || 0);
        if (pts <= 0) return;

        // House attribution: prefer explicit house, otherwise the participant's group
        const houseId   = r.house_id || r._student?.house_id || null;
        const houseName = r.house_name || r._student?.house_name || null;
        if (houseId || houseName) {
          const key = houseId || houseName;
          housePoints[key] = housePoints[key] || { id: houseId, name: houseName || 'House', points: 0, wins: 0 };
          housePoints[key].points += pts;
          if (r.position === '1st') housePoints[key].wins += 1;
        }

        // Student
        const sid = r.student_id;
        if (sid) {
          studentTotals[sid] = studentTotals[sid] || { id: sid, name: r._student?.full_name || 'Student', points: 0, wins: 0, class_name: r._student?.class_name };
          studentTotals[sid].points += pts;
          if (r.position === '1st') studentTotals[sid].wins += 1;
        }

        // Group / Club / Team
        const gid = r.group_id || r._student?.club_id || null;
        const gname = r.group_name || r._student?.club_name || null;
        if (gid || gname) {
          const key = gid || gname;
          groupTotals[key] = groupTotals[key] || { id: gid, name: gname || 'Group', points: 0, wins: 0 };
          groupTotals[key].points += pts;
          if (r.position === '1st') groupTotals[key].wins += 1;
        }
      });

      // Recent wins: top results from each event (1st/2nd/3rd)
      (c.results || [])
        .filter((r) => ['1st', '2nd', '3rd'].includes(r.position))
        .forEach((r) => {
          recent.push({
            event: c.name, date: c.date, position: r.position,
            student: r._student?.full_name || 'Student',
            class_name: r._student?.class_name,
            comp_type: c.comp_type,
          });
        });
    });

    const sortByPoints = (a, b) => b.points - a.points || b.wins - a.wins;
    return {
      events,
      eventCount: events.length,
      participantCount: events.reduce((s, c) => s + (c.results || []).length, 0),
      reviewCount: events.reduce((s, c) => s + (c.results || []).filter((r) => r.ai_response).length, 0),
      houses: Object.values(housePoints).sort(sortByPoints),
      students: Object.values(studentTotals).sort(sortByPoints),
      groups: Object.values(groupTotals).sort(sortByPoints),
      recent: recent.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)).slice(0, 8),
      monthly,
    };
  },
};
