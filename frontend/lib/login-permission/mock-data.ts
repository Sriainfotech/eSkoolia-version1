import type { LPUser } from './types';

// ── Seed arrays ───────────────────────────────────────────────────────────────
const FIRST = [
  'Aarav','Aditi','Ajay','Akash','Amaira','Ananya','Arjun','Aryan',
  'Avni','Deepak','Diya','Farhan','Gaurav','Isha','Kabir','Kavya',
  'Kiara','Krishna','Lakshmi','Manav','Meera','Mihir','Nadia','Nikhil',
  'Nisha','Om','Pallavi','Priya','Raj','Rahul','Riya','Rohan','Sakshi',
  'Sanaya','Sanjay','Sara','Shivani','Shreya','Siddharth','Siya',
  'Sneha','Sonal','Suresh','Tanvi','Tara','Uday','Uma','Varun','Vidya','Vivek',
];
const LAST = [
  'Sharma','Patel','Gupta','Singh','Kumar','Mehta','Joshi','Nair',
  'Reddy','Shah','Kapoor','Malhotra','Iyer','Verma','Agarwal',
  'Mishra','Chopra','Rao','Bose','Das',
];
const GRADES = [
  'Pre-KG','KG',
  'Grade 1','Grade 2','Grade 3','Grade 4','Grade 5',
  'Grade 6','Grade 7','Grade 8','Grade 9','Grade 10',
  'Grade 11','Grade 12',
];
const SECTIONS = ['A', 'B', 'C', 'D'];

// ── Seeded PRNG (mulberry32) ──────────────────────────────────────────────────
function seededRng(seed: number) {
  let s = seed;
  return function () {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Build 840 mock students ───────────────────────────────────────────────────
export const MOCK_STUDENTS: LPUser[] = (() => {
  const r = seededRng(42);
  return Array.from({ length: 840 }, (_, i) => {
    const first  = FIRST[Math.floor(r() * FIRST.length)];
    const last   = LAST[Math.floor(r() * LAST.length)];
    const grade  = GRADES[Math.floor(r() * GRADES.length)];
    const section = SECTIONS[Math.floor(r() * SECTIONS.length)];

    const loginAccess = r() > 0.18;
    const neverLogged = r() > 0.72;
    const mustChange  = !neverLogged && r() > 0.78;
    const daysAgo     = neverLogged ? null : Math.floor(r() * 180);
    const lastLogin   =
      daysAgo === null
        ? null
        : new Date(Date.now() - daysAgo * 86_400_000).toISOString();

    return {
      id:          `student-${1000 + i}`,
      staffId:     `STU-${String(1000 + i).padStart(4, '0')}`,
      name:        `${first} ${last}`,
      role:        `Student · ${grade}-${section}`,
      email:       `${first.toLowerCase()}.${last.toLowerCase()}${i}@eskoolia.edu`,
      loginAccess,
      lastLogin,
      mustChange,
    };
  });
})();
