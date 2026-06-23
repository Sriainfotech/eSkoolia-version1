'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  attendanceDashboardService,
  type AttendanceDashboardData,
  type AttendanceDashboardError,
} from '@/lib/services/attendanceDashboardService';

interface UseAttendanceDashboardOptions {
  date?: string;
  autoRefetch?: boolean;
  refetchInterval?: number;
}

interface UseAttendanceDashboardReturn {
  data: AttendanceDashboardData | null;
  loading: boolean;
  error: AttendanceDashboardError | null;
  refetch: () => Promise<void>;
}

export function useAttendanceDashboard(
  options: UseAttendanceDashboardOptions = {}
): UseAttendanceDashboardReturn {
  const { date, autoRefetch = true, refetchInterval = 300000 } = options;

  const [data, setData] = useState<AttendanceDashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<AttendanceDashboardError | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await attendanceDashboardService.fetchDashboardData(date);
      setData(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      setError({
        message: errorMessage,
      });
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    // Initial fetch
    fetchData();

    if (!autoRefetch) return;

    // Set up interval for auto-refetch
    const interval = setInterval(() => {
      fetchData();
    }, refetchInterval);

    // Refetch on window focus
    const handleFocus = () => {
      fetchData();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchData, autoRefetch, refetchInterval]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
  };
}
