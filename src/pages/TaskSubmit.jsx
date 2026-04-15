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
  const isAssignee = task?.assignedTo === uid;

  async function handleSubmit() {
    if (!submitNote.trim()) { toast.error('Please add a submission note.'); return; }
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
      await updateDoc(doc(db, 'tasks', task.id), {
        status: 'Sent for Review',
        submissions: [...(task.submissions || []), newSubmission],
        updatedAt: serverTimestamp(),
      });
      toast.success('Work submitted for review!');
      navigate(`/task/${task.id}`);
    } catch (err) {
      toast.error('Error: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) return <Layout><LoadingSpinner /></Layout>;

  if (!isAssignee) {
    return (
      <Layout>
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <h2>Access Denied</h2>
          <p>You cannot submit work for a task you are not assigned to.</p>
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
        <h1 style={{ fontSize: '1.8rem', fontWeight: 'bold', margin: 0 }}>Add Submission</h1>
      </div>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <TaskSummaryHeader task={task} userName={userName} meta={meta} />

        <div className="glass-panel" style={{ padding: '2rem' }}>
          <h3 style={{ fontSize: '1.2rem', fontWeight: 'bold', color: 'var(--status-open-color)', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Send size={20} /> Developer Submission Report
          </h3>

          {task.status === 'ReOpen' && task.submissions?.length > 0 && task.submissions[task.submissions.length - 1].reviewComment && (
            <div style={{ marginBottom: '1.5rem', padding: '1.25rem', background: 'rgba(239,68,68,0.08)', borderLeft: '4px solid var(--status-reopen-color)', borderRadius: '0 8px 8px 0' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--status-reopen-color)', fontWeight: '700', textTransform: 'uppercase', marginBottom: '0.5rem', letterSpacing: '0.05em' }}>Feedback to Address</p>
              <p style={{ fontSize: '1.05rem', fontStyle: 'italic', lineHeight: '1.6', color: 'white' }}>"{task.submissions[task.submissions.length - 1].reviewComment}"</p>
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', minHeight: '300px' }}>
            <label style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: '600' }}>Work Done / Documentation <span style={{ color: 'var(--danger)' }}>*</span></label>
            <textarea
              rows={12} value={submitNote} onChange={(e) => setSubmitNote(e.target.value)}
              placeholder="Detail your changes, provide links to PRs / documentation, or explain your approach…"
              style={{ padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)', color: 'white', fontSize: '1.05rem', resize: 'vertical', minHeight: '300px' }}
            />
          </div>

          <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
            <button className="btn" onClick={() => navigate(`/task/${task.id}`)} disabled={isSaving} style={{ padding: '0.8rem 1.5rem', border: '1px solid var(--border-color)', background: 'transparent' }}>Cancel</button>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={isSaving} style={{ padding: '0.8rem 2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {isSaving ? 'Submitting…' : 'Submit for Review'}
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
