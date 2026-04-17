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
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] p-8 text-center">
        <div className="mx-auto flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-[var(--danger)] bg-red-500/10 text-3xl">✕</div>
        <h2 className="text-[1.4rem] font-bold text-[var(--danger)]">
          Request Rejected
        </h2>
        <p className="max-w-[440px] leading-relaxed text-[var(--text-secondary)]">
          Unfortunately, your signup request was not approved. Please contact a
          Director or Manager for assistance.
        </p>
        <button
          onClick={() => logout().then(() => navigate('/login'))}
          className="btn btn-secondary mt-2"
        >
          Back to Login
        </button>
      </div>
    );
  }

  // ── Pending approval ───────────────────────────────────────────────────────
  if (isPendingApproval) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] p-8 text-center">
        <div className="relative mx-auto h-20 w-20">
          <div className="h-20 w-20 animate-spin rounded-full border-[3px] border-[rgba(99,102,241,0.15)] border-t-[var(--accent-primary)]" />
          <div className="absolute inset-0 flex items-center justify-center text-[1.75rem]">
            ⏳
          </div>
        </div>

        <h2 className="text-2xl font-bold">Awaiting Approval</h2>
        <p className="max-w-[440px] leading-relaxed text-[var(--text-secondary)]">
          Hi <strong className="text-white">{signupRequest?.name}</strong>, your account
          request is pending review. You'll gain access once it's approved by a Director,
          Operation Manager, or Manager - Technical Architect.
        </p>

        <div className="glass-panel mt-2 w-full max-w-[360px] px-6 py-4 text-left">
          <div className="flex flex-col gap-2.5 text-sm">
            <Row label="Name" value={signupRequest?.name} />
            <Row label="Email" value={signupRequest?.email} />
            <Row label="Requested Role" value={signupRequest?.role} />
            <Row label="Status">
              <span className="rounded-xl bg-amber-500/15 px-2.5 py-[2px] text-[0.75rem] font-bold text-amber-500">
                Pending
              </span>
            </Row>
          </div>
        </div>

        <button
          onClick={() => logout().then(() => navigate('/login'))}
          className="btn btn-secondary mt-2"
        >
          Log Out
        </button>
      </div>
    );
  }

  // ── No profile (edge case) ─────────────────────────────────────────────────
  if (!userProfile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--bg-primary)] p-8 text-center">
        <h2 className="text-[var(--warning)]">Profile Setup Incomplete</h2>
        <p className="max-w-[440px] leading-relaxed text-[var(--text-secondary)]">Your user profile is missing. Please contact your administrator.</p>
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
    <div className="flex items-center justify-between gap-4">
      <span className="shrink-0 text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium">{children ?? value}</span>
    </div>
  );
}
