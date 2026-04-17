import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../constants/roles';
import toast from 'react-hot-toast';
import { Info, Eye, EyeOff } from 'lucide-react';
import PlexusBackground from '../components/PlexusBackground';

// ── Tooltip content per field ─────────────────────────────────────────────
const TOOLTIPS = {
  name: 'Enter your legal full name as it appears in company records.',
  email: 'Use your company or work email address for registration.',
  password: 'Minimum 8 characters. Use a mix of letters, numbers, and symbols.',
  confirmPassword: 'Re-enter your password exactly as you typed it above.',
  role: 'Select your current designation in the organization. A manager will verify and approve your registration.',
};

// ── Reusable field with side tooltip ─────────────────────────────────────
function FieldWithTooltip({ id, label, tooltipKey, children, focusedField, setFocusedField }) {
  const showTooltip = focusedField === tooltipKey;
  return (
    <div className="flex flex-col gap-2">
      <label className={labelClass}>{label}</label>
      <div className="tooltip-wrapper">
        {/* Clone child with focus/blur handlers injected */}
        {children({ setFocusedField, tooltipKey })}
        {showTooltip && (
          <div className="input-tooltip">
            <Info size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
            {TOOLTIPS[tooltipKey]}
          </div>
        )}
      </div>
    </div>
  );
}

const inputClass = 'w-full rounded-lg border border-[var(--border-color)] bg-[var(--bg-tertiary)] px-4 py-3 text-sm text-white outline-none transition-colors';
const labelClass = 'text-xs font-medium uppercase tracking-[0.05em] text-[var(--text-secondary)]';

