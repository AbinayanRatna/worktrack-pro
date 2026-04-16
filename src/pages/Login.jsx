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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
      <label style={labelStyle}>{label}</label>
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
        <div className="glass-panel" style={{ width: '100%', maxWidth: '440px', padding: '2.5rem', textAlign: 'center' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg,rgba(245,158,11,0.2),rgba(245,158,11,0.05))', border: '2px solid rgba(245,158,11,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem', fontSize: '2rem', animation: 'pulse 2s infinite' }}>
            ⏳
          </div>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 'bold', marginBottom: '0.75rem' }}>Request Submitted!</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
            Your signup request has been sent. A Director, Operation Manager, or Manager - Technical Architect will review and approve your account.
          </p>
          <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: '8px', padding: '0.875rem 1rem', marginBottom: '1.5rem', textAlign: 'left', fontSize: '0.875rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <InfoRow label="Name" value={name} />
            <InfoRow label="Email" value={email} />
            <InfoRow label="Role" value={role} />
          </div>
          <button onClick={() => { resetForm(); setIsRegistering(false); }} className="btn btn-secondary" style={{ width: '100%' }}>
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
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              Reset Password
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>We'll send you a recovery link</p>
          </div>

          <form onSubmit={handleResetPassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <label style={labelStyle}>Email Address</label>
              <input type="email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} placeholder="you@company.com" required style={inputStyle} />
            </div>

            <button
              type="submit" disabled={isProcessing} className="btn btn-primary"
              style={{ marginTop: '0.5rem', padding: '0.875rem', fontSize: '0.95rem', fontWeight: '600', opacity: isProcessing ? 0.7 : 1 }}
            >
              {isProcessing ? 'Sending…' : 'Send Recovery Email'}
            </button>
          </form>

          <p style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Remembered your password?{' '}
            <button type="button" onClick={() => setIsResettingPassword(false)} style={{ color: 'var(--accent-primary)', fontWeight: '500', textDecoration: 'underline' }}>
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
        <div className="glass-panel" style={{ width: '100%', maxWidth: '420px', padding: '2.5rem' }}>
          <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
              WorkTrack <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Sign in to your workspace</p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <label style={labelStyle}>Email Address</label>
              <input id="auth-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" required style={inputStyle} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <label style={{ ...labelStyle, marginBottom: 0 }}>Password</label>
                <button type="button" onClick={() => setIsResettingPassword(true)} style={{ fontSize: '0.75rem', color: 'var(--accent-primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  Forgot?
                </button>
              </div>
              <div style={{ position: 'relative' }}>
                <input id="auth-password" type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required style={{ ...inputStyle, paddingRight: '2.5rem' }} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}>
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

          <p style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Don't have an account?{' '}
            <button type="button" onClick={() => { resetForm(); setIsRegistering(true); }} style={{ color: 'var(--accent-primary)', fontWeight: '500', textDecoration: 'underline' }}>
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
      <div className="glass-panel" style={{ width: '100%', maxWidth: '480px', padding: '2.5rem' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 'bold', marginBottom: '0.25rem' }}>
            WorkTrack <span style={{ color: 'var(--accent-primary)' }}>Pro</span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Create a new account</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>

          {/* Full Name */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <label style={labelStyle}>Full Name</label>
            <div className="tooltip-wrapper">
              <input
                id="signup-name" type="text" value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={() => setFocusedField('name')}
                onBlur={() => setFocusedField(null)}
                placeholder="John Doe" required style={inputStyle}
              />
              {focusedField === 'name' && <Tooltip text={TOOLTIPS.name} />}
            </div>
          </div>

          {/* Email */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <label style={labelStyle}>Email Address</label>
            <div className="tooltip-wrapper">
              <input
                id="signup-email" type="email" value={email}
                onChange={(e) => setEmail(e.target.value)}
                onFocus={() => setFocusedField('email')}
                onBlur={() => setFocusedField(null)}
                placeholder="you@company.com" required style={inputStyle}
              />
              {focusedField === 'email' && <Tooltip text={TOOLTIPS.email} />}
            </div>
          </div>

          {/* Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <label style={labelStyle}>Password</label>
            <div className="tooltip-wrapper">
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-password" type={showPassword ? 'text' : 'password'} value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={() => setFocusedField('password')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Min. 8 characters" required style={{ ...inputStyle, paddingRight: '2.5rem' }}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {focusedField === 'password' && <Tooltip text={TOOLTIPS.password} />}
            </div>
          </div>

          {/* Confirm Password */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <label style={labelStyle}>Confirm Password</label>
            <div className="tooltip-wrapper">
              <div style={{ position: 'relative' }}>
                <input
                  id="signup-confirm-password" type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  onFocus={() => setFocusedField('confirmPassword')}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Re-enter your password" required style={{ ...inputStyle, paddingRight: '2.5rem' }}
                />
                <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} style={{ position: 'absolute', right: '0.75rem', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                  {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {focusedField === 'confirmPassword' && <Tooltip text={TOOLTIPS.confirmPassword} />}
            </div>
          </div>

          {/* Role */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
            <label style={labelStyle}>Role / Designation</label>
            <div className="tooltip-wrapper">
              <select
                id="signup-role" value={role}
                onChange={(e) => setRole(e.target.value)}
                onFocus={() => setFocusedField('role')}
                onBlur={() => setFocusedField(null)}
                required
                style={{
                  ...inputStyle, cursor: 'pointer', appearance: 'none',
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23888' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', paddingRight: '2.5rem',
                }}
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

        <p style={{ textAlign: 'center', marginTop: '1.75rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <button type="button" onClick={() => { setIsRegistering(false); resetForm(); }} style={{ color: 'var(--accent-primary)', fontWeight: '500', textDecoration: 'underline' }}>
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
    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
      <span style={{ color: 'var(--text-secondary)' }}>{label}</span>
      <span style={{ fontWeight: '500' }}>{value}</span>
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
const inputStyle = {
  padding: '0.75rem 1rem', borderRadius: '8px',
  border: '1px solid var(--border-color)', background: 'var(--bg-tertiary)',
  color: 'white', fontSize: '0.9rem', outline: 'none',
  transition: 'border-color 0.2s', width: '100%', boxSizing: 'border-box',
};
const labelStyle = {
  fontSize: '0.8rem', fontWeight: '500', color: 'var(--text-secondary)',
  textTransform: 'uppercase', letterSpacing: '0.05em',
};
