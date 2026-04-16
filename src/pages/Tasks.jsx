import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  Plus, RefreshCw, CheckSquare, Eye, LayoutGrid,
  AlertTriangle, Calendar, User,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import KanbanBoard from '../components/KanbanBoard';
import toast from 'react-hot-toast';
import {
  isManager, requiresDailyTask, canCreateTask,
  DAILY_TASK_ROLES,
} from '../constants/roles';

// ── Status helpers ────────────────────────────────────────────────────────────
export const STATUS_META = {
  'Open':             { bg: 'var(--status-open-bg)',   color: 'var(--status-open-color)' },
  'Sent for Review':  { bg: 'var(--status-review-bg)', color: 'var(--status-review-color)' },
  'Closed':           { bg: 'var(--status-closed-bg)', color: 'var(--status-closed-color)' },
  'ReOpen':           { bg: 'var(--status-reopen-bg)', color: 'var(--status-reopen-color)' },
};

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function isOverdue(task) {
  if (!task.dueDate) return false;
  if (task.status === 'Closed') return false;
  return task.dueDate < todayStr();
}

// A task "belongs to today" if dueDate === today OR it's overdue and not closed
function isActiveToday(task) {
  const today = todayStr();
  if (task.status === 'Closed') return false;
  return task.dueDate === today || task.dueDate < today;
}

