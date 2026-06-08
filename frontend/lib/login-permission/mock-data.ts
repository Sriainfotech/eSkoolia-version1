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

// ── 840 mock students ─────────────────────────────────────────────────────────
export const MOCK_STUDENTS: LPUser[] = (() => {
  const r = seededRng(42);
  return Array.from({ length: 840 }, (_, i) => {
    const first   = FIRST[Math.floor(r() * FIRST.length)];
    const last    = LAST[Math.floor(r() * LAST.length)];
    const grade   = GRADES[Math.floor(r() * GRADES.length)];
    const section = SECTIONS[Math.floor(r() * SECTIONS.length)];
    const loginAccess = r() > 0.18;
    const neverLogged = r() > 0.72;
    const mustChange  = !neverLogged && r() > 0.78;
    const daysAgo     = neverLogged ? null : Math.floor(r() * 180);
    const lastLogin   = daysAgo === null
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

// ── Dev accounts — 2 teachers + 2 parents matched to first 2 students ─────────
// These credentials are shared with the whole dev team.

export interface MockAccount {
  id: string;
  staffId: string;
  username: string;
  password: string;
  name: string;
  email: string;
  roleType: 'teacher' | 'parent';
  roleLabel: string;
}

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    id: 'teacher-3000', staffId: 'TCH-0001',
    username: 'teacher1', password: 'Test@1234',
    name: 'Sanjay Shah', email: 'sanjay.shah@eskoolia.edu',
    roleType: 'teacher', roleLabel: 'Teacher · Mathematics (Science & Maths)',
  },
  {
    id: 'teacher-3001', staffId: 'TCH-0002',
    username: 'teacher2', password: 'Test@1234',
    name: 'Priya Verma', email: 'priya.verma@eskoolia.edu',
    roleType: 'teacher', roleLabel: 'Teacher · English (Languages)',
  },
  {
    // Matches the real DB test user — used for end-to-end teacher portal dev/testing
    id: 'teacher-3002', staffId: 'TCH-0003',
    username: 'test_teacher_priya', password: 'Test@1234',
    name: 'Priya Sharma', email: 'priya.sharma@eskoolia.edu',
    roleType: 'teacher', roleLabel: 'Class Teacher · Grade 5-A | Hindi Gr 4-A/4-B | Maths Gr 3-B',
  },
  {
    id: 'parent-2000', staffId: 'PAR-0001',
    username: 'parent1', password: 'Test@1234',
    name: 'Rajesh Sharma', email: 'rajesh.sharma@gmail.com',
    roleType: 'parent',
    roleLabel: `Parent · ${MOCK_STUDENTS[0].name} (${MOCK_STUDENTS[0].role.replace('Student · ', '')})`,
  },
  {
    id: 'parent-2001', staffId: 'PAR-0002',
    username: 'parent2', password: 'Test@1234',
    name: 'Sunita Patel', email: 'sunita.patel@gmail.com',
    roleType: 'parent',
    roleLabel: `Parent · ${MOCK_STUDENTS[1].name} (${MOCK_STUDENTS[1].role.replace('Student · ', '')})`,
  },
];

function accountToUser(a: MockAccount): LPUser {
  return {
    id: a.id, staffId: a.staffId, name: a.name,
    role: a.roleLabel, email: a.email,
    loginAccess: true, lastLogin: null, mustChange: false,
  };
}

export const MOCK_TEACHERS: LPUser[] = MOCK_ACCOUNTS.filter(a => a.roleType === 'teacher').map(accountToUser);
export const MOCK_PARENTS: LPUser[]  = MOCK_ACCOUNTS.filter(a => a.roleType === 'parent').map(accountToUser);

// ── Mock meta ─────────────────────────────────────────────────────────────────
export const MOCK_META = {
  roles: [
    { id: '1', name: 'Students', isStudent: true },
    { id: '2', name: 'Teachers', isStudent: false },
    { id: '3', name: 'Parents',  isStudent: false },
  ],
  classes:  GRADES.map((g, i) => ({ id: String(i + 1), name: g })),
  sections: SECTIONS.flatMap((s) =>
    GRADES.map((_, gi) => ({ id: `${gi + 1}-${s}`, name: s, classId: String(gi + 1) }))
  ),
};
