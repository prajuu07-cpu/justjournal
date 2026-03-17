import { NavLink, useNavigate, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';
import NewTrade  from '../pages/NewTrade';
import Journal   from '../pages/Journal';
import ModelBuilder from '../pages/ModelBuilder';
import { MonthlyReports, YearlyReports } from '../pages/Reports';
import SetLimit from '../pages/SetLimit';
import Bin from '../pages/Bin';
import '../styles/desktop.css';

import ModeSwitch from '../components/ModeSwitch';
import { useMode } from '../context/ModeContext';

export default function DesktopLayout() {
  const { user, logout } = useAuth();
  const { mode } = useMode();
  const nav = useNavigate();
  const location = useLocation();

  const doLogout = () => { logout(); nav('/login'); };
  const hideSwitch = location.pathname === '/model-builder';

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="sidebar-logo">Trading Journal</div>
        <nav className="sidebar-nav">
          <NavLink to="/"             end className={({isActive})=>isActive?'nav-item active':'nav-item'}>Dashboard</NavLink>
          <NavLink to="/new-trade"        className={({isActive})=>isActive?'nav-item active':'nav-item'}>New Trade</NavLink>
          <NavLink to="/journal"          className={({isActive})=>isActive?'nav-item active':'nav-item'}>Journal</NavLink>
          <NavLink to="/monthly"          className={({isActive})=>isActive?'nav-item active':'nav-item'}>Monthly</NavLink>
          <NavLink to="/yearly"           className={({isActive})=>isActive?'nav-item active':'nav-item'}>Yearly</NavLink>
          {mode === 'justchill' && (
            <>
              <NavLink to="/settings" className={({isActive})=>isActive?'nav-item active':'nav-item'}>Set Limit</NavLink>
              <NavLink to="/bin" className={({isActive})=>isActive?'nav-item active':'nav-item'}>Bin</NavLink>
            </>
          )}
        </nav>
        <div className="sidebar-foot">
          <div className="user-info">@{user?.username}</div>
          <button className="btn btn-ghost btn-sm" onClick={doLogout}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
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
