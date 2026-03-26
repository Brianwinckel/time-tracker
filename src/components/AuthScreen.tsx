// ============================================================
// Auth screen — Vercel-style login with email OTP verification
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'signin' | 'verify' | 'signup' | 'forgot' | 'reset';

export const AuthScreen: React.FC = () => {
  const { signIn, verifyOtp, signInWithGoogle, signUp, resetPassword, updatePassword } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Detect password reset redirect
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'true' || window.location.hash.includes('type=recovery')) {
      setMode('reset');
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  const clearForm = () => {
    setError('');
    setSuccess('');
    setPassword('');
    setConfirmPassword('');
    setName('');
    setOtpDigits(['', '', '', '', '', '']);
  };

  const switchMode = (newMode: AuthMode) => {
    clearForm();
    setMode(newMode);
  };

  // Handle OTP digit input
  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return; // digits only

    const newDigits = [...otpDigits];
    newDigits[index] = value.slice(-1); // only last digit
    setOtpDigits(newDigits);

    // Auto-advance to next input
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits entered
    const code = newDigits.join('');
    if (code.length === 6) {
      handleVerifyOtp(code);
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 0) return;

    const newDigits = [...otpDigits];
    for (let i = 0; i < 6; i++) {
      newDigits[i] = pasted[i] || '';
    }
    setOtpDigits(newDigits);

    // Focus last filled input or submit
    if (pasted.length === 6) {
      handleVerifyOtp(pasted);
    } else {
      otpRefs.current[pasted.length]?.focus();
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setSubmitting(true);
    setError('');
    const result = await verifyOtp(email.trim(), code);
    if (result.error) {
      setError('Invalid verification code. Please try again.');
      setOtpDigits(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    }
    setSubmitting(false);
  };

  // Send OTP to email
  const handleEmailContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubmitting(true);
    setError('');

    const result = await signIn(email.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setMode('verify');
      // Focus first OTP input after render
      setTimeout(() => otpRefs.current[0]?.focus(), 100);
    }
    setSubmitting(false);
  };

  // Handle signup
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!email.trim() || !password || !name.trim()) {
      setError('All fields are required');
      setSubmitting(false);
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setSubmitting(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setSubmitting(false);
      return;
    }

    const result = await signUp(email.trim(), password, name.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Account created! Check your email to confirm, then sign in.');
    }
    setSubmitting(false);
  };

  // Handle forgot password
  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) { setError('Enter your email address'); return; }
    setSubmitting(true);
    setError('');

    const result = await resetPassword(email.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Check your email for a password reset link.');
    }
    setSubmitting(false);
  };

  // Handle password reset
  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters');
      setSubmitting(false);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      setSubmitting(false);
      return;
    }

    const result = await updatePassword(password);
    if (result.error) {
      setError(result.error);
    } else {
      setSuccess('Password updated! You are now signed in.');
    }
    setSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
  };

  // ─── OTP Verification Screen ───
  if (mode === 'verify') {
    return (
      <div className="auth-screen">
        <div className="auth-card">
          <img src="/logo-light.svg" alt="TaskPanels" className="auth-logo" />
          <h2 className="auth-heading">Check your email</h2>
          <p className="auth-description">
            We sent a verification code to<br />
            <strong>{email}</strong>
          </p>

          <div className="otp-container" onPaste={handleOtpPaste}>
            {otpDigits.map((digit, i) => (
              <input
                key={i}
                ref={el => { otpRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={1}
                value={digit}
                onChange={e => handleOtpChange(i, e.target.value)}
                onKeyDown={e => handleOtpKeyDown(i, e)}
                className="otp-input"
                disabled={submitting}
              />
            ))}
          </div>

          {error && <p className="auth-error">{error}</p>}

          {submitting && <p className="auth-verifying">Verifying...</p>}

          <div className="auth-links">
            <button
              type="button"
              className="btn btn--link"
              onClick={async () => {
                setError('');
                const result = await signIn(email.trim());
                if (result.error) setError(result.error);
                else {
                  setOtpDigits(['', '', '', '', '', '']);
                  otpRefs.current[0]?.focus();
                  setSuccess('New code sent!');
                  setTimeout(() => setSuccess(''), 3000);
                }
              }}
            >
              Resend code
            </button>
            {success && <p className="auth-success-msg" style={{ margin: '4px 0' }}>{success}</p>}
            <button
              type="button"
              className="btn btn--link"
              onClick={() => switchMode('signin')}
            >
              Use a different email
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Main Auth Screen ───
  return (
    <div className="auth-screen">
      <div className="auth-card">
        <img src="/logo-light.svg" alt="TaskPanels" className="auth-logo" />

        {/* ─── Sign In ─── */}
        {mode === 'signin' && (
          <>
            <form onSubmit={handleEmailContinue} className="auth-form">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email Address"
                autoFocus
                required
                className="auth-email-input"
              />

              {error && <p className="auth-error">{error}</p>}

              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={submitting}
              >
                {submitting ? 'Sending code...' : 'Continue with Email'}
              </button>
            </form>

            <div className="auth-divider"><span>or</span></div>

            <button type="button" className="btn btn--google" onClick={handleGoogleSignIn}>
              <svg className="btn--google__icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="auth-links">
              <button type="button" className="btn btn--link" onClick={() => switchMode('signup')}>
                Don't have an account? <strong>Sign Up</strong>
              </button>
            </div>
          </>
        )}

        {/* ─── Sign Up ─── */}
        {mode === 'signup' && (
          <>
            <h2 className="auth-heading">Create your account</h2>
            <p className="auth-description">Get started with TaskPanels</p>

            <form onSubmit={handleSignup} className="auth-form">
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Full Name"
                autoFocus
                required
                className="auth-email-input"
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email Address"
                required
                className="auth-email-input"
              />
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Password (at least 6 characters)"
                required
                className="auth-email-input"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm Password"
                required
                className="auth-email-input"
              />

              {error && <p className="auth-error">{error}</p>}
              {success && <p className="auth-success-msg">{success}</p>}

              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={submitting}
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>

            <div className="auth-divider"><span>or</span></div>

            <button type="button" className="btn btn--google" onClick={handleGoogleSignIn}>
              <svg className="btn--google__icon" viewBox="0 0 24 24" width="18" height="18">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>

            <div className="auth-links">
              <button type="button" className="btn btn--link" onClick={() => switchMode('signin')}>
                Already have an account? <strong>Sign In</strong>
              </button>
            </div>
          </>
        )}

        {/* ─── Forgot Password ─── */}
        {mode === 'forgot' && (
          <>
            <h2 className="auth-heading">Reset your password</h2>
            <p className="auth-description">Enter your email and we'll send you a reset link.</p>

            <form onSubmit={handleForgot} className="auth-form">
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email Address"
                autoFocus
                required
                className="auth-email-input"
              />

              {error && <p className="auth-error">{error}</p>}
              {success && <p className="auth-success-msg">{success}</p>}

              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={submitting}
              >
                {submitting ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>

            <div className="auth-links">
              <button type="button" className="btn btn--link" onClick={() => switchMode('signin')}>
                Back to sign in
              </button>
            </div>
          </>
        )}

        {/* ─── Reset Password ─── */}
        {mode === 'reset' && (
          <>
            <h2 className="auth-heading">Set new password</h2>
            <p className="auth-description">Enter your new password below.</p>

            <form onSubmit={handleReset} className="auth-form">
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New Password (at least 6 characters)"
                autoFocus
                required
                className="auth-email-input"
              />
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm New Password"
                required
                className="auth-email-input"
              />

              {error && <p className="auth-error">{error}</p>}
              {success && <p className="auth-success-msg">{success}</p>}

              <button
                type="submit"
                className="btn btn--primary btn--full btn--lg"
                disabled={submitting}
              >
                {submitting ? 'Updating...' : 'Set New Password'}
              </button>
            </form>

            <div className="auth-links">
              <button type="button" className="btn btn--link" onClick={() => switchMode('signin')}>
                Back to sign in
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