export default function Tasks() {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const role = userProfile?.role;
  const uid = userProfile?.id;
  const manager = isManager(role);
  const canCreate = canCreateTask(role);

  const [showKanban, setShowKanban] = useState(() => {
    return sessionStorage.getItem('preferredTaskView') === 'kanban';
  });

  const toggleKanban = (val) => {
    setShowKanban(val);
    sessionStorage.setItem('preferredTaskView', val ? 'kanban' : 'list');
  };

  // Tabs
  const tabs = [
    { key: 'mine',   label: 'My Tasks',        icon: <CheckSquare size={16} /> },
    { key: 'review', label: 'Review tasks', icon: <Eye size={16} /> },
    ...(manager ? [{ key: 'team', label: 'All Tasks', icon: <LayoutGrid size={16} /> }] : []),
  ];
  const [activeTab, setActiveTab] = useState('mine');
  const [statusFilter, setStatusFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!userProfile) return;
    try {
      setIsLoading(true);
      const [tasksSnap, usersSnap] = await Promise.all([
        getDocs(collection(db, 'tasks')),
        getDocs(collection(db, 'users')),
      ]);
      setTasks(tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [userProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived lists ─────────────────────────────────────────────────────────────
  const myTasks     = tasks.filter((t) => t.assignedTo === uid);
  const reviewTasks = tasks.filter((t) => t.reviewer === uid || t.assignedBy === uid);

  // For team tab: all tasks that are assigned to non-manager users (daily task roles)
  const teamTasks = tasks.filter((t) => {
    const assignee = users.find((u) => u.id === t.assignedTo);
    return assignee != null; // show all if on manager tab; user filter handles narrowing
  });

  const today = todayStr();

  // Users who should have daily tasks (SE, ASE, Intern)
  const dailyUsers = users.filter((u) => requiresDailyTask(u.role));

  // Today's overview per daily-task user
  const userTaskSummary = dailyUsers.map((u) => ({
    ...u,
    todayTasks: tasks.filter((t) => t.assignedTo === u.id && isActiveToday(t)),
  }));
  const usersWithoutTasks = userTaskSummary.filter((u) => u.todayTasks.length === 0);

  // Apply filters to displayed list
  const applyFilters = (list) => {
    let result = list;
    if (statusFilter !== 'All') result = result.filter((t) => t.status === statusFilter);
    if (activeTab === 'team' && userFilter !== 'All') result = result.filter((t) => t.assignedTo === userFilter);
    return result;
  };

  const rawList =
    activeTab === 'mine'   ? myTasks :
    activeTab === 'review' ? reviewTasks :
    teamTasks;

  const displayTasks = applyFilters(rawList);

  const switchTab = (tab) => { setActiveTab(tab); setStatusFilter('All'); setUserFilter('All'); };

  const openCreate = () => { navigate('/task/new'); };
  const openEdit   = (task) => { navigate(`/task/${task.id}`); };

  const userName = (id) => users.find((u) => u.id === id)?.name || '—';
  const userRole = (id) => users.find((u) => u.id === id)?.role || '';

  // ── Task Card ────────────────────────────────────────────────────────────────
  const TaskCard = ({ task }) => {
    const meta = STATUS_META[task.status] || STATUS_META['Open'];
    const overdue = isOverdue(task);
    const isToday = task.dueDate === today;

    const borderColor =
      overdue         ? 'var(--status-reopen-color)' :
      isToday         ? 'var(--accent-primary)' :
      'transparent';

    return (
      <div
        className="glass-panel"
        style={{
          padding: '1.25rem 1.5rem',
          display: 'flex', flexDirection: 'column', gap: '0.8rem',
          borderLeft: `3px solid ${borderColor}`,
          transition: 'border-color 0.2s',
          cursor: 'pointer',
          animation: 'fadeIn 0.2s ease',
        }}
        onClick={() => openEdit(task)}
      >
        {/* Title row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.25rem' }}>
              <h3 style={{ fontSize: '0.98rem', fontWeight: '600', wordBreak: 'break-word', margin: 0 }}>
                {task.title}
              </h3>
              <span className="status-badge" style={{ background: meta.bg, color: meta.color }}>
                {task.status}
              </span>
              {overdue && (
                <span className="status-badge" style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                  OVERDUE
                </span>
              )}
              {isToday && !overdue && (
                <span className="status-badge" style={{ background: 'rgba(59,130,246,0.15)', color: 'var(--accent-primary)' }}>
                  TODAY
                </span>
              )}
            </div>
            {/* Contextual subtitle */}
            {(activeTab === 'review' || activeTab === 'team') && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Assigned to: <strong style={{ color: 'white' }}>{userName(task.assignedTo)}</strong>
                {activeTab === 'team' && (
                  <> · <span style={{ color: 'var(--text-tertiary)' }}>{userRole(task.assignedTo)}</span></>
                )}
              </span>
            )}
            {activeTab === 'mine' && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                Reviewer: <strong style={{ color: 'var(--status-review-color)' }}>{userName(task.reviewer)}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {task.description && (
          <div style={{
            color: 'var(--text-secondary)', fontSize: '0.84rem', lineHeight: '1.5',
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden', wordBreak: 'break-word',
          }}>
            {task.description}
          </div>
        )}

        {/* Metadata */}
        <div className="task-metadata-row">
          {task.dateAssigned && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Calendar size={12} color="var(--text-secondary)" />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Assigned:</span>
              <span style={{ fontSize: '0.78rem', fontWeight: '500' }}>{task.dateAssigned}</span>
            </div>
          )}
          {task.dueDate && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <AlertTriangle size={12} color={overdue ? 'var(--danger)' : 'var(--text-secondary)'} />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Due:</span>
              <span style={{ fontSize: '0.78rem', fontWeight: '500', color: overdue ? 'var(--danger)' : 'inherit' }}>{task.dueDate}</span>
            </div>
          )}
          {activeTab === 'team' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <User size={12} color="var(--text-secondary)" />
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Reviewer:</span>
              <span style={{ fontSize: '0.78rem', fontWeight: '500', color: 'var(--status-review-color)' }}>{userName(task.reviewer)}</span>
            </div>
          )}
          {/* Submission count */}
          {task.submissions?.length > 0 && (
            <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
              {task.submissions.length} submission{task.submissions.length > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>
    );
  };

  // ── Team Overview Panel ─────────────────────────────────────────────────────
  const TeamOverview = () => {
    if (usersWithoutTasks.length === 0) return null;
    return (
      <div style={{ marginBottom: '1.5rem' }}>
        {/* Users with NO tasks */}
        <div className="glass-panel" style={{ padding: '1rem 1.25rem', borderLeft: '3px solid var(--warning)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.65rem' }}>
            <AlertTriangle size={14} color="var(--warning)" />
            <span style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--warning)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              No Task Assigned Today
            </span>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {usersWithoutTasks.map((u) => (
              <button
                key={u.id}
                onClick={() => setUserFilter(u.id)}
                style={{
                  padding: '0.35rem 0.75rem', borderRadius: '20px', fontSize: '0.8rem',
                  background: userFilter === u.id ? 'rgba(245,158,11,0.2)' : 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.3)', color: 'var(--warning)', cursor: 'pointer',
                }}
              >
                {u.name} <span style={{ fontSize: '0.68rem', opacity: 0.7 }}>({u.role.replace('Associate Software Engineer', 'ASE').replace('Software Engineer', 'SE').replace('SE Intern', 'Intern')})</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };


  // ── Render ────────────────────────────────────────────────────────────────────
  return (
    <Layout>
      {showKanban && (
        <KanbanBoard 
          tasks={tasks} 
          role={role} 
          uid={uid} 
          onClose={() => { toggleKanban(false); fetchData(); }} 
          onRefresh={fetchData}
          usersList={users} 
        />
      )}
      
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold' }}>Tasks</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Track and manage work across your team.</p>
        </div>
        <div style={{ display: 'flex', gap: '0.65rem' }}>
          <button onClick={() => toggleKanban(true)} className="btn btn-secondary desktop-only" title="Open Kanban View" style={{ display: 'none' }}>
            <LayoutGrid size={16} />
            <span>Kanban View</span>
          </button>
          <style>{`
            @media (min-width: 1024px) {
              .desktop-only-kanban { display: flex !important; }
            }
          `}</style>
          <button onClick={() => toggleKanban(true)} className="btn btn-secondary desktop-only-kanban" title="Open Kanban View" style={{ display: 'none', alignItems: 'center', gap: '0.4rem' }}>
            <LayoutGrid size={16} />
            <span>Kanban View</span>
          </button>
          <button onClick={fetchData} className="btn btn-secondary" title="Refresh tasks">
            <RefreshCw size={16} />
            <span className="desktop-only">Refresh</span>
          </button>
          {canCreate && (
            <button onClick={openCreate} className="btn btn-primary">
              <Plus size={18} /> New Task
            </button>
          )}
        </div>
      </div>

      {/* TEAM OVERVIEW — show in team tab AND also as a persistent top strip for managers */}
      {manager && activeTab === 'team' && <TeamOverview />}

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem', overflowX: 'auto' }}>
        {tabs.map((tab) => {
          const count =
            tab.key === 'mine'   ? myTasks.length :
            tab.key === 'review' ? reviewTasks.length :
            teamTasks.length;
          // Badges for pending-attention items
          const reviewBadge = reviewTasks.filter((t) => t.status === 'Sent for Review').length;
          const badge = tab.key === 'review' ? reviewBadge : 0;
          const isActive = activeTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => switchTab(tab.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.7rem 1.25rem', whiteSpace: 'nowrap',
                fontWeight: isActive ? '600' : '400',
                color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)',
                borderBottom: `2px solid ${isActive ? 'var(--accent-primary)' : 'transparent'}`,
                marginBottom: '-1px', background: 'transparent', border: 'none',
                borderBottomWidth: '2px', borderBottomStyle: 'solid',
                borderBottomColor: isActive ? 'var(--accent-primary)' : 'transparent',
                cursor: 'pointer', fontSize: '0.9rem', transition: 'color 0.2s',
              }}
            >
              {tab.icon}
              {tab.label}
              <span style={{ padding: '1px 7px', borderRadius: '10px', fontSize: '0.7rem', fontWeight: 'bold', background: isActive ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)', color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                {count}
              </span>
              {badge > 0 && !isActive && (
                <span style={{ minWidth: '18px', height: '18px', borderRadius: '9px', background: '#ef4444', color: 'white', fontSize: '0.65rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', animation: 'pulse 2s infinite' }}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', flexWrap: 'wrap', alignItems: 'center' }}>
        {['All', 'Open', 'Sent for Review', 'Closed', 'ReOpen'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.78rem',
              background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: statusFilter === s ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${statusFilter === s ? 'transparent' : 'var(--border-color)'}`,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            {s}
          </button>
        ))}

        {/* User filter — only on team tab */}
        {activeTab === 'team' && (
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            style={{
              padding: '0.35rem 0.85rem', borderRadius: '20px',
              background: 'var(--bg-tertiary)', color: 'white',
              border: '1px solid var(--border-color)', marginLeft: 'auto',
              fontSize: '0.78rem', cursor: 'pointer',
            }}
          >
            <option value="All">All Users</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
        )}
      </div>

      {/* Task list */}
      {isLoading ? (
        <LoadingSpinner />
      ) : displayTasks.length === 0 ? (
        <div className="glass-panel" style={{ padding: '3rem 2rem', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>
            {activeTab === 'review' ? '✅' : activeTab === 'team' ? '📊' : '📋'}
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>
            {activeTab === 'review'
              ? "No tasks awaiting your review."
              : activeTab === 'team'
              ? 'No tasks match the selected filter.'
              : 'No tasks assigned to you yet.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
          {displayTasks.map((task) => <TaskCard key={task.id} task={task} />)}
        </div>
      )}
    </Layout>
  );
}
