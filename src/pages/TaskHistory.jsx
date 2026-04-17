import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { doc, getDoc, collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { STATUS_META } from './Tasks';
import toast from 'react-hot-toast';
import { ArrowLeft, Clock } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import TaskSummaryHeader from '../components/TaskSummaryHeader';

// ── Format timestamp helper
function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function TaskHistory() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [taskSnap, usersSnap] = await Promise.all([
        getDoc(doc(db, 'tasks', id)),
        getDocs(collection(db, 'users'))
      ]);

      if (!taskSnap.exists()) {
        toast.error("Task not found");
        return navigate('/');
      }

      setTask({ id: taskSnap.id, ...taskSnap.data() });
      setUsers(usersSnap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (userProfile) { fetchData(); }
  }, [fetchData, userProfile]);

  const userName = (userId) => users.find((u) => u.id === userId)?.name || '—';
  const meta = task ? (STATUS_META[task.status] || STATUS_META['Open']) : null;

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(`/task/${task.id}`)} className="btn flex items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--text-secondary)]">
          <ArrowLeft size={18} />
        </button>
        <h1 className="m-0 flex items-center gap-3 text-[1.8rem] font-bold">
          <Clock size={24} /> Full Submission History
        </h1>
      </div>

      <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
        <TaskSummaryHeader task={task} userName={userName} meta={meta} />

        <div className="glass-panel p-8">
          {!task.submissions || task.submissions.length === 0 ? (
            <div className="p-12 text-center text-[var(--text-tertiary)]">
              <p>No submissions have been made for this task yet.</p>
            </div>
          ) : (
            <div className="submission-thread">
              {task.submissions.map((sub, idx) => (
                <div key={idx} className="submission-round mb-10">
                  {/* Dev submission */}
                  <div className="submission-dev p-6">
                    <div className="mb-4 flex justify-between">
                      <span className="text-[0.85rem] font-bold uppercase tracking-[0.04em] text-[var(--status-open-color)]">
                        Submission #{idx + 1}
                      </span>
                      <span className="text-[0.8rem] text-[var(--text-tertiary)]">{fmt(sub.submittedAt)}</span>
                    </div>
                    <p className="whitespace-pre-wrap text-base leading-[1.7] text-[var(--text-primary)]">{sub.note}</p>
                    <p className="mt-4 text-[0.85rem] text-[var(--text-tertiary)]">Submitted by <span className="text-white">{userName(sub.submittedBy)}</span></p>
                  </div>

                  {/* Reviewer response */}
                  {sub.reviewComment != null && (
                    <div className="submission-review p-6">
                      <div className="mb-4 flex justify-between">
                        <span className="flex items-center gap-2 text-[0.85rem] font-bold uppercase tracking-[0.04em]" style={{ color: sub.outcome === 'Closed' ? 'var(--status-closed-color)' : 'var(--status-reopen-color)' }}>
                          {sub.outcome === 'Closed' ? '✓ Closed' : '↩ ReOpened'}
                        </span>
                        <span className="text-[0.8rem] text-[var(--text-tertiary)]">{fmt(sub.reviewedAt)}</span>
                      </div>
                      <p className="whitespace-pre-wrap text-base italic leading-[1.7] text-[var(--text-primary)]">"{sub.reviewComment}"</p>
                      <p className="mt-4 text-[0.85rem] text-[var(--text-tertiary)]">Reviewed by <span className="text-white">{userName(sub.reviewedBy)}</span></p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
