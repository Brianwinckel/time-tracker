// ============================================================
// Magic link login screen
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export const AuthScreen: React.FC = () => {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;

    setSubmitting(true);
    setError('');

    const result = await signIn(email.trim());
    if (result.error) {
      setError(result.error);
    } else {
      setSent(true);
    }
    setSubmitting(false);
  };

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <h1 className="auth-title">TimeTracker</h1>
        <p className="auth-subtitle">Track your workday, one click at a time</p>

        {sent ? (
          <div className="auth-success">
            <div className="auth-success__icon">&#9993;</div>
            <h2>Check your email</h2>
            <p>
              We sent a magic link to <strong>{email}</strong>.
              Click the link in the email to sign in.
            </p>
            <button
              className="btn btn--secondary"
              onClick={() => { setSent(false); setEmail(''); }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <label className="field">
              <span>Email address</span>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoFocus
                required
              />
            </label>

            {error && <p className="auth-error">{error}</p>}

            <button
              type="submit"
              className="btn btn--primary btn--full"
              disabled={submitting || !email.trim()}
            >
              {submitting ? 'Sending...' : 'Send Magic Link'}
            </button>

            <p className="auth-hint">
              No password needed. We'll email you a secure sign-in link.
            </p>
          </form>
        )}
      </div>
    </div>
  );
};
