/**
 * Super Admin Dashboard API Client
 * 
 * Handles all API calls related to the super admin dashboard.
 */

import { DashboardData } from '@/types/super-admin';
import { apiRequestWithRefresh } from '@/lib/api-auth';

/**
 * Fetch dashboard data with all KPIs and metrics
 */
export async function getDashboard(): Promise<DashboardData> {
  try {
    return await apiRequestWithRefresh<DashboardData>('/api/super-admin/dashboard/');
  } catch (error) {
    console.error('Error fetching dashboard:', error);
    throw error;
  }
}

/**
 * Get dashboard data with caching and error handling
 * Can be used with React Query or similar
 */
export async function getDashboardWithFallback(): Promise<DashboardData> {
  try {
    return await getDashboard();
  } catch (error) {
    // Return mock/fallback data during development
    console.warn('Using fallback dashboard data');
    return {
      totalSchools: 0,
      activeSchools: 0,
      totalStudents: 0,
      totalStaff: 0,
      mrr: {
        current: 0,
        previous: 0,
        trend: 0,
      },
      alertCount: 0,
      boardBreakdown: [],
      trends: {
        students: 0,
        mrr: 0,
      },
      recentEvents: [],
    };
  }
}
