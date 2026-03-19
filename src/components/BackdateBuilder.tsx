// ============================================================
// Backdated progress report builder
// Pick a past date, add sessions manually, generate a summary
// ============================================================

import React, { useState, useEffect } from 'react';
import { v4 as uuid } from 'uuid';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import * as storage from '../storage';
import type { TimeEntry } from '../types';
import {
  formatTime,
  formatDuration,
  formatDateLong,
  calcDuration,
  getToday,
} from '../utils/time';
import {
  getTaskTotals,
  getGrandTotal,
  generatePlainTextSummary,
  generateEmailSummary,
  generateCSV,
  copyToClipboard,
  downloadFile,
  getGapTime,
} from '../utils/summary';
import { formatDurationShort } from '../utils/time';

export const BackdateBuilder: React.FC = () => {
  const { state } = useApp();
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [date, setDate] = useState('');
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [dailyNote, setDailyNote] = useState('');
  const [copied, setCopied] = useState<string | null>(null);

  // Form state for adding entries
  const [taskId, setTaskId] = useState(state.tasks[0]?.id ?? '');
  const [startStr, setStartStr] = useState('');
  const [endStr, setEndStr] = useState('');
  const [note, setNote] = useState('');

  const tf = state.settings.timeFormat;

  // Load existing entries if the date has data
  useEffect(() => {
    if (!date || !userId) return;
    const load = async () => {
      const [existing, note] = await Promise.all([
        storage.loadEntries(userId, date),
        storage.loadDailyNote(userId, date),
      ]);
      setEntries(existing);
      setDailyNote(note);
    };
    load();
  }, [date, userId]);

  const handleAddEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskId || !startStr || !endStr || !date) return;

    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Build full ISO timestamps from the date + time inputs
    const startTime = new Date(`${date}T${startStr}`).toISOString();
    const endTime = new Date(`${date}T${endStr}`).toISOString();

    const newEntry: TimeEntry = {
      id: uuid(),
      taskId,
      taskName: task.name,
      date,
      startTime,
      endTime,
      duration: calcDuration(startTime, endTime),
      note,
    };

    const updated = [...entries, newEntry].sort(
      (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
    );
    setEntries(updated);

    // Persist immediately
    storage.saveEntries(userId, date, updated);
    storage.addTrackedDate(date);

    // Reset form but keep task selected for quick repeat
    setStartStr(endStr); // next entry starts where this one ended
    setEndStr('');
    setNote('');
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!confirm('Delete this entry?')) return;
    const updated = entries.filter(e => e.id !== entryId);
    setEntries(updated);
    storage.saveEntries(userId, date, updated);
    storage.deleteEntry(entryId);
  };

  const handleSaveNote = () => {
    if (date && userId) storage.saveDailyNote(userId, date, dailyNote);
  };

  const completedEntries = entries.filter(e => e.endTime);
  const taskTotals = getTaskTotals(completedEntries, state.tasks);
  const grandTotal = getGrandTotal(completedEntries);
  const gapTime = getGapTime(completedEntries);

  const summaryData = {
    date,
    entries: completedEntries,
    tasks: state.tasks,
    settings: state.settings,
    dailyNote,
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
    downloadFile(
      generateCSV(completedEntries, tf),
      `time-tracking-${date}.csv`,
      'text/csv'
    );
  };

  return (
    <div className="backdate">
      <h2>Backdate Progress Report</h2>
      <p className="backdate__desc">
        Build a progress report for a past date you forgot to track.
      </p>

      {/* Date picker */}
      <div className="backdate__date-picker">
        <label className="field">
          <span>Select Date</span>
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            max={getToday()}
          />
        </label>
      </div>

      {date && (
        <>
          <h3 className="backdate__date-heading">{formatDateLong(date)}</h3>

          {/* Add entry form */}
          <form className="backdate__form" onSubmit={handleAddEntry}>
            <div className="backdate__form-row">
              <label className="field">
                <span>Task</span>
                <select value={taskId} onChange={e => setTaskId(e.target.value)}>
                  {state.tasks.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Start</span>
                <input
                  type="time"
                  value={startStr}
                  onChange={e => setStartStr(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>End</span>
                <input
                  type="time"
                  value={endStr}
                  onChange={e => setEndStr(e.target.value)}
                  required
                />
              </label>
              <label className="field">
                <span>Note</span>
                <input
                  type="text"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  placeholder="What specifically?"
                />
              </label>
              <button type="submit" className="btn btn--primary backdate__add-btn">
                + Add
              </button>
            </div>
          </form>

          {/* Entries list */}
          {entries.length > 0 && (
            <div className="backdate__entries">
              <h3>Sessions ({entries.length})</h3>
              <div className="session-log__list">
                {entries.map(entry => (
                  <div key={entry.id} className="session-row">
                    <div className="session-row__time">
                      {formatTime(entry.startTime, tf)} – {formatTime(entry.endTime!, tf)}
                    </div>
                    <div className="session-row__task">{entry.taskName}</div>
                    <div className="session-row__duration">
                      {formatDuration(entry.duration ?? 0)}
                    </div>
                    <div className="session-row__note-text">
                      {entry.note || '—'}
                    </div>
                    <button
                      className="btn btn--icon btn--icon-danger"
                      onClick={() => handleDeleteEntry(entry.id)}
                      title="Delete"
                    >
                      &#10005;
                    </button>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="backdate__totals">
                {taskTotals.map((t, i) => (
                  <div key={t.taskId} className="backdate__total-row">
                    <span>{i + 1}. {t.taskName}</span>
                    <span className="backdate__total-value">
                      {formatDurationShort(t.totalMs)}
                    </span>
                  </div>
                ))}
                <div className="backdate__total-row backdate__total-row--grand">
                  <span>Total tracked</span>
                  <span>{formatDurationShort(grandTotal)}</span>
                </div>
                {gapTime > 0 && (
                  <div className="backdate__total-row backdate__total-row--gap">
                    <span>Untracked gaps</span>
                    <span>{formatDurationShort(gapTime)}</span>
                  </div>
                )}
              </div>

              {/* Daily note */}
              <div className="backdate__note">
                <label className="field">
                  <span>Daily Note</span>
                  <textarea
                    value={dailyNote}
                    onChange={e => setDailyNote(e.target.value)}
                    onBlur={handleSaveNote}
                    placeholder="Notes for this day..."
                    rows={2}
                  />
                </label>
              </div>

              {/* Export */}
              <div className="backdate__export">
                <button className="btn btn--primary" onClick={() => handleCopy('email')}>
                  {copied === 'email' ? '✓ Copied!' : 'Copy Email Summary'}
                </button>
                <button className="btn btn--primary" onClick={() => handleCopy('plain')}>
                  {copied === 'plain' ? '✓ Copied!' : 'Copy Summary'}
                </button>
                <button className="btn btn--secondary" onClick={handleCSVExport}>
                  Export .csv
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};
