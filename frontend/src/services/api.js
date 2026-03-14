import axios from 'axios';

// In dev: Vite proxies /api → http://localhost:5000
// In prod: set VITE_API_URL=https://your-backend.onrender.com/api
const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 60000,
});

api.interceptors.request.use(cfg => {
  const token = localStorage.getItem('tjp_token');
  if (token) cfg.headers.Authorization = `Bearer ${token}`;

  return cfg;
});

api.interceptors.response.use(
  r => r,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('tjp_token');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
