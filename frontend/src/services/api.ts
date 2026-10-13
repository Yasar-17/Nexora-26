import axios from 'axios';

// Pre-configured Axios instance for backend integration
// In dev: defaults to http://localhost:8000
// In production (Vercel multi-service): defaults to '' (same origin, handled by Vercel rewrites)
const defaultBaseUrl = import.meta.env.DEV ? 'http://localhost:8000' : '';

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? defaultBaseUrl,
  timeout: 60000,
});

// Attach Bearer token if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
