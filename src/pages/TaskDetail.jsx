import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { db } from '../firebase';
import {
  collection, getDocs, getDoc, addDoc, updateDoc, deleteDoc,
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

export default function TaskDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);

  // CREATE mode state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [reviewer, setReviewer] = useState('');
  const [dateAssigned, setDateAssigned] = useState(todayStr());
  const [dueDate, setDueDate] = useState('');
  const [titleError, setTitleError] = useState('');

  // ACTION state (for existing tasks)
  const [editDueDate, setEditDueDate] = useState('');
  const [editingDueDate, setEditingDueDate] = useState(false);

  const role = userProfile?.role;
  const uid  = userProfile?.id;

  const isNew = id === 'new';
  const isReviewer  = task?.reviewer  === uid;
  const isAssignee  = task?.assignedTo === uid;
  const canDelete   = task && canDeleteTask(role, isReviewer);
  const canCR       = task && canCloseOrReopen(role, isReviewer);
  const canDateEdit = task && canChangeDueDate(role, isReviewer);

  const assignableUsers = getAssignableUsers(users, userProfile);

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
        } else {
          toast.error("Task not found");
          navigate('/');
        }
      } else {
        // Init create form
        setTitle(''); setDescription('');
        setAssignedTo(canCreateTask(role) && getAssignableUsers(fetchedUsers, userProfile).length > 0 ? (uid || '') : '');
        setReviewer(''); setDateAssigned(todayStr()); setDueDate('');
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
    if (title.length > 30) {
      setTitleError('Title must be 30 characters or fewer.'); return;
    }
    if (!reviewer) { toast.error('Reviewer is required.'); return; }
    if (!assignedTo) { toast.error('Please select someone to assign the task to.'); return; }
    try {
      setIsSaving(true);
      await addDoc(collection(db, 'tasks'), {
        title: title.trim(),
        description: description.trim(),
        assignedTo,
        assignedBy: uid,
        reviewer,
        dateAssigned,
        dueDate: dueDate || dateAssigned,
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


  // ── DELETE TASK ──────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!window.confirm(`Permanently delete "${task.title}"? This cannot be undone.`)) return;
    try {
      setIsSaving(true);
      await deleteDoc(doc(db, 'tasks', task.id));
      toast.success('Task deleted.');
      navigate('/');
    } catch (err) {
      toast.error('Error: ' + err.message);
      setIsSaving(false);
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
      <div className="page-header" style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate('/')} className="btn" style={{ padding: '0.4rem 0.6rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ margin: 0 }}>
          {isNew ? 'Create New Task' : 'Task Details'}
        </h1>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%' }}>
        {/* ── CREATE MODE ────────────────────────────────────────────────────── */}
        {isNew && (
          <div style={{ flex: 1 }}>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minHeight: '600px', height: '100%' }}>
              {/* Row 1: Title and Reviewer */}
              <div className="form-grid-2-1">
                <div>
                  <label style={labelSt}>Title <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <input
                    type="text" value={title} required maxLength={30}
                    onChange={(e) => {
                      setTitle(e.target.value);
                      setTitleError(e.target.value.length > 30 ? 'Title max 30 characters.' : '');
                    }}
                    placeholder="Short task title (max 30 characters)"
                    style={{ ...inputSt, borderColor: titleError ? 'var(--danger)' : 'var(--border-color)', fontSize: '1.1rem', padding: '1rem' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
                    {titleError ? <p style={{ color: 'var(--danger)', fontSize: '0.8rem', margin: 0 }}>{titleError}</p> : <span/>}
                    <p style={{ color: 'var(--text-tertiary)', fontSize: '0.75rem', margin: 0 }}>{title.length}/30</p>
                  </div>
                </div>
                <div>
                  <label style={labelSt}>Reviewer <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select value={reviewer} onChange={(e) => setReviewer(e.target.value)} required style={{ ...inputSt, padding: '1rem', fontSize: '1.1rem' }}>
                    <option value="">Select reviewer…</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Row 2: Assigned To, Date Assigned, Due Date */}
              <div className="form-grid-3">
                <div>
                  <label style={labelSt}>Assigned To <span style={{ color: 'var(--danger)' }}>*</span></label>
                  <select value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} required style={inputSt}>
                    <option value="">Select person…</option>
                    {assignableUsers.map((u) => (
                      <option key={u.id} value={u.id}>{u.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelSt}>Date Assigned</label>
                  <input type="date" value={dateAssigned} onChange={(e) => setDateAssigned(e.target.value)} style={inputSt} />
                </div>
                <div>
                  <label style={labelSt}>Due Date</label>
                  <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputSt} />
                </div>
              </div>

              {/* Row 3: Description */}
              <div style={{ display: 'flex', flexDirection: 'column', flexGrow: 1 }}>
                <label style={labelSt}>Description <span style={{ color: 'var(--danger)' }}>*</span></label>
                <textarea 
                  value={description} required onChange={(e) => setDescription(e.target.value)} 
                  placeholder="Detailed task description…" 
                  style={{ ...inputSt, fontSize: '1rem', flexGrow: 1, minHeight: '300px' }} 
                />
              </div>

              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', marginTop: 'auto' }}>
                <button type="submit" className="btn btn-primary" disabled={isSaving || !!titleError} style={{ padding: '0.875rem 2rem', opacity: isSaving ? 0.7 : 1, fontSize: '1rem' }}>
                  {isSaving ? 'Creating…' : 'Create Task'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* ── DETAIL/EDIT MODE ────────────────────────────────────────────────── */}
        {!isNew && task && (
          <div style={{ display: 'flex', flexDirection: 'row', gap: '2rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            
            <div style={{ width: '100%', maxWidth: '1000px', display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              
              {/* Header info */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <span className="status-badge" style={{ background: meta.bg, color: meta.color, fontSize: '0.8rem', padding: '4px 12px' }}>
                    {task.status}
                  </span>
                </div>
                <h2 style={{ fontSize: '2rem', fontWeight: 'bold', lineHeight: '1.3', marginBottom: '1rem' }}>{task.title}</h2>
              </div>

              {/* Top Action Bar */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap', marginTop: '-0.85rem' }}>
                
                {/* 1. Add Submission (Primary Active) */}
                {isAssignee && (task.status === 'Open' || task.status === 'ReOpen') && (
                  <button onClick={() => navigate(`/task/${task.id}/submit`)} className="btn btn-primary" style={{ padding: '0.55rem 1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.9rem' }}>
                    <Send size={16} /> Add Submission
                  </button>
                )}

                {/* 2. Review Task (Primary Active) */}
                {canCR && task.status === 'Sent for Review' && (
                  <button onClick={() => navigate(`/task/${task.id}/review`)} className="btn" style={{ padding: '0.55rem 1.1rem', background: 'var(--status-review-color)', color: 'white', display: 'flex', alignItems: 'center', gap: '0.5rem', border: 'none', fontSize: '0.9rem' }}>
                    <CheckCircle size={16} /> Review Submission
                  </button>
                )}

                {/* 3. View History */}
                {(task.submissions?.length > 0) && (
                  <button onClick={() => navigate(`/task/${task.id}/history`)} className="btn" style={{ padding: '0.55rem 1rem', border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}>
                    View Submission History
                  </button>
                )}

                {/* 4. Delete */}
                {canDelete && (
                  <button className="btn btn-danger" onClick={handleDelete} disabled={isSaving} style={{ padding: '0.55rem 1rem', display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}>
                    <Trash2 size={14} /> {isSaving ? 'Deleting…' : 'Delete Task'}
                  </button>
                )}
              </div>

              {/* Task Meta block */}
              <div style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '1.5rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem', fontSize: '0.9rem' }}>
                  <InfoRow label="Assigned To">{userName(task.assignedTo)}</InfoRow>
                  <InfoRow label="Reviewer"><span style={{ color: 'var(--status-review-color)' }}>{userName(task.reviewer)}</span></InfoRow>
                  <InfoRow label="Date Assigned">{task.dateAssigned || '—'}</InfoRow>
                  <InfoRow label="Due Date">
                    {editingDueDate ? (
                      <span style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <input type="date" value={editDueDate} onChange={(e) => setEditDueDate(e.target.value)} style={{ ...inputSt, padding: '0.3rem 0.5rem', fontSize: '0.85rem', marginBottom: 0 }} />
                        <button onClick={handleSaveDueDate} disabled={isSaving} className="btn btn-primary" style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem' }}>Save</button>
                        <button onClick={() => setEditingDueDate(false)} style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', cursor: 'pointer', background: 'none', border: 'none' }}>Cancel</button>
                      </span>
                    ) : (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        {task.dueDate || '—'}
                        {canDateEdit && (
                          <button onClick={() => setEditingDueDate(true)} style={{ color: 'var(--accent-primary)', fontSize: '0.8rem', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>Edit</button>
                        )}
                      </span>
                    )}
                  </InfoRow>
                  <InfoRow label="Description" fullWidth>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '1rem', lineHeight: '1.7', whiteSpace: 'pre-wrap', wordBreak: 'break-word', maxHeight: '500px', overflowY: 'auto', paddingRight: '1rem' }}>
                      {task.description}
                    </div>
                  </InfoRow>
                </div>
              </div>


              {/* ── Read-only note for others ────────────────────────────────── */}
              {!isAssignee && !canCR && (
                <div style={{ padding: '1rem 1.25rem', background: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.6rem', border: '1px dashed var(--border-color)', marginTop: '2rem' }}>
                  <AlertCircle size={18} color="var(--text-tertiary)" />
                  <span style={{ fontSize: '0.95rem', color: 'var(--text-tertiary)' }}>You are viewing this task in read-only mode.</span>
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
    <div style={fullWidth ? { gridColumn: '1 / -1' } : {}}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'block', marginBottom: '4px' }}>{label}</span>
      <span style={{ fontWeight: '500', fontSize: '0.95rem' }}>{children}</span>
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

const inputSt = {
  padding: '0.85rem 1rem', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
  color: 'white', fontSize: '0.95rem', outline: 'none',
  width: '100%', resize: 'vertical', fontFamily: 'inherit',
};
const labelSt = {
  display: 'block', fontSize: '0.82rem', fontWeight: '500',
  color: 'var(--text-secondary)', textTransform: 'uppercase',
  letterSpacing: '0.04em', marginBottom: '0.5rem',
};
