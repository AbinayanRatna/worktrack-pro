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
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate(`/task/${task.id}`)} className="btn" style={{ padding: '0.4rem 0.6rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Clock size={24} /> Full Submission History
        </h1>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <TaskSummaryHeader task={task} userName={userName} meta={meta} />

        <div className="glass-panel" style={{ padding: '2rem' }}>
          {!task.submissions || task.submissions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-tertiary)' }}>
              <p>No submissions have been made for this task yet.</p>
            </div>
          ) : (
            <div className="submission-thread">
              {task.submissions.map((sub, idx) => (
                <div key={idx} className="submission-round" style={{ marginBottom: '2.5rem' }}>
                  {/* Dev submission */}
                  <div className="submission-dev" style={{ padding: '1.5rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--status-open-color)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        Submission #{idx + 1}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{fmt(sub.submittedAt)}</span>
                    </div>
                    <p style={{ fontSize: '1rem', lineHeight: '1.7', color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>{sub.note}</p>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>Submitted by <span style={{ color: 'white' }}>{userName(sub.submittedBy)}</span></p>
                  </div>

                  {/* Reviewer response */}
                  {sub.reviewComment != null && (
                    <div className="submission-review" style={{ padding: '1.5rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: sub.outcome === 'Closed' ? 'var(--status-closed-color)' : 'var(--status-reopen-color)', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {sub.outcome === 'Closed' ? '✓ Closed' : '↩ ReOpened'}
                        </span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>{fmt(sub.reviewedAt)}</span>
                      </div>
                      <p style={{ fontSize: '1rem', lineHeight: '1.7', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>"{sub.reviewComment}"</p>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)', marginTop: '1rem' }}>Reviewed by <span style={{ color: 'white' }}>{userName(sub.reviewedBy)}</span></p>
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
