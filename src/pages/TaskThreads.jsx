import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { db } from '../firebase';
import {
  collection, addDoc, getDocs, getDoc,
  doc, serverTimestamp, query, orderBy, deleteDoc,
} from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, Plus, MessageSquare, X, Trash2 } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import toast from 'react-hot-toast';
import { isManager } from '../constants/roles';

const inputClass = 'w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-3.5 text-[0.95rem] text-white outline-none resize-y';
const labelClass = 'mb-2 block text-[0.82rem] font-medium uppercase tracking-[0.04em] text-[var(--text-secondary)]';

function fmt(ts) {
  if (!ts) return '—';
  const date = ts?.toDate ? ts.toDate() : new Date(ts);
  return date.toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TaskThreads() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [task, setTask] = useState(null);
  const [threads, setThreads] = useState([]);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showNewThread, setShowNewThread] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDescription, setNewDescription] = useState('');

  const role = userProfile?.role;
  const uid = userProfile?.id;
  const manager = isManager(role);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [taskDoc, usersSnap, threadsSnap] = await Promise.all([
        getDoc(doc(db, 'tasks', id)),
        getDocs(collection(db, 'users')),
        getDocs(query(collection(db, 'tasks', id, 'threads'), orderBy('createdAt', 'desc'))),
      ]);

      if (!taskDoc.exists()) {
        toast.error('Task not found');
        navigate('/');
        return;
      }

      setTask({ id: taskDoc.id, ...taskDoc.data() });
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));

      const threadsData = await Promise.all(
        threadsSnap.docs.map(async (d) => {
          const msgSnap = await getDocs(collection(db, 'tasks', id, 'threads', d.id, 'messages'));
          return { id: d.id, ...d.data(), messageCount: msgSnap.size };
        })
      );
      setThreads(threadsData);
    } catch (err) {
      toast.error('Failed to load threads');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (userProfile) fetchData();
  }, [fetchData, userProfile]);

  const userName = (userId) => users.find(u => u.id === userId)?.name || '—';

  async function handleCreateThread(e) {
    e.preventDefault();
    if (!newTitle.trim()) { toast.error('Thread title is required.'); return; }
    try {
      setIsSaving(true);
      await addDoc(collection(db, 'tasks', id, 'threads'), {
        title: newTitle.trim(),
        description: newDescription.trim(),
        createdBy: uid,
        createdByName: userProfile.name,
        createdAt: serverTimestamp(),
        messageCount: 0,
      });
      toast.success('Thread created!');
      setNewTitle('');
      setNewDescription('');
      setShowNewThread(false);
      fetchData();
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  async function handleDeleteThread(e, thread) {
    e.stopPropagation();
    if (!window.confirm(`Delete thread "${thread.title}"? All messages will be lost.`)) return;
    try {
      const msgsSnap = await getDocs(collection(db, 'tasks', id, 'threads', thread.id, 'messages'));
      await Promise.all(msgsSnap.docs.map(d => deleteDoc(d.ref)));
      await deleteDoc(doc(db, 'tasks', id, 'threads', thread.id));
      toast.success('Thread deleted.');
      fetchData();
    } catch (err) {
      toast.error('Error: ' + err.message);
    }
  }

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(`/task/${id}`)}
          className="btn flex items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--text-secondary)]"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <p className="text-[0.8rem] text-[var(--text-secondary)] uppercase tracking-wide mb-0.5">
            {task?.title}
          </p>
          <h1 className="m-0 text-[1.8rem] font-bold">Discussions</h1>
        </div>
        <button onClick={() => setShowNewThread(true)} className="btn btn-primary">
          <Plus size={16} /> New Thread
        </button>
      </div>

      {/* New Thread Form */}
      {showNewThread && (
        <div className="glass-panel mb-6 p-6" style={{ borderLeft: '3px solid var(--accent-primary)' }}>
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[1rem] font-semibold">Create New Thread</h3>
            <button
              onClick={() => { setShowNewThread(false); setNewTitle(''); setNewDescription(''); }}
              className="text-[var(--text-secondary)] hover:text-white"
            >
              <X size={18} />
            </button>
          </div>
          <form onSubmit={handleCreateThread} className="flex flex-col gap-4">
            <div>
              <label className={labelClass}>Thread Title <span style={{ color: 'var(--danger)' }}>*</span></label>
              <input
                type="text" value={newTitle} onChange={e => setNewTitle(e.target.value)}
                placeholder="e.g. API design discussion" className={inputClass}
                style={{ resize: 'none' }} maxLength={100}
              />
            </div>
            <div>
              <label className={labelClass}>
                Description{' '}
                <span style={{ color: 'var(--text-tertiary)', textTransform: 'none', fontSize: '0.75rem' }}>(optional)</span>
              </label>
              <textarea
                value={newDescription} onChange={e => setNewDescription(e.target.value)}
                placeholder="Brief description of what this thread is about…"
                className={inputClass} rows={3}
              />
            </div>
            <div className="flex gap-3">
              <button type="submit" className="btn btn-primary" disabled={isSaving}>
                {isSaving ? 'Creating…' : 'Create Thread'}
              </button>
              <button
                type="button"
                onClick={() => { setShowNewThread(false); setNewTitle(''); setNewDescription(''); }}
                className="btn btn-secondary"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Thread List */}
      {threads.length === 0 ? (
        <div className="glass-panel px-8 py-14 text-center">
          <div className="mb-3 text-[2.5rem]">💬</div>
          <p className="text-[1rem] font-medium text-white mb-1">No discussions yet</p>
          <p className="text-[var(--text-secondary)] text-[0.9rem]">
            Start a thread to discuss topics related to this task.
          </p>
          <button onClick={() => setShowNewThread(true)} className="btn btn-primary mt-5">
            <Plus size={16} /> Create First Thread
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {threads.map((thread) => {
            const canDelete = manager || thread.createdBy === uid;
            return (
              <div
                key={thread.id}
                className="glass-panel"
                onClick={() => navigate(`/task/${id}/threads/${thread.id}`)}
                style={{
                  padding: '1.25rem 1.5rem', cursor: 'pointer',
                  borderLeft: '3px solid transparent', transition: 'border-color 0.2s',
                }}
                onMouseEnter={e => e.currentTarget.style.borderLeftColor = 'var(--accent-primary)'}
                onMouseLeave={e => e.currentTarget.style.borderLeftColor = 'transparent'}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1">
                    <div
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
                      style={{ background: 'rgba(59,130,246,0.15)' }}
                    >
                      <MessageSquare size={16} color="var(--accent-primary)" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-[0.98rem] font-semibold mb-1">{thread.title}</h3>
                      {thread.description && (
                        <p className="text-[0.84rem] text-[var(--text-secondary)] mb-2">
                          {thread.description}
                        </p>
                      )}
                      <div className="flex flex-wrap items-center gap-3 text-[0.75rem] text-[var(--text-tertiary)]">
                        <span>
                          Started by{' '}
                          <span className="text-[var(--text-secondary)]">
                            {thread.createdByName || userName(thread.createdBy)}
                          </span>
                        </span>
                        <span>·</span>
                        <span>{fmt(thread.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className="rounded-full px-2.5 py-0.5 text-[0.75rem] font-semibold"
                      style={{ background: 'rgba(59,130,246,0.13)', color: 'var(--accent-secondary)' }}
                    >
                      {thread.messageCount} {thread.messageCount === 1 ? 'reply' : 'replies'}
                    </span>
                    {canDelete && (
                      <button
                        onClick={(e) => handleDeleteThread(e, thread)}
                        className="btn btn-danger px-2 py-1 text-[0.78rem]"
                        title="Delete thread"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}