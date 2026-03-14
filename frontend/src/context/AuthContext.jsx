import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const Ctx = createContext(null);

export function AuthProvider({ children }) {
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Proactively "warm up" the backend to handle potential cold starts
    api.get('/health').catch(() => {});

    if (localStorage.getItem('tjp_token')) {
      api.get('/auth/me').then(r => setUser(r.data.user)).catch(() => localStorage.removeItem('tjp_token')).finally(() => setLoading(false));
    } else setLoading(false);
  }, []);

  const login = async (email, password) => {
    const r = await api.post('/auth/login', { email, password });
    localStorage.setItem('tjp_token', r.data.token);
    setUser(r.data.user);
    return r.data.user;
  };

  const register = async (email, username, password) => {
    const r = await api.post('/auth/register', { email, username, password });
    localStorage.setItem('tjp_token', r.data.token);
    setUser(r.data.user);
    return r.data.user;
  };

  const logout = () => { localStorage.removeItem('tjp_token'); setUser(null); };

  return <Ctx.Provider value={{ user, loading, login, register, logout }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);
