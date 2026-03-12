import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login    from './pages/Login';
import Register from './pages/Register';
import './styles.css';

import DesktopLayout from './layouts/DesktopLayout';
import MobileLayout  from './mobile/MobileLayout';

function useWindowSize() {
  const [size, setSize] = useState([window.innerWidth, window.innerHeight]);
  useEffect(() => {
    const handleResize = () => setSize([window.innerWidth, window.innerHeight]);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  return size;
}

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading full-page">Loading…</div>;
  return user ? children : <Navigate to="/login" replace/>;
}

export default function App() {
  const [width] = useWindowSize();
  const isMobile = width < 768;

  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login/>}/>
          <Route path="/register" element={<Register/>}/>
          <Route path="/*" element={
            <Protected>
              {isMobile ? <MobileLayout/> : <DesktopLayout/>}
            </Protected>
          }/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
