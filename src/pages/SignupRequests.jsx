import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { db } from '../firebase';
import { collection, getDocs, doc, updateDoc, setDoc, query, orderBy } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { CheckCircle, XCircle, Clock, Users, RefreshCw } from 'lucide-react';
import LoadingSpinner from '../components/LoadingSpinner';

const STATUS_COLORS = {
  pending:  { bg: 'rgba(245,158,11,0.12)',  color: '#f59e0b', label: 'Pending'  },
  approved: { bg: 'rgba(16,185,129,0.12)',  color: '#10b981', label: 'Approved' },
  rejected: { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Rejected' },
};

export default function SignupRequests() {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [processingId, setProcessingId] = useState(null);

  const fetchRequests = useCallback(async () => {
    try {
      setIsLoading(true);
      const q = query(collection(db, 'signup_requests'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setRequests(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (error) {
      toast.error('Failed to fetch signup requests');
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  const handleApprove = async (request) => {
    if (!window.confirm(`Approve signup request for ${request.name} as ${request.role}?`)) return;
    try {
      setProcessingId(request.id);
      // Create user profile using the role they requested
      await setDoc(doc(db, 'users', request.id), {
        name: request.name,
        email: request.email,
        role: request.role,
        approvedAt: new Date().toISOString(),
        approvedBy: userProfile?.name || 'Manager',
      });
      await updateDoc(doc(db, 'signup_requests', request.id), {
        status: 'approved',
        approvedAt: new Date().toISOString(),
        approvedBy: userProfile?.name || 'Manager',
      });
      toast.success(`${request.name} approved as ${request.role}!`);
      fetchRequests();
    } catch (error) {
      toast.error('Failed to approve: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (request) => {
    if (!window.confirm(`Reject signup request for ${request.name}? This cannot be undone.`)) return;
    try {
      setProcessingId(request.id);
      await updateDoc(doc(db, 'signup_requests', request.id), {
        status: 'rejected',
        rejectedAt: new Date().toISOString(),
        rejectedBy: userProfile?.name || 'Manager',
      });
      toast.success(`Request from ${request.name} rejected.`);
      fetchRequests();
    } catch (error) {
      toast.error('Failed to reject: ' + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter);

  function formatDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <Layout>
      {/* Header */}
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[2rem] font-bold">Signup Requests</h1>
          <p className="text-[var(--text-secondary)]">Review and approve new account requests from your team.</p>
        </div>
        <button onClick={fetchRequests} className="btn btn-secondary flex items-center gap-2">
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="mb-6 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))' }}>
        {['pending', 'approved', 'rejected'].map((s) => {
          const count = requests.filter((r) => r.status === s).length;
          const cfg = STATUS_COLORS[s];
          return (
            <button key={s} onClick={() => setFilter(s)} className="cursor-pointer rounded-xl p-4 text-left transition-all duration-200" style={{ background: filter === s ? cfg.bg : 'var(--bg-secondary)', border: `1px solid ${filter === s ? cfg.color : 'var(--border-color)'}` }}>
              <div className="text-[1.5rem] font-bold" style={{ color: cfg.color }}>{count}</div>
              <div className="mt-1 text-[0.75rem] capitalize text-[var(--text-secondary)]">{cfg.label}</div>
            </button>
          );
        })}
        <button onClick={() => setFilter('all')} className="cursor-pointer rounded-xl p-4 text-left transition-all duration-200" style={{ background: filter === 'all' ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)', border: `1px solid ${filter === 'all' ? 'var(--accent-primary)' : 'var(--border-color)'}` }}>
          <div className="text-[1.5rem] font-bold text-[var(--accent-primary)]">{requests.length}</div>
          <div className="mt-1 text-[0.75rem] text-[var(--text-secondary)]">Total</div>
        </button>
      </div>

      {/* List */}
      {isLoading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <div className="glass-panel px-8 py-16 text-center">
          <Users size={48} className="mx-auto mb-4 text-[var(--text-secondary)]" />
          <p className="text-[var(--text-secondary)]">No {filter !== 'all' ? filter : ''} requests found.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((request) => {
            const cfg = STATUS_COLORS[request.status] || STATUS_COLORS.pending;
            const isProcesing = processingId === request.id;
            return (
              <div key={request.id} className="glass-panel flex flex-wrap items-center gap-4 px-6 py-5" style={{ borderLeft: `3px solid ${cfg.color}` }}>
                {/* Avatar */}
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white' }}>
                  {request.name?.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div className="min-w-[200px] flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2.5">
                    <span className="text-[0.95rem] font-semibold">{request.name}</span>
                    <span className="rounded-xl px-2.5 py-[2px] text-[0.7rem] font-bold" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div className="mb-1 text-[0.8rem] text-[var(--text-secondary)]">{request.email}</div>
                  <div className="flex flex-wrap gap-4 text-[0.78rem] text-[var(--text-secondary)]">
                    <span className="font-medium text-[var(--accent-secondary)]">🎯 {request.role}</span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} /> {formatDate(request.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {request.status === 'pending' && (
                  <div className="shrink-0 flex gap-2">
                    <button onClick={() => handleApprove(request)} disabled={isProcesing} className="btn btn-primary flex items-center gap-1.5 px-4 py-2 text-[0.8rem]" style={{ opacity: isProcesing ? 0.6 : 1 }}>
                      <CheckCircle size={15} />
                      {isProcesing ? 'Processing…' : 'Approve'}
                    </button>
                    <button onClick={() => handleReject(request)} disabled={isProcesing} className="btn btn-danger flex items-center gap-1.5 px-4 py-2 text-[0.8rem]" style={{ opacity: isProcesing ? 0.6 : 1 }}>
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                )}

                {request.status === 'approved' && (
                  <div className="shrink-0 text-right text-[0.75rem] text-[#10b981]">
                    <CheckCircle size={14} className="mr-1 inline" />
                    By {request.approvedBy}<br />
                    <span className="text-[var(--text-secondary)]">{formatDate(request.approvedAt)}</span>
                  </div>
                )}
                {request.status === 'rejected' && (
                  <div className="shrink-0 text-right text-[0.75rem] text-[#ef4444]">
                    <XCircle size={14} className="mr-1 inline" />
                    By {request.rejectedBy}<br />
                    <span className="text-[var(--text-secondary)]">{formatDate(request.rejectedAt)}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Layout>
  );
}
