import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { canCloseOrReopen } from '../constants/roles';
import { STATUS_META } from './Tasks';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle, RotateCcw, Search } from 'lucide-react';
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

export default function TaskReview() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();
  
  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [reviewComment, setReviewComment] = useState('');

  const uid = userProfile?.id;
  const role = userProfile?.role;

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
  const isReviewer = task?.reviewer === uid;
  const isAssigner = task?.assignedBy === uid;
  const canCR = task && canCloseOrReopen(role, isReviewer, isAssigner);
  
  const latestSubmission = (task?.submissions && task.submissions.length > 0) 
    ? task.submissions[task.submissions.length - 1] 
    : null;

  async function handleAction(outcome) {  // outcome = 'Closed' | 'ReOpen'
    if (!reviewComment.trim()) { 
      toast.error('Please add a review comment before determining an outcome.'); 
      return; 
    }
    
    const actionText = outcome === 'Closed' ? 'Approve and close' : 'Reject and ReOpen';
    if (!window.confirm(`${actionText} this task?`)) return;

    try {
      setIsSaving(true);
      const updatedSubs = [...(task.submissions || [])];
      
      if (updatedSubs.length > 0 && task.status === 'Sent for Review') {
        const last = { ...updatedSubs[updatedSubs.length - 1] };
        last.reviewComment = reviewComment.trim();
        last.reviewedAt    = new Date().toISOString();
        last.reviewedBy    = uid;
        last.outcome       = outcome;
        updatedSubs[updatedSubs.length - 1] = last;
      }

      await updateDoc(doc(db, 'tasks', task.id), {
        status: outcome,
        submissions: updatedSubs,
        updatedAt: serverTimestamp(),
      });
      
      toast.success(outcome === 'Closed' ? 'Task successfully closed!' : 'Task reopened for changes.');
      navigate(`/task/${task.id}`);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;

  if (!canCR) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Access Denied</h2>
          <p>You do not have permission to review this task.</p>
          <button className="btn" onClick={() => navigate(`/task/${task.id}`)} style={{ marginTop: '1rem' }}>Go Back</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => navigate(`/task/${task.id}`)} className="btn" style={{ padding: '0.4rem 0.6rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={18} />
        </button>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>Review Submission</h1>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <TaskSummaryHeader task={task} userName={userName} meta={meta} />

        {latestSubmission && (
          <div className="glass-panel" style={{ padding: '1.5rem', borderLeft: '4px solid var(--status-open-color)' }}>
            <h3 style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.5rem' }}>Latest Developer Submission</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginBottom: '1rem' }}>Submitted by {userName(latestSubmission.submittedBy)} on {fmt(latestSubmission.submittedAt)}</p>
            <div style={{ background: 'var(--bg-secondary)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
              <p style={{ fontSize: '1.05rem', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: 'white', margin: 0 }}>{latestSubmission.note}</p>
            </div>
          </div>
        )}

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--status-review-color)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Search size={20} /> Reviewer Feedback
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Your Comments <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea
              rows={10} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Provide constructive feedback, approval notes, or list specific issues that need fixing…"
              style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'white', fontSize: '1.05rem', resize: 'vertical' }}
            />
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
            <button className="btn" onClick={() => navigate(`/task/${task.id}`)} disabled={isSaving} style={{ padding: '0.8rem 1.5rem', border: '1px solid var(--border-color)', background: 'transparent' }}>Cancel</button>
            <button className="btn btn-danger" onClick={() => handleAction('ReOpen')} disabled={isSaving} style={{ padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <RotateCcw size={18} /> {isSaving ? 'Processing…' : 'Request Changes (ReOpen)'}
            </button>
            <button className="btn btn-success" onClick={() => handleAction('Closed')} disabled={isSaving} style={{ padding: '0.8rem 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle size={18} /> {isSaving ? 'Processing…' : 'Approve & Close Task'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
