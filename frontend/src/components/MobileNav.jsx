import { NavLink } from 'react-router-dom';

const MobileNav = () => {
  return (
    <nav className="m-nav">
      <NavLink to="/" end className={({ isActive }) => isActive ? 'm-nav-item active' : 'm-nav-item'}>
        <div className="m-nav-icon">📊</div>
        <span>Overview</span>
      </NavLink>
      
      <NavLink to="/journal" className={({ isActive }) => isActive ? 'm-nav-item active' : 'm-nav-item'}>
        <div className="m-nav-icon">📖</div>
        <span>Journal</span>
      </NavLink>

      <NavLink to="/new-trade" className="m-nav-center">
        <span>+</span>
      </NavLink>

      <NavLink to="/monthly" className={({ isActive }) => isActive ? 'm-nav-item active' : 'm-nav-item'}>
        <div className="m-nav-icon">🗓️</div>
        <span>Monthly</span>
      </NavLink>

      <NavLink to="/yearly" className={({ isActive }) => isActive ? 'm-nav-item active' : 'm-nav-item'}>
        <div className="m-nav-icon">📅</div>
        <span>Yearly</span>
      </NavLink>
    </nav>
  );
};

export default MobileNav;
