// ============================================================
// Floating bug report button + modal
// Always visible in bottom-right corner of the app
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

export const BugReport: React.FC = () => {
  const { profile } = useAuth();
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim() || !profile) return;

    setSubmitting(true);

    const report = {
      user_id: profile.id,
      user_email: profile.email,
      user_name: profile.name || profile.email,
      severity,
      description: description.trim(),
      current_view: state.view,
      user_agent: navigator.userAgent,
      screen_size: `${window.innerWidth}x${window.innerHeight}`,
      timestamp: new Date().toISOString(),
    };

    const { error } = await supabase.from('bug_reports').insert(report);

    if (error) {
      console.error('Failed to submit bug report:', error.message);
      setSubmitting(false);
      alert('Failed to submit. Please try again.');
      return;
    }

    // Send email notification (fire and forget — don't block the UI)
    supabase.functions.invoke('bug-report-notify', { body: report }).catch(err =>
      console.error('Bug notify email failed:', err)
    );

    setSubmitting(false);

    setSubmitted(true);
    setDescription('');
    setSeverity('medium');
    setTimeout(() => {
      setSubmitted(false);
      setOpen(false);
    }, 2000);
  };

  return (
    <>
      {/* Floating button */}
      <button
        className="bug-fab"
        onClick={() => setOpen(!open)}
        title="Report a bug"
        aria-label="Report a bug"
      >
        {open ? '\u2715' : '\uD83D\uDC1B'}
      </button>

      {/* Modal */}
      {open && (
        <div className="bug-modal-overlay" onClick={() => setOpen(false)}>
          <div className="bug-modal" onClick={e => e.stopPropagation()}>
            {submitted ? (
              <div className="bug-modal__success">
                <div style={{ fontSize: '2rem' }}>&#10003;</div>
                <p>Bug reported! Thanks for the feedback.</p>
              </div>
            ) : (
              <>
                <h3 className="bug-modal__title">Report a Bug</h3>
                <p className="bug-modal__desc">
                  Found something broken? Let us know and we'll fix it.
                </p>
                <form onSubmit={handleSubmit}>
                  <label className="field">
                    <span>What happened?</span>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="Describe the issue... What were you doing? What did you expect to happen?"
                      rows={4}
                      required
                      maxLength={1000}
                      autoFocus
                    />
                  </label>

                  <label className="field">
                    <span>Severity</span>
                    <div className="bug-severity-options">
                      {(['low', 'medium', 'high'] as const).map(s => (
                        <button
                          key={s}
                          type="button"
                          className={`bug-severity-btn bug-severity-btn--${s} ${severity === s ? 'bug-severity-btn--active' : ''}`}
                          onClick={() => setSeverity(s)}
                        >
                          {s === 'low' ? 'Minor' : s === 'medium' ? 'Moderate' : 'Critical'}
                        </button>
                      ))}
                    </div>
                  </label>

                  <div className="bug-modal__meta">
                    Page: {state.view} &middot; {profile?.email}
                  </div>

                  <div className="modal__actions">
                    <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="btn btn--primary"
                      disabled={!description.trim() || submitting}
                    >
                      {submitting ? 'Submitting...' : 'Submit Bug'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
