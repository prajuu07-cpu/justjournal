import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, NavLink, useNavigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login    from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import NewTrade  from './pages/NewTrade';
import Journal   from './pages/Journal';
import { MonthlyReports, YearlyReports } from './pages/Reports';
import MobileNav from './components/MobileNav';
import './mobile.css';

function Protected({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="m-layout"><div className="loading">Loading…</div></div>;
  return user ? children : <Navigate to="/login" replace/>;
}

function MobileLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = () => { logout(); nav('/login'); };

  return (
    <div className="m-layout">
      <header className="m-header">
        <div className="m-header-logo">Trading<span>Journal</span></div>
        <div className="m-header-profile" onClick={doLogout}>
          {user?.username?.[0]?.toUpperCase()}
        </div>
      </header>
      
      <main className="m-content">
        <Routes>
          <Route path="/"          element={<Dashboard/>}/>
          <Route path="/new-trade" element={<NewTrade/>}/>
          <Route path="/journal"   element={<Journal/>}/>
          <Route path="/monthly"   element={<MonthlyReports/>}/>
          <Route path="/yearly"    element={<YearlyReports/>}/>
          <Route path="*"          element={<Navigate to="/" replace/>}/>
        </Routes>
      </main>

      <MobileNav />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login/>}/>
          <Route path="/register" element={<Register/>}/>
          <Route path="/*" element={<Protected><MobileLayout/></Protected>}/>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
