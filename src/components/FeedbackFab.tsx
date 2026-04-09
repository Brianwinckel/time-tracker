// ============================================================
// Floating feedback button — Bug Reports + Feature Requests
// Always visible in bottom-right corner
// ============================================================

import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';

type FeedbackTab = 'bug' | 'feature';

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'ui', label: 'UI/UX' },
  { value: 'reporting', label: 'Reporting' },
  { value: 'email', label: 'Email' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'integration', label: 'Integration' },
  { value: 'admin', label: 'Admin' },
  { value: 'other', label: 'Other' },
] as const;

const PRIORITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'important', label: 'Important' },
  { value: 'nice-to-have', label: 'Nice to Have' },
] as const;

export const FeedbackFab: React.FC = () => {
  const { profile } = useAuth();
  const { state } = useApp();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<FeedbackTab>('bug');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Bug fields
  const [bugDescription, setBugDescription] = useState('');
  const [severity, setSeverity] = useState<'low' | 'medium' | 'high'>('medium');

  // Feature fields
  const [featureTitle, setFeatureTitle] = useState('');
  const [featureDescription, setFeatureDescription] = useState('');
  const [category, setCategory] = useState('general');
  const [priority, setPriority] = useState('nice-to-have');

  const resetForms = () => {
    setBugDescription('');
    setSeverity('medium');
    setFeatureTitle('');
    setFeatureDescription('');
    setCategory('general');
    setPriority('nice-to-have');
  };

  const handleSubmitBug = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bugDescription.trim() || !profile) return;
    setSubmitting(true);

    const report = {
      user_id: profile.id,
      user_email: profile.email,
      user_name: profile.name || profile.email,
      severity,
      description: bugDescription.trim(),
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

    supabase.functions.invoke('bug-report-notify', { body: report }).catch(err =>
      console.error('Bug notify email failed:', err)
    );

    setSubmitting(false);
    setSubmitted(true);
    resetForms();
    setTimeout(() => { setSubmitted(false); setOpen(false); }, 2000);
  };

  const handleSubmitFeature = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!featureTitle.trim() || !featureDescription.trim() || !profile) return;
    setSubmitting(true);

    const request = {
      user_id: profile.id,
      user_email: profile.email,
      user_name: profile.name || profile.email,
      title: featureTitle.trim(),
      description: featureDescription.trim(),
      category,
      priority,
      current_view: state.view,
    };

    const { error } = await supabase.from('feature_requests').insert(request);
    if (error) {
      console.error('Failed to submit feature request:', error.message);
      setSubmitting(false);
      alert('Failed to submit. Please try again.');
      return;
    }

    setSubmitting(false);
    setSubmitted(true);
    resetForms();
    setTimeout(() => { setSubmitted(false); setOpen(false); }, 2000);
  };

  return (
    <>
      {/* Floating button */}
      <button
        className="bug-fab"
        onClick={() => setOpen(!open)}
        title="Feedback"
        aria-label="Send feedback"
      >
        {open ? '\u2715' : '\uD83D\uDCA1'}
      </button>

      {/* Modal */}
      {open && (
        <div className="bug-modal-overlay" onClick={() => setOpen(false)}>
          <div className="bug-modal" onClick={e => e.stopPropagation()}>
            {submitted ? (
              <div className="bug-modal__success">
                <div style={{ fontSize: '2rem' }}>&#10003;</div>
                <p>{tab === 'bug' ? 'Bug reported!' : 'Feature request submitted!'} Thanks for the feedback.</p>
              </div>
            ) : (
              <>
                {/* Tab switcher */}
                <div className="feedback-tabs">
                  <button
                    type="button"
                    className={`feedback-tab ${tab === 'bug' ? 'feedback-tab--active' : ''}`}
                    onClick={() => setTab('bug')}
                  >
                    Report Bug
                  </button>
                  <button
                    type="button"
                    className={`feedback-tab ${tab === 'feature' ? 'feedback-tab--active' : ''}`}
                    onClick={() => setTab('feature')}
                  >
                    Request Feature
                  </button>
                </div>

                {/* Bug form */}
                {tab === 'bug' && (
                  <form onSubmit={handleSubmitBug}>
                    <label className="field">
                      <span>What happened?</span>
                      <textarea
                        value={bugDescription}
                        onChange={e => setBugDescription(e.target.value)}
                        placeholder="Describe the issue..."
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
                      <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>Cancel</button>
                      <button type="submit" className="btn btn--primary" disabled={!bugDescription.trim() || submitting}>
                        {submitting ? 'Submitting...' : 'Submit Bug'}
                      </button>
                    </div>
                  </form>
                )}

                {/* Feature request form */}
                {tab === 'feature' && (
                  <form onSubmit={handleSubmitFeature}>
                    <label className="field">
                      <span>Feature title</span>
                      <input
                        type="text"
                        value={featureTitle}
                        onChange={e => setFeatureTitle(e.target.value)}
                        placeholder="e.g. Weekly summary report"
                        required
                        maxLength={100}
                        autoFocus
                      />
                    </label>

                    <label className="field">
                      <span>Description</span>
                      <textarea
                        value={featureDescription}
                        onChange={e => setFeatureDescription(e.target.value)}
                        placeholder="Describe what you'd like and why it would help..."
                        rows={4}
                        required
                        maxLength={1000}
                      />
                    </label>

                    <div className="feedback-row">
                      <label className="field feedback-field-half">
                        <span>Category</span>
                        <select value={category} onChange={e => setCategory(e.target.value)}>
                          {CATEGORIES.map(c => (
                            <option key={c.value} value={c.value}>{c.label}</option>
                          ))}
                        </select>
                      </label>

                      <label className="field feedback-field-half">
                        <span>Priority</span>
                        <select value={priority} onChange={e => setPriority(e.target.value)}>
                          {PRIORITIES.map(p => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="bug-modal__meta">
                      Requested by: {profile?.name || profile?.email}
                    </div>

                    <div className="modal__actions">
                      <button type="button" className="btn btn--secondary" onClick={() => setOpen(false)}>Cancel</button>
                      <button
                        type="submit"
                        className="btn btn--primary"
                        disabled={!featureTitle.trim() || !featureDescription.trim() || submitting}
                      >
                        {submitting ? 'Submitting...' : 'Submit Request'}
                      </button>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
