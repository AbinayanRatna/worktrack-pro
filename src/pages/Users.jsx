import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';
import toast from 'react-hot-toast';
import { RefreshCw, Users as UsersIcon } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const ROLE_COLORS = {
  'Director': '#a78bfa',
  'Operation Manager': '#60a5fa',
  'Manager - Technical Architect': '#34d399',
  'Software Engineer': '#f59e0b',
  'Associate Software Engineer': '#fb923c',
  'SE Intern': '#94a3b8',
};

// Roles that can be assigned via the Users page (MTA & Director only)
const ASSIGNABLE_ROLES_LIST = ROLES; // all roles available to pick

export default function Users() {
  const { userProfile } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);
  const [search, setSearch] = useState('');

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const snap = await getDocs(collection(db, 'users'));
      setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      toast.error('Failed to load users');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleRoleChange = async (userId, newRole) => {
    if (!window.confirm(`Change this user's role to "${newRole}"?`)) return;
    try {
      setSavingId(userId);
      await updateDoc(doc(db, 'users', userId), { role: newRole });
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      toast.success('Role updated successfully');
    } catch (error) {
      toast.error('Failed to update role: ' + error.message);
    } finally {
      setSavingId(null);
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email?.toLowerCase().includes(search.toLowerCase()) ||
      u.role?.toLowerCase().includes(search.toLowerCase())
  );

  // Group by role
  const grouped = ROLES.reduce((acc, role) => {
    const group = filtered.filter((u) => u.role === role);
    if (group.length > 0) acc[role] = group;
    return acc;
  }, {});

  return (
    <Layout>
      {/* Header */}
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>User Management</h1>
          <p style={{ color: 'var(--text-secondary)' }}>
            View all team members and change their roles.
          </p>
        </div>
        <button onClick={fetchUsers} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, email, or role…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        style={{
          width: '100%', padding: '0.75rem 1rem', borderRadius: '8px',
          border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
          color: 'white', fontSize: '0.9rem', marginBottom: '1.5rem',
        }}
      />

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '0.75rem', marginBottom: '1.75rem' }}>
        {ROLES.filter((r) => r !== 'Operation Manager').map((role) => {
          const count = users.filter((u) => u.role === role).length;
          const color = ROLE_COLORS[role] || '#94a3b8';
          return (
            <div key={role} style={{ padding: '0.75rem', background: 'var(--bg-secondary)', border: `1px solid ${color}22`, borderRadius: '10px' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: 'bold', color }}>{count}</div>
              <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', marginTop: '2px' }}>{role.replace('Manager - Technical Architect', 'MTA').replace('Associate Software Engineer', 'ASE')}</div>
            </div>
          );
        })}
      </div>

      {/* User list */}
      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <UsersIcon size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No users found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          {Object.entries(grouped).map(([role, members]) => {
            const color = ROLE_COLORS[role] || '#94a3b8';
            return (
              <div key={role}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                  <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, flexShrink: 0 }} />
                  <span style={{ fontWeight: '600', color }}>{role}</span>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-tertiary)' }}>({members.length})</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {members.map((user) => {
                    const isSaving = savingId === user.id;
                    const isSelf = user.id === userProfile?.id;
                    return (
                      <div key={user.id} className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                        {/* Avatar */}
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `linear-gradient(135deg, ${color}44, ${color}22)`, border: `2px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color, flexShrink: 0, fontSize: '1rem' }}>
                          {user.name?.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: '150px' }}>
                          <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>
                            {user.name}
                            {isSelf && <span style={{ marginLeft: '6px', fontSize: '0.7rem', color: 'var(--text-tertiary)' }}>(you)</span>}
                          </div>
                          <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{user.email}</div>
                        </div>

                        {/* Role selector */}
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={isSaving || isSelf}
                          style={{
                            padding: '0.4rem 0.75rem', borderRadius: '8px',
                            background: `${color}11`, border: `1px solid ${color}44`,
                            color, fontSize: '0.82rem', cursor: isSaving || isSelf ? 'not-allowed' : 'pointer',
                            opacity: isSaving ? 0.6 : 1, fontWeight: '500',
                          }}
                        >
                          {ASSIGNABLE_ROLES_LIST.map((r) => (
                            <option key={r} value={r} style={{ color: 'white', background: 'var(--bg-primary)' }}>
                              {r}
                            </option>
                          ))}
                        </select>
                        {isSaving && <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>Saving…</span>}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
