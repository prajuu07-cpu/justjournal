import { useState } from 'react';
import { NavLink, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';
import NewTrade  from '../pages/NewTrade';
import Journal   from '../pages/Journal';
import { MonthlyReports, YearlyReports } from '../pages/Reports';
import '../styles/mobile/mobile_fresh.css';

export default function MobileLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen(!open);
  const close = () => setOpen(false);
  const doLogout = () => { logout(); nav('/login'); close(); };

  return (
    <div className={`m-container ${open ? 'm-drawer-open' : ''}`}>
      {/* Scratch Mobile Header */}
      <header className="m-header">
        <button className="m-hamb" onClick={toggle}>
          {open ? '✕' : '☰'}
        </button>
        <div className="m-logo">Trading Journal</div>
        <div style={{width: 40}}></div>
      </header>

      {/* Sidebar Drawer */}
      <div className={`m-overlay ${open ? 'visible' : ''}`} onClick={close}></div>
      <aside className={`m-sidebar ${open ? 'open' : ''}`}>
        <div className="m-sidebar-top">
          <div className="m-logo">TJP Mobile</div>
          <div className="m-user">@{user?.username}</div>
        </div>
        
        <nav className="m-nav">
          <NavLink to="/" end className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Dashboard</NavLink>
          <NavLink to="/new-trade" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>New Trade</NavLink>
          <NavLink to="/journal" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Journal</NavLink>
          <NavLink to="/monthly" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Monthly</NavLink>
          <NavLink to="/yearly" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Yearly</NavLink>
        </nav>

        <div className="m-sidebar-foot">
          <button className="m-logout-btn" onClick={doLogout}>Logout Account</button>
        </div>
      </aside>

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
    </div>
  );
}
