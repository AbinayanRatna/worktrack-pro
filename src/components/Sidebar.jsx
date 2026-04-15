import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useState, useEffect } from 'react';
import { db } from '../firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { X, CheckSquare, Users, LogOut, UserPlus } from 'lucide-react';
import { APPROVER_ROLES, ROLE_CHANGER_ROLES } from '../constants/roles';

export default function Sidebar({ isOpen, onClose }) {
  const { userProfile, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  const role = userProfile?.role;
  const canSeeRequests = APPROVER_ROLES.includes(role);
  const canManageUsers = ROLE_CHANGER_ROLES.includes(role);

  // Live badge count for pending signup requests
  useEffect(() => {
    if (!canSeeRequests) return;
    const q = query(
      collection(db, 'signup_requests'),
      where('status', '==', 'pending')
    );
    const unsub = onSnapshot(
      q,
      (snap) => setPendingCount(snap.size),
      (err) => console.error('Pending count listener error:', err)
    );
    return () => unsub();
  }, [canSeeRequests]);

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to log out?')) return;
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const navItems = [
    { name: 'Tasks', path: '/', icon: <CheckSquare size={20} /> },
  ];

  if (canSeeRequests) {
    navItems.push({
      name: 'Signup Requests',
      path: '/signup-requests',
      icon: <UserPlus size={20} />,
      badge: pendingCount > 0 ? pendingCount : null,
    });
  }

  if (canManageUsers) {
    navItems.push({ name: 'Users', path: '/users', icon: <Users size={20} /> });
  }

  // Role badge color
  const roleBadgeColor =
    role === 'Director' ? '#a78bfa' :
    role === 'Operation Manager' ? '#60a5fa' :
    role === 'Manager - Technical Architect' ? '#34d399' :
    role === 'Software Engineer' ? '#f59e0b' :
    role === 'Associate Software Engineer' ? '#fb923c' :
    '#94a3b8';

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 998,
          }}
        />
      )}

      <aside
        className={`sidebar-container ${isOpen ? 'open' : ''}`}
        style={{
          width: 'var(--nav-width)',
          height: '100vh',
          position: 'fixed',
          left: 0, top: 0,
          backgroundColor: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-color)',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          transition: 'transform 0.3s ease',
          zIndex: 999,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem' }}>
          <div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold' }}>
              WorkTrack <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
            </h2>
            <div style={{ marginTop: '0.6rem', fontSize: '0.875rem' }}>
              <div style={{ fontWeight: '500', color: 'white', marginBottom: '4px' }}>
                {userProfile?.name}
              </div>
              <span style={{
                display: 'inline-block',
                padding: '2px 10px',
                background: `${roleBadgeColor}1a`,
                border: `1px solid ${roleBadgeColor}44`,
                borderRadius: '12px',
                fontSize: '0.7rem',
                color: roleBadgeColor,
                fontWeight: '500',
              }}>
                {role}
              </span>
            </div>
          </div>
          <button className="mobile-only" onClick={onClose} style={{ color: 'var(--text-secondary)' }}>
            <X size={24} />
          </button>
        </div>

        {/* Nav */}
        <nav style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              onClick={onClose}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: '0.75rem',
                padding: '0.75rem 1rem', borderRadius: '8px',
                color: isActive ? 'white' : 'var(--text-secondary)',
                backgroundColor: isActive ? 'var(--accent-primary)' : 'transparent',
                transition: 'all 0.2s',
                fontWeight: isActive ? '500' : 'normal',
                textDecoration: 'none', position: 'relative',
              })}
            >
              {item.icon}
              <span style={{ flex: 1 }}>{item.name}</span>
              {item.badge && (
                <span style={{
                  minWidth: '20px', height: '20px', borderRadius: '10px',
                  background: '#ef4444', color: 'white',
                  fontSize: '0.7rem', fontWeight: 'bold',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  padding: '0 5px', animation: 'pulse 2s infinite',
                }}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.75rem',
            padding: '0.75rem 1rem', color: 'var(--danger)', borderRadius: '8px',
            marginTop: 'auto', background: 'transparent', border: 'none',
            cursor: 'pointer', width: '100%', transition: 'all 0.2s',
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.1)'}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <LogOut size={20} />
          Log Out
        </button>
      </aside>
    </>
  );
}
