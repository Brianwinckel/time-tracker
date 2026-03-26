// ============================================================
// "End My Day" modal — stops active task, shows email preview,
// prompts user to send or skip
// ============================================================

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDurationShort, formatDateLong } from '../utils/time';
import { generateEmailSummary, getTaskTotals, getGrandTotal, getGapTime, copyToClipboard } from '../utils/summary';

interface Props {
  onClose: () => void;
}

export const EndMyDay: React.FC<Props> = ({ onClose }) => {
  const { state, dispatch } = useApp();
  const [copied, setCopied] = useState(false);
  const [sent, setSent] = useState(false);

  // Stop any active task first
  React.useEffect(() => {
    if (state.activeEntryId) {
      dispatch({ type: 'STOP_TASK' });
    }
  }, []);

  const completedEntries = state.entries.filter(e => e.endTime);
  const taskTotals = getTaskTotals(completedEntries, state.tasks);
  const grandTotal = getGrandTotal(completedEntries);
  const gapTime = getGapTime(completedEntries);
  const totalHours = grandTotal / 3600000;

  const summaryData = {
    date: state.currentDate,
    entries: completedEntries,
    tasks: state.tasks,
    settings: state.settings,
    dailyNote: state.dailyNote,
  };

  const emailPreview = generateEmailSummary(summaryData);

  // Warnings
  const warnings: string[] = [];
  if (state.settings.autoEmailMinHours > 0 && totalHours < state.settings.autoEmailMinHours) {
    warnings.push(`Only ${totalHours.toFixed(1)} hours tracked (minimum: ${state.settings.autoEmailMinHours}h)`);
  }
  if (state.settings.autoEmailMaxGapMin > 0) {
    // Calculate largest single gap
    const sorted = [...completedEntries]
      .filter(e => e.endTime)
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
    let largestGap = 0;
    for (let i = 1; i < sorted.length; i++) {
      const prevEnd = new Date(sorted[i - 1].endTime!).getTime();
      const nextStart = new Date(sorted[i].startTime).getTime();
      if (nextStart > prevEnd) {
        const gap = (nextStart - prevEnd) / 60000;
        if (gap > largestGap) largestGap = gap;
      }
    }
    if (largestGap > state.settings.autoEmailMaxGapMin) {
      warnings.push(`${Math.round(largestGap)}-minute untracked gap detected (max: ${state.settings.autoEmailMaxGapMin}min)`);
    }
  }

  const handleSendEmail = () => {
    const subjectMatch = emailPreview.match(/^Subject: (.+)$/m);
    const subject = subjectMatch ? subjectMatch[1] : `Daily Work Summary - ${formatDateLong(state.currentDate)}`;
    const body = emailPreview.replace(/^Subject: .+\n\n?/, '');
    const recipients = (state.settings.autoEmailRecipient || '')
      .split(',').map(e => e.trim()).filter(Boolean).join(',');

    const mailtoUrl = `mailto:${encodeURIComponent(recipients)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
    setSent(true);
  };

  const handleCopyEmail = async () => {
    await copyToClipboard(emailPreview);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="eod-overlay" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="eod-modal">
        <div className="eod-modal__header">
          <h2>End of Day</h2>
          <button className="eod-modal__close" onClick={onClose}>&times;</button>
        </div>

        {/* Quick stats */}
        <div className="eod-modal__stats">
          <div className="eod-modal__stat">
            <span className="eod-modal__stat-value">{formatDurationShort(grandTotal)}</span>
            <span className="eod-modal__stat-label">Total Tracked</span>
          </div>
          <div className="eod-modal__stat">
            <span className="eod-modal__stat-value">{taskTotals.length}</span>
            <span className="eod-modal__stat-label">Tasks</span>
          </div>
          <div className="eod-modal__stat">
            <span className="eod-modal__stat-value">{completedEntries.length}</span>
            <span className="eod-modal__stat-label">Sessions</span>
          </div>
          {gapTime > 0 && (
            <div className="eod-modal__stat eod-modal__stat--warn">
              <span className="eod-modal__stat-value">{formatDurationShort(gapTime)}</span>
              <span className="eod-modal__stat-label">Gaps</span>
            </div>
          )}
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="eod-modal__warnings">
            {warnings.map((w, i) => (
              <div key={i} className="eod-modal__warning">⚠️ {w}</div>
            ))}
            <p className="eod-modal__warning-hint">
              You can still send manually — these warnings only block the <em>automatic</em> email.
            </p>
          </div>
        )}

        {/* Email preview */}
        <div className="eod-modal__preview">
          <h3>Email Preview</h3>
          <pre>{emailPreview}</pre>
        </div>

        {/* Actions */}
        <div className="eod-modal__actions">
          {sent ? (
            <div className="eod-modal__sent">✓ Email app opened — have a great evening!</div>
          ) : (
            <>
              <button className="btn btn--accent btn--lg" onClick={handleSendEmail}>
                ✉ Send Email Now
              </button>
              <button className="btn btn--primary" onClick={handleCopyEmail}>
                {copied ? '✓ Copied!' : 'Copy to Clipboard'}
              </button>
              <button className="btn btn--secondary" onClick={onClose}>
                Skip — Don't Send
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
