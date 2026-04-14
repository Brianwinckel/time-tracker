// ============================================================
// Auth screen — centered card with email OTP + Google sign-in
// Ported from legacy .auth-* CSS to Tailwind so it works under
// preview.css (the new self-contained stylesheet). Design tokens
// map to the originals:
//   bg page:     #f5f6fa (--bg-primary)
//   card:        white (--bg-secondary)
//   text body:   #1a1a2e (--text-primary)
//   text muted:  #8e90a6 (--text-muted)
//   border:      #dde0ea (--border)
//   accent:      #4A90D9 (--accent)
//   radius:      12px card / 8px input+button
//   shadow:      0 8px 24px rgba(0,0,0,0.12)
// ============================================================

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

type AuthMode = 'signin' | 'verify' | 'signup' | 'forgot' | 'reset';

// --- Shared input / button classNames (DRY + readable) ---
const inputCls =
  'w-full px-[18px] py-4 text-base text-[#1a1a2e] bg-[#f5f6fa] ' +
  'border border-[#dde0ea] rounded-lg outline-none ' +
  'transition placeholder:text-[#8e90a6]/60 ' +
  'focus:border-[#8e90a6] focus:ring-[3px] focus:ring-indigo-500/10 ' +
  'mb-3';

const primaryBtnCls =
  'w-full px-5 py-4 text-base font-medium text-white ' +
  'bg-[#1a1a2e] hover:bg-[#2a2a3e] rounded-lg transition ' +
  'disabled:opacity-50 disabled:cursor-not-allowed';

const googleBtnCls =
  'w-full flex items-center justify-center gap-2.5 px-[18px] py-4 ' +
  'text-base font-medium text-[#1a1a2e] bg-[#f5f6fa] ' +
  'border border-[#dde0ea] hover:border-[#8e90a6] hover:bg-white ' +
  'rounded-lg transition';

const linkBtnCls =
  'text-sm text-[#8e90a6] hover:text-[#1a1a2e] transition';

