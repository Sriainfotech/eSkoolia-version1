'use client';

import { API_BASE_URL } from '@/lib/api';
import { getAccessToken } from '@/lib/auth';

/**
 * Response from the backend attendance dashboard API
 */
export interface AttendanceDashboardData {
  attendance_percentage: number;
  present: number;
  absent: number;
  leave: number;
  late: number;
  marked_teachers: number;
  total_teachers: number;
  last_updated: string;
  trend: number[];
  pending_classes?: Array<{
    name: string;
    section_id: string;
  }>;
}

export interface AttendanceDashboardError {
  message: string;
  status?: number;
}

class AttendanceDashboardService {
  private cache: Map<string, { data: AttendanceDashboardData; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60000; // 60 seconds

  /**
   * Fetch attendance dashboard data from backend API
   */
  async fetchDashboardData(date?: string): Promise<AttendanceDashboardData> {
    const cacheKey = `dashboard_${date || 'today'}`;

    // Check cache first
    const cached = this.cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    const token = getAccessToken();
    const url = new URL(`${API_BASE_URL}/api/v1/attendance/dashboard/today/`);

    if (date) {
      url.searchParams.append('date', date);
    }

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized. Please login again.');
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json() as AttendanceDashboardData;

      // Validate required fields
      if (
        typeof data.attendance_percentage !== 'number' ||
        typeof data.present !== 'number' ||
        typeof data.absent !== 'number' ||
        typeof data.leave !== 'number' ||
        typeof data.late !== 'number' ||
        typeof data.marked_teachers !== 'number' ||
        typeof data.total_teachers !== 'number' ||
        typeof data.last_updated !== 'string' ||
        !Array.isArray(data.trend)
      ) {
        throw new Error('Invalid response format from server');
      }

      // Cache the data
      this.cache.set(cacheKey, { data, timestamp: Date.now() });

      return data;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch attendance data';
      throw new Error(message);
    }
  }

  /**
   * Clear cache for a specific date or all cache
   */
  clearCache(date?: string): void {
    if (date) {
      this.cache.delete(`dashboard_${date}`);
    } else {
      this.cache.clear();
    }
  }

  /**
   * Prefetch data (useful for optimistic loading)
   */
  async prefetchData(date?: string): Promise<void> {
    try {
      await this.fetchDashboardData(date);
    } catch {
      // Silently fail on prefetch
    }
  }
}

export const attendanceDashboardService = new AttendanceDashboardService();
