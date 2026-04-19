import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { doc, getDoc, updateDoc, serverTimestamp, collection, getDocs } from 'firebase/firestore';
import { useAuth } from '../context/AuthContext';
import { STATUS_META } from './Tasks';
import toast from 'react-hot-toast';
import { ArrowLeft, Send } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';
import TaskSummaryHeader from '../components/TaskSummaryHeader';

export default function TaskSubmit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { userProfile } = useAuth();

  const [task, setTask] = useState(null);
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [submitNote, setSubmitNote] = useState('');

  const uid = userProfile?.id;

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [taskSnap, usersSnap] = await Promise.all([
        getDoc(doc(db, 'tasks', id)),
        getDocs(collection(db, 'users')),
      ]);

      if (!taskSnap.exists()) {
        toast.error('Task not found');
        navigate('/');
        return;
      }

      setTask({ id: taskSnap.id, ...taskSnap.data() });
      setUsers(usersSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (err) {
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    if (userProfile) {
      fetchData();
    }
  }, [fetchData, userProfile]);

  const userName = (userId) => users.find((u) => u.id === userId)?.name || '—';
  const meta = task ? (STATUS_META[task.status] || STATUS_META.Open) : null;
  const isAssignee = task?.assignedTo === uid;
  const isDelegated = task?.taskType === 'delegated';
  const isLead = task?.taskLeadId === uid || task?.assignedTo === uid;
  const isWorker = (task?.workerIds || []).includes(uid);
  const canSubmit = isDelegated ? (isLead || isWorker) : isAssignee;

  async function handleSubmit() {
    if (!submitNote.trim()) {
      toast.error('Please add a submission note.');
      return;
    }
    if (!window.confirm('Submit this task for review?')) return;

    try {
      setIsSaving(true);
      const newSubmission = {
        submittedAt: new Date().toISOString(),
        submittedBy: uid,
        note: submitNote.trim(),
        reviewComment: null,
        reviewedAt: null,
        reviewedBy: null,
        outcome: null,
      };

      const nextStatus = isDelegated ? (isLead ? 'Sent for Review' : (task.status || 'Open')) : 'Sent for Review';

      await updateDoc(doc(db, 'tasks', task.id), {
        status: nextStatus,
        delegatedReviewByCreator: isDelegated && isLead ? true : !!task.delegatedReviewByCreator,
        submissions: [...(task.submissions || []), newSubmission],
        updatedAt: serverTimestamp(),
      });

      toast.success(isDelegated && !isLead ? 'Worker update submitted to task lead.' : 'Work submitted for review!');
      navigate(`/task/${task.id}`);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <LoadingSpinner />
      </Layout>
    );
  }

  if (!canSubmit) {
    return (
      <Layout>
        <div className="p-12 text-center">
          <h2>Access Denied</h2>
          <p>You cannot submit work for this task.</p>
          <button className="btn mt-4" onClick={() => navigate(`/task/${task.id}`)}>
            Go Back
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => navigate(`/task/${task.id}`)}
          className="btn flex items-center rounded-lg border border-[var(--border-color)] bg-[var(--bg-secondary)] px-2.5 py-1.5 text-[var(--text-secondary)]"
        >
          <ArrowLeft size={18} />
        </button>
        <h1 className="m-0 text-[1.8rem] font-bold">Add Submission</h1>
      </div>

      <div className="mx-auto max-w-[1000px]">
        <TaskSummaryHeader task={task} userName={userName} meta={meta} />

        <div className="glass-panel p-8">
          <h3 className="mb-6 flex items-center gap-2 text-[1.2rem] font-bold text-[var(--status-open-color)]">
            <Send size={20} /> Developer Submission Report
          </h3>

          {task.status === 'ReOpen' &&
            task.submissions?.length > 0 &&
            task.submissions[task.submissions.length - 1].reviewComment && (
              <div className="mb-6 rounded-r-lg border-l-4 border-[var(--status-reopen-color)] bg-red-500/10 p-5">
                <p className="mb-2 text-[0.85rem] font-bold uppercase tracking-[0.05em] text-[var(--status-reopen-color)]">
                  Feedback to Address
                </p>
                <p className="text-[1.05rem] italic leading-relaxed text-white">
                  "{task.submissions[task.submissions.length - 1].reviewComment}"
                </p>
              </div>
            )}

          <div className="flex min-h-[300px] flex-col gap-4">
            <label className="text-[0.9rem] font-semibold uppercase tracking-[0.04em] text-[var(--text-secondary)]">
              Work Done / Documentation <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              rows={12}
              value={submitNote}
              onChange={(e) => setSubmitNote(e.target.value)}
              placeholder="Detail your changes, provide links to PRs / documentation, or explain your approach..."
              className="min-h-[300px] resize-y rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] p-4 text-[1.05rem] text-white outline-none"
            />
          </div>

          <div className="mt-8 flex justify-end gap-4">
            <button
              className="btn border border-[var(--border-color)] bg-transparent px-6 py-3"
              onClick={() => navigate(`/task/${task.id}`)}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              className="btn btn-primary flex items-center gap-2 px-8 py-3"
              onClick={handleSubmit}
              disabled={isSaving}
            >
              {isSaving ? 'Submitting…' : isDelegated && !isLead ? 'Submit Update' : 'Submit for Review'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
