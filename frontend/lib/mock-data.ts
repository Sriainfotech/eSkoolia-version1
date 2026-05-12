import { AcademicYear, CoreSetupStats, SchoolClass, Subject } from "./types";

// TODO: replace with API call to GET /api/academic-years/
export const MOCK_YEARS: AcademicYear[] = [
  {
    id: "y1",
    name: "2025–2026",
    start: "2025-04-01",
    end: "2026-03-31",
    status: "active",
  },
  {
    id: "y2",
    name: "2026–2027",
    start: "2026-04-01",
    end: "2027-03-31",
    status: "upcoming",
  },
  {
    id: "y3",
    name: "2024–2025",
    start: "2024-04-01",
    end: "2025-03-31",
    status: "archived",
  },
  {
    id: "y4",
    name: "2023–2024",
    start: "2023-04-01",
    end: "2024-03-31",
    status: "archived",
  },
  {
    id: "y5",
    name: "2022–2023",
    start: "2022-04-01",
    end: "2023-03-31",
    status: "archived",
  },
];

// TODO: replace with API call to GET /api/core-setup/stats/
export const MOCK_STATS: CoreSetupStats = {
  years: 5,
  classes: 13,
  sections: 37,
  subjects: 24,
};

// TODO: replace with API call to GET /api/classes/
export const MOCK_CLASSES: SchoolClass[] = [
  { id: "c1", name: "Pre-KG", code: "PKG", sections: ["A", "B"] },
  { id: "c2", name: "KG", code: "KG", sections: ["A", "B", "C"] },
  { id: "c3", name: "Grade 1", code: "G1", sections: ["A", "B", "C"] },
  { id: "c4", name: "Grade 2", code: "G2", sections: ["A", "B", "C"] },
  { id: "c5", name: "Grade 3", code: "G3", sections: ["A", "B"] },
  { id: "c6", name: "Grade 4", code: "G4", sections: [] },
];

// TODO: replace with API call to GET /api/core/subjects/
export const MOCK_SUBJECTS: Subject[] = [
  { id: "s1", name: "Mathematics", code: "MATH", emoji: "🧮", type: "core", isOptional: false, classCount: 6 },
  { id: "s2", name: "English", code: "ENG", emoji: "📖", type: "core", isOptional: false, classCount: 6 },
  { id: "s3", name: "Science", code: "SCI", emoji: "🔬", type: "core", isOptional: false, classCount: 5 },
  { id: "s4", name: "Social Studies", code: "SOC", emoji: "🌍", type: "core", isOptional: false, classCount: 5 },
  { id: "s5", name: "Hindi", code: "HIN", emoji: "💬", type: "language", isOptional: false, classCount: 6 },
  { id: "s6", name: "French", code: "FRE", emoji: "🇫🇷", type: "language", isOptional: true, classCount: 3 },
  { id: "s7", name: "Spanish", code: "SPA", emoji: "🇪🇸", type: "language", isOptional: true, classCount: 2 },
  { id: "s8", name: "Art", code: "ART", emoji: "🎨", type: "elective", isOptional: true, classCount: 4 },
  { id: "s9", name: "Music", code: "MUS", emoji: "🎵", type: "elective", isOptional: true, classCount: 4 },
  { id: "s10", name: "Physical Education", code: "PE", emoji: "⚽", type: "elective", isOptional: false, classCount: 6 },
  { id: "s11", name: "Computer Science", code: "CS", emoji: "💻", type: "elective", isOptional: true, classCount: 3 },
  { id: "s12", name: "Debate Club", code: "DEB", emoji: "🎤", type: "co-curricular", isOptional: true, classCount: 1 },
  { id: "s13", name: "Drama & Theatre", code: "DRA", emoji: "🎭", type: "co-curricular", isOptional: true, classCount: 2 },
  { id: "s14", name: "Chess Club", code: "CHE", emoji: "♟️", type: "co-curricular", isOptional: true, classCount: 1 },
];

export const SUBJECT_COUNT = MOCK_SUBJECTS.length;