const errorCls = 'text-sm text-[#e85d75] mb-3 text-center';
const successCls = 'text-sm text-emerald-600 mb-3 text-center';

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

  // Card wrapper shared across every mode
  const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f5f6fa] px-6 font-sans">
      <div className="w-full max-w-[400px] bg-white rounded-xl border border-[#dde0ea] shadow-[0_8px_24px_rgba(0,0,0,0.12)] px-10 pt-12 pb-10 text-center">
        <img
          src="/logo-light.svg"
          alt="TaskPanels"
          className="h-11 w-auto block mx-auto mb-6"
        />
        {children}
      </div>
    </div>
  );

  // ─── OTP Verification Screen ───
  if (mode === 'verify') {
    return (
      <Card>
        <h2 className="text-xl font-semibold text-[#1a1a2e] mb-2 -tracking-[0.3px]">
          Check your email
        </h2>
        <p className="text-sm text-[#8e90a6] mb-6 leading-relaxed">
          We sent a verification code to<br />
          <strong className="text-[#1a1a2e]">{email}</strong>
        </p>

        <div className="flex justify-center gap-2 mt-6 mb-4" onPaste={handleOtpPaste}>
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
              className="w-12 h-14 text-center text-2xl font-semibold font-mono border-[1.5px] border-[#dde0ea] rounded-lg bg-[#f5f6fa] text-[#1a1a2e] outline-none transition focus:border-[#4A90D9] focus:ring-[3px] focus:ring-[#4A90D9]/15 disabled:opacity-50"
              disabled={submitting}
            />
          ))}
        </div>

        {error && <p className={errorCls}>{error}</p>}
        {submitting && <p className="text-sm text-[#8e90a6] text-center mt-2">Verifying...</p>}

        <div className="flex flex-col items-center gap-1.5 mt-5 pt-4 border-t border-[#dde0ea]">
          <button
            type="button"
            className={linkBtnCls}
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
          {success && <p className="text-sm text-emerald-600 my-1">{success}</p>}
          <button
            type="button"
            className={linkBtnCls}
            onClick={() => switchMode('signin')}
          >
            Use a different email
          </button>
        </div>
      </Card>
    );
  }

  // ─── Main Auth Screen ───
  return (
    <Card>
      {/* ─── Sign In ─── */}
      {mode === 'signin' && (
        <>
          <form onSubmit={handleEmailContinue} className="text-left">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email Address"
              autoFocus
              required
              className={inputCls}
            />

            {error && <p className={errorCls}>{error}</p>}

            <button type="submit" className={primaryBtnCls} disabled={submitting}>
              {submitting ? 'Sending code...' : 'Continue with Email'}
            </button>
          </form>

          <div className="flex items-center gap-4 my-6 text-xs uppercase tracking-[0.5px] text-[#8e90a6] before:flex-1 before:h-px before:bg-[#dde0ea] after:flex-1 after:h-px after:bg-[#dde0ea]">
            <span>or</span>
          </div>

          <button type="button" className={googleBtnCls} onClick={handleGoogleSignIn}>
            <svg className="shrink-0" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex flex-col items-center gap-1.5 mt-5 pt-4 border-t border-[#dde0ea]">
            <button type="button" className={linkBtnCls} onClick={() => switchMode('signup')}>
              Don't have an account? <strong className="font-semibold text-[#1a1a2e]">Sign Up</strong>
            </button>
          </div>
        </>
      )}

      {/* ─── Sign Up ─── */}
      {mode === 'signup' && (
        <>
          <h2 className="text-xl font-semibold text-[#1a1a2e] mb-2 -tracking-[0.3px]">
            Create your account
          </h2>
          <p className="text-sm text-[#8e90a6] mb-6 leading-relaxed">
            Get started with TaskPanels
          </p>

          <form onSubmit={handleSignup} className="text-left">
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Full Name"
              autoFocus
              required
              className={inputCls}
            />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email Address"
              required
              className={inputCls}
            />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password (at least 6 characters)"
              required
              className={inputCls}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm Password"
              required
              className={inputCls}
            />

            {error && <p className={errorCls}>{error}</p>}
            {success && <p className={successCls}>{success}</p>}

            <button type="submit" className={primaryBtnCls} disabled={submitting}>
              {submitting ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-4 my-6 text-xs uppercase tracking-[0.5px] text-[#8e90a6] before:flex-1 before:h-px before:bg-[#dde0ea] after:flex-1 after:h-px after:bg-[#dde0ea]">
            <span>or</span>
          </div>

          <button type="button" className={googleBtnCls} onClick={handleGoogleSignIn}>
            <svg className="shrink-0" viewBox="0 0 24 24" width="18" height="18">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          <div className="flex flex-col items-center gap-1.5 mt-5 pt-4 border-t border-[#dde0ea]">
            <button type="button" className={linkBtnCls} onClick={() => switchMode('signin')}>
              Already have an account? <strong className="font-semibold text-[#1a1a2e]">Sign In</strong>
            </button>
          </div>
        </>
      )}

      {/* ─── Forgot Password ─── */}
      {mode === 'forgot' && (
        <>
          <h2 className="text-xl font-semibold text-[#1a1a2e] mb-2 -tracking-[0.3px]">
            Reset your password
          </h2>
          <p className="text-sm text-[#8e90a6] mb-6 leading-relaxed">
            Enter your email and we'll send you a reset link.
          </p>

          <form onSubmit={handleForgot} className="text-left">
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="Email Address"
              autoFocus
              required
              className={inputCls}
            />

            {error && <p className={errorCls}>{error}</p>}
            {success && <p className={successCls}>{success}</p>}

            <button type="submit" className={primaryBtnCls} disabled={submitting}>
              {submitting ? 'Sending...' : 'Send Reset Link'}
            </button>
          </form>

          <div className="flex flex-col items-center gap-1.5 mt-5 pt-4 border-t border-[#dde0ea]">
            <button type="button" className={linkBtnCls} onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          </div>
        </>
      )}

      {/* ─── Reset Password ─── */}
      {mode === 'reset' && (
        <>
          <h2 className="text-xl font-semibold text-[#1a1a2e] mb-2 -tracking-[0.3px]">
            Set new password
          </h2>
          <p className="text-sm text-[#8e90a6] mb-6 leading-relaxed">
            Enter your new password below.
          </p>

          <form onSubmit={handleReset} className="text-left">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="New Password (at least 6 characters)"
              autoFocus
              required
              className={inputCls}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Confirm New Password"
              required
              className={inputCls}
            />

            {error && <p className={errorCls}>{error}</p>}
            {success && <p className={successCls}>{success}</p>}

            <button type="submit" className={primaryBtnCls} disabled={submitting}>
              {submitting ? 'Updating...' : 'Set New Password'}
            </button>
          </form>

          <div className="flex flex-col items-center gap-1.5 mt-5 pt-4 border-t border-[#dde0ea]">
            <button type="button" className={linkBtnCls} onClick={() => switchMode('signin')}>
              Back to sign in
            </button>
          </div>
        </>
      )}
    </Card>
  );
};
