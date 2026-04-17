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
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[2rem] font-bold">User Management</h1>
          <p className="text-[var(--text-secondary)]">
            View all team members and change their roles.
          </p>
        </div>
        <button onClick={fetchUsers} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search by name, email, or role…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="mb-6 w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-3 text-[0.9rem] text-white outline-none"
      />

      {/* Stats */}
      <div className="mb-7 grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))' }}>
        {ROLES.filter((r) => r !== 'Operation Manager').map((role) => {
          const count = users.filter((u) => u.role === role).length;
          const color = ROLE_COLORS[role] || '#94a3b8';
          return (
            <div key={role} className="rounded-[10px] bg-[var(--bg-secondary)] p-3" style={{ border: `1px solid ${color}22` }}>
              <div className="text-[1.4rem] font-bold" style={{ color }}>{count}</div>
              <div className="mt-0.5 text-[0.68rem] text-[var(--text-secondary)]">{role.replace('Manager - Technical Architect', 'MTA').replace('Associate Software Engineer', 'ASE')}</div>
            </div>
          );
        })}
      </div>

      {/* User list */}
      {isLoading ? (
        <LoadingSpinner />
      ) : filtered.length === 0 ? (
        <div className="glass-panel px-8 py-16 text-center">
          <UsersIcon size={48} className="mx-auto mb-4 text-[var(--text-secondary)]" />
          <p className="text-[var(--text-secondary)]">No users found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {Object.entries(grouped).map(([role, members]) => {
            const color = ROLE_COLORS[role] || '#94a3b8';
            return (
              <div key={role}>
                <div className="mb-3 flex items-center gap-3">
                  <div className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: color }} />
                  <span className="font-semibold" style={{ color }}>{role}</span>
                  <span className="text-[0.78rem] text-[var(--text-tertiary)]">({members.length})</span>
                </div>

                <div className="flex flex-col gap-2">
                  {members.map((user) => {
                    const isSaving = savingId === user.id;
                    const isSelf = user.id === userProfile?.id;
                    return (
                      <div key={user.id} className="glass-panel flex flex-wrap items-center gap-4 px-5 py-4">
                        {/* Avatar */}
                        <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: `linear-gradient(135deg, ${color}44, ${color}22)`, border: `2px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color, flexShrink: 0, fontSize: '1rem' }}>
                          {user.name?.charAt(0).toUpperCase()}
                        </div>

                        {/* Info */}
                        <div className="min-w-[150px] flex-1">
                          <div className="text-[0.95rem] font-semibold">
                            {user.name}
                            {isSelf && <span className="ml-1.5 text-[0.7rem] text-[var(--text-tertiary)]">(you)</span>}
                          </div>
                          <div className="text-[0.8rem] text-[var(--text-secondary)]">{user.email}</div>
                        </div>

                        {/* Role selector */}
                        <select
                          value={user.role}
                          onChange={(e) => handleRoleChange(user.id, e.target.value)}
                          disabled={isSaving || isSelf}
                          className="rounded-lg px-3 py-1.5 text-[0.82rem] font-medium"
                          style={{
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
                        {isSaving && <span className="text-[0.75rem] text-[var(--text-tertiary)]">Saving…</span>}
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
