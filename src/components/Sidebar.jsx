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
          className="fixed inset-0 z-[998] bg-black/50"
        />
      )}

      <aside
        style={{ width: 'var(--nav-width)' }}
        className={`sidebar-container ${isOpen ? 'open' : ''} fixed left-0 top-0 z-[999] flex h-screen flex-col border-r border-[var(--border-color)] bg-[var(--bg-secondary)] p-6 transition-transform duration-300`}
      >
        {/* Header */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <h2 className="text-[1.4rem] font-bold">
              WorkTrack <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
            </h2>
            <div className="mt-2.5 text-sm">
              <div className="mb-1 font-medium text-white">
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
          <button className="mobile-only text-[var(--text-secondary)]" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex grow flex-col gap-1.5">
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
              className="flex items-center gap-3 rounded-lg px-4 py-3"
            >
              {item.icon}
              <span className="flex-1">{item.name}</span>
              {item.badge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[0.7rem] font-bold text-white animate-pulse">
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="mt-auto flex w-full items-center gap-3 rounded-lg px-4 py-3 text-[var(--danger)] transition-all duration-200"
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