export default function Login() {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [focusedField, setFocusedField] = useState(null);
  const [isResettingPassword, setIsResettingPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login, signup, resetPassword } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    if (isRegistering) {
      if (!role) { toast.error('Please select your role.'); return; }
      if (password !== confirmPassword) { toast.error('Passwords do not match.'); return; }
      if (password.length < 8) { toast.error('Password must be at least 8 characters.'); return; }
    }
    try {
      setIsProcessing(true);
      if (isRegistering) {
        await signup(email, password, name, role);
        setSignupDone(true);
      } else {
        await login(email, password);
        toast.success('Logged in successfully!');
        navigate('/');
      }
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    if (!resetEmail) { toast.error('Please enter your email.'); return; }
    try {
      setIsProcessing(true);
      await resetPassword(resetEmail);
      toast.success('Password reset email sent! Check your inbox.');
      setIsResettingPassword(false);
      setResetEmail('');
    } catch (error) {
      toast.error(getFriendlyErrorMessage(error));
    } finally {
      setIsProcessing(false);
    }
  }

  function resetForm() {
    setEmail(''); setPassword(''); setConfirmPassword('');
    setName(''); setRole(''); setSignupDone(false);
    setShowPassword(false); setShowConfirmPassword(false);
  }

  function getFriendlyErrorMessage(error) {
    if (!error.code) return error.message;
    switch (error.code) {
      case 'auth/invalid-credential':
        return 'Incorrect email or password, or the account does not exist.';
      case 'auth/user-not-found':
        return 'No account found with this email address.';
      case 'auth/wrong-password':
        return 'Incorrect password. Please try again.';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists.';
      case 'auth/weak-password':
        return 'Password is too weak. Please use at least 6 characters.';
      case 'auth/network-request-failed':
        return 'Network error. Please check your internet connection.';
      case 'auth/too-many-requests':
        return 'Too many failed login attempts. Please try again later.';
      default:
        // Fallback for unmapped errors
        return 'Authentication failed. Please try again.';
    }
  }

  // ── After successful registration ──────────────────────────────────────────
  if (signupDone) {
    return (
      <PageWrapper>
        <div className="glass-panel w-full max-w-[440px] p-10 text-center">
          <div className="mx-auto mb-6 flex h-[72px] w-[72px] items-center justify-center rounded-full border-2 border-amber-400/40 bg-gradient-to-br from-amber-500/20 to-amber-500/5 text-3xl animate-pulse">
            ⏳
          </div>
          <h2 className="mb-3 text-[1.4rem] font-bold">Request Submitted!</h2>
          <p className="mb-6 leading-relaxed text-[var(--text-secondary)]">
            Your signup request has been sent. A Director, Operation Manager, or Manager - Technical Architect will review and approve your account.
          </p>
          <div className="mb-6 flex flex-col gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 px-4 py-3.5 text-left text-sm">
            <InfoRow label="Name" value={name} />
            <InfoRow label="Email" value={email} />
            <InfoRow label="Role" value={role} />
          </div>
          <button onClick={() => { resetForm(); setIsRegistering(false); }} className="btn btn-secondary w-full">
            Back to Login
          </button>
        </div>
      </PageWrapper>
    );
  }

  // ── Forgot Password form ───────────────────────────────────────────────────
  if (isResettingPassword) {
    return (
      <PageWrapper>
        <div className="glass-panel w-full max-w-[420px] p-10">
          <div className="mb-8 text-center">
            <h1 className="mb-1 text-[1.75rem] font-bold">
              Reset Password
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">We'll send you a recovery link</p>
          </div>

          <form onSubmit={handleResetPassword} className="flex flex-col gap-4.5">
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Email Address</label>
              <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@company.com" required className={inputClass} />
            </div>

            <button
              type="submit" disabled={isProcessing} className="btn btn-primary"
              style={{ marginTop: '0.5rem', padding: '0.875rem', fontSize: '0.95rem', fontWeight: '600', opacity: isProcessing ? 0.7 : 1 }}
            >
              {isProcessing ? 'Sending…' : 'Send Recovery Email'}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[var(--text-secondary)]">
            Remembered your password?{' '}
            <button type="button" onClick={() => setIsResettingPassword(false)} className="font-medium text-[var(--accent-primary)] underline">
              Sign In
            </button>
          </p>
        </div>
      </PageWrapper>
    );
  }

  // ── Login form ─────────────────────────────────────────────────────────────
  if (!isRegistering) {
    return (
      <PageWrapper>
        <div className="glass-panel w-full max-w-[420px] p-10">
          <div className="mb-8 text-center">
            <h1 className="mb-1 text-[1.75rem] font-bold">
              WorkTrack <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
            </h1>
            <p className="text-sm text-[var(--text-secondary)]">Sign in to your workspace</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
            <div className="flex flex-col gap-2">
              <label className={labelClass}>Email Address</label>
              <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required className={inputClass} />
            </div>
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <label className={labelClass}>Password</label>
                <button type="button" onClick={() => setIsResettingPassword(true)} className="p-0 text-xs text-[var(--accent-primary)]">
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required className={`${inputClass} pr-10`} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 flex -translate-y-1/2 p-0 text-[var(--text-secondary)]">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button
              id="auth-submit" type="submit" disabled={isProcessing} className="btn btn-primary"
              style={{ marginTop: '0.5rem', padding: '0.875rem', fontSize: '0.95rem', fontWeight: '600', opacity: isProcessing ? 0.7 : 1 }}
            >
              {isProcessing ? 'Signing In…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-[var(--text-secondary)]">
            Don't have an account?{' '}
            <button type="button" onClick={() => { resetForm(); setIsRegistering(true); }} className="font-medium text-[var(--accent-primary)] underline">
              Create account
            </button>
          </p>
        </div>
      </PageWrapper>
    );
  }

  // ── Register form ──────────────────────────────────────────────────────────
  return (
    <PageWrapper>
      <div className="glass-panel w-full max-w-[480px] p-10">
        <div className="mb-8 text-center">
          <h1 className="mb-1 text-[1.75rem] font-bold">
            WorkTrack <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
          </h1>
          <p className="text-sm text-[var(--text-secondary)]">Create a new account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">

          {/* Full Name */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Full Name</label>
            <div className="tooltip-wrapper">
              <input
                id="signup-name" type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                placeholder="John Doe" required className={inputClass}
              />
              {focusedField === 'name' && <Tooltip text={TOOLTIPS.name} />}
            </div>
          </div>

          {/* Email */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Email Address</label>
            <div className="tooltip-wrapper">
              <input
                id="signup-email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="you@company.com" required className={inputClass}
              />
              {focusedField === 'email' && <Tooltip text={TOOLTIPS.email} />}
            </div>
          </div>

          {/* Password */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Password</label>
            <div className="tooltip-wrapper">
              <div className="relative">
                <input
                  id="signup-password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Min. 8 characters" required className={`${inputClass} pr-10`}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 flex -translate-y-1/2 p-0 text-[var(--text-secondary)]">
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {focusedField === 'password' && <Tooltip text={TOOLTIPS.password} />}
            </div>
          </div>

          {/* Confirm Password */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Confirm Password</label>
            <div className="tooltip-wrapper">
              <div className="relative">
                <input
                  id="signup-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Re-enter your password" required className={`${inputClass} pr-10`}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 flex -translate-y-1/2 p-0 text-[var(--text-secondary)]">
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {focusedField === 'confirmPassword' && <Tooltip text={TOOLTIPS.confirmPassword} />}
            </div>
          </div>

          {/* Role */}
          <div className="flex flex-col gap-2">
            <label className={labelClass}>Role / Designation</label>
            <div className="tooltip-wrapper">
              <select
                id="signup-role" value={role}
                onChange={(e) => setRole(e.target.value)}
                onFocus={() => setFocusedField('role')}
                onBlur={() => setFocusedField(null)}
                required
                style={{
                  cursor: 'pointer', appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', paddingRight: '2.5rem'
                }}
                className={inputClass}
              >
                <option value="" disabled>Select your designation…</option>
                {ROLES.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              {focusedField === 'role' && <Tooltip text={TOOLTIPS.role} />}
            </div>
          </div>

          <button
            id="signup-submit" type="submit" disabled={isProcessing} className="btn btn-primary"
            style={{ marginTop: '0.5rem', padding: '0.875rem', fontSize: '0.95rem', fontWeight: '600', opacity: isProcessing ? 0.7 : 1 }}
          >
            {isProcessing ? 'Submitting Request…' : 'Submit Signup Request'}
          </button>
        </form>

        <p className="mt-7 text-center text-sm text-[var(--text-secondary)]">
          Already have an account?{' '}
          <button type="button" onClick={() => { setIsRegistering(false); resetForm(); }} className="font-medium text-[var(--accent-primary)] underline">
            Sign In
          </button>
        </p>
      </div>
    </PageWrapper>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Tooltip({ text }) {
  return (
    <div className="input-tooltip">
      <Info size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle', flexShrink: 0 }} />
      {text}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between">
      <span className="text-[var(--text-secondary)]">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function PageWrapper({ children }) {
  return (
    <div className="login-container">
      <PlexusBackground />
      <div className="login-content">
        {children}
      </div>
    </div>
  );
}
