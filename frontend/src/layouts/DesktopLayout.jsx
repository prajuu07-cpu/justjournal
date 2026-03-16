import { NavLink, useNavigate, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Dashboard from '../pages/Dashboard';
import NewTrade  from '../pages/NewTrade';
import Journal   from '../pages/Journal';
import ModelBuilder from '../pages/ModelBuilder';
import { MonthlyReports, YearlyReports } from '../pages/Reports';
import '../styles/desktop.css';

import ModeSwitch from '../components/ModeSwitch';

export default function DesktopLayout() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const doLogout = () => { logout(); nav('/login'); };

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
        </nav>
        <div className="sidebar-foot">
          <div className="user-info">@{user?.username}</div>
          <button className="btn btn-ghost btn-sm" onClick={doLogout}>Logout</button>
        </div>
      </aside>
      <main className="main-content">
        <ModeSwitch />
        <Routes>
          <Route path="/"          element={<Dashboard/>}/>
          <Route path="/new-trade" element={<NewTrade/>}/>
          <Route path="/journal"   element={<Journal/>}/>
          <Route path="/monthly"   element={<MonthlyReports/>}/>
          <Route path="/yearly"    element={<YearlyReports/>}/>
          <Route path="/model-builder" element={<ModelBuilder/>}/>
          <Route path="*"          element={<Navigate to="/" replace/>}/>
        </Routes>
      </main>
    </div>
  );
}
