import axios, { AxiosRequestConfig } from 'axios';
import { getAccessToken, getRefreshToken, setAuthTokens } from '@/lib/auth';
import { API_BASE_URL as apiBase } from '@/lib/api';

async function refreshAccessToken(): Promise<string> {
  const refresh = getRefreshToken();
  if (!refresh) {
    return '';
  }

  const response = await axios.post(`${apiBase}/api/v1/auth/refresh/`, { refresh });
  const access = response.data?.access || '';
  const nextRefresh = response.data?.refresh || refresh;

  if (access) {
    setAuthTokens(access, nextRefresh);
  }

  return access;
}

export async function chatRequest<T = any>(config: AxiosRequestConfig): Promise<T> {
  const token = getAccessToken();
  const headers = {
    ...(config.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const response = await axios({ ...config, headers });
    return response.data as T;
  } catch (error: any) {
    const status = error?.response?.status;
    if (status !== 401) {
      throw error;
    }

    const refreshed = await refreshAccessToken();
    if (!refreshed) {
      throw error;
    }

    const retryHeaders = {
      ...(config.headers || {}),
      Authorization: `Bearer ${refreshed}`,
    };

    const retried = await axios({ ...config, headers: retryHeaders });
    return retried.data as T;
  }
}
