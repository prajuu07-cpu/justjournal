import { useState } from 'react';
import { NavLink, useNavigate, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';
import NewTrade  from '../pages/NewTrade';
import Journal   from '../pages/Journal';
import ModelBuilder from '../pages/ModelBuilder';
import { MonthlyReports, YearlyReports } from '../pages/Reports';
import SetLimit from '../pages/SetLimit';
import Bin from '../pages/Bin';
import '../styles/mobile/mobile_fresh.css';

import ModeSwitch from '../components/ModeSwitch';
import { useMode } from '../context/ModeContext';

export default function MobileLayout() {
  const { user, logout } = useAuth();
  const { mode } = useMode();
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const hideSwitch = location.pathname === '/model-builder';

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
          <div className="m-logo">Trading Journal</div>
          <div className="m-user">@{user?.username}</div>
        </div>
        
        <nav className="m-nav">
          <NavLink to="/" end className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Dashboard</NavLink>
          <NavLink to="/new-trade" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>New Trade</NavLink>
          <NavLink to="/journal" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Journal</NavLink>
          <NavLink to="/monthly" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Monthly</NavLink>
          <NavLink to="/yearly" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Yearly</NavLink>
          {mode === 'justchill' && (
            <>
              <NavLink to="/settings" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Set Limit</NavLink>
              <NavLink to="/bin" className={({isActive})=>isActive?'m-nav-link active':'m-nav-link'} onClick={close}>Bin</NavLink>
            </>
          )}
        </nav>

        <div className="m-sidebar-foot">
          <button className="m-logout-btn" onClick={doLogout}>Logout Account</button>
        </div>
      </aside>

      <main className="m-content">
        {!hideSwitch && <ModeSwitch />}
        <Routes>
          <Route path="/"          element={<Dashboard/>}/>
          <Route path="/new-trade" element={<NewTrade/>}/>
          <Route path="/journal"   element={<Journal/>}/>
          <Route path="/monthly"   element={<MonthlyReports/>}/>
          <Route path="/yearly"    element={<YearlyReports/>}/>
          <Route path="/model-builder" element={<ModelBuilder/>}/>
          <Route path="/settings"  element={<SetLimit/>}/>
          <Route path="/bin"       element={<Bin/>}/>
          <Route path="*"          element={<Navigate to="/" replace/>}/>
        </Routes>
      </main>
    </div>
  );
}
