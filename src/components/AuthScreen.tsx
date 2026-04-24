// ============================================================
// Auth screen — email OTP + Google sign-in (no passwords).
// First-time users are auto-created by signInWithOtp; the same
// 6-digit code confirms signup and returning sign-ins.
// ============================================================

import React, { useState, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { TaskPanelsLogo } from './TaskPanelsLogo';

type AuthMode = 'signin' | 'verify';

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

export const AuthScreen: React.FC = () => {
  const { signIn, verifyOtp, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  const switchMode = (newMode: AuthMode) => {
    setError('');
    setSuccess('');
    setOtp('');
    setMode(newMode);
  };

  const handleOtpInput = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 6);
    setOtp(digits);
    if (digits.length === 6) {
      handleVerifyOtp(digits);
    }
  };

  const handleVerifyOtp = async (code: string) => {
    setSubmitting(true);
    setError('');
    const result = await verifyOtp(email.trim(), code);
    if (result.error) {
      setError('Invalid verification code. Please try again.');
      setOtp('');
      otpInputRef.current?.focus();
    }
    setSubmitting(false);
  };

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
      setTimeout(() => otpInputRef.current?.focus(), 100);
    }
    setSubmitting(false);
  };

  const handleGoogleSignIn = async () => {
    setError('');
    const result = await signInWithGoogle();
    if (result.error) setError(result.error);
  };

  const Card: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f5f6fa] px-6 font-sans">
      <div className="w-full max-w-[400px] bg-white rounded-xl border border-[#dde0ea] shadow-[0_8px_24px_rgba(0,0,0,0.12)] px-10 pt-12 pb-10 text-center">
        <TaskPanelsLogo wordmark size={40} className="mb-6" />
        {children}
      </div>
    </div>
  );

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

        <div className="mt-6 mb-4 flex justify-center">
          <input
            ref={otpInputRef}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            value={otp}
            onChange={e => handleOtpInput(e.target.value)}
            disabled={submitting}
            aria-label="Verification code"
            placeholder="••••••"
            className="w-[240px] h-14 text-center text-2xl font-semibold font-mono tracking-[0.6em] pl-[0.6em] border-[1.5px] border-[#dde0ea] rounded-lg bg-[#f5f6fa] text-[#1a1a2e] outline-none transition focus:border-[#4A90D9] focus:ring-[3px] focus:ring-[#4A90D9]/15 disabled:opacity-50"
          />
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
                setOtp('');
                otpInputRef.current?.focus();
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

  return (
    <Card>
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
    </Card>
  );
};
