// ============================================================
// Daily summary screen — date navigation, charts, status breakdown, export
// ============================================================

import React, { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import { formatDurationShort, formatDateLong, getToday } from '../utils/time';
import {
  getTaskTotals,
  getGrandTotal,
  getGapTime,
  getProjectTotals,
  getValueCategoryTotals,
  getValueBreakdown,
  getStatusCounts,
  getEntriesByStatus,
  generatePlainTextSummary,
  generateEmailSummary,
  generateCSV,
  copyToClipboard,
  downloadFile,
} from '../utils/summary';
import { BarChart, StackedBar, StatusCounts } from './SimpleChart';
import * as storage from '../storage';
import type { TimeEntry } from '../types';

function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export const DailySummary: React.FC = () => {
  const { state } = useApp();
  const { user } = useAuth();
  const [copied, setCopied] = useState<string | null>(null);
  const [showEmail, setShowEmail] = useState(false);

  // Date navigation — defaults to current date (today's live data)
  const [viewDate, setViewDate] = useState(state.currentDate);
  const [historicalEntries, setHistoricalEntries] = useState<TimeEntry[] | null>(null);
  const [loading, setLoading] = useState(false);

  const isToday = viewDate === state.currentDate;

  // Load entries when viewing a different date
  useEffect(() => {
    if (isToday) {
      setHistoricalEntries(null);
      return;
    }
    if (!user?.id) return;

    setLoading(true);
    storage.loadEntries(user.id, viewDate).then(entries => {
      setHistoricalEntries(entries);
      setLoading(false);
    });
  }, [viewDate, isToday, user?.id]);

  // Use today's live entries or loaded historical entries
  const entries = isToday ? state.entries : (historicalEntries ?? []);
  const completedEntries = entries.filter(e => e.endTime);
  const taskTotals = getTaskTotals(completedEntries, state.tasks);
  const projectTotals = getProjectTotals(completedEntries);
  const valueTotals = getValueCategoryTotals(completedEntries);
  const valueBreakdown = getValueBreakdown(completedEntries);
  const statusCounts = getStatusCounts(completedEntries);
  const groups = getEntriesByStatus(completedEntries);
  const grandTotal = getGrandTotal(completedEntries);
  const gapTime = getGapTime(completedEntries);
  const tf = state.settings.timeFormat;

  const summaryData = {
    date: viewDate,
    entries: completedEntries,
    tasks: state.tasks,
    settings: state.settings,
    dailyNote: isToday ? state.dailyNote : '',
  };

  const handleCopy = async (type: 'plain' | 'email') => {
    const text = type === 'email'
      ? generateEmailSummary(summaryData)
      : generatePlainTextSummary(summaryData);
    await copyToClipboard(text);
    setCopied(type);
    setTimeout(() => setCopied(null), 2000);
  };

  const handleCSVExport = () => {
    const csv = generateCSV(completedEntries, tf);
    downloadFile(csv, `time-tracking-${viewDate}.csv`, 'text/csv');
  };

  const handleSendEmail = () => {
    const emailText = generateEmailSummary(summaryData);
    const subjectMatch = emailText.match(/^Subject: (.+)$/m);
    const subject = subjectMatch ? subjectMatch[1] : `Daily Work Summary - ${formatDateLong(viewDate)}`;
    const body = emailText.replace(/^Subject: .+\n\n?/, '');
    const recipients = (state.settings.autoEmailRecipient || '')
      .split(',').map(e => e.trim()).filter(Boolean).join(',');
    const mailtoUrl = `mailto:${encodeURIComponent(recipients)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(mailtoUrl, '_blank');
  };

  const canGoForward = viewDate < getToday();

  const emailPreview = generateEmailSummary(summaryData);

  // Date navigation bar
  const dateNav = (
    <div className="summary__date-nav">
      <button
        className="btn btn--icon summary__date-arrow"
        onClick={() => setViewDate(shiftDate(viewDate, -1))}
        title="Previous day"
      >
        &#9664;
      </button>
      <div className="summary__date-center">
        <h2 className="summary__date-title">{formatDateLong(viewDate)}</h2>
        <input
          type="date"
          className="summary__date-picker"
          value={viewDate}
          max={getToday()}
          onChange={e => e.target.value && setViewDate(e.target.value)}
        />
        {isToday && <span className="summary__date-today-badge">Today</span>}
      </div>
      <button
        className="btn btn--icon summary__date-arrow"
        onClick={() => setViewDate(shiftDate(viewDate, 1))}
        title="Next day"
        disabled={!canGoForward}
      >
        &#9654;
      </button>
    </div>
  );

  if (loading) {
    return (
      <div className="summary">
        {dateNav}
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0' }}>
          Loading...
        </p>
      </div>
    );
  }

  if (completedEntries.length === 0) {
    return (
      <div className="summary summary--empty">
        {dateNav}
        <p>No completed sessions for this day.</p>
      </div>
    );
  }

  return (
    <div className="summary">
      {dateNav}

      {/* Status counts */}
      <StatusCounts counts={statusCounts} />

      {/* Charts row */}
      <div className="summary__charts">
        <BarChart
          title="Time by Project"
          data={projectTotals.map(p => ({
            label: p.project,
            value: p.totalMs,
            color: '#4A90D9',
          }))}
        />
        <BarChart
          title="Value Breakdown"
          data={valueTotals.map(v => ({
            label: v.category,
            value: v.totalMs,
            color: v.color,
          }))}
        />
      </div>

      {/* Value stacked bar */}
      <StackedBar
        title="Value Distribution"
        segments={[
          { label: 'Completed', value: valueBreakdown.completedMs, color: '#50B86C' },
          { label: 'In Progress', value: valueBreakdown.inProgressMs, color: '#F5A623' },
          { label: 'Unrealized Effort', value: valueBreakdown.unrealizedMs, color: '#607D8B' },
        ]}
      />

      {/* Task totals */}
      <div className="summary__totals">
        <BarChart
          title="Time by Task"
          data={taskTotals.map(t => ({
            label: t.taskName,
            value: t.totalMs,
            color: t.color,
          }))}
        />
        <div className="summary__grand-total">
          <span>Total tracked: <strong>{formatDurationShort(grandTotal)}</strong></span>
          {gapTime > 0 && (
            <span className="summary__gap">
              Untracked gaps: {formatDurationShort(gapTime)}
            </span>
          )}
        </div>
      </div>

      {/* Follow-up / Pass-off section */}
      {groups.followUp.length > 0 && (
        <div className="summary__section">
          <h3>Needs Follow-up / Pass-off</h3>
          {groups.followUp.map(e => (
            <div key={e.id} className="summary__followup-item">
              <strong>{e.projectId ? `${e.projectId} / ` : ''}{e.taskName}</strong>
              <span className="summary__followup-status"> — {e.sessionStatus}</span>
              {e.nextSteps && <div className="summary__followup-detail">Next step: {e.nextSteps}</div>}
              {e.blockedBy && <div className="summary__followup-detail">Waiting on: {e.blockedBy}</div>}
            </div>
          ))}
        </div>
      )}

      {/* Shelved / Scrapped */}
      {groups.shelved.length > 0 && (
        <div className="summary__section">
          <h3>Shelved / Scrapped</h3>
          {groups.shelved.map(e => (
            <div key={e.id} className="summary__followup-item">
              <strong>{e.projectId ? `${e.projectId} / ` : ''}{e.taskName}</strong>
              {e.duration && <span> — {formatDurationShort(e.duration)}</span>}
              {(e.completionNote || e.note) && (
                <div className="summary__followup-detail">Note: {e.completionNote || e.note}</div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Export actions */}
      <div className="summary__actions">
        <h3>Export</h3>
        <div className="summary__action-btns">
          <button className="btn btn--accent" onClick={handleSendEmail}>
            Send Email
          </button>
          <button className="btn btn--primary" onClick={() => handleCopy('email')}>
            {copied === 'email' ? 'Copied!' : 'Copy Email'}
          </button>
          <button className="btn btn--primary" onClick={() => handleCopy('plain')}>
            {copied === 'plain' ? 'Copied!' : 'Copy Summary'}
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
          <div className="summary__email-actions">
            <button className="btn btn--accent" onClick={handleSendEmail}>
              Send This Email
            </button>
          </div>
        </div>
      )}

      {/* Daily notes */}
      {isToday && state.dailyNote && (
        <div className="summary__notes">
          <h3>Notes</h3>
          <p>{state.dailyNote}</p>
        </div>
      )}
    </div>
  );
};
