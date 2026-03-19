// ============================================================
// Daily summary screen — totals, log, export tools
// ============================================================

import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { formatDurationShort, formatDuration, formatTime, formatDateLong } from '../utils/time';
import {
  getTaskTotals,
  getGrandTotal,
  getGapTime,
  generatePlainTextSummary,
  generateEmailSummary,
  generateCSV,
  copyToClipboard,
  downloadFile,
} from '../utils/summary';

export const DailySummary: React.FC = () => {
  const { state } = useApp();
  const [copied, setCopied] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  const completedEntries = state.entries.filter(e => e.endTime);
  const taskTotals = getTaskTotals(completedEntries, state.tasks);
  const grandTotal = getGrandTotal(completedEntries);
  const gapTime = getGapTime(completedEntries);
  const tf = state.settings.timeFormat;

  const sortedEntries = [...completedEntries].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
  );

  const handleCopy = async (type: 'plain' | 'email') => {
    const data = {
      date: state.currentDate,
      entries: completedEntries,
      tasks: state.tasks,
      settings: state.settings,
      dailyNote: state.dailyNote,
    };
    const text = type === 'email'
      ? generateEmailSummary(data)
      : generatePlainTextSummary(data);

    await copyToClipboard(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCSVExport = () => {
    const csv = generateCSV(completedEntries, tf);
    downloadFile(csv, `time-tracking-${state.currentDate}.csv`, 'text/csv');
  };

  const handleTextExport = () => {
    const data = {
      date: state.currentDate,
      entries: completedEntries,
      tasks: state.tasks,
      settings: state.settings,
      dailyNote: state.dailyNote,
    };
    const text = generatePlainTextSummary(data);
    downloadFile(text, `time-summary-${state.currentDate}.txt`, 'text/plain');
  };

  const emailPreview = generateEmailSummary({
    date: state.currentDate,
    entries: completedEntries,
    tasks: state.tasks,
    settings: state.settings,
    dailyNote: state.dailyNote,
  });

  if (completedEntries.length === 0) {
    return (
      <div className="summary summary--empty">
        <h2>Daily Summary</h2>
        <p>No completed sessions yet. Start tracking to see your summary.</p>
      </div>
    );
  }

  return (
    <div className="summary">
      <div className="summary__header">
        <h2>Daily Summary — {formatDateLong(state.currentDate)}</h2>
      </div>

      {/* Task totals */}
      <div className="summary__totals">
        <h3>Time by Task</h3>
        <div className="summary__bars">
          {taskTotals.map(t => {
            const pct = grandTotal > 0 ? (t.totalMs / grandTotal) * 100 : 0;
            return (
              <div key={t.taskId} className="summary__bar-row">
                <span className="summary__bar-label">{t.taskName}</span>
                <div className="summary__bar-track">
                  <div
                    className="summary__bar-fill"
                    style={{ width: `${pct}%`, backgroundColor: t.color }}
                  />
                </div>
                <span className="summary__bar-value">{formatDurationShort(t.totalMs)}</span>
              </div>
            );
          })}
        </div>

        <div className="summary__grand-total">
          <span>Total tracked: <strong>{formatDurationShort(grandTotal)}</strong></span>
          {gapTime > 0 && (
            <span className="summary__gap">
              Untracked gaps: {formatDurationShort(gapTime)}
            </span>
          )}
        </div>
      </div>

      {/* Chronological log */}
      <div className="summary__log">
        <h3>Session Log</h3>
        <table className="summary__table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Task</th>
              <th>Duration</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {sortedEntries.map(entry => (
              <tr key={entry.id}>
                <td>
                  {formatTime(entry.startTime, tf)} – {formatTime(entry.endTime!, tf)}
                </td>
                <td>{entry.taskName}</td>
                <td>{formatDuration(entry.duration ?? 0)}</td>
                <td className="summary__note-cell">{entry.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export actions */}
      <div className="summary__actions">
        <h3>Export</h3>
        <div className="summary__action-btns">
          <button className="btn btn--primary" onClick={() => handleCopy('plain')}>
            {copied === 'plain' ? '✓ Copied!' : 'Copy Summary'}
          </button>
          <button className="btn btn--primary" onClick={() => handleCopy('email')}>
            {copied === 'email' ? '✓ Copied!' : 'Copy Email Summary'}
          </button>
          <button className="btn btn--secondary" onClick={handleTextExport}>
            Export .txt
          </button>
          <button className="btn btn--secondary" onClick={handleCSVExport}>
            Export .csv
          </button>
          <button
            className="btn btn--secondary"
            onClick={() => setShowEmail(!showEmail)}
          >
            {showEmail ? 'Hide' : 'Preview'} Email
          </button>
        </div>
      </div>

      {/* Email preview */}
      {showEmail && (
        <div className="summary__email-preview">
          <h3>Email Preview</h3>
          <pre>{emailPreview}</pre>
        </div>
      )}

      {/* Daily notes */}
      {state.dailyNote && (
        <div className="summary__notes">
          <h3>Notes</h3>
          <p>{state.dailyNote}</p>
        </div>
      )}
    </div>
  );
};
