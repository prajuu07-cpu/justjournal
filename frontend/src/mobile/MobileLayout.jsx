import { useState } from 'react';
import { useNavigate, NavLink, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import MobileDashboard from './pages/MobileDashboard';
import MobileJournal from './pages/MobileJournal';
import MobileNewTrade from './pages/MobileNewTrade';
import { MobileMonthly, MobileYearly } from './pages/MobileReports';
import MobileChecklist from './pages/MobileChecklist';
import '../styles/mobile_rebuild.css';

export default function MobileLayout() {
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const nav = useNavigate();

  const toggle = () => setOpen(!open);
  const close = () => setOpen(false);
  const doLogout = () => { logout(); nav('/login'); close(); };

  return (
    <div className="m-body m-layout">
      {/* Top Nav */}
      <header className="m-top-nav">
        <button className="m-menu-btn" onClick={toggle}>☰</button>
        <div className="m-brand">TJP Mobile</div>
        <div style={{ width: 40 }}></div>
      </header>

      {/* Drawer Overlay */}
      <div className={`m-overlay ${open ? 'visible' : ''}`} onClick={close}></div>

      {/* Navigation Drawer */}
      <aside className={`m-drawer ${open ? 'open' : ''}`}>
        <div style={{ padding: '24px 16px', borderBottom: '1px solid var(--m-border)' }}>
          <div className="m-brand" style={{ fontSize: '1.5rem' }}>Trading Journal</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--m-text-muted)', marginTop: 4 }}>@{user?.username}</div>
        </div>
        
        <nav className="m-nav-list">
          <NavLink to="/" end className={({isActive}) => isActive ? 'm-nav-item active' : 'm-nav-item'} onClick={close}>
            Dashboard
          </NavLink>
          <NavLink to="/new-trade" className={({isActive}) => isActive ? 'm-nav-item active' : 'm-nav-item'} onClick={close}>
            New Trade
          </NavLink>
          <NavLink to="/journal" className={({isActive}) => isActive ? 'm-nav-item active' : 'm-nav-item'} onClick={close}>
            Journal
          </NavLink>
          <NavLink to="/monthly" className={({isActive}) => isActive ? 'm-nav-item active' : 'm-nav-item'} onClick={close}>
            Monthly Reports
          </NavLink>
          <NavLink to="/yearly" className={({isActive}) => isActive ? 'm-nav-item active' : 'm-nav-item'} onClick={close}>
            Yearly Reports
          </NavLink>
          <NavLink to="/checklist" className={({isActive}) => isActive ? 'm-nav-item active' : 'm-nav-item'} onClick={close}>
            Scale Checklist
          </NavLink>
        </nav>

        <div style={{ marginTop: 'auto', padding: 16 }}>
          <button className="m-btn m-btn-ghost" onClick={doLogout}>Logout</button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="m-container">
        <Routes>
          <Route path="/" element={<MobileDashboard />} />
          <Route path="/new-trade" element={<MobileNewTrade />} />
          <Route path="/journal" element={<MobileJournal />} />
          <Route path="/monthly" element={<MobileMonthly />} />
          <Route path="/yearly" element={<MobileYearly />} />
          <Route path="/checklist" element={<MobileChecklist />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
