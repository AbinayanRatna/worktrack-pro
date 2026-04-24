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
  const isDelegated = task?.taskType === 'delegated';
  const creatorFinalReview = isDelegated && !!task?.delegatedReviewByCreator;
  const canCR = task && (creatorFinalReview ? isAssigner : canCloseOrReopen(role, isReviewer, isAssigner));
  
  const latestSubmission = (task?.submissions && task.submissions.length > 0)
    ? (creatorFinalReview
      ? [...task.submissions].reverse().find((s) => s.submissionType === 'lead_final') || task.submissions[task.submissions.length - 1]
      : task.submissions[task.submissions.length - 1])
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

      const nextStatus = isDelegated && !creatorFinalReview && outcome === 'Closed'
        ? 'Sent for Review'
        : outcome;

      await updateDoc(doc(db, 'tasks', task.id), {
        status: nextStatus,
        delegatedReviewByCreator: isDelegated && !creatorFinalReview && outcome === 'Closed',
        submissions: updatedSubs,
        updatedAt: serverTimestamp(),
      });
      
      toast.success(
        isDelegated && !creatorFinalReview && outcome === 'Closed'
          ? 'Approved. Sent to creator for final review.'
          : outcome === 'Closed'
            ? 'Task successfully closed!'
            : 'Task reopened for changes.'
      );
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
        <div className="p-12 text-center">
          <h2>Access Denied</h2>
          <p>You do not have permission to review this task.</p>
          <button className="btn mt-4" onClick={() => navigate(`/task/${task.id}`)}>Go Back</button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(`/task/${task.id}`)} className="btn flex items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--text-secondary)]">
          <ArrowLeft size={18} />
        </button>
        <h1 className="m-0 text-[1.8rem] font-bold">Review Submission</h1>
      </div>

      <div className="mx-auto flex max-w-[1000px] flex-col gap-6">
        <TaskSummaryHeader task={task} userName={userName} meta={meta} />

        {latestSubmission && (
          <div className="glass-panel border-l-4 border-[var(--status-open-color)] p-6">
            <h3 className="mb-2 text-[0.85rem] uppercase tracking-[0.05em] text-[var(--text-secondary)]">Latest Developer Submission</h3>
            <p className="mb-4 text-[0.8rem] text-[var(--text-tertiary)]">Submitted by {userName(latestSubmission.submittedBy)} on {fmt(latestSubmission.submittedAt)}</p>
            <div className="rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] p-5">
              <p className="m-0 whitespace-pre-wrap text-[1.05rem] leading-[1.7] text-white">{latestSubmission.note}</p>
            </div>
          </div>
        )}

        <div className="glass-panel p-8">
          <h3 className="mb-6 flex items-center gap-2 text-[1.2rem] font-bold text-[var(--status-review-color)]">
            <Search size={20} /> Reviewer Feedback
          </h3>

          <div className="flex flex-col gap-4">
            <label className="text-[0.9rem] font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]">Your Comments <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea
              rows={10} value={reviewComment} onChange={(e) => setReviewComment(e.target.value)}
              placeholder="Provide constructive feedback, approval notes, or list specific issues that need fixing…"
              className="resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 text-[1.05rem] text-white outline-none"
            />
          </div>

          <div className="mt-8 flex flex-wrap justify-end gap-4">
            <button className="btn border border-[var(--border-color)] bg-transparent px-6 py-3" onClick={() => navigate(`/task/${task.id}`)} disabled={isSaving}>Cancel</button>
            <button className="btn btn-danger flex items-center gap-2 px-6 py-3" onClick={() => handleAction('ReOpen')} disabled={isSaving}>
              <RotateCcw size={18} /> {isSaving ? 'Processing…' : 'Request Changes (ReOpen)'}
            </button>
            <button className="btn btn-success flex items-center gap-2 px-6 py-3" onClick={() => handleAction('Closed')} disabled={isSaving}>
              <CheckCircle size={18} /> {isSaving ? 'Processing…' : 'Approve & Close Task'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
