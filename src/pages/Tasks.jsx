import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { collection, deleteDoc, doc, getDocs, query, serverTimestamp, updateDoc, where, writeBatch } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  Plus, RefreshCw, CheckSquare, Eye, LayoutGrid,
  AlertTriangle, Calendar, ListChecks, RotateCcw, User, Trash2,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LoadingSpinner from '../components/LoadingSpinner';
import KanbanBoard from '../components/KanbanBoard';
import toast from 'react-hot-toast';
import {
  isManager, requiresDailyTask, canCreateTask, canDeleteTask,
  DAILY_TASK_ROLES,
} from '../constants/roles';

// ── Status helpers ────────────────────────────────────────────────────────────
export const STATUS_META = {
  'Open':             { bg: 'var(--status-open-bg)',   color: 'var(--status-open-color)' },
  'Sent for Review':  { bg: 'var(--status-review-bg)', color: 'var(--status-review-color)' },
  'Closed':           { bg: 'var(--status-closed-bg)', color: 'var(--status-closed-color)' },
  'ReOpen':           { bg: 'var(--status-reopen-bg)', color: 'var(--status-reopen-color)' },
  'Deleted':          { bg: 'rgba(148,163,184,0.16)',  color: '#94a3b8' },
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
    { key: 'deleted', label: 'Deleted', icon: <Trash2 size={16} /> },
  ];
  const [activeTab, setActiveTab] = useState('mine');
  const [statusFilter, setStatusFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [selectedDeletedIds, setSelectedDeletedIds] = useState([]);
  const [selectAllMode, setSelectAllMode] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    if (!userProfile) return;
    try {
      setIsLoading(true);
      const usersPromise = getDocs(collection(db, 'users'));

      const taskSnapshots = manager
        ? [await getDocs(collection(db, 'tasks'))]
        : await Promise.all([
            getDocs(query(collection(db, 'tasks'), where('assignedTo', '==', uid))),
            getDocs(query(collection(db, 'tasks'), where('assignedBy', '==', uid))),
            getDocs(query(collection(db, 'tasks'), where('workerIds', 'array-contains', uid))),
          ]);

      const taskMap = new Map();
      taskSnapshots.flatMap((snap) => snap.docs).forEach((d) => {
        taskMap.set(d.id, { id: d.id, ...d.data() });
      });

      const usersSnap = await usersPromise;
      setTasks(Array.from(taskMap.values()));
      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      console.error(error);
      toast.error('Failed to load tasks');
    } finally {
      setIsLoading(false);
    }
  }, [manager, uid, userProfile]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Derived lists ─────────────────────────────────────────────────────────────
  const myTasks     = tasks.filter((t) => (t.assignedTo === uid || t.taskLeadId === uid || (t.workerIds || []).includes(uid)) && t.status !== 'Deleted');
  // For delegated tasks: task lead is reviewer for worker submissions (delegatedReviewByCreator = false)
  // Task creator (assignedBy) is reviewer for final stage (delegatedReviewByCreator = true)
  const reviewTasks = tasks.filter((t) => {
    if (t.status === 'Deleted') return false;
    if (t.reviewer === uid || t.assignedBy === uid) return true;
    // Task lead should see delegated tasks in review tab when workers submit (and lead hasn't approved yet)
    if (t.taskType === 'delegated' && t.taskLeadId === uid && !t.delegatedReviewByCreator) return true;
    return false;
  });

  // For team tab: all tasks that are assigned to non-manager users (daily task roles)
  const teamTasks = tasks.filter((t) => {
    if (t.status === 'Deleted') return false;
    const assignee = users.find((u) => u.id === t.assignedTo);
    return assignee != null; // show all if on manager tab; user filter handles narrowing
  });

  const deletedTasks = tasks.filter((t) =>
    t.status === 'Deleted' && (
      t.assignedTo === uid ||
      t.assignedBy === uid ||
      canDeleteTask(role, t.assignedBy === uid)
    )
  );

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
    if (activeTab === 'deleted') return result;
    if (statusFilter !== 'All') result = result.filter((t) => t.status === statusFilter);
    if (activeTab === 'team' && userFilter !== 'All') result = result.filter((t) => t.assignedTo === userFilter);
    return result;
  };

  const rawList =
    activeTab === 'mine'   ? myTasks :
    activeTab === 'review' ? reviewTasks :
    activeTab === 'team'   ? teamTasks :
    deletedTasks;

  const displayTasks = applyFilters(rawList);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setStatusFilter('All');
    setUserFilter('All');
    setSelectedDeletedIds([]);
    setSelectAllMode(false);
  };

  const openCreate = () => { navigate('/task/new'); };
  const openEdit   = (task) => { navigate(`/task/${task.id}`); };

  const userName = (id) => users.find((u) => u.id === id)?.name || '—';
  const userRole = (id) => users.find((u) => u.id === id)?.role || '';

  const toggleDeletedSelection = (taskId) => {
    setSelectAllMode(false);
    setSelectedDeletedIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleSelectAllDeleted = () => {
    if (selectAllMode) {
      setSelectAllMode(false);
      setSelectedDeletedIds([]);
      return;
    }

    setSelectAllMode(true);
    setSelectedDeletedIds(deletedTasks.map((t) => t.id));
  };

  const getRestoreStatus = (task) => {
    if (task?.deletedFromStatus && task.deletedFromStatus !== 'Deleted') {
      return task.deletedFromStatus;
    }
    return 'Closed';
  };

  const restoreDeletedTasks = async (taskIds) => {
    if (!taskIds.length) {
      toast.error('No deleted tasks selected.');
      return;
    }

    const confirmText = taskIds.length === 1
      ? 'Restore this task from Deleted bin?'
      : `Restore ${taskIds.length} tasks from Deleted bin?`;

    if (!window.confirm(confirmText)) return;

    try {
      setIsRestoring(true);

      if (taskIds.length === 1) {
        const task = deletedTasks.find((t) => t.id === taskIds[0]);
        if (!task) throw new Error('Task not found for restore.');

        await updateDoc(doc(db, 'tasks', task.id), {
          status: getRestoreStatus(task),
          updatedAt: serverTimestamp(),
        });
      } else {
        const batch = writeBatch(db);
        taskIds.forEach((taskId) => {
          const task = deletedTasks.find((t) => t.id === taskId);
          if (!task) return;
          batch.update(doc(db, 'tasks', taskId), {
            status: getRestoreStatus(task),
            updatedAt: serverTimestamp(),
          });
        });
        await batch.commit();
      }

      toast.success(`${taskIds.length} task${taskIds.length > 1 ? 's' : ''} restored.`);
      setSelectedDeletedIds((prev) => prev.filter((id) => !taskIds.includes(id)));
      await fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to restore selected task(s).');
    } finally {
      setIsRestoring(false);
    }
  };

  const deleteDeletedTasks = async (taskIds) => {
    if (!taskIds.length) {
      toast.error('No deleted tasks selected.');
      return;
    }

    const confirmText = taskIds.length === 1
      ? 'Permanently delete this task? This cannot be undone.'
      : `Permanently delete ${taskIds.length} tasks? This cannot be undone.`;

    if (!window.confirm(confirmText)) return;

    try {
      setIsDeleting(true);
      if (taskIds.length === 1) {
        await deleteDoc(doc(db, 'tasks', taskIds[0]));
      } else {
        const batch = writeBatch(db);
        taskIds.forEach((taskId) => batch.delete(doc(db, 'tasks', taskId)));
        await batch.commit();
      }

      toast.success(`${taskIds.length} task${taskIds.length > 1 ? 's' : ''} permanently deleted.`);
      setSelectedDeletedIds((prev) => prev.filter((id) => !taskIds.includes(id)));
      await fetchData();
    } catch (error) {
      console.error(error);
      toast.error('Failed to delete selected task(s).');
    } finally {
      setIsDeleting(false);
    }
  };

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
      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[2rem] font-bold">Tasks</h1>
          <p className="text-[var(--text-secondary)]">Track and manage work across your team.</p>
        </div>
        <div className="flex gap-2.5">
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
      <div className="mb-5 flex overflow-x-auto border-b border-[var(--border-color)]">
        {tabs.map((tab) => {
          const count =
            tab.key === 'mine'   ? myTasks.length :
            tab.key === 'review' ? reviewTasks.length :
            tab.key === 'team'   ? teamTasks.length :
            deletedTasks.length;
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
              <span className="rounded-[10px] px-[7px] py-[1px] text-[0.7rem] font-bold" style={{ background: isActive ? 'rgba(59,130,246,0.15)' : 'var(--bg-tertiary)', color: isActive ? 'var(--accent-primary)' : 'var(--text-secondary)' }}>
                {count}
              </span>
              {badge > 0 && !isActive && (
                <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-red-500 px-1 text-[0.65rem] font-bold text-white animate-pulse">
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Filters row */}
      <div className="mb-5 flex flex-wrap items-center gap-2">
        {activeTab !== 'deleted' && ['All', 'Open', 'Sent for Review', 'Closed', 'ReOpen'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="rounded-full border px-3.5 py-1.5 text-[0.78rem] transition-all"
            style={{
              background: statusFilter === s ? 'var(--accent-primary)' : 'var(--bg-tertiary)',
              color: statusFilter === s ? 'white' : 'var(--text-secondary)',
              border: `1px solid ${statusFilter === s ? 'transparent' : 'var(--border-color)'}`,
            }}
          >
            {s}
          </button>
        ))}

        {activeTab === 'deleted' && (
          <>
            <button
              onClick={toggleSelectAllDeleted}
              disabled={isRestoring || isDeleting || deletedTasks.length === 0}
              className="btn btn-secondary"
              title={selectAllMode ? 'Clear selection' : 'Select all'}
            >
              <ListChecks size={16} />
            </button>

            {selectAllMode ? (
              <>
                <button
                  onClick={() => restoreDeletedTasks(deletedTasks.map((t) => t.id))}
                  disabled={isRestoring || isDeleting || deletedTasks.length === 0}
                  className="btn btn-secondary"
                  title="Restore all"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={() => deleteDeletedTasks(deletedTasks.map((t) => t.id))}
                  disabled={isRestoring || isDeleting || deletedTasks.length === 0}
                  className="btn btn-danger"
                  title="Delete all permanently"
                >
                  <Trash2 size={16} />
                </button>
              </>
            ) : selectedDeletedIds.length > 0 ? (
              <>
                <button
                  onClick={() => restoreDeletedTasks(selectedDeletedIds)}
                  disabled={isRestoring || isDeleting}
                  className="btn btn-secondary"
                  title="Restore selected"
                >
                  <RotateCcw size={16} />
                </button>
                <button
                  onClick={() => deleteDeletedTasks(selectedDeletedIds)}
                  disabled={isRestoring || isDeleting}
                  className="btn btn-danger"
                  title="Delete selected permanently"
                >
                  <Trash2 size={16} />
                </button>
              </>
            ) : null}
          </>
        )}

        {/* User filter — only on team tab */}
        {activeTab === 'team' && (
          <select
            value={userFilter}
            onChange={(e) => setUserFilter(e.target.value)}
            className="ml-auto cursor-pointer rounded-full border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-3.5 py-1.5 text-[0.78rem] text-white"
            style={{
              marginLeft: 'auto',
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
        <div className="glass-panel px-8 py-12 text-center">
          <div className="mb-3 text-[2.5rem]">
            {activeTab === 'review' ? '✅' : activeTab === 'team' ? '📊' : activeTab === 'deleted' ? '🗑️' : '📋'}
          </div>
          <p className="text-[var(--text-secondary)]">
            {activeTab === 'review'
              ? "No tasks awaiting your review."
              : activeTab === 'team'
              ? 'No tasks match the selected filter.'
              : activeTab === 'deleted'
              ? 'No deleted tasks available for you.'
              : 'No tasks assigned to you yet.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {displayTasks.map((task) => (
            <div key={task.id} className="flex items-start gap-3">
              {activeTab === 'deleted' && (
                <input
                  type="checkbox"
                  checked={selectedDeletedIds.includes(task.id)}
                  onChange={() => toggleDeletedSelection(task.id)}
                  className="mt-5 h-4 w-4 cursor-pointer"
                />
              )}
              <div className="flex-1">
                <TaskCard task={task} />
              </div>
              {activeTab === 'deleted' && (
                <div className="mt-3 flex flex-col gap-2">
                  <button
                    onClick={() => restoreDeletedTasks([task.id])}
                    disabled={isRestoring || isDeleting}
                    className="btn btn-secondary"
                    title="Restore"
                  >
                    <RotateCcw size={14} />
                  </button>
                  <button
                    onClick={() => deleteDeletedTasks([task.id])}
                    disabled={isRestoring || isDeleting}
                    className="btn btn-danger"
                    title="Delete permanently"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}