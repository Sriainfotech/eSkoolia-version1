import axios from 'axios';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token =
      localStorage.getItem('access_token') ||
      localStorage.getItem('token') ||
      sessionStorage.getItem('access_token');
    if (token) {
      config.headers = config.headers || {};
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401 && typeof window !== 'undefined') {
      console.warn('[competitions/api] 401 Unauthorized');
    }
    return Promise.reject(err);
  }
);

export default api;

export const competitionsApi = {
  listCompetitions: () => api.get('/competitions/competitions/').then((r) => r.data),
  createCompetition: (payload) => api.post('/competitions/competitions/', payload).then((r) => r.data),

  bulkCreateResults: (payload) =>
    api.post('/competitions/results/bulk/', payload).then((r) => r.data),

  generateReviews: (items) =>
    api.post('/competitions/ai/review/', { items }).then((r) => r.data),
};
