import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from './LoadingSpinner';

export default function ProtectedRoute({ children, allowedRoles }) {
  const {
    currentUser,
    userProfile,
    isPendingApproval,
    isRejected,
    signupRequest,
    logout,
    isFetchingProfile,
  } = useAuth();
  const navigate = useNavigate();

  if (isFetchingProfile) return <LoadingSpinner />;

  if (!currentUser) return <Navigate to="/login" replace />;

  // ── Rejected ──────────────────────────────────────────────────────────────
  if (isRejected) {
    return (
      <div style={fullPageCenter}>
        <div style={iconCircle('var(--danger)', 'rgba(239,68,68,0.1)')}>✕</div>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', color: 'var(--danger)' }}>
          Request Rejected
        </h2>
        <p style={subText}>
          Unfortunately, your signup request was not approved. Please contact a
          Director or Manager for assistance.
        </p>
        <button
          onClick={() => logout().then(() => navigate('/login'))}
          className="btn btn-secondary"
          style={{ marginTop: '0.5rem' }}
        >
          Back to Login
        </button>
      </div>
    );
  }

  // ── Pending approval ───────────────────────────────────────────────────────
  if (isPendingApproval) {
    return (
      <div style={fullPageCenter}>
        <div style={{ position: 'relative', width: '80px', height: '80px', margin: '0 auto' }}>
          <div style={{
            width: '80px', height: '80px', borderRadius: '50%',
            border: '3px solid rgba(99,102,241,0.15)',
            borderTopColor: 'var(--accent-primary)',
            animation: 'spin 1.2s linear infinite',
          }} />
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.75rem' }}>
            ⏳
          </div>
        </div>

        <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Awaiting Approval</h2>
        <p style={subText}>
          Hi <strong style={{ color: 'white' }}>{signupRequest?.name}</strong>, your account
          request is pending review. You'll gain access once it's approved by a Director,
          Operation Manager, or Manager - Technical Architect.
        </p>

        <div className="glass-panel" style={{ padding: '1rem 1.5rem', maxWidth: '360px', width: '100%', textAlign: 'left', marginTop: '0.5rem' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.875rem' }}>
            <Row label="Name" value={signupRequest?.name} />
            <Row label="Email" value={signupRequest?.email} />
            <Row label="Requested Role" value={signupRequest?.role} />
            <Row label="Status">
              <span style={{ padding: '2px 10px', borderRadius: '12px', background: 'rgba(245,158,11,0.15)', color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold' }}>
                Pending
              </span>
            </Row>
          </div>
        </div>

        <button
          onClick={() => logout().then(() => navigate('/login'))}
          className="btn btn-secondary"
          style={{ marginTop: '0.5rem' }}
        >
          Log Out
        </button>
      </div>
    );
  }

  // ── No profile (edge case) ─────────────────────────────────────────────────
  if (!userProfile) {
    return (
      <div style={fullPageCenter}>
        <h2 style={{ color: 'var(--warning)' }}>Profile Setup Incomplete</h2>
        <p style={subText}>Your user profile is missing. Please contact your administrator.</p>
        <button onClick={() => logout().then(() => navigate('/login'))} className="btn btn-secondary">
          Log Out
        </button>
      </div>
    );
  }

  // ── Role guard ─────────────────────────────────────────────────────────────
  if (allowedRoles?.length > 0 && !allowedRoles.includes(userProfile.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function Row({ label, value, children }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
      <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>{label}</span>
      <span style={{ fontWeight: '500' }}>{children ?? value}</span>
    </div>
  );
}

const fullPageCenter = {
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', minHeight: '100vh', gap: '1rem',
  padding: '2rem', textAlign: 'center', background: 'var(--bg-primary)',
};
const subText = {
  color: 'var(--text-secondary)', maxWidth: '440px', lineHeight: '1.6',
};
function iconCircle(borderColor, bg) {
  return {
    width: '72px', height: '72px', borderRadius: '50%',
    background: bg, border: `2px solid ${borderColor}`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: '2rem', margin: '0 auto',
  };
}
