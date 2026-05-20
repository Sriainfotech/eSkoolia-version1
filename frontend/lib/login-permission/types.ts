export type Role = string;
export type StatusFilter = 'all' | 'active' | 'inactive' | 'new';
export type BulkAction = 'enable' | 'disable' | 'reset';
export type CredentialAction = 'reset_temp' | 'set_initial';

export interface RoleOption {
  id: string;
  name: string;
  isStudent: boolean;
}

export interface ClassOption {
  id: string;
  name: string;
}

export interface SectionOption {
  id: string;
  name: string;
  classId: string;
}

export interface MetaResult {
  roles: RoleOption[];
  classes: ClassOption[];
  sections: SectionOption[];
}

export interface LPUser {
  id: string;
  staffId: string;
  name: string;
  role: string;
  email: string;
  loginAccess: boolean;
  lastLogin: string | null;
  mustChange: boolean;
}

export interface RoleCounts {
  total: number;
  active: number;
  disabled: number;
}

export interface PageResult {
  results: LPUser[];
  page: number;
  pageSize: number;
  totalPages: number;
  filteredCount: number;
  counts: RoleCounts;
}

export interface ListParams {
  role: Role;
  page: number;
  pageSize: number;
  search?: string;
  status?: StatusFilter;
  /** Students only — class ID from the DB (e.g. "10") */
  classFilter?: string;
  /** Students only — section ID from the DB (e.g. "20") */
  sectionFilter?: string;
}

export interface BulkPayload {
  role: Role;
  allMatching: boolean;
  ids?: string[];
  search?: string;
  status?: StatusFilter;
  login_access?: boolean;
}

export interface BulkTarget {
  allMatching: boolean;
  ids: string[];
  search: string;
  status: StatusFilter;
  filteredCount: number;
}

export interface CredentialResult {
  ok: boolean;
  passwordBackup: string;
  message: string;
}

export interface ToastItem {
  id: string;
  type: 'success' | 'error';
  message: string;
}
