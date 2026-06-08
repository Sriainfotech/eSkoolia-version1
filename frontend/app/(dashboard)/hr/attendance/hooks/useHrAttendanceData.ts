"use client";

import { useState, useCallback, useEffect } from "react";
import { saveStaffAttendanceBulk } from "@/hooks/useHrApi";
import { apiRequestWithRefresh } from "@/lib/api-auth";
import type { Staff, PaginatedHR } from "@/types/hr";

type AttCode = "P" | "A" | "L" | "F" | "H";

export interface StaffMark {
  attendance_type?: AttCode;
  arrival_time?: string | null;
  sign_in_time?: string | null;
  sign_out_time?: string | null;
  lunch?: boolean;
  note?: string;
}

export function useHrAttendanceData(date: string) {
  const [staffByDept, setStaffByDept] = useState<Record<number, Staff[]>>({});
  const [marksByDept, setMarksByDept] = useState<Record<number, Record<number, StaffMark>>>({});
  const [loadingDepts, setLoadingDepts] = useState<Record<number, boolean>>({});

  const loadDepartment = useCallback(async (deptId: number) => {
    // If we've already loaded this department for this date, skip
    if (staffByDept[deptId]) return;
    
    setLoadingDepts(prev => ({ ...prev, [deptId]: true }));
    try {
      // Run both API requests in parallel
      const [staffRes, attRes] = await Promise.all([
        apiRequestWithRefresh<PaginatedHR<Staff>>(`/api/v1/hr/staff/?department=${deptId}&page_size=200&status=active`, { method: "GET" }),
        apiRequestWithRefresh<PaginatedHR<any>>(`/api/v1/hr/staff-attendance/?attendance_date=${date}&department=${deptId}&page_size=500`, { method: "GET" })
      ]);
      
      const staffList = staffRes.results || [];
      const attList = attRes.results || [];

      const marks: Record<number, StaffMark> = {};
      attList.forEach(a => {
        marks[a.staff] = {
          attendance_type: a.attendance_type as AttCode,
          arrival_time: a.arrival_time,
          sign_in_time: a.sign_in_time,
          sign_out_time: a.sign_out_time,
          lunch: a.lunch,
          note: a.note,
        };
      });

      setStaffByDept(prev => ({ ...prev, [deptId]: staffList }));
      setMarksByDept(prev => ({ ...prev, [deptId]: marks }));
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDepts(prev => ({ ...prev, [deptId]: false }));
    }
  }, [date, staffByDept]);

  const updateMark = useCallback((deptId: number, staffId: number, patch: Partial<StaffMark>) => {
    setMarksByDept(prev => {
      const deptMarks = prev[deptId] || {};
      const currentMark = deptMarks[staffId] || {};
      return {
        ...prev,
        [deptId]: {
          ...deptMarks,
          [staffId]: { ...currentMark, ...patch }
        }
      };
    });
  }, []);

  const saveBulk = useCallback(async (rows: any[], onSuccess: () => void, onError: (msg: string) => void) => {
    try {
      await saveStaffAttendanceBulk(rows);
      onSuccess();
    } catch (e: any) {
      onError(e.message || "Failed to save");
    }
  }, []);

  // Clear data when date changes so accordion re-fetches
  useEffect(() => {
    setStaffByDept({});
    setMarksByDept({});
    setLoadingDepts({});
  }, [date]);

  return { staffByDept, marksByDept, loadingDepts, loadDepartment, updateMark, saveBulk };
}
