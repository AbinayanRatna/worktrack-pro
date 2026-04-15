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
      <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>Signup Requests</h1>
          <p style={{ color: 'var(--text-secondary)' }}>Review and approve new account requests from your team.</p>
        </div>
        <button onClick={fetchRequests} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
        {['pending', 'approved', 'rejected'].map((s) => {
          const count = requests.filter((r) => r.status === s).length;
          const cfg = STATUS_COLORS[s];
          return (
            <button key={s} onClick={() => setFilter(s)} style={{ background: filter === s ? cfg.bg : 'var(--bg-secondary)', border: `1px solid ${filter === s ? cfg.color : 'var(--border-color)'}`, borderRadius: '12px', padding: '1rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: cfg.color }}>{count}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'capitalize', marginTop: '0.2rem' }}>{cfg.label}</div>
            </button>
          );
        })}
        <button onClick={() => setFilter('all')} style={{ background: filter === 'all' ? 'rgba(99,102,241,0.12)' : 'var(--bg-secondary)', border: `1px solid ${filter === 'all' ? 'var(--accent-primary)' : 'var(--border-color)'}`, borderRadius: '12px', padding: '1rem', cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s' }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: 'var(--accent-primary)' }}>{requests.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>Total</div>
        </button>
      </div>

      {/* List */}
      {isLoading ? <LoadingSpinner /> : filtered.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
          <Users size={48} style={{ color: 'var(--text-secondary)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>No {filter !== 'all' ? filter : ''} requests found.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {filtered.map((request) => {
            const cfg = STATUS_COLORS[request.status] || STATUS_COLORS.pending;
            const isProcesing = processingId === request.id;
            return (
              <div key={request.id} className="glass-panel" style={{ padding: '1.25rem 1.5rem', display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap', borderLeft: `3px solid ${cfg.color}` }}>
                {/* Avatar */}
                <div style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0, background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white' }}>
                  {request.name?.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex: 1, minWidth: '200px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.2rem' }}>
                    <span style={{ fontWeight: '600', fontSize: '0.95rem' }}>{request.name}</span>
                    <span style={{ padding: '2px 10px', borderRadius: '12px', fontSize: '0.7rem', fontWeight: 'bold', background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                  </div>
                  <div style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>{request.email}</div>
                  <div style={{ display: 'flex', gap: '1rem', fontSize: '0.78rem', color: 'var(--text-secondary)', flexWrap: 'wrap' }}>
                    <span style={{ color: 'var(--accent-secondary)', fontWeight: '500' }}>🎯 {request.role}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <Clock size={11} /> {formatDate(request.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Actions */}
                {request.status === 'pending' && (
                  <div style={{ display: 'flex', gap: '0.5rem', flexShrink: 0 }}>
                    <button onClick={() => handleApprove(request)} disabled={isProcesing} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.8rem', opacity: isProcesing ? 0.6 : 1 }}>
                      <CheckCircle size={15} />
                      {isProcesing ? 'Processing…' : 'Approve'}
                    </button>
                    <button onClick={() => handleReject(request)} disabled={isProcesing} className="btn btn-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.8rem', opacity: isProcesing ? 0.6 : 1 }}>
                      <XCircle size={15} /> Reject
                    </button>
                  </div>
                )}

                {request.status === 'approved' && (
                  <div style={{ fontSize: '0.75rem', color: '#10b981', textAlign: 'right', flexShrink: 0 }}>
                    <CheckCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    By {request.approvedBy}<br />
                    <span style={{ color: 'var(--text-secondary)' }}>{formatDate(request.approvedAt)}</span>
                  </div>
                )}
                {request.status === 'rejected' && (
                  <div style={{ fontSize: '0.75rem', color: '#ef4444', textAlign: 'right', flexShrink: 0 }}>
                    <XCircle size={14} style={{ display: 'inline', marginRight: '4px' }} />
                    By {request.rejectedBy}<br />
                    <span style={{ color: 'var(--text-secondary)' }}>{formatDate(request.rejectedAt)}</span>
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
