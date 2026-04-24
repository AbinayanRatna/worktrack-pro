import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { db } from '../firebase';
import {
  collection, getDocs, getDoc, addDoc, updateDoc,
  doc, serverTimestamp,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import {
  canDeleteTask, canCloseOrReopen, canChangeDueDate,
  getAssignableUsers, canCreateTask,
} from '../constants/roles';
import { STATUS_META } from './Tasks';
import toast from 'react-hot-toast';
import { X, Send, CheckCircle, RotateCcw, Trash2, AlertCircle, ArrowLeft } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const inputClass = 'w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-3.5 text-[0.95rem] text-white outline-none resize-y';
const labelClass = 'mb-2 block text-[0.82rem] font-medium uppercase tracking-[0.04em] text-[var(--text-secondary)]';

// ── Format timestamp ───────────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function todayStr() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Colombo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date());
}

function isBeforeYmd(a, b) {
  return a < b;
}

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);

  // CREATE mode state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [isTransferable, setIsTransferable] = useState(false);
  const [taskLeadId, setTaskLeadId] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [dateAssigned, setDateAssigned] = useState(todayStr());
  const [dueDate, setDueDate] = useState('');
  const [titleError, setTitleError] = useState('');

  // ACTION state (for existing tasks)
  const [editDueDate, setEditDueDate] = useState('');
  const [editingDueDate, setEditingDueDate] = useState(false);
  const [editingWorkers, setEditingWorkers] = useState(false);
  const [editWorkerIds, setEditWorkerIds] = useState([]);
  const [workerToAdd, setWorkerToAdd] = useState('');

  const role = userProfile?.role;
  const uid  = userProfile?.id;

  const isNew = id === 'new';
  const isReviewer  = task?.reviewer  === uid;
  const isAssignee  = task?.assignedTo === uid;
  const isAssigner  = task?.assignedBy === uid;
  const isTaskLead = task?.taskLeadId === uid;
  const canDelete   = task && canDeleteTask(role, isAssigner);
  const canCR       = task && canCloseOrReopen(role, isReviewer, isAssigner);
  const canDateEdit = task && canChangeDueDate(role, isReviewer);
  const canManageDelegation = task && (isAssigner || isTaskLead);

  const assignableUsers = getAssignableUsers(users, userProfile);
  const delegatedWorkerOptions = task
    ? assignableUsers.filter((u) =>
        u.id !== task.taskLeadId &&
        u.id !== task.assignedBy &&
        !editWorkerIds.includes(u.id)
      )
    : [];

  const addDelegatedWorker = () => {
    if (!workerToAdd) return;
    setEditWorkerIds((prev) => (prev.includes(workerToAdd) ? prev : [...prev, workerToAdd]));
    setWorkerToAdd('');
  };

  const removeDelegatedWorker = (workerId) => {
    setEditWorkerIds((prev) => prev.filter((id) => id !== workerId));
  };

  const hasDelegatedWorkerChanges = task
    ? [...editWorkerIds].sort().join(',') !== [...(task.workerIds || [])].sort().join(',')
    : false;

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      // Fetch users
      const usersSnap = await getDocs(collection(db, 'users'));
      const fetchedUsers = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      setUsers(fetchedUsers);

      if (!isNew) {
        const taskDoc = await getDoc(doc(db, 'tasks', id));
        if (taskDoc.exists()) {
          const t = { id: taskDoc.id, ...taskDoc.data() };
          setTask(t);
          setEditDueDate(t.dueDate || '');
          setEditWorkerIds(t.workerIds || []);
        } else {
          toast.error("Task not found");
          navigate('/');
        }
      } else {
        // Init create form
        setTitle(''); setDescription('');
        setAssignedTo(canCreateTask(role) && getAssignableUsers(fetchedUsers, userProfile).length > 0 ? (uid || '') : '');
        setIsTransferable(false);
        setTaskLeadId(uid || '');
        setReviewer(''); setDateAssigned(todayStr()); setDueDate(todayStr());
        setTitleError('');
      }
    } catch (err) {
      toast.error('Failed to load data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [id, isNew, navigate, role, uid, userProfile]);

  useEffect(() => {
    if (userProfile) { fetchData(); }
  }, [fetchData, userProfile]);

  const userName = (userId) => users.find((u) => u.id === userId)?.name || '—';

  // ── CREATE TASK ──────────────────────────────────────────────────────────────
  async function handleCreate(e) {
    e.preventDefault();
    const today = todayStr();
    if (title.length > 50) {
      setTitleError('Title must be 50 characters or fewer.'); return;
    }
    if (isTransferable) {
      if (!taskLeadId) { toast.error('Task lead is required for delegated tasks.'); return; }
    } else if (!assignedTo) {
      toast.error('Please select someone to assign the task to.');
      return;
    }
    if (!dateAssigned) { toast.error('Assigned date is required.'); return; }
    if (!dueDate) { toast.error('Due date is required.'); return; }
    if (isBeforeYmd(dateAssigned, today)) { toast.error('Assigned date cannot be before today.'); return; }
    if (isBeforeYmd(dueDate, today)) { toast.error('Due date cannot be before today.'); return; }
    try {
      setIsSaving(true);
      const taskType = isTransferable ? 'delegated' : 'non_delegated';

      await addDoc(collection(db, 'tasks'), {
        title: title.trim(),
        description: description.trim(),
        taskType,
        taskLeadId: isTransferable ? taskLeadId : null,
        workerIds: [],
        assignedTo: isTransferable ? taskLeadId : assignedTo,
        assignedBy: uid,
        reviewer: isTransferable ? taskLeadId : reviewer,
        dateAssigned,
        dueDate,
        status: 'Open',
        submissions: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success('Task created!');
      navigate('/');
    } catch (err) {
      toast.error('Error: ' + err.message);
      setIsSaving(false);
    }
  }

  async function handleSaveWorkers() {
    if (!task || task.taskType !== 'delegated') return;
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'tasks', task.id), {
        workerIds: editWorkerIds,
        updatedAt: serverTimestamp(),
      });
      toast.success('Worker assignments updated.');
      setEditingWorkers(false);
      fetchData();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSendToCreator() {
    if (!task || task.taskType !== 'delegated' || !isTaskLead) return;
    if (!window.confirm('Send this delegated task to creator for final approval?')) return;
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'tasks', task.id), {
        status: 'Sent for Review',
        delegatedReviewByCreator: true,
        updatedAt: serverTimestamp(),
      });
      toast.success('Sent to creator for final approval.');
      navigate(`/task/${task.id}`);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }


  // ── DELETE TASK ──────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (task?.status === 'Deleted') {
      toast('This task is already in Deleted tab.');
      return;
    }
    if (!window.confirm(`Move "${task.title}" to Deleted tasks? You can permanently delete it later from the Deleted tab.`)) return;
    try {
      setIsDeleting(true);
      await updateDoc(doc(db, 'tasks', task.id), {
        status: 'Deleted',
        deletedFromStatus: task.status,
        deletedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      toast.success('Task moved to Deleted tab.');
      navigate('/');
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsDeleting(false);
    }
  }

  // ── UPDATE DUE DATE ──────────────────────────────────────────────────────────
  async function handleSaveDueDate() {
    try {
      setIsSaving(true);
      await updateDoc(doc(db, 'tasks', task.id), { dueDate: editDueDate, updatedAt: serverTimestamp() });
      toast.success('Due date updated.');
      setEditingDueDate(false);
      fetchData(); // reload
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  const meta = task ? (STATUS_META[task.status] || STATUS_META['Open']) : null;

  if (isLoading) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Back button & header alignment */}
      <div className="page-header mb-6 flex items-center gap-4">
        <button onClick={() => navigate('/')} className="btn flex items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--text-secondary)]">
          <ArrowLeft size={18} />
        </button>
        <h1 className="m-0">
          {isNew ? 'Create New Task' : 'Task Details'}
        </h1>
      </div>

      <div className="flex h-full flex-col gap-8">
        {/* ── CREATE MODE ────────────────────────────────────────────────────── */}
        {isNew && (
          <div className="flex-1">
            <form onSubmit={handleCreate} className="flex h-full min-h-[600px] flex-col gap-6">
              {/* Row 1: Title and Reviewer */}
              <div className={isTransferable ? 'flex flex-col gap-0' : 'form-grid-2-1'}>
                <div>
                  <label className={labelClass}>Title <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text" value={title} required maxLength={50}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setTitleError(e.target.value.length > 50 ? 'Title max 50 characters.' : '');
                    }}
                    placeholder="Short task title (max 50 characters)"
                    className={`${inputClass} px-4 py-4 text-[1.1rem]`}
                    style={{ borderColor: titleError ? 'var(--danger)' : 'var(--border-color)' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                    {titleError ? <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>{titleError}</p> : <span/>}
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', margin: 0 }}>{title.length}/50</p>
                  </div>
                </div>
                {!isTransferable && (
                  <div>
                    <label className={labelClass}>Reviewer <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} required className={`${inputClass} px-4 py-4 text-[1.1rem]`}>
                      <option value="">Select reviewer…</option>
                      {users.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="form-grid-2-1 -mt-2">
                <div>
                  <label className="flex items-center gap-2 text-[0.95rem] text-white">
                    <input
                      type="checkbox"
                      checked={isTransferable}
                      onChange={(e) => setIsTransferable(e.target.checked)}
                      className="h-4 w-4"
                    />
                    <span>This task is transferable</span>
                  </label>
                </div>
              </div>

              {/* Row 2: Assigned To, Date Assigned, Due Date */}
              <div className="form-grid-3">
                {!isTransferable ? (
                  <div>
                    <label className={labelClass}>Assigned To <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required className={inputClass}>
                      <option value="">Select person…</option>
                      {assignableUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className={labelClass}>Task Lead <span style={{ color: 'var(--danger)' }}>*</span></label>
                    <select value={taskLeadId} onChange={(e) => setTaskLeadId(e.target.value)} required className={inputClass}>
                      <option value="">Select lead…</option>
                      {assignableUsers.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                <div>
                  <label className={labelClass}>Date Assigned <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="date" value={dateAssigned} min={todayStr()} required onChange={(e) => setDateAssigned(e.target.value)} className={inputClass} />
                </div>
                <div>
                  <label className={labelClass}>Due Date <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input type="date" value={dueDate} min={todayStr()} required onChange={(e) => setDueDate(e.target.value)} className={inputClass} />
                </div>
              </div>

              {/* Row 3: Description */}
              <div className="flex grow flex-col">
                <label className={labelClass}>Description <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea 
                  value={description} required onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Detailed task description…" 
                  className={`${inputClass} grow text-base`} 
                  style={{ minHeight: '300px' }}
                />
              </div>

              <div className="mt-auto border-t border-[var(--border-color)] pt-6">
                <button type="submit" className="btn btn-primary" disabled={isSaving || !!titleError} style={{ padding: '0.875rem 2rem', opacity: isSaving ? 0.7 : 1, fontSize: '1rem' }}>
                  {isSaving ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── DETAIL/EDIT MODE ────────────────────────────────────────────────── */}
        {!isNew && task && (
          <div className="flex flex-row flex-wrap items-start gap-8">
            
            <div className="flex w-full max-w-[1000px] flex-col gap-8">
              
              {/* Header info */}
              <div>
                <div className="mb-3 flex flex-wrap items-center gap-3">
                  <span className="status-badge" style={{ background: meta.bg, color: meta.color, fontSize: '0.8rem', padding: '4px 12px' }}>
                    {task.status}
                  </span>
                </div>
                <h2 className="mb-4 text-[2rem] font-bold leading-[1.3]">{task.title}</h2>
              </div>

              {/* Top Action Bar */}
              <div className="-mt-3.5 flex flex-wrap items-center gap-2.5">
                
                {/* 1. Add Submission (Primary Active) */}
                {((task.taskType !== 'delegated' && isAssignee) || (task.taskType === 'delegated' && (isTaskLead || (task.workerIds || []).includes(uid)))) && (task.status === 'Open' || task.status === 'ReOpen') && (
                  <button onClick={() => navigate(`/task/${task.id}/submit`)} className="btn btn-primary flex items-center gap-2 px-4.5 py-2 text-[0.9rem]">
                    <Send size={16} /> Add Submission
                  </button>
                )}

                {task.taskType === 'delegated' && isTaskLead && (task.status === 'Open' || task.status === 'ReOpen') && (
                  <button onClick={handleSendToCreator} className="btn btn-secondary flex items-center gap-2 px-4.5 py-2 text-[0.9rem]" disabled={isSaving}>
                    <Send size={16} /> Send to Creator
                  </button>
                )}

                {/* 2. Review Task (Primary Active) */}
                {canCR && task.status === 'Sent for Review' && (
                  <button onClick={() => navigate(`/task/${task.id}/review`)} className="btn flex items-center gap-2 border-0 px-4.5 py-2 text-[0.9rem] text-white" style={{ background: 'var(--status-review-color)' }}>
                    <CheckCircle size={16} /> Review Submission
                  </button>
                )}

                {/* 3. View History */}
                {(task.submissions?.length > 0) && (
                  <button onClick={() => navigate(`/task/${task.id}/history`)} className="btn flex items-center gap-2 border border-[var(--border-color)] bg-[var(--bg-secondary)] px-4 py-2 text-[0.85rem] text-[var(--text-primary)]">
                    View Submission History
                  </button>
                )}

                {/* 4. Delete */}
                {canDelete && task.status !== 'Deleted' && (
                  <button className="btn btn-danger flex items-center gap-2 px-4 py-2 text-[0.85rem]" onClick={handleDelete} disabled={isDeleting}>
                    <Trash2 size={14} /> {isDeleting ? 'Deleting…' : 'Move to Deleted'}
                  </button>
                )}
              </div>

              {/* Task Meta block */}
              <div className="rounded-[10px] border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-6">
                <div className="grid gap-6 text-[0.9rem]" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
                  <InfoRow label="Assigned To">{userName(task.assignedTo)}</InfoRow>
                  {task.taskType === 'delegated' && (
                    <InfoRow label="Task Lead">{userName(task.taskLeadId || task.assignedTo)}</InfoRow>
                  )}
                  {task.taskType && <InfoRow label="Task Type">{task.taskType === 'delegated' ? 'Delegated' : 'Non-delegated'}</InfoRow>}
                  <InfoRow label="Reviewer"><span style={{ color: 'var(--status-review-color)' }}>{userName(task.reviewer)}</span></InfoRow>
                  <InfoRow label="Date Assigned">{task.dateAssigned || '—'}</InfoRow>
                  <InfoRow label="Due Date">
                    {editingDueDate ? (
                      <span className="flex items-center gap-2">
                        <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} className="w-full rounded-md border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-2 py-1 text-[0.85rem] text-white" />
                        <button onClick={handleSaveDueDate} disabled={isSaving} className="btn btn-primary px-2.5 py-1 text-[0.8rem]">Save</button>
                        <button onClick={() => setEditingDueDate(false)} className="border-0 bg-transparent text-[0.8rem] text-[var(--text-secondary)]">Cancel</button>
                      </span>
                    ) : (
                      <span className="flex items-center gap-2">
                        {task.dueDate || '—'}
                        {canDateEdit && (
                          <button onClick={() => setEditingDueDate(true)} className="border-0 bg-transparent text-[0.8rem] text-[var(--accent-primary)] underline">Edit</button>
                        )}
                      </span>
                    )}
                  </InfoRow>
                  <InfoRow label="Description" fullWidth>
                    <div className="max-h-[500px] overflow-y-auto pr-4 text-base leading-[1.7] text-[var(--text-secondary)]" style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {task.description}
                    </div>
                  </InfoRow>
                  {task.taskType === 'delegated' && (
                    <InfoRow label="Delegated Workers" fullWidth>
                      {canManageDelegation && task.status !== 'Deleted' ? (
                        <div className="flex flex-col gap-2">
                          <div className="flex flex-wrap gap-2">
                            {(editWorkerIds.length > 0) ? editWorkerIds.map((workerId) => (
                              <span
                                key={workerId}
                                className="inline-flex items-center gap-2 rounded-full border border-[var(--border-color)] bg-[var(--bg-secondary)] px-3 py-1 text-[0.85rem] text-white"
                              >
                                {userName(workerId)}
                                <button
                                  type="button"
                                  onClick={() => removeDelegatedWorker(workerId)}
                                  className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[var(--bg-tertiary)] text-[var(--text-secondary)] hover:text-white"
                                  aria-label={`Remove ${userName(workerId)}`}
                                >
                                  <X size={12} />
                                </button>
                              </span>
                            )) : (
                              <span className="text-[0.85rem] text-[var(--text-secondary)]">No delegated workers selected yet.</span>
                            )}
                          </div>

                          <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                            <select
                              value={workerToAdd}
                              onChange={(e) => setWorkerToAdd(e.target.value)}
                              className={inputClass}
                            >
                              <option value="">Add a worker…</option>
                              {delegatedWorkerOptions.map((u) => (
                                <option key={u.id} value={u.id}>{u.name}</option>
                              ))}
                            </select>
                            <button
                              type="button"
                              onClick={addDelegatedWorker}
                              disabled={!workerToAdd || isSaving}
                              className="btn btn-primary px-4 py-2 text-[0.85rem]"
                            >
                              Add
                            </button>
                          </div>

                          <div className="flex gap-2">
                            <button
                              onClick={handleSaveWorkers}
                              disabled={isSaving || !hasDelegatedWorkerChanges}
                              className="btn btn-primary px-2.5 py-1 text-[0.8rem]"
                              style={{ opacity: isSaving || !hasDelegatedWorkerChanges ? 0.45 : 1, cursor: isSaving || !hasDelegatedWorkerChanges ? 'not-allowed' : 'pointer' }}
                            >
                              Save
                            </button>
                            <button onClick={() => { setEditWorkerIds(task.workerIds || []); setWorkerToAdd(''); }} disabled={isSaving || !hasDelegatedWorkerChanges} className="border-0 bg-transparent text-[0.8rem] text-[var(--text-secondary)]" style={{ opacity: isSaving || !hasDelegatedWorkerChanges ? 0.45 : 1, cursor: isSaving || !hasDelegatedWorkerChanges ? 'not-allowed' : 'pointer' }}>Reset</button>
                          </div>
                        </div>
                      ) : (
                        <span className="flex items-center gap-2">
                          {(task.workerIds || []).length > 0
                            ? task.workerIds.map((wid) => userName(wid)).join(', ')
                            : 'No delegated workers'}
                        </span>
                      )}
                    </InfoRow>
                  )}
                </div>
              </div>


              {/* ── Read-only note for others ────────────────────────────────── */}
              {!isAssignee && !canCR && (
                <div className="mt-8 flex items-center gap-2.5 rounded-lg border border-dashed border-[var(--border-color)] bg-[var(--bg-secondary)] px-5 py-4">
                  <AlertCircle size={18} color="var(--text-tertiary)" />
                  <span className="text-[0.95rem] text-[var(--text-tertiary)]">You are viewing this task in read-only mode.</span>
                </div>
              )}



            </div>
            
          </div>
        )}
      </div>
    </Layout>
  );
}

// ── Small reusable components ─────────────────────────────────────────────────
function InfoRow({ label, children, fullWidth }) {
  return (
    <div className={fullWidth ? 'col-span-full' : ''}>
      <span className="mb-1 block text-[0.75rem] uppercase tracking-[0.04em] text-[var(--text-secondary)]">{label}</span>
      <span className="text-[0.95rem] font-medium">{children}</span>
    </div>
  );
}

function Divider({ label, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
      <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
      <span style={{ fontSize: '0.75rem', fontWeight: '700', color, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ flex: 1, height: '1px', background: 'var(--border-color)' }} />
    </div>
  );
}

