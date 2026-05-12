export type AcademicYearStatus = "active" | "upcoming" | "archived";
export type SubjectType = "core" | "language" | "elective" | "co-curricular";

export interface AcademicYear {
  id: string;
  name: string;
  start: string; // ISO date string (YYYY-MM-DD)
  end: string;   // ISO date string (YYYY-MM-DD)
  status: AcademicYearStatus;
}

export interface SchoolClass {
  id: string;
  name: string;
  code?: string;
  sections: string[];
}

export interface Subject {
  id: string;
  name: string;
  code: string;
  emoji: string;
  type: SubjectType;
  isOptional: boolean;
  classCount: number;
}

export interface CoreSetupStats {
  years: number;
  classes: number;
  sections: number;
  subjects: number;
}
